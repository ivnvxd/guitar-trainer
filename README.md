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

A scale page and a key page play along with you. A scale has a drone on its root and one to three chord loops that fit it. A key loops its common progressions. You set the tempo, and the backing goes on while you change the position. A Drums chip adds a beat. While a loop plays on a scale page, the notes of the chord that sounds stay bright on the neck.

Three tools sit beside the topics:

- Name it works the other way round. You tap notes on the neck, and the page names the chord, also as a slash chord, and the scales that hold the notes. Its labels show note names, degrees in the chord, or the interval of each note from the first note you tapped.
- Scales for chords takes the chords of a song and lists the scales that hold every note of them. It loops the chords so you can play over them. When no scale fits, as over a blues, it lists the scales that miss the fewest notes.
- Tuner listens through the microphone and shows the note, how many cents it is off, and the nearest string of your tuning. The string you play lights up, a tuned string gets a check mark, and a bar shows that the microphone hears you.

A seven-note scale shows its positions in two ways: as vertical boxes of 4 or 5 frets, or as shapes with three notes on each string. A box is a pentatonic box with the other notes of the scale added. A position that does not fit the frets shown stops at the nut or the last fret. A picked position also shows as tab. A second scale on the same root can show on the same neck, to compare them.

A chord page has:

- the CAGED shapes or the movable shapes, and finger numbers for each shape,
- slash chords such as C/E, with shapes that put the bass note lowest,
- drop 2 and drop 3 voicings of four-note chords on each string set,
- arpeggio positions: the notes of the chord inside each of five boxes.

There are 30 chord types, from triads to 11ths, 13ths and altered dominants such as 7♯9.

The circle of fifths on the Keys page has two rings: the major keys outside and their relative minors inside. A frame holds the seven chords of the key. The diminished chord takes the minor cell with the same root, after iii. An Intervals view shows the interval of each note from the key. A tap on an interval adds its note to a shape, and a tap on a note name makes it the key.

The Intervals page can show a second interval from the same root, to compare the two.

The Keys page also shows chords from outside the key: secondary dominants, chords borrowed from the minor key, and the major V of harmonic minor in a minor key.

Faint layers show what is around the topic of a page. Chips under the neck switch them on and off:

- Triads: the other notes of the scale on the same strings (on at first), and the five CAGED shapes of the chord.
- Scales: the five CAGED shapes of the chord on the root.
- Chords: the other notes of the usual scale over the chord, as small dots. For example, C mixolydian over C7 and C dorian over Cm7.

On the Triads page a line also joins the three notes of each shape.

A speaker button in the top bar turns all sound off and on. On a Library page a share button beside it shares the link of the page, saves the neck as a picture, or prints the page.

After a choice, a page draws itself again. The control you tapped stays at the same place on the screen.

The neck is a flat diagram: the nut on the left and the high e on top. On a phone a long neck scrolls sideways. A switch beside each neck makes it vertical, and so does Settings. A phone held sideways shows the neck first, and a drill puts the neck beside its answers.

Settings has six tunings and a custom tuning, and a capo. With a capo, the Library counts the frets from the capo and shows the shapes you play there; a chord keeps the name of its sound. CAGED shapes show in standard tuning and in tunings that move every string the same way: a capo, half step down and drop D. The drills ignore the capo.

Train has three tracks and two tools:

- Ear: intervals, scale degrees in a key, chord quality and chord progressions.
- Neck: name the note, find every note, read the staff, play the note, degrees from a root, triad shapes and CAGED shapes. Play the note listens through the microphone. It checks the pitch only, so it asks for a note in any octave, every octave of a note, or the exact note on the staff.
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
