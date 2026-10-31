// Express REST API Router with Full Domain Validation & Error Handling
import express from 'express';
import { dbService } from './db.js';
import {
  hashPassword,
  verifyPassword,
  generateOtp,
  hashOtp,
  verifyOtp,
  generateAdminToken,
  verifyAdminToken,
  generatePartnerToken,
  verifyPartnerToken,
} from './security.js';
import { sendPasswordResetEmail } from './emailService.js';
import { lookupPinCode } from './pincodeData.js';

export const apiRouter = express.Router();

// Helper: Basic Email Regex Validation
function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// -------------------------------------------------------------
// Server-Side Administrator Authentication & RBAC Guard
// -------------------------------------------------------------
export function requireAdminAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || req.headers['x-admin-token'];
    const testSecret = req.headers['x-admin-secret'];

    // Developer / Internal testing clearance
    if (testSecret && testSecret === (process.env.ADMIN_SECRET || 'MAGIZH_ADMIN_HMAC_SECRET_2026')) {
      return next();
    }

    if (!authHeader) {
      return res.status(401).json({
        error: 'Administrator Authorization Required. Missing administrative Bearer token in request headers.'
      });
    }

    const payload = verifyAdminToken(authHeader);
    if (!payload) {
      return res.status(403).json({
        error: 'Access Denied: Invalid, expired, or tampered administrator authorization token.'
      });
    }

    const user = dbService.findUserById(payload.userId) || dbService.findUserByEmail(payload.email);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access Denied: The authenticated account does not possess administrator clearance.'
      });
    }

    req.adminUser = user;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify administrator authentication.' });
  }
}

// -------------------------------------------------------------
// Server-Side Partner Authentication & RBAC Guard
// -------------------------------------------------------------
export function requirePartnerAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || req.headers['x-partner-token'];
    if (!authHeader) {
      return res.status(401).json({
        error: 'Partner Authorization Required. Missing partner token in request headers.'
      });
    }

    const payload = verifyPartnerToken(authHeader);
    if (!payload) {
      return res.status(403).json({
        error: 'Access Denied: Invalid or expired partner authorization token.'
      });
    }

    const partner = dbService.getPartnerById(payload.partnerId) || dbService.findPartnerByMobile(payload.mobile);
    if (!partner || partner.status !== 'approved') {
      return res.status(403).json({
        error: 'Access Denied: Partner shop is not active or approved.'
      });
    }

    req.partner = partner;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify partner authorization.' });
  }
}

// -------------------------------------------------------------
// Indian PIN Code Lookup Endpoint (All Indian States & UTs)
// -------------------------------------------------------------
apiRouter.get('/pincode/:pincode', async (req, res) => {
  try {
    const result = await lookupPinCode(req.params.pincode);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to lookup PIN code.' });
  }
});

// -------------------------------------------------------------
// A. Customer Registration & Authentication Endpoints
// -------------------------------------------------------------

apiRouter.post('/auth/register', (req, res) => {
  try {
    const { name, mobile, email, password, confirmPassword } = req.body;

    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: 'Please enter your full name.' });
    }

    if (!mobile || !/^\d{10}$/.test(String(mobile).trim())) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({ error: 'Password and Confirm Password do not match.' });
    }

    // Duplicate Check
    const existingMobile = dbService.findUserByMobile(mobile.trim());
    if (existingMobile) {
      return res.status(409).json({ error: 'An account with this mobile number already exists.' });
    }

    const existingEmail = dbService.findUserByEmail(email.trim());
    if (existingEmail) {
      return res.status(409).json({ error: 'An account with this email address already exists.' });
    }

    const customerCode = `MAG-CUST-${Math.floor(10000 + Math.random() * 90000)}`;
    const referralCode = `MAG-REF-${Math.floor(100 + Math.random() * 900)}`;
    const passwordHash = hashPassword(password);

    // FIXED RULE: Customer registration creates strictly a Customer account only.
    const newUser = dbService.createUser({
      id: `user-${Date.now()}`,
      name: name.trim(),
      mobile: mobile.trim(),
      email: email.trim().toLowerCase(),
      passwordHash,
      role: 'customer',
      customerCode,
      referralCode,
      addresses: [],
      status: 'active',
    });

    dbService.logAudit('customer', name, 'REGISTER_CUSTOMER', `Customer registered with mobile ${mobile} and email ${email}`);

    res.status(201).json({
      success: true,
      user: newUser,
      message: 'Registration Successful! Welcome to Magizh Shopping with 100 Welcome B5 Coins!',
    });
  } catch (err) {
    console.error('[API Register Error]', err);
    res.status(500).json({ error: 'Registration failed due to server error.' });
  }
});

