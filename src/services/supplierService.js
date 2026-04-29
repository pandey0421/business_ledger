import { db, syncManager } from './offlineSync';
import { authService } from './authService';

export const supplierService = {
   async getSuppliers() {
      const user = (await authService.getCurrentUser()).data.user;
      if (!user) throw new Error("Unauthenticated");

      return await db.suppliers
         .where('user_id')
         .equals(user.id)
         .and(s => !s.is_deleted)
         .toArray();
   },

   async addSupplier(supplierData) {
      const user = (await authService.getCurrentUser()).data.user;
      if (!user) throw new Error("Unauthenticated");

      return await syncManager.pushMutation('suppliers', 'INSERT', {
         ...supplierData,
         user_id: user.id,
         total_purchases: 0,
         total_paid: 0,
         total_balance: 0,
         is_deleted: false,
         created_at: new Date().toISOString(),
         updated_at: new Date().toISOString()
      });
   },

   async updateSupplier(id, data) {
      const user = (await authService.getCurrentUser()).data.user;
      if (!user) throw new Error("Unauthenticated");

      const existing = await db.suppliers.get(id);

      return await syncManager.pushMutation('suppliers', 'UPDATE', {
         ...(existing || {}),
         ...data,
         id,
         user_id: user.id,
         updated_at: new Date().toISOString()
      });
   },

   async deleteSupplier(id) {
      const user = (await authService.getCurrentUser()).data.user;
      if (!user) throw new Error("Unauthenticated");

      const existing = await db.suppliers.get(id);

      return await syncManager.pushMutation('suppliers', 'DELETE', {
         ...(existing || {}),
         id,
         user_id: user.id,
         updated_at: new Date().toISOString()
      });
   },

   async getSupplierLedger(supplierId) {
      const user = (await authService.getCurrentUser()).data.user;
      if (!user) throw new Error("Unauthenticated");

      const entries = await db.supplier_ledger
         .where('supplier_id')
         .equals(supplierId)
         .and(entry => !entry.is_deleted && entry.user_id === user.id)
         .toArray();

      return entries.sort((a, b) => new Date(b.date) - new Date(a.date));
   },

   async getSupplierLedgerCount(supplierId) {
      const user = (await authService.getCurrentUser()).data.user;
      if (!user) throw new Error("Unauthenticated");

      return await db.supplier_ledger
         .where('supplier_id')
         .equals(supplierId)
         .and(entry => !entry.is_deleted && entry.user_id === user.id)
         .count();
   },

   async addLedgerEntry(supplierId, entryData) {
      const user = (await authService.getCurrentUser()).data.user;
      if (!user) throw new Error("Unauthenticated");

      return await syncManager.pushMutation('supplier_ledger', 'INSERT', {
         ...entryData,
         supplier_id: supplierId,
         user_id: user.id,
         is_deleted: false,
         created_at: new Date().toISOString(),
         updated_at: new Date().toISOString()
      });
   },

   async updateLedgerEntry(entryId, entryData) {
      const user = (await authService.getCurrentUser()).data.user;
      if (!user) throw new Error("Unauthenticated");

      const existing = await db.supplier_ledger.get(entryId);

      return await syncManager.pushMutation('supplier_ledger', 'UPDATE', {
         ...(existing || {}),
         ...entryData,
         id: entryId,
         user_id: user.id,
         updated_at: new Date().toISOString()
      });
   },

   async deleteLedgerEntry(supplierId, entryId) {
      const user = (await authService.getCurrentUser()).data.user;
      if (!user) throw new Error("Unauthenticated");

      const existing = await db.supplier_ledger.get(entryId);

      return await syncManager.pushMutation('supplier_ledger', 'DELETE', {
         ...(existing || {}),
         id: entryId,
         supplier_id: supplierId,
         user_id: user.id,
         updated_at: new Date().toISOString()
      });
   }
};
