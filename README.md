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

The version has three parts, major.minor.patch: the first goes up for a redesign, the middle one for new features, the last one for fixes only. When you publish a new version, change `VERSION` in `sw.js` and `GT.version` in `js/core.js` to the same version, and make a GitHub release tagged `v` and the version, with its notes. Browsers then replace the files they keep for offline use, and the version in Settings links to the release notes.

## What is in it

Library opens first. Its start page has a search box that reads chords and scales as guitarists write them (C maj7, CM7, Am pentatonic), and seven topics: notes, intervals, scales, chords with the CAGED shapes, triads, keys with the circle of fifths, and rhythm. On each topic page, the root, the type and the position are one tap away, above the neck. A keyboard folds out under the neck to show the same notes on a piano. A row of links leads from each topic to the drills that train it.

A scale page and a key page play along with you. A scale has a drone on its root and one to three chord loops that fit it. A key loops its common progressions. You set the tempo, and the backing goes on while you change the position. A Drums chip adds a beat. While a loop plays on a scale page, the notes of the chord that sounds stay bright on the neck.

Two tools sit beside the topics:

- Name it works the other way round. You tap notes on the neck, and the page names the chord, also as a slash chord, and the scales that hold the notes. Its labels show note names, degrees in the chord, or the interval of each note from the first note you tapped.
- Scales for chords takes the chords of a song and lists the scales that hold every note of them. It names the likely key, puts a numeral on each chord and offers the other chords of the key. It loops the chords so you can play over them, and a bar at the bottom of the screen shows the chord that sounds. When no scale fits, as over a blues, it lists the scales that miss the fewest notes.

A seven-note scale shows its positions in two ways: as vertical boxes of 4 or 5 frets, or as shapes with three notes on each string. A box is a pentatonic box with the other notes of the scale added, some of them one fret outside it, as in the CAGED scale shapes. A position that does not fit the frets shown stops at the nut or the last fret. A picked position also shows as tab, up and down or in sequences (thirds, groups of 3 and 4). The sequence plays at your tempo, and the page keeps the best tempo you played it clean at. A second scale on the same root can show on the same neck, to compare them.

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

The Rhythm topic has two parts:

- Strumming: 15 patterns on a grid that counts "1 & 2 &". Arrows show down and up strokes, faint arrows the ghost strokes, × the muted strums and > the accents. Under the grid, the same bar shows in rhythm notation. To write your own pattern, pick a stroke and tap the cells of the grid. An edit of a ready pattern makes a new pattern of yours, which you can rename or delete. Your patterns can use 4/4 in eighths, sixteenths or triplets, 3/4 or 6/8. A pattern loops with two to four open chords, one or two bars each, and a list of common progressions fills them. The loop can play the guitar, the guitar with drums, or drums only, so that you strum it yourself. You set the tempo, swing and a click.
- Counting: lessons on beats and bars, eighths, rests, dots and ties, sixteenths, triplets, time signatures and swing. Each bar is drawn with its count under it, and Play repeats it until you stop it.

On the circle of fifths a tap turns the circle to a key. Touch and hold a cell, or right-click it, to hear its chord.

A speaker button in the top bar turns all sound off and on. On a Library page a share button beside it shares the link of the page, saves the neck as a picture, or prints the page.

After a choice, a page draws itself again. The control you tapped stays at the same place on the screen.

The neck is a flat diagram: the nut on the left and the high e on top. On a phone a long neck scrolls sideways. A switch beside each neck makes it vertical, and so does Settings. A phone held sideways shows the neck first, and a drill puts the neck beside its answers.

Settings has six tunings and a custom tuning, and a capo. With a capo, the Library counts the frets from the capo and shows the shapes you play there; a chord keeps the name of its sound. CAGED shapes show in standard tuning and in tunings that move every string the same way: a capo, half step down and drop D. The drills ignore the capo.

Train has four tracks:

