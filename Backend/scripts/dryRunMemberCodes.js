import mongoose from 'mongoose';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { env } from '../src/config/env.js';
import { MEMBER_ID_COUNTER_NAME } from '../src/config/member-id.js';
import Counter from '../src/models/Counter.js';
import FamilyMember from '../src/models/FamilyMember.js';
import Membership from '../src/models/Membership.js';
import Profile from '../src/models/Profile.js';
import Setting from '../src/models/Setting.js';
import User from '../src/models/User.js';
import { buildMemberId, isMemberId } from '../src/utils/memberCode.js';

function isLegacyCode(value) {
  return /^(?:2651\s*\d{8}|OC-\d{4,}(?:-(?:S|C\d+|F|M|SF|SM))?)$/i
    .test(String(value || '').trim());
}

function oldCode(record) {
  const candidates = [record.legacyMemberCode, record.memberCode, record.memberNo];
  return candidates.find((value) => value && !isMemberId(value) && isLegacyCode(value)) || '';
}

function legacyPrimarySequence(value) {
  const normalized = String(value || '').replace(/\s/g, '').toUpperCase();
  const oldCodeMatch = normalized.match(/^2651(\d{8})$/);
  if (oldCodeMatch) {
    const sequence = Number(oldCodeMatch[1]) - 10100000;
    return sequence > 0 ? sequence : null;
  }
  const oldOcMatch = normalized.match(/^OC-(\d+)$/);
  return oldOcMatch ? Number(oldOcMatch[1]) : null;
}

function isNominee(record) {
  return Boolean(record?.isNominee || String(record?.memberType || '').startsWith('nominee'));
}

function relationType(record) {
  const relation = String(record?.relation || record?.relationship || record?.memberType || '').toLowerCase();
  if (['spouse', 'wife', 'husband'].includes(relation)) return 'spouse';
  if (['child', 'son', 'daughter'].includes(relation)) return 'child';
  if (relation.includes('father')) return 'father';
  if (relation.includes('mother')) return 'mother';
  return '';
}

function suffixFor(record, childNumber = 0) {
  const type = relationType(record);
  if (type === 'spouse') return 'S';
  if (type === 'child') return `C${childNumber}`;
  if (type === 'father') return record.parentSide === 'spouse' ? 'SF' : 'F';
  if (type === 'mother') return record.parentSide === 'spouse' ? 'SM' : 'M';
  return '';
}

function activationDate(membership) {
  return new Date(membership.activatedAt || membership.approvedAt
    || membership.startDate || membership.createdAt || Date.now());
}

function expiryDate(membership, primary, settings) {
  const savedExpiry = primary?.membershipExpireAt || primary?.endDate
    || membership.membershipExpireAt || membership.endDate;
  if (savedExpiry) return new Date(savedExpiry);
  const start = activationDate(primary || membership);
  start.setUTCFullYear(start.getUTCFullYear() + settings.membershipValidityYears);
  return start;
}

function existingSequence(memberId) {
  if (!isMemberId(memberId)) return 0;
  const match = String(memberId).match(/^OC-\d{6}(\d+)(?:-|$)/);
  return match ? Number(match[1]) : 0;
}

function priority(item) {
  return ({
    primary: 0,
    spouse: 1,
    child: 2,
    father: 3,
    mother: 4,
    spouseFather: 5,
    spouseMother: 6,
  })[item.relation] ?? 7;
}

async function memberName(membership, profiles, users, familyMember) {
  if (familyMember?.name || familyMember?.fullName) return familyMember.name || familyMember.fullName;
  const userId = String(membership.user || membership.customer || '');
  return profiles.get(userId) || users.get(userId) || 'Unknown member';
}

