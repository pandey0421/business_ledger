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
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), userId }));
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
      const expensesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      let totalExpenses = 0;

      for (const expense of expensesData) {
        const ledgerRef = collection(db, 'expenses', expense.id, 'ledger');
        const ledgerSnapshot = await getDocs(ledgerRef);
        let categoryExpenses = 0;
        ledgerSnapshot.docs.forEach(ledgerDoc => {
          const data = ledgerDoc.data();
          categoryExpenses += Number(data.amount) || 0;
        });
        totalExpenses += categoryExpenses;
      }

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
    if (!window.confirm('Are you sure you want to delete this expense category and all its entries?')) return;
    try {
      // Delete from both user-specific and global ledger paths
      const userLedgerRef = collection(db, 'users', userId, 'expenses', expenseId, 'ledger');
      const globalLedgerRef = collection(db, 'expenses', expenseId, 'ledger');
      
      const userLedgerSnapshot = await getDocs(userLedgerRef);
      for (const ledgerDoc of userLedgerSnapshot.docs) {
        await deleteDoc(doc(db, 'users', userId, 'expenses', expenseId, 'ledger', ledgerDoc.id));
      }
      
      const globalLedgerSnapshot = await getDocs(globalLedgerRef);
      for (const ledgerDoc of globalLedgerSnapshot.docs) {
        await deleteDoc(doc(db, 'expenses', expenseId, 'ledger', ledgerDoc.id));
      }
      
      // Delete expense category
      await deleteDoc(doc(db, 'users', userId, 'expenses', expenseId));
      setMessage('Expense category deleted successfully');
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
        maxWidth: isMobile ? '100vw' : '1000px',
        margin: isMobile ? '0' : '0 auto',
        width: '100%',
        backgroundColor: '#ffffff',
        borderRadius: isMobile ? '0' : '16px',
        padding: isMobile ? '16px' : '32px',
        boxShadow: isMobile ? 'none' : '0 8px 32px rgba(0,0,0,0.12)',
        border: isMobile ? 'none' : '1px solid #e0e0e0',
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
            padding: '8px 16px',
            borderRadius: '999px',
            border: '1px solid #cfd8dc',
            backgroundColor: '#fafafa',
            cursor: 'pointer',
            fontSize: '14px',
            color: '#607d8b'
          }}>
            ← Back
          </button>
          <div>
            <h1 style={{ margin: '0 0 8px 0', color: '#1a237e', fontSize: isMobile ? '28px' : '32px' }}>
              Expenses
            </h1>
            <p style={{ color: '#546e7a', margin: 0, fontSize: isMobile ? '14px' : '16px' }}>
              Manage your expense categories and track spending
            </p>
          </div>
        </div>

        {/* Overall Stats Card */}
        <div style={{
          marginBottom: isMobile ? '24px' : '32px',
          padding: isMobile ? '20px' : '28px',
          background: 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)',
          borderRadius: '16px',
          border: '2px solid #f44336',
          boxShadow: '0 8px 24px rgba(244, 67, 54, 0.15)'
        }}>
          <h3 style={{ margin: '0 0 20px 0', color: '#c62828', fontSize: isMobile ? '20px' : '24px' }}>
            Overall Expenses Summary
          </h3>
          {loadingStats ? (
            <p style={{ color: '#f44336', margin: 0, fontSize: '16px', textAlign: 'center' }}>
              Loading stats...
            </p>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: isMobile ? '12px' : '20px'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: isMobile ? '24px' : '28px', fontWeight: '700', color: '#d32f2f', marginBottom: '8px' }}>
                  Rs. {formatAmount(overallStats.totalExpenses)}
                </div>
                <div style={{ color: '#f44336', fontSize: '14px' }}>Total Expenses</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: isMobile ? '24px' : '28px', fontWeight: '700', color: '#424242', marginBottom: '8px' }}>
                  {overallStats.totalCategories}
                </div>
                <div style={{ color: '#757575', fontSize: '14px' }}>Total Categories</div>
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
          backgroundColor: '#f5f5f5',
          padding: isMobile ? '16px' : '24px',
          borderRadius: '16px'
        }}>
          <div style={{ flex: isMobile ? '1 1 100%' : '1', minWidth: isMobile ? 'auto' : '220px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#37474f' }}>
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
                borderRadius: '10px',
                border: editingExpense && !editingExpense.name.trim() ? '2px solid #ef5350' : '1px solid #cfd8dc',
                outline: 'none',
                fontSize: '14px',
                boxSizing: 'border-box'
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
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: editingExpense.name.trim() ? '#f44336' : '#bdbdbd',
                  color: '#fff',
                  cursor: editingExpense.name.trim() ? 'pointer' : 'not-allowed',
                  fontWeight: '500',
                  fontSize: '14px',
                  whiteSpace: 'nowrap',
                  flex: isMobile ? '1 1 100%' : '0 0 auto'
                }}
              >
                Update Category
              </button>
              <button
                onClick={() => {
                  setEditingExpense(null);
                  setName('');
                }}
                style={{
                  padding: '12px 24px',
                  borderRadius: '10px',
                  border: '1px solid #cfd8dc',
                  backgroundColor: '#fafafa',
                  color: '#607d8b',
                  cursor: 'pointer',
                  fontSize: '14px',
                  flex: isMobile ? '1 1 100%' : '0 0 auto'
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
                borderRadius: '10px',
                border: 'none',
                backgroundColor: name.trim() ? '#f44336' : '#bdbdbd',
                color: '#fff',
                cursor: name.trim() ? 'pointer' : 'not-allowed',
                fontWeight: '500',
                fontSize: '14px',
                whiteSpace: 'nowrap',
                flex: isMobile ? '1 1 100%' : '0 0 auto'
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
            borderRadius: '10px',
            backgroundColor: '#ffebee',
            color: '#c62828',
            fontSize: '14px',
            border: '1px solid #ffccdd'
          }}>
            {message}
          </div>
        )}

        {/* Expense List */}
        <h3 style={{ marginBottom: isMobile ? '20px' : '24px', color: '#1a237e', fontSize: isMobile ? '20px' : '24px' }}>
          Expense Categories ({expenses.length})
        </h3>
        {expenses.length === 0 ? (
          <div style={{
            padding: isMobile ? '32px 16px' : '48px 24px',
            textAlign: 'center',
            color: '#78909c',
            backgroundColor: '#fafafa',
            borderRadius: '16px',
            border: '1px dashed #cfd8dc'
          }}>
            No expense categories yet. Add your first category above.
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: isMobile ? '12px' : '20px'
          }}>
            {expenses.map(expense => (
              <div
                key={expense.id}
                style={{
                  borderRadius: '16px',
                  padding: isMobile ? '16px' : '24px',
                  backgroundColor: '#f8f9fa',
                  border: '1px solid #e0e0e0',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  boxSizing: 'border-box'
                }}
                onClick={() => setSelectedExpense({ ...expense, userId })}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-6px)';
                  e.currentTarget.style.boxShadow = '0 12px 32px rgba(244, 67, 54, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                }}
              >
                <div style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: '600', color: '#c62828', marginBottom: '12px' }}>
                  {expense.name}
                </div>
                <div style={{
                  marginTop: '16px',
                  paddingTop: '16px',
                  borderTop: '1px solid #e0e0e0',
                  fontSize: '13px',
                  color: '#9e9e9e'
                }}>
                  Click card to view ledger
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '12px' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditExpense(expense);
                    }}
                    title="Edit Category"
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #42a5f5',
                      backgroundColor: '#e3f2fd',
                      color: '#1976d2',
                      fontSize: '13px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#bbdefb'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = '#e3f2fd'}
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteExpense(expense.id);
                    }}
                    title="Delete Category"
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #ef5350',
                      backgroundColor: '#ffebee',
                      color: '#d32f2f',
                      fontSize: '13px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#ffcdd2'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = '#ffebee'}
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
