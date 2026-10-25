import * as paymentService from '../services/payment.service.js';
import ApiError from '../utils/ApiError.js';
import MembershipPlan from '../models/MembershipPlan.js';
import { getSettings } from '../models/Setting.js';
import { env } from '../config/env.js';
import { unlink } from 'node:fs/promises';
import { verificationDocumentPath } from '../utils/verificationDocumentStorage.js';
import asyncHandler from '../utils/asyncHandler.js';

export const listPlans = asyncHandler(async (request, response) => {
  const [plans, settings] = await Promise.all([
    MembershipPlan.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).lean(),
    getSettings(),
  ]);
  response.json({
    success: true,
    data: plans.map((plan) => ({
      ...plan,
      slug: plan.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      title: plan.name,
      subtitle: `${settings.membershipValidityYears} year membership`,
      termYears: settings.membershipValidityYears,
      familyLimits: settings.familyMembership.limits,
      familyEnabled: settings.familyMembership.tiers
        .find((tier) => tier.tier === plan.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
        ?.familyEnabled ?? false,
      benefitsTitle: plan.name,
      benefits: [
        { points: plan.earlyBirdPoints, label: `First ${settings.earlyBirdLimit} members` },
        { points: plan.defaultPoints, label: 'Standard joining points' },
        { points: plan.renewalPoints, label: 'Renewal points' },
      ],
    })),
    message: 'Membership plans loaded.',
  });
});

export const publicGstSettings = asyncHandler(async (request, response) => {
  const settings = await getSettings();
  response.json({
    success: true,
    data: {
      enabled: settings.gstEnabled,
      rate: settings.gstRate,
      label: settings.gstLabel,
    },
    message: 'Public tax settings loaded.',
  });
});

export const bankDetails = asyncHandler(async (request, response) => {
  response.json({
    success: true,
    data: {
      accountName: env.bankAccountName,
      accountNumber: env.bankAccountNumber,
      ifsc: env.bankIfsc,
      bank: env.bankName,
      branch: env.bankBranch,
    },
    message: 'Bank details loaded.',
  });
});

export const purchase = asyncHandler(async (request, response) => {
  const data = await paymentService.purchaseMembership(request.user._id, request.validated.body);
  response.status(201).json({
    success: true,
    data,
    message: 'Membership and pending payment created.',
  });
});

export const renew = asyncHandler(async (request, response) => {
  const data = await paymentService.renewMembership(request.user._id, request.validated.body);
  response.status(201).json({
    success: true,
    data,
    message: 'Renewal and pending payment created.',
  });
});

export const verifyRazorpay = asyncHandler(async (request, response) => {
  const data = await paymentService.verifyMembershipRazorpayPayment(
    request.user._id,
    request.validated.body,
  );
  response.json({ success: true, data, message: 'Payment verified.' });
});

export const createRazorpayOrder = asyncHandler(async (request, response) => {
  const data = await paymentService.createMembershipRazorpayOrder(
    request.user._id,
    request.validated.body.paymentId,
  );
  response.status(201).json({ success: true, data, message: 'Razorpay order created.' });
});

export const uploadVerificationDocument = asyncHandler(async (request, response) => {
  if (!request.file?.storageKey) {
    throw new ApiError(400, 'A verification document is required.');
  }
  let data;
  try {
    data = await paymentService.uploadMembershipVerificationDocument(request.user._id, {
      id: request.file.documentId,
      storageKey: request.file.storageKey,
      mimeType: request.file.mimetype,
      originalName: request.file.publicName,
    });
  } catch (error) {
    await unlink(verificationDocumentPath(request.file.storageKey));
    throw error;
  }
  response.status(201).json({ success: true, data, message: 'Verification document uploaded.' });
});
