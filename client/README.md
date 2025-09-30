# OpenBid (Prototype)

Minimal slice: create job → list/map → open job → place bid.

## Quick start
1. `npm i`
2. Copy `.env.example` to `.env` and fill Firebase values (Project Settings → Web app).
   - Optional: add `VITE_GOOGLE_MAPS_API_KEY` to see the map.
3. Set rules: `firestore.rules` via Firebase Console → Firestore → Rules.
4. `npm run dev` → open http://localhost:5173

## What’s included
- React + Vite + SCSS UI
- Firebase Auth (Google popup)
- Firestore: `jobs` collection and `bids` subcollection
- Optional Google Map (markers from job lat/lng)

## Next iteration ideas
- Form validation + toasts
- Jobs near-me (Places + Geocoding)
- Role flags, reviews, escrow (Stripe), KYC (Stripe Identity)
- Firestore composite indexes + stricter security rules
