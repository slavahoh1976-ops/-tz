"""Собирает веб-часть программы в один файл build/web/index.html.

Этот же index.html используют все версии: Web (сайт), Windows (внутри exe) и Mac (внутри .app).

Шаблон web-src/index.template.html содержит метки:
  {{include:путь}} — вставить текстовый файл как есть (CSS, JS);
  {{includedir:папка}} — вставить подряд все .js из папки по порядку имён (01-…, 02-…);
                     так собирается программа из web-src/js/app/ — один общий скрипт, как раньше;
  {{b64:путь}}     — вставить файл (картинку, шаблон PPTX) в виде base64;
  {{version}}      — номер версии из файла VERSION;
  {{build}}        — дата и время сборки (по Москве), например 03.11 12:40.
Пути — относительно папки web-src. Запуск:  python build_web.py
"""
import base64
import datetime
import os
import re
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "web-src")
OUT = os.path.join(ROOT, "build", "web", "index.html")
TAG = re.compile(r"\{\{(include|includedir|b64):([^}]+)\}\}")


def version():
    with open(os.path.join(ROOT, "VERSION"), encoding="utf-8") as fh:
        return fh.read().strip()


def build_stamp():
    msk = datetime.timezone(datetime.timedelta(hours=3))
    return datetime.datetime.now(msk).strftime("%d.%m %H:%M")


def expand(text):
    def rep(m):
        path = os.path.join(SRC, m.group(2))
        if m.group(1) == "includedir":
            parts = []
            for name in sorted(os.listdir(path)):
                if name.endswith(".js"):
                    with open(os.path.join(path, name), encoding="utf-8", newline="") as fh:
                        parts.append(fh.read())
            return expand("".join(parts))
        if m.group(1) == "b64":
            with open(path, "rb") as fh:
                return base64.b64encode(fh.read()).decode("ascii")
        with open(path, encoding="utf-8", newline="") as fh:
            return expand(fh.read())
    return TAG.sub(rep, text)


def build(stamp=None):
    with open(os.path.join(SRC, "index.template.html"), encoding="utf-8", newline="") as fh:
        html = expand(fh.read())
    html = html.replace("{{version}}", version()).replace("{{build}}", stamp or build_stamp())
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8", newline="") as fh:
        fh.write(html)
    return OUT


def check_js():
    """Проверка синтаксиса каждого файла программы (если установлен Node.js)."""
    import shutil
    import subprocess
    node = shutil.which("node")
    d = os.path.join(SRC, "js", "app")
    if not node or not os.path.isdir(d):
        return True
    ok = True
    for name in sorted(os.listdir(d)):
        if name.endswith(".js"):
            r = subprocess.run([node, "--check", os.path.join(d, name)], capture_output=True, text=True)
            if r.returncode:
                ok = False
                print("ОШИБКА в %s:\n%s" % (name, r.stderr.strip()))
    return ok


if __name__ == "__main__":
    if not check_js():
        sys.exit("Сборка остановлена: исправьте ошибки выше")
    out = build(sys.argv[1] if len(sys.argv) > 1 else None)
    print("Версия %s: %s (%.1f МБ)" % (version(), os.path.relpath(out, ROOT), os.path.getsize(out) / 1048576))
