import { env } from '../config/env.js';
import * as draftService from '../services/membership-draft.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { getApplicationTermsConsent } from '../services/terms.service.js';

const cookieOptions = {
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: env.cookieSameSite,
  path: '/api',
  ...(env.cookieDomain ? { domain: env.cookieDomain } : {}),
};

export const start = asyncHandler(async (request, response) => {
  const result = await draftService.startMembershipDraft(
    request.validated.body,
    request.cookies?.oc_membership_draft,
  );
  if (result.submitted) {
    response.status(202).json({
      success: true,
      data: { submitted: true, email: result.email },
      message: 'An application for this email has already been submitted. Check your inbox or request a new password link.',
    });
    return;
  }
  if (result.token) {
    response.cookie('oc_membership_draft', result.token, {
      ...cookieOptions,
      maxAge: env.draftRetentionDays * 24 * 60 * 60 * 1000,
    });
  }
  response.status(202).json({
    success: true,
    data: {
      email: result.email,
      otpExpiresInSeconds: result.otpExpiresInSeconds,
      otpRetryAfterSeconds: result.otpRetryAfterSeconds || 0,
      emailVerified: result.emailVerified,
    },
    message: result.emailVerified
      ? 'Your email is already verified.'
      : result.otpRetryAfterSeconds
        ? 'A verification code was recently sent. You can use it or request another when the countdown ends.'
        : 'A verification code has been sent to your email.',
  });
});

export const requestHelp = asyncHandler(async (request, response) => {
  const result = await draftService.requestMembershipHelp(request.validated.body.email);
  response.status(202).json({
    success: true,
    data: result,
    message: 'Your request has been sent to the membership team.',
  });
});

export const get = asyncHandler(async (request, response) => {
  const data = draftService.getMembershipDraft(request.membershipDraft);
  data.termsConsent = await getApplicationTermsConsent(request.membershipDraft._id);
  response.json({
    success: true,
    data,
    message: 'Membership application loaded.',
  });
});

export const requestPasswordLink = asyncHandler(async (request, response) => {
  console.log('[membership-password-link] Controller received a password-link request.');
  const data = await draftService.requestPasswordLink(
    request.membershipDraft,
    request.validated.body.email,
  );
  console.log(
    `[membership-password-link] Controller completed request: ${data.sent ? 'link issued' : 'no link issued'}.`,
  );
  response.status(202).json({
    success: true,
    data,
    message: data.message,
  });
});

export const verifyOtp = asyncHandler(async (request, response) => {
  const data = await draftService.verifyMembershipDraftOtp(
    request.membershipDraft,
    request.validated.body.code,
  );
  response.json({ success: true, data, message: 'Email verified.' });
});

export const resendOtp = asyncHandler(async (request, response) => {
  const data = await draftService.resendMembershipDraftOtp(request.membershipDraft);
  response.status(202).json({ success: true, data, message: data.message });
});

export const saveProfile = asyncHandler(async (request, response) => {
  const data = await draftService.saveMembershipDraftProfile(
    request.membershipDraft,
    request.validated.body,
    request.file,
  );
  response.json({ success: true, data, message: 'Personal details saved.' });
});

export const saveIdentity = asyncHandler(async (request, response) => {
  try {
    const data = await draftService.saveMembershipDraftIdentity(
      request.membershipDraft,
      request.validated.body,
      request.identityDocuments,
    );
    response.status(201).json({ success: true, data, message: 'Identity documents submitted for review.' });
  } catch (error) {
    await draftService.discardUncommittedIdentityDocuments(request.identityDocuments);
    throw error;
  }
});

export const savePlan = asyncHandler(async (request, response) => {
  const plan = await draftService.saveMembershipDraftPlan(
    request.membershipDraft,
    request.validated.body.planId,
  );
  response.json({ success: true, data: plan, message: 'Membership plan saved.' });
});

export const quote = asyncHandler(async (request, response) => {
  const data = await draftService.getMembershipDraftQuote(
    request.membershipDraft,
    request.validated.body.planId,
  );
  response.json({ success: true, data, message: 'Membership payment details loaded.' });
});

export const familyPrices = asyncHandler(async (request, response) => {
  const data = await draftService.getMembershipDraftFamilyPriceBreakdown(
    request.membershipDraft,
    request.validated.query.planId,
  );
  response.json({ success: true, data, message: 'Family prices loaded.' });
});

export const saveFamily = asyncHandler(async (request, response) => {
  const data = await draftService.saveMembershipDraftFamily(
    request.membershipDraft,
    request.validated.body.members,
  );
  response.json({ success: true, data, message: 'Family details saved.' });
});

export const addFamily = asyncHandler(async (request, response) => {
  const data = await draftService.addMembershipDraftFamily(
    request.membershipDraft,
    request.validated.body,
    request.file,
  );
  response.status(201).json({ success: true, data, message: 'Family member added.' });
});

export const updateFamily = asyncHandler(async (request, response) => {
  const data = await draftService.updateMembershipDraftFamily(
    request.membershipDraft,
    request.validated.params.id,
    request.validated.body,
    request.file,
  );
  response.json({ success: true, data, message: 'Family member updated.' });
});

export const deleteFamily = asyncHandler(async (request, response) => {
  const data = await draftService.deleteMembershipDraftFamily(
    request.membershipDraft,
    request.validated.params.id,
  );
  response.json({ success: true, data, message: 'Family member removed.' });
});

export const purchase = asyncHandler(async (request, response) => {
  if (String(request.membershipDraft.plan) !== request.validated.body.planId) {
    throw new ApiError(409, 'The selected plan does not match your saved application.');
  }
  const data = await draftService.submitMembershipDraftPayment(
    request.membershipDraft,
    request.validated.body,
  );
  if (data.paymentMethod === 'razorpay') {
    response.status(201).json({ success: true, data, message: 'Secure payment order created.' });
    return;
  }
  response.status(201).json({
    success: true,
    data: { ...data, submitted: true },
    message: 'Payment details submitted. Your payment is pending confirmation.',
  });
});

export const verifyRazorpay = asyncHandler(async (request, response) => {
  const data = await draftService.verifyMembershipDraftRazorpayPayment(
    request.membershipDraft,
    request.validated.body,
  );
  response.json({ success: true, data: { ...data, submitted: true }, message: 'Payment verified.' });
});

export const bankDetails = (request, response) => {
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
};
