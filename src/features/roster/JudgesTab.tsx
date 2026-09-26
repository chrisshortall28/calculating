import { useLiveQuery } from 'dexie-react-hooks';
import { useParams } from 'react-router';
import { useJudges } from '../../app/data';
import { db } from '../../db/db';
import { addJudge, deleteJudge, updateJudge } from '../../db/repo';
import { NameListTab } from './NameListTab';

export function JudgesTab() {
  const { compId } = useParams() as { compId: string };
  const judges = useJudges(compId);
  const usage = useLiveQuery(async () => {
    const counts = new Map<string, number>();
    await db.events
      .where({ competitionId: compId })
      .each((e) =>
        new Set([...e.judgeIds, ...(e.refereeId ? [e.refereeId] : [])]).forEach((j) =>
          counts.set(j, (counts.get(j) ?? 0) + 1),
        ),
      );
    return counts;
  }, [compId]);

  return (
    <NameListTab
      noun="judge"
      intro="Add and manage the competition’s judges here, ready to assign to each event’s panel. You can also add judges while setting up an event’s panel (its Judges tab); they are added to this list too."
      empty="No judges yet. Judges can be added on the day and assigned to each event’s panel."
      items={judges}
      usage={usage}
      usageLabel="Events"
      deleteWarning={(j, used) =>
        `Delete ${j.name}? They will be removed from ${used} events (as judge or referee) and all their marks will be deleted.`
      }
      onAdd={(name) => addJudge(compId, name)}
      onRename={(id, name) => updateJudge(id, { name })}
      onDelete={deleteJudge}
    />
  );
}
