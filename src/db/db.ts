import { Dexie, type EntityTable, type Table } from 'dexie';
import { danceEventDefaults } from '../domain/segments';
import type { CompEvent, Competition, Dance, Entry, Judge, Mark, Skater } from '../domain/types';

export type MarkPK = [string, string, string, string]; // [eventId, segmentKey, judgeId, entryId]

export class PodiumDB extends Dexie {
  competitions!: EntityTable<Competition, 'id'>;
  dances!: EntityTable<Dance, 'id'>;
  events!: EntityTable<CompEvent, 'id'>;
  skaters!: EntityTable<Skater, 'id'>;
  entries!: EntityTable<Entry, 'id'>;
  judges!: EntityTable<Judge, 'id'>;
  marks!: Table<Mark, MarkPK>;

  constructor(name = 'podium') {
    super(name);
    this.version(1).stores({
      competitions: 'id, updatedAt',
      dances: 'id, competitionId',
      events: 'id, competitionId, [competitionId+order]',
      skaters: 'id, competitionId',
      entries: 'id, eventId, [eventId+startOrder]',
      judges: 'id, competitionId',
      marks: '[eventId+segmentKey+judgeId+entryId], eventId, entryId, judgeId',
    });
    // Figures & free events: existing events are dance events.
    this.version(2)
      .stores({})
      .upgrade((tx) =>
        tx
          .table('events')
          .toCollection()
          .modify((ev: CompEvent) => Object.assign(ev, { ...danceEventDefaults(), ...ev })),
      );
  }
}

export const db = new PodiumDB();

export const newId = () => crypto.randomUUID();
