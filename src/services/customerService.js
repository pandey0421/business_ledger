import { db, syncManager } from './offlineSync';
import { authService } from './authService';

export const customerService = {
   // Query Customers (from local cache)
   async getCustomers() {
      const user = (await authService.getCurrentUser()).data.user;
      if (!user) throw new Error("Unauthenticated");

      return await db.customers
         .where('user_id')
         .equals(user.id)
         .and(c => !c.is_deleted)
         .toArray();
   },

   async addCustomer(customerData) {
      const user = (await authService.getCurrentUser()).data.user;
      if (!user) throw new Error("Unauthenticated");

      return await syncManager.pushMutation('customers', 'INSERT', {
         ...customerData,
         user_id: user.id,
         total_sales: 0,
         total_received: 0,
         total_balance: 0,
         is_deleted: false,
         created_at: new Date().toISOString(),
         updated_at: new Date().toISOString()
      });
   },

   async updateCustomer(id, data) {
      const user = (await authService.getCurrentUser()).data.user;
      if (!user) throw new Error("Unauthenticated");

      const existing = await db.customers.get(id);
      if (!existing) throw new Error("Customer not found locally");

      return await syncManager.pushMutation('customers', 'UPDATE', {
         ...existing,
         ...data,
         id,
         user_id: user.id,
         updated_at: new Date().toISOString()
      });
   },

   async deleteCustomer(id) {
      const user = (await authService.getCurrentUser()).data.user;
      if (!user) throw new Error("Unauthenticated");

      return await syncManager.pushMutation('customers', 'DELETE', {
         id,
         user_id: user.id,
         updated_at: new Date().toISOString()
      });
   },

   // Ledger Access
   async getCustomerLedger(customerId) {
      const user = (await authService.getCurrentUser()).data.user;
      if (!user) throw new Error("Unauthenticated");

      const entries = await db.customer_ledger
         .where('customer_id')
         .equals(customerId)
         .and(entry => !entry.is_deleted && entry.user_id === user.id)
         .toArray();

      // Sort by date desc
      return entries.sort((a, b) => new Date(b.date) - new Date(a.date));
   },

   async getCustomerLedgerCount(customerId) {
      const user = (await authService.getCurrentUser()).data.user;
      if (!user) throw new Error("Unauthenticated");

      return await db.customer_ledger
         .where('customer_id')
         .equals(customerId)
         .and(entry => !entry.is_deleted && entry.user_id === user.id)
         .count();
   },

   async addLedgerEntry(customerId, entryData) {
      const user = (await authService.getCurrentUser()).data.user;
      if (!user) throw new Error("Unauthenticated");

      return await syncManager.pushMutation('customer_ledger', 'INSERT', {
         ...entryData,
         customer_id: customerId,
         user_id: user.id,
         is_deleted: false,
         created_at: new Date().toISOString(),
         updated_at: new Date().toISOString()
      });
   },

   async updateLedgerEntry(entryId, entryData) {
      const user = (await authService.getCurrentUser()).data.user;
      if (!user) throw new Error("Unauthenticated");

      return await syncManager.pushMutation('customer_ledger', 'UPDATE', {
         id: entryId,
         user_id: user.id,
         ...entryData,
         updated_at: new Date().toISOString()
      });
   },

   async deleteLedgerEntry(customerId, entryId) {
      const user = (await authService.getCurrentUser()).data.user;
      if (!user) throw new Error("Unauthenticated");

      return await syncManager.pushMutation('customer_ledger', 'DELETE', {
         id: entryId,
         customer_id: customerId,
         user_id: user.id,
         updated_at: new Date().toISOString()
      });
   }
};
