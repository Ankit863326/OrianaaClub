import { jest } from '@jest/globals';

const gsap = {
  registerPlugin: jest.fn(),
  context: jest.fn((callback) => {
    callback?.();
    return { kill: jest.fn(), revert: jest.fn() };
  }),
  matchMedia: jest.fn(() => ({
    add: jest.fn((_query, callback) => callback?.()),
    revert: jest.fn(),
  })),
  timeline: jest.fn(() => {
    const timeline = {
      to: jest.fn(() => timeline),
      fromTo: jest.fn(() => timeline),
      from: jest.fn(() => timeline),
      set: jest.fn(() => timeline),
      call: jest.fn(() => timeline),
      kill: jest.fn(),
    };
    return timeline;
  }),
  to: jest.fn(() => ({})),
  set: jest.fn(() => ({})),
  killTweensOf: jest.fn(),
  from: jest.fn(() => ({})),
  fromTo: jest.fn(() => ({})),
  utils: { toArray: jest.fn(() => []) },
};

export default gsap;
