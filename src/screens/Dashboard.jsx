import { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';

function Dashboard({ onSelect }) {
  const [stats, setStats] = useState({
    totalReceivables: 0,
    totalPayables: 0,
    totalExpenses: 0,
    totalCustomers: 0,
    totalSuppliers: 0,
    totalExpenseCategories: 0
  });
  const [loading, setLoading] = useState(true);
  
  const userId = auth.currentUser?.uid;

  const fetchStats = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      // Fetch customer stats
      const customersRef = collection(db, 'users', userId, 'customers');
      const customersSnapshot = await getDocs(customersRef);
      const customers = customersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      let totalReceivables = 0;
      for (const customer of customers) {
        const ledgerRef = collection(db, 'customers', customer.id, 'ledger');
        const ledgerSnapshot = await getDocs(ledgerRef);
        let customerSales = 0;
        let customerPayments = 0;
        ledgerSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.type === 'sale') customerSales += Number(data.amount) || 0;
          if (data.type === 'payment') customerPayments += Number(data.amount) || 0;
        });
        totalReceivables += customerSales - customerPayments;
      }

      // Fetch supplier stats
      const suppliersRef = collection(db, 'users', userId, 'suppliers');
      const suppliersSnapshot = await getDocs(suppliersRef);
      const suppliers = suppliersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      let totalPayables = 0;
      for (const supplier of suppliers) {
        const ledgerRef = collection(db, 'suppliers', supplier.id, 'ledger');
        const ledgerSnapshot = await getDocs(ledgerRef);
        let supplierPurchases = 0;
        let supplierPayments = 0;
        ledgerSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.type === 'purchase') supplierPurchases += Number(data.amount) || 0;
          if (data.type === 'payment') supplierPayments += Number(data.amount) || 0;
        });
        totalPayables += supplierPurchases - supplierPayments;
      }

      // Fetch expenses stats
      const expensesRef = collection(db, 'users', userId, 'expenses');
      const expensesSnapshot = await getDocs(expensesRef);
      const expenses = expensesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      let totalExpenses = 0;
      for (const expense of expenses) {
        const ledgerRef = collection(db, 'expenses', expense.id, 'ledger');
        const ledgerSnapshot = await getDocs(ledgerRef);
        ledgerSnapshot.docs.forEach(doc => {
          const data = doc.data();
          totalExpenses += Number(data.amount) || 0;
        });
      }

      setStats({
        totalReceivables: Math.max(0, totalReceivables),
        totalPayables: Math.max(0, totalPayables),
        totalExpenses: Math.max(0, totalExpenses),
        totalCustomers: customers.length,
        totalSuppliers: suppliers.length,
        totalExpenseCategories: expenses.length
      });
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [userId]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const formatAmount = (num) => {
    return new Intl.NumberFormat('en-IN').format(Math.round(num));
  };

  const netProfit = stats.totalReceivables - stats.totalPayables - stats.totalExpenses;

  return (
    <div 
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f1f8e9 0%, #e3f2fd 100%)',
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
          maxWidth: '1200px',
          margin: '0 auto',
          width: '100%',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '32px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          border: '1px solid #e0e0e0'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h2 style={{ margin: 0, color: '#1b5e20', fontSize: '32px', fontWeight: 'bold' }}>
              Karobar Khata
            </h2>
            <p style={{ marginTop: '4px', color: '#607d8b', fontSize: '16px' }}>
              Real-time overview of your accounts
            </p>
          </div>
          <button 
            onClick={handleLogout}
            style={{
              padding: '12px 20px',
              borderRadius: '999px',
              border: '1px solid #ef9a9a',
              backgroundColor: '#ffebee',
              color: '#c62828',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.2s'
            }}
          >
            Logout
          </button>
        </div>

        {/* Action Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '40px' }}>
          {/* Customers Card */}
          <div 
            style={{
              background: 'linear-gradient(135deg, #e3f2fd 0%, #e8eaf6 100%)',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 6px 20px rgba(0,0,0,0.08)',
              border: '1px solid #bbdefb',
              cursor: 'pointer',
              transition: 'all 0.3s'
            }}
            onClick={() => onSelect('customers')}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-4px)';
              e.target.style.boxShadow = '0 12px 40px rgba(30, 136, 229, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'none';
              e.target.style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)';
            }}
          >
            <h3 style={{ margin: '0 0 16px 0', color: '#1e88e5', fontSize: '24px' }}>Customers</h3>
            <p style={{ fontSize: '14px', color: '#546e7a', marginBottom: '20px' }}>
              Manage customers and track receivables
            </p>
            <button 
              style={{
                width: '100%',
                padding: '12px 20px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: '#42a5f5',
                color: '#fff',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Open Customers
            </button>
          </div>

          {/* Suppliers Card */}
          <div 
            style={{
              background: 'linear-gradient(135deg, #fff3e0 0%, #fff8e1 100%)',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 6px 20px rgba(0,0,0,0.08)',
              border: '1px solid #ffe0b2',
              cursor: 'pointer',
              transition: 'all 0.3s'
            }}
            onClick={() => onSelect('suppliers')}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-4px)';
              e.target.style.boxShadow = '0 12px 40px rgba(239, 108, 0, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'none';
              e.target.style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)';
            }}
          >
            <h3 style={{ margin: '0 0 16px 0', color: '#ef6c00', fontSize: '24px' }}>Suppliers</h3>
            <p style={{ fontSize: '14px', color: '#546e7a', marginBottom: '20px' }}>
              Manage suppliers and track payables
            </p>
            <button 
              style={{
                width: '100%',
                padding: '12px 20px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: '#fb8c00',
                color: '#fff',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Open Suppliers
            </button>
          </div>

          {/* Expenses Card */}
          <div 
            style={{
              background: 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 6px 20px rgba(0,0,0,0.08)',
              border: '1px solid #f8bbd9',
              cursor: 'pointer',
              transition: 'all 0.3s'
            }}
            onClick={() => onSelect('expenses')}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-4px)';
              e.target.style.boxShadow = '0 12px 40px rgba(244, 67, 54, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'none';
              e.target.style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)';
            }}
          >
            <h3 style={{ margin: '0 0 16px 0', color: '#c62828', fontSize: '24px' }}>Expenses</h3>
            <p style={{ fontSize: '14px', color: '#546e7a', marginBottom: '20px' }}>
              Track all your business expenses
            </p>
            <button 
              style={{
                width: '100%',
                padding: '12px 20px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: '#f44336',
                color: '#fff',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Open Expenses
            </button>
          </div>
        </div>

        {/* Business Summary */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#78909c' }}>
            Loading business stats...
          </div>
        ) : (
          <>
            <h3 style={{ margin: '0 0 24px 0', color: '#37474f', fontSize: '24px' }}>Business Summary</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px' }}>
              {/* Total Receivables */}
              <div style={{
                background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)',
                borderRadius: '16px',
                padding: '24px',
                textAlign: 'center',
                border: '1px solid #a5d6a7'
              }}>
                <div style={{ fontSize: '14px', color: '#2e7d32', marginBottom: '8px' }}>Total Receivables</div>
                <div style={{ fontSize: '36px', fontWeight: '700', color: '#1b5e20', marginBottom: '8px' }}>
                  Rs. {formatAmount(stats.totalReceivables)}
                </div>
                <div style={{ fontSize: '12px', color: '#546e7a' }}>
                  {stats.totalCustomers} customers
                </div>
              </div>

              {/* Total Payables */}
              <div style={{
                background: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)',
                borderRadius: '16px',
                padding: '24px',
                textAlign: 'center',
                border: '1px solid #ffcc80'
              }}>
                <div style={{ fontSize: '14px', color: '#ef6c00', marginBottom: '8px' }}>Total Payables</div>
                <div style={{ fontSize: '36px', fontWeight: '700', color: '#e65100', marginBottom: '8px' }}>
                  Rs. {formatAmount(stats.totalPayables)}
                </div>
                <div style={{ fontSize: '12px', color: '#546e7a' }}>
                  {stats.totalSuppliers} suppliers
                </div>
              </div>

              {/* Total Expenses */}
              <div style={{
                background: 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)',
                borderRadius: '16px',
                padding: '24px',
                textAlign: 'center',
                border: '1px solid #f8bbd9'
              }}>
                <div style={{ fontSize: '14px', color: '#c62828', marginBottom: '8px' }}>Total Expenses</div>
                <div style={{ fontSize: '36px', fontWeight: '700', color: '#d32f2f', marginBottom: '8px' }}>
                  Rs. {formatAmount(stats.totalExpenses)}
                </div>
                <div style={{ fontSize: '12px', color: '#546e7a' }}>
                  {stats.totalExpenseCategories} categories
                </div>
              </div>

              {/* Net Profit */}
              <div style={{
                background: netProfit >= 0 
                  ? 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)' 
                  : 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)',
                borderRadius: '16px',
                padding: '24px',
                textAlign: 'center',
                border: netProfit >= 0 ? '1px solid #90caf9' : '1px solid #f8bbd9'
              }}>
                <div style={{ 
                  fontSize: '14px', 
                  color: netProfit >= 0 ? '#1e88e5' : '#c2185b', 
                  marginBottom: '8px' 
                }}>
                  Net Profit
                </div>
                <div style={{ 
                  fontSize: '36px', 
                  fontWeight: '700', 
                  color: netProfit >= 0 ? '#1565c0' : '#ad1457', 
                  marginBottom: '8px' 
                }}>
                  Rs. {formatAmount(netProfit)}
                </div>
                <div style={{ fontSize: '12px', color: '#546e7a' }}>
                  Receivables - Payables - Expenses
                </div>
              </div>
            </div>
          </>
        )}

        {/* Refresh Button */}
        {!loading && (
          <div 
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              background: '#f5f5f5',
              borderRadius: '16px',
              padding: '24px',
              textAlign: 'center',
              border: '1px solid #e0e0e0',
              cursor: 'pointer',
              marginTop: '32px'
            }}
            onClick={fetchStats}
          >
            <div style={{ fontSize: '24px' }}>↻</div>
            <div style={{ fontSize: '16px', color: '#607d8b', marginTop: '8px' }}>
              Refresh Stats
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
