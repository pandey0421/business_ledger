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
  const [exportStart, setExportStart] = useState('');
  const [exportEnd, setExportEnd] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Mobile responsive detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-format date input (20820715 -> 2082-07-15)
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
          amount: amt
        };
      });

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
        return { ...entry, runningBalance };
      });

      const displayData = [...chronoData.reverse()];
      setEntries(displayData);
      setTotalPurchase(purchaseSum);
      setTotalPayment(paymentSum);
      setLoading(false);
    });

    return unsubscribe;
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
        ...(activityDate && { lastActivityDate: activityDate }),
        updatedAt: serverTimestamp()
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
          { amount: Number(amount), type, date, note }
        );
        await updateSupplierLastActivity(date);
        setMessage('Entry updated successfully');
      } else {
        await addDoc(collection(db, 'suppliers', supplier.id, 'ledger'), {
          amount: Number(amount),
          type,
          date,
          note,
          createdAt: serverTimestamp()
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

  const handleExportPDF = async () => {
    if (!exportStart) {
      setMessage('Please select a start date for export');
      return;
    }
    setExportLoading(true);
    setMessage('');

    try {
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

      const openingBalance = entries
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
        entries: filteredEntries.sort((a, b) => new Date(a.date) - new Date(b.date)),
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

  const balance = totalPurchase - totalPayment;

  if (!supplier) return null;

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
        {/* Back Button Header */}
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
          <div>
            <h2 style={{
              margin: 0,
              color: '#1a237e',
              fontSize: isMobile ? '24px' : '28px',
              fontWeight: 'bold'
            }}>
              Ledger: <span style={{ color: '#ef6c00' }}>{supplier.name}</span>
            </h2>
          </div>
        </div>

        {/* FIXED TOTALS CARD */}
        <div style={{
          marginBottom: isMobile ? '20px' : '32px',
          padding: isMobile ? '20px' : '32px',
          background: 'white',
          borderRadius: '20px',
          border: '1px solid #e0e0e0',
          boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
          background: 'linear-gradient(to right, #ffffff, #fff3e0)' // Subtle orange hint
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)',
            gap: isMobile ? '16px' : '20px',
            alignItems: 'center'
          }}>
            {/* Total Purchase */}
            <div style={{ textAlign: 'center', padding: '16px', background: '#fff3e0', borderRadius: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#e65100', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Total Purchase
              </div>
              <div style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 'bold', color: '#e65100', marginTop: '4px' }}>
                {formatIndianCurrency(totalPurchase)}
              </div>
            </div>

            {/* Total Payment */}
            <div style={{ textAlign: 'center', padding: '16px', background: '#ffebee', borderRadius: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#c62828', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Total Paid
              </div>
              <div style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 'bold', color: '#c62828', marginTop: '4px' }}>
                {formatIndianCurrency(totalPayment)}
              </div>
            </div>

            {/* Balance */}
            <div style={{ textAlign: 'center', padding: '16px', background: '#e3f2fd', borderRadius: '16px', gridColumn: isMobile ? 'span 2' : 'auto' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#1565c0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Payable Balance
              </div>
              <div style={{
                fontSize: isMobile ? '24px' : '32px',
                fontWeight: '800',
                color: balance >= 0 ? '#e65100' : '#d32f2f',
                marginTop: '4px'
              }}>
                {formatIndianCurrency(balance)}
              </div>
            </div>
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
              Amount
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

          <div style={{ flex: isMobile ? '1 1 100%' : '0 0 120px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#455a64', fontSize: '12px' }}>
              Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '12px',
                border: '1px solid #e0e0e0',
                backgroundColor: '#fff',
                fontSize: '14px',
                boxSizing: 'border-box',
                fontWeight: '500'
              }}
            >
              <option value="purchase">Purchase</option>
              <option value="payment">Payment</option>
            </select>
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
                backgroundColor: '#ef6c00',
                color: '#fff',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '14px',
                whiteSpace: 'nowrap',
                minHeight: '46px',
                flex: isMobile ? '1 1 100%' : 'auto',
                boxShadow: '0 4px 12px rgba(239, 108, 0, 0.2)'
              }}
            >
              {editingEntry ? 'Update' : 'Add Entry'}
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

        {message && (
          <div style={{
            marginBottom: isMobile ? '16px' : '24px',
            padding: '16px 20px',
            borderRadius: '12px',
            backgroundColor: '#fff3e0',
            color: '#ef6c00',
            fontSize: '14px',
            border: '1px solid #ffe0b2'
          }}>
            {message}
          </div>
        )}

        <div style={{
          marginBottom: isMobile ? '24px' : '32px',
          padding: isMobile ? '16px 24px' : '24px',
          backgroundColor: '#fff3e0',
          borderRadius: '16px',
          border: '2px solid #fb8c00'
        }}>
          <h4 style={{
            margin: '0 0 20px 0',
            color: '#ef6c00',
            fontSize: isMobile ? '18px' : '20px'
          }}>
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
                From Date
              </label>
              <input
                type="text"
                placeholder="2082-07-15"
                value={exportStart}
                onChange={handleExportDateChange(setExportStart)}
                style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: '2px solid #fb8c00',
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
                backgroundColor: exportLoading || !exportStart ? '#bdbdbd' : '#fb8c00',
                color: 'fff',
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

        {loading ? (
          <p style={{ textAlign: 'center', color: '#78909c', fontSize: '16px', padding: '60px' }}>
            Loading ledger key data...
          </p>
        ) : entries.length === 0 ? (
          <p style={{ color: '#78909c', textAlign: 'center', padding: '60px', fontSize: '14px', background: '#f9fafb', borderRadius: '12px' }}>
            No entries found. Add your first purchase above.
          </p>
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
                  <th style={{
                    padding: '16px 12px',
                    fontSize: '13px',
                    fontWeight: '700',
                    color: '#1a237e',
                    borderBottom: '1px solid #e0e0e0',
                    textAlign: 'left'
                  }}>Date</th>
                  <th style={{
                    padding: '16px 12px',
                    fontSize: '13px',
                    fontWeight: '700',
                    color: '#1a237e',
                    borderBottom: '1px solid #e0e0e0',
                    textAlign: 'right'
                  }}>Purchase</th>
                  <th style={{
                    padding: '16px 12px',
                    fontSize: '13px',
                    fontWeight: '700',
                    color: '#1a237e',
                    borderBottom: '1px solid #e0e0e0',
                    textAlign: 'right'
                  }}>Payment</th>
                  <th style={{
                    padding: '16px 12px',
                    fontSize: '13px',
                    fontWeight: '700',
                    color: '#1a237e',
                    borderBottom: '1px solid #e0e0e0',
                    textAlign: 'right'
                  }}>Balance</th>
                  <th style={{
                    padding: '16px 12px',
                    fontSize: '13px',
                    fontWeight: '700',
                    color: '#1a237e',
                    borderBottom: '1px solid #e0e0e0',
                    textAlign: 'left'
                  }}>Details</th>
                  <th style={{
                    padding: '16px 12px',
                    fontSize: '13px',
                    fontWeight: '700',
                    color: '#1a237e',
                    borderBottom: '1px solid #e0e0e0',
                    textAlign: 'center'
                  }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => (
                  <tr key={entry.id} style={{
                    backgroundColor: entry.id === editingEntry?.id ? '#fff3e0' : (index % 2 === 0 ? 'white' : '#fafafa'),
                    transition: 'background-color 0.2s'
                  }}>
                    <td style={{
                      padding: '14px 12px',
                      fontSize: '14px',
                      color: '#37474f',
                      borderBottom: '1px solid #f0f0f0'
                    }}>
                      {entry.date}
                    </td>
                    <td style={{
                      padding: '14px 12px',
                      fontSize: '14px',
                      fontWeight: entry.type === 'purchase' ? '600' : '400',
                      color: entry.type === 'purchase' ? '#ef6c00' : '#b0bec5',
                      textAlign: 'right',
                      borderBottom: '1px solid #f0f0f0'
                    }}>
                      {entry.type === 'purchase' ? formatAmount(entry.amount) : '-'}
                    </td>
                    <td style={{
                      padding: '14px 12px',
                      fontSize: '14px',
                      fontWeight: entry.type === 'payment' ? '600' : '400',
                      color: entry.type === 'payment' ? '#c62828' : '#b0bec5',
                      textAlign: 'right',
                      borderBottom: '1px solid #f0f0f0'
                    }}>
                      {entry.type === 'payment' ? formatAmount(entry.amount) : '-'}
                    </td>
                    <td style={{
                      padding: '14px 12px',
                      fontSize: '14px',
                      fontWeight: '700',
                      color: entry.runningBalance >= 0 ? '#e65100' : '#d32f2f',
                      textAlign: 'right',
                      borderBottom: '1px solid #f0f0f0'
                    }}>
                      {formatAmount(entry.runningBalance)}
                    </td>
                    <td style={{
                      padding: '14px 12px',
                      fontSize: '14px',
                      color: '#455a64',
                      borderBottom: '1px solid #f0f0f0'
                    }}>
                      {entry.note || '-'}
                    </td>
                    <td style={{
                      padding: '14px 12px',
                      textAlign: 'center',
                      borderBottom: '1px solid #f0f0f0'
                    }}>
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
          </div>
        )}
      </div>
    </div>
  );
};

export default SupplierLedger;