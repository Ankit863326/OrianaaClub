// Phase 4: Finalize collected payments and support administrator payment decisions.
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import mongoose from 'mongoose';
import Payment from '../models/Payment.js';
import Membership from '../models/Membership.js';
import IdentityVerification from '../models/IdentityVerification.js';
import MembershipPlan from '../models/MembershipPlan.js';
import FamilyMember from '../models/FamilyMember.js';
import Profile from '../models/Profile.js';
import PointLedger from '../models/PointLedger.js';
import AuditLog from '../models/AuditLog.js';
import Counter from '../models/Counter.js';
import { getNextMemberNumber } from './membership-id.service.js';
import { getSettings } from '../models/Setting.js';
import { getMembershipMemberCode } from '../utils/memberCode.js';
import User from '../models/User.js';
import Plan from '../models/Plan.js';
import { sendMail } from './mail.service.js';
import { getPayableAmount, paiseToRupees, rupeesToPaise } from '../utils/money.js';
import ApiError from '../utils/ApiError.js';
import { razorpayClient } from '../config/razorpay.js';
import { env } from '../config/env.js';
import { requireCurrentTermsConsent } from './terms.service.js';
import Verification from '../models/Verification.js';
import { calculateMemberPrice } from './pricing.service.js';
import { allocateMemberId } from './member-id.service.js';

const activeMembershipBlockedMessage = 'You already have an active membership. Renewal or upgrade opens when your points are fully used or expired.';
const renewableMembershipMessage = 'Your points are fully used (or expired). You can renew or upgrade your plan.';
const pendingPaymentMessage = 'Your membership payment is pending admin confirmation';
const pendingVerificationMessage = 'Your membership is pending document verification';

function activeMembershipMessage(membership) {
  const pointsBalance = Number.isSafeInteger(membership.pointsBalance) ? membership.pointsBalance : 0;
  const pointsExpired = !membership.pointsExpireAt || membership.pointsExpireAt <= new Date();
  return pointsBalance === 0 || pointsExpired
    ? renewableMembershipMessage
    : activeMembershipBlockedMessage;
}

function requirePaymentConfiguration() {
  if (!env.razorpayKeyId || !env.razorpayKeySecret || !razorpayClient) {
    throw new ApiError(
      503,
      'Online payment is not enabled yet. Your membership is saved as pending payment.',
    );
  }
}

