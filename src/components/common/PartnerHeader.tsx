import React, { useState, useEffect } from 'react';
import { Store, LogOut, ArrowLeft, CheckCircle2, Receipt, Clock, FileText } from 'lucide-react';
import { StorageService } from '../../services/storage';

interface PartnerHeaderProps {
  onNavigateStorefront: () => void;
  onLogout: () => void;
  activeSubTab?: string;
  onSelectSubTab?: (tab: string) => void;
}

export const PartnerHeader: React.FC<PartnerHeaderProps> = ({
  onNavigateStorefront,
  onLogout,
  activeSubTab = 'instore',
  onSelectSubTab,
}) => {
  const [partner, setPartner] = useState<any>(() => {
    try {
      const stored = localStorage.getItem('magizh_partner_user');
      if (stored) return JSON.parse(stored);
    } catch (_) {}
    const current = StorageService.getCurrentUser();
    return {
      id: current.id || '',
      shopName: current.name ? `${current.name}'s Partner Shop` : 'Partner Shop',
      ownerName: current.name || '',
      status: 'active',
      partnerCode: current.customerCode || '',
    };
  });

  const handleLogoutClick = () => {
    if (window.confirm('Are you sure you want to log out of the Partner Shop POS portal?')) {
      localStorage.removeItem('magizh_partner_token');
      localStorage.removeItem('magizh_partner_user');
      onLogout();
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-gradient-to-r from-blue-950 via-slate-900 to-blue-900 text-white shadow-md border-b border-blue-800/60">
      {/* Top Identity Bar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-2 sm:gap-3">
        {/* Left: Partner Portal Brand */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center text-white shadow-inner shrink-0 border border-blue-400/30">
            <Store className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-extrabold text-xs sm:text-base tracking-tight text-white truncate">
                MAGIZH PARTNER POS
              </span>
              <span className="hidden xs:inline-flex text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 px-1.5 sm:px-2 py-0.5 rounded-full items-center gap-1 shrink-0">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span className="hidden sm:inline">Verified Partner</span>
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-blue-200/90 font-medium truncate max-w-[150px] xs:max-w-[200px] sm:max-w-none">
              {partner.shopName || 'Franchise Partner'} &bull; ID: <span className="font-mono font-bold text-white">{partner.partnerCode || partner.id}</span>
            </p>
          </div>
        </div>

        {/* Right: Actions & Partner Logout */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Return to Customer Storefront */}
          <button
            onClick={onNavigateStorefront}
            className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-blue-200 hover:text-white bg-white/10 hover:bg-white/15 px-3 py-1.5 rounded-xl border border-white/10 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Storefront</span>
          </button>

          {/* Visible Partner Logout Button */}
          <button
            onClick={handleLogoutClick}
            className="flex items-center gap-1 text-xs font-bold text-red-200 hover:text-white bg-red-900/60 hover:bg-red-800 px-2.5 sm:px-3 py-1.5 rounded-xl border border-red-700/60 transition-colors shadow-2xs shrink-0"
            title="Log out of Partner Portal"
          >
            <LogOut className="w-3.5 h-3.5 text-red-300" />
            <span className="hidden sm:inline">Partner </span>
            <span>Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};
