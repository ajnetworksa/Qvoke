import React from 'react';

export type BadgeStatus = 'draft' | 'sent' | 'confirmed' | 'expired' | 'cancelled' | 'posted' | 'partial' | 'paid' | 'overdue';

interface StatusBadgeProps {
  status: BadgeStatus;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getStyles = () => {
    switch (status) {
      case 'draft':
        return {
          bg: 'bg-surface-offset border-divider text-text-muted',
          label: 'Draft / مسودة'
        };
      case 'sent':
        return {
          bg: 'bg-[var(--color-primary-highlight)]/30 border-[var(--color-primary)]/20 text-[var(--color-primary)]',
          label: 'Sent / تم الإرسال'
        };
      case 'confirmed':
        return {
          bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
          label: 'Confirmed / مؤكد'
        };
      case 'expired':
        return {
          bg: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400',
          label: 'Expired / منتهي'
        };
      case 'cancelled':
        return {
          bg: 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400',
          label: 'Cancelled / ملغي'
        };
      case 'posted':
        return {
          bg: 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400',
          label: 'Posted / مرحل'
        };
      case 'partial':
        return {
          bg: 'bg-orange-500/10 border-orange-500/20 text-orange-600 dark:text-orange-400',
          label: 'Partial / جزئي'
        };
      case 'paid':
        return {
          bg: 'bg-[var(--color-success)]/10 border-[var(--color-success)]/20 text-[var(--color-success)]',
          label: 'Paid / مدفوع'
        };
      case 'overdue':
        return {
          bg: 'bg-[var(--color-error)]/10 border-[var(--color-error)]/20 text-[var(--color-error)]',
          label: 'Overdue / متأخر'
        };
      default:
        return {
          bg: 'bg-surface-offset border-divider text-text-muted',
          label: status
        };
    }
  };

  const config = getStyles();

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full border transition-all duration-[var(--transition-interactive)] ${config.bg}`}
    >
      {config.label}
    </span>
  );
};
export default StatusBadge;
