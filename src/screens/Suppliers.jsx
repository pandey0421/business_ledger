import { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
} from "firebase/firestore";
import SupplierLedger from "./SupplierLedger";

function Suppliers({ goBack }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  const userId = auth.currentUser?.uid;
  const supplierRef = userId
    ? collection(db, "users", userId, "suppliers")
    : null;

  const fetchSuppliers = async () => {
    if (!supplierRef) return;
    try {
      const snapshot = await getDocs(supplierRef);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setSuppliers(data);
    } catch (err) {
      console.error(err);
      setMessage("Failed to load suppliers");
    }
  };

  useEffect(() => {
    fetchSuppliers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleAddSupplier = async () => {
    if (!name.trim()) {
      setMessage("Name is required");
      return;
    }
    if (!supplierRef) {
      setMessage("No user logged in");
      return;
    }

    try {
      await addDoc(supplierRef, {
        name: name.trim(),
        phone: phone.trim(),
        createdAt: serverTimestamp(),
      });
      setMessage("Supplier added successfully");
      setName("");
      setPhone("");
      fetchSuppliers();
    } catch (err) {
      console.error(err);
      setMessage("Error adding supplier");
    }
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
        background: "linear-gradient(135deg, #fff8e1, #e3f2fd)",
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 800,
          margin: "0 auto",
          backgroundColor: "#ffffff",
          borderRadius: 12,
          padding: 24,
          boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
          border: "1px solid #e0e0e0",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <div>
            <h2 style={{ margin: 0, color: "#ef6c00" }}>
              Suppliers
            </h2>
            <p style={{ marginTop: 4, color: "#607d8b" }}>
              Add suppliers and tap a card to view their ledger.
            </p>
          </div>
          <button
            onClick={goBack}
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              border: "1px solid #cfd8dc",
              backgroundColor: "#fafafa",
              cursor: "pointer",
            }}
          >
            Back
          </button>
        </div>

        <div
          style={{
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          <div style={{ flex: "1 1 220px", minWidth: 220 }}>
            <label style={{ fontSize: 14, color: "#455a64" }}>
              Name
              <br />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{
                  marginTop: 4,
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid #cfd8dc",
                }}
              />
            </label>
          </div>

          <div style={{ flex: "1 1 220px", minWidth: 220 }}>
            <label style={{ fontSize: 14, color: "#455a64" }}>
              Phone
              <br />
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{
                  marginTop: 4,
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid #cfd8dc",
                }}
              />
            </label>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
            }}
          >
            <button
              onClick={handleAddSupplier}
              style={{
                padding: "9px 14px",
                borderRadius: 8,
                border: "none",
                backgroundColor: "#fb8c00",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Add Supplier
            </button>
          </div>
        </div>

        {message && (
          <p
            style={{
              marginBottom: 16,
              color: message.toLowerCase().includes("error")
                ? "#d32f2f"
                : "#ef6c00",
              backgroundColor: message.toLowerCase().includes("error")
                ? "#ffebee"
                : "#fff3e0",
              padding: "8px 10px",
              borderRadius: 8,
              fontSize: 14,
            }}
          >
            {message}
          </p>
        )}

        <h3 style={{ marginTop: 12, color: "#37474f" }}>
          Supplier List
        </h3>
        {suppliers.length === 0 ? (
          <p style={{ color: "#78909c" }}>No suppliers yet.</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 12,
              marginTop: 8,
            }}
          >
            {suppliers.map((s) => (
              <div
                key={s.id}
                onClick={() => setSelectedSupplier(s)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #ffe0b2",
                  background:
                    "linear-gradient(135deg, #fff3e0, #fff8e1)",
                  cursor: "pointer",
                  transition: "transform 0.1s, box-shadow 0.1s",
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    color: "#ef6c00",
                    marginBottom: 4,
                  }}
                >
                  {s.name}
                </div>
                {s.phone && (
                  <div style={{ fontSize: 13, color: "#607d8b" }}>
                    {s.phone}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Suppliers;

