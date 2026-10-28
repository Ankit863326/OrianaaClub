import mongoose from 'mongoose';
import FamilyMember from '../models/FamilyMember.js';
import Membership from '../models/Membership.js';
import IdentityVerification from '../models/IdentityVerification.js';
import Verification from '../models/Verification.js';
import PointsLedger from '../models/PointsLedger.js';
import MembershipPlan from '../models/MembershipPlan.js';
import Plan from '../models/Plan.js';
import Payment from '../models/Payment.js';
import PointLedger from '../models/PointLedger.js';
import Redemption from '../models/Redemption.js';
import Setting, { getSettings } from '../models/Setting.js';
import Profile from '../models/Profile.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { formatMemberCode, getMembershipMemberCode, isMemberId } from '../utils/memberCode.js';
import { findMemberMatches } from './member-search.service.js';
import { listMembershipsWithPointsExpiring } from './membership-expiry.service.js';
import { groupFamily } from './family.service.js';
import { hydrateMembershipReferences } from './admin-reference.service.js';

function pagination(query) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

function legacyCodePattern(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 8
    ? new RegExp(`^${digits.split('').join('\\s*')}$`, 'i')
    : /$a/;
}

function familyMemberType(member) {
  if (member.isNominee || member.memberType?.startsWith('nominee')) {
    const role = String(member.nomineeRole || '').toUpperCase();
    return role === 'GM' ? 'nominee_gm' : role === 'HR' ? 'nominee_hr' : 'nominee';
  }
  const relation = String(member.relation || member.relationship || '').toLowerCase();
  if (relation.includes('wife') || relation.includes('husband') || relation === 'spouse') return 'spouse';
  if (relation.includes('father')) return 'father';
  if (relation.includes('mother')) return 'mother';
  if (relation.includes('son') || relation.includes('daughter') || relation === 'child') return 'child';
  return member.memberType || (member.type === 'child' ? 'child' : 'spouse');
}

export async function getMembershipLedger(membershipId, { page = 1, limit = 20, type = '' } = {}) {
  const membership = await Membership.findById(membershipId).select('termNumber').lean();
  if (!membership) throw new ApiError(404, 'Membership was not found.');
  const awardType = membership.termNumber > 1 ? 'credit_renewal' : 'credit_joining';
  const includeAwards = !type || type === awardType;
  const skip = (page - 1) * limit;
  const take = skip + limit;
  const pointFilter = { membership: membershipId, ...(type ? { type } : {}) };
  const awardFilter = { memberId: membershipId };
  const [pointTotal, awardTotal, pointEntries, awardEntries] = await Promise.all([
    PointLedger.countDocuments(pointFilter),
    includeAwards ? PointsLedger.countDocuments(awardFilter) : 0,
    PointLedger.find(pointFilter).sort({ createdAt: -1, _id: -1 }).limit(take).lean(),
    includeAwards
      ? PointsLedger.find(awardFilter).sort({ creditedAt: -1, _id: -1 }).limit(take).lean()
      : [],
  ]);
  const normalizedAwards = awardEntries.map((entry) => ({
    ...entry,
    type: awardType,
    amount: entry.points,
    direction: '+',
    balanceAfter: null,
    note: `Membership approval award · ${entry.phase || 'standard'} rate, sequence ${entry.approvalSeq ?? 'unknown'}.`,
    source: 'approval_award',
    createdAt: entry.creditedAt || entry.createdAt || null,
  }));
  const items = [...pointEntries, ...normalizedAwards]
    .sort((left, right) => {
      const timeDifference = new Date(right.createdAt || 0).getTime()
        - new Date(left.createdAt || 0).getTime();
      return timeDifference || String(right._id).localeCompare(String(left._id));
    })
    .slice(skip, take);
  const total = pointTotal + awardTotal;
  return { items, page, limit, total, pages: Math.ceil(total / limit) };
}

