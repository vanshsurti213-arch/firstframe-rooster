const fs = require('fs');

const tsv = fs.readFileSync('scripts/names.tsv', 'utf-8');
const lines = tsv.trim().split('\n');
const headers = lines[0].split('\t');

const fnameIdx = headers.indexOf('First Name');
const lnameIdx = headers.indexOf('Last Name');
const igIdx = headers.indexOf('Instagram');

const map = {};

for (let i = 1; i < lines.length; i++) {
  const parts = lines[i].split('\t');
  if (parts.length > igIdx && parts[igIdx]) {
    let ig = parts[igIdx].trim();
    if (ig) {
      // extract handle
      // e.g. https://www.instagram.com/sutapamandal11?igsh=...
      let handle = '';
      try {
        const u = new URL(ig);
        handle = u.pathname.replace(/\//g, '');
      } catch (e) {
        // if it's just 'www.instagram.com/ugcwithshiw'
        const match = ig.match(/instagram\.com\/@?([A-Za-z0-9_.-]+)/);
        if (match) handle = match[1];
        else handle = ig.replace('@', '').trim();
      }
      
      const firstName = parts[fnameIdx] ? parts[fnameIdx].trim() : '';
      const lastName = parts[lnameIdx] ? parts[lnameIdx].trim() : '';
      const fullName = (firstName + ' ' + lastName).trim();
      if (fullName && handle) {
        map[handle.toLowerCase()] = fullName;
      }
    }
  }
}

const creatorsFile = 'src/app/data/creators.json';
const creators = JSON.parse(fs.readFileSync(creatorsFile, 'utf-8'));
let updatedCount = 0;

for (let c of creators) {
  const h = c.handle.toLowerCase();
  if (map[h]) {
    console.log(`Updating ${c.handle}: ${c.name} -> ${map[h]}`);
    c.name = map[h];
    updatedCount++;
  } else {
    console.log(`No match in TSV for ${c.handle}`);
  }
}

fs.writeFileSync(creatorsFile, JSON.stringify(creators, null, 2));
console.log(`Updated ${updatedCount} names.`);
