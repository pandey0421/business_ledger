import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import SupplierLedger from './SupplierLedger';

function Suppliers({ goBack }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [editingSupplier, setEditingSupplier] = useState(null);

  const userId = auth.currentUser?.uid;
  const supplierRef = userId ? collection(db, 'users', userId, 'suppliers') : null;

  const fetchSuppliers = async () => {
    if (!supplierRef) return;
    try {
      const snapshot = await getDocs(supplierRef);
      const data = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        userId // Add userId for ledger access
      }));
      setSuppliers(data);
    } catch (err) {
      console.error(err);
      setMessage('Failed to load suppliers');
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, [userId, supplierRef]);

  const handleAddSupplier = async () => {
    if (!name.trim()) {
      setMessage('Name is required');
      return;
    }
    if (!supplierRef) {
      setMessage('No user logged in');
      return;
    }
    try {
      await addDoc(supplierRef, {
        name: name.trim(),
        phone: phone.trim() || '',
        createdAt: serverTimestamp()
      });
      setMessage('Supplier added successfully');
      setName('');
      setPhone('');
      fetchSuppliers();
    } catch (err) {
      console.error(err);
      setMessage('Error adding supplier');
    }
  };

  const handleUpdateSupplier = async (supplierId) => {
    if (!editingSupplier || !supplierRef) return;
    if (!editingSupplier.name.trim()) {
      setMessage('Name is required');
      return;
    }
    try {
      await updateDoc(doc(db, 'users', userId, 'suppliers', supplierId), {
        name: editingSupplier.name.trim(),
        phone: editingSupplier.phone.trim() || ''
      });
      setMessage('Supplier updated successfully');
      setEditingSupplier(null);
      setName('');
      setPhone('');
      fetchSuppliers();
    } catch (err) {
      console.error(err);
      setMessage('Error updating supplier');
    }
  };

  const handleDeleteSupplier = async (supplierId) => {
    if (!window.confirm('Are you sure you want to delete this supplier and all their ledger entries?')) return;
    try {
      // Delete ledger entries first
      const ledgerRef = collection(db, 'users', userId, 'suppliers', supplierId, 'ledger');
      const ledgerSnapshot = await getDocs(ledgerRef);
      for (const ledgerDoc of ledgerSnapshot.docs) {
        await deleteDoc(doc(db, 'users', userId, 'suppliers', supplierId, 'ledger', ledgerDoc.id));
      }
      // Delete supplier
      await deleteDoc(doc(db, 'users', userId, 'suppliers', supplierId));
      setMessage('Supplier deleted successfully');
      fetchSuppliers();
    } catch (err) {
      console.error(err);
      setMessage('Error deleting supplier');
    }
  };

  const startEditSupplier = (supplier) => {
    setEditingSupplier({ ...supplier });
    setName(supplier.name);
    setPhone(supplier.phone || '');
  };

  if (selectedSupplier) {
    return <SupplierLedger supplier={selectedSupplier} onBack={() => setSelectedSupplier(null)} />;
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #fff8e1, #e3f2fd)',
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
            <h2 style={{ margin: '0', color: '#ef6c00' }}>Suppliers</h2>
            <p style={{ marginTop: '4px', color: '#607d8b' }}>
              Add new suppliers and tap a card to view their ledger.
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
          backgroundColor: '#fff3e0',
          padding: '16px',
          borderRadius: '10px'
        }}>
          <div style={{ flex: '1 1 220px', minWidth: '220px' }}>
            <label style={{ fontSize: '14px', color: '#455a64', fontWeight: '500' }}>
              Supplier Name <span style={{ color: '#d32f2f' }}>*</span>
            </label><br />
            <input
              type="text"
              value={editingSupplier ? editingSupplier.name : name}
              onChange={(e) => {
                if (editingSupplier) {
                  setEditingSupplier({ ...editingSupplier, name: e.target.value });
                } else {
                  setName(e.target.value);
                }
              }}
              placeholder="Enter supplier name"
              style={{
                marginTop: '4px',
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: editingSupplier && !editingSupplier.name.trim() ? '2px solid #ef5350' : '1px solid #cfd8dc',
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
              value={editingSupplier ? editingSupplier.phone : phone}
              onChange={(e) => {
                if (editingSupplier) {
                  setEditingSupplier({ ...editingSupplier, phone: e.target.value });
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
            {editingSupplier ? (
              <>
                <button 
                  onClick={() => handleUpdateSupplier(editingSupplier.id)}
                  disabled={!editingSupplier.name.trim()}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: editingSupplier.name.trim() ? '#fb8c00' : '#bdbdbd',
                    color: '#fff',
                    cursor: editingSupplier.name.trim() ? 'pointer' : 'not-allowed',
                    fontWeight: '500',
                    fontSize: '14px'
                  }}
                >
                  Update Supplier
                </button>
                <button 
                  onClick={() => {
                    setEditingSupplier(null);
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
                onClick={handleAddSupplier}
                disabled={!name.trim()}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: name.trim() ? '#fb8c00' : '#bdbdbd',
                  color: '#fff',
                  cursor: name.trim() ? 'pointer' : 'not-allowed',
                  fontWeight: '500',
                  fontSize: '14px'
                }}
              >
                Add Supplier
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
              color: message.toLowerCase().includes('error') || message.toLowerCase().includes('failed') ? '#d32f2f' : '#ef6c00',
              backgroundColor: message.toLowerCase().includes('error') || message.toLowerCase().includes('failed') ? '#ffebee' : '#fff3e0'
            }}>
              {message}
            </span>
          </div>
        )}

        {/* Supplier List */}
        <h3 style={{ marginTop: '12px', color: '#37474f', fontSize: '18px' }}>
          Supplier List ({suppliers.length})
        </h3>
        
        {suppliers.length === 0 ? (
          <p style={{ color: '#78909c', fontStyle: 'italic', textAlign: 'center', padding: '40px' }}>
            No suppliers yet. Add your first supplier above.
          </p>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '16px',
            marginTop: '16px'
          }}>
            {suppliers.map((s) => (
              <div 
                key={s.id} 
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  border: '1px solid #ffe0b2',
                  background: 'linear-gradient(135deg, #fff3e0, #fff8e1)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                }}
                onClick={() => setSelectedSupplier({ ...s, userId })}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(239,108,0,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
                }}
              >
                {/* Supplier Info */}
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ 
                    fontWeight: '600', 
                    color: '#ef6c00', 
                    fontSize: '16px',
                    marginBottom: '4px'
                  }}>
                    {s.name}
                  </div>
                  {s.phone && (
                    <div style={{ 
                      fontSize: '14px', 
                      color: '#607d8b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      📞 {s.phone}
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
                      startEditSupplier(s);
                    }}
                    title="Edit Supplier"
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
                      handleDeleteSupplier(s.id);
                    }}
                    title="Delete Supplier"
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
                  backgroundColor: 'rgba(251,140,0,0.1)',
                  borderRadius: '6px',
                  textAlign: 'center',
                  fontSize: '13px',
                  color: '#ef6c00'
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

export default Suppliers;

