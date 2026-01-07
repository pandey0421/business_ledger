import React from 'react';

const Privacy = ({ goBack }) => {
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

            <h1 style={{ color: '#1a237e', marginBottom: '10px' }}>Privacy Policy</h1>
            <p style={{ color: '#6c757d', fontSize: '14px' }}>Last updated: {new Date().toLocaleDateString()}</p>

            <div style={{ marginTop: '30px', lineHeight: '1.6', color: '#333' }}>
                <p>Welcome to Karobar Khata. We respect your privacy and are committed to protecting your personal data.</p>

                <h2 style={{ color: '#2c3e50', marginTop: '25px' }}>1. Information We Collect</h2>
                <p>We only collect information necessary to provide our services, including:</p>
                <ul>
                    <li>Account information (email, business name).</li>
                    <li>Transaction data you input (sales, expenses, customers, suppliers).</li>
                </ul>

                <h2 style={{ color: '#2c3e50', marginTop: '25px' }}>2. How We Use Your Data</h2>
                <p>Your data is used solely for functionality:</p>
                <ul>
                    <li>To maintain your digital ledger.</li>
                    <li>To generate reports (PDFs) as requested by you.</li>
                    <li>To improve app performance.</li>
                </ul>

                <h2 style={{ color: '#2c3e50', marginTop: '25px' }}>3. Data Protection</h2>
                <p>We implement security measures including Firebase Authentication and encrypted connections to protect your data. We do not sell your data to third parties.</p>

                <h2 style={{ color: '#2c3e50', marginTop: '25px' }}>4. Contact Us</h2>
                <p>If you have any questions about this Privacy Policy, please contact us at support@karobarkhata.com.</p>
            </div>
        </div>
    );
};

export default Privacy;
