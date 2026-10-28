import { DEFAULT_FAMILY_MEMBERSHIP_CONFIG, getSettings } from '../models/Setting.js';
import { getFamilyTier } from './family-tier.service.js';
import ApiError from '../utils/ApiError.js';

function memberTypeOf(member = {}) {
  if (member.isNominee || ['nominee', 'nominee_gm', 'nominee_hr'].includes(member.memberType)) {
    return ['nominee_gm', 'nominee_hr'].includes(member.memberType) ? member.memberType : 'nominee';
  }
  const relationship = String(member.relationship || member.relation || '').toLowerCase();
  if (['spouse', 'wife', 'husband'].includes(relationship)) return 'spouse';
  if (['father', 'mother'].includes(relationship)) return relationship;
  if (member.type === 'child' || ['child', 'son', 'daughter'].includes(relationship)) return 'child';
  return ['spouse', 'child', 'father', 'mother'].includes(member.memberType) ? member.memberType : '';
}

export function normalizeFamilyProfile(values) {
  const memberTypeInput = values.memberType || '';
  const isNominee = values.isNominee
    || ['nominee', 'nominee_gm', 'nominee_hr'].includes(memberTypeInput);
  let memberType;
  let relationship;
  if (isNominee) {
    memberType = ['nominee_gm', 'nominee_hr'].includes(memberTypeInput)
      ? memberTypeInput
      : 'nominee';
    relationship = 'Nominee';
  } else {
    relationship = String(values.relationship || values.relation || '').trim();
    const normalizedRelation = relationship.toLowerCase();
    memberType = ['wife', 'husband', 'spouse'].includes(normalizedRelation)
      ? 'spouse'
      : ['son', 'daughter', 'child'].includes(normalizedRelation)
        ? 'child'
        : ['father', 'mother'].includes(normalizedRelation)
          ? normalizedRelation
          : '';
    if (!memberType) throw new ApiError(400, 'Choose a supported family relationship.');
  }
  return {
    ...values,
    memberType,
    isNominee,
    relationship,
    dob: isNominee ? null : values.dob || values.dateOfBirth || null,
    anniversaryDate: values.anniversaryDate || null,
    email: values.email || '',
    workEmail: values.workEmail || '',
    phone: values.phone || '',
  };
}

function ageAt(dateOfBirth, purchaseDate) {
  const birth = new Date(dateOfBirth);
  const purchase = new Date(purchaseDate);
  let age = purchase.getUTCFullYear() - birth.getUTCFullYear();
  if (
    purchase.getUTCMonth() < birth.getUTCMonth()
    || (purchase.getUTCMonth() === birth.getUTCMonth()
      && purchase.getUTCDate() < birth.getUTCDate())
  ) age -= 1;
  return age;
}

export async function validateFamilyProfileSet({ plan, members, purchaseDate = new Date() }) {
  if (!plan) throw new ApiError(409, 'Select a membership plan before adding family profiles.');
  const settings = await getSettings({ forceRefresh: true });
  const config = settings.familyMembership || DEFAULT_FAMILY_MEMBERSHIP_CONFIG;
  const limits = config.limits || {};
  const tier = getFamilyTier(plan, config.tiers);
  if (!tier) throw new ApiError(400, 'A supported membership tier is required.');

  const categorized = members
    .filter((member) => member.status !== 'removed' && member.pendingAction !== 'remove')
    .map((member) => ({ member, type: memberTypeOf(member) }));
  const nominees = categorized.filter(({ type }) => ['nominee', 'nominee_gm', 'nominee_hr'].includes(type));
  const relatives = categorized.filter(({ type }) => ['spouse', 'child', 'father', 'mother'].includes(type));

  if (relatives.length && !tier.familyEnabled) {
    throw new ApiError(409, 'Family memberships are not enabled for this tier.');
  }
  if (nominees.length && !tier.nomineesEnabled) {
    throw new ApiError(409, 'Nominees are not enabled for this membership tier.');
  }

  const spouseCount = relatives.filter(({ type }) => type === 'spouse').length;
  if (limits.spouse != null && spouseCount > limits.spouse) {
    throw new ApiError(409, `This tier allows up to ${limits.spouse} spouse.`);
  }

  const parents = relatives.filter(({ type }) => ['father', 'mother'].includes(type));
  if (parents.some(({ member }) => (
    !member._id
    && !member.id
    && !['member', 'spouse'].includes(member.parentSide)
  ))) {
    throw new ApiError(400, 'Choose whether each parent is from the member or spouse side.');
  }
  const maxParentsPerSide = Math.min(limits.parentsPerSide ?? 2, 2);
  for (const side of ['member', 'spouse']) {
    if (parents.filter(({ member }) => (
      (member.parentSide || 'member') === side
    )).length > maxParentsPerSide) {
      throw new ApiError(409, `A maximum of ${maxParentsPerSide} parents is allowed per side.`);
    }
  }
  if (limits.parents != null && parents.length > limits.parents) {
    throw new ApiError(409, `This tier allows up to ${limits.parents} parents.`);
  }

  const children = relatives.filter(({ type }) => type === 'child');
  if (limits.children != null && children.length > limits.children) {
    throw new ApiError(409, `This tier allows up to ${limits.children} children.`);
  }
  for (const { member } of children) {
    if (!member.dob && !member.dateOfBirth) {
      if (!member._id && !member.id) {
        throw new ApiError(400, 'A valid date of birth is required for a child.');
      }
      continue;
    }
    if (
      !member._id
      && !member.id
      && ageAt(member.dob || member.dateOfBirth, purchaseDate) > config.childMaxAge
    ) {
      throw new ApiError(409, 'This child is over the eligible age and needs own membership.');
    }
  }

  if (nominees.length > tier.maxNominees) {
    throw new ApiError(409, `This tier allows up to ${tier.maxNominees} nominees.`);
  }
  const allowedRoles = Array.isArray(tier.nomineeRoles) ? tier.nomineeRoles : null;
  const seenRoles = new Set();
  for (const { member } of nominees) {
    const role = String(member.nomineeRole || '').trim();
    if (!role) throw new ApiError(400, 'A nominee role is required.');
    if (allowedRoles && !allowedRoles.includes(role)) {
      throw new ApiError(400, `Nominee role must be one of: ${allowedRoles.join(', ')}.`);
    }
    if (allowedRoles && memberTypeOf(member) !== `nominee_${role.toLowerCase()}`) {
      throw new ApiError(400, `The ${role} nominee type does not match the selected role.`);
    }
    if (allowedRoles && seenRoles.has(role)) {
      throw new ApiError(409, `A ${role} nominee is already registered.`);
    }
    seenRoles.add(role);
    if (!String(member.workEmail || '').trim()) {
      throw new ApiError(400, 'A nominee work email is required.');
    }
    if (!String(member.designation || '').trim()) {
      throw new ApiError(400, 'A nominee designation is required.');
    }
    if (!String(member.phone || '').trim()) {
      throw new ApiError(400, 'A nominee phone number is required.');
    }
  }

  return { config, tier };
}
