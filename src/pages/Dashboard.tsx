import React, { useEffect, useMemo, useState } from 'react';
import { useERPStore } from '../store';
import { KPICard } from '../components/KPICard';
import { PageHeader } from '../components/PageHeader';
import { DocumentActivity } from '../types';
import {
  DollarSign,
  Clock,
  AlertTriangle,
  Plus,
  FileSpreadsheet,
  FileText,
  ArrowRight,
  TrendingUp,
  CheckCircle2,
  Activity as ActivityIcon,
  FilePlus2,
  Pencil,
  RefreshCw,
  Trash2,
  Filter
} from 'lucide-react';

// Relative "x ago" formatter for the activity feed.
const timeAgo = (iso: string) => {
  const d = new Date(iso).getTime();
  if (isNaN(d)) return '';
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min${m > 1 ? 's' : ''} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;
  return new Date(iso).toLocaleDateString();
};

const ACTION_META: Record<string, { icon: React.ElementType; verb: string; cls: string }> = {
  created: { icon: FilePlus2, verb: 'created', cls: 'text-emerald-500' },
  updated: { icon: Pencil, verb: 'updated', cls: 'text-[var(--color-primary)]' },
  status_changed: { icon: RefreshCw, verb: 'changed status of', cls: 'text-amber-500' },
  deleted: { icon: Trash2, verb: 'deleted', cls: 'text-red-500' }
};

