// Phase 0: Open MongoDB and explain common Atlas connection failures safely.
import mongoose from 'mongoose';
import { env } from './env.js';

function errorText(error) {
  return [error?.message, error?.codeName, error?.cause?.message, error?.cause?.codeName]
    .filter(Boolean)
    .join(' ');
}

export function connectionHint(error) {
  const message = errorText(error);
  if (/bad auth|authentication failed|auth failed|codeName:\s*AuthenticationFailed|code 18|code 8000/i.test(message)) {
    return 'Atlas rejected the database user credentials. Check or reset the database user in Atlas Database Access (not your Atlas website login), then run npm run setup:env again.';
  }
  if (/ENOTFOUND|querySrv/i.test(message)) {
    return 'Check DNS resolution and your network connection; Atlas SRV records could not be reached.';
  }
  if (/server selection timed out|serverselectionerror|ETIMEDOUT/i.test(message)) {
    return 'The connection timed out. Confirm your current IP address is allowed in Atlas Network Access.';
  }
  return 'Confirm the Atlas cluster is available, the connection settings are correct, and your network can reach it.';
}

function redactSensitiveText(value) {
  let text = String(value ?? 'undefined');

  if (env.mongodbUri) {
    const separator = env.mongodbUri.indexOf('://');
    const credentialsStart = separator + 3;
    const credentialsEnd = env.mongodbUri.indexOf('@', credentialsStart);
    if (separator >= 0 && credentialsEnd > credentialsStart) {
      const credentials = env.mongodbUri.slice(credentialsStart, credentialsEnd);
      const passwordSeparator = credentials.indexOf(':');
      if (passwordSeparator >= 0) {
        const password = credentials.slice(passwordSeparator + 1);
        const passwords = new Set([password]);
        try {
          passwords.add(decodeURIComponent(password));
        } catch {
          // Retain the encoded form if the URI contains invalid percent encoding.
        }
        for (const secret of passwords) {
          if (secret) text = text.split(secret).join('***');
        }
      }
    }
  }

  return text
    .replace(/mongodb(?:\+srv)?:\/\/[^\s"'<>]+/gi, '[MongoDB URI redacted]')
    .replace(/[\r\n\t]+/g, ' ');
}

export function safeErrorMessage(error) {
  return redactSensitiveText(error?.message || 'No error message was provided.');
}

export function logConnectionFailure(scope, error) {
  const name = redactSensitiveText(error?.name);
  const code = redactSensitiveText(error?.code);
  const message = safeErrorMessage(error);
  console.error(`[${scope}] MongoDB error details: name=${name}, code=${code}, message=${message}`);
  console.error(`[${scope}] ${connectionHint(error)}`);
}

mongoose.connection.on('error', (error) => {
  logConnectionFailure('database', error);
});

mongoose.connection.on('disconnected', () => {
  console.warn('[database] MongoDB disconnected.');
});

export async function connectDatabase() {
  try {
    await mongoose.connect(env.mongodbUri, {
      autoIndex: env.mongoAutoIndex,
      serverSelectionTimeoutMS: 10000,
      ...(env.nodeEnv === 'production' ? { maxPoolSize: 20, minPoolSize: 2 } : {}),
    });
    console.log(`MongoDB connected: ${env.mongodbHost}/${env.mongodbDatabase}`);
  } catch (error) {
    logConnectionFailure('database', error);
    throw error;
  }
}
