import React, { useState, useEffect } from 'react';
import { useERPStore } from '../store';
import { 
  Plus, Trash2, Edit2, Save, X, Shield, User, Bot, FileSearch, 
  Settings as SettingsIcon, Database, Users, Eye, UserCheck, 
  Layers, ChevronDown, FileText, Bookmark, Send, Printer, History, KeyRound 
} from 'lucide-react';

interface Permissions {
  canUseRFQ?: boolean;
  canUseAI?: boolean;
  canManageUsers?: boolean;
  canManageSettings?: boolean;
  canDeleteData?: boolean;
  canDatabaseMaintenance?: boolean;
  canOverridePrice?: boolean;
  canViewRevenue?: boolean;
  canViewAllQuotes?: boolean;
  canViewCreatedBy?: boolean;
  canViewHistory?: boolean;
  canChangePassword?: boolean;
  canConvertInvoice?: boolean;
  canSaveTemplate?: boolean;
  canEmailQuote?: boolean;
  canPrintQuote?: boolean;
  canViewFeatureAccess?: boolean;
  canUsePriceSync?: boolean;
  canUndoQuote?: boolean;
  canChangeAuthor?: boolean;
  canShareQuote?: boolean;
  canEditSharedQuote?: boolean;
  canUseKanban?: boolean;
  canUseWatermark?: boolean;
  canUsePricingControls?: boolean;
  canUseMarkup?: boolean;
}

interface AppUser {
  id: string;
  username: string;
  name: string;
  email: string;
  role: string;
  permissions: Permissions;
  avatar?: string;
}

interface PermissionGroup {
  id: number;
  name: string;
  description: string;
  permissions: Permissions;
  members: string[]; // array of user IDs
}

const ALL_PERMISSIONS: { key: keyof Permissions; label: string; icon: React.ReactNode; description: string }[] = [
  { key: 'canManageUsers', label: 'Manage Users', icon: <Shield size={14} />, description: 'Create, edit, and delete system users and their permissions.' },
  { key: 'canManageSettings', label: 'Manage Settings', icon: <SettingsIcon size={14} />, description: 'Access global system settings, backup, and branding.' },
  { key: 'canDeleteData', label: 'Delete Records', icon: <Trash2 size={14} />, description: 'Permanently remove quotation and customer records.' },
  { key: 'canDatabaseMaintenance', label: 'DB Maintenance', icon: <Database size={14} />, description: 'Perform database cleanup and administrative tasks.' },
  { key: 'canOverridePrice', label: 'Price Analysis', icon: <Bot size={14} />, description: 'View cost base and apply manual price overrides in the analysis sidebar.' },
  { key: 'canViewRevenue', label: 'View Revenue', icon: <Users size={14} />, description: 'View total revenue and profit summaries on the dashboard.' },
  { key: 'canUseKanban', label: 'Use Kanban Board', icon: <Layers size={14} />, description: 'Access the interactive Kanban board for quotation stages.' },
  { key: 'canUseRFQ', label: 'Import from RFQ', icon: <FileSearch size={14} />, description: 'Upload PDF/Images to automatically parse items using AI.' },
  { key: 'canUseAI', label: 'AI Data Assistant', icon: <Bot size={14} />, description: 'Access the AI Data Assistant for natural language querying.' },
  { key: 'canViewAllQuotes', label: 'View All Quotes', icon: <Eye size={14} />, description: 'View and edit quotations created by other team members.' },
  { key: 'canViewCreatedBy', label: 'View Creator Info', icon: <UserCheck size={14} />, description: 'See who created a specific quote in the tracking table.' },
  { key: 'canViewHistory', label: 'View Quote History', icon: <History size={14} />, description: 'Access the revision history and audit logs for quotations.' },
  { key: 'canChangePassword', label: 'Change Password', icon: <KeyRound size={14} />, description: 'Change own login password from the profile menu.' },
  { key: 'canConvertInvoice', label: 'Convert to Invoice', icon: <FileText size={14} />, description: 'Convert an existing Quotation into a Tax Invoice.' },
  { key: 'canSaveTemplate', label: 'Save Template', icon: <Bookmark size={14} />, description: 'Save document terms and conditions as reusable templates.' },
  { key: 'canEmailQuote', label: 'Email Quote', icon: <Send size={14} />, description: 'Send documents directly to customers via email.' },
  { key: 'canPrintQuote', label: 'Print Quote', icon: <Printer size={14} />, description: 'Generate and print PDF versions of documents.' },
  { key: 'canViewFeatureAccess', label: 'Show Feature Access', icon: <Eye size={14} />, description: 'Allow the user to see their own granted feature access list in the profile menu.' },
  { key: 'canUsePriceSync', label: 'AI Price Sync', icon: <Bot size={14} />, description: 'Bulk update product prices using AI to extract data from supplier lists (PDF/Excel).' },
  { key: 'canUndoQuote', label: 'Undo Timeline Actions', icon: <History size={14} />, description: 'Allow restoring quotes to previous states via the timeline.' },
  { key: 'canChangeAuthor', label: 'Change Prepared By', icon: <UserCheck size={14} />, description: 'Allow modifying the "Prepared By" name on quotes.' },
  { key: 'canShareQuote', label: 'Share Quotes', icon: <Users size={14} />, description: 'Allow sharing specific quotes with selected users or groups.' },
  { key: 'canEditSharedQuote', label: 'Edit Shared Quotes', icon: <Eye size={14} />, description: 'Allow editing and saving quotes that were shared with this user (not just viewing).' },
  { key: 'canUseWatermark', label: 'Document Watermark', icon: <FileText size={14} />, description: 'Access watermark controls to add status text overlay on document PDFs.' },
  { key: 'canUsePricingControls', label: 'Pricing Controls', icon: <Bot size={14} />, description: 'Access pricing controls like hiding price columns and manual total overrides.' },
  { key: 'canUseMarkup', label: 'Pricing Markup', icon: <Bookmark size={14} />, description: 'Access and update the quotation default markup percentage and markup sidebar calculations.' },
];