export async function dryRunMemberIdMigration({ apply = process.argv.includes('--apply') } = {}) {
  await mongoose.connect(env.mongodbUri, {
    autoIndex: false,
    autoCreate: false,
    serverSelectionTimeoutMS: 10000,
  });

  const [memberships, familyMembers, counter, settingsRecord] = await Promise.all([
    Membership.find({}).lean(),
    FamilyMember.find({}).lean(),
    Counter.findOne({ name: MEMBER_ID_COUNTER_NAME }).select('value seq').lean(),
    Setting.findById('global').lean(),
  ]);
  const legacySequenceOwners = new Map();
  for (const membership of memberships) {
    if (membership.familyMember || isNominee(membership)) continue;
    const legacy = oldCode(membership);
    const sequence = legacyPrimarySequence(legacy);
    if (!sequence) continue;
    const ownerId = String(membership.user || membership.customer || membership._id);
    const previous = legacySequenceOwners.get(sequence);
    if (previous && previous.ownerId !== ownerId) {
      throw new Error(
        `Legacy member code sequence ${sequence} is shared by ${previous.code} and ${legacy}.`,
      );
    }
    legacySequenceOwners.set(sequence, { ownerId, code: legacy });
  }
  const settings = { membershipValidityYears: 25, ...settingsRecord };
  const familyById = new Map(familyMembers.map((member) => [String(member._id), member]));
  const linkedMembershipByFamily = new Map(
    memberships.filter((item) => item.familyMember).map((item) => [String(item.familyMember), item]),
  );
  const profileUserIds = [...new Set(memberships
    .filter((membership) => !membership.familyMember)
    .map((membership) => String(membership.user || membership.customer || ''))
    .filter(Boolean))];
  const [profiles, users] = await Promise.all([
    profileUserIds.length
      ? Profile.find({ user: { $in: profileUserIds } }).select('user fullName').lean()
      : [],
    profileUserIds.length
      ? User.find({ _id: { $in: profileUserIds } }).select('firstName').lean()
      : [],
  ]);
  const profilesByUser = new Map(profiles.map((profile) => [String(profile.user), profile.fullName]));
  const usersById = new Map(users.map((user) => [String(user._id), user.firstName]));
  const ids = [
    ...memberships.flatMap((membership) => [
    membership.memberId,
    membership.memberCode,
    membership.memberNo,
    ]),
    ...familyMembers.flatMap((member) => [member.memberId, member.memberNo]),
  ].filter(isMemberId);
  const sequences = new Map();
  for (const id of ids) {
    const sequence = existingSequence(id);
    if (sequences.has(sequence) && sequences.get(sequence) !== id) {
      throw new Error(`Member ID sequence ${sequence} is already assigned more than once.`);
    }
    sequences.set(sequence, id);
  }
  const counterBefore = Math.max(0, Number(counter?.value) || 0, Number(counter?.seq) || 0);
  let nextSequence = Math.max(counterBefore, ...sequences.keys(), 0);
  const candidates = [];
  const unpaidLegacyFamilyProfiles = familyMembers.filter((member) => (
    !isNominee(member)
    && !linkedMembershipByFamily.has(String(member._id))
    && oldCode(member)
  ));

  for (const membership of memberships) {
    if (isNominee(membership)) continue;
    const familyMember = membership.familyMember
      ? familyById.get(String(membership.familyMember))
      : null;
    if (membership.familyMember && (!familyMember || isNominee(familyMember))) continue;
    const legacy = oldCode(membership) || oldCode(familyMember || {});
    const currentId = [membership.memberId, membership.memberCode, membership.memberNo, familyMember?.memberId, familyMember?.memberNo]
      .find(isMemberId) || '';
    if (!currentId && membership.status !== 'active' && !legacy) continue;

    const primary = membership.linkedTo
      ? memberships.find((item) => String(item._id) === String(membership.linkedTo))
      : membership;
    const isPrimary = membership.memberType === 'primary' || !membership.linkedTo;
    const relation = isPrimary
      ? 'primary'
      : familyMember?.parentSide === 'spouse' && relationType(familyMember) === 'father'
        ? 'spouseFather'
        : familyMember?.parentSide === 'spouse' && relationType(familyMember) === 'mother'
          ? 'spouseMother'
          : relationType(familyMember || membership);
    const activatedAt = activationDate(membership);
    const expiry = expiryDate(membership, primary, settings);
    const missingMembershipExpiry = membership.status === 'active'
      && !membership.membershipExpireAt
      && !membership.endDate;
    candidates.push({
      membership,
      familyMember,
      primary,
      legacy,
      currentId,
      activatedAt,
      expiry,
      relation,
      sortRelation: relation,
      missingMembershipExpiry,
    });
  }

  candidates.sort((left, right) => (
    left.activatedAt - right.activatedAt
    || priority(left) - priority(right)
    || String(left.membership._id).localeCompare(String(right.membership._id))
  ));
  const childNumberByPrimary = new Map();
  for (const member of familyMembers) {
    if (relationType(member) !== 'child' || isNominee(member)) continue;
    const primaryKey = String(member.membership);
    const savedNumber = Number(member.familyChildNumber);
    const oldSuffix = String(member.memberNo || '').match(/-C(\d+)$/);
    const childNumber = savedNumber > 0 ? savedNumber : oldSuffix ? Number(oldSuffix[1]) : 0;
    if (childNumber) {
      childNumberByPrimary.set(primaryKey, Math.max(childNumberByPrimary.get(primaryKey) || 0, childNumber));
    }
  }
  for (const candidate of candidates) {
    if (candidate.currentId) {
      candidate.memberId = candidate.currentId;
      continue;
    }
    let suffix = '';
    if (candidate.relation !== 'primary') {
      const familyMember = candidate.familyMember || candidate.membership;
      if (candidate.relation === 'child') {
        const primaryKey = String(candidate.primary?._id || candidate.membership.linkedTo || '');
        const savedNumber = Number(familyMember.familyChildNumber);
        const oldSuffix = String(familyMember.memberNo || '').match(/-C(\d+)$/);
        const childNumber = savedNumber > 0
          ? savedNumber
          : oldSuffix
            ? Number(oldSuffix[1])
            : (childNumberByPrimary.get(primaryKey) || 0) + 1;
        childNumberByPrimary.set(primaryKey, Math.max(childNumberByPrimary.get(primaryKey) || 0, childNumber));
        candidate.familyChildNumber = childNumber;
        suffix = `C${childNumber}`;
      } else {
        suffix = suffixFor(familyMember, 0);
      }
      if (!suffix) continue;
    }
    nextSequence += 1;
    candidate.memberId = buildMemberId({
      activatedAt: candidate.activatedAt,
      expiresAt: candidate.expiry,
      sequence: nextSequence,
      suffix,
    });
  }

  const collisionCheck = new Map();
  for (const item of candidates) {
    if (!item.memberId) continue;
    const sequence = existingSequence(item.memberId);
    if (collisionCheck.has(sequence) && collisionCheck.get(sequence) !== item.memberId) {
      throw new Error(`Member ID sequence ${sequence} is planned more than once.`);
    }
    collisionCheck.set(sequence, item.memberId);
  }

  console.log(apply
    ? 'APPLY MODE: database writes are enabled.'
    : 'DRY RUN: no database documents or counters were modified.');
  console.log('\nMembership ID assignments (activation order):');
  for (const item of candidates) {
    if (!item.memberId) continue;
    const name = await memberName(item.membership, profilesByUser, usersById, item.familyMember);
    const date = item.activatedAt.toISOString().slice(0, 10);
    if (item.currentId && !item.legacy) continue;
    if (item.membership.status === 'active' && !item.currentId) {
      console.log(`  ${date} ${name} [${item.membership._id}]: no ID -> ${item.memberId}`);
    } else if (item.legacy) {
      console.log(`  ${date} ${name} [${item.membership._id}]: ${item.legacy} -> ${item.memberId}`);
    }
  }
  const expiryRepairs = candidates.filter((item) => item.missingMembershipExpiry);
  console.log('\nMissing membership expiry dates:');
  if (!expiryRepairs.length) console.log('  None.');
  for (const item of expiryRepairs) {
    const name = await memberName(item.membership, profilesByUser, usersById, item.familyMember);
    console.log(`  ${name} [${item.membership._id}]: would set membershipExpireAt and endDate to ${item.expiry.toISOString()}`);
  }
  if (unpaidLegacyFamilyProfiles.length) {
    console.log('\nLegacy codes on family profiles without an active membership:');
    for (const member of unpaidLegacyFamilyProfiles) {
      console.log(`  ${member.name || member.fullName || 'Family member'} [${member._id}]: ${oldCode(member)} -> no ID (unpaid profile)`);
    }
  }
  console.log(`\nCounter before: ${counterBefore}`);
  console.log(`Counter after proposed changes: ${nextSequence}`);

  if (apply) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        for (const item of candidates) {
          const membershipSet = {};
          if (!item.currentId && item.memberId) {
            const legacy = item.legacy || '';
            Object.assign(membershipSet, {
              memberId: item.memberId,
              memberCode: item.memberId,
              memberNo: item.memberId,
              ...(legacy && !item.membership.legacyMemberCode
                ? { legacyMemberCode: legacy }
                : {}),
            });
          }
          if (item.missingMembershipExpiry) {
            membershipSet.endDate = item.expiry;
            membershipSet.membershipExpireAt = item.expiry;
          }
          if (Object.keys(membershipSet).length) {
            await Membership.updateOne(
              {
                _id: item.membership._id,
                ...(item.missingMembershipExpiry ? {
                  status: 'active',
                  $and: [
                    { $or: [{ membershipExpireAt: null }, { membershipExpireAt: { $exists: false } }] },
                    { $or: [{ endDate: null }, { endDate: { $exists: false } }] },
                  ],
                } : {}),
              },
              { $set: membershipSet },
              { session },
            );
          }
          if (!item.currentId && item.memberId && item.familyMember) {
            await FamilyMember.updateOne(
              { _id: item.familyMember._id },
              {
                $set: {
                  memberId: item.memberId,
                  memberNo: item.memberId,
                  ...(item.legacy && !item.familyMember.legacyMemberCode
                    ? { legacyMemberCode: item.legacy }
                    : {}),
                  ...(item.familyChildNumber
                    ? { familyChildNumber: item.familyChildNumber }
                    : {}),
                },
              },
              { session },
            );
          }
        }
        for (const member of familyMembers) {
          const linked = linkedMembershipByFamily.get(String(member._id));
          if (isNominee(member) || linked?.status === 'active') continue;
          if (member.memberNo && !isMemberId(member.memberNo)) {
            await FamilyMember.updateOne(
              { _id: member._id },
              {
                $set: {
                  memberNo: '',
                  memberId: '',
                  ...(member.legacyMemberCode ? {} : { legacyMemberCode: member.memberNo }),
                },
              },
              { session },
            );
          }
        }
        await Counter.updateOne(
          { name: MEMBER_ID_COUNTER_NAME },
          {
            $max: { value: nextSequence, seq: nextSequence },
            $setOnInsert: { name: MEMBER_ID_COUNTER_NAME, key: MEMBER_ID_COUNTER_NAME },
          },
          { upsert: true, session },
        );
      });
    } finally {
      await session.endSession();
    }
    await Membership.collection.createIndex(
      { memberId: 1 },
      {
        unique: true,
        name: 'membership_member_id_unique',
        partialFilterExpression: { memberId: { $type: 'string', $gt: '' } },
      },
    );
    await FamilyMember.collection.createIndex(
      { memberId: 1 },
      {
        unique: true,
        name: 'family_member_id_unique',
        partialFilterExpression: { memberId: { $type: 'string', $gt: '' } },
      },
    );
    console.log('\nMigration applied successfully.');
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  dryRunMemberIdMigration()
    .catch((error) => {
      console.error(`[db:migrate:member-ids] ${error.message}`);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect();
    });
}
