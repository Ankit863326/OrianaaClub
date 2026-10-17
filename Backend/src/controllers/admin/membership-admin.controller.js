import QRCode from 'qrcode';
import * as membershipAdminService from '../../services/membership-admin.service.js';
import { recordRequestAction } from '../../services/audit.service.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { writeCsvHeader, writeCsvRow } from '../../utils/csv.js';
import { cancelAdminRedemption } from '../../services/billing.service.js';
import { listMembershipsWithPointsExpiring } from '../../services/membership-expiry.service.js';
import Membership from '../../models/Membership.js';
import PointLedger from '../../models/PointLedger.js';
import Redemption from '../../models/Redemption.js';
import ApiError from '../../utils/ApiError.js';
import { getMembershipMemberCode } from '../../utils/memberCode.js';
import * as identityVerificationService from '../../services/identity-verification.service.js';

export const listPlans = asyncHandler(async (request, response) => {
  const data = await membershipAdminService.listMembershipPlans();
  response.json({ success: true, data, message: 'Membership plans loaded.' });
});

export const earlyBirdCounter = asyncHandler(async (request, response) => {
  const data = await membershipAdminService.getEarlyBirdCounter();
  response.json({ success: true, data, message: 'Early-bird counter loaded.' });
});

export const updatePlan = asyncHandler(async (request, response) => {
  const plan = await membershipAdminService.updateMembershipPlan(
    request.validated.params.id,
    request.validated.body,
  );
  await recordRequestAction(request, {
    action: 'membership_plan.update',
    entityType: 'membership_plan',
    entityId: plan._id,
    summary: `Updated membership plan ${plan.name}.`,
    after: request.validated.body,
  });
  response.json({ success: true, data: plan, message: 'Membership plan updated.' });
});

export const getSettings = asyncHandler(async (request, response) => {
  const data = await membershipAdminService.getMembershipSettings();
  response.json({ success: true, data, message: 'Membership settings loaded.' });
});

export const updateSettings = asyncHandler(async (request, response) => {
  const before = await membershipAdminService.getMembershipSettings();
  const data = await membershipAdminService.updateMembershipSettings(request.validated.body);
  await recordRequestAction(request, {
    action: 'membership_settings.update',
    entityType: 'membership_settings',
    entityId: 'global',
    summary: 'Updated membership settings.',
    before,
    after: data,
  });
  response.json({ success: true, data, message: 'Membership settings updated.' });
});

export const listMemberships = asyncHandler(async (request, response) => {
  const data = await membershipAdminService.listMemberships(request.validated.query);
  response.json({ success: true, data, message: 'Memberships loaded.' });
});

export const membershipDetails = asyncHandler(async (request, response) => {
  const data = await membershipAdminService.getMembershipDetails(request.validated.params.id);
  response.json({ success: true, data, message: 'Membership details loaded.' });
});

export const identityVerificationDetails = asyncHandler(async (request, response) => {
  const membership = await Membership.findById(request.validated.params.id).select('user');
  if (!membership) throw new ApiError(404, 'Membership was not found.');
  const data = await identityVerificationService.getAdminIdentityVerification(membership.user);
  await recordRequestAction(request, {
    action: 'identity_verification.view',
    entityType: 'identity_verification',
    entityId: membership.user,
    summary: 'Administrator viewed identity verification details.',
  });
  response.json({ success: true, data, message: 'Identity verification details loaded.' });
});

export const identityVerificationDocument = asyncHandler(async (request, response) => {
  const membership = await Membership.findById(request.validated.params.id).select('user');
  if (!membership) throw new ApiError(404, 'Membership was not found.');
  const { document, buffer } = await identityVerificationService.readAdminIdentityDocument(
    membership.user,
    request.validated.params.documentId,
  );
  await recordRequestAction(request, {
    action: 'identity_document.view',
    entityType: 'identity_verification',
    entityId: membership.user,
    summary: 'Administrator viewed a private identity document.',
    after: { documentKind: document.kind },
  });
  response.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    'Content-Type': document.mimeType,
    'Content-Disposition': `inline; filename="${document.kind}"`,
  });
  response.send(buffer);
});

export const reviewIdentityVerification = asyncHandler(async (request, response) => {
  const membership = await Membership.findById(request.validated.params.id).select('user');
  if (!membership) throw new ApiError(404, 'Membership was not found.');
  const { status, reason = '' } = request.validated.body;
  const data = await identityVerificationService.reviewIdentityVerification(
    membership.user,
    request.user._id,
    { status, reason },
  );
  await recordRequestAction(request, {
    action: `identity_verification.${status}`,
    entityType: 'identity_verification',
    entityId: membership.user,
    summary: `Administrator ${status} identity verification.`,
    after: { status },
    reason: status === 'rejected' ? reason : '',
  });
  response.json({ success: true, data, message: `Identity verification ${status}.` });
});

export const membershipQr = asyncHandler(async (request, response) => {
  const membership = await Membership.findById(request.validated.params.id).select('memberCode memberNumber');
  if (!membership) throw new ApiError(404, 'Membership was not found.');
  const memberCode = getMembershipMemberCode(membership);
  if (!memberCode) throw new ApiError(409, 'A member code is not assigned yet.');
  const qr = await QRCode.toBuffer(memberCode, { type: 'png', margin: 2 });
  response.set({
    'Content-Type': 'image/png',
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'X-Content-Type-Options': 'nosniff',
  });
  response.send(qr);
});

