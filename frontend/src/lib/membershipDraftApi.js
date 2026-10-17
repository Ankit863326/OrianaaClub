import apiClient from './apiClient.js';

const base = '/membership/draft';

function createFormData(values, photo) {
  const formData = new FormData();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null) formData.append(key, String(value));
  });
  if (photo) formData.append('photo', photo);
  return formData;
}

export async function startMembershipDraft(values) {
  const result = await apiClient.post(`${base}/start`, values);
  return result.data;
}

export async function getMembershipDraft() {
  const result = await apiClient.get(base);
  return result.data;
}

export async function requestMembershipDraftPasswordLink(email) {
  const result = await apiClient.post(`${base}/password-link`, { email });
  return result.data;
}

export async function verifyMembershipDraftOtp(code) {
  const result = await apiClient.post(`${base}/verify-otp`, { code });
  return result.data;
}

export async function resendMembershipDraftOtp() {
  const result = await apiClient.post(`${base}/resend-otp`, {});
  return result.data;
}

export async function saveMembershipDraftProfile(values, photo) {
  const result = await apiClient.putForm(`${base}/profile`, createFormData(values, photo));
  return result.data;
}

export async function submitMembershipDraftIdentity(values, files) {
  const formData = new FormData();
  Object.entries(values).forEach(([key, value]) => formData.append(key, String(value)));
  formData.append('panFront', files.panFront);
  if (files.panBack) formData.append('panBack', files.panBack);
  formData.append('secondFront', files.secondFront);
  formData.append('secondBack', files.secondBack);
  const result = await apiClient.putForm(`${base}/identity-verification`, formData);
  return result.data;
}

export async function saveMembershipDraftPlan(planId) {
  const result = await apiClient.put(`${base}/plan`, { planId });
  return result.data;
}

export async function getMembershipDraftQuote(planId) {
  const result = await apiClient.post(`${base}/quote`, { planId });
  return result.data;
}

export async function saveMembershipDraftFamily(members) {
  const result = await apiClient.put(`${base}/family`, { members });
  return result.data;
}

export async function addMembershipDraftFamily(values, photo) {
  const result = await apiClient.postForm(`${base}/family`, createFormData(values, photo));
  return result.data;
}

export async function updateMembershipDraftFamily(id, values, photo) {
  const result = await apiClient.putForm(
    `${base}/family/${encodeURIComponent(id)}`,
    createFormData(values, photo),
  );
  return result.data;
}

export async function deleteMembershipDraftFamily(id) {
  const result = await apiClient.delete(`${base}/family/${encodeURIComponent(id)}`);
  return result.data;
}

export async function getMembershipDraftBankDetails() {
  const result = await apiClient.get(`${base}/bank-details`);
  return result.data;
}

export async function submitMembershipDraftPayment(body) {
  const result = await apiClient.post(`${base}/purchase`, body);
  return result.data;
}

export async function verifyMembershipDraftPayment(body) {
  const result = await apiClient.post(`${base}/razorpay/verify`, body);
  return result.data;
}
