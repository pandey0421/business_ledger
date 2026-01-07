import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import { Toaster, toast } from 'react-hot-toast';
import { Analytics } from "@vercel/analytics/react";

import Login from "./screens/Login";
import Dashboard from "./screens/Dashboard";
import Customers from "./screens/Customers";
import Suppliers from "./screens/Suppliers";
import Expenses from "./screens/Expenses";
import Privacy from "./screens/Privacy";
import Terms from "./screens/Terms";

import Footer from "./components/Footer";
import Spinner from "./components/Spinner";

import { signOut } from "firebase/auth";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState("dashboard");
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Offline detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      toast.success("App is back online");
    };
    const handleOffline = () => {
      setIsOffline(true);
      toast.error("App works offline");
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Inactivity Auto-logout
  useEffect(() => {
    if (!user) return;

    const INACTIVITY_LIMIT = 15 * 60 * 1000; // 15 minutes
    let inactivityTimer;

    const logoutUser = () => {
      console.log("Auto-logging out due to inactivity");
      signOut(auth).catch(err => console.error("Sign out error", err));
      toast('Logged out due to inactivity', { icon: '👋' });
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

  if (loading) return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      flexDirection: 'column',
      gap: '20px'
    }}>
      <Spinner size={50} />
      <p style={{ color: '#607d8b', fontFamily: 'sans-serif' }}>Loading Karobar Khata...</p>
    </div>
  );

  const renderScreen = () => {
    if (!user) return <Login onSuccess={() => setScreen("dashboard")} />;

    switch (screen) {
      case "dashboard":
        return <Dashboard onSelect={(s) => setScreen(s)} />;
      case "customers":
        return <Customers goBack={() => setScreen("dashboard")} />;
      case "suppliers":
        return <Suppliers goBack={() => setScreen("dashboard")} />;
      case "expenses":
        return <Expenses goBack={() => setScreen("dashboard")} />;
      case "privacy":
        return <Privacy goBack={() => setScreen("dashboard")} />;
      case "terms":
        return <Terms goBack={() => setScreen("dashboard")} />;
      default:
        return <Dashboard onSelect={(s) => setScreen(s)} />;
    }
  };

  return (
    <>
      <Analytics />
      
      <a
        href="#main-content"
        style={{
          position: 'absolute',
          top: '-40px',
          left: '0',
          background: '#1a237e',
          color: 'white',
          padding: '8px',
          zIndex: 9999,
          transition: 'top 0.3s'
        }}
        className="skip-link"
        onFocus={(e) => e.target.style.top = '0'}
        onBlur={(e) => e.target.style.top = '-40px'}
      >
        Skip to content
      </a>

      {isOffline && (
        <div style={{
          backgroundColor: '#ff9800',
          color: 'white',
          textAlign: 'center',
          padding: '8px',
          position: 'sticky',
          top: 0,
          zIndex: 2000,
          fontFamily: 'sans-serif',
          fontSize: '14px'
        }}>
          You are currently offline. Some features may be limited.
        </div>
      )}

      <Toaster position="top-right" />

      <div
        style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}
      >
        <main id="main-content" style={{ flex: 1 }}>
          {renderScreen()}
        </main>

        {/* Only show footer if user is logged in or looking at legal pages, 
            but usually good to show everywhere except maybe specialized screens.
            For now, showing everywhere as requested "Global Footer". 
            Adjusting Login to handle its own layout or being wrapped. 
            Modifying Login.jsx showed it has full height layout. 
            So we might need to conditionally render text-only footer on Login 
            or let Login be full screen and this footer sits below? 
            Actually Login.jsx has its own mini footer. 
            Let's hide global footer on Login if user is not authenticated.
         */}
        {(user || screen === 'privacy' || screen === 'terms') && (
          <Footer onNavigate={(page) => setScreen(page)} />
        )}
      </div>
    </>
  );
}

export default App;
