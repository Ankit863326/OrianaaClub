import { randomBytes } from 'node:crypto';
import { copyFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { emitKeypressEvents } from 'node:readline';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const backendDirectory = path.resolve(scriptDirectory, '..');
const envPath = path.join(backendDirectory, '.env');
const backupPath = path.join(backendDirectory, '.env.backup');

const envKeys = [
  'NODE_ENV',
  'PORT',
  'MONGO_URI',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'JWT_ACCESS_EXPIRES_IN',
  'JWT_REFRESH_EXPIRES_IN',
  'FRONTEND_URL',
  'ADMIN_URL',
  'CORS_ORIGINS',
  'API_URL',
  'UPLOAD_DIR',
  'MONGOOSE_AUTO_INDEX',
  'LOG_LEVEL',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'MAIL_FROM_NAME',
  'MAIL_FROM_ADDRESS',
  'MAIL_REPLY_TO',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
  'RECAPTCHA_SECRET_KEY',
  'IDENTITY_DOCUMENT_ENCRYPTION_KEY',
  'ADMIN_EMAIL',
  'ADMIN_FIRST_NAME',
  'ADMIN_PASSWORD',
];

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidAdminPassword(value) {
  return value.length >= 8
    && /[a-z]/.test(value)
    && /[A-Z]/.test(value)
    && /\d/.test(value);
}

function encodeUriComponent(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) => (
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  ));
}

function promptLine(prompt, { hidden = false } = {}) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('Run this setup from an interactive terminal.');
  }

  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdout.write(prompt);

  return new Promise((resolve, reject) => {
    let value = '';

    const finish = (error) => {
      process.stdin.off('keypress', onKeypress);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
      if (error) reject(error);
      else resolve(value);
    };

    const onKeypress = (character, key = {}) => {
      if (key.ctrl && key.name === 'c') {
        finish(new Error('Setup cancelled.'));
        return;
      }

      if (key.name === 'return' || key.name === 'enter') {
        finish();
        return;
      }

      if (key.name === 'backspace' || key.name === 'delete') {
        if (value.length > 0) {
          value = value.slice(0, -1);
          if (!hidden) process.stdout.write('\b \b');
        }
        return;
      }

      if (key.ctrl || key.meta || !character || /[\u0000-\u001f\u007f]/.test(character)) {
        return;
      }

      value += character;
      // Raw-mode input is echoed manually only for non-secret prompts.
      if (!hidden) process.stdout.write(character);
    };

    process.stdin.on('keypress', onKeypress);
  });
}

async function askValue(label, { defaultValue, hidden = false, validate } = {}) {
  while (true) {
    const suffix = defaultValue ? ` [${defaultValue}]` : '';
    const answer = await promptLine(`${label}${suffix}: `, { hidden });
    const value = answer || defaultValue || '';

    if (validate && !validate(value)) {
      console.log('That value is not valid. Please try again.');
      continue;
    }

    return value;
  }
}

async function askMatchingSecret(label) {
  while (true) {
    const value = await askValue(label, {
      hidden: true,
      validate: (input) => input.length > 0,
    });
    const confirmation = await askValue('Re-enter the same value (hidden)', {
      hidden: true,
      validate: (input) => input.length > 0,
    });
    if (value === confirmation) return value;
    console.log('The entries did not match. Please enter the value again.');
  }
}

function makeJwtSecrets() {
  const access = randomBytes(48).toString('hex');
  let refresh = randomBytes(48).toString('hex');
  while (refresh === access) refresh = randomBytes(48).toString('hex');
  return { access, refresh };
}

async function setupEnvironment() {
  const databaseUser = await askValue('Atlas database username', {
    defaultValue: 'ankitsinghan226_db_user',
  });
  const databasePassword = await askMatchingSecret('Atlas database password (hidden)');
  const databaseHost = await askValue('Atlas cluster host', {
    defaultValue: 'cluster0.lhom13p.mongodb.net',
    validate: (value) => /^[a-zA-Z0-9.-]+$/.test(value),
  });
  const mailAddress = await askValue('Gmail address for sending mail', {
    validate: isValidEmail,
  });
  const mailPassword = await askValue('Gmail app password (hidden, optional)', {
    hidden: true,
  });
  const adminEmail = await askValue('Admin login email', {
    validate: isValidEmail,
  });
  const adminPassword = await askValue(
    'Admin password (hidden; 8+ characters, upper, lower, and number)',
    { hidden: true, validate: isValidAdminPassword },
  );
  const { access, refresh } = makeJwtSecrets();

  const values = {
    NODE_ENV: 'development',
    PORT: '5000',
    MONGO_URI: `mongodb+srv://${encodeUriComponent(databaseUser)}:${encodeUriComponent(databasePassword)}@${databaseHost}/orianaa_dev?appName=Cluster0`,
    JWT_ACCESS_SECRET: access,
    JWT_REFRESH_SECRET: refresh,
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
    FRONTEND_URL: 'http://localhost:5173',
    ADMIN_URL: 'http://localhost:5174',
    CORS_ORIGINS: 'http://localhost:5173,http://localhost:5174',
    API_URL: 'http://localhost:5000',
    UPLOAD_DIR: './uploads',
    MONGOOSE_AUTO_INDEX: 'true',
    LOG_LEVEL: 'debug',
    SMTP_HOST: 'smtp.gmail.com',
    SMTP_PORT: '587',
    SMTP_USER: mailAddress,
    SMTP_PASS: mailPassword,
    MAIL_FROM_NAME: 'OrianaaClub',
    MAIL_FROM_ADDRESS: mailAddress,
    MAIL_REPLY_TO: mailAddress,
    RAZORPAY_KEY_ID: '',
    RAZORPAY_KEY_SECRET: '',
    RAZORPAY_WEBHOOK_SECRET: '',
    RECAPTCHA_SECRET_KEY: '',
    IDENTITY_DOCUMENT_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
    ADMIN_EMAIL: adminEmail,
    ADMIN_FIRST_NAME: 'Ankit',
    ADMIN_PASSWORD: adminPassword,
  };

  const contents = `${envKeys.map((key) => `${key}=${values[key]}`).join('\n')}\n`;
  try {
    await copyFile(envPath, backupPath);
    console.log('Existing Backend/.env copied to Backend/.env.backup.');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  await writeFile(envPath, contents, { encoding: 'utf8', mode: 0o600 });
  const savedContents = await readFile(envPath, 'utf8');
  const savedLines = savedContents.split(/\r?\n/).filter(Boolean);
  const verified = savedLines.length === envKeys.length
    && envKeys.every((key, index) => savedLines[index] === `${key}=${values[key]}`);

  if (!verified) {
    throw new Error('The environment file did not pass its save verification.');
  }

  console.log('\nBackend/.env saved and all lines verified. Values are not displayed.');
  console.table(envKeys.map((key) => ({
    Key: key,
    Status: values[key] ? 'set' : 'EMPTY',
  })));

  if (!mailPassword) {
    console.log('SMTP_PASS is empty; the backend will print email links in the terminal.');
  }
  console.log('After running "npm run seed:admin", delete ADMIN_PASSWORD from Backend/.env.');
}

setupEnvironment().catch(() => {
  if (process.stdin.isTTY && process.stdin.isRaw) process.stdin.setRawMode(false);
  console.error('Environment setup did not complete. No credential values were displayed.');
  process.exitCode = 1;
});
