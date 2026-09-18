# Magizh Cafe - Temporary GitHub + Render Test Server V2

## Upload structure

Upload the CONTENTS of this folder to the ROOT of the GitHub repository.

Do not upload the outer folder itself as the repository root.

Required root files:
- package.json
- server.js
- public/index.html
- public/admin.html
- public/server-sync.js
- data/

## Render

Runtime: Node

Build Command:
npm install

Start Command:
npm start

Environment Variable:
DATA_TTL_DAYS=30

For a 15-day test:
DATA_TTL_DAYS=15

## URLs

Customer:
/

Admin:
 /admin

Health check:
 /api/health

Server state:
 /api/state

Reset temporary test data:
 POST /api/reset

## Test storage

This version uses a temporary JSON file under data/test-data.json.
The retention timer is refreshed whenever data is written.

This is for testing only. Render's filesystem may be ephemeral without persistent storage.
For the final production system, move users, coins, products, orders, screenshots and settings to the real database/server.

## Admin demo login

Username: admin
Password: 123456

## Important

This V2 does not change the approved customer/admin visual design.
It mainly fixes the server packaging/routing and improves error logging.
