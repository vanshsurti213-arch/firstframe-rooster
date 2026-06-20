import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { execSync } from 'child_process';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const APIFY_TOKEN = process.env.VITE_APIFY_TOKEN;
const APIFY_ACTOR_ID = 'potent_sarod~instagram-supabase-pipeline';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function run() {
  console.log('🚀 Starting Batched Bulk Import...');

  if (!APIFY_TOKEN) {
    console.error('❌ Missing VITE_APIFY_TOKEN in .env.local');
    process.exit(1);
  }

  // 1. Read TSV to get all URLs
  const tsv = await fs.readFile(path.join(process.cwd(), 'scripts', 'new_creators.tsv'), 'utf-8');
  const lines = tsv.split('\n').filter(l => l.trim() && !l.includes('First Name\tLast Name'));
  
  const allProfileUrls = [];
  
  for (const line of lines) {
    const cols = line.split('\t');
    let offset = 0;
    if (cols[0].match(/^\d{4}-\d{2}-\d{2}/)) offset = 1;
    
    let igUrl = cols[offset+6] || '';
    igUrl = igUrl.trim().toLowerCase();
    
    if (igUrl.includes('instagram.com') || igUrl.includes('instagr.am')) {
      try {
        const urlObj = new URL(igUrl.startsWith('http') ? igUrl : `https://${igUrl}`);
        const handle = urlObj.pathname.replace(/^\/+|\/+$/g, '').split('/')[0];
        if (handle) {
          allProfileUrls.push(`https://www.instagram.com/${handle}/`);
        }
      } catch (e) {
        allProfileUrls.push(igUrl);
      }
    }
  }

  console.log(`📋 Found ${allProfileUrls.length} total Instagram URLs in the TSV.`);

  // 2. Read existing creators to filter out ones we already successfully scraped
  const creatorsJsonPath = path.join(process.cwd(), 'src', 'app', 'data', 'creators.json');
  let existingCreators = [];
  try {
    const creatorsData = await fs.readFile(creatorsJsonPath, 'utf8');
    existingCreators = JSON.parse(creatorsData);
  } catch (e) {
    console.log('No existing creators.json found or invalid JSON.');
  }

  const existingHandles = new Set(existingCreators.map(c => c.handle.toLowerCase()));
  
  const pendingUrls = allProfileUrls.filter(url => {
    try {
      const handle = new URL(url).pathname.replace(/^\/+|\/+$/g, '').split('/')[0];
      return !existingHandles.has(handle.toLowerCase());
    } catch(e) {
      return true;
    }
  });

  console.log(`🎯 Remaining profiles to scrape: ${pendingUrls.length}`);
  if (pendingUrls.length === 0) {
    console.log('🎉 Everything is already scraped and synced!');
    return;
  }

  // 3. Split into batches of 10
  const BATCH_SIZE = 10;
  const batches = [];
  for (let i = 0; i < pendingUrls.length; i += BATCH_SIZE) {
    batches.push(pendingUrls.slice(i, i + BATCH_SIZE));
  }

  console.log(`📦 Split into ${batches.length} batch(es) of max ${BATCH_SIZE} profiles each to avoid timeouts.\n`);

  // Read Supabase credentials to pass to Apify
  const envText = await fs.readFile(path.join(process.cwd(), '.env.local'), 'utf8');
  const supaUrlMatch = envText.match(/^VITE_SUPABASE_URL=(.*)$/m);
  const supaKeyMatch = envText.match(/^VITE_SUPABASE_ANON_KEY=(.*)$/m);

  // 4. Process each batch sequentially
  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b];
    console.log(`\n======================================================`);
    console.log(`🔄 Processing Batch ${b + 1} of ${batches.length} (${batch.length} profiles)...`);
    console.log(`======================================================`);
    
    const payload = {
      profileUrls: batch,
      scrapeReels: true,
      scrapeImages: false,
      supabaseUrl: supaUrlMatch ? supaUrlMatch[1].trim() : '',
      supabaseKey: supaKeyMatch ? supaKeyMatch[1].trim() : ''
    };

    try {
      const res = await fetch(`https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/runs?token=${APIFY_TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const runData = await res.json();
      if (!res.ok) {
        console.error(`❌ Failed to trigger Apify for Batch ${b + 1}:`, runData);
        continue; // Try next batch
      }

      const runId = runData.data.id;
      console.log(`✅ Apify run started! Run ID: ${runId}`);
      console.log(`🔗 Watch live on Apify: https://console.apify.com/actors/runs/${runId}`);

      // Poll
      let status = 'RUNNING';
      while (status === 'RUNNING' || status === 'READY' || status === 'STARTING') {
        await delay(5000);
        const statusRes = await fetch(`https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/runs/${runId}?token=${APIFY_TOKEN}`);
        const statusData = await statusRes.json();
        status = statusData.data.status;
        process.stdout.write(`\rCurrent status: ${status} `.padEnd(30));
      }
      
      console.log('\n');

      if (status === 'SUCCEEDED' || status === 'ABORTED') {
        // Even if aborted, it might have saved some, so we sync.
        console.log(`🏁 Batch ${b + 1} finished with status: ${status}. Syncing...`);
        try {
          execSync('node scripts/sync_supabase_creators.js', { stdio: 'inherit' });
          console.log(`✅ Frontend sync complete for Batch ${b + 1}!`);
        } catch (e) {
          console.error(`❌ Failed to sync frontend:`, e.message);
        }
      } else {
        console.error(`❌ Apify run finished with status: ${status}.`);
      }

    } catch (e) {
      console.error(`❌ Error running Batch ${b + 1}:`, e);
    }
    
    // Optional delay between batches to cool down rate limits
    if (b < batches.length - 1) {
      console.log('⏳ Waiting 10 seconds before starting next batch...');
      await delay(10000);
    }
  }

  console.log('\n🎉 All batches complete! The dashboard should now contain all successfully scraped creators.');
}

run().catch(console.error);
