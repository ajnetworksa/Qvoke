<div align="center">

  <img src="public/qvoke_3d_logo.jpg" alt="Qvoke ERP Logo" width="180" style="border-radius: 28px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);" />

  # Qvoke ERP & Billing System
  ### Next-Generation Enterprise Operations, ZATCA E-Invoicing & Retail POS

  <p align="center">
    <b>A modern bilingual enterprise ERP engineered for high-growth businesses.</b><br/>
    Quotations, ZATCA Phase 1 & 2 E-Invoicing, Real-Time Mobile POS, Expense Control, Warehouse Inventory, Subscription Billing, and Tokenized Client Approval Portals with E-Signatures.
  </p>

  <p align="center">
    <a href="#-visual-theme-engine"><img src="https://img.shields.io/badge/Themes-9_Aesthetics-087f78?style=for-the-badge&logo=palette" alt="9 Themes" /></a>
    <a href="#-saudi-zatca-phase-1--2-compliance"><img src="https://img.shields.io/badge/ZATCA-Phase_1_%26_2_Compliant-059669?style=for-the-badge&logo=shield" alt="ZATCA" /></a>
    <a href="#-tech-stack"><img src="https://img.shields.io/badge/Stack-React_18_%2B_Vite_%2B_Node_%2B_SQLite-3b82f6?style=for-the-badge&logo=typescript" alt="Tech Stack" /></a>
    <a href="#-mobile--handheld-pos-ergonomics"><img src="https://img.shields.io/badge/PWA-Mobile_%26_Handheld_POS-8b5cf6?style=for-the-badge&logo=android" alt="PWA" /></a>
  </p>

</div>

---

## 📸 System Showcase & Visual Mockups

<div align="center">
  <h3>🖥️ Enterprise Dashboard & Multi-Device Operations</h3>
  <img src="public/qvoke_marketing_hero.jpg" alt="Qvoke ERP Enterprise Dashboard Mockup" width="100%" style="border-radius: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.6);" />
  <p><i>Live financial analytics, revenue tracking, ZATCA compliant invoices, inventory stock meters, and digital approval notifications.</i></p>
</div>

<br/>

<div align="center">
  <h3>📱 Mobile Ergonomics & Handheld POS Checkout</h3>
  <img src="public/qvoke_mobile_pos.jpg" alt="Qvoke Mobile POS & Retail Billing" width="100%" style="border-radius: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.6);" />
  <p><i>High-speed barcode checkout, automated inventory deductions, and instant ZATCA thermal receipt printing for mobile & retail registers.</i></p>
</div>

---

## ⚡ Benchmark Feature Highlights

| Module | Benchmark Reference | Capabilities & Specifications |
| :--- | :--- | :--- |
| **Smart Quotations & RFQ Engine** | Odoo Sales / CPQ | AI document parser, margin markup calculator, sectioned line items, Arabic/English translation, and PDF export. |
| **ZATCA E-Invoicing** | Saudi Tax Authority | Cryptographic Base64 TLV QR codes (Tags 1–5), dual-currency (SAR/USD), automated VAT 15%, payment tracking, and audit ledgers. |
| **Retail & Mobile POS** | Square / Clover POS | Fast barcode scanning, cash/card split tenders, instant thermal receipt formatting, and real-time inventory deduction. |
| **Operational Expenses** | ERPNext / QuickBooks | Expense classification, vendor tracking, pre-tax/VAT breakdown, and ZATCA tax-deductible input ledgers. |
| **Recurring Billing** | Stripe Subscriptions | Automated subscription cycles (weekly, monthly, quarterly, annual), instant generation triggers, and status control. |
| **Stock Inventory** | Zoho Inventory | Stock alerts, reorder thresholds, manual adjustment modal, and automated movement audit logging. |
| **Client Portal & E-Sign** | PandaDoc / DocuSign | Tokenized public links (WhatsApp/Email), interactive proposal review, and client digital signature sign-off. |
| **Multi-Tenant Security** | Enterprise RBAC | Tenant-scoped data isolation, granular permissions matrix, and role-based access control. |

---

## 🎨 Visual Theme Engine (9 Themes)

Qvoke includes a built-in **Design Studio** allowing instantaneous switching between 9 visual aesthetics:

1. **Modern Default**: Ultra-clean, high-contrast enterprise design system.
2. **Glassmorphism**: Translucent frosted glass layers with `backdrop-filter: blur(16px)` and specular neon edge glows.
3. **Neumorphism**: 3D embossed tactile surfaces with dual-layer soft bevel shadows.
4. **Cyberpunk**: High-contrast neon yellow, cyan, and deep obsidian dark mode.
5. **Synthwave**: 80s retro neon magenta and purple gradient vibes.
6. **Luxury**: Sophisticated champagne gold typography on obsidian black.
7. **Emerald**: Clean natural mint and jade green healthcare/fintech theme.
8. **Cupcake**: Playful pastel pink and mint styling.
9. **Retro**: Warm nostalgic amber parchment paper styling.

---

## 📱 Mobile & Handheld POS Ergonomics

