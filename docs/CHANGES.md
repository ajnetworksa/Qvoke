# Qvoke ERP — Change Log & Implementation Notes

Branch: `feat/erp-numbering-audit-autosave-features`
Status: committed & pushed; PR pending manual open.

This document lists everything changed this work cycle, **how** each piece was built,
and **what still remains**.

---

## 1. Document Numbering — server-side & collision-safe

**Why:** numbers were generated on the client (`quotations.length + 1`, hardcoded
`QT-2026-`). That can collide, resets on reload, and didn't cover invoices/BOQ/BOM.

**How:**
- New `sequences` table: `(docType, prefix, lastNumber, padding, resetPeriod, lastYear)`.
- `getNextDocumentNumber(docType)` — atomically increments and formats
  `PREFIX-NNNN` or `PREFIX-YYYY-NNNN` (yearly reset). Called inside the create
  routes so the server owns the number; the client no longer sends one.
- `reconcileSequences()` — one-time, settings-flag-guarded. Scans existing docs,
  detects the dominant prefix / padding / year-usage / max per type, and seeds the
  counter so a legacy series **continues** instead of forking.
- Endpoints: `GET /api/sequences`, `GET /api/sequences/next/:docType`,
  `PUT /api/sequences/:docType` (admin).
- Client: `store.ts` `addQuotation`/`addInvoice`/`convertToInvoice` now take the
  number from the server response; removed all client-side number generation.

**Detected live convention:** Quotations `SN-######` (no year), Invoices/BOQ/BOM
`*-YYYY-NNNN` (yearly).

**Files:** `server.ts`, `src/store.ts`, `src/pages/{QuotationDetail,InvoiceDetail,BOQ}.tsx`

---

## 2. BOM module

**Why:** BOM was one of the four requested document types.

**How:** BOM already existed as a `type` toggle sharing the `boq` table. Completed it:
server numbering for `bom`, and the create flow distinguishes `boq` vs `bom`.
(Full visual/PDF parity tracked under Remaining.)

**Files:** `server.ts`, `src/pages/BOQ.tsx`

---

## 3. Audit trail, attribution & timeline

**Why:** legacy let admins see who created a quote and who later changed what;
Qvoke had lost this.

**How:**
- `document_activity` table: `(docType, docId, docNumber, action, changes JSON,
  actorId, actorName, timestamp)`.
- `logDocumentActivity()` writes create/update/status-change/delete.
- `computeDocumentDiff()` produces a human diff: scalar field changes **plus**
  line-item added/removed/changed.
- Attribution columns `createdBy/createdByName/updatedBy/updatedByName` on
  quotations, invoices, boq.
- `GET /api/activity/:docType/:docId` (per-doc) and `GET /api/audit` (global,
  filterable) — gated by `canViewHistory`.
- `DocumentTimeline` component rendered on quote/invoice/BOQ detail pages.
- "Created by / Last edited by" shown only with `canViewCreatedBy`.

**Files:** `server.ts`, `src/components/DocumentTimeline.tsx`,
`src/pages/{QuotationDetail,InvoiceDetail,BOQ}.tsx`, `src/types.ts`

---

## 4. Notifications

**Why:** requested; surfaces time-sensitive events.

**How:**
- `notifications` table `(userId, type, title, body, link, isRead, createdAt)`.
- `GET /api/notifications`, `POST /api/notifications/:id/read`,
  `POST /api/notifications/read-all`, `POST /api/notifications/refresh`.
- `refresh` derives "quotation expiring (≤7d)" and "invoice overdue" alerts,
  deduped per day.
- `NotificationBell` in the header: unread badge, mark-read, click-through to the
  document. Polls every 5 min.

**Files:** `server.ts`, `src/components/NotificationBell.tsx`, `src/App.tsx`, `src/types.ts`

---

## 5. Usage analytics

**How:** `GET /api/usage` aggregates `document_activity` — counts by type, by user,
plus live table counts. Gated by `canViewRevenue`. (Data layer done; dedicated UI
panel under Remaining.)

**Files:** `server.ts`

---

## 6. Modern autosave & draft persistence

**Why:** legacy autosave sometimes created a quote prematurely then prompted to
"rewrite", and in-progress work was lost when navigating away.

**How:**
- `useDraft` hook — persists the editor's full state to `localStorage` on every
  change while dirty; restores on mount; clears on commit; 7-day expiry.
- `committedRef` create-once guard — a new doc is POSTed exactly once; everything
  after is an update. Kills duplicate/phantom docs and the "rewrite?" prompt.
