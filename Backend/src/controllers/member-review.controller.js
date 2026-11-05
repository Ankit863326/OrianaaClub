import * as reviewService from '../services/member-review.service.js';
import asyncHandler from '../utils/asyncHandler.js';

export const mine = asyncHandler(async (request, response) => {
  const data = await reviewService.getMine(request.user._id);
  response.json({ success: true, data, message: 'Your review details loaded.' });
});

export const saveMine = asyncHandler(async (request, response) => {
  const data = await reviewService.saveMine(request.user._id, request.validated.body);
  response.json({ success: true, data, message: 'Your review is now visible in Stories.' });
});

export const publicReviews = asyncHandler(async (request, response) => {
  const data = await reviewService.listPublic();
  response.json({ success: true, data, message: 'Member stories loaded.' });
});
