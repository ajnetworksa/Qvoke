import { useERPStore } from '../store';

/** Company-wide default notes & terms pre-filled on new quotations / invoices. */
export interface DocumentDefaults {
  quotation: { enabled: boolean; notes: string; terms: string };
  invoice: { enabled: boolean; notes: string; terms: string };
}

export const EMPTY_DOCUMENT_DEFAULTS: DocumentDefaults = {
  quotation: { enabled: false, notes: '', terms: '' },
  invoice: { enabled: false, notes: '', terms: '' }
};

const SETTING_KEY = 'documentDefaults';
export const DOCUMENT_DEFAULTS_EVENT = 'document-terms-updated';

const authHeaders = (): Record<string, string> => {
  const token = useERPStore.getState().token;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/** Always fetched fresh from the server so "new document" never uses stale in-memory defaults. */
export async function fetchDocumentDefaults(): Promise<DocumentDefaults> {
  try {
    const res = await fetch(`/api/settings/${SETTING_KEY}`, { headers: authHeaders() });
    if (!res.ok) return EMPTY_DOCUMENT_DEFAULTS;
    const { value } = await res.json();
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return {
      quotation: { ...EMPTY_DOCUMENT_DEFAULTS.quotation, ...(parsed?.quotation || {}) },
      invoice: { ...EMPTY_DOCUMENT_DEFAULTS.invoice, ...(parsed?.invoice || {}) }
    };
  } catch {
    return EMPTY_DOCUMENT_DEFAULTS;
  }
}

export async function saveDocumentDefaults(defaults: DocumentDefaults): Promise<boolean> {
  const res = await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ key: SETTING_KEY, value: defaults })
  });
  if (res.ok) window.dispatchEvent(new CustomEvent(DOCUMENT_DEFAULTS_EVENT, { detail: defaults }));
  return res.ok;
}