- **Thumb-Zone Bottom Navigation**: Fixed ergonomic bottom bar on smartphone screens for one-handed operational access.
- **Floating Action Button (FAB)**: Quick-launch menu to create Quotes, Invoices, Expenses, or POS sales with 1 tap.
- **PWA Ready**: Web App Manifest (`public/manifest.json`), viewport optimization (`viewport-fit=cover, user-scalable=no`), and offline asset caching.

---

## 🇸🇦 Saudi ZATCA Phase 1 & 2 Compliance

Qvoke generates compliant TLV (Tag-Length-Value) Base64 QR codes:
- **Tag 1**: Seller Name (`AJ NETWORK SOLUTIONS`)
- **Tag 2**: VAT Registration Number (`310123456700003`)
- **Tag 3**: Electronic Timestamp (`ISO 8601 UTC`)
- **Tag 4**: Invoice Total with VAT (`SAR`)
- **Tag 5**: Total VAT Amount (`15%`)

---

## 🔧 Tech Stack & Architecture

```
Qvoke Architecture:
┌─────────────────────────────────────────────────────────────┐
│                      Client Layer                           │
│  React 18 + TypeScript + Tailwind CSS + Zustand + Lucide   │
└──────────────────────────────┬──────────────────────────────┘
                               │ REST / WebSocket / HTTP
┌──────────────────────────────▼──────────────────────────────┐
│                   Express API & Node Engine                 │
│  • Authentication (JWT & Sessions)                         │
│  • ZATCA TLV QR Cryptographic Generator                     │
│  • Stock Movement & Document Sequence Engines               │
│  • Client Approval Portal & E-Sign Engine                   │
│  • Server-Side PDF & Excel Generators                       │
└──────────────────────────────┬──────────────────────────────┘
                               │ better-sqlite3
┌──────────────────────────────▼──────────────────────────────┐
│                    SQLite Database (quotes.db)              │
│  users • quotations • invoices • expenses • inventory       │
│  recurring_invoices • public_shares • document_activity     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start & Installation

### Prerequisites
- **Node.js** ≥ 18.x
- **npm** ≥ 9.x
- Windows / macOS / Linux

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/ajnetworksa/Qvoke.git
cd Qvoke
npm install
```

### 2. Environment Configuration
Create a `.env` file from `.env.example`:
```bash
PORT=3000
ADMIN_PORT=3001
JWT_SECRET=your_super_secret_production_key_here
DB_PATH=quotes.db
NODE_ENV=development
```

### 3. Launch Development Server
```bash
npm run dev
```
- 🌐 **Qvoke ERP App**: `http://localhost:3000`
- 🛡️ **Admin Panel Backend**: `http://localhost:3001`

### 4. Default Admin Login
- **Email**: `admin@ajnetwork.sa`
- **Password**: `admin123`

---

## 🧪 Automated Testing & Security Audit Suite

Execute the automated test suite testing multi-tenant isolation, sequences, stock deductions, expenses, and ZATCA compliance:

```bash
npx tsx test-suite.ts
```

Output:
```
✔ PASS [Security] Tenant Isolation: Prevent cross-tenant expense leakage
✔ PASS [Security] Tenant Isolation: Scoped Public Portal Token validation
✔ PASS [Sequences] Atomic Sequence Generation for all document types
✔ PASS [Inventory] Stock adjustment and automatic deduction on invoice posting
✔ PASS [Finance] Expense pre-tax and VAT math verification
✔ PASS [Subscriptions] Recurring subscription schedule creation & trigger
✔ PASS [ClientPortal] Client electronic signature approval workflow
✔ PASS [ZATCA] TLV QR encoding produces compliant Base64 string with all 5 tags

Total: 8 / 8 Tests Passed (100% Success Rate)
```

---

## 🌐 Core API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/login` | Authenticate user & issue session token |
| `GET` | `/api/quotes` | List tenant quotations |
| `POST` | `/api/quotes` | Create quotation with automatic sequence |
| `GET` | `/api/invoices` | List invoices with payment reconciliation |
| `POST` | `/api/invoices` | Post invoice & auto-deduct inventory stock |
| `GET` | `/api/expenses` | Retrieve operational expense ledger |
| `POST` | `/api/expenses` | Record new expense with VAT breakdown |
| `GET` | `/api/recurring-invoices` | List active subscription schedules |
| `POST` | `/api/recurring-invoices/:id/generate` | Trigger instant invoice generation |
| `GET` | `/api/inventory/logs` | Retrieve warehouse stock audit trail |
| `POST` | `/api/inventory/adjust` | Manual inward/outward stock adjustment |
| `POST` | `/api/portal/generate-link/:docType/:docId` | Generate public share token for clients |
| `GET` | `/api/portal/:docType/:token` | Unauthenticated public client view |
| `POST` | `/api/portal/:docType/:token/accept` | Client e-signature sign-off |

---

## 📦 Production Build & Deployment

```bash
# Build optimized production bundle
npm run build

# Start production server
NODE_ENV=production npx tsx server.ts
```

---

## 📄 License & Attribution

Proprietary Software — **AJ Network Solutions** © 2025–2026. All rights reserved.
