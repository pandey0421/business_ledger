import React, { useEffect, useState } from 'react';
import { collection, addDoc, query, orderBy, limit, startAfter, getDocs, getCountFromServer, serverTimestamp, doc, updateDoc, increment, onSnapshot, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { exportLedgerToPDF, formatIndianCurrency } from '../utils/pdfExport';

const SupplierLedger = ({ supplier, onBack }) => {
  // State for all 3 metrics
  const [realtimeData, setRealtimeData] = useState({
    totalBalance: supplier?.totalBalance || 0,
    totalPurchases: supplier?.totalPurchases || 0,
    totalPaid: supplier?.totalPaid || 0
  });
  const [userInteractedData, setUserInteractedData] = useState(null);

  const formatAmount = (num) => {
    try {
      return new Intl.NumberFormat('en-IN').format(num);
    } catch (e) {
      return num;
    }
  };

  const [amount, setAmount] = useState('');
  const [type, setType] = useState('purchase');
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastVisible, setLastVisible] = useState(null);
  const [totalTransactionCount, setTotalTransactionCount] = useState(0);

  const [editingEntry, setEditingEntry] = useState(null);
  const [message, setMessage] = useState('');

  const [exportStart, setExportStart] = useState('');
  const [exportEnd, setExportEnd] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Mobile check
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Listen to Supplier Parent for Real-time Balance
  useEffect(() => {
    if (!supplier?.id) return;
    const unsub = onSnapshot(doc(db, 'suppliers', supplier.id), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setRealtimeData({
          totalBalance: data.totalBalance || 0,
          totalPurchases: data.totalPurchases || 0,
          totalPaid: data.totalPaid || 0
        });
      }
    });
    return () => unsub();
  }, [supplier?.id]);

  const displayData = userInteractedData || realtimeData;
  const displayBalance = displayData.totalBalance;

  // Initial Fetch
  useEffect(() => {
    const initLedger = async () => {
      if (!supplier?.id) return;
      setLoading(true);
      try {
        const ledgerRef = collection(db, 'suppliers', supplier.id, 'ledger');

        const countSnap = await getCountFromServer(ledgerRef);
        setTotalTransactionCount(countSnap.data().count);

        const q = query(
          ledgerRef,
          orderBy('date', 'desc'),
          limit(10)
        );

        const snap = await getDocs(q);
        const fetchedEntries = snap.docs
          .filter(d => !d.data().isDeleted)
          .map(d => ({ id: d.id, ...d.data() }));

        setEntries(fetchedEntries);
        setLastVisible(snap.docs[snap.docs.length - 1]);
      } catch (err) {
        console.error("Error fetching ledger:", err);
      } finally {
        setLoading(false);
      }
    };
    initLedger();
  }, [supplier?.id]);

  // Robust Recalculation Function
  const recalculateTotals = async (isManual = false) => {
    if (!supplier?.id) return;
    if (!isManual && (loading || totalTransactionCount === 0)) return;
    // If auto-healing, and data already looks good, skip
    if (!isManual && (realtimeData.totalPurchases > 0 || realtimeData.totalPaid > 0)) return;
    // If auto-healing and we already touched it locally, skip
    if (!isManual && userInteractedData) return;

    if (isManual) setMessage('Recalculating totals...');
    console.log(`Starting ${isManual ? 'MANUAL' : 'Auto'} Recalculation...`);

    try {
      const ledgerRef = collection(db, 'suppliers', supplier.id, 'ledger');
      const snap = await getDocs(ledgerRef); // Fetch ALL entries
      let pur = 0, paid = 0, b = 0;
      let lastDate = null;

      snap.docs.forEach(d => {
        const da = d.data();
        if (!da.isDeleted) {
          const v = Number(da.amount) || 0;
          if (da.type === 'purchase') { pur += v; b += v; }
          else { paid += v; b -= v; }
          if (da.date && (!lastDate || da.date > lastDate)) lastDate = da.date;
        }
      });

      // 1. Update UI Immediately
      const newState = { totalPurchases: pur, totalPaid: paid, totalBalance: b };
      setUserInteractedData(newState);

      // 2. Persist to DB (Robust)
      const uid = auth.currentUser?.uid;
      const payload = {
        ...newState,
        userId: uid,
        lastActivityDate: lastDate,
        migrationStatus: 'recalc_v3'
      };

      let rootSuccess = false;
      // Try Update Root
      try {
        await updateDoc(doc(db, 'suppliers', supplier.id), payload);
        rootSuccess = true;
      } catch (e) {
        console.warn("updateDoc failed, trying setDoc", e);
      }

      if (!rootSuccess) {
        try {
          await setDoc(doc(db, 'suppliers', supplier.id), { ...payload, userId: uid }, { merge: true });
          rootSuccess = true;
        } catch (e) {
          console.error("ROOT WRITE FAILED", e);
          if (isManual) alert("Failed to save totals: " + e.message);
        }
      }

      // Try Update User List (Best Effort)
      if (uid) {
        try {
          await updateDoc(doc(db, 'users', uid, 'suppliers', supplier.id), payload);
        } catch (e) {
          // Fallback create
          setDoc(doc(db, 'users', uid, 'suppliers', supplier.id), { ...payload, name: supplier.name || 'Vendor' }, { merge: true }).catch(err => console.error("Subcollection failed", err));
        }
      }

      if (isManual) setMessage('Totals updated successfully');

    } catch (err) {
      console.error("Recalculation failed", err);
      if (isManual) setMessage('Recalculation failed');
    }
  };

  // SELF-HEALING Effect
  useEffect(() => {
    // Slight delay to allow realtime listener to connect first
    const timer = setTimeout(() => recalculateTotals(false), 2000);
    return () => clearTimeout(timer);
  }, [supplier?.id, loading, totalTransactionCount, realtimeData, userInteractedData]);

  const fetchMoreEntries = async () => {
    if (!lastVisible) return;
    setLoadingMore(true);
    try {
      const q = query(
        collection(db, 'suppliers', supplier.id, 'ledger'),
        orderBy('date', 'desc'),
        startAfter(lastVisible),
        limit(10)
      );
      const snap = await getDocs(q);

      if (!snap.empty) {
        const newEntries = snap.docs
          .filter(d => !d.data().isDeleted)
          .map(d => ({ id: d.id, ...d.data() }));

        setEntries(prev => [...prev, ...newEntries]);
        setLastVisible(snap.docs[snap.docs.length - 1]);
      }
    } catch (err) {
      console.error("Error loading more:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  // Helper: Running Balance Logic (Descending View)
  const entriesWithBalance = React.useMemo(() => {
    let currentBal = displayBalance;
    return entries.map(entry => {
      const rowBalance = currentBal;
      const amt = Number(entry.amount) || 0;
      if (entry.type === 'purchase') {
        currentBal -= amt;
      } else {
        currentBal += amt;
      }
      return { ...entry, runningBalance: rowBalance };
    });
  }, [entries, displayBalance]);

  const handleDateChange = (e) => {
    let value = e.target.value.replace(/[^0-9]/g, '');
    if (value.length >= 4) value = value.slice(0, 4) + '-' + value.slice(4);
    if (value.length >= 7) value = value.slice(0, 7) + '-' + value.slice(7);
    setDate(value);
  };

  const handleExportDateChange = (setter) => (e) => {
    let value = e.target.value.replace(/[^0-9]/g, '');
    if (value.length >= 4) value = value.slice(0, 4) + '-' + value.slice(4);
    if (value.length >= 7) value = value.slice(0, 7) + '-' + value.slice(7);
    setter(value);
  };

  const resetForm = () => {
    setAmount('');
    setType('purchase');
    setDate('');
    setNote('');
    setEditingEntry(null);
  };

  const addOrUpdateEntry = async () => {
    if (!amount || !date) {
      setMessage('Amount and date are required');
      return;
    }
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      setMessage('Please enter date in yyyy-mm-dd format');
      return;
    }

    const val = Number(amount);
    if (isNaN(val)) return;

    try {
      if (editingEntry) {
        // Deltas
        const oldVal = Number(editingEntry.amount);
        const oldType = editingEntry.type;

        // Reverse Old
        // Old Purchase: Purch -old, Bal -old
        // Old Pay: Paid -old, Bal +old (Pay reduces bal)
        const purDelta1 = oldType === 'purchase' ? -oldVal : 0;
        const paidDelta1 = oldType === 'payment' ? -oldVal : 0;
        const balDelta1 = oldType === 'purchase' ? -oldVal : oldVal;

        // Apply New
        const purDelta2 = type === 'purchase' ? val : 0;
        const paidDelta2 = type === 'payment' ? val : 0;
        const balDelta2 = type === 'purchase' ? val : -val;

        const netDesc = purDelta1 + purDelta2;
        const netPaid = paidDelta1 + paidDelta2;
        const netBal = balDelta1 + balDelta2;

        await updateDoc(doc(db, 'suppliers', supplier.id, 'ledger', editingEntry.id), {
          amount: val, type, date, note
        });

        await updateDoc(doc(db, 'suppliers', supplier.id), {
          totalBalance: increment(netBal),
          totalPurchases: increment(netDesc),
          totalPaid: increment(netPaid),
          updatedAt: serverTimestamp(),
          lastActivityDate: date
        });

        // Optimistic
        setEntries(prev => prev.map(e => e.id === editingEntry.id ? { ...e, amount: val, type, date, note } : e));
        setUserInteractedData({
          totalBalance: displayData.totalBalance + netBal,
          totalPurchases: displayData.totalPurchases + netDesc,
          totalPaid: displayData.totalPaid + netPaid
        });
        setMessage('Entry updated');

      } else {
        // Add
        const newDocRef = await addDoc(collection(db, 'suppliers', supplier.id, 'ledger'), {
          amount: val, type, date, note, createdAt: serverTimestamp()
        });

        const netDesc = type === 'purchase' ? val : 0;
        const netPaid = type === 'payment' ? val : 0;
        const netBal = type === 'purchase' ? val : -val;

        await updateDoc(doc(db, 'suppliers', supplier.id), {
          totalBalance: increment(netBal),
          totalPurchases: increment(netDesc),
          totalPaid: increment(netPaid),
          updatedAt: serverTimestamp(),
          lastActivityDate: date
        });

        const newEntry = { id: newDocRef.id, amount: val, type, date, note, createdAt: { seconds: Date.now() / 1000 } };
        setEntries(prev => [newEntry, ...prev]);
        setTotalTransactionCount(prev => prev + 1);
        setUserInteractedData({
          totalBalance: displayData.totalBalance + netBal,
          totalPurchases: displayData.totalPurchases + netDesc,
          totalPaid: displayData.totalPaid + netPaid
        });

        setMessage('Entry added');
      }
      resetForm();
      setTimeout(() => setUserInteractedData(null), 2000);

    } catch (err) {
      console.error(err);
      setMessage('Failed to process entry');
    }
  };

  const startEditEntry = (entry) => {
    setEditingEntry(entry);
    setAmount(entry.amount.toString());
    setType(entry.type);
    setDate(entry.date);
    setNote(entry.note);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteEntry = async (entryId) => {
    if (!window.confirm('Are you sure you want to delete this entry?')) return;

    const entryToDelete = entries.find(e => e.id === entryId);
    if (!entryToDelete) return;

    const val = Number(entryToDelete.amount);

    // Reverse Logic
    const netDesc = entryToDelete.type === 'purchase' ? -val : 0;
    const netPaid = entryToDelete.type === 'payment' ? -val : 0;
    const netBal = entryToDelete.type === 'purchase' ? -val : val;

    try {
      await updateDoc(doc(db, 'suppliers', supplier.id, 'ledger', entryId), {
        isDeleted: true, deletedAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'suppliers', supplier.id), {
        totalBalance: increment(netBal),
        totalPurchases: increment(netDesc),
        totalPaid: increment(netPaid),
        updatedAt: serverTimestamp()
      });

      setEntries(prev => prev.filter(e => e.id !== entryId));
      setTotalTransactionCount(prev => prev - 1);
      setUserInteractedData({
        totalBalance: displayData.totalBalance + netBal,
        totalPurchases: displayData.totalPurchases + netDesc,
        totalPaid: displayData.totalPaid + netPaid
      });

      setMessage('Entry deleted');
      setTimeout(() => setUserInteractedData(null), 2000);

    } catch (err) {
      console.error(err);
      setMessage('Failed to delete entry');
    }
  };

  // ... (PDF Export reused similar simple logic)
  const handleExportPDF = async () => {
    if (!exportStart) {
      setMessage('Please select a start date for export');
      return;
    }
    setExportLoading(true);
    setMessage('');

    try {
      const q = query(
        collection(db, 'suppliers', supplier.id, 'ledger'),
        orderBy('date', 'asc')
      );
      const snap = await getDocs(q);
      const allEntries = snap.docs.map(d => {
        const da = d.data();
        if (da.isDeleted) return null;
        return { id: d.id, ...da, amount: Number(da.amount) || 0 };
      }).filter(Boolean);

      const filteredEntries = allEntries.filter((entry) => {
        const entryDate = entry.date;
        const startDate = exportStart;
        const endDate = exportEnd || '9999-12-31';
        return entryDate >= startDate && entryDate <= endDate;
      });

      if (filteredEntries.length === 0) {
        setMessage('No entries found in selected date range');
        setExportLoading(false);
        return;
      }

      const openingBalance = allEntries
        .filter((e) => e.date < exportStart)
        .reduce((sum, e) => {
          return e.type === 'purchase' ? sum + e.amount : sum - e.amount;
        }, 0);

      const closingBalance = filteredEntries[filteredEntries.length - 1]?.runningBalance || openingBalance;

      const periodPurchases = filteredEntries
        .filter((e) => e.type === 'purchase')
        .reduce((sum, e) => sum + e.amount, 0);
      const periodPayments = filteredEntries
        .filter((e) => e.type === 'payment')
        .reduce((sum, e) => sum + e.amount, 0);

      const pdfData = {
        entityName: supplier.name,
        entityType: 'supplier',
        entries: filteredEntries, // already sorted ascending
        openingBalance,
        closingBalance,
        totalDebit: periodPurchases,
        totalCredit: periodPayments,
        dateRange: { from: exportStart, to: exportEnd },
        generatedDate: new Date().toLocaleDateString('en-IN')
      };

      const success = await exportLedgerToPDF(
        pdfData,
        `SupplierLedger_${supplier.name.replace(/[^a-zA-Z0-9]/g, '')}_ledger_${exportStart}to${exportEnd || 'current'}.pdf`
      );

      if (success) {
        setMessage('PDF exported successfully!');
        setExportStart('');
        setExportEnd('');
      } else {
        setMessage('Failed to generate PDF. Please try again.');
      }
    } catch (error) {
      console.error('Export error:', error);
      setMessage(`Export failed. Please try again: ${error.message}`);
    } finally {
      setExportLoading(false);
    }
  };

  if (!supplier || !supplier.id) return <div style={{ padding: '20px', textAlign: 'center' }}>No Supplier Data Found (Missing ID). Please go back.</div>;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      display: 'flex', flexDirection: 'column', width: '100vw', margin: 0,
      padding: isMobile ? '0px 12px' : '24px', overflowX: 'hidden', boxSizing: 'border-box', fontFamily: "'Inter', sans-serif"
    }}>
      <div style={{
        maxWidth: isMobile ? '100vw' : '1200px', margin: isMobile ? '0' : '0 auto', width: '100%',
        backgroundColor: '#ffffff', borderRadius: isMobile ? '0' : '24px', padding: isMobile ? '16px' : '32px',
        boxShadow: isMobile ? 'none' : '0 4px 20px rgba(0,0,0,0.05)', border: isMobile ? 'none' : '1px solid #f0f0f0', boxSizing: 'border-box'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', marginBottom: isMobile ? '20px' : '32px',
          gap: isMobile ? '12px' : '16px', flexDirection: isMobile ? 'column' : 'row'
        }}>
          <button onClick={onBack} style={{
            padding: '10px 20px', borderRadius: '12px', border: 'none', backgroundColor: 'white',
            cursor: 'pointer', fontSize: '14px', color: '#1a237e', fontWeight: '600',
            display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
          }}>← Back</button>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <h2 style={{ margin: 0, color: '#1a237e', fontSize: isMobile ? '24px' : '28px', fontWeight: 'bold' }}>
              Ledger: <span style={{ color: '#ef6c00' }}>{supplier.name}</span>
            </h2>
            <span style={{ fontSize: '14px', color: '#546e7a', fontWeight: '500' }}>
              Total Transactions: <strong>{totalTransactionCount}</strong>
              <button
                onClick={(e) => { e.stopPropagation(); recalculateTotals(true); }}
                style={{
                  marginLeft: '8px', border: 'none', background: 'transparent', cursor: 'pointer',
                  color: '#e65100', fontSize: '16px', padding: '0 4px'
                }}
                title="Recalculate Totals"
              >
                🔄
              </button>
            </span>
          </div>
        </div>

        {/* MAIN BALANCE SUMMARY */}
        <div style={{
          marginBottom: isMobile ? '20px' : '32px',
          padding: isMobile ? '20px' : '32px',

          borderRadius: '20px',
          border: '1px solid #e0e0e0',
          boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
          background: 'linear-gradient(to right, #ffffff, #fff3e0)'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)',
            gap: isMobile ? '16px' : '20px',
            alignItems: 'center'
          }}>
            {/* Total Purchases */}
            <div style={{ textAlign: 'center', padding: '16px', background: '#ffe0b2', borderRadius: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#e65100', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Total Purchases
              </div>
              <div style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 'bold', color: '#e65100', marginTop: '4px' }}>
                {formatIndianCurrency(displayData.totalPurchases)}
              </div>
            </div>

            {/* Total Paid */}
            <div style={{ textAlign: 'center', padding: '16px', background: '#ffebee', borderRadius: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#c62828', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Total Paid
              </div>
              <div style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 'bold', color: '#c62828', marginTop: '4px' }}>
                {formatIndianCurrency(displayData.totalPaid)}
              </div>
            </div>

            {/* Balance */}
            <div style={{ textAlign: 'center', padding: '16px', background: '#fff8e1', borderRadius: '16px', gridColumn: isMobile ? 'span 2' : 'auto' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#ff6f00', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Payable Balance
              </div>
              <div style={{
                fontSize: isMobile ? '24px' : '32px',
                fontWeight: '800',
                color: displayBalance >= 0 ? '#e65100' : '#2e7d32',
                marginTop: '4px'
              }}>
                {formatIndianCurrency(displayBalance)}
              </div>
              <div style={{ fontSize: '12px', color: '#546e7a', marginTop: '2px' }}>
                {displayBalance >= 0 ? '(You Owe)' : '(Paid in Advance)'}
              </div>
            </div>
          </div>
        </div>


        {/* Add/Edit Form */}
        <div style={{
          display: 'flex', gap: isMobile ? '12px' : '16px', flexWrap: 'wrap',
          marginBottom: isMobile ? '20px' : '32px', flexDirection: isMobile ? 'column' : 'row',
          backgroundColor: '#fafafa', padding: isMobile ? '16px' : '24px', borderRadius: '20px', border: '1px solid #f0f0f0'
        }}>
          {/* ... Inputs ... */}
          <div style={{ flex: isMobile ? '1 1 100%' : '0 0 140px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#455a64', fontSize: '12px' }}>Amount</label>
            <input type="number" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)}
              style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e0e0e0', outline: 'none', fontSize: '14px', boxSizing: 'border-box', fontWeight: '500' }} />
          </div>
          <div style={{ flex: isMobile ? '1 1 100%' : '0 0 120px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#455a64', fontSize: '12px' }}>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)}
              style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e0e0e0', backgroundColor: '#fff', fontSize: '14px', boxSizing: 'border-box', fontWeight: '500' }}>
              <option value="purchase">Purchase</option>
              <option value="payment">Payment</option>
            </select>
          </div>
          <div style={{ flex: isMobile ? '1 1 100%' : '0 0 160px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#455a64', fontSize: '12px' }}>Date (yyyy-mm-dd)</label>
            <input type="text" placeholder="2082-07-15" value={date} onChange={handleDateChange}
              style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e0e0e0', outline: 'none', fontSize: '14px', boxSizing: 'border-box', fontWeight: '500' }} />
          </div>
          <div style={{ flex: isMobile ? '1 1 100%' : '1', minWidth: isMobile ? 'auto' : '140px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#455a64', fontSize: '12px' }}>Note</label>
            <input type="text" placeholder="Details..." value={note} onChange={(e) => setNote(e.target.value)}
              style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e0e0e0', outline: 'none', fontSize: '14px', boxSizing: 'border-box', fontWeight: '500' }} />
          </div>
          <div style={{ display: 'flex', gap: isMobile ? '8px' : '12px', alignItems: 'end', flexWrap: 'wrap', flex: isMobile ? '1 1 100%' : 'auto' }}>
            <button onClick={addOrUpdateEntry} style={{
              padding: '12px 24px', borderRadius: '12px', border: 'none', backgroundColor: '#ef6c00', color: '#fff',
              cursor: 'pointer', fontWeight: '600', fontSize: '14px', whiteSpace: 'nowrap', minHeight: '46px', flex: isMobile ? '1 1 100%' : 'auto',
              boxShadow: '0 4px 12px rgba(239, 108, 0, 0.2)'
            }}>{editingEntry ? 'Update' : 'Add Entry'}</button>
            {editingEntry && (
              <button onClick={resetForm} style={{
                padding: '12px 24px', borderRadius: '12px', border: '1px solid #e0e0e0', backgroundColor: 'white', color: '#546e7a',
                cursor: 'pointer', fontWeight: '600', fontSize: '14px', minHeight: '46px', flex: isMobile ? '1 1 100%' : 'auto'
              }}>Cancel</button>
            )}
          </div>
        </div>

        {message && (
          <div style={{ marginBottom: isMobile ? '16px' : '24px', padding: '16px 20px', borderRadius: '12px', backgroundColor: '#fff3e0', color: '#ef6c00', fontSize: '14px', border: '1px solid #ffe0b2' }}>{message}</div>
        )}

        {/* EXPORT */}
        <div style={{ marginBottom: isMobile ? '24px' : '32px', padding: isMobile ? '16px' : '24px', backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #e0e0e0' }}>
          <h4 style={{ margin: '0 0 16px 0', color: '#1a237e', fontSize: '16px', fontWeight: 'bold' }}>Export Ledger to PDF</h4>
          <div style={{ display: 'flex', gap: isMobile ? '12px' : '16px', flexWrap: 'wrap', alignItems: 'end' }}>
            <input type="text" placeholder="Start Date" value={exportStart} onChange={handleExportDateChange(setExportStart)} style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #cfd8dc', fontSize: '14px' }} />
            <input type="text" placeholder="End Date" value={exportEnd} onChange={handleExportDateChange(setExportEnd)} style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #cfd8dc', fontSize: '14px' }} />
            <button onClick={handleExportPDF} disabled={exportLoading || !exportStart} style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', backgroundColor: '#ef6c00', color: '#fff', cursor: 'pointer', fontWeight: '600' }}>
              {exportLoading ? 'Generating...' : 'Export PDF'}
            </button>
          </div>
        </div>

        {/* Ledger Table */}
        {loading ? (
          <p style={{ textAlign: 'center', color: '#78909c', fontSize: '16px', padding: '60px' }}>Loading Supplier Ledger...</p>
        ) : entries.length === 0 ? (
          <p style={{ color: '#78909c', textAlign: 'center', padding: '60px', fontSize: '14px', background: '#f9fafb', borderRadius: '12px' }}>No entries found. Add your first purchase above.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0', marginTop: '8px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #f0f0f0' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa' }}>
                  <th style={{ padding: '16px 12px', fontSize: '13px', fontWeight: '700', color: '#1a237e', borderBottom: '1px solid #e0e0e0', textAlign: 'left' }}>Date</th>
                  <th style={{ padding: '16px 12px', fontSize: '13px', fontWeight: '700', color: '#1a237e', borderBottom: '1px solid #e0e0e0', textAlign: 'right' }}>Purchase</th>
                  <th style={{ padding: '16px 12px', fontSize: '13px', fontWeight: '700', color: '#1a237e', borderBottom: '1px solid #e0e0e0', textAlign: 'right' }}>Payment</th>
                  <th style={{ padding: '16px 12px', fontSize: '13px', fontWeight: '700', color: '#1a237e', borderBottom: '1px solid #e0e0e0', textAlign: 'right' }}>Balance</th>
                  <th style={{ padding: '16px 12px', fontSize: '13px', fontWeight: '700', color: '#1a237e', borderBottom: '1px solid #e0e0e0', textAlign: 'left' }}>Details</th>
                  <th style={{ padding: '16px 12px', fontSize: '13px', fontWeight: '700', color: '#1a237e', borderBottom: '1px solid #e0e0e0', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {entriesWithBalance.map((entry, index) => (
                  <tr key={entry.id} style={{ backgroundColor: entry.id === editingEntry?.id ? '#fff3e0' : (index % 2 === 0 ? 'white' : '#fafafa') }}>
                    <td style={{ padding: '14px 12px', fontSize: '14px', color: '#37474f', borderBottom: '1px solid #f0f0f0' }}>{entry.date}</td>
                    <td style={{ padding: '14px 12px', fontSize: '14px', fontWeight: entry.type === 'purchase' ? '600' : '400', color: entry.type === 'purchase' ? '#ef6c00' : '#b0bec5', textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>{entry.type === 'purchase' ? formatAmount(entry.amount) : '-'}</td>
                    <td style={{ padding: '14px 12px', fontSize: '14px', fontWeight: entry.type === 'payment' ? '600' : '400', color: entry.type === 'payment' ? '#c62828' : '#b0bec5', textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>{entry.type === 'payment' ? formatAmount(entry.amount) : '-'}</td>
                    <td style={{ padding: '14px 12px', fontSize: '14px', fontWeight: '700', color: entry.runningBalance >= 0 ? '#e65100' : '#d32f2f', textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>{formatAmount(entry.runningBalance)}</td>
                    <td style={{ padding: '14px 12px', fontSize: '14px', color: '#455a64', borderBottom: '1px solid #f0f0f0' }}>{entry.note || '-'}</td>
                    <td style={{ padding: '14px 12px', textAlign: 'center', borderBottom: '1px solid #f0f0f0' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button onClick={() => startEditEntry(entry)} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #bbdefb', backgroundColor: '#e3f2fd', color: '#1565c0', fontSize: '12px', cursor: 'pointer' }}>Edit</button>
                        <button onClick={() => handleDeleteEntry(entry.id)} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #ffcdd2', backgroundColor: '#ffebee', color: '#c62828', fontSize: '12px', cursor: 'pointer' }}>Del</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {entries.length < totalTransactionCount && (
              <div style={{ textAlign: 'center', marginTop: '20px' }}>
                <button
                  onClick={fetchMoreEntries}
                  disabled={loadingMore}
                  style={{
                    padding: '12px 30px', borderRadius: '25px', border: 'none', background: '#ffe0b2', color: '#e65100',
                    fontSize: '14px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                  }}
                >
                  {loadingMore ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
};

export default SupplierLedger;