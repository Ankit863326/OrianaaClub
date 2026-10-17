# OrianaaClub Admin

Independent React admin app for OrianaaClub. Authentication is held in HTTP-only cookies; this app does not save session tokens in browser storage.

## Run locally

1. From this directory, use `.env.development` for local Vite development; Vite loads it automatically.
2. Install the app dependencies with `npm install`.
3. Start Vite with `npm run dev`; the app uses `http://localhost:5174`.
4. Make sure the Backend API is running and has `ADMIN_URL=http://localhost:5174`.

For production, Vite loads `.env.production`; it points to `https://api.orianaaclub.com/api`. The same API URL is used for Admin API requests and uploaded media.

Build a production bundle with `npm run build`. The `public/_redirects` and `public/.htaccess` files configure common static hosting platforms for HTTPS and React Router fallback.

Run `npm run lint` to check the Admin source for undefined and unused variables.
