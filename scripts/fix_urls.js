import fs from 'fs/promises';
import path from 'path';

const supabaseUrl = 'https://mindjesryiezcwtgospx.supabase.co';

async function fix() {
  const file = path.join(process.cwd(), 'src', 'app', 'data', 'creators.json');
  const data = JSON.parse(await fs.readFile(file, 'utf-8'));
  let fixed = 0;
  for (let c of data) {
     if (c.reels && c.reels.length > 0 && c.reels[0].videoUrl.includes('instagram.com')) {
       const url = c.reels[0].videoUrl;
       const match = url.match(/(?:p|reel|reels)\/([A-Za-z0-9_-]+)/);
       if (match) {
         const shortcode = match[1];
         const expectedUrl = `${supabaseUrl}/storage/v1/object/public/videos/reel_${shortcode}.mp4`;
         try {
           const headRes = await fetch(expectedUrl, { method: 'HEAD' });
           if (headRes.ok && headRes.headers.get('content-type')?.includes('video')) {
              c.reels[0].videoUrl = expectedUrl;
              console.log(`Fixed ${c.name} -> ${expectedUrl}`);
              fixed++;
           }
         } catch(e){}
       }
     }
  }
  await fs.writeFile(file, JSON.stringify(data, null, 2));
  console.log(`Fixed ${fixed} creators!`);
}
fix();
