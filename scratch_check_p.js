import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://fluakqeloiirlcuxunva.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsdWFrcWVsb2lpcmxjdXh1bnZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMTI4NDMsImV4cCI6MjA5MDU4ODg0M30.vM7AXnX9xCvKHeakN2B8Z2Qf0fwheHEwVKAJ8nlej4o');

async function check() {
  const { data, error } = await supabase.from('customer_ledger').select('p').limit(1);
  console.log("p column Error:", error);
}

check();
