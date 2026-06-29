import React, { useEffect, useState } from 'react';
import { useERPStore } from '../store';
import { PageHeader } from '../components/PageHeader';
import { DollarSign, FileSpreadsheet, TrendingUp, AlertTriangle, BarChart3, Activity, Users } from 'lucide-react';

export const Reports: React.FC = () => {
  const { invoices, company, currentUser, features } = useERPStore();
  const canViewRevenue = currentUser?.role === 'admin' || !!currentUser?.permissions?.canViewRevenue;
  const usageEnabled = features['usage'] !== false;

  // Dynamic Financial aggregates
  const totalSales = invoices.reduce((sum, inv) => sum + inv.total, 0);
  const totalCollected = invoices.reduce((sum, inv) => sum + inv.amountPaid, 0);
  const totalOutstanding = invoices.reduce((sum, inv) => sum + inv.amountDue, 0);

  // Ageing Balance schedule modeling
  let agingCurrent = 0;
  let aging30 = 0;
  let aging60 = 0;
  let agingOver60 = 0;

  invoices.forEach((inv) => {
    if (inv.amountDue <= 0) return;

    const diffTime = Date.now() - new Date(inv.dueDate).getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      agingCurrent += inv.amountDue;
    } else if (diffDays <= 30) {
      aging30 += inv.amountDue;
    } else if (diffDays <= 60) {
      aging60 += inv.amountDue;
    } else {
      agingOver60 += inv.amountDue;
    }
  });

  const printReport = () => {
    window.print();
  };

  return (
    <div className="animate-fade-in text-left">
      <PageHeader
        title="Financial Ledger & Aging Reports / التقارير المالية"
        breadcrumbs={[{ label: 'Home' }, { label: 'Reports' }]}
        actions={
          <button
            onClick={printReport}
            className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-semibold py-2.5 px-4 rounded-md flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
          >
            Export Sheet / طباعة التقرير
          </button>
        }
      />

      {/* Overview stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="premium-card p-6 text-left">
          <div className="flex items-center justify-between text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-4">
            <span>Gross Billings / المبيعات</span>
            <DollarSign className="w-5 h-5 text-[var(--color-text-muted)]" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-[var(--color-text)] font-mono">
            {totalSales.toLocaleString(undefined, { minimumFractionDigits: 2 })} {company.currency}
          </span>
          <span className="text-[10px] text-[var(--color-success)] font-bold block mt-1">
            Total invoicing volume
          </span>
        </div>

        <div className="premium-card p-6 text-left">
          <div className="flex items-center justify-between text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-4">
            <span>Cash Collected / المحصل</span>
            <TrendingUp className="w-5 h-5 text-[var(--color-text-muted)]" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-emerald-600 font-mono">
            {totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })} {company.currency}
          </span>
          <span className="text-[10px] text-[var(--color-text-muted)] block mt-1">
            Collection rate: {totalSales > 0 ? ((totalCollected / totalSales) * 100).toFixed(1) : 0}%
          </span>
        </div>

        <div className="premium-card p-6 text-left">
          <div className="flex items-center justify-between text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-4">
            <span>Outstanding A/R / المستحق</span>
            <AlertTriangle className="w-5 h-5 text-[var(--color-text-muted)]" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-[var(--color-error)] font-mono">
            {totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })} {company.currency}
          </span>
          <span className="text-[10px] text-[var(--color-error)] font-bold block mt-1">
            Unpaid invoices ledger balance
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Accounts aging schedule */}
        <div className="lg:col-span-2 premium-card p-6 text-left flex flex-col justify-between">
          <div>
            <div className="border-b border-[var(--color-divider)]/40 pb-4 mb-4">
              <h3 className="text-sm font-bold text-[var(--color-text)]">
                Accounts Receivable Aging / أعمار الديون
              </h3>
              <p className="text-xs text-[var(--color-text-muted)]">
                Unpaid customer billing distributions classified by due milestones
              </p>
            </div>

            <div className="flex flex-col gap-4">
              {/* Current */}
              <div>
                <div className="flex justify-between text-xs font-bold text-[var(--color-text)] mb-2">
                  <span>Current (Not Due Yet)</span>
                  <span className="font-mono">{agingCurrent.toLocaleString()} {company.currency}</span>
                </div>
                <div className="w-full bg-[var(--color-surface-2)] h-2 rounded overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded transition-all duration-500"
                    style={{ width: `${totalOutstanding > 0 ? (agingCurrent / totalOutstanding) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* 1-30 Days */}
              <div>
                <div className="flex justify-between text-xs font-bold text-[var(--color-text)] mb-2">
                  <span>1 - 30 Days Overdue</span>
                  <span className="font-mono">{aging30.toLocaleString()} {company.currency}</span>
                </div>
                <div className="w-full bg-[var(--color-surface-2)] h-2 rounded overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded transition-all duration-500"
                    style={{ width: `${totalOutstanding > 0 ? (aging30 / totalOutstanding) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* 31-60 Days */}
              <div>
                <div className="flex justify-between text-xs font-bold text-[var(--color-text)] mb-2">
                  <span>31 - 60 Days Overdue</span>
                  <span className="font-mono">{aging60.toLocaleString()} {company.currency}</span>
                </div>
                <div className="w-full bg-[var(--color-surface-2)] h-2 rounded overflow-hidden">
                  <div
                    className="bg-[var(--color-warning)] h-full rounded transition-all duration-500"
                    style={{ width: `${totalOutstanding > 0 ? (aging60 / totalOutstanding) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* 60+ Days */}
              <div>
                <div className="flex justify-between text-xs font-bold text-[var(--color-text)] mb-2">
                  <span>60+ Days Overdue</span>
                  <span className="font-mono">{agingOver60.toLocaleString()} {company.currency}</span>
                </div>
                <div className="w-full bg-[var(--color-surface-2)] h-2 rounded overflow-hidden">
                  <div
                    className="bg-[var(--color-error)] h-full rounded transition-all duration-500"
                    style={{ width: `${totalOutstanding > 0 ? (agingOver60 / totalOutstanding) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
          
          <div className="text-[10px] text-[var(--color-text-muted)] mt-6 border-t border-[var(--color-divider)]/30 pt-4">
            Calculations are completed dynamically on-load relative to dates: {new Date().toLocaleDateString()}
          </div>
        </div>

        {/* Ledger sheet */}
        <div className="premium-card p-6 text-left">
          <div className="border-b border-[var(--color-divider)]/40 pb-4 mb-4">
            <h3 className="text-sm font-bold text-[var(--color-text)]">
              Ledger Metrics
            </h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              Quick summaries of billing performance
            </p>
          </div>

          <div className="flex flex-col gap-4 text-xs font-semibold text-[var(--color-text-muted)]">
            <div className="flex justify-between border-b border-[var(--color-border)]/50 pb-2">
              <span>Total invoices:</span>
              <span className="text-[var(--color-text)] font-bold">{invoices.length} docs</span>
            </div>
            <div className="flex justify-between border-b border border-transparent pb-2">
              <span>Paid invoices:</span>
              <span className="text-emerald-600 font-bold">
                {invoices.filter((i) => i.status === 'paid').length} docs
              </span>
            </div>
            <div className="flex justify-between border-b border border-transparent pb-2">
              <span>Overdue balances:</span>
              <span className="text-[var(--color-error)] font-bold">
                {invoices.filter((i) => i.status === 'overdue').length} docs
              </span>
            </div>
          </div>
        </div>
      </div>

      {canViewRevenue && usageEnabled && <UsageAnalyticsPanel />}
    </div>
  );
};

// ── Usage Analytics ───────────────────────────────────────────────────────────
interface UsageData {
  byType: { docType: string; action: string; count: number }[];
  byUser: { actorId: string; actorName: string; count: number }[];
  liveCounts: Record<string, number>;
}

const RANGE_OPTIONS: { key: string; label: string; days: number }[] = [
  { key: '7d', label: 'Last 7 days', days: 7 },
  { key: '30d', label: 'Last 30 days', days: 30 },
  { key: '90d', label: 'Last 90 days', days: 90 },
  { key: 'all', label: 'All time', days: 0 }
];

const UsageAnalyticsPanel: React.FC = () => {
  const token = useERPStore((s) => s.token);
  const [data, setData] = useState<UsageData | null>(null);
  const [range, setRange] = useState('30d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const opt = RANGE_OPTIONS.find((r) => r.key === range)!;
      const since = opt.days > 0
        ? new Date(Date.now() - opt.days * 86400000).toISOString()
        : '1970-01-01';
      try {
        const res = await fetch(`/api/usage?since=${encodeURIComponent(since)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok && !cancelled) setData(await res.json());
      } catch { /* ignore */ } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [range, token]);

  const createdByType = (() => {
    const map: Record<string, number> = {};
    (data?.byType || []).filter((r) => r.action === 'created').forEach((r) => {
      map[r.docType] = (map[r.docType] || 0) + r.count;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  })();
  const maxCreated = Math.max(1, ...createdByType.map(([, c]) => c));
  const maxUser = Math.max(1, ...(data?.byUser || []).map((u) => u.count));

  return (
    <div className="premium-card p-6 text-left mt-8">
      <div className="border-b border-[var(--color-divider)]/40 pb-4 mb-5 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-bold text-[var(--color-text)] flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[var(--color-primary)]" /> Usage Analytics / تحليلات الاستخدام
          </h3>
          <p className="text-xs text-[var(--color-text-muted)]">Document activity and creation volume by type and user.</p>
        </div>
        <select
          value={range}
          onChange={(e) => setRange(e.target.value)}
          className="premium-input text-xs py-1.5 w-auto"
        >
          {RANGE_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </div>

      {/* Live totals */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        {Object.entries(data?.liveCounts || {}).map(([k, v]) => (
          <div key={k} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-offset)]/30 p-3 text-center">
            <div className="text-lg font-bold font-mono text-[var(--color-text)]">{v}</div>
            <div className="text-[9px] font-black uppercase tracking-wider text-[var(--color-text-muted)] mt-0.5">{k}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <p className="text-xs text-[var(--color-text-muted)] italic py-4">Loading analytics…</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Documents created by type */}
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-[var(--color-text-muted)] mb-3 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" /> Documents Created
            </p>
            {createdByType.length === 0 ? (
              <p className="text-xs text-[var(--color-text-muted)] italic">No activity in this period.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {createdByType.map(([type, count]) => (
                  <div key={type}>
                    <div className="flex justify-between text-xs font-bold text-[var(--color-text)] mb-1.5 capitalize">
                      <span>{type}</span>
                      <span className="font-mono">{count}</span>
                    </div>
                    <div className="w-full bg-[var(--color-surface-2)] h-2 rounded overflow-hidden">
                      <div
                        className="bg-[var(--color-primary)] h-full rounded transition-all duration-500"
                        style={{ width: `${(count / maxCreated) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Most active users */}
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-[var(--color-text-muted)] mb-3 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Most Active Users
            </p>
            {(data?.byUser || []).length === 0 ? (
              <p className="text-xs text-[var(--color-text-muted)] italic">No activity in this period.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {(data?.byUser || []).slice(0, 8).map((u) => (
                  <div key={u.actorId}>
                    <div className="flex justify-between text-xs font-bold text-[var(--color-text)] mb-1.5">
                      <span className="truncate">{u.actorName || u.actorId || 'Unknown'}</span>
                      <span className="font-mono">{u.count}</span>
                    </div>
                    <div className="w-full bg-[var(--color-surface-2)] h-2 rounded overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded transition-all duration-500"
                        style={{ width: `${(u.count / maxUser) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
