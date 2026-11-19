#!/usr/bin/env python3
"""Download service for Slow down: it gives the sound of one YouTube video to the page.

The page asks GET /sound?v=<video id> with the header "Authorization: Bearer <key>". The service runs yt-dlp,
and sends the m4a file back. It listens on this machine only: a web server with https stands in front of it.
GET /picture?v=<video id> sends the picture of the video without its sound, as a small mp4 file. The page shows
it in step with the sound.
GET /check with the same header downloads nothing: it tells the page that the address and the key are right, and
whether the server has the programs. "Test the connection" in the Settings of the site asks it.

The file of a video is in a temporary folder while the service sends it, and the folder goes after each request.
The service keeps nothing else. Its log has one line for each request, with the time and the id of the video.

Configuration, from the environment:
  GT_KEY     the key that the page must send. The service does not start without it.
  GT_ORIGIN  the address of the site that can ask. For more than one, put commas between them.
             Default: https://guitar.ivnv.dev
  GT_PORT    the port to listen on. Default: 8787
  GT_YTDLP   the yt-dlp program. Default: yt-dlp
"""
import hmac
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, quote, urlparse

KEY = os.environ.get('GT_KEY', '')
ORIGINS = {o.strip().rstrip('/') for o in os.environ.get('GT_ORIGIN', 'https://guitar.ivnv.dev').split(',') if o.strip()}
PORT = int(os.environ.get('GT_PORT', '8787'))
YTDLP = os.environ.get('GT_YTDLP', 'yt-dlp')
# yt-dlp gets this long for one file. A web server in front of the service must wait a little longer.
TIMEOUT = 600
# The sound: the m4a track in the language of the video, not a dubbed one.
SOUND = '140/bestaudio[ext=m4a]'
# The picture: no sound, 360 lines at most, in the form that every browser plays, and as one file.
PICTURE = 'bestvideo[ext=mp4][vcodec^=avc1][height<=360][protocol^=http]'
VIDEO_ID = re.compile(r'[A-Za-z0-9_-]{11}')
LOCAL = re.compile(r'http://(localhost|127\.0\.0\.1)(:\d+)?')
# One video at a time: a second request gets "busy".
busy = threading.Lock()


class Refused(Exception):
    def __init__(self, status, text):
        super().__init__(text)
        self.status, self.text = status, text


def fetch(video, folder, form):
    """Download the sound or the picture of a video into the folder. Give the path of the file and the title."""
    command = [
        YTDLP, '--no-playlist', '--no-progress', '--no-simulate',
        '-f', form,
        '--match-filter', '!is_live',
        '--print', 'after_move:%(title)s',
        '-o', os.path.join(folder, 'file.%(ext)s'),
        f'https://www.youtube.com/watch?v={video}',
    ]
    try:
        done = subprocess.run(command, capture_output=True, text=True, timeout=TIMEOUT)
    except FileNotFoundError:
        raise Refused(500, f'The server has no {YTDLP} program.')
    except subprocess.TimeoutExpired:
        raise Refused(504, 'The download took too long.')
    files = [f for f in os.listdir(folder) if not f.endswith('.part')]
    if done.returncode or not files:
        errors = [line for line in done.stderr.splitlines() if line.startswith('ERROR')]
        if errors and 'Requested format is not available' in errors[-1]:
            raise Refused(422, 'YouTube has no file of this kind for the video.')
        if errors:
            raise Refused(502, f'yt-dlp on the server says: {errors[-1][:300]}')
        # The filter skips a video without an error.
        raise Refused(422, 'The video is a live stream. The service cannot download it.')
    title = (done.stdout.strip().splitlines() or [''])[-1]
    return os.path.join(folder, files[0]), title


def version(program):
    """The first line that a program prints for --version, or '' when the server does not have the program."""
    try:
        done = subprocess.run([program, '--version'], capture_output=True, text=True, timeout=15)
    except (OSError, subprocess.TimeoutExpired):
        return ''
    return (done.stdout.strip().splitlines() or [''])[0][:60] if done.returncode == 0 else ''


class Handler(BaseHTTPRequestHandler):
    server_version = 'guitar-ytdl'

    def cors(self):
        origin = self.headers.get('Origin', '')
        if origin in ORIGINS or LOCAL.fullmatch(origin):
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Vary', 'Origin')
            self.send_header('Access-Control-Allow-Headers', 'Authorization')
            self.send_header('Access-Control-Allow-Methods', 'GET')
            self.send_header('Access-Control-Expose-Headers', 'X-Title')
            self.send_header('Access-Control-Max-Age', '86400')

    def say(self, status, text):
        self.tell(status, {'error': text})

    def tell(self, status, data):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.cors()
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.cors()
        self.send_header('Content-Length', '0')
        self.end_headers()

    def do_GET(self):
        url = urlparse(self.path)
        if url.path not in ('/sound', '/picture', '/check'):
            return self.say(404, 'There is nothing at this address.')
        sent = self.headers.get('Authorization', '')
        if not hmac.compare_digest(sent.encode(), f'Bearer {KEY}'.encode()):
            return self.say(401, 'The key is wrong.')
        if url.path == '/check':
            # yt-dlp needs deno to read a YouTube page.
            return self.tell(200, {'service': 'guitar-ytdl', 'ytdlp': version(YTDLP), 'deno': bool(shutil.which('deno'))})
        video = (parse_qs(url.query).get('v') or [''])[0]
        if not VIDEO_ID.fullmatch(video):
            return self.say(400, 'That is not a YouTube video id.')
        if not busy.acquire(blocking=False):
            return self.say(429, 'The server is busy with another video. Try again in a minute.')
        folder = tempfile.mkdtemp(prefix='guitar-ytdl-')
        try:
            picture = url.path == '/picture'
            path, title = fetch(video, folder, PICTURE if picture else SOUND)
            self.send_response(200)
            self.cors()
            self.send_header('Content-Type', 'video/mp4' if picture else 'audio/mp4')
            self.send_header('Content-Length', str(os.path.getsize(path)))
            self.send_header('X-Title', quote(title))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            with open(path, 'rb') as sound:
                shutil.copyfileobj(sound, self.wfile)
        except Refused as e:
            self.say(e.status, e.text)
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            shutil.rmtree(folder, ignore_errors=True)
            busy.release()

    def log_message(self, form, *args):
        # The log has the time and the answer, not the address of the reader or the key.
        sys.stderr.write(f'{self.log_date_time_string()} {form % args}\n')


if __name__ == '__main__':
    if not KEY:
        sys.exit('Set GT_KEY to the key that the page must send.')
    ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
