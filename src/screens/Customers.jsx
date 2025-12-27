import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import CustomerLedger from './CustomerLedger';

function Customers({ goBack }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [overallStats, setOverallStats] = useState({
    totalSales: 0,
    totalPayments: 0,
    totalBalance: 0,
    totalCustomers: 0
  });

  const userId = auth.currentUser?.uid;
  const customerRef = userId ? collection(db, 'users', userId, 'customers') : null;

  const fetchCustomers = async () => {
    if (!customerRef) return;
    try {
      const snapshot = await getDocs(customerRef);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        userId
      }));
      setCustomers(data);
    } catch (err) {
      console.error(err);
      setMessage('Failed to load customers');
    }
  };

  const fetchOverallStats = async () => {
    if (!customerRef || !userId) {
      setLoadingStats(false);
      return;
    }

    setLoadingStats(true);
    try {
      const snapshot = await getDocs(customerRef);
      const customersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      let totalSales = 0;
      let totalPayments = 0;

      // FIXED: Use the SAME path as your ledger components (existing data location)
      for (const customer of customersData) {
        const ledgerRef = collection(db, 'customers', customer.id, 'ledger'); // ✅ Matches existing data
        const ledgerSnapshot = await getDocs(ledgerRef);
        
        let customerSales = 0;
        let customerPayments = 0;
        
        ledgerSnapshot.docs.forEach(ledgerDoc => {
          const data = ledgerDoc.data();
          if (data.type === 'sale') customerSales += Number(data.amount) || 0;
          if (data.type === 'payment') customerPayments += Number(data.amount) || 0;
        });
        
        totalSales += customerSales;
        totalPayments += customerPayments;
      }

      setOverallStats({
        totalSales: Math.max(0, totalSales),
        totalPayments: Math.max(0, totalPayments),
        totalBalance: Math.max(0, totalSales - totalPayments),
        totalCustomers: customersData.length
      });
    } catch (err) {
      console.error('Failed to fetch overall stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
    fetchOverallStats();
  }, [userId]);

  // Refresh stats when customers change
  useEffect(() => {
    if (customers.length > 0) {
      fetchOverallStats();
    }
  }, [customers]);

  const handleAddCustomer = async () => {
    if (!name.trim()) {
      setMessage('Name is required');
      return;
    }
    if (!customerRef) {
      setMessage('No user logged in');
      return;
    }
    try {
      await addDoc(customerRef, {
        name: name.trim(),
        phone: phone.trim() || '',
        createdAt: serverTimestamp()
      });
      setMessage('Customer added successfully');
      setName('');
      setPhone('');
      fetchCustomers();
    } catch (err) {
      console.error(err);
      setMessage('Error adding customer');
    }
  };

  const handleUpdateCustomer = async (customerId) => {
    if (!editingCustomer || !customerRef) return;
    if (!editingCustomer.name.trim()) {
      setMessage('Name is required');
      return;
    }
    try {
      await updateDoc(doc(db, 'users', userId, 'customers', customerId), {
        name: editingCustomer.name.trim(),
        phone: editingCustomer.phone.trim() || ''
      });
      setMessage('Customer updated successfully');
      setEditingCustomer(null);
      setName('');
      setPhone('');
      fetchCustomers();
    } catch (err) {
      console.error(err);
      setMessage('Error updating customer');
    }
  };

  const handleDeleteCustomer = async (customerId) => {
    if (!window.confirm('Are you sure you want to delete this customer and all their ledger entries?')) return;
    try {
      // FIXED: Delete from existing ledger path too
      const userLedgerRef = collection(db, 'users', userId, 'customers', customerId, 'ledger');
      const globalLedgerRef = collection(db, 'customers', customerId, 'ledger');
      
      // Delete from both locations to be safe
      const userLedgerSnapshot = await getDocs(userLedgerRef);
      for (const ledgerDoc of userLedgerSnapshot.docs) {
        await deleteDoc(doc(db, 'users', userId, 'customers', customerId, 'ledger', ledgerDoc.id));
      }
      
      const globalLedgerSnapshot = await getDocs(globalLedgerRef);
      for (const ledgerDoc of globalLedgerSnapshot.docs) {
        await deleteDoc(doc(db, 'customers', customerId, 'ledger', ledgerDoc.id));
      }
      
      // Delete customer
      await deleteDoc(doc(db, 'users', userId, 'customers', customerId));
      setMessage('Customer deleted successfully');
      fetchCustomers();
    } catch (err) {
      console.error(err);
      setMessage('Error deleting customer');
    }
  };

  const startEditCustomer = (customer) => {
    setEditingCustomer({ ...customer });
    setName(customer.name);
    setPhone(customer.phone || '');
  };

  const formatAmount = (num) => {
    return new Intl.NumberFormat("en-IN").format(Math.round(num));
  };

  if (selectedCustomer) {
    return (
      <CustomerLedger
        customer={selectedCustomer}
        onBack={() => setSelectedCustomer(null)}
      />
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #fffde7, #e3f2fd)",
        padding: "24px",
      }}
    >
      <div
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          backgroundColor: "#ffffff",
          borderRadius: "12px",
          padding: "24px",
          boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
          border: "1px solid #e0e0e0",
        }}
      >
        <button
          onClick={goBack}
          style={{
            marginBottom: "12px",
            padding: "6px 12px",
            borderRadius: "999px",
            border: "1px solid #cfd8dc",
            backgroundColor: "#fafafa",
            cursor: "pointer",
          }}
        >
          ← Back
        </button>

        <h1 style={{ marginTop: "0", color: "#1a237e", fontSize: "28px" }}>
          Customers
        </h1>
        <p style={{ color: "#546e7a", marginBottom: "24px" }}>
          Add new customers and tap a card to view their ledger.
        </p>

        {/* Overall Stats Card */}
        <div
          style={{
            marginBottom: "24px",
            padding: "20px",
            background: "linear-gradient(135deg, #e8f5e8, #c8e6c9)",
            borderRadius: "12px",
            border: "2px solid #4caf50",
            boxShadow: "0 4px 12px rgba(76, 175, 80, 0.15)",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", color: "#2e7d32", fontSize: "20px" }}>
            📊 Overall Customers Summary
          </h3>
          {loadingStats ? (
            <p style={{ color: "#4caf50", margin: 0 }}>Loading stats...</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr)", gap: "12px" }}>
              <div>
                <div style={{ fontSize: "24px", fontWeight: "700", color: "#2e7d32", marginBottom: "4px" }}>
                  Rs. {formatAmount(overallStats.totalSales)}
                </div>
                <div style={{ color: "#4caf50", fontSize: "14px" }}>Total Sales</div>
              </div>
              <div>
                <div style={{ fontSize: "24px", fontWeight: "700", color: "#c62828", marginBottom: "4px" }}>
                  Rs. {formatAmount(overallStats.totalPayments)}
                </div>
                <div style={{ color: "#d32f2f", fontSize: "14px" }}>Total Payments</div>
              </div>
              <div>
                <div style={{ fontSize: "24px", fontWeight: "700", color: "#1976d2", marginBottom: "4px" }}>
                  Rs. {formatAmount(overallStats.totalBalance)}
                </div>
                <div style={{ color: "#1e88e5", fontSize: "14px" }}>Remaining Balance</div>
              </div>
              <div>
                <div style={{ fontSize: "24px", fontWeight: "700", color: "#424242", marginBottom: "4px" }}>
                  {overallStats.totalCustomers}
                </div>
                <div style={{ color: "#757575", fontSize: "14px" }}>Total Customers</div>
              </div>
            </div>
          )}
        </div>

        {/* Rest of the component remains exactly the same... */}
        {/* Add/Edit Form */}
        <div
          style={{
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
            marginBottom: "24px",
            backgroundColor: "#f5f5f5",
            padding: "20px",
            borderRadius: "12px",
          }}
        >
          <div style={{ flex: "1", minWidth: "200px" }}>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: "500", color: "#37474f" }}>
              Customer Name *
            </label>
            <input
              value={editingCustomer ? editingCustomer.name : name}
              onChange={(e) => {
                if (editingCustomer) {
                  setEditingCustomer({ ...editingCustomer, name: e.target.value });
                } else {
                  setName(e.target.value);
                }
              }}
              placeholder="Enter customer name"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: editingCustomer && !editingCustomer.name.trim() ? '2px solid #ef5350' : '1px solid #cfd8dc',
                outline: 'none',
                fontSize: "14px"
              }}
            />
          </div>
          <div style={{ flex: "1", minWidth: "200px" }}>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: "500", color: "#37474f" }}>
              Phone (optional)
            </label>
            <input
              value={editingCustomer ? editingCustomer.phone || '' : phone}
              onChange={(e) => {
                if (editingCustomer) {
                  setEditingCustomer({ ...editingCustomer, phone: e.target.value });
                } else {
                  setPhone(e.target.value);
                }
              }}
              placeholder="Enter phone number"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: '1px solid #cfd8dc',
                outline: 'none',
                fontSize: "14px"
              }}
            />
          </div>
          {editingCustomer ? (
            <>
              <button
                onClick={() => handleUpdateCustomer(editingCustomer.id)}
                disabled={!editingCustomer.name.trim()}
                style={{
                  padding: "10px 16px",
                  borderRadius: "8px",
                  border: 'none',
                  backgroundColor: editingCustomer.name.trim() ? '#43a047' : '#bdbdbd',
                  color: '#fff',
                  cursor: editingCustomer.name.trim() ? 'pointer' : 'not-allowed',
                  fontWeight: '500',
                  fontSize: '14px',
                  whiteSpace: 'nowrap'
                }}
              >
                Update Customer
              </button>
              <button
                onClick={() => {
                  setEditingCustomer(null);
                  setName('');
                  setPhone('');
                }}
                style={{
                  padding: "10px 16px",
                  borderRadius: "8px",
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
              onClick={handleAddCustomer}
              disabled={!name.trim()}
              style={{
                padding: "10px 16px",
                borderRadius: "8px",
                border: 'none',
                backgroundColor: name.trim() ? '#43a047' : '#bdbdbd',
                color: '#fff',
                cursor: name.trim() ? 'pointer' : 'not-allowed',
                fontWeight: '500',
                fontSize: '14px',
                whiteSpace: 'nowrap'
              }}
            >
              Add Customer
            </button>
          )}
        </div>

        {/* Messages */}
        {message && (
          <div
            style={{
              marginBottom: "16px",
              padding: "12px",
              borderRadius: "8px",
              backgroundColor: "#e3f2fd",
              color: "#1976d2",
              fontSize: "14px",
            }}
          >
            {message}
          </div>
        )}

        {/* Customer List */}
        <h3 style={{ marginBottom: "16px", color: "#1a237e" }}>
          Customer List ({customers.length})
        </h3>
        {customers.length === 0 ? (
          <div
            style={{
              padding: "40px 20px",
              textAlign: "center",
              color: "#78909c",
              backgroundColor: "#fafafa",
              borderRadius: "12px",
              border: "1px dashed #cfd8dc"
            }}
          >
            No customers yet. Add your first customer above.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
            {customers.map((c) => (
              <div
                key={c.id}
                style={{
                  borderRadius: "12px",
                  padding: "20px",
                  backgroundColor: "#f8f9fa",
                  border: "1px solid #e0e0e0",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
                }}
                onClick={() => setSelectedCustomer({ ...c, userId })}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(46,125,50,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
                }}
              >
                <div style={{ fontSize: "18px", fontWeight: "600", color: "#2e7d32", marginBottom: "8px" }}>
                  {c.name}
                </div>
                {c.phone && (
                  <div style={{ color: "#546e7a", fontSize: "14px", marginBottom: "12px" }}>
                    📞 {c.phone}
                  </div>
                )}
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditCustomer(c);
                    }}
                    title="Edit Customer"
                    style={{
                      padding: "6px 10px",
                      borderRadius: "6px",
                      border: "1px solid #42a5f5",
                      backgroundColor: "#e3f2fd",
                      color: "#1976d2",
                      fontSize: "12px",
                      fontWeight: "500",
                      cursor: "pointer",
                      transition: "all 0.2s"
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = '#bbdefb';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = '#e3f2fd';
                    }}
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCustomer(c.id);
                    }}
                    title="Delete Customer"
                    style={{
                      padding: "6px 10px",
                      borderRadius: "6px",
                      border: "1px solid #ef5350",
                      backgroundColor: "#ffebee",
                      color: "#d32f2f",
                      fontSize: "12px",
                      fontWeight: "500",
                      cursor: "pointer",
                      transition: "all 0.2s"
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = '#ffcdd2';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = '#ffebee';
                    }}
                  >
                    🗑️ Delete
                  </button>
                </div>
                <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #e0e0e0", fontSize: "12px", color: "#9e9e9e" }}>
                  👁️ Click card to view ledger
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Customers;

