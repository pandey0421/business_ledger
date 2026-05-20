import { db } from './offlineSync';
import { authService } from './authService';

export const analyticsService = {
  // Get all customer ledgers for analytics
  async getAllCustomerLedgers() {
     const user = (await authService.getCurrentUser()).data.user;
     if (!user) return [];
     
     return await db.customer_ledger
         .where('user_id')
         .equals(user.id)
         .and(entry => !entry.is_deleted)
         .toArray();
  },

  // Get all supplier ledgers for analytics
  async getAllSupplierLedgers() {
     const user = (await authService.getCurrentUser()).data.user;
     if (!user) return [];
     
     return await db.supplier_ledger
         .where('user_id')
         .equals(user.id)
         .and(entry => !entry.is_deleted)
         .toArray();
  },

  // Get all expense ledgers for analytics
  async getAllExpenseLedgers() {
     const user = (await authService.getCurrentUser()).data.user;
     if (!user) return [];
     
     return await db.expense_ledger
         .where('user_id')
         .equals(user.id)
         .and(entry => !entry.is_deleted)
         .toArray();
  },

  // Get all current products for inventory valuation
  async getAllProducts() {
     const user = (await authService.getCurrentUser()).data.user;
     if (!user) return [];
     
     const rawProds = await db.products
         .where('user_id')
         .equals(user.id)
         .and(p => !p.is_deleted)
         .toArray();
         
     return rawProds.map(p => ({
         ...p,
         n: p.name || p.n,
         u: p.unit || p.u,
         cp: p.cost_price ?? p.cp,
         sp: p.selling_price ?? p.sp,
         qty: p.quantity ?? p.qty
     }));
  },

  // Get all customers for customer stats
  async getAllCustomers() {
     const user = (await authService.getCurrentUser()).data.user;
     if (!user) return [];
     
     return await db.customers
         .where('user_id')
         .equals(user.id)
         .and(c => !c.is_deleted)
         .toArray();
  },

  // Get all suppliers for supplier stats
  async getAllSuppliers() {
     const user = (await authService.getCurrentUser()).data.user;
     if (!user) return [];
     
     return await db.suppliers
         .where('user_id')
         .equals(user.id)
         .and(s => !s.is_deleted)
         .toArray();
  },

  // Get all expenses for expense stats
  async getAllExpenses() {
     const user = (await authService.getCurrentUser()).data.user;
     if (!user) return [];
     
     return await db.expenses
         .where('user_id')
         .equals(user.id)
         .and(e => !e.is_deleted)
         .toArray();
  }
};
