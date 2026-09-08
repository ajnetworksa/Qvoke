import React, { useState } from 'react';
import { useERPStore } from '../store';
import {
  LayoutDashboard,
  Radar,
  FilePlus2,
  Package,
  Menu,
  Plus,
  Receipt,
  FileText,
  DollarSign,
  Users,
  X,
  Palette
} from 'lucide-react';

interface MobileBottomNavProps {
  onOpenMenu: () => void;
  onOpenThemes: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ onOpenMenu, onOpenThemes }) => {
  const { currentPage, setRoute, activeQuoteId, activeInvoiceId } = useERPStore();
  const [fabOpen, setFabOpen] = useState(false);

  const handleAction = (page: string, id: string | null = null) => {
    setFabOpen(false);
    setRoute(page, id);
  };

  return (
    <>
      {/* FAB Backdrop */}
      {fabOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setFabOpen(false)}
        />
      )}

      {/* FAB Radial / Action Sheet */}
      {fabOpen && (
        <div className="fixed bottom-20 right-4 z-50 flex flex-col items-end gap-2.5 lg:hidden animate-slide-in">
          <button
            onClick={() => handleAction('quotation-detail', 'new')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xl text-xs font-bold text-[var(--color-text)] hover:bg-[var(--color-surface-offset)] cursor-pointer"
          >
            <span>New Quote / عرض جديد</span>
            <div className="w-8 h-8 rounded-full bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <FilePlus2 className="w-4 h-4" />
            </div>
          </button>

          <button
            onClick={() => handleAction('invoice-detail', 'new')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xl text-xs font-bold text-[var(--color-text)] hover:bg-[var(--color-surface-offset)] cursor-pointer"
          >
            <span>New Invoice / فاتورة جديدة</span>
            <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </button>

          <button
            onClick={() => handleAction('expenses')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xl text-xs font-bold text-[var(--color-text)] hover:bg-[var(--color-surface-offset)] cursor-pointer"
          >
            <span>Record Expense / تسجيل مصروف</span>
            <div className="w-8 h-8 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </button>

          <button
            onClick={() => handleAction('pos')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xl text-xs font-bold text-[var(--color-text)] hover:bg-[var(--color-surface-offset)] cursor-pointer"
          >
            <span>POS Checkout / نقطة البيع</span>
            <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}

      {/* Floating Action Button (FAB) */}
      <div className="fixed bottom-16 right-4 z-40 lg:hidden">
        <button
          onClick={() => setFabOpen(!fabOpen)}
          className={`w-13 h-13 rounded-full shadow-2xl flex items-center justify-center text-white transition-all transform active:scale-95 cursor-pointer ${
            fabOpen
              ? 'bg-rose-500 rotate-45'
              : 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)]'
          }`}
          aria-label="Quick actions"
        >
          {fabOpen ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
        </button>
      </div>

      {/* Bottom Bar */}
      <nav className="fixed bottom-0 inset-x-0 z-30 h-16 bg-[var(--color-surface)]/95 backdrop-blur-md border-t border-[var(--color-border)] flex items-center justify-around px-2 lg:hidden">
        <button
          onClick={() => setRoute('dashboard')}
          className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors cursor-pointer ${
            currentPage === 'dashboard'
              ? 'text-[var(--color-primary)] font-bold'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          <LayoutDashboard className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Dashboard</span>
        </button>

        <button
          onClick={() => setRoute('tracking')}
          className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors cursor-pointer ${
            currentPage === 'tracking'
              ? 'text-[var(--color-primary)] font-bold'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          <Radar className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Sales Hub</span>
        </button>

        <button
          onClick={() => setRoute('pos')}
          className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors cursor-pointer ${
            currentPage === 'pos'
              ? 'text-[var(--color-primary)] font-bold'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          <Receipt className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">POS</span>
        </button>

        <button
          onClick={() => setRoute('products')}
          className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors cursor-pointer ${
            currentPage === 'products'
              ? 'text-[var(--color-primary)] font-bold'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          <Package className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Catalog</span>
        </button>

        <button
          onClick={onOpenMenu}
          className="flex flex-col items-center justify-center flex-1 h-full py-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
        >
          <Menu className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Menu</span>
        </button>
      </nav>
    </>
  );
};