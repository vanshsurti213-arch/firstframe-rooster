const fs = require('fs');
const path = require('path');

function parseTSV(tsv) {
  let rows = [];
  let cols = [];
  let cur = '';
  let inQuote = false;
  for(let i=0; i<tsv.length; i++) {
    let char = tsv[i];
    if (inQuote) {
      if (char === '"') {
        if (tsv[i+1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuote = false;
        }
      } else {
        cur += char;
      }
    } else {
      if (char === '"') {
        inQuote = true;
      } else if (char === '\t') {
        cols.push(cur);
        cur = '';
      } else if (char === '\n') {
        cols.push(cur);
        rows.push(cols);
        cols = [];
        cur = '';
      } else if (char === '\r') {
        // ignore
      } else {
        cur += char;
      }
    }
  }
  if (cols.length > 0 || cur !== '') {
    cols.push(cur);
    rows.push(cols);
  }
  return rows;
}

function normalizeName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function run() {
  const tsvData = fs.readFileSync(path.join(process.cwd(), 'scripts', 'new_creators.tsv'), 'utf-8');
  const lines = parseTSV(tsvData);
  
  const creatorsPath = path.join(process.cwd(), 'src', 'app', 'data', 'creators.json');
  const oldCreators = JSON.parse(fs.readFileSync(creatorsPath, 'utf-8'));
  
  const incompleteCreators = [];
  const finalCreatorsList = [];
  const seenHandles = new Set();
  
  const localVideos = fs.readdirSync(path.join(process.cwd(), 'public', 'videos')).filter(f => f.endsWith('.mp4') || f.endsWith('.MOV') || f.endsWith('.MP4'));

  for (let i = 1; i < lines.length; i++) {
    const columns = lines[i];
    if (columns.length < 5) continue; 
    
    let firstNameIdx = 0;
    if (columns[0] && columns[0].match(/^\d{4}-\d{2}-\d{2}/)) {
      firstNameIdx = 1; 
    }
    
    const firstName = columns[firstNameIdx]?.trim() || '';
    const lastName = columns[firstNameIdx+1]?.trim() || '';
    const name = `${firstName} ${lastName}`.trim();
    let instagram = columns[firstNameIdx+6]?.trim() || '';
    const reelsStr = columns[firstNameIdx+8]?.trim() || '';
    const niches = (columns[firstNameIdx+5] || '').split(',').map(n => n.trim()).filter(Boolean);
    
    if (!name || !instagram) continue;
    
    let handle = instagram.split('instagram.com/')[1]?.split('/')[0]?.split('?')[0] || '';
    handle = handle.replace(/[@]/g, '');
    if (!handle) handle = name.replace(/\s+/g, '').toLowerCase();

    if (seenHandles.has(handle.toLowerCase())) {
      continue;
    }
    seenHandles.add(handle.toLowerCase());
    
    const rawReels = reelsStr.split(/[\n, ]+/).filter(u => u.includes('http')); // Accept ANY link
    
    if (rawReels.length === 0) {
      incompleteCreators.push({
        name,
        instagram,
        reason: "Missing demo reels",
        rawReels: reelsStr
      });
      continue;
    }

    const oldMatch = oldCreators.find(c => 
      c.handle.toLowerCase() === handle.toLowerCase() || 
      normalizeName(c.name) === normalizeName(name)
    );

    let finalReels = [];
    let usesInstagramFallback = false;

    // Check if we have local MP4 files for this person
    const possibleFiles = localVideos.filter(f => {
      const fn = f.toLowerCase();
      return fn.includes(firstName.toLowerCase()) || fn.includes(normalizeName(firstName));
    });

    if (oldMatch && oldMatch.reels && oldMatch.reels.length > 0 && !oldMatch.reels[0].videoUrl.includes('http')) {
      // Preserve old local mappings
      finalReels = oldMatch.reels;
    } else if (possibleFiles.length > 0) {
      // Use any local files found
      finalReels = possibleFiles.map((pf, idx) => ({
        id: `reel_${handle}_local_${idx}`,
        label: `Demo Reel ${idx+1}`,
        videoUrl: pf
      }));
    } else {
      // Fallback to whatever URL was in the sheet (Instagram, Drive, Canva, etc)
      usesInstagramFallback = true;
      for (let j = 0; j < Math.min(rawReels.length, 5); j++) {
        finalReels.push({
          id: `reel_${handle}_link_${j}`,
          label: `Demo Reel ${j+1}`,
          videoUrl: rawReels[j]
        });
      }
    }

    if (usesInstagramFallback) {
      incompleteCreators.push({
        name,
        instagram,
        reason: `Renders as external link/iframe. Native MP4 not found locally.`,
        rawReels: reelsStr
      });
    }
    
    finalCreatorsList.push({
      id: `creator_${handle}_${Date.now()}`,
      name: name,
      handle: handle,
      profileUrl: instagram,
      followers: oldMatch?.followers || '10K',
      avgViews: oldMatch?.avgViews || '10K',
      engagementRate: oldMatch?.engagementRate || '',
      niches: niches.length ? niches : (oldMatch?.niches || ['Lifestyle']),
      reels: finalReels
    });
  }
  
  fs.writeFileSync(creatorsPath, JSON.stringify(finalCreatorsList, null, 2));
  console.log(`Rebuild complete. Created ${finalCreatorsList.length} creators.`);
}

run().catch(console.error);
