import Dexie from 'dexie';

// 1. Initialize Dexie Local Database
export const db = new Dexie('KarobarKhataDB');

// Define the local schema (similar to Supabase)
db.version(1).stores({
  customers: 'id, user_id, updated_at, is_deleted',
  customer_ledger: 'id, customer_id, user_id, date, is_deleted',
  suppliers: 'id, user_id, updated_at, is_deleted',
  supplier_ledger: 'id, supplier_id, user_id, date, is_deleted',
  products: 'id, user_id, updated_at, is_deleted',
  expenses: 'id, user_id, updated_at, is_deleted',
  expense_ledger: 'id, expense_id, user_id, date, is_deleted',
  
  // The Sync Queue for offline mutations
  sync_queue: '++id, table, operation, payload, created_at, status' // status: 'pending' | 'failed'
});

// 2. High-level Sync Manager
export const syncManager = {
  /**
   * Pushes a local mutation (optimistic update) into the DB and the Sync Queue
   * @param {string} table 
   * @param {'INSERT'|'UPDATE'|'DELETE'} operation 
   * @param {object} payload 
   */
  async pushMutation(table, operation, payload) {
    if (!payload.id) {
        payload.id = crypto.randomUUID(); // Auto-generate UUID locally!
    }

    try {
        await db.transaction('rw', db[table], db.sync_queue, async () => {
            // Optimistic update locally
            if (operation === 'INSERT' || operation === 'UPDATE') {
                await db[table].put(payload);
            } else if (operation === 'DELETE') {
                payload.is_deleted = true;
                await db[table].put(payload); // Soft delete
            }

            // Push to sync queue
            await db.sync_queue.add({
                table,
                operation,
                payload,
                created_at: Date.now(),
                status: 'pending'
            });
        });
        
        // Attempt background sync if online
        if (navigator.onLine) {
            this.processQueue();
        }

        return payload; // Return updated state to UI
    } catch (err) {
        console.error(`Failed to push mutation for ${table}:`, err);
        throw err;
    }
  },

  /**
   * Flushes the pending sync_queue to Supabase.
   * Processes each pending operation and pushes it to the remote Supabase database.
   */
  async processQueue() {
      if (this.isSyncing) return;
      this.isSyncing = true;

      try {
          const { supabase } = await import('../supabaseClient');
          const pendingOps = await db.sync_queue.filter(op => op.status === 'pending' || op.status === 'failed').toArray();
          if (pendingOps.length === 0) return;

          console.log(`[SyncManager] Processing ${pendingOps.length} pending operations...`);

          for (const op of pendingOps) {
              try {
                  // Always merge the queue payload with the full local record
                  // This ensures required columns (like customer_id) are never missing
                  let fullPayload = { ...op.payload };
                  if (op.payload.id && db[op.table]) {
                      try {
                          const localRecord = await db[op.table].get(op.payload.id);
                          if (localRecord) {
                              fullPayload = { ...localRecord, ...op.payload };
                          }
                      } catch (e) {
                          // If local record not found, proceed with queue payload
                      }
                  }

                  const result = await supabase.from(op.table).upsert(fullPayload, { onConflict: 'id' });

                  if (result?.error) {
                      console.error(`[SyncManager] Failed to sync op ${op.id} (${op.table}/${op.operation}):`, result.error);
                      await db.sync_queue.update(op.id, { status: 'failed' });
                  } else {
                      // Success — remove from queue
                      await db.sync_queue.delete(op.id);
                  }
              } catch (opErr) {
                  console.error(`[SyncManager] Error processing op ${op.id}:`, opErr);
                  await db.sync_queue.update(op.id, { status: 'failed' });
              }
          }

          console.log('[SyncManager] Queue processing complete.');
      } catch (err) {
          console.error("[SyncManager] Sync process failed:", err);
      } finally {
          this.isSyncing = false;
      }
  },

  async syncDown(userId) {
      if (!navigator.onLine) return;
      try {
          const { supabase } = await import('../supabaseClient');
          const tables = ['customers', 'customer_ledger', 'suppliers', 'supplier_ledger', 'products', 'expenses', 'expense_ledger'];
          
          const syncKey = `last_sync_timestamp_${userId}`;
          const lastSync = localStorage.getItem(syncKey);
          
          // Current sync time minus 1 minute to handle clock skew/in-flight transactions
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
                  console.log(`[SyncManager] Pulled ${data.length} new records for ${table}`);
              }
          }
          
          localStorage.setItem(syncKey, currentSyncTime);
          if (hasUpdates) {
             console.log('[SyncManager] Incremental sync down complete.');
          }

          // Push any pending/failed local mutations up to the server
          await this.processQueue();
      } catch (err) {
          console.error("Failed to sync down:", err);
      }
  }
};

window.addEventListener('online', () => {
    console.log("Back online! Processing sync queue...");
    syncManager.processQueue();
});
