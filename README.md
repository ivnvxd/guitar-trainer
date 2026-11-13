# Guitar Trainer

Guitar Trainer is a guitar study site in two parts. Library shows notes, intervals, scales, chords, triads and keys on the neck. Train has short daily drills for the ear, the neck and keys. Everything runs in the browser. The site has no server code, no build step and no downloads from other sites.

The site is live at <https://guitar.ivnv.dev/>.

## Use it

1. Open `index.html` in a current browser. A local file works, but offline use and the home-screen icon need HTTPS.
2. To publish, copy the files below to any static web host. The site works at the domain root, such as `guitar.ivnv.dev`, and in a subfolder.
3. Browsers play sound only after a click or a key press. A drill that is silent at first shows a button: Play the question.

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

Library opens first. Its start page has a search box and six topics in the order you learn them: notes, intervals, scales, chords with the CAGED shapes, triads, and keys with the circle of fifths. On each topic page, the root, the type and the position are one tap away, above the neck. A keyboard folds out under the neck to show the same notes on a piano. A row of links leads from each topic to the drills that train it.

A scale page and a key page play along with you. A scale has a drone on its root and one to three chord loops that fit it. A key loops its common progressions. You set the tempo, and the backing goes on while you change the position.

Name these notes works the other way round. You tap notes on the neck, and the page names the chord and the scales that hold the notes. Its labels show note names, degrees in the chord, or the interval of each note from the first note you tapped.

On the Triads page a line joins the three notes of each shape. A switch adds the other notes of the scale, faint, on the same strings.

A speaker button in the top bar turns all sound off and on.

The neck is a flat diagram: the nut on the left and the high e on top. On a phone a long neck scrolls sideways. A switch under each neck turns it upright, and so does Settings. A phone held sideways shows the neck first, and a drill puts the neck beside its answers.

Train has three tracks and two tools:

- Ear: intervals, scale degrees in a key, chord quality and chord progressions.
- Neck: name the note, find every note, degrees from a root, triad shapes and CAGED shapes.
- Keys and progressions: key facts, chords in a key, and numbers to chords.
- Tools: a metronome and one-minute chord changes.

Each drill asks again what you miss or answer slowly. In the ear drills you choose the set you start with. When you answer about 85 percent right, the drill adds the next group to your set. `docs/research.md` lists the research behind these choices.

Library has one link for each view, for example `#/library/scales/blues/a`, `#/library/chords/maj7/c/caged-E` or `#/library/name/1.3-2.2-3.0`. You can bookmark a view or send its link.

Progress and settings stay in the browser's local storage, on one device. The Progress page saves them to a file and loads them on another device.

## Files

| File | Job |
| --- | --- |
| `js/theory.js` | Note spelling, scales, chords, keys, chord shapes, triads, scale positions, and the names of a set of notes |
| `js/audio.js` | The plucked-string sound, chords, sequences, the metronome, chord loops and the drone |
| `js/fretboard.js` | The neck drawing: flat or upright, and the small chord charts |
| `js/core.js` | DOM helper, saved data, settings and the page router |
| `js/progress.js` | Results per item, the choice of the next question, the daily log |
| `js/library.js` | The Library pages |
| `js/train.js` | The Train page and the runner that all drills share |
| `js/drills-ear.js`, `js/drills-neck.js`, `js/drills-keys.js` | The drills |
| `js/tools.js` | Metronome and chord changes |
| `js/pages.js` | Progress and Settings |

## Tests

The theory tests need Node.js. They make sure that every chord shape, triad, scale position and key signature matches the theory, and that a set of notes gets the right chord names.

```
node tests/theory.test.js
```
