# Magizh B5 Mobile / Deployment Verification Notes

## Verified from the uploaded source
- `src/App.tsx` does not contain the Customer Footer `ECOSYSTEM PORTALS` section or direct Partner / Sales Leader / Admin portal links.
- Admin tab navigation in `src/components/admin/AdminPanel.tsx` uses wrapping flex layout at narrow widths.
- Global CSS includes viewport-width and horizontal-overflow safeguards.
- Checkout reads `VITE_MERCHANT_UPI_ID` and creates a UPI deep link with amount and order number. UTR submission leaves the order pending for Admin verification.

## Critical correction in this package
The uploaded ZIP contained old prebuilt files (`dist__index.html` and `dist__assets__...js/css`). The old JavaScript bundle still contained the `ECOSYSTEM PORTALS` footer. The old `restore-structure.js` copied those stale compiled files back into `dist/`. This could make the old screen appear even though the source files were corrected.

This corrected package removes those stale compiled files and changes `restore-structure.js` so it restores only source/server files. Render must build a fresh `dist/` from the corrected source.

## Render settings
- Build Command: `npm install && npm run build`
- Start Command: `npm start`
- Environment Variable:
  - Key: `VITE_MERCHANT_UPI_ID`
  - Value: `magizhcafee-3@okhdfcbank`

After changing the environment variable, trigger a fresh deployment so Vite embeds it in the frontend build.

## Important limitations still requiring cloud integration
The React `StorageService` currently uses browser LocalStorage for order and coin state. This means separate customer and admin devices do not yet share authoritative order/payment/coin state through the backend database. Do not use this as a production payment-confirmation system until the frontend is connected to authenticated server APIs and the database.

UPI app launch and UTR submission are not proof of payment. Admin must verify the actual bank/UPI credit before confirming an order.
