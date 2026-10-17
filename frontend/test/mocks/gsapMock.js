const gsap = {
  registerPlugin: () => {},
  context: (callback) => {
    callback?.();
    return { kill: () => {}, revert: () => {} };
  },
  matchMedia: () => ({
    add: (_query, callback) => callback?.(),
    revert: () => {},
  }),
  timeline: () => {
    const timeline = {
      to: () => timeline,
      fromTo: () => timeline,
      from: () => timeline,
    };
    return timeline;
  },
  to: () => ({}),
  set: () => ({}),
  killTweensOf: () => {},
  from: () => ({}),
  fromTo: () => ({}),
  utils: { toArray: () => [] },
};

export default gsap;
