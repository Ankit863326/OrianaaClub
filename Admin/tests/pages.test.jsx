import { jest } from '@jest/globals';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import api from '../src/api/client.js';
import { adminApi } from '../src/api/admin.js';
import { useAuth } from '../src/auth/AuthContext.jsx';
import DashboardPage from '../src/pages/DashboardPage.jsx';
import LoginPage from '../src/pages/LoginPage.jsx';
import ResetPasswordPage from '../src/pages/ResetPasswordPage.jsx';
import MembersPage from '../src/pages/MembersPage.jsx';
import MemberDetailPage from '../src/pages/MemberDetailPage.jsx';
import PlansPage from '../src/pages/PlansPage.jsx';
import PointsPage from '../src/pages/PointsPage.jsx';
import PaymentsPage from '../src/pages/PaymentsPage.jsx';
import OperationsPage from '../src/pages/OperationsPage.jsx';

// Every page receives fake API results so assertions cover user-visible behavior without network access.
jest.mock('../src/api/admin.js', () => ({
  adminApi: {
    dashboard: jest.fn(), members: jest.fn(), plans: jest.fn(), member: jest.fn(), createMember: jest.fn(),
    updateMember: jest.fn(), memberAction: jest.fn(), deleteMember: jest.fn(), updateFamily: jest.fn(),
    deleteFamily: jest.fn(), memberPoints: jest.fn(), points: jest.fn(), payments: jest.fn(), payment: jest.fn(),
    paymentAction: jest.fn(), content: jest.fn(), createContent: jest.fn(), updateContent: jest.fn(),
    deleteContent: jest.fn(), admins: jest.fn(), createAdmin: jest.fn(), setAdminStatus: jest.fn(),
    updatePlan: jest.fn(), createPlan: jest.fn(),
    enquiries: jest.fn(), setEnquiryStatus: jest.fn(), addEnquiryNote: jest.fn(), audit: jest.fn(),
    emails: jest.fn(), reports: jest.fn(),
  },
  downloadCsv: jest.fn(),
}));

const plan = {
  _id: 'plan-1', slug: 'gold', title: 'Gold Plan', subtitle: 'Gold tier', price: 12000,
  gstPercent: 18, planFee: 10000, maxFamilyMembers: 1, sortOrder: 1,
  isActive: true, isFeatured: false, pointsTiers: [{ from: 1, to: 100, points: 100 }],
};
const memberRecord = {
  _id: 'member-1', firstName: 'Asha', email: 'asha@example.invalid', status: 'active',
  user: { firstName: 'Asha', email: 'asha@example.invalid', status: 'active' },
  profile: { fullName: 'Asha Rao', mobile: '9876543210', gender: 'female', dob: '1990-01-02' },
  membership: { memberId: 'OC-0001', status: 'active', pointsBalance: 250, plan: { title: 'Gold Plan' } },
  family: [], payments: [], points: [],
};
const dashboard = {
  members: { total: 12, byStatus: { active: 10 }, signupsLast30Days: [{ date: '2025-01-01', count: 2 }] },
  revenue: { totalAmount: 123400, paidPayments: 4, monthly: [{ month: '2025-01', totalAmount: 123400 }] },
  pendingBankTransfers: 2, points: { issued: 500, spent: 80 }, planCounts: [{ plan: 'Gold Plan', count: 8 }],
};
const payment = {
  _id: 'payment-1', user: { firstName: 'Asha' }, plan: { title: 'Gold Plan' }, method: 'bank_transfer',
  status: 'pending_verification', baseAmount: 1000000, gstAmount: 180000, totalAmount: 1180000,
  invoiceNumber: 'INV-1', utr: 'UTR-1',
};

jest.mock('../src/auth/AuthContext.jsx', () => ({
  useAuth: jest.fn(() => ({ user: { id: 'admin-1', firstName: 'Admin', email: 'admin@example.invalid' }, logout: jest.fn() })),
  AuthProvider: ({ children }) => children,
}));