function signaturesMatch(expected, supplied) {
  if (typeof supplied !== 'string' || !/^[a-f\d]{64}$/i.test(supplied)) return false;
  const expectedBuffer = Buffer.from(expected, 'hex');
  const suppliedBuffer = Buffer.from(supplied, 'hex');
  return expectedBuffer.length === suppliedBuffer.length
    && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

function paymentSignature(orderId, paymentId) {
  return createHmac('sha256', env.razorpayKeySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
}

async function verifyMembershipPaymentAmount(payment, transactionAmount = payment.totalAmount) {
  const PlanModel = payment.planModel === 'MembershipPlan' ? MembershipPlan : Plan;
  const planExists = await PlanModel.exists({ _id: payment.plan });
  if (payment.familyMember) {
    if (
      !planExists
      || rupeesToPaise(payment.amount) !== payment.baseAmount
      || payment.baseAmount + payment.gstAmount !== payment.totalAmount
    ) {
      throw new ApiError(400, 'The family payment does not match its saved GST invoice.');
    }
    return;
  }
  let expected;
  try {
    expected = getPayableAmount({ price: payment.amount }, {
      enabled: payment.gstEnabled ?? payment.gstAmount > 0,
      rate: payment.gstRate ?? (payment.baseAmount
        ? Math.round((payment.gstAmount / payment.baseAmount) * 10000) / 100
        : 0),
      label: payment.gstLabel,
    });
  } catch {
    throw new ApiError(400, 'The stored payment breakdown is invalid.');
  }
  if (
    !planExists
    || payment.baseAmount !== expected.baseAmount
    || payment.gstAmount !== expected.gstAmount
    || payment.totalAmount !== expected.totalAmount
    || transactionAmount !== expected.totalAmount
  ) {
    throw new ApiError(400, 'The payment amount does not match its saved membership invoice.');
  }
}

function webhookSignatureMatches(rawBody, supplied) {
  if (!Buffer.isBuffer(rawBody) || typeof supplied !== 'string' || !/^[a-f\d]{64}$/i.test(supplied)) {
    return false;
  }
  const expected = createHmac('sha256', env.razorpayWebhookSecret).update(rawBody).digest();
  const provided = Buffer.from(supplied, 'hex');
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

export async function createRazorpayOrder(userId, membershipId, method) {
  await requireCurrentTermsConsent(userId);
  requirePaymentConfiguration();
  const membership = await Membership.findOne({
    _id: membershipId,
    user: userId,
    status: 'pending_payment',
  }).populate('plan');
  if (!membership) throw new ApiError(404, 'Pending membership was not found.');

  const settings = await getSettings();
  const amount = getPayableAmount(membership.plan, {
    enabled: settings.gstEnabled,
    rate: settings.gstRate,
    label: settings.gstLabel,
  });
  const order = await razorpayClient.orders.create({
    amount: amount.totalAmount,
    currency: amount.currency,
    receipt: `oc-${membership._id}-${randomUUID().slice(0, 8)}`,
  });

  await Payment.create({
    user: userId,
    membership: membership._id,
    plan: membership.plan._id,
    planModel: membership.planModel,
    amount: membership.plan.price,
    method,
    status: 'created',
    ...amount,
    razorpayOrderId: order.id,
  });

  return { orderId: order.id, keyId: env.razorpayKeyId };
}

export async function verifyRazorpayPayment(
  userId,
  { razorpay_order_id, razorpay_payment_id, razorpay_signature },
  { familyMemberId } = {},
) {
  requirePaymentConfiguration();
  const payment = await Payment.findOne({
    razorpayOrderId: razorpay_order_id,
    user: userId,
    method: { $in: ['upi', 'card', 'razorpay'] },
  });
  if (!payment) throw new ApiError(404, 'Payment order was not found.');
  if (familyMemberId && String(payment.familyMember || '') !== String(familyMemberId)) {
    throw new ApiError(404, 'Family payment order was not found.');
  }
  if (!familyMemberId && payment.familyMember) {
    throw new ApiError(409, 'This family payment must be confirmed from its family checkout.');
  }

  if (!signaturesMatch(paymentSignature(razorpay_order_id, razorpay_payment_id), razorpay_signature)) {
    throw new ApiError(400, 'The payment verification failed. Please try again.');
  }
  if (payment.status === 'paid') {
    if (payment.razorpayPaymentId !== razorpay_payment_id) {
      throw new ApiError(409, 'This payment order has already been used.');
    }
    return { status: 'paid', membershipId: String(payment.membership) };
  }
  if (payment.status !== 'created') {
    throw new ApiError(409, 'This payment order is no longer available.');
  }
  const providerPayment = await razorpayClient.payments.fetch(razorpay_payment_id);
  if (
    providerPayment.order_id !== razorpay_order_id
    || providerPayment.amount !== payment.totalAmount
    || providerPayment.currency !== payment.currency
    || providerPayment.status !== 'captured'
  ) {
    throw new ApiError(400, 'The verified payment does not match this membership order.');
  }

  const result = await finalizePayment(payment._id, {
    razorpayPaymentId: razorpay_payment_id,
    razorpaySignature: razorpay_signature,
    markPaid: true,
  });
  return { status: result.status, membershipId: String(result.membership) };
}

export async function processRazorpayWebhook(rawBody, signature, eventId) {
  if (!env.razorpayWebhookSecret
    || !webhookSignatureMatches(rawBody, signature)) {
    throw new ApiError(400, 'Invalid payment webhook signature.');
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    throw new ApiError(400, 'Invalid payment webhook payload.');
  }

  const paymentEntity = event.payload?.payment?.entity;
  const orderId = paymentEntity?.order_id || event.payload?.order?.entity?.id;
  if (!orderId) return { received: true, processed: false };

  const payment = await Payment.findOne({ razorpayOrderId: orderId });
  if (!payment) return { received: true, processed: false };
  const handlesPayment = event.event === 'payment.captured'
    || event.event === 'order.paid'
    || event.event === 'payment.failed';
  if (!handlesPayment || !paymentEntity?.id) {
    return { received: true, processed: false };
  }
  if (event.event === 'payment.captured' || event.event === 'order.paid') {
    if (
      paymentEntity.order_id !== payment.razorpayOrderId
      || paymentEntity.amount !== payment.totalAmount
      || paymentEntity.currency !== payment.currency
    ) {
      throw new ApiError(400, 'The Razorpay webhook payment does not match its saved invoice.');
    }
  }

  const identifier = eventId || `${event.event || 'payment'}:${paymentEntity?.id || orderId}`;
  const claim = await Payment.updateOne(
    { _id: payment._id, razorpayEventIds: { $ne: identifier } },
    { $addToSet: { razorpayEventIds: identifier } },
  );
  if (claim.modifiedCount === 0) return { received: true, processed: false };

  try {
    if (event.event === 'payment.captured' || event.event === 'order.paid') {
      await finalizePayment(payment._id, { razorpayPaymentId: paymentEntity.id });
    } else if (event.event === 'payment.failed') {
      await Payment.updateOne(
        { _id: payment._id, status: 'created' },
        { $set: { status: 'failed' } },
      );
    }
  } catch (error) {
    await Payment.updateOne({ _id: payment._id }, { $pull: { razorpayEventIds: identifier } });
    throw error;
  }

  return { received: true, processed: true };
}

async function incrementCounter(name, session) {
  const counter = await Counter.findOneAndUpdate(
    { name },
    { $inc: { value: 1 }, $setOnInsert: { name } },
    { new: true, upsert: true, session, setDefaultsOnInsert: true },
  );
  return counter.value;
}

function paiseToWholeRupees(paise) {
  if (!Number.isSafeInteger(paise) || paise < 0) {
    throw new ApiError(409, 'The saved payment amount is invalid.');
  }
  return Number((BigInt(paise) + 50n) / 100n);
}

export async function finalizePayment(paymentId, options = {}) {
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const payment = await Payment.findById(paymentId).session(session);
      if (!payment) throw new ApiError(404, 'Payment was not found.');
      const membership = await Membership.findOne({
        _id: payment.membership,
        user: payment.user,
        status: { $in: ['draft', 'pending_payment', 'payment_pending', 'pending_verification', 'pending_approval', 'active'] },
      }).session(session);
      if (!membership) throw new ApiError(409, 'The payment does not match an eligible membership.');
      if (String(membership.familyMember || '') !== String(payment.familyMember || '')) {
        throw new ApiError(409, 'The payment family profile does not match its membership.');
      }

      if (payment.status === 'refunded' || payment.status === 'partially_refunded') {
        throw new ApiError(409, 'Refunded payments cannot confirm a membership.');
      }
      if (!['created', 'pending', 'pending_verification', 'confirmed', 'paid'].includes(payment.status)) {
        throw new ApiError(409, 'This payment is no longer available for confirmation.');
      }
      if (
        payment.status !== 'confirmed'
        && payment.status !== 'paid'
        && payment.method === 'razorpay'
        && !options.razorpayPaymentId
      ) {
        throw new ApiError(409, 'A verified Razorpay payment is required before confirmation.');
      }
      let invoiceNumber = payment.invoiceNumber;
      if (!invoiceNumber) {
        const year = new Date().getUTCFullYear();
        const invoiceSequence = await incrementCounter(`invoice-${year}`, session);
        invoiceNumber = `INV-${year}-${String(invoiceSequence).padStart(6, '0')}`;
      }
      const now = new Date();
      if (!['pending_approval', 'active'].includes(membership.status)) {
        const settings = await getSettings({ forceRefresh: true });
        let familyMember = null;
        if (membership.familyMember) {
          familyMember = await FamilyMember.findOne({
            _id: membership.familyMember,
            membership: membership.linkedTo,
            status: 'payment_pending',
            isNominee: false,
          }).session(session);
          const primary = await Membership.findOne({
            _id: membership.linkedTo,
            user: membership.user,
            memberType: 'primary',
            status: 'active',
          }).session(session);
          const VerificationModel = await Verification.findOne({
            memberId: membership.familyMember,
            status: 'verified',
          }).session(session);
          if (!familyMember || !primary || !VerificationModel) {
            throw new ApiError(409, 'The verified family profile or active primary membership is no longer eligible.');
          }
          const PlanModel = membership.planModel === 'MembershipPlan' ? MembershipPlan : Plan;
          const plan = await PlanModel.findById(membership.plan).session(session).lean();
          if (!plan) throw new ApiError(409, 'The family membership plan could not be found.');
          const quote = await calculateMemberPrice({
            plan,
            member: familyMember,
            memberType: membership.memberType,
            parentSide: membership.parentSide,
            dob: membership.dob,
            purchaseDate: now,
            linkedPrimary: primary,
            session,
            settings,
          });
          if (
            rupeesToPaise(quote.baseAmount) !== payment.baseAmount
            || rupeesToPaise(quote.gstAmount) !== payment.gstAmount
            || rupeesToPaise(quote.totalPayable) !== payment.totalAmount
          ) {
            throw new ApiError(409, 'The family membership price or eligibility changed before payment confirmation.');
          }
        }
        membership.baseAmount = paiseToWholeRupees(payment.baseAmount);
        membership.gstAmount = paiseToWholeRupees(payment.gstAmount);
        membership.totalPaid = paiseToWholeRupees(payment.totalAmount);
        membership.paymentConfirmedAt = now;
        const requiresIdentityVerification = options.requireIdentityVerification === true
          && !membership.familyMember;
        membership.approvalDueAt = requiresIdentityVerification
          ? null
          : new Date(now.getTime() + settings.familyMembership.reviewTargets.approvalHours * 60 * 60 * 1000);
        membership.status = requiresIdentityVerification ? 'pending_verification' : 'pending_approval';
        await membership.save({ session });
        if (familyMember) {
          familyMember.status = 'pending_approval';
          familyMember.baseAmount = membership.baseAmount;
          familyMember.gstAmount = membership.gstAmount;
          familyMember.totalPaid = membership.totalPaid;
          familyMember.paymentConfirmedAt = now;
          familyMember.approvalDueAt = membership.approvalDueAt;
          familyMember.approvalOverdueAt = null;
          familyMember.approvalOverdueNotifiedAt = null;
          await familyMember.save({ session });
          await AuditLog.create([{
            actorType: 'member',
            actorId: payment.user,
            action: 'family.membership.payment.confirm',
            entityType: 'family_member',
            entityId: String(familyMember._id),
            summary: 'Family membership payment confirmed and sent for admin approval.',
            before: { status: 'payment_pending' },
            after: {
              status: 'pending_approval',
              baseAmount: familyMember.baseAmount,
              gstAmount: familyMember.gstAmount,
              totalPaid: familyMember.totalPaid,
              approvalDueAt: familyMember.approvalDueAt,
            },
          }], { session });
        }
      }
      payment.status = payment.status === 'paid'
        || options.adminId
        || (options.markPaid === true && env.nodeEnv !== 'production')
        ? 'paid'
        : 'confirmed';
      payment.invoiceNumber = invoiceNumber;
      const settings = await getSettings({ forceRefresh: true });
      payment.invoiceGstin ||= settings.receiptGstin || settings.gstin || '';
      payment.invoiceHsnSac ||= settings.receiptHsnSac || '';
      payment.verifiedAt = payment.verifiedAt || now;
      payment.confirmedAt ||= now;
      if (!payment.receiptNumber) {
        const year = payment.confirmedAt.getUTCFullYear();
        const sequence = await incrementCounter(`receipt-${year}`, session);
        payment.receiptNumber = `OC-R-${year}-${String(sequence).padStart(6, '0')}`;
      }
      if (options.adminId) payment.verifiedBy = options.adminId;
      if (options.razorpayPaymentId) payment.razorpayPaymentId = options.razorpayPaymentId;
      if (options.razorpaySignature) payment.razorpaySignature = options.razorpaySignature;
      if (options.eventId) payment.razorpayEventIds.addToSet(options.eventId);
      await payment.save({ session });
      result = payment;
    });
  } finally {
    await session.endSession();
  }

  return result;
}

