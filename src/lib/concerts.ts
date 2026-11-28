import type { ImageMetadata } from 'astro';
import raw from '../data/concerts.json';
import { concertsSchema, type Concerts, type RecentArtist } from './concerts-schema';

// Validate at build time: bad data fails the build.
export const concerts: Concerts = concertsSchema.parse(raw);

const photos = import.meta.glob<{ default: ImageMetadata }>('../assets/artists/*.jpg', { eager: true });

export function photoFor(file: string | undefined): ImageMetadata | undefined {
  return file ? photos[`../assets/artists/${file}`]?.default : undefined;
}

/** Up to two letters for the no-photo tile: "The National" -> "N", "Run the Jewels" -> "RJ". */
export function monogram(name: string): string {
  const words = name.replace(/^the\s+/i, '').split(/\s+/).filter((w) => !/^(the|and|of|&|\+)$/i.test(w));
  return words
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export interface Show {
  date: string;
  venue: string;
  city: string;
  artists: RecentArtist[];
}

/** Groups the recent artists into shows (same date and venue), keeping newest first. */
export function groupShows(recent: RecentArtist[]): Show[] {
  const out: Show[] = [];
  for (const a of recent) {
    const last = out.at(-1);
    if (last && last.date === a.date && last.venue === a.venue) last.artists.push(a);
    else out.push({ date: a.date, venue: a.venue, city: a.city, artists: [a] });
  }
  return out;
}

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-US', { ...opts, timeZone: 'UTC' });
const parts = (iso: string) => new Date(`${iso}T00:00:00Z`);

export const formatLong = (iso: string) => fmt({ month: 'long', day: 'numeric', year: 'numeric' }).format(parts(iso));
export const formatMonth = (iso: string) => fmt({ month: 'short' }).format(parts(iso));
export const formatDay = (iso: string) => fmt({ day: 'numeric' }).format(parts(iso));
export const year = (iso: string) => iso.slice(0, 4);

/** Competition ranking: tied counts share a rank (1, 1, 3, …). */
export function ranks(counts: number[]): number[] {
  return counts.map((c) => 1 + counts.filter((x) => x > c).length);
}
