import FamilyMember from '../models/FamilyMember.js';
import Membership from '../models/Membership.js';
import { allocateMemberId } from './member-id.service.js';

function familyMemberType(member) {
  const relation = String(member.relation || member.relationship || '').trim().toLowerCase();
  if (['spouse', 'wife', 'husband'].includes(relation)) return 'spouse';
  if (relation === 'child' || relation === 'son' || relation === 'daughter') return 'child';
  if (relation === 'father') return 'father';
  if (relation === 'mother') return 'mother';
  return member.memberType || 'child';
}

function familySuffix(member, memberType, childSequence = 0) {
  if (memberType === 'spouse') return 'S';
  if (memberType === 'child') return `C${childSequence}`;
  if (memberType === 'father') return member.parentSide === 'spouse' ? 'SF' : 'F';
  if (memberType === 'mother') return member.parentSide === 'spouse' ? 'SM' : 'M';
  return '';
}

export async function allocateFamilyChildNumber(primary, session) {
  const existing = await FamilyMember.find({ membership: primary._id })
    .select('memberNo familyChildNumber')
    .session(session)
    .lean();
  const existingMaximum = existing.reduce((maximum, member) => {
    const suffix = String(member.memberNo || '').match(/-C(\d+)$/);
    return Math.max(
      maximum,
      Number(member.familyChildNumber) || 0,
      suffix ? Number(suffix[1]) : 0,
    );
  }, 0);
  await Membership.updateOne(
    { _id: primary._id },
    [{
      $set: {
        familyChildSequence: {
          $max: [{ $ifNull: ['$familyChildSequence', 0] }, existingMaximum],
        },
      },
    }],
    { session },
  );
  const updatedPrimary = await Membership.findOneAndUpdate(
    { _id: primary._id },
    { $inc: { familyChildSequence: 1 } },
    { new: true, session },
  ).select('familyChildSequence');
  if (!updatedPrimary) throw new Error('Could not allocate a family child number.');
  primary.familyChildSequence = updatedPrimary.familyChildSequence;
  return updatedPrimary.familyChildSequence;
}

async function ensureChildNumber(primary, member, session) {
  if (Number.isSafeInteger(member.familyChildNumber) && member.familyChildNumber > 0) {
    return member.familyChildNumber;
  }
  const legacySuffix = String(member.memberNo || '').match(/-C(\d+)$/);
  if (legacySuffix) {
    member.familyChildNumber = Number(legacySuffix[1]);
    await Membership.updateOne(
      { _id: primary._id },
      [{ $set: { familyChildSequence: { $max: [{ $ifNull: ['$familyChildSequence', 0] }, member.familyChildNumber] } } }],
      { session },
    );
    return member.familyChildNumber;
  }
  member.familyChildNumber = await allocateFamilyChildNumber(primary, session);
  return member.familyChildNumber;
}

export async function assignFamilyMemberId(primary, member, activatedAt, expiresAt, session) {
  const memberType = familyMemberType(member);
  member.memberType = memberType;
  if (member.isNominee || String(memberType).startsWith('nominee')) {
    member.memberNo = '';
    member.memberId = '';
    if (member._id) {
      await Membership.updateMany(
        { familyMember: member._id },
        { $set: { memberNo: '', memberCode: '', memberId: '' } },
        { session },
      );
    }
    return '';
  }

  const childSequence = memberType === 'child'
    ? await ensureChildNumber(primary, member, session)
    : 0;
  const suffix = familySuffix(member, memberType, childSequence);
  if (!suffix) return '';

  const memberId = await allocateMemberId({
    activatedAt,
    expiresAt,
    suffix,
    session,
  });
  member.memberNo = memberId;
  member.memberId = memberId;
  if (member._id) {
    await Membership.updateMany(
      { familyMember: member._id },
      { $set: { memberNo: memberId, memberCode: memberId, memberId } },
      { session },
    );
  }
  return memberId;
}