export const Dashboard: React.FC = () => {
  const { invoices, quotations, setRoute, company, currentUser, features } = useERPStore();
  const canViewRevenue = currentUser?.role === 'admin' || !!currentUser?.permissions?.canViewRevenue;
  const canViewHistory = currentUser?.role === 'admin' || !!currentUser?.permissions?.canViewHistory;
  const trackingOn = features['tracking'] !== false;

  // Dynamic KPI calculations.
  const totalRevenue = invoices.reduce((sum, inv) => sum + inv.amountPaid, 0);
  const openQuotes = quotations.filter(q => q.status === 'draft' || q.status === 'sent').length;
  const unpaidInvoices = invoices.filter(i => i.status === 'posted' || i.status === 'partial').length;
  const overdueInvoices = invoices.filter(i => i.status === 'overdue').length;

  const stats = [
    ...(canViewRevenue ? [{
      label: 'Total Revenue / إجمالي الإيرادات',
      value: totalRevenue,
      change: 12.4,
      icon: DollarSign,
      format: 'currency' as const
    }] : []),
    { label: 'Open Quotes / العروض المفتوحة', value: openQuotes, change: 4.8, icon: FileSpreadsheet, format: 'number' as const },
    { label: 'Unpaid Invoices / فواتير غير مدفوعة', value: unpaidInvoices, change: -2.1, icon: Clock, format: 'number' as const },
    { label: 'Overdue Invoices / فواتير متأخرة', value: overdueInvoices, change: 8.5, icon: AlertTriangle, format: 'number' as const }
  ];

  // ── Real 12-month revenue series, bucketed from invoice dates ───────────────
  const chartData = useMemo(() => {
    const buckets: { key: string; month: string; sales: number }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        month: d.toLocaleString('en', { month: 'short' }),
        sales: 0
      });
    }
    const idx = new Map(buckets.map((b, i) => [b.key, i]));
    invoices.forEach((inv) => {
      const dt = new Date(inv.date);
      if (isNaN(dt.getTime())) return;
      const k = `${dt.getFullYear()}-${dt.getMonth()}`;
      const i = idx.get(k);
      if (i !== undefined) buckets[i].sales += inv.total || 0;
    });
    return buckets;
  }, [invoices]);

  const maxVal = Math.max(1, ...chartData.map(d => d.sales));
  const hasRevenueData = chartData.some(d => d.sales > 0);

  // Build a smooth-ish area path for the SVG chart (0..100 viewBox).
  const W = 100, H = 100;
  const points = chartData.map((d, i) => {
    const x = chartData.length > 1 ? (i / (chartData.length - 1)) * W : 0;
    const y = H - (d.sales / maxVal) * (H - 8) - 2;
    return { x, y };
  });
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
  const areaPath = `${linePath} L${W},${H} L0,${H} Z`;

  // ── Conversion funnel (real counts) ────────────────────────────────────────
  const funnel = useMemo(() => {
    const totalQuotes = quotations.length;
    const confirmed = quotations.filter(q => q.status === 'confirmed').length;
    const invoiced = invoices.length;
    const paid = invoices.filter(i => i.status === 'paid').length;
    return [
      { label: 'Quotations', value: totalQuotes, icon: FileSpreadsheet, color: 'var(--color-primary)' },
      { label: 'Confirmed', value: confirmed, icon: CheckCircle2, color: 'var(--color-success)' },
      { label: 'Invoiced', value: invoiced, icon: FileText, color: 'var(--color-warning)' },
      { label: 'Paid', value: paid, icon: DollarSign, color: 'var(--color-success)' }
    ];
  }, [quotations, invoices]);
  const funnelMax = Math.max(1, ...funnel.map(f => f.value));

  // ── Real activity feed from the audit log ──────────────────────────────────
  const [activity, setActivity] = useState<DocumentActivity[]>([]);
  const [activityLoaded, setActivityLoaded] = useState(false);
  useEffect(() => {
    if (!canViewHistory || !trackingOn) { setActivityLoaded(true); return; }
    const token = useERPStore.getState().token;
    (async () => {
      try {
        const res = await fetch('/api/audit?limit=8', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) setActivity(await res.json());
      } catch { /* ignore */ } finally {
        setActivityLoaded(true);
      }
    })();
  }, [canViewHistory, trackingOn]);

  const openActivityDoc = (a: DocumentActivity) => {
    if (a.docType === 'quotation') setRoute('quotation-detail', a.docId);
    else if (a.docType === 'invoice') setRoute('invoice-detail', a.docId);
    else if (a.docType === 'boq' || a.docType === 'bom') setRoute('boq');
  };

  return (
    <div className="animate-fade-in text-left">
      <PageHeader
        title="Dashboard / لوحة التحكم"
        breadcrumbs={[{ label: 'Home' }, { label: 'Dashboard' }]}
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => setRoute('quotation-detail', 'new')}
              className="btn-gradient text-xs font-semibold py-2.5 px-4 rounded-md flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              New Quote / عرض جديد
            </button>
            <button
              onClick={() => setRoute('invoice-detail', 'new')}
              className="bg-[var(--color-surface-offset)] hover:bg-[var(--color-divider)] border border-[var(--color-border)] text-[var(--color-text)] text-xs font-semibold py-2.5 px-4 rounded-md flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4 text-[var(--color-text-muted)]" />
              New Invoice / فاتورة جديدة
            </button>
          </div>
        }
      />

      {/* KPI Grid */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${canViewRevenue ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-6 mb-8`}>
        {stats.map((s, idx) => (
          <KPICard
            key={idx}
            label={s.label}
            value={s.value}
            change={s.change}
            icon={s.icon}
            format={s.format}
            currency={company.currency}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sales Chart (real) */}
        {canViewRevenue && (
          <div className="lg:col-span-2 premium-card interactive p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-[var(--color-divider)]/40 pb-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-[var(--color-text)]">
                  Sales Overview / نظرة عامة على المبيعات
                </h3>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Invoiced value over the last 12 months
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs font-bold text-[var(--color-success)] bg-[var(--color-success)]/10 border border-[var(--color-success)]/20 px-2 py-0.5 rounded-full">
                <TrendingUp className="w-3.5 h-3.5" />
                {chartData.reduce((s, d) => s + d.sales, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} {company.currency}
              </div>
            </div>

            {!hasRevenueData ? (
              <div className="h-64 flex flex-col items-center justify-center text-center text-[var(--color-text-muted)]">
                <ActivityIcon className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-sm font-semibold">No invoiced revenue yet</p>
                <p className="text-xs">Sales will appear here as invoices are issued.</p>
              </div>
            ) : (
              <div className="w-full h-64 mt-2 relative">
                {/* Gridlines + Y labels */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                  {[0, 1, 2, 3, 4].map((g) => {
                    const lineVal = Math.round((maxVal / 4) * (4 - g));
                    return (
                      <div key={g} className="w-full flex items-center border-t border-[var(--color-border)]/20 text-[10px] text-[var(--color-text-muted)] font-mono">
                        <span className="bg-[var(--color-surface)] pr-2">{lineVal >= 1000 ? `${(lineVal / 1000).toFixed(0)}k` : lineVal}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Area + line */}
                <div className="absolute inset-x-0 bottom-6 top-1 px-2">
                  <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-full overflow-visible">
                    <defs>
                      <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.28" />
                        <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d={areaPath} fill="url(#salesFill)" />
                    <path d={linePath} fill="none" stroke="var(--color-primary)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
                    {points.map((p, i) => (
                      <circle key={i} cx={p.x} cy={p.y} r="1.6" fill="var(--color-primary)" vectorEffect="non-scaling-stroke">
                        <title>{`${chartData[i].month}: ${chartData[i].sales.toLocaleString()} ${company.currency}`}</title>
                      </circle>
                    ))}
                  </svg>
                </div>

                {/* X labels */}
                <div className="absolute inset-x-0 bottom-0 flex justify-between px-2">
                  {chartData.map((d, i) => (
                    <span key={i} className="text-[10px] text-[var(--color-text-muted)] font-mono">{d.month}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Conversion funnel */}
            <div className="mt-6 pt-4 border-t border-[var(--color-divider)]/30">
              <p className="text-[11px] font-black uppercase tracking-wider text-[var(--color-text-muted)] mb-3 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5" /> Sales Funnel
              </p>
              <div className="grid grid-cols-4 gap-3">
                {funnel.map((f) => {
                  const Icon = f.icon;
                  return (
                    <div key={f.label} className="text-center">
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <Icon className="w-3.5 h-3.5" style={{ color: f.color }} />
                        <span className="text-lg font-bold font-mono text-[var(--color-text)]">{f.value}</span>
                      </div>
                      <div className="w-full bg-[var(--color-surface-2)] h-1.5 rounded overflow-hidden mb-1">
                        <div className="h-full rounded transition-all duration-500" style={{ width: `${(f.value / funnelMax) * 100}%`, background: f.color }} />
                      </div>
                      <span className="text-[10px] text-[var(--color-text-muted)] font-semibold">{f.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Recent Activity (real audit log) */}
        <div className={`${canViewRevenue ? 'lg:col-span-1' : 'lg:col-span-3'} premium-card interactive p-6 flex flex-col justify-between`}>
          <div>
            <div className="border-b border-[var(--color-divider)]/40 pb-4 mb-4">
              <h3 className="text-base font-bold text-[var(--color-text)]">
                Recent Operations / العمليات الأخيرة
              </h3>
              <p className="text-xs text-[var(--color-text-muted)]">
                Activity log from the audit trail
              </p>
            </div>

            <div className="flex flex-col gap-1 max-h-[320px] overflow-y-auto pr-1 -mx-2">
              {!canViewHistory || !trackingOn ? (
                <p className="text-xs text-[var(--color-text-muted)] italic px-2 py-6 text-center">
                  Activity tracking is unavailable on your plan or permissions.
                </p>
              ) : activityLoaded && activity.length === 0 ? (
                <p className="text-xs text-[var(--color-text-muted)] italic px-2 py-6 text-center">
                  No recent activity recorded yet.
                </p>
              ) : (
                activity.map((a) => {
                  const meta = ACTION_META[a.action] || ACTION_META.updated;
                  const Icon = meta.icon;
                  return (
                    <button
                      key={a.id}
                      onClick={() => openActivityDoc(a)}
                      className="flex gap-3 items-start text-left px-2 py-2 rounded-lg hover:bg-[var(--color-surface-offset)] transition-colors cursor-pointer"
                    >
                      <div className={`mt-0.5 shrink-0 ${meta.cls}`}><Icon className="w-4 h-4" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-[var(--color-text)] leading-snug">
                          <span className="font-semibold">{a.actorName || 'Someone'}</span>{' '}
                          {meta.verb}{' '}
                          <span className="font-bold text-[var(--color-primary)]">{a.docNumber || a.docType}</span>
                        </p>
                        <span className="text-[10px] text-[var(--color-text-muted)] block mt-0.5 capitalize">
                          {a.docType} · {timeAgo(a.timestamp)}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <button
            onClick={() => setRoute('quotations')}
            className="w-full mt-4 flex items-center justify-center gap-1.5 text-xs font-bold text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] border border-[var(--color-primary)]/10 hover:bg-[var(--color-primary-highlight)]/20 py-2.5 rounded-md transition-all cursor-pointer"
          >
            Go to Sales Journal / السجل المالي
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
export default Dashboard;
