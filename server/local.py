#!/usr/bin/env python3
"""Run the site and the download service on this computer.

  python3 server/local.py

The site is then at http://localhost:8000 and the download service at http://localhost:8787. Both answer this
computer only. The script makes a key at the first start, keeps it in server/local.key, and prints it.

It needs yt-dlp and deno (the JavaScript runtime that yt-dlp needs) on the PATH.
"""
import functools
import os
import secrets
import shutil
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SITE_PORT = int(os.environ.get('GT_SITE_PORT', '8000'))
KEY_FILE = os.path.join(HERE, 'local.key')
# The top-level names of the site, as the publish command of the site copies them. '.' is the start page.
PUBLIC = {'.', 'index.html', 'css', 'fonts', 'js', 'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png',
          'manifest.webmanifest', 'sw.js'}

if not os.environ.get('GT_KEY'):
    if not os.path.exists(KEY_FILE):
        with open(os.open(KEY_FILE, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'w') as f:
            f.write(secrets.token_hex(24))
    with open(KEY_FILE) as f:
        os.environ['GT_KEY'] = f.read().strip()

# The service reads its configuration when it loads, so the key must be set first.
sys.path.insert(0, HERE)
import ytdl  # noqa: E402


class Site(SimpleHTTPRequestHandler):
    def send_head(self):
        # Only the files of the site, by name. Everything else gets 404: this folder, which holds the key, hidden
        # files such as .git, and the same names in other letter case, which a Mac or Windows disk also opens.
        parts = os.path.relpath(os.path.realpath(self.translate_path(self.path)), os.path.realpath(ROOT)).split(os.sep)
        if parts[0] not in PUBLIC or any(part.startswith('.') for part in parts[1:]):
            self.send_error(404)
            return None
        return super().send_head()

    def end_headers(self):
        # The browser asks again each time, so a change of the code shows at once.
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def log_message(self, form, *args):
        pass


if __name__ == '__main__':
    for program in (ytdl.YTDLP, 'deno'):
        if not shutil.which(program):
            print(f'Warning: {program} is not on the PATH. A download fails without it. See server/README.md.')
    try:
        site = ThreadingHTTPServer(('127.0.0.1', SITE_PORT), functools.partial(Site, directory=ROOT))
        service = ThreadingHTTPServer(('127.0.0.1', ytdl.PORT), ytdl.Handler)
    except OSError as e:
        sys.exit(f'A port is in use ({e}). Set GT_SITE_PORT for the site or GT_PORT for the service to another port.')
    threading.Thread(target=site.serve_forever, daemon=True).start()
    print(f'Site:     http://localhost:{SITE_PORT}')
    print(f'Settings: http://localhost:{SITE_PORT}/#/settings/service')
    print(f'Address:  http://localhost:{ytdl.PORT}')
    print(f'Key:      {ytdl.KEY}')
    print('Enter the address and the key in Settings once. Press Ctrl+C to stop.')
    try:
        service.serve_forever()
    except KeyboardInterrupt:
        print()
