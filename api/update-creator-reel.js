/**
 * API Endpoint to update a creator's demo reel
 * Handles deleting old reel links (keeps only 10 newest)
 * 
 * POST /api/update-creator-reel
 * Body: {
 *   creatorId: string,
 *   creatorName: string, // Alternative to find creator
 *   videoUrl: string,
 *   label?: string (defaults to 'Demo Reel')
 * }
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { creatorId, creatorName, videoUrl, label } = req.body;

    // Validate input
    if (!videoUrl) {
      return res.status(400).json({ error: 'videoUrl is required' });
    }

    if (!creatorId && !creatorName) {
      return res.status(400).json({ error: 'Either creatorId or creatorName is required' });
    }

    // Path to creators.json in Supabase storage
    // For now, we'll read from the local src directory
    const creatorsPath = path.join(__dirname, '../src/app/data/creators.json');

    // Read current creators
    let creatorsData = [];
    try {
      const data = fs.readFileSync(creatorsPath, 'utf-8');
      creatorsData = JSON.parse(data);
    } catch (e) {
      console.error('Failed to read creators.json:', e);
      return res.status(500).json({ error: 'Failed to read creators database' });
    }

    // Find the creator
    let creatorIndex = -1;
    if (creatorId) {
      creatorIndex = creatorsData.findIndex(c => c.id === creatorId);
    } else if (creatorName) {
      creatorIndex = creatorsData.findIndex(
        c => c.name?.toLowerCase() === creatorName.toLowerCase() ||
             c.handle?.toLowerCase() === creatorName.toLowerCase()
      );
    }

    if (creatorIndex === -1) {
      return res.status(404).json({ error: 'Creator not found' });
    }

    const creator = creatorsData[creatorIndex];

    // Create new reel entry
    const newReel = {
      id: `reel_${Date.now()}`,
      label: label || 'Demo Reel',
      videoUrl: videoUrl,
    };

    // Get existing reels and prepend the new one
    const existingReels = creator.reels || [];
    const updatedReels = [newReel, ...existingReels];

    // Keep only the 10 newest reels (delete older ones)
    const trimmedReels = updatedReels.slice(0, 10);

    const deletedCount = updatedReels.length - trimmedReels.length;

    // Update the creator
    creatorsData[creatorIndex] = {
      ...creator,
      reels: trimmedReels,
    };

    // Write back to file
    fs.writeFileSync(creatorsPath, JSON.stringify(creatorsData, null, 2));

    return res.status(200).json({
      success: true,
      message: `Updated ${creator.name}'s demo reel`,
      creator: {
        id: creator.id,
        name: creator.name,
      },
      stats: {
        totalReels: trimmedReels.length,
        maxReels: 10,
        deletedOlderReels: deletedCount,
        newReel: newReel,
      },
    });
  } catch (error) {
    console.error('Error updating reel:', error);
    return res.status(500).json({
      error: 'Failed to update reel',
      details: error.message,
    });
  }
}
