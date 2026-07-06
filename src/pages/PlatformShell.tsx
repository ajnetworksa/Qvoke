import React, { useEffect, useMemo, useState } from 'react';
import { useERPStore } from '../store';
import { AdminCompany } from '../types';
import {
  ShieldCheck, LayoutDashboard, Building, Users as UsersIcon, Bell, Send, Plus, Pause, Play,
  Trash2, Pencil, X, LogOut, Sun, Moon, Monitor, ArrowRightLeft, Crown, Loader2, Check,
  Link as LinkIcon, FileSpreadsheet, FileText, DollarSign, Server
} from 'lucide-react';

const PLANS = ['starter', 'professional', 'enterprise'];
type Tab = 'overview' | 'companies' | 'users' | 'notifications';

interface Overview {
  tenants: number; activeTenants: number; suspendedTenants: number; users: number;
  superAdmins: number; quotations: number; invoices: number; customers: number; collectedRevenue: number;
}
interface AdminUser { id: string; name: string; email: string; role: string; isSuperAdmin: boolean; companyCount: number; }

export const PlatformShell: React.FC = () => {
  const { token, currentUser, theme, setTheme, logout, setRoute, switchCompany, company } = useERPStore();
  const authH = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const host = window.location.host;

  const [tab, setTab] = useState<Tab>('overview');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  // create tenant
  const [nName, setNName] = useState(''); const [nOwner, setNOwner] = useState(''); const [nPlan, setNPlan] = useState('enterprise'); const [creating, setCreating] = useState(false);
  // edit tenant
  const [edit, setEdit] = useState<AdminCompany | null>(null); const [eName, setEName] = useState(''); const [ePlan, setEPlan] = useState('enterprise');
  // notifications
  const [target, setTarget] = useState<'all' | 'company' | 'user'>('all'); const [targetId, setTargetId] = useState('');
  const [nTitle, setNTitle] = useState(''); const [nBody, setNBody] = useState(''); const [sending, setSending] = useState(false); const [sentMsg, setSentMsg] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [o, c, u] = await Promise.all([
        fetch('/api/admin/overview', { headers: authH }).then((r) => r.json()),
        fetch('/api/admin/companies', { headers: authH }).then((r) => r.json()),
        fetch('/api/admin/users', { headers: authH }).then((r) => r.json())
      ]);
      setOverview(o); setCompanies(c.companies || []); setUsers(u.users || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const patchCompany = async (id: string, body: any) => { setBusyId(id); await fetch(`/api/admin/companies/${id}`, { method: 'PATCH', headers: authH, body: JSON.stringify(body) }); await load(); setBusyId(null); };
  const createTenant = async () => {
    if (!nName.trim() || creating) return; setCreating(true);
    await fetch('/api/admin/companies', { method: 'POST', headers: authH, body: JSON.stringify({ name: nName.trim(), ownerEmail: nOwner.trim() || undefined, activePlan: nPlan }) });
    setNName(''); setNOwner(''); setNPlan('enterprise'); await load(); setCreating(false);
  };
  const removeTenant = async (c: AdminCompany) => {
    if (!window.confirm(`Delete "${c.name}" and ALL its data? This cannot be undone.`)) return;
    setBusyId(c.id); await fetch(`/api/admin/companies/${c.id}`, { method: 'DELETE', headers: authH }); await load(); setBusyId(null);
  };
  const saveEdit = async () => { if (!edit) return; await patchCompany(edit.id, { name: eName.trim(), activePlan: ePlan }); setEdit(null); };
  const enterCompany = async (c: AdminCompany) => { await switchCompany(c.id); setRoute('dashboard'); };
  const toggleSuper = async (u: AdminUser) => {
    setBusyId(u.id);
    const res = await fetch(`/api/admin/users/${u.id}`, { method: 'PATCH', headers: authH, body: JSON.stringify({ isSuperAdmin: !u.isSuperAdmin }) });
    if (!res.ok) { const d = await res.json(); alert(d.error || 'Failed'); }
    await load(); setBusyId(null);
  };
  const sendNotif = async () => {
    if (!nTitle.trim() || sending) return;
    if (target !== 'all' && !targetId) { setSentMsg('Pick a target first.'); return; }
    setSending(true); setSentMsg('');
    const res = await fetch('/api/admin/notifications', { method: 'POST', headers: authH, body: JSON.stringify({ target, targetId: target === 'all' ? undefined : targetId, title: nTitle.trim(), body: nBody.trim() || undefined }) });
    const d = await res.json(); setSending(false);
    if (res.ok) { setNTitle(''); setNBody(''); setSentMsg(d.recipients === -1 ? 'Sent to everyone.' : `Sent to ${d.recipients} recipient(s).`); setTimeout(() => setSentMsg(''), 4000); }
    else setSentMsg(d.error || 'Failed to send.');
  };

  const accessUrl = (slug?: string | null) => slug ? `${slug}.${host.replace(/^[^.]+\./, '')}` : '—';
  const cycleTheme = () => setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light');

  const navItems: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'companies', label: 'Companies', icon: Building },
    { id: 'users', label: 'Users', icon: UsersIcon },
    { id: 'notifications', label: 'Notifications', icon: Bell }
  ];

  const stats = useMemo(() => overview ? [
    { label: 'Tenants', value: overview.tenants, icon: Building, sub: `${overview.activeTenants} active · ${overview.suspendedTenants} suspended` },
    { label: 'Users', value: overview.users, icon: UsersIcon, sub: `${overview.superAdmins} super-admin` },
    { label: 'Quotations', value: overview.quotations, icon: FileSpreadsheet, sub: `${overview.customers} customers` },
    { label: 'Invoices', value: overview.invoices, icon: FileText, sub: `${overview.collectedRevenue.toLocaleString()} ${company.currency} collected` }
  ] : [], [overview, company.currency]);

  return (
    <div className="min-h-screen flex bg-[var(--color-bg)] text-[var(--color-text)]">
      {/* Platform sidebar (distinct from company workspace) */}
      <aside className="w-60 shrink-0 h-screen sticky top-0 flex flex-col bg-[var(--color-surface)] border-r border-[var(--color-border)]">
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-[var(--color-border)]">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)] text-white flex items-center justify-center shadow-sm"><ShieldCheck className="w-4.5 h-4.5" /></div>
          <div className="leading-none">
            <div className="text-sm font-extrabold tracking-tight">Qvoke</div>
            <div className="text-[9px] font-black uppercase tracking-widest text-[var(--color-primary)]">Platform</div>
          </div>
        </div>
        <nav className="flex-1 p-3 flex flex-col gap-1">
          {navItems.map((n) => {
            const Icon = n.icon; const active = tab === n.id;
            return (
              <button key={n.id} onClick={() => setTab(n.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${active ? 'bg-[var(--color-primary-highlight)]/40 text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-offset)]'}`}>
                <Icon className="w-4 h-4" /> {n.label}
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t border-[var(--color-border)]">
          <button onClick={() => setRoute('dashboard')} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold text-[var(--color-text)] hover:bg-[var(--color-surface-offset)] transition-colors cursor-pointer">
            <ArrowRightLeft className="w-4 h-4 text-[var(--color-primary)]" /> Enter Workspace
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-[var(--color-border)] bg-[var(--color-surface)]/80 backdrop-blur-sm sticky top-0 z-20 flex items-center justify-between px-6">
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--color-text-muted)]">
            <Server className="w-4 h-4 text-[var(--color-primary)]" /> Platform Control Plane
          </div>
          <div className="flex items-center gap-3">
            <button onClick={cycleTheme} className="p-2 hover:bg-[var(--color-surface-offset)] rounded-full text-[var(--color-text-muted)] cursor-pointer" title={`Theme: ${theme}`}>
              {theme === 'light' ? <Moon className="w-4 h-4" /> : theme === 'dark' ? <Sun className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
            </button>
            <div className="flex items-center gap-2 text-xs">
              <span className="hidden sm:flex items-center gap-1 font-bold text-[var(--color-primary)]"><Crown className="w-3.5 h-3.5" /> {currentUser?.name}</span>
              <button onClick={logout} className="p-2 hover:bg-[var(--color-surface-offset)] rounded-full text-red-500 cursor-pointer" title="Sign out"><LogOut className="w-4 h-4" /></button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-24 text-[var(--color-text-muted)]"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : (
            <>
              {/* OVERVIEW */}
              {tab === 'overview' && (
                <div className="animate-fade-in">
                  <h1 className="text-xl font-bold mb-1">Platform Overview</h1>
                  <p className="text-xs text-[var(--color-text-muted)] mb-6">Aggregate across all tenant companies.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {stats.map((s) => { const Icon = s.icon; return (
                      <div key={s.label} className="premium-card interactive p-5">
                        <div className="flex items-center justify-between mb-3"><span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">{s.label}</span><Icon className="w-5 h-5 text-[var(--color-primary)]" /></div>
                        <div className="text-2xl font-bold font-mono">{s.value.toLocaleString()}</div>
                        <div className="text-[10px] text-[var(--color-text-muted)] mt-1">{s.sub}</div>
                      </div>
                    ); })}
                  </div>
                </div>
              )}

              {/* COMPANIES */}
              {tab === 'companies' && (
                <div className="animate-fade-in">
                  <h1 className="text-xl font-bold mb-4">Tenant Companies</h1>
                  <div className="premium-card p-4 mb-5">
                    <h3 className="text-sm font-bold mb-3 flex items-center gap-2"><Plus className="w-4 h-4 text-[var(--color-primary)]" /> Create Tenant</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <input value={nName} onChange={(e) => setNName(e.target.value)} placeholder="Company name" className="premium-input text-sm" />
                      <input value={nOwner} onChange={(e) => setNOwner(e.target.value)} placeholder="Owner email (optional)" className="premium-input text-sm" />
                      <select value={nPlan} onChange={(e) => setNPlan(e.target.value)} className="premium-input text-sm capitalize">{PLANS.map((p) => <option key={p} value={p}>{p}</option>)}</select>
                      <button onClick={createTenant} disabled={!nName.trim() || creating} className="btn-gradient text-xs font-bold py-2 rounded-md flex items-center justify-center gap-1.5 disabled:opacity-50">{creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create</button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    {companies.map((c) => (
                      <div key={c.id} className={`premium-card p-4 ${c.status === 'suspended' ? 'opacity-70' : ''}`}>
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-lg bg-[var(--color-surface-offset)] text-[var(--color-primary)] flex items-center justify-center shrink-0"><Building className="w-4 h-4" /></div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-bold truncate">{c.name}</h4>
                                {c.isDefault && <span className="text-[9px] font-black uppercase text-[var(--color-text-faint)]">default</span>}
                                <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${c.status === 'active' ? 'text-emerald-600 bg-emerald-500/10' : 'text-[var(--color-error)] bg-[var(--color-error)]/10'}`}>{c.status}</span>
                              </div>
                              <div className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)] font-mono mt-0.5"><LinkIcon className="w-3 h-3" /> {accessUrl(c.slug)}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => enterCompany(c)} className="px-2.5 py-1.5 rounded-md bg-[var(--color-primary)] text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer hover:bg-[var(--color-primary-hover)]" title="Enter this company's workspace"><ArrowRightLeft className="w-3.5 h-3.5" /> Enter</button>
                            <button onClick={() => patchCompany(c.id, { status: c.status === 'active' ? 'suspended' : 'active' })} disabled={busyId === c.id} className="p-2 rounded-md border border-[var(--color-border)] hover:bg-[var(--color-surface-offset)] text-[var(--color-text-muted)] cursor-pointer disabled:opacity-50" title={c.status === 'active' ? 'Suspend' : 'Activate'}>{c.status === 'active' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 text-emerald-600" />}</button>
                            <button onClick={() => { setEdit(c); setEName(c.name); setEPlan(c.activePlan); }} className="p-2 rounded-md border border-[var(--color-border)] hover:bg-[var(--color-surface-offset)] text-[var(--color-text-muted)] cursor-pointer" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                            {!c.isDefault && <button onClick={() => removeTenant(c)} disabled={busyId === c.id} className="p-2 rounded-md border border-[var(--color-border)] hover:bg-[var(--color-error)]/10 text-[var(--color-text-faint)] hover:text-[var(--color-error)] cursor-pointer disabled:opacity-50" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[var(--color-divider)]/30 text-[11px] text-[var(--color-text-muted)] font-semibold">
                          <span className="capitalize">{c.activePlan}</span>
                          <span className="flex items-center gap-1"><UsersIcon className="w-3 h-3" /> {c.counts.users}</span>
                          <span className="flex items-center gap-1"><FileSpreadsheet className="w-3 h-3" /> {c.counts.quotations}</span>
                          <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> {c.counts.invoices}</span>
                          {c.owner && <span className="ml-auto truncate">Owner: {c.owner.email}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* USERS */}
              {tab === 'users' && (
                <div className="animate-fade-in">
                  <h1 className="text-xl font-bold mb-4">Users</h1>
                  <div className="premium-card overflow-hidden">
                    <table className="w-full text-sm text-left">
                      <thead><tr className="bg-[var(--color-surface-offset)] border-b border-[var(--color-border)] text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                        <th className="py-3 px-4">Name</th><th className="py-3 px-4">Email</th><th className="py-3 px-4">Role</th><th className="py-3 px-4 text-center">Companies</th><th className="py-3 px-4 text-center">Super-admin</th>
                      </tr></thead>
                      <tbody className="divide-y divide-[var(--color-divider)]">
                        {users.map((u) => (
                          <tr key={u.id} className="hover:bg-[var(--color-surface-offset)]/50">
                            <td className="py-3 px-4 font-bold">{u.name}</td>
                            <td className="py-3 px-4 text-[var(--color-text-muted)]">{u.email}</td>
                            <td className="py-3 px-4 capitalize text-[var(--color-text-muted)]">{u.role?.replace('_', ' ')}</td>
                            <td className="py-3 px-4 text-center font-mono">{u.companyCount}</td>
                            <td className="py-3 px-4 text-center">
                              <button onClick={() => toggleSuper(u)} disabled={busyId === u.id}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase cursor-pointer transition-colors ${u.isSuperAdmin ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary)]' : 'bg-[var(--color-surface-offset)] text-[var(--color-text-muted)] hover:bg-[var(--color-divider)]'}`}>
                                {busyId === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : u.isSuperAdmin ? <Crown className="w-3 h-3" /> : null}
                                {u.isSuperAdmin ? 'Super-admin' : 'Grant'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* NOTIFICATIONS */}
              {tab === 'notifications' && (
                <div className="animate-fade-in max-w-lg">
                  <h1 className="text-xl font-bold mb-1">Send Notification</h1>
                  <p className="text-xs text-[var(--color-text-muted)] mb-5">Push an in-app notification to everyone, one company, or a single user.</p>
                  <div className="premium-card p-5 flex flex-col gap-3">
                    <div className="flex bg-[var(--color-surface-offset)] border border-[var(--color-border)] rounded-md p-0.5">
                      {(['all', 'company', 'user'] as const).map((t) => (
                        <button key={t} onClick={() => { setTarget(t); setTargetId(''); }} className={`flex-1 px-2 py-1.5 rounded text-xs font-bold capitalize cursor-pointer ${target === t ? 'bg-[var(--color-surface)] text-[var(--color-primary)] shadow-sm' : 'text-[var(--color-text-muted)]'}`}>{t === 'all' ? 'Everyone' : t}</button>
                      ))}
                    </div>
                    {target === 'company' && <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="premium-input text-sm"><option value="">— Select company —</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
                    {target === 'user' && <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="premium-input text-sm"><option value="">— Select user —</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}</select>}
                    <input value={nTitle} onChange={(e) => setNTitle(e.target.value)} placeholder="Title" className="premium-input text-sm" />
                    <textarea value={nBody} onChange={(e) => setNBody(e.target.value)} rows={3} placeholder="Message (optional)" className="premium-input text-sm resize-none" />
                    <button onClick={sendNotif} disabled={!nTitle.trim() || sending} className="btn-gradient text-xs font-bold py-2 rounded-md flex items-center justify-center gap-1.5 disabled:opacity-50">{sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send</button>
                    {sentMsg && <p className="text-[11px] font-bold text-emerald-600 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> {sentMsg}</p>}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Edit modal */}
      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setEdit(null)} />
          <div className="relative w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-lg p-6 animate-scale-in flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
              <h3 className="text-sm font-bold">Edit {edit.name}</h3>
              <button onClick={() => setEdit(null)} className="p-1 hover:bg-[var(--color-surface-offset)] rounded cursor-pointer"><X className="w-4 h-4 text-[var(--color-text-muted)]" /></button>
            </div>
            <div className="text-xs font-semibold text-[var(--color-text-muted)]"><label className="block mb-1.5">Name</label><input value={eName} onChange={(e) => setEName(e.target.value)} className="w-full premium-input text-sm text-[var(--color-text)]" /></div>
            <div className="text-xs font-semibold text-[var(--color-text-muted)]"><label className="block mb-1.5">Plan</label><select value={ePlan} onChange={(e) => setEPlan(e.target.value)} className="w-full premium-input text-sm capitalize">{PLANS.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
            <div className="flex items-center justify-end gap-3 border-t border-[var(--color-divider)]/40 pt-4 text-xs font-semibold">
              <button onClick={() => setEdit(null)} className="px-4 py-2 border border-[var(--color-border)] hover:bg-[var(--color-surface-offset)] rounded-md cursor-pointer">Cancel</button>
              <button onClick={saveEdit} disabled={!eName.trim()} className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-md cursor-pointer disabled:opacity-50">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default PlatformShell;
