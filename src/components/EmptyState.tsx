import React from 'react';
import { LucideIcon, Plus } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionText,
  onAction
}) => {
  return (
    <div className="premium-card p-12 flex flex-col items-center justify-center text-center max-w-lg mx-auto my-12">
      <div className="p-4 rounded-full bg-[var(--color-surface-offset)] border border-[var(--color-border)] mb-5">
        <Icon className="w-8 h-8 text-[var(--color-text-muted)]" />
      </div>

      <h3 className="text-base font-bold text-[var(--color-text)] mb-2">
        {title}
      </h3>
      
      <p className="text-sm text-[var(--color-text-muted)] leading-relaxed max-w-sm mb-6">
        {description}
      </p>

      {actionText && onAction && (
        <button
          onClick={onAction}
          type="button"
          className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-semibold py-2 px-4 rounded-md flex items-center gap-1.5 transition-colors shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          {actionText}
        </button>
      )}
    </div>
  );
};
export default EmptyState;
