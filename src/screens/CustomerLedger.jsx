import React, { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../firebase";

const CustomerLedger = ({ customer, onBack }) => {
  const [entries, setEntries] = useState([]);
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("sale");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [totalSale, setTotalSale] = useState(0);
  const [totalPayment, setTotalPayment] = useState(0);
  const [editingEntry, setEditingEntry] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!customer?.id) return;

    // Still order by createdAt from Firestore to get stable ordering
    const q = query(
      collection(db, "customers", customer.id, "ledger"),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Step 1: Calculate balances CHRONOLOGICALLY (oldest first)
      let chronoData = snapshot.docs.map((d) => {
        const raw = d.data();
        const amt = Number(raw.amount) || 0;
        return {
          id: d.id,
          ...raw,
          amount: amt,
        };
      });

      // Sort chronologically for CORRECT balance calculation (oldest first)
      chronoData.sort((a, b) => {
        const da = a.date || "";
        const dbDate = b.date || "";
        if (da !== dbDate) return da.localeCompare(dbDate);
        const ca = a.createdAt?.seconds || 0;
        const cb = b.createdAt?.seconds || 0;
        return ca - cb;
      });

      // Calculate running balances in chronological order
      let runningBalance = 0;
      let saleSum = 0;
      let paymentSum = 0;
      chronoData = chronoData.map((entry) => {
        const amt = entry.amount;
        if (entry.type === "sale") {
          runningBalance += amt;
          saleSum += amt;
        } else if (entry.type === "payment") {
          runningBalance -= amt;
          paymentSum += amt;
        }
        return {
          ...entry,
          runningBalance,
        };
      });

      // Step 2: Reverse for display (newest first) - balances stay correct
      const displayData = [...chronoData].reverse();
      
      setEntries(displayData);
      setTotalSale(saleSum);
      setTotalPayment(paymentSum);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [customer]);

  const resetForm = () => {
    setAmount("");
    setType("sale");
    setDate("");
    setNote("");
    setEditingEntry(null);
  };

  const addOrUpdateEntry = async () => {
    if (!amount || !date) {
      setMessage("Amount and date are required");
      return;
    }

    // simple yyyy-mm-dd check (optional but helpful)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      setMessage("Please enter date in yyyy-mm-dd format");
      return;
    }

    try {
      if (editingEntry) {
        // Update existing entry
        await updateDoc(
          doc(db, "customers", customer.id, "ledger", editingEntry.id),
          {
            amount: Number(amount),
            type,
            date,
            note,
          }
        );
        setMessage("Entry updated successfully");
      } else {
        // Add new entry
        await addDoc(collection(db, "customers", customer.id, "ledger"), {
          amount: Number(amount),
          type,
          date,
          note,
          createdAt: serverTimestamp(),
        });
        setMessage("Entry added successfully");
      }

      resetForm();
    } catch (err) {
      console.error(err);
      setMessage("Failed to add/update entry");
    }
  };

  const startEditEntry = (entry) => {
    setEditingEntry(entry);
    setAmount(entry.amount.toString());
    setType(entry.type);
    setDate(entry.date || "");
    setNote(entry.note || "");
  };

  const handleDeleteEntry = async (entryId) => {
    if (!window.confirm("Are you sure you want to delete this entry?")) return;
    try {
      await deleteDoc(doc(db, "customers", customer.id, "ledger", entryId));
      setMessage("Entry deleted successfully");
    } catch (err) {
      console.error(err);
      setMessage("Failed to delete entry");
    }
  };

  const formatAmount = (num) => new Intl.NumberFormat("en-IN").format(num);
  const balance = totalSale - totalPayment;

  if (!customer) return null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #fffde7, #e3f2fd)",
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
          onClick={onBack}
          style={{
            marginBottom: "12px",
            padding: "6px 12px",
            borderRadius: "999px",
            border: "1px solid #cfd8dc",
            backgroundColor: "#fafafa",
            cursor: "pointer",
          }}
        >
          ← Back to Customers
        </button>

        <h2 style={{ marginTop: "0", color: "#1a237e" }}>
          Ledger for {customer.name}
        </h2>
        <p style={{ color: "#546e7a", marginBottom: "16px" }}>
  
        </p>

        {/* Form */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
            marginBottom: "16px",
            backgroundColor: "#f5f5f5",
            padding: "12px",
            borderRadius: "10px",
          }}
        >
          <input
            type="number"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{
              padding: "8px 10px",
              borderRadius: "8px",
              border: "1px solid #cfd8dc",
              minWidth: "100px",
            }}
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            style={{
              padding: "8px 10px",
              borderRadius: "8px",
              border: "1px solid #cfd8dc",
            }}
          >
            <option value="sale">Sale</option>
            <option value="payment">Payment</option>
          </select>
          {/* Manual date input, no calendar shortcuts */}
          <input
            type="text"
            placeholder="Date (yyyy-mm-dd)"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{
              padding: "8px 10px",
              borderRadius: "8px",
              border: "1px solid #cfd8dc",
              minWidth: "140px",
            }}
          />
          <input
            type="text"
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{
              flex: "1 1 120px",
              minWidth: "120px",
              padding: "8px 10px",
              borderRadius: "8px",
              border: "1px solid #cfd8dc",
            }}
          />
          <button
            onClick={addOrUpdateEntry}
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: "#1e88e5",
              color: "#fff",
              cursor: "pointer",
              fontWeight: "500",
              minWidth: "120px",
            }}
          >
            {editingEntry ? "Update Entry" : "Add Entry"}
          </button>
          {editingEntry && (
            <button
              onClick={resetForm}
              style={{
                padding: "8px 14px",
                borderRadius: "8px",
                border: "1px solid #cfd8dc",
                backgroundColor: "#fafafa",
                color: "#607d8b",
                cursor: "pointer",
                fontWeight: "500",
                minWidth: "80px",
              }}
            >
              Cancel
            </button>
          )}
        </div>

        {message && (
          <p
            style={{
              marginBottom: "12px",
              padding: "10px",
              borderRadius: "10px",
              backgroundColor: "#e3f2fd",
              color: "#1a237e",
              fontSize: "14px",
            }}
          >
            {message}
          </p>
        )}

        <div
          style={{
            marginBottom: "12px",
            padding: "10px",
            borderRadius: "10px",
            backgroundColor: "#e3f2fd",
            color: "#1a237e",
            fontSize: "14px",
          }}
        >
          <strong>Total Sale:</strong> Rs. {formatAmount(totalSale)}{" "}
          <strong> | Total Payment:</strong> Rs. {formatAmount(totalPayment)}{" "}
          <strong> | Balance:</strong> Rs. {formatAmount(balance)}
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
              marginTop: "8px",
            }}
          >
            <thead>
              <tr style={{ backgroundColor: "#eeeeee" }}>
                <th
                  style={{ border: "1px solid #e0e0e0", padding: "8px" }}
                >
                  Date
                </th>
                <th
                  style={{ border: "1px solid #e0e0e0", padding: "8px" }}
                >
                  Sale
                </th>
                <th
                  style={{ border: "1px solid #e0e0e0", padding: "8px" }}
                >
                  Payment
                </th>
                <th
                  style={{ border: "1px solid #e0e0e0", padding: "8px" }}
                >
                  Balance
                </th>
                <th
                  style={{ border: "1px solid #e0e0e0", padding: "8px" }}
                >
                  Details
                </th>
                <th
                  style={{ border: "1px solid #e0e0e0", padding: "8px" }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td
                    style={{
                      border: "1px solid #e0e0e0",
                      padding: "8px",
                      fontSize: "14px",
                    }}
                  >
                    {entry.date}
                  </td>
                  <td
                    style={{
                      border: "1px solid #e0e0e0",
                      padding: "8px",
                      color:
                        entry.type === "sale" ? "#2e7d32" : "#9e9e9e",
                      fontWeight:
                        entry.type === "sale" ? "600" : "400",
                    }}
                  >
                    {entry.type === "sale"
                      ? formatAmount(entry.amount)
                      : "-"}
                  </td>
                  <td
                    style={{
                      border: "1px solid #e0e0e0",
                      padding: "8px",
                      color:
                        entry.type === "payment" ? "#c62828" : "#9e9e9e",
                      fontWeight:
                        entry.type === "payment" ? "600" : "400",
                    }}
                  >
                    {entry.type === "payment"
                      ? `- ${formatAmount(entry.amount)}`
                      : "-"}
                  </td>
                  <td
                    style={{
                      border: "1px solid #e0e0e0",
                      padding: "8px",
                      fontSize: "14px",
                    }}
                  >
                    Rs. {formatAmount(entry.runningBalance)}
                  </td>
                  <td
                    style={{
                      border: "1px solid #e0e0e0",
                      padding: "8px",
                      fontSize: "14px",
                      color: "#455a64",
                    }}
                  >
                    {entry.note || "-"}
                  </td>
                  <td
                    style={{
                      border: "1px solid #e0e0e0",
                      padding: "8px",
                    }}
                  >
                    <button
                      onClick={() => startEditEntry(entry)}
                      style={{
                        marginRight: "4px",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        border: "1px solid #42a5f5",
                        backgroundColor: "#e3f2fd",
                        color: "#1976d2",
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteEntry(entry.id)}
                      style={{
                        padding: "4px 8px",
                        borderRadius: "4px",
                        border: "1px solid #ef5350",
                        backgroundColor: "#ffebee",
                        color: "#d32f2f",
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      Delete
                    </button>
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

export default CustomerLedger;
