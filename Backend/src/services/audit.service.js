// Phase 5a: Centralize audit writes for every administrator-side mutation.
import AuditLog from '../models/AuditLog.js';

export async function recordAdminAction({
  adminId, action, entityType, entityId, summary, ip = '', before = null, after = null, reason = '',
}) {
  return AuditLog.create({
    admin: adminId,
    actorType: 'admin',
    actorId: adminId,
    action,
    entityType,
    entityId: String(entityId),
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
