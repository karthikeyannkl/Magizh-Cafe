MAGIZH CAFE — PARTNER OFFERS CORRECTION ONLY

This patch is limited to the Partner Offers flow. It does not intentionally change Products, Orders, Categories, or the approved mobile layout.

Files in this package: index.html, admin.html, partner-offers.html, partner.html, server.js, server-sync.js, build.mjs, package.json.

Corrections: Partner Offers is included in the server-sync key lists; the customer offers page uses server sync so offers created in Admin can appear across browsers/devices; /partner now resolves to a separate partner entry page.

Important limitation: The partner entry page is only a landing page. Secure partner-specific authentication, partner wallet credit/debit, coin redemption processing, and transaction ledger are NOT implemented/verified in this patch. Do not treat wallet transfers as production-ready.

Deploy these files to the existing project root, then test Admin > Partner Offers and /partner-offers on a separate browser/device.
