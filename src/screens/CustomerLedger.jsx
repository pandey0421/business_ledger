import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, onSnapshot, getDocs, doc, updateDoc, query, orderBy, limit, increment, getDoc, getCountFromServer, startAfter, writeBatch } from 'firebase/firestore';
import { Search, X, Package, ArrowLeft } from 'lucide-react';
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

  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [costPrice, setCostPrice] = useState(0); // Store selected product's CP

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

  // --- Dynamic Path Logic ---
  const [basePath, setBasePath] = useState(null);

  useEffect(() => {
    // Determine the correct path for this customer
    const checkPath = async () => {
      if (!customer?.id) return;
      const uid = auth.currentUser?.uid;

      // 1. Prefer User Scope (New Architecture)
      if (uid) {
        // We assume we are in the user scope if we are logged in, 
        // unless this is a legacy shared customer.
        // For 'Karobar Khata', default to user scope.
        setBasePath(`users/${uid}/customers/${customer.id}`);
      } else {
        // Fallback to legacy root (or wait for auth)
        setBasePath(`customers/${customer.id}`);
      }
    };
    checkPath();
  }, [customer?.id]);

  // Listen for Realtime Balance & Totals (Dynamic Path)
  useEffect(() => {
    if (!basePath) return;
    const unsub = onSnapshot(doc(db, basePath), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setRealtimeData({
          totalBalance: data.totalBalance || 0,
          totalSales: data.totalSales || 0,
          totalReceived: data.totalReceived || 0
        });
      }
    });
    return () => unsub();
  }, [basePath]);

  const displayData = userInteractedData || realtimeData;
  const displayBalance = displayData.totalBalance;

  // Initial Fetch (Dynamic Path)
  useEffect(() => {
    const initLedger = async () => {
      if (!basePath) return;
      setLoading(true);
      try {
        const ledgerRef = collection(db, basePath, 'ledger'); // Subcollection

        const countSnap = await getCountFromServer(ledgerRef);
        setTotalTransactionCount(countSnap.data().count);

        const q = query(ledgerRef, orderBy('date', 'desc'), limit(10));
        const snap = await getDocs(q);

        const fetchedEntries = snap.docs
          .filter(d => !d.data().isDeleted)
          .map(d => ({ id: d.id, ...d.data() }));

        setEntries(fetchedEntries);
        setLastVisible(snap.docs[snap.docs.length - 1]);
      } catch (err) {
        console.error("Ledger Load Failed", err);
        // Fallback: If User Scope failed (maybe legacy data?), try Root?
        // But for now, let's stick to the primary decision.
      } finally {
        setLoading(false);
      }
    };
    initLedger();
    initLedger();
  }, [basePath]);

  // Fetch Inventory for Dropdown (Optimization: Fetch once)
  const [inventoryProducts, setInventoryProducts] = useState([]);
  useEffect(() => {
    const fetchInventory = async () => {
      if (!auth.currentUser) return;
      try {
        const pRef = collection(db, 'users', auth.currentUser.uid, 'products');
        const snap = await getDocs(pRef);
        const prods = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.n.localeCompare(b.n));
        setInventoryProducts(prods);
      } catch (e) {
        console.error("Failed to load inventory for dropdown", e);
      }
    };
    fetchInventory();
  }, []);

  const fetchMoreEntries = async () => {
    if (!lastVisible) return;
    setLoadingMore(true);
    try {
      const q = query(
        collection(db, basePath, 'ledger'),
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


  const handleDateInput = (e) => {
    let v = e.target.value.replace(/[^0-9]/g, '');
    if (v.length > 4) v = v.slice(0, 4) + '-' + v.slice(4);
    if (v.length > 7) v = v.slice(0, 7) + '-' + v.slice(7);
    if (v.length > 10) v = v.slice(0, 10);
    setDate(v);
  };

  const handleExportDateChange = (setter) => (e) => {
    let value = e.target.value.replace(/[^0-9]/g, '');
    if (value.length >= 4) value = value.slice(0, 4) + '-' + value.slice(4);
    if (value.length >= 7) value = value.slice(0, 7) + '-' + value.slice(7);
    setter(value);
  };

  // --- CART STATE ---
  const [cartItems, setCartItems] = useState([]);
  const [productSearch, setProductSearch] = useState(''); // Replaces searchTerm for clarity
  const [prodResults, setProdResults] = useState([]);
  const [showProdResults, setShowProdResults] = useState(false);

  // Current Item Builder State
  const [currentItem, setCurrentItem] = useState({
    pid: null,
    n: '',
    u: 'pcs',
    qty: '',
    rate: '',
    cp: 0,
    sp: 0
  });

  // Search Effect
  useEffect(() => {
    const runSearch = async () => {
      if (productSearch.length < 3) {
        setProdResults([]);
        return;
      }
      const uid = auth.currentUser?.uid;
      if (!uid) return;

      try {
        const q = query(
          collection(db, 'users', uid, 'products'),
          where('n', '>=', productSearch),
          where('n', '<=', productSearch + '\uf8ff'),
          limit(5)
        );
        const snap = await getDocs(q);
        setProdResults(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setShowProdResults(true);
      } catch (e) { console.error(e); }
    };
    const timer = setTimeout(runSearch, 300);
    return () => clearTimeout(timer);
  }, [productSearch]);

  const handleAddItem = () => {
    if (!currentItem.n || !currentItem.qty || !currentItem.rate) return;
    const itemTotal = Number(currentItem.qty) * Number(currentItem.rate);
    const newItem = {
      ...currentItem,
      total: itemTotal,
      key: Date.now() // unique key
    };
    setCartItems(prev => [...prev, newItem]);
    // Reset builder
    setCurrentItem({ pid: null, n: '', u: 'pcs', qty: '', rate: '', cp: 0, sp: 0 });
    setProductSearch('');
    setShowProdResults(false);
  };

  const removeItem = (key) => setCartItems(prev => prev.filter(i => i.key !== key));

  const grandTotal = (type === 'sale' && cartItems.length > 0)
    ? cartItems.reduce((acc, item) => acc + item.total, 0)
    : Number(amount || 0);

  const resetForm = () => {
    setAmount('');
    setType('sale');
    setDate('');
    setNote('');
    setQuantity('');
    setUnit('');
    setCostPrice(0);
    setEditingEntry(null);
    setCartItems([]);
    setProductSearch('');
    setProdResults([]);
    setShowProdResults(false);
    setCurrentItem({ pid: null, n: '', u: 'pcs', qty: '', rate: '', cp: 0, sp: 0 });
  };

  const addOrUpdateEntry = async () => {
    if (!basePath) return;
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setMessage('Error: You must be logged in.');
      return;
    }

    const batch = writeBatch(db);

    // Ledger Doc
    const ledgerRef = editingEntry
      ? doc(db, basePath, 'ledger', editingEntry.id)
      : doc(collection(db, basePath, 'ledger'));

    const finalAmount = grandTotal;
    // ... (Keep profit calc) ...
    const totalProfit = type === 'sale'
      ? cartItems.reduce((acc, i) => acc + ((Number(i.rate) - Number(i.cp || 0)) * Number(i.qty)), 0)
      : 0;

    const entryData = {
      type,
      date,
      amount: finalAmount,
      note: note || (type === 'sale' ? 'Sale' : 'Payment'),
      p: totalProfit,
      items: cartItems.map(i => ({
        pid: i.pid || null,
        n: i.n,
        qty: i.qty,
        u: i.u,
        rate: i.rate,
        cp: i.cp || 0,
        total: i.total
      })),
      updatedAt: serverTimestamp()
    };
    if (!editingEntry) entryData.createdAt = serverTimestamp();

    batch.set(ledgerRef, entryData, { merge: true });

    // Customer Totals
    const custRef = doc(db, basePath);
    const netBal = type === 'sale' ? finalAmount : -finalAmount;
    const netSale = type === 'sale' ? finalAmount : 0;
    const netRecv = type === 'payment' ? finalAmount : 0;

    // We use increment for atomic updates
    if (!editingEntry) {
      batch.set(custRef, {
        totalBalance: increment(netBal),
        totalSales: increment(netSale),
        totalReceived: increment(netRecv),
        lastTransactionDate: date,
        updatedAt: serverTimestamp()
      }, { merge: true });
    }

    // Inventory Deduction (Only for New Sales for now)
    if (!editingEntry && type === 'sale') {
      cartItems.forEach(item => {
        if (item.pid) {
          const prodRef = doc(db, 'users', uid, 'products', item.pid);
          batch.update(prodRef, {
            qty: increment(-Number(item.qty))
          });
        }
      });
    }

    try {
      await batch.commit();
      setMessage('Saved successfully!');

      // Optimistic Update
      const newEntry = { id: ledgerRef.id, ...entryData };
      if (editingEntry) {
        setEntries(prev => prev.map(e => e.id === editingEntry.id ? newEntry : e));
      } else {
        setEntries(prev => [newEntry, ...prev]);
      }
      resetForm();
    } catch (e) {
      console.error("Save Error", e);
      setMessage("Error Saving: " + e.message);
    }
  };

  const renderSaleBuilder = () => (
    <div style={{ border: '1px solid #e0e0e0', padding: '16px', borderRadius: '12px', background: 'white', marginBottom: '16px', gridColumn: 'span 2' }}>
      <h4 style={{ margin: '0 0 12px 0', color: '#1a237e' }}>Items</h4>

      {/* Product Dropdown Selection (Replaces Search) */}
      <div style={{ marginBottom: '12px' }}>
        <select
          value="" // Always reset to prompt selection
          onChange={(e) => {
            const pId = e.target.value;
            if (!pId) return;
            const p = inventoryProducts.find(x => x.id === pId);
            if (p) {
              setCurrentItem({
                pid: p.id, n: p.n, u: p.u, rate: p.sp, cp: p.cp, qty: 1
              });
            }
          }}
          style={{
            width: '100%',
            padding: '10px',
            borderRadius: '8px',
            border: '1px solid #ddd',
            background: '#fff',
            fontSize: '14px',
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          <option value="" disabled>Select Product form Inventory...</option>
          {inventoryProducts.map(p => (
            <option key={p.id} value={p.id}>
              {p.n} (Stock: {p.qty} {p.u} | Rs. {p.sp})
            </option>
          ))}
        </select>
        <div style={{ fontSize: '10px', color: '#888', marginTop: '4px', textAlign: 'right' }}>
          Populates Item details below automatically
        </div>
      </div>

      {/* Builder Inputs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'flex-end', background: '#f5f5f5', padding: '12px', borderRadius: '8px' }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#666' }}>Item Name</label>
          <input
            value={currentItem.n}
            onChange={e => setCurrentItem(prev => ({ ...prev, n: e.target.value }))}
            placeholder="Item Name"
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>
        <div style={{ width: '70px' }}>
          <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#666' }}>Qty</label>
          <input type="number" value={currentItem.qty} onChange={e => setCurrentItem(prev => ({ ...prev, qty: e.target.value }))} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
        </div>
        <div style={{ width: '90px' }}>
          <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#666' }}>Rate</label>
          <input type="number" value={currentItem.rate} onChange={e => setCurrentItem(prev => ({ ...prev, rate: e.target.value }))} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
        </div>
        <button onClick={handleAddItem} style={{ padding: '0 16px', height: '35px', background: '#3f51b5', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>ADD</button>
      </div>

      {/* Cart Table */}
      {cartItems.length > 0 && (
        <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left', color: '#90a4ae', fontSize: '12px' }}>
              <th style={{ padding: '8px 4px' }}>Item</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {cartItems.map(item => (
              <tr key={item.key} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '8px 4px' }}>{item.n}</td>
                <td>{item.qty} {item.u}</td>
                <td>{item.rate}</td>
                <td>{item.total.toFixed(0)}</td>
                <td><button onClick={() => removeItem(item.key)} style={{ color: '#ef5350', border: 'none', background: 'none', cursor: 'pointer' }}>X</button></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan="3" style={{ textAlign: 'right', fontWeight: 'bold', padding: '12px 8px' }}>Grand Total:</td>
              <td style={{ fontWeight: 'bold', color: '#2e7d32', fontSize: '16px' }}>{grandTotal}</td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  );

  const startEditEntry = (entry) => {
    setEditingEntry(entry);
    setType(entry.type);
    setDate(entry.date);
    setNote(entry.note);

    if (entry.type === 'sale') {
      if (entry.items && entry.items.length > 0) {
        // Load Multi-Item
        setCartItems(entry.items.map((i, idx) => ({
          key: Date.now() + idx,
          ...i,
          qty: i.qty, // Use 'qty' from new schema
          rate: i.rate, // Use 'rate' from new schema
          total: i.total || (i.qty * i.rate)
        })));
      } else if (entry.pid) {
        // Legacy Single Item -> Convert to Cart
        setCartItems([{
          key: Date.now(),
          pid: entry.pid,
          n: entry.pN || entry.note,
          u: entry.u,
          cp: entry.cp || 0,
          qty: entry.q,
          rate: entry.r || (entry.amount / entry.q) || 0,
          total: Number(entry.amount)
        }]);
      } else {
        // Manual (no items)
        setAmount(entry.amount.toString());
      }
    } else {
      setAmount(entry.amount.toString());
      setCartItems([]); // Clear cart for non-sale types
    }
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
      const batch = writeBatch(db);

      // 1. Mark as Deleted
      const ledgerDocRef = doc(db, basePath, 'ledger', entryId);
      batch.update(ledgerDocRef, {
        isDeleted: true,
        deletedAt: serverTimestamp(),
        parentName: customer.name
      });

      // 2. Update Customer Totals
      const customerDocRef = doc(db, basePath);
      batch.update(customerDocRef, {
        totalBalance: increment(netBal),
        totalSales: increment(netSales),
        totalReceived: increment(netRecv),
        updatedAt: serverTimestamp()
      });

      // 3. RESTORE STOCK (If items exist)
      if (entryToDelete.items && Array.isArray(entryToDelete.items)) {
        for (const item of entryToDelete.items) {
          if (item.pid) { // pid is product ID
            const productRef = doc(db, 'users', auth.currentUser.uid, 'products', item.pid);
            batch.update(productRef, {
              qty: increment(Number(item.qty) || 0)
            });
          }
        }
      } else if (entryToDelete.pid) { // Legacy Single Item
        const productRef = doc(db, 'users', auth.currentUser.uid, 'products', entryToDelete.pid);
        batch.update(productRef, {
          qty: increment(Number(entryToDelete.q) || 0)
        });
      }

      await batch.commit();

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

  // Recalculate Totals (Manual Fix)
  const recalculateTotals = async () => {
    if (!customer?.id) return;
    if (!window.confirm("This will recalculate the Total Balance by summing up ALL ledger entries. Continue?")) return;

    setMessage('Recalculating totals...');
    try {
      const q = query(collection(db, basePath, 'ledger'));
      const snap = await getDocs(q);

      let calcSales = 0;
      let calcRecv = 0;

      snap.docs.forEach(d => {
        const data = d.data();
        if (!data.isDeleted) {
          const amt = Number(data.amount) || 0;
          if (data.type === 'sale') calcSales += amt;
          else calcRecv += amt; // Payments
        }
      });

      const calcBalance = calcSales - calcRecv;

      // Update DB
      await updateDoc(doc(db, basePath), {
        totalSales: calcSales,
        totalReceived: calcRecv,
        totalBalance: calcBalance,
        updatedAt: serverTimestamp()
      });

      // Update Local State (via realtimeData or force set)
      setUserInteractedData({
        totalSales: calcSales,
        totalReceived: calcRecv,
        totalBalance: calcBalance
      });

      setMessage('Balance synchronized with entries!');
      setTimeout(() => setMessage(''), 3000);

    } catch (e) {
      console.error("Recalc failed", e);
      setMessage('Recalculation failed');
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
        collection(db, basePath, 'ledger'),
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

  const renderForm = () => (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
      {/* Type & Date */}
      <div style={{ display: 'flex', gap: '16px' }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold', color: '#666' }}>Type</label>
          <div style={{ display: 'flex', gap: '4px', background: '#f5f5f5', padding: '4px', borderRadius: '8px' }}>
            <button
              onClick={() => { setType('sale'); setAmount(''); }}
              style={{
                flex: 1, padding: '8px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px',
                background: type === 'sale' ? '#4caf50' : 'transparent',
                color: type === 'sale' ? 'white' : '#666',
                boxShadow: type === 'sale' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
              }}
            >Sale</button>
            <button
              onClick={() => { setType('payment'); setNote('Payment Received'); setCartItems([]); }}
              style={{
                flex: 1, padding: '8px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px',
                background: type === 'payment' ? '#ef5350' : 'transparent',
                color: type === 'payment' ? 'white' : '#666',
                boxShadow: type === 'payment' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
              }}
            >Payment</button>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold', color: '#666' }}>Date (YYYY-MM-DD)</label>
          <input
            type="text"
            value={date}
            onChange={handleDateInput}
            placeholder="2080-01-01"
            maxLength={10}
            style={{
              width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', fontWeight: 'bold', fontFamily: 'monospace'
            }}
          />
        </div>
      </div>

      {/* Content */}
      <div style={{ gridColumn: isMobile ? 'span 1' : 'span 2' }}>
        {type === 'sale' ? renderSaleBuilder() : (
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold', color: '#666' }}>Amount</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: 'bold', color: '#666' }}>Rs.</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                style={{
                  width: '100%', padding: '12px 12px 12px 40px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '16px', fontWeight: 'bold', color: '#1a237e'
                }}
              />
            </div>
          </div>
        )}

        {/* Note Section REMOVED as per request, just hidden state update if needed, or we rely on Type */}
      </div>

      {/* Save Button */}
      <div style={{ gridColumn: isMobile ? 'span 1' : 'span 2', display: 'flex', gap: '12px', justifyContent: 'flex-end', alignItems: 'center', marginTop: '16px' }}>
        {message && <span style={{ color: message.includes('Error') ? 'red' : 'green', fontSize: '14px', fontWeight: '500' }}>{message}</span>}
        {editingEntry && <button onClick={resetForm} style={{ padding: '10px 20px', background: 'white', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>}
        <button
          onClick={addOrUpdateEntry}
          style={{
            padding: '12px 32px', background: type === 'sale' ? '#4caf50' : '#ef5350', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
          }}
        >
          {editingEntry ? 'Update' : (type === 'sale' ? `Save Sale (Rs. ${grandTotal})` : 'Save Payment')}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ padding: '0px', minHeight: '100vh', background: '#f5f7fa', fontFamily: "'Inter', sans-serif" }}>
      {/* ... Header (kept same) ... */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(10px)',
        position: 'sticky', top: 0, zIndex: 100, borderBottom: '1px solid rgba(0,0,0,0.05)',
        padding: isMobile ? '12px 16px' : '16px 24px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.02)'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '50%', color: '#546e7a' }}>
              <ArrowLeft size={24} />
            </button>
            <div>
              <h2 style={{ margin: 0, color: '#1a237e', fontSize: isMobile ? '20px' : '24px', fontWeight: 'bold' }}>
                {customer.name}
              </h2>
              <div style={{ fontSize: '12px', color: '#666', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Txns: {totalTransactionCount} | Balance: {formatAmount(displayBalance)}
                <button
                  onClick={recalculateTotals}
                  style={{
                    border: 'none', background: 'transparent', cursor: 'pointer',
                    fontSize: '16px', padding: '0 4px', color: '#1a237e'
                  }}
                  title="Recalculate Balance"
                >
                  🔄
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1000px', margin: '20px auto', padding: isMobile ? '16px' : '0 24px' }}>



        {/* Metrics Cards - MOVED HERE */}
        <div style={{
          marginBottom: '20px',
          background: 'white',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
            gap: isMobile ? '12px' : '20px',
          }}>
            {/* Total Sales */}
            <div style={{ textAlign: 'center', padding: '20px', background: '#e8f5e9', borderRadius: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#2e7d32', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                TOTAL SALES
              </div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2e7d32', marginTop: '8px' }}>
                {formatAmount(displayData.totalSales)}
              </div>
            </div>

            {/* Total Received */}
            <div style={{ textAlign: 'center', padding: '20px', background: '#ffebee', borderRadius: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#c62828', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                TOTAL RECEIVED
              </div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#c62828', marginTop: '8px' }}>
                {formatAmount(displayData.totalReceived)}
              </div>
            </div>

            {/* Balance */}
            <div style={{ textAlign: 'center', padding: '20px', background: '#e3f2fd', borderRadius: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#1565c0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                CURRENT BALANCE
              </div>
              <div style={{
                fontSize: '28px',
                fontWeight: 'bold',
                color: '#1a237e', // Always dark blue for balance per screenshot
                marginTop: '4px'
              }}>
                {formatAmount(displayBalance)}
              </div>
              <div style={{ fontSize: '12px', color: '#546e7a' }}>
                {displayBalance >= 0 ? '(Receivable)' : '(Advance)'}
              </div>
            </div>
          </div>
        </div>

        {/* FORM SECTION */}
        <div style={{
          marginTop: '20px',
          backgroundColor: 'white', padding: isMobile ? '16px' : '24px', borderRadius: '16px',
          border: '1px solid #e0e0e0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
          width: '100%', boxSizing: 'border-box'
        }}>
          {message && <div style={{ marginBottom: '10px', color: message.includes('Error') ? 'red' : 'green' }}>{message}</div>}
          {renderForm()}
        </div>

        {/* Existing Ledger List (Simplified view of list component call or just let it flow) */}
        {/* We are replacing the top part, but we must ensure we don't cut off the list rendering logic below */}
        {/* The list rendering is below this block usually. */}


        {/* End logic for metrics/form container, list comes after? */}
        {/* No, in the original file, the List was AFTER the form. */}
        {/* I need to make sure I don't delete the List Rendering Logic. */}
        {/* I will stop the replacement here and assume the List is below line 830. */}
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



        {/* Message */}
        {message && (
          <div style={{ marginBottom: isMobile ? '16px' : '24px', padding: '16px 20px', borderRadius: '12px', backgroundColor: '#e8eaf6', color: '#1a237e', fontSize: '14px', border: '1px solid #c5cae9', fontWeight: '500' }}>{message}</div>
        )}

        {/* EXPORT (Simplified for now) */}
        <div style={{ marginBottom: isMobile ? '24px' : '32px', padding: isMobile ? '16px' : '24px', backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #e0e0e0', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', width: '100%', boxSizing: 'border-box' }}>
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
          <div style={{ overflowX: 'auto', background: 'white', padding: isMobile ? '16px' : '24px', borderRadius: '16px', border: '1px solid #e0e0e0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', width: '100%', boxSizing: 'border-box' }}>
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
                    <td style={{ padding: '14px 12px', fontSize: '14px', color: '#546e7a', borderBottom: '1px solid #f0f0f0' }}>
                      {entry.items && entry.items.length > 0 ? (
                        <div>
                          {entry.items.map((i, idx) => (
                            <div key={idx} style={{ fontSize: '13px', color: '#1a237e', marginBottom: '2px' }}>
                              <b>{i.n}</b> <span style={{ color: '#78909c' }}>({i.q} {i.u} @ {i.r})</span>
                            </div>
                          ))}
                          {entry.note && entry.note !== 'Sale' && <div style={{ fontSize: '12px', color: '#999', marginTop: '4px', fontStyle: 'italic' }}>{entry.note}</div>}
                        </div>
                      ) : (
                        // Legacy Single Item or Note
                        entry.pN ? (
                          <span>
                            <span style={{ fontWeight: '600', color: '#1a237e' }}>{entry.pN}</span>
                            <span style={{ fontSize: '12px', color: '#78909c' }}> - {entry.q} {entry.u} @ {formatAmount(entry.r)}</span>
                          </span>
                        ) : (
                          entry.note || '-'
                        )
                      )}
                    </td>
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
    </div>
  );
};

export default CustomerLedger;