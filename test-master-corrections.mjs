import http from 'http';
import assert from 'assert';

const BASE_URL = 'http://127.0.0.1:3891';

// Helper to make JSON HTTP requests
function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const postData = body ? JSON.stringify(body) : null;

    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, text: data });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runMasterTestSuite() {
  console.log('====================================================');
  console.log('MAGIZH SHOPPING + B5 COIN MASTER VERIFICATION SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      process.stdout.write(`Testing: ${name}... `);
      await fn();
      console.log('PASSED ✓');
      passed++;
    } catch (err) {
      console.log('FAILED ✗');
      console.error('   -> Error:', err.message);
      failed++;
    }
  }

  // 1. PIN Code Lookup Engine
  await test('PIN code lookup returns district, state, and post offices', async () => {
    const res = await request('GET', '/api/pincode/600020');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.data.district, 'Chennai');
    assert.strictEqual(res.data.data.state, 'Tamil Nadu');
    assert(Array.isArray(res.data.data.postOffices));
  });

  await test('PIN code lookup for Coimbatore (641002)', async () => {
    const res = await request('GET', '/api/pincode/641002');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.data.district, 'Coimbatore');
  });

  // 2. Customer Registration & Login (Password-only, No OTP)
  const uniqueMobile = '98' + Math.floor(10000000 + Math.random() * 90000000);
  const uniqueEmail = `cust_${Date.now()}@test.magizh.in`;

  let customerUser = null;
  await test('Password-only Customer Registration creates Customer role', async () => {
    const res = await request('POST', '/api/auth/register', {
      name: 'Ramanathan V',
      mobile: uniqueMobile,
      email: uniqueEmail,
      password: 'password123',
      confirmPassword: 'password123',
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.user.role, 'customer');
    assert.strictEqual(res.data.user.mobile, uniqueMobile);
    customerUser = res.data.user;
  });

  await test('Duplicate registration rejection for same mobile number', async () => {
    const res = await request('POST', '/api/auth/register', {
      name: 'Another User',
      mobile: uniqueMobile,
      email: `diff_${Date.now()}@test.magizh.in`,
      password: 'password123',
      confirmPassword: 'password123',
    });
    assert(res.status === 409 || res.status === 400);
    assert(res.data.error.includes('already exists') || res.data.error.includes('already registered'));
  });

  await test('Customer Password Login verifies password hash and returns user', async () => {
    const res = await request('POST', '/api/auth/login', {
      mobile: uniqueMobile,
      password: 'password123',
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.user.mobile, uniqueMobile);
  });

  // 3. Admin Authentication & Clearance
  let adminToken = null;
  await test('Admin login with signed Bearer token generation', async () => {
    const res = await request('POST', '/api/auth/admin-login', {
      email: 'admin@magizh.in',
      password: 'admin123',
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert(Boolean(res.data.token));
    adminToken = res.data.token;
  });

  // 4. Partner Registration & Approval Flow
  const partnerMobile = '97' + Math.floor(10000000 + Math.random() * 90000000);
  const partnerEmail = `partner_${Date.now()}@test.magizh.in`;
  let registeredPartnerId = null;

  await test('Partner Shop Registration sets status to PENDING', async () => {
    const res = await request('POST', '/api/partners/register', {
      ownerName: 'Sundaramurthy S',
      shopName: 'Salem Traditional Organic Store',
      mobile: partnerMobile,
      email: partnerEmail,
      shopAddress: '15 Car Street, Salem Market',
      district: 'Salem',
      city: 'Salem',
      pinCode: '636001',
      merchantUpiId: `${partnerMobile}@upi`,
      gstNumber: '33AAAAA1111A1Z5',
      password: 'partnerPass123!',
      documents: { note: 'Trade License # TRD-88219' },
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
    assert(Boolean(res.data.partnerId));
    registeredPartnerId = res.data.partnerId;
  });

  await test('Pending partner cannot log in before approval', async () => {
    const res = await request('POST', '/api/partners/login', {
      identifier: partnerMobile,
      password: 'partnerPass123!',
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.data.success, false);
    assert(res.data.error.includes('pending Admin Approval'));
  });

  await test('Partner Application Status checker returns PENDING status', async () => {
    const res = await request('GET', `/api/partners/application-status?mobile=${partnerMobile}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.application.applicationStatus, 'PENDING');
  });

  await test('Admin views application and approves partner', async () => {
    const res = await request(
      'POST',
      `/api/admin/partner-applications/${registeredPartnerId}/decision`,
      { decision: 'approve' },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.partner.applicationStatus.toUpperCase(), 'APPROVED');
  });

  let partnerToken = null;
  await test('Approved partner logs in successfully and receives partner token', async () => {
    const res = await request('POST', '/api/partners/login', {
      identifier: partnerMobile,
      password: 'partnerPass123!',
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert(Boolean(res.data.token));
    partnerToken = res.data.token;
  });

  // 5. In-Store Billing System (POS) & Coin Redemptions
  await test('Partner looks up customer by mobile number', async () => {
    const res = await request(
      'GET',
      `/api/partners/customer-lookup?mobile=${uniqueMobile}`,
      null,
      { Authorization: `Bearer ${partnerToken}` }
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.customer.mobile, uniqueMobile);
    assert.strictEqual(res.data.customer.name, 'Ramanathan V');
    assert(typeof res.data.customer.coinBalance === 'number');
  });

  // Credit customer coins for billing test
  await test('Admin credits B5 Coins to customer with persistent notification', async () => {
    const res = await request(
      'POST',
      '/api/admin/credit-coins',
      {
        customerId: customerUser.id,
        coins: 500,
        reason: 'Welcome Promotional Coins',
      },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.coins, 500);
  });

  await test('Customer receives persistent unread coin notification', async () => {
    const res = await request(
      'GET',
      `/api/customer/unread-notifications?customerId=${customerUser.id}`
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert(res.data.notifications.length >= 1);
    const notif = res.data.notifications[0];
    assert.strictEqual(notif.coins, 500);

    // Mark as viewed
    await request('POST', `/api/customer/notifications/${notif.id}/mark-viewed`);
    const after = await request(
      'GET',
      `/api/customer/unread-notifications?customerId=${customerUser.id}`
    );
    assert.strictEqual(after.data.notifications.length, 0);
  });

  // In-Store Bill Creation with 50% Cap
  let createdBill = null;
  await test('Partner creates bill honoring 50% coin redemption cap', async () => {
    // Bill of ₹1000 with 250 coins (25%)
    const res = await request(
      'POST',
      '/api/partners/bills/create',
      {
        partnerId: registeredPartnerId,
        customerMobile: uniqueMobile,
        customerName: 'Ramanathan V',
        billSummary: '2kg Barnyard Millet, 1L Cold Pressed Sesame Oil',
        billAmount: 1000,
        coinsToRedeem: 250,
      },
      { Authorization: `Bearer ${partnerToken}` }
    );
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.bill.status, 'PENDING_CUSTOMER_APPROVAL');
    assert.strictEqual(res.data.bill.payableAmount, 750);
    createdBill = res.data.bill;
  });

  await test('Partner bill rejects coin redemption exceeding 50% ceiling', async () => {
    const res = await request(
      'POST',
      '/api/partners/bills/create',
      {
        partnerId: registeredPartnerId,
        customerMobile: uniqueMobile,
        customerName: 'Ramanathan V',
        billSummary: 'Test Exceeding Cap',
        billAmount: 1000,
        coinsToRedeem: 600, // 60% > 50% cap
      },
      { Authorization: `Bearer ${partnerToken}` }
    );
    assert.strictEqual(res.status, 400);
    assert(res.data.error.includes('ceiling') || res.data.error.includes('50%'));
  });

  await test('Customer selects payment method (UPI with deep link)', async () => {
    const res = await request(
      'POST',
      `/api/customer/bills/${createdBill.id}/select-payment`,
      { paymentMethod: 'upi' }
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert(
      res.data.bill.status === 'CUSTOMER_SELECTED_UPI' ||
      res.data.bill.status === 'PAYMENT_CONFIRMED_BY_CUSTOMER'
    );
    assert(res.data.upiDeepLink.startsWith('upi://pay?'));
    assert(res.data.upiDeepLink.includes('am=750'));
  });

  await test('Partner confirms payment received -> becomes PENDING_ADMIN_APPROVAL', async () => {
    const res = await request(
      'POST',
      `/api/partners/bills/${createdBill.id}/confirm-payment-received`,
      { partnerId: registeredPartnerId },
      { Authorization: `Bearer ${partnerToken}` }
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.bill.status, 'PENDING_ADMIN_APPROVAL');
  });

  await test('Admin approves in-store bill and atomically deducts coins without awarding new reward coins', async () => {
    const res = await request(
      'POST',
      `/api/admin/bills/${createdBill.id}/decision`,
      { decision: 'approve', notes: 'Verified store cashier entry' },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.bill.status, 'COMPLETED');
    assert(Boolean(res.data.bill.receiptNumber));

    // Verify customer balance decreased by exactly 250 coins
    const custLookup = await request(
      'GET',
      `/api/partners/customer-lookup?mobile=${uniqueMobile}`,
      null,
      { Authorization: `Bearer ${partnerToken}` }
    );
    // Initial 100 welcome + 500 credited - 250 redeemed = 350
    assert.strictEqual(custLookup.data.customer.coinBalance, 350);
  });

  console.log('\n====================================================');
  console.log(`TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

// Start backend server in same process if not running, or run against running server
import express from 'express';
import { apiRouter } from './server/api.js';
import { initDatabase } from './server/db.js';

async function bootstrap() {
  await initDatabase();

  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = app.listen(3891, '127.0.0.1', () => {
    console.log('Test harness running against 127.0.0.1:3891...\n');
    runMasterTestSuite()
      .catch((e) => {
        console.error('Fatal Test Suite Error:', e);
        server.close();
        process.exit(1);
      })
      .then(() => {
        server.close();
        process.exit(0);
      });
  });

  server.on('error', (err) => {
    console.error('Test server error:', err);
    process.exit(1);
  });
}

bootstrap();
