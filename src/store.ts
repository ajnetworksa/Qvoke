import { create } from 'zustand';
import { Company, Customer, Product, Quotation, Invoice, User, Payment, LineItem, UserRole, Supplier } from './types';

interface ERPState {
  currentPage: string;
  currentRecordId: string | null;
  theme: 'light' | 'dark' | 'system';
  token: string | null;
  currentUser: User | null;
  company: Company;
  customers: Customer[];
  products: Product[];
  quotations: Quotation[];
  invoices: Invoice[];
  suppliers: Supplier[];
  kanbanView: boolean;
  initialized: boolean;
  authChecked: boolean;
  
  setCurrentPage: (page: string) => void;
  setRoute: (page: string, id?: string | null) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setKanbanView: (val: boolean) => void;
  
  // Authentication & Session
  login: (email: string, password: string, rememberMe: boolean) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  initializeStore: () => Promise<void>;

  // Company Profile
  updateCompany: (company: Partial<Company>) => Promise<void>;
  
  // Customers CRUD
  addCustomer: (customer: Customer) => Promise<void>;
  updateCustomer: (customer: Customer) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  
  // Products CRUD
  addProduct: (product: Product) => Promise<void>;
  updateProduct: (product: Product) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;

  // Suppliers CRUD
  fetchSuppliers: () => Promise<void>;
  addSupplier: (name: string) => Promise<void>;
  updateSupplier: (id: string, name: string) => Promise<void>;
  deleteSupplier: (id: string) => Promise<void>;
  
  // Quotations CRUD & Business Logic
  addQuotation: (quotation: Quotation) => Promise<void>;
  updateQuotation: (quotation: Quotation) => Promise<void>;
  deleteQuotation: (id: string) => Promise<void>;
  confirmQuotation: (id: string) => Promise<void>;
  convertToInvoice: (id: string) => Promise<string | null>; // returns invoice id if successful
  
  // Invoices CRUD & Business Logic
  addInvoice: (invoice: Invoice) => Promise<void>;
  updateInvoice: (invoice: Invoice) => Promise<void>;
  deleteInvoice: (id: string) => Promise<void>;
  postInvoice: (id: string) => Promise<void>;
  recordPayment: (invoiceId: string, payment: Payment) => Promise<void>;
}

// Helper: Calculate totals for Line Items
export const calculateTotals = (items: LineItem[]) => {
  let subtotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;

  items.forEach((item) => {
    if (item.type !== 'item') return;
    
    const baseAmount = item.quantity * item.unitPrice;
    const discountAmount = baseAmount * (item.discountPercent / 100);
    const lineSubtotal = baseAmount - discountAmount;
    const lineTax = lineSubtotal * (item.taxPercent / 100);
    
    item.subtotal = Math.round(lineSubtotal * 100) / 100;
    
    subtotal += baseAmount;
    discountTotal += discountAmount;
    taxTotal += lineTax;
  });

  const finalSubtotal = Math.round((subtotal - discountTotal) * 100) / 100;
  const finalDiscountTotal = Math.round(discountTotal * 100) / 100;
  const finalTaxTotal = Math.round(taxTotal * 100) / 100;
  const total = Math.round((finalSubtotal + finalTaxTotal) * 100) / 100;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discountTotal: finalDiscountTotal,
    taxTotal: finalTaxTotal,
    total
  };
};

const API_BASE = '/api';

