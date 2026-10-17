import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { MemoryRouter } from 'react-router-dom';
import MembershipBenefits from './MembershipBenefits.jsx';

const jsonResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => 'application/json' },
  json: async () => body,
  text: async () => JSON.stringify(body),
});

function renderBenefitsPage() {
  return render(<MemoryRouter><MembershipBenefits /></MemoryRouter>);
}

describe('membership benefits page', () => {
  beforeEach(() => fetch.mockReset());
  afterEach(() => jest.clearAllMocks());

  test('shows plans returned by the local API mock', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({
      data: [{
        _id: 'plan-1',
        name: 'Founders Circle',
        price: 150000,
        benefits: [{ amount: 25000, label: 'Adult member' }],
      }],
    }));
    renderBenefitsPage();
    expect(screen.getByRole('status')).toHaveTextContent('Loading membership plans');
    expect(await screen.findByRole('heading', { name: 'Founders Circle' })).toBeInTheDocument();
    expect(screen.getByText('₹1,50,000')).toBeInTheDocument();
    expect(screen.getByText('25,000')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Buy Membership' }).length).toBeGreaterThan(0);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('shows an API error and the empty-catalog message without making extra requests', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ message: 'Plans are temporarily unavailable.' }, 503));
    renderBenefitsPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Plans are temporarily unavailable.');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('explains when the plan catalog is empty', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ data: [] }));
    renderBenefitsPage();
    await waitFor(() => expect(screen.getByText('No membership plans are available right now.')).toBeInTheDocument());
  });
});
