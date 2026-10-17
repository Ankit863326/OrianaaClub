// Phase 5b: Publish only public-safe stories and upcoming events.
import * as contentService from '../services/content-admin.service.js';
import asyncHandler from '../utils/asyncHandler.js';

export const posts = asyncHandler(async (request, response) => {
  const data = await contentService.publicPosts(request.validated.query);
  response.json({ success: true, data, message: 'Stories loaded.' });
});

export const post = asyncHandler(async (request, response) => {
  const data = await contentService.publicPost(request.validated.params.slug);
  response.json({ success: true, data, message: 'Story loaded.' });
});

export const events = asyncHandler(async (request, response) => {
  const data = await contentService.publicEvents(request.validated.query);
  response.json({ success: true, data, message: 'Events loaded.' });
});

export const event = asyncHandler(async (request, response) => {
  const data = await contentService.publicEvent(request.validated.params.slug);
  response.json({ success: true, data, message: 'Event loaded.' });
});
