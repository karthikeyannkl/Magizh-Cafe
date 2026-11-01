import React, { useState, useEffect } from 'react';
import { ShoppingBag, Coins, User as UserIcon, Store, LogOut, ChevronDown, Sparkles } from 'lucide-react';
import { StorageService, subscribe } from '../../services/storage';
import { User } from '../../types';

interface CustomerHeaderProps {
  currentTab: string;
  onNavigate: (tab: string) => void;
  onOpenAuth: () => void;
  onLogout?: () => void;
}

export const CustomerHeader: React.FC<CustomerHeaderProps> = ({
  currentTab,
  onNavigate,
  onOpenAuth,
  onLogout,
}) => {
  const [currentUser, setCurrentUser] = useState<User>(StorageService.getCurrentUser());
  const [coinAccount, setCoinAccount] = useState(StorageService.getCoinAccount(currentUser.id));
  const [cartCount, setCartCount] = useState(
    StorageService.getCart().reduce((acc, item) => acc + item.quantity, 0)
  );
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const isLoggedIn = Boolean(currentUser && currentUser.id && !currentUser.isGuest);

  useEffect(() => {
    const unsubUser = subscribe('currentUserChanged', (user: User) => {
      setCurrentUser(user);
      setCoinAccount(StorageService.getCoinAccount(user.id));
    });
    const unsubCoin = subscribe('coinAccountChanged', () => {
      setCoinAccount(StorageService.getCoinAccount(currentUser.id));
    });
    const unsubCart = subscribe('cartChanged', (cart) => {
      setCartCount(cart.reduce((acc: number, item: any) => acc + item.quantity, 0));
    });

    return () => {
      unsubUser();
      unsubCoin();
      unsubCart();
    };
  }, [currentUser.id]);

  const handleLogout = () => {
    StorageService.logout();
    setShowProfileMenu(false);
    if (onLogout) onLogout();
    onNavigate('home');
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-cream-300 shadow-xs">
      {/* Top Brand Announcement Bar */}
      <div className="bg-gradient-to-r from-magizh-900 via-magizh-800 to-darkbrown-900 text-white text-xs px-3 py-1.5 flex items-center justify-between">
        <div className="flex items-center space-x-2 truncate">
          <span className="bg-b5-600 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
            B5 Rewards
          </span>
          <span className="truncate">Earn up to 5% B5 Coins on all Traditional Millets &amp; Cold-Pressed Oils!</span>
        </div>
        <div className="flex items-center space-x-3 text-[11px] shrink-0 font-medium">
          <span className="text-cream-200">1 B5 Coin = ₹1</span>
        </div>
      </div>

      {/* Main App Bar */}
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        {/* Brand Logo & Name */}
        <div
          onClick={() => onNavigate('home')}
          className="flex items-center gap-2 cursor-pointer select-none group"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-magizh-700 to-magizh-900 flex items-center justify-center text-white font-extrabold shadow-md border border-magizh-600/30 group-hover:scale-105 transition-transform">
            <span className="text-xl">M</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-lg tracking-tight text-magizh-900">
                MAGIZH
              </span>
              <span className="text-xs uppercase font-bold tracking-widest text-b5-700 bg-b5-100 px-1.5 py-0.5 rounded">
                SHOPPING
              </span>
            </div>
            <p className="text-[10px] text-darkbrown-700 font-medium -mt-1 tracking-tight">
              Pure Natural Living &bull; B5 Coin Ecosystem
            </p>
          </div>
        </div>

        {/* Right Navigation & Badges */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Partner Shops Directory (Customer Facing) */}
          <button
            onClick={() => onNavigate('partner-shops')}
            className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors border ${
              currentTab === 'partner-shops'
                ? 'bg-blue-50 border-blue-300 text-blue-900'
                : 'bg-cream-100 hover:bg-cream-200 border-cream-300 text-darkbrown-800'
            }`}
            title="Explore Local Partner Shops"
          >
            <Store className="w-3.5 h-3.5 text-blue-700" />
            <span>Partner Shops</span>
          </button>

          {/* B5 Coin Wallet Badge (Only when authenticated) */}
          {isLoggedIn ? (
            <button
              onClick={() => onNavigate('wallet')}
              className="flex items-center gap-1.5 bg-gradient-to-r from-b5-50 to-amber-50 border border-b5-200 hover:border-b5-400 px-2.5 py-1.5 rounded-full shadow-2xs hover:shadow transition-all group"
              title="Click to view your B5 Coin Wallet"
            >
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-b5-500 to-b5-700 text-white flex items-center justify-center shadow-inner group-hover:rotate-12 transition-transform">
                <Coins className="w-3.5 h-3.5" />
              </div>
              <div className="text-left pr-1">
                <span className="text-[10px] block font-semibold text-b5-800 leading-none">My B5 Coins</span>
                <span className="text-xs font-black text-b5-700 leading-tight">
                  {coinAccount.availableBalance}
                </span>
              </div>
            </button>
          ) : (
            <button
              onClick={onOpenAuth}
              className="hidden sm:flex items-center gap-1 text-[11px] font-bold text-b5-800 bg-b5-50 hover:bg-b5-100 border border-b5-200 px-2.5 py-1.5 rounded-full transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-b5-600" />
              <span>Sign In to Earn B5 Coins</span>
            </button>
          )}

          {/* Cart Icon */}
          <button
            onClick={() => onNavigate('cart')}
            className="relative p-2 text-darkbrown-800 hover:text-magizh-800 hover:bg-cream-200 rounded-full transition-colors"
            title="Shopping Cart"
          >
            <ShoppingBag className="w-5 h-5" />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-b5-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                {cartCount}
              </span>
            )}
          </button>

          {/* Customer Profile / Sign In Button */}
          {isLoggedIn ? (
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                  currentTab === 'account'
                    ? 'bg-magizh-800 text-white border-magizh-900 shadow-sm'
                    : 'bg-white hover:bg-cream-100 text-darkbrown-900 border-cream-300'
                }`}
                title="Customer Profile & Account"
              >
                <div className="w-4 h-4 rounded-full bg-magizh-100 text-magizh-800 flex items-center justify-center text-[10px] font-extrabold">
                  {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'C'}
                </div>
                <span className="hidden sm:inline">{currentUser.name.split(' ')[0]}</span>
                <span className="sm:hidden">Account</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>

              {/* Customer Account Dropdown Menu */}
              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-cream-300 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3.5 py-2 border-b border-cream-200">
                    <p className="text-xs font-extrabold text-darkbrown-900 truncate">{currentUser.name}</p>
                    <p className="text-[11px] text-gray-500 font-mono">{currentUser.customerCode || currentUser.mobile}</p>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        onNavigate('account');
                      }}
                      className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2 hover:bg-cream-100 text-darkbrown-900 font-medium"
                    >
                      <UserIcon className="w-4 h-4 text-magizh-700" />
                      <span>My Profile &amp; Addresses</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        onNavigate('orders');
                      }}
                      className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2 hover:bg-cream-100 text-darkbrown-900 font-medium"
                    >
                      <ShoppingBag className="w-4 h-4 text-magizh-700" />
                      <span>My Order History</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        onNavigate('wallet');
                      }}
                      className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2 hover:bg-cream-100 text-darkbrown-900 font-medium"
                    >
                      <Coins className="w-4 h-4 text-b5-600" />
                      <span>B5 Coin Wallet</span>
                    </button>
                  </div>

                  <div className="border-t border-cream-200 pt-1">
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2 hover:bg-red-50 text-red-700 font-bold"
                    >
                      <LogOut className="w-4 h-4 text-red-600" />
                      <span>Log Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-magizh-800 hover:bg-magizh-900 text-white shadow-xs transition-colors"
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