async function listFamilyNominees(query) {
  const { page, limit, skip } = pagination(query);
  const filter = { isNominee: true, status: { $ne: 'removed' } };
  if (query.memberType === 'nominee_gm') filter.nomineeRole = /^GM$/i;
  if (query.memberType === 'nominee_hr') filter.nomineeRole = /^HR$/i;
  if (query.memberType === 'nominee') filter.nomineeRole = { $nin: [/^GM$/i, /^HR$/i] };
  if (query.status) filter.status = query.status;
  if (query.aadhaarPending) return {
    items: [], page, limit, total: 0, pages: 0, tiers: await MembershipPlan.find().select('name').lean(),
  };
  if (query.search) {
    const search = query.search.trim();
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const [exactMembership, exactFamily, matchingProfiles] = await Promise.all([
      Membership.findOne({
        $or: [{ memberNo: search }, { memberCode: search }, { legacyMemberCode: legacyCodePattern(search) }],
      }).select('_id linkedTo').lean(),
      FamilyMember.findOne({ memberNo: search }).select('_id membership').lean(),
      FamilyMember.find({
        isNominee: true,
        $or: [{ name: new RegExp(escaped, 'i') }, { fullName: new RegExp(escaped, 'i') }],
      }).select('_id').lean(),
    ]);
    const ownerId = exactMembership?.linkedTo || exactMembership?._id || exactFamily?.membership;
    const familyIds = [...matchingProfiles.map((member) => member._id), ...(exactFamily ? [exactFamily._id] : [])];
    const searchTerms = [
      ...(ownerId ? [{ membership: ownerId }] : []),
      ...(familyIds.length ? [{ _id: { $in: familyIds } }] : []),
    ];
    filter.$or = searchTerms.length ? searchTerms : [{ _id: { $in: [] } }];
  }
  if (query.tier) {
    const membershipPlans = await MembershipPlan.find().select('_id name').lean();
    const matchingPlanIds = membershipPlans.filter((plan) => (
      String(plan._id) === query.tier
      || String(plan.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') === query.tier.toLowerCase()
    )).map((plan) => plan._id);
    const catalogPlan = /^[a-f\d]{24}$/i.test(query.tier)
      ? null
      : await Plan.findOne({ slug: query.tier.toLowerCase() }).select('_id').lean();
    const tierOwnerIds = await Membership.find({
      $or: [
        ...(matchingPlanIds.length ? [{ plan: { $in: matchingPlanIds }, planModel: 'MembershipPlan' }] : []),
        ...(catalogPlan ? [{ plan: catalogPlan._id, planModel: 'Plan' }] : []),
      ],
    }).distinct('_id');
    filter.membership = { $in: tierOwnerIds };
  }
  if (query.ratePhase) filter._id = { $in: [] };
  const [nominees, total, tiers] = await Promise.all([
    FamilyMember.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'membership',
        populate: [
          { path: 'plan', select: 'name title price' },
          { path: 'user', select: 'firstName email status' },
        ],
      })
      .lean(),
    FamilyMember.countDocuments(filter),
    MembershipPlan.find().select('name').lean(),
  ]);
  const users = nominees.map((item) => item.membership?.user?._id).filter(Boolean);
  const profiles = users.length ? await Profile.find({ user: { $in: users } }).select('user fullName').lean() : [];
  const profileByUser = new Map(profiles.map((profile) => [String(profile.user), profile]));
  return {
    items: nominees.map((item) => ({
      _id: item._id,
      memberNo: '',
      memberCode: '',
      memberType: familyMemberType(item),
      status: item.status || 'pending_approval',
      approvalSeq: item.approvalSeq ?? null,
      pointsBalance: 0,
      pointsMultiplier: null,
      ratePhase: null,
      aadhaarStatus: 'not_applicable',
      primaryMemberNo: getMembershipMemberCode(item.membership) || '',
      nomineeRole: item.nomineeRole || '',
      user: item.membership?.user || null,
      plan: item.membership?.plan || null,
      profile: profileByUser.get(String(item.membership?.user?._id)) || null,
      familyProfile: item,
    })),
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
    tiers,
  };
}

export async function listMembershipPlans() {
  const [items, setting, earlyBirdUsed] = await Promise.all([
    MembershipPlan.find().sort({ sortOrder: 1 }).lean(),
    getSettings(),
    Membership.countDocuments({ earlyBirdApplied: true }),
  ]);
  return {
    items,
    earlyBird: {
      used: earlyBirdUsed,
      limit: setting.earlyBirdLimit,
      remaining: Math.max(0, setting.earlyBirdLimit - earlyBirdUsed),
    },
  };
}

export async function getEarlyBirdCounter() {
  const [setting, used] = await Promise.all([
    getSettings(),
    Membership.countDocuments({ earlyBirdApplied: true }),
  ]);
  return {
    used,
    limit: setting.earlyBirdLimit,
    remaining: Math.max(0, setting.earlyBirdLimit - used),
  };
}

export async function updateMembershipPlan(planId, values) {
  const plan = await MembershipPlan.findByIdAndUpdate(
    planId,
    { $set: values },
    { new: true, runValidators: true },
  );
  if (!plan) throw new ApiError(404, 'Membership plan was not found.');
  return plan;
}

export async function getMembershipSettings() {
  const settings = await getSettings();
  return {
    discountPercent: settings.discountPercent,
    gstEnabled: settings.gstEnabled,
    gstRate: settings.gstRate,
    gstLabel: settings.gstLabel,
    gstin: settings.gstin || '',
    pointsValidityYears: settings.pointsValidityYears,
    membershipValidityYears: settings.membershipValidityYears,
    earlyBirdLimit: settings.earlyBirdLimit,
    familyMembership: settings.familyMembership,
    receiptCompanyName: settings.receiptCompanyName || 'Orianaa by Saptagiri Hospitality & Lifestyle Pvt. Ltd.',
    receiptAddress: settings.receiptAddress || '',
    receiptGstin: settings.receiptGstin || '',
    receiptHsnSac: settings.receiptHsnSac || '',
    receiptFooterNote: settings.receiptFooterNote || '',
  };
}

export async function updateMembershipSettings(values) {
  const settings = await Setting.findById('global');
  if (!settings) throw new Error('Membership settings are not seeded. Run npm run seed:membership.');
  Object.assign(settings, values);
  await settings.save();
  return getMembershipSettings();
}

