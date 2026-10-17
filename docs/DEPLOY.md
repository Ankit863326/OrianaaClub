# OrianaaClub VPS deployment

This guide deploys the Frontend and Admin as Vite static builds and runs the Backend API with PM2 behind Nginx and HTTPS. The supported Node version is `24.21.x`.

## Environment files

Keep private values on the server or in local ignored files; commit only the `.env.example` templates.

- Frontend local: `frontend/.env.development`, loaded automatically by `npm run dev` at `http://localhost:5173`.
- Frontend production build: `frontend/.env.production`, with `VITE_API_URL=https://api.orianaaclub.com/api` and `VITE_ADMIN_URL=https://admin.orianaaclub.com`.
- Set `VITE_SITE_URL` to the current site's origin in each Frontend/Admin mode file. The production build uses it to replace library-only `http://localhost` fallback strings; it does not change page URLs or appearance.
- Admin local: `Admin/.env.development`, loaded by `npm run dev` at `http://localhost:5174`.
- Admin production build: `Admin/.env.production`, with `VITE_API_URL=https://api.orianaaclub.com/api`.
- Backend local and server runtime: `Backend/.env`. Backend resolves this file relative to its config module, including when `npm run dev` is launched from `Backend/`.
- Safe templates: `frontend/.env.example`, `frontend/.env.production.example`, `Admin/.env.example`, `Backend/.env.example`, and `Backend/.env.production.example`.

Vite exposes only `VITE_` variables to the browser. The Frontend also needs the public `VITE_RECAPTCHA_SITE_KEY`; never put server secrets, private Razorpay credentials, or database credentials in either frontend env file. Backend accepts `MONGO_URI` and `API_URL`; it also accepts the existing `MONGODB_URI` and `API_PUBLIC_URL` names for compatibility. Access and refresh JWT secrets remain distinct.

Production Backend settings must include:

- `NODE_ENV=production`, `PORT=5000`, `MONGO_URI`, `UPLOAD_DIR=/var/lib/orianaaclub/uploads`
- `FRONTEND_URL=https://orianaaclub.com`, `ADMIN_URL=https://admin.orianaaclub.com`, `API_URL=https://api.orianaaclub.com`
- `CORS_ORIGINS=https://orianaaclub.com,https://www.orianaaclub.com,https://admin.orianaaclub.com`
- `COOKIE_DOMAIN=.orianaaclub.com`, `COOKIE_SAMESITE=lax`, `MONGOOSE_AUTO_INDEX=false`
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, their expiry values, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RECAPTCHA_SECRET_KEY`, and `IDENTITY_DOCUMENT_ENCRYPTION_KEY`
- SMTP sender and credentials, admin notification email, and bank-transfer fields if those payment methods are offered.

The production validator rejects missing/placeholder secrets, the wrong Mongo database, non-HTTPS public origins, invalid CORS entries, and an invalid identity-document key. Generate a 32-byte hex key with:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`IDENTITY_DOCUMENT_ENCRYPTION_KEY` must be 64 hexadecimal characters. Keep it backed up securely; changing or losing it prevents decrypting stored identity values/files.

## Install and build

Install Node.js `24.21.x` on the VPS or build machine, then install dependencies separately:

```sh
cd frontend && npm ci && npm run build
cd ../Admin && npm ci && npm run build
cd ../Backend && npm ci --omit=dev
```

Vite's production mode reads `.env.production`; development mode reads `.env.development`. Production builds explicitly disable source maps. Upload `frontend/dist/` and `Admin/dist/` to their separate directories; do not run Vite dev servers in production.

Mongoose index auto-creation is on in development and off in production. After reviewing the migration and taking a database backup, run the index sync manually when required:

```sh
cd /srv/orianaaclub/OrianaaClub/Backend
CONFIRM_INDEX_SYNC=YES npm run db:indexes
```

## Persistent uploads

Create a persistent directory outside the Nginx document roots and grant the API service account write access:

```sh
sudo install -d -o orianaaclub -g orianaaclub -m 0750 /var/lib/orianaaclub/uploads
```

Set `UPLOAD_DIR=/var/lib/orianaaclub/uploads`. The API creates `public-media/`, `private/identity/`, and `private/verification/` beneath it. Only `public-media/` is served, at `/media/...`; the private document directories have no static mount and are accessed through the existing authenticated, role-checked API routes. The former `/uploads` static mount is removed.

Before the first release that moves existing files, stop the old API, set the new `UPLOAD_DIR`, and run this once from `Backend/`:

```sh
npm run uploads:migrate
```

This moves legacy public uploads and private identity/verification documents from the old in-app directories to the matching new subdirectories without overwriting collisions. Back up both the old folders and the target directory first. Existing database links beginning `/uploads/` are normalized by the clients to `/media/`; the file migration preserves the filenames.

## PM2

The root `ecosystem.config.js` starts one production API process named `oriana-api`; the Backend loads its own `Backend/.env`.

```sh
cd /srv/orianaaclub/OrianaaClub
pm2 start ecosystem.config.js
pm2 status
pm2 logs oriana-api
pm2 save
pm2 startup
```

Run the exact startup command printed by PM2 for the server's init system, then run `pm2 save` again. Keep the Node listener bound behind the local reverse proxy/firewall.

## Nginx

Replace the example filesystem paths with the deployed directories. Both SPA server blocks use `try_files` so browser refreshes on routes such as `/luxury-membership` resolve to `index.html`.
The HTTPS blocks below are the post-Certbot configuration. Initially create the equivalent HTTP host blocks, issue certificates with the commands below, then apply these HTTPS blocks (Certbot can also add the TLS directives automatically).

```nginx
server {
    listen 80;
    server_name orianaaclub.com www.orianaaclub.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name orianaaclub.com www.orianaaclub.com;
    ssl_certificate /etc/letsencrypt/live/orianaaclub.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/orianaaclub.com/privkey.pem;
    root /srv/orianaaclub/OrianaaClub/frontend/dist;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
}

