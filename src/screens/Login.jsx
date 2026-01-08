import React, { useState, useEffect, useCallback } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  onAuthStateChanged
} from 'firebase/auth';
import { auth } from '../firebase';

const Login = ({ onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lastAttemptTime, setLastAttemptTime] = useState(0);
  const MAX_ATTEMPTS = 5;
  const ATTEMPT_WINDOW = 300000; // 5 minutes

  // Sanitize input function - XSS prevention
  const sanitizeInput = useCallback((input) => {
    return input.replace(/[<>"'&]/g, '').trim();
  }, []);

  // Password strength validation
  const isStrongPassword = (pwd) => {
    const minLength = pwd.length >= 8;
    const hasUpper = /[A-Z]/.test(pwd);
    const hasLower = /[a-z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pwd);
    return minLength && hasUpper && hasLower && hasNumber && hasSpecial;
  };

  // Rate limiting check
  const canAttemptLogin = useCallback(() => {
    const now = Date.now();
    const storedAttempts = Number(localStorage.getItem('loginAttempts') || 0);
    const storedLastAttempt = Number(localStorage.getItem('lastAttemptTime') || 0);

    if (now - storedLastAttempt > ATTEMPT_WINDOW) {
      localStorage.setItem('loginAttempts', '0');
      localStorage.setItem('lastAttemptTime', now.toString());
      return true;
    }
    return storedAttempts < MAX_ATTEMPTS;
  }, []);

  const recordFailedAttempt = () => {
    const storedAttempts = Number(localStorage.getItem('loginAttempts') || 0);
    const newAttempts = storedAttempts + 1;
    localStorage.setItem('loginAttempts', newAttempts.toString());
    localStorage.setItem('lastAttemptTime', Date.now().toString());
    setLoginAttempts(newAttempts);
  };

  // Mobile responsive detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setEmailVerified(user.emailVerified);
        if (user.emailVerified && onSuccess) {
          // Clear attempts on success
          localStorage.removeItem('loginAttempts');
          localStorage.removeItem('lastAttemptTime');
          onSuccess();
        }
      }
    });
    return unsubscribe;
  }, [onSuccess]);

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!canAttemptLogin()) {
      const storedLastAttempt = Number(localStorage.getItem('lastAttemptTime') || 0);
      const waitMinutes = Math.round((ATTEMPT_WINDOW - (Date.now() - storedLastAttempt)) / 60000);
      setError(`Too many failed attempts. Try again in ${Math.max(1, waitMinutes)} minutes.`);
      return;
    }

    const cleanEmail = sanitizeInput(email);
    if (!cleanEmail) {
      setError('Please enter a valid email address.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, cleanEmail, password);
      // onSuccess will be called by auth listener
    } catch (err) {
      recordFailedAttempt();

      // Security: Use generic messages to prevent enumeration
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Invalid email or password.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Access temporarily disabled due to many failed attempts. Reset your password or try again later.');
      } else if (err.code === 'auth/user-disabled') {
        setError('This account has been disabled.');
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();

    const cleanEmail = sanitizeInput(email);
    if (!cleanEmail) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!isStrongPassword(password)) {
      setError('Password must be 8+ characters with uppercase, lowercase, number, and special character.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      await sendEmailVerification(userCredential.user);
      setError('Verification email sent! Please check your inbox (and spam folder) before logging in.');
      setShowSignup(false);
      setEmail('');
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      switch (err.code) {
        case 'auth/email-already-in-use':
          setError('Email already in use. Try logging in or use password reset.');
          break;
        case 'auth/weak-password':
          setError('Password not strong enough.');
          break;
        case 'auth/invalid-email':
          setError('Please enter a valid email address.');
          break;
        default:
          setError('Signup failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    const cleanEmail = sanitizeInput(resetEmail);
    if (!cleanEmail) {
      setError('Please enter your email address.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      setError('Password reset email sent! Check your inbox (and spam folder).');
      setShowReset(false);
      setResetEmail('');
    } catch (err) {
      setError('Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => setError('');

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMobile ? '16px' : '32px',
        margin: 0,
        width: '100vw',
        overflowX: 'hidden',
        boxSizing: 'border-box',
        fontFamily: "'Inter', sans-serif"
      }}
    >
      <div
        style={{
          maxWidth: isMobile ? '100%' : '420px',
          width: '100%',
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          padding: isMobile ? '24px' : '40px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          border: '1px solid #f0f0f0',
          boxSizing: 'border-box'
        }}
        role="main"
        aria-label="Login form"
      >
        <div style={{ textAlign: 'center', marginBottom: isMobile ? '24px' : '32px' }}>
          <h2 style={{
            marginBottom: '8px',
            color: '#1a237e',
            fontSize: isMobile ? '28px' : '32px',
            fontWeight: 'bold'
          }}>
            {showSignup ? 'Create Account' : 'Karobar Khata'}
          </h2>
          <p style={{
            margin: 0,
            color: '#546e7a',
            fontSize: isMobile ? '14px' : '16px'
          }}>
            {showSignup
              ? 'Create your account to manage customers and ledgers.'
              : 'Sign in to your Karobar Khata account.'
            }
          </p>
          {!emailVerified && (
            <p style={{
              color: '#ef6c00',
              fontSize: '12px',
              marginTop: '8px',
              fontWeight: '600'
            }}>
              Please verify your email to continue
            </p>
          )}
        </div>

        {/* Forgot Password Modal */}
        {showReset && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-title"
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                padding: isMobile ? '20px 24px' : '32px',
                maxWidth: isMobile ? '90vw' : '400px',
                width: '90%',
                boxSizing: 'border-box'
              }}
            >
              <h3
                id="reset-title"
                style={{
                  color: '#1a237e',
                  marginBottom: '16px',
                  fontSize: isMobile ? '20px' : '22px',
                  fontWeight: 'bold'
                }}
              >
                Reset Password
              </h3>
              <form onSubmit={handlePasswordReset} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#455a64', display: 'block', marginBottom: '8px' }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(sanitizeInput(e.target.value))}
                    required
                    disabled={loading}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: '1px solid #cfd8dc',
                      outline: 'none',
                      fontSize: '14px',
                      transition: 'all 0.2s',
                      backgroundColor: loading ? '#fafafa' : '#ffffff',
                      boxSizing: 'border-box'
                    }}
                    placeholder="Enter your email"
                    aria-describedby={error ? "reset-error" : undefined}
                  />
                </div>

                {error && (
                  <div
                    id="reset-error"
                    style={{
                      padding: '12px',
                      backgroundColor: '#ffebee',
                      borderRadius: '8px',
                      border: '1px solid #ffccdd',
                      color: '#d32f2f',
                      fontSize: '14px'
                    }}
                  >
                    {error}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowReset(false);
                      setResetEmail('');
                      setError('');
                    }}
                    disabled={loading}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '12px',
                      border: '1px solid #cfd8dc',
                      background: '#fafafa',
                      color: '#455a64',
                      fontWeight: 600,
                      cursor: loading ? 'not-allowed' : 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '12px',
                      border: 'none',
                      background: loading
                        ? 'linear-gradient(135deg, #bdbdbd 0%, #e0e0e0 100%)'
                        : 'linear-gradient(135deg, #42a5f5 0%, #304ffe 100%)',
                      color: '#ffffff',
                      fontWeight: 600,
                      cursor: loading ? 'not-allowed' : 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    {loading ? 'Sending...' : 'Send Reset Email'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Main Form */}
        <form
          onSubmit={showSignup ? handleSignup : handleLogin}
          style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '20px' }}
          noValidate
        >
          {/* Email Field */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#455a64', display: 'block', marginBottom: '8px' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(sanitizeInput(e.target.value))}
              required
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '12px',
                border: '1px solid #e0e0e0',
                outline: 'none',
                fontSize: '14px',
                transition: 'all 0.2s',
                backgroundColor: loading ? '#fafafa' : '#ffffff',
                boxSizing: 'border-box'
              }}
              placeholder="Enter your email"
              aria-describedby={error ? "login-error" : undefined}
            />
          </div>

          {/* Password Field */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#455a64', display: 'block', marginBottom: '8px' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px 14px 12px 14px',
                  paddingRight: '40px',
                  borderRadius: '12px',
                  border: '1px solid #e0e0e0',
                  outline: 'none',
                  fontSize: '14px',
                  transition: 'all 0.2s',
                  backgroundColor: loading ? '#fafafa' : '#ffffff',
                  boxSizing: 'border-box'
                }}
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.5 : 1
                }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={loading ? -1 : 0}
              >
                {showPassword ? (
                  <svg width="20" height="20" fill="none" stroke="#607d8b" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                ) : (
                  <svg width="20" height="20" fill="none" stroke="#607d8b" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Confirm Password Field - Signup only */}
          {showSignup && (
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#455a64', display: 'block', marginBottom: '8px' }}>
                Confirm Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 14px',
                    paddingRight: '40px',
                    borderRadius: '12px',
                    border: '1px solid #e0e0e0',
                    outline: 'none',
                    fontSize: '14px',
                    transition: 'all 0.2s',
                    backgroundColor: loading ? '#fafafa' : '#ffffff',
                    boxSizing: 'border-box'
                  }}
                  placeholder="Confirm your password"
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div
              id="login-error"
              style={{
                padding: '12px',
                backgroundColor: '#ffebee',
                borderRadius: '8px',
                border: '1px solid #ffccdd',
                color: '#d32f2f',
                fontSize: '14px',
                animation: 'fadeIn 0.3s ease-in'
              }}
              role="alert"
            >
              {error}
              <button
                onClick={clearError}
                style={{
                  marginLeft: '8px',
                  background: 'none',
                  border: 'none',
                  color: '#d32f2f',
                  cursor: 'pointer',
                  fontSize: '16px',
                  float: 'right'
                }}
                aria-label="Dismiss error"
              >
                ×
              </button>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !canAttemptLogin()}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: '12px',
              border: 'none',
              background: loading || !canAttemptLogin()
                ? 'linear-gradient(135deg, #bdbdbd 0%, #e0e0e0 100%)'
                : 'linear-gradient(135deg, #42a5f5 0%, #304ffe 100%)',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '16px',
              cursor: loading || !canAttemptLogin() ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              opacity: loading || !canAttemptLogin() ? 0.7 : 1,
              minHeight: '48px',
              boxShadow: loading ? 'none' : '0 4px 12px rgba(66, 165, 245, 0.3)'
            }}
            aria-label={showSignup ? 'Create account' : 'Sign in'}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div
                  style={{
                    width: '18px',
                    height: '18px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTop: '2px solid #ffffff',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    marginRight: '8px'
                  }}
                />
                {showSignup ? 'Creating...' : 'Signing in...'}
              </span>
            ) : showSignup ? 'Create Account' : 'Login'}
          </button>
        </form>

        {/* Toggle between Login/Signup */}
        <div style={{ textAlign: 'center', marginTop: isMobile ? '20px' : '24px', paddingTop: '20px', borderTop: '1px solid #f0f0f0' }}>
          <button
            type="button"
            onClick={() => {
              setShowSignup(!showSignup);
              setError('');
              setEmail('');
              setPassword('');
              setConfirmPassword('');
            }}
            disabled={loading}
            style={{
              padding: 0,
              background: 'none',
              border: 'none',
              color: '#1565c0',
              fontSize: '14px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              marginBottom: '12px'
            }}
          >
            {showSignup ? 'Already have an account? Login' : "Don't have an account? Create Account"}
          </button>

          {!showSignup && (
            <button
              type="button"
              onClick={() => setShowReset(true)}
              disabled={loading}
              style={{
                padding: 0,
                background: 'none',
                border: 'none',
                color: '#607d8b',
                fontSize: '14px',
                cursor: loading ? 'not-allowed' : 'pointer',
                textAlign: 'center',
                width: '100%',
                marginTop: '8px'
              }}
            >
              Forgot Password?
            </button>
          )}
        </div>

        <footer
          style={{
            marginTop: 32,
            fontSize: 12,
            color: "#90a4ae",
            textAlign: "center",
          }}
        >
          © {new Date().getFullYear()} Karobaar Khata. All rights reserved.
        </footer>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default Login;
