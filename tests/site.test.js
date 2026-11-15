// Run with: node tests/site.test.js
'use strict';
const assert = require('assert');
const fs = require('fs'), path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
let checks = 0;

// The version that Settings shows matches the cache name of the service worker.
const sw = read('sw.js');
assert.strictEqual(read('js/core.js').match(/GT\.version = (\d+);/)[1], sw.match(/VERSION = 'guitar-trainer-(\d+)'/)[1], 'version in core.js and sw.js'); checks++;
// Every script the page loads is in the offline cache.
const files = sw.match(/const FILES = \[([\s\S]*?)\];/)[1];
for (const [, src] of read('index.html').matchAll(/<script src="([^"]+)"/g)) { assert.ok(files.includes(`'${src}'`), `${src} is not in FILES of sw.js`); checks++; }

console.log(`site: ${checks} checks passed`);
