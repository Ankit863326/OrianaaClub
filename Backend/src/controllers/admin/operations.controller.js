// Phase 5b: Manage administrators and present audit, email, and reporting data.
import * as contentService from '../../services/content-admin.service.js';
import { recordRequestAction } from '../../services/audit.service.js';
import asyncHandler from '../../utils/asyncHandler.js';

export const admins = asyncHandler(async (request, response) => {
  const data = await contentService.listAdmins(request.validated.query);
  response.json({ success: true, data, message: 'Administrators loaded.' });
});

export const createAdmin = asyncHandler(async (request, response) => {
  const result = await contentService.createAdmin(request.validated.body);
  await recordRequestAction(request, {
    action: 'admin.create', entityType: 'admin', entityId: result.admin._id,
    summary: `Created pending administrator account for ${result.admin.email}.`,
  });
  response.status(201).json({
    success: true,
    data: { admin: result.admin, activationEmailSent: result.activationEmailSent },
    message: result.activationEmailSent
      ? 'Administrator created and password setup link sent.'
      : 'Administrator created, but the password setup link could not be sent. Check email logs.',
  });
});

export const updateAdmin = asyncHandler(async (request, response) => {
  const admin = await contentService.setAdminStatus(
    request.validated.params.id,
    request.validated.body.status,
    request.user._id,
  );
  await recordRequestAction(request, {
    action: `admin.${request.validated.body.status}`,
    entityType: 'admin',
    entityId: admin._id,
    summary: `Administrator status changed to ${admin.status}.`,
  });
  response.json({ success: true, data: admin, message: 'Administrator status updated.' });
});

export const auditLogs = asyncHandler(async (request, response) => {
  const data = await contentService.listAuditLogs(request.validated.query);
  response.json({ success: true, data, message: 'Audit log loaded.' });
});

export const emailLogs = asyncHandler(async (request, response) => {
  const data = await contentService.listEmailLogs(request.validated.query);
  response.json({ success: true, data, message: 'Email log loaded.' });
});

export const reports = asyncHandler(async (request, response) => {
  const data = await contentService.reports(request.validated.query);
  response.json({ success: true, data, message: 'Reports loaded.' });
});

export const exportReport = asyncHandler(async (request, response) => {
  await contentService.exportReportCsv(response, request.validated.query.report, request.validated.query);
});
