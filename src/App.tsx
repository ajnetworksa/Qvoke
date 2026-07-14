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
  FilePlus2,
  CheckSquare,
  Search,
  Rows3,
  Radar,
  ChevronDown,
  Check,
  Plus,
  ShieldCheck,
  AppWindow
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
import { Tracking } from './pages/Tracking';
import { MyTasks } from './pages/MyTasks';
import { Companies } from './pages/Companies';
import { PlatformShell } from './pages/PlatformShell';
import { Login } from './components/Login';
import { NotificationBell } from './components/NotificationBell';
import { CommandPalette } from './components/CommandPalette';
import { DesktopWorkspace, type DesktopApp } from './components/DesktopWorkspace';

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
    density,
    setDensity,
    workspaceMode,
    setWorkspaceMode,
    currentUser,
    token,
    authChecked,
    checkAuth,
    logout,
    company,
    companies,
    activeCompanyId,
    switchCompany,
    createCompany,
    applyActiveTheme
  } = useERPStore();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [identityDropdownOpen, setIdentityDropdownOpen] = useState(false);
  const [companyMenuOpen, setCompanyMenuOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [desktopViewport, setDesktopViewport] = useState(() => window.matchMedia('(min-width: 1024px)').matches);

  const activeCompany = companies.find((c) => c.id === activeCompanyId);

  const handleCreateCompany = async () => {
    const name = newCompanyName.trim();
    if (!name || creatingCompany) return;
    setCreatingCompany(true);
    const id = await createCompany(name);
    setCreatingCompany(false);
    setNewCompanyName('');
    if (id) {
      setCompanyMenuOpen(false);
      await switchCompany(id);
    }
  };

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
      applyActiveTheme(); // re-resolve accent for the current light/dark mode
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

  // Apply UI density to the document root (scales rem-based spacing & type).
  useEffect(() => {
    document.documentElement.setAttribute('data-density', density);
  }, [density]);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const update = () => setDesktopViewport(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard / الرئيسية', icon: LayoutDashboard, category: 'GENERAL' },
    { id: 'tasks', label: 'My Tasks / مهامي', icon: CheckSquare, category: 'GENERAL', feature: 'tasks' },
    { id: 'quote-editor', label: 'Current Quote / العرض الحالي', icon: FilePlus2, category: 'SALES', feature: 'quotations' },
    { id: 'quotations', label: 'Quotations / سجل العروض', icon: FileSpreadsheet, category: 'SALES', feature: 'quotations' },
    { id: 'invoice-editor', label: 'Current Invoice / الفاتورة الحالية', icon: FilePlus2, category: 'SALES', feature: 'invoices' },
    { id: 'invoices', label: 'Invoices / سجل الفواتير', icon: FileText, category: 'SALES', feature: 'invoices' },
    { id: 'boq', label: 'BOQ / جدول الكميات', icon: ClipboardList, category: 'SALES', feature: 'boq' },
    { id: 'tracking', label: 'Tracking / المتابعة', icon: Radar, category: 'SALES', feature: 'tracking' },
    { id: 'reports', label: 'Financials / الحسابات', icon: TrendingUp, category: 'FINANCIAL', feature: 'reports' },
    { id: 'customers', label: 'Customers / العملاء', icon: Users, category: 'CATALOG', feature: 'customers' },
    { id: 'suppliers', label: 'Suppliers / الموردين', icon: Building, category: 'CATALOG', feature: 'suppliers' },
    { id: 'products', label: 'Catalog / المنتجات', icon: Package, category: 'CATALOG', feature: 'products' },
    { id: 'platform-admin', label: 'Platform Admin / لوحة المنصة', icon: ShieldCheck, category: 'SYSTEM', superAdminOnly: true },
    { id: 'companies', label: 'Companies / الشركات', icon: Building, category: 'SYSTEM' },
    { id: 'settings', label: 'Settings / الإعدادات', icon: SettingsIcon, category: 'SYSTEM' }
  ];

  // A feature is on unless explicitly disabled. BOQ nav also covers BOM.
  const isFeatureOn = (key?: string) => {
    if (!key) return true;
    if (key === 'boq') return features['boq'] !== false || features['bom'] !== false;
    return features[key] !== false;
  };
  const visibleNavItems = navItems.filter(
    (i) => isFeatureOn((i as any).feature) && (!(i as any).superAdminOnly || currentUser?.isSuperAdmin)
  );

  const desktopApps: DesktopApp[] = [
    { id: 'dashboard', page: 'dashboard', title: 'Dashboard', subtitle: 'Workspace overview', icon: LayoutDashboard },
    { id: 'tasks', page: 'tasks', title: 'My Tasks', subtitle: 'Pending work', icon: CheckSquare, feature: 'tasks' },
    { id: 'quotations', page: 'quotations', title: 'Quotations', subtitle: 'Sales proposals', icon: FileSpreadsheet, feature: 'quotations' },
    { id: 'quotation-detail', page: 'quotation-detail', recordId: activeQuoteId || 'new', title: 'Quote Editor', subtitle: 'Current quotation', icon: FilePlus2, feature: 'quotations' },
    { id: 'invoices', page: 'invoices', title: 'Invoices', subtitle: 'Billing journal', icon: FileText, feature: 'invoices' },
    { id: 'invoice-detail', page: 'invoice-detail', recordId: activeInvoiceId || 'new', title: 'Invoice Editor', subtitle: 'Current invoice', icon: FilePlus2, feature: 'invoices' },
    { id: 'boq', page: 'boq', title: 'BOQ / BOM', subtitle: 'Project quantities', icon: ClipboardList, feature: 'boq' },
    { id: 'tracking', page: 'tracking', title: 'Tracking', subtitle: 'Follow-ups', icon: Radar, feature: 'tracking' },
    { id: 'reports', page: 'reports', title: 'Financials', subtitle: 'Reports and aging', icon: TrendingUp, feature: 'reports' },
    { id: 'customers', page: 'customers', title: 'Customers', subtitle: 'Accounts directory', icon: Users, feature: 'customers' },
    { id: 'suppliers', page: 'suppliers', title: 'Suppliers', subtitle: 'Vendor directory', icon: Building, feature: 'suppliers' },
    { id: 'products', page: 'products', title: 'Catalog', subtitle: 'Products and services', icon: Package, feature: 'products' },
    { id: 'companies', page: 'companies', title: 'Companies', subtitle: 'Tenant workspaces', icon: Building },
    { id: 'settings', page: 'settings', title: 'Settings', subtitle: 'Preferences and access', icon: SettingsIcon }
  ].filter((app) => isFeatureOn(app.feature));

  // Map each routable page to the feature flag that gates it (if any).
  const pageFeature: Record<string, string> = {
    quotations: 'quotations',
    'quotation-detail': 'quotations',
    invoices: 'invoices',
    'invoice-detail': 'invoices',
    boq: 'boq',
    tracking: 'tracking',
    reports: 'reports',
    customers: 'customers',
    suppliers: 'suppliers',
    products: 'products',
    tasks: 'tasks'
  };

  // Resolve current active page component
  const renderActiveView = (page = currentPage, recordId = currentRecordId) => {
    // Deep-link guard: block pages whose feature is disabled on the active plan.
    if (!isFeatureOn(pageFeature[page])) {
      return (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 rounded-full bg-[var(--color-surface-offset)] flex items-center justify-center mb-4">
            <X className="w-7 h-7 text-[var(--color-text-muted)]" />
          </div>
          <h2 className="text-lg font-bold text-[var(--color-text)] mb-1.5">Module not available</h2>
          <p className="text-sm text-[var(--color-text-muted)] max-w-sm mb-5">
            This module is disabled on your current plan. Enable it under Settings → Plan &amp; Features.
          </p>
          <button
            onClick={() => setRoute('dashboard')}
            className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-semibold py-2.5 px-4 rounded-md transition-colors cursor-pointer"
          >
            Back to Dashboard
          </button>
        </div>
      );
    }
    switch (page) {
      case 'dashboard':
        return <Dashboard />;
      case 'quotations':
        return <Quotations />;
      case 'quotation-detail':
        return <QuotationDetail id={recordId || 'new'} />;
      case 'invoices':
        return <Invoices />;
      case 'invoice-detail':
        return <InvoiceDetail id={recordId || 'new'} />;
      case 'customers':
        return <Customers />;
      case 'suppliers':
        return <Suppliers />;
      case 'products':
        return <Products />;
      case 'boq':
        return <BOQ />;
      case 'tracking':
        return <Tracking />;
      case 'tasks':
        return <MyTasks />;
      case 'companies':
        return <Companies />;
      case 'platform-admin':
        return <Dashboard />; // super-admins are intercepted into PlatformShell above
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

  // 3. Separate platform control plane — full-screen, distinct from any company
  //    workspace. Only the platform super-admin can enter it.
  if (currentUser.isSuperAdmin && currentPage === 'platform-admin') {
    return (
      <>
        <CommandPalette />
        <PlatformShell />
      </>
    );
  }

  // Optional desktop workspace. It is intentionally desktop-only; tablets and
  // phones always retain the standard responsive ERP shell.
  if (workspaceMode === 'desktop' && desktopViewport) {
    return (
      <>
        <CommandPalette />
        <DesktopWorkspace
          apps={desktopApps}
          currentPage={currentPage}
          currentRecordId={currentRecordId}
          companyName={activeCompany?.name || company.name}
          userName={currentUser.name}
          persistenceKey={`qvoke_desktop:${currentUser.id}:${activeCompanyId || 'default'}`}
          renderWindow={(page, recordId) => renderActiveView(page, recordId)}
          onNavigate={(page, recordId = null) => setRoute(page, recordId)}
          onExit={() => setWorkspaceMode('standard')}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen flex bg-[var(--color-bg)] text-[var(--color-text)] transition-colors duration-150 relative">
      {/* Global command palette + keyboard shortcuts layer */}
      <CommandPalette />

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
            {/* Company switcher (multi-tenancy) */}
            <div className="relative hidden lg:block">
              <button
                onClick={() => setCompanyMenuOpen((o) => !o)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-[var(--color-border)]/80 hover:bg-[var(--color-surface-offset)] text-xs font-semibold text-[var(--color-text)] transition-colors cursor-pointer"
                title="Switch company"
              >
                <Building className="w-4 h-4 text-[var(--color-primary)]" />
                <span className="max-w-[160px] truncate">{activeCompany?.name || company.name}</span>
                <ChevronDown className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
              </button>

              {companyMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setCompanyMenuOpen(false)} />
                  <div className="absolute left-0 top-full mt-1.5 w-64 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-lg py-2 z-50 text-left animate-slide-in">
                    <div className="px-3 py-1.5 text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest border-b border-[var(--color-border)] mb-1">
                      Companies / الشركات
                    </div>
                    <div className="max-h-56 overflow-y-auto">
                      {companies.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => { setCompanyMenuOpen(false); switchCompany(c.id); }}
                          className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs hover:bg-[var(--color-surface-offset)] transition-colors cursor-pointer ${
                            c.id === activeCompanyId ? 'text-[var(--color-primary)] font-bold' : 'text-[var(--color-text)]'
                          }`}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <Building className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{c.name}</span>
                          </span>
                          {c.id === activeCompanyId
                            ? <Check className="w-3.5 h-3.5 shrink-0" />
                            : <span className="text-[9px] uppercase text-[var(--color-text-faint)] font-bold">{c.role}</span>}
                        </button>
                      ))}
                    </div>
                    <div className="border-t border-[var(--color-border)] mt-1 pt-2 px-2">
                      <div className="flex items-center gap-1.5">
                        <input
                          value={newCompanyName}
                          onChange={(e) => setNewCompanyName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleCreateCompany(); }}
                          placeholder="New company name…"
                          className="flex-1 premium-input py-1.5 text-xs"
                        />
                        <button
                          onClick={handleCreateCompany}
                          disabled={!newCompanyName.trim() || creatingCompany}
                          className="p-1.5 rounded-md bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white transition-colors cursor-pointer disabled:opacity-50"
                          title="Create company"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Command palette trigger (⌘K) */}
            <button
              onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true }))}
              className="hidden sm:flex items-center gap-2 pl-2.5 pr-2 py-1.5 rounded-md border border-[var(--color-border)]/80 hover:bg-[var(--color-surface-offset)] text-[var(--color-text-muted)] transition-colors cursor-pointer"
              title="Search & commands (Ctrl/⌘ K)"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="text-[11px] font-semibold hidden md:inline">Search…</span>
              <kbd className="hidden md:inline-flex">⌘K</kbd>
            </button>

            {/* Density toggle */}
            <button
              onClick={() => setWorkspaceMode('desktop')}
              title="Open Desktop Workspace"
              className="hidden lg:grid p-2 hover:bg-[var(--color-surface-offset)] rounded-full text-[var(--color-text-muted)] transition-colors cursor-pointer"
              aria-label="Open desktop workspace"
            >
              <AppWindow className="w-4 h-4" />
            </button>

            {/* Density toggle */}
            <button
              onClick={() => setDensity(density === 'compact' ? 'comfortable' : 'compact')}
              title={`Density: ${density} (click to toggle)`}
              className="p-2 hover:bg-[var(--color-surface-offset)] rounded-full text-[var(--color-text-muted)] transition-colors cursor-pointer"
              aria-label="Toggle density"
            >
              <Rows3 className="w-4 h-4" />
            </button>

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
