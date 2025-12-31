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
      let chronoData = snapshot.docs.map(d => {
        const raw = d.data();
        const amt = Number(raw.amount) || 0;
        return { id: d.id, ...raw, amount: amt };
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
      chronoData = chronoData.map(entry => {
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
        const remainingEntries = entries.filter(e => e.id !== entryId);
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
      const filteredEntries = entries.filter(entry => {
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
        .filter(e => new Date(e.date) < new Date(exportStart))
        .reduce((sum, e) => {
          return e.type === 'purchase' ? sum + e.amount : sum - e.amount;
        }, 0);

      const closingBalance = filteredEntries[filteredEntries.length - 1]?.runningBalance || openingBalance;

      const periodPurchases = filteredEntries
        .filter(e => e.type === 'purchase')
        .reduce((sum, e) => sum + e.amount, 0);
      const periodPayments = filteredEntries
        .filter(e => e.type === 'payment')
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
    <div 
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #fff3e0 0%, #fce4ec 100%)',
        display: 'flex',
        flexDirection: 'column',
        width: '100vw',
        margin: 0,
        padding: '24px',
        overflowX: 'hidden'
      }}
    >
      <div 
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          width: '100%',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          padding: '32px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          border: '1px solid #e0e0e0'
        }}
      >
        {/* Back Button & Header - BOLD ORANGE THEME */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '32px', gap: '16px' }}>
          <button 
            onClick={onBack}
            style={{
              padding: '12px 20px',
              borderRadius: '999px',
              border: '1px solid #cfd8dc',
              backgroundColor: '#fafafa',
              cursor: 'pointer',
              fontSize: '14px',
              color: '#607d8b',
              fontWeight: '500'
            }}
          >
            ← Back to Suppliers
          </button>
          <div>
            <h2 style={{ margin: '0 0 16px 0', color: '#1a237e', fontSize: '32px', fontWeight: 'bold' }}>
              Ledger for <span style={{ color: '#ef6c00', fontWeight: 'bold' }}>{supplier.name}</span>
            </h2>
            
            {/* Bold Colored Totals - SUPPLIER ORANGE THEME */}
            <p style={{ 
              margin: 0, 
              fontSize: '18px', 
              fontWeight: '700',
              color: '#37474f',
              lineHeight: '1.4'
            }}>
              <span style={{ color: '#ef6c00', fontWeight: '800' }}>
                Total Purchase: Rs. {formatAmount(totalPurchase)}
              </span>
              {' | '}
              <span style={{ color: '#c62828', fontWeight: '800' }}>
                Total Payment: Rs. {formatAmount(totalPayment)}
              </span>
              {' | '}
              <span style={{ 
                color: balance >= 0 ? '#e65100' : '#d32f2f', 
                fontWeight: '900',
                fontSize: '20px'
              }}>
                Balance: Rs. {formatAmount(balance)}
              </span>
            </p>
          </div>
        </div>

        {/* Add/Edit Form */}
        <div style={{ 
          display: 'flex', 
          gap: '16px', 
          flexWrap: 'wrap', 
          marginBottom: '24px', 
          backgroundColor: '#f5f5f5', 
          padding: '24px', 
          borderRadius: '16px' 
        }}>
          <div style={{ flex: '0 0 140px' }}>
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
                fontSize: '14px'
              }}
            />
          </div>
          <div style={{ flex: '0 0 120px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#37474f', fontSize: '14px' }}>
              Type *
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '10px',
                border: '1px solid #cfd8dc',
                backgroundColor: '#fff',
                fontSize: '14px'
              }}
            >
              <option value="purchase">Purchase</option>
              <option value="payment">Payment</option>
            </select>
          </div>
          <div style={{ flex: '0 0 160px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#37474f', fontSize: '14px' }}>
              Date * (yyyy-mm-dd)
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
                fontSize: '14px'
              }}
            />
          </div>
          <div style={{ flex: 1, minWidth: '140px' }}>
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
                fontSize: '14px'
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'end', flexWrap: 'wrap' }}>
            <button 
              onClick={addOrUpdateEntry}
              style={{
                padding: '12px 24px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: '#fb8c00',
                color: '#fff',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '14px',
                whiteSpace: 'nowrap',
                minHeight: '48px'
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
                  minHeight: '48px'
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
            marginBottom: '24px', 
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

        {/* EXPORT SECTION - ORANGE THEME */}
        <div style={{ 
          marginBottom: '32px', 
          padding: '24px', 
          backgroundColor: '#fff3e0', 
          borderRadius: '16px', 
          border: '2px solid #fb8c00' 
        }}>
          <h4 style={{ margin: '0 0 20px 0', color: '#ef6c00', fontSize: '20px' }}>
            Export Ledger to PDF
          </h4>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'end' }}>
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
                  border: '2px solid #fb8c00',
                  minWidth: '160px',
                  fontSize: '14px'
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
                  minWidth: '160px',
                  fontSize: '14px'
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
                color: '#fff',
                cursor: exportLoading || !exportStart ? 'not-allowed' : 'pointer',
                fontWeight: '600',
                fontSize: '14px',
                minHeight: '52px'
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
            No ledger entries
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table 
              style={{ 
                width: '100%', 
                borderCollapse: 'collapse', 
                marginTop: '8px',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
              }}
            >
              <thead>
                <tr style={{ backgroundColor: '#fff3e0' }}>
                  <th style={{ border: '1px solid #e0e0e0', padding: '16px 12px', fontSize: '14px', fontWeight: '600', color: '#ef6c00' }}>Date</th>
                  <th style={{ border: '1px solid #e0e0e0', padding: '16px 12px', fontSize: '14px', fontWeight: '600', color: '#ef6c00' }}>Purchase</th>
                  <th style={{ border: '1px solid #e0e0e0', padding: '16px 12px', fontSize: '14px', fontWeight: '600', color: '#ef6c00' }}>Payment</th>
                  <th style={{ border: '1px solid #e0e0e0', padding: '16px 12px', fontSize: '14px', fontWeight: '600', color: '#ef6c00' }}>Balance</th>
                  <th style={{ border: '1px solid #e0e0e0', padding: '16px 12px', fontSize: '14px', fontWeight: '600', color: '#ef6c00' }}>Details</th>
                  <th style={{ border: '1px solid #e0e0e0', padding: '16px 12px', fontSize: '14px', fontWeight: '600', color: '#ef6c00' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(entry => (
                  <tr 
                    key={entry.id}
                    style={{ 
                      backgroundColor: entry.id === editingEntry?.id ? '#fff3e0' : 'transparent',
                      transition: 'background-color 0.2s'
                    }}
                  >
                    <td style={{ border: '1px solid #e0e0e0', padding: '16px 12px', fontSize: '14px' }}>
                      {entry.date}
                    </td>
                    <td style={{ 
                      border: '1px solid #e0e0e0', 
                      padding: '16px 12px', 
                      color: entry.type === 'purchase' ? '#ef6c00' : '#9e9e9e',
                      fontWeight: entry.type === 'purchase' ? '600' : '400'
                    }}>
                      {entry.type === 'purchase' ? formatAmount(entry.amount) : '-'}
                    </td>
                    <td style={{ 
                      border: '1px solid #e0e0e0', 
                      padding: '16px 12px', 
                      color: entry.type === 'payment' ? '#c62828' : '#9e9e9e',
                      fontWeight: entry.type === 'payment' ? '600' : '400'
                    }}>
                      {entry.type === 'payment' ? formatAmount(entry.amount) : '-'}
                    </td>
                    <td style={{ 
                      border: '1px solid #e0e0e0', 
                      padding: '16px 12px', 
                      fontSize: '14px',
                      fontWeight: '600',
                      color: entry.runningBalance >= 0 ? '#e65100' : '#d32f2f'
                    }}>
                      Rs. {formatAmount(entry.runningBalance)}
                    </td>
                    <td style={{ 
                      border: '1px solid #e0e0e0', 
                      padding: '16px 12px', 
                      fontSize: '14px', 
                      color: '#455a64' 
                    }}>
                      {entry.note || '-'}
                    </td>
                    <td style={{ border: '1px solid #e0e0e0', padding: '16px 12px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
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
