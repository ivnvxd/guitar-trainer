#!/usr/bin/env python3
"""Download service for Slow down: it gives the sound of one YouTube video to the page.

The page asks GET /sound?v=<video id> with the header "Authorization: Bearer <key>". The service runs yt-dlp,
and sends the m4a file back. It listens on this machine only: a web server with https stands in front of it.

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
# The player takes songs up to 10 minutes.
MAX_SECONDS = 600
# yt-dlp gets this long for one video.
TIMEOUT = 180
VIDEO_ID = re.compile(r'[A-Za-z0-9_-]{11}')
LOCAL = re.compile(r'http://(localhost|127\.0\.0\.1)(:\d+)?')
# One video at a time: a second request gets "busy".
busy = threading.Lock()


class Refused(Exception):
    def __init__(self, status, text):
        super().__init__(text)
        self.status, self.text = status, text


def fetch(video, folder):
    """Download the sound of a video into the folder. Give the path of the file and the title of the video."""
    command = [
        YTDLP, '--no-playlist', '--no-progress', '--no-simulate',
        '-f', '140/bestaudio[ext=m4a]',
        '--match-filter', f'duration <= {MAX_SECONDS}',
        '--print', 'after_move:%(title)s',
        '-o', os.path.join(folder, 'sound.%(ext)s'),
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
        if errors:
            raise Refused(502, f'yt-dlp on the server says: {errors[-1][:300]}')
        # The filter skips a video without an error.
        raise Refused(422, 'The video is longer than 10 minutes, or it is a live stream.')
    title = (done.stdout.strip().splitlines() or [''])[-1]
    return os.path.join(folder, files[0]), title


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
        body = json.dumps({'error': text}).encode()
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
        if url.path != '/sound':
            return self.say(404, 'There is nothing at this address.')
        sent = self.headers.get('Authorization', '')
        if not hmac.compare_digest(sent.encode(), f'Bearer {KEY}'.encode()):
            return self.say(401, 'The key is wrong.')
        video = (parse_qs(url.query).get('v') or [''])[0]
        if not VIDEO_ID.fullmatch(video):
            return self.say(400, 'That is not a YouTube video id.')
        if not busy.acquire(blocking=False):
            return self.say(429, 'The server is busy with another video. Try again in a minute.')
        folder = tempfile.mkdtemp(prefix='guitar-ytdl-')
        try:
            path, title = fetch(video, folder)
            self.send_response(200)
            self.cors()
            self.send_header('Content-Type', 'audio/mp4')
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
