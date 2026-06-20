import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function wipe() {
  console.log('🗑️ Wiping instagram_creators table...');
  
  // We need to fetch all IDs first because Supabase doesn't allow unqualified deletes
  const { data, error: fetchError } = await supabase.from('instagram_creators').select('id');
  if (fetchError) {
    console.error('Failed to fetch creators:', fetchError);
    return;
  }
  
  if (data && data.length > 0) {
    const ids = data.map(r => r.id);
    const { error: deleteError } = await supabase.from('instagram_creators').delete().in('id', ids);
    if (deleteError) {
      console.error('Failed to delete creators:', deleteError);
      return;
    }
    console.log(`✅ Deleted ${data.length} creators from database.`);
  } else {
    console.log('Database already empty.');
  }
}

wipe();
