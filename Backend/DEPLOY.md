# Backend deployment

Use the repository deployment guide at [`../docs/DEPLOY.md`](../docs/DEPLOY.md). It documents the current environment variable names, persistent upload migration, PM2 setup, Nginx routing, and the production domains.

From the `Backend` directory, a development backend can mark a member's latest eligible payment as paid and set their password for local testing:

```powershell
npm run dev:unblock-member -- --email member@example.com --password LocalPassword123
```

This command refuses to run unless `NODE_ENV=development`. Use a throwaway local password because command-line arguments may be visible to other local processes.

## Family membership data migration

Back up the database before applying `npm run db:migrate:family-membership`. It adds primary-member metadata to existing membership records, normalizes their lifecycle status, preserves legacy statuses in `legacyStatus` when they have no direct equivalent, and creates the global `approvalSeq` counter at zero. The migration is idempotent and does not delete records.

Rollback note: there is no automatic down migration. To roll back, restore the pre-migration backup. A manual rollback can restore statuses from non-empty `legacyStatus` values and unset the newly-added membership metadata and counter only if no approvals have used it; do not remove the counter after approval sequences have been issued.
