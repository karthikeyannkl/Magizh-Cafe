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
} from 'lucide-react';
import { StorageService } from '../../services/storage';
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
  const [showAddModal, setShowAddModal] = useState(false);

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

  const fetchPendingBills = async () => {
    if (!currentUser.id) return;
    try {
      const res = await fetch(`/api/customer/pending-bills?customerId=${currentUser.id}`);
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
            setPinLookupSource(data.source || 'verified');
          } else {
            setFormError(data.error || 'Invalid Indian PIN code.');
          }
        })
        .catch(() => {
          setPinLoading(false);
        });
    } else {
      setPostOffices([]);
      setPinLookupSource(null);
    }
  }, [pinCode]);

  const handleSetDefault = (id: string) => {
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
    setFormError('');

    if (!doorNo.trim()) {
      setFormError('Please enter Door / Flat / House number.');
      return;
    }
    if (!street.trim()) {
      setFormError('Please enter Street / Road name.');
      return;
    }
    if (!/^\d{6}$/.test(pinCode.trim())) {
      setFormError('Please enter a valid 6-digit PIN code.');
      return;
    }
    if (!district.trim()) {
      setFormError('Please ensure District is identified via PIN code.');
      return;
    }

    const compiledAddressLine = [
      doorNo.trim(),
      street.trim(),
      area.trim(),
      selectedPostOffice ? `PO: ${selectedPostOffice}` : null,
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
      city: city || district,
      district: district.trim(),
      state: state.trim() || 'Tamil Nadu',
      pinCode: pinCode.trim(),
      landmark: landmark.trim(),
      addressType,
      isDefault: addresses.length === 0,
    };

    const updated = [...addresses, created];
    setAddresses(updated);
    const updatedUser = { ...currentUser, addresses: updated };
    StorageService.saveUser(updatedUser);
    setCurrentUser(updatedUser);

    // Reset form
    setDoorNo('');
    setStreet('');
    setArea('');
    setPinCode('');
    setLandmark('');
    setShowAddModal(false);
  };

  // Customer Selects Payment Method for In-Store Bill
  const handleSelectPaymentMethod = async (billId: string, method: 'cash' | 'upi') => {
    try {
      const res = await fetch(`/api/customer/bills/${billId}/select-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethod: method }),
      });
      const data = await res.json();
      if (res.ok) {
        setBillNotice(
          method === 'cash'
            ? 'Selected CASH. Please pay physical cash to the partner shop merchant.'
            : 'Selected UPI / GPay. Opening your installed UPI payment app...'
        );
        fetchPendingBills();

        if (method === 'upi' && data.upiDeepLink) {
          // Trigger UPI app launch on mobile
          window.location.href = data.upiDeepLink;
        }

        setTimeout(() => setBillNotice(null), 5000);
      }
    } catch {
      setBillNotice('Failed to submit payment selection.');
    }
  };

  // Secure Customer Logout
  const handleLogout = () => {
    StorageService.logout();
    onOpenAuth(); // Redirects to Customer Login
  };

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 pb-28 space-y-6">
      {/* Profile Header Card */}
      <div className="bg-white rounded-3xl border border-cream-300 p-5 sm:p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-magizh-700 to-magizh-900 text-white flex items-center justify-center font-extrabold text-2xl shadow-md shrink-0">
            {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'M'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-darkbrown-900">
                {currentUser.name || 'Magizh Customer'}
              </h1>
              <span className="text-[10px] font-bold text-magizh-800 bg-magizh-100 px-2 py-0.5 rounded-full capitalize">
                {currentUser.role}
              </span>
            </div>
            <p className="text-xs text-gray-500 font-mono mt-0.5">
              Customer Code: <span className="font-bold text-darkbrown-900">{currentUser.customerCode}</span>
            </p>
            <p className="text-xs text-gray-600 mt-0.5">
              +91 {currentUser.mobile} &bull; Email: <span className="text-gray-800">{currentUser.email || 'Registered'}</span>
            </p>
          </div>
        </div>

        {/* Action Controls: Clearly Visible Logout */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 hover:text-red-800 rounded-xl text-xs font-black border border-red-200 transition-all flex items-center gap-1.5 shadow-2xs"
            title="Log out of this customer account securely"
          >
            <LogOut className="w-4 h-4 text-red-600" />
            <span>Logout</span>
          </button>
        </div>
      </div>

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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-cream-50 p-3 rounded-xl border border-cream-200 text-center">
                  <div>
                    <span className="text-[10px] text-gray-500 block font-bold uppercase">Original Bill</span>
                    <span className="font-black text-darkbrown-900 text-sm">₹{bill.originalBillAmount}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-b5-700 block font-bold uppercase">Coins Used</span>
                    <span className="font-black text-b5-700 text-sm">-{bill.coinsToRedeem} B5</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-emerald-700 block font-bold uppercase">Discount</span>
                    <span className="font-black text-emerald-700 text-sm">-₹{bill.discountAmount}</span>
                  </div>
                  <div className="bg-amber-100/70 p-1.5 rounded-lg border border-amber-200">
                    <span className="text-[10px] text-amber-900 block font-black uppercase">Net Payable</span>
                    <span className="font-black text-magizh-900 text-base">₹{bill.payableAmount}</span>
                  </div>
                </div>

                {/* Payment Selection Options (Only 2 choices: Cash or UPI/GPay) */}
                {bill.status === 'PENDING_CUSTOMER_APPROVAL' && (
                  <div className="pt-2 border-t border-cream-200 space-y-2">
                    <span className="text-[11px] font-black text-darkbrown-900 block uppercase tracking-tight">
                      Select Payment Method to Complete In-Store Purchase:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleSelectPaymentMethod(bill.id, 'cash')}
                        className="p-3 bg-cream-100 hover:bg-cream-200 border-2 border-cream-300 rounded-xl text-darkbrown-900 font-extrabold text-xs flex items-center justify-center gap-2 transition-all"
                      >
                        <Coins className="w-4 h-4 text-amber-700" />
                        <span>A. Pay with CASH (₹{bill.payableAmount})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSelectPaymentMethod(bill.id, 'upi')}
                        className="p-3 bg-gradient-to-r from-blue-700 to-indigo-800 hover:from-blue-800 hover:to-indigo-900 text-white rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition-all"
                      >
                        <QrCode className="w-4 h-4 text-blue-200" />
                        <span>B. Pay via UPI / GPay (₹{bill.payableAmount})</span>
                      </button>
                    </div>
                  </div>
                )}

                {bill.status === 'CUSTOMER_SELECTED_CASH' && (
                  <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>You selected CASH. Please hand ₹{bill.payableAmount} to the shop merchant. Merchant will confirm payment.</span>
                  </div>
                )}

                {bill.status === 'CUSTOMER_SELECTED_UPI' && (
                  <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-blue-900 text-xs font-semibold space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-blue-700 shrink-0" />
                      <span>
                        You selected UPI. Merchant UPI ID: <strong className="font-mono">{bill.merchantUpiId}</strong>
                      </span>
                    </div>
                    <a
                      href={`upi://pay?pa=${bill.merchantUpiId}&pn=${encodeURIComponent(bill.partnerName)}&am=${bill.payableAmount}&tn=${encodeURIComponent(`Bill-${bill.billNumber}`)}&cu=INR`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-800 hover:bg-blue-900 text-white rounded-lg text-xs font-bold shadow-2xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Reopen UPI Payment App</span>
                    </a>
                  </div>
                )}

                {bill.status === 'PENDING_ADMIN_APPROVAL' && (
                  <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Partner confirmed payment received. Awaiting Admin verification before finalizing coin deduction.</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Action Navigation Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={onNavigateOrders}
          className="p-4 bg-white rounded-2xl border border-cream-300 hover:border-magizh-400 shadow-2xs hover:shadow-soft transition-all text-left flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-xl bg-magizh-100 text-magizh-800 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-black text-darkbrown-900 block">Order History</span>
            <span className="text-[11px] text-gray-500">Track shipments & deliveries</span>
          </div>
        </button>

        <button
          onClick={onNavigateWallet}
          className="p-4 bg-white rounded-2xl border border-cream-300 hover:border-b5-400 shadow-2xs hover:shadow-soft transition-all text-left flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-xl bg-b5-100 text-b5-800 flex items-center justify-center shrink-0">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-black text-darkbrown-900 block">B5 Coin Wallet</span>
            <span className="text-[11px] text-gray-500">Balance, ledger & redemption</span>
          </div>
        </button>

        <button
          onClick={onNavigateReferral}
          className="p-4 bg-white rounded-2xl border border-cream-300 hover:border-purple-400 shadow-2xs hover:shadow-soft transition-all text-left flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center shrink-0">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-black text-darkbrown-900 block">Referral & Level 1–7</span>
            <span className="text-[11px] text-gray-500">Earn coins & climb ranks</span>
          </div>
        </button>
      </div>

      {/* Address Book Management */}
      <div className="bg-white rounded-3xl border border-cream-300 p-5 sm:p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-cream-200 pb-3">
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-darkbrown-900">
              Saved Delivery Addresses
            </h2>
            <p className="text-xs text-gray-500">
              Nationwide delivery across all Indian PIN codes with PIN code auto-lookup
            </p>
          </div>
          <button
            onClick={() => {
              setFormError('');
              setShowAddModal(true);
            }}
            className="px-3.5 py-2 bg-magizh-800 hover:bg-magizh-900 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add New Address</span>
          </button>
        </div>

        {addresses.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">No saved addresses</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {addresses.map((addr) => (
              <div
                key={addr.id}
                className="p-4 rounded-2xl border border-cream-300 bg-cream-50/40 relative space-y-1.5 text-xs shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-darkbrown-900">{addr.name}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cream-200 text-darkbrown-800">
                      {addr.addressType || 'Home'}
                    </span>
                  </div>
                  {addr.isDefault ? (
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Default
                    </span>
                  ) : (
                    <button
                      onClick={() => handleSetDefault(addr.id)}
                      className="text-[10px] font-bold text-magizh-800 hover:underline"
                    >
                      Set Default
                    </button>
                  )}
                </div>

                <p className="text-gray-500 font-mono text-[11px]">Phone: +91 {addr.phone}</p>
                <p className="text-gray-700 leading-snug">{addr.addressLine}</p>
                <p className="text-gray-600 font-medium">
                  {addr.district}, {addr.state} - <span className="font-mono font-bold text-darkbrown-900">{addr.pinCode}</span>
                </p>
                {addr.landmark && (
                  <p className="text-gray-500 text-[11px]">Landmark: {addr.landmark}</p>
                )}

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => handleDeleteAddress(addr.id)}
                    className="text-red-500 hover:text-red-700 p-1 transition-colors"
                    title="Delete Address"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Address Modal with All-India PIN Code Lookup */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-darkbrown-950/60 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-cream-300 w-full max-w-lg p-5 sm:p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-cream-200 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-black text-darkbrown-900">
                  Add Delivery Address
                </h3>
                <p className="text-[11px] text-gray-500">
                  Full India PIN Code Lookup & Local Area Selection
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                &times;
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveNewAddress} className="space-y-3.5 text-xs">
              {/* Address Type Selector */}
              <div>
                <label className="block font-bold text-darkbrown-800 mb-1.5">
                  Address Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Home', 'Work', 'Other'] as AddressType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setAddressType(type)}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        addressType === type
                          ? 'bg-magizh-800 text-white border-magizh-800 shadow-2xs'
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-darkbrown-800 mb-1">
                    Contact Full Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full p-2.5 bg-cream-50 border border-cream-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-magizh-700 font-medium"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-darkbrown-800 mb-1">
                    Mobile Number (10 Digits) *
                  </label>
                  <input
                    type="tel"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full p-2.5 bg-cream-50 border border-cream-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-magizh-700 font-mono font-medium"
                    required
                  />
                </div>
              </div>

              {/* PIN Code with Live India Lookup */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-darkbrown-800">
                    Indian Postal PIN Code (6 Digits) *
                  </label>
                  {pinLoading && (
                    <span className="text-[10px] text-magizh-800 font-bold animate-pulse">
                      Looking up Indian postal database...
                    </span>
                  )}
                  {pinLookupSource && (
                    <span className="text-[10px] text-emerald-700 font-bold">
                      ✓ Validated: {district}, {state}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  maxLength={6}
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 6-digit PIN (e.g. 600020, 560001, 400001, 110001)"
                  className="w-full p-2.5 bg-cream-50 border border-cream-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-magizh-700 font-mono font-bold text-darkbrown-900"
                  required
                />
              </div>

              {/* Post Office / Locality Selection */}
              {postOffices.length > 0 && (
                <div>
                  <label className="block font-semibold text-darkbrown-800 mb-1">
                    Select Post Office / Locality
                  </label>
                  <select
                    value={selectedPostOffice}
                    onChange={(e) => setSelectedPostOffice(e.target.value)}
                    className="w-full p-2.5 bg-cream-50 border border-cream-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-magizh-700 font-medium"
                  >
                    {postOffices.map((po) => (
                      <option key={po} value={po}>
                        {po}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-darkbrown-800 mb-1">District / City</label>
                  <input
                    type="text"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    placeholder="Auto-detected or enter district"
                    className="w-full p-2.5 bg-cream-50 border border-cream-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-magizh-700"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-darkbrown-800 mb-1">State</label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full p-2.5 bg-cream-50 border border-cream-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-magizh-700"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-darkbrown-800 mb-1">
                  Door No. / Flat No. / Building Name *
                </label>
                <input
                  type="text"
                  value={doorNo}
                  onChange={(e) => setDoorNo(e.target.value)}
                  placeholder="e.g. Flat 4B, Emerald Green Apartments"
                  className="w-full p-2.5 bg-cream-50 border border-cream-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-magizh-700"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-darkbrown-800 mb-1">
                  Street / Road & Area *
                </label>
                <input
                  type="text"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="e.g. 1st Cross, Gandhi Nagar, Adyar"
                  className="w-full p-2.5 bg-cream-50 border border-cream-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-magizh-700"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-darkbrown-800 mb-1">
                  Landmark (Optional)
                </label>
                <input
                  type="text"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  placeholder="e.g. Near Gandhi Nagar Club / Opposite Bank"
                  className="w-full p-2.5 bg-cream-50 border border-cream-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-magizh-700"
                />
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-cream-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 bg-cream-100 hover:bg-cream-200 text-darkbrown-800 rounded-xl font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-magizh-800 hover:bg-magizh-900 text-white rounded-xl font-black shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4 text-amber-300" />
                  <span>Save Delivery Address</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
