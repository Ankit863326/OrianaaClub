import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AuthContext from '../context/auth-context.js';
import MembershipAll from './LuxuryMembershipStepOne/MembershipAll.jsx';

const jsonResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => 'application/json' },
  json: async () => body,
  text: async () => JSON.stringify(body),
});

const member = {
  profile: { fullName: 'Ari Member', gender: 'female', countryCode: '+91', mobile: '9876543210', dob: '1990-10-14', interestArea: 'Luxury Stays' },
  membership: null,
  family: [{ _id: 'family-old', fullName: 'Sam Member', gender: 'male', relationship: 'Child', dob: '2015-03-12' }],
};

const planRecord = {
  _id: 'plan-1', slug: 'gold', name: 'Gold Membership', title: 'Gold Membership',
  subtitle: 'Twenty years', price: 100000, maxFamilyMembers: 4,
  benefits: [{ points: 50000, label: 'Joining points' }],
};

function setUpApi(identityStatus = 'verified', {
  membership: currentMembership = member.membership,
  membershipGate = null,
} = {}) {
  fetch.mockImplementation(async (url, options = {}) => {
    const requestUrl = new URL(url);
    const path = requestUrl.pathname;
    const method = options.method || 'GET';
    if (path.endsWith('/member/me')) return jsonResponse({ data: { ...member, membership: currentMembership } });
    if (path.endsWith('/member/identity-verification')) return jsonResponse({ data: {
      status: method === 'PUT' ? 'pending' : identityStatus,
      panMask: 'ABCDE****F', idType: 'aadhaar', idMask: 'XXXX XXXX 9904',
      rejectionReason: '', documents: [],
    } });
    if (path.endsWith('/me/membership')) {
      return membershipGate ? jsonResponse({ data: membershipGate }) : jsonResponse({}, 404);
    }
    if (path.endsWith('/plans')) return jsonResponse({ data: [planRecord] });
    if (path.endsWith('/checkout/quote')) return jsonResponse({ data: { planFee: 10000000, gst: 1800000, total: 11800000, gstPercent: 18 } });
    if (path.endsWith('/gst-settings')) return jsonResponse({ data: { enabled: true, rate: 18, label: 'GST' } });
    if (path.endsWith('/membership/bank-details')) return jsonResponse({ data: {
      accountName: 'Orianaa Club',
      accountNumber: '1234567890',
      ifsc: 'TEST0001234',
      bank: 'Test Bank',
      branch: 'Mumbai',
    } });
    if (path.endsWith('/member/profile')) return jsonResponse({ data: member.profile });
    if (path.endsWith('/member/plan')) return jsonResponse({ data: { _id: 'membership-1', status: 'draft', plan: { _id: 'plan-1', slug: 'gold' } } });
    if (path.endsWith('/member/family') && method === 'POST') return jsonResponse({ data: { _id: 'family-new', fullName: 'Jo Member', gender: 'female', relationship: 'Spouse', dob: '1992-01-01' } });
    if (path.endsWith('/member/family/family-old') && method === 'PUT') return jsonResponse({ data: { ...member.family[0], fullName: 'Sam Updated' } });
    if (path.endsWith('/member/family/family-old') && method === 'DELETE') return jsonResponse({ data: { deleted: true } });
    if (path.endsWith('/member/checkout') && method === 'POST') return jsonResponse({ data: { _id: 'pending-1', status: 'pending_payment' } });
    if (path.endsWith('/payments/memberships/pending-1')) return jsonResponse({ data: {
      _id: 'pending-1', status: 'pending_payment', amount: 11800000, planFee: 10000000,
      gst: 1800000, gstRate: 18, gstEnabled: true, gstLabel: 'GST', currency: 'INR',
      plan: { name: 'Gold Membership' },
    } });
    if (path.endsWith('/membership/purchase')) return jsonResponse({ data: {
      paymentId: 'payment-record-1', membershipId: 'pending-1', status: 'pending_payment',
      paymentMethod: JSON.parse(options.body).paymentMethod, amount: 11800000, currency: 'INR',
      planFee: 10000000, gst: 1800000, gstRate: 18, gstEnabled: true, gstLabel: 'GST',
    } });
    if (path.endsWith('/auth/onboarding/set-password')) return jsonResponse({
      user: { email: 'member@example.test', status: 'active', passwordSet: true },
    });
    if (path.endsWith('/auth/onboarding/password-link')) {
      const email = JSON.parse(options.body).email;
      if (email === 'registered@example.test') {
        return jsonResponse({ message: 'This email is already registered. Please log in.' }, 409);
      }
      return jsonResponse({
        message: 'A password link has been sent.',
        sent: true,
        maskedEmail: 'm***@example.test',
      });
    }
    if (path.endsWith('/membership/razorpay/order')) return jsonResponse({ data: {
      keyId: 'test-key', orderId: 'order-1', amount: 11800000, currency: 'INR',
    } });
    if (path.endsWith('/membership/razorpay/verify')) return jsonResponse({ data: { status: 'active' } });
    throw new Error(`Unexpected offline test request: ${method} ${url}`);
  });
}

