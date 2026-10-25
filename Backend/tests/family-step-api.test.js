import { createHash, randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../src/app.js';
import FamilyMember from '../src/models/FamilyMember.js';
import MembershipDraft from '../src/models/MembershipDraft.js';
import MembershipPlan from '../src/models/MembershipPlan.js';
import Setting from '../src/models/Setting.js';
import { createMember, createPlan } from './helpers/factories.js';
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