export async function approveBankTransfer(paymentId, adminId) {
  const payment = await Payment.findOne({
    _id: paymentId,
    $or: [
      { method: 'bank_transfer', status: 'pending_verification' },
      { method: 'rtgs', status: 'pending' },
    ],
  });
  if (!payment) throw new ApiError(404, 'Pending bank transfer or RTGS payment was not found.');
  return finalizePayment(payment._id, { adminId });
}

export async function rejectBankTransfer(paymentId, adminId, reason) {
  const payment = await Payment.findOneAndUpdate(
    {
      _id: paymentId,
      $or: [
        { method: 'bank_transfer', status: 'pending_verification' },
        { method: 'rtgs', status: 'pending' },
      ],
    },
    { $set: { status: 'rejected', verifiedBy: adminId, verifiedAt: new Date(), rejectionReason: reason } },
    { new: true },
  ).populate('user', 'firstName email');
  if (!payment) throw new ApiError(404, 'Pending bank transfer was not found.');
  try {
    await sendMail({
      to: payment.user.email,
      subject: 'Update on your Orianaa Club bank transfer',
      template: 'payment-rejected',
      data: { firstName: payment.user.firstName, reason },
    });
  } catch {
    console.error('[payment] Bank transfer rejection email could not be sent.');
  }
  return payment;
}

