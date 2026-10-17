import React from 'react';
import { useERPStore } from '../store';
import { resolveTemplate, type PdfDocType } from '../pdf/template';

/**
 * Inputs for the template's custom fields (configured in Settings → PDF Template Studio).
 * Values are saved with the document and printed in the section each field is assigned to.
 */
export const CustomFieldsCard: React.FC<{
  docType: PdfDocType;
  values: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}> = ({ docType, values, onChange }) => {
  const template = useERPStore((s) => s.company.pdfTemplate);
  const fields = resolveTemplate(template, docType).customFields?.filter(
    (f) => f.appliesTo === 'all' || f.appliesTo === docType
  );
  if (!fields || fields.length === 0) return null;

  const set = (key: string, v: string) => onChange({ ...values, [key]: v });
  const inputCls = 'w-full premium-input';

  return (
    <div className="mb-6" data-testid="custom-fields">
      <div className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
        Additional Details / تفاصيل إضافية
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map((f) => {
          const id = `cf-${f.key}`;
          const v = values[f.key] ?? '';
          return (
            <div key={f.id} className={f.type === 'textarea' ? 'md:col-span-2' : ''}>
              {f.type === 'checkbox' ? (
                <label className="flex items-center gap-2 text-sm text-[var(--color-text)] cursor-pointer">
                  <input type="checkbox" checked={v === 'true'} onChange={(e) => set(f.key, e.target.checked ? 'true' : '')} />
                  {f.name}
                </label>
              ) : (
                <>
                  <label htmlFor={id} className="block text-[11px] font-semibold text-[var(--color-text-muted)] mb-1">{f.name}</label>
                  {f.type === 'textarea' ? (
                    <textarea id={id} rows={3} maxLength={500} value={v} onChange={(e) => set(f.key, e.target.value)} className={inputCls} />
                  ) : f.type === 'select' ? (
                    <select id={id} value={v} onChange={(e) => set(f.key, e.target.value)} className={inputCls}>
                      <option value="">—</option>
                      {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input
                      id={id}
                      type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                      maxLength={500}
                      value={v}
                      onChange={(e) => set(f.key, e.target.value)}
                      className={inputCls}
                    />
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
export default CustomFieldsCard;
