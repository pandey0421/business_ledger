import React, { useState, useEffect } from 'react';
import Footer from '../components/Footer';

const Landing = ({ onGetStarted }) => {
    const [isMobile, setIsMobile] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const [currentSlide, setCurrentSlide] = useState(0);

    // Initial load animation & mobile check
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);

        // Trigger entrance animation
        setTimeout(() => setIsVisible(true), 100);

        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Feature Data (now with screenshots paths)
    const features = [
        {
            title: "Manage Customers",
            description: "Track money people owe you (Receivables). Send reminders and get paid faster.",
            image: "/screenshots/customers.png",
            color: "#e3f2fd",
            textColor: "#1565c0"
        },
        {
            title: "Manage Suppliers",
            description: "Keep track of money you owe (Payables). Never miss a payment deadline.",
            image: "/screenshots/suppliers.png",
            color: "#fff3e0",
            textColor: "#e65100"
        },
        {
            title: "Track Expenses",
            description: "Monitor daily business expenses and categorize them for better insights.",
            image: "/screenshots/expenses.png",
            color: "#ffebee",
            textColor: "#c62828"
        }
    ];

    // Mobile specific slides
    const mobileSlides = [
        {
            type: 'hero',
            title: "Master Your Business Finances",
            description: "Stop using paper diaries. Switch to Karobar Khata for secure, cloud-based tracking.",
            image: null // Use hero gradient or logo
        },
        ...features.map(f => ({ type: 'feature', ...f })),
        {
            type: 'cta',
            title: "Ready to Start?",
            description: "Begin your journey of digital ledger with Karobar Khata.",
            image: null
        }
    ];

    /* --- Styles --- */
    const styles = {
        heroSection: {
            position: 'relative',
            overflow: 'hidden',
            background: 'linear-gradient(135deg, #2a0845 0%, #6441A5 50%, #feac5e 100%)',
            color: 'white',
            padding: isMobile ? '120px 20px 80px' : '100px 60px 80px',
            clipPath: isMobile ? 'none' : 'polygon(0 0, 100% 0, 100% 85%, 0 100%)',
            minHeight: isMobile ? 'auto' : '85vh',
            display: 'flex',
            alignItems: 'center'
        },
        heroContent: {
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1.2fr 1fr',
            gap: '40px',
            alignItems: 'center',
            zIndex: 2,
            position: 'relative'
        },
        glassCard: {
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
            borderRadius: '24px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            padding: '40px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
        },
        mockPhone: {
            width: '280px',
            height: '580px',
            background: '#111',
            borderRadius: '40px',
            border: '12px solid #333',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 50px 100px -20px rgba(50, 50, 93, 0.6), 0 30px 60px -30px rgba(0, 0, 0, 0.7)',
            margin: '0 auto',
            transform: isMobile ? 'none' : 'rotate(-6deg) translateY(20px)',
            transition: 'transform 0.5s ease-out'
        },
        featureSection: {
            padding: '100px 20px',
            background: '#f8f9fa'
        },
        featureRow: {
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: isMobile ? '40px' : '100px',
            maxWidth: '1200px',
            margin: '0 auto 120px'
        }
    };

    // --- MOBILE CAROUSEL RENDER ---
    if (isMobile) {
        const slide = mobileSlides[currentSlide];

        return (
            <div style={{
                height: '100vh',
                width: '100vw',
                display: 'flex',
                flexDirection: 'column',
                background: slide.type === 'hero' ? 'linear-gradient(135deg, #2a0845 0%, #6441A5 100%)' : '#ffffff',
                color: slide.type === 'hero' ? 'white' : '#333',
                position: 'fixed',
                top: 0,
                left: 0,
                overflow: 'hidden'
            }}>
                {/* Content Area */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>

                    {/* Image / Graphic */}
                    <div style={{ marginBottom: '40px', transition: 'all 0.3s' }}>
                        {slide.type === 'hero' && (
                            <div style={{ fontSize: '60px', marginBottom: '20px' }}>✨</div>
                        )}
                        {slide.type === 'feature' && (
                            <div style={{
                                width: '220px', height: '440px', // Smaller phone for mobile view
                                background: '#111',
                                borderRadius: '30px',
                                border: '8px solid #333',
                                overflow: 'hidden',
                                boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
                            }}>
                                <img src={slide.image} alt={slide.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => e.target.style.display = 'none'} />
                            </div>
                        )}
                        {slide.type === 'cta' && (
                            <div style={{ fontSize: '60px', marginBottom: '20px' }}>🚀</div>
                        )}
                    </div>

                    {/* Text */}
                    <h2 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '16px', lineHeight: 1.2 }}>
                        {slide.title}
                    </h2>
                    <p style={{ fontSize: '16px', opacity: 0.8, lineHeight: 1.5, maxWidth: '300px' }}>
                        {slide.description}
                    </p>

                </div>

                {/* Bottom Navigation */}
                <div style={{ padding: '24px', background: 'transparent' }}>
                    {/* Dots */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '24px' }}>
                        {mobileSlides.map((_, idx) => (
                            <div key={idx} style={{
                                width: '8px', height: '8px',
                                borderRadius: '50%',
                                background: idx === currentSlide
                                    ? (slide.type === 'hero' ? 'white' : '#1a237e')
                                    : (slide.type === 'hero' ? 'rgba(255,255,255,0.3)' : '#e0e0e0'),
                                transition: 'all 0.3s'
                            }} />
                        ))}
                    </div>

                    {/* Buttons */}
                    {currentSlide < mobileSlides.length - 1 ? (
                        <div style={{ display: 'flex', gap: '16px' }}>
                            <button
                                onClick={onGetStarted} // Allow skipping
                                style={{ flex: 1, padding: '16px', borderRadius: '12px', border: 'none', background: 'transparent', color: slide.type === 'hero' ? 'white' : '#666', fontWeight: '500' }}>
                                Skip
                            </button>
                            <button
                                onClick={() => setCurrentSlide(s => s + 1)}
                                style={{
                                    flex: 1, padding: '16px', borderRadius: '12px', border: 'none',
                                    background: slide.type === 'hero' ? 'white' : '#1a237e',
                                    color: slide.type === 'hero' ? '#2a0845' : 'white',
                                    fontWeight: 'bold', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                                }}>
                                Next
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={onGetStarted}
                            style={{
                                width: '100%', padding: '16px', borderRadius: '12px', border: 'none',
                                background: '#00c853', color: 'white', fontWeight: 'bold', fontSize: '18px',
                                boxShadow: '0 4px 12px rgba(0,200,83,0.3)'
                            }}>
                            Create Account
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // --- DESKTOP RENDER (Existing Zig-Zag) ---
    return (
        <div style={{ fontFamily: "'Inter', sans-serif", overflowX: 'hidden' }}>

            {/* 1. HERO SECTION */}
            <section style={styles.heroSection}>
                {/* Animated Background Blobs */}
                <div style={{
                    position: 'absolute', top: '-10%', right: '-10%',
                    width: '500px', height: '500px',
                    background: 'rgba(255, 255, 255, 0.1)', borderRadius: '50%', filter: 'blur(80px)'
                }}></div>
                <div style={{
                    position: 'absolute', bottom: '10%', left: '-10%',
                    width: '300px', height: '300px',
                    background: 'rgba(254, 172, 94, 0.2)', borderRadius: '50%', filter: 'blur(60px)'
                }}></div>

                <div style={styles.heroContent}>
                    <div style={{
                        opacity: isVisible ? 1 : 0,
                        transform: isVisible ? 'translateY(0)' : 'translateY(30px)',
                        transition: 'all 0.8s ease-out'
                    }}>
                        <div style={{
                            display: 'inline-block',
                            padding: '8px 16px',
                            background: 'rgba(255,255,255,0.2)',
                            borderRadius: '50px',
                            fontSize: '14px',
                            fontWeight: '600',
                            marginBottom: '20px',
                            border: '1px solid rgba(255,255,255,0.3)'
                        }}>
                            ✨ A Ledger App for Nepal
                        </div>
                        <h1 style={{
                            fontSize: isMobile ? '42px' : '64px',
                            fontWeight: '800',
                            marginBottom: '24px',
                            lineHeight: 1.1,
                            letterSpacing: '-1px',
                            textShadow: '0 4px 20px rgba(0,0,0,0.3)'
                        }}>
                            Master Your <br /> Business Finances.
                        </h1>
                        <p style={{
                            fontSize: isMobile ? '18px' : '20px',
                            lineHeight: 1.6,
                            opacity: 0.9,
                            marginBottom: '40px',
                            maxWidth: '540px'
                        }}>
                            Stop using paper diaries. Switch to <b>Karobar Khata</b> for secure, cloud-based tracking of your customers, suppliers, and daily expenses.
                        </p>
                        <div style={{ display: 'flex', gap: '16px', flexDirection: isMobile ? 'column' : 'row' }}>
                            <button
                                onClick={onGetStarted}
                                style={{
                                    padding: '18px 40px',
                                    borderRadius: '12px',
                                    background: 'white',
                                    color: '#4a148c',
                                    fontSize: '18px',
                                    fontWeight: 'bold',
                                    border: 'none',
                                    cursor: 'pointer',
                                    boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                                    transition: 'transform 0.2s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-3px)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                            >
                                Start today <span>→</span>
                            </button>
                        </div>
                    </div>

                    {/* Hero Image / Mockup */}
                    {!isMobile && (
                        <div style={{
                            ...styles.mockPhone,
                            transform: isVisible ? 'rotate(-6deg) translateY(0)' : 'rotate(-6deg) translateY(60px)',
                            opacity: isVisible ? 1 : 0,
                            transition: 'all 0.8s ease-out 0.2s'
                        }}>
                            {/* Use first screenshot for Hero phone */}
                            <img src={features[0].image} alt="App Dashboard" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => e.target.style.display = 'none'} />
                        </div>
                    )}
                </div>
            </section>

            {/* 2. FEATURES SECTION (ZIG-ZAG) */}
            <section style={styles.featureSection}>
                {features.map((feature, index) => (
                    <div key={index} style={{
                        ...styles.featureRow,
                        flexDirection: isMobile ? 'column' : (index % 2 === 0 ? 'row' : 'row-reverse')
                    }}>
                        {/* Text Side */}
                        <div style={{ flex: 1 }}>
                            <div style={{
                                width: '60px', height: '60px',
                                borderRadius: '16px',
                                background: feature.color,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '24px', color: feature.textColor,
                                marginBottom: '24px'
                            }}>
                                {index === 0 ? '👥' : index === 1 ? '🏭' : '💸'}
                            </div>
                            <h2 style={{ fontSize: '36px', fontWeight: '800', color: '#1a237e', marginBottom: '16px' }}>
                                {feature.title}
                            </h2>
                            <p style={{ fontSize: '18px', color: '#546e7a', lineHeight: 1.6, marginBottom: '24px' }}>
                                {feature.description}
                            </p>
                        </div>

                        {/* Image Side */}
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                            <div style={{
                                width: isMobile ? '100%' : '320px',
                                height: isMobile ? '400px' : '640px', // Taller for desktop phone look
                                background: 'white',
                                borderRadius: '32px',
                                border: '8px solid #333',
                                overflow: 'hidden',
                                boxShadow: '0 30px 60px -15px rgba(50, 50, 93, 0.25)',
                                position: 'relative'
                            }}>
                                <img src={feature.image} alt={feature.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                        </div>
                    </div>
                ))}
            </section>

            <Footer onNavigate={(page) => window.location.hash = page} /> {/* Re-added Footer for Web */}

        </div>
    );
};

export default Landing;
