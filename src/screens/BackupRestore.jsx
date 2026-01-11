import React, { useState } from 'react';
import { db, auth } from '../firebase';
import { collection, getDocs, doc, setDoc, writeBatch } from 'firebase/firestore';
import { toast } from 'react-hot-toast';

const BackupRestore = ({ goBack }) => {
    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState([]);

    const addLog = (msg) => setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);

    // --- EXPORT FUNCTIONALITY ---
    const handleExport = async () => {
        const userId = auth.currentUser?.uid;
        if (!userId) return toast.error("Not logged in");

        if (!window.confirm("Download all data to a JSON file?")) return;

        setLoading(true);
        setLogs([]);
        addLog("Starting Export...");

        try {
            const masterData = {
                version: 1,
                exportedAt: new Date().toISOString(),
                userId: userId,
                userProfile: {},
                customers: [],
                suppliers: [],
                expenses: []
            };

            // 1. User Profile
            addLog("Fetching User Profile...");
            // We usually don't store much in 'users/{uid}' other than subcollections, but let's check.
            // (If you access it in other screens)

            // 2. Customers & Ledgers
            addLog("Fetching Customers...");
            const custSnap = await getDocs(collection(db, 'users', userId, 'customers'));
            for (const cDoc of custSnap.docs) {
                const cData = cDoc.data();
                // Fetch Ledger for this customer (Root Collection Pattern: customers/{id}/ledger)
                const ledgerSnap = await getDocs(collection(db, 'customers', cDoc.id, 'ledger'));
                const ledgerEntries = ledgerSnap.docs.map(d => ({ id: d.id, ...d.data() }));

                // Fetch Root Customer Data (to ensure we have the latest totals etc)
                // Note: The app uses 'users/{uid}/customers' for list, and 'customers/{id}' for details/ledger root.
                // We should probably export the ROOT customer data as primary.

                masterData.customers.push({
                    id: cDoc.id,
                    data: cData, // This is the user-linked data
                    // We might need to fetch the actual root 'customers/{id}' if it has different data?
                    // Assuming they satisfy the same schema mostly.
                    ledger: ledgerEntries
                });
            }
            addLog(`Exported ${masterData.customers.length} customers.`);

            // 3. Suppliers & Ledgers
            addLog("Fetching Suppliers...");
            const suppSnap = await getDocs(collection(db, 'users', userId, 'suppliers'));
            for (const sDoc of suppSnap.docs) {
                const sData = sDoc.data();
                const ledgerSnap = await getDocs(collection(db, 'suppliers', sDoc.id, 'ledger'));
                const ledgerEntries = ledgerSnap.docs.map(d => ({ id: d.id, ...d.data() }));

                masterData.suppliers.push({
                    id: sDoc.id,
                    data: sData,
                    ledger: ledgerEntries
                });
            }
            addLog(`Exported ${masterData.suppliers.length} suppliers.`);

            // 4. Expenses
            addLog("Fetching Expenses (and their ledgers)...");
            const expSnap = await getDocs(collection(db, 'users', userId, 'expenses'));

            for (const eDoc of expSnap.docs) {
                const eData = eDoc.data();
                // Check User Scope first
                let ledgerRef = collection(db, 'users', userId, 'expenses', eDoc.id, 'ledger');
                let ledgerSnap = await getDocs(ledgerRef);

                const ledgerEntries = ledgerSnap.docs.map(d => ({ id: d.id, ...d.data() }));

                masterData.expenses.push({
                    id: eDoc.id,
                    data: eData,
                    ledger: ledgerEntries
                });
            }
            addLog(`Exported ${masterData.expenses.length} expense categories.`);

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
        const userId = auth.currentUser?.uid;
        if (!userId) return toast.error("Not logged in");

        if (!window.confirm(`Ready to import:\n${data.customers.length} Customers\n${data.suppliers.length} Suppliers\n${data.expenses.length} Expenses\n\nThis will overwrite/add data to the CURRENT database.`)) return;

        setLoading(true);
        setLogs([]);
        addLog("Starting Import...");

        try {
            // Helper to batch writes (Limit 500 ops per batch)
            // Simpler approach for now: sequential awaits or smaller chunks.
            // We will use setDoc(merge: true) to be safe.

            // 1. Customers
            for (const cust of data.customers) {
                addLog(`Importing Customer: ${cust.data.name || cust.id}...`);

                // A. Link to User
                await setDoc(doc(db, 'users', userId, 'customers', cust.id), {
                    ...cust.data,
                    userId // ensure ownership in new DB
                }, { merge: true });

                // B. Create Root Doc
                await setDoc(doc(db, 'customers', cust.id), {
                    ...cust.data,
                    userId
                }, { merge: true });

                // C. Ledger Entries
                const ledgerRef = collection(db, 'customers', cust.id, 'ledger');
                // We should probably use batch here for speed, but loop is safer for now.
                for (const entry of cust.ledger) {
                    await setDoc(doc(ledgerRef, entry.id), entry, { merge: true });
                }
            }

            // 2. Suppliers
            for (const supp of data.suppliers) {
                addLog(`Importing Supplier: ${supp.data.name || supp.id}...`);

                await setDoc(doc(db, 'users', userId, 'suppliers', supp.id), {
                    ...supp.data,
                    userId
                }, { merge: true });

                await setDoc(doc(db, 'suppliers', supp.id), {
                    ...supp.data,
                    userId
                }, { merge: true });

                const ledgerRef = collection(db, 'suppliers', supp.id, 'ledger');
                for (const entry of supp.ledger) {
                    await setDoc(doc(ledgerRef, entry.id), entry, { merge: true });
                }
            }

            // 3. Expenses
            for (const exp of data.expenses) {
                const catName = exp.data ? exp.data.name : exp.name; // Handle potential structure variance
                addLog(`Importing Expense: ${catName || 'Category'}...`);

                // Create Category Wrapper
                await setDoc(doc(db, 'users', userId, 'expenses', exp.id), {
                    ...(exp.data || exp), // Fallback if old export format
                    userId
                }, { merge: true });

                // Import Ledger
                if (exp.ledger && exp.ledger.length > 0) {
                    const ledgerRef = collection(db, 'users', userId, 'expenses', exp.id, 'ledger');
                    for (const entry of exp.ledger) {
                        await setDoc(doc(ledgerRef, entry.id), entry, { merge: true });
                    }
                }
            }

            addLog("Import Finished Successfully!");
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
