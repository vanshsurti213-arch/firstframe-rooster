import fs from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const videosDir = path.join(process.cwd(), 'public', 'videos');
  const files = await fs.readdir(videosDir);
  
  for (const file of files) {
    if (!file.endsWith('.mp4')) continue;
    
    // Check if it already exists
    const { data: existing } = await supabase.storage.from('videos').list('', { search: file });
    if (existing && existing.length > 0) {
      console.log(`Skipping ${file}, already uploaded.`);
      continue;
    }
    
    console.log(`Uploading ${file}...`);
    const buffer = await fs.readFile(path.join(videosDir, file));
    const { error } = await supabase.storage.from('videos').upload(file, buffer, {
      contentType: 'video/mp4',
      upsert: true
    });
    
    if (error) {
      console.error(`Failed to upload ${file}:`, error.message);
    } else {
      console.log(`Successfully uploaded ${file}!`);
    }
  }
  
  // Now modify creators.json to point to Supabase URLs!
  console.log('Modifying creators.json to use Supabase URLs...');
  const creatorsPath = path.join(process.cwd(), 'src', 'app', 'data', 'creators.json');
  let creators = JSON.parse(await fs.readFile(creatorsPath, 'utf-8'));
  
  let modified = false;
  for (const creator of creators) {
    for (const reel of creator.reels) {
      if (reel.videoUrl && reel.videoUrl.startsWith('/videos/')) {
        const filename = reel.videoUrl.replace('/videos/', '');
        reel.videoUrl = `${supabaseUrl}/storage/v1/object/public/videos/${filename}`;
        modified = true;
      }
    }
  }
  
  if (modified) {
    await fs.writeFile(creatorsPath, JSON.stringify(creators, null, 2));
    console.log('creators.json updated to use Cloud URLs!');
  }
  
  console.log('Done!');
}

run().catch(console.error);
