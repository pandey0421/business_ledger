import { useMemo } from 'react';

// Utility function to calculate bad debt
export const calculateBadDebt = (entries) => {
    if (!entries || entries.length === 0) {
        return { hasBadDebt: false, badDebtAmount: 0, oldestUnpaidDate: null };
    }

    // 1. Calculate total lifetime payments
    let totalPaymentsAvailable = entries
        .filter(e => e.type === 'payment')
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    // 2. Get all sales chronologically (oldest first)
    const sales = entries
        .filter(e => e.type === 'sale')
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    let badDebtTotal = 0;
    let oldestBadDebtDate = null;
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    // 3. FIFO Matching
    for (const sale of sales) {
        const saleAmount = Number(sale.amount) || 0;
        const saleDate = new Date(sale.date);
        saleDate.setHours(0, 0, 0, 0);

        if (totalPaymentsAvailable >= saleAmount) {
            // Fully covered
            totalPaymentsAvailable -= saleAmount;
        } else {
            // Partially covered or not covered at all
            const remainingSaleDebt = saleAmount - totalPaymentsAvailable;
            totalPaymentsAvailable = 0; // Exhausted payments

            // Check if this unpaid portion is "Bad Debt" (older than 6 months)
            if (saleDate < sixMonthsAgo) {
                badDebtTotal += remainingSaleDebt;
                if (!oldestBadDebtDate) {
                    oldestBadDebtDate = sale.date;
                }
            }
        }
    }

    return {
        hasBadDebt: badDebtTotal > 0,
        badDebtAmount: badDebtTotal,
        oldestUnpaidDate: oldestBadDebtDate
    };
};

// React Hook
export const useBadDebt = (entries) => {
    return useMemo(() => calculateBadDebt(entries), [entries]);
};
