import React, { useState } from 'react';
import { db, syncManager } from '../services/offlineSync';
import { authService } from '../services/authService';
import { toast } from 'react-hot-toast';

const DataMigration = ({ goBack }) => {
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [logs, setLogs] = useState([]);

    const addLog = (msg) => setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);

    const migrateCustomers = async (userId) => {
        addLog('Fetching customers from local database...');
        const customers = await db.customers.where('user_id').equals(userId).toArray();

        addLog(`Found ${customers.length} customers.`);

        const total = customers.length;
        if (total === 0) {
            setProgress(50);
            return;
        }

        let processed = 0;

        for (const cust of customers) {
            if (cust.is_deleted) {
                processed++;
                continue;
            }

            // Get all ledger entries for this customer from Dexie
            const ledgerEntries = await db.customer_ledger
                .where('customer_id').equals(cust.id)
                .filter(e => !e.is_deleted)
                .toArray();

            let totalBalance = 0;
            let totalSales = 0;
            let totalReceived = 0;
            let lastActivityDate = null;

            ledgerEntries.forEach(entry => {
                const val = Number(entry.amount) || 0;
                if (entry.type === 'sale') {
                    totalBalance += val;
                    totalSales += val;
                } else {
                    totalBalance -= val;
                    totalReceived += val;
                }

                if (entry.date) {
                    if (!lastActivityDate || entry.date > lastActivityDate) {
                        lastActivityDate = entry.date;
                    }
                }
            });

            // Update customer record via syncManager
            const updatePayload = {
                ...cust,
                total_balance: totalBalance,
                total_sales: totalSales,
                total_received: totalReceived,
                last_activity_date: lastActivityDate || cust.last_activity_date || null,
                migration_status: 'balance_fixed_v6'
            };

            try {
                await syncManager.pushMutation('customers', 'UPDATE', updatePayload);
            } catch (e) {
                console.warn(`Could not update customer ${cust.id}`, e);
            }

            processed++;
            const currentPercent = Math.round((processed / total) * 50);
            setProgress(currentPercent);
            addLog(`Updated ${cust.name}: Sales=${totalSales}, Rcv=${totalReceived}`);
        }
    };

    const migrateSuppliers = async (userId) => {
        addLog('Fetching suppliers from local database...');
        const suppliers = await db.suppliers.where('user_id').equals(userId).toArray();

        addLog(`Found ${suppliers.length} suppliers.`);

        const total = suppliers.length;
        if (total === 0) {
            setProgress(100);
            return;
        }

        let processed = 0;

        for (const supp of suppliers) {
            if (supp.is_deleted) {
                processed++;
                continue;
            }

            const ledgerEntries = await db.supplier_ledger
                .where('supplier_id').equals(supp.id)
                .filter(e => !e.is_deleted)
                .toArray();

            let totalBalance = 0;
            let totalPurchases = 0;
            let totalPaid = 0;

            ledgerEntries.forEach(entry => {
                const val = Number(entry.amount) || 0;
                if (entry.type === 'purchase') {
                    totalBalance += val;
                    totalPurchases += val;
                } else {
                    totalBalance -= val;
                    totalPaid += val;
                }
            });

            const updatePayload = {
                ...supp,
                total_balance: totalBalance,
                total_purchases: totalPurchases,
                total_paid: totalPaid,
                migration_status: 'balance_fixed_v6'
            };

            try {
                await syncManager.pushMutation('suppliers', 'UPDATE', updatePayload);
            } catch (e) {
                console.warn(`Could not update supplier ${supp.id}`, e);
            }

            processed++;
            const currentPercent = 50 + Math.round((processed / total) * 50);
            setProgress(currentPercent);
            addLog(`Updated ${supp.name}: Pur=${totalPurchases}, Pd=${totalPaid}`);
        }
    };

    const startMigration = async () => {
        if (!window.confirm("This will recalculate balances for ALL customers and suppliers. Continue?")) return;

        const { data: { user } } = await authService.getCurrentUser();
        if (!user) {
            toast.error("Not logged in.");
            return;
        }

        setLoading(true);
        setLogs([]);
        setProgress(0);

        try {
            await migrateCustomers(user.id);
            await migrateSuppliers(user.id);
            toast.success("Migration Completed!");
            addLog("DONE. Check your Dashboards.");
        } catch (err) {
            console.error(err);
            addLog(`ERROR: ${err.message}`);
            toast.error("Fix failed. See logs.");
        } finally {
            setLoading(false);
            setProgress(100);
        }
    };

    return (
        <div style={{
            padding: '40px', maxWidth: '800px', margin: '0 auto', fontFamily: "'Inter', sans-serif",
            position: 'relative', zIndex: 9999, backgroundColor: '#f5f7fa', minHeight: '100dvh',
            top: 0, left: 0
        }}>
            <button onClick={goBack} style={{ marginBottom: '20px', cursor: 'pointer', border: 'none', background: 'transparent', fontSize: '16px', color: '#555' }}>
                ← Back to Dashboard
            </button>

            <div style={{
                background: 'white', borderRadius: '16px', padding: '32px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
            }}>
                <h1 style={{ marginTop: 0, color: '#1a237e' }}>Data Migration Utility (v6)</h1>
                <p style={{ color: '#546e7a', lineHeight: '1.6' }}>
                    Use this tool to recalculate the <strong>Total Balance</strong> field for all Customers and Suppliers.
                    This reads from your local database and pushes updates via the sync queue.
                </p>

                <div style={{
                    background: '#fff3e0', padding: '16px', borderRadius: '8px',
                    borderLeft: '4px solid #ef6c00', marginBottom: '24px', color: '#e65100'
                }}>
                    <strong>Note:</strong> This process might take a few minutes if you have thousands of records. Please do not close the app while it runs.
                </div>

                {loading ? (
                    <div style={{ marginBottom: '24px' }}>
                        <div style={{ width: '100%', height: '10px', background: '#e0e0e0', borderRadius: '5px', overflow: 'hidden' }}>
                            <div style={{ width: `${progress}%`, height: '100%', background: '#1a237e', transition: 'width 0.3s' }} />
                        </div>
                        <p style={{ textAlign: 'center', margin: '8px 0 0 0', color: '#1a237e', fontWeight: 'bold' }}>{progress}% Completed</p>
                    </div>
                ) : (
                    <button
                        onClick={startMigration}
                        style={{
                            background: '#1a237e', color: 'white', border: 'none',
                            padding: '16px 32px', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold',
                            cursor: 'pointer', boxShadow: '0 4px 12px rgba(26, 35, 126, 0.3)',
                            width: '100%'
                        }}
                    >
                        Start Balance Recalculation
                    </button>
                )}

                <div style={{
                    marginTop: '32px', background: '#263238', color: '#eceff1',
                    padding: '16px', borderRadius: '8px', height: '300px', overflowY: 'auto',
                    fontFamily: 'monospace', fontSize: '12px'
                }}>
                    {logs.length === 0 ? <span style={{ opacity: 0.5 }}>Waiting to start...</span> : logs.map((l, i) => (
                        <div key={i} style={{ borderBottom: '1px solid #37474f', padding: '4px 0' }}>{l}</div>
                    ))}
                </div>

            </div>
        </div>
    );
};

export default DataMigration;
