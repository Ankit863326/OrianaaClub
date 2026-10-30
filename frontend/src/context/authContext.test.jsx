import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, jest, test } from '@jest/globals';
import apiClient from '../lib/apiClient.js';
import AuthContext from './auth-context.js';
import { AuthProvider } from './AuthContext.jsx';
import useAuth from './useAuth.js';
import ProtectedRoute from '../components/ProtectedRoute.jsx';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

function ContextReader() {
  const auth = useAuth();
  return (
    <div>
      <span>{auth.loading ? 'loading' : auth.user?.name || 'guest'}</span>
      <span data-testid="membership-reset-key">{auth.membershipResetKey}</span>
      <button onClick={() => auth.login({ email: 'member@example.test' })}>Log in</button>
      <button onClick={() => auth.logout()}>Log out</button>
      <button onClick={() => auth.refreshUser()}>Refresh</button>
    </div>
  );
}

function Destination() {
  const location = useLocation();
  return <p>Current route: {location.pathname}</p>;
}

describe('authentication context and protected routes', () => {
  test('restores a session and updates context after login and logout', async () => {
    const get = jest.spyOn(apiClient, 'get').mockResolvedValue({ user: { name: 'Restored' } });
    const post = jest.spyOn(apiClient, 'post')
      .mockResolvedValueOnce({ user: { name: 'Signed in' } })
      .mockResolvedValueOnce({});

    render(<AuthProvider><ContextReader /></AuthProvider>);
    expect(await screen.findByText('Restored')).toBeInTheDocument();
    await act(async () => screen.getByRole('button', { name: 'Log in' }).click());
    expect(screen.getByText('Signed in')).toBeInTheDocument();
    await act(async () => screen.getByRole('button', { name: 'Log out' }).click());
    expect(screen.getByText('guest')).toBeInTheDocument();
    expect(screen.getByTestId('membership-reset-key')).toHaveTextContent('1');
    expect(get).toHaveBeenCalledWith('/auth/me');
    expect(post).toHaveBeenNthCalledWith(1, '/auth/login', { email: 'member@example.test' });
    expect(post).toHaveBeenNthCalledWith(2, '/auth/logout', {});
  });

  test('treats an expired session as a guest but lets other restore errors be logged', async () => {
    jest.spyOn(apiClient, 'get').mockRejectedValue({ status: 401 });
    render(<AuthProvider><ContextReader /></AuthProvider>);
    expect(await screen.findByText('guest')).toBeInTheDocument();
  });

  test('requires the authentication provider', () => {
    function InvalidReader() {
      useAuth();
      return null;
    }
    expect(() => render(<InvalidReader />)).toThrow('useAuth must be used inside an AuthProvider.');
  });

  test('shows a loading status and redirects guests while preserving their destination', async () => {
    const protectedContent = <ProtectedRoute><h1>Member page</h1></ProtectedRoute>;
    const renderWithContext = (user, loading, initialPath) => render(
      <AuthContext.Provider value={{ user, loading }}>
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route path="/member" element={protectedContent} />
            <Route path="/login" element={<Destination />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    const loadingView = renderWithContext(null, true, '/member');
    expect(screen.getByText('Checking your account...')).toBeInTheDocument();
    loadingView.unmount();
    renderWithContext(null, false, '/member');
    await waitFor(() => expect(screen.getByText('Current route: /login')).toBeInTheDocument());
  });

  test('renders the protected page for a signed-in member', () => {
    render(
      <AuthContext.Provider value={{ user: { name: 'Member' }, loading: false }}>
        <MemoryRouter initialEntries={['/member']}>
          <Routes><Route path="/member" element={<ProtectedRoute><h1>Member page</h1></ProtectedRoute>} /></Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    expect(screen.getByRole('heading', { name: 'Member page' })).toBeInTheDocument();
  });
});
