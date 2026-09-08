import React, { useState } from 'react';
import { useERPStore, DEFAULT_PDF_TEMPLATE } from '../store';
import {
  PDFTemplateConfig,
  PDFSectionItem,
  PDFSectionField,
  CustomFieldDefinition
} from '../types';
import {
  Sparkles,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Palette,
  Layout,
  Type,
  ShieldCheck,
  FileText,
  Save,
  RotateCcw,
  Sliders,
  Check,
  QrCode,
  Plus,
  Trash2,
  Edit2,
  Lock,
  Columns,
  Maximize2,
  Receipt,
  FileSpreadsheet,
  X,
  Layers,
  Settings as SettingsIcon
} from 'lucide-react';

export const PDFTemplateStudio: React.FC = () => {
  const { company, updateCompany } = useERPStore();
  const currentTemplate: PDFTemplateConfig = company.pdfTemplate || DEFAULT_PDF_TEMPLATE;

  const [template, setTemplate] = useState<PDFTemplateConfig>({
    ...DEFAULT_PDF_TEMPLATE,
    ...currentTemplate,
    sections: currentTemplate.sections || DEFAULT_PDF_TEMPLATE.sections,
    customFields: currentTemplate.customFields || DEFAULT_PDF_TEMPLATE.customFields || [],
    colors: { ...DEFAULT_PDF_TEMPLATE.colors, ...(currentTemplate.colors || {}) },
    tableColumns: { ...DEFAULT_PDF_TEMPLATE.tableColumns, ...(currentTemplate.tableColumns || {}) },
    typography: { ...DEFAULT_PDF_TEMPLATE.typography, ...(currentTemplate.typography || {}) },
    watermark: { ...DEFAULT_PDF_TEMPLATE.watermark, ...(currentTemplate.watermark || {}) },
    page: { ...DEFAULT_PDF_TEMPLATE.page, ...(currentTemplate.page || {}) }
  });

  // Top-level Navigation: General | Layout | Custom Fields
  const [topTab, setTopTab] = useState<'general' | 'layout' | 'custom_fields'>('layout');
  
  // Document Type Mode in Layout: Invoice vs Quote
  const [docMode, setDocMode] = useState<'invoice' | 'quote'>('invoice');

  // Expanded state for accordion section cards
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    header: true,
    customer: true,
    vehicle: true,
    line_items: false,
    summary: false,
    zatca_qr: false,
    payment_terms: false,
    signatures: false,
    footer: false
  });

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [draggedSectionIndex, setDraggedSectionIndex] = useState<number | null>(null);
  const [draggedFieldIndex, setDraggedFieldIndex] = useState<{ sectionId: string; index: number } | null>(null);

  // Custom Field Modals & Filters
  const [customFieldFilter, setCustomFieldFilter] = useState<'all' | 'quotation' | 'invoice'>('all');
  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<CustomFieldDefinition | null>(null);
  const [fieldNameInput, setFieldNameInput] = useState('');
  const [fieldKeyInput, setFieldKeyInput] = useState('');
  const [fieldTypeInput, setFieldTypeInput] = useState<'text' | 'number' | 'select' | 'checkbox' | 'date' | 'textarea'>('text');
  const [fieldAppliesToInput, setFieldAppliesToInput] = useState<'all' | 'quotation' | 'invoice'>('all');
  const [fieldOptionsInput, setFieldOptionsInput] = useState('');
  const [fieldTargetSection, setFieldTargetSection] = useState('vehicle');

  // Section Add Modal
  const [isAddSectionModalOpen, setIsAddSectionModalOpen] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [newSectionNameAr, setNewSectionNameAr] = useState('');
  const [newSectionWidth, setNewSectionWidth] = useState<'full' | 'half'>('full');

  // Accordion Toggle
  const toggleAccordion = (sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  // Section Width Toggle ('full' <-> 'half')
  const toggleSectionWidth = (sectionId: string) => {
    const newSections = template.sections.map((sec) => {
      if (sec.id === sectionId) {
        return { ...sec, width: sec.width === 'half' ? ('full' as const) : ('half' as const) };
      }
      return sec;
    });
    setTemplate({ ...template, sections: newSections });
  };

  // Section Visibility Toggle
  const toggleSectionVisibility = (sectionId: string) => {
    const newSections = template.sections.map((sec) => {
      if (sec.id === sectionId) {
        return { ...sec, enabled: !sec.enabled };
      }
      return sec;
    });
    setTemplate({ ...template, sections: newSections });
  };

  // Field Visibility Toggle inside Section
  const toggleFieldVisibility = (sectionId: string, fieldId: string) => {
    const newSections = template.sections.map((sec) => {
      if (sec.id === sectionId && sec.fields) {
        const newFields = sec.fields.map((f) => (f.id === fieldId ? { ...f, enabled: !f.enabled } : f));
        return { ...sec, fields: newFields };
      }
      return sec;
    });
    setTemplate({ ...template, sections: newSections });
  };

  // Section Drag and Drop Handlers
  const handleSectionDragStart = (index: number) => {
    setDraggedSectionIndex(index);
  };

  const handleSectionDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedSectionIndex === null || draggedSectionIndex === index) return;

    const newSections = [...template.sections];
    const draggedItem = newSections[draggedSectionIndex];
    newSections.splice(draggedSectionIndex, 1);
    newSections.splice(index, 0, draggedItem);

    newSections.forEach((sec, idx) => {
      sec.order = idx + 1;
    });

    setDraggedSectionIndex(index);
    setTemplate({ ...template, sections: newSections });
  };

  const handleSectionDragEnd = () => {
    setDraggedSectionIndex(null);
  };

  // Field Drag and Drop Handlers inside a Section
  const handleFieldDragStart = (sectionId: string, index: number) => {
    setDraggedFieldIndex({ sectionId, index });
  };

  const handleFieldDragOver = (e: React.DragEvent, sectionId: string, index: number) => {
    e.preventDefault();
    if (!draggedFieldIndex || draggedFieldIndex.sectionId !== sectionId || draggedFieldIndex.index === index) return;

    const newSections = template.sections.map((sec) => {
      if (sec.id === sectionId && sec.fields) {
        const newFields = [...sec.fields];
        const draggedField = newFields[draggedFieldIndex.index];
        newFields.splice(draggedFieldIndex.index, 1);
        newFields.splice(index, 0, draggedField);
        newFields.forEach((f, idx) => {
          f.order = idx + 1;
        });
        return { ...sec, fields: newFields };
      }
      return sec;
    });

    setDraggedFieldIndex({ sectionId, index });
    setTemplate({ ...template, sections: newSections });
  };

  const handleFieldDragEnd = () => {
    setDraggedFieldIndex(null);
  };

  // Add a new section
  const handleCreateSection = () => {
    if (!newSectionName.trim()) return;
    const newId = `sec_${Date.now()}`;
    const newSec: PDFSectionItem = {
      id: newId,
      name: newSectionName.trim(),
      nameAr: newSectionNameAr.trim() || newSectionName.trim(),
      enabled: true,
      width: newSectionWidth,
      order: template.sections.length + 1,
      isCustom: true,
      fields: [
        {
          id: `f_${Date.now()}`,
          key: `custom_${Date.now()}`,
          label: `${newSectionName.trim()} Details`,
          labelAr: 'التفاصيل',
          enabled: true,
          order: 1
        }
      ]
    };

    setTemplate({
      ...template,
      sections: [...template.sections, newSec]
    });
    setExpandedSections((prev) => ({ ...prev, [newId]: true }));
    setNewSectionName('');
    setNewSectionNameAr('');
    setIsAddSectionModalOpen(false);
  };

  // Delete a section
  const handleDeleteSection = (sectionId: string) => {
    const newSections = template.sections.filter((s) => s.id !== sectionId);
    newSections.forEach((s, idx) => {
      s.order = idx + 1;
    });
    setTemplate({ ...template, sections: newSections });
  };

  // Add field to a section
  const handleAddFieldToSection = (sectionId: string) => {
    const fieldLabel = prompt('Enter Field Name (e.g. Project Code, Technician Name):');
    if (!fieldLabel) return;

    const newField: PDFSectionField = {
      id: `f_${Date.now()}`,
      key: fieldLabel.toLowerCase().replace(/[^a-z0-9]/g, '_'),
      label: fieldLabel,
      labelAr: fieldLabel,
      enabled: true,
      isCustom: true,
      order: 99
    };

    const newSections = template.sections.map((sec) => {
      if (sec.id === sectionId) {
        return { ...sec, fields: [...(sec.fields || []), newField] };
      }
      return sec;
    });

    setTemplate({ ...template, sections: newSections });
  };

  // Custom Fields Management
  const handleOpenFieldModal = (field?: CustomFieldDefinition) => {
    if (field) {
      setEditingField(field);
      setFieldNameInput(field.name);
      setFieldKeyInput(field.key);
      setFieldTypeInput(field.type);
      setFieldAppliesToInput(field.appliesTo);
      setFieldOptionsInput((field.options || []).join(', '));
      setFieldTargetSection(field.sectionId || 'vehicle');
    } else {
      setEditingField(null);
      setFieldNameInput('');
      setFieldKeyInput('');
      setFieldTypeInput('text');
      setFieldAppliesToInput('all');
      setFieldOptionsInput('');
      setFieldTargetSection('vehicle');
    }
    setIsFieldModalOpen(true);
  };

  const handleSaveCustomField = () => {
    if (!fieldNameInput.trim()) return;
    const key = fieldKeyInput.trim() || fieldNameInput.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const options = fieldTypeInput === 'select'
      ? fieldOptionsInput.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;

    const currentCustomFields = template.customFields || [];

    if (editingField) {
      const updated = currentCustomFields.map((f) =>
        f.id === editingField.id
          ? {
              ...f,
              name: fieldNameInput.trim(),
              key,
              type: fieldTypeInput,
              appliesTo: fieldAppliesToInput,
              options,
              sectionId: fieldTargetSection
            }
          : f
      );
      setTemplate({ ...template, customFields: updated });
    } else {
      const newField: CustomFieldDefinition = {
        id: `cf_${Date.now()}`,
        name: fieldNameInput.trim(),
        key,
        type: fieldTypeInput,
        appliesTo: fieldAppliesToInput,
        options,
        sectionId: fieldTargetSection,
        sectionName: template.sections.find((s) => s.id === fieldTargetSection)?.name || 'Project Specs'
      };
      setTemplate({ ...template, customFields: [...currentCustomFields, newField] });
    }

    setIsFieldModalOpen(false);
  };

  const handleDeleteCustomField = (id: string) => {
    const updated = (template.customFields || []).filter((f) => f.id !== id);
    setTemplate({ ...template, customFields: updated });
  };

  // Save to Company Profile
  const handleSaveLayout = async () => {
    await updateCompany({ pdfTemplate: template });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  // Reset to Default Template
  const handleResetToDefault = () => {
    if (confirm('Reset template layout and fields to factory default?')) {
      setTemplate(DEFAULT_PDF_TEMPLATE);
    }
  };

  // Filtered Custom Fields
  const filteredCustomFields = (template.customFields || []).filter((f) => {
    if (customFieldFilter === 'all') return true;
    return f.appliesTo === 'all' || f.appliesTo === customFieldFilter;
  });

  return (
    <div className="space-y-6 text-left animate-fade-in select-text">
      {/* Top Segmented Navigation: General | Layout | Custom Fields */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm">
        <div>
          <h2 className="text-lg font-black text-[var(--color-text)] flex items-center gap-2">
            Invoice &amp; Quotes Studio
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-primary)]/20 text-[var(--color-primary)] font-black uppercase tracking-wider">
              Bilingual Layout Engine
            </span>
          </h2>
          <p className="text-xs text-[var(--color-text-muted)]">
            Define custom fields, drag sections, toggle side-by-side columns, and preview live.
          </p>
        </div>

        {/* Segmented Pill Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--color-surface-offset)] border border-[var(--color-border)]">
          <button
            onClick={() => setTopTab('general')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              topTab === 'general'
                ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm font-extrabold'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            General
          </button>
          <button
            onClick={() => setTopTab('layout')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              topTab === 'layout'
                ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm font-extrabold'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            Layout
          </button>
          <button
            onClick={() => setTopTab('custom_fields')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              topTab === 'custom_fields'
                ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm font-extrabold'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            Custom Fields
          </button>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* 1. LAYOUT TAB (MATCHING USER SCREENSHOT 1) */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {topTab === 'layout' && (
        <div className="space-y-4">
          {/* Layout Action Top Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
            {/* Invoice / Quote Toggle Pills */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--color-surface-offset)] border border-[var(--color-border)]">
              <button
                onClick={() => setDocMode('invoice')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  docMode === 'invoice'
                    ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm'
                    : 'text-[var(--color-text-muted)]'
                }`}
              >
                Invoice
              </button>
              <button
                onClick={() => setDocMode('quote')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  docMode === 'quote'
                    ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm'
                    : 'text-[var(--color-text-muted)]'
                }`}
              >
                Quote
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsAddSectionModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-[var(--color-surface-offset)] hover:bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                <span>+ Add Section</span>
              </button>

              <button
                onClick={handleResetToDefault}
                className="px-3 py-1.5 rounded-lg bg-[var(--color-surface-offset)] hover:bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs font-bold text-[var(--color-text-muted)] flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Default</span>
              </button>

              <button
                onClick={handleSaveLayout}
                className={`px-4 py-1.5 rounded-lg text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md cursor-pointer ${
                  savedSuccess ? 'bg-emerald-600' : 'bg-[#d97706] hover:bg-[#b45309]'
                }`}
              >
                {savedSuccess ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                <span>{savedSuccess ? 'Saved!' : 'Save Layout'}</span>
              </button>
            </div>
          </div>

          {/* Subtitle instructions */}
          <p className="text-xs text-[var(--color-text-muted)] italic px-1">
            Drag to reorder. Use the width toggle to place sections side-by-side. Consecutive half-width sections (L/R) will render in two columns.
          </p>

          {/* Grid: Left Editor (Hierarchical Accordions) | Right Multi-page Canvas Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Sections & Nested Fields Hierarchy (6 Cols) */}
            <div className="lg:col-span-6 space-y-3">
              {template.sections.map((section, sIdx) => {
                const isExpanded = expandedSections[section.id] ?? false;
                const isHalfWidth = section.width === 'half';

                return (
                  <div
                    key={section.id}
                    draggable
                    onDragStart={() => handleSectionDragStart(sIdx)}
                    onDragOver={(e) => handleSectionDragOver(e, sIdx)}
                    onDragEnd={handleSectionDragEnd}
                    className={`rounded-2xl border transition-all ${
                      section.enabled
                        ? 'bg-[var(--color-surface)] border-[var(--color-border)] shadow-sm'
                        : 'bg-[var(--color-surface)]/50 border-[var(--color-border)]/50 opacity-60'
                    } ${draggedSectionIndex === sIdx ? 'ring-2 ring-[var(--color-primary)] bg-[var(--color-primary)]/10' : ''}`}
                  >
                    {/* Section Top Header Row */}
                    <div className="flex items-center justify-between p-3.5 select-none">
                      <div className="flex items-center gap-2">
                        {/* Drag Handle */}
                        <div className="cursor-grab active:cursor-grabbing text-[var(--color-text-muted)] hover:text-[var(--color-text)] p-1">
                          <GripVertical className="w-4 h-4" />
                        </div>

                        {/* Expand / Collapse Chevron */}
                        <button
                          onClick={() => toggleAccordion(section.id)}
                          className="p-1 rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-surface-offset)] cursor-pointer"
                        >
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>

                        <span className="font-extrabold text-sm text-[var(--color-text)]">
                          {section.name}
                        </span>
                      </div>

                      {/* Controls: Width Toggle | Eye Toggle | Switch Toggle */}
                      <div className="flex items-center gap-2">
                        {/* Width Toggle: [|| L] / [== Full] */}
                        <button
                          onClick={() => toggleSectionWidth(section.id)}
                          className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider flex items-center gap-1 border transition-all cursor-pointer ${
                            isHalfWidth
                              ? 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400'
                              : 'bg-[var(--color-surface-offset)] border-[var(--color-border)] text-[var(--color-text-muted)]'
                          }`}
                          title={isHalfWidth ? 'Half Width (Side-by-Side)' : 'Full Width'}
                        >
                          <Columns className="w-3 h-3" />
                          <span>{isHalfWidth ? '|| L' : 'FULL'}</span>
                        </button>

                        {/* Visibility Eye Icon */}
                        <button
                          onClick={() => toggleSectionVisibility(section.id)}
                          className={`p-1 rounded-md cursor-pointer transition-colors ${
                            section.enabled ? 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]' : 'text-slate-400'
                          }`}
                        >
                          {section.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        </button>

                        {/* Switch Toggle */}
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={section.enabled}
                            onChange={() => toggleSectionVisibility(section.id)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-500"></div>
                        </label>

                        {/* Delete button if custom */}
                        {section.isCustom && (
                          <button
                            onClick={() => handleDeleteSection(section.id)}
                            className="p-1 rounded text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                            title="Delete Section"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Accordion Body: Nested Fields List */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 space-y-2 border-t border-[var(--color-divider)]/40 bg-[var(--color-surface-offset)]/30 rounded-b-2xl">
                        {section.fields && section.fields.map((field, fIdx) => (
                          <div
                            key={field.id}
                            draggable
                            onDragStart={() => handleFieldDragStart(section.id, fIdx)}
                            onDragOver={(e) => handleFieldDragOver(e, section.id, fIdx)}
                            onDragEnd={handleFieldDragEnd}
                            className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                              field.enabled
                                ? 'bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-primary)]/40'
                                : 'bg-[var(--color-surface)]/40 border-[var(--color-border)]/40 opacity-50'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div className="cursor-grab active:cursor-grabbing text-[var(--color-text-muted)] hover:text-[var(--color-text)] p-0.5">
                                <GripVertical className="w-3.5 h-3.5" />
                              </div>
                              <span className="text-xs font-semibold text-[var(--color-text)]">
                                {field.label}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {/* Field Eye */}
                              <button
                                onClick={() => toggleFieldVisibility(section.id, field.id)}
                                className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)] cursor-pointer"
                              >
                                {field.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                              </button>

                              {/* Field Switch Toggle */}
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={field.enabled}
                                  onChange={() => toggleFieldVisibility(section.id, field.id)}
                                  className="sr-only peer"
                                />
                                <div className="w-7 h-3.5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-500"></div>
                              </label>

                              {/* Lock or Trash */}
                              {field.isLocked ? (
                                <Lock className="w-3.5 h-3.5 text-slate-400" />
                              ) : (
                                <span className="w-3.5 h-3.5" />
                              )}
                            </div>
                          </div>
                        ))}

                        {/* + Add Field Button at bottom of section */}
                        <button
                          onClick={() => handleAddFieldToSection(section.id)}
                          className="w-full py-2 text-xs font-bold text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>+ add field</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Right Column: High-Fidelity Multi-Page Preview on Dark Canvas (6 Cols) */}
            <div className="lg:col-span-6 sticky top-6">
              <div className="rounded-2xl bg-[#1e2329] p-6 border border-slate-700/80 shadow-2xl space-y-6">
                <div className="flex items-center justify-between pb-2 border-b border-slate-700 text-slate-300">
                  <span className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Preview ({docMode === 'invoice' ? 'Invoice / فاتورة' : 'Quote / عرض سعر'})
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">A4 Document Simulation</span>
                </div>

                {/* Simulated White Sheet: Page 1 */}
                <div className="bg-white text-slate-900 rounded-lg shadow-xl p-6 min-h-[500px] text-left font-sans text-xs space-y-4 border border-slate-300">
                  {/* Header Section */}
                  {template.sections.find((s) => s.id === 'header')?.enabled && (
                    <div className="flex justify-between items-start pb-4 border-b border-amber-500">
                      <div>
                        <h3 className="font-black text-base text-[#b45309]">
                          {company.name || 'Your Workshop / المؤسسة'}
                        </h3>
                        <div className="text-[9px] text-slate-600 space-y-0.5 mt-1">
                          <p>CR: {company.crNumber || '1010456789'} | VAT: {company.vatNumber || '310123456700003'}</p>
                          <p>{company.address?.city || 'Riyadh, Saudi Arabia'}</p>
                          <p>{company.phone || '+966 50 123 4567'} • {company.email || 'billing@ajnetwork.sa'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-sm uppercase tracking-wider block">
                          {docMode === 'invoice' ? 'TAX INVOICE' : 'QUOTATION'}
                        </span>
                        <span className="font-mono text-[10px] font-bold text-slate-600 block">
                          {docMode === 'invoice' ? 'INV-2026-0042' : 'QT-2026-0089'}
                        </span>
                        <span className="text-[9px] text-slate-500">Date: 2026-08-30</span>
                      </div>
                    </div>
                  )}

                  {/* Side-by-side Customer & Vehicle / Specs Sections */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Customer Box */}
                    {template.sections.find((s) => s.id === 'customer')?.enabled && (
                      <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-[9px] space-y-1">
                        <span className="font-bold text-amber-800 uppercase block pb-0.5 border-b border-amber-500/20">
                          Customer
                        </span>
                        <p className="font-bold text-slate-900">Ahmed Mohammed Al-Arfaj</p>
                        <p className="text-slate-600">Al Olaya District, Riyadh</p>
                        <p className="text-slate-600">VAT: 300123456700003</p>
                      </div>
                    )}

                    {/* Vehicle / Project Specs Box */}
                    {template.sections.find((s) => s.id === 'vehicle')?.enabled && (
                      <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-[9px] space-y-1">
                        <span className="font-bold text-slate-700 uppercase block pb-0.5 border-b border-slate-200">
                          Project / Service Specs
                        </span>
                        <p className="text-slate-700"><strong>PO #:</strong> PO-998811</p>
                        <p className="text-slate-700"><strong>Ref:</strong> Smart City IP CCTV</p>
                        <p className="text-slate-700"><strong>Contact:</strong> Eng. Fahad (+966500000000)</p>
                      </div>
                    )}
                  </div>

                  {/* Line Items Table */}
                  {template.sections.find((s) => s.id === 'line_items')?.enabled && (
                    <div className="overflow-x-auto rounded border border-slate-200 mt-2">
                      <table className="w-full text-left text-[9px] border-collapse">
                        <thead>
                          <tr className="bg-amber-500/10 text-slate-900 font-bold border-b border-slate-200">
                            <th className="p-1.5">Description</th>
                            <th className="p-1.5 text-right">Qty</th>
                            <th className="p-1.5 text-right">Price</th>
                            <th className="p-1.5 text-right">VAT (15%)</th>
                            <th className="p-1.5 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          <tr>
                            <td className="p-1.5 font-medium">Periodic Maintenance &amp; Commissioning</td>
                            <td className="p-1.5 text-right font-mono">1</td>
                            <td className="p-1.5 text-right font-mono">1,500.00</td>
                            <td className="p-1.5 text-right font-mono">225.00</td>
                            <td className="p-1.5 text-right font-mono font-bold">1,725.00</td>
                          </tr>
                          <tr>
                            <td className="p-1.5 font-medium">Hardware Filter &amp; Sensor Replacement</td>
                            <td className="p-1.5 text-right font-mono">2</td>
                            <td className="p-1.5 text-right font-mono">450.00</td>
                            <td className="p-1.5 text-right font-mono">135.00</td>
                            <td className="p-1.5 text-right font-mono font-bold">1,035.00</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Totals & ZATCA QR Row */}
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    {/* ZATCA QR */}
                    {template.sections.find((s) => s.id === 'zatca_qr')?.enabled ? (
                      <div className="flex items-center gap-2 p-2 rounded bg-slate-50 border border-slate-200">
                        <QrCode className="w-10 h-10 text-slate-800" />
                        <div className="text-[8px] text-slate-600">
                          <span className="font-bold text-emerald-700 block">ZATCA Compliant</span>
                          <p>Phase 2 QR &amp; Bank Transfer</p>
                        </div>
                      </div>
                    ) : <div />}

                    {/* Summary Totals */}
                    {template.sections.find((s) => s.id === 'summary')?.enabled && (
                      <div className="space-y-1 text-[9px] p-2 bg-amber-500/5 rounded border border-amber-500/20 text-right">
                        <div className="flex justify-between text-slate-600">
                          <span>Subtotal:</span>
                          <span className="font-mono font-bold">2,400.00 SAR</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>VAT (15%):</span>
                          <span className="font-mono font-bold">360.00 SAR</span>
                        </div>
                        <div className="flex justify-between font-black text-[11px] text-[#b45309] border-t border-amber-500/30 pt-1">
                          <span>Total:</span>
                          <span className="font-mono">2,760.00 SAR</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Simulated White Sheet: Page 2 (Terms & Signatures) */}
                <div className="bg-white text-slate-900 rounded-lg shadow-xl p-6 min-h-[320px] text-left font-sans text-xs space-y-4 border border-slate-300">
                  <div className="flex justify-between text-[9px] text-slate-400 pb-2 border-b border-slate-100">
                    <span>Page 2 of 2</span>
                    <span>Document #{docMode === 'invoice' ? 'INV-2026-0042' : 'QT-2026-0089'}</span>
                  </div>

                  {/* Terms Section */}
                  {template.sections.find((s) => s.id === 'payment_terms')?.enabled && (
                    <div className="p-3 rounded bg-slate-50 border border-slate-200 text-[9px] space-y-1">
                      <span className="font-bold text-slate-900 block">Terms &amp; Warranties / الشروط والضمان:</span>
                      <p className="text-slate-600">• Payment is due within 14 days of invoice issue date.</p>
                      <p className="text-slate-600">• Warranty coverage valid for 24 months from commissioning.</p>
                    </div>
                  )}

                  {/* Signatures Block */}
                  {template.sections.find((s) => s.id === 'signatures')?.enabled && (
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200 text-[9px]">
                      <div className="p-3 rounded border border-dashed border-slate-300 text-center">
                        <span className="text-slate-500 block mb-6">Authorized Signatory</span>
                        <div className="border-t border-slate-400 pt-1 font-bold text-slate-800">
                          {company.name || 'Qvoke Networks'}
                        </div>
                      </div>
                      <div className="p-3 rounded border border-dashed border-slate-300 text-center">
                        <span className="text-slate-500 block mb-6">Customer Approval</span>
                        <div className="border-t border-slate-400 pt-1 font-bold text-slate-800">
                          Ahmed Mohammed Al-Arfaj
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Footer */}
                  {template.sections.find((s) => s.id === 'footer')?.enabled && (
                    <div className="text-center pt-2 text-[8px] text-slate-400">
                      <span>{company.email || 'info@ajnetwork.sa'} • www.qvoke.com • Kingdom of Saudi Arabia</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* 2. CUSTOM FIELDS TAB (MATCHING USER SCREENSHOT 2) */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {topTab === 'custom_fields' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm space-y-4">
            <div>
              <h3 className="text-base font-extrabold text-[var(--color-text)]">Invoice &amp; Quotes</h3>
              <p className="text-xs text-[var(--color-text-muted)]">
                Define custom fields that appear on service records and quotes.
              </p>
            </div>

            {/* Filter Pills + Add Field Button Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[var(--color-divider)]">
              {/* Filter Pills */}
              <div className="flex items-center gap-2 text-xs font-bold">
                <button
                  onClick={() => setCustomFieldFilter('all')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    customFieldFilter === 'all'
                      ? 'bg-[var(--color-primary)] text-white shadow-sm'
                      : 'bg-[var(--color-surface-offset)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                  }`}
                >
                  All ({template.customFields?.length || 0})
                </button>
                <button
                  onClick={() => setCustomFieldFilter('invoice')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    customFieldFilter === 'invoice'
                      ? 'bg-[var(--color-primary)] text-white shadow-sm'
                      : 'bg-[var(--color-surface-offset)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                  }`}
                >
                  Invoice ({(template.customFields || []).filter((f) => f.appliesTo === 'invoice' || f.appliesTo === 'all').length})
                </button>
                <button
                  onClick={() => setCustomFieldFilter('quotation')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    customFieldFilter === 'quotation'
                      ? 'bg-[var(--color-primary)] text-white shadow-sm'
                      : 'bg-[var(--color-surface-offset)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                  }`}
                >
                  Quote ({(template.customFields || []).filter((f) => f.appliesTo === 'quotation' || f.appliesTo === 'all').length})
                </button>
              </div>

              {/* + Add Field Button */}
              <button
                onClick={() => handleOpenFieldModal()}
                className="px-4 py-2 rounded-xl bg-[#d97706] hover:bg-[#b45309] text-white text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Field</span>
              </button>
            </div>

            {/* Custom Field Cards List */}
            <div className="space-y-3 pt-2">
              {filteredCustomFields.map((field) => (
                <div
                  key={field.id}
                  className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-offset)]/40 hover:bg-[var(--color-surface-offset)] transition-all flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-[var(--color-text)]">
                        {field.name}
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)]">• {field.type.toUpperCase()}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] mt-1">
                      <span className="font-mono text-[11px]">{field.key}</span>
                      <span>•</span>
                      <span className="capitalize">{field.appliesTo === 'all' ? 'Invoice & Quote' : field.appliesTo}</span>
                      <span>•</span>
                      <span className="text-slate-400">Assigned: {field.sectionName || 'Project Specs'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenFieldModal(field)}
                      className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] transition-colors cursor-pointer"
                      title="Edit Field"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteCustomField(field.id)}
                      className="p-2 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="Delete Field"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {filteredCustomFields.length === 0 && (
                <div className="p-8 text-center text-xs text-[var(--color-text-muted)] border border-dashed border-[var(--color-border)] rounded-2xl">
                  No custom fields defined yet. Click <strong>+ Add Field</strong> to create dynamic fields for quotes and invoices.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* 3. GENERAL SETTINGS TAB */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {topTab === 'general' && (
        <div className="p-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm space-y-6">
          <div>
            <h3 className="text-base font-extrabold text-[var(--color-text)]">General PDF Preferences</h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              Customize global brand palette, font sizing, page margins, and security watermark.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[var(--color-divider)]">
            {/* Brand Color Pickers */}
            <div className="space-y-4">
              <span className="text-xs font-black uppercase text-[var(--color-text)] block">
                Brand Colors &amp; Gradients
              </span>
              <div>
                <label className="text-xs font-bold text-[var(--color-text)] block mb-1">
                  Primary Accent Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={template.colors.primary}
                    onChange={(e) =>
                      setTemplate({
                        ...template,
                        colors: { ...template.colors, primary: e.target.value }
                      })
                    }
                    className="w-9 h-9 rounded-xl cursor-pointer border-0"
                  />
                  <input
                    type="text"
                    value={template.colors.primary}
                    onChange={(e) =>
                      setTemplate({
                        ...template,
                        colors: { ...template.colors, primary: e.target.value }
                      })
                    }
                    className="flex-1 p-2 rounded-xl bg-[var(--color-surface-offset)] border border-[var(--color-border)] text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--color-text)] block mb-1">
                  Header Gradient Palette
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="color"
                    value={template.colors.headerBgStart}
                    onChange={(e) =>
                      setTemplate({
                        ...template,
                        colors: { ...template.colors, headerBgStart: e.target.value }
                      })
                    }
                    className="w-full h-9 rounded-xl cursor-pointer border-0"
                  />
                  <input
                    type="color"
                    value={template.colors.headerBgEnd}
                    onChange={(e) =>
                      setTemplate({
                        ...template,
                        colors: { ...template.colors, headerBgEnd: e.target.value }
                      })
                    }
                    className="w-full h-9 rounded-xl cursor-pointer border-0"
                  />
                </div>
              </div>
            </div>

            {/* Typography & Watermark */}
            <div className="space-y-4">
              <span className="text-xs font-black uppercase text-[var(--color-text)] block">
                Typography &amp; Document Sizing
              </span>
              <div>
                <label className="text-xs font-bold text-[var(--color-text)] block mb-1">
                  Bilingual Font Family
                </label>
                <select
                  value={template.typography.fontFamily}
                  onChange={(e: any) =>
                    setTemplate({
                      ...template,
                      typography: { ...template.typography, fontFamily: e.target.value }
                    })
                  }
                  className="w-full p-2.5 rounded-xl bg-[var(--color-surface-offset)] border border-[var(--color-border)] text-xs font-bold"
                >
                  <option value="Tajawal">Tajawal (Saudi ZATCA Official)</option>
                  <option value="Outfit">Outfit (Modern Clean SaaS)</option>
                  <option value="Inter">Inter (Corporate Dense)</option>
                  <option value="Geist">Geist (Minimalist Technical)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--color-text)] block mb-1">
                  Watermark Stamp Text
                </label>
                <input
                  type="text"
                  value={template.watermark.text}
                  onChange={(e) =>
                    setTemplate({
                      ...template,
                      watermark: { ...template.watermark, text: e.target.value }
                    })
                  }
                  className="w-full p-2.5 rounded-xl bg-[var(--color-surface-offset)] border border-[var(--color-border)] text-xs font-bold"
                  placeholder="e.g. PAID, OFFICIAL, CONFIDENTIAL"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-[var(--color-divider)]">
            <button
              onClick={handleSaveLayout}
              className="px-6 py-2.5 rounded-xl bg-[#d97706] hover:bg-[#b45309] text-white text-xs font-bold flex items-center gap-2 shadow-lg cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save General Preferences</span>
            </button>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* CUSTOM FIELD CREATE/EDIT MODAL */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {isFieldModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="max-w-md w-full rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-2xl p-6 space-y-4 animate-scale-in text-left">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--color-divider)]">
              <h3 className="text-sm font-extrabold text-[var(--color-text)]">
                {editingField ? 'Edit Custom Field' : 'Create Custom Field'}
              </h3>
              <button
                onClick={() => setIsFieldModalOpen(false)}
                className="p-1 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-offset)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-[var(--color-text)] block mb-1">
                  Field Display Name
                </label>
                <input
                  type="text"
                  value={fieldNameInput}
                  onChange={(e) => setFieldNameInput(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[var(--color-surface-offset)] border border-[var(--color-border)] font-bold text-xs"
                  placeholder="e.g. Purchase order number, Site contact"
                />
              </div>

              <div>
                <label className="font-bold text-[var(--color-text)] block mb-1">
                  Field Key (Internal Identifier)
                </label>
                <input
                  type="text"
                  value={fieldKeyInput}
                  onChange={(e) => setFieldKeyInput(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[var(--color-surface-offset)] border border-[var(--color-border)] font-mono text-xs"
                  placeholder="e.g. purchase_order, site_contact"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[var(--color-text)] block mb-1">
                    Field Type
                  </label>
                  <select
                    value={fieldTypeInput}
                    onChange={(e: any) => setFieldTypeInput(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-[var(--color-surface-offset)] border border-[var(--color-border)] font-bold text-xs"
                  >
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="select">Select (Dropdown)</option>
                    <option value="checkbox">Checkbox</option>
                    <option value="date">Date</option>
                    <option value="textarea">Textarea</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-[var(--color-text)] block mb-1">
                    Applies To
                  </label>
                  <select
                    value={fieldAppliesToInput}
                    onChange={(e: any) => setFieldAppliesToInput(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-[var(--color-surface-offset)] border border-[var(--color-border)] font-bold text-xs"
                  >
                    <option value="all">Invoice &amp; Quote (All)</option>
                    <option value="quotation">Quote Only</option>
                    <option value="invoice">Invoice Only</option>
                  </select>
                </div>
              </div>

              {fieldTypeInput === 'select' && (
                <div>
                  <label className="font-bold text-[var(--color-text)] block mb-1">
                    Dropdown Options (Comma separated)
                  </label>
                  <input
                    type="text"
                    value={fieldOptionsInput}
                    onChange={(e) => setFieldOptionsInput(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-[var(--color-surface-offset)] border border-[var(--color-border)] text-xs"
                    placeholder="Bay 1, Bay 2, Bay 3, On-Site"
                  />
                </div>
              )}

              <div>
                <label className="font-bold text-[var(--color-text)] block mb-1">
                  Assign to Section
                </label>
                <select
                  value={fieldTargetSection}
                  onChange={(e) => setFieldTargetSection(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[var(--color-surface-offset)] border border-[var(--color-border)] font-bold text-xs"
                >
                  {template.sections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      {sec.name} ({sec.nameAr})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-divider)]">
              <button
                onClick={() => setIsFieldModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[var(--color-surface-offset)] hover:bg-[var(--color-surface-2)] text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCustomField}
                className="px-5 py-2 rounded-xl bg-[#d97706] hover:bg-[#b45309] text-white text-xs font-bold shadow-md cursor-pointer"
              >
                Save Field
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* ADD SECTION MODAL */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {isAddSectionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="max-w-md w-full rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-2xl p-6 space-y-4 animate-scale-in text-left">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--color-divider)]">
              <h3 className="text-sm font-extrabold text-[var(--color-text)]">
                Add New Document Section
              </h3>
              <button
                onClick={() => setIsAddSectionModalOpen(false)}
                className="p-1 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-offset)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-[var(--color-text)] block mb-1">
                  Section Title (English)
                </label>
                <input
                  type="text"
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[var(--color-surface-offset)] border border-[var(--color-border)] font-bold text-xs"
                  placeholder="e.g. Scope of Work, Equipment Checklist"
                />
              </div>

              <div>
                <label className="font-bold text-[var(--color-text)] block mb-1">
                  Section Title (Arabic)
                </label>
                <input
                  type="text"
                  dir="rtl"
                  value={newSectionNameAr}
                  onChange={(e) => setNewSectionNameAr(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[var(--color-surface-offset)] border border-[var(--color-border)] font-bold text-xs"
                  placeholder="نطاق العمل ومواصفات التجهيز"
                />
              </div>

              <div>
                <label className="font-bold text-[var(--color-text)] block mb-1">
                  Layout Width
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setNewSectionWidth('full')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                      newSectionWidth === 'full'
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/15 text-[var(--color-primary)]'
                        : 'border-[var(--color-border)] bg-[var(--color-surface-offset)] text-[var(--color-text-muted)]'
                    }`}
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Full Width</span>
                  </button>

                  <button
                    onClick={() => setNewSectionWidth('half')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                      newSectionWidth === 'half'
                        ? 'border-amber-500 bg-amber-500/15 text-amber-600 dark:text-amber-400'
                        : 'border-[var(--color-border)] bg-[var(--color-surface-offset)] text-[var(--color-text-muted)]'
                    }`}
                  >
                    <Columns className="w-3.5 h-3.5" />
                    <span>Half Width (|| L)</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-divider)]">
              <button
                onClick={() => setIsAddSectionModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[var(--color-surface-offset)] hover:bg-[var(--color-surface-2)] text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSection}
                className="px-5 py-2 rounded-xl bg-[#d97706] hover:bg-[#b45309] text-white text-xs font-bold shadow-md cursor-pointer"
              >
                Create Section
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
