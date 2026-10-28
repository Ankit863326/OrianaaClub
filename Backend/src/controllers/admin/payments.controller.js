// Phase 5a: Serve payment review actions and audit each administrator decision.
import * as adminService from '../../services/admin.service.js';
import {
  approveBankTransfer,
  changePaymentMethod,
  refundPayment,
  rejectBankTransfer,
} from '../../services/payment.service.js';
import { createPaymentReceipt } from '../../services/receipt.service.js';
import { recordRequestAction } from '../../services/audit.service.js';
import asyncHandler from '../../utils/asyncHandler.js';

export const list = asyncHandler(async (request, response) => {
  const data = await adminService.listPayments(request.validated.query);
  response.json({ success: true, data, message: 'Payments loaded.' });
});

export const details = asyncHandler(async (request, response) => {
  const data = await adminService.getPayment(request.validated.params.id);
  response.json({ success: true, data, message: 'Payment details loaded.' });
});

export const changeMethod = asyncHandler(async (request, response) => {
  const payment = await changePaymentMethod(
    request.validated.params.id,
    request.validated.body,
  );
  await recordRequestAction(request, {
    action: 'payment.method.change',
    entityType: 'payment',
    entityId: payment._id,
    summary: `Changed payment method from ${payment.methodChange.before.method} to ${payment.method}.`,
    before: payment.methodChange.before,
    after: payment.methodChange.after,
    reason: request.validated.body.reason,
  });
  const { methodChange, ...data } = payment;
  response.json({ success: true, data, message: 'Payment details updated.' });
});

export const downloadReceipt = asyncHandler(async (request, response) => {
  const { document, receiptNumber } = await createPaymentReceipt(
    request.validated.params.paymentId,
  );
  response.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Content-Disposition': `attachment; filename="Receipt-${receiptNumber}.pdf"`,
    'Content-Type': 'application/pdf',
    'X-Content-Type-Options': 'nosniff',
  });
  document.on('error', (error) => response.destroy(error));
  document.pipe(response);
});

export const approve = asyncHandler(async (request, response) => {
  const payment = await approveBankTransfer(request.validated.params.id, request.user._id);
  await recordRequestAction(request, {
    action: 'payment.approve', entityType: 'payment', entityId: payment._id,
    summary: 'Bank transfer approved and membership activated.',
  });
  response.json({ success: true, data: payment, message: 'Bank transfer approved.' });
});

export const reject = asyncHandler(async (request, response) => {
  const payment = await rejectBankTransfer(request.validated.params.id, request.user._id, request.validated.body.reason);
  await recordRequestAction(request, {
    action: 'payment.reject', entityType: 'payment', entityId: payment._id,
    summary: `Bank transfer rejected: ${request.validated.body.reason}`,
  });
  response.json({ success: true, data: payment, message: 'Bank transfer rejected.' });
});

export const refund = asyncHandler(async (request, response) => {
  const payment = await refundPayment(request.validated.params.id, request.user._id, request.validated.body);
  await recordRequestAction(request, {
    action: 'payment.refund', entityType: 'payment', entityId: payment._id,
    summary: `Refunded ${request.validated.body.amount} paise: ${request.validated.body.reason}; reversePoints=${request.validated.body.reversePoints}.`,
  });
  response.json({ success: true, data: payment, message: 'Refund submitted.' });
});

export const exportCsv = asyncHandler(async (request, response) => {
  await adminService.streamPaymentsCsv(response, request.validated.query);
});
