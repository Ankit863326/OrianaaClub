// Phase 6: Exercise activation through the real API using an isolated test database.
import { randomBytes } from 'node:crypto';

const testMongoUri = process.env.ACTIVATION_TEST_MONGODB_URI?.trim();
if (!testMongoUri) {
  console.error('[activation-test] FAIL: Set ACTIVATION_TEST_MONGODB_URI to a dedicated test database URI.');
  process.exit(1);
}

let databaseName;
try {
  databaseName = decodeURIComponent(new URL(testMongoUri).pathname.replace(/^\/+/, '').split('/')[0] || '');
} catch {
  console.error('[activation-test] FAIL: ACTIVATION_TEST_MONGODB_URI is not a valid MongoDB URI.');
  process.exit(1);
}

if (databaseName !== 'orianaa_test') {
  console.error('[activation-test] FAIL: The activation test only runs against the orianaa_test database.');
  process.exit(1);
}

// Use isolated runtime settings so the script never reads or prints production credentials.
process.env.ACTIVATION_TEST_MONGODB_URI = testMongoUri;
process.env.MONGODB_URI = testMongoUri;
process.env.NODE_ENV = 'development';
process.env.PORT = '5001';
process.env.FRONTEND_URL = 'http://127.0.0.1:5173';
process.env.RECAPTCHA_SECRET_KEY = '';
process.env.SMTP_HOST = '';
process.env.SMTP_PORT = '';
process.env.SMTP_USER = '';
process.env.SMTP_PASS = '';
process.env.MAIL_FROM_ADDRESS = '';
process.env.EMAIL_COOLDOWN_SECONDS = '0';
process.env.JWT_ACCESS_SECRET = randomBytes(48).toString('base64url');
process.env.JWT_REFRESH_SECRET = randomBytes(48).toString('base64url');

const { default: app } = await import('../src/app.js');
const { connectDatabase, safeErrorMessage } = await import('../src/config/db.js');
const mongoose = (await import('mongoose')).default;
const testEmail = `activation-test-${process.pid}-${randomBytes(5).toString('hex')}@example.invalid`;
const testPassword = `Activation-${randomBytes(10).toString('hex')}A7`;
let server;
let testUserId;
let databaseConnected = false;
let capturedMailLines = [];
let passed = true;

