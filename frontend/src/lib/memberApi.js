// Phase 2: Save and load a member's profile, draft plan, and family members.
import apiClient from './apiClient.js';

function createFormData(values, photo) {
  const formData = new FormData();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null) formData.append(key, String(value));
  });
  if (photo) formData.append('photo', photo);
  return formData;
}

export async function getMember() {
  const result = await apiClient.get('/member/me');
  return result.data;
}

export async function saveProfile(values, photo) {
  const result = await apiClient.putForm('/member/profile', createFormData(values, photo));
  return result.data;
}

export async function savePlan(planId) {
  const result = await apiClient.put('/member/plan', { planId });
  return result.data;
}

export async function startMembershipPayment(planId) {
  const result = await apiClient.post('/member/checkout', { planId });
  return result.data;
}

export async function getMembershipCheckoutQuote(planId) {
  const result = await apiClient.post('/member/checkout/quote', { planId });
  return result.data;
}

export async function getPaymentMembership(membershipId) {
  const result = await apiClient.get(`/payments/memberships/${encodeURIComponent(membershipId)}`);
  return result.data;
}

export async function createPaymentOrder(membershipId, method) {
  const result = await apiClient.post('/payments/create-order', { membershipId, method });
  return result.data;
}

export async function createMembershipRazorpayOrder(paymentId) {
  const result = await apiClient.post('/membership/razorpay/order', { paymentId });
  return result.data;
}

export async function verifyPayment(details) {
  const result = await apiClient.post('/payments/verify', details);
  return result.data;
}

export async function getPurchasePlans() {
  const result = await apiClient.get('/membership/plans');
  return result.data;
}

export async function getPublicGstSettings() {
  const result = await apiClient.get('/membership/gst-settings');
  return result.data;
}

export async function getMembershipBankDetails() {
  const result = await apiClient.get('/membership/bank-details');
  return result.data;
}

export async function purchaseMembership(planId, paymentMethod, companyDetails, rtgsDetails) {
  const result = await apiClient.post('/membership/purchase', {
    planId,
    paymentMethod,
    ...(companyDetails ? { companyDetails } : {}),
    ...(rtgsDetails ? { rtgsDetails } : {}),
  });
  return result.data;
}

export async function renewMembership(planId, paymentMethod) {
  const result = await apiClient.post('/membership/renew', { planId, paymentMethod });
  return result.data;
}

export async function verifyMembershipPayment(details) {
  const result = await apiClient.post('/membership/razorpay/verify', details);
  return result.data;
}

export async function uploadMembershipVerificationDocument(file) {
  const formData = new FormData();
  formData.append('document', file);
  const result = await apiClient.postForm('/membership/verification-document', formData);
  return result.data;
}

export async function getIdentityVerification() {
  const result = await apiClient.get('/member/identity-verification');
  return result.data;
}

export async function submitIdentityVerification(values, files) {
  const formData = new FormData();
  Object.entries(values).forEach(([key, value]) => formData.append(key, String(value)));
  formData.append('panFront', files.panFront);
  if (files.panBack) formData.append('panBack', files.panBack);
  formData.append('secondFront', files.secondFront);
  formData.append('secondBack', files.secondBack);
  const result = await apiClient.putForm('/member/identity-verification', formData);
  return result.data;
}

export async function setOnboardingPassword(password) {
  const result = await apiClient.post('/auth/onboarding/set-password', { password });
  return result.user;
}

export async function listFamily() {
  const result = await apiClient.get('/member/family');
  return result.data;
}

export async function addFamilyMember(values, photo) {
  const result = await apiClient.postForm('/member/family', createFormData(values, photo));
  return result.data;
}

export async function updateFamilyMember(id, values, photo) {
  const result = await apiClient.putForm(`/member/family/${encodeURIComponent(id)}`, createFormData(values, photo));
  return result.data;
}

export async function deleteFamilyMember(id) {
  const result = await apiClient.delete(`/member/family/${encodeURIComponent(id)}`);
  return result.data;
}