export async function listMemberships(query) {
  if (query.memberType?.startsWith('nominee')) return listFamilyNominees(query);
  const { page, limit, skip } = pagination(query);
  const familyNumberSearch = /^\d+(?:-(?:S|C\d+|F|M|SF|SM|GM|HR|N\d+))?$/i.test(String(query.search || '').trim());
  const filter = {};
  const filterClauses = [];
  const userFilter = {};
  if (query.status) filter.status = query.status;
  if (query.memberType && !query.memberType.startsWith('nominee')) filter.memberType = query.memberType;
  if (query.ratePhase) {
    const phases = await PointsLedger.find({ phase: query.ratePhase }).distinct('memberId');
    const legacy = await Membership.find(query.ratePhase === 'early_bird'
      ? { $or: [{ earlyBird: true }, { earlyBirdApplied: true }] }
      : { earlyBird: { $ne: true }, earlyBirdApplied: { $ne: true } }).distinct('_id');
    filterClauses.push({ _id: { $in: [...new Set([...phases, ...legacy].map(String))] } });
  }
  if (query.aadhaarPending) {
    const [pendingIdentityUsers, pendingFamilyVerifications] = await Promise.all([
      IdentityVerification.find({ status: 'pending' }).distinct('user'),
      Verification.find({ status: 'pending' }).distinct('memberId'),
    ]);
    const pendingFamilyMemberships = pendingFamilyVerifications.length
      ? await Membership.find({ familyMember: { $in: pendingFamilyVerifications } }).distinct('_id')
      : [];
    const pendingMemberships = await Membership.find({
      $or: [
        { user: { $in: pendingIdentityUsers } },
        { _id: { $in: pendingFamilyMemberships } },
      ],
    }).distinct('_id');
    filter._id = { $in: pendingMemberships };
  }
  if (query.documentsPending) {
    const verifiedUsers = await IdentityVerification.find({ status: 'verified' }).distinct('user');
    userFilter.$nin = verifiedUsers;
    if (!query.status) filter.status = 'pending_verification';
  }
  if (query.notActivated) {
    const pendingUsers = await User.find({ role: 'member', status: 'pending', deletedAt: null }).distinct('_id');
    userFilter.$in = pendingUsers;
  }
  if (Object.keys(userFilter).length) filter.user = userFilter;
  if (query.tier) {
    if (/^[a-f\d]{24}$/i.test(query.tier)) {
      filter.plan = query.tier;
    } else {
      const [catalogPlan, membershipPlans] = await Promise.all([
        Plan.findOne({ slug: query.tier.toLowerCase() }).select('_id').lean(),
        MembershipPlan.find().select('_id name').lean(),
      ]);
      const membershipPlanIds = membershipPlans
        .filter((plan) => String(plan.name || '').toLowerCase()
          .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') === query.tier.toLowerCase())
        .map((plan) => plan._id);
      const planFilters = [
        ...(catalogPlan ? [{ plan: catalogPlan._id, planModel: 'Plan' }] : []),
        ...(membershipPlanIds.length
          ? [{ plan: { $in: membershipPlanIds }, planModel: 'MembershipPlan' }]
          : []),
      ];
      if (planFilters.length) filterClauses.push({ $or: planFilters });
      else filter._id = { $in: [] };
    }
  }
  if (query.search) {
    const matches = await findMemberMatches(query.search);
    const searchCode = String(query.search || '').trim();
    const legacyPattern = legacyCodePattern(searchCode);
    const sequencePattern = /^\d{6,}$/.test(searchCode) && !/^\d{10}$/.test(searchCode)
      ? new RegExp(`^OC-\\d{6}\\d*${searchCode}(?:-(?:S|C\\d+|F|M|SF|SM))?$`, 'i')
      : null;
    const exactMember = await Membership.findOne({
      $or: [
        { memberNo: searchCode },
        { memberCode: searchCode },
        { memberId: searchCode },
        { legacyMemberCode: legacyPattern },
        ...(sequencePattern ? [
          { memberId: sequencePattern },
          { memberCode: sequencePattern },
          { memberNo: sequencePattern },
        ] : []),
      ],
    }).select('_id linkedTo familyMember').lean();
    const exactFamily = await FamilyMember.findOne({
      $or: [
        { memberNo: searchCode },
        { memberId: searchCode },
        { legacyMemberCode: legacyPattern },
        ...(sequencePattern ? [{ memberNo: sequencePattern }, { memberId: sequencePattern }] : []),
      ],
    }).select('_id membership').lean();
    const anchorIds = [
      ...matches.memberships.map((membership) => membership._id),
      ...(exactMember ? [exactMember._id] : []),
    ];
    const anchor = exactMember?.linkedTo
      ? await Membership.findById(exactMember.linkedTo).select('_id').lean()
      : exactFamily?.membership
        ? await Membership.findById(exactFamily.membership).select('_id').lean()
        : null;
    const primaryIds = new Set([
      ...anchorIds.map(String),
      ...(anchor ? [String(anchor._id)] : []),
    ]);
    if (primaryIds.size) {
      const primaryObjectIds = [...primaryIds];
      const familyProfiles = await FamilyMember.find({ membership: { $in: primaryObjectIds } }).select('_id').lean();
      const linkedMemberships = await Membership.find({
        $or: [
          { _id: { $in: primaryObjectIds } },
          { linkedTo: { $in: primaryObjectIds } },
          { familyMember: { $in: familyProfiles.map((item) => item._id) } },
        ],
      }).distinct('_id');
      filterClauses.push({ _id: { $in: linkedMemberships } });
    } else {
      filterClauses.push({ _id: { $in: [] } });
    }
  }
  if (filterClauses.length) filter.$and = filterClauses;
  let membershipsQuery = Membership.find(filter).sort({ createdAt: -1 });
  if (!familyNumberSearch) membershipsQuery = membershipsQuery.skip(skip).limit(limit);
  const [rawMemberships, total, plans] = await Promise.all([
    membershipsQuery.lean(),
    Membership.countDocuments(filter),
    MembershipPlan.find().select('name').lean(),
  ]);
  const memberships = await hydrateMembershipReferences(rawMemberships);
  const ids = memberships.map((membership) => membership.user?._id).filter(Boolean);
  const familyIds = memberships.map((membership) => membership.familyMember).filter(Boolean);
  const primaryPageIds = memberships.filter((membership) => membership.memberType === 'primary').map((membership) => membership._id);
  const [profiles, familyProfiles, identityRows, familyVerifications, ledgerRows, settings] = await Promise.all([
    Profile.find({ user: { $in: ids } }).select('user fullName mobile').lean(),
    (familyIds.length || primaryPageIds.length) ? FamilyMember.find({
      $or: [
        ...(familyIds.length ? [{ _id: { $in: familyIds } }] : []),
        ...(primaryPageIds.length ? [{ membership: { $in: primaryPageIds }, isNominee: true, status: { $ne: 'removed' } }] : []),
      ],
    }).select('name fullName relation relationship nomineeRole isNominee memberType parentSide memberNo status approvalSeq discountPct baseAmount gstAmount totalPaid membership').lean() : [],
    ids.length ? IdentityVerification.find({ user: { $in: ids } }).select('user status').lean() : [],
    familyIds.length ? Verification.find({ memberId: { $in: familyIds } }).select('memberId status').lean() : [],
    PointsLedger.find({ memberId: { $in: memberships.map((item) => item._id) } })
      .sort({ creditedAt: -1 }).select('memberId phase multiplier').lean(),
    getSettings(),
  ]);
  const profileByUser = new Map(profiles.map((profile) => [String(profile.user), profile]));
  const familyById = new Map(familyProfiles.map((profile) => [String(profile._id), profile]));
  const identityByUser = new Map(identityRows.map((record) => [String(record.user), record.status]));
  const verificationByMember = new Map(familyVerifications.map((record) => [String(record.memberId), record.status]));
  const ledgerByMember = new Map();
  for (const row of ledgerRows) {
    if (!ledgerByMember.has(String(row.memberId))) ledgerByMember.set(String(row.memberId), row);
  }
  const primaryCodes = new Map();
  const linkedIds = [...new Set(memberships.map((item) => item.linkedTo).filter(Boolean).map(String))];
  if (linkedIds.length) {
    const linked = await Membership.find({ _id: { $in: linkedIds } }).select('_id memberCode memberNo memberNumber').lean();
    linked.forEach((item) => primaryCodes.set(String(item._id), getMembershipMemberCode(item)));
  }
  const primaryCodesForFamily = memberships
    .filter((item) => item.memberType === 'primary')
    .map((item) => [String(item._id), getMembershipMemberCode(item)]);
  primaryCodesForFamily.forEach(([id, code]) => primaryCodes.set(id, code));
  const items = memberships.map((membership) => ({
    ...membership,
    brokenReferences: [
      ...membership.brokenReferences,
      ...(membership.user && !profileByUser.has(String(membership.user._id)) ? ['profile'] : []),
    ],
    applicationState: membership.user?.status === 'active' ? 'Active'
      : membership.status === 'draft' ? 'Draft'
        : membership.status === 'pending_payment' ? 'Payment pending'
          : ['active', 'pending_verification'].includes(membership.status) ? 'Paid'
            : 'Password not set',
    memberCode: getMembershipMemberCode(membership),
    formattedMemberCode: getMembershipMemberCode(membership)
      ? formatMemberCode(getMembershipMemberCode(membership))
      : '',
    profile: profileByUser.get(String(membership.user?._id)) || null,
    memberType: membership.memberType || 'primary',
    familyProfile: familyById.get(String(membership.familyMember)) || null,
    primaryMemberNo: primaryCodes.get(String(membership.linkedTo || membership._id)) || '',
    aadhaarStatus: membership.familyMember
      ? verificationByMember.get(String(membership.familyMember)) || 'not_added'
      : identityByUser.get(String(membership.user?._id)) || 'not_added',
    ratePhase: membership.memberType?.startsWith('nominee')
      ? null
      : ledgerByMember.get(String(membership._id))?.phase
        || (membership.earlyBird || membership.earlyBirdApplied ? 'early_bird' : 'default'),
    pointsMultiplier: membership.memberType?.startsWith('nominee')
      ? null
      : ledgerByMember.get(String(membership._id))?.multiplier
        ?? (membership.earlyBird || membership.earlyBirdApplied
          ? settings.familyMembership?.multipliers?.earlyBird
          : settings.familyMembership?.multipliers?.default),
      parentSide: familyById.get(String(membership.familyMember))?.parentSide || membership.parentSide || null,
  }));
  const representedFamilyIds = new Set(memberships.map((membership) => String(membership.familyMember || '')).filter(Boolean));
  const primaryById = new Map(memberships.map((membership) => [String(membership._id), membership]));
  const nomineeItems = familyProfiles
    .filter((profile) => profile.isNominee && !representedFamilyIds.has(String(profile._id)))
    .filter((profile) => !query.memberType || !query.memberType.startsWith('nominee')
      || familyMemberType(profile) === query.memberType)
    .map((profile) => {
      const owner = primaryById.get(String(profile.membership));
      if (!owner) return null;
      return {
        _id: profile._id,
        memberNo: '',
        memberCode: '',
        memberType: familyMemberType(profile),
        status: profile.status || 'pending_approval',
        approvalSeq: profile.approvalSeq ?? null,
        pointsBalance: 0,
        pointsMultiplier: null,
        ratePhase: null,
        aadhaarStatus: 'not_applicable',
        primaryMemberNo: getMembershipMemberCode(owner) || '',
        nomineeRole: profile.nomineeRole || '',
        user: owner.user,
        plan: owner.plan,
        profile: profileByUser.get(String(owner.user?._id)) || null,
        familyProfile: profile,
      };
    }).filter(Boolean);
  const listedItems = query.memberType?.startsWith('nominee')
    ? nomineeItems
    : [...items, ...nomineeItems];
  return {
    items: listedItems,
    page: familyNumberSearch ? 1 : page,
    limit,
    total: total + nomineeItems.length,
    pages: familyNumberSearch ? 1 : Math.ceil((total + nomineeItems.length) / limit),
    tiers: plans,
  };
}

export async function getFamilyTree(memberNo) {
  const search = String(memberNo || '').trim();
  const exactMembership = await Membership.findOne({
    $or: [{ memberNo: search }, { memberCode: search }, { legacyMemberCode: legacyCodePattern(search) }],
  }).lean();
  const exactProfile = exactMembership
    ? null
    : await FamilyMember.findOne({ memberNo: search }).select('membership').lean();
  const primaryId = exactMembership?.memberType === 'primary'
    ? exactMembership._id
    : exactMembership?.linkedTo || exactProfile?.membership || exactMembership?._id;
  const rawPrimary = mongoose.isValidObjectId(primaryId)
    ? await Membership.findById(primaryId).lean()
    : null;
  const [primary] = await hydrateMembershipReferences(rawPrimary ? [rawPrimary] : []);
  if (!primary || primary.memberType && primary.memberType !== 'primary') {
    throw new ApiError(404, 'Family membership was not found.');
  }

  const [profile, familyProfiles, rawLinkedMemberships, settings] = await Promise.all([
    primary.user?._id ? Profile.findOne({ user: primary.user._id }).select('fullName').lean() : null,
    FamilyMember.find({ membership: primary._id, isPrimary: { $ne: true }, status: { $ne: 'removed' } })
      .sort({ createdAt: 1, _id: 1 }).lean(),
    Membership.find({ $or: [{ _id: primary._id }, { linkedTo: primary._id }] }).lean(),
    getSettings(),
  ]);
  const linkedMemberships = await hydrateMembershipReferences(rawLinkedMemberships);
  const profileIds = familyProfiles.map((item) => item._id);
  const [verifications, points, identity] = await Promise.all([
    profileIds.length ? Verification.find({ memberId: { $in: profileIds } }).select('memberId status').lean() : [],
    PointsLedger.find({ memberId: { $in: linkedMemberships.map((item) => item._id) } })
      .sort({ creditedAt: -1 }).lean(),
    primary.user?._id ? IdentityVerification.findOne({ user: primary.user._id }).select('status').lean() : null,
  ]);
  const membershipByProfile = new Map(linkedMemberships.filter((item) => item.familyMember)
    .map((item) => [String(item.familyMember), item]));
  const verificationByProfile = new Map(verifications.map((item) => [String(item.memberId), item.status]));
  const latestLedger = new Map();
  for (const entry of points) {
    if (!latestLedger.has(String(entry.memberId))) latestLedger.set(String(entry.memberId), entry);
  }
  const memberView = (membership, familyProfile = null) => {
    const ledger = latestLedger.get(String(membership._id));
    const nominee = String(membership.memberType || '').startsWith('nominee')
      || Boolean(familyProfile?.isNominee);
    return {
      id: String(membership._id),
      familyProfileId: familyProfile ? String(familyProfile._id) : null,
      name: familyProfile?.name || familyProfile?.fullName || profile?.fullName || membership.user?.firstName || 'Member',
      relation: familyProfile?.relation || familyProfile?.relationship || membership.memberType || 'primary',
      anniversaryDate: familyProfile?.anniversaryDate || null,
      memberNo: nominee
        ? ''
        : getMembershipMemberCode(membership)
          || (isMemberId(familyProfile?.memberId || familyProfile?.memberNo)
            ? familyProfile.memberId || familyProfile.memberNo
            : ''),
      memberId: nominee
        ? ''
        : getMembershipMemberCode(membership)
          || (isMemberId(familyProfile?.memberId || familyProfile?.memberNo)
            ? familyProfile.memberId || familyProfile.memberNo
            : ''),
      memberType: membership.memberType || 'primary',
      status: membership.status,
      discountPct: membership.discountPct || 0,
      baseAmount: membership.baseAmount || 0,
      gstAmount: membership.gstAmount || 0,
      totalPaid: membership.totalPaid || 0,
      approvalSeq: membership.approvalSeq,
      ratePhase: nominee ? null : ledger?.phase || (membership.earlyBird ? 'early_bird' : 'default'),
      points: nominee ? null : ledger?.points || membership.pointsBalance || 0,
      aadhaarStatus: familyProfile
        ? verificationByProfile.get(String(familyProfile._id)) || 'not_added'
        : identity?.status || 'not_added',
      nominee,
      nomineeRole: familyProfile?.nomineeRole || membership.nomineeRole || '',
      parentSide: familyProfile?.parentSide || membership.parentSide || null,
      brokenReferences: membership.brokenReferences || [],
      ledger: nominee ? [] : points.filter((entry) => String(entry.memberId) === String(membership._id)),
    };
  };
  const primaryView = memberView(primary);
  const family = familyProfiles.map((item) => {
    const membership = membershipByProfile.get(String(item._id));
    if (membership) return memberView(membership, item);
    return {
      id: String(item._id),
      familyProfileId: String(item._id),
      name: item.name || item.fullName || 'Family member',
      relation: item.relation || item.relationship || item.memberType || 'family',
      anniversaryDate: item.anniversaryDate || null,
      memberNo: item.isNominee
        ? ''
        : (isMemberId(item.memberId || item.memberNo) ? item.memberId || item.memberNo : ''),
      memberType: familyMemberType(item),
      status: item.status === 'active' && !item.isNominee ? 'profile_only' : item.status || 'profile_only',
      discountPct: item.discountPct || 0,
      baseAmount: item.baseAmount || 0,
      gstAmount: item.gstAmount || 0,
      totalPaid: item.totalPaid || 0,
      approvalSeq: item.approvalSeq || null,
      ratePhase: null,
      points: null,
      aadhaarStatus: verificationByProfile.get(String(item._id)) || 'not_added',
      nominee: Boolean(item.isNominee),
      nomineeRole: item.nomineeRole || '',
      parentSide: item.parentSide || null,
      ledger: [],
    };
  });
  const nominees = family.filter((item) => item.nominee || item.memberType?.startsWith('nominee'));
  const members = family.filter((item) => !nominees.includes(item));
  const limits = settings.familyMembership?.limits || {};
  const normalizedTier = String(primary.tier || primary.plan?.slug || primary.plan?.name || '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const tierConfig = settings.familyMembership?.tiers?.find((tier) => tier.tier === normalizedTier
    || (tier.tier === 'corporate' && normalizedTier.includes('corporate')));
  const openSlots = [];
  const countType = (types) => members.filter((item) => types.includes(item.memberType)).length;
  if (tierConfig?.familyEnabled !== false) {
    const spouseMax = Number(limits.spouse ?? 1);
    for (let slot = countType(['spouse']); slot < spouseMax; slot += 1) openSlots.push({ key: `spouse-${slot}`, label: 'Spouse', discountPct: settings.familyMembership?.discounts?.spouse ?? 50 });
    const perSide = Number(limits.parentsPerSide ?? 2);
    for (const side of ['member', 'spouse']) {
      const parentCount = members.filter((item) => ['father', 'mother'].includes(item.memberType)
        && (item.parentSide || 'member') === side).length;
      for (let slot = parentCount; slot < perSide; slot += 1) {
        openSlots.push({
          key: `parent-${side}-${slot}`,
          label: `${side === 'spouse' ? 'Spouse’s' : 'Member’s'} parent`,
          discountPct: settings.familyMembership?.discounts?.parent ?? 50,
        });
      }
    }
    if (limits.children === null) {
      openSlots.push({ key: 'children', label: 'Children', discountPct: settings.familyMembership?.discounts?.child ?? 75 });
    }
  }
  return {
    primary: primaryView,
    family: members,
    nominees,
    openSlots,
  };
}

export async function getMembershipDetails(membershipId) {
  const rawMembership = await Membership.findById(membershipId).lean();
  const [membership] = await hydrateMembershipReferences(rawMembership ? [rawMembership] : []);
  if (!membership) throw new ApiError(404, 'Membership was not found.');
  if (mongoose.isValidObjectId(membership.previousMembership)) {
    membership.previousMembership = await Membership.findById(membership.previousMembership)
      .select('memberCode memberNumber termNumber status').lean();
    if (!membership.previousMembership) membership.brokenReferences.push('previous membership');
  } else if (membership.previousMembership) {
    membership.previousMembership = null;
    membership.brokenReferences.push('previous membership');
  }
  const [profile, family, payments, nominee, settings] = await Promise.all([
    membership.user?._id
      ? Profile.findOne({ user: membership.user._id }).select('fullName mobile dob photoUrl').lean()
      : null,
    FamilyMember.find({ membership: membership._id }).sort({ createdAt: 1 }).lean(),
    Payment.find({ membership: membership._id })
      .select('amount baseAmount gstRate gstEnabled gstLabel gstAmount totalAmount method status reference note createdAt confirmedBy plan planModel')
      .sort({ createdAt: -1 }).lean(),
    mongoose.isValidObjectId(membership.nominee)
      ? FamilyMember.findOne({ _id: membership.nominee, membership: membership._id, status: 'active' })
        .select('name fullName relation relationship type').lean()
      : null,
    getSettings(),
  ]);
  if (membership.nominee && !nominee) membership.brokenReferences.push('nominee');
  const now = new Date();
  const pointsBalance = Number.isSafeInteger(membership.pointsBalance) ? membership.pointsBalance : 0;
  const canRenew = ['active', 'expired'].includes(membership.status)
    && (pointsBalance === 0 || !membership.pointsExpireAt || membership.pointsExpireAt <= now);
  const [plans, recentRedemptions, ledger] = await Promise.all([
    canRenew ? MembershipPlan.find({ isActive: true }).sort({ sortOrder: 1 }).lean() : [],
    Redemption.find({ membership: membership._id }).sort({ createdAt: -1 }).limit(20).lean(),
    getMembershipLedger(membership._id, { limit: 20 }),
  ]);
  const safeDocs = (membership.verificationDocs || []).map((doc) => ({
    id: doc.id,
    originalName: doc.originalName,
    mimeType: doc.mimeType,
    uploadedAt: doc.uploadedAt,
  }));
  return {
    membership: {
      ...membership,
      memberCode: getMembershipMemberCode(membership),
      formattedMemberCode: getMembershipMemberCode(membership)
        ? formatMemberCode(getMembershipMemberCode(membership))
        : '',
      verificationDocs: safeDocs,
      pointsBalance,
    },
    profile,
    family: groupFamily(family),
    payments,
    nominee: nominee ? {
      id: String(nominee._id),
      name: nominee.name || nominee.fullName,
      relation: nominee.relation || nominee.relationship,
      type: nominee.type,
    } : null,
    companyDetails: membership.companyDetails,
    canRenew,
    renewalPlans: plans.map((plan) => ({
      id: String(plan._id),
      name: plan.name,
      price: plan.price,
      renewalPoints: plan.renewalPoints,
    })),
    gstSettings: {
      enabled: settings.gstEnabled,
      rate: settings.gstRate,
      label: settings.gstLabel,
    },
    discountPercent: membership.status === 'active' ? settings.discountPercent : 0,
    redemptions: recentRedemptions,
    ledger: ledger.items,
  };
}

export async function getMembershipQueue(query = {}) {
  const { page, limit, skip } = pagination(query);
  const membershipFilter = { status: { $in: ['pending_verification', 'pending_payment'] } };
  const [rawMemberships, membershipCount, familyRequests] = await Promise.all([
    Membership.find(membershipFilter)
      .sort({ updatedAt: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Membership.countDocuments(membershipFilter),
    FamilyMember.find({ pendingAction: { $in: ['add', 'update', 'remove', 'nominee'] } })
      .sort({ updatedAt: 1 })
      .limit(limit)
      .populate({ path: 'membership', select: 'memberCode memberId memberNumber user', populate: { path: 'user', select: 'firstName' } })
      .lean(),
  ]);
  const memberships = await hydrateMembershipReferences(rawMemberships);

  const profiles = memberships.length
    ? await Profile.find({ user: { $in: memberships.map((membership) => membership.user?._id).filter(Boolean) } })
      .select('user fullName mobile').lean()
    : [];
  const profileByUser = new Map(profiles.map((profile) => [String(profile.user), profile]));
  const payments = await Payment.find({ status: 'pending', membership: { $in: memberships.map((m) => m._id) } })
    .select('_id membership method totalAmount amount reference createdAt')
    .sort({ createdAt: 1 })
    .lean();
  return {
    memberships: memberships.map((membership) => ({
      ...membership,
      profile: profileByUser.get(String(membership.user?._id)) || null,
      brokenReferences: [
        ...membership.brokenReferences,
        ...(membership.user && !profileByUser.has(String(membership.user._id)) ? ['profile'] : []),
      ],
      memberCode: getMembershipMemberCode(membership),
      memberId: getMembershipMemberCode(membership),
      formattedMemberCode: getMembershipMemberCode(membership)
        ? formatMemberCode(getMembershipMemberCode(membership))
        : '',
    })),
    membershipPagination: { page, limit, total: membershipCount, pages: Math.ceil(membershipCount / limit) },
    payments,
    familyRequests: familyRequests.filter((member) => member.membership).map((member) => ({
      ...member,
      memberId: member.isNominee ? '' : (isMemberId(member.memberId || member.memberNo)
        ? member.memberId || member.memberNo
        : ''),
      membership: member.membership
        ? {
          ...member.membership,
          memberCode: getMembershipMemberCode(member.membership),
        }
        : null,
    })),
  };
}

export async function getMembershipReports() {
  const now = new Date();
  const [issued, redeemed, expiring30, expiring90, paymentMethods, refunds, settings, earlyBirdUsed] = await Promise.all([
    PointLedger.aggregate([
      { $match: { type: { $in: ['credit_joining', 'credit_renewal', 'refund', 'admin_adjust'] }, direction: '+' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    PointLedger.aggregate([
      { $match: { type: 'debit_redeem', direction: '-' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    listMembershipsWithPointsExpiring(30),
    listMembershipsWithPointsExpiring(90),
    Payment.aggregate([
      { $match: { status: { $in: ['confirmed', 'paid'] } } },
      { $group: { _id: '$method', totalAmount: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Redemption.aggregate([
      { $match: { status: 'cancelled' } },
      { $group: { _id: null, refundedPoints: { $sum: '$refundedPoints' }, count: { $sum: 1 } } },
    ]),
    getSettings(),
    Membership.countDocuments({ earlyBirdApplied: true }),
  ]);
  return {
    points: { issued: issued[0]?.total || 0, redeemed: redeemed[0]?.total || 0 },
    expiring30: { count: expiring30.length, totalPoints: expiring30.reduce((sum, item) => sum + item.pointsBalance, 0), items: expiring30 },
    expiring90: { count: expiring90.length, totalPoints: expiring90.reduce((sum, item) => sum + item.pointsBalance, 0), items: expiring90 },
    paymentsByMethod: paymentMethods,
    refunds: refunds[0] || { refundedPoints: 0, count: 0 },
    earlyBird: {
      used: earlyBirdUsed,
      limit: settings.earlyBirdLimit,
      remaining: Math.max(0, settings.earlyBirdLimit - earlyBirdUsed),
    },
    generatedAt: now,
  };
}

function reportDateFilter(from, to, field = 'createdAt') {
  if (!from && !to) return {};
  const range = {};
  if (from) range.$gte = new Date(`${from}T00:00:00.000Z`);
  if (to) range.$lte = new Date(`${to}T23:59:59.999Z`);
  return { [field]: range };
}

async function addMemberNames(memberships) {
  const userIds = [...new Set(
    memberships.filter((membership) => membership.user).map((membership) => String(membership.user)),
  )];
  if (!userIds.length) return memberships.map((membership) => ({ ...membership, memberName: '—' }));
  const [profiles, users] = await Promise.all([
    Profile.find({ user: { $in: userIds } }).select('user fullName').lean(),
    User.find({ _id: { $in: userIds } }).select('firstName email').lean(),
  ]);
  const profileByUser = new Map(profiles.map((profile) => [String(profile.user), profile]));
  const userById = new Map(users.map((user) => [String(user._id), user]));
  return memberships.map((membership) => {
    const id = String(membership.user);
    const profile = profileByUser.get(id);
    const user = userById.get(id);
    return {
      ...membership,
      memberName: profile?.fullName || user?.firstName || user?.email || '—',
    };
  });
}

export async function getMembershipOperationsReport(query = {}) {
  const [
    pointTotals,
    pointsRedeemedByChannel,
    expiring30,
    expiring90,
    paymentsByMethod,
    cancellations,
    settings,
    earlyBirdUsed,
  ] = await Promise.all([
    PointLedger.aggregate([
      { $match: {
        ...reportDateFilter(query.from, query.to),
        type: { $in: ['credit_joining', 'credit_renewal', 'debit_redeem', 'expire', 'admin_adjust'] },
      } },
      { $group: { _id: { type: '$type', direction: '$direction' }, total: { $sum: '$amount' } } },
    ]),
    Redemption.aggregate([
      { $match: reportDateFilter(query.from, query.to) },
      {
        $group: {
          _id: { $ifNull: ['$channel', 'billing_counter'] },
          count: { $sum: 1 },
          totalPoints: { $sum: '$pointsUsed' },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    listMembershipsWithPointsExpiring(30),
    listMembershipsWithPointsExpiring(90),
    Payment.aggregate([
      { $match: {
        ...reportDateFilter(query.from, query.to),
        status: { $in: ['confirmed', 'paid'] },
      } },
      { $group: { _id: '$method', totalAmount: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Redemption.aggregate([
      { $match: {
        status: 'cancelled',
        ...reportDateFilter(query.from, query.to, 'cancelledAt'),
      } },
      { $group: { _id: null, refundedPoints: { $sum: '$refundedPoints' }, count: { $sum: 1 } } },
    ]),
    getSettings(),
    Membership.countDocuments({ earlyBirdApplied: true }),
  ]);

  const totalFor = (type, direction) => pointTotals
    .find((item) => item._id.type === type && item._id.direction === direction)?.total || 0;
  const expiringMembers = await addMemberNames([...expiring30, ...expiring90]);
  const byId = new Map(expiringMembers.map((membership) => [String(membership._id), membership]));

  return {
    points: {
      issued: ['credit_joining', 'credit_renewal', 'admin_adjust']
        .reduce((sum, type) => sum + totalFor(type, '+'), 0),
      redeemed: totalFor('debit_redeem', '-'),
      expired: totalFor('expire', '-'),
    },
    pointsRedeemedByChannel,
    expiring30: {
      count: expiring30.length,
      totalPoints: expiring30.reduce((sum, item) => sum + item.pointsBalance, 0),
      items: expiring30.map((item) => byId.get(String(item._id))),
    },
    expiring90: {
      count: expiring90.length,
      totalPoints: expiring90.reduce((sum, item) => sum + item.pointsBalance, 0),
      items: expiring90.map((item) => byId.get(String(item._id))),
    },
    earlyBird: {
      used: earlyBirdUsed,
      limit: settings.earlyBirdLimit,
      remaining: Math.max(0, settings.earlyBirdLimit - earlyBirdUsed),
    },
    paymentsByMethod,
    cancellations: cancellations[0] || { count: 0, refundedPoints: 0 },
    generatedAt: new Date(),
    range: { from: query.from || null, to: query.to || null },
  };
}

export async function createRenewal(adminId, membershipId, { planId, paymentMethod, companyDetails }) {
  const membership = await Membership.findById(membershipId).select('user status');
  if (!membership) throw new ApiError(404, 'Membership was not found.');
  return (await import('./payment.service.js')).renewMembership(
    membership.user,
    { planId, paymentMethod, companyDetails },
  );
}

export { formatMemberCode };