// Standard Fetch Helper with Token
const apiFetch = async (url: string, options: RequestInit = {}, token: string | null) => {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  } as Record<string, string>;

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${url}`, { ...options, headers });
  if (res.status === 401) {
    // Session token expired/invalid
    localStorage.removeItem('erp_token');
    window.location.reload();
    throw new Error('Unauthorized');
  }
  return res;
};

// Fallback empty structures
const defaultCompany: Company = {
  id: 'c-1',
  name: import.meta.env.VITE_COPYRIGHT_BY || 'Qvoke',
  logo: '',
  address: { street: '', district: '', city: '', postalCode: '', country: 'SA' },
  phone: '',
  email: '',
  currency: import.meta.env.VITE_DEFAULT_CURRENCY || 'SAR',
  defaultTax: Number(import.meta.env.VITE_DEFAULT_TAX) || 15,
  brandColor: import.meta.env.VITE_BRAND_COLOR || '#01696f'
};

export const useERPStore = create<ERPState>((set, get) => ({
  currentPage: 'dashboard',
  currentRecordId: null,
  theme: (localStorage.getItem('erp_theme') as 'light' | 'dark' | 'system') || 'system',
  token: localStorage.getItem('erp_token'),
  currentUser: null,
  company: defaultCompany,
  customers: [],
  products: [],
  quotations: [],
  invoices: [],
  suppliers: [],
  kanbanView: false,
  initialized: false,
  authChecked: false,

  setCurrentPage: (page) => set({ currentPage: page, currentRecordId: null }),
  setRoute: (page, id = null) => set({ currentPage: page, currentRecordId: id }),
  
  setTheme: (theme) => {
    if (theme === 'system') {
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', systemPrefersDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
    localStorage.setItem('erp_theme', theme);
    set({ theme });
  },

  setKanbanView: (val) => set({ kanbanView: val }),

  // ── AUTHENTICATION ACTIONS ──────────────────────────────────────────────────
  login: async (email, password, rememberMe) => {
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, rememberMe })
      });
      const data = await res.json();
      if (res.ok) {
        if (rememberMe) {
          localStorage.setItem('erp_token', data.token);
        } else {
          sessionStorage.setItem('erp_token', data.token);
        }
        set({ token: data.token, currentUser: data.user, currentPage: 'dashboard' });
        await get().initializeStore();
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Authentication failed' };
      }
    } catch (err) {
      return { success: false, error: 'Cannot connect to backend server.' };
    }
  },

  logout: async () => {
    const { token } = get();
    if (token) {
      try {
        await apiFetch('/logout', { method: 'POST' }, token);
      } catch (e) {}
    }
    localStorage.removeItem('erp_token');
    sessionStorage.removeItem('erp_token');
    set({ token: null, currentUser: null, initialized: false, currentPage: 'dashboard' });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('erp_token') || sessionStorage.getItem('erp_token');
    if (!token) {
      set({ token: null, currentUser: null, authChecked: true });
      return;
    }
    try {
      const res = await apiFetch('/me', {}, token);
      if (res.ok) {
        const user = await res.json();
        set({ token, currentUser: user, authChecked: true });
        await get().initializeStore();
      } else {
        set({ token: null, currentUser: null, authChecked: true });
      }
    } catch (err) {
      set({ token: null, currentUser: null, authChecked: true });
    }
  },

  initializeStore: async () => {
    const { token, initialized } = get();
    if (!token || initialized) return;

    try {
      // 1. Fetch Company Settings & Logo
      const companyRes = await apiFetch('/settings/company', {}, token);
      let companyData = companyRes.ok ? await companyRes.json() : get().company;
      try {
        const logoRes = await apiFetch('/settings/logo', {}, token);
        if (logoRes.ok) {
          const logoData = await logoRes.json();
          if (logoData && logoData.value) {
            companyData = { ...companyData, logo: logoData.value };
          }
        }
      } catch (e) {
        console.error('Failed to fetch company logo:', e);
      }
      try {
        const siteLogoRes = await apiFetch('/settings/siteLogo', {}, token);
        if (siteLogoRes.ok) {
          const siteLogoData = await siteLogoRes.json();
          if (siteLogoData && siteLogoData.value) {
            companyData = { ...companyData, siteLogo: siteLogoData.value };
          }
        }
      } catch (e) {
        console.error('Failed to fetch site logo:', e);
      }
      try {
        const lnfRes = await apiFetch('/settings/lineNumberFormat', {}, token);
        if (lnfRes.ok) {
          const lnfData = await lnfRes.json();
          if (lnfData && lnfData.value) {
            companyData = { ...companyData, lineNumberFormat: lnfData.value as any };
          }
        }
      } catch (e) {
        console.error('Failed to fetch lineNumberFormat:', e);
      }
      set({ company: companyData });

      // 2. Fetch Customers
      const custRes = await apiFetch('/customers', {}, token);
      if (custRes.ok) {
        set({ customers: await custRes.json() });
      }

      // 3. Fetch Products
      const prodRes = await apiFetch('/products', {}, token);
      if (prodRes.ok) {
        set({ products: await prodRes.json() });
      }

      // 4. Fetch Quotations
      const quoteRes = await apiFetch('/quotes', {}, token);
      if (quoteRes.ok) {
        set({ quotations: await quoteRes.json() });
      }

      // 5. Fetch Invoices
      const invRes = await apiFetch('/invoices', {}, token);
      if (invRes.ok) {
        set({ invoices: await invRes.json() });
      }

      // 6. Fetch Suppliers
      const supRes = await apiFetch('/suppliers', {}, token);
      if (supRes.ok) {
        set({ suppliers: await supRes.json() });
      }

      set({ initialized: true });
    } catch (err) {
      console.error('Store initialization failed:', err);
    }
  },

  // ── COMPANY UPDATE ──────────────────────────────────────────────────────────
  updateCompany: async (updatedFields) => {
    const { token, company } = get();
    const newCompany = { ...company, ...updatedFields };
    try {
      const res = await apiFetch('/settings/company', {
        method: 'POST',
        body: JSON.stringify(newCompany)
      }, token);
      if (res.ok) {
        set({ company: newCompany });
      }
    } catch (err) {
      console.error(err);
    }
  },

  // ── CUSTOMERS CRUD ──────────────────────────────────────────────────────────
  addCustomer: async (customer) => {
    const { token, customers } = get();
    try {
      const res = await apiFetch('/customers', {
        method: 'POST',
        body: JSON.stringify(customer)
      }, token);
      if (res.ok) {
        set({ customers: [customer, ...customers] });
      }
    } catch (err) {
      console.error(err);
    }
  },

  updateCustomer: async (customer) => {
    const { token, customers } = get();
    try {
      const res = await apiFetch(`/customers/${customer.id}`, {
        method: 'PUT',
        body: JSON.stringify(customer)
      }, token);
      if (res.ok) {
        set({ customers: customers.map((c) => (c.id === customer.id ? customer : c)) });
      }
    } catch (err) {
      console.error(err);
    }
  },

  deleteCustomer: async (id) => {
    const { token, customers } = get();
    try {
      const res = await apiFetch(`/customers/${id}`, { method: 'DELETE' }, token);
      if (res.ok) {
        set({ customers: customers.filter((c) => c.id !== id) });
      }
    } catch (err) {
      console.error(err);
    }
  },

  // ── SUPPLIERS CRUD ──────────────────────────────────────────────────────────
  fetchSuppliers: async () => {
    const { token } = get();
    try {
      const res = await apiFetch('/suppliers', {}, token);
      if (res.ok) {
        set({ suppliers: await res.json() });
      }
    } catch (err) {
      console.error(err);
    }
  },

  addSupplier: async (name) => {
    const { token, suppliers } = get();
    try {
      const res = await apiFetch('/suppliers', {
        method: 'POST',
        body: JSON.stringify({ name })
      }, token);
      if (res.ok) {
        const newSup = await res.json();
        set({ suppliers: [...suppliers, newSup] });
      }
    } catch (err) {
      console.error(err);
    }
  },

  updateSupplier: async (id, name) => {
    const { token, suppliers } = get();
    try {
      const res = await apiFetch(`/suppliers/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name })
      }, token);
      if (res.ok) {
        set({
          suppliers: suppliers.map((s) => (s.id === id ? { ...s, name } : s))
        });
      }
    } catch (err) {
      console.error(err);
    }
  },

  deleteSupplier: async (id) => {
    const { token, suppliers } = get();
    try {
      const res = await apiFetch(`/suppliers/${id}`, { method: 'DELETE' }, token);
      if (res.ok) {
        set({ suppliers: suppliers.filter((s) => s.id !== id) });
      }
    } catch (err) {
      console.error(err);
    }
  },

  // ── PRODUCTS CRUD ───────────────────────────────────────────────────────────
  addProduct: async (product) => {
    const { token, products } = get();
    try {
      const res = await apiFetch('/products', {
        method: 'POST',
        body: JSON.stringify(product)
      }, token);
      if (res.ok) {
        set({ products: [product, ...products] });
      }
    } catch (err) {
      console.error(err);
    }
  },

  updateProduct: async (product) => {
    const { token, products } = get();
    try {
      const res = await apiFetch(`/products/${product.id}`, {
        method: 'PUT',
        body: JSON.stringify(product)
      }, token);
      if (res.ok) {
        set({ products: products.map((p) => (p.id === product.id ? product : p)) });
      }
    } catch (err) {
      console.error(err);
    }
  },

  deleteProduct: async (id) => {
    const { token, products } = get();
    try {
      const res = await apiFetch(`/products/${id}`, { method: 'DELETE' }, token);
      if (res.ok) {
        set({ products: products.filter((p) => p.id !== id) });
      }
    } catch (err) {
      console.error(err);
    }
  },

  // ── QUOTATIONS CRUD ─────────────────────────────────────────────────────────
  addQuotation: async (quotation) => {
    const { token, quotations } = get();
    try {
      const res = await apiFetch('/quotes', {
        method: 'POST',
        body: JSON.stringify(quotation)
      }, token);
      if (res.ok) {
        set({ quotations: [quotation, ...quotations] });
      }
    } catch (err) {
      console.error(err);
    }
  },

  updateQuotation: async (quotation) => {
    const { token, quotations } = get();
    try {
      const res = await apiFetch(`/quotes/${quotation.id}`, {
        method: 'PUT',
        body: JSON.stringify(quotation)
      }, token);
      if (res.ok) {
        set({ quotations: quotations.map((q) => (q.id === quotation.id ? quotation : q)) });
      }
    } catch (err) {
      console.error(err);
    }
  },

  deleteQuotation: async (id) => {
    const { token, quotations } = get();
    try {
      const res = await apiFetch(`/quotes/${id}`, { method: 'DELETE' }, token);
      if (res.ok) {
        set({ quotations: quotations.filter((q) => q.id !== id) });
      }
    } catch (err) {
      console.error(err);
    }
  },

  confirmQuotation: async (id) => {
    const { token, quotations } = get();
    const quote = quotations.find((q) => q.id === id);
    if (!quote) return;
    const updated = { ...quote, status: 'confirmed' as const, updatedAt: new Date() };
    try {
      const res = await apiFetch(`/quotes/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updated)
      }, token);
      if (res.ok) {
        set({ quotations: quotations.map((q) => (q.id === id ? updated : q)) });
      }
    } catch (err) {
      console.error(err);
    }
  },

  convertToInvoice: async (id) => {
    const { token, quotations, invoices } = get();
    const quote = quotations.find((q) => q.id === id);
    if (!quote) return null;

    const invoiceNumber = `INV-2026-${String(invoices.length + 1).padStart(4, '0')}`;
    const invoiceId = `inv-${Date.now()}`;
    
    const newInvoice: Invoice = {
      id: invoiceId,
      number: invoiceNumber,
      customerId: quote.customerId,
      date: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days due
      status: 'draft',
      paymentTerms: 'Net 30',
      lineItems: JSON.parse(JSON.stringify(quote.lineItems)),
      notes: quote.notes,
      terms: quote.terms,
      currency: quote.currency,
      subtotal: quote.subtotal,
      discountTotal: quote.discountTotal,
      taxTotal: quote.taxTotal,
      total: quote.total,
      linkedQuoteId: quote.id,
      payments: [],
      amountPaid: 0,
      amountDue: quote.total,
      createdAt: new Date(),
      updatedAt: new Date(),
      salespersonId: quote.salespersonId,
      watermarkText: quote.watermarkText,
      watermarkType: quote.watermarkType
    };

    try {
      // 1. Create Invoice on Backend
      const invRes = await apiFetch('/invoices', {
        method: 'POST',
        body: JSON.stringify(newInvoice)
      }, token);

      if (!invRes.ok) return null;

      // 2. Link Quotation to Invoice
      const updatedQuote = { ...quote, linkedInvoiceId: invoiceId, status: 'confirmed' as const, updatedAt: new Date() };
      const quoteRes = await apiFetch(`/quotes/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updatedQuote)
      }, token);

      if (quoteRes.ok) {
        set({
          invoices: [newInvoice, ...invoices],
          quotations: quotations.map((q) => (q.id === id ? updatedQuote : q))
        });
        return invoiceId;
      }
    } catch (err) {
      console.error(err);
    }
    return null;
  },

  // ── INVOICES CRUD ───────────────────────────────────────────────────────────
  addInvoice: async (invoice) => {
    const { token, invoices } = get();
    try {
      const res = await apiFetch('/invoices', {
        method: 'POST',
        body: JSON.stringify(invoice)
      }, token);
      if (res.ok) {
        set({ invoices: [invoice, ...invoices] });
      }
    } catch (err) {
      console.error(err);
    }
  },

  updateInvoice: async (invoice) => {
    const { token, invoices } = get();
    try {
      const res = await apiFetch(`/invoices/${invoice.id}`, {
        method: 'PUT',
        body: JSON.stringify(invoice)
      }, token);
      if (res.ok) {
        set({ invoices: invoices.map((i) => (i.id === invoice.id ? invoice : i)) });
      }
    } catch (err) {
      console.error(err);
    }
  },

  deleteInvoice: async (id) => {
    const { token, invoices } = get();
    try {
      const res = await apiFetch(`/invoices/${id}`, { method: 'DELETE' }, token);
      if (res.ok) {
        set({ invoices: invoices.filter((i) => i.id !== id) });
      }
    } catch (err) {
      console.error(err);
    }
  },

  postInvoice: async (id) => {
    const { token, invoices } = get();
    const invoice = invoices.find((i) => i.id === id);
    if (!invoice) return;
    const updated = { ...invoice, status: 'posted' as const, updatedAt: new Date() };
    try {
      const res = await apiFetch(`/invoices/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updated)
      }, token);
      if (res.ok) {
        set({ invoices: invoices.map((i) => (i.id === id ? updated : i)) });
      }
    } catch (err) {
      console.error(err);
    }
  },

  recordPayment: async (invoiceId, payment) => {
    const { token, invoices } = get();
    const inv = invoices.find((i) => i.id === invoiceId);
    if (!inv) return;

    const payments = [...inv.payments, payment];
    const amountPaid = Math.round(payments.reduce((sum, p) => sum + p.amount, 0) * 100) / 100;
    const amountDue = Math.round((inv.total - amountPaid) * 100) / 100;
    
    let status: Invoice['status'] = inv.status;
    if (amountDue <= 0) {
      status = 'paid';
    } else if (amountPaid > 0) {
      status = 'partial';
    }

    const updatedInvoice = {
      ...inv,
      payments,
      amountPaid,
      amountDue,
      status,
      updatedAt: new Date()
    };

    try {
      const res = await apiFetch(`/invoices/${invoiceId}`, {
        method: 'PUT',
        body: JSON.stringify(updatedInvoice)
      }, token);
      if (res.ok) {
        set({ invoices: invoices.map((i) => (i.id === invoiceId ? updatedInvoice : i)) });
      }
    } catch (err) {
      console.error(err);
    }
  }
}));
