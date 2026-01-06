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
  const [exportStart, setExportStart] = useState('');
  const [exportEnd, setExportEnd] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false); // Mobile responsive hook

  // Mobile responsive detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-format date input (20820715 -> 2082-07-15)
  const handleDateChange = (e) => {
    let value = e.target.value.replace(/[^0-9]/g, ''); // Only numbers
    // Auto-format: after 4 digits (year) add -, after 6 digits (year-month) add -
    if (value.length >= 4) value = value.slice(0, 4) + '-' + value.slice(4);
    if (value.length >= 7) value = value.slice(0, 7) + '-' + value.slice(7);
    setDate(value);
  };

  // Same for export date inputs
  const handleExportDateChange = (setter) => (e) => {
    let value = e.target.value.replace(/[^0-9]/g, '');
    if (value.length >= 4) value = value.slice(0, 4) + '-' + value.slice(4);
    if (value.length >= 7) value = value.slice(0, 7) + '-' + value.slice(7);
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
        return { id: d.id, ...raw, amount: amt };
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
        return { ...entry, runningTotal };
      });

      // Reverse for display (newest first)
      const displayData = [...chronoData.reverse()];
      setEntries(displayData);
      setTotalExpenses(expenseSum);
      setLoading(false);
    });

    return unsubscribe;
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
        ...(activityDate && { lastActivityDate: activityDate }),
        updatedAt: serverTimestamp()
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
          { amount: Number(amount), date, note }
        );
        await updateExpenseLastActivity(date);
        setMessage('Entry updated successfully');
      } else {
        await addDoc(collection(db, 'expenses', expense.id, 'ledger'), {
          amount: Number(amount),
          date,
          note,
          createdAt: serverTimestamp()
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
          updatedAt: serverTimestamp()
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

  if (!expense) return null;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)',
      display: 'flex',
      flexDirection: 'column',
      width: '100vw',
      margin: 0,
      padding: isMobile ? '0px 12px' : '24px',
      overflowX: 'hidden',
      boxSizing: 'border-box'
    }}>
      <div style={{
        maxWidth: isMobile ? '100vw' : '1200px',
        margin: isMobile ? '0' : '0 auto',
        width: '100%',
        backgroundColor: '#ffffff',
        borderRadius: isMobile ? '0' : '16px',
        padding: isMobile ? '16px' : '32px',
        boxShadow: isMobile ? 'none' : '0 8px 32px rgba(0,0,0,0.12)',
        border: isMobile ? 'none' : '1px solid #e0e0e0',
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
            padding: '12px 20px',
            borderRadius: '999px',
            border: '1px solid #cfd8dc',
            backgroundColor: '#fafafa',
            cursor: 'pointer',
            fontSize: '14px',
            color: '#607d8b',
            fontWeight: '500'
          }}>
            ← Back to Expenses
          </button>
          <div>
            <h2 style={{
              margin: '0 0 16px 0',
              color: '#1a237e',
              fontSize: isMobile ? '28px' : '32px',
              fontWeight: 'bold'
            }}>
              Ledger for <span style={{ color: '#c62828', fontWeight: 'bold' }}>{expense.name}</span>
            </h2>
            {/* Bold Colored Total Expenses */}
            <p style={{
              margin: 0,
              fontSize: isMobile ? '18px' : '20px',
              fontWeight: '800',
              color: '#d32f2f'
            }}>
              Total Expenses: <span style={{ fontSize: isMobile ? '22px' : '24px', fontWeight: '900', color: '#b71c1c' }}>
                Rs. {formatAmount(totalExpenses)}
              </span>
            </p>
          </div>
        </div>

        {/* Add/Edit Form */}
        <div style={{
          display: 'flex',
          gap: isMobile ? '12px' : '16px',
          flexWrap: 'wrap',
          marginBottom: isMobile ? '20px' : '24px',
          flexDirection: isMobile ? 'column' : 'row',
          backgroundColor: '#f5f5f5',
          padding: isMobile ? '16px' : '24px',
          borderRadius: '16px'
        }}>
          <div style={{ flex: isMobile ? '1 1 100%' : '0 0 140px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#37474f', fontSize: '14px' }}>
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
                borderRadius: '10px',
                border: '1px solid #cfd8dc',
                outline: 'none',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>
          <div style={{ flex: isMobile ? '1 1 100%' : '0 0 160px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#37474f', fontSize: '14px' }}>
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
                borderRadius: '10px',
                border: '1px solid #cfd8dc',
                outline: 'none',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>
          <div style={{ flex: isMobile ? '1 1 100%' : '1', minWidth: isMobile ? 'auto' : '140px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#37474f', fontSize: '14px' }}>
              Note (optional)
            </label>
            <input
              type="text"
              placeholder="Note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '10px',
                border: '1px solid #cfd8dc',
                outline: 'none',
                fontSize: '14px',
                boxSizing: 'border-box'
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
                borderRadius: '10px',
                border: 'none',
                backgroundColor: '#f44336',
                color: '#fff',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '14px',
                whiteSpace: 'nowrap',
                minHeight: '48px',
                flex: isMobile ? '1 1 100%' : 'auto'
              }}
            >
              {editingEntry ? 'Update Entry' : 'Add Entry'}
            </button>
            {editingEntry && (
              <button
                onClick={resetForm}
                style={{
                  padding: '12px 24px',
                  borderRadius: '10px',
                  border: '1px solid #cfd8dc',
                  backgroundColor: '#fafafa',
                  color: '#607d8b',
                  cursor: 'pointer',
                  fontWeight: '500',
                  fontSize: '14px',
                  minHeight: '48px',
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
            border: '1px solid #ffccdd'
          }}>
            {message}
          </div>
        )}

        {/* EXPORT SECTION - RED THEME */}
        <div style={{
          marginBottom: isMobile ? '24px' : '32px',
          padding: isMobile ? '16px' : '24px',
          backgroundColor: '#ffebee',
          borderRadius: '16px',
          border: '2px solid #f44336'
        }}>
          <h4 style={{ margin: '0 0 20px 0', color: '#c62828', fontSize: isMobile ? '18px' : '20px' }}>
            Export Ledger to PDF
          </h4>
          <div style={{
            display: 'flex',
            gap: isMobile ? '12px' : '16px',
            flexWrap: 'wrap',
            alignItems: 'end'
          }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#555', marginBottom: '6px', fontWeight: '500' }}>
                From Date *
              </label>
              <input
                type="text"
                placeholder="2082-07-15"
                value={exportStart}
                onChange={handleExportDateChange(setExportStart)}
                style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: '2px solid #f44336',
                  minWidth: isMobile ? '140px' : '160px',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#555', marginBottom: '6px', fontWeight: '500' }}>
                To Date (optional)
              </label>
              <input
                type="text"
                placeholder="2082-12-15"
                value={exportEnd}
                onChange={handleExportDateChange(setExportEnd)}
                style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
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
                padding: '14px 28px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: exportLoading || !exportStart ? '#bdbdbd' : '#f44336',
                color: '#fff',
                cursor: exportLoading || !exportStart ? 'not-allowed' : 'pointer',
                fontWeight: '600',
                fontSize: '14px',
                minHeight: '52px',
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
            Loading ledger...
          </p>
        ) : entries.length === 0 ? (
          <p style={{ color: '#78909c', textAlign: 'center', padding: '60px', fontSize: '16px' }}>
            No expense entries yet
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              marginTop: '8px',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#ffebee' }}>
                  <th style={{ border: '1px solid #e0e0e0', padding: isMobile ? '12px 8px' : '16px 12px', fontSize: '14px', fontWeight: '600', whiteSpace: 'nowrap', color: '#c62828' }}>
                    Date
                  </th>
                  <th style={{ border: '1px solid #e0e0e0', padding: isMobile ? '12px 8px' : '16px 12px', fontSize: '14px', fontWeight: '600', whiteSpace: 'nowrap', color: '#c62828' }}>
                    Amount
                  </th>
                  <th style={{ border: '1px solid #e0e0e0', padding: isMobile ? '12px 8px' : '16px 12px', fontSize: '14px', fontWeight: '600', whiteSpace: 'nowrap', color: '#c62828' }}>
                    Running Total
                  </th>
                  <th style={{ border: '1px solid #e0e0e0', padding: isMobile ? '12px 8px' : '16px 12px', fontSize: '14px', fontWeight: '600', whiteSpace: 'nowrap', color: '#c62828' }}>
                    Note
                  </th>
                  <th style={{ border: '1px solid #e0e0e0', padding: isMobile ? '12px 8px' : '16px 12px', fontSize: '14px', fontWeight: '600', whiteSpace: 'nowrap', color: '#c62828' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr
                    key={entry.id}
                    style={{
                      backgroundColor: entry.id === editingEntry?.id ? '#ffebee' : 'transparent',
                      transition: 'background-color 0.2s'
                    }}
                  >
                    <td style={{ border: '1px solid #e0e0e0', padding: isMobile ? '12px 8px' : '16px 12px', fontSize: '14px' }}>
                      {entry.date}
                    </td>
                    <td style={{
                      border: '1px solid #e0e0e0',
                      padding: isMobile ? '12px 8px' : '16px 12px',
                      color: '#d32f2f',
                      fontWeight: '600'
                    }}>
                      Rs. {formatAmount(entry.amount)}
                    </td>
                    <td style={{
                      border: '1px solid #e0e0e0',
                      padding: isMobile ? '12px 8px' : '16px 12px',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#b71c1c'
                    }}>
                      Rs. {formatAmount(entry.runningTotal)}
                    </td>
                    <td style={{ border: '1px solid #e0e0e0', padding: isMobile ? '12px 8px' : '16px 12px', fontSize: '14px', color: '#455a64' }}>
                      {entry.note || '-'}
                    </td>
                    <td style={{ border: '1px solid #e0e0e0', padding: isMobile ? '12px 8px' : '16px 12px' }}>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => startEditEntry(entry)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '6px',
                            border: '1px solid #42a5f5',
                            backgroundColor: '#e3f2fd',
                            color: '#1976d2',
                            fontSize: '12px',
                            cursor: 'pointer',
                            fontWeight: '500'
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteEntry(entry.id)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '6px',
                            border: '1px solid #ef5350',
                            backgroundColor: '#ffebee',
                            color: '#d32f2f',
                            fontSize: '12px',
                            cursor: 'pointer',
                            fontWeight: '500'
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpenseLedger;
