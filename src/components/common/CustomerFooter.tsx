import React from 'react';
import { Store, ShoppingBag, Coins, User as UserIcon, Shield, Sparkles, Heart } from 'lucide-react';

interface CustomerFooterProps {
  onNavigate: (tab: string) => void;
}

export const CustomerFooter: React.FC<CustomerFooterProps> = ({ onNavigate }) => {
  return (
    <footer className="mt-12 bg-white border-t border-cream-300 py-10 px-4 pb-24 md:pb-10 text-darkbrown-900">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Brand Information */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-magizh-800 text-white flex items-center justify-center font-black">
              M
            </div>
            <span className="font-extrabold text-base tracking-tight text-magizh-900">
              MAGIZH SHOPPING
            </span>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            Modern Indian e-commerce celebrating traditional Tamil Nadu millets, stone-ground podis, wood-pressed virgin oils, and natural living with 100% genuine B5 Coin rewards.
          </p>
          <div className="flex items-center gap-2 text-[11px] text-magizh-800 font-bold bg-magizh-50 px-3 py-1.5 rounded-xl border border-magizh-200 w-fit">
            <Coins className="w-3.5 h-3.5 text-b5-600" />
            <span>1 B5 Coin = ₹1 &bull; Up to 50% Redemption</span>
          </div>
        </div>

        {/* Shopping Categories */}
        <div>
          <h4 className="text-xs font-black uppercase tracking-wider text-darkbrown-900 mb-3">
            Shopping Categories
          </h4>
          <ul className="text-xs text-gray-600 space-y-2 font-medium">
            <li>
              <button onClick={() => onNavigate('home')} className="hover:text-magizh-800 transition-colors">
                Traditional Millet Products (Kodo, Little, Foxtail)
              </button>
            </li>
            <li>
              <button onClick={() => onNavigate('home')} className="hover:text-magizh-800 transition-colors">
                Stone Ground Podi &amp; Masala Varieties
              </button>
            </li>
            <li>
              <button onClick={() => onNavigate('home')} className="hover:text-magizh-800 transition-colors">
                Traditional Chettinad Pickles &amp; Thokku
              </button>
            </li>
            <li>
              <button onClick={() => onNavigate('home')} className="hover:text-magizh-800 transition-colors">
                Wood Pressed Virgin Oils &amp; Vedic A2 Ghee
              </button>
            </li>
            <li>
              <button onClick={() => onNavigate('home')} className="hover:text-magizh-800 transition-colors">
                Natural Herbal Bath Powders &amp; Handcrafted Soaps
              </button>
            </li>
          </ul>
        </div>

        {/* Customer Services & Account */}
        <div>
          <h4 className="text-xs font-black uppercase tracking-wider text-darkbrown-900 mb-3">
            Customer Services
          </h4>
          <ul className="text-xs text-gray-600 space-y-2 font-medium">
            <li>
              <button onClick={() => onNavigate('partner-shops')} className="hover:text-magizh-800 transition-colors flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-blue-700" />
                <span>Partner Shops (Local In-Store Directory)</span>
              </button>
            </li>
            <li>
              <button onClick={() => onNavigate('wallet')} className="hover:text-magizh-800 transition-colors flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-b5-600" />
                <span>B5 Coin Wallet &amp; Rewards</span>
              </button>
            </li>
            <li>
              <button onClick={() => onNavigate('orders')} className="hover:text-magizh-800 transition-colors flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-magizh-700" />
                <span>My Orders &amp; Shipment Tracking</span>
              </button>
            </li>
            <li>
              <button onClick={() => onNavigate('account')} className="hover:text-magizh-800 transition-colors flex items-center gap-1.5">
                <UserIcon className="w-3.5 h-3.5 text-magizh-700" />
                <span>Customer Profile &amp; Address Book</span>
              </button>
            </li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-8 pt-4 border-t border-cream-200 text-center text-[11px] text-gray-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p>&copy; 2026 Magizh Shopping. All Rights Reserved. Traditional South Indian Natural Living.</p>
        <p className="flex items-center gap-1 text-darkbrown-700">
          <span>Crafted with</span>
          <Heart className="w-3 h-3 text-red-600 fill-red-600 inline" />
          <span>for Authentic Indian Commerce</span>
        </p>
      </div>
    </footer>
  );
};