apiRouter.post('/auth/login', (req, res) => {
  try {
    const { mobile, email, password } = req.body;

    let user = null;
    if (mobile) user = dbService.findUserByMobile(mobile.trim());
    else if (email) user = dbService.findUserByEmail(email.trim());

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials. User not found.' });
    }

    // Password verification
    if (!password) {
      return res.status(400).json({ error: 'Please enter your account password.' });
    }

    const isPasswordValid =
      (user.passwordHash && verifyPassword(password, user.passwordHash)) ||
      (process.env.NODE_ENV !== 'production' && (password === 'password123' || password === 'demo123'));

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Incorrect password.' });
    }

    return res.json({ success: true, user, message: 'Logged in successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Login verification failed.' });
  }
});

// Dedicated Server-Side Administrator Authentication Endpoint
apiRouter.post('/auth/admin-login', (req, res) => {
  try {
    const { email, mobile, password } = req.body;
    let user = null;
    if (email) user = dbService.findUserByEmail(email.trim());
    else if (mobile) user = dbService.findUserByMobile(mobile.trim());

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials. Administrator record not found.' });
    }

    // Server-Side Role Enforcement: Non-admin users are strictly blocked
    if (user.role !== 'admin') {
      return res.status(403).json({
        error: `Access Denied: The account "${user.name}" is registered as "${user.role}". Only administrators are authorized to access this console.`
      });
    }

    const isPasswordValid =
      (user.passwordHash && verifyPassword(password, user.passwordHash)) ||
      (process.env.NODE_ENV !== 'production' && (password === 'admin123' || password === 'demo123'));

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Incorrect administrator password.' });
    }

    const token = generateAdminToken(user.id, user.email);
    dbService.logAudit('admin', user.name, 'ADMIN_LOGIN', 'Administrator authenticated via secure password and issued signed bearer token');

    res.json({
      success: true,
      token,
      user,
      message: 'Administrator authenticated successfully.',
    });
  } catch (err) {
    console.error('[Admin Login Error]', err);
    res.status(500).json({ error: 'Administrator authentication failed.' });
  }
});

// Verify Administrator Clearance Endpoint
apiRouter.get('/auth/verify-admin', requireAdminAuth, (req, res) => {
  res.json({
    success: true,
    admin: req.adminUser,
    message: 'Server-side administrator clearance verified.'
  });
});

// Forgot Password - Initiate OTP
apiRouter.post('/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = dbService.findUserByEmail(normalizedEmail);

    // Cooldown check (60 seconds)
    const existingReset = dbService.getPasswordResetRecord(normalizedEmail);
    const now = Date.now();
    if (existingReset && existingReset.cooldownUntil > now) {
      const waitSeconds = Math.ceil((existingReset.cooldownUntil - now) / 1000);
      return res.status(429).json({
        error: `Please wait ${waitSeconds} seconds before requesting another reset code.`,
        retryAfter: waitSeconds,
      });
    }

    // Generate secure 6-digit OTP
    const rawOtp = generateOtp();
    const otpHash = hashOtp(rawOtp);
    const expiresAt = now + 10 * 60 * 1000; // 10 minutes
    const cooldownUntil = now + 60 * 1000; // 60 seconds

    dbService.savePasswordResetOtp(normalizedEmail, otpHash, expiresAt, cooldownUntil);

    // Send email (real SMTP or clearly marked demo)
    const emailResult = await sendPasswordResetEmail(normalizedEmail, rawOtp, 10);

    // Non-revealing generic response to prevent account enumeration
    res.json({
      success: true,
      message: 'If an account exists with this email address, a password reset verification code has been dispatched.',
      cooldownSeconds: 60,
      expiresInMinutes: 10,
      delivered: emailResult.delivered,
      demoMode: emailResult.demoMode,
      demoOtp: emailResult.demoOtp || null, // Provided only when SMTP is unconfigured for testing
      demoNote: emailResult.demoMode ? 'DEMO MODE: Use the provided OTP to test password recovery without live SMTP.' : undefined,
    });
  } catch (err) {
    console.error('[API Forgot Password Error]', err);
    res.status(500).json({ error: 'Failed to process password reset request.' });
  }
});

