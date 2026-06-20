# How to Add New Creators & UGC Reels

You can add new creators and their UGC portfolio reels to the roster in two ways:

---

## Method 1: Using the Admin Panel UI (Recommended)

1. Start the local dev server:
   ```bash
   npm run dev
   ```
2. Open the admin console in your browser:
   [http://localhost:5173/kalva](http://localhost:5173/kalva)
3. Click the **"+ Add Creator"** button in the top header.
4. Fill in the creator's details:
   - **Full Name** *(required)*: e.g., Siya Uppal
   - **Instagram Handle**: e.g., `siyauppall` (without `@`)
   - **Followers & Avg Views**: e.g., `12.6K`, `67K`
   - **Niches** *(required)*: Click pills to select — Skincare, Makeup, Fashion, etc.
5. Add up to **6 video reels** by pasting URLs:
   - **Direct `.mp4` links** — e.g., `https://cdn.example.com/video.mp4`
   - **Instagram Reel URLs** — e.g., `https://www.instagram.com/reel/ABC123/`
   - **YouTube Shorts** — e.g., `https://youtube.com/shorts/XYZ789`
   - For each reel, optionally set a **label**, **views count**, and **likes count**.
   - Click **"+ Add Reel"** to add more (up to 6 total).
6. Click **"Save Creator Profile"**.
7. The creator is instantly added to `src/app/data/creators.json`.

### ⚠️ No API key is needed!

The video URLs are **not downloaded** — they are embedded directly:
- **Instagram & YouTube URLs** → rendered as `<iframe>` embeds
- **Direct `.mp4` URLs** → rendered as `<video>` tags

So you just paste the link and it works. No server-side video processing, no API keys, no file uploads.

### Deploying changes

After adding creators locally, push to production:
```bash
git add .
git commit -m "feat: add new creators"
git push
```
Vercel will auto-deploy the updated `creators.json`.

---

## Method 2: Editing the JSON File Manually (Fallback)

Open `src/app/data/creators.json` and add a new entry:

```json
{
  "id": "creator_unique_id",
  "name": "Creator Name",
  "handle": "instagram_handle",
  "profileUrl": "https://instagram.com/instagram_handle",
  "followers": "15K",
  "avgViews": "80K",
  "niches": ["Fashion", "Beauty"],
  "reels": [
    {
      "id": "reel_01",
      "label": "Skincare Routine",
      "videoUrl": "https://www.instagram.com/reel/ABC123/",
      "views": "12K",
      "likes": "800"
    },
    {
      "id": "reel_02",
      "label": "GRWM",
      "videoUrl": "https://cdn.example.com/grwm.mp4",
      "views": "5K"
    }
  ]
}
```

Save the file. If the dev server is running, changes appear immediately via HMR.

---

## Supported Video URL Types

| Type             | Example URL                                          | How it renders      |
|------------------|------------------------------------------------------|---------------------|
| Direct `.mp4`    | `https://cdn.example.com/video.mp4`                  | `<video>` tag       |
| Cloudinary       | `https://res.cloudinary.com/demo/video/upload/...`   | `<video>` tag       |
| Supabase Storage | `https://xxx.supabase.co/storage/v1/object/public/…` | `<video>` tag       |
| Instagram Reel   | `https://www.instagram.com/reel/ABC123/`             | `<iframe>` embed    |
| Instagram Post   | `https://www.instagram.com/p/ABC123/`                | `<iframe>` embed    |
| YouTube Short    | `https://youtube.com/shorts/XYZ789`                  | `<iframe>` embed    |
| YouTube Video    | `https://youtu.be/XYZ789`                            | `<iframe>` embed    |

**No API keys or backend services required** — all rendering happens client-side.
