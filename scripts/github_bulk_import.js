import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const APIFY_TOKEN = process.env.VITE_APIFY_TOKEN;

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fetchProfileDataFast(handle) {
  try {
    const response = await fetch(`https://www.instagram.com/${handle}/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const html = await response.text();
    const nameMatch = html.match(/"name":"([^"]+)"/);
    const followerMatch = html.match(/"edge_followed_by":\{"count":(\d+)\}/) || html.match(/meta content="([^"]+) Followers/);
    
    let followers = '—';
    if (followerMatch && followerMatch[1]) {
      const num = parseInt(followerMatch[1].replace(/,/g, ''));
      if (!isNaN(num)) {
        if (num >= 1000000) followers = (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
        else if (num >= 1000) followers = (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
        else followers = num.toString();
      }
    }
    return { name: nameMatch ? nameMatch[1] : handle, followers };
  } catch (e) {
    return { name: handle, followers: '—' };
  }
}

async function triggerApifyScraper(reelUrls) {
  const runResponse = await fetch(`https://api.apify.com/v2/acts/apify~instagram-scraper/runs?token=${APIFY_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      directUrls: reelUrls,
      resultsType: 'posts',
      resultsLimit: 1
    })
  });
  
  if (!runResponse.ok) {
    const errorText = await runResponse.text();
    throw new Error(`Apify trigger failed: ${errorText}`);
  }
  
  const runData = await runResponse.json();
  const runId = runData.data.id;
  const datasetId = runData.data.defaultDatasetId;
  
  console.log(`⏳ Apify run started: ${runId}. Waiting...`);
  
  while (true) {
    await delay(5000);
    const statusResponse = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
    const statusData = await statusResponse.json();
    const status = statusData.data.status;
    if (status === 'SUCCEEDED') break;
    if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
      throw new Error(`Apify run failed with status: ${status}`);
    }
  }
  
  const datasetResponse = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`);
  return await datasetResponse.json();
}

function downloadVideo(url, outputPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => {
      fs.unlink(outputPath, () => reject(err));
    });
  });
}

function extractShortcode(url) {
  if (!url) return null;
  const match = url.match(/(?:reel|p)\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}

async function main() {
  const tsvPath = path.join(__dirname, 'new_creators.tsv');
  const creatorsPath = path.join(__dirname, '../src/app/data/creators.json');
  const videosDir = path.join(__dirname, '../public/videos');
  
  const tsvContent = fs.readFileSync(tsvPath, 'utf-8');
  const lines = tsvContent.split('\n').filter(l => l.trim() !== '');
  
  let existing = [];
  try {
    existing = JSON.parse(fs.readFileSync(creatorsPath, 'utf-8'));
  } catch (e) {}
  
  const existingHandlesWithVideo = existing.filter(c => c.reels && c.reels.length > 0 && c.reels[0].videoUrl).map(c => c.handle.toLowerCase().replace('@', ''));
  
  existing = existing.filter(c => existingHandlesWithVideo.includes(c.handle.toLowerCase().replace('@', '')) || c.handle.toLowerCase().replace('@', '') === 'aadrikaa_acharya' || c.handle.toLowerCase().replace('@', '') === 'batchu_aishwarya');
  
  const toScrape = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t').map(s => s.trim().replace(/^\"|\"$/g, ''));
    if (cols.length < 5) continue;
    
    let offset = 0;
    if (cols[0].match(/^\d{4}-\d{2}-\d{2}/)) offset = 1;
    
    const profileUrl = cols[offset + 6];
    let videoUrl = cols[offset + 8];
    if (!profileUrl) continue;
    
    const handleMatch = profileUrl.match(/instagram\.com\/([A-Za-z0-9_.-]+)/);
    if (!handleMatch) continue;
    
    const handle = handleMatch[1].toLowerCase();
    if (handle === 'aadrikaa_acharya' || handle === 'batchu_aishwarya') continue;
    if (existingHandlesWithVideo.includes(handle)) continue;
    
    if (videoUrl) {
      const pureUrlMatch = videoUrl.match(/https:\/\/(www\.)?instagram\.com\/(?:reel|p)\/[A-Za-z0-9_-]+/);
      if (pureUrlMatch) {
         videoUrl = pureUrlMatch[0];
      } else {
         continue; // Not an instagram URL
      }
    } else {
      continue;
    }
    
    toScrape.push({
      handle, profileUrl, videoUrl,
      niches: cols[offset + 5].split(',').map(n => n.trim())
    });
  }
  
  console.log(`📋 Found ${toScrape.length} new creators to fetch.`);
  if (toScrape.length === 0) {
     fs.writeFileSync(creatorsPath, JSON.stringify(existing, null, 2));
     return;
  }
  
  const BATCH_SIZE = 10;
  for (let i = 0; i < toScrape.length; i += BATCH_SIZE) {
    const batch = toScrape.slice(i, i + BATCH_SIZE);
    console.log(`\n======================================================`);
    console.log(`🔄 Processing Batch ${i/BATCH_SIZE + 1} of ${Math.ceil(toScrape.length / BATCH_SIZE)} (${batch.length} profiles)...`);
    
    const reelUrls = batch.map(c => c.videoUrl).filter(Boolean);
    
    try {
      const apifyResults = reelUrls.length > 0 ? await triggerApifyScraper(reelUrls) : [];
      
      for (const creator of batch) {
        console.log(`\n👤 Fetching profile for ${creator.handle}...`);
        const profileInfo = await fetchProfileDataFast(creator.handle);
        
        let localVideoFileName = null;
        const targetShortcode = extractShortcode(creator.videoUrl);
        
        const apifyData = apifyResults.find(r => r.shortCode === targetShortcode || (r.url && r.url.includes(targetShortcode)));
        
        if (apifyData && apifyData.videoUrl) {
          localVideoFileName = `reel_${apifyData.shortCode}.mp4`;
          const outputPath = path.join(videosDir, localVideoFileName);
          if (!fs.existsSync(outputPath)) {
            console.log(`📥 Downloading video for ${creator.handle}...`);
            await downloadVideo(apifyData.videoUrl, outputPath);
          } else {
            console.log(`✅ Video already downloaded for ${creator.handle}`);
          }
        } else {
          console.log(`⚠️ No raw video URL found for ${creator.handle} from Apify.`);
        }
        
        const newCreator = {
          id: `creator_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          name: profileInfo.name || creator.handle,
          handle: creator.handle,
          profileUrl: creator.profileUrl,
          followers: profileInfo.followers,
          niches: creator.niches,
          reels: localVideoFileName ? [{
            id: `reel_${apifyData?.shortCode || Date.now()}`,
            label: "Demo Reel",
            videoUrl: localVideoFileName,
            coverUrl: apifyData?.displayUrl || ""
          }] : []
        };
        
        existing.push(newCreator);
        fs.writeFileSync(creatorsPath, JSON.stringify(existing, null, 2));
        console.log(`✅ Saved ${creator.handle} to creators.json`);
      }
    } catch (e) {
      console.error(`❌ Batch failed:`, e);
    }
  }
  
  console.log(`\n🎉 All batches complete! The github setup is ready.`);
}
main().catch(console.error);
