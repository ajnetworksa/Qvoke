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

**Follow-up pass**
- Server recomputes subtotal/discount/tax/total (and amountDue) from line items on quote/invoice create & update; client totals are no longer trusted (manual-total documents excepted).
- Kanban: added the missing Expired column, null-safe totals, column totals, responsive grid, keyboard open, and an error alert when a drag-drop status change fails.

- Per-company document numbering: `UNIQUE(companyId, number)` on quotations/invoices/BOQ/expenses/recurring, and a `sequences` table keyed by (companyId, docType). One-time, transactional, idempotent migration with an automatic `VACUUM INTO` backup and row-count checks. Verified on a legacy DB copy with two companies.

**UI pass from live screenshots**
- Dashboard KPI "vs last month" badges were hard-coded fake numbers; now real month-over-month for revenue/profit and hidden for counts. "Total Revenue" renamed "Collected Revenue" (it sums payments received).
- Sidebar gained Quotations and Invoices list entries (Kanban/list were only reachable via Ctrl+K); long bilingual labels shortened and given tooltips.
- PageHeader wraps actions under long titles instead of crushing the title.
- Numbering settings: next-number preview now matches the real format (`QT-2026-0004`), document types are labelled and ordered.
- Invoice Kanban uses a responsive grid; amounts use 2 decimals; Tracking date filters fit on phones.

**PDF Template Studio is now fully operational**
- Root cause: the Studio saved a rich template, but the PDF renderer ignored almost all of it (and the in-app "preview" was a separate HTML replica that did not match the real PDF).
- New `src/pdf/template.ts` (defaults, 5 presets, normaliser) shared by the Studio, in-app preview and server renderer; `quote-document.tsx` rewritten to be template-driven: header styles (gradient/solid/boxed/minimal), all colours, ordered/enabled sections with half-width pairing, per-field toggles, configurable table columns (code, discount, VAT %), custom sections, custom fields, signatures, bank details, ZATCA QR, watermark (template + per-document), page size and margins, font and sizes.
- Studio rewritten: live preview renders the real PDF with sample data; separate quotation/invoice layouts; presets; reorder/show/hide; custom sections & fields; export/import JSON; reset; save with error reporting.
- Custom fields are now captured in the quotation/invoice editors, stored per document (`customFieldValues`) and printed in their section.
- In-app PDF preview now shows the actual PDF (what Download produces) and prints it; the unused HTML replica (with a hooks-order bug) was removed.
- Tajawal (Arabic + Latin) is bundled in `public/fonts` (OFL) instead of loading from a CDN, so PDFs render offline; Arabic always uses Tajawal even when a Latin font is chosen. Non-embeddable options (Outfit/Inter/Geist) were replaced by Helvetica/Times/Courier.
- Removed another company's hard-coded defaults (AJ logo/footer images and sample terms) from the PDF mapper.

**Second audit (found by API smoke tests + a full-app browser crawl)**
- Inventory: stock was only deducted when an invoice was *created* as posted; draft→posted via edit never deducted, and cancelling/editing never restored. Stock now follows invoice commitments by diffing before/after on every save (draft→posted deducts, edits adjust, cancel restores, re-saves are idempotent).
- Invoices: `amountDue || total` turned a fully paid invoice (due 0) back into "due = total"; paid/due are now derived server-side from the payments ledger.
- Recurring billing: ignored line discounts, taxed 0% lines at 15%, didn't touch stock, processed paused/ended profiles, and Jan 31 + 1 month became Mar 3. All fixed.
- POS page crashed (React #310: hook after an early return) and treated a not-yet-loaded feature list as "disabled".
- Reloading `/recurring` or `/showcase` landed on the Dashboard (route mapping mismatch).
- Settings → Database & Backups always returned 403 on the main port (admin-port restriction applied to maintenance routes); backup download now sends the auth header.
- `GET /api/users` leaked every tenant's users (emails, permissions) to any logged-in user; now company-scoped, minimal fields for non-managers. New users were not added to the active company (silently fell into the default company); fixed, plus password ≥ 8 chars and role validation.
- Public portal: links never expired, could be accepted twice/after decline, could confirm cancelled/expired quotes, were unthrottled, and encoded a placeholder VAT number in the QR. Guarded, rate-limited, and the page now shows errors.
- Invalid statuses/missing required fields returned raw 500s; customers/products in use now return a clear 409; customer email/phone are optional.

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
