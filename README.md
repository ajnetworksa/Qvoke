# AJ Network ERP

> **Premium bilingual ERP system** for SMEs — Quotations, Invoices, BOQ, Customer & Supplier management with full Arabic/English support, dark-mode UI, and server-side PDF generation.

---

## ✨ Feature Highlights

| Module | Features |
|---|---|
| **Quotations** | Drag-sort line items, sections, notes · Markup calculator · Auto-translate Arabic · Watermarks · PDF export |
| **Invoices** | Same engine as quotations · Dual-currency · Payment tracking · Convert from quotation |
| **BOQ** | Bill of Quantities with sectioned items, live totals, project status tracking |
| **Customers** | Quick-create from quotation · Excel import/export · Full address book |
| **Suppliers** | Catalog management · Bulk product copy/move · Excel import/export |
| **Products** | Service & product catalog · Tax rate · Excel import/export · Quick-create from quote |
| **Financials** | Revenue, outstanding, VAT summaries · Period filters · Usage analytics (activity by type & user) |
| **My Tasks** | Per-user task / pending-work tracker · priority, due dates & status board · overdue alerts |
| **Command Palette** | ⌘K fuzzy search across documents, customers & actions · global keyboard shortcuts |
| **Audit Trail** | Per-document timeline (who created / changed what) · global audit log · in-app notifications |
| **Plans & Features** | Toggle modules on/off · Starter / Professional / Enterprise presets · route-level guards |
| **Settings** | Site logo · PDF logo · PDF header/footer styling · Watermark config · User RBAC · Document numbering sequences |
| **Backup & Restore** | SQLite snapshots · Download/upload .db files · Full Excel export (all tables) |
| **Dual Logo** | Separate site logo (sidebar) vs PDF header logo |
| **Appearance** | Light / dark / system theme · Comfortable / Compact density · modern UI refresh |

---

## 🔧 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS v4 + CSS variables |
| State | Zustand |
| Backend | Express + TypeScript (tsx runtime) |
| Database | SQLite via `better-sqlite3` |
| PDF Engine | `@react-pdf/renderer` (server-side) |
| Excel | SheetJS (`xlsx`) |
| File Upload | `multer` |
| Auth | JWT (`jsonwebtoken`) |
| Fonts | Inter (body) · Tajawal (Arabic PDF) |

---

## 🚀 Installation

### Prerequisites
- **Node.js** ≥ 18.x
- **npm** ≥ 9.x
- Windows / Linux / macOS

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/aj-network-erp.git
cd "aj-network-erp"
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Copy the example environment file and edit:

```bash
copy .env.example .env
```

`.env` options:

```env
# Server port (default: 3001)
PORT=3001

# JWT secret — change this to a long random string in production!
JWT_SECRET=change-this-to-a-very-long-random-secret-key

# Application display name
VITE_APP_NAME=AJ Network ERP

# Database file path (relative to project root)
DB_PATH=quotes.db

# Node environment
NODE_ENV=development
```

### 4. Start Development Server

```bash
npm run dev
```

The app will be available at **http://localhost:3001**

> The dev server runs both the Vite HMR frontend and the Express API on the same port via Vite middleware mode.

### 5. Default Login Credentials

| Username | Password | Role |
|---|---|---|
| `admin` | `admin123` | Administrator |
| `salesperson` | `sales123` | Sales |
| `viewer` | `view123` | Read-only |

