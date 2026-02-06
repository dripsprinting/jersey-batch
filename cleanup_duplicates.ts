
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanup() {
  const { data: customers, error } = await supabase
    .from('customers')
    .select('id, team_name')
    .eq('team_name', 'CHRISTINE CABANES');

  if (error) {
    console.error(error);
    return;
  }

  console.log("Found customers:", customers);
  
  if (customers.length > 1) {
    // Keep the first one, delete the rest
    const toDelete = customers.slice(1).map(c => c.id);
    const { error: delError } = await supabase
      .from('customers')
      .delete()
      .in('id', toDelete);
    
    if (delError) console.error("Error deleting:", delError);
    else console.log("Deleted duplicates:", toDelete);
  } else {
    console.log("No duplicates found with that specific name.");
  }
}

cleanup();