server {
    listen 80;
    server_name admin.orianaaclub.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name admin.orianaaclub.com;
    ssl_certificate /etc/letsencrypt/live/admin.orianaaclub.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/admin.orianaaclub.com/privkey.pem;
    root /srv/orianaaclub/OrianaaClub/Admin/dist;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
}

server {
    listen 80;
    server_name api.orianaaclub.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.orianaaclub.com;
    ssl_certificate /etc/letsencrypt/live/api.orianaaclub.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.orianaaclub.com/privkey.pem;
    client_max_body_size 15m;
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

Issue certificates after DNS points all three names to the VPS:

```sh
sudo certbot --nginx -d orianaaclub.com -d www.orianaaclub.com
sudo certbot --nginx -d admin.orianaaclub.com
sudo certbot --nginx -d api.orianaaclub.com
```

The API's Razorpay webhook paths are `/api/webhooks/razorpay` and `/api/payments/webhook`. Both are parsed as raw JSON before the general body parser and signatures are verified with `RAZORPAY_WEBHOOK_SECRET`; event handling uses provider event IDs for idempotency. Configure the relevant endpoint in Razorpay and use a separate webhook secret, not the API key secret.

## Go-live checklist

- [ ] Set DNS records and valid HTTPS certificates for `orianaaclub.com`, `www.orianaaclub.com`, `admin.orianaaclub.com`, and `api.orianaaclub.com`.
- [ ] Set production env values and verify the Backend fails startup for a missing required value.
- [ ] Confirm `CORS_ORIGINS` includes only the two Frontend origins and Admin origin; confirm unknown browser origins are rejected.
- [ ] Confirm cookies are `Secure`, `HttpOnly`, `SameSite=Lax`, and scoped to `.orianaaclub.com`.
- [ ] Migrate existing uploads before starting the new API; confirm sensitive files are not reachable through `/media` or any public static path.
- [ ] Build both SPAs; check each `dist/` for `localhost` and verify production API references point to `https://api.orianaaclub.com/api`.
- [ ] Refresh `/luxury-membership` and other deep links through Nginx.
- [ ] Check `GET /health` and `GET /api/health`; the production API health payload must not disclose database details.
- [ ] Verify the payment provider test/live keys, webhook signature, delivery, and idempotent retry behavior before accepting payments.
- [ ] Verify password setup/recovery mail, identity-document encryption, authenticated document routes, database backups, upload backups, and restore procedures.
- [ ] Keep `.env`, private uploads, `node_modules`, and build artifacts out of source control.
