MAGIZH B5 MOBILE UI FIXES

Changes in this package:
1. Removed the Ecosystem Portals (Partner / Sales Leader / Admin) links from the customer footer. Staff portals remain available through their dedicated routes and role-based access.
2. Tightened the customer header on narrow screens: brand can shrink, tagline is hidden on mobile, coin label is compact, and account control does not force a wide row.
3. Admin navigation tabs now wrap onto multiple rows on narrow screens instead of forcing a very wide horizontal tab strip.
4. Added responsive overflow safeguards.

IMPORTANT DEPLOYMENT:
This package intentionally omits the old prebuilt dist bundle so the previous UI cannot be served accidentally.
On Render, use:
  Build Command: npm install && npm run build
  Start Command: npm start
The build command must complete successfully before the service starts.

UPI merchant ID is configured in .env.example as VITE_MERCHANT_UPI_ID. Set the same value in Render Environment:
  VITE_MERCHANT_UPI_ID=magizhcafee-3@okhdfcbank
Do not treat opening a UPI app as payment confirmation. Verify the credit in the merchant bank/UPI app before marking an order paid.
