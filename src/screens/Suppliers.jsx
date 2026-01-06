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
  const [loadingStats, setLoadingStats] = useState(true);
  const [overallStats, setOverallStats] = useState({ totalPurchases: 0, totalPayments: 0, totalBalance: 0, totalSuppliers: 0 });
  const [isMobile, setIsMobile] = useState(false); // Responsive hook

  // Mobile responsive detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const userId = auth.currentUser?.uid;
  const supplierRef = userId ? collection(db, 'users', userId, 'suppliers') : null;

  const fetchSuppliers = async () => {
    if (!supplierRef) return;
    try {
      const snapshot = await getDocs(supplierRef);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), userId }));
      setSuppliers(data);
    } catch (err) {
      console.error(err);
      setMessage('Failed to load suppliers');
    }
  };

  const fetchOverallStats = async () => {
    if (!supplierRef || !userId) {
      setLoadingStats(false);
      return;
    }
    setLoadingStats(true);
    try {
      const snapshot = await getDocs(supplierRef);
      const suppliersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));


      const results = await Promise.all(suppliersData.map(async (supplier) => {
        const ledgerRef = collection(db, 'suppliers', supplier.id, 'ledger');
        const ledgerSnapshot = await getDocs(ledgerRef);
        let supplierPurchases = 0;
        let supplierPayments = 0;
        ledgerSnapshot.docs.forEach(ledgerDoc => {
          const data = ledgerDoc.data();
          if (data.type === 'purchase') supplierPurchases += Number(data.amount) || 0;
          if (data.type === 'payment') supplierPayments += Number(data.amount) || 0;
        });
        return { purchases: supplierPurchases, payments: supplierPayments };
      }));

      const totalPurchases = results.reduce((acc, curr) => acc + curr.purchases, 0);
      const totalPayments = results.reduce((acc, curr) => acc + curr.payments, 0);

      setOverallStats({
        totalPurchases: Math.max(0, totalPurchases),
        totalPayments: Math.max(0, totalPayments),
        totalBalance: Math.max(0, totalPurchases - totalPayments),
        totalSuppliers: suppliersData.length
      });
    } catch (err) {
      console.error('Failed to fetch overall stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
    fetchOverallStats();
  }, [userId]);

  useEffect(() => {
    if (suppliers.length > 0) fetchOverallStats();
  }, [suppliers]);

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
        phone: phone.trim(),
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
        phone: editingSupplier.phone.trim()
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
      // Delete from both locations to be safe
      const userLedgerRef = collection(db, 'users', userId, 'suppliers', supplierId, 'ledger');
      const globalLedgerRef = collection(db, 'suppliers', supplierId, 'ledger');

      const userLedgerSnapshot = await getDocs(userLedgerRef);
      for (const ledgerDoc of userLedgerSnapshot.docs) {
        await deleteDoc(doc(db, 'users', userId, 'suppliers', supplierId, 'ledger', ledgerDoc.id));
      }

      const globalLedgerSnapshot = await getDocs(globalLedgerRef);
      for (const ledgerDoc of globalLedgerSnapshot.docs) {
        await deleteDoc(doc(db, 'suppliers', supplierId, 'ledger', ledgerDoc.id));
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
    setPhone(supplier.phone);
  };

  const formatAmount = (num) => {
    return new Intl.NumberFormat('en-IN').format(Math.round(num));
  };

  if (selectedSupplier) {
    return <SupplierLedger supplier={selectedSupplier} onBack={() => setSelectedSupplier(null)} />;
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #fff3e0 0%, #fce4ec 100%)',
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
              Suppliers
            </h1>
            <p style={{ color: '#546e7a', margin: 0, fontSize: isMobile ? '14px' : '16px' }}>
              Manage your suppliers and track payables
            </p>
          </div>
        </div>

        {/* Overall Stats Card */}
        <div style={{
          marginBottom: isMobile ? '24px' : '32px',
          padding: isMobile ? '20px' : '28px',
          background: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)',
          borderRadius: '16px',
          border: '2px solid #fb8c00',
          boxShadow: '0 8px 24px rgba(251, 140, 0, 0.15)'
        }}>
          <h3 style={{ margin: '0 0 20px 0', color: '#ef6c00', fontSize: isMobile ? '20px' : '24px' }}>
            Overall Suppliers Summary
          </h3>
          {loadingStats ? (
            <p style={{ color: '#fb8c00', margin: 0, fontSize: '16px', textAlign: 'center' }}>
              Loading stats...
            </p>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: isMobile ? '12px' : '20px'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: isMobile ? '24px' : '28px', fontWeight: '700', color: '#2e7d32', marginBottom: '8px' }}>
                  Rs. {formatAmount(overallStats.totalPurchases)}
                </div>
                <div style={{ color: '#4caf50', fontSize: '14px' }}>Total Purchases</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: isMobile ? '24px' : '28px', fontWeight: '700', color: '#c62828', marginBottom: '8px' }}>
                  Rs. {formatAmount(overallStats.totalPayments)}
                </div>
                <div style={{ color: '#d32f2f', fontSize: '14px' }}>Total Payments</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: isMobile ? '24px' : '28px', fontWeight: '700', color: '#1976d2', marginBottom: '8px' }}>
                  Rs. {formatAmount(overallStats.totalBalance)}
                </div>
                <div style={{ color: '#1e88e5', fontSize: '14px' }}>Remaining Balance</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: isMobile ? '24px' : '28px', fontWeight: '700', color: '#424242', marginBottom: '8px' }}>
                  {overallStats.totalSuppliers}
                </div>
                <div style={{ color: '#757575', fontSize: '14px' }}>Total Suppliers</div>
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
          <div style={{ flex: isMobile ? '1 1 100%' : '1 1 220px', minWidth: isMobile ? 'auto' : '220px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#37474f' }}>
              Supplier Name *
            </label>
            <input
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
                width: '100%',
                padding: '12px 16px',
                borderRadius: '10px',
                border: editingSupplier && !editingSupplier.name.trim() ? '2px solid #ef5350' : '1px solid #cfd8dc',
                outline: 'none',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>
          <div style={{ flex: isMobile ? '1 1 100%' : '1 1 220px', minWidth: isMobile ? 'auto' : '220px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#37474f' }}>
              Phone (optional)
            </label>
            <input
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
          {editingSupplier ? (
            <>
              <button
                onClick={() => handleUpdateSupplier(editingSupplier.id)}
                disabled={!editingSupplier.name.trim()}
                style={{
                  padding: '12px 24px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: editingSupplier.name.trim() ? '#fb8c00' : '#bdbdbd',
                  color: '#fff',
                  cursor: editingSupplier.name.trim() ? 'pointer' : 'not-allowed',
                  fontWeight: '500',
                  fontSize: '14px',
                  whiteSpace: 'nowrap',
                  flex: isMobile ? '1 1 100%' : '0 0 auto'
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
              onClick={handleAddSupplier}
              disabled={!name.trim()}
              style={{
                padding: '12px 24px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: name.trim() ? '#fb8c00' : '#bdbdbd',
                color: '#fff',
                cursor: name.trim() ? 'pointer' : 'not-allowed',
                fontWeight: '500',
                fontSize: '14px',
                whiteSpace: 'nowrap',
                flex: isMobile ? '1 1 100%' : '0 0 auto'
              }}
            >
              Add Supplier
            </button>
          )}
        </div>

        {/* Messages */}
        {message && (
          <div style={{
            marginBottom: '20px',
            padding: '12px 16px',
            borderRadius: '10px',
            backgroundColor: '#fff3e0',
            color: '#ef6c00',
            fontSize: '14px',
            border: '1px solid #ffe0b2'
          }}>
            {message}
          </div>
        )}

        {/* Supplier List */}
        <h3 style={{ marginBottom: isMobile ? '20px' : '24px', color: '#1a237e', fontSize: isMobile ? '20px' : '24px' }}>
          Supplier List ({suppliers.length})
        </h3>
        {suppliers.length === 0 ? (
          <div style={{
            padding: isMobile ? '32px 16px' : '48px 24px',
            textAlign: 'center',
            color: '#78909c',
            backgroundColor: '#fafafa',
            borderRadius: '16px',
            border: '1px dashed #cfd8dc'
          }}>
            No suppliers yet. Add your first supplier above.
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: isMobile ? '12px' : '20px'
          }}>
            {suppliers.map(s => (
              <div
                key={s.id}
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
                onClick={() => setSelectedSupplier({ ...s, userId })}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-6px)';
                  e.currentTarget.style.boxShadow = '0 12px 32px rgba(239,108,0,0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                }}
              >
                <div style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: '600', color: '#ef6c00', marginBottom: '12px' }}>
                  {s.name}
                </div>
                {s.phone && (
                  <div style={{ color: '#546e7a', fontSize: isMobile ? '14px' : '15px', marginBottom: '16px' }}>
                    {s.phone}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditSupplier(s);
                    }}
                    title="Edit Supplier"
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
                      handleDeleteSupplier(s.id);
                    }}
                    title="Delete Supplier"
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
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#fcdd2'}
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

export default Suppliers;