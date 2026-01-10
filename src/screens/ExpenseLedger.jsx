import React, { useEffect, useState } from 'react';
import { collection, addDoc, query, orderBy, limit, startAfter, getDocs, getCountFromServer, serverTimestamp, doc, updateDoc, increment, onSnapshot, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { exportLedgerToPDF, formatIndianCurrency } from '../utils/pdfExport';

const ExpenseLedger = ({ expense, onBack }) => {
  // State
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastVisible, setLastVisible] = useState(null);
  const [totalTransactionCount, setTotalTransactionCount] = useState(0);

  // Realtime Total (Total Spent)
  const [realtimeTotal, setRealtimeTotal] = useState(expense?.totalAmount || 0);
  const [userInteractedTotal, setUserInteractedTotal] = useState(null);

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
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

  const formatAmount = (num) => {
    try {
      return new Intl.NumberFormat('en-IN').format(num);
    } catch (e) {
      return num;
    }
  };

  // 1. Listen for Realtime Total Updates
  useEffect(() => {
    if (!expense?.id || !expense?.userId) return;
    const unsub = onSnapshot(doc(db, 'users', expense.userId, 'expenses', expense.id), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setRealtimeTotal(data.totalAmount || 0);
      }
    });
    return () => unsub();
  }, [expense?.id, expense?.userId]);

  const displayTotal = userInteractedTotal !== null ? userInteractedTotal : realtimeTotal;

  // 2. Initial Ledger Fetch (Pagination)
  useEffect(() => {
    const initLedger = async () => {
      setLoading(true);
      if (!expense?.id || !expense?.userId) {
        console.warn("Missing ID or UserID for ledger init");
        setLoading(false);
        return;
      }
      try {
        const ledgerRef = collection(db, 'users', expense.userId, 'expenses', expense.id, 'ledger');
        // Get Count
        const countSnap = await getCountFromServer(ledgerRef);
        setTotalTransactionCount(countSnap.data().count);

        // Get First Page
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
  }, [expense?.id, expense?.userId]);

  // 3. Robust Recalculate (Self-Healing)
  const recalculateTotals = async (isManual = false) => {
    if (!expense?.id || !expense?.userId) return;
    if (!isManual && (loading || totalTransactionCount === 0)) return;
    if (!isManual && realtimeTotal > 0 && !userInteractedTotal) return; // Skip if looks good

    if (isManual) setMessage('Recalculating totals...');
    console.log(`Starting ${isManual ? 'MANUAL' : 'Auto'} Recalculation...`);

    try {
      const snap = await getDocs(collection(db, 'users', expense.userId, 'expenses', expense.id, 'ledger'));
      let sum = 0;
      let lastDate = null;
      snap.docs.forEach(d => {
        const da = d.data();
        if (!da.isDeleted) {
          sum += Number(da.amount) || 0;
          if (da.date && (!lastDate || da.date > lastDate)) lastDate = da.date;
        }
      });

      setUserInteractedTotal(sum);

      // Persist
      const payload = {
        totalAmount: sum,
        lastActivityDate: lastDate,
        updatedAt: serverTimestamp()
      };

      await updateDoc(doc(db, 'users', expense.userId, 'expenses', expense.id), payload);

      if (isManual) setMessage('Totals updated successfully');

    } catch (err) {
      console.error("Recalc failed", err);
      if (isManual) setMessage('Recalculation failed');
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => recalculateTotals(false), 2000);
    return () => clearTimeout(timer);
  }, [expense?.id, expense?.userId, loading, totalTransactionCount]);

  const [legacyCount, setLegacyCount] = useState(0);
  const [migrating, setMigrating] = useState(false);

  // 4. Load More
  const fetchMoreEntries = async () => {
    if (!lastVisible || !expense?.userId) return;
    setLoadingMore(true);
    try {
      const q = query(
        collection(db, 'users', expense.userId, 'expenses', expense.id, 'ledger'),
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
      console.error(err);
    } finally {
      setLoadingMore(false);
    }
  };

  // CHECK LEGACY DATA (From Root Collection)
  useEffect(() => {
    const checkLegacy = async () => {
      if (!expense?.id || entries.length > 0) return;
      try {
        const legacyRef = collection(db, 'expenses', expense.id, 'ledger');
        const countSnap = await getCountFromServer(legacyRef);
        setLegacyCount(countSnap.data().count);
      } catch (e) {
        console.log("Legacy check failed", e);
      }
    };
    if (!loading && entries.length === 0) {
      checkLegacy();
    }
  }, [expense?.id, entries.length, loading]);

  const migrateLegacyData = async () => {
    if (!expense?.id || !expense?.userId) return;
    setMigrating(true);
    setMessage("Migrating data...");

    try {
      const legacyRef = collection(db, 'expenses', expense.id, 'ledger');
      const snap = await getDocs(legacyRef);
      const newLedgerRef = collection(db, 'users', expense.userId, 'expenses', expense.id, 'ledger');

      const batch = writeBatch(db);
      let count = 0;
      let totalSum = 0;
      let lastDate = null;

      snap.docs.forEach(d => {
        const data = d.data();
        const amount = Number(data.amount) || 0;
        totalSum += amount;

        if (data.date && (!lastDate || data.date > lastDate)) lastDate = data.date;

        const newDocRef = doc(newLedgerRef); // New ID
        batch.set(newDocRef, { ...data, migratedAt: serverTimestamp() });
        batch.delete(doc(db, 'expenses', expense.id, 'ledger', d.id)); // Delete old
        count++;
      });

      // Update Parent Total immediately
      batch.update(doc(db, 'users', expense.userId, 'expenses', expense.id), {
        totalAmount: totalSum,
        lastActivityDate: lastDate || serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      await batch.commit();
      setMessage(`Successfully migrated ${count} entries!`);
      setLegacyCount(0);

      // Refresh
      window.location.reload();

    } catch (e) {
      console.error("Migration failed", e);
      setMessage("Migration failed: " + e.message);
    } finally {
      setMigrating(false);
    }
  };

  // 5. Running Balance Logic
  const entriesWithBalance = React.useMemo(() => {
    let currentTotal = displayTotal;
    return entries.map(entry => {
      const rowTotal = currentTotal;
      currentTotal -= (Number(entry.amount) || 0); // Working backwards
      return { ...entry, runningTotal: rowTotal };
    });
  }, [entries, displayTotal]);

  // Auto-format date input (20820715 -> 2082-07-15)
  const handleDateChange = (e) => {
    let value = e.target.value.replace(/[^0-9]/g, ''); // Only numbers
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
        // Edit: Calculate difference
        const oldVal = Number(editingEntry.amount);
        const diff = val - oldVal;

        await updateDoc(
          doc(db, 'users', expense.userId, 'expenses', expense.id, 'ledger', editingEntry.id),
          { amount: val, date, note }
        );

        await updateDoc(doc(db, 'users', expense.userId, 'expenses', expense.id), {
          totalAmount: increment(diff),
          lastActivityDate: date,
          updatedAt: serverTimestamp()
        });

        // Optimistic UI
        setEntries(prev => prev.map(e => e.id === editingEntry.id ? { ...e, amount: val, date, note } : e));
        if (userInteractedTotal !== null || realtimeTotal !== undefined) {
          setUserInteractedTotal((userInteractedTotal ?? realtimeTotal) + diff);
        }

        setMessage('Entry updated');
      } else {
        // Add
        const newRef = await addDoc(collection(db, 'users', expense.userId, 'expenses', expense.id, 'ledger'), {
          amount: val,
          date,
          note,
          createdAt: serverTimestamp()
        });

        await updateDoc(doc(db, 'users', expense.userId, 'expenses', expense.id), {
          totalAmount: increment(val),
          lastActivityDate: date,
          updatedAt: serverTimestamp()
        });

        const newEntry = { id: newRef.id, amount: val, date, note, createdAt: { seconds: Date.now() / 1000 } };
        setEntries(prev => [newEntry, ...prev]);
        setTotalTransactionCount(prev => prev + 1);

        if (userInteractedTotal !== null || realtimeTotal !== undefined) {
          setUserInteractedTotal((userInteractedTotal ?? realtimeTotal) + val);
        }

        setMessage('Entry added');
      }
      resetForm();
      setTimeout(() => setUserInteractedTotal(null), 2000); // Reset optimistic after delay

    } catch (err) {
      console.error(err);
      setMessage('Failed to process entry');
    }
  };

  const startEditEntry = (entry) => {
    setEditingEntry(entry);
    setAmount(entry.amount.toString());
    setDate(entry.date);
    setNote(entry.note);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteEntry = async (entryId) => {
    if (!window.confirm('Are you sure you want to delete this entry?')) return;

    const entryToDelete = entries.find(e => e.id === entryId);
    if (!entryToDelete) return;

    const val = Number(entryToDelete.amount);

    try {
      await updateDoc(doc(db, 'users', expense.userId, 'expenses', expense.id, 'ledger', entryId), {
        isDeleted: true,
        deletedAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'users', expense.userId, 'expenses', expense.id), {
        totalAmount: increment(-val),
        updatedAt: serverTimestamp() // Note: lastActivityDate might be tricky to revert perfectly, leaving as is or current
      });

      setEntries(prev => prev.filter(e => e.id !== entryId));
      setTotalTransactionCount(prev => prev - 1);

      if (userInteractedTotal !== null || realtimeTotal !== undefined) {
        setUserInteractedTotal((userInteractedTotal ?? realtimeTotal) - val);
      }

      setMessage('Entry deleted');
      setTimeout(() => setUserInteractedTotal(null), 2000);
    } catch (err) {
      console.error(err);
      setMessage('Failed to delete entry');
    }
  };



  // EXPORT FUNCTIONALITY
  const handleExportPDF = async () => {
    if (!exportStart) {
      setMessage('Please select a start date for export');
      return;
    }
    setExportLoading(true);
    setMessage('');
    try {
      // Filter entries by date range
      const filteredEntries = entries.filter((entry) => {
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

      // Calculate opening balance (entries BEFORE start date)
      const openingBalance = entries
        .filter((e) => e.date < exportStart)
        .reduce((sum, e) => sum + e.amount, 0);

      // Closing balance (last filtered entry)
      const closingBalance = filteredEntries[filteredEntries.length - 1]?.runningTotal || openingBalance;

      // Totals for period
      const periodExpenses = filteredEntries.reduce((sum, e) => sum + e.amount, 0);

      // Prepare PDF data
      const pdfData = {
        entityName: expense.name,
        entityType: 'expense',
        entries: filteredEntries.sort((a, b) => new Date(a.date) - new Date(b.date)), // Oldest first
        openingBalance,
        closingBalance,
        totalDebit: periodExpenses,
        totalCredit: 0, // Expenses have no credits
        dateRange: { from: exportStart, to: exportEnd },
        generatedDate: new Date().toLocaleDateString('en-IN')
      };

      // Trigger PDF generation
      const success = await exportLedgerToPDF(
        pdfData,
        `ExpenseLedger_${expense.name.replace(/[^a-zA-Z0-9]/g, '')}_ledger_${exportStart}to${exportEnd || 'current'}.pdf`
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

  if (!expense || !expense.id) return <div style={{ padding: '20px', textAlign: 'center' }}>No Expense Data Found (Missing ID: {expense ? 'Yes' : 'No'}). Please go back.</div>;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      display: 'flex',
      flexDirection: 'column',
      width: '100vw',
      margin: 0,
      padding: isMobile ? '0px 12px' : '24px',
      overflowX: 'hidden',
      boxSizing: 'border-box',
      fontFamily: "'Inter', sans-serif"
    }}>
      <div style={{
        maxWidth: isMobile ? '100vw' : '1200px',
        margin: isMobile ? '0' : '0 auto',
        width: '100%',
        backgroundColor: '#ffffff',
        borderRadius: isMobile ? '0' : '24px',
        padding: isMobile ? '16px' : '32px',
        boxShadow: isMobile ? 'none' : '0 4px 20px rgba(0,0,0,0.05)',
        border: isMobile ? 'none' : '1px solid #f0f0f0',
        boxSizing: 'border-box'
      }}>
        {/* Back Button + Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: isMobile ? '20px' : '32px',
          gap: isMobile ? '12px' : '16px',
          flexDirection: isMobile ? 'column' : 'row'
        }}>
          <button onClick={onBack} style={{
            padding: '10px 20px',
            borderRadius: '12px',
            border: 'none',
            backgroundColor: 'white',
            cursor: 'pointer',
            fontSize: '14px',
            color: '#1a237e',
            fontWeight: '600',
            display: 'flex', alignItems: 'center', gap: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
          }}>
            ← Back
          </button>
          <div style={{ flex: 1 }}>
            <h2 style={{
              margin: '0 0 8px 0',
              color: '#c62828',
              fontSize: isMobile ? '24px' : '28px',
              fontWeight: 'bold'
            }}>
              Expense: {expense.name}
            </h2>
            {/* Bold Colored Total Expenses */}
            <p style={{
              margin: 0,
              fontSize: isMobile ? '16px' : '18px',
              fontWeight: '600',
              color: '#546e7a'
            }}>
              Total Spent: <span style={{ fontSize: isMobile ? '20px' : '22px', fontWeight: '800', color: '#c62828' }}>
                Rs. {formatAmount(displayTotal)}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); recalculateTotals(true); }}
                style={{
                  marginLeft: '8px', border: 'none', background: 'transparent', cursor: 'pointer',
                  color: '#c62828', fontSize: '16px', padding: '0 4px'
                }}
                title="Recalculate Totals"
              >
                🔄
              </button>
            </p>
          </div>
        </div>

        {/* Add/Edit Form */}
        <div style={{
          display: 'flex',
          gap: isMobile ? '12px' : '16px',
          flexWrap: 'wrap',
          marginBottom: isMobile ? '20px' : '32px',
          flexDirection: isMobile ? 'column' : 'row',
          backgroundColor: '#fafafa',
          padding: isMobile ? '16px' : '24px',
          borderRadius: '20px',
          border: '1px solid #f0f0f0'
        }}>
          <div style={{ flex: isMobile ? '1 1 100%' : '0 0 140px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#455a64', fontSize: '12px' }}>
              Amount *
            </label>
            <input
              type="number"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '12px',
                border: '1px solid #e0e0e0',
                outline: 'none',
                fontSize: '14px',
                boxSizing: 'border-box',
                fontWeight: '500'
              }}
            />
          </div>
          <div style={{ flex: isMobile ? '1 1 100%' : '0 0 160px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#455a64', fontSize: '12px' }}>
              Date (yyyy-mm-dd)
            </label>
            <input
              type="text"
              placeholder="2082-07-15"
              value={date}
              onChange={handleDateChange}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '12px',
                border: '1px solid #e0e0e0',
                outline: 'none',
                fontSize: '14px',
                boxSizing: 'border-box',
                fontWeight: '500'
              }}
            />
          </div>
          <div style={{ flex: isMobile ? '1 1 100%' : '1', minWidth: isMobile ? 'auto' : '140px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#455a64', fontSize: '12px' }}>
              Note (optional)
            </label>
            <input
              type="text"
              placeholder="Details..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '12px',
                border: '1px solid #e0e0e0',
                outline: 'none',
                fontSize: '14px',
                boxSizing: 'border-box',
                fontWeight: '500'
              }}
            />
          </div>
          <div style={{
            display: 'flex',
            gap: isMobile ? '8px' : '12px',
            alignItems: 'end',
            flexWrap: 'wrap',
            flex: isMobile ? '1 1 100%' : 'auto'
          }}>
            <button
              onClick={addOrUpdateEntry}
              style={{
                padding: '12px 24px',
                borderRadius: '12px',
                border: 'none',
                backgroundColor: '#c62828',
                color: '#fff',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '14px',
                whiteSpace: 'nowrap',
                minHeight: '46px',
                flex: isMobile ? '1 1 100%' : 'auto',
                boxShadow: '0 4px 12px rgba(198, 40, 40, 0.2)'
              }}
            >
              {editingEntry ? 'Update' : 'Add Expense'}
            </button>
            {editingEntry && (
              <button
                onClick={resetForm}
                style={{
                  padding: '12px 24px',
                  borderRadius: '12px',
                  border: '1px solid #e0e0e0',
                  backgroundColor: 'white',
                  color: '#546e7a',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '14px',
                  minHeight: '46px',
                  flex: isMobile ? '1 1 100%' : 'auto'
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Message */}
        {message && (
          <div style={{
            marginBottom: isMobile ? '16px' : '24px',
            padding: '16px 20px',
            borderRadius: '12px',
            backgroundColor: '#ffebee',
            color: '#c62828',
            fontSize: '14px',
            border: '1px solid #ffccdd',
            fontWeight: '500'
          }}>
            {message}
          </div>
        )}

        {/* EXPORT SECTION */}
        <div style={{
          marginBottom: isMobile ? '24px' : '32px',
          padding: isMobile ? '16px' : '24px',
          backgroundColor: '#fff',
          borderRadius: '16px',
          border: '1px solid #e0e0e0'
        }}>
          <h4 style={{ margin: '0 0 16px 0', color: '#c62828', fontSize: '16px', fontWeight: 'bold' }}>
            Export Ledger to PDF
          </h4>
          <div style={{
            display: 'flex',
            gap: isMobile ? '12px' : '16px',
            flexWrap: 'wrap',
            alignItems: 'end'
          }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#455a64', marginBottom: '6px', fontWeight: '600' }}>
                From Date *
              </label>
              <input
                type="text"
                placeholder="2082-07-15"
                value={exportStart}
                onChange={handleExportDateChange(setExportStart)}
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cfd8dc',
                  minWidth: isMobile ? '140px' : '160px',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#455a64', marginBottom: '6px', fontWeight: '600' }}>
                To Date
              </label>
              <input
                type="text"
                placeholder="2082-12-15"
                value={exportEnd}
                onChange={handleExportDateChange(setExportEnd)}
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cfd8dc',
                  minWidth: isMobile ? '140px' : '160px',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <button
              onClick={handleExportPDF}
              disabled={exportLoading || !exportStart}
              style={{
                padding: '10px 24px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: exportLoading || !exportStart ? '#e0e0e0' : '#c62828',
                color: exportLoading || !exportStart ? '#9e9e9e' : '#fff',
                cursor: exportLoading || !exportStart ? 'not-allowed' : 'pointer',
                fontWeight: '600',
                fontSize: '14px',
                minHeight: '42px',
                whiteSpace: 'nowrap',
                flex: isMobile ? '1 1 100%' : 'auto'
              }}
            >
              {exportLoading ? 'Generating...' : 'Export PDF'}
            </button>
          </div>
        </div>

        {/* Ledger Table */}
        {loading ? (
          <p style={{ textAlign: 'center', color: '#78909c', fontSize: '16px', padding: '60px' }}>
            Loading Expense Ledger (User: {expense?.userId || 'N/A'})...
          </p>
        ) : entries.length === 0 ? (
          <div style={{ color: '#78909c', textAlign: 'center', padding: '60px', fontSize: '14px', background: '#f9fafb', borderRadius: '12px' }}>
            <p>No expense entries yet. Add your first expense above.</p>
            {legacyCount > 0 && (
              <div style={{ marginTop: '20px', padding: '16px', background: '#fff3e0', borderRadius: '12px', border: '1px solid #ffe0b2' }}>
                <p style={{ color: '#e65100', fontWeight: '600', marginBottom: '8px' }}>
                  ⚠️ Found {legacyCount} entries from previous version.
                </p>
                <button
                  onClick={migrateLegacyData}
                  disabled={migrating}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#e65100', color: 'white', fontWeight: 'bold', cursor: 'pointer'
                  }}
                >
                  {migrating ? 'Migrating...' : 'Migrate Data Now'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'separate',
              borderSpacing: '0',
              marginTop: '8px',
              borderRadius: '12px',
              overflow: 'hidden',
              border: '1px solid #f0f0f0'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa' }}>
                  <th style={{ padding: '16px 12px', fontSize: '13px', fontWeight: '700', color: '#1a237e', borderBottom: '1px solid #e0e0e0', textAlign: 'left' }}>
                    Date
                  </th>
                  <th style={{ padding: '16px 12px', fontSize: '13px', fontWeight: '700', color: '#1a237e', borderBottom: '1px solid #e0e0e0', textAlign: 'right' }}>
                    Amount
                  </th>
                  <th style={{ padding: '16px 12px', fontSize: '13px', fontWeight: '700', color: '#1a237e', borderBottom: '1px solid #e0e0e0', textAlign: 'right' }}>
                    Running Total
                  </th>
                  <th style={{ padding: '16px 12px', fontSize: '13px', fontWeight: '700', color: '#1a237e', borderBottom: '1px solid #e0e0e0', textAlign: 'left' }}>
                    Note
                  </th>
                  <th style={{ padding: '16px 12px', fontSize: '13px', fontWeight: '700', color: '#1a237e', borderBottom: '1px solid #e0e0e0', textAlign: 'center' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {entriesWithBalance.map((entry, index) => (
                  <tr
                    key={entry.id}
                    style={{
                      backgroundColor: entry.id === editingEntry?.id ? '#ffebee' : (index % 2 === 0 ? 'white' : '#fafafa'),
                      transition: 'background-color 0.2s'
                    }}
                  >
                    <td style={{ padding: '14px 12px', fontSize: '14px', color: '#37474f', borderBottom: '1px solid #f0f0f0' }}>
                      {entry.date}
                    </td>
                    <td style={{ padding: '14px 12px', fontSize: '14px', fontWeight: '600', color: '#c62828', textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>
                      Rs. {formatAmount(entry.amount)}
                    </td>
                    <td style={{ padding: '14px 12px', fontSize: '14px', fontWeight: '700', color: '#1a237e', textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>
                      Rs. {formatAmount(entry.runningTotal)}
                    </td>
                    <td style={{ padding: '14px 12px', fontSize: '14px', color: '#546e7a', borderBottom: '1px solid #f0f0f0' }}>
                      {entry.note || '-'}
                    </td>
                    <td style={{ padding: '14px 12px', textAlign: 'center', borderBottom: '1px solid #f0f0f0' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button
                          onClick={() => startEditEntry(entry)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: '1px solid #bbdefb',
                            backgroundColor: '#e3f2fd',
                            color: '#1565c0',
                            fontSize: '12px',
                            cursor: 'pointer',
                            fontWeight: '600'
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteEntry(entry.id)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: '1px solid #ffcdd2',
                            backgroundColor: '#ffebee',
                            color: '#c62828',
                            fontSize: '12px',
                            cursor: 'pointer',
                            fontWeight: '600'
                          }}
                        >
                          Del
                        </button>
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
                    padding: '12px 30px', borderRadius: '25px', border: 'none', background: '#ffebee', color: '#c62828',
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

export default ExpenseLedger;
