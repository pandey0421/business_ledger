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

    // Mobile specific slides for carousel
    const mobileSlides = [
        {
            type: 'hero',
            title: "Master Your Business Finances",
            description: "Stop using paper diaries. Switch to Karobar Khata for secure, cloud-based tracking.",
            image: "/favicon.ico"
        },
        ...features.map(f => ({ type: 'feature', ...f })),
        {
            type: 'cta',
            title: "Ready to Start?",
            description: "Begin your journey of digital ledger with Karobar Khata.",
            image: "/favicon.ico"
        }
    ];

    /* --- Styles for Premium Dark Theme --- */
    const styles = {
        heroSection: {
            position: 'relative',
            overflow: 'hidden',
            // The Dark Royal Blue/Purple Gradient from your screenshot
            background: 'radial-gradient(circle at top right, #4a148c 0%, #1a237e 60%, #0d47a1 100%)',
            color: 'white',
            padding: isMobile ? '120px 20px 80px' : '100px 60px 100px',
            // Angled bottom clip for desktop
            clipPath: isMobile ? 'none' : 'polygon(0 0, 100% 0, 100% 90%, 0 100%)',
            minHeight: isMobile ? 'auto' : '90vh',
            display: 'flex',
            alignItems: 'center'
        },
        heroContent: {
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1.2fr 1fr',
            gap: '60px',
            alignItems: 'center',
            zIndex: 2,
            position: 'relative'
        },
        glassBadge: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: '12px',
            padding: '10px 24px',
            background: 'rgba(255,255,255,0.1)',
            backdropFilter: 'blur(10px)',
            borderRadius: '50px',
            marginBottom: '32px',
            border: '1px solid rgba(255,255,255,0.2)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
        },
        heroTitle: {
            fontSize: isMobile ? '42px' : '72px',
            fontWeight: '800',
            marginBottom: '24px',
            lineHeight: 1.1,
            letterSpacing: '-2px',
            // Slight gradient text effect or pure white
            background: 'linear-gradient(to right, #fff, #b3e5fc)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: '0 10px 30px rgba(0,0,0,0.2)'
        },
        heroDesc: {
            fontSize: isMobile ? '18px' : '22px',
            lineHeight: 1.6,
            opacity: 0.9,
            marginBottom: '48px',
            maxWidth: '560px',
            fontWeight: '300'
        },
        primaryBtn: {
            padding: '20px 48px',
            borderRadius: '16px',
            background: 'white',
            color: '#311b92',
            fontSize: '18px',
            fontWeight: 'bold',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px'
        },
        mockPhone: {
            width: '300px',
            height: '620px',
            background: '#111',
            borderRadius: '45px',
            border: '12px solid #333',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 50px 100px -20px rgba(0, 0, 0, 0.5)',
            transform: isMobile ? 'none' : 'rotate(-6deg) translateY(30px)',
            transition: 'transform 1s ease-out'
        },
        section: {
            padding: '100px 20px',
            background: '#f8f9fa'
        },
        featureRow: {
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: isMobile ? '60px' : '100px',
            maxWidth: '1200px',
            margin: '0 auto 120px'
        }
    };

    // --- MOBILE CAROUSEL RENDER ---
    if (isMobile) {
        const slide = mobileSlides[currentSlide];
        return (
            <div style={{
                height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column',
                background: slide.type === 'hero' ? 'linear-gradient(135deg, #311b92 0%, #6200ea 100%)' : '#ffffff',
                color: slide.type === 'hero' ? 'white' : '#333',
                position: 'fixed', top: 0, left: 0, overflow: 'hidden'
            }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>

                    <div style={{ marginBottom: '40px' }}>
                        {(slide.type === 'hero' || slide.type === 'cta') ? (
                            <div style={{
                                width: '120px', height: '120px', background: 'white', borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 10px 30px rgba(0,0,0,0.2)', margin: '0 auto'
                            }}>
                                <img src="/favicon.ico" alt="Logo" style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
                            </div>
                        ) : (
                            <div style={{
                                width: '220px', height: '440px', background: '#111', borderRadius: '30px', border: '8px solid #333',
                                overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
                            }}>
                                <img src={slide.image} alt={slide.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => e.target.style.display = 'none'} />
                            </div>
                        )}
                    </div>

                    <h2 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '16px', lineHeight: 1.2 }}>{slide.title}</h2>
                    <p style={{ fontSize: '16px', opacity: 0.8, lineHeight: 1.5, maxWidth: '300px' }}>{slide.description}</p>
                </div>

                <div style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '24px' }}>
                        {mobileSlides.map((_, idx) => (
                            <div key={idx} style={{
                                width: '8px', height: '8px', borderRadius: '50%',
                                background: idx === currentSlide ? (slide.type === 'hero' ? 'white' : '#1a237e') : (slide.type === 'hero' ? 'rgba(255,255,255,0.3)' : '#e0e0e0'),
                                transition: 'all 0.3s'
                            }} />
                        ))}
                    </div>

                    {currentSlide < mobileSlides.length - 1 ? (
                        <div style={{ display: 'flex', gap: '16px' }}>
                            <button onClick={onGetStarted} style={{ flex: 1, padding: '16px', borderRadius: '12px', border: 'none', background: 'transparent', color: slide.type === 'hero' ? 'white' : '#666', fontWeight: '500' }}>Skip</button>
                            <button onClick={() => setCurrentSlide(s => s + 1)} style={{ flex: 1, padding: '16px', borderRadius: '12px', border: 'none', background: slide.type === 'hero' ? 'white' : '#1a237e', color: slide.type === 'hero' ? '#2a0845' : 'white', fontWeight: 'bold' }}>Next</button>
                        </div>
                    ) : (
                        <button onClick={onGetStarted} style={{ width: '100%', padding: '16px', borderRadius: '12px', border: 'none', background: '#00c853', color: 'white', fontWeight: 'bold', fontSize: '18px' }}>Create Account</button>
                    )}
                </div>
            </div>
        );
    }

    // --- DESKTOP RENDER --
    return (
        <div style={{ fontFamily: "'Inter', sans-serif", overflowX: 'hidden' }}>
            <section style={styles.heroSection}>
                {/* Decorative Blobs */}
                <div style={{ position: 'absolute', top: '-10%', right: '-10%', width: '600px', height: '600px', background: 'rgba(255,255,255,0.05)', borderRadius: '50%', filter: 'blur(80px)' }}></div>

                <div style={styles.heroContent}>
                    <div style={{ opacity: isVisible ? 1 : 0, transform: isVisible ? 'translateY(0)' : 'translateY(30px)', transition: 'all 0.8s ease-out' }}>

                        {/* Glass Badge with Logo */}
                        <div style={styles.glassBadge}>
                            <img src="/favicon.ico" alt="Logo" style={{ width: '24px', height: '24px' }} />
                            <span style={{ fontSize: '15px', fontWeight: 'bold', letterSpacing: '0.5px' }}>KAROBAR KHATA</span>
                        </div>

                        <h1 style={styles.heroTitle}>Master Your <br /> Business Finances.</h1>
                        <p style={styles.heroDesc}>Stop using paper diaries. Switch to <b>Karobar Khata</b> for secure, cloud-based tracking of your customers, suppliers, and daily expenses.</p>

                        <button
                            onClick={onGetStarted}
                            style={styles.primaryBtn}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 30px 60px rgba(0,0,0,0.3)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.2)'; }}
                        >
                            Start today <span>→</span>
                        </button>
                    </div>

                    {/* Phone Mockup on Desktop */}
                    {!isMobile && (
                        <div style={{
                            ...styles.mockPhone,
                            transform: isVisible ? 'rotate(-6deg) translateY(0)' : 'rotate(-6deg) translateY(60px)',
                            opacity: isVisible ? 1 : 0,
                            transition: 'all 0.8s ease-out 0.2s'
                        }}>
                            {/* Display a composition of screenshots or just the dashboard one */}
                            {/* Since user uploaded an image showing a dashboard-like list, we'll try to find 'dashboard.png' or fallback to the first feature image */}
                            <img
                                src="/screenshots/dashboard.png"
                                alt="Dashboard Preview"
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={(e) => {
                                    // Fallback if dashboard.png missing: use customers screenshot
                                    e.target.src = features[0].image;
                                }}
                            />
                        </div>
                    )}
                </div>
            </section>

            {/* Features Section */}
            <section style={styles.section}>
                {features.map((feature, index) => (
                    <div key={index} style={{ ...styles.featureRow, flexDirection: index % 2 === 1 ? 'row-reverse' : 'row' }}>
                        <div style={{ flex: 1, padding: '20px' }}>
                            <div style={{
                                width: '60px', height: '60px', borderRadius: '16px', background: feature.color,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', marginBottom: '24px'
                            }}>
                                {index === 0 ? '👥' : index === 1 ? '🏭' : '💸'}
                            </div>
                            <h2 style={{ fontSize: '36px', fontWeight: '800', color: '#1a237e', marginBottom: '16px' }}>{feature.title}</h2>
                            <p style={{ fontSize: '20px', color: '#546e7a', lineHeight: 1.6 }}>{feature.description}</p>
                        </div>
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                            <div style={{
                                width: '300px', height: '600px', background: '#fff', borderRadius: '30px',
                                border: '10px solid #222', overflow: 'hidden', boxShadow: '0 30px 60px rgba(0,0,0,0.15)'
                            }}>
                                <img src={feature.image} alt={feature.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                        </div>
                    </div>
                ))}
            </section>

            <Footer onNavigate={(page) => window.location.hash = page} />
        </div>
    );
};

export default Landing;