- Ear: intervals, scale degrees in a key, chord quality and chord progressions.
- Neck: name the note, find every note, read the staff, play the note, degrees from a root, triad shapes and CAGED shapes. Play the note listens through the microphone. It checks the pitch only, so it asks for a note in any octave, every octave of a note, or the exact note on the staff.
- Keys and progressions: key facts, chords in a key, and numbers to chords.
- Rhythm: name the rhythm you hear, and tap in time. Tap in time has three modes: read a bar and tap it, hear a bar and tap it back, and keep the pulse when the click stops. It measures the delay of your device once, with twelve taps on clicks.

The Tools tab holds the tools you use with the guitar in your hands:

- Tuner listens through the microphone and shows the note, how many cents it is off, and the nearest string of your tuning. The string you play lights up, a tuned string gets a check mark, and a bar shows that the microphone hears you.
- Metronome: it can click between the beats, click on 2 and 4 only, leave out whole bars or single beats, and raise the tempo every four bars.
- Slow down plays a song file (mp3, m4a, wav, flac or a video) or a YouTube link. A file plays at 25% to 150% speed without a change of pitch, in another key, or a few cents sharp or flat. You loop a part from A to B, with a pause before each pass and a little more speed each time, and you mark the parts of the song. A waveform shows the song: a tap jumps, a drag sets the loop. Filters raise or cut the bass or cut the voice in the middle of the mix, and a note guess lists the loudest notes at a spot with a chord name. A YouTube video gets YouTube's own speeds, loops and marks, but no other tools, because YouTube does not let other sites change its sound. On a computer with Chrome or Edge you can record a part of a tab, and the recording gets every tool and stays in the browser until you delete it. Files never leave the device. The slowing down uses Signalsmith Stretch (MIT license, `js/vendor/`).
- Chord changes: switch between two open chords for a minute and beat your count.

The daily goal counts real practice time: the time a drill page is in use, and the time a metronome, a play-along loop or a strumming pattern runs. Settings can turn off the count-in, the bar of clicks before a rhythm starts. Settings also shows the version of the site in use, with a link to its release notes, and links to report a problem and to the code.

Each drill asks again what you miss or answer slowly. In the ear drills you choose the set you start with. When you answer about 85 percent right, the drill adds the next group to your set.

Library has one link for each view, for example `#/library/scales/blues/a`, `#/library/chords/maj7/c/caged-E` or `#/library/name/1.3-2.2-3.0`. You can bookmark a view or send its link.

Progress and settings stay in the browser's local storage, on one device. The Progress page, linked from the daily goal on Train, saves them to a file and loads them on another device.

## Files

| File | Job |
| --- | --- |
| `js/theory.js` | Note spelling, scales, chords, keys, chord shapes, triads, scale positions, and the names of a set of notes |
| `js/rhythm.js` | Note values, strumming patterns, counting lessons, metronome plans, tap scoring, and the drawing of rhythm |
| `js/player.js`, `js/vendor/signalsmith-stretch.js` | Slow down: the player, and the library that slows down and transposes the sound |
| `js/audio.js` | The plucked-string sound, chords, sequences, the metronome, chord loops, the drone, the rhythm player and the microphone |
| `js/fretboard.js` | The neck drawing: flat or upright, and the small chord charts |
| `js/core.js` | DOM helper, saved data, settings and the page router |
| `js/progress.js` | Results per item, the choice of the next question, the daily log |
| `js/library.js` | The Library pages |
| `js/train.js` | The Train page and the runner that all drills share |
| `js/drills-ear.js`, `js/drills-neck.js`, `js/drills-keys.js`, `js/drills-rhythm.js` | The drills |
| `js/tools.js` | The Tools tab, the metronome and chord changes |
| `js/pages.js` | Progress and Settings |

## Tests

The tests need Node.js. The theory tests make sure that every chord shape, triad, scale position and key signature matches the theory, and that a set of notes gets the right chord names. The rhythm tests check that every bar fills its time signature, that no two drill bars sound the same, and the timing of swing, metronome gaps and tap scoring. The site tests check that the version in `js/core.js` matches `sw.js`, and that every script is in the offline cache.

```
node tests/theory.test.js
node tests/rhythm.test.js
node tests/site.test.js
```
