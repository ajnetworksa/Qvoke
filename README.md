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
| **Financials** | Revenue, outstanding, VAT summaries · Period filters |
| **Settings** | Site logo · PDF logo · PDF header/footer styling · Watermark config · User RBAC |
| **Backup & Restore** | SQLite snapshots · Download/upload .db files · Full Excel export (all tables) |
| **Dual Logo** | Separate site logo (sidebar) vs PDF header logo |

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
│   │   ├── CustomerCombobox.tsx    # Customer selector with quick-create
│   │   ├── ProductCombobox.tsx     # Product selector with quick-create
│   │   ├── DatabaseBackupDB.tsx    # Backup/restore + full Excel export
│   │   ├── ExcelImportExport.tsx   # Reusable Excel import/export modal
│   │   ├── PDFPreviewModal.tsx     # In-browser PDF preview
│   │   ├── EmailSendModal.tsx      # Email delivery modal
│   │   └── ...
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── QuotationDetail.tsx     # Full quotation editor
│   │   ├── InvoiceDetail.tsx       # Full invoice editor
│   │   ├── BOQ.tsx                 # Bill of Quantities
│   │   ├── Customers.tsx
│   │   ├── Suppliers.tsx
│   │   ├── Products.tsx
│   │   ├── Reports.tsx
│   │   └── Settings.tsx
│   └── utils/
│       └── search.ts               # Universal fuzzy search utility
├── pdf/
│   └── quote-document.tsx          # @react-pdf/renderer document template
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
| `GET` | `/api/quotations` | List all quotations |
| `POST` | `/api/quotations` | Create quotation |
| `PUT` | `/api/quotations/:id` | Update quotation |
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
