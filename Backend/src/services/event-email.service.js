import mongoose from 'mongoose';
import EmailLog from '../models/EmailLog.js';
import User from '../models/User.js';
import { sendMail } from './mail.service.js';

const batchSize = 20;
const batchDelayMs = 3000;
const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function eventMailData(event, firstName) {
  return {
    firstName: firstName || 'Member',
    eventTitle: event.title,
    eventDescription: event.description,
    eventDate: new Date(event.date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }),
    eventTime: event.time || '',
    eventLocation: event.location,
  };
}

async function deliverQueuedEmails(event, records) {
  for (let offset = 0; offset < records.length; offset += batchSize) {
    const batch = records.slice(offset, offset + batchSize);
    await Promise.all(batch.map(async (record) => {
      try {
        await sendMail({
          to: record.to,
          subject: `OrianaaClub event: ${event.title}`,
          template: 'event',
          data: eventMailData(event, record.firstName),
          logContext: {
            emailLogId: record._id,
            type: record.type,
            eventId: record.eventId,
            member: record.member,
          },
        });
      } catch (error) {
        console.error(
          `[event-email] Delivery failed for event=${event._id} member=${record.member}: ${error?.message || 'Unknown error'}`,
        );
      }
    }));
    if (offset + batchSize < records.length) await sleep(batchDelayMs);
  }
}

function queueDelivery(event, records) {
  if (!records.length) return;
  setImmediate(() => {
    deliverQueuedEmails(event, records).catch((error) => {
      console.error(`[event-email] Batch failed for event=${event._id}: ${error?.message || 'Unknown error'}`);
    });
  });
}

function skipLog(event, type, user, reason) {
  return {
    to: user.email,
    template: 'event',
    status: 'skipped',
    type,
    eventId: event._id,
    member: user._id,
    skipReason: reason,
  };
}

async function prepareEmails(event, users, { type, total, skippedInvalid = 0, skippedOptOut = 0, force }) {
  const memberIds = users.map((user) => user._id);
  const priorLogs = memberIds.length
    ? await EmailLog.find({
      eventId: event._id,
      member: { $in: memberIds },
      status: { $in: ['queued', 'sent'] },
    }).select('member status').lean()
    : [];
  const priorStatus = new Map(priorLogs.map((log) => [String(log.member), log.status]));
  const queueUsers = [];
  const skippedLogs = [];
  let skippedAlreadySent = 0;
  let skippedAlreadyQueued = 0;

  for (const user of users) {
    const previousStatus = priorStatus.get(String(user._id));
    if (previousStatus === 'queued') {
      skippedAlreadyQueued += 1;
      skippedLogs.push(skipLog(event, type, user, 'already_queued'));
    } else if (previousStatus === 'sent' && !force) {
      skippedAlreadySent += 1;
      skippedLogs.push(skipLog(event, type, user, 'already_sent'));
    } else {
      queueUsers.push(user);
    }
  }

  const queuedLogs = queueUsers.map((user) => ({
    to: user.email,
    template: 'event',
    status: 'queued',
    type,
    eventId: event._id,
    member: user._id,
  }));
  const inserted = [
    ...(skippedLogs.length ? await EmailLog.insertMany(skippedLogs) : []),
    ...(queuedLogs.length ? await EmailLog.insertMany(queuedLogs) : []),
  ];
  const queued = inserted.filter((log) => log.status === 'queued');
  queueDelivery(event.toObject ? event.toObject() : event, queued);

  return {
    total,
    queued: queued.length,
    skippedOptOut,
    skippedInvalid,
    skippedAlreadySent,
    skippedAlreadyQueued,
  };
}

export async function sendSelectedEvent(event, rawMemberIds, force = false) {
  const uniqueIds = [...new Set(rawMemberIds.map((id) => id.trim().toLowerCase()))];
  const objectIds = uniqueIds.filter((id) => /^[a-f\d]{24}$/i.test(id) && mongoose.isValidObjectId(id));
  const users = objectIds.length
    ? await User.find({ _id: { $in: objectIds } })
      .select('_id firstName email role status emailVerified emailOptOut deletedAt').lean()
    : [];
  const userById = new Map(users.map((user) => [String(user._id).toLowerCase(), user]));
  const eligible = [];
  const skippedLogs = [];
  let skippedInvalid = 0;
  let skippedOptOut = 0;

  for (const id of uniqueIds) {
    const user = userById.get(id);
    if (!user || user.role !== 'member' || user.status !== 'active'
      || user.emailVerified !== true || user.deletedAt || !validEmail.test(user.email || '')) {
      skippedInvalid += 1;
      if (user?.email) skippedLogs.push(skipLog(event, 'selected', user, 'ineligible'));
    } else if (user.emailOptOut === true) {
      skippedOptOut += 1;
      skippedLogs.push(skipLog(event, 'selected', user, 'email_opt_out'));
    } else {
      eligible.push(user);
    }
  }

  if (skippedLogs.length) await EmailLog.insertMany(skippedLogs);
  return prepareEmails(event, eligible, {
    type: 'selected',
    total: uniqueIds.length,
    skippedInvalid,
    skippedOptOut,
    force,
  });
}

export async function sendAllEvent(event, force = false) {
  const members = await User.find({
    role: 'member',
    status: 'active',
    emailVerified: true,
    deletedAt: null,
  }).select('_id firstName email emailOptOut').lean();
  const eligible = [];
  const skippedLogs = [];
  let skippedOptOut = 0;
  let skippedInvalid = 0;

  for (const user of members) {
    if (user.emailOptOut === true) {
      skippedOptOut += 1;
      skippedLogs.push(skipLog(event, 'bulk', user, 'email_opt_out'));
    } else if (!validEmail.test(user.email || '')) {
      skippedInvalid += 1;
      if (user.email) skippedLogs.push(skipLog(event, 'bulk', user, 'invalid_email'));
    } else {
      eligible.push(user);
    }
  }

  if (skippedLogs.length) await EmailLog.insertMany(skippedLogs);
  return prepareEmails(event, eligible, {
    type: 'bulk',
    total: members.length,
    skippedInvalid,
    skippedOptOut,
    force,
  });
}

export async function sendTestEvent(event, to, firstName) {
  await sendMail({
    to,
    subject: `OrianaaClub event preview: ${event.title}`,
    template: 'event',
    data: eventMailData(event, firstName),
    logContext: { type: 'test', eventId: event._id },
  });
}
