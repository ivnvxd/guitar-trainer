# Guitar Fretboard

A self-hosted guitar study page in standard EADGBE tuning. The interface is in English and runs entirely in the browser. There is no build step, account, dependency, or backend.

## Use

Open `index.html` in a current browser, or upload the contents of this folder to any static host. For GitHub Pages, publish the repository root from the `main` branch. Keep `index.html`, `styles.css`, `app.js`, and `extras.js` together.

Audio starts after you press a play button or a note, as browsers require a user gesture. Exercise scores and lesson progress are stored in this browser's local storage.

## What is included

- **Practice:** root-string and fret choices, nine lessons from 1–5–8 through pentatonics and major/minor scales, hints, answer checks, and local progress.
- **Ear:** ascending, descending, and harmonic interval questions with a personal selection of any intervals from unison through octave; major/minor or four-quality triad questions; randomized starting pitches, replay, first note, scores, and a fretboard position after each interval answer. The interval selection is saved in this browser. Advanced triad questions include inversions.
- **Triads:** major, minor, diminished, and augmented voicings in root position and both inversions on 3–2–1 and 4–3–2 string sets, with note/degree labels, playback, and inversion listening checks.
- **Reference:** scales, modes, intervals, chord formulas, playable chord shapes, note/degree labels, step highlighting, and sound.
- **Circle of fifths:** key signatures, relative minors, diatonic triads, a self-check mode, and a shortcut to the selected scale.

The [learning roadmap](docs/learning-roadmap.md) explains which teaching features are most useful to add next and links to the source material used to prioritize them.

## Repository

This folder is a local Git repository. Open this folder in Codex to continue editing it. To publish through GitHub, create a remote repository, connect it as `origin`, push `main`, and enable GitHub Pages for the root folder.
