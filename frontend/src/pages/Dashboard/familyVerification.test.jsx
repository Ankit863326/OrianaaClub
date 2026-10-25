import React from 'react';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AuthContext from '../../context/auth-context.js';
import FamilyCheckoutPage from './FamilyCheckoutPage.jsx';
import FamilyVerificationPage from './FamilyVerificationPage.jsx';

const familyId = '64a000000000000000000009';
const nominee = {
  _id: familyId,
  name: 'Riya Nominee',
  relation: 'nominee',
  isNominee: true,
  emailConfirmedAt: null,
  status: 'active',
  type: 'adult',
};

function response(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    text: async () => JSON.stringify({ success: status < 400, data }),
  };
}

function renderPage(element, path) {
  return render(
    <AuthContext.Provider value={{ logout: jest.fn() }}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/dashboard/family/:familyId/verification" element={element} />
          <Route path="/dashboard/family/:familyId/payment" element={element} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('family verification and checkout pages', () => {
  beforeEach(() => {
    window.fetch = jest.fn();
  });

  test('confirms nominee email without presenting document fields', async () => {
    window.fetch.mockImplementation(async (url, options = {}) => {
      const path = new URL(url, window.location.href).pathname;
      if (path.endsWith('/verification') && (options.method || 'GET') === 'GET') {
        return response({ nominee: true, emailConfirmed: false, verification: null });
      }
      if (path.endsWith('/me/family')) return response({ adults: [nominee], children: [] });
      if (path.endsWith('/verification/code')) return response({ sent: true, codeSentTo: 'own' });
      if (path.endsWith('/verification/code/confirm')) return response({ emailConfirmed: true, nominee: true });
      return response({}, 404);
    });

    renderPage(<FamilyVerificationPage />, `/dashboard/family/${familyId}/verification`);

    await screen.findByRole('heading', { name: 'Confirm your email' });
    fireEvent.click(screen.getByRole('button', { name: 'Send email code' }));
    await screen.findByText(/sent by email/i);
    fireEvent.change(screen.getByLabelText('Six-digit email code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm email' }));

    expect(await screen.findByRole('heading', { name: 'Nominee confirmed.' })).toBeTruthy();
    expect(screen.queryByLabelText(/Aadhaar/i)).toBeNull();
    expect(screen.queryByLabelText(/document/i)).toBeNull();
  });

  test('shows server-priced base, GST and total before checkout', async () => {
    window.fetch.mockImplementation(async (url) => {
      const path = new URL(url, window.location.href).pathname;
      if (path.endsWith('/checkout')) {
        return response({
          familyMemberId: familyId,
          name: 'Riya Member',
          baseAmount: 150000,
          gstAmount: 27000,
          totalPayable: 177000,
          discountPct: 50,
        });
      }
      return response({}, 404);
    });

    renderPage(<FamilyCheckoutPage />, `/dashboard/family/${familyId}/payment`);

    await screen.findByRole('heading', { name: 'Riya Member' });
    expect(screen.getByText('Discounted base').nextSibling.textContent).toBe('₹1,50,000');
    expect(screen.getByText('GST').nextSibling.textContent).toBe('₹27,000');
    expect(screen.getByRole('button', { name: 'Pay ₹1,77,000' })).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/points|expiry|early.bird/i);
    expect(screen.getByText(/Payment is non-refundable/i)).toBeTruthy();
    await waitFor(() => expect(window.fetch).toHaveBeenCalled());
  });
});
