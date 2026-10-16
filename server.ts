// =============================================================================
// server.ts — Express + SQLite Backend for New ERP
// =============================================================================
import express from 'express';
import http from 'http';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import { QuotePdfDocument } from './src/pdf/quote-document.tsx';
import { exec } from 'child_process';
import OpenAI from 'openai';
import QRCode from 'qrcode';
import { generateZatcaQRBase64 } from './src/utils/zatca.ts';

const app = express();
app.set('trust proxy', 1);

// ── ENVIRONMENT CONFIGURATION ─────────────────────────────────────────────────
const PORT = Number(process.env.PORT || process.env.VITE_PORT) || 3000;
const ADMIN_PORT = Number(process.env.ADMIN_PORT || process.env.VITE_ADMIN_PORT) || 3001;
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 12;
const DB_PATH = process.env.DB_PATH || 'quotes.db';
const SESSION_EXPIRY_DAYS = Number(process.env.SESSION_EXPIRY_DAYS) || 30;

// Initialize SQLite Database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL'); // Enable WAL for multiple connections/tabs

// Initialize System Logs Table
db.exec(`
  CREATE TABLE IF NOT EXISTS system_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    details TEXT,
    user_id TEXT,
    username TEXT
  );
`);

// Global Logging Helper
function logSystemEvent(type: 'info' | 'error' | 'warn', message: string, details?: any, userId?: string, username?: string) {
  let isEnabled = true;
  if (type !== 'error') {
    try {
      const settingRow = db.prepare("SELECT value FROM settings WHERE key = 'detailedLogsEnabled'").get() as { value: string } | undefined;
      isEnabled = settingRow ? settingRow.value === 'true' : true; // Default to true if not set
    } catch {
      isEnabled = true;
    }
  }

  if (!isEnabled) return;

  try {
    const detailsStr = details ? (typeof details === 'string' ? details : JSON.stringify(details, null, 2)) : null;
    db.prepare(`
      INSERT INTO system_logs (type, message, details, user_id, username, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(type, message, detailsStr, userId || null, username || null, new Date().toISOString());
  } catch (err) {
    console.error('Failed to write system log:', err);
  }
}


// Dynamic migrations to add missing columns
function addColumnIfNotExists(table: string, column: string, type: string) {
  try {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`).run();
    console.log(`Added column ${column} to table ${table}`);
  } catch (err: any) {
    // Column already exists or table doesn't exist yet
  }
}

