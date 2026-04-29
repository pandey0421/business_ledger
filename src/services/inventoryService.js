import { db, syncManager } from './offlineSync';
import { authService } from './authService';

export const inventoryService = {
  async getProducts() {
     const user = (await authService.getCurrentUser()).data.user;
     if (!user) throw new Error("Unauthenticated");

     return await db.products
         .where('user_id')
         .equals(user.id)
         .and(p => !p.is_deleted)
         .reverse()
         .sortBy('created_at');
  },

  async getMergedProducts() {
      const products = await this.getProducts();
      const map = new Map();

      products.forEach(p => {
          const normalizedName = p.n ? p.n.trim().toLowerCase() : '';
          if (!normalizedName) return;

          const pQty = Number(p.qty) || 0;
          const pCp = Number(p.cp) || 0;
          const pSp = Number(p.sp) || 0;

          if (map.has(normalizedName)) {
              const existing = map.get(normalizedName);
              const newTotalQty = existing.qty + pQty;

              if (newTotalQty > 0) {
                  existing.cp = ((existing.cp * existing.qty) + (pCp * pQty)) / newTotalQty;
                  existing.sp = ((existing.sp * existing.qty) + (pSp * pQty)) / newTotalQty;
              }

              existing.qty = newTotalQty;
              existing.ids.push(p.id);
          } else {
              map.set(normalizedName, {
                  ...p,
                  ids: [p.id],
                  qty: pQty,
                  cp: pCp,
                  sp: pSp
              });
          }
      });

      return Array.from(map.values()).map(p => ({
          ...p,
          cp: Math.round(p.cp * 100) / 100,
          sp: Math.round(p.sp * 100) / 100
      }));
  },

  async getProductById(id) {
     const user = (await authService.getCurrentUser()).data.user;
     if (!user) throw new Error("Unauthenticated");

     return await db.products.get(id);
  },

  async addProduct(productData) {
     const user = (await authService.getCurrentUser()).data.user;
     if (!user) throw new Error("Unauthenticated");

     return await syncManager.pushMutation('products', 'INSERT', {
        ...productData,
        user_id: user.id,
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
     });
  },

  async updateProduct(id, data) {
     const user = (await authService.getCurrentUser()).data.user;
     if (!user) throw new Error("Unauthenticated");

     const existing = await db.products.get(id);

     return await syncManager.pushMutation('products', 'UPDATE', {
        ...(existing || {}),
        ...data,
        id,
        user_id: user.id,
        updated_at: new Date().toISOString()
     });
  },

  async deleteProduct(id) {
     const user = (await authService.getCurrentUser()).data.user;
     if (!user) throw new Error("Unauthenticated");

     const existing = await db.products.get(id);

     return await syncManager.pushMutation('products', 'DELETE', {
        ...(existing || {}),
        id,
        user_id: user.id,
        updated_at: new Date().toISOString()
     });
  }
};