function report(step, succeeded, details = '') {
  console.log(`[activation-test] ${succeeded ? 'PASS' : 'FAIL'}: ${step}${details ? ` — ${details}` : ''}`);
  if (!succeeded) passed = false;
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

async function cleanup() {
  if (databaseConnected) {
    const { default: User } = await import('../src/models/User.js');
    const { default: EmailToken } = await import('../src/models/EmailToken.js');
    const { default: EmailCooldown } = await import('../src/models/EmailCooldown.js');
    const testUser = testUserId
      ? { _id: testUserId }
      : await User.findOne({ email: testEmail }).select('_id');
    testUserId = testUser?._id;
    await Promise.all([
      testUserId ? EmailToken.deleteMany({ user: testUserId }) : Promise.resolve(),
      EmailCooldown.deleteMany({ email: testEmail }),
      User.deleteOne({ email: testEmail }),
    ]);
    await mongoose.connection.collection('emaillogs').deleteMany({ to: testEmail });
  }
}

try {
  await connectDatabase();
  databaseConnected = true;
  report('connected to the isolated orianaa_test database', true);

  server = await new Promise((resolve, reject) => {
    const httpServer = app.listen(0, '127.0.0.1', () => resolve(httpServer));
    httpServer.once('error', reject);
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;

  const originalLog = console.log;
  console.log = (...args) => {
    const line = args.map(String).join(' ');
    if (line.startsWith('[mail:dev] ')) {
      capturedMailLines.push(line);
      return;
    }
    originalLog(...args);
  };

  let registrationResponse;
  try {
    registrationResponse = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: 'Activation Test', email: testEmail }),
    });
  } finally {
    console.log = originalLog;
  }
  report('registered a test member through the API', registrationResponse?.status === 202);
  const initialRegistrationResult = await readJson(registrationResponse);
  if (registrationResponse?.status === 202) {
    const { default: User } = await import('../src/models/User.js');
    testUserId = (await User.findOne({ email: testEmail }).select('_id'))?._id;
  }

  let activationToken = '';
  try {
    const activationLine = capturedMailLines.find((line) => line.includes('subject=Set your OrianaaClub password '));
    const activationLink = activationLine?.match(/ link=(\S+)$/)?.[1];
    const parsedLink = new URL(activationLink);
    if (parsedLink.pathname === '/set-password') activationToken = parsedLink.searchParams.get('token')?.trim() || '';
  } catch {
    activationToken = '';
  }
  report('captured the development password setup token without printing it', /^[a-f0-9]{64}$/.test(activationToken));

  const firstActivationToken = activationToken;
  capturedMailLines = [];
  const originalPendingLog = console.log;
  let pendingRegistrationResponse;
  console.log = (...args) => {
    const line = args.map(String).join(' ');
    if (line.startsWith('[mail:dev] ')) capturedMailLines.push(line);
    else originalPendingLog(...args);
  };
  try {
    pendingRegistrationResponse = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: 'Activation Test', email: testEmail }),
    });
  } finally {
    console.log = originalPendingLog;
  }
  const pendingRegistrationResult = await readJson(pendingRegistrationResponse);
  report(
    're-registered a pending email with the same generic response',
    pendingRegistrationResponse.status === 202
      && pendingRegistrationResult.message === initialRegistrationResult.message,
  );
  let renewedActivationToken = '';
  try {
    const activationLine = capturedMailLines.find((line) => line.includes('subject=Set your OrianaaClub password '));
    const activationLink = activationLine?.match(/ link=(\S+)$/)?.[1];
    const parsedLink = new URL(activationLink);
    if (parsedLink.pathname === '/set-password') renewedActivationToken = parsedLink.searchParams.get('token')?.trim() || '';
  } catch {
    renewedActivationToken = '';
  }
  report(
    'issued a replacement token for the pending account',
    /^[a-f0-9]{64}$/.test(renewedActivationToken) && renewedActivationToken !== firstActivationToken,
  );
  activationToken = renewedActivationToken;
  if (firstActivationToken) {
    const oldTokenResponse = await fetch(`${baseUrl}/auth/activate/verify?${new URLSearchParams({ token: firstActivationToken })}`);
    report('invalidated the old pending activation token', oldTokenResponse.status === 400);
  } else {
    report('invalidated the old pending activation token', false, 'skipped because no initial token was captured');
  }

  let verifyResponse;
  if (activationToken) {
    const query = new URLSearchParams({ token: activationToken });
    verifyResponse = await fetch(`${baseUrl}/auth/activate/verify?${query}`);
    const verifyResult = await readJson(verifyResponse);
    const verified = verifyResponse.ok && verifyResult.email === testEmail && Boolean(testUserId);
    report('verified the activation token without consuming it', verified);

    const secondVerify = await fetch(`${baseUrl}/auth/activate/verify?${query}`);
    report('allowed verification to be repeated before activation', secondVerify.ok);
  } else {
    report('verified the activation token without consuming it', false, 'skipped because no development link was captured');
    report('allowed verification to be repeated before activation', false, 'skipped because no development link was captured');
  }

  let activationSucceeded = false;
  if (activationToken) {
    const activationResponse = await fetch(`${baseUrl}/auth/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: activationToken,
        password: testPassword,
        confirmPassword: testPassword,
      }),
    });
    activationSucceeded = activationResponse.ok;
    report('activated the account and consumed the token', activationSucceeded);
  } else {
    report('activated the account and consumed the token', false, 'skipped because no development link was captured');
  }

  if (activationSucceeded) {
    const reusedTokenResponse = await fetch(`${baseUrl}/auth/activate/verify?${new URLSearchParams({ token: activationToken })}`);
    report('rejected verification after the token was consumed', reusedTokenResponse.status === 400);

    capturedMailLines = [];
    const originalActiveLog = console.log;
    const activeRegistrationLogs = [];
    let activeRegistrationResponse;
    console.log = (...args) => {
      const line = args.map(String).join(' ');
      if (line.startsWith('[dev] account already active')) activeRegistrationLogs.push(line);
      else if (line.startsWith('[mail:dev] ')) capturedMailLines.push(line);
      else originalActiveLog(...args);
    };
    try {
      activeRegistrationResponse = await fetch(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: 'Activation Test', email: testEmail }),
      });
    } finally {
      console.log = originalActiveLog;
    }
    const activeRegistrationResult = await readJson(activeRegistrationResponse);
    report(
      'active account registration remains generic and sends no link',
      activeRegistrationResponse.status === 202
        && activeRegistrationResult.message === initialRegistrationResult.message
        && activeRegistrationLogs.includes('[dev] account already active, no link sent')
        && !capturedMailLines.some((line) => line.startsWith('[mail:dev] ')),
    );

    const loginResponse = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: testPassword }),
    });
    report('logged in with the activated test account', loginResponse.ok);

    capturedMailLines = [];
    const originalForgotLog = console.log;
    let forgotResponse;
    console.log = (...args) => {
      const line = args.map(String).join(' ');
      if (line.startsWith('[mail:dev] ')) capturedMailLines.push(line);
      else originalForgotLog(...args);
    };
    try {
      forgotResponse = await fetch(`${baseUrl}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail }),
      });
    } finally {
      console.log = originalForgotLog;
    }
    const forgotResult = await readJson(forgotResponse);
    report(
      'requested password reset with the generic 202 response',
      forgotResponse.status === 202 && forgotResult.message === initialRegistrationResult.message,
    );

    let resetToken = '';
    try {
      const resetLine = capturedMailLines.find((line) => line.includes('subject=Reset your OrianaaClub password '));
      const resetLink = resetLine?.match(/ link=(\S+)$/)?.[1];
      const parsedLink = new URL(resetLink);
      if (parsedLink.pathname === '/reset-password') resetToken = parsedLink.searchParams.get('token')?.trim() || '';
    } catch {
      resetToken = '';
    }
    report('captured the development reset token without printing it', /^[a-f0-9]{64}$/.test(resetToken));

    if (resetToken) {
      const resetPassword = `Reset-${randomBytes(10).toString('hex')}A7`;
      const resetResponse = await fetch(`${baseUrl}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, password: resetPassword, confirmPassword: resetPassword }),
      });
      report('reset the account password with the requested token', resetResponse.ok);
      const newLoginResponse = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail, password: resetPassword }),
      });
      report('logged in with the reset password', newLoginResponse.ok);
    } else {
      report('reset the account password with the requested token', false, 'skipped because no reset token was captured');
      report('logged in with the reset password', false, 'skipped because no reset token was captured');
    }
  } else {
    report('rejected verification after the token was consumed', false, 'skipped because activation failed');
    report('logged in with the activated test account', false, 'skipped because activation failed');
    report('requested password reset with the generic 202 response', false, 'skipped because activation failed');
    report('captured the development reset token without printing it', false, 'skipped because activation failed');
    report('reset the account password with the requested token', false, 'skipped because activation failed');
    report('logged in with the reset password', false, 'skipped because activation failed');
    report('active account registration remains generic and sends no link', false, 'skipped because activation failed');
  }
} catch (error) {
  report('completed the activation API test', false, safeErrorMessage(error));
} finally {
  try {
    await cleanup();
  } catch (error) {
    report('removed temporary test records', false, safeErrorMessage(error));
  }
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await mongoose.disconnect();
}

process.exitCode = passed ? 0 : 1;
