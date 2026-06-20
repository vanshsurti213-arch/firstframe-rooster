import fs from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const RAPID_API_KEY = '05bec68e97mshc1c383e8e340578p1bb939jsn750a6dfabc5b';
const RAPID_API_HOST = 'instagram-scraper-stable-api.p.rapidapi.com';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url, options, retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.status === 429) {
        console.log(`Rate limited. Waiting 10s...`);
        await delay(10000);
        continue;
      }
      return await res.json();
    } catch (err) {
      console.log(`Fetch error: ${err.message}. Retrying in 5s...`);
      await delay(5000);
    }
  }
  return null;
}

async function downloadAndUploadReel(url) {
  if (!url.includes('instagram.com/reel/') && !url.includes('instagram.com/p/')) {
    return url;
  }
  const match = url.match(/(?:p|reel|reels)\/([A-Za-z0-9_-]+)/);
  if (!match) return url;
  const shortcode = match[1];
  const filename = `reel_${shortcode}.mp4`;
  const expectedUrl = `${supabaseUrl}/storage/v1/object/public/videos/${filename}`;

  console.log(`Downloading from Instagram: ${url}`);
  const data = await fetchWithRetry(`https://${RAPID_API_HOST}/get_media_data.php?type=reel&reel_post_code_or_url=${encodeURIComponent(url)}`, {
    headers: { 'x-rapidapi-host': RAPID_API_HOST, 'x-rapidapi-key': RAPID_API_KEY }
  });

  let rawVideoUrl = null;
  if (data?.video_url) rawVideoUrl = data.video_url;
  else if (data?.data?.items?.[0]?.video_versions?.[0]?.url) rawVideoUrl = data.data.items[0].video_versions[0].url;
  else if (data?.data?.video_versions?.[0]?.url) rawVideoUrl = data.data.video_versions[0].url;

  if (!rawVideoUrl) {
    console.log(`Failed to get raw video URL for ${shortcode}`);
    return url; 
  }

  console.log(`Uploading to Supabase: ${filename}`);
  const videoRes = await fetch(rawVideoUrl);
  if (!videoRes.ok) {
    console.log(`Failed to download raw video file`);
    return url; 
  }
  
  const arrayBuffer = await videoRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error } = await supabase.storage.from('videos').upload(filename, buffer, {
    contentType: 'video/mp4',
    upsert: true
  });
  
  if (error) {
    console.log(`Supabase upload error: ${error.message}`);
    return url;
  }
  return expectedUrl;
}

async function run() {
  const creatorsPath = path.join(process.cwd(), 'src', 'app', 'data', 'creators.json');
  let data = JSON.parse(await fs.readFile(creatorsPath, 'utf-8'));
  
  for (let c of data) {
    if (c.reels && c.reels.length > 0 && c.reels[0].videoUrl.includes('instagram.com')) {
      console.log(`Retrying for ${c.name}...`);
      const newUrl = await downloadAndUploadReel(c.reels[0].videoUrl);
      if (newUrl !== c.reels[0].videoUrl) {
         c.reels[0].videoUrl = newUrl;
         console.log(`Success! ${newUrl}`);
         await fs.writeFile(creatorsPath, JSON.stringify(data, null, 2));
      } else {
         console.log(`Failed again for ${c.name}`);
      }
    }
  }
}
run();
