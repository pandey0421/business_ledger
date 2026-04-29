import { db, syncManager } from './offlineSync';
import { authService } from './authService';

export const expenseService = {
   async getExpenseCategories() {
      const user = (await authService.getCurrentUser()).data.user;
      if (!user) throw new Error("Unauthenticated");

      return await db.expenses
         .where('user_id')
         .equals(user.id)
         .and(e => !e.is_deleted)
         .toArray();
   },

   async addExpenseCategory(name) {
      const user = (await authService.getCurrentUser()).data.user;
      if (!user) throw new Error("Unauthenticated");

      return await syncManager.pushMutation('expenses', 'INSERT', {
         name,
         user_id: user.id,
         total_amount: 0,
         is_deleted: false,
         created_at: new Date().toISOString(),
         updated_at: new Date().toISOString()
      });
   },

   async updateExpenseCategory(id, name) {
      const user = (await authService.getCurrentUser()).data.user;
      if (!user) throw new Error("Unauthenticated");

      const existing = await db.expenses.get(id);

      return await syncManager.pushMutation('expenses', 'UPDATE', {
         ...(existing || {}),
         id,
         user_id: user.id,
         name,
         updated_at: new Date().toISOString()
      });
   },

   async deleteExpenseCategory(id) {
      const user = (await authService.getCurrentUser()).data.user;
      if (!user) throw new Error("Unauthenticated");

      const existing = await db.expenses.get(id);

      return await syncManager.pushMutation('expenses', 'DELETE', {
         ...(existing || {}),
         id,
         user_id: user.id,
         updated_at: new Date().toISOString()
      });
   },

   async getExpenseLedger(categoryId) {
      const user = (await authService.getCurrentUser()).data.user;
      if (!user) throw new Error("Unauthenticated");

      const entries = await db.expense_ledger
         .where('expense_id')
         .equals(categoryId)
         .and(entry => !entry.is_deleted && entry.user_id === user.id)
         .toArray();

      return entries.sort((a, b) => new Date(b.date) - new Date(a.date));
   },

   async getExpenseLedgerCount(categoryId) {
      const user = (await authService.getCurrentUser()).data.user;
      if (!user) throw new Error("Unauthenticated");

      return await db.expense_ledger
         .where('expense_id')
         .equals(categoryId)
         .and(entry => !entry.is_deleted && entry.user_id === user.id)
         .count();
   },

   async addLedgerEntry(categoryId, entryData) {
      const user = (await authService.getCurrentUser()).data.user;
      if (!user) throw new Error("Unauthenticated");

      return await syncManager.pushMutation('expense_ledger', 'INSERT', {
         ...entryData,
         expense_id: categoryId,
         user_id: user.id,
         is_deleted: false,
         created_at: new Date().toISOString(),
         updated_at: new Date().toISOString()
      });
   },

   async updateLedgerEntry(entryId, entryData) {
      const user = (await authService.getCurrentUser()).data.user;
      if (!user) throw new Error("Unauthenticated");

      const existing = await db.expense_ledger.get(entryId);

      return await syncManager.pushMutation('expense_ledger', 'UPDATE', {
         ...(existing || {}),
         ...entryData,
         id: entryId,
         user_id: user.id,
         updated_at: new Date().toISOString()
      });
   },

   async deleteLedgerEntry(categoryId, entryId) {
      const user = (await authService.getCurrentUser()).data.user;
      if (!user) throw new Error("Unauthenticated");

      const existing = await db.expense_ledger.get(entryId);

      return await syncManager.pushMutation('expense_ledger', 'DELETE', {
         ...(existing || {}),
         id: entryId,
         expense_id: categoryId,
         user_id: user.id,
         updated_at: new Date().toISOString()
      });
   }
};
