"""Собирает веб-часть программы в один файл build/web/index.html.

Этот же index.html используют все версии: Web (сайт), Windows (внутри exe) и Mac (внутри .app).

Шаблон web-src/index.template.html содержит метки:
  {{include:путь}} — вставить текстовый файл как есть (CSS, JS);
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
TAG = re.compile(r"\{\{(include|b64):([^}]+)\}\}")


def version():
    with open(os.path.join(ROOT, "VERSION"), encoding="utf-8") as fh:
        return fh.read().strip()


def build_stamp():
    msk = datetime.timezone(datetime.timedelta(hours=3))
    return datetime.datetime.now(msk).strftime("%d.%m %H:%M")


def expand(text):
    def rep(m):
        path = os.path.join(SRC, m.group(2))
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


if __name__ == "__main__":
    out = build(sys.argv[1] if len(sys.argv) > 1 else None)
    print("Версия %s: %s (%.1f МБ)" % (version(), os.path.relpath(out, ROOT), os.path.getsize(out) / 1048576))
