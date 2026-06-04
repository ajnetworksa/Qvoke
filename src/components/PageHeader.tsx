import React from 'react';
import { ChevronRight } from 'lucide-react';
import { useERPStore } from '../store';

interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

interface PageHeaderProps {
  title: string;
  breadcrumbs: BreadcrumbItem[];
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  breadcrumbs,
  actions
}) => {
  const { theme } = useERPStore();

  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-[var(--color-border)]/50 pb-6 mb-6">
      <div className="flex flex-col text-left">
        {/* Breadcrumb Odoo-style state trail */}
        <nav className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] font-medium mb-2.5">
          {breadcrumbs.map((item, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-[var(--color-text-faint)]" />}
              {item.onClick ? (
                <button
                  onClick={item.onClick}
                  className="hover:text-[var(--color-primary)] font-semibold transition-colors cursor-pointer"
                >
                  {item.label}
                </button>
              ) : (
                <span className="text-[var(--color-text-faint)] truncate max-w-[150px]">
                  {item.label}
                </span>
              )}
            </React.Fragment>
          ))}
        </nav>

        {/* Display Title */}
        <h1 className="text-xl font-bold tracking-tight text-[var(--color-text)] flex items-center gap-3">
          {title}
        </h1>
      </div>

      {actions && (
        <div className="mt-4 md:mt-0 flex items-center gap-3">
          {actions}
        </div>
      )}
    </div>
  );
};
export default PageHeader;
