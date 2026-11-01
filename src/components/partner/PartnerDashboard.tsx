import React, { useState, useEffect } from 'react';
import {
  Store,
  Package,
  TrendingUp,
  Coins,
  CheckCircle2,
  Clock,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Plus,
  Edit2,
  DollarSign,
  UserCheck,
  Receipt,
  Search,
  Printer,
  X,
  CreditCard,
  QrCode,
  Sparkles,
  LogOut,
  Loader2,
  XCircle,
} from 'lucide-react';
import { StorageService, subscribe } from '../../services/storage';
import { PartnerShop, Order, Product, User, PartnerLocalTransaction, PartnerBill } from '../../types';

export const PartnerDashboard: React.FC = () => {
  const currentUser: User = StorageService.getCurrentUser();
  const partners: PartnerShop[] = StorageService.getPartners();

  // Find matching partner or default to first partner
  const [activePartner, setActivePartner] = useState<PartnerShop>(
    partners.find((p) => p.mobile === currentUser.mobile || p.ownerName === currentUser.name) || partners[0]
  );

  const [orders, setOrders] = useState<Order[]>(StorageService.getOrders());
  const [products, setProducts] = useState<Product[]>(StorageService.getProducts());
  const [localTxs, setLocalTxs] = useState<PartnerLocalTransaction[]>(
    StorageService.getPartnerLocalTransactions(activePartner.id)
  );

  const [activeTab, setActiveTab] = useState<
    'overview' | 'orders' | 'inventory' | 'settlement' | 'instore'
  >('instore');
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Server-backed bills state
  const [serverBills, setServerBills] = useState<PartnerBill[]>([]);
  const [isLoadingBills, setIsLoadingBills] = useState(false);
  const [isLookingUpCustomer, setIsLookingUpCustomer] = useState(false);
  const [customerLookupError, setCustomerLookupError] = useState<string | null>(null);
  const [isSubmittingBill, setIsSubmittingBill] = useState(false);
  const [confirmingPaymentId, setConfirmingPaymentId] = useState<string | null>(null);

  // In-Store Billing POS State
  const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<PartnerLocalTransaction | null>(null);

  const [posCustomerPhone, setPosCustomerPhone] = useState('');
  const [posCustomer, setPosCustomer] = useState<any | null>(null);
  const [posCustomerCoins, setPosCustomerCoins] = useState<number>(0);
  const [posItems, setPosItems] = useState<Array<{ id: number; name: string; quantity: number; price: number }>>([
    { id: 1, name: '', quantity: 1, price: 0 },
  ]);
  const posBillAmount = posItems.reduce((sum, item) => sum + Math.max(0, item.quantity) * Math.max(0, item.price), 0);
  const posSummary = posItems
    .filter((item) => item.name.trim() && item.quantity > 0 && item.price > 0)
    .map((item) => `${item.name.trim()} × ${item.quantity} @ ₹${item.price}`)
    .join(', ');
  const [posError, setPosError] = useState<string | null>(null);

  const loadServerBills = () => {
    setIsLoadingBills(true);
    fetch(`/api/partners/${activePartner.id}/bills`)
      .then((r) => r.json())
      .then((data) => {
        setIsLoadingBills(false);
        if (data.success && Array.isArray(data.bills)) {
          setServerBills(data.bills);
        }
      })
      .catch(() => setIsLoadingBills(false));
  };

  useEffect(() => {
    loadServerBills();
  }, [activePartner.id]);

  useEffect(() => {
    const unsub = subscribe('partnersChanged', (updatedPartners: PartnerShop[]) => {
      const current = updatedPartners.find((p) => p.id === activePartner.id) || updatedPartners[0];
      setActivePartner(current);
    });
    const unsubOrders = subscribe('ordersChanged', (updatedOrders: Order[]) => {
      setOrders(updatedOrders);
    });
    const unsubTxs = subscribe('partnerLocalTransactionsChanged', () => {
      setLocalTxs(StorageService.getPartnerLocalTransactions(activePartner.id));
    });

    return () => {
      unsub();
      unsubOrders();
      unsubTxs();
    };
  }, [activePartner.id]);

  // Lookup customer via real backend API
  const handleLookupCustomer = async () => {
    const cleaned = posCustomerPhone.trim();
    if (cleaned.length < 10) {
      setCustomerLookupError('Please enter a 10-digit mobile number.');
      return;
    }
    setIsLookingUpCustomer(true);
    setCustomerLookupError(null);
    try {
      const res = await fetch(`/api/partners/customer-lookup?mobile=${encodeURIComponent(cleaned)}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setCustomerLookupError(data.error || 'No Magizh customer account found with this mobile number.');
        setPosCustomer(null);
        setPosCustomerCoins(0);
      } else {
        setPosCustomer(data.customer);
        setPosCustomerCoins(data.customer.coinBalance || 0);
      }
    } catch (err: any) {
      setCustomerLookupError(err.message || 'Error looking up customer.');
    } finally {
      setIsLookingUpCustomer(false);
    }
  };

  const handlePartnerLogout = () => {
    StorageService.logout('partner');
    window.location.href = '/partner';
  };

  const handleConfirmPaymentReceived = async (billId: string) => {
    setConfirmingPaymentId(billId);
    try {
      const res = await fetch(`/api/partners/bills/${billId}/confirm-payment-received`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnerId: activePartner.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || 'Failed to confirm payment received.');
      } else {
        setStatusNotice(`Payment received for Bill #${data.bill.billNumber}! Submitted for Admin approval.`);
        loadServerBills();
        setTimeout(() => setStatusNotice(null), 4000);
      }
    } catch (err: any) {
      alert(err.message || 'Network error.');
    } finally {
      setConfirmingPaymentId(null);
    }
  };

  // Partner orders (routed or assigned to this partner)
  const partnerOrders = orders.filter((o) => !o.partnerId || o.partnerId === activePartner.id);

  const handleUpdateOrderStatus = (orderId: string, nextStatus: any) => {
    StorageService.updateOrderStatus(orderId, nextStatus, `Updated by Partner Shop: ${activePartner.shopName}`);
    setStatusNotice(`Order status advanced to "${nextStatus}"`);
    setTimeout(() => setStatusNotice(null), 3000);
  };

  const handleUpdateSpecialOffer = (e: React.FormEvent) => {
    e.preventDefault();
    StorageService.savePartner(activePartner);
    setStatusNotice('Partner B5 Coin promotional multiplier saved successfully!');
    setTimeout(() => setStatusNotice(null), 3000);
  };

  // Process POS In-Store Transaction via server endpoint
  const handleProcessInStoreTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setPosError(null);

    if (!posCustomer) {
      setPosError('Please verify customer by mobile number first.');
      return;
    }

    const validItems = posItems.filter((item) =>
      item.name.trim() && Number.isFinite(item.quantity) && item.quantity > 0 &&
      Number.isFinite(item.price) && item.price > 0
    );
    if (validItems.length === 0 || posBillAmount <= 0 || validItems.length !== posItems.length) {
      setPosError('Add a valid item name, quantity and price for every bill row.');
      return;
    }

    setIsSubmittingBill(true);

    try {
      const res = await fetch('/api/partners/bills/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerId: activePartner.id,
          customerMobile: posCustomer.mobile,
          customerName: posCustomer.name,
          billSummary: posSummary,
          billAmount: posBillAmount,
          coinsToRedeem: 0,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setPosError(data.error || 'Failed to create in-store bill.');
        setIsSubmittingBill(false);
        return;
      }

      setIsBillingModalOpen(false);
      setPosItems([{ id: Date.now(), name: '', quantity: 1, price: 0 }]);
      setPosCustomer(null);
      setPosCustomerPhone('');
      setStatusNotice(`Bill #${data.bill.billNumber} created! Sent to customer for in-store payment selection.`);
      loadServerBills();
      setActiveTab('instore');
      setTimeout(() => setStatusNotice(null), 5000);
    } catch (err: any) {
      setPosError(err.message || 'Failed to process transaction');
    } finally {
      setIsSubmittingBill(false);
    }
  };

  // Customer chooses coin redemption and Cash / UPI inside their own Magizh app.

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 pb-28 space-y-6">
      {/* Partner Header Strip */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-950 text-white rounded-3xl p-5 sm:p-6 shadow-card border border-blue-700/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/20 shrink-0">
              <Store className="w-7 h-7 text-blue-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-extrabold">{activePartner.shopName}</h1>
                <span
                  className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase ${
                    activePartner.status === 'approved'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                  }`}
                >
                  {activePartner.status}
                </span>
              </div>
              <p className="text-xs text-blue-200 mt-0.5">
                Owner: {activePartner.ownerName} &bull; ID: <span className="font-mono font-bold text-white">{activePartner.partnerCode}</span>
              </p>
              <p className="text-[11px] text-blue-300">
                {activePartner.address}, {activePartner.district} - {activePartner.pinCode}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
            <button
              onClick={() => setIsBillingModalOpen(true)}
              className="px-4 py-2 bg-gradient-to-r from-b5-500 to-amber-500 hover:from-b5-600 hover:to-amber-600 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
            >
              <Receipt className="w-4 h-4" />
              <span>New Bill Entry</span>
            </button>

            <button
              onClick={handlePartnerLogout}
              className="px-3 py-2 bg-white/10 hover:bg-rose-700/80 text-white font-bold text-xs rounded-xl border border-white/20 transition-all flex items-center gap-1.5 shadow-xs"
              title="Sign out of Partner Portal"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>

            <div className="bg-black/30 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10 text-right">
              <span className="text-[10px] text-blue-300 block font-bold uppercase">Commission Rate</span>
              <span className="text-sm font-black text-white">{activePartner.commissionRate}%</span>
            </div>
            <div className="bg-black/30 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10 text-right">
              <span className="text-[10px] text-amber-300 block font-bold uppercase">B5 Bonus</span>
              <span className="text-sm font-black text-amber-400">{activePartner.specialCoinBonusMultiplier}x</span>
            </div>
          </div>
        </div>
      </div>

      {statusNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-2xl text-xs font-bold text-emerald-900 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{statusNotice}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-cream-300 gap-4 text-xs font-bold overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-2.5 border-b-2 transition-all shrink-0 ${
            activeTab === 'overview'
              ? 'border-blue-800 text-blue-900 font-extrabold'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          Partner Overview &amp; Sales
        </button>
        <button
          onClick={() => setActiveTab('instore')}
          className={`pb-2.5 border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
            activeTab === 'instore'
              ? 'border-blue-800 text-blue-900 font-extrabold'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>Bill Requests ({serverBills.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`pb-2.5 border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
            activeTab === 'orders'
              ? 'border-blue-800 text-blue-900 font-extrabold'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>Online Fulfillment ({partnerOrders.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          className={`pb-2.5 border-b-2 transition-all shrink-0 ${
            activeTab === 'inventory'
              ? 'border-blue-800 text-blue-900 font-extrabold'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          Store Inventory
        </button>
        <button
          onClick={() => setActiveTab('settlement')}
          className={`pb-2.5 border-b-2 transition-all shrink-0 ${
            activeTab === 'settlement'
              ? 'border-blue-800 text-blue-900 font-extrabold'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          Settlement &amp; Payout
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Key Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="bg-white p-4 rounded-2xl border border-cream-300 shadow-2xs">
              <span className="text-[11px] text-gray-500 font-bold uppercase block">Total Merchandise Sales</span>
              <span className="text-lg sm:text-xl font-black text-darkbrown-900 mt-1 block">
                ₹{activePartner.totalSales.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-emerald-700 font-bold mt-1 block">+14% this month</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-cream-300 shadow-2xs">
              <span className="text-[11px] text-gray-500 font-bold uppercase block">Commission Earned</span>
              <span className="text-lg sm:text-xl font-black text-blue-900 mt-1 block">
                ₹{activePartner.totalCommissionPaid.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-blue-600 font-bold mt-1 block">Rate: {activePartner.commissionRate}%</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-cream-300 shadow-2xs">
              <span className="text-[11px] text-gray-500 font-bold uppercase block">In-Store B5 Transactions</span>
              <span className="text-lg sm:text-xl font-black text-b5-700 mt-1 block">
                {localTxs.length}
              </span>
              <span className="text-[10px] text-gray-500 font-bold mt-1 block">1 B5 Coin = ₹1</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-cream-300 shadow-2xs">
              <span className="text-[11px] text-gray-500 font-bold uppercase block">Unsettled Payout</span>
              <span className="text-lg sm:text-xl font-black text-amber-800 mt-1 block">
                ₹{activePartner.unsettledAmount.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-amber-700 font-bold mt-1 block">Available for withdrawal</span>
            </div>
          </div>

          {/* Special Promotional Multiplier Form */}
          <div className="bg-white rounded-3xl border border-cream-300 p-5 shadow-2xs">
            <h3 className="text-sm font-extrabold text-darkbrown-900 border-b border-cream-200 pb-2 mb-3">
              Configure Store B5 Coin Multiplier &amp; Local Offer
            </h3>
            <form onSubmit={handleUpdateSpecialOffer} className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs items-end">
              <div>
                <label className="block text-gray-600 font-bold mb-1">Coin Multiplier (e.g. 1.5x, 2.0x)</label>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  max="5"
                  value={activePartner.specialCoinBonusMultiplier}
                  onChange={(e) =>
                    setActivePartner({
                      ...activePartner,
                      specialCoinBonusMultiplier: Number(e.target.value),
                    })
                  }
                  className="w-full p-2 bg-cream-50 border border-cream-300 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block text-gray-600 font-bold mb-1">Store Banner Headline</label>
                <input
                  type="text"
                  value={activePartner.shopName}
                  disabled
                  className="w-full p-2 bg-gray-100 border border-gray-300 rounded-xl text-gray-600"
                />
              </div>

              <button
                type="submit"
                className="px-4 py-2 bg-blue-800 hover:bg-blue-900 text-white rounded-xl font-bold transition-all"
              >
                Save Store Campaign
              </button>
            </form>
          </div>
        </div>
      )}

      {/* In-Store Receipts & POS Bills Tab */}
      {activeTab === 'instore' && (
        <div className="bg-white rounded-3xl border border-cream-300 p-5 shadow-2xs space-y-4 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cream-200 pb-3">
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-darkbrown-900 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-b5-600" />
                <span>Partner Bills &amp; Customer Requests</span>
              </h3>
              <p className="text-xs text-gray-500">
                50% Coin Redemption Cap &bull; Customer In-Store Approval &bull; Admin Verification
              </p>
            </div>
            <button
              onClick={() => setIsBillingModalOpen(true)}
              className="px-4 py-2 bg-gradient-to-r from-b5-600 to-amber-600 hover:from-b5-700 hover:to-amber-700 text-white rounded-xl text-xs font-black shadow-sm transition-all flex items-center gap-1.5 self-start"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Bill Entry</span>
            </button>
          </div>

          {isLoadingBills ? (
            <div className="text-center py-10 text-xs text-gray-500 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />
              <span>Loading store bills...</span>
            </div>
          ) : serverBills.length === 0 && localTxs.length === 0 ? (
            <div className="text-center py-10">
              <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-500">No in-store transactions recorded yet.</p>
              <button
                onClick={() => setIsBillingModalOpen(true)}
                className="mt-3 px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold"
              >
                Create First Bill
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {serverBills.map((bill) => (
                <div
                  key={bill.id}
                  className="p-4 border border-cream-300 rounded-2xl bg-cream-50/40 text-xs space-y-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-sm text-darkbrown-900 font-mono">
                        #{bill.billNumber}
                      </span>

                      {/* Status Badges */}
                      {bill.status === 'PENDING_CUSTOMER_APPROVAL' && (
                        <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-amber-300 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-600" />
                          <span>Waiting for Customer Choice</span>
                        </span>
                      )}
                      {['PAYMENT_CONFIRMED_BY_CUSTOMER', 'CUSTOMER_SELECTED_CASH', 'CUSTOMER_SELECTED_UPI'].includes(bill.status) && (
                        <span className="bg-blue-100 text-blue-900 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-blue-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-blue-600" />
                          <span>Customer Selected {(bill.customerPaymentChoice || bill.status.replace('CUSTOMER_SELECTED_', '')).toUpperCase()} &mdash; Collect Payment</span>
                        </span>
                      )}
                      {bill.status === 'PENDING_ADMIN_APPROVAL' && (
                        <span className="bg-indigo-100 text-indigo-900 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-indigo-300 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-indigo-600" />
                          <span>Payment Received &bull; Awaiting Admin Approval</span>
                        </span>
                      )}
                      {bill.status === 'COMPLETED' && (
                        <span className="bg-emerald-100 text-emerald-900 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Approved &bull; Coins Deducted ({bill.receiptNumber})</span>
                        </span>
                      )}
                      {bill.status === 'REJECTED' && (
                        <span className="bg-rose-100 text-rose-900 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-rose-300 flex items-center gap-1">
                          <XCircle className="w-3 h-3 text-rose-600" />
                          <span>Rejected by Admin (0 Coins Deducted)</span>
                        </span>
                      )}
                    </div>

                    <p className="text-gray-700">
                      Customer: <strong className="text-darkbrown-900">{bill.customerName}</strong> ({bill.customerPhone})
                    </p>

                    {bill.itemsSummary && (
                      <p className="text-[11px] text-gray-600 italic">
                        "{bill.itemsSummary}"
                      </p>
                    )}

                    <p className="text-[10px] text-gray-400 font-mono">
                      {new Date(bill.createdAt).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex sm:flex-col sm:items-end justify-between items-center gap-2 pt-2 sm:pt-0 border-t sm:border-0 border-cream-200">
                    <div className="text-right">
                      <div className="font-black text-sm text-magizh-900">
                        Total: ₹{bill.billAmount}
                      </div>
                      <div className="text-[11px] text-amber-700 font-bold">
                        B5 Coins: -{bill.coinsToRedeem} (₹{bill.coinsToRedeem})
                      </div>
                      <div className="text-xs font-black text-darkbrown-900">
                        Payable: ₹{bill.payableAmount}
                      </div>
                    </div>

                    {/* Partner marks payment received after checking cash / UPI credit in person */}
                    {['PAYMENT_CONFIRMED_BY_CUSTOMER', 'CUSTOMER_SELECTED_CASH', 'CUSTOMER_SELECTED_UPI'].includes(bill.status) && (
                      <button
                        onClick={() => handleConfirmPaymentReceived(bill.id)}
                        disabled={confirmingPaymentId === bill.id}
                        className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                      >
                        {confirmingPaymentId === bill.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        <span>Payment Received</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <div className="bg-white rounded-3xl border border-cream-300 p-5 shadow-2xs space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-cream-200 pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-darkbrown-900">
                Store Dispatch &amp; Fulfillment Orders
              </h3>
              <p className="text-xs text-gray-500">Advance order stages to update customer timeline</p>
            </div>
            <span className="text-xs font-mono font-bold text-gray-500">{partnerOrders.length} orders</span>
          </div>

          <div className="space-y-3">
            {partnerOrders.map((ord) => (
              <div
                key={ord.id}
                className="p-4 border border-cream-300 rounded-2xl bg-cream-50/40 text-xs space-y-2.5"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-extrabold text-darkbrown-900 text-sm">{ord.orderNumber}</span>
                    <p className="text-gray-600 text-[11px]">
                      Customer: {ord.customerName} ({ord.customerPhone})
                    </p>
                    <p className="text-gray-500 text-[10px]">{ord.shippingAddress?.addressLine}, {ord.shippingAddress?.district}</p>
                  </div>
                  <span className="bg-blue-100 text-blue-900 font-black text-[10px] px-2 py-0.5 rounded-full uppercase">
                    {ord.orderStatus}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-cream-200">
                  <span className="font-black text-magizh-900 text-xs">Total: ₹{ord.finalPayableAmount}</span>

                  <div className="flex gap-1.5">
                    {ord.orderStatus === 'Confirmed' && (
                      <button
                        onClick={() => handleUpdateOrderStatus(ord.id, 'Processing')}
                        className="px-2.5 py-1 bg-blue-700 text-white rounded-lg text-xs font-bold hover:bg-blue-800"
                      >
                        Accept &amp; Process
                      </button>
                    )}
                    {ord.orderStatus === 'Processing' && (
                      <button
                        onClick={() => handleUpdateOrderStatus(ord.id, 'Packed')}
                        className="px-2.5 py-1 bg-blue-700 text-white rounded-lg text-xs font-bold hover:bg-blue-800"
                      >
                        Mark as Packed
                      </button>
                    )}
                    {ord.orderStatus === 'Packed' && (
                      <button
                        onClick={() => handleUpdateOrderStatus(ord.id, 'Shipped')}
                        className="px-2.5 py-1 bg-indigo-700 text-white rounded-lg text-xs font-bold hover:bg-indigo-800"
                      >
                        Dispatch / Ship
                      </button>
                    )}
                    {ord.orderStatus === 'Shipped' && (
                      <button
                        onClick={() => handleUpdateOrderStatus(ord.id, 'Delivered')}
                        className="px-2.5 py-1 bg-emerald-700 text-white rounded-lg text-xs font-bold hover:bg-emerald-800"
                      >
                        Mark Delivered
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inventory Tab */}
      {activeTab === 'inventory' && (
        <div className="bg-white rounded-3xl border border-cream-300 p-5 shadow-2xs space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-cream-200 pb-3">
            <h3 className="text-sm font-extrabold text-darkbrown-900">
              Assigned Store Inventory &amp; Stock Control
            </h3>
            <span className="text-xs text-gray-500">Live store stock levels</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {products.slice(0, 9).map((prod) => (
              <div
                key={prod.id}
                className="p-3 border border-cream-300 rounded-2xl bg-cream-50/40 flex gap-3 items-center text-xs"
              >
                <img
                  src={prod.images[0]}
                  alt={prod.name}
                  className="w-14 h-14 object-cover rounded-xl bg-white shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-darkbrown-900 truncate">{prod.name}</h4>
                  <p className="text-[11px] text-gray-500">{prod.variants[0]?.weight}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-black text-magizh-900">₹{prod.variants[0]?.price}</span>
                    <span className="font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                      Stock: {prod.variants[0]?.stock}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Settlement Tab */}
      {activeTab === 'settlement' && (
        <div className="bg-white rounded-3xl border border-cream-300 p-5 shadow-2xs space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-cream-200 pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-darkbrown-900">
                Partner Settlement &amp; Payout Report
              </h3>
              <p className="text-xs text-gray-500">Automated net commission accounting</p>
            </div>
            <button
              onClick={() => alert('Payout request sent to Magizh finance desk!')}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all"
            >
              Request Payout (₹{activePartner.unsettledAmount.toLocaleString('en-IN')})
            </button>
          </div>

          <div className="p-4 bg-cream-50 rounded-2xl border border-cream-200 text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Fulfilled Merchandise:</span>
              <span className="font-bold">₹{activePartner.totalSales.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Contracted Partner Commission ({activePartner.commissionRate}%):</span>
              <span className="font-bold text-blue-900">₹{activePartner.totalCommissionPaid.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-emerald-800 font-bold pt-2 border-t border-cream-300 text-sm">
              <span>Current Unsettled Balance:</span>
              <span>₹{activePartner.unsettledAmount.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODALS ================= */}

      {/* 1. IN-STORE POS BILLING & COIN REDEMPTION MODAL */}
      {isBillingModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[calc(100dvh-24px)] overflow-y-auto p-4 sm:p-6 space-y-4 border border-cream-300 shadow-2xl my-3">
            <div className="flex justify-between items-center border-b border-cream-200 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-darkbrown-900 flex items-center gap-1.5">
                  <Receipt className="w-5 h-5 text-b5-600" />
                  <span>New Bill Entry &amp; POS</span>
                </h3>
                <p className="text-xs text-gray-500">
                  Enter purchased items and send the bill to the customer for approval and payment choice
                </p>
              </div>
              <button
                onClick={() => setIsBillingModalOpen(false)}
                className="p-1 hover:bg-cream-100 rounded-full text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {posError && (
              <div className="p-2.5 bg-red-50 border border-red-300 rounded-xl text-xs font-bold text-red-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{posError}</span>
              </div>
            )}

            <form onSubmit={handleProcessInStoreTransaction} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-gray-700 font-bold mb-1">Customer Mobile Number *</label>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    maxLength={10}
                    required
                    value={posCustomerPhone}
                    onChange={(e) => {
                      setPosCustomerPhone(e.target.value.replace(/\D/g, ''));
                      setCustomerLookupError(null);
                    }}
                    placeholder="9876543210"
                    className="flex-1 p-2.5 bg-cream-50/50 border border-cream-300 rounded-xl font-bold font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                  <button
                    type="button"
                    onClick={handleLookupCustomer}
                    disabled={isLookingUpCustomer || posCustomerPhone.trim().length < 10}
                    className="px-4 py-2.5 bg-darkbrown-900 hover:bg-darkbrown-950 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    {isLookingUpCustomer ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Search className="w-3.5 h-3.5" />
                    )}
                    <span>Verify</span>
                  </button>
                </div>

                {customerLookupError && (
                  <div className="mt-1.5 p-2 bg-rose-50 border border-rose-200 text-rose-800 text-[11px] rounded-lg flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span>{customerLookupError}</span>
                  </div>
                )}

                {posCustomer && (
                  <div className="mt-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs animate-in fade-in">
                    <div>
                      <span className="font-extrabold text-darkbrown-900 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                        <span>{posCustomer.name}</span>
                      </span>
                      <span className="text-[10px] text-gray-500 font-mono block">
                        Code: {posCustomer.customerCode || 'MAG-CUST'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-gray-500 block">Available Coins</span>
                      <span className="font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full text-xs">
                        {posCustomerCoins} B5 Coins
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <label className="block text-gray-700 font-extrabold">Purchased Items *</label>
                    <p className="text-[10px] text-gray-500">ஒவ்வொரு பொருளின் பெயர், எண்ணிக்கை, விலையை உள்ளிடுங்கள்.</p>
                  </div>
                  <button type="button"
                    onClick={() => setPosItems((items) => [...items, { id: Date.now() + items.length, name: '', quantity: 1, price: 0 }])}
                    className="shrink-0 px-3 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-[11px] font-bold flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> Add Item
                  </button>
                </div>
                {posItems.map((item, index) => (
                  <div key={item.id} className="grid grid-cols-12 gap-2 items-end p-2.5 rounded-xl border border-cream-300 bg-cream-50">
                    <div className="col-span-12 sm:col-span-5">
                      <label className="block text-[10px] font-bold text-gray-600 mb-1">Item {index + 1}</label>
                      <input type="text" value={item.name}
                        onChange={(e) => setPosItems((items) => items.map((row) => row.id === item.id ? { ...row, name: e.target.value } : row))}
                        placeholder="Product name" className="w-full min-w-0 p-2.5 bg-white border border-cream-300 rounded-lg text-xs" required />
                    </div>
                    <div className="col-span-5 sm:col-span-3">
                      <label className="block text-[10px] font-bold text-gray-600 mb-1">Qty</label>
                      <input type="number" min="1" step="1" value={item.quantity}
                        onChange={(e) => setPosItems((items) => items.map((row) => row.id === item.id ? { ...row, quantity: Math.max(1, Number(e.target.value) || 1) } : row))}
                        className="w-full min-w-0 p-2.5 bg-white border border-cream-300 rounded-lg text-xs" required />
                    </div>
                    <div className="col-span-5 sm:col-span-3">
                      <label className="block text-[10px] font-bold text-gray-600 mb-1">Unit Price (₹)</label>
                      <input type="number" min="0.01" step="0.01" value={item.price || ''}
                        onChange={(e) => setPosItems((items) => items.map((row) => row.id === item.id ? { ...row, price: Math.max(0, Number(e.target.value) || 0) } : row))}
                        placeholder="0" className="w-full min-w-0 p-2.5 bg-white border border-cream-300 rounded-lg text-xs" required />
                    </div>
                    <div className="col-span-2 sm:col-span-1 flex justify-end">
                      <button type="button" disabled={posItems.length === 1}
                        onClick={() => setPosItems((items) => items.filter((row) => row.id !== item.id))}
                        className="w-full sm:w-auto p-2.5 text-rose-600 hover:bg-rose-50 rounded-lg disabled:opacity-30"
                        aria-label={`Remove item ${index + 1}`}><X className="w-4 h-4" /></button>
                    </div>
                    <div className="col-span-12 text-right text-[11px] font-bold text-darkbrown-800">
                      Item Total: ₹{(item.quantity * item.price).toLocaleString('en-IN')}
                    </div>
                  </div>
                ))}
                <div className="flex justify-between items-center bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                  <span className="text-xs font-extrabold text-emerald-950">Bill Total</span>
                  <span className="text-lg font-black text-emerald-900">₹{posBillAmount.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="bg-cream-100/70 p-3 rounded-2xl border border-cream-300 text-xs space-y-1.5">
                <div className="flex justify-between text-gray-700">
                  <span>Bill Total:</span>
                  <span className="font-bold">₹{posBillAmount.toLocaleString('en-IN')}</span>
                </div>
                <p className="text-[11px] leading-relaxed text-gray-600">
                  Customer தனது Magizh Shopping App-ல் Bill Request பார்த்து, Coins பயன்படுத்துவது மற்றும் Cash / UPI payment முறையைத் தேர்வு செய்வார்.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-cream-200">
                <button
                  type="button"
                  onClick={() => setIsBillingModalOpen(false)}
                  className="px-4 py-2 bg-white hover:bg-cream-100 border border-cream-300 rounded-xl font-bold text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingBill || !posCustomer}
                  className="px-5 py-2.5 bg-gradient-to-r from-b5-600 to-amber-600 hover:from-b5-700 hover:to-amber-700 text-white rounded-xl font-extrabold flex items-center gap-1.5 shadow-md disabled:opacity-50 transition-all"
                >
                  {isSubmittingBill ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending to Customer...</span>
                    </>
                  ) : (
                    <>
                      <Receipt className="w-4 h-4" />
                      <span>Create Bill &amp; Send for Customer Approval</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. RECEIPT VIEW / PRINT MODAL */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 border border-cream-300 shadow-2xl text-xs font-mono">
            {/* Printable Receipt Paper Container */}
            <div className="border border-cream-300 p-5 rounded-2xl bg-cream-50/50 space-y-3">
              <div className="text-center border-b border-dashed border-gray-300 pb-3">
                <div className="w-10 h-10 bg-magizh-800 text-white font-extrabold rounded-xl mx-auto flex items-center justify-center text-lg mb-1 font-sans">
                  M
                </div>
                <h3 className="font-extrabold text-sm text-darkbrown-900 tracking-tight font-sans">
                  MAGIZH SHOPPING + B5 COIN
                </h3>
                <p className="text-[10px] text-gray-500 font-sans">
                  Authorized Partner Shop: {selectedReceipt.partnerName} ({selectedReceipt.partnerId})
                </p>
                <div className="mt-2 inline-block bg-cream-200 px-2.5 py-0.5 rounded text-[10px] font-black font-mono">
                  RECEIPT #{selectedReceipt.receiptNumber}
                </div>
              </div>

              <div className="space-y-1 text-[11px] text-gray-700 border-b border-dashed border-gray-300 pb-2">
                <div className="flex justify-between">
                  <span>Date &amp; Time:</span>
                  <span>{new Date(selectedReceipt.createdAt).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Customer:</span>
                  <span>{selectedReceipt.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Mobile:</span>
                  <span>{selectedReceipt.customerPhone}</span>
                </div>
              </div>

              {selectedReceipt.notes && (
                <div className="space-y-1 text-[11px] border-b border-dashed border-gray-300 pb-2">
                  <span className="font-bold block text-gray-500 uppercase text-[9px] font-sans">Item Details</span>
                  <p className="text-gray-800">{selectedReceipt.notes}</p>
                </div>
              )}

              <div className="space-y-1 text-[11px] pt-1">
                <div className="flex justify-between">
                  <span>Total Bill Amount:</span>
                  <span className="font-bold">₹{selectedReceipt.eligiblePurchaseAmount}</span>
                </div>
                <div className="flex justify-between text-amber-800">
                  <span>B5 Coins Redeemed:</span>
                  <span className="font-bold">-{selectedReceipt.coinsRedeemed} Coins</span>
                </div>
                <div className="flex justify-between text-amber-800">
                  <span>Coin Discount (₹1/coin):</span>
                  <span className="font-bold">-₹{selectedReceipt.coinsRedeemed}</span>
                </div>
                <div className="flex justify-between text-darkbrown-900 font-extrabold text-sm pt-2 border-t border-gray-300">
                  <span>Net Cash Paid:</span>
                  <span>₹{selectedReceipt.netCashPaid}</span>
                </div>
                <div className="flex justify-between text-blue-800 text-[10px] pt-1">
                  <span>Partner Commission:</span>
                  <span>₹{selectedReceipt.partnerCommissionEarned}</span>
                </div>
              </div>

              <div className="text-center text-[10px] text-gray-400 font-sans pt-2 border-t border-dashed border-gray-300">
                Thank you for shopping at Magizh! &bull; B5 Rewards Powered
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 font-sans">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-cream-100 hover:bg-cream-200 border border-cream-300 rounded-xl font-bold text-darkbrown-800 text-xs flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Receipt</span>
              </button>

              <button
                onClick={() => setSelectedReceipt(null)}
                className="px-5 py-2 bg-darkbrown-900 hover:bg-darkbrown-950 text-white rounded-xl font-extrabold text-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
