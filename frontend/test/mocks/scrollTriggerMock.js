import { jest } from '@jest/globals';

export const ScrollTrigger = {
  config: jest.fn(),
  register: jest.fn(),
  create: jest.fn(() => ({ kill: jest.fn(), refresh: jest.fn() })),
  refresh: jest.fn(),
  update: jest.fn(),
  kill: jest.fn(),
  killAll: jest.fn(),
  getAll: jest.fn(() => []),
  getById: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
};

export default ScrollTrigger;
