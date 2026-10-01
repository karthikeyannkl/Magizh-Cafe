# Magizh Cafe — Partner B5 Coins Phase 1

This package starts the Partner B5 Coin system on top of the approved Magizh Cafe V10 base.

## Added
- Customer: Partner Offers browser by town.
- Customer: Offer calculation and redemption request.
- Coins are NOT deducted at request time; merchant confirmation is required.
- Admin: Partners & Offers tab.
- Admin: Add partner and create/disable offers.
- Partner mobile page: `/partner` with Partner ID/password login, pending redemption confirmation, and monthly received-coin statistics.
- Shared localStorage/server sync keys: `magizhPartners`, `magizhPartnerOffers`, `magizhRedemptions`.

## Demo partner login
- P001 / partner123
- P002 / partner123
- P003 / partner123

## Important
This is Phase 1 test/demo logic using the existing temporary JSON sync architecture. It is not yet a production payment/settlement system. Existing customer/admin design and existing B5 login are retained.
