const fs = require('fs');
const path = require('path');

const creatorsPath = path.join(process.cwd(), 'src', 'app', 'data', 'creators.json');
let data = JSON.parse(fs.readFileSync(creatorsPath, 'utf8'));

console.log(`Initial count: ${data.length}`);

// 1. Remove badly corrupted ones (name contains http, missing profileUrl)
const initialCount = data.length;
data = data.filter(c => {
  if (!c.name || !c.profileUrl || !c.handle) return false;
  if (c.name.toLowerCase().includes('http')) return false;
  if (c.name.includes('" Direct')) return false;
  return true;
});
console.log(`Removed ${initialCount - data.length} corrupted entries.`);

// 2. Deduplicate by handle
const map = new Map();
for (const c of data) {
  const h = c.handle.toLowerCase();
  
  // if already exists, compare reel count
  if (map.has(h)) {
    const existing = map.get(h);
    const existingReels = existing.reels ? existing.reels.length : 0;
    const currentReels = c.reels ? c.reels.length : 0;
    
    // keep the one with more reels, or the newer one (which appears earlier in array)
    if (currentReels > existingReels) {
      map.set(h, c);
    }
  } else {
    map.set(h, c);
  }
}

const cleaned = Array.from(map.values());
console.log(`Final count after deduplication: ${cleaned.length}`);
console.log(`Duplicates removed: ${data.length - cleaned.length}`);

fs.writeFileSync(creatorsPath, JSON.stringify(cleaned, null, 2));
console.log('Successfully cleaned creators.json!');
