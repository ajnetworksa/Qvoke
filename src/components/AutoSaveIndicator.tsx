import React from 'react';
import { Cloud, CloudOff, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { AutoSaveStatus } from '../hooks/useAutoSave';

interface AutoSaveIndicatorProps {
  status: AutoSaveStatus;
  onRetry?: () => void;
}

export const AutoSaveIndicator: React.FC<AutoSaveIndicatorProps> = ({ status, onRetry }) => {
  const getStatusDetails = () => {
    switch (status) {
      case 'saving':
        return {
          icon: <Loader2 className="w-3.5 h-3.5 text-teal-500 animate-spin" />,
          labelEn: 'Saving...',
          labelAr: 'جاري الحفظ...',
          className: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20'
        };
      case 'saved':
        return {
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
          labelEn: 'All changes saved',
          labelAr: 'تم حفظ جميع التغييرات',
          className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
        };
      case 'failed':
        return {
          icon: <AlertCircle className="w-3.5 h-3.5 text-rose-500 animate-pulse" />,
          labelEn: 'Auto-save failed (retry)',
          labelAr: 'فشل الحفظ (إعادة المحاولة)',
          className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 cursor-pointer hover:bg-rose-500/20'
        };
      case 'unsaved':
        return {
          icon: <Cloud className="w-3.5 h-3.5 text-amber-500" />,
          labelEn: 'Unsaved changes',
          labelAr: 'تغييرات غير محفوظة',
          className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
        };
      case 'idle':
      default:
        return {
          icon: <Cloud className="w-3.5 h-3.5 text-[var(--color-text-faint)]" />,
          labelEn: 'All changes saved',
          labelAr: 'تم حفظ التغييرات',
          className: 'bg-transparent text-[var(--color-text-muted)] border-transparent'
        };
    }
  };

  const { icon, labelEn, labelAr, className } = getStatusDetails();

  return (
    <div
      onClick={status === 'failed' ? onRetry : undefined}
      className={`flex items-center gap-2 px-3 py-1 rounded-full border text-[11px] font-bold transition-all duration-300 ease-out select-none shadow-sm ${className}`}
    >
      {icon}
      <div className="flex items-center gap-1.5 leading-none">
        <span>{labelEn}</span>
        <span className="text-[var(--color-text-faint)] font-normal">|</span>
        <span className="font-arabic text-[10px]">{labelAr}</span>
      </div>
    </div>
  );
};