export async function refundPayment(paymentId) {
  if (!await Payment.exists({ _id: paymentId })) throw new ApiError(404, 'Payment was not found.');
  throw new ApiError(409, 'Membership payments are non-refundable.');
}

function addUtcYears(date, years) {
  const result = new Date(date);
  result.setUTCFullYear(result.getUTCFullYear() + years);
  return result;
}

async function createMembershipPayment(userId, membership, plan, method, rtgsDetails) {
  if (!['razorpay', 'bank_transfer', 'cheque', 'rtgs'].includes(method)) {
    throw new ApiError(400, 'The selected membership payment method is not supported.');
  }
  const amount = plan.price;
  if (!Number.isSafeInteger(amount) || amount <= 0 || !Number.isSafeInteger(amount * 100)) {
    throw new ApiError(400, 'The selected plan has an invalid price.');
  }

  const settings = await getSettings();
  const breakdown = getPayableAmount(plan, {
    enabled: settings.gstEnabled,
    rate: settings.gstRate,
    label: settings.gstLabel,
  });
  const rtgsUtr = method === 'rtgs' ? rtgsDetails?.utr?.trim() : '';
  if (method === 'rtgs' && rtgsUtr) {
    if (!/^[a-z\d/-]{6,50}$/i.test(rtgsUtr) || !rtgsDetails.transferDate) {
      throw new ApiError(400, 'A valid RTGS UTR and transfer date are required.');
    }
    if (await Payment.exists({ utr: rtgsUtr })) {
      throw new ApiError(409, 'This RTGS UTR has already been used.');
    }
  }
  let payment;
  try {
    [payment] = await Payment.create([{
    user: userId,
    membership: membership._id,
    plan: plan._id,
    planModel: 'MembershipPlan',
    amount,
    method,
    status: 'pending',
    ...(rtgsUtr ? {
      reference: rtgsUtr,
      utr: rtgsUtr,
      transferDate: rtgsDetails.transferDate,
    } : {}),
    ...breakdown,
    }]);
  } catch (error) {
    if (error.code === 11000 && rtgsUtr) throw new ApiError(409, 'This RTGS UTR has already been used.');
    throw error;
  }
  return {
    membershipId: String(membership._id),
    paymentId: String(payment._id),
    status: membership.status,
    paymentMethod: method,
    amount: payment.totalAmount,
    planFee: payment.baseAmount,
    gst: payment.gstAmount,
    baseAmount: payment.baseAmount,
    gstAmount: payment.gstAmount,
    gstRate: payment.gstRate,
    gstEnabled: payment.gstEnabled,
    gstLabel: payment.gstLabel,
    currency: payment.currency,
  };
}

