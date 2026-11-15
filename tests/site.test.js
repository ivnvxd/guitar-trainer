// Run with: node tests/site.test.js
'use strict';
const assert = require('assert');
const fs = require('fs'), path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
let checks = 0;

// The version that Settings shows matches the cache name of the service worker.
const sw = read('sw.js');
const version = read('js/core.js').match(/GT\.version = '([^']+)';/)[1];
assert.match(version, /^\d+\.\d+\.\d+$/, 'the version is major.minor.patch'); checks++;
assert.strictEqual(version, sw.match(/VERSION = 'guitar-trainer-([^']+)'/)[1], 'version in core.js and sw.js'); checks++;
// Every script the page loads is in the offline cache.
const files = sw.match(/const FILES = \[([\s\S]*?)\];/)[1];
for (const [, src] of read('index.html').matchAll(/<script src="([^"]+)"/g)) { assert.ok(files.includes(`'${src}'`), `${src} is not in FILES of sw.js`); checks++; }

// Files that a page loads later are in the offline cache too.
for (const later of ['js/vendor/signalsmith-stretch.js', 'icon-maskable-512.png']) { assert.ok(files.includes(`'${later}'`), `${later} is not in FILES of sw.js`); checks++; }

console.log(`site: ${checks} checks passed`);
