import cron from 'node-cron';
import { runMembershipExpiry } from '../services/membership-expiry.service.js';
import { runMembershipDraftCleanup } from '../services/membership-draft.service.js';

let scheduledTask;

export function startMembershipExpiryJob() {
  if (scheduledTask) return scheduledTask;
  scheduledTask = cron.schedule('0 2 * * *', async () => {
    try {
      const result = await runMembershipExpiry();
      console.info('[membership-expiry] Daily expiry run completed.', result);
    } catch (error) {
      console.error('[membership-expiry] Daily expiry run failed.', error);
    }
    try {
      const result = await runMembershipDraftCleanup();
      console.info('[membership-drafts] Daily cleanup run completed.', result);
    } catch (error) {
      console.error('[membership-drafts] Daily cleanup run failed.', error);
    }
  });
  return scheduledTask;
}

export function stopMembershipExpiryJob() {
  scheduledTask?.stop();
  scheduledTask = undefined;
}
