import React, { useEffect, useState } from 'react';
import { collection, addDoc, query, orderBy, limit, startAfter, getDocs, getCountFromServer, serverTimestamp, doc, updateDoc, setDoc, increment, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { exportLedgerToPDF } from '../utils/pdfExport';
import LedgerPDFTemplate from '../components/LedgerPDFTemplate';

import { useBadDebt } from '../utils/badDebtCalculator';

const CustomerLedger = ({ customer, onBack }) => {
  const [entries, setEntries] = useState([]);
  // State for all 3 metrics
  const [realtimeData, setRealtimeData] = useState({
    totalBalance: customer?.totalBalance || 0,
    totalSales: customer?.totalSales || 0,
    totalReceived: customer?.totalReceived || 0
  });
  const [userInteractedData, setUserInteractedData] = useState(null); // Local override

  const [amount, setAmount] = useState('');
  const [type, setType] = useState('sale');
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');

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

  // useBadDebt Hook
  const { hasBadDebt, badDebtAmount, oldestUnpaidDate } = useBadDebt(entries);

  // Mobile check
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Listen for Realtime Balance & Totals
  useEffect(() => {
    if (!customer?.id) return;
    const unsub = onSnapshot(doc(db, 'customers', customer.id), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setRealtimeData({
          totalBalance: data.totalBalance || 0,
          totalSales: data.totalSales || 0, // Ensure migration V2 runs to populate this
          totalReceived: data.totalReceived || 0
        });
      }
    });
    return () => unsub();
  }, [customer?.id]);

  const displayData = userInteractedData || realtimeData;
  const displayBalance = displayData.totalBalance; // For compatibility with running balance calc

  // Initial Fetch logic ... (Keep lines 60-91 logic, just change vars if needed. No change needed there).
  useEffect(() => {
    const initLedger = async () => {
      if (!customer?.id) return;
      setLoading(true);
      try {
        const ledgerRef = collection(db, 'customers', customer.id, 'ledger');

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
        // Only set lastVisible if we have entries, else use snap last? 
        // Better to use snap last to keep pagination cursor valid even if filtered?
        // Actually if we filter all 10, we might need to fetch more. 
        // For simplicity, just set lastVisible from snap even if filtered.
        setLastVisible(snap.docs[snap.docs.length - 1]);
      } catch (err) {
        console.error("Error fetching ledger:", err);
      } finally {
        setLoading(false);
      }
    }
    initLedger();
  }, [customer?.id]);

  // Robust Recalculation Function
  const recalculateTotals = async (isManual = false) => {
    if (!customer?.id) return;
    if (!isManual && (loading || totalTransactionCount === 0)) return;
    // If auto-healing, and data already looks good, skip
    if (!isManual && (realtimeData.totalSales > 0 || realtimeData.totalReceived > 0)) return;
    // If auto-healing and we already touched it locally, skip
    if (!isManual && userInteractedData) return;

    if (isManual) setMessage('Recalculating totals...');
    console.log(`Starting ${isManual ? 'MANUAL' : 'Auto'} Recalculation...`);

    try {
      const ledgerRef = collection(db, 'customers', customer.id, 'ledger');
      const snap = await getDocs(ledgerRef); // Fetch ALL entries
      let s = 0, r = 0, b = 0;
      let lastDate = null;

      snap.docs.forEach(d => {
        const da = d.data();
        if (!da.isDeleted) {
          const v = Number(da.amount) || 0;
          if (da.type === 'sale') { s += v; b += v; }
          else { r += v; b -= v; }
          if (da.date && (!lastDate || da.date > lastDate)) lastDate = da.date;
        }
      });

      // 1. Update UI Immediately
      const newState = { totalSales: s, totalReceived: r, totalBalance: b };
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
        await updateDoc(doc(db, 'customers', customer.id), payload);
        rootSuccess = true;
      } catch (e) {
        console.warn("updateDoc failed, trying setDoc", e);
      }

      if (!rootSuccess) {
        try {
          await setDoc(doc(db, 'customers', customer.id), { ...payload, userId: uid }, { merge: true });
          rootSuccess = true;
        } catch (e) {
          console.error("ROOT WRITE FAILED", e);
          if (isManual) alert("Failed to save totals: " + e.message);
        }
      }

      // Try Update User List (Best Effort)
      if (uid) {
        try {
          await updateDoc(doc(db, 'users', uid, 'customers', customer.id), payload);
        } catch (e) {
          // Fallback create
          setDoc(doc(db, 'users', uid, 'customers', customer.id), { ...payload, name: customer.name || 'Client' }, { merge: true }).catch(err => console.error("Subcollection failed", err));
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
  }, [customer?.id, loading, totalTransactionCount, realtimeData, userInteractedData]);

  const fetchMoreEntries = async () => {
    if (!lastVisible) return;
    setLoadingMore(true);
    try {
      const q = query(
        collection(db, 'customers', customer.id, 'ledger'),
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

  // Helper: Running Balance Logic
  const entriesWithBalance = React.useMemo(() => {
    let currentBal = displayBalance;
    return entries.map(entry => {
      const rowBalance = currentBal;
      const amt = Number(entry.amount) || 0;
      if (entry.type === 'sale') {
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
    setType('sale');
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
        // Calculate Deltas
        const oldVal = Number(editingEntry.amount);
        const oldType = editingEntry.type;

        // Reverse Old
        // If old was sale: Sales -old, Bal -old
        // If old was pay: Recv -old, Bal +old
        const salesDelta1 = oldType === 'sale' ? -oldVal : 0;
        const recvDelta1 = oldType === 'payment' ? -oldVal : 0;
        const balDelta1 = oldType === 'sale' ? -oldVal : oldVal;

        // Apply New
        const salesDelta2 = type === 'sale' ? val : 0;
        const recvDelta2 = type === 'payment' ? val : 0;
        const balDelta2 = type === 'sale' ? val : -val;

        // Net
        const netSales = salesDelta1 + salesDelta2;
        const netRecv = recvDelta1 + recvDelta2;
        const netBal = balDelta1 + balDelta2;

        await updateDoc(doc(db, 'customers', customer.id, 'ledger', editingEntry.id), {
          amount: val, type, date, note
        });

        await updateDoc(doc(db, 'customers', customer.id), {
          totalBalance: increment(netBal),
          totalSales: increment(netSales),
          totalReceived: increment(netRecv),
          updatedAt: serverTimestamp(),
          lastActivityDate: date
        });

        // Local Optimistic
        setEntries(prev => prev.map(e => e.id === editingEntry.id ? { ...e, amount: val, type, date, note } : e));
        setUserInteractedData({
          totalBalance: displayData.totalBalance + netBal,
          totalSales: displayData.totalSales + netSales,
          totalReceived: displayData.totalReceived + netRecv
        });
        setMessage('Entry updated');

      } else {
        // Add
        const newDocRef = await addDoc(collection(db, 'customers', customer.id, 'ledger'), {
          amount: val, type, date, note, createdAt: serverTimestamp()
        });

        const netSales = type === 'sale' ? val : 0;
        const netRecv = type === 'payment' ? val : 0;
        const netBal = type === 'sale' ? val : -val;

        await updateDoc(doc(db, 'customers', customer.id), {
          totalBalance: increment(netBal),
          totalSales: increment(netSales),
          totalReceived: increment(netRecv),
          updatedAt: serverTimestamp(),
          lastActivityDate: date
        });

        const newEntry = { id: newDocRef.id, amount: val, type, date, note, createdAt: { seconds: Date.now() / 1000 } };
        setEntries(prev => [newEntry, ...prev]);
        setTotalTransactionCount(prev => prev + 1);
        setUserInteractedData({
          totalBalance: displayData.totalBalance + netBal,
          totalSales: displayData.totalSales + netSales,
          totalReceived: displayData.totalReceived + netRecv
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
    // Reverse logic
    const netSales = entryToDelete.type === 'sale' ? -val : 0;
    const netRecv = entryToDelete.type === 'payment' ? -val : 0;
    const netBal = entryToDelete.type === 'sale' ? -val : val;

    try {
      await updateDoc(doc(db, 'customers', customer.id, 'ledger', entryId), {
        isDeleted: true,
        deletedAt: serverTimestamp(),
        parentName: customer.name
      });

      await updateDoc(doc(db, 'customers', customer.id), {
        totalBalance: increment(netBal),
        totalSales: increment(netSales),
        totalReceived: increment(netRecv),
        updatedAt: serverTimestamp()
      });

      setEntries(prev => prev.filter(e => e.id !== entryId));
      setTotalTransactionCount(prev => prev - 1);
      setUserInteractedData({
        totalBalance: displayData.totalBalance + netBal,
        totalSales: displayData.totalSales + netSales,
        totalReceived: displayData.totalReceived + netRecv
      });
      setMessage('Entry deleted');
      setTimeout(() => setUserInteractedData(null), 2000);

    } catch (err) {
      console.error(err);
      setMessage('Failed to delete entry');
    }
  };

  const formatAmount = (num) => {
    return new Intl.NumberFormat('en-IN').format(num);
  };

  const handleExportPDF = async () => {
    if (!exportStart) {
      setMessage('Please select a start date for export');
      return;
    }
    setExportLoading(true);
    setMessage('');
    try {
      // For PDF, we likely need MORE than what is loaded if the range is huge.
      // However, the user didn't explicitly ask to refactor export to server-side.
      // We will try filter loaded entries first. If the range is outside loaded data, 
      // strictly speaking we should query the server. 
      // For now, we will warn if data might be missing or just use what we have.
      // Better approach: fetch specifically for export.

      const q = query(
        collection(db, 'customers', customer.id, 'ledger'),
        orderBy('date', 'asc') // PDF needs chronological
        // No limit here, we want all for the range
      );
      // Note: For massive accounts this is heavy, but exporting usually requires all data.
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

      // Calculate Opening Balance for the PDF range
      // We can't rely on 'totalBalance' field for history. We must sum from start of time up to startDate.
      const openingBalance = allEntries
        .filter((e) => e.date < exportStart)
        .reduce((sum, e) => {
          return e.type === 'sale' ? sum + e.amount : sum - e.amount;
        }, 0);

      // We re-calculate closing based on the filtered set
      // (Simplified logic reuse from previous code)

      // ... (Reuse existing PDF logic logic) ...

      const periodSales = filteredEntries
        .filter((e) => e.type === 'sale')
        .reduce((sum, e) => sum + e.amount, 0);
      const periodPayments = filteredEntries
        .filter((e) => e.type === 'payment')
        .reduce((sum, e) => sum + e.amount, 0);

      const closingBalance = openingBalance + periodSales - periodPayments;

      const pdfData = {
        entityName: customer.name,
        entityType: 'customer',
        entries: filteredEntries, // Already sorted asc from query? No, query was on date strings.
        openingBalance,
        closingBalance,
        totalDebit: periodSales,
        totalCredit: periodPayments,
        dateRange: { from: exportStart, to: exportEnd },
        generatedDate: new Date().toLocaleDateString('en-IN')
      };

      const success = await exportLedgerToPDF(
        pdfData,
        `${customer.name.replace(/[^a-zA-Z0-9]/g, '')}_ledger_${exportStart}to${exportEnd || 'current'}.pdf`
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


  if (!customer) return null;

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
              Ledger: <span style={{ color: '#2e7d32' }}>{customer.name}</span>
            </h2>
            <span style={{ fontSize: '14px', color: '#546e7a', fontWeight: '500' }}>
              Total Transactions: <strong>{totalTransactionCount}</strong>
              <button
                onClick={(e) => { e.stopPropagation(); recalculateTotals(); }}
                style={{
                  marginLeft: '8px', border: 'none', background: 'transparent', cursor: 'pointer',
                  color: '#1a237e', fontSize: '16px', padding: '0 4px'
                }}
                title="Recalculate Totals"
              >
                🔄
              </button>
            </span>
          </div>
        </div>



        {/* MIGRATION PROMPT if data exists but totals are zero (likely data imported/existing but migration not run) */}
        {totalTransactionCount > 0 && displayData.totalSales === 0 && displayData.totalReceived === 0 && displayBalance === 0 && (
          <div style={{
            marginBottom: '20px', padding: '12px', background: '#fff3cd', color: '#856404',
            borderRadius: '8px', border: '1px solid #ffeeba', fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <span>⚠️ <strong>Totals look empty?</strong> You need to run the data migration to calculate past history.</span>
            <a href="#/migration" style={{
              background: '#856404', color: 'white', padding: '6px 12px', borderRadius: '4px',
              textDecoration: 'none', fontWeight: 'bold', fontSize: '12px'
            }}>Run Migration</a>
          </div>
        )}

        {/* BAD DEBT ALERT */}
        {hasBadDebt && (
          <div style={{
            marginBottom: isMobile ? '20px' : '32px', padding: '16px', backgroundColor: '#ffebee', color: '#b71c1c',
            borderRadius: '16px', border: '1px solid #ef5350', display: 'flex', alignItems: 'center', gap: '16px',
            boxShadow: '0 4px 12px rgba(239, 83, 80, 0.15)'
          }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '50%', background: '#ffcdd2',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '20px'
            }}>⚠️</div>
            <div>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '800' }}>Bad Debt Alert</h4>
              <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.5' }}>
                Total Old Debt: <strong style={{ textDecoration: 'underline' }}>Rs. {formatAmount(badDebtAmount)}</strong>.
                Oldest unpaid sale date: <strong>{oldestUnpaidDate}</strong> (&gt; 6 months).
              </p>
            </div>
          </div>
        )}

        {/* Local Fallback Calculation */}
        {(() => {
          // If realtime data is 0 but we have entries, fallback to local sum
          // Note: entries might be paginated (limit 10), so this is only accurate if < 10 entries or if we accept partial
          // BUT, for the "Force Fix" we fetched all? No, that was in the button handler.
          // Let's use what we have.

          // BETTER: If realtime is 0, we can use the "userInteractedData" if set, or just show 0 with a warning?
          // Actually, let's rely on the Force Fix button to set userInteractedData or the DB.
          return null;
        })()}

        {/* MAIN BALANCE SUMMARY */}
        <div style={{
          marginBottom: isMobile ? '20px' : '32px',
          padding: isMobile ? '20px' : '32px',
          background: 'white',
          borderRadius: '20px',
          border: '1px solid #e0e0e0',
          boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
          background: 'linear-gradient(to right, #ffffff, #f3e5f5)'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)',
            gap: isMobile ? '16px' : '20px',
            alignItems: 'center'
          }}>
            {/* Total Sales */}
            <div style={{ textAlign: 'center', padding: '16px', background: '#e8f5e9', borderRadius: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#2e7d32', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Total Sales
              </div>
              <div style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 'bold', color: '#2e7d32', marginTop: '4px' }}>
                {formatAmount(displayData.totalSales)}
              </div>
            </div>

            {/* Total Received */}
            <div style={{ textAlign: 'center', padding: '16px', background: '#ffebee', borderRadius: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#c62828', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Total Received

              </div>
              <div style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 'bold', color: '#c62828', marginTop: '4px' }}>
                {formatAmount(displayData.totalReceived)}
              </div>
            </div>

            {/* Balance */}
            <div style={{ textAlign: 'center', padding: '16px', background: '#e3f2fd', borderRadius: '16px', gridColumn: isMobile ? 'span 2' : 'auto' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#1565c0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Current Balance
              </div>
              <div style={{
                fontSize: isMobile ? '24px' : '32px',
                fontWeight: '800',
                color: displayBalance >= 0 ? '#1a237e' : '#c62828',
                marginTop: '4px'
              }}>
                {formatAmount(displayBalance)}
              </div>
              <div style={{ fontSize: '12px', color: '#546e7a', marginTop: '2px' }}>
                {displayBalance >= 0 ? '(Receivable)' : '(Advance)'}
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
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#455a64', fontSize: '12px' }}>Amount *</label>
            <input type="number" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)}
              style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e0e0e0', outline: 'none', fontSize: '14px', boxSizing: 'border-box', fontWeight: '500' }} />
          </div>
          <div style={{ flex: isMobile ? '1 1 100%' : '0 0 120px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#455a64', fontSize: '12px' }}>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)}
              style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e0e0e0', backgroundColor: '#fff', fontSize: '14px', boxSizing: 'border-box', fontWeight: '500' }}>
              <option value="sale">Sale</option>
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
              padding: '12px 24px', borderRadius: '12px', border: 'none', backgroundColor: '#1a237e', color: '#fff',
              cursor: 'pointer', fontWeight: '600', fontSize: '14px', whiteSpace: 'nowrap', minHeight: '46px', flex: isMobile ? '1 1 100%' : 'auto',
              boxShadow: '0 4px 12px rgba(26, 35, 126, 0.2)'
            }}>{editingEntry ? 'Update' : 'Add Entry'}</button>
            {editingEntry && (
              <button onClick={resetForm} style={{
                padding: '12px 24px', borderRadius: '12px', border: '1px solid #e0e0e0', backgroundColor: 'white', color: '#546e7a',
                cursor: 'pointer', fontWeight: '600', fontSize: '14px', minHeight: '46px', flex: isMobile ? '1 1 100%' : 'auto'
              }}>Cancel</button>
            )}
          </div>
        </div>

        {/* Message */}
        {message && (
          <div style={{ marginBottom: isMobile ? '16px' : '24px', padding: '16px 20px', borderRadius: '12px', backgroundColor: '#e8eaf6', color: '#1a237e', fontSize: '14px', border: '1px solid #c5cae9', fontWeight: '500' }}>{message}</div>
        )}

        {/* EXPORT (Simplified for now) */}
        <div style={{ marginBottom: isMobile ? '24px' : '32px', padding: isMobile ? '16px' : '24px', backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #e0e0e0' }}>
          <h4 style={{ margin: '0 0 16px 0', color: '#1a237e', fontSize: '16px', fontWeight: 'bold' }}>Export Ledger to PDF</h4>
          <div style={{ display: 'flex', gap: isMobile ? '12px' : '16px', flexWrap: 'wrap', alignItems: 'end' }}>
            <input type="text" placeholder="Start Date" value={exportStart} onChange={handleExportDateChange(setExportStart)} style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #cfd8dc', fontSize: '14px' }} />
            <input type="text" placeholder="End Date" value={exportEnd} onChange={handleExportDateChange(setExportEnd)} style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #cfd8dc', fontSize: '14px' }} />
            <button onClick={handleExportPDF} disabled={exportLoading || !exportStart} style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', backgroundColor: '#1a237e', color: '#fff', cursor: 'pointer', fontWeight: '600' }}>
              {exportLoading ? 'Generating...' : 'Export PDF'}
            </button>
          </div>
        </div>

        {/* Ledger Table */}
        {loading ? (
          <p style={{ textAlign: 'center', color: '#78909c', fontSize: '16px', padding: '60px' }}>Loading ledger...</p>
        ) : entries.length === 0 ? (
          <p style={{ color: '#78909c', textAlign: 'center', padding: '60px', fontSize: '14px', background: '#f9fafb', borderRadius: '12px' }}>No entries found. Add your first transaction above.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0', marginTop: '8px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #f0f0f0' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa' }}>
                  <th style={{ padding: '16px 12px', fontSize: '13px', fontWeight: '700', color: '#1a237e', borderBottom: '1px solid #e0e0e0', textAlign: 'left' }}>Date</th>
                  <th style={{ padding: '16px 12px', fontSize: '13px', fontWeight: '700', color: '#1a237e', borderBottom: '1px solid #e0e0e0', textAlign: 'right' }}>Debit (Sale)</th>
                  <th style={{ padding: '16px 12px', fontSize: '13px', fontWeight: '700', color: '#1a237e', borderBottom: '1px solid #e0e0e0', textAlign: 'right' }}>Credit (Received)</th>
                  <th style={{ padding: '16px 12px', fontSize: '13px', fontWeight: '700', color: '#1a237e', borderBottom: '1px solid #e0e0e0', textAlign: 'right' }}>Balance</th>
                  <th style={{ padding: '16px 12px', fontSize: '13px', fontWeight: '700', color: '#1a237e', borderBottom: '1px solid #e0e0e0', textAlign: 'left' }}>Details</th>
                  <th style={{ padding: '16px 12px', fontSize: '13px', fontWeight: '700', color: '#1a237e', borderBottom: '1px solid #e0e0e0', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {entriesWithBalance.map((entry, index) => (
                  <tr key={entry.id} style={{ backgroundColor: entry.id === editingEntry?.id ? '#e8eaf6' : (index % 2 === 0 ? 'white' : '#fafafa') }}>
                    <td style={{ padding: '14px 12px', fontSize: '14px', color: '#37474f', borderBottom: '1px solid #f0f0f0' }}>{entry.date}</td>
                    <td style={{ padding: '14px 12px', fontSize: '14px', fontWeight: entry.type === 'sale' ? '600' : '400', color: entry.type === 'sale' ? '#2e7d32' : '#b0bec5', textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>{entry.type === 'sale' ? formatAmount(entry.amount) : '-'}</td>
                    <td style={{ padding: '14px 12px', fontSize: '14px', fontWeight: entry.type === 'payment' ? '600' : '400', color: entry.type === 'payment' ? '#c62828' : '#b0bec5', textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>{entry.type === 'payment' ? formatAmount(entry.amount) : '-'}</td>
                    <td style={{ padding: '14px 12px', fontSize: '14px', fontWeight: '700', color: entry.runningBalance >= 0 ? '#1a237e' : '#c62828', textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>{formatAmount(entry.runningBalance)}</td>
                    <td style={{ padding: '14px 12px', fontSize: '14px', color: '#546e7a', borderBottom: '1px solid #f0f0f0' }}>{entry.note || '-'}</td>
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

            {/* Load More Button */}
            {entries.length < totalTransactionCount && (
              <div style={{ textAlign: 'center', marginTop: '20px' }}>
                <button
                  onClick={fetchMoreEntries}
                  disabled={loadingMore}
                  style={{
                    padding: '12px 30px', borderRadius: '25px', border: 'none', background: '#e8eaf6', color: '#1a237e',
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
    </div >
  );
};

export default CustomerLedger;