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
  const [overallStats, setOverallStats] = useState({
    totalExpenses: 0,
    totalCategories: 0
  });

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
    <div 
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)',
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
          maxWidth: '1000px',
          margin: '0 auto',
          width: '100%',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          padding: '32px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          border: '1px solid #e0e0e0'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '32px', gap: '16px' }}>
          <button 
            onClick={goBack}
            style={{
              padding: '8px 16px',
              borderRadius: '999px',
              border: '1px solid #cfd8dc',
              backgroundColor: '#fafafa',
              cursor: 'pointer',
              fontSize: '14px',
              color: '#607d8b'
            }}
          >
            ← Back
          </button>
          <div>
            <h1 style={{ margin: '0 0 8px 0', color: '#1a237e', fontSize: '32px' }}>Expenses</h1>
            <p style={{ color: '#546e7a', margin: 0, fontSize: '16px' }}>
              Manage your expense categories and track spending
            </p>
          </div>
        </div>

        {/* Overall Stats Card */}
        <div style={{ 
          marginBottom: '32px', 
          padding: '28px', 
          background: 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)', 
          borderRadius: '16px', 
          border: '2px solid #f44336', 
          boxShadow: '0 8px 24px rgba(244, 67, 54, 0.15)' 
        }}>
          <h3 style={{ margin: '0 0 20px 0', color: '#c62828', fontSize: '24px' }}>Overall Expenses Summary</h3>
          {loadingStats ? (
            <p style={{ color: '#f44336', margin: 0, fontSize: '16px', textAlign: 'center' }}>
              Loading stats...
            </p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#d32f2f', marginBottom: '8px' }}>
                  Rs. {formatAmount(overallStats.totalExpenses)}
                </div>
                <div style={{ color: '#f44336', fontSize: '14px' }}>Total Expenses</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#424242', marginBottom: '8px' }}>
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
          gap: '16px', 
          flexWrap: 'wrap', 
          marginBottom: '32px', 
          backgroundColor: '#f5f5f5', 
          padding: '24px', 
          borderRadius: '16px' 
        }}>
          <div style={{ flex: 1, minWidth: '220px' }}>
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
                fontSize: '14px'
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
                  whiteSpace: 'nowrap'
                }}
              >
                Update Category
              </button>
              <button 
                onClick={() => { setEditingExpense(null); setName(''); }}
                style={{
                  padding: '12px 24px',
                  borderRadius: '10px',
                  border: '1px solid #cfd8dc',
                  backgroundColor: '#fafafa',
                  color: '#607d8b',
                  cursor: 'pointer',
                  fontSize: '14px'
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
                whiteSpace: 'nowrap'
              }}
            >
              Add Category
            </button>
          )}
        </div>

        {/* Messages */}
        {message && (
          <div style={{ 
            marginBottom: '20px', 
            padding: '12px 16px', 
            borderRadius: '10px', 
            backgroundColor: '#ffebee', 
            color: '#c62828',
            fontSize: '14px',
            border: '1px solid #ffcdd2'
          }}>
            {message}
          </div>
        )}

        {/* Expense List */}
        <h3 style={{ marginBottom: '24px', color: '#1a237e', fontSize: '24px' }}>
          Expense Categories ({expenses.length})
        </h3>
        
        {expenses.length === 0 ? (
          <div style={{ 
            padding: '48px 24px', 
            textAlign: 'center', 
            color: '#78909c', 
            backgroundColor: '#fafafa', 
            borderRadius: '16px', 
            border: '1px dashed #cfd8dc' 
          }}>
            No expense categories yet. Add your first category above.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
            {expenses.map((expense) => (
              <div
                key={expense.id}
                style={{
                  borderRadius: '16px',
                  padding: '24px',
                  backgroundColor: '#f8f9fa',
                  border: '1px solid #e0e0e0',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                }}
                onClick={() => { setSelectedExpense({ ...expense, userId }); }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-6px)';
                  e.currentTarget.style.boxShadow = '0 12px 32px rgba(244, 67, 54, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                }}
              >
                <div style={{ fontSize: '20px', fontWeight: '600', color: '#c62828', marginBottom: '12px' }}>
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Expenses;
