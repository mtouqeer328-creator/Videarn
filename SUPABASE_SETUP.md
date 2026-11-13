# VidEarn backend setup (Supabase)

The first backend database schema is in `supabase/schema.sql`.

## What this foundation creates
- User profiles linked to Supabase Auth, each with a unique referral code.
- Video metadata with draft/pending/published states and owner-only editing.
- Referral attribution when a new account signs up with a valid referral code.
- A reward ledger that users can read but cannot write or alter from the browser.
- A draft revenue allocation setting: 70% platform, 25% creator, 5% referral.

## Important revenue policy
The 70/25/5 split is an initial proposed setting, not a promise or a live payout calculation. VidEarn should clearly disclose the split and eligibility rules before monetization starts. Creator/referral rewards must be calculated only from verified, eligible net advertising revenue; never from raw views, and never guaranteed. The platform share covers operating costs and platform income. Do not change the displayed policy without updating the public terms.

## Setup still requiring the owner
1. Create a Supabase project on the free tier (availability/limits can change).
2. Open SQL Editor and run all of `supabase/schema.sql`.
3. Copy the project URL and anon/publishable key for the website integration.
4. Keep the service_role/secret key private; it must never be added to HTML, JavaScript, or a public GitHub repository.

This schema does not yet enable video file uploads, authentication screens, moderation, ad serving, or payouts. Those require additional implementation and provider configuration.