function withRoute(element, route = '/') {
  return render(<MemoryRouter initialEntries={[route]}>{element}</MemoryRouter>);
}

beforeEach(() => {
  Object.values(adminApi).forEach((method) => method.mockReset?.());
  adminApi.dashboard.mockResolvedValue(dashboard);
  adminApi.members.mockResolvedValue({ items: [memberRecord], page: 1, pages: 2, total: 21 });
  adminApi.plans.mockResolvedValue({ items: [plan], page: 1, pages: 1, total: 1 });
  adminApi.member.mockResolvedValue(memberRecord);
  adminApi.updatePlan.mockResolvedValue({});
  adminApi.createPlan.mockResolvedValue({});
  adminApi.createMember.mockResolvedValue({ activationEmailSent: true });
  adminApi.updateMember.mockResolvedValue({});
  adminApi.memberAction.mockResolvedValue({});
  adminApi.deleteMember.mockResolvedValue({});
  adminApi.updateFamily.mockResolvedValue({});
  adminApi.deleteFamily.mockResolvedValue({});
  adminApi.memberPoints.mockResolvedValue({ balance: 100, history: { items: [] } });
  adminApi.points.mockResolvedValue({ succeeded: 2, total: 2 });
  adminApi.payments.mockResolvedValue({ items: [payment], page: 1, pages: 1, total: 1 });
  adminApi.payment.mockResolvedValue(payment);
  adminApi.paymentAction.mockResolvedValue({});
  adminApi.content.mockResolvedValue({ items: [{ _id: 'content-1', title: 'Editorial story', status: 'published' }], page: 1, pages: 1, total: 1 });
  adminApi.createContent.mockResolvedValue({});
  adminApi.updateContent.mockResolvedValue({});
  adminApi.deleteContent.mockResolvedValue({});
  adminApi.admins.mockResolvedValue({ items: [{ _id: 'admin-2', firstName: 'Ravi', email: 'ravi@example.invalid', status: 'active' }], page: 1, pages: 1, total: 1 });
  adminApi.createAdmin.mockResolvedValue({ activationEmailSent: true });
  adminApi.setAdminStatus.mockResolvedValue({});
  adminApi.enquiries.mockResolvedValue({ items: [{ _id: 'enquiry-1', name: 'Mira', email: 'mira@example.invalid', type: 'contact', status: 'new', message: 'Please call me.', internalNotes: [] }], page: 1, pages: 1, total: 1 });
  adminApi.setEnquiryStatus.mockResolvedValue({});
  adminApi.addEnquiryNote.mockResolvedValue({});
  adminApi.audit.mockResolvedValue({ items: [{ _id: 'audit-1', action: 'member.updated', entityType: 'member', summary: 'Updated record', admin: { email: 'admin@example.invalid' } }], page: 1, pages: 1, total: 1 });
  adminApi.emails.mockResolvedValue({ items: [{ _id: 'email-1', to: 'mira@example.invalid', template: 'activation', status: 'sent' }], page: 1, pages: 1, total: 1 });
  adminApi.reports.mockResolvedValue({ membersByPlan: [{ plan: 'Gold Plan', members: 8 }], revenueByMonth: [], pointsByMonth: [] });
});

