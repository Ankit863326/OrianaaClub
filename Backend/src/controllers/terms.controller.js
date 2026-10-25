import asyncHandler from '../utils/asyncHandler.js';
import { getCurrentTermsManifest } from '../config/terms.js';

export const current = asyncHandler(async (request, response) => {
  response.set('Cache-Control', 'public, max-age=300');
  response.json(await getCurrentTermsManifest());
});
