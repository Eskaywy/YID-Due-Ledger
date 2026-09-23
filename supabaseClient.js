import { createClient } from '@supabase/supabase-js';

// Retrieve the environment variables
const supabaseUrl = process.env.SUPABASE_URL; 
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Initialize the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// A simple function to test the connection
async function testConnection() {
  const { data, error } = await supabase.from('your_table_name').select('*').limit(1);
  
  if (error) {
    console.error("Connection failed:", error.message);
  } else {
    console.log("Connected successfully! Here is your data:", data);
  }
}

testConnection();