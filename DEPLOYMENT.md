# AL MAJID AI CONTROL CENTER — Deployment

## Cloudflare Pages

The Cloudflare Pages project `al-majid-ai-control-center` serves this repository from the `main` branch and repository root (`.`). Keep the build command empty and the build output directory set to `.`.

Do not use the separate Workers service's `exit 0` build command or a bare `npx wrangler` deploy command for this Pages site.

## Application pages

- Public landing page: `/` (`index.html`)
- Unified administration dashboard: `/admin-control.html`
- Legacy administration URL: `/admin.html` (redirects to `/admin-control.html`)
- Seller portal: `/seller-portal.html`
- Staff applications: `/staff-requests.html`
- System diagnostics: `/system-check.html`

The unified dashboard loads the Supabase JavaScript client, the versioned `frontend.js` asset, and `market-admin.js`. The seller portal and staff applications page load their own page-specific scripts.

## Production release integrity check

A successful GitHub commit or workflow run is not proof that Cloudflare Pages production has updated. After each release, verify the actual production pages and assets:

1. Open `/admin-control.html` and confirm the unified dashboard loads.
2. Confirm `/frontend.js` is the expected current frontend asset and includes the database-backed dashboard functions.
3. Confirm `/market-admin.js` loads and the marketplace administration tab works.
4. Open `/admin.html` and confirm it redirects to `/admin-control.html`.
5. Verify the seller portal, staff applications page, and system diagnostics separately.

If production still serves an older asset, investigate the Pages Git integration and production deployment. Do not change database records or weaken access policies to work around a stale deployment.