export const renewMembership = asyncHandler(async (request, response) => {
  const data = await membershipAdminService.createRenewal(
    request.user._id,
    request.validated.params.id,
    request.validated.body,
  );
  const membershipId = data.membership?._id || data._id;
  await recordRequestAction(request, {
    action: 'membership.renewal.create',
    entityType: 'membership',
    entityId: membershipId || request.validated.params.id,
    summary: 'Created a renewal or upgrade membership payment.',
    after: {
      membershipId: String(membershipId || ''),
      paymentId: String(data.payment?._id || data.paymentId || ''),
    },
  });
  response.status(201).json({ success: true, data, message: 'Renewal payment created.' });
});

export const rejectVerification = asyncHandler(async (request, response) => {
  const membership = await Membership.findOneAndUpdate(
    { _id: request.validated.params.id, status: 'pending_verification' },
    {
      $set: {
        status: 'cancelled',
        deactivationReason: request.validated.body.reason,
      },
    },
    { new: true, runValidators: true },
  );
  if (!membership) throw new ApiError(409, 'Membership is not awaiting verification.');
  await recordRequestAction(request, {
    action: 'membership.verification.reject',
    entityType: 'membership',
    entityId: membership._id,
    summary: 'Membership verification rejected.',
    after: { status: membership.status },
    reason: request.validated.body.reason,
  });
  response.json({ success: true, data: membership, message: 'Membership verification rejected.' });
});

export const queue = asyncHandler(async (request, response) => {
  const data = await membershipAdminService.getMembershipQueue(request.validated.query);
  response.json({ success: true, data, message: 'Membership queue loaded.' });
});

export const reports = asyncHandler(async (request, response) => {
  const data = await membershipAdminService.getMembershipReports();
  response.json({ success: true, data, message: 'Membership reports loaded.' });
});

export const membershipReports = asyncHandler(async (request, response) => {
  const data = await membershipAdminService.getMembershipOperationsReport(request.validated.query);
  response.json({ success: true, data, message: 'Membership operations report loaded.' });
});

export const bills = asyncHandler(async (request, response) => {
  const data = await import('../../services/billing.service.js')
    .then(({ listRedemptions }) => listRedemptions(request.validated.query));
  response.json({ success: true, data, message: 'Membership bills loaded.' });
});

export const exportBills = asyncHandler(async (request, response) => {
  const filter = {};
  const query = request.validated.query;
  if (query.status) filter.status = query.status;
  if (query.serviceType) filter.serviceType = query.serviceType;
  if (query.channel === 'billing_counter') {
    filter.$or = [{ channel: 'billing_counter' }, { channel: { $exists: false } }];
  } else if (query.channel) {
    filter.channel = query.channel;
  }
  if (query.memberCode) {
    filter.memberCode = query.memberCode.toUpperCase().replace(/^OC-/, '').replace(/[\s-]/g, '');
  }
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = new Date(query.from);
    if (query.to) {
      const end = new Date(query.to);
      end.setUTCHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }
  const cursor = Redemption.find(filter).sort({ createdAt: -1 }).cursor();
  writeCsvHeader(response, 'membership-bills.csv', [
    'Date', 'Member code', 'Service', 'Booking ID', 'Bill ID',
    'Channel', 'Bill amount', 'Discounted amount', 'Points used', 'Balance after',
    'Status', 'Refunded points',
  ]);
  for await (const bill of cursor) {
    writeCsvRow(response, [
      bill.createdAt.toISOString(),
      bill.memberCode,
      bill.serviceType,
      bill.bookingId,
      bill.billId,
      bill.channel || 'billing_counter',
      bill.billAmount,
      bill.discountedAmount,
      bill.pointsUsed,
      bill.balanceAfter,
      bill.status,
      bill.refundedPoints,
    ]);
  }
  response.end();
});

export const cancelBill = asyncHandler(async (request, response) => {
  const data = await cancelAdminRedemption(request.validated.params.id, request.validated.body.cancelledAt);
  await recordRequestAction(request, {
    action: 'redemption.cancel',
    entityType: 'redemption',
    entityId: request.validated.params.id,
    summary: 'Administrator cancelled a redemption.',
    after: { status: data.status, refundedPoints: data.refundedPoints },
  });
  response.json({ success: true, data, message: 'Bill cancelled.' });
});

export const pendingMemberships = asyncHandler(async (request, response) => {
  const status = request.validated.query.status;
  const result = await Membership.find({ status: { $in: status ? [status] : ['pending_payment', 'pending_verification'] } })
    .sort({ createdAt: 1 })
    .populate('user', 'firstName email')
    .populate('plan', 'name price')
    .lean();
  response.json({ success: true, data: result, message: 'Pending memberships loaded.' });
});

export const pointsExpiring = asyncHandler(async (request, response) => {
  const withinDays = Number(request.validated.query.withinDays);
  const data = await listMembershipsWithPointsExpiring(withinDays);
  response.json({ success: true, data, message: 'Expiring points memberships loaded.' });
});

export const ledger = asyncHandler(async (request, response) => {
  const membership = await Membership.exists({ _id: request.validated.params.id });
  if (!membership) throw new ApiError(404, 'Membership was not found.');
  const { page, limit } = request.validated.query;
  const filter = { membership: request.validated.params.id };
  if (request.validated.query.type) filter.type = request.validated.query.type;
  const [items, total] = await Promise.all([
    PointLedger.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    PointLedger.countDocuments(filter),
  ]);
  response.json({
    success: true,
    data: { items, page, limit, total, pages: Math.ceil(total / limit) },
    message: 'Membership ledger loaded.',
  });
});
