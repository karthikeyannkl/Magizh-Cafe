# Magizh Cafe – FINAL V5 with Dynamic Level Tracking

This package keeps the approved Magizh Cafe V4 customer design and adds only the requested Level Tracking feature.

## Level Tracking
- No demo/test members, names, earnings, referrals, or completed payments are preloaded.
- Logged-in customers see a new **Level Tracking** option.
- A customer can join Level Tracking with their existing Magizh Cafe account.
- Optional referral Member ID can be entered during joining.
- Each joined member gets Level 1 and a referral code equal to their Member ID.
- Direct referrals are recorded dynamically.
- Milestones: L1→L2 = 3 direct referrals, L2→L3 = 6, L3→L4 = 9, L4→L5 = 12, L5→L6 = 15, L6→L7 = 18.
- Progress, direct referrals, referrer, and upgrade request status are stored dynamically.
- Level Tracking data is synchronized through the existing server state API.
- Upgrade request starts as **Pending Admin Review**; no fake payment/receiver data is included.

## Existing server
- Node CommonJS
- Start: `node server.js`
- Build: `npm install`
- Customer: `/`
- Admin: `/admin`
- Health: `/api/health`
- Test data store TTL: `DATA_TTL_DAYS` (default 30 days)

## Render upload
Replace the existing repository root files with all files in this package and redeploy.
