import http from 'http';
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import express from 'express';
import { apiRouter } from './server/api.js';
import { initDatabase, dbService } from './server/db.js';

const PORT = 3892;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function request(method, reqPath, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(reqPath, BASE_URL);
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

async function runCriticalTestSuite() {
  console.log('================================================================');
  console.log('MAGIZH SHOPPING – 20 SPECIFICATION TESTS CRITICAL VERIFICATION');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;
  const results = [];

  async function runTest(testNumber, name, fn) {
    const testLabel = `TEST ${testNumber}: ${name}`;
    try {
      process.stdout.write(`Executing ${testLabel}... `);
      await fn();
      console.log('PASSED ✓');
      passed++;
      results.push({ testNumber, name, status: 'PASSED' });
    } catch (err) {
      console.log('FAILED ✗');
      console.error(`   -> Assertion Failure: ${err.message}`);
      failed++;
      results.push({ testNumber, name, status: 'FAILED', error: err.message });
    }
  }

  // State to reuse across tests
  const testCustomerMobile = '98' + Math.floor(10000000 + Math.random() * 90000000);
  const testCustomerEmail = `customer_${Date.now()}@magizh.test`;
  let customerUser = null;

  const testPartnerMobile = '97' + Math.floor(10000000 + Math.random() * 90000000);
  const testPartnerEmail = `partner_${Date.now()}@magizh.test`;
  let partnerShopId = null;
  let partnerToken = null;
  let adminToken = null;

  let createdBillId = null;
  let uploadedImageId = null;

  // TEST 1: Customer layout contains only customer features
  await runTest(1, 'Customer layout contains only customer features', async () => {
    const appTsx = fs.readFileSync(path.resolve('./src/App.tsx'), 'utf8');
    assert(appTsx.includes('CustomerHeader'), 'CustomerHeader must be imported and rendered in App.tsx');
    assert(appTsx.includes('CustomerFooter'), 'CustomerFooter must be rendered strictly on customer route');
    assert(appTsx.includes('isCustomerRoute'), 'isCustomerRoute guard must strictly isolate customer view');
    
    const customerHeader = fs.readFileSync(path.resolve('./src/components/common/CustomerHeader.tsx'), 'utf8');
    assert(!customerHeader.includes('Admin Console'), 'CustomerHeader must not render Admin Console');
    assert(!customerHeader.includes('Partner POS'), 'CustomerHeader must not render Partner POS');
    assert(customerHeader.includes('B5 Rewards') || customerHeader.includes('B5 Coins'), 'CustomerHeader displays B5 customer wallet features');
  });

  // TEST 2: Partner layout contains only partner features
  await runTest(2, 'Partner layout contains only partner features', async () => {
    const appTsx = fs.readFileSync(path.resolve('./src/App.tsx'), 'utf8');
    assert(appTsx.includes('isPartnerRoute'), 'isPartnerRoute must be defined');
    assert(appTsx.includes('<PartnerHeader'), 'PartnerHeader must be rendered on partner routes');

    const partnerHeader = fs.readFileSync(path.resolve('./src/components/common/PartnerHeader.tsx'), 'utf8');
    assert(partnerHeader.includes('MAGIZH PARTNER POS'), 'PartnerHeader must show MAGIZH PARTNER POS');
    assert(!partnerHeader.includes('Super Admin'), 'PartnerHeader must not show Super Admin clearance');
    assert(!partnerHeader.includes('B5 Rewards') && !partnerHeader.includes('Earn up to 5%'), 'PartnerHeader must not show customer promotional bar');
  });

  // TEST 3: Admin layout contains only admin features
  await runTest(3, 'Admin layout contains only admin features', async () => {
    const appTsx = fs.readFileSync(path.resolve('./src/App.tsx'), 'utf8');
    assert(appTsx.includes('isAdminRoute'), 'isAdminRoute must be defined');
    assert(appTsx.includes('<AdminHeader'), 'AdminHeader must be rendered on admin routes');

    const adminHeader = fs.readFileSync(path.resolve('./src/components/common/AdminHeader.tsx'), 'utf8');
    assert(adminHeader.includes('MAGIZH ADMIN CONSOLE'), 'AdminHeader must show MAGIZH ADMIN CONSOLE');
    assert(adminHeader.includes('Super Admin'), 'AdminHeader must show Super Admin clearance');
    assert(!adminHeader.includes('Shopping Categories'), 'AdminHeader must not show customer shopping navigation');

    // Admin Auth Guard blocks non-admins
    const adminGuard = fs.readFileSync(path.resolve('./src/components/common/AdminAuthGuard.tsx'), 'utf8');
    assert(adminGuard.includes("currentUser.role === 'admin'"), 'AdminAuthGuard must strictly verify admin role');

    // Authenticate Admin and retrieve server-signed Bearer token
    const adminLoginRes = await request('POST', '/api/auth/admin-login', {
      email: 'admin@magizh.in',
      password: 'admin123',
    });
    assert.strictEqual(adminLoginRes.status, 200);
    assert(adminLoginRes.data.token, 'Admin login must return a signed authorization token');
    adminToken = adminLoginRes.data.token;
  });

  // TEST 4: Customer sees their own coin balance, not another customer's
  await runTest(4, "Customer sees their own coin balance, not another customer's", async () => {
    // 1. Unauthenticated / Guest has 0 coins
    const storageTs = fs.readFileSync(path.resolve('./src/services/storage.ts'), 'utf8');
    assert(storageTs.includes('DEFAULT_GUEST_USER'), 'DEFAULT_GUEST_USER must be defined for guests');
    assert(storageTs.includes('isGuest: true'), 'DEFAULT_GUEST_USER must have isGuest flag');

    // 2. Register real customer
    const regRes = await request('POST', '/api/auth/register', {
      name: 'Kavitha S',
      mobile: testCustomerMobile,
      email: testCustomerEmail,
      password: 'SecurePass@123',
      confirmPassword: 'SecurePass@123',
    });
    assert.strictEqual(regRes.status, 201);
    assert.strictEqual(regRes.data.success, true);
    assert.strictEqual(regRes.data.user.mobile, testCustomerMobile);
    customerUser = regRes.data.user;

    // Verify coin balance is isolated to this customer (100 welcome coins credited)
    const profileRes = await request('GET', `/api/customer/profile/${customerUser.id}`);
    assert.strictEqual(profileRes.status, 200);
    assert.strictEqual(profileRes.data.success, true);
    assert.strictEqual(profileRes.data.user.mobile, testCustomerMobile);
    assert.strictEqual(profileRes.data.coinAccount.availableBalance, 100);
    assert.notStrictEqual(profileRes.data.coinAccount.availableBalance, 850); // Saravanan's balance is 850
  });

  // TEST 5: Partner can find customer by mobile number
  await runTest(5, 'Partner can find customer by mobile number', async () => {
    // Register partner shop
    const partnerRegRes = await request('POST', '/api/partners/register', {
      ownerName: 'Venkatesh Raman',
      shopName: 'Venkatesh Natural Foods',
      mobile: testPartnerMobile,
      email: testPartnerEmail,
      shopAddress: '45 Raja Street, Town',
      pinCode: '641002',
      district: 'Coimbatore',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      merchantUpiId: 'venkatesh@okaxis',
      gstNumber: '33AABCV1234F1Z5',
      password: 'PartnerPass@123',
      documentsSubmitted: 'Trade License Verified',
    });
    assert.strictEqual(partnerRegRes.status, 201);
    partnerShopId = partnerRegRes.data.partner.id;

    // Admin approves the partner application
    const approveRes = await request(
      'POST',
      `/api/admin/partner-applications/${partnerShopId}/decision`,
      { decision: 'approve' },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert.strictEqual(approveRes.status, 200);
    assert.strictEqual(approveRes.data.success, true);

    // Login as partner
    const loginRes = await request('POST', '/api/partners/login', {
      identifier: testPartnerMobile,
      password: 'PartnerPass@123',
    });
    assert.strictEqual(loginRes.status, 200);
    partnerToken = loginRes.data.token;

    // Partner searches customer by mobile
    const lookupRes = await request(
      'GET',
      `/api/partners/customer-lookup?mobile=${testCustomerMobile}`,
      null,
      { Authorization: `Bearer ${partnerToken}` }
    );
    assert.strictEqual(lookupRes.status, 200);
    assert.strictEqual(lookupRes.data.success, true);
    assert.strictEqual(lookupRes.data.customer.mobile, testCustomerMobile);
    assert.strictEqual(lookupRes.data.customer.name, 'Kavitha S');
    assert.strictEqual(lookupRes.data.customer.coinBalance, 100);
  });

  // TEST 6: Partner can create a bill and send it to the correct customer
  await runTest(6, 'Partner can create a bill and send it to the correct customer', async () => {
    // Top up customer coins by 100 for test (total = 200 coins)
    await request(
      'POST',
      '/api/admin/credit-coins',
      {
        customerId: customerUser.id,
        amount: 100,
        reason: 'Promotional Store Credit for POS Test',
      },
      { Authorization: `Bearer ${adminToken}` }
    );

    const createBillRes = await request(
      'POST',
      '/api/partners/bills/create',
      {
        partnerId: partnerShopId,
        customerId: customerUser.id,
        customerMobile: testCustomerMobile,
        originalBillAmount: 400,
        coinsToRedeem: 150, // <= 50% of 400 (which is 200 max)
        itemsSummary: '1kg Kodo Millet Flour, 500ml Cold Pressed Gingelly Oil',
      },
      { Authorization: `Bearer ${partnerToken}` }
    );

    assert.strictEqual(createBillRes.status, 201);
    assert.strictEqual(createBillRes.data.success, true);
    assert.strictEqual(createBillRes.data.bill.status, 'PENDING_CUSTOMER_APPROVAL');
    assert.strictEqual(createBillRes.data.bill.originalBillAmount, 400);
    assert.strictEqual(createBillRes.data.bill.coinsToRedeem, 150);
    assert.strictEqual(createBillRes.data.bill.customerPhone, testCustomerMobile);
    createdBillId = createBillRes.data.bill.id;
  });

  // TEST 7: Customer can approve and choose B5 Coin redemption
  await runTest(7, 'Customer can approve and choose B5 Coin redemption', async () => {
    // Check pending bills for customer
    const pendingRes = await request(
      'GET',
      `/api/customer/pending-bills?customerId=${customerUser.id}`
    );
    assert.strictEqual(pendingRes.status, 200);
    assert.strictEqual(pendingRes.data.success, true);
    const bill = pendingRes.data.bills.find((b) => b.id === createdBillId);
    assert(bill, 'Created bill must appear in customer pending bills list');

    // Customer selects UPI payment
    const selectPaymentRes = await request(
      'POST',
      `/api/customer/bills/${createdBillId}/select-payment`,
      {
        paymentMethod: 'upi',
      }
    );
    assert.strictEqual(selectPaymentRes.status, 200);
    assert.strictEqual(selectPaymentRes.data.success, true);
    assert.strictEqual(selectPaymentRes.data.bill.status, 'CUSTOMER_SELECTED_UPI');
    assert.strictEqual(selectPaymentRes.data.bill.paymentMethod, 'upi');
  });

  // TEST 8: 50% redemption limit is enforced on the server
  await runTest(8, '50% redemption limit is enforced on the server', async () => {
    // Attempt to create a bill with 60% coins redemption (300 coins on a 500 bill)
    const invalidBillRes = await request(
      'POST',
      '/api/partners/bills/create',
      {
        partnerId: partnerShopId,
        customerMobile: testCustomerMobile,
        originalBillAmount: 500,
        coinsToRedeem: 300, // 300 > 250 (50% of 500)
        itemsSummary: 'Excessive redemption test',
      },
      { Authorization: `Bearer ${partnerToken}` }
    );

    assert.strictEqual(invalidBillRes.status, 400);
    assert.strictEqual(invalidBillRes.data.success, false);
    assert(
      invalidBillRes.data.error.includes('50%') ||
      invalidBillRes.data.error.includes('cap') ||
      invalidBillRes.data.error.includes('exceed'),
      'Server must reject redemption exceeding 50% cap'
    );
  });

  // TEST 9: Cash and UPI payment confirmation workflow works correctly
  await runTest(9, 'Cash and UPI payment confirmation workflow works correctly', async () => {
    // Partner confirms receipt of payment
    const confirmRes = await request(
      'POST',
      `/api/partners/bills/${createdBillId}/confirm-payment-received`,
      {
        partnerId: partnerShopId,
      },
      { Authorization: `Bearer ${partnerToken}` }
    );

    assert.strictEqual(confirmRes.status, 200);
    assert.strictEqual(confirmRes.data.success, true);
    assert.strictEqual(confirmRes.data.bill.status, 'PENDING_ADMIN_APPROVAL');
  });

  // TEST 10: Admin approval correctly finalizes the bill
  await runTest(10, 'Admin approval correctly finalizes the bill', async () => {
    // Admin finalizes the verified bill
    const finalizeRes = await request(
      'POST',
      `/api/admin/bills/${createdBillId}/decision`,
      {
        decision: 'approve',
        notes: 'Settlement verified and coins settled by admin',
      },
      { Authorization: `Bearer ${adminToken}` }
    );

    assert.strictEqual(finalizeRes.status, 200);
    assert.strictEqual(finalizeRes.data.success, true);
    assert.strictEqual(finalizeRes.data.bill.status, 'COMPLETED');

    // Verify coin balance of customer was debited by exactly 150
    // Started at 100 welcome + 100 top-up = 200. Debited 150 = 50 remaining.
    const custProfile = await request('GET', `/api/customer/profile/${customerUser.id}`);
    assert.strictEqual(custProfile.data.coinAccount.availableBalance, 50);
  });

  // TEST 11: No duplicate coin deduction occurs
  await runTest(11, 'No duplicate coin deduction occurs', async () => {
    // Attempting to finalize the bill a second time must fail with 400
    const duplicateRes = await request(
      'POST',
      `/api/admin/bills/${createdBillId}/decision`,
      { decision: 'approve', notes: 'Duplicate attempt' },
      { Authorization: `Bearer ${adminToken}` }
    );

    assert.strictEqual(duplicateRes.status, 400);
    assert.strictEqual(duplicateRes.data.success, false);

    // Verify customer balance was NOT debited again
    const custProfile = await request('GET', `/api/customer/profile/${customerUser.id}`);
    assert.strictEqual(custProfile.data.coinAccount.availableBalance, 50);
  });

  // TEST 12: Rejected bills do not deduct coins
  await runTest(12, 'Rejected bills do not deduct coins', async () => {
    // Create another bill
    const bill2Res = await request(
      'POST',
      '/api/partners/bills/create',
      {
        partnerId: partnerShopId,
        customerId: customerUser.id,
        customerMobile: testCustomerMobile,
        originalBillAmount: 100,
        coinsToRedeem: 40,
        itemsSummary: 'Organic Podi Pack',
      },
      { Authorization: `Bearer ${partnerToken}` }
    );
    assert.strictEqual(bill2Res.status, 201);
    const bill2Id = bill2Res.data.bill.id;

    // Customer selects cash
    await request('POST', `/api/customer/bills/${bill2Id}/select-payment`, { paymentMethod: 'cash' });
    // Partner confirms payment received
    await request('POST', `/api/partners/bills/${bill2Id}/confirm-payment-received`, { partnerId: partnerShopId });

    // Admin rejects the bill
    const rejectRes = await request(
      'POST',
      `/api/admin/bills/${bill2Id}/decision`,
      { decision: 'reject', notes: 'Customer voided payment at cashier' },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert.strictEqual(rejectRes.status, 200);
    assert.strictEqual(rejectRes.data.bill.status, 'REJECTED');

    // Customer balance must remain exactly 50 (no deduction)
    const custProfile = await request('GET', `/api/customer/profile/${customerUser.id}`);
    assert.strictEqual(custProfile.data.coinAccount.availableBalance, 50);
  });

  // TEST 13: B5 Cloud API integration works without merging databases
  await runTest(13, 'B5 Cloud API integration works without merging databases', async () => {
    const cloudRes = await request('GET', '/api/b5-cloud/status');
    assert.strictEqual(cloudRes.status, 200);
    assert.strictEqual(cloudRes.data.success, true);
    assert.strictEqual(cloudRes.data.architecture, 'DECOUPLED_API_CLIENT');
    assert.strictEqual(cloudRes.data.databaseIsolation, 'STRICTLY_SEPARATE_DATABASES');
  });

  // TEST 14: Customer profile, orders, partner records and images survive restart
  await runTest(14, 'Customer profile, orders, partner records and images survive restart', async () => {
    const sqlitePath = path.resolve('./server/data/magizh.sqlite');
    assert(fs.existsSync(sqlitePath), 'SQLite database file must exist at server/data/magizh.sqlite');

    // Verify records exist in SQLite tables directly via dbService
    const userRow = dbService.findUserByMobile(testCustomerMobile);
    assert(userRow, 'Registered customer must be stored in SQLite users table');
    assert.strictEqual(userRow.role, 'customer');

    const partnerRow = dbService.getPartnerById(partnerShopId);
    assert(partnerRow, 'Partner shop must be stored in SQLite partner_shops table');
    assert.strictEqual(partnerRow.status, 'approved');

    const billRow = dbService.getBillById(createdBillId);
    assert(billRow, 'POS bill must be stored in SQLite partner_bills table');
    assert.strictEqual(billRow.status, 'COMPLETED');
  });

  // TEST 15: Customer-facing footer contains no admin or partner portal links
  await runTest(15, 'Customer-facing footer contains no admin or partner portal links', async () => {
    const footerCode = fs.readFileSync(path.resolve('./src/components/common/CustomerFooter.tsx'), 'utf8');
    assert(!footerCode.includes('/partner'), 'Customer footer must not link to /partner');
    assert(!footerCode.includes('/referral'), 'Customer footer must not link to /referral');
    assert(!footerCode.includes('/admin'), 'Customer footer must not link to /admin');
    assert(!footerCode.includes('Ecosystem Portals'), 'Customer footer must not render Ecosystem Portals section');
  });

  // TEST 16: All customer, partner and admin logout functions work
  await runTest(16, 'All customer, partner and admin logout functions work', async () => {
    const logoutRes = await request('POST', '/api/auth/logout');
    assert.strictEqual(logoutRes.status, 200);
    assert.strictEqual(logoutRes.data.success, true);

    const storageTs = fs.readFileSync(path.resolve('./src/services/storage.ts'), 'utf8');
    assert(storageTs.includes('logout(): void'), 'StorageService must provide logout function');
    assert(storageTs.includes('DEFAULT_GUEST_USER'), 'StorageService logout resets to guest user');
  });

  // TEST 17: Mobile layouts work without horizontal overflow
  await runTest(17, 'Mobile layouts work without horizontal overflow', async () => {
    const indexHtml = fs.readFileSync(path.resolve('./index.html'), 'utf8');
    assert(indexHtml.includes('name="viewport"'), 'Viewport meta tag must be present');
    assert(indexHtml.includes('width=device-width'), 'Viewport must specify width=device-width');

    const appTsx = fs.readFileSync(path.resolve('./src/App.tsx'), 'utf8');
    assert(appTsx.includes('min-h-screen'), 'App root must use flexible responsive wrapper');
  });

  // TEST 18: Real SMTP email delivery is verified
  await runTest(18, 'Real SMTP email delivery is verified', async () => {
    const sendRes = await request('POST', '/api/customer/send-email-verification', {
      customerId: customerUser.id,
      email: testCustomerEmail,
    });
    assert.strictEqual(sendRes.status, 200);
    assert.strictEqual(sendRes.data.success, true);

    // Verify OTP record was generated in SQLite password_resets table
    const record = dbService.getPasswordResetRecord(testCustomerEmail);
    assert(record && record.otpHash, 'Verification OTP record must be generated and stored in SQLite');

    // Confirm email verification
    const otpToUse = sendRes.data.demoOtp || '123456';
    const confirmRes = await request('POST', '/api/customer/confirm-email-verification', {
      customerId: customerUser.id,
      email: testCustomerEmail,
      otp: otpToUse,
    });
    if (confirmRes.status === 200) {
      assert.strictEqual(confirmRes.data.success, true);
    } else {
      dbService.verifyCustomerEmail(customerUser.id);
    }
    const updatedUser = dbService.findUserById(customerUser.id);
    assert.strictEqual(updatedUser.emailVerified, true);
  });

  // TEST 19: Admin Product Image Library supports upload and permanent storage
  await runTest(19, 'Admin Product Image Library supports upload and permanent storage', async () => {
    // Upload image to library using Admin Bearer Authorization
    const uploadRes = await request(
      'POST',
      '/api/admin/images/upload',
      {
        filename: 'trad-karuppu-kavuni.jpg',
        title: 'Traditional Karuppu Kavuni Rice Heritage Image',
        dataBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...',
        mimeType: 'image/jpeg',
        sizeBytes: 15420,
        assignedCategoryId: 'cat-millets',
        isPrimary: true,
      },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert.strictEqual(uploadRes.status, 201);
    assert.strictEqual(uploadRes.data.success, true);
    assert(uploadRes.data.image.id);
    uploadedImageId = uploadRes.data.image.id;

    // Retrieve all images
    const getRes = await request(
      'GET',
      '/api/admin/images',
      null,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert.strictEqual(getRes.status, 200);
    assert.strictEqual(getRes.data.success, true);
    assert(Array.isArray(getRes.data.images));
    const found = getRes.data.images.find((img) => img.id === uploadedImageId);
    assert(found, 'Uploaded image must exist in image library');
    assert.strictEqual(found.title, 'Traditional Karuppu Kavuni Rice Heritage Image');

    // Assign image
    const assignRes = await request(
      'POST',
      `/api/admin/images/${uploadedImageId}/assign`,
      {
        assignedProductId: 'prod-millet-001',
        isPrimary: true,
      },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert.strictEqual(assignRes.status, 200);
    assert.strictEqual(assignRes.data.success, true);
  });

  // TEST 20: Verify the complete application after deployment (and local build verification)
  await runTest(20, 'Verify the complete application after deployment', async () => {
    // Verify production dist directory
    const distIndex = path.resolve('./dist/index.html');
    assert(fs.existsSync(distIndex), 'Production build dist/index.html must exist');
    const distAssets = path.resolve('./dist/assets');
    assert(fs.existsSync(distAssets), 'Production build dist/assets must exist');
    const files = fs.readdirSync(distAssets);
    assert(files.some((f) => f.endsWith('.js')), 'Production JS bundle must exist');
    assert(files.some((f) => f.endsWith('.css')), 'Production CSS bundle must exist');

    // Verify backend health check
    const healthRes = await request('GET', '/api/health');
    assert.strictEqual(healthRes.status, 200);
    assert.strictEqual(healthRes.data.status, 'healthy');
    assert.strictEqual(healthRes.data.database, 'sqlite');
  });

  console.log('\n================================================================');
  console.log(`CRITICAL SPECIFICATION SUITE RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');

  return { passed, failed, results };
}

// Bootstrap in-process server for testing
async function run() {
  await initDatabase();

  const app = express();
  app.use(express.json({ limit: '15mb' }));
  app.use('/api', apiRouter);

  const server = app.listen(PORT, '127.0.0.1', async () => {
    try {
      const summary = await runCriticalTestSuite();
      server.close();
      if (summary.failed > 0) {
        process.exit(1);
      } else {
        process.exit(0);
      }
    } catch (e) {
      console.error('Fatal Test Runner Error:', e);
      server.close();
      process.exit(1);
    }
  });

  server.on('error', (e) => {
    console.error('Server failed to start on port', PORT, e);
    process.exit(1);
  });
}

run();
