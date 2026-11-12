import { Button, Group, Paper, Stack, Text, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconDice5, IconSortDescending } from '@tabler/icons-react';
import { useMarks } from '../../app/data';
import { SortableList } from '../../app/SortableList';
import { setPartOrder } from '../../db/repo';
import { entryClub, entryName } from '../../domain/entryName';
import { indexMarks, markKey } from '../../domain/markIndex';
import { seatMark } from '../../domain/panels';
import { reverseOrderBySoFar } from '../../domain/reverseOrder';
import { eventTieBreakMarks, type Segment } from '../../domain/segments';
import { shuffled } from '../../domain/shuffle';
import { resolvePartOrder } from '../../domain/startOrder';
import type { CompEvent, Entry, Skater } from '../../domain/types';

/**
 * The skating order of one later part (the free dance, short or free programme). It follows the event's start
 * order until it is given an order of its own, which can be dragged about, shuffled, or set from the placings
 * after the parts before it (lowest placed first).
 */
export function PartOrderPanel({
  event,
  entries,
  skaters,
  segments,
  segment,
}: {
  event: CompEvent;
  /** The entries in the event's start order. */
  entries: Entry[];
  skaters: Map<string, Skater>;
  segments: Segment[];
  segment: Segment;
}) {
  const marks = useMarks(event.id);
  const entryIds = entries.map((e) => e.id);
  const saved = event.partOrders?.[segment.id];
  const order = saved ? resolvePartOrder(entryIds, saved) : entryIds;
  const entryOf = new Map(entries.map((e) => [e.id, e]));
  const startNumber = new Map(entryIds.map((id, i) => [id, i + 1]));
  const items = order.map((id) => entryOf.get(id)!);
  const earlier = segments.slice(0, segments.indexOf(segment));

  const save = (ids: string[]) => setPartOrder(event.id, segment.id, ids);

  // The lowest placed after the parts before this one skates first.
  const fromResults = () => {
    const markMap = indexMarks(marks);
    const reversed = reverseOrderBySoFar({
      entryIds: order,
      judgeIds: event.judgeIds,
      segments: earlier,
      mark: seatMark(event, (k, j, e) => markMap.get(markKey(k, j, e))),
      tieBreakMarks: eventTieBreakMarks(event),
    });
    if (!reversed) {
      notifications.show({
        color: 'orange',
        message: `None of the parts before the ${segment.name} has all its marks entered yet, so there are no placings to go by.`,
      });
      return;
    }
    void save(reversed.order);
    notifications.show({
      color: 'green',
      message: `${segment.name}: lowest placed skates first, from the placings after ${reversed.basedOn.join(', ')}`,
    });
  };

  return (
    <Stack>
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          {saved
            ? `${segment.name} has its own skating order · drag to reorder`
            : `${segment.name} follows the start order. Set an order of its own to change it.`}
        </Text>
        <Group gap="xs">
          <Tooltip label={`Lowest placed after ${earlier.map((s) => s.name).join(', ')} skates first`}>
            <Button
              variant="light"
              size="xs"
              leftSection={<IconSortDescending size={16} />}
              disabled={entries.length < 2}
              onClick={fromResults}
            >
              Set from results so far
            </Button>
          </Tooltip>
          <Button
            variant="light"
            size="xs"
            leftSection={<IconDice5 size={16} />}
            disabled={entries.length < 2}
            onClick={() => void save(shuffled(order))}
          >
            Randomise order
          </Button>
          {saved && (
            <Button
              variant="default"
              size="xs"
              onClick={() => void setPartOrder(event.id, segment.id, undefined)}
            >
              Follow the start order
            </Button>
          )}
        </Group>
      </Group>
      <div>
        <SortableList
          items={items}
          onReorder={save}
          renderItem={(entry, index, handle) => (
            <Paper withBorder px="sm" py={6} mb={4} opacity={saved ? 1 : 0.65}>
              <Group wrap="nowrap" gap="sm">
                {handle}
                <Text fw={700} w={28} ta="right" c="dimmed">
                  {index + 1}
                </Text>
                <Text fw={500} truncate style={{ flex: 1, minWidth: 0 }}>
                  {entryName(entry, skaters)}
                </Text>
                <Text size="sm" c="dimmed" w={180} truncate>
                  {entryClub(entry, skaters)}
                </Text>
                <Text size="xs" c="dimmed" w={110} ta="right">
                  #{startNumber.get(entry.id)} in start order
                </Text>
              </Group>
            </Paper>
          )}
        />
      </div>
    </Stack>
  );
}
