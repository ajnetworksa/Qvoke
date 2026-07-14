import React, { useEffect, useMemo, useState } from 'react';
import { useERPStore } from '../store';
import { AdminCompany } from '../types';
import {
  ShieldCheck, LayoutDashboard, Building, Users as UsersIcon, Bell, Send, Plus, Pause, Play,
  Trash2, Pencil, X, LogOut, Sun, Moon, Monitor, ArrowRightLeft, Crown, Loader2, Check,
  Link as LinkIcon, FileSpreadsheet, FileText, DollarSign, Server
} from 'lucide-react';

const PLANS = ['starter', 'professional', 'enterprise'];
const ONBOARDING_FEATURES = [
  { key: 'boq', label: 'BOQ' },
  { key: 'bom', label: 'BOM' },
  { key: 'reports', label: 'Financial reports' },
  { key: 'suppliers', label: 'Supplier management' },
  { key: 'tracking', label: 'Tracking and audit' },
  { key: 'usage', label: 'Usage analytics' },
  { key: 'kanban', label: 'Kanban pipeline' },
  { key: 'tasks', label: 'Personal tasks' },
] as const;
const PLAN_FEATURES: Record<string, string[]> = {
  starter: ['tasks'],
  professional: ['boq', 'bom', 'reports', 'suppliers', 'tracking', 'usage', 'tasks'],
  enterprise: ONBOARDING_FEATURES.map((feature) => feature.key),
};
interface TenantDraft {
  name: string; slug: string; ownerEmail: string; activePlan: string;
  vatNumber: string; phone: string; city: string; country: string;
  currency: string; locale: string; timezone: string; features: Record<string, boolean>;
}
const tenantDraft = (): TenantDraft => ({
  name: '', slug: '', ownerEmail: '', activePlan: 'professional', vatNumber: '', phone: '', city: '', country: 'SA',
  currency: 'SAR', locale: 'en-SA', timezone: 'Asia/Riyadh',
  features: Object.fromEntries(ONBOARDING_FEATURES.map((feature) => [feature.key, PLAN_FEATURES.professional.includes(feature.key)])),
});
const toSlug = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
type Tab = 'overview' | 'companies' | 'users' | 'notifications';

interface Overview {
  tenants: number; activeTenants: number; suspendedTenants: number; users: number;
  superAdmins: number; quotations: number; invoices: number; customers: number; collectedRevenue: number;
}
interface AdminUser { id: string; name: string; email: string; role: string; isSuperAdmin: boolean; companyCount: number; }

interface PlatformShellProps {
  onExit: () => void;
}

