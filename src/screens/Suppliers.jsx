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
  const [overallStats, setOverallStats] = useState({
    totalPurchases: 0,
    totalPayments: 0,
    totalBalance: 0,
    totalSuppliers: 0
  });

  const userId = auth.currentUser?.uid;
  const supplierRef = userId ? collection(db, 'users', userId, 'suppliers') : null;

  const fetchSuppliers = async () => {
    if (!supplierRef) return;
    try {
      const snapshot = await getDocs(supplierRef);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        userId
      }));
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
      const suppliersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      let totalPurchases = 0;
      let totalPayments = 0;

      // FIXED: Use the SAME path as your ledger components (existing data location)
      for (const supplier of suppliersData) {
        const ledgerRef = collection(db, 'suppliers', supplier.id, 'ledger'); // ✅ Matches existing data
        const ledgerSnapshot = await getDocs(ledgerRef);
        
        let supplierPurchases = 0;
        let supplierPayments = 0;
        
        ledgerSnapshot.docs.forEach(ledgerDoc => {
          const data = ledgerDoc.data();
          if (data.type === 'purchase') supplierPurchases += Number(data.amount) || 0;
          if (data.type === 'payment') supplierPayments += Number(data.amount) || 0;
        });
        
        totalPurchases += supplierPurchases;
        totalPayments += supplierPayments;
      }

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

  // Refresh stats when suppliers change
  useEffect(() => {
    if (suppliers.length > 0) {
      fetchOverallStats();
    }
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
      // FIXED: Delete from existing ledger path too
      const userLedgerRef = collection(db, 'users', userId, 'suppliers', supplierId, 'ledger');
      const globalLedgerRef = collection(db, 'suppliers', supplierId, 'ledger');
      
      // Delete from both locations to be safe
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
    setPhone(supplier.phone || '');
  };

  const formatAmount = (num) => {
    return new Intl.NumberFormat("en-IN").format(Math.round(num));
  };

  if (selectedSupplier) {
    return (
      <SupplierLedger
        supplier={selectedSupplier}
        onBack={() => setSelectedSupplier(null)}
      />
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #fff3e0, #fce4ec)",
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
          Suppliers
        </h1>
        <p style={{ color: "#546e7a", marginBottom: "24px" }}>
      
        </p>

        {/* Overall Stats Card */}
        <div
          style={{
            marginBottom: "24px",
            padding: "20px",
            background: "linear-gradient(135deg, #fff3e0, #ffe0b2)",
            borderRadius: "12px",
            border: "2px solid #fb8c00",
            boxShadow: "0 4px 12px rgba(251, 140, 0, 0.15)",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", color: "#ef6c00", fontSize: "20px" }}>
            📊 Overall Suppliers Summary
          </h3>
          {loadingStats ? (
            <p style={{ color: "#fb8c00", margin: 0 }}>Loading stats...</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr)", gap: "12px" }}>
              <div>
                <div style={{ fontSize: "24px", fontWeight: "700", color: "#2e7d32", marginBottom: "4px" }}>
                  Rs. {formatAmount(overallStats.totalPurchases)}
                </div>
                <div style={{ color: "#4caf50", fontSize: "14px" }}>Total Purchases</div>
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
                  {overallStats.totalSuppliers}
                </div>
                <div style={{ color: "#757575", fontSize: "14px" }}>Total Suppliers</div>
              </div>
            </div>
          )}
        </div>

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
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: editingSupplier && !editingSupplier.name.trim() ? '2px solid #ef5350' : '1px solid #cfd8dc',
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
              value={editingSupplier ? editingSupplier.phone || '' : phone}
              onChange={(e) => {
                if (editingSupplier) {
                  setEditingSupplier({ ...editingSupplier, phone: e.target.value });
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
          {editingSupplier ? (
            <>
              <button
                onClick={() => handleUpdateSupplier(editingSupplier.id)}
                disabled={!editingSupplier.name.trim()}
                style={{
                  padding: "10px 16px",
                  borderRadius: "8px",
                  border: 'none',
                  backgroundColor: editingSupplier.name.trim() ? '#fb8c00' : '#bdbdbd',
                  color: '#fff',
                  cursor: editingSupplier.name.trim() ? 'pointer' : 'not-allowed',
                  fontWeight: '500',
                  fontSize: '14px',
                  whiteSpace: 'nowrap'
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
              onClick={handleAddSupplier}
              disabled={!name.trim()}
              style={{
                padding: "10px 16px",
                borderRadius: "8px",
                border: 'none',
                backgroundColor: name.trim() ? '#fb8c00' : '#bdbdbd',
                color: '#fff',
                cursor: name.trim() ? 'pointer' : 'not-allowed',
                fontWeight: '500',
                fontSize: '14px',
                whiteSpace: 'nowrap'
              }}
            >
              Add Supplier
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
              backgroundColor: "#fff3e0",
              color: "#ef6c00",
              fontSize: "14px",
            }}
          >
            {message}
          </div>
        )}

        {/* Supplier List */}
        <h3 style={{ marginBottom: "16px", color: "#1a237e" }}>
          Supplier List ({suppliers.length})
        </h3>
        {suppliers.length === 0 ? (
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
            No suppliers yet. Add your first supplier above.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
            {suppliers.map((s) => (
              <div
                key={s.id}
                style={{
                  borderRadius: "12px",
                  padding: "20px",
                  backgroundColor: "#f8f9fa",
                  border: "1px solid #e0e0e0",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
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
                <div style={{ fontSize: "18px", fontWeight: "600", color: "#ef6c00", marginBottom: "8px" }}>
                  {s.name}
                </div>
                {s.phone && (
                  <div style={{ color: "#546e7a", fontSize: "14px", marginBottom: "12px" }}>
                    📞 {s.phone}
                  </div>
                )}
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditSupplier(s);
                    }}
                    title="Edit Supplier"
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
                      handleDeleteSupplier(s.id);
                    }}
                    title="Delete Supplier"
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

export default Suppliers;
