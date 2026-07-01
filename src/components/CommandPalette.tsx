import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useERPStore } from '../store';
import {
  Search,
  FileSpreadsheet,
  FileText,
  Users,
  Package,
  LayoutDashboard,
  ClipboardList,
  CheckSquare,
  Settings as SettingsIcon,
  Plus,
  Sun,
  Moon,
  Rows3,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
  Command as CommandIcon,
  TrendingUp,
  Building,
  Radar
} from 'lucide-react';

interface CommandItem {
  id: string;
  label: string;
  sub?: string;
  group: string;
  icon: React.ElementType;
  keywords?: string;
  run: () => void;
}

const isTypingTarget = (el: EventTarget | null) => {
  const t = el as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
};

export const CommandPalette: React.FC = () => {
  const {
    setRoute,
    quotations,
    invoices,
    customers,
    products,
    theme,
    setTheme,
    density,
    setDensity,
    features
  } = useERPStore();

  const [open, setOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const chordRef = useRef<{ key: string; at: number } | null>(null);

  const featureOn = (k: string) => features[k] !== false;

  // Build the full command set from nav, quick actions, and live records.
  const commands = useMemo<CommandItem[]>(() => {
    const go = (page: string, id?: string) => () => { setRoute(page, id); setOpen(false); };

    const nav: CommandItem[] = [
      { id: 'nav-dash', label: 'Dashboard', group: 'Navigate', icon: LayoutDashboard, run: go('dashboard') },
      featureOn('tasks') && { id: 'nav-tasks', label: 'My Tasks', group: 'Navigate', icon: CheckSquare, run: go('tasks') },
      featureOn('quotations') && { id: 'nav-quotes', label: 'Quotations', group: 'Navigate', icon: FileSpreadsheet, run: go('quotations') },
      featureOn('invoices') && { id: 'nav-invoices', label: 'Invoices', group: 'Navigate', icon: FileText, run: go('invoices') },
      featureOn('boq') && { id: 'nav-boq', label: 'BOQ / BOM', group: 'Navigate', icon: ClipboardList, run: go('boq') },
      featureOn('tracking') && { id: 'nav-tracking', label: 'Tracking & Follow-ups', group: 'Navigate', icon: Radar, run: go('tracking') },
      featureOn('reports') && { id: 'nav-reports', label: 'Financials', group: 'Navigate', icon: TrendingUp, run: go('reports') },
      featureOn('customers') && { id: 'nav-customers', label: 'Customers', group: 'Navigate', icon: Users, run: go('customers') },
      featureOn('suppliers') && { id: 'nav-suppliers', label: 'Suppliers', group: 'Navigate', icon: Building, run: go('suppliers') },
      featureOn('products') && { id: 'nav-products', label: 'Catalog', group: 'Navigate', icon: Package, run: go('products') },
      { id: 'nav-companies', label: 'Companies', group: 'Navigate', icon: Building, keywords: 'organization tenant switch', run: go('companies') },
      { id: 'nav-settings', label: 'Settings', group: 'Navigate', icon: SettingsIcon, run: go('settings') },
    ].filter(Boolean) as CommandItem[];

    const actions: CommandItem[] = [
      { id: 'act-new-quote', label: 'New Quotation', group: 'Actions', icon: Plus, keywords: 'create add', run: go('quotation-detail', 'new') },
      { id: 'act-new-invoice', label: 'New Invoice', group: 'Actions', icon: Plus, keywords: 'create add', run: go('invoice-detail', 'new') },
      {
        id: 'act-theme', label: `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`, group: 'Actions',
        icon: theme === 'dark' ? Sun : Moon, keywords: 'dark light appearance',
        run: () => { setTheme(theme === 'dark' ? 'light' : 'dark'); setOpen(false); }
      },
      {
        id: 'act-density', label: `${density === 'compact' ? 'Comfortable' : 'Compact'} density`, group: 'Actions',
        icon: Rows3, keywords: 'compact spacing comfortable',
        run: () => { setDensity(density === 'compact' ? 'comfortable' : 'compact'); setOpen(false); }
      },
    ];

    const records: CommandItem[] = [];
    quotations.slice(0, 200).forEach((q) => {
      const cust = customers.find((c) => c.id === q.customerId);
      records.push({
        id: `q-${q.id}`, label: q.number || 'Draft quote', sub: cust?.companyName || q.subject || '',
        group: 'Quotations', icon: FileSpreadsheet, keywords: `${cust?.companyName || ''} ${q.status}`,
        run: go('quotation-detail', q.id)
      });
    });
    invoices.slice(0, 200).forEach((inv) => {
      const cust = customers.find((c) => c.id === inv.customerId);
      records.push({
        id: `i-${inv.id}`, label: inv.number || 'Draft invoice', sub: cust?.companyName || '',
        group: 'Invoices', icon: FileText, keywords: `${cust?.companyName || ''} ${inv.status}`,
        run: go('invoice-detail', inv.id)
      });
    });
    customers.slice(0, 200).forEach((c) => {
      records.push({
        id: `c-${c.id}`, label: c.companyName, sub: c.contactPerson || c.email || '',
        group: 'Customers', icon: Users, keywords: `${c.email} ${c.phone}`,
        run: go('customers')
      });
    });
    products.slice(0, 200).forEach((p) => {
      records.push({
        id: `p-${p.id}`, label: p.name, sub: p.type,
        group: 'Catalog', icon: Package, run: go('products')
      });
    });

    return [...nav, ...actions, ...records];
  }, [setRoute, quotations, invoices, customers, products, theme, setTheme, density, setDensity, features]);

  // Filter + cap results for performance.
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Show nav + actions first when nothing is typed.
      return commands.filter((c) => c.group === 'Navigate' || c.group === 'Actions');
    }
    const tokens = q.split(/\s+/);
    const scored = commands
      .map((c) => {
        const hay = `${c.label} ${c.sub || ''} ${c.keywords || ''} ${c.group}`.toLowerCase();
        const ok = tokens.every((t) => hay.includes(t));
        if (!ok) return null;
        // Light scoring: prefix match on label ranks higher.
        const score = c.label.toLowerCase().startsWith(q) ? 0 : c.label.toLowerCase().includes(q) ? 1 : 2;
        return { c, score };
      })
      .filter(Boolean) as { c: CommandItem; score: number }[];
    return scored.sort((a, b) => a.score - b.score).slice(0, 40).map((s) => s.c);
  }, [query, commands]);

  // Group results for rendering, preserving order.
  const grouped = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    results.forEach((r) => {
      if (!map.has(r.group)) map.set(r.group, []);
      map.get(r.group)!.push(r);
    });
    return Array.from(map.entries());
  }, [results]);

  const flat = results;

  // Reset highlight/scroll when the result set changes.
  useEffect(() => { setActive(0); }, [query, open]);
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 10);
    else setQuery('');
  }, [open]);

  // Global keyboard handling: open palette, help, and nav chords.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // ⌘K / Ctrl+K toggles the palette from anywhere.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setHelpOpen(false);
        setOpen((o) => !o);
        return;
      }
      if (e.key === 'Escape') {
        setOpen(false);
        setHelpOpen(false);
        return;
      }
      // Single-key shortcuts only when not typing and nothing is open.
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (open) return;

      if (e.key === '?') { e.preventDefault(); setHelpOpen((h) => !h); return; }
      if (e.key === 'n') { e.preventDefault(); setRoute('quotation-detail', 'new'); return; }

      // "g" then a letter = go to section.
      const now = Date.now();
      const chord = chordRef.current;
      if (chord && chord.key === 'g' && now - chord.at < 1200) {
        const dest: Record<string, string> = {
          d: 'dashboard', q: 'quotations', i: 'invoices', b: 'boq',
          c: 'customers', p: 'products', t: 'tasks', r: 'reports', s: 'settings'
        };
        if (dest[e.key]) { e.preventDefault(); setRoute(dest[e.key]); }
        chordRef.current = null;
        return;
      }
      if (e.key === 'g') { chordRef.current = { key: 'g', at: now }; }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setRoute]);

  // Arrow / Enter navigation within the palette.
  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, flat.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); flat[active]?.run(); }
  };

  // Keep the active row in view.
  useEffect(() => {
    const node = listRef.current?.querySelector(`[data-idx="${active}"]`);
    node?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const shortcuts: { keys: string[]; label: string }[] = [
    { keys: ['⌘', 'K'], label: 'Open command palette' },
    { keys: ['?'], label: 'Show this help' },
    { keys: ['n'], label: 'New quotation' },
    { keys: ['g', 'd'], label: 'Go to Dashboard' },
    { keys: ['g', 'q'], label: 'Go to Quotations' },
    { keys: ['g', 'i'], label: 'Go to Invoices' },
    { keys: ['g', 'b'], label: 'Go to BOQ / BOM' },
    { keys: ['g', 'c'], label: 'Go to Customers' },
    { keys: ['g', 'p'], label: 'Go to Catalog' },
    { keys: ['g', 't'], label: 'Go to My Tasks' },
    { keys: ['g', 'r'], label: 'Go to Financials' },
    { keys: ['Esc'], label: 'Close' },
  ];

  return (
    <>
      {/* ── Command Palette ─────────────────────────────────────────────── */}
      {open && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setOpen(false)} />
          <div
            className="relative w-full max-w-xl bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-lg overflow-hidden animate-scale-in"
            onKeyDown={onListKey}
          >
            <div className="flex items-center gap-3 px-4 border-b border-[var(--color-border)]">
              <Search className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search documents, customers, actions…"
                className="flex-1 bg-transparent py-3.5 text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-faint)]"
              />
              <kbd className="hidden sm:inline-flex">Esc</kbd>
            </div>

            <div ref={listRef} className="max-h-[55vh] overflow-y-auto py-2">
              {flat.length === 0 ? (
                <div className="px-4 py-10 text-center text-xs text-[var(--color-text-muted)]">
                  No matches for “{query}”.
                </div>
              ) : (
                grouped.map(([group, items]) => (
                  <div key={group} className="mb-1">
                    <div className="px-4 py-1 text-[10px] font-black uppercase tracking-widest text-[var(--color-text-faint)]">
                      {group}
                    </div>
                    {items.map((item) => {
                      const idx = flat.indexOf(item);
                      const Icon = item.icon;
                      const isActive = idx === active;
                      return (
                        <button
                          key={item.id}
                          data-idx={idx}
                          onMouseEnter={() => setActive(idx)}
                          onClick={() => item.run()}
                          className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors cursor-pointer ${
                            isActive ? 'bg-[var(--color-primary-highlight)]/40' : 'hover:bg-[var(--color-surface-offset)]'
                          }`}
                        >
                          <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}`} />
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-semibold text-[var(--color-text)] truncate">{item.label}</span>
                            {item.sub && <span className="block text-[11px] text-[var(--color-text-muted)] truncate">{item.sub}</span>}
                          </span>
                          {isActive && <CornerDownLeft className="w-3.5 h-3.5 text-[var(--color-text-faint)] shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center gap-4 px-4 py-2 border-t border-[var(--color-border)] text-[10px] text-[var(--color-text-muted)] font-semibold">
              <span className="flex items-center gap-1"><ArrowUp className="w-3 h-3" /><ArrowDown className="w-3 h-3" /> navigate</span>
              <span className="flex items-center gap-1"><CornerDownLeft className="w-3 h-3" /> open</span>
              <span className="ml-auto flex items-center gap-1"><CommandIcon className="w-3 h-3" /> Command palette</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Shortcuts Help ──────────────────────────────────────────────── */}
      {helpOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setHelpOpen(false)} />
          <div className="relative w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-lg p-6 animate-scale-in">
            <h3 className="text-sm font-bold text-[var(--color-text)] mb-4 flex items-center gap-2">
              <CommandIcon className="w-4 h-4 text-[var(--color-primary)]" /> Keyboard Shortcuts
            </h3>
            <div className="flex flex-col gap-2">
              {shortcuts.map((s, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-xs text-[var(--color-text-muted)]">{s.label}</span>
                  <span className="flex items-center gap-1">
                    {s.keys.map((k, j) => <kbd key={j}>{k}</kbd>)}
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setHelpOpen(false)}
              className="mt-5 w-full py-2 rounded-md bg-[var(--color-surface-offset)] hover:bg-[var(--color-divider)] text-xs font-bold text-[var(--color-text)] transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default CommandPalette;
