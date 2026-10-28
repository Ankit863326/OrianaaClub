// Phase 0: Connect MongoDB before starting the HTTP server.
import app from './app.js';
import { connectDatabase, safeErrorMessage } from './config/db.js';
import { env } from './config/env.js';
import mongoose from 'mongoose';
import {
  startMembershipExpiryJob,
  stopMembershipExpiryJob,
} from './jobs/membership-expiry.job.js';
import {
  startMembershipApprovalJobs,
  stopMembershipApprovalJobs,
} from './jobs/membership-approval.job.js';
import { ensureUploadDirectories } from './utils/uploadDirectories.js';
import logger from './utils/logger.js';
import { verifyMailTransport } from './services/mail.service.js';
import { initializeTermsManifest } from './config/terms.js';
import { startFamilyVerificationJob, stopFamilyVerificationJob } from './jobs/family-verification.job.js';

let server;
let isShuttingDown = false;

async function startServer() {
  if (!env.identityDocumentEncryptionKeyIsValid) {
    logger.error('Identity document encryption is not configured; set IDENTITY_DOCUMENT_ENCRYPTION_KEY in Backend/.env.');
    process.exitCode = 1;
    return;
  }

  logger.info(`Identity document encryption: configured (key length ${env.identityDocumentEncryptionKey.length})`);

  await ensureUploadDirectories();
  if (!await initializeTermsManifest()) {
    logger.warn('Current membership agreement files are not deployed; terms acceptance and payment are unavailable.');
  }
  await connectDatabase();
  await verifyMailTransport();
  startMembershipExpiryJob();
  startMembershipApprovalJobs();
  startFamilyVerificationJob();

  server = app.listen(env.port, () => {
    logger.info(`Listening on port ${env.port}`);
  });
}

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`${signal} received; closing gracefully.`);

  const forcedExit = setTimeout(() => {
    logger.error('Graceful shutdown timed out.');
    process.exit(1);
  }, 10000);
  forcedExit.unref();

  try {
    stopMembershipExpiryJob();
    stopMembershipApprovalJobs();
    stopFamilyVerificationJob();
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
    await mongoose.disconnect();
    clearTimeout(forcedExit);
    logger.info('Shutdown complete.');
  } catch {
    clearTimeout(forcedExit);
    logger.error('Graceful shutdown failed; the process will exit with an error.');
    process.exitCode = 1;
  }
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  const details = reason instanceof Error ? reason.stack || reason.message : String(reason);
  logger.error(`Unhandled rejection; the failed task requires investigation.\n${details}`);
});

startServer().catch((error) => {
  logger.error(`Startup failed: ${safeErrorMessage(error)} HTTP server was not started.`);
  process.exit(1);
});
