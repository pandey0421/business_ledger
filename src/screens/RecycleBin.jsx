
import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc, query, where, getDoc } from 'firebase/firestore';
import { Trash2, RefreshCcw, AlertTriangle, FileText, User, ShoppingBag, CreditCard, Menu, X } from 'lucide-react';
import { toast } from 'react-hot-toast';

const RecycleBin = ({ goBack }) => {
    const [activeTab, setActiveTab] = useState('customers');
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [isMobile, setIsMobile] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth <= 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // ... (keep existing fetch and useEffect logic) ...

    const userId = auth.currentUser?.uid;

    // AUTO CLEANUP: Delete items older than 7 days
    useEffect(() => {
        const performAutoCleanup = async () => {
            if (!userId) return;
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            console.log("Running auto-cleanup for items older than:", sevenDaysAgo);

            // Helper to clean collection
            const cleanCollection = async (collName, isSubCollection = false, parentColl = null) => {
                try {
                    if (!isSubCollection) {
                        const q = query(
                            collection(db, 'users', userId, collName),
                            where('isDeleted', '==', true),
                            where('deletedAt', '<=', sevenDaysAgo)
                        );
                        const snapshot = await getDocs(q);
                        if (!snapshot.empty) {
                            console.log(`Found ${snapshot.size} old ${collName} to delete.`);
                            snapshot.docs.forEach(async (d) => {
                                await deleteDoc(doc(db, 'users', userId, collName, d.id));
                            });
                        }
                    }
                } catch (e) {
                    console.error("Auto cleanup error:", e);
                }
            };

            await cleanCollection('customers');
            await cleanCollection('suppliers');
            await cleanCollection('expenses');
        };

        performAutoCleanup();
    }, [userId]);


    const fetchDeletedItems = async () => {
        if (!userId) return;
        setLoading(true);
        setItems([]);
        setMessage('');

        try {
            let fetchedItems = [];

            if (['customers', 'suppliers', 'expenses'].includes(activeTab)) {
                // Fetch Deleted PARENTS
                const q = query(
                    collection(db, 'users', userId, activeTab),
                    where('isDeleted', '==', true)
                );
                const snapshot = await getDocs(q);
                fetchedItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), type: 'parent' }));

            } else {
                // Fetch Deleted ENTRIES (Transactions)
                let parentColl = '';
                if (activeTab === 'customer_entries') parentColl = 'customers';
                else if (activeTab === 'supplier_entries') parentColl = 'suppliers';
                else if (activeTab === 'expense_entries') parentColl = 'expenses';

                // 1. Get Parents
                const parentSnapshot = await getDocs(collection(db, 'users', userId, parentColl));
                const parents = parentSnapshot.docs.map(d => ({ id: d.id, name: d.data().name }));

                // 2. Iterate and fetch deleted ledger entries
                const promises = parents.map(async (p) => {
                    const ledgerRef = collection(db, parentColl, p.id, 'ledger');
                    const qLeadger = query(ledgerRef, where('isDeleted', '==', true));
                    const snap = await getDocs(qLeadger);
                    return snap.docs.map(d => ({
                        id: d.id,
                        ...d.data(),
                        parentId: p.id,
                        parentName: p.name || d.data().parentName || 'Unknown',
                        type: 'entry',
                        collName: parentColl
                    }));
                });

                const results = await Promise.all(promises);
                fetchedItems = results.flat();
            }

            setItems(fetchedItems);
        } catch (err) {
            console.error("Error fetching deleted items:", err);
            setMessage("Failed to load deleted items.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDeletedItems();
    }, [userId, activeTab]);

    const handleRestore = async (item) => {
        if (!userId) return;
        try {
            if (item.type === 'parent') {
                const collectionName = activeTab;
                await updateDoc(doc(db, 'users', userId, collectionName, item.id), {
                    isDeleted: false,
                    deletedAt: null
                });
            } else {
                await updateDoc(doc(db, item.collName, item.parentId, 'ledger', item.id), {
                    isDeleted: false,
                    deletedAt: null
                });
            }

            toast.success("Restored successfully!");
            setItems(items.filter(i => i.id !== item.id));
        } catch (err) {
            console.error(err);
            toast.error("Error restoring item.");
        }
    };

    const handlePermanentDelete = async (item) => {
        if (!window.confirm("This will PERMANENTLY delete this record. Proceed?")) return;

        try {
            if (item.type === 'parent') {
                const collectionName = activeTab;

                const userLedgerRef = collection(db, 'users', userId, collectionName, item.id, 'ledger');
                const userLedgerSnap = await getDocs(userLedgerRef);
                await Promise.all(userLedgerSnap.docs.map(d =>
                    deleteDoc(doc(db, 'users', userId, collectionName, item.id, 'ledger', d.id))
                ));

                const globalLedgerRef = collection(db, collectionName, item.id, 'ledger');
                const globalLedgerSnap = await getDocs(globalLedgerRef);
                await Promise.all(globalLedgerSnap.docs.map(d =>
                    deleteDoc(doc(db, collectionName, item.id, 'ledger', d.id))
                ));

                await deleteDoc(doc(db, 'users', userId, collectionName, item.id));
            } else {
                await deleteDoc(doc(db, item.collName, item.parentId, 'ledger', item.id));
            }

            toast.success("Permanently deleted.");
            setItems(items.filter(i => i.id !== item.id));
        } catch (err) {
            console.error(err);
            toast.error("Error deleting item.");
        }
    };

    const tabs = [
        { id: 'customers', label: 'Customers', icon: <User size={14} /> },
        { id: 'customer_entries', label: 'Cust. Entries', icon: <FileText size={14} /> },
        { id: 'suppliers', label: 'Suppliers', icon: <ShoppingBag size={14} /> },
        { id: 'supplier_entries', label: 'Supp. Entries', icon: <FileText size={14} /> },
        { id: 'expenses', label: 'Expenses', icon: <CreditCard size={14} /> },
        { id: 'expense_entries', label: 'Exp. Entries', icon: <FileText size={14} /> },
    ];

    const activeTabLabel = tabs.find(t => t.id === activeTab)?.label;

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
            display: 'flex', flexDirection: 'column', width: '100%',
            padding: isMobile ? '10px' : '32px', boxSizing: 'border-box', fontFamily: "'Inter', sans-serif"
        }}>
            <div style={{
                maxWidth: '1000px', margin: '0 auto', width: '100%',
                backgroundColor: '#ffffff', borderRadius: '24px', padding: isMobile ? '12px' : '32px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1px solid #f0f0f0',
                boxSizing: 'border-box'
            }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
                    <button onClick={goBack} style={{
                        padding: '8px 16px', borderRadius: '12px', border: 'none', background: 'white',
                        cursor: 'pointer', fontSize: '14px', color: '#1a237e', fontWeight: '600',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.05)', whiteSpace: 'nowrap'
                    }}>← Back</button>
                    <div>
                        <h1 style={{ margin: 0, color: '#1a237e', fontSize: isMobile ? '24px' : '28px', fontWeight: 'bold' }}>Recycle Bin</h1>
                        <p style={{ margin: 0, color: '#546e7a', fontSize: '14px' }}>
                            Items automatically deleted after 7 days
                        </p>
                    </div>
                </div>

                {/* Tabs / Menu Area */}
                {isMobile ? (
                    <div style={{ marginBottom: '24px', position: 'relative' }}>
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            style={{
                                width: '100%',
                                padding: '12px 16px',
                                borderRadius: '12px',
                                border: '1px solid #e0e0e0',
                                background: '#f5f5f5',
                                color: '#1a237e',
                                fontSize: '14px',
                                fontWeight: '600',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                cursor: 'pointer'
                            }}
                        >
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {tabs.find(t => t.id === activeTab)?.icon}
                                Category: {activeTabLabel}
                            </span>
                            {isMenuOpen ? <X size={18} /> : <Menu size={18} />}
                        </button>

                        {isMenuOpen && (
                            <div style={{
                                position: 'absolute',
                                top: '110%',
                                left: 0,
                                width: '100%',
                                background: 'white',
                                borderRadius: '12px',
                                padding: '8px',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                                border: '1px solid #eee',
                                zIndex: 100,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px'
                            }}>
                                {tabs.map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => {
                                            setActiveTab(tab.id);
                                            setIsMenuOpen(false);
                                        }}
                                        style={{
                                            padding: '12px 16px',
                                            borderRadius: '8px',
                                            border: 'none',
                                            background: activeTab === tab.id ? '#1a237e' : 'transparent',
                                            color: activeTab === tab.id ? 'white' : '#546e7a',
                                            cursor: 'pointer',
                                            fontWeight: '600',
                                            display: 'flex', alignItems: 'center', gap: '10px',
                                            textAlign: 'left',
                                            fontSize: '14px'
                                        }}
                                    >
                                        {tab.icon} {tab.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={{
                        display: 'flex', gap: '10px', marginBottom: '24px',
                        borderBottom: '1px solid #eee', paddingBottom: '16px',
                        overflowX: 'auto', whiteSpace: 'nowrap', pb: '4px'
                    }}>
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    padding: '8px 16px', borderRadius: '8px', border: 'none',
                                    background: activeTab === tab.id ? '#1a237e' : '#f5f5f5',
                                    color: activeTab === tab.id ? 'white' : '#757575',
                                    cursor: 'pointer', fontWeight: '600',
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    flexShrink: 0
                                }}
                            >
                                {tab.icon} {tab.label}
                            </button>
                        ))}
                    </div>
                )}

                {/* Message */}
                {message && (
                    <div style={{
                        padding: '12px', borderRadius: '8px', background: '#ffebee',
                        color: '#c62828', marginBottom: '20px', fontSize: '14px'
                    }}>
                        {message}
                    </div>
                )}

                {/* Content */}
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#90a4ae' }}>Loading...</div>
                ) : items.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: '#90a4ae', background: '#fafafa', borderRadius: '16px' }}>
                        No deleted items found.
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr' }}>
                        {items.map(item => (
                            <div key={item.id} style={{
                                padding: '16px', borderRadius: '12px', border: '1px solid #eee',
                                background: 'white', display: 'flex', flexDirection: 'column', gap: '8px',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        {item.type === 'parent' ? (
                                            <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#37474f', wordBreak: 'break-word' }}>{item.name}</div>
                                        ) : (
                                            <div>
                                                <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#37474f', wordBreak: 'break-word' }}>
                                                    Rs. {item.amount}
                                                </div>
                                                <div style={{ fontSize: '12px', color: '#546e7a', wordBreak: 'break-word' }}>
                                                    {item.parentName} • {item.date}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <span style={{ fontSize: '11px', color: '#ef5350', background: '#ffebee', padding: '4px 8px', borderRadius: '4px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                        {item.deletedAt?.seconds ? new Date(item.deletedAt.seconds * 1000).toLocaleDateString() : 'Unknown Date'}
                                    </span>
                                </div>

                                <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                                    <button onClick={() => handleRestore(item)} style={{
                                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                        padding: '8px', borderRadius: '8px', border: '1px solid #c8e6c9',
                                        background: '#e8f5e8', color: '#2e7d32', cursor: 'pointer', fontWeight: '600', fontSize: '12px'
                                    }}>
                                        <RefreshCcw size={14} /> Restore
                                    </button>
                                    <button onClick={() => handlePermanentDelete(item)} style={{
                                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                        padding: '8px', borderRadius: '8px', border: '1px solid #ffcdd2',
                                        background: '#ffebee', color: '#c62828', cursor: 'pointer', fontWeight: '600', fontSize: '12px'
                                    }}>
                                        <Trash2 size={14} /> Delete
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default RecycleBin;
