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

## Legacy Admin data repair

Run `npm run db:repair-legacy-admin-data` first to inspect legacy memberships, payments, counters, dangling optional references, and the invoice/counter uniqueness indexes. It is dry-run by default. Back up the database, review the report, then run `npm run db:repair-legacy-admin-data -- --apply` to fill safe defaults, clear only dangling optional references, and create the non-destructive unique indexes when existing values are unique. In production, also pass `--confirm-production`. The script never deletes records and stops rather than dropping or replacing an incompatible index.
