import { ActionIcon, Alert, Autocomplete, Button, Card, Group, Paper, Stack, Text } from '@mantine/core';
import { IconInfoCircle, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import { useJudges } from '../../app/data';
import { SortableList } from '../../app/SortableList';
import { addJudge, marksAffectedByEventChange, updateEvent } from '../../db/repo';
import { byId } from '../../domain/entryName';
import type { CompEvent } from '../../domain/types';
import { confirmMarkLoss } from './confirmMarkLoss';

export function EventJudgesTab({ event }: { event: CompEvent }) {
  const judgeList = useJudges(event.competitionId) ?? [];
  const judges = byId(judgeList);
  const [name, setName] = useState('');
  const panel = event.judgeIds.map((id) => judges.get(id)).filter((j) => !!j);
  const available = judgeList.filter((j) => !event.judgeIds.includes(j.id)).map((j) => j.name);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    const existing = judgeList.find((j) => j.name.toLowerCase() === n.toLowerCase());
    if (existing && event.judgeIds.includes(existing.id)) return setName('');
    const id = existing?.id ?? (await addJudge(event.competitionId, n));
    await updateEvent(event.id, { judgeIds: [...event.judgeIds, id] });
    setName('');
  };

  const remove = async (judgeId: string) => {
    const judgeIds = event.judgeIds.filter((j) => j !== judgeId);
    const lost = await marksAffectedByEventChange(event.id, { judgeIds });
    confirmMarkLoss(lost, `Removing ${judges.get(judgeId)?.name} from the panel`, () =>
      updateEvent(event.id, { judgeIds }),
    );
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
          renderItem={(judge, index, handle) => (
            <Paper withBorder px="sm" py={6} mb={4}>
              <Group wrap="nowrap">
                {handle}
                <Text fw={700} w={32} c="dimmed">
                  J{index + 1}
                </Text>
                <Text style={{ flex: 1 }}>{judge.name}</Text>
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
          )}
        />
      </div>
    </Stack>
  );
}
