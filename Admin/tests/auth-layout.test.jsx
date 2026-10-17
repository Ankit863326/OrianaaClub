import { jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import api from '../src/api/client.js';
import { AuthProvider, useAuth } from '../src/auth/AuthContext.jsx';
import AdminLayout from '../src/layout/AdminLayout.jsx';
import LoginPage from '../src/pages/LoginPage.jsx';
import App from '../src/App.jsx';
import { adminApi } from '../src/api/admin.js';

// In-memory routes let these tests verify sign-in and navigation without opening real pages.
jest.mock('../src/api/admin.js', () => ({
  adminApi: { dashboard: jest.fn(), plans: jest.fn() },
  downloadCsv: jest.fn(),
}));

function AuthStatus() {
  const { user, loading, login, logout } = useAuth();
  return <div>
    <p>{loading ? 'Loading session' : user?.firstName || 'Signed out'}</p>
    <button onClick={() => login({ email: 'admin@example.invalid', password: 'GoodPassword1' }).catch(() => {})}>Login action</button>
    <button onClick={() => logout().catch(() => {})}>Logout action</button>
  </div>;
}

describe('admin authentication and protected routes', () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
  });

  test('restores a cookie session, logs in, and always clears user state on logout', async () => {
    api.get.mockResolvedValueOnce({ data: { id: 'admin-1', firstName: 'Asha' } });
    api.post.mockResolvedValue({ data: { id: 'admin-1', firstName: 'Asha' } });
    render(<AuthProvider><AuthStatus /></AuthProvider>);
    expect(await screen.findByText('Asha')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Login action' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/auth/login', {
      email: 'admin@example.invalid', password: 'GoodPassword1',
    }));
    fireEvent.click(screen.getByRole('button', { name: 'Logout action' }));
    expect(await screen.findByText('Signed out')).toBeInTheDocument();
  });

  test('treats an expired cookie as signed out and clears state even if logout API fails', async () => {
    api.get.mockRejectedValueOnce({ response: { status: 401 } });
    api.post.mockRejectedValueOnce(new Error('Offline'));
    render(<AuthProvider><AuthStatus /></AuthProvider>);
    expect(await screen.findByText('Signed out')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Logout action' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/auth/logout', {}));
    expect(screen.getByText('Signed out')).toBeInTheDocument();
  });

  test('redirects a signed-out visitor from a protected route to admin login', async () => {
    api.get.mockRejectedValueOnce({ response: { status: 401 } });
    adminApi.dashboard.mockResolvedValue({ pendingBankTransfers: 0 });
    render(<MemoryRouter initialEntries={['/members']}><AuthProvider><App /></AuthProvider></MemoryRouter>);
    expect(await screen.findByRole('button', { name: 'Sign in securely' })).toBeInTheDocument();
  });
});

describe('admin navigation layout', () => {
  const auth = { user: { firstName: 'Asha', email: 'admin@example.invalid', id: 'admin-1' }, logout: jest.fn() };
  beforeEach(() => {
    jest.spyOn(require('../src/auth/AuthContext.jsx'), 'useAuth').mockReturnValue(auth);
    auth.logout.mockReset();
    adminApi.dashboard.mockResolvedValue({ pendingBankTransfers: 3 });
  });
  afterEach(() => jest.restoreAllMocks());

  test('shows sidebar links, mobile drawer, payment count, and logs out', async () => {
    const navigate = jest.fn();
    render(<MemoryRouter initialEntries={['/']}><Routes><Route path="/" element={<AdminLayout />}>
      <Route index element={<p>Workspace</p>} /><Route path="members" element={<p>Members route</p>} />
    </Route><Route path="/login" element={<p>Login route</p>} /></Routes></MemoryRouter>);
    expect(await screen.findByText('Workspace')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Members/ }).length).toBeGreaterThan(0);
    expect(await screen.findByText('3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    expect(screen.getByRole('button', { name: 'Close menu' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close navigation drawer' }));
    expect(screen.queryByRole('button', { name: 'Close menu' })).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /Logout|Log out/ })[0]);
    await waitFor(() => expect(auth.logout).toHaveBeenCalled());
    void navigate;
  });
});
