import React, { useState, useEffect } from 'react';
import { Menu, X, Users, ShoppingBag, CreditCard, LogOut, Grid, BarChart2, Trash2 } from 'lucide-react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

const Dashboard = ({ user, onSelect }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // window.location.reload(); // Handled by auth listener in App.jsx usually
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const safeUserName = user && user.email ? user.email.split('@')[0] : 'User';

  // Navigation Helper
  const updateScreenAndHash = (screenName, hashName) => {
    // 1. Update React State
    onSelect(screenName);
    // 2. Update URL Hash for history/back-button support
    // We use a small timeout or direct set, but App.jsx listening to hash change is robust
    window.location.hash = hashName;
  };

  const handleAnalyticsClick = () => {
    updateScreenAndHash('analytics', 'Analytics');
  };

  // --- STYLES ---

  const dashboardStyle = {
    padding: isMobile ? '16px' : '32px',
    fontFamily: "'Inter', sans-serif",
    maxWidth: '1200px',
    margin: '0 auto',
    width: '100%',
    boxSizing: 'border-box'
  };

  const headerStyle = {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: '32px',
    position: 'relative' // For mobile menu positioning
  };

  const sectionTitleStyle = {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#1a237e',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  };

  const actionCardsStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '24px',
    marginBottom: '40px'
  };

  const cardStyle = {
    background: 'white',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
    border: '1px solid #f0f0f0',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    position: 'relative',
    overflow: 'hidden'
  };

  // user prop is required, but if missing, we can just show a placeholder or nothing
  if (!user) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading user data...</div>;

  return (
    <div style={{
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      minHeight: '100vh',
      width: '100%',
      maxWidth: '100%',
      overflowX: 'hidden',
      boxSizing: 'border-box',
      paddingBottom: '40px'
    }}>
      <div style={dashboardStyle}>
        {/* Top Header Bar */}
        <div style={headerStyle}>

          {/* Desktop User Profile & Actions */}
          {!isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>

              {/* User Info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '12px', color: '#546e7a' }}>Signed in as</div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1a237e' }}>{safeUserName}</div>
                </div>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '10px',
                  background: '#1a237e', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontWeight: 'bold', fontSize: '18px', border: '1px solid #1a237e'
                }}>
                  {safeUserName.charAt(0).toUpperCase()}
                </div>
              </div>

              {/* Divider */}
              <div style={{ width: '1px', height: '32px', background: '#e0e0e0' }} />

              {/* Actions */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={handleAnalyticsClick}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 16px', borderRadius: '8px',
                    border: '1px solid #c5cae9', background: 'white',
                    color: '#1a237e', fontWeight: '600',
                    cursor: 'pointer', fontSize: '14px', transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.target.style.background = '#e8eaf6'}
                  onMouseLeave={e => e.target.style.background = 'white'}
                >
                  <BarChart2 size={16} />
                  Analytics
                </button>
                <button
                  onClick={handleLogout}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 16px', borderRadius: '8px',
                    border: '1px solid #ef5350', background: '#ffebee',
                    color: '#c62828', fontWeight: '600',
                    cursor: 'pointer', fontSize: '14px', transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.target.style.background = '#ffcdd2'}
                  onMouseLeave={e => e.target.style.background = '#ffebee'}
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            </div>
          )}

          {/* Mobile Hamburger Menu */}
          {isMobile && (
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              style={{
                background: 'white', border: 'none', padding: '10px',
                borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                cursor: 'pointer', color: '#1a237e', zIndex: 1001 // Ensure above overlay
              }}
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          )}

          {/* Mobile Menu Overlay */}
          {isMobile && isMenuOpen && (
            <div style={{
              position: 'absolute', top: '70px', right: '0',
              background: 'white', padding: '16px', borderRadius: '16px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
              display: 'flex', flexDirection: 'column', gap: '12px',
              zIndex: 1000, width: '200px', border: '1px solid #eee'
            }}>
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  handleAnalyticsClick();
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px', width: '100%', border: 'none', background: '#e8eaf6',
                  color: '#1a237e', borderRadius: '8px', fontWeight: '600', cursor: 'pointer'
                }}
              >
                <BarChart2 size={18} /> Analytics
              </button>
              <button
                onClick={handleLogout}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px', width: '100%', border: 'none', background: '#ffcdd2',
                  color: '#c62828', borderRadius: '8px', fontWeight: '600', cursor: 'pointer'
                }}
              >
                <LogOut size={18} /> Logout
              </button>
            </div>
          )}
        </div>

        {/* Main Action Cards */}
        <div style={sectionTitleStyle}>
          <Grid size={20} />
          Quick Actions
        </div>

        <div style={actionCardsStyle}>
          {/* Customers Card */}
          <div
            style={cardStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.05)';
            }}
            onClick={() => updateScreenAndHash('customers', 'Customers')}
          >
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: '#e8f5e9', display: 'flex', alignItems: 'center',
              justifyContent: 'center', marginBottom: '16px'
            }}>
              <Users size={32} color="#2e7d32" />
            </div>
            <h3 style={{ margin: '0 0 8px 0', color: '#1a237e', fontSize: '18px' }}>Customers</h3>
            <p style={{ margin: 0, color: '#546e7a', fontSize: '14px' }}>Manage sales & receivables</p>
            <button style={{
              marginTop: '16px', padding: '8px 24px', borderRadius: '20px',
              background: '#2e7d32', color: 'white', border: 'none',
              fontWeight: '600', cursor: 'pointer'
            }}>
              View Ledger
            </button>
          </div>

          {/* Suppliers Card */}
          <div
            style={cardStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.05)';
            }}
            onClick={() => updateScreenAndHash('suppliers', 'Suppliers')}
          >
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: '#ffebee', display: 'flex', alignItems: 'center',
              justifyContent: 'center', marginBottom: '16px'
            }}>
              <ShoppingBag size={32} color="#c62828" />
            </div>
            <h3 style={{ margin: '0 0 8px 0', color: '#1a237e', fontSize: '18px' }}>Suppliers</h3>
            <p style={{ margin: 0, color: '#546e7a', fontSize: '14px' }}>Manage purchases & payables</p>
            <button style={{
              marginTop: '16px', padding: '8px 24px', borderRadius: '20px',
              background: '#c62828', color: 'white', border: 'none',
              fontWeight: '600', cursor: 'pointer'
            }}>
              View Ledger
            </button>
          </div>

          {/* Expenses Card */}
          <div
            style={cardStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.05)';
            }}
            onClick={() => updateScreenAndHash('expenses', 'Expenses')}
          >
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: '#e3f2fd', display: 'flex', alignItems: 'center',
              justifyContent: 'center', marginBottom: '16px'
            }}>
              <CreditCard size={32} color="#1565c0" />
            </div>
            <h3 style={{ margin: '0 0 8px 0', color: '#1a237e', fontSize: '18px' }}>Expenses</h3>
            <p style={{ margin: 0, color: '#546e7a', fontSize: '14px' }}>Track daily business costs</p>
            <button style={{
              marginTop: '16px', padding: '8px 24px', borderRadius: '20px',
              background: '#1565c0', color: 'white', border: 'none',
              fontWeight: '600', cursor: 'pointer'
            }}>
              Track Expenses
            </button>
          </div>

          {/* Recycle Bin Card */}
          <div
            style={cardStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.05)';
            }}
            onClick={() => updateScreenAndHash('recyclebin', 'RecycleBin')}
          >
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: '#f3e5f5', display: 'flex', alignItems: 'center',
              justifyContent: 'center', marginBottom: '16px'
            }}>
              <Trash2 size={32} color="#7b1fa2" />
            </div>
            <h3 style={{ margin: '0 0 8px 0', color: '#1a237e', fontSize: '18px' }}>Recycle Bin</h3>
            <p style={{ margin: 0, color: '#546e7a', fontSize: '14px' }}>Restore deleted items</p>
            <button style={{
              marginTop: '16px', padding: '8px 24px', borderRadius: '20px',
              background: '#7b1fa2', color: 'white', border: 'none',
              fontWeight: '600', cursor: 'pointer'
            }}>
              View Bin
            </button>
          </div>
        </div>

        {/* Promo / Info Section */}
        <div style={{
          background: 'white', borderRadius: '16px', padding: '24px',
          border: '1px solid #e0e0e0', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px'
        }}>
          <div>
            <h3 style={{ margin: '0 0 8px 0', color: '#1a237e' }}>New: Business Analytics! 🔥</h3>
            <p style={{ margin: 0, color: '#546e7a', fontSize: '14px' }}>
              Check your profit trends and sales reports in the new Analytics tab.
            </p>
          </div>
          <button
            onClick={handleAnalyticsClick}
            style={{
              padding: '12px 24px', borderRadius: '8px', background: '#1a237e',
              color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer'
            }}
          >
            Try It Now
          </button>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;