import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/app.js';
import FamilyMember from '../src/models/FamilyMember.js';
import Membership from '../src/models/Membership.js';
import Payment from '../src/models/Payment.js';
import TermsConsent from '../src/models/TermsConsent.js';
import Verification from '../src/models/Verification.js';
import { currentTermsVersion } from '../src/config/terms.js';
import { finalizePayment } from '../src/services/payment.service.js';
import PointsLedger from '../src/models/PointsLedger.js';
import {
  getFamilyCheckoutQuote,
  startFamilyCheckout,
} from '../src/services/family-checkout.service.js';
import { createMember, createPlan } from './helpers/factories.js';

async function createTerms(userId) {
  await TermsConsent.create({
    application_id: userId,
    user_id: userId,
    terms_version: currentTermsVersion,
    language: 'en',
    document_sha256: 'a'.repeat(64),
    accepted_at: new Date(),
    ip_address: '127.0.0.1',
    user_agent: 'family-checkout-tests',
    read_to_end: true,
    scroll_completed_at: new Date(),
  });
}

async function createVerifiedFamily({ primary, relation = 'wife', status = 'verified', dob } = {}) {
  const familyMember = await FamilyMember.create({
    membership: primary.membership._id,
    name: 'Family Person',
    relation,
    relationship: relation,
    gender: relation === 'wife' ? 'female' : 'male',
    type: relation === 'son' ? 'child' : 'adult',
    memberType: relation === 'wife' ? 'spouse' : relation === 'son' ? 'child' : relation,
    dateOfBirth: dob || null,
    dob: dob || null,
    status: 'active',
    parentSide: relation === 'father' || relation === 'mother' ? 'member' : null,
  });
  await Verification.create({
    memberId: familyMember._id,
    status,
    relation: relation === 'son' ? 'child' : relation,
  });
  return familyMember;
}

async function createActivePrimary(plan) {
  return createMember({
    membership: {
      plan: plan._id,
      planModel: 'Plan',
      status: 'active',
      memberType: 'primary',
      linkedTo: null,
      tier: 'founder-legacy',
      baseAmount: 300000,
      gstAmount: 54000,
      totalPaid: 354000,
      paymentConfirmedAt: new Date(),
    },
  });
}

describe('family membership checkout', () => {
  test('rejects a family profile that belongs to a different primary member', async () => {
    const plan = await createPlan({ slug: 'founder-legacy', id: 'founder-legacy', name: 'Founder Legacy' });
    const [owner, other] = await Promise.all([createActivePrimary(plan), createActivePrimary(plan)]);
    const familyMember = await createVerifiedFamily({ primary: other });

    await expect(getFamilyCheckoutQuote(owner.user._id, familyMember._id))
      .rejects.toThrow('active primary membership was not found');
  });

  test('rejects a family profile until its verification is approved', async () => {
    const plan = await createPlan({ slug: 'founder-legacy', id: 'founder-legacy', name: 'Founder Legacy' });
    const primary = await createActivePrimary(plan);
    const familyMember = await createVerifiedFamily({ primary, status: 'pending' });

    await expect(getFamilyCheckoutQuote(primary.user._id, familyMember._id))
      .rejects.toThrow('must be approved');
  });

  test('uses server pricing, is idempotent, and never charges the primary membership', async () => {
    const plan = await createPlan({ slug: 'founder-legacy', id: 'founder-legacy', name: 'Founder Legacy' });
    const primary = await createActivePrimary(plan);
    const familyMember = await createVerifiedFamily({ primary });
    await createTerms(primary.user._id);

    const response = await request(app)
      .post(`/api/member/family/${familyMember._id}/checkout`)
      .set('Cookie', primary.cookie)
      .send({ baseAmount: 1, gstAmount: 0, totalPayable: 1 });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      baseAmount: 150000,
      gstAmount: 27000,
      totalPayable: 177000,
      discountPct: 50,
    });
    const firstPaymentId = response.body.data.paymentId;
    const second = await startFamilyCheckout(primary.user._id, familyMember._id);
    expect(second.paymentId).toBe(firstPaymentId);

    const payment = await Payment.findById(firstPaymentId);
    const familyMembership = await Membership.findOne({ familyMember: familyMember._id });
    const unchangedPrimary = await Membership.findById(primary.membership._id);
    const updatedProfile = await FamilyMember.findById(familyMember._id);
    expect(payment).toMatchObject({
      membership: familyMembership._id,
      familyMember: familyMember._id,
      baseAmount: 15000000,
      gstAmount: 2700000,
      totalAmount: 17700000,
    });
    expect(familyMembership).toMatchObject({
      memberType: 'spouse',
      linkedTo: primary.membership._id,
      familyMember: familyMember._id,
      status: 'payment_pending',
    });
    expect(unchangedPrimary).toMatchObject({
      status: 'active',
      baseAmount: 300000,
      gstAmount: 54000,
      totalPaid: 354000,
    });
    expect(updatedProfile.status).toBe('payment_pending');
  });

  test('confirms the family payment to approval without changing the primary or crediting points', async () => {
    const plan = await createPlan({ slug: 'founder-legacy', id: 'founder-legacy', name: 'Founder Legacy' });
    const primary = await createActivePrimary(plan);
    const familyMember = await createVerifiedFamily({ primary });
    await createTerms(primary.user._id);
    const checkout = await startFamilyCheckout(primary.user._id, familyMember._id);
    const payment = await Payment.findById(checkout.paymentId);

    await finalizePayment(payment._id, {
      razorpayPaymentId: 'razorpay-family-payment',
      markPaid: true,
    });

    const confirmedFamilyMember = await FamilyMember.findById(familyMember._id);
    const familyMembership = await Membership.findOne({ familyMember: familyMember._id });
    const unchangedPrimary = await Membership.findById(primary.membership._id);
    expect(confirmedFamilyMember).toMatchObject({
      status: 'pending_approval',
      baseAmount: 150000,
      gstAmount: 27000,
      totalPaid: 177000,
    });
    expect(confirmedFamilyMember.approvalDueAt.getTime() - confirmedFamilyMember.paymentConfirmedAt.getTime())
      .toBe(24 * 60 * 60 * 1000);
    expect(familyMembership).toMatchObject({
      status: 'pending_approval',
      paymentConfirmedAt: expect.any(Date),
      approvalSeq: null,
      baseAmount: 150000,
      gstAmount: 27000,
      totalPaid: 177000,
    });
    expect(unchangedPrimary).toMatchObject({ status: 'active', totalPaid: 354000 });
    expect(await PointsLedger.countDocuments({ memberId: familyMembership._id })).toBe(0);
  });
});
