import cron from 'node-cron';
import {
  expirePointsLedger,
  runApprovalOverdueJob,
} from '../services/membership-approval.service.js';

let overdueTask;
let ledgerExpiryTask;

export function startMembershipApprovalJobs() {
  if (overdueTask && ledgerExpiryTask) return { overdueTask, ledgerExpiryTask };
  overdueTask = cron.schedule('0 * * * *', async () => {
    try {
      const result = await runApprovalOverdueJob();
      console.info('[membership-approval] Hourly overdue run completed.', result);
    } catch (error) {
      console.error('[membership-approval] Hourly overdue run failed.', error);
    }
  });
  ledgerExpiryTask = cron.schedule('0 3 * * *', async () => {
    try {
      const result = await expirePointsLedger();
      console.info('[points-ledger] Nightly expiry run completed.', result);
    } catch (error) {
      console.error('[points-ledger] Nightly expiry run failed.', error);
    }
  });
  return { overdueTask, ledgerExpiryTask };
}

export function stopMembershipApprovalJobs() {
  overdueTask?.stop();
  ledgerExpiryTask?.stop();
  overdueTask = undefined;
  ledgerExpiryTask = undefined;
}
