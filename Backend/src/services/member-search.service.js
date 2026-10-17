import Membership from '../models/Membership.js';
import '../models/MembershipPlan.js';
import '../models/Plan.js';
import Profile from '../models/Profile.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { getMembershipMemberCode } from '../utils/memberCode.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isObjectId = (value) => /^[a-f\d]{24}$/i.test(value);

function codeMemberNumber(value) {
  if (!/^2651\d{8}$/.test(value)) return '';
  const number = Number(value.slice(4)) - 10100000;
  return Number.isSafeInteger(number) && number > 0 ? String(number) : '';
}

function membershipPriority(membership) {
  return {
    active: 0,
    pending_verification: 1,
    pending_payment: 2,
    draft: 3,
    expired: 4,
    cancelled: 5,
  }[membership.status] ?? 6;
}

export async function findMemberMatches(value) {
  const search = String(value || '').trim();
  if (!search) return { people: [], memberships: [] };

  const normalized = search.replace(/[\s-]/g, '');
  const databaseId = isObjectId(search);
  const memberId = /^\d{12}$/.test(normalized);
  const phoneNumber = /^\d{10}$/.test(normalized);
  const expectedMemberNumber = memberId ? codeMemberNumber(normalized) : '';
  const escaped = escapeRegex(search);
  const directMembershipFilters = [
    ...(databaseId ? [{ _id: search }] : []),
    ...(memberId
      ? [
        { memberCode: normalized },
        { memberNumber: normalized },
        ...(expectedMemberNumber ? [{ memberNumber: expectedMemberNumber }] : []),
      ]
      : []),
  ];

  const [nameOrEmailUsers, profilesByText, profilesByPhone, directMemberships, directUser] = await Promise.all([
    !databaseId && !memberId && !phoneNumber
      ? User.find({
        role: 'member',
        deletedAt: null,
        $or: [{ firstName: new RegExp(escaped, 'i') }, { email: new RegExp(escaped, 'i') }],
      }).select('_id').lean()
      : [],
    !databaseId && !memberId && !phoneNumber
      ? Profile.find({ fullName: new RegExp(escaped, 'i') }).select('user').lean()
      : [],
    phoneNumber
      ? Profile.find({
        $or: [
          { mobile: new RegExp(escapeRegex(normalized), 'i') },
          { mobile: { $regex: `${escapeRegex(normalized)}$` } },
        ],
      }).select('user').lean()
      : [],
    directMembershipFilters.length
      ? Membership.find({ $or: directMembershipFilters }).lean()
      : [],
    databaseId
      ? User.findOne({ _id: search, role: 'member', deletedAt: null }).select('_id').lean()
      : null,
  ]);

  const userIds = new Set([
    ...nameOrEmailUsers.map((user) => String(user._id)),
    ...profilesByText.map((profile) => String(profile.user)),
    ...profilesByPhone.map((profile) => String(profile.user)),
    ...(directUser ? [String(directUser._id)] : []),
  ]);
  for (const membership of directMemberships) {
    const userId = membership.user || membership.customer;
    if (userId) userIds.add(String(userId));
  }

  const membershipFilters = [
    ...(userIds.size ? [{ user: { $in: [...userIds] } }, { customer: { $in: [...userIds] } }] : []),
    ...(directMemberships.length ? [{ _id: { $in: directMemberships.map((item) => item._id) } }] : []),
  ];
  const matchingMemberships = membershipFilters.length
    ? await Membership.find({ $or: membershipFilters }).populate('plan').lean()
    : [];

  const membershipsByUser = new Map();
  matchingMemberships.sort((left, right) => (
    membershipPriority(left) - membershipPriority(right)
      || new Date(right.createdAt || 0) - new Date(left.createdAt || 0)
  ));
  const exactMembership = databaseId
    ? matchingMemberships.find((membership) => String(membership._id) === search)
    : null;
  if (exactMembership) {
    const userId = String(exactMembership.user || exactMembership.customer || exactMembership._id);
    membershipsByUser.set(userId, exactMembership);
  }
  for (const membership of matchingMemberships) {
    const userId = String(membership.user?._id || membership.customer || membership.user || membership._id);
    if (!membershipsByUser.has(userId)) membershipsByUser.set(userId, membership);
  }

  const peopleIds = new Set([...userIds, ...[...membershipsByUser.values()]
    .map((membership) => String(membership.user?._id || membership.customer || membership.user || ''))
    .filter(Boolean)]);
  const people = await User.find({ _id: { $in: [...peopleIds] }, role: 'member', deletedAt: null })
    .select('firstName email status')
    .lean();

  return {
    people,
    memberships: [...membershipsByUser.values()].map((membership) => ({
      ...membership,
      memberCode: getMembershipMemberCode(membership),
    })),
  };
}

export function memberSearchError(matches) {
  return new ApiError(
    404,
    matches.people.length ? 'This member has no membership yet' : 'No member found',
  );
}
