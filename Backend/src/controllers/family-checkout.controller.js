import * as familyCheckoutService from '../services/family-checkout.service.js';
import asyncHandler from '../utils/asyncHandler.js';

export const getQuote = asyncHandler(async (request, response) => {
  const data = await familyCheckoutService.getFamilyCheckoutQuote(
    request.user._id,
    request.validated.params.familyId,
  );
  response.json({ success: true, data, message: 'Family membership price loaded.' });
});

export const start = asyncHandler(async (request, response) => {
  const data = await familyCheckoutService.startFamilyCheckout(
    request.user._id,
    request.validated.params.familyId,
  );
  response.status(201).json({ success: true, data, message: 'Family payment is ready.' });
});

export const createOrder = asyncHandler(async (request, response) => {
  const data = await familyCheckoutService.createFamilyRazorpayOrder(
    request.user._id,
    request.validated.params.familyId,
  );
  response.status(201).json({ success: true, data, message: 'Family Razorpay order created.' });
});

export const verify = asyncHandler(async (request, response) => {
  const data = await familyCheckoutService.verifyFamilyRazorpayPayment(
    request.user._id,
    request.validated.params.familyId,
    request.validated.body,
  );
  response.json({ success: true, data, message: 'Family payment verified.' });
});
