import { useEffect } from 'react';
import { useImportCompetitionFile } from '../features/competitions/useImportCompetitionFile';

/** Chrome/Edge's file-handler launch queue (not in the DOM typings). */
interface LaunchParams {
  files: readonly { getFile(): Promise<File> }[];
}
declare global {
  interface Window {
    launchQueue?: { setConsumer(consumer: (params: LaunchParams) => void): void };
  }
}

/**
 * Imports the `.pod` files the installed app was launched with (the manifest's `file_handlers`:
 * double-click, or "Open with" Podium). Renders nothing.
 */
export function OpenedFileHandler() {
  const importFile = useImportCompetitionFile();

  useEffect(() => {
    window.launchQueue?.setConsumer(async ({ files }) => {
      for (const handle of files) await importFile(await handle.getFile());
    });
  }, [importFile]);

  return null;
}
