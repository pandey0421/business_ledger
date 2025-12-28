import React, { useEffect, useState } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

const ExpenseLedger = ({ expense, onBack }) => {
  const [entries, setEntries] = useState([]);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [editingEntry, setEditingEntry] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!expense?.id) return;

    // Real-time listener ordered by createdAt
    const q = query(collection(db, 'expenses', expense.id, 'ledger'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Step 1: Calculate chronologically (oldest first) for correct running totals
      let chronoData = snapshot.docs.map(d => {
        const raw = d.data();
        const amt = Number(raw.amount) || 0;
        return { id: d.id, ...raw, amount: amt };
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

      // Calculate running totals (all expenses are positive outflows)
      let runningTotal = 0;
      let expenseSum = 0;
      chronoData = chronoData.map(entry => {
        runningTotal += entry.amount;
        expenseSum += entry.amount;
        return { ...entry, runningTotal };
      });

      // Reverse for display (newest first, totals remain correct)
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

  const addOrUpdateEntry = async () => {
    if (!amount || !date) {
      setMessage('Amount and date are required');
      return;
    }
    
    // Simple yyyy-mm-dd validation
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      setMessage('Please enter date in yyyy-mm-dd format');
      return;
    }

    try {
      if (editingEntry) {
        // Update existing entry
        await updateDoc(doc(db, 'expenses', expense.id, 'ledger', editingEntry.id), {
          amount: Number(amount),
          date,
          note
        });
        setMessage('Entry updated successfully');
      } else {
        // Add new entry
        await addDoc(collection(db, 'expenses', expense.id, 'ledger'), {
          amount: Number(amount),
          date,
          note,
          createdAt: serverTimestamp()
        });
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
    setNote(entry.note || '');
  };

  const handleDeleteEntry = async (entryId) => {
    if (!window.confirm('Are you sure you want to delete this entry?')) return;
    try {
      await deleteDoc(doc(db, 'expenses', expense.id, 'ledger', entryId));
      setMessage('Entry deleted successfully');
    } catch (err) {
      console.error(err);
      setMessage('Failed to delete entry');
    }
  };

  const formatAmount = (num) => {
    return new Intl.NumberFormat('en-IN').format(Math.round(num));
  };

  if (!expense) return null;

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #ffebee, #ffcdd2)', 
      padding: '24px' 
    }}>
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
          Back to Expenses
        </button>

        <h2 style={{ marginTop: 0, color: '#1a237e', fontSize: '28px' }}>
          Ledger for {expense.name}
        </h2>
        <p style={{ color: '#546e7a', marginBottom: '16px' }}>
          Track all expenses for this category. All entries are outflows (positive amounts).
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
            placeholder="Date (yyyy-mm-dd)" 
            value={date}
            onChange={(e) => setDate(e.target.value)}
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
          <p style={{ 
            marginBottom: '12px', 
            padding: '10px', 
            borderRadius: '10px', 
            backgroundColor: '#fff3e0', 
            color: '#ef6c00', 
            fontSize: '14px' 
          }}>
            {message}
          </p>
        )}

        {/* Summary */}
        <div style={{ 
          marginBottom: '12px', 
          padding: '10px', 
          borderRadius: '10px', 
          backgroundColor: '#ffebee', 
          color: '#c62828', 
          fontSize: '14px' 
        }}>
          <strong>Total Expenses:</strong> Rs. {formatAmount(totalExpenses)}
        </div>

        {/* Loading/Empty States */}
        {loading ? (
          <p>Loading ledger...</p>
        ) : entries.length === 0 ? (
          <p style={{ color: '#78909c' }}>No expense entries yet</p>
        ) : (
          /* Ledger Table */
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
              {entries.map(entry => (
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
                  <td style={{ 
                    border: '1px solid #e0e0e0', 
                    padding: '8px', 
                    fontSize: '14px' 
                  }}>
                    Rs. {formatAmount(entry.runningTotal)}
                  </td>
                  <td style={{ 
                    border: '1px solid #e0e0e0', 
                    padding: '8px', 
                    fontSize: '14px', 
                    color: '#455a64' 
                  }}>
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
