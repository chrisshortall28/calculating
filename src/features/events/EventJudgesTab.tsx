import {
  ActionIcon,
  Alert,
  Autocomplete,
  Badge,
  Button,
  Card,
  Group,
  Paper,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { IconFlag, IconFlagFilled, IconInfoCircle, IconTrash, IconX } from '@tabler/icons-react';
import { useState } from 'react';
import { useJudges } from '../../app/data';
import { SortableList } from '../../app/SortableList';
import { addJudge, marksAffectedByEventChange, updateEvent } from '../../db/repo';
import { byId } from '../../domain/entryName';
import type { CompEvent, Judge } from '../../domain/types';
import { confirmMarkLoss } from './confirmMarkLoss';

/** Finds a roster judge by name (case-insensitive), creating one if needed. */
async function resolveJudge(competitionId: string, name: string, roster: Judge[]) {
  const existing = roster.find((j) => j.name.toLowerCase() === name.toLowerCase());
  return existing?.id ?? addJudge(competitionId, name);
}

export function EventJudgesTab({ event }: { event: CompEvent }) {
  const judgeList = useJudges(event.competitionId) ?? [];
  const judges = byId(judgeList);
  const [name, setName] = useState('');
  const [refName, setRefName] = useState('');
  const panel = event.judgeIds.map((id) => judges.get(id)).filter((j) => !!j);
  const available = judgeList.filter((j) => !event.judgeIds.includes(j.id)).map((j) => j.name);
  const referee = event.refereeId ? judges.get(event.refereeId) : undefined;
  const refereePanelPos = event.refereeId ? event.judgeIds.indexOf(event.refereeId) : -1;
  // Panel members first — the referee is often one of the judges.
  const refereeOptions = [...panel, ...judgeList.filter((j) => !event.judgeIds.includes(j.id))]
    .filter((j) => j.id !== event.refereeId)
    .map((j) => j.name);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    const id = await resolveJudge(event.competitionId, n, judgeList);
    if (!event.judgeIds.includes(id)) await updateEvent(event.id, { judgeIds: [...event.judgeIds, id] });
    setName('');
  };

  const remove = async (judgeId: string) => {
    const judgeIds = event.judgeIds.filter((j) => j !== judgeId);
    const lost = await marksAffectedByEventChange(event.id, { judgeIds });
    confirmMarkLoss(lost, `Removing ${judges.get(judgeId)?.name} from the panel`, () =>
      updateEvent(event.id, { judgeIds }),
    );
  };

  const setReferee = (refereeId: string | undefined) => updateEvent(event.id, { refereeId });

  const submitReferee = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = refName.trim();
    if (!n) return;
    await setReferee(await resolveJudge(event.competitionId, n, judgeList));
    setRefName('');
  };

  return (
    <Stack maw={640}>
      {panel.length === 0 && (
        <Alert icon={<IconInfoCircle />} color="blue" variant="light">
          No judges assigned yet. Judges can be added any time before scoring — usually on the day.
        </Alert>
      )}
      {panel.length % 2 === 0 && panel.length > 0 && (
        <Alert color="orange" variant="light">
          An odd number of judges is usual; with {panel.length} judges a majority is {panel.length / 2 + 1}.
        </Alert>
      )}
      <Card withBorder>
        <Title order={5} mb="xs">
          Judges
        </Title>
        <form onSubmit={add}>
          <Group align="flex-end">
            <Autocomplete
              label="Add judge to panel"
              description="Pick an existing judge or type a new name"
              data={available}
              value={name}
              onChange={setName}
              style={{ flex: 1 }}
            />
            <Button type="submit">Add</Button>
          </Group>
        </form>
      </Card>
      <div>
        <SortableList
          items={panel}
          onReorder={(judgeIds) => updateEvent(event.id, { judgeIds })}
          renderItem={(judge, index, handle) => {
            const isReferee = judge.id === event.refereeId;
            return (
              <Paper withBorder px="sm" py={6} mb={4}>
                <Group wrap="nowrap">
                  {handle}
                  <Text fw={700} w={32} c="dimmed">
                    J{index + 1}
                  </Text>
                  <Text style={{ flex: 1 }}>{judge.name}</Text>
                  {isReferee && (
                    <Badge variant="light" color="grape">
                      Referee
                    </Badge>
                  )}
                  <Tooltip label={isReferee ? 'Referee' : 'Make referee'}>
                    <ActionIcon
                      variant="subtle"
                      color="grape"
                      onClick={() => setReferee(judge.id)}
                      disabled={isReferee}
                      aria-label={`Make ${judge.name} referee`}
                    >
                      {isReferee ? <IconFlagFilled size={16} /> : <IconFlag size={16} />}
                    </ActionIcon>
                  </Tooltip>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    onClick={() => remove(judge.id)}
                    aria-label="Remove judge from panel"
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              </Paper>
            );
          }}
        />
      </div>

      <Card withBorder>
        <Title order={5} mb="xs">
          Referee
        </Title>
        {referee ? (
          <Group justify="space-between" mb="sm">
            <Group gap="xs">
              <IconFlagFilled size={16} color="var(--mantine-color-grape-6)" />
              <Text fw={500}>{referee.name}</Text>
              {refereePanelPos >= 0 && (
                <Text size="sm" c="dimmed">
                  (also judge J{refereePanelPos + 1})
                </Text>
              )}
            </Group>
            <Tooltip label="Remove referee">
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={() => setReferee(undefined)}
                aria-label="Remove referee"
              >
                <IconX size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ) : (
          <Text size="sm" c="dimmed" mb="sm">
            No referee assigned yet. The referee can also be one of the judges.
          </Text>
        )}
        <form onSubmit={submitReferee}>
          <Group align="flex-end">
            <Autocomplete
              label={referee ? 'Change referee' : 'Set referee'}
              description="Pick a judge or type a new name"
              data={refName.trim() ? refereeOptions : []}
              value={refName}
              onChange={setRefName}
              style={{ flex: 1 }}
            />
            <Button type="submit" variant="light" color="grape">
              Set
            </Button>
          </Group>
        </form>
      </Card>
    </Stack>
  );
}
