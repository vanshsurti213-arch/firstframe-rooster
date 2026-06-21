export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { profileUrl } = req.body;
    
    if (!profileUrl) {
      return res.status(400).json({ success: false, error: 'Missing profileUrl' });
    }

    const handleMatch = profileUrl.match(/instagram\.com\/([^\/]+)/);
    if (!handleMatch) {
      return res.status(400).json({ success: false, error: 'Invalid URL' });
    }

    let absoluteUrl = profileUrl;
    if (!/^https?:\/\//i.test(absoluteUrl)) {
      absoluteUrl = 'https://' + absoluteUrl;
    }

    const fetchRes = await fetch(absoluteUrl);
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
      
      return res.status(200).json({
        success: true,
        name: nameStr,
        followers: followersStr
      });
    } else {
      return res.status(500).json({ success: false, error: 'Could not parse Instagram profile. Is the account private?' });
    }
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
}
