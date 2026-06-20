import fs from 'fs/promises';
import path from 'path';

const RAPID_API_KEY = 'adcbd29875msh866af6a0c5248dbp110dc2jsn4bfb2d518d7f';
const RAPID_API_HOST = 'instagram-scraper-stable-api.p.rapidapi.com';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url, options, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.status === 429) {
        console.log(`Rate limited. Waiting ${ (i+1) * 2 }s...`);
        await delay((i + 1) * 2000);
        continue;
      }
      return await res.json();
    } catch (err) {
      console.log(`Fetch error: ${err.message}. Retrying...`);
      await delay(2000);
    }
  }
  throw new Error(`Failed to fetch ${url} after ${retries} retries`);
}

async function getProfileInfo(profileUrl) {
  let username = profileUrl.split('instagram.com/')[1]?.split('/')[0]?.split('?')[0];
  if (!username) return null;
  username = username.replace(/[@]/g, '');
  
  const data = await fetchWithRetry(`https://${RAPID_API_HOST}/ig_get_fb_profile_hover.php?username_or_url=${username}`, {
    headers: {
      'x-rapidapi-host': RAPID_API_HOST,
      'x-rapidapi-key': RAPID_API_KEY
    }
  });
  
  if (data?.data?.user) {
    return {
      name: data.data.user.full_name || username,
      followers: formatNumber(data.data.user.follower_count),
      username
    };
  }
  return { name: username, followers: '1K', username };
}

function formatNumber(num) {
  if (!num) return '1K';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

async function downloadReel(url) {
  const match = url.match(/(?:p|reel|reels)\/([A-Za-z0-9_-]+)/);
  if (!match) return null;
  const shortcode = match[1];
  
  const data = await fetchWithRetry(`https://${RAPID_API_HOST}/get_media_data.php?type=reel&reel_post_code_or_url=https://www.instagram.com/p/${shortcode}/`, {
    headers: {
      'x-rapidapi-host': RAPID_API_HOST,
      'x-rapidapi-key': RAPID_API_KEY
    }
  });

  if (!data?.data?.video_versions?.[0]?.url) return null;
  
  const videoUrl = data.data.video_versions[0].url;
  const filename = `reel_${shortcode}.mp4`;
  const filepath = path.join(process.cwd(), 'public', 'videos', filename);
  
  try {
    await fs.access(filepath);
    return `/videos/${filename}`; // already exists
  } catch {}

  console.log(`Downloading ${filename}...`);
  const res = await fetch(videoUrl);
  const buffer = await res.arrayBuffer();
  await fs.writeFile(filepath, Buffer.from(buffer));
  return `/videos/${filename}`;
}

async function run() {
  const tsv = await fs.readFile('creators_data.tsv', 'utf-8');
  const lines = tsv.split('\n').filter(l => l.trim() && !l.includes('First Name\tLast Name'));
  
  const creatorsJsonPath = path.join(process.cwd(), 'src', 'app', 'data', 'creators.json');
  let creators = JSON.parse(await fs.readFile(creatorsJsonPath, 'utf-8'));
  
  for (const line of lines) {
    const cols = line.split('\t');
    // Handle timestamp offset
    let offset = 0;
    if (cols[0].match(/^\d{4}-\d{2}-\d{2}/)) offset = 1;
    
    const firstName = cols[offset+0]?.trim() || '';
    const lastName = cols[offset+1]?.trim() || '';
    const name = `${firstName} ${lastName}`.trim();
    if (!name) continue;
    
    const nicheStr = cols[offset+5] || '';
    const niches = nicheStr.split(',').map(n => n.trim()).filter(Boolean);
    
    const igUrl = cols[offset+6] || '';
    let reelsStr = cols[offset+8] || '';
    // Handle quotes around multiple URLs
    if (reelsStr.startsWith('"')) reelsStr = reelsStr.slice(1);
    if (reelsStr.endsWith('"')) reelsStr = reelsStr.slice(0, -1);
    
    const reelUrls = reelsStr.split(/[\n, ]+/).filter(u => u.includes('instagram.com/reel') || u.includes('instagram.com/p'));
    
    // Check if creator exists by name
    const existing = creators.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (existing && existing.reels.length >= reelUrls.length) {
      console.log(`Skipping ${name}, already processed.`);
      continue;
    }
    
    console.log(`Processing ${name}...`);
    let profile = await getProfileInfo(igUrl);
    await delay(1000); // Rate limit protection
    
    const finalReels = [];
    for (let i = 0; i < Math.min(reelUrls.length, 6); i++) {
      const url = reelUrls[i];
      let videoPath = url;
      try {
        const path = await downloadReel(url);
        if (path) videoPath = path;
      } catch (err) {
        console.error(`Failed to download reel for ${name}:`, err.message);
      }
      finalReels.push({
        id: `reel_${Date.now()}_${i}`,
        label: `Demo Reel ${i+1}`,
        videoUrl: videoPath
      });
      await delay(1500); // Rate limit protection
    }
    
    const creatorObj = {
      id: `creator_${Date.now()}`,
      name: profile?.name || name,
      handle: profile?.username || '',
      profileUrl: igUrl,
      followers: profile?.followers || '1K',
      avgViews: '10K', // Default since hover doesn't have it
      niches: niches,
      reels: finalReels
    };
    
    if (existing) {
      const idx = creators.findIndex(c => c.name === existing.name);
      creators[idx] = creatorObj;
    } else {
      creators.push(creatorObj);
    }
    
    // Save incrementally
    await fs.writeFile(creatorsJsonPath, JSON.stringify(creators, null, 2));
    console.log(`Saved ${name}.`);
  }
  
  console.log('Bulk import complete!');
}

run().catch(console.error);
