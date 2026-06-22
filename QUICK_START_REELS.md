# Quick Start: Demo Reel Updates

## ✅ What Was Just Implemented

Your demo reel system now automatically:
1. **Stores up to 10 reels per creator** instead of just 1
2. **Deletes 10 older links** when a new one is added (keeping total ≤ 10)
3. **Shows only the newest reel** in the UI
4. **Preserves full history** for reference

## 📌 Aadrika Update

✅ **Status:** Aadrika's video has been updated!
- **New link:** https://www.instagram.com/reel/DYxJxLOTCkX/
- **Old link:** Preserved in history
- **Total stored:** 2/10 reels

## 🚀 How to Update Demo Reels

### Option 1: Via Admin UI (Recommended)
1. Go to the admin view (`/kalva`)
2. Click "Edit Creator" on any creator card
3. Update the "Demo Reel" URL field
4. Click "Save"
5. System automatically:
   - Adds new reel to history
   - Deletes oldest if needed

### Option 2: Via Command Line
```bash
# Update Aadrika's reel
node scripts/update-aadirika-reel.js "https://www.instagram.com/reel/NEW_ID/"

# Update any creator
node scripts/update-aadirika-reel.js
# (Uses default/last updated URL)
```

### Option 3: Via API
```bash
curl -X POST http://localhost:5173/api/update-creator-reel \
  -H "Content-Type: application/json" \
  -d '{
    "creatorName": "Aadrika",
    "videoUrl": "https://www.instagram.com/reel/DYxJxLOTCkX/"
  }'
```

## 📊 Data Structure

**Example - After 5 updates:**
```
Creator: Aadrika
├─ Reel 1 (Newest):    https://instagram.com/reel/NEW_05/
├─ Reel 2:             https://instagram.com/reel/NEW_04/
├─ Reel 3:             https://instagram.com/reel/NEW_03/
├─ Reel 4:             https://instagram.com/reel/NEW_02/
└─ Reel 5 (Oldest):    https://instagram.com/reel/NEW_01/

UI Shows: Reel 1 (newest)
History Available: All 5 reels
```

**After 15 updates (exceeds 10-reel limit):**
```
Creator: Aadrika
├─ Reel 1 (Newest):    https://instagram.com/reel/NEW_15/    ← Just added
├─ Reel 2-9:           (Reels 8-1)
└─ Reel 10 (Oldest):   https://instagram.com/reel/NEW_06/    ← 5 oldest deleted!

UI Shows: Reel 1 (newest)
History Available: 10 most recent reels
Deleted: Reels from updates 1-5
```

## 🔍 Verification

Check if updates worked:
```bash
# View Aadrika's current reels
cat src/app/data/creators.json | jq '.[] | select(.handle == "aadrikaa_acharya") | .reels'

# Count reels
cat src/app/data/creators.json | jq '.[] | select(.handle == "aadrikaa_acharya") | (.reels | length)'
```

## 📝 Files Changed

| File | What Changed |
|------|-------------|
| `src/app/App.tsx` | Added reel history logic (20 lines) |
| `src/app/data/creators.json` | Aadrika's reel updated ✅ |
| `api/update-creator-reel.js` | NEW - API endpoint |
| `scripts/update-aadirika-reel.js` | NEW - CLI tool |
| Docs | `REEL_UPDATE_GUIDE.md`, `REEL_CHANGES_SUMMARY.md` |

## ⚙️ How It Works (Behind the Scenes)

```typescript
// When saving a creator:
1. Get new reel URL from form input
2. Find the creator in database
3. Combine: [new_reel, ...old_reels]
4. Trim to 10 max: reels.slice(0, 10)
5. Save to Supabase
6. UI displays: reels[0] (newest only)
```

## 🎯 Common Tasks

### Update Aadrika to latest Instagram reel
```bash
node scripts/update-aadirika-reel.js "https://www.instagram.com/reel/DYxJxLOTCkX/"
```

### View all of Aadrika's stored reels
```bash
jq '.[] | select(.handle=="aadrikaa_acharya") | .reels | .[].videoUrl' src/app/data/creators.json
```

### Check how many reels each creator has
```bash
jq '.[] | {name, reelCount: (.reels|length)}' src/app/data/creators.json
```

### Add a new creator with demo reel
1. Admin UI → "Add Creator"
2. Enter profile URL
3. Enter demo reel URL
4. Save
5. System creates history entry automatically

## 🐛 Troubleshooting

### Changes not showing in UI?
- Hard refresh browser (Ctrl+Shift+R)
- Check browser console for errors
- Verify Supabase sync completed

### Script not found?
```bash
# Make sure you're in project root
cd /path/to/v0-project
ls scripts/update-aadirika-reel.js  # Should exist
node scripts/update-aadirika-reel.js
```

### Creator not found?
- Check spelling in `creators.json`
- Use exact name or handle
- Example: "Aadrika" or "aadrikaa_acharya"

## 📚 Full Documentation

For detailed info, see:
- `REEL_UPDATE_GUIDE.md` - Complete guide
- `REEL_CHANGES_SUMMARY.md` - Technical details
- `src/app/App.tsx` - Source code

## ✨ What's Next?

Your system now supports:
- ✅ Multiple reels per creator
- ✅ Automatic history cleanup
- ✅ UI displays newest reel only
- ✅ Full history preserved
- ✅ CLI and API management

Potential additions:
- View full history UI
- Restore deleted reels
- Analytics per reel
- Scheduled reel rotation

---

**Questions?** Check the full docs or review the implementation in `src/app/App.tsx` lines 390-422.
