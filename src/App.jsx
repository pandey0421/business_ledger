import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";

import Login from "./screens/Login";
import Dashboard from "./screens/Dashboard";
import Customers from "./screens/Customers"; // we will create this next
import Suppliers from "./screens/Suppliers"; // we will create this next

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState("dashboard");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) return <p>Loading...</p>;

  if (!user) return <Login />;

  if (screen === "dashboard")
    return <Dashboard onSelect={(s) => setScreen(s)} />;

  if (screen === "customers")
    return <Customers goBack={() => setScreen("dashboard")} />;

  if (screen === "suppliers")
    return <Suppliers goBack={() => setScreen("dashboard")} />;

  return <p>Unknown screen</p>;
}

export default App;

