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

## 18. Tracking & Follow-ups page

**Why:** legacy had a dedicated tracking surface (advanced filters, bulk status,
follow-up date/note); requested under Remaining.

**How:**
- New `followUpDate` / `followUpNote` columns on quotations & invoices, updated via
  **dedicated** lightweight endpoints `PUT /api/quotes/:id/followup` and
  `/api/invoices/:id/followup` (gated by `tracking`) — kept separate from the heavy
  editor PUT so document saves never clobber follow-up data. `GET` already uses
  `SELECT *`, so the fields flow through automatically.
- `setFollowUp` store action (optimistic local update on success).
- `Tracking` page: Quotations/Invoices toggle, search, status pills, date-range,
  and a follow-up filter (has / due today / overdue / none) with an overdue badge.
  Row-level follow-up chips (colour-coded: overdue/today/upcoming) + note, a
  single/bulk follow-up editor modal, and bulk status changes (manual transitions
  only — invoice `paid`/`partial` excluded as payment-derived).
- Wired into nav (SALES), routing, the route-feature guard, and the ⌘K palette,
  all gated by the existing `tracking` flag.

**Files:** `server.ts`, `src/store.ts`, `src/types.ts`, `src/pages/Tracking.tsx`,
`src/App.tsx`, `src/components/CommandPalette.tsx`

---

## 19. Multi-company / multi-tenancy

**Why:** the largest requested item — isolate data per company with a switcher.

**How (backend):**
- New `companies` and `user_companies` tables. A single **default company** is
  seeded from existing settings (named after the current company profile), all
  legacy rows are **backfilled** into it, and every existing user is enrolled
  (admins as `owner`). Verified: 0 null-`companyId` rows post-migration.
- `companyId` column added to the five scoped tables: `customers`, `products`,
  `quotations`, `invoices`, `boq`. **Every** list/get/create/update/delete is
  scoped by the active company (writes also guard `AND companyId = ?`).
- Active company is resolved per request from an `X-Company-Id` header, with a
  **deterministic fallback** to the default company (so legacy/headerless requests
  keep working unchanged).
- Endpoints: `GET /api/companies` (memberships + active), `POST /api/companies`
  (creator becomes owner), `PUT /api/companies/:id` (owner/admin rename/replan).
- The live DB was backed up to `quotes.db.pre-multitenancy.bak` before migrating.

**How (frontend):**
- `apiFetch` sends `X-Company-Id` from `localStorage` on every request.
- Store: `companies` / `activeCompanyId`, `fetchCompanies`, `createCompany`, and
  `switchCompany` (clears scoped data + active-doc pointers and re-initializes).
- **Header company switcher**: lists memberships with the active one checked,
  inline "new company" create that auto-switches.

**Verified:** existing data stays in the default company (415 quotes / 232
customers); a new company starts empty (0/0); switching back restores the original;
isolation holds with explicit headers. No console errors.

**Deferred (phase 2):** per-company numbering sequences, branding & feature flags
(currently global; columns are company-ready); scoping suppliers (global UNIQUE
name), audit/usage/exports/PDF-by-id; owner UI to invite users & assign plans.

**Files:** `server.ts`, `src/store.ts`, `src/types.ts`, `src/App.tsx`

---

## 20. Platform super-admin control plane + notifications

**How:** `users.isSuperAdmin` (existing admin auto-promoted), company `status`
(active/suspended) + unique `slug`; tenant resolved from subdomain host → header →
default; `requireSuperAdmin`; suspended-tenant login block. Endpoints (super-admin):
`GET/POST/PATCH/DELETE /api/admin/companies`, `POST /api/admin/notifications`
(all / company / user), `GET /api/admin/users`. New **Platform Admin** page
(super-admin only): tenant list w/ status + counts + access URL, create / suspend /
activate / delete (default protected), and an in-app **notification composer**.
Verified: list/create/suspend/delete + broadcast delivery.

**Files:** `server.ts`, `src/pages/SuperAdmin.tsx`, `src/App.tsx`, `src/components/CommandPalette.tsx`

---

## 21. Theming — muted default + presets, company + per-user

**How:** muted **"Slate"** default palette (calmer dark, neon/gradient toned down);
`src/theme.ts` with 7 presets + runtime accent resolution: **user accent → user
preset → company theme → default**. Company theme persisted in `companies.settings`
(exposed in `GET /api/companies`, set via `PUT /api/companies/:id`); per-user
accent/preset in `localStorage`. `applyActiveTheme()` re-resolves on light/dark and
company switch. Settings → Appearance gains a preset picker, custom accent, and a
company-theme block (owner/admin). Verified live: preset switch + dark-variant.

