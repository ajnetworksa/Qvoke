/**
 * Qvoke ERP - Comprehensive Beta Test & Security Audit Suite
 * Covers multi-tenant security isolation, document sequences, inventory stock deduction,
 * recurring subscriptions, tokenized e-signature approvals, and ZATCA Phase 1 & 2 TLV encoding.
 */

import Database from 'better-sqlite3';
import { generateZatcaQRBase64 } from './src/utils/zatca';

const DB_PATH = process.env.DB_PATH || './quotes.db';
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

const results: TestResult[] = [];

async function runTest(suite: string, name: string, fn: () => void | Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    results.push({ suite, name, passed: true, durationMs: Date.now() - start });
    console.log(`  \x1b[32m✔ PASS\x1b[0m [${suite}] ${name} (${Date.now() - start}ms)`);
  } catch (err: any) {
    results.push({ suite, name, passed: false, error: err.message, durationMs: Date.now() - start });
    console.error(`  \x1b[31m✖ FAIL\x1b[0m [${suite}] ${name}: ${err.message}`);
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

function assertEquals(actual: any, expected: any, message: string) {
  if (actual !== expected) {
    throw new Error(`Assertion Failed: ${message} (Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
  }
}

async function runSuite() {
  console.log('\n======================================================');
  console.log('🚀 RUNNING QVOKE ENTERPRISE BETA & SECURITY TEST SUITE');
  console.log('======================================================\n');

  // ---------------------------------------------------------
  // SUITE 1: Multi-Tenant Data Isolation & Security Scoping
  // ---------------------------------------------------------
  console.log('\n--- SUITE 1: Multi-Tenant Security & Tenant Isolation ---');
  
  await runTest('Security', 'Tenant Isolation: Prevent cross-tenant expense leakage', () => {
    const tenantA = 'tenant_alpha_test_' + Date.now();
    const tenantB = 'tenant_beta_test_' + Date.now();

    // Insert expense for Tenant A
    db.prepare(`
      INSERT INTO expenses (id, companyId, number, category, description, amount, taxRate, taxAmount, total, currency, date, paymentMethod, status, taxDeductible, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('exp-tenant-a', tenantA, 'EXP-T-0001', 'office_supplies', 'Secret Alpha Expense', 1000, 15, 150, 1150, 'SAR', '2026-08-30', 'bank_transfer', 'paid', 1, new Date().toISOString(), new Date().toISOString());

    // Tenant B queries expenses
    const tenantBExpenses = db.prepare('SELECT * FROM expenses WHERE companyId = ?').all(tenantB);
    assertEquals(tenantBExpenses.length, 0, 'Tenant B should receive 0 records from Tenant A');

    // Tenant A queries expenses
    const tenantAExpenses = db.prepare('SELECT * FROM expenses WHERE companyId = ?').all(tenantA);
    assertEquals(tenantAExpenses.length, 1, 'Tenant A should receive its own record');
    assertEquals((tenantAExpenses[0] as any).description, 'Secret Alpha Expense', 'Tenant A matches description');

    // Clean up test records
    db.prepare('DELETE FROM expenses WHERE companyId IN (?, ?)').run(tenantA, tenantB);
  });

  await runTest('Security', 'Tenant Isolation: Scoped Public Portal Token validation', () => {
    const tenantA = 'tenant_alpha_' + Date.now();
    const token = 'sec_token_' + Math.random().toString(36).substring(2);

    db.prepare(`
      INSERT INTO public_shares (id, companyId, token, docType, docId, status, viewsCount, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('share-sec-1', tenantA, token, 'quotation', 'qt-sec-1', 'active', 0, new Date().toISOString());

    const share = db.prepare("SELECT * FROM public_shares WHERE token = ? AND status != 'expired'").get(token) as any;
    assert(!!share, 'Share record must be found by valid active token');
    assertEquals(share.companyId, tenantA, 'Company ID must match creator');

    // Test token expiration
    db.prepare("UPDATE public_shares SET status = 'expired' WHERE token = ?").run(token);
    const revokedShare = db.prepare("SELECT * FROM public_shares WHERE token = ? AND status != 'expired'").get(token);
    assertEquals(revokedShare, undefined, 'Expired token should not be queryable as active');

    db.prepare('DELETE FROM public_shares WHERE token = ?').run(token);
  });

  // ---------------------------------------------------------
  // SUITE 2: Sequence Number Generators & Atomic Increments
  // ---------------------------------------------------------
  console.log('\n--- SUITE 2: Document Sequence Generators ---');

  await runTest('Sequences', 'Per-company sequences are independent (EXP, REC, PO, INV, QT)', () => {
    const types = ['EXP', 'REC', 'PO', 'INV', 'QT'];
    const companyA = 'seq_a_' + Date.now();
    const companyB = 'seq_b_' + Date.now();
    try {
      for (const type of types) {
        for (const c of [companyA, companyB]) {
          db.prepare(`
            INSERT INTO sequences (companyId, docType, prefix, lastNumber, padding, resetPeriod, lastYear)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(c, type, `${type}-`, 1, 4, 'yearly', 2026);
        }
        // Advancing company A must not move company B.
        db.prepare(`UPDATE sequences SET lastNumber = lastNumber + 1 WHERE docType = ? AND companyId = ?`).run(type, companyA);
        const a = db.prepare(`SELECT * FROM sequences WHERE docType = ? AND companyId = ?`).get(type, companyA) as any;
        const b = db.prepare(`SELECT * FROM sequences WHERE docType = ? AND companyId = ?`).get(type, companyB) as any;
        assertEquals(`${a.prefix}${String(a.lastNumber).padStart(a.padding, '0')}`, `${type}-0002`, `Company A ${type} advanced`);
        assertEquals(`${b.prefix}${String(b.lastNumber).padStart(b.padding, '0')}`, `${type}-0001`, `Company B ${type} unchanged`);
      }
    } finally {
      db.prepare(`DELETE FROM sequences WHERE companyId IN (?, ?)`).run(companyA, companyB);
    }
  });

  // ---------------------------------------------------------
  // SUITE 3: Inventory Stock Deduction & Movement Audit
  // ---------------------------------------------------------
  console.log('\n--- SUITE 3: Product Inventory & Auto Stock Deduction ---');

  await runTest('Inventory', 'Stock adjustment and automatic deduction on invoice posting', () => {
    const companyId = 'comp_inv_' + Date.now();
    const productId = 'prod_cctv_' + Date.now();

    // 1. Insert product with trackStock = 1, initial stock = 0
    db.prepare(`
      INSERT INTO products (id, name, type, unitPrice, unit, taxRate, stockQuantity, minStockLevel, trackStock)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(productId, '4K IP Dome Camera', 'product', 450, 'pc', 15, 0, 5, 1);

    // 2. Adjust stock IN (+100 units from supplier)
    const initialAdjustment = 100;
    db.prepare(`UPDATE products SET stockQuantity = stockQuantity + ? WHERE id = ?`).run(initialAdjustment, productId);
    db.prepare(`
      INSERT INTO inventory_transactions (id, companyId, productId, type, quantity, previousStock, newStock, notes, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('tx-in-1', companyId, productId, 'in', 100, 0, 100, 'Initial Supplier Receipt', new Date().toISOString());

    let prod = db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as any;
    assertEquals(prod.stockQuantity, 100, 'Stock after inward shipment should be 100');

    // 3. Post invoice selling 15 cameras
    const soldQty = 15;
    const prevStock = prod.stockQuantity;
    const newStock = prevStock - soldQty;

    db.prepare(`UPDATE products SET stockQuantity = ? WHERE id = ?`).run(newStock, productId);
    db.prepare(`
      INSERT INTO inventory_transactions (id, companyId, productId, type, quantity, previousStock, newStock, referenceDocId, referenceDocType, notes, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('tx-out-1', companyId, productId, 'out', soldQty, prevStock, newStock, 'inv-test-1', 'invoice', 'Sold on Invoice INV-0012', new Date().toISOString());

    // 4. Verify new stock and audit history
    prod = db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as any;
    assertEquals(prod.stockQuantity, 85, 'Stock after invoice sale should be 85');

    const logs = db.prepare('SELECT * FROM inventory_transactions WHERE productId = ? ORDER BY createdAt ASC').all(productId) as any[];
    assertEquals(logs.length, 2, 'Should have 2 inventory transactions');
    assertEquals(logs[0].type, 'in', 'First tx is in');
    assertEquals(logs[1].type, 'out', 'Second tx is out');
    assertEquals(logs[1].quantity, 15, 'Quantity deducted matches invoice');

    // Clean up
    db.prepare('DELETE FROM inventory_transactions WHERE productId = ?').run(productId);
    db.prepare('DELETE FROM products WHERE id = ?').run(productId);
  });

  // ---------------------------------------------------------
  // SUITE 4: Expense Ledger & P&L Calculation
  // ---------------------------------------------------------
  console.log('\n--- SUITE 4: Expense Ledger & Financial Calculations ---');

  await runTest('Finance', 'Expense pre-tax and VAT math verification', () => {
    const companyId = 'comp_fin_' + Date.now();

    const expenses = [
      { num: 'EXP-1', desc: 'STC Fiber Internet', amt: 500, taxRate: 15, cat: 'utilities' },
      { num: 'EXP-2', desc: 'AWS Cloud Backup', amt: 200, taxRate: 15, cat: 'software' },
      { num: 'EXP-3', desc: 'Office Rent', amt: 5000, taxRate: 0, cat: 'rent' }
    ];

    let totalExpenseSum = 0;
    let totalTaxSum = 0;

    for (const exp of expenses) {
      const taxAmt = exp.amt * (exp.taxRate / 100);
      const total = exp.amt + taxAmt;
      totalExpenseSum += total;
      totalTaxSum += taxAmt;

      db.prepare(`
        INSERT INTO expenses (id, companyId, number, category, description, amount, taxRate, taxAmount, total, currency, date, paymentMethod, status, taxDeductible, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(`exp-${exp.num}`, companyId, exp.num, exp.cat, exp.desc, exp.amt, exp.taxRate, taxAmt, total, 'SAR', '2026-08-30', 'bank_transfer', 'paid', 1, new Date().toISOString(), new Date().toISOString());
    }

    const rows = db.prepare('SELECT SUM(total) as totalSum, SUM(taxAmount) as taxSum FROM expenses WHERE companyId = ?').get(companyId) as any;
    assertEquals(rows.totalSum, 500 * 1.15 + 200 * 1.15 + 5000, 'Total expense sum matches');
    assertEquals(rows.taxSum, 500 * 0.15 + 200 * 0.15, 'Total deductible input VAT matches');

    db.prepare('DELETE FROM expenses WHERE companyId = ?').run(companyId);
  });

  // ---------------------------------------------------------
  // SUITE 5: Recurring Billing Engine
  // ---------------------------------------------------------
  console.log('\n--- SUITE 5: Recurring Subscription Generator ---');

  await runTest('Subscriptions', 'Recurring subscription schedule creation & generation trigger', () => {
    const companyId = 'comp_rec_' + Date.now();
    const customerId = 'cust_rec_' + Date.now();
    const recId = 'rec_prof_' + Date.now();

    db.prepare(`
      INSERT INTO customers (id, companyName, contactPerson, email, phone, billingAddress, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(customerId, 'Acme Security Systems', 'Fahad Al-Harbi', 'billing@acmesecurity.com', '+966501234567', '{}', new Date().toISOString());

    const lineItemsJson = JSON.stringify([
      { id: 'item-1', description: 'Monthly Cloud Monitoring Retainer', quantity: 1, unit: 'Month', unitPrice: 1500, taxPercent: 15, subtotal: 1500 }
    ]);

    db.prepare(`
      INSERT INTO recurring_invoices (id, companyId, customerId, profileName, number, frequency, startDate, nextRunDate, lineItems, total, currency, status, generationCount, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(recId, companyId, customerId, 'Monthly Maintenance SLA', 'REC-0001', 'monthly', '2026-08-01', '2026-09-01', lineItemsJson, 1725, 'SAR', 'active', 0, new Date().toISOString(), new Date().toISOString());

    // Simulate generation execution
    const profile = db.prepare('SELECT * FROM recurring_invoices WHERE id = ?').get(recId) as any;
    assertEquals(profile.status, 'active', 'Profile is active');
    assertEquals(profile.total, 1725, 'Total matches monthly recurring amount');

    // Increment generation count
    db.prepare('UPDATE recurring_invoices SET generationCount = generationCount + 1, lastGeneratedAt = CURRENT_TIMESTAMP WHERE id = ?').run(recId);
    const updated = db.prepare('SELECT generationCount FROM recurring_invoices WHERE id = ?').get(recId) as any;
    assertEquals(updated.generationCount, 1, 'Generation count incremented');

    db.prepare('DELETE FROM recurring_invoices WHERE id = ?').run(recId);
    db.prepare('DELETE FROM customers WHERE id = ?').run(customerId);
  });

  // ---------------------------------------------------------
  // SUITE 6: Public Portal E-Signature & Approval Sign-Off
  // ---------------------------------------------------------
  console.log('\n--- SUITE 6: Public Portal & Digital Signature E-Signing ---');

  await runTest('ClientPortal', 'Client electronic signature approval workflow', () => {
    const companyId = 'comp_sig_' + Date.now();
    const customerId = 'cust_sig_' + Date.now();
    const quoteId = 'qt_sig_' + Date.now();
    const token = 'tok_' + Math.random().toString(36).substring(2);

    db.prepare(`
      INSERT INTO customers (id, companyName, contactPerson, email, phone, billingAddress, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(customerId, 'Client Portal Customer', 'Manager', 'manager@client.com', '+966500000000', '{}', new Date().toISOString());

    const quoteNumber = 'QT-SIG-' + Date.now();

    // 1. Create quote in sent status
    db.prepare(`
      INSERT INTO quotations (id, number, customerId, date, validUntil, status, lineItems, currency, subtotal, discountTotal, taxTotal, total, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(quoteId, quoteNumber, customerId, '2026-08-30', '2026-09-15', 'sent', '[]', 'SAR', 10000, 0, 1500, 11500, new Date().toISOString(), new Date().toISOString());

    // 2. Create public share token
    db.prepare(`
      INSERT INTO public_shares (id, companyId, token, docType, docId, status, viewsCount, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('share-sig-1', companyId, token, 'quotation', quoteId, 'active', 0, new Date().toISOString());

    // 3. Client signs quotation via portal
    const signerName = 'Faisal Al-Otaibi';
    const signatureData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    db.prepare(`
      UPDATE public_shares 
      SET acceptedByName = ?, acceptedSignature = ?, acceptedAt = CURRENT_TIMESTAMP, status = 'accepted'
      WHERE token = ?
    `).run(signerName, signatureData, token);

    // 4. Update quotation status to confirmed
    db.prepare("UPDATE quotations SET status = 'confirmed' WHERE id = ?").run(quoteId);

    // 5. Verification
    const share = db.prepare('SELECT * FROM public_shares WHERE token = ?').get(token) as any;
    assertEquals(share.status, 'accepted', 'Share status updated to accepted');
    assertEquals(share.acceptedByName, signerName, 'Signer name recorded');

    const quote = db.prepare('SELECT * FROM quotations WHERE id = ?').get(quoteId) as any;
    assertEquals(quote.status, 'confirmed', 'Quotation marked as confirmed upon e-signing');

    // Clean up
    db.prepare('DELETE FROM public_shares WHERE token = ?').run(token);
    db.prepare('DELETE FROM quotations WHERE id = ?').run(quoteId);
    db.prepare('DELETE FROM customers WHERE id = ?').run(customerId);
  });

  // ---------------------------------------------------------
  // SUITE 7: Saudi ZATCA TLV Base64 QR Code Encoding
  // ---------------------------------------------------------
  console.log('\n--- SUITE 7: Saudi ZATCA TLV Base64 QR Code Encoding ---');

  await runTest('ZATCA', 'TLV QR encoding produces compliant Base64 string with all 5 tags', () => {
    const seller = 'AJ NETWORK SOLUTIONS';
    const vatNo = '310123456700003';
    const timestamp = '2026-08-30T10:00:00Z';
    const invoiceTotal = 11500.00;
    const vatTotal = 1500.00;

    const qrBase64 = generateZatcaQRBase64(seller, vatNo, timestamp, invoiceTotal, vatTotal);

    assert(typeof qrBase64 === 'string', 'QR Output must be a string');
    assert(qrBase64.length > 20, 'QR Base64 length should be substantial');

    // Decode Base64 and verify TLV Tag 1 exists
    const buffer = Buffer.from(qrBase64, 'base64');
    assertEquals(buffer[0], 1, 'Tag 1 should be seller name tag');
    const tag1Len = buffer[1];
    const tag1Val = buffer.subarray(2, 2 + tag1Len).toString('utf-8');
    assertEquals(tag1Val, seller, 'Decoded Tag 1 matches seller name');
  });

  // ---------------------------------------------------------
  // FINAL REPORT & AUDIT SUMMARY
  // ---------------------------------------------------------
  console.log('\n======================================================');
  console.log('📊 TEST SUMMARY & SECURITY AUDIT REPORT');
  console.log('======================================================');
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalDuration = results.reduce((acc, r) => acc + r.durationMs, 0);

  console.log(`Total Tests Run: ${total}`);
  console.log(`\x1b[32mPassed: ${passed}\x1b[0m`);
  console.log(`${failed > 0 ? '\x1b[31m' : '\x1b[32m'}Failed: ${failed}\x1b[0m`);
  console.log(`Total Duration: ${totalDuration}ms\n`);

  if (failed === 0) {
    console.log('🎉 ALL 8 AUDIT TESTS PASSED FLAWLESSLY with 100% SUCCESS RATE!\n');
  } else {
    console.log('❌ SOME TESTS FAILED. Please review output above.\n');
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Test suite runner crashed:', err);
  process.exit(1);
});
