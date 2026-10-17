// Phase 5a: Serve admin member queries and audit every member-side change.
import * as adminService from '../../services/admin.service.js';
import { recordRequestAction } from '../../services/audit.service.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { writeCsvHeader, writeCsvRow } from '../../utils/csv.js';

export const list = asyncHandler(async (request, response) => {
  const data = await adminService.listMembers(request.validated.query);
  response.json({ success: true, data, message: 'Members loaded.' });
});

export const details = asyncHandler(async (request, response) => {
  const data = await adminService.getMemberDetails(request.validated.params.userId);
  response.json({ success: true, data, message: 'Member details loaded.' });
});

export const update = asyncHandler(async (request, response) => {
  const values = request.validated.body;
  const data = await adminService.updateMemberProfile(request.validated.params.userId, values);
  await recordRequestAction(request, {
    action: 'member.update', entityType: 'member', entityId: request.validated.params.userId,
    summary: `Updated member fields: ${Object.keys(values).join(', ')}`,
  });
  response.json({ success: true, data, message: 'Member profile updated.' });
});

async function setStatus(request, response, status) {
  const user = await adminService.changeMemberStatus(request.validated.params.userId, status);
  await recordRequestAction(request, {
    action: `member.${status}`, entityType: 'member', entityId: user._id,
    summary: `Member account status changed to ${status}.`,
  });
  response.json({ success: true, data: user, message: `Member ${status}.` });
}

export const suspend = asyncHandler((request, response) => setStatus(request, response, 'suspended'));
export const activate = asyncHandler((request, response) => setStatus(request, response, 'active'));

export const remove = asyncHandler(async (request, response) => {
  const user = await adminService.softDeleteMember(request.validated.params.userId);
  await recordRequestAction(request, {
    action: 'member.delete', entityType: 'member', entityId: user._id,
    summary: 'Member account soft-deleted.',
  });
  response.json({ success: true, data: { id: user._id, deletedAt: user.deletedAt }, message: 'Member deleted.' });
});

export const resendActivation = asyncHandler(async (request, response) => {
  const data = await adminService.resendMemberActivation(request.validated.params.userId);
  await recordRequestAction(request, {
    action: 'member.resend_activation', entityType: 'member', entityId: data.userId,
    summary: 'Password link resent to pending member.',
  });
  response.json({
    success: true,
    data: null,
    message: data.sent ? 'Password setup link sent.' : 'Please wait before requesting another password link.',
  });
});

export const create = asyncHandler(async (request, response) => {
  const data = await adminService.createMember(request.validated.body, request.user._id);
  await recordRequestAction(request, {
    action: 'member.create', entityType: 'member', entityId: data.user._id,
    summary: `Member account and ${data.plan.title} membership created${data.payment ? ' with manual payment' : ''}.`,
  });
  if (data.payment) {
    await recordRequestAction(request, {
      action: 'payment.manual_create', entityType: 'payment', entityId: data.payment._id,
      summary: `Recorded manual payment for newly created member ${data.user._id}.`,
    });
  }
  response.status(201).json({
    success: true,
    data,
    message: 'Member created. Send a password link from the member record when ready.',
  });
});

export const familyList = asyncHandler(async (request, response) => {
  const items = await adminService.getFamilyForMember(request.validated.params.userId);
  response.json({ success: true, data: { items, page: 1, limit: items.length, total: items.length }, message: 'Family members loaded.' });
});

export const familyUpdate = asyncHandler(async (request, response) => {
  const family = await adminService.updateFamilyMember(request.validated.params.userId, request.validated.params.familyId, request.validated.body);
  await recordRequestAction(request, {
    action: 'family.update', entityType: 'family_member', entityId: family._id,
    summary: `Updated family member for member ${request.validated.params.userId}.`,
  });
  response.json({ success: true, data: family, message: 'Family member updated.' });
});

export const familyDelete = asyncHandler(async (request, response) => {
  const family = await adminService.removeFamilyMember(request.validated.params.userId, request.validated.params.familyId);
  await recordRequestAction(request, {
    action: 'family.delete', entityType: 'family_member', entityId: family._id,
    summary: `Deleted family member for member ${request.validated.params.userId}.`,
  });
  response.json({ success: true, data: null, message: 'Family member deleted.' });
});

export const exportCsv = asyncHandler(async (request, response) => {
  writeCsvHeader(response, 'oriana-members.csv', ['Name', 'Email', 'Status', 'Member ID', 'Plan', 'Points balance', 'Points expiry', 'Mobile', 'Created']);
  const query = { ...request.validated.query, page: 1, limit: 100 };
  let page = await adminService.listMembers(query);
  for (const member of page.items) {
    writeCsvRow(response, [
      member.profile?.fullName || member.firstName, member.email, member.membership?.status || 'No membership',
      member.membership?.displayMemberCode, member.membership?.plan?.name || member.membership?.plan?.title,
      member.membership?.pointsBalance, member.membership?.pointsExpireAt?.toISOString(),
      member.profile?.mobile, member.createdAt?.toISOString(),
    ]);
  }
  while (page.page < page.pages) {
    query.page += 1;
    page = await adminService.listMembers(query);
    for (const member of page.items) {
      writeCsvRow(response, [
        member.profile?.fullName || member.firstName, member.email, member.membership?.status || 'No membership',
        member.membership?.displayMemberCode, member.membership?.plan?.name || member.membership?.plan?.title,
        member.membership?.pointsBalance, member.membership?.pointsExpireAt?.toISOString(),
        member.profile?.mobile, member.createdAt?.toISOString(),
      ]);
    }
  }
  response.end();
});