// ── DATABASE TABLE DEFINITIONS ────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    permissions TEXT NOT NULL DEFAULT '{}',
    avatar TEXT
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    companyName TEXT NOT NULL,
    contactPerson TEXT,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    vatNumber TEXT,
    billingAddress TEXT NOT NULL, -- JSON string
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL,
    unitPrice REAL NOT NULL,
    unit TEXT NOT NULL,
    taxRate REAL NOT NULL,
    categoryId TEXT,
    itemCode TEXT,
    supplierName TEXT
  );

  CREATE TABLE IF NOT EXISTS quotations (
    id TEXT PRIMARY KEY,
    number TEXT UNIQUE NOT NULL,
    customerId TEXT NOT NULL,
    date TEXT NOT NULL,
    validUntil TEXT NOT NULL,
    status TEXT NOT NULL,
    lineItems TEXT NOT NULL, -- JSON string
    notes TEXT,
    terms TEXT,
    currency TEXT NOT NULL,
    subtotal REAL NOT NULL,
    discountTotal REAL NOT NULL,
    taxTotal REAL NOT NULL,
    total REAL NOT NULL,
    linkedInvoiceId TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    salespersonId TEXT,
    watermarkText TEXT DEFAULT 'PAID',
    watermarkType TEXT DEFAULT 'none',
    hidePrices INTEGER DEFAULT 0,
    manualTotal REAL,
    FOREIGN KEY(customerId) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    number TEXT UNIQUE NOT NULL,
    customerId TEXT NOT NULL,
    date TEXT NOT NULL,
    dueDate TEXT NOT NULL,
    status TEXT NOT NULL,
    paymentTerms TEXT NOT NULL,
    lineItems TEXT NOT NULL, -- JSON string
    notes TEXT,
    terms TEXT,
    currency TEXT NOT NULL,
    subtotal REAL NOT NULL,
    discountTotal REAL NOT NULL,
    taxTotal REAL NOT NULL,
    total REAL NOT NULL,
    linkedQuoteId TEXT,
    payments TEXT NOT NULL DEFAULT '[]', -- JSON string
    amountPaid REAL NOT NULL DEFAULT 0,
    amountDue REAL NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    salespersonId TEXT,
    watermarkText TEXT DEFAULT 'PAID',
    watermarkType TEXT DEFAULT 'none',
    hidePrices INTEGER DEFAULT 0,
    manualTotal REAL,
    FOREIGN KEY(customerId) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS permission_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    permissions TEXT NOT NULL DEFAULT '{}', -- JSON string
    members TEXT NOT NULL DEFAULT '[]', -- JSON string array of user IDs
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS sequences (
    docType TEXT PRIMARY KEY,
    prefix TEXT NOT NULL,
    lastNumber INTEGER NOT NULL DEFAULT 0,
    padding INTEGER NOT NULL DEFAULT 4,
    resetPeriod TEXT NOT NULL DEFAULT 'yearly',
    lastYear INTEGER
  );

  -- Per-document audit trail: created/updated/status/diff history with actor attribution
  CREATE TABLE IF NOT EXISTS document_activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    docType TEXT NOT NULL,        -- 'quotation' | 'invoice' | 'boq' | 'bom'
    docId TEXT NOT NULL,
    docNumber TEXT,
    action TEXT NOT NULL,         -- 'created' | 'updated' | 'status_changed' | 'deleted'
    changes TEXT,                 -- JSON array of { field, from, to }
    actorId TEXT,
    actorName TEXT,
    timestamp TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_doc_activity ON document_activity(docType, docId);

  -- Snapshots for document versioning and restore
  CREATE TABLE IF NOT EXISTS document_snapshots (
    id TEXT PRIMARY KEY,
    docType TEXT NOT NULL,
    docId TEXT NOT NULL,
    version INTEGER NOT NULL,
    snapshot TEXT NOT NULL,       -- Full JSON of the document at this version
    actorId TEXT,
    actorName TEXT,
    companyId TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_doc_snapshots ON document_snapshots(docType, docId);

  -- In-app notifications
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT,                  -- null = broadcast to all users
    type TEXT NOT NULL,          -- 'quote_expiring' | 'invoice_overdue' | 'doc_created' | 'doc_updated' | 'system'
    title TEXT NOT NULL,
    body TEXT,
    link TEXT,                    -- e.g. 'quotation:qt-123' for client-side routing
    isRead INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(userId, isRead);

  -- Personal task / pending-work tracker (per user)
  CREATE TABLE IF NOT EXISTS personal_tasks (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    title TEXT NOT NULL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'open',   -- 'open' | 'in_progress' | 'done'
    priority TEXT NOT NULL DEFAULT 'normal', -- 'low' | 'normal' | 'high'
    dueDate TEXT,
    link TEXT,                              -- optional doc link e.g. 'quotation:qt-123'
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    completedAt TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_personal_tasks_user ON personal_tasks(userId, status);

  -- Expenses & Vendor Bills tracking
  CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    number TEXT UNIQUE NOT NULL,
    companyId TEXT NOT NULL,
    category TEXT NOT NULL,
    vendor TEXT,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    taxAmount REAL NOT NULL DEFAULT 0,
    taxRate REAL NOT NULL DEFAULT 15,
    total REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'SAR',
    date TEXT NOT NULL,
    paymentMethod TEXT NOT NULL DEFAULT 'bank_transfer',
    reference TEXT,
    receiptUrl TEXT,
    status TEXT NOT NULL DEFAULT 'paid',
    taxDeductible INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    createdBy TEXT,
    createdByName TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_expenses_company ON expenses(companyId, date);

  -- Recurring Invoices & Subscription schedules
  CREATE TABLE IF NOT EXISTS recurring_invoices (
    id TEXT PRIMARY KEY,
    number TEXT UNIQUE NOT NULL,
    companyId TEXT NOT NULL,
    customerId TEXT NOT NULL,
    profileName TEXT NOT NULL,
    frequency TEXT NOT NULL DEFAULT 'monthly',
    startDate TEXT NOT NULL,
    nextRunDate TEXT NOT NULL,
    endDate TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    autoSendEmail INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'SAR',
    lineItems TEXT NOT NULL,
    notes TEXT,
    terms TEXT,
    total REAL NOT NULL,
    lastGeneratedInvoiceId TEXT,
    lastGeneratedAt TEXT,
    generationCount INTEGER NOT NULL DEFAULT 0,
    createdBy TEXT,
    createdByName TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(customerId) REFERENCES customers(id)
  );
  CREATE INDEX IF NOT EXISTS idx_recurring_company ON recurring_invoices(companyId, status);

  -- Inventory transactions & Stock movement ledger
  CREATE TABLE IF NOT EXISTS inventory_transactions (
    id TEXT PRIMARY KEY,
    companyId TEXT NOT NULL,
    productId TEXT NOT NULL,
    type TEXT NOT NULL,
    quantity REAL NOT NULL,
    previousStock REAL NOT NULL DEFAULT 0,
    newStock REAL NOT NULL DEFAULT 0,
    unitCost REAL,
    referenceDocType TEXT,
    referenceDocId TEXT,
    notes TEXT,
    createdBy TEXT,
    createdByName TEXT,
    createdAt TEXT NOT NULL,
    FOREIGN KEY(productId) REFERENCES products(id)
  );
  CREATE INDEX IF NOT EXISTS idx_inventory_prod ON inventory_transactions(companyId, productId);

  -- Public Shareable Client Portal links with electronic confirmation
  CREATE TABLE IF NOT EXISTS public_shares (
    id TEXT PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,
    companyId TEXT NOT NULL,
    docType TEXT NOT NULL,
    docId TEXT NOT NULL,
    expiresAt TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    viewsCount INTEGER NOT NULL DEFAULT 0,
    lastViewedAt TEXT,
    acceptedAt TEXT,
    acceptedByName TEXT,
    acceptedSignature TEXT,
    feedbackNote TEXT,
    createdAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_public_shares_token ON public_shares(token);
  CREATE INDEX IF NOT EXISTS idx_public_shares_doc ON public_shares(companyId, docType, docId);
`);

// Attribution columns on documents (who created / last updated)
addColumnIfNotExists('quotations', 'createdBy', 'TEXT');
addColumnIfNotExists('quotations', 'createdByName', 'TEXT');
addColumnIfNotExists('quotations', 'updatedBy', 'TEXT');
addColumnIfNotExists('quotations', 'updatedByName', 'TEXT');
addColumnIfNotExists('invoices', 'createdBy', 'TEXT');
addColumnIfNotExists('invoices', 'createdByName', 'TEXT');
addColumnIfNotExists('invoices', 'updatedBy', 'TEXT');
addColumnIfNotExists('invoices', 'updatedByName', 'TEXT');

addColumnIfNotExists('products', 'itemCode', 'TEXT');
addColumnIfNotExists('products', 'supplierName', 'TEXT');
addColumnIfNotExists('products', 'stockQuantity', 'REAL DEFAULT 0');
addColumnIfNotExists('products', 'minStockLevel', 'REAL DEFAULT 5');
addColumnIfNotExists('products', 'trackStock', 'INTEGER DEFAULT 1');

// Seed default numbering sequences
const seedSequences = () => {
  const defaults: { docType: string; prefix: string }[] = [
    { docType: 'quotation', prefix: 'QT' },
    { docType: 'invoice', prefix: 'INV' },
    { docType: 'boq', prefix: 'BOQ' },
    { docType: 'bom', prefix: 'BOM' },
    { docType: 'expense', prefix: 'EXP' },
    { docType: 'recurring', prefix: 'REC' },
    { docType: 'po', prefix: 'PO' },
  ];
  const insertSeq = db.prepare(`
    INSERT INTO sequences (docType, prefix, lastNumber, padding, resetPeriod, lastYear)
    VALUES (?, ?, 0, 4, 'yearly', ?)
    ON CONFLICT(docType) DO NOTHING
  `);
  for (const d of defaults) {
    insertSeq.run(d.docType, d.prefix, new Date().getFullYear());
  }
};
seedSequences();

// One-time: detect the existing numbering convention (prefix / padding / year-reset / max)
// from documents already in the DB, so a new install on legacy data continues the same
// series instead of starting a parallel one. Guarded by a settings flag; after this runs,
// the sequence config is owned by the user (editable via Settings) and never auto-changed.
const reconcileSequences = () => {
  const flag = db.prepare("SELECT value FROM settings WHERE key = 'sequencesReconciled'").get() as { value: string } | undefined;
  if (flag?.value === 'true') return;

  const sources: { docType: string; query: string }[] = [
    { docType: 'quotation', query: 'SELECT number FROM quotations' },
    { docType: 'invoice', query: 'SELECT number FROM invoices' },
    { docType: 'boq', query: "SELECT number FROM boq WHERE type = 'boq'" },
    { docType: 'bom', query: "SELECT number FROM boq WHERE type = 'bom'" },
  ];

  for (const src of sources) {
    let rows: { number: string }[] = [];
    try { rows = db.prepare(src.query).all() as any[]; } catch { continue; }

    // Parse: PREFIX-[YYYY-]NNNN
    const re = /^([A-Za-z]+)-(?:(\d{4})-)?(\d+)$/;
    const prefixCount: Record<string, number> = {};
    const parsed: { prefix: string; year?: string; seq: number; pad: number }[] = [];
    for (const r of rows) {
      const m = re.exec((r.number || '').trim());
      if (!m) continue;
      const [, prefix, year, seqStr] = m;
      prefixCount[prefix] = (prefixCount[prefix] || 0) + 1;
      parsed.push({ prefix, year, seq: parseInt(seqStr, 10), pad: seqStr.length });
    }
    if (parsed.length === 0) continue; // keep seeded default

    // Dominant prefix wins
    const dominant = Object.entries(prefixCount).sort((a, b) => b[1] - a[1])[0][0];
    const group = parsed.filter(p => p.prefix === dominant);
    const yearly = group.some(p => p.year);
    const currentYear = String(new Date().getFullYear());
    // For yearly series only count this year's max; for non-yearly count all
    const relevant = yearly ? group.filter(p => p.year === currentYear) : group;
    const maxSeq = relevant.length ? Math.max(...relevant.map(p => p.seq)) : 0;
    const padding = Math.max(...group.map(p => p.pad));

    db.prepare(`
      UPDATE sequences SET prefix = ?, padding = ?, resetPeriod = ?, lastNumber = ?, lastYear = ?
      WHERE docType = ?
    `).run(dominant, padding, yearly ? 'yearly' : 'never', maxSeq, Number(currentYear), src.docType);
    console.log(`🔢 Reconciled ${src.docType} numbering → ${dominant}, pad ${padding}, ${yearly ? 'yearly' : 'never'}, next ${maxSeq + 1}`);
  }

  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('sequencesReconciled', 'true')").run();
};
reconcileSequences();

// Atomically reserve and format the next number for a document type.
// Retry-safe: if the generated number already exists in the target table
// (e.g. due to manual edits or a race condition), it increments and retries.
function getNextDocumentNumber(docType: string): string {
  const MAX_RETRIES = 1000;
  const seq = db.prepare('SELECT * FROM sequences WHERE docType = ?').get(docType) as
    | { docType: string; prefix: string; lastNumber: number; padding: number; resetPeriod: string; lastYear: number | null }
    | undefined;
  if (!seq) {
    throw new Error(`Unknown document type for numbering: ${docType}`);
  }
  const currentYear = new Date().getFullYear();
  const shouldReset = seq.resetPeriod === 'yearly' && seq.lastYear !== currentYear;
  let nextNumber = shouldReset ? 1 : seq.lastNumber + 1;

  // Map docType to the actual table so we can detect clashing numbers
  const tableMap: Record<string, string> = {
    quotation: 'quotations', invoice: 'invoices', boq: 'boq', bom: 'boq',
    expense: 'expenses', recurring: 'recurring_invoices'
  };
  const table = tableMap[docType];

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const padded = String(nextNumber).padStart(seq.padding, '0');
    const candidate = seq.resetPeriod === 'yearly'
      ? `${seq.prefix}-${currentYear}-${padded}`
      : `${seq.prefix}-${padded}`;

    // Check if this number is already taken (e.g. manually imported or race)
    if (table) {
      const clash = db.prepare(`SELECT 1 FROM ${table} WHERE number = ?`).get(candidate);
      if (clash) {
        nextNumber++;
        continue; // try the next number
      }
    }

    // Reserve the number
    db.prepare(`
      UPDATE sequences SET lastNumber = ?, lastYear = ? WHERE docType = ?
    `).run(nextNumber, currentYear, docType);
    return candidate;
  }

  // Never hand out a number that may already exist (would create duplicate documents).
  throw new Error(`Could not allocate a free ${docType} number after ${MAX_RETRIES} attempts`);
}

// ── DOCUMENT ACTIVITY / AUDIT TRAIL ───────────────────────────────────────────
interface DocChange { field: string; from: string; to: string; }

function logDocumentActivity(
  docType: string,
  docId: string,
  docNumber: string | null,
  action: string,
  actor: { id?: string; name?: string } | undefined,
  companyId: string,
  changes?: DocChange[],
  snapshot?: any // Optional full document snapshot before the change
) {
  try {
    const timestamp = new Date().toISOString();
    db.prepare(`
      INSERT INTO document_activity (docType, docId, docNumber, action, changes, actorId, actorName, companyId, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      docType,
      docId,
      docNumber || null,
      action,
      changes && changes.length ? JSON.stringify(changes) : null,
      actor?.id || null,
      actor?.name || null,
      companyId,
      timestamp
    );

    if (snapshot) {
      // Determine next version number
      const currentMax = db.prepare('SELECT MAX(version) as v FROM document_snapshots WHERE docType = ? AND docId = ? AND companyId = ?').get(docType, docId, companyId) as { v: number | null };
      const nextVersion = (currentMax.v || 0) + 1;
      
      db.prepare(`
        INSERT INTO document_snapshots (id, docType, docId, version, snapshot, actorId, actorName, companyId, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        crypto.randomUUID(),
        docType,
        docId,
        nextVersion,
        JSON.stringify(snapshot),
        actor?.id || null,
        actor?.name || null,
        companyId,
        timestamp
      );
    }
  } catch (err) {
    console.error('Failed to log document activity:', err);
  }
}

const fmtVal = (v: any): string => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'number') return Number(v).toLocaleString();
  return String(v);
};

// Compute a human-readable diff between an existing document row and incoming body.
// Compares scalar fields plus a line-item / section diff (added / removed / changed).
function computeDocumentDiff(existing: any, incoming: any, scalarFields: string[]): DocChange[] {
  const changes: DocChange[] = [];
  for (const f of scalarFields) {
    const oldV = existing[f];
    const newV = incoming[f];
    if (fmtVal(oldV) !== fmtVal(newV)) {
      changes.push({ field: f, from: fmtVal(oldV), to: fmtVal(newV) });
    }
  }

  // Line-item diff (quotation/invoice use lineItems; boq/bom flatten sections)
  const extractItems = (doc: any): { description: string; quantity: number; unitPrice: number }[] => {
    let items: any[] = [];
    if (doc.lineItems) {
      const parsed = typeof doc.lineItems === 'string' ? JSON.parse(doc.lineItems) : doc.lineItems;
      items = (parsed || []).filter((i: any) => i.type === 'item' || !i.type);
    } else if (doc.sections) {
      const secs = typeof doc.sections === 'string' ? JSON.parse(doc.sections) : doc.sections;
      items = (secs || []).flatMap((s: any) => s.items || []);
    }
    return items.map((i: any) => ({
      description: (i.description || '').trim(),
      quantity: Number(i.quantity) || 0,
      unitPrice: Number(i.unitPrice) || 0,
    }));
  };

  try {
    const oldItems = extractItems(existing);
    const newItems = extractItems(incoming);
    const norm = (s: string) => s.toLowerCase();
    const fmtItem = (i: { description: string; quantity: number; unitPrice: number }) =>
      `${i.description} × ${i.quantity} @ ${i.unitPrice.toLocaleString()}`;
    const oldMap = new Map(oldItems.map(i => [norm(i.description), i]));
    const newMap = new Map(newItems.map(i => [norm(i.description), i]));

    for (const [k, o] of oldMap) {
      if (!newMap.has(k)) changes.push({ field: 'Item removed', from: fmtItem(o), to: '—' });
    }
    for (const [k, n] of newMap) {
      if (!oldMap.has(k)) changes.push({ field: 'Item added', from: '—', to: fmtItem(n) });
    }
    for (const [k, o] of oldMap) {
      const n = newMap.get(k);
      if (n && (o.quantity !== n.quantity || o.unitPrice !== n.unitPrice)) {
        changes.push({ field: `Item changed: ${o.description}`, from: fmtItem(o), to: fmtItem(n) });
      }
    }
  } catch (err) {
    // Non-fatal: skip line-item diff on parse error
  }

  return changes;
}

// ── PLANS & FEATURE TOGGLES ───────────────────────────────────────────────────
// Catalog of toggleable modules/features. Core ones can't be turned off.
const FEATURE_CATALOG = [
  { key: 'quotations', label: 'Quotations', core: true },
  { key: 'invoices', label: 'Invoices', core: false },
  { key: 'boq', label: 'BOQ (Bill of Quantities)', core: false },
  { key: 'bom', label: 'BOM (Bill of Materials)', core: false },
  { key: 'reports', label: 'Financial Reports', core: false },
  { key: 'customers', label: 'Customers', core: true },
  { key: 'suppliers', label: 'Suppliers', core: false },
  { key: 'products', label: 'Product Catalog', core: true },
  { key: 'tracking', label: 'Activity Timeline & Audit', core: false },
  { key: 'notifications', label: 'Notifications', core: false },
  { key: 'usage', label: 'Usage Analytics', core: false },
  { key: 'kanban', label: 'Kanban Pipeline', core: false },
  { key: 'aiAssistant', label: 'AI Assistant', core: false },
  { key: 'tasks', label: 'Personal Task Tracker', core: false },
  { key: 'pos', label: 'Point of Sale (POS)', core: false },
  { key: 'expenses', label: 'Expenses & Vendor Bills', core: false },
  { key: 'recurring', label: 'Recurring Invoices & Subscriptions', core: false },
  { key: 'inventory', label: 'Inventory & Stock Control', core: false },
  { key: 'portal', label: 'Client Approval Portal', core: false },
] as const;

type FeatureKey = typeof FEATURE_CATALOG[number]['key'];

// Subscription plans bundle a set of enabled features.
const PLANS: Record<string, { label: string; features: FeatureKey[] }> = {
  starter: {
    label: 'Starter',
    features: ['quotations', 'invoices', 'customers', 'products', 'notifications', 'tasks', 'expenses'],
  },
  professional: {
    label: 'Professional',
    features: ['quotations', 'invoices', 'boq', 'bom', 'reports', 'customers', 'suppliers', 'products', 'tracking', 'notifications', 'usage', 'tasks', 'pos', 'expenses', 'inventory', 'portal'],
  },
  enterprise: {
    label: 'Enterprise',
    features: FEATURE_CATALOG.map(f => f.key),
  },
};

const featuresFromPlan = (plan: string): Record<string, boolean> => {
  const enabled = new Set(PLANS[plan]?.features || PLANS.enterprise.features);
  const out: Record<string, boolean> = {};
  for (const f of FEATURE_CATALOG) out[f.key] = f.core || enabled.has(f.key);
  return out;
};

// Seed plan + feature flags on first run (default: enterprise / everything on)
const seedFeatures = () => {
  const planRow = db.prepare("SELECT value FROM settings WHERE key = 'activePlan'").get() as { value: string } | undefined;
  if (!planRow) {
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('activePlan', 'enterprise')").run();
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('featureFlags', ?)").run(JSON.stringify(featuresFromPlan('enterprise')));
  }
};
seedFeatures();

const getActiveFeatures = (companyId?: string): Record<string, boolean> => {
  if (companyId) {
    const company = db.prepare('SELECT activePlan, featureFlags FROM companies WHERE id = ?').get(companyId) as { activePlan: string; featureFlags?: string | null } | undefined;
    if (company?.featureFlags) {
      try { return JSON.parse(company.featureFlags); } catch { /* fall through */ }
    }
    if (company) return featuresFromPlan(company.activePlan);
  }
  const row = db.prepare("SELECT value FROM settings WHERE key = 'featureFlags'").get() as { value: string } | undefined;
  if (row) { try { return JSON.parse(row.value); } catch { /* fall through */ } }
  return featuresFromPlan('enterprise');
};

// Middleware factory: block API access to a disabled feature.
const requireFeature = (feature: FeatureKey) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const features = getActiveFeatures((req as any).companyId);
    if (features[feature] === false) {
      return res.status(403).json({ error: `Feature '${feature}' is not enabled on the current plan.` });
    }
    next();
  };
};

// ── NOTIFICATIONS ─────────────────────────────────────────────────────────────
function createNotification(
  userId: string | null,
  type: string,
  title: string,
  body?: string,
  link?: string
) {
  try {
    db.prepare(`
      INSERT INTO notifications (userId, type, title, body, link, isRead, createdAt)
      VALUES (?, ?, ?, ?, ?, 0, ?)
    `).run(userId, type, title, body || null, link || null, new Date().toISOString());
  } catch (err) {
    console.error('Failed to create notification:', err);
  }
}

// Perform migrations for subject columns
addColumnIfNotExists('quotations', 'subject', 'TEXT');
addColumnIfNotExists('quotations', 'subjectAr', 'TEXT');
addColumnIfNotExists('invoices', 'subject', 'TEXT');
addColumnIfNotExists('invoices', 'subjectAr', 'TEXT');
addColumnIfNotExists('quotations', 'watermarkText', "TEXT DEFAULT 'PAID'");
addColumnIfNotExists('quotations', 'watermarkType', "TEXT DEFAULT 'none'");
addColumnIfNotExists('invoices', 'watermarkText', "TEXT DEFAULT 'PAID'");
addColumnIfNotExists('invoices', 'watermarkType', "TEXT DEFAULT 'none'");
addColumnIfNotExists('quotations', 'hidePrices', "INTEGER DEFAULT 0");
addColumnIfNotExists('quotations', 'manualTotal', "REAL");
addColumnIfNotExists('invoices', 'hidePrices', "INTEGER DEFAULT 0");
addColumnIfNotExists('invoices', 'manualTotal', "REAL");
addColumnIfNotExists('boq', 'type', "TEXT DEFAULT 'boq'");

// Follow-up tracking (Tracking page): next-action date + free-text note
addColumnIfNotExists('quotations', 'followUpDate', 'TEXT');
addColumnIfNotExists('quotations', 'followUpNote', 'TEXT');
addColumnIfNotExists('invoices', 'followUpDate', 'TEXT');
addColumnIfNotExists('invoices', 'followUpNote', 'TEXT');

// Recycle Bin & Soft-Delete tracking
addColumnIfNotExists('quotations', 'deleted_at', 'TEXT');
addColumnIfNotExists('quotations', 'deleted_by', 'TEXT');
addColumnIfNotExists('quotations', 'retain_forever', 'INTEGER DEFAULT 0');
addColumnIfNotExists('invoices', 'deleted_at', 'TEXT');
addColumnIfNotExists('invoices', 'deleted_by', 'TEXT');
addColumnIfNotExists('invoices', 'retain_forever', 'INTEGER DEFAULT 0');

// ── MULTI-COMPANY / MULTI-TENANCY ─────────────────────────────────────────────
// Shared tables scoped by a companyId column. A single default company is seeded
// from existing settings and all legacy rows are backfilled into it, so existing
// behaviour is preserved (everything stays in one company until more are created).
const DEFAULT_COMPANY_ID = 'comp-default';
const SCOPED_TABLES = [
  'customers', 'products', 'suppliers', 'quotations', 'invoices', 'boq',
  'document_activity', 'personal_tasks', 'expenses', 'recurring_invoices',
  'inventory_transactions', 'public_shares'
] as const;

db.exec(`
  CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT,
    activePlan TEXT NOT NULL DEFAULT 'enterprise',
    featureFlags TEXT,             -- JSON: per-company feature overrides
    settings TEXT,                 -- JSON: per-company branding/profile (optional)
    createdAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS user_companies (
    userId TEXT NOT NULL,
    companyId TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',  -- 'owner' | 'admin' | 'member'
    PRIMARY KEY (userId, companyId)
  );
  CREATE INDEX IF NOT EXISTS idx_user_companies ON user_companies(userId);
`);

// Platform-level columns: company lifecycle status + super-admin flag on users.
addColumnIfNotExists('companies', 'status', "TEXT DEFAULT 'active'");   // 'active' | 'suspended'
addColumnIfNotExists('users', 'isSuperAdmin', 'INTEGER DEFAULT 0');

// A URL-safe slug used for subdomain / path tenant resolution (unique-ish).
const slugify = (s: string) =>
  String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'company';
const uniqueSlug = (base: string, ignoreId?: string): string => {
  let slug = slugify(base);
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const row = db.prepare('SELECT id FROM companies WHERE slug = ?').get(slug) as { id: string } | undefined;
    if (!row || row.id === ignoreId) return slug;
    slug = `${slugify(base)}-${++n}`;
  }
};

// companyId on the scoped tables (boq is added later, after its table exists)
addColumnIfNotExists('customers', 'companyId', 'TEXT');
addColumnIfNotExists('products', 'companyId', 'TEXT');
addColumnIfNotExists('quotations', 'companyId', 'TEXT');
addColumnIfNotExists('invoices', 'companyId', 'TEXT');
addColumnIfNotExists('suppliers', 'companyId', 'TEXT');
addColumnIfNotExists('document_activity', 'companyId', 'TEXT');
addColumnIfNotExists('personal_tasks', 'companyId', 'TEXT');

// Seed the default company + backfill legacy rows + enrol existing users.
// Idempotent: safe to run on every boot. Call AFTER the boq column is added.
const ensureDefaultCompany = () => {
  const existing = db.prepare('SELECT id FROM companies WHERE id = ?').get(DEFAULT_COMPANY_ID);
  if (!existing) {
    let name = 'Default Company';
    try {
      const s = db.prepare("SELECT value FROM settings WHERE key = 'company'").get() as { value: string } | undefined;
      if (s) { const c = JSON.parse(s.value); if (c?.name) name = c.name; }
    } catch { /* ignore */ }
    const planRow = db.prepare("SELECT value FROM settings WHERE key = 'activePlan'").get() as { value: string } | undefined;
    const flagsRow = db.prepare("SELECT value FROM settings WHERE key = 'featureFlags'").get() as { value: string } | undefined;
    db.prepare('INSERT INTO companies (id, name, slug, activePlan, featureFlags, createdAt) VALUES (?, ?, ?, ?, ?, ?)').run(
      DEFAULT_COMPANY_ID, name, 'default',
      planRow?.value || 'enterprise',
      flagsRow?.value || JSON.stringify(featuresFromPlan('enterprise')),
      new Date().toISOString()
    );
    console.log(`🏢 Seeded default company "${name}"`);
  }
  for (const t of SCOPED_TABLES) {
    try { db.prepare(`UPDATE ${t} SET companyId = ? WHERE companyId IS NULL`).run(DEFAULT_COMPANY_ID); } catch { /* table not ready */ }
  }
  const users = db.prepare('SELECT id, role FROM users').all() as { id: string; role: string }[];
  for (const u of users) {
    const m = db.prepare('SELECT 1 FROM user_companies WHERE userId = ? AND companyId = ?').get(u.id, DEFAULT_COMPANY_ID);
    if (!m) {
      db.prepare('INSERT INTO user_companies (userId, companyId, role) VALUES (?, ?, ?)').run(
        u.id, DEFAULT_COMPANY_ID, u.role === 'admin' ? 'owner' : 'member'
      );
    }
  }
  // Backfill slug/status on any company missing them.
  const needSlug = db.prepare("SELECT id, name FROM companies WHERE slug IS NULL OR slug = ''").all() as { id: string; name: string }[];
  for (const c of needSlug) db.prepare('UPDATE companies SET slug = ? WHERE id = ?').run(uniqueSlug(c.name, c.id), c.id);
  db.prepare("UPDATE companies SET status = 'active' WHERE status IS NULL").run();

  // Ensure at least one platform super-admin exists (promote the earliest admin).
  const hasSuper = db.prepare('SELECT 1 FROM users WHERE isSuperAdmin = 1 LIMIT 1').get();
  if (!hasSuper) {
    const admin = db.prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY rowid ASC LIMIT 1").get() as { id: string } | undefined;
    if (admin) {
      db.prepare('UPDATE users SET isSuperAdmin = 1 WHERE id = ?').run(admin.id);
      console.log(`👑 Promoted user ${admin.id} to platform super-admin`);
    }
  }
};

// Map a request Host header to a company slug (subdomain tenant resolution).
// e.g. "acme.mainservicepro.com" -> "acme"; ignores common non-tenant hosts.
const RESERVED_SUBDOMAINS = new Set(['www', 'app', 'api', 'admin', 'localhost', '']);
const companyIdFromHost = (host?: string): string | null => {
  if (!host) return null;
  const hostname = host.split(':')[0];
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return null; // raw IP
  const parts = hostname.split('.');
  // Only a real subdomain (sub.domain.tld) selects a tenant — never the apex
  // (domain.tld) or a bare host (localhost). Header/fallback handle those.
  if (parts.length < 3) return null;
  const sub = parts[0];
  if (RESERVED_SUBDOMAINS.has(sub)) return null;
  const row = db.prepare('SELECT id FROM companies WHERE slug = ?').get(sub) as { id: string } | undefined;
  return row?.id || null;
};

// Resolve the active company for a request. Priority: subdomain → X-Company-Id →
// deterministic fallback. Super-admins may act on ANY company; regular users are
// restricted to their memberships.
const resolveActiveCompany = (user: any, requested?: string, host?: string): string => {
  const isSuper = user.isSuperAdmin === 1 || user.isSuperAdmin === true;
  const hostCompany = companyIdFromHost(host);
  const memberships = db.prepare('SELECT companyId FROM user_companies WHERE userId = ? ORDER BY rowid ASC').all(user.id) as { companyId: string }[];
  const allowed = (id?: string | null) => !!id && (isSuper || memberships.some((m) => m.companyId === id));

  if (allowed(hostCompany)) return hostCompany as string;
  if (allowed(requested)) return requested as string;
  if (isSuper) return hostCompany || requested || DEFAULT_COMPANY_ID;
  if (memberships.length === 0) return DEFAULT_COMPANY_ID; // legacy safety
  if (memberships.some((m) => m.companyId === DEFAULT_COMPANY_ID)) return DEFAULT_COMPANY_ID;
  return memberships[0].companyId;
};

// ── SEEDING MOCK DATA ─────────────────────────────────────────────────────────
const seedDatabase = () => {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count === 0) {
    console.log('🌱 Seeding default users...');
    const hashedDefault = bcrypt.hashSync('admin123', BCRYPT_ROUNDS);

    // Insert Default Mock Users
    const insertUser = db.prepare(`
      INSERT INTO users (id, username, name, email, password, role, permissions, avatar)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertUser.run('u-1', 'admin', 'Administrator', 'admin@ajnetwork.sa', hashedDefault, 'admin', JSON.stringify({
      canManageUsers: true,
      canManageSettings: true,
      canDeleteData: true,
      canViewRevenue: true,
      canOverridePrice: true,
      canUseKanban: true,
      canUseRFQ: true,
      canUseAI: true,
      canViewHistory: true,
      canViewCreatedBy: true,
      canUsePOS: true,
      canDatabaseMaintenance: true
    }), 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80');

    insertUser.run('u-2', 'sarah', 'Sarah Rahman (Accountant)', 'sarah.r@ajnetwork.sa', hashedDefault, 'accountant', JSON.stringify({
      canViewRevenue: true,
      canDeleteData: false,
      canManageUsers: false
    }), 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80');

    insertUser.run('u-3', 'fahad', 'Fahad Al-Malki (Sales Mgr)', 'fahad.m@ajnetwork.sa', hashedDefault, 'sales_manager', JSON.stringify({
      canViewRevenue: true,
      canOverridePrice: true,
      canUseKanban: true
    }), 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80');

    insertUser.run('u-4', 'alice', 'Alice Cooper (Salesperson)', 'alice.c@ajnetwork.sa', hashedDefault, 'salesperson', JSON.stringify({
      canViewRevenue: false,
      canOverridePrice: false,
      canUseKanban: true
    }), 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=100&q=80');

    console.log('✅ Default users seeded. (Password: admin123)');
  }

  const customerCount = db.prepare('SELECT COUNT(*) as count FROM customers').get() as { count: number };
  if (customerCount.count === 0) {
    console.log('🌱 Seeding mock customers...');
    const insertCustomer = db.prepare(`
      INSERT INTO customers (id, companyName, contactPerson, email, phone, vatNumber, billingAddress, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertCustomer.run('cust-1', 'Ahmed Mohammed Al-Arfaj Housing Units Est.', 'Mr. Ahmed Al-Arfaj', 'ahmed@arfaj-housing.sa', '0505936329', '300567891200003', JSON.stringify({
      street: 'Al Olaya Dist.',
      district: 'Al Olaya',
      city: 'Al Khobar',
      postalCode: '31952',
      country: 'SA'
    }), '2025-01-10T10:00:00Z');

    insertCustomer.run('cust-2', 'Khalid Alshekmubarak Trading', 'Mr. Khalid Alshekmubarak', 'khalid@shekmubarak.sa', '0532730304', '300891234500003', JSON.stringify({
      street: 'Albusairah',
      district: 'Albusairah Dist.',
      city: 'Al Hufuf',
      postalCode: '36362',
      country: 'SA'
    }), '2025-02-14T11:30:00Z');

    insertCustomer.run('cust-3', 'Red Sea Global Hospitality', 'Eng. Basel Al-Harbi', 'b.harbi@redseaglobal.sa', '0544558899', '302456789100003', JSON.stringify({
      street: 'Prince Sultan Street',
      district: 'Al Rawdah',
      city: 'Jeddah',
      postalCode: '23431',
      country: 'SA'
    }), '2025-03-20T09:15:00Z');
    console.log('✅ Mock customers seeded.');
  }

  const productCount = db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number };
  if (productCount.count === 0) {
    console.log('🌱 Seeding mock products...');
    const insertProduct = db.prepare(`
      INSERT INTO products (id, name, description, type, unitPrice, unit, taxRate, categoryId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertProduct.run('p-1', 'Hikvision 12MP Acusense Smart Hybrid Bullet Camera', 'كاميرا هيكفيجن أكيوسنس الذكية 12 ميجابكسل هجينة خفيفة رصاصة ثنائية الإضاءة\nHikvision 12MP Acusense Smart Hybrid Light Fixed Bullet Network Camera', 'product', 453.68, 'pc', 15, 'cctv');
    insertProduct.run('p-2', 'Hikvision 32-Ch 1.5U K Series AcuSense 4K NVR', 'جهاز تسجيل شبكي هيكفيجن 32 قناة 4K دقة فائقة\nHikvision 32-Ch 1.5U K Series AcuSense 4K NVR, DS-7732NI-I4/16P', 'product', 3000.00, 'pc', 15, 'cctv');
    insertProduct.run('p-3', '10 TB Surveillance Hard Disk - WD | Toshiba', 'قرص صلب سعة 10 تيرابايت مخصص لأنظمة المراقبة\n10 TB Surveillance Hard Disk Drive, optimized for 24/7 recording', 'product', 1425.00, 'pc', 15, 'storage');
    insertProduct.run('p-4', 'Huawei Outdoor AP, Wi-Fi 7 - AP771', 'نطاق التغطية الأمثل 130 متراً هواوي واي فاي 7 خارجي\nHuawei Outdoor AP, Wi-Fi 7 - AP771, 130m Optimal Coverage Range', 'product', 993.68, 'pc', 15, 'networking');
    insertProduct.run('p-5', 'Huawei Wall Plate AP Wi-Fi 6 - AP160', 'هواوي لوحة الحائط AP Wi-Fi 6 - AP160 للغرف الفندقية والمكاتب\nHuawei Wall Plate AP Wi-Fi 6 - AP160', 'product', 310.00, 'pc', 15, 'networking');
    insertProduct.run('p-6', 'Yeastar P550 IP PBX Phone System', 'بدالة سنترال ييستار P550 نظام الاتصال الذكي للمؤسسات\nYeastar P550 IP PBX Phone System, supports up to 50 users', 'product', 2113.13, 'pc', 15, 'telephony');
    insertProduct.run('p-7', 'Fanvil V62G-WH Business IP Phone', 'شاشة ملونة 2.8 بوصة هاتف هانفيل Fanvil V62G-WH جيجابت آي بي\nFanvil V62G-WH Business IP Phone, 2.8 Color Screen, Giga Ports', 'product', 205.20, 'pc', 15, 'telephony');
    console.log('✅ Mock products seeded.');
  }

  const quoteCount = db.prepare('SELECT COUNT(*) as count FROM quotations').get() as { count: number };
  if (quoteCount.count === 0) {
    console.log('🌱 Seeding mock quotations...');
    const insertQuote = db.prepare(`
      INSERT INTO quotations (id, number, customerId, date, validUntil, status, lineItems, notes, terms, currency, subtotal, discountTotal, taxTotal, total, createdAt, updatedAt, salespersonId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertQuote.run('qt-1', 'AJ-57022', 'cust-1', '2026-05-05T12:00:00Z', '2026-05-07T12:00:00Z', 'draft', JSON.stringify([
      { id: 'li-1', type: 'item', productId: 'p-1', description: 'Hikvision 12MP Acusense Smart Hybrid Bullet Camera', quantity: 22, unit: 'pc', unitPrice: 453.68, discountPercent: 0, taxPercent: 15, subtotal: 9980.96 },
      { id: 'li-2', type: 'item', productId: 'p-2', description: 'Hikvision 32-Ch 1.5U K Series AcuSense 4K NVR', quantity: 1, unit: 'pc', unitPrice: 3000.00, discountPercent: 0, taxPercent: 15, subtotal: 3000.00 }
    ]), 'Any additional work/device will be considered Change Order.', 'Payment: 50% Downpayment', 'SAR', 14968.32, 0, 2245.25, 17213.57, '2026-05-05T12:00:00Z', '2026-05-05T12:00:00Z', 'u-4');
    console.log('✅ Mock quotations seeded.');
  }

  const invoiceCount = db.prepare('SELECT COUNT(*) as count FROM invoices').get() as { count: number };
  if (invoiceCount.count === 0) {
    console.log('🌱 Seeding mock invoices...');
    const insertInvoice = db.prepare(`
      INSERT INTO invoices (id, number, customerId, date, dueDate, status, paymentTerms, lineItems, notes, currency, subtotal, discountTotal, taxTotal, total, amountPaid, amountDue, createdAt, updatedAt, salespersonId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertInvoice.run('inv-1', 'INV-2026-0001', 'cust-1', '2026-05-06T10:00:00Z', '2026-06-06T10:00:00Z', 'draft', 'Net 30', JSON.stringify([
      { id: 'li-i1-1', type: 'item', productId: 'p-1', description: 'Hikvision 12MP Acusense Bullet Camera', quantity: 12, unit: 'pc', unitPrice: 453.68, discountPercent: 0, taxPercent: 15, subtotal: 5444.16 }
    ]), 'First batch invoice.', 'SAR', 8294.16, 0, 1244.12, 9538.28, 0, 9538.28, '2026-05-06T10:00:00Z', '2026-05-06T10:00:00Z', 'u-4');
    console.log('✅ Mock invoices seeded.');
  }

  // Seed default settings
  const companySetting = db.prepare("SELECT COUNT(*) as count FROM settings WHERE key = 'company'").get() as { count: number };
  if (companySetting.count === 0) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('company', JSON.stringify({
      id: 'c-1',
      name: 'AJ NETWORK SOLUTIONS',
      logo: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=120&h=120&q=80',
      address: {
        street: 'King Abdulaziz Road, Al Olaya',
        district: 'Al Olaya Dist.',
        city: 'Riyadh',
        postalCode: '12211',
        country: 'SA'
      },
      phone: '+966 11 456 7890',
      email: 'info@ajnetwork.sa',
      vatNumber: '310123456700003',
      crNumber: '1010456789',
      currency: 'SAR',
      defaultTax: 15,
      brandColor: '#01696f'
    }));
  }
};

seedDatabase();

// ── MIDDLEWARES ───────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false })); // Allow external assets and data URIs
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Restrict /api/admin endpoints to the dedicated admin port
app.use('/api/admin', (req, res, next) => {
  if (req.socket.localPort !== ADMIN_PORT) {
    return res.status(403).json({ error: 'Access Denied: Admin Panel endpoints must be accessed via the dedicated admin port.' });
  }
  next();
});

// Rate limiter for login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' }
});

// Authentication middleware
const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const session = db.prepare('SELECT user_id, expires_at FROM sessions WHERE token = ?').get(token) as { user_id: string; expires_at: string } | undefined;
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  if (new Date(session.expires_at) < new Date()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }

  const user = db.prepare('SELECT id, username, name, email, role, permissions, avatar, isSuperAdmin FROM users WHERE id = ?').get(session.user_id) as any;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    user.permissions = JSON.parse(user.permissions || '{}');
  } catch {
    user.permissions = {};
  }

  (req as any).user = user;
  // Resolve the active company (multi-tenancy). Scoped routes read req.companyId.
  (req as any).companyId = resolveActiveCompany(
    user,
    req.headers['x-company-id'] as string | undefined,
    req.headers.host
  );
  next();
};

// Platform-owner gate for the super-admin control plane.
const requireSuperAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const user = (req as any).user;
  if (!user || !(user.isSuperAdmin === 1 || user.isSuperAdmin === true)) {
    return res.status(403).json({ error: 'Forbidden: platform super-admin only.' });
  }
  next();
};

const requirePermission = (permissionKey: string) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (user.role === 'admin') return next();
    if (user.permissions && user.permissions[permissionKey] === true) return next();
    return res.status(403).json({ error: `Forbidden: requires ${permissionKey} permission.` });
  };
}

const verifyPriceOverrides = (reqBody: any, existingQuoteOrInvoice?: any) => {
  const { manualTotal, lineItems } = reqBody;
  
  const existingManualTotal = existingQuoteOrInvoice ? existingQuoteOrInvoice.manualTotal : null;
  const hasNewManualTotal = manualTotal !== undefined && manualTotal !== null && manualTotal !== '';
  const hasOldManualTotal = existingManualTotal !== null && existingManualTotal !== undefined && existingManualTotal !== '';

  if (hasNewManualTotal) {
    if (!hasOldManualTotal || Number(manualTotal) !== Number(existingManualTotal)) {
      return false;
    }
  } else if (hasOldManualTotal) {
    return false;
  }
  
  const itemsMap = new Map<string, any>();
  if (existingQuoteOrInvoice && existingQuoteOrInvoice.lineItems) {
    try {
      const parsed = typeof existingQuoteOrInvoice.lineItems === 'string' ? JSON.parse(existingQuoteOrInvoice.lineItems) : existingQuoteOrInvoice.lineItems;
      if (Array.isArray(parsed)) {
        parsed.forEach(item => itemsMap.set(item.id, item));
      }
    } catch {}
  }
  
  if (lineItems && Array.isArray(lineItems)) {
    for (const item of lineItems) {
      const existingItem = itemsMap.get(item.id);
      const existingManualPrice = existingItem ? existingItem.manualPrice : undefined;
      const currentManualPrice = item.manualPrice;
      const hasNewManualPrice = currentManualPrice !== undefined && currentManualPrice !== null && currentManualPrice !== '';
      const hasOldManualPrice = existingManualPrice !== undefined && existingManualPrice !== null && existingManualPrice !== '';

      if (hasNewManualPrice) {
        if (!hasOldManualPrice || Number(currentManualPrice) !== Number(existingManualPrice)) {
          return false;
        }
      } else if (hasOldManualPrice) {
        return false;
      }
    }
  }
  
  return true;
};;

// ── AUTHENTICATION API ────────────────────────────────────────────────────────
app.post('/api/login', loginLimiter, async (req, res) => {
  const { email, password, rememberMe } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim()) as any;
  const passwordMatch = user ? await bcrypt.compare(password, user.password) : false;

  if (user && passwordMatch) {
    // Block tenant users whose companies are all suspended (super-admins bypass).
    if (!(user.isSuperAdmin === 1)) {
      const active = db.prepare(`
        SELECT COUNT(*) AS c FROM user_companies uc
        JOIN companies co ON co.id = uc.companyId
        WHERE uc.userId = ? AND co.status = 'active'
      `).get(user.id) as { c: number };
      const anyMembership = db.prepare('SELECT COUNT(*) AS c FROM user_companies WHERE userId = ?').get(user.id) as { c: number };
      if (anyMembership.c > 0 && active.c === 0) {
        logSystemEvent('warn', `Login blocked: company suspended`, { email });
        return res.status(403).json({ error: 'Your company account is suspended. Please contact the platform administrator.' });
      }
    }

    const token = crypto.randomBytes(32).toString('hex');
    const days = rememberMe ? 30 : 1;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, user.id, expiresAt);
    const permissions = (() => { try { return JSON.parse(user.permissions || '{}'); } catch { return {}; } })();

    logSystemEvent('info', `User login successful`, { email }, user.id, user.username);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions,
        avatar: user.avatar,
        isSuperAdmin: user.isSuperAdmin === 1
      }
    });
  } else {
    logSystemEvent('warn', `User login failed`, { email });
    res.status(401).json({ error: 'Invalid email or password.' });
  }
});

