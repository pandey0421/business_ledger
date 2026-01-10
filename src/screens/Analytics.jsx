import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';
import NepaliDate from 'nepali-date-converter';
import {
    LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { motion } from 'framer-motion';
import { Download, ArrowUpRight, ArrowDownRight, Wallet, Users, ShoppingBag, Filter, ArrowLeft, DollarSign, TrendingUp, CreditCard, ShoppingCart } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// --- Helper Components ---

const Card = ({ children, className = "", style = {} }) => (
    <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
            background: 'white', borderRadius: '16px', padding: '20px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1px solid #f0f0f0',
            width: '100%', boxSizing: 'border-box',
            ...style
        }}
        className={className}
    >
        {children}
    </motion.div>
);

const KPICard = ({ title, value, subtext, color, icon: Icon, trend }) => (
    <Card style={{ background: `linear-gradient(135deg, ${color[0]}, ${color[1]})`, color: 'white', border: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div style={{ padding: '8px', background: 'rgba(255,255,255,0.2)', borderRadius: '12px' }}>
                <Icon size={24} color="white" />
            </div>
            {trend !== undefined && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    fontSize: '12px', fontWeight: 'bold',
                    background: 'rgba(255,255,255,0.2)', padding: '4px 8px', borderRadius: '20px'
                }}>
                    {trend >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    {Math.abs(trend)}%
                </div>
            )}
        </div>
        <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '4px' }}>{title}</div>
        <div style={{ fontSize: '26px', fontWeight: 'bold', marginBottom: '4px', wordBreak: 'break-all' }}>{value}</div>
        <div style={{ fontSize: '12px', opacity: 0.8 }}>{subtext}</div>
    </Card>
);

// --- Main Analytics Component ---

