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
  throw new Error(`Failed to fetch ${url} after ${retries} retries`);
}

async function downloadAndUploadReel(url) {
  const match = url.match(/(?:p|reel|reels)\/([A-Za-z0-9_-]+)/);
  if (!match) return null;
  const shortcode = match[1];

  const data = await fetchWithRetry(`https://${RAPID_API_HOST}/get_media_data.php?type=reel&reel_post_code_or_url=${encodeURIComponent(url)}`, {
    headers: { 'x-rapidapi-host': RAPID_API_HOST, 'x-rapidapi-key': RAPID_API_KEY }
  });

  let rawVideoUrl = null;
  if (data?.data?.items?.[0]?.video_versions?.[0]?.url) {
    rawVideoUrl = data.data.items[0].video_versions[0].url;
  } else if (data?.data?.video_versions?.[0]?.url) {
    rawVideoUrl = data.data.video_versions[0].url;
  }

  if (!rawVideoUrl) return null;

  const videoRes = await fetch(rawVideoUrl);
  if (!videoRes.ok) throw new Error(`Failed to download video file: ${videoRes.statusText}`);
  const arrayBuffer = await videoRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const filename = `reel_${shortcode}.mp4`;

  const { error } = await supabase.storage.from('videos').upload(filename, buffer, {
    contentType: 'video/mp4',
    upsert: true
  });
  if (error) throw new Error(`Supabase upload failed: ${error.message}`);
  
  return `${supabaseUrl}/storage/v1/object/public/videos/${filename}`;
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

async function run() {
  const tsvData = await fs.readFile(path.join(process.cwd(), 'scripts', 'new_creators.tsv'), 'utf-8');
  const lines = parseTSV(tsvData);
  
  const creatorsPath = path.join(process.cwd(), 'src', 'app', 'data', 'creators.json');
  let existingCreators = JSON.parse(await fs.readFile(creatorsPath, 'utf-8'));
  
  const incompleteCreators = [];
  const validCreators = [];

  for (let i = 1; i < lines.length; i++) {
    const columns = lines[i];
    if (columns.length < 5) continue; // skip empty rows
    
    let firstNameIdx = 0;
    if (columns[0] && columns[0].match(/^\d{4}-\d{2}-\d{2}/)) {
      firstNameIdx = 1; // skip date column
    }
    
    const firstName = columns[firstNameIdx]?.trim() || '';
    const lastName = columns[firstNameIdx+1]?.trim() || '';
    const name = `${firstName} ${lastName}`.trim();
    let instagram = columns[firstNameIdx+6]?.trim() || '';
    const reelsStr = columns[firstNameIdx+8]?.trim() || '';
    const niches = (columns[firstNameIdx+5] || '').split(',').map(n => n.trim()).filter(Boolean);
    
    if (!name || !instagram) continue;
    
    // Normalize handle for duplicate check
    let handle = instagram.split('instagram.com/')[1]?.split('/')[0]?.split('?')[0] || '';
    handle = handle.replace(/[@]/g, '');
    
    if (existingCreators.some(c => c.handle.toLowerCase() === handle.toLowerCase())) {
      console.log(`Skipping duplicate: ${name} (${handle})`);
      continue;
    }
    
    const reelUrls = reelsStr.split(/[\n, ]+/).filter(u => u.includes('instagram.com/reel') || u.includes('instagram.com/p'));
    
    if (reelUrls.length < 1 || reelUrls.length > 2) {
      incompleteCreators.push({
        name,
        instagram,
        reason: `Has ${reelUrls.length} reels (required 1 or 2)`,
        rawReels: reelsStr
      });
      continue;
    }
    
    validCreators.push({
      name,
      instagram,
      niches,
      reelUrls
    });
  }
  
  let mdContent = '# Incomplete Creators\n\nThese creators either had 0 reels, or more than 2 reels, or were missing critical data.\n\n';
  incompleteCreators.forEach(c => {
    mdContent += `### ${c.name}\n- **Instagram**: ${c.instagram}\n- **Reason**: ${c.reason}\n- **Raw Reels Data**: \n\`\`\`\n${c.rawReels}\n\`\`\`\n\n`;
  });
  await fs.writeFile(path.join(process.cwd(), 'incomplete_creators.md'), mdContent);
  console.log(`Saved ${incompleteCreators.length} incomplete creators to incomplete_creators.md`);
  
  console.log(`Processing ${validCreators.length} valid creators...`);
  
  for (const vc of validCreators) {
    console.log(`Processing ${vc.name}...`);
    let username = vc.instagram.split('instagram.com/')[1]?.split('/')[0]?.split('?')[0] || '';
    username = username.replace(/[@]/g, '');

    const finalReels = [];
    for (let j = 0; j < vc.reelUrls.length; j++) {
      const url = vc.reelUrls[j];
      let videoPath = url;
      try {
        const path = await downloadAndUploadReel(url);
        if (path) videoPath = path;
      } catch (err) {
        console.error(`Failed to download reel for ${vc.name}:`, err.message);
      }
      finalReels.push({
        id: `reel_${Date.now()}_${j}`,
        label: `Demo Reel ${j+1}`,
        videoUrl: videoPath
      });
      await delay(1000); 
    }
    
    const creatorObj = {
      id: `creator_${Date.now()}`,
      name: vc.name,
      handle: username,
      profileUrl: vc.instagram,
      followers: '10K',
      avgViews: '10K',
      engagementRate: '',
      niches: vc.niches,
      reels: finalReels
    };
    
    existingCreators.unshift(creatorObj);
    
    await fs.writeFile(creatorsPath, JSON.stringify(existingCreators, null, 2));
  }
  
  console.log('All valid creators processed and appended!');
}

run().catch(console.error);
