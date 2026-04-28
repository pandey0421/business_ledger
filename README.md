# Karobar Khata (Digital Ledger & Business Accounts App)

Karobar Khata is a comprehensive, offline-first digital ledger application designed specifically for small and medium businesses, shopkeepers, and vendors. It replaces traditional paper-based *Khata* (account books) with a smart, secure, and robust digital solution. 

The application streamlines daily business operations by managing customers, suppliers, inventory, expenses, and providing deep business analytics—all while keeping your data securely backed up on the cloud with Supabase.

---

## 🚀 Core Features & Functionalities

### 1. Dashboard & Quick Overview
The Dashboard serves as the central command center for the business owner.
- **Quick Action Cards:** Instantly jump into managing Customers, Suppliers, Expenses, Inventory, or the Recycle Bin.
- **Summary Metrics:** At-a-glance view of your business status.
- **Smart Navigation:** Fully responsive sidebar/hamburger menu for seamless access across mobile and desktop devices.
- **Data Protection:** Includes an inactivity timer that automatically logs the user out after a period of idleness to protect sensitive financial data.

### 2. Customer Ledger (Accounts Receivable & Sales)
A detailed module to track all sales and money owed by customers.
- **Customer Profiles:** Maintain a list of all your clients with their contact details and customized profile pages.
- **Double Entry System:** Record both **Sales** (Debit) and **Payments** (Credit) for each customer.
- **Smart Sale Builder:** Instead of just entering a flat amount, you can build a sale by selecting items directly from your **Inventory**. The system auto-calculates total costs, selling prices, and profit margins for that specific transaction.
- **Real-Time Running Balance:** Every transaction strictly updates the customer's chronological running balance.
- **PDF Ledger Generation:** One-click generation of professional ledger statements (in PDF format) for a specific date range, perfect for sharing with customers for pending collections.

### 3. Supplier Ledger (Accounts Payable & Purchases)
Manage your vendors and track how much money your business owes.
- **Supplier Profiles:** Keep track of all wholesalers and distributors.
- **Purchase & Payment Tracking:** Log every stock purchase (Credit) and every payment made to the supplier (Debit).
- **Automated Balances:** Instantly see your total outstanding payables across all suppliers.
- **Ledger Export:** Print or download PDF statements of your accounts with suppliers for reconciliation.

### 4. Inventory Management (Stock Control)
A dedicated stock keeping module that tightly integrates with your sales.
- **Track Products:** Add products with Name, Unit (pcs, kg, etc.), Cost Price (CP), and Selling Price (SP).
- **Live Stock Levels:** Quantity is automatically deducted when a sale is made through the Customer Ledger's Smart Sale Builder.
- **Margin Previews:** Instantly see the exact percentage margin for each product based on the set CP and SP.
- **Stock Value:** The total monetary value of your current physical stock is continuously calculated and available in the Analytics dashboard.

### 5. Daily Expense Tracking
Keep a tight leash on operational costs.
- **Categorized Logging:** Record daily business expenses (rent, electricity, tea/snacks, transportation).
- **Profit Deduction:** Expenses are automatically factored into the Net Profit calculations in the Analytics module.

### 6. Advanced Business Analytics
A highly visual and data-rich module to gauge business health, featuring support for **Nepali Dates (BS)**.
- **Period-Based Filtering:** View analytics for a specific month, year, or custom date range.
- **Key Performance Indicators (KPIs):**
  - **Period Sales & Purchases:** Total revenue generated and stock bought.
  - **Money Collected:** Actual cash inflow during the period.
  - **Inventory Value:** The exact worth of goods currently sitting in the shop.
  - **Receivables & Payables:** Total money stuck in the market vs. total money owed to suppliers.
  - **Gross & Net Profit Calculation:** Calculated dynamically using real Cost Prices vs Selling Prices minus operational expenses.
- **Interactive Charts (Recharts):**
  - **Revenue & Profit Trend:** Area charts depicting month-over-month performance.
  - **Top Products:** Bar chart showing the most profitable items in your store.
  - **Inflow vs Outflow:** Pie chart analyzing the distribution of cash flow.
- **Valuable Customer Metrics:** Tables highlighting top customers by sales volume and top customers by profit margin.

### 7. Backup, Export & Restore
Never lose your business data again.
- **Cloud Sync:** As an offline-first app, data is cached locally using Dexie.js (IndexedDB) and synced to Supabase when the internet is restored.
- **Excel Backup (.xlsx):** Generate customizable Excel spreadsheets of all your Customers, Suppliers, Inventory, and Expenses with a single click.
- **Full JSON Export/Import:** Download the entire business database as a `.json` file. You can import this file later to restore your state across different devices or accounts seamlessly.

### 8. Recycle Bin (Soft Deletion)
- **Accident Prevention:** Instead of permanently wiping data, deleted ledger entries or profiles are moved to a Recycle Bin.
- **One-Click Restore:** Recover mistakenly deleted transactions along with their cascading effects on the running balance.

---

## 🔄 The General Workflow

1. **Setup Inventory:** The shopkeeper starts by adding their products, setting the Cost Price (CP) and Selling Price (SP).
2. **Add Parties:** Add regular Customers (who buy on credit) and Suppliers (who provide stock on credit).
3. **Daily Operations:**
   - When a customer buys items, go to the Customer Ledger, create a **Sale**, select items from the inventory dropdown. The stock reduces, and the customer's outstanding balance increases.
   - When the customer pays cash, log a **Payment**. The balance decreases.
   - Log daily operational costs in the **Expenses** tab.
4. **End of Month/Review:** 
   - Open **Analytics** to see the Gross Profit, Net Profit, and determine which products brought in the most money.
   - Use the **Customer Ledger** to generate a PDF account statement and send it via WhatsApp to customers who have high outstanding balances.
5. **Data Security:** Periodically use the **Backup & Restore** feature to download an Excel or JSON copy of the books for local safekeeping.

---

## 🛠 Technology Stack

- **Frontend Framework:** React + Vite
- **Styling:** Vanilla CSS / JavaScript inline styling with a premium "Glassmorphism" design aesthetic.
- **Backend/Database:** Supabase (PostgreSQL) with Row-Level Security (RLS).
- **Authentication:** Supabase Auth (email/password).
- **Offline-First:** Dexie.js (IndexedDB) with a custom sync queue that flushes to Supabase when online.
- **Icons:** Lucide React
- **Charts:** Recharts (for robust data visualization).
- **PDF Generation:** jsPDF & html2canvas.
- **Excel Generation:** xlsx (SheetJS).
- **Mobile Wrapper:** Capacitor JS (designed to be easily converted into an Android/iOS app).

---

*Built for precision. Designed for simplicity. Karobar Khata empowers small businesses to transit from pen and paper to a powerful digital ecosystem.*
