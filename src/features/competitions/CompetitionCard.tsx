import { Button, Group, Modal, Progress, Stack, Text, UnstyledButton, type ButtonProps } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconMapPin, IconPlus, IconTrophy } from '@tabler/icons-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate } from 'react-router';
import { clubColors, clubVars } from '../../app/clubColors';
import { dateTile } from '../../app/format';
import { db } from '../../db/db';
import { createCompetition } from '../../db/repo';
import type { Competition } from '../../domain/types';
import { CompetitionDetailsForm, emptyCompetitionDetails } from './CompetitionDetailsForm';
import classes from './CompetitionCard.module.css';

export interface CompetitionStats {
  events: number;
  final: number;
  entries: number;
}

/** Event, final-event and entry counts for every competition, keyed by competition id. */
export function useCompetitionStats() {
  return useLiveQuery(async () => {
    const byComp = new Map<string, CompetitionStats>();
    const compOfEvent = new Map<string, string>();
    const get = (id: string) => {
      let s = byComp.get(id);
      if (!s) byComp.set(id, (s = { events: 0, final: 0, entries: 0 }));
      return s;
    };
    await db.events.each((e) => {
      compOfEvent.set(e.id, e.competitionId);
      const s = get(e.competitionId);
      s.events++;
      if (e.status === 'final') s.final++;
    });
    await db.entries.each((en) => {
      const comp = compOfEvent.get(en.eventId);
      if (comp) get(comp).entries++;
    });
    return byComp;
  });
}

/** A competition as a club-coloured card linking to it. */
export function CompetitionCard({
  competition: c,
  stats: s = { events: 0, final: 0, entries: 0 },
}: {
  competition: Competition;
  stats?: CompetitionStats;
}) {
  const tile = dateTile(c.date);
  return (
    <UnstyledButton
      component={Link}
      to={`/c/${c.id}`}
      className={classes.card}
      style={clubVars(clubColors(c))}
    >
      <div className={classes.band}>
        <div className={classes.dateTile}>
          {tile ? (
            <>
              <span className={classes.day}>{tile.day}</span>
              <span className={classes.month}>{tile.month}</span>
            </>
          ) : (
            <IconTrophy size={22} />
          )}
        </div>
        <Text className={classes.name} lineClamp={2}>
          {c.name}
        </Text>
      </div>
      <Stack gap="sm" p="md">
        <Group gap={6} c="dimmed" wrap="nowrap">
          <IconMapPin size={16} />
          <Text size="sm" truncate>
            {c.venue || 'No venue set'}
          </Text>
        </Group>
        <Group grow gap="xs">
          <Stat label="Events" value={s.events} />
          <Stat label="Entries" value={s.entries} />
          <Stat label="Final" value={`${s.final}/${s.events}`} />
        </Group>
        <Progress
          value={s.events ? (100 * s.final) / s.events : 0}
          color={s.events && s.final === s.events ? 'teal' : 'medal.5'}
          size="sm"
        />
      </Stack>
    </UnstyledButton>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className={classes.stat}>
      <span className={classes.statValue}>{value}</span>
      <span className={classes.statLabel}>{label}</span>
    </div>
  );
}

/** "New competition" button that opens the details form and goes to the competition once created. */
export function NewCompetitionButton(props: ButtonProps) {
  const navigate = useNavigate();
  const [opened, { open, close }] = useDisclosure(false);
  return (
    <>
      <Button color="medal.5" c="navy.9" leftSection={<IconPlus size={16} />} {...props} onClick={open}>
        New competition
      </Button>
      <Modal opened={opened} onClose={close} title="New competition">
        <CompetitionDetailsForm
          initial={emptyCompetitionDetails()}
          submitLabel="Create"
          onSubmit={async (values) => {
            const id = await createCompetition(values);
            close();
            navigate(`/c/${id}`);
          }}
        />
      </Modal>
    </>
  );
}
