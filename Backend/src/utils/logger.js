import { env } from '../config/env.js';

const levels = ['debug', 'info', 'warn', 'error'];
const threshold = levels.indexOf(env.logLevel);

function log(level, message) {
  if (levels.indexOf(level) < threshold) return;
  const output = level === 'debug' ? console.log : console[level];
  output(`[${level}] ${message}`);
}

export default Object.freeze({
  debug: (message) => log('debug', message),
  info: (message) => log('info', message),
  warn: (message) => log('warn', message),
  error: (message) => log('error', message),
});
