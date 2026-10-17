// Phase 6: Send the password setup template to the private test address from Backend/.env.
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { connectDatabase, safeErrorMessage } from '../src/config/db.js';
import { sendMail } from '../src/services/mail.service.js';

function redactMailCredentials(message) {
  return [env.smtpUser, env.smtpPass, env.mailFromAddress, env.mailReplyTo, env.jwtAccessSecret, env.jwtRefreshSecret]
    .filter(Boolean)
    .reduce((safeMessage, secret) => safeMessage.split(secret).join('[redacted]'), message);
}

async function sendPasswordSetupPreview() {
  if (!env.mailTestTo.trim()) {
    throw new Error('Set MAIL_TEST_TO in Backend/.env to the address that should receive the preview.');
  }
  if (!env.smtpHost || !env.smtpPort || !env.smtpUser || !env.smtpPass || !env.mailFromAddress) {
    throw new Error('Configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and MAIL_FROM_ADDRESS before sending a mail test.');
  }

  await connectDatabase();
  const token = randomBytes(32).toString('hex');
  const days = env.activationTokenDays;
  await sendMail({
    to: env.mailTestTo.trim(),
    subject: 'Set your OrianaaClub password',
    template: 'activation',
    data: {
      firstName: 'OrianaaClub Member',
      link: `${env.frontendUrl}/set-password?token=${encodeURIComponent(token)}`,
      expiry: `${days} ${days === 1 ? 'day' : 'days'}`,
    },
  });
  console.log('[mail:test] Password setup template sent to MAIL_TEST_TO.');
}

sendPasswordSetupPreview()
  .catch((error) => {
    console.error(`[mail:test] ${error?.name || 'Error'}: ${redactMailCredentials(safeErrorMessage(error))}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
