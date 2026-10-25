// Phase 1: Send branded account emails and record delivery outcomes.
import nodemailer from 'nodemailer';
import { readFile } from 'node:fs/promises';
import EmailLog from '../models/EmailLog.js';
import { env } from '../config/env.js';

const templates = new Set([
  'activation',
  'membership-otp',
  'reset',
  'payment-success',
  'payment-rejected',
  'enquiry-notification',
  'membership-approved',
  'approval-overdue',
  'family-verification-code',
  'family-verification-submitted',
  'family-verification-verified',
  'family-verification-rejected',
  'family-verification-overdue',
  'nominee-confirmation-code',
]);
let transporter;
let etherealSenderAddress = '';

function isSmtpConfigured() {
  return Boolean(env.smtpHost && env.smtpPort && env.smtpUser && env.smtpPass && env.mailFromAddress);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

async function renderTemplate(template, data) {
  if (!templates.has(template)) throw new Error(`Unsupported email template: ${template}`);
  const html = await readFile(new URL(`../templates/emails/${template}.html`, import.meta.url), 'utf8');
  const supportEmail = env.mailReplyTo || env.mailFromAddress;
  const supportFooter = supportEmail
    ? `<p style="margin:5px 0 0;font-size:12px;line-height:1.6;color:#68736b;">Need help? Write to ${escapeHtml(supportEmail)}</p>`
    : '';
  return html
    .replaceAll('{{firstName}}', escapeHtml(data.firstName || 'Member'))
    .replaceAll('{{accountDescription}}', data.admin
      ? 'your OrianaaClub administrator account'
      : 'your OrianaaClub account')
    .replaceAll('{{link}}', escapeHtml(data.link || ''))
    .replaceAll('{{expiry}}', escapeHtml(data.expiry || ''))
    .replaceAll('{{code}}', escapeHtml(data.code || ''))
    .replaceAll('{{planName}}', escapeHtml(data.planName || ''))
    .replaceAll('{{memberId}}', escapeHtml(data.memberId || ''))
    .replaceAll('{{invoiceNumber}}', escapeHtml(data.invoiceNumber || ''))
    .replaceAll('{{baseAmount}}', escapeHtml(data.baseAmount || ''))
    .replaceAll('{{gstAmount}}', escapeHtml(data.gstAmount || ''))
    .replaceAll('{{totalAmount}}', escapeHtml(data.totalAmount || ''))
    .replaceAll('{{approvalDueAt}}', escapeHtml(data.approvalDueAt || ''))
    .replaceAll('{{reason}}', escapeHtml(data.reason || ''))
    .replaceAll('{{notice}}', escapeHtml(data.notice || ''))
    .replaceAll('{{reviewTarget}}', escapeHtml(data.reviewTarget || 'one working day'))
    .replaceAll('{{name}}', escapeHtml(data.name || ''))
    .replaceAll('{{email}}', escapeHtml(data.email || ''))
    .replaceAll('{{mobile}}', escapeHtml(data.mobile || ''))
    .replaceAll('{{type}}', escapeHtml(data.type || ''))
    .replaceAll('{{message}}', escapeHtml(data.message || ''))
    .replaceAll('{{supportEmail}}', supportFooter);
}

async function renderPlainText(template, data) {
  if (!['activation', 'membership-otp', 'family-verification-code', 'nominee-confirmation-code'].includes(template)) return undefined;
  const text = await readFile(new URL(`../templates/emails/${template}.txt`, import.meta.url), 'utf8');
  return text
    .replaceAll('{{firstName}}', data.firstName || 'Member')
    .replaceAll('{{link}}', data.link || '')
    .replaceAll('{{expiry}}', data.expiry || '')
    .replaceAll('{{code}}', data.code || '');
}

async function logEmail(fields) {
  await EmailLog.create(fields);
}

function maskEmail(email) {
  const separator = email.lastIndexOf('@');
  if (separator <= 0) return '***';
  return `${email[0]}***${email.slice(separator)}`;
}

function redactMailSecret(value) {
  const message = String(value ?? '');
  return env.smtpPass ? message.split(env.smtpPass).join('[redacted]') : message;
}

function logMailFailure(template, to, error) {
  const code = redactMailSecret(error?.code ?? 'unknown');
  const message = redactMailSecret(error?.message || 'No error message was provided.');
  console.error(
    `[mail] failed type=${template} to=${maskEmail(to)} name=${error?.name || 'Error'} code=${code} message=${message}`,
  );
}

async function getTransporter() {
  if (transporter) return transporter;
  if (isSmtpConfigured()) {
    const port = Number(env.smtpPort);
    transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port,
      secure: port === 465,
      auth: { user: env.smtpUser, pass: env.smtpPass },
    });
    return transporter;
  }
  if (env.nodeEnv === 'production') {
    throw new Error('SMTP settings are required to send account emails in production.');
  }

  const account = await nodemailer.createTestAccount();
  etherealSenderAddress = account.user;
  transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: { user: account.user, pass: account.pass },
  });
  console.info('[mail:dev] SMTP is not configured; using a temporary Ethereal test mailbox.');
  return transporter;
}

export async function verifyMailTransport() {
  try {
    const activeTransporter = await getTransporter();
    const result = await activeTransporter.verify();
    console.info(`[mail] Email transport verification succeeded: ${result}.`);
  } catch (error) {
    const code = redactMailSecret(error?.code || 'unknown');
    const message = redactMailSecret(error?.message || 'No error message was provided.');
    console.error(
      `[mail] Email transport verification failed: ${error?.name || 'Error'} code=${code} message=${message}`,
    );
    if (env.nodeEnv === 'production') throw error;
  }
}

export async function sendMail({ to, subject, template, data }) {
  let info;
  try {
    const [html, text] = await Promise.all([
      renderTemplate(template, data),
      renderPlainText(template, data),
    ]);
    const activeTransporter = await getTransporter();
    let senderAddress = env.mailFromAddress;
    if (!senderAddress && etherealSenderAddress) senderAddress = etherealSenderAddress;
    if (senderAddress && env.smtpHost && (
      env.nodeEnv !== 'production'
      && env.smtpHost.toLowerCase() === 'smtp.gmail.com'
      && senderAddress.toLowerCase() !== env.smtpUser.toLowerCase()
    )) {
      console.warn('[mail] Gmail SMTP will replace MAIL_FROM_ADDRESS with SMTP_USER; using SMTP_USER as the sender address.');
      senderAddress = env.smtpUser;
    }

    info = await activeTransporter.sendMail({
      from: { name: env.mailFromName, address: senderAddress || env.smtpUser },
      ...(env.mailReplyTo ? { replyTo: env.mailReplyTo } : {}),
      to,
      subject,
      html,
      ...(text ? { text } : {}),
    });
    if (template === 'activation' || template === 'reset') {
      console.log(
        `[mail] sent type=${template} to=${maskEmail(to)} messageId=${info.messageId || 'unknown'}`,
      );
    }
    if (env.nodeEnv !== 'production' && !isSmtpConfigured()) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) console.info(`[mail:dev] Ethereal email preview: ${previewUrl}`);
    }
  } catch (error) {
    logMailFailure(template, to, error);
    const code = redactMailSecret(error?.code);
    const message = redactMailSecret(error?.message || 'No error message was provided.');
    const safeError = [error?.name, code, message].filter(Boolean).join(': ');
    await logEmail({ to, template, status: 'failed', error: safeError });
    throw error;
  }

  await logEmail({ to, template, status: 'sent', error: '' });
}
