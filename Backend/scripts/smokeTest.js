// Run admin authentication checks against a dedicated local test database.
import { randomBytes } from 'node:crypto';

const testMongoUri = process.env.ADMIN_TEST_MONGODB_URI?.trim();
if (!testMongoUri) {
  console.error('[admin-smoke] FAIL: Set ADMIN_TEST_MONGODB_URI to a dedicated test database URI.');
  process.exit(1);
}

let databaseName;
try {
  databaseName = decodeURIComponent(new URL(testMongoUri).pathname.replace(/^\/+/, '').split('/')[0] || '');
} catch {
  console.error('[admin-smoke] FAIL: ADMIN_TEST_MONGODB_URI is not a valid MongoDB URI.');
  process.exit(1);
}

if (databaseName !== 'orianaa_test') {
  console.error('[admin-smoke] FAIL: The admin smoke test only runs against the orianaa_test database.');
  process.exit(1);
}

// Keep this test isolated from Backend/.env and never display credentials or tokens.
process.env.ACTIVATION_TEST_MONGODB_URI = testMongoUri;
process.env.MONGODB_URI = testMongoUri;
process.env.NODE_ENV = 'development';
process.env.PORT = '5001';
process.env.FRONTEND_URL = 'http://127.0.0.1:5173';
process.env.ADMIN_URL = 'http://127.0.0.1:5174';
process.env.RECAPTCHA_SECRET_KEY = '';
process.env.SMTP_HOST = '';
process.env.SMTP_PORT = '';
process.env.SMTP_USER = '';
process.env.SMTP_PASS = '';
process.env.MAIL_FROM_ADDRESS = '';
process.env.JWT_ACCESS_SECRET = randomBytes(48).toString('base64url');
process.env.JWT_REFRESH_SECRET = randomBytes(48).toString('base64url');

const { default: app } = await import('../src/app.js');
const { connectDatabase, safeErrorMessage } = await import('../src/config/db.js');
const { default: mongoose } = await import('mongoose');
const { default: bcrypt } = await import('bcryptjs');
const { default: User } = await import('../src/models/User.js');
const { default: EmailToken } = await import('../src/models/EmailToken.js');
const { default: EmailLog } = await import('../src/models/EmailLog.js');
const { default: AuditLog } = await import('../src/models/AuditLog.js');

const suffix = `${process.pid}-${randomBytes(5).toString('hex')}`;
const adminEmail = `admin-smoke-${suffix}@example.invalid`;
const memberEmail = `member-smoke-${suffix}@example.invalid`;
const originalPassword = `Admin-${randomBytes(10).toString('hex')}A7`;
const replacementPassword = `Reset-${randomBytes(10).toString('hex')}B8`;
let admin;
let member;
let server;
let databaseConnected = false;
let passed = true;

function report(step, succeeded, details = '') {
  console.log(`[admin-smoke] ${succeeded ? 'PASS' : 'FAIL'}: ${step}${details ? ` — ${details}` : ''}`);
  if (!succeeded) passed = false;
}

function assert(condition, step, details = '') {
  report(step, Boolean(condition), details);
  if (!condition) throw new Error(`Admin smoke check failed: ${step}`);
}

