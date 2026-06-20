import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const creatorsFilePath = path.join(__dirname, '../src/app/data/creators.json');

function formatNumber(num) {
  if (!num) return '—';
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return num.toString();
}

async function syncCreators() {
  console.log('🔄 Connecting to Supabase...');
  
  const { data: dbRows, error } = await supabase
    .from('instagram_creators')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error("❌ Failed to fetch from Supabase:", error.message);
    process.exit(1);
  }

  console.log(`📦 Found ${dbRows.length} total posts across all creators in Supabase.`);

  // Load existing creators
  let creatorsData = [];
  if (fs.existsSync(creatorsFilePath)) {
    const rawData = fs.readFileSync(creatorsFilePath, 'utf-8');
    creatorsData = JSON.parse(rawData);
    if (!Array.isArray(creatorsData)) {
      creatorsData = creatorsData.creators || [];
    }
  }

  // Group dbRows by instagram_username
  const grouped = {};
  for (const row of dbRows) {
    const username = row.instagram_username;
    if (!grouped[username]) {
      grouped[username] = {
        username: username,
        full_name: row.full_name,
        profile_url: `https://www.instagram.com/${username}/`,
        followers_count: row.followers_count || 0,
        reels: []
      };
    }
    
    // Add reel
    const bestVideoUrl = row.original_video_url || row.storage_public_url || row.post_url;
    if (bestVideoUrl) {
      grouped[username].reels.push({
        id: `reel_${row.post_id || row.id}`,
        label: 'Demo Reel',
        videoUrl: bestVideoUrl,
        coverUrl: row.original_image_url || undefined
      });
    }
  }

  let added = 0;
  let updated = 0;

  for (const username in grouped) {
    const dbCreator = grouped[username];
    
    // Find if creator already exists in JSON (by handle or profileUrl)
    let existingCreator = creatorsData.find(c => 
      c.handle === username || 
      (c.profileUrl && c.profileUrl.toLowerCase().includes(username.toLowerCase()))
    );

    const formattedFollowers = formatNumber(dbCreator.followers_count);

    if (!existingCreator) {
      // Create new
      existingCreator = {
        id: `creator_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        name: dbCreator.full_name || username,
        handle: username,
        profileUrl: `https://www.instagram.com/${username}/`,
        followers: formattedFollowers,
        niches: [],
        reels: []
      };
      creatorsData.push(existingCreator);
      added++;
    } else {
      // Update basic info if missing or '—'
      if (!existingCreator.name || existingCreator.name === existingCreator.handle) {
        existingCreator.name = dbCreator.full_name || existingCreator.name;
      }
      if (existingCreator.followers === '—' && formattedFollowers !== '—') {
        existingCreator.followers = formattedFollowers;
      }
      updated++;
    }

    // Merge Reels
    const existingReelIds = existingCreator.reels.map(r => r.id);
    for (const reel of dbCreator.reels) {
      const idx = existingReelIds.indexOf(reel.id);
      if (idx === -1) {
        existingCreator.reels.push(reel);
        existingReelIds.push(reel.id);
      } else {
        existingCreator.reels[idx] = reel;
      }
    }
  }

  // Save back to JSON
  fs.writeFileSync(creatorsFilePath, JSON.stringify(creatorsData, null, 2), 'utf-8');
  console.log(`\n✅ Sync Complete!`);
  console.log(`   - Added ${added} new creators`);
  console.log(`   - Updated ${updated} existing creators`);
}

syncCreators().catch(console.error);