function renderMembership(
  route = '/luxury-membership?step=1',
  user = { email: 'member@example.test', status: 'active', emailVerified: true },
  refreshUser = jest.fn(),
) {
  return render(
    <AuthContext.Provider value={{ user, refreshUser }}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/luxury-membership" element={<MembershipAll />} />
          <Route path="/dashboard" element={<p>Member dashboard destination</p>} />
          <Route path="/login" element={<p>Login destination</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

// Each endpoint is resolved from an in-memory response; payment uses a fake SDK object.
describe('integrated membership application and payment flow', () => {
  beforeEach(() => {
    fetch.mockReset();
    URL.createObjectURL = jest.fn((file) => `blob:${file.name}`);
    URL.revokeObjectURL = jest.fn();
    setUpApi();
  });

  test('saves personal details, chooses a plan, manages family, reviews and completes mocked payment', async () => {
    const paymentSdk = {
      on: jest.fn(),
      open: jest.fn(),
    };
    window.Razorpay = jest.fn(() => paymentSdk);
    const { container } = renderMembership();

    expect(await screen.findByRole('heading', { name: 'Your Orianaa Club Membership' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to Personal Details' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Ari Member' } });
    fireEvent.change(screen.getByLabelText('Mobile number'), { target: { value: '9876543210' } });
    fireEvent.change(screen.getByLabelText('Date of birth'), { target: { value: '1990-10-14' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save & Continue' }));

    expect(await screen.findByRole('button', { name: 'Select Plan' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Select Plan' }));
    expect(await screen.findByRole('heading', { name: 'Family members' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('Full name')).toHaveValue('Sam Member');
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Sam Updated' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update member' }));
    expect(await screen.findByText(/Sam Updated/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Sam Updated' }));
    await waitFor(() => expect(screen.queryByText(/Sam Updated/)).not.toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Jo Member' } });
    fireEvent.change(screen.getByLabelText('Date of birth'), { target: { value: '1992-01-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add family member' }));
    expect(await screen.findByText(/Jo Member/)).toBeInTheDocument();

    const continueButton = screen.getByRole('button', { name: 'Continue to review' });
    await waitFor(() => expect(continueButton).toBeEnabled());
    await act(async () => {
      fireEvent.click(continueButton);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(await screen.findByRole('heading', { name: 'Personal Details' })).toBeInTheDocument();
    expect(screen.getByText('14 Oct 1990')).toBeInTheDocument();
    expect(screen.getByText('50,000 points')).toBeInTheDocument();
    expect(await screen.findByText('₹1,18,000')).toBeInTheDocument();
    const confirmPayment = screen.getByRole('button', { name: 'Confirm & Proceed to Payment' });
    await waitFor(() => expect(confirmPayment).toBeEnabled());
    await act(async () => {
      fireEvent.click(confirmPayment);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(await screen.findByRole('heading', { name: 'Select Payment Method' })).toBeInTheDocument();
    expect(await screen.findByText('Plan fee')).toBeInTheDocument();
    expect(screen.getByText('GST (18%)')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getAllByText('₹1,18,000').length).toBeGreaterThan(0);
    expect(screen.queryByLabelText('Cash')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Card'));
    expect(screen.getByLabelText('Card')).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Pay Securely' }));
    await waitFor(() => expect(window.Razorpay).toHaveBeenCalled());
    expect(paymentSdk.open).toHaveBeenCalled();
    expect(paymentSdk.on).toHaveBeenCalledWith('payment.failed', expect.any(Function));
    const checkoutOptions = window.Razorpay.mock.calls[0][0];
    await act(async () => {
      await checkoutOptions.handler({
        razorpay_order_id: 'order-1',
        razorpay_payment_id: 'payment-1',
        razorpay_signature: 'signature',
      });
    });
    expect(await screen.findByText('Member dashboard destination')).toBeInTheDocument();
    expect(fetch.mock.calls.some(([url]) => String(url).includes('/membership/razorpay/verify'))).toBe(true);
    expect(container).toBeInTheDocument();
  });

  test('restores pending payment details directly from the route token', async () => {
    renderMembership('/luxury-membership?step=5&membershipId=pending-1');
    expect(await screen.findByRole('heading', { name: 'Select Payment Method' })).toBeInTheDocument();
    expect(screen.getByText(/Gold Membership/)).toBeInTheDocument();
    expect(fetch.mock.calls.some(([url]) => String(url).endsWith('/payments/memberships/pending-1'))).toBe(true);
  });

  test('shows RTGS bank details and submits the GST-inclusive RTGS payment data', async () => {
    renderMembership('/luxury-membership?step=5&membershipId=pending-1');
    expect(await screen.findByRole('heading', { name: 'Select Payment Method' })).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('RTGS'));
    expect(await screen.findByText('1234567890')).toBeInTheDocument();
    expect(screen.getByText('₹1,18,000')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('RTGS UTR / reference number'), { target: { value: 'ABCD12345678' } });
    fireEvent.change(screen.getByLabelText('Transfer date'), { target: { value: '2026-04-10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit payment method' }));
    await waitFor(() => {
      const request = fetch.mock.calls.find(([url]) => String(url).endsWith('/membership/purchase'));
      expect(request).toBeDefined();
      expect(JSON.parse(request[1].body)).toMatchObject({
        paymentMethod: 'rtgs',
        rtgsDetails: { utr: 'ABCD12345678', transferDate: '2026-04-10' },
      });
    });
    expect(await screen.findByText(/Payment method saved/)).toBeInTheDocument();
  });

  test('requires identity documents and only emails the password link after an explicit click', async () => {
    setUpApi('not_submitted');
    const refreshUser = jest.fn();
    const onboardingUser = {
      email: 'member@example.test',
      status: 'pending',
      emailVerified: true,
      onboarding: true,
    };
    renderMembership(
      '/luxury-membership?step=1',
      onboardingUser,
      refreshUser,
    );

    expect(await screen.findByRole('heading', { name: 'Document Verification' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/PAN number/), { target: { value: 'abcde1234f' } });
    fireEvent.change(screen.getByLabelText(/Document number/), { target: { value: '236323869904' } });
    const image = new File([new Uint8Array([1, 2, 3])], 'identity.png', { type: 'image/png' });
    const panBackPdf = new File(['%PDF-1.4'], 'pan-back.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('PAN card back upload'), { target: { files: [panBackPdf] } });
    ['PAN card front', 'aadhaar front', 'aadhaar back'].forEach((label) => {
      fireEvent.change(screen.getByLabelText(`${label} upload`), { target: { files: [image] } });
    });
    fireEvent.click(screen.getByLabelText(
      'I consent to Orianaa Club storing my identity documents for membership verification.',
    ));
    fireEvent.click(screen.getByRole('button', { name: 'Save & Continue' }));

    expect(await screen.findByRole('button', { name: 'Select Plan' })).toBeInTheDocument();
    const identityRequest = fetch.mock.calls.find(([url, options]) => String(url).endsWith('/member/identity-verification')
      && options.method === 'PUT');
    expect(identityRequest).toBeDefined();
    expect(identityRequest[1].body.get('panBack')).toBe(panBackPdf);
    fireEvent.click(screen.getByRole('button', { name: 'Select Plan' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Continue to review' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirm & Proceed to Payment' })).toBeEnabled());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Confirm & Proceed to Payment' }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(await screen.findByRole('heading', { name: 'Select Payment Method' })).toBeInTheDocument();
    fireEvent.click(await screen.findByLabelText('RTGS'));
    fireEvent.change(screen.getByLabelText('RTGS UTR / reference number'), { target: { value: 'ABCD12345678' } });
    fireEvent.change(screen.getByLabelText('Transfer date'), { target: { value: '2026-04-10' } });
    expect(await screen.findByText('1234567890')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit payment method' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Submit payment method' }));

    expect(await screen.findByLabelText('Email')).toHaveValue('member@example.test');
    expect(fetch.mock.calls.some(([url]) => String(url).endsWith('/auth/onboarding/password-link'))).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Send password setup link' }));
    expect(await screen.findByText('Password link sent to m***@example.test')).toBeInTheDocument();
    const linkRequest = fetch.mock.calls.find(([url]) => String(url).endsWith('/auth/onboarding/password-link'));
    expect(JSON.parse(linkRequest[1].body)).toEqual({ email: 'member@example.test' });
    expect(await screen.findByRole('button', { name: 'Resend in 60s' })).toBeDisabled();
    expect(refreshUser).not.toHaveBeenCalled();
  });

  test('blocks an active account email when editing the password-link address', async () => {
    const onboardingUser = {
      email: 'member@example.test',
      status: 'pending',
      emailVerified: true,
      onboarding: true,
    };
    renderMembership('/luxury-membership?step=6', onboardingUser);

    const emailField = await screen.findByLabelText('Email');
    fireEvent.change(emailField, { target: { value: 'registered@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send password setup link' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This email is already registered. Please log in.',
    );
    expect(emailField).toHaveValue('registered@example.test');
  });

  test('prefills the payment-step email and sends a password link only after submission', async () => {
    const onboardingUser = {
      email: 'member@example.test',
      status: 'pending',
      emailVerified: true,
      onboarding: true,
    };
    renderMembership('/luxury-membership?step=6', onboardingUser);

    const emailField = await screen.findByLabelText('Email');
    expect(emailField).toHaveValue('member@example.test');
    expect(fetch.mock.calls.some(([url]) => String(url).endsWith('/auth/onboarding/password-link'))).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Send password setup link' }));
    expect(await screen.findByText('Password link sent to m***@example.test')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Resend in 60s' })).toBeDisabled();
    const linkRequest = fetch.mock.calls.find(([url]) => String(url).endsWith('/auth/onboarding/password-link'));
    expect(JSON.parse(linkRequest[1].body)).toEqual({ email: 'member@example.test' });
  });

  test('routes an Admin-paid legacy membership from document submission directly to password setup', async () => {
    const adminMembership = {
      _id: 'admin-membership-1',
      planModel: 'Plan',
      status: 'pending_verification',
      plan: { _id: 'legacy-plan', title: 'Legacy Plan' },
    };
    setUpApi('not_submitted', {
      membership: adminMembership,
      membershipGate: { status: 'pending_verification', canRenew: false },
    });
    const onboardingUser = {
      email: 'member@example.test',
      status: 'pending',
      emailVerified: true,
      onboarding: true,
    };
    renderMembership('/luxury-membership?step=1', onboardingUser);

    expect(await screen.findByRole('heading', { name: 'Document Verification' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/PAN number/), { target: { value: 'abcde1234f' } });
    fireEvent.change(screen.getByLabelText(/Document number/), { target: { value: '236323869904' } });
    const image = new File([new Uint8Array([1, 2, 3])], 'identity.png', { type: 'image/png' });
    for (const label of ['PAN card front', 'aadhaar front', 'aadhaar back']) {
      fireEvent.change(screen.getByLabelText(`${label} upload`), { target: { files: [image] } });
    }
    fireEvent.click(screen.getByLabelText(
      'I consent to Orianaa Club storing my identity documents for membership verification.',
    ));
    fireEvent.click(screen.getByRole('button', { name: 'Save & Continue' }));

    expect(await screen.findByLabelText('Email')).toHaveValue('member@example.test');
    expect(screen.queryByRole('button', { name: 'Select Plan' })).not.toBeInTheDocument();
    expect(fetch.mock.calls.some(([url, options]) => String(url).endsWith('/member/identity-verification')
      && options.method === 'PUT')).toBe(true);
  });

  test('keeps identity uploads contained, validates files, and resets only the selected second ID', async () => {
    setUpApi('not_submitted');
    const onboardingUser = {
      email: 'member@example.test',
      status: 'pending',
      emailVerified: true,
      onboarding: true,
    };
    const { unmount } = renderMembership('/luxury-membership?step=1', onboardingUser);
    expect(await screen.findByRole('heading', { name: 'Document Verification' })).toBeInTheDocument();

    const panInput = screen.getByLabelText(/PAN number/);
    fireEvent.change(panInput, { target: { value: 'abcde1234f' } });
    expect(screen.getByLabelText(/PAN number/)).toHaveValue('ABCDE1234F');
    const fiveMbPhoto = new File([new Uint8Array(5 * 1024 * 1024)], 'portrait-phone-photo.jpg', {
      type: 'image/jpeg',
    });
    fireEvent.change(screen.getByLabelText('PAN card front upload'), {
      target: { files: [fiveMbPhoto] },
    });
    expect(await screen.findByAltText('PAN card front preview')).toHaveAttribute(
      'src',
      'blob:portrait-phone-photo.jpg',
    );
    expect(screen.getByText('5.0 MB')).toBeInTheDocument();
    expect(screen.getByAltText('PAN card front preview').closest('.jm-identity-upload'))
      .toHaveClass('is-filled');
    const replacementPhoto = new File(['replacement'], 'replacement.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('PAN card front upload'), {
      target: { files: [replacementPhoto] },
    });
    expect(await screen.findByAltText('PAN card front preview')).toHaveAttribute(
      'src',
      'blob:replacement.png',
    );
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:portrait-phone-photo.jpg');

    const panBackPdf = new File(['%PDF-1.4'], 'pan-back.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('PAN card back upload'), {
      target: { files: [panBackPdf] },
    });
    expect(await screen.findByText('PDF document')).toBeInTheDocument();
    expect(screen.getByText('pan-back.pdf')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Document number (required)'), {
      target: { value: '236323869904' },
    });
    const secondFront = new File(['front'], 'id-front.png', { type: 'image/png' });
    const secondBack = new File(['back'], 'id-back.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('aadhaar front upload'), {
      target: { files: [secondFront] },
    });
    fireEvent.change(screen.getByLabelText('aadhaar back upload'), {
      target: { files: [secondBack] },
    });

    fireEvent.change(screen.getByLabelText('Second ID type'), { target: { value: 'passport' } });
    expect(screen.getByLabelText(/PAN number/)).toHaveValue('ABCDE1234F');
    expect(screen.getByText('replacement.png')).toBeInTheDocument();
    expect(screen.getByText('pan-back.pdf')).toBeInTheDocument();
    expect(screen.getByLabelText('Document number (required)')).toHaveValue('');
    expect(screen.queryByText('id-front.png')).not.toBeInTheDocument();
    expect(screen.queryByText('id-back.png')).not.toBeInTheDocument();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:id-front.png');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:id-back.png');

    const wrongFile = new File(['not an image'], 'wrong-type.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByLabelText('passport front upload'), {
      target: { files: [wrongFile] },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That file type is not supported. Choose a JPG, PNG, or PDF.',
    );
    const oversizedFile = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'too-large.png', {
      type: 'image/png',
    });
    fireEvent.change(screen.getByLabelText('passport front upload'), {
      target: { files: [oversizedFile] },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That file is larger than 5 MB. Choose a smaller file.',
    );

    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:replacement.png');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:pan-back.pdf');
  });

  test('keeps the buy-plan wizard hidden for an active member', async () => {
    fetch.mockImplementation(async (url) => {
      const path = new URL(url).pathname;
      if (path.endsWith('/me/membership')) {
        return jsonResponse({ data: { status: 'active', canRenew: false, tier: 'Gold', pointsBalance: 5000 } });
      }
      if (path.endsWith('/member/me')) return jsonResponse({ data: member });
      if (path.endsWith('/plans')) return jsonResponse({ data: [planRecord] });
      throw new Error(`Unexpected active-member test request: ${url}`);
    });

    renderMembership();

    expect(await screen.findByText(/You already have an active membership/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Select Plan' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Your Orianaa Club Membership' })).not.toBeInTheDocument();
  });
});
