import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { execSync } from 'child_process';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const APIFY_TOKEN = process.env.VITE_APIFY_TOKEN;
const APIFY_ACTOR_ID = 'potent_sarod~instagram-supabase-pipeline';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function run() {
  console.log('🚀 Starting Perfect Bulk Import...');

  if (!APIFY_TOKEN) {
    console.error('❌ Missing VITE_APIFY_TOKEN in .env.local');
    process.exit(1);
  }

  // Read TSV
  const tsv = await fs.readFile(path.join(process.cwd(), 'scripts', 'new_creators.tsv'), 'utf-8');
  const lines = tsv.split('\n').filter(l => l.trim() && !l.includes('First Name\tLast Name'));
  
  const profileUrls = [];
  
  for (const line of lines) {
    const cols = line.split('\t');
    let offset = 0;
    // Check if first column is timestamp
    if (cols[0].match(/^\d{4}-\d{2}-\d{2}/)) offset = 1;
    
    // Column index 6 (relative to First Name) is the Instagram URL based on the TSV header
    let igUrl = cols[offset+6] || '';
    igUrl = igUrl.trim().toLowerCase();
    
    // Convert to strict https://www.instagram.com/username format
    if (igUrl.includes('instagram.com') || igUrl.includes('instagr.am')) {
      try {
        // Strip out query parameters
        const urlObj = new URL(igUrl.startsWith('http') ? igUrl : `https://${igUrl}`);
        const handle = urlObj.pathname.replace(/^\/+|\/+$/g, '').split('/')[0];
        if (handle) {
          profileUrls.push(`https://www.instagram.com/${handle}/`);
        }
      } catch (e) {
        // Fallback
        profileUrls.push(igUrl);
      }
    }
  }

  console.log(`📋 Found ${profileUrls.length} valid Instagram URLs in the TSV.`);
  
  if (profileUrls.length === 0) {
    console.log('Nothing to do!');
    return;
  }

  console.log('🚀 Triggering Apify Actor with all URLs in a single run...');
  
  // Read Supabase credentials to pass to Apify
  const envText = await fs.readFile(path.join(process.cwd(), '.env.local'), 'utf8');
  const supaUrlMatch = envText.match(/^VITE_SUPABASE_URL=(.*)$/m);
  const supaKeyMatch = envText.match(/^VITE_SUPABASE_ANON_KEY=(.*)$/m);

  const payload = {
    profileUrls,
    scrapeReels: true,
    scrapeImages: false,
    supabaseUrl: supaUrlMatch ? supaUrlMatch[1].trim() : '',
    supabaseKey: supaKeyMatch ? supaKeyMatch[1].trim() : ''
  };

  const res = await fetch(`https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/runs?token=${APIFY_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const runData = await res.json();
  
  if (!res.ok) {
    console.error('❌ Failed to trigger Apify:', runData);
    process.exit(1);
  }

  const runId = runData.data.id;
  console.log(`✅ Apify run started! Run ID: ${runId}`);
  console.log(`🔗 Watch live on Apify: https://console.apify.com/actors/runs/${runId}`);

  // Polling for completion
  console.log('⏳ Waiting for Apify to finish scraping (this may take a few minutes)...');
  let status = 'RUNNING';
  
  while (status === 'RUNNING' || status === 'READY' || status === 'STARTING') {
    await delay(5000);
    const statusRes = await fetch(`https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/runs/${runId}?token=${APIFY_TOKEN}`);
    const statusData = await statusRes.json();
    status = statusData.data.status;
    process.stdout.write(`\rCurrent status: ${status} `.padEnd(30));
  }
  
  console.log('\n');

  if (status === 'SUCCEEDED') {
    console.log('🎉 Apify run SUCCEEDED! All data pushed to Supabase.');
    console.log('🔄 Syncing Supabase data to frontend...');
    try {
      execSync('node scripts/sync_supabase_creators.js', { stdio: 'inherit' });
      console.log('✅ Frontend sync complete!');
    } catch (e) {
      console.error('❌ Failed to sync frontend:', e.message);
    }
  } else {
    console.error(`❌ Apify run finished with status: ${status}. Check Apify console for details.`);
  }
}

run().catch(console.error);
