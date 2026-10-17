import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { MemoryRouter } from 'react-router-dom';
import AuthContext from '../context/auth-context.js';
import LoginPage from './LoginPage/LoginPage.jsx';

const jsonResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => 'application/json' },
  json: async () => body,
  text: async () => JSON.stringify(body),
});

function renderLogin(login) {
  return render(
    <AuthContext.Provider value={{ login }}>
      <MemoryRouter><LoginPage /></MemoryRouter>
    </AuthContext.Provider>,
  );
}

// The auth context is controlled by the test, so no login request can reach a real server.
describe('member login page', () => {
  beforeEach(() => fetch.mockReset());

  test('validates email and password and lets the member reveal the password', () => {
    renderLogin(jest.fn());
    fireEvent.click(screen.getByRole('button', { name: 'Log In' }));
    expect(screen.getByText('Please enter your E-mail ID')).toBeInTheDocument();
    expect(screen.getByText('Please enter your password')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
    expect(fetch).not.toHaveBeenCalled();
  });

  test('shows a login error returned from the authentication context', async () => {
    const login = jest.fn().mockRejectedValue(new Error('Invalid email or password.'));
    renderLogin(login);
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'member@example.test' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log In' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
    expect(login).toHaveBeenCalledWith({ email: 'member@example.test', password: 'wrong-password' });
    expect(fetch).not.toHaveBeenCalled();
  });

  test('shows success feedback and looks up the member destination after login', async () => {
    const login = jest.fn().mockResolvedValue({ name: 'Member' });
    fetch.mockResolvedValueOnce(jsonResponse({ data: { membership: { status: 'active' } } }));
    renderLogin(login);
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: ' member@example.test ' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log In' }));
    expect(await screen.findByText(/Welcome back! Redirecting/)).toBeInTheDocument();
    expect(login).toHaveBeenCalledWith({ email: 'member@example.test', password: 'secret' });
    expect(fetch).toHaveBeenCalledWith('http://localhost:5000/api/member/me', expect.objectContaining({ credentials: 'include' }));
  });
});
