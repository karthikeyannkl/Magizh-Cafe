import React, { useState, useEffect } from 'react';
import {
  Store,
  ShieldCheck,
  ArrowRight,
  Lock,
  Phone,
  Mail,
  CheckCircle2,
  AlertCircle,
  Building2,
  MapPin,
  QrCode,
  FileText,
  Search,
  Clock,
  XCircle,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { User } from '../../types';
import { StorageService } from '../../services/storage';

interface PartnerAuthGuardProps {
  currentUser: User;
  onLoginSuccess: (user: User) => void;
  onNavigateStorefront: () => void;
  children: React.ReactNode;
}

type TabType = 'login' | 'register' | 'status';

export const PartnerAuthGuard: React.FC<PartnerAuthGuardProps> = ({
  currentUser,
  onLoginSuccess,
  onNavigateStorefront,
  children,
}) => {
  // If already authenticated as partner or admin, show Partner Dashboard
  if (currentUser.role === 'partner' || currentUser.role === 'admin') {
    return <>{children}</>;
  }

  const [activeTab, setActiveTab] = useState<TabType>('login');

  // Login state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Registration state
  const [ownerName, setOwnerName] = useState('');
  const [shopName, setShopName] = useState('');
  const [regMobile, setRegMobile] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [pinCode, setPinCode] = useState('641002');
  const [district, setDistrict] = useState('Coimbatore');
  const [city, setCity] = useState('Coimbatore');
  const [state, setState] = useState('Tamil Nadu');
  const [merchantUpiId, setMerchantUpiId] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [docNotes, setDocNotes] = useState('FSSAI / Trade License verified');
  const [isPinLoading, setIsPinLoading] = useState(false);
  const [pinVerified, setPinVerified] = useState(false);
  const [regError, setRegError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [regSuccessResult, setRegSuccessResult] = useState<any | null>(null);

  // Status check state
  const [statusMobile, setStatusMobile] = useState('');
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [statusResult, setStatusResult] = useState<any | null>(null);

  // Live PIN Code lookup for registration
  useEffect(() => {
    const cleaned = pinCode.trim();
    if (cleaned.length === 6 && /^\d{6}$/.test(cleaned)) {
      setIsPinLoading(true);
      fetch(`/api/pincode/${cleaned}`)
        .then((r) => r.json())
        .then((data) => {
          setIsPinLoading(false);
          if (data.success && data.data) {
            setDistrict(data.data.district || '');
            setCity(data.data.city || data.data.district || '');
            setState(data.data.state || 'Tamil Nadu');
            setPinVerified(true);
          }
        })
        .catch(() => {
          setIsPinLoading(false);
        });
    } else {
      setPinVerified(false);
    }
  }, [pinCode]);

  // Handle Partner Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);

    try {
      const res = await fetch('/api/partners/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: loginIdentifier.trim(),
          password: loginPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setLoginError(data.error || 'Partner login failed. Please verify credentials.');
        setIsLoggingIn(false);
        return;
      }

      // Store partner token
      if (data.token) {
        StorageService.setPartnerToken(data.token);
      }

      const partnerUser: User = {
        id: data.partner.id || `partner-${Date.now()}`,
        mobile: data.partner.mobile,
        name: data.partner.name || data.partner.ownerName,
        email: data.partner.email,
        role: 'partner',
        customerCode: data.partner.partnerCode || `MAG-PTR-${data.partner.id}`,
        referralCode: '',
        addresses: [],
        status: 'active',
        createdAt: new Date().toISOString(),
      };

      StorageService.setCurrentUser(partnerUser);
      onLoginSuccess(partnerUser);
    } catch (err: any) {
      setLoginError(err.message || 'Network error occurred during partner sign in.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Handle Partner Registration
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');

    if (!ownerName.trim() || !shopName.trim()) {
      setRegError('Please provide Owner Full Name and Shop Name.');
      return;
    }
    if (!/^\d{10}$/.test(regMobile.trim())) {
      setRegError('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!merchantUpiId.trim() || !merchantUpiId.includes('@')) {
      setRegError('Please enter a valid Merchant UPI ID (e.g. shopname@upi or 9843210987@okaxis).');
      return;
    }
    if (regPassword.length < 6) {
      setRegError('Password must be at least 6 characters.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setRegError('Passwords do not match.');
      return;
    }

    setIsRegistering(true);

    try {
      const res = await fetch('/api/partners/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerName: ownerName.trim(),
          shopName: shopName.trim(),
          mobile: regMobile.trim(),
          email: regEmail.trim(),
          shopAddress: shopAddress.trim(),
          district: district.trim(),
          city: city.trim(),
          pinCode: pinCode.trim(),
          merchantUpiId: merchantUpiId.trim(),
          gstNumber: gstNumber.trim(),
          password: regPassword,
          documents: { note: docNotes.trim(), submittedAt: new Date().toISOString() },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setRegError(data.error || 'Failed to submit partner application.');
        setIsRegistering(false);
        return;
      }

      setRegSuccessResult(data);
    } catch (err: any) {
      setRegError(err.message || 'Network error occurred while submitting application.');
    } finally {
      setIsRegistering(false);
    }
  };

  // Handle Application Status Check
  const handleStatusCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusError('');
    setStatusResult(null);

    const cleanMobile = statusMobile.trim();
    if (!/^\d{10}$/.test(cleanMobile)) {
      setStatusError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setIsCheckingStatus(true);

    try {
      const res = await fetch(`/api/partners/application-status?mobile=${encodeURIComponent(cleanMobile)}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        setStatusError(data.error || 'No partner application found for this mobile number.');
        setIsCheckingStatus(false);
        return;
      }

      setStatusResult(data.application);
    } catch (err: any) {
      setStatusError(err.message || 'Error checking application status.');
    } finally {
      setIsCheckingStatus(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto my-6 sm:my-10 px-4">
      <div className="bg-white rounded-3xl border border-cream-300 shadow-xl overflow-hidden">
        {/* Portal Header */}
        <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-darkbrown-950 text-white p-6 sm:p-7 text-center relative border-b-4 border-amber-500">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 backdrop-blur-md border border-amber-400/40 text-amber-300 flex items-center justify-center mx-auto mb-3 shadow-inner">
            <Store className="w-7 h-7" />
          </div>
          <span className="inline-block bg-amber-500/20 text-amber-300 text-[10px] font-black px-3 py-0.5 rounded-full uppercase tracking-wider mb-2 border border-amber-400/30">
            Magizh Franchise Network
          </span>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-cream-100">
            Partner Shop Portal
          </h1>
          <p className="text-xs text-emerald-200 mt-1 max-w-sm mx-auto">
            Authorized POS billing, in-store B5 Coin redemption, and franchise operations
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-cream-200 bg-cream-50/70 p-1.5 gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('login')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'login'
                ? 'bg-white text-emerald-900 shadow-xs border border-cream-300'
                : 'text-gray-600 hover:text-darkbrown-900 hover:bg-cream-100/60'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Partner Sign In</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('register')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'register'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-gray-600 hover:text-darkbrown-900 hover:bg-cream-100/60'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Register Your Shop</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('status')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'status'
                ? 'bg-white text-darkbrown-900 shadow-xs border border-cream-300'
                : 'text-gray-600 hover:text-darkbrown-900 hover:bg-cream-100/60'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Status</span>
          </button>
        </div>

        {/* TAB 1: PARTNER SIGN IN */}
        {activeTab === 'login' && (
          <form onSubmit={handleLoginSubmit} className="p-6 sm:p-7 space-y-4">
            {loginError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{loginError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-darkbrown-900 mb-1">
                Partner Mobile Number or Email
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  placeholder="9843210987 or kovaiorganics@magizh.in"
                  className="w-full pl-9 pr-3 py-2.5 bg-cream-50 border border-cream-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-700 text-darkbrown-900"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-darkbrown-900 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 bg-cream-50 border border-cream-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-700 text-darkbrown-900"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 bg-emerald-900 hover:bg-emerald-950 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Partner Credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Partner Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="pt-2 text-center">
              <p className="text-xs text-gray-500">
                Want to join Magizh as a partner merchant?{' '}
                <button
                  type="button"
                  onClick={() => setActiveTab('register')}
                  className="font-bold text-amber-600 hover:underline"
                >
                  Register Your Shop
                </button>
              </p>
            </div>
          </form>
        )}

        {/* TAB 2: REGISTER YOUR SHOP */}
        {activeTab === 'register' && (
          <div className="p-6 sm:p-7">
            {regSuccessResult ? (
              <div className="text-center py-6 space-y-4 animate-in zoom-in-95">
                <div className="w-16 h-16 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <Clock className="w-8 h-8" />
                </div>
                <span className="inline-block bg-amber-100 text-amber-900 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
                  Status: PENDING ADMIN APPROVAL
                </span>
                <h3 className="text-lg font-black text-darkbrown-900">
                  Application Submitted Successfully!
                </h3>
                <p className="text-xs text-gray-600 max-w-md mx-auto leading-relaxed">
                  {regSuccessResult.message ||
                    'Your Partner Shop application has been submitted and is pending Admin Approval. You will receive access once approved.'}
                </p>
                <div className="bg-cream-50 border border-cream-200 rounded-2xl p-4 max-w-sm mx-auto text-left text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Shop Name:</span>
                    <span className="font-bold text-darkbrown-900">{shopName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Owner:</span>
                    <span className="font-bold text-darkbrown-900">{ownerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Registered Mobile:</span>
                    <span className="font-mono font-bold text-darkbrown-900">{regMobile}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Merchant UPI:</span>
                    <span className="font-mono font-bold text-emerald-800">{merchantUpiId}</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2 justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      setStatusMobile(regMobile);
                      setActiveTab('status');
                    }}
                    className="py-2.5 px-4 bg-emerald-900 hover:bg-emerald-950 text-white rounded-xl text-xs font-bold transition-all"
                  >
                    Check Application Status
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRegSuccessResult(null);
                      setActiveTab('login');
                    }}
                    className="py-2.5 px-4 bg-cream-100 hover:bg-cream-200 text-darkbrown-900 rounded-xl text-xs font-bold transition-all"
                  >
                    Go to Partner Sign In
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="space-y-3.5 text-xs">
                {regError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{regError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-bold text-darkbrown-900 mb-1">Owner Full Name *</label>
                    <input
                      type="text"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      placeholder="e.g. Muthusamy Raman"
                      className="w-full p-2.5 border border-cream-300 rounded-xl focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-darkbrown-900 mb-1">Shop / Business Name *</label>
                    <input
                      type="text"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      placeholder="e.g. Kovai Organic Millets"
                      className="w-full p-2.5 border border-cream-300 rounded-xl focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-bold text-darkbrown-900 mb-1">Mobile Number (10 digits) *</label>
                    <input
                      type="tel"
                      maxLength={10}
                      value={regMobile}
                      onChange={(e) => setRegMobile(e.target.value.replace(/\D/g, ''))}
                      placeholder="9843210987"
                      className="w-full p-2.5 border border-cream-300 rounded-xl font-mono focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-darkbrown-900 mb-1">Email Address *</label>
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="shop@example.com"
                      className="w-full p-2.5 border border-cream-300 rounded-xl focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-darkbrown-900 mb-1">Shop Physical Address *</label>
                  <textarea
                    rows={2}
                    value={shopAddress}
                    onChange={(e) => setShopAddress(e.target.value)}
                    placeholder="Door No, Street Name, Landmark"
                    className="w-full p-2.5 border border-cream-300 rounded-xl focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block font-bold text-darkbrown-900 mb-1 flex items-center justify-between">
                      <span>PIN Code *</span>
                      {isPinLoading && <Loader2 className="w-3 h-3 animate-spin text-emerald-700" />}
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={pinCode}
                      onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="641002"
                      className="w-full p-2.5 border border-cream-300 rounded-xl font-mono font-bold focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-darkbrown-900 mb-1">City *</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Coimbatore"
                      className="w-full p-2.5 border border-cream-300 rounded-xl focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-darkbrown-900 mb-1">District *</label>
                    <input
                      type="text"
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      placeholder="Coimbatore"
                      className="w-full p-2.5 border border-cream-300 rounded-xl focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                {/* Merchant UPI ID */}
                <div className="bg-amber-50/70 p-3 rounded-2xl border border-amber-200">
                  <label className="block font-bold text-darkbrown-900 mb-1 flex items-center gap-1.5">
                    <QrCode className="w-4 h-4 text-amber-700" />
                    <span>Merchant UPI ID (For Direct Payments) *</span>
                  </label>
                  <input
                    type="text"
                    value={merchantUpiId}
                    onChange={(e) => setMerchantUpiId(e.target.value)}
                    placeholder="e.g. kovaiorganics@okaxis or 9843210987@upi"
                    className="w-full p-2.5 bg-white border border-amber-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-amber-600 focus:outline-none text-darkbrown-900"
                    required
                  />
                  <p className="text-[11px] text-amber-800 mt-1">
                    Customers paying via UPI in your shop will send funds directly to this UPI ID via GPay/PhonePe.
                  </p>
                </div>

                {/* GST Number (Optional) */}
                <div>
                  <label className="block font-bold text-darkbrown-900 mb-1">
                    GSTIN / Business Registration (Optional)
                  </label>
                  <input
                    type="text"
                    value={gstNumber}
                    onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                    placeholder="33AAAAA0000A1Z5"
                    className="w-full p-2.5 border border-cream-300 rounded-xl font-mono uppercase focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                  />
                </div>

                {/* Passwords */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-bold text-darkbrown-900 mb-1">Create Password *</label>
                    <input
                      type="password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="w-full p-2.5 border border-cream-300 rounded-xl focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-darkbrown-900 mb-1">Confirm Password *</label>
                    <input
                      type="password"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full p-2.5 border border-cream-300 rounded-xl focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                {/* Document Verification Notice */}
                <div className="p-3 bg-cream-50 border border-cream-200 rounded-xl text-[11px] text-gray-600 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-darkbrown-900">
                    <FileText className="w-3.5 h-3.5 text-emerald-800" />
                    <span>KYC & License Documentation</span>
                  </div>
                  <input
                    type="text"
                    value={docNotes}
                    onChange={(e) => setDocNotes(e.target.value)}
                    placeholder="e.g. FSSAI License # 12423000000000"
                    className="w-full p-2 bg-white border border-cream-300 rounded-lg text-xs"
                  />
                  <p className="text-[10px] text-gray-500">
                    Magizh Admin verifies partner shops prior to activation. You cannot log in until approved.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isRegistering}
                  className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isRegistering ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Submitting Application...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Partner Shop Application</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}

        {/* TAB 3: APPLICATION STATUS CHECKER */}
        {activeTab === 'status' && (
          <div className="p-6 sm:p-7 space-y-4">
            <form onSubmit={handleStatusCheck} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-darkbrown-900 mb-1">
                  Enter Registered Mobile Number
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Phone className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                    <input
                      type="tel"
                      maxLength={10}
                      value={statusMobile}
                      onChange={(e) => setStatusMobile(e.target.value.replace(/\D/g, ''))}
                      placeholder="9843210987"
                      className="w-full pl-9 pr-3 py-2.5 bg-cream-50 border border-cream-300 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-darkbrown-800 text-darkbrown-900"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isCheckingStatus}
                    className="px-4 py-2.5 bg-darkbrown-900 hover:bg-darkbrown-950 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isCheckingStatus ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                    <span>Check</span>
                  </button>
                </div>
              </div>
            </form>

            {statusError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{statusError}</span>
              </div>
            )}

            {statusResult && (
              <div className="bg-cream-50 border border-cream-200 rounded-2xl p-4 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between border-b border-cream-200 pb-2.5">
                  <div>
                    <h4 className="text-sm font-black text-darkbrown-900">{statusResult.shopName}</h4>
                    <p className="text-[11px] text-gray-500">{statusResult.ownerName} &bull; {statusResult.city}</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      statusResult.applicationStatus === 'APPROVED'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : statusResult.applicationStatus === 'REJECTED'
                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}
                  >
                    {statusResult.applicationStatus}
                  </span>
                </div>

                <div className="text-xs space-y-1.5 text-gray-700">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Merchant UPI:</span>
                    <span className="font-mono font-bold text-darkbrown-900">{statusResult.merchantUpiId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">District:</span>
                    <span className="font-semibold">{statusResult.district}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Submitted:</span>
                    <span>{new Date(statusResult.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {statusResult.applicationStatus === 'PENDING' && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                    <Clock className="w-4 h-4 shrink-0 text-amber-700 mt-0.5" />
                    <span>Your application is currently being reviewed by Magizh Admin. Please check back later.</span>
                  </div>
                )}

                {statusResult.applicationStatus === 'REJECTED' && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-start gap-2">
                    <XCircle className="w-4 h-4 shrink-0 text-rose-700 mt-0.5" />
                    <div>
                      <p className="font-bold">Application Not Approved</p>
                      <p className="text-[11px] mt-0.5">
                        Reason: {statusResult.rejectionReason || 'Details could not be verified.'}
                      </p>
                    </div>
                  </div>
                )}

                {statusResult.applicationStatus === 'APPROVED' && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                      <span className="font-bold">Congratulations! Your Partner Shop is Approved.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setLoginIdentifier(statusResult.mobile);
                        setActiveTab('login');
                      }}
                      className="w-full py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg font-bold text-xs"
                    >
                      Sign In Now
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Storefront return link */}
        <div className="p-4 bg-cream-50 border-t border-cream-200 text-center">
          <button
            type="button"
            onClick={onNavigateStorefront}
            className="text-xs font-bold text-emerald-800 hover:text-emerald-950 hover:underline"
          >
            &larr; Back to Magizh Customer Shopping (Storefront)
          </button>
        </div>
      </div>
    </div>
  );
};
