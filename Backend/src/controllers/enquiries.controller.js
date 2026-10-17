// Phase 5b: Verify enquiry submissions, store them, and notify the club team.
import { verifyRecaptcha } from '../services/recaptcha.service.js';
import * as contentService from '../services/content-admin.service.js';
import asyncHandler from '../utils/asyncHandler.js';

export const create = asyncHandler(async (request, response) => {
  await verifyRecaptcha(request.validated.body.recaptchaToken);
  const data = await contentService.createEnquiry(request.validated.body);
  response.status(201).json({ success: true, data: { id: data._id }, message: 'Thank you. Your enquiry has been sent.' });
});
