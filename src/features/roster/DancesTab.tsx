import { useLiveQuery } from 'dexie-react-hooks';
import { useParams } from 'react-router';
import { useDances } from '../../app/data';
import { db } from '../../db/db';
import { addDance, deleteDance, renameDance } from '../../db/repo';
import { NameListTab } from './NameListTab';

export function DancesTab() {
  const { compId } = useParams() as { compId: string };
  const dances = useDances(compId);
  const usage = useLiveQuery(async () => {
    const counts = new Map<string, number>();
    await db.events
      .where({ competitionId: compId })
      .each((e) => e.compulsoryDanceIds.forEach((d) => counts.set(d, (counts.get(d) ?? 0) + 1)));
    return counts;
  }, [compId]);

  return (
    <NameListTab
      noun="dance"
      intro="The compulsory dances for this competition are managed here, and each event’s dances are chosen from this list in its Setup tab. If a dance you need isn’t listed, add it here (including any custom dance) and it can then be selected for events."
      items={dances}
      usage={usage}
      usageLabel="Events"
      deleteWarning={(d, used) =>
        `Delete ${d.name}? It is used in ${used} events; it will be removed from them along with any marks for it.`
      }
      onAdd={(name) => addDance(compId, name)}
      onRename={renameDance}
      onDelete={deleteDance}
    />
  );
}
