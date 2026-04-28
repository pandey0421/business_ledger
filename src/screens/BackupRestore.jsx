import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { db, syncManager } from '../services/offlineSync';
import { authService } from '../services/authService';

const BackupRestore = ({ goBack }) => {
    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState([]);

    const addLog = (msg) => setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);

    // --- EXPORT FUNCTIONALITY ---
    const handleExport = async () => {
        const currentUserResponse = await authService.getCurrentUser();
        const userId = currentUserResponse?.data?.user?.id;
        
        if (!userId) return toast.error("Not logged in");

        if (!window.confirm("Download all data to a JSON file?")) return;

        setLoading(true);
        setLogs([]);
        addLog("Starting Export...");

        try {
            addLog("Fetching Data from Local Cache...");
            const masterData = {
                version: 2, // V2 corresponds to Supabase/Dexie relational schema
                exportedAt: new Date().toISOString(),
                userId: userId,
                userProfile: {},
                
                customers: await db.customers.where('user_id').equals(userId).toArray(),
                suppliers: await db.suppliers.where('user_id').equals(userId).toArray(),
                expenses: await db.expenses.where('user_id').equals(userId).toArray(),
                products: await db.products.where('user_id').equals(userId).toArray(),
                
                customer_ledger: await db.customer_ledger.where('user_id').equals(userId).toArray(),
                supplier_ledger: await db.supplier_ledger.where('user_id').equals(userId).toArray(),
                expense_ledger: await db.expense_ledger.where('user_id').equals(userId).toArray()
            };

            addLog(`Exported ${masterData.customers.length} customers.`);
            addLog(`Exported ${masterData.suppliers.length} suppliers.`);
            addLog(`Exported ${masterData.expenses.length} expenses.`);
            addLog(`Exported ${masterData.products.length} products.`);
            addLog(`Exported ${masterData.customer_ledger.length + masterData.supplier_ledger.length + masterData.expense_ledger.length} total ledger entries.`);

            // Trigger Download
            const jsonString = JSON.stringify(masterData, null, 2);
            const blob = new Blob([jsonString], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `karobar_khata_backup_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            addLog("Download Started!");
            toast.success("Export Complete");

        } catch (err) {
            console.error(err);
            addLog(`Error: ${err.message}`);
            toast.error("Export Failed");
        } finally {
            setLoading(false);
        }
    };

    // --- IMPORT FUNCTIONALITY ---
    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            const content = e.target.result;
            try {
                const data = JSON.parse(content);
                await runImport(data);
            } catch (err) {
                toast.error("Invalid JSON file");
                addLog("Error parsing JSON");
            }
        };
        reader.readAsText(file);
    };

    const runImport = async (data) => {
        const currentUserResponse = await authService.getCurrentUser();
        const userId = currentUserResponse?.data?.user?.id;
        if (!userId) return toast.error("Not logged in");

        if (!window.confirm(`Ready to import data. This will overwrite/add data to the CURRENT database.`)) return;

        setLoading(true);
        setLogs([]);
        addLog("Starting Import...");

        try {
            if (data.version === 2) {
                // V2 Direct Import
                addLog('Importing V2 format...');
                if (data.customers) {
                    for (const c of data.customers) await syncManager.pushMutation('customers', 'INSERT', { ...c, user_id: userId });
                }
                if (data.suppliers) {
                    for (const s of data.suppliers) await syncManager.pushMutation('suppliers', 'INSERT', { ...s, user_id: userId });
                }
                if (data.expenses) {
                    for (const e of data.expenses) await syncManager.pushMutation('expenses', 'INSERT', { ...e, user_id: userId });
                }
                if (data.products) {
                    for (const p of data.products) await syncManager.pushMutation('products', 'INSERT', { ...p, user_id: userId });
                }
                
                if (data.customer_ledger) {
                    for (const l of data.customer_ledger) await syncManager.pushMutation('customer_ledger', 'INSERT', { ...l, user_id: userId });
                }
                if (data.supplier_ledger) {
                    for (const l of data.supplier_ledger) await syncManager.pushMutation('supplier_ledger', 'INSERT', { ...l, user_id: userId });
                }
                if (data.expense_ledger) {
                    for (const l of data.expense_ledger) await syncManager.pushMutation('expense_ledger', 'INSERT', { ...l, user_id: userId });
                }
            } else {
                // V1 (Legacy Nested) to V2 mapping
                addLog('Upgrading V1 Backup format to V2 schema...');
                
                // 1. Customers
                for (const cust of data.customers || []) {
                    const cData = { id: cust.id, ...cust.data, user_id: userId };
                    await syncManager.pushMutation('customers', 'INSERT', cData);

                    for (const entry of cust.ledger || []) {
                        const lData = { id: entry.id, ...entry, customer_id: cust.id, user_id: userId };
                        await syncManager.pushMutation('customer_ledger', 'INSERT', lData);
                    }
                }

                // 2. Suppliers
                for (const supp of data.suppliers || []) {
                    const sData = { id: supp.id, ...supp.data, user_id: userId };
                    await syncManager.pushMutation('suppliers', 'INSERT', sData);

                    for (const entry of supp.ledger || []) {
                        const lData = { id: entry.id, ...entry, supplier_id: supp.id, user_id: userId };
                        await syncManager.pushMutation('supplier_ledger', 'INSERT', lData);
                    }
                }

                // 3. Expenses
                for (const exp of data.expenses || []) {
                    const eData = { id: exp.id, ...(exp.data || exp), user_id: userId };
                    await syncManager.pushMutation('expenses', 'INSERT', eData);

                    for (const entry of exp.ledger || []) {
                        const lData = { id: entry.id, ...entry, expense_id: exp.id, user_id: userId };
                        await syncManager.pushMutation('expense_ledger', 'INSERT', lData);
                    }
                }
            }

            addLog("Import Finished Successfully! Your data is queued to sync with Supabase.");
            toast.success("Data Imported!");

        } catch (err) {
            console.error(err);
            addLog(`Import Error: ${err.message}`);
            toast.error("Import Failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            padding: '40px', maxWidth: '800px', margin: '0 auto', fontFamily: "'Inter', sans-serif",
            backgroundColor: '#f5f7fa', minHeight: '100vh'
        }}>
            <button onClick={goBack} style={{ marginBottom: '20px', cursor: 'pointer', border: 'none', background: 'transparent', fontSize: '16px', color: '#555' }}>
                ← Back
            </button>

            <div style={{
                background: 'white', borderRadius: '16px', padding: '32px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
            }}>
                <h1 style={{ marginTop: 0, color: '#1a237e' }}>Backup & Restore</h1>
                <p style={{ color: '#546e7a' }}>Move your data between projects or save a local copy.</p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '32px' }}>
                    {/* EXPORT */}
                    <div style={{ padding: '24px', background: '#e3f2fd', borderRadius: '12px', border: '1px solid #bbdefb' }}>
                        <h3 style={{ margin: '0 0 16px 0', color: '#0d47a1' }}>1. Export Data</h3>
                        <p style={{ fontSize: '14px', color: '#546e7a', marginBottom: '24px' }}>
                            Downloads all Customers, Suppliers, Ledgers, and Expenses as a single JSON file.
                        </p>
                        <button
                            onClick={handleExport}
                            disabled={loading}
                            style={{
                                width: '100%', padding: '12px', background: '#1976d2', color: 'white',
                                border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer'
                            }}
                        >
                            {loading ? 'Processing...' : 'Download JSON'}
                        </button>
                    </div>

                    {/* IMPORT */}
                    <div style={{ padding: '24px', background: '#e8f5e9', borderRadius: '12px', border: '1px solid #c8e6c9' }}>
                        <h3 style={{ margin: '0 0 16px 0', color: '#1b5e20' }}>2. Import Data</h3>
                        <p style={{ fontSize: '14px', color: '#546e7a', marginBottom: '24px' }}>
                            Uploads a previously exported JSON file to the CURRENT database.
                        </p>
                        <input
                            type="file"
                            accept=".json"
                            onChange={handleFileSelect}
                            disabled={loading}
                            id="file-upload"
                            style={{ display: 'none' }}
                        />
                        <label
                            htmlFor="file-upload"
                            style={{
                                display: 'block', width: '100%', padding: '12px', background: '#2e7d32', color: 'white',
                                border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', textAlign: 'center',
                                boxSizing: 'border-box'
                            }}
                        >
                            {loading ? 'Processing...' : 'Select File & Upload'}
                        </label>
                    </div>
                </div>

                {/* LOGS */}
                <div style={{
                    marginTop: '32px', background: '#263238', color: '#eceff1',
                    padding: '16px', borderRadius: '8px', height: '200px', overflowY: 'auto',
                    fontFamily: 'monospace', fontSize: '12px'
                }}>
                    {logs.length === 0 ? <span style={{ opacity: 0.5 }}>Logs will appear here...</span> : logs.map((l, i) => (
                        <div key={i} style={{ borderBottom: '1px solid #37474f', padding: '4px 0' }}>{l}</div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default BackupRestore;
