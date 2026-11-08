import { Button, Menu } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconChevronDown, IconFileTypePdf } from '@tabler/icons-react';
import { useState } from 'react';
import { segmentNoun } from '../../domain/segments';
import type { CompEvent } from '../../domain/types';
import { printJudgeSheets, printResults } from '../../pdf/actions';
import { useEventResult } from '../scoring/useEventResult';
import classes from './EventPdfMenu.module.css';

/** The PDF menu for one event (judge sheets and results), shown beside the event's tabs. */
export function EventPdfMenu({ event }: { event: CompEvent }) {
  const { segments, result } = useEventResult(event);
  const [busy, setBusy] = useState<string | null>(null);

  const hasFree = segments.some((s) => s.kind === 'free');
  const hasCompulsory = segments.some((s) => s.kind === 'compulsory');

  // The PDF tab opens synchronously inside the click, before anything is awaited (see src/pdf/actions.ts).
  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      notifications.show({ color: 'red', title: 'PDF failed', message: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Menu position="bottom-end">
      <Menu.Target>
        <Button
          variant="white"
          aria-label="PDF"
          className={classes.button}
          classNames={{ label: classes.label, section: classes.section }}
          color="navy.9"
          leftSection={<IconFileTypePdf size={16} />}
          rightSection={<IconChevronDown size={14} />}
          loading={busy !== null}
        >
          PDF
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item onClick={() => run('sheets', () => printJudgeSheets({ eventId: event.id }, event.name))}>
          Judge sheets
        </Menu.Item>
        <Menu.Item
          onClick={() =>
            run('sheetsPerDance', () => printJudgeSheets({ eventId: event.id }, event.name, true))
          }
        >
          Judge sheets, a sheet per {segmentNoun(event)}
        </Menu.Item>
        {hasFree && hasCompulsory && (
          <Menu.Item
            onClick={() =>
              run('sheetsFree', () => printJudgeSheets({ eventId: event.id }, event.name, false, true))
            }
          >
            Judge sheets, {event.discipline === 'figures' ? 'programmes' : 'free dance'} only
          </Menu.Item>
        )}
        <Menu.Divider />
        <Menu.Item
          disabled={!result.complete}
          onClick={() => run('standard', () => printResults({ eventId: event.id }, event.name, 'standard'))}
        >
          Results
        </Menu.Item>
        <Menu.Item
          disabled={!result.complete}
          onClick={() => run('withMarks', () => printResults({ eventId: event.id }, event.name, 'withMarks'))}
        >
          Results with marks
        </Menu.Item>
        <Menu.Item
          disabled={!result.complete}
          onClick={() => run('guest', () => printResults({ eventId: event.id }, event.name, 'guest'))}
        >
          Results for guest judges (placings only)
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
