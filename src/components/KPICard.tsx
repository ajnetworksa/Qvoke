import React, { useState, useEffect } from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface KPICardProps {
  label: string;
  value: number;
  change: number;
  icon: LucideIcon;
  format?: 'currency' | 'number';
  currency?: string;
}

export const KPICard: React.FC<KPICardProps> = ({
  label,
  value,
  change,
  icon: Icon,
  format = 'number',
  currency = 'SAR'
}) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = value;
    const duration = 800; // 800ms count animation
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsedTime = currentTime - startTime;
      const progress = Math.min(elapsedTime / duration, 1);
      
      // Ease out quad formula
      const easeProgress = progress * (2 - progress);
      const currentValue = start + (end - start) * easeProgress;
      
      setDisplayValue(currentValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(end);
      }
    };

    requestAnimationFrame(animate);
  }, [value]);

  const formatNumber = (num: number) => {
    if (format === 'currency') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        maximumFractionDigits: 0
      }).format(num);
    }
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0
    }).format(num);
  };

  const isPositive = change >= 0;

  return (
    <div className="premium-card p-6 flex flex-col justify-between transition-all duration-[var(--transition-interactive)] hover:border-[var(--color-primary)]/40 hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
          {label}
        </span>
        <Icon className="w-5 h-5 text-[var(--color-text-muted)]" />
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-[var(--color-text)]">
          {formatNumber(displayValue)}
        </span>
        
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${
            isPositive
              ? 'bg-[var(--color-success)]/10 border-[var(--color-success)]/20 text-[var(--color-success)]'
              : 'bg-[var(--color-error)]/10 border-[var(--color-error)]/20 text-[var(--color-error)]'
          }`}
        >
          {isPositive ? (
            <TrendingUp className="w-3 h-3 mr-0.5" />
          ) : (
            <TrendingDown className="w-3 h-3 mr-0.5" />
          )}
          {Math.abs(change)}%
        </span>
      </div>

      <div className="mt-2 text-xs text-[var(--color-text-muted)]">
        vs last month / مقارنة بالشهر السابق
      </div>
    </div>
  );
};
export default KPICard;
