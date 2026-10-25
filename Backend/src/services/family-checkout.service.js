import mongoose from 'mongoose';
import FamilyMember from '../models/FamilyMember.js';
import Membership from '../models/Membership.js';
import Payment from '../models/Payment.js';
import { getSettings } from '../models/Setting.js';
import ApiError from '../utils/ApiError.js';
import { rupeesToPaise } from '../utils/money.js';
import { calculateMemberPrice } from './pricing.service.js';
import { requireCurrentTermsConsent } from './terms.service.js';
import {
  createMembershipRazorpayOrder,
  verifyRazorpayPayment,
} from './payment.service.js';

function familyMemberType(member) {
  const relation = String(member.relation || member.relationship || '').trim().toLowerCase();
  if (['spouse', 'wife', 'husband'].includes(relation)) return 'spouse';
  if (['son', 'daughter', 'child'].includes(relation) || member.type === 'child') return 'child';
  if (relation === 'father') return 'father';
  if (relation === 'mother') return 'mother';
  if (['spouse', 'child', 'father', 'mother'].includes(member.memberType)) return member.memberType;
  throw new ApiError(400, 'This profile is not eligible for family membership checkout.');
}

function quoteFromPayment(payment) {
  return {
    baseAmount: Math.round(payment.baseAmount / 100),
    gstAmount: Math.round(payment.gstAmount / 100),
    totalPayable: Math.round(payment.totalAmount / 100),
    discountPct: payment.discountPct || 0,
  };
}

async function getCheckoutContext(userId, familyMemberId, purchaseDate, session) {
  let familyQuery = FamilyMember.findOne({ _id: familyMemberId, status: { $ne: 'removed' } });
  if (session) familyQuery = familyQuery.session(session);
  const familyMember = await familyQuery;
  if (!familyMember || familyMember.isPrimary || familyMember.isNominee) {
    throw new ApiError(404, 'An eligible family profile was not found.');
  }
  if (familyMember.pendingAction && familyMember.pendingAction !== '') {
    throw new ApiError(409, 'This family profile has a pending change and cannot be purchased yet.');
  }
  if (!['active', 'payment_pending'].includes(familyMember.status)) {
    throw new ApiError(409, 'This family profile is not available for payment.');
  }

  let primaryQuery = Membership.findOne({
    _id: familyMember.membership,
    user: userId,
    status: 'active',
    memberType: 'primary',
    linkedTo: null,
  }).populate('plan');
  if (session) primaryQuery = primaryQuery.session(session);
  const primary = await primaryQuery;
  if (!primary || !primary.plan) throw new ApiError(404, 'The active primary membership was not found.');

  const settings = await getSettings({ forceRefresh: true });
  const memberType = familyMemberType(familyMember);
  const quote = await calculateMemberPrice({
    plan: primary.plan,
    member: familyMember,
    memberType,
    parentSide: familyMember.parentSide,
    dob: familyMember.dob || familyMember.dateOfBirth,
    purchaseDate,
    linkedPrimary: primary,
    session,
    settings,
  });
  return { familyMember, primary, settings, memberType, quote };
}

function quoteMatchesPayment(quote, payment) {
  return rupeesToPaise(quote.baseAmount) === payment.baseAmount
    && rupeesToPaise(quote.gstAmount) === payment.gstAmount
    && rupeesToPaise(quote.totalPayable) === payment.totalAmount;
}

export async function getFamilyCheckoutQuote(userId, familyMemberId, now = new Date()) {
  const context = await getCheckoutContext(userId, familyMemberId, now);
  const existingMembership = await Membership.findOne({ familyMember: context.familyMember._id }).lean();
  if (existingMembership) {
    if (existingMembership.status === 'pending_approval' || existingMembership.status === 'active') {
      throw new ApiError(409, 'This family membership has already been paid or activated.');
    }
    const payment = await Payment.findOne({
      membership: existingMembership._id,
      familyMember: context.familyMember._id,
      method: 'razorpay',
      status: { $in: ['pending', 'created'] },
    }).lean();
    if (payment) {
      if (!quoteMatchesPayment(context.quote, payment)) {
        throw new ApiError(409, 'The family membership price changed. Please contact the club before paying.');
      }
      return {
        familyMemberId: String(context.familyMember._id),
        name: context.familyMember.name || context.familyMember.fullName || '',
        ...context.quote,
      };
    }
  }
  return {
    familyMemberId: String(context.familyMember._id),
    name: context.familyMember.name || context.familyMember.fullName || '',
    ...context.quote,
  };
}

