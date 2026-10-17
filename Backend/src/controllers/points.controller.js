// Phase 3: Return a member's own points balance and filtered ledger history.
import * as pointsService from '../services/points.service.js';
import asyncHandler from '../utils/asyncHandler.js';

export const getMyPoints = asyncHandler(async (request, response) => {
  const data = await pointsService.getMemberPoints(request.user._id, request.validated.query);
  response.json({ success: true, data, message: 'Points information loaded.' });
});