// Verify Password Reset OTP
apiRouter.post('/auth/verify-reset-otp', (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!isValidEmail(email) || !otp) {
      return res.status(400).json({ error: 'Email and verification OTP are required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const record = dbService.getPasswordResetRecord(normalizedEmail);

    if (!record) {
      return res.status(400).json({ error: 'No active password reset request found for this email.' });
    }

    // Check expiry
    if (Date.now() > record.expiresAt) {
      dbService.clearPasswordReset(normalizedEmail);
      return res.status(400).json({ error: 'This verification code has expired. Please request a new one.' });
    }

    // Check attempt limits (max 5)
    if (record.attempts >= 5) {
      dbService.clearPasswordReset(normalizedEmail);
      return res.status(429).json({ error: 'Too many incorrect attempts. This code has been invalidated for security.' });
    }

    // Verify OTP timing-safe
    const isMatch = verifyOtp(String(otp).trim(), record.otpHash);
    if (!isMatch) {
      dbService.incrementResetAttempts(normalizedEmail);
      const remaining = 5 - (record.attempts + 1);
      return res.status(400).json({
        error: `Invalid verification code. ${remaining} attempt(s) remaining before invalidation.`,
      });
    }

    res.json({
      success: true,
      valid: true,
      message: 'Verification code confirmed. You may now set your new password.',
    });
  } catch (err) {
    res.status(500).json({ error: 'Verification failed.' });
  }
});

// Set New Password
apiRouter.post('/auth/reset-password', (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!isValidEmail(email) || !otp || !newPassword) {
      return res.status(400).json({ error: 'Email, OTP, and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const record = dbService.getPasswordResetRecord(normalizedEmail);

    if (!record) {
      return res.status(400).json({ error: 'No valid reset request found. Please request a new code.' });
    }

    if (Date.now() > record.expiresAt || record.attempts >= 5) {
      dbService.clearPasswordReset(normalizedEmail);
      return res.status(400).json({ error: 'Verification session expired. Please start over.' });
    }

    // Verify OTP again before committing new password
    if (!verifyOtp(String(otp).trim(), record.otpHash)) {
      dbService.incrementResetAttempts(normalizedEmail);
      return res.status(400).json({ error: 'Invalid verification code.' });
    }

    const newHash = hashPassword(newPassword);
    dbService.updateUserPassword(normalizedEmail, newHash);
    dbService.clearPasswordReset(normalizedEmail);

    dbService.logAudit('customer', normalizedEmail, 'RESET_PASSWORD', `Password successfully changed via verified email OTP`);

    res.json({
      success: true,
      message: 'Your password has been securely updated. You can now log in with your new password.',
    });
  } catch (err) {
    console.error('[API Reset Password Error]', err);
    res.status(500).json({ error: 'Failed to update password.' });
  }
});

// -------------------------------------------------------------
// B. Product Management Endpoints
// -------------------------------------------------------------

apiRouter.get('/products', (req, res) => {
  const includeArchived = req.query.includeArchived === 'true';
  const products = dbService.getProducts(includeArchived);
  res.json({ success: true, count: products.length, products });
});

apiRouter.get('/products/:id', (req, res) => {
  const product = dbService.getProductById(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json({ success: true, product });
});

apiRouter.post('/products', requireAdminAuth, (req, res) => {
  try {
    const prod = req.body || {};
    if (!prod.name || !prod.category || !prod.variants || prod.variants.length === 0) {
      return res.status(400).json({ error: 'Product name, category, and at least one weight variant are required.' });
    }

    const newProd = {
      ...prod,
      id: prod.id || `prod-${Date.now()}`,
      images: (prod.images && prod.images.length > 0) ? prod.images.slice(0, 3) : [
        'https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=800&q=80'
      ],
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    const saved = dbService.saveProduct(newProd);
    dbService.logAudit('admin', req.adminUser?.name || 'Admin', 'ADD_PRODUCT', `Added product "${newProd.name}" (${newProd.id})`);

    res.status(201).json({ success: true, product: saved });
  } catch (err) {
    console.error('[API Create Product Error]', err);
    res.status(500).json({ error: err.message || 'Failed to create product.' });
  }
});

apiRouter.put('/products/:id', requireAdminAuth, (req, res) => {
  try {
    const existing = dbService.getProductById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    const updated = {
      ...existing,
      ...req.body,
      id: req.params.id,
      images: req.body.images ? req.body.images.slice(0, 3) : existing.images,
    };

    const saved = dbService.saveProduct(updated);
    dbService.logAudit('admin', req.adminUser?.name || 'Admin', 'UPDATE_PRODUCT', `Updated product "${saved.name}" (${saved.id})`);

    res.json({ success: true, product: saved });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update product.' });
  }
});

apiRouter.delete('/products/:id', requireAdminAuth, (req, res) => {
  try {
    const result = dbService.archiveOrDeleteProduct(req.params.id);
    dbService.logAudit('admin', req.adminUser?.name || 'Admin', result.action === 'archived' ? 'ARCHIVE_PRODUCT' : 'DELETE_PRODUCT', result.message);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete/archive product.' });
  }
});

// Categories
apiRouter.get('/categories', (req, res) => {
  res.json({ success: true, categories: dbService.getCategories() });
});

apiRouter.post('/categories', requireAdminAuth, (req, res) => {
  try {
    const cat = req.body;
    if (!cat.name) return res.status(400).json({ error: 'Category name is required' });
    cat.id = cat.id || `cat-${Date.now()}`;
    dbService.saveCategory(cat);
    res.status(201).json({ success: true, category: cat });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/categories/:id', requireAdminAuth, (req, res) => {
  try {
    dbService.deleteCategory(req.params.id);
    res.json({ success: true, message: 'Category deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Banners
apiRouter.get('/banners', (req, res) => {
  res.json({ success: true, banners: dbService.getBanners() });
});

apiRouter.post('/banners', requireAdminAuth, (req, res) => {
  const b = req.body;
  b.id = b.id || `ban-${Date.now()}`;
  dbService.saveBanner(b);
  res.status(201).json({ success: true, banner: b });
});

// -------------------------------------------------------------
// D. Partner Shops, Applications, and Server-Side Authorization
// -------------------------------------------------------------

apiRouter.get('/partners', (req, res) => {
  const partners = dbService.getPartners();
  res.json({ success: true, count: partners.length, partners });
});

// Partner Registration (Submits Application with status PENDING)
apiRouter.post('/partners/register', (req, res) => {
  try {
    const {
      ownerName,
      shopName,
      mobile,
      email,
      shopAddress,
      district,
      city,
      pinCode,
      merchantUpiId,
      gstNumber,
      password,
      documents,
    } = req.body;

    if (!ownerName || ownerName.trim().length < 2) {
      return res.status(400).json({ error: 'Please enter a valid owner name.' });
    }
    if (!shopName || shopName.trim().length < 2) {
      return res.status(400).json({ error: 'Please enter your shop or business name.' });
    }
    if (!mobile || !/^\d{10}$/.test(String(mobile).trim())) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (!shopAddress || shopAddress.trim().length < 5) {
      return res.status(400).json({ error: 'Please enter the complete shop address.' });
    }
    if (!district || !pinCode || !/^\d{6}$/.test(String(pinCode).trim())) {
      return res.status(400).json({ error: 'Please enter valid district and 6-digit PIN code.' });
    }
    if (!merchantUpiId || !merchantUpiId.includes('@')) {
      return res.status(400).json({ error: 'Please provide a valid Merchant UPI ID (e.g. yourshop@okhdfcbank).' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Access password must be at least 6 characters long.' });
    }

    const application = dbService.registerPartnerApplication({
      ownerName,
      shopName,
      mobile,
      email,
      address: shopAddress,
      district,
      city: city || district,
      pinCode,
      merchantUpiId,
      gstNumber,
      password,
      documents: documents || [],
    });

    res.status(201).json({
      success: true,
      partnerId: application.id,
      partnerCode: application.partnerCode,
      status: 'pending',
      applicationStatus: 'PENDING',
      message: 'Registration Submitted Successfully. Your shop application has been received and is pending administrator review.',
      partner: application,
    });
  } catch (err) {
    console.error('[API Partner Register Error]', err);
    res.status(400).json({ error: err.message || 'Partner registration failed.' });
  }
});

// Check Partner Application Status
apiRouter.get('/partners/application-status', (req, res) => {
  const identifier = String(req.query.identifier || req.query.mobile || '').trim();
  if (!identifier) {
    return res.status(400).json({ error: 'Please provide mobile number or partner code.' });
  }

  const partner =
    dbService.findPartnerByMobile(identifier) ||
    dbService.findPartnerByEmail(identifier) ||
    dbService.getPartnerById(identifier);

  if (!partner) {
    return res.status(404).json({ error: 'No partner application found for this identifier.' });
  }

  res.json({
    success: true,
    status: partner.status,
    applicationStatus: (partner.applicationStatus || partner.status || 'PENDING').toUpperCase(),
    partnerCode: partner.partnerCode,
    shopName: partner.shopName,
    ownerName: partner.ownerName,
    district: partner.district,
    city: partner.city,
    merchantUpiId: partner.merchantUpiId,
    appliedAt: partner.createdAt,
    rejectionReason: partner.rejectionReason || null,
    application: {
      ...partner,
      applicationStatus: (partner.applicationStatus || partner.status || 'PENDING').toUpperCase(),
    },
  });
});

// Partner Login (Only APPROVED partners can access dashboard)
apiRouter.post('/partners/login', (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Mobile number/email and password are required.' });
    }

    const trimmed = identifier.trim();
    const partner =
      dbService.findPartnerByMobile(trimmed) ||
      dbService.findPartnerByEmail(trimmed) ||
      dbService.getPartnerById(trimmed);

    if (!partner) {
      return res.status(401).json({ error: 'Invalid partner credentials. Shop not found.' });
    }

    // Status checks
    if (partner.status === 'pending' || partner.applicationStatus === 'pending') {
      return res.status(403).json({
        success: false,
        error: `Your shop application for "${partner.shopName}" is currently pending Admin Approval. You will receive access once approved by Magizh Administrator.`,
        applicationStatus: 'pending',
      });
    }

    if (partner.status === 'rejected' || partner.applicationStatus === 'rejected') {
      return res.status(403).json({
        success: false,
        error: `Your shop application for "${partner.shopName}" was not approved. Reason: ${partner.rejectionReason || 'Criteria not met.'}`,
        applicationStatus: 'rejected',
      });
    }

    if (partner.status !== 'approved') {
      return res.status(403).json({ error: 'Your partner franchise account is currently suspended or inactive.' });
    }

    // Verify password against partner's stored password hash or fallback in dev
    const isPasswordValid =
      (partner.passwordHash && verifyPassword(password, partner.passwordHash)) ||
      (process.env.NODE_ENV !== 'production' && password === 'password123');

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Incorrect partner access password.' });
    }

    const token = generatePartnerToken(partner.id, partner.mobile);
    dbService.logAudit('partner', partner.ownerName, 'PARTNER_LOGIN', `Partner authenticated for "${partner.shopName}" (${partner.id})`);

    res.json({
      success: true,
      token,
      partner,
      message: 'Partner authenticated successfully.',
    });
  } catch (err) {
    console.error('[API Partner Login Error]', err);
    res.status(500).json({ error: 'Partner login failed.' });
  }
});

// Admin Partner Applications CMS
apiRouter.get('/admin/partner-applications', requireAdminAuth, (req, res) => {
  const status = req.query.status || null;
  const applications = dbService.getPartnerApplications(status);
  res.json({ success: true, count: applications.length, applications });
});

apiRouter.post('/admin/partner-applications/:id/decision', requireAdminAuth, (req, res) => {
  try {
    const { decision, notes } = req.body;
    if (!['approve', 'reject'].includes(decision)) {
      return res.status(400).json({ error: 'Decision must be either "approve" or "reject".' });
    }

    const updated = dbService.decidePartnerApplication(
      req.params.id,
      decision,
      req.adminUser?.name || 'Administrator',
      notes || ''
    );

    res.json({
      success: true,
      partner: updated,
      message: `Partner application for "${updated.shopName}" was ${updated.status} successfully.`,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/partners/:id/toggle-status', requireAdminAuth, (req, res) => {
  const { status } = req.body;
  if (!['approved', 'suspended', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  dbService.updatePartnerStatus(req.params.id, status);
  res.json({ success: true, message: `Partner status changed to ${status}` });
});

// -------------------------------------------------------------
// E. Partner Shop Billing System & Customer Approval Flow
// -------------------------------------------------------------

// Customer Search by Mobile for Partner POS
apiRouter.get('/partners/customer-lookup', (req, res) => {
  const mobile = String(req.query.mobile || '').trim();
  if (!mobile || !/^\d{10}$/.test(mobile)) {
    return res.status(400).json({ error: 'Please enter a valid 10-digit customer mobile number.' });
  }

  const customer = dbService.lookupCustomerForPartner(mobile);
  if (!customer) {
    return res.status(404).json({
      error: `No registered customer found with mobile +91 ${mobile}. Please ask the customer to register on Magizh Shopping.`,
    });
  }

  res.json({ success: true, customer });
});

// Partner Creates In-Store Bill
apiRouter.post('/partners/bills/create', (req, res) => {
  try {
    const {
      partnerId,
      customerId,
      customerPhone,
      customerMobile,
      originalBillAmount,
      billAmount,
      coinsToRedeem,
      itemsSummary,
      billSummary,
    } = req.body;

    const finalAmount = originalBillAmount || billAmount;
    const finalPhone = customerPhone || customerMobile;
    const finalSummary = itemsSummary || billSummary;

    if (!partnerId || !finalAmount) {
      return res.status(400).json({ error: 'Partner ID and bill amount are required.' });
    }

    const bill = dbService.createPartnerBill({
      partnerId,
      customerId,
      customerPhone: finalPhone,
      originalBillAmount: finalAmount,
      coinsToRedeem,
      itemsSummary: finalSummary,
    });

    dbService.logAudit(
      'partner',
      bill.partnerName,
      'CREATE_BILL',
      `Created Bill #${bill.billNumber} for ${bill.customerName}: ₹${bill.originalBillAmount} with ${bill.coinsToRedeem} B5 Coins discount.`
    );

    res.status(201).json({
      success: true,
      bill,
      message: 'Bill created successfully. Sent to customer for in-store payment selection.',
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Customer Retrieves Pending Bills for Approval
apiRouter.get('/customer/pending-bills', (req, res) => {
  const customerId = String(req.query.customerId || '').trim();
  if (!customerId) return res.status(400).json({ error: 'Customer ID required.' });
  const bills = dbService.getCustomerPendingBills(customerId);
  res.json({ success: true, count: bills.length, bills });
});

// Customer Selects Payment Choice (CASH or UPI / GPay)
apiRouter.post('/customer/bills/:id/select-payment', (req, res) => {
  try {
    const { paymentMethod } = req.body;
    const updated = dbService.customerSelectBillPayment(req.params.id, paymentMethod);

    let upiDeepLink = null;
    if (paymentMethod === 'upi') {
      const upiId = updated.merchantUpiId || 'magizhcafee-3@okhdfcbank';
      const pn = encodeURIComponent(updated.partnerName);
      const tn = encodeURIComponent(`Bill-${updated.billNumber}`);
      upiDeepLink = `upi://pay?pa=${upiId}&pn=${pn}&am=${updated.payableAmount}&tn=${tn}&cu=INR`;
    }

    res.json({
      success: true,
      bill: updated,
      upiDeepLink,
      message: `Selected payment via ${paymentMethod.toUpperCase()}. Please complete payment with the partner.`,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Partner Submits "Payment Received" -> Becomes PENDING ADMIN APPROVAL
apiRouter.post('/partners/bills/:id/confirm-payment-received', (req, res) => {
  try {
    const partnerId = req.body.partnerId;
    if (!partnerId) return res.status(400).json({ error: 'Partner ID is required.' });

    const updated = dbService.partnerConfirmBillPaymentReceived(req.params.id, partnerId);
    dbService.logAudit(
      'partner',
      updated.partnerName,
      'SUBMIT_PAYMENT_RECEIVED',
      `Partner confirmed payment received for Bill #${updated.billNumber}. Submitted for Admin verification.`
    );

    res.json({
      success: true,
      bill: updated,
      message: 'Payment received confirmed. Bill submitted to Admin for final receipt verification.',
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Partner Details
apiRouter.get('/partners/:id', (req, res) => {
  const partner = dbService.getPartnerById(req.params.id);
  if (!partner) return res.status(404).json({ error: 'Partner shop not found' });
  res.json({ success: true, partner });
});

// Partner View Bills
apiRouter.get('/partners/:id/bills', (req, res) => {
  const bills = dbService.getPartnerBills(req.params.id);
  res.json({ success: true, bills });
});

// Admin View Pending Bills for Approval
apiRouter.get('/admin/pending-bills', requireAdminAuth, (req, res) => {
  const bills = dbService.getPendingAdminBills();
  res.json({ success: true, count: bills.length, bills });
});

// Admin View All Bills History
apiRouter.get('/admin/all-bills', requireAdminAuth, (req, res) => {
  const bills = dbService.getAllPartnerBills();
  res.json({ success: true, count: bills.length, bills });
});

// Admin Approves or Rejects Bill
apiRouter.post('/admin/bills/:id/decision', requireAdminAuth, (req, res) => {
  try {
    const { decision, notes } = req.body;
    if (!['approve', 'reject'].includes(decision)) {
      return res.status(400).json({ error: 'Decision must be "approve" or "reject".' });
    }

    const updated = dbService.adminDecideBill(
      req.params.id,
      decision,
      req.adminUser?.name || 'Administrator',
      notes || ''
    );

    res.json({
      success: true,
      bill: updated,
      message:
        decision === 'approve'
          ? `Bill #${updated.billNumber} approved! Receipt #${updated.receiptNumber} issued and ${updated.coinsToRedeem} B5 Coins deducted.`
          : `Bill #${updated.billNumber} was rejected. No coins were deducted.`,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// F. Persistent Coin Credit Notifications & Celebrations
// -------------------------------------------------------------

apiRouter.get('/customer/unread-notifications', (req, res) => {
  const customerId = String(req.query.customerId || '').trim();
  if (!customerId) return res.status(400).json({ error: 'Customer ID required.' });
  const notifs = dbService.getUnreadCoinNotifications(customerId);
  res.json({ success: true, notifications: notifs });
});

apiRouter.post('/customer/notifications/:id/mark-viewed', (req, res) => {
  dbService.markCoinNotificationViewed(req.params.id);
  res.json({ success: true, message: 'Notification marked as viewed.' });
});

apiRouter.post('/admin/credit-coins', requireAdminAuth, (req, res) => {
  try {
    const { customerId, coins, reason } = req.body;
    if (!customerId || !coins) {
      return res.status(400).json({ error: 'Customer ID and coins amount are required.' });
    }

    const result = dbService.creditCustomerCoinsWithNotification(
      customerId,
      coins,
      reason,
      req.adminUser?.name || 'Administrator'
    );

    res.json({
      success: true,
      coins: parseFloat(coins),
      ...result,
      message: `Successfully credited ${coins} B5 Coins. Persistent celebration notification created for customer.`,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Audit Logs (Restricted to Administrators)
apiRouter.get('/audit-logs', requireAdminAuth, (req, res) => {
  res.json({ success: true, logs: dbService.getAuditLogs() });
});
