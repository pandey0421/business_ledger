import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fluakqeloiirlcuxunva.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsdWFrcWVsb2lpcmxjdXh1bnZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMTI4NDMsImV4cCI6MjA5MDU4ODg0M30.vM7AXnX9xCvKHeakN2B8Z2Qf0fwheHEwVKAJ8nlej4o';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testInsert() {
  const payload = {
    id: "123e4567-e89b-12d3-a456-426614174000",
    name: "Test",
    unit: "pcs",
    cost_price: 10,
    selling_price: 20,
    quantity: 5,
    user_id: "123e4567-e89b-12d3-a456-426614174000",
    is_deleted: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('products')
    .upsert(payload, { onConflict: 'id' })
    .select();

  console.log("Error:", JSON.stringify(error, null, 2));
}

testInsert();
