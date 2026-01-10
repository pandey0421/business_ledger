import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import ExpenseLedger from './ExpenseLedger';

function Expenses({ goBack }) {
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [expenses, setExpenses] = useState([]);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [overallStats, setOverallStats] = useState({ totalExpenses: 0, totalCategories: 0 });
  const [isMobile, setIsMobile] = useState(false); // Responsive hook

  // Mobile responsive detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const userId = auth.currentUser?.uid;
  const expenseRef = userId ? collection(db, 'users', userId, 'expenses') : null;

  const fetchExpenses = async () => {
    if (!expenseRef) return;
    try {
      const snapshot = await getDocs(expenseRef);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), userId }))
        .filter(d => !d.isDeleted);
      setExpenses(data);
    } catch (err) {
      console.error(err);
      setMessage('Failed to load expenses');
    }
  };

  const fetchOverallStats = async () => {
    if (!expenseRef || !userId) {
      setLoadingStats(false);
      return;
    }
    setLoadingStats(true);
    try {
      const snapshot = await getDocs(expenseRef);
      const expensesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(d => !d.isDeleted);


      const results = await Promise.all(expensesData.map(async (expense) => {
        // Check User Scope first
        let ledgerRef = collection(db, 'users', userId, 'expenses', expense.id, 'ledger');
        let ledgerSnapshot = await getDocs(ledgerRef);

        // If empty, check Legacy Root scope (just in case data is there)
        if (ledgerSnapshot.empty) {
          const legacyRef = collection(db, 'expenses', expense.id, 'ledger');
          const legacySnap = await getDocs(legacyRef);
          if (!legacySnap.empty) {
            ledgerSnapshot = legacySnap;
          }
        }

        let categoryExpenses = 0;
        ledgerSnapshot.docs.forEach(ledgerDoc => {
          categoryExpenses += Number(ledgerDoc.data().amount) || 0;
        });
        return categoryExpenses;
      }));

      const totalExpenses = results.reduce((a, b) => a + b, 0);

      setOverallStats({
        totalExpenses: Math.max(0, totalExpenses),
        totalCategories: expensesData.length
      });
    } catch (err) {
      console.error('Failed to fetch overall stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
    fetchOverallStats();
  }, [userId]);

  useEffect(() => {
    if (expenses.length > 0) fetchOverallStats();
  }, [expenses]);

  const handleAddExpense = async () => {
    if (!name.trim()) {
      setMessage('Name is required');
      return;
    }
    if (!expenseRef) {
      setMessage('No user logged in');
      return;
    }
    try {
      await addDoc(expenseRef, {
        name: name.trim(),
        createdAt: serverTimestamp()
      });
      setMessage('Expense category added successfully');
      setName('');
      fetchExpenses();
    } catch (err) {
      console.error(err);
      setMessage('Error adding expense category');
    }
  };

  const handleUpdateExpense = async (expenseId) => {
    if (!editingExpense || !expenseRef) return;
    if (!editingExpense.name.trim()) {
      setMessage('Name is required');
      return;
    }
    try {
      await updateDoc(doc(db, 'users', userId, 'expenses', expenseId), {
        name: editingExpense.name.trim()
      });
      setMessage('Expense category updated successfully');
      setEditingExpense(null);
      setName('');
      fetchExpenses();
    } catch (err) {
      console.error(err);
      setMessage('Error updating expense category');
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!window.confirm('Are you sure you want to move this expense category to the Recycle Bin?')) return;
    try {
      await updateDoc(doc(db, 'users', userId, 'expenses', expenseId), {
        isDeleted: true,
        deletedAt: serverTimestamp()
      });
      setMessage('Expense category moved to Recycle Bin');
      fetchExpenses();
    } catch (err) {
      console.error(err);
      setMessage('Error deleting expense category');
    }
  };

  const startEditExpense = (expense) => {
    setEditingExpense({ ...expense });
    setName(expense.name);
  };

  const formatAmount = (num) => {
    return new Intl.NumberFormat('en-IN').format(Math.round(num));
  };

  if (selectedExpense) {
    return <ExpenseLedger expense={selectedExpense} onBack={() => setSelectedExpense(null)} />;
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      padding: isMobile ? '16px' : '32px',
      overflowX: 'hidden',
      boxSizing: 'border-box',
      fontFamily: "'Inter', sans-serif"
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%',
        backgroundColor: '#ffffff',
        borderRadius: '24px',
        padding: isMobile ? '20px' : '32px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
        border: '1px solid #f0f0f0',
        boxSizing: 'border-box'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: isMobile ? '20px' : '32px',
          gap: isMobile ? '12px' : '16px',
          flexDirection: isMobile ? 'column' : 'row'
        }}>
          <button onClick={goBack} style={{
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
            <h1 style={{
              margin: '0 0 8px 0',
              color: '#c62828',
              fontSize: isMobile ? '24px' : '28px',
              fontWeight: 'bold'
            }}>
              Expenses
            </h1>
            <p style={{
              color: '#546e7a',
              margin: 0,
              fontSize: isMobile ? '14px' : '16px'
            }}>
              Manage your expense categories and track spending
            </p>
          </div>
        </div>

        {/* Overall Stats Card */}
        <div style={{
          marginBottom: isMobile ? '24px' : '32px',
          padding: isMobile ? '20px' : '32px',
          background: 'white',
          borderRadius: '20px',
          border: '1px solid #e0e0e0',
          boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
          background: 'linear-gradient(to right, #ffffff, #ffebee)' // Subtle red hint
        }}>
          <h3 style={{
            margin: '0 0 20px 0',
            color: '#c62828',
            fontSize: isMobile ? '18px' : '20px',
            fontWeight: 'bold'
          }}>
            Overview
          </h3>
          {loadingStats ? (
            <p style={{ color: '#ef5350', margin: 0, fontSize: '14px', textAlign: 'center' }}>
              Loading summary...
            </p>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
              gap: isMobile ? '16px' : '20px'
            }}>
              <div style={{ textAlign: 'center', padding: '16px', background: '#ffebee', borderRadius: '16px' }}>
                <div style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 'bold', color: '#c62828', marginBottom: '4px' }}>
                  Rs. {formatAmount(overallStats.totalExpenses)}
                </div>
                <div style={{ color: '#c62828', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Total Expenses</div>
              </div>
              <div style={{ textAlign: 'center', padding: '16px', background: '#fafafa', borderRadius: '16px' }}>
                <div style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 'bold', color: '#455a64', marginBottom: '4px' }}>
                  {overallStats.totalCategories}
                </div>
                <div style={{ color: '#455a64', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Categories</div>
              </div>
            </div>
          )}
        </div>

        {/* Add/Edit Form */}
        <div style={{
          display: 'flex',
          gap: isMobile ? '12px' : '16px',
          flexWrap: 'wrap',
          marginBottom: isMobile ? '24px' : '32px',
          flexDirection: isMobile ? 'column' : 'row',
          backgroundColor: '#fafafa',
          padding: isMobile ? '16px' : '24px',
          borderRadius: '20px',
          border: '1px solid #f0f0f0'
        }}>
          <div style={{ flex: isMobile ? '1 1 100%' : '1', minWidth: isMobile ? 'auto' : '220px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#455a64', fontSize: '12px' }}>
              Expense Category Name *
            </label>
            <input
              value={editingExpense ? editingExpense.name : name}
              onChange={(e) => {
                if (editingExpense) {
                  setEditingExpense({ ...editingExpense, name: e.target.value });
                } else {
                  setName(e.target.value);
                }
              }}
              placeholder="Enter expense category name"
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '12px',
                border: editingExpense && !editingExpense.name.trim() ? '2px solid #ef5350' : '1px solid #e0e0e0',
                outline: 'none',
                fontSize: '14px',
                boxSizing: 'border-box',
                fontWeight: '500'
              }}
            />
          </div>
          {editingExpense ? (
            <>
              <button
                onClick={() => handleUpdateExpense(editingExpense.id)}
                disabled={!editingExpense.name.trim()}
                style={{
                  padding: '12px 24px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: editingExpense.name.trim() ? '#c62828' : '#e0e0e0',
                  color: editingExpense.name.trim() ? '#fff' : '#9e9e9e',
                  cursor: editingExpense.name.trim() ? 'pointer' : 'not-allowed',
                  fontWeight: '600',
                  fontSize: '14px',
                  whiteSpace: 'nowrap',
                  flex: isMobile ? '1 1 100%' : '0 0 auto',
                  height: '46px', alignSelf: 'flex-end'
                }}
              >
                Update
              </button>
              <button
                onClick={() => {
                  setEditingExpense(null);
                  setName('');
                }}
                style={{
                  padding: '12px 24px',
                  borderRadius: '12px',
                  border: '1px solid #e0e0e0',
                  backgroundColor: 'white',
                  color: '#546e7a',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  flex: isMobile ? '1 1 100%' : '0 0 auto',
                  height: '46px', alignSelf: 'flex-end'
                }}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={handleAddExpense}
              disabled={!name.trim()}
              style={{
                padding: '12px 24px',
                borderRadius: '12px',
                border: 'none',
                backgroundColor: name.trim() ? '#c62828' : '#e0e0e0',
                color: name.trim() ? '#fff' : '#9e9e9e',
                cursor: name.trim() ? 'pointer' : 'not-allowed',
                fontWeight: '600',
                fontSize: '14px',
                whiteSpace: 'nowrap',
                flex: isMobile ? '1 1 100%' : '0 0 auto',
                height: '46px', alignSelf: 'flex-end',
                boxShadow: name.trim() ? '0 4px 12px rgba(198, 40, 40, 0.2)' : 'none'
              }}
            >
              Add Category
            </button>
          )}
        </div>

        {/* Messages */}
        {message && (
          <div style={{
            marginBottom: isMobile ? '16px' : '20px',
            padding: '12px 16px',
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

        {/* Expense List */}
        <h3 style={{ marginBottom: isMobile ? '20px' : '24px', color: '#1a237e', fontSize: isMobile ? '20px' : '22px', fontWeight: 'bold' }}>
          Expense Categories ({expenses.length})
        </h3>
        {expenses.length === 0 ? (
          <div style={{
            padding: isMobile ? '40px 20px' : '60px',
            textAlign: 'center',
            color: '#90a4ae',
            backgroundColor: '#fafafa',
            borderRadius: '20px',
            border: '1px dashed #cfd8dc',
            fontSize: '14px'
          }}>
            No expense categories yet. Add your first category above.
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: isMobile ? '12px' : '20px'
          }}>
            {expenses.map(expense => (
              <div
                key={expense.id}
                style={{
                  borderRadius: '20px',
                  padding: isMobile ? '20px' : '24px',
                  backgroundColor: 'white',
                  border: '1px solid #f0f0f0',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                  boxSizing: 'border-box',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onClick={() => setSelectedExpense({ ...expense, userId })}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.08)';
                  e.currentTarget.style.borderColor = '#c62828';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.03)';
                  e.currentTarget.style.borderColor = '#f0f0f0';
                }}
              >
                <div style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: '700', color: '#c62828', marginBottom: '8px' }}>
                  {expense.name}
                </div>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f0f0f0' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditExpense(expense);
                    }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: '1px solid #e0e0e0',
                      backgroundColor: 'white',
                      color: '#1976d2',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      flex: 1
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteExpense(expense.id);
                    }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: '1px solid #ffebee',
                      backgroundColor: '#ffebee',
                      color: '#d32f2f',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      flex: 1
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Expenses;