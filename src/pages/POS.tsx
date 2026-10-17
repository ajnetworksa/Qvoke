import React, { useState, useMemo, useEffect } from 'react';
import { useERPStore } from '../store';
import { ShoppingCart, Search, Plus, Minus, Trash2, CreditCard, Receipt, Printer, CheckCircle2, UserCheck, X, Loader2, DollarSign, ArrowRight } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import QRCode from 'qrcode';
import { generateZatcaQRBase64 } from '../utils/zatca';
import { LineItem, Invoice } from '../types';

export default function POS() {
  const { products, customers, company, addInvoice, currentUser: user, features, companies, activeCompanyId } = useERPStore();
  const activeCompany = useMemo(() => companies.find(c => c.id === activeCompanyId), [companies, activeCompanyId]);
  
  const [cart, setCart] = useState<{ product: any; quantity: number }[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  
  // Checkout Modal States
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'bank_transfer'>('card');
  const [amountTendered, setAmountTendered] = useState<number | ''>('');
  const [processing, setProcessing] = useState(false);
  
  // Receipt Modal State
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [completedInvoice, setCompletedInvoice] = useState<Invoice | null>(null);
  const [zatcaQrCode, setZatcaQrCode] = useState<string | null>(null);

  if (!features.pos) {
    return (
      <div className="p-8">
        <EmptyState
          icon={Receipt}
          title="Feature Disabled"
          description="Point of Sale (POS) is not enabled for your company plan."
        />
      </div>
    );
  }

  if (!user?.isSuperAdmin && activeCompany?.role !== 'admin' && activeCompany?.role !== 'owner' && user?.permissions?.canUsePOS !== true) {
    return (
      <div className="p-8">
        <EmptyState
          icon={Receipt}
          title="Access Denied"
          description="You do not have permission to use the Point of Sale system."
        />
      </div>
    );
  }

  const filteredProducts = useMemo(() => {
    return products.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.itemCode && p.itemCode.toLowerCase().includes(search.toLowerCase()))
    );
  }, [products, search]);

  const addToCart = (product: any) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          const newQ = item.quantity + delta;
          return { ...item, quantity: newQ > 0 ? newQ : 1 };
        }
        return item;
      })
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.product.unitPrice * item.quantity, 0);
  const taxTotal = cart.reduce((sum, item) => sum + (item.product.unitPrice * item.quantity * ((item.product.taxRate || 15) / 100)), 0);
  const total = Math.round((subtotal + taxTotal) * 100) / 100;

  const changeDue = typeof amountTendered === 'number' && amountTendered >= total ? Math.round((amountTendered - total) * 100) / 100 : 0;

  const handleStartCheckout = () => {
    if (cart.length === 0) return;
    setAmountTendered(total);
    setCheckoutOpen(true);
  };

  const handleCompleteSale = async () => {
    setProcessing(true);
    try {
      const lineItems: LineItem[] = cart.map((c, idx) => ({
        id: `pos-li-${Date.now()}-${idx}`,
        type: 'item',
        productId: c.product.id,
        description: c.product.name,
        quantity: c.quantity,
        unit: c.product.unit || 'pc',
        unitPrice: c.product.unitPrice,
        discountPercent: 0,
        taxPercent: c.product.taxRate || 15,
        subtotal: Math.round(c.quantity * c.product.unitPrice * 100) / 100
      }));

      // Find or fallback to Walk-in customer
      const targetCustomer = customers.find(c => c.id === selectedCustomerId) || customers[0] || {
        id: 'cust-walkin',
        companyName: 'Walk-in Customer / عميل نقدي',
        email: 'pos@qvoke.local',
        phone: '0000000000',
        billingAddress: { street: 'POS Counter', city: 'Riyadh', country: 'SA' as const },
        createdAt: new Date()
      };

      const invPayload: Invoice = {
        id: `pos-${Date.now()}`,
        number: `POS-${Date.now().toString().slice(-6)}`,
        customerId: targetCustomer.id,
        date: new Date(),
        dueDate: new Date(),
        status: 'paid',
        paymentTerms: 'Immediate / نقدي',
        lineItems,
        notes: `POS Cashier Transaction - ${user?.name || 'Cashier'}`,
        terms: 'All sales are final. Goods received in good condition.',
        currency: company.currency || 'SAR',
        subtotal: Math.round(subtotal * 100) / 100,
        discountTotal: 0,
        taxTotal: Math.round(taxTotal * 100) / 100,
        total: total,
        amountPaid: total,
        amountDue: 0,
        payments: [{
          id: `pay-${Date.now()}`,
          date: new Date(),
          amount: total,
          method: paymentMethod,
          reference: `POS-${paymentMethod.toUpperCase()}`
        }],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await addInvoice(invPayload);

      // Generate ZATCA QR
      const zatcaTlv = generateZatcaQRBase64(
        company.name || 'Qvoke Store',
        company.vatNumber || '300000000000003',
        new Date().toISOString(),
        total,
        taxTotal
      );
      const qrDataUrl = await QRCode.toDataURL(zatcaTlv, { width: 140, margin: 1 });
      setZatcaQrCode(qrDataUrl);

      setCompletedInvoice(invPayload);
      setCheckoutOpen(false);
      setReceiptOpen(true);
      setCart([]);
    } catch (err) {
      console.error('POS Checkout Error:', err);
      alert('Failed to complete sale. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <div className="h-[calc(100vh-4.5rem)] flex gap-6 overflow-hidden text-left animate-fade-in">
      {/* Product Catalog */}
      <div className="flex-1 flex flex-col min-w-0 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-[var(--color-border)] flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-faint)]" />
            <input
              type="text"
              placeholder="Search products by name or code (Scan barcode)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 premium-input text-xs"
              autoFocus
            />
          </div>
          <div className="text-xs font-bold text-[var(--color-text-muted)] shrink-0">
            {filteredProducts.length} items
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredProducts.map((p) => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                className="flex flex-col text-left bg-[var(--color-surface-offset)] border border-[var(--color-border)] rounded-xl p-3.5 hover:border-[var(--color-primary)] transition-all cursor-pointer group hover:shadow-sm"
              >
                <div className="font-bold text-xs text-[var(--color-text)] line-clamp-2 min-h-[2rem] mb-2 group-hover:text-[var(--color-primary)]">
                  {p.name}
                </div>
                {p.itemCode && (
                  <span className="text-[10px] font-mono text-[var(--color-text-muted)] mb-2">
                    #{p.itemCode}
                  </span>
                )}
                <div className="mt-auto flex items-center justify-between w-full pt-2 border-t border-[var(--color-border)]/50">
                  <span className="text-xs font-black text-[var(--color-primary)]">
                    {company.currency || 'SAR'} {p.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-[var(--color-text-muted)] bg-[var(--color-surface)] px-1.5 py-0.5 rounded font-semibold border border-[var(--color-border)]">
                    {p.unit || 'pc'}
                  </span>
                </div>
              </button>
            ))}
            {filteredProducts.length === 0 && (
              <div className="col-span-full py-16 text-center text-[var(--color-text-muted)]">
                No products found matching "{search}"
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cart Drawer */}
      <div className="w-[380px] flex flex-col shrink-0 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-[var(--color-border)] bg-[var(--color-surface-offset)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center border border-[var(--color-primary)]/20">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-[var(--color-text)]">Active POS Order</h2>
              <div className="text-[11px] text-[var(--color-text-muted)]">{cart.length} distinct items</div>
            </div>
          </div>
          {cart.length > 0 && (
            <button
              onClick={() => setCart([])}
              className="text-[10px] font-bold text-red-500 hover:text-red-600 cursor-pointer"
            >
              Clear Cart
            </button>
          )}
        </div>

        {/* Customer Select */}
        <div className="p-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
            Customer / العميل
          </label>
          <select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="w-full premium-input text-xs py-1.5"
          >
            <option value="">Walk-in Customer / عميل نقدي</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName} ({c.phone || c.email})
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-[var(--color-text-muted)] space-y-3 py-16">
              <ShoppingCart className="w-10 h-10 opacity-20" />
              <p className="text-xs font-semibold">Scan product or click item to add</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.product.id} className="flex flex-col gap-2 p-2.5 bg-[var(--color-surface-offset)] rounded-lg border border-[var(--color-border)]">
                <div className="flex justify-between items-start gap-2">
                  <span className="font-bold text-xs text-[var(--color-text)] line-clamp-1">
                    {item.product.name}
                  </span>
                  <button
                    onClick={() => removeFromCart(item.product.id)}
                    className="text-red-500 hover:bg-red-500/10 p-1 rounded transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center gap-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md">
                    <button
                      onClick={() => updateQuantity(item.product.id, -1)}
                      className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)] cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center text-xs font-mono font-bold">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.product.id, 1)}
                      className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)] cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <span className="font-bold text-xs text-[var(--color-text)]">
                    {company.currency || 'SAR'} {(item.product.unitPrice * item.quantity).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-surface-offset)] space-y-2.5">
          <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
            <span>Subtotal</span>
            <span className="font-mono">{company.currency || 'SAR'} {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
            <span>VAT (15%)</span>
            <span className="font-mono">{company.currency || 'SAR'} {taxTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between text-base font-black text-[var(--color-text)] pt-2 border-t border-[var(--color-border)]">
            <span>Total Payable</span>
            <span className="text-[var(--color-primary)] font-mono">{company.currency || 'SAR'} {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>

          <button
            onClick={handleStartCheckout}
            disabled={cart.length === 0}
            className={`w-full py-3 rounded-lg font-bold text-xs flex items-center justify-center gap-2 mt-3 transition-all cursor-pointer shadow-md ${
              cart.length === 0
                ? 'bg-[var(--color-border)] text-[var(--color-text-faint)] cursor-not-allowed shadow-none'
                : 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Checkout &amp; Pay
          </button>
        </div>
      </div>

      {/* Checkout Modal */}
      {checkoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
              <h3 className="font-bold text-base text-[var(--color-text)] flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[var(--color-primary)]" />
                POS Payment Checkout
              </h3>
              <button
                onClick={() => setCheckoutOpen(false)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-[var(--color-surface-offset)] p-4 rounded-xl text-center">
              <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider block mb-1">Total Amount Due</span>
              <span className="text-2xl font-black text-[var(--color-primary)] font-mono">
                {company.currency || 'SAR'} {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>

            {/* Payment Method Selector */}
            <div>
              <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                Payment Method
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['card', 'cash', 'bank_transfer'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethod(m)}
                    className={`py-2.5 px-3 rounded-lg border text-xs font-bold capitalize transition-all cursor-pointer ${
                      paymentMethod === m
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white shadow-sm'
                        : 'border-[var(--color-border)] bg-[var(--color-surface-offset)] text-[var(--color-text)] hover:border-[var(--color-primary)]/40'
                    }`}
                  >
                    {m === 'card' ? '💳 Mada / Card' : m === 'cash' ? '💵 Cash' : '🏦 Transfer'}
                  </button>
                ))}
              </div>
            </div>

            {paymentMethod === 'cash' && (
              <div className="space-y-3 p-3 bg-[var(--color-surface-offset)] rounded-xl border border-[var(--color-border)] animate-fade-in">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--color-text-muted)] mb-1">
                    Amount Received / المبلغ المستلم
                  </label>
                  <input
                    type="number"
                    value={amountTendered}
                    onChange={(e) => setAmountTendered(parseFloat(e.target.value) || '')}
                    className="w-full premium-input text-base font-mono font-bold"
                    placeholder="0.00"
                  />
                </div>
                <div className="flex justify-between items-center text-xs pt-2 border-t border-[var(--color-border)]">
                  <span className="font-bold text-[var(--color-text-muted)]">Change Due / المتبقي للعميل:</span>
                  <span className={`font-mono font-black text-sm ${changeDue >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {company.currency || 'SAR'} {changeDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}

            <button
              onClick={handleCompleteSale}
              disabled={processing}
              className="w-full py-3 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-bold text-sm transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
            >
              {processing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              Confirm Payment &amp; Issue Receipt
            </button>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {receiptOpen && completedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="text-center border-b border-[var(--color-border)] pb-3">
              <h2 className="font-black text-base text-[var(--color-text)]">{company.name || 'Qvoke Store'}</h2>
              <p className="text-[10px] text-[var(--color-text-muted)]">{company.address?.street}, {company.address?.city}</p>
              <p className="text-[10px] font-mono text-[var(--color-text-muted)]">VAT: {company.vatNumber || '300000000000003'}</p>
              <div className="mt-2 text-xs font-bold text-emerald-500 uppercase tracking-widest flex items-center justify-center gap-1">
                <CheckCircle2 size={13} /> Simplified Tax Invoice
              </div>
            </div>

            <div className="text-[11px] space-y-1 text-[var(--color-text-muted)] border-b border-[var(--color-border)] pb-2.5">
              <div className="flex justify-between">
                <span>Receipt #:</span>
                <span className="font-mono font-bold text-[var(--color-text)]">{completedInvoice.number}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span>{new Date(completedInvoice.date).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Payment Method:</span>
                <span className="uppercase font-bold text-[var(--color-text)]">{paymentMethod}</span>
              </div>
            </div>

            {/* Line items list */}
            <div className="max-h-48 overflow-y-auto space-y-1.5 text-xs">
              {completedInvoice.lineItems.map((li, idx) => (
                <div key={idx} className="flex justify-between text-[11px]">
                  <span className="text-[var(--color-text)] truncate max-w-[180px]">
                    {li.quantity}x {li.description}
                  </span>
                  <span className="font-mono font-bold text-[var(--color-text)]">
                    {(li.quantity * li.unitPrice).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="border-t border-[var(--color-border)] pt-2.5 space-y-1 text-xs">
              <div className="flex justify-between text-[var(--color-text-muted)]">
                <span>Subtotal (Excl. VAT):</span>
                <span className="font-mono">{completedInvoice.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[var(--color-text-muted)]">
                <span>VAT (15%):</span>
                <span className="font-mono">{completedInvoice.taxTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-black text-sm text-[var(--color-text)] pt-1 border-t border-[var(--color-border)]">
                <span>Total Amount:</span>
                <span className="font-mono text-[var(--color-primary)]">SAR {completedInvoice.total.toFixed(2)}</span>
              </div>
            </div>

            {/* ZATCA QR Code */}
            {zatcaQrCode && (
              <div className="flex flex-col items-center justify-center pt-2">
                <img src={zatcaQrCode} alt="ZATCA QR" className="w-28 h-28 rounded border border-slate-200 bg-white p-1" />
                <span className="text-[9px] text-[var(--color-text-muted)] mt-1 font-mono">ZATCA Compliant QR</span>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={handlePrintReceipt}
                className="flex-1 py-2 rounded-lg bg-[var(--color-surface-offset)] hover:bg-[var(--color-border)] text-[var(--color-text)] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer border border-[var(--color-border)]"
              >
                <Printer size={14} /> Print
              </button>
              <button
                onClick={() => setReceiptOpen(false)}
                className="flex-1 py-2 rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                New Sale <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
