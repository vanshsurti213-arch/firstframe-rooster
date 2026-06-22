# Demo Reel Update Guide

This guide explains how the demo reel update system works and how to use it to manage creator reels.

## Overview

The system automatically manages demo reel history by:
- ✅ Accepting new reel URLs when updating a creator
- ✅ Keeping a history of up to 10 reels per creator
- ✅ Automatically deleting older reels when the 10-reel limit is exceeded
- ✅ Displaying only the newest reel in the UI

## Key Features

### Automatic Reel History Management

When you update a creator's demo reel:
1. The new reel is added to the top of their reel list
2. Previous reels are preserved in the history
3. If there are more than 10 reels, the oldest ones are deleted
4. Only the newest reel is displayed in the creator card UI

### Using the Admin Modal

1. Click "Add Creator" or edit an existing creator
2. Update the demo reel URL in the form
3. Submit the form
4. The system will:
   - Add the new reel to the top
   - Remove any reels beyond the 10 most recent
   - Save changes to Supabase

## API Endpoints

### Update Creator Reel via API

**POST** `/api/update-creator-reel`

Update a specific creator's demo reel URL and automatically manage history.

**Request Body:**
```json
{
  "creatorId": "creator_aadrikaa_acharya",
  "videoUrl": "https://www.instagram.com/reel/DYxJxLOTCkX/",
  "label": "Demo Reel"
}
```

**Alternative using creator name:**
```json
{
  "creatorName": "Aadrika",
  "videoUrl": "https://www.instagram.com/reel/DYxJxLOTCkX/",
  "label": "Demo Reel"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Updated Aadrika's demo reel",
  "creator": {
    "id": "creator_aadrikaa_acharya",
    "name": "Aadrika"
  },
  "stats": {
    "totalReels": 2,
    "maxReels": 10,
    "deletedOlderReels": 0,
    "newReel": {
      "id": "reel_1234567890",
      "label": "Demo Reel",
      "videoUrl": "https://www.instagram.com/reel/DYxJxLOTCkX/"
    }
  }
}
```

## Script Usage

### Update Aadirika's Reel via Script

```bash
# Default: Uses the Instagram link provided
node scripts/update-aadirika-reel.js

# With a custom URL
node scripts/update-aadirika-reel.js "https://www.instagram.com/reel/YOUR_REEL_ID/"
```

**Output:**
```
✓ Found Aadrika: Aadrika (aadrikaa_acharya)
✓ Current reels: 1
✓ After adding new reel: 2
✓ Keeping only newest 10: 2
✓ Deleting 0 older reel(s)
✅ Successfully updated Aadrika's demo reel!
```

## Data Structure

### Creator Object with Reels

```typescript
interface Creator {
  id: string;
  name: string;
  handle?: string;
  profileUrl?: string;
  followers: string;
  avgViews: string;
  niches: string[];
  reels: Reel[];  // Array of up to 10 reels
}

interface Reel {
  id: string;          // Unique ID: reel_${timestamp}
  label: string;       // e.g., "Demo Reel"
  videoUrl: string;    // URL to Instagram reel or video
  thumbnailUrl?: string;
  views?: string;
  likes?: string;
}
```

### Storage Location

- **File-based:** `/src/app/data/creators.json`
- **Cloud:** Supabase Storage bucket `creator-data/creators.json`
- **Database:** Synced to Supabase table (if configured)

## Examples

### Example 1: Update Aadirika's Video to New Instagram Link

**Using the script:**
```bash
node scripts/update-aadirika-reel.js "https://www.instagram.com/reel/DYxJxLOTCkX/"
```

**Result:**
- New reel added as the first item
- Old reel preserved in history
- Total: 2 reels (both stored)

### Example 2: Multiple Updates Over Time

**Update 1:** Add first reel
```
Reels: [new_reel_1]
```

**Update 2:** Add second reel
```
Reels: [new_reel_2, new_reel_1]
```

**Update 3-10:** Add reels 3-10
```
Reels: [new_reel_10, new_reel_9, ..., new_reel_1]  (10 total)
```

**Update 11:** Add 11th reel (oldest is deleted)
```
Reels: [new_reel_11, new_reel_10, ..., new_reel_2]  (10 total, reel_1 deleted)
```

## UI Updates

### Creator Card Display
- Shows only the **first (newest) reel** from the `reels` array
- Displays: `reels[0].videoUrl`

### Admin View
- Can edit creator and update the demo reel URL
- Changes are saved to both local storage and Supabase
- History is preserved automatically

## Notes

- ✅ Each reel gets a unique ID based on timestamp: `reel_${Date.now()}`
- ✅ Reels are sorted newest first (index 0 is always the newest)
- ✅ Deleting reels happens automatically when count exceeds 10
- ✅ Changes are persisted to Supabase in real-time
- ✅ The system maintains full reel history up to 10 reels
- ✅ Compatible with existing reel URLs (Instagram, YouTube, MP4, etc.)

## Troubleshooting

### Script not found
```bash
# Make sure you're running from the project root
cd /path/to/v0-project
node scripts/update-aadirika-reel.js
```

### Creator not found
- Verify the creator name or ID in `creators.json`
- Check spelling (case-insensitive)
- Use either `handle` or `name` to find the creator

### Changes not syncing to Supabase
- Verify Supabase credentials in environment variables
- Check network connection
- Ensure the `creator-data` bucket exists
- Review browser console for error messages
