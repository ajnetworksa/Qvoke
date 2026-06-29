import React, { useState, useEffect } from 'react';
import { useERPStore } from './store';
import {
  LayoutDashboard,
  FileSpreadsheet,
  FileText,
  Users,
  Package,
  Settings as SettingsIcon,
  TrendingUp,
  Sun,
  Moon,
  Monitor,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Building,
  UserCheck,
  Loader2,
  ClipboardList,
  FilePlus2
} from 'lucide-react';

// Subpage views imports
import { Dashboard } from './pages/Dashboard';
import { Quotations } from './pages/Quotations';
import { QuotationDetail } from './pages/QuotationDetail';
import { Invoices } from './pages/Invoices';
import { InvoiceDetail } from './pages/InvoiceDetail';
import { Customers } from './pages/Customers';
import { Suppliers } from './pages/Suppliers';
import { Products } from './pages/Products';
import { Settings as SettingsPage } from './pages/Settings';
import { Reports } from './pages/Reports';
import { BOQ } from './pages/BOQ';
import { Login } from './components/Login';
import { NotificationBell } from './components/NotificationBell';

export const App: React.FC = () => {
  const {
    currentPage,
    currentRecordId,
    activeQuoteId,
    activeInvoiceId,
    features,
    setRoute,
    theme,
    setTheme,
    currentUser,
    token,
    authChecked,
    checkAuth,
    logout,
    company
  } = useERPStore();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [identityDropdownOpen, setIdentityDropdownOpen] = useState(false);

  // Check auth status on load
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Sync theme attribute on load & handle system changes
  useEffect(() => {
    const updateTheme = () => {
      if (theme === 'system') {
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', systemPrefersDark ? 'dark' : 'light');
      } else {
        document.documentElement.setAttribute('data-theme', theme);
      }
    };

    updateTheme();

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = () => {
      if (theme === 'system') {
        updateTheme();
      }
    };

    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, [theme]);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard / الرئيسية', icon: LayoutDashboard, category: 'GENERAL' },
    { id: 'quote-editor', label: 'Current Quote / العرض الحالي', icon: FilePlus2, category: 'SALES', feature: 'quotations' },
    { id: 'quotations', label: 'Quotations / سجل العروض', icon: FileSpreadsheet, category: 'SALES', feature: 'quotations' },
    { id: 'invoice-editor', label: 'Current Invoice / الفاتورة الحالية', icon: FilePlus2, category: 'SALES', feature: 'invoices' },
    { id: 'invoices', label: 'Invoices / سجل الفواتير', icon: FileText, category: 'SALES', feature: 'invoices' },
    { id: 'boq', label: 'BOQ / جدول الكميات', icon: ClipboardList, category: 'SALES', feature: 'boq' },
    { id: 'reports', label: 'Financials / الحسابات', icon: TrendingUp, category: 'FINANCIAL', feature: 'reports' },
    { id: 'customers', label: 'Customers / العملاء', icon: Users, category: 'CATALOG', feature: 'customers' },
    { id: 'suppliers', label: 'Suppliers / الموردين', icon: Building, category: 'CATALOG', feature: 'suppliers' },
    { id: 'products', label: 'Catalog / المنتجات', icon: Package, category: 'CATALOG', feature: 'products' },
    { id: 'settings', label: 'Settings / الإعدادات', icon: SettingsIcon, category: 'SYSTEM' }
  ];

  // A feature is on unless explicitly disabled. BOQ nav also covers BOM.
  const isFeatureOn = (key?: string) => {
    if (!key) return true;
    if (key === 'boq') return features['boq'] !== false || features['bom'] !== false;
    return features[key] !== false;
  };
  const visibleNavItems = navItems.filter((i) => isFeatureOn((i as any).feature));

  // Resolve current active page component
  const renderActiveView = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'quotations':
        return <Quotations />;
      case 'quotation-detail':
        return <QuotationDetail id={currentRecordId || 'new'} />;
      case 'invoices':
        return <Invoices />;
      case 'invoice-detail':
        return <InvoiceDetail id={currentRecordId || 'new'} />;
      case 'customers':
        return <Customers />;
      case 'suppliers':
        return <Suppliers />;
      case 'products':
        return <Products />;
      case 'boq':
        return <BOQ />;
      case 'settings':
        return <SettingsPage />;
      case 'reports':
        return <Reports />;
      default:
        return <Dashboard />;
    }
  };

  const handleNavClick = (pageId: string) => {
    // The "Current …" buttons resume the active document (or start a new one).
    if (pageId === 'quote-editor') {
      setRoute('quotation-detail', activeQuoteId || 'new');
    } else if (pageId === 'invoice-editor') {
      setRoute('invoice-detail', activeInvoiceId || 'new');
    } else {
      setRoute(pageId);
    }
    setMobileMenuOpen(false);
  };

  // Grouped nav items
  const categories = ['GENERAL', 'SALES', 'FINANCIAL', 'CATALOG', 'SYSTEM'];

  // 1. Initial Authorization / Session Check Splash Loader
  if (!authChecked) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-950 text-white">
        <Loader2 className="w-12 h-12 text-teal-400 animate-spin mb-4" />
        <p className="text-sm font-black tracking-widest text-slate-400 uppercase">Qvoke • Validating Portal Auth</p>
      </div>
    );
  }

  // 2. Auth Gate
  if (!token || !currentUser) {
    return <Login />;
  }

  return (
    <div className="min-h-screen flex bg-[var(--color-bg)] text-[var(--color-text)] transition-colors duration-150 relative">
      {/* 1. Backdrop for mobile slider */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* 2. Left Sidebar (collapsible) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 lg:sticky h-screen flex flex-col bg-[var(--color-surface)] border-r border-[var(--color-border)] transition-all duration-[var(--transition-interactive)] ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          } ${sidebarCollapsed ? 'w-16' : 'w-64'}`}
      >
        {/* Sidebar Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className={`w-8 h-8 rounded flex-shrink-0 flex items-center justify-center text-white font-bold text-base overflow-hidden ${
              company.siteLogo ? 'bg-transparent' : 'bg-[var(--color-primary)] shadow-sm'
            }`}>
              {company.siteLogo ? (
                <img src={company.siteLogo} alt="Site Logo" className="w-full h-full object-contain" />
              ) : (
                company.name ? company.name.charAt(0) : 'A'
              )}
            </div>
            {!sidebarCollapsed && (
              <span className="font-extrabold text-sm tracking-tight text-[var(--color-text)] truncate text-left">
                {import.meta.env.VITE_APP_NAME || company.name || 'Qvoke'}
              </span>
            )}
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-1 hover:bg-[var(--color-surface-offset)] rounded"
          >
            <X className="w-5 h-5 text-[var(--color-text-muted)]" />
          </button>
        </div>

        {/* Sidebar Navigation Links */}
        <div className="flex-1 py-4 overflow-y-auto px-3 select-none text-left">
          {categories.map((cat) => {
            const items = visibleNavItems.filter((i) => i.category === cat);
            if (items.length === 0) return null;
            return (
              <div key={cat} className="mb-4">
                {!sidebarCollapsed && (
                  <div className="text-[10px] font-black text-[var(--color-text-faint)] uppercase tracking-widest px-3 mb-1.5">
                    {cat}
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const isActive =
                      currentPage === item.id ||
                      (item.id === 'quote-editor' && currentPage === 'quotation-detail') ||
                      (item.id === 'invoice-editor' && currentPage === 'invoice-detail');

                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavClick(item.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-xs font-bold transition-all relative group cursor-pointer text-left ${isActive
                            ? 'bg-[var(--color-primary-highlight)]/30 text-[var(--color-primary)]'
                            : 'hover:bg-[var(--color-surface-offset)] text-[var(--color-text-muted)]'
                          }`}
                      >
                        {isActive && (
                          <div className="absolute left-0 top-1 bottom-1 w-1 bg-[var(--color-primary)] rounded-r" />
                        )}
                        <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}`} />
                        {!sidebarCollapsed && <span className="truncate">{item.label}</span>}

                        {sidebarCollapsed && (
                          <div className="absolute left-full ml-3 px-2 py-1 bg-[var(--color-text)] text-[var(--color-bg)] text-[10px] font-bold rounded shadow opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                            {item.label.split(' / ')[0]}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Sidebar footer collapsing switch */}
        <div className="p-3 border-t border-[var(--color-border)] hidden lg:block">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center p-2 rounded-md hover:bg-[var(--color-surface-offset)] text-[var(--color-text-muted)] transition-colors cursor-pointer"
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </aside>

      {/* 3. Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header navbar */}
        <header className="h-16 border-b border-[var(--color-border)]/50 bg-[var(--color-surface)]/80 backdrop-blur-sm sticky top-0 z-30 flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 hover:bg-[var(--color-surface-offset)] rounded text-[var(--color-text-muted)] cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden lg:flex items-center gap-2 text-xs font-semibold text-[var(--color-text-muted)]">
              <Building className="w-4 h-4 text-[var(--color-text-faint)]" />
              <span>{company.name}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <NotificationBell />

            {/* Dynamic persistent theme toggle switch */}
            <button
              onClick={() => {
                if (theme === 'light') setTheme('dark');
                else if (theme === 'dark') setTheme('system');
                else setTheme('light');
              }}
              title={`Theme: ${theme.toUpperCase()} (Click to toggle)`}
              className="p-2 hover:bg-[var(--color-surface-offset)] rounded-full text-[var(--color-text-muted)] transition-colors cursor-pointer"
              aria-label="Toggle Theme"
            >
              {theme === 'light' && <Moon className="w-4 h-4" />}
              {theme === 'dark' && <Sun className="w-4 h-4" />}
              {theme === 'system' && <Monitor className="w-4 h-4" />}
            </button>

            {/* Secure Portal User Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIdentityDropdownOpen(!identityDropdownOpen)}
                className="flex items-center gap-2.5 pl-2.5 pr-2.5 py-1.5 hover:bg-[var(--color-surface-offset)] border border-[var(--color-border)]/80 rounded-md transition-colors text-left cursor-pointer"
              >
                <img
                  src={currentUser.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80'}
                  alt={currentUser.name}
                  className="w-6 h-6 rounded-full border border-[var(--color-border)]"
                />
                <div className="hidden md:block leading-none text-left">
                  <span className="text-[11px] font-bold text-[var(--color-text)] block">{currentUser.name}</span>
                  <span className="text-[9px] font-semibold text-[var(--color-primary)] uppercase tracking-wider">
                    {currentUser.role.replace('_', ' ')}
                  </span>
                </div>
              </button>

              {identityDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIdentityDropdownOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1.5 w-56 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-lg py-2 z-50 text-left animate-slide-in">
                    <div className="px-4 py-2 border-b border-[var(--color-border)] mb-1">
                      <span className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest block">
                        Portal Account / حساب النظام
                      </span>
                    </div>
                    <div className="px-4 py-2 text-xs">
                      <span className="block font-bold text-[var(--color-text)]">{currentUser.name}</span>
                      <span className="block text-[10px] text-[var(--color-text-muted)]">{currentUser.email}</span>
                      <span className="inline-block mt-2 px-2 py-0.5 bg-[var(--color-primary-highlight)]/40 text-[var(--color-primary)] text-[9px] font-black uppercase rounded">
                        {currentUser.role.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="border-t border-[var(--color-border)] mt-2 pt-1">
                      <button
                        onClick={() => {
                          setIdentityDropdownOpen(false);
                          logout();
                        }}
                        className="w-full text-left px-4 py-2.5 text-xs text-red-500 hover:bg-[var(--color-surface-offset)] flex items-center gap-2 font-bold cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out / تسجيل الخروج</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Content Container Page Outlet */}
        <main className={`flex-1 p-6 md:p-8 w-full mx-auto overflow-y-auto ${
          currentPage === 'quotation-detail' || currentPage === 'invoice-detail' 
            ? 'max-w-[98%]' 
            : 'max-w-7xl'
        }`}>
          {renderActiveView()}
        </main>
      </div>
    </div>
  );
};
export default App;
