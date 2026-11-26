# AL MAJID AI CONTROL CENTER

إدارة وكالة الماجد للتسويق والذكاء الاصطناعي — السوق النيجيري.

## Project pages

- Public landing page: `/` (`index.html`)
- Unified administration dashboard: `/admin-control.html`
- Legacy administration URL: `/admin.html` (redirects to the unified dashboard)
- Seller portal: `/seller-portal.html`
- Staff applications review: `/staff-requests.html`
- System diagnostics: `/system-check.html`

## Main application files

- `frontend.js`: shared administration authentication and dashboard functions.
- `market-admin.js`: administration functions for marketplace sellers and products.
- `seller-portal.js`: seller registration, sign-in, and product submission.
- `staff-requests.js`: director-only staff application review.
- `app.js`: Supabase Edge Function; treat as backend code, not browser JavaScript.
- `supabase/migrations/`: ordered database migrations. Review dependencies and migration history before changing or removing any migration.

## Deployment

The Cloudflare Pages project serves this repository from its root with no build command. See [DEPLOYMENT.md](DEPLOYMENT.md) for release and production verification steps.

A GitHub commit does not by itself prove that Cloudflare Pages production has deployed the change. Verify the live Pages site after each release.

## Security

The canonical security policy and vulnerability reporting instructions are in [SECURITY.md](SECURITY.md). Do not place passwords, OTP codes, API secrets, private keys, or Supabase service-role keys in source code.

## Working safely

- Preserve separate pages and scripts when they serve distinct user roles or workflows.
- Do not remove database migrations based only on similar names; later migrations may correct earlier policies.
- Verify references and runtime behavior before deleting or consolidating files.
- Do not modify backend functions, database policies, or production deployment settings without explicit approval.
