
"use strict";
// 2.0.143: полифилы для старого WebKit (macOS Mojave / Safari 12): replaceChildren — с Safari 14, matchAll — с Safari 13
if (typeof Element !== "undefined" && !Element.prototype.replaceChildren) {
  Element.prototype.replaceChildren = function () {
    while (this.firstChild) this.removeChild(this.firstChild);
    for (let i = 0; i < arguments.length; i++) {
      const n = arguments[i];
      this.appendChild(typeof n === "string" ? document.createTextNode(n) : n);
    }
  };
}
if (typeof String !== "undefined" && !String.prototype.matchAll) {
  String.prototype.matchAll = function (re) {
    const r = new RegExp(re.source, /g/.test(re.flags) ? re.flags : re.flags + "g"), out = [];
    let m;
    while (m = r.exec(this)) {
      out.push(m);
      if (m.index === r.lastIndex) r.lastIndex++;
    }
    return out;
  };
}
const ICON_B64 = "{{b64:assets/icon.png}}";
const STANDALONE = true;
const APP_VERSION = "{{version}}";
const BUILD_STAMP = "{{build}}";
const UPDATE_URL = "https://slavahoh1976-ops.github.io/-tz/download/version.json";
const QS = new URLSearchParams(location.search);
let PLATFORM = window.AndroidBridge ? "android" : window.LEDMASK_PLATFORM || QS.get("platform") || (window.pywebview ? "windows" : "web");
let PLATFORM_LABEL = "Web", DESKTOP = false;
let SELFTEST = !!(window.LEDMASK_SELFTEST || QS.get("selftest"));
function setPlatform(p) {
  PLATFORM = p;
  PLATFORM_LABEL = { web: "Web", mac: "Mac", windows: "Windows", android: "Android" }[p] || "Web";
  DESKTOP = p === "mac" || p === "windows";
}
setPlatform(PLATFORM);
const HAS_CS = typeof CompressionStream !== "undefined" && typeof DecompressionStream !== "undefined";
const nativeCalls = /* @__PURE__ */ new Map();
let nativeSeq = 0;
window.__ledmaskReply = (id, ok, value) => {
  const c = nativeCalls.get(id);
  if (!c) return;
  nativeCalls.delete(id);
  ok ? c.res(value) : c.rej(new Error(value || "ошибка программы"));
};
const pywebviewReady = new Promise((res) => {
  const ok = () => window.pywebview && window.pywebview.api && typeof window.pywebview.api.call === "function";
  if (ok()) return res();
  window.addEventListener("pywebviewready", () => {
    const t = setInterval(() => {
      if (ok()) {
        clearInterval(t);
        res();
      }
    }, 50);
  });
  let n = 0;
  const t2 = setInterval(() => {
    if (ok()) {
      clearInterval(t2);
      res();
    } else if (++n > 300) clearInterval(t2);
  }, 100);
});
async function desk(cmd, args = {}) {
  if (PLATFORM === "mac") return new Promise((res, rej) => {
    const id = ++nativeSeq;
    nativeCalls.set(id, { res, rej });
    window.webkit.messageHandlers.ledmask.postMessage({ id, cmd, args });
  });
  if (PLATFORM === "windows") {
    await pywebviewReady;
    const r = await window.pywebview.api.call(cmd, args);
    if (r && r.error) throw new Error(r.error);
    return r ? r.value : null;
  }
  throw new Error("нет программы-оболочки");
}
function bytesToB64(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 49152) out += btoa(String.fromCharCode.apply(null, bytes.subarray(i, i + 49152)));
  return out;
}
async function nativeZ(op, fmt, bytes) {
  if (!DESKTOP && window.pako) {
    const pk = window.pako, f = op === "deflate" ? fmt === "raw" ? pk.deflateRaw : pk.deflate : fmt === "raw" ? pk.inflateRaw : pk.inflate;
    return f(bytes);
  }
  return b64ToBytes(await desk("zlib", { op, fmt, b64: bytesToB64(bytes) }));
}
const toBytes = async (data) => data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : typeof data === "string" ? enc.encode(data) : new Uint8Array(data);
const TPL = { Resolume: "{{b64:templates/Resolume.pptx}}", D3: "{{b64:templates/D3.pptx}}", MP4: "{{b64:templates/MP4.pptx}}", Vol2: "{{b64:templates/Vol2.pptx}}", Vol4: "{{b64:templates/Vol4.pptx}}", Vol3: "{{b64:templates/Vol3.pptx}}" };
// 2.0.51: названия типов ТЗ (в кнопке, превью и именах файлов)
const TZ_NAME = { Resolume: "Resolume", D3: "D3", MP4: "MP4", Vol2: "Волюметрик 2 м", Vol4: "Волюметрик 4 м", Vol3: "Волюметрик 3 м" };
const tzName = (l) => TZ_NAME[l] || l, tzTag = (l) => tzName(l).replace(/\s+/g, "_").replace("_м", "м");
const PDF_BG = {
  Resolume: "{{b64:pdf-backgrounds/Resolume.jpg}}", D3: "{{b64:pdf-backgrounds/D3.jpg}}", MP4: "{{b64:pdf-backgrounds/MP4.jpg}}",
  bare_Resolume: "{{b64:pdf-backgrounds/Resolume-bare.jpg}}", bare_D3: "{{b64:pdf-backgrounds/D3-bare.jpg}}", bare_MP4: "{{b64:pdf-backgrounds/MP4-bare.jpg}}",
  masks_Resolume: "{{b64:pdf-backgrounds/Resolume-masks.jpg}}", masks_D3: "{{b64:pdf-backgrounds/D3-masks.jpg}}", masks_MP4: "{{b64:pdf-backgrounds/MP4-masks.jpg}}",
  Vol2: "{{b64:pdf-backgrounds/Vol2.jpg}}", Vol4: "{{b64:pdf-backgrounds/Vol4.jpg}}", Vol3: "{{b64:pdf-backgrounds/Vol3.jpg}}",
  deco: "{{b64:pdf-backgrounds/deco.png}}", logo_Resolume: "{{b64:pdf-backgrounds/logo_Resolume.png}}", logo_D3: "{{b64:pdf-backgrounds/logo_D3.png}}", logo_MP4: "{{b64:pdf-backgrounds/logo_MP4.png}}",
  bare_Vol2: "{{b64:pdf-backgrounds/Vol2-bare.jpg}}", bare_Vol3: "{{b64:pdf-backgrounds/Vol3-bare.jpg}}", masks_Vol2: "{{b64:pdf-backgrounds/Vol2-masks.jpg}}"
};
// у Vol4 фон без текста и фон масок — как у Vol2 (отличаются только тексты), у Vol3 фон масок — тоже
const bgKey = (kind, label) => PDF_BG[kind + "_" + label] ? kind + "_" + label : /^Vol/.test(label) && PDF_BG[kind + "_Vol2"] ? kind + "_Vol2" : kind + "_Resolume";
// Ссылки (pt) и рамки текстовых блоков слайда 1 (EMU) — выводит tools/update_templates.py
const PDF_LINKS = {
  Resolume: [[[202.19, 463.44, 230.83, 472.25], "https://resolume.com/download/"], [[35.74, 452.92, 94.97, 461.03], "https://resolume.com/download/"], [[94.42, 452.92, 140.32, 461.03], "https://resolume.com/download/"]],
  D3: [[[87.81, 469.25, 116.45, 478.06], "https://github.com/vidvox/hap-qt-codec/releases/"], [[115.9, 469.25, 162.18, 478.06], "https://github.com/vidvox/hap-qt-codec/releases/"], [[161.62, 469.96, 164.7, 478.06], "https://github.com/vidvox/hap-qt-codec/releases/"], [[164.15, 469.96, 191.23, 478.06], "https://github.com/vidvox/hap-qt-codec/releases/"], [[35.74, 458.02, 134.54, 466.84], "https://github.com/vidvox/hap-qt-codec/releases/"]],
  MP4: [],
  Vol2: [], Vol4: [], Vol3: []
};
const PDF_CLIPS = {
  Resolume: [[411419, 1981505, 4605894, 342900], [447721, 2714854, 3200735, 2475281], [447721, 5247742, 3200735, 1782166], [451754, 7086600, 3196702, 977494], [447721, 8120786, 3200735, 1715414], [3912514, 2714854, 3193288, 1175918], [3912514, 3948379, 3193288, 598018], [3904447, 4602175, 3201355, 2245766], [3912514, 6905549, 3193288, 1355141], [3908481, 8300009, 3197321, 1200607]],
  D3: [[411419, 1790395, 4605894, 342900], [447721, 2333549, 3200735, 2773375], [447721, 5155387, 3200735, 1782166], [451754, 6985102, 3196702, 977494], [447721, 8009230, 3200735, 1715414], [3908481, 2333549, 3197321, 1175918], [3912514, 3632314, 3193288, 598018], [3904447, 4423674, 3201355, 2300204], [3912514, 6602293, 3193288, 1355141], [3908481, 8144685, 3197321, 1200607]],
  MP4: [[411419, 1809598, 4605894, 342900], [451754, 2371954, 3196702, 2464308], [447721, 4892954, 3200735, 1782166], [451754, 6731813, 3196702, 977494], [3912514, 2371954, 3193288, 1175918], [3912514, 3605479, 3193288, 958291], [3908481, 4600346, 3197321, 1200607]],
  Vol2: [[378719, 2350429, 3257276, 1723060], [378719, 4070845, 3257276, 905336], [400230, 5177969, 3257276, 700906], [400230, 7818079, 3257276, 2131921]],
  Vol4: [[378719, 2350429, 3257276, 1723060], [378719, 4070845, 3257276, 905336], [400230, 5177969, 3257276, 700906], [400230, 7818079, 3257276, 2131921]],
  Vol3: [[378719, 2350429, 3257276, 1723060], [378719, 4070845, 3257276, 905336], [400230, 5177969, 3257276, 700906], [400230, 7818079, 3257276, 2131921]]
};
const CATALOG = [
  // 2.0.150: все цвета приглушены (не ярче luminance ~70) и разведены между собой (мин. разница ~26),
  // чтобы серая нумерация читалась на любом кабинете и ни один цвет не совпадал с другим.
  ["ROE MC-7H - (80x80)", 80, 80, 600, 600, [15, 38, 18]],
  ["ROE MC-12 - (48x48)", 48, 48, 600, 600, [92, 63, 0]],
  ["ROE Carbon CB-3 - (136x136)", 136, 136, 600, 600, [37, 51, 0]],
  ["ABSEN  D2V - (168x168)", 168, 168, 500, 500, [55, 6, 11]],
  ["ABSEN  D3V/A3 Pro - (128x128)", 128, 128, 500, 500, [135, 28, 26]],
  ["ABSEN A5 - (96x96)", 96, 96, 500, 500, [38, 34, 89]],
  ["Diamond 20mm - (32x32)", 32, 32, 640, 640, [48, 55, 59]],
  ["Dicolor UC-260 - (192x192)", 192, 192, 500, 500, [0, 20, 70]],
  ["Dicolor 3.9 - (128x128)", 128, 128, 500, 500, [116, 49, 14]],
  ["Dicolor 4.8 - (104x104)", 104, 104, 500, 500, [87, 16, 111]],
  ["Dicolor UT-390 - (128х128) сетка", 128, 128, 500, 500, [142, 0, 16]],
  ["Esdlumen PH8 - (64x64)", 64, 64, 640, 640, [83, 65, 33]],
  ["Infiled ARmk-2 (5.95mm) - (84x84)", 84, 84, 500, 500, [10, 78, 59]],
  ["Uniview Beon пол (6.25mm) - (80x80)", 80, 80, 500, 500, [19, 78, 26]],
  ["StarColor 1.8 - (172x86)", 172, 86, 320, 160, [59, 66, 20]],
  ["NIC 2.6 - (96x48)", 96, 48, 250, 125, [47, 9, 93]],
  ["Unilumin 1.9 - (256x256)", 256, 256, 500, 500, [9, 76, 93]],
  ["Yestech MT P3.9x7.8 - (128х128) сетка", 128, 128, 500, 500, [110, 19, 26]],
  // 2.0.117: без названия, 50×50 см, у каждого кабинета свой цвет (цвета в списке не повторяются)
  // 2.0.134: цвета темнее, в тон остальной библиотеке, и подобраны так, чтобы не совпадать ни с одним кабинетом
  ["(120x120)", 120, 120, 500, 500, [136, 0, 87]],
  ["(144x144)", 144, 144, 500, 500, [0, 81, 0]],
  ["(160x160)", 160, 160, 500, 500, [67, 67, 96]],
  ["(200x200)", 200, 200, 500, 500, [106, 53, 45]],
  ["(240x240)", 240, 240, 500, 500, [98, 56, 77]],
  ["(320x320)", 320, 320, 500, 500, [130, 10, 50]]
];
const TYPES = CATALOG.slice().sort((a, b) => a[1] * a[2] - b[1] * b[2] || a[1] - b[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
const DEFAULT_TYPE = "Dicolor UC-260 - (192x192)";
const INSC = ["Авто", "6 px"];
for (let n = 10; n <= 900; n += 10) INSC.push(n + " px");
const ROTS = ["0°", "-90°", "90°", "180°"], ROT_DEG = [0, -90, 90, 180];
const angS = (v) => String(Math.round(+v * 100) / 100).replace(".", ",");
const normDeg = (d) => {
  d = Math.round(d) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
};
const titleRot = (st) => st.rotDeg != null ? st.rotDeg : ROT_DEG[clampI(st.rotationIndex, 4)];
const NUM_FORMATS = ["1,1", "1-1", "1 / 1", "C1-R1", "1"];
const NUM_ORIGINS = ["Слева-снизу", "Слева-сверху", "Справа-снизу", "Справа-сверху"];
const NUM_POS = ["По центру", "Слева снизу", "Слева сверху", "Справа снизу", "Справа сверху"];
const CORNER_GLYPH = ["◣", "◤", "◥", "◢", "◟ четверть круга", "◜ четверть круга", "◝ четверть круга", "◞ четверть круга"], CORNER_NUMPOS = [1, 2, 4, 3, 1, 2, 4, 3];
// 3.0.43: надписи масок — встроенным LMG Mask (копия PT Sans — ближе всего к Gill Sans; в PDF/SVG — кривыми, у всех одинаково), недостающие знаки — LMG Sans
let FONT = '"LMG Mask SR", "LMG Sans", "Gill Sans", "Gill Sans MT", GillSans, Calibri, "Segoe UI", system-ui, sans-serif';
const col = (r, g, b, a = 1) => ({ r, g, b, a });
const fromRGB = ([r, g, b]) => col(r / 255, g / 255, b / 255, 1);
const DEF_NUM_COLOR = col(128 / 255, 128 / 255, 128 / 255);
const DEF_PAINT = col(0.475, 0.125, 0.025);
function newUid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
function defaultScreen(name = "screen 1") {
  const t = TYPES.find((t2) => t2[0] === DEFAULT_TYPE);
  return {
    cabWpx: t[1],
    cabHpx: t[2],
    cabCols: 16,
    cabRows: 9,
    name,
    cabinetTypeName: DEFAULT_TYPE,
    line1Enabled: true,
    line2Enabled: true,
    line3Enabled: false,
    numberPositionIndex: 0,
    pixelColor: fromRGB(t[5]),
    numberColor: { ...DEF_NUM_COLOR },
    inscriptionIndex: 0,
    numSize: 0,
    rotationIndex: 0,
    numberFormatIndex: 0,
    numberOriginIndex: 0,
    blackCabinets: [],
    cabGroups: [],
    cabRot: {},
    cabinetColors: {},
    extraLabels: [],
    titleOffsetX: 0,
    titleOffsetY: 0,
    persistentContours: [],
    borders: [],
    showPersistentContour: true,
    showInfo: false,
    rotDeg: 0,
    cornerCabinets: {},
    shapedCols: {},
    shapedRows: {},
    cabShift: {},
    uid: newUid(),
    kind: "led",
    proj: defProj()
  };
}
const clampI = (v, n) => Math.max(0, Math.min(n - 1, parseInt(v, 10) || 0));
const pint = (v, d = 1) => {
  const m = String(v != null ? v : "").match(/^\s*([-+]?\d+)/);
  return m ? parseInt(m[1], 10) : d;
};
const pfloat = (v) => {
  const m = String(v != null ? v : "").match(/^\s*([-+]?\d+(?:[.,]\d+)?)/);
  return m ? parseFloat(m[1].replace(",", ".")) : 0;
};
const SHAPED = { "1/4": [0.25, "1/4 · 90°"], "1/2": [0.5, "1/2 · 60°"] };
const shapedPx = (st, v) => typeof v === "string" ? SHAPED[v] ? Math.max(1, Math.round(Math.max(1, st.cabWpx) * SHAPED[v][0])) : 0 : v > 0 ? v : 0;
function grid(st) {
  const cols = Math.max(1, st.cabCols), rows = Math.max(1, st.cabRows), sc = st.shapedCols || {}, sr = st.shapedRows || {};
  const xs = [0], ys = [0];
  for (let c = 0; c < cols; c++) xs.push(xs[c] + (shapedPx(st, sc[c]) || Math.max(1, st.cabWpx)));
  for (let r = 0; r < rows; r++) ys.push(ys[r] + (sr[r] > 0 ? sr[r] : Math.max(1, st.cabHpx)));
  return { xs, ys };
}
// 2.0.150: смещение ОТДЕЛЬНЫХ кабинетов (под конструкцию/каше). cabShift["c,r"] = [dx, dy] в пикселях маски
// (dy — вверх по оси маски, может быть отрицательным). Двигаются только выделенные кабинеты; разрешение растёт само.
const cof = (st, c, r) => (st.cabShift || {})[key(c, r)] || [0, 0];
const hasShift = (st) => st.cabShift && Object.keys(st.cabShift).length > 0;
const cabRotOf = (st, c, r) => +(st.cabRot || {})[key(c, r)] || 0;
const hasRot = (st) => !!st.cabRot && Object.keys(st.cabRot).length > 0;
const normCabRot = (a) => Math.round((((a % 360) + 540) % 360 - 180) * 100) / 100;
// габаритная рамка всех кабинетов с учётом их личных сдвигов (в координатах маски)
// 2.0.194: габарит запоминается, пока не изменились сетка, сдвиги и повороты кабинетов
// (его спрашивают сотни раз за одно обновление мэппинга, а обход всех кабинетов дорогой)
const shiftBoxMemo = new WeakMap();
function shiftBox(st) {
  const g = grid(st);
  const sig = g.xs.join(",") + "|" + g.ys.join(",") + "|" + (hasShift(st) ? JSON.stringify(st.cabShift) : "") + "|" + (hasRot(st) ? JSON.stringify(st.cabRot) : "");
  const m = shiftBoxMemo.get(st);
  if (m && m.sig === sig) return { ...m.v };
  const v = shiftBox0(st, g);
  shiftBoxMemo.set(st, { sig, v });
  return { ...v };
}
function shiftBox0(st, g) {
  const C = Math.max(1, st.cabCols), R = Math.max(1, st.cabRows);
  let mnX = Infinity, mxX = -Infinity, mnY = Infinity, mxY = -Infinity;
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const o = cof(st, c, r);
    let l = g.xs[c] + o[0], rt = g.xs[c + 1] + o[0], bt = g.ys[r] + o[1], tp = g.ys[r + 1] + o[1];
    const ra = cabRotOf(st, c, r);
    if (ra) {
      // повёрнутый кабинет занимает больше места — габарит по его углам
      const a = ra * Math.PI / 180, ca = Math.abs(Math.cos(a)), sa = Math.abs(Math.sin(a)), cx = (l + rt) / 2, cy = (bt + tp) / 2, hw = (rt - l) / 2, hh = (tp - bt) / 2;
      const ex = ca * hw + sa * hh, ey = sa * hw + ca * hh;
      l = cx - ex; rt = cx + ex; bt = cy - ey; tp = cy + ey;
    }
    if (l < mnX) mnX = l;
    if (rt > mxX) mxX = rt;
    if (bt < mnY) mnY = bt;
    if (tp > mxY) mxY = tp;
  }
  if (!isFinite(mnX)) { mnX = 0; mxX = g.xs[C]; mnY = 0; mxY = g.ys[R]; }
  // 2.0.174: у повёрнутых кабинетов границы дробные — округляем наружу, чтобы разрешение маски было целым (3072×2581, а не 3072×2581.41…)
  mnX = Math.floor(mnX + 1e-6); mnY = Math.floor(mnY + 1e-6);
  mxX = Math.ceil(mxX - 1e-6); mxY = Math.ceil(mxY - 1e-6);
  return { ox: -mnX, oy: -mnY, w: mxX - mnX, h: mxY - mnY };
}
// сдвиг левого-нижнего угла кабинета (c,r) в координатах маски (y вверх, с учётом нормализации к 0)
function cabShift(st) {
  const sb = shiftBox(st);
  return { dx: (c, r) => cof(st, c, r)[0] + sb.ox, dy: (c, r) => cof(st, c, r)[1] + sb.oy, sb };
}
// 2.0.176: разрешение в программе всегда чётное (нечётное для видеосигнала и медиасервера не годится)
function evenPx(v) {
  v = Math.ceil(+v - 1e-6);
  return v % 2 ? v + 1 : v;
}
const dims = (st) => {
  const d = dims0(st);
  return [evenPx(d[0]), evenPx(d[1])];
};
const dims0 = (st) => {
  if (st.kind === "proj") {
    const g2 = projGeom(st);
    return [g2.W, g2.H];
  }
  if (st.kind === "tv") {
    const g2 = tvGeom(st);
    return [g2.W, g2.H];
  }
  if (st.kind === "pix" || st.kind === "tube") {
    const g2 = pixGeom(st);
    return [g2.W, g2.H];
  }
  if (st.kind === "ring") {
    const g2 = ringGeom(st);
    return [g2.W, g2.H];
  }
  if (st.kind === "vol") {
    if (!VOL_MASK_UI) return [1600, volComH(st, 1600)]; // без маски «картинка» экрана — схема коммутации
    const g2 = volGeom(st);
    return [g2.W, g2.H];
  }
  const sb = shiftBox(st);
  return [sb.w, sb.h];
};
const PJ_PRESETS = [["Full HD 1920×1080", 1920, 1080], ["WUXGA 1920×1200", 1920, 1200], ["4K UHD 3840×2160", 3840, 2160], ["WQXGA 2560×1600", 2560, 1600], ["HD 1280×720", 1280, 720], ["WXGA 1280×800", 1280, 800], ["XGA 1024×768", 1024, 768], ["SXGA+ 1400×1050", 1400, 1050]];
const PJ_COLORS = ["#FF3B30", "#34C759", "#0A84FF", "#FFCC00", "#FF2D92", "#32D7E6", "#FF9500", "#AF52DE"];
const defProj = () => ({ pw: 1920, ph: 1200, nx: 1, ny: 1, ox: 15, oy: 15, grid: 120, wm: 0, rot: 0, bg: "#101010", line: "#FFFFFF", text: "#FFFFFF", zones: true, frames: true, nums: false, circles: true, cells: true, hatch: false, bar: true, invert: false, mode: "grid", dome: 4096, fov: 180, az: 10, el: 10, dminor: true, dlabels: true, dsides: true });
const TV_PRESETS = [["Full HD 1920×1080", 1920, 1080], ["4K UHD 3840×2160", 3840, 2160], ["HD 1366×768", 1366, 768], ["HD 1280×720", 1280, 720], ["8K 7680×4320", 7680, 4320], ["WUXGA 1920×1200", 1920, 1200]];
const defTV = () => ({ pw: 1920, ph: 1080, nx: 1, ny: 1, rot: 0, diag: 50, label: "TV", bars: true, grid: true, safe: true, corner: false });
function tvGeom(st) {
  const T = st.tv || defTV(), pw0 = Math.max(16, T.pw | 0), ph0 = Math.max(16, T.ph | 0), pw = +T.rot ? ph0 : pw0, ph = +T.rot ? pw0 : ph0;
  const nx = Math.max(1, T.nx | 0), ny = Math.max(1, T.ny | 0), rects = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) rects.push({ n: j * nx + i + 1, x: i * pw, y: j * ph, w: pw, h: ph });
  return { T, pw, ph, nx, ny, W: nx * pw, H: ny * ph, rects };
}
const PIX_PRESETS = [["Fantaled 16×96 px · 80×300 см", 16, 96, 80, 300], ["LED tube 1 м · 24 px", 1, 24, 3, 100], ["LED tube 2 м · 48 px", 1, 48, 3, 200], ["LED tube 1 м · 12 px", 1, 12, 3, 100], ["LED tube 2 м · 24 px", 1, 24, 3, 200], ["Бочка · 8×8 px · 30×30 см", 8, 8, 30, 30]];
// gx/gy — расстояние между соседними элементами от края до края (см); шаг sx/sy = размер элемента + расстояние.
// scaleOn/scale — масштаб маски: каждый пиксель элемента становится scale×scale.
const defPix = () => ({ ew: 16, eh: 96, cmw: 80, cmh: 300, gx: 0, gy: 0, cols: 10, rows: 1, nums: true, shade: true, phys: false, scaleOn: false, scale: 2 });
// Плотность пикселей элемента (px на см): по высоте; по ширине — у элементов шириной 1 px (трубки) та же, что по высоте
function pixDens(X) {
  const ew = Math.max(1, X.ew | 0), eh = Math.max(1, X.eh | 0), cmw = Math.max(0, +X.cmw || 0), cmh = Math.max(0, +X.cmh || 0);
  const ky = cmh > 0 ? eh / cmh : 0, kx = ew > 1 && cmw > 0 ? ew / cmw : ky;
  // d — одна плотность (px на 1 см) для всей маски «По размеру»: берём большую, чтобы ни один пиксель элемента не потерялся
  return { kx, ky, d: Math.max(kx, ky) };
}
// Масштаб маски: число ×N или "cm" — подобрать так, чтобы 1 px маски был не больше 1 см (промежуток меняется на каждый сантиметр)
function pixK(X) {
  if (!X.scaleOn) return 1;
  if (X.scale === "cm") {
    const m = pixDens(X).d;
    return isFinite(m) && m > 0 ? Math.max(1, Math.min(20, Math.ceil(1 / m - 1e-9))) : 1;
  }
  return Math.max(1, Math.min(20, X.scale | 0 || 1));
}
function pixGeom(st) {
  const X = st.pix || defPix(), k = pixK(X), ew0 = Math.max(1, X.ew | 0), eh0 = Math.max(1, X.eh | 0), cols = Math.max(1, X.cols | 0), rows = Math.max(1, X.rows | 0);
  const ew = ew0 * k, eh = eh0 * k;
  const cmw = Math.max(0, +X.cmw || 0), cmh = Math.max(0, +X.cmh || 0), sx = cmw + Math.max(0, +X.gx || 0), sy = cmh + Math.max(0, +X.gy || 0);
  const wm = ((cols - 1) * sx + cmw) / 100, hm = ((rows - 1) * sy + cmh) / 100, base = { X, k, ew: ew0, eh: eh0, cols, rows, sx, sy, wm, hm };
  if (X.phys && cmh > 0 && cmw > 0) {
    // 2.0.36 «По размеру»: маска в пропорциях реальных размеров в см. Одна плотность d (px на 1 см) по ширине и высоте;
    // размер элемента и промежуток переводятся из см в px один раз для всех — элементы и промежутки одинаковые.
    // При масштабе ×N всё в N раз крупнее (промежуток меняется в N раз мельче шагом).
    const d = pixDens(X).d * k, ewp = Math.max(1, Math.round(cmw * d)), ehp = Math.max(1, Math.round(cmh * d));
    const gxp = Math.max(0, Math.round((sx - cmw) * d)), gyp = Math.max(0, Math.round((sy - cmh) * d));
    return { ...base, phys: true, ewp, ehp, gxp, gyp, cmPerPx: [1 / d, 1 / d], W: cols * ewp + (cols - 1) * gxp, H: rows * ehp + (rows - 1) * gyp, rect: (c, r) => [c * (ewp + gxp), r * (ehp + gyp), ewp, ehp] };
  }
  return { ...base, phys: false, W: cols * ew, H: rows * eh, rect: (c, r) => [c * ew, r * eh, ew, eh] };
}
const defTube = () => ({ len: 1, px: 24, wm: 3, hm: 2, step: 25, shade: true });
function tubeGeom(st) {
  const T = st.tube || defTube(), len = +T.len === 2 ? 2 : 1, step = Math.max(1, +T.step || 25), tpx = Math.max(1, +T.px || 24 * len);
  const cols = Math.max(1, Math.floor((+T.wm || 0) * 100 / step + 1e-6) + 1), rows = Math.max(1, Math.round((+T.hm || 0) / len) || 1);
  return { X: { nums: false, shade: T.shade !== false, cmw: step, cmh: len * 100 }, T, len, step, ew: 1, eh: tpx, cols, rows, W: cols, H: rows * tpx };
}
const pixColor = (c, light) => "hsl(".concat(Math.round(c * 137.508 % 360), ", 85%, ").concat(light, "%)");
