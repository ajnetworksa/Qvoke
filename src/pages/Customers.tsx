import React, { useState } from 'react';
import { useERPStore } from '../store';
import { Customer } from '../types';
import { PageHeader } from '../components/PageHeader';
import { matchSearchQuery } from '../utils/search';
import { EmptyState } from '../components/EmptyState';
import { ExcelImportExport } from '../components/ExcelImportExport';
import { useDebouncedAutosave } from '../hooks/useDebouncedAutosave';
import { UserCheck, Plus, Search, Trash2, Edit3, X, Mail, Phone, MapPin, Building, Loader2, Check } from 'lucide-react';

export const Customers: React.FC = () => {
  const { customers, quotations, invoices, addCustomer, updateCustomer, deleteCustomer, company, currentUser, token } = useERPStore();
  const canDelete = currentUser?.role === 'admin' || !!currentUser?.permissions?.canDeleteData;

  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editCustId, setEditCustId] = useState<string | null>(null);

  // Form states
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [street, setStreet] = useState('');
  const [district, setDistrict] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');

  const filtered = customers.filter(c =>
    matchSearchQuery(search, [
      c.companyName,
      c.contactPerson,
      c.email,
      c.phone,
      c.vatNumber,
      c.billingAddress?.street,
      c.billingAddress?.district,
      c.billingAddress?.city
    ])
  );

  // Get dynamic calculations for customers
  const getCustomerStats = (customerId: string) => {
    const custQuotes = quotations.filter((q) => q.customerId === customerId);
    const custInvoices = invoices.filter((i) => i.customerId === customerId);

    const totalInvoiced = custInvoices.reduce((sum, i) => sum + i.total, 0);
    const totalOutstanding = custInvoices.reduce((sum, i) => sum + i.amountDue, 0);

    return {
      quoteCount: custQuotes.length,
      invoiceCount: custInvoices.length,
      totalInvoiced,
      totalOutstanding
    };
  };

  const handleOpenCreate = () => {
    setEditCustId(null);
    setCompanyName('');
    setContactPerson('');
    setEmail('');
    setPhone('');
    setVatNumber('');
    setStreet('');
    setDistrict('');
    setCity('Riyadh');
    setPostalCode('');
    setFormOpen(true);
  };

  const handleOpenEdit = (c: Customer) => {
    setEditCustId(c.id);
    setCompanyName(c.companyName);
    setContactPerson(c.contactPerson || '');
    setEmail(c.email);
    setPhone(c.phone);
    setVatNumber(c.vatNumber || '');
    setStreet(c.billingAddress.street);
    setDistrict(c.billingAddress.district || '');
    setCity(c.billingAddress.city);
    setPostalCode(c.billingAddress.postalCode || '');
    setFormOpen(true);
  };

  const buildPayload = (): Customer => ({
    id: editCustId || `cust-${Date.now()}`,
    companyName,
    contactPerson,
    email,
    phone,
    vatNumber,
    billingAddress: { street, district, city, postalCode, country: 'SA' },
    createdAt: editCustId
      ? customers.find((c) => c.id === editCustId)?.createdAt || new Date()
      : new Date()
  });

  // Autosave edits to an existing customer (debounced); create stays explicit.
  const autoSave = useDebouncedAutosave(
    formOpen && !!editCustId,
    editCustId,
    [companyName, contactPerson, email, phone, vatNumber, street, district, city, postalCode],
    () => { if (companyName.trim()) updateCustomer(buildPayload()); }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return;
    if (editCustId) {
      updateCustomer(buildPayload()); // flush latest immediately
      setFormOpen(false);
    } else {
      addCustomer(buildPayload());
      setFormOpen(false);
      alert('Customer Added Successfully!');
    }
  };

  return (
    <div className="animate-fade-in text-left">
      <PageHeader
        title="Customers / العملاء"
        breadcrumbs={[{ label: 'Home' }, { label: 'Customers' }]}
        actions={
          <div className="flex gap-2">
            <ExcelImportExport
              title="Customers"
              entityType="customers"
              token={token}
              columns={[
                { key: 'id', label: 'ID' },
                { key: 'companyName', label: 'Company Name' },
                { key: 'contactPerson', label: 'Contact Person' },
                { key: 'email', label: 'Email' },
                { key: 'phone', label: 'Phone' },
                { key: 'vatNumber', label: 'VAT Number' },
                { key: 'street', label: 'Street' },
                { key: 'district', label: 'District' },
                { key: 'city', label: 'City' },
                { key: 'postalCode', label: 'Postal Code' },
                { key: 'country', label: 'Country' },
              ]}
            />
            <button
              onClick={handleOpenCreate}
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-semibold py-2.5 px-4 rounded-md flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              New Customer / عميل جديد
            </button>
          </div>
        }
      />

      {/* Directory search */}
      <div className="premium-card p-4 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-3 w-4 h-4 text-[var(--color-text-muted)] pointer-events-none" />
          <input
            type="text"
            placeholder="Search customers by company, person or email address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full premium-input pl-10 pr-4 py-2"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          title="No customers registered"
          description="Register company corporate entities and track billing statements, outstanding ledgers, and contact emails."
          actionText="Create Customer"
          onAction={handleOpenCreate}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((c) => {
            const stats = getCustomerStats(c.id);
            return (
              <div
                key={c.id}
                className="premium-card p-6 flex flex-col justify-between transition-all duration-[var(--transition-interactive)] hover:border-[var(--color-primary)]/40 hover:shadow-md"
              >
                <div className="text-left">
                  <div className="flex items-start justify-between mb-4 border-b border-[var(--color-divider)]/30 pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-[var(--color-text)] leading-tight">{c.companyName}</h3>
                      <span className="text-[10px] font-mono text-[var(--color-text-muted)] mt-1 block">
                        VAT ID: {c.vatNumber || 'None'}
                      </span>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleOpenEdit(c)}
                        className="p-1.5 hover:bg-[var(--color-surface-offset)] rounded text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors cursor-pointer"
                        aria-label="Edit Profile"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                       {canDelete && (
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete ${c.companyName}?`)) deleteCustomer(c.id);
                          }}
                          className="p-1.5 hover:bg-[var(--color-error)]/10 rounded text-[var(--color-text-faint)] hover:text-[var(--color-error)] transition-colors cursor-pointer"
                          aria-label="Delete Profile"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2.5 text-xs font-semibold text-[var(--color-text-muted)] border-b border-[var(--color-divider)]/30 pb-4 mb-4">
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-[var(--color-text-faint)] flex-shrink-0" />
                      <span className="truncate">{c.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-[var(--color-text-faint)] flex-shrink-0" />
                      <span>{c.phone}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-[var(--color-text-faint)] flex-shrink-0" />
                      <span className="truncate">
                        {c.billingAddress.city}, {c.billingAddress.street}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Dynamic accounts sums */}
                <div className="grid grid-cols-2 gap-4 text-left">
                  <div className="bg-[var(--color-surface-2)] p-2.5 rounded border border-[var(--color-border)]/50">
                    <span className="text-[9px] font-black text-[var(--color-text-muted)] uppercase block">Invoiced</span>
                    <span className="text-xs font-black text-[var(--color-text)] font-mono">
                      {stats.totalInvoiced.toLocaleString()} {company.currency}
                    </span>
                  </div>
                  <div className="bg-[var(--color-surface-2)] p-2.5 rounded border border-[var(--color-border)]/50">
                    <span className="text-[9px] font-black text-[var(--color-text-muted)] uppercase block">Unpaid</span>
                    <span className="text-xs font-black text-[var(--color-error)] font-mono">
                      {stats.totalOutstanding.toLocaleString()} {company.currency}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit/Create Form dialog */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setFormOpen(false)} />
          <form
            onSubmit={handleSubmit}
            className="relative w-full max-w-lg bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-lg p-6 overflow-hidden animate-slide-in text-left flex flex-col gap-4"
          >
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
              <h3 className="text-sm font-bold text-[var(--color-text)] flex items-center gap-2">
                {editCustId ? 'Modify Customer Profile / تعديل عميل' : 'Create Customer Profile / إضافة عميل'}
                {editCustId && autoSave === 'saving' && <span className="flex items-center gap-1 text-[10px] font-semibold text-[var(--color-text-muted)]"><Loader2 className="w-3 h-3 animate-spin" /> Saving…</span>}
                {editCustId && autoSave === 'saved' && <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-500"><Check className="w-3 h-3" /> Saved</span>}
              </h3>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="p-1 hover:bg-[var(--color-surface-offset)] rounded transition-colors"
              >
                <X className="w-4 h-4 text-[var(--color-text-muted)]" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-semibold text-[var(--color-text-muted)]">
              <div className="md:col-span-2">
                <label className="block mb-1.5">Company / Est. Name *</label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full premium-input text-sm text-[var(--color-text)] font-semibold"
                  placeholder="e.g. Ahmed Mohammed Al-Arfaj Housing Units Est."
                />
              </div>

              <div>
                <label className="block mb-1.5">Contact Person</label>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  className="w-full premium-input"
                  placeholder="e.g. Mr. Ahmed"
                />
              </div>

              <div>
                <label className="block mb-1.5">VAT Number / الرقم الضريبي</label>
                <input
                  type="text"
                  value={vatNumber}
                  onChange={(e) => setVatNumber(e.target.value)}
                  className="w-full premium-input font-mono"
                  placeholder="e.g. 300567891200003"
                />
              </div>

              <div>
                <label className="block mb-1.5">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full premium-input"
                  placeholder="e.g. contact@domain.sa"
                />
              </div>

              <div>
                <label className="block mb-1.5">Phone Coordinates</label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full premium-input"
                  placeholder="e.g. 0505936329"
                />
              </div>

              <div className="md:col-span-2 border-t border-[var(--color-border)]/40 pt-3 mt-1">
                <span className="text-[10px] font-black uppercase text-[var(--color-text-muted)] mb-2 block">Saudi Address Details</span>
              </div>

              <div>
                <label className="block mb-1.5">Street Address</label>
                <input
                  type="text"
                  required
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  className="w-full premium-input"
                  placeholder="e.g. Al Olaya Dist."
                />
              </div>

              <div>
                <label className="block mb-1.5">District / الحي</label>
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full premium-input"
                  placeholder="e.g. Al Olaya"
                />
              </div>

              <div>
                <label className="block mb-1.5">City / المدينة</label>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full premium-input"
                  placeholder="e.g. Al Khobar"
                />
              </div>

              <div>
                <label className="block mb-1.5">Postal Code / الرمز البريدي</label>
                <input
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  className="w-full premium-input font-mono"
                  placeholder="e.g. 31952"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-4 border-t border-[var(--color-divider)]/40 pt-4">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="px-4 py-2 border border-[var(--color-border)] hover:bg-[var(--color-surface-offset)] rounded-md text-xs font-semibold text-[var(--color-text)] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-md text-xs font-semibold transition-colors cursor-pointer"
              >
                {editCustId ? 'Done' : 'Save Profile'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
export default Customers;
