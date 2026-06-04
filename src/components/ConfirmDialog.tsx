import React from 'react';
import { AlertCircle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onClose: () => void;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'info' | 'success';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onClose,
  confirmText = 'Confirm / تأكيد',
  cancelText = 'Cancel / إلغاء',
  type = 'info'
}) => {
  if (!isOpen) return null;

  const getColorTheme = () => {
    switch (type) {
      case 'danger':
        return {
          btn: 'bg-[var(--color-error)] hover:bg-[var(--color-error)]/90 text-white',
          icon: 'text-[var(--color-error)]'
        };
      case 'success':
        return {
          btn: 'bg-[var(--color-success)] hover:bg-[var(--color-success)]/90 text-white',
          icon: 'text-[var(--color-success)]'
        };
      default:
        return {
          btn: 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white',
          icon: 'text-[var(--color-primary)]'
        };
    }
  };

  const theme = getColorTheme();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      
      {/* Modal Box */}
      <div className="relative w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-lg p-6 overflow-hidden animate-slide-in">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 hover:bg-[var(--color-surface-offset)] rounded transition-colors"
        >
          <X className="w-4 h-4 text-[var(--color-text-muted)]" />
        </button>

        <div className="flex items-start gap-4">
          <AlertCircle className={`w-6 h-6 flex-shrink-0 mt-0.5 ${theme.icon}`} />
          <div className="flex-1 text-left">
            <h3 className="text-base font-bold text-[var(--color-text)] mb-2">
              {title}
            </h3>
            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-6">
              {message}
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-[var(--color-border)] hover:bg-[var(--color-surface-offset)] rounded-md text-xs font-semibold text-[var(--color-text)] transition-colors"
              >
                {cancelText}
              </button>
              <button
                type="button"
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className={`px-4 py-2 rounded-md text-xs font-semibold transition-colors ${theme.btn}`}
              >
                {confirmText}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default ConfirmDialog;
