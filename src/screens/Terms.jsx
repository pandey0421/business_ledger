import React from 'react';

const Terms = ({ goBack }) => {
    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px', fontFamily: "'Inter', sans-serif" }}>
            <button
                onClick={goBack}
                style={{
                    marginBottom: '20px',
                    background: 'none',
                    border: 'none',
                    color: '#42a5f5',
                    cursor: 'pointer',
                    fontSize: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                }}
            >
                ← Back
            </button>

            <h1 style={{ color: '#1a237e', marginBottom: '10px' }}>Terms of Service</h1>
            <p style={{ color: '#6c757d', fontSize: '14px' }}>Last updated: {new Date().toLocaleDateString()}</p>

            <div style={{ marginTop: '30px', lineHeight: '1.6', color: '#333' }}>
                <h2 style={{ color: '#2c3e50', marginTop: '25px' }}>1. Acceptance of Terms</h2>
                <p>By accessing and using Karobar Khata, you agree to these Terms of Service.</p>

                <h2 style={{ color: '#2c3e50', marginTop: '25px' }}>2. Use of Service</h2>
                <p>You agree to use the app only for lawful business accounting purposes. You are responsible for maintaining the confidentiality of your account credentials.</p>

                <h2 style={{ color: '#2c3e50', marginTop: '25px' }}>3. Limitation of Liability</h2>
                <p>Karobar Khata provides this digital ledger "as is". We are not liable for any data loss or business interruptions. Please maintain your own backups.</p>

                <h2 style={{ color: '#2c3e50', marginTop: '25px' }}>4. Termination</h2>
                <p>We reserve the right to terminate or suspend access to our service immediately, without prior notice, for any breach of these Terms.</p>

                <h2 style={{ color: '#2c3e50', marginTop: '25px' }}>5. Changes to Terms</h2>
                <p>We reserve the right to modify these terms at any time. Continued use of the service constitutes acceptance of the new terms.</p>
            </div>
        </div>
    );
};

export default Terms;
