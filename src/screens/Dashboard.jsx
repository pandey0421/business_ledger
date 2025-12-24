import { useState, useEffect } from "react";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import {
  collection,
  getDocs,
} from "firebase/firestore";

function Dashboard({ onSelect }) {
  const [stats, setStats] = useState({
    totalReceivables: 0,
    totalPayables: 0,
    totalCustomers: 0,
    totalSuppliers: 0,
  });
  const [loading, setLoading] = useState(true);

  const userId = auth.currentUser?.uid;

  const fetchStats = async () => {
    if (!userId) return;
    setLoading(true);

    try {
      // Fetch customer stats
      const customersRef = collection(db, "users", userId, "customers");
      const customersSnapshot = await getDocs(customersRef);
      const customers = customersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      let totalReceivables = 0;
      for (const customer of customers) {
        const ledgerRef = collection(db, "customers", customer.id, "ledger");
        const ledgerSnapshot = await getDocs(ledgerRef);
        let customerSales = 0;
        let customerPayments = 0;
        ledgerSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.type === "sale") customerSales += Number(data.amount) || 0;
          if (data.type === "payment") customerPayments += Number(data.amount) || 0;
        });
        totalReceivables += (customerSales - customerPayments);
      }

      // Fetch supplier stats
      const suppliersRef = collection(db, "users", userId, "suppliers");
      const suppliersSnapshot = await getDocs(suppliersRef);
      const suppliers = suppliersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      let totalPayables = 0;
      for (const supplier of suppliers) {
        const ledgerRef = collection(db, "suppliers", supplier.id, "ledger");
        const ledgerSnapshot = await getDocs(ledgerRef);
        let supplierPurchases = 0;
        let supplierPayments = 0;
        ledgerSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.type === "purchase") supplierPurchases += Number(data.amount) || 0;
          if (data.type === "payment") supplierPayments += Number(data.amount) || 0;
        });
        totalPayables += (supplierPurchases - supplierPayments);
      }

      setStats({
        totalReceivables: Math.max(0, totalReceivables),
        totalPayables: Math.max(0, totalPayables),
        totalCustomers: customers.length,
        totalSuppliers: suppliers.length,
      });
    } catch (err) {
      console.error("Failed to fetch stats:", err);
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
      console.error("Logout failed", err);
    }
  };

  const formatAmount = (num) => {
    return new Intl.NumberFormat("en-IN").format(Math.round(num));
  };

  const netBalance = stats.totalReceivables - stats.totalPayables;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #f1f8e9, #e3f2fd)",
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          backgroundColor: "#ffffff",
          borderRadius: 12,
          padding: 24,
          boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
          border: "1px solid #e0e0e0",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <div>
            <h2 style={{ margin: 0, color: "#1b5e20", fontSize: 28 }}>
              Business Dashboard
            </h2>
            <p style={{ marginTop: 4, color: "#607d8b", fontSize: 16 }}>
              Real-time overview of your accounts
            </p>
          </div>
          <button
            onClick={handleLogout}
            style={{
              padding: "10px 16px",
              borderRadius: 999,
              border: "1px solid #ef9a9a",
              backgroundColor: "#ffebee",
              color: "#c62828",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Logout
          </button>
        </div>

        {/* Action Cards - Customers & Suppliers FIRST */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 20,
            marginBottom: 32,
          }}
        >
          {/* Customers card */}
          <div
            style={{
              background: "linear-gradient(135deg, #e3f2fd, #e8eaf6)",
              borderRadius: 12,
              padding: 20,
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              border: "1px solid #bbdefb",
              cursor: "pointer",
              transition: "transform 0.2s, box-shadow 0.2s",
            }}
            onClick={() => onSelect("customers")}
            onMouseEnter={(e) => {
              e.target.style.transform = "translateY(-2px)";
              e.target.style.boxShadow = "0 8px 24px rgba(0,0,0,0.12)";
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = "none";
              e.target.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
            }}
          >
            <h3
              style={{
                marginTop: 0,
                marginBottom: 12,
                color: "#1e88e5",
                fontSize: 20,
              }}
            >
              👥 Customers
            </h3>
            <p style={{ fontSize: 14, color: "#546e7a", marginBottom: 16 }}>
              Record sales, track receivables, view customer ledgers
            </p>
            <button
              style={{
                width: "100%",
                padding: "10px 16px",
                borderRadius: 8,
                border: "none",
                backgroundColor: "#42a5f5",
                color: "#fff",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Open Customers →
            </button>
          </div>

          {/* Suppliers card */}
          <div
            style={{
              background: "linear-gradient(135deg, #fff3e0, #fff8e1)",
              borderRadius: 12,
              padding: 20,
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              border: "1px solid #ffe0b2",
              cursor: "pointer",
              transition: "transform 0.2s, box-shadow 0.2s",
            }}
            onClick={() => onSelect("suppliers")}
            onMouseEnter={(e) => {
              e.target.style.transform = "translateY(-2px)";
              e.target.style.boxShadow = "0 8px 24px rgba(0,0,0,0.12)";
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = "none";
              e.target.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
            }}
          >
            <h3
              style={{
                marginTop: 0,
                marginBottom: 12,
                color: "#ef6c00",
                fontSize: 20,
              }}
            >
              🏪 Suppliers
            </h3>
            <p style={{ fontSize: 14, color: "#546e7a", marginBottom: 16 }}>
              Track purchases, payments made, and supplier balances
            </p>
            <button
              style={{
                width: "100%",
                padding: "10px 16px",
                borderRadius: 8,
                border: "none",
                backgroundColor: "#fb8c00",
                color: "#fff",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Open Suppliers →
            </button>
          </div>
        </div>

        {/* Quick Balance Overview - BELOW action cards */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#78909c' }}>
            Loading business stats...
          </div>
        ) : (
          <>
            <h3 style={{ marginTop: 0, marginBottom: 16, color: "#37474f", fontSize: 20 }}>
              Business Summary
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 16,
              }}
            >
              {/* Total Receivables */}
              <div
                style={{
                  background: "linear-gradient(135deg, #e8f5e9, #c8e6c9)",
                  borderRadius: 12,
                  padding: 20,
                  textAlign: "center",
                  border: "1px solid #a5d6a7",
                }}
              >
                <div style={{ fontSize: 14, color: "#2e7d32", marginBottom: 4 }}>
                  Total Receivables
                </div>
                <div
                  style={{
                    fontSize: 32,
                    fontWeight: 700,
                    color: "#1b5e20",
                    marginBottom: 4,
                  }}
                >
                  Rs. {formatAmount(stats.totalReceivables)}
                </div>
                <div style={{ fontSize: 12, color: "#546e7a" }}>
                  {stats.totalCustomers} customers
                </div>
              </div>

              {/* Total Payables */}
              <div
                style={{
                  background: "linear-gradient(135deg, #fff3e0, #ffe0b2)",
                  borderRadius: 12,
                  padding: 20,
                  textAlign: "center",
                  border: "1px solid #ffcc80",
                }}
              >
                <div style={{ fontSize: 14, color: "#ef6c00", marginBottom: 4 }}>
                  Total Payables
                </div>
                <div
                  style={{
                    fontSize: 32,
                    fontWeight: 700,
                    color: "#e65100",
                    marginBottom: 4,
                  }}
                >
                  Rs. {formatAmount(stats.totalPayables)}
                </div>
                <div style={{ fontSize: 12, color: "#546e7a" }}>
                  {stats.totalSuppliers} suppliers
                </div>
              </div>

              {/* Net Balance */}
              <div
                style={{
                  background: netBalance >= 0
                    ? "linear-gradient(135deg, #e3f2fd, #bbdefb)"
                    : "linear-gradient(135deg, #ffebee, #ffcdd2)",
                  borderRadius: 12,
                  padding: 20,
                  textAlign: "center",
                  border: netBalance >= 0 ? "1px solid #90caf9" : "1px solid #f8bbd9",
                }}
              >
                <div style={{ fontSize: 14, color: netBalance >= 0 ? "#1e88e5" : "#c2185b", marginBottom: 4 }}>
                  Net Balance
                </div>
                <div
                  style={{
                    fontSize: 32,
                    fontWeight: 700,
                    color: netBalance >= 0 ? "#1565c0" : "#ad1457",
                    marginBottom: 4,
                  }}
                >
                  Rs. {formatAmount(netBalance)}
                </div>
                <div style={{ fontSize: 12, color: "#546e7a" }}>
                  Receivables - Payables
                </div>
              </div>

              {/* Refresh Button */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                  background: "#f5f5f5",
                  borderRadius: 12,
                  padding: 20,
                  textAlign: "center",
                  border: "1px solid #e0e0e0",
                  cursor: "pointer",
                }}
                onClick={fetchStats}
              >
                <div style={{ fontSize: 24 }}>↻</div>
                <div style={{ fontSize: 14, color: "#607d8b", marginTop: 4 }}>
                  Refresh Stats
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Dashboard;


