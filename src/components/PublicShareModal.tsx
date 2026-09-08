import React, { useState, useEffect } from 'react';
import { useERPStore } from '../store';
import { Share2, Copy, Check, ExternalLink, ShieldCheck, X, MessageCircle } from 'lucide-react';

interface PublicShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  docType: 'quotation' | 'invoice';
  docId: string;
  docNumber: string;
  customerName?: string;
  customerPhone?: string;
  total?: number;
  currency?: string;
}

export const PublicShareModal: React.FC<PublicShareModalProps> = ({
  isOpen,
  onClose,
  docType,
  docId,
  docNumber,
  customerName,
  customerPhone,
  total = 0,
  currency = 'SAR'
}) => {
  const { generatePortalLink } = useERPStore();
  const [loading, setLoading] = useState(false);
  const [shareData, setShareData] = useState<{ token: string; shareUrl: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && docId) {
      setLoading(true);
      generatePortalLink(docType, docId)
        .then((res) => {
          setShareData(res);
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, docType, docId, generatePortalLink]);

  if (!isOpen) return null;

  const fullUrl = shareData
    ? `${window.location.origin}${shareData.shareUrl}`
    : '';

  const handleCopy = () => {
    if (!fullUrl) return;
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(
      `Hello ${customerName || ''}, please find your official ${docType === 'quotation' ? 'Quotation' : 'Invoice'} ${docNumber} (Total: ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${currency}) at the secure client portal link:\n${fullUrl}`
    );
    const phoneClean = (customerPhone || '').replace(/[^0-9]/g, '');
    const url = phoneClean
      ? `https://wa.me/${phoneClean}?text=${text}`
      : `https://api.whatsapp.com/send?text=${text}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in text-left">
      <div className="relative w-full max-w-lg bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-divider)]/40 bg-[var(--color-surface-2)]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-teal-500/15 text-teal-600 dark:text-teal-400">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[var(--color-text)]">
                Share Client Portal / مشاركة الرابط للعميل
              </h3>
              <p className="text-xs text-[var(--color-text-muted)]">
                Secure public view with electronic signature &amp; PDF download.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-offset)] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-4">
          <div className="p-3.5 rounded-xl bg-[var(--color-surface-offset)] border border-[var(--color-border)] text-xs flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[var(--color-text)]">{docNumber}</span>
              <span className="font-black text-[var(--color-primary)] font-mono">
                {total.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currency}
              </span>
            </div>
            {customerName && (
              <span className="text-[11px] text-[var(--color-text-muted)]">
                Customer: {customerName}
              </span>
            )}
          </div>

          {loading ? (
            <div className="py-6 flex items-center justify-center text-xs text-[var(--color-text-muted)] gap-2">
              <span className="animate-spin">⏳</span> Generating secure access token...
            </div>
          ) : (
            <>
              <div>
                <label className="block text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">
                  Direct Portal Link:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={fullUrl}
                    className="flex-1 premium-input text-xs font-mono select-all bg-[var(--color-surface-2)]"
                  />
                  <button
                    onClick={handleCopy}
                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      copied
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]'
                    }`}
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Share Channels */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={handleWhatsApp}
                  className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold transition-all cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Send WhatsApp</span>
                </button>

                <a
                  href={shareData ? shareData.shareUrl : '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-600 dark:text-blue-400 text-xs font-bold transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open Client View</span>
                </a>
              </div>

              <div className="flex items-center gap-2 p-3 rounded-lg bg-[var(--color-primary-highlight)]/15 border border-[var(--color-primary)]/20 text-[11px] text-[var(--color-text)]">
                <ShieldCheck className="w-4 h-4 text-[var(--color-primary)] shrink-0" />
                <span>No login required for client. Electronic approvals automatically update document status to Confirmed.</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};