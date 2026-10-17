import React, { useState, useEffect } from 'react';
import {
  FileText, CheckCircle2, XCircle, Printer, Download, Clock,
  ShieldCheck, Building, User, Phone, Mail, MapPin, Sparkles, Check, Send
} from 'lucide-react';

interface PortalData {
  docType: 'quotation' | 'invoice';
  share: {
    token: string;
    status: 'active' | 'accepted' | 'declined' | 'expired';
    acceptedAt?: string;
    acceptedByName?: string;
    acceptedSignature?: string;
  };
  company: {
    name: string;
    email: string;
    phone: string;
    vatNumber: string;
    crNumber: string;
    address: { street: string; city: string; country: string };
    logo?: string;
  };
  customer: {
    companyName: string;
    contactPerson?: string;
    email: string;
    phone: string;
    vatNumber?: string;
    billingAddress?: any;
  } | null;
  document: {
    id: string;
    number: string;
    date: string;
    validUntil?: string;
    dueDate?: string;
    status: string;
    currency: string;
    subtotal: number;
    discountTotal: number;
    taxTotal: number;
    total: number;
    amountPaid?: number;
    amountDue?: number;
    notes?: string;
    terms?: string;
    lineItems: any[];
  };
  zatcaQr?: string | null;
}

export const PublicPortal: React.FC<{ token: string; docType: 'quotation' | 'invoice' }> = ({ token, docType }) => {
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Approval modal states
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [clientName, setClientName] = useState('');
  const [clientTitle, setClientTitle] = useState('');
  const [signatureText, setSignatureText] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [approvedSuccess, setApprovedSuccess] = useState(false);

  // Decline modal states
  const [declineModalOpen, setDeclineModalOpen] = useState(false);
  const [feedbackNote, setFeedbackNote] = useState('');

  useEffect(() => {
    fetch(`/api/portal/${docType}/${token}`)
      .then(async res => {
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to load document');
        }
        return res.json();
      })
      .then(d => {
        setData(d);
        if (d.share.status === 'accepted') setApprovedSuccess(true);
      })
      .catch(err => {
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [docType, token]);

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !agreeTerms) return;

    setSubmitting(true);
    try {
      const formattedName = clientTitle.trim() ? `${clientName.trim()} (${clientTitle.trim()})` : clientName.trim();
      const res = await fetch(`/api/portal/${docType}/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: formattedName,
          signature: signatureText.trim() || clientName.trim()
        })
      });

      if (res.ok) {
        setApprovedSuccess(true);
        setApproveModalOpen(false);
        if (data) {
          setData({
            ...data,
            share: { ...data.share, status: 'accepted', acceptedByName: clientName }
          });
        }
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Could not record your approval. Please try again.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/portal/${docType}/${token}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedbackNote })
      });
      if (res.ok) {
        setDeclineModalOpen(false);
        if (data) {
          setData({ ...data, share: { ...data.share, status: 'declined' } });
        }
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Could not send your response. Please try again.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-teal-400 border-t-transparent rounded-full animate-spin mb-4" />
        <span className="text-xs font-mono tracking-widest text-slate-400 uppercase">
          Loading Official Document Portal...
        </span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center mb-4">
          <XCircle className="w-8 h-8" />
        </div>
        <h1 className="text-lg font-bold mb-2">Document Unavailable</h1>
        <p className="text-sm text-slate-400 max-w-md mb-6">
          {error || 'This link may have expired or was revoked by the issuing company.'}
        </p>
      </div>
    );
  }

  const isQuote = docType === 'quotation';
  const isAccepted = data.share.status === 'accepted';

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 py-8 px-4 sm:px-6 lg:px-8 font-sans selection:bg-teal-500 selection:text-white">
      {/* Top Banner / Status Alert */}
      <div className="max-w-4xl mx-auto mb-6">
        {isAccepted ? (
          <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 shrink-0" />
              <div>
                <span className="font-extrabold text-sm block">Document Approved &amp; Confirmed</span>
                <span className="text-xs text-emerald-400/80">
                  Accepted by {data.share.acceptedByName || 'Client'} on {data.share.acceptedAt ? new Date(data.share.acceptedAt).toLocaleDateString() : 'recent date'}
                </span>
              </div>
            </div>
            <button
              onClick={() => window.print()}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" /> Print Copy
            </button>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-teal-500/15 text-teal-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="text-left">
                <span className="font-bold text-sm text-white block">
                  Official {isQuote ? 'Quotation' : 'Tax Invoice'} from {data.company.name}
                </span>
                <span className="text-xs text-slate-400">
                  Review specifications and approve electronically with digital sign-off.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                onClick={() => setDeclineModalOpen(true)}
                className="flex-1 sm:flex-none px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-700 text-xs font-bold text-slate-300 transition-all cursor-pointer"
              >
                Request Revision
              </button>
              <button
                onClick={() => setApproveModalOpen(true)}
                className="flex-1 sm:flex-none px-5 py-2 rounded-lg bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white text-xs font-extrabold transition-all shadow-lg shadow-teal-500/20 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" /> Accept &amp; Sign
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Document Paper Container */}
      <div id="printable-document" className="max-w-4xl mx-auto bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-10 text-left relative overflow-hidden">
        {/* Decorative Top Accent Bar */}
        <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-teal-500 via-cyan-500 to-indigo-500" />

        {/* Header Grid: Company Branding & Document Details */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pb-8 border-b border-slate-800">
          <div>
            {data.company.logo ? (
              <img src={data.company.logo} alt={data.company.name} className="h-12 max-w-[200px] object-contain mb-3" />
            ) : (
              <div className="text-2xl font-black tracking-tight text-white mb-1 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-teal-500 text-slate-950 flex items-center justify-center font-black text-base">Q</span>
                {data.company.name}
              </div>
            )}
            <div className="text-xs text-slate-400 space-y-0.5">
              {data.company.vatNumber && <p>VAT Registration #: <span className="font-mono text-slate-300 font-bold">{data.company.vatNumber}</span></p>}
              {data.company.crNumber && <p>CR #: <span className="font-mono text-slate-300">{data.company.crNumber}</span></p>}
              {data.company.phone && <p>Phone: {data.company.phone}</p>}
              {data.company.email && <p>Email: {data.company.email}</p>}
            </div>
          </div>

          <div className="text-left sm:text-right">
            <h2 className="text-xl font-extrabold uppercase tracking-tight text-white">
              {isQuote ? 'Official Quotation' : 'Tax Invoice / فاتورة ضريبية'}
            </h2>
            <p className="text-sm font-mono font-bold text-teal-400 mt-1">{data.document.number}</p>
            <div className="text-xs text-slate-400 mt-2 space-y-1">
              <p>Issue Date: <span className="font-mono text-slate-200">{data.document.date}</span></p>
              {data.document.validUntil && (
                <p>Valid Until: <span className="font-mono text-slate-200">{data.document.validUntil}</span></p>
              )}
              {data.document.dueDate && (
                <p>Due Date: <span className="font-mono text-slate-200">{data.document.dueDate}</span></p>
              )}
            </div>
          </div>
        </div>

        {/* Customer Coordinates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6 border-b border-slate-800">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
              Issued To / العميل:
            </span>
            <h3 className="text-sm font-extrabold text-white">
              {data.customer?.companyName || 'Valued Customer'}
            </h3>
            {data.customer?.contactPerson && (
              <p className="text-xs text-slate-400 mt-0.5">Attn: {data.customer.contactPerson}</p>
            )}
            {data.customer?.vatNumber && (
              <p className="text-xs text-slate-400 mt-0.5">VAT #: <span className="font-mono text-slate-300">{data.customer.vatNumber}</span></p>
            )}
            {data.customer?.email && (
              <p className="text-xs text-slate-400 mt-0.5">{data.customer.email}</p>
            )}
          </div>

          {data.zatcaQr && (
            <div className="flex sm:justify-end items-center gap-3">
              <div className="p-2 bg-white rounded-xl shadow-lg inline-block">
                <img src={data.zatcaQr} alt="ZATCA E-Invoice QR" className="w-24 h-24" />
              </div>
              <div className="text-left text-[10px] text-slate-400 leading-tight">
                <span className="font-bold text-white block">ZATCA Compliant</span>
                <span>Saudi Arabia E-Invoicing Standard Phase 1 &amp; 2</span>
              </div>
            </div>
          )}
        </div>

        {/* Line Items Table */}
        <div className="py-6 overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-2">#</th>
                <th className="py-3 px-4">Description / البيان</th>
                <th className="py-3 px-2 text-center">Qty</th>
                <th className="py-3 px-4 text-right">Unit Price</th>
                <th className="py-3 px-2 text-center">Tax</th>
                <th className="py-3 px-4 text-right">Total ({data.document.currency})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {data.document.lineItems.map((item, idx) => {
                if (item.type === 'section') {
                  return (
                    <tr key={idx} className="bg-slate-900/60 font-extrabold text-teal-400">
                      <td colSpan={6} className="py-2.5 px-4">{item.description}</td>
                    </tr>
                  );
                }
                const sub = (Number(item.quantity) || 1) * (Number(item.unitPrice) || 0);
                const disc = sub * ((Number(item.discountPercent) || 0) / 100);
                const taxable = sub - disc;
                const tax = taxable * ((Number(item.taxPercent) || 15) / 100);
                const lineTotal = taxable + tax;

                return (
                  <tr key={idx} className="hover:bg-slate-900/30">
                    <td className="py-3 px-2 font-mono text-slate-500">{idx + 1}</td>
                    <td className="py-3 px-4 font-semibold text-slate-200">{item.description}</td>
                    <td className="py-3 px-2 text-center font-mono">{item.quantity}</td>
                    <td className="py-3 px-4 text-right font-mono">{Number(item.unitPrice || 0).toLocaleString()}</td>
                    <td className="py-3 px-2 text-center font-mono text-slate-400">{item.taxPercent || 15}%</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-white">
                      {lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals Breakdown */}
        <div className="flex justify-end pt-4 border-t border-slate-800">
          <div className="w-full sm:w-72 space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal (Pre-Tax):</span>
              <span className="font-mono text-slate-200">{data.document.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {data.document.currency}</span>
            </div>
            {data.document.discountTotal > 0 && (
              <div className="flex justify-between text-rose-400">
                <span>Discount:</span>
                <span className="font-mono">-{data.document.discountTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {data.document.currency}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-400">
              <span>VAT / الضريبة (15%):</span>
              <span className="font-mono text-teal-400">+{data.document.taxTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {data.document.currency}</span>
            </div>
            <div className="flex justify-between text-sm font-extrabold text-white pt-2 border-t border-slate-700">
              <span>Total Amount:</span>
              <span className="font-mono text-teal-300 text-base">{data.document.total.toLocaleString(undefined, { minimumFractionDigits: 2 })} {data.document.currency}</span>
            </div>
          </div>
        </div>

        {/* Notes & Terms */}
        {(data.document.notes || data.document.terms) && (
          <div className="mt-8 pt-6 border-t border-slate-800 text-xs text-slate-400 space-y-3">
            {data.document.notes && (
              <div>
                <span className="font-bold text-slate-300 block mb-1">Notes:</span>
                <p className="whitespace-pre-line leading-relaxed">{data.document.notes}</p>
              </div>
            )}
            {data.document.terms && (
              <div>
                <span className="font-bold text-slate-300 block mb-1">Terms &amp; Conditions:</span>
                <p className="whitespace-pre-line leading-relaxed text-[11px] text-slate-400">{data.document.terms}</p>
              </div>
            )}
          </div>
        )}

        {/* Signature Stamp (if approved) */}
        {isAccepted && (
          <div className="mt-8 p-4 rounded-xl bg-slate-900 border border-emerald-500/40 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 block">
                Digital Approval Seal:
              </span>
              <span className="text-sm font-extrabold text-white">{data.share.acceptedByName}</span>
              <span className="text-xs text-slate-400 block font-mono mt-0.5">
                Timestamp: {data.share.acceptedAt ? new Date(data.share.acceptedAt).toLocaleString() : ''}
              </span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-black uppercase tracking-widest border border-emerald-500/30">
              VERIFIED
            </div>
          </div>
        )}
      </div>

      {/* Approve Modal */}
      {approveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in text-left">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-100">
            <h3 className="text-base font-extrabold text-white mb-1">
              Accept &amp; Electronically Sign / قبول وتوقيع المستند
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Confirm your acceptance of {data.document.number} for {data.document.total.toLocaleString()} {data.document.currency}.
            </p>

            <form onSubmit={handleApprove} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1">Full Legal Name <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. Abdullah Al-Ghamdi"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1">Title / Role</label>
                <input
                  type="text"
                  value={clientTitle}
                  onChange={(e) => setClientTitle(e.target.value)}
                  placeholder="e.g. Procurement Director"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1">Digital Signature Text Stamp</label>
                <input
                  type="text"
                  value={signatureText}
                  onChange={(e) => setSignatureText(e.target.value)}
                  placeholder="Type your name to sign"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-teal-400 font-serif italic text-base"
                />
              </div>

              <div className="flex items-start gap-2 pt-2">
                <input
                  type="checkbox"
                  id="termsAgree"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-0.5 accent-teal-500"
                />
                <label htmlFor="termsAgree" className="text-xs text-slate-300 cursor-pointer">
                  I confirm that I am authorized to approve this document on behalf of my organization and agree to the specified terms.
                </label>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setApproveModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !agreeTerms || !clientName.trim()}
                  className="px-5 py-2 text-xs font-bold bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white rounded-lg transition-all shadow-md disabled:opacity-50"
                >
                  {submitting ? 'Confirming...' : 'Sign & Approve / اعتماد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Decline Modal */}
      {declineModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in text-left">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-100">
            <h3 className="text-base font-extrabold text-white mb-1">Request Revisions / طلب تعديل</h3>
            <p className="text-xs text-slate-400 mb-4">
              Send revision requests or feedback directly to the sales team.
            </p>
            <form onSubmit={handleDecline} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1">Revision Notes</label>
                <textarea
                  rows={4}
                  required
                  value={feedbackNote}
                  onChange={(e) => setFeedbackNote(e.target.value)}
                  placeholder="Please specify requested changes in scope, quantities, pricing, or payment terms..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-white"
                />
              </div>
              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setDeclineModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-all"
                >
                  {submitting ? 'Submitting...' : 'Send Feedback'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};