// Phase 1: Send branded account emails and record delivery outcomes.
import nodemailer from 'nodemailer';
import { readFile } from 'node:fs/promises';
import EmailLog from '../models/EmailLog.js';
import { env } from '../config/env.js';

const templates = new Set(['activation', 'membership-otp', 'reset', 'payment-success', 'payment-rejected', 'enquiry-notification']);
let transporter;

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
    .replaceAll('{{reason}}', escapeHtml(data.reason || ''))
    .replaceAll('{{name}}', escapeHtml(data.name || ''))
    .replaceAll('{{email}}', escapeHtml(data.email || ''))
    .replaceAll('{{mobile}}', escapeHtml(data.mobile || ''))
    .replaceAll('{{type}}', escapeHtml(data.type || ''))
    .replaceAll('{{message}}', escapeHtml(data.message || ''))
    .replaceAll('{{supportEmail}}', supportFooter);
}

async function renderPlainText(template, data) {
  if (!['activation', 'membership-otp'].includes(template)) return undefined;
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

export async function sendMail({ to, subject, template, data }) {
  if (env.nodeEnv === 'development' && !isSmtpConfigured()) {
    console.info(`[mail:dev] email delivery is not configured; type=${template} to=${maskEmail(to)}`);
    await logEmail({ to, template, status: 'sent', error: '' });
    return;
  }

  let info;
  try {
    if (!isSmtpConfigured()) {
      throw new Error('SMTP settings are required to send account emails in production.');
    }

    const [html, text] = await Promise.all([
      renderTemplate(template, data),
      renderPlainText(template, data),
    ]);
    let senderAddress = env.mailFromAddress;
    if (
      env.nodeEnv === 'development'
      && env.smtpHost.toLowerCase() === 'smtp.gmail.com'
      && senderAddress.toLowerCase() !== env.smtpUser.toLowerCase()
    ) {
      console.warn('[mail] Gmail SMTP will replace MAIL_FROM_ADDRESS with SMTP_USER; using SMTP_USER as the sender address.');
      senderAddress = env.smtpUser;
    }

    transporter ??= nodemailer.createTransport({
      host: env.smtpHost,
      port: Number(env.smtpPort),
      secure: Number(env.smtpPort) === 465,
      auth: { user: env.smtpUser, pass: env.smtpPass },
    });
    info = await transporter.sendMail({
      from: { name: env.mailFromName, address: senderAddress },
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
