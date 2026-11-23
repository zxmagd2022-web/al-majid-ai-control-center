# AL MAJID AI CONTROL CENTER — Development Deployment

This deployment scaffold is isolated to the `dev/cloudflare-deploy-fix` branch.

## Scope
- Serves the development copies in `public/` as static assets.
- Uses `worker/index.js` only as the Worker fallback for asset requests.
- Does not modify the existing root `index.html`, root `frontend.js`, `app.js`, Supabase migrations, production Worker, or production domain.
- Does not contain Supabase service-role keys, passwords, OTPs, or other server secrets.

## Cloudflare setup (manual review required)
1. Create a separate Worker named `al-majid-ai-control-center-dev` from this branch.
2. Use the repository root as the project root.
3. Use Wrangler configuration file `wrangler.jsonc`; no build command is required for this static-asset setup.
4. Keep production routes and custom domains disconnected from this development Worker.
5. Deploy only to its separate `workers.dev` preview URL after reviewing the branch.

## Validation checklist
- [ ] Confirm the development Worker uses this branch and `wrangler.jsonc`.
- [ ] Confirm `/` serves `public/index.html`.
- [ ] Confirm `/frontend.js` returns JavaScript (not HTML).
- [ ] Confirm browser console has no missing asset errors.
- [ ] Confirm the admin login flow and director authorization against the intended Supabase project.
- [ ] Confirm customer login and payment receipt flows without using real customer or financial data.
- [ ] Confirm no production domain or production Worker route is attached.

Do not merge this branch or change production until the director reviews and approves the test results.
