import { createHash, randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../src/app.js';
import FamilyMember from '../src/models/FamilyMember.js';
import MembershipDraft from '../src/models/MembershipDraft.js';
import MembershipPlan from '../src/models/MembershipPlan.js';
import Setting from '../src/models/Setting.js';
import { createAdmin, createMember, createPlan } from './helpers/factories.js';
import { adminAddFamilyMember } from '../src/services/family.service.js';

const familyPrices = (planId) => `/api/member/family-prices?planId=${planId}`;
const draftFamilyPrices = (planId) => `/api/membership/draft/family-prices?planId=${planId}`;

async function createFamilyPlan(tier = 'founder-legacy') {
  return createPlan({
    id: tier,
    slug: tier,
    name: tier,
    title: tier,
    price: 300000,
    numericPrice: 300000,
  });
}

async function addFamilyProfile(cookie, fields) {
  const response = request(app).post('/api/member/family').set('Cookie', cookie);
  for (const [key, value] of Object.entries(fields)) response.field(key, String(value));
  return response;
}

describe('Step 3 family prices and profile rules', () => {
  test('anniversary dates are optional, validated, and synced with the parent couple on approval', async () => {
    const plan = await createFamilyPlan();
    const member = await createMember({
      membership: { plan: plan._id, status: 'active', memberType: 'primary' },
    });
    const submitFamily = (fields) => {
      const response = request(app).post('/api/me/family').set('Cookie', member.cookie);
      for (const [key, value] of Object.entries(fields)) response.field(key, String(value));
      return response;
    };

    const emptyAnniversary = await submitFamily({
      name: 'Optional Anniversary Spouse',
      relation: 'Spouse',
      dateOfBirth: '1965-01-01',
      anniversaryDate: '',
      parentSide: '',
    });
    expect(emptyAnniversary.status).toBe(201);
    expect(emptyAnniversary.body.data.anniversaryDate).toBeFalsy();

    const futureAnniversary = await submitFamily({
      name: 'Future Anniversary Spouse',
      relation: 'Spouse',
      dateOfBirth: '1965-01-01',
      anniversaryDate: '2999-01-01',
    });
    expect(futureAnniversary.status).toBe(400);

    const beforeBirth = await submitFamily({
      name: 'Before Birth Anniversary Spouse',
      relation: 'Spouse',
      dateOfBirth: '1965-01-01',
      anniversaryDate: '1964-12-31',
    });
    expect(beforeBirth.status).toBe(400);

    const father = await submitFamily({
      name: 'Anniversary Father',
      relation: 'Father',
      parentSide: 'member',
      dateOfBirth: '1960-01-01',
      anniversaryDate: '2000-01-01',
    });
    const mother = await submitFamily({
      name: 'Anniversary Mother',
      relation: 'Mother',
      parentSide: 'member',
      dateOfBirth: '1962-01-01',
    });
    expect(father.status).toBe(201);
    expect(mother.status).toBe(201);
    expect(new Date(mother.body.data.anniversaryDate).toISOString().slice(0, 10)).toBe('2000-01-01');

    const admin = await createAdmin();
    for (const profile of [father.body.data, mother.body.data]) {
      const approval = await request(app)
        .patch(`/api/admin/family-requests/${profile._id}/approve`)
        .set('Cookie', admin.cookie)
        .set('X-Admin-Request', '1')
        .send({});
      expect(approval.status).toBe(200);
    }

    const update = await request(app)
      .put(`/api/me/family/${father.body.data._id}`)
      .set('Cookie', member.cookie)
      .send({
        name: 'Anniversary Father',
        relation: 'Father',
        parentSide: 'member',
        dateOfBirth: '1960-01-01',
        anniversaryDate: '2001-02-03',
      });
    expect(update.status).toBe(200);
    expect(update.body.data.pendingAction).toBe('update');

    const approval = await request(app)
      .patch(`/api/admin/family-requests/${father.body.data._id}/approve`)
      .set('Cookie', admin.cookie)
      .set('X-Admin-Request', '1')
      .send({});
    expect(approval.status).toBe(200);
    const savedParents = await FamilyMember.find({
      membership: father.body.data.membership,
      parentSide: 'member',
      memberType: { $in: ['father', 'mother'] },
    }).sort({ memberType: 1 }).lean();
    expect(savedParents.map((profile) => profile.anniversaryDate.toISOString().slice(0, 10)))
      .toEqual(['2001-02-03', '2001-02-03']);

    const clearAnniversary = await request(app)
      .put(`/api/me/family/${father.body.data._id}`)
      .set('Cookie', member.cookie)
      .send({
        relation: 'Father',
        parentSide: 'member',
        anniversaryDate: '',
      });
    expect(clearAnniversary.status).toBe(200);
    const clearApproval = await request(app)
      .patch(`/api/admin/family-requests/${father.body.data._id}/approve`)
      .set('Cookie', admin.cookie)
      .set('X-Admin-Request', '1')
      .send({});
    expect(clearApproval.status).toBe(200);
    expect(await FamilyMember.countDocuments({
      membership: father.body.data.membership,
      parentSide: 'member',
      memberType: { $in: ['father', 'mother'] },
      anniversaryDate: { $ne: null },
    })).toBe(0);
  });

  test('draft member family profiles inherit and synchronize parent anniversary dates', async () => {
    const plan = await createFamilyPlan();
    const member = await createMember({
      membership: { plan: plan._id, status: 'draft', memberType: 'primary' },
    });
    const saveProfile = (fields) => {
      const response = request(app).post('/api/member/family').set('Cookie', member.cookie);
      for (const [key, value] of Object.entries(fields)) response.field(key, String(value));
      return response;
    };
    const father = await saveProfile({
      fullName: 'Draft Father',
      gender: 'male',
      relationship: 'Father',
      memberType: 'father',
      parentSide: 'member',
      dob: '1960-01-01',
      anniversaryDate: '2000-01-01',
    });
    const mother = await saveProfile({
      fullName: 'Draft Mother',
      gender: 'female',
      relationship: 'Mother',
      memberType: 'mother',
      parentSide: 'member',
      dob: '1962-01-01',
      anniversaryDate: '',
    });
    expect(father.status).toBe(201);
    expect(mother.status).toBe(201);
    const profiles = await FamilyMember.find({
      membership: member.membership._id,
      parentSide: 'member',
      memberType: { $in: ['father', 'mother'] },
    }).lean();
    expect(profiles).toHaveLength(2);
    expect(profiles.every((profile) => profile.anniversaryDate?.toISOString().slice(0, 10) === '2000-01-01')).toBe(true);

    const update = await request(app)
      .put(`/api/member/family/${father.body.data._id}`)
      .set('Cookie', member.cookie)
      .field('fullName', 'Draft Father')
      .field('gender', 'male')
      .field('relationship', 'Father')
      .field('memberType', 'father')
      .field('parentSide', 'member')
      .field('dob', '1960-01-01')
      .field('anniversaryDate', '2001-02-03');
    expect(update.status).toBe(200);
    const updatedParents = await FamilyMember.find({
      membership: member.membership._id,
      parentSide: 'member',
      memberType: { $in: ['father', 'mother'] },
    }).lean();
    expect(updatedParents.every((profile) => profile.anniversaryDate?.toISOString().slice(0, 10) === '2001-02-03')).toBe(true);
  });

  test('active membership family pricing resolves the stored plan reference and canonical tier', async () => {
    const imperialPlan = await MembershipPlan.create({
      name: 'Imperial Signature',
      price: 700000,
      earlyBirdPoints: 1550000,
      defaultPoints: 1260000,
      renewalPoints: 1190000,
      sortOrder: 3,
      isActive: true,
    });
    const requestedPlan = await createFamilyPlan('founder-legacy');
    const member = await createMember({
      membership: {
        plan: imperialPlan._id,
        planModel: 'MembershipPlan',
        tier: 'stale-or-unsupported-tier',
        status: 'active',
      },
    });

    const response = await request(app)
      .get(`/api/member/family-prices?planId=${requestedPlan._id}`)
      .set('Cookie', member.cookie);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      tier: 'imperial-signature',
      familyEnabled: true,
      limits: { spouse: 1, parents: 4, parentsPerSide: 2, children: null },
    });
    expect(response.body.data.prices).toHaveProperty('child');
  });

  test('member family requests accept unlimited children, cap parents at two per side, and appear in admin queue', async () => {
    const plan = await createFamilyPlan();
    const member = await createMember({
      membership: { plan: plan._id, status: 'active', memberType: 'primary' },
    });
    const addMember = (fields) => {
      const response = request(app).post('/api/me/family').set('Cookie', member.cookie);
      for (const [key, value] of Object.entries(fields)) response.field(key, String(value));
      return response;
    };

    const missingParentSide = await addMember({
      name: 'Missing Side Parent',
      relation: 'Father',
      dateOfBirth: '1960-01-01',
      phone: '9000000000',
    });
    expect(missingParentSide.status).toBe(400);
    expect(missingParentSide.body.message).toMatch(/choose whether this parent/i);

    const profiles = [
      { name: 'Member father', relation: 'Father', parentSide: 'member', dateOfBirth: '1960-01-01' },
      { name: 'Member mother', relation: 'Mother', parentSide: 'member', dateOfBirth: '1962-01-01' },
      { name: 'Spouse father', relation: 'Father', parentSide: 'spouse', dateOfBirth: '1958-01-01' },
      { name: 'Spouse mother', relation: 'Mother', parentSide: 'spouse', dateOfBirth: '1963-01-01' },
      { name: 'Child one', relation: 'Child', dateOfBirth: '2015-01-01' },
      { name: 'Child two', relation: 'Child', dateOfBirth: '2017-01-01' },
    ];
    const created = [];
    for (const profile of profiles) {
      const response = await addMember({
        ...profile,
        phone: '9000000000',
      });
      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject({
        pendingAction: 'add',
        status: 'pending_approval',
      });
      created.push(response.body.data);
    }

    const admin = await createAdmin();
    const queue = await request(app)
      .get('/api/admin/family-requests')
      .set('Cookie', admin.cookie);
    expect(queue.status).toBe(200);
    expect(queue.body.data.items.map((item) => item._id))
      .toEqual(expect.arrayContaining(created.map((item) => item._id)));
    expect(created.slice(0, 4).map((item) => item.parentSide))
      .toEqual(['member', 'member', 'spouse', 'spouse']);
    const membership = await request(app)
      .get('/api/me/membership')
      .set('Cookie', member.cookie);
    expect(membership.status).toBe(200);
    expect(membership.body.data.family.adults
      .filter((item) => item.relation.toLowerCase() === 'father' || item.relation.toLowerCase() === 'mother')
      .map((item) => item.parentSide))
      .toEqual(['member', 'member', 'spouse', 'spouse']);

    const thirdMemberParent = await addMember({
      name: 'Third Member Parent',
      relation: 'Father',
      parentSide: 'member',
      dateOfBirth: '1955-01-01',
      phone: '9000000000',
    });
    expect(thirdMemberParent.status).toBe(409);
    expect(thirdMemberParent.body.message).toMatch(/maximum of 2 parents.*per side/i);
  });

  test('lists plans using family defaults when persisted settings predate family membership', async () => {
    await Setting.collection.insertOne({ _id: 'global', membershipValidityYears: 25 });
    await MembershipPlan.create({
      name: 'Founder Legacy',
      price: 300000,
      earlyBirdPoints: 600000,
      defaultPoints: 480000,
      renewalPoints: 300000,
      sortOrder: 1,
    });

    const response = await request(app).get('/api/membership/plans');

    expect(response.status).toBe(200);
    expect(response.body.data[0]).toMatchObject({
      familyEnabled: true,
      familyLimits: { spouse: 1, parents: 4, parentsPerSide: 2, children: null },
    });
  });

  test('returns configurable family prices for signed-in members and email-verified drafts', async () => {
    const plan = await createFamilyPlan();
    const member = await createMember({ membership: { plan: plan._id, status: 'draft' } });
    const memberResponse = await request(app)
      .get(familyPrices(plan._id))
      .set('Cookie', member.cookie);
    expect(memberResponse.status).toBe(200);
    expect(memberResponse.body.data).toMatchObject({
      familyEnabled: true,
      childMaxAge: 18,
      limits: { spouse: 1, parents: 4, parentsPerSide: 2, children: null },
      prices: {
        spouse: { baseAmount: 150000, gstAmount: 27000, totalPayable: 177000, discountPct: 50 },
        parent: { baseAmount: 150000, gstAmount: 27000, totalPayable: 177000, discountPct: 50 },
        child: { baseAmount: 75000, gstAmount: 13500, totalPayable: 88500, discountPct: 75 },
      },
    });

    const draftPlan = await MembershipPlan.create({
      name: 'Founder Legacy',
      price: 300000,
      earlyBirdPoints: 600000,
      defaultPoints: 480000,
      renewalPoints: 300000,
      sortOrder: 1,
    });
    const token = randomBytes(32).toString('hex');
    const draft = await MembershipDraft.create({
      email: 'step5@example.invalid',
      firstName: 'Step',
      tokenHash: createHash('sha256').update(token).digest('hex'),
      expiresAt: new Date(Date.now() + 60_000),
      emailVerifiedAt: new Date(),
      status: 'draft',
      plan: draftPlan._id,
    });
    const draftResponse = await request(app)
      .get(draftFamilyPrices(draftPlan._id))
      .set('Cookie', `oc_membership_draft=${token}`);
    expect(draftResponse.status).toBe(200);
    expect(draftResponse.body.data.prices.child.totalPayable).toBe(88500);
    expect(draft._id).toBeTruthy();

    const savedDraftNominee = await request(app)
      .post('/api/membership/draft/family')
      .set('Cookie', `oc_membership_draft=${token}`)
      .field('fullName', 'Draft Nominee')
      .field('gender', 'prefer_not_to_say')
      .field('relationship', 'Nominee')
      .field('memberType', 'nominee')
      .field('isNominee', 'true')
      .field('nomineeRole', 'Friend')
      .field('designation', 'Advisor')
      .field('workEmail', 'draftnominee@example.invalid')
      .field('phone', '9876543210')
      .field('dob', '');
    expect(savedDraftNominee.status).toBe(201);
    expect(savedDraftNominee.body.data).toMatchObject({
      fullName: 'Draft Nominee',
      isNominee: true,
      nomineeRole: 'Friend',
      designation: 'Advisor',
      workEmail: 'draftnominee@example.invalid',
      phone: '9876543210',
      dob: null,
    });
  });

  test('persists profile fields and rejects over-age children and duplicate spouses server-side', async () => {
    const plan = await createFamilyPlan();
    const member = await createMember({ membership: { plan: plan._id, status: 'draft' } });
    const spouse = {
      fullName: 'Jamie Member',
      gender: 'other',
      relationship: 'Spouse',
      memberType: 'spouse',
      dob: '1990-10-14',
      anniversaryDate: '2018-06-12',
      wantsOwnMembership: true,
    };
    const first = await addFamilyProfile(member.cookie, spouse);
    expect(first.status).toBe(201);
    expect(first.body.data).toMatchObject({
      memberType: 'spouse',
      wantsOwnMembership: true,
    });
    expect(new Date(first.body.data.anniversaryDate).toISOString().slice(0, 10)).toBe('2018-06-12');

    const duplicateSpouse = await addFamilyProfile(member.cookie, {
      ...spouse,
      fullName: 'Another Spouse',
      anniversaryDate: '',
      wantsOwnMembership: false,
    });
    expect(duplicateSpouse.status).toBe(409);

    const overAgeChild = await addFamilyProfile(member.cookie, {
      fullName: 'Adult Child',
      gender: 'other',
      relationship: 'Son',
      memberType: 'child',
      dob: '2000-01-01',
    });
    expect(overAgeChild.status).toBe(409);
    expect(overAgeChild.body.message).toMatch(/needs own membership/i);
  });

  test('saves nominee contact fields without DOB and enforces Corporate GM and HR roles', async () => {
    const plan = await createFamilyPlan();
    const member = await createMember({ membership: { plan: plan._id, status: 'draft' } });
    const nominee = {
      fullName: 'Robin Nominee',
      gender: 'prefer_not_to_say',
      relationship: 'Nominee',
      memberType: 'nominee',
      isNominee: true,
      nomineeRole: 'Friend',
      designation: 'Advisor',
      workEmail: 'robin@example.invalid',
      phone: '9876543210',
      dob: '',
    };
    const savedNominee = await addFamilyProfile(member.cookie, nominee);
    expect(savedNominee.status).toBe(201);
    expect(savedNominee.body.data).toMatchObject({
      isNominee: true,
      nomineeRole: 'Friend',
      designation: 'Advisor',
      workEmail: 'robin@example.invalid',
      phone: '9876543210',
      dob: null,
    });

    const corporatePlan = await createFamilyPlan('corporate');
    const corporateMember = await createMember({
      membership: { plan: corporatePlan._id, status: 'draft' },
    });
    const familyResponse = await addFamilyProfile(corporateMember.cookie, {
      ...nominee,
      isNominee: false,
      memberType: 'spouse',
      relationship: 'Spouse',
      dob: '1990-10-14',
    });
    expect(familyResponse.status).toBe(409);

    const addCorporateNominee = (role) => addFamilyProfile(corporateMember.cookie, {
      ...nominee,
      fullName: `${role} Nominee`,
      nomineeRole: role,
      memberType: `nominee_${role.toLowerCase()}`,
    });
    expect((await addCorporateNominee('GM')).status).toBe(201);
    expect((await addCorporateNominee('GM')).status).toBe(409);
    expect((await addCorporateNominee('HR')).status).toBe(201);
    expect(await FamilyMember.countDocuments({ membership: corporateMember.membership._id })).toBe(2);
  });

  test('legacy admin family additions use the configured limits instead of the six-profile cap', async () => {
    const plan = await createFamilyPlan();
    const primary = await createMember({
      membership: { plan: plan._id, status: 'active' },
    });
    const adminId = primary.user._id;
    const profiles = [
      { name: 'Spouse', relation: 'Wife' },
      { name: 'Member father', relation: 'Father', parentSide: 'member', dateOfBirth: '1960-01-01' },
      { name: 'Member mother', relation: 'Mother', parentSide: 'member', dateOfBirth: '1962-01-01' },
      { name: 'Spouse father', relation: 'Father', parentSide: 'spouse', dateOfBirth: '1958-01-01' },
      { name: 'Spouse mother', relation: 'Mother', parentSide: 'spouse', dateOfBirth: '1963-01-01' },
      { name: 'Child one', relation: 'Son', dateOfBirth: '2015-01-01' },
      { name: 'Child two', relation: 'Daughter', dateOfBirth: '2017-01-01' },
    ];

    for (const profile of profiles) {
      await adminAddFamilyMember(adminId, primary.membership._id, profile);
    }

    expect(await FamilyMember.countDocuments({ membership: primary.membership._id })).toBe(7);
  });
});
