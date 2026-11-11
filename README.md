# Guitar Trainer

Guitar Trainer is a guitar study site in two parts. Train has short daily drills for the ear, the neck and keys. Library shows scales, chords, intervals, triads, keys and notes on the neck. Everything runs in the browser. The site has no server code, no build step and no downloads from other sites.

## Use it

1. Open `index.html` in a current browser. A local file works, but offline use and the home-screen icon need HTTPS.
2. To publish, copy the files below to any static web host. The site works at the domain root, such as `guitar.ivnv.dev`, and in a subfolder.
3. Browsers play sound only after a click or a key press. If a drill is silent at first, press Replay or Space.

Upload these files and folders:

- `index.html`
- `css/`
- `fonts/`
- `js/`
- `icon.svg`, `icon-192.png`, `icon-512.png`
- `manifest.webmanifest`
- `sw.js`

Do not upload `docs/`, `tests/`, `README.md` or `.git/`. The site does not need them.

`fonts/` holds the typeface of the site, Geist, and its license. The site serves it itself.

When you publish a new version, change `VERSION` in `sw.js`. Browsers then replace the files they keep for offline use.

## What is in it

Train has three tracks and two tools:

- Ear: intervals, scale degrees in a key, chord quality and chord progressions.
- Neck: name the note, find every note, degrees from a root, triad shapes and CAGED shapes.
- Keys and progressions: key facts, chords in a key, and numbers to chords.
- Tools: a metronome and one-minute chord changes.

Each drill asks again what you miss or answer slowly. When you answer about 85 percent right, the ear drills add new material. `docs/research.md` lists the research behind these choices.

Library has one link for each view, for example `#/library/scales/blues/a` or `#/library/chords/maj7/c/caged-E`. You can bookmark a view or send its link.

Progress and settings stay in the browser's local storage, on one device. The Progress page saves them to a file and loads them on another device.

## Files

| File | Job |
| --- | --- |
| `js/theory.js` | Note spelling, scales, chords, keys, chord shapes, triads and scale positions |
| `js/audio.js` | The plucked-string sound, chords, sequences and the metronome |
| `js/fretboard.js` | The neck drawing, flat on wide screens and upright on phones |
| `js/core.js` | DOM helper, saved data, settings and the page router |
| `js/progress.js` | Results per item, the choice of the next question, the daily log |
| `js/library.js` | The Library pages |
| `js/train.js` | The Train page and the runner that all drills share |
| `js/drills-ear.js`, `js/drills-neck.js`, `js/drills-keys.js` | The drills |
| `js/tools.js` | Metronome and chord changes |
| `js/pages.js` | Progress and Settings |

## Tests

The theory tests need Node.js. They make sure that every chord shape, triad, scale position and key signature matches the theory.

```
node tests/theory.test.js
```
