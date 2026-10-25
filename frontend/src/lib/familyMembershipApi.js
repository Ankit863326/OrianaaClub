import apiClient from './apiClient.js';

const familyPath = (familyId) => `/member/family/${encodeURIComponent(familyId)}`;

export async function getFamilyVerification(familyId) {
  return (await apiClient.get(`${familyPath(familyId)}/verification`)).data;
}

export async function sendFamilyEmailCode(familyId) {
  return (await apiClient.post(`${familyPath(familyId)}/verification/code`)).data;
}

export async function confirmFamilyEmailCode(familyId, code) {
  return (await apiClient.post(`${familyPath(familyId)}/verification/code/confirm`, { code })).data;
}

export async function saveFamilyVerificationDraft(familyId, values) {
  return (await apiClient.put(`${familyPath(familyId)}/verification/draft`, values)).data;
}

export async function submitFamilyVerificationDocuments(familyId, values, files) {
  const formData = new FormData();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null) formData.append(key, String(value));
  });
  formData.append('document', files.document);
  if (files.extraDocument) formData.append('extraDocument', files.extraDocument);
  return (await apiClient.postForm(`${familyPath(familyId)}/verification/documents`, formData)).data;
}

export async function getFamilyCheckoutQuote(familyId) {
  return (await apiClient.get(`${familyPath(familyId)}/checkout`)).data;
}

export async function startFamilyCheckout(familyId) {
  return (await apiClient.post(`${familyPath(familyId)}/checkout`)).data;
}

export async function createFamilyCheckoutOrder(familyId) {
  return (await apiClient.post(`${familyPath(familyId)}/checkout/order`)).data;
}

export async function confirmFamilyCheckoutPayment(familyId, details) {
  return (await apiClient.post(`${familyPath(familyId)}/checkout/confirm`, details)).data;
}
