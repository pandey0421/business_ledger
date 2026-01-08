import { useRef, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";
import { Toaster, toast } from 'react-hot-toast';
import { App as CapacitorApp } from '@capacitor/app';

import Login from "./screens/Login";
import Dashboard from "./screens/Dashboard";
import Customers from "./screens/Customers";
import Suppliers from "./screens/Suppliers";
import Expenses from "./screens/Expenses";
import Privacy from "./screens/Privacy";
import Terms from "./screens/Terms";
import Subscription from "./screens/Subscription";
import Landing from "./screens/Landing";
import Analytics from "./screens/Analytics";

import Footer from "./components/Footer";
import Spinner from "./components/Spinner";
import BrandingHeader from "./components/BrandingHeader";

import { signOut } from "firebase/auth";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize screen strictly from hash
  const getScreenFromHash = () => {
    const hash = window.location.hash.slice(1); // Remove #
    const [route] = hash.split('/');
    const VALID_SCREENS = ["dashboard", "customers", "suppliers", "expenses", "analytics", "privacy", "terms"];
    return VALID_SCREENS.includes(route) ? route : "dashboard";
  };

  const [screen, setScreen] = useState(getScreenFromHash());

  const [showLogin, setShowLogin] = useState(() => {
    // Skip landing if user has visited before
    return localStorage.getItem('intro_seen') === 'true';
  });
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Subscription State
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [checkingSub, setCheckingSub] = useState(false);

  // Sync State <-> Hash
  useEffect(() => {
    // 1. Listen for External Hash Changes (Browser Back/Forward)
    const handleHashChange = () => {
      const newScreen = getScreenFromHash();
      if (newScreen !== screen) {
        setScreen(newScreen);
      }
    };
    window.addEventListener('hashchange', handleHashChange);

    // 2. Sync URL when Internal State Changes
    // Only update hash if it's different to prevent loops/overwrite on load
    const currentHashRoute = window.location.hash.slice(1).split('/')[0];
    if (screen !== 'dashboard' && screen !== currentHashRoute) {
      window.location.hash = screen;
    } else if (screen === 'dashboard' && currentHashRoute !== '' && currentHashRoute !== 'dashboard') {
      // If we moved to dashboard, clear hash or set #dashboard
      window.location.hash = 'dashboard';
    }

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [screen]);

  // Handle Capacitor Hardware Back Button
  useEffect(() => {
    let backListener;
    const setupBackListener = async () => {
      backListener = await CapacitorApp.addListener('backButton', ({ canGoBack }) => {
        const currentScreen = getScreenFromHash();

        if (currentScreen === 'dashboard') {
          // At root/dashboard -> Exit App
          CapacitorApp.exitApp();
        } else {
          // At any other screen -> Go Dashboard
          setScreen('dashboard');
          window.location.hash = 'dashboard';
        }
      });
    };

    setupBackListener();

    return () => {
      if (backListener) backListener.remove();
    };
  }, []);

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

  // Auth & Subscription Check
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        setCheckingSub(true);
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            const data = userSnap.data();
            const expiry = data.subscriptionExpiry?.toDate();

            if (expiry && expiry > new Date()) {
              setIsSubscribed(true);
            } else {
              setIsSubscribed(false);
              // For now: Hard block if no active subscription
            }
          } else {
            // New user or no record -> Not subscribed
            setIsSubscribed(false);
          }
        } catch (e) {
          console.error("Sub check failed", e);
        } finally {
          setCheckingSub(false);
        }
      } else {
        setCheckingSub(false);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading || checkingSub) return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      flexDirection: 'column',
      gap: '20px'
    }}>
      <Spinner size={50} />
      <p style={{ color: '#607d8b', fontFamily: 'sans-serif' }}>
        {checkingSub ? "Verifying Subscription..." : "Loading Karobar Khata..."}
      </p>
    </div>
  );

  const renderScreen = () => {
    if (!user) {
      if (showLogin) {
        return <Login onSuccess={() => {
          const hash = window.location.hash.slice(1);
          const [route] = hash.split('/');
          setScreen(route || "dashboard");
        }} />;
      } else {
        return <Landing onGetStarted={() => {
          localStorage.setItem('intro_seen', 'true');
          setShowLogin(true);
        }} />;
      }
    }

    switch (screen) {
      case "dashboard":
        return <Dashboard user={user} onSelect={(s) => setScreen(s)} />;
      case "customers":
        return <Customers goBack={() => setScreen("dashboard")} />;
      case "suppliers":
        return <Suppliers goBack={() => setScreen("dashboard")} />;
      case "expenses":
        return <Expenses goBack={() => setScreen("dashboard")} />;
      case "analytics":
        return <Analytics goBack={() => setScreen("dashboard")} />;
      case "privacy":
        return <Privacy goBack={() => setScreen("dashboard")} />;
      case "terms":
        return <Terms goBack={() => setScreen("dashboard")} />;
      default:
        return <Dashboard user={user} onSelect={(s) => setScreen(s)} />;
    }
  };

  return (
    <>
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
        {user && <BrandingHeader />}
        <main id="main-content" style={{ flex: 1 }}>
          {renderScreen()}
        </main>

        {(user || screen === 'privacy' || screen === 'terms') && (
          <Footer onNavigate={(page) => setScreen(page)} />
        )}
      </div>
    </>
  );
}

export default App;
