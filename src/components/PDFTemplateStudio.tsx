import React, { useEffect, useMemo, useRef, useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import QRCode from 'qrcode';
import {
  Palette, Layout as LayoutIcon, Columns, Type, Droplets, FileText, Save, RotateCcw, Eye, EyeOff,
  ChevronUp, ChevronDown, Plus, Trash2, Edit2, Lock, Download, Upload, Copy, Loader2, Check, AlertTriangle, ListPlus
} from 'lucide-react';
import { useERPStore } from '../store';
import { QuotePdfDocument, registerPdfFonts } from '../pdf/quote-document';
import {
  DEFAULT_PDF_TEMPLATE, PDF_PRESETS, PDF_FONT_OPTIONS, applyPreset, resolveTemplate, sectionsFor, sampleDocument, safeColor,
  type PdfDocType
} from '../pdf/template';
import type { PDFTemplateConfig, PDFSectionItem, PDFSectionStyle, CustomFieldDefinition } from '../types';

type Tab = 'design' | 'layout' | 'table' | 'fields';

const inputCls = 'w-full p-2 rounded-lg bg-[var(--color-surface-offset)] border border-[var(--color-border)] text-xs font-semibold text-[var(--color-text)]';
const labelCls = 'text-[11px] font-bold text-[var(--color-text)] block mb-1';

const slug = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);

// ── Live preview: renders the REAL PDF document with sample data ───────────────
const LivePreview: React.FC<{ template: PDFTemplateConfig; docType: PdfDocType }> = ({ template, docType }) => {
  const { company, token } = useERPStore();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [logo, setLogo] = useState<string | null>(null);
  const [footer, setFooter] = useState<string | null>(null);
  const lastUrl = useRef<string | null>(null);

  useEffect(() => {
    registerPdfFonts('/fonts');
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    fetch('/api/settings/logo', { headers }).then((r) => r.json()).then((d) => setLogo(d?.value || null)).catch(() => {});
    fetch('/api/settings/footerImage', { headers }).then((r) => r.json()).then((d) => setFooter(d?.value || null)).catch(() => {});
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    const timer = setTimeout(async () => {
      try {
        const doc: any = sampleDocument(docType);
        if (docType === 'invoice') {
          doc.zatcaQrCodeImage = await QRCode.toDataURL('SAMPLE-ZATCA-TLV', { margin: 1 });
        }
        const addr = company.address ? [company.address.street, company.address.district, company.address.city].filter(Boolean).join(', ') : null;
        const settings = {
          companyName: company.name || 'Your Company',
          email: company.email || null,
          phone: company.phone || null,
          address: addr,
          logoUrl: logo || company.logo || null,
          footerImageUrl: footer || null,
          brandColor: template.colors.primary,
          taxLabel: `VAT ${Number.isFinite(Number(company.defaultTax)) ? Number(company.defaultTax) : 15}%`,
          vatNumber: company.vatNumber || null,
          crNumber: company.crNumber || null,
          bankName: company.bankName || 'Sample Bank',
          bankAccount: company.bankAccount || '000000000000',
          bankIban: company.bankIban || 'SA0000000000000000000000',
          pdfTemplate: template,
        };
        const blob = await pdf(
          <QuotePdfDocument quote={doc} settings={settings} type={docType} amountPaid={docType === 'invoice' ? 2000 : 0} amountDue={docType === 'invoice' ? doc.total - 2000 : 0} />
        ).toBlob();
        if (cancelled) return;
        const next = URL.createObjectURL(blob);
        if (lastUrl.current) URL.revokeObjectURL(lastUrl.current);
        lastUrl.current = next;
        setUrl(next);
        setError(null);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Render failed');
      } finally {
        if (!cancelled) setBusy(false);
      }
    }, 600);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [template, docType, company, logo, footer]);

  useEffect(() => () => { if (lastUrl.current) URL.revokeObjectURL(lastUrl.current); }, []);

  return (
    <div className="relative rounded-xl border border-[var(--color-border)] bg-neutral-100 overflow-hidden h-[78vh] min-h-[520px]">
      {error ? (
        <div className="h-full flex flex-col items-center justify-center gap-2 p-6 text-center text-xs text-[var(--color-error)]">
          <AlertTriangle className="w-6 h-6" /> <b>Preview failed</b>
          <span className="text-[var(--color-text-muted)]">{error}</span>
        </div>
      ) : url ? (
        <iframe title="PDF template preview" src={`${url}#toolbar=0&navpanes=0`} className="w-full h-full border-0 bg-white" />
      ) : (
        <div className="h-full flex items-center justify-center text-xs text-[var(--color-text-muted)]">Rendering preview…</div>
      )}
      {busy && (
        <span className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-bold bg-[var(--color-surface)]/90 border border-[var(--color-border)] rounded-full px-2 py-1">
          <Loader2 className="w-3 h-3 animate-spin" /> Updating
        </span>
      )}
    </div>
  );
};

const ColorField: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
  <div>
    <label className={labelCls}>{label}</label>
    <div className="flex items-center gap-2">
      <input type="color" value={safeColor(value, '#000000')} onChange={(e) => onChange(e.target.value)} className="w-9 h-9 rounded-lg cursor-pointer border border-[var(--color-border)] p-0.5 bg-transparent" aria-label={`${label} picker`} />
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className={`${inputCls} font-mono`} aria-label={label} />
    </div>
  </div>
);