const Analytics = ({ goBack }) => {
    const [loading, setLoading] = useState(true);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    // Text inputs for Manual Nepali Date (Strings)
    const [inputs, setInputs] = useState({
        start: '',
        end: ''
    });

    const [appliedFilter, setAppliedFilter] = useState({
        start: '',
        end: ''
    });

    const [data, setData] = useState({
        sales: 0,
        purchases: 0,
        collected: 0,
        receivables: 0,
        payables: 0,
        netProfit: 0,
        expenses: 0,
        monthlyData: [],
        pieData: [],
        topEntities: []
    });

    const userId = auth.currentUser?.uid;
    const currentYearBS = new NepaliDate().getYear();

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Initialize inputs
    useEffect(() => {
        try {
            // Default: This Month
            const today = new NepaliDate();
            const startBS = `${today.getYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
            const endBS = today.format('YYYY-MM-DD');
            setInputs({ start: startBS, end: endBS });
            setAppliedFilter({ start: startBS, end: endBS });
        } catch (e) {
            console.error(e);
        }
    }, []);

    const setQuickFilter = (yearOffset = 0) => {
        const targetYear = currentYearBS + yearOffset;
        const start = `${targetYear}-01-01`;
        const end = `${targetYear}-12-30`;
        setInputs({ start, end });
        setAppliedFilter({ start, end });
    };

    const applyDateFilter = () => {
        if (!inputs.start || !inputs.end) {
            alert("Please enter both dates");
            return;
        }
        setAppliedFilter({ start: inputs.start, end: inputs.end });
    };

    const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'NPR', minimumFractionDigits: 0 }).format(amount).replace('NPR', 'Rs.');

    useEffect(() => {
        if (!userId) return;
        fetchData();
    }, [userId, appliedFilter]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const listDocs = async (coll) => (await getDocs(collection(db, 'users', userId, coll))).docs.map(d => ({ id: d.id, ...d.data() }));

            const [customers, suppliers, expenses] = await Promise.all([
                listDocs('customers'),
                listDocs('suppliers'),
                listDocs('expenses')
            ]);

            // Deep Fetch Ledgers
            const fetchLedger = async (coll, id) => {
                // Try User Scope first
                let ref = collection(db, 'users', userId, coll, id, 'ledger');
                let snapshot = await getDocs(ref);

                // Fallback to Root Scope if empty (Legacy support)
                if (snapshot.empty) {
                    const rootRef = collection(db, coll, id, 'ledger');
                    const rootSnap = await getDocs(rootRef);
                    if (!rootSnap.empty) {
                        snapshot = rootSnap;
                    }
                }
                return snapshot.docs.map(d => ({ ...d.data(), entityId: id }));
            };

            const custLedgers = (await Promise.all(customers.map(c => fetchLedger('customers', c.id)))).flat();
            const suppLedgers = (await Promise.all(suppliers.map(s => fetchLedger('suppliers', s.id)))).flat();
            const expLedgers = (await Promise.all(expenses.map(e => fetchLedger('expenses', e.id)))).flat();

            const startStr = appliedFilter.start;
            const endStr = appliedFilter.end;

            const isInRange = (dateStr) => {
                if (!dateStr) return false;
                return dateStr >= startStr && dateStr <= endStr;
            };

            // 0. Overall Data (All Time)
            const allSales = custLedgers.filter(t => t.type === 'sale').reduce((s, t) => s + (Number(t.amount) || 0), 0);
            const allPurchases = suppLedgers.filter(t => t.type === 'purchase').reduce((s, t) => s + (Number(t.amount) || 0), 0);
            const allExpenses = expLedgers.reduce((s, t) => s + (Number(t.amount) || 0), 0);
            const overallNetProfit = allSales - allPurchases - allExpenses;

            // 1. Period Data
            const periodSales = custLedgers.filter(t => t.type === 'sale' && isInRange(t.date));
            const periodCollections = custLedgers.filter(t => t.type === 'payment' && isInRange(t.date));
            const periodPurchases = suppLedgers.filter(t => t.type === 'purchase' && isInRange(t.date));
            const periodExpenses = expLedgers.filter(t => isInRange(t.date));

            const totalSales = periodSales.reduce((s, t) => s + (Number(t.amount) || 0), 0);
            const totalCollected = periodCollections.reduce((s, t) => s + (Number(t.amount) || 0), 0);
            const totalPurchases = periodPurchases.reduce((s, t) => s + (Number(t.amount) || 0), 0);
            const totalExpenses = periodExpenses.reduce((s, t) => s + (Number(t.amount) || 0), 0);

            // Formula: Net Profit = Total Sales - Total Purchase - Total Expenses
            // const netProfit = totalSales - totalPurchases - totalExpenses; // CHANGED to overall

            // 2. All Time Data (Receivables/Payables)
            let totalReceivables = 0;
            customers.forEach(c => {
                const txs = custLedgers.filter(l => l.entityId === c.id);
                const sales = txs.filter(t => t.type === 'sale').reduce((a, b) => a + Number(b.amount || 0), 0);
                const paid = txs.filter(t => t.type === 'payment').reduce((a, b) => a + Number(b.amount || 0), 0);
                totalReceivables += (sales - paid);
            });

            let totalPayables = 0;
            suppliers.forEach(s => {
                const txs = suppLedgers.filter(l => l.entityId === s.id);
                const pur = txs.filter(t => t.type === 'purchase').reduce((a, b) => a + Number(b.amount || 0), 0);
                const paid = txs.filter(t => t.type === 'payment').reduce((a, b) => a + Number(b.amount || 0), 0);
                totalPayables += (pur - paid);
            });

            // 3. Chart Data (Sales vs Profit Trend) - Simplified Profit per month for visualization
            const buckets = {};
            const addToBucket = (dateStr, key, amount) => {
                if (!dateStr) return;
                const monthKey = dateStr.substring(0, 7);
                if (!buckets[monthKey]) buckets[monthKey] = { name: monthKey, sales: 0, profit: 0, expense: 0, purchase: 0 };

                if (key === 'sales') {
                    buckets[monthKey].sales += amount;
                    buckets[monthKey].profit += amount;
                }
                if (key === 'expense') {
                    buckets[monthKey].expense += amount;
                    buckets[monthKey].profit -= amount;
                }
                if (key === 'purchase') {
                    buckets[monthKey].purchase += amount;
                    buckets[monthKey].profit -= amount;
                }
            };

            periodSales.forEach(t => addToBucket(t.date, 'sales', Number(t.amount) || 0));
            periodExpenses.forEach(t => addToBucket(t.date, 'expense', Number(t.amount) || 0));
            periodPurchases.forEach(t => addToBucket(t.date, 'purchase', Number(t.amount) || 0));

            const monthlyData = Object.values(buckets).sort((a, b) => a.name.localeCompare(b.name));

            // 4. Top Customers
            const customerVolume = {};
            periodSales.forEach(t => {
                customerVolume[t.entityId] = (customerVolume[t.entityId] || 0) + (Number(t.amount) || 0);
            });
            const topEntities = Object.entries(customerVolume)
                .map(([id, vol]) => {
                    const c = customers.find(x => x.id === id);
                    return { name: c?.name || 'Unknown', volume: vol, type: 'Customer' };
                })
                .sort((a, b) => b.volume - a.volume)
                .slice(0, 5);

            setData({
                sales: totalSales,
                purchases: totalPurchases,
                collected: totalCollected,
                expenses: totalExpenses,
                receivables: Math.max(0, totalReceivables),
                payables: Math.max(0, totalPayables),
                netProfit: overallNetProfit,
                monthlyData,
                pieData: [
                    { name: 'Income', value: totalSales, color: '#4caf50' },
                    { name: 'Expenses', value: totalExpenses, color: '#f44336' },
                    { name: 'Purchases', value: totalPurchases, color: '#ff9800' }
                ],
                topEntities
            });

        } catch (error) {
            console.error("Error fetching analytics:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div style={{ padding: '40px', textAlign: 'center', height: '80vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1 }}
                style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid #3498db', borderRadius: '50%' }}
            />
            <p style={{ marginTop: '20px', color: '#666' }}>Analyzing...</p>
        </div>
    );

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
            padding: isMobile ? '12px' : '24px',
            fontFamily: "'Inter', sans-serif",
            overflowX: 'hidden',
            width: '100vw',
            boxSizing: 'border-box'
        }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>

                {/* Header */}
                <div style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <button
                            onClick={goBack}
                            style={{ padding: '8px', borderRadius: '50%', border: 'none', background: '#e8eaf6', color: '#1a237e', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <h1 style={{ fontSize: isMobile ? '22px' : '28px', fontWeight: 'bold', color: '#1a237e', margin: 0 }}>Business Analytics</h1>
                    </div>

                    {/* Filter Bar */}
                    <div style={{
                        background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #eee',
                        display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'end', boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                    }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '600', color: '#666' }}>From BS Date</label>
                            <input
                                type="text"
                                placeholder="YYYY-MM-DD"
                                value={inputs.start}
                                onChange={(e) => setInputs(prev => ({ ...prev, start: e.target.value }))}
                                style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '6px', width: '110px' }}
                            />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '600', color: '#666' }}>To BS Date</label>
                            <input
                                type="text"
                                placeholder="YYYY-MM-DD"
                                value={inputs.end}
                                onChange={(e) => setInputs(prev => ({ ...prev, end: e.target.value }))}
                                style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '6px', width: '110px' }}
                            />
                        </div>
                        <button
                            onClick={applyDateFilter}
                            style={{ padding: '8px 16px', background: '#3f51b5', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', minWidth: '40px', height: '38px', cursor: 'pointer' }}
                        >
                            <Filter size={18} />
                        </button>
                        <div style={{ display: 'flex', gap: '8px', marginLeft: isMobile ? '0' : 'auto' }}>
                            <button
                                onClick={() => setQuickFilter(0)}
                                style={{ padding: '6px 12px', background: '#e8eaf6', color: '#3f51b5', border: '1px solid #c5cae9', borderRadius: '20px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                            >
                                {currentYearBS} BS
                            </button>
                            <button
                                onClick={() => setQuickFilter(-1)}
                                style={{ padding: '6px 12px', background: '#f5f5f5', color: '#666', border: '1px solid #e0e0e0', borderRadius: '20px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                            >
                                {currentYearBS - 1} BS
                            </button>
                        </div>
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '14px', color: '#777' }}>
                        Showing data for: <b>{appliedFilter.start}</b> to <b>{appliedFilter.end}</b>
                    </div>
                </div>

                {/* SECTION 1: Profit & Loss (Period) */}
                <h3 style={{ fontSize: '18px', color: '#1a237e', marginBottom: '16px', fontWeight: 'bold' }}>Profit & Loss (Period)</h3>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: isMobile ? '12px' : '24px',
                    marginBottom: '32px'
                }}>
                    <KPICard
                        title="Period Sales"
                        value={formatCurrency(data.sales)}
                        subtext="Total Revenue"
                        color={['#43a047', '#66bb6a']}
                        icon={Wallet}
                    />
                    <KPICard
                        title="Period Purchases"
                        value={formatCurrency(data.purchases)}
                        subtext="Bills & Stock"
                        color={['#f57c00', '#ff9800']} // Orange
                        icon={ShoppingCart}
                    />
                    <KPICard
                        title="Period Expenses"
                        value={formatCurrency(data.expenses)}
                        subtext="Operating Costs"
                        color={['#d32f2f', '#ef5350']} // Red
                        icon={CreditCard}
                    />
                    <KPICard
                        title="Money Collected"
                        value={formatCurrency(data.collected)}
                        subtext="Cash Inflow"
                        color={['#00897b', '#26a69a']} // Teal
                        icon={DollarSign}
                    />
                </div>

                {/* SECTION 2: Cash Flow & Balance */}
                <h3 style={{ fontSize: '18px', color: '#1a237e', marginBottom: '16px', fontWeight: 'bold' }}>Cash Flow & Position</h3>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: isMobile ? '12px' : '24px',
                    marginBottom: '32px'
                }}>
                    <KPICard
                        title="Total Net Profit"
                        value={formatCurrency(data.netProfit)}
                        subtext="All Time"
                        color={['#1e88e5', '#42a5f5']}
                        icon={TrendingUp}
                        trend={0}
                    />
                    <KPICard
                        title="Receivables"
                        value={formatCurrency(data.receivables)}
                        subtext="Unpaid by Customers"
                        color={['#ffa726', '#ffcc80']}
                        icon={Users}
                    />
                    <KPICard
                        title="Payables"
                        value={formatCurrency(data.payables)}
                        subtext="Unpaid to Suppliers"
                        color={['#e53935', '#ef5350']}
                        icon={ShoppingBag}
                    />
                </div>

                {/* Charts Section */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: '24px',
                    marginBottom: '32px'
                }}>

                    {/* Revenue Trend */}
                    <Card>
                        <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '20px' }}>Revenue & Profit Trend</h3>
                        <div style={{ height: '280px', width: '100%', fontSize: '12px' }}>
                            <ResponsiveContainer>
                                <AreaChart data={data.monthlyData}>
                                    <defs>
                                        <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#4caf50" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="#4caf50" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                                    <YAxis tickFormatter={(val) => val >= 1000 ? `${val / 1000}k` : val} width={40} tick={{ fontSize: 10 }} />
                                    <Tooltip formatter={(val) => formatCurrency(val)} />
                                    <Legend />
                                    <Area type="monotone" dataKey="sales" name="Sales" stroke="#4caf50" fillOpacity={1} fill="url(#colorSales)" />
                                    <Area type="monotone" dataKey="profit" name="Profit" stroke="#2196f3" fillOpacity={1} fill="transparent" />
                                </AreaChart>
                            </ResponsiveContainer>
                            {data.monthlyData.length === 0 && (
                                <div style={{ textAlign: 'center', marginTop: '-150px', color: '#999' }}>No data in this period</div>
                            )}
                        </div>
                    </Card>

                    {/* Pie Chart */}
                    <Card>
                        <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '20px' }}>Inflow vs Outflow</h3>
                        <div style={{ height: '280px', width: '100%', position: 'relative' }}>
                            <ResponsiveContainer>
                                <PieChart>
                                    <Pie
                                        data={data.pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={70}
                                        outerRadius={90}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {data.pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value) => formatCurrency(value)} />
                                    <Legend verticalAlign="bottom" height={36} />
                                </PieChart>
                            </ResponsiveContainer>
                            {/* Centered Total Text */}
                            <div style={{
                                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -60%)',
                                textAlign: 'center', pointerEvents: 'none'
                            }}>
                                <div style={{ fontSize: '12px', color: '#666' }}>Profit Margin</div>
                                <div style={{ fontSize: '20px', fontWeight: 'bold', color: data.netProfit >= 0 ? '#4caf50' : '#f44336' }}>
                                    {((data.netProfit / (data.sales || 1)) * 100).toFixed(1)}%
                                </div>
                            </div>
                        </div>
                    </Card>

                </div>

                {/* Top Entities Table */}
                <Card style={{ padding: '0', overflow: 'hidden' }}>
                    <div style={{ padding: '20px', borderBottom: '1px solid #eee' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 'bold' }}>Top Customers (Period Volume)</h3>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '400px', fontSize: '14px' }}>
                            <thead>
                                <tr style={{ background: '#f8f9fa', color: '#666', borderBottom: '1px solid #eee' }}>
                                    <th style={{ padding: '12px 20px', textAlign: 'left', fontWeight: '600' }}>Name</th>
                                    <th style={{ padding: '12px 20px', textAlign: 'right', fontWeight: '600' }}>Volume</th>
                                    <th style={{ padding: '12px 20px', textAlign: 'center', fontWeight: '600' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.topEntities.map((item, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                                        <td style={{ padding: '12px 20px', fontWeight: '500' }}>{item.name}</td>
                                        <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(item.volume)}</td>
                                        <td style={{ padding: '12px 20px', textAlign: 'center' }}>
                                            <span style={{ fontSize: '12px', color: '#3f51b5', background: '#e8eaf6', padding: '4px 8px', borderRadius: '4px' }}>
                                                VIEW
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {data.topEntities.length === 0 && (
                                    <tr>
                                        <td colSpan="3" style={{ padding: '32px', textAlign: 'center', color: '#999' }}>No sales data found for this period</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>

            </div>
        </div>
    );
};

export default Analytics;
