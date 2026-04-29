import Dexie from 'dexie';
import { supabase } from '../supabaseClient';

// 1. Initialize Dexie as a READ CACHE only
export const db = new Dexie('KarobarKhataDB');

db.version(1).stores({
  customers: 'id, user_id, updated_at, is_deleted',
  customer_ledger: 'id, customer_id, user_id, date, is_deleted',
  suppliers: 'id, user_id, updated_at, is_deleted',
  supplier_ledger: 'id, supplier_id, user_id, date, is_deleted',
  products: 'id, user_id, updated_at, is_deleted',
  expenses: 'id, user_id, updated_at, is_deleted',
  expense_ledger: 'id, expense_id, user_id, date, is_deleted',

  // Keep sync_queue definition so Dexie doesn't error on existing DBs, but we won't use it
  sync_queue: '++id, table, operation, payload, created_at, status'
});

// 2. Online-First Data Manager
// All writes go DIRECTLY to Supabase. Dexie is updated after success as a local cache.
export const syncManager = {

  /**
   * Write directly to Supabase, then update local Dexie cache.
   * @param {string} table
   * @param {'INSERT'|'UPDATE'|'DELETE'} operation
   * @param {object} payload
   */
  async pushMutation(table, operation, payload) {
    if (!payload.id) {
      payload.id = crypto.randomUUID();
    }

    // Write to Supabase FIRST (online-first)
    if (operation === 'DELETE') {
      payload.is_deleted = true;
    }

    const { data, error } = await supabase
      .from(table)
      .upsert(payload, { onConflict: 'id' })
      .select();

    if (error) {
      console.error(`[SyncManager] Supabase write failed for ${table}/${operation}:`, error);
      throw new Error(`Failed to save: ${error.message}`);
    }

    // SUCCESS — Now update local Dexie cache
    try {
      await db[table].put(data?.[0] || payload);
    } catch (cacheErr) {
      // Cache update failure is non-critical, log but don't throw
      console.warn(`[SyncManager] Cache update failed for ${table}:`, cacheErr);
    }

    return data?.[0] || payload;
  },

  /**
   * Sync all data DOWN from Supabase into local Dexie cache.
   * This is called on app startup to ensure local cache is fresh.
   */
  async syncDown(userId) {
    if (!navigator.onLine) return;
    try {
      const tables = ['customers', 'customer_ledger', 'suppliers', 'supplier_ledger', 'products', 'expenses', 'expense_ledger'];

      const syncKey = `last_sync_timestamp_${userId}`;
      const lastSync = localStorage.getItem(syncKey);

      // Current sync time minus 1 minute to handle clock skew
      const currentSyncTime = new Date(Date.now() - 60000).toISOString();
      let hasUpdates = false;

      for (let table of tables) {
        let query = supabase.from(table).select('*').eq('user_id', userId);

        if (lastSync) {
          query = query.gte('updated_at', lastSync);
        }

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          await db[table].bulkPut(data);
          hasUpdates = true;
          console.log(`[SyncManager] Pulled ${data.length} records for ${table}`);
        }
      }

      localStorage.setItem(syncKey, currentSyncTime);
      if (hasUpdates) {
        console.log('[SyncManager] Sync down complete.');
      }
    } catch (err) {
      console.error("Failed to sync down:", err);
    }
  }
};
