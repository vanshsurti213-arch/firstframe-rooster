import https from 'https';
import http from 'http';
import { URL } from 'url';

/**
 * Downloads video from Instagram URL and serves it
 * Agent: Downloads Instagram reels/videos and returns the video stream
 */
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { url } = req.query;

    if (!url) {
      res.status(400).json({ error: 'URL parameter is required' });
      return;
    }

    // Validate Instagram URL
    const instagramUrlRegex = /instagram\.com\/(p|reel)\/([a-zA-Z0-9_-]+)/;
    if (!instagramUrlRegex.test(url)) {
      res.status(400).json({ error: 'Invalid Instagram URL' });
      return;
    }

    console.log('[v0] Downloading video from:', url);

    // Extract reel ID
    const match = url.match(/\/(p|reel)\/([a-zA-Z0-9_-]+)/);
    const reelId = match ? match[2] : null;

    if (!reelId) {
      res.status(400).json({ error: 'Could not extract reel ID' });
      return;
    }

    // Try to fetch video using Instagram's CDN
    const videoUrl = await fetchInstagramVideo(reelId);

    if (!videoUrl) {
      res.status(404).json({ error: 'Could not download video' });
      return;
    }

    // Proxy the video - set appropriate headers
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours

    // Fetch and stream the video
    const protocol = videoUrl.startsWith('https') ? https : http;
    
    protocol.get(videoUrl, { 
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }, (response) => {
      response.pipe(res);
    }).on('error', (error) => {
      console.error('[v0] Error downloading video:', error.message);
      res.status(500).json({ error: 'Failed to download video' });
    });

  } catch (error) {
    console.error('[v0] API error:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

/**
 * Fetch Instagram video URL using Instagram's API
 */
async function fetchInstagramVideo(reelId) {
  return new Promise((resolve) => {
    try {
      // Use Instagram's CDN endpoint
      const cdnUrl = `https://www.instagram.com/api/v1/media/${reelId}/info/`;
      
      https.get(cdnUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }, (response) => {
        let data = '';
        
        response.on('data', chunk => {
          data += chunk;
        });
        
        response.on('end', () => {
          try {
            const json = JSON.parse(data);
            const videoUrl = json?.media?.video_url || json?.media?.src || null;
            resolve(videoUrl);
          } catch {
            resolve(null);
          }
        });
      }).on('error', () => {
        resolve(null);
      });
      
      // Timeout after 10 seconds
      setTimeout(() => resolve(null), 10000);
    } catch (error) {
      resolve(null);
    }
  });
}
