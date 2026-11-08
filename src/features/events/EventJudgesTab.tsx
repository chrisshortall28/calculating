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
import {
  IconArrowsExchange,
  IconFlag,
  IconFlagFilled,
  IconInfoCircle,
  IconPencil,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useState } from 'react';
import { useJudges } from '../../app/data';
import { SortableList } from '../../app/SortableList';
import { startsWithFilter } from '../../app/nameFilter';
import { marksAffectedByEventChange, updateEvent } from '../../db/repo';
import { byId } from '../../domain/entryName';
import type { CompEvent, Judge } from '../../domain/types';
import { confirmMarkLoss } from './confirmMarkLoss';
import { EditLock, isFinal } from './EditLock';
import { ChangeJudgeModal, RenameJudgeModal, resolveJudge } from './PanelJudgeModals';
import { SectionJudges } from './SectionJudges';

export function EventJudgesTab({ event }: { event: CompEvent }) {
  const judgeList = useJudges(event.competitionId) ?? [];
  const judges = byId(judgeList);
  const [name, setName] = useState('');
  const [renaming, setRenaming] = useState<string>();
  const [changing, setChanging] = useState<string>();
  const panel = event.judgeIds.map((id) => judges.get(id)).filter((j) => !!j);
  const available = judgeList.filter((j) => !event.judgeIds.includes(j.id)).map((j) => j.name);
  const addJudgeToPanel = async (judgeName: string) => {
    const n = judgeName.trim();
    if (!n) return;
    const id = await resolveJudge(event.competitionId, n, judgeList);
    if (!event.judgeIds.includes(id)) await updateEvent(event.id, { judgeIds: [...event.judgeIds, id] });
    setName('');
  };

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    void addJudgeToPanel(name);
  };

  const remove = async (judgeId: string) => {
    const judgeIds = event.judgeIds.filter((j) => j !== judgeId);
    const lost = await marksAffectedByEventChange(event.id, { judgeIds });
    confirmMarkLoss(lost, `Removing ${judges.get(judgeId)?.name} from the panel`, () =>
      updateEvent(event.id, { judgeIds }),
    );
  };

  const setReferee = (refereeId: string | undefined) => updateEvent(event.id, { refereeId });

  return (
    <EditLock locked={isFinal(event)} what="judges" maw={640}>
      <Stack>
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
                filter={startsWithFilter}
                value={name}
                onChange={setName}
                // Picking from the list adds straight away (the async add clears the box after Mantine fills it).
                onOptionSubmit={(v) => void addJudgeToPanel(v)}
                maxDropdownHeight={280}
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
                    <Tooltip label="Rename">
                      <ActionIcon
                        variant="subtle"
                        onClick={() => setRenaming(judge.id)}
                        aria-label={`Rename ${judge.name}`}
                      >
                        <IconPencil size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Change judge">
                      <ActionIcon
                        variant="subtle"
                        onClick={() => setChanging(judge.id)}
                        aria-label={`Change ${judge.name} to another judge`}
                      >
                        <IconArrowsExchange size={16} />
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

        <SectionJudges event={event} />

        <OfficialCard
          event={event}
          field="refereeId"
          title="Referee"
          none="No referee assigned yet. The referee can also be one of the judges."
          roster={judgeList}
          panel={panel}
        />
        <OfficialCard
          event={event}
          field="assistantRefereeId"
          title="Assistant referee"
          none="No assistant referee assigned yet."
          roster={judgeList}
          panel={panel}
        />
        <RenameJudgeModal
          judge={judges.get(renaming ?? '')}
          roster={judgeList}
          onClose={() => setRenaming(undefined)}
        />
        <ChangeJudgeModal
          event={event}
          judge={judges.get(changing ?? '')}
          seat={event.judgeIds.indexOf(changing ?? '') + 1}
          roster={judgeList}
          onClose={() => setChanging(undefined)}
        />
      </Stack>
    </EditLock>
  );
}

/** The event's referee or assistant referee: shown with a button to remove, and a box to pick or type another. */
function OfficialCard({
  event,
  field,
  title,
  none,
  roster,
  panel,
}: {
  event: CompEvent;
  field: 'refereeId' | 'assistantRefereeId';
  title: string;
  none: string;
  roster: Judge[];
  panel: Judge[];
}) {
  const [name, setName] = useState('');
  const currentId = event[field];
  const current = roster.find((j) => j.id === currentId);
  const panelPos = currentId ? event.judgeIds.indexOf(currentId) : -1;
  const role = title.toLowerCase();
  // Panel members first: the referee is often one of the judges.
  const options = [...panel, ...roster.filter((j) => !event.judgeIds.includes(j.id))]
    .filter((j) => j.id !== currentId)
    .map((j) => j.name);

  const set = (id: string | undefined) => updateEvent(event.id, { [field]: id });
  const choose = async (chosen: string) => {
    const n = chosen.trim();
    if (!n) return;
    await set(await resolveJudge(event.competitionId, n, roster));
    setName('');
  };

  return (
    <Card withBorder>
      <Title order={5} mb="xs">
        {title}
      </Title>
      {current ? (
        <Group justify="space-between" mb="sm">
          <Group gap="xs">
            <IconFlagFilled size={16} color="var(--mantine-color-grape-6)" />
            <Text fw={500}>{current.name}</Text>
            {panelPos >= 0 && (
              <Text size="sm" c="dimmed">
                (also judge J{panelPos + 1})
              </Text>
            )}
          </Group>
          <Tooltip label={`Remove ${role}`}>
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={() => set(undefined)}
              aria-label={`Remove ${role}`}
            >
              <IconX size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      ) : (
        <Text size="sm" c="dimmed" mb="sm">
          {none}
        </Text>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void choose(name);
        }}
      >
        <Group align="flex-end">
          <Autocomplete
            label={`${current ? 'Change' : 'Set'} ${role}`}
            description="Pick a judge or type a new name"
            data={options}
            filter={startsWithFilter}
            value={name}
            onChange={setName}
            onOptionSubmit={(v) => void choose(v)}
            maxDropdownHeight={280}
            style={{ flex: 1 }}
          />
          <Button type="submit" variant="light" color="grape">
            Set
          </Button>
        </Group>
      </form>
    </Card>
  );
}
