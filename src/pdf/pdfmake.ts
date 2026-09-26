import type { TDocumentDefinitions } from 'pdfmake/interfaces';

type PdfMake = typeof import('pdfmake/build/pdfmake');

let instance: Promise<PdfMake> | null = null;

/** Lazy-loads pdfmake (large) with its embedded Roboto fonts; works offline once cached. */
function getPdfMake(): Promise<PdfMake> {
  instance ??= Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')]).then(
    ([pm, vfs]) => {
      const pdfMake = ((pm as { default?: PdfMake }).default ?? pm) as PdfMake;
      pdfMake.addVirtualFileSystem(
        ((vfs as { default?: unknown }).default ?? vfs) as Parameters<PdfMake['addVirtualFileSystem']>[0],
      );
      return pdfMake;
    },
  );
  return instance;
}

export async function pdfBlob(doc: TDocumentDefinitions): Promise<Blob> {
  const pdfMake = await getPdfMake();
  return pdfMake.createPdf(doc).getBlob();
}

/**
 * Opens the PDF in a new tab for printing. The tab is opened synchronously (while the click's
 * user activation is still valid, so it isn't blocked as a pop-up) and filled in once the PDF
 * is ready; if pop-ups are blocked anyway, the file is downloaded instead.
 */
export async function openPdf(doc: Promise<TDocumentDefinitions>, filename: string) {
  const win = window.open('', '_blank');
  win?.document.write('<p style="font-family:sans-serif">Preparing PDF…</p>');
  try {
    const d = await doc;
    const blob = await pdfBlob({ ...d, info: { title: filename.replace(/\.pdf$/, '') } });
    const url = URL.createObjectURL(blob);
    if (win) {
      win.location.href = url;
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    win?.close();
    throw e;
  }
}
