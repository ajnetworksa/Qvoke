import React, { useState } from 'react';
import { useERPStore } from '../store';
import { PageHeader } from '../components/PageHeader';
import { CompanyMembership } from '../types';
import {
  Building,
  Plus,
  Check,
  ArrowRightLeft,
  Pencil,
  X,
  Crown,
  ShieldCheck,
  User as UserIcon,
  Loader2
} from 'lucide-react';

const ROLE_META: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  owner: { label: 'Owner', icon: Crown, cls: 'text-amber-600 bg-amber-500/10 border-amber-500/20' },
  admin: { label: 'Admin', icon: ShieldCheck, cls: 'text-[var(--color-primary)] bg-[var(--color-primary)]/10 border-[var(--color-primary)]/20' },
  member: { label: 'Member', icon: UserIcon, cls: 'text-[var(--color-text-muted)] bg-[var(--color-surface-offset)] border-[var(--color-border)]' }
};

const PLANS = ['starter', 'professional', 'enterprise'];

export const Companies: React.FC = () => {
  const { companies, activeCompanyId, switchCompany, createCompany, updateCompanyOrg } = useERPStore();

  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPlan, setEditPlan] = useState('enterprise');

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    const id = await createCompany(name);
    setCreating(false);
    setNewName('');
    if (id) await switchCompany(id);
  };

  const handleSwitch = async (id: string) => {
    if (id === activeCompanyId) return;
    setSwitchingId(id);
    await switchCompany(id);
    setSwitchingId(null);
  };

  const openEdit = (c: CompanyMembership) => {
    setEditId(c.id);
    setEditName(c.name);
    setEditPlan(c.activePlan || 'enterprise');
  };

  const saveEdit = async () => {
    if (!editId) return;
    await updateCompanyOrg(editId, { name: editName.trim(), activePlan: editPlan });
    setEditId(null);
  };

  return (
    <div className="animate-fade-in text-left">
      <PageHeader
        title="Companies / الشركات"
        breadcrumbs={[{ label: 'Home' }, { label: 'Companies' }]}
      />

      <p className="text-xs text-[var(--color-text-muted)] mb-6 max-w-2xl">
        Each company keeps its own customers, products, quotations, invoices and BOQ/BOM —
        completely isolated. Switch the active company here or from the building icon in the
        top bar. Creating a company makes you its owner.
      </p>

      {/* Company grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {companies.map((c) => {
          const isActive = c.id === activeCompanyId;
          const role = ROLE_META[c.role] || ROLE_META.member;
          const RoleIcon = role.icon;
          const canEdit = c.role === 'owner' || c.role === 'admin';
          return (
            <div
              key={c.id}
              className={`premium-card interactive p-5 flex flex-col gap-4 ${
                isActive ? 'border-[var(--color-primary)] ring-1 ring-[var(--color-primary)]/30' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    isActive ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-surface-offset)] text-[var(--color-primary)]'
                  }`}>
                    <Building className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-[var(--color-text)] truncate">{c.name}</h3>
                    <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold">{c.activePlan}</span>
                  </div>
                </div>
                {isActive && (
                  <span className="flex items-center gap-1 text-[10px] font-black text-[var(--color-primary)] bg-[var(--color-primary)]/10 px-2 py-1 rounded-full shrink-0">
                    <Check className="w-3 h-3" /> ACTIVE
                  </span>
                )}
              </div>

              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border w-fit ${role.cls}`}>
                <RoleIcon className="w-3 h-3" /> {role.label}
              </span>

              <div className="flex items-center gap-2 mt-auto pt-2">
                {isActive ? (
                  <span className="flex-1 text-center text-xs font-bold text-[var(--color-text-muted)] py-2">Current company</span>
                ) : (
                  <button
                    onClick={() => handleSwitch(c.id)}
                    disabled={switchingId === c.id}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-bold py-2 rounded-md transition-colors cursor-pointer disabled:opacity-60"
                  >
                    {switchingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRightLeft className="w-3.5 h-3.5" />}
                    Switch
                  </button>
                )}
                {canEdit && (
                  <button
                    onClick={() => openEdit(c)}
                    className="p-2 rounded-md border border-[var(--color-border)] hover:bg-[var(--color-surface-offset)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors cursor-pointer"
                    title="Edit company"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Create new company card */}
        <div className="premium-card p-5 flex flex-col gap-3 border-dashed">
          <div className="flex items-center gap-2 text-sm font-bold text-[var(--color-text)]">
            <Plus className="w-4 h-4 text-[var(--color-primary)]" /> New Company
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)]">Spin up a fresh, empty workspace. You'll be its owner.</p>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
            placeholder="Company name…"
            className="w-full premium-input text-sm"
          />
          <button
            onClick={handleCreate}
            disabled={!newName.trim() || creating}
            className="flex items-center justify-center gap-1.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-bold py-2 rounded-md transition-colors cursor-pointer disabled:opacity-50"
          >
            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Create &amp; Switch
          </button>
        </div>
      </div>

      {/* Edit modal */}
      {editId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setEditId(null)} />
          <div className="relative w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-lg p-6 animate-scale-in flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
              <h3 className="text-sm font-bold text-[var(--color-text)] flex items-center gap-2">
                <Building className="w-4 h-4 text-[var(--color-primary)]" /> Edit Company
              </h3>
              <button onClick={() => setEditId(null)} className="p-1 hover:bg-[var(--color-surface-offset)] rounded cursor-pointer">
                <X className="w-4 h-4 text-[var(--color-text-muted)]" />
              </button>
            </div>
            <div className="text-xs font-semibold text-[var(--color-text-muted)]">
              <label className="block mb-1.5">Company name</label>
              <input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full premium-input text-sm text-[var(--color-text)]" />
            </div>
            <div className="text-xs font-semibold text-[var(--color-text-muted)]">
              <label className="block mb-1.5">Plan</label>
              <select value={editPlan} onChange={(e) => setEditPlan(e.target.value)} className="w-full premium-input text-sm capitalize">
                {PLANS.map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}
              </select>
            </div>
            <div className="flex items-center justify-end gap-3 mt-2 border-t border-[var(--color-divider)]/40 pt-4 text-xs font-semibold">
              <button onClick={() => setEditId(null)} className="px-4 py-2 border border-[var(--color-border)] hover:bg-[var(--color-surface-offset)] rounded-md text-[var(--color-text)] transition-colors cursor-pointer">Cancel</button>
              <button onClick={saveEdit} disabled={!editName.trim()} className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-md transition-colors cursor-pointer disabled:opacity-50">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default Companies;
