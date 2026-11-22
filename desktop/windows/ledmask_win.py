"""LED Pixel Mask Generator для Windows 10/11.

Окно программы показывает веб-часть (web/index.html) через Edge WebView2 —
ту же, что на сайте, в Mac- и Android-версиях. Программа даёт странице:
  • сохранение файлов через стандартное окно «Сохранить как» (кусками base64);
  • открытие ссылок во внешнем браузере;
  • обновление изнутри: скачать новый exe, сверить SHA-256, заменить себя, перезапуститься.
Файл, скачанный самой программой, не получает пометку «из интернета»,
поэтому SmartScreen при обновлении не появляется.

3.0.39: исходник восстановлен из переносной сборки и лежит в репозитории. Тот же файл собирается
в установочную версию (рядом с программой лежит installed.txt): она стоит в папке пользователя
(AppData\\Local\\Programs) и обновляется новым установщиком в тихом режиме.
"""

import base64
import hashlib
import json
import os
import pathlib
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
import uuid
import zlib

import webview

APP_NAME = "LED Pixel Mask Generator"
FROZEN = getattr(sys, "frozen", False)
BASE = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
INDEX = os.path.join(BASE, "web", "index.html")
if not os.path.exists(INDEX):
    INDEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web", "index.html")
DATA_DIR = os.path.join(os.environ.get("APPDATA") or tempfile.gettempdir(), APP_NAME)
SELFTEST = os.environ.get("LEDMASK_SELFTEST", "")
SETTINGS = os.path.join(DATA_DIR, "settings.json")
# установочная версия: метка рядом с программой
INSTALLED = os.path.exists(os.path.join(BASE, "installed.txt"))
UPDATE_JSON = "https://slavahoh1976-ops.github.io/-tz/download/version.json"


def load_settings():
    try:
        with open(SETTINGS, encoding="utf-8") as fh:
            return json.load(fh) or {}
    except Exception:
        return {}


def save_settings(d):
    try:
        os.makedirs(DATA_DIR, exist_ok=True)
        with open(SETTINGS, "w", encoding="utf-8") as fh:
            json.dump(d, fh, ensure_ascii=False)
    except Exception:
        pass


def log_line(text):
    try:
        os.makedirs(DATA_DIR, exist_ok=True)
        with open(os.path.join(DATA_DIR, "update.log"), "a", encoding="utf-8") as fh:
            fh.write(time.strftime("%Y-%m-%d %H:%M:%S ") + text + "\n")
    except Exception:
        pass


