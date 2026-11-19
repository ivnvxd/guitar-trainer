# Guitar Trainer

Guitar Trainer is a guitar study site for the phone and the computer. It shows music theory on the neck, and it trains the ear and the hands with short daily drills. It also has the tools that you use with the guitar in your hands.

The site is live at <https://guitar.ivnv.dev/>.

Everything runs in the browser. The site has no server code, no build step and no account. It works offline after the first visit, and you can add it to the home screen. Progress and settings stay in the browser of one device.

## What is in it

- Library shows notes, intervals, scales, chords with the CAGED shapes, triads, keys with the circle of fifths, and rhythm. A search box reads chords and scales as guitarists write them, for example `C maj7` or `Am pentatonic`. Scales and keys play along with you. "Name it" names the chord of the notes that you tap.
- Train has drills in four tracks: ear, neck, keys and rhythm. Each drill asks again what you miss or answer slowly. A daily goal counts real practice time.
- Tools has a tuner, a metronome and Slow down. Slow down plays a song file or a YouTube link. A file plays slower without a change of pitch or in another key, and you loop a part of it.

Settings has the theme, the tuning, a capo, a left-handed neck and the pitch of A.

## Run it

Open `index.html` in a current browser. Offline use and the home-screen icon need HTTPS.

To publish the site, copy these files and folders to any static web host: `index.html`, `css/`, `fonts/`, `js/`, the four icon files, `manifest.webmanifest` and `sw.js`. The site works at the root of a domain and in a subfolder.

Each release has a version, major.minor.patch. `VERSION` in `sw.js` and `GT.version` in `js/core.js` must hold the same version.

## Download service

A YouTube video plays only in YouTube's own frame, with few tools. The optional service in `server/` gives Slow down the sound of a video as a file, and the picture if you want it. You run the service on your own computer or server. The public site has no such service. See [server/README.md](server/README.md).

## Tests

The tests need Node.js.

```
node tests/theory.test.js
node tests/rhythm.test.js
node tests/site.test.js
node tests/player.test.js
```

## Support

Thank you for using this project! If you find it helpful and want to support my work, kindly consider buying me a coffee. Your support is greatly appreciated!

<a href="https://www.buymeacoffee.com/ivnvxd" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="60" width="217"></a>

If you like the project, do not forget to give it a star! :star:
