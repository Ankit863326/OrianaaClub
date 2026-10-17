import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test } from '@jest/globals';
import ExperienceInquiry from './ExperienceInquiry.jsx';

const jsonResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => 'application/json' },
  json: async () => body,
  text: async () => JSON.stringify(body),
});

// The fake captcha control and fetch mock make it safe to test the entire enquiry form.
describe('experience enquiry form', () => {
  beforeEach(() => fetch.mockReset());

  test('shows required-field errors without sending a request', () => {
    render(<ExperienceInquiry />);
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(screen.getByText('Please enter your full name')).toBeInTheDocument();
    expect(screen.getByText('Please enter your mobile number')).toBeInTheDocument();
    expect(screen.getByText('Please verify you\'re not a robot')).toBeInTheDocument();
    expect(screen.getByText('Please accept terms to continue')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  test('cleans user input, submits a verified enquiry, then clears the form', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ message: 'Our team will be in touch.' }));
    const { container } = render(<ExperienceInquiry />);
    fireEvent.change(container.querySelector('input[name="name"]'), { target: { value: 'Ari5!' } });
    fireEvent.change(container.querySelector('input[name="mobile"]'), { target: { value: '+91 98765x43210' } });
    fireEvent.change(container.querySelector('input[name="city"]'), { target: { value: 'Pune' } });
    fireEvent.change(container.querySelector('select[name="age"]'), { target: { value: '29-35' } });
    fireEvent.change(container.querySelector('input[name="email"]'), { target: { value: 'ari@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify captcha (jest-test-site-key)' }));
    fireEvent.click(container.querySelector('input[type="checkbox"]'));
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Our team will be in touch.');
    const [, options] = fetch.mock.calls[0];
    expect(JSON.parse(options.body)).toMatchObject({
      type: 'experience',
      name: 'Ari',
      mobile: '+91 9876543210',
      email: 'ari@example.test',
      extra: { city: 'Pune', ageGroup: '29-35' },
      recaptchaToken: 'jest-captcha-token',
    });
    expect(container.querySelector('input[name="name"]')).toHaveValue('');
  });

  test('shows the API failure message instead of failing silently', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ message: 'Please try again later.' }, 503));
    const { container } = render(<ExperienceInquiry />);
    fireEvent.change(container.querySelector('input[name="name"]'), { target: { value: 'Riya' } });
    fireEvent.change(container.querySelector('input[name="mobile"]'), { target: { value: '12345678' } });
    fireEvent.change(container.querySelector('input[name="city"]'), { target: { value: 'Pune' } });
    fireEvent.change(container.querySelector('select[name="age"]'), { target: { value: '29-35' } });
    fireEvent.change(container.querySelector('input[name="email"]'), { target: { value: 'riya@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify captcha (jest-test-site-key)' }));
    fireEvent.click(container.querySelector('input[type="checkbox"]'));
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Please try again later.');
  });
});
