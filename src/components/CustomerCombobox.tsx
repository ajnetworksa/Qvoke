import React, { useState, useRef, useEffect } from 'react';
import { useERPStore } from '../store';
import { Customer } from '../types';
import { Search, Plus, UserPlus, Check, X } from 'lucide-react';
import { matchSearchQuery } from '../utils/search';

interface CustomerComboboxProps {
  selectedCustomerId?: string;
  onSelect: (customerId: string) => void;
}

export const CustomerCombobox: React.FC<CustomerComboboxProps> = ({
  selectedCustomerId,
  onSelect
}) => {
  const { customers, addCustomer } = useERPStore();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowQuickCreate(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  const filtered = customers.filter(c =>
    matchSearchQuery(search, [c.companyName, c.contactPerson, c.email, c.phone])
  );

  const handleSelect = (id: string) => {
    onSelect(id);
    setIsOpen(false);
    setSearch('');
  };

  const handleQuickCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const newCustId = `cust-${Date.now()}`;
    const newCust: Customer = {
      id: newCustId,
      companyName: newName,
      contactPerson: newName.split(' ')[0],
      email: newEmail || 'info@temporary.sa',
      phone: newPhone || '0500000000',
      billingAddress: {
        street: 'Street 1',
        district: 'Main District',
        city: 'Riyadh',
        postalCode: '11111',
        country: 'SA'
      },
      createdAt: new Date()
    };

    addCustomer(newCust);
    onSelect(newCustId);
    setNewName('');
    setNewEmail('');
    setNewPhone('');
    setShowQuickCreate(false);
    setIsOpen(false);
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
        Customer / العميل
      </label>
      
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between premium-input cursor-pointer py-2.5"
      >
        <span className={selectedCustomer ? 'text-[var(--color-text)]' : 'text-[var(--color-text-faint)]'}>
          {selectedCustomer
            ? `${selectedCustomer.companyName} (${selectedCustomer.contactPerson || ''})`
            : 'Select Customer / اختر عميلاً...'}
        </span>
        <Search className="w-4 h-4 text-[var(--color-text-muted)]" />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-lg overflow-hidden animate-slide-in">
          {!showQuickCreate ? (
            <div className="flex flex-col">
              <div className="flex items-center px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface-offset)]">
                <Search className="w-4 h-4 text-[var(--color-text-muted)] mr-2" />
                <input
                  type="text"
                  placeholder="Search customer / ابحث عن عميل..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-transparent border-0 text-sm focus:outline-none focus:ring-0 text-[var(--color-text)]"
                  autoFocus
                />
                {search && (
                  <button onClick={() => setSearch('')} type="button">
                    <X className="w-4 h-4 text-[var(--color-text-muted)]" />
                  </button>
                )}
              </div>

              <div className="max-h-60 overflow-y-auto">
                {filtered.length > 0 ? (
                  filtered.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => handleSelect(c.id)}
                      className={`flex items-center justify-between px-4 py-2.5 text-sm cursor-pointer hover:bg-[var(--color-surface-offset)] transition-colors ${
                        c.id === selectedCustomerId ? 'bg-[var(--color-primary-highlight)]/20 font-semibold text-[var(--color-primary)]' : 'text-[var(--color-text)]'
                      }`}
                    >
                      <div>
                        <div className="font-medium">{c.companyName}</div>
                        <div className="text-xs text-[var(--color-text-muted)]">
                          {c.contactPerson ? `${c.contactPerson} • ` : ''}{c.email}
                        </div>
                      </div>
                      {c.id === selectedCustomerId && <Check className="w-4 h-4 text-[var(--color-primary)]" />}
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-3 text-sm text-[var(--color-text-muted)] text-center">
                    No customers found
                  </div>
                )}
              </div>

              <div
                onClick={() => {
                  setNewName(search);
                  setShowQuickCreate(true);
                }}
                className="flex items-center justify-center gap-2 px-4 py-3 border-t border-[var(--color-border)] text-sm font-semibold text-[var(--color-primary)] bg-[var(--color-surface-2)] cursor-pointer hover:bg-[var(--color-primary-highlight)]/30 transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Add New Customer / إضافة عميل جديد
              </div>
            </div>
          ) : (
            <form onSubmit={handleQuickCreate} className="p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2 mb-1">
                <span className="text-sm font-bold text-[var(--color-text)]">Quick Create / إنشاء سريع</span>
                <button
                  type="button"
                  onClick={() => setShowQuickCreate(false)}
                  className="p-1 hover:bg-[var(--color-surface-offset)] rounded"
                >
                  <X className="w-4 h-4 text-[var(--color-text-muted)]" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Company Name *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full premium-input py-1.5"
                  placeholder="e.g. Saudi Aramco"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Email</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full premium-input py-1.5 text-xs"
                    placeholder="info@company.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Phone</label>
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full premium-input py-1.5 text-xs"
                    placeholder="05xxxxxxx"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white py-2 px-4 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Save & Select Customer
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
export default CustomerCombobox;
