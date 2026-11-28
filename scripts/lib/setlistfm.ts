import { fetchWithRetry, sleep } from './http';
import type { Setlist } from './concerts';

const BASE = 'https://api.setlist.fm/rest/1.0';

/** Every setlist the user marked as attended. 20 per page; setlist.fm allows ~2 requests/second. */
export async function fetchAttended(user: string, apiKey: string): Promise<Setlist[]> {
  const all: Setlist[] = [];
  for (let page = 1; ; page++) {
    const res = await fetchWithRetry(`${BASE}/user/${encodeURIComponent(user)}/attended?p=${page}`, {
      headers: { 'x-api-key': apiKey, Accept: 'application/json' },
    });
    // Past the last page setlist.fm answers 404.
    if (res.status === 404 && page > 1) break;
    if (!res.ok) throw new Error(`setlist.fm: ${res.status} ${res.statusText} (page ${page})`);
    const body = (await res.json()) as { setlist?: Setlist[]; total: number; itemsPerPage: number };
    all.push(...(body.setlist ?? []));
    if (page * body.itemsPerPage >= body.total || !body.setlist?.length) break;
    await sleep(600);
  }
  return all;
}
