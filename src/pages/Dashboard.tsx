import React from 'react';
import { useERPStore } from '../store';
import { KPICard } from '../components/KPICard';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import {
  DollarSign,
  FileText,
  Clock,
  AlertTriangle,
  Plus,
  FileSpreadsheet,
  ArrowRight,
  TrendingUp
} from 'lucide-react';
import { mockUsers } from '../mockData';

export const Dashboard: React.FC = () => {
  const { invoices, quotations, setRoute, company, currentUser } = useERPStore();
  const canViewRevenue = currentUser?.role === 'admin' || !!currentUser?.permissions?.canViewRevenue;

  // Dynamic calculations based on state
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
    {
      label: 'Open Quotes / العروض المفتوحة',
      value: openQuotes,
      change: 4.8,
      icon: FileSpreadsheet,
      format: 'number' as const
    },
    {
      label: 'Unpaid Invoices / فواتير غير مدفوعة',
      value: unpaidInvoices,
      change: -2.1,
      icon: Clock,
      format: 'number' as const
    },
    {
      label: 'Overdue Invoices / فواتير متأخرة',
      value: overdueInvoices,
      change: 8.5,
      icon: AlertTriangle,
      format: 'number' as const
    }
  ];

  // Generate dynamic recent activity
  const recentActivities = [
    {
      id: 'act-1',
      user: mockUsers[3], // Alice
      action: 'created quotation',
      target: 'QT-2026-0002',
      targetType: 'quote',
      time: '10 mins ago',
      status: 'sent' as const
    },
    {
      id: 'act-2',
      user: mockUsers[0], // Admin
      action: 'recorded payment of 5,080.13 SAR on',
      target: 'INV-2026-0002',
      targetType: 'invoice',
      time: '2 hours ago',
      status: 'paid' as const
    },
    {
      id: 'act-3',
      user: mockUsers[2], // Fahad
      action: 'confirmed quotation',
      target: 'QT-2026-0003',
      targetType: 'quote',
      time: '1 day ago',
      status: 'confirmed' as const
    },
    {
      id: 'act-4',
      user: mockUsers[3], // Alice
      action: 'created invoice draft',
      target: 'INV-2026-0001',
      targetType: 'invoice',
      time: '2 days ago',
      status: 'draft' as const
    },
    {
      id: 'act-5',
      user: mockUsers[3], // Alice
      action: 'marked as overdue',
      target: 'INV-2026-0004',
      targetType: 'invoice',
      time: '5 days ago',
      status: 'overdue' as const
    }
  ];

  // 12-Month Sales History (SVG chart)
  const chartData = [
    { month: 'Jun 25', sales: 12000 },
    { month: 'Jul 25', sales: 19000 },
    { month: 'Aug 25', sales: 15000 },
    { month: 'Sep 25', sales: 22000 },
    { month: 'Oct 25', sales: 34000 },
    { month: 'Nov 25', sales: 29000 },
    { month: 'Dec 25', sales: 42000 },
    { month: 'Jan 26', sales: 31000 },
    { month: 'Feb 26', sales: 38000 },
    { month: 'Mar 26', sales: 45000 },
    { month: 'Apr 26', sales: 48000 },
    { month: 'May 26', sales: totalRevenue > 0 ? totalRevenue : 52000 }
  ];

  const maxVal = Math.max(...chartData.map(d => d.sales));

  const handleTargetClick = (type: string, number: string) => {
    if (type === 'quote') {
      const q = quotations.find(item => item.number === number);
      if (q) setRoute('quotation-detail', q.id);
    } else {
      const inv = invoices.find(item => item.number === number);
      if (inv) setRoute('invoice-detail', inv.id);
    }
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
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-semibold py-2.5 px-4 rounded-md flex items-center gap-1.5 transition-colors shadow-sm"
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
        {/* Sales Chart */}
        {canViewRevenue && (
          <div className="lg:col-span-2 premium-card p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-[var(--color-divider)]/40 pb-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-[var(--color-text)]">
                  Sales Overview / نظرة عامة على المبيعات
                </h3>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Monthly revenue distribution over the last 12 months
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs font-bold text-[var(--color-success)] bg-[var(--color-success)]/10 border border-[var(--color-success)]/20 px-2 py-0.5 rounded-full">
                <TrendingUp className="w-3.5 h-3.5" />
                +15.2% YoY
              </div>
            </div>

            {/* Pure SVG premium bar chart */}
            <div className="w-full h-64 mt-2 relative">
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                {[0, 1, 2, 3, 4].map((gridLine) => {
                  const lineVal = Math.round((maxVal / 4) * (4 - gridLine));
                  return (
                    <div key={gridLine} className="w-full flex items-center border-t border-[var(--color-border)]/20 pt-1 text-[10px] text-[var(--color-text-muted)] font-mono">
                      <span className="bg-[var(--color-surface)] pr-2">{lineVal >= 1000 ? `${(lineVal / 1000).toFixed(0)}k` : lineVal}</span>
                    </div>
                  );
                })}
              </div>

              <div className="absolute inset-x-0 bottom-6 top-2 flex items-end justify-between px-4">
                {chartData.map((d, i) => {
                  const heightPercent = (d.sales / maxVal) * 90;
                  return (
                    <div key={i} className="flex flex-col items-center flex-1 group">
                      <div className="relative w-full flex justify-center">
                        {/* Tooltip on hover */}
                        <span className="absolute -top-8 bg-[var(--color-text)] text-[var(--color-bg)] text-[10px] font-bold py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-sm pointer-events-none whitespace-nowrap z-10">
                          {d.sales.toLocaleString()} {company.currency}
                        </span>
                        {/* Bar */}
                        <div
                          className="w-5/6 max-w-[28px] bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] rounded-t-sm transition-all duration-300 shadow-sm cursor-pointer"
                          style={{ height: `${heightPercent}%`, minHeight: '4px' }}
                        />
                      </div>
                      {/* Label */}
                      <span className="text-[10px] text-[var(--color-text-muted)] mt-2 font-mono whitespace-nowrap">
                        {d.month.split(' ')[0]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Recent Activity */}
        <div className={`${canViewRevenue ? 'lg:col-span-1' : 'lg:col-span-3'} premium-card p-6 flex flex-col justify-between`}>
          <div>
            <div className="border-b border-[var(--color-divider)]/40 pb-4 mb-4">
              <h3 className="text-base font-bold text-[var(--color-text)]">
                Recent Operations / العمليات الأخيرة
              </h3>
              <p className="text-xs text-[var(--color-text-muted)]">
                Real-time activity log from the sales pipeline
              </p>
            </div>

            <div className="flex flex-col gap-4 max-h-[290px] overflow-y-auto pr-1">
              {recentActivities.map((act) => (
                <div key={act.id} className="flex gap-3 text-sm items-start">
                  <img
                    src={act.user.avatar}
                    alt={act.user.name}
                    className="w-8 h-8 rounded-full border border-[var(--color-border)] flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[var(--color-text)] leading-tight">
                      <span className="font-semibold text-[var(--color-text)]">{act.user.name}</span>{' '}
                      {act.action}{' '}
                      <button
                        onClick={() => handleTargetClick(act.targetType, act.target)}
                        className="font-bold text-[var(--color-primary)] hover:underline inline cursor-pointer text-xs"
                      >
                        {act.target}
                      </button>
                    </p>
                    <span className="text-[10px] text-[var(--color-text-muted)] block mt-0.5">
                      {act.time}
                    </span>
                  </div>
                  <div className="flex-shrink-0">
                    <StatusBadge status={act.status} />
                  </div>
                </div>
              ))}
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
