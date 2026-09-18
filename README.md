# Magizh Cafe – Stable Sync Final Package

This package keeps the approved Magizh Cafe design and fixes the repeated data/sync problems.

## Included
- index.html – customer page
- admin.html – admin page
- server.js – Node/Render server
- server-sync.js – reliable client/server synchronization
- package.json – Render start configuration

## Fixes in this version
1. Customer product cards render correctly. A malformed JavaScript function in the previous file was preventing the customer script from running.
2. Admin typing is protected across Products, Categories, Users & Coins, Settings, Social & Contact, and search fields. Server polling no longer rebuilds the active form while typing.
3. Product Add renders immediately after the local save and syncs in the background. The Add button is protected from accidental double-clicks while photos are being read.
4. Server writes are serialized so simultaneous updates cannot overwrite each other.
5. Server state requests can fetch only the keys needed by the current page instead of downloading the entire state on every poll.
6. Polling is reduced to 15 seconds to avoid repeatedly transferring large product-photo data.
7. Unsynced local changes are protected from being overwritten by a server pull.
8. Payment screenshot flow from the previous approved version is retained.
9. Stable product category+name keys are retained for Edit/Delete.

## Render
Use Node. The start command is:
`node server.js`

The server uses a temporary JSON file store (`magizh-test-data.json`). It is suitable for the current test/demo workflow, not a production database. Render filesystem persistence depends on the service/storage setup, so a real persistent database/object storage should be used before production.

## Admin login
Username: `admin`
Password: `123456`

## Important
Upload/replace the complete files from this ZIP together. Do not mix the old `index.html`, `admin.html`, `server.js`, or `server-sync.js` with these files.
