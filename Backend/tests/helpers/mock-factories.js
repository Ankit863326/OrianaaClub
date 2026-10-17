import { jest } from '@jest/globals';

export function createMailMock() {
  return { sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }) };
}

export function createRazorpayMock() {
  return {
    orders: { create: jest.fn().mockResolvedValue({ id: 'order_test_1' }) },
    payments: { refund: jest.fn().mockResolvedValue({ id: 'refund_test_1' }) },
  };
}

export function createRecaptchaMock(success = true) {
  return jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success }),
  });
}
