const fs = require('fs');
const https = require('https');
const { execSync } = require('child_process');
require('dotenv').config({ path: '.env.local' });

async function fixRiddhiimaa() {
  const data = JSON.parse(fs.readFileSync('src/app/data/creators.json', 'utf8'));
  const c = data.find(c => c.handle === '__.riddhiimaa._');
  
  const shortcode = 'DTkh-fRguzc';
  const url = 'https://www.instagram.com/p/' + shortcode + '/';
  const token = process.env.VITE_APIFY_TOKEN;
  
  if (!token) {
    console.error('Error: VITE_APIFY_TOKEN is missing in .env.local');
    return;
  }
  
  console.log('Fetching Apify for', url);
  const input = {
    directUrls: [url],
    resultsType: 'posts',
    resultsLimit: 1,
    searchType: 'hashtag',
    searchLimit: 1
  };
  
  const cmd = `npx -y apify-cli call apify/instagram-scraper --token ${token} --input='${JSON.stringify(input)}'`;
  console.log('Executing apify call...');
  try {
    const output = execSync(cmd).toString();
    console.log(output);
    
    // Read the result dataset
    const runsUrl = `https://api.apify.com/v2/actor-runs?token=${token}&desc=true&limit=1`;
    const runsRes = await fetch(runsUrl);
    const runs = await runsRes.json();
    const latestRun = runs.data.items[0].id;
    const datasetUrl = `https://api.apify.com/v2/actor-runs/${latestRun}/dataset/items?token=${token}`;
    
    const datasetRes = await fetch(datasetUrl);
    const dataset = await datasetRes.json();
    
    const item = dataset[0];
    if (item && item.videoUrl) {
      console.log('Got videoUrl:', item.videoUrl);
      const filename = 'reel_' + shortcode + '.mp4';
      const filepath = 'public/videos/' + filename;
      
      console.log('Downloading to', filepath);
      await new Promise((resolve, reject) => {
        https.get(item.videoUrl, (res) => {
          if (res.statusCode !== 200) return reject('Status ' + res.statusCode);
          const f = fs.createWriteStream(filepath);
          res.pipe(f);
          f.on('finish', () => resolve());
          f.on('error', reject);
        }).on('error', reject);
      });
      
      console.log('Download complete.');
      c.reels[0].videoUrl = filename;
      if (item.displayUrl) c.reels[0].coverUrl = item.displayUrl;
      
      fs.writeFileSync('src/app/data/creators.json', JSON.stringify(data, null, 2));
      console.log('Updated creators.json');
    } else {
      console.log('No video URL found in dataset.');
    }
  } catch(e) {
    console.error('Error:', e.message);
  }
}
fixRiddhiimaa();