app.post('/api/logout', requireAuth, (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const user = (req as any).user;
  if (token) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    logSystemEvent('info', `User logout successful`, null, user?.id, user?.username);
  }
  res.json({ success: true });
});

app.get('/api/me', requireAuth, (req, res) => {
  const user = (req as any).user;
  res.json({ ...user, isSuperAdmin: user.isSuperAdmin === 1 || user.isSuperAdmin === true });
});

// ── USER MANAGEMENT API (RBAC) ────────────────────────────────────────────────
app.get('/api/users', requireAuth, (req, res) => {
  const users = db.prepare('SELECT id, username, name, email, role, permissions, avatar FROM users').all() as any[];
  const parsed = users.map(u => ({
    ...u,
    permissions: (() => { try { return JSON.parse(u.permissions || '{}'); } catch { return {}; } })()
  }));
  res.json(parsed);
});

app.post('/api/users', requireAuth, requirePermission('canManageUsers'), async (req, res) => {
  const { username, name, email, password, role, permissions } = req.body;
  try {
    const hashed = await bcrypt.hash(password || 'admin123', BCRYPT_ROUNDS);
    const userId = `u-${Date.now()}`;
    db.prepare(`
      INSERT INTO users (id, username, name, email, password, role, permissions, avatar)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      username || email.split('@')[0],
      name,
      email,
      hashed,
      role,
      JSON.stringify(permissions || {}),
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=100&q=80'
    );
    res.json({ id: userId });
  } catch (error: any) {
    res.status(400).json({ error: 'User creation failed: email or username might exist.' });
  }
});

app.put('/api/users/:id', requireAuth, requirePermission('canManageUsers'), async (req, res) => {
  const { username, name, email, role, permissions, password } = req.body;
  try {
    const permStr = JSON.stringify(permissions || {});
    if (password) {
      const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
      db.prepare(`
        UPDATE users
        SET username = ?, name = ?, email = ?, password = ?, role = ?, permissions = ?
        WHERE id = ?
      `).run(username, name, email, hashed, role, permStr, req.params.id);
    } else {
      db.prepare(`
        UPDATE users
        SET username = ?, name = ?, email = ?, role = ?, permissions = ?
        WHERE id = ?
      `).run(username, name, email, role, permStr, req.params.id);
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: 'Failed to update user.' });
  }
});

app.delete('/api/users/:id', requireAuth, requirePermission('canManageUsers'), (req, res) => {
  if (req.params.id === 'u-1') {
    return res.status(400).json({ error: 'Cannot delete the primary administrator.' });
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── PERMISSION GROUPS API ─────────────────────────────────────────────────────
app.get('/api/permission-groups', requireAuth, (req, res) => {
  const groups = db.prepare('SELECT * FROM permission_groups ORDER BY name ASC').all() as any[];
  const parsed = groups.map(g => ({
    ...g,
    permissions: (() => { try { return JSON.parse(g.permissions || '{}'); } catch { return {}; } })(),
    members: (() => { try { return JSON.parse(g.members || '[]'); } catch { return []; } })()
  }));
  res.json(parsed);
});

app.post('/api/permission-groups', requireAuth, requirePermission('canManageUsers'), (req, res) => {
  const { name, description, permissions, members } = req.body;
  try {
    const permStr = JSON.stringify(permissions || {});
    const membersStr = JSON.stringify(members || []);
    const info = db.prepare(`
      INSERT INTO permission_groups (name, description, permissions, members, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, description || '', permStr, membersStr, new Date().toISOString());
    res.json({ id: info.lastInsertRowid });
  } catch (error) {
    res.status(400).json({ error: 'Group creation failed.' });
  }
});

app.put('/api/permission-groups/:id', requireAuth, requirePermission('canManageUsers'), (req, res) => {
  const { name, description, permissions, members } = req.body;
  try {
    const permStr = JSON.stringify(permissions || {});
    const membersStr = JSON.stringify(members || []);
    db.prepare(`
      UPDATE permission_groups
      SET name = ?, description = ?, permissions = ?, members = ?
      WHERE id = ?
    `).run(name, description || '', permStr, membersStr, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Update failed.' });
  }
});

app.delete('/api/permission-groups/:id', requireAuth, requirePermission('canManageUsers'), (req, res) => {
  db.prepare('DELETE FROM permission_groups WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── CUSTOMERS CRUD ────────────────────────────────────────────────────────────
app.get('/api/customers', requireAuth, (req, res) => {
  const customers = db.prepare('SELECT * FROM customers WHERE companyId = ? ORDER BY createdAt DESC').all((req as any).companyId) as any[];
  const parsed = customers.map(c => ({
    ...c,
    billingAddress: JSON.parse(c.billingAddress || '{}'),
    createdAt: new Date(c.createdAt)
  }));
  res.json(parsed);
});

app.post('/api/customers', requireAuth, (req, res) => {
  const { id, companyName, contactPerson, email, phone, vatNumber, billingAddress } = req.body;
  try {
    const custId = id || `cust-${Date.now()}`;
    db.prepare(`
      INSERT INTO customers (id, companyName, contactPerson, email, phone, vatNumber, billingAddress, createdAt, companyId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      custId,
      companyName,
      contactPerson || '',
      email,
      phone,
      vatNumber || '',
      JSON.stringify(billingAddress || {}),
      new Date().toISOString(),
      (req as any).companyId
    );
    res.json({ id: custId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/customers/:id', requireAuth, (req, res) => {
  const { companyName, contactPerson, email, phone, vatNumber, billingAddress } = req.body;
  try {
    db.prepare(`
      UPDATE customers
      SET companyName = ?, contactPerson = ?, email = ?, phone = ?, vatNumber = ?, billingAddress = ?
      WHERE id = ? AND companyId = ?
    `).run(
      companyName,
      contactPerson || '',
      email,
      phone,
      vatNumber || '',
      JSON.stringify(billingAddress || {}),
      req.params.id,
      (req as any).companyId
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/customers/:id', requireAuth, requirePermission('canDeleteData'), (req, res) => {
  db.prepare('DELETE FROM customers WHERE id = ? AND companyId = ?').run(req.params.id, (req as any).companyId);
  res.json({ success: true });
});

// ── SUPPLIERS CRUD ────────────────────────────────────────────────────────────
app.get('/api/suppliers', requireAuth, (req, res) => {
  try {
    const suppliers = db.prepare('SELECT * FROM suppliers WHERE companyId = ? ORDER BY name ASC').all((req as any).companyId);
    res.json(suppliers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/suppliers', requireAuth, (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Supplier name is required' });
  }
  try {
    const supplierId = `sup-${Date.now()}`;
    db.prepare('INSERT INTO suppliers (id, name, companyId) VALUES (?, ?, ?)').run(supplierId, name.trim(), (req as any).companyId);
    res.json({ success: true, id: supplierId, name });
  } catch (error: any) {
    if (error.message.includes('UNIQUE')) {
      res.status(400).json({ error: 'Supplier name already exists' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

app.put('/api/suppliers/:id', requireAuth, (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Supplier name is required' });
  }
  try {
    const result = db.prepare('UPDATE suppliers SET name = ? WHERE id = ? AND companyId = ?').run(name.trim(), req.params.id, (req as any).companyId);
    if (result.changes === 0) return res.status(404).json({ error: 'Supplier not found' });
    res.json({ success: true });
  } catch (error: any) {
    if (error.message.includes('UNIQUE')) {
      res.status(400).json({ error: 'Supplier name already exists' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

app.delete('/api/suppliers/:id', requireAuth, requirePermission('canDeleteData'), (req, res) => {
  try {
    const result = db.prepare('DELETE FROM suppliers WHERE id = ? AND companyId = ?').run(req.params.id, (req as any).companyId);
    if (result.changes === 0) return res.status(404).json({ error: 'Supplier not found' });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── PRODUCTS CRUD ─────────────────────────────────────────────────────────────
app.get('/api/products', requireAuth, (req, res) => {
  const products = db.prepare('SELECT * FROM products WHERE companyId = ? ORDER BY name ASC').all((req as any).companyId);
  res.json(products);
});

app.post('/api/products', requireAuth, (req, res) => {
  const { id, name, description, type, unitPrice, unit, taxRate, categoryId, itemCode, supplierName, stockQuantity, minStockLevel, trackStock } = req.body;
  try {
    const prodId = id || `p-${Date.now()}`;
    db.prepare(`
      INSERT INTO products (id, name, description, type, unitPrice, unit, taxRate, categoryId, companyId, itemCode, supplierName, stockQuantity, minStockLevel, trackStock)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      prodId,
      name,
      description || '',
      type,
      unitPrice,
      unit,
      taxRate,
      categoryId || '',
      (req as any).companyId,
      itemCode || null,
      supplierName || null,
      Number(stockQuantity) || 0,
      Number(minStockLevel) || 5,
      trackStock !== undefined ? (trackStock ? 1 : 0) : 1
    );
    res.json({ id: prodId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/products/:id', requireAuth, (req, res) => {
  const { name, description, type, unitPrice, unit, taxRate, categoryId, itemCode, supplierName, stockQuantity, minStockLevel, trackStock } = req.body;
  try {
    db.prepare(`
      UPDATE products
      SET name = ?, description = ?, type = ?, unitPrice = ?, unit = ?, taxRate = ?, categoryId = ?, itemCode = ?, supplierName = ?,
          stockQuantity = ?, minStockLevel = ?, trackStock = ?
      WHERE id = ? AND companyId = ?
    `).run(
      name,
      description || '',
      type,
      unitPrice,
      unit,
      taxRate,
      categoryId || '',
      itemCode || null,
      supplierName || null,
      Number(stockQuantity) || 0,
      Number(minStockLevel) || 5,
      trackStock !== undefined ? (trackStock ? 1 : 0) : 1,
      req.params.id,
      (req as any).companyId
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/products/:id', requireAuth, requirePermission('canDeleteData'), (req, res) => {
  db.prepare('DELETE FROM products WHERE id = ? AND companyId = ?').run(req.params.id, (req as any).companyId);
  res.json({ success: true });
});

// ── QUOTATIONS CRUD ───────────────────────────────────────────────────────────
// ── DOCUMENT NUMBERING ────────────────────────────────────────────────────────
app.get('/api/sequences/next/:docType', requireAuth, (req, res) => {
  try {
    const number = getNextDocumentNumber(req.params.docType);
    res.json({ number });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/sequences', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM sequences').all();
  res.json(rows);
});

app.put('/api/sequences/:docType', requireAuth, requirePermission('canManageSettings'), (req, res) => {
  const { prefix, padding, resetPeriod } = req.body;
  try {
    db.prepare(`
      UPDATE sequences SET prefix = ?, padding = ?, resetPeriod = ? WHERE docType = ?
    `).run(prefix, padding, resetPeriod, req.params.docType);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/quotes', requireAuth, (req, res) => {
  const quotes = db.prepare('SELECT * FROM quotations WHERE companyId = ? AND (deleted_at IS NULL OR deleted_at = \'\') ORDER BY date DESC').all((req as any).companyId) as any[];
  const parsed = quotes.map(q => ({
    ...q,
    lineItems: JSON.parse(q.lineItems || '[]'),
    date: new Date(q.date),
    validUntil: new Date(q.validUntil),
    createdAt: new Date(q.createdAt),
    updatedAt: new Date(q.updatedAt),
    hidePrices: q.hidePrices === 1,
    manualTotal: q.manualTotal !== null && q.manualTotal !== undefined ? q.manualTotal : undefined
  }));
  res.json(parsed);
});

app.post('/api/quotes', requireAuth, (req, res) => {
  const user = (req as any).user;
  const canOverride = user.role === 'admin' || (user.permissions && user.permissions.canOverridePrice === true);
  if (!canOverride && !verifyPriceOverrides(req.body)) {
    return res.status(403).json({ error: 'Forbidden: price overrides are not permitted for your user role.' });
  }

  const {
    id, customerId, date, validUntil, status, lineItems, notes, terms, subject, subjectAr, currency,
    subtotal, discountTotal, taxTotal, total, salespersonId, watermarkText, watermarkType, hidePrices, manualTotal
  } = req.body;
  try {
    // Prefer the client-sent id, but if it already exists (millisecond collision)
    // generate a fresh UUID to avoid UNIQUE constraint errors.
    let qId = id || `qt-${Date.now()}`;
    const existing = db.prepare('SELECT 1 FROM quotations WHERE id = ?').get(qId);
    if (existing) qId = `qt-${crypto.randomUUID()}`;
    const number = getNextDocumentNumber('quotation');
    db.prepare(`
      INSERT INTO quotations (id, number, customerId, date, validUntil, status, lineItems, notes, terms, subject, subjectAr, currency, subtotal, discountTotal, taxTotal, total, createdAt, updatedAt, salespersonId, watermarkText, watermarkType, hidePrices, manualTotal, createdBy, createdByName, updatedBy, updatedByName, companyId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      qId,
      number,
      customerId,
      date,
      validUntil,
      status,
      JSON.stringify(lineItems || []),
      notes || '',
      terms || '',
      subject || '',
      subjectAr || '',
      currency,
      subtotal,
      discountTotal,
      taxTotal,
      total,
      new Date().toISOString(),
      new Date().toISOString(),
      salespersonId || '',
      watermarkText || 'PAID',
      watermarkType || 'none',
      hidePrices ? 1 : 0,
      manualTotal !== undefined && manualTotal !== null ? manualTotal : null,
      user.id, user.name, user.id, user.name,
      (req as any).companyId
    );
    logDocumentActivity('quotation', qId, number, 'created', user, (req as any).companyId);
    res.json({ id: qId, number });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/quotes/:id', requireAuth, (req, res) => {
  const user = (req as any).user;
  const canOverride = user.role === 'admin' || (user.permissions && user.permissions.canOverridePrice === true);
  if (!canOverride) {
    const existing = db.prepare('SELECT manualTotal, lineItems FROM quotations WHERE id = ? AND companyId = ?').get(req.params.id, (req as any).companyId);
    if (!verifyPriceOverrides(req.body, existing)) {
      return res.status(403).json({ error: 'Forbidden: price overrides are not permitted for your user role.' });
    }
  }

  const {
    number, customerId, date, validUntil, status, lineItems, notes, terms, subject, subjectAr, currency,
    subtotal, discountTotal, taxTotal, total, linkedInvoiceId, salespersonId, watermarkText, watermarkType, hidePrices, manualTotal
  } = req.body;
  try {
    const before = db.prepare('SELECT * FROM quotations WHERE id = ? AND companyId = ?').get(req.params.id, (req as any).companyId) as any;
    if (!before) return res.status(404).json({ error: 'Document not found' });
    db.prepare(`
      UPDATE quotations
      SET number = ?, customerId = ?, date = ?, validUntil = ?, status = ?, lineItems = ?, notes = ?, terms = ?, subject = ?, subjectAr = ?, currency = ?, subtotal = ?, discountTotal = ?, taxTotal = ?, total = ?, linkedInvoiceId = ?, updatedAt = ?, salespersonId = ?, watermarkText = ?, watermarkType = ?, hidePrices = ?, manualTotal = ?, updatedBy = ?, updatedByName = ?
      WHERE id = ? AND companyId = ?
    `).run(
      number,
      customerId,
      date,
      validUntil,
      status,
      JSON.stringify(lineItems || []),
      notes || '',
      terms || '',
      subject || '',
      subjectAr || '',
      currency,
      subtotal,
      discountTotal,
      taxTotal,
      total,
      linkedInvoiceId || null,
      new Date().toISOString(),
      salespersonId || '',
      watermarkText || 'PAID',
      watermarkType || 'none',
      hidePrices ? 1 : 0,
      manualTotal !== undefined && manualTotal !== null ? manualTotal : null,
      user.id, user.name,
      req.params.id, (req as any).companyId
    );
    if (before) {
      const changes = computeDocumentDiff(
        before,
        { subject, status, total, discountTotal, notes, lineItems },
        ['subject', 'status', 'total', 'discountTotal', 'notes']
      );
      const statusChanged = before.status !== status;
      const snapshotData = { ...before };
      try { if (typeof snapshotData.lineItems === 'string') snapshotData.lineItems = JSON.parse(snapshotData.lineItems); } catch(e){}
      logDocumentActivity('quotation', req.params.id, number, statusChanged ? 'status_changed' : 'updated', user, (req as any).companyId, changes, snapshotData);
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/quotes/:id', requireAuth, requirePermission('canDeleteData'), (req, res) => {
  const user = (req as any).user;
  const before = db.prepare('SELECT number FROM quotations WHERE id = ? AND companyId = ?').get(req.params.id, (req as any).companyId) as any;
  const now = new Date().toISOString();
  db.prepare('UPDATE quotations SET deleted_at = ?, deleted_by = ? WHERE id = ? AND companyId = ?').run(now, user.name || user.username, req.params.id, (req as any).companyId);
  logDocumentActivity('quotation', req.params.id, before?.number || null, 'deleted', user, (req as any).companyId);
  res.json({ success: true });
});

// ── INVOICES CRUD ─────────────────────────────────────────────────────────────
app.get('/api/invoices', requireAuth, (req, res) => {
  const invoices = db.prepare('SELECT * FROM invoices WHERE companyId = ? AND (deleted_at IS NULL OR deleted_at = \'\') ORDER BY date DESC').all((req as any).companyId) as any[];
  const parsed = invoices.map(i => ({
    ...i,
    lineItems: JSON.parse(i.lineItems || '[]'),
    payments: JSON.parse(i.payments || '[]'),
    date: new Date(i.date),
    dueDate: new Date(i.dueDate),
    createdAt: new Date(i.createdAt),
    updatedAt: new Date(i.updatedAt),
    hidePrices: i.hidePrices === 1,
    manualTotal: i.manualTotal !== null && i.manualTotal !== undefined ? i.manualTotal : undefined
  }));
  res.json(parsed);
});

app.post('/api/invoices', requireAuth, (req, res) => {
  const user = (req as any).user;
  const canOverride = user.role === 'admin' || (user.permissions && user.permissions.canOverridePrice === true);
  if (!canOverride && !verifyPriceOverrides(req.body)) {
    return res.status(403).json({ error: 'Forbidden: price overrides are not permitted for your user role.' });
  }

  const {
    id, customerId, date, dueDate, status, paymentTerms, lineItems, notes, terms, subject, subjectAr, currency,
    subtotal, discountTotal, taxTotal, total, linkedQuoteId, payments, amountPaid, amountDue, salespersonId, watermarkText, watermarkType, hidePrices, manualTotal
  } = req.body;
  try {
    let invId = id || `inv-${Date.now()}`;
    const existing = db.prepare('SELECT 1 FROM invoices WHERE id = ?').get(invId);
    if (existing) invId = `inv-${crypto.randomUUID()}`;
    const number = getNextDocumentNumber('invoice');
    db.prepare(`
      INSERT INTO invoices (id, number, customerId, date, dueDate, status, paymentTerms, lineItems, notes, terms, subject, subjectAr, currency, subtotal, discountTotal, taxTotal, total, linkedQuoteId, payments, amountPaid, amountDue, createdAt, updatedAt, salespersonId, watermarkText, watermarkType, hidePrices, manualTotal, createdBy, createdByName, updatedBy, updatedByName, companyId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      invId,
      number,
      customerId,
      date,
      dueDate,
      status,
      paymentTerms,
      JSON.stringify(lineItems || []),
      notes || '',
      terms || '',
      subject || '',
      subjectAr || '',
      currency,
      subtotal,
      discountTotal,
      taxTotal,
      total,
      linkedQuoteId || null,
      JSON.stringify(payments || []),
      amountPaid || 0,
      amountDue || total,
      new Date().toISOString(),
      new Date().toISOString(),
      salespersonId || '',
      watermarkText || 'PAID',
      watermarkType || 'none',
      hidePrices ? 1 : 0,
      manualTotal !== undefined && manualTotal !== null ? manualTotal : null,
      user.id, user.name, user.id, user.name,
      (req as any).companyId
    );
    logDocumentActivity('invoice', invId, number, 'created', user, (req as any).companyId);

    // Auto-adjust inventory for products with stock tracking
    if (status === 'posted' || (payments && payments.length > 0)) {
      try {
        for (const item of (lineItems || [])) {
          if (item.productId && (item.type === 'item' || !item.type)) {
            const prod = db.prepare('SELECT id, stockQuantity, trackStock FROM products WHERE id = ? AND companyId = ?').get(item.productId, (req as any).companyId) as any;
            if (prod && (prod.trackStock === 1 || prod.trackStock === undefined)) {
              const qty = Number(item.quantity) || 0;
              const prev = Number(prod.stockQuantity) || 0;
              const nextStock = Math.max(0, prev - qty);
              db.prepare('UPDATE products SET stockQuantity = ? WHERE id = ? AND companyId = ?').run(nextStock, item.productId, (req as any).companyId);
              db.prepare(`
                INSERT INTO inventory_transactions (id, companyId, productId, type, quantity, previousStock, newStock, referenceDocType, referenceDocId, notes, createdBy, createdByName, createdAt)
                VALUES (?, ?, ?, 'out', ?, ?, ?, 'invoice', ?, 'Deducted on invoice posting', ?, ?, ?)
              `).run(
                `invlog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                (req as any).companyId,
                item.productId,
                qty,
                prev,
                nextStock,
                invId,
                user?.id || null,
                user?.name || null,
                new Date().toISOString()
              );
            }
          }
        }
      } catch (stockErr) {
        console.error('Inventory auto-deduction error:', stockErr);
      }
    }

    res.json({ id: invId, number });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/invoices/:id', requireAuth, (req, res) => {
  const user = (req as any).user;
  const canOverride = user.role === 'admin' || (user.permissions && user.permissions.canOverridePrice === true);
  if (!canOverride) {
    const existing = db.prepare('SELECT manualTotal, lineItems FROM invoices WHERE id = ? AND companyId = ?').get(req.params.id, (req as any).companyId);
    if (!verifyPriceOverrides(req.body, existing)) {
      return res.status(403).json({ error: 'Forbidden: price overrides are not permitted for your user role.' });
    }
  }

  const {
    number, customerId, date, dueDate, status, paymentTerms, lineItems, notes, terms, subject, subjectAr, currency,
    subtotal, discountTotal, taxTotal, total, linkedQuoteId, payments, amountPaid, amountDue, salespersonId, watermarkText, watermarkType, hidePrices, manualTotal
  } = req.body;
  try {
    const before = db.prepare('SELECT * FROM invoices WHERE id = ? AND companyId = ?').get(req.params.id, (req as any).companyId) as any;
    if (!before) return res.status(404).json({ error: 'Document not found' });
    db.prepare(`
      UPDATE invoices
      SET number = ?, customerId = ?, date = ?, dueDate = ?, status = ?, paymentTerms = ?, lineItems = ?, notes = ?, terms = ?, subject = ?, subjectAr = ?, currency = ?, subtotal = ?, discountTotal = ?, taxTotal = ?, total = ?, linkedQuoteId = ?, payments = ?, amountPaid = ?, amountDue = ?, updatedAt = ?, salespersonId = ?, watermarkText = ?, watermarkType = ?, hidePrices = ?, manualTotal = ?, updatedBy = ?, updatedByName = ?
      WHERE id = ? AND companyId = ?
    `).run(
      number,
      customerId,
      date,
      dueDate,
      status,
      paymentTerms,
      JSON.stringify(lineItems || []),
      notes || '',
      terms || '',
      subject || '',
      subjectAr || '',
      currency,
      subtotal,
      discountTotal,
      taxTotal,
      total,
      linkedQuoteId || null,
      JSON.stringify(payments || []),
      amountPaid || 0,
      amountDue || total,
      new Date().toISOString(),
      salespersonId || '',
      watermarkText || 'PAID',
      watermarkType || 'none',
      hidePrices ? 1 : 0,
      manualTotal !== undefined && manualTotal !== null ? manualTotal : null,
      user.id, user.name,
      req.params.id, (req as any).companyId
    );
    if (before) {
      const changes = computeDocumentDiff(
        before,
        { subject, status, total, amountPaid, notes, lineItems },
        ['subject', 'status', 'total', 'amountPaid', 'notes']
      );
      const statusChanged = before.status !== status;
      const snapshotData = { ...before };
      try { if (typeof snapshotData.lineItems === 'string') snapshotData.lineItems = JSON.parse(snapshotData.lineItems); } catch(e){}
      try { if (typeof snapshotData.payments === 'string') snapshotData.payments = JSON.parse(snapshotData.payments); } catch(e){}
      logDocumentActivity('invoice', req.params.id, number, statusChanged ? 'status_changed' : 'updated', user, (req as any).companyId, changes, snapshotData);
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/invoices/:id', requireAuth, requirePermission('canDeleteData'), (req, res) => {
  const user = (req as any).user;
  const before = db.prepare('SELECT number FROM invoices WHERE id = ? AND companyId = ?').get(req.params.id, (req as any).companyId) as any;
  const now = new Date().toISOString();
  db.prepare('UPDATE invoices SET deleted_at = ?, deleted_by = ? WHERE id = ? AND companyId = ?').run(now, user.name || user.username, req.params.id, (req as any).companyId);
  logDocumentActivity('invoice', req.params.id, before?.number || null, 'deleted', user, (req as any).companyId);
  res.json({ success: true });
});

// ── RECYCLE BIN ENDPOINTS ──────────────────────────────────────────────────
app.get('/api/recycle-bin', requireAuth, (req, res) => {
  const companyId = (req as any).companyId;
  const deletedQuotes = db.prepare(`
    SELECT q.id as quote_id, q.number, q.subject, c.companyName as customer_name, q.createdByName as author_name, q.deleted_at, q.deleted_by, COALESCE(q.retain_forever, 0) as retain_forever, 'quotation' as type
    FROM quotations q
    LEFT JOIN customers c ON q.customerId = c.id
    WHERE q.companyId = ? AND q.deleted_at IS NOT NULL AND q.deleted_at != ''
  `).all(companyId) as any[];

  const deletedInvoices = db.prepare(`
    SELECT i.id as quote_id, i.number, i.subject, c.companyName as customer_name, i.createdByName as author_name, i.deleted_at, i.deleted_by, COALESCE(i.retain_forever, 0) as retain_forever, 'invoice' as type
    FROM invoices i
    LEFT JOIN customers c ON i.customerId = c.id
    WHERE i.companyId = ? AND i.deleted_at IS NOT NULL AND i.deleted_at != ''
  `).all(companyId) as any[];

  const allItems = [...deletedQuotes, ...deletedInvoices].sort((a, b) => new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime());
  res.json(allItems);
});

app.post('/api/recycle-bin/:id/restore', requireAuth, (req, res) => {
  const companyId = (req as any).companyId;
  const user = (req as any).user;
  const quote = db.prepare('SELECT number FROM quotations WHERE id = ? AND companyId = ?').get(req.params.id, companyId) as any;
  if (quote) {
    db.prepare('UPDATE quotations SET deleted_at = NULL, deleted_by = NULL WHERE id = ? AND companyId = ?').run(req.params.id, companyId);
    logDocumentActivity('quotation', req.params.id, quote.number, 'status_changed', user, companyId);
    return res.json({ success: true, type: 'quotation' });
  }

  const invoice = db.prepare('SELECT number FROM invoices WHERE id = ? AND companyId = ?').get(req.params.id, companyId) as any;
  if (invoice) {
    db.prepare('UPDATE invoices SET deleted_at = NULL, deleted_by = NULL WHERE id = ? AND companyId = ?').run(req.params.id, companyId);
    logDocumentActivity('invoice', req.params.id, invoice.number, 'status_changed', user, companyId);
    return res.json({ success: true, type: 'invoice' });
  }

  res.status(404).json({ error: 'Item not found in recycle bin' });
});

app.delete('/api/recycle-bin/:id', requireAuth, requirePermission('canDeleteData'), (req, res) => {
  const companyId = (req as any).companyId;
  const user = (req as any).user;
  const quote = db.prepare('SELECT number FROM quotations WHERE id = ? AND companyId = ?').get(req.params.id, companyId) as any;
  if (quote) {
    db.prepare('DELETE FROM quotations WHERE id = ? AND companyId = ?').run(req.params.id, companyId);
    logDocumentActivity('quotation', req.params.id, quote.number, 'deleted', user, companyId);
    return res.json({ success: true });
  }

  const invoice = db.prepare('SELECT number FROM invoices WHERE id = ? AND companyId = ?').get(req.params.id, companyId) as any;
  if (invoice) {
    db.prepare('DELETE FROM invoices WHERE id = ? AND companyId = ?').run(req.params.id, companyId);
    logDocumentActivity('invoice', req.params.id, invoice.number, 'deleted', user, companyId);
    return res.json({ success: true });
  }

  res.status(404).json({ error: 'Item not found in recycle bin' });
});

app.patch('/api/recycle-bin/:id/retain', requireAuth, (req, res) => {
  const companyId = (req as any).companyId;
  const retain = req.body.retain ? 1 : 0;
  const res1 = db.prepare('UPDATE quotations SET retain_forever = ? WHERE id = ? AND companyId = ?').run(retain, req.params.id, companyId);
  const res2 = db.prepare('UPDATE invoices SET retain_forever = ? WHERE id = ? AND companyId = ?').run(retain, req.params.id, companyId);
  if (res1.changes > 0 || res2.changes > 0) {
    res.json({ success: true, retain });
  } else {
    res.status(404).json({ error: 'Item not found' });
  }
});

app.post('/api/recycle-bin/prune', requireAuth, requirePermission('canDeleteData'), (req, res) => {
  const companyId = (req as any).companyId;
  const days = Number(req.body.days) || 30;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  
  const qResult = db.prepare(`
    DELETE FROM quotations
    WHERE companyId = ? AND (retain_forever IS NULL OR retain_forever = 0)
      AND deleted_at IS NOT NULL AND deleted_at != '' AND deleted_at < ?
  `).run(companyId, cutoff);

  const iResult = db.prepare(`
    DELETE FROM invoices
    WHERE companyId = ? AND (retain_forever IS NULL OR retain_forever = 0)
      AND deleted_at IS NOT NULL AND deleted_at != '' AND deleted_at < ?
  `).run(companyId, cutoff);

  res.json({ success: true, purgedQuotes: qResult.changes, purgedInvoices: iResult.changes });
});

// ── SYSTEM CONFIGURATION & SETTINGS API ───────────────────────────────────────
const readTenantSettings = (companyId: string): any => {
  const row = db.prepare('SELECT settings FROM companies WHERE id = ?').get(companyId) as { settings?: string | null } | undefined;
  try { return row?.settings ? JSON.parse(row.settings) : {}; } catch { return {}; }
};

const writeTenantSettings = (companyId: string, settings: any) => {
  db.prepare('UPDATE companies SET settings = ? WHERE id = ?').run(JSON.stringify(settings), companyId);
};

app.get('/api/settings/company', requireAuth, (req, res) => {
  const companyId = (req as any).companyId;
  const companyRecord = db.prepare('SELECT name FROM companies WHERE id = ?').get(companyId) as { name: string } | undefined;
  const tenantSettings = readTenantSettings(companyId);
  const legacyRow = db.prepare("SELECT value FROM settings WHERE key = 'company'").get() as { value: string } | undefined;
  let legacyProfile: any = {};
  try { legacyProfile = legacyRow ? JSON.parse(legacyRow.value) : {}; } catch { legacyProfile = {}; }
  res.json({ ...legacyProfile, ...(tenantSettings.profile || {}), name: companyRecord?.name || tenantSettings.profile?.name || legacyProfile.name });
});

// ── PLANS & FEATURE FLAGS API ─────────────────────────────────────────────────
app.get('/api/features', requireAuth, (req, res) => {
  const companyId = (req as any).companyId;
  const companyRecord = db.prepare('SELECT activePlan FROM companies WHERE id = ?').get(companyId) as { activePlan: string } | undefined;
  res.json({
    activePlan: companyRecord?.activePlan || 'enterprise',
    features: getActiveFeatures(companyId),
    catalog: FEATURE_CATALOG,
    plans: Object.entries(PLANS).map(([key, p]) => ({ key, label: p.label, features: p.features })),
  });
});

app.put('/api/features', requireAuth, requirePermission('canManageSettings'), (req, res) => {
  try {
    const companyId = (req as any).companyId;
    const { activePlan, features } = req.body as { activePlan?: string; features?: Record<string, boolean> };
    if (activePlan && PLANS[activePlan]) {
      // Switching plan resets flags to that plan's defaults unless explicit features given
      const flags = features || featuresFromPlan(activePlan);
      db.prepare('UPDATE companies SET activePlan = ?, featureFlags = ? WHERE id = ?').run(activePlan, JSON.stringify(flags), companyId);
    } else if (features) {
      // Manual per-feature override; force core features on
      for (const f of FEATURE_CATALOG) if (f.core) features[f.key] = true;
      db.prepare('UPDATE companies SET featureFlags = ? WHERE id = ?').run(JSON.stringify(features), companyId);
    }
    res.json({ success: true, features: getActiveFeatures(companyId) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/settings/company', requireAuth, requirePermission('canManageSettings'), (req, res) => {
  try {
    const companyId = (req as any).companyId;
    const tenantSettings = readTenantSettings(companyId);
    tenantSettings.profile = { ...(tenantSettings.profile || {}), ...req.body };
    writeTenantSettings(companyId, tenantSettings);
    if (req.body.name && String(req.body.name).trim()) {
      db.prepare('UPDATE companies SET name = ? WHERE id = ?').run(String(req.body.name).trim(), companyId);
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Individual Settings Key/Value API (for logo, footerImage, etc.) ───────────
app.get('/api/settings/:key', requireAuth, (req, res) => {
  const tenantSettings = readTenantSettings((req as any).companyId);
  if (tenantSettings[req.params.key] !== undefined) {
    return res.json({ value: tenantSettings[req.params.key] });
  }
  // Global (non-tenant) fallback: never expose credential-like keys to ordinary users.
  if (/smtp|secret|password|token|api_?key|credential/i.test(req.params.key)) return res.json({ value: null });
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(req.params.key) as { value: string } | undefined;
  res.json({ value: row?.value || null });
});

app.post('/api/settings', requireAuth, requirePermission('canManageSettings'), (req, res) => {
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ error: 'Key is required' });
  try {
    if (key === 'detailedLogsEnabled') {
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
    } else {
      const companyId = (req as any).companyId;
      const tenantSettings = readTenantSettings(companyId);
      tenantSettings[key] = value;
      writeTenantSettings(companyId, tenantSettings);
    }
    logSystemEvent('info', `Setting updated: ${key}`, { value }, (req as any).user?.id, (req as any).user?.username);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── SYSTEM LOGS API ───────────────────────────────────────────────────────────
app.get('/api/logs', requireAuth, requirePermission('canManageSettings'), (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 200;
    const offset = parseInt(req.query.offset as string) || 0;
    
    // Logs are platform-wide: company admins only see entries from users of their own company.
    const isSuper = (req as any).user?.isSuperAdmin === 1 || (req as any).user?.isSuperAdmin === true;
    const scope = isSuper ? '' : 'WHERE user_id IN (SELECT userId FROM user_companies WHERE companyId = ?)';
    const scopeArgs = isSuper ? [] : [(req as any).companyId];

    const rows = db.prepare(`
      SELECT * FROM system_logs ${scope}
      ORDER BY timestamp DESC 
      LIMIT ? OFFSET ?
    `).all(...scopeArgs, limit, offset) as any[];

    const totalRow = db.prepare(`SELECT COUNT(*) as count FROM system_logs ${scope}`).get(...scopeArgs) as { count: number };
    
    res.json({
      logs: rows,
      total: totalRow.count
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/logs/clear', requireAuth, requirePermission('canManageSettings'), (req, res) => {
  try {
    const u = (req as any).user;
    if (!(u?.isSuperAdmin === 1 || u?.isSuperAdmin === true)) {
      return res.status(403).json({ error: 'Only platform administrators can clear the global system log.' });
    }
    db.prepare('DELETE FROM system_logs').run();
    logSystemEvent('info', 'System logs cleared', null, (req as any).user?.id, (req as any).user?.username);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Ingest client-side UI & runtime errors with full action context
app.post('/api/logs/client-error', (req, res) => {
  try {
    const { action, error, stack, componentStack, route, metadata } = req.body || {};
    const token = req.headers.authorization?.split(' ')[1];
    let user: any = null;
    if (token) {
      const session = db.prepare('SELECT user_id FROM sessions WHERE token = ?').get(token) as any;
      if (session) {
        user = db.prepare('SELECT id, username, name FROM users WHERE id = ?').get(session.user_id);
      }
    }

    const message = `[Client Error] Action: "${action || 'UI Interaction'}" | Error: ${error || 'Unknown Error'}`;
    const details = {
      actionAttempted: action || 'Unknown action',
      route: route || 'unknown',
      errorMessage: error,
      stackTrace: stack,
      componentStack: componentStack,
      metadata: metadata || {},
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString()
    };

    logSystemEvent('error', message, details, user?.id, user?.username);
    res.json({ success: true, logged: true });
  } catch (err: any) {
    console.error('Failed to log client error:', err);
    res.status(500).json({ error: 'Failed to record error log' });
  }
});

// ── EXPENSES & VENDOR BILLS API ───────────────────────────────────────────────
app.get('/api/expenses', requireAuth, (req, res) => {
  const companyId = (req as any).companyId;
  const { category, status, search, from, to } = req.query as Record<string, string>;
  let sql = 'SELECT * FROM expenses WHERE companyId = ?';
  const params: any[] = [companyId];

  if (category && category !== 'all') {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (status && status !== 'all') {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (from) {
    sql += ' AND date >= ?';
    params.push(from);
  }
  if (to) {
    sql += ' AND date <= ?';
    params.push(to);
  }
  if (search) {
    sql += ' AND (description LIKE ? OR vendor LIKE ? OR number LIKE ? OR reference LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }

  sql += ' ORDER BY date DESC, createdAt DESC';
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

app.get('/api/expenses/summary', requireAuth, (req, res) => {
  const companyId = (req as any).companyId;
  const totalRow = db.prepare(`
    SELECT 
      COALESCE(SUM(total), 0) as totalAmount,
      COALESCE(SUM(taxAmount), 0) as totalTax,
      COALESCE(SUM(amount), 0) as totalPreTax,
      COALESCE(SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END), 0) as paidAmount,
      COALESCE(SUM(CASE WHEN status = 'pending' THEN total ELSE 0 END), 0) as pendingAmount,
      COALESCE(SUM(CASE WHEN taxDeductible = 1 THEN taxAmount ELSE 0 END), 0) as deductibleTax
    FROM expenses WHERE companyId = ?
  `).get(companyId) as any;

  const categoryBreakdown = db.prepare(`
    SELECT category, COALESCE(SUM(total), 0) as amount, COUNT(*) as count
    FROM expenses WHERE companyId = ?
    GROUP BY category ORDER BY amount DESC
  `).all(companyId);

  res.json({
    totals: totalRow,
    byCategory: categoryBreakdown
  });
});

app.post('/api/expenses', requireAuth, (req, res) => {
  const companyId = (req as any).companyId;
  const user = (req as any).user;
  const {
    category, vendor, description, amount, taxRate, currency, date,
    paymentMethod, reference, receiptUrl, status, taxDeductible, notes
  } = req.body;

  if (!description || amount === undefined) {
    return res.status(400).json({ error: 'Description and amount are required' });
  }

  try {
    const id = `exp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const number = getNextDocumentNumber('expense');
    const amt = Number(amount) || 0;
    const rate = taxRate !== undefined ? Number(taxRate) : 15;
    const taxAmt = Math.round((amt * (rate / 100)) * 100) / 100;
    const totalAmt = Math.round((amt + taxAmt) * 100) / 100;
    const timestamp = new Date().toISOString();

    db.prepare(`
      INSERT INTO expenses (
        id, number, companyId, category, vendor, description, amount, taxAmount, taxRate,
        total, currency, date, paymentMethod, reference, receiptUrl, status,
        taxDeductible, notes, createdBy, createdByName, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      number,
      companyId,
      category || 'other',
      vendor || '',
      description.trim(),
      amt,
      taxAmt,
      rate,
      totalAmt,
      currency || 'SAR',
      date || new Date().toISOString().slice(0, 10),
      paymentMethod || 'bank_transfer',
      reference || '',
      receiptUrl || null,
      status || 'paid',
      taxDeductible !== undefined ? (taxDeductible ? 1 : 0) : 1,
      notes || '',
      user?.id || null,
      user?.name || null,
      timestamp,
      timestamp
    );

    logSystemEvent('info', `Expense recorded: ${number} (${description})`, { id, number, totalAmt }, user?.id, user?.username);
    res.json({ id, number, total: totalAmt });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/expenses/:id', requireAuth, (req, res) => {
  const companyId = (req as any).companyId;
  const user = (req as any).user;
  const {
    category, vendor, description, amount, taxRate, currency, date,
    paymentMethod, reference, receiptUrl, status, taxDeductible, notes
  } = req.body;

  try {
    const amt = Number(amount) || 0;
    const rate = taxRate !== undefined ? Number(taxRate) : 15;
    const taxAmt = Math.round((amt * (rate / 100)) * 100) / 100;
    const totalAmt = Math.round((amt + taxAmt) * 100) / 100;
    const timestamp = new Date().toISOString();

    const result = db.prepare(`
      UPDATE expenses
      SET category = ?, vendor = ?, description = ?, amount = ?, taxAmount = ?, taxRate = ?,
          total = ?, currency = ?, date = ?, paymentMethod = ?, reference = ?, receiptUrl = ?,
          status = ?, taxDeductible = ?, notes = ?, updatedAt = ?
      WHERE id = ? AND companyId = ?
    `).run(
      category || 'other',
      vendor || '',
      description.trim(),
      amt,
      taxAmt,
      rate,
      totalAmt,
      currency || 'SAR',
      date || new Date().toISOString().slice(0, 10),
      paymentMethod || 'bank_transfer',
      reference || '',
      receiptUrl || null,
      status || 'paid',
      taxDeductible !== undefined ? (taxDeductible ? 1 : 0) : 1,
      notes || '',
      timestamp,
      req.params.id,
      companyId
    );

    if (result.changes === 0) return res.status(404).json({ error: 'Expense not found' });
    res.json({ success: true, total: totalAmt });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/expenses/:id', requireAuth, requirePermission('canDeleteData'), (req, res) => {
  const companyId = (req as any).companyId;
  db.prepare('DELETE FROM expenses WHERE id = ? AND companyId = ?').run(req.params.id, companyId);
  res.json({ success: true });
});

// ── RECURRING INVOICES & SUBSCRIPTIONS API ─────────────────────────────────────
app.get('/api/recurring-invoices', requireAuth, (req, res) => {
  const companyId = (req as any).companyId;
  const rows = db.prepare(`
    SELECT r.*, c.companyName as customerName, c.email as customerEmail
    FROM recurring_invoices r
    LEFT JOIN customers c ON c.id = r.customerId
    WHERE r.companyId = ?
    ORDER BY r.createdAt DESC
  `).all(companyId);
  res.json(rows);
});

app.post('/api/recurring-invoices', requireAuth, (req, res) => {
  const companyId = (req as any).companyId;
  const user = (req as any).user;
  const {
    customerId, profileName, frequency, startDate, nextRunDate,
    endDate, status, autoSendEmail, currency, lineItems, notes, terms, total
  } = req.body;

  if (!customerId || !profileName) {
    return res.status(400).json({ error: 'Customer and profile name are required' });
  }

  try {
    const id = `rec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const number = getNextDocumentNumber('recurring');
    const timestamp = new Date().toISOString();

    db.prepare(`
      INSERT INTO recurring_invoices (
        id, number, companyId, customerId, profileName, frequency, startDate, nextRunDate,
        endDate, status, autoSendEmail, currency, lineItems, notes, terms, total,
        generationCount, createdBy, createdByName, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
    `).run(
      id,
      number,
      companyId,
      customerId,
      profileName.trim(),
      frequency || 'monthly',
      startDate || timestamp.slice(0, 10),
      nextRunDate || startDate || timestamp.slice(0, 10),
      endDate || null,
      status || 'active',
      autoSendEmail ? 1 : 0,
      currency || 'SAR',
      typeof lineItems === 'string' ? lineItems : JSON.stringify(lineItems || []),
      notes || '',
      terms || '',
      Number(total) || 0,
      user?.id || null,
      user?.name || null,
      timestamp,
      timestamp
    );

    res.json({ id, number });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/recurring-invoices/:id', requireAuth, (req, res) => {
  const companyId = (req as any).companyId;
  const {
    customerId, profileName, frequency, startDate, nextRunDate,
    endDate, status, autoSendEmail, currency, lineItems, notes, terms, total
  } = req.body;

  try {
    const timestamp = new Date().toISOString();
    const result = db.prepare(`
      UPDATE recurring_invoices
      SET customerId = ?, profileName = ?, frequency = ?, startDate = ?, nextRunDate = ?,
          endDate = ?, status = ?, autoSendEmail = ?, currency = ?, lineItems = ?,
          notes = ?, terms = ?, total = ?, updatedAt = ?
      WHERE id = ? AND companyId = ?
    `).run(
      customerId,
      profileName.trim(),
      frequency || 'monthly',
      startDate,
      nextRunDate,
      endDate || null,
      status || 'active',
      autoSendEmail ? 1 : 0,
      currency || 'SAR',
      typeof lineItems === 'string' ? lineItems : JSON.stringify(lineItems || []),
      notes || '',
      terms || '',
      Number(total) || 0,
      timestamp,
      req.params.id,
      companyId
    );

    if (result.changes === 0) return res.status(404).json({ error: 'Recurring profile not found' });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/recurring-invoices/:id', requireAuth, requirePermission('canDeleteData'), (req, res) => {
  const companyId = (req as any).companyId;
  db.prepare('DELETE FROM recurring_invoices WHERE id = ? AND companyId = ?').run(req.params.id, companyId);
  res.json({ success: true });
});

// Trigger generation of an invoice from recurring schedule
app.post('/api/recurring-invoices/:id/process', requireAuth, (req, res) => {
  const companyId = (req as any).companyId;
  const user = (req as any).user;
  const profile = db.prepare('SELECT * FROM recurring_invoices WHERE id = ? AND companyId = ?').get(req.params.id, companyId) as any;

  if (!profile) return res.status(404).json({ error: 'Recurring profile not found' });

  try {
    const invoiceId = `inv-${Date.now()}`;
    const invoiceNumber = getNextDocumentNumber('invoice');
    const today = new Date().toISOString().slice(0, 10);
    const due = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const timestamp = new Date().toISOString();

    const items = typeof profile.lineItems === 'string' ? JSON.parse(profile.lineItems) : (profile.lineItems || []);
    let subtotal = 0, taxTotal = 0;
    for (const it of items) {
      if (it.type === 'item') {
        const lineSub = (Number(it.quantity) || 1) * (Number(it.unitPrice) || 0);
        subtotal += lineSub;
        taxTotal += lineSub * ((Number(it.taxPercent) || 15) / 100);
      }
    }
    const total = Math.round((subtotal + taxTotal) * 100) / 100;

    // Create the invoice
    db.prepare(`
      INSERT INTO invoices (
        id, number, customerId, date, dueDate, status, paymentTerms, lineItems,
        notes, terms, currency, subtotal, discountTotal, taxTotal, total,
        payments, amountPaid, amountDue, createdAt, updatedAt, companyId,
        createdBy, createdByName
      ) VALUES (?, ?, ?, ?, ?, 'posted', 'Net 30', ?, ?, ?, ?, ?, 0, ?, ?, '[]', 0, ?, ?, ?, ?, ?, ?)
    `).run(
      invoiceId,
      invoiceNumber,
      profile.customerId,
      today,
      due,
      typeof profile.lineItems === 'string' ? profile.lineItems : JSON.stringify(profile.lineItems),
      profile.notes || `Generated from recurring subscription ${profile.number}`,
      profile.terms || '',
      profile.currency || 'SAR',
      subtotal,
      taxTotal,
      total,
      total,
      timestamp,
      timestamp,
      companyId,
      user?.id || null,
      user?.name || 'Subscription Engine'
    );

    // Compute next run date
    const currentRun = new Date(profile.nextRunDate || today);
    const nextDate = new Date(currentRun);
    switch (profile.frequency) {
      case 'weekly': nextDate.setDate(nextDate.getDate() + 7); break;
      case 'monthly': nextDate.setMonth(nextDate.getMonth() + 1); break;
      case 'quarterly': nextDate.setMonth(nextDate.getMonth() + 3); break;
      case 'semi_annual': nextDate.setMonth(nextDate.getMonth() + 6); break;
      case 'yearly': nextDate.setFullYear(nextDate.getFullYear() + 1); break;
      default: nextDate.setMonth(nextDate.getMonth() + 1); break;
    }

    const nextRunStr = nextDate.toISOString().slice(0, 10);
    db.prepare(`
      UPDATE recurring_invoices
      SET lastGeneratedInvoiceId = ?, lastGeneratedAt = ?, nextRunDate = ?,
          generationCount = generationCount + 1, updatedAt = ?
      WHERE id = ? AND companyId = ?
    `).run(invoiceId, timestamp, nextRunStr, timestamp, profile.id, companyId);

    logDocumentActivity('invoice', invoiceId, invoiceNumber, 'created', { id: user?.id, name: 'Subscription Engine' }, companyId);

    res.json({
      success: true,
      invoiceId,
      invoiceNumber,
      nextRunDate: nextRunStr
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── INVENTORY TRANSACTIONS & STOCK ADJUSTMENT API ──────────────────────────────
app.get('/api/inventory/logs', requireAuth, (req, res) => {
  const companyId = (req as any).companyId;
  const rows = db.prepare(`
    SELECT it.*, p.name as productName, p.itemCode, p.unit, p.stockQuantity as currentStock
    FROM inventory_transactions it
    JOIN products p ON p.id = it.productId
    WHERE it.companyId = ?
    ORDER BY it.createdAt DESC LIMIT 200
  `).all(companyId);
  res.json(rows);
});

app.post('/api/inventory/adjust', requireAuth, (req, res) => {
  const companyId = (req as any).companyId;
  const user = (req as any).user;
  const { productId, type, quantity, notes } = req.body;

  if (!productId || !type || quantity === undefined) {
    return res.status(400).json({ error: 'Product ID, adjustment type, and quantity are required' });
  }

  try {
    const prod = db.prepare('SELECT id, name, stockQuantity FROM products WHERE id = ? AND companyId = ?').get(productId, companyId) as any;
    if (!prod) return res.status(404).json({ error: 'Product not found' });

    const prevStock = Number(prod.stockQuantity) || 0;
    const qty = Number(quantity) || 0;
    let newStock = prevStock;

    if (type === 'in') newStock = prevStock + qty;
    else if (type === 'out') newStock = Math.max(0, prevStock - qty);
    else if (type === 'adjustment') newStock = Math.max(0, qty);

    db.prepare('UPDATE products SET stockQuantity = ? WHERE id = ? AND companyId = ?').run(newStock, productId, companyId);

    const logId = `invlog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    db.prepare(`
      INSERT INTO inventory_transactions (
        id, companyId, productId, type, quantity, previousStock, newStock, notes, createdBy, createdByName, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      logId,
      companyId,
      productId,
      type,
      qty,
      prevStock,
      newStock,
      notes || 'Manual stock adjustment',
      user?.id || null,
      user?.name || null,
      new Date().toISOString()
    );

    res.json({ success: true, productId, previousStock: prevStock, newStock });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── PUBLIC CLIENT PORTAL & SHAREABLE LINKS API ────────────────────────────────
app.post('/api/portal/generate-link/:docType/:docId', requireAuth, (req, res) => {
  const companyId = (req as any).companyId;
  const { docType, docId } = req.params;

  if (docType !== 'quotation' && docType !== 'invoice') {
    return res.status(400).json({ error: 'Invalid document type for public sharing' });
  }

  try {
    const table = docType === 'quotation' ? 'quotations' : 'invoices';
    const doc = db.prepare(`SELECT id, number FROM ${table} WHERE id = ? AND companyId = ?`).get(docId, companyId) as any;
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    // Check if an active token already exists
    let share = db.prepare("SELECT * FROM public_shares WHERE companyId = ? AND docType = ? AND docId = ? AND status != 'expired'").get(companyId, docType, docId) as any;

    if (!share) {
      const id = `share-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const token = crypto.randomBytes(24).toString('hex');
      const createdAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 90 * 86400000).toISOString(); // 90 days

      db.prepare(`
        INSERT INTO public_shares (id, token, companyId, docType, docId, expiresAt, status, viewsCount, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, 'active', 0, ?)
      `).run(id, token, companyId, docType, docId, expiresAt, createdAt);

      share = { token, docType, docId, status: 'active', expiresAt };
    }

    res.json({
      token: share.token,
      docType,
      docId,
      shareUrl: `/portal/${docType}/${share.token}`
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Public GET portal document (No auth required)
app.get('/api/portal/:docType/:token', (req, res) => {
  const { docType, token } = req.params;
  if (docType !== 'quotation' && docType !== 'invoice') {
    return res.status(400).json({ error: 'Invalid document type' });
  }

  try {
    const share = db.prepare('SELECT * FROM public_shares WHERE token = ? AND docType = ?').get(token, docType) as any;
    if (!share) return res.status(404).json({ error: 'Public link invalid or expired.' });

    // Increment view count
    db.prepare('UPDATE public_shares SET viewsCount = viewsCount + 1, lastViewedAt = ? WHERE id = ?').run(new Date().toISOString(), share.id);

    const table = docType === 'quotation' ? 'quotations' : 'invoices';
    const doc = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(share.docId) as any;
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    // Fetch company & customer
    const companyRow = db.prepare('SELECT * FROM companies WHERE id = ?').get(share.companyId) as any;
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(doc.customerId) as any;
    const settings = readTenantSettings(share.companyId);

    let zatcaQr: string | null = null;
    if (docType === 'invoice') {
      try {
        zatcaQr = generateZatcaQRBase64(
          settings.profile?.name || companyRow?.name || 'Qvoke Enterprise',
          settings.profile?.vatNumber || '300000000000003',
          doc.date,
          doc.total,
          doc.taxTotal
        );
      } catch (err) {
        console.error('Failed to generate ZATCA QR for portal:', err);
      }
    }

    res.json({
      docType,
      share: {
        token: share.token,
        status: share.status,
        acceptedAt: share.acceptedAt,
        acceptedByName: share.acceptedByName,
        acceptedSignature: share.acceptedSignature
      },
      company: {
        name: companyRow?.name || 'Qvoke Enterprise',
        email: settings.profile?.email || '',
        phone: settings.profile?.phone || '',
        vatNumber: settings.profile?.vatNumber || '',
        crNumber: settings.profile?.crNumber || '',
        address: settings.profile?.address || { street: '', city: 'Riyadh', country: 'SA' },
        logo: settings.logo || settings.profile?.logo || null
      },
      customer: customer ? {
        id: customer.id,
        companyName: customer.companyName,
        contactPerson: customer.contactPerson,
        email: customer.email,
        phone: customer.phone,
        vatNumber: customer.vatNumber,
        billingAddress: typeof customer.billingAddress === 'string' ? JSON.parse(customer.billingAddress) : customer.billingAddress
      } : null,
      document: {
        ...doc,
        lineItems: typeof doc.lineItems === 'string' ? JSON.parse(doc.lineItems) : (doc.lineItems || []),
        payments: doc.payments ? (typeof doc.payments === 'string' ? JSON.parse(doc.payments) : doc.payments) : []
      },
      zatcaQr
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Public POST accept quotation / invoice (No auth required)
app.post('/api/portal/:docType/:token/accept', (req, res) => {
  const { docType, token } = req.params;
  const { clientName, signature } = req.body;

  if (!clientName) return res.status(400).json({ error: 'Signer name is required for approval' });

  try {
    const share = db.prepare('SELECT * FROM public_shares WHERE token = ? AND docType = ?').get(token, docType) as any;
    if (!share) return res.status(404).json({ error: 'Public link invalid' });

    const timestamp = new Date().toISOString();
    db.prepare(`
      UPDATE public_shares
      SET status = 'accepted', acceptedAt = ?, acceptedByName = ?, acceptedSignature = ?
      WHERE id = ?
    `).run(timestamp, clientName.trim(), signature || null, share.id);

    if (docType === 'quotation') {
      db.prepare("UPDATE quotations SET status = 'confirmed', updatedAt = ? WHERE id = ?").run(timestamp, share.docId);
      logDocumentActivity('quotation', share.docId, null, 'status_changed', { id: 'client-portal', name: `${clientName} (Portal)` }, share.companyId, [
        { field: 'status', from: 'sent', to: 'confirmed' }
      ]);
    }

    res.json({ success: true, acceptedAt: timestamp });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Public POST decline quotation (No auth required)
app.post('/api/portal/:docType/:token/decline', (req, res) => {
  const { docType, token } = req.params;
  const { feedbackNote } = req.body;

  try {
    const share = db.prepare('SELECT * FROM public_shares WHERE token = ? AND docType = ?').get(token, docType) as any;
    if (!share) return res.status(404).json({ error: 'Public link invalid' });

    const timestamp = new Date().toISOString();
    db.prepare(`
      UPDATE public_shares
      SET status = 'declined', feedbackNote = ?
      WHERE id = ?
    `).run(feedbackNote || 'Client requested revision', share.id);

    if (docType === 'quotation') {
      logDocumentActivity('quotation', share.docId, null, 'updated', { id: 'client-portal', name: 'Client Portal' }, share.companyId, [
        { field: 'client_feedback', from: '', to: feedbackNote || 'Declined / revision requested' }
      ]);
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── LIVE / CACHED CURRENCY EXCHANGE RATES API ──────────────────────────────────
app.get('/api/currency/rates', (req, res) => {
  // Baseline currency exchange matrix (Base: SAR)
  const rates = {
    base: 'SAR',
    timestamp: new Date().toISOString(),
    rates: {
      SAR: 1.0,
      USD: 0.2666,
      EUR: 0.2450,
      GBP: 0.2105,
      AED: 0.9790,
      QAR: 0.9700,
      KWD: 0.0818,
      BHD: 0.1005,
      OMR: 0.1025
    }
  };
  res.json(rates);
});

// ── Translation API ───────────────────────────────────────────────────────────
// Proxies to Google Translate with chunking + retry for reliability.
app.post('/api/translate', requireAuth, async (req, res) => {
  const rawText = req.body.text || req.body.q || '';
  if (typeof rawText !== 'string') return res.status(400).json({ error: 'text must be a string' });
  const text = rawText.trim();
  if (!text) return res.json({ translation: '', translatedText: '' });
  // SECURITY: cap input size (this endpoint can fall back to a paid API key).
  if (text.length > 20000) return res.status(413).json({ error: 'Text too long (max 20000 characters).' });
  // Default source is English: sl=auto misdetects names/IBANs as other languages and drops numbers.
  const langCode = (v: any, fallback: string) => (typeof v === 'string' && /^[a-zA-Z-]{2,8}$/.test(v) ? v : fallback);
  const sl = langCode(req.body.sl ?? req.body.source, 'en');
  const tl = langCode(req.body.tl ?? req.body.target, 'ar');

  // Split on sentence boundaries so each chunk stays under 400 chars
  const splitIntoChunks = (str: string, maxLen = 400): string[] => {
    if (str.length <= maxLen) return [str];
    const chunks: string[] = [];
    const sentences = str.split(/(?<=[\.\!\?\n])\s+/);
    let current = '';
    for (const s of sentences) {
      if ((current + s).length > maxLen && current) {
        chunks.push(current.trim());
        current = s;
      } else {
        current += (current ? ' ' : '') + s;
      }
    }
    if (current) chunks.push(current.trim());
    return chunks;
  };

  const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

  const translateChunk = async (chunk: string, attempt = 0): Promise<string> => {
    if (!chunk || !chunk.trim()) return '';
    // Strategy 1: Google Chrome Translate API (clients5 - fast & reliable)
    try {
      const url = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(tl)}&q=${encodeURIComponent(chunk)}`;
      const response = await fetch(url, {
        headers: { 'User-Agent': BROWSER_UA },
        signal: AbortSignal.timeout(8000),
      });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          if (typeof data[0] === 'string' && data[0].trim()) return data[0].trim();
          if (Array.isArray(data[0]) && typeof data[0][0] === 'string' && data[0][0].trim()) return data[0][0].trim();
        }
      }
    } catch (err: any) {
      // Continue to next strategy
    }

    // Strategy 2: Google Translate GTX Endpoint with browser UA
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(chunk)}`;
      const response = await fetch(url, {
        headers: { 'User-Agent': BROWSER_UA },
        signal: AbortSignal.timeout(8000),
      });
      if (response.ok) {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await response.json();
          let result = '';
          if (data && data[0]) {
            data[0].forEach((segment: any) => { if (segment[0]) result += segment[0]; });
          }
          if (result.trim()) return result.trim();
        }
      }
    } catch (err: any) {
      // Continue to next strategy
    }

    // Strategy 3: AI Translation fallback (Gemini / OpenRouter / OpenAI) if configured
    const aiKey = process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
    if (aiKey && aiKey !== 'dummy_key_to_prevent_startup_crash') {
      try {
        const isRouter = !!process.env.OPENROUTER_API_KEY;
        const isGemini = !isRouter && !!process.env.GEMINI_API_KEY;
        const aiClient = new OpenAI({
          baseURL: isRouter ? 'https://openrouter.ai/api/v1' : isGemini ? 'https://generativelanguage.googleapis.com/v1beta/openai/' : undefined,
          apiKey: aiKey
        });
        const aiResponse = await aiClient.chat.completions.create({
          model: isRouter ? 'openai/gpt-4o-mini' : isGemini ? 'gemini-2.0-flash' : 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a professional English-to-Arabic translator. Translate the given text to Modern Standard Arabic accurately and concisely. Return ONLY the Arabic translation without explanation, markdown quotes, or notes.'
            },
            {
              role: 'user',
              content: chunk
            }
          ],
          temperature: 0.2,
        });
        const aiText = aiResponse.choices[0]?.message?.content?.trim();
        if (aiText) return aiText;
      } catch (err: any) {
        // Fall through to retry
      }
    }

    // Retry with backoff if attempts remaining
    if (attempt < 2) {
      await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
      return translateChunk(chunk, attempt + 1);
    }
    throw new Error('Translation failed across all translation backends.');
  };

  // Guarantee account numbers / IBANs are never lost in translation, and use the concise IBAN label.
  const preserveNumbers = (src: string, trans: string): string => {
    const numRe = /\b(\d{4,}|[A-Z]{2}\d{10,})\b/g;
    const cleaned = trans.replace(/رقم الحساب المصرفي الدولي\s*:/g, 'الآيبان:');
    const srcLines = src.split('\n');
    const transLines = cleaned.split('\n');
    const addMissing = (from: string, to: string) => {
      let out = to;
      for (const num of from.match(numRe) || []) if (!out.includes(num)) out += ' ' + num;
      return out;
    };
    if (srcLines.length === transLines.length) return transLines.map((t, i) => addMissing(srcLines[i], t)).join('\n');
    return addMissing(src, cleaned);
  };

  try {
    // Translate line-by-line so multi-line fields (bank details, terms) keep their structure.
    const lines = text.split('\n');
    const translatedLines = await Promise.all(lines.map(async (line) => {
      if (!line.trim()) return '';
      const parts = await Promise.all(splitIntoChunks(line.trim()).map(c => translateChunk(c)));
      return parts.join(' ').trim();
    }));
    const finalTranslation = preserveNumbers(text, translatedLines.join('\n')).trim();
    res.json({ translation: finalTranslation, translatedText: finalTranslation });
  } catch (error: any) {
    console.error('Translation error:', error);
    res.status(500).json({ error: 'Translation failed' });
  }
});

// ── DATABASE MAINTENANCE API ──────────────────────────────────────────────────
import fs from 'fs';
import path from 'path';

app.post('/api/admin/optimize', requireAuth, requirePermission('canDatabaseMaintenance'), (req, res) => {
  try {
    db.prepare('VACUUM').run();
    db.prepare('ANALYZE').run();
    res.json({ success: true, message: 'Database optimized and compacted successfully!' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/backups', requireAuth, requirePermission('canDatabaseMaintenance'), (req, res) => {
  try {
    const backupDir = path.resolve('backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const files = fs.readdirSync(backupDir)
      .filter(f => f.endsWith('.db'))
      .map(f => {
        const filePath = path.join(backupDir, f);
        const stats = fs.statSync(filePath);
        return {
          filename: f,
          size: stats.size,
          createdAt: stats.birthtime.toISOString()
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json(files);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/backup', requireAuth, requirePermission('canDatabaseMaintenance'), (req, res) => {
  try {
    const backupDir = path.resolve('backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `quotes_backup_${timestamp}.db`;
    const backupPath = path.join(backupDir, backupName);

    // safe database snapshot using backup API
    db.backup(backupPath)
      .then(() => {
        res.json({ success: true, filename: backupName });
      })
      .catch((err: any) => {
        res.status(500).json({ error: err.message });
      });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Validate a candidate DB file before it replaces the live one, then swap it in (drops stale WAL/SHM).
function validateAndSwapDatabase(candidatePath: string): void {
  const probe = new Database(candidatePath, { readonly: true, fileMustExist: true });
  try {
    const ok = probe.pragma('integrity_check', { simple: true });
    const hasCore = probe.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='quotations'").get();
    if (ok !== 'ok' || !hasCore) throw new Error('File is not a valid Qvoke database');
  } finally {
    probe.close();
  }
  db.close();
  for (const ext of ['-wal', '-shm']) { try { fs.unlinkSync('quotes.db' + ext); } catch {} }
  fs.copyFileSync(candidatePath, 'quotes.db');
}

app.post('/api/admin/restore', requireAuth, requirePermission('canDatabaseMaintenance'), (req, res) => {
  const { filename } = req.body;
  if (!filename) {
    return res.status(400).json({ error: 'Filename is required' });
  }
  try {
    const backupPath = path.resolve('backups', path.basename(String(filename))); // no path traversal
    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ error: 'Backup file not found' });
    }

    validateAndSwapDatabase(backupPath);
    res.json({ success: true, message: 'Database restored! System restarting...' });

    setTimeout(() => {
      process.exit(0);
    }, 800);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── DOWNLOAD A BACKUP FILE ────────────────────────────────────────────────────
app.get('/api/admin/backup/download/:filename', requireAuth, requirePermission('canDatabaseMaintenance'), (req, res) => {
  try {
    const filename = path.basename(req.params.filename); // sanitize
    const backupPath = path.resolve('backups', filename);
    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ error: 'Backup file not found' });
    }
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.sendFile(backupPath);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── DELETE A BACKUP FILE ──────────────────────────────────────────────────────
app.delete('/api/admin/backup/:filename', requireAuth, requirePermission('canDatabaseMaintenance'), (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const backupPath = path.resolve('backups', filename);
    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ error: 'Backup file not found' });
    }
    fs.unlinkSync(backupPath);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── RESTORE FROM UPLOADED DB FILE ─────────────────────────────────────────────
import multer from 'multer';
const uploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const backupDir = path.resolve('backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    cb(null, backupDir);
  },
  filename: (req, file, cb) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    cb(null, `upload_restore_${timestamp}.db`);
  }
});
const uploadDb = multer({ storage: uploadStorage, limits: { fileSize: 200 * 1024 * 1024 } });

app.post('/api/admin/restore/upload', requireAuth, requirePermission('canDatabaseMaintenance'), uploadDb.single('dbfile'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const uploadedPath = req.file.path;
    validateAndSwapDatabase(uploadedPath);
    res.json({ success: true, message: 'Database restored from upload! Restarting...' });
    setTimeout(() => process.exit(0), 800);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── EXCEL EXPORT ENDPOINTS ────────────────────────────────────────────────────
// Returns JSON that client turns into .xlsx via SheetJS (no server-side dep needed)
app.get('/api/export/products', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT id, name, description, type, unitPrice, unit, taxRate, categoryId FROM products WHERE companyId = ? ORDER BY name ASC').all((req as any).companyId);
  res.json(rows);
});

app.get('/api/export/customers', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT id, companyName, contactPerson, email, phone, vatNumber, billingAddress, createdAt FROM customers WHERE companyId = ? ORDER BY createdAt DESC').all((req as any).companyId) as any[];
  const parsed = rows.map(r => {
    let addr: any = {};
    try { addr = JSON.parse(r.billingAddress || '{}'); } catch {}
    return {
      id: r.id, companyName: r.companyName, contactPerson: r.contactPerson,
      email: r.email, phone: r.phone, vatNumber: r.vatNumber,
      street: addr.street || '', district: addr.district || '',
      city: addr.city || '', postalCode: addr.postalCode || '',
      country: addr.country || 'SA', createdAt: r.createdAt
    };
  });
  res.json(parsed);
});

app.get('/api/export/suppliers', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT id, name FROM suppliers WHERE companyId = ? ORDER BY name ASC').all((req as any).companyId);
  res.json(rows);
});

// Full database Excel export (all tables as separate sheets)
app.get('/api/export/full', requireAuth, requirePermission('canDatabaseMaintenance'), (req, res) => {
  try {
    const companyId = (req as any).companyId;
    const products = db.prepare('SELECT id, name, description, type, unitPrice, unit, taxRate, categoryId FROM products WHERE companyId = ? ORDER BY name ASC').all(companyId);
    const rawCustomers = db.prepare('SELECT id, companyName, contactPerson, email, phone, vatNumber, billingAddress, createdAt FROM customers WHERE companyId = ? ORDER BY createdAt DESC').all(companyId) as any[];
    const customers = rawCustomers.map(r => {
      let addr: any = {};
      try { addr = JSON.parse(r.billingAddress || '{}'); } catch {}
      return { id: r.id, companyName: r.companyName, contactPerson: r.contactPerson, email: r.email, phone: r.phone, vatNumber: r.vatNumber, street: addr.street || '', district: addr.district || '', city: addr.city || '', country: addr.country || 'SA', createdAt: r.createdAt };
    });
    const suppliers = db.prepare('SELECT id, name FROM suppliers WHERE companyId = ? ORDER BY name ASC').all(companyId);
    const quotations = db.prepare('SELECT id, number, status, date, validUntil, subtotal, discountTotal, taxTotal, total, currency, customerId, subject FROM quotations WHERE companyId = ? ORDER BY date DESC').all(companyId);
    const invoices = db.prepare('SELECT id, number, status, date, dueDate, subtotal, taxTotal, total, amountPaid, amountDue, currency, customerId FROM invoices WHERE companyId = ? ORDER BY date DESC').all(companyId);
    res.json({ products, customers, suppliers, quotations, invoices });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── EXCEL IMPORT ENDPOINTS ────────────────────────────────────────────────────
app.post('/api/import/products', requireAuth, requirePermission('canDatabaseMaintenance'), (req, res) => {
  const { rows } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'No rows provided' });
  let inserted = 0, updated = 0, errors = 0;
  const companyId = (req as any).companyId;
  const insertStmt = db.prepare(`INSERT OR IGNORE INTO products (id, name, description, type, unitPrice, unit, taxRate, categoryId, companyId) VALUES (?,?,?,?,?,?,?,?,?)`);
  const updateStmt = db.prepare(`UPDATE products SET name=?, description=?, type=?, unitPrice=?, unit=?, taxRate=?, categoryId=? WHERE id=? AND companyId=?`);
  const txn = db.transaction(() => {
    for (const r of rows) {
      try {
        const id = (r.id || `p-${Date.now()}-${Math.random().toString(36).slice(2)}`).toString();
        const name = (r.name || '').toString().trim();
        if (!name) { errors++; continue; }
        const existing = db.prepare('SELECT id FROM products WHERE id = ? AND companyId = ?').get(id, companyId);
        if (existing) {
          updateStmt.run(name, r.description || '', r.type || 'product', parseFloat(r.unitPrice) || 0, r.unit || 'pc', parseFloat(r.taxRate) || 15, r.categoryId || 'general', id, companyId);
          updated++;
        } else {
          insertStmt.run(id, name, r.description || '', r.type || 'product', parseFloat(r.unitPrice) || 0, r.unit || 'pc', parseFloat(r.taxRate) || 15, r.categoryId || 'general', companyId);
          inserted++;
        }
      } catch { errors++; }
    }
  });
  txn();
  res.json({ success: true, inserted, updated, errors });
});

app.post('/api/import/customers', requireAuth, requirePermission('canDatabaseMaintenance'), (req, res) => {
  const { rows } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'No rows provided' });
  let inserted = 0, updated = 0, errors = 0;
  const companyId = (req as any).companyId;
  const txn = db.transaction(() => {
    for (const r of rows) {
      try {
        const id = (r.id || `cust-${Date.now()}-${Math.random().toString(36).slice(2)}`).toString();
        const companyName = (r.companyName || '').toString().trim();
        if (!companyName) { errors++; continue; }
        const addr = JSON.stringify({ street: r.street || '', district: r.district || '', city: r.city || '', postalCode: r.postalCode || '', country: r.country || 'SA' });
        const existing = db.prepare('SELECT id FROM customers WHERE id = ? AND companyId = ?').get(id, companyId);
        if (existing) {
          db.prepare(`UPDATE customers SET companyName=?, contactPerson=?, email=?, phone=?, vatNumber=?, billingAddress=? WHERE id=? AND companyId=?`).run(companyName, r.contactPerson || '', r.email || '', r.phone || '', r.vatNumber || '', addr, id, companyId);
          updated++;
        } else {
          db.prepare(`INSERT OR IGNORE INTO customers (id, companyName, contactPerson, email, phone, vatNumber, billingAddress, createdAt, companyId) VALUES (?,?,?,?,?,?,?,?,?)`).run(id, companyName, r.contactPerson || '', r.email || '', r.phone || '', r.vatNumber || '', addr, new Date().toISOString(), companyId);
          inserted++;
        }
      } catch { errors++; }
    }
  });
  txn();
  res.json({ success: true, inserted, updated, errors });
});

app.post('/api/import/suppliers', requireAuth, requirePermission('canDatabaseMaintenance'), (req, res) => {
  const { rows } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'No rows provided' });
  let inserted = 0, errors = 0;
  const companyId = (req as any).companyId;
  const txn = db.transaction(() => {
    for (const r of rows) {
      try {
        const name = (r.name || '').toString().trim();
        if (!name) { errors++; continue; }
        const id = (r.id || `sup-${Date.now()}-${Math.random().toString(36).slice(2)}`).toString();
        db.prepare(`INSERT OR IGNORE INTO suppliers (id, name, companyId) VALUES (?, ?, ?)`).run(id, name, companyId);
        inserted++;
      } catch { errors++; }
    }
  });
  txn();
  res.json({ success: true, inserted, errors });
});

// ── BOQ (BILL OF QUANTITIES) CRUD ─────────────────────────────────────────────
// BOQ table: stores project-level bill of quantities documents
db.exec(`
  CREATE TABLE IF NOT EXISTS boq (
    id TEXT PRIMARY KEY,
    number TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    titleAr TEXT,
    customerId TEXT,
    projectRef TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    sections TEXT NOT NULL DEFAULT '[]',
    notes TEXT,
    currency TEXT NOT NULL DEFAULT 'SAR',
    subtotal REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    createdBy TEXT,
    type TEXT NOT NULL DEFAULT 'boq'
  );
`);
addColumnIfNotExists('boq', 'createdByName', 'TEXT');
addColumnIfNotExists('boq', 'updatedBy', 'TEXT');
addColumnIfNotExists('boq', 'updatedByName', 'TEXT');
addColumnIfNotExists('boq', 'companyId', 'TEXT');

// All scoped tables now exist — seed default company & backfill legacy rows.
ensureDefaultCompany();

// Replace the legacy global supplier-name constraint with tenant-local uniqueness.
const supplierSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'suppliers'").get() as { sql?: string } | undefined;
if (supplierSchema?.sql && /name\s+TEXT\s+NOT\s+NULL\s+UNIQUE/i.test(supplierSchema.sql)) {
  db.transaction(() => {
    db.exec(`
      ALTER TABLE suppliers RENAME TO suppliers_legacy;
      CREATE TABLE suppliers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        companyId TEXT NOT NULL,
        UNIQUE(companyId, name)
      );
      INSERT INTO suppliers (id, name, companyId)
      SELECT id, name, COALESCE(companyId, '${DEFAULT_COMPANY_ID}') FROM suppliers_legacy;
      DROP TABLE suppliers_legacy;
    `);
  })();
}
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_suppliers_company ON suppliers(companyId, name);
  CREATE INDEX IF NOT EXISTS idx_activity_company ON document_activity(companyId, timestamp);
  CREATE INDEX IF NOT EXISTS idx_tasks_company_user ON personal_tasks(companyId, userId, status);
`);

app.get('/api/boq', requireAuth, (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM boq WHERE companyId = ? ORDER BY createdAt DESC').all((req as any).companyId) as any[];
    const parsed = rows.map(r => ({
      ...r,
      sections: (() => { try { return JSON.parse(r.sections || '[]'); } catch { return []; } })(),
      createdAt: new Date(r.createdAt),
      updatedAt: new Date(r.updatedAt)
    }));
    res.json(parsed);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/boq/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM boq WHERE id = ? AND companyId = ?').get(req.params.id, (req as any).companyId) as any;
  if (!row) return res.status(404).json({ error: 'BOQ not found' });
  row.sections = (() => { try { return JSON.parse(row.sections || '[]'); } catch { return []; } })();
  res.json(row);
});

app.post('/api/boq', requireAuth, (req, res) => {
  const user = (req as any).user;
  const { id, title, titleAr, customerId, projectRef, status, sections, notes, currency, subtotal, total, type } = req.body;
  try {
    const boqId = id || `boq-${Date.now()}`;
    const docType = type === 'bom' ? 'bom' : 'boq';
    const number = getNextDocumentNumber(docType);
    db.prepare(`INSERT INTO boq (id, number, title, titleAr, customerId, projectRef, status, sections, notes, currency, subtotal, total, createdAt, updatedAt, createdBy, createdByName, updatedBy, updatedByName, type, companyId)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      boqId, number, title, titleAr || '', customerId || null, projectRef || '',
      status || 'draft', JSON.stringify(sections || []), notes || '',
      currency || 'SAR', subtotal || 0, total || 0,
      new Date().toISOString(), new Date().toISOString(),
      user.id, user.name, user.id, user.name,
      docType, (req as any).companyId
    );
    logDocumentActivity(docType, boqId, number, 'created', user, (req as any).companyId);
    res.json({ id: boqId, number });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/boq/:id', requireAuth, (req, res) => {
  const user = (req as any).user;
  const { number, title, titleAr, customerId, projectRef, status, sections, notes, currency, subtotal, total, type } = req.body;
  try {
    const before = db.prepare('SELECT * FROM boq WHERE id = ? AND companyId = ?').get(req.params.id, (req as any).companyId) as any;
    db.prepare(`UPDATE boq SET number=?, title=?, titleAr=?, customerId=?, projectRef=?, status=?, sections=?, notes=?, currency=?, subtotal=?, total=?, type=?, updatedAt=?, updatedBy=?, updatedByName=? WHERE id=? AND companyId=?`)
      .run(number, title, titleAr || '', customerId || null, projectRef || '', status || 'draft',
        JSON.stringify(sections || []), notes || '', currency || 'SAR',
        subtotal || 0, total || 0, type || 'boq', new Date().toISOString(),
        user.id, user.name, req.params.id, (req as any).companyId);
    if (before) {
      const docType = (type === 'bom' ? 'bom' : 'boq');
      const changes = computeDocumentDiff(
        before,
        { title, status, total, notes, sections },
        ['title', 'status', 'total', 'notes']
      );
      const statusChanged = before.status !== (status || 'draft');
      const snapshotData = { ...before };
      try { if (typeof snapshotData.sections === 'string') snapshotData.sections = JSON.parse(snapshotData.sections); } catch(e){}
      logDocumentActivity(docType, req.params.id, number, statusChanged ? 'status_changed' : 'updated', user, (req as any).companyId, changes, snapshotData);
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/boq/:id', requireAuth, requirePermission('canDeleteData'), (req, res) => {
  const user = (req as any).user;
  const before = db.prepare('SELECT number, type FROM boq WHERE id = ? AND companyId = ?').get(req.params.id, (req as any).companyId) as any;
  db.prepare('DELETE FROM boq WHERE id = ? AND companyId = ?').run(req.params.id, (req as any).companyId);
  logDocumentActivity(before?.type === 'bom' ? 'bom' : 'boq', req.params.id, before?.number || null, 'deleted', user, (req as any).companyId);
  res.json({ success: true });
});

// ── DOCUMENT TIMELINE / AUDIT LOG ─────────────────────────────────────────────
// Per-document history (who created, who changed what). Gated by canViewHistory.
app.get('/api/activity/:docType/:docId', requireAuth, requireFeature('tracking'), requirePermission('canViewHistory'), (req, res) => {
  try {
    const logs = db.prepare(
      'SELECT * FROM document_activity WHERE docType = ? AND docId = ? AND companyId = ? ORDER BY timestamp ASC'
    ).all(req.params.docType, req.params.docId, (req as any).companyId) as any[];
    res.json(logs.map(l => ({ ...l, changes: l.changes ? JSON.parse(l.changes) : [] })));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Global audit log across all documents (admin / canViewHistory). Supports ?docType=&actorId=&limit=
app.get('/api/audit', requireAuth, requireFeature('tracking'), requirePermission('canViewHistory'), (req, res) => {
  try {
    const { docType, actorId } = req.query as Record<string, string>;
    const limit = Math.min(Number(req.query.limit) || 200, 1000);
    const conditions: string[] = ['companyId = ?'];
    const params: any[] = [(req as any).companyId];
    if (docType) { conditions.push('docType = ?'); params.push(docType); }
    if (actorId) { conditions.push('actorId = ?'); params.push(actorId); }
    const where = `WHERE ${conditions.join(' AND ')}`;
    const logs = db.prepare(
      `SELECT * FROM document_activity ${where} ORDER BY timestamp DESC LIMIT ?`
    ).all(...params, limit) as any[];
    res.json(logs.map(l => ({ ...l, changes: l.changes ? JSON.parse(l.changes) : [] })));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── DOCUMENT SNAPSHOTS & RESTORE ──────────────────────────────────────────────
app.get('/api/snapshots/:docType/:docId', requireAuth, requireFeature('tracking'), requirePermission('canViewHistory'), (req, res) => {
  try {
    const snapshots = db.prepare(
      'SELECT id, docType, docId, version, actorName, createdAt FROM document_snapshots WHERE docType = ? AND docId = ? AND companyId = ? ORDER BY version DESC'
    ).all(req.params.docType, req.params.docId, (req as any).companyId);
    res.json(snapshots);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/snapshots/:docType/:docId/:snapshotId', requireAuth, requireFeature('tracking'), requirePermission('canViewHistory'), (req, res) => {
  try {
    const snapshot = db.prepare(
      'SELECT snapshot FROM document_snapshots WHERE id = ? AND docType = ? AND docId = ? AND companyId = ?'
    ).get(req.params.snapshotId, req.params.docType, req.params.docId, (req as any).companyId) as any;
    if (!snapshot) return res.status(404).json({ error: 'Snapshot not found' });
    res.json(JSON.parse(snapshot.snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/restore/:docType/:docId/:snapshotId', requireAuth, requireFeature('tracking'), requirePermission('canViewHistory'), (req, res) => {
  const user = (req as any).user;
  // Only admins or those with strict permissions can restore
  if (user.role !== 'admin' && !user.permissions?.canManageSettings) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { docType, docId, snapshotId } = req.params;
  const companyId = (req as any).companyId;

  try {
    const snapRow = db.prepare(
      'SELECT snapshot FROM document_snapshots WHERE id = ? AND docType = ? AND docId = ? AND companyId = ?'
    ).get(snapshotId, docType, docId, companyId) as any;
    
    if (!snapRow) return res.status(404).json({ error: 'Snapshot not found' });
    
    const snapData = JSON.parse(snapRow.snapshot);
    const tableMap: Record<string, string> = { quotation: 'quotations', invoice: 'invoices', boq: 'boq', bom: 'boq' };
    const table = tableMap[docType];
    
    if (!table) return res.status(400).json({ error: 'Invalid document type' });

    // Capture the current state before overwriting, so we don't lose the present
    const currentState = db.prepare(`SELECT * FROM ${table} WHERE id = ? AND companyId = ?`).get(docId, companyId) as any;

    // Depending on document type, restore the core fields. 
    // We only restore fields that the user can edit, not ID or creation dates.
    if (docType === 'quotation') {
      db.prepare(`
        UPDATE quotations SET
          customerId = ?, validUntil = ?, status = ?, lineItems = ?, notes = ?, terms = ?, subject = ?, subjectAr = ?,
          currency = ?, subtotal = ?, discountTotal = ?, taxTotal = ?, total = ?, manualTotal = ?,
          updatedAt = ?, updatedBy = ?, updatedByName = ?
        WHERE id = ? AND companyId = ?
      `).run(
        snapData.customerId, snapData.validUntil, snapData.status, JSON.stringify(snapData.lineItems || []),
        snapData.notes, snapData.terms, snapData.subject, snapData.subjectAr, snapData.currency,
        snapData.subtotal, snapData.discountTotal, snapData.taxTotal, snapData.total, snapData.manualTotal,
        new Date().toISOString(), user.id, user.name, docId, companyId
      );
    } else if (docType === 'invoice') {
      db.prepare(`
        UPDATE invoices SET
          customerId = ?, dueDate = ?, status = ?, paymentTerms = ?, lineItems = ?, notes = ?, terms = ?, subject = ?, subjectAr = ?,
          currency = ?, subtotal = ?, discountTotal = ?, taxTotal = ?, total = ?, manualTotal = ?,
          updatedAt = ?, updatedBy = ?, updatedByName = ?
        WHERE id = ? AND companyId = ?
      `).run(
        snapData.customerId, snapData.dueDate, snapData.status, snapData.paymentTerms, JSON.stringify(snapData.lineItems || []),
        snapData.notes, snapData.terms, snapData.subject, snapData.subjectAr, snapData.currency,
        snapData.subtotal, snapData.discountTotal, snapData.taxTotal, snapData.total, snapData.manualTotal,
        new Date().toISOString(), user.id, user.name, docId, companyId
      );
    } else if (docType === 'boq' || docType === 'bom') {
      db.prepare(`
        UPDATE boq SET
          title = ?, customerId = ?, notes = ?, sections = ?, currency = ?, taxRate = ?, subtotal = ?, taxTotal = ?, total = ?,
          updatedAt = ?, updatedBy = ?, updatedByName = ?
        WHERE id = ? AND companyId = ?
      `).run(
        snapData.title, snapData.customerId, snapData.notes, JSON.stringify(snapData.sections || []),
        snapData.currency, snapData.taxRate, snapData.subtotal, snapData.taxTotal, snapData.total,
        new Date().toISOString(), user.id, user.name, docId, companyId
      );
    }

    logDocumentActivity(docType, docId, currentState.number, 'restored', user, companyId, [{ field: 'Version', from: 'current', to: `Snapshot ${snapRow.id}` }], currentState);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── USAGE STATISTICS ──────────────────────────────────────────────────────────
// Aggregated from the document_activity audit trail. Gated by canViewRevenue.
app.get('/api/usage', requireAuth, requireFeature('usage'), requirePermission('canViewRevenue'), (req, res) => {
  try {
    const since = (req.query.since as string) || '1970-01-01';
    const byType = db.prepare(`
      SELECT docType, action, COUNT(*) as count
      FROM document_activity WHERE timestamp >= ? AND companyId = ?
      GROUP BY docType, action
    `).all(since, (req as any).companyId);
    const byUser = db.prepare(`
      SELECT actorId, actorName, COUNT(*) as count
      FROM document_activity WHERE timestamp >= ? AND action = 'created' AND companyId = ?
      GROUP BY actorId ORDER BY count DESC
    `).all(since, (req as any).companyId);
    const liveCounts = {
      quotations: (db.prepare('SELECT COUNT(*) as c FROM quotations WHERE companyId = ?').get((req as any).companyId) as any).c,
      invoices: (db.prepare('SELECT COUNT(*) as c FROM invoices WHERE companyId = ?').get((req as any).companyId) as any).c,
      boq: (db.prepare("SELECT COUNT(*) as c FROM boq WHERE type = 'boq' AND companyId = ?").get((req as any).companyId) as any).c,
      bom: (db.prepare("SELECT COUNT(*) as c FROM boq WHERE type = 'bom' AND companyId = ?").get((req as any).companyId) as any).c,
      customers: (db.prepare('SELECT COUNT(*) as c FROM customers WHERE companyId = ?').get((req as any).companyId) as any).c,
      products: (db.prepare('SELECT COUNT(*) as c FROM products WHERE companyId = ?').get((req as any).companyId) as any).c,
      users: (db.prepare('SELECT COUNT(*) as c FROM user_companies WHERE companyId = ?').get((req as any).companyId) as any).c,
    };
    res.json({ byType, byUser, liveCounts });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── NOTIFICATIONS ─────────────────────────────────────────────────────────────
app.get('/api/notifications', requireAuth, (req, res) => {
  try {
    const user = (req as any).user;
    const rows = db.prepare(`
      SELECT * FROM notifications
      WHERE userId = ? OR userId IS NULL
      ORDER BY createdAt DESC LIMIT 100
    `).all(user.id);
    res.json(rows.map((r: any) => ({ ...r, isRead: r.isRead === 1 })));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/notifications/:id/read', requireAuth, (req, res) => {
  try {
    db.prepare('UPDATE notifications SET isRead = 1 WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/notifications/read-all', requireAuth, (req, res) => {
  try {
    const user = (req as any).user;
    db.prepare('UPDATE notifications SET isRead = 1 WHERE userId = ? OR userId IS NULL').run(user.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Generate notifications for expiring quotations & overdue invoices (idempotent-ish: dedupes by link+type for the day)
app.post('/api/notifications/refresh', requireAuth, (req, res) => {
  try {
    const today = new Date();
    const in7 = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const nowIso = today.toISOString();
    const todayKey = nowIso.slice(0, 10);

    const expiring = db.prepare(`
      SELECT id, number, validUntil FROM quotations
      WHERE status NOT IN ('confirmed','cancelled','expired')
        AND validUntil IS NOT NULL AND validUntil <= ? AND validUntil >= ?
    `).all(in7, nowIso) as any[];

    const overdue = db.prepare(`
      SELECT id, number, dueDate FROM invoices
      WHERE status NOT IN ('paid','cancelled')
        AND dueDate IS NOT NULL AND dueDate < ? AND amountDue > 0
    `).all(nowIso) as any[];

    const existsToday = db.prepare(
      "SELECT 1 FROM notifications WHERE link = ? AND type = ? AND createdAt LIKE ? LIMIT 1"
    );
    let created = 0;
    for (const q of expiring) {
      const link = `quotation:${q.id}`;
      if (!existsToday.get(link, 'quote_expiring', `${todayKey}%`)) {
        createNotification(null, 'quote_expiring', `Quotation ${q.number} is expiring soon`, `Valid until ${String(q.validUntil).slice(0, 10)}`, link);
        created++;
      }
    }
    for (const inv of overdue) {
      const link = `invoice:${inv.id}`;
      if (!existsToday.get(link, 'invoice_overdue', `${todayKey}%`)) {
        createNotification(null, 'invoice_overdue', `Invoice ${inv.number} is overdue`, `Due ${String(inv.dueDate).slice(0, 10)}`, link);
        created++;
      }
    }
    res.json({ success: true, created });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── PERSONAL TASK TRACKER ─────────────────────────────────────────────────────
// Each user owns their own task list; no cross-user visibility.
app.get('/api/tasks', requireAuth, requireFeature('tasks'), (req, res) => {
  try {
    const user = (req as any).user;
    const rows = db.prepare(`
      SELECT * FROM personal_tasks WHERE userId = ? AND companyId = ?
      ORDER BY
        CASE status WHEN 'done' THEN 1 ELSE 0 END,
        CASE priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,
        (dueDate IS NULL), dueDate,
        createdAt DESC
    `).all(user.id, (req as any).companyId);
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tasks', requireAuth, requireFeature('tasks'), (req, res) => {
  try {
    const user = (req as any).user;
    const { title, notes, status, priority, dueDate, link } = req.body;
    if (!title || !String(title).trim()) return res.status(400).json({ error: 'Title is required.' });
    const id = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO personal_tasks (id, userId, title, notes, status, priority, dueDate, link, createdAt, updatedAt, completedAt, companyId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, user.id, String(title).trim(), notes || null,
      status || 'open', priority || 'normal', dueDate || null, link || null,
      now, now, status === 'done' ? now : null, (req as any).companyId
    );
    res.json(db.prepare('SELECT * FROM personal_tasks WHERE id = ? AND companyId = ?').get(id, (req as any).companyId));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/tasks/:id', requireAuth, requireFeature('tasks'), (req, res) => {
  try {
    const user = (req as any).user;
    const existing = db.prepare('SELECT * FROM personal_tasks WHERE id = ? AND userId = ? AND companyId = ?').get(req.params.id, user.id, (req as any).companyId) as any;
    if (!existing) return res.status(404).json({ error: 'Task not found.' });
    const { title, notes, status, priority, dueDate, link } = req.body;
    const now = new Date().toISOString();
    const newStatus = status ?? existing.status;
    const completedAt = newStatus === 'done'
      ? (existing.completedAt || now)
      : null;
    db.prepare(`
      UPDATE personal_tasks
      SET title = ?, notes = ?, status = ?, priority = ?, dueDate = ?, link = ?, updatedAt = ?, completedAt = ?
      WHERE id = ? AND userId = ? AND companyId = ?
    `).run(
      title ?? existing.title, notes ?? existing.notes, newStatus,
      priority ?? existing.priority, dueDate ?? existing.dueDate, link ?? existing.link,
      now, completedAt, req.params.id, user.id, (req as any).companyId
    );
    res.json(db.prepare('SELECT * FROM personal_tasks WHERE id = ? AND companyId = ?').get(req.params.id, (req as any).companyId));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/tasks/:id', requireAuth, requireFeature('tasks'), (req, res) => {
  try {
    const user = (req as any).user;
    const result = db.prepare('DELETE FROM personal_tasks WHERE id = ? AND userId = ? AND companyId = ?').run(req.params.id, user.id, (req as any).companyId);
    if (result.changes === 0) return res.status(404).json({ error: 'Task not found.' });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── FOLLOW-UP TRACKING ────────────────────────────────────────────────────────
// Lightweight, dedicated updates for the Tracking page so the heavy editor PUT
// (which rewrites a fixed column set) never clobbers these fields.
const followUpHandler = (table: 'quotations' | 'invoices') =>
  (req: express.Request, res: express.Response) => {
    try {
      const { followUpDate, followUpNote } = req.body;
      const companyId = (req as any).companyId;
      const exists = db.prepare(`SELECT id FROM ${table} WHERE id = ? AND companyId = ?`).get(req.params.id, companyId);
      if (!exists) return res.status(404).json({ error: 'Document not found.' });
      db.prepare(`UPDATE ${table} SET followUpDate = ?, followUpNote = ? WHERE id = ? AND companyId = ?`)
        .run(followUpDate || null, followUpNote || null, req.params.id, companyId);
      res.json({ success: true, followUpDate: followUpDate || null, followUpNote: followUpNote || null });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

app.put('/api/quotes/:id/followup', requireAuth, requireFeature('tracking'), followUpHandler('quotations'));
app.put('/api/invoices/:id/followup', requireAuth, requireFeature('tracking'), followUpHandler('invoices'));

// ── COMPANIES (multi-tenancy) ─────────────────────────────────────────────────
// List the companies the current user belongs to, plus the active one.
app.get('/api/companies', requireAuth, (req, res) => {
  try {
    const user = (req as any).user;
    const rows = db.prepare(`
      SELECT c.id, c.name, c.slug, c.activePlan, c.createdAt, c.settings, uc.role
      FROM companies c JOIN user_companies uc ON uc.companyId = c.id
      WHERE uc.userId = ? ORDER BY c.createdAt ASC
    `).all(user.id) as any[];
    const companies = rows.map((c) => {
      let theme: any = null;
      try { theme = c.settings ? (JSON.parse(c.settings).theme || null) : null; } catch { /* ignore */ }
      const { settings, ...rest } = c;
      return { ...rest, theme };
    });
    res.json({ companies, activeCompanyId: (req as any).companyId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new company; the creator becomes its owner and is enrolled immediately.
app.post('/api/companies', requireAuth, (req, res) => {
  try {
    const user = (req as any).user;
    const { name } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'Company name is required.' });
    const id = `comp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    db.prepare('INSERT INTO companies (id, name, slug, activePlan, featureFlags, createdAt) VALUES (?, ?, ?, ?, ?, ?)').run(
      id, String(name).trim(), null, 'enterprise', JSON.stringify(featuresFromPlan('enterprise')), new Date().toISOString()
    );
    db.prepare('INSERT INTO user_companies (userId, companyId, role) VALUES (?, ?, ?)').run(user.id, id, 'owner');
    res.json({ id, name: String(name).trim(), role: 'owner', activePlan: 'enterprise' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Rename / re-plan a company (owner or admin of that company only).
app.put('/api/companies/:id', requireAuth, (req, res) => {
  try {
    const user = (req as any).user;
    const membership = db.prepare('SELECT role FROM user_companies WHERE userId = ? AND companyId = ?').get(user.id, req.params.id) as { role: string } | undefined;
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return res.status(403).json({ error: 'Forbidden: requires company owner/admin.' });
    }
    const existing = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id) as any;
    if (!existing) return res.status(404).json({ error: 'Company not found.' });
    const { name, activePlan, theme } = req.body;
    // Merge theme into the settings JSON blob so other settings survive.
    let settings: any = {};
    try { settings = existing.settings ? JSON.parse(existing.settings) : {}; } catch { settings = {}; }
    if (theme !== undefined) settings.theme = theme;
    db.prepare('UPDATE companies SET name = ?, activePlan = ?, settings = ? WHERE id = ?').run(
      name ?? existing.name, activePlan ?? existing.activePlan, JSON.stringify(settings), req.params.id
    );
    res.json({ success: true, theme: settings.theme || null });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── PLATFORM SUPER-ADMIN CONTROL PLANE ────────────────────────────────────────
// A separate surface (super-admin only) to manage ALL tenant companies.
app.get('/api/admin/companies', requireAuth, requireSuperAdmin, (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM companies ORDER BY createdAt ASC').all() as any[];
    const count = (sql: string, id: string) => (db.prepare(sql).get(id) as any).c as number;
    const out = rows.map((c) => {
      let tenantSettings: any = {};
      try { tenantSettings = c.settings ? JSON.parse(c.settings) : {}; } catch { tenantSettings = {}; }
      const owner = db.prepare(`
        SELECT u.name, u.email FROM user_companies uc JOIN users u ON u.id = uc.userId
        WHERE uc.companyId = ? AND uc.role = 'owner' ORDER BY uc.rowid ASC LIMIT 1
      `).get(c.id) as { name: string; email: string } | undefined;
      return {
        id: c.id, name: c.name, slug: c.slug, status: c.status || 'active',
        activePlan: c.activePlan, createdAt: c.createdAt,
        isDefault: c.id === DEFAULT_COMPANY_ID,
        setupComplete: tenantSettings.onboardingComplete === true || c.id === DEFAULT_COMPANY_ID,
        locale: tenantSettings.locale || 'en-SA',
        currency: tenantSettings.currency || tenantSettings.profile?.currency || 'SAR',
        owner: owner || null,
        features: (() => { try { return c.featureFlags ? JSON.parse(c.featureFlags) : {}; } catch { return {}; } })(),
        counts: {
          users: count('SELECT COUNT(*) c FROM user_companies WHERE companyId = ?', c.id),
          customers: count('SELECT COUNT(*) c FROM customers WHERE companyId = ?', c.id),
          quotations: count('SELECT COUNT(*) c FROM quotations WHERE companyId = ?', c.id),
          invoices: count('SELECT COUNT(*) c FROM invoices WHERE companyId = ?', c.id),
        },
      };
    });
    res.json({ companies: out });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create a tenant company; optionally attach an existing user (by email) as owner.
app.post('/api/admin/companies', requireAuth, requireSuperAdmin, (req, res) => {
  try {
    const { name, slug: requestedSlug, ownerEmail, activePlan, currency, locale, timezone, vatNumber, phone, city, country, features } = req.body;
    const cleanName = String(name || '').trim();
    if (!cleanName) return res.status(400).json({ error: 'Company name is required.' });
    if (cleanName.length > 120) return res.status(400).json({ error: 'Company name must be 120 characters or fewer.' });
    const plan = String(activePlan || 'enterprise');
    if (!PLANS[plan]) return res.status(400).json({ error: 'Invalid subscription plan.' });
    const cleanOwnerEmail = String(ownerEmail || '').trim().toLowerCase();
    if (cleanOwnerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanOwnerEmail)) {
      return res.status(400).json({ error: 'Enter a valid owner email.' });
    }
    const owner = cleanOwnerEmail
      ? db.prepare('SELECT id FROM users WHERE lower(email) = ?').get(cleanOwnerEmail) as { id: string } | undefined
      : undefined;
    if (cleanOwnerEmail && !owner) return res.status(400).json({ error: 'Owner email must belong to an existing user.' });
    const cleanVat = String(vatNumber || '').replace(/\s/g, '');
    if (cleanVat && !/^\d{15}$/.test(cleanVat)) return res.status(400).json({ error: 'Saudi VAT number must contain 15 digits.' });
    const allowedCurrencies = new Set(['SAR', 'AED', 'USD', 'EUR', 'GBP']);
    const selectedCurrency = allowedCurrencies.has(String(currency)) ? String(currency) : 'SAR';
    const selectedLocale = ['en-SA', 'ar-SA', 'en', 'ar'].includes(String(locale)) ? String(locale) : 'en-SA';
    const selectedTimezone = String(timezone || 'Asia/Riyadh').slice(0, 80);
    const flags = featuresFromPlan(plan);
    if (features && typeof features === 'object' && !Array.isArray(features)) {
      for (const feature of FEATURE_CATALOG) {
        if (!feature.core && typeof features[feature.key] === 'boolean') flags[feature.key] = features[feature.key];
        if (feature.core) flags[feature.key] = true;
      }
    }
    const id = `comp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const tenantSlug = uniqueSlug(requestedSlug || cleanName);
    const settings = {
      onboardingComplete: true,
      locale: selectedLocale,
      currency: selectedCurrency,
      timezone: selectedTimezone,
      profile: {
        name: cleanName,
        vatNumber: cleanVat || '',
        phone: String(phone || '').trim(),
        address: { city: String(city || '').trim(), country: String(country || 'SA').trim() || 'SA' },
        currency: selectedCurrency,
      }
    };
    const createTenant = db.transaction(() => {
      db.prepare("INSERT INTO companies (id, name, slug, activePlan, featureFlags, settings, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, 'active', ?)").run(
        id, cleanName, tenantSlug, plan, JSON.stringify(flags), JSON.stringify(settings), new Date().toISOString()
      );
      if (owner) {
        db.prepare('INSERT OR REPLACE INTO user_companies (userId, companyId, role) VALUES (?, ?, ?)').run(owner.id, id, 'owner');
      }
    });
    createTenant();
    res.status(201).json({ id, slug: tenantSlug, ownerAssigned: owner?.id || null, activePlan: plan, settings });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update a company's status / plan / name (suspend, activate, re-plan, rename).
app.patch('/api/admin/companies/:id', requireAuth, requireSuperAdmin, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id) as any;
    if (!existing) return res.status(404).json({ error: 'Company not found.' });
    const { status, activePlan, name, features } = req.body;
    if (status && !['active', 'suspended'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
    if (activePlan && !PLANS[activePlan]) return res.status(400).json({ error: 'Invalid subscription plan.' });
    const nextPlan = activePlan ?? existing.activePlan;
    
    // Use manual features if provided, otherwise default to plan features if plan changed, else keep existing
    let nextFlags = existing.featureFlags;
    if (features) {
      nextFlags = JSON.stringify(features);
    } else if (activePlan && activePlan !== existing.activePlan) {
      nextFlags = JSON.stringify(featuresFromPlan(nextPlan));
    }

    db.prepare('UPDATE companies SET status = ?, activePlan = ?, featureFlags = ?, name = ? WHERE id = ?').run(
      status ?? existing.status ?? 'active',
      nextPlan,
      nextFlags,
      name ?? existing.name,
      req.params.id
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a tenant company and all of its scoped data (cannot delete the default).
app.delete('/api/admin/companies/:id', requireAuth, requireSuperAdmin, (req, res) => {
  try {
    if (req.params.id === DEFAULT_COMPANY_ID) {
      return res.status(400).json({ error: 'The default company cannot be deleted.' });
    }
    const existing = db.prepare('SELECT id FROM companies WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Company not found.' });
    const tx = db.transaction((cid: string) => {
      for (const t of SCOPED_TABLES) db.prepare(`DELETE FROM ${t} WHERE companyId = ?`).run(cid);
      db.prepare('DELETE FROM user_companies WHERE companyId = ?').run(cid);
      db.prepare('DELETE FROM companies WHERE id = ?').run(cid);
    });
    tx(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Broadcast a notification to everyone, a whole company, or a single user.
app.post('/api/admin/notifications', requireAuth, requireSuperAdmin, (req, res) => {
  try {
    const { target, targetId, title, body, link } = req.body;
    if (!title || !String(title).trim()) return res.status(400).json({ error: 'Title is required.' });
    if (!['all', 'company', 'user'].includes(target)) return res.status(400).json({ error: 'Invalid target.' });

    let recipients = 0;
    if (target === 'all') {
      createNotification(null, 'system', title, body, link); // userId NULL = broadcast to all
      recipients = -1; // "everyone"
    } else if (target === 'user') {
      if (!targetId) return res.status(400).json({ error: 'targetId (user) is required.' });
      createNotification(targetId, 'system', title, body, link);
      recipients = 1;
    } else {
      if (!targetId) return res.status(400).json({ error: 'targetId (company) is required.' });
      const members = db.prepare('SELECT userId FROM user_companies WHERE companyId = ?').all(targetId) as { userId: string }[];
      for (const m of members) createNotification(m.userId, 'system', title, body, link);
      recipients = members.length;
    }
    res.json({ success: true, recipients });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Users list for the super-admin notification composer (id/name/email only).
app.get('/api/admin/users', requireAuth, requireSuperAdmin, (req, res) => {
  try {
    const rows = db.prepare('SELECT id, name, email, role, isSuperAdmin FROM users ORDER BY name ASC').all() as any[];
    const users = rows.map((u) => ({
      ...u,
      isSuperAdmin: u.isSuperAdmin === 1,
      companyCount: (db.prepare('SELECT COUNT(*) c FROM user_companies WHERE userId = ?').get(u.id) as any).c
    }));
    res.json({ users });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Promote / demote a user's platform super-admin flag (cannot demote the last one).
app.patch('/api/admin/users/:id', requireAuth, requireSuperAdmin, (req, res) => {
  try {
    const { isSuperAdmin } = req.body;
    const target = db.prepare('SELECT id, isSuperAdmin FROM users WHERE id = ?').get(req.params.id) as any;
    if (!target) return res.status(404).json({ error: 'User not found.' });
    if (isSuperAdmin === false || isSuperAdmin === 0) {
      const supers = (db.prepare('SELECT COUNT(*) c FROM users WHERE isSuperAdmin = 1').get() as any).c;
      if (target.isSuperAdmin === 1 && supers <= 1) {
        return res.status(400).json({ error: 'Cannot remove the last platform super-admin.' });
      }
    }
    db.prepare('UPDATE users SET isSuperAdmin = ? WHERE id = ?').run(isSuperAdmin ? 1 : 0, req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Platform-wide aggregate stats for the super-admin overview.
app.get('/api/admin/overview', requireAuth, requireSuperAdmin, (req, res) => {
  try {
    const one = (sql: string) => (db.prepare(sql).get() as any).c as number;
    const revenueRow = db.prepare('SELECT COALESCE(SUM(amountPaid),0) s FROM invoices').get() as any;
    res.json({
      tenants: one('SELECT COUNT(*) c FROM companies'),
      activeTenants: one("SELECT COUNT(*) c FROM companies WHERE status = 'active' OR status IS NULL"),
      suspendedTenants: one("SELECT COUNT(*) c FROM companies WHERE status = 'suspended'"),
      users: one('SELECT COUNT(*) c FROM users'),
      superAdmins: one('SELECT COUNT(*) c FROM users WHERE isSuperAdmin = 1'),
      quotations: one('SELECT COUNT(*) c FROM quotations'),
      invoices: one('SELECT COUNT(*) c FROM invoices'),
      customers: one('SELECT COUNT(*) c FROM customers'),
      collectedRevenue: Math.round((revenueRow.s || 0) * 100) / 100,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});


// ── SERVER-SIDE PDF GENERATION ────────────────────────────────────────────────
// This is the ONLY reliable way to serve PDFs with proper filenames.
// Client-side blob/data URLs cannot reliably set filenames in Chrome/Edge.

async function buildPdfBuffer(docData: any, companyId: string, type: 'quotation' | 'invoice' | 'boq' | 'bom') {
  const isInvoice = type === 'invoice';
  const isProjectDoc = type === 'boq' || type === 'bom';
  const custRow = db.prepare('SELECT * FROM customers WHERE id = ? AND companyId = ?').get(docData.customerId, companyId) as any;
  const cust = custRow ? {
    company: custRow.companyName || '',
    contactName: custRow.contactPerson || null,
    email: custRow.email || null,
    phone: custRow.phone || null,
    address: (() => { try { const a = JSON.parse(custRow.billingAddress); return [a.street, a.district].filter(Boolean).join(', '); } catch { return null; } })(),
    city: (() => { try { const a = JSON.parse(custRow.billingAddress); return a.city || null; } catch { return null; } })(),
    country: (() => { try { const a = JSON.parse(custRow.billingAddress); return a.country || null; } catch { return null; } })(),
  } : { company: 'Unknown' };

  const companyRecord = db.prepare('SELECT name, settings FROM companies WHERE id = ?').get(companyId) as { name: string; settings?: string | null } | undefined;
  let tenantSettings: any = {};
  try { tenantSettings = companyRecord?.settings ? JSON.parse(companyRecord.settings) : {}; } catch { tenantSettings = {}; }
  const settingsRow = db.prepare("SELECT value FROM settings WHERE key = 'company'").get() as any;
  const legacyComp = settingsRow ? JSON.parse(settingsRow.value) : {};
  const comp = { ...legacyComp, ...(tenantSettings.profile || {}), name: companyRecord?.name || tenantSettings.profile?.name || legacyComp.name };
  const pdfSettings = db.prepare("SELECT value FROM settings WHERE key = 'pdfSettings'").get() as any;
  const legacyPdfConf = pdfSettings ? JSON.parse(pdfSettings.value) : {};
  const pdfConf = { ...legacyPdfConf, ...(tenantSettings.pdfSettings || {}) };

  // Read logo and footerImage from individual settings keys (base64 data URLs)
  const logoRow = db.prepare("SELECT value FROM settings WHERE key = 'logo'").get() as { value: string } | undefined;
  const footerRow = db.prepare("SELECT value FROM settings WHERE key = 'footerImage'").get() as { value: string } | undefined;

  const settings = {
    companyName: comp.name || 'Company',
    email: comp.email || null,
    phone: comp.phone || null,
    address: (() => { try { const a = comp.address; return a ? [a.street, a.district, a.city].filter(Boolean).join(', ') : null; } catch { return null; } })(),
    logoUrl: tenantSettings.logo || logoRow?.value || comp.logo || null,
    footerImageUrl: tenantSettings.footerImage || footerRow?.value || null,
    brandColor: comp.brandColor || '#01696f',
    taxLabel: 'VAT 15%',
    vatNumber: comp.vatNumber || null,
    pdfHeaderBgType: comp.pdfHeaderBgType || 'solid',
    pdfHeaderBgColorStart: comp.pdfHeaderBgColorStart || comp.brandColor || '#01696f',
    pdfHeaderBgColorEnd: comp.pdfHeaderBgColorEnd || comp.brandColor || '#01696f',
    pdfHeaderTextColor: comp.pdfHeaderTextColor || '#ffffff',
    pdfTableBgColor: comp.pdfTableBgColor || comp.brandColor || '#01696f',
    pdfTableTextColor: comp.pdfTableTextColor || '#ffffff',
    ...pdfConf,
  };

  let lineItems: any[];
  if (isProjectDoc) {
    // Flatten BOQ/BOM sections into the same flat lineItems shape the PDF template expects
    const sections = typeof docData.sections === 'string' ? JSON.parse(docData.sections) : (docData.sections || []);
    lineItems = sections.flatMap((s: any) => [
      { type: 'section', description: s.title || '' },
      ...(s.items || []).map((i: any) => ({
        type: 'item',
        description: i.description || '',
        quantity: i.quantity,
        unit: i.unit,
        unitPrice: i.unitPrice,
        discountPercent: 0,
      })),
    ]);
  } else {
    lineItems = typeof docData.lineItems === 'string' ? JSON.parse(docData.lineItems) : (docData.lineItems || []);
  }
  const lines = lineItems
    .filter((i: any) => i.type !== 'note')
    .map((i: any) => {
      const parts = (i.description || '').includes(' / ')
        ? (i.description || '').split(' / ')
        : [i.description || '', ''];
      return {
        type: i.type || 'item',
        description: parts[0],
        descriptionAr: parts.slice(1).join(' / ') || null,
        quantity: i.quantity,
        unit: i.unit,
        unitPrice: i.unitPrice,
        discount: i.discountPercent || 0,
      };
    });

  let zatcaQrCodeImage: string | undefined;
  if (isInvoice && settings.vatNumber && docData.printMode === 'zatca') {
    const base64TLV = generateZatcaQRBase64(
      settings.companyName,
      settings.vatNumber,
      docData.createdAt || docData.date || new Date().toISOString(),
      docData.total,
      docData.taxTotal
    );
    try {
      zatcaQrCodeImage = await QRCode.toDataURL(base64TLV, { errorCorrectionLevel: 'M', margin: 1 });
    } catch (e) {
      console.error('Failed to generate ZATCA QR code for PDF', e);
    }
  }

  const quote = {
    number: docData.number,
    createdAt: docData.date || docData.createdAt,
    validUntil: isInvoice ? (docData.dueDate || null) : (docData.validUntil || null),
    currency: docData.currency || 'SAR',
    subject: docData.subject || (isProjectDoc ? docData.title : null) || null,
    subjectAr: docData.subjectAr || (isProjectDoc ? docData.titleAr : null) || null,
    notes: docData.notes || docData.terms || null,
    notesAr: docData.notesAr || null,
    payment: isInvoice ? (docData.paymentTerms || null) : (docData.payment || null),
    paymentAr: docData.paymentAr || null,
    warranty: docData.warranty || null,
    warrantyAr: docData.warrantyAr || null,
    manpower: docData.manpower || null,
    manpowerAr: docData.manpowerAr || null,
    mobilization: docData.mobilization || null,
    mobilizationAr: docData.mobilizationAr || null,
    duration: docData.duration || null,
    durationAr: docData.durationAr || null,
    bankDetails: docData.bankDetails || null,
    bankDetailsAr: docData.bankDetailsAr || null,
    subtotal: docData.subtotal || 0,
    discountTotal: docData.discountTotal || 0,
    taxTotal: docData.taxTotal || 0,
    total: docData.total || 0,
    customer: cust,
    lines,
    watermarkText: docData.watermarkText || null,
    watermarkType: docData.watermarkType || 'none',
    hidePrices: !!docData.hidePrices,
    manualTotal: docData.manualTotal != null ? Number(docData.manualTotal) : undefined,
    zatcaQrCodeImage,
  };

  const element = React.createElement(QuotePdfDocument, { quote, settings, type });
  return await renderToBuffer(element);
}

app.post('/api/pdf/generate', requireAuth, async (req, res) => {
  try {
    const { documentData, type } = req.body;
    if (!documentData || !type) {
      return res.status(400).json({ error: 'documentData and type are required' });
    }
    const buffer = await buildPdfBuffer(documentData, (req as any).companyId, type);
    const filename = `${documentData.number || 'document'}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  } catch (err: any) {
    console.error('Dynamic PDF generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/pdf/quotation/:id', requireAuth, async (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM quotations WHERE id = ? AND companyId = ?').get(req.params.id, (req as any).companyId) as any;
    if (!row) return res.status(404).json({ error: 'Quotation not found' });
    const buffer = await buildPdfBuffer(row, (req as any).companyId, 'quotation');
    const filename = `${row.number || req.params.id}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  } catch (err: any) {
    console.error('PDF generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/pdf/invoice/:id', requireAuth, async (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM invoices WHERE id = ? AND companyId = ?').get(req.params.id, (req as any).companyId) as any;
    if (!row) return res.status(404).json({ error: 'Invoice not found' });
    const buffer = await buildPdfBuffer(row, (req as any).companyId, 'invoice');
    const filename = `${row.number || req.params.id}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  } catch (err: any) {
    console.error('PDF generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/pdf/boq/:id', requireAuth, async (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM boq WHERE id = ? AND companyId = ?').get(req.params.id, (req as any).companyId) as any;
    if (!row) return res.status(404).json({ error: 'Document not found' });
    const docType = row.type === 'bom' ? 'bom' : 'boq';
    const buffer = await buildPdfBuffer(row, (req as any).companyId, docType);
    const filename = `${row.number || req.params.id}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  } catch (err: any) {
    console.error('PDF generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

const memoryUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// ── AI RFQ PARSER ENDPOINT (MULTIMODAL EXTRACTION) ─────────────────────────
app.post('/api/rfq/parse', requireAuth, memoryUpload.single('file'), async (req, res) => {
  const aiKey = process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
  if (!aiKey || aiKey === 'dummy_key_to_prevent_startup_crash') {
    return res.status(400).json({ error: 'Please set OPENROUTER_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY in your .env file to use AI features.' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const base64Data = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype || 'image/jpeg';
    const isRouter = !!process.env.OPENROUTER_API_KEY;
    const isGemini = !isRouter && !!process.env.GEMINI_API_KEY;

    const aiClient = new OpenAI({
      baseURL: isRouter ? 'https://openrouter.ai/api/v1' : isGemini ? 'https://generativelanguage.googleapis.com/v1beta/openai/' : undefined,
      apiKey: aiKey
    });

    const messages = [
      {
        role: "user",
        // @ts-ignore
        content: [
          {
            type: "text",
            text: "You are a professional estimator. Extract line items from this Request for Quotation (RFQ) document. " +
              "Return a JSON array ONLY, where each object has: " +
              "1. 'description' (string, the name or details of the product/service), " +
              "2. 'quantity' (number, the requested quantity, default to 1), " +
              "3. 'unit' (string, the unit of measure like 'pcs', 'ls', 'meters'). " +
              "Do not include any other markdown formatting or conversational text, just the raw JSON array."
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64Data}`
            }
          }
        ]
      }
    ];

    const response = await aiClient.chat.completions.create({
      model: isRouter ? "openai/gpt-4o-mini" : isGemini ? "gemini-2.0-flash" : "gpt-4o-mini",
      // @ts-ignore
      messages: messages,
      temperature: 0.1,
    });

    const aiRes = response.choices[0]?.message?.content || '[]';
    let cleaned = aiRes.trim();
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    if (cleaned.toLowerCase().startsWith('```json')) cleaned = cleaned.substring(7);
    if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```/, '');
    if (cleaned.endsWith('```')) cleaned = cleaned.replace(/```$/, '');
    cleaned = cleaned.trim();

    const rawItems = JSON.parse(cleaned);
    const items = Array.isArray(rawItems) ? rawItems.map((it: any) => ({
      description: it.description || it.item || 'Item',
      quantity: Number(it.quantity || it.qty) || 1,
      unit: it.unit || 'pcs',
      unitPrice: Number(it.unitPrice || it.price) || 0
    })) : [];

    res.json({ items });
  } catch (err: any) {
    console.error('RFQ Parse Error:', err);
    res.status(500).json({ error: 'Failed to process RFQ document: ' + (err.message || 'Unknown error') });
  }
});

// SECURITY: model-written SQL must be a single read-only SELECT over business tables only
// (never users/sessions/logs/settings), and every table reference must be pinned to the caller's companyId.
const AI_SQL_TABLES = new Set(['customers', 'products', 'quotations', 'invoices', 'suppliers', 'expenses', 'recurring_invoices', 'inventory_transactions', 'boq']);
function isSafeAiSql(rawSql: string, companyId: string): boolean {
  const sql = rawSql.trim().replace(/;\s*$/, '');
  if (!/^select\b/i.test(sql)) return false;
  if (/;|--|\/\*|\b(or|union|pragma|attach|load_extension|insert|update|delete|drop|alter|create|replace|vacuum)\b/i.test(sql)) return false;
  const refs = [...sql.matchAll(/\b(?:from|join)\s+["`\[]?([a-zA-Z_][a-zA-Z0-9_]*)/gi)].map((m) => m[1].toLowerCase());
  if (refs.length === 0 || refs.some((t) => !AI_SQL_TABLES.has(t))) return false;
  const escaped = companyId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pins = sql.match(new RegExp(`companyId\\s*=\\s*'${escaped}'`, 'gi')) || [];
  return pins.length >= refs.length;
}

// ── AI ASSISTANT ENDPOINT ──────────────────────────────────────────────────
app.post('/api/ai/chat', requireAuth, requireFeature('aiAssistant'), requirePermission('canUseAI'), async (req, res) => {
  try {
    const message = (req.body.message || req.body.question || '').trim();
    if (!message) return res.status(400).json({ error: 'Message required' });

    const companyId = (req as any).companyId;
    const apiKey = process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;

    if (apiKey) {
      const isRouter = !!process.env.OPENROUTER_API_KEY;
      const isGemini = !isRouter && !!process.env.GEMINI_API_KEY;
      const openai = new OpenAI({
        baseURL: isRouter ? 'https://openrouter.ai/api/v1' : isGemini ? 'https://generativelanguage.googleapis.com/v1beta/openai/' : undefined,
        apiKey
      });

      const tables = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
      const schemaStr = tables.map((t: any) => t.sql).join('\n\n');

      const completion = await openai.chat.completions.create({
        model: isRouter ? 'openai/gpt-4o-mini' : isGemini ? 'gemini-2.0-flash' : 'gpt-4o-mini', 
        messages: [
          { 
            role: 'system', 
            content: `You are an AI assistant for the Qvoke ERP system. Given the SQLite schema below, your task is to output ONLY a valid read-only SQL SELECT query to answer the user's question. Scope queries to companyId = '${companyId}' where applicable.
DO NOT include markdown formatting (\`\`\`sql). Return ONLY the raw SQL query.
If the question cannot be safely answered with a SELECT query (e.g. asking to UPDATE/DELETE, or unrelated to the database), output EXACTLY the word: ERROR.
Schema:\n\n${schemaStr}` 
          },
          { role: 'user', content: message }
        ],
        temperature: 0.1
      });

      let sql = (completion.choices[0].message?.content || '').trim();
      if (sql !== 'ERROR') {
        if (sql.startsWith('```sql')) sql = sql.substring(6);
        if (sql.startsWith('```')) sql = sql.substring(3);
        if (sql.endsWith('```')) sql = sql.substring(0, sql.length - 3);
        sql = sql.trim();

        if (isSafeAiSql(sql, String(companyId))) {
          const stmt = db.prepare(sql);
          if (!stmt.reader) throw new Error('Not a read-only query');
          const results = (stmt.all() as any[]).slice(0, 200);
          const explainCompletion = await openai.chat.completions.create({
            model: isRouter ? 'openai/gpt-4o-mini' : isGemini ? 'gemini-2.0-flash' : 'gpt-4o-mini',
            messages: [
              { 
                role: 'system', 
                content: `You are a helpful ERP assistant. Summarize the following SQL query results in a brief, friendly, human-readable sentence or short paragraph. Do not mention SQL or databases. 
Data: ${JSON.stringify(results).substring(0, 1000)}` 
              },
              { role: 'user', content: message }
            ],
            temperature: 0.3
          });

          const explanation = explainCompletion.choices[0].message?.content || '';
          return res.json({
            sql,
            query: sql,
            results,
            data: results,
            explanation,
            answer: explanation
          });
        }
      }
    }

    // Smart Local Fallback when API key is missing or model returns ERROR
    const q = message.toLowerCase();
    let localSql = '';
    let explanation = '';

    if (q.includes('revenue') || q.includes('total sales') || q.includes('income')) {
      localSql = "SELECT COALESCE(SUM(total), 0) as total_revenue, COALESCE(SUM(amountPaid), 0) as collected_amount, COUNT(*) as invoice_count FROM invoices WHERE companyId = ?";
      const row = db.prepare(localSql).get(companyId) as any;
      explanation = `Your total invoiced revenue is SAR ${Number(row?.total_revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} across ${row?.invoice_count || 0} invoices (Collected: SAR ${Number(row?.collected_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}).`;
      return res.json({ sql: localSql, query: localSql, results: [row], data: [row], explanation, answer: explanation });
    }

    if (q.includes('unpaid') || q.includes('due') || q.includes('overdue') || q.includes('pending payment')) {
      localSql = "SELECT number, total, amountDue, date, dueDate, status FROM invoices WHERE companyId = ? AND status IN ('draft', 'posted', 'partial', 'overdue') ORDER BY dueDate ASC LIMIT 10";
      const rows = db.prepare(localSql).all(companyId);
      const totalDue = rows.reduce((acc: number, r: any) => acc + (r.amountDue || 0), 0);
      explanation = `You have ${rows.length} pending/unpaid invoices totaling SAR ${totalDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}.`;
      return res.json({ sql: localSql, query: localSql, results: rows, data: rows, explanation, answer: explanation });
    }

    if (q.includes('customer') || q.includes('top customer') || q.includes('clients')) {
      localSql = "SELECT c.companyName, c.email, c.phone, COALESCE(SUM(i.total), 0) as total_spent FROM customers c LEFT JOIN invoices i ON c.id = i.customerId WHERE c.companyId = ? GROUP BY c.id ORDER BY total_spent DESC LIMIT 5";
      const rows = db.prepare(localSql).all(companyId);
      explanation = `Here are your top customers ranked by invoiced total: ${rows.map((r: any) => `${r.companyName} (SAR ${Number(r.total_spent || 0).toLocaleString()})`).join(', ')}.`;
      return res.json({ sql: localSql, query: localSql, results: rows, data: rows, explanation, answer: explanation });
    }

    if (q.includes('quote') || q.includes('quotation')) {
      localSql = "SELECT number, status, total, date FROM quotations WHERE companyId = ? AND (deleted_at IS NULL OR deleted_at = '') ORDER BY date DESC LIMIT 5";
      const rows = db.prepare(localSql).all(companyId);
      explanation = `Found ${rows.length} recent quotations in your active company.`;
      return res.json({ sql: localSql, query: localSql, results: rows, data: rows, explanation, answer: explanation });
    }

    if (q.includes('product') || q.includes('catalog') || q.includes('items')) {
      localSql = "SELECT name, unitPrice, unit, taxRate FROM products WHERE companyId = ? LIMIT 10";
      const rows = db.prepare(localSql).all(companyId);
      explanation = `You have ${rows.length} products listed in your catalog.`;
      return res.json({ sql: localSql, query: localSql, results: rows, data: rows, explanation, answer: explanation });
    }

    // Default overview response
    localSql = "SELECT (SELECT COUNT(*) FROM quotations WHERE companyId = ?) as quotes_count, (SELECT COUNT(*) FROM invoices WHERE companyId = ?) as invoices_count, (SELECT COUNT(*) FROM customers WHERE companyId = ?) as customers_count, (SELECT COUNT(*) FROM products WHERE companyId = ?) as products_count";
    const overview = db.prepare(localSql).get(companyId, companyId, companyId, companyId) as any;
    explanation = `Qvoke Overview: ${overview?.quotes_count || 0} Quotations, ${overview?.invoices_count || 0} Invoices, ${overview?.customers_count || 0} Customers, and ${overview?.products_count || 0} Products in your catalog.`;
    return res.json({ sql: localSql, query: localSql, results: [overview], data: [overview], explanation, answer: explanation });
  } catch (error: any) {
    console.error('AI Chat error:', error);
    res.status(500).json({ error: 'AI processing failed' });
  }
});

// Global error logging middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const user = (req as any).user;
  logSystemEvent(
    'error',
    `Express route error: ${err.message || 'Unknown Error'}`,
    {
      stack: err.stack,
      url: req.url,
      method: req.method,
      body: req.body,
    },
    user?.id,
    user?.username
  );
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// ── SERVER STARTUP & VITE INTEGRATION ─────────────────────────────────────────
async function startServer() {
  const httpServer = http.createServer(app);
  const adminHttpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    console.log('⚡ Starting Vite development middleware...');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { server: httpServer }
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  }

  // Handle Primary Server port conflicts gracefully
  httpServer.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ [PORT CONFLICT] Primary port ${PORT} is already in use by another process.`);
      console.error(`👉 Solution: Set PORT in your .env file (e.g., PORT=3005) or terminate the process on port ${PORT}.\n`);
    } else {
      console.error('❌ Primary Server error:', err);
    }
    process.exit(1);
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 ${process.env.VITE_APP_NAME || 'Qvoke'} Backend operational on http://localhost:${PORT}`);
    console.log(`   Database: ${DB_PATH} | Env: ${process.env.NODE_ENV || 'development'}`);
  });

  // Only start separate Admin server if distinct port is configured
  if (ADMIN_PORT && ADMIN_PORT !== PORT) {
    adminHttpServer.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`\n⚠️  [ADMIN PORT CONFLICT] Admin port ${ADMIN_PORT} is already in use.`);
        console.warn(`👉 Solution: Change ADMIN_PORT in .env (e.g., ADMIN_PORT=3002) or terminate the process holding port ${ADMIN_PORT}.\n`);
      } else {
        console.error('❌ Admin Server error:', err);
      }
    });

    adminHttpServer.listen(ADMIN_PORT, '0.0.0.0', () => {
      console.log(`🛡️ Admin Panel Backend operational on http://localhost:${ADMIN_PORT}`);
    });
  }
}

startServer().catch((err) => {
  console.error('❌ Server startup failure:', err);
});
