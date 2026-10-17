import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test } from '@jest/globals';
import LuxuryContactDrawer from './LuxuryContactDrawer.jsx';

const jsonResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => 'application/json' },
  json: async () => body,
  text: async () => JSON.stringify(body),
});

// The contact drawer is opened in isolation and its submit is answered by a local fetch mock.
describe('luxury contact drawer', () => {
  beforeEach(() => fetch.mockReset());

  test('validates required details, country and interest choices, then submits offline', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ success: true, message: 'Enquiry received.' }));
    render(<LuxuryContactDrawer open onOpenChange={() => {}} />);
    expect(screen.getByRole('dialog', { name: 'Get In Touch' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(screen.getByRole('alert')).toHaveTextContent('All fields are required');
    expect(screen.getByText('Full name is required')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Ari Member' } });
    fireEvent.change(screen.getByLabelText('Email Id'), { target: { value: 'ari@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: '+91' }));
    fireEvent.click(screen.getByRole('option', { name: /USA\/Canada/ }));
    fireEvent.change(screen.getByLabelText('Mobile no.'), { target: { value: '5551234567' } });
    fireEvent.change(screen.getByLabelText('Date of Birth'), { target: { value: '1990-10-14' } });
    fireEvent.click(screen.getByRole('button', { name: 'Interest Area' }));
    fireEvent.click(screen.getByRole('option', { name: 'Wellness & Spa' }));
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('checkbox')).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Verify captcha (jest-test-site-key)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByRole('heading', { name: 'Your enquiry is with us.' })).toBeInTheDocument();
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({
      type: 'contact',
      name: 'Ari Member',
      email: 'ari@example.test',
      mobile: '+1 5551234567',
      extra: { dateOfBirth: '1990-10-14', interest: 'wellness', promotionalConsent: true },
      recaptchaToken: 'jest-captcha-token',
    });
  });

  test('shows the API error when the enquiry is rejected', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ message: 'Contact service is unavailable.' }, 503));
    render(<LuxuryContactDrawer open onOpenChange={() => {}} />);
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Ari Member' } });
    fireEvent.change(screen.getByLabelText('Email Id'), { target: { value: 'ari@example.test' } });
    fireEvent.change(screen.getByLabelText('Mobile no.'), { target: { value: '5551234567' } });
    fireEvent.change(screen.getByLabelText('Date of Birth'), { target: { value: '1990-10-14' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Contact service is unavailable.');
  });
});