export async function createMembershipRazorpayOrder(userId, paymentId, { familyMemberId } = {}) {
  await requireCurrentTermsConsent(userId);
  requirePaymentConfiguration();
  const payment = await Payment.findOne({
    _id: paymentId,
    user: userId,
    method: 'razorpay',
    status: { $in: ['pending', 'created'] },
  });
  if (!payment) {
    throw new ApiError(404, 'Pending membership payment was not found.');
  }
  if (familyMemberId && String(payment.familyMember || '') !== String(familyMemberId)) {
    throw new ApiError(404, 'Family payment order was not found.');
  }
  if (!familyMemberId && payment.familyMember) {
    throw new ApiError(409, 'This family payment must be opened from its family checkout.');
  }
  await verifyMembershipPaymentAmount(payment);
  if (payment.razorpayOrderId) {
    return {
      paymentId: String(payment._id),
      orderId: payment.razorpayOrderId,
      keyId: env.razorpayKeyId,
      amount: payment.totalAmount,
      currency: payment.currency,
    };
  }

  const membership = await Membership.findOne({
    _id: payment.membership,
    user: userId,
    status: { $in: ['pending_payment', 'payment_pending'] },
  });
  if (!membership) throw new ApiError(409, 'The membership is not awaiting payment.');
  const PlanModel = payment.planModel === 'MembershipPlan' ? MembershipPlan : Plan;
  const plan = await PlanModel.findById(payment.plan);
  if (!plan) throw new ApiError(404, 'Membership plan was not found.');

  const order = await razorpayClient.orders.create({
    amount: payment.totalAmount,
    currency: payment.currency,
    receipt: `oc-${membership._id}-${randomUUID().slice(0, 8)}`,
  });
  const updated = await Payment.findOneAndUpdate(
    {
      _id: payment._id,
      user: userId,
      method: 'razorpay',
      status: { $in: ['pending', 'created'] },
      razorpayOrderId: '',
    },
    { $set: { status: 'created', razorpayOrderId: order.id } },
    { new: true, runValidators: true },
  );
  if (updated) {
    return {
      paymentId: String(updated._id),
      orderId: updated.razorpayOrderId,
      keyId: env.razorpayKeyId,
      amount: updated.totalAmount,
      currency: updated.currency,
    };
  }

  const winner = await Payment.findOne({ _id: payment._id, user: userId });
  if (winner?.razorpayOrderId && ['created', 'confirmed'].includes(winner.status)) {
    return {
      paymentId: String(winner._id),
      orderId: winner.razorpayOrderId,
      keyId: env.razorpayKeyId,
      amount: winner.totalAmount,
      currency: winner.currency,
    };
  }
  throw new ApiError(409, 'The payment order is being created. Please retry.');
}

export async function listMemberPayments(userId) {
  const payments = await Payment.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(100)
    .select('membership plan planModel amount method status baseAmount gstRate gstEnabled gstLabel gstAmount totalAmount currency razorpayOrderId razorpayPaymentId reference transferDate invoiceNumber receiptNumber confirmedAt createdAt updatedAt verifiedAt refunds note')
    .populate('plan', 'name title slug')
    .lean();
  return payments.map((payment) => ({
    ...payment,
    canDownloadReceipt: ['confirmed', 'paid'].includes(payment.status),
  }));
}

