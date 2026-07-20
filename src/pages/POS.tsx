import React, { useState, useMemo } from 'react';
import { useERPStore } from '../store';
import { ShoppingCart, Search, Plus, Minus, Trash2, CreditCard, Receipt } from 'lucide-react';
import EmptyState from '../components/EmptyState';

export default function POS() {
  const { products, user, features } = useERPStore();
  const [cart, setCart] = useState<{ product: any; quantity: number }[]>([]);
  const [search, setSearch] = useState('');

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

  if (user?.role !== 'admin' && user?.permissions?.canUsePOS !== true) {
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
  const taxTotal = cart.reduce((sum, item) => sum + (item.product.unitPrice * item.quantity * (item.product.taxRate / 100)), 0);
  const total = subtotal + taxTotal;

  const handleCheckout = () => {
    if (cart.length === 0) return;
    alert(`Checkout successful! Total: SAR ${total.toLocaleString()}`);
    setCart([]);
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex gap-6 overflow-hidden">
      {/* Product Catalog */}
      <div className="flex-1 flex flex-col min-w-0 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-[var(--color-border)]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-faint)]" />
            <input
              type="text"
              placeholder="Search products by name or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-[var(--color-text)]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProducts.map((p) => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                className="flex flex-col text-left bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg p-3 hover:border-[var(--color-primary)] transition-colors"
              >
                <div className="font-medium text-[var(--color-text)] line-clamp-2 min-h-[2.5rem] mb-2">{p.name}</div>
                <div className="mt-auto flex items-center justify-between w-full">
                  <span className="text-sm font-semibold text-[var(--color-primary)]">
                    SAR {p.unitPrice.toLocaleString()}
                  </span>
                  <span className="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg)] px-2 py-0.5 rounded">
                    {p.unit}
                  </span>
                </div>
              </button>
            ))}
            {filteredProducts.length === 0 && (
              <div className="col-span-full py-12 text-center text-[var(--color-text-muted)]">
                No products found matching "{search}"
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cart Drawer */}
      <div className="w-[400px] flex flex-col shrink-0 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-[var(--color-border)] bg-[var(--color-surface-2)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[var(--color-primary-highlight)] text-[var(--color-primary)] flex items-center justify-center">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-[var(--color-text)]">Current Order</h2>
            <div className="text-sm text-[var(--color-text-muted)]">{cart.length} items</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-[var(--color-text-muted)] space-y-4">
              <ShoppingCart className="w-12 h-12 opacity-20" />
              <p>Your cart is empty</p>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.map((item) => (
                <div key={item.product.id} className="flex flex-col gap-2 p-3 bg-[var(--color-surface-offset)] rounded-lg border border-[var(--color-border)]">
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-medium text-sm text-[var(--color-text)] line-clamp-2">
                      {item.product.name}
                    </span>
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="text-[var(--color-error)] hover:bg-[var(--color-error)]/10 p-1 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md">
                      <button
                        onClick={() => updateQuantity(item.product.id, -1)}
                        className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.product.id, 1)}
                        className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <span className="font-semibold text-[var(--color-text)]">
                      SAR {(item.product.unitPrice * item.quantity).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-surface-offset)] space-y-3">
          <div className="flex justify-between text-sm text-[var(--color-text-muted)]">
            <span>Subtotal</span>
            <span>SAR {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between text-sm text-[var(--color-text-muted)]">
            <span>VAT</span>
            <span>SAR {taxTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between text-lg font-bold text-[var(--color-text)] pt-2 border-t border-[var(--color-border)]">
            <span>Total</span>
            <span>SAR {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>

          <button
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 mt-4 transition-colors ${
              cart.length === 0
                ? 'bg-[var(--color-border)] text-[var(--color-text-faint)] cursor-not-allowed'
                : 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]'
            }`}
          >
            <CreditCard className="w-5 h-5" />
            Process Payment
          </button>
        </div>
      </div>
    </div>
  );
}
