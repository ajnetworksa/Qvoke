# Audit & Dynamic-Quotation sync (latest)

**Bugs fixed**
- InvoiceDetail crashed on render/actions: missing `getLineNumber` import, `handleDeleteLine`, `customerObj`.
- POS: missing `Loader2` import; ZATCA QR called with an object instead of positional args (wrong QR).
- QuotationDetail: `convertToInvoice` is async but wasn't awaited (routed to a Promise).
- Tracking: "Delete Selected" referenced a missing handler/icon and was gated on the wrong state; selection now follows filters.
- Store: bulk updates (e.g. follow-ups) overwrote each other via stale `set()` snapshots.
- SortableTableRow: drag styling was overridden by `{...props}` className.
- PDF/default terms hardcoded AJ's bank account, phone and email for every tenant; now read from company profile.
- Raw `fetch('/api/…')` calls skipped `X-Company-Id` (wrong tenant after switching company); global interceptor added.
- Doc numbering never falls back to a possibly duplicate number; PUT on quotes/invoices is tenant-scoped and 404s when missing.
- `npm run build` was failing (strict unused-var errors, missing vite types); fixed.

**Security**
- `/api/translate` now requires login, has a size cap.
- AI chat SQL guarded (single SELECT, business tables only, pinned to companyId); error text no longer echoed.
- DB restore: no path traversal, integrity/schema check, stale WAL/SHM removed.
- `/api/settings/:key` global fallback hides credential-like keys; `/api/logs` scoped to the company; clearing logs is super-admin only.

**Synced from Dynamic Quotation**
- Translation uses `sl=en`, preserves account numbers/IBANs, keeps line structure, concise `الآيبان:`.
- Settings → Document: default notes & terms per document type with a "pre-fill new documents" toggle; fetched fresh when a new document is opened; broadcasts `document-terms-updated`.

# Qvoke ERP Updates - Batch C

## Short Summary
Fixed critical draft persistence bugs causing old quotation data to load for new quotes, implemented missing UI components for Invoice markup editing to achieve feature parity with Quotations, and optimized document routing.

## Long Summary
1. **Invoice Editor UI Parity**: 
   - Brought `InvoiceDetail.tsx` up to feature parity with `QuotationDetail.tsx` by adding advanced Pricing Markup (M.U. %) logic.
   - Introduced the dynamic Analysis Sidebar into the Invoice editor, allowing line-by-line margin and rule overrides (INCL/EXCL/MAN/DB).
   - Synced DOM refs and introduced the `ResizeObserver` engine to map Line Items grid heights to the Analysis Sidebar pixel-perfectly.
   - Wired default global settings to retrieve default markup percentage from `api/settings/defaultMarkupPercentage`.

2. **Routing & Draft Persistence Bug Fix (Critical)**:
   - Addressed a severe bug where navigating to a different Quotation or Invoice ID (or clicking "New") while a local draft was present would cause the old form state to overwrite the new document's draft.
   - By adding an explicit React `key={recordId || 'new'}` parameter to both `<QuotationDetail>` and `<InvoiceDetail>` components inside the App Router, React is now forced to safely unmount and destroy all stale state before remounting the newly requested document.
   - This prevents "leaking" the old devices or line items into a newly created quotation and correctly clears all transient `isDirty` states.

3. **Performance**:
   - `useEffect` rules for draft persistence are now isolated successfully.
   - Side-by-side table heights calculate accurately via `requestAnimationFrame` and CSS box-sizing logic.
