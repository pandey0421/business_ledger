import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";

import Login from "./screens/Login";
import Dashboard from "./screens/Dashboard";
import Customers from "./screens/Customers";
import Suppliers from "./screens/Suppliers";
import Expenses from "./screens/Expenses"; // ADD THIS LINE

import { signOut } from "firebase/auth"; // Add signOut import

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState("dashboard");

  // Inactivity Auto-logout
  useEffect(() => {
    if (!user) return;

    const INACTIVITY_LIMIT = 15 * 60 * 1000; // 15 minutes
    let inactivityTimer;

    const logoutUser = () => {
      console.log("Auto-logging out due to inactivity");
      signOut(auth).catch(err => console.error("Sign out error", err));
    };

    const resetTimer = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(logoutUser, INACTIVITY_LIMIT);
    };

    // Events to monitor
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, resetTimer));

    // Start timer on mount
    resetTimer();

    return () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [user]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) return <p>Loading...</p>;

  if (!user) return <Login onSuccess={() => setScreen("dashboard")} />;

  // Protected screens
  if (screen === "dashboard")
    return <Dashboard onSelect={(s) => setScreen(s)} />;

  if (screen === "customers")
    return <Customers goBack={() => setScreen("dashboard")} />;

  if (screen === "suppliers")
    return <Suppliers goBack={() => setScreen("dashboard")} />;

  if (screen === "expenses")
    return <Expenses goBack={() => setScreen("dashboard")} />;

  return <p>Unknown screen</p>;
}

export default App;
