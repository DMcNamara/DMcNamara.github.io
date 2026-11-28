/**
 * setlist.fm "attended" -> top 10 most seen + 10 most recent artists -> Deezer details and photos
 * -> src/data/concerts.json + src/assets/artists/<mbid>.jpg
 *
 * Usage:
 *   npm run sync:concerts               # writes the JSON and images
 *   npm run sync:concerts -- --dry-run  # prints the JSON, writes nothing
 *
 * Env: SETLISTFM_API_KEY, optional SETLISTFM_USER (default dmcnamara1). Reads .env when present.
 *
 * Deezer matches are by name, so a wrong or missing match can be pinned in
 * src/data/artist-overrides.json: { "<musicbrainz id>": { "deezerId": 1234 } } (null = no photo).
 * A match, once made, is reused on later runs from the previous concerts.json.
 */
import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { fetchAttended } from './lib/setlistfm';
import { findArtist, getArtist } from './lib/deezer';
import { fetchWithRetry } from './lib/http';
import { hasRealPicture, normalize, recentArtists, stats, topSeen, type DeezerArtist } from './lib/concerts';
import { concertsSchema, type Concerts } from '../src/lib/concerts-schema';

const OUT = fileURLToPath(new URL('../src/data/concerts.json', import.meta.url));
const OVERRIDES = fileURLToPath(new URL('../src/data/artist-overrides.json', import.meta.url));
const IMG_DIR = fileURLToPath(new URL('../src/assets/artists/', import.meta.url));
const dryRun = process.argv.includes('--dry-run');

try {
  process.loadEnvFile();
} catch {
  // No .env: rely on the environment (CI).
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

const toHex = (n: number) => n.toString(16).padStart(2, '0');

/** Downloads the photo, stores an 800px JPEG, and returns its average color (the placeholder while it loads). */
async function savePhoto(url: string, file: string): Promise<string> {
  const res = await fetchWithRetry(url);
  if (!res.ok) throw new Error(`Image ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const [r, g, b] = await sharp(buf).removeAlpha().resize(1, 1, { fit: 'fill' }).raw().toBuffer();
  if (!dryRun) {
    await sharp(buf).resize(800, 800, { fit: 'cover' }).jpeg({ quality: 82, mozjpeg: true }).toFile(`${IMG_DIR}${file}`);
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

async function main() {
  const apiKey = process.env.SETLISTFM_API_KEY;
  if (!apiKey) throw new Error('SETLISTFM_API_KEY is not set');
  const user = process.env.SETLISTFM_USER || 'dmcnamara1';

  console.log(`Fetching attended shows for ${user}…`);
  const apps = normalize(await fetchAttended(user, apiKey));
  console.log(`Got ${apps.length} artist sets.`);

  const top = topSeen(apps);
  const recent = recentArtists(apps);

  const previous = await readJson<Partial<Concerts>>(OUT, {});
  const overrides = await readJson<Record<string, { deezerId?: number | null }>>(OVERRIDES, {});
  // Matches found on earlier runs; a past miss is searched again.
  const knownIds = new Map<string, number>();
  for (const a of [...(previous.topSeen ?? []), ...(previous.recent ?? [])]) {
    if (a.deezerId !== null) knownIds.set(a.mbid, a.deezerId);
  }

  // Look each artist up once, even if it's in both lists.
  const wanted = new Map<string, { name: string; artistUrl: string }>();
  for (const t of top) wanted.set(t.artistKey, { name: t.name, artistUrl: t.artistUrl });
  for (const r of recent) wanted.set(r.artistKey, { name: r.artistName, artistUrl: r.artistUrl });

  if (!dryRun) await mkdir(IMG_DIR, { recursive: true });
  const details = new Map<string, Concerts['topSeen'][number]>();
  for (const [mbid, { name, artistUrl }] of wanted) {
    const override = overrides[mbid]?.deezerId;
    const id = override !== undefined ? override : knownIds.get(mbid);
    let artist: DeezerArtist | undefined;
    if (typeof id === 'number') artist = await getArtist(id);
    else if (id !== null) artist = await findArtist(name);

    const entry: Concerts['topSeen'][number] = {
      mbid,
      name,
      setlistUrl: artistUrl,
      deezerId: artist?.id ?? null,
      count: 0,
      firstSeen: '',
      lastSeen: '',
    };
    if (artist) {
      entry.deezerUrl = artist.link;
      if (artist.nb_fan !== undefined) entry.fans = artist.nb_fan;
      if (hasRealPicture(artist.picture_xl)) {
        const file = `${mbid.replace(/[^\w-]/g, '_')}.jpg`;
        try {
          entry.color = await savePhoto(artist.picture_xl, file);
          entry.image = file;
        } catch (err) {
          console.warn(`  ${name}: photo failed (${(err as Error).message})`);
        }
      }
    }
    console.log(`  ${name}: ${artist ? `Deezer ${artist.id}${entry.image ? '' : ', no photo'}` : 'no Deezer match'}`);
    details.set(mbid, entry);
  }

  const pick = (mbid: string) => {
    const { count, firstSeen, lastSeen, ...rest } = details.get(mbid)!;
    return rest;
  };
  const data = {
    updatedAt: new Date().toISOString().slice(0, 10),
    stats: stats(apps),
    topSeen: top.map((t) => ({ ...pick(t.artistKey), count: t.count, firstSeen: t.firstSeen, lastSeen: t.lastSeen })),
    recent: recent.map((r) => ({
      ...pick(r.artistKey),
      date: r.date,
      venue: r.venue,
      city: r.city,
      ...(r.tour ? { tour: r.tour } : {}),
      showUrl: r.showUrl,
    })),
  };

  // Keep the old date when nothing else changed, so a quiet week makes no commit.
  if (previous.updatedAt) {
    const same = concertsSchema.parse({ ...data, updatedAt: previous.updatedAt });
    if (JSON.stringify(same) === JSON.stringify(previous)) data.updatedAt = previous.updatedAt;
  }
  const concerts = concertsSchema.parse(data);
  const json = JSON.stringify(concerts, null, 2) + '\n';
  if (dryRun) {
    console.log(json);
    return;
  }
  await writeFile(OUT, json);

  // Drop photos of artists who fell off both lists.
  const used = new Set([...concerts.topSeen, ...concerts.recent].map((a) => a.image).filter(Boolean));
  for (const f of await readdir(IMG_DIR)) {
    if (f.endsWith('.jpg') && !used.has(f)) await unlink(`${IMG_DIR}${f}`);
  }
  console.log(`Wrote ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
