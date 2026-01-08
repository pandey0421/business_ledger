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

  // Deep Linking for Supplier Ledger
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.slice(1);
      const [route, id] = hash.split('/');

      if (route === 'suppliers' && id && suppliers.length > 0) {
        // Find supplier by ID
        const found = suppliers.find(s => s.id === id);
        if (found) {
          setSelectedSupplier(found);
        }
      } else if (route === 'suppliers' && !id) {
        setSelectedSupplier(null);
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [suppliers]);

  const handleSelectSupplier = (supplier) => {
    window.location.hash = `suppliers/${supplier.id}`;
  };

  const handleBack = () => {
    window.location.hash = 'suppliers';
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
    return <SupplierLedger supplier={selectedSupplier} onBack={handleBack} />;
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
              color: '#d84315',
              fontSize: isMobile ? '24px' : '28px',
              fontWeight: 'bold'
            }}>
              Suppliers
            </h1>
            <p style={{
              color: '#546e7a',
              margin: 0,
              fontSize: isMobile ? '14px' : '16px'
            }}>
              Manage your suppliers and track payables
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
          background: 'linear-gradient(to right, #ffffff, #fff3e0)' // Subtle orange hint
        }}>
          <h3 style={{
            margin: '0 0 20px 0',
            color: '#ef6c00',
            fontSize: isMobile ? '18px' : '20px',
            fontWeight: 'bold'
          }}>
            Overview
          </h3>
          {loadingStats ? (
            <p style={{ color: '#fb8c00', margin: 0, fontSize: '14px', textAlign: 'center' }}>
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
                  Rs. {formatAmount(overallStats.totalPurchases)}
                </div>
                <div style={{ color: '#c62828', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Total Purchases</div>
              </div>
              <div style={{ textAlign: 'center', padding: '16px', background: '#e8f5e8', borderRadius: '16px' }}>
                <div style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 'bold', color: '#2e7d32', marginBottom: '4px' }}>
                  Rs. {formatAmount(overallStats.totalPayments)}
                </div>
                <div style={{ color: '#2e7d32', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Paid</div>
              </div>
              <div style={{ textAlign: 'center', padding: '16px', background: '#e3f2fd', borderRadius: '16px' }}>
                <div style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 'bold', color: '#1565c0', marginBottom: '4px' }}>
                  Rs. {formatAmount(overallStats.totalBalance)}
                </div>
                <div style={{ color: '#1565c0', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Payable</div>
              </div>
              <div style={{ textAlign: 'center', padding: '16px', background: '#fafafa', borderRadius: '16px' }}>
                <div style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 'bold', color: '#455a64', marginBottom: '4px' }}>
                  {overallStats.totalSuppliers}
                </div>
                <div style={{ color: '#455a64', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Suppliers</div>
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
          <div style={{ flex: isMobile ? '1 1 100%' : '1 1 220px', minWidth: isMobile ? 'auto' : '220px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#455a64', fontSize: '12px' }}>
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
                borderRadius: '12px',
                border: editingSupplier && !editingSupplier.name.trim() ? '2px solid #ef5350' : '1px solid #e0e0e0',
                outline: 'none',
                fontSize: '14px',
                boxSizing: 'border-box',
                fontWeight: '500'
              }}
            />
          </div>
          <div style={{ flex: isMobile ? '1 1 100%' : '1 1 220px', minWidth: isMobile ? 'auto' : '220px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#455a64', fontSize: '12px' }}>
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
                borderRadius: '12px',
                border: '1px solid #e0e0e0',
                outline: 'none',
                fontSize: '14px',
                boxSizing: 'border-box',
                fontWeight: '500'
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
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: editingSupplier.name.trim() ? '#fb8c00' : '#e0e0e0',
                  color: editingSupplier.name.trim() ? '#fff' : '#9e9e9e',
                  cursor: editingSupplier.name.trim() ? 'pointer' : 'not-allowed',
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
                  setEditingSupplier(null);
                  setName('');
                  setPhone('');
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
              onClick={handleAddSupplier}
              disabled={!name.trim()}
              style={{
                padding: '12px 24px',
                borderRadius: '12px',
                border: 'none',
                backgroundColor: name.trim() ? '#fb8c00' : '#e0e0e0',
                color: name.trim() ? '#fff' : '#9e9e9e',
                cursor: name.trim() ? 'pointer' : 'not-allowed',
                fontWeight: '600',
                fontSize: '14px',
                whiteSpace: 'nowrap',
                flex: isMobile ? '1 1 100%' : '0 0 auto',
                height: '46px', alignSelf: 'flex-end',
                boxShadow: name.trim() ? '0 4px 12px rgba(251, 140, 0, 0.2)' : 'none'
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
            borderRadius: '12px',
            backgroundColor: '#fff3e0',
            color: '#ef6c00',
            fontSize: '14px',
            border: '1px solid #ffe0b2',
            fontWeight: '500'
          }}>
            {message}
          </div>
        )}

        {/* Supplier List */}
        <h3 style={{ marginBottom: isMobile ? '20px' : '24px', color: '#1a237e', fontSize: isMobile ? '20px' : '22px', fontWeight: 'bold' }}>
          Supplier List ({suppliers.length})
        </h3>
        {suppliers.length === 0 ? (
          <div style={{
            padding: isMobile ? '40px 20px' : '60px',
            textAlign: 'center',
            color: '#90a4ae',
            backgroundColor: '#fafafa',
            borderRadius: '20px',
            border: '1px dashed #cfd8dc',
            fontSize: '14px'
          }}>
            No suppliers yet. Add your first supplier above.
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: isMobile ? '16px' : '20px'
          }}>
            {suppliers.map(s => (
              <div
                key={s.id}
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
                onClick={() => handleSelectSupplier(s)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.08)';
                  e.currentTarget.style.borderColor = '#fb8c00';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.03)';
                  e.currentTarget.style.borderColor = '#f0f0f0';
                }}
              >
                <div style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: '700', color: '#ef6c00', marginBottom: '8px' }}>
                  {s.name}
                </div>
                {s.phone ? (
                  <div style={{ color: '#546e7a', fontSize: isMobile ? '13px' : '14px', marginBottom: '20px', fontWeight: '500' }}>
                    {s.phone}
                  </div>
                ) : (
                  <div style={{ color: '#b0bec5', fontSize: isMobile ? '13px' : '14px', marginBottom: '20px', fontStyle: 'italic' }}>
                    No phone number
                  </div>
                )}

                <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid #f0f0f0', paddingTop: '16px', marginTop: 'auto' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditSupplier(s);
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
                      handleDeleteSupplier(s.id);
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

export default Suppliers;