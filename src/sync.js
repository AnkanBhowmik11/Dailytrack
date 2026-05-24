import { db } from './db';
import { getCurrentSession } from './auth';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabaseConfig';

// Retrieve active Sync configurations - always returns config since credentials are hardcoded
export async function getSyncConfig() {
  const session = getCurrentSession();
  const settings = await db.companySettings.get('main');
  
  // Sync is active if logged in OR syncEnabled is toggled on in settings
  if (session || (settings && settings.syncEnabled)) {
    return {
      url: SUPABASE_URL.replace(/\/$/, ''),
      key: SUPABASE_ANON_KEY
    };
  }
  return null;
}

// Low-level fetch wrapper for Supabase REST API with user JWT scoping
async function supabaseRequest(table, method, body = null, config) {
  const session = getCurrentSession();
  // Use user JWT access token as authorization bearer if logged in
  const bearerToken = session ? session.accessToken : config.key;

  const headers = {
    'apikey': config.key,
    'Authorization': `Bearer ${bearerToken}`,
    'Content-Type': 'application/json',
    'Prefer': method === 'POST' ? 'resolution=merge-duplicates,return=representation' : 'return=representation'
  };

  const options = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${config.url}/rest/v1/${table}`, options);
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Cloud Sync Failed for [${table}]: ${errText}`);
  }

  if (response.status === 204) return null;
  return await response.json();
}

// 1. Single record push (Upsert) - Called automatically on any local DB write
export async function pushRecordToCloud(table, record) {
  const config = await getSyncConfig();
  if (!config) return; // Sync disabled or user not logged in

  try {
    await supabaseRequest(table, 'POST', record, config);
  } catch (err) {
    console.warn(`Cloud Sync Warning: Failed to push to ${table} (operating offline).`, err.message);
  }
}

// 2. Single record delete - Called automatically on local deletes
export async function deleteRecordInCloud(table, id) {
  const config = await getSyncConfig();
  if (!config) return;

  try {
    const session = getCurrentSession();
    const bearerToken = session ? session.accessToken : config.key;
    
    const response = await fetch(`${config.url}/rest/v1/${table}?id=eq.${id}`, {
      method: 'DELETE',
      headers: {
        'apikey': config.key,
        'Authorization': `Bearer ${bearerToken}`,
      }
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
  } catch (err) {
    console.warn(`Cloud Sync Warning: Failed to delete in ${table} (operating offline).`, err.message);
  }
}

// 3. Complete Two-Way Database Synchronization
export async function synchronizeDatabase() {
  const config = await getSyncConfig();
  if (!config) return { success: false, message: 'Sync not configured or user not logged in.' };

  const session = getCurrentSession();
  const tables = ['sites', 'employees', 'attendance', 'invoices', 'transactions'];
  let syncedCount = 0;

  try {
    for (let table of tables) {
      // A. PULL: Get all records from Supabase cloud database
      let cloudRecords = [];
      try {
        cloudRecords = await supabaseRequest(table, 'GET', null, config) || [];
      } catch (e) {
        console.warn(`Pull failed for ${table}:`, e.message);
        continue; // Skip this table, try next
      }
      
      // B. MERGE: Insert cloud records into local Dexie IndexedDB
      if (cloudRecords.length > 0) {
        await db.transaction('rw', db[table], async () => {
          for (let rec of cloudRecords) {
            await db[table].put(rec);
          }
        });
      }

      // C. PUSH: Get all local records and push them to cloud to merge missing values
      const localRecords = await db[table].toArray();
      if (localRecords.length > 0) {
        try {
          await supabaseRequest(table, 'POST', localRecords, config);
        } catch (e) {
          console.warn(`Push failed for ${table}:`, e.message);
        }
      }
      
      syncedCount += localRecords.length;
    }

    return { 
      success: true, 
      message: `Database successfully synced! Synchronized ${syncedCount} records across all modules.` 
    };
  } catch (err) {
    console.error("Two-way Cloud sync failed:", err);
    return { 
      success: false, 
      message: `Sync connection failed: ${err.message}` 
    };
  }
}
