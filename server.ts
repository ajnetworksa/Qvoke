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
`);

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
      canUseAI: true
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
    id, number, customerId, date, validUntil, status, lineItems, notes, terms, subject, subjectAr, currency,
    subtotal, discountTotal, taxTotal, total, salespersonId, watermarkText, watermarkType, hidePrices, manualTotal
  } = req.body;
  try {
    const qId = id || `qt-${Date.now()}`;
    db.prepare(`
      INSERT INTO quotations (id, number, customerId, date, validUntil, status, lineItems, notes, terms, subject, subjectAr, currency, subtotal, discountTotal, taxTotal, total, createdAt, updatedAt, salespersonId, watermarkText, watermarkType, hidePrices, manualTotal)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      manualTotal !== undefined && manualTotal !== null ? manualTotal : null
    );
    res.json({ id: qId });
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
    db.prepare(`
      UPDATE quotations
      SET number = ?, customerId = ?, date = ?, validUntil = ?, status = ?, lineItems = ?, notes = ?, terms = ?, subject = ?, subjectAr = ?, currency = ?, subtotal = ?, discountTotal = ?, taxTotal = ?, total = ?, linkedInvoiceId = ?, updatedAt = ?, salespersonId = ?, watermarkText = ?, watermarkType = ?, hidePrices = ?, manualTotal = ?
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
      req.params.id
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/quotes/:id', requireAuth, requirePermission('canDeleteData'), (req, res) => {
  db.prepare('DELETE FROM quotations WHERE id = ?').run(req.params.id);
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
    id, number, customerId, date, dueDate, status, paymentTerms, lineItems, notes, terms, subject, subjectAr, currency,
    subtotal, discountTotal, taxTotal, total, linkedQuoteId, payments, amountPaid, amountDue, salespersonId, watermarkText, watermarkType, hidePrices, manualTotal
  } = req.body;
  try {
    const invId = id || `inv-${Date.now()}`;
    db.prepare(`
      INSERT INTO invoices (id, number, customerId, date, dueDate, status, paymentTerms, lineItems, notes, terms, subject, subjectAr, currency, subtotal, discountTotal, taxTotal, total, linkedQuoteId, payments, amountPaid, amountDue, createdAt, updatedAt, salespersonId, watermarkText, watermarkType, hidePrices, manualTotal)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      manualTotal !== undefined && manualTotal !== null ? manualTotal : null
    );
    res.json({ id: invId });
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
    db.prepare(`
      UPDATE invoices
      SET number = ?, customerId = ?, date = ?, dueDate = ?, status = ?, paymentTerms = ?, lineItems = ?, notes = ?, terms = ?, subject = ?, subjectAr = ?, currency = ?, subtotal = ?, discountTotal = ?, taxTotal = ?, total = ?, linkedQuoteId = ?, payments = ?, amountPaid = ?, amountDue = ?, updatedAt = ?, salespersonId = ?, watermarkText = ?, watermarkType = ?, hidePrices = ?, manualTotal = ?
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
      req.params.id
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/invoices/:id', requireAuth, requirePermission('canDeleteData'), (req, res) => {
  db.prepare('DELETE FROM invoices WHERE id = ?').run(req.params.id);
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
  const { id, number, title, titleAr, customerId, projectRef, status, sections, notes, currency, subtotal, total, createdBy, type } = req.body;
  try {
    const boqId = id || `boq-${Date.now()}`;
    db.prepare(`INSERT INTO boq (id, number, title, titleAr, customerId, projectRef, status, sections, notes, currency, subtotal, total, createdAt, updatedAt, createdBy, type)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      boqId, number, title, titleAr || '', customerId || null, projectRef || '',
      status || 'draft', JSON.stringify(sections || []), notes || '',
      currency || 'SAR', subtotal || 0, total || 0,
      new Date().toISOString(), new Date().toISOString(), createdBy || null,
      type || 'boq'
    );
    res.json({ id: boqId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/boq/:id', requireAuth, (req, res) => {
  const { number, title, titleAr, customerId, projectRef, status, sections, notes, currency, subtotal, total, type } = req.body;
  try {
    db.prepare(`UPDATE boq SET number=?, title=?, titleAr=?, customerId=?, projectRef=?, status=?, sections=?, notes=?, currency=?, subtotal=?, total=?, type=?, updatedAt=? WHERE id=?`)
      .run(number, title, titleAr || '', customerId || null, projectRef || '', status || 'draft',
        JSON.stringify(sections || []), notes || '', currency || 'SAR',
        subtotal || 0, total || 0, type || 'boq', new Date().toISOString(), req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/boq/:id', requireAuth, requirePermission('canDeleteData'), (req, res) => {
  db.prepare('DELETE FROM boq WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});


// ── SERVER-SIDE PDF GENERATION ────────────────────────────────────────────────
// This is the ONLY reliable way to serve PDFs with proper filenames.
// Client-side blob/data URLs cannot reliably set filenames in Chrome/Edge.

async function buildPdfBuffer(docData: any, companyRow: any, type: 'quotation' | 'invoice') {
  const isInvoice = type === 'invoice';
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

  const lineItems = typeof docData.lineItems === 'string' ? JSON.parse(docData.lineItems) : (docData.lineItems || []);
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
    subject: docData.subject || null,
    subjectAr: docData.subjectAr || null,
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
