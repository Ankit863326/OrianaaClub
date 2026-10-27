import Membership from '../models/Membership.js';
import '../models/MembershipPlan.js';
import '../models/Plan.js';
import Profile from '../models/Profile.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { getMembershipMemberCode } from '../utils/memberCode.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isObjectId = (value) => /^[a-f\d]{24}$/i.test(value);
const legacyCodeSearch = (value) => {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 8
    ? new RegExp(`^${digits.split('').map(escapeRegex).join('\\s*')}$`, 'i')
    : null;
};

function sequenceSearch(value) {
  const digits = value.replace(/\D/g, '');
  if (!/^\d{6,}$/.test(digits) || /^\d{10}$/.test(digits)) return null;
  return new RegExp(`^OC-\\d{6}\\d*${digits}(?:-(?:S|C\\d+|F|M|SF|SM))?$`, 'i');
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

  const normalized = search.toUpperCase().replace(/[\s-]/g, '');
  const databaseId = isObjectId(search);
  const phoneNumber = /^\d{10}$/.test(normalized);
  const sequencePattern = sequenceSearch(search);
  const memberIdSearch = normalized.startsWith('OC') || Boolean(sequencePattern);
  const legacyPattern = legacyCodeSearch(search);
  const escaped = escapeRegex(search);
  const directMembershipFilters = [
    ...(databaseId ? [{ _id: search }] : []),
    ...(memberIdSearch || legacyPattern
      ? [
        { memberCode: search },
        { memberNo: search },
        { memberId: search },
        { memberCode: normalized },
        { memberNo: normalized },
        { memberId: normalized },
        ...(sequencePattern ? [
          { memberId: sequencePattern },
          { memberCode: sequencePattern },
          { memberNo: sequencePattern },
        ] : []),
        ...(legacyPattern ? [{ legacyMemberCode: legacyPattern }] : []),
      ]
      : []),
  ];

  const codeFamilyFilter = memberIdSearch || legacyPattern
    ? { $or: [
      { memberNo: { $in: [search, normalized] } },
      { memberId: { $in: [search, normalized] } },
      ...(sequencePattern ? [{ memberNo: sequencePattern }, { memberId: sequencePattern }] : []),
      ...(legacyPattern ? [{ legacyMemberCode: legacyPattern }] : []),
    ] }
    : null;
  const [nameOrEmailUsers, profilesByText, profilesByPhone, directMemberships, directFamilyMembers, directUser] = await Promise.all([
    !databaseId && !memberIdSearch && !phoneNumber && !legacyPattern
      ? User.find({
        role: 'member',
        deletedAt: null,
        $or: [{ firstName: new RegExp(escaped, 'i') }, { email: new RegExp(escaped, 'i') }],
      }).select('_id').lean()
      : [],
    !databaseId && !memberIdSearch && !phoneNumber && !legacyPattern
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
    codeFamilyFilter
      ? FamilyMember.find(codeFamilyFilter).select('membership').lean()
      : [],
    databaseId
      ? User.findOne({ _id: search, role: 'member', deletedAt: null }).select('_id').lean()
      : null,
  ]);

  const familyOwners = directFamilyMembers.length
    ? await Membership.find({
      _id: { $in: directFamilyMembers.map((member) => member.membership) },
    }).lean()
    : [];
  directMemberships.push(...familyOwners);

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
