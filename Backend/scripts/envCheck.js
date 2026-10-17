import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const backendDirectory = path.resolve(scriptDirectory, '..');
const envPath = path.resolve(backendDirectory, '.env');
const examplePath = path.resolve(backendDirectory, '.env.example');
const gitignorePath = path.resolve(backendDirectory, '.gitignore');
const failures = [];
const warnings = [];

function report(status, label, message) {
  console.log(`${status} ${label}: ${message}`);
  if (status === 'FAIL') failures.push(label);
  if (status === 'WARN') warnings.push(label);
}

function parseEnv(text, { ignoreComments = true } = {}) {
  const entries = [];
  const malformedLines = [];
  for (const [index, sourceLine] of text.split(/\r?\n/).entries()) {
    const line = sourceLine.trim();
    if (!line || (ignoreComments && line.startsWith('#'))) continue;
    const separator = line.indexOf('=');
    if (separator < 1) {
      malformedLines.push(index + 1);
      continue;
    }
    entries.push({
      key: line.slice(0, separator).trim(),
      value: line.slice(separator + 1),
      line: index + 1,
    });
  }
  return { entries, malformedLines };
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isLocalHttpOrigin(value) {
  if (!value || value.endsWith('/')) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:'
      && Boolean(parsed.hostname)
      && parsed.pathname === '/'
      && !parsed.search
      && !parsed.hash
      && !parsed.username
      && !parsed.password
      && parsed.origin === value;
  } catch {
    return false;
  }
}

function parseValues(entries) {
  const values = new Map();
  const duplicates = new Set();
  for (const { key, value } of entries) {
    if (values.has(key)) duplicates.add(key);
    values.set(key, value);
  }
  return { values, duplicates };
}

