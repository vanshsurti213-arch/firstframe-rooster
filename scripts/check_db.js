import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('creators').insert([{
    id: 'test_write',
    name: 'test',
    handle: 'test',
    profileUrl: 'test',
    followers: '1',
    avgViews: '1',
    niches: [],
    reels: []
  }]).select();

  if (error) {
    console.error('DB not writable:', error.message);
    process.exit(1);
  } else {
    console.log('DB writable!');
    // cleanup
    await supabase.from('creators').delete().eq('id', 'test_write');
    process.exit(0);
  }
}

check();
