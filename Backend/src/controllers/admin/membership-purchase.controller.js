import * as paymentService from '../../services/payment.service.js';
import { recordRequestAction } from '../../services/audit.service.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { verificationDocumentPath } from '../../utils/verificationDocumentStorage.js';

export const recordOfflinePayment = asyncHandler(async (request, response) => {
  const payment = await paymentService.recordOfflineMembershipPayment(
    request.user._id,
    request.validated.body,
  );
  await recordRequestAction(request, {
    action: 'membership.payment.record',
    entityType: 'payment',
    entityId: payment._id,
    summary: `Recorded ${payment.method} membership payment.`,
    after: { membership: String(payment.membership), amount: payment.amount, reference: payment.reference },
  });
  response.status(201).json({ success: true, data: payment, message: 'Offline payment recorded.' });
});

export const confirmOfflinePayment = asyncHandler(async (request, response) => {
  const result = await paymentService.confirmOfflineMembershipPayment(
    request.validated.params.id,
    request.user._id,
  );
  if (!result.alreadyConfirmed) {
    await recordRequestAction(request, {
      action: 'membership.payment.confirm',
      entityType: 'payment',
      entityId: result.payment._id,
      summary: `Confirmed offline payment; membership status is ${result.status}.`,
      after: { paymentStatus: result.payment.status, membershipStatus: result.status },
    });
  }
  response.json({
    success: true,
    data: result,
    message: result.alreadyConfirmed ? 'Offline payment was already confirmed.' : 'Offline payment confirmed.',
  });
});

export const approveVerification = asyncHandler(async (request, response) => {
  const membership = await paymentService.approveMembershipVerification(
    request.validated.params.id,
    request.user._id,
  );
  await recordRequestAction(request, {
    action: 'membership.verification.approve',
    entityType: 'membership',
    entityId: membership._id,
    summary: 'Membership verification approved and membership activated.',
    after: { status: membership.status, memberNumber: membership.memberNumber },
  });
  response.json({ success: true, data: membership, message: 'Membership verification approved.' });
});

export const getVerificationDocument = asyncHandler(async (request, response, next) => {
  const document = await paymentService.getMembershipVerificationDocument(
    request.validated.params.id,
    request.validated.params.documentId,
  );
  const filePath = verificationDocumentPath(document.storageKey);
  response.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'X-Content-Type-Options': 'nosniff',
    'Content-Type': document.mimeType,
    'Content-Disposition': `attachment; filename="${document.originalName.replace(/["\r\n]/g, '_')}"`,
  });
  response.sendFile(filePath, (error) => {
    if (error) next(error);
  });
});

export const deactivate = asyncHandler(async (request, response) => {
  const membership = await paymentService.deactivateMembership(
    request.validated.params.id,
    request.validated.body.reason,
  );
  await recordRequestAction(request, {
    action: 'membership.deactivate',
    entityType: 'membership',
    entityId: membership._id,
    summary: 'Membership deactivated by administrator.',
    after: { status: membership.status },
    reason: request.validated.body.reason,
  });
  response.json({ success: true, data: membership, message: 'Membership deactivated.' });
});
