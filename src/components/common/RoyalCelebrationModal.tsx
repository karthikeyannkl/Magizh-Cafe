import React from 'react';
import {
  Sparkles,
  CheckCircle2,
  Coins,
  Package,
  ArrowRight,
  X,
  ShoppingBag,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { RoyalConfettiCanvas } from './RoyalConfettiCanvas';
import { AnimatedCounter } from './AnimatedCounter';

export type CelebrationType =
  | 'registration_success'
  | 'coin_credit'
  | 'order_success'
  | 'coin_redemption';

export interface CelebrationData {
  type: CelebrationType;
  title?: string;
  message?: string;
  // Registration fields
  customerName?: string;
  customerCode?: string;
  // Coin credit fields
  coinsCredited?: number;
  previousBalance?: number;
  newBalance?: number;
  notificationId?: string;
  // Order fields
  orderNumber?: string;
  orderAmount?: number;
  coinsUsed?: number;
  amountSaved?: number;
  // Coin redemption fields
  coinsRedeemed?: number;
  discountReceived?: number;
  remainingBalance?: number;
}

interface RoyalCelebrationModalProps {
  isOpen: boolean;
  data: CelebrationData | null;
  onClose: () => void;
  onNavigateOrders?: () => void;
  onNavigateWallet?: () => void;
  onContinueShopping?: () => void;
}

export const RoyalCelebrationModal: React.FC<RoyalCelebrationModalProps> = ({
  isOpen,
  data,
  onClose,
  onNavigateOrders,
  onNavigateWallet,
  onContinueShopping,
}) => {
  if (!isOpen || !data) return null;

  const handleContinueShopping = () => {
    onClose();
    if (onContinueShopping) onContinueShopping();
  };

  const handleViewOrders = () => {
    onClose();
    if (onNavigateOrders) onNavigateOrders();
  };

  const handleViewWallet = () => {
    onClose();
    if (onNavigateWallet) onNavigateWallet();
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-darkbrown-950/75 backdrop-blur-md animate-in fade-in duration-300">
      {/* Full-screen Royal Confetti and 3D Gold Coins */}
      <RoyalConfettiCanvas
        durationMs={4800}
        particleCount={75}
        showCoins={data.type !== 'order_success' || (data.coinsUsed || 0) > 0}
      />

      <div
        className="relative bg-white rounded-3xl shadow-2xl border-2 border-amber-300/80 w-full max-w-md overflow-hidden z-[130] animate-in zoom-in-95 duration-300"
        role="dialog"
        aria-modal="true"
      >
        {/* Top Royal Banner */}
        <div className="relative bg-gradient-to-br from-magizh-900 via-magizh-800 to-emerald-950 text-white p-6 sm:p-7 text-center overflow-hidden">
          {/* Subtle Royal Radial Glow */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(245,158,11,0.25),transparent_70%)] pointer-events-none" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Event-Specific Hero Emblem */}
          {data.type === 'registration_success' && (
            <div className="relative mx-auto mb-4 w-20 h-20 rounded-full bg-gradient-to-tr from-amber-500 via-amber-300 to-yellow-100 p-1 shadow-lg animate-bounce duration-1000">
              <div className="w-full h-full rounded-full bg-magizh-900 flex items-center justify-center border-2 border-amber-200">
                <Sparkles className="w-10 h-10 text-amber-300 animate-pulse" />
              </div>
            </div>
          )}

          {data.type === 'coin_credit' && (
            <div className="relative mx-auto mb-4 w-20 h-20 rounded-full bg-gradient-to-tr from-amber-400 via-yellow-300 to-amber-600 p-1 shadow-xl">
              <div className="w-full h-full rounded-full bg-gradient-to-br from-amber-600 to-darkbrown-900 flex items-center justify-center border-2 border-yellow-200 shadow-inner">
                <span className="font-black text-2xl tracking-tighter text-yellow-100">B5</span>
              </div>
            </div>
          )}

          {data.type === 'order_success' && (
            <div className="relative mx-auto mb-4 w-20 h-20 rounded-full bg-gradient-to-tr from-emerald-400 via-emerald-200 to-teal-500 p-1 shadow-xl">
              <div className="w-full h-full rounded-full bg-gradient-to-br from-magizh-800 to-emerald-950 flex items-center justify-center border-2 border-emerald-300">
                <CheckCircle2 className="w-10 h-10 text-emerald-300" />
              </div>
            </div>
          )}

          {data.type === 'coin_redemption' && (
            <div className="relative mx-auto mb-4 w-20 h-20 rounded-full bg-gradient-to-tr from-b5-500 via-amber-300 to-orange-500 p-1 shadow-xl">
              <div className="w-full h-full rounded-full bg-gradient-to-br from-b5-700 to-darkbrown-900 flex items-center justify-center border-2 border-amber-200">
                <Coins className="w-10 h-10 text-amber-300" />
              </div>
            </div>
          )}

          {/* Badge */}
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-400/20 text-amber-200 border border-amber-300/30 mb-2">
            <Sparkles className="w-3 h-3 text-amber-300" />
            <span>Royal Celebration</span>
          </span>

          {/* Headline */}
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            {data.type === 'registration_success' && 'Welcome to Magizh!'}
            {data.type === 'coin_credit' && 'Congratulations! B5 Coins Arrived!'}
            {data.type === 'order_success' && 'Order Placed Successfully!'}
            {data.type === 'coin_redemption' && 'B5 Coins Redeemed!'}
          </h2>

          <p className="text-xs text-emerald-100/90 mt-1 max-w-xs mx-auto">
            {data.type === 'registration_success' && 'Your Journey Begins with 100 Welcome Coins!'}
            {data.type === 'coin_credit' && 'New reward coins credited to your official Magizh wallet.'}
            {data.type === 'order_success' && 'Your authentic native order has been securely confirmed.'}
            {data.type === 'coin_redemption' && 'Instant discount applied via your B5 Coin reward balance.'}
          </p>
        </div>

        {/* Modal Body with Animated Stats */}
        <div className="p-5 sm:p-6 space-y-4">
          {/* EVENT 1: Registration Success */}
          {data.type === 'registration_success' && (
            <div className="space-y-4 text-center">
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4">
                <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">
                  Welcome Reward Unlocked
                </span>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <Coins className="w-6 h-6 text-amber-600" />
                  <span className="text-2xl sm:text-3xl font-black text-darkbrown-900">
                    <AnimatedCounter to={100} durationMs={1000} />
                  </span>
                  <span className="text-sm font-extrabold text-amber-700">B5 Coins (₹100)</span>
                </div>
                <p className="text-xs text-gray-600 mt-1.5">
                  Redeemable up to 50% on your online orders or at certified Partner shops across Tamil Nadu.
                </p>
              </div>

              {data.customerCode && (
                <p className="text-xs text-gray-500 font-mono">
                  Your Customer Code: <strong className="text-darkbrown-900">{data.customerCode}</strong>
                </p>
              )}

              <button
                type="button"
                onClick={handleContinueShopping}
                className="w-full py-3.5 bg-gradient-to-r from-magizh-800 to-magizh-900 hover:from-magizh-900 hover:to-darkbrown-900 text-white rounded-2xl text-xs font-black shadow-lg shadow-magizh-900/20 transition-all flex items-center justify-center gap-2"
              >
                <ShoppingBag className="w-4 h-4 text-amber-300" />
                <span>Continue Shopping</span>
              </button>
            </div>
          )}

          {/* EVENT 2: B5 Coin Credit Celebration */}
          {data.type === 'coin_credit' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-cream-100 rounded-2xl p-3 border border-cream-300">
                  <span className="text-[10px] font-bold text-gray-500 block uppercase">Previous</span>
                  <span className="text-xs sm:text-sm font-black text-gray-700 mt-0.5 block">
                    {data.previousBalance || 0}
                  </span>
                </div>

                <div className="bg-gradient-to-b from-amber-100 to-amber-50 rounded-2xl p-3 border-2 border-amber-300">
                  <span className="text-[10px] font-black text-amber-800 block uppercase">Credited</span>
                  <div className="flex items-center justify-center gap-0.5 text-sm sm:text-base font-black text-b5-700 mt-0.5">
                    <span>+</span>
                    <AnimatedCounter to={data.coinsCredited || 0} durationMs={1200} />
                  </div>
                </div>

                <div className="bg-gradient-to-b from-emerald-100 to-emerald-50 rounded-2xl p-3 border-2 border-emerald-300">
                  <span className="text-[10px] font-black text-emerald-800 block uppercase">New Balance</span>
                  <div className="flex items-center justify-center gap-0.5 text-xs sm:text-sm font-black text-magizh-900 mt-0.5">
                    <AnimatedCounter
                      from={data.previousBalance || 0}
                      to={data.newBalance || 0}
                      durationMs={1500}
                    />
                  </div>
                </div>
              </div>

              {data.message && (
                <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p>{data.message}</p>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleViewWallet}
                  className="flex-1 py-3 bg-gradient-to-r from-b5-600 to-amber-600 hover:from-b5-700 hover:to-amber-700 text-white rounded-xl text-xs font-extrabold shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  <Coins className="w-4 h-4" />
                  <span>View My Wallet</span>
                </button>
                <button
                  type="button"
                  onClick={handleContinueShopping}
                  className="px-4 py-3 bg-cream-100 hover:bg-cream-200 text-darkbrown-900 rounded-xl text-xs font-bold border border-cream-300 transition-colors"
                >
                  Shop Now
                </button>
              </div>
            </div>
          )}

          {/* EVENT 3: Order Success Celebration */}
          {data.type === 'order_success' && (
            <div className="space-y-4">
              <div className="bg-cream-50 rounded-2xl p-4 border border-cream-300 space-y-2 text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-cream-200">
                  <span className="text-gray-500 font-medium">Order Number:</span>
                  <span className="font-mono font-black text-darkbrown-900 text-xs">
                    {data.orderNumber}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Payable Amount:</span>
                  <span className="font-black text-magizh-900 text-sm">
                    ₹{data.orderAmount?.toLocaleString('en-IN')}
                  </span>
                </div>

                {(data.coinsUsed || 0) > 0 && (
                  <div className="flex justify-between items-center text-b5-700 font-bold">
                    <span>B5 Coins Redeemed:</span>
                    <span>-{data.coinsUsed} Coins (₹{data.coinsUsed})</span>
                  </div>
                )}

                {(data.amountSaved || 0) > 0 && (
                  <div className="flex justify-between items-center text-emerald-700 font-extrabold pt-1 border-t border-cream-200">
                    <span>Total Amount Saved:</span>
                    <span>₹{data.amountSaved?.toLocaleString('en-IN')}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                {onNavigateOrders && (
                  <button
                    type="button"
                    onClick={handleViewOrders}
                    className="flex-1 py-3 bg-magizh-800 hover:bg-magizh-900 text-white rounded-xl text-xs font-extrabold shadow-md transition-all flex items-center justify-center gap-1.5"
                  >
                    <Package className="w-4 h-4 text-emerald-300" />
                    <span>Track My Order</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleContinueShopping}
                  className="flex-1 py-3 bg-cream-100 hover:bg-cream-200 text-darkbrown-900 rounded-xl text-xs font-bold border border-cream-300 transition-colors"
                >
                  Continue Shopping
                </button>
              </div>
            </div>
          )}

          {/* EVENT 4: B5 Coin Redemption Celebration */}
          {data.type === 'coin_redemption' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl p-4 border border-amber-200 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 font-medium">B5 Coins Redeemed:</span>
                  <span className="font-black text-b5-700 text-sm">
                    <AnimatedCounter to={data.coinsRedeemed || 0} durationMs={1000} suffix=" Coins" />
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-600 font-medium">Instant Discount:</span>
                  <span className="font-black text-emerald-700 text-sm">
                    ₹{data.discountReceived?.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-amber-200 text-darkbrown-900">
                  <span className="text-gray-600">Remaining Wallet Balance:</span>
                  <span className="font-mono font-black text-sm">
                    {data.remainingBalance?.toLocaleString('en-IN')} B5 Coins
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleContinueShopping}
                className="w-full py-3.5 bg-gradient-to-r from-magizh-800 to-magizh-900 hover:from-magizh-900 hover:to-darkbrown-900 text-white rounded-2xl text-xs font-black shadow-md transition-all flex items-center justify-center gap-2"
              >
                <span>Done &bull; Continue Shopping</span>
                <ArrowRight className="w-4 h-4 text-amber-300" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
