# Magizh Cafe - FINAL Test Upload

Upload all files directly into the GitHub repository ROOT.

Files:
- README.md
- admin.html
- index.html
- package.json
- server-sync.js
- server.js

No folders are required.

Render:
Root Directory: blank
Build Command: npm install
Start Command: node server.js
Environment Variable:
DATA_TTL_DAYS=30

15-day test:
DATA_TTL_DAYS=15

URLs:
Customer: /
Admin: /admin
Health: /api/health

Final test corrections included:
1. New User registration starts with 0 Coins.
2. New User does not show the coin/welcome card when balance is 0.
3. B5 users keep their existing coin balance.
4. Admin User Coins can search by User ID OR Mobile Number and shows customer name/details.
5. Admin Product Delete persists and removes the product from customer view after sync.
6. Admin Product Add persists and appears on customer view after sync.
7. Payment screenshot confirmation uses both the stored screenshot state and the actual selected file as a fallback, preventing the false "Please upload screenshot" message.
8. Admin/customer pages refresh when server data is pulled.
9. CommonJS Node server; no "type": "module" conflict.

This is still a temporary test server. Final production should use the real database/server and secure authentication.


## Latest two fixes
1. Payment screenshot is preserved and Confirm Payment no longer loses the screenshot or shows a false upload-required message.
2. Admin Product Add/Edit stays open while typing/selecting photos; the 5-second server sync no longer clears the form.