function cookiePair(response, name) {
  const setCookie = response.headers.get('set-cookie') || '';
  const value = setCookie.match(new RegExp(`(?:^|[,; ])${name}=([^;,]*)`))?.[1];
  return value ? `${name}=${value}` : '';
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

async function api(baseUrl, path, { method = 'GET', body, cookie = '', csrf = true } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (cookie) headers.Cookie = cookie;
  if (csrf && path.startsWith('/admin/') && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    headers['X-Admin-Request'] = '1';
  }
  return fetch(`${baseUrl}${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function cleanup() {
  if (!databaseConnected) return;
  const userIds = [admin?._id, member?._id].filter(Boolean);
  await Promise.all([
    EmailToken.deleteMany({ user: { $in: userIds } }),
    EmailLog.deleteMany({ to: { $in: [adminEmail, memberEmail] } }),
    AuditLog.deleteMany({ admin: { $in: userIds } }),
    User.deleteMany({ _id: { $in: userIds } }),
  ]);
}

try {
  await connectDatabase();
  databaseConnected = true;
  const passwordHash = await bcrypt.hash(originalPassword, 4);
  [admin, member] = await User.create([
    {
      firstName: 'Admin Smoke',
      email: adminEmail,
      passwordHash,
      role: 'admin',
      status: 'active',
      emailVerified: true,
    },
    {
      firstName: 'Member Smoke',
      email: memberEmail,
      passwordHash,
      role: 'member',
      status: 'active',
      emailVerified: true,
    },
  ]);

  server = await new Promise((resolve, reject) => {
    const httpServer = app.listen(0, '127.0.0.1', () => resolve(httpServer));
    httpServer.once('error', reject);
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;

  const preflight = await fetch(`${baseUrl}/admin/dashboard`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://127.0.0.1:5174',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,x-admin-request',
    },
  });
  const frontendPreflight = await fetch(`${baseUrl}/admin/dashboard`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://127.0.0.1:5173',
      'Access-Control-Request-Method': 'GET',
    },
  });
  assert(
    preflight.headers.get('access-control-allow-origin') === 'http://127.0.0.1:5174'
      && preflight.headers.get('access-control-allow-credentials') === 'true'
      && preflight.headers.get('access-control-allow-headers')?.toLowerCase().includes('x-admin-request')
      && frontendPreflight.headers.get('access-control-allow-origin') === 'http://127.0.0.1:5173',
    'frontend and admin origins plus the custom header are allowed by credentialed CORS',
  );

  const adminLogin = await api(baseUrl, '/admin/auth/login', {
    method: 'POST',
    body: { email: adminEmail, password: originalPassword },
  });
  const adminData = await readJson(adminLogin);
  let adminAccess = cookiePair(adminLogin, 'oc_admin_access');
  let adminRefresh = cookiePair(adminLogin, 'oc_admin_refresh');
  const adminCookieAttributes = (adminLogin.headers.get('set-cookie') || '').toLowerCase();
  assert(
    adminLogin.status === 200
      && adminData.id === String(admin._id)
      && adminData.role === 'admin'
      && adminAccess
      && adminRefresh
      && adminCookieAttributes.includes('path=/api/admin')
      && adminCookieAttributes.includes('path=/api/admin/auth')
      && adminCookieAttributes.includes('httponly')
      && adminCookieAttributes.includes('max-age=900')
      && adminCookieAttributes.includes('max-age=604800'),
    'admin login returns an admin session and separate cookies',
  );

  const adminMe = await api(baseUrl, '/admin/auth/me', { cookie: adminAccess });
  assert(adminMe.ok, 'admin cookie authenticates the admin me endpoint');

  const memberLogin = await api(baseUrl, '/auth/login', {
    method: 'POST',
    body: { email: memberEmail, password: originalPassword },
  });
  const memberAccess = cookiePair(memberLogin, 'oc_access');
  assert(memberLogin.ok && memberAccess, 'member login still returns a member cookie');

  const memberCookieOnAdmin = await api(baseUrl, '/admin/dashboard', { cookie: memberAccess });
  assert(memberCookieOnAdmin.status === 401, 'member cookie cannot access admin APIs');

  const adminCookieOnMember = await api(baseUrl, '/auth/me', { cookie: adminAccess });
  assert(adminCookieOnMember.status === 401, 'admin cookie cannot access member APIs');

  const missingCsrf = await api(baseUrl, '/admin/auth/logout', {
    method: 'POST',
    cookie: `${adminAccess}; ${adminRefresh}`,
    csrf: false,
  });
  assert(missingCsrf.status === 403, 'admin write without X-Admin-Request is forbidden');

  const wrongPassword = await api(baseUrl, '/admin/auth/login', {
    method: 'POST',
    body: { email: adminEmail, password: `${originalPassword}wrong` },
  });
  const wrongPasswordBody = await readJson(wrongPassword);
  assert(
    wrongPassword.status === 401 && wrongPasswordBody.message === 'Email or password is incorrect.',
    'wrong password receives the generic login message',
  );

  const memberAsAdmin = await api(baseUrl, '/admin/auth/login', {
    method: 'POST',
    body: { email: memberEmail, password: originalPassword },
  });
  const memberAsAdminBody = await readJson(memberAsAdmin);
  assert(
    memberAsAdmin.status === 401 && memberAsAdminBody.message === wrongPasswordBody.message,
    'a member account receives the same generic admin-login error',
  );

  const refreshed = await api(baseUrl, '/admin/auth/refresh', {
    method: 'POST',
    cookie: adminRefresh,
    body: {},
  });
  assert(refreshed.ok, 'admin refresh cookie renews the admin session');
  adminAccess = cookiePair(refreshed, 'oc_admin_access') || adminAccess;
  adminRefresh = cookiePair(refreshed, 'oc_admin_refresh') || adminRefresh;

  let capturedResetLink = '';
  const originalWarn = console.warn;
  console.warn = (...args) => {
    const line = args.map(String).join(' ');
    const prefix = '[mail] SMTP is not configured; reset link for local testing: ';
    if (line.startsWith(prefix)) {
      capturedResetLink = line.slice(prefix.length);
      return;
    }
    originalWarn(...args);
  };

  let forgotResponse;
  try {
    forgotResponse = await api(baseUrl, '/admin/auth/forgot-password', {
      method: 'POST',
      body: { email: adminEmail },
    });
  } finally {
    console.warn = originalWarn;
  }
  const forgotBody = await readJson(forgotResponse);
  const unknownForgot = await api(baseUrl, '/admin/auth/forgot-password', {
    method: 'POST',
    body: { email: `unknown-${suffix}@example.invalid` },
  });
  const unknownForgotBody = await readJson(unknownForgot);
  const resetRecord = await EmailToken.findOne({ user: admin._id, type: 'admin-reset' });
  const resetLifetime = resetRecord ? resetRecord.expiresAt.getTime() - Date.now() : 0;
  let resetToken = '';
  try {
    const resetUrl = new URL(capturedResetLink);
    if (resetUrl.pathname === '/reset-password') resetToken = resetUrl.searchParams.get('token') || '';
  } catch {
    resetToken = '';
  }
  assert(
    forgotResponse.status === 202
      && forgotBody.message === 'If the address can be used, instructions will be sent shortly.'
      && unknownForgot.status === forgotResponse.status
      && unknownForgotBody.message === forgotBody.message
      && resetLifetime > 59 * 60 * 1000
      && resetLifetime <= 60 * 60 * 1000
      && /^[a-f0-9]{64}$/.test(resetToken),
    'admin forgot-password is generic and creates a one-hour reset token',
  );

  const resetResponse = await api(baseUrl, '/admin/auth/reset-password', {
    method: 'POST',
    body: {
      token: resetToken,
      password: replacementPassword,
      confirmPassword: replacementPassword,
    },
  });
  assert(resetResponse.ok, 'admin reset-password accepts a valid one-hour token');

  const resetLogin = await api(baseUrl, '/admin/auth/login', {
    method: 'POST',
    body: { email: adminEmail, password: replacementPassword },
  });
  assert(resetLogin.ok, 'admin can log in with the reset password');

  let expectedFailedLogins = 0;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const response = await api(baseUrl, '/admin/auth/login', {
      method: 'POST',
      body: { email: adminEmail, password: `${replacementPassword}wrong` },
    });
    if (response.status === 401) expectedFailedLogins += 1;
  }
  const rateLimited = await api(baseUrl, '/admin/auth/login', {
    method: 'POST',
    body: { email: adminEmail, password: `${replacementPassword}wrong` },
  });
  assert(
    expectedFailedLogins === 8 && rateLimited.status === 429,
    'admin login rate limit blocks repeated attempts',
  );

  const auditRows = await AuditLog.find({ admin: admin._id }).select('action');
  const actions = new Set(auditRows.map((row) => row.action));
  assert(
    actions.has('login') && actions.has('login_failed') && actions.has('password_reset'),
    'successful, failed, and reset admin actions are audited with the admin id',
  );
} catch (error) {
  report('completed the admin authentication smoke test', false, safeErrorMessage(error));
} finally {
  try {
    await cleanup();
  } catch (error) {
    report('removed temporary admin smoke records', false, safeErrorMessage(error));
  }
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
}

process.exitCode = passed ? 0 : 1;
