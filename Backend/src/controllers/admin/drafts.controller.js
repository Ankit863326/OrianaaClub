import * as draftService from '../../services/admin-drafts.service.js';
import { recordRequestAction } from '../../services/audit.service.js';
import asyncHandler from '../../utils/asyncHandler.js';

function draftAudit(request, action, memberId, summary, after = null, reason = '') {
  const resolvedMemberId = memberId || request.validated.params.id;
  return recordRequestAction(request, {
    action: `draft_member.${action}`,
    entityType: 'membership_draft',
    entityId: resolvedMemberId,
    summary,
    after: { memberId: resolvedMemberId, ...after },
    reason,
  });
}

export const list = asyncHandler(async (request, response) => {
  const data = await draftService.listDraftMembers(request.validated.query);
  await draftAudit(
    request,
    'list',
    'draft_collection',
    'Draft member list viewed.',
    {
      resultCount: data.items.length,
      total: data.total,
      page: data.page,
      status: request.validated.query.status || '',
      needsHelp: request.validated.query.needsHelp ?? null,
    },
  );
  response.json({ success: true, data, message: 'Draft members loaded.' });
});

export const resendLink = asyncHandler(async (request, response) => {
  let result;
  try {
    result = await draftService.resendDraftMemberLink(request.validated.params.id);
  } catch (error) {
    await draftAudit(
      request,
      'resend_link.failed',
      error.draftMemberId,
      'Password-link resend failed.',
      null,
      `${error?.name || 'Error'}: ${error?.code || 'delivery failed'}`,
    );
    throw error;
  }
  await draftAudit(request, 'resend_link', result.memberId, 'Password setup link resent.', { sent: result.sent });
  response.json({
    success: true,
    data: null,
    message: result.sent ? 'Password setup link sent.' : 'Password setup link was not sent.',
  });
});

export const markPaid = asyncHandler(async (request, response) => {
  const result = await draftService.markDraftMemberPaid(
    request.validated.params.id,
    request.user._id,
    request.validated.body,
  );
  await draftAudit(
    request,
    'mark_paid',
    result.memberId,
    'Membership payment marked paid by an administrator.',
    { paymentId: result.paymentId, status: result.status },
    request.validated.body.note,
  );
  response.json({ success: true, data: result, message: 'Membership payment marked paid.' });
});

export const setTemporaryPassword = asyncHandler(async (request, response) => {
  const result = await draftService.setDraftMemberTemporaryPassword(request.validated.params.id);
  await draftAudit(request, 'set_temp_password', result.memberId, 'Temporary member password set.');
  response.json({
    success: true,
    data: { temporaryPassword: result.temporaryPassword },
    message: 'Temporary password set. Copy it now; it will not be shown again.',
  });
});

export const update = asyncHandler(async (request, response) => {
  const { draft, previous } = await draftService.updateDraftMember(
    request.validated.params.id,
    request.validated.body,
  );
  await draftAudit(
    request,
    'update',
    draft.user ? String(draft.user) : '',
    'Draft member contact information or administrator notes updated.',
    {
      email: draft.email,
      phone: draft.profile?.mobile || '',
      adminNotes: draft.adminNotes,
    },
    JSON.stringify(previous),
  );
  response.json({ success: true, data: null, message: 'Draft member updated.' });
});

export const activate = asyncHandler(async (request, response) => {
  const result = await draftService.activateDraftMember(request.validated.params.id);
  await draftAudit(request, 'activate', result.memberId, 'Member account activated.', { status: result.status });
  response.json({ success: true, data: null, message: 'Member activated.' });
});

export const remove = asyncHandler(async (request, response) => {
  const result = await draftService.deleteDraftMember(request.validated.params.id);
  await draftAudit(request, 'delete', result.memberId, 'Membership application deleted.', {
    email: result.email,
    draftId: result.draftId,
  });
  response.json({ success: true, data: null, message: 'Draft member deleted.' });
});
