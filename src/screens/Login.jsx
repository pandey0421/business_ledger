import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      console.error(err);
      setError("Login failed. Check email or password.");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #e0f7fa, #e8eaf6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          maxWidth: 420,
          width: "100%",
          backgroundColor: "#ffffff",
          borderRadius: 12,
          padding: 24,
          boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
          border: "1px solid #e3f2fd",
        }}
      >
        <h2
          style={{
            marginBottom: 8,
            color: "#1a237e",
          }}
        >
          Account Login
        </h2>
        <p style={{ marginTop: 0, marginBottom: 20, color: "#607d8b" }}>
          Sign in to manage your customers and ledgers.
        </p>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 14, color: "#455a64" }}>
              Email
              <br />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  marginTop: 4,
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #cfd8dc",
                  outline: "none",
                }}
              />
            </label>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 14, color: "#455a64" }}>
              Password
              <br />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  marginTop: 4,
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #cfd8dc",
                  outline: "none",
                }}
              />
            </label>
          </div>

          {error && (
            <p
              style={{
                color: "#d32f2f",
                backgroundColor: "#ffebee",
                borderRadius: 6,
                padding: "8px 10px",
                fontSize: 14,
                marginBottom: 16,
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 8,
              border: "none",
              background:
                "linear-gradient(135deg, #42a5f5, #5c6bc0)",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;


