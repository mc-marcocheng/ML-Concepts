import { CATEGORIES } from './categories';

export interface TrackDef {
  id: string;
  title: string;
  eyebrow: string;
  summary: string;
  categories: string[];
}

export const TRACKS: TrackDef[] = [
  {
    id: 'foundations',
    title: 'Foundations',
    eyebrow: 'Path',
    summary: 'The math and modelling ideas the rest of the library leans on, sequenced by prerequisites.',
    categories: ['general-ml', 'linear-algebra'],
  },
  ...CATEGORIES.map(category => ({
    id: category.id,
    title: category.title,
    eyebrow: 'Path',
    summary: `Every ${category.title} note, sequenced by prerequisites.`,
    categories: [category.id],
  })),
];

export function getTrack(id: string): TrackDef | undefined {
  return TRACKS.find(track => track.id === id);
}

export function trackQuizHref(track: TrackDef, size = 10) {
  if (track.categories.length === 1) {
    return `/quiz/session/?scope=category&id=${encodeURIComponent(track.categories[0])}&size=${size}`;
  }
  return `/quiz/session/?scope=mixed&size=${size}`;
}
