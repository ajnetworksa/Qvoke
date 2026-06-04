import React, { useState } from 'react';
import { X, Send, Paperclip, CheckCircle } from 'lucide-react';

interface EmailSendModalProps {
  isOpen: boolean;
  to: string;
  subject: string;
  body: string;
  attachmentName: string;
  onClose: () => void;
}

export const EmailSendModal: React.FC<EmailSendModalProps> = ({
  isOpen,
  to: initialTo,
  subject: initialSubject,
  body: initialBody,
  attachmentName,
  onClose
}) => {
  const [to, setTo] = useState(initialTo);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);

  // Simulation states
  const [isSending, setIsSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!to) {
      alert('Recipient email is required / الرجاء إدخال البريد الإلكتروني');
      return;
    }

    setIsSending(true);
    
    // Simulate sending email through SMTP server (1200ms duration)
    setTimeout(() => {
      setIsSending(false);
      setSentSuccess(true);
      
      // Keep success banner visible for 1 second, then auto close modal
      setTimeout(() => {
        setSentSuccess(false);
        onClose();
      }, 1200);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />

      <form
        onSubmit={handleSend}
        className="relative w-full max-w-lg bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-lg flex flex-col overflow-hidden animate-slide-in text-left text-xs font-semibold text-[var(--color-text-muted)]"
      >
        {/* Header */}
        <div className="h-12 border-b border-[var(--color-border)] px-4 flex items-center justify-between bg-[var(--color-surface-offset)]">
          <span className="text-xs font-bold text-[var(--color-text)] flex items-center gap-1.5 uppercase tracking-wider">
            <Send className="w-4 h-4 text-[var(--color-primary)]" />
            Send Document by Email / إرسال بالبريد الإلكتروني
          </span>
          <button type="button" onClick={onClose} className="p-1 hover:bg-[var(--color-border)] rounded text-[var(--color-text-muted)] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {sentSuccess ? (
          /* Success Screen */
          <div className="p-12 flex flex-col items-center justify-center text-center animate-fade-in">
            <div className="w-12 h-12 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-[var(--color-text)] mb-2">
              Email Sent Successfully!
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
              The PDF copy of the document has been compiled and emailed to {to}.
            </p>
          </div>
        ) : (
          /* Editor Screen */
          <>
            <div className="p-6 flex flex-col gap-4">
              <div>
                <label className="block uppercase tracking-wider mb-2">To / المرسل إليه *</label>
                <input
                  type="email"
                  required
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-full premium-input text-sm text-[var(--color-text)] font-semibold"
                  placeholder="client@domain.sa"
                />
              </div>

              <div>
                <label className="block uppercase tracking-wider mb-2">Subject / العنوان</label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full premium-input text-sm text-[var(--color-text)]"
                />
              </div>

              <div>
                <label className="block uppercase tracking-wider mb-2">Message Details / نص الرسالة</label>
                <textarea
                  rows={6}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full premium-input text-xs leading-relaxed text-[var(--color-text)]"
                />
              </div>

              {/* Attachment box */}
              <div className="flex items-center justify-between border border-[var(--color-border)] rounded-lg p-3 bg-[var(--color-surface-offset)]/50 mt-1">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded bg-[var(--color-primary-highlight)]/40 text-[var(--color-primary)]">
                    <Paperclip className="w-4 h-4" />
                  </div>
                  <div className="text-left leading-tight">
                    <span className="font-bold text-[var(--color-text)] block text-xs truncate max-w-[280px]">
                      {attachmentName}
                    </span>
                    <span className="text-[10px] text-[var(--color-text-muted)]">Compiled PDF (A4 Format)</span>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-[var(--color-text-muted)]">~ 120 KB</span>
              </div>
            </div>

            {/* Sticky Actions Bar */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-[var(--color-surface-offset)] border-t border-[var(--color-border)]">
              <button
                type="button"
                onClick={onClose}
                disabled={isSending}
                className="px-4 py-2 border border-[var(--color-border)] hover:bg-[var(--color-border)]/50 rounded-md text-xs font-semibold text-[var(--color-text)] transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSending}
                className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-70 shadow-sm"
              >
                <Send className="w-3.5 h-3.5" />
                {isSending ? 'Sending Dispatch...' : 'Send Mail / إرسال'}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
};
export default EmailSendModal;
