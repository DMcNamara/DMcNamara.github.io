/**
 * Pure aggregation over setlist.fm "attended" data. No network here, so it's unit-tested.
 */

/** The subset of a setlist.fm setlist the sync uses. */
export interface Setlist {
  id: string;
  eventDate: string; // dd-MM-yyyy
  url: string;
  artist: { mbid?: string; name: string; url: string };
  venue: { id?: string; name: string; city?: { name?: string; stateCode?: string; country?: { code?: string } } };
  tour?: { name?: string };
}

export interface Appearance {
  artistKey: string;
  artistName: string;
  artistUrl: string;
  date: string; // ISO yyyy-MM-dd
  venueKey: string;
  venue: string;
  city: string;
  tour?: string;
  showUrl: string;
}

export interface TopEntry {
  artistKey: string;
  name: string;
  artistUrl: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
}

/** setlist.fm dates are dd-MM-yyyy. */
export function parseEventDate(s: string): string {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s);
  if (!m) throw new Error(`Unexpected setlist.fm date: ${s}`);
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function cityLabel(city: Setlist['venue']['city']): string {
  if (!city?.name) return '';
  const region = city.country?.code === 'US' ? city.stateCode : city.country?.code;
  return region ? `${city.name}, ${region}` : city.name;
}

export function normalize(setlists: Setlist[]): Appearance[] {
  return setlists.map((s) => ({
    artistKey: s.artist.mbid || `name:${s.artist.name.toLowerCase()}`,
    artistName: s.artist.name,
    artistUrl: s.artist.url,
    date: parseEventDate(s.eventDate),
    venueKey: s.venue.id || s.venue.name,
    venue: s.venue.name,
    city: cityLabel(s.venue.city),
    tour: s.tour?.name || undefined,
    showUrl: s.url,
  }));
}

/** Newest first; ties keep their input order. */
function byDateDesc(a: Appearance, b: Appearance): number {
  return b.date.localeCompare(a.date);
}

/**
 * Artists ranked by how many times they were seen. A duplicate entry for the same
 * artist, date and venue counts once. Ties go to the most recently seen, then by name.
 */
export function topSeen(apps: Appearance[], limit = 10): TopEntry[] {
  const by = new Map<string, { entry: TopEntry; shows: Set<string> }>();
  for (const a of apps) {
    const showKey = `${a.date}|${a.venueKey}`;
    let rec = by.get(a.artistKey);
    if (!rec) {
      rec = {
        entry: { artistKey: a.artistKey, name: a.artistName, artistUrl: a.artistUrl, count: 0, firstSeen: a.date, lastSeen: a.date },
        shows: new Set(),
      };
      by.set(a.artistKey, rec);
    }
    if (rec.shows.has(showKey)) continue;
    rec.shows.add(showKey);
    rec.entry.count++;
    if (a.date < rec.entry.firstSeen) rec.entry.firstSeen = a.date;
    if (a.date > rec.entry.lastSeen) rec.entry.lastSeen = a.date;
  }
  return [...by.values()]
    .map((r) => r.entry)
    .sort((a, b) => b.count - a.count || b.lastSeen.localeCompare(a.lastSeen) || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/** The most recent appearance of each artist, newest first, distinct artists only. */
export function recentArtists(apps: Appearance[], limit = 10): Appearance[] {
  const seen = new Set<string>();
  const out: Appearance[] = [];
  for (const a of [...apps].sort(byDateDesc)) {
    if (seen.has(a.artistKey)) continue;
    seen.add(a.artistKey);
    out.push(a);
    if (out.length === limit) break;
  }
  return out;
}

export function stats(apps: Appearance[]) {
  const dates = apps.map((a) => a.date).sort();
  return {
    shows: new Set(apps.map((a) => `${a.date}|${a.venueKey}`)).size,
    artists: new Set(apps.map((a) => a.artistKey)).size,
    venues: new Set(apps.map((a) => a.venueKey)).size,
    since: dates[0] ?? '',
  };
}

/** Lowercase, no accents, "&" as "and", no leading "the", letters and digits only. */
export function normalizeName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/^the\s+/, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

export interface DeezerArtist {
  id: number;
  name: string;
  link: string;
  picture_xl?: string;
  nb_fan?: number;
}

/**
 * Deezer search is by name only and the first hit isn't always right, so only accept
 * an exact (normalized) name match, preferring the one with the most fans.
 */
export function pickDeezerMatch(name: string, results: DeezerArtist[]): DeezerArtist | undefined {
  const want = normalizeName(name);
  if (!want) return undefined;
  return results
    .filter((r) => normalizeName(r.name) === want)
    .sort((a, b) => (b.nb_fan ?? 0) - (a.nb_fan ?? 0))[0];
}

/** Deezer serves a generic silhouette for artists without a photo; its URL has an empty hash. */
export function hasRealPicture(url: string | undefined): url is string {
  return !!url && !/\/images\/artist\/\//.test(url);
}
