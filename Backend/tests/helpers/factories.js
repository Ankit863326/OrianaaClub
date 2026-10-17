import bcrypt from 'bcryptjs';
import { signAccessToken, signAdminAccessToken } from '../../src/services/token.service.js';
import User from '../../src/models/User.js';
import Profile from '../../src/models/Profile.js';
import Plan from '../../src/models/Plan.js';
import Membership from '../../src/models/Membership.js';

let nextMember = 1;

export async function createMember(overrides = {}) {
  const { profile: profileValues = {}, membership: membershipValues = {}, ...userValues } = overrides;
  const user = await User.create({
    firstName: 'Test',
    email: `member${nextMember++}@example.invalid`,
    passwordHash: await bcrypt.hash('TestPassword123', 4),
    role: 'member',
    status: 'active',
    emailVerified: true,
    ...userValues,
  });
  const profile = await Profile.create({
    user: user._id,
    fullName: user.firstName,
    gender: 'other',
    countryCode: '+91',
    mobile: '9000000000',
    dob: new Date('1998-10-14T00:00:00.000Z'),
    interestArea: 'Travel',
    ...profileValues,
  });

  let membership = null;
  if (membershipValues.plan) {
    membership = await Membership.create({ user: user._id, ...membershipValues });
  }
  return {
    user,
    profile,
    membership,
    cookie: `oc_access=${signAccessToken(user._id)}`,
  };
}

export async function createAdmin(overrides = {}) {
  const user = await User.create({
    firstName: 'Admin',
    email: `admin${nextMember++}@example.invalid`,
    passwordHash: await bcrypt.hash('AdminPassword123', 4),
    role: 'admin',
    status: 'active',
    emailVerified: true,
    ...overrides,
  });
  return {
    user,
    cookie: `oc_admin_access=${signAdminAccessToken(user._id)}`,
    memberCookie: `oc_access=${signAccessToken(user._id)}`,
  };
}

export async function createPlan(overrides = {}) {
  const number = nextMember++;
  return Plan.create({
    id: `test-plan-${number}`,
    slug: `test-plan-${number}`,
    title: 'Test Plan',
    name: 'Test Plan',
    subtitle: '3 Lakhs Standard',
    price: 300000,
    numericPrice: 300000,
    planFee: 254237,
    gst: 45763,
    legacyCheckoutPayable: 300000,
    isActive: true,
    displayOrder: number,
    ...overrides,
  });
}

export async function seedData() {
  const plan = await createPlan();
  const member = await createMember({ membership: { plan: plan._id, status: 'active' } });
  const admin = await createAdmin();
  return { plan, member, admin };
}