async function createPendingMembership(userId, plan, { companyDetails, previousMembership } = {}) {
  const details = companyDetails || previousMembership?.companyDetails;
  if (plan.requiresCompanyDetails
    && !['companyName', 'gstNumber', 'contactPerson'].every((key) => details?.[key]?.trim())) {
    throw new ApiError(400, 'Company name, GST number, and contact person are required for this plan.');
  }

  try {
    return await Membership.create({
      user: userId,
      customer: userId,
      plan: plan._id,
      planModel: 'MembershipPlan',
      status: 'pending_payment',
      termNumber: previousMembership ? previousMembership.termNumber + 1 : 1,
      previousMembership: previousMembership?._id || null,
      memberNumber: '',
      memberId: '',
      companyDetails: details || undefined,
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw new ApiError(409, 'A membership purchase or renewal is already in progress.');
    }
    throw error;
  }
}

export async function purchaseMembership(userId, {
  planId, paymentMethod, companyDetails, rtgsDetails,
}) {
  await requireCurrentTermsConsent(userId);
  const blockingMembership = await Membership.findOne({
    user: userId,
    status: { $in: ['active', 'pending_payment', 'pending_verification'] },
  }).sort({ createdAt: -1 });
  if (blockingMembership?.status === 'active') {
    throw new ApiError(409, activeMembershipMessage(blockingMembership));
  }
  if (blockingMembership?.status === 'pending_payment') {
    throw new ApiError(409, pendingPaymentMessage);
  }
  if (blockingMembership?.status === 'pending_verification') {
    throw new ApiError(409, pendingVerificationMessage);
  }

  const plan = await MembershipPlan.findOne({ _id: planId, isActive: true });
  if (!plan) throw new ApiError(404, 'Membership plan was not found.');
  if (plan.requiresCompanyDetails
    && !['companyName', 'gstNumber', 'contactPerson'].every((key) => companyDetails?.[key]?.trim())) {
    throw new ApiError(400, 'Company name, GST number, and contact person are required for this plan.');
  }

  const priorMembership = await Membership.exists({
    user: userId,
    memberCode: { $type: 'string', $gt: '' },
  });
  if (priorMembership) {
    throw new ApiError(409, 'An existing member must use the renewal option.');
  }
  const existing = await Membership.findOne({
    user: userId,
    status: { $in: ['draft', 'pending_payment', 'pending_verification', 'active'] },
  }).sort({ createdAt: -1 });
  if (existing?.status === 'pending_payment') {
    throw new ApiError(409, pendingPaymentMessage);
  }
  if (existing?.status === 'pending_verification') {
    throw new ApiError(409, pendingVerificationMessage);
  }
  if (existing?.status === 'active') {
    throw new ApiError(409, activeMembershipMessage(existing));
  }
  if (existing?.status === 'draft') {
    if (String(existing.plan) !== String(plan._id)) {
      throw new ApiError(409, 'The selected plan does not match your saved membership application.');
    }
    const transition = await Membership.updateOne(
      { _id: existing._id, status: 'draft', plan: plan._id },
      { $set: { status: 'pending_payment', companyDetails: companyDetails || existing.companyDetails } },
    );
    if (transition.modifiedCount !== 1) {
      throw new ApiError(409, 'Your membership application has changed. Please refresh and try again.');
    }
    return createMembershipPayment(userId, existing, plan, paymentMethod, rtgsDetails);
  }

  const membership = await createPendingMembership(userId, plan, { companyDetails });
  return createMembershipPayment(userId, membership, plan, paymentMethod, rtgsDetails);
}

export async function renewMembership(userId, { planId, paymentMethod, companyDetails }) {
  const current = await Membership.findOne({
    user: userId,
    status: { $in: ['active', 'expired'] },
  }).sort({ termNumber: -1, createdAt: -1 });
  if (!current) throw new ApiError(404, 'An existing membership was not found for renewal.');

  const now = new Date();
  if (current.pointsBalance > 0 && (!current.pointsExpireAt || current.pointsExpireAt > now)) {
    throw new ApiError(409, activeMembershipBlockedMessage);
  }
  const existingRenewal = await Membership.findOne({
    user: userId,
    status: { $in: ['draft', 'pending_payment', 'pending_verification'] },
  });
  if (existingRenewal?.status === 'pending_payment') {
    throw new ApiError(409, pendingPaymentMessage);
  }
  if (existingRenewal?.status === 'pending_verification') {
    throw new ApiError(409, pendingVerificationMessage);
  }
  if (existingRenewal) throw new ApiError(409, 'A membership renewal is already in progress.');

  const [plan, currentPlan] = await Promise.all([
    MembershipPlan.findOne({ _id: planId, isActive: true }),
    current.populate('plan'),
  ]);
  if (!plan) throw new ApiError(404, 'Membership plan was not found.');
  const previousSortOrder = Number(currentPlan.plan?.sortOrder || 0);
  if (previousSortOrder > 0 && plan.sortOrder < previousSortOrder) {
    throw new ApiError(400, 'A renewal or upgrade must use the same or a higher membership tier.');
  }

  const membership = await createPendingMembership(userId, plan, {
    companyDetails,
    previousMembership: current,
  });
  return createMembershipPayment(userId, membership, plan, paymentMethod);
}

async function activateMembershipInTransaction(
  session,
  membership,
  plan,
  settings,
  fromStatus = 'pending_payment',
) {
  const now = new Date();
  let memberNumber = '';
  let memberCode;
  let earlyBirdApplied = false;
  let pointsGranted;
  let previous;

  if (membership.previousMembership) {
    previous = await Membership.findById(membership.previousMembership).session(session);
    if (!previous) throw new ApiError(409, 'The previous membership for this renewal was not found.');
    if (previous.pointsBalance > 0 && (!previous.pointsExpireAt || previous.pointsExpireAt > now)) {
      throw new ApiError(409, 'Renewal cannot be activated while unexpired points remain.');
    }
    memberNumber = String(await getNextMemberNumber(session));
    pointsGranted = plan.renewalPoints;
    if (previous.status === 'active') {
      const expiredPrevious = await Membership.updateOne(
        {
          _id: previous._id,
          status: 'active',
          $or: [{ pointsBalance: 0 }, { pointsExpireAt: { $lte: now } }],
        },
        { $set: { status: 'expired' } },
        { session },
      );
      if (expiredPrevious.modifiedCount !== 1) {
        throw new ApiError(409, 'The previous membership is not eligible for renewal.');
      }
      previous.status = 'expired';
    }
  } else {
    const sequence = await getNextMemberNumber(session);
    memberNumber = String(sequence);
    earlyBirdApplied = sequence <= settings.earlyBirdLimit;
    pointsGranted = earlyBirdApplied ? plan.earlyBirdPoints : plan.defaultPoints;
  }

  const pointsExpireAt = addUtcYears(now, settings.pointsValidityYears);
  const membershipExpireAt = addUtcYears(now, settings.membershipValidityYears);
  memberCode = await allocateMemberId({
    activatedAt: now,
    expiresAt: membershipExpireAt,
    session,
  });
  const activation = await Membership.updateOne(
    { _id: membership._id, status: fromStatus },
    {
      $set: {
        status: 'active',
        activatedAt: now,
        pointsGranted,
        pointsBalance: pointsGranted,
        pointsExpireAt,
        membershipExpireAt,
        earlyBirdApplied,
        memberNumber,
        memberCode,
        memberNo: memberCode,
        memberId: memberCode,
        startDate: now,
        endDate: membershipExpireAt,
      },
    },
    { session, runValidators: true },
  );
  if (activation.modifiedCount !== 1) {
    throw new ApiError(409, 'Membership activation was already completed or is no longer available.');
  }

  if (pointsGranted > 0) {
    await PointLedger.create([{
      membership: membership._id,
      type: membership.previousMembership ? 'credit_renewal' : 'credit_joining',
      amount: pointsGranted,
      direction: '+',
      balanceAfter: pointsGranted,
      note: membership.previousMembership ? 'Membership renewal points' : 'Membership joining points',
      createdBy: 'system',
      idempotencyKey: `membership-activation:${membership._id}`,
    }], { session });
  }

  if (!membership.previousMembership) {
    const existingPrimary = await FamilyMember.findOne({
      membership: membership._id,
      isPrimary: true,
    }).session(session);
    if (!existingPrimary) {
      const [profile, user] = await Promise.all([
        Profile.findOne({ user: membership.user }).session(session).lean(),
        User.findById(membership.user).session(session).select('firstName').lean(),
      ]);
      const primaryName = profile?.fullName || user?.firstName || 'Member';
      const [primaryFamilyMember] = await FamilyMember.create([{
        membership: membership._id,
        name: primaryName,
        fullName: primaryName,
        relation: 'Self',
        relationship: 'Self',
        dateOfBirth: profile?.dob || null,
        dob: profile?.dob || null,
        type: 'adult',
        phone: profile?.mobile || '',
        photoUrl: profile?.photoUrl || '',
        isPrimary: true,
        memberNo: memberCode,
        memberId: memberCode,
        addedBy: 'system',
        status: 'active',
      }], { session });
      await AuditLog.create([{
        actorType: 'system',
        action: 'family.primary.create',
        entityType: 'family_member',
        entityId: String(primaryFamilyMember._id),
        summary: 'Created primary family member during membership activation.',
        after: {
          membership: String(membership._id),
          name: primaryName,
          isPrimary: true,
        },
      }], { session });
    } else {
      existingPrimary.memberNo = memberCode;
      existingPrimary.memberId = memberCode;
      await existingPrimary.save({ session });
    }
  }

  return Membership.findById(membership._id).session(session);
}

export async function activateMembership(membershipId, paymentId, options = {}) {
  const payment = await Payment.findOne({ _id: paymentId, membership: membershipId }).select('_id');
  if (!payment) throw new ApiError(404, 'Payment was not found.');
  const paymentResult = await finalizePayment(payment._id, options);
  const membershipResult = await Membership.findById(membershipId);
  if (!membershipResult) throw new ApiError(404, 'Membership was not found for this payment.');
  return {
    payment: paymentResult,
    membership: membershipResult,
    status: membershipResult.status,
  };
}

async function settleMembershipPayment(paymentId, options = {}) {
  const payment = await Payment.findById(paymentId).select('membership');
  if (!payment) throw new ApiError(404, 'Payment was not found.');
  return activateMembership(payment.membership, paymentId, options);
}

export async function verifyMembershipRazorpayPayment(userId, {
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
}) {
  requirePaymentConfiguration();
  const payment = await Payment.findOne({
    razorpayOrderId: razorpay_order_id,
    user: userId,
    method: 'razorpay',
  });
  if (!payment) throw new ApiError(404, 'Payment order was not found.');
  if (!signaturesMatch(paymentSignature(razorpay_order_id, razorpay_payment_id), razorpay_signature)) {
    throw new ApiError(400, 'The payment verification failed. Please try again.');
  }
  await verifyMembershipPaymentAmount(payment);
  if (payment.status === 'confirmed' && payment.razorpayPaymentId !== razorpay_payment_id) {
    throw new ApiError(409, 'This payment order has already been used.');
  }
  if (payment.status !== 'confirmed') {
    const providerPayment = await razorpayClient.payments.fetch(razorpay_payment_id);
    if (
      providerPayment.order_id !== razorpay_order_id
      || providerPayment.amount !== payment.totalAmount
      || providerPayment.currency !== payment.currency
    ) {
      throw new ApiError(400, 'The verified payment does not match this membership order.');
    }
    if (providerPayment.status !== 'captured') {
      throw new ApiError(409, 'The Razorpay payment has not been captured yet.');
    }
  }

  const result = await settleMembershipPayment(payment._id, {
    razorpayPaymentId: razorpay_payment_id,
    razorpaySignature: razorpay_signature,
  });
  return {
    status: result.status,
    membershipId: String(result.membership?._id || payment.membership),
  };
}

export async function processMembershipRazorpayWebhook(rawBody, signature, eventId) {
  if (!env.razorpayWebhookSecret || !webhookSignatureMatches(rawBody, signature)) {
    throw new ApiError(400, 'Invalid payment webhook signature.');
  }
  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    throw new ApiError(400, 'Invalid payment webhook payload.');
  }

  const paymentEntity = event.payload?.payment?.entity;
  const orderId = paymentEntity?.order_id || event.payload?.order?.entity?.id;
  if (!orderId) return { received: true, processed: false };
  const payment = await Payment.findOne({ razorpayOrderId: orderId, method: 'razorpay' });
  if (!payment) return { received: true, processed: false };
  if (event.event === 'payment.failed') {
    await Payment.updateOne(
      { _id: payment._id, status: 'created' },
      { $set: { status: 'failed' } },
    );
    await Membership.updateOne(
      { _id: payment.membership, status: 'pending_payment' },
      { $set: { status: 'cancelled' } },
    );
    return { received: true, processed: true };
  }
  if (!['payment.captured', 'order.paid'].includes(event.event) || !paymentEntity?.id) {
    return { received: true, processed: false };
  }
  await verifyMembershipPaymentAmount(payment, paymentEntity.amount);
  if (
    paymentEntity.order_id !== payment.razorpayOrderId
    || paymentEntity.amount !== payment.totalAmount
    || paymentEntity.currency !== payment.currency
    || paymentEntity.status !== 'captured'
  ) {
    throw new ApiError(400, 'The Razorpay webhook payment does not match the membership order.');
  }

  const identifier = eventId || `${event.event}:${paymentEntity.id}`;
  const result = await settleMembershipPayment(payment._id, {
    razorpayPaymentId: paymentEntity.id,
    eventId: identifier,
  });
  return { received: true, processed: Boolean(result.payment) };
}