export const PlatformShell: React.FC<PlatformShellProps> = ({ onExit }) => {
  const { token, currentUser, theme, setTheme, logout, switchCompany, company } = useERPStore();
  const authH = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const hostname = window.location.hostname.toLowerCase();
  const isLocalHost = hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname);
  const hostParts = hostname.split('.');
  const rootHost = hostParts.length >= 3 ? hostParts.slice(1).join('.') : hostname;

  const [tab, setTab] = useState<Tab>('overview');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  // create tenant
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [draft, setDraft] = useState<TenantDraft>(tenantDraft);
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);
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
  const updateDraft = <K extends keyof TenantDraft>(key: K, value: TenantDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const closeOnboarding = () => {
    setOnboardingOpen(false);
    setOnboardingStep(0);
    setCreateError('');
    setDraft(tenantDraft());
  };
  const selectPlan = (plan: string) => {
    updateDraft('activePlan', plan);
    updateDraft('features', Object.fromEntries(ONBOARDING_FEATURES.map((feature) => [feature.key, PLAN_FEATURES[plan].includes(feature.key)])));
  };
  const createTenant = async () => {
    if (!draft.name.trim() || creating) return;
    setCreating(true);
    setCreateError('');
    const res = await fetch('/api/admin/companies', { method: 'POST', headers: authH, body: JSON.stringify(draft) });
    const data = await res.json();
    if (!res.ok) {
      setCreateError(data.error || 'Company creation failed.');
      setCreating(false);
      return;
    }
    await load();
    setCreating(false);
    closeOnboarding();
  };
  const removeTenant = async (c: AdminCompany) => {
    if (!window.confirm(`Delete "${c.name}" and ALL its data? This cannot be undone.`)) return;
    setBusyId(c.id); await fetch(`/api/admin/companies/${c.id}`, { method: 'DELETE', headers: authH }); await load(); setBusyId(null);
  };
  const saveEdit = async () => { if (!edit) return; await patchCompany(edit.id, { name: eName.trim(), activePlan: ePlan }); setEdit(null); };
  const enterCompany = async (c: AdminCompany) => {
    await switchCompany(c.id);
    if (!isLocalHost && c.slug) {
      const port = window.location.port ? `:${window.location.port}` : '';
      window.location.assign(`${window.location.protocol}//${c.slug}.${rootHost}${port}`);
      return;
    }
    onExit();
  };
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

  const accessUrl = (slug?: string | null) => {
    if (!slug) return '—';
    if (isLocalHost) return `Local workspace: ${slug}`;
    return `${slug}.${rootHost}${window.location.port ? `:${window.location.port}` : ''}`;
  };
  const cycleTheme = () => setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light');

  const navItems: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'companies', label: 'Companies', icon: Building },
    { id: 'users', label: 'Users', icon: UsersIcon },
    { id: 'notifications', label: 'Notifications', icon: Bell }
  ];

  const stats = useMemo(() => overview ? [
    { label: 'Tenants', value: overview.tenants, icon: Building, sub: `${overview.activeTenants} active · ${overview.suspendedTenants} suspended`, tone: 'teal' },
    { label: 'Users', value: overview.users, icon: UsersIcon, sub: `${overview.superAdmins} super-admin`, tone: 'blue' },
    { label: 'Quotations', value: overview.quotations, icon: FileSpreadsheet, sub: `${overview.customers} customers`, tone: 'amber' },
    { label: 'Invoices', value: overview.invoices, icon: FileText, sub: `${overview.collectedRevenue.toLocaleString()} ${company.currency} collected`, tone: 'rose' }
  ] : [], [overview, company.currency]);

  return (
    <div className="platform-shell min-h-screen flex bg-[var(--color-bg)] text-[var(--color-text)]">
      {/* Platform sidebar (distinct from company workspace) */}
      <aside className="platform-sidebar w-60 shrink-0 h-screen sticky top-0 flex flex-col bg-[var(--color-surface)] border-r border-[var(--color-border)]">
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
          <button onClick={onExit} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold text-[var(--color-text)] hover:bg-[var(--color-surface-offset)] transition-colors cursor-pointer">
            <ArrowRightLeft className="w-4 h-4 text-[var(--color-primary)]" /> Enter Workspace
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="platform-header h-16 border-b border-[var(--color-border)] bg-[var(--color-surface)]/80 backdrop-blur-sm sticky top-0 z-20 flex items-center justify-between px-6">
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

        <main className="platform-main flex-1 p-6 md:p-8 overflow-y-auto">
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
                      <div key={s.label} className={`platform-stat platform-stat--${s.tone} premium-card interactive p-5`}>
                        <div className="flex items-center justify-between mb-3"><span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">{s.label}</span><Icon className="w-5 h-5 text-[var(--color-primary)]" /></div>
                        <div className="text-2xl font-bold font-mono">{s.value.toLocaleString()}</div>
                        <div className="text-[10px] text-[var(--color-text-muted)] mt-1">{s.sub}</div>
                      </div>
                    ); })}
                  </div>

                  <div className="platform-overview-panels">
                    <section className="platform-operations-panel">
                      <div className="platform-panel-heading">
                        <div>
                          <h2>Platform health</h2>
                          <span>Live tenant availability</span>
                        </div>
                        <span className="platform-health-badge"><Check className="w-3.5 h-3.5" /> Operational</span>
                      </div>
                      <div className="platform-health-list">
                        <div><span>API and database</span><strong>Online</strong></div>
                        <div><span>Active tenants</span><strong>{overview?.activeTenants || 0} / {overview?.tenants || 0}</strong></div>
                        <div><span>Suspended tenants</span><strong>{overview?.suspendedTenants || 0}</strong></div>
                      </div>
                      <div className="platform-health-track">
                        <span style={{ width: `${overview?.tenants ? (overview.activeTenants / overview.tenants) * 100 : 0}%` }} />
                      </div>
                    </section>

                    <section className="platform-operations-panel">
                      <div className="platform-panel-heading">
                        <div>
                          <h2>Quick operations</h2>
                          <span>Platform control plane</span>
                        </div>
                      </div>
                      <div className="platform-quick-actions">
                        <button onClick={() => setTab('companies')}><Building className="w-4 h-4" /><span><strong>Manage companies</strong><small>Create, edit, or suspend</small></span></button>
                        <button onClick={() => setTab('users')}><UsersIcon className="w-4 h-4" /><span><strong>Manage users</strong><small>Roles and super-admin access</small></span></button>
                        <button onClick={() => setTab('notifications')}><Bell className="w-4 h-4" /><span><strong>Send notification</strong><small>Target tenants or users</small></span></button>
                      </div>
                    </section>
                  </div>

                  <section className="platform-recent-tenants">
                    <div className="platform-panel-heading">
                      <div><h2>Tenant directory</h2><span>Recently created companies</span></div>
                      <button onClick={() => setTab('companies')}>View all</button>
                    </div>
                    <div className="platform-tenant-strip">
                      {companies.slice(0, 4).map((tenant) => (
                        <button key={tenant.id} onClick={() => enterCompany(tenant)}>
                          <span className="platform-tenant-mark">{tenant.name.charAt(0).toUpperCase()}</span>
                          <span><strong>{tenant.name}</strong><small>{tenant.activePlan} · {tenant.status}</small></span>
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                        </button>
                      ))}
                    </div>
                  </section>
                </div>
              )}

              {/* COMPANIES */}
              {tab === 'companies' && (
                <div className="animate-fade-in">
                  <div className="flex items-center justify-between gap-4 mb-5">
                    <div><h1 className="text-xl font-bold">Tenant Companies</h1><p className="text-xs text-[var(--color-text-muted)] mt-1">Provisioning, lifecycle, ownership, and access.</p></div>
                    <button onClick={() => setOnboardingOpen(true)} className="btn-gradient text-xs font-bold py-2.5 px-4 rounded-md flex items-center gap-1.5"><Plus className="w-4 h-4" /> New company</button>
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
                                {!c.setupComplete && <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded text-amber-600 bg-amber-500/10">setup needed</span>}
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

      {onboardingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={() => !creating && closeOnboarding()} />
          <section className="tenant-onboarding relative w-full max-w-2xl bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-xl overflow-hidden">
            <header className="tenant-onboarding__header">
              <div>
                <span>Company onboarding</span>
                <h2>{['Identity and access', 'Regional profile', 'Plan and modules', 'Review and create'][onboardingStep]}</h2>
              </div>
              <button onClick={closeOnboarding} disabled={creating} title="Close"><X className="w-4 h-4" /></button>
            </header>

            <div className="tenant-onboarding__progress" aria-label={`Step ${onboardingStep + 1} of 4`}>
              {[0, 1, 2, 3].map((step) => <span key={step} className={step <= onboardingStep ? 'is-active' : ''} />)}
            </div>

            <div className="tenant-onboarding__body">
              {onboardingStep === 0 && (
                <div className="tenant-form-grid">
                  <label className="tenant-field tenant-field--wide"><span>Company name</span><input autoFocus value={draft.name} onChange={(event) => { const name = event.target.value; setDraft((current) => ({ ...current, name, slug: current.slug && current.slug !== toSlug(current.name) ? current.slug : toSlug(name) })); }} placeholder="Acme Trading Company" /></label>
                  <label className="tenant-field"><span>Workspace slug</span><div className="tenant-slug-input"><input value={draft.slug} onChange={(event) => updateDraft('slug', toSlug(event.target.value))} placeholder="acme-trading" /><small>.your-domain.com</small></div></label>
                  <label className="tenant-field"><span>Owner</span><select value={draft.ownerEmail} onChange={(event) => updateDraft('ownerEmail', event.target.value)}><option value="">Assign later</option>{users.map((user) => <option key={user.id} value={user.email}>{user.name} ({user.email})</option>)}</select></label>
                </div>
              )}

              {onboardingStep === 1 && (
                <div className="tenant-form-grid">
                  <label className="tenant-field"><span>VAT number</span><input value={draft.vatNumber} onChange={(event) => updateDraft('vatNumber', event.target.value.replace(/\D/g, '').slice(0, 15))} inputMode="numeric" placeholder="15-digit VAT number" /><small>{draft.vatNumber.length}/15 digits</small></label>
                  <label className="tenant-field"><span>Phone</span><input value={draft.phone} onChange={(event) => updateDraft('phone', event.target.value)} placeholder="+966 5x xxx xxxx" /></label>
                  <label className="tenant-field"><span>City</span><input value={draft.city} onChange={(event) => updateDraft('city', event.target.value)} placeholder="Riyadh" /></label>
                  <label className="tenant-field"><span>Country</span><select value={draft.country} onChange={(event) => updateDraft('country', event.target.value)}><option value="SA">Saudi Arabia</option><option value="AE">United Arab Emirates</option><option value="BH">Bahrain</option><option value="KW">Kuwait</option><option value="OM">Oman</option><option value="QA">Qatar</option></select></label>
                  <label className="tenant-field"><span>Currency</span><select value={draft.currency} onChange={(event) => updateDraft('currency', event.target.value)}><option>SAR</option><option>AED</option><option>USD</option><option>EUR</option><option>GBP</option></select></label>
                  <label className="tenant-field"><span>Language</span><select value={draft.locale} onChange={(event) => updateDraft('locale', event.target.value)}><option value="en-SA">English (Saudi Arabia)</option><option value="ar-SA">Arabic (Saudi Arabia)</option><option value="en">English</option><option value="ar">Arabic</option></select></label>
                </div>
              )}

              {onboardingStep === 2 && (
                <div>
                  <div className="tenant-plan-grid">
                    {PLANS.map((plan) => <button key={plan} className={draft.activePlan === plan ? 'is-selected' : ''} onClick={() => selectPlan(plan)}><strong>{plan}</strong><small>{plan === 'starter' ? 'Core sales' : plan === 'professional' ? 'Operations suite' : 'All modules'}</small>{draft.activePlan === plan && <Check className="w-4 h-4" />}</button>)}
                  </div>
                  <div className="tenant-module-grid">
                    {ONBOARDING_FEATURES.map((feature) => (
                      <label key={feature.key}><input type="checkbox" checked={draft.features[feature.key]} onChange={(event) => updateDraft('features', { ...draft.features, [feature.key]: event.target.checked })} /><span>{feature.label}</span></label>
                    ))}
                  </div>
                </div>
              )}

              {onboardingStep === 3 && (
                <div className="tenant-review">
                  <div className="tenant-review__identity"><span>{draft.name.charAt(0).toUpperCase()}</span><div><h3>{draft.name}</h3><p>{draft.slug}.your-domain.com</p></div></div>
                  <dl>
                    <div><dt>Owner</dt><dd>{draft.ownerEmail || 'Assign later'}</dd></div>
                    <div><dt>Plan</dt><dd className="capitalize">{draft.activePlan}</dd></div>
                    <div><dt>Region</dt><dd>{draft.city || 'Not specified'}, {draft.country}</dd></div>
                    <div><dt>Locale</dt><dd>{draft.locale} · {draft.currency}</dd></div>
                    <div><dt>Modules</dt><dd>{Object.values(draft.features).filter(Boolean).length + 4} enabled</dd></div>
                    <div><dt>Status</dt><dd>Active</dd></div>
                  </dl>
                  {createError && <p className="tenant-onboarding__error">{createError}</p>}
                </div>
              )}
            </div>

            <footer className="tenant-onboarding__footer">
              <button onClick={onboardingStep === 0 ? closeOnboarding : () => setOnboardingStep((step) => step - 1)} disabled={creating}>{onboardingStep === 0 ? 'Cancel' : 'Back'}</button>
              {onboardingStep < 3 ? (
                <button className="is-primary" onClick={() => setOnboardingStep((step) => step + 1)} disabled={(onboardingStep === 0 && (!draft.name.trim() || !draft.slug)) || (onboardingStep === 1 && Boolean(draft.vatNumber) && draft.vatNumber.length !== 15)}>Continue</button>
              ) : (
                <button className="is-primary" onClick={createTenant} disabled={creating}>{creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building className="w-4 h-4" />} Create company</button>
              )}
            </footer>
          </section>
        </div>
      )}

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
