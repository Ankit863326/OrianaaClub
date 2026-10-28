import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test } from '@jest/globals';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import AuthContext from '../context/auth-context.js';
import Activate from './Activate/Activate.jsx';
import ResetPassword from './ResetPassword/ResetPassword.jsx';

const jsonResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => 'application/json' },
  json: async () => body,
  text: async () => JSON.stringify(body),
});

function renderPage(page, route = '/') {
  return render(
    <AuthContext.Provider value={{ refreshUser: async () => ({ email: 'member@example.test' }) }}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="*" element={page} />
          <Route path="/luxury-membership" element={<p>Membership destination</p>} />
          <Route path="/dashboard" element={<p>Dashboard destination</p>} />
          <Route path="/login" element={<LoginDestination />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

function LoginDestination() {
  const location = useLocation();
  return <p>{location.state?.message || 'Login destination'}</p>;
}

// Token-state pages are tested with local fetch responses; no request leaves the test process.
describe('password setup and reset pages', () => {
  beforeEach(() => fetch.mockReset());

  test('an invalid password link offers a new-link form with a generic response', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ message: 'If your account is eligible, a link is on its way.' }));
    renderPage(<Activate />, '/set-password');
    expect(await screen.findByRole('alert')).toHaveTextContent('This password link is missing or invalid.');
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'member@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send me a new link' }));
    expect(await screen.findByText('If your account is eligible, a link is on its way.')).toBeInTheDocument();
    expect(fetch.mock.calls[0][0]).toContain('/auth/forgot-password');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ email: 'member@example.test' });
  });

  test('a valid password link sets a password and starts a dashboard session', async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse({ email: 'member@example.test', firstName: 'Ari' }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    renderPage(<Activate />, '/set-password?token=test-token');
    expect(await screen.findByText('Use at least 8 characters.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Password123' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'Password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set password' }));
    expect(await screen.findByText('Dashboard destination')).toBeInTheDocument();
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({
      token: 'test-token',
      password: 'Password123',
      confirmPassword: 'Password123',
    });
  });

  test('a paid membership stays restricted after password setup until approval', async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse({ email: 'member@example.test', firstName: 'Ari' }))
      .mockResolvedValueOnce(jsonResponse({
        awaitingApproval: true,
        message: 'Your password is set. Your account will be available after membership approval.',
      }));
    renderPage(<Activate />, '/set-password?token=test-token');
    expect(await screen.findByText('Use at least 8 characters.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Password123' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'Password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set password' }));
    expect(await screen.findByText(
      'Your password is set. Your account will be available after membership approval.',
    )).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test('reset page handles missing token, mismatched passwords, and successful reset', async () => {
    const invalid = renderPage(<ResetPassword />);
    expect(screen.getByRole('alert')).toHaveTextContent('This password reset link is missing or invalid.');
    invalid.unmount();
    fetch.mockResolvedValueOnce(jsonResponse({ ok: true }));
    renderPage(<ResetPassword />, '/reset-password?token=reset-token');
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Password123' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'mismatch' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset Password' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Passwords do not match.');
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'Password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset Password' }));
    expect(await screen.findByText('Login destination')).toBeInTheDocument();
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      token: 'reset-token',
      password: 'Password123',
      confirmPassword: 'Password123',
    });
  });
});
