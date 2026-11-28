import { fetchWithRetry, sleep } from './http';
import { pickDeezerMatch, type DeezerArtist } from './concerts';

const BASE = 'https://api.deezer.com';

/** Deezer reports errors (including its quota, 50 requests / 5 s) as 200 + { error }. */
async function get<T>(path: string): Promise<T> {
  for (let i = 0; i < 4; i++) {
    const res = await fetchWithRetry(`${BASE}${path}`);
    if (!res.ok) throw new Error(`Deezer: ${res.status} for ${path}`);
    const body = (await res.json()) as T & { error?: { code?: number; message?: string } };
    if (!body.error) return body;
    if (body.error.code !== 4) throw new Error(`Deezer: ${body.error.message} for ${path}`);
    await sleep(5000); // quota exceeded
  }
  throw new Error(`Deezer: still over quota for ${path}`);
}

export async function getArtist(id: number): Promise<DeezerArtist> {
  return get<DeezerArtist>(`/artist/${id}`);
}

export async function findArtist(name: string): Promise<DeezerArtist | undefined> {
  const body = await get<{ data: DeezerArtist[] }>(`/search/artist?q=${encodeURIComponent(name)}&limit=25`);
  return pickDeezerMatch(name, body.data ?? []);
}