class Api:
    """Один вход для страницы: window.pywebview.api.call(cmd, args) → {value} или {error}."""

    def __init__(self):
        self._window = None
        self._saves = {}
        self._settings = load_settings()
        self._updating = False

    def call(self, cmd, args=None):
        fn = getattr(self, "c_" + str(cmd), None)
        if not fn:
            return {"error": "неизвестная команда %s" % cmd}
        try:
            return {"value": fn(args or {})}
        except Exception as ex:
            return {"error": str(ex) or ex.__class__.__name__}

    def c_saveBegin(self, a):
        name = "".join("_" if ch in '\\/:*?"<>|' else ch for ch in str(a.get("name") or "file"))
        if SELFTEST:
            os.makedirs(SELFTEST, exist_ok=True)
            path = os.path.join(SELFTEST, name)
        else:
            ext = os.path.splitext(name)[1].lstrip(".").lower()
            types = (f"Файлы {ext.upper()} (*.{ext})", "Все файлы (*.*)") if ext else ("Все файлы (*.*)",)
            directory = self._settings.get("lastSaveDir") or os.path.join(os.path.expanduser("~"), "Documents")
            r = self._window.create_file_dialog(webview.SAVE_DIALOG, directory=directory, save_filename=name, file_types=types)
            if not r:
                return ""
            path = r if isinstance(r, str) else r[0]
            self._settings["lastSaveDir"] = os.path.dirname(path)
            save_settings(self._settings)
        token = uuid.uuid4().hex
        self._saves[token] = (path, open(path + ".part", "wb"))
        return token

    def c_saveAppend(self, a):
        _, fh = self._saves[a["token"]]
        fh.write(base64.b64decode(a["b64"]))
        return True

    def c_saveFinish(self, a):
        path, fh = self._saves.pop(a["token"])
        fh.close()
        os.replace(path + ".part", path)
        return path

    def c_zlib(self, a):
        data = base64.b64decode(a["b64"])
        bits = -15 if a.get("fmt") == "raw" else 15
        if a.get("op") == "deflate":
            c = zlib.compressobj(6, zlib.DEFLATED, bits)
            out = c.compress(data) + c.flush()
        else:
            out = zlib.decompress(data, bits)
        return base64.b64encode(out).decode("ascii")

    def c_info(self, a):
        return {"selftest": bool(SELFTEST), "frozen": FROZEN, "installed": INSTALLED}

    def c_openExternal(self, a):
        os.startfile(a["url"])
        return True

    def c_selftestDone(self, a):
        os.makedirs(SELFTEST or DATA_DIR, exist_ok=True)
        with open(os.path.join(SELFTEST or DATA_DIR, "selftest.log"), "w", encoding="utf-8") as fh:
            fh.write(a.get("log", ""))
        threading.Timer(0.5, self._window.destroy).start()
        return True

    def c_update(self, a):
        if self._updating:
            raise RuntimeError("обновление уже идёт")
        if not FROZEN:
            raise RuntimeError("обновление работает только в собранной программе")
        exe = os.path.abspath(sys.executable)
        if INSTALLED:
            return self._update_installed(a)
        folder = os.path.dirname(exe)
        if not os.access(folder, os.W_OK):
            raise RuntimeError("нет прав на запись в папку %s — скачайте новую версию вручную со страницы скачивания" % folder)
        url, sha = str(a.get("url", "")), str(a.get("sha256", "")).lower()
        if not url.startswith(("https://", "http://")):
            raise RuntimeError("неверная ссылка обновления")
        if not sha:
            raise RuntimeError("в описании обновления нет контрольной суммы")
        self._updating = True
        try:
            new = self._download(url, sha, update_path(exe))
            self._install(new, exe)
        except Exception:
            self._updating = False
            raise
        return True

    # установочная версия: берём из version.json ссылку на установщик и ставим его тихо
    def _update_installed(self, a):
        req = urllib.request.Request(UPDATE_JSON, headers={"User-Agent": APP_NAME, "Cache-Control": "no-cache"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            j = json.loads(resp.read().decode("utf-8"))
        it = j.get("windows_setup") or {}
        url, sha = str(it.get("url", "")), str(it.get("sha256", "")).lower()
        if not url.startswith(("https://", "http://")) or not sha:
            raise RuntimeError("на сайте нет установщика новой версии — скачайте его вручную со страницы скачивания")
        self._updating = True
        try:
            setup = os.path.join(tempfile.gettempdir(), "LED-Pixel-Mask-Generator-Setup-%s.exe" % str(j.get("version", "new")))
            self._download(url, sha, setup)
            # установщик сам закроет программу, обновит её и запустит снова
            subprocess.Popen([setup, "/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART", "/CLOSEAPPLICATIONS", "/RESTARTAPPLICATIONS"],
                             creationflags=0x00000008 | 0x00000200, close_fds=True)
            log_line("installer started: %s" % setup)
            threading.Timer(0.6, self._window.destroy).start()
        except Exception:
            self._updating = False
            raise
        return True

    def _progress(self, p):
        try:
            self._window.evaluate_js("window.__updateProgress && window.__updateProgress(%.3f)" % p)
        except Exception:
            return

    def _download(self, url, sha, new):
        req = urllib.request.Request(url, headers={"User-Agent": APP_NAME, "Cache-Control": "no-cache"})
        h = hashlib.sha256()
        with urllib.request.urlopen(req, timeout=60) as resp, open(new, "wb") as out:
            total = int(resp.headers.get("Content-Length") or 0)
            done, last = 0, -1.0
            while True:
                chunk = resp.read(262144)
                if not chunk:
                    break
                out.write(chunk)
                h.update(chunk)
                done += len(chunk)
                if total and done / total - last >= 0.02:
                    last = done / total
                    self._progress(last)
        if h.hexdigest() != sha:
            try:
                os.remove(new)
            except OSError:
                pass
            raise RuntimeError("контрольная сумма не совпала — файл повреждён или подменён")
        log_line("downloaded %s sha ok" % url)
        return new

    def _install(self, new, exe):
        args = [new, "--apply-update", exe, str(os.getpid()), str(os.getppid())]
        flags = 0x00000008 | 0x00000200  # DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP
        subprocess.Popen(args, creationflags=flags, close_fds=True, cwd=os.path.dirname(exe))
        log_line("helper started, exiting")
        threading.Timer(0.6, self._window.destroy).start()


def update_path(exe):
    return os.path.join(os.path.dirname(exe), APP_NAME + ".update.exe")


def wait_pid(pid, timeout=60):
    try:
        import ctypes
        k = ctypes.windll.kernel32
        h = k.OpenProcess(0x00100000, False, int(pid))  # SYNCHRONIZE
        if not h:
            return
        k.WaitForSingleObject(h, int(timeout * 1000))
        k.CloseHandle(h)
    except Exception:
        time.sleep(2)


def apply_update(target, pids):
    for pid in pids:
        wait_pid(pid)
    me = os.path.abspath(sys.executable)
    ok = False
    for _ in range(60):
        try:
            import shutil
            shutil.copy2(me, target + ".tmp")
            os.replace(target + ".tmp", target)
            ok = True
            break
        except OSError:
            time.sleep(1)
    log_line("apply update -> " + target + ": " + ("ok" if ok else "FAILED"))
    env = {k: v for k, v in os.environ.items() if not k.startswith("LEDMASK_SELFTEST")}
    flags = 0x00000008 | 0x00000200
    subprocess.Popen([target], creationflags=flags, close_fds=True, cwd=os.path.dirname(target), env=env)


def cleanup_update_leftovers():
    if not FROZEN:
        return
    exe = os.path.abspath(sys.executable)
    leftover = update_path(exe)
    if os.path.normcase(leftover) == os.path.normcase(exe):
        return
    for _ in range(10):
        try:
            if os.path.exists(leftover):
                os.remove(leftover)
            return
        except OSError:
            time.sleep(0.5)


def main():
    if len(sys.argv) >= 3 and sys.argv[1] == "--apply-update":
        apply_update(sys.argv[2], sys.argv[3:])
        return
    os.makedirs(DATA_DIR, exist_ok=True)
    threading.Thread(target=cleanup_update_leftovers, daemon=True).start()
    api = Api()
    url = pathlib.Path(os.path.abspath(INDEX)).as_uri()
    window = webview.create_window(APP_NAME, url=url, js_api=api, width=1440, height=900,
                                   min_size=(900, 600), background_color="#0f1419", text_select=True)
    api._window = window

    upd = os.environ.get("LEDMASK_SELFTEST_UPDATE_URL")
    if upd:
        def go():
            time.sleep(3)
            try:
                api.c_update({"url": upd, "sha256": os.environ.get("LEDMASK_SELFTEST_UPDATE_SHA", "")})
            except Exception as ex:
                log_line("selftest update failed: %s" % ex)
                window.destroy()
        threading.Thread(target=go, daemon=True).start()

    if SELFTEST:
        diag = []

        def on_loaded():
            try:
                info = window.evaluate_js(
                    "JSON.stringify({href: location.href, platform: typeof PLATFORM !== 'undefined' ? PLATFORM : null, "
                    "selftest: typeof SELFTEST !== 'undefined' ? SELFTEST : null, api: !!(window.pywebview && window.pywebview.api), "
                    "errors: window.__errs || [], cs: typeof CompressionStream})")
                diag.append("loaded: %s" % info)
            except Exception as ex:
                diag.append("loaded: evaluate_js failed: %s" % ex)

        window.events.loaded += on_loaded

        def timeout():
            try:
                diag.append("late: %s" % window.evaluate_js(
                    "JSON.stringify({errors: window.__errs || [], platform: typeof PLATFORM !== 'undefined' ? PLATFORM : null, "
                    "selftest: typeof SELFTEST !== 'undefined' ? SELFTEST : null, info: window.__info || null, "
                    "callType: window.pywebview && window.pywebview.api ? typeof window.pywebview.api.call : null, "
                    "keys: window.pywebview && window.pywebview.api ? Object.keys(window.pywebview.api) : null, stlog: window.__stlog || null})"))
            except Exception as ex:
                diag.append("late: %s" % ex)
            api.c_selftestDone({"log": "SELFTEST TIMEOUT\n" + "\n".join(diag)})

        threading.Timer(200, timeout).start()

    webview.start(gui="edgechromium", private_mode=False, storage_path=os.path.join(DATA_DIR, "WebView"), debug=False)


if __name__ == "__main__":
    main()
