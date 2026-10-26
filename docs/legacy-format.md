# Calculating For Windows (v9.5.1) data files - reverse-engineered notes

Working notes for the legacy importer (`src/legacy/`). Derived from one sample competition
(76 event files plus a log, anonymised by the user). **Status: draft.** Items marked
**(unverified)** are inferred from patterns and need confirming against the real application.

All offsets are decimal byte offsets from the start of the file. All multi-byte integers are
little-endian. Text is single-byte (Latin-1/ASCII), NUL-padded, in fixed-width fields.

## Files

| File | Role |
| --- | --- |
| `DATAnnnB.ROL` | One file per **event**. Holds the competition details, judges, entries and marks. |
| `roller.tlg` | Plain-text CSV log of mark-entry sessions (one line per skater entered). Not needed for import; useful as ground truth (it names each event's dances). |

The competition is the set of `.ROL` files that share the same competition name, venue and date.
There is no index file in the sample, so the importer groups files by those three header fields.

The files are **not encrypted or compressed**. They look like a raw dump of fixed-size in-memory
records, so they contain stray pointer-like bytes that carry no meaning (for example 250-261 and
1022-1023, which differ from file to file without any visible reason). Ignore everything not listed here.

## File size and capacity

Each file has a fixed-size array of entry records, so the size depends on how many entry slots the
event was created with, not on how many entries it holds:

| Slots | File size |
| --- | --- |
| 12 | 39902 |
| 16 | 52462 |
| 20 | 65054 |
| 24 | 77678 |
| none (empty event) | 2360 |

The number of **entries actually present** is the byte at offset **1741**. Only entry rows 1 to N
are real. Offset 294 is a high-water mark (the most rows ever used), and the rows between N and 294
are **stale copies of the last real entry** left over after skaters were removed, so they must be
ignored. Verified on the sample: with 1A, the user confirmed 7 skaters (1741 = 7, 294 = 8, and
row 8 repeats row 7, "Chloe Stapleton"). A real entry that withdrew before skating is still a row with
blank marks (event `3A`, row 8), so blank marks do not mean "stale".

The start order is stored as a list of row numbers (1-based) at offset 2054 (events with compulsory
dances) or 2262 (free-dance-only events). In all 75 sample events it is simply 1, 2, ..., N, so rows
are already in start order.

## Header (offsets 0 to 2361)

| Offset | Size | Content |
| --- | --- | --- |
| 0 | 2 | `45 46` ("EF"), probably a file signature |
| 2 | 40 | Competition name |
| 82 | 40 | Venue |
| 122 | 40 | Date, free text (e.g. `9th August 2026`) |
| 162 | 40 | Event name (e.g. `1A Rising Stars`) |
| 294 | 1 | High-water mark of entry rows (NOT the entry count, see above) |
| 1741 | 1 | **Number of entries** |
| 1024 | 1 | **Number of judges** (3 and 5 seen; comp2 `More than 3 judges` has 5) |
| 1026 + 40*i | 40 | Judge names, i = 0..8 (blank slots unused) |
| 1386 | 40 | A tenth name, identical to judge 1 in the sample: probably the referee **(unverified)** |
| 1546 | 1 | **Event type** (the app's "Type" list): 8 = Solo Dance (solos, duos, couples and teams, not distinguished), 0 = Single, 1 = Pairs, 3 = Quartets. The app also offers Dance, Precision and Show, whose codes are unknown. Podium imports only Solo Dance, Single and Pairs and skips the rest |
| 1551 | 1 | **Number of compulsory dances or figures** (0 to 4; 0 for an event with no compulsory part) |
| 1597 | 1 | 1 when the event has a **short programme** (Figures & Free events) |
| 1645 | 1 | 1 when the event has a **free dance / long programme** |
| 1553, 1554 | 1+1 | **Factor for the compulsory part** as a fraction (numerator, denominator); applies to each figure's mark |
| 1597, 1602 | 1+1 | **Factor for the short programme**: 1597 is both the on/off flag and the numerator, 1602 the denominator |
| 1649, 1650 | 1+1 | **Factor for the long programme** (numerator, denominator) |
| 1806 + 4*k | 2 | Compulsory item k (k = 0..3): byte 0 is the **dance code** (dance events, see below) or the **figure number** (Figures events; matches Podium's catalogue order 1:1); byte 1 is the **side** for figures, an ASCII `l` (108) or `r` (114), or 0 when unspecified |

Factors verified on an event set to "Compulsory 2, Short 1/2, Long 3/2" (2/1, 1/2, 3/2): in Podium's hundredths 200, 50 and 150. A pairs event with the app's defaults reads short 1 and long 3, the same as Podium's own defaults. Other flag bytes (1549, 1599, 1601, 1647) vary with the event type but
are undecoded; they look like "configured" markers and phase numbering. Not in the files that we
have found: the factors (weights) of an event, and the entry type within dance events. The log
`roller.tlg` numbers phases 1-4 compulsory, 5 short programme, 7 long programme/free dance.

### Dance codes

Compulsory dances are stored as their number (1 to 51) in the application's own dance list; code 0 is
the unnamed "Dance No 1", "Dance No 2" placeholder. The user supplied the full list, and it agrees
with all 16 numbers cross-checked against `roller.tlg`. The table lives in `src/legacy/dances.ts`.
A number beyond 51 imports as a dance named `Dance <number>` with a warning. Three names in the
list look like typos or are unsure ("Colleigate", "Tango Delanco" next to "Tango Delanca", and
"Gregory Rhumba" marked "TBC" by the user); they are kept as given.

## Entry records (from offset 2362, stride 3072)

Entry n starts at `2362 + 3072*n`. Relative offsets:

| Offset | Size | Content |
| --- | --- | --- |
| 0 | 40 | Entry name. For duos and couples this is one string: `A / B`. Teams are a single team name. |
| 40 | 40 | Club (may be blank, e.g. for teams) |
| 268 + j | 1 | 1 per judge j, 0..8 (judge present) **(unverified)**; one sample row has judge 1 unset |
| 301 + 186*k | 1 | **Block flag**: 1 when block k holds marks |
| 302 + 186*k + j | 1 | **Mark of judge j in block k**, in tenths (20 = 2.0) |
| 311 + 186*k | 1 | Sum of the judges' marks in block k (equals the sum of the marks in every sample) |
| 3068 | 3 | Looks like a counter/ID; 3070 = 1,2,3,... in row order but absent on the last row; not understood, ignored |

Blocks (k): **0..3 = compulsory dances or figures 1..4** (offsets 301, 487, 673, 859), **4 and 5 =
short programme A and B** (offsets 1045, 1231), **6 and 7 = free dance / long programme A and B**
(offsets 1417, 1603). Verified: the 5-judge event has marks at +1..+5 with the total at +10, figures
events use blocks 0 and 1, and a figures-and-short event uses blocks 0, 4 and 5. The legacy app also
calls the two marks A and B, so they map straight onto Podium's A and B (`fd:A`/`sp:A`/`lp:A`).

Maximum mark byte seen in the whole sample is 60 (6.0). No mark exceeds 100, so tenths fit in a byte.

Other computed values sit in the same records (offsets around 2161-2300: per-judge totals as
hundredths in 16 bits, entry totals). They are derived from the marks and are **ignored**: Podium
recalculates using the CIPA rules.

## Verified against the real application (by the user)

- Marks are stored in tenths, in judge order, and the compulsory-dance and free-dance A/B marks
  decode correctly (events `13A` and `2A` checked, including dance order).
- Event `1A` has 7 skaters, not 8. Its printed result ("Result Compulsory Dances") shows each
  skater's points (the sum of the three marks, e.g. 7.300), "M.V." (majority victories 6.0 down to
  0.0), a Rule column (blank here) and each judge's placing. Our decoded totals match all seven
  skaters, so this event is the first **ground truth** for comparing Podium's CIPA calculation:
  places 1-7 are Anya Garcia, Lily Acs, Zoey Butler, Eliza Bombera, Chloe Stapleton, Patrick Lohan,
  Penelope Preece (points 7.3, 6.1, 6.0, 4.9, 4.8, 4.4, 3.5).
- Free dance marks are called "A marks" and "B marks" in the legacy application too.

## Checksums and file structure (needed to write files)

The application validates every file with CRC-16 checksums, and refuses an edited file whose
checksums are wrong (an assertion in `roldrv.cpp`, "iNum == TC.Id", when the event is opened).
Verified with the real application and all 82 sample files:

- **CRC-16/ARC** (polynomial 0xA001 reflected, init 0, no final xor), stored little-endian in the 2
  bytes right after the data it covers.
- **Header (2360 bytes) = six sections**, each followed by its CRC: data 0-253 (CRC at 254), 256-1021
  (CRC at 1022), 1024-2045 (2046), 2048-2149 (2150), 2152-2253 (2254), 2256-2357 (2358). Editing
  the names (inside the first section) without fixing its CRC is accepted, but fix it anyway.
- **Entry blocks**: from offset 2360, one block of 3072 bytes per slot: 3070 data bytes, then the
  CRC. The first 2 bytes of a block's data are the entry's number (0 for the first entry, and so on;
  0 in unused slots) and its name starts 2 bytes in. So the offsets used above for an entry record are
  relative to block start + 2. **Changing any mark without recalculating the block's CRC makes the
  app reject the event.**
- **Slots** (dance events): `4*ceil(N/4) + 8` for N entries (12 for 1 to 4, 16 for 5 to 8, 20 for 9
  to 12, 24 for 13 to 16). Two files had more rows than that (entries removed later).
- **Tail** (dance events), after the slots, `s*s + 40*s + 54` bytes for s slots, in two sections
  that each end with a CRC:
  1. `18 + s*(s+2)` bytes: header words `[size, 1, s, s, s+2, s, s]`, two zero bytes, then s rows
     of `[u16 row number][s bytes]`: the **table of victories**, row i, column j = the victories
     entry i has over entry j, times 10 (matches a victory table computed from the marks).
  2. `36 + 38*s` bytes: header words `[0, 34+38*s, 1, s, s, 38, s, s, 1, N, 0, 1, 0, 0, 0, 0, 0]`, then
     s result rows of 38 bytes (contents not yet decoded), then the CRC.
- **Edited marks**: with the block CRC (and the sums beside the marks, which are recalculated)
  correct, the app opens the file even when the tail's victory table is out of date, so it
  recalculates results itself.

Rebuilding real files from their parsed contents with these rules (header and tail from the same
file) reproduces them byte for byte (a two-dance event, a three-entry event, a free dance event),
including every checksum, sum and entry number.

## Checked against the legacy application's printed results

The user supplied the legacy app's results PDF for the whole `comp1` competition. Converting the files
and scoring every event with Podium's engine reproduces it exactly for all 73 events that both
produce (468 rows: place, name and club, points, majority victories, every judge's placing). Two
things this taught us:

- An entry with a flagged block of **all-zero marks** is a no-show: the legacy app scores it 0.000 and
  places it last (events `3A` and `26A`), so the zero marks are imported as real 0.0 marks. Dropping
  them left those events incomplete, so Podium listed no results for them.
- The legacy Rule column uses lower-case labels that match Podium's: `7a`, `7c` = 7A, 7C; `S.M.V.` =
  6B (S.M.V.); `7b 10a` = rule 7B at Step 10A of the CIPA manual (the free dance B marks), which Podium
  shows as "7B". The legacy app labels a rule with its step where the manual has one (10A for 7-B on the
  free dance, 10B for the short programme, 10C for 7-C), so Podium's 7B/7C labels carry the same meaning.

## Second sample (`comp2`, small hand-made test events)

Five nearly empty events: `Empty Solodance`, `More than 3 judges`, `Figures`, `Pairs`, `Free`. They
show that the file is just a header when no entries exist (2360 bytes) and that the last entry
record is stored **2 bytes short** (a 1-entry file is 2362 + 3070 bytes), so read the last record
defensively. In `Pairs`, the entry has two names: the first at record offset 0 and the second
(lady) at record offset **52**. The club/nation field is at offset 40 and is short (at most 8
characters in comp1; the legacy app truncates it). The user then added entries with marks:

| Event | What it is | What was decoded |
| --- | --- | --- |
| `More than 3 judges` | 5 judges, 1 skater, 1 dance, marks 1.0-1.4 | Judge count byte 1024 = 5; marks at +1..+5; total (6.0) at +10 |
| `Figures` | 2 figures: 1 left, 2 right; 1 skater, 3 judges | Blocks 0 and 1; 1806 holds 1 + `l`, 1810 holds 2 + `r` |
| `Pairs` | Pairs, short and long programmes, 1 pair | Short at blocks 4/5, long at blocks 6/7; event type 1; lady name at +52 |
| `Free` | Singles, figure 5 plus short programme, 1 skater | Block 0 (figure), blocks 4 and 5 (short); figure 5 with side 0 |

The short/long and per-judge values were entered by the user without a list of the exact numbers, so
the A-versus-B order within the short and long programmes is not yet confirmed against the app.

## Open questions

1. Which of the free dance A and B marks feeds the tie-break in the legacy app? Podium uses B
   (the legacy app calls them A and B too, so the mapping is presumably direct).
2. Compare Podium's calculation with the `1A` placings once the importer exists (done: see above).
3. (Done) The full dance list.
4. Entry type within dance events (solo/duo/couples/team) is not stored; infer it from the name
   (` / `, a team name) and let the user correct it after import.
5. Factors (weights) for figures, short and long programmes: where are they stored, and what are
   the defaults? Needs a test event with unusual factor values.
6. Whether the legacy app has rotating/start-order options that need importing.
