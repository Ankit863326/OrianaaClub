// Phase 0: Load Backend/.env independently of the shell's working directory.
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const envPath = fileURLToPath(new URL(
  process.env.NODE_ENV === 'test' ? '../../.env.test' : '../../.env',
  import.meta.url,
));
dotenv.config({
  path: envPath,
  override: process.env.NODE_ENV === 'development' && !process.env.ACTIVATION_TEST_MONGODB_URI,
});

const mongoUriValue = process.env.MONGO_URI || process.env.MONGODB_URI;
const mongodbUri = mongoUriValue
  ?.trim()
  .replace(/^(['"])(.*)\1$/, '$2')
  .trim();

if (!mongodbUri) {
  throw new Error('MONGO_URI is required. Set it in Backend/.env before starting the server.');
}
if (!/^mongodb(?:\+srv)?:\/\//i.test(mongodbUri)) {
  throw new Error('The MONGODB_URI line in Backend/.env is wrong. It must look like mongodb+srv://USER:PASSWORD@HOST/orianaa_dev?appName=Cluster0 with no quotes and no spaces.');
}

if (/\s/.test(mongodbUri)) {
  throw new Error('The MONGODB_URI line in Backend/.env is wrong. It must look like mongodb+srv://USER:PASSWORD@HOST/orianaa_dev?appName=Cluster0 with no quotes and no spaces.');
}

if (/YOUR_PASSWORD|NEWPASSWORD/i.test(mongodbUri)) {
  throw new Error('The MONGODB_URI line in Backend/.env still contains a password placeholder. Replace it with your Atlas database-user password.');
}

let parsedMongoUri;
try {
  parsedMongoUri = new URL(mongodbUri);
} catch {
  throw new Error('The MONGODB_URI line in Backend/.env is wrong. It must look like mongodb+srv://USER:PASSWORD@HOST/orianaa_dev?appName=Cluster0 with no quotes and no spaces.');
}

const mongodbDatabase = parsedMongoUri.pathname.replace(/^\/+|\/+$/g, '');
if (!parsedMongoUri.hostname || !mongodbDatabase) {
  throw new Error('The MONGODB_URI line in Backend/.env must include a host and a database name after the host, such as /orianaa_dev.');
}

const port = Number(process.env.PORT || 5000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be a valid TCP port between 1 and 65535.');
}

const nodeEnv = process.env.NODE_ENV || 'development';
if (!['development', 'test', 'production'].includes(nodeEnv)) {
  throw new Error('NODE_ENV must be development, test, or production.');
}
const cookieSameSite = (process.env.COOKIE_SAMESITE || 'lax').toLowerCase();
const cookieDomain = process.env.COOKIE_DOMAIN?.trim() || '';
const apiPublicUrl = (process.env.API_URL || process.env.API_PUBLIC_URL || '').trim().replace(/\/+$/, '');
const jwtAccessSecret = process.env.JWT_ACCESS_SECRET || '';
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || '';
const smtpPass = process.env.SMTP_PASS || '';
const mailFromName = process.env.MAIL_FROM_NAME?.trim() || 'OrianaaClub';
const mailFromAddress = (process.env.MAIL_FROM || process.env.MAIL_FROM_ADDRESS)?.trim() || '';
const mailReplyTo = process.env.MAIL_REPLY_TO?.trim() || '';
const razorpayKeyId = process.env.RAZORPAY_KEY_ID || '';
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || '';
const razorpayWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
const recaptchaSecretKey = process.env.RECAPTCHA_SECRET_KEY || '';
const identityDocumentEncryptionKey = process.env.IDENTITY_DOCUMENT_ENCRYPTION_KEY || '';
const identityDocumentEncryptionKeyIsValid = /^[0-9a-f]{64}$/i.test(identityDocumentEncryptionKey);
const adminPassword = process.env.ADMIN_PASSWORD || '';
const frontendUrl = process.env.FRONTEND_URL?.trim().replace(/\/+$/, '') || '';
const adminUrl = process.env.ADMIN_URL?.trim().replace(/\/+$/, '') || '';
if (!frontendUrl) {
  throw new Error('FRONTEND_URL is required. Set it in Backend/.env.');
}
if (!adminUrl) {
  throw new Error('ADMIN_URL is required. Set it in Backend/.env.');
}
const corsOrigins = (process.env.CORS_ORIGINS || `${frontendUrl},${adminUrl}`)
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);
const backendDirectory = fileURLToPath(new URL('../../', import.meta.url));
const configuredUploadDir = process.env.UPLOAD_DIR?.trim() || './uploads';
const uploadDir = path.resolve(
  path.isAbsolute(configuredUploadDir)
    ? configuredUploadDir
    : path.join(backendDirectory, configuredUploadDir),
);
const mongoAutoIndex = process.env.MONGOOSE_AUTO_INDEX === undefined
  ? nodeEnv !== 'production'
  : process.env.MONGOOSE_AUTO_INDEX.toLowerCase() === 'true';
const logLevel = (process.env.LOG_LEVEL || (nodeEnv === 'production' ? 'info' : 'debug')).toLowerCase();
const activationTokenDays = Number(process.env.ACTIVATION_TOKEN_DAYS || 7);
const resetTokenHours = Number(process.env.RESET_TOKEN_HOURS || 1);
const emailCooldownSeconds = Number(
  process.env.EMAIL_COOLDOWN_SECONDS ?? (nodeEnv === 'production' ? 60 : 0),
);
const draftRetentionDays = Number(process.env.DRAFT_RETENTION_DAYS || 14);
const draftOtpTtlMinutes = Number(process.env.DRAFT_OTP_TTL_MINUTES || 10);
const draftOtpResendSeconds = Number(process.env.DRAFT_OTP_RESEND_SECONDS || 60);
const draftOtpMaxAttempts = Number(process.env.DRAFT_OTP_MAX_ATTEMPTS || 5);
const docRateWindowMinutes = Number(process.env.DOC_RATE_WINDOW_MINUTES || 15);
const docRateMax = Number(process.env.DOC_RATE_MAX || 20);

if (!Number.isInteger(activationTokenDays) || activationTokenDays < 1) {
  throw new Error('ACTIVATION_TOKEN_DAYS must be a positive whole number.');
}
if (!Number.isInteger(resetTokenHours) || resetTokenHours < 1) {
  throw new Error('RESET_TOKEN_HOURS must be a positive whole number.');
}
if (!Number.isInteger(emailCooldownSeconds) || emailCooldownSeconds < 0) {
  throw new Error('EMAIL_COOLDOWN_SECONDS must be a non-negative whole number.');
}
if (!Number.isInteger(draftRetentionDays) || draftRetentionDays < 1) {
  throw new Error('DRAFT_RETENTION_DAYS must be a positive whole number.');
}
if (!Number.isInteger(draftOtpTtlMinutes) || draftOtpTtlMinutes < 1
  || !Number.isInteger(draftOtpResendSeconds) || draftOtpResendSeconds < 0
  || !Number.isInteger(draftOtpMaxAttempts) || draftOtpMaxAttempts < 1) {
  throw new Error('Draft email OTP settings must be positive whole numbers (resend seconds may be zero).');
}
if (!Number.isInteger(docRateWindowMinutes) || docRateWindowMinutes < 1
  || !Number.isInteger(docRateMax) || docRateMax < 1) {
  throw new Error('DOC_RATE_WINDOW_MINUTES and DOC_RATE_MAX must be positive whole numbers.');
}

if (!['lax', 'strict', 'none'].includes(cookieSameSite)) {
  throw new Error('COOKIE_SAMESITE must be lax, strict, or none.');
}
if (!['debug', 'info', 'warn', 'error'].includes(logLevel)) {
  throw new Error('LOG_LEVEL must be debug, info, warn, or error.');
}
if (process.env.MONGOOSE_AUTO_INDEX !== undefined
  && !['true', 'false'].includes(process.env.MONGOOSE_AUTO_INDEX.toLowerCase())) {
  throw new Error('MONGOOSE_AUTO_INDEX must be true or false.');
}
for (const origin of corsOrigins) {
  let parsedOrigin;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    throw new Error('CORS_ORIGINS must contain comma-separated HTTP(S) origins.');
  }
  if (!['http:', 'https:'].includes(parsedOrigin.protocol)
    || parsedOrigin.origin !== origin
    || parsedOrigin.username
    || parsedOrigin.password
    || origin === '*') {
    throw new Error('CORS_ORIGINS must contain valid origins without paths or wildcards.');
  }
}
if (corsOrigins.length === 0) {
  throw new Error('CORS_ORIGINS must contain at least one allowed origin.');
}

if (nodeEnv === 'production') {
  const exampleValues = /YOUR_|NEWPASSWORD|CHANGE.?ME|REPLACE.?ME|PLACEHOLDER|EXAMPLE\.COM/i;
  if (cookieDomain && exampleValues.test(cookieDomain)) {
    throw new Error('COOKIE_DOMAIN must be empty or set to the real shared cookie domain.');
  }
  if (!cookieDomain.startsWith('.')) {
    throw new Error('COOKIE_DOMAIN must be a parent domain beginning with a dot in production.');
  }
  if (cookieSameSite !== 'lax') {
    throw new Error('COOKIE_SAMESITE must be lax for the configured production subdomains.');
  }
  if (mongoAutoIndex) {
    throw new Error('MONGOOSE_AUTO_INDEX must be false in production.');
  }
  if (!process.env.UPLOAD_DIR?.trim()) {
    throw new Error('UPLOAD_DIR must point to persistent storage outside the web root in production.');
  }
  if (corsOrigins.some((origin) => !origin.startsWith('https://'))) {
    throw new Error('Every production CORS_ORIGINS entry must use HTTPS.');
  }

  if (!process.env.SMTP_HOST || !process.env.SMTP_PORT || !process.env.SMTP_USER || !smtpPass || !mailFromAddress) {
    console.warn('[startup] SMTP is not configured. Password setup and recovery email delivery is required in production.');
    throw new Error('SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and MAIL_FROM_ADDRESS must be configured before production starts.');
  }

  const requiredSecrets = [
    ['JWT_ACCESS_SECRET', jwtAccessSecret],
    ['JWT_REFRESH_SECRET', jwtRefreshSecret],
    ['RAZORPAY_KEY_SECRET', razorpayKeySecret],
    ['RAZORPAY_WEBHOOK_SECRET', razorpayWebhookSecret],
    ['RECAPTCHA_SECRET_KEY', recaptchaSecretKey],
    ['IDENTITY_DOCUMENT_ENCRYPTION_KEY', identityDocumentEncryptionKey],
  ];

  for (const [name, value] of requiredSecrets) {
    if (!value || exampleValues.test(value) || value.length < 32) {
      throw new Error(`${name} must be set to a non-placeholder value with at least 32 characters before production starts.`);
    }
    if (!identityDocumentEncryptionKeyIsValid) {
      throw new Error('IDENTITY_DOCUMENT_ENCRYPTION_KEY must be exactly 64 hexadecimal characters.');
    }
  }

  let databasePassword = '';
  try {
    databasePassword = decodeURIComponent(parsedMongoUri.password || '');
  } catch {
    throw new Error('MONGO_URI contains invalid percent-encoding in its credentials.');
  }
  if (
    mongodbDatabase !== 'orianaa_prod'
    || !parsedMongoUri.username
    || !databasePassword
    || databasePassword.length < 32
    || exampleValues.test(mongodbUri)
  ) {
    throw new Error('MONGO_URI must use production Atlas credentials, a non-placeholder password of at least 32 characters, and the orianaa_prod database.');
  }

  if (!razorpayKeyId.startsWith('rzp_live_') || exampleValues.test(razorpayKeyId)) {
    throw new Error('RAZORPAY_KEY_ID must be a live Razorpay key beginning with rzp_live_.');
  }

  if (!process.env.RECAPTCHA_SECRET_KEY || !process.env.ADMIN_NOTIFY_EMAIL) {
    throw new Error('RECAPTCHA_SECRET_KEY and ADMIN_NOTIFY_EMAIL must be configured in production.');
  }

  let frontend;
  try {
    frontend = new URL(frontendUrl);
  } catch {
    throw new Error('FRONTEND_URL must be a valid HTTPS origin in production.');
  }
  if (
    frontend.protocol !== 'https:'
    || frontend.pathname !== '/'
    || frontend.search
    || frontend.hash
    || frontend.username
    || frontend.password
    || exampleValues.test(frontend.hostname)
  ) {
    throw new Error('FRONTEND_URL must be the HTTPS origin of the deployed frontend, with no path.');
  }

  let admin;
  try {
    admin = new URL(adminUrl);
  } catch {
    throw new Error('ADMIN_URL must be a valid HTTPS origin in production.');
  }
  if (
    admin.protocol !== 'https:'
    || admin.pathname !== '/'
    || admin.search
    || admin.hash
    || /[?#]/.test(adminUrl)
    || admin.username
    || admin.password
    || exampleValues.test(admin.hostname)
  ) {
    throw new Error('ADMIN_URL must be the HTTPS origin of the deployed admin app, with no path.');
  }

  let api;
  try {
    api = new URL(apiPublicUrl);
  } catch {
    throw new Error('API_URL must be the public HTTPS origin used by the reverse proxy.');
  }
  if (
    api.protocol !== 'https:'
    || api.pathname !== '/'
    || api.search
    || api.hash
    || api.username
    || api.password
    || exampleValues.test(api.hostname)
  ) {
    throw new Error('API_URL must be an HTTPS origin with no path.');
  }
  const frontendRootHost = frontend.hostname.replace(/^www\./i, '');
  const cookieParentDomain = cookieDomain.slice(1).toLowerCase();
  if (cookieParentDomain !== frontendRootHost) {
    throw new Error('COOKIE_DOMAIN must match the Frontend root domain.');
  }
  const sharesCookieDomain = [frontend.hostname, admin.hostname, api.hostname]
    .every((hostname) => hostname === cookieParentDomain || hostname.endsWith(`.${cookieParentDomain}`));
  if (!sharesCookieDomain) {
    throw new Error('COOKIE_DOMAIN must be a parent domain shared by FRONTEND_URL, ADMIN_URL, and API_URL.');
  }

  const requiredCorsOrigins = [
    `https://${frontendRootHost}`,
    `https://www.${frontendRootHost}`,
    admin.origin,
  ];
  if (requiredCorsOrigins.some((origin) => !corsOrigins.includes(origin))) {
    throw new Error('CORS_ORIGINS must include the Frontend origin, its www alias, and the Admin origin.');
  }

  if (adminPassword && (adminPassword.length < 32 || exampleValues.test(adminPassword))) {
    throw new Error('ADMIN_PASSWORD, when set for seeding, must be a non-placeholder value with at least 32 characters.');
  }
}

export const env = Object.freeze({
  nodeEnv,
  port,
  mongodbUri,
  mongodbHost: parsedMongoUri.host,
  mongodbDatabase,
  jwtAccessSecret,
  jwtRefreshSecret,
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  frontendUrl,
  adminUrl,
  corsOrigins,
  activationTokenDays,
  resetTokenHours,
  emailCooldownSeconds,
  draftRetentionDays,
  draftOtpTtlMinutes,
  draftOtpResendSeconds,
  draftOtpMaxAttempts,
  docRateWindowMinutes,
  docRateMax,
  apiPublicUrl,
  uploadDir,
  mongoAutoIndex,
  logLevel,
  cookieSameSite,
  cookieDomain,
  cookieSecure: nodeEnv === 'production',
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: process.env.SMTP_PORT || '',
  smtpUser: process.env.SMTP_USER || '',
  smtpPass,
  mailFromName,
  mailFromAddress,
  mailReplyTo,
  razorpayKeyId,
  razorpayKeySecret,
  razorpayWebhookSecret,
  recaptchaSecretKey,
  identityDocumentEncryptionKey,
  identityDocumentEncryptionKeyIsValid,
  adminNotifyEmail: process.env.ADMIN_NOTIFY_EMAIL || '',
  adminEmail: process.env.ADMIN_EMAIL || '',
  adminFirstName: process.env.ADMIN_FIRST_NAME || '',
  adminPassword,
  confirmIndexSync: process.env.CONFIRM_INDEX_SYNC || '',
  mailTestTo: process.env.MAIL_TEST_TO || '',
  razorpayMaxOnlineRupees: process.env.RAZORPAY_MAX_ONLINE_RUPEES
    ? Number(process.env.RAZORPAY_MAX_ONLINE_RUPEES)
    : null,
  bankAccountName: process.env.BANK_ACCOUNT_NAME || '',
  bankName: process.env.BANK_NAME || '',
  bankAccountNumber: process.env.BANK_ACCOUNT_NUMBER || '',
  bankIfsc: process.env.BANK_IFSC || '',
  bankBranch: process.env.BANK_BRANCH || '',
});
