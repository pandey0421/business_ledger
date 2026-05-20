import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fluakqeloiirlcuxunva.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsdWFrcWVsb2lpcmxjdXh1bnZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMTI4NDMsImV4cCI6MjA5MDU4ODg0M30.vM7AXnX9xCvKHeakN2B8Z2Qf0fwheHEwVKAJ8nlej4o';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testInsert() {
  const payload = {
    id: "test-id",
    n: "Test Product",
    u: "pcs",
    cp: 100,
    sp: 200,
    qty: 10,
    user_id: "test-user-id",
    is_deleted: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('products')
    .upsert(payload, { onConflict: 'id' })
    .select();

  if (error) {
    console.error("Supabase Error:", JSON.stringify(error, null, 2));
  } else {
    console.log("Success:", data);
  }
}

testInsert();