> ⚠️ **Change default passwords immediately** in Settings → User Roles after first login.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl` / `⌘` + `K` | Open the command palette (search documents, customers & actions) |
| `?` | Show the keyboard-shortcuts help overlay |
| `n` | New quotation |
| `g` then `d / q / i / b / c / p / t / r / s` | Jump to Dashboard / Quotations / Invoices / BOQ / Customers / Products / Tasks / Financials / Settings |
| `Esc` | Close palette / overlay |

> Shortcuts are suppressed while typing in an input, textarea, or select.

---

## 🏗️ Project Structure

```
New ERP/
├── server.ts               # Express API server (all REST routes + PDF engine)
├── src/
│   ├── App.tsx             # Root layout, sidebar navigation, routing
│   ├── store.ts            # Zustand global state + API fetch layer
│   ├── types.ts            # TypeScript interfaces
│   ├── index.css           # Design tokens + dark/light theme
│   ├── components/
│   │   ├── CommandPalette.tsx      # ⌘K command palette + keyboard shortcuts
│   │   ├── NotificationBell.tsx    # In-app notifications dropdown
│   │   ├── DocumentTimeline.tsx    # Per-document audit/activity timeline
│   │   ├── CustomerCombobox.tsx    # Customer selector with quick-create
│   │   ├── ProductCombobox.tsx     # Product selector with quick-create
│   │   ├── DatabaseBackupDB.tsx    # Backup/restore + full Excel export
│   │   ├── ExcelImportExport.tsx   # Reusable Excel import/export modal
│   │   ├── PDFPreviewModal.tsx     # In-browser PDF preview
│   │   ├── EmailSendModal.tsx      # Email delivery modal
│   │   └── ...
│   ├── hooks/
│   │   ├── useAutoSave.ts          # Debounced autosave
│   │   └── useDraft.ts             # localStorage-backed draft persistence
│   ├── pages/
│   │   ├── Dashboard.tsx           # Live KPIs, revenue chart, funnel, activity feed
│   │   ├── MyTasks.tsx             # Personal task / pending-work tracker
│   │   ├── QuotationDetail.tsx     # Full quotation editor
│   │   ├── InvoiceDetail.tsx       # Full invoice editor
│   │   ├── BOQ.tsx                 # Bill of Quantities / Materials
│   │   ├── Customers.tsx
│   │   ├── Suppliers.tsx
│   │   ├── Products.tsx
│   │   ├── Reports.tsx             # Financials + usage analytics
│   │   └── Settings.tsx            # Company, plan & features, numbering, appearance
│   └── utils/
│       └── search.ts               # Universal fuzzy search utility
├── pdf/
│   └── quote-document.tsx          # @react-pdf/renderer document template
├── docs/
│   └── CHANGES.md                  # Detailed change log & implementation notes
├── backups/                        # SQLite backup snapshots (git-ignored)
├── quotes.db                       # Live SQLite database (git-ignored)
├── .env                            # Environment secrets (git-ignored)
└── package.json
```

---

## 📦 Production Build

```bash
npm run build
```

Then start the production server:

```bash
NODE_ENV=production node dist/server.js
```

> The Express server will serve the compiled Vite bundle from `dist/` and handle all `/api/*` routes.

---

## 🔒 User Roles & Permissions (RBAC)

| Permission | Admin | Manager | Salesperson | Viewer |
|---|:---:|:---:|:---:|:---:|
| View all data | ✅ | ✅ | ✅ | ✅ |
| Create / edit quotes & invoices | ✅ | ✅ | ✅ | ❌ |
| Delete records | ✅ | ✅ | ❌ | ❌ |
| Override prices (markup) | ✅ | ✅ | ❌ | ❌ |
| Manage settings & users | ✅ | ❌ | ❌ | ❌ |
| Import / Export Excel | ✅ | ✅ | ❌ | ❌ |
| Database backup & restore | ✅ | ❌ | ❌ | ❌ |

---

## 🗄️ Backup & Data Migration

### Create Snapshot
Settings → Database & Backups → **Take Snapshot**

### Download & Restore
- Click **Download** (↓) next to any snapshot to save a `.db` file locally
- Click **Restore** to roll back the live database
- Drag and drop a `.db` file via **Restore from Uploaded File** to import a backup from another machine

### Full Excel Export
Settings → Database & Backups → **Export Full Excel**

Downloads a single `.xlsx` workbook with sheets for:
- Products · Customers · Suppliers · Quotations · Invoices

---

## 🌐 API Reference (Summary)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/quotes` | List all quotations |
| `POST` | `/api/quotes` | Create quotation (number assigned server-side) |
| `PUT` | `/api/quotes/:id` | Update quotation |
| `GET` | `/api/invoices` · `/api/boq` | List invoices / BOQ-BOM |
| `GET` | `/api/sequences` · `PUT /api/sequences/:docType` | Read / edit document numbering |
| `GET` / `POST` / `PUT` / `DELETE` | `/api/tasks` | Personal task tracker (per user) |
| `GET` | `/api/usage` | Usage analytics (activity by type & user) |
| `GET` | `/api/activity/:docType/:docId` · `/api/audit` | Per-document & global audit trail |
| `GET` / `PUT` | `/api/features` | Active plan & feature flags |
| `GET` | `/api/notifications` · `POST /api/notifications/refresh` | In-app notifications |
| `GET` | `/api/pdf/quotation/:id` | Download PDF |
| `GET` | `/api/export/full` | Full Excel export |
| `POST` | `/api/import/products` | Bulk import products |
| `POST` | `/api/admin/backup` | Create DB snapshot |
| `GET` | `/api/admin/backup/download/:file` | Download snapshot |
| `POST` | `/api/admin/restore` | Restore from snapshot |
| `POST` | `/api/admin/restore/upload` | Restore from uploaded .db |
| `POST` | `/api/translate` | Auto-translate EN→AR |

---

## 📄 License

Private / Proprietary — AJ Network © 2025–2026. All rights reserved.
