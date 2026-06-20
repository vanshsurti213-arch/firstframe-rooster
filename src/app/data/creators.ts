import creatorsJson from './creators.json';

export interface Reel {
  id: string;
  label: string;           // e.g. "Skincare Routine"
  videoUrl: string;        // direct .mp4, Instagram reel, or YouTube Shorts URL
  thumbnailUrl?: string;   // optional static thumbnail
  views?: string;          // optional e.g. "5.2k"
  likes?: string;          // optional
}

export interface Creator {
  id: string;
  name: string;
  handle?: string;         // Instagram handle without @ — used for profile link
  profileUrl?: string;     // full profile URL
  followers: string;
  avgViews: string;
  engagementRate?: string; // e.g. "6.5%"
  niches: string[];
  reels: Reel[];           // array of 1–6 reels
  // Legacy backward compat — do NOT remove:
  videoUrl?: string;       // old single-video field, auto-converted at runtime
  brandCollabs?: number;   // legacy field kept for compat
}

export const creators: Creator[] = creatorsJson as Creator[];
