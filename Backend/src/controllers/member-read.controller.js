import QRCode from 'qrcode';
import * as memberReadService from '../services/member-read.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';

export const membership = asyncHandler(async (request, response) => {
  const data = await memberReadService.getMyMembership(request.user._id);
  response.json({ success: true, data, message: 'Membership details loaded.' });
});

export const membershipQr = asyncHandler(async (request, response) => {
  const memberCode = await memberReadService.getMyMemberCode(request.user._id);
  const image = await QRCode.toBuffer(memberCode, {
    type: 'png',
    errorCorrectionLevel: 'M',
    margin: 2,
  });
  response.set({
    'Content-Type': 'image/png',
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'X-Content-Type-Options': 'nosniff',
  });
  response.send(image);
});

export const redemptions = asyncHandler(async (request, response) => {
  const data = await memberReadService.getMyRedemptions(
    request.user._id,
    request.validated.query,
  );
  response.json({ success: true, data, message: 'Membership redemptions loaded.' });
});

export const pointsHistory = asyncHandler(async (request, response) => {
  const data = await memberReadService.getMyPointsHistory(
    request.user._id,
    request.validated.query,
  );
  response.json({ success: true, data, message: 'Points history loaded.' });
});
