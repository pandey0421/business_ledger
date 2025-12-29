import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
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

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error(err);
      setError('Login failed. Check email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      setShowSignup(false);
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error(err);
      setError(err.message.includes('email-already') 
        ? 'Email already in use.' 
        : 'Signup failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setError('');
      alert('Password reset email sent! Check your inbox. Check the spam folder if mail not received.');
      setShowReset(false);
      setResetEmail('');
    } catch (err) {
      console.error(err);
      setError('Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #e0f7fa 0%, #e8eaf6 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      <div style={{
        maxWidth: '420px',
        width: '100%',
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
        border: '1px solid #e3f2fd'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h2 style={{ marginBottom: '8px', color: '#1a237e', fontSize: '28px', fontWeight: 'bold' }}>
            {showSignup ? 'Create Account' : 'Karobar Khata'}
          </h2>
          <p style={{ margin: 0, color: '#607d8b', fontSize: '16px' }}>
            {showSignup 
              ? 'Create your account to manage customers and ledgers.' 
              : 'Sign in to you Karobar Khata account.'
            }
          </p>
        </div>

        {/* Forgot Password Modal */}
        {showReset && (
          <div style={{
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
          }}>
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '400px',
              width: '90%'
            }}>
              <h3 style={{ color: '#1a237e', marginBottom: '16px' }}>Reset Password</h3>
              <form onSubmit={handlePasswordReset} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '14px', color: '#455a64', display: 'block', marginBottom: '4px' }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    disabled={loading}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cfd8dc',
                      outline: 'none',
                      fontSize: '14px',
                      transition: 'all 0.2s',
                      backgroundColor: loading ? '#fafafa' : '#ffffff'
                    }}
                    placeholder="Enter your email"
                  />
                </div>
                {error && (
                  <div style={{
                    padding: '8px 10px',
                    backgroundColor: '#ffebee',
                    borderRadius: '6px',
                    border: '1px solid #ffcdd2',
                    color: '#d32f2f',
                    fontSize: '14px'
                  }}>
                    {error}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => { setShowReset(false); setResetEmail(''); setError(''); }}
                    disabled={loading}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid #cfd8dc',
                      background: '#fafafa',
                      color: '#455a64',
                      fontWeight: '500',
                      cursor: loading ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'linear-gradient(135deg, #42a5f5 0%, #5c6bc0 100%)',
                      color: '#ffffff',
                      fontWeight: '600',
                      cursor: loading ? 'not-allowed' : 'pointer'
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
        <form onSubmit={showSignup ? handleSignup : handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Email Field */}
          <div>
            <label style={{ fontSize: '14px', color: '#455a64', display: 'block', marginBottom: '4px' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              style={{
                marginTop: '4px',
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #cfd8dc',
                outline: 'none',
                fontSize: '14px',
                transition: 'all 0.2s',
                backgroundColor: loading ? '#fafafa' : '#ffffff'
              }}
              placeholder="Enter your email"
            />
          </div>

          {/* Password Field */}
          <div>
            <label style={{ fontSize: '14px', color: '#455a64', display: 'block', marginBottom: '4px' }}>
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
                  padding: '10px 12px',
                  paddingRight: '40px',
                  borderRadius: '8px',
                  border: '1px solid #cfd8dc',
                  outline: 'none',
                  fontSize: '14px',
                  transition: 'all 0.2s',
                  backgroundColor: loading ? '#fafafa' : '#ffffff'
                }}
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.5 : 1
                }}
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
            {!showSignup && (
              <button
                type="button"
                onClick={() => setShowReset(true)}
                disabled={loading}
                style={{
                  marginTop: '8px',
                  padding: 0,
                  background: 'none',
                  border: 'none',
                  color: '#42a5f5',
                  fontSize: '14px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  textAlign: 'left'
                }}
              >
                Forgot Password?
              </button>
            )}
          </div>

          {/* Confirm Password Field (Signup only) */}
          {showSignup && (
            <div>
              <label style={{ fontSize: '14px', color: '#455a64', display: 'block', marginBottom: '4px' }}>
                Confirm Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
                style={{
                  marginTop: '4px',
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cfd8dc',
                  outline: 'none',
                  fontSize: '14px',
                  transition: 'all 0.2s',
                  backgroundColor: loading ? '#fafafa' : '#ffffff'
                }}
                placeholder="Confirm your password"
              />
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div style={{
              padding: '8px 10px',
              backgroundColor: '#ffebee',
              borderRadius: '6px',
              border: '1px solid #ffcdd2',
              color: '#d32f2f',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '8px',
              border: 'none',
              background: loading 
                ? 'linear-gradient(135deg, #bdbdbd 0%, #e0e0e0 100%)' 
                : 'linear-gradient(135deg, #42a5f5 0%, #5c6bc0 100%)',
              color: '#ffffff',
              fontWeight: '600',
              fontSize: '16px',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{
                  width: '18px',
                  height: '18px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTop: '2px solid #ffffff',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  marginRight: '8px'
                }} />
                {showSignup ? 'Creating...' : 'Signing in...'}
              </span>
            ) : (
              showSignup ? 'Create Account' : 'Login'
            )}
          </button>
        </form>

        {/* Toggle between Login/Signup */}
        <div style={{
          textAlign: 'center',
          marginTop: '24px',
          paddingTop: '20px',
          borderTop: '1px solid #e0e0e0'
        }}>
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
              color: '#42a5f5',
              fontSize: '14px',
              fontWeight: '500',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {showSignup 
              ? "Already have an account? Login" 
              : "Don't have an account? Create Account"
            }
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Login;
