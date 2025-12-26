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

  const userId = auth.currentUser?.uid;
  const customerRef = userId ? collection(db, 'users', userId, 'customers') : null;

  const fetchCustomers = async () => {
    if (!customerRef) return;
    try {
      const snapshot = await getDocs(customerRef);
      const data = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        userId // Add userId for ledger access
      }));
      setCustomers(data);
    } catch (err) {
      console.error(err);
      setMessage('Failed to load customers');
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [userId, customerRef]);

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
      // Delete ledger entries first
      const ledgerRef = collection(db, 'users', userId, 'customers', customerId, 'ledger');
      const ledgerSnapshot = await getDocs(ledgerRef);
      for (const ledgerDoc of ledgerSnapshot.docs) {
        await deleteDoc(doc(db, 'users', userId, 'customers', customerId, 'ledger', ledgerDoc.id));
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

  if (selectedCustomer) {
    return <CustomerLedger customer={selectedCustomer} onBack={() => setSelectedCustomer(null)} />;
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #e8f5e9, #e3f2fd)',
      padding: '24px'
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 6px 18px rgba(0,0,0,0.06)',
        border: '1px solid #e0e0e0'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '16px' 
        }}>
          <div>
            <h2 style={{ margin: '0', color: '#2e7d32' }}>Customers</h2>
            <p style={{ marginTop: '4px', color: '#607d8b' }}>
              Add new customers and tap a card to view their ledger.
            </p>
          </div>
          <button onClick={goBack} style={{
            padding: '6px 12px',
            borderRadius: '999px',
            border: '1px solid #cfd8dc',
            backgroundColor: '#fafafa',
            cursor: 'pointer'
          }}>
            ← Back
          </button>
        </div>

        {/* Add/Edit Form */}
        <div style={{ 
          display: 'flex', 
          gap: '16px', 
          flexWrap: 'wrap', 
          marginBottom: '16px',
          backgroundColor: '#f5f5f5',
          padding: '16px',
          borderRadius: '10px'
        }}>
          <div style={{ flex: '1 1 220px', minWidth: '220px' }}>
            <label style={{ fontSize: '14px', color: '#455a64', fontWeight: '500' }}>
              Customer Name <span style={{ color: '#d32f2f' }}>*</span>
            </label><br />
            <input
              type="text"
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
                marginTop: '4px',
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: editingCustomer && !editingCustomer.name.trim() ? '2px solid #ef5350' : '1px solid #cfd8dc',
                outline: 'none',
                fontSize: '14px'
              }}
            />
          </div>
          
          <div style={{ flex: '1 1 220px', minWidth: '220px' }}>
            <label style={{ fontSize: '14px', color: '#455a64', fontWeight: '500' }}>
              Phone (optional)
            </label><br />
            <input
              type="text"
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
                marginTop: '4px',
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #cfd8dc',
                outline: 'none',
                fontSize: '14px'
              }}
            />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
            {editingCustomer ? (
              <>
                <button 
                  onClick={() => handleUpdateCustomer(editingCustomer.id)}
                  disabled={!editingCustomer.name.trim()}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: editingCustomer.name.trim() ? '#43a047' : '#bdbdbd',
                    color: '#fff',
                    cursor: editingCustomer.name.trim() ? 'pointer' : 'not-allowed',
                    fontWeight: '500',
                    fontSize: '14px'
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
                    padding: '10px 16px',
                    borderRadius: '8px',
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
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: name.trim() ? '#43a047' : '#bdbdbd',
                  color: '#fff',
                  cursor: name.trim() ? 'pointer' : 'not-allowed',
                  fontWeight: '500',
                  fontSize: '14px'
                }}
              >
                Add Customer
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        {message && (
          <div style={{
            marginBottom: '16px',
            padding: '12px 16px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500'
          }}>
            <span style={{
              color: message.toLowerCase().includes('error') || message.toLowerCase().includes('failed') ? '#d32f2f' : '#2e7d32',
              backgroundColor: message.toLowerCase().includes('error') || message.toLowerCase().includes('failed') ? '#ffebee' : '#e8f5e9'
            }}>
              {message}
            </span>
          </div>
        )}

        {/* Customer List */}
        <h3 style={{ marginTop: '12px', color: '#37474f', fontSize: '18px' }}>
          Customer List ({customers.length})
        </h3>
        
        {customers.length === 0 ? (
          <p style={{ color: '#78909c', fontStyle: 'italic', textAlign: 'center', padding: '40px' }}>
            No customers yet. Add your first customer above.
          </p>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '16px',
            marginTop: '16px'
          }}>
            {customers.map((c) => (
              <div 
                key={c.id} 
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  border: '1px solid #c8e6c9',
                  background: 'linear-gradient(135deg, #f1f8e9, #e8f5e9)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
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
                {/* Customer Info */}
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ 
                    fontWeight: '600', 
                    color: '#2e7d32', 
                    fontSize: '16px',
                    marginBottom: '4px'
                  }}>
                    {c.name}
                  </div>
                  {c.phone && (
                    <div style={{ 
                      fontSize: '14px', 
                      color: '#607d8b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      📞 {c.phone}
                    </div>
                  )}
                </div>

                {/* Action Buttons - Absolute positioned */}
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  display: 'flex',
                  gap: '6px'
                }}>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditCustomer(c);
                    }}
                    title="Edit Customer"
                    style={{
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: '1px solid #42a5f5',
                      backgroundColor: '#e3f2fd',
                      color: '#1976d2',
                      fontSize: '12px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
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
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: '1px solid #ef5350',
                      backgroundColor: '#ffebee',
                      color: '#d32f2f',
                      fontSize: '12px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
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

                {/* View Ledger Button */}
                <div style={{
                  marginTop: '12px',
                  padding: '8px 12px',
                  backgroundColor: 'rgba(67, 160, 71, 0.1)',
                  borderRadius: '6px',
                  textAlign: 'center',
                  fontSize: '13px',
                  color: '#2e7d32'
                }}>
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

