import FamilyMember from '../models/FamilyMember.js';
import Membership from '../models/Membership.js';
import Verification from '../models/Verification.js';
import { DEFAULT_FAMILY_MEMBERSHIP_CONFIG, getSettings } from '../models/Setting.js';
import { getFamilyTier } from './family-tier.service.js';
import ApiError from '../utils/ApiError.js';

function decimalRatio(value, label) {
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative number.`);
  }
  const [coefficient, exponentText = '0'] = String(value).toLowerCase().split('e');
  const exponent = Number(exponentText);
  const [whole, fraction = ''] = coefficient.split('.');
  let numerator = BigInt(`${whole}${fraction}`);
  let denominator = 10n ** BigInt(fraction.length);
  if (exponent > 0) numerator *= 10n ** BigInt(exponent);
  if (exponent < 0) denominator *= 10n ** BigInt(-exponent);
  return { numerator, denominator };
}

function roundHalfUpRatio(numerator, denominator) {
  if (numerator < 0n || denominator <= 0n) throw new RangeError('Invalid amount ratio.');
  const value = (numerator * 2n + denominator) / (denominator * 2n);
  const result = Number(value);
  if (!Number.isSafeInteger(result)) throw new RangeError('Amount exceeds the supported rupee range.');
  return result;
}

function roundAmount(amount, multiplier, label) {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new TypeError(`${label} must be a non-negative whole number of rupees.`);
  }
  const { numerator, denominator } = decimalRatio(multiplier, label);
  return roundHalfUpRatio(BigInt(amount) * numerator, denominator * 100n);
}

function tierConfig(plan, tiers) {
  const tier = getFamilyTier(plan, tiers);
  if (!tier) throw new ApiError(400, 'A supported membership tier is required.');
  return tier;
}

function isNominee(memberType) {
  return ['nominee', 'nominee_gm', 'nominee_hr'].includes(memberType);
}

function memberTypeOf(member) {
  if (member.isNominee || ['nominee', 'nominee_gm', 'nominee_hr'].includes(member.memberType)) {
    return ['nominee_gm', 'nominee_hr'].includes(member.memberType) ? member.memberType : 'nominee';
  }
  const relation = String(member.relation || member.relationship || '').toLowerCase();
  if (relation === 'spouse' || relation === 'wife' || relation === 'husband') return 'spouse';
  if (relation === 'father' || relation === 'mother') return relation;
  if (member.type === 'child' || relation === 'child' || relation === 'son' || relation === 'daughter') {
    return 'child';
  }
  return ['spouse', 'child', 'father', 'mother'].includes(member.memberType) ? member.memberType : '';
}

function activeFamilyMember(member) {
  return [
    'active',
    'pending_approval',
    'profile_only',
    'payment_pending',
    'draft',
    'pending_payment',
    'pending_verification',
  ].includes(member.status)
    && member.pendingAction !== 'remove';
}

function otherRelatedMembers(related, member) {
  const memberId = member._id || member.memberId;
  return memberId
    ? related.filter((item) => (
      String(item._id) !== String(memberId)
      && String(item.familyMember || '') !== String(memberId)
    ))
    : related;
}

async function existingRelatedMembers(primaryId, session) {
  let familyQuery = FamilyMember.find({
    membership: primaryId,
    status: { $in: ['active', 'payment_pending', 'pending_approval'] },
    pendingAction: { $ne: 'remove' },
  }).lean();
  let membershipQuery = Membership.find({
    linkedTo: primaryId,
    status: { $ne: 'cancelled' },
  }).lean();
  if (session) {
    familyQuery = familyQuery.session(session);
    membershipQuery = membershipQuery.session(session);
  }
  const [family, linked] = await Promise.all([familyQuery, membershipQuery]);
  return [...family, ...linked];
}

function validateChildAge(dob, purchaseDate, maxAge) {
  if (!dob || Number.isNaN(new Date(dob).getTime())) {
    throw new ApiError(400, 'A valid date of birth is required for a child membership.');
  }
  const birth = new Date(dob);
  const purchase = new Date(purchaseDate);
  if (Number.isNaN(purchase.getTime())) throw new TypeError('Purchase date must be valid.');
  let age = purchase.getUTCFullYear() - birth.getUTCFullYear();
  const birthdayNotReached = purchase.getUTCMonth() < birth.getUTCMonth()
    || (purchase.getUTCMonth() === birth.getUTCMonth()
      && purchase.getUTCDate() < birth.getUTCDate());
  if (birthdayNotReached) age -= 1;
  if (age > maxAge) {
    throw new ApiError(409, 'This child is over the eligible age and needs own membership.');
  }
}

function nomineeRoleFor(member, memberType) {
  if (memberType === 'nominee_gm') return 'GM';
  if (memberType === 'nominee_hr') return 'HR';
  return String(member.nomineeRole || '').trim();
}

function validateNominee({ member, memberType, tier, related }) {
  if (!tier.nomineesEnabled) throw new ApiError(409, 'Nominees are not enabled for this membership tier.');
  if (tier.nomineeRoles === 'free_text' && memberType !== 'nominee') {
    throw new ApiError(400, 'Use a free-text nominee role for this membership tier.');
  }
  const role = nomineeRoleFor(member, memberType);
  if (Array.isArray(tier.nomineeRoles)) {
    if (!tier.nomineeRoles.includes(role)) {
      throw new ApiError(400, `Nominee role must be one of: ${tier.nomineeRoles.join(', ')}.`);
    }
  } else if (tier.nomineeRoles === 'free_text' && !role) {
    throw new ApiError(400, 'A nominee role is required.');
  }

  const nominees = related.filter((item) => activeFamilyMember(item)
    && isNominee(memberTypeOf(item)));
  if (nominees.length >= tier.maxNominees) {
    throw new ApiError(409, `This tier allows up to ${tier.maxNominees} nominees.`);
  }
  if (Array.isArray(tier.nomineeRoles) && nominees.some((item) => (
    nomineeRoleFor(item, memberTypeOf(item)) === role
  ))) {
    throw new ApiError(409, `A ${role} nominee is already registered.`);
  }
  return role;
}

export async function calculateMemberPrice({
  plan,
  member = {},
  memberType = memberTypeOf(member) || 'primary',
  parentSide = member.parentSide,
  dob = member.dob,
  purchaseDate = new Date(),
  linkedPrimary,
  session,
  settings: suppliedSettings,
} = {}) {
  if (!plan) throw new ApiError(400, 'A membership plan is required.');
  const basePrice = Number(plan.price ?? plan.numericPrice);
  if (!Number.isSafeInteger(basePrice) || basePrice < 0) {
    throw new ApiError(400, 'The plan base price must be a whole number of rupees.');
  }

  const settings = suppliedSettings || await getSettings({ forceRefresh: true });
  const config = settings.familyMembership || DEFAULT_FAMILY_MEMBERSHIP_CONFIG;
  const limits = { ...DEFAULT_FAMILY_MEMBERSHIP_CONFIG.limits, ...config.limits };
  const tier = tierConfig(plan, config.tiers);
  let discountPct = 0;

  if (isNominee(memberType)) {
    if (!linkedPrimary || linkedPrimary.status !== 'active') {
      throw new ApiError(409, 'The linked primary membership must be active.');
    }
    const related = otherRelatedMembers(
      await existingRelatedMembers(linkedPrimary._id, session),
      member,
    );
    validateNominee({ member, memberType, tier, related });
    return { baseAmount: 0, gstAmount: 0, totalPayable: 0, discountPct: 0 };
  }

  if (memberType !== 'primary') {
    if (!linkedPrimary || linkedPrimary.status !== 'active') {
      throw new ApiError(409, 'The linked primary membership must be active.');
    }
    if (!tier.familyEnabled) {
      throw new ApiError(409, 'Family memberships are not enabled for this tier.');
    }
    const familyMemberId = member._id || member.memberId;
    if (familyMemberId) {
      let verificationQuery = Verification.findOne({ memberId: familyMemberId }).select('status');
      if (session) verificationQuery = verificationQuery.session(session);
      const verification = await verificationQuery.lean();
      if (verification?.status !== 'verified') {
        throw new ApiError(409, 'Family verification must be approved before the family rate is available.');
      }
    }

    const related = otherRelatedMembers(
      await existingRelatedMembers(linkedPrimary._id, session),
      member,
    );
    const relatives = related.filter((item) => activeFamilyMember(item)
      && !isNominee(memberTypeOf(item)));
    const memberTypeCounts = relatives.map(memberTypeOf);

    if (memberType === 'spouse') {
      if (memberTypeCounts.filter((type) => type === 'spouse').length >= limits.spouse) {
        throw new ApiError(409, `A membership allows up to ${limits.spouse} spouse.`);
      }
      discountPct = config.discounts.spouse;
    } else if (memberType === 'father' || memberType === 'mother') {
      if (!['member', 'spouse'].includes(parentSide)) {
        throw new ApiError(400, 'Parent side must be either member or spouse.');
      }
      const parentCount = relatives.filter((item) => ['father', 'mother'].includes(memberTypeOf(item)));
      if (limits.parents != null && parentCount.length >= limits.parents) {
        throw new ApiError(409, `A membership allows up to ${limits.parents} parents.`);
      }
      const sideCount = parentCount.filter((item) => item.parentSide === parentSide).length;
      if (limits.parentsPerSide != null && sideCount >= limits.parentsPerSide) {
        throw new ApiError(409, `A maximum of ${limits.parentsPerSide} parents is allowed per side.`);
      }
      discountPct = config.discounts.parent;
    } else if (memberType === 'child') {
      validateChildAge(dob, purchaseDate, config.childMaxAge);
      const maxChildren = limits.children;
      if (maxChildren != null && memberTypeCounts.filter((type) => type === 'child').length >= maxChildren) {
        throw new ApiError(409, `A membership allows up to ${maxChildren} children.`);
      }
      discountPct = config.discounts.child;
    } else {
      throw new ApiError(400, 'The requested family member type is not supported.');
    }
  }

  const baseAmount = roundHalfUpRatio(
    BigInt(basePrice) * BigInt(100 - discountPct),
    100n,
  );
  const gstAmount = roundAmount(baseAmount, config.gstPct, 'GST percent');
  const totalPayable = baseAmount + gstAmount;
  if (!Number.isSafeInteger(totalPayable)) throw new RangeError('Total price exceeds the supported rupee range.');

  return { baseAmount, gstAmount, totalPayable, discountPct };
}

export async function calculateFamilyPriceQuotes(plan) {
  if (!plan) throw new ApiError(400, 'A membership plan is required.');
  const settings = await getSettings({ forceRefresh: true });
  const config = settings.familyMembership || DEFAULT_FAMILY_MEMBERSHIP_CONFIG;
  const tier = tierConfig(plan, config.tiers);
  const limits = { ...DEFAULT_FAMILY_MEMBERSHIP_CONFIG.limits, ...config.limits };
  const result = {
    tier: tier.tier,
    familyEnabled: tier.familyEnabled,
    nomineesEnabled: tier.nomineesEnabled,
    maxNominees: tier.maxNominees,
    nomineeRoles: tier.nomineeRoles,
    childMaxAge: config.childMaxAge,
    limits: {
      spouse: limits.spouse,
      parents: limits.parents,
      parentsPerSide: limits.parentsPerSide,
      children: limits.children,
    },
    prices: {},
  };
  if (!tier.familyEnabled) return result;

  const linkedPrimary = { _id: '000000000000000000000001', status: 'active' };
  const childDob = new Date();
  childDob.setUTCFullYear(childDob.getUTCFullYear() - config.childMaxAge);
  for (const [key, memberType, parentSide] of [
    ['spouse', 'spouse', undefined],
    ['parent', 'father', 'member'],
    ['child', 'child', undefined],
  ]) {
    result.prices[key] = await calculateMemberPrice({
      plan,
      memberType,
      parentSide,
      dob: memberType === 'child' ? childDob : undefined,
      linkedPrimary,
    });
  }
  return result;
}

export { roundHalfUpRatio };
