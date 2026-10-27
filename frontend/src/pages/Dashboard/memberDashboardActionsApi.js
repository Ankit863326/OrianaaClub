import apiClient from '../../lib/apiClient.js';

function getData(response) {
  return response?.data;
}

export async function getMyFamily() {
  return getData(await apiClient.get('/me/family'));
}

export async function requestFamilyMember(values, photo) {
  const formData = new FormData();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null) formData.append(key, String(value));
  });
  if (photo) formData.append('photo', photo);
  return getData(await apiClient.postForm('/me/family', formData));
}

export async function requestFamilyMemberUpdate(memberId, values) {
  return getData(await apiClient.put(`/me/family/${encodeURIComponent(memberId)}`, values));
}

export async function requestFamilyRemoval(memberId) {
  return getData(await apiClient.delete(`/me/family/${encodeURIComponent(memberId)}`));
}

export async function requestFamilyNominee(familyMemberId) {
  return getData(await apiClient.patch('/me/nominee', { familyMemberId }));
}

export async function getActiveMembershipPlans() {
  return getData(await apiClient.get('/membership/plans'));
}

export async function startMembershipRenewal(planId, paymentMethod) {
  return getData(await apiClient.post('/membership/renew', { planId, paymentMethod }));
}

export async function createRenewalOrder(paymentId) {
  return getData(await apiClient.post('/membership/razorpay/order', { paymentId }));
}

export async function verifyRenewalPayment(details) {
  return getData(await apiClient.post('/membership/razorpay/verify', details));
}

export function loadRazorpayCheckout() {
  if (window.Razorpay) return Promise.resolve();

  const existingScript = document.querySelector('script[data-razorpay-checkout]');
  if (existingScript) {
    return new Promise((resolve, reject) => {
      existingScript.addEventListener('load', resolve, { once: true });
      existingScript.addEventListener('error', reject, { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.razorpayCheckout = 'true';
    script.onload = resolve;
    script.onerror = () => {
      script.remove();
      reject(new Error('The secure payment window could not be loaded. Please try again.'));
    };
    document.body.appendChild(script);
  });
}