function globToRegExp(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

function ignoresFile(gitignoreText, filename) {
  let ignored = false;
  for (const rawLine of gitignoreText.split(/\r?\n/)) {
    const rule = rawLine.trim();
    if (!rule || rule.startsWith('#')) continue;
    const negated = rule.startsWith('!');
    const pattern = negated ? rule.slice(1) : rule;
    const normalized = pattern.replace(/^\//, '');
    const regex = globToRegExp(normalized);
    const matches = normalized.includes('/')
      ? regex.test(filename)
      : filename.split('/').some((part) => regex.test(part));
    if (matches) ignored = !negated;
  }
  return ignored;
}

async function readText(filePath) {
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

const envText = await readText(envPath);
report(
  envText !== null ? 'PASS' : 'FAIL',
  'Backend/.env exists',
  envText !== null
    ? `read using absolute path ${envPath}`
    : `not found at absolute path ${envPath}`,
);

let values = new Map();
let envEntries = [];
if (envText !== null) {
  report(envText.trim().length > 0 ? 'PASS' : 'FAIL', 'Backend/.env is not empty',
    envText.trim().length > 0 ? 'file contains configuration lines' : 'file is empty');
  const parsed = parseEnv(envText);
  envEntries = parsed.entries;
  const parsedEnv = parseValues(envEntries);
  values = parsedEnv.values;
  report(
    parsedEnv.duplicates.size === 0 ? 'PASS' : 'FAIL',
    'No duplicate keys',
    parsedEnv.duplicates.size === 0
      ? 'each key appears once'
      : 'duplicate environment keys were found',
  );
  report(
    parsed.malformedLines.length === 0 ? 'PASS' : 'FAIL',
    'Plain KEY=value lines',
    parsed.malformedLines.length === 0
      ? 'all non-empty lines use KEY=value format'
      : 'one or more lines are malformed',
  );

  const quoted = envEntries.some(({ value }) => (
    value.length >= 2
      && (value.startsWith('"') && value.endsWith('"')
        || value.startsWith("'") && value.endsWith("'"))
  ));
  report(quoted ? 'FAIL' : 'PASS', 'Values are not quoted',
    quoted ? 'remove surrounding quotes from values' : 'no values are surrounded by quotes');

  const oldMongoKeys = values.has('MONGODB_USERNAME') || values.has('MONGODB_PASSWORD');
  report(oldMongoKeys ? 'FAIL' : 'PASS', 'No legacy MongoDB keys',
    oldMongoKeys ? 'remove MONGODB_USERNAME and MONGODB_PASSWORD' : 'legacy keys are absent');

  const placeholderPattern = /YOUR_PASSWORD|NEWPASSWORD|<[^>]*>|CHANGE[_ -]?ME|REPLACE[_ -]?ME|PLACEHOLDER/i;
  const hasPlaceholder = envEntries.some(({ value }) => placeholderPattern.test(value));
  report(hasPlaceholder ? 'FAIL' : 'PASS', 'No placeholder values',
    hasPlaceholder ? 'replace remaining example or placeholder text' : 'no known placeholders found');

  const mongoUri = values.get('MONGO_URI') || values.get('MONGODB_URI') || '';
  let parsedMongo;
  let decodedMongoPassword = '';
  let mongoValid = false;
  try {
    parsedMongo = new URL(mongoUri);
    decodedMongoPassword = decodeURIComponent(parsedMongo.password);
    const databaseName = parsedMongo.pathname.replace(/^\/+|\/+$/g, '');
    mongoValid = mongoUri.startsWith('mongodb+srv://')
      && parsedMongo.protocol === 'mongodb+srv:'
      && Boolean(parsedMongo.username)
      && Boolean(decodedMongoPassword)
      && Boolean(parsedMongo.hostname)
      && Boolean(databaseName);
  } catch {
    mongoValid = false;
  }
  report(
    mongoValid ? 'PASS' : 'FAIL',
    'MongoDB URI',
    mongoValid
      ? `mongodb+srv URI has a user, password length ${decodedMongoPassword.length}, host, and database`
      : 'URI must contain mongodb+srv://, user, password, host, and database name',
  );

  const accessSecret = values.get('JWT_ACCESS_SECRET') || '';
  const refreshSecret = values.get('JWT_REFRESH_SECRET') || '';
  report(accessSecret.length >= 32 ? 'PASS' : 'FAIL', 'JWT_ACCESS_SECRET length',
    accessSecret.length >= 32 ? 'at least 32 characters' : 'must be at least 32 characters');
  report(refreshSecret.length >= 32 ? 'PASS' : 'FAIL', 'JWT_REFRESH_SECRET length',
    refreshSecret.length >= 32 ? 'at least 32 characters' : 'must be at least 32 characters');
  const distinctSecrets = Boolean(accessSecret && refreshSecret && accessSecret !== refreshSecret);
  report(distinctSecrets ? 'PASS' : 'FAIL', 'JWT secrets differ',
    distinctSecrets ? 'access and refresh secrets are different' : 'secrets must be present and different');

  for (const key of ['FRONTEND_URL', 'ADMIN_URL']) {
    const valid = isLocalHttpOrigin(values.get(key) || '');
    report(valid ? 'PASS' : 'FAIL', key,
      valid ? 'valid http origin with no path or trailing slash' : 'must be an http origin with no path or trailing slash');
  }

  const smtpKeys = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
  const smtpSet = smtpKeys.every((key) => Boolean(values.get(key)));
  if (smtpSet) {
    report('PASS', 'SMTP configuration', 'host, port, user, and password are set');
  } else if (!values.get('SMTP_PASS')) {
    report('WARN', 'SMTP configuration', 'SMTP_PASS is empty; email links will be printed in the terminal');
  } else {
    report('FAIL', 'SMTP configuration', 'set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS together');
  }

  const fromAddressValid = isEmail(values.get('MAIL_FROM_ADDRESS') || '');
  report(fromAddressValid ? 'PASS' : 'FAIL', 'MAIL_FROM_ADDRESS',
    fromAddressValid ? 'valid email address' : 'must be a valid email address');
  const adminEmailValid = isEmail(values.get('ADMIN_EMAIL') || '');
  report(adminEmailValid ? 'PASS' : 'FAIL', 'ADMIN_EMAIL',
    adminEmailValid ? 'valid email address' : 'must be a valid email address');
  if (values.get('SMTP_USER')) {
    const smtpUserValid = isEmail(values.get('SMTP_USER'));
    report(smtpUserValid ? 'PASS' : 'FAIL', 'SMTP_USER',
      smtpUserValid ? 'valid email address' : 'must be a valid email address');
  }

  const hasAdminPassword = Boolean(values.get('ADMIN_PASSWORD'));
  report(hasAdminPassword ? 'WARN' : 'PASS', 'ADMIN_PASSWORD seed value',
    hasAdminPassword ? 'delete ADMIN_PASSWORD from Backend/.env after seeding' : 'no seed password is stored');
}

const backendGitignore = await readText(gitignorePath);
const ignoresEnv = backendGitignore !== null && ignoresFile(backendGitignore, '.env');
const ignoresBackup = backendGitignore !== null && ignoresFile(backendGitignore, '.env.backup');
report(ignoresEnv && ignoresBackup ? 'PASS' : 'FAIL', 'Backend .gitignore',
  ignoresEnv && ignoresBackup ? 'ignores .env and .env.backup' : 'must ignore both .env and .env.backup');

const exampleText = await readText(examplePath);
if (exampleText === null) {
  report('FAIL', 'Backend/.env.example keys', 'example file is missing');
} else {
  const exampleEntries = parseEnv(exampleText).entries;
  const exampleKeys = new Set(exampleEntries.map(({ key }) => key));
  const missingKeys = [...new Set(envEntries.map(({ key }) => key))]
    .filter((key) => !exampleKeys.has(key)
      && !(key === 'MONGODB_URI' && exampleKeys.has('MONGO_URI')));
  report(missingKeys.length === 0 ? 'PASS' : 'FAIL', 'Backend/.env.example keys',
    missingKeys.length === 0
      ? 'contains every key present in Backend/.env'
      : 'one or more keys from Backend/.env are missing');
}

if (process.argv.includes('--db')) {
  const mongoUri = values.get('MONGO_URI') || values.get('MONGODB_URI');
  if (!mongoUri) {
    report('FAIL', 'MongoDB ping', 'cannot connect because MONGO_URI is unavailable');
  } else {
    const mongoose = (await import('mongoose')).default;
    try {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
      await mongoose.connection.db.admin().ping();
      report('PASS', 'MongoDB ping', 'database connection and ping succeeded');
    } catch (error) {
      // Never print raw driver errors because they can contain connection details.
      const errorCode = error?.code ?? error?.cause?.code;
      let explanation = 'Check Atlas credentials, Atlas Network Access, and cluster DNS.';
      if (errorCode === 18 || errorCode === 8000 || /AuthenticationFailed/i.test(error?.name || '')) {
        explanation = 'Database authentication failed; check the Atlas database username and password.';
      } else if (['ENOTFOUND', 'EAI_AGAIN', 'ESERVFAIL'].includes(errorCode)) {
        explanation = 'Cluster DNS lookup failed; check the Atlas hostname and your DNS connection.';
      } else if (['ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET'].includes(errorCode)) {
        explanation = 'The connection was blocked or timed out; allow your IP in Atlas Network Access and check your firewall.';
      }
      report('FAIL', 'MongoDB ping', explanation);
    } finally {
      const mongoose = (await import('mongoose')).default;
      await mongoose.disconnect();
    }
  }
}

if (process.argv.includes('--smtp')) {
  const smtpReady = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS']
    .every((key) => Boolean(values.get(key)));
  if (!smtpReady) {
    report('WARN', 'SMTP verify', 'skipped because SMTP settings are incomplete or SMTP_PASS is empty');
  } else {
    const nodemailer = (await import('nodemailer')).default;
    const transporter = nodemailer.createTransport({
      host: values.get('SMTP_HOST'),
      port: Number(values.get('SMTP_PORT')),
      secure: Number(values.get('SMTP_PORT')) === 465,
      auth: {
        user: values.get('SMTP_USER'),
        pass: values.get('SMTP_PASS'),
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });
    try {
      await transporter.verify();
      report('PASS', 'SMTP verify', 'mail server accepted the connection and authentication');
    } catch (error) {
      // SMTP library errors can include account or server details.
      const errorCode = error?.code;
      let explanation = 'Check the Gmail address, app password, and SMTP account settings.';
      if (['EAUTH', '535'].includes(errorCode) || error?.responseCode === 535) {
        explanation = 'Gmail rejected authentication; use the correct Gmail app password.';
      } else if (['ENOTFOUND', 'EAI_AGAIN', 'ESERVFAIL'].includes(errorCode)) {
        explanation = 'SMTP server DNS lookup failed; check your DNS connection.';
      } else if (['ETIMEDOUT', 'ECONNECTION', 'ECONNREFUSED'].includes(errorCode)) {
        explanation = 'SMTP connection failed or timed out; check your network and SMTP port access.';
      }
      report('FAIL', 'SMTP verify', explanation);
    } finally {
      transporter.close();
    }
  }
}

console.log(`\nSummary: ${failures.length} FAIL, ${warnings.length} WARN.`);
if (failures.length > 0) process.exitCode = 1;
