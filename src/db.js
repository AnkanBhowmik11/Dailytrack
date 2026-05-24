import Dexie from 'dexie';

// Initialize the Database
export const db = new Dexie('DailyTrackDB');

// Define database schema - Version 2 includes user_id for RLS support
db.version(2).stores({
  companySettings: 'id, user_id',
  sites: '++id, name, active, user_id',
  employees: '++id, name, siteId, active, designation, user_id',
  attendance: '++id, date, employeeId, siteId, [employeeId+date], user_id',
  invoices: '++id, invoiceNumber, date, siteId, status, user_id'
});

// Version 3 — adds employee financial ledger (transactions)
db.version(3).stores({
  companySettings: 'id, user_id',
  sites: '++id, name, active, user_id',
  employees: '++id, name, siteId, active, designation, user_id',
  attendance: '++id, date, employeeId, siteId, [employeeId+date], user_id',
  invoices: '++id, invoiceNumber, date, siteId, status, user_id',
  transactions: '++id, employeeId, siteId, date, type, user_id'
});

// Helper to seed default settings if they don't exist
export async function initCompanySettings() {
  const settings = await db.companySettings.get('main');
  if (!settings) {
    await db.companySettings.put({
      id: 'main',
      name: '',          // Set by user in Settings
      logo: '',
      address: '',       // Set by user in Settings
      gstin: '',         // Set by user in Settings
      defaultOtRate: 100,    // ₹ per hour
      defaultGstRate: 18,    // 18% standard GST rate
      panNo: '',
      bankName: '',
      bankBranch: '',
      bankAccount: '',
      bankIfsc: '',
      currency: 'INR',
      currencySymbol: '₹',
      theme: 'light',
      syncEnabled: false
    });
  }
}

// Call seed immediately
initCompanySettings().catch(err => {
  console.error("Failed to initialize company settings:", err);
});
