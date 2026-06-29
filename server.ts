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

const app = express();
app.set('trust proxy', 1);

// ── ENVIRONMENT CONFIGURATION ─────────────────────────────────────────────────
const PORT = Number(process.env.PORT) || 3000;
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
    categoryId TEXT
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

// Seed default numbering sequences
const seedSequences = () => {
  const defaults: { docType: string; prefix: string }[] = [
    { docType: 'quotation', prefix: 'QT' },
    { docType: 'invoice', prefix: 'INV' },
    { docType: 'boq', prefix: 'BOQ' },
    { docType: 'bom', prefix: 'BOM' },
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

// Atomically reserve and format the next number for a document type
function getNextDocumentNumber(docType: string): string {
  const seq = db.prepare('SELECT * FROM sequences WHERE docType = ?').get(docType) as
    | { docType: string; prefix: string; lastNumber: number; padding: number; resetPeriod: string; lastYear: number | null }
    | undefined;
  if (!seq) {
    throw new Error(`Unknown document type for numbering: ${docType}`);
  }
  const currentYear = new Date().getFullYear();
  const shouldReset = seq.resetPeriod === 'yearly' && seq.lastYear !== currentYear;
  const nextNumber = shouldReset ? 1 : seq.lastNumber + 1;

  db.prepare(`
    UPDATE sequences SET lastNumber = ?, lastYear = ? WHERE docType = ?
  `).run(nextNumber, currentYear, docType);

  const padded = String(nextNumber).padStart(seq.padding, '0');
  return seq.resetPeriod === 'yearly'
    ? `${seq.prefix}-${currentYear}-${padded}`
    : `${seq.prefix}-${padded}`;
}

// ── DOCUMENT ACTIVITY / AUDIT TRAIL ───────────────────────────────────────────
interface DocChange { field: string; from: string; to: string; }

function logDocumentActivity(
  docType: string,
  docId: string,
  docNumber: string | null,
  action: string,
  actor: { id?: string; name?: string } | undefined,
  changes?: DocChange[]
) {
  try {
    db.prepare(`
      INSERT INTO document_activity (docType, docId, docNumber, action, changes, actorId, actorName, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      docType,
      docId,
      docNumber || null,
      action,
      changes && changes.length ? JSON.stringify(changes) : null,
      actor?.id || null,
      actor?.name || null,
      new Date().toISOString()
    );
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
] as const;

type FeatureKey = typeof FEATURE_CATALOG[number]['key'];

// Subscription plans bundle a set of enabled features.
const PLANS: Record<string, { label: string; features: FeatureKey[] }> = {
  starter: {
    label: 'Starter',
    features: ['quotations', 'invoices', 'customers', 'products', 'notifications', 'tasks'],
  },
  professional: {
    label: 'Professional',
    features: ['quotations', 'invoices', 'boq', 'bom', 'reports', 'customers', 'suppliers', 'products', 'tracking', 'notifications', 'usage', 'tasks'],
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

const getActiveFeatures = (): Record<string, boolean> => {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'featureFlags'").get() as { value: string } | undefined;
  if (row) { try { return JSON.parse(row.value); } catch { /* fall through */ } }
  return featuresFromPlan('enterprise');
};

// Middleware factory: block API access to a disabled feature.
const requireFeature = (feature: FeatureKey) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const features = getActiveFeatures();
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
      canViewCreatedBy: true
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

  const user = db.prepare('SELECT id, username, name, email, role, permissions, avatar FROM users WHERE id = ?').get(session.user_id) as any;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    user.permissions = JSON.parse(user.permissions || '{}');
  } catch {
    user.permissions = {};
  }

  (req as any).user = user;
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
    if (Number(manualTotal) !== Number(existingManualTotal)) {
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
        avatar: user.avatar
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
  res.json((req as any).user);
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
  const customers = db.prepare('SELECT * FROM customers ORDER BY createdAt DESC').all() as any[];
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
      INSERT INTO customers (id, companyName, contactPerson, email, phone, vatNumber, billingAddress, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      custId,
      companyName,
      contactPerson || '',
      email,
      phone,
      vatNumber || '',
      JSON.stringify(billingAddress || {}),
      new Date().toISOString()
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
      WHERE id = ?
    `).run(
      companyName,
      contactPerson || '',
      email,
      phone,
      vatNumber || '',
      JSON.stringify(billingAddress || {}),
      req.params.id
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/customers/:id', requireAuth, requirePermission('canDeleteData'), (req, res) => {
  db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── SUPPLIERS CRUD ────────────────────────────────────────────────────────────
app.get('/api/suppliers', requireAuth, (req, res) => {
  try {
    const suppliers = db.prepare('SELECT * FROM suppliers ORDER BY name ASC').all();
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
    db.prepare('INSERT INTO suppliers (id, name) VALUES (?, ?)').run(supplierId, name.trim());
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
    db.prepare('UPDATE suppliers SET name = ? WHERE id = ?').run(name.trim(), req.params.id);
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
    db.prepare('DELETE FROM suppliers WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── PRODUCTS CRUD ─────────────────────────────────────────────────────────────
app.get('/api/products', requireAuth, (req, res) => {
  const products = db.prepare('SELECT * FROM products ORDER BY name ASC').all();
  res.json(products);
});

app.post('/api/products', requireAuth, (req, res) => {
  const { id, name, description, type, unitPrice, unit, taxRate, categoryId } = req.body;
  try {
    const prodId = id || `p-${Date.now()}`;
    db.prepare(`
      INSERT INTO products (id, name, description, type, unitPrice, unit, taxRate, categoryId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      prodId,
      name,
      description || '',
      type,
      unitPrice,
      unit,
      taxRate,
      categoryId || ''
    );
    res.json({ id: prodId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/products/:id', requireAuth, (req, res) => {
  const { name, description, type, unitPrice, unit, taxRate, categoryId } = req.body;
  try {
    db.prepare(`
      UPDATE products
      SET name = ?, description = ?, type = ?, unitPrice = ?, unit = ?, taxRate = ?, categoryId = ?
      WHERE id = ?
    `).run(
      name,
      description || '',
      type,
      unitPrice,
      unit,
      taxRate,
      categoryId || '',
      req.params.id
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/products/:id', requireAuth, requirePermission('canDeleteData'), (req, res) => {
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
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
  const quotes = db.prepare('SELECT * FROM quotations ORDER BY date DESC').all() as any[];
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
    const qId = id || `qt-${Date.now()}`;
    const number = getNextDocumentNumber('quotation');
    db.prepare(`
      INSERT INTO quotations (id, number, customerId, date, validUntil, status, lineItems, notes, terms, subject, subjectAr, currency, subtotal, discountTotal, taxTotal, total, createdAt, updatedAt, salespersonId, watermarkText, watermarkType, hidePrices, manualTotal, createdBy, createdByName, updatedBy, updatedByName)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      user.id, user.name, user.id, user.name
    );
    logDocumentActivity('quotation', qId, number, 'created', user);
    res.json({ id: qId, number });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/quotes/:id', requireAuth, (req, res) => {
  const user = (req as any).user;
  const canOverride = user.role === 'admin' || (user.permissions && user.permissions.canOverridePrice === true);
  if (!canOverride) {
    const existing = db.prepare('SELECT manualTotal, lineItems FROM quotations WHERE id = ?').get(req.params.id);
    if (!verifyPriceOverrides(req.body, existing)) {
      return res.status(403).json({ error: 'Forbidden: price overrides are not permitted for your user role.' });
    }
  }

  const {
    number, customerId, date, validUntil, status, lineItems, notes, terms, subject, subjectAr, currency,
    subtotal, discountTotal, taxTotal, total, linkedInvoiceId, salespersonId, watermarkText, watermarkType, hidePrices, manualTotal
  } = req.body;
  try {
    const before = db.prepare('SELECT * FROM quotations WHERE id = ?').get(req.params.id) as any;
    db.prepare(`
      UPDATE quotations
      SET number = ?, customerId = ?, date = ?, validUntil = ?, status = ?, lineItems = ?, notes = ?, terms = ?, subject = ?, subjectAr = ?, currency = ?, subtotal = ?, discountTotal = ?, taxTotal = ?, total = ?, linkedInvoiceId = ?, updatedAt = ?, salespersonId = ?, watermarkText = ?, watermarkType = ?, hidePrices = ?, manualTotal = ?, updatedBy = ?, updatedByName = ?
      WHERE id = ?
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
      req.params.id
    );
    if (before) {
      const changes = computeDocumentDiff(
        before,
        { subject, status, total, discountTotal, notes, lineItems },
        ['subject', 'status', 'total', 'discountTotal', 'notes']
      );
      const statusChanged = before.status !== status;
      logDocumentActivity('quotation', req.params.id, number, statusChanged ? 'status_changed' : 'updated', user, changes);
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/quotes/:id', requireAuth, requirePermission('canDeleteData'), (req, res) => {
  const user = (req as any).user;
  const before = db.prepare('SELECT number FROM quotations WHERE id = ?').get(req.params.id) as any;
  db.prepare('DELETE FROM quotations WHERE id = ?').run(req.params.id);
  logDocumentActivity('quotation', req.params.id, before?.number || null, 'deleted', user);
  res.json({ success: true });
});

// ── INVOICES CRUD ─────────────────────────────────────────────────────────────
app.get('/api/invoices', requireAuth, (req, res) => {
  const invoices = db.prepare('SELECT * FROM invoices ORDER BY date DESC').all() as any[];
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
    const invId = id || `inv-${Date.now()}`;
    const number = getNextDocumentNumber('invoice');
    db.prepare(`
      INSERT INTO invoices (id, number, customerId, date, dueDate, status, paymentTerms, lineItems, notes, terms, subject, subjectAr, currency, subtotal, discountTotal, taxTotal, total, linkedQuoteId, payments, amountPaid, amountDue, createdAt, updatedAt, salespersonId, watermarkText, watermarkType, hidePrices, manualTotal, createdBy, createdByName, updatedBy, updatedByName)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      user.id, user.name, user.id, user.name
    );
    logDocumentActivity('invoice', invId, number, 'created', user);
    res.json({ id: invId, number });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/invoices/:id', requireAuth, (req, res) => {
  const user = (req as any).user;
  const canOverride = user.role === 'admin' || (user.permissions && user.permissions.canOverridePrice === true);
  if (!canOverride) {
    const existing = db.prepare('SELECT manualTotal, lineItems FROM invoices WHERE id = ?').get(req.params.id);
    if (!verifyPriceOverrides(req.body, existing)) {
      return res.status(403).json({ error: 'Forbidden: price overrides are not permitted for your user role.' });
    }
  }

  const {
    number, customerId, date, dueDate, status, paymentTerms, lineItems, notes, terms, subject, subjectAr, currency,
    subtotal, discountTotal, taxTotal, total, linkedQuoteId, payments, amountPaid, amountDue, salespersonId, watermarkText, watermarkType, hidePrices, manualTotal
  } = req.body;
  try {
    const before = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id) as any;
    db.prepare(`
      UPDATE invoices
      SET number = ?, customerId = ?, date = ?, dueDate = ?, status = ?, paymentTerms = ?, lineItems = ?, notes = ?, terms = ?, subject = ?, subjectAr = ?, currency = ?, subtotal = ?, discountTotal = ?, taxTotal = ?, total = ?, linkedQuoteId = ?, payments = ?, amountPaid = ?, amountDue = ?, updatedAt = ?, salespersonId = ?, watermarkText = ?, watermarkType = ?, hidePrices = ?, manualTotal = ?, updatedBy = ?, updatedByName = ?
      WHERE id = ?
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
      req.params.id
    );
    if (before) {
      const changes = computeDocumentDiff(
        before,
        { subject, status, total, amountPaid, notes, lineItems },
        ['subject', 'status', 'total', 'amountPaid', 'notes']
      );
      const statusChanged = before.status !== status;
      logDocumentActivity('invoice', req.params.id, number, statusChanged ? 'status_changed' : 'updated', user, changes);
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/invoices/:id', requireAuth, requirePermission('canDeleteData'), (req, res) => {
  const user = (req as any).user;
  const before = db.prepare('SELECT number FROM invoices WHERE id = ?').get(req.params.id) as any;
  db.prepare('DELETE FROM invoices WHERE id = ?').run(req.params.id);
  logDocumentActivity('invoice', req.params.id, before?.number || null, 'deleted', user);
  res.json({ success: true });
});

// ── SYSTEM CONFIGURATION & SETTINGS API ───────────────────────────────────────
app.get('/api/settings/company', (req, res) => {
  const companyRow = db.prepare("SELECT value FROM settings WHERE key = 'company'").get() as { value: string } | undefined;
  if (companyRow) {
    res.json(JSON.parse(companyRow.value));
  } else {
    res.status(404).json({ error: 'Company settings not found' });
  }
});

// ── PLANS & FEATURE FLAGS API ─────────────────────────────────────────────────
app.get('/api/features', requireAuth, (req, res) => {
  const planRow = db.prepare("SELECT value FROM settings WHERE key = 'activePlan'").get() as { value: string } | undefined;
  res.json({
    activePlan: planRow?.value || 'enterprise',
    features: getActiveFeatures(),
    catalog: FEATURE_CATALOG,
    plans: Object.entries(PLANS).map(([key, p]) => ({ key, label: p.label, features: p.features })),
  });
});

app.put('/api/features', requireAuth, requirePermission('canManageSettings'), (req, res) => {
  try {
    const { activePlan, features } = req.body as { activePlan?: string; features?: Record<string, boolean> };
    if (activePlan && PLANS[activePlan]) {
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('activePlan', ?)").run(activePlan);
      // Switching plan resets flags to that plan's defaults unless explicit features given
      const flags = features || featuresFromPlan(activePlan);
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('featureFlags', ?)").run(JSON.stringify(flags));
    } else if (features) {
      // Manual per-feature override; force core features on
      for (const f of FEATURE_CATALOG) if (f.core) features[f.key] = true;
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('featureFlags', ?)").run(JSON.stringify(features));
    }
    res.json({ success: true, features: getActiveFeatures() });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/settings/company', requireAuth, requirePermission('canManageSettings'), (req, res) => {
  try {
    const stmt = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('company', ?)");
    stmt.run(JSON.stringify(req.body));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Individual Settings Key/Value API (for logo, footerImage, etc.) ───────────
app.get('/api/settings/:key', requireAuth, (req, res) => {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(req.params.key) as { value: string } | undefined;
  res.json({ value: row?.value || null });
});

app.post('/api/settings', requireAuth, requirePermission('canManageSettings'), (req, res) => {
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ error: 'Key is required' });
  try {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
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
    
    const rows = db.prepare(`
      SELECT * FROM system_logs 
      ORDER BY timestamp DESC 
      LIMIT ? OFFSET ?
    `).all(limit, offset) as any[];

    const totalRow = db.prepare(`SELECT COUNT(*) as count FROM system_logs`).get() as { count: number };
    
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
    db.prepare('DELETE FROM system_logs').run();
    logSystemEvent('info', 'System logs cleared', null, (req as any).user?.id, (req as any).user?.username);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── REMOTE APP UPDATE API ──────────────────────────────────────────────────────
app.post('/api/system/update', requireAuth, requirePermission('canManageSettings'), (req, res) => {
  const user = (req as any).user;
  logSystemEvent('info', 'Remote update triggered via GitHub pull', null, user?.id, user?.username);

  exec('git pull', (err, stdout, stderr) => {
    if (err) {
      logSystemEvent('error', 'Remote update failed during git pull', { error: err.message, stderr }, user?.id, user?.username);
      return res.status(500).json({ error: 'Git pull failed', details: err.message, stderr });
    }
    
    logSystemEvent('info', 'Remote update pulled successfully from GitHub', { stdout, stderr }, user?.id, user?.username);
    res.json({ success: true, stdout, stderr });
  });
});

// ── Translation API ───────────────────────────────────────────────────────────
// Proxies to Google Translate with chunking + retry for reliability.
app.post('/api/translate', requireAuth, async (req, res) => {
  const { text } = req.body;
  if (!text) return res.json({ translation: '' });

  // Split on sentence boundaries so each chunk stays under 400 chars
  const splitIntoChunks = (str: string, maxLen = 400): string[] => {
    if (str.length <= maxLen) return [str];
    const chunks: string[] = [];
    // Try to split on '. ', '\n', then fallback to hard split
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

  const translateChunk = async (chunk: string, attempt = 0): Promise<string> => {
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ar&dt=t&q=${encodeURIComponent(chunk)}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const data = await response.json();
      let result = '';
      if (data && data[0]) {
        data[0].forEach((segment: any) => { if (segment[0]) result += segment[0]; });
      }
      // Retry on empty result (up to 3 attempts)
      if (!result.trim() && attempt < 2) {
        await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
        return translateChunk(chunk, attempt + 1);
      }
      return result.trim();
    } catch (err: any) {
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
        return translateChunk(chunk, attempt + 1);
      }
      throw err;
    }
  };

  try {
    const chunks = splitIntoChunks(text);
    const translated = await Promise.all(chunks.map(c => translateChunk(c)));
    res.json({ translation: translated.join(' ').trim() });
  } catch (error: any) {
    console.error('Translation error:', error);
    res.status(500).json({ error: 'Translation failed' });
  }
});

// ── DATABASE MAINTENANCE API ──────────────────────────────────────────────────
import fs from 'fs';
import path from 'path';

app.post('/api/admin/optimize', requireAuth, (req, res) => {
  try {
    db.prepare('VACUUM').run();
    db.prepare('ANALYZE').run();
    res.json({ success: true, message: 'Database optimized and compacted successfully!' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/backups', requireAuth, (req, res) => {
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

app.post('/api/admin/backup', requireAuth, (req, res) => {
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

app.post('/api/admin/restore', requireAuth, (req, res) => {
  const { filename } = req.body;
  if (!filename) {
    return res.status(400).json({ error: 'Filename is required' });
  }
  try {
    const backupPath = path.resolve('backups', filename);
    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ error: 'Backup file not found' });
    }

    // Safe SQLite overwrite and hot process restart
    db.close();
    fs.copyFileSync(backupPath, 'quotes.db');
    res.json({ success: true, message: 'Database restored! System restarting...' });

    setTimeout(() => {
      process.exit(0);
    }, 800);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── DOWNLOAD A BACKUP FILE ────────────────────────────────────────────────────
app.get('/api/admin/backup/download/:filename', requireAuth, (req, res) => {
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
app.delete('/api/admin/backup/:filename', requireAuth, requirePermission('canManageSettings'), (req, res) => {
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

app.post('/api/admin/restore/upload', requireAuth, requirePermission('canManageSettings'), uploadDb.single('dbfile'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const uploadedPath = req.file.path;
    db.close();
    fs.copyFileSync(uploadedPath, 'quotes.db');
    res.json({ success: true, message: 'Database restored from upload! Restarting...' });
    setTimeout(() => process.exit(0), 800);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── EXCEL EXPORT ENDPOINTS ────────────────────────────────────────────────────
// Returns JSON that client turns into .xlsx via SheetJS (no server-side dep needed)
app.get('/api/export/products', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT id, name, description, type, unitPrice, unit, taxRate, categoryId FROM products ORDER BY name ASC').all();
  res.json(rows);
});

app.get('/api/export/customers', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT id, companyName, contactPerson, email, phone, vatNumber, billingAddress, createdAt FROM customers ORDER BY createdAt DESC').all() as any[];
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
  const rows = db.prepare('SELECT id, name FROM suppliers ORDER BY name ASC').all();
  res.json(rows);
});

// Full database Excel export (all tables as separate sheets)
app.get('/api/export/full', requireAuth, (req, res) => {
  try {
    const products = db.prepare('SELECT id, name, description, type, unitPrice, unit, taxRate, categoryId FROM products ORDER BY name ASC').all();
    const rawCustomers = db.prepare('SELECT id, companyName, contactPerson, email, phone, vatNumber, billingAddress, createdAt FROM customers ORDER BY createdAt DESC').all() as any[];
    const customers = rawCustomers.map(r => {
      let addr: any = {};
      try { addr = JSON.parse(r.billingAddress || '{}'); } catch {}
      return { id: r.id, companyName: r.companyName, contactPerson: r.contactPerson, email: r.email, phone: r.phone, vatNumber: r.vatNumber, street: addr.street || '', district: addr.district || '', city: addr.city || '', country: addr.country || 'SA', createdAt: r.createdAt };
    });
    const suppliers = db.prepare('SELECT id, name FROM suppliers ORDER BY name ASC').all();
    const quotations = db.prepare('SELECT id, number, status, date, validUntil, subtotal, discountTotal, taxTotal, total, currency, customerId, subject FROM quotations ORDER BY date DESC').all();
    const invoices = db.prepare('SELECT id, number, status, date, dueDate, subtotal, taxTotal, total, amountPaid, amountDue, currency, customerId FROM invoices ORDER BY date DESC').all();
    res.json({ products, customers, suppliers, quotations, invoices });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── EXCEL IMPORT ENDPOINTS ────────────────────────────────────────────────────
app.post('/api/import/products', requireAuth, requirePermission('canManageSettings'), (req, res) => {
  const { rows } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'No rows provided' });
  let inserted = 0, updated = 0, errors = 0;
  const insertStmt = db.prepare(`INSERT OR IGNORE INTO products (id, name, description, type, unitPrice, unit, taxRate, categoryId) VALUES (?,?,?,?,?,?,?,?)`);
  const updateStmt = db.prepare(`UPDATE products SET name=?, description=?, type=?, unitPrice=?, unit=?, taxRate=?, categoryId=? WHERE id=?`);
  const txn = db.transaction(() => {
    for (const r of rows) {
      try {
        const id = (r.id || `p-${Date.now()}-${Math.random().toString(36).slice(2)}`).toString();
        const name = (r.name || '').toString().trim();
        if (!name) { errors++; continue; }
        const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(id);
        if (existing) {
          updateStmt.run(name, r.description || '', r.type || 'product', parseFloat(r.unitPrice) || 0, r.unit || 'pc', parseFloat(r.taxRate) || 15, r.categoryId || 'general', id);
          updated++;
        } else {
          insertStmt.run(id, name, r.description || '', r.type || 'product', parseFloat(r.unitPrice) || 0, r.unit || 'pc', parseFloat(r.taxRate) || 15, r.categoryId || 'general');
          inserted++;
        }
      } catch { errors++; }
    }
  });
  txn();
  res.json({ success: true, inserted, updated, errors });
});

app.post('/api/import/customers', requireAuth, requirePermission('canManageSettings'), (req, res) => {
  const { rows } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'No rows provided' });
  let inserted = 0, updated = 0, errors = 0;
  const txn = db.transaction(() => {
    for (const r of rows) {
      try {
        const id = (r.id || `cust-${Date.now()}-${Math.random().toString(36).slice(2)}`).toString();
        const companyName = (r.companyName || '').toString().trim();
        if (!companyName) { errors++; continue; }
        const addr = JSON.stringify({ street: r.street || '', district: r.district || '', city: r.city || '', postalCode: r.postalCode || '', country: r.country || 'SA' });
        const existing = db.prepare('SELECT id FROM customers WHERE id = ?').get(id);
        if (existing) {
          db.prepare(`UPDATE customers SET companyName=?, contactPerson=?, email=?, phone=?, vatNumber=?, billingAddress=? WHERE id=?`).run(companyName, r.contactPerson || '', r.email || '', r.phone || '', r.vatNumber || '', addr, id);
          updated++;
        } else {
          db.prepare(`INSERT OR IGNORE INTO customers (id, companyName, contactPerson, email, phone, vatNumber, billingAddress, createdAt) VALUES (?,?,?,?,?,?,?,?)`).run(id, companyName, r.contactPerson || '', r.email || '', r.phone || '', r.vatNumber || '', addr, new Date().toISOString());
          inserted++;
        }
      } catch { errors++; }
    }
  });
  txn();
  res.json({ success: true, inserted, updated, errors });
});

app.post('/api/import/suppliers', requireAuth, requirePermission('canManageSettings'), (req, res) => {
  const { rows } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'No rows provided' });
  let inserted = 0, errors = 0;
  const txn = db.transaction(() => {
    for (const r of rows) {
      try {
        const name = (r.name || '').toString().trim();
        if (!name) { errors++; continue; }
        const id = (r.id || `sup-${Date.now()}-${Math.random().toString(36).slice(2)}`).toString();
        db.prepare(`INSERT OR IGNORE INTO suppliers (id, name) VALUES (?, ?)`).run(id, name);
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

app.get('/api/boq', requireAuth, (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM boq ORDER BY createdAt DESC').all() as any[];
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
  const row = db.prepare('SELECT * FROM boq WHERE id = ?').get(req.params.id) as any;
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
    db.prepare(`INSERT INTO boq (id, number, title, titleAr, customerId, projectRef, status, sections, notes, currency, subtotal, total, createdAt, updatedAt, createdBy, createdByName, updatedBy, updatedByName, type)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      boqId, number, title, titleAr || '', customerId || null, projectRef || '',
      status || 'draft', JSON.stringify(sections || []), notes || '',
      currency || 'SAR', subtotal || 0, total || 0,
      new Date().toISOString(), new Date().toISOString(),
      user.id, user.name, user.id, user.name,
      docType
    );
    logDocumentActivity(docType, boqId, number, 'created', user);
    res.json({ id: boqId, number });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/boq/:id', requireAuth, (req, res) => {
  const user = (req as any).user;
  const { number, title, titleAr, customerId, projectRef, status, sections, notes, currency, subtotal, total, type } = req.body;
  try {
    const before = db.prepare('SELECT * FROM boq WHERE id = ?').get(req.params.id) as any;
    db.prepare(`UPDATE boq SET number=?, title=?, titleAr=?, customerId=?, projectRef=?, status=?, sections=?, notes=?, currency=?, subtotal=?, total=?, type=?, updatedAt=?, updatedBy=?, updatedByName=? WHERE id=?`)
      .run(number, title, titleAr || '', customerId || null, projectRef || '', status || 'draft',
        JSON.stringify(sections || []), notes || '', currency || 'SAR',
        subtotal || 0, total || 0, type || 'boq', new Date().toISOString(),
        user.id, user.name, req.params.id);
    if (before) {
      const docType = (type === 'bom' ? 'bom' : 'boq');
      const changes = computeDocumentDiff(
        before,
        { title, status, total, notes, sections },
        ['title', 'status', 'total', 'notes']
      );
      const statusChanged = before.status !== (status || 'draft');
      logDocumentActivity(docType, req.params.id, number, statusChanged ? 'status_changed' : 'updated', user, changes);
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/boq/:id', requireAuth, requirePermission('canDeleteData'), (req, res) => {
  const user = (req as any).user;
  const before = db.prepare('SELECT number, type FROM boq WHERE id = ?').get(req.params.id) as any;
  db.prepare('DELETE FROM boq WHERE id = ?').run(req.params.id);
  logDocumentActivity(before?.type === 'bom' ? 'bom' : 'boq', req.params.id, before?.number || null, 'deleted', user);
  res.json({ success: true });
});

// ── DOCUMENT TIMELINE / AUDIT LOG ─────────────────────────────────────────────
// Per-document history (who created, who changed what). Gated by canViewHistory.
app.get('/api/activity/:docType/:docId', requireAuth, requireFeature('tracking'), requirePermission('canViewHistory'), (req, res) => {
  try {
    const logs = db.prepare(
      'SELECT * FROM document_activity WHERE docType = ? AND docId = ? ORDER BY timestamp ASC'
    ).all(req.params.docType, req.params.docId) as any[];
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
    const conditions: string[] = [];
    const params: any[] = [];
    if (docType) { conditions.push('docType = ?'); params.push(docType); }
    if (actorId) { conditions.push('actorId = ?'); params.push(actorId); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const logs = db.prepare(
      `SELECT * FROM document_activity ${where} ORDER BY timestamp DESC LIMIT ?`
    ).all(...params, limit) as any[];
    res.json(logs.map(l => ({ ...l, changes: l.changes ? JSON.parse(l.changes) : [] })));
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
      FROM document_activity WHERE timestamp >= ?
      GROUP BY docType, action
    `).all(since);
    const byUser = db.prepare(`
      SELECT actorId, actorName, COUNT(*) as count
      FROM document_activity WHERE timestamp >= ? AND action = 'created'
      GROUP BY actorId ORDER BY count DESC
    `).all(since);
    const liveCounts = {
      quotations: (db.prepare('SELECT COUNT(*) as c FROM quotations').get() as any).c,
      invoices: (db.prepare('SELECT COUNT(*) as c FROM invoices').get() as any).c,
      boq: (db.prepare("SELECT COUNT(*) as c FROM boq WHERE type = 'boq'").get() as any).c,
      bom: (db.prepare("SELECT COUNT(*) as c FROM boq WHERE type = 'bom'").get() as any).c,
      customers: (db.prepare('SELECT COUNT(*) as c FROM customers').get() as any).c,
      products: (db.prepare('SELECT COUNT(*) as c FROM products').get() as any).c,
      users: (db.prepare('SELECT COUNT(*) as c FROM users').get() as any).c,
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
      SELECT * FROM personal_tasks WHERE userId = ?
      ORDER BY
        CASE status WHEN 'done' THEN 1 ELSE 0 END,
        CASE priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,
        (dueDate IS NULL), dueDate,
        createdAt DESC
    `).all(user.id);
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
      INSERT INTO personal_tasks (id, userId, title, notes, status, priority, dueDate, link, createdAt, updatedAt, completedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, user.id, String(title).trim(), notes || null,
      status || 'open', priority || 'normal', dueDate || null, link || null,
      now, now, status === 'done' ? now : null
    );
    res.json(db.prepare('SELECT * FROM personal_tasks WHERE id = ?').get(id));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/tasks/:id', requireAuth, requireFeature('tasks'), (req, res) => {
  try {
    const user = (req as any).user;
    const existing = db.prepare('SELECT * FROM personal_tasks WHERE id = ? AND userId = ?').get(req.params.id, user.id) as any;
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
      WHERE id = ? AND userId = ?
    `).run(
      title ?? existing.title, notes ?? existing.notes, newStatus,
      priority ?? existing.priority, dueDate ?? existing.dueDate, link ?? existing.link,
      now, completedAt, req.params.id, user.id
    );
    res.json(db.prepare('SELECT * FROM personal_tasks WHERE id = ?').get(req.params.id));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/tasks/:id', requireAuth, requireFeature('tasks'), (req, res) => {
  try {
    const user = (req as any).user;
    const result = db.prepare('DELETE FROM personal_tasks WHERE id = ? AND userId = ?').run(req.params.id, user.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Task not found.' });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});


// ── SERVER-SIDE PDF GENERATION ────────────────────────────────────────────────
// This is the ONLY reliable way to serve PDFs with proper filenames.
// Client-side blob/data URLs cannot reliably set filenames in Chrome/Edge.

async function buildPdfBuffer(docData: any, companyRow: any, type: 'quotation' | 'invoice' | 'boq' | 'bom') {
  const isInvoice = type === 'invoice';
  const isProjectDoc = type === 'boq' || type === 'bom';
  const custRow = db.prepare('SELECT * FROM customers WHERE id = ?').get(docData.customerId) as any;
  const cust = custRow ? {
    company: custRow.companyName || '',
    contactName: custRow.contactPerson || null,
    email: custRow.email || null,
    phone: custRow.phone || null,
    address: (() => { try { const a = JSON.parse(custRow.billingAddress); return [a.street, a.district].filter(Boolean).join(', '); } catch { return null; } })(),
    city: (() => { try { const a = JSON.parse(custRow.billingAddress); return a.city || null; } catch { return null; } })(),
    country: (() => { try { const a = JSON.parse(custRow.billingAddress); return a.country || null; } catch { return null; } })(),
  } : { company: 'Unknown' };

  const settingsRow = db.prepare("SELECT value FROM settings WHERE key = 'company'").get() as any;
  const comp = settingsRow ? JSON.parse(settingsRow.value) : {};
  const pdfSettings = db.prepare("SELECT value FROM settings WHERE key = 'pdfSettings'").get() as any;
  const pdfConf = pdfSettings ? JSON.parse(pdfSettings.value) : {};

  // Read logo and footerImage from individual settings keys (base64 data URLs)
  const logoRow = db.prepare("SELECT value FROM settings WHERE key = 'logo'").get() as { value: string } | undefined;
  const footerRow = db.prepare("SELECT value FROM settings WHERE key = 'footerImage'").get() as { value: string } | undefined;

  const settings = {
    companyName: comp.name || 'Company',
    email: comp.email || null,
    phone: comp.phone || null,
    address: (() => { try { const a = comp.address; return a ? [a.street, a.district, a.city].filter(Boolean).join(', ') : null; } catch { return null; } })(),
    logoUrl: logoRow?.value || comp.logo || null,
    footerImageUrl: footerRow?.value || null,
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
    const compRow = db.prepare("SELECT value FROM settings WHERE key = 'company'").get() as any;
    const buffer = await buildPdfBuffer(documentData, compRow, type);
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
    const row = db.prepare('SELECT * FROM quotations WHERE id = ?').get(req.params.id) as any;
    if (!row) return res.status(404).json({ error: 'Quotation not found' });
    const compRow = db.prepare("SELECT value FROM settings WHERE key = 'company'").get() as any;
    const buffer = await buildPdfBuffer(row, compRow, 'quotation');
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
    const row = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id) as any;
    if (!row) return res.status(404).json({ error: 'Invoice not found' });
    const compRow = db.prepare("SELECT value FROM settings WHERE key = 'company'").get() as any;
    const buffer = await buildPdfBuffer(row, compRow, 'invoice');
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
    const row = db.prepare('SELECT * FROM boq WHERE id = ?').get(req.params.id) as any;
    if (!row) return res.status(404).json({ error: 'Document not found' });
    const compRow = db.prepare("SELECT value FROM settings WHERE key = 'company'").get() as any;
    const docType = row.type === 'bom' ? 'bom' : 'boq';
    const buffer = await buildPdfBuffer(row, compRow, docType);
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

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 ${process.env.VITE_APP_NAME || 'New ERP'} Backend operational on http://localhost:${PORT}`);
    console.log(`   Database: ${DB_PATH} | Env: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer().catch((err) => {
  console.error('❌ Server startup failure:', err);
});
