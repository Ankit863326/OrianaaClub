import { jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import api from '../src/api/client.js';
import App from '../src/App.jsx';
import { AuthProvider } from '../src/auth/AuthContext.jsx';
import { adminApi } from '../src/api/admin.js';

// Route tests use an in-memory history and a fake cookie-session response.
jest.mock('../src/api/admin.js', () => ({
  adminApi: { dashboard: jest.fn(), members: jest.fn(), plans: jest.fn() },
  downloadCsv: jest.fn(),
}));

function renderApp(path) {
  return render(<MemoryRouter initialEntries={[path]}><AuthProvider><App /></AuthProvider></MemoryRouter>);
}

describe('application protected routes', () => {
  beforeEach(() => {
    api.get.mockReset();
    adminApi.dashboard.mockResolvedValue({
      members: { total: 0, byStatus: {}, signupsLast30Days: [] },
      revenue: { totalAmount: 0, paidPayments: 0, monthly: [] },
      pendingBankTransfers: 0, points: { issued: 0, spent: 0 }, planCounts: [],
    });
  });

  test('redirects logged-out visitors from member pages to sign-in', async () => {
    api.get.mockRejectedValueOnce({ response: { status: 401 } });
    renderApp('/members');
    expect(await screen.findByRole('heading', { name: 'OrianaaClub' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in securely' })).toBeInTheDocument();
  });

  test('lets a restored administrator enter the dashboard', async () => {
    api.get.mockResolvedValueOnce({ data: { id: 'admin-1', firstName: 'Asha', email: 'admin@example.invalid' } });
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(await screen.findByText('Total members')).toBeInTheDocument();
  });
});
