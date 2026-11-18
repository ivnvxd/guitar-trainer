# Guitar Trainer

Guitar Trainer is a guitar study site in two parts. Library shows notes, intervals, scales, chords, triads and keys on the neck. Train has short daily drills for the ear, the neck and keys. Everything runs in the browser. The site has no server code, no build step and no downloads from other sites. The `server/` folder is not a part of the site: it is an optional service that you can run on your own server.

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

`fonts/` holds the typeface of the site, Geist, the bold serif for the large names of chords, keys and scales (Literata, cut down to the characters of those names), and their license. The site serves them itself.

The version has three parts, major.minor.patch: the first goes up for a redesign, the middle one for new features, the last one for fixes only. When you publish a new version, change `VERSION` in `sw.js` and `GT.version` in `js/core.js` to the same version, and make a GitHub release tagged `v` and the version, with its notes. Browsers then replace the files they keep for offline use, and the version in Settings links to the release notes.

## What is in it

Library opens first. Its start page has a search box that reads chords and scales as guitarists write them (C maj7, CM7, Am pentatonic), and seven topics: notes, intervals, scales, chords with the CAGED shapes, triads, keys with the circle of fifths, and rhythm. On each topic page, the root, the type and the position are one tap away, above the neck. A keyboard folds out under the neck to show the same notes on a piano. A row of links leads from each topic to the drills that train it.

A scale page and a key page play along with you. A scale has a drone on its root and one to three chord loops that fit it. A key loops its common progressions. You set the tempo, and the backing goes on while you change the position. A Drums chip adds a beat. While a loop plays on a scale page, the notes of the chord that sounds stay bright on the neck.

Two tools sit beside the topics:

- Name it works the other way round. You tap notes on the neck, and the page names the chord, also as a slash chord, and the scales that hold the notes. Its labels show note names, degrees in the chord, or the interval of each note from the first note you tapped.
- Scales for chords takes the chords of a song and lists the scales that hold every note of them. It names the likely key, puts a numeral on each chord and offers the other chords of the key. Scales with the same notes, such as A minor and C major, share one card. Over each chord it shows the mode of the key on that chord's root, for example F Lydian over F in A minor. It loops the chords so you can play over them, and a bar at the bottom of the screen shows the chord that sounds. When no scale fits, as over a blues, it lists the scales that miss the fewest notes.

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

A speaker button in the top bar turns all sound off and on. One sound plays at a time: a new tap that plays stops the notes of the tap before it, while a backing, the drone and the metronome go on. On an iPhone the sound stops when you switch to another app, and the first tap after you come back brings it back. On a Library page a share button beside it shares the link of the page, saves the neck as a picture, or prints the page.

After a choice, a page draws itself again. The control you tapped stays at the same place on the screen.

The neck is a flat diagram: the nut on the left and the high e on top. On a phone a long neck scrolls sideways. A switch beside each neck makes it vertical, and so does Settings. A phone held sideways shows the neck first, and a drill puts the neck beside its answers.

Settings has six tunings and a custom tuning, and a capo. With a capo, the Library and the drills play from the capo: a neck starts at the capo, drawn as a bar, and the fret numbers count from the nut. The Library shows the shapes you play there; a chord keeps the name of its sound. CAGED shapes show in standard tuning and in tunings that move every string the same way: a capo, half step down and drop D. The tuner and the CAGED drill ignore the capo.

Train has four tracks. A row at the top leads to Today, to a page for each track, and to Progress. Today shows the day's goal, three drills picked for today (missed answers first, then drills you left for a while, then something new) and a card for each track:

- Ear: intervals, scale degrees in a key, chord quality and chord progressions. Progressions have major and minor keys, with three or four chords.
- Neck: name the note, find every note, read the staff, play the note, degrees from a root, triad shapes and CAGED shapes. Play the note listens through the microphone. It checks the pitch only, so it asks for a note in any octave, every octave of a note, a note on one string, or the exact note on the staff. The same pitch on another string also counts. Find every note and Read the staff can use some of the strings only, and Triad shapes lets you choose the inversions.
- Keys and progressions: key facts, chords in a key, and numbers to chords.
- Rhythm: name the rhythm you hear, and tap in time. Tap in time has three modes: read a bar and tap it, hear a bar and tap it back, and keep the pulse when the click stops. It measures the delay of your device once, with twelve taps on clicks.

The Tools tab holds the tools you use with the guitar in your hands. On each tool, a row at the top leads to the others:

- Tuner listens through the microphone and shows the note, how many cents it is off, and the nearest string of your tuning. The string you play lights up, a tuned string gets a check mark, and a bar shows that the microphone hears you. The pitch of A is 440 Hz, or the value you choose in Settings. When the device has more than one sound input, for example a sound card with the guitar plugged in, the tuner and Play the note let you choose the input.
- Metronome: bars of 2 to 7 beats. It can click between the beats, click on the even beats only, leave out whole bars or single beats, and raise the tempo every four bars.
- Slow down plays a song file (mp3, m4a, wav, flac, or a video such as mp4, mov or webm, up to 10 minutes and 300 MB) or a YouTube link. A file plays at 25% to 150% speed without a change of pitch, or in another key. A waveform shows the song with a time ruler. A tap jumps and a drag sets the loop. You zoom in to 2 seconds with the buttons, with two fingers, or with the wheel and Ctrl. A strip under the waveform shows the whole song, and a drag there moves the view. With a song open, the settings are in tabs (Loop, Speed, Sound, Parts, Bars), so the waveform and the group you work with fit on one phone screen. You loop a part from A to B. You drag an end of the loop on the waveform, or move it by a tenth of a second with a button. You move the loop on by its own length, and make it half or twice as long. Undo brings back the loop of before the last change. A loop can pause before each pass and get a little faster each time. Parts holds the marks of the song and the loops you save under a name. A saved loop comes back with its speed. Hold stops the song at one place while the sound of that place goes on, so you can find its notes on the guitar. Three cuts work alone or together: Bass takes out the sound under 200 Hz, Drums takes out short hits and keeps notes that ring, and Voice takes out what is in the middle of a stereo mix above 180 Hz. A cut makes a part quieter, it does not take it out completely. Bass up makes the bass louder. One button puts speed, key and sound back. A row of the twelve note names shows the notes at the playhead, after the Bass and Voice cuts, and a neck if you turn it on. A band at the top of the waveform names a major or minor chord for each part of the song. Both are guesses. Bars is a trial: you tap the beat while the song plays, the waveform then shows the bars, and the ends of a loop go to the nearest beat. A YouTube video gets YouTube's own six speeds, loops and parts, but no other tools, because YouTube does not let other sites read or change its sound. For the same reason the site cannot download a video. If you run the optional download service of the `server/` folder on your own server and enter its address and key at `#settings/service`, Slow down gets a Download button: the server sends the sound of the video, the browser keeps it, and it gets every tool. On a computer with Chrome or Edge you can record a part of a tab, and the recording gets every tool and stays in the browser until you delete it. The box to open a song lists the last songs. A video opens again with one tap. A file must be chosen again, and its loop and parts then come back. You remove one song or clear the list. While a song plays, the screen stays on. Page Down and Page Up work as Play and back to the start, as a Bluetooth foot pedal sends them. Files never leave the device. A download service that you set gets the link of each video you download. Other visitors do not see this setting. The slowing down uses Signalsmith Stretch (MIT license, `js/vendor/`), with one change: it stops its work after a second of silence.

The daily goal counts real practice time: the time a drill page is in use, and the time a metronome, a play-along loop or a strumming pattern runs. Settings can turn off the count-in, the bar of clicks before a rhythm starts. Settings also shows the version of the site in use, with a link to its release notes, and links to report a problem and to the code.

Each drill asks again what you miss or answer slowly. In the ear drills you choose the set you start with. When you answer about 85 percent right, the drill adds the next group to your set.

Library has one link for each view, for example `#/library/scales/blues/a`, `#/library/chords/maj7/c/caged-E` or `#/library/name/1.3-2.2-3.0`. You can bookmark a view or send its link.

Progress and settings stay in the browser's local storage, on one device. The Progress page, linked from the daily goal on Train, saves them to a file and loads them on another device.

## Files

| File | Job |
| --- | --- |
| `js/theory.js` | Note spelling, scales, chords, keys, chord shapes, triads, scale positions, and the names of a set of notes |
| `js/rhythm.js` | Note values, strumming patterns, counting lessons, metronome plans, tap scoring, and the drawing of rhythm |
| `js/player.js`, `js/drumcut.js`, `js/vendor/signalsmith-stretch.js` | Slow down: the player, the drum cut, and the library that slows down and transposes the sound |
| `server/` | Optional, not a part of the site: a download service for Slow down that you run on your own server. See `server/README.md` |
| `js/audio.js` | The plucked-string sound, chords, sequences, the metronome, chord loops, the drone, the rhythm player and the microphone |
| `js/fretboard.js` | The neck drawing: flat or upright, and the small chord charts |
| `js/core.js` | DOM helper, saved data, settings and the page router |
| `js/progress.js` | Results per item, the choice of the next question, the daily log |
| `js/library.js` | The Library pages |
| `js/train.js` | The Train page and the runner that all drills share |
| `js/drills-ear.js`, `js/drills-neck.js`, `js/drills-keys.js`, `js/drills-rhythm.js` | The drills |
| `js/tools.js` | The Tools tab and the metronome |
| `js/pages.js` | Progress and Settings |

## Tests

The tests need Node.js. The theory tests make sure that every chord shape, triad, scale position and key signature matches the theory, and that a set of notes gets the right chord names. The rhythm tests check that every bar fills its time signature, that no two drill bars sound the same, and the timing of swing, metronome gaps and tap scoring. The site tests check that the version in `js/core.js` matches `sw.js`, and that every script is in the offline cache. The player tests check that the drum cut keeps a ringing note and takes out short hits.

```
node tests/theory.test.js
node tests/rhythm.test.js
node tests/site.test.js
node tests/player.test.js
```
