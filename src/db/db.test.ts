import 'fake-indexeddb/auto';
import { Dexie } from 'dexie';
import { expect, it } from 'vitest';
import { PodiumDB } from './db';

it('upgrades events stored before figures & free to dance events', async () => {
  const old = new Dexie('upgrade-test');
  old.version(1).stores({ events: 'id, competitionId, [competitionId+order]' });
  await old
    .table('events')
    .add({ id: 'e1', competitionId: 'c', order: 0, compulsoryDanceIds: [], hasFreeDance: true });
  old.close();

  const db = new PodiumDB('upgrade-test');
  expect(await db.events.get('e1')).toMatchObject({
    hasFreeDance: true,
    discipline: 'dance',
    figures: [],
    hasShort: false,
    hasLong: false,
    factors: { figures: 100, short: 100, long: 100 },
  });
  db.close();
});
