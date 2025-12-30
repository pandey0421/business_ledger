// src/screens/SupplierLedger.jsx
import React, { useEffect, useState } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { exportLedgerToPDF, formatIndianCurrency } from '../utils/pdfExport';

const SupplierLedger = ({ supplier, onBack }) => {
  const [entries, setEntries] = useState([]);
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('purchase');
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [totalPurchase, setTotalPurchase] = useState(0);
  const [totalPayment, setTotalPayment] = useState(0);
  const [editingEntry, setEditingEntry] = useState(null);
  const [message, setMessage] = useState('');

  // Export states
  const [exportStart, setExportStart] = useState('');
  const [exportEnd, setExportEnd] = useState('');
  const [exportLoading, setExportLoading] = useState(false);

  // Auto-format date input (20820715 → 2082-07-15)
  const handleDateChange = (e) => {
    let value = e.target.value.replace(/[^0-9]/g, ''); // Only numbers

    // Auto-format: after 4 digits (year) add -, after 6 digits (year-month) add -
    if (value.length >= 4) {
      value = value.slice(0, 4) + '-' + value.slice(4);
    }
    if (value.length >= 7) {
      value = value.slice(0, 7) + '-' + value.slice(7);
    }

    setDate(value);
  };

  // Same for export date inputs
  const handleExportDateChange = (setter) => (e) => {
    let value = e.target.value.replace(/[^0-9]/g, '');
    if (value.length >= 4) {
      value = value.slice(0, 4) + '-' + value.slice(4);
    }
    if (value.length >= 7) {
      value = value.slice(0, 7) + '-' + value.slice(7);
    }
    setter(value);
  };

  useEffect(() => {
    if (!supplier?.id) return;

    const q = query(
      collection(db, 'suppliers', supplier.id, 'ledger'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let chronoData = snapshot.docs.map((d) => {
        const raw = d.data();
        const amt = Number(raw.amount) || 0;
        return {
          id: d.id,
          ...raw,
          amount: amt,
        };
      });

      // Sort chronologically for balance calculation
      chronoData.sort((a, b) => {
        const da = a.date;
        const dbDate = b.date;
        if (da && !dbDate) return -1;
        if (!da && dbDate) return 1;
        if (da && dbDate) return da.localeCompare(dbDate);
        const ca = a.createdAt?.seconds || 0;
        const cb = b.createdAt?.seconds || 0;
        return ca - cb;
      });

      // Calculate running balances
      let runningBalance = 0;
      let purchaseSum = 0;
      let paymentSum = 0;

      chronoData = chronoData.map((entry) => {
        const amt = entry.amount;
        if (entry.type === 'purchase') {
          runningBalance += amt;
          purchaseSum += amt;
        } else if (entry.type === 'payment') {
          runningBalance -= amt;
          paymentSum += amt;
        }
        return {
          ...entry,
          runningBalance,
        };
      });

      // Reverse for display (newest first)
      const displayData = [...chronoData].reverse();
      setEntries(displayData);
      setTotalPurchase(purchaseSum);
      setTotalPayment(paymentSum);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [supplier]);

  const resetForm = () => {
    setAmount('');
    setType('purchase');
    setDate('');
    setNote('');
    setEditingEntry(null);
  };

  const updateSupplierLastActivity = async (activityDate) => {
    try {
      await updateDoc(doc(db, 'suppliers', supplier.id), {
        lastActivityDate: activityDate,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Failed to update supplier lastActivityDate:', err);
    }
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

    try {
      if (editingEntry) {
        await updateDoc(
          doc(db, 'suppliers', supplier.id, 'ledger', editingEntry.id),
          {
            amount: Number(amount),
            type,
            date,
            note,
          }
        );
        await updateSupplierLastActivity(date);
        setMessage('Entry updated successfully');
      } else {
        await addDoc(collection(db, 'suppliers', supplier.id, 'ledger'), {
          amount: Number(amount),
          type,
          date,
          note,
          createdAt: serverTimestamp(),
        });
        await updateSupplierLastActivity(date);
        setMessage('Entry added successfully');
      }
      resetForm();
    } catch (err) {
      console.error(err);
      setMessage('Failed to add/update entry');
    }
  };

  const startEditEntry = (entry) => {
    setEditingEntry(entry);
    setAmount(entry.amount.toString());
    setType(entry.type);
    setDate(entry.date);
    setNote(entry.note);
  };

  const handleDeleteEntry = async (entryId) => {
    if (!window.confirm('Are you sure you want to delete this entry?')) return;

    try {
      await deleteDoc(doc(db, 'suppliers', supplier.id, 'ledger', entryId));

      if (entries.length === 1) {
        const remainingEntries = entries.filter((e) => e.id !== entryId);
        const mostRecentDate = remainingEntries[0]?.date || null;
        await updateSupplierLastActivity(mostRecentDate);
      } else {
        await updateDoc(doc(db, 'suppliers', supplier.id), {
          lastActivityDate: null,
          updatedAt: serverTimestamp(),
        });
      }
      setMessage('Entry deleted successfully');
    } catch (err) {
      console.error(err);
      setMessage('Failed to delete entry');
    }
  };

  const formatAmount = (num) => {
    return new Intl.NumberFormat('en-IN').format(num);
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
        const entryDate = new Date(entry.date);
        const startDate = new Date(exportStart);
        const endDate = exportEnd ? new Date(exportEnd) : new Date('9999-12-31');

        return entryDate >= startDate && entryDate <= endDate;
      });

      if (filteredEntries.length === 0) {
        setMessage('No entries found in selected date range');
        setExportLoading(false);
        return;
      }

      // Calculate opening balance (entries BEFORE start date)
      const openingBalance = entries
        .filter((e) => new Date(e.date) < new Date(exportStart))
        .reduce((sum, e) => {
          return e.type === 'purchase' ? sum + e.amount : sum - e.amount;
        }, 0);

      // Closing balance (last filtered entry)
      const closingBalance = filteredEntries[filteredEntries.length - 1]?.runningBalance || openingBalance;

      // Totals for period
      const periodPurchases = filteredEntries
        .filter((e) => e.type === 'purchase')
        .reduce((sum, e) => sum + e.amount, 0);
      const periodPayments = filteredEntries
        .filter((e) => e.type === 'payment')
        .reduce((sum, e) => sum + e.amount, 0);

      // Prepare PDF data
      const pdfData = {
        entityName: supplier.name,
        entityType: 'supplier',
        entries: filteredEntries.sort((a, b) => new Date(a.date) - new Date(b.date)), // Oldest first
        openingBalance,
        closingBalance,
        totalDebit: periodPurchases,
        totalCredit: periodPayments,
        dateRange: { from: exportStart, to: exportEnd },
        generatedDate: new Date().toLocaleDateString('en-IN'),
      };

      // Trigger PDF generation
      const success = await exportLedgerToPDF(
        pdfData,
        `Supplier_Ledger_${supplier.name.replace(/[^a-zA-Z0-9]/g, '_')}_${exportStart}_to_${exportEnd || 'current'}.pdf`
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
      setMessage('Export failed. Please try again: ' + error.message);
    } finally {
      setExportLoading(false);
    }
  };

  const balance = totalPurchase - totalPayment;

  if (!supplier) return null;

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #fff3e0, #fce4ec)', padding: '24px' }}>
      <div style={{ 
        maxWidth: '900px', 
        margin: '0 auto', 
        backgroundColor: '#ffffff', 
        borderRadius: '12px', 
        padding: '24px', 
        boxShadow: '0 6px 18px rgba(0,0,0,0.06)', 
        border: '1px solid #e0e0e0' 
      }}>
        {/* Back Button */}
        <button
          onClick={onBack}
          style={{
            marginBottom: '12px',
            padding: '6px 12px',
            borderRadius: '999px',
            border: '1px solid #cfd8dc',
            backgroundColor: '#fafafa',
            cursor: 'pointer'
          }}
        >
          ← Back to Suppliers
        </button>

        {/* Header */}
        <h2 style={{ marginTop: 0, color: '#1a237e' }}>Ledger for {supplier.name}</h2>
        <p style={{ color: '#546e7a', marginBottom: '16px' }}>
          Total Purchase: Rs. {formatAmount(totalPurchase)} | Total Payment: Rs. {formatAmount(totalPayment)} | Balance: Rs. {formatAmount(balance)}
        </p>

        {/* Add/Edit Form */}
        <div style={{ 
          display: 'flex', 
          gap: '8px', 
          flexWrap: 'wrap', 
          marginBottom: '16px', 
          backgroundColor: '#f5f5f5', 
          padding: '12px', 
          borderRadius: '10px' 
        }}>
          <input
            type="number"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{
              padding: '8px 10px',
              borderRadius: '8px',
              border: '1px solid #cfd8dc',
              minWidth: '100px'
            }}
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            style={{
              padding: '8px 10px',
              borderRadius: '8px',
              border: '1px solid #cfd8dc'
            }}
          >
            <option value="purchase">Purchase</option>
            <option value="payment">Payment</option>
          </select>
          <input
            type="text"
            placeholder="Date (2082-07-15)"
            value={date}
            onChange={handleDateChange}
            style={{
              padding: '8px 10px',
              borderRadius: '8px',
              border: '1px solid #cfd8dc',
              minWidth: '140px'
            }}
          />
          <input
            type="text"
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{
              flex: '1 1 120px',
              minWidth: '120px',
              padding: '8px 10px',
              borderRadius: '8px',
              border: '1px solid #cfd8dc'
            }}
          />
          <button
            onClick={addOrUpdateEntry}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#fb8c00',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: '500',
              minWidth: '120px'
            }}
          >
            {editingEntry ? 'Update Entry' : 'Add Entry'}
          </button>
          {editingEntry && (
            <button
              onClick={resetForm}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid #cfd8dc',
                backgroundColor: '#fafafa',
                color: '#607d8b',
                cursor: 'pointer',
                fontWeight: '500',
                minWidth: '80px'
              }}
            >
              Cancel
            </button>
          )}
        </div>

        {/* Message */}
        {message && (
          <div style={{
            marginBottom: '12px',
            padding: '10px',
            borderRadius: '10px',
            backgroundColor: '#fff3e0',
            color: '#ef6c00',
            fontSize: '14px'
          }}>
            {message}
          </div>
        )}

        {/* EXPORT SECTION */}
        <div style={{
          marginBottom: '20px',
          padding: '16px',
          backgroundColor: '#fff3e0',
          borderRadius: '10px',
          border: '2px solid #fb8c00'
        }}>
          <h4 style={{ margin: '0 0 12px 0', color: '#ef6c00' }}>📊 Export Ledger to PDF</h4>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#555', marginBottom: '4px' }}>From Date</label>
              <input
                type="text"
                placeholder="2082-07-15"
                value={exportStart}
                onChange={handleExportDateChange(setExportStart)}
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '2px solid #fb8c00',
                  minWidth: '140px',
                  fontSize: '14px'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#555', marginBottom: '4px' }}>To Date (optional)</label>
              <input
                type="text"
                placeholder="2082-12-15"
                value={exportEnd}
                onChange={handleExportDateChange(setExportEnd)}
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cfd8dc',
                  minWidth: '140px',
                  fontSize: '14px'
                }}
              />
            </div>
            <button
              onClick={handleExportPDF}
              disabled={exportLoading || !exportStart}
              style={{
                padding: '12px 24px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: exportLoading || !exportStart ? '#bdbdbd' : '#fb8c00',
                color: '#fff',
                cursor: exportLoading || !exportStart ? 'not-allowed' : 'pointer',
                fontWeight: '600',
                fontSize: '14px',
                minHeight: '48px'
              }}
            >
              {exportLoading ? 'Generating...' : '📄 Export PDF'}
            </button>
          </div>
        </div>

        {loading ? (
          <p>Loading ledger...</p>
        ) : entries.length === 0 ? (
          <p style={{ color: '#78909c' }}>No ledger entries</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px' }}>
            <thead>
              <tr style={{ backgroundColor: '#eeeeee' }}>
                <th style={{ border: '1px solid #e0e0e0', padding: '8px' }}>Date</th>
                <th style={{ border: '1px solid #e0e0e0', padding: '8px' }}>Purchase</th>
                <th style={{ border: '1px solid #e0e0e0', padding: '8px' }}>Payment</th>
                <th style={{ border: '1px solid #e0e0e0', padding: '8px' }}>Balance</th>
                <th style={{ border: '1px solid #e0e0e0', padding: '8px' }}>Details</th>
                <th style={{ border: '1px solid #e0e0e0', padding: '8px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td style={{ border: '1px solid #e0e0e0', padding: '8px', fontSize: '14px' }}>
                    {entry.date}
                  </td>
                  <td style={{
                    border: '1px solid #e0e0e0',
                    padding: '8px',
                    color: entry.type === 'purchase' ? '#2e7d32' : '#9e9e9e',
                    fontWeight: entry.type === 'purchase' ? '600' : '400'
                  }}>
                    {entry.type === 'purchase' ? formatAmount(entry.amount) : '-'}
                  </td>
                  <td style={{
                    border: '1px solid #e0e0e0',
                    padding: '8px',
                    color: entry.type === 'payment' ? '#c62828' : '#9e9e9e',
                    fontWeight: entry.type === 'payment' ? '600' : '400'
                  }}>
                    {entry.type === 'payment' ? formatAmount(entry.amount) : '-'}
                  </td>
                  <td style={{ border: '1px solid #e0e0e0', padding: '8px', fontSize: '14px' }}>
                    Rs. {formatAmount(entry.runningBalance)}
                  </td>
                  <td style={{ border: '1px solid #e0e0e0', padding: '8px', fontSize: '14px', color: '#455a64' }}>
                    {entry.note || '-'}
                  </td>
                  <td style={{ border: '1px solid #e0e0e0', padding: '8px' }}>
                    <button
                      onClick={() => startEditEntry(entry)}
                      style={{
                        marginRight: '4px',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        border: '1px solid #42a5f5',
                        backgroundColor: '#e3f2fd',
                        color: '#1976d2',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteEntry(entry.id)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        border: '1px solid #ef5350',
                        backgroundColor: '#ffebee',
                        color: '#d32f2f',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default SupplierLedger;
