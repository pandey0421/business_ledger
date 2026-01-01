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
      let totalSales = 0;
      let totalPayments = 0;
      for (const customer of customersData) {
        const ledgerRef = collection(db, 'customers', customer.id, 'ledger');
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
    return <CustomerLedger customer={selectedCustomer} onBack={() => setSelectedCustomer(null)} />;
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #fffde7 0%, #e3f2fd 100%)',
      display: 'flex',
      flexDirection: 'column',
      width: '100vw',
      margin: 0,
      padding: isMobile ? '0px' : '24px',
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
            <h1 style={{
              margin: '0 0 8px 0',
              color: '#1a237e',
              fontSize: isMobile ? '28px' : '32px'
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
          padding: isMobile ? '20px' : '28px',
          background: 'linear-gradient(135deg, #e8f5e8 0%, #c8e6c9 100%)',
          borderRadius: '16px',
          border: '2px solid #4caf50',
          boxShadow: '0 8px 24px rgba(76, 175, 80, 0.15)'
        }}>
          <h3 style={{
            margin: '0 0 20px 0',
            color: '#2e7d32',
            fontSize: isMobile ? '20px' : '24px'
          }}>
            Overall Customers Summary
          </h3>
          {loadingStats ? (
            <p style={{
              color: '#4caf50',
              margin: 0,
              fontSize: '16px',
              textAlign: 'center'
            }}>
              Loading stats...
            </p>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: isMobile ? '12px' : '20px'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: isMobile ? '24px' : '28px',
                  fontWeight: '700',
                  color: '#2e7d32',
                  marginBottom: '8px'
                }}>
                  Rs. {formatAmount(overallStats.totalSales)}
                </div>
                <div style={{ color: '#4caf50', fontSize: '14px' }}>Total Sales</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: isMobile ? '24px' : '28px',
                  fontWeight: '700',
                  color: '#c62828',
                  marginBottom: '8px'
                }}>
                  Rs. {formatAmount(overallStats.totalPayments)}
                </div>
                <div style={{ color: '#d32f2f', fontSize: '14px' }}>Total Payments</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: isMobile ? '24px' : '28px',
                  fontWeight: '700',
                  color: '#1976d2',
                  marginBottom: '8px'
                }}>
                  Rs. {formatAmount(overallStats.totalBalance)}
                </div>
                <div style={{ color: '#1e88e5', fontSize: '14px' }}>Remaining Balance</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: isMobile ? '24px' : '28px',
                  fontWeight: '700',
                  color: '#424242',
                  marginBottom: '8px'
                }}>
                  {overallStats.totalCustomers}
                </div>
                <div style={{ color: '#757575', fontSize: '14px' }}>Total Customers</div>
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
          <div style={{
            flex: isMobile ? '1 1 100%' : '1 1 220px',
            minWidth: isMobile ? 'auto' : '220px'
          }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: '500',
              color: '#37474f'
            }}>
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
                borderRadius: '10px',
                border: (editingCustomer && !editingCustomer.name.trim()) ? '2px solid #ef5350' : '1px solid #cfd8dc',
                outline: 'none',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>
          <div style={{
            flex: isMobile ? '1 1 100%' : '1 1 220px',
            minWidth: isMobile ? 'auto' : '220px'
          }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: '500',
              color: '#37474f'
            }}>
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
                borderRadius: '10px',
                border: '1px solid #cfd8dc',
                outline: 'none',
                fontSize: '14px',
                boxSizing: 'border-box'
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
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: editingCustomer.name.trim() ? '#43a047' : '#bdbdbd',
                  color: '#fff',
                  cursor: editingCustomer.name.trim() ? 'pointer' : 'not-allowed',
                  fontWeight: '500',
                  fontSize: '14px',
                  whiteSpace: 'nowrap',
                  flex: isMobile ? '1 1 100%' : '0 0 auto'
                }}
              >
                Update Customer
              </button>
              <button
                onClick={() => { setEditingCustomer(null); setName(''); setPhone(''); }}
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
              onClick={handleAddCustomer}
              disabled={!name.trim()}
              style={{
                padding: '12px 24px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: name.trim() ? '#43a047' : '#bdbdbd',
                color: '#fff',
                cursor: name.trim() ? 'pointer' : 'not-allowed',
                fontWeight: '500',
                fontSize: '14px',
                whiteSpace: 'nowrap',
                flex: isMobile ? '1 1 100%' : '0 0 auto'
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
            borderRadius: '10px',
            backgroundColor: '#e3f2fd',
            color: '#1976d2',
            fontSize: '14px',
            border: '1px solid #bbdefb'
          }}>
            {message}
          </div>
        )}

        {/* Customer List */}
        <h3 style={{
          marginBottom: isMobile ? '20px' : '24px',
          color: '#1a237e',
          fontSize: isMobile ? '20px' : '24px'
        }}>
          Customer List ({customers.length})
        </h3>
        {customers.length === 0 ? (
          <div style={{
            padding: isMobile ? '32px 16px' : '48px 24px',
            textAlign: 'center',
            color: '#78909c',
            backgroundColor: '#fafafa',
            borderRadius: '16px',
            border: '1px dashed #cfd8dc'
          }}>
            No customers yet. Add your first customer above.
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: isMobile ? '12px' : '20px'
          }}>
            {customers.map((c) => (
              <div
                key={c.id}
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
                onClick={() => setSelectedCustomer({ ...c, userId })}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-6px)';
                  e.currentTarget.style.boxShadow = '0 12px 32px rgba(46,125,50,0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                }}
              >
                <div style={{
                  fontSize: isMobile ? '18px' : '20px',
                  fontWeight: '600',
                  color: '#2e7d32',
                  marginBottom: '12px'
                }}>
                  {c.name}
                </div>
                {c.phone && (
                  <div style={{
                    color: '#546e7a',
                    fontSize: isMobile ? '14px' : '15px',
                    marginBottom: '16px'
                  }}>
                    {c.phone}
                  </div>
                )}
                <div style={{
                  display: 'flex',
                  gap: '12px',
                  flexWrap: 'wrap'
                }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); startEditCustomer(c); }}
                    title="Edit Customer"
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
                    onClick={(e) => { e.stopPropagation(); handleDeleteCustomer(c.id); }}
                    title="Delete Customer"
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

export default Customers;