**Files:** `src/theme.ts`, `src/index.css`, `src/store.ts`, `src/App.tsx`, `src/pages/Settings.tsx`

---

## 22. App-wide autosave

**How:** new reusable `useDebouncedAutosave` hook powers save-on-edit across the
entity dialogs — **My Tasks, Customers, Products, Suppliers**: editing an existing
record autosaves (debounced 800ms) with a Saving…/Saved indicator and a "Done"
button; creating stays explicit. **BOQ/BOM** and the **quotation/invoice** editors
already autosave via `useAutoSave`. Verified: Customers edit persisted server-side
with no explicit save, no console errors.

**Files:** `src/hooks/useDebouncedAutosave.ts`, `src/pages/{MyTasks,Customers,Products,Suppliers}.tsx`

---

## 23. Muted UI pass

**How:** the muted "Slate" palette (§21) is applied globally via design tokens and
verified coherent in **both light and dark** (calmer near-black dark surfaces,
muted accent, neon/gradients toned down). Theming is fully token-driven so the pass
is consistent across pages.

**Files:** `src/index.css`, `src/theme.ts`

---

## 24. Standalone platform control plane + more

**Why:** the super-admin panel was a page *inside* the tenant sidebar; it needed to
be a genuinely separate control plane.

**How:**
- **`PlatformShell`** — a full-screen layout (its own "Qvoke Platform" sidebar +
  header) that App renders *instead of* the company workspace when a super-admin is
  on `platform-admin`. Tabs: **Overview** (aggregate stats), **Companies** (tenant
  CRUD + suspend + **Enter** a company's workspace), **Users** (promote/demote
  super-admin, guarded against removing the last one), **Notifications** (composer).
  "Enter Workspace" exits back to the tenant app. Replaces the old embedded page.
- New endpoints: `GET /api/admin/overview`, `PATCH /api/admin/users/:id`
  (super-admin flag), extended `GET /api/admin/users` (role + isSuperAdmin + company
  count).
- **More themes**: 12 presets total (added Violet, Sky, Crimson, Forest, Copper);
  **`Theme: …` commands in ⌘K** for instant switching.
- **Logic fix**: subdomain tenant resolution now requires `sub.domain.tld` (3+
  labels) so an apex domain can't be mistaken for a tenant slug.

**Verified:** separate shell renders (no company sidebar), overview/users/enter all
work, last-super-admin demotion blocked (400), theme commands switch live.

**Files:** `server.ts`, `src/pages/PlatformShell.tsx` (new, replaces `SuperAdmin.tsx`),
`src/App.tsx`, `src/theme.ts`, `src/components/CommandPalette.tsx`

---

## 25. Liquid-glass Desktop Workspace

**Why:** adopt the strongest WebOSx interaction ideas without replacing the
reliable, responsive ERP layout.

**How:**
- Optional desktop-only workspace entered from the header window icon or the
  `Open Desktop Workspace` command in the command palette.
- Searchable application launcher, desktop shortcuts, liquid-glass menu/taskbar
  and draggable/resizable ERP windows with minimize, maximize, close and restore.
- Dense ERP content remains opaque and readable inside each window; glass is
  limited to window chrome, launcher and taskbar.
- Opening routes/documents creates or focuses route-aware taskbar windows.
- Open windows, placement, size and state persist in `localStorage`, isolated by
  user and active company.
- Standard ERP remains one click away; screens below 1024px automatically use the
  existing responsive interface even if desktop mode is selected.

**Verified:** production build passes; launcher renders 14 apps; dashboard and
quotations coexist as two independent windows; taskbar minimize/restore works;
desktop framing and mobile fallback tested at 1440×900 and 390×844; no console
warnings/errors.

**Files:** `src/components/DesktopWorkspace.tsx`, `src/App.tsx`, `src/store.ts`,
`src/components/CommandPalette.tsx`, `src/index.css`, `README.md`

---

## Suggested advanced features (backlog)

Proposed during the UI pass; **#1, #4, #7, #8 were implemented** (above). Remaining:
- (2) Customer self-service portal
- (3) Multi-currency with live FX rates
- (5) Automated email/WhatsApp follow-up reminders
- (6) Recurring invoices & subscriptions

---

## Remaining work

### Multi-tenancy — phase 2 (foundation shipped in §19)
- Per-company numbering sequences, branding, and feature flags (currently global).
- Scope the remaining surfaces: suppliers, audit/usage, Excel exports, PDF-by-id.
- Owner surface to invite users to a company and assign plans/roles.

### Legacy features still to port
- **AI Assistant** (OpenRouter SQL chat) behind `canUseAI`.
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
