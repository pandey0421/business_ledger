import React from 'react';

const Footer = ({ onNavigate }) => {
    const currentYear = new Date().getFullYear();

    return (
        <footer style={{
            backgroundColor: '#f8f9fa',
            borderTop: '1px solid #e9ecef',
            padding: '40px 20px',
            marginTop: 'auto',
            fontFamily: "'Inter', sans-serif"
        }}>
            <div style={{
                maxWidth: '1200px',
                margin: '0 auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '30px'
            }}>
                {/* Brand Section */}
                <div>
                    <h3 style={{
                        color: '#1a237e',
                        margin: '0 0 15px 0',
                        fontSize: '18px',
                        fontWeight: 'bold'
                    }}>
                        Karobar Khata
                    </h3>
                    <p style={{
                        color: '#6c757d',
                        fontSize: '14px',
                        lineHeight: '1.6',
                        margin: 0
                    }}>
                        Nepal's simple business accounting app. Track customers, suppliers, and expenses with ease.
                    </p>
                </div>

                {/* Quick Links */}
                <div>
                    <h4 style={{
                        color: '#343a40',
                        margin: '0 0 15px 0',
                        fontSize: '16px',
                        fontWeight: '600'
                    }}>
                        Legal & Support
                    </h4>
                    <ul style={{
                        listStyle: 'none',
                        padding: 0,
                        margin: 0,
                        fontSize: '14px'
                    }}>
                        <li style={{ marginBottom: '8px' }}>
                            <button
                                onClick={() => onNavigate('privacy')}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#495057',
                                    cursor: 'pointer',
                                    padding: 0,
                                    textDecoration: 'underline'
                                }}
                            >
                                Privacy Policy
                            </button>
                        </li>
                        <li style={{ marginBottom: '8px' }}>
                            <button
                                onClick={() => onNavigate('terms')}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#495057',
                                    cursor: 'pointer',
                                    padding: 0,
                                    textDecoration: 'underline'
                                }}
                            >
                                Terms of Service
                            </button>
                        </li>
                        <li>
                            <a href="mailto:support@karobarkhata.com" style={{ color: '#495057', textDecoration: 'none' }}>
                                support@karobarkhata.com
                            </a>
                        </li>
                    </ul>
                </div>

                {/* Contact Info */}
                <div>
                    <h4 style={{
                        color: '#343a40',
                        margin: '0 0 15px 0',
                        fontSize: '16px',
                        fontWeight: '600'
                    }}>
                        Contact Us
                    </h4>
                    <address style={{
                        fontStyle: 'normal',
                        color: '#6c757d',
                        fontSize: '14px',
                        lineHeight: '1.6'
                    }}>
                        Kathmandu, Nepal<br />
                        Phone: <a href="tel:+9779800000000" style={{ color: '#6610f2', textDecoration: 'none' }}>+977-9800000000</a><br />
                        VAT: 123456789
                    </address>

                    <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
                        {/* Facebook Icon */}
                        <a href="#" aria-label="Facebook" style={{ color: '#6c757d' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M18.77 7.46H14.5v-1.9c0-.9.6-1.1 1-1.1h3V.5h-4.33C10.24.5 9.5 3.44 9.5 5.32v2.15h-3v4h3v12h5v-12h3.85l.42-4z" />
                            </svg>
                        </a>
                        {/* Twitter/X Icon */}
                        <a href="#" aria-label="Twitter" style={{ color: '#6c757d' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M23.44 4.83c-.8.37-1.5.38-2.22.02.94-.56.98-.96 1.32-2.02-.88.52-1.86.9-2.9 1.1-.82-.88-2-1.43-3.3-1.43-2.5 0-4.55 2.04-4.55 4.54 0 .36.03.7.1 1.04-3.77-.2-7.12-2-9.36-4.75-.4.67-.6 1.45-.6 2.3 0 1.56.8 2.95 2 3.77-.74-.03-1.44-.23-2.05-.57v.06c0 2.2 1.56 4.03 3.64 4.44-.67.2-1.37.2-2.06.08.58 1.8 2.26 3.12 4.25 3.16-1.57 1.2-3.5 1.9-5.6 1.9-.36 0-.73-.02-1.1-.05 2.08 1.32 4.5 2.1 7.18 2.1 8.6 0 13.3-7.13 13.3-13.3 0-.2-.05-.42-.05-.63 1.05-.76 1.95-2 2.65-2.01z" />
                            </svg>
                        </a>
                    </div>
                </div>
            </div>

            <div style={{
                textAlign: 'center',
                paddingTop: '20px',
                marginTop: '20px',
                borderTop: '1px solid #e9ecef',
                color: '#adb5bd',
                fontSize: '12px'
            }}>
                © {currentYear} Karobar Khata. All rights reserved. Built for Nepal 🇳🇵
            </div>
        </footer>
    );
};

export default Footer;
