import { processMembershipRazorpayWebhook } from '../services/payment.service.js';
import { processGuestMembershipWebhook } from '../services/membership-draft.service.js';
import asyncHandler from '../utils/asyncHandler.js';

export const webhook = asyncHandler(async (request, response) => {
  const guestPaymentHandled = await processGuestMembershipWebhook(
    request.body,
    request.get('x-razorpay-signature'),
  );
  if (guestPaymentHandled) {
    response.json({ success: true, message: 'Guest membership payment processed.' });
    return;
  }
  const data = await processMembershipRazorpayWebhook(
    request.body,
    request.get('x-razorpay-signature'),
    request.get('x-razorpay-event-id'),
  );
  response.json(data);
});