export async function recordOfflineMembershipPayment(adminId, {
  membershipId, method, amount, reference, paymentDate, note,
}) {
  if (!['bank_transfer', 'cheque', 'rtgs'].includes(method)) {
    throw new ApiError(400, 'New offline payments must use bank transfer, cheque, or RTGS.');
  }
  if (!reference?.trim()) {
    throw new ApiError(400, 'A bank reference or cheque number is required.');
  }
  if (method === 'rtgs' && (!/^[a-z\d/-]{6,50}$/i.test(reference.trim()) || !paymentDate)) {
    throw new ApiError(400, 'A valid RTGS UTR and transfer date are required.');
  }
  if (method === 'rtgs' && await Payment.exists({ utr: reference.trim() })) {
    const existingPayment = await Payment.findOne({
      membership: membershipId,
      method: 'rtgs',
      utr: reference.trim(),
      status: 'pending',
    }).select('_id');
    if (!existingPayment) throw new ApiError(409, 'This RTGS UTR has already been used.');
  }
  const membership = await Membership.findOne({
    _id: membershipId,
    status: { $in: ['pending_payment', 'payment_pending'] },
  });
  if (!membership) throw new ApiError(404, 'Pending membership was not found.');
  const plan = await MembershipPlan.findById(membership.plan);
  if (!plan) throw new ApiError(404, 'Membership plan was not found.');
  const existing = await Payment.findOne({ membership: membership._id, status: 'pending' })
    .sort({ createdAt: -1 });
  const settings = await getSettings();
  const breakdown = existing ? {
    baseAmount: existing.baseAmount,
    gstRate: existing.gstRate,
    gstEnabled: existing.gstEnabled ?? existing.gstAmount > 0,
    gstLabel: existing.gstLabel || settings.gstLabel,
    gstAmount: existing.gstAmount,
    totalAmount: existing.totalAmount,
    currency: existing.currency || 'INR',
  } : getPayableAmount(plan, {
    enabled: settings.gstEnabled,
    rate: settings.gstRate,
    label: settings.gstLabel,
  });
  if (amount !== undefined) {
    let amountInPaise;
    try {
      amountInPaise = rupeesToPaise(amount);
    } catch {
      throw new ApiError(400, 'The recorded payment amount is invalid.');
    }
    if (amountInPaise !== breakdown.totalAmount) {
      throw new ApiError(400, 'Recorded payment amount must match the GST-inclusive total.');
    }
  }
  const paymentFields = {
    user: membership.user,
    membership: membership._id,
    plan: plan._id,
    planModel: 'MembershipPlan',
    amount: paiseToRupees(breakdown.baseAmount),
    method,
    status: 'pending',
    ...breakdown,
    reference: reference.trim(),
    ...(method === 'rtgs' ? { utr: reference.trim() } : {}),
    transferDate: paymentDate || new Date(),
    recordedBy: adminId,
    note: note || '',
  };
  let payment;
  try {
    payment = existing
      ? await Payment.findOneAndUpdate(
      { _id: existing._id, status: 'pending' },
      { $set: paymentFields },
      { new: true, runValidators: true },
      )
      : null;
  } catch (error) {
    if (error.code === 11000 && method === 'rtgs') throw new ApiError(409, 'This RTGS UTR has already been used.');
    throw error;
  }
  if (existing && !payment) {
    throw new ApiError(409, 'The pending payment changed before it could be recorded.');
  }
  if (!payment) {
    try {
      payment = await Payment.create(paymentFields);
    } catch (error) {
      if (error.code === 11000 && method === 'rtgs') throw new ApiError(409, 'This RTGS UTR has already been used.');
      throw error;
    }
  }
  return payment;
}

