import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { danceEventDefaults } from '../domain/segments';
import { db } from './db';
import * as repo from './repo';

async function seed() {
  const compId = await repo.createCompetition({ name: 'Spring Open', date: '2026-10-01', venue: 'Rink' });
  const eventId = await repo.createEvent(compId, {
    name: 'Novice Solo',
    entryType: 'solo',
    compulsoryDanceIds: [],
    hasFreeDance: true,
    ...danceEventDefaults(),
  });
  const s1 = await repo.addSkater(compId, { name: 'Ann', club: 'A' });
  const s2 = await repo.addSkater(compId, { name: 'Bea', club: 'B' });
  const status = async () => (await db.events.get(eventId))!.status;
  return { compId, eventId, s1, s2, status };
}

describe('event ready status', () => {
  it('starts in setup, becomes ready with the first entry, and goes back to setup when all are removed', async () => {
    const { eventId, s1, s2, status } = await seed();
    expect(await status()).toBe('setup');
    const e1 = await repo.addEntry(eventId, { skaterIds: [s1] });
    expect(await status()).toBe('ready');
    const e2 = await repo.addEntry(eventId, { skaterIds: [s2] });
    await repo.deleteEntry(e1);
    expect(await status()).toBe('ready');
    await repo.deleteEntry(e2);
    expect(await status()).toBe('setup');
  });

  it('goes back to setup when deleting a skater empties the event', async () => {
    const { eventId, s1, status } = await seed();
    await repo.addEntry(eventId, { skaterIds: [s1] });
    expect(await status()).toBe('ready');
    await repo.deleteSkater(s1);
    expect(await status()).toBe('setup');
  });

  it('leaves scoring and final events alone', async () => {
    const { eventId, s1, status } = await seed();
    const e1 = await repo.addEntry(eventId, { skaterIds: [s1] });
    await repo.setEventStatus(eventId, 'scoring');
    await repo.deleteEntry(e1);
    expect(await status()).toBe('scoring');
    await repo.addEntry(eventId, { skaterIds: [s1] });
    await repo.setEventStatus(eventId, 'final');
    await repo.addEntry(eventId, { skaterIds: [s1] });
    expect(await status()).toBe('final');
  });
});
