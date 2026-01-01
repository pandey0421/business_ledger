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

      const openingBalance = entries
        .filter((e) => new Date(e.date) < new Date(exportStart))
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
      background: 'linear-gradient(135deg, #fffde7 0%, #e3f2fd 100%)',
      display: 'flex',
      flexDirection: 'column',
      width: '100vw',
      margin: 0,
      padding: isMobile ? '0px 12px 24px' : '0px 32px 24px',
      overflowX: 'hidden',
      boxSizing: 'border-box'
    }}>
      <div style={{
        maxWidth: isMobile ? '100vw' : '1200px',
        margin: isMobile ? '0 auto 0' : '0 auto',
        width: '100%',
        backgroundColor: 'ffffff',
        borderRadius: isMobile ? '0 16px' : '16px',
        padding: isMobile ? '16px 32px' : '32px',
        boxShadow: isMobile ? 'none' : '0 8px 32px rgba(0,0,0,0.12)',
        border: isMobile ? 'none' : '1px solid #e0e0e0',
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
            padding: '12px 20px',
            borderRadius: '999px',
            border: '1px solid #cfd8dc',
            backgroundColor: 'fafafa',
            cursor: 'pointer',
            fontSize: '14px',
            color: '#607d8b',
            fontWeight: '500'
          }}>
            Back to Suppliers
          </button>
          <div>
            <h2 style={{
              margin: '0 0 16px 0',
              color: '#1a237e',
              fontSize: isMobile ? '28px' : '32px',
              fontWeight: 'bold'
            }}>
              Ledger for <span style={{ color: '#ef6c00', fontWeight: 'bold' }}>{supplier.name}</span>
            </h2>
          </div>
        </div>

        {/* FIXED TOTALS CARD */}
        <div style={{
          marginBottom: isMobile ? '20px' : '24px',
          padding: isMobile ? '20px 16px 24px 28px' : '24px 28px',
          background: 'linear-gradient(135deg, #fff3e0 0%, #fce4ec 100%)',
          borderRadius: '16px',
          border: '2px solid #fb8c00',
          boxShadow: '0 4px 16px rgba(251, 140, 0, 0.15)'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr',
            gap: isMobile ? '16px' : '20px',
            alignItems: 'end'
          }}>
            <div style={{ textAlign: isMobile ? 'center' : 'left' }}>
              <div style={{
                fontSize: isMobile ? '14px' : '16px',
                fontWeight: '700',
                color: '#ef6c00',
                marginBottom: '4px'
              }}>
                Total Purchase
              </div>
              <div style={{
                fontSize: isMobile ? '24px' : '28px',
                fontWeight: '400',
                color: '#e65100'
              }}>
                {formatIndianCurrency(totalPurchase)}
              </div>
            </div>
            <div style={{ textAlign: isMobile ? 'center' : 'left' }}>
              <div style={{
                fontSize: isMobile ? '14px' : '16px',
                fontWeight: '700',
                color: '#c62828',
                marginBottom: '4px'
              }}>
                Total Payment
              </div>
              <div style={{
                fontSize: isMobile ? '24px' : '28px',
                fontWeight: '400',
                color: '#b71c1c'
              }}>
                {formatIndianCurrency(totalPayment)}
              </div>
            </div>
            <div style={{ textAlign: isMobile ? 'center' : 'right' }}>
              <div style={{
                fontSize: isMobile ? '14px' : '16px',
                fontWeight: '700',
                color: '#1976d2',
                marginBottom: '4px'
              }}>
                Balance
              </div>
              <div style={{
                fontSize: isMobile ? '24px' : '28px',
                fontWeight: '600',
                color: balance >= 0 ? '#e65100' : '#d32f2f'
              }}>
                {formatIndianCurrency(balance)}
              </div>
            </div>
          </div>
        </div>

        {/* Add/Edit Form - WHITE background like CustomerLedger */}
        <div style={{
          display: 'flex',
          gap: isMobile ? '12px' : '16px',
          flexWrap: 'wrap',
          marginBottom: isMobile ? '20px' : '24px',
          flexDirection: isMobile ? 'column' : 'row',
          backgroundColor: '#f5f5f5',  // WHITE/GRAY background like CustomerLedger
          padding: isMobile ? '16px 24px' : '24px',
          borderRadius: '16px'
        }}>
          <div style={{ flex: isMobile ? '1 1 100%' : '0 0 140px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#37474f', fontSize: '14px' }}>
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
                borderRadius: '10px',
                border: '1px solid #cfd8dc',
                outline: 'none',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ flex: isMobile ? '1 1 100%' : '0 0 120px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#37474f', fontSize: '14px' }}>
              Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '10px',
                border: '1px solid #cfd8dc',
                backgroundColor: 'fff',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            >
              <option value="purchase">Purchase</option>
              <option value="payment">Payment</option>
            </select>
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
                backgroundColor: '#fb8c00',  // Orange button only
                color: 'fff',
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
                  backgroundColor: 'fafafa',
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
            Loading ledger...
          </p>
        ) : entries.length === 0 ? (
          <p style={{ color: '#78909c', textAlign: 'center', padding: '60px', fontSize: '16px' }}>
            No ledger entries
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
  <tr style={{ backgroundColor: '#c2bfbfff' }}> {/* WHITE/GRAY header like CustomerLedger */}
    <th style={{
  border: '1px solid #e0e0e0',
  padding: isMobile ? '12px 8px' : '16px 12px',  // ✅ FIXED mobile padding
  fontSize: '14px',
  fontWeight: '600',
  whiteSpace: 'nowrap',
  backgroundColor: 'eeeeee'  // ✅ WHITE header for ALL sizes
}}>Date</th>
<th style={{
  border: '1px solid #e0e0e0',
  padding: isMobile ? '12px 8px' : '16px 12px',  // ✅ FIXED mobile padding
  fontSize: '14px',
  fontWeight: '600',
  whiteSpace: 'nowrap',
  backgroundColor: 'eeeeee'  // ✅ WHITE header for ALL sizes
}}>Purchase</th>
    <th style={{
      border: '1px solid #e0e0e0',
      padding: isMobile ? '12px 8px 16px 12px' : '16px 12px',
      fontSize: '14px',
      fontWeight: '600',
      whiteSpace: 'nowrap'
    }}>Payment</th>
    <th style={{
      border: '1px solid #e0e0e0',
      padding: isMobile ? '12px 8px 16px 12px' : '16px 12px',
      fontSize: '14px',
      fontWeight: '600',
      whiteSpace: 'nowrap'
    }}>Balance</th>
    <th style={{
      border: '1px solid #e0e0e0',
      padding: isMobile ? '12px 8px 16px 12px' : '16px 12px',
      fontSize: '14px',
      fontWeight: '600',
      whiteSpace: 'nowrap'
    }}>Details</th>
    <th style={{
      border: '1px solid #e0e0e0',
      padding: isMobile ? '12px 8px 16px 12px' : '16px 12px',
      fontSize: '14px',
      fontWeight: '600',
      whiteSpace: 'nowrap'
    }}>Actions</th>
  </tr>
</thead>

              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} style={{
                    backgroundColor: entry.id === editingEntry?.id ? '#fff3e0' : 'transparent',
                    transition: 'background-color 0.2s'
                  }}>
                    <td style={{
                      border: '1px solid #e0e0e0',
                      padding: isMobile ? '12px 8px 16px 12px' : '16px 12px',
                      fontSize: '14px'
                    }}>
                      {entry.date}
                    </td>
                    <td style={{
                      border: '1px solid #e0e0e0',
                      padding: isMobile ? '12px 8px 16px 12px' : '16px 12px',
                      color: entry.type === 'purchase' ? '#ef6c00' : '#9e9e9e',
                      fontWeight: entry.type === 'purchase' ? '600' : '400'
                    }}>
                      {entry.type === 'purchase' ? formatAmount(entry.amount) : '-'}
                    </td>
                    <td style={{
                      border: '1px solid #e0e0e0',
                      padding: isMobile ? '12px 8px 16px 12px' : '16px 12px',
                      color: entry.type === 'payment' ? '#c62828' : '#9e9e9e',
                      fontWeight: entry.type === 'payment' ? '600' : '400'
                    }}>
                      {entry.type === 'payment' ? formatAmount(entry.amount) : '-'}
                    </td>
                    <td style={{
                      border: '1px solid #e0e0e0',
                      padding: isMobile ? '12px 8px 16px 12px' : '16px 12px',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: entry.runningBalance >= 0 ? '#e65100' : '#d32f2f'
                    }}>
                      {formatAmount(entry.runningBalance)}
                    </td>
                    <td style={{
                      border: '1px solid #e0e0e0',
                      padding: isMobile ? '12px 8px 16px 12px' : '16px 12px',
                      fontSize: '14px',
                      color: '#455a64'
                    }}>
                      {entry.note || '-'}
                    </td>
                    <td style={{
                      border: '1px solid #e0e0e0',
                      padding: isMobile ? '12px 8px 16px 12px' : '16px 12px'
                    }}>
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

export default SupplierLedger;