# Third-party notices

Podium's own source code is released under the [BSD Zero Clause License](LICENSE): anyone may use,
copy, modify and distribute it for any purpose, with no conditions.

The app is built on open-source packages that keep their own licences. All of them are permissive
(none is copyleft), so they place no restrictions on how you use Podium or on the licence of your own
changes. Their only real requirement is this: **if you redistribute a built copy of the app, keep the
copyright and licence notices of the bundled packages** (MIT, BSD, Apache-2.0 and similar licences
all ask for this). The full licence texts are in each package's folder under `node_modules/`.

## Shipped with the app

| Package | Licence | Used for |
| --- | --- | --- |
| react, react-dom | MIT | UI framework |
| react-router | MIT | Page routing |
| @mantine/core, hooks, form, modals, notifications, dropzone | MIT | UI components |
| @tabler/icons-react | MIT | Icons (the app icon's trophy is also Tabler's `trophy-filled`) |
| @dnd-kit/core, sortable, utilities | MIT | Drag-to-reorder lists |
| dexie, dexie-react-hooks | Apache-2.0 | Offline database (IndexedDB) |
| pdfmake | MIT | PDF generation |
| Roboto font (embedded by pdfmake) | Apache-2.0 | Text in generated PDFs |
| zod | MIT | Validating imported competition files |
| @fontsource-variable/inter (Inter font) | SIL Open Font License 1.1 | App text |
| @fontsource/barlow-condensed (Barlow Condensed font) | SIL Open Font License 1.1 | Headings |

Packages pulled in by the ones above are almost all MIT. The exceptions, all permissive: Apache-2.0
(@swc/helpers), BSD-3-Clause (react-transition-group), 0BSD (tslib), MIT or CC0-1.0 (type-fest),
MIT and Zlib (pako) and Blue Oak Model License 1.0.0 (sax).

### About the fonts

Inter and Barlow Condensed are under the SIL Open Font License 1.1. The fonts may be freely used,
bundled, modified and redistributed with software, commercial or not. The licence's only conditions
concern the font files themselves: they may not be sold on their own, and a modified font must not
use the original font's name.

## Development tools only

These are used to build and test Podium but are not part of the app itself, so they add no
conditions when you distribute it: TypeScript (Apache-2.0), Vite, Vitest, vite-plugin-pwa,
@vite-pwa/assets-generator, Prettier, PostCSS and its Mantine presets, jsdom and Testing Library
(all MIT), and fake-indexeddb (Apache-2.0).