export async function startFamilyCheckout(userId, familyMemberId, now = new Date()) {
  await requireCurrentTermsConsent(userId);
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const context = await getCheckoutContext(userId, familyMemberId, now, session);
      const { familyMember, primary, settings, memberType, quote } = context;
      let linkedMembership = await Membership.findOne({ familyMember: familyMember._id }).session(session);

      if (linkedMembership && ['pending_approval', 'active'].includes(linkedMembership.status)) {
        throw new ApiError(409, 'This family membership has already been paid or activated.');
      }
      if (linkedMembership && !['payment_pending', 'pending_payment'].includes(linkedMembership.status)) {
        throw new ApiError(409, 'This family checkout is no longer available.');
      }

      if (linkedMembership) {
        const existingPayment = await Payment.findOne({
          membership: linkedMembership._id,
          familyMember: familyMember._id,
          discountPct: quote.discountPct,
          method: 'razorpay',
          status: { $in: ['pending', 'created'] },
        }).session(session);
        if (existingPayment) {
          if (!quoteMatchesPayment(quote, existingPayment)) {
            throw new ApiError(409, 'The family membership price changed. Please contact the club before paying.');
          }
          result = {
            paymentId: String(existingPayment._id),
            ...quoteFromPayment(existingPayment),
          };
          return;
        }
      } else {
        [linkedMembership] = await Membership.create([{
          user: userId,
          customer: userId,
          plan: primary.plan._id,
          planModel: primary.planModel,
          status: 'payment_pending',
          memberType,
          linkedTo: primary._id,
          familyMember: familyMember._id,
          parentSide: familyMember.parentSide || null,
          tier: primary.tier || primary.plan.slug || primary.plan.id || primary.plan.name || '',
          discountPct: quote.discountPct,
          dob: familyMember.dob || familyMember.dateOfBirth || null,
          gender: familyMember.gender || '',
          photo: familyMember.photo || familyMember.photoUrl || '',
          email: familyMember.email || '',
          phone: familyMember.phone || '',
          termNumber: 1,
          memberNo: '',
          memberNumber: '',
        }], { session });
      }

      const gstRate = settings.familyMembership.gstPct;
      const baseAmount = rupeesToPaise(quote.baseAmount);
      const gstAmount = rupeesToPaise(quote.gstAmount);
      const totalAmount = rupeesToPaise(quote.totalPayable);
      const [payment] = await Payment.create([{
        user: userId,
        membership: linkedMembership._id,
        familyMember: familyMember._id,
        discountPct: quote.discountPct,
        plan: primary.plan._id,
        planModel: primary.planModel,
        amount: quote.baseAmount,
        method: 'razorpay',
        status: 'pending',
        baseAmount,
        gstRate,
        gstEnabled: true,
        gstLabel: 'GST',
        gstAmount,
        totalAmount,
        currency: 'INR',
        note: `Family membership for ${familyMember.name || familyMember.fullName || 'family member'}`,
      }], { session });

      linkedMembership.status = 'payment_pending';
      linkedMembership.discountPct = quote.discountPct;
      await linkedMembership.save({ session });
      familyMember.status = 'payment_pending';
      familyMember.discountPct = quote.discountPct;
      familyMember.tier = linkedMembership.tier;
      await familyMember.save({ session });
      result = { paymentId: String(payment._id), ...quote };
    });
  } catch (error) {
    if (error?.code === 11000) {
      const existingMembership = await Membership.findOne({ familyMember: familyMemberId }).lean();
      const existingPayment = existingMembership && await Payment.findOne({
        membership: existingMembership._id,
        familyMember: familyMemberId,
        method: 'razorpay',
        status: { $in: ['pending', 'created'] },
      }).lean();
      if (existingPayment) return { paymentId: String(existingPayment._id), ...quoteFromPayment(existingPayment) };
    }
    throw error;
  } finally {
    await session.endSession();
  }
  return result;
}

async function familyPayment(userId, familyMemberId) {
  const { familyMember, primary, quote } = await getCheckoutContext(userId, familyMemberId, new Date());
  const linkedMembership = await Membership.findOne({
    familyMember: familyMember._id,
    user: userId,
    linkedTo: primary._id,
    status: 'payment_pending',
  }).lean();
  if (!linkedMembership) throw new ApiError(409, 'This family member is not awaiting payment.');
  const payment = await Payment.findOne({
    membership: linkedMembership._id,
    familyMember: familyMember._id,
    user: userId,
    method: 'razorpay',
    status: { $in: ['pending', 'created'] },
  }).sort({ createdAt: -1 });
  if (!payment) throw new ApiError(404, 'A pending family payment was not found.');
  if (!quoteMatchesPayment(quote, payment)) {
    throw new ApiError(409, 'The family membership price changed. Please contact the club before paying.');
  }
  return { familyMember, primary, linkedMembership, payment };
}

export async function createFamilyRazorpayOrder(userId, familyMemberId) {
  const { payment } = await familyPayment(userId, familyMemberId);
  return createMembershipRazorpayOrder(userId, payment._id, { familyMemberId });
}

export async function verifyFamilyRazorpayPayment(userId, familyMemberId, details) {
  const existingPayment = await Payment.findOne({
    razorpayOrderId: details.razorpay_order_id,
    familyMember: familyMemberId,
    user: userId,
    method: { $in: ['upi', 'card', 'razorpay'] },
  }).lean();
  if (!existingPayment) throw new ApiError(404, 'Family payment order was not found.');
  const linkedMembership = await Membership.findOne({
    _id: existingPayment.membership,
    familyMember: familyMemberId,
    user: userId,
  }).lean();
  if (!linkedMembership) throw new ApiError(404, 'Family payment order was not found.');
  if (existingPayment.status === 'paid' || existingPayment.status === 'confirmed') {
    return { status: existingPayment.status, familyMemberId: String(familyMemberId) };
  }
  return verifyRazorpayPayment(userId, details, { familyMemberId });
}
