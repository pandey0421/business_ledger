import React, { useState, useEffect } from 'react';

const BrandingHeader = () => {
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div style={{
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            padding: isMobile ? '12px 16px' : '12px 32px',
            borderBottom: '1px solid rgba(224, 224, 224, 0.8)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
            zIndex: 1000,
            position: 'sticky',
            top: 0
        }}>
            <img
                src="/favicon.ico"
                alt="Karobar Khata Logo"
                style={{ width: isMobile ? '28px' : '32px', height: isMobile ? '28px' : '32px', borderRadius: '6px' }}
            />
            <div>
                <h1 style={{
                    margin: 0,
                    fontSize: isMobile ? '16px' : '18px',
                    color: '#1a237e',
                    fontWeight: '800',
                    letterSpacing: '-0.3px',
                    lineHeight: '1.2'
                }}>
                    Karobar Khata
                </h1>
                <p style={{
                    margin: 0,
                    fontSize: isMobile ? '10px' : '11px',
                    color: '#546e7a',
                    fontWeight: '500'
                }}>
                    Your Digital Ledger
                </p>
            </div>
        </div>
    );
};

export default BrandingHeader;
