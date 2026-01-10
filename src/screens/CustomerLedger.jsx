import React, { useEffect, useState } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { exportLedgerToPDF, formatIndianCurrency } from '../utils/pdfExport';
import LedgerPDFTemplate from '../components/LedgerPDFTemplate';

import { useBadDebt } from '../utils/badDebtCalculator';

const CustomerLedger = ({ customer, onBack }) => {
  const [entries, setEntries] = useState([]);

  const [amount, setAmount] = useState('');
  const [type, setType] = useState('sale');
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [totalSale, setTotalSale] = useState(0);
  const [totalPayment, setTotalPayment] = useState(0);
  const [editingEntry, setEditingEntry] = useState(null);
  const [message, setMessage] = useState('');
  const [exportStart, setExportStart] = useState('');
  const [exportEnd, setExportEnd] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // useBadDebt Hook
  const { hasBadDebt, badDebtAmount, oldestUnpaidDate } = useBadDebt(entries);



  // Mobile responsive detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-format date input
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
    if (!customer?.id) return;

    const q = query(
      collection(db, 'customers', customer.id, 'ledger'),
      orderBy('createdAt', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let chronoData = snapshot.docs.map((d) => {
        const raw = d.data();
        const amt = Number(raw.amount) || 0;
        return { id: d.id, ...raw, amount: amt };
      }).filter(d => !d.isDeleted);

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
      let saleSum = 0;
      let paymentSum = 0;
      chronoData = chronoData.map((entry) => {
        const amt = entry.amount;
        if (entry.type === 'sale') {
          runningBalance += amt;
          saleSum += amt;
        } else if (entry.type === 'payment') {
          runningBalance -= amt;
          paymentSum += amt;
        }
        return { ...entry, runningBalance };
      });

      const displayData = [...chronoData.reverse()];
      setEntries(displayData);
      setTotalSale(saleSum);
      setTotalPayment(paymentSum);
      setLoading(false);
    });

    return unsubscribe;
  }, [customer]);

  const resetForm = () => {
    setAmount('');
    setType('sale');
    setDate('');
    setNote('');
    setEditingEntry(null);
  };

  const updateCustomerLastActivity = async (activityDate) => {
    try {
      await updateDoc(doc(db, 'customers', customer.id), {
        ...(activityDate && { lastActivityDate: activityDate }),
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Failed to update customer lastActivityDate:', err);
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
        updateDoc(
          doc(db, 'customers', customer.id, 'ledger', editingEntry.id),
          { amount: Number(amount), type, date, note }
        ).catch(err => console.error("Offline sync pending or failed:", err));

        updateCustomerLastActivity(date);
        setMessage('Entry updated');
      } else {
        addDoc(collection(db, 'customers', customer.id, 'ledger'), {
          amount: Number(amount),
          type,
          date,
          note,
          createdAt: serverTimestamp()
        }).catch(err => console.error("Offline sync pending or failed:", err));

        updateCustomerLastActivity(date);
        setMessage('Entry added');
      }
      resetForm();
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
  };

  const handleDeleteEntry = async (entryId) => {
    if (!window.confirm('Are you sure you want to delete this entry?')) return;
    try {
      updateDoc(doc(db, 'customers', customer.id, 'ledger', entryId), {
        isDeleted: true,
        deletedAt: serverTimestamp(),
        parentName: customer.name // Helpers for Recycle Bin display
      }).catch(err => console.error("Offline sync pending or failed:", err));

      if (entries.length === 1) {
        const remainingEntries = entries.filter((e) => e.id !== entryId);
        const mostRecentDate = remainingEntries[0]?.date || null;
        updateCustomerLastActivity(mostRecentDate);
      } else {
        updateDoc(doc(db, 'customers', customer.id), {
          lastActivityDate: null,
          updatedAt: serverTimestamp()
        }).catch(err => console.error("Update failed:", err));
      }
      setMessage('Entry deleted');
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
        const entryDate = entry.date; // String yyyy-mm-dd
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
          return e.type === 'sale' ? sum + e.amount : sum - e.amount;
        }, 0);

      const closingBalance = filteredEntries[filteredEntries.length - 1]?.runningBalance || openingBalance;

      const periodSales = filteredEntries
        .filter((e) => e.type === 'sale')
        .reduce((sum, e) => sum + e.amount, 0);
      const periodPayments = filteredEntries
        .filter((e) => e.type === 'payment')
        .reduce((sum, e) => sum + e.amount, 0);

      const pdfData = {
        entityName: customer.name,
        entityType: 'customer',
        entries: filteredEntries.sort((a, b) => new Date(a.date) - new Date(b.date)),
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

  const balance = totalSale - totalPayment;

  if (!customer) return null;

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
          <div>
            <h2 style={{
              margin: 0,
              color: '#1a237e',
              fontSize: isMobile ? '24px' : '28px',
              fontWeight: 'bold'
            }}>
              Ledger: <span style={{ color: '#2e7d32' }}>{customer.name}</span>
            </h2>
          </div>
        </div>

        {/* BAD DEBT ALERT */}
        {hasBadDebt && (
          <div style={{
            marginBottom: isMobile ? '20px' : '32px',
            padding: '16px',
            backgroundColor: '#ffebee',
            color: '#b71c1c',
            borderRadius: '16px',
            border: '1px solid #ef5350',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            boxShadow: '0 4px 12px rgba(239, 83, 80, 0.15)'
          }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '50%', background: '#ffcdd2',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              fontSize: '20px'
            }}>
              ⚠️
            </div>
            <div>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '800' }}>Bad Debt Alert</h4>
              <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.5' }}>
                Total Old Debt: <strong style={{ textDecoration: 'underline' }}>Rs. {formatAmount(badDebtAmount)}</strong>.
                Oldest unpaid sale date: <strong>{oldestUnpaidDate}</strong> (&gt; 6 months).
              </p>
            </div>
          </div>
        )}

        {/* NEW TOTALS CARD DESIGN - Updated for Aesthetics */}
        <div style={{
          marginBottom: isMobile ? '20px' : '32px',
          padding: isMobile ? '20px' : '32px',
          background: 'white',
          borderRadius: '20px',
          border: '1px solid #e0e0e0',
          boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
          background: 'linear-gradient(to right, #ffffff, #f9fafb)'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)',
            gap: isMobile ? '16px' : '20px',
            alignItems: 'center'
          }}>
            {/* Total Sale */}
            <div style={{ textAlign: 'center', padding: '16px', background: '#f1f8e9', borderRadius: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#558b2f', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Total Sales
              </div>
              <div style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 'bold', color: '#2e7d32', marginTop: '4px' }}>
                Rs. {formatAmount(totalSale)}
              </div>
            </div>

            {/* Total Payment */}
            <div style={{ textAlign: 'center', padding: '16px', background: '#ffebee', borderRadius: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#c62828', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Total Received
              </div>
              <div style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 'bold', color: '#d32f2f', marginTop: '4px' }}>
                Rs. {formatAmount(totalPayment)}
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
                color: balance >= 0 ? '#1565c0' : '#c62828',
                marginTop: '4px'
              }}>
                Rs. {formatAmount(balance)}
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
                transition: 'border-color 0.2s',
                fontWeight: '500'
              }}
              onFocus={(e) => e.target.style.borderColor = '#1a237e'}
              onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
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
              <option value="sale">Sale</option>
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
                backgroundColor: '#1a237e',
                color: '#fff',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '14px',
                whiteSpace: 'nowrap',
                minHeight: '46px',
                flex: isMobile ? '1 1 100%' : 'auto',
                boxShadow: '0 4px 12px rgba(26, 35, 126, 0.2)'
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

        {/* Message */}
        {message && (
          <div style={{
            marginBottom: isMobile ? '16px' : '24px',
            padding: '16px 20px',
            borderRadius: '12px',
            backgroundColor: '#e8eaf6',
            color: '#1a237e',
            fontSize: '14px',
            border: '1px solid #c5cae9',
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
          <h4 style={{ margin: '0 0 16px 0', color: '#1a237e', fontSize: '16px', fontWeight: 'bold' }}>
            Export Ledger to PDF
          </h4>
          <div style={{
            display: 'flex',
            gap: isMobile ? '12px' : '16px',
            flexWrap: 'wrap',
            alignItems: 'end'
          }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#546e7a', marginBottom: '6px', fontWeight: '600' }}>
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
              <label style={{ display: 'block', fontSize: '12px', color: '#546e7a', marginBottom: '6px', fontWeight: '600' }}>
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
                backgroundColor: exportLoading || !exportStart ? '#e0e0e0' : '#1a237e',
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
            Loading ledger key data...
          </p>
        ) : entries.length === 0 ? (
          <p style={{ color: '#78909c', textAlign: 'center', padding: '60px', fontSize: '14px', background: '#f9fafb', borderRadius: '12px' }}>
            No entries found. Add your first transaction above.
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
                  <th style={{ padding: '16px 12px', fontSize: '13px', fontWeight: '700', color: '#1a237e', borderBottom: '1px solid #e0e0e0', textAlign: 'left' }}>
                    Date
                  </th>
                  <th style={{ padding: '16px 12px', fontSize: '13px', fontWeight: '700', color: '#1a237e', borderBottom: '1px solid #e0e0e0', textAlign: 'right' }}>
                    Debit (Sale)
                  </th>
                  <th style={{ padding: '16px 12px', fontSize: '13px', fontWeight: '700', color: '#1a237e', borderBottom: '1px solid #e0e0e0', textAlign: 'right' }}>
                    Credit (Received)
                  </th>
                  <th style={{ padding: '16px 12px', fontSize: '13px', fontWeight: '700', color: '#1a237e', borderBottom: '1px solid #e0e0e0', textAlign: 'right' }}>
                    Balance
                  </th>
                  <th style={{ padding: '16px 12px', fontSize: '13px', fontWeight: '700', color: '#1a237e', borderBottom: '1px solid #e0e0e0', textAlign: 'left' }}>
                    Details
                  </th>
                  <th style={{ padding: '16px 12px', fontSize: '13px', fontWeight: '700', color: '#1a237e', borderBottom: '1px solid #e0e0e0', textAlign: 'center' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => (
                  <tr
                    key={entry.id}
                    style={{
                      backgroundColor: entry.id === editingEntry?.id ? '#e8eaf6' : (index % 2 === 0 ? 'white' : '#fafafa'),
                      transition: 'background-color 0.2s'
                    }}
                  >
                    <td style={{ padding: '14px 12px', fontSize: '14px', color: '#37474f', borderBottom: '1px solid #f0f0f0' }}>
                      {entry.date}
                    </td>
                    <td style={{ padding: '14px 12px', fontSize: '14px', fontWeight: entry.type === 'sale' ? '600' : '400', color: entry.type === 'sale' ? '#2e7d32' : '#b0bec5', textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>
                      {entry.type === 'sale' ? formatAmount(entry.amount) : '-'}
                    </td>
                    <td style={{ padding: '14px 12px', fontSize: '14px', fontWeight: entry.type === 'payment' ? '600' : '400', color: entry.type === 'payment' ? '#c62828' : '#b0bec5', textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>
                      {entry.type === 'payment' ? formatAmount(entry.amount) : '-'}
                    </td>
                    <td style={{ padding: '14px 12px', fontSize: '14px', fontWeight: '700', color: entry.runningBalance >= 0 ? '#1a237e' : '#c62828', textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>
                      {formatAmount(entry.runningBalance)}
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
          </div>
        )}

        {/* HIDDEN PDF TEMPLATE */}
        <div style={{ display: 'none' }}>
          <LedgerPDFTemplate
            entityName={customer.name}
            entityType="customer"
            entries={entries.filter((entry) => {
              const entryDate = new Date(entry.date);
              const startDate = exportStart ? new Date(exportStart) : null;
              const endDate = exportEnd ? new Date(exportEnd) : new Date('9999-12-31');
              return !startDate || (entryDate >= startDate && entryDate <= endDate);
            })}
            openingBalance={0}
            closingBalance={0}
            totalDebit={0}
            totalCredit={0}
            dateRange={{ from: exportStart, to: exportEnd }}
            generatedDate={new Date().toLocaleDateString('en-IN')}
          />
        </div>
      </div>
    </div>
  );
};

export default CustomerLedger;