- `AutoSaveIndicator` gained a `local` state — **"Draft saved on this device"** —
  so autosave is visible even before the doc is server-ready (no customer yet).
- Applied to Quotation + Invoice editors (full draft persistence); BOQ/BOM got the
  commit-once guard.

**Files:** `src/hooks/useDraft.ts`, `src/hooks/useAutoSave.ts`,
`src/components/AutoSaveIndicator.tsx`,
`src/pages/{QuotationDetail,InvoiceDetail,BOQ}.tsx`

---

## 7. Resume-open documents ("Current Quote" vs list)

**Why:** after editing, going to another tab and back required re-finding/reopening
the quote. Legacy had a dedicated editor button separate from the list.

**How:**
- Store: `activeQuoteId` / `activeInvoiceId`, persisted to `localStorage`,
  updated by `setRoute`, cleared on delete.
- Nav: **Current Quote** / **Current Invoice** buttons resume the active doc (or
  start new); **Quotations** / **Invoices** remain the list/tracking views.

**Files:** `src/store.ts`, `src/App.tsx`

---

## 8. Granular RBAC (verified — already present)

Qvoke already had the full legacy model: ~26 granular permissions, grouped toggle
UI, permission-group presets (Users + Groups tabs), admin-full-access. Confirmed the
new `canViewHistory` / `canViewCreatedBy` keys are wired in and enforced. No rebuild
needed.

**Files:** `src/components/UsersDB.tsx` (verified), `server.ts` (enforcement)

---

## 9. Plans & feature toggles

**Why:** "control what to use or not" — enable/disable modules; plan tiers.

**How:**
- `FEATURE_CATALOG` (13 modules; core ones locked) + `PLANS`
  (Starter / Professional / Enterprise).
- Settings keys `activePlan` + `featureFlags`; `GET/PUT /api/features`;
  `requireFeature(key)` middleware (applied to usage/audit/activity).
- Store loads `features`/`activePlan`; nav filtered by enabled modules.
- **Settings → Plan & Features** panel: plan cards + per-module toggles.
- Default seed = Enterprise (everything on).

**Files:** `server.ts`, `src/store.ts`, `src/App.tsx`, `src/pages/Settings.tsx`

---

## Verification performed

- `tsc --noEmit` clean after every change.
- Server booted against the live DB; migrations applied cleanly.
- API smoke tests: login → create quote (`SN-000931`) → update → timeline diff →
  usage.
- Browser (preview): draft survives navigate-to-Products-and-back; "Draft saved on
  this device" indicator; Current Quote resume; plan switch hides/shows nav modules.

---

## 10. Personal task tracker (NEW)

**Why:** requested module — a per-user to-do / pending-work list.

**How:**
- `personal_tasks` table `(id, userId, title, notes, status, priority, dueDate,
  link, createdAt, updatedAt, completedAt)`, indexed by `(userId, status)`.
- Full CRUD: `GET/POST /api/tasks`, `PUT/DELETE /api/tasks/:id` — all scoped to the
  authenticated user and gated by the new `tasks` feature flag. `completedAt` is set
  automatically when status flips to `done`.
- `tasks` added to `FEATURE_CATALOG` and to the Starter/Professional plan bundles.
- Store: `tasks` state + `fetchTasks/addTask/updateTask/deleteTask`.
- `MyTasks` page: status filter tabs (all/open/in-progress/done) with live counts,
  one-click status cycling, priority + due-date chips, overdue highlighting, and a
  create/edit modal. Nav entry under GENERAL.

**Files:** `server.ts`, `src/store.ts`, `src/types.ts`, `src/pages/MyTasks.tsx`, `src/App.tsx`

---

## 11. Usage analytics UI

**How:** `UsageAnalyticsPanel` on the Financials page (gated by `canViewRevenue` +
`usage` flag): live entity counts, "documents created by type" and "most active
users" bar charts, with a 7/30/90-day / all-time range selector wired to the existing
`GET /api/usage?since=` endpoint.

**Files:** `src/pages/Reports.tsx`

---

## 12. Numbering sequence editor (Settings)

**How:** replaced the dead hardcoded "Document Prefixes" placeholder with a live
`NumberingSequencesPanel` (Settings → Document) backed by `GET /api/sequences` /
`PUT /api/sequences/:docType`. Per-type editing of prefix, padding, and reset period
with a live "next number" preview mirroring the server format.

**Files:** `src/pages/Settings.tsx`

---

## 13. Route-level feature guards

**How:** deep-linking to a disabled module now renders a "Module not available"
notice (with a back-to-dashboard action) instead of the page. A `pageFeature` map
drives the guard in `App.renderActiveView`, complementing the already-hidden nav.

**Files:** `src/App.tsx`

---

## 14. Modern UI refresh + density control

**How:**
- Design-system polish in `index.css`: top-light gradient + hover-lift on
  `.premium-card.interactive`, gradient primary button (`.btn-gradient`), `kbd`
  chips, gradient text helper, and `scale-in` / `shimmer` animations.
- **UI density toggle** (Comfortable / Compact) driven by `data-density` on `<html>`,
  which scales the rem base (16px ↔ 14.5px) so all rem-based spacing & type track
  together. Persisted to `localStorage`, toggled from the header (and ⌘K).

**Files:** `src/index.css`, `src/store.ts`, `src/App.tsx`

---

## 15. Global Command Palette (⌘K) + keyboard shortcuts

**Why:** fast, modern navigation across a large dataset.

**How:**
- `CommandPalette` component: ⌘/Ctrl-K opens a fuzzy search over nav, quick actions
  (new quote/invoice, theme, density), and live records (quotations, invoices,
  customers, products) with grouped results, arrow/enter navigation, and feature-flag
  filtering.
- Keyboard layer: `?` help overlay, `n` = new quote, `g`-chords (`g d/q/i/b/c/p/t/r/s`)
  jump between sections; suppressed while typing in inputs.
- Header gains a "Search… ⌘K" trigger.

**Files:** `src/components/CommandPalette.tsx`, `src/App.tsx`

---

## 16. Live, data-driven Dashboard

**Why:** the dashboard chart and activity feed were hardcoded mock data.

**How:**
- 12-month revenue series bucketed from real invoice dates, rendered as a modern
  gradient **area+line SVG** with hover values (replaces the static bar mock).
- **Sales funnel** with real counts (Quotations → Confirmed → Invoiced → Paid).
- **Recent activity feed** pulled from `GET /api/audit` (gated by `canViewHistory` +
  `tracking`), with relative timestamps, action icons, click-through to the document,
  and graceful empty/permission states. Removed the `mockUsers` dependency.

**Files:** `src/pages/Dashboard.tsx`

---

## 17. Kanban pipeline (invoices) + bug fix

**How:**
- **Invoices Kanban** board added (mirrors the existing Quotations board): list/board
  toggle, columns by status, native HTML5 drag-to-change-status. `partial`/`paid`
  columns are **display-only** (those statuses are derived from recorded payments),
  so dropping there is ignored and the columns are visually marked.
- **Fix:** `Quotations` used `FileSpreadsheet` in its empty-state without importing it
  — an empty/filtered-to-zero quotations list would crash. Added the import (and
  dropped genuinely unused icon imports).

**Files:** `src/pages/Invoices.tsx`, `src/pages/Quotations.tsx`

---

## Suggested advanced features (backlog)

Proposed during the UI pass; **#1, #4, #7, #8 were implemented** (above). Remaining:
- (2) Customer self-service portal
- (3) Multi-currency with live FX rates
- (5) Automated email/WhatsApp follow-up reminders
- (6) Recurring invoices & subscriptions

---

## Remaining work

### Full multi-company / multi-tenancy (largest item)
- `companies`, `user_companies`, `company_features` tables.
- `companyId` on quotations, invoices, boq, customers, products, suppliers.
- Scope **every** query by active company; company switcher in header.
- Per-company settings, numbering sequences, branding, and feature flags
  (current flags are global but built company-ready).
- Owner surface to create companies, invite admins, assign plans.

### Legacy features still to port
- **AI Assistant** (OpenRouter SQL chat) behind `canUseAI`.
- **Tracking page** (advanced filters, bulk status, follow-up date/note).
- **Version diff viewer** + timeline "undo/restore" actions.

### Polish / smaller gaps
- **BOM** full visual + PDF parity with BOQ.
- **Markup/cost-base** UI parity on the Invoice editor (exists on Quotation).
- General UI/UX redesign pass (Phase 7).

---

## Deferred decisions / notes for reviewers

- `server.ts` runs via `tsx` and is **not** type-checked by the build; the frontend
  is (`tsc --noEmit`).
- All DB changes are additive (`addColumnIfNotExists`, `CREATE TABLE IF NOT EXISTS`).
- Deleting a document does **not** roll back its number (gaps are expected/safe).
