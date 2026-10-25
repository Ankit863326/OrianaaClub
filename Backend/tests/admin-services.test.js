import { createMember, createPlan } from './helpers/factories.js';
import * as adminService from '../src/services/admin.service.js';
import { setAdminStatus } from '../src/services/content-admin.service.js';
import AuditLog from '../src/models/AuditLog.js';
import Membership from '../src/models/Membership.js';
import Payment from '../src/models/Payment.js';
import PointsTransaction from '../src/models/PointsTransaction.js';
import PointsLedger from '../src/models/PointsLedger.js';
import User from '../src/models/User.js';
import FamilyMember from '../src/models/FamilyMember.js';
import IdentityVerification from '../src/models/IdentityVerification.js';
import { getSettings } from '../src/models/Setting.js';
import { reviewIdentityVerification } from '../src/services/identity-verification.service.js';
import { approveMembership } from '../src/services/membership-approval.service.js';
import { getPayableAmount } from '../src/utils/money.js';
import { getMemberOverview } from '../src/services/member.service.js';

// Admin service tests use only seeded fake users and the disposable test database.
describe('admin member services', () => {
  test('filters members by text, status, and plan and paginates in requested sort order', async () => {
    const plan = await createPlan({ slug: 'filter-plan' });
    const alpha = await createMember({
      firstName: 'Alpha', email: 'alpha@example.invalid',
      membership: { plan: plan._id, status: 'active' },
    });
    await Membership.collection.updateOne({ _id: alpha.membership._id }, { $unset: { memberType: '' } });
    await createMember({ firstName: 'Beta', email: 'beta@example.invalid', status: 'suspended' });
    const filtered = await adminService.listMembers({
      search: 'Alpha', status: 'active', plan: 'filter-plan', limit: '1',
    });
    expect(filtered).toMatchObject({ total: 1, page: 1, limit: 1 });
    expect(filtered.items[0]._id.toString()).toBe(alpha.user._id.toString());
    expect(filtered.items[0].membership.memberType).toBe('primary');
    const sorted = await adminService.listMembers({ sort: 'name', order: 'asc', page: '1', limit: '1' });
    expect(sorted.items[0].firstName).toBe('Alpha');
  });

  test('updates profiles and status, soft-deletes members, and hides deleted records', async () => {
    const member = await createMember();
    const updated = await adminService.updateMemberProfile(member.user._id, {
      firstName: 'Changed', fullName: 'Changed Member',
    });
    expect(updated.user.firstName).toBe('Changed');
    expect(updated.profile.fullName).toBe('Changed Member');
    expect((await adminService.changeMemberStatus(member.user._id, 'suspended')).status).toBe('suspended');
    await adminService.softDeleteMember(member.user._id);
    expect((await adminService.listMembers({})).total).toBe(0);
    await expect(adminService.getMemberDetails(member.user._id)).rejects.toMatchObject({ statusCode: 404 });
  });

  test('creates an admin-entered member and records dashboard totals', async () => {
    const plan = await createPlan({
      slug: 'manual-plan',
      pointsTiers: [{ label: 'Standard', points: 10, fromMember: 1, toMember: null }],
    });
    const admin = await createMember({ role: 'admin' });
    const created = await adminService.createMember({
      user: { firstName: 'Manual', email: 'manual@example.invalid' },
      profile: {
        fullName: 'Manual Member', gender: 'other', countryCode: '+91', mobile: '9000000001',
        dob: new Date('1990-01-01'), interestArea: 'Travel',
      },
      planSlug: plan.slug,
    }, admin.user._id);
    expect(created.user.status).toBe('pending');
    expect(created.membership.plan.toString()).toBe(plan._id.toString());
    await Payment.create({
      user: created.user._id, membership: created.membership._id, plan: plan._id,
      method: 'manual', status: 'paid', baseAmount: 10000, gstAmount: 1800, totalAmount: 11800,
    });
    await PointsTransaction.create({
      user: created.user._id, membership: created.membership._id, type: 'credit',
      amount: 10, category: 'adjustment', reason: 'Seed', balanceAfter: 10,
    });
    const summary = await adminService.dashboardSummary();
    expect(summary.members.byStatus.pending).toBe(1);
    expect(summary.revenue).toMatchObject({ totalAmount: 11800, paidPayments: 1 });
    expect(summary.points.issued).toBe(10);
  });

  test('holds Admin offline-payment activation until documents are verified', async () => {
    const plan = await createPlan({
      slug: 'admin-offline-verification-plan',
      pointsTiers: [{ label: 'Standard', points: 10, fromMember: 1, toMember: null }],
    });
    const admin = await createMember({ role: 'admin' });
    const settings = await getSettings();
    const payable = getPayableAmount(plan, {
      enabled: settings.gstEnabled,
      rate: settings.gstRate,
      label: settings.gstLabel,
    });
    const created = await adminService.createMember({
      user: { firstName: 'Offline', email: 'offline-verification@example.invalid' },
      profile: {
        fullName: 'Offline Verification', gender: 'other', countryCode: '+91', mobile: '9000000002',
        dob: new Date('1990-01-01'), interestArea: 'Travel',
      },
      planSlug: plan.slug,
      offlinePayment: {
        method: 'bank_transfer',
        reference: 'BANK-VERIFY-001',
        amountPaise: payable.totalAmount,
        note: 'Received by bank transfer',
      },
    }, admin.user._id);
    const membership = await Membership.findById(created.membership._id);
    const payment = await Payment.findOne({ membership: membership._id });

    expect(payment).toMatchObject({
      status: 'paid',
      baseAmount: payable.baseAmount,
      gstAmount: payable.gstAmount,
      totalAmount: payable.totalAmount,
    });
    expect(membership.status).toBe('pending_verification');
    expect(membership.memberNo).toBe('');
    expect(membership.approvalSeq).toBeNull();
    expect(membership.memberNumber).toBe('');
    expect(membership.memberCode).toBeUndefined();
    expect(membership.pointsBalance).toBe(0);
    expect((await getMemberOverview(created.user)).membership.status).toBe('pending_verification');
    expect(await PointsTransaction.countDocuments({
      membership: membership._id,
      category: 'membership_award',
    })).toBe(0);

    await IdentityVerification.create({
      user: created.user._id,
      panCiphertext: 'encrypted-pan',
      panMask: 'ABCDE****F',
      idType: 'passport',
      idCiphertext: 'encrypted-passport',
      idMask: 'A****',
      consentAt: new Date(),
      status: 'pending',
    });
    await reviewIdentityVerification(created.user._id, admin.user._id, { status: 'verified' });

    const activatedMembership = await Membership.findById(membership._id);
    expect(activatedMembership.status).toBe('pending_approval');
    expect(activatedMembership.memberNo).toBe('');
    expect(activatedMembership.approvalSeq).toBeNull();
    expect(activatedMembership.memberNumber).toBe('');
    expect(activatedMembership.memberCode).toBeUndefined();
    expect(activatedMembership.pointsBalance).toBe(0);
    expect(await PointsTransaction.countDocuments({
      membership: membership._id,
      category: 'membership_award',
    })).toBe(0);

    await approveMembership(membership._id, admin.user._id);
    const approvedMembership = await Membership.findById(membership._id);
    expect(approvedMembership.status).toBe('active');
    expect(approvedMembership.memberNo).toMatch(/^\d+$/);
    expect(approvedMembership.approvalSeq).toBe(1);
    expect(approvedMembership.pointsBalance).toBe(600000);
    expect(await PointsLedger.findOne({ memberId: membership._id })).toMatchObject({ points: 600000 });
    expect(await Payment.findById(payment._id).select('status')).toMatchObject({ status: 'paid' });
    expect(await PointsTransaction.countDocuments({
      membership: membership._id,
      category: 'membership_award',
    })).toBe(0);
  });

  test('last admin cannot be deactivated, and no admin can deactivate themselves', async () => {
    const admin = await createMember({ role: 'admin' });
    await expect(setAdminStatus(admin.user._id, 'suspended', '000000000000000000000001'))
      .rejects.toMatchObject({ statusCode: 409 });
    await expect(setAdminStatus(admin.user._id, 'suspended', admin.user._id))
      .rejects.toMatchObject({ statusCode: 409 });
    expect(await User.countDocuments({ role: 'admin', status: 'active' })).toBe(1);
  });

  test('plan member counts and audit store only expected admin changes', async () => {
    const plan = await createPlan();
    const member = await createMember({ membership: { plan: plan._id, status: 'active' } });
    const list = await adminService.listMembers({ plan: plan.slug });
    expect(list.items.map((item) => item._id.toString())).toContain(member.user._id.toString());
    await adminService.updatePlan(plan._id, { title: 'Updated Plan' });
    await AuditLog.create({
      action: 'plan.updated', entityType: 'plan', entityId: plan._id, summary: 'Updated plan',
    });
    expect(await AuditLog.countDocuments({ entityType: 'plan' })).toBe(1);
    expect((await adminService.getMemberDetails(member.user._id)).membership.plan.title).toBe('Updated Plan');
  });

  test('lists and exports payments, creates plans, and handles missing payment/plan errors', async () => {
    const plan = await createPlan({ slug: 'admin-catalog-plan' });
    const member = await createMember({ membership: { plan: plan._id, status: 'active' } });
    const payment = await Payment.create({
      user: member.user._id, membership: member.membership._id, plan: plan._id,
      method: 'manual', status: 'paid', baseAmount: 10000, gstAmount: 0, totalAmount: 10000,
      invoiceNumber: 'INV-CSV-1',
    });
    expect((await adminService.listPlans({ page: '1', limit: '1' })).items).toHaveLength(1);
    expect((await adminService.listPayments({ status: 'paid', method: 'manual' })).total).toBe(1);
    expect((await adminService.getPayment(payment._id)).user.email).toBe(member.user.email);
    await expect(adminService.getPayment('000000000000000000000001')).rejects.toMatchObject({ statusCode: 404 });
    const csv = [];
    const response = {
      setHeader: (name, value) => csv.push(`${name}:${value}`),
      write: (line) => csv.push(line),
      end: () => csv.push('end'),
    };
    await adminService.streamPaymentsCsv(response, { method: 'manual' });
    expect(csv.join('')).toContain('INV-CSV-1');
    expect(csv.at(-1)).toBe('end');

    const created = await adminService.createPlan({
      slug: 'created-plan', title: 'Created Plan', price: 1000, gstPercent: 18,
      planFee: 1000, pointsTiers: [], maxFamilyMembers: 0, isActive: true,
      isFeatured: false, sortOrder: 2,
    });
    expect(created.legacyCheckoutPayable).toBe(1180);
    const updated = await adminService.updatePlan(created._id, { price: 2000 });
    expect(updated.legacyCheckoutPayable).toBe(2360);
    await expect(adminService.updatePlan('000000000000000000000001', { price: 1 }))
      .rejects.toMatchObject({ statusCode: 404 });
    await expect(adminService.createPlan({
      slug: 'created-plan', title: 'Duplicate Plan', price: 1000, gstPercent: 18,
      planFee: 1000, pointsTiers: [], maxFamilyMembers: 0, isActive: true,
      isFeatured: false, sortOrder: 3,
    })).rejects.toMatchObject({ statusCode: 409 });
  });

  test('resends password links only after payment, handles family records, and increments admin counters', async () => {
    const plan = await createPlan();
    const pending = await createMember({
      status: 'pending',
      emailVerified: true,
      passwordHash: undefined,
      membership: { plan: plan._id, status: 'pending_verification' },
    });
    await expect(adminService.resendMemberActivation(pending.user._id))
      .rejects.toMatchObject({ statusCode: 409 });
    await Payment.create({
      user: pending.user._id,
      membership: pending.membership._id,
      plan: plan._id,
      method: 'bank_transfer',
      status: 'pending',
      baseAmount: 10000,
      gstAmount: 1800,
      totalAmount: 11800,
    });
    await expect(adminService.resendMemberActivation(pending.user._id)).resolves.toHaveProperty('userId');
    await expect(adminService.resendMemberActivation((await createMember()).user._id))
      .rejects.toMatchObject({ statusCode: 409 });
    expect(await adminService.getFamilyForMember(pending.user._id)).toEqual([]);
    const member = await createMember({ membership: { plan: plan._id, status: 'draft' } });
    const family = await FamilyMember.create({
      membership: member.membership._id, fullName: 'Family', gender: 'other',
      relationship: 'Sibling', dob: new Date('1995-01-01'),
    });
    expect(await adminService.getFamilyForMember(member.user._id)).toHaveLength(1);
    expect((await adminService.updateFamilyMember(member.user._id, family._id, { fullName: 'Changed' })).fullName)
      .toBe('Changed');
    expect((await adminService.removeFamilyMember(member.user._id, family._id))._id.toString())
      .toBe(family._id.toString());
    expect((await adminService.nextAdminCounter('admin')).value).toBe(1);
    expect((await adminService.nextAdminCounter('admin')).value).toBe(2);
  });
});
