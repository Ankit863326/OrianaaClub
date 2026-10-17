import '@testing-library/jest-dom';
import { jest } from '@jest/globals';
import { TextDecoder, TextEncoder } from 'node:util';

globalThis.__VITE_TEST_ENV__ = Object.freeze({
  VITE_API_URL: 'http://localhost:5000/api',
});

globalThis.TextDecoder = TextDecoder;
globalThis.TextEncoder = TextEncoder;

// API calls are mocked in tests; this shared Axios stub prevents accidental network access.
jest.mock('axios', () => {
  const client = jest.fn(() => Promise.resolve({ data: {} }));
  Object.assign(client, {
    defaults: {},
    get: jest.fn(() => Promise.resolve({ data: { data: {} } })),
    post: jest.fn(() => Promise.resolve({ data: { data: {} } })),
    patch: jest.fn(() => Promise.resolve({ data: { data: {} } })),
    put: jest.fn(() => Promise.resolve({ data: { data: {} } })),
    delete: jest.fn(() => Promise.resolve({ data: { data: {} } })),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  });
  const create = jest.fn((config) => {
    client.defaults = config;
    return client;
  });
  return { __esModule: true, default: { create }, create };
});
jest.mock('framer-motion', () => {
  const React = require('react');
  const motion = new Proxy({}, {
    get: (_, tag) => React.forwardRef((props, ref) => {
      const { initial, animate, exit, transition, whileHover, whileTap, ...domProps } = props;
      return React.createElement(tag, { ...domProps, ref });
    }),
  });
  return { motion, AnimatePresence: ({ children }) => children };
});

// A test must explicitly mock fetch rather than call the network accidentally.
globalThis.fetch = jest.fn(() => Promise.reject(new Error('Network access is disabled in tests.')));
globalThis.IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

window.matchMedia = window.matchMedia || (() => ({
  matches: false,
  addListener() {},
  removeListener() {},
  addEventListener() {},
  removeEventListener() {},
}));
