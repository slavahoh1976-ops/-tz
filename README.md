# LED Pixel Mask Generator — сайт и сборки

- Веб-версия: https://slavahoh1976-ops.github.io/-tz/
- Скачать для Windows, Mac и Android: https://slavahoh1976-ops.github.io/-tz/download/

`download/version.json` — по нему программы на Windows, Mac и Android проверяют обновления.
Android-версия собирается автоматически (GitHub Actions → «Android APK») из `index.html` и выкладывается в Releases → `android-latest`.

`src/` — исходники веб-версии (`web-src/`, `build_web.py`, `CHANGELOG.md`, `VERSION`). Сборка: `python src/build_web.py` → `src/build/web/index.html`.
Все версии и исходники одним архивом: https://slavahoh1976-ops.github.io/-tz/download/LED-Pixel-Mask-Generator-3.0.14.zip
