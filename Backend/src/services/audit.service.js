// Phase 5a: Centralize audit writes for every administrator-side mutation.
import mongoose from 'mongoose';
import AuditLog from '../models/AuditLog.js';
import FamilyMember from '../models/FamilyMember.js';
import Membership from '../models/Membership.js';

export async function recordAdminAction({
  adminId, action, entityType, entityId, summary, memberNo = '', ip = '', before = null, after = null, reason = '',
}) {
  let resolvedMemberNo = memberNo;
  if (!resolvedMemberNo && entityType === 'membership' && mongoose.isValidObjectId(entityId)) {
    resolvedMemberNo = (await Membership.findById(entityId).select('memberNo').lean())?.memberNo || '';
  } else if (!resolvedMemberNo && entityType === 'family_member') {
    const familyMember = await FamilyMember.findById(entityId).select('memberNo membership').lean();
    const membership = familyMember?.membership
      ? await Membership.findById(familyMember.membership).select('memberNo').lean()
      : null;
    resolvedMemberNo = familyMember?.memberNo || membership?.memberNo || '';
  }
  return AuditLog.create({
    admin: adminId,
    actorType: 'admin',
    actorId: adminId,
    action,
    entityType,
    entityId: String(entityId),
    memberNo: resolvedMemberNo,
    summary,
    before,
    after,
    reason,
    ip: String(ip || '').slice(0, 100),
  });
}

export async function recordRequestAction(request, fields) {
  return recordAdminAction({
    ...fields,
    adminId: request.user._id,
    ip: request.ip,
  });
}

export async function recordAdminAuthAttempt({ adminId = null, success, ip = '' }) {
  return recordAdminAction({
    adminId,
    action: success ? 'login' : 'login_failed',
    entityType: 'authentication',
    entityId: adminId ? String(adminId) : 'unknown',
    summary: success ? 'Administrator logged in.' : 'Administrator login failed.',
    ip,
  });
}
