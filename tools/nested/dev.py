#!/usr/bin/env python3
"""Watch extension sources and restart an isolated GNOME development window."""
import os
from pathlib import Path
import signal
import subprocess
import time

ROOT = Path(__file__).resolve().parents[2]
STATE = ROOT / '.dev'
UUID = 'nowplaying@epogonii.github.io'
ENV = dict(os.environ)
for kind in ('config', 'data', 'cache', 'state'):
    directory = STATE / kind
    directory.mkdir(parents=True, exist_ok=True)
    ENV[f'XDG_{kind.upper()}_HOME'] = str(directory)
ENV['NP_SOURCE'] = str(ROOT)
ENV['GSETTINGS_BACKEND'] = 'keyfile'
HELPER = STATE / 'helper/usr/libexec/mutter-devkit'
if not Path('/usr/libexec/mutter-devkit').exists():
    if not HELPER.exists():
        raise SystemExit('Install mutter-dev-bin to use the GNOME preview.')
    ENV['NP_DEVKIT_HELPER'] = str(HELPER)

SESSION = r'''
set -eu
gsettings set org.gnome.shell enabled-extensions "['nowplaying@epogonii.github.io']"
gsettings set org.gnome.shell disabled-extensions "[]"
gsettings set org.gnome.shell disable-user-extensions false
gsettings set org.gnome.desktop.interface enable-animations true
schema="$XDG_DATA_HOME/gnome-shell/extensions/nowplaying@epogonii.github.io/schemas"
gsettings --schemadir "$schema" set org.gnome.shell.extensions.nowplaying panel-text artist-title
gsettings --schemadir "$schema" set org.gnome.shell.extensions.nowplaying scroll-text true
gjs "$NP_SOURCE/tools/nested/mprisstub5.js" ticker none 'Ticker Preview' yes yes \
    'Scott Street From The Album Stranger In The Alps Deluxe Edition' \
    "file://$NP_SOURCE/tools/nested/nested-home/np-cover-wide.png" no yes no &
if [ -n "${NP_DEVKIT_HELPER:-}" ]; then
    gnome-shell --devkit --wayland --no-x11 &
    shell_pid=$!
    gdbus wait --session --timeout 15 org.gnome.Mutter.Devkit
    "$NP_DEVKIT_HELPER" &
    wait "$shell_pid"
else
    exec gnome-shell --devkit --wayland --no-x11
fi
'''


def snapshot():
    files = [ROOT / name for name in ('extension.js', 'prefs.js', 'spectrum.js',
                                     'metadata.json', 'stylesheet.css')]
    files += sorted((ROOT / 'schemas').glob('*.xml'))
    files += sorted((ROOT / 'icons').rglob('*.svg'))
    return [(str(p), p.stat().st_mtime_ns, p.stat().st_size) for p in files]


def start():
    subprocess.run(['bash', str(ROOT / 'tools/install-local.sh')],
                   cwd=ROOT, env=ENV, check=True)
    return subprocess.Popen(['dbus-run-session', '--', 'bash', '-c', SESSION],
                            cwd=ROOT, env=ENV, start_new_session=True)


def stop(process):
    # This process group belongs only to this preview, never the desktop shell.
    try:
        os.killpg(process.pid, signal.SIGTERM)
    except ProcessLookupError:
        pass
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        os.killpg(process.pid, signal.SIGKILL)
        process.wait()


def interrupted(signum, frame):
    raise KeyboardInterrupt


signal.signal(signal.SIGTERM, interrupted)
process = None
try:
    previous = snapshot()
    process = start()
    print('Preview running. Save a source file to restart; Ctrl+C to stop.', flush=True)
    while process.poll() is None:
        time.sleep(0.5)
        current = snapshot()
        if current != previous:
            # Let editors finish an atomic save before copying sources.
            time.sleep(0.3)
            previous = snapshot()
            print('Source changed; restarting preview...', flush=True)
            stop(process)
            process = start()
except KeyboardInterrupt:
    pass
finally:
    if process is not None:
        stop(process)
