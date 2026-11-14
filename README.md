# VidEarn

VidEarn is a video-sharing platform for short and long videos, with a future creator monetization model.

## Implemented frontend/backend integration
- Responsive mobile and desktop homepage
- Supabase email/password signup, login, logout and password recovery
- Creator profiles and referral-code capture on signup
- Personal referral link display and copy control
- Video upload to a private Supabase Storage bucket (500 MB maximum)
- Video submissions enter a pending moderation state
- Public feed is intended to show approved videos only
- Short-lived signed URLs are used for playback

## Supabase setup
1. Confirm `supabase-config.js` has the correct project URL and publishable key. Never put a service-role key in browser code.
2. In Supabase SQL Editor, run `supabase/schema.sql` if it has not already been applied.
3. Then run `supabase/backend-activation.sql`.
4. In Supabase Authentication URL settings, set the deployed GitHub Pages URL as the Site URL and add it to the allowed redirect URLs.
5. Create a test account and try uploading a small video.

## Important limitations
- This repository does not yet contain a secure admin/moderation dashboard. Video approval/rejection must be done through trusted server-side/admin operations.
- Referral codes are captured and referral records are created, but referral rewards are not active.
- Advertising integration, creator earnings calculation, payout processing, likes, comments, subscriptions, transcoding and abuse prevention are not implemented.
- The revenue split stored in the database is a draft policy placeholder, not a promise of earnings. Publish clear terms before enabling monetization.

## Run
Open `index.html` in a modern browser or deploy the repository with GitHub Pages.

**VidEarn — Watch. Create. Earn.**
