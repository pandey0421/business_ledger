import React, { useState } from 'react';
import { db, auth } from '../firebase';
import { collection, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { toast } from 'react-hot-toast';

const DataMigration = ({ goBack }) => {
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [logs, setLogs] = useState([]);

    const addLog = (msg) => setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);

    const migrateCustomers = async () => {
        const userId = auth.currentUser?.uid;
        if (!userId) return;

        addLog('Fetching list from Users Subcollection...');
        const custSnapshot = await getDocs(collection(db, 'users', userId, 'customers'));
        const customers = custSnapshot.docs;

        addLog(`Found ${customers.length} customers in your list.`);

        const total = customers.length;
        if (total === 0) {
            setProgress(50);
            return;
        }

        let processed = 0;

        for (const customerDoc of customers) {
            const custData = customerDoc.data();
            const custId = customerDoc.id;

            if (custData.isDeleted) {
                processed++;
                continue;
            }

            // Ledger is at Root level: customers/{id}/ledger
            const ledgerSnapshot = await getDocs(collection(db, 'customers', custId, 'ledger'));

            let totalBalance = 0;
            let totalSales = 0;
            let totalReceived = 0;
            let lastActivityDate = null;

            ledgerSnapshot.docs.forEach(entryDoc => {
                const entry = entryDoc.data();
                if (entry.isDeleted) return;

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

            // Update ROOT customer doc (Used by Ledger Screen)
            // USE setDoc with merge:true in case root doc was phantom (missing)
            // CRITICAL: Include userId so security rules allow reading it!
            const updatePayload = {
                userId, // Ensure ownership is set
                totalBalance,
                totalSales,
                totalReceived,
                lastActivityDate: lastActivityDate || custData.lastActivityDate || null,
                migrationStatus: 'balance_fixed_v6'
            };

            try {
                // Ensure root document exists!
                await setDoc(doc(db, 'customers', custId), updatePayload, { merge: true });
            } catch (e) {
                console.warn(`Could not update root customer ${custId}`, e);
            }

            // Update USER Subcollection doc (Used by List Screen)
            // UpdateDoc is fine here because we just read it, so we know it exists
            try {
                await updateDoc(doc(db, 'users', userId, 'customers', custId), updatePayload);
            } catch (e) {
                console.warn(`Could not update subcollection customer ${custId}`, e);
            }

            processed++;
            const currentPercent = Math.round((processed / total) * 50);
            setProgress(currentPercent);
            addLog(`Updated ${custData.name}: Sales=${totalSales}, Rcv=${totalReceived}`);
        }
    };

    const migrateSuppliers = async () => {
        const userId = auth.currentUser?.uid;
        if (!userId) return;

        addLog('Fetching list from Users Subcollection...');
        const suppSnapshot = await getDocs(collection(db, 'users', userId, 'suppliers'));
        const suppliers = suppSnapshot.docs;

        addLog(`Found ${suppliers.length} suppliers in your list.`);

        const total = suppliers.length;
        if (total === 0) {
            setProgress(100);
            return;
        }

        let processed = 0;

        for (const supplierDoc of suppliers) {
            const suppData = supplierDoc.data();
            const suppId = supplierDoc.id;

            const ledgerSnapshot = await getDocs(collection(db, 'suppliers', suppId, 'ledger'));

            let totalBalance = 0;
            let totalPurchases = 0;
            let totalPaid = 0;

            ledgerSnapshot.docs.forEach(entryDoc => {
                const entry = entryDoc.data();
                if (entry.isDeleted) return;

                const val = Number(entry.amount) || 0;
                if (entry.type === 'purchase') {
                    totalBalance += val;
                    totalPurchases += val;
                } else {
                    totalBalance -= val;
                    totalPaid += val;
                }
            });

            // Update ROOT supplier doc
            const updatePayload = {
                userId,
                totalBalance,
                totalPurchases,
                totalPaid,
                migrationStatus: 'balance_fixed_v6'
            };

            try {
                // Ensure root document exists!
                await setDoc(doc(db, 'suppliers', suppId), updatePayload, { merge: true });
            } catch (e) {
                console.warn(`Could not update root supplier ${suppId}`, e);
            }

            try {
                await updateDoc(doc(db, 'users', userId, 'suppliers', suppId), updatePayload);
            } catch (e) {
                console.warn(`Could not update subcollection supplier ${suppId}`, e);
            }

            processed++;
            const currentPercent = 50 + Math.round((processed / total) * 50);
            setProgress(currentPercent);
            addLog(`Updated ${suppData.name}: Pur=${totalPurchases}, Pd=${totalPaid}`);
        }
    };

    const startMigration = async () => {
        if (!window.confirm("This will recalculate balances for ALL customers and suppliers. Continue?")) return;

        setLoading(true);
        setLogs([]);
        setProgress(0);

        try {
            await migrateCustomers();
            await migrateSuppliers();
            toast.success("Migration Completed!");
            addLog("DONE. Check your Dashboards.");
        } catch (err) {
            console.error(err);
            addLog(`ERROR: ${err.message}`);
            toast.error("Fixed failed. See logs.");
        } finally {
            setLoading(false);
            setProgress(100);
        }
    };

    return (
        <div style={{
            padding: '40px', maxWidth: '800px', margin: '0 auto', fontFamily: "'Inter', sans-serif",
            position: 'relative', zIndex: 9999, backgroundColor: '#f5f7fa', minHeight: '100vh',
            top: 0, left: 0
        }}>
            <button onClick={goBack} style={{ marginBottom: '20px', cursor: 'pointer', border: 'none', background: 'transparent', fontSize: '16px', color: '#555' }}>
                ← Back to Dashboard
            </button>

            <div style={{
                background: 'white', borderRadius: '16px', padding: '32px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
            }}>
                <h1 style={{ marginTop: 0, color: '#1a237e' }}>Data Migration Utility (v5)</h1>
                <p style={{ color: '#546e7a', lineHeight: '1.6' }}>
                    Use this tool to recalculate the <strong>Total Balance</strong> field for all Customers and Suppliers.
                    This is required after the "Scalable Ledger" update to ensure the main dashboard and ledger headers show the correct amounts.
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
