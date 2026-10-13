MAGIZH CAFE — PARTNER OFFERS RESTORE

This package restores only the missing B5 Coins Partner Offers entry/page and adds the minimal Admin > Partner Offers form needed to add one test partner.

Files to upload/replace in the same project root:
- index.html (adds the clickable B5 Coins Partner Offers card on the home page)
- admin.html (adds Admin > Partner Offers: add/delete partner offer)
- partner-offers.html (customer-facing partner offers page)
- server.js (serves /partner-offers and includes partner offers in default state)
- server-sync.js (syncs partner offers)
- build.mjs (existing build config already includes partner-offers.html)
- package.json (included for completeness; unchanged)

Test:
1. Deploy the files.
2. Open Admin and sign in.
3. Open Partner Offers tab and add one partner.
4. Open customer home page and tap B5 Coins Partner Offers.
5. The added partner should appear on the Partner Offers page.

No product coin-percentage changes were made in this package. The current product coin-use cap remains 50% globally. Per-product percentages can be added separately in Product Add/Edit when requested.
