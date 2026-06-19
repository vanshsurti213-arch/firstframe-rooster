# How to Add New Creators & MP4 Videos

## Adding a New Creator Profile

Open `src/app/data/creators.ts` and copy-paste one of the existing creator objects:

```typescript
{
  id: 11, // Make this unique!
  name: 'Your Creator Name',
  handle: '@theircreatorhandle',
  niche: 'Beauty', // Choose: Beauty, Fashion, Lifestyle, Fitness, Mom/Family, or Food
  followers: '500K',
  avgViews: '100K',
  engRate: '5.2%',
  brandCollabs: 10,
  photo: 'https://your-image-url.com/photo.jpg',
  videoFile: 'creator-name-reel.mp4' // Just the filename
}
```

---

## Adding MP4 Videos

### Step 1: Add Your Video File
Place your MP4 video file in the `/public/videos/` folder.

**Example:** `/public/videos/sophia-reel.mp4`

### Step 2: Reference the Filename
In `src/app/data/creators.ts`, add just the filename to the `videoFile` field:

```typescript
videoFile: 'sophia-reel.mp4'
```

### No Video (Placeholder)
Leave it empty:
```typescript
videoFile: ''
```

---

## File Structure

```
/public
  /videos
    sophia-reel.mp4
    emma-reel.mp4
    maya-reel.mp4
    ...
```

---

## Quick Tips

- **ID must be unique** for each creator
- **Niche** determines the color of the pill badge
- **Photo** can be any direct image URL
- **MP4 files** must be in `/public/videos/` folder
- Videos will play with standard browser controls
- Colors are pre-set per niche (pink for Beauty, purple for Fashion, etc.)
