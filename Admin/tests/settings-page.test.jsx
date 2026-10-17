import { jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { membershipSettingsApi } from '../src/membership/settingsApi.js';
import SettingsPage from '../src/membership/SettingsPage.jsx';

jest.mock('../src/membership/settingsApi.js', () => ({
  membershipSettingsApi: {
    getSettings: jest.fn(),
    apiKeys: jest.fn(),
    updateSettings: jest.fn(),
    createApiKey: jest.fn(),
    revokeApiKey: jest.fn(),
  },
}));

test('renders membership settings and billing keys without the removed policy section', async () => {
  membershipSettingsApi.getSettings.mockResolvedValue({
    discountPercent: 50,
    gstEnabled: true,
    gstRate: 18,
    gstLabel: 'GST',
    gstin: '',
    pointsValidityYears: 11,
    membershipValidityYears: 25,
    maxFamilyMembers: 6,
    childAgeLimit: 18,
    earlyBirdLimit: 1000,
    receiptCompanyName: 'Orianaa',
    receiptAddress: '',
    receiptGstin: '',
    receiptFooterNote: '',
  });
  membershipSettingsApi.apiKeys.mockResolvedValue([]);

  render(<SettingsPage />);

  expect(await screen.findByText('Receipt details')).toBeInTheDocument();
  expect(screen.getByText('Billing API keys')).toBeInTheDocument();
  expect(screen.getByText('GST / Tax')).toBeInTheDocument();
  expect(screen.getByLabelText('GST rate (%)')).toHaveValue(18);
  expect(screen.queryByText('Cancellation refund policy')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Add rule' })).not.toBeInTheDocument();
});

test('saves configured GST settings through the protected settings API', async () => {
  const settings = {
    gstEnabled: true,
    gstRate: 5,
    gstLabel: 'GST',
    gstin: 'GSTIN-TEST',
  };
  membershipSettingsApi.getSettings.mockResolvedValue({
    discountPercent: 50,
    pointsValidityYears: 11,
    membershipValidityYears: 25,
    maxFamilyMembers: 6,
    childAgeLimit: 18,
    earlyBirdLimit: 1000,
    gstEnabled: true,
    gstRate: 18,
    gstLabel: 'GST',
    gstin: '',
  });
  membershipSettingsApi.apiKeys.mockResolvedValue([]);
  membershipSettingsApi.updateSettings.mockResolvedValue(settings);

  render(<SettingsPage />);
  fireEvent.change(await screen.findByLabelText('GST rate (%)'), { target: { value: '5' } });
  fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'GST' } });
  fireEvent.change(screen.getByLabelText('GSTIN (optional)'), { target: { value: 'GSTIN-TEST' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save GST settings' }));

  await waitFor(() => expect(membershipSettingsApi.updateSettings).toHaveBeenCalledWith({
    gstEnabled: true,
    gstRate: 5,
    gstLabel: 'GST',
    gstin: 'GSTIN-TEST',
  }));
});