/** Optional colour: shows "inherit" until set, with a clear button. */
const OptColor: React.FC<{ label: string; value?: string; fallback: string; onChange: (v: string | undefined) => void }> = ({ label, value, fallback, onChange }) => (
  <div>
    <label className={labelCls}>{label}</label>
    <div className="flex items-center gap-1.5">
      <input type="color" value={safeColor(value, fallback)} onChange={(e) => onChange(e.target.value)} className="w-8 h-8 rounded-md cursor-pointer border border-[var(--color-border)] p-0.5 bg-transparent" aria-label={`${label} picker`} />
      <span className={`flex-1 text-[10px] font-mono ${value ? 'text-[var(--color-text)]' : 'text-[var(--color-text-faint)]'}`}>{value || 'inherit'}</span>
      {value && <button type="button" onClick={() => onChange(undefined)} className="text-[10px] font-bold text-[var(--color-text-muted)] hover:text-[var(--color-error)] cursor-pointer" aria-label={`Clear ${label}`}>clear</button>}
    </div>
  </div>
);

export const PDFTemplateStudio: React.FC = () => {
  const { company, updateCompany } = useERPStore();

  // Normalise whatever was saved so the editor always works on a complete template.
  const initial = useMemo(() => {
    const raw = company.pdfTemplate;
    const base = { ...DEFAULT_PDF_TEMPLATE, ...(raw || {}) } as PDFTemplateConfig;
    const q = resolveTemplate(raw, 'quotation');
    const i = resolveTemplate(raw, 'invoice');
    return { ...base, colors: q.colors, tableColumns: q.tableColumns, typography: q.typography, watermark: q.watermark, page: q.page, customFields: q.customFields, quoteSections: q.sections, invoiceSections: i.sections } as PDFTemplateConfig;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [template, setTemplate] = useState<PDFTemplateConfig>(initial);
  const [tab, setTab] = useState<Tab>('design');
  const [docType, setDocType] = useState<PdfDocType>('quotation');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [dirty, setDirty] = useState(false);
  const [expanded, setExpanded] = useState<string | null>('customer');
  const [fieldDraft, setFieldDraft] = useState<Partial<CustomFieldDefinition> & { optionsText?: string } | null>(null);
  const [newSection, setNewSection] = useState<{ name: string; nameAr: string; content: string; width: 'full' | 'half' } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const edit = (patch: Partial<PDFTemplateConfig>) => { setTemplate((t) => ({ ...t, ...patch })); setDirty(true); };

  const sectionKey = docType === 'invoice' ? 'invoiceSections' : 'quoteSections';
  const sections: PDFSectionItem[] = useMemo(
    () => [...sectionsFor(template, docType)].sort((a, b) => (a.order || 0) - (b.order || 0)),
    [template, docType]
  );
  const setSections = (list: PDFSectionItem[]) => edit({ [sectionKey]: list.map((s, i) => ({ ...s, order: i + 1 })) } as any);
  const patchSection = (id: string, patch: Partial<PDFSectionItem>) => setSections(sections.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= sections.length) return;
    const next = [...sections];
    [next[idx], next[j]] = [next[j], next[idx]];
    setSections(next);
  };
  const patchStyle = (secId: string, patch: Partial<PDFSectionStyle>) =>
    setSections(sections.map((s) => {
      if (s.id !== secId) return s;
      const next: Record<string, any> = { ...(s.style || {}), ...patch };
      Object.keys(next).forEach((k) => (next[k] === undefined || next[k] === '') && delete next[k]);
      return { ...s, style: Object.keys(next).length ? (next as PDFSectionStyle) : undefined };
    }));
  const toggleField = (secId: string, fieldId: string) =>
    setSections(sections.map((s) => (s.id === secId ? { ...s, fields: s.fields.map((f) => (f.id === fieldId ? { ...f, enabled: !f.enabled } : f)) } : s)));

  const copyLayout = () => {
    const from = docType === 'invoice' ? 'quotation' : 'invoice';
    if (!confirm(`Replace this ${docType} layout with the ${from} layout?`)) return;
    const src = sectionsFor(template, from);
    setSections(JSON.parse(JSON.stringify(src)));
  };

  const addSection = () => {
    if (!newSection?.name.trim()) return;
    const id = `custom_${Date.now()}`;
    setSections([
      ...sections,
      { id, name: newSection.name.trim(), nameAr: newSection.nameAr.trim(), enabled: true, width: newSection.width, order: sections.length + 1, isCustom: true, customTitle: newSection.name.trim(), customTitleAr: newSection.nameAr.trim(), customContent: newSection.content, fields: [] }
    ]);
    setNewSection(null);
    setExpanded(id);
  };

  const saveField = () => {
    if (!fieldDraft?.name?.trim()) return;
    const key = slug(fieldDraft.key || fieldDraft.name);
    if (!key) return;
    const existing = (template.customFields || []).find((f) => f.key === key && f.id !== fieldDraft.id);
    if (existing) { alert('A custom field with this key already exists.'); return; }
    const options = fieldDraft.type === 'select' ? (fieldDraft.optionsText || '').split(',').map((o) => o.trim()).filter(Boolean) : undefined;
    const def: CustomFieldDefinition = {
      id: fieldDraft.id || `cf_${Date.now()}`,
      name: fieldDraft.name.trim(),
      key,
      type: fieldDraft.type || 'text',
      appliesTo: fieldDraft.appliesTo || 'all',
      options,
      sectionId: fieldDraft.sectionId || 'vehicle',
      sectionName: sections.find((s) => s.id === (fieldDraft.sectionId || 'vehicle'))?.name
    };
    const list = template.customFields || [];
    edit({ customFields: list.some((f) => f.id === def.id) ? list.map((f) => (f.id === def.id ? def : f)) : [...list, def] });
    setFieldDraft(null);
  };

  const save = async () => {
    setStatus('saving');
    const ok = await updateCompany({ pdfTemplate: template });
    setStatus(ok ? 'saved' : 'error');
    if (ok) setDirty(false);
    setTimeout(() => setStatus('idle'), 2500);
  };

  const reset = () => {
    if (!confirm('Reset the whole template (design, layout, columns and custom fields) to the factory default?')) return;
    const q = resolveTemplate(DEFAULT_PDF_TEMPLATE, 'quotation');
    setTemplate({ ...DEFAULT_PDF_TEMPLATE, quoteSections: q.sections, invoiceSections: q.sections });
    setDirty(true);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `pdf-template-${slug(company.name || 'company')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importJson = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== 'object' || !parsed.colors) throw new Error('Not a template file');
      const q = resolveTemplate(parsed, 'quotation');
      const i = resolveTemplate(parsed, 'invoice');
      setTemplate({ ...DEFAULT_PDF_TEMPLATE, ...parsed, colors: q.colors, tableColumns: q.tableColumns, typography: q.typography, watermark: q.watermark, page: q.page, customFields: q.customFields, quoteSections: q.sections, invoiceSections: i.sections });
      setDirty(true);
    } catch (e: any) {
      alert(`Import failed: ${e.message}`);
    }
  };

  const TabBtn = ({ id, icon: Icon, label }: { id: Tab; icon: any; label: string }) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${tab === id ? 'bg-[var(--color-surface)] text-[var(--color-primary)] shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
    >
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );

  const col = (key: keyof PDFTemplateConfig['tableColumns'], label: string, locked = false) => (
    <label key={key} className={`flex items-center justify-between gap-2 p-2.5 rounded-lg border border-[var(--color-border)] text-xs font-semibold ${locked ? 'opacity-60' : 'cursor-pointer hover:bg-[var(--color-surface-offset)]'}`}>
      <span>{label}</span>
      <input type="checkbox" disabled={locked} checked={!!template.tableColumns[key]} onChange={(e) => edit({ tableColumns: { ...template.tableColumns, [key]: e.target.checked } })} />
    </label>
  );

  return (
    <div className="text-left space-y-4">
      {/* Header + global actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
        <div>
          <h2 className="text-base font-black text-[var(--color-text)]">Invoice &amp; Quotation Template Studio</h2>
          <p className="text-xs text-[var(--color-text-muted)]">Everything here drives the real PDF (preview, download, email and share). Changes preview live; click Save to apply to all documents.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={exportJson} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--color-border)] text-xs font-bold hover:bg-[var(--color-surface-offset)] cursor-pointer"><Download className="w-3.5 h-3.5" /> Export</button>
          <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--color-border)] text-xs font-bold hover:bg-[var(--color-surface-offset)] cursor-pointer"><Upload className="w-3.5 h-3.5" /> Import</button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = ''; }} />
          <button type="button" onClick={reset} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--color-border)] text-xs font-bold hover:bg-[var(--color-surface-offset)] cursor-pointer"><RotateCcw className="w-3.5 h-3.5" /> Reset</button>
          <button type="button" onClick={save} disabled={status === 'saving' || !dirty} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
            {status === 'saving' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : status === 'saved' ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            {status === 'saved' ? 'Saved' : status === 'error' ? 'Save failed – retry' : dirty ? 'Save template' : 'No changes'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
        {/* ── Controls ─────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--color-surface-offset)] border border-[var(--color-border)]">
              <TabBtn id="design" icon={Palette} label="Design" />
              <TabBtn id="layout" icon={LayoutIcon} label="Layout" />
              <TabBtn id="table" icon={Columns} label="Table" />
              <TabBtn id="fields" icon={ListPlus} label="Custom fields" />
            </div>
            <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--color-surface-offset)] border border-[var(--color-border)]" role="group" aria-label="Document type">
              {(['quotation', 'invoice'] as PdfDocType[]).map((t) => (
                <button key={t} type="button" onClick={() => setDocType(t)} className={`px-3 py-1.5 rounded-md text-xs font-bold cursor-pointer ${docType === t ? 'bg-[var(--color-surface)] text-[var(--color-primary)] shadow-sm' : 'text-[var(--color-text-muted)]'}`}>
                  {t === 'quotation' ? 'Quotation' : 'Invoice'}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] space-y-5">
            {tab === 'design' && (
              <>
                <div>
                  <span className="text-[11px] font-black uppercase tracking-wider block mb-2">Presets</span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {PDF_PRESETS.map((p) => (
                      <button key={p.id} type="button" onClick={() => { setTemplate((t) => applyPreset(t, p.id)); setDirty(true); }}
                        className={`text-left p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${template.preset === p.id ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10' : 'border-[var(--color-border)] hover:bg-[var(--color-surface-offset)]'}`}>
                        <span className="flex gap-1 mb-1.5">
                          {[p.patch.colors.headerBgStart, p.patch.colors.primary, p.patch.colors.zebraRowBg].map((c, i) => <i key={i} style={{ background: c }} className="w-4 h-4 rounded border border-black/10 inline-block" />)}
                        </span>
                        <b className="block">{p.label}</b>
                        <span className="text-[10px] text-[var(--color-text-muted)]">{p.description}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-black uppercase tracking-wider block mb-2">Header style</span>
                  <div className="grid grid-cols-4 gap-2">
                    {(['gradient', 'solid', 'boxed', 'minimal'] as const).map((h) => (
                      <button key={h} type="button" onClick={() => edit({ headerStyle: h })} className={`p-2 rounded-lg border text-xs font-bold capitalize cursor-pointer ${template.headerStyle === h ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]' : 'border-[var(--color-border)]'}`}>{h}</button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <ColorField label="Accent / headings" value={template.colors.primary} onChange={(v) => edit({ colors: { ...template.colors, primary: v } })} />
                  <ColorField label="Box borders" value={template.colors.accentBorder} onChange={(v) => edit({ colors: { ...template.colors, accentBorder: v } })} />
                  <ColorField label="Header start" value={template.colors.headerBgStart} onChange={(v) => edit({ colors: { ...template.colors, headerBgStart: v } })} />
                  <ColorField label="Header end (gradient)" value={template.colors.headerBgEnd} onChange={(v) => edit({ colors: { ...template.colors, headerBgEnd: v } })} />
                  <ColorField label="Header text" value={template.colors.headerText} onChange={(v) => edit({ colors: { ...template.colors, headerText: v } })} />
                  <ColorField label="Table header background" value={template.colors.tableHeaderBg} onChange={(v) => edit({ colors: { ...template.colors, tableHeaderBg: v } })} />
                  <ColorField label="Table header text" value={template.colors.tableHeaderText} onChange={(v) => edit({ colors: { ...template.colors, tableHeaderText: v } })} />
                  <ColorField label="Zebra row / section tint" value={template.colors.zebraRowBg} onChange={(v) => edit({ colors: { ...template.colors, zebraRowBg: v } })} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}><Type className="inline w-3 h-3 mr-1" />Font family</label>
                    <select value={template.typography.fontFamily} onChange={(e) => edit({ typography: { ...template.typography, fontFamily: e.target.value as any } })} className={inputCls}>
                      {PDF_FONT_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-1">{PDF_FONT_OPTIONS.find((f) => f.value === template.typography.fontFamily)?.note}. Arabic text always uses Tajawal.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>Body size ({template.typography.bodyFontSize}pt)</label>
                      <input type="range" min={7} max={12} step={0.5} value={template.typography.bodyFontSize} onChange={(e) => edit({ typography: { ...template.typography, bodyFontSize: Number(e.target.value) } })} className="w-full" />
                    </div>
                    <div>
                      <label className={labelCls}>Title size ({template.typography.titleFontSize}pt)</label>
                      <input type="range" min={14} max={34} step={1} value={template.typography.titleFontSize} onChange={(e) => edit({ typography: { ...template.typography, titleFontSize: Number(e.target.value) } })} className="w-full" />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Page size</label>
                    <select value={template.page.size} onChange={(e) => edit({ page: { ...template.page, size: e.target.value as any } })} className={inputCls}>
                      <option value="A4">A4</option><option value="LETTER">US Letter</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Margins</label>
                    <select value={template.page.margins} onChange={(e) => edit({ page: { ...template.page, margins: e.target.value as any } })} className={inputCls}>
                      <option value="compact">Compact</option><option value="normal">Normal</option><option value="spacious">Spacious</option>
                    </select>
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-[var(--color-border)] space-y-3">
                  <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                    <input type="checkbox" checked={template.watermark.enabled} onChange={(e) => edit({ watermark: { ...template.watermark, enabled: e.target.checked } })} />
                    <Droplets className="w-3.5 h-3.5" /> Always print a watermark
                  </label>
                  {template.watermark.enabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div><label className={labelCls}>Text</label><input className={inputCls} maxLength={40} value={template.watermark.text} onChange={(e) => edit({ watermark: { ...template.watermark, text: e.target.value } })} /></div>
                      <div><label className={labelCls}>Opacity ({Math.round(template.watermark.opacity * 100)}%)</label><input type="range" min={0.02} max={0.4} step={0.01} value={template.watermark.opacity} onChange={(e) => edit({ watermark: { ...template.watermark, opacity: Number(e.target.value) } })} className="w-full" /></div>
                      <div><label className={labelCls}>Angle ({template.watermark.angle}°)</label><input type="range" min={-75} max={75} step={5} value={template.watermark.angle} onChange={(e) => edit({ watermark: { ...template.watermark, angle: Number(e.target.value) } })} className="w-full" /></div>
                    </div>
                  )}
                  <p className="text-[10px] text-[var(--color-text-muted)]">A watermark chosen inside an individual quotation/invoice overrides this one.</p>
                </div>
              </>
            )}

            {tab === 'layout' && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] text-[var(--color-text-muted)]">Editing the <b>{docType}</b> layout. Reorder with the arrows, show/hide sections and fields, and set half-width sections to sit side by side.</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={copyLayout} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--color-border)] text-[11px] font-bold hover:bg-[var(--color-surface-offset)] cursor-pointer"><Copy className="w-3 h-3" /> Copy from {docType === 'invoice' ? 'quotation' : 'invoice'}</button>
                    <button type="button" onClick={() => setNewSection({ name: '', nameAr: '', content: '', width: 'full' })} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--color-primary)] text-white text-[11px] font-bold cursor-pointer"><Plus className="w-3 h-3" /> Add section</button>
                  </div>
                </div>

                <ul className="space-y-2">
                  {sections.map((s, idx) => (
                    <li key={s.id} className={`rounded-lg border ${s.enabled ? 'border-[var(--color-border)]' : 'border-dashed border-[var(--color-border)] opacity-70'}`}>
                      <div className="flex items-center gap-2 p-2.5">
                        <div className="flex flex-col">
                          <button type="button" aria-label={`Move ${s.name} up`} disabled={idx === 0} onClick={() => move(idx, -1)} className="p-0.5 disabled:opacity-30 cursor-pointer"><ChevronUp className="w-3.5 h-3.5" /></button>
                          <button type="button" aria-label={`Move ${s.name} down`} disabled={idx === sections.length - 1} onClick={() => move(idx, 1)} className="p-0.5 disabled:opacity-30 cursor-pointer"><ChevronDown className="w-3.5 h-3.5" /></button>
                        </div>
                        <button type="button" onClick={() => setExpanded(expanded === s.id ? null : s.id)} className="flex-1 text-left cursor-pointer">
                          <span className="text-xs font-bold block">{s.name}</span>
                          <span className="text-[10px] text-[var(--color-text-muted)]">{s.nameAr}{s.isCustom ? ' · custom' : ''}{s.style ? ' · styled' : ''}</span>
                        </button>
                        {s.id !== 'header' && s.id !== 'line_items' && s.id !== 'footer' && (
                          <button type="button" onClick={() => patchSection(s.id, { width: s.width === 'half' ? 'full' : 'half' })} className="px-2 py-1 rounded-md border border-[var(--color-border)] text-[10px] font-bold cursor-pointer" title="Half-width sections sit side by side with the next half-width section">
                            {s.width === 'half' ? '½ width' : 'Full width'}
                          </button>
                        )}
                        <button type="button" aria-label={s.enabled ? `Hide ${s.name}` : `Show ${s.name}`} onClick={() => patchSection(s.id, { enabled: !s.enabled })} className="p-1.5 rounded-md hover:bg-[var(--color-surface-offset)] cursor-pointer">
                          {s.enabled ? <Eye className="w-4 h-4 text-[var(--color-primary)]" /> : <EyeOff className="w-4 h-4 text-[var(--color-text-faint)]" />}
                        </button>
                        {s.isCustom && (
                          <button type="button" aria-label={`Delete ${s.name}`} onClick={() => { if (confirm(`Delete section "${s.name}"?`)) setSections(sections.filter((x) => x.id !== s.id)); }} className="p-1.5 rounded-md hover:bg-[var(--color-error)]/10 text-[var(--color-error)] cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                        )}
                      </div>

                      {expanded === s.id && (
                        <div className="px-3 pb-3 pt-1 border-t border-[var(--color-divider)] space-y-2">
                          {s.isCustom && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div><label className={labelCls}>Title (EN)</label><input className={inputCls} value={s.customTitle || ''} onChange={(e) => patchSection(s.id, { customTitle: e.target.value, name: e.target.value || s.name })} /></div>
                              <div><label className={labelCls}>Title (AR)</label><input dir="rtl" className={inputCls} value={s.customTitleAr || ''} onChange={(e) => patchSection(s.id, { customTitleAr: e.target.value, nameAr: e.target.value })} /></div>
                              <div className="sm:col-span-2"><label className={labelCls}>Content (one paragraph per line)</label><textarea rows={4} className={inputCls} value={s.customContent || ''} onChange={(e) => patchSection(s.id, { customContent: e.target.value })} /></div>
                            </div>
                          )}
                          {s.fields.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {s.fields.map((f) => (
                                <button key={f.id} type="button" disabled={f.isLocked} onClick={() => toggleField(s.id, f.id)}
                                  className={`flex items-center justify-between gap-2 p-2 rounded-md border text-[11px] font-semibold text-left ${f.enabled ? 'border-[var(--color-border)]' : 'border-dashed opacity-60'} ${f.isLocked ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-[var(--color-surface-offset)]'}`}>
                                  <span>{f.label} <span className="text-[var(--color-text-faint)]">{f.labelAr}</span></span>
                                  {f.isLocked ? <Lock className="w-3 h-3" /> : f.enabled ? <Eye className="w-3.5 h-3.5 text-[var(--color-primary)]" /> : <EyeOff className="w-3.5 h-3.5" />}
                                </button>
                              ))}
                            </div>
                          )}
                          {/* Per-section appearance */}
                          <div className="mt-2 p-2.5 rounded-lg bg-[var(--color-surface-offset)]/60 border border-[var(--color-divider)] space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black uppercase tracking-wider">Appearance of this section</span>
                              {s.style && <button type="button" onClick={() => patchSection(s.id, { style: undefined })} className="text-[10px] font-bold text-[var(--color-error)] cursor-pointer">Reset style</button>}
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              <OptColor label="Block background" value={s.style?.bg} fallback="#ffffff" onChange={(v) => patchStyle(s.id, { bg: v })} />
                              <OptColor label="Text colour" value={s.style?.text} fallback="#18181b" onChange={(v) => patchStyle(s.id, { text: v })} />
                              <OptColor label="Heading colour" value={s.style?.titleColor} fallback={template.colors.primary} onChange={(v) => patchStyle(s.id, { titleColor: v })} />
                              <OptColor label={s.id === 'line_items' ? 'Table header bg' : s.id === 'summary' ? 'Total highlight' : 'Heading bar bg'} value={s.style?.headBg} fallback={template.colors.zebraRowBg} onChange={(v) => patchStyle(s.id, { headBg: v })} />
                              <OptColor label="Border colour" value={s.style?.border} fallback={template.colors.accentBorder} onChange={(v) => patchStyle(s.id, { border: v })} />
                              {s.id === 'line_items' && <OptColor label="Alternate rows" value={s.style?.altBg} fallback={template.colors.zebraRowBg} onChange={(v) => patchStyle(s.id, { altBg: v })} />}
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className={labelCls}>Font</label>
                                <select className={inputCls} value={s.style?.fontFamily || ''} onChange={(e) => patchStyle(s.id, { fontFamily: (e.target.value || undefined) as any })}>
                                  <option value="">Inherit</option>
                                  {PDF_FONT_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className={labelCls}>Font size {s.style?.fontSize ? `(${s.style.fontSize}pt)` : '(inherit)'}</label>
                                <input type="range" min={6} max={14} step={0.5} value={s.style?.fontSize ?? template.typography.bodyFontSize} onChange={(e) => patchStyle(s.id, { fontSize: Number(e.target.value) })} className="w-full" />
                              </div>
                              <div>
                                <label className={labelCls}>Corners {s.style?.radius !== undefined ? `(${s.style.radius}pt)` : '(default)'}</label>
                                <input type="range" min={0} max={12} step={1} value={s.style?.radius ?? 2} onChange={(e) => patchStyle(s.id, { radius: Number(e.target.value) })} className="w-full" />
                              </div>
                            </div>
                          </div>
                          {(template.customFields || []).filter((cf) => cf.sectionId === s.id).length > 0 && (
                            <p className="text-[10px] text-[var(--color-text-muted)]">Custom fields printed here: {(template.customFields || []).filter((cf) => cf.sectionId === s.id).map((cf) => cf.name).join(', ')}</p>
                          )}
                          {!s.isCustom && s.fields.length === 0 && (template.customFields || []).filter((cf) => cf.sectionId === s.id).length === 0 && (
                            <p className="text-[10px] text-[var(--color-text-muted)]">This section prints the custom fields assigned to it (see the Custom fields tab).</p>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {tab === 'table' && (
              <>
                <p className="text-[11px] text-[var(--color-text-muted)]">Choose the columns of the line-items table. Item code only shows when at least one line has a product code.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {col('showIndex', '# (serial number)')}
                  {col('showItemCode', 'Item code')}
                  {col('showDescEn', 'Description (English)')}
                  {col('showDescAr', 'Description (Arabic)')}
                  {col('showQty', 'Quantity')}
                  {col('showUnit', 'Unit')}
                  {col('showUnitPrice', 'Unit price')}
                  {col('showDiscount', 'Discount %')}
                  {col('showTax', 'VAT % (total includes VAT)')}
                  {col('showTotal', 'Line total')}
                </div>
              </>
            )}

            {tab === 'fields' && (
              <>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-[var(--color-text-muted)]">Custom fields appear as inputs in the quotation/invoice editor and are printed inside the section you assign them to.</p>
                  <button type="button" onClick={() => setFieldDraft({ type: 'text', appliesTo: 'all', sectionId: 'vehicle', name: '', key: '' })} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--color-primary)] text-white text-[11px] font-bold cursor-pointer shrink-0"><Plus className="w-3 h-3" /> New field</button>
                </div>
                {(template.customFields || []).length === 0 ? (
                  <p className="text-xs italic text-[var(--color-text-muted)] py-4 text-center">No custom fields yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {(template.customFields || []).map((cf) => (
                      <li key={cf.id} className="flex items-center gap-2 p-2.5 rounded-lg border border-[var(--color-border)] text-xs">
                        <div className="flex-1">
                          <b>{cf.name}</b> <code className="text-[10px] text-[var(--color-text-faint)]">{cf.key}</code>
                          <div className="text-[10px] text-[var(--color-text-muted)]">{cf.type} · {cf.appliesTo === 'all' ? 'quotes & invoices' : `${cf.appliesTo}s only`} · prints in “{sections.find((s) => s.id === cf.sectionId)?.name || cf.sectionName || cf.sectionId}”</div>
                        </div>
                        <button type="button" aria-label={`Edit ${cf.name}`} onClick={() => setFieldDraft({ ...cf, optionsText: (cf.options || []).join(', ') })} className="p-1.5 rounded-md hover:bg-[var(--color-surface-offset)] cursor-pointer"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button type="button" aria-label={`Delete ${cf.name}`} onClick={() => { if (confirm(`Delete custom field "${cf.name}"? Stored values on documents are kept but no longer printed.`)) edit({ customFields: (template.customFields || []).filter((f) => f.id !== cf.id) }); }} className="p-1.5 rounded-md hover:bg-[var(--color-error)]/10 text-[var(--color-error)] cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Live preview ─────────────────────────────────────────────── */}
        <div className="space-y-2 xl:sticky xl:top-4 self-start">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--color-text-muted)]"><FileText className="w-3.5 h-3.5" /> Live preview – real PDF, sample data</div>
          <LivePreview template={template} docType={docType} />
        </div>
      </div>

      {/* Custom field modal */}
      {fieldDraft && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-label="Custom field">
          <div className="w-full max-w-md rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5 space-y-3">
            <h3 className="text-sm font-black">{fieldDraft.id ? 'Edit custom field' : 'New custom field'}</h3>
            <div><label className={labelCls}>Name</label><input autoFocus className={inputCls} value={fieldDraft.name || ''} onChange={(e) => setFieldDraft({ ...fieldDraft, name: e.target.value })} placeholder="e.g. Purchase order number" /></div>
            <div><label className={labelCls}>Key (internal)</label><input className={`${inputCls} font-mono`} value={fieldDraft.key || ''} onChange={(e) => setFieldDraft({ ...fieldDraft, key: e.target.value })} placeholder={slug(fieldDraft.name || '') || 'auto from name'} disabled={!!fieldDraft.id} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className={labelCls}>Type</label>
                <select className={inputCls} value={fieldDraft.type} onChange={(e) => setFieldDraft({ ...fieldDraft, type: e.target.value as any })}>
                  <option value="text">Text</option><option value="textarea">Long text</option><option value="number">Number</option><option value="date">Date</option><option value="select">Dropdown</option><option value="checkbox">Checkbox</option>
                </select></div>
              <div><label className={labelCls}>Applies to</label>
                <select className={inputCls} value={fieldDraft.appliesTo} onChange={(e) => setFieldDraft({ ...fieldDraft, appliesTo: e.target.value as any })}>
                  <option value="all">Quotes &amp; invoices</option><option value="quotation">Quotations only</option><option value="invoice">Invoices only</option>
                </select></div>
            </div>
            {fieldDraft.type === 'select' && <div><label className={labelCls}>Options (comma separated)</label><input className={inputCls} value={fieldDraft.optionsText || ''} onChange={(e) => setFieldDraft({ ...fieldDraft, optionsText: e.target.value })} /></div>}
            <div><label className={labelCls}>Print in section</label>
              <select className={inputCls} value={fieldDraft.sectionId} onChange={(e) => setFieldDraft({ ...fieldDraft, sectionId: e.target.value })}>
                {sections.filter((s) => !['line_items', 'footer', 'signatures', 'zatca_qr', 'summary', 'payment_terms', 'bank_details'].includes(s.id)).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select></div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setFieldDraft(null)} className="px-4 py-2 rounded-lg text-xs font-bold border border-[var(--color-border)] cursor-pointer">Cancel</button>
              <button type="button" onClick={saveField} className="px-4 py-2 rounded-lg text-xs font-bold bg-[var(--color-primary)] text-white cursor-pointer">Save field</button>
            </div>
          </div>
        </div>
      )}

      {/* Add section modal */}
      {newSection && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-label="Add section">
          <div className="w-full max-w-md rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5 space-y-3">
            <h3 className="text-sm font-black">Add a custom section</h3>
            <div><label className={labelCls}>Title (EN)</label><input autoFocus className={inputCls} value={newSection.name} onChange={(e) => setNewSection({ ...newSection, name: e.target.value })} placeholder="Scope of work" /></div>
            <div><label className={labelCls}>Title (AR)</label><input dir="rtl" className={inputCls} value={newSection.nameAr} onChange={(e) => setNewSection({ ...newSection, nameAr: e.target.value })} placeholder="نطاق العمل" /></div>
            <div><label className={labelCls}>Content</label><textarea rows={4} className={inputCls} value={newSection.content} onChange={(e) => setNewSection({ ...newSection, content: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              {(['full', 'half'] as const).map((w) => (
                <button key={w} type="button" onClick={() => setNewSection({ ...newSection, width: w })} className={`p-2 rounded-lg border text-xs font-bold cursor-pointer ${newSection.width === w ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]' : 'border-[var(--color-border)]'}`}>{w === 'full' ? 'Full width' : 'Half width'}</button>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setNewSection(null)} className="px-4 py-2 rounded-lg text-xs font-bold border border-[var(--color-border)] cursor-pointer">Cancel</button>
              <button type="button" onClick={addSection} disabled={!newSection.name.trim()} className="px-4 py-2 rounded-lg text-xs font-bold bg-[var(--color-primary)] text-white cursor-pointer disabled:opacity-50">Add section</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PDFTemplateStudio;
