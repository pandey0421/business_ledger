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
  const [isMobile, setIsMobile] = useState(false);

  // Responsive hook
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const userId = auth.currentUser?.uid;
  const customerRef = userId ? collection(db, 'users', userId, 'customers') : null;

  const fetchCustomers = async () => {
    if (!customerRef) return;
    try {
      const snapshot = await getDocs(customerRef);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), userId }));
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
      const customersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const results = await Promise.all(customersData.map(async (customer) => {
        const ledgerRef = collection(db, 'customers', customer.id, 'ledger');
        const ledgerSnapshot = await getDocs(ledgerRef);
        let customerSales = 0;
        let customerPayments = 0;
        ledgerSnapshot.docs.forEach(ledgerDoc => {
          const data = ledgerDoc.data();
          if (data.type === 'sale') customerSales += Number(data.amount) || 0;
          if (data.type === 'payment') customerPayments += Number(data.amount) || 0;
        });
        return { sales: customerSales, payments: customerPayments };
      }));

      const totalSales = results.reduce((acc, curr) => acc + curr.sales, 0);
      const totalPayments = results.reduce((acc, curr) => acc + curr.payments, 0);
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

  // Deep Linking for Customer Ledger
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.slice(1);
      const [route, id] = hash.split('/');

      if (route === 'customers' && id && customers.length > 0) {
        // Find customer by ID
        const found = customers.find(c => c.id === id);
        if (found) {
          // Need to set ID and data. The data is already in 'customers' array.
          setSelectedCustomer(found);
        }
      } else if (route === 'customers' && !id) {
        setSelectedCustomer(null);
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [customers]); // Run when customers are loaded

  const handleSelectCustomer = (customer) => {
    // Update URL, effect will handle state change
    window.location.hash = `customers/${customer.id}`;
  };

  const handleBack = () => {
    window.location.hash = 'customers';
  };

  useEffect(() => {
    fetchCustomers();
    fetchOverallStats();
  }, [userId]);

  useEffect(() => {
    if (customers.length > 0) fetchOverallStats();
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
        phone: phone.trim(),
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
        phone: editingCustomer.phone.trim()
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
      const userLedgerRef = collection(db, 'users', userId, 'customers', customerId, 'ledger');
      const globalLedgerRef = collection(db, 'customers', customerId, 'ledger');
      const userLedgerSnapshot = await getDocs(userLedgerRef);
      for (const ledgerDoc of userLedgerSnapshot.docs) {
        await deleteDoc(doc(db, 'users', userId, 'customers', customerId, 'ledger', ledgerDoc.id));
      }
      const globalLedgerSnapshot = await getDocs(globalLedgerRef);
      for (const ledgerDoc of globalLedgerSnapshot.docs) {
        await deleteDoc(doc(db, 'customers', customerId, 'ledger', ledgerDoc.id));
      }
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
    setPhone(customer.phone);
  };

  const formatAmount = (num) => {
    return new Intl.NumberFormat('en-IN').format(Math.round(num));
  };

  if (selectedCustomer) {
    return <CustomerLedger customer={selectedCustomer} onBack={handleBack} />;
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
              color: '#1a237e',
              fontSize: isMobile ? '24px' : '28px',
              fontWeight: 'bold'
            }}>
              Customers
            </h1>
            <p style={{
              color: '#546e7a',
              margin: 0,
              fontSize: isMobile ? '14px' : '16px'
            }}>
              Manage your customers and track receivables
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
          background: 'linear-gradient(to right, #ffffff, #e8f5e8)' // Subtle green hint
        }}>
          <h3 style={{
            margin: '0 0 20px 0',
            color: '#2e7d32',
            fontSize: isMobile ? '18px' : '20px',
            fontWeight: 'bold'
          }}>
            Overview
          </h3>
          {loadingStats ? (
            <p style={{ color: '#66bb6a', margin: 0, fontSize: '14px', textAlign: 'center' }}>
              Loading summary...
            </p>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
              gap: isMobile ? '16px' : '20px'
            }}>
              <div style={{ textAlign: 'center', padding: '16px', background: '#e8f5e8', borderRadius: '16px' }}>
                <div style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 'bold', color: '#2e7d32', marginBottom: '4px' }}>
                  Rs. {formatAmount(overallStats.totalSales)}
                </div>
                <div style={{ color: '#2e7d32', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Total Sales</div>
              </div>
              <div style={{ textAlign: 'center', padding: '16px', background: '#ffebee', borderRadius: '16px' }}>
                <div style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 'bold', color: '#c62828', marginBottom: '4px' }}>
                  Rs. {formatAmount(overallStats.totalPayments)}
                </div>
                <div style={{ color: '#c62828', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Received</div>
              </div>
              <div style={{ textAlign: 'center', padding: '16px', background: '#e3f2fd', borderRadius: '16px' }}>
                <div style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 'bold', color: '#1565c0', marginBottom: '4px' }}>
                  Rs. {formatAmount(overallStats.totalBalance)}
                </div>
                <div style={{ color: '#1565c0', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Receivable</div>
              </div>
              <div style={{ textAlign: 'center', padding: '16px', background: '#fafafa', borderRadius: '16px' }}>
                <div style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 'bold', color: '#455a64', marginBottom: '4px' }}>
                  {overallStats.totalCustomers}
                </div>
                <div style={{ color: '#455a64', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Customers</div>
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
          <div style={{
            flex: isMobile ? '1 1 100%' : '1 1 220px',
            minWidth: isMobile ? 'auto' : '220px'
          }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#455a64', fontSize: '12px' }}>
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
                width: '100%',
                padding: '12px 16px',
                borderRadius: '12px',
                border: (editingCustomer && !editingCustomer.name.trim()) ? '2px solid #ef5350' : '1px solid #e0e0e0',
                outline: 'none',
                fontSize: '14px',
                boxSizing: 'border-box',
                fontWeight: '500'
              }}
            />
          </div>
          <div style={{
            flex: isMobile ? '1 1 100%' : '1 1 220px',
            minWidth: isMobile ? 'auto' : '220px'
          }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#455a64', fontSize: '12px' }}>
              Phone (optional)
            </label>
            <input
              value={editingCustomer ? editingCustomer.phone : phone}
              onChange={(e) => {
                if (editingCustomer) {
                  setEditingCustomer({ ...editingCustomer, phone: e.target.value });
                } else {
                  setPhone(e.target.value);
                }
              }}
              placeholder="Enter phone number"
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
          {editingCustomer ? (
            <>
              <button
                onClick={() => handleUpdateCustomer(editingCustomer.id)}
                disabled={!editingCustomer.name.trim()}
                style={{
                  padding: '12px 24px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: editingCustomer.name.trim() ? '#43a047' : '#e0e0e0',
                  color: editingCustomer.name.trim() ? '#fff' : '#9e9e9e',
                  cursor: editingCustomer.name.trim() ? 'pointer' : 'not-allowed',
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
                onClick={() => { setEditingCustomer(null); setName(''); setPhone(''); }}
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
              onClick={handleAddCustomer}
              disabled={!name.trim()}
              style={{
                padding: '12px 24px',
                borderRadius: '12px',
                border: 'none',
                backgroundColor: name.trim() ? '#43a047' : '#e0e0e0',
                color: name.trim() ? '#fff' : '#9e9e9e',
                cursor: name.trim() ? 'pointer' : 'not-allowed',
                fontWeight: '600',
                fontSize: '14px',
                whiteSpace: 'nowrap',
                flex: isMobile ? '1 1 100%' : '0 0 auto',
                height: '46px', alignSelf: 'flex-end',
                boxShadow: name.trim() ? '0 4px 12px rgba(67, 160, 71, 0.2)' : 'none'
              }}
            >
              Add Customer
            </button>
          )}
        </div>

        {/* Messages */}
        {message && (
          <div style={{
            marginBottom: '20px',
            padding: '12px 16px',
            borderRadius: '12px',
            backgroundColor: '#e8f5e8',
            color: '#2e7d32',
            fontSize: '14px',
            border: '1px solid #c8e6c9',
            fontWeight: '500'
          }}>
            {message}
          </div>
        )}

        {/* Customer List */}
        <h3 style={{
          marginBottom: isMobile ? '20px' : '24px',
          color: '#1a237e',
          fontSize: isMobile ? '20px' : '22px',
          fontWeight: 'bold'
        }}>
          Customer List ({customers.length})
        </h3>
        {customers.length === 0 ? (
          <div style={{
            padding: isMobile ? '40px 20px' : '60px',
            textAlign: 'center',
            color: '#90a4ae',
            backgroundColor: '#fafafa',
            borderRadius: '20px',
            border: '1px dashed #cfd8dc',
            fontSize: '14px'
          }}>
            No customers yet. Add your first customer above.
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: isMobile ? '16px' : '20px'
          }}>
            {customers.map((c) => (
              <div
                key={c.id}
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
                onClick={() => handleSelectCustomer(c)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.08)';
                  e.currentTarget.style.borderColor = '#43a047';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.03)';
                  e.currentTarget.style.borderColor = '#f0f0f0';
                }}
              >
                <div style={{
                  fontSize: isMobile ? '18px' : '20px',
                  fontWeight: '700',
                  color: '#2e7d32',
                  marginBottom: '8px'
                }}>
                  {c.name}
                </div>
                {c.phone ? (
                  <div style={{
                    color: '#546e7a',
                    fontSize: isMobile ? '13px' : '14px',
                    marginBottom: '20px',
                    fontWeight: '500'
                  }}>
                    {c.phone}
                  </div>
                ) : (
                  <div style={{
                    color: '#b0bec5',
                    fontSize: isMobile ? '13px' : '14px',
                    marginBottom: '20px',
                    fontStyle: 'italic'
                  }}>
                    No phone number
                  </div>
                )}

                <div style={{
                  display: 'flex',
                  gap: '12px',
                  borderTop: '1px solid #f0f0f0',
                  paddingTop: '16px',
                  marginTop: 'auto'
                }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); startEditCustomer(c); }}
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
                    onClick={(e) => { e.stopPropagation(); handleDeleteCustomer(c.id); }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: '1px solid #ffebee',
                      backgroundColor: '#ffebee',
                      color: '#c62828',
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

export default Customers;