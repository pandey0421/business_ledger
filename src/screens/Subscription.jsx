import React, { useEffect, useState } from 'react';
import KhaltiCheckout from 'khalti-checkout-web';
import { supabase } from '../supabaseClient';
import { authService } from '../services/authService';
import toast from 'react-hot-toast';

const Subscription = ({ onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [expiry, setExpiry] = useState(null);

    // Load current subscription
    useEffect(() => {
        const checkSub = async () => {
            const { data: { user } } = await authService.getCurrentUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('user_subscriptions')
                .select('subscription_expiry')
                .eq('user_id', user.id)
                .maybeSingle();

            if (!error && data && data.subscription_expiry) {
                setExpiry(new Date(data.subscription_expiry));
            }
        };
        checkSub();
    }, []);

    // Khalti Config
    const config = {
        // "publicKey": "test_public_key_dc74e0fd57cb46cd93832aee0a390234", // Replace with your LIVE public key in production
        "publicKey": "test_public_key_dc74e0fd57cb46cd93832aee0a390234",
        "productIdentity": "karobar_khata_pro_1yr",
        "productName": "Karobar Khata Pro (1 Year)",
        "productUrl": "http://karobarkhata.com",
        "eventHandler": {
            onSuccess(payload) {
                console.log("Khalti Success:", payload);
                handlePaymentSuccess(payload);
            },
            onError(error) {
                console.log("Khalti Error:", error);
                toast.error("Payment Failed. Please try again.");
                setLoading(false);
            },
            onClose() {
                console.log("Khalti widget closed");
                setLoading(false);
            }
        },
        "paymentPreference": ["KHALTI"],
    };

    const handlePaymentSuccess = async (payload) => {
        setLoading(true);
        try {
            // In a real app, verify 'payload.token' on your SERVER before updating DB
            // For this MVP, we update directly (Client-side verification is insecure but functional for demo)

            const { data: { user } } = await authService.getCurrentUser();
            if (!user) throw new Error("User not authenticated");

            const futureDate = new Date();
            futureDate.setFullYear(futureDate.getFullYear() + 1);

            const { error } = await supabase
                .from('user_subscriptions')
                .upsert({
                    user_id: user.id,
                    subscription_status: 'active',
                    subscription_expiry: futureDate.toISOString(),
                    last_payment_id: payload.idx,
                    verification_token: payload.token,
                    payment_details: payload,
                    last_payment_date: new Date().toISOString(),
                    email: user.email
                }, { onConflict: 'user_id' });

            if (error) throw error;

            toast.success("Subscription Activated! Welcome to Pro.");
            onSuccess(); // Redirect to Dashboard
        } catch (err) {
            console.error(err);
            toast.error("Error activating subscription.");
        } finally {
            setLoading(false);
        }
    };

    const startPayment = () => {
        setLoading(true);
        const checkout = new KhaltiCheckout(config);
        // 1000 NPR = 100000 paisa
        checkout.show({ amount: 100000 });
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            background: 'linear-gradient(135deg, #1a237e 0%, #0d47a1 100%)',
            fontFamily: "'Inter', sans-serif"
        }}>
            <div style={{
                background: 'white',
                padding: '40px',
                borderRadius: '24px',
                maxWidth: '400px',
                width: '100%',
                textAlign: 'center',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}>
                <div style={{
                    width: '80px',
                    height: '80px',
                    background: '#e8eaf6',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 24px',
                    fontSize: '40px'
                }}>
                    💎
                </div>

                <h2 style={{ margin: '0 0 10px 0', color: '#1a237e' }}>Karobar Khata Pro</h2>
                <p style={{ color: '#607d8b', marginBottom: '30px' }}>
                    Upgrade to unlock the full power of your business ledger.
                </p>

                <ul style={{
                    textAlign: 'left',
                    margin: '0 0 30px 0',
                    padding: '0 20px',
                    listStyle: 'none',
                    color: '#455a64'
                }}>
                    <li style={{ marginBottom: '10px' }}>✅ Unlimited Customers & Suppliers</li>
                    <li style={{ marginBottom: '10px' }}>✅ Cloud Sync (Web + App)</li>
                    <li style={{ marginBottom: '10px' }}>✅ PDF Report Generation</li>
                    <li style={{ marginBottom: '10px' }}>✅ Priority Support</li>
                    <li>✅ One Account, Multiple Devices</li>
                </ul>

                <div style={{
                    background: '#f5f5f5',
                    padding: '15px',
                    borderRadius: '12px',
                    marginBottom: '20px'
                }}>
                    <span style={{ fontSize: '14px', color: '#607d8b' }}>Yearly Subscription</span>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#2e7d32' }}>
                        NPR 1,000 <span style={{ fontSize: '14px', fontWeight: 'normal' }}>/year</span>
                    </div>
                </div>

                {expiry && expiry > new Date() ? (
                    <div style={{
                        padding: '15px',
                        background: '#e8f5e9',
                        color: '#2e7d32',
                        borderRadius: '8px',
                        marginBottom: '20px'
                    }}>
                        Active (Expires: {expiry.toLocaleDateString()})
                    </div>
                ) : (
                    <button
                        onClick={startPayment}
                        disabled={loading}
                        style={{
                            width: '100%',
                            padding: '16px',
                            borderRadius: '12px',
                            border: 'none',
                            background: '#5c2d91', // Khalti Purple
                            color: 'white',
                            fontSize: '16px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            transition: 'transform 0.2s'
                        }}
                    >
                        Pay with Khalti
                    </button>
                )}

                <p style={{ fontSize: '12px', color: '#90a4ae', marginTop: '16px' }}>
                    Secure payment via Khalti Digital Wallet.
                </p>
            </div>
        </div>
    );
};

export default Subscription;
