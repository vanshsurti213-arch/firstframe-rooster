# How to Add New Creators & UGC Reels

You can add new creators and their UGC portfolio videos to the roster in two ways:

---

## Method 1: Using the Admin Panel UI (Recommended)

1. Ensure the local dev server is running by opening a terminal and starting Vite:
   ```bash
   npm run dev
   ```
2. Open your browser and navigate to the admin console:
   [http://localhost:3000/kalva](http://localhost:3000/kalva)
3. Click the **"+ Add Creator"** button in the top header.
4. Fill in the creator's details:
   - **Full Name**: e.g., Siya Uppal
   - **Instagram Handle**: e.g., @siyauppall
   - **Followers & Avg Views**: e.g., 735, 12K, 150K
   - **Niches**: e.g., Fashion, Beauty, Lifestyle (comma-separated)
   - **UGC Video File**: Choose the `.mp4` or `.mov` file from your computer.
5. Click **"Save Creator Profile"**.
6. The video file is automatically uploaded to `public/videos/` and the details are added to `src/app/data/creators.json` instantly.

*Note: Once finished, run `git add . && git commit -m "feat: add new creators" && git push` to deploy the updates to Vercel.*

---

## Method 2: Editing the JSON File Manually (Fallback)

1. Place your video file inside the `/public/videos/` folder.
2. Open [creators.json](file:///Users/atharvtotawar/Desktop/firstframe-rooster/src/app/data/creators.json) and add a new entry to the array:
   ```json
   {
     "id": 12,
     "name": "Creator Name",
     "handle": "@handle",
     "followers": "15K",
     "avgViews": "80K",
     "niches": ["Fashion", "Beauty"],
     "brandCollabs": 0,
     "videoFile": "your-video-filename.mp4"
   }
   ```
3. Save the file.
