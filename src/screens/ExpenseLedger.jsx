// src/screens/ExpenseLedger.jsx
import React, { useEffect, useState } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { exportLedgerToPDF, formatIndianCurrency } from '../utils/pdfExport';

const ExpenseLedger = ({ expense, onBack }) => {
  const [entries, setEntries] = useState([]);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [totalExpenses, setTotalExpenses] = useState(0);
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
    if (!expense?.id) return;

    const q = query(
      collection(db, 'expenses', expense.id, 'ledger'),
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

      // Sort chronologically for running total calculation
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

      // Calculate running totals (all expenses are positive outflows)
      let runningTotal = 0;
      let expenseSum = 0;

      chronoData = chronoData.map((entry) => {
        runningTotal += entry.amount;
        expenseSum += entry.amount;
        return {
          ...entry,
          runningTotal,
        };
      });

      // Reverse for display (newest first)
      const displayData = [...chronoData].reverse();
      setEntries(displayData);
      setTotalExpenses(expenseSum);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [expense]);

  const resetForm = () => {
    setAmount('');
    setDate('');
    setNote('');
    setEditingEntry(null);
  };

  const updateExpenseLastActivity = async (activityDate) => {
    try {
      await updateDoc(doc(db, 'expenses', expense.id), {
        lastActivityDate: activityDate,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Failed to update expense lastActivityDate:', err);
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
          doc(db, 'expenses', expense.id, 'ledger', editingEntry.id),
          {
            amount: Number(amount),
            date,
            note,
          }
        );
        await updateExpenseLastActivity(date);
        setMessage('Entry updated successfully');
      } else {
        await addDoc(collection(db, 'expenses', expense.id, 'ledger'), {
          amount: Number(amount),
          date,
          note,
          createdAt: serverTimestamp(),
        });
        await updateExpenseLastActivity(date);
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
    setDate(entry.date);
    setNote(entry.note);
  };

  const handleDeleteEntry = async (entryId) => {
    if (!window.confirm('Are you sure you want to delete this entry?')) return;

    try {
      await deleteDoc(doc(db, 'expenses', expense.id, 'ledger', entryId));

      if (entries.length === 1) {
        const remainingEntries = entries.filter((e) => e.id !== entryId);
        const mostRecentDate = remainingEntries[0]?.date || null;
        await updateExpenseLastActivity(mostRecentDate);
      } else {
        await updateDoc(doc(db, 'expenses', expense.id), {
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
        generatedDate: new Date().toLocaleDateString('en-IN'),
      };

      // Trigger PDF generation
      const success = await exportLedgerToPDF(
        pdfData,
        `Expense_Ledger_${expense.name.replace(/[^a-zA-Z0-9]/g, '_')}_${exportStart}_to_${exportEnd || 'current'}.pdf`
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

  if (!expense) return null;

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #ffebee, #ffcdd2)', padding: '24px' }}>
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
          ← Back to Expenses
        </button>

        {/* Header */}
        <h2 style={{ marginTop: 0, color: '#1a237e' }}>Ledger for {expense.name}</h2>
        <p style={{ color: '#546e7a', marginBottom: '16px' }}>
          Total Expenses: Rs. {formatAmount(totalExpenses)}
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
              backgroundColor: '#f44336',
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
            backgroundColor: '#ffebee',
            color: '#c62828',
            fontSize: '14px'
          }}>
            {message}
          </div>
        )}

        {/* EXPORT SECTION */}
        <div style={{
          marginBottom: '20px',
          padding: '16px',
          backgroundColor: '#ffebee',
          borderRadius: '10px',
          border: '2px solid #f44336'
        }}>
          <h4 style={{ margin: '0 0 12px 0', color: '#c62828' }}>📊 Export Ledger to PDF</h4>
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
                  border: '2px solid #f44336',
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
                backgroundColor: exportLoading || !exportStart ? '#bdbdbd' : '#f44336',
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
          <p style={{ color: '#78909c' }}>No expense entries yet</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px' }}>
            <thead>
              <tr style={{ backgroundColor: '#eeeeee' }}>
                <th style={{ border: '1px solid #e0e0e0', padding: '8px' }}>Date</th>
                <th style={{ border: '1px solid #e0e0e0', padding: '8px' }}>Amount</th>
                <th style={{ border: '1px solid #e0e0e0', padding: '8px' }}>Running Total</th>
                <th style={{ border: '1px solid #e0e0e0', padding: '8px' }}>Note</th>
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
                    color: '#d32f2f',
                    fontWeight: '600'
                  }}>
                    Rs. {formatAmount(entry.amount)}
                  </td>
                  <td style={{ border: '1px solid #e0e0e0', padding: '8px', fontSize: '14px' }}>
                    Rs. {formatAmount(entry.runningTotal)}
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

export default ExpenseLedger;
