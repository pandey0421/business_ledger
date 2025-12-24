import { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

const SupplierLedger = ({ supplier, onBack }) => {
  const [entries, setEntries] = useState([]);
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("purchase");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [totalPurchase, setTotalPurchase] = useState(0);
  const [totalPayment, setTotalPayment] = useState(0);

  // Date shortcut functions
  const setToday = () => {
    const today = new Date().toISOString().split('T')[0];
    setDate(today);
  };

  const setYesterday = () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    setDate(yesterday);
  };

  const setLastWeek = () => {
    const lastWeek = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    setDate(lastWeek);
  };

  useEffect(() => {
    if (!supplier?.id) return;

    const q = query(
      collection(db, "suppliers", supplier.id, "ledger"),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let runningBalance = 0;
      let purchaseSum = 0;
      let paymentSum = 0;

      const data = snapshot.docs.map((doc) => {
        const raw = doc.data();
        const amt = Number(raw.amount) || 0;

        if (raw.type === "purchase") {
          runningBalance += amt;
          purchaseSum += amt;
        } else if (raw.type === "payment") {
          runningBalance -= amt;
          paymentSum += amt;
        }

        return {
          id: doc.id,
          ...raw,
          amount: amt,
          runningBalance,
        };
      });

      setEntries(data);
      setTotalPurchase(purchaseSum);
      setTotalPayment(paymentSum);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [supplier]);

  const addEntry = async () => {
    if (!amount || !date) {
      alert("Amount and date are required");
      return;
    }

    try {
      await addDoc(
        collection(db, "suppliers", supplier.id, "ledger"),
        {
          amount: Number(amount),
          type,
          date,
          note,
          createdAt: serverTimestamp(),
        }
      );

      setAmount("");
      setNote("");
      setDate("");
      setType("purchase");
    } catch (err) {
      console.error(err);
      alert("Failed to add entry");
    }
  };

  const formatAmount = (num) => new Intl.NumberFormat("en-IN").format(num);
  const balance = totalPurchase - totalPayment;

  if (!supplier) return null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #fffde7, #e3f2fd)",
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 900,
          margin: "0 auto",
          backgroundColor: "#ffffff",
          borderRadius: 12,
          padding: 24,
          boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
          border: "1px solid #e0e0e0",
        }}
      >
        <button
          onClick={onBack}
          style={{
            marginBottom: 12,
            padding: "6px 12px",
            borderRadius: 999,
            border: "1px solid #cfd8dc",
            backgroundColor: "#fafafa",
            cursor: "pointer",
          }}
        >
          ← Back to Suppliers
        </button>

        <h2 style={{ marginTop: 0, color: "#ef6c00" }}>
          Ledger for {supplier.name}
        </h2>
        <p style={{ color: "#546e7a", marginBottom: 16 }}>
          Purchases increase what you owe (green), payments reduce it (red).
        </p>

        {/* Date Shortcuts */}
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 16,
            backgroundColor: "#f0f4f8",
            padding: 12,
            borderRadius: 10,
          }}
        >
          <button
            onClick={setToday}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid #42a5f5",
              backgroundColor: "#e3f2fd",
              color: "#1976d2",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Today
          </button>
          <button
            onClick={setYesterday}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid #ff9800",
              backgroundColor: "#fff3e0",
              color: "#f57c00",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Yesterday
          </button>
          <button
            onClick={setLastWeek}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid #9c27b0",
              backgroundColor: "#f3e5f5",
              color: "#7b1fa2",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Last Week
          </button>
        </div>

        {/* Entry Form */}
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 16,
            backgroundColor: "#f5f5f5",
            padding: 12,
            borderRadius: 10,
          }}
        >
          <input
            type="number"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #cfd8dc",
              minWidth: 100,
            }}
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #cfd8dc",
            }}
          >
            <option value="purchase">Purchase</option>
            <option value="payment">Payment</option>
          </select>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #cfd8dc",
              minWidth: 140,
            }}
          />
          <input
            type="text"
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{
              flex: "1 1 120px",
              minWidth: 120,
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #cfd8dc",
            }}
          />
          <button
            onClick={addEntry}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "none",
              backgroundColor: "#1e88e5",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            Add Entry
          </button>
        </div>

        <div
          style={{
            marginBottom: 12,
            padding: 10,
            borderRadius: 10,
            backgroundColor: "#fff3e0",
            color: "#ef6c00",
            fontSize: 14,
          }}
        >
          <strong>Total Purchase:</strong> Rs. {formatAmount(totalPurchase)} |{" "}
          <strong>Total Payment:</strong> Rs. {formatAmount(totalPayment)} |{" "}
          <strong>Balance (you owe):</strong> Rs. {formatAmount(balance)}
        </div>

        {loading ? (
          <p>Loading ledger...</p>
        ) : entries.length === 0 ? (
          <p style={{ color: "#78909c" }}>No ledger entries</p>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginTop: 8,
            }}
          >
            <thead>
              <tr style={{ backgroundColor: "#eeeeee" }}>
                <th style={{ border: "1px solid #e0e0e0", padding: 8 }}>Date</th>
                <th style={{ border: "1px solid #e0e0e0", padding: 8 }}>Purchase</th>
                <th style={{ border: "1px solid #e0e0e0", padding: 8 }}>Payment</th>
                <th style={{ border: "1px solid #e0e0e0", padding: 8 }}>Balance</th>
                <th style={{ border: "1px solid #e0e0e0", padding: 8 }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td style={{ border: "1px solid #e0e0e0", padding: 8, fontSize: 14 }}>
                    {entry.date}
                  </td>
                  <td
                    style={{
                      border: "1px solid #e0e0e0",
                      padding: 8,
                      color: entry.type === "purchase" ? "#2e7d32" : "#9e9e9e",
                      fontWeight: entry.type === "purchase" ? 600 : 400,
                    }}
                  >
                    {entry.type === "purchase" ? `+ ${formatAmount(entry.amount)}` : ""}
                  </td>
                  <td
                    style={{
                      border: "1px solid #e0e0e0",
                      padding: 8,
                      color: entry.type === "payment" ? "#c62828" : "#9e9e9e",
                      fontWeight: entry.type === "payment" ? 600 : 400,
                    }}
                  >
                    {entry.type === "payment" ? `- ${formatAmount(entry.amount)}` : ""}
                  </td>
                  <td style={{ border: "1px solid #e0e0e0", padding: 8, fontSize: 14 }}>
                    Rs. {formatAmount(entry.runningBalance)}
                  </td>
                  <td style={{ border: "1px solid #e0e0e0", padding: 8, fontSize: 14, color: "#455a64" }}>
                    {entry.note || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default SupplierLedger;
