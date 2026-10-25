import React from 'react';
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AuthContext from '../../context/auth-context.js';
import MemberDashboardPage from './MemberDashboardPage.jsx';

const dashboardData = {
  _id: 'primary-membership',
  tier: 'Founder Legacy',
  status: 'pending_approval',
  paymentConfirmedAt: '2026-10-24T00:00:00.000Z',
  pointsBalance: 0,
  pointsExpireAt: '2037-10-24T00:00:00.000Z',
  expiresAt: '2037-10-24T00:00:00.000Z',
  approvalSeq: 1000,
  earlyBirdApplied: true,
  multiplier: 2,
  family: {
    adults: [{
      id: 'family-profile',
      name: 'Anaya Example',
      relation: 'wife',
      status: 'active',
      memberStatus: 'pending_approval',
      verificationStatus: 'verified',
      pointsBalance: 123,
      pointsExpireAt: '2037-10-24T00:00:00.000Z',
    }],
    children: [],
    nominees: [],
  },
  familyPolicy: {
    enabled: true,
    discounts: { spouse: 50, parent: 50, child: 75 },
    limits: { spouse: 1, parents: 4 },
  },
};

function jsonResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    text: async () => JSON.stringify({ success: status < 400, data }),
  };
}

function expectNoExpiryDetails() {
  const rendered = `${document.body.textContent} ${document.body.innerHTML}`;
  expect(rendered).not.toMatch(/\b[\w-]*(?:expire|expiry)[\w-]*\b|early.?bird|approvalSeq|multiplier/i);
}

describe('member dashboard privacy guard', () => {
  beforeEach(() => {
    window.fetch = jest.fn(async (input) => {
      const path = new URL(input, window.location.href).pathname;
      if (path.endsWith('/me/membership')) return jsonResponse(dashboardData);
      if (path.endsWith('/me/points-history')) {
        return jsonResponse({ items: [], page: 1, limit: 10, total: 0, pages: 0 });
      }
      if (path.endsWith('/me/redemptions')) {
        return jsonResponse({ items: [], page: 1, limit: 10, total: 0, pages: 0 });
      }
      if (path.endsWith('/me/payments')) {
        return jsonResponse([{
          _id: 'payment-1',
          status: 'confirmed',
          baseAmount: 30000000,
          gstAmount: 5400000,
          totalAmount: 35400000,
          expiresAt: '2037-10-24T00:00:00.000Z',
        }]);
      }
      if (path.endsWith('/identity-verification')) {
        return jsonResponse({ status: 'not_submitted' });
      }
      return jsonResponse({}, 404);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('does not render expiry or internal approval details on member dashboard tabs', async () => {
    render(
      <AuthContext.Provider value={{ user: { firstName: 'Amit' }, logout: jest.fn() }}>
        <MemoryRouter>
          <MemberDashboardPage />
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    expect(await screen.findByText('Payment received. Your membership is under review.')).toBeTruthy();
    expectNoExpiryDetails();

    for (const tabName of ['Family', 'Points History', 'Renew', 'Payments & Receipts', 'Bills & Bookings', 'Documents']) {
      fireEvent.click(screen.getByRole('tab', { name: tabName }));
      await waitFor(() => expect(screen.getByRole('tabpanel', { name: tabName })).toBeTruthy());
      expectNoExpiryDetails();
    }
  });
});
