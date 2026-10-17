# OrianaaClub frontend: Hostinger deployment

The frontend is a Vite single-page application. Build it locally or in a trusted CI environment, then upload only the contents of `frontend/dist/` to the Hostinger website's document root (usually `public_html/`). The backend runs separately; Hostinger static hosting does not run the Node API.

## 1. Set public build-time configuration

Use `.env.production` for production builds. It is loaded automatically by Vite:

- `VITE_API_URL` is `https://api.orianaaclub.com/api`.
- `VITE_ADMIN_URL` is `https://admin.orianaaclub.com`.
- Set `VITE_RECAPTCHA_SITE_KEY` to the public reCAPTCHA site key registered for the website hostname.

Only public browser values belong in `VITE_` variables. Never add MongoDB credentials, JWT secrets, Razorpay secrets, SMTP credentials, bank secrets, or the reCAPTCHA **secret** key to frontend environment variables or source.

## 2. Build and inspect

From the `frontend/` directory:

```sh
npm ci
npm run build
```

Review the generated `dist/` directory. The build is a static export; environment changes require a new build and upload.

The current build reports a **549.85 kB minified JavaScript entry chunk** (163.47 kB gzip), above Vite's 500 kB advisory threshold. It also emits a 3.77 MB imported video and several images over 1 MB. Consider further route-level code splitting and image/video compression before launch; the warning does not prevent the build.

## 3. Upload to Hostinger

1. Add the domain to Hostinger and configure its DNS as directed in hPanel.
2. Enable Hostinger SSL for the domain before publishing.
3. Open File Manager or connect using SFTP and upload the **contents** of `dist/` into the website document root, replacing the prior build's generated files.
4. Confirm `index.html`, `assets/`, and `public/.htaccess`'s copied output (`.htaccess`) are at the document root. Ensure hidden files are visible in File Manager.
5. Do not upload `node_modules`, source maps unless intentionally used, `.env.production`, or backend files.
6. Retain `public/_redirects` in source for hosts that use it; Hostinger Apache uses the included `.htaccess`.
7. Test direct visits and refreshes on `/`, `/login`, `/register`, `/events`, `/blog`, and `/admin`; test the forms and API requests over HTTPS.

The `.htaccess` file forces HTTPS, serves the React entry point for client routes, enables gzip where Apache modules are available, disables caching for `index.html`, and gives hashed assets long-lived immutable cache headers.

## 4. Rollback and updates

Keep the previous `dist/` archive before uploading a release. To roll back, restore that archive's files and clear the browser/CDN cache if needed. A changed API URL or reCAPTCHA site key requires rebuilding and re-uploading the frontend.

## Media-size note

The current public video `public/Videos/MahindraKeystoneEditWEBSITE.mp4` is about **18.75 MB**. Compress it to an adaptive web format/bitrate or serve it from a video CDN; avoid shipping multiple large videos in the initial page payload. The largest listed public images are about 2.98 MB and 2.67 MB; resize and convert them to responsive WebP/AVIF variants before launch.
