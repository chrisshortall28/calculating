import { Button, Group, Stack, Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { db } from '../../db/db';
import { importCompetition, parseCompetitionFile, type CompetitionFile } from '../../io/competitionFile';

/**
 * Imports a competition file (from the Import button or a `.pod` opened in the installed app):
 * parses it, asks whether to replace or copy when the competition is already on the device, then
 * opens the imported competition.
 */
export function useImportCompetitionFile() {
  const navigate = useNavigate();

  return useCallback(
    async (f: File | null) => {
      if (!f) return;
      const doImport = async (file: CompetitionFile, mode: 'copy' | 'replace') => {
        const id = await importCompetition(file, mode);
        notifications.show({ color: 'green', message: `Imported “${file.competition.name}”` });
        navigate(`/c/${id}`);
      };

      let file: CompetitionFile;
      try {
        file = parseCompetitionFile(JSON.parse(await f.text()));
      } catch (e) {
        notifications.show({ color: 'red', title: 'Import failed', message: (e as Error).message });
        return;
      }
      const existing = await db.competitions.get(file.competition.id);
      if (!existing) return doImport(file, 'replace');
      modals.open({
        title: 'Competition already exists',
        children: (
          <Stack>
            <Text size="sm">
              “{existing.name}” is already on this device. Replace it with the file’s contents, or import the
              file as a separate copy?
            </Text>
            <Group justify="flex-end">
              <Button
                variant="default"
                onClick={() => {
                  modals.closeAll();
                  void doImport(file, 'copy');
                }}
              >
                Import as copy
              </Button>
              <Button
                color="red"
                onClick={() => {
                  modals.closeAll();
                  void doImport(file, 'replace');
                }}
              >
                Replace
              </Button>
            </Group>
          </Stack>
        ),
      });
    },
    [navigate],
  );
}
