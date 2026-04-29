import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://fluakqeloiirlcuxunva.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsdWFrcWVsb2lpcmxjdXh1bnZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMTI4NDMsImV4cCI6MjA5MDU4ODg0M30.vM7AXnX9xCvKHeakN2B8Z2Qf0fwheHEwVKAJ8nlej4o');

async function check() {
  const payload = {
    id: "00000000-0000-0000-0000-000000000009",
    customer_id: "00000000-0000-0000-0000-000000000002",
    user_id: "00000000-0000-0000-0000-000000000003",
    type: "payment",
    is_deleted: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  const { data, error } = await supabase.from('customer_ledger').upsert(payload, { onConflict: 'id' });
  console.log("Upsert Error for payment:", error);
}

check();
