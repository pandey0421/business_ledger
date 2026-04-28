import * as XLSX from 'xlsx';
import { db } from '../services/offlineSync';

export const backupUserData = async (userId) => {
    if (!userId) return false;

    try {
        const wb = XLSX.utils.book_new();
        const timestamp = new Date().toISOString().split('T')[0];

        // 1. CUSTOMERS
        const customers = (await db.customers.where('user_id').equals(userId).toArray())
            .filter(c => !c.is_deleted)
            .map(d => ({
                Name: d.name,
                Phone: d.phone || '',
                'Total Sales': d.totalSales || d.total_sales || 0,
                'Total Received': d.totalReceived || d.total_received || 0,
                'Current Balance': d.totalBalance || d.total_balance || 0,
                'Last Activity': d.lastActivityDate || d.last_activity_date || ''
            }));
        if (customers.length > 0) {
            const wsCust = XLSX.utils.json_to_sheet(customers);
            XLSX.utils.book_append_sheet(wb, wsCust, "Customers");
        }

        // 2. SUPPLIERS
        const suppliers = (await db.suppliers.where('user_id').equals(userId).toArray())
            .filter(s => !s.is_deleted)
            .map(d => ({
                Name: d.name,
                Phone: d.phone || '',
                'Total Purchases': d.totalPurchases || d.total_purchases || 0,
                'Total Paid': d.totalPaid || d.total_paid || 0,
                'Current Balance': d.totalBalance || d.total_balance || 0
            }));
        if (suppliers.length > 0) {
            const wsSupp = XLSX.utils.json_to_sheet(suppliers);
            XLSX.utils.book_append_sheet(wb, wsSupp, "Suppliers");
        }

        // 3. INVENTORY
        const products = (await db.products.where('user_id').equals(userId).toArray())
            .filter(p => !p.is_deleted)
            .map(d => ({
                Name: d.n || d.name,
                Unit: d.u || d.unit,
                'Cost Price': d.cp || d.cost_price,
                'Selling Price': d.sp || d.selling_price,
                'Quantity': d.qty || d.quantity
            }));
        if (products.length > 0) {
            const wsProd = XLSX.utils.json_to_sheet(products);
            XLSX.utils.book_append_sheet(wb, wsProd, "Inventory");
        }

        // 4. EXPENSES
        const expenses = (await db.expenses.where('user_id').equals(userId).toArray())
            .filter(e => !e.is_deleted)
            .map(d => ({
                Category: d.name,
                'Total Spent': d.totalAmount || d.total_amount || 0
            }));
        if (expenses.length > 0) {
            const wsExp = XLSX.utils.json_to_sheet(expenses);
            XLSX.utils.book_append_sheet(wb, wsExp, "Expenses");
        }

        // WRITE FILE
        XLSX.writeFile(wb, `Business_Backup_${timestamp}.xlsx`);
        return true;

    } catch (error) {
        console.error("Backup Failed:", error);
        throw error;
    }
};
