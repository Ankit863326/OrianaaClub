import request from 'supertest';
import { createAdmin, createMember, createPlan } from './helpers/factories.js';
import { createApp } from './helpers/createApp.js';
import AuditLog from '../src/models/AuditLog.js';
import Membership from '../src/models/Membership.js';
import FamilyMember from '../src/models/FamilyMember.js';
import Verification from '../src/models/Verification.js';
import Payment from '../src/models/Payment.js';
import User from '../src/models/User.js';
import MembershipDraft from '../src/models/MembershipDraft.js';
import Plan from '../src/models/Plan.js';
import EmailLog from '../src/models/EmailLog.js';

const app = createApp();

function adminRequest(admin, method, path) {
  return request(app)[method](path).set('Cookie', admin.cookie).set('X-Admin-Request', '1');
}

// Admin success paths verify the same privileged operations protected by the route matrix.
describe('admin member and plan routes', () => {
  test('creates, lists, updates, suspends, exports, and soft-deletes a manual member', async () => {
    const admin = await createAdmin();
    const plan = await createPlan({ slug: 'admin-member-plan' });
    const payload = {
      user: { firstName: 'Manual', email: 'manual-route@example.invalid' },
      profile: {
        fullName: 'Manual Route', gender: 'other', countryCode: '+91', mobile: '9000000002',
        dob: '1990-01-01', interestArea: 'Travel',
      },
      planSlug: plan.slug,
    };
    const created = await adminRequest(admin, 'post', '/api/admin/members').send(payload);
    expect(created.status).toBe(201);
    const userId = created.body.data.user._id;
    expect((await adminRequest(admin, 'get', '/api/admin/members')).status).toBe(200);
    expect((await adminRequest(admin, 'get', `/api/admin/members/${userId}`)).status).toBe(200);
    expect((await adminRequest(admin, 'patch', `/api/admin/members/${userId}`).send({
      firstName: 'Changed',
    })).status).toBe(200);
    expect((await adminRequest(admin, 'post', `/api/admin/members/${userId}/activate`)).status).toBe(200);
    expect((await adminRequest(admin, 'get', '/api/admin/members/export')).headers['content-type'])
      .toContain('text/csv');
    expect(await AuditLog.countDocuments({ entityType: 'member' })).toBeGreaterThan(0);
    expect((await adminRequest(admin, 'delete', `/api/admin/members/${userId}`)).status).toBe(200);
    expect((await User.findById(userId)).deletedAt).not.toBeNull();
  });

  test('creates, lists, updates and audits membership plans', async () => {
    const admin = await createAdmin();
    const body = {
      id: 'api-test-plan', slug: 'api-test-plan', title: 'API Test Plan',
      price: 1000, gstPercent: 18, planFee: 1000, pointsTiers: [],
      maxFamilyMembers: 2, isActive: true, isFeatured: false, sortOrder: 1,
    };
    const created = await adminRequest(admin, 'post', '/api/admin/plans').send(body);
    expect(created.status).toBe(201);
    const planId = created.body.data._id;
    expect((await adminRequest(admin, 'get', '/api/admin/plans')).status).toBe(200);
    expect((await adminRequest(admin, 'patch', `/api/admin/plans/${planId}`)
      .send({ title: 'Updated API Plan' })).status).toBe(200);
    expect(await AuditLog.countDocuments({ entityType: 'plan' })).toBeGreaterThan(0);
  });

  test('admin-created offline memberships save GST-inclusive payment snapshots', async () => {
    const admin = await createAdmin();
    const plan = await createPlan({
      price: 1000,
      planFee: 847,
      gst: 153,
      pointsTiers: [{ label: 'Initial', points: 100, fromMember: 1, toMember: null }],
    });
    const created = await adminRequest(admin, 'post', '/api/admin/members').send({
      user: { firstName: 'Offline GST', email: 'offline-gst@example.invalid' },
      profile: {
        fullName: 'Offline GST Member', gender: 'other', countryCode: '+91', mobile: '9000000008',
        dob: '1990-01-01', interestArea: 'Travel',
      },
      planSlug: plan.slug,
      offlinePayment: {
        method: 'bank_transfer',
        reference: 'UTR-ADMIN-GST',
        amountPaise: 118000,
        note: 'GST inclusive offline payment',
      },
    });
    expect(created.status).toBe(201);
    const payment = await Payment.findOne({ user: created.body.data.user._id });
    expect(payment).toMatchObject({
      method: 'bank_transfer',
      reference: 'UTR-ADMIN-GST',
      baseAmount: 100000,
      gstRate: 18,
      gstEnabled: true,
      gstAmount: 18000,
      totalAmount: 118000,
    });

  });

  test('returns empty queue lists, skips broken references, and lists one pending payment', async () => {
    const admin = await createAdmin();
    const empty = await adminRequest(admin, 'get', '/api/admin/membership-queue');
    expect(empty.status).toBe(200);
    expect(empty.body.data).toMatchObject({
      memberships: [],
      payments: [],
      familyRequests: [],
    });

    const plan = await createPlan();
    const member = await createMember({
      membership: { plan: plan._id, status: 'pending_payment' },
    });
    await Promise.all([
      User.deleteOne({ _id: member.user._id }),
      Plan.deleteOne({ _id: plan._id }),
    ]);

    const broken = await adminRequest(admin, 'get', '/api/admin/membership-queue');
    expect(broken.status).toBe(200);
    expect(broken.body.data.memberships).toEqual([]);
    expect(broken.body.data.payments).toEqual([]);

    const activePlan = await createPlan();
    const pendingMember = await createMember({
      membership: { plan: activePlan._id, status: 'pending_payment' },
    });
    await Payment.create({
      user: pendingMember.user._id,
      membership: pendingMember.membership._id,
      plan: activePlan._id,
      method: 'bank_transfer',
      status: 'pending',
      baseAmount: 10000,
      gstAmount: 1800,
      totalAmount: 11800,
    });
    const onePayment = await adminRequest(admin, 'get', '/api/admin/membership-queue');
    expect(onePayment.status).toBe(200);
    expect(onePayment.body.data.payments).toHaveLength(1);
  });

  test('lists payments with broken references and accepts empty date filters', async () => {
    const admin = await createAdmin();
    const plan = await createPlan();
    const member = await createMember({
      membership: { plan: plan._id, status: 'pending_payment' },
    });
    const payment = await Payment.create({
      user: member.user._id,
      membership: member.membership._id,
      plan: plan._id,
      method: 'cheque',
      status: 'pending',
      baseAmount: 10000,
      gstAmount: 1800,
      totalAmount: 11800,
    });
    await Promise.all([
      User.deleteOne({ _id: member.user._id }),
      Plan.deleteOne({ _id: plan._id }),
    ]);

    const response = await adminRequest(
      admin,
      'get',
      '/api/admin/payments?status=pending&method=cheque&from=&to=',
    );
    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0]).toMatchObject({
      _id: String(payment._id),
      user: null,
      plan: null,
      brokenReferences: ['user', 'plan'],
    });
    const exported = await adminRequest(
      admin,
      'get',
      '/api/admin/payments/export?status=pending&method=cheque',
    );
    expect(exported.status).toBe(200);
    expect(exported.headers['content-type']).toContain('text/csv');
    expect(exported.text).toContain('cheque');
  });

  test('records cheque and cash without UTR, confirms idempotently and logs email failures', async () => {
    const admin = await createAdmin();
    const plan = await createPlan();
    const chequeMember = await createMember({
      membership: { plan: plan._id, status: 'pending_payment' },
    });
    globalThis.__orianaMailTransport.sendMail.mockClear();
    globalThis.__orianaMailTransport.sendMail.mockRejectedValueOnce(
      Object.assign(new Error('SMTP unavailable'), { code: 'ECONNREFUSED' }),
    );
    const chequeRecorded = await adminRequest(admin, 'post', '/api/admin/payments')
      .send({ membershipId: String(chequeMember.membership._id), method: 'cheque' });
    expect(chequeRecorded.status).toBe(201);
    const chequeId = chequeRecorded.body.data._id;

    const firstConfirm = await adminRequest(admin, 'patch', `/api/admin/payments/${chequeId}/confirm`);
    expect(firstConfirm.status).toBe(200);
    expect(firstConfirm.body.data.payment).toMatchObject({
      status: 'paid',
      method: 'cheque',
      reference: '',
      utr: '',
    });
    expect(firstConfirm.body.data.payment.invoiceNumber).toMatch(/^INV-\d{4}-\d{6}$/);
    expect(firstConfirm.body.data.payment.receiptNumber).toMatch(/^OC-R-\d{4}-\d{6}$/);
    expect(firstConfirm.body.data.membership.status).toBe('pending_approval');
    expect(await EmailLog.exists({ template: 'payment-success', status: 'failed' })).toBeTruthy();
    expect(await AuditLog.exists({
      action: 'membership.payment.confirmation_email.failed',
      entityId: String(chequeId),
    })).toBeTruthy();

    const secondConfirm = await adminRequest(admin, 'patch', `/api/admin/payments/${chequeId}/confirm`);
    expect(secondConfirm.status).toBe(200);
    expect(secondConfirm.body.data.alreadyConfirmed).toBe(true);
    expect(secondConfirm.body.data.payment.invoiceNumber).toBe(firstConfirm.body.data.payment.invoiceNumber);
    expect(secondConfirm.body.data.payment.receiptNumber).toBe(firstConfirm.body.data.payment.receiptNumber);
    expect(globalThis.__orianaMailTransport.sendMail).toHaveBeenCalledTimes(1);

    const cashMember = await createMember({
      membership: { plan: plan._id, status: 'pending_payment' },
    });
    const cashRecorded = await adminRequest(admin, 'post', '/api/admin/payments')
      .send({ membershipId: String(cashMember.membership._id), method: 'cash' });
    expect(cashRecorded.status).toBe(201);
    const cashConfirm = await adminRequest(admin, 'patch', `/api/admin/payments/${cashRecorded.body.data._id}/confirm`);
    expect(cashConfirm.status).toBe(200);
    expect(cashConfirm.body.data.payment).toMatchObject({ method: 'cash', reference: '', utr: '' });
    expect(cashConfirm.body.data.payment.invoiceNumber).toBeTruthy();
  });

  test('membership settings omit cancellation rules and expose no refund-rule route', async () => {
    const admin = await createAdmin();
    const settings = await adminRequest(admin, 'get', '/api/admin/membership-settings');
    expect(settings.status).toBe(200);
    expect(settings.body.data).toHaveProperty('receiptHsnSac');
    expect(settings.body.data).not.toHaveProperty('cancellationPolicy');
    const updated = await adminRequest(admin, 'patch', '/api/admin/membership-settings')
      .send({ gstRate: 18.5 });
    expect(updated.status).toBe(200);
    expect(await AuditLog.findOne({ action: 'membership_settings.update', entityType: 'membership_settings' }))
      .toMatchObject({
        before: expect.objectContaining({ gstRate: 18 }),
        after: expect.objectContaining({ gstRate: 18.5 }),
      });
    const familyMembership = settings.body.data.familyMembership;
    const updatedConfig = await adminRequest(admin, 'patch', '/api/admin/membership-settings')
      .send({ familyMembership: { ...familyMembership, gstPct: 19 } });
    expect(updatedConfig.status).toBe(200);
    expect(updatedConfig.body.data.familyMembership.gstPct).toBe(19);
    const configAudit = await AuditLog.findOne({
      action: 'membership_settings.update',
      entityType: 'membership_settings',
    }).sort({ createdAt: -1 }).lean();
    expect(configAudit.before.familyMembership.gstPct).toBe(18);
    expect(configAudit.after.familyMembership.gstPct).toBe(19);
    expect((await adminRequest(admin, 'get', '/api/admin/refund-rules')).status).toBe(404);
  });

  test('lists paid approvals and approves a membership through the transactional route', async () => {
    const admin = await createAdmin();
    const plan = await createPlan({ slug: 'approval-route-plan' });
    const member = await createMember({
      status: 'pending',
      activationRequiresMembershipPayment: true,
      membership: {
        plan: plan._id,
        status: 'pending_approval',
        tier: 'founder-legacy',
        baseAmount: 1000,
        gstAmount: 180,
        totalPaid: 1180,
        paymentConfirmedAt: new Date(),
        approvalDueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const queue = await adminRequest(admin, 'get', '/api/admin/membership-approval-queue');
    expect(queue.status).toBe(200);
    expect(queue.body.data.items.map((item) => item._id)).toContain(String(member.membership._id));
    globalThis.__orianaMailTransport.sendMail.mockRejectedValueOnce(
      Object.assign(new Error('temporary SMTP outage'), { code: 'ECONNECTION' }),
    );
    const approved = await adminRequest(admin, 'post', `/api/admin/memberships/${member.membership._id}/approve`);
    expect(approved.status).toBe(200);
    expect(approved.body.data.membership).toMatchObject({ status: 'active', approvalSeq: 1 });
    expect(approved.body.data.emailFailures).toHaveLength(1);
    expect(await AuditLog.exists({ action: 'membership.approval_email.failed' })).toBeTruthy();
    expect(await User.findById(member.user._id)).toMatchObject({
      status: 'active',
      activationRequiresMembershipPayment: false,
    });
  });

  test('loads the family tree by member number only for an administrator', async () => {
    const admin = await createAdmin();
    const plan = await createPlan();
    const member = await createMember({
      profile: { fullName: 'Family Tree Primary' },
      membership: {
        plan: plan._id,
        memberNo: '4242',
        memberType: 'primary',
        status: 'active',
      },
    });

    const spouse = await FamilyMember.create({
      membership: member.membership._id,
      name: 'Family Tree Spouse',
      relation: 'wife',
      memberType: 'spouse',
      status: 'active',
      memberNo: '4242-S',
    });
    await Membership.create({
      user: member.user._id,
      plan: plan._id,
      status: 'active',
      memberType: 'spouse',
      linkedTo: member.membership._id,
      familyMember: spouse._id,
      memberNo: '4242-S',
    });
    await FamilyMember.create({
      membership: member.membership._id,
      name: 'Family Tree GM',
      relation: 'nominee',
      memberType: 'nominee_gm',
      isNominee: true,
      nomineeRole: 'GM',
      status: 'active',
      approvedAt: new Date(),
      memberNo: '4242-GM',
      emailConfirmedAt: new Date(),
    });

    const response = await adminRequest(admin, 'get', '/api/admin/memberships/family-tree/4242');
    expect(response.status).toBe(200);
    expect(response.body.data.primary.name).toBe('Family Tree Primary');
    expect(response.body.data.family).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Family Tree Spouse', relation: 'wife' }),
    ]));
    const members = await adminRequest(admin, 'get', '/api/admin/memberships?search=4242');
    expect(members.status).toBe(200);
    expect(members.body.data.items.map((item) => item.memberType)).toEqual(
      expect.arrayContaining(['primary', 'spouse', 'nominee_gm']),
    );
    expect((await request(app).get('/api/admin/memberships/family-tree/4242')
      .set('Cookie', member.cookie)).status).toBe(403);
  });

  test('serves family verification review details only to an administrator', async () => {
    const admin = await createAdmin();
    const plan = await createPlan();
    const primary = await createMember({ membership: { plan: plan._id, status: 'active' } });
    const family = await FamilyMember.create({
      membership: primary.membership._id,
      name: 'Verification Applicant',
      relation: 'wife',
      memberType: 'spouse',
      status: 'active',
    });
    await Verification.create({
      memberId: family._id,
      status: 'pending',
      relation: 'wife',
    });

    const detail = await adminRequest(admin, 'get', `/api/admin/family-verifications/${family._id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.member.name).toBe('Verification Applicant');
    expect((await request(app).get(`/api/admin/family-verifications/${family._id}`)
      .set('Cookie', primary.cookie)).status).toBe(403);

    const nominee = await FamilyMember.create({
      membership: primary.membership._id,
      name: 'Email-only nominee',
      relation: 'nominee',
      memberType: 'nominee',
      isNominee: true,
    });
    const nomineeDetail = await adminRequest(admin, 'get', `/api/admin/family-verifications/${nominee._id}`);
    expect(nomineeDetail.status).toBe(404);
  });

  test('invites an administrator and lists the pending admin without exposing a password', async () => {
    const actor = await createAdmin();
    const invited = await adminRequest(actor, 'post', '/api/admin/admins')
      .send({ firstName: 'Invited', email: 'invited-admin@example.invalid' });
    expect(invited.status).toBe(201);
    expect(invited.body.data.admin).not.toHaveProperty('passwordHash');
    expect((await adminRequest(actor, 'get', '/api/admin/admins?status=pending&search=Invited'))
      .body.data.items.map((item) => item.email)).toContain('invited-admin@example.invalid');
    expect(await AuditLog.countDocuments({ action: 'admin.create' })).toBe(1);
  });
});

describe('admin points, content, enquiry and reports routes', () => {
  test('credits, debits, bulk-credits, and reads a member points ledger', async () => {
    const admin = await createAdmin();
    const plan = await createPlan();
    const member = await createMember({
      membership: { plan: plan._id, status: 'active', pointsBalance: 0 },
    });
    const membershipId = String(member.membership._id);
    const credit = await adminRequest(admin, 'post', '/api/admin/points/credit').send({
      membershipId, amount: 20, category: 'adjustment', reason: 'Admin award',
    });
    expect(credit.status).toBe(200);
    expect((await adminRequest(admin, 'post', '/api/admin/points/debit').send({
      membershipId, amount: 2, category: 'adjustment', reason: 'Correction',
    })).status).toBe(200);
    const bulkCredit = await adminRequest(admin, 'post', '/api/admin/points/bulk-credit').send({
      membershipIds: [membershipId], amount: 3, reason: 'Campaign',
    });
    expect(bulkCredit.status).toBe(200);
    expect((await adminRequest(admin, 'get', `/api/admin/members/${member.user._id}/points`)).status).toBe(200);
    expect(await AuditLog.countDocuments({ entityType: 'membership' })).toBe(3);
  });

  test('publishes and removes a post and event with an audit record for every change', async () => {
    const admin = await createAdmin();
    const post = await adminRequest(admin, 'post', '/api/admin/posts').send({
      title: 'Admin Story', slug: 'admin-story', excerpt: 'Story excerpt',
      content: 'Story body', category: 'Travel', status: 'published',
    });
    expect(post.status).toBe(201);
    const postId = post.body.data._id;
    expect((await adminRequest(admin, 'get', '/api/admin/posts')).status).toBe(200);
    expect((await adminRequest(admin, 'patch', `/api/admin/posts/${postId}`)
      .send({ title: 'Updated Story' })).status).toBe(200);
    expect((await adminRequest(admin, 'delete', `/api/admin/posts/${postId}`)).status).toBe(200);

    const event = await adminRequest(admin, 'post', '/api/admin/events').send({
      title: 'Admin Event', slug: 'admin-event', description: 'Event description',
      date: '2030-01-01', location: 'Mumbai', status: 'published',
    });
    expect(event.status).toBe(201);
    const eventId = event.body.data._id;
    expect((await adminRequest(admin, 'get', '/api/admin/events')).status).toBe(200);
    expect((await adminRequest(admin, 'patch', `/api/admin/events/${eventId}`)
      .send({ status: 'cancelled' })).status).toBe(200);
    expect((await adminRequest(admin, 'delete', `/api/admin/events/${eventId}`)).status).toBe(200);
    expect(await AuditLog.countDocuments()).toBe(6);
  });

  test('updates enquiry status and notes, reads logs, and exports reports', async () => {
    const admin = await createAdmin();
    const enquiry = await request(app).post('/api/enquiries').send({
      type: 'query', name: 'Enquiry User', email: 'enquiry@example.invalid',
      message: 'Question', recaptchaToken: 'fake-token',
    });
    expect(enquiry.status).toBe(201);
    const id = enquiry.body.data.id;
    expect((await adminRequest(admin, 'get', '/api/admin/enquiries?status=contacted&search=Enquiry&from=2020-01-01&to=2030-01-01')).status).toBe(200);
    expect((await adminRequest(admin, 'get', '/api/admin/enquiries/summary')).status).toBe(200);
    expect((await adminRequest(admin, 'patch', `/api/admin/enquiries/${id}/status`)
      .send({ status: 'contacted' })).status).toBe(200);
    expect((await adminRequest(admin, 'post', `/api/admin/enquiries/${id}/notes`)
      .send({ note: 'Called member' })).status).toBe(201);
    expect((await adminRequest(admin, 'get', '/api/admin/audit-logs')).status).toBe(200);
    expect((await adminRequest(admin, 'get', '/api/admin/email-logs')).status).toBe(200);
    expect((await adminRequest(admin, 'get', '/api/admin/reports')).status).toBe(200);
    expect((await adminRequest(admin, 'get', '/api/admin/reports/export?report=members-by-plan')).headers['content-type'])
      .toContain('text/csv');
    expect((await adminRequest(admin, 'get', '/api/admin/reports/export?report=revenue-by-month')).status).toBe(200);
    expect((await adminRequest(admin, 'get', '/api/admin/reports/export?report=points-by-month')).status).toBe(200);
  });
});

describe('admin draft member routes', () => {
  test('supports help requests, contact edits, payment resolution, password setup and activation', async () => {
    const admin = await createAdmin();
    const plan = await createPlan({ title: 'Draft Resolution Plan' });
    const member = await createMember({
      email: 'draft-resolution@example.invalid',
      status: 'pending',
      passwordHash: undefined,
      membership: { plan: plan._id, status: 'pending_payment' },
    });
    const payment = await Payment.create({
      user: member.user._id,
      membership: member.membership._id,
      plan: plan._id,
      method: 'bank_transfer',
      status: 'pending',
      baseAmount: 10000,
      gstAmount: 1800,
      totalAmount: 11800,
    });
    const draft = await MembershipDraft.create({
      email: member.user.email,
      firstName: member.user.firstName,
      tokenHash: 'c'.repeat(64),
      expiresAt: new Date(Date.now() + 60_000),
      status: 'payment_pending',
      currentStep: 6,
      user: member.user._id,
      membership: member.membership._id,
      plan: plan._id,
      payment: payment._id,
    });

    const help = await request(app).post('/api/membership/request-help')
      .send({ email: 'help-only@example.invalid' });
    expect(help.status).toBe(202);
    expect(await MembershipDraft.findOne({ email: 'help-only@example.invalid' }))
      .toMatchObject({ needsHelp: true, currentStep: 6 });

    const listed = await adminRequest(admin, 'get', '/api/admin/drafts?status=payment_pending&search=draft-resolution');
    expect(listed.status).toBe(200);
    expect(listed.body.data.items[0]).toMatchObject({
      _id: String(draft._id),
      paymentStatus: 'pending',
      currentStep: 6,
    });
    expect(await AuditLog.findOne({ action: 'draft_member.list' })).toMatchObject({
      admin: admin.user._id,
      entityId: 'draft_collection',
    });

    expect((await adminRequest(admin, 'patch', `/api/admin/drafts/${draft._id}`)
      .send({ email: 'draft-updated@example.invalid', phone: '9000000099' })).status).toBe(200);
    const paid = await adminRequest(admin, 'post', `/api/admin/drafts/${draft._id}/mark-paid`)
      .send({ transactionId: 'BANK-REF-123', note: 'Confirmed at bank' });
    expect(paid.status).toBe(200);
    expect(await Payment.findById(payment._id).lean()).toMatchObject({
      status: 'paid',
      reference: 'BANK-REF-123',
    });

    expect((await adminRequest(admin, 'post', `/api/admin/drafts/${draft._id}/resend-link`)).status).toBe(200);
    const password = await adminRequest(admin, 'post', `/api/admin/drafts/${draft._id}/set-temp-password`);
    expect(password.status).toBe(200);
    expect(password.body.data.temporaryPassword).toMatch(/^TempA1[a-f\d]{24}$/);
    expect((await adminRequest(admin, 'post', `/api/admin/drafts/${draft._id}/activate`)).status).toBe(200);
    expect((await User.findById(member.user._id)).status).toBe('active');
    expect(await AuditLog.countDocuments({ entityType: 'membership_draft' })).toBeGreaterThanOrEqual(5);

    expect((await adminRequest(admin, 'delete', `/api/admin/drafts/${draft._id}`)).status).toBe(200);
    expect(await MembershipDraft.findById(draft._id)).toBeNull();
  });
});

describe('admin payments routes', () => {
  test('approves and rejects bank transfers and rejects a duplicate UTR', async () => {
    await Payment.init();
    const admin = await createAdmin();
    const plan = await createPlan({ pointsTiers: [{ label: 'Standard', points: 10, fromMember: 1, toMember: null }] });
    const member = await createMember({
      status: 'pending',
      activationRequiresMembershipPayment: true,
      membership: { plan: plan._id, status: 'pending_payment' },
    });
    const values = {
      user: member.user._id, membership: member.membership._id, plan: plan._id,
      method: 'bank_transfer', status: 'pending_verification',
      baseAmount: 10000, gstAmount: 1800, totalAmount: 11800, utr: 'UTR-UNIQUE-1',
    };
    const payment = await Payment.create(values);
    await expect(Payment.create(values)).rejects.toMatchObject({ code: 11000 });
    const approved = await adminRequest(admin, 'post', `/api/admin/payments/${payment._id}/approve`);
    expect(approved.status).toBe(200);
    expect((await Membership.findById(member.membership._id)).status).toBe('pending_approval');
    expect((await Payment.findById(payment._id)).status).toBe('paid');
    expect((await Membership.findById(member.membership._id)).memberId).toBe('');
    expect((await User.findById(member.user._id)).status).toBe('pending');
    const rejectedPayment = await Payment.create({
      ...values, utr: 'UTR-UNIQUE-2', status: 'pending_verification',
    });
    expect((await adminRequest(admin, 'post', `/api/admin/payments/${rejectedPayment._id}/reject`)
      .send({ reason: 'Invalid transfer' })).status).toBe(200);
    expect((await adminRequest(admin, 'get', '/api/admin/payments')).status).toBe(200);
    expect((await adminRequest(admin, 'get', '/api/admin/payments/export')).headers['content-type'])
      .toContain('text/csv');
    expect((await adminRequest(admin, 'get', `/api/admin/payments/${payment._id}`)).status).toBe(200);
  });

  test('blocks membership payment refunds', async () => {
    const admin = await createAdmin();
    const plan = await createPlan();
    const member = await createMember({
      membership: { plan: plan._id, status: 'active', pointsBalance: 5 },
    });
    const payment = await Payment.create({
      user: member.user._id, membership: member.membership._id, plan: plan._id,
      method: 'razorpay', status: 'paid', baseAmount: 10000, gstAmount: 1800,
      totalAmount: 11800, razorpayPaymentId: 'payment_refund_1', invoiceNumber: 'INV-TEST-1',
    });
    const withoutReversal = await adminRequest(admin, 'post', `/api/admin/payments/${payment._id}/refund`)
      .send({ amount: 1000, reason: 'Partial refund' });
    expect(withoutReversal.status).toBe(409);
    expect(withoutReversal.body.message).toContain('non-refundable');
    expect((await Payment.findById(payment._id)).status).toBe('paid');
    expect(globalThis.__orianaRazorpayClient.payments.refund).not.toHaveBeenCalled();
  });
});
