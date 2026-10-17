import React from 'react';

/* eslint-disable react-refresh/only-export-components */
// Render motion elements as ordinary DOM elements so tests stay fast and deterministic.
const animationProps = new Set([
  'animate',
  'custom',
  'drag',
  'dragConstraints',
  'dragElastic',
  'dragMomentum',
  'dragSnapToOrigin',
  'exit',
  'initial',
  'layout',
  'layoutId',
  'onDrag',
  'onDragEnd',
  'transition',
  'variants',
  'whileHover',
  'whileInView',
  'whileTap',
  'viewport',
]);

function createMotionComponent(tag) {
  return React.forwardRef(function MotionElement(props, ref) {
    const domProps = Object.fromEntries(
      Object.entries(props).filter(([key]) => !animationProps.has(key)),
    );
    return React.createElement(tag, { ...domProps, ref });
  });
}

export const motion = new Proxy({}, {
  get: (_target, tag) => createMotionComponent(tag),
});
export const m = motion;
export const AnimatePresence = ({ children }) => children;
export const LazyMotion = ({ children }) => children;
export const useInView = () => false;
export const useReducedMotion = () => false;
export const useAnimation = () => ({ start: () => Promise.resolve() });
