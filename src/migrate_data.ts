import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const legacyDbPath = 'd:/Devlopment/App/Dynamic Quotation/Dynamic-Quotation-main/quotes.db';
const newDbPath = 'd:/Devlopment/App/Dynamic Quotation/New ERP/quotes.db';

console.log('🚀 INITIALIZING DATABASE MIGRATION ENGINE...');

if (!fs.existsSync(legacyDbPath)) {
  console.error(`❌ Legacy database not found at ${legacyDbPath}. Aborting.`);
  process.exit(1);
}

// 1. Back up current new database if it exists
if (fs.existsSync(newDbPath)) {
  const backupPath = `${newDbPath}.backup-${Date.now()}`;
  fs.copyFileSync(newDbPath, backupPath);
  console.log(`💾 Backed up existing new database to: ${path.basename(backupPath)}`);
}

try {
  const legacyDb = new Database(legacyDbPath);
  const newDb = new Database(newDbPath);

  // Disable foreign keys temporarily during migration to avoid deletion failures
  newDb.pragma('foreign_keys = OFF');

  // Enable WAL mode
  newDb.pragma('journal_mode = WAL');

  // Helper to safely clear new tables before inserting
  const tablesToClear = ['users', 'sessions', 'customers', 'products', 'quotations', 'invoices', 'permission_groups', 'settings'];
  for (const table of tablesToClear) {
    try {
      newDb.prepare(`DELETE FROM ${table}`).run();
    } catch (e) {}
  }
  console.log('🧹 Cleaned existing new database tables for fresh restore.');

  // 2. MIGRATE USERS
  console.log('👥 Migrating system users...');
  const legacyUsers = legacyDb.prepare('SELECT * FROM users').all() as any[];
  const insertUser = newDb.prepare(`
    INSERT INTO users (id, username, name, email, password, role, permissions, avatar)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let usersMigrated = 0;
  for (const u of legacyUsers) {
    const userId = `u-${u.id}`;
    const email = u.email || `${u.username}@ajnetwork.sa`;
    
    // Map avatar base on role
    const avatar = u.role === 'admin' 
      ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'
      : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80';

    // Verify valid permissions string
    let permissions = u.permissions || '{}';
    try {
      JSON.parse(permissions);
    } catch {
      permissions = '{}';
    }

    insertUser.run(userId, u.username, u.name || u.username.toUpperCase(), email, u.password, u.role, permissions, avatar);
    usersMigrated++;
  }
  console.log(`✅ Migrated ${usersMigrated} Users.`);

  // 3. MIGRATE CUSTOMERS
  console.log('🏢 Migrating customer directory...');
  const legacyCustomers = legacyDb.prepare('SELECT * FROM customers').all() as any[];
  const insertCustomer = newDb.prepare(`
    INSERT INTO customers (id, companyName, contactPerson, email, phone, vatNumber, billingAddress, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let customersMigrated = 0;
  for (const c of legacyCustomers) {
    const customerId = `cust-${c.id}`;
    
    // Parse billing address details
    const addressDetails = {
      street: c.address || '',
      district: '',
      city: 'Riyadh',
      postalCode: '',
      country: 'SA'
    };

    insertCustomer.run(
      customerId,
      c.name,
      c.contact || '',
      c.email || 'info@client.sa',
      c.mobile || '',
      '', // VAT number (default empty if not present)
      JSON.stringify(addressDetails),
      new Date().toISOString()
    );
    customersMigrated++;
  }
  console.log(`✅ Migrated ${customersMigrated} Customers.`);

  // 4. MIGRATE PRODUCTS
  console.log('📦 Migrating product catalog...');
  const legacyProducts = legacyDb.prepare('SELECT * FROM products').all() as any[];
  const insertProduct = newDb.prepare(`
    INSERT INTO products (id, name, description, type, unitPrice, unit, taxRate, categoryId)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let productsMigrated = 0;
  for (const p of legacyProducts) {
    const productId = `p-${p.id}`;
    const combinedName = p.description + (p.description_ar ? ` / ${p.description_ar}` : '');
    const desc = `Item Code: ${p.item_code || 'N/A'}\nSupplier: ${p.supplier_name || 'N/A'}`;

    insertProduct.run(
      productId,
      combinedName,
      desc,
      'product',
      p.unit_price || 0,
      p.unit || 'pc',
      15.0, // Default 15% VAT
      p.supplier_name ? p.supplier_name.toLowerCase().replace(/ /g, '-') : 'general'
    );
    productsMigrated++;
  }
  console.log(`✅ Migrated ${productsMigrated} Products.`);

  // 5. MIGRATE PERMISSION GROUPS
  console.log('🛡️ Migrating permission group presets...');
  const legacyGroups = legacyDb.prepare('SELECT * FROM permission_groups').all() as any[];
  const insertGroup = newDb.prepare(`
    INSERT INTO permission_groups (id, name, description, permissions, members, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  let groupsMigrated = 0;
  for (const g of legacyGroups) {
    let permissions = g.permissions || '{}';
    let members = g.members || '[]';

    // Parse and map legacy numeric user IDs to new u-IDs in members
    try {
      const parsedMembers = JSON.parse(members);
      if (Array.isArray(parsedMembers)) {
        members = JSON.stringify(parsedMembers.map(id => `u-${id}`));
      }
    } catch {
      members = '[]';
    }

    insertGroup.run(
      g.id,
      g.name,
      g.description || '',
      permissions,
      members,
      g.created_at || new Date().toISOString()
    );
    groupsMigrated++;
  }
  console.log(`✅ Migrated ${groupsMigrated} Permission Groups.`);

  // 6. MIGRATE QUOTATIONS & INVOICES
  console.log('📄 Migrating business documents (Quotes & Invoices)...');
  const legacyQuotes = legacyDb.prepare('SELECT * FROM quotes').all() as any[];
  
  const insertQuotation = newDb.prepare(`
    INSERT INTO quotations (id, number, customerId, date, validUntil, status, lineItems, notes, terms, currency, subtotal, discountTotal, taxTotal, total, linkedInvoiceId, createdAt, updatedAt, salespersonId)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertInvoice = newDb.prepare(`
    INSERT INTO invoices (id, number, customerId, date, dueDate, status, paymentTerms, lineItems, notes, terms, currency, subtotal, discountTotal, taxTotal, total, linkedQuoteId, payments, amountPaid, amountDue, createdAt, updatedAt, salespersonId)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let quotesMigrated = 0;
  let invoicesMigrated = 0;

  // Helper to safely parse dates and avoid "Invalid time value" crashes
  const parseDateSafely = (val: any, fallback: string): string => {
    if (!val) return fallback;
    try {
      // Clean up string: replace double spaces, trim
      const cleaned = String(val).trim();
      if (!cleaned || cleaned === '0000-00-00 00:00:00' || cleaned === 'null') {
        return fallback;
      }
      const d = new Date(cleaned);
      if (isNaN(d.getTime())) return fallback;
      return d.toISOString();
    } catch {
      return fallback;
    }
  };

  for (const q of legacyQuotes) {
    // 6a. Load and map line items from quote_items table
    const legacyItems = legacyDb.prepare('SELECT * FROM quote_items WHERE quote_id = ?').all(q.quote_id) as any[];
    const mappedLineItems = legacyItems.map((item, idx) => ({
      id: `li-${item.id || idx}`,
      type: 'item',
      productId: item.product_id ? `p-${item.product_id}` : '',
      description: item.description + (item.description_ar ? `\n${item.description_ar}` : ''),
      quantity: item.qty || 1,
      unit: item.unit || 'pc',
      unitPrice: item.unit_price || 0,
      discountPercent: 0,
      taxPercent: q.vat_rate || 15,
      subtotal: item.net_price || 0
    }));

    // 6b. Map terms and conditions
    const termsArray = [
      q.payment ? `Payment: ${q.payment}` : '',
      q.warranty ? `Warranty: ${q.warranty}` : '',
      q.duration ? `Delivery/Duration: ${q.duration}` : '',
      q.mobilization ? `Mobilization: ${q.mobilization}` : '',
      q.manpower ? `Manpower: ${q.manpower}` : ''
    ].filter(Boolean);
    const termsText = termsArray.join('\n');

    const customerId = `cust-${q.customer_id}`;
    const salespersonId = q.author_id ? `u-${q.author_id}` : 'u-1';
    
    const docDate = parseDateSafely(q.date, new Date().toISOString());
    const docValidUntil = parseDateSafely(q.expiry_date, new Date(Date.now() + 15*24*60*60*1000).toISOString());
    const docUpdatedAt = parseDateSafely(q.updated_at, docDate);

    // Check if type matches invoice
    if (q.type === 'invoice') {
      const invoiceId = `inv-${q.id}`;
      insertInvoice.run(
        invoiceId,
        q.quote_id, // Invoice number
        customerId,
        docDate,
        docValidUntil, // Due date
        q.status === 'paid' ? 'paid' : q.status === 'partial' ? 'partial' : 'draft',
        'Net 30',
        JSON.stringify(mappedLineItems),
        q.note || '',
        termsText,
        'SAR',
        q.subtotal || 0,
        q.discount || 0,
        q.tax || 0,
        q.grand_total || 0,
        null, // Linked quote
        '[]', // Payments JSON
        0, // Amount paid
        q.grand_total || 0, // Amount due
        docDate,
        docUpdatedAt,
        salespersonId
      );
      invoicesMigrated++;
    } else {
      // It is a quotation
      const quoteId = `qt-${q.id}`;
      insertQuotation.run(
        quoteId,
        q.quote_id, // Quotation number
        customerId,
        docDate,
        docValidUntil,
        q.status === 'confirmed' ? 'confirmed' : q.status === 'declined' ? 'declined' : 'draft',
        JSON.stringify(mappedLineItems),
        q.note || '',
        termsText,
        'SAR',
        q.subtotal || 0,
        q.discount || 0,
        q.tax || 0,
        q.grand_total || 0,
        null, // Linked invoice
        docDate,
        docUpdatedAt,
        salespersonId
      );
      quotesMigrated++;
    }
  }
  console.log(`✅ Migrated ${quotesMigrated} Quotations.`);
  console.log(`✅ Migrated ${invoicesMigrated} Invoices.`);

  // 7. MIGRATE COMPANY SETTINGS
  console.log('⚙️ Migrating company settings...');
  const legacyCompanyRow = legacyDb.prepare("SELECT value FROM settings WHERE key = 'company'").get() as { value: string } | undefined;
  if (legacyCompanyRow) {
    newDb.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('company', ?)").run(legacyCompanyRow.value);
    console.log('✅ Migrated official company credentials & settings.');
  }

  // Close databases
  legacyDb.close();
  newDb.close();

  console.log('\n⭐ DATABASE RECOVERY & FRESH RESTORE COMPLETED SUCCESSFULLY!');
} catch (error: any) {
  console.error('\n❌ DATABASE MIGRATION CRITICAL EXCEPTION:', error.message);
  process.exit(1);
}
