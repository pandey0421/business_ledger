import React, { useState, useEffect } from 'react';
import { supplierService } from '../services/supplierService';
import SupplierLedger from './SupplierLedger';

const SupplierForm = React.memo(({ isMobile, editingSupplier, onAdd, onUpdate, onCancel }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (editingSupplier) {
      setName(editingSupplier.name);
      setPhone(editingSupplier.phone);
    } else {
      setName('');
      setPhone('');
    }
  }, [editingSupplier]);

  const handleSubmit = () => {
    if (editingSupplier) onUpdate(editingSupplier.id, name, phone);
    else onAdd(name, phone);
  };

  return (
    <div style={{
      display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '16px', background: '#fafafa',
      padding: isMobile ? '16px' : '24px', borderRadius: '20px', border: '1px solid #f0f0f0',
      marginBottom: isMobile ? '24px' : '32px', alignItems: 'flex-start'
    }}>
      <div style={{ flex: isMobile ? '1 1 100%' : '1 1 220px', minWidth: isMobile ? 'auto' : '220px', width: isMobile ? '100%' : 'auto' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#455a64', fontSize: '12px' }}>
          Supplier Name *
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter supplier name"
          style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: (editingSupplier && !name.trim()) ? '2px solid #ef5350' : '1px solid #e0e0e0', outline: 'none', fontSize: '14px', boxSizing: 'border-box', fontWeight: '500' }}
        />
      </div>
      <div style={{ flex: isMobile ? '1 1 100%' : '1 1 220px', minWidth: isMobile ? 'auto' : '220px', width: isMobile ? '100%' : 'auto' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#455a64', fontSize: '12px' }}>
          Phone (optional)
        </label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Enter phone number"
          style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e0e0e0', outline: 'none', fontSize: '14px', boxSizing: 'border-box', fontWeight: '500' }}
        />
      </div>
      {editingSupplier ? (
        <>
          <button
            onClick={handleSubmit} disabled={!name.trim()}
            style={{ padding: '12px 24px', borderRadius: '12px', border: 'none', backgroundColor: name.trim() ? '#fb8c00' : '#e0e0e0', color: name.trim() ? '#fff' : '#9e9e9e', cursor: name.trim() ? 'pointer' : 'not-allowed', fontWeight: '600', fontSize: '14px', whiteSpace: 'nowrap', flex: isMobile ? '1 1 100%' : '0 0 auto', height: '46px', alignSelf: 'flex-end', width: isMobile ? '100%' : 'auto' }}
          >
            Update
          </button>
          <button
            onClick={onCancel}
            style={{ padding: '12px 24px', borderRadius: '12px', border: '1px solid #e0e0e0', backgroundColor: 'white', color: '#546e7a', cursor: 'pointer', fontSize: '14px', fontWeight: '600', flex: isMobile ? '1 1 100%' : '0 0 auto', height: '46px', alignSelf: 'flex-end', width: isMobile ? '100%' : 'auto' }}
          >
            Cancel
          </button>
        </>
      ) : (
        <button
          onClick={handleSubmit} disabled={!name.trim()}
          style={{ padding: '12px 24px', borderRadius: '12px', border: 'none', backgroundColor: name.trim() ? '#fb8c00' : '#e0e0e0', color: name.trim() ? '#fff' : '#9e9e9e', cursor: name.trim() ? 'pointer' : 'not-allowed', fontWeight: '600', fontSize: '14px', whiteSpace: 'nowrap', flex: isMobile ? '1 1 100%' : '0 0 auto', height: '46px', alignSelf: 'flex-end', boxShadow: name.trim() ? '0 4px 12px rgba(251, 140, 0, 0.2)' : 'none', width: isMobile ? '100%' : 'auto' }}
        >
          Add Supplier
        </button>
      )}
    </div>
  );
});

function Suppliers({ goBack }) {
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


  const fetchSuppliers = async () => {
    setLoadingStats(true);
    try {
      const snapSuppliers = await supplierService.getSuppliers();

      // Use pre-computed totals stored on each supplier record
      const finalSuppliers = snapSuppliers.map(sData => ({
        ...sData,
        purchases: Number(sData.total_purchases) || 0,
        payments: Number(sData.total_paid) || 0,
        balance: Number(sData.total_balance) || 0
      }));

      setSuppliers(finalSuppliers);

      // Calculate Overall Stats from pre-computed values
      const totalPurchases = finalSuppliers.reduce((sum, s) => sum + s.purchases, 0);
      const totalPayments = finalSuppliers.reduce((sum, s) => sum + s.payments, 0);

      setOverallStats({
        totalPurchases: Math.max(0, totalPurchases),
        totalPayments: Math.max(0, totalPayments),
        totalBalance: Math.max(0, totalPurchases - totalPayments),
        totalSuppliers: finalSuppliers.length
      });

    } catch (err) {
      console.error(err);
      setMessage('Failed to load suppliers');
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
  }, []);

  const handleAddSupplier = async (newName, newPhone) => {
    try {
      await supplierService.addSupplier({
        name: newName.trim(),
        phone: newPhone.trim()
      });
      setMessage('Supplier added successfully');
      fetchSuppliers();
    } catch (err) {
      console.error(err);
      setMessage('Error adding supplier');
    }
  };

  const handleUpdateSupplier = async (supplierId, newName, newPhone) => {
    try {
      await supplierService.updateSupplier(supplierId, {
        name: newName.trim(),
        phone: newPhone.trim()
      });
      setMessage('Supplier updated successfully');
      setEditingSupplier(null);
      fetchSuppliers();
    } catch (err) {
      console.error(err);
      setMessage('Error updating supplier');
    }
  };

  const handleDeleteSupplier = async (supplierId) => {
    if (!window.confirm('Are you sure you want to move this supplier to the Recycle Bin?')) return;
    try {
      await supplierService.deleteSupplier(supplierId);
      setMessage('Supplier moved to Recycle Bin');
      fetchSuppliers();
    } catch (err) {
      console.error(err);
      setMessage('Error deleting supplier');
    }
  };

  const startEditSupplier = (supplier) => {
    setEditingSupplier(supplier);
  };

  const formatAmount = (num) => {
    return new Intl.NumberFormat('en-IN').format(Math.round(num));
  };

  if (selectedSupplier) {
    return <SupplierLedger supplier={selectedSupplier} onBack={handleBack} />;
  }

  return (
    <div style={{
      minHeight: '100dvh',
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
        <SupplierForm 
           isMobile={isMobile}
           editingSupplier={editingSupplier}
           onAdd={handleAddSupplier}
           onUpdate={handleUpdateSupplier}
           onCancel={() => setEditingSupplier(null)}
        />

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