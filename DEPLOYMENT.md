# AL MAJID AI CONTROL CENTER — Deployment

The seller portal is served as a static page at `/seller-portal.html`.

The Cloudflare Pages project is connected to this repository and deploys the `main` branch from the repository root (`.`) without a build command. Changes merged into `main` should trigger a production deployment.

Seller sign-in uses email OTP and Google OAuth. Product submissions are stored in the AL MAJID Nigeria Marketplace Supabase project for admin review.

## Static deployment verification

This repository is served by the existing Cloudflare Pages project `al-majid-ai-control-center`. Keep the Pages build command empty and the build output directory set to `.`. Do not use the separate Workers service's `exit 0` build command or bare `npx wrangler` deploy command for this Pages site.

The agency administration dashboard is served at `/admin.html` (the root `/` is the public marketplace landing page). The admin page loads the Supabase JavaScript client and `frontend.js`; verify the production deployment at `/admin.html` after each Pages release.

## Production release integrity check

A successful GitHub workflow run is not proof that Cloudflare Pages production has updated. After every release, verify the actual production asset at `/frontend.js` and confirm that it contains `loadDashboardData` and the current database-backed dashboard functions. Also verify that `/admin.html` references the matching versioned frontend asset. If production still serves the legacy frontend, investigate the Pages Git integration and production deployment rather than changing database records or weakening access policies.