const getAuthHeaders = () => {
  const token = useERPStore.getState().token;
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

// ── Permission Toggles ────────────────────────────────────────────────────────
function PermissionToggles({ perms, role, onChange }: { perms: Permissions; role: string; onChange: (key: keyof Permissions) => void }) {
  if (role === 'admin') {
    return (
      <div className="p-4 bg-[var(--color-primary-highlight)]/10 border border-[var(--color-primary)]/20 rounded-lg flex items-center gap-2">
        <Shield className="text-[var(--color-primary)] w-4 h-4 shrink-0 animate-pulse" />
        <span className="text-xs text-[var(--color-text)] font-extrabold">
          Administrators are granted complete system access by default. No additional configurations required.
        </span>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 mt-2">
      <p className="text-xs font-black text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Configure Granular Feature Access:</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto p-1 bg-[var(--color-surface-offset)] rounded-lg">
        {ALL_PERMISSIONS.map(p => {
          const checked = !!perms?.[p.key];
          return (
            <label
              key={p.key}
              className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer select-none transition-all ${
                checked 
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary-highlight)]/20' 
                  : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-offset)]'
              }`}
            >
              <input type="checkbox" checked={checked} onChange={() => onChange(p.key)} className="mt-0.5 accent-[var(--color-primary)]" />
              <div className="min-w-0 text-left">
                <div className="flex items-center gap-1.5 text-xs font-black text-[var(--color-text)]">
                  <span className="text-[var(--color-primary)]">{p.icon}</span>
                  <span>{p.label}</span>
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5 leading-tight">{p.description}</p>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}

// ── Permission Badges (display only) ─────────────────────────────────────────
function PermissionBadges({ perms, role }: { perms: Permissions; role: string }) {
  if (role === 'admin') {
    return <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-black bg-teal-500/10 border border-teal-500/20 text-teal-400 uppercase tracking-widest">Full Access</span>;
  }
  const granted = ALL_PERMISSIONS.filter(p => perms?.[p.key]);
  if (granted.length === 0) return <span className="text-xs text-[var(--color-text-faint)] italic">No features allocated</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {granted.map(p => (
        <span
          key={p.key}
          title={p.description}
          className="flex items-center gap-1 px-2 py-0.5 bg-[var(--color-surface-offset)] border border-[var(--color-border)] text-[var(--color-text-muted)] text-[9px] font-black rounded-full"
        >
          {p.label}
        </span>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── Users Tab ────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
function UsersTab({ groups }: { groups: PermissionGroup[] }) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<AppUser & { password?: string }>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users', { headers: getAuthHeaders() });
      if (res.ok) setUsers(await res.json());
    } catch (e) {}
  };

  const applyGroup = (groupId: string, currentPerms: Permissions): Permissions => {
    const g = groups.find(g => String(g.id) === groupId);
    if (!g) return currentPerms;
    return { ...currentPerms, ...g.permissions };
  };

  const handleAdd = async () => {
    if (!editForm.name || !editForm.email || !editForm.role) return;
    setError('');
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ...editForm, permissions: editForm.permissions || {} }),
      });
      if (res.ok) { setIsAdding(false); setEditForm({}); setSelectedGroupId(''); fetchUsers(); }
      else { const d = await res.json(); setError(d.error || 'Failed to add user'); }
    } catch (err) {
      setError('Connection failure.');
    }
  };

  const handleUpdate = async (id: string) => {
    setError('');
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ...editForm, permissions: editForm.permissions || {} }),
      });
      if (res.ok) { setIsEditing(null); setEditForm({}); setSelectedGroupId(''); fetchUsers(); }
      else { const d = await res.json(); setError(d.error || 'Failed to update user'); }
    } catch (err) {
      setError('Connection failure.');
    }
  };

  const handleDelete = async (id: string) => {
    if (id === 'u-1') {
      alert('Cannot delete primary administrator account.');
      return;
    }
    if (!confirm('Are you sure you want to permanently revoke system access for this employee?')) return;
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (res.ok) fetchUsers();
      else { const d = await res.json(); setError(d.error || 'Failed to delete user'); }
    } catch (err) {}
  };

  const startEdit = (user: AppUser) => {
    setIsEditing(user.id);
    setSelectedGroupId('');
    setEditForm({ username: user.username, name: user.name, email: user.email, role: user.role, permissions: { ...user.permissions } });
  };

  const togglePerm = (key: keyof Permissions) => {
    setEditForm(prev => ({ ...prev, permissions: { ...prev.permissions, [key]: !(prev.permissions as Permissions)?.[key] } }));
  };

  const FormPanel = ({ title, onSave, onCancel, bg }: { title: string; onSave: () => void; onCancel: () => void; bg: string }) => (
    <div className={`p-5 rounded-xl border border-[var(--color-border)] mb-4 flex flex-col gap-4 ${bg}`}>
      <span className="text-xs font-black uppercase tracking-wider block">{title}</span>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs font-semibold text-[var(--color-text-muted)] text-left">
        <div>
          <label className="block mb-1">Employee Full Name *</label>
          <input type="text" className="w-full premium-input font-bold text-[var(--color-text)]" placeholder="E.g., John Doe" value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value, username: e.target.value.toLowerCase().replace(/ /g, '.') })} />
        </div>
        <div>
          <label className="block mb-1">Corporate Email Address *</label>
          <input type="email" className="w-full premium-input" placeholder="john@company.sa" value={editForm.email || ''} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
        </div>
        <div>
          <label className="block mb-1">Security Secret (Password)</label>
          <input type="password" className="w-full premium-input font-mono" placeholder={isEditing ? 'Leave blank to keep current' : 'Security password'} value={editForm.password || ''} onChange={e => setEditForm({ ...editForm, password: e.target.value })} />
        </div>
        <div>
          <label className="block mb-1">Assigned Base Role *</label>
          <select className="w-full premium-input font-bold" value={editForm.role || 'salesperson'} onChange={e => setEditForm({ ...editForm, role: e.target.value })}>
            <option value="salesperson">Salesperson</option>
            <option value="sales_manager">Sales Manager</option>
            <option value="accountant">Accountant</option>
            <option value="admin">Administrator</option>
          </select>
        </div>
      </div>

      {/* Apply Permission Group Presets */}
      {editForm.role !== 'admin' && groups.length > 0 && (
        <div className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-left">
          <Layers size={16} className="text-amber-500 shrink-0" />
          <div className="flex-1">
            <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest block">Batch Permission Group Presets</span>
            <select
              className="mt-1 text-xs border border-[var(--color-border)] rounded-md p-1.5 bg-[var(--color-surface)] text-[var(--color-text)] focus:ring-1 focus:ring-[var(--color-primary)] outline-none"
              value={selectedGroupId}
              onChange={e => {
                setSelectedGroupId(e.target.value);
                if (e.target.value) {
                  setEditForm(prev => ({ ...prev, permissions: applyGroup(e.target.value, (prev.permissions || {}) as Permissions) }));
                }
              }}
            >
              <option value="">— Select a group preset —</option>
              {groups.map(g => <option key={g.id} value={String(g.id)}>{g.name}</option>)}
            </select>
          </div>
          {selectedGroupId && (
            <button className="text-xs text-amber-500 font-bold underline cursor-pointer" onClick={() => { setSelectedGroupId(''); setEditForm(prev => ({ ...prev, permissions: {} })); }}>Clear Controls</button>
          )}
        </div>
      )}

      {editForm.role !== 'admin' && (
        <PermissionToggles perms={(editForm.permissions || {}) as Permissions} role={editForm.role || 'salesperson'} onChange={togglePerm} />
      )}
      
      <div className="flex gap-2 justify-end border-t border-[var(--color-divider)]/40 pt-3">
        <button onClick={onSave} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors"><Save size={14} /> Commit Changes</button>
        <button onClick={onCancel} className="flex items-center gap-1.5 px-4 py-2 border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-offset)] rounded-lg text-xs font-bold cursor-pointer transition-colors"><X size={14} /> Cancel</button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Header and Add button */}
      <div className="flex justify-between items-center bg-[var(--color-surface-2)] p-4 border border-[var(--color-border)] rounded-xl">
        <div className="flex items-center gap-2.5">
          <Shield className="text-[var(--color-primary)] w-5 h-5" />
          <div className="text-left leading-tight">
            <span className="font-extrabold text-sm text-[var(--color-text)] block">Enterprise User Directory / الموظفين</span>
            <span className="text-[10px] font-semibold text-[var(--color-text-muted)]">Configure granular employee security permissions and platform access.</span>
          </div>
        </div>
        {!isAdding && !isEditing && (
          <button onClick={() => { setIsAdding(true); setEditForm({ role: 'salesperson', permissions: {} }); setError(''); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-md text-xs font-extrabold transition-all cursor-pointer shadow-sm">
            <Plus size={14} /> Create Employee / إضافة موظف
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-200 rounded-lg text-xs text-left font-bold">
          {error}
        </div>
      )}

      {isAdding && <FormPanel title="Register New Corporate Employee" onSave={handleAdd} onCancel={() => { setIsAdding(false); setSelectedGroupId(''); }} bg="bg-[var(--color-surface)]" />}
      {isEditing !== null && <FormPanel title={`Update Profile: ${users.find(u => u.id === isEditing)?.name}`} onSave={() => handleUpdate(isEditing)} onCancel={() => { setIsEditing(null); setSelectedGroupId(''); }} bg="bg-[var(--color-surface)] border-[var(--color-primary)]/40" />}

      {/* Table view */}
      <div className="premium-card overflow-hidden border border-[var(--color-border)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[var(--color-surface-offset)] text-[var(--color-text-muted)] font-black uppercase tracking-wider border-b border-[var(--color-border)]">
                <th className="p-4">Staff Member / الاسم</th>
                <th className="p-4">Assigned Role</th>
                <th className="p-4">Allocated Capabilities</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-divider)]/40 font-semibold">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-[var(--color-surface-offset)]/40 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <img src={user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80'} alt={user.name} className="w-8 h-8 rounded-full border border-[var(--color-border)]" />
                      <div className="text-left">
                        <span className="font-extrabold text-[var(--color-text)] block">{user.name}</span>
                        <span className="text-[10px] text-[var(--color-text-muted)]">{user.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                      user.role === 'admin' 
                        ? 'bg-purple-500/10 border border-purple-500/20 text-purple-400' 
                        : user.role === 'accountant' 
                          ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400' 
                          : 'bg-slate-500/10 border border-slate-500/20 text-slate-400'
                    }`}>
                      {user.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-4 max-w-sm"><PermissionBadges perms={user.permissions} role={user.role} /></td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => startEdit(user)} className="flex items-center gap-1 px-2.5 py-1 text-teal-400 hover:bg-teal-500/10 rounded border border-teal-500/20 transition-all cursor-pointer"><Edit2 size={12} /> Edit</button>
                      {user.id !== 'u-1' && (
                        <button onClick={() => handleDelete(user.id)} className="flex items-center gap-1 px-2 py-1 text-red-400 hover:bg-red-500/10 rounded border border-red-500/20 transition-all cursor-pointer"><Trash2 size={12} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && !isAdding && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-[var(--color-text-muted)] italic">
                    No active corporate system users registered.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── Permission Groups Tab ─────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
function GroupsTab({ groups, onGroupsChange }: { groups: PermissionGroup[]; onGroupsChange: () => void }) {
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [form, setForm] = useState<{ name: string; description: string; permissions: Permissions; members: string[] }>({ name: '', description: '', permissions: {}, members: [] });
  const [error, setError] = useState('');
  const [allUsers, setAllUsers] = useState<{id: string; username: string; name: string}[]>([]);

  useEffect(() => {
    fetch('/api/users', { headers: getAuthHeaders() }).then(r => r.ok ? r.json() : []).then(d => { if (Array.isArray(d)) setAllUsers(d); }).catch(() => {});
  }, []);

  const resetForm = () => setForm({ name: '', description: '', permissions: {}, members: [] });

  const togglePerm = (key: keyof Permissions) =>
    setForm(prev => ({ ...prev, permissions: { ...prev.permissions, [key]: !prev.permissions[key] } }));

  const handleSave = async () => {
    setError('');
    if (!form.name.trim()) { setError('Group name is required.'); return; }
    const url = isEditing !== null ? `/api/permission-groups/${isEditing}` : '/api/permission-groups';
    const method = isEditing !== null ? 'PUT' : 'POST';
    try {
      const res = await fetch(url, { method, headers: getAuthHeaders(), body: JSON.stringify(form) });
      if (res.ok) { resetForm(); setIsAdding(false); setIsEditing(null); onGroupsChange(); }
      else { const d = await res.json(); setError(d.error || 'Failed to save group preset'); }
    } catch (err) {
      setError('Connection failure.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Permanently delete this security permission group preset?')) return;
    try {
      const res = await fetch(`/api/permission-groups/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (res.ok) onGroupsChange();
    } catch (err) {}
  };

  const startEdit = (g: PermissionGroup) => {
    setIsEditing(g.id);
    setIsAdding(false);
    setForm({ name: g.name, description: g.description || '', permissions: { ...g.permissions }, members: Array.isArray(g.members) ? g.members : [] });
  };

  const grantedCount = (perms: Permissions) => ALL_PERMISSIONS.filter(p => perms?.[p.key]).length;

  return (
    <div className="flex flex-col gap-6 text-left">
      <div className="flex justify-between items-center bg-[var(--color-surface-2)] p-4 border border-[var(--color-border)] rounded-xl">
        <div className="flex items-center gap-2.5">
          <Layers className="text-[var(--color-primary)] w-5 h-5" />
          <div className="text-left leading-tight">
            <span className="font-extrabold text-sm text-[var(--color-text)] block">Access Control Preset Groups / مجموعات الصلاحيات</span>
            <span className="text-[10px] font-semibold text-[var(--color-text-muted)]">Establish reusable access lists to allocate roles like "Sales Team" or "Auditors" in one click.</span>
          </div>
        </div>
        {!isAdding && !isEditing && (
          <button onClick={() => { setIsAdding(true); setIsEditing(null); resetForm(); setError(''); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-md text-xs font-extrabold transition-all cursor-pointer shadow-sm">
            <Plus size={14} /> New Group Preset / مجموعة جديدة
          </button>
        )}
      </div>

      {error && <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-200 rounded-lg text-xs font-bold">{error}</div>}

      {(isAdding || isEditing !== null) && (
        <div className="p-5 border border-amber-500/20 bg-amber-500/5 rounded-xl flex flex-col gap-4 text-xs font-semibold text-[var(--color-text-muted)]">
          <span className="text-xs font-black text-amber-500 uppercase tracking-widest">{isEditing !== null ? 'Configure Preset Group Settings' : 'Create Custom Permission Preset Group'}</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
            <div>
              <label className="block mb-1">Preset Group Label *</label>
              <input type="text" className="w-full premium-input font-bold text-[var(--color-text)]" placeholder="E.g., Riyadh Sales Representatives" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="block mb-1">Corporate Mandate (Description)</label>
              <input type="text" className="w-full premium-input" placeholder="Access rules for Riyadh branch staff" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>

          <PermissionToggles perms={form.permissions} role="user" onChange={togglePerm} />

          {/* Members Checklist */}
          <div className="mt-2 text-left">
            <p className="text-[10px] font-black text-amber-500 uppercase tracking-wider mb-2">Allocate Active Staff to this Preset:</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto bg-[var(--color-surface)] p-2 rounded-lg border border-[var(--color-border)]">
              {allUsers.map(u => (
                <label key={u.id} className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-all ${
                  form.members.includes(u.id) ? 'border-[var(--color-primary)] bg-[var(--color-primary-highlight)]/10' : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-offset)]'
                }`}>
                  <input
                    type="checkbox"
                    checked={form.members.includes(u.id)}
                    onChange={() => setForm(prev => ({
                      ...prev,
                      members: prev.members.includes(u.id)
                        ? prev.members.filter(id => id !== u.id)
                        : [...prev.members, u.id]
                    }))}
                    className="accent-[var(--color-primary)]"
                  />
                  <div>
                    <span className="font-bold text-[var(--color-text)] block text-[11px] leading-tight">{u.name}</span>
                    <span className="text-[9px] text-[var(--color-text-muted)]">@{u.username}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2 justify-end border-t border-amber-500/20 pt-3">
            <button onClick={handleSave} className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors"><Save size={14} /> Commit Preset Group</button>
            <button onClick={() => { setIsAdding(false); setIsEditing(null); resetForm(); }} className="flex items-center gap-1.5 px-4 py-2 border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-offset)] rounded-lg text-xs font-bold cursor-pointer transition-colors"><X size={14} /> Cancel</button>
          </div>
        </div>
      )}

      {/* Grid of Groups */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
        {groups.length === 0 && !isAdding && (
          <div className="col-span-2 p-8 text-center text-[var(--color-text-muted)] italic bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)]">
            No preset permission groups configured yet.
          </div>
        )}
        {groups.map(g => {
          const count = grantedCount(g.permissions);
          return (
            <div key={g.id} className="premium-card p-5 border border-[var(--color-border)] flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="text-left leading-tight">
                  <span className="font-extrabold text-sm text-[var(--color-text)] block">{g.name}</span>
                  {g.description && <span className="text-[10px] text-[var(--color-text-muted)] block mt-0.5">{g.description}</span>}
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => startEdit(g)} className="p-1 hover:bg-[var(--color-surface-offset)] text-teal-400 hover:text-teal-300 rounded border border-[var(--color-border)] cursor-pointer"><Edit2 size={12} /></button>
                  <button onClick={() => handleDelete(g.id)} className="p-1 hover:bg-[var(--color-surface-offset)] text-red-400 hover:text-red-300 rounded border border-[var(--color-border)] cursor-pointer"><Trash2 size={12} /></button>
                </div>
              </div>

              <div className="flex gap-2 text-[9px] font-black uppercase tracking-widest">
                <span className="px-2.5 py-0.5 bg-[var(--color-primary-highlight)]/40 text-[var(--color-primary)] rounded-full border border-[var(--color-primary)]/10">{count} Capabilities</span>
                <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">{g.members.length} Members</span>
              </div>

              <div className="flex flex-wrap gap-1 border-t border-[var(--color-divider)]/40 pt-3">
                {ALL_PERMISSIONS.filter(p => g.permissions?.[p.key]).map(p => (
                  <span
                    key={p.key}
                    className="px-2 py-0.5 bg-[var(--color-surface-offset)] text-[var(--color-text-muted)] text-[9px] font-bold rounded-full"
                  >
                    {p.label}
                  </span>
                ))}
                {count === 0 && <span className="text-xs text-[var(--color-text-faint)] italic">No features allocated</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Root Export ───────────────────────────────────────────────────────────────
export default function UsersDB() {
  const [tab, setTab] = useState<'users' | 'groups'>('users');
  const [groups, setGroups] = useState<PermissionGroup[]>([]);

  const fetchGroups = async () => {
    try {
      const res = await fetch('/api/permission-groups', { headers: getAuthHeaders() });
      if (res.ok) setGroups(await res.json());
    } catch (e) {}
  };

  useEffect(() => { fetchGroups(); }, []);

  return (
    <div className="flex flex-col gap-6 text-left animate-fade-in">
      {/* Sub tabs */}
      <div className="flex border-b border-[var(--color-border)] select-none">
        <button
          onClick={() => setTab('users')}
          className={`flex items-center gap-2 px-6 py-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
            tab === 'users' 
              ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-[var(--color-primary-highlight)]/10' 
              : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          <Shield size={14} /> Employees & Security / الموظفين
        </button>
        <button
          onClick={() => setTab('groups')}
          className={`flex items-center gap-2 px-6 py-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
            tab === 'groups' 
              ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-[var(--color-primary-highlight)]/10' 
              : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          <Layers size={14} /> Permission Group Presets / الصلاحيات المجهزة
          {groups.length > 0 && <span className="ml-1.5 px-1.5 py-0.5 bg-[var(--color-primary)] text-white rounded-full text-[9px] font-black">{groups.length}</span>}
        </button>
      </div>

      {tab === 'users' && <UsersTab groups={groups} />}
      {tab === 'groups' && <GroupsTab groups={groups} onGroupsChange={fetchGroups} />}
    </div>
  );
}
