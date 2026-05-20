import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fluakqeloiirlcuxunva.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsdWFrcWVsb2lpcmxjdXh1bnZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMTI4NDMsImV4cCI6MjA5MDU4ODg0M30.vM7AXnX9xCvKHeakN2B8Z2Qf0fwheHEwVKAJ8nlej4o';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSchema() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .limit(1);
    
  console.log("Error:", error);
  console.log("Data:", data);
}

checkSchema();
