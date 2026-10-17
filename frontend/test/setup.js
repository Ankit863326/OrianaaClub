import '@testing-library/jest-dom';
import { jest } from '@jest/globals';
import { TextDecoder, TextEncoder } from 'node:util';

// Tests use only these harmless Vite values; Jest never loads a real .env file.
globalThis.__VITE_TEST_ENV__ = Object.freeze({
  DEV: true,
  PROD: false,
  MODE: 'test',
  BASE_URL: '/',
  VITE_API_URL: 'http://localhost:5000/api',
  VITE_RECAPTCHA_SITE_KEY: 'jest-test-site-key',
  VITE_ADMIN_URL: '/admin',
});

globalThis.TextEncoder = TextEncoder;
globalThis.TextDecoder = TextDecoder;

// jsdom omits Fetch API response classes, so small local stand-ins keep requests offline.
globalThis.Headers = class HeadersMock {
  constructor(initial = {}) {
    this.values = new Map(Object.entries(initial).map(([key, value]) => [key.toLowerCase(), value]));
  }
  get(key) { return this.values.get(key.toLowerCase()) || null; }
  has(key) { return this.values.has(key.toLowerCase()); }
  set(key, value) { this.values.set(key.toLowerCase(), value); }
};

globalThis.Response = class ResponseMock {
  constructor(body = null, options = {}) {
    this.body = body;
    this.status = options.status || 200;
    this.ok = this.status >= 200 && this.status < 300;
    this.headers = new Headers(options.headers);
  }
  async json() { return JSON.parse(this.body); }
  async text() { return this.body == null ? '' : String(this.body); }
};

// Reject every request unless a test provides its own mocked response.
globalThis.fetch = jest.fn(async (url) => {
  throw new Error(`Unexpected network request in a frontend test: ${url}`);
});

globalThis.IntersectionObserver = class IntersectionObserverMock {
  constructor(callback) {
    this.callback = callback;
    this.observe = jest.fn();
    this.unobserve = jest.fn();
    this.disconnect = jest.fn();
  }

  trigger(target, isIntersecting = true) {
    this.callback([{ target, isIntersecting }], this);
  }
};

window.matchMedia = window.matchMedia || (() => ({
  matches: false,
  media: '',
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
}));

Element.prototype.scrollIntoView = jest.fn();
Element.prototype.scrollTo = jest.fn();
window.scrollTo = jest.fn();
