import { notifications } from '@mantine/notifications';
import { useCallback } from 'react';
import type { Id } from '../../domain/types';
import { downloadJson, exportCompetition, fileNameFor } from '../../io/competitionFile';

export function useExportCompetition() {
  return useCallback(async (competitionId: Id) => {
    const file = await exportCompetition(competitionId);
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    downloadJson(file, fileNameFor(`${file.competition.name} ${stamp}`, 'pod'));
    notifications.show({ color: 'green', message: 'Competition exported' });
  }, []);
}
