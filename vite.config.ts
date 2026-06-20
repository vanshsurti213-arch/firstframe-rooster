import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import { spawn } from 'child_process'
import https from 'node:https'
import http from 'node:http'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

function apiPlugin() {
  return {
    name: 'vite-api-endpoints',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/api/save-creators' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const creatorsPath = path.resolve(__dirname, 'src/app/data/creators.json');
              fs.writeFileSync(creatorsPath, body, 'utf8');
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true }));
            } catch (err) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        if (req.url === '/api/upload-video' && req.method === 'POST') {
          const filename = req.headers['x-filename'] as string;
          if (!filename) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing X-Filename header' }));
            return;
          }
          try {
            const dirPath = path.resolve(__dirname, 'public/videos');
            if (!fs.existsSync(dirPath)) {
              fs.mkdirSync(dirPath, { recursive: true });
            }
            const filePath = path.resolve(dirPath, filename);
            const writeStream = fs.createWriteStream(filePath);
            req.pipe(writeStream);
            req.on('end', () => {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, filename }));
            });
            req.on('error', (err) => {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            });
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        // --- RAPIDAPI QUICK FETCH FOR "FETCH DETAILS" BUTTON ---
        if (req.url === '/api/fetch-profile' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk.toString(); });
          req.on('end', async () => {
            try {
              const { profileUrl } = JSON.parse(body);
              const handleMatch = profileUrl.match(/instagram\.com\/([^\/]+)/);
              if (!handleMatch) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ success: false, error: 'Invalid URL' }));
              }
              const fetchRes = await fetch(profileUrl);
              const html = await fetchRes.text();
              
              const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/);
              const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
              
              if (descMatch && titleMatch) {
                const desc = descMatch[1];
                const title = titleMatch[1];
                
                const fMatch = desc.match(/^([\d,.]+M?K?)\s+Followers/i);
                const nMatch = title.match(/^(.+?)\s*\(&#064;/);
                
                let followersStr = fMatch ? fMatch[1] : '';
                let nameStr = nMatch ? nMatch[1].trim() : 'Unknown';
                
                // Decode HTML entities
                nameStr = nameStr.replace(/&#(x)?([a-zA-Z0-9]+);/g, (match, isHex, val) => {
                  return String.fromCodePoint(parseInt(val, isHex ? 16 : 10));
                }).replace(/&amp;/g, '&');
                
                // Format numbers like 7,013 -> 7K
                if (followersStr.includes(',')) {
                  const num = parseInt(followersStr.replace(/,/g, ''), 10);
                  if (num >= 1000000) followersStr = (num / 1000000).toFixed(1) + 'M';
                  else if (num >= 1000) followersStr = (num / 1000).toFixed(1) + 'K';
                }
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  success: true,
                  name: nameStr,
                  followers: followersStr
                }));
              } else {
                throw new Error('Could not parse Instagram profile. Is the account private?');
              }
            } catch (e: any) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: e.message }));
            }
          });
          return;
        }

        // --- APIFY AUTOMATED SCRAPING TRIGGER ---
        if (req.url === '/api/process-creator' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const { profileUrl, reelUrl } = JSON.parse(body);
              if (!profileUrl) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Missing profileUrl' }));
                return;
              }

              const apifyToken = process.env.VITE_APIFY_TOKEN;
              const apifyActorId = 'potent_sarod~instagram-supabase-pipeline';
              
              if (!apifyToken || !apifyActorId) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Apify credentials missing in .env.local' }));
                return;
              }

              // Read latest supabase credentials directly from file to bypass Vite cache
              const envText = fs.readFileSync('.env.local', 'utf8');
              const supaUrlMatch = envText.match(/^VITE_SUPABASE_URL=(.*)$/m);
              const supaKeyMatch = envText.match(/^VITE_SUPABASE_ANON_KEY=(.*)$/m);
              
              const targetUrl = reelUrl && reelUrl.trim() !== '' ? reelUrl : profileUrl;
              
              const payload = JSON.stringify({
                profileUrls: [targetUrl],
                scrapeReels: true,
                scrapeImages: false,
                supabaseUrl: supaUrlMatch ? supaUrlMatch[1].trim() : '',
                supabaseKey: supaKeyMatch ? supaKeyMatch[1].trim() : ''
              });

              // Call Apify API synchronously (waitForFinish=120)
              const options = {
                hostname: 'api.apify.com',
                port: 443,
                path: `/v2/acts/${apifyActorId}/runs?token=${apifyToken}&waitForFinish=120`,
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Content-Length': Buffer.byteLength(payload)
                }
              };

              const proxyReq = https.request(options, (proxyRes: any) => {
                let proxyBody = '';
                proxyRes.on('data', (chunk: any) => { proxyBody += chunk; });
                proxyRes.on('end', () => {
                  if (proxyRes.statusCode !== 201 && proxyRes.statusCode !== 200) {
                     res.writeHead(500, { 'Content-Type': 'application/json' });
                     res.end(JSON.stringify({ error: `Apify failed: ${proxyBody}` }));
                     return;
                  }
                  
                  // Now run the sync script
                  const child = spawn('node', [path.join(__dirname, 'scripts/sync_supabase_creators.js')]);
                  child.on('close', (code) => {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, message: 'Actor finished and sync complete' }));
                  });
                });
              });

              proxyReq.on('error', (err: any) => {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: `Apify request failed: ${err.message}` }));
              });

              proxyReq.write(payload);
              proxyReq.end();

            } catch (err: any) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        if (req.url === '/api/add-to-campaign' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const scriptPath = path.resolve(__dirname, 'scripts/append_to_sheet.py');
              const pyProcess = spawn('python3', [scriptPath, '-']);
              let stdoutData = '';
              let stderrData = '';
              
              pyProcess.stdout.on('data', data => { stdoutData += data; });
              pyProcess.stderr.on('data', data => { stderrData += data; });
              
              pyProcess.on('error', err => {
                console.error('Failed to spawn Python script:', err);
                if (!res.writableEnded) {
                  res.writeHead(500, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ error: `Spawn error: ${err.message}` }));
                }
              });
              
              pyProcess.on('close', code => {
                if (res.writableEnded) return;
                if (code === 0) {
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ success: true, message: stdoutData.trim() }));
                } else {
                  res.writeHead(500, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ error: stderrData.trim() || 'Python script failed' }));
                }
              });

              pyProcess.stdin.write(body);
              pyProcess.stdin.end();
            } catch (err) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        next();
      });
    }
  }
}

function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    apiPlugin(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
