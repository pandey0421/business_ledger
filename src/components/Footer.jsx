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
                                support.karobarkhata@gmail.com
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
                    </address>

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
