import { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import '../styles/ResponsiveStyles.css'; // ensure this path matches your folder structure

function Dashboard({ onSelect }) {
  const [stats, setStats] = useState({
    totalReceivables: 0,
    totalPayables: 0,
    totalExpenses: 0,
    totalCustomers: 0,
    totalSuppliers: 0,
    totalExpenseCategories: 0,
  });
  const [loading, setLoading] = useState(true);

  const userId = auth.currentUser?.uid;

  const fetchStats = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      // Customers
      const customersRef = collection(db, 'users', userId, 'customers');
      const customersSnapshot = await getDocs(customersRef);
      const customers = customersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      let totalReceivables = 0;
      for (const customer of customers) {
        const ledgerRef = collection(db, 'customers', customer.id, 'ledger');
        const ledgerSnapshot = await getDocs(ledgerRef);
        let customerSales = 0;
        let customerPayments = 0;

        ledgerSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          if (data.type === 'sale') customerSales += Number(data.amount) || 0;
          if (data.type === 'payment') customerPayments += Number(data.amount) || 0;
        });

        totalReceivables += customerSales - customerPayments;
      }

      // Suppliers
      const suppliersRef = collection(db, 'users', userId, 'suppliers');
      const suppliersSnapshot = await getDocs(suppliersRef);
      const suppliers = suppliersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      let totalPayables = 0;
      for (const supplier of suppliers) {
        const ledgerRef = collection(db, 'suppliers', supplier.id, 'ledger');
        const ledgerSnapshot = await getDocs(ledgerRef);
        let supplierPurchases = 0;
        let supplierPayments = 0;

        ledgerSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          if (data.type === 'purchase') supplierPurchases += Number(data.amount) || 0;
          if (data.type === 'payment') supplierPayments += Number(data.amount) || 0;
        });

        totalPayables += supplierPurchases - supplierPayments;
      }

      // Expenses
      const expensesRef = collection(db, 'users', userId, 'expenses');
      const expensesSnapshot = await getDocs(expensesRef);
      const expenses = expensesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      let totalExpenses = 0;
      for (const expense of expenses) {
        const ledgerRef = collection(db, 'expenses', expense.id, 'ledger');
        const ledgerSnapshot = await getDocs(ledgerRef);

        ledgerSnapshot.docs.forEach((doc) => {
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
        totalExpenseCategories: expenses.length,
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

  const formatAmount = (num) =>
    new Intl.NumberFormat('en-IN').format(Math.round(num || 0));

  const netProfit =
    stats.totalReceivables - stats.totalPayables - stats.totalExpenses;

  return (
    <div
      className="responsive-container"
      style={{
        background: 'linear-gradient(135deg, #f1f8e9, #e3f2fd)',
      }}
    >
      <div
        className="responsive-card"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 6px 18px rgba(0,0,0,0.06)',
          border: '1px solid #e0e0e0',
        }}
      >
        {/* Header */}
        <div
          className="responsive-flex"
          style={{
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                color: '#1b5e20',
                fontSize: '28px',
              }}
            >
              Karobar Khata
            </h2>
            <p
              style={{
                marginTop: '4px',
                color: '#607d8b',
                fontSize: '16px',
              }}
            >
              Real-time overview of your accounts
            </p>
          </div>
          <button
            onClick={handleLogout}
            style={{
              padding: '10px 16px',
              borderRadius: '999px',
              border: '1px solid #ef9a9a',
              backgroundColor: '#ffebee',
              color: '#c62828',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            Logout
          </button>
        </div>

        {/* Action Cards */}
        <div className="responsive-grid" style={{ marginBottom: '16px' }}>
          {/* Customers */}
          <div
            className="responsive-card"
            style={{
              background: 'linear-gradient(135deg, #e3f2fd, #e8eaf6)',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              border: '1px solid #bbdefb',
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onClick={() => onSelect('customers')}
          >
            <h3
              style={{
                marginTop: 0,
                marginBottom: '8px',
                color: '#1e88e5',
                fontSize: '20px',
              }}
            >
              Customers
            </h3>
            <p
              style={{
                fontSize: '14px',
                color: '#546e7a',
                marginBottom: '12px',
              }}
            >
              Manage sales and receivables
            </p>
            <button
              style={{
                width: '100%',
                padding: '10px 16px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#42a5f5',
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              Open Customers
            </button>
          </div>

          {/* Suppliers */}
          <div
            className="responsive-card"
            style={{
              background: 'linear-gradient(135deg, #fff3e0, #fff8e1)',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              border: '1px solid #ffe0b2',
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onClick={() => onSelect('suppliers')}
          >
            <h3
              style={{
                marginTop: 0,
                marginBottom: '8px',
                color: '#ef6c00',
                fontSize: '20px',
              }}
            >
              Suppliers
            </h3>
            <p
              style={{
                fontSize: '14px',
                color: '#546e7a',
                marginBottom: '12px',
              }}
            >
              Track purchases and payables
            </p>
            <button
              style={{
                width: '100%',
                padding: '10px 16px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#fb8c00',
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              Open Suppliers
            </button>
          </div>

          {/* Expenses */}
          <div
            className="responsive-card"
            style={{
              background: 'linear-gradient(135deg, #ffebee, #ffcdd2)',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              border: '1px solid #f8bbd9',
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onClick={() => onSelect('expenses')}
          >
            <h3
              style={{
                marginTop: 0,
                marginBottom: '8px',
                color: '#c62828',
                fontSize: '20px',
              }}
            >
              Expenses
            </h3>
            <p
              style={{
                fontSize: '14px',
                color: '#546e7a',
                marginBottom: '12px',
              }}
            >
              Monitor all your expenses
            </p>
            <button
              style={{
                width: '100%',
                padding: '10px 16px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#f44336',
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              Open Expenses
            </button>
          </div>
        </div>

        {/* Business Summary */}
        {loading ? (
          <div
            style={{
              textAlign: 'center',
              padding: '40px',
              color: '#78909c',
            }}
          >
            Loading business stats...
          </div>
        ) : (
          <>
            <h3
              style={{
                marginTop: 0,
                marginBottom: '12px',
                color: '#37474f',
                fontSize: '20px',
              }}
            >
              Business Summary
            </h3>

            <div className="responsive-grid" style={{ gap: '12px' }}>
              {/* Total Receivables */}
              <div
                className="responsive-card"
                style={{
                  background: 'linear-gradient(135deg, #e8f5e9, #c8e6c9)',
                  borderRadius: '12px',
                  textAlign: 'center',
                  border: '1px solid #a5d6a7',
                }}
              >
                <div
                  style={{
                    fontSize: '14px',
                    color: '#2e7d32',
                    marginBottom: '4px',
                  }}
                >
                  Total Receivables
                </div>
                <div
                  style={{
                    fontSize: '28px',
                    fontWeight: 700,
                    color: '#1b5e20',
                    marginBottom: '4px',
                  }}
                >
                  Rs. {formatAmount(stats.totalReceivables)}
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: '#546e7a',
                  }}
                >
                  {stats.totalCustomers} customers
                </div>
              </div>

              {/* Total Payables */}
              <div
                className="responsive-card"
                style={{
                  background: 'linear-gradient(135deg, #fff3e0, #ffe0b2)',
                  borderRadius: '12px',
                  textAlign: 'center',
                  border: '1px solid #ffcc80',
                }}
              >
                <div
                  style={{
                    fontSize: '14px',
                    color: '#ef6c00',
                    marginBottom: '4px',
                  }}
                >
                  Total Payables
                </div>
                <div
                  style={{
                    fontSize: '28px',
                    fontWeight: 700,
                    color: '#e65100',
                    marginBottom: '4px',
                  }}
                >
                  Rs. {formatAmount(stats.totalPayables)}
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: '#546e7a',
                  }}
                >
                  {stats.totalSuppliers} suppliers
                </div>
              </div>

              {/* Total Expenses */}
              <div
                className="responsive-card"
                style={{
                  background: 'linear-gradient(135deg, #ffebee, #ffcdd2)',
                  borderRadius: '12px',
                  textAlign: 'center',
                  border: '1px solid #f8bbd9',
                }}
              >
                <div
                  style={{
                    fontSize: '14px',
                    color: '#c62828',
                    marginBottom: '4px',
                  }}
                >
                  Total Expenses
                </div>
                <div
                  style={{
                    fontSize: '28px',
                    fontWeight: 700,
                    color: '#d32f2f',
                    marginBottom: '4px',
                  }}
                >
                  Rs. {formatAmount(stats.totalExpenses)}
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: '#546e7a',
                  }}
                >
                  {stats.totalExpenseCategories} categories
                </div>
              </div>

              {/* Net Profit */}
              <div
                className="responsive-card"
                style={{
                  background:
                    netProfit >= 0
                      ? 'linear-gradient(135deg, #e3f2fd, #bbdefb)'
                      : 'linear-gradient(135deg, #ffebee, #ffcdd2)',
                  borderRadius: '12px',
                  textAlign: 'center',
                  border:
                    netProfit >= 0
                      ? '1px solid #90caf9'
                      : '1px solid #f8bbd9',
                }}
              >
                <div
                  style={{
                    fontSize: '14px',
                    color: netProfit >= 0 ? '#1e88e5' : '#c2185b',
                    marginBottom: '4px',
                  }}
                >
                  Net Profit
                </div>
                <div
                  style={{
                    fontSize: '28px',
                    fontWeight: 700,
                    color: netProfit >= 0 ? '#1565c0' : '#ad1457',
                    marginBottom: '4px',
                  }}
                >
                  Rs. {formatAmount(netProfit)}
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: '#546e7a',
                  }}
                >
                  Receivables - Payables - Expenses
                </div>
              </div>
            </div>

            {/* Refresh */}
            <div
              className="responsive-card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                background: '#f5f5f5',
                borderRadius: '12px',
                textAlign: 'center',
                border: '1px solid #e0e0e0',
                cursor: 'pointer',
                marginTop: '16px',
              }}
              onClick={fetchStats}
            >
              <div style={{ fontSize: '24px' }}>↻</div>
              <div
                style={{
                  fontSize: '14px',
                  color: '#607d8b',
                  marginTop: '4px',
                }}
              >
                Refresh Stats
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Dashboard;

