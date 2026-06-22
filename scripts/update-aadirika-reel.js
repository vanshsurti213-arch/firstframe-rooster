#!/usr/bin/env node
/**
 * Script to update Aadrika's demo reel with a new Instagram link
 * Usage: node scripts/update-aadirika-reel.js [NEW_URL]
 * Example: node scripts/update-aadirika-reel.js "https://www.instagram.com/reel/DYxJxLOTCkX/"
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const newUrl = process.argv[2] || 'https://www.instagram.com/reel/DYxJxLOTCkX/';

// Path to creators.json
const creatorsPath = path.join(__dirname, '../src/app/data/creators.json');

try {
  // Read the current creators.json
  const creatorsData = JSON.parse(fs.readFileSync(creatorsPath, 'utf-8'));
  
  // Find Aadrika
  const aadrikaIndex = creatorsData.findIndex(
    c => c.handle?.toLowerCase() === 'aadrikaa_acharya' || 
         c.name?.toLowerCase().includes('aadrika')
  );
  
  if (aadrikaIndex === -1) {
    console.error('❌ Aadrika not found in creators.json');
    process.exit(1);
  }
  
  const creator = creatorsData[aadrikaIndex];
  console.log(`✓ Found Aadrika: ${creator.name} (${creator.handle})`);
  
  // Create new reel entry
  const newReel = {
    id: `reel_${Date.now()}`,
    label: 'Demo Reel',
    videoUrl: newUrl,
  };
  
  // Get existing reels and prepend the new one
  const existingReels = creator.reels || [];
  const updatedReels = [newReel, ...existingReels];
  
  // Keep only the 10 newest reels (delete older ones)
  const trimmedReels = updatedReels.slice(0, 10);
  
  console.log(`✓ Current reels: ${existingReels.length}`);
  console.log(`✓ After adding new reel: ${updatedReels.length}`);
  console.log(`✓ Keeping only newest 10: ${trimmedReels.length}`);
  
  // Old reels being deleted
  if (updatedReels.length > 10) {
    const deletedCount = updatedReels.length - 10;
    console.log(`✓ Deleting ${deletedCount} older reel(s)`);
  }
  
  // Update the creator
  creatorsData[aadrikaIndex] = {
    ...creator,
    reels: trimmedReels,
  };
  
  // Write back to file
  fs.writeFileSync(creatorsPath, JSON.stringify(creatorsData, null, 2));
  
  console.log(`\n✅ Successfully updated Aadrika's demo reel!`);
  console.log(`📹 New video URL: ${newUrl}`);
  console.log(`📊 Reels stored: ${trimmedReels.length}/10 (max)`);
  
} catch (error) {
  console.error('❌ Error updating Aadrika:', error.message);
  process.exit(1);
}
