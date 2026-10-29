import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test } from '@jest/globals';
import { MemoryRouter } from 'react-router-dom';
import ForgotPassword from './ForgotPassword/ForgotPassword.jsx';

const jsonResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => 'application/json' },
  json: async () => body,
  text: async () => JSON.stringify(body),
});

// These cases check both privacy-friendly success feedback and a visible API error.
describe('forgot-password page', () => {
  beforeEach(() => fetch.mockReset());

  test('requests a reset link and displays the API response', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ message: 'If eligible, a reset link was sent.' }));
    render(<MemoryRouter><ForgotPassword /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'member@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send Reset Link' }));
    expect(await screen.findByRole('status')).toHaveTextContent('If eligible, a reset link was sent.');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ email: 'member@example.test' });
  });

  test('shows an error when the API request is rejected', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ message: 'Unable to send the reset link.' }, 503));
    render(<MemoryRouter><ForgotPassword /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'member@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send Reset Link' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to send the reset link.');
  });
});
