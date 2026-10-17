// Keep payment HTTP handlers thin; the service owns order and signature rules.
import * as memberService from '../services/member.service.js';
import * as paymentService from '../services/payment.service.js';
import { createPaymentReceipt } from '../services/receipt.service.js';
import asyncHandler from '../utils/asyncHandler.js';

export const getMembership = asyncHandler(async (request, response) => {
  const data = await memberService.getPaymentMembership(
    request.user._id,
    request.validated.params.membershipId,
  );
  response.json({ success: true, data, message: 'Membership payment details loaded.' });
});

export const listMyPayments = asyncHandler(async (request, response) => {
  const data = await paymentService.listMemberPayments(request.user._id);
  response.json({ success: true, data, message: 'Member payments loaded.' });
});

export const downloadReceipt = asyncHandler(async (request, response) => {
  const { document, receiptNumber } = await createPaymentReceipt(
    request.validated.params.paymentId,
    request.user._id,
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

export const createOrder = asyncHandler(async (request, response) => {
  const { membershipId, method } = request.validated.body;
  const data = await paymentService.createRazorpayOrder(request.user._id, membershipId, method);
  response.status(201).json({ success: true, data, message: 'Payment order created.' });
});

export const verifyPayment = asyncHandler(async (request, response) => {
  const data = await paymentService.verifyRazorpayPayment(request.user._id, request.validated.body);
  response.json({ success: true, data, message: 'Payment verified.' });
});

export const webhook = asyncHandler(async (request, response) => {
  const data = await paymentService.processRazorpayWebhook(
    request.body,
    request.get('x-razorpay-signature'),
    request.get('x-razorpay-event-id'),
  );
  response.json(data);
});
