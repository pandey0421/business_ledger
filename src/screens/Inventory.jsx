import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, limit, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { Trash2 } from 'lucide-react';

function Inventory({ goBack, user }) {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    // Form State - using abbreviated keys as per schema
    const [formData, setFormData] = useState({
        n: '', // Name
        u: 'pcs', // Unit
        cp: '', // Cost Price
        sp: '', // Selling Price
        qty: '' // Quantity
    });

    const userId = user?.uid || auth.currentUser?.uid;
    const productsRef = userId ? collection(db, 'users', userId, 'products') : null;

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const fetchProducts = async () => {
        if (!productsRef) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            // Fetch - Limit 20, sort by created date desc if possible, or just default
            // Note: orderBy might require an index if mixed with other filters, but simple query should work
            const q = query(productsRef, orderBy('createdAt', 'desc'), limit(20));
            const querySnapshot = await getDocs(q);
            const fetchedProducts = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setProducts(fetchedProducts);
        } catch (error) {
            console.error("Error fetching products:", error);
            // Fallback if index missing for orderBy
            try {
                const qFallback = query(productsRef, limit(20));
                const snapshot = await getDocs(qFallback);
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setProducts(data);
            } catch (err) {
                console.error("Critical error fetching products", err);
                toast.error("Failed to load inventory");
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, [userId]);

    const validateForm = () => {
        if (!formData.n.trim()) return "Product Name is required";
        if (!formData.u.trim()) return "Unit is required";
        if (formData.cp === '' || isNaN(formData.cp) || Number(formData.cp) < 0) return "Valid Cost Price is required";
        if (formData.sp === '' || isNaN(formData.sp) || Number(formData.sp) < 0) return "Valid Selling Price is required";
        if (formData.qty === '' || isNaN(formData.qty) || Number(formData.qty) < 0) return "Valid Quantity is required";
        return null;
    };

    const handleAddProduct = async (e) => {
        e.preventDefault();
        if (!userId) {
            toast.error("You must be logged in");
            return;
        }

        const error = validateForm();
        if (error) {
            toast.error(error);
            return;
        }

        try {
            await addDoc(productsRef, {
                n: formData.n.trim(),
                u: formData.u.trim(),
                cp: Number(formData.cp),
                sp: Number(formData.sp),
                qty: Number(formData.qty),
                createdAt: serverTimestamp()
            });

            toast.success("Product added successfully!");
            setFormData({ n: '', u: 'pcs', cp: '', sp: '', qty: '' });
            fetchProducts(); // Refresh list to show new item at top
        } catch (err) {
            console.error("Error adding product:", err);
            toast.error("Failed to add product");
        }
    };
    const handleDeleteProduct = async (productIds) => {
        if (!confirm('Are you sure you want to delete this product?')) return;
        try {
            // Support both single ID string or array of IDs (for merged products)
            const idsToDelete = Array.isArray(productIds) ? productIds : [productIds];

            await Promise.all(idsToDelete.map(id =>
                deleteDoc(doc(db, 'users', userId, 'products', id))
            ));

            toast.success("Product deleted");
            setProducts(prev => prev.filter(p => !idsToDelete.includes(p.id)));
        } catch (err) {
            console.error("Error deleting product:", err);
            toast.error("Failed to delete product");
        }
    };

    // Merge duplicates for display
    const mergedProducts = React.useMemo(() => {
        const map = new Map();
        // Products are already sorted by date descending, so the first one we see is the latest
        products.forEach(p => {
            const normalizedName = p.n ? p.n.trim().toLowerCase() : '';
            if (!normalizedName) return;

            if (map.has(normalizedName)) {
                const existing = map.get(normalizedName);
                // Sum quantities
                existing.qty = (Number(existing.qty) || 0) + (Number(p.qty) || 0);
                // Collect IDs
                existing.ids.push(p.id);
                // Keep the prices/unit from the LATEST entry (already in 'existing' due to sort order)
            } else {
                map.set(normalizedName, {
                    ...p,
                    ids: [p.id],
                    qty: Number(p.qty) || 0
                });
            }
        });
        return Array.from(map.values());
    }, [products]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // Styles for Glassmorphism and Premium feel
    const styles = {
        container: {
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', // Deep dark blue premium theme
            color: '#fff',
            padding: isMobile ? '16px' : '40px',
            fontFamily: "'Inter', sans-serif"
        },
        header: {
            display: 'flex',
            alignItems: 'center',
            marginBottom: '32px',
            gap: '16px'
        },
        backButton: {
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '12px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            transition: 'all 0.3s ease'
        },
        card: {
            background: 'rgba(255, 255, 255, 0.05)', // Glass effect
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '24px',
            padding: isMobile ? '20px' : '32px',
            marginBottom: '32px',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
        },
        inputGroup: {
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr 1fr 1fr 1fr auto',
            gap: '16px',
            alignItems: 'end'
        },
        label: {
            display: 'block',
            marginBottom: '8px',
            fontSize: '12px',
            color: '#a0a0b0',
            fontWeight: '500',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
        },
        input: {
            width: '100%',
            background: 'rgba(0, 0, 0, 0.2)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '12px 16px',
            color: 'white',
            fontSize: '14px',
            outline: 'none',
            transition: 'border-color 0.3s'
        },
        button: {
            background: 'linear-gradient(45deg, #FF3366, #FF6B6B)', // Vibrant CTA
            border: 'none',
            color: 'white',
            padding: '14px 28px',
            borderRadius: '12px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(255, 51, 102, 0.4)',
            transition: 'transform 0.2s',
            height: '46px'
        },
        grid: {
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '20px'
        },
        productCard: {
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '16px',
            padding: '20px',
            transition: 'transform 0.2s, background 0.2s'
        },
        productName: {
            fontSize: '18px',
            fontWeight: '600',
            marginBottom: '12px',
            color: '#fff'
        },
        productStat: {
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '8px',
            fontSize: '13px',
            color: '#cccccc'
        },
        statLabel: {
            color: '#888888'
        },
        badge: {
            padding: '4px 8px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 'bold',
            background: 'rgba(255, 255, 255, 0.1)'
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <button
                    onClick={goBack}
                    style={styles.backButton}
                    onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
                    onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.1)'}
                >
                    ← Back
                </button>
                <div>
                    <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '700', background: 'linear-gradient(to right, #fff, #a5b4fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Inventory Management
                    </h1>
                    <p style={{ margin: '4px 0 0 0', color: '#8899ac', fontSize: '14px' }}>
                        Track your stock, costs, and sales prices
                    </p>
                </div>
            </div>

            {/* Add Product Form */}
            <div style={styles.card}>
                <h3 style={{ margin: '0 0 20px 0', color: '#fff', fontSize: '18px' }}>Add New Product</h3>
                <form onSubmit={handleAddProduct} style={styles.inputGroup}>
                    <div>
                        <label style={styles.label}>Item Name</label>
                        <input
                            name="n"
                            value={formData.n}
                            onChange={handleChange}
                            placeholder="e.g. Pillow Cover"
                            style={styles.input}
                        />
                    </div>
                    <div>
                        <label style={styles.label}>Unit</label>
                        <input
                            name="u"
                            value={formData.u}
                            onChange={handleChange}
                            placeholder="e.g. cup"
                            style={styles.input}
                        />
                    </div>
                    <div>
                        <label style={styles.label}>Cost Price</label>
                        <input
                            name="cp"
                            type="number"
                            value={formData.cp}
                            onChange={handleChange}
                            placeholder="0.00"
                            style={styles.input}
                        />
                    </div>
                    <div>
                        <label style={styles.label}>Selling Price</label>
                        <input
                            name="sp"
                            type="number"
                            value={formData.sp}
                            onChange={handleChange}
                            placeholder="0.00"
                            style={styles.input}
                        />
                    </div>
                    <div>
                        <label style={styles.label}>Quantity</label>
                        <input
                            name="qty"
                            type="number"
                            value={formData.qty}
                            onChange={handleChange}
                            placeholder="0"
                            style={styles.input}
                        />
                    </div>
                    <button
                        type="submit"
                        style={styles.button}
                        onMouseEnter={(e) => e.target.style.transform = 'scale(1.02)'}
                        onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                    >
                        Add Item
                    </button>
                </form>
            </div>

            {/* Product List */}
            <div>
                <h3 style={{ margin: '0 0 20px 0', color: '#fff', fontSize: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Current Stock <span style={styles.badge}>{mergedProducts.length} Products</span></span>
                </h3>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#8899ac' }}>Loading inventory...</div>
                ) : products.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '60px',
                        background: 'rgba(255, 255, 255, 0.02)',
                        borderRadius: '24px',
                        border: '1px dashed rgba(255, 255, 255, 0.1)',
                        color: '#667788'
                    }}>
                        No products found. Start adding your inventory above.
                    </div>
                ) : (
                    <div style={styles.grid}>
                        {mergedProducts.map((product) => (
                            <div
                                key={product.id} // using the id of the latest doc as key
                                style={styles.productCard}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                                    e.currentTarget.style.transform = 'translateY(-4px)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                }}
                            >
                                <div style={styles.productName}>{product.n}</div>
                                <div style={styles.productStat}>
                                    <span style={styles.statLabel}>Stock</span>
                                    <span style={{ color: product.qty < 5 ? '#ff6b6b' : '#4ecdc4', fontWeight: 'bold' }}>
                                        {product.qty} {product.u}
                                    </span>
                                </div>
                                <div style={styles.productStat}>
                                    <span style={styles.statLabel}>Cost</span>
                                    <span>Rs. {product.cp}</span>
                                </div>
                                <div style={styles.productStat}>
                                    <span style={styles.statLabel}>Selling</span>
                                    <span>Rs. {product.sp}</span>
                                </div>
                                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '12px', color: '#666', textAlign: 'right' }}>
                                    Margin: {product.sp && product.cp ? Math.round(((product.sp - product.cp) / product.cp) * 100) : 0}%
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteProduct(product.ids); }}
                                    style={{
                                        marginTop: '12px',
                                        width: '100%',
                                        padding: '8px',
                                        background: 'rgba(255, 59, 48, 0.1)',
                                        border: '1px solid rgba(255, 59, 48, 0.2)',
                                        borderRadius: '8px',
                                        color: '#ff3b30',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                        fontSize: '12px',
                                        transition: 'background 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.target.style.background = 'rgba(255, 59, 48, 0.2)'}
                                    onMouseLeave={(e) => e.target.style.background = 'rgba(255, 59, 48, 0.1)'}
                                >
                                    <Trash2 size={14} /> Delete Product
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div >
    );
}

export default Inventory;
