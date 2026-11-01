import React, { useState, useEffect } from 'react';
import {
  User as UserIcon,
  MapPin,
  Package,
  Coins,
  Shield,
  LogOut,
  Plus,
  Trash2,
  Check,
  Edit2,
  Share2,
  Store,
  CreditCard,
  QrCode,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Building,
  Home,
  Briefcase,
  Camera,
  Key,
  Mail,
  Phone,
  Clock,
  ArrowRight,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { StorageService, subscribe } from '../../services/storage';
import { User, Address, AddressType, PartnerBill } from '../../types';

interface CustomerAccountProps {
  onNavigateOrders: () => void;
  onNavigateWallet: () => void;
  onNavigateReferral: () => void;
  onOpenAuth: () => void;
}

export const CustomerAccount: React.FC<CustomerAccountProps> = ({
  onNavigateOrders,
  onNavigateWallet,
  onNavigateReferral,
  onOpenAuth,
}) => {
  const [currentUser, setCurrentUser] = useState<User>(StorageService.getCurrentUser());
  const [addresses, setAddresses] = useState<Address[]>(currentUser.addresses || []);
  const [coinAccount, setCoinAccount] = useState(StorageService.getCoinAccount(currentUser.id));
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);

  // Edit Profile Form State
  const [editName, setEditName] = useState(currentUser.name || '');
  const [editEmail, setEditEmail] = useState(currentUser.email || '');
  const [editMobile, setEditMobile] = useState(currentUser.mobile || '');
  const [editPhoto, setEditPhoto] = useState(currentUser.profilePhoto || '');
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);

  // Change Password Form State
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

  // Email Verification State
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const [emailVerificationStep, setEmailVerificationStep] = useState<'idle' | 'sent' | 'verified'>('idle');
  const [emailOtp, setEmailOtp] = useState('');
  const [emailVerifyNotice, setEmailVerifyNotice] = useState<string | null>(null);

  // Address Form State
  const [addressType, setAddressType] = useState<AddressType>('Home');
  const [name, setName] = useState(currentUser.name);
  const [phone, setPhone] = useState(currentUser.mobile);
  const [doorNo, setDoorNo] = useState('');
  const [street, setStreet] = useState('');
  const [area, setArea] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [district, setDistrict] = useState('');
  const [state, setState] = useState('Tamil Nadu');
  const [city, setCity] = useState('');
  const [landmark, setLandmark] = useState('');
  const [postOffices, setPostOffices] = useState<string[]>([]);
  const [selectedPostOffice, setSelectedPostOffice] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [pinLookupSource, setPinLookupSource] = useState<string | null>(null);
  const [formError, setFormError] = useState('');

  // Pending In-Store Bills
  const [pendingBills, setPendingBills] = useState<PartnerBill[]>([]);
  const [billNotice, setBillNotice] = useState<string | null>(null);

  const isLoggedIn = Boolean(currentUser && currentUser.id && !currentUser.isGuest);

  // Sync user state from storage
  useEffect(() => {
    const unsub = subscribe('currentUserChanged', (u: User) => {
      setCurrentUser(u);
      setAddresses(u.addresses || []);
      setCoinAccount(StorageService.getCoinAccount(u.id));
      setEditName(u.name || '');
      setEditEmail(u.email || '');
      setEditMobile(u.mobile || '');
      setEditPhoto(u.profilePhoto || '');
    });
    return () => unsub();
  }, []);

  // Fetch full customer profile from server if logged in
  useEffect(() => {
    if (currentUser.id && !currentUser.isGuest) {
      fetch(`/api/customer/profile/${encodeURIComponent(currentUser.id)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.profile?.user) {
            const serverUser = { ...currentUser, ...data.profile.user };
            setCurrentUser(serverUser);
            StorageService.setCurrentUser(serverUser);
            if (data.profile.coinAccount) {
              setCoinAccount(data.profile.coinAccount);
            }
          }
        })
        .catch(() => {});
    }
  }, [currentUser.id]);

  const fetchPendingBills = async () => {
    if (!currentUser.id || currentUser.isGuest) return;
    try {
      const res = await fetch(`/api/customer/pending-bills?customerId=${encodeURIComponent(currentUser.id)}`);
      if (res.ok) {
        const data = await res.json();
        setPendingBills(data.bills || []);
      }
    } catch {
      // offline
    }
  };

  useEffect(() => {
    fetchPendingBills();
    const interval = setInterval(fetchPendingBills, 6000);
    return () => clearInterval(interval);
  }, [currentUser.id]);

  // Indian PIN Code Live Lookup
  useEffect(() => {
    const clean = pinCode.trim();
    if (/^\d{6}$/.test(clean)) {
      setPinLoading(true);
      setFormError('');
      fetch(`/api/pincode/${clean}`)
        .then((res) => res.json())
        .then((data) => {
          setPinLoading(false);
          if (data.success) {
            setDistrict(data.district || '');
            setState(data.state || '');
            setCity(data.city || data.district || '');
            setPostOffices(data.postOffices || []);
            setSelectedPostOffice(data.postOffices?.[0] || '');
            setPinLookupSource(data.source || 'Verified Postal Network');
          } else {
            setFormError(data.error || 'PIN code not found.');
          }
        })
        .catch(() => {
          setPinLoading(false);
          setFormError('Failed to lookup PIN code.');
        });
    } else {
      setPostOffices([]);
      setSelectedPostOffice('');
      setPinLookupSource(null);
    }
  }, [pinCode]);

  // Handle Edit Profile Submission
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    setIsSubmittingProfile(true);

    try {
      const res = await fetch(`/api/customer/profile/${encodeURIComponent(currentUser.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          email: editEmail,
          mobile: editMobile,
          profilePhoto: editPhoto,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setProfileMsg({ type: 'error', text: data.error || 'Failed to update profile.' });
        setIsSubmittingProfile(false);
        return;
      }

      const updatedUser = { ...currentUser, ...data.user };
      StorageService.setCurrentUser(updatedUser);
      setCurrentUser(updatedUser);
      setProfileMsg({ type: 'success', text: 'Profile updated successfully!' });
      setTimeout(() => setShowEditProfileModal(false), 1200);
    } catch (err: any) {
      setProfileMsg({ type: 'error', text: err.message || 'Connection error.' });
    } finally {
      setIsSubmittingProfile(false);
    }
  };

  // Handle Change Password Submission
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);
    if (newPassword !== confirmNewPassword) {
      setPasswordMsg({ type: 'error', text: 'New password and confirmation do not match.' });
      return;
    }

    setIsSubmittingPassword(true);
    try {
      const res = await fetch('/api/customer/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: currentUser.id,
          oldPassword,
          newPassword,
          confirmPassword: confirmNewPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setPasswordMsg({ type: 'error', text: data.error || 'Password update failed.' });
        setIsSubmittingPassword(false);
        return;
      }

      setPasswordMsg({ type: 'success', text: 'Your password was updated successfully.' });
      setOldPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setTimeout(() => setShowChangePasswordModal(false), 1200);
    } catch (err: any) {
      setPasswordMsg({ type: 'error', text: err.message || 'Connection error.' });
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  // Handle Send Email Verification
  const handleSendEmailVerification = async () => {
    setIsSendingVerification(true);
    setEmailVerifyNotice(null);
    try {
      const res = await fetch('/api/customer/send-email-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: currentUser.id,
          email: currentUser.email,
        }),
      });
      const data = await res.json();
      setIsSendingVerification(false);
      if (res.ok && data.success) {
        setEmailVerificationStep('sent');
        setEmailVerifyNotice(data.message || 'Verification code sent to your registered email.');
      } else {
        setEmailVerifyNotice(data.error || 'Failed to dispatch verification code.');
      }
    } catch {
      setIsSendingVerification(false);
      setEmailVerifyNotice('Network error while dispatching email.');
    }
  };

  // Confirm Email Verification Code
  const handleConfirmEmailVerification = async () => {
    try {
      const res = await fetch('/api/customer/confirm-email-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: currentUser.id,
          email: currentUser.email,
          otp: emailOtp,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const updatedUser = { ...currentUser, emailVerified: true };
        setCurrentUser(updatedUser);
        StorageService.setCurrentUser(updatedUser);
        setEmailVerificationStep('verified');
        setEmailVerifyNotice('Email verified successfully!');
      } else {
        setEmailVerifyNotice(data.error || 'Invalid verification code.');
      }
    } catch {
      setEmailVerifyNotice('Verification error.');
    }
  };

  // Handle Select In-Store Bill Payment
  const handleCustomerSelectPayment = async (billId: string, paymentMethod: 'cash' | 'upi') => {
    try {
      const res = await fetch(`/api/customer/bills/${billId}/select-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethod }),
      });
      const data = await res.json();
      if (data.success) {
        if (paymentMethod === 'upi' && data.upiDeepLink) {
          window.location.href = data.upiDeepLink;
          setBillNotice(`Selected UPI payment for Bill. UPI app opened. Please pay partner ₹${data.bill.payableAmount}.`);
        } else {
          setBillNotice(`Selected Cash payment. Please pay ₹${data.bill.payableAmount} to the partner shop cashier.`);
        }
        fetchPendingBills();
      }
    } catch (err: any) {
      setBillNotice('Failed to record payment choice.');
    }
  };

  const handleSetDefaultAddress = (id: string) => {
    const updated = addresses.map((a) => ({
      ...a,
      isDefault: a.id === id,
    }));
    setAddresses(updated);
    const updatedUser = { ...currentUser, addresses: updated };
    StorageService.saveUser(updatedUser);
    setCurrentUser(updatedUser);
  };

  const handleDeleteAddress = (id: string) => {
    const updated = addresses.filter((a) => a.id !== id);
    setAddresses(updated);
    const updatedUser = { ...currentUser, addresses: updated };
    StorageService.saveUser(updatedUser);
    setCurrentUser(updatedUser);
  };

  const handleSaveNewAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinCode || !district || !state || !doorNo.trim() || !street.trim()) {
      setFormError('Please fill in Door/Flat No, Street, and valid PIN code.');
      return;
    }

    const compiledAddressLine = [
      doorNo.trim(),
      street.trim(),
      area.trim(),
      selectedPostOffice,
      landmark.trim() ? `Near ${landmark.trim()}` : '',
      city.trim(),
      district.trim(),
      `${state.trim()} - ${pinCode.trim()}`,
    ]
      .filter(Boolean)
      .join(', ');

    const created: Address = {
      id: `addr-${Date.now()}`,
      name: name.trim() || currentUser.name,
      phone: phone.trim() || currentUser.mobile,
      addressLine: compiledAddressLine,
      doorNo: doorNo.trim(),
      street: street.trim(),
      area: area.trim(),
      postOffice: selectedPostOffice,
      city: city.trim(),
      district: district.trim(),
      pinCode: pinCode.trim(),
      state: state.trim(),
      landmark: landmark.trim(),
      addressType,
      isDefault: addresses.length === 0,
    };

    const updated = [...addresses, created];
    setAddresses(updated);
    const updatedUser = { ...currentUser, addresses: updated };
    StorageService.saveUser(updatedUser);
    setCurrentUser(updatedUser);

    setDoorNo('');
    setStreet('');
    setArea('');
    setPinCode('');
    setDistrict('');
    setCity('');
    setLandmark('');
    setPostOffices([]);
    setSelectedPostOffice('');
    setShowAddModal(false);
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to log out of your Magizh Customer account?')) {
      StorageService.logout();
      window.location.href = '/';
    }
  };

  // If visitor is a guest, display clean sign-in invitation card
  if (!isLoggedIn) {
    return (
      <div className="max-w-md mx-auto my-12 px-4">
        <div className="bg-white rounded-3xl border border-cream-300 p-8 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-magizh-100 text-magizh-800 mx-auto flex items-center justify-center shadow-inner">
            <UserIcon className="w-8 h-8 text-magizh-800" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-darkbrown-900">Sign In to Your Customer Account</h2>
            <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
              Access your personalized profile, earned B5 Coin balance, order history, and saved delivery addresses.
            </p>
          </div>
          <button
            onClick={onOpenAuth}
            className="w-full py-3 bg-magizh-800 hover:bg-magizh-900 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2"
          >
            <span>Sign In or Register</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 pb-28 space-y-6">
      {/* Profile Header Card */}
      <div className="bg-white rounded-3xl border border-cream-300 p-5 sm:p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative group">
            {currentUser.profilePhoto ? (
              <img
                src={currentUser.profilePhoto}
                alt={currentUser.name}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-magizh-700 shadow-md shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-magizh-700 to-magizh-900 text-white flex items-center justify-center font-extrabold text-2xl shadow-md shrink-0">
                {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'M'}
              </div>
            )}
            <button
              onClick={() => setShowEditProfileModal(true)}
              className="absolute -bottom-1 -right-1 bg-white p-1 rounded-full shadow border border-cream-300 text-darkbrown-700 hover:text-magizh-800"
              title="Change Profile Photo"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-darkbrown-900">
                {currentUser.name || 'Magizh Customer'}
              </h1>
              <span className="text-[10px] font-bold text-magizh-800 bg-magizh-100 px-2 py-0.5 rounded-full capitalize">
                Customer
              </span>
              {currentUser.emailVerified ? (
                <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                  <ShieldCheck className="w-3 h-3 text-emerald-700" />
                  <span>Verified</span>
                </span>
              ) : null}
            </div>
            <p className="text-xs text-gray-500 font-mono mt-0.5">
              Customer Code: <span className="font-bold text-darkbrown-900">{currentUser.customerCode || 'MAG-CUST'}</span>
            </p>
            <p className="text-xs text-gray-600 mt-0.5 flex flex-wrap items-center gap-2">
              <span>+91 {currentUser.mobile}</span>
              <span>&bull;</span>
              <span>{currentUser.email || 'Registered Customer'}</span>
            </p>
          </div>
        </div>

        {/* Action Controls: Edit Profile, Change Password, Logout */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
          <button
            onClick={() => setShowEditProfileModal(true)}
            className="px-3 py-2 bg-cream-100 hover:bg-cream-200 text-darkbrown-800 rounded-xl text-xs font-bold border border-cream-300 transition-all flex items-center gap-1.5"
            title="Edit Customer Profile"
          >
            <Edit2 className="w-3.5 h-3.5 text-magizh-700" />
            <span>Edit Profile</span>
          </button>

          <button
            onClick={() => setShowChangePasswordModal(true)}
            className="px-3 py-2 bg-cream-100 hover:bg-cream-200 text-darkbrown-800 rounded-xl text-xs font-bold border border-cream-300 transition-all flex items-center gap-1.5"
            title="Change Account Password"
          >
            <Key className="w-3.5 h-3.5 text-amber-700" />
            <span>Password</span>
          </button>

          <button
            onClick={handleLogout}
            className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 hover:text-red-800 rounded-xl text-xs font-black border border-red-200 transition-all flex items-center gap-1.5 shadow-2xs"
            title="Log out of this customer account securely"
          >
            <LogOut className="w-3.5 h-3.5 text-red-600" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Email Verification Banner if unverified */}
      {!currentUser.emailVerified && currentUser.email && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-amber-900">
            <Mail className="w-4 h-4 text-amber-700 shrink-0" />
            <span>Your email address <strong>{currentUser.email}</strong> is not yet verified.</span>
          </div>
          {emailVerificationStep === 'idle' ? (
            <button
              onClick={handleSendEmailVerification}
              disabled={isSendingVerification}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold shrink-0 disabled:opacity-50"
            >
              {isSendingVerification ? 'Sending...' : 'Send Verification Email'}
            </button>
          ) : emailVerificationStep === 'sent' ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                maxLength={6}
                value={emailOtp}
                onChange={(e) => setEmailOtp(e.target.value)}
                placeholder="6-digit code"
                className="w-28 p-1.5 border border-amber-300 rounded-lg text-center font-mono font-bold"
              />
              <button
                onClick={handleConfirmEmailVerification}
                className="px-3 py-1.5 bg-emerald-700 text-white font-bold rounded-lg hover:bg-emerald-800"
              >
                Confirm
              </button>
            </div>
          ) : (
            <span className="text-emerald-700 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" />
              <span>Verified!</span>
            </span>
          )}
        </div>
      )}

      {/* In-Store Partner Bills for Customer Approval */}
      {pendingBills.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-orange-500/10 border-2 border-amber-400 rounded-3xl p-5 sm:p-6 space-y-4 shadow-sm animate-in fade-in">
          <div className="flex items-center justify-between border-b border-amber-300/60 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-black text-darkbrown-900">
                  In-Store Partner Bill Approval Request
                </h2>
                <p className="text-xs text-amber-900">
                  A partner shop generated an in-store bill for your review and payment choice
                </p>
              </div>
            </div>
            <span className="bg-amber-200 text-amber-900 text-[10px] font-black px-2.5 py-1 rounded-full uppercase">
              Action Required
            </span>
          </div>

          {billNotice && (
            <div className="p-3 bg-amber-100 border border-amber-300 text-amber-900 rounded-xl text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-700 shrink-0" />
              <span>{billNotice}</span>
            </div>
          )}

          <div className="space-y-3">
            {pendingBills.map((bill) => (
              <div
                key={bill.id}
                className="bg-white rounded-2xl border border-amber-200 p-4 shadow-2xs space-y-3 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cream-200 pb-2.5">
                  <div>
                    <span className="font-extrabold text-sm text-darkbrown-900 block">
                      {bill.partnerName}
                    </span>
                    <span className="font-mono text-[11px] text-gray-500">
                      Bill #{bill.billNumber} &bull; {new Date(bill.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-900 border border-blue-200">
                    Status: {bill.status.replace(/_/g, ' ')}
                  </span>
                </div>

                {/* Amounts Breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-cream-50 p-3 rounded-xl border border-cream-200">
                  <div>
                    <span className="text-[10px] text-gray-500 block">Original Bill</span>
                    <span className="text-xs font-bold text-darkbrown-900">₹{bill.originalBillAmount}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 block">B5 Coins Used</span>
                    <span className="text-xs font-bold text-amber-700">-{bill.coinsToRedeem} Coins</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 block">Coin Discount</span>
                    <span className="text-xs font-bold text-emerald-700">-₹{bill.discountAmount}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 block">Net Payable</span>
                    <span className="text-sm font-black text-magizh-900">₹{bill.payableAmount}</span>
                  </div>
                </div>

                {/* Items Description */}
                <p className="text-[11px] text-gray-600 bg-white px-2 py-1 rounded border border-cream-200">
                  Items: <span className="font-medium text-darkbrown-900">{bill.itemsSummary}</span>
                </p>

                {/* Customer Payment Choices */}
                {bill.status === 'PENDING_CUSTOMER_APPROVAL' ? (
                  <div className="space-y-2 pt-2 border-t border-cream-200">
                    <p className="text-xs font-bold text-darkbrown-900">Select How You Wish to Pay the Remaining ₹{bill.payableAmount}:</p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={() => handleCustomerSelectPayment(bill.id, 'cash')}
                        className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                      >
                        <CreditCard className="w-4 h-4" />
                        <span>Pay with Cash in Store</span>
                      </button>
                      <button
                        onClick={() => handleCustomerSelectPayment(bill.id, 'upi')}
                        className="flex-1 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                      >
                        <QrCode className="w-4 h-4" />
                        <span>Pay via UPI / GPay Deep Link</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-cream-200 text-emerald-800 font-bold text-[11px] flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>Payment choice selected. Partner will confirm payment upon receiving in store.</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* B5 Coin Summary Card */}
      <div className="bg-gradient-to-r from-amber-500/10 via-cream-100 to-amber-500/5 rounded-3xl border border-b5-200 p-5 sm:p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-b5-500 to-b5-700 text-white flex items-center justify-center shadow-md shrink-0">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-b5-800 uppercase tracking-wider">Your B5 Coin Balance</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-b5-700">{coinAccount.availableBalance}</span>
              <span className="text-xs font-bold text-darkbrown-700">Coins (Worth ₹{coinAccount.availableBalance})</span>
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Total Earned: {coinAccount.totalEarned} &bull; Total Redeemed: {coinAccount.totalRedeemed}
            </p>
          </div>
        </div>

        <button
          onClick={onNavigateWallet}
          className="px-4 py-2 bg-b5-600 hover:bg-b5-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs self-start sm:self-center"
        >
          View Full Wallet
        </button>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div
          onClick={onNavigateOrders}
          className="bg-white p-5 rounded-3xl border border-cream-300 shadow-2xs hover:border-magizh-600 cursor-pointer transition-all flex items-center gap-4 group"
        >
          <div className="w-12 h-12 rounded-2xl bg-magizh-50 text-magizh-800 flex items-center justify-center group-hover:scale-105 transition-transform">
            <Package className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-extrabold text-darkbrown-900 group-hover:text-magizh-800 transition-colors">
              My Orders &amp; Tracking
            </h3>
            <p className="text-xs text-gray-500">Track shipments, view invoices and delivery timelines</p>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-magizh-800 group-hover:translate-x-1 transition-all" />
        </div>

        <div
          onClick={onNavigateReferral}
          className="bg-white p-5 rounded-3xl border border-cream-300 shadow-2xs hover:border-b5-600 cursor-pointer transition-all flex items-center gap-4 group"
        >
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-b5-700 flex items-center justify-center group-hover:scale-105 transition-transform">
            <Share2 className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-extrabold text-darkbrown-900 group-hover:text-b5-700 transition-colors">
              Referral Rewards Program
            </h3>
            <p className="text-xs text-gray-500">Share your referral link ({currentUser.referralCode || 'REF'}) to earn bonus B5 coins</p>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-b5-700 group-hover:translate-x-1 transition-all" />
        </div>
      </div>

      {/* Address Book Section */}
      <div className="bg-white rounded-3xl border border-cream-300 p-5 sm:p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-cream-200 pb-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-magizh-700" />
            <h2 className="text-base font-extrabold text-darkbrown-900">Saved Delivery Addresses</h2>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-magizh-800 hover:bg-magizh-900 text-white rounded-xl text-xs font-bold transition-all shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add New Address</span>
          </button>
        </div>

        {addresses.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-xs">
            <MapPin className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="font-semibold text-darkbrown-800">No delivery addresses saved yet.</p>
            <p className="mt-1">Add your home or office address with live Indian PIN code lookup.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {addresses.map((addr) => (
              <div
                key={addr.id}
                className={`p-4 rounded-2xl border transition-all relative ${
                  addr.isDefault
                    ? 'border-magizh-700 bg-magizh-50/20 shadow-2xs'
                    : 'border-cream-300 bg-cream-50/40 hover:border-cream-400'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-white border border-cream-300 text-darkbrown-800 flex items-center gap-1">
                    {addr.addressType === 'Home' && <Home className="w-3 h-3 text-magizh-700" />}
                    {addr.addressType === 'Work' && <Briefcase className="w-3 h-3 text-blue-700" />}
                    {addr.addressType === 'Other' && <Building className="w-3 h-3 text-purple-700" />}
                    <span>{addr.addressType || 'Home'}</span>
                  </span>
                  {addr.isDefault && (
                    <span className="text-[10px] font-black text-magizh-800 bg-magizh-100 px-2 py-0.5 rounded-full">
                      Default Delivery Address
                    </span>
                  )}
                </div>

                <p className="text-xs font-extrabold text-darkbrown-900">{addr.name}</p>
                <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{addr.addressLine}</p>
                <p className="text-xs font-mono text-darkbrown-800 mt-1 font-bold">
                  PIN: {addr.pinCode} &bull; Ph: +91 {addr.phone}
                </p>

                <div className="mt-3 pt-3 border-t border-cream-200 flex items-center justify-between">
                  {!addr.isDefault ? (
                    <button
                      onClick={() => handleSetDefaultAddress(addr.id)}
                      className="text-[11px] font-bold text-magizh-800 hover:underline"
                    >
                      Set as Default
                    </button>
                  ) : (
                    <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Default
                    </span>
                  )}
                  <button
                    onClick={() => handleDeleteAddress(addr.id)}
                    className="text-[11px] font-bold text-red-600 hover:text-red-800 flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      {showEditProfileModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-cream-300 max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-base font-extrabold text-darkbrown-900 border-b border-cream-200 pb-3">
              Edit Customer Profile
            </h3>
            {profileMsg && (
              <div
                className={`p-3 rounded-xl text-xs font-bold mt-3 ${
                  profileMsg.type === 'success' ? 'bg-emerald-100 text-emerald-900' : 'bg-red-100 text-red-900'
                }`}
              >
                {profileMsg.text}
              </div>
            )}
            <form onSubmit={handleSaveProfile} className="space-y-3 mt-4 text-xs">
              <div>
                <label className="block font-bold text-darkbrown-900 mb-1">Full Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full p-2.5 bg-cream-50 border border-cream-300 rounded-xl font-medium focus:ring-2 focus:ring-magizh-700"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-darkbrown-900 mb-1">Mobile Number</label>
                <input
                  type="text"
                  maxLength={10}
                  value={editMobile}
                  onChange={(e) => setEditMobile(e.target.value)}
                  className="w-full p-2.5 bg-cream-50 border border-cream-300 rounded-xl font-medium focus:ring-2 focus:ring-magizh-700"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-darkbrown-900 mb-1">Email Address</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full p-2.5 bg-cream-50 border border-cream-300 rounded-xl font-medium focus:ring-2 focus:ring-magizh-700"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-darkbrown-900 mb-1">Profile Photo URL (Optional)</label>
                <input
                  type="url"
                  value={editPhoto}
                  onChange={(e) => setEditPhoto(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  className="w-full p-2.5 bg-cream-50 border border-cream-300 rounded-xl font-medium focus:ring-2 focus:ring-magizh-700"
                />
              </div>
              <div className="flex gap-2 pt-3 border-t border-cream-200">
                <button
                  type="button"
                  onClick={() => setShowEditProfileModal(false)}
                  className="flex-1 py-2.5 bg-cream-100 hover:bg-cream-200 text-darkbrown-800 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingProfile}
                  className="flex-1 py-2.5 bg-magizh-800 hover:bg-magizh-900 text-white rounded-xl font-bold disabled:opacity-50"
                >
                  {isSubmittingProfile ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showChangePasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-cream-300 max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-base font-extrabold text-darkbrown-900 border-b border-cream-200 pb-3">
              Change Account Password
            </h3>
            {passwordMsg && (
              <div
                className={`p-3 rounded-xl text-xs font-bold mt-3 ${
                  passwordMsg.type === 'success' ? 'bg-emerald-100 text-emerald-900' : 'bg-red-100 text-red-900'
                }`}
              >
                {passwordMsg.text}
              </div>
            )}
            <form onSubmit={handleChangePassword} className="space-y-3 mt-4 text-xs">
              <div>
                <label className="block font-bold text-darkbrown-900 mb-1">Current Password</label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full p-2.5 bg-cream-50 border border-cream-300 rounded-xl font-medium focus:ring-2 focus:ring-magizh-700"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-darkbrown-900 mb-1">New Password (min 6 characters)</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full p-2.5 bg-cream-50 border border-cream-300 rounded-xl font-medium focus:ring-2 focus:ring-magizh-700"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-darkbrown-900 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="w-full p-2.5 bg-cream-50 border border-cream-300 rounded-xl font-medium focus:ring-2 focus:ring-magizh-700"
                  required
                />
              </div>
              <div className="flex gap-2 pt-3 border-t border-cream-200">
                <button
                  type="button"
                  onClick={() => setShowChangePasswordModal(false)}
                  className="flex-1 py-2.5 bg-cream-100 hover:bg-cream-200 text-darkbrown-800 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPassword}
                  className="flex-1 py-2.5 bg-magizh-800 hover:bg-magizh-900 text-white rounded-xl font-bold disabled:opacity-50"
                >
                  {isSubmittingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Address Modal with All-India PIN Code Lookup */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-cream-300 max-w-lg w-full p-5 sm:p-6 shadow-2xl my-8">
            <h3 className="text-base font-extrabold text-darkbrown-900 border-b border-cream-200 pb-3 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-magizh-700" />
              <span>Add New Delivery Address</span>
            </h3>

            {formError && (
              <div className="mt-3 p-3 bg-red-100 border border-red-300 text-red-900 rounded-xl text-xs font-bold">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveNewAddress} className="space-y-3 mt-4 text-xs">
              {/* Address Type Selection */}
              <div>
                <label className="block font-bold text-darkbrown-900 mb-1">Address Type</label>
                <div className="flex gap-2">
                  {(['Home', 'Work', 'Other'] as AddressType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setAddressType(type)}
                      className={`flex-1 py-2 rounded-xl font-bold border transition-all flex items-center justify-center gap-1.5 ${
                        addressType === type
                          ? 'bg-magizh-800 text-white border-magizh-900'
                          : 'bg-cream-50 text-darkbrown-800 border-cream-300 hover:bg-cream-100'
                      }`}
                    >
                      {type === 'Home' && <Home className="w-3.5 h-3.5" />}
                      {type === 'Work' && <Briefcase className="w-3.5 h-3.5" />}
                      {type === 'Other' && <Building className="w-3.5 h-3.5" />}
                      <span>{type}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Recipient Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-darkbrown-900 mb-1">Recipient Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ramanathan V"
                    className="w-full p-2.5 bg-cream-50 border border-cream-300 rounded-xl font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-darkbrown-900 mb-1">Contact Phone (10 digits) *</label>
                  <input
                    type="tel"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="10-digit mobile"
                    className="w-full p-2.5 bg-cream-50 border border-cream-300 rounded-xl font-medium"
                    required
                  />
                </div>
              </div>

              {/* Indian PIN Code Lookup */}
              <div>
                <label className="block font-bold text-darkbrown-900 mb-1">
                  Postal PIN Code (6 digits) *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    maxLength={6}
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 600020 or 641002"
                    className="w-full p-2.5 bg-cream-50 border border-cream-300 rounded-xl font-mono font-bold text-darkbrown-900"
                    required
                  />
                  {pinLoading && (
                    <span className="absolute right-3 top-3 text-[10px] font-bold text-magizh-700 animate-pulse">
                      Looking up...
                    </span>
                  )}
                </div>
                {pinLookupSource && (
                  <p className="text-[10px] text-emerald-700 font-bold mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Auto-detected: {district}, {state} ({pinLookupSource})</span>
                  </p>
                )}
              </div>

              {/* Auto-filled District & State */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-darkbrown-900 mb-1">District / Region *</label>
                  <input
                    type="text"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    placeholder="District"
                    className="w-full p-2.5 bg-cream-100 border border-cream-300 rounded-xl font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-darkbrown-900 mb-1">State / UT *</label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="State"
                    className="w-full p-2.5 bg-cream-100 border border-cream-300 rounded-xl font-medium"
                    required
                  />
                </div>
              </div>

              {/* Post Office Dropdown */}
              {postOffices.length > 0 && (
                <div>
                  <label className="block font-bold text-darkbrown-900 mb-1">Select Delivery Post Office</label>
                  <select
                    value={selectedPostOffice}
                    onChange={(e) => setSelectedPostOffice(e.target.value)}
                    className="w-full p-2.5 bg-cream-50 border border-cream-300 rounded-xl font-medium"
                  >
                    {postOffices.map((po) => (
                      <option key={po} value={po}>
                        {po}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Door No & Street */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-darkbrown-900 mb-1">Door / Flat / House No *</label>
                  <input
                    type="text"
                    value={doorNo}
                    onChange={(e) => setDoorNo(e.target.value)}
                    placeholder="e.g. Plot 42, Flat 3B"
                    className="w-full p-2.5 bg-cream-50 border border-cream-300 rounded-xl font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-darkbrown-900 mb-1">Street / Road Name *</label>
                  <input
                    type="text"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    placeholder="e.g. 7th Cross Street, Gandhinagar"
                    className="w-full p-2.5 bg-cream-50 border border-cream-300 rounded-xl font-medium"
                    required
                  />
                </div>
              </div>

              {/* Area & Landmark */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-darkbrown-900 mb-1">Area / Locality</label>
                  <input
                    type="text"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder="e.g. Adyar"
                    className="w-full p-2.5 bg-cream-50 border border-cream-300 rounded-xl font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-darkbrown-900 mb-1">Landmark (Optional)</label>
                  <input
                    type="text"
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    placeholder="e.g. Near Aavin Booth"
                    className="w-full p-2.5 bg-cream-50 border border-cream-300 rounded-xl font-medium"
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex gap-2 pt-3 border-t border-cream-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 bg-cream-100 hover:bg-cream-200 text-darkbrown-800 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-magizh-800 hover:bg-magizh-900 text-white rounded-xl font-bold shadow-md"
                >
                  Save Address
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