export async function confirmOfflineMembershipPayment(paymentId, adminId) {
  const payment = await Payment.findOne({
    _id: paymentId,
    method: { $in: ['bank_transfer', 'cheque', 'rtgs', 'cash', 'manual', 'netbanking'] },
    status: 'pending',
  });
  if (!payment) throw new ApiError(404, 'Pending offline payment was not found.');
  const result = await settleMembershipPayment(payment._id, { adminId });
  return { payment: result.payment, membership: result.membership, status: result.status };
}

export async function approveMembershipVerification(membershipId, adminId) {
  const payment = await Payment.findOne({
    membership: membershipId,
    status: { $in: ['confirmed', 'paid'] },
  }).sort({ createdAt: -1 });
  if (!payment) throw new ApiError(409, 'A confirmed membership payment is required.');
  const result = await activateMembership(membershipId, payment._id, {
    approveVerification: true,
    adminId,
  });
  return result.membership;
}

export async function uploadMembershipVerificationDocument(userId, document) {
  const membership = await Membership.findOne({
    user: userId,
    status: 'pending_verification',
  }).sort({ createdAt: -1 });
  if (!membership) throw new ApiError(404, 'Membership awaiting verification was not found.');
  const plan = await MembershipPlan.findById(membership.plan);
  if (!plan?.requiresVerification) {
    throw new ApiError(409, 'This membership does not require eligibility verification.');
  }
  membership.verificationDocs.push({ ...document, uploadedAt: new Date() });
  await membership.save();
  return membership;
}

export async function getMembershipVerificationDocument(membershipId, documentId) {
  const membership = await Membership.findById(membershipId).select('verificationDocs');
  if (!membership) throw new ApiError(404, 'Membership was not found.');
  const document = membership.verificationDocs.find((item) => item.id === documentId);
  if (!document || !document.storageKey) {
    throw new ApiError(404, 'Verification document was not found.');
  }
  return document;
}

export async function deactivateMembership(membershipId, reason) {
  const membership = await Membership.findOneAndUpdate(
    { _id: membershipId, status: 'active' },
    { $set: { status: 'cancelled', deactivationReason: reason } },
    { new: true, runValidators: true },
  );
  if (!membership) throw new ApiError(404, 'Active membership was not found.');
  return membership;
}
