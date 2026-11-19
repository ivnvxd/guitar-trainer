#!/usr/bin/env python3
"""Download service for Slow down: it gives the sound of one YouTube video to the page.

Each request has the header "Authorization: Bearer <key>". The service listens on this machine only: a web
server with https stands in front of it. A web server, or Cloudflare, cuts a request that gets no answer for a
minute or two, and a video can take longer. So the page asks in short requests:

  GET /start?v=<video id>&kind=sound    starts yt-dlp and answers at once with {"job": "<id>"}.
                                        kind=picture gets the picture without its sound, as a small mp4 file.
  GET /job?id=<id>                      says how far the download is: {"state": "working", "percent": 40}.
                                        The state ends as "done" or "failed".
  GET /file?id=<id>                     sends the finished file, and the service deletes it.

GET /sound?v=<video id> and GET /picture?v=<video id> do all of this in one request, which waits until the file
is ready. An older page asks this way, and so does a test with curl.
GET /check with the same header downloads nothing: it tells the page that the address and the key are right, and
whether the server has the programs. "Test the connection" in the Settings of the site asks it.

A file is in a temporary folder until the page has taken it. A file that the page does not take goes after 10
minutes. The service keeps nothing else. Its log has one line for each request, with the time and the id of the
video.

Configuration, from the environment:
  GT_KEY     the key that the page must send. The service does not start without it.
  GT_ORIGIN  the address of the site that can ask. For more than one, put commas between them.
             Default: https://guitar.ivnv.dev
  GT_PORT    the port to listen on. Default: 8787
  GT_YTDLP   the yt-dlp program. Default: yt-dlp
  GT_ARGS    more options for yt-dlp, as on a command line. For example a file of cookies, or a proxy, when
             YouTube does not trust the address of the server: --cookies /var/cache/guitar-ytdl/cookies.txt
"""
import hmac
import json
import os
import re
import secrets
import shlex
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
ARGS = shlex.split(os.environ.get('GT_ARGS', ''))
# yt-dlp gets this long for one file.
TIMEOUT = 600
# A finished file waits this long for the page. Then the service deletes it.
KEEP = 600
# The sound: the m4a track in the language of the video, not a dubbed one.
SOUND = '140/bestaudio[ext=m4a]'
# The picture: no sound, 360 lines at most, in the form that every browser plays, and as one file.
PICTURE = 'bestvideo[ext=mp4][vcodec^=avc1][height<=360][protocol^=http]'
VIDEO_ID = re.compile(r'[A-Za-z0-9_-]{11}')
LOCAL = re.compile(r'http://(localhost|127\.0\.0\.1)(:\d+)?')
# One video at a time: a second request gets "busy".
busy = threading.Lock()
# The downloads that the page started: id -> state, percent, file, title, error.
jobs = {}
jobs_lock = threading.Lock()


# The answer for a download that did not work. It is not 502 or 504: Cloudflare puts its own error page in the
# place of such an answer, and the page then cannot read what went wrong. No other 5xx either, to be safe.
FAILED = 424


class Refused(Exception):
    def __init__(self, status, text):
        super().__init__(text)
        self.status, self.text = status, text


def fetch(video, folder, form, percent=None):
    """Download the sound or the picture of a video into the folder. Give the path of the file and the title.

    percent: a function that gets the part that is here, from 0 to 100, while yt-dlp works."""
    command = [
        YTDLP, '--no-playlist', '--no-simulate',
        '-f', form,
        '--match-filter', '!is_live',
        # One line for each step of the download and one for the title, each with a mark of its own.
        '--progress', '--newline', '--progress-template', 'download:GT-PART %(progress._percent_str)s',
        '--print', 'after_move:GT-TITLE %(title)s',
        '-o', os.path.join(folder, 'file.%(ext)s'),
        *ARGS,
        f'https://www.youtube.com/watch?v={video}',
    ]
    title, late = '', []
    with tempfile.TemporaryFile('w+', errors='replace') as said:
        try:
            run = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=said, text=True, errors='replace')
        except FileNotFoundError:
            raise Refused(FAILED, f'The server has no {YTDLP} program.')

        def end():
            late.append(True)
            run.kill()
        clock = threading.Timer(TIMEOUT, end)
        clock.daemon = True
        clock.start()
        try:
            for line in run.stdout:
                if line.startswith('GT-TITLE '):
                    title = line[9:].strip()
                elif line.startswith('GT-PART ') and percent:
                    part = re.search(r'([0-9.]+)%', line)
                    if part:
                        percent(float(part.group(1)))
            code = run.wait()
        finally:
            clock.cancel()
            if run.poll() is None:
                run.kill()
        said.seek(0)
        errors = [line for line in said.read().splitlines() if line.startswith('ERROR')]
    if late:
        raise Refused(FAILED, 'The download took too long.')
    files = [f for f in os.listdir(folder) if not f.endswith('.part')]
    if code or not files:
        if errors and 'Requested format is not available' in errors[-1]:
            raise Refused(422, 'YouTube has no file of this kind for the video.')
        if errors and 'Sign in to confirm' in errors[-1]:
            raise Refused(FAILED, 'YouTube does not trust the address of the server: it asks yt-dlp to sign in. '
                                  'The README of the service shows what you can do ("YouTube asks to sign in").')
        if errors:
            raise Refused(FAILED, f'yt-dlp on the server says: {errors[-1][:300]}')
        # The filter skips a video without an error.
        raise Refused(422, 'The video is a live stream. The service cannot download it.')
    return os.path.join(folder, files[0]), title


def work(job):
    """Run one download that the page started. It always ends as done or failed, and it frees the service."""
    try:
        job['path'], job['title'] = fetch(job['video'], job['folder'], PICTURE if job['kind'] == 'picture' else SOUND,
                                          lambda part: job.update(percent=part))
        job['size'] = os.path.getsize(job['path'])
        job['state'] = 'done'
    except Refused as e:
        job.update(state='failed', status=e.status, error=e.text)
    except Exception as e:
        job.update(state='failed', status=FAILED, error=f'The download service failed ({type(e).__name__}).')
    finally:
        busy.release()
        if job['state'] != 'done':
            shutil.rmtree(job['folder'], ignore_errors=True)
        # The page has this long to ask for the result. Then the file and the job go, with no further request.
        job['clock'] = threading.Timer(KEEP, drop, [job['id']])
        job['clock'].daemon = True
        job['clock'].start()


def drop(job_id):
    """Forget a download and delete its file."""
    with jobs_lock:
        job = jobs.pop(job_id, None)
    if job:
        if job.get('clock'):
            job['clock'].cancel()
        shutil.rmtree(job['folder'], ignore_errors=True)


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
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.cors()
        self.send_header('Content-Length', '0')
        self.end_headers()

    def send(self, path, title, picture):
        self.send_response(200)
        self.cors()
        self.send_header('Content-Type', 'video/mp4' if picture else 'audio/mp4')
        self.send_header('Content-Length', str(os.path.getsize(path)))
        self.send_header('X-Title', quote(title))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        with open(path, 'rb') as file:
            shutil.copyfileobj(file, self.wfile)

    def do_GET(self):
        url = urlparse(self.path)
        if url.path not in ('/start', '/job', '/file', '/sound', '/picture', '/check'):
            return self.say(404, 'There is nothing at this address.')
        sent = self.headers.get('Authorization', '')
        if not hmac.compare_digest(sent.encode(), f'Bearer {KEY}'.encode()):
            return self.say(401, 'The key is wrong.')
        asked = parse_qs(url.query)
        if url.path == '/check':
            # yt-dlp needs deno to read a YouTube page.
            return self.tell(200, {'service': 'guitar-ytdl', 'ytdlp': version(YTDLP), 'deno': bool(shutil.which('deno'))})
        if url.path in ('/job', '/file'):
            return self.result(url.path, (asked.get('id') or [''])[0])
        video = (asked.get('v') or [''])[0]
        if not VIDEO_ID.fullmatch(video):
            return self.say(400, 'That is not a YouTube video id.')
        if url.path == '/start':
            return self.start(video, 'picture' if (asked.get('kind') or [''])[0] == 'picture' else 'sound')
        # /sound and /picture: one request that waits for the file.
        if not busy.acquire(blocking=False):
            return self.say(429, 'The server is busy with another video. Try again in a minute.')
        folder = tempfile.mkdtemp(prefix='guitar-ytdl-')
        try:
            picture = url.path == '/picture'
            path, title = fetch(video, folder, PICTURE if picture else SOUND)
            self.send(path, title, picture)
        except Refused as e:
            self.say(e.status, e.text)
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            shutil.rmtree(folder, ignore_errors=True)
            busy.release()

    def start(self, video, kind):
        with jobs_lock:
            # The page asks again for a download that still runs or still waits: it gets the same one.
            same = [j for j in jobs.values() if j['video'] == video and j['kind'] == kind and j['state'] != 'failed']
            if same:
                return self.tell(200, {'job': same[0]['id']})
            if not busy.acquire(blocking=False):
                return self.say(429, 'The server is busy with another video. Try again in a minute.')
            job = {'id': secrets.token_urlsafe(12), 'video': video, 'kind': kind, 'state': 'working', 'percent': 0,
                   'folder': tempfile.mkdtemp(prefix='guitar-ytdl-')}
            jobs[job['id']] = job
        threading.Thread(target=work, args=(job,), daemon=True).start()
        self.tell(200, {'job': job['id']})

    def result(self, path, job_id):
        with jobs_lock:
            job = jobs.get(job_id)
        if not job:
            return self.say(404, 'The service does not have this download any more. Start it again.')
        if path == '/job':
            return self.tell(200, {k: job[k] for k in ('state', 'percent', 'size', 'title', 'status', 'error') if k in job})
        if job['state'] != 'done':
            return self.say(409, 'The file is not ready.')
        try:
            self.send(job['path'], job['title'], job['kind'] == 'picture')
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            drop(job_id)

    def log_message(self, form, *args):
        # The log has the time and the answer, not the address of the reader or the key. The page asks /job every
        # second or two while a download runs: those lines stay out.
        if getattr(self, 'path', '').startswith('/job'):
            return
        sys.stderr.write(f'{self.log_date_time_string()} {form % args}\n')


if __name__ == '__main__':
    if not KEY:
        sys.exit('Set GT_KEY to the key that the page must send.')
    ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
