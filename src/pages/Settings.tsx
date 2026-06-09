import React, { useState, useEffect } from 'react';
import { useERPStore } from '../store';
import { PageHeader } from '../components/PageHeader';
import {
  Building2,
  FileSpreadsheet,
  Users2,
  Palette,
  Save,
  UserPlus,
  Mail,
  Shield,
  Trash2,
  Upload,
  Image as ImageIcon,
  CheckCircle,
  Loader2,
  Activity,
  Terminal,
  Settings as SettingsIcon,
  AlertTriangle,
  Info
} from 'lucide-react';
import { mockUsers } from '../mockData';
import { UserRole } from '../types';
import UsersDB from '../components/UsersDB';
import DatabaseBackupDB from '../components/DatabaseBackupDB';

export const Settings: React.FC = () => {
  const { company, updateCompany, theme, setTheme } = useERPStore();
  const [activeSubTab, setActiveSubTab] = useState<'company' | 'document' | 'users' | 'appearance' | 'maintenance' | 'logs'>('company');

  // Local Form states (initialized from store)
  const [companyName, setCompanyName] = useState(company.name);
  const [phone, setPhone] = useState(company.phone);
  const [email, setEmail] = useState(company.email);
  const [vat, setVat] = useState(company.vatNumber || '');
  const [cr, setCr] = useState(company.crNumber || '');
  const [currency, setCurrency] = useState(company.currency);

  // Logo & Footer Image states
  const [currentLogo, setCurrentLogo] = useState<string | null>(null);
  const [logoStatus, setLogoStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [currentSiteLogo, setCurrentSiteLogo] = useState<string | null>(null);
  const [siteLogoStatus, setSiteLogoStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [currentFooterImage, setCurrentFooterImage] = useState<string | null>(null);
  const [footerImageStatus, setFooterImageStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const [defaultMarkupPercentage, setDefaultMarkupPercentage] = useState<number>(8);
  const [defaultMarkupStatus, setDefaultMarkupStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const [usersList, setUsersList] = useState(mockUsers);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('salesperson');

  // Advanced PDF Document styling states
  const [pdfHeaderBgType, setPdfHeaderBgType] = useState<'solid' | 'gradient'>(company.pdfHeaderBgType || 'solid');
  const [pdfHeaderBgColorStart, setPdfHeaderBgColorStart] = useState(company.pdfHeaderBgColorStart || company.brandColor || '#01696f');
  const [pdfHeaderBgColorEnd, setPdfHeaderBgColorEnd] = useState(company.pdfHeaderBgColorEnd || company.brandColor || '#01696f');
  const [pdfHeaderTextColor, setPdfHeaderTextColor] = useState(company.pdfHeaderTextColor || '#ffffff');
  const [pdfTableBgColor, setPdfTableBgColor] = useState(company.pdfTableBgColor || company.brandColor || '#01696f');
  const [pdfTableTextColor, setPdfTableTextColor] = useState(company.pdfTableTextColor || '#ffffff');

  // Logging and Update states
  const [detailedLogsEnabled, setDetailedLogsEnabled] = useState(true);
  const [systemLogs, setSystemLogs] = useState<any[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logTypeFilter, setLogTypeFilter] = useState<'all' | 'info' | 'warn' | 'error'>('all');
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [updateOutput, setUpdateOutput] = useState('');
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const fetchLogs = async () => {
    setLogsLoading(true);
    try {
      const token = useERPStore.getState().token;
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(`/api/logs?limit=200`, { headers });
      if (res.ok) {
        const data = await res.json();
        setSystemLogs(data.logs || []);
        setLogsTotal(data.total || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLogsLoading(false);
    }
  };

  // Fetch detailedLogsEnabled and logs
  useEffect(() => {
    if (activeSubTab === 'logs') {
      const token = useERPStore.getState().token;
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

      fetch('/api/settings/detailedLogsEnabled', { headers })
        .then(res => res.json())
        .then(data => {
          setDetailedLogsEnabled(data.value === 'true');
        })
        .catch(console.error);

      fetchLogs();
    }
  }, [activeSubTab]);

  const handleToggleLogs = async (checked: boolean) => {
    setDetailedLogsEnabled(checked);
    try {
      const token = useERPStore.getState().token;
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
        body: JSON.stringify({ key: 'detailedLogsEnabled', value: checked ? 'true' : 'false' })
      });
      fetchLogs();
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearLogs = async () => {
    if (!confirm('Are you sure you want to clear all system logs?')) return;
    try {
      const token = useERPStore.getState().token;
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch('/api/logs/clear', { method: 'POST', headers });
      if (res.ok) {
        setSystemLogs([]);
        setLogsTotal(0);
        alert('System logs cleared successfully.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoteUpdate = async () => {
    setUpdateStatus('loading');
    setUpdateOutput('');
    try {
      const token = useERPStore.getState().token;
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch('/api/system/update', { method: 'POST', headers });
      const data = await res.json();
      if (res.ok) {
        setUpdateStatus('success');
        setUpdateOutput(data.stdout || 'App updated successfully (no output).');
      } else {
        setUpdateStatus('error');
        setUpdateOutput(data.details || data.error || 'Update failed.');
      }
      fetchLogs();
    } catch (err: any) {
      setUpdateStatus('error');
      setUpdateOutput(err.message || 'Network connection failed.');
      fetchLogs();
    }
  };

  // Fetch current logo & footer image on mount
  useEffect(() => {
    const token = useERPStore.getState().token;
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    fetch('/api/settings/logo', { headers })
      .then(res => res.json())
      .then(data => { if (data.value) setCurrentLogo(data.value); })
      .catch(console.error);

    fetch('/api/settings/siteLogo', { headers })
      .then(res => res.json())
      .then(data => { if (data.value) setCurrentSiteLogo(data.value); })
      .catch(console.error);

    fetch('/api/settings/footerImage', { headers })
      .then(res => res.json())
      .then(data => { if (data.value) setCurrentFooterImage(data.value); })
      .catch(console.error);

    fetch('/api/settings/defaultMarkupPercentage', { headers })
      .then(res => res.json())
      .then(data => { if (data.value) setDefaultMarkupPercentage(parseFloat(data.value)); })
      .catch(console.error);
  }, []);

  // Accent presets
  const accentPresets = [
    { name: 'Teal (Brand)', value: '#01696f' },
    { name: 'Linear Dark', value: '#171614' },
    { name: 'Stripe Indigo', value: '#635bff' },
    { name: 'Vercel Black', value: '#000000' },
    { name: 'KSA Emerald', value: '#006C35' }
  ];

  const handleCompanySave = (e: React.FormEvent) => {
    e.preventDefault();
    updateCompany({
      name: companyName,
      phone,
      email,
      vatNumber: vat,
      crNumber: cr,
      currency
    });
    alert('Company configurations updated successfully!');
  };

  const handleSaveDefaultMarkup = async () => {
    setDefaultMarkupStatus('loading');
    try {
      const token = useERPStore.getState().token;
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ key: 'defaultMarkupPercentage', value: String(defaultMarkupPercentage) })
      });
      if (res.ok) {
        setDefaultMarkupStatus('success');
        setTimeout(() => setDefaultMarkupStatus('idle'), 3000);
      } else {
        setDefaultMarkupStatus('error');
        setTimeout(() => setDefaultMarkupStatus('idle'), 5000);
      }
    } catch {
      setDefaultMarkupStatus('error');
      setTimeout(() => setDefaultMarkupStatus('idle'), 5000);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoStatus('loading');
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64 = event.target?.result as string;
        const token = useERPStore.getState().token;
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
          body: JSON.stringify({ key: 'logo', value: base64 })
        });
        if (res.ok) {
          setCurrentLogo(base64);
          useERPStore.setState((state) => ({
            company: { ...state.company, logo: base64 }
          }));
          setLogoStatus('success');
          setTimeout(() => setLogoStatus('idle'), 3000);
        } else {
          setLogoStatus('error');
          setTimeout(() => setLogoStatus('idle'), 5000);
        }
      } catch {
        setLogoStatus('error');
        setTimeout(() => setLogoStatus('idle'), 5000);
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSiteLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSiteLogoStatus('loading');
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64 = event.target?.result as string;
        const token = useERPStore.getState().token;
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
          body: JSON.stringify({ key: 'siteLogo', value: base64 })
        });
        if (res.ok) {
          setCurrentSiteLogo(base64);
          useERPStore.setState((state) => ({
            company: { ...state.company, siteLogo: base64 }
          }));
          setSiteLogoStatus('success');
          setTimeout(() => setSiteLogoStatus('idle'), 3000);
        } else {
          setSiteLogoStatus('error');
          setTimeout(() => setSiteLogoStatus('idle'), 5000);
        }
      } catch {
        setSiteLogoStatus('error');
        setTimeout(() => setSiteLogoStatus('idle'), 5000);
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFooterUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFooterImageStatus('loading');
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64 = event.target?.result as string;
        const token = useERPStore.getState().token;
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
          body: JSON.stringify({ key: 'footerImage', value: base64 })
        });
        if (res.ok) {
          setCurrentFooterImage(base64);
          setFooterImageStatus('success');
          setTimeout(() => setFooterImageStatus('idle'), 3000);
        } else {
          setFooterImageStatus('error');
          setTimeout(() => setFooterImageStatus('idle'), 5000);
        }
      } catch {
        setFooterImageStatus('error');
        setTimeout(() => setFooterImageStatus('idle'), 5000);
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;

    const newUser = {
      id: `u-${Date.now()}`,
      name: inviteEmail.split('@')[0].toUpperCase(),
      email: inviteEmail,
      role: inviteRole,
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=100&q=80'
    };

    setUsersList([...usersList, newUser]);
    setInviteEmail('');
    alert(`Invite email sent successfully to ${inviteEmail}!`);
  };

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
  };

  const handleAccentChange = (color: string) => {
    document.documentElement.style.setProperty('--color-primary', color);
    // Darken for hover
    document.documentElement.style.setProperty('--color-primary-hover', color + 'ee');
    updateCompany({
      brandColor: color
    });
  };

  return (
    <div className="animate-fade-in text-left">
      <PageHeader
        title="Settings / الإعدادات"
        breadcrumbs={[{ label: 'Home' }, { label: 'Settings' }]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left Side-Nav Tabs */}
        <div className="premium-card p-3 flex flex-col gap-1">
          <button
            onClick={() => setActiveSubTab('company')}
            className={`w-full flex items-center gap-2.5 px-4 py-2.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer text-left ${
              activeSubTab === 'company'
                ? 'bg-[var(--color-primary-highlight)]/30 text-[var(--color-primary)]'
                : 'hover:bg-[var(--color-surface-offset)] text-[var(--color-text-muted)]'
            }`}
          >
            <Building2 className="w-4 h-4 text-[var(--color-text-muted)]" />
            Company Profile / المؤسسة
          </button>
          <button
            onClick={() => setActiveSubTab('document')}
            className={`w-full flex items-center gap-2.5 px-4 py-2.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer text-left ${
              activeSubTab === 'document'
                ? 'bg-[var(--color-primary-highlight)]/30 text-[var(--color-primary)]'
                : 'hover:bg-[var(--color-surface-offset)] text-[var(--color-text-muted)]'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-[var(--color-text-muted)]" />
            Billing Templates / الفواتير
          </button>
          <button
            onClick={() => setActiveSubTab('users')}
            className={`w-full flex items-center gap-2.5 px-4 py-2.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer text-left ${
              activeSubTab === 'users'
                ? 'bg-[var(--color-primary-highlight)]/30 text-[var(--color-primary)]'
                : 'hover:bg-[var(--color-surface-offset)] text-[var(--color-text-muted)]'
            }`}
          >
            <Users2 className="w-4 h-4 text-[var(--color-text-muted)]" />
            User Roles (RBAC) / الصلاحيات
          </button>
          <button
            onClick={() => setActiveSubTab('appearance')}
            className={`w-full flex items-center gap-2.5 px-4 py-2.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer text-left ${
              activeSubTab === 'appearance'
                ? 'bg-[var(--color-primary-highlight)]/30 text-[var(--color-primary)]'
                : 'hover:bg-[var(--color-surface-offset)] text-[var(--color-text-muted)]'
            }`}
          >
            <Palette className="w-4 h-4 text-[var(--color-text-muted)]" />
            Visual Themes / المظهر
          </button>
          <button
            onClick={() => setActiveSubTab('maintenance')}
            className={`w-full flex items-center gap-2.5 px-4 py-2.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer text-left ${
              activeSubTab === 'maintenance'
                ? 'bg-[var(--color-primary-highlight)]/30 text-[var(--color-primary)]'
                : 'hover:bg-[var(--color-surface-offset)] text-[var(--color-text-muted)]'
            }`}
          >
            <Shield className="w-4 h-4 text-[var(--color-text-muted)]" />
            Database & Backups / صيانة النظام
          </button>
          <button
            onClick={() => setActiveSubTab('logs')}
            className={`w-full flex items-center gap-2.5 px-4 py-2.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer text-left ${
              activeSubTab === 'logs'
                ? 'bg-[var(--color-primary-highlight)]/30 text-[var(--color-primary)]'
                : 'hover:bg(--color-surface-offset) text-[var(--color-text-muted)]'
            }`}
          >
            <Activity className="w-4 h-4 text-[var(--color-text-muted)]" />
            Logs & Updates / السجلات والتحديث
          </button>
        </div>

        {/* Right Content Sheet */}
        <div className="lg:col-span-3">
          {activeSubTab === 'company' && (
            <form onSubmit={handleCompanySave} className="premium-card p-6 flex flex-col gap-6">
              <div className="border-b border-[var(--color-divider)]/30 pb-4">
                <h3 className="text-sm font-bold text-[var(--color-text)]">Company Settings</h3>
                <p className="text-xs text-[var(--color-text-muted)]">Configure your company tax records and billing currencies.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold text-[var(--color-text-muted)]">
                <div className="md:col-span-2">
                  <label className="block mb-1.5">Official Company Name *</label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full premium-input text-sm text-[var(--color-text)] font-semibold"
                  />
                </div>

                <div>
                  <label className="block mb-1.5">Corporate Phone Number</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full premium-input font-mono"
                  />
                </div>

                <div>
                  <label className="block mb-1.5">Official Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full premium-input"
                  />
                </div>

                <div>
                  <label className="block mb-1.5">KSA VAT Number / الرقم الضريبي</label>
                  <input
                    type="text"
                    value={vat}
                    onChange={(e) => setVat(e.target.value)}
                    className="w-full premium-input font-mono"
                  />
                </div>

                <div>
                  <label className="block mb-1.5">KSA Commercial Register (CR) / السجل التجاري</label>
                  <input
                    type="text"
                    value={cr}
                    onChange={(e) => setCr(e.target.value)}
                    className="w-full premium-input font-mono"
                  />
                </div>

                <div>
                  <label className="block mb-1.5">Default Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as any)}
                    className="w-full premium-input"
                  >
                    <option value="SAR">SAR (Saudi Riyal)</option>
                    <option value="USD">USD (US Dollar)</option>
                    <option value="EUR">EUR (Euro)</option>
                  </select>
                </div>
              </div>

              {/* Site Branding */}
              <div className="border-t border-[var(--color-divider)]/30 pt-6">
                <h4 className="text-xs font-bold text-[var(--color-text)] uppercase tracking-wider mb-4">Site Branding</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Site Logo */}
                  <div className="text-xs font-semibold text-[var(--color-text-muted)]">
                    <label className="block mb-2 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5" />
                      Site Logo (Sidebar / Dashboard)
                    </label>
                    <div className="border border-dashed border-[var(--color-border)] rounded-lg p-4 bg-[var(--color-surface)] flex flex-col items-center gap-3 min-h-[120px] justify-center">
                      {currentSiteLogo ? (
                        <img src={currentSiteLogo} alt="Current Site Logo" className="max-h-16 max-w-full object-contain" />
                      ) : (
                        <div className="text-[var(--color-text-muted)] text-center">
                          <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-30" />
                          <span className="text-[10px]">No site logo uploaded</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <label className="bg-[var(--color-surface-offset)] hover:bg-[var(--color-border)] border border-[var(--color-border)] text-[var(--color-text)] text-[10px] font-bold py-1.5 px-3 rounded-md flex items-center gap-1 cursor-pointer transition-colors">
                          <input type="file" accept="image/*" onChange={handleSiteLogoUpload} className="hidden" disabled={siteLogoStatus === 'loading'} />
                          {siteLogoStatus === 'loading' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                          {siteLogoStatus === 'loading' ? 'Uploading...' : 'Upload Site Logo'}
                        </label>
                        {siteLogoStatus === 'success' && <span className="text-green-500 text-[10px] flex items-center gap-0.5"><CheckCircle className="w-3 h-3" /> Saved!</span>}
                        {siteLogoStatus === 'error' && <span className="text-red-500 text-[10px]">Upload failed</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Logo & Footer Image Upload */}
              <div className="border-t border-[var(--color-divider)]/30 pt-6">
                <h4 className="text-xs font-bold text-[var(--color-text)] uppercase tracking-wider mb-4">PDF Document Images</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Company Logo */}
                  <div className="text-xs font-semibold text-[var(--color-text-muted)]">
                    <label className="block mb-2 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5" />
                      Company Logo (PDF Header)
                    </label>
                    <div className="border border-dashed border-[var(--color-border)] rounded-lg p-4 bg-[var(--color-surface)] flex flex-col items-center gap-3 min-h-[120px] justify-center">
                      {currentLogo ? (
                        <img src={currentLogo} alt="Current Logo" className="max-h-16 max-w-full object-contain" />
                      ) : (
                        <div className="text-[var(--color-text-muted)] text-center">
                          <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-30" />
                          <span className="text-[10px]">No logo uploaded</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <label className="bg-[var(--color-surface-offset)] hover:bg-[var(--color-border)] border border-[var(--color-border)] text-[var(--color-text)] text-[10px] font-bold py-1.5 px-3 rounded-md flex items-center gap-1 cursor-pointer transition-colors">
                          <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" disabled={logoStatus === 'loading'} />
                          {logoStatus === 'loading' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                          {logoStatus === 'loading' ? 'Uploading...' : 'Upload Logo'}
                        </label>
                        {logoStatus === 'success' && <span className="text-green-500 text-[10px] flex items-center gap-0.5"><CheckCircle className="w-3 h-3" /> Saved!</span>}
                        {logoStatus === 'error' && <span className="text-red-500 text-[10px]">Upload failed</span>}
                      </div>
                    </div>
                  </div>

                  {/* Footer Image */}
                  <div className="text-xs font-semibold text-[var(--color-text-muted)]">
                    <label className="block mb-2 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5" />
                      Footer Image (PDF Footer)
                    </label>
                    <div className="border border-dashed border-[var(--color-border)] rounded-lg p-4 bg-[var(--color-surface)] flex flex-col items-center gap-3 min-h-[120px] justify-center">
                      {currentFooterImage ? (
                        <img src={currentFooterImage} alt="Current Footer" className="max-h-16 max-w-full object-contain" />
                      ) : (
                        <div className="text-[var(--color-text-muted)] text-center">
                          <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-30" />
                          <span className="text-[10px]">No footer image uploaded</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <label className="bg-[var(--color-surface-offset)] hover:bg-[var(--color-border)] border border-[var(--color-border)] text-[var(--color-text)] text-[10px] font-bold py-1.5 px-3 rounded-md flex items-center gap-1 cursor-pointer transition-colors">
                          <input type="file" accept="image/*" onChange={handleFooterUpload} className="hidden" disabled={footerImageStatus === 'loading'} />
                          {footerImageStatus === 'loading' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                          {footerImageStatus === 'loading' ? 'Uploading...' : 'Upload Footer'}
                        </label>
                        {footerImageStatus === 'success' && <span className="text-green-500 text-[10px] flex items-center gap-0.5"><CheckCircle className="w-3 h-3" /> Saved!</span>}
                        {footerImageStatus === 'error' && <span className="text-red-500 text-[10px]">Upload failed</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-[var(--color-divider)]/40 pt-4 flex justify-end">
                <button
                  type="submit"
                  className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-semibold py-2 px-4 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Save className="w-4 h-4" /> Save Company
                </button>
              </div>
            </form>
          )}

          {activeSubTab === 'document' && (
            <div className="premium-card p-6 flex flex-col gap-6">
              <div className="border-b border-[var(--color-divider)]/30 pb-4">
                <h3 className="text-sm font-bold text-[var(--color-text)]">Billing Document Formats</h3>
                <p className="text-xs text-[var(--color-text-muted)]">Configure automatic numbering formats and default templates.</p>
              </div>

              {/* ── Line Item Numbering Format ──────────────────────────────── */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-[var(--color-text)] mb-1">
                  Line Item Numbering / تنسيق ترقيم البنود
                </h4>
                <p className="text-[11px] text-[var(--color-text-muted)] mb-4">
                  Controls how items are numbered in quotations, invoices, and PDF exports. Changes apply instantly.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {([
                    {
                      value: 'sequential',
                      label: 'Sequential / تسلسلي',
                      preview: '1  Item A\n2  Item B\n—  Section\n3  Item C\n4  Item D',
                      desc: 'Global counter 1, 2, 3 … ignores sections'
                    },
                    {
                      value: 'sectioned',
                      label: 'Sectioned / هرمي',
                      preview: '1.1  Item A\n1.2  Item B\n—    Section 2\n2.1  Item C\n2.2  Item D',
                      desc: 'Section.Item format — 1.1, 1.2 / 2.1, 2.2'
                    },
                    {
                      value: 'per-section',
                      label: 'Per Section Reset / إعادة العد',
                      preview: '1  Item A\n2  Item B\n—  Section\n1  Item C\n2  Item D',
                      desc: 'Counter restarts at 1 after each section'
                    },
                    {
                      value: 'none',
                      label: 'No Numbers / بدون ترقيم',
                      preview: '—  Item A\n—  Item B\n—  Section\n—  Item C',
                      desc: 'Items shown without any numbering'
                    }
                  ] as const).map((opt) => {
                    const isActive = (company.lineNumberFormat || 'sequential') === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={async () => {
                          const token = useERPStore.getState().token;
                          updateCompany({ lineNumberFormat: opt.value });
                          await fetch('/api/settings', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                            },
                            body: JSON.stringify({ key: 'lineNumberFormat', value: opt.value })
                          });
                        }}
                        className={`text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
                          isActive
                            ? 'border-[var(--color-primary)] bg-[var(--color-primary-highlight)]/20'
                            : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/40 bg-[var(--color-surface-offset)]/30'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-xs font-bold ${isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]'}`}>
                            {opt.label}
                          </span>
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                            isActive ? 'border-[var(--color-primary)] bg-[var(--color-primary)]' : 'border-[var(--color-text-faint)] bg-transparent'
                          }`}>
                            {isActive && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                        </div>
                        <pre className={`text-[10px] font-mono leading-relaxed whitespace-pre mb-2 ${
                          isActive ? 'text-[var(--color-primary)]/80' : 'text-[var(--color-text-faint)]'
                        }`}>{opt.preview}</pre>
                        <p className="text-[10px] text-[var(--color-text-muted)]">{opt.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Document Prefixes ─────────────────────────────────────── */}
              <div className="border-t border-[var(--color-divider)]/30 pt-6">
                <h4 className="text-xs font-black uppercase tracking-wider text-[var(--color-text)] mb-4">Document Prefixes</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold text-[var(--color-text-muted)]">
                  <div>
                    <label className="block mb-1.5">Quotation Prefix</label>
                    <input type="text" defaultValue="QT-2026-" className="w-full premium-input font-mono" />
                  </div>
                  <div>
                    <label className="block mb-1.5">Invoice Prefix</label>
                    <input type="text" defaultValue="INV-2026-" className="w-full premium-input font-mono" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block mb-1.5">Default Bank Coordinates &amp; Terms (Bilingual)</label>
                    <textarea
                      rows={6}
                      defaultValue={company.defaultTax === 15 ?
                        "ALINMA BANK - Account: 68206662020000\nIBAN: SA0305000068206662020000\nABDULMOSHIN ABDULAZIZ AL-JABR TRADING CO."
                        : "Default terms applied..."}
                      className="w-full premium-input text-xs font-mono leading-relaxed"
                    />
                  </div>
                </div>
              </div>

              {/* Pricing Settings (Default Markup) */}
              <div className="border-t border-[var(--color-divider)]/30 pt-6">
                <h4 className="text-xs font-black uppercase tracking-wider text-[var(--color-text)] mb-1">
                  Pricing Settings / إعدادات التسعير
                </h4>
                <p className="text-[11px] text-[var(--color-text-muted)] mb-4">
                  Configure the global default pricing markup percentage applied to quotations.
                </p>
                <div className="flex items-center gap-3 max-w-sm">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      value={defaultMarkupPercentage}
                      onChange={(e) => setDefaultMarkupPercentage(parseFloat(e.target.value) || 0)}
                      className="w-full premium-input text-xs font-mono font-bold pr-10"
                      min="0"
                      max="100"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--color-text-muted)]">%</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveDefaultMarkup}
                    disabled={defaultMarkupStatus === 'loading'}
                    className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-semibold py-2.5 px-4 rounded-md flex items-center gap-1.5 transition-all cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    {defaultMarkupStatus === 'loading' ? <Loader2 size={14} className="animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Save Markup
                  </button>
                </div>
                <div className="mt-2 h-4">
                  {defaultMarkupStatus === 'success' && (
                    <span className="text-emerald-500 text-[10px] font-bold flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Saved default markup successfully!
                    </span>
                  )}
                  {defaultMarkupStatus === 'error' && (
                    <span className="text-red-500 text-[10px] font-bold">Failed to save default markup.</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'users' && <UsersDB />}

          {activeSubTab === 'appearance' && (
            <div className="premium-card p-6 flex flex-col gap-6">
              <div className="border-b border-[var(--color-divider)]/30 pb-4">
                <h3 className="text-sm font-bold text-[var(--color-text)]">Theme Settings</h3>
                <p className="text-xs text-[var(--color-text-muted)]">Customize workspace visuals and document brand colors.</p>
              </div>

              {/* Theme toggler */}
              <div className="text-left text-xs font-semibold text-[var(--color-text-muted)]">
                <span className="block uppercase tracking-wider mb-3">Workspace Mode</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleThemeChange('light')}
                    className={`px-4 py-2 border rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                      theme === 'light'
                        ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                        : 'bg-[var(--color-surface-2)] border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-offset)]'
                    }`}
                  >
                    Light Mode
                  </button>
                  <button
                    onClick={() => handleThemeChange('dark')}
                    className={`px-4 py-2 border rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                      theme === 'dark'
                        ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                        : 'bg-[var(--color-surface-2)] border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-offset)]'
                    }`}
                  >
                    Dark Mode
                  </button>
                  <button
                    onClick={() => handleThemeChange('system')}
                    className={`px-4 py-2 border rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                      theme === 'system'
                        ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                        : 'bg-[var(--color-surface-2)] border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-offset)]'
                    }`}
                  >
                    System Preference / تلقائي
                  </button>
                </div>
              </div>

              {/* Preset accent colors picker */}
              <div className="text-left text-xs font-semibold text-[var(--color-text-muted)] border-t border-[var(--color-divider)]/30 pt-6">
                <span className="block uppercase tracking-wider mb-3">Brand Accent Color</span>
                <div className="flex gap-3 flex-wrap mb-6">
                  {accentPresets.map((pr) => (
                    <button
                      key={pr.value}
                      type="button"
                      onClick={() => handleAccentChange(pr.value)}
                      className="flex items-center gap-2 border border-[var(--color-border)] hover:border-[var(--color-primary)] rounded-md px-3 py-2 cursor-pointer bg-[var(--color-surface)] hover:bg-[var(--color-surface-offset)] transition-all font-bold text-[var(--color-text)] text-xs"
                    >
                      <span className="w-3.5 h-3.5 rounded-full inline-block shadow-sm" style={{ backgroundColor: pr.value }} />
                      {pr.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Advanced PDF Document Branding Panel */}
              <div className="text-left text-xs font-semibold text-[var(--color-text-muted)] border-t border-[var(--color-divider)]/30 pt-6 flex flex-col gap-6">
                <div>
                  <h4 className="text-sm font-bold text-[var(--color-text)] mb-1">PDF Document Branding & Customizer</h4>
                  <p className="text-[10px] text-[var(--color-text-muted)] font-normal mb-4">
                    Design custom vector backgrounds, dynamic linear gradients, and clean contrasted text themes for professional client document representation.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Styling Controls */}
                  <div className="lg:col-span-7 flex flex-col gap-5">
                    {/* Background style type selector */}
                    <div>
                      <span className="block mb-2 text-xs uppercase tracking-wider">Header Background Style</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setPdfHeaderBgType('solid')}
                          className={`px-4 py-2 border rounded-md text-xs font-bold cursor-pointer transition-colors ${
                            pdfHeaderBgType === 'solid'
                              ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                              : 'bg-[var(--color-surface-2)] border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-offset)]'
                          }`}
                        >
                          Solid Color
                        </button>
                        <button
                          type="button"
                          onClick={() => setPdfHeaderBgType('gradient')}
                          className={`px-4 py-2 border rounded-md text-xs font-bold cursor-pointer transition-colors ${
                            pdfHeaderBgType === 'gradient'
                              ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                              : 'bg-[var(--color-surface-2)] border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-offset)]'
                          }`}
                        >
                          Dynamic Linear Gradient
                        </button>
                      </div>
                    </div>

                    {/* Color selection row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Color Start / Solid */}
                      <div>
                        <label className="block mb-1.5 uppercase text-[10px] tracking-wider text-[var(--color-text-muted)]">
                          {pdfHeaderBgType === 'gradient' ? 'Gradient Start Color' : 'Solid Header Color'}
                        </label>
                        <div className="flex gap-2 items-center">
                          <input
                            type="color"
                            value={pdfHeaderBgColorStart}
                            onChange={(e) => setPdfHeaderBgColorStart(e.target.value)}
                            className="w-10 h-10 border border-[var(--color-border)] rounded-md cursor-pointer bg-transparent"
                          />
                          <input
                            type="text"
                            value={pdfHeaderBgColorStart}
                            onChange={(e) => setPdfHeaderBgColorStart(e.target.value)}
                            className="flex-1 premium-input font-mono text-xs uppercase font-bold"
                          />
                        </div>
                      </div>

                      {/* Color End (Gradient only) */}
                      {pdfHeaderBgType === 'gradient' && (
                        <div className="animate-fade-in">
                          <label className="block mb-1.5 uppercase text-[10px] tracking-wider text-[var(--color-text-muted)]">
                            Gradient End Color
                          </label>
                          <div className="flex gap-2 items-center">
                            <input
                              type="color"
                              value={pdfHeaderBgColorEnd}
                              onChange={(e) => setPdfHeaderBgColorEnd(e.target.value)}
                              className="w-10 h-10 border border-[var(--color-border)] rounded-md cursor-pointer bg-transparent"
                            />
                            <input
                              type="text"
                              value={pdfHeaderBgColorEnd}
                              onChange={(e) => setPdfHeaderBgColorEnd(e.target.value)}
                              className="flex-1 premium-input font-mono text-xs uppercase font-bold"
                            />
                          </div>
                        </div>
                      )}

                      {/* Header Text Color */}
                      <div>
                        <label className="block mb-1.5 uppercase text-[10px] tracking-wider text-[var(--color-text-muted)]">
                          Header / Totals Text Color
                        </label>
                        <div className="flex gap-2 items-center">
                          <input
                            type="color"
                            value={pdfHeaderTextColor}
                            onChange={(e) => setPdfHeaderTextColor(e.target.value)}
                            className="w-10 h-10 border border-[var(--color-border)] rounded-md cursor-pointer bg-transparent"
                          />
                          <input
                            type="text"
                            value={pdfHeaderTextColor}
                            onChange={(e) => setPdfHeaderTextColor(e.target.value)}
                            className="flex-1 premium-input font-mono text-xs uppercase font-bold"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-[var(--color-border)] pt-4 mt-2">
                      {/* Product Table Background */}
                      <div>
                        <label className="block mb-1.5 uppercase text-[10px] tracking-wider text-[var(--color-text-muted)]">
                          Table Header Background
                        </label>
                        <div className="flex gap-2 items-center">
                          <input
                            type="color"
                            value={pdfTableBgColor}
                            onChange={(e) => setPdfTableBgColor(e.target.value)}
                            className="w-10 h-10 border border-[var(--color-border)] rounded-md cursor-pointer bg-transparent"
                          />
                          <input
                            type="text"
                            value={pdfTableBgColor}
                            onChange={(e) => setPdfTableBgColor(e.target.value)}
                            className="flex-1 premium-input font-mono text-xs uppercase font-bold"
                          />
                        </div>
                      </div>

                      {/* Product Table Text Color */}
                      <div>
                        <label className="block mb-1.5 uppercase text-[10px] tracking-wider text-[var(--color-text-muted)]">
                          Table Header Text Color
                        </label>
                        <div className="flex gap-2 items-center">
                          <input
                            type="color"
                            value={pdfTableTextColor}
                            onChange={(e) => setPdfTableTextColor(e.target.value)}
                            className="w-10 h-10 border border-[var(--color-border)] rounded-md cursor-pointer bg-transparent"
                          />
                          <input
                            type="text"
                            value={pdfTableTextColor}
                            onChange={(e) => setPdfTableTextColor(e.target.value)}
                            className="flex-1 premium-input font-mono text-xs uppercase font-bold"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Real-time PDF Live Preview Mockup */}
                  <div className="lg:col-span-5 flex flex-col gap-3">
                    <span className="block text-xs uppercase tracking-wider text-center">Interactive Brand Mockup</span>
                    <div className="border border-[var(--color-border)] rounded-lg overflow-hidden bg-white text-left p-4 shadow-md text-slate-800">
                      {/* Document Header preview */}
                      <div className="flex justify-between items-center pb-3 border-b border-slate-200 mb-4">
                        <div>
                          <div className="text-xs font-black tracking-wider text-slate-800 uppercase">QUOTATION</div>
                          <div className="text-[8px] font-mono text-slate-400 mt-0.5">QT-2026-0001</div>
                        </div>
                        <div className="text-[10px] font-black text-slate-500">YOUR LOGO</div>
                      </div>

                      {/* Customer info placeholder */}
                      <div className="border border-slate-200 rounded p-2 mb-4 text-[7px] text-slate-400">
                        <div className="font-bold text-slate-600 mb-0.5 uppercase">CUSTOMER CO-ORDINATES</div>
                        <div>ABDULAZIZ AL-JABR TRADING CO.</div>
                        <div>RIYADH, SAUDI ARABIA</div>
                      </div>

                      {/* Product table header mockup using ACTUAL dynamic values */}
                      <div
                        className="rounded overflow-hidden text-[8px] font-bold py-1.5 px-3 flex justify-between items-center transition-all duration-300"
                        style={{
                          background: pdfHeaderBgType === 'gradient'
                            ? `linear-gradient(90deg, ${pdfHeaderBgColorStart}, ${pdfHeaderBgColorEnd})`
                            : pdfTableBgColor,
                          color: pdfTableTextColor
                        }}
                      >
                        <div>ITEM & DESCRIPTION</div>
                        <div className="flex gap-4">
                          <span>QTY</span>
                          <span>TOTAL</span>
                        </div>
                      </div>

                      {/* Table content mockup */}
                      <div className="divide-y divide-slate-100 mb-4 text-[7px] text-slate-500">
                        <div className="py-1.5 px-3 flex justify-between">
                          <span>01. Supply and Deployment of CCTV Systems</span>
                          <span className="font-bold text-slate-800 font-mono">15,000.00 SAR</span>
                        </div>
                        <div className="py-1.5 px-3 flex justify-between bg-slate-50">
                          <span>02. Advanced Firewalls & Gateway Protection</span>
                          <span className="font-bold text-slate-800 font-mono">8,500.00 SAR</span>
                        </div>
                      </div>

                      {/* Totals Box mockup */}
                      <div className="flex justify-end">
                        <div className="w-28 border border-slate-200 rounded text-[7px] font-semibold text-slate-600">
                          <div className="flex justify-between px-2 py-1 border-b border-slate-100">
                            <span>Subtotal</span>
                            <span className="font-mono">23,500.00</span>
                          </div>
                          <div className="flex justify-between px-2 py-1 border-b border-slate-100">
                            <span>VAT (15%)</span>
                            <span className="font-mono">3,525.00</span>
                          </div>
                          <div
                            className="flex justify-between px-2 py-1.5 text-white transition-all duration-300"
                            style={{
                              background: pdfHeaderBgType === 'gradient'
                                ? `linear-gradient(90deg, ${pdfHeaderBgColorStart}, ${pdfHeaderBgColorEnd})`
                                : pdfTableBgColor,
                              color: pdfTableTextColor
                            }}
                          >
                            <span className="font-bold">TOTAL</span>
                            <span className="font-black font-mono">27,025.00</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Save Branding styles button */}
                <div className="flex justify-end border-t border-[var(--color-border)] pt-4 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      updateCompany({
                        pdfHeaderBgType,
                        pdfHeaderBgColorStart,
                        pdfHeaderBgColorEnd,
                        pdfHeaderTextColor,
                        pdfTableBgColor,
                        pdfTableTextColor
                      });
                      alert('PDF Document branding styles updated successfully!');
                    }}
                    className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-semibold py-2 px-4 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Save className="w-4 h-4" /> Save Document Styles / حفظ المظهر
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'maintenance' && <DatabaseBackupDB />}

          {activeSubTab === 'logs' && (
            <div className="flex flex-col gap-6">
              {/* Remote Update Card */}
              <div className="premium-card p-6 flex flex-col gap-6">
                <div className="border-b border-[var(--color-divider)]/30 pb-4 flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-bold text-[var(--color-text)]">Remote App Update</h3>
                    <p className="text-xs text-[var(--color-text-muted)]">Check for and apply updates directly from the GitHub repository.</p>
                  </div>
                  <Terminal className="w-5 h-5 text-[var(--color-text-muted)]" />
                </div>

                <div className="text-xs font-semibold text-[var(--color-text-muted)] flex flex-col gap-4">
                  <div className="flex items-center justify-between bg-[var(--color-surface-offset)]/40 p-4 rounded-xl border border-[var(--color-border)]">
                    <div>
                      <span className="block text-[var(--color-text)] font-bold mb-0.5">GitHub Sync Status</span>
                      <span className="text-[10px]">Pulls updates from origin main branch.</span>
                    </div>
                    <button
                      type="button"
                      disabled={updateStatus === 'loading'}
                      onClick={handleRemoteUpdate}
                      className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-bold py-2.5 px-4 rounded-lg flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
                    >
                      {updateStatus === 'loading' ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Updating...</span>
                        </>
                      ) : (
                        <>
                          <Terminal className="w-3.5 h-3.5" />
                          <span>Pull & Apply Update</span>
                        </>
                      )}
                    </button>
                  </div>

                  {updateOutput && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Console Output:</span>
                      <pre className="bg-slate-950 text-slate-200 font-mono text-[10px] p-4 rounded-xl border border-slate-800 overflow-x-auto whitespace-pre-wrap max-h-48">
                        {updateOutput}
                      </pre>
                    </div>
                  )}
                </div>
              </div>

              {/* Detailed Logging Control Card */}
              <div className="premium-card p-6 flex flex-col gap-6">
                <div className="border-b border-[var(--color-divider)]/30 pb-4 flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-bold text-[var(--color-text)]">System Event Logs</h3>
                    <p className="text-xs text-[var(--color-text-muted)]">Audit logging for errors and user activity.</p>
                  </div>
                  <button
                    onClick={handleClearLogs}
                    disabled={systemLogs.length === 0}
                    className="text-red-500 hover:text-red-400 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Clear All Logs
                  </button>
                </div>

                {/* Logging Toggle */}
                <div className="flex items-center justify-between p-4 bg-[var(--color-surface-offset)]/40 border border-[var(--color-border)] rounded-xl">
                  <div>
                    <span className="block text-xs font-bold text-[var(--color-text)] mb-0.5">Enable Detailed Activity Logs</span>
                    <p className="text-[10px] text-[var(--color-text-muted)]">Log operations like creations, status changes, and logins. (Critical errors are always logged)</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={detailedLogsEnabled}
                      onChange={(e) => handleToggleLogs(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
                  </label>
                </div>

                {/* Log Search / Filter bar */}
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="Search logs by message or user..."
                    value={logSearchQuery}
                    onChange={(e) => setLogSearchQuery(e.target.value)}
                    className="flex-1 premium-input text-xs font-semibold"
                  />
                  <select
                    value={logTypeFilter}
                    onChange={(e: any) => setLogTypeFilter(e.target.value)}
                    className="premium-input text-xs font-bold bg-transparent w-36"
                  >
                    <option value="all">All Levels</option>
                    <option value="info">Info</option>
                    <option value="warn">Warn</option>
                    <option value="error">Error</option>
                  </select>
                </div>

                {/* Logs Viewer list */}
                <div className="border border-[var(--color-border)] rounded-xl overflow-hidden bg-[var(--color-surface)]/20">
                  <div className="max-h-[300px] overflow-y-auto divide-y divide-[var(--color-border)]">
                    {logsLoading ? (
                      <div className="p-8 text-center text-xs text-[var(--color-text-muted)] flex flex-col items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin text-[var(--color-primary)]" />
                        <span>Loading system audit trail...</span>
                      </div>
                    ) : systemLogs.length === 0 ? (
                      <div className="p-8 text-center text-xs text-[var(--color-text-muted)]">
                        No system logs found.
                      </div>
                    ) : (
                      systemLogs
                        .filter(log => {
                          const matchesType = logTypeFilter === 'all' || log.type === logTypeFilter;
                          const matchesSearch = !logSearchQuery || 
                            log.message.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
                            (log.username && log.username.toLowerCase().includes(logSearchQuery.toLowerCase()));
                          return matchesType && matchesSearch;
                        })
                        .map((log) => {
                          const dateStr = new Date(log.timestamp).toLocaleString();
                          const hasDetails = !!log.details;
                          
                          return (
                            <div key={log.id} className="p-3 text-xs flex flex-col gap-2 hover:bg-[var(--color-surface-offset)]/25 transition-all text-left">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                    log.type === 'error' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                                    log.type === 'warn' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                                    'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                                  }`}>
                                    {log.type}
                                  </span>
                                  <span className="font-semibold text-[var(--color-text)]">{log.message}</span>
                                </div>
                                <span className="text-[10px] text-[var(--color-text-muted)] font-mono">{dateStr}</span>
                              </div>

                              <div className="flex items-center justify-between text-[10px] text-[var(--color-text-muted)]">
                                <div>
                                  {log.username ? (
                                    <span>Triggered by: <strong className="text-[var(--color-text)]">{log.username}</strong></span>
                                  ) : (
                                    <span>System Process</span>
                                  )}
                                </div>
                                {hasDetails && (
                                  <button
                                    onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)}
                                    className="text-[var(--color-primary)] hover:underline font-bold cursor-pointer"
                                  >
                                    {selectedLog?.id === log.id ? 'Hide Details' : 'View Details'}
                                  </button>
                                )}
                              </div>

                              {selectedLog?.id === log.id && (
                                <pre className="bg-slate-950 text-slate-300 font-mono text-[9px] p-3 rounded-lg border border-slate-800 overflow-x-auto whitespace-pre-wrap max-h-40 text-left">
                                  {log.details}
                                </pre>
                              )}
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default Settings;
