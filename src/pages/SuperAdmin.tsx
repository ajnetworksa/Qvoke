import React, { useEffect, useMemo, useState } from 'react';
import { useERPStore } from '../store';
import { PageHeader } from '../components/PageHeader';
import { AdminCompany } from '../types';
import {
  ShieldCheck,
  Building,
  Plus,
  Pause,
  Play,
  Trash2,
  Pencil,
  X,
  Bell,
  Send,
  Users,
  FileSpreadsheet,
  FileText,
  Loader2,
  Link as LinkIcon,
  Check
} from 'lucide-react';

const PLANS = ['starter', 'professional', 'enterprise'];

export const SuperAdmin: React.FC = () => {
  const token = useERPStore((s) => s.token);
  const authH = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const host = window.location.host;

  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Create tenant form
  const [newName, setNewName] = useState('');
  const [newOwner, setNewOwner] = useState('');
  const [newPlan, setNewPlan] = useState('enterprise');
  const [creating, setCreating] = useState(false);

  // Edit modal
  const [edit, setEdit] = useState<AdminCompany | null>(null);
  const [editName, setEditName] = useState('');
  const [editPlan, setEditPlan] = useState('enterprise');

  // Notification composer
  const [target, setTarget] = useState<'all' | 'company' | 'user'>('all');
  const [targetId, setTargetId] = useState('');
  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sentMsg, setSentMsg] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [c, u] = await Promise.all([
        fetch('/api/admin/companies', { headers: authH }).then((r) => r.json()),
        fetch('/api/admin/users', { headers: authH }).then((r) => r.json())
      ]);
      setCompanies(c.companies || []);
      setUsers(u.users || []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const totals = useMemo(() => ({
    tenants: companies.length,
    active: companies.filter((c) => c.status === 'active').length,
    suspended: companies.filter((c) => c.status === 'suspended').length
  }), [companies]);

  const patch = async (id: string, bodyObj: any) => {
    setBusyId(id);
    await fetch(`/api/admin/companies/${id}`, { method: 'PATCH', headers: authH, body: JSON.stringify(bodyObj) });
    await load();
    setBusyId(null);
  };

  const create = async () => {
    if (!newName.trim() || creating) return;
    setCreating(true);
    await fetch('/api/admin/companies', {
      method: 'POST', headers: authH,
      body: JSON.stringify({ name: newName.trim(), ownerEmail: newOwner.trim() || undefined, activePlan: newPlan })
    });
    setNewName(''); setNewOwner(''); setNewPlan('enterprise');
    await load();
    setCreating(false);
  };

  const remove = async (c: AdminCompany) => {
    if (!window.confirm(`Delete "${c.name}" and ALL its data? This cannot be undone.`)) return;
    setBusyId(c.id);
    await fetch(`/api/admin/companies/${c.id}`, { method: 'DELETE', headers: authH });
    await load();
    setBusyId(null);
  };

  const saveEdit = async () => {
    if (!edit) return;
    await patch(edit.id, { name: editName.trim(), activePlan: editPlan });
    setEdit(null);
  };

  const sendNotification = async () => {
    if (!notifTitle.trim() || sending) return;
    if (target !== 'all' && !targetId) { setSentMsg('Pick a target first.'); return; }
    setSending(true); setSentMsg('');
    const res = await fetch('/api/admin/notifications', {
      method: 'POST', headers: authH,
      body: JSON.stringify({ target, targetId: target === 'all' ? undefined : targetId, title: notifTitle.trim(), body: notifBody.trim() || undefined })
    });
    const data = await res.json();
    setSending(false);
    if (res.ok) {
      setNotifTitle(''); setNotifBody('');
      setSentMsg(data.recipients === -1 ? 'Sent to everyone.' : `Sent to ${data.recipients} recipient(s).`);
      setTimeout(() => setSentMsg(''), 4000);
    } else {
      setSentMsg(data.error || 'Failed to send.');
    }
  };

  const accessUrl = (slug?: string | null) => slug ? `${slug}.${host.replace(/^[^.]+\./, '')}` : '—';

  return (
    <div className="animate-fade-in text-left">
      <PageHeader
        title="Platform Admin / لوحة المنصة"
        breadcrumbs={[{ label: 'Home' }, { label: 'Platform Admin' }]}
        actions={
          <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-primary)] bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 px-3 py-1.5 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5" /> Super Admin
          </span>
        }
      />

      {/* Totals */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Tenants', value: totals.tenants },
          { label: 'Active', value: totals.active },
          { label: 'Suspended', value: totals.suspended }
        ].map((s) => (
          <div key={s.label} className="premium-card p-4 text-center">
            <div className="text-2xl font-bold font-mono text-[var(--color-text)]">{s.value}</div>
            <div className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tenant list */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Create tenant */}
          <div className="premium-card p-4">
            <h3 className="text-sm font-bold text-[var(--color-text)] mb-3 flex items-center gap-2"><Plus className="w-4 h-4 text-[var(--color-primary)]" /> Create Tenant Company</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Company name" className="premium-input text-sm" />
              <input value={newOwner} onChange={(e) => setNewOwner(e.target.value)} placeholder="Owner email (optional)" className="premium-input text-sm" />
              <select value={newPlan} onChange={(e) => setNewPlan(e.target.value)} className="premium-input text-sm capitalize">
                {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <button onClick={create} disabled={!newName.trim() || creating} className="btn-gradient text-xs font-bold py-2 px-4 rounded-md flex items-center justify-center gap-1.5 disabled:opacity-50">
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create Tenant
              </button>
            </div>
          </div>

          {loading ? (
            <div className="premium-card p-8 text-center text-xs text-[var(--color-text-muted)]"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
          ) : (
            <div className="flex flex-col gap-3">
              {companies.map((c) => (
                <div key={c.id} className={`premium-card p-4 ${c.status === 'suspended' ? 'opacity-70' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-[var(--color-surface-offset)] text-[var(--color-primary)] flex items-center justify-center shrink-0"><Building className="w-4 h-4" /></div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-[var(--color-text)] truncate">{c.name}</h4>
                          {c.isDefault && <span className="text-[9px] font-black uppercase text-[var(--color-text-faint)]">default</span>}
                          <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${c.status === 'active' ? 'text-emerald-600 bg-emerald-500/10' : 'text-[var(--color-error)] bg-[var(--color-error)]/10'}`}>{c.status}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)] font-mono mt-0.5">
                          <LinkIcon className="w-3 h-3" /> {accessUrl(c.slug)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => patch(c.id, { status: c.status === 'active' ? 'suspended' : 'active' })} disabled={busyId === c.id}
                        className="p-2 rounded-md border border-[var(--color-border)] hover:bg-[var(--color-surface-offset)] text-[var(--color-text-muted)] transition-colors cursor-pointer disabled:opacity-50"
                        title={c.status === 'active' ? 'Suspend' : 'Activate'}>
                        {c.status === 'active' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 text-emerald-600" />}
                      </button>
                      <button onClick={() => { setEdit(c); setEditName(c.name); setEditPlan(c.activePlan); }}
                        className="p-2 rounded-md border border-[var(--color-border)] hover:bg-[var(--color-surface-offset)] text-[var(--color-text-muted)] transition-colors cursor-pointer" title="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {!c.isDefault && (
                        <button onClick={() => remove(c)} disabled={busyId === c.id}
                          className="p-2 rounded-md border border-[var(--color-border)] hover:bg-[var(--color-error)]/10 text-[var(--color-text-faint)] hover:text-[var(--color-error)] transition-colors cursor-pointer disabled:opacity-50" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[var(--color-divider)]/30 text-[11px] text-[var(--color-text-muted)] font-semibold">
                    <span className="capitalize">{c.activePlan}</span>
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {c.counts.users}</span>
                    <span className="flex items-center gap-1"><FileSpreadsheet className="w-3 h-3" /> {c.counts.quotations}</span>
                    <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> {c.counts.invoices}</span>
                    {c.owner && <span className="ml-auto truncate">Owner: {c.owner.email}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notification composer */}
        <div className="premium-card p-5 h-fit">
          <h3 className="text-sm font-bold text-[var(--color-text)] mb-1 flex items-center gap-2"><Bell className="w-4 h-4 text-[var(--color-primary)]" /> Send Notification</h3>
          <p className="text-[11px] text-[var(--color-text-muted)] mb-4">Push an in-app notification to everyone, one company, or a single user.</p>

          <div className="flex flex-col gap-3">
            <div className="flex bg-[var(--color-surface-offset)] border border-[var(--color-border)] rounded-md p-0.5">
              {(['all', 'company', 'user'] as const).map((t) => (
                <button key={t} onClick={() => { setTarget(t); setTargetId(''); }}
                  className={`flex-1 px-2 py-1.5 rounded text-xs font-bold capitalize transition-colors cursor-pointer ${target === t ? 'bg-[var(--color-surface)] text-[var(--color-primary)] shadow-sm' : 'text-[var(--color-text-muted)]'}`}>
                  {t === 'all' ? 'Everyone' : t}
                </button>
              ))}
            </div>

            {target === 'company' && (
              <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="premium-input text-sm">
                <option value="">— Select company —</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            {target === 'user' && (
              <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="premium-input text-sm">
                <option value="">— Select user —</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
              </select>
            )}

            <input value={notifTitle} onChange={(e) => setNotifTitle(e.target.value)} placeholder="Title" className="premium-input text-sm" />
            <textarea value={notifBody} onChange={(e) => setNotifBody(e.target.value)} rows={3} placeholder="Message (optional)" className="premium-input text-sm resize-none" />

            <button onClick={sendNotification} disabled={!notifTitle.trim() || sending} className="btn-gradient text-xs font-bold py-2 rounded-md flex items-center justify-center gap-1.5 disabled:opacity-50">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send
            </button>
            {sentMsg && <p className="text-[11px] font-bold text-emerald-600 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> {sentMsg}</p>}
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setEdit(null)} />
          <div className="relative w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-lg p-6 animate-scale-in flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
              <h3 className="text-sm font-bold text-[var(--color-text)]">Edit {edit.name}</h3>
              <button onClick={() => setEdit(null)} className="p-1 hover:bg-[var(--color-surface-offset)] rounded cursor-pointer"><X className="w-4 h-4 text-[var(--color-text-muted)]" /></button>
            </div>
            <div className="text-xs font-semibold text-[var(--color-text-muted)]">
              <label className="block mb-1.5">Name</label>
              <input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full premium-input text-sm text-[var(--color-text)]" />
            </div>
            <div className="text-xs font-semibold text-[var(--color-text-muted)]">
              <label className="block mb-1.5">Plan</label>
              <select value={editPlan} onChange={(e) => setEditPlan(e.target.value)} className="w-full premium-input text-sm capitalize">
                {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-[var(--color-divider)]/40 pt-4 text-xs font-semibold">
              <button onClick={() => setEdit(null)} className="px-4 py-2 border border-[var(--color-border)] hover:bg-[var(--color-surface-offset)] rounded-md text-[var(--color-text)] cursor-pointer">Cancel</button>
              <button onClick={saveEdit} disabled={!editName.trim()} className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-md cursor-pointer disabled:opacity-50">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default SuperAdmin;
