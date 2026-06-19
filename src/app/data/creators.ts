import creatorsJson from './creators.json';

export interface Creator {
  id: number;
  name: string;
  handle: string;
  followers: string;
  avgViews: string;
  niches: string[];
  brandCollabs: number;
  videoFile?: string;
}

export const creators: Creator[] = creatorsJson as Creator[];
