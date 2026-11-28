import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Artist fields shared by both lists: setlist.fm identity plus Deezer details. */
const artistSchema = z.object({
  mbid: z.string(),
  name: z.string(),
  setlistUrl: z.string().url(),
  deezerId: z.number().int().nullable(),
  deezerUrl: z.string().url().optional(),
  fans: z.number().int().optional(),
  /** File name under src/assets/artists/, when Deezer had a real photo. */
  image: z.string().optional(),
  /** Dominant color of the photo, used as a placeholder behind it. */
  color: z.string().regex(/^#[0-9a-f]{6}$/).optional(),
});

export const topArtistSchema = artistSchema.extend({
  count: z.number().int().positive(),
  firstSeen: isoDate,
  lastSeen: isoDate,
});

export const recentArtistSchema = artistSchema.extend({
  date: isoDate,
  venue: z.string(),
  city: z.string(),
  tour: z.string().optional(),
  showUrl: z.string().url(),
});

export const concertsSchema = z.object({
  updatedAt: isoDate,
  stats: z.object({
    shows: z.number().int(),
    artists: z.number().int(),
    venues: z.number().int(),
    since: isoDate,
  }),
  topSeen: z.array(topArtistSchema),
  recent: z.array(recentArtistSchema),
});

export type Concerts = z.infer<typeof concertsSchema>;
export type TopArtist = z.infer<typeof topArtistSchema>;
export type RecentArtist = z.infer<typeof recentArtistSchema>;
