# AL MAJID AI CONTROL CENTER — Deployment

The seller portal is served as a static page at `/seller-portal.html`.

The Cloudflare Pages project is connected to this repository and deploys the `main` branch from the repository root (`.`) without a build command. Changes merged into `main` should trigger a production deployment.

Seller sign-in uses email OTP and Google OAuth. Product submissions are stored in the AL MAJID Nigeria Marketplace Supabase project for admin review.
