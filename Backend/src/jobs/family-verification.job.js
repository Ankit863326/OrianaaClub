import cron from 'node-cron';
import { runFamilyVerificationOverdueJob } from '../services/family-verification.service.js';

let overdueTask;

export function startFamilyVerificationJob() {
  if (overdueTask) return overdueTask;
  overdueTask = cron.schedule('0 * * * *', async () => {
    try {
      const result = await runFamilyVerificationOverdueJob();
      console.info('[family-verification] Hourly overdue run completed.', result);
    } catch (error) {
      console.error('[family-verification] Hourly overdue run failed.', error);
    }
  });
  return overdueTask;
}

export function stopFamilyVerificationJob() {
  overdueTask?.stop();
  overdueTask = undefined;
}
