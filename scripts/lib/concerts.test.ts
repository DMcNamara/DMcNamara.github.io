import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hasRealPicture,
  normalize,
  normalizeName,
  parseEventDate,
  pickDeezerMatch,
  recentArtists,
  stats,
  topSeen,
  type Setlist,
} from './concerts';
import { concertsSchema } from '../../src/lib/concerts-schema';
import concertsJson from '../../src/data/concerts.json';

function sl(artist: string, date: string, venue = 'Roadrunner'): Setlist {
  return {
    id: `${artist}-${date}`,
    eventDate: date,
    url: `https://www.setlist.fm/setlist/${artist}/${date}.html`,
    artist: { mbid: `mbid-${artist}`, name: artist, url: `https://www.setlist.fm/setlists/${artist}.html` },
    venue: { id: venue, name: venue, city: { name: 'Boston', stateCode: 'MA', country: { code: 'US' } } },
  };
}

test('parseEventDate converts dd-MM-yyyy to ISO', () => {
  assert.equal(parseEventDate('01-11-2026'), '2026-11-01');
  assert.throws(() => parseEventDate('2026-11-01'));
});

test('normalize builds a US city label and falls back to the name without an mbid', () => {
  const s = sl('A', '01-02-2020');
  s.artist.mbid = '';
  const [a] = normalize([s]);
  assert.equal(a.city, 'Boston, MA');
  assert.equal(a.artistKey, 'name:a');
  assert.equal(a.date, '2020-02-01');
});

test('topSeen counts each show once and breaks ties by most recent, then name', () => {
  const apps = normalize([
    sl('A', '01-01-2020'),
    sl('A', '01-01-2020'), // duplicate entry, same show
    sl('A', '01-01-2021'),
    sl('B', '01-01-2019'),
    sl('B', '01-01-2022'),
    sl('C', '01-01-2022'),
    sl('C', '01-01-2018'),
    sl('D', '05-05-2023'),
  ]);
  const top = topSeen(apps, 3);
  assert.deepEqual(
    top.map((t) => [t.name, t.count]),
    [['B', 2], ['C', 2], ['A', 2]],
  );
  assert.equal(top[1].firstSeen, '2018-01-01');
  assert.equal(top[1].lastSeen, '2022-01-01');
});

test('recentArtists returns distinct artists, newest first', () => {
  const apps = normalize([sl('A', '01-01-2020'), sl('B', '01-06-2024'), sl('A', '01-03-2025'), sl('C', '01-01-2023')]);
  const recent = recentArtists(apps, 2);
  assert.deepEqual(
    recent.map((r) => [r.artistName, r.date]),
    [['A', '2025-03-01'], ['B', '2024-06-01']],
  );
});

test('stats counts shows by date and venue, not artist sets', () => {
  const apps = normalize([sl('A', '01-01-2020'), sl('B', '01-01-2020'), sl('A', '02-02-2021', 'Paradise')]);
  assert.deepEqual(stats(apps), { shows: 2, artists: 2, venues: 2, since: '2020-01-01' });
});

test('normalizeName ignores case, accents, "the" and punctuation', () => {
  assert.equal(normalizeName('The Beatles'), normalizeName('beatles'));
  assert.equal(normalizeName('Florence + the Machine'), normalizeName('Florence + The Machine'));
  assert.equal(normalizeName('Beyoncé'), 'beyonce');
  assert.equal(normalizeName('Simon & Garfunkel'), 'simonandgarfunkel');
});

test('pickDeezerMatch takes the exact name match with the most fans', () => {
  const results = [
    { id: 1, name: 'Father John Misty', link: '', nb_fan: 50000 },
    { id: 2, name: 'Wilco', link: '', nb_fan: 10 },
    { id: 3, name: 'WILCO', link: '', nb_fan: 90000 },
  ];
  assert.equal(pickDeezerMatch('Wilco', results)?.id, 3);
  assert.equal(pickDeezerMatch('Jeff Tweedy', results), undefined);
});

test('hasRealPicture rejects the Deezer placeholder', () => {
  assert.equal(hasRealPicture('https://cdn-images.dzcdn.net/images/artist/9a9a/1000x1000-000000-80-0-0.jpg'), true);
  assert.equal(hasRealPicture('https://cdn-images.dzcdn.net/images/artist//1000x1000-000000-80-0-0.jpg'), false);
  assert.equal(hasRealPicture(undefined), false);
});

test('committed concerts.json matches the schema', () => {
  concertsSchema.parse(concertsJson);
});
