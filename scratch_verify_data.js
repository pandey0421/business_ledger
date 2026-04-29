import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://fluakqeloiirlcuxunva.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsdWFrcWVsb2lpcmxjdXh1bnZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMTI4NDMsImV4cCI6MjA5MDU4ODg0M30.vM7AXnX9xCvKHeakN2B8Z2Qf0fwheHEwVKAJ8nlej4o');

async function check() {
  // Check how many customer_ledger records exist in Supabase
  const { data: ledger, error: ledgerErr } = await supabase.from('customer_ledger').select('id, customer_id, type, amount, date').limit(10);
  console.log("=== CUSTOMER LEDGER IN SUPABASE ===");
  console.log("Error:", ledgerErr);
  console.log("Count:", ledger?.length || 0);
  if (ledger && ledger.length > 0) {
    console.log("Sample records:", JSON.stringify(ledger, null, 2));
  }

  // Check customers
  const { data: customers, error: custErr } = await supabase.from('customers').select('id, name, total_sales, total_balance');
  console.log("\n=== CUSTOMERS IN SUPABASE ===");
  console.log("Error:", custErr);
  console.log("Records:", JSON.stringify(customers, null, 2));
}

check();