describe('dashboard and member administration', () => {
  test('shows dashboard totals, charts, and a visible failure instead of an empty success state', async () => {
    withRoute(<DashboardPage />);
    expect(await screen.findByText('Total members')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Members by plan')).toBeInTheDocument();

    adminApi.dashboard.mockRejectedValueOnce({ response: { status: 503, data: { message: 'Dashboard unavailable' } } });
    withRoute(<DashboardPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Dashboard unavailable');
  });

  test('searches, filters, paginates, validates, and creates a member', async () => {
    withRoute(<MembersPage />);
    expect(await screen.findByText('Asha Rao')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Search members' }), { target: { value: 'Asha' } });
    await waitFor(() => expect(adminApi.members).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'Asha', page: 1 })));
    fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'active' } });
    await waitFor(() => expect(adminApi.members).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'active' })));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(adminApi.members).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));

    fireEvent.click(screen.getByRole('button', { name: 'Add member' }));
    const submit = screen.getByRole('button', { name: 'Create member and send activation' });
    expect(screen.getByLabelText('Email')).toBeRequired();
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Mira' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'mira@example.invalid' } });
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Mira Rao' } });
    fireEvent.change(screen.getByLabelText('Country code'), { target: { value: '+91' } });
    fireEvent.change(screen.getByLabelText('Mobile'), { target: { value: '9876543210' } });
    fireEvent.change(screen.getByLabelText('Date of birth'), { target: { value: '1995-01-02' } });
    fireEvent.change(screen.getByLabelText('Interest area'), { target: { value: 'Travel' } });
    fireEvent.change(screen.getByLabelText('Plan'), { target: { value: 'gold' } });
    fireEvent.click(submit);
    await waitFor(() => expect(adminApi.createMember).toHaveBeenCalledWith(expect.objectContaining({
      user: expect.objectContaining({ firstName: 'Mira' }),
      profile: expect.objectContaining({ fullName: 'Mira Rao' }),
      planSlug: 'gold',
    })));
    expect(await screen.findByText(/activation email sent/i)).toBeInTheDocument();
  });

  test('member detail tabs show profile, membership, family, payments and ledger; confirms suspension and deletion', async () => {
    render(<MemoryRouter initialEntries={['/members/member-1']}><Routes>
      <Route path="/members/:userId" element={<MemberDetailPage />} />
    </Routes></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Asha Rao' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Membership' }));
    expect(screen.getByText('Gold Plan')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Family' }));
    expect(screen.getByText('This member has no family members on file.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Payments' }));
    expect(screen.getByText('No payments are associated with this member.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Points' }));
    expect(screen.getByText('Ledger summary')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Profile' }));
    fireEvent.click(screen.getByRole('button', { name: 'Suspend' }));
    fireEvent.click(screen.getByRole('button', { name: 'suspend' }));
    await waitFor(() => expect(adminApi.memberAction).toHaveBeenCalledWith('member-1', 'suspend'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'delete' }));
    await waitFor(() => expect(adminApi.deleteMember).toHaveBeenCalledWith('member-1'));
  });

  test('updates a profile and edits then removes a family member', async () => {
    adminApi.member.mockResolvedValue({
      ...memberRecord,
      family: [{ _id: 'family-1', fullName: 'Ravi Rao', relationship: 'Brother', gender: 'male', dob: '2000-02-03T00:00:00.000Z' }],
    });
    render(<MemoryRouter initialEntries={['/members/member-1']}><Routes>
      <Route path="/members/:userId" element={<MemberDetailPage />} />
    </Routes></MemoryRouter>);
    expect(await screen.findByLabelText('First name')).toHaveValue('Asha');
    fireEvent.change(screen.getByLabelText('Interest area'), { target: { value: 'Wellness' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    await waitFor(() => expect(adminApi.updateMember).toHaveBeenCalledWith('member-1', expect.objectContaining({ interestArea: 'Wellness' })));
    fireEvent.click(screen.getByRole('button', { name: 'Family' }));
    expect(await screen.findByText('Ravi Rao')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Ravi Updated' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save family member' }));
    await waitFor(() => expect(adminApi.updateFamily).toHaveBeenCalledWith('member-1', 'family-1', expect.objectContaining({ fullName: 'Ravi Updated' })));
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete', exact: true }).at(-1));
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete', exact: true }).at(-1));
    await waitFor(() => expect(adminApi.deleteFamily).toHaveBeenCalledWith('member-1', 'family-1'));
  });

  test('shows a member API error and supports pending activation resend', async () => {
    adminApi.member.mockRejectedValueOnce({ response: { status: 503, data: { message: 'Member unavailable' } } });
    withRoute(<MemberDetailPage />, '/members/member-1');
    expect(await screen.findByRole('alert')).toHaveTextContent('Member unavailable');

    adminApi.member.mockResolvedValueOnce({
      ...memberRecord, user: { ...memberRecord.user, status: 'pending' },
    });
    render(<MemoryRouter initialEntries={['/members/member-1']}><Routes>
      <Route path="/members/:userId" element={<MemberDetailPage />} />
    </Routes></MemoryRouter>);
    expect(await screen.findByRole('button', { name: 'Resend activation' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Resend activation' }));
    await waitFor(() => expect(adminApi.memberAction).toHaveBeenCalledWith('member-1', 'resend-activation'));
  });
});

describe('plans, points, and payments', () => {
  test('edits plan details and reports invalid points tier JSON', async () => {
    withRoute(<PlansPage />);
    expect(await screen.findByText('Gold Plan')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const tiers = screen.getByLabelText('Points tiers (JSON)');
    fireEvent.change(tiers, { target: { value: '{not-json' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save plan' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Points tiers must be valid JSON.');
    fireEvent.change(tiers, { target: { value: '[{"from":1,"to":50,"points":2}]' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save plan' }));
    await waitFor(() => expect(adminApi.updatePlan).toHaveBeenCalledWith('plan-1', expect.objectContaining({
      pointsTiers: [{ from: 1, to: 50, points: 2 }],
    })));
  });

  test('requires reason and positive integer points, then supports single and bulk credits', async () => {
    withRoute(<PointsPage />);
    const amount = screen.getByLabelText('Amount (points)');
    const reason = screen.getByLabelText('Reason');
    expect(amount).toHaveAttribute('min', '1');
    expect(amount).toHaveAttribute('step', '1');
    expect(reason).toBeRequired();
    fireEvent.change(amount, { target: { value: '1.5' } });
    expect(amount.checkValidity()).toBe(false);
    fireEvent.change(screen.getByLabelText('Membership ID'), { target: { value: 'membership-1' } });
    fireEvent.change(amount, { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit adjustment' }));
    expect(adminApi.points).not.toHaveBeenCalled();
    fireEvent.change(reason, { target: { value: 'Service recovery' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit adjustment' }));
    await waitFor(() => expect(adminApi.points).toHaveBeenCalledWith(expect.objectContaining({
      amount: 5, reason: 'Service recovery', type: 'credit', membershipId: 'membership-1',
    })));
    expect(await screen.findByRole('status')).toHaveTextContent('Points credited successfully.');
    fireEvent.change(screen.getByLabelText('Action'), { target: { value: 'bulk' } });
    fireEvent.change(screen.getByLabelText('Plan slug'), { target: { value: 'gold' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit adjustment' }));
    await waitFor(() => expect(adminApi.points).toHaveBeenLastCalledWith(expect.objectContaining({
      amount: 5, filter: { planSlug: 'gold' },
    })));
    fireEvent.change(screen.getByLabelText('Action'), { target: { value: 'debit' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit adjustment' }));
    await waitFor(() => expect(adminApi.points).toHaveBeenLastCalledWith(expect.objectContaining({ amount: 5, type: 'debit' })));
    fireEvent.change(screen.getByLabelText('Member user ID'), { target: { value: 'user-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Load history' }));
    await waitFor(() => expect(adminApi.memberPoints).toHaveBeenCalledWith('user-1', { page: 1, limit: 30 }));
    expect(await screen.findByText(/Current balance:/)).toHaveTextContent('100');
  });

  test('reviews bank transfers and submits an approval confirmation', async () => {
    cleanup();
    withRoute(<PaymentsPage />);
    expect(await screen.findByText('Asha')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    expect(await screen.findByText('Payment review')).toBeInTheDocument();
    expect(screen.getByText(/UTR-1/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Approve transfer' }));
    fireEvent.click(screen.getByRole('button', { name: 'approve' }));
    await waitFor(() => expect(adminApi.paymentAction).toHaveBeenCalledWith('payment-1', 'approve', {}));
  });

  test('rejects bank transfers with a reason and refunds Razorpay with points reversal', async () => {
    withRoute(<PaymentsPage />);
    expect(await screen.findByText('Asha')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    await screen.findByText('Payment review');
    fireEvent.click(screen.getByRole('button', { name: 'Reject transfer' }));
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Transfer could not be verified' } });
    fireEvent.click(screen.getByRole('button', { name: 'reject' }));
    await waitFor(() => expect(adminApi.paymentAction).toHaveBeenCalledWith('payment-1', 'reject', {
      reason: 'Transfer could not be verified',
    }));

    adminApi.payments.mockResolvedValueOnce({ items: [{ ...payment, method: 'razorpay', status: 'paid' }], page: 1, pages: 1, total: 1 });
    adminApi.payment.mockResolvedValueOnce({ ...payment, method: 'razorpay', status: 'paid' });
    cleanup();
    withRoute(<PaymentsPage />);
    expect(await screen.findByText('Asha')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    await screen.findByText('Payment review');
    fireEvent.click(screen.getByRole('button', { name: 'Refund' }));
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Member request' } });
    fireEvent.change(screen.getByLabelText('Refund amount (INR)'), { target: { value: '125.50' } });
    fireEvent.click(screen.getByLabelText('Reverse awarded points'));
    fireEvent.click(screen.getByRole('button', { name: 'refund' }));
    await waitFor(() => expect(adminApi.paymentAction).toHaveBeenLastCalledWith('payment-1', 'refund', {
      amount: 12550, reason: 'Member request', reversePoints: true,
    }));
  });
});

describe('login and reset password pages', () => {
  beforeEach(() => { api.post.mockReset(); });

  test('shows sign-in errors, forgot-password feedback, and successful sign-in calls', async () => {
    const login = jest.fn().mockRejectedValueOnce({ response: { status: 401, data: { message: 'Invalid credentials' } } });
    useAuth.mockReturnValue({ user: null, loading: false, login });
    withRoute(<LoginPage />);
    fireEvent.change(screen.getByLabelText('Administrator email'), { target: { value: 'admin@example.invalid' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'WrongPassword1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in securely' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials');
    expect(login).toHaveBeenCalledWith({ email: 'admin@example.invalid', password: 'WrongPassword1' });
    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
    fireEvent.click(screen.getByRole('link', { name: /Back to sign in/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
    fireEvent.change(screen.getByLabelText('Administrator email'), { target: { value: 'admin@example.invalid' } });
    api.post.mockResolvedValueOnce({ data: { message: 'If the account exists, a reset link will be sent.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByRole('status')).toHaveTextContent('If the account exists');
  });

  test('validates reset password confirmation and reports token/API outcomes', async () => {
    withRoute(<ResetPasswordPage />, '/reset-password?token=one-time-token');
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'ValidPass1' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'Different1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Passwords do not match.');
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'ValidPass1' } });
    api.post.mockResolvedValueOnce({ data: { message: 'ok' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }));
    expect(await screen.findByText('Your password has been reset. You can now sign in.')).toBeInTheDocument();
  });
});

describe('all operations routes render API records and visible errors', () => {
  const cases = [
    ['posts', /Blog Posts/, 'Editorial story'],
    ['events', /Events/, 'Editorial story'],
    ['enquiries', /Enquiries/, 'Mira'],
    ['admins', /Administrators/, 'Ravi'],
    ['audit', /Audit Log/, 'member.updated'],
    ['email', /Email Log/, 'activation'],
    ['reports', /Reports/, 'Members by plan'],
  ];

  test.each(cases)('%s loads content from the API', async (type, title, text) => {
    withRoute(<OperationsPage type={type} />);
    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument();
    expect(await screen.findByText(text)).toBeInTheDocument();
  });

  test('shows API failures in the UI instead of treating them as empty results', async () => {
    adminApi.content.mockRejectedValueOnce({ response: { status: 500, data: { message: 'Content unavailable' } } });
    withRoute(<OperationsPage type="posts" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Content unavailable');
    expect(screen.queryByText('No posts have been created yet.')).not.toBeInTheDocument();
  });

  test('opens an enquiry, changes status, and adds an internal note', async () => {
    withRoute(<OperationsPage type="enquiries" />);
    expect(await screen.findByText('Mira')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(await screen.findByText('Please call me.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'contacted' } });
    await waitFor(() => expect(adminApi.setEnquiryStatus).toHaveBeenCalledWith('enquiry-1', 'contacted'));
    fireEvent.change(screen.getByLabelText('Add internal note'), { target: { value: 'Called today' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add note' }));
    await waitFor(() => expect(adminApi.addEnquiryNote).toHaveBeenCalledWith('enquiry-1', 'Called today'));
  });

  test('invites an administrator and creates an event using validated fields', async () => {
    withRoute(<OperationsPage type="admins" />);
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Amit' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'amit@example.invalid' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send activation invitation' }));
    await waitFor(() => expect(adminApi.createAdmin).toHaveBeenCalledWith({
      firstName: 'Amit', email: 'amit@example.invalid',
    }));

    withRoute(<OperationsPage type="events" />);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Club dinner' } });
    fireEvent.change(screen.getByLabelText('Slug'), { target: { value: 'club-dinner' } });
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-14' } });
    fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Mumbai' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'An evening together' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(adminApi.createContent).toHaveBeenCalledWith('events', expect.any(FormData)));
  });

  test('creates and removes blog content and confirms admin status changes', async () => {
    withRoute(<OperationsPage type="posts" />);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'New article' } });
    fireEvent.change(screen.getByLabelText('Slug'), { target: { value: 'new-article' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Travel' } });
    fireEvent.change(screen.getByLabelText('Excerpt'), { target: { value: 'A short introduction.' } });
    fireEvent.change(screen.getByLabelText('Article content'), { target: { value: 'Full article content.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(adminApi.createContent).toHaveBeenCalledWith('posts', expect.any(FormData)));
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(adminApi.deleteContent).toHaveBeenCalledWith('posts', 'content-1'));
    confirm.mockRestore();

    withRoute(<OperationsPage type="admins" />);
    const statusConfirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(await screen.findByRole('button', { name: 'Deactivate' }));
    await waitFor(() => expect(adminApi.setAdminStatus).toHaveBeenCalledWith('admin-2', 'suspended'));
    statusConfirm.mockRestore();
  });

  test('previews an existing post image and preserves it when no replacement is selected', async () => {
    const existingPost = {
      _id: 'content-image-1',
      title: 'Image story',
      slug: 'image-story',
      excerpt: 'Story excerpt',
      content: 'Story content',
      category: 'Travel',
      status: 'published',
      coverImage: 'uploads\\existing-cover.png',
    };
    adminApi.content.mockResolvedValueOnce({ items: [existingPost], page: 1, pages: 1, total: 1 });
    withRoute(<OperationsPage type="posts" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    const preview = await screen.findByAltText('Image preview');
    expect(preview).toHaveAttribute('src', 'http://localhost:5000/media/existing-cover.png');

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(adminApi.updateContent).toHaveBeenCalledWith('posts', 'content-image-1', expect.any(FormData)));
    expect(adminApi.updateContent.mock.calls[0][2].get('coverImage')).toBeNull();
  });

  test('rejects an image larger than 10 MB before upload', async () => {
    withRoute(<OperationsPage type="posts" />);
    const file = new File(['image'], 'oversized.png', { type: 'image/png' });
    Object.defineProperty(file, 'size', { value: 10 * 1024 * 1024 + 1 });
    fireEvent.change(screen.getByLabelText(/Image \(JPG, JPEG, PNG, WebP; max 10 MB\)/), {
      target: { files: [file] },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Image must be 10 MB or smaller.');
    expect(adminApi.createContent).not.toHaveBeenCalled();
  });
});
