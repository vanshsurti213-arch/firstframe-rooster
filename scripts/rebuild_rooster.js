import fs from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const RAPID_API_KEY = process.env.VITE_RAPID_API_KEY;
const RAPID_API_HOST = process.env.VITE_RAPID_API_HOST || 'instagram-scraper-stable-api.p.rapidapi.com';

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
  // If it's NOT an Instagram link (like Canva or Google Drive), just return it directly!
  if (!url.includes('instagram.com/reel/') && !url.includes('instagram.com/p/')) {
    console.log(`Non-Instagram URL detected, skipping download: ${url}`);
    return url;
  }

  const match = url.match(/(?:p|reel|reels)\/([A-Za-z0-9_-]+)/);
  if (!match) return url;
  
  const shortcode = match[1];
  const filename = `reel_${shortcode}.mp4`;
  const expectedUrl = `${supabaseUrl}/storage/v1/object/public/videos/${filename}`;

  try {
    const headRes = await fetch(expectedUrl, { method: 'HEAD' });
    if (headRes.ok && headRes.headers.get('content-type')?.includes('video')) {
      console.log(`Already in Supabase: ${filename}`);
      return expectedUrl;
    }
  } catch (e) {}

  console.log(`Downloading from Instagram: ${url}`);
  const data = await fetchWithRetry(`https://${RAPID_API_HOST}/get_media_data.php?type=reel&reel_post_code_or_url=${encodeURIComponent(url)}`, {
    headers: { 'x-rapidapi-host': RAPID_API_HOST, 'x-rapidapi-key': RAPID_API_KEY }
  });

  if (data?.message === "You are not subscribed to this API.") {
     throw new Error("API KEY NOT SUBSCRIBED");
  }

  let rawVideoUrl = null;
  if (data?.video_url) {
    rawVideoUrl = data.video_url;
  } else if (data?.data?.items?.[0]?.video_versions?.[0]?.url) {
    rawVideoUrl = data.data.items[0].video_versions[0].url;
  } else if (data?.data?.video_versions?.[0]?.url) {
    rawVideoUrl = data.data.video_versions[0].url;
  }

  if (!rawVideoUrl) {
    console.log(`Failed to get raw video URL for ${shortcode}`);
    return url; // fallback to original URL
  }

  console.log(`Uploading to Supabase: ${filename}`);
  const videoRes = await fetch(rawVideoUrl);
  if (!videoRes.ok) {
    console.log(`Failed to download raw video file: ${videoRes.statusText}`);
    return url; // fallback
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

function parseTSV(tsv) {
  let rows = [];
  let cols = [];
  let cur = '';
  let inQuote = false;
  for(let i=0; i<tsv.length; i++) {
    let char = tsv[i];
    if (inQuote) {
      if (char === '"') {
        if (tsv[i+1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuote = false;
        }
      } else {
        cur += char;
      }
    } else {
      if (char === '"') {
        inQuote = true;
      } else if (char === '\t') {
        cols.push(cur);
        cur = '';
      } else if (char === '\n') {
        cols.push(cur);
        rows.push(cols);
        cols = [];
        cur = '';
      } else if (char === '\r') {
        // ignore
      } else {
        cur += char;
      }
    }
  }
  if (cols.length > 0 || cur !== '') {
    cols.push(cur);
    rows.push(cols);
  }
  return rows;
}

function normalizeName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function run() {
  const tsvData = await fs.readFile(path.join(process.cwd(), 'scripts', 'new_creators.tsv'), 'utf-8');
  const lines = parseTSV(tsvData);
  
  const oldCreatorsPath = path.join(process.cwd(), 'src', 'app', 'data', 'creators.json');
  let oldCreators = [];
  try {
    oldCreators = JSON.parse(await fs.readFile(oldCreatorsPath, 'utf-8'));
  } catch (e) {}

  const finalCreatorsList = [];
  const seenHandles = new Set();
  
  // Read local video files directly from public directory
  const localVideosPath = path.join(process.cwd(), 'public', 'videos');
  let localVideos = [];
  try {
     localVideos = (await fs.readdir(localVideosPath)).filter(f => f.endsWith('.mp4') || f.endsWith('.MOV') || f.endsWith('.MP4'));
  } catch(e) {}

  let totalDownloaded = 0;

  for (let i = 1; i < lines.length; i++) {
    const columns = lines[i];
    if (columns.length < 5) continue; 
    
    let firstNameIdx = 0;
    if (columns[0] && columns[0].match(/^\d{4}-\d{2}-\d{2}/)) {
      firstNameIdx = 1; 
    }
    
    const firstName = columns[firstNameIdx]?.trim() || '';
    const lastName = columns[firstNameIdx+1]?.trim() || '';
    const name = `${firstName} ${lastName}`.trim();
    let instagram = columns[firstNameIdx+6]?.trim() || '';
    const reelsStr = columns[firstNameIdx+8]?.trim() || '';
    const niches = (columns[firstNameIdx+5] || '').split(',').map(n => n.trim()).filter(Boolean);
    
    if (!name || !instagram) continue;
    
    let handle = instagram.split('instagram.com/')[1]?.split('/')[0]?.split('?')[0] || '';
    handle = handle.replace(/[@]/g, '');
    if (!handle) handle = name.replace(/\s+/g, '').toLowerCase();

    if (seenHandles.has(handle.toLowerCase())) {
      continue;
    }
    seenHandles.add(handle.toLowerCase());
    
    const rawReels = reelsStr.split(/[\n, ]+/).filter(u => u.includes('http')); 
    
    console.log(`\n============================\nProcessing ${name} (${handle})... found ${rawReels.length} links`);
    
    let finalReels = [];

    // Keep oldMatch so we can preserve followers and avgViews
    const oldMatch = oldCreators.find(c => 
      c.handle.toLowerCase() === handle.toLowerCase() || 
      normalizeName(c.name) === normalizeName(name)
    );

    // MUST process raw URLs! Only the FIRST link!
    if (rawReels.length > 0) {
      const url = rawReels[0];
      try {
         const processedUrl = await downloadAndUploadReel(url);
         // Even if it fails, we keep the processedUrl (which will be the original URL)
         // but if they provide a working key, it will be the supabase URL
         finalReels.push({
           id: `reel_${handle}_${Date.now()}_0`,
           label: `Demo Reel 1`,
           videoUrl: processedUrl,
           views: oldMatch?.avgViews || '10K'
         });
         if (processedUrl !== url) totalDownloaded++;
      } catch(e) {
         console.log("FATAL:", e.message);
         process.exit(1);
      }
    }

    finalCreatorsList.push({
      id: `creator_${handle}_${Date.now()}`,
      name: name,
      handle: handle,
      profileUrl: instagram,
      followers: oldMatch?.followers || '10K',
      avgViews: oldMatch?.avgViews || '10K',
      engagementRate: oldMatch?.engagementRate || '',
      niches: niches.length ? niches : (oldMatch?.niches || ['Lifestyle']),
      reels: finalReels
    });
    
    // Incrementally save
    await fs.writeFile(oldCreatorsPath, JSON.stringify(finalCreatorsList, null, 2));
  }
  
  console.log(`\nDone! Successfully updated ${finalCreatorsList.length} creators.`);
  console.log(`Downloaded ${totalDownloaded} new native videos!`);
}

run().catch(console.error);
