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
  const [isMobile, setIsMobile] = useState(false);

  // Responsive hook
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
      console.error('Failed to fetch stats', err);
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
      console.error('Logout failed', err);
    }
  };

  const formatAmount = (num) => {
    return new Intl.NumberFormat('en-IN').format(Math.round(num));
  };

  const netProfit = stats.totalReceivables - stats.totalPayables - stats.totalExpenses;

  // 🎯 PERFECT DESKTOP + MOBILE STYLES
  const containerStyle = {
  minHeight: '100vh',
  background: 'linear-gradient(135deg, #f1f8e9 0%, #e3f2fd 100%)',
  display: 'flex',
  flexDirection: 'column',
  width: '100vw',
  margin: 0,
  padding: isMobile ? '4px' : '24px',  // ONLY mobile padding reduced
  overflowX: 'hidden',
  boxSizing: 'border-box'
  };

  const mainCardStyle = {
  maxWidth: isMobile ? 'calc(100vw - 8px)' : '1200px',  // Mobile: viewport minus padding
  margin: '0 auto',
  width: '100%',
  backgroundColor: '#ffffff',
  borderRadius: isMobile ? '8px' : '16px',              // Smaller radius mobile
  padding: isMobile ? '20px' : '32px',
  boxShadow: isMobile ? '0 4px 16px rgba(0,0,0,0.08)' : '0 8px 32px rgba(0,0,0,0.12)',
  border: isMobile ? '1px solid #e0e0e0' : '1px solid #e0e0e0',
  boxSizing: 'border-box'
  };

  const headerStyle = {
  display: 'flex',
  justifyContent: isMobile ? 'center' : 'space-between',  // Desktop unchanged
  alignItems: isMobile ? 'flex-start' : 'center',
  marginBottom: isMobile ? '20px' : '32px',
  gap: isMobile ? '12px' : '0',                          // Desktop gap 0
  flexDirection: isMobile ? 'column' : 'row',
  boxSizing: 'border-box'              // Desktop row
  };

  const titleStyle = {
    margin: 0,
    color: '#1b5e20',
    fontSize: isMobile ? '24px' : '32px',
    fontWeight: 'bold'
  };

  const subtitleStyle = {
    marginTop: isMobile ? '4px' : '4px',
    color: '#607d8b',
    fontSize: isMobile ? '14px' : '16px',
    margin: 0
  };

  const logoutButtonStyle = {
    padding: isMobile ? '10px 16px' : '12px 20px',
    borderRadius: '999px',
    border: '1px solid #ef9a9a',
    backgroundColor: '#ffebee',
    color: '#c62828',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s',
    width: isMobile ? '100%' : 'auto'
  };

  const actionCardsStyle = {
  display: 'grid',
  gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))',  // Desktop grid preserved
  gap: isMobile ? '16px' : '24px',
  marginBottom: isMobile ? '28px' : '40px'
  };

  const cardStyle = (hoverColor) => ({
  background: `linear-gradient(135deg, ${hoverColor[0]} 0%, ${hoverColor[1]} 100%)`,
  borderRadius: '16px',
  padding: isMobile ? '20px' : '24px',                    // Slightly less mobile padding
  boxShadow: '0 6px 20px rgba(0,0,0,0.08)',
  border: '1px solid transparent',
  cursor: 'pointer',
  transition: 'all 0.3s',
  display: 'flex',
  flexDirection: 'column'
  });

  const cardTitleStyle = {
    margin: '0 0 16px 0',
    fontSize: isMobile ? '20px' : '24px'
  };

  const cardButtonStyle = {
    width: '100%',
    padding: '12px 20px',
    borderRadius: '10px',
    border: 'none',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '14px',
    marginTop: 'auto'
  };

  const summaryStyle = {
  display: 'grid',
  gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(260px, 1fr))',  // Desktop grid preserved
  gap: isMobile ? '16px' : '24px'
  };

  const summaryCardStyle = (bgGradient, borderColor) => ({
    background: bgGradient,
    borderRadius: '16px',
    padding: isMobile ? '20px' : '24px',
    textAlign: 'center',
    border: `1px solid ${borderColor}`,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  });

  const amountStyle = {
    fontSize: isMobile ? '28px' : '36px',
    fontWeight: '700',
    marginBottom: '8px'
  };

  const refreshStyle = {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: '16px',
    padding: isMobile ? '20px' : '24px',
    textAlign: 'center',
    border: '1px solid #e0e0e0',
    cursor: 'pointer',
    marginTop: isMobile ? '24px' : '32px',
    width: '100%'
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={mainCardStyle}>
          <div style={{ textAlign: 'center', padding: '60px 12px', color: '#78909c' }}>
            Loading business stats...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={mainCardStyle}>
        <div style={headerStyle}>
          <div>
            <h2 style={titleStyle}>Karobar Khata</h2>
            <p style={subtitleStyle}>Real-time overview of your accounts</p>
          </div>
          <button onClick={handleLogout} style={logoutButtonStyle}>
            Logout
          </button>
        </div>

        {/* Action Cards */}
        <div style={actionCardsStyle}>
          {/* Customers Card */}
          <div
            style={cardStyle(['#e3f2fd', '#e8eaf6'])}
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
            <h3 style={{ ...cardTitleStyle, color: '#1e88e5' }}>Customers</h3>
            <p style={{ fontSize: '14px', color: '#546e7a', marginBottom: '20px' }}>
              Manage customers and track receivables
            </p>
            <button style={{ ...cardButtonStyle, backgroundColor: '#42a5f5', color: '#fff' }}>
              Open Customers
            </button>
          </div>

          {/* Suppliers Card */}
          <div
            style={cardStyle(['#fff3e0', '#fff8e1'])}
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
            <h3 style={{ ...cardTitleStyle, color: '#ef6c00' }}>Suppliers</h3>
            <p style={{ fontSize: '14px', color: '#546e7a', marginBottom: '20px' }}>
              Manage suppliers and track payables
            </p>
            <button style={{ ...cardButtonStyle, backgroundColor: '#fb8c00', color: '#fff' }}>
              Open Suppliers
            </button>
          </div>

          {/* Expenses Card */}
          <div
            style={cardStyle(['#ffebee', '#ffcdd2'])}
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
            <h3 style={{ ...cardTitleStyle, color: '#c62828' }}>Expenses</h3>
            <p style={{ fontSize: '14px', color: '#546e7a', marginBottom: '20px' }}>
              Track all your business expenses
            </p>
            <button style={{ ...cardButtonStyle, backgroundColor: '#f44336', color: '#fff' }}>
              Open Expenses
            </button>
          </div>
        </div>

        {/* Business Summary */}
        <h3 style={{
          margin: '0 0 24px 0',
          color: '#37474f',
          fontSize: isMobile ? '20px' : '24px'
        }}>
          Business Summary
        </h3>
        <div style={summaryStyle}>
          {/* Total Receivables */}
          <div style={summaryCardStyle(
            'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)',
            '#a5d6a7'
          )}>
            <div style={{ fontSize: '14px', color: '#2e7d32', marginBottom: '8px' }}>
              Total Receivables
            </div>
            <div style={{ ...amountStyle, color: '#1b5e20' }}>
              Rs. {formatAmount(stats.totalReceivables)}
            </div>
            <div style={{ fontSize: '12px', color: '#546e7a' }}>
              {stats.totalCustomers} customers
            </div>
          </div>

          {/* Total Payables */}
          <div style={summaryCardStyle(
            'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)',
            '#ffcc80'
          )}>
            <div style={{ fontSize: '14px', color: '#ef6c00', marginBottom: '8px' }}>
              Total Payables
            </div>
            <div style={{ ...amountStyle, color: '#e65100' }}>
              Rs. {formatAmount(stats.totalPayables)}
            </div>
            <div style={{ fontSize: '12px', color: '#546e7a' }}>
              {stats.totalSuppliers} suppliers
            </div>
          </div>

          {/* Total Expenses */}
          <div style={summaryCardStyle(
            'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)',
            '#f8bbd9'
          )}>
            <div style={{ fontSize: '14px', color: '#c62828', marginBottom: '8px' }}>
              Total Expenses
            </div>
            <div style={{ ...amountStyle, color: '#d32f2f' }}>
              Rs. {formatAmount(stats.totalExpenses)}
            </div>
            <div style={{ fontSize: '12px', color: '#546e7a' }}>
              {stats.totalExpenseCategories} categories
            </div>
          </div>

          {/* Net Profit */}
          <div style={summaryCardStyle(
            netProfit >= 0
              ? 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)'
              : 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)',
            netProfit >= 0 ? '#90caf9' : '#f8bbd9'
          )}>
            <div style={{
              fontSize: '14px',
              color: netProfit >= 0 ? '#1e88e5' : '#c2185b',
              marginBottom: '8px'
            }}>
              Net Profit
            </div>
            <div style={{
              ...amountStyle,
              color: netProfit >= 0 ? '#1565c0' : '#ad1457'
            }}>
              Rs. {formatAmount(netProfit)}
            </div>
            <div style={{ fontSize: '12px', color: '#546e7a' }}>
              Receivables - Payables - Expenses
            </div>
          </div>
        </div>

        {/* Refresh Button */}
        {!loading && (
          <div style={refreshStyle} onClick={fetchStats}>
            <div style={{ fontSize: isMobile ? '20px' : '24px' }}>↻</div>
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