# Download service for Slow down

Slow down can play a YouTube video only in YouTube's own frame, with six speeds and no other tools. This service gives the page the sound of a video as a file, so the song gets every tool. It is optional. The site works without it, and the public site has no such service.

The service is one Python file with no packages to install. It runs `yt-dlp` on your computer or on your server, and it listens on that machine only (`127.0.0.1:8787`).

The service keeps no files. It downloads the sound to a temporary folder, sends it to the page, and deletes the folder. The song is then kept in the browser that asked for it.

The service answers only a request that has your key. Without the key it answers "The key is wrong" and does not start `yt-dlp`. Every visitor of the site sees the "Download service" block in Settings, but the block does nothing without the address and the key of a service.

Downloading a video is against the terms of YouTube. Use the service for yourself only, and keep the key private.

There are two ways to run it:

- [On your own computer](#on-your-own-computer): one command starts the site and the service. Downloads work in the browsers of that computer only.
- [On a server](#on-a-server): the service works from each device where you enter its address and key, also from a phone.

## On your own computer

You need Python 3.8 or later, and `yt-dlp` and `deno` (the JavaScript runtime that `yt-dlp` needs) on the PATH. On a Mac with Homebrew:

```
brew install yt-dlp deno
```

1. Get the code of the site and start the script in its folder.

   ```
   git clone https://github.com/ivnvxd/guitar-trainer.git
   cd guitar-trainer
   python3 server/local.py
   ```

   The script starts the site at `http://localhost:8000` and the service at `http://localhost:8787`. Both answer this computer only. The script prints the address and the key of the service. It makes the key at the first start and keeps it in `server/local.key`.

2. Open `http://localhost:8000/#/settings/service`. In the "Download service" block, open "Address and key", and enter the two values that the script printed. You do this once in each browser.

3. In Slow down, a Download button now shows beside the YouTube link.

The script runs until you press Ctrl+C. Start it again each time you practice. Your progress on `http://localhost:8000` is separate from your progress on the public site. To move it, save it to a file in the Progress page of one site and load the file in the other.

Limits of this way:

- A phone cannot use a service on your computer. The address `localhost` on the phone means the phone itself. For a phone, run the service on a server.
- You can also use the public site with the local service: enter `http://localhost:8787` and the key in the Settings of `https://guitar.ivnv.dev`. This way is not tested, and it depends on the browser. The Chrome documentation says that Chrome and Edge ask for your permission to connect to this device. Reports about Safari say that it blocks a request from an https page to an http address. If Download fails there, use the local site of step 2, which has no such limit.

## On a server

A web server with https must stand in front of the service, because a page on https cannot ask an address on http.

### What you need

- Python 3.8 or later.
- `yt-dlp` and `deno` (the JavaScript runtime that `yt-dlp` needs) in `/usr/local/bin` or `/usr/bin`. The service runs as a user without rights, so programs in `/root` do not work.
- A web server with https and a host name, for example Caddy or nginx.

### Install

Run these commands as root on the server.

1. Make sure that both programs are in a shared folder.

   ```
   which yt-dlp deno
   ```

   If `deno` is in `/root`, copy it.

   ```
   install -m 755 /root/.deno/bin/deno /usr/local/bin/deno
   ```

   If `yt-dlp` is in `/root` (an install with pip or pipx), a copy does not work. Download the program that needs nothing else.

   ```
   curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux -o /usr/local/bin/yt-dlp
   chmod 755 /usr/local/bin/yt-dlp
   ```

2. Copy the two files of this folder to the server.

   ```
   mkdir -p /opt/guitar-ytdl
   cp ytdl.py /opt/guitar-ytdl/
   cp guitar-ytdl.service /etc/systemd/system/
   ```

3. Make a key and keep it in a file that only root can read.

   ```
   echo "GT_KEY=$(openssl rand -hex 24)" > /etc/guitar-ytdl.env
   chmod 600 /etc/guitar-ytdl.env
   cat /etc/guitar-ytdl.env
   ```

4. Start the service.

   ```
   systemctl daemon-reload
   systemctl enable --now guitar-ytdl
   ```

5. Test it on the server. Use the key of step 3. The command saves the sound of a video to `test.m4a`.

   ```
   curl -H "Authorization: Bearer YOUR_KEY" -o test.m4a "http://127.0.0.1:8787/sound?v=VIDEO_ID"
   ```

   If the file is small, read it: it holds the error. `journalctl -u guitar-ytdl` shows the log.

6. Put the service behind https. Choose a host name that points to the server.

   Caddy, in the `Caddyfile`:

   ```
   ytdl.example.com {
       reverse_proxy 127.0.0.1:8787
   }
   ```

   nginx, in a `server` block that has a certificate. This example puts the service under `/ytdl/` of a host that serves other things too. The address for the site is then `https://example.com/ytdl`.

   ```
   location /ytdl/ {
       proxy_pass http://127.0.0.1:8787/;
       proxy_read_timeout 200s;
       proxy_buffering off;
   }
   ```

7. On the site, open the address `https://guitar.ivnv.dev/#/settings/service`. In the "Download service" block of Settings, "Address and key" is then open. Enter the address (for example `https://ytdl.example.com`) and the key. They stay in that browser. In Slow down, a Download button now shows beside the YouTube link. Do this once in each browser that you use, for example on the phone and on the computer.

## Configuration

The service reads these values from the environment. On a server they are in `/etc/guitar-ytdl.env`. `server/local.py` takes them from the shell, and it also reads `GT_SITE_PORT`, the port of the local site (default `8000`).

| Name | Meaning | Default |
| --- | --- | --- |
| `GT_KEY` | The key that the page must send. The service does not start without it. | none |
| `GT_ORIGIN` | The address of the site that can ask. For more than one address, for example a preview of the site, put commas between them. | `https://guitar.ivnv.dev` |
| `GT_PORT` | The port on the server. | `8787` |
| `GT_YTDLP` | The `yt-dlp` program. | `yt-dlp` |

A page on `http://localhost` can always ask, for tests.

## Limits

- One video at a time, up to 10 minutes long, as the player takes.
- Only a YouTube video id goes to `yt-dlp`. The service does not fetch other addresses.
- YouTube changes often. If a download fails with an error from `yt-dlp`, update it with `yt-dlp -U`. The page shows the error.
- YouTube can refuse the address of a server at any time. Then the service stops working, and the page still plays the video in YouTube's frame.
