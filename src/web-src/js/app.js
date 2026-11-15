
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
const FONT = '"Gill Sans", "Gill Sans MT", GillSans, Calibri, "Segoe UI", system-ui, sans-serif';
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
function shiftBox(st) {
  const g = grid(st), C = Math.max(1, st.cabCols), R = Math.max(1, st.cabRows);
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
// ===== 2.0.49: Волюметрик — объёмные LED-матрицы из нитей (P3D Matrix Light и свои) =====
// Кабинет висит под потолком, из него вниз — сетка нитей sx × sz (ширина × глубина), у каждой нити px пикселей.
// Координаты нити: x — слева направо, z — от переднего ряда (0) к заднему.
// 2.0.57: маска волюметрика СКРЫТА по просьбе — остаётся только «Коммутация». Код маски (срезы / по адресации,
// масштаб, галочка «Маска» в ТЗ) не удалён: чтобы вернуть, поставьте VOL_MASK_UI = true.
const VOL_MASK_UI = false;
const VOL_MODELS = [
  { name: "P3D Matrix Light CL-3DP62.5 · нить 2 м (32 px)", sx: 8, sz: 8, cw: 50, cd: 50, px: 32, len: 2 },
  { name: "P3D Matrix Light CL-3DP62.5 · нить 4 м (64 px)", sx: 8, sz: 8, cw: 50, cd: 50, px: 64, len: 4 },
  { name: "P3D Matrix Light CL-3DP83.3 · нить 3 м (36 px)", sx: 6, sz: 6, cw: 50, cd: 50, px: 36, len: 3 }
];
const defVol = () => ({ model: 0, sx: 8, sz: 8, cw: 50, cd: 50, px: 32, len: 2, cx: 2, cz: 2, view: "com", side: "top", start: "fl", dir: "rows", line: "round", snake: false, manual: null, off: [], layout: "slices", perRow: 0, ip: "2.0.0.3", scaleOn: false, scale: 4, shade: true, show3d: true });
function volNorm(q) {
  const V = defVol();
  if (!q || typeof q !== "object") return V;
  if (q.model != null) V.model = q.model === "custom" ? "custom" : Math.max(0, Math.min(VOL_MODELS.length - 1, pint(q.model, 0)));
  for (const k of ["sx", "sz", "px", "cx", "cz"]) if (q[k] != null) V[k] = Math.max(1, Math.min(k === "px" ? 1024 : 64, pint(q[k], V[k])));
  for (const k of ["cw", "cd", "len"]) if (q[k] != null && +q[k] > 0) V[k] = +q[k];
  V.layout = q.layout === "dmx" ? "dmx" : "slices";
  V.perRow = Math.max(0, pint(q.perRow, 0));
  V.view = q.view === "mask" ? "mask" : "com"; // 2.0.55: по умолчанию — «Коммутация»
  V.side = q.side === "top" ? "top" : "bottom";
  V.start = ["fl", "fr", "bl", "br"].includes(q.start) ? q.start : "fl";
  V.dir = q.dir === "cols" ? "cols" : "rows";
  V.line = q.line === "arc" ? "arc" : "round"; // 2.0.89: «Прямые» (по умолчанию) и «Дуги» // 2.0.84: вид линий коммутации
  V.snake = q.snake != null ? !!q.snake : q.order === "snake";
  V.off = Array.isArray(q.off) ? q.off.filter((k) => /^\d+,\d+$/.test(k) && +k.split(",")[0] < V.cx && +k.split(",")[1] < V.cz) : [];
  V.manual = Array.isArray(q.manual) && q.manual.every((k) => /^\d+,\d+$/.test(k)) ? q.manual.slice() : null;
  if (V.manual && V.manual.length !== V.cx * V.cz - V.off.length) V.manual = null;
  if (typeof q.ip === "string" && /^\d{1,3}(\.\d{1,3}){3}$/.test(q.ip.trim())) V.ip = q.ip.trim();
  for (const k of ["scaleOn", "shade", "show3d"]) if (q[k] != null) V[k] = !!q[k];
  if (q.scale != null) V.scale = Math.max(1, Math.min(20, pint(q.scale, 4)));
  if (V.model !== "custom") Object.assign(V, VOL_MODELS[V.model], { name: void 0 });
  delete V.name;
  return V;
}
// Порядок нитей внутри кабинета (лист адресации P3D, вид на лицевую сторону — снизу):
// четверти 1 — верх-право, 2 — верх-лево, 3 — низ-право, 4 — низ-лево; внутри четверти — ряды сверху вниз, справа налево.
// 2.0.58: верх листа (где первые номера) — ФРОНТ кабинета; лево-право — как у зрителя.
function volAddrMap(sx, sz) {
  const out = [], hx = sx % 2 ? 0 : sx / 2, hz = sz % 2 ? 0 : sz / 2;
  const quads = hx && hz ? [[hx, sx, 0, hz], [0, hx, 0, hz], [hx, sx, hz, sz], [0, hx, hz, sz]] : [[0, sx, 0, sz]];
  for (const [c0, c1, r0, r1] of quads) for (let pr = r0; pr < r1; pr++) for (let pc = c1 - 1; pc >= c0; pc--) out.push([pc, pr]);
  return out;
}
function volIp(base, k) {
  const p = base.split(".").map((v) => +v || 0);
  let n = ((p[0] * 256 + p[1]) * 256 + p[2]) * 256 + p[3] + k;
  const o = [];
  for (let i = 0; i < 4; i++) {
    o.unshift(n % 256);
    n = Math.floor(n / 256);
  }
  return o.join(".");
}
function volGeom(st) {
  const V = st.vol || (st.vol = defVol()), k = V.scaleOn ? Math.max(1, V.scale | 0) : 1;
  const NX = V.cx * V.sx, NZ = V.cz * V.sz, per = V.sx * V.sz, perUni = Math.max(1, Math.floor(512 / (V.px * 3)));
  const uniPerCab = Math.ceil(per / perUni), map = volAddrMap(V.sx, V.sz), cabs = [];
  for (const [c, r] of volOrder(V)) cabs.push({ c, r, n: cabs.length, ip: volIp(V.ip, cabs.length) });
  const strands = [];
  for (const cab of cabs) map.forEach(([lx, lz], j) => strands.push({ x: cab.c * V.sx + lx, z: cab.r * V.sz + lz, cab: cab.n, n: j, uni: Math.floor(j / perUni), ord: strands.length }));
  let W, H, place;
  if (V.layout === "dmx") {
    W = strands.length;
    H = V.px;
    place = (s2) => [s2.ord, 0];
  } else {
    const R = V.perRow > 0 ? Math.min(V.perRow, NZ) : NZ, rows = Math.ceil(NZ / R);
    W = R * NX;
    H = rows * V.px;
    place = (s2) => [s2.z % R * NX + s2.x, Math.floor(s2.z / R) * V.px];
  }
  return { V, k, NX, NZ, per, perUni, uniPerCab, cabs, strands, place, W: W * k, H: H * k, pitchX: V.cw / V.sx, pitchZ: V.cd / V.sz };
}
function volColor(g, s2) {
  const V = g.V;
  if (V.layout === "dmx") return pixColor(s2.cab, V.shade !== false && s2.uni % 2 ? 36 : 50);
  return pixColor(s2.z, V.shade !== false && s2.x % 2 ? 38 : 48);
}
function drawVol(ctx, st, s) {
  const g = volGeom(st), k = g.k, Wp = Math.max(1, Math.round(g.W * s)), Hp = Math.max(1, Math.round(g.H * s)), f = (v) => Math.round(v * s);
  ctx.save();
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, Wp, Hp);
  for (const s2 of g.strands) {
    const [cx, cy] = g.place(s2), x = cx * k, y = cy * k, h = g.V.px * k;
    ctx.fillStyle = volColor(g, s2);
    ctx.fillRect(f(x), f(y), Math.max(1, f(x + k) - f(x)), Math.max(1, f(y + h) - f(y)));
  }
  drawPlateTitle(ctx, st, s, g.W, g.H, false, true);
  drawInfo(ctx, st, s);
  ctx.restore();
}
const chWord = (n) => n % 10 === 1 && n % 100 !== 11 ? "канал" : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? "канала" : "каналов";
const cmFmt = (v) => String(+(+v).toFixed(2)).replace(".", ",");
function volInfoLines(st) {
  const g = volGeom(st), V = g.V, nc = g.cabs.length, noff = V.cx * V.cz - nc, model = V.model === "custom" ? "свой кабинет" : VOL_MODELS[V.model].name;
  const [W, H] = dims(st);
  return [
    "Волюметрик: ".concat(model),
    "Кабинетов: ".concat(V.cx, "×").concat(V.cz, " (").concat(nc).concat(noff ? ", погашено " + noff : "", ") · кабинет ").concat(V.cw, "×").concat(V.cd, " см, нитей ").concat(V.sx, "×").concat(V.sz, " · шаг ").concat(cmFmt(g.pitchX)).concat(Math.abs(g.pitchX - g.pitchZ) > 0.01 ? "×" + cmFmt(g.pitchZ) : "", " см"),
    "Нитей: ".concat(g.NX, "×").concat(g.NZ, " = ").concat(g.strands.length, " · по ").concat(V.px, " px, ").concat(V.len, " м · всего ").concat(g.strands.length * V.px, " px"),
    "Размер: ".concat(volSize(V), " (высота — длина нити)"),
    "DMX: нить ".concat(V.px * 3, " ").concat(chWord(V.px * 3), " · ").concat(g.perUni, " нит. в universe · ").concat(g.uniPerCab, " universe на кабинет · всего ").concat(g.uniPerCab * nc),
    "IP: ".concat(nc ? g.cabs[0].ip : "—").concat(nc > 1 ? " … " + g.cabs[nc - 1].ip : "", " · Art-Net порт 6454 · Net 0 · Subnet 0"),
    VOL_MASK_UI && "Маска: ".concat(V.layout === "dmx" ? "по адресации (нити подряд по коммутации)" : "срезы по глубине (срез 1 — передний ряд)", " · ").concat(W, "×").concat(H, " px").concat(g.k > 1 ? " · масштаб ×" + g.k : "")
  ].filter(Boolean);
}
// ---- 3D-вид: окно в углу холста, крутится мышью / пальцем, колесо — масштаб, двойной щелчок — сброс ----
// pitch > 0 — взгляд сверху (дальний ряд выше), < 0 — снизу: фронт вверху, как на листе адресации и схеме «вид снизу»
const vol3d = { yaw: -0.6, pitch: 0.42, zoom: 1, key: "" };
const VOL3D_VIEWS = { iso: [-0.6, 0.42], front: [0, 0.08], side: [-Math.PI / 2, 0.08], top: [0, 1.45], bottom: [0, -1.45] };
function vol3dDraw(force) {
  volComDraw();
  const cv = document.getElementById("vol3d"), box = document.getElementById("vol3dBox");
  if (!cv || !box) return;
  const st = S();
  if (ui.page !== "mask" || st.kind !== "vol" || !(st.vol && st.vol.show3d !== false)) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  const dpr = Math.min(2, window.devicePixelRatio || 1), cw = cv.clientWidth || 320, ch = cv.clientHeight || 260;
  const key = JSON.stringify(st.vol) + [vol3d.yaw, vol3d.pitch, vol3d.zoom, cw, ch, dpr].join(",");
  if (!force && key === vol3d.key) return;
  vol3d.key = key;
  if (cv.width !== Math.round(cw * dpr) || cv.height !== Math.round(ch * dpr)) {
    cv.width = Math.round(cw * dpr);
    cv.height = Math.round(ch * dpr);
  }
  const c = cv.getContext("2d");
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  vol3dPaint(c, st, cw, ch, vol3d, false);
}
// 3D-картинка: в окне и для ТЗ (big — крупные подписи, без подсказки про мышь).
// 2.0.56: понятнее — пол с сеткой 0,5 м и отметкой «ФРОНТ», размерные линии Ш / В / Г в метрах,
// кабинеты — плиты с номерами (порядок коммутации), нити — цветом своего кабинета, дальние бледнее.
function vol3dPaint(c, st, cw, ch, view, big) {
  const g = volGeom(st), V = g.V;
  c.save();
  c.fillStyle = "#0b0d10";
  c.fillRect(0, 0, cw, ch);
  const Wm = V.cx * V.cw / 100, Dm = V.cz * V.cd / 100, Hm = V.len, px2 = g.pitchX / 100, pz2 = g.pitchZ / 100;
  const ca = Math.cos(view.yaw), sa = Math.sin(view.yaw), cb = Math.cos(view.pitch), sb = Math.sin(view.pitch);
  const sc = Math.min(cw * 0.62 / Math.max(Wm + Dm * 0.7, 0.1), (ch - 40) * 0.86 / Math.max(Hm + (Wm + Dm) * 0.35, 0.1)) * view.zoom, ox = cw / 2, oy = ch / 2 + 2;
  // мир: X вправо, Y вверх (низ кабинетов = Hm/2), Z — от фронта (−) назад (+); камера спереди
  const P = (X, Y, Z) => {
    const x1 = X * ca + Z * sa, z1 = -X * sa + Z * ca, y2 = Y * cb + z1 * sb, z2 = -Y * sb + z1 * cb;
    return [ox + x1 * sc, oy - y2 * sc, z2];
  };
  const top = Hm / 2, floor = -Hm / 2, X0 = -Wm / 2, Z0 = -Dm / 2, slab = Math.min(0.12, Math.max(0.05, Math.min(V.cw, V.cd) / 100 * 0.16));
  const u = big ? ch / 900 : Math.max(0.75, Math.min(cw, ch) / 300);
  const line = (a, b) => {
    c.beginPath();
    c.moveTo(a[0], a[1]);
    c.lineTo(b[0], b[1]);
    c.stroke();
  };
  const poly = (pts, fill, stroke) => {
    c.beginPath();
    pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
    c.closePath();
    if (fill) {
      c.fillStyle = fill;
      c.fill();
    }
    if (stroke) {
      c.strokeStyle = stroke;
      c.stroke();
    }
  };
  // пол: сетка 0,5 м, фронт — бирюзовый край
  {
    const m = 0.5, fx0 = X0 - m, fx1 = -X0 + m, fz0 = Z0 - m, fz1 = -Z0 + m;
    poly([P(fx0, floor, fz0), P(fx1, floor, fz0), P(fx1, floor, fz1), P(fx0, floor, fz1)], "rgba(70,80,100,0.10)", null);
    c.lineWidth = 1;
    c.strokeStyle = "rgba(140,150,170,0.16)";
    for (let x = Math.ceil(fx0 / 0.5) * 0.5; x <= fx1 + 1e-6; x += 0.5) line(P(x, floor, fz0), P(x, floor, fz1));
    for (let z = Math.ceil(fz0 / 0.5) * 0.5; z <= fz1 + 1e-6; z += 0.5) line(P(fx0, floor, z), P(fx1, floor, z));
    c.lineWidth = Math.max(1.5, 2.5 * u);
    c.strokeStyle = "#2ec4a7";
    line(P(fx0, floor, fz0), P(fx1, floor, fz0));
  }
  const cells = [];
  for (let r = 0; r < V.cz; r++) for (let cc = 0; cc < V.cx; cc++) cells.push({ c: cc, r, on: volOn(V, cc, r) });
  const cabNo = new Map(g.cabs.map((cb2) => [cb2.c + "," + cb2.r, cb2.n]));
  // нити — от дальних к ближним, цветом кабинета; дальние бледнее
  const many = g.strands.length * V.px > 30000, list = g.strands.map((s2) => {
    const X = X0 + (s2.x + 0.5) * px2, Z = Z0 + (s2.z + 0.5) * pz2;
    return { s2, X, Z, d: P(X, 0, Z)[2] };
  }).sort((a, b) => b.d - a.d);
  const dmin = list.length ? list[list.length - 1].d : 0, dmax = list.length ? list[0].d : 1;
  const dot = Math.max(big ? 2 : 1.4, Math.min(big ? 6 : 3.2, sc * Hm / V.px * 0.42));
  for (const it of list) {
    const col = pixColor(it.s2.cab, 55), a = 1 - 0.55 * (dmax > dmin ? (it.d - dmin) / (dmax - dmin) : 0);
    c.globalAlpha = a * 0.55;
    c.strokeStyle = col;
    c.lineWidth = Math.max(0.6, dot * 0.35);
    line(P(it.X, top, it.Z), P(it.X, floor, it.Z));
    c.globalAlpha = a;
    if (!many) {
      c.fillStyle = col;
      for (let i = 0; i < V.px; i++) {
        const [x, y] = P(it.X, top - (i + 0.5) * Hm / V.px, it.Z);
        c.fillRect(x - dot / 2, y - dot / 2, dot, dot);
      }
    }
  }
  c.globalAlpha = 1;
  // кабинеты — плиты (низ = верх нитей), включённые с номером
  cells.sort((a, b) => P(X0 + (b.c + 0.5) * V.cw / 100, top, Z0 + (b.r + 0.5) * V.cd / 100)[2] - P(X0 + (a.c + 0.5) * V.cw / 100, top, Z0 + (a.r + 0.5) * V.cd / 100)[2]);
  c.lineWidth = Math.max(1, 1.4 * u);
  for (const cab of cells) {
    const xa = X0 + cab.c * V.cw / 100, za = Z0 + cab.r * V.cd / 100, xb = xa + V.cw / 100, zb = za + V.cd / 100, n = cabNo.get(cab.c + "," + cab.r);
    const col = cab.on ? pixColor(n, 55) : "rgba(154,161,173,0.35)";
    const b = [P(xa, top, za), P(xb, top, za), P(xb, top, zb), P(xa, top, zb)], t = [P(xa, top + slab, za), P(xb, top + slab, za), P(xb, top + slab, zb), P(xa, top + slab, zb)];
    if (cab.on) {
      for (const [i, j] of [[0, 1], [1, 2], [2, 3], [3, 0]]) poly([b[i], b[j], t[j], t[i]], "rgba(28,32,40,0.92)", null);
      poly(view.pitch > 0 ? t : b, "rgba(42,48,58,0.95)", col);
      poly(view.pitch > 0 ? b : t, null, col);
    } else {
      c.setLineDash([4, 4]);
      poly(b, null, col);
      c.setLineDash([]);
    }
  }
  // номера кабинетов
  const fz = Math.round(big ? 26 * u : Math.max(10, 11 * u));
  c.font = "700 ".concat(fz, "px ").concat(FONT);
  c.textAlign = "center";
  c.textBaseline = "middle";
  for (const cab of g.cabs) {
    const [x, y] = P(X0 + (cab.c + 0.5) * V.cw / 100, top + (view.pitch > 0 ? slab : 0), Z0 + (cab.r + 0.5) * V.cd / 100);
    c.fillStyle = "rgba(0,0,0,0.7)";
    c.fillRect(x - fz * 0.85, y - fz * 0.7, fz * 1.7, fz * 1.4);
    c.fillStyle = "#fff";
    c.fillText(String(cab.n + 1), x, y);
  }
  // размерные линии
  const dim = (a, b, label, off) => {
    const pa = P(...a), pb = P(...b), mx = (pa[0] + pb[0]) / 2 + off[0], my = (pa[1] + pb[1]) / 2 + off[1];
    if (Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) < 24) return [mx, my]; // в этом ракурсе размер не виден (например, высота сверху)
    c.strokeStyle = "#ffd23f";
    c.fillStyle = "#ffd23f";
    c.lineWidth = Math.max(1.2, 2 * u);
    line(pa, pb);
    const ang = Math.atan2(pb[1] - pa[1], pb[0] - pa[0]), tk = 5 * u + 3;
    for (const p of [pa, pb]) line([p[0] - Math.sin(ang) * tk, p[1] + Math.cos(ang) * tk], [p[0] + Math.sin(ang) * tk, p[1] - Math.cos(ang) * tk]);
    c.font = "700 ".concat(Math.round(big ? 24 * u : Math.max(10, 11 * u)), "px ").concat(FONT);
    const tw = c.measureText(label).width + 8;
    c.fillStyle = "rgba(11,13,16,0.85)";
    c.fillRect(mx - tw / 2, my - 9 * (big ? 2.2 * u : 1), tw, 18 * (big ? 2.2 * u : 1));
    c.fillStyle = "#ffd23f";
    c.fillText(label, mx, my);
    return [mx, my];
  };
  const gap = 0.1 + 0.12 * Math.max(Wm, Dm);
  const wl = dim([X0, floor, Z0 - gap], [-X0, floor, Z0 - gap], "ширина " + compactM(Wm) + " м", [0, Math.round(big ? 22 * u : 12 * u)]);
  dim([-X0 + gap, floor, Z0], [-X0 + gap, floor, -Z0], "глубина " + compactM(Dm) + " м", [0, 0]);
  dim([-X0 + gap, floor, Z0], [-X0 + gap, top, Z0], "высота " + compactM(Hm) + " м", [0, 0]);
  // «ФРОНТ» — у переднего края пола, ниже размерной линии ширины
  {
    const fs = Math.round(big ? 24 * u : Math.max(10, 11 * u)), [x, y] = [wl[0], wl[1] + fs * 1.7];
    c.font = "700 ".concat(Math.round(big ? 24 * u : Math.max(10, 11 * u)), "px ").concat(FONT);
    c.fillStyle = "#2ec4a7";
    c.fillText("▲ ФРОНТ", x, y);
  }
  c.textAlign = "left";
  c.fillStyle = "rgba(255,255,255,0.6)";
  if (big) {
    c.font = "600 ".concat(Math.round(ch / 32), "px ").concat(FONT);
    c.fillText("3D-вид · ".concat(g.cabs.length, " кабинетов · ").concat(volSize(V)), ch / 40, ch / 28);
  } else {
    c.font = "11px ".concat(FONT);
    c.fillText(cw < 300 ? "3D" : "3D · тяните — поворот, колесо — масштаб", 8, 12);
  }
  c.restore();
}
// ---- Коммутация кабинетов: порядок, вид сверху / снизу ----
// Порядок: начальный угол (fl — передний левый, fr — передний правый, bl — задний левый, br — задний правый),
// направление (по рядам / по столбцам), змейкой; или вручную — щелчками по кабинетам (V.manual — список "c,r").
const volOn = (V, c, r) => !(V.off && V.off.indexOf(c + "," + r) >= 0);
function volOrder(V) {
  const all = [], nOn = V.cx * V.cz - (V.off ? V.off.length : 0);
  if (Array.isArray(V.manual) && V.manual.length === nOn) {
    for (const k of V.manual) {
      const [c, r] = k.split(",").map(Number);
      all.push([c, r]);
    }
    return all;
  }
  const back = V.start === "bl" || V.start === "br", right = V.start === "fr" || V.start === "br";
  const outerN = V.dir === "cols" ? V.cx : V.cz, innerN = V.dir === "cols" ? V.cz : V.cx;
  for (let o = 0; o < outerN; o++) for (let i0 = 0; i0 < innerN; i0++) {
    const rev = V.snake && o % 2 === 1, i = rev ? innerN - 1 - i0 : i0;
    if (V.dir === "cols") all.push([right ? V.cx - 1 - o : o, back ? V.cz - 1 - i : i]);
    else all.push([right ? V.cx - 1 - i : i, back ? V.cz - 1 - o : o]);
  }
  // погашенные кабинеты (как «Гашение» у LED) — не коммутируются, без IP, нитей и пикселей
  const base = all.filter(([c, r]) => volOn(V, c, r));
  if (!(V.off && V.off.length) || base.length < 3) return base;
  return volLogicalOrder(V, base);
}
// 2.0.85: при погашенных кабинетах порядок коммутации перестраивается логично — кабель идёт от кабинета к соседнему,
// без прыжков через погашенные. Из нескольких вариантов обхода (как задано, «змейкой» от ближнего конца ряда / столбца,
// обход по соседям) выбирается тот, где меньше всего прыжков к несоседнему кабинету и короче кабель. Первый кабинет — тот же.
function volLogicalOrder(V, base) {
  const K = (c, r) => c + "," + r, on = new Set(base.map(([c, r]) => K(c, r))), first = base[0];
  const adj = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;
  // оценка: прыжки к несоседнему кабинету — дорого, лишний кабель и повороты — дешевле (чтобы не было «пилы» вверх-вниз)
  const score = (o) => {
    let sc = 0;
    for (let i = 1; i < o.length; i++) {
      const dx = o[i][0] - o[i - 1][0], dy = o[i][1] - o[i - 1][1], m = Math.abs(dx) + Math.abs(dy);
      sc += m === 1 ? 0 : 20 + m;
      if (i > 1) {
        const px = o[i - 1][0] - o[i - 2][0], py = o[i - 1][1] - o[i - 2][1];
        if (Math.sign(px) !== Math.sign(dx) || Math.sign(py) !== Math.sign(dy)) sc += 2;
      }
    }
    return sc;
  };
  const cands = [base];
  // «змейка» от ближнего конца: линии (ряды или столбцы) — в заданном порядке, каждая начинается с конца, ближнего к прошлому кабинету
  for (const byRow of [true, false]) {
    const lines = new Map();
    for (const p of base) {
      const k = byRow ? p[1] : p[0];
      if (!lines.has(k)) lines.set(k, []);
      lines.get(k).push(p);
    }
    const keys = [...lines.keys()];
    const fi = keys.indexOf(byRow ? first[1] : first[0]);
    const ordKeys = [...keys.slice(fi), ...keys.slice(0, fi).reverse()];
    const o = [];
    for (const k of ordKeys) {
      const ln = lines.get(k).slice().sort((a, b) => byRow ? a[0] - b[0] : a[1] - b[1]);
      if (!o.length) {
        const i0 = ln.findIndex((q) => q[0] === first[0] && q[1] === first[1]);
        if (i0 > 0) ln.reverse();
      } else {
        const last = o[o.length - 1], d0 = Math.abs(ln[0][0] - last[0]) + Math.abs(ln[0][1] - last[1]), d1 = Math.abs(ln[ln.length - 1][0] - last[0]) + Math.abs(ln[ln.length - 1][1] - last[1]);
        if (d1 < d0) ln.reverse();
      }
      o.push(...ln);
    }
    if (o.length === base.length && o[0][0] === first[0] && o[0][1] === first[1]) cands.push(o);
  }
  // обход по соседям: следующий — соседний кабинет, у которого меньше всего свободных соседей (чтобы никого не оставить в тупике)
  for (const byRow of [true, false]) {
    const seen = new Set([K(first[0], first[1])]), o = [first];
    const free = (c, r) => on.has(K(c, r)) && !seen.has(K(c, r));
    const nb = (c, r) => [[c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]].filter(([x, y]) => free(x, y));
    let dirPrev = null;
    while (o.length < base.length) {
      const [c, r] = o[o.length - 1], opts = nb(c, r);
      let nx;
      if (opts.length) {
        opts.sort((a, b) => {
          const da = nb(a[0], a[1]).length, db = nb(b[0], b[1]).length;
          if (da !== db) return da - db;
          const sa = (byRow ? a[1] === r : a[0] === c) ? 0 : 1, sb = (byRow ? b[1] === r : b[0] === c) ? 0 : 1;
          if (sa !== sb) return sa - sb;
          const ka = dirPrev && a[0] - c === dirPrev[0] && a[1] - r === dirPrev[1] ? 0 : 1, kb = dirPrev && b[0] - c === dirPrev[0] && b[1] - r === dirPrev[1] ? 0 : 1;
          return ka - kb;
        });
        nx = opts[0];
      } else {
        let best = null, bd = 1e9;
        for (const p of base) if (!seen.has(K(p[0], p[1]))) {
          const d = Math.abs(p[0] - c) + Math.abs(p[1] - r);
          if (d < bd) bd = d, best = p;
        }
        nx = best;
      }
      dirPrev = [nx[0] - c, nx[1] - r];
      seen.add(K(nx[0], nx[1]));
      o.push(nx);
    }
    cands.push(o);
  }
  let best = base, bs = score(base);
  for (const o of cands) {
    const sc = score(o);
    if (sc < bs) bs = sc, best = o;
  }
  return best;
}
// Вид: сверху — фронт внизу; снизу (лицевая сторона, как лист адресации) — фронт вверху. Лево-право — как у зрителя.
function volComLayout(st, W, H, side) {
  const V = st.vol, m = Math.max(40, Math.min(W, H) * 0.07), top = m + Math.max(26, H * 0.05);
  const aw = W - 2 * m, ah = H - top - m - Math.max(24, H * 0.04), gap = Math.max(6, Math.min(aw, ah) * 0.012);
  const k = Math.min((aw - gap * (V.cx - 1)) / (V.cx * V.cw), (ah - gap * (V.cz - 1)) / (V.cz * V.cd));
  const cw = V.cw * k, cd = V.cd * k, gw = V.cx * cw + gap * (V.cx - 1), gh = V.cz * cd + gap * (V.cz - 1);
  const x0 = (W - gw) / 2, y0 = top + (ah - gh) / 2, bottom = (side || st.vol.side || "bottom") === "bottom";
  const rect = (c, r) => {
    const dc = c, dr = bottom ? r : V.cz - 1 - r;
    return [x0 + dc * (cw + gap), y0 + dr * (cd + gap), cw, cd];
  };
  return { m, top, x0, y0, gw, gh, cw, cd, rect, bottom };
}
function volComH(st, W) {
  const V = st.vol, r = V.cz * V.cd / (V.cx * V.cw);
  return Math.max(700, Math.min(2400, Math.round(W * 0.86 * r + W * 0.25)));
}
// opts: side — "top" / "bottom" (по умолчанию как в разделе), com — рисовать коммутацию (номера, IP, стрелки)
function volComPaint(ctx, st, W, H, opts) {
  const o = opts || {}, g = volGeom(st), V = g.V, L2 = volComLayout(st, W, H, o.side), u = Math.min(W, H) / 1000;
  // коммутация только на виде сверху; на виде снизу — лишь при ручной расстановке порядка
  const com = o.com !== false && (!L2.bottom || !!(ui.volPick && st === S()));
  ctx.save();
  ctx.fillStyle = "#101318";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#e8eaee";
  ctx.font = "600 ".concat(Math.round(Math.max(14, 30 * u)), "px ").concat(FONT);
  ctx.fillText((com ? "Коммутация кабинетов · " : "Адресация нитей · ").concat(L2.bottom ? "вид снизу (лицевая сторона)" : "вид сверху"), W / 2, L2.m * 0.55 + Math.max(10, 14 * u));
  // подписи сторон
  ctx.font = "600 ".concat(Math.round(Math.max(11, 20 * u)), "px ").concat(FONT);
  const yB = L2.y0 + L2.gh + Math.max(26, 44 * u), yT = L2.y0 - Math.max(20, 34 * u);
  ctx.fillStyle = "#2ec4a7";
  ctx.fillText(L2.bottom ? "ФРОНТ ▲" : "ФРОНТ ▼", W / 2, L2.bottom ? yT : yB);
  ctx.fillStyle = "#9aa1ad";
  ctx.fillText("ЗАД", W / 2, L2.bottom ? yB : yT);
  ctx.save();
  ctx.translate(L2.x0 - Math.max(22, 40 * u), L2.y0 + L2.gh / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("ЛЕВО", 0, 0);
  ctx.restore();
  ctx.save();
  ctx.translate(L2.x0 + L2.gw + Math.max(22, 40 * u), L2.y0 + L2.gh / 2);
  ctx.rotate(Math.PI / 2);
  ctx.fillText("ПРАВО", 0, 0);
  ctx.restore();
  const picking = com && ui.volPick && st === S(), pickList = picking ? ui.volPickList || [] : null;
  const map = volAddrMap(V.sx, V.sz);
  for (const k of V.off || []) {
    const [oc, orr] = k.split(",").map(Number), [x, y, w, h] = L2.rect(oc, orr);
    ctx.fillStyle = "#0c0e12";
    ctx.fillRect(x, y, w, h);
    ctx.setLineDash([Math.max(4, 8 * u), Math.max(3, 6 * u)]);
    ctx.lineWidth = Math.max(1, 2 * u);
    ctx.strokeStyle = "rgba(154,161,173,0.45)";
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(154,161,173,0.6)";
    ctx.font = "600 ".concat(Math.max(10, Math.min(w, h) * 0.12), "px ").concat(FONT);
    ctx.fillText("погашен", x + w / 2, y + h / 2);
  }
  const labelsLater = [];
  for (const cab of g.cabs) {
    const [x, y, w, h] = L2.rect(cab.c, cab.r), col = pixColor(cab.n, 50);
    ctx.fillStyle = "#1a1e25";
    ctx.fillRect(x, y, w, h);
    ctx.lineWidth = Math.max(2, 4 * u);
    ctx.strokeStyle = col;
    ctx.strokeRect(x + ctx.lineWidth / 2, y + ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
    // нити с номерами (как на листе адресации), если кабинет достаточно крупный
    const cs = Math.min(w / V.sx, h / V.sz);
    if (cs >= 11) {
      ctx.font = "".concat(Math.max(7, cs * 0.34), "px ").concat(FONT);
      ctx.fillStyle = com ? "rgba(230,234,240,0.32)" : "rgba(230,234,240,0.55)";
      map.forEach(([lx, lz], j) => {
        const dc = lx, dr = L2.bottom ? lz : V.sz - 1 - lz;
        ctx.fillText(String(j + 1), x + (dc + 0.5) * w / V.sx, y + (dr + 0.5) * h / V.sz);
      });
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 1; i < V.sx; i++) {
        ctx.moveTo(x + i * w / V.sx, y);
        ctx.lineTo(x + i * w / V.sx, y + h);
      }
      for (let i = 1; i < V.sz; i++) {
        ctx.moveTo(x, y + i * h / V.sz);
        ctx.lineTo(x + w, y + i * h / V.sz);
      }
      ctx.stroke();
    }
    labelsLater.push(() => {
      // номер кабинета и IP — на обоих видах (2.0.71: и на виде снизу); линия коммутации — только на виде сверху
      const pk = pickList ? pickList.indexOf(cab.c + "," + cab.r) : -1, num = picking ? pk >= 0 ? String(pk + 1) : "?" : String(cab.n + 1);
      const big = Math.max(14, Math.min(w, h) * 0.3), bh = big * 1.25;
      // без подложки: тонкая тёмная обводка, чтобы цифры читались поверх сетки
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(0,0,0,0.85)";
      ctx.font = "700 ".concat(big, "px ").concat(FONT);
      ctx.lineWidth = Math.max(2, big * 0.12);
      ctx.strokeText(num, x + w / 2, y + h / 2 - bh * 0.02);
      ctx.fillStyle = picking && pk < 0 ? "#9aa1ad" : "#ffffff";
      ctx.fillText(num, x + w / 2, y + h / 2 - bh * 0.02);
      if (!picking) {
        const sm = Math.max(11, Math.min(w, h) * 0.13);
        // 2.0.69: IP — тем же шрифтом и начертанием, что номера кабинетов на LED-масках
        ctx.font = "".concat(sm, "px ").concat(FONT);
        ctx.lineWidth = Math.max(2, sm * 0.22);
        ctx.strokeText(cab.ip, x + w / 2, y + h / 2 + bh * 0.5 + sm * 0.75);
        ctx.fillStyle = "#e8eaee";
        ctx.fillText(cab.ip, x + w / 2, y + h / 2 + bh * 0.5 + sm * 0.75);
      }
    });
  }
  // линия коммутации со стрелками (2.0.67, вариант 6): соседние кабинеты — напрямую,
  // переход на другой ряд (столбец) — не через схему, а вдоль её внешнего края и по зазору между рядами
  // 2.0.86: «Монтажная схема» — как рисуют монтажники: у кабинета вход слева, выход справа (задняя сторона, вид сверху),
  // тонкая линия со стрелкой у входа; сосед справа — короткая стрелка через стык; сосед слева / сверху / снизу — скобка «П»
  // внутри кабинетов на своём уровне (не сливаются); переход в другой ряд — снаружи схемы вдоль края
  if (com && !picking && g.cabs.length > 1 && V.line === "mount-off") {
    const cabR = g.cabs.map((cab) => L2.rect(cab.c, cab.r)), N = cabR.length;
    const LW = Math.max(2, 3.2 * u), AH = Math.max(7, 13 * u);
    // 2.0.87: вид сверху — вход справа, выход слева (как на схемах монтажника)
    const pin = (i) => [cabR[i][0] + cabR[i][2] * 0.84, cabR[i][1] + cabR[i][3] * 0.36];
    const pout = (i) => [cabR[i][0] + cabR[i][2] * 0.16, cabR[i][1] + cabR[i][3] * 0.36];
    const gap = V.cx > 1 ? (L2.gw - V.cx * L2.cw) / (V.cx - 1) : V.cz > 1 ? (L2.gh - V.cz * L2.cd) / (V.cz - 1) : Math.max(6, 12 * u);
    const out = Math.max(gap * 1.6, 24 * u);
    const draw = (P) => {
      const run = (col, w) => {
        ctx.strokeStyle = col;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(P[0][0], P[0][1]);
        for (let k = 1; k < P.length; k++) ctx.lineTo(P[k][0], P[k][1]);
        ctx.stroke();
      };
      ctx.save();
      ctx.lineJoin = "miter";
      ctx.lineCap = "butt";
      run("rgba(0,0,0,0.85)", LW + Math.max(3, 4 * u));
      run("#ffd23f", LW);
      const [x1, y1] = P[P.length - 2], [x2, y2] = P[P.length - 1], a = Math.atan2(y2 - y1, x2 - x1);
      ctx.fillStyle = "#ffd23f";
      ctx.strokeStyle = "rgba(0,0,0,0.85)";
      ctx.lineWidth = Math.max(1.5, 2 * u);
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - Math.cos(a - 0.45) * AH, y2 - Math.sin(a - 0.45) * AH);
      ctx.lineTo(x2 - Math.cos(a + 0.45) * AH, y2 - Math.sin(a + 0.45) * AH);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
      ctx.restore();
    };
    // уровни «скобок» внутри ряда: по очереди, чтобы соседние скобки не совпадали
    const lv = [0.62, 0.74, 0.86];
    for (let i = 1; i < N; i++) {
      const A = g.cabs[i - 1], B = g.cabs[i], ra = cabR[i - 1], rb = cabR[i], o = pout(i - 1), n = pin(i);
      const dc = B.c - A.c, dr = B.r - A.r, sameRow = ra[1] === rb[1], sameCol = ra[0] === rb[0];
      let P;
      if (sameRow && rb[0] < ra[0] && Math.abs(dc) === 1) P = [o, [n[0] + AH * 0.2, n[1]]];
      else if (sameRow) {
        // назад по ряду: вниз внутри кабинета, по ряду, вверх во вход
        const y = ra[1] + ra[3] * lv[i % 3];
        P = [o, [o[0], y], [n[0], y], [n[0], n[1] + AH * 0.2]];
      } else if (sameCol && Math.abs(dr) === 1) {
        // сосед сверху / снизу: из выхода по вертикали к уровню входа, влево во вход
        const x = ra[0] + ra[2] * (0.84 - 0.1 * (i % 2));
        P = [o, [x, o[1]], [x, n[1] - (rb[1] > ra[1] ? 0 : 0)], [n[0] + AH * 0.2, n[1]]];
        P = [o, [o[0], n[1]], [n[0] - AH * 0.2, n[1]]];
      } else {
        // переход в другой ряд / прыжок — снаружи схемы вдоль ближнего бокового края
        const leftSide = (ra[0] + rb[0]) / 2 < L2.x0 + L2.gw / 2;
        const xe = leftSide ? L2.x0 - out * (1 + (i % 2) * 0.5) : L2.x0 + L2.gw + out * (1 + (i % 2) * 0.5);
        const ya = ra[1] + ra[3] * 0.94, yb = rb[1] + rb[3] * 0.06;
        P = [o, [o[0], ya], [xe, ya], [xe, yb], [n[0], yb], [n[0], n[1] - AH * 0.2]];
        if (yb > ya) P = [o, [o[0], ya], [xe, ya], [xe, yb], [n[0], yb], [n[0], n[1] - AH * 0.2]];
        else {
          const ya2 = ra[1] + ra[3] * 0.06, yb2 = rb[1] + rb[3] * 0.94;
          P = [o, [o[0], ya2], [xe, ya2], [xe, yb2], [n[0], yb2], [n[0], n[1] + AH * 0.2]];
        }
      }
      draw(P);
    }
    // разъёмы: зелёный вход, красный выход
    for (let i = 0; i < N; i++) for (const [p2, colp] of [[pin(i), "#2ecc71"], [pout(i), "#ff5a5a"]]) {
      ctx.beginPath();
      ctx.arc(p2[0], p2[1], Math.max(3, 5 * u), 0, Math.PI * 2);
      ctx.fillStyle = colp;
      ctx.fill();
      ctx.lineWidth = Math.max(1, 1.5 * u);
      ctx.strokeStyle = "#000";
      ctx.stroke();
    }
    // ввод сигнала в первый кабинет — снаружи
    {
      // ввод — снизу (с фронта) или сверху, смотря где первый кабинет
      const n = pin(0), r0 = cabR[0], fromBottom = r0[1] + r0[3] / 2 > L2.y0 + L2.gh / 2, y0 = fromBottom ? L2.y0 + L2.gh + out * 1.1 : L2.y0 - out * 1.1;
      draw([[n[0], y0], [n[0], n[1] + (fromBottom ? AH * 0.2 : -AH * 0.2)]]);
      ctx.save();
      ctx.font = "700 ".concat(Math.max(10, 15 * u), "px ").concat(FONT);
      ctx.textAlign = "left";
      ctx.fillStyle = "#ffd23f";
      ctx.fillText("ВХОД", n[0] + 8 * u, y0 + (fromBottom ? -4 * u : 12 * u));
      ctx.restore();
    }
  } else if (com && !picking && g.cabs.length > 1) {
    const gap = V.cx > 1 ? (L2.gw - V.cx * L2.cw) / (V.cx - 1) : V.cz > 1 ? (L2.gh - V.cz * L2.cd) / (V.cz - 1) : Math.max(6, 12 * u);
    const mg = Math.max(gap * 1.8, 22 * u), gL = L2.x0 - mg, gR = L2.x0 + L2.gw + mg, gT = L2.y0 - mg, gB = L2.y0 + L2.gh + mg;
    const cabR = g.cabs.map((cab) => L2.rect(cab.c, cab.r));
    const curvyPts = V.line === "arc";
    const pts = cabR.map(([x, y, w, h]) => [x + w / 2, y + h * (curvyPts ? 0.5 : 0.2)]);
    const lineStyle = V.line === "arc" ? "arc" : "round", curvy = lineStyle === "arc" || lineStyle === "grad";
    const LW = Math.max(2.5, 5.5 * u), HALO = LW + Math.max(3, 6 * u), nL = Math.max(1, pts.length - 1);
    // цвет линии: жёлтый; «градиент» — от зелёного (первый кабинет) к красному (последний)
    const linkCol = (i) => lineStyle === "grad" ? "hsl(".concat(Math.round(130 - 130 * (i - 1) / Math.max(1, nL - 1)), ",95%,55%)") : "#ffd23f";
    ctx.lineWidth = LW;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    const ah = Math.max(9, 20 * u);
    const arrowAt = (x, y, a) => {
      ctx.save();
      ctx.lineWidth = Math.max(2, 3 * u);
      ctx.strokeStyle = "rgba(0,0,0,0.85)";
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * ah, y + Math.sin(a) * ah);
      ctx.lineTo(x + Math.cos(a + 2.5) * ah, y + Math.sin(a + 2.5) * ah);
      ctx.lineTo(x + Math.cos(a - 2.5) * ah, y + Math.sin(a - 2.5) * ah);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * ah, y + Math.sin(a) * ah);
      ctx.lineTo(x + Math.cos(a + 2.5) * ah, y + Math.sin(a + 2.5) * ah);
      ctx.lineTo(x + Math.cos(a - 2.5) * ah, y + Math.sin(a - 2.5) * ah);
      ctx.closePath();
      ctx.fill();
    };
    const byCols = V.dir === "cols" && !V.manual, paths = [];
    for (let i = 1; i < pts.length; i++) {
      const A = g.cabs[i - 1], B = g.cabs[i], [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      const [, rya, , rha] = cabR[i - 1], [rxb, ryb, rwb, rhb] = cabR[i], [rxa, , rwa] = cabR[i - 1];
      let path;
      if (curvy) path = [[ax, ay], [bx, by]];
      else if (A.r === B.r || A.c === B.c) path = [[ax, ay], [bx, by]];
      else if (!byCols) {
        // 2.0.82: из последнего кабинета ряда — сразу рядом с ним вниз/вверх в зазор между рядами, по зазору — к первому кабинету
        // следующего ряда и рядом с ним в него (погашенные кабинеты не обходим по краю всей схемы); у края схемы — по краю
        const right = L2.x0 + L2.gw - 1, left = L2.x0 + 1;
        const xo = ax > bx ? rxa + rwa >= right ? gR : rxa + rwa + gap / 2 : rxa <= left ? gL : rxa - gap / 2;
        const xi = ax > bx ? rxb <= left ? gL : rxb - gap / 2 : rxb + rwb >= right ? gR : rxb + rwb + gap / 2;
        const yg = ryb < rya ? ryb + rhb + gap / 2 : ryb - gap / 2;
        path = [[ax, ay], [xo, ay], [xo, yg], [xi, yg], [xi, by], [bx, by]];
      } else {
        // по столбцам: из конца столбца — к верхнему/нижнему краю, по зазору между столбцами, в начало следующего
        const bot = L2.y0 + L2.gh - 1, top = L2.y0 + 1;
        const yo = ay > by ? rya + rha >= bot ? gB : rya + rha + gap / 2 : rya <= top ? gT : rya - gap / 2;
        const yi = ay > by ? ryb <= top ? gT : ryb - gap / 2 : ryb + rhb >= bot ? gB : ryb + rhb + gap / 2;
        const xg = rxb < rxa ? rxb + rwb + gap / 2 : rxb - gap / 2;
        const axc = rxa + rwa / 2, bxc = rxb + rwb / 2;
        path = [[ax, ay], [axc, yo], [xg, yo], [xg, yi], [bxc, yi], [bx, by]];
      }
      paths.push(path);
    }
    // 2.0.83: линии не накладываются — совпадающие по направлению и месту отрезки разводим параллельно
    if (!curvy) {
      const segs = [], d = Math.max(4, ctx.lineWidth * 1.9);
      paths.forEach((P, pi) => {
        for (let k = 1; k < P.length; k++) {
          const [x1, y1] = P[k - 1], [x2, y2] = P[k], hz = Math.abs(y1 - y2) < 0.5, vt = Math.abs(x1 - x2) < 0.5;
          if (!hz && !vt) continue;
          const mov = P.length === 2 || k > 1 && k < P.length - 1;
          segs.push({ pi, k, hz, c: Math.round(hz ? y1 : x1), lo: Math.min(hz ? x1 : y1, hz ? x2 : y2), hi: Math.max(hz ? x1 : y1, hz ? x2 : y2), mov });
        }
      });
      const groups = new Map();
      for (const sg of segs) {
        const key2 = (sg.hz ? "h" : "v") + sg.c;
        if (!groups.has(key2)) groups.set(key2, []);
        groups.get(key2).push(sg);
      }
      const offs = [];
      for (const list of groups.values()) {
        if (list.length < 2) continue;
        list.sort((a2, b2) => b2.mov - a2.mov === 0 ? a2.lo - b2.lo : a2.mov - b2.mov);
        const lanes = [];
        for (const sg of list) {
          let lane = 0;
          for (; ; lane++) if (!(lanes[lane] || []).some((o) => o.lo < sg.hi - 1 && sg.lo < o.hi - 1)) break;
          if (lane && !sg.mov) lane = 0;
          (lanes[lane] = lanes[lane] || []).push(sg);
          if (lane) offs.push({ sg, off: (lane % 2 ? 1 : -1) * Math.ceil(lane / 2) * d });
        }
      }
      for (const { sg, off } of offs) {
        const P = paths[sg.pi], ax2 = sg.hz ? 1 : 0;
        P[sg.k - 1] = P[sg.k - 1].slice();
        P[sg.k] = P[sg.k].slice();
        P[sg.k - 1][ax2] += off;
        P[sg.k][ax2] += off;
        // соседние отрезки остаются прямыми: их общие точки сдвинулись вместе с этим отрезком
      }
    }
    // 2.0.84: рисуем каждую связь с тёмной обводкой — линии не сливаются с сеткой, номерами и друг с другом
    const bez = (P0, P1, P2, P3, t) => {
      const m = 1 - t;
      return [m * m * m * P0[0] + 3 * m * m * t * P1[0] + 3 * m * t * t * P2[0] + t * t * t * P3[0], m * m * m * P0[1] + 3 * m * m * t * P1[1] + 3 * m * t * t * P2[1] + t * t * t * P3[1]];
    };
    const cw0 = Math.min(L2.cw, L2.cd);
    paths.forEach((path, pi) => {
      const col2 = linkCol(pi + 1);
      const stroke = (draw) => {
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "rgba(0,0,0,0.8)";
        ctx.lineWidth = HALO;
        ctx.beginPath();
        draw();
        ctx.stroke();
        ctx.strokeStyle = col2;
        ctx.lineWidth = LW;
        ctx.beginPath();
        draw();
        ctx.stroke();
        ctx.restore();
      };
      ctx.fillStyle = col2;
      if (curvy) {
        // дуга: соседние связи выгибаются в разные стороны; далёкие — выгиб ограничен, чтобы не уходить за схему
        const [p0, p3] = path, dx = p3[0] - p0[0], dy = p3[1] - p0[1], Ln = Math.hypot(dx, dy) || 1, nx = -dy / Ln, ny = dx / Ln;
        const bend = Math.min(Ln * 0.3, cw0 * 0.22 + Ln * 0.1) * (pi % 2 ? -1 : 1);
        const p1 = [p0[0] + dx * 0.25 + nx * bend, p0[1] + dy * 0.25 + ny * bend], p2 = [p0[0] + dx * 0.75 + nx * bend, p0[1] + dy * 0.75 + ny * bend];
        stroke(() => {
          ctx.moveTo(p0[0], p0[1]);
          ctx.bezierCurveTo(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]);
        });
        const m1 = bez(p0, p1, p2, p3, 0.5), m2 = bez(p0, p1, p2, p3, 0.52);
        arrowAt(m1[0], m1[1], Math.atan2(m2[1] - m1[1], m2[0] - m1[0]));
        return;
      }
      const r = lineStyle === "round" ? Math.max(6, Math.min(gap * 0.9, 26 * u)) : 0;
      stroke(() => {
        ctx.moveTo(path[0][0], path[0][1]);
        for (let k = 1; k < path.length - 1; k++) r ? ctx.arcTo(path[k][0], path[k][1], path[k + 1][0], path[k + 1][1], r) : ctx.lineTo(path[k][0], path[k][1]);
        ctx.lineTo(path[path.length - 1][0], path[path.length - 1][1]);
      });
      // стрелка: на прямом — посередине, на обходе — на самом длинном отрезке и у входа
      let best = 1, bl = 0;
      for (let k = 1; k < path.length; k++) {
        const d = Math.hypot(path[k][0] - path[k - 1][0], path[k][1] - path[k - 1][1]);
        if (d > bl) bl = d, best = k;
      }
      const [qx, qy] = path[best - 1], [rx, ry] = path[best];
      arrowAt((qx + rx) / 2, (qy + ry) / 2, Math.atan2(ry - qy, rx - qx));
      if (path.length > 2) {
        const [px1, py1] = path[path.length - 2], [px2, py2] = path[path.length - 1];
        arrowAt(px1 + (px2 - px1) * 0.55, py1 + (py2 - py1) * 0.55, Math.atan2(py2 - py1, px2 - px1));
      }
    });
    ctx.fillStyle = linkCol(1);
    ctx.strokeStyle = "rgba(0,0,0,0.85)";
    ctx.lineWidth = Math.max(2, 3 * u);
    ctx.beginPath();
    ctx.arc(pts[0][0], pts[0][1], ah * 0.75, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.lineCap = "butt";
  }
  for (const f of labelsLater) f();
  // подпись внизу
  ctx.font = "".concat(Math.round(Math.max(10, 17 * u)), "px ").concat(FONT);
  ctx.fillStyle = "#9aa1ad";
  ctx.fillText("Кабинетов ".concat(g.cabs.length).concat(g.cabs.length !== V.cx * V.cz ? " из " + V.cx * V.cz : "", " · ").concat(volSize(V), " · IP ").concat(g.cabs.length ? g.cabs[0].ip : "—").concat(g.cabs.length > 1 ? " … " + g.cabs[g.cabs.length - 1].ip : "", " · ").concat(g.uniPerCab, " universe на кабинет · Art-Net 6454, Net 0, Subnet 0"), W / 2, H - L2.m * 0.5);
  ctx.restore();
  return L2;
}
function volComDraw() {
  if (typeof syncZoomLabel === "function") syncZoomLabel();
  const cv = document.getElementById("volCom");
  if (!cv) return;
  const st = S(), on = ui.page === "mask" && st.kind === "vol" && st.vol && st.vol.view === "com";
  cv.hidden = !on;
  if (!on) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1), cw = cv.clientWidth, ch = cv.clientHeight;
  if (!cw || !ch) return;
  if (cv.width !== Math.round(cw * dpr) || cv.height !== Math.round(ch * dpr)) {
    cv.width = Math.round(cw * dpr);
    cv.height = Math.round(ch * dpr);
  }
  const c = cv.getContext("2d");
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  // справа внизу — окно 3D: схему рисуем левее, чтобы оно не закрывало кабинеты
  // 2.0.71: ширину окна 3D берём и пока оно ещё скрыто (первая отрисовка), иначе схема залезала под него
  const v3 = document.getElementById("vol3dBox"), r3 = st.vol.show3d !== false && v3 && !v3.classList.contains("big") ? (v3.offsetWidth || 380) + 24 : 0;
  c.fillStyle = "#101318";
  c.fillRect(0, 0, cw, ch);
  // 2.0.142: зум и сдвиг окна коммутации (колесо / тачпад), как в мэппинге и ТЗ
  const vv = ui.volView, W = Math.max(200, cw - (cw - r3 > 420 ? r3 : 0));
  ui.volComView = { cw, ch, W };
  c.save();
  c.translate(vv.x, vv.y);
  c.scale(vv.z, vv.z);
  ui.volComL = volComPaint(c, st, W, ch);
  c.restore();
}
// 2.0.142: точка щелчка в координатах схемы (с учётом зума / сдвига окна)
const volComPt = (cv, e) => {
  const r = cv.getBoundingClientRect(), vv = ui.volView;
  return [(e.clientX - r.left - vv.x) / vv.z, (e.clientY - r.top - vv.y) / vv.z];
};
function volComInit() {
  const cv = document.getElementById("volCom");
  if (!cv) return;
  // 2.0.142: зум окна коммутации к курсору (колесо / тачпад), сдвиг — Alt / средняя или правая кнопка, Esc / двойной щелчок — сброс
  let pan = null;
  cv.addEventListener("wheel", (e) => {
    e.preventDefault();
    const vv = ui.volView, r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
    const z = Math.max(1, Math.min(12, vv.z * Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0018))));
    const ux = (px - vv.x) / vv.z, uy = (py - vv.y) / vv.z;
    vv.z = z;
    vv.x = px - ux * z;
    vv.y = py - uy * z;
    if (z === 1) vv.x = vv.y = 0;
    volComDraw();
  }, { passive: false });
  cv.addEventListener("pointermove", (e) => {
    if (!pan) return;
    ui.volView.x = pan.x0 + (e.clientX - pan.px);
    ui.volView.y = pan.y0 + (e.clientY - pan.py);
    volComDraw();
  });
  const endPan = () => {
    pan = null;
  };
  cv.addEventListener("pointerup", endPan);
  cv.addEventListener("pointercancel", endPan);
  cv.addEventListener("contextmenu", (e) => e.preventDefault());
  cv.addEventListener("dblclick", () => {
    Object.assign(ui.volView, { z: 1, x: 0, y: 0 });
    volComDraw();
  });
  cv.addEventListener("pointerdown", (e) => {
    const st = S(), V = st.vol, L2 = ui.volComL;
    if (!L2) return;
    // сдвиг окна: средняя / правая кнопка, или Alt при zoom > 1 (Alt без зума — гашение кабинета)
    if (e.button === 1 || e.button === 2 || (e.altKey && ui.volView.z > 1 && !ui.volBlank && ui.tool !== "black" && !ui.volPick)) {
      pan = { px: e.clientX, py: e.clientY, x0: ui.volView.x, y0: ui.volView.y };
      try {
        cv.setPointerCapture(e.pointerId);
      } catch (err) {
      }
      return;
    }
    if (!ui.volPick) {
      // гашение кабинета: кнопка «Гашение» над холстом, «Гасить кабинеты» в разделе или Alt + щелчок
      if (!(ui.volBlank || ui.tool === "black" || e.altKey)) return;
      const [x, y] = volComPt(cv, e);
      for (let cz = 0; cz < V.cz; cz++) for (let cx = 0; cx < V.cx; cx++) {
        const [rx, ry, rw, rh] = L2.rect(cx, cz);
        if (x >= rx && x <= rx + rw && y >= ry && y <= ry + rh) {
          const k = cx + "," + cz, i = V.off.indexOf(k);
          if (i >= 0) V.off.splice(i, 1);
          else if (V.cx * V.cz - V.off.length > 1) V.off.push(k);
          if (V.manual) {
            V.manual = V.manual.filter((m) => V.off.indexOf(m) < 0);
            if (i >= 0) V.manual.push(k);
          }
          status(i >= 0 ? "Кабинет включён" : "Кабинет погашен");
          syncVolUI();
          changed({ forcePhys: true });
          return;
        }
      }
      return;
    }
    const [x, y] = volComPt(cv, e);
    for (let cz = 0; cz < V.cz; cz++) for (let cx = 0; cx < V.cx; cx++) {
      const [rx, ry, rw, rh] = L2.rect(cx, cz);
      if (x >= rx && x <= rx + rw && y >= ry && y <= ry + rh) {
        const k = cx + "," + cz, list = ui.volPickList || (ui.volPickList = []);
        if (!volOn(V, cx, cz)) return;
        if (list.indexOf(k) < 0) list.push(k);
        if (list.length === V.cx * V.cz - V.off.length) {
          V.manual = list.slice();
          ui.volPick = false;
          ui.volPickList = null;
          status("Порядок коммутации задан вручную", true);
          syncVolUI();
          changed({ forcePhys: true });
        } else status("Кабинет ".concat(list.length, " из ").concat(V.cx * V.cz - V.off.length, " — щёлкните следующий"));
        volComDraw();
        return;
      }
    }
  });
}
function vol3dInit() {
  const cv = document.getElementById("vol3d");
  if (!cv) return;
  document.querySelectorAll("#vol3dBar button").forEach((b) => b.onclick = (e) => {
    e.stopPropagation();
    const v = b.dataset.v3, box = document.getElementById("vol3dBox");
    if (v === "big") {
      box.classList.toggle("big");
      b.textContent = box.classList.contains("big") ? "⤡" : "⤢";
      b.title = box.classList.contains("big") ? "Уменьшить окно" : "Крупно";
    } else Object.assign(vol3d, { yaw: VOL3D_VIEWS[v][0], pitch: VOL3D_VIEWS[v][1], zoom: 1 });
    vol3dDraw(true);
  });
  let drag = null;
  cv.addEventListener("pointerdown", (e) => {
    drag = { x: e.clientX, y: e.clientY, yaw: vol3d.yaw, pitch: vol3d.pitch };
    try {
      cv.setPointerCapture(e.pointerId);
    } catch (err) {
    }
    e.preventDefault();
    e.stopPropagation();
  });
  cv.addEventListener("pointermove", (e) => {
    if (!drag) return;
    vol3d.yaw = drag.yaw + (e.clientX - drag.x) * 0.01;
    vol3d.pitch = Math.max(-1.45, Math.min(1.45, drag.pitch + (e.clientY - drag.y) * 0.01));
    vol3dDraw();
    e.stopPropagation();
  });
  const end = (e) => {
    drag = null;
    e.stopPropagation();
  };
  cv.addEventListener("pointerup", end);
  cv.addEventListener("pointercancel", end);
  cv.addEventListener("wheel", (e) => {
    // 2.0.141: плавный зум — мышь и тачпад (величина прокрутки учитывается, пинч = ctrlKey)
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
    vol3d.zoom = Math.max(0.3, Math.min(8, vol3d.zoom * Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0018))));
    vol3dDraw();
    e.preventDefault();
    e.stopPropagation();
  }, { passive: false });
  cv.addEventListener("dblclick", (e) => {
    Object.assign(vol3d, { yaw: -0.6, pitch: 0.42, zoom: 1 });
    vol3dDraw();
    e.stopPropagation();
  });
}

function drawPlateTitle(ctx, st, s, W, H, invert, noPlate) {
  const lines = titleLines(st, s), b = blockSize(lines, TITLE_GAP * s), tx = W * s / 2 + (st.titleOffsetX || 0) * s, ty = H * s / 2 - (st.titleOffsetY || 0) * s;
  if (!noPlate) {
    ctx.fillStyle = invert ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.6)";
    const a = -titleRot(st) * Math.PI / 180;
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(a);
    ctx.fillRect(-b.w / 2 - 14 * s, -b.h / 2 - 8 * s, b.w + 28 * s, b.h + 16 * s);
    ctx.restore();
  }
  ctx.save();
  if (noPlate) {
    ctx.shadowColor = "rgba(0,0,0,0.75)";
    ctx.shadowBlur = Math.max(1, (lines[0] ? lines[0][1] : 10 * s) * 0.05);
  }
  const defC = invert ? "#000" : "#fff";
  ctx.fillStyle = st.titleColor || defC;
  drawBlock(ctx, lines, TITLE_GAP * s, tx, ty, titleRot(st));
  // 2.0.96: дополнительные тексты — тем же цветом и с той же тенью, что основной (раньше в ТВ выходили чёрными)
  for (const it of st.extraLabels || []) {
    const fs2 = Math.min(900, Math.max(6, +it.size || 120)) * s;
    if (noPlate) ctx.shadowBlur = Math.max(1, fs2 * 0.05);
    ctx.fillStyle = it.color || defC;
    drawBlock(ctx, [[it.text || "Текст", fs2]], 0, W * s / 2 + (+it.x || 0) * s, H * s / 2 - (+it.y || 0) * s, +it.rotation || 0);
  }
  ctx.restore();
}
function drawTV(ctx, st, s, guides) {
  const g = tvGeom(st), T = g.T, X = (v) => v * s, Wp = Math.max(1, Math.round(g.W * s)), Hp = Math.max(1, Math.round(g.H * s)), lw = (px) => Math.max(1, px * s);
  ctx.save();
  ctx.fillStyle = "#1c1c1c";
  ctx.fillRect(0, 0, Wp, Hp);
  for (const r of g.rects) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(X(r.x), X(r.y), X(r.w), X(r.h));
    ctx.clip();
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2, m = Math.min(r.w, r.h);
    if (T.grid !== false) {
      const step = m / 9;
      ctx.strokeStyle = "#5a5a5a";
      ctx.lineWidth = lw(1);
      ctx.beginPath();
      for (let x = cx % step; x <= r.w; x += step) {
        ctx.moveTo(Math.round(X(r.x + x)) + 0.5, X(r.y));
        ctx.lineTo(Math.round(X(r.x + x)) + 0.5, X(r.y + r.h));
      }
      for (let y = cy % step; y <= r.h; y += step) {
        ctx.moveTo(X(r.x), Math.round(X(r.y + y)) + 0.5);
        ctx.lineTo(X(r.x + r.w), Math.round(X(r.y + y)) + 0.5);
      }
      ctx.stroke();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = lw(3);
      ctx.beginPath();
      ctx.arc(X(cx), X(cy), X(m * 0.45), 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = lw(2);
      ctx.beginPath();
      ctx.moveTo(X(cx - m * 0.06), X(cy));
      ctx.lineTo(X(cx + m * 0.06), X(cy));
      ctx.moveTo(X(cx), X(cy - m * 0.06));
      ctx.lineTo(X(cx), X(cy + m * 0.06));
      ctx.stroke();
      ctx.lineWidth = lw(2);
      for (const [ax, ay] of [[0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9]]) {
        ctx.beginPath();
        ctx.arc(X(r.x + r.w * ax), X(r.y + r.h * ay), X(m * 0.07), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    if (T.bars !== false) {
      const bw = r.w * 0.6, bx = r.x + (r.w - bw) / 2, by = r.y + r.h * 0.22, bh = r.h * 0.14, cols = ["#BFBFBF", "#BFBF00", "#00BFBF", "#00BF00", "#BF00BF", "#BF0000", "#0000BF"];
      cols.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.fillRect(X(bx + bw * i / 7), X(by), X(bw / 7) + 1, X(bh));
      });
      const gy = r.y + r.h * 0.68, gh = r.h * 0.08;
      for (let i = 0; i < 11; i++) {
        const v = Math.round(255 * i / 10);
        ctx.fillStyle = "rgb(".concat(v, ",").concat(v, ",").concat(v, ")");
        ctx.fillRect(X(bx + bw * i / 11), X(gy), X(bw / 11) + 1, X(gh));
      }
      const grd = ctx.createLinearGradient(X(bx), 0, X(bx + bw), 0);
      grd.addColorStop(0, "#000");
      grd.addColorStop(1, "#fff");
      ctx.fillStyle = grd;
      ctx.fillRect(X(bx), X(gy + gh), X(bw), X(gh * 0.45));
    }
    if (T.safe !== false) {
      ctx.setLineDash([lw(10), lw(8)]);
      ctx.lineWidth = lw(2);
      ctx.strokeStyle = "#FFCC00";
      ctx.strokeRect(X(r.x + r.w * 0.05), X(r.y + r.h * 0.05), X(r.w * 0.9), X(r.h * 0.9));
      ctx.strokeStyle = "#FF3B30";
      ctx.strokeRect(X(r.x + r.w * 0.1), X(r.y + r.h * 0.1), X(r.w * 0.8), X(r.h * 0.8));
      ctx.setLineDash([]);
    }
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = lw(2);
    ctx.strokeRect(X(r.x) + lw(1), X(r.y) + lw(1), X(r.w) - lw(2), X(r.h) - lw(2));
    ctx.fillStyle = "#ffffff";
    const a = m * 0.03;
    for (const [px, py, dx, dy] of [[cx, r.y, 0, 1], [cx, r.y + r.h, 0, -1], [r.x, cy, 1, 0], [r.x + r.w, cy, -1, 0]]) {
      ctx.beginPath();
      ctx.moveTo(X(px), X(py));
      ctx.lineTo(X(px + dx * a * 1.5 - dy * a), X(py + dy * a * 1.5 - dx * a));
      ctx.lineTo(X(px + dx * a * 1.5 + dy * a), X(py + dy * a * 1.5 + dx * a));
      ctx.closePath();
      ctx.fill();
    }
    if (T.corner === true) {
      // 2.0.47: подпись панели в углу (TV · разрешение · диагональ) — галочкой в «Данных»
      const fs = Math.max(6, m * 0.045 * s), lab = "".concat((T.label || "TV").trim() || "TV", " ").concat(g.rects.length > 1 ? r.n : "").trim(), sub = "".concat(r.w, "×").concat(r.h).concat(T.diag > 0 ? " · ".concat(T.diag, "″") : "").concat(g.rects.length > 1 ? " · X ".concat(r.x, " · Y ").concat(r.y) : "");
      ctx.textBaseline = "top";
      ctx.font = "bold ".concat(fs, "px ").concat(FONT);
      const w1 = ctx.measureText(lab).width;
      ctx.font = "".concat(fs * 0.55, "px ").concat(FONT);
      const w2 = ctx.measureText(sub).width;
      const lx = X(r.x + r.w * 0.06) + fs * 0.4, ly = X(r.y + r.h * 0.065);
      ctx.shadowColor = "rgba(0,0,0,0.9)";
      ctx.shadowBlur = Math.max(1, fs * 0.08);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold ".concat(fs, "px ").concat(FONT);
      ctx.fillText(lab, lx, ly);
      ctx.font = "".concat(fs * 0.55, "px ").concat(FONT);
      ctx.fillText(sub, lx, ly + fs * 1.12);
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }
  if (guides.circle || guides.diag) {
    ctx.beginPath();
    if (guides.diag) {
      ctx.moveTo(0, 0);
      ctx.lineTo(Wp, Hp);
      ctx.moveTo(0, Hp);
      ctx.lineTo(Wp, 0);
    }
    if (guides.circle) {
      const d = Math.min(Wp, Hp);
      ctx.moveTo(Wp / 2 + d / 2, Hp / 2);
      ctx.arc(Wp / 2, Hp / 2, d / 2, 0, Math.PI * 2);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = Math.max(1, 2 * s);
    ctx.stroke();
  }
  drawPlateTitle(ctx, st, s, g.W, g.H, false, true);
  drawInfo(ctx, st, s); // 2.0.46: «Информация о маске» и у ТВ-панелей
  ctx.restore();
}
function drawPix(ctx, st, s, guides) {
  const g = pixGeom(st), X = g.X, Wp = Math.max(1, Math.round(g.W * s)), Hp = Math.max(1, Math.round(g.H * s)), f = (v) => Math.round(v * s);
  ctx.save();
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, Wp, Hp);
  for (let c = 0; c < g.cols; c++) for (let r = 0; r < g.rows; r++) {
    const [x, y, w, h] = g.rect(c, r);
    ctx.fillStyle = pixColor(c, X.shade !== false && g.rows > 1 ? r % 2 ? 38 : 50 : 46);
    ctx.fillRect(f(x), f(y), Math.max(1, f(x + w) - f(x)), Math.max(1, f(y + h) - f(y)));
  }
  if (X.nums !== false) {
    const [, , w0, h0] = g.rect(0, 0);
    let fs = Math.min(h0 * 0.2, 120) * s;
    ctx.font = "bold ".concat(fs, "px ").concat(FONT);
    const wide = ctx.measureText(String(g.cols)).width, maxW = w0 * s * 0.9;
    if (wide > maxW) fs *= maxW / wide;
    if (fs >= 4) {
      ctx.font = "bold ".concat(fs, "px ").concat(FONT);
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (let c = 0; c < g.cols; c++) for (let r = 0; r < g.rows; r++) {
        const [x, y, w, h] = g.rect(c, r);
        ctx.fillText(String(c + 1), (x + w / 2) * s, (y + Math.min(h * 0.03, 6)) * s);
      }
      ctx.textAlign = "left";
    }
  }
  drawPlateTitle(ctx, st, s, g.W, g.H, false, true);
  ctx.restore();
}
function ratioOf(a, b) {
  if (!(a > 0 && b > 0)) return [16, 9];
  const x = a / b;
  for (let q = 1; q <= 20; q++) {
    const pp = Math.round(x * q);
    if (pp >= 1 && Math.abs(pp / q - x) < 4e-3 * x) return [pp, q];
  }
  return [+x.toFixed(3), 1];
}
function projGeom(st) {
  const P0 = st.proj || defProj();
  if (P0.mode === "dome") {
    const D = Math.max(256, Math.min(16384, P0.dome | 0 || 4096));
    return { P: P0, dome: true, rot: 0, pw: D, ph: D, nx: 1, ny: 1, ovx: 0, ovy: 0, W: D, H: D, rects: [] };
  }
  const P = P0, rot = +P.rot || 0, pw0 = Math.max(16, P.pw | 0), ph0 = Math.max(16, P.ph | 0);
  const pw = rot ? ph0 : pw0, ph = rot ? pw0 : ph0, nx = Math.max(1, P.nx | 0), ny = Math.max(1, P.ny | 0);
  let ovx = nx > 1 ? Math.round(pw * Math.max(0, Math.min(50, +P.ox || 0)) / 100) : 0, ovy = ny > 1 ? Math.round(ph * Math.max(0, Math.min(50, +P.oy || 0)) / 100) : 0;
  let W = nx * pw - (nx - 1) * ovx, H = ny * ph - (ny - 1) * ovy, offX = 0, offY = 0, canvas = false;
  if (+P.cw > 0 && +P.ch > 0) {
    canvas = true;
    const A = +P.cw / +P.ch, cl = (v, max) => Math.max(0, Math.min(Math.floor(max / 2), Math.round(v)));
    if (nx === 1 && ny === 1) {
      const k = Math.min(pw / P.cw, ph / P.ch);
      W = Math.round(P.cw * k);
      H = Math.round(P.ch * k);
    } else if (nx > 1) {
      W = nx * pw - (nx - 1) * ovx;
      H = Math.round(W / A);
      if (ny > 1) {
        ovy = cl((ny * ph - H) / (ny - 1), ph);
        const Hmax = ny * ph - (ny - 1) * ovy;
        if (H > Hmax) {
          H = Hmax;
          W = Math.round(H * A);
        }
      } else if (H > ph) {
        H = ph;
        W = Math.round(ph * A);
        ovx = cl((nx * pw - W) / (nx - 1), pw);
      }
    } else {
      H = ny * ph - (ny - 1) * ovy;
      W = Math.round(H * A);
      if (W > pw) {
        W = pw;
        H = Math.round(pw / A);
        ovy = cl((ny * ph - H) / (ny - 1), ph);
      }
    }
    const ev = (v) => 2 * Math.round(v / 2);
    W = Math.max(16, ev(W));
    H = Math.max(16, ev(H));
    if (ovx) ovx = ev(ovx);
    if (ovy) ovy = ev(ovy);
    offX = Math.round((nx * pw - (nx - 1) * ovx - W) / 2);
    offY = Math.round((ny * ph - (ny - 1) * ovy - H) / 2);
  }
  const rects = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) rects.push({ n: j * nx + i + 1, x: i * (pw - ovx) - offX, y: j * (ph - ovy) - offY, w: pw, h: ph });
  return { P, rot, pw, ph, nx, ny, ovx, ovy, W, H, rects, offX, offY, canvas };
}
function drawDome(ctx, st, s, guides, g) {
  const P = g.P, D = g.W, Dp = Math.max(1, Math.round(D * s)), c = Dp / 2;
  const bg = P.invert ? "#FFFFFF" : P.bg || "#101010", fg = P.invert ? "#000000" : P.line || "#FFFFFF", tc = P.invert ? "#000000" : P.text || "#FFFFFF";
  const ACC = P.invert ? "#8E2BD9" : "#B45CFF", RED = "#FF3B30", k = D / 2048, lw = (px) => Math.max(1, px * k * s);
  const fov = Math.max(60, Math.min(360, +P.fov || 180)), half = fov / 2, az = Math.max(1, Math.min(90, +P.az || 10)), el = Math.max(1, Math.min(45, +P.el || 10));
  const R = Dp / 2 - lw(2), rOf = (t) => R * t / half;
  const pt = (a, r) => [c + r * Math.sin(a * Math.PI / 180), c - r * Math.cos(a * Math.PI / 180)];
  ctx.save();
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, Dp, Dp);
  ctx.save();
  ctx.beginPath();
  ctx.arc(c, c, R, 0, Math.PI * 2);
  ctx.clip();
  const ring = (t, col2, w, al) => {
    ctx.strokeStyle = col2;
    ctx.lineWidth = w;
    ctx.globalAlpha = al;
    ctx.beginPath();
    ctx.arc(c, c, rOf(t), 0, Math.PI * 2);
    ctx.stroke();
  };
  const spoke = (a, r0, col2, w, al) => {
    const [x0, y0] = pt(a, r0), [x1, y1] = pt(a, R);
    ctx.strokeStyle = col2;
    ctx.lineWidth = w;
    ctx.globalAlpha = al;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  };
  if (P.dminor !== false) {
    for (let t = el / 2; t < half + 1e-6; t += el) ring(t, fg, lw(1), 0.28);
    for (let a = az / 2; a < 360; a += az) spoke(a, rOf(Math.min(half, el * 2)), fg, lw(1), 0.28);
  }
  for (let t = el; t < half + 1e-6; t += el) ring(t, fg, lw(2), 0.7);
  for (let a = 0; a < 360; a += az) spoke(a, a % 30 === 0 ? 0 : rOf(Math.min(half, el)), fg, lw(2), 0.7);
  for (let e = 60; 90 - e <= half + 1e-6; e -= 30) ring(90 - e, ACC, lw(4), 1);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = RED;
  ctx.lineWidth = lw(3);
  ctx.beginPath();
  ctx.moveTo(c, c - R);
  ctx.lineTo(c, c + R);
  ctx.moveTo(c - R, c);
  ctx.lineTo(c + R, c);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(c, c, Math.max(3, R * 0.012), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = ACC;
  ctx.lineWidth = lw(5);
  ctx.beginPath();
  ctx.arc(c, c, R, 0, Math.PI * 2);
  ctx.stroke();
  const fs = Math.max(6, 30 * k * s), tang = (txt, a, r, col2, font) => {
    const [x, y] = pt(a, r);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a * Math.PI / 180);
    ctx.fillStyle = col2;
    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(txt, 0, 0);
    ctx.restore();
  };
  if (P.dlabels !== false) {
    const stepL = 2 * Math.PI * R * az / 360 < fs * 3.2 ? az * Math.ceil(fs * 3.2 / (2 * Math.PI * R * az / 360)) : az;
    for (let a = 0; a < 360; a += stepL) tang("".concat(a, "°"), a, R - fs * 1.1, tc, "bold ".concat(fs, "px ").concat(FONT));
    ctx.fillStyle = tc;
    ctx.font = "".concat(fs * 0.8, "px ").concat(FONT);
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    for (let t = el; t < half - el * 0.3; t += el) {
      if (rOf(el) < fs * 1.1 && Math.round(t / el) % 2) continue;
      {
        const [x, y] = pt(az * Math.round(45 / az) || 45, rOf(t));
        ctx.fillText("".concat(+(90 - t).toFixed(1), "°"), x + fs * 0.25, y - fs * 0.1);
      }
    }
  }
  if (P.dsides !== false) {
    const f2 = "bold ".concat(fs * 1.25, "px ").concat(FONT), r2 = R - fs * (P.dlabels !== false ? 3 : 1.4);
    [["BACK", 0], ["RIGHT", 90], ["FRONT", 180], ["LEFT", 270]].forEach(([t, a]) => tang(t, a, r2, RED, f2));
  }
  if (guides.circle || guides.diag) {
    ctx.beginPath();
    if (guides.diag) {
      ctx.moveTo(0, 0);
      ctx.lineTo(Dp, Dp);
      ctx.moveTo(0, Dp);
      ctx.lineTo(Dp, 0);
    }
    if (guides.circle) {
      ctx.moveTo(Dp, c);
      ctx.arc(c, c, Dp / 2, 0, Math.PI * 2);
    }
    ctx.strokeStyle = P.invert ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.5)";
    ctx.lineWidth = Math.max(1, 2 * s);
    ctx.stroke();
  }
  // 2.0.80: подложка и каше-фигуры и в режиме купола
  if (REF_ON_CANVAS) drawRefImage(ctx, st, s);
  drawCachePx(ctx, st, s, Dp, Dp);
  const lines = titleLines(st, s), b = blockSize(lines, TITLE_GAP * s), tx = c + (st.titleOffsetX || 0) * s, ty = Dp * 0.62 - (st.titleOffsetY || 0) * s;
  void b; // 2.0.76: под текстом проекции больше нет чёрного прямоугольника
  ctx.fillStyle = st.titleColor || tc;
  drawBlock(ctx, lines, TITLE_GAP * s, tx, ty, titleRot(st));
  if (P.bar) {
    const bw = D * 0.36, bh = D * 0.03, bx = (D - bw) / 2, by = Math.max(D * 0.7, (ty + b.h / 2 + 24 * s) / s), X = (v) => v * s, cols = ["#FFFFFF", "#FFFF00", "#00FFFF", "#00FF00", "#FF00FF", "#FF0000", "#0000FF", "#000000"];
    cols.forEach((cl, i) => {
      ctx.fillStyle = cl;
      ctx.fillRect(X(bx + bw * i / cols.length), X(by), X(bw / cols.length) + 1, X(bh));
    });
    for (let i = 0; i < 11; i++) {
      const v = Math.round(255 * i / 10);
      ctx.fillStyle = "rgb(".concat(v, ",").concat(v, ",").concat(v, ")");
      ctx.fillRect(X(bx + bw * i / 11), X(by + bh), X(bw / 11) + 1, X(bh * 0.5));
    }
    ctx.strokeStyle = fg;
    ctx.lineWidth = lw(1);
    ctx.strokeRect(X(bx), X(by), X(bw), X(bh * 1.5));
  }
  for (const it of st.extraLabels || []) {
    const fs2 = Math.min(900, Math.max(6, +it.size || 120)) * s;
    ctx.fillStyle = it.color || tc; // 2.0.96/2.0.97: доп. текст купола — своим цветом или цветом текста
    drawBlock(ctx, [[it.text || "Текст", fs2]], 0, c + (+it.x || 0) * s, c - (+it.y || 0) * s, +it.rotation || 0);
  }
  drawInfo(ctx, st, s);
  ctx.restore();
}
function drawProj(ctx, st, s, guides) {
  const g = projGeom(st);
  if (g.dome) return drawDome(ctx, st, s, guides, g);
  const P = g.P, W = g.W, H = g.H, Wp = Math.max(1, Math.round(W * s)), Hp = Math.max(1, Math.round(H * s));
  const bg = P.invert ? "#FFFFFF" : P.bg || "#101010", fg = P.invert ? "#000000" : P.line || "#FFFFFF";
  const tc = P.invert ? "#000000" : P.text || "#FFFFFF";
  const X = (v) => v * s, lw = (px) => Math.max(1, px * s);
  ctx.save();
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, Wp, Hp);
  if (P.hatch) {
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = fg;
    ctx.lineWidth = lw(1);
    ctx.beginPath();
    const step = Math.max(6, 24 * s);
    for (let d = -Hp; d < Wp; d += step) {
      ctx.moveTo(d, Hp);
      ctx.lineTo(d + Hp, 0);
    }
    ctx.stroke();
    ctx.restore();
  }
  if (P.zones && (g.ovx || g.ovy)) {
    ctx.save();
    ctx.fillStyle = "#FFD60A";
    ctx.globalAlpha = 0.17;
    for (let i = 1; i < g.nx; i++) ctx.fillRect(X(i * (g.pw - g.ovx) - g.offX), 0, X(g.ovx), Hp);
    for (let j = 1; j < g.ny; j++) ctx.fillRect(0, X(j * (g.ph - g.ovy) - g.offY), Wp, X(g.ovy));
    ctx.restore();
  }
  const gs = Math.max(8, P.grid | 0), cx = W / 2, cy = H / 2;
  ctx.save();
  ctx.strokeStyle = fg;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = lw(1);
  ctx.beginPath();
  const xsG = [], ysG = [];
  for (let x = cx % gs; x <= W; x += gs) xsG.push(x);
  for (let y = cy % gs; y <= H; y += gs) ysG.push(y);
  for (const x of xsG) {
    ctx.moveTo(Math.round(X(x)) + 0.5, 0);
    ctx.lineTo(Math.round(X(x)) + 0.5, Hp);
  }
  for (const y of ysG) {
    ctx.moveTo(0, Math.round(X(y)) + 0.5);
    ctx.lineTo(Wp, Math.round(X(y)) + 0.5);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.lineWidth = lw(3);
  ctx.beginPath();
  ctx.moveTo(X(cx), 0);
  ctx.lineTo(X(cx), Hp);
  ctx.moveTo(0, X(cy));
  ctx.lineTo(Wp, X(cy));
  ctx.stroke();
  ctx.restore();
  if (P.cells) {
    const edges = [0, ...xsG.filter((x) => x > 0 && x < W), W], rowsE = [0, ...ysG.filter((y) => y > 0 && y < H), H];
    const fs = Math.max(5, Math.min(gs * 0.16, 28) * s);
    if (fs >= 5) {
      ctx.save();
      ctx.fillStyle = tc;
      ctx.globalAlpha = 0.6;
      ctx.font = "".concat(fs, "px ").concat(FONT);
      ctx.textBaseline = "top";
      const col2 = (i) => {
        let t = "";
        i++;
        while (i > 0) {
          const m = (i - 1) % 26;
          t = String.fromCharCode(65 + m) + t;
          i = Math.floor((i - 1) / 26);
        }
        return t;
      };
      for (let r = 0; r < rowsE.length - 1; r++) for (let c = 0; c < edges.length - 1; c++) {
        if ((edges[c + 1] - edges[c]) * s < fs * 2.2 || (rowsE[r + 1] - rowsE[r]) * s < fs * 1.4) continue;
        ctx.fillText(col2(c) + (r + 1), X(edges[c]) + fs * 0.3, X(rowsE[r]) + fs * 0.25);
      }
      ctx.restore();
    }
  }
  if (P.circles) {
    ctx.save();
    ctx.lineWidth = lw(3);
    for (const r of g.rects) {
      ctx.strokeStyle = g.rects.length > 1 ? PJ_COLORS[(r.n - 1) % PJ_COLORS.length] : fg;
      ctx.beginPath();
      ctx.arc(X(r.x + r.w / 2), X(r.y + r.h / 2), X(Math.min(r.w, r.h) / 2 - 2), 0, Math.PI * 2);
      ctx.stroke();
    }
    if (g.rects.length > 1) {
      ctx.strokeStyle = fg;
      ctx.beginPath();
      ctx.arc(X(cx), X(cy), X(Math.min(W, H) / 2 - 2), 0, Math.PI * 2);
      ctx.stroke();
    }
    const rr = Math.min(W, H) / 10;
    ctx.strokeStyle = fg;
    ctx.lineWidth = lw(2);
    for (const [x, y] of [[rr, rr], [W - rr, rr], [rr, H - rr], [W - rr, H - rr]]) {
      ctx.beginPath();
      ctx.arc(X(x), X(y), X(rr * 0.8), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
  if (P.frames) {
    const fs = Math.max(6, Math.min(g.pw, g.ph) * 0.035 * s);
    ctx.save();
    ctx.lineWidth = lw(4);
    ctx.textBaseline = "top";
    for (const r of g.rects) {
      const c = PJ_COLORS[(r.n - 1) % PJ_COLORS.length], inset = lw(2);
      ctx.strokeStyle = c;
      ctx.strokeRect(X(r.x) + inset, X(r.y) + inset, X(r.w) - inset * 2, X(r.h) - inset * 2);
      const lx = X(r.x) + Math.max(fs * 0.6, X(Math.min(gs, r.w / 6)) * 0.35), ly = X(r.y) + Math.max(fs * 0.5, X(Math.min(gs, r.h / 6)) * 0.45);
      ctx.font = "bold ".concat(fs, "px ").concat(FONT);
      const t1 = "P".concat(r.n), w1 = ctx.measureText(t1).width;
      ctx.font = "".concat(fs * 0.55, "px ").concat(FONT);
      const t2 = "".concat(r.w, "×").concat(r.h).concat(g.rot ? " · портрет" : "", " · X ").concat(r.x, " · Y ").concat(r.y), w2 = ctx.measureText(t2).width;
      // 2.0.76: номера проекторов — по галочке «Номера проекторов» (по умолчанию выкл), без чёрной подложки
      if (!P.nums) continue;
      void w1, void w2;
      ctx.fillStyle = c;
      ctx.font = "bold ".concat(fs, "px ").concat(FONT);
      ctx.fillText(t1, lx, ly);
      ctx.font = "".concat(fs * 0.55, "px ").concat(FONT);
      ctx.fillText(t2, lx, ly + fs * 1.12);
    }
    if (g.ovx || g.ovy) {
      ctx.fillStyle = tc;
      ctx.globalAlpha = 0.85;
      ctx.font = "".concat(fs * 0.5, "px ").concat(FONT);
      ctx.textAlign = "center";
      for (let i = 1; i < g.nx; i++) {
        const x0 = i * (g.pw - g.ovx) - g.offX;
        ctx.save();
        ctx.translate(X(x0 + g.ovx / 2), X(H * 0.3));
        ctx.rotate(-Math.PI / 2);
        ctx.fillText("перекрытие ".concat(g.ovx, " px"), 0, -fs * 0.25);
        ctx.restore();
      }
      for (let j = 1; j < g.ny; j++) {
        const y0 = j * (g.ph - g.ovy) - g.offY;
        ctx.textBaseline = "middle";
        ctx.fillText("перекрытие ".concat(g.ovy, " px"), X(W * 0.25), X(y0 + g.ovy / 2));
        ctx.textBaseline = "top";
      }
      ctx.textAlign = "left";
    }
    ctx.restore();
  }
  if (P.bar) {
    const bw = W * 0.5, bh = Math.max(12, H * 0.05), bx = (W - bw) / 2, by = barY(ctx, st, W, H, bx, bh), cols = ["#FFFFFF", "#FFFF00", "#00FFFF", "#00FF00", "#FF00FF", "#FF0000", "#0000FF", "#000000"];
    cols.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(X(bx + bw * i / cols.length), X(by), X(bw / cols.length) + 1, X(bh));
    });
    for (let i = 0; i < 11; i++) {
      const v = Math.round(255 * i / 10);
      ctx.fillStyle = "rgb(".concat(v, ",").concat(v, ",").concat(v, ")");
      ctx.fillRect(X(bx + bw * i / 11), X(by + bh), X(bw / 11) + 1, X(bh * 0.5));
    }
    ctx.strokeStyle = fg;
    ctx.lineWidth = lw(1);
    ctx.strokeRect(X(bx), X(by), X(bw), X(bh * 1.5));
  }
  ctx.strokeStyle = fg;
  ctx.lineWidth = lw(2);
  ctx.strokeRect(lw(1), lw(1), Wp - lw(2), Hp - lw(2));
  // 2.0.76: подложка и каше-фигуры в проекции — по пикселям (кабинетов нет)
  if (REF_ON_CANVAS) drawRefImage(ctx, st, s);
  drawCachePx(ctx, st, s, Wp, Hp);
  if (guides.circle || guides.diag) {
    ctx.beginPath();
    if (guides.diag) {
      ctx.moveTo(0, 0);
      ctx.lineTo(Wp, Hp);
      ctx.moveTo(0, Hp);
      ctx.lineTo(Wp, 0);
    }
    if (guides.circle) {
      const d = Math.min(Wp, Hp);
      ctx.moveTo(Wp / 2 + d / 2, Hp / 2);
      ctx.arc(Wp / 2, Hp / 2, d / 2, 0, Math.PI * 2);
    }
    ctx.strokeStyle = P.invert ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.5)";
    ctx.lineWidth = Math.max(1, 2 * s);
    ctx.stroke();
  }
  const lines = titleLines(st, s), b = blockSize(lines, TITLE_GAP * s), tx = W * s / 2 + (st.titleOffsetX || 0) * s, ty = H * s / 2 - (st.titleOffsetY || 0) * s;
  void b; // 2.0.76: под текстом проекции больше нет чёрного прямоугольника
  ctx.fillStyle = st.titleColor || tc;
  drawBlock(ctx, lines, TITLE_GAP * s, tx, ty, titleRot(st));
  for (const it of st.extraLabels || []) {
    const fs2 = Math.min(900, Math.max(6, +it.size || 120)) * s;
    ctx.fillStyle = it.color || tc;
    drawBlock(ctx, [[it.text || "Текст", fs2]], 0, W * s / 2 + (+it.x || 0) * s, H * s / 2 - (+it.y || 0) * s, +it.rotation || 0);
  }
  drawInfo(ctx, st, s);
  ctx.restore();
}
function drawCachePx(ctx, st, s, Wp, Hp) {
  const list = st.cacheShapes || [];
  if (!list.length) return;
  const dim = st.cacheDim == null ? 45 : +st.cacheDim, lit = list.filter((c) => !c.inv && !c.frame), inv = list.filter((c) => c.inv && !c.frame);
  const P = (c, k) => shapePath(ctx, c, c.x * s, c.y * s, c.w / 2 * s, c.h / 2 * s, k);
  if (lit.length) {
    // «Гасить» — снаружи чёрное, «Затемнить» — темнее на заданный процент
    const a = lit.some((c) => !c.dimOnly) ? 1 : Math.min(1, dim / 100);
    if (a > 0) {
      ctx.save();
      for (const c of lit) {
        ctx.beginPath();
        ctx.rect(-1, -1, Wp + 2, Hp + 2);
        P(c, true);
        ctx.clip("evenodd");
      }
      ctx.globalAlpha = a;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, Wp, Hp);
      ctx.restore();
    }
  }
  for (const c of inv) {
    const a = c.dimOnly ? Math.min(1, dim / 100) : 1;
    if (!(a > 0)) continue;
    ctx.save();
    P(c);
    ctx.globalAlpha = a;
    ctx.fillStyle = "#000";
    ctx.fill();
    ctx.restore();
  }
  const stroke = (c, w, color, alpha) => {
    shapePath(ctx, c, c.x * s, c.y * s, c.w / 2 * s - w / 2, c.h / 2 * s - w / 2);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.stroke();
    ctx.restore();
  };
  const lw = Math.max(1, Math.round((st.cacheLineW || 6) * s)), la = Math.max(0.05, Math.min(1, (st.cacheLineA == null ? 100 : +st.cacheLineA) / 100));
  for (const c of list) if (st.cacheLine !== false || c.frame) stroke(c, lw, st.cacheLineColor || "#FFFFFF", la);
}
function shapeR(c) {
  if (c.t === "bez") return 0;
  return c.t !== "circle" ? Math.max(0, Math.min(+c.r || 0, c.w / 2, c.h / 2)) : null;
}
// Многоугольные фигуры каше: трапеция и пентагон. Вершины — относительно центра, y вниз, по часовой.
const isPolyShape = (c) => c.t === "trap" || c.t === "pent" || c.t === "round";
const trapTb = (c) => Math.max(5, Math.min(100, c.tb == null ? 60 : +c.tb)) / 100;
const trapSk = (c) => Math.max(-100, Math.min(100, +c.sk || 0)) / 100;
function shapePoly(c, hw, hh) {
  if (c.t === "round") return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
  if (c.t === "pent") {
    // правильный пентагон вершиной вверх, вписанный в рамку фигуры
    const pts = [];
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + k * 2 * Math.PI / 5;
      pts.push([Math.cos(a) / Math.cos(Math.PI / 10) * hw, ((Math.sin(a) + 1) / (1 + Math.cos(Math.PI / 5)) * 2 - 1) * hh]);
    }
    return pts;
  }
  // трапеция: верхнее основание — tb% от нижнего, сдвиг верха sk% (±100 — прямоугольная трапеция), flip — широкой стороной вверх
  const tw = hw * trapTb(c), off = (hw - tw) * trapSk(c);
  let pts = [[-tw + off, -hh], [tw + off, -hh], [hw, hh], [-hw, hh]];
  if (c.flip) pts = pts.map(([x, y]) => [x, -y]).reverse();
  return pts;
}
// Радиус скругления каждого угла (не больше, чем позволяют соседние стороны)
function polyCorners(pts, r) {
  const n = pts.length;
  return pts.map((p, i) => {
    const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
    const u = [a[0] - p[0], a[1] - p[1]], v = [b[0] - p[0], b[1] - p[1]], lu = Math.hypot(u[0], u[1]) || 1e-9, lv = Math.hypot(v[0], v[1]) || 1e-9;
    const ang = Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / (lu * lv)))), t = Math.tan(ang / 2);
    return { x: p[0], y: p[1], r: Math.max(0, Math.min(r, Math.min(lu, lv) / 2 * t)), u: [u[0] / lu, u[1] / lu], v: [v[0] / lv, v[1] / lv], ang };
  });
}
function polyFlat(c, hw, hh, r) {
  const out = [];
  for (const q of polyCorners(shapePoly(c, hw, hh), r)) {
    if (q.r <= 1e-6) {
      out.push([q.x, q.y]);
      continue;
    }
    const d = q.r / Math.tan(q.ang / 2), t1 = [q.x + q.u[0] * d, q.y + q.u[1] * d], t2 = [q.x + q.v[0] * d, q.y + q.v[1] * d];
    const bx = q.u[0] + q.v[0], by = q.u[1] + q.v[1], bl = Math.hypot(bx, by) || 1e-9, h = q.r / Math.sin(q.ang / 2);
    const ox = q.x + bx / bl * h, oy = q.y + by / bl * h;
    let a1 = Math.atan2(t1[1] - oy, t1[0] - ox), a2 = Math.atan2(t2[1] - oy, t2[0] - ox), da = a2 - a1;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    for (let k = 0; k <= 8; k++) out.push([ox + q.r * Math.cos(a1 + da * k / 8), oy + q.r * Math.sin(a1 + da * k / 8)]);
  }
  return out;
}
function inPoly(pts, x, y) {
  let ins = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}
// ---- Поворот фигур: c.rot — градусы по часовой ----
const shapeRot = (c) => (+c.rot || 0) * Math.PI / 180;
function rotPt(c, lx, ly) {
  const a = shapeRot(c);
  if (!a) return [lx, ly];
  const co = Math.cos(a), si = Math.sin(a);
  return [lx * co - ly * si, lx * si + ly * co];
}
function unrotPt(c, dx, dy) {
  const a = -shapeRot(c);
  if (!a) return [dx, dy];
  const co = Math.cos(a), si = Math.sin(a);
  return [dx * co - dy * si, dx * si + dy * co];
}
// ---- Своя фигура: c.pts — точки {x, y, ix, iy, ox, oy, sm} в долях полуширины/полувысоты (−1…1),
// ix/iy — входящая ручка кривой Безье, ox/oy — исходящая, sm — плавный узел (ручки на одной прямой) ----
function bezSegs(pts, hw, hh) {
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    out.push([[a.x * hw, a.y * hh], [a.ox * hw, a.oy * hh], [b.ix * hw, b.iy * hh], [b.x * hw, b.y * hh]]);
  }
  return out;
}
const bezAt = ([p0, p1, p2, p3], t) => {
  const u = 1 - t;
  return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]];
};
function bezFlat(pts, hw, hh, steps = 20) {
  const out = [];
  for (const sg of bezSegs(pts, hw, hh)) for (let k = 0; k < steps; k++) out.push(bezAt(sg, k / steps));
  return out;
}
// Контур фигуры (без поворота, относительно центра) — ломаная
function shapeFlatLocal(c, hw, hh) {
  if (c.t === "bez") return bezFlat(c.pts || [], hw, hh);
  if (c.t === "circle") {
    const out = [];
    for (let k = 0; k < 72; k++) out.push([Math.cos(k / 72 * 2 * Math.PI) * hw, Math.sin(k / 72 * 2 * Math.PI) * hh]);
    return out;
  }
  const r = Math.min(shapeR(c) || 0, hw, hh) * (hw / Math.max(1e-9, c.w / 2));
  return polyFlat(c, hw, hh, r);
}
// Контур в координатах маски (с поворотом и сдвигом), k — масштаб от центра
function shapeOutline(c, k = 1) {
  return shapeFlatLocal(c, c.w / 2 * k, c.h / 2 * k).map(([x, y]) => {
    const [X, Y] = rotPt(c, x, y);
    return [c.x + X, c.y + Y];
  });
}
// Касается ли фигура прямоугольника кабинета (хоть краем)
function shapeTouchesRect(c, x0, y0, x1, y1, outline) {
  const px = Math.max(x0, Math.min(c.x, x1)), py = Math.max(y0, Math.min(c.y, y1));
  if (shapeHas(c, px - c.x, py - c.y)) return true;
  for (const [X, Y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) if (shapeHas(c, X - c.x, Y - c.y)) return true;
  for (const [X, Y] of outline || shapeOutline(c)) if (X >= x0 && X <= x1 && Y >= y0 && Y <= y1) return true;
  return false;
}
function shapeHas(c, dx, dy) {
  [dx, dy] = unrotPt(c, dx, dy);
  const hw = c.w / 2, hh = c.h / 2, ax = Math.abs(dx), ay = Math.abs(dy), r = shapeR(c);
  if (c.t === "bez") return inPoly(bezFlat(c.pts || [], hw, hh), dx, dy);
  if (isPolyShape(c) && c.t !== "round") return inPoly(polyFlat(c, hw, hh, r), dx, dy);
  if (r === null) {
    const u = dx / hw, v = dy / hh;
    return u * u + v * v < 1;
  }
  if (ax >= hw || ay >= hh) return false;
  const qx = ax - (hw - r), qy = ay - (hh - r);
  return qx <= 0 || qy <= 0 || qx * qx + qy * qy < r * r;
}
function shapePath(ctx, c, cx, cy, rx, ry, keep) {
  if (!keep) ctx.beginPath();
  const a = shapeRot(c);
  if (!a) return shapePathLocal(ctx, c, cx, cy, rx, ry);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(a);
  shapePathLocal(ctx, c, 0, 0, rx, ry);
  ctx.restore();
}
function shapePathLocal(ctx, c, cx, cy, rx, ry) {
  rx = Math.max(0, rx);
  ry = Math.max(0, ry);
  if (c.t === "bez") {
    const sg = bezSegs(c.pts || [], rx, ry);
    if (!sg.length) return;
    ctx.moveTo(cx + sg[0][0][0], cy + sg[0][0][1]);
    for (const [, p1, p2, p3] of sg) ctx.bezierCurveTo(cx + p1[0], cy + p1[1], cx + p2[0], cy + p2[1], cx + p3[0], cy + p3[1]);
    ctx.closePath();
    return;
  }
  const r0 = shapeR(c);
  if (r0 === null) {
    ctx.moveTo(cx + rx, cy);
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    return;
  }
  const r = Math.max(0, Math.min(rx, ry, r0 * (rx / Math.max(1e-9, c.w / 2)))), x0 = cx - rx, y0 = cy - ry, x1 = cx + rx, y1 = cy + ry;
  if (isPolyShape(c) && c.t !== "round") {
    const qs = polyCorners(shapePoly(c, rx, ry), r), n = qs.length, last = qs[n - 1];
    ctx.moveTo(cx + (last.x + qs[0].x) / 2, cy + (last.y + qs[0].y) / 2);
    for (let i = 0; i < n; i++) {
      const q = qs[i], nx = qs[(i + 1) % n];
      if (q.r > 1e-6) ctx.arcTo(cx + q.x, cy + q.y, cx + nx.x, cy + nx.y, q.r);
      else ctx.lineTo(cx + q.x, cy + q.y);
    }
    ctx.closePath();
    return;
  }
  ctx.moveTo(x0 + r, y0);
  ctx.lineTo(x1 - r, y0);
  ctx.arcTo(x1, y0, x1, y0 + r, r);
  ctx.lineTo(x1, y1 - r);
  ctx.arcTo(x1, y1, x1 - r, y1, r);
  ctx.lineTo(x0 + r, y1);
  ctx.arcTo(x0, y1, x0, y1 - r, r);
  ctx.lineTo(x0, y0 + r);
  ctx.arcTo(x0, y0, x0 + r, y0, r);
  ctx.closePath();
}
function shapeOuterK(st, c, xs, ys, H) {
  let k = 1;
  const ol = shapeOutline(c);
  const inside = (kk, dx, dy) => shapeHas(Object.assign({}, c, { w: c.w * kk, h: c.h * kk, r: (+c.r || 0) * kk }), dx, dy);
  for (let r = 0; r < st.cabRows; r++) for (let cc = 0; cc < st.cabCols; cc++) {
    const x0 = xs[cc], x1 = xs[cc + 1], y0 = H - ys[r + 1], y1 = H - ys[r];
    if (!shapeTouchesRect(c, x0, y0, x1, y1, ol)) continue;
    for (const [X, Y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) {
      const dx = X - c.x, dy = Y - c.y;
      if (inside(k * 1.0001, dx, dy)) continue;
      let lo = k, hi = k * 2;
      while (!inside(hi, dx, dy) && hi < 1e4) hi *= 2;
      for (let i = 0; i < 30; i++) {
        const m = (lo + hi) / 2;
        if (inside(m, dx, dy)) hi = m;
        else lo = m;
      }
      k = hi;
    }
  }
  return k;
}
function shapeOff(st) {
  const all = st.kind && st.kind !== "led" ? [] : (st.cacheShapes || []).filter((c) => !c.frame && !c.dimOnly), lit = all.filter((c) => !c.inv), dark = all.filter((c) => c.inv), out = [];
  if (!all.length) return out;
  const { xs, ys } = grid(st), [, H] = dims(st), ols = new Map(all.map((e) => [e, shapeOutline(e)]));
  for (let r = 0; r < st.cabRows; r++) for (let c = 0; c < st.cabCols; c++) {
    const x0 = xs[c], x1 = xs[c + 1], y0 = H - ys[r + 1], y1 = H - ys[r];
    const touch = (e) => shapeTouchesRect(e, x0, y0, x1, y1, ols.get(e));
    if (lit.length && !lit.some(touch) || dark.some(touch)) out.push(key(c, r));
  }
  return out;
}
const shapedCount = (st) => Object.keys(st.shapedCols || {}).filter((c) => +c < st.cabCols).length + Object.keys(st.shapedRows || {}).filter((r) => +r < st.cabRows).length;
const key = (c, r) => c + "," + r;
const parseKey = (k) => {
  const p = String(k).split(",");
  if (p.length !== 2) return null;
  const c = parseInt(p[0], 10), r = parseInt(p[1], 10);
  return isNaN(c) || isNaN(r) ? null : [c, r];
};
const to255 = (c) => [c.r, c.g, c.b].map((v) => Math.max(0, Math.min(255, Math.round((+v || 0) * 255))));
const css = (c) => {
  const [r, g, b] = to255(c);
  return "rgb(".concat(r, ",").concat(g, ",").concat(b, ")");
};
const hex = (c) => "#" + to255(c).map((v) => v.toString(16).padStart(2, "0")).join("");
const fromHex = (h) => col(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
function typeMM(st) {
  const t = TYPES.find((t2) => t2[0] === st.cabinetTypeName);
  return t ? [t[3], t[4], true] : [500, 500, false];
}
function physM(st) {
  if (st.kind === "ring") {
    const g = ringGeom(st);
    return [g.W * ringMmX(g.R) / 1e3, g.H * ringMmY(g.R) / 1e3, true];
  }
  if (st.kind === "tv") {
    const g = tvGeom(st), d = +g.T.diag || 0;
    if (!d) return [0, 0, false];
    const k2 = d * 0.0254 / Math.hypot(g.pw, g.ph);
    return [g.W * k2, g.H * k2, true];
  }
  if (st.kind === "tube") {
    const g = tubeGeom(st);
    return [(g.cols - 1) * g.step / 100 || +g.T.wm || 0.03, g.rows * g.len, true];
  }
  if (st.kind === "pix") {
    const g = pixGeom(st);
    return g.X.cmw > 0 && g.X.cmh > 0 ? [g.wm, g.hm, true] : [0, 0, false];
  }
  if (st.kind === "vol") {
    const V = volGeom(st).V;
    return [V.cx * V.cw / 100, V.len, true];
  }
  if (st.kind === "proj" && st.proj && st.proj.mode !== "dome" && +st.proj.cw > 0 && +st.proj.ch > 0) return [+st.proj.cw, +st.proj.ch, true];
  if (st.kind === "proj") {
    const [W2, H2] = dims(st), dome = st.proj && st.proj.mode === "dome", wm = !dome ? +st.proj.wm || 0 : 0;
    return wm > 0 ? [wm, wm * H2 / W2, true] : dome ? [0, 0, false] : [W2 / 100, H2 / 100, true];
  }
  const [w, h, k] = typeMM(st), [W, H] = dims(st);
  return [w / Math.max(1, st.cabWpx) * W / 1e3, h / Math.max(1, st.cabHpx) * H / 1e3, k];
}
function compactM(v) {
  let s = (+v).toFixed(3);
  if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");
  return s;
}
// 2.0.54: волюметрик — 3D-прибор: размер всегда тремя числами — ширина × высота (длина нити) × глубина
const volSize = (V) => "ширина ".concat(compactM(V.cx * V.cw / 100), " × высота ").concat(compactM(V.len), " × глубина ").concat(compactM(V.cz * V.cd / 100), " м");
const physText = (st) => {
  if (st.kind === "vol" && st.vol) return volSize(volGeom(st).V);
  const [w, h, k] = physM(st);
  if (st.kind && st.kind !== "led" && !k) return { proj: "проекция", tv: "ТВ-панели", pix: "pixel drop", tube: "led tube", vol: "волюметрик" }[st.kind] || "";
  return "".concat(compactM(w), "х").concat(compactM(h), " м");
};
const titleText = (st) => {
  const [W, H] = dims(st);
  return "".concat(W, "×").concat(H);
};
function cabLabel(st, c, r) {
  return fmtCabLabel(st, c, r, st.cabCols, st.cabRows);
}
// 2.0.163: общий формат номера кабинета — одинаковый для LED-масок и для колец
function fmtCabLabel(st, c, r, cols, rows) {
  let colN = c + 1, rowN = r + 1;
  const o = st.numberOriginIndex;
  if (o === 1) rowN = rows - r;
  else if (o === 2) colN = cols - c;
  else if (o === 3) {
    colN = cols - c;
    rowN = rows - r;
  }
  switch (st.numberFormatIndex) {
    case 1:
      return "".concat(colN, "-").concat(rowN);
    case 2:
      return "".concat(colN, " / ").concat(rowN);
    case 3:
      return "C".concat(colN, "-R").concat(rowN);
    case 4:
      return String((rowN - 1) * cols + colN);
    default:
      return "".concat(colN, ",").concat(rowN);
  }
}
const mctx = document.createElement("canvas").getContext("2d");
function measure(text, size) {
  var _a, _b;
  mctx.font = "".concat(Math.max(0.5, size), "px ").concat(FONT);
  const m = mctx.measureText(text || "");
  const asc = (_a = m.fontBoundingBoxAscent) != null ? _a : size * 0.92, desc = (_b = m.fontBoundingBoxDescent) != null ? _b : size * 0.26;
  return { w: m.width, h: asc + desc, asc };
}
const autoCache = /* @__PURE__ */ new Map();
function autoSize(W, H, name) {
  const k = W + "x" + H + "|" + name;
  if (autoCache.has(k)) return autoCache.get(k);
  let best = 30;
  const l1 = "".concat(W, "×").concat(H), l2 = name || "screen 1";
  for (let size = 10; size <= 400; size += 10) {
    const a = measure(l1, size), b = measure(l2, size * 0.55);
    if (a.w <= W * 0.68 && Math.max(a.w, b.w) <= W * 0.78 && a.h + size * 0.064 + b.h <= H * 0.24) best = size;
    else break;
  }
  autoCache.set(k, best);
  return best;
}
function inscSize(st) {
  const i = clampI(st.inscriptionIndex, INSC.length);
  if (i === 0) {
    const [W, H] = dims(st);
    return autoSize(W, H, st.name);
  }
  return Math.max(6, Math.min(900, pfloat(INSC[i])));
}
const TITLE_GAP = 5;
function titleLines(st, s) {
  const size = inscSize(st);
  const s1 = Math.max(10, size) * s, s2 = Math.max(8, size * 0.55) * s, s3 = Math.max(4, Math.max(8, size * 0.55) * 0.5) * s;
  const lines = [];
  if (st.line1Enabled !== false) lines.push([titleText(st), s1]);
  if (st.line2Enabled && st.name) lines.push([st.name, s2]);
  if (st.line3Enabled) lines.push([physText(st), s3]);
  return lines.length ? lines : [["", s1]];
}
function blockSize(lines, gap) {
  const ms = lines.map(([t, sz]) => measure(t, sz));
  return { ms, w: Math.max(...ms.map((m) => m.w)), h: ms.reduce((a, m) => a + m.h, 0) + gap * (ms.length - 1) };
}
// 2.0.43: «Размер нумерации» — Авто (как раньше, от размера кабинета) или свой 1…1000 px; номер всё равно ужимается, чтобы влезть в кабинет
// 2.0.44: «Авто» — номер в той же пропорции к кабинету на всех типах: 50 px на кабинет 192 px (≈26% меньшей стороны)
const NUM_AUTO_K = 50 / 192;
const numberAuto = (st) => Math.max(1, Math.round(Math.min(st.cabWpx, st.cabHpx) * NUM_AUTO_K));
const numberFont = (st) => +st.numSize > 0 ? Math.max(1, Math.min(1000, +st.numSize)) : numberAuto(st);
const NUM_SIZES = [1, 2, 3, 4, 5, 6, 8];
for (let n = 10; n <= 1000; n += 10) NUM_SIZES.push(n);
// ===== 2.0.157: «Кольцо» — кабинеты по кругу или эллипсу (несколько колец), каждый кабинет можно сдвинуть и повернуть =====
const RING_COLORS = ["#7a0f2b", "#0f3d1a", "#5a0a6e", "#0a1f6e", "#6e4a0a", "#0a5a5a", "#6e0a4a", "#3a3a3a"];
function ringCabDef() {
  const t = TYPES.find((q) => q[0] === DEFAULT_TYPE) || TYPES[0];
  return { type: t[0], cw: t[1], ch: t[2], mw: t[3], mh: t[4] };
}
const ringEven = (v) => Math.max(2, Math.round(v / 2) * 2);
// 2.0.163: кабинет можно задать отдельно каждому кольцу; если не задан — берём общий у экрана
const ringCab = (R, g) => ({
  type: g && g.type != null ? g.type : R.type,
  cw: Math.max(1, ((g && g.cw) || R.cw) | 0),
  ch: Math.max(1, ((g && g.ch) || R.ch) | 0),
  mw: +((g && g.mw) || R.mw) || 500,
  mh: +((g && g.mh) || R.mh) || 500
});
// цвет типа кабинета — тот же, что в LED-масках (из каталога)
const typeColor = (name, cw, ch) => {
  const t = TYPES.find((q) => q[0] === name && q[1] === cw && q[2] === ch) || TYPES.find((q) => q[0] === name);
  return t ? hex(fromRGB(t[5])).toUpperCase() : null;
};
function defRingItem(i, R) {
  const prev = R && R.rings && R.rings[R.rings.length - 1];
  const cab = ringCab(R || {}, prev || null), cw = Math.max(1, cab.cw | 0);
  const cabf = { type: cab.type, cw: cab.cw, ch: cab.ch, mw: cab.mw, mh: cab.mh };
  const color = typeColor(cab.type, cab.cw, cab.ch) || RING_COLORS[i % RING_COLORS.length];
  if (!prev) {
    const n = 12;
    return { n, dw: ringEven(n * cw * 1.25 / Math.PI), dh: ringEven(n * cw * 1.25 / Math.PI), lock: true, a0: 0, arc: 360, dir: 1, face: "in", color, ox: 0, oy: 0, bw: 1, bh: 1, ...cabf };
  }
  const dw = ringEven(prev.dw + cw * 2.6), dh = ringEven(dw * prev.dh / prev.dw);
  return { n: Math.max(3, Math.round(Math.PI * dw / (cw * 1.25))), dw, dh, lock: prev.lock !== false, a0: +prev.a0 || 0, arc: +prev.arc || 360, dir: prev.dir === -1 ? -1 : 1, face: prev.face === "up" ? "up" : "in", color, ox: +prev.ox || 0, oy: +prev.oy || 0, bw: Math.max(1, prev.bw | 0) || 1, bh: Math.max(1, prev.bh | 0) || 1, ...cabf };
}
function defRing() {
  const R = { ...ringCabDef(), rings: [], mods: {}, auto: true, pad: 40, W: 1920, H: 1080, nums: true, numFmt: "cr", outline: true };
  R.rings.push(defRingItem(0, R));
  return R;
}
function ringNorm(q) {
  const R = defRing();
  if (!q || typeof q !== "object") return R;
  if (typeof q.type === "string") R.type = q.type;
  for (const k of ["cw", "ch"]) if (+q[k] >= 1) R[k] = Math.min(16384, Math.round(+q[k]));
  for (const k of ["mw", "mh"]) if (+q[k] > 0) R[k] = +q[k];
  R.auto = q.auto !== false;
  R.pad = q.pad == null ? 40 : Math.max(0, Math.round(+q.pad || 0));
  for (const k of ["W", "H"]) if (+q[k] >= 16) R[k] = Math.min(32768, Math.round(+q[k]));
  R.nums = q.nums !== false;
  R.outline = q.outline !== false;
  R.groups = (Array.isArray(q.groups) ? q.groups : []).map((a) => Array.isArray(a) ? [...new Set(a.map(String).filter((k) => /^\d+,\d+(,\d+)?$/.test(k)))] : []).filter((a) => a.length > 1);
  R.numFmt = ["cr", "ring", "seq"].includes(q.numFmt) ? q.numFmt : q.numFmt === "rm" ? "ring" : "cr";
  if (Array.isArray(q.rings) && q.rings.length) {
    const out = [];
    q.rings.slice(0, 50).forEach((r, i) => {
      if (!r || typeof r !== "object") return;
      const d = defRingItem(i, null);
      out.push({ n: Math.max(1, Math.min(2000, Math.round(+r.n || d.n))), dw: Math.max(2, +r.dw || d.dw), dh: Math.max(2, +r.dh || +r.dw || d.dh), lock: r.lock !== false, a0: +r.a0 || 0, arc: r.arc == null ? 360 : Math.max(1, Math.min(360, +r.arc || 360)), dir: +r.dir === -1 ? -1 : 1, face: r.face === "up" ? "up" : "in", color: /^#[0-9a-f]{6}$/i.test(r.color || "") ? r.color : d.color, ox: +r.ox || 0, oy: +r.oy || 0, bw: Math.max(1, Math.min(20, Math.round(+r.bw || 1))), bh: Math.max(1, Math.min(20, Math.round(+r.bh || 1))), type: typeof r.type === "string" ? r.type : d.type, cw: +r.cw > 0 ? Math.min(16384, Math.round(+r.cw)) : d.cw, ch: +r.ch > 0 ? Math.min(16384, Math.round(+r.ch)) : d.ch, mw: +r.mw > 0 ? +r.mw : d.mw, mh: +r.mh > 0 ? +r.mh : d.mh });
    });
    if (out.length) R.rings = out;
  }
  R.mods = {};
  if (q.mods && typeof q.mods === "object") for (const [k, v] of Object.entries(q.mods)) {
    if (!/^\d+,\d+(,\d+)?$/.test(k) || !v || typeof v !== "object") continue;
    const o = {};
    if (+v.dx) o.dx = +v.dx;
    if (+v.dy) o.dy = +v.dy;
    if (+v.dr) o.dr = +v.dr;
    if (v.off) o.off = true;
    if (/^#[0-9a-f]{6}$/i.test(v.color || "")) o.color = v.color;
    if (Object.keys(o).length) R.mods[k] = o;
  }
  return R;
}
const ringNormDeg = (d) => {
  let v = ((+d || 0) % 360 + 540) % 360 - 180;
  return Math.round(v * 100) / 100;
};
function ringGeom(st) {
  const R = st.ring || (st.ring = defRing()), cw0 = Math.max(1, R.cw | 0), ch0 = Math.max(1, R.ch | 0), list = [];
  let seq = 0, mx = 0, my = 0;
  R.rings.forEach((g, ri) => {
    const gc = ringCab(R, g), cw = gc.cw, ch = gc.ch;
    const n = Math.max(1, g.n | 0), a = Math.max(1, +g.dw || 2) / 2, b = Math.max(1, +g.dh || 2) / 2, arc = +g.arc || 360, full = arc >= 360;
    const stepA = full ? 360 / n : n > 1 ? arc / (n - 1) : 0, dir = g.dir === -1 ? -1 : 1;
    const bw = Math.max(1, g.bw | 0), bh = Math.max(1, g.bh | 0), block = bw * bh > 1;
    for (let i = 0; i < n; i++) {
      const th = ((+g.a0 || 0) + dir * i * stepA) * Math.PI / 180, px = a * Math.sin(th), py = b * Math.cos(th);
      let base = 0;
      if (g.face !== "up") base = Math.atan2(px / (a * a), py / (b * b)) * 180 / Math.PI;
      const k0 = ri + "," + i;
      // сетка блока ориентирована по кольцу (base); центр точки — на эллипсе
      const br = base * Math.PI / 180, bcr = Math.cos(br), bsr = Math.sin(br);
      const ox0 = (+g.ox || 0) + px, oy0 = (+g.oy || 0) - py;
      for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
        const bi = by * bw + bx, ck = bi ? k0 + "," + bi : k0, cm = R.mods[ck] || {};
        const rot = ringNormDeg(base + (cm.dr || 0));
        const lx = (bx - (bw - 1) / 2) * cw, ly = (by - (bh - 1) / 2) * ch;
        const cx = ox0 + lx * bcr - ly * bsr + (cm.dx || 0), cy = oy0 + lx * bsr + ly * bcr + (cm.dy || 0);
        const rr = rot * Math.PI / 180, cr = Math.cos(rr), sr = Math.sin(rr);
        const ex = Math.abs(cw / 2 * cr) + Math.abs(ch / 2 * sr), ey = Math.abs(cw / 2 * sr) + Math.abs(ch / 2 * cr);
        seq++;
        list.push({ k: ck, ri, i, bi, bx, by, bw, bh, nCols: n * bw, block, cx, cy, w: cw, h: ch, rot, base, color: cm.color || g.color, off: !!cm.off, n: seq, moved: !!(cm.dx || cm.dy || cm.dr) });
        mx = Math.max(mx, Math.abs(cx) + ex);
        my = Math.max(my, Math.abs(cy) + ey);
      }
    }
  });
  let W, H;
  if (R.auto !== false) {
    const p = Math.max(0, +R.pad || 0);
    W = Math.max(16, Math.ceil(mx + p) * 2);
    H = Math.max(16, Math.ceil(my + p) * 2);
  } else {
    W = Math.max(16, R.W | 0);
    H = Math.max(16, R.H | 0);
  }
  for (const m of list) {
    m.x = W / 2 + m.cx;
    m.y = H / 2 + m.cy;
  }
  return { R, list, W, H, cw: cw0, ch: ch0 };
}
// 2.0.163: номер кабинета в кольце — по тем же правилам, что в LED-масках:
// колонка считается вдоль кольца (сквозь блоки), ряд — внутри блока; формат и точка отсчёта общие
// 2.0.168: группы кабинетов кольца — выбор одного выбирает всю группу, двигаются и крутятся вместе
const ringGroupOf = (R, k) => (R.groups || []).find((a) => a.includes(k)) || null;
const ringExpandSel = (R, keys) => {
  const out = /* @__PURE__ */ new Set();
  for (const k of keys) {
    const g = ringGroupOf(R, k);
    if (g) for (const q of g) out.add(q);
    else out.add(k);
  }
  return out;
};
// 2.0.169: группа кабинетов — один жёсткий объект: общий центр (pivot) и радиус для ручки поворота
function ringPivot(gg, m) {
  const g = m && ringGroupOf(gg.R, m.k);
  if (!g) return null;
  const mem = gg.list.filter((q) => g.includes(q.k));
  if (mem.length < 2) return null;
  const n = mem.length, x = mem.reduce((t, q) => t + q.x, 0) / n, y = mem.reduce((t, q) => t + q.y, 0) / n;
  const cx = mem.reduce((t, q) => t + q.cx, 0) / n, cy = mem.reduce((t, q) => t + q.cy, 0) / n;
  let r = 0;
  for (const q of mem) for (const pt of ringPoly(q)) r = Math.max(r, Math.hypot(pt[0] - x, pt[1] - y));
  return { x, y, cx, cy, r, mem };
}
const ringLabel = (R, m, st) => {
  if (R.numFmt === "seq") return String(m.n);
  const lab = fmtCabLabel(st, m.i * m.bw + m.bx, m.by, m.nCols, m.bh);
  return R.numFmt === "ring" ? "".concat(m.ri + 1, "\xB7").concat(lab) : lab;
};
function ringPoly(m, grow) {
  const a = m.rot * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), hw = m.w / 2 + (grow || 0), hh = m.h / 2 + (grow || 0);
  return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => [m.x + x * c - y * s, m.y + x * s + y * c]);
}
function ringHit(m, x, y) {
  const a = -m.rot * Math.PI / 180, dx = x - m.x, dy = y - m.y, lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
  return Math.abs(lx) <= m.w / 2 && Math.abs(ly) <= m.h / 2;
}
const ringMmX = (R) => (+R.mw || 500) / Math.max(1, R.cw | 0);
const ringMmY = (R) => (+R.mh || 500) / Math.max(1, R.ch | 0);
function drawRing(ctx, st, s, guides) {
  const g = ringGeom(st), R = g.R, Wp = Math.max(1, Math.round(g.W * s)), Hp = Math.max(1, Math.round(g.H * s));
  ctx.save();
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, Wp, Hp);
  const fsOf = (m) => (+st.numSize > 0 ? Math.min(1000, +st.numSize) : Math.max(1, Math.round(Math.min(m.w, m.h) * NUM_AUTO_K))) * s;
  const put = (m, fn) => {
    ctx.save();
    ctx.translate(m.x * s, m.y * s);
    ctx.rotate(m.rot * Math.PI / 180);
    fn(m.w / 2 * s, m.h / 2 * s);
    ctx.restore();
  };
  for (const m of g.list) {
    if (m.off) continue;
    ctx.fillStyle = m.color;
    put(m, (hw, hh) => ctx.fillRect(-hw, -hh, hw * 2, hh * 2));
  }
  // 2.0.163: границы как в LED-масках — внутри блока тёмная сетка, снаружи яркий белый контур
  if (R.outline !== false) {
    const bwL = Math.max(1, Math.round(2 * s)), owL = Math.max(1, Math.round(s)), half = Math.floor(bwL / 2);
    const live = /* @__PURE__ */ new Map();
    for (const m of g.list) if (!m.off) live.set(m.ri + "|" + m.i + "|" + m.bx + "|" + m.by, m);
    // граница внутренняя, если рядом в том же блоке есть кабинет и оба не сдвинуты и повёрнуты одинаково
    const inner = (m, dx, dy) => {
      if (m.moved) return false;
      const o = live.get(m.ri + "|" + m.i + "|" + (m.bx + dx) + "|" + (m.by + dy));
      return !!o && !o.moved && Math.abs(o.rot - m.rot) < 1e-6;
    };
    for (const pass of [0, 1]) {
      ctx.fillStyle = pass ? "#fff" : "rgb(64,64,64)";
      for (const m of g.list) {
        if (m.off) continue;
        const L = inner(m, -1, 0), Rr = inner(m, 1, 0), T = inner(m, 0, -1), B = inner(m, 0, 1);
        if (pass ? L && Rr && T && B : !(L || Rr || T || B)) continue;
        put(m, (hw, hh) => {
          if (!pass) {
            if (L) ctx.fillRect(-hw - half, -hh, bwL, hh * 2);
            if (Rr) ctx.fillRect(hw - half, -hh, bwL, hh * 2);
            if (T) ctx.fillRect(-hw, -hh - half, hw * 2, bwL);
            if (B) ctx.fillRect(-hw, hh - half, hw * 2, bwL);
          } else {
            if (!L) ctx.fillRect(-hw, -hh, owL, hh * 2);
            if (!Rr) ctx.fillRect(hw - owL, -hh, owL, hh * 2);
            if (!T) ctx.fillRect(-hw, -hh, hw * 2, owL);
            if (!B) ctx.fillRect(-hw, hh - owL, hw * 2, owL);
          }
        });
      }
    }
  }
  if (R.nums !== false) {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const m of g.list) {
      if (m.off) continue;
      const fs = fsOf(m);
      if (fs < 2) continue;
      ctx.font = "".concat(fs, "px ").concat(FONT);
      put(m, () => ctx.fillText(ringLabel(R, m, st), 0, 0));
    }
  }
  // 2.0.162: у кольца направляющих (круга и диагоналей) нет
  ctx.textAlign = "left";
  if (REF_ON_CANVAS) drawRefImage(ctx, st, s);
  ctx.textBaseline = "alphabetic";
  drawPlateTitle(ctx, st, s, g.W, g.H, false, true);
  drawInfo(ctx, st, s);
  ctx.restore();
}
function ringInfoLines(st) {
  const g = ringGeom(st), R = g.R, [W, H] = [g.W, g.H], cm = (px, k) => compactM(+(px * k / 10).toFixed(1));
  const off = g.list.filter((m) => m.off).length;
  const cabs = [...new Set(R.rings.map((r) => {
    const q = ringCab(R, r);
    return (q.type ? q.type + " — " : "") + q.cw + "×" + q.ch + " px · " + compactM(+q.mw) + "×" + compactM(+q.mh) + " мм";
  }))];
  const out = [(cabs.length > 1 ? "Кабинеты: " : "Кабинет: ") + cabs.join("; ")];
  out.push("Колец: ".concat(R.rings.length, " · кабинетов: ").concat(g.list.length - off).concat(off ? " (погашено ".concat(off, ")") : ""));
  R.rings.forEach((r, i) => out.push("Кольцо ".concat(i + 1, ": ").concat(r.n, " шт · Ø ").concat(Math.round(r.dw), "×").concat(Math.round(r.dh), " px (").concat(cm(r.dw, ringMmX(R)), "×").concat(cm(r.dh, ringMmY(R)), " см)")));
  out.push("Разрешение: ".concat(W, "×").concat(H, " px"));
  out.push("Физический размер: ".concat(compactM(W * ringMmX(R) / 1e3), "×").concat(compactM(H * ringMmY(R) / 1e3), " м"));
  return out;
}
const projCircle = (st) => !!(st.proj && st.proj.circleGuide === true);
function drawMask(ctx, st, s, guides) {
  if (st.kind === "proj") return drawProj(ctx, st, s, { ...guides || {}, circle: projCircle(st) });
  if (st.kind === "tv") return drawTV(ctx, st, s, guides);
  if (st.kind === "ring") return drawRing(ctx, st, s, guides || {});
  if (st.kind === "pix" || st.kind === "tube") return drawPix(ctx, st, s, guides);
  if (st.kind === "vol") {
    if (VOL_MASK_UI) return drawVol(ctx, st, s);
    // без маски: превью экрана, PNG и общее поле — схема коммутации
    const [W2, H2] = dims(st);
    ctx.save();
    ctx.scale(s, s);
    volComPaint(ctx, st, W2, H2);
    ctx.restore();
    return;
  }
  const [W, H] = dims(st), cols = st.cabCols, rows = st.cabRows, { xs, ys } = grid(st);
  const Wp = Math.max(1, Math.round(W * s)), Hp = Math.max(1, Math.round(H * s));
  const fx = (x) => Math.round(x * s), fy = (y) => Math.round((H - y) * s);
  const sh = cabShift(st);
  const rotated = hasRot(st);
  const shifted = hasShift(st) || rotated;
  const rotA = (c, r) => (st.cabRot || {})[key(c, r)] || 0;
  const cell = (c, r) => {
    const dx = sh.dx(c, r), dy = sh.dy(c, r);
    const x0 = fx(xs[c] + dx), x1 = fx(xs[c + 1] + dx), y0 = fy(ys[r + 1] + dy), y1 = fy(ys[r] + dy);
    return [x0, y0, x1 - x0, y1 - y0];
  };
  // 2.0.174: вращение кабинета вокруг своего центра (по часовой)
  const withRot = (c, r, fn) => {
    const a = rotA(c, r);
    if (!a) return fn();
    const [x, y, w, h] = cell(c, r);
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(a * Math.PI / 180);
    ctx.translate(-(x + w / 2), -(y + h / 2));
    fn();
    ctx.restore();
  };
  ctx.save();
  // 2.0.150: при сдвиге фон «ступенек» (где нет кабинетов) — чёрный, цветом маски заливаем только сами кабинеты
  if (shifted) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, Wp, Hp);
    ctx.fillStyle = css(st.pixelColor);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) withRot(c, r, () => ctx.fillRect(...cell(c, r)));
  } else {
    ctx.fillStyle = css(st.pixelColor);
    ctx.fillRect(0, 0, Wp, Hp);
  }
  for (const [k, c] of Object.entries(st.cabinetColors || {})) {
    const p = parseKey(k);
    if (!p || p[0] < 0 || p[1] < 0 || p[0] >= cols || p[1] >= rows) continue;
    ctx.fillStyle = css(c);
    withRot(p[0], p[1], () => ctx.fillRect(...cell(p[0], p[1])));
  }
  const black = new Set(st.blackCabinets || []);
  for (const k of shapeOff(st)) black.add(k);
  ctx.fillStyle = "#000";
  for (const k of black) {
    const p = parseKey(k);
    if (p && p[0] >= 0 && p[1] >= 0 && p[0] < cols && p[1] < rows) ctx.fillRect(...cell(p[0], p[1]));
  }
  const corners = cornerList(st, black);
  for (const [c, r, o] of corners) {
    const [x, y, w, h] = cell(c, r), X = [x, x, x + w, x + w], Y = [y + h, y, y, y + h], cAng = rotA(c, r);
    if (cAng) {
      ctx.save();
      ctx.translate(x + w / 2, y + h / 2);
      ctx.rotate(cAng * Math.PI / 180);
      ctx.translate(-(x + w / 2), -(y + h / 2));
    }
    if (o >= 4) {
      const q = o - 4;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.ellipse(X[q], Y[q], w, h, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#000";
      ctx.fill("evenodd");
      ctx.beginPath();
      ctx.ellipse(X[q], Y[q], w, h, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "rgb(64,64,64)";
      ctx.lineWidth = Math.max(1, 2 * s);
      ctx.stroke();
      ctx.restore();
      if (cAng) ctx.restore();
      continue;
    }
    const a = (o + 1) % 4, b = (o + 2) % 4, d = (o + 3) % 4;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(X[a], Y[a]);
    ctx.lineTo(X[b], Y[b]);
    ctx.lineTo(X[d], Y[d]);
    ctx.closePath();
    ctx.fillStyle = "#000";
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(X[a], Y[a]);
    ctx.lineTo(X[d], Y[d]);
    ctx.strokeStyle = "rgb(64,64,64)";
    ctx.lineWidth = Math.max(1, 2 * s);
    ctx.stroke();
    ctx.restore();
    if (cAng) ctx.restore();
  }
  // подложка каше — только на холсте (не в экспорт): над кабинетами, под фигурами каше
  if (REF_ON_CANVAS) drawRefImage(ctx, st, s);
  {
    const sh = (st.cacheShapes || []).filter((c) => !c.inv && !c.frame), dim = st.cacheDim == null ? 45 : +st.cacheDim;
    if (sh.length && dim > 0) {
      ctx.save();
      for (const c of sh) {
        ctx.beginPath();
        ctx.rect(-1, -1, Wp + 2, Hp + 2);
        shapePath(ctx, c, c.x * s, c.y * s, c.w / 2 * s, c.h / 2 * s, true);
        ctx.clip("evenodd");
      }
      ctx.globalAlpha = Math.min(1, dim / 100);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, Wp, Hp);
      ctx.restore();
    }
    const din = (st.cacheShapes || []).filter((c) => c.inv && c.dimOnly && !c.frame);
    if (din.length && dim > 0) {
      ctx.save();
      ctx.beginPath();
      for (const c of din) shapePath(ctx, c, c.x * s, c.y * s, c.w / 2 * s, c.h / 2 * s, true);
      ctx.globalAlpha = Math.min(1, dim / 100);
      ctx.fillStyle = "#000";
      ctx.fill("nonzero");
      ctx.restore();
    }
  }
  ctx.fillStyle = "rgb(64,64,64)";
  const bw = Math.max(1, Math.round(2 * s));
  const ow = Math.max(1, Math.round(s));
  if (shifted) {
    // 2.0.150: при сдвиге рядов/столбцов рисуем сетку «ступеньками». Линии центрируем по границам,
    // чтобы у соседних кабинетов они совпадали в одну линию (та же толщина и яркость, что без сдвига),
    // а белым подсвечиваем только внешний контур крайних рядов/столбцов.
    const half = Math.floor(bw / 2);
    ctx.fillStyle = "rgb(64,64,64)";
    // убранные (чёрные) кабинеты — это «дыры»: сетку по ним не рисуем, а внешний контур их обведёт
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (black.has(key(c, r)) || rotA(c, r)) continue;
      const [x, y, w, h] = cell(c, r);
      ctx.fillRect(x - half, y, bw, h);
      ctx.fillRect(x + w - half, y, bw, h);
      ctx.fillRect(x, y - half, w, bw);
      ctx.fillRect(x, y + h - half, w, bw);
    }
    // внешний контур по «ступенчатому» силуэту: белым только открытые края (где нет соседнего кабинета).
    // Край может граничить сразу с несколькими кабинетами соседнего ряда/столбца (из-за сдвига),
    // поэтому вычитаем покрытие всех кабинетов, чей край лежит на этой же линии.
    ctx.fillStyle = "#fff";
    const cellAt = (c, r) => c < 0 || r < 0 || c >= cols || r >= rows ? null : cell(c, r);
    const EPS = Math.max(1, ow) + 0.5;
    const subAll = (a0, a1, covers) => {
      let segs = [[a0, a1]];
      for (const [b0, b1] of covers) {
        const next = [];
        for (const [s0, s1] of segs) {
          const o0 = Math.max(s0, b0), o1 = Math.min(s1, b1);
          if (o1 <= o0) { next.push([s0, s1]); continue; }
          if (o0 > s0) next.push([s0, o0]);
          if (o1 < s1) next.push([o1, s1]);
        }
        segs = next;
      }
      return segs;
    };
    // в силуэт берём только «живые» кабинеты — тогда белый контур обведёт и внешний край, и дыры от убранных
    const rects = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (!black.has(key(c, r)) && !rotA(c, r)) rects.push(cell(c, r));
    for (const [x, y, w, h] of rects) {
      // каждый край может граничить с любыми кабинетами (сдвиг у кабинетов личный), поэтому
      // вычитаем покрытие всех, чей противоположный край лежит на этой же линии и пересекается
      const leftCov = [], rightCov = [], topCov = [], botCov = [];
      for (const [x2, y2, w2, h2] of rects) {
        if (x2 === x && y2 === y && w2 === w && h2 === h) continue;
        if (Math.abs(x2 + w2 - x) <= EPS) leftCov.push([y2, y2 + h2]);
        if (Math.abs(x2 - (x + w)) <= EPS) rightCov.push([y2, y2 + h2]);
        if (Math.abs(y2 + h2 - y) <= EPS) topCov.push([x2, x2 + w2]);
        if (Math.abs(y2 - (y + h)) <= EPS) botCov.push([x2, x2 + w2]);
      }
      for (const [p0, p1] of subAll(y, y + h, leftCov)) ctx.fillRect(x, p0, ow, p1 - p0);
      for (const [p0, p1] of subAll(y, y + h, rightCov)) ctx.fillRect(x + w - ow, p0, ow, p1 - p0);
      for (const [p0, p1] of subAll(x, x + w, topCov)) ctx.fillRect(p0, y, p1 - p0, ow);
      for (const [p0, p1] of subAll(x, x + w, botCov)) ctx.fillRect(p0, y + h - ow, p1 - p0, ow);
    }
    // 2.0.174: повёрнутые кабинеты — отдельные «плитки» с белым контуром по всему краю
    if (rotated) for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (!rotA(c, r) || black.has(key(c, r))) continue;
      const [x, y, w, h] = cell(c, r);
      withRot(c, r, () => {
        ctx.fillStyle = "#fff";
        ctx.fillRect(x, y, w, ow);
        ctx.fillRect(x, y + h - ow, w, ow);
        ctx.fillRect(x, y, ow, h);
        ctx.fillRect(x + w - ow, y, ow, h);
      });
    }
  } else {
    for (let c = 1; c < cols; c++) ctx.fillRect(fx(xs[c]) - Math.floor(bw / 2), 0, bw, Hp);
    for (let r = 1; r < rows; r++) ctx.fillRect(0, fy(ys[r]) - Math.floor(bw / 2), Wp, bw);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, Wp, ow);
    ctx.fillRect(0, Hp - ow, Wp, ow);
    ctx.fillRect(0, 0, ow, Hp);
    ctx.fillRect(Wp - ow, 0, ow, Hp);
  }
  if (st.showPersistentContour !== false && !shifted) {
    const lw = Math.max(1, Math.round(2 * s));
    const edgeSet = new Set(st.borders || []);
    if (st.autoContour) {
      const off = (c, r) => c >= 0 && r >= 0 && c < cols && r < rows && black.has(key(c, r));
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        if (off(c, r)) continue;
        if (off(c - 1, r)) edgeSet.add("v:".concat(c, ",").concat(r));
        if (off(c + 1, r)) edgeSet.add("v:".concat(c + 1, ",").concat(r));
        if (off(c, r - 1)) edgeSet.add("h:".concat(c, ",").concat(r));
        if (off(c, r + 1)) edgeSet.add("h:".concat(c, ",").concat(r + 1));
      }
    }
    for (const k of edgeSet) {
      const [t, a] = k.split(":"), [u, v] = a.split(",").map(Number);
      if (t === "v" && u >= 0 && u <= cols && v >= 0 && v < rows) {
        const w = u === 0 || u === cols ? ow : lw, X = u === 0 ? 0 : u === cols ? Wp - w : fx(xs[u]) - Math.floor(w / 2), y0 = fy(ys[v + 1]), y1 = fy(ys[v]);
        ctx.fillRect(X, y0, w, y1 - y0);
      } else if (t === "h" && u >= 0 && u < cols && v >= 0 && v <= rows) {
        const w = v === 0 || v === rows ? ow : lw, Y = v === 0 ? Hp - w : v === rows ? 0 : fy(ys[v]) - Math.floor(w / 2), x0 = fx(xs[u]), x1 = fx(xs[u + 1]);
        ctx.fillRect(x0, Y, x1 - x0, w);
      }
    }
    {
      const cw = Math.max(1, Math.round((st.cacheLineW || 6) * s));
      const strokeIt = () => {
        ctx.save();
        ctx.globalAlpha = Math.max(0.05, Math.min(1, (st.cacheLineA == null ? 100 : +st.cacheLineA) / 100));
        ctx.strokeStyle = st.cacheLineColor || "#FFFFFF";
        ctx.lineWidth = cw;
        ctx.stroke();
        ctx.restore();
      };
      for (const c of st.cacheShapes || []) if (st.cacheLine !== false || c.frame) {
        shapePath(ctx, c, c.x * s, c.y * s, c.w / 2 * s - cw / 2, c.h / 2 * s - cw / 2);
        strokeIt();
        if (c.inv && !c.frame && !c.dimOnly) {
          const k = shapeOuterK(st, c, xs, ys, H);
          if (k > 1.0001) {
            shapePath(ctx, Object.assign({}, c, { w: c.w * k, h: c.h * k, r: (+c.r || 0) * k }), c.x * s, c.y * s, c.w * k / 2 * s + cw / 2, c.h * k / 2 * s + cw / 2);
            strokeIt();
          }
        }
      }
    }
    for (const ct of st.persistentContours || []) {
      if (!(ct.cols > 0 && ct.rows > 0)) continue;
      const ci = (v) => xs[Math.max(0, Math.min(cols, v))], ri = (v) => ys[Math.max(0, Math.min(rows, v))];
      const x0 = fx(ci(ct.col)), x1 = fx(ci(ct.col + ct.cols)), y0 = fy(ri(ct.row + ct.rows)), y1 = fy(ri(ct.row));
      const tw = y0 <= 0 ? ow : lw, bw2 = y1 >= Hp ? ow : lw, lw2 = x0 <= 0 ? ow : lw, rw = x1 >= Wp ? ow : lw;
      ctx.fillRect(x0, y0, x1 - x0, tw);
      ctx.fillRect(x0, y1 - bw2, x1 - x0, bw2);
      ctx.fillRect(x0, y0, lw2, y1 - y0);
      ctx.fillRect(x1 - rw, y0, rw, y1 - y0);
    }
  }
  if (guides.circle || guides.diag) {
    ctx.beginPath();
    if (guides.diag) {
      ctx.moveTo(0, 0);
      ctx.lineTo(Wp, Hp);
      ctx.moveTo(0, Hp);
      ctx.lineTo(Wp, 0);
    }
    if (guides.circle) {
      const d = Math.min(Wp, Hp);
      ctx.moveTo(Wp / 2 + d / 2, Hp / 2);
      ctx.arc(Wp / 2, Hp / 2, d / 2, 0, Math.PI * 2);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = Math.max(1, 2 * s);
    ctx.stroke();
  }
  const nsize = Math.max(+st.numSize > 0 ? 0.5 : 6, numberFont(st) * s);
  ctx.font = "".concat(nsize, "px ").concat(FONT);
  ctx.fillStyle = css(st.numberColor || DEF_NUM_COLOR);
  ctx.textBaseline = "alphabetic";
  const pos = clampI(st.numberPositionIndex, NUM_POS.length);
  const nm0 = measure("0", nsize), cornerAt = new Map(corners.map(([c, r, o]) => [key(c, r), o]));
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (black.has(key(c, r))) continue;
    const cW = (xs[c + 1] - xs[c]) * s, cH = (ys[r + 1] - ys[r]) * s, pad = Math.min(8 * s, Math.min(cW, cH) * 0.12);
    const label = cabLabel(st, c, r);
    let tw = ctx.measureText(label).width, nm = nm0, fsz = nsize;
    const fit = Math.min(cW * 0.86 / tw, cH * 0.86 / nm0.h, 1);
    if (fit < 1) {
      fsz = Math.max(+st.numSize > 0 ? 0.5 : 3, nsize * fit);
      ctx.font = "".concat(fsz, "px ").concat(FONT);
      tw = ctx.measureText(label).width;
      nm = measure("0", fsz);
    }
    const left = (xs[c] + sh.dx(c, r)) * s, top = (H - ys[r + 1] - sh.dy(c, r)) * s;
    let x = left + (cW - tw) / 2, y = top + (cH - nm.h) / 2;
    const o = cornerAt.get(key(c, r));
    let p = pos;
    if (o !== void 0 && pos !== CORNER_NUMPOS[o]) {
      p = -1;
      const q = o % 4, f = o >= 4 ? 4 / (3 * Math.PI) : 1 / 3;
      const gx = q >= 2 ? left + cW * (1 - f) : left + cW * f, gy = q === 1 || q === 2 ? top + cH * f : top + cH * (1 - f);
      x = gx - tw / 2;
      y = gy - nm.h / 2;
    }
    if (p === 1 || p === 2) x = left + pad;
    else if (p === 3 || p === 4) x = left + cW - tw - pad;
    if (p === 1 || p === 3) y = top + cH - nm.h - pad;
    else if (p === 2 || p === 4) y = top + pad;
    if (fit < 1) {
      x = Math.max(left + (cW - tw) / 2, Math.min(x, left + cW - tw));
    }
    {
      const nAng = rotA(c, r);
      if (nAng) {
        ctx.save();
        ctx.translate(left + cW / 2, top + cH / 2);
        ctx.rotate(nAng * Math.PI / 180);
        ctx.translate(-(left + cW / 2), -(top + cH / 2));
        ctx.fillText(label, x, y + nm.asc);
        ctx.restore();
      } else ctx.fillText(label, x, y + nm.asc);
    }
    if (fsz !== nsize) ctx.font = "".concat(nsize, "px ").concat(FONT);
  }
  ctx.fillStyle = st.titleColor || "#fff";
  const lines = titleLines(st, s);
  drawBlock(ctx, lines, TITLE_GAP * s, W * s / 2 + (st.titleOffsetX || 0) * s, H * s / 2 - (st.titleOffsetY || 0) * s, titleRot(st));
  for (const it of st.extraLabels || []) {
    const fs = Math.min(900, Math.max(6, +it.size || 120)) * s;
    ctx.fillStyle = it.color || "#fff";
    drawBlock(ctx, [[it.text || "Текст", fs]], 0, W * s / 2 + (+it.x || 0) * s, H * s / 2 - (+it.y || 0) * s, +it.rotation || 0);
  }
  drawInfo(ctx, st, s);
  ctx.restore();
}
function barY(ctx, st, W, H, bx, bh) {
  const y = H * 0.78;
  if (!st.showInfo) return y;
  const r = infoRect(ctx, st, 1, W, H);
  if (r.x + r.w <= bx || y >= r.y + r.h || y + bh * 1.5 <= r.y) return y;
  return Math.max(H * 0.05, r.y - bh * 1.5 - Math.max(8, H * 0.015));
}
function infoRect(ctx, st, s, W, H) {
  const lines = infoLines(st), fs = Math.max(10, Math.min(72, Math.min(W, H) * 0.026)) * s, pad = fs * 0.6, lh = fs * 1.3;
  ctx.save();
  ctx.font = "".concat(fs, "px ").concat(FONT);
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + pad * 2;
  ctx.restore();
  const h = lines.length * lh + pad * 2 - (lh - fs);
  return { x: fs * 0.8, y: H * s - fs * 0.8 - h, w, h, fs, pad, lh, lines };
}
function infoLines(st) {
  const [W, H] = dims(st), [pw, ph, known] = physM(st), m = (v) => compactM(v);
  if (st.kind === "tv") {
    const g = tvGeom(st), out = ["Панель: ".concat(g.pw, "×").concat(g.ph, " px").concat(+g.T.rot ? " · вертикально" : "").concat(g.T.diag > 0 ? " · ".concat(g.T.diag, "″") : ""), "Панелей: ".concat(g.nx, "×").concat(g.ny), "Разрешение: ".concat(W, "×").concat(H, " px")];
    if (known) out.push("Физический размер: ".concat(m(pw), "×").concat(m(ph), " м"));
    return out;
  }
  if (st.kind === "vol") return volInfoLines(st);
  if (st.kind === "ring") return ringInfoLines(st);
  if (st.kind === "tube") {
    const g = tubeGeom(st);
    return ["Трубка: ".concat(g.len, " м · 1×").concat(g.eh, " px"), "Трубок: ".concat(g.cols, " × ").concat(g.rows, " (шаг ").concat(g.step, " см)"), "Разрешение: ".concat(W, "×").concat(H, " px"), "Физический размер: ".concat(m(pw), "×").concat(m(ph), " м")];
  }
  if (st.kind === "pix") {
    const g = pixGeom(st), out = ["Элемент: ".concat(g.ew, "×").concat(g.eh, " px").concat(g.X.cmw > 0 ? " · ".concat(g.X.cmw, "×").concat(g.X.cmh, " см") : ""), "Элементов: ".concat(g.cols, "×").concat(g.rows, " (всего ").concat(g.cols * g.rows, ")").concat(g.sx > g.X.cmw || g.sy > g.X.cmh ? " · между элементами ".concat(+(g.sx - g.X.cmw).toFixed(2), "×").concat(+(g.sy - g.X.cmh).toFixed(2), " см (шаг ").concat(+g.sx.toFixed(2), "×").concat(+g.sy.toFixed(2), ")") : ""), "Разрешение: ".concat(W, "×").concat(H, " px").concat(g.phys ? " (по размеру: элемент ".concat(g.ewp, "×").concat(g.ehp, " px, промежуток ").concat(g.gxp, "×").concat(g.gyp, " px)") : " (по пикселям, вплотную)").concat(g.k > 1 ? " · масштаб ×".concat(g.k) : "")];
    if (known) out.push("Физический размер: ".concat(m(pw), "×").concat(m(ph), " м"));
    return out;
  }
  if (st.kind === "proj") {
    const g = projGeom(st), P = g.P, rot = +P.rot || 0;
    if (g.dome) return ["Купол (domemaster): ".concat(W, "×").concat(H, " px"), "Угол обзора: ".concat(+P.fov || 180, "°"), "Шаг: азимут ".concat(+P.az || 10, "° · высота ").concat(+P.el || 10, "°")];
    const out = [
      "Проектор: ".concat(P.pw, "×").concat(P.ph, " px").concat(rot ? " · портрет" : ""),
      "Проекторов: ".concat(g.nx, "×").concat(g.ny)
    ];
    if (g.nx > 1 || g.ny > 1) out.push("Перекрытие: ".concat(g.nx > 1 ? "".concat(+P.ox || 0, "% (").concat(g.ovx, " px)") : "—", " / ").concat(g.ny > 1 ? "".concat(+P.oy || 0, "% (").concat(g.ovy, " px)") : "—"));
    out.push("Разрешение: ".concat(W, "×").concat(H, " px"));
    if (known) out.push("Физический размер: ".concat(m(pw), "×").concat(m(ph), " м"));
    return out;
  }
  const t = TYPES.find((t2) => t2[0] === st.cabinetTypeName), black = /* @__PURE__ */ new Set([...st.blackCabinets || [], ...shapeOff(st)]);
  const total = st.cabCols * st.cabRows;
  let nb = 0;
  for (const k of black) {
    const p = parseKey(k);
    if (p && p[0] < st.cabCols && p[1] < st.cabRows) nb++;
  }
  return [
    "Кабинет: ".concat(t ? t[3] + "×" + t[4] + " мм, " : "").concat(st.cabWpx, "×").concat(st.cabHpx, " px"),
    "Разрешение экрана: ".concat(W, "×").concat(H, " px"),
    "Физический размер: ".concat(m(pw), "×").concat(m(ph), " м").concat(known ? "" : " (условно)"),
    "Кабинетов всего: ".concat(total - nb)
  ];
}
function drawInfo(ctx, st, s) {
  if (!st.showInfo || st.kind === "vol") return; // 2.0.73: у волюметрика информация — в ТЗ, не на картинке
  const [W, H] = dims(st), { x, y, w, h, fs, pad, lh, lines } = infoRect(ctx, st, s, W, H);
  ctx.save();
  ctx.font = "".concat(fs, "px ").concat(FONT);
  ctx.textBaseline = "top";
  ctx.fillStyle = "rgba(0,0,0,0.72)";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#fff";
  lines.forEach((l, i) => ctx.fillText(l, x + pad, y + pad + i * lh));
  ctx.restore();
}
function drawBlock(ctx, lines, gap, cx, cy, deg) {
  const b = blockSize(lines, gap);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-deg * Math.PI / 180);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  let y = -b.h / 2;
  lines.forEach(([t, sz], i) => {
    ctx.font = "".concat(sz, "px ").concat(FONT);
    if (t) ctx.fillText(t, -b.ms[i].w / 2, y + b.ms[i].asc);
    y += b.ms[i].h + gap;
  });
  ctx.restore();
}
function cornerList(st, black) {
  const out = [];
  for (const [k, v] of Object.entries(st.cornerCabinets || {})) {
    const p = parseKey(k), o = +v;
    if (!p || black.has(k) || !(o >= 0 && o <= 7) || p[0] < 0 || p[1] < 0 || p[0] >= st.cabCols || p[1] >= st.cabRows) continue;
    out.push([p[0], p[1], o | 0]);
  }
  return out;
}
let project = { name: "Проект", screens: [defaultScreen()], cur: 0, guides: { circle: true, diag: true }, ...freshFieldState() };
// 2.0.174: направляющие (круг, линии через центр) — у каждой маски свои; пока не менялись, берутся общие из проекта
const guidesOf = (st) => st && st.guides && typeof st.guides === "object" ? st.guides : project.guides;
const S = () => project.screens[project.cur];
const ui = { shapeType: "circle", bezDraw: null, bezHover: null, bezSel: -1, selShape: -1, corner: 0, selected: /* @__PURE__ */ new Set(), anchor: null, textMode: -1, selLabel: -1, zoom: 1, panX: 0, panY: 0, tool: "select", mod: false, hover: null, paint: { ...DEF_PAINT }, volView: { z: 1, x: 0, y: 0 }, ringSel: /* @__PURE__ */ new Set(), ringPri: "", ringCur: 0 };
let downloads = null;
// Подложки каше: картинки хранятся отдельно (id → dataURL), в экране — только привязка.
// Так история отмены не копирует тяжёлые картинки; в файл проекта и автосохранение они попадают через refImages.
const REF_IMGS = {}, refImgEls = {};
function refImg(id) {
  if (!id || !REF_IMGS[id]) return null;
  let im = refImgEls[id];
  if (!im || im.dataset.src !== id) {
    im = new Image();
    im.dataset.src = id;
    im.onload = () => {
      requestDraw();
      syncShapes();
    };
    im.src = REF_IMGS[id];
    refImgEls[id] = im;
  }
  return im.complete && im.naturalWidth ? im : null;
}
// Прямоугольник подложки в пикселях маски: весь экран или выделенные кабинеты (по номерам колонок/рядов — следует за сеткой)
function refRect(st) {
  const R = st.cacheRef, [W, H] = dims(st);
  if (R.fit === "free") return [R.x, R.y, Math.max(10, R.w), Math.max(10, R.h)];
  let x0 = 0, y0 = 0, x1 = W, y1 = H;
  if (R.fit === "cab" && (!st.kind || st.kind === "led")) {
    const { xs, ys } = grid(st), cl = (v, a, b) => Math.max(a, Math.min(b, v | 0));
    const c0 = cl(R.c0, 0, st.cabCols - 1), c1 = cl(R.c1, c0, st.cabCols - 1), r0 = cl(R.r0, 0, st.cabRows - 1), r1 = cl(R.r1, r0, st.cabRows - 1);
    x0 = xs[c0];
    x1 = xs[c1 + 1];
    y0 = H - ys[r1 + 1];
    y1 = H - ys[r0];
  }
  const im = R.keep ? refImg(R.id) : null;
  if (im) {
    const k = Math.min((x1 - x0) / im.naturalWidth, (y1 - y0) / im.naturalHeight), w = im.naturalWidth * k, h = im.naturalHeight * k;
    x0 = (x0 + x1 - w) / 2;
    y0 = (y0 + y1 - h) / 2;
    return [x0, y0, w, h];
  }
  return [x0, y0, x1 - x0, y1 - y0];
}
// Флаг: drawMask рисует для холста (подложка видна), а не для экспорта
let REF_ON_CANVAS = false;
function drawRefImage(ctx, st, s) {
  const R = st.cacheRef;
  if (!R || R.show === false || st.kind && st.kind !== "led" && st.kind !== "proj" && st.kind !== "ring") return;
  const im = refImg(R.id);
  if (!im) return;
  const [x, y, w, h] = refRect(st);
  ctx.save();
  ctx.globalAlpha = (R.a == null ? 50 : R.a) / 100;
  ctx.drawImage(im, x * s, y * s, w * s, h * s);
  ctx.restore();
}
function refUsed() {
  const out = {};
  for (const st of project.screens) if (st.cacheRef && REF_IMGS[st.cacheRef.id]) out[st.cacheRef.id] = REF_IMGS[st.cacheRef.id];
  return out;
}
function normalizeScreen(d) {
  var _a;
  const st = defaultScreen();
  if (!d || typeof d !== "object") return st;
  for (const k of ["cabWpx", "cabHpx", "cabCols", "cabRows"]) st[k] = Math.max(1, pint(d[k], st[k]));
  st.name = String((_a = d.name) != null ? _a : st.name);
  st.file = typeof d.file === "string" ? d.file : "";
  if (typeof d.cabinetTypeName === "string") st.cabinetTypeName = d.cabinetTypeName === "большой  NIC - (172x86)" ? "StarColor 1.8 - (172x86)" : d.cabinetTypeName; // 2.0.41: переименован
  else {
    const t = TYPES.find((t2) => t2[1] === st.cabWpx && t2[2] === st.cabHpx);
    st.cabinetTypeName = t ? t[0] : "";
  }
  for (const k of ["pixelColor", "numberColor"]) if (d[k] && typeof d[k] === "object") st[k] = col(+d[k].r || 0, +d[k].g || 0, +d[k].b || 0, d[k].a == null ? 1 : +d[k].a);
  st.inscriptionIndex = clampI(d.inscriptionIndex, INSC.length);
  st.numSize = +d.numSize > 0 ? Math.max(1, Math.min(1000, Math.round(+d.numSize))) : 0;
  st.rotationIndex = clampI(d.rotationIndex, 4);
  st.numberFormatIndex = clampI(d.numberFormatIndex, NUM_FORMATS.length);
  st.numberOriginIndex = clampI(d.numberOriginIndex, NUM_ORIGINS.length);
  st.numberPositionIndex = clampI(d.numberPositionIndex, NUM_POS.length);
  st.line1Enabled = d.line1Enabled == null ? true : !!d.line1Enabled;
  st.line2Enabled = d.line2Enabled == null ? true : !!d.line2Enabled;
  st.line3Enabled = d.line3Enabled == null ? false : !!d.line3Enabled;
  st.blackCabinets = (Array.isArray(d.blackCabinets) ? d.blackCabinets : []).map(String).filter(parseKey);
  if (d.guides && typeof d.guides === "object") st.guides = { circle: d.guides.circle !== false, diag: d.guides.diag !== false };
  // 2.0.173: группы кабинетов LED — выбор одного выбирает всю группу
  st.cabGroups = (Array.isArray(d.cabGroups) ? d.cabGroups : []).map((a) => Array.isArray(a) ? [...new Set(a.map(String).filter(parseKey))] : []).filter((a) => a.length > 1);
  // 2.0.174: поворот отдельных кабинетов LED — cabRot["c,r"] = угол в градусах (до сотых), плюс — по часовой
  st.cabRot = {};
  if (d.cabRot && typeof d.cabRot === "object") for (const [k, v] of Object.entries(d.cabRot)) {
    const a = Math.round((((+v || 0) % 360) + 540) % 360 * 100 - 18000) / 100;
    if (parseKey(String(k).trim()) && a !== 0 && isFinite(a)) st.cabRot[String(k).trim()] = a;
  }
  st.cabinetColors = {};
  if (d.cabinetColors && typeof d.cabinetColors === "object") {
    for (const [k, v] of Object.entries(d.cabinetColors)) if (parseKey(k) && v && typeof v === "object") st.cabinetColors[k] = col(+v.r || 0, +v.g || 0, +v.b || 0, v.a == null ? 1 : +v.a);
  }
  st.extraLabels = (Array.isArray(d.extraLabels) ? d.extraLabels : []).filter((x) => x && typeof x === "object").map((x) => {
    var _a2;
    return { text: String((_a2 = x.text) != null ? _a2 : "Текст"), size: +x.size || 120, x: +x.x || 0, y: +x.y || 0, rotation: +x.rotation || 0, ...(typeof x.color === "string" && /^#[0-9a-f]{6}$/i.test(x.color) ? { color: x.color.toUpperCase() } : {}) };
  });
  st.titleOffsetX = +d.titleOffsetX || 0;
  st.textSets = {};
  if (d.textSets && typeof d.textSets === "object") for (const k of ["pix", "main"]) {
    const q = d.textSets[k];
    if (q && typeof q === "object") st.textSets[k] = { l1: !!q.l1, l2: !!q.l2, l3: !!q.l3, ox: +q.ox || 0, oy: +q.oy || 0 };
  }
  st.titleOffsetY = +d.titleOffsetY || 0;
  st.titleColor = typeof d.titleColor === "string" && /^#[0-9a-f]{6}$/i.test(d.titleColor) ? d.titleColor.toUpperCase() : null; // 2.0.97: цвет основного текста (null — как в режиме)
  st.persistentContours = (Array.isArray(d.persistentContours) ? d.persistentContours : []).map((c) => ({ col: pint(c.col, 0), row: pint(c.row, 0), cols: pint(c.cols, 0), rows: pint(c.rows, 0) })).filter((c) => c.cols > 0 && c.rows > 0);
  st.showPersistentContour = d.showPersistentContour == null ? true : !!d.showPersistentContour;
  st.borders = (Array.isArray(d.borders) ? d.borders : []).map(String).filter((k) => /^[vh]:\d+,\d+$/.test(k));
  st.showInfo = !!d.showInfo;
  st.autoContour = !!d.autoContour;
  st.cacheShapes = (Array.isArray(d.cacheShapes) ? d.cacheShapes : []).filter((x) => x && isFinite(+x.x) && isFinite(+x.y) && (+x.d > 0 || +x.w > 0 && +x.h > 0)).map((x) => ({ x: +x.x, y: +x.y, w: +x.w > 0 ? +x.w : +x.d, h: +x.h > 0 ? +x.h : +x.d, lock: x.lock == null ? true : !!x.lock, inv: !!x.inv, frame: !!x.frame, fa: Math.max(0, Math.min(100, +x.fa || 0)), fc: typeof x.fc === "string" && /^#[0-9a-f]{6}$/i.test(x.fc) ? x.fc.toUpperCase() : "#FF0000", dimOnly: !!x.dimOnly, t: x.t === "circle" || x.t == null ? "circle" : x.t === "trap" || x.t === "pent" || x.t === "bez" && bezLoad(x.pts) ? x.t : "round", rot: normRot(+x.rot || 0), ...x.t === "bez" ? { pts: bezLoad(x.pts) } : {}, tb: x.tb == null ? 60 : Math.max(5, Math.min(100, +x.tb || 60)), sk: Math.max(-100, Math.min(100, +x.sk || 0)), flip: !!x.flip, r: x.t === "rect" ? 0 : +x.r >= 0 && x.r !== "" && x.r != null ? +x.r : Math.round(Math.min(+x.w || +x.d || 0, +x.h || +x.d || 0) * 0.2) }));
  {
    const R = d.cacheRef;
    st.cacheRef = R && typeof R === "object" && typeof R.id === "string" && R.id ? { id: R.id, fit: R.fit === "cab" || R.fit === "free" ? R.fit : "screen", x: +R.x || 0, y: +R.y || 0, w: Math.max(10, +R.w || 100), h: Math.max(10, +R.h || 100), c0: pint(R.c0, 0), c1: pint(R.c1, 0), r0: pint(R.r0, 0), r1: pint(R.r1, 0), a: Math.max(5, Math.min(100, R.a == null ? 50 : +R.a || 50)), show: R.show !== false, keep: !!R.keep } : null;
  }
  st.cacheLine = d.cacheLine == null ? true : !!d.cacheLine;
  st.cacheLineW = Math.max(1, Math.min(200, pint(d.cacheLineW, 6)));
  st.cacheDim = d.cacheDim == null ? 45 : Math.max(0, Math.min(100, +d.cacheDim || 0));
  st.cacheLineA = d.cacheLineA == null ? 100 : Math.max(5, Math.min(100, +d.cacheLineA || 100));
  st.cacheLineColor = typeof d.cacheLineColor === "string" && /^#[0-9a-f]{6}$/i.test(d.cacheLineColor) ? d.cacheLineColor.toUpperCase() : "#FFFFFF";
  st.rotDeg = d.rotDeg != null && isFinite(+d.rotDeg) ? normDeg(+d.rotDeg) : ROT_DEG[clampI(d.rotationIndex, 4)];
  st.uid = typeof d.uid === "string" && d.uid ? d.uid : newUid();
  st.cornerCabinets = {};
  if (d.cornerCabinets && typeof d.cornerCabinets === "object") for (const [k, v] of Object.entries(d.cornerCabinets)) {
    const o = pint(v, -1);
    if (parseKey(k) && o >= 0 && o <= 7) st.cornerCabinets[k] = o;
  }
  st.kind = ["proj", "tv", "pix", "tube", "vol", "ring"].includes(d.kind) ? d.kind : "led";
  st.vol = volNorm(d.vol);
  if (d.ring || st.kind === "ring") st.ring = ringNorm(d.ring);
  {
    const T = defTube(), q = d.tube && typeof d.tube === "object" ? d.tube : {};
    T.len = +q.len === 2 ? 2 : 1;
    T.px = [12, 24, 48].includes(+q.px) ? +q.px : 24 * T.len;
    for (const k of ["wm", "hm", "step"]) if (q[k] != null && isFinite(+q[k])) T[k] = Math.max(0, +q[k]);
    if (!(T.step > 0)) T.step = 25;
    if (q.shade != null) T.shade = !!q.shade;
    st.tube = T;
  }
  {
    const T = defTV(), q = d.tv && typeof d.tv === "object" ? d.tv : {};
    for (const k of ["pw", "ph", "nx", "ny"]) if (q[k] != null) T[k] = Math.max(1, pint(q[k], T[k]));
    T.rot = +q.rot ? 90 : 0;
    if (q.diag != null) T.diag = Math.max(0, Math.min(300, +q.diag || 0));
    if (typeof q.label === "string") T.label = q.label.slice(0, 40);
    for (const k of ["bars", "grid", "safe", "corner"]) if (q[k] != null) T[k] = !!q[k];
    keepRest(T, q);
    st.tv = T;
  }
  {
    const X = defPix(), q = d.pix && typeof d.pix === "object" ? d.pix : {};
    for (const k of ["ew", "eh", "cols", "rows"]) if (q[k] != null) X[k] = Math.max(1, pint(q[k], X[k]));
    for (const k of ["cmw", "cmh", "gx", "gy"]) if (q[k] != null && isFinite(+q[k])) X[k] = Math.max(0, +q[k]);
    // проекты до 2.0.25 хранили шаг (sx/sy, от начала элемента до начала следующего)
    if (q.gx == null && q.sx != null && isFinite(+q.sx)) X.gx = Math.max(0, +q.sx - X.cmw);
    if (q.gy == null && q.sy != null && isFinite(+q.sy)) X.gy = Math.max(0, +q.sy - X.cmh);
    for (const k of ["nums", "shade", "phys", "scaleOn"]) if (q[k] != null) X[k] = !!q[k];
    if (q.scale != null) X.scale = q.scale === "cm" ? "cm" : Math.max(1, Math.min(20, pint(q.scale, 2)));
    keepRest(X, q);
    st.pix = X;
  }
  if (st.kind === "tube") {
    const g = tubeGeom(st);
    st.kind = "pix";
    Object.assign(st.pix, { ew: 1, eh: g.eh, cmw: 3, cmh: g.len * 100, gx: Math.max(0, g.step - 3), gy: 0, cols: g.cols, rows: g.rows, phys: false, nums: false, shade: g.T.shade !== false });
  }
  {
    const P = defProj(), q = d.proj && typeof d.proj === "object" ? d.proj : {};
    for (const k of ["pw", "ph", "nx", "ny", "grid"]) if (q[k] != null) P[k] = Math.max(1, pint(q[k], P[k]));
    for (const k of ["ox", "oy", "wm", "cw", "ch"]) if (q[k] != null && isFinite(+q[k])) P[k] = Math.max(0, +q[k]);
    P.rot = [-90, 0, 90].includes(+q.rot) ? +q.rot : 0;
    for (const k of ["bg", "line", "text"]) if (typeof q[k] === "string" && /^#[0-9a-f]{6}$/i.test(q[k])) P[k] = q[k].toUpperCase();
    for (const k of ["zones", "frames", "nums", "circles", "cells", "hatch", "bar", "invert", "used", "dminor", "dlabels", "dsides", "autoRot", "arLock"]) if (q[k] != null) P[k] = !!q[k];
    P.mode = q.mode === "dome" ? "dome" : "grid";
    for (const [k, lo, hi] of [["dome", 256, 16384], ["fov", 60, 360], ["az", 1, 90], ["el", 1, 45]]) if (q[k] != null && isFinite(+q[k])) P[k] = Math.max(lo, Math.min(hi, Math.round(+q[k])));
    if (d.kind === "proj") P.used = true;
    // 2.0.114: эти настройки раньше терялись при открытии проекта
    if (q.circleGuide != null) P.circleGuide = !!q.circleGuide;
    if (q.numsN != null && isFinite(+q.numsN)) P.numsN = Math.max(1, Math.round(+q.numsN));
    keepRest(P, q);
    st.proj = P;
  }
  for (const f of ["shapedCols", "shapedRows"]) {
    st[f] = {};
    if (d[f] && typeof d[f] === "object") for (const [k, v] of Object.entries(d[f])) {
      const i = pint(k, -1);
      if (!(i >= 0 && String(i) === String(k).trim())) continue;
      if (typeof v === "string" && SHAPED[v]) {
        st[f][i] = v;
        continue;
      }
      const w = pint(v, 0);
      if (w > 0 && w <= 2e4) st[f][i] = w;
    }
  }
  // 2.0.150: личный сдвиг кабинетов cabShift["c,r"] = [dx, dy] в px (может быть отрицательным)
  st.cabShift = {};
  if (d.cabShift && typeof d.cabShift === "object") for (const [k, v] of Object.entries(d.cabShift)) {
    if (!/^\d+,\d+$/.test(String(k).trim()) || !Array.isArray(v)) continue;
    const dx = pint(v[0], 0), dy = pint(v[1], 0);
    if ((dx !== 0 || dy !== 0) && Math.abs(dx) <= 2e4 && Math.abs(dy) <= 2e4) st.cabShift[String(k).trim()] = [dx, dy];
  }
  keepRest(st, d);
  return st;
}
// 2.0.114: при открытии проекта сохраняем и те параметры из файла, которые проверка выше не знает
// (только простые значения: да/нет, числа, строки) — чтобы ничего не терялось
function keepRest(dst, src) {
  if (!src || typeof src !== "object") return dst;
  for (const [k, v] of Object.entries(src)) {
    if (k in dst || k === "field" || k.startsWith("_")) continue;
    if (typeof v === "boolean" || typeof v === "string" || typeof v === "number" && isFinite(v)) dst[k] = v;
  }
  return dst;
}
const $ = (id) => document.getElementById(id);
const fillSelect = (el, items) => {
  // 2.0.35: список перестраивается только если пункты изменились (лишние перестройки сбрасывали прокрутку панели на Mac)
  const k = JSON.stringify(items);
  if (el.__items === k) return;
  el.__items = k;
  el.innerHTML = "";
  items.forEach((t, i) => {
    const o = document.createElement("option");
    o.value = i;
    o.textContent = t;
    el.appendChild(o);
  });
};
// 2.0.35 (как в рабочей Mac-сборке 2.0.16): панель трогаем, только когда текст действительно изменился.
// Строка статуса меняется при каждом движении мыши над холстом; если каждый раз переписывать её и поля панели,
// WebKit (Mac) перестраивает левую панель и её прокрутка уезжает вверх.
const setTxt = (el, t) => {
  t = String(t);
  if (el && el.textContent !== t) el.textContent = t;
};
const setVal = (el, v) => {
  v = String(v);
  if (el && el.value !== v) el.value = v;
};
const setHtml = (el, h) => {
  if (el && el.__h !== h) {
    el.__h = h;
    el.innerHTML = h;
  }
};
let statusTimer = 0;
function status(msg, toast = false) {
  const stEl = $("status");
  if (stEl.__m !== msg) {
    stEl.__m = msg;
    stEl.textContent = msg;
    stEl.title = msg;
  }
  if (toast) {
    const t = $("toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => t.hidden = true, 2600);
  }
}
function syncUI() {
  applyMode();
  const st = S();
  syncShapes();
  $("projName").value = project.name;
  if (document.activeElement !== $("projVer")) $("projVer").value = project.ver || "";
  // 2.0.130: в списке — только экраны текущего режима (LED / Маски или Волюметрик); value — номер в проекте
  {
    const el = $("screens"), list = project.screens.map((s, i) => [i, s]).filter(([, s]) => inMode(s)), k = JSON.stringify(list.map(([i, s]) => [i, s.name]));
    if (el.__items !== k) {
      el.__items = k;
      el.replaceChildren(...list.map(([i, s], n) => {
        const o = document.createElement("option");
        o.value = i;
        o.textContent = "".concat(n + 1, ". ").concat(s.name || "screen " + (i + 1));
        return o;
      }));
    }
  }
  $("screens").value = project.cur;
  if (window.screensUI) window.screensUI.sync();
  $("scrRenum").checked = project.renumber !== false;
  const ti = TYPES.findIndex((t) => t[0] === st.cabinetTypeName);
  $("cabType").value = ti >= 0 ? ti : "";
  if (window.cabTypeUI) window.cabTypeUI.sync();
  $("wpx").value = st.cabWpx;
  $("hpx").value = st.cabHpx;
  $("cols").value = st.cabCols;
  $("rows").value = st.cabRows;
  $("pixColor").value = hex(st.pixelColor);
  $("numColor").value = hex(st.numberColor);
  syncProjUI();
  $("paintColor").value = hex(ui.paint);
  $("inscSize").value = st.inscriptionIndex;
  $("rot").value = st.rotationIndex;
  $("rotVal").textContent = titleRot(st) + "°";
  $("showInfo").checked = !!st.showInfo;
  $("autoContour").checked = !!st.autoContour;
  $("scrName").value = st.name;
  $("line1").checked = st.line1Enabled !== false;
  $("line2").checked = st.line2Enabled;
  $("line3").checked = st.line3Enabled;
  $("numFmt").value = st.numberFormatIndex;
  $("numOrigin").value = st.numberOriginIndex;
  $("numPos").value = st.numberPositionIndex;
  $("gCircle").checked = st.kind === "proj" ? projCircle(st) : guidesOf(st).circle;
  $("gDiag").checked = guidesOf(st).diag;
  refreshFieldPanel();
  refreshTZPanel();
  refreshTextList();
  updateInfo(true);
}
function updateInfo(forcePhys) {
  const st = S(), [W, H] = dims(st), [pw, ph, known] = physM(st);
  {
    // 2.0.109: строка «Имя файла» — в конце «Экран и кабинеты», сразу перед «Данные»
    setTxt($("mFilePre"), "".concat(W, "x").concat(H, "-"));
    if (document.activeElement !== $("mFile")) setVal($("mFile"), maskFileTail(st));
  }
  setVal($("resText"), "".concat(W, "×").concat(H));
  setVal($("line3Text"), physText(st));
  if (forcePhys || document.activeElement !== $("physW")) setVal($("physW"), compactM(pw));
  if (forcePhys || document.activeElement !== $("physH")) setVal($("physH"), compactM(ph));
  setTxt($("pixRGB"), "RGB " + to255(st.pixelColor).join(","));
  setTxt($("numRGB"), "RGB " + to255(st.numberColor).join(","));
  syncNumSize(st);
  setHtml($("infoRes"), infoLines(st).map((l) => "<span>".concat(xmlEsc(l), "</span>")).join(""));
  setTxt($("infoPhys"), "");
  if (st.kind === "vol") {
    setTxt($("infoCab"), "");
    setTxt($("vlInfo"), VOL_MASK_UI ? "Итог: ".concat(W, "×").concat(H, " px · ").concat(physText(st)) : "Итог: ".concat(physText(st)));
    syncZoomLabel();
    return;
  }
  if (st.kind === "ring") {
    setTxt($("infoCab"), "");
    setTxt($("ringInfo"), "Итог: ".concat(W, "×").concat(H, " px · ").concat(physText(st)));
    syncZoomLabel();
    return;
  }
  if (st.kind === "tv" || st.kind === "pix") {
    setTxt($("infoCab"), "");
    setTxt($(st.kind === "tv" ? "tvInfo" : "pxInfo"), "Итог: ".concat(W, "×").concat(H, " px").concat(physM(st)[2] ? " · " + physText(st) : ""));
    syncZoomLabel();
    return;
  }
  if (st.kind === "proj") {
    const g = projGeom(st);
    setTxt($("infoCab"), "");
    setTxt($("pjInfo"), g.dome ? "Итог: ".concat(W, "×").concat(H, " px · купол ").concat(+g.P.fov || 180, "°") : g.canvas ? "Полотно ".concat(+g.P.cw, "×").concat(+g.P.ch, " м → ").concat(W, "×").concat(H, " px (").concat(Math.round(W / g.P.cw), " px/м)").concat(g.ovx ? " · перекрытие по горизонтали ".concat(g.ovx, " px (").concat(+(g.ovx / g.pw * 100).toFixed(1), "%)") : "").concat(g.ovy ? " · по вертикали ".concat(g.ovy, " px (").concat(+(g.ovy / g.ph * 100).toFixed(1), "%)") : "") : "Итог: ".concat(W, "×").concat(H, " px").concat(g.ovx ? " · перекрытие по горизонтали ".concat(g.ovx, " px") : "").concat(g.ovy ? " · по вертикали ".concat(g.ovy, " px") : ""));
    syncZoomLabel();
    return;
  }
  const total = st.cabCols * st.cabRows, nb = st.blackCabinets.length, nc = cornerList(st, new Set(st.blackCabinets)).length, ns = shapedCount(st);
  setTxt($("infoCab"), "Чёрные: ".concat(nb).concat(nc ? " • Угловые: ".concat(nc) : "").concat(ns ? " • Фигурных столбцов: ".concat(ns) : "", " • Выделено: ").concat(ui.selected.size));
  syncZoomLabel();
  if (typeof shapedLabels === "function") shapedLabels();
}
function changed(opts = {}) {
  updateInfo(opts.forcePhys);
  syncCabGroupBtns();
  syncTextControls();
  requestDraw();
  scheduleAutosave();
  scheduleStrip();
  if (opts.list) {
    // 2.0.130: в списке только экраны режима — пункт ищем по номеру экрана в проекте
    const el = $("screens"), o = [...el.options].find((q) => +q.value === project.cur);
    if (o) o.textContent = "".concat(o.index + 1, ". ").concat(S().name || "screen");
    el.__items = "";
    if (window.screensUI) window.screensUI.sync();
  }
}
function refreshTextList() {
  const st = S();
  if (ui.textMode >= st.extraLabels.length + 1) ui.textMode = -1;
  ui.selLabel = ui.textMode > 0 ? ui.textMode - 1 : -1;
  fillSelect($("activeText"), ["Текст не выбран", "Основной текст", ...st.extraLabels.map((l, i) => "Доп. ".concat(i + 1, ": ").concat(l.text || "Текст"))]);
  $("activeText").value = ui.textMode + 1;
  syncExtraControls();
}
const sizeIndexFor = (v) => v < 10 ? 1 : Math.min(INSC.length - 1, 2 + Math.max(0, Math.round((v - 10) / 10)));
const rotIndexFor = (d) => ({ "-90": 1, "90": 2, "180": 3, "-180": 3 })[String(Math.round(d))] || 0;
function syncExtraControls() {
  const it = S().extraLabels[ui.selLabel];
  if (it) {
    $("exSize").value = sizeIndexFor(it.size);
    $("exRot").value = rotIndexFor(it.rotation);
  }
  $("exRotVal").textContent = angS(it ? normDeg(+it.rotation || 0) : 0) + "°";
  for (const id of ["exRotCCW", "exRot0", "exRotCW"]) $(id).disabled = !it;
  syncTextControls();
}
// 2.0.38: общие «Размер / Поворот» для активного текста — дополнительного, если он выбран, иначе основного
// цвет текста «как в режиме» (по умолчанию): у проекции — цвет текста из «Фон / линии / текст», иначе белый
const txDefColor = (st) => st.kind === "proj" ? (st.proj && st.proj.invert ? "#000000" : st.proj && st.proj.text || "#FFFFFF") : "#FFFFFF";
// 2.0.110: несколько доп. текстов сразу — основной ui.selLabel + ui.selMore (Shift / Ctrl / ⌘ + щелчок)
ui.selMore = /* @__PURE__ */ new Set();
ui.selMoreUid = "";
function selExtras() {
  const st = S(), n = (st.extraLabels || []).length, out = [];
  if (ui.selLabel >= 0 && ui.selLabel < n) out.push(ui.selLabel);
  else return out;
  if (ui.selMoreUid === st.uid) for (const i of ui.selMore) if (i < n && !out.includes(i)) out.push(i);
  return out;
}
function clearSelMore() {
  ui.selMore.clear();
  ui.selMoreUid = S().uid;
}
function forSel(fn) {
  const ids = selExtras(), keep = ui.selLabel;
  for (const i of ids) {
    ui.selLabel = i;
    fn(i);
  }
  ui.selLabel = keep;
}
const txExtra = () => {
  const st = S();
  return ui.selLabel >= 0 && st.extraLabels && st.extraLabels[ui.selLabel] ? st.extraLabels[ui.selLabel] : null;
};
function syncTextControls() {
  if (!$("txSize")) return;
  const st = S(), it = txExtra();
  setVal($("txSize"), it ? sizeIndexFor(it.size) : st.inscriptionIndex);
  setTxt($("txRotVal"), angS(it ? normDeg(+it.rotation || 0) : titleRot(st)) + "°");
  {
    const c = (it ? it.color : st.titleColor) || txDefColor(st);
    setVal($("txColor"), c.toLowerCase());
    $("txColorReset").disabled = !(it ? it.color : st.titleColor);
  }
  const nSel = selExtras().length;
  if (it && nSel > 1) setTxt($("txWho"), "Настройки ниже — для ".concat(nSel, " доп. текстов (Shift / Ctrl + щелчок — добавить или убрать)"));
  else setTxt($("txWho"), it ? "Настройки ниже — для доп. текста ".concat(ui.selLabel + 1, ": «").concat(it.text || "Текст", "»") : "Настройки ниже — для основного текста");
}
function ask(title, text, value, okText = "OK", withInput = true) {
  return new Promise((res) => {
    $("modalTitle").textContent = title;
    $("modalText").textContent = text || "";
    $("modalText").hidden = !text;
    const inp = $("modalInput");
    inp.hidden = !withInput;
    inp.value = value || "";
    $("modalOk").textContent = okText;
    $("modalCancel").textContent = "Отмена";
    $("modalAlt").hidden = true;
    $("modal").hidden = false;
    if (withInput) setTimeout(() => {
      inp.focus();
      inp.select();
    }, 30);
    const done = (v) => {
      $("modal").hidden = true;
      $("modalOk").onclick = $("modalCancel").onclick = inp.onkeydown = null;
      res(v);
    };
    $("modalOk").onclick = () => done(withInput ? inp.value : true);
    $("modalCancel").onclick = () => done(null);
    inp.onkeydown = (e) => {
      if (e.key === "Enter") done(inp.value);
      if (e.key === "Escape") done(null);
    };
  });
}
const pv = $("pv"), pctx = pv.getContext("2d");
let L = null, drawQueued = false;
function requestDraw() {
  if (!drawQueued) {
    drawQueued = true;
    requestAnimationFrame(draw);
  }
}
function layout() {
  const st = S(), [W, H] = dims(st);
  const r = $("wrap").getBoundingClientRect(), cw = r.width, chh = r.height;
  const narrow = cw < 600, padX = narrow ? 16 : 40, padY = narrow ? 16 : 80;
  const scale = Math.min((cw - padX) / W, (chh - padY) / H) * ui.zoom;
  if (!(scale > 0)) return null;
  const gw = W * scale, gh = H * scale;
  return { st, W, H, scale, cw, ch: chh, ox: (cw - gw) / 2 + ui.panX, oy: (chh - gh) / 2 + ui.panY, gw, gh, G: grid(st) };
}
function fitStage(wh) {
  const wrap = $("wrap");
  if (window.matchMedia("(max-width: 820px)").matches) {
    const [W, H] = wh || dims(S()), w = wrap.clientWidth;
    const h = Math.round(Math.max(150, Math.min(window.innerHeight * 0.32, (w - 16) * H / W + 16)));
    if (wrap.style.height !== h + "px") wrap.style.height = h + "px";
  } else if (wrap.style.height) wrap.style.height = "";
}
function draw() {
  drawQueued = false;
  syncZoomLabel();
  if (ui.page === "mask") syncPaintUI();
  vol3dDraw();
  if (ui.page === "field") {
    drawField();
    return;
  }
  if (ui.page === "cut") {
    drawCut();
    return;
  }
  if (ui.page === "out") {
    drawOut();
    return;
  }
  if (ui.page === "tz") {
    drawTZ();
    return;
  }
  if (ui.page === "about") {
    fitStage([10, 9]);
    return;
  }
  fitStage();
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const r = $("wrap").getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
  if (pv.width !== w || pv.height !== h) {
    pv.width = w;
    pv.height = h;
  }
  pctx.setTransform(1, 0, 0, 1, 0, 0);
  pctx.fillStyle = (getComputedStyle(document.documentElement).getPropertyValue("--stage") || "#1d1f21").trim();
  pctx.fillRect(0, 0, w, h);
  L = layout();
  if (!L) return;
  pctx.setTransform(1, 0, 0, 1, Math.round(L.ox * dpr), Math.round(L.oy * dpr));
  REF_ON_CANVAS = true;
  try {
    drawMask(pctx, L.st, L.scale * dpr, guidesOf(L.st));
  } finally {
    REF_ON_CANVAS = false;
  }
  pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const st = L.st, s = L.scale, lw = Math.max(2, 2 * s);
  pctx.lineWidth = lw;
  pctx.strokeStyle = "#00f2ff";
  for (const k of ui.selected) {
    const p = parseKey(k);
    if (!p || p[0] >= st.cabCols || p[1] >= st.cabRows) continue;
    const [x, y, ww, hh] = cellRect(p[0], p[1]), ra = cabRotOf(st, p[0], p[1]);
    pctx.save();
    if (ra) {
      pctx.translate(x + ww / 2, y + hh / 2);
      pctx.rotate(ra * Math.PI / 180);
      pctx.translate(-(x + ww / 2), -(y + hh / 2));
    }
    pctx.strokeRect(x + lw / 2 + 1, y + lw / 2 + 1, ww - lw - 2, hh - lw - 2);
    pctx.restore();
  }
  if ((!st.kind || st.kind === "led") && (st.cabGroups || []).length) {
    // 2.0.173: кабинеты в группах помечены жёлтым пунктиром — только на экране, в PNG/ТЗ этого нет
    pctx.save();
    pctx.setLineDash([5, 4]);
    pctx.strokeStyle = "rgba(255,219,13,0.85)";
    pctx.lineWidth = Math.max(1, lw / 2);
    for (const g of st.cabGroups) for (const k of g) {
      const p = parseKey(k);
      if (!p || p[0] >= st.cabCols || p[1] >= st.cabRows) continue;
      const [x, y, ww, hh] = cellRect(p[0], p[1]), ra = cabRotOf(st, p[0], p[1]);
      pctx.save();
      if (ra) {
        pctx.translate(x + ww / 2, y + hh / 2);
        pctx.rotate(ra * Math.PI / 180);
        pctx.translate(-(x + ww / 2), -(y + hh / 2));
      }
      pctx.strokeRect(x + lw + 3, y + lw + 3, ww - 2 * lw - 6, hh - 2 * lw - 6);
      pctx.restore();
    }
    pctx.restore();
  }
  if (!st.kind || st.kind === "led") {
    // 2.0.174: зелёная точка поворота выбранного кабинета / группы (группа крутится как один блок)
    const ri = ledRotInfo(st);
    if (ri) {
      pctx.save();
      if (ri.group) {
        pctx.setLineDash([6, 5]);
        pctx.strokeStyle = "rgba(52,199,89,0.7)";
        pctx.lineWidth = 1;
        pctx.beginPath();
        pctx.arc(ri.px, ri.py, ri.r, 0, Math.PI * 2);
        pctx.stroke();
        pctx.setLineDash([]);
        pctx.fillStyle = "#34c759";
        pctx.beginPath();
        pctx.arc(ri.px, ri.py, 3, 0, Math.PI * 2);
        pctx.fill();
      }
      pctx.strokeStyle = "#34c759";
      pctx.lineWidth = 1.5;
      pctx.beginPath();
      pctx.moveTo(ri.bx, ri.by);
      pctx.lineTo(ri.hx, ri.hy);
      pctx.stroke();
      pctx.fillStyle = "#34c759";
      pctx.beginPath();
      pctx.arc(ri.hx, ri.hy, 6, 0, Math.PI * 2);
      pctx.fill();
      pctx.strokeStyle = "#000";
      pctx.lineWidth = 1;
      pctx.stroke();
      pctx.restore();
    }
  }
  if (ui.hover && ui.mod) {
    const [x, y, ww, hh] = cellRect(...ui.hover);
    pctx.strokeStyle = "#ffdb0d";
    pctx.strokeRect(x + lw / 2 + 1, y + lw / 2 + 1, ww - lw - 2, hh - lw - 2);
  }
  drawCachePreview(st, s);
  ringOverlay();
  if (ui.textHover && !act) {
    const th = textHoverAt(ui.textHover.f.cx, ui.textHover.f.cy, null), sel = ui.textHover.k === "t" ? ui.textMode === 0 : selExtras().includes(+ui.textHover.k.slice(1));
    if (th && th.k === ui.textHover.k && !sel) {
      const f = th.f;
      pctx.save();
      pctx.strokeStyle = "#ffdb0d";
      pctx.lineWidth = 1.5;
      pctx.setLineDash([4, 3]);
      pctx.strokeRect(f.cx - f.w / 2 - 6, f.cy - f.h / 2 - 4, f.w + 12, f.h + 8);
      pctx.restore();
    }
  }
  pctx.lineWidth = 2;
  pctx.strokeStyle = "#ffff00";
  if (ui.textMode === 0) {
    const f = titleFrame();
    pctx.strokeRect(f.cx - f.w / 2 - 8, f.cy - f.h / 2 - 6, f.w + 16, f.h + 12);
  }
  if (ui.selLabel >= 0 && st.extraLabels[ui.selLabel]) {
    for (const i of selExtras()) {
      const f = labelFrame(i);
      pctx.lineWidth = 1.5;
      pctx.strokeRect(f.cx - f.w / 2 - 4, f.cy - f.h / 2 - 3, f.w + 8, f.h + 6);
    }
  }
  if (ui.txGuides && ui.txGuides.length) {
    // линии привязки магнита текста (как на общем поле)
    const ox = L.ox + L.W * s / 2, oy = L.oy + L.H * s / 2;
    pctx.save();
    pctx.strokeStyle = "#ff2bd6";
    pctx.lineWidth = 1;
    pctx.setLineDash([6, 4]);
    pctx.beginPath();
    for (const g of ui.txGuides) {
      if (g.ax === "x") {
        const x = Math.round(ox + g.v * s) + 0.5;
        pctx.moveTo(x, L.oy);
        pctx.lineTo(x, L.oy + L.H * s);
      } else {
        const y = Math.round(oy - g.v * s) + 0.5;
        pctx.moveTo(L.ox, y);
        pctx.lineTo(L.ox + L.W * s, y);
      }
    }
    pctx.stroke();
    pctx.restore();
  }
}
// 2.0.38: магнит текста. Координаты текста — смещение центра от центра маски (x вправо, y вверх).
// Центр и края текста притягиваются к центру и краям экрана и к центрам и краям других текстов. Alt — без магнита.
function textBoxes(st) {
  const s = L.scale, out = [];
  if (titleLines(st, s).length) {
    const f = titleFrame();
    out.push({ i: -1, x: st.titleOffsetX, y: st.titleOffsetY, hw: f.w / 2 / s, hh: f.h / 2 / s });
  }
  (st.extraLabels || []).forEach((it, i) => {
    const f = labelFrame(i);
    out.push({ i, x: +it.x || 0, y: +it.y || 0, hw: f.w / 2 / s, hh: f.h / 2 / s });
  });
  return out;
}
function textSnap(self, x, y, e) {
  ui.txGuides = null;
  if (!L || ui.textMagnet === false || e && e.altKey) return [x, y];
  const st = S(), s = L.scale, all = textBoxes(st), me = all.find((b) => b.i === self);
  if (!me) return [x, y];
  const thr = 10 / s, guides = [];
  const axis = (v, half, ax) => {
    const W2 = (ax === "x" ? L.W : L.H) / 2, targets = [0, -W2, W2];
    for (const b of all) if (b.i !== self) {
      const c = ax === "x" ? b.x : b.y, hb = ax === "x" ? b.hw : b.hh;
      targets.push(c, c - hb, c + hb);
    }
    let best = null;
    for (const off of [0, -half, half]) for (const t of targets) {
      const d = t - (v + off);
      if (Math.abs(d) <= thr && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, t };
    }
    if (!best) return v;
    guides.push({ ax, v: best.t });
    return Math.round((v + best.d) * 100) / 100;
  };
  const nx = axis(x, me.hw, "x"), ny = axis(y, me.hh, "y");
  ui.txGuides = guides;
  return [nx, ny];
}
function cellRect(c, r) {
  const s = L.scale, { xs, ys } = L.G, st = L.st, sh = cabShift(st), dx = sh.dx(c, r), dy = sh.dy(c, r);
  return [L.ox + (xs[c] + dx) * s, L.oy + (L.H - ys[r + 1] - dy) * s, (xs[c + 1] - xs[c]) * s, (ys[r + 1] - ys[r]) * s];
}
function textHoverAt(x, y, e) {
  const st = S();
  if (!L || ui.bezDraw) return null;
  if (!(st.kind === "proj" || st.kind === "tv" || st.kind === "ring" || (!st.kind || st.kind === "led") && (ui.tool || "select") === "select" && !(e && e.altKey))) return null;
  const hitF = (f) => Math.abs(x - f.cx) <= f.w / 2 + 10 && Math.abs(y - f.cy) <= f.h / 2 + 10;
  for (let i = (st.extraLabels || []).length - 1; i >= 0; i--) if (hitF(labelFrame(i))) return { k: "l" + i, f: labelFrame(i) };
  if (titleLines(st, L.scale).length && hitF(titleFrame())) return { k: "t", f: titleFrame() };
  return null;
}
function titleFrame() {
  const st = L.st, s = L.scale, b = blockSize(titleLines(st, s), TITLE_GAP * s);
  const a = titleRot(st) * Math.PI / 180, cs = Math.abs(Math.cos(a)), sn = Math.abs(Math.sin(a));
  const w = b.w * cs + b.h * sn, h = b.w * sn + b.h * cs;
  return { cx: L.ox + L.W * s / 2 + st.titleOffsetX * s, cy: L.oy + L.H * s / 2 - st.titleOffsetY * s, w, h };
}
function labelFrame(i) {
  const st = L.st, s = L.scale, it = st.extraLabels[i], m = measure(it.text || "Текст", Math.max(6, it.size) * s);
  // 2.0.38: рамка с учётом любого поворота (как у основного текста) — для выбора мышью и магнита
  const a = (+it.rotation || 0) * Math.PI / 180, cs = Math.abs(Math.cos(a)), sn = Math.abs(Math.sin(a));
  const w = m.w * cs + m.h * sn, h = m.w * sn + m.h * cs;
  return { cx: L.ox + L.W * s / 2 + it.x * s, cy: L.oy + L.H * s / 2 - it.y * s, w, h };
}
function pointToCell(x, y) {
  if (!L || L.st.kind && L.st.kind !== "led") return null;
  const st = L.st, s = L.scale;
  if (x < L.ox || x >= L.ox + L.gw || y < L.oy || y >= L.oy + L.gh) return null;
  const px = (x - L.ox) / s, py = (L.oy + L.gh - y) / s, { xs, ys } = L.G;
  // 2.0.150: при сдвиге рядов/столбцов кабинет ищем перебором с учётом смещения
  if (hasShift(st) || hasRot(st)) {
    const sh = cabShift(st);
    // 2.0.174: повёрнутый кабинет проверяем в его системе координат; повёрнутые — сверху
    const inCab = (c, r) => {
      const dx = sh.dx(c, r), dy = sh.dy(c, r), a = cabRotOf(st, c, r) * Math.PI / 180;
      if (!a) return px >= xs[c] + dx && px < xs[c + 1] + dx && py >= ys[r] + dy && py < ys[r + 1] + dy;
      const cx = (xs[c] + xs[c + 1]) / 2 + dx, cy = (ys[r] + ys[r + 1]) / 2 + dy, vx = px - cx, vy = py - cy;
      const lx = Math.cos(a) * vx - Math.sin(a) * vy, ly = Math.sin(a) * vx + Math.cos(a) * vy;
      return Math.abs(lx) <= (xs[c + 1] - xs[c]) / 2 && Math.abs(ly) <= (ys[r + 1] - ys[r]) / 2;
    };
    if (hasRot(st)) for (const k of Object.keys(st.cabRot)) {
      const q = parseKey(k);
      if (q && q[0] < st.cabCols && q[1] < st.cabRows && inCab(q[0], q[1])) return [q[0], q[1]];
    }
    for (let r = st.cabRows - 1; r >= 0; r--) for (let c = st.cabCols - 1; c >= 0; c--) if (inCab(c, r)) return [c, r];
    return null;
  }
  let c = 0, r = 0;
  while (c < st.cabCols - 1 && px >= xs[c + 1]) c++;
  while (r < st.cabRows - 1 && py >= ys[r + 1]) r++;
  return c >= 0 && r >= 0 && c < st.cabCols && r < st.cabRows ? [c, r] : null;
}
const pointers = /* @__PURE__ */ new Map();
let act = null, pinch = null;
function local(e) {
  const r = pv.getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top];
}
// 2.0.174: поворот и перемещение кабинетов LED (отдельный кабинет — вокруг себя, группа — как один блок вокруг общего центра)
const cabValid = (st, k) => {
  const p = parseKey(k);
  return p && p[0] >= 0 && p[1] >= 0 && p[0] < st.cabCols && p[1] < st.cabRows ? p : null;
};
function cabCenterMask(st, c, r) {
  const { xs, ys } = grid(st), o = cof(st, c, r);
  return [(xs[c] + xs[c + 1]) / 2 + o[0], (ys[r] + ys[r + 1]) / 2 + o[1]];
}
function ledSelPri(st) {
  if (ui.selPri && ui.selected.has(ui.selPri) && cabValid(st, ui.selPri)) return ui.selPri;
  return [...ui.selected].find((k) => cabValid(st, k)) || "";
}
// точка поворота выбранного кабинета / группы на экране
function ledRotInfo(st) {
  if (!L || st.kind && st.kind !== "led" || !ui.selected.size) return null;
  const pk = ledSelPri(st);
  if (!pk) return null;
  const g = cabGroupOf(st, pk), mem = (g && g.length > 1 ? g : [pk]).filter((k) => cabValid(st, k));
  const cs = mem.map((k) => {
    const [c, r] = parseKey(k), [x, y, w, h] = cellRect(c, r);
    return [x + w / 2, y + h / 2, w, h];
  });
  const px = cs.reduce((a, q) => a + q[0], 0) / cs.length, py = cs.reduce((a, q) => a + q[1], 0) / cs.length;
  const r = mem.length > 1 ? Math.max(...cs.map((q) => Math.hypot(q[0] - px, q[1] - py) + Math.hypot(q[2], q[3]) / 2)) : cs[0][3] / 2;
  const [pc, pr] = parseKey(pk), ang = cabRotOf(st, pc, pr) * Math.PI / 180, d = r + 26;
  return { k: pk, mem, px, py, r, ang, hx: px + Math.sin(ang) * d, hy: py - Math.cos(ang) * d, bx: px + Math.sin(ang) * r, by: py - Math.cos(ang) * r, group: mem.length > 1 };
}
function ledRotateSel(delta, abs) {
  const st = S();
  if (st.kind && st.kind !== "led") return;
  const keys = [...ui.selected].filter((k) => cabValid(st, k));
  if (!keys.length) return status("Сначала выделите кабинеты на холсте", true);
  const pri = ledSelPri(st), pp = parseKey(pri);
  const gd = abs != null ? normCabRot(abs - cabRotOf(st, pp[0], pp[1])) : delta;
  st.cabRot = st.cabRot || {};
  st.cabShift = st.cabShift || {};
  const done = new Set(), setRot = (k, a) => {
    const v = normCabRot(a);
    if (v === 0) delete st.cabRot[k]; else st.cabRot[k] = v;
  };
  for (const k of keys) {
    if (done.has(k)) continue;
    const g = cabGroupOf(st, k);
    if (!g || g.length < 2) continue;
    // группа — один жёсткий блок: поворот вокруг общего центра
    const mem = g.filter((q) => cabValid(st, q)), cs = mem.map((q) => cabCenterMask(st, ...cabValid(st, q)));
    const px = cs.reduce((a, q) => a + q[0], 0) / cs.length, py = cs.reduce((a, q) => a + q[1], 0) / cs.length;
    const a = gd * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    mem.forEach((q, i) => {
      done.add(q);
      const [x, y] = cs[i], rx = x - px, ry = y - py, nx = px + ca * rx + sa * ry, ny = py - sa * rx + ca * ry, o = (st.cabShift[q] || [0, 0]).slice();
      o[0] = Math.round((o[0] + nx - x) * 100) / 100;
      o[1] = Math.round((o[1] + ny - y) * 100) / 100;
      if (o[0] === 0 && o[1] === 0) delete st.cabShift[q]; else st.cabShift[q] = o;
      setRot(q, (+st.cabRot[q] || 0) + gd);
    });
  }
  for (const k of keys) {
    if (done.has(k)) continue;
    done.add(k);
    setRot(k, abs != null ? abs : (+st.cabRot[k] || 0) + delta);
  }
  changed({ forcePhys: true });
}
// 2.0.177: положение выбранного кабинета (или группы) — реальный сдвиг в пикселях, можно ввести своё значение
function syncCabPosUI() {
  const st = S(), ix = $("cabPosX"), iy = $("cabPosY");
  if (!ix) return;
  const led = !st.kind || st.kind === "led", pk = led ? ledSelPri(st) : "", p = pk ? parseKey(pk) : null;
  ix.disabled = iy.disabled = !p;
  const o = p ? cof(st, p[0], p[1]) : null;
  if (document.activeElement !== ix) ix.value = o ? String(Math.round(o[0] * 100) / 100) : "";
  if (document.activeElement !== iy) iy.value = o ? String(Math.round(o[1] * 100) / 100) : "";
  // 2.0.178: то же положение в сантиметрах (по физическому размеру кабинета)
  const cx = $("cabPosCmX"), cy = $("cabPosCmY");
  if (cx) {
    const mm = led ? mmPerPx(st) : [0, 0], okCm = !!o && mm[0] > 0 && mm[1] > 0;
    cx.disabled = cy.disabled = !okCm;
    if (document.activeElement !== cx) cx.value = okCm ? String(Math.round(o[0] * mm[0]) / 10) : "";
    if (document.activeElement !== cy) cy.value = okCm ? String(Math.round(o[1] * mm[1]) / 10) : "";
  }
  const cnt = ui.selected.size;
  $("cabPosInfo").textContent = p ? "Сдвиг от сетки (px и см): ".concat(cnt > 1 ? "главный из " + cnt + " выбранных" : "кабинет " + pk, ". Ввод применяется ко всему выделению.") : "Выделите кабинет или группу.";
}
function setCabPos(axis, v) {
  const st = S();
  if (st.kind && st.kind !== "led") return;
  const pk = ledSelPri(st), p = pk ? parseKey(pk) : null;
  if (!p || !isFinite(v)) return;
  const cur = cof(st, p[0], p[1]), d = v - cur[axis === "x" ? 0 : 1];
  if (!d) return;
  st.cabShift = st.cabShift || {};
  for (const k of ui.selected) {
    if (!cabValid(st, k)) continue;
    const o = (st.cabShift[k] || [0, 0]).slice(), i = axis === "x" ? 0 : 1;
    o[i] = Math.round((o[i] + d) * 100) / 100;
    if (o[0] === 0 && o[1] === 0) delete st.cabShift[k]; else st.cabShift[k] = o;
  }
  changed({ forcePhys: true });
}
function syncCabRotUI() {
  syncCabPosUI();
  const st = S(), inp = $("cabRotIn");
  if (!inp) return;
  const led = !st.kind || st.kind === "led", pk = led ? ledSelPri(st) : "", p = pk ? parseKey(pk) : null;
  inp.disabled = !p;
  for (const id of ["cabRotCCW", "cabRotCW", "cabRot0"]) $(id).disabled = !p;
  if (document.activeElement !== inp) inp.value = p ? String(cabRotOf(st, p[0], p[1])) : "";
}
// 2.0.173: группы кабинетов LED — выбрали один, выбралась вся группа
const cabGroupOf = (st, k) => (st.cabGroups || []).find((a) => a.includes(k)) || null;
function expandCabGroups(st) {
  if (!st || !(st.cabGroups || []).length) return;
  for (const k of [...ui.selected]) {
    const g = cabGroupOf(st, k);
    if (g) for (const q of g) ui.selected.add(q);
  }
}
function selectRange(a, b) {
  ui.selected.clear();
  for (let r = Math.min(a[1], b[1]); r <= Math.max(a[1], b[1]); r++) for (let c = Math.min(a[0], b[0]); c <= Math.max(a[0], b[0]); c++) ui.selected.add(key(c, r));
  expandCabGroups(S());
}
pv.addEventListener("pointerdown", (e) => {
  if (ui.page && ui.page !== "mask") return;
  if (e.button === 2) return;
  pv.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, local(e));
  if (pointers.size === 2) {
    act = null;
    const [a, b] = [...pointers.values()];
    pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, z: ui.zoom, mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2, px: ui.panX, py: ui.panY };
    return;
  }
  if (pointers.size > 2) return;
  if (!L) return;
  const [x, y] = local(e), st = S();
  {
    const ra = refPointerDown(x, y);
    if (ra) {
      act = ra;
      return;
    }
  }
  if (ui.bezDraw) {
    // рисование своей фигуры: щелчок — точка, потянуть — изгиб, щелчок по первой точке — замкнуть
    const d = ui.bezDraw.pts, s0 = L.scale, ix = (x - L.ox) / s0, iy = (y - L.oy) / s0;
    if (d.length >= 3 && Math.hypot(L.ox + d[0].x * s0 - x, L.oy + d[0].y * s0 - y) <= 12) {
      bezFinish();
      return;
    }
    const q = { x: ix, y: iy, ix, iy, ox: ix, oy: iy, sm: false };
    d.push(q);
    act = { kind: "bezNew", q, x, y };
    requestDraw();
    syncShapes();
    return;
  }
  if (ui.selShape >= 0 && st.cacheShapes && st.cacheShapes[ui.selShape]) {
    const c = st.cacheShapes[ui.selShape], s0 = L.scale, cx = L.ox + c.x * s0, cy = L.oy + c.y * s0;
    if (c.t === "bez") {
      const hs = bezHandles(c, cx, cy, s0);
      const h = hs.find((q) => q.k !== "A" && Math.hypot(x - q.p[0], y - q.p[1]) <= 9) || hs.find((q) => q.k === "A" && Math.hypot(x - q.p[0], y - q.p[1]) <= 11);
      if (h) {
        ui.bezSel = h.i;
        act = { kind: "bez" + h.k, i: ui.selShape, j: h.i, x, y };
        syncShapes();
        requestDraw();
        return;
      }
    }
    for (const h of shapeHandles(c, cx, cy, s0)) {
      if (Math.hypot(x - h.p[0], y - h.p[1]) > (h.k === "size" ? 16 : 14)) continue;
      act = h.k === "size" ? { kind: "shapeSize", i: ui.selShape, m: h.m, x, y } : { kind: { rot: "shapeRot", top: "shapeTop", rad: "shapeRad" }[h.k], i: ui.selShape };
      return;
    }
    if (Math.hypot(x - cx, y - cy) <= 18) {
      act = { kind: "shape", i: ui.selShape, x, y };
      return;
    }
  }
  if (st.kind === "ring") {
    // поворот выбранного кабинета и растяжение кольца — раньше, чем выбор текста
    const gg0 = ringGeom(st), pri = gg0.list.find((m) => m.k === ui.ringPri && ui.ringSel.has(m.k));
    if (pri) {
      const [hx, hy] = ringRotHandle(pri, gg0);
      if (Math.hypot(x - hx, y - hy) <= 11) {
        act = { kind: "ringRot", k: pri.k };
        return;
      }
    }
  }
  // 2.0.81: в проекции и ТВ кабинетов нет — текст выбирается и двигается мышью сразу, без «Активного текста»
  // 2.0.94: и в LED (инструмент «Выбор») — щелчок по тексту выбирает его; Alt — выделять кабинеты под текстом
  if (st.kind === "proj" || st.kind === "tv" || st.kind === "ring" || (!st.kind || st.kind === "led") && (ui.tool || "select") === "select" && !e.altKey) {
    const hitF = (f) => Math.abs(x - f.cx) <= f.w / 2 + 10 && Math.abs(y - f.cy) <= f.h / 2 + 10;
    for (let i = (st.extraLabels || []).length - 1; i >= 0; i--) if (hitF(labelFrame(i))) {
      const sel = selExtras();
      if ((e.shiftKey || e.ctrlKey || e.metaKey) && sel.length) {
        // 2.0.110: Shift / Ctrl / ⌘ + щелчок — добавить текст к выбранным или убрать
        if (ui.selMoreUid !== st.uid) clearSelMore();
        if (i === ui.selLabel) {
          const rest = sel.filter((j) => j !== i);
          ui.selMore = new Set(rest.slice(1));
          ui.textMode = rest.length ? rest[0] + 1 : -1;
        } else if (ui.selMore.has(i)) ui.selMore.delete(i);
        else ui.selMore.add(i);
        refreshTextList();
        syncTextControls();
        requestDraw();
        return;
      }
      if (!sel.includes(i)) clearSelMore();
      else if (i !== ui.selLabel) {
        ui.selMore.add(ui.selLabel);
        ui.selMore.delete(i);
      }
      ui.textMode = i + 1;
      ui.selLabel = i;
      refreshTextList();
      syncTextControls();
      act = { kind: "label", i, x, y };
      requestDraw();
      return;
    }
    if (titleLines(st, L.scale).length && hitF(titleFrame())) {
      clearSelMore();
      ui.textMode = 0;
      ui.selLabel = -1;
      refreshTextList();
      syncTextControls();
      act = { kind: "title", x, y };
      requestDraw();
      return;
    }
    if (ui.textMode >= 0) {
      clearSelMore();
      ui.textMode = -1;
      ui.selLabel = -1;
      refreshTextList();
      syncTextControls();
      requestDraw();
    }
  }
  if (ui.textMode === 0) {
    const f = titleFrame();
    if (Math.abs(x - f.cx) <= f.w / 2 + 14 && Math.abs(y - f.cy) <= f.h / 2 + 14) {
      act = { kind: "title", x, y };
      return;
    }
  } else if (ui.textMode > 0 && st.extraLabels[ui.textMode - 1]) {
    const i = ui.textMode - 1, f = labelFrame(i);
    if (Math.abs(x - f.cx) <= f.w / 2 + 14 && Math.abs(y - f.cy) <= f.h / 2 + 14) {
      ui.selLabel = i;
      act = { kind: "label", i, x, y };
      requestDraw();
      return;
    }
  }
  if (st.kind === "ring") {
    const ra = ringPointerDown(e, x, y);
    if (ra) {
      act = ra;
      return;
    }
    if (e.pointerType !== "mouse" || ui.tool === "pan") act = { kind: "pan", x, y, px: ui.panX, py: ui.panY };
    return;
  }
  const alt = e.altKey, ctrl = e.ctrlKey || e.metaKey, shift = e.shiftKey;
  if (ui.tool === "pan" && !alt && !ctrl && !shift) {
    act = { kind: "pan", x, y, px: ui.panX, py: ui.panY };
    return;
  }
  if (!alt && !ctrl && !shift && (!st.kind || st.kind === "led")) {
    const ri = ledRotInfo(st);
    if (ri && Math.hypot(x - ri.hx, y - ri.hy) <= 11) {
      act = { kind: "cabRot" };
      return;
    }
  }
  const cell = pointToCell(x, y);
  if (!cell) {
    if (e.pointerType !== "mouse" || ui.tool === "pan") act = { kind: "pan", x, y, px: ui.panX, py: ui.panY };
    return;
  }
  const k = key(...cell);
  if (alt || ui.tool === "black" && !ctrl && !shift) {
    const target = !st.blackCabinets.includes(k);
    act = { kind: "black", target };
    applyBlack(k, target);
  } else if (shift) {
    if (!ui.anchor) {
      const f = [...ui.selected][0];
      ui.anchor = f ? parseKey(f) : cell;
    }
    act = { kind: "range", from: ui.anchor };
    selectRange(ui.anchor, cell);
  } else if (ui.tool === "range") {
    ui.anchor = cell;
    act = { kind: "range", from: cell };
    selectRange(cell, cell);
  } else if (ctrl || ui.tool === "select") {
    // 2.0.174: схема как в Keynote — щелчок мышью выбирает один кабинет, Cmd/Ctrl добавляет или убирает,
    // Shift — диапазон, Alt — чёрный. Пальцем «Выбор» по-прежнему добавляет/убирает касанием.
    const grp = cabGroupOf(st, k) || [k], had = ui.selected.has(k);
    ui.anchor = cell;
    if (ctrl || e.pointerType === "touch") {
      for (const q of grp) had ? ui.selected.delete(q) : ui.selected.add(q);
      act = { kind: "tap" };
    } else {
      let collapse = "";
      if (!had) {
        ui.selected.clear();
        for (const q of grp) ui.selected.add(q);
      } else if (ui.selected.size > grp.length) collapse = k;
      const base = {};
      for (const q of ui.selected) if (cabValid(st, q)) base[q] = (st.cabShift && st.cabShift[q] || [0, 0]).slice();
      act = { kind: "cabMove", x0: x, y0: y, base, moved: false, collapse };
    }
  }
  if (ui.selected.has(k)) ui.selPri = k;
  hoverStatus(cell);
  changed();
});
pv.addEventListener("pointerleave", () => {
  if (ui.textHover) {
    ui.textHover = null;
    requestDraw();
  }
});
pv.addEventListener("pointermove", (e) => {
  if (ui.page && ui.page !== "mask") return;
  const p = local(e);
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, p);
  ui.mod = e.pointerType === "mouse" && (e.ctrlKey || e.metaKey || e.shiftKey);
  if (pinch && pointers.size >= 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
    ui.zoom = Math.max(0.25, Math.min(8, pinch.z * d / pinch.d));
    const k = ui.zoom / pinch.z, cx = $("wrap").clientWidth / 2, cy = $("wrap").clientHeight / 2;
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    ui.panX = pinch.px * k + (pinch.mx - cx) * (1 - k) + (mx - pinch.mx);
    ui.panY = pinch.py * k + (pinch.my - cy) * (1 - k) + (my - pinch.my);
    updateInfo();
    requestDraw();
    return;
  }
  const cell = pointToCell(...p);
  if (ui.bezDraw && L) {
    ui.bezHover = [(p[0] - L.ox) / L.scale, (p[1] - L.oy) / L.scale];
    if (!act) requestDraw();
  }
  if (!act) {
    if (e.pointerType === "mouse") {
      // 2.0.95: текст под мышью — пунктирная рамка (как надпись на общем поле)
      const th = textHoverAt(p[0], p[1], e), tk = th ? th.k : null;
      if (tk !== (ui.textHover && ui.textHover.k)) {
        ui.textHover = th;
        requestDraw();
      }
      pv.style.cursor = th ? "move" : "";
      const h = cell ? key(...cell) : null;
      if (h !== (ui.hover && key(...ui.hover))) {
        ui.hover = cell;
        requestDraw();
      }
      if (cell) hoverStatus(cell);
    }
    return;
  }
  const st = S(), s = L ? L.scale : 1;
  if (act.kind === "pan") {
    ui.panX = act.px + p[0] - act.x;
    ui.panY = act.py + p[1] - act.y;
    requestDraw();
  } else if (act.kind === "title") {
    if (act.rx == null) [act.rx, act.ry] = [st.titleOffsetX, st.titleOffsetY];
    act.rx += (p[0] - act.x) / s;
    act.ry -= (p[1] - act.y) / s;
    [st.titleOffsetX, st.titleOffsetY] = textSnap(-1, act.rx, act.ry, e);
    act.x = p[0];
    act.y = p[1];
    changed();
  } else if (act.kind === "refMove" || act.kind === "refSize") {
    refPointerMove(act, p, e);
  } else if (/^ring/.test(act.kind)) {
    ringPointerMove(act, p, e);
  } else if (act.kind === "bezNew") {
    // потянули при постановке точки — плавный узел с симметричными ручками
    const q = act.q, ix = (p[0] - L.ox) / s, iy = (p[1] - L.oy) / s;
    if (Math.hypot(p[0] - act.x, p[1] - act.y) > 3) Object.assign(q, { ox: ix, oy: iy, ix: 2 * q.x - ix, iy: 2 * q.y - iy, sm: true });
    requestDraw();
  } else if (act.kind === "bezA" || act.kind === "bezI" || act.kind === "bezO") {
    const c = st.cacheShapes[act.i], q = c && c.pts && c.pts[act.j];
    if (q) {
      const hw = c.w / 2, hh = c.h / 2;
      if (act.kind === "bezA") {
        const [dx, dy] = unrotPt(c, (p[0] - act.x) / s, (p[1] - act.y) / s), nx = dx / hw, ny = dy / hh;
        for (const [a, b] of [["x", "y"], ["ix", "iy"], ["ox", "oy"]]) {
          q[a] += nx;
          q[b] += ny;
        }
        act.x = p[0];
        act.y = p[1];
      } else {
        const [lx, ly] = unrotPt(c, (p[0] - (L.ox + c.x * s)) / s, (p[1] - (L.oy + c.y * s)) / s), hx = lx / hw, hy = ly / hh;
        const [mk, ok] = act.kind === "bezI" ? [["ix", "iy"], ["ox", "oy"]] : [["ox", "oy"], ["ix", "iy"]];
        q[mk[0]] = hx;
        q[mk[1]] = hy;
        if (q.sm) {
          // плавный узел: противоположная ручка на той же прямой, длина сохраняется
          const vx = (hx - q.x) * hw, vy = (hy - q.y) * hh, vl = Math.hypot(vx, vy) || 1e-9;
          const ol = Math.hypot((q[ok[0]] - q.x) * hw, (q[ok[1]] - q.y) * hh) || vl;
          q[ok[0]] = q.x - vx / vl * ol / hw;
          q[ok[1]] = q.y - vy / vl * ol / hh;
        }
      }
      changed();
    }
  } else if (act.kind === "shapeRot") {
    const c = st.cacheShapes[act.i];
    if (c) {
      let d = Math.atan2(p[1] - (L.oy + c.y * s), p[0] - (L.ox + c.x * s)) * 180 / Math.PI + 90;
      if (e.shiftKey) d = Math.round(d / 15) * 15;
      c.rot = normRot(d);
      syncShapes();
      changed();
    }
  } else if (act.kind === "shapeRad") {
    const c = st.cacheShapes[act.i];
    if (c) {
      const [lx] = unrotPt(c, (p[0] - (L.ox + c.x * s)) / s, (p[1] - (L.oy + c.y * s)) / s);
      c.r = Math.round(Math.max(0, Math.min(Math.min(c.w, c.h) / 2, c.w / 2 - lx)));
      syncShapes();
      changed();
    }
  } else if (act.kind === "shapeTop") {
    const c = st.cacheShapes[act.i];
    if (c) {
      // ширина верхнего основания трапеции — за голубую точку у его свободного края
      const hw = c.w / 2, sk = trapSk(c), [x] = unrotPt(c, (p[0] - (L.ox + c.x * s)) / s, (p[1] - (L.oy + c.y * s)) / s);
      const tw = sk > 0 ? (hw * sk - x) / (1 + sk) : (x - hw * sk) / (1 - sk);
      c.tb = Math.round(Math.max(5, Math.min(100, tw / hw * 100)));
      syncShapes();
      changed();
    }
  } else if (act.kind === "shapeSize") {
    const c = st.cacheShapes[act.i];
    if (c) {
      const [ldx, ldy] = unrotPt(c, p[0] - act.x, p[1] - act.y), dx = ldx / s * 2, dy = ldy / s * 2;
      if (c.lock) {
        const d = act.m === "h" ? dy : act.m === "w" ? dx : Math.abs(dx) > Math.abs(dy) ? dx : dy;
        c.w = c.h = Math.max(4, c.w + d);
      } else {
        if (act.m.includes("w")) c.w = Math.max(4, c.w + dx);
        if (act.m.includes("h")) c.h = Math.max(4, c.h + dy);
      }
    }
    act.x = p[0];
    act.y = p[1];
    syncShapes();
    changed();
  } else if (act.kind === "shape") {
    const c = st.cacheShapes[act.i];
    if (c) {
      c.x += (p[0] - act.x) / s;
      c.y += (p[1] - act.y) / s;
    }
    act.x = p[0];
    act.y = p[1];
    changed();
  } else if (act.kind === "label") {
    const it = st.extraLabels[act.i];
    if (act.rx == null) [act.rx, act.ry] = [it.x, it.y];
    act.rx += (p[0] - act.x) / s;
    act.ry -= (p[1] - act.y) / s;
    const x0 = it.x, y0 = it.y;
    [it.x, it.y] = textSnap(act.i, act.rx, act.ry, e);
    for (const j of selExtras()) if (j !== act.i) {
      const o = st.extraLabels[j];
      o.x = (+o.x || 0) + (it.x - x0);
      o.y = (+o.y || 0) + (it.y - y0);
    }
    act.x = p[0];
    act.y = p[1];
    changed();
  } else if (act.kind === "cabRot") {
    // точка поворота: угол выбранного кабинета (или группы) — по направлению от центра; Shift — шагом 15°
    L = layout() || L;
    const ri = ledRotInfo(st);
    if (ri) {
      let a = Math.atan2(p[0] - ri.px, -(p[1] - ri.py)) * 180 / Math.PI;
      if (e.shiftKey) a = Math.round(a / 15) * 15;
      ledRotateSel(0, Math.round(a * 100) / 100);
    }
  } else if (act.kind === "cabMove") {
    // перетаскивание выбранных кабинетов мышью (сдвиг cabShift)
    if (!act.moved && Math.hypot(p[0] - act.x0, p[1] - act.y0) <= 4) return;
    act.moved = true;
    const dxm = Math.round((p[0] - act.x0) / s), dym = Math.round(-(p[1] - act.y0) / s);
    st.cabShift = st.cabShift || {};
    for (const [q, o] of Object.entries(act.base)) {
      const v = [o[0] + dxm, o[1] + dym];
      if (v[0] === 0 && v[1] === 0) delete st.cabShift[q]; else st.cabShift[q] = v;
    }
    changed({ forcePhys: true });
  } else if (act.kind === "range" && cell) {
    selectRange(act.from, cell);
    hoverStatus(cell);
    changed();
  } else if (act.kind === "black" && cell) {
    applyBlack(key(...cell), act.target);
    hoverStatus(cell);
    changed();
  }
});
function endPointer(e) {
  if (ui.page && ui.page !== "mask") return;
  pointers.delete(e.pointerId);
  if (ui.txGuides) {
    ui.txGuides = null;
    requestDraw();
  }
  if (act && /^bez[AIO]$/.test(act.kind)) {
    const c = S().cacheShapes[act.i];
    if (c) {
      bezNormalize(c);
      syncShapes();
      changed();
    }
  }
  if (act && act.kind === "shapeSize") {
    const c = S().cacheShapes[act.i];
    if (c) {
      c.w = Math.round(c.w);
      c.h = Math.round(c.h);
      syncShapes();
      changed();
    }
  }
  if (pointers.size < 2) pinch = null;
  if (pointers.size === 0) {
    const wasBox = act && act.kind === "ringBox";
    if (act && act.kind === "ringMove" && act.tapToggle && !act.moved) ringTapToggle(act.tapToggle);
    if (act && act.kind === "ringMove" && act.tapCollapse && !act.moved) ringTapCollapse(act.tapCollapse);
    if (act && act.kind === "cabMove" && act.collapse && !act.moved) {
      // щелчок без сдвига по кабинету из выбора — остаётся только он (с его группой)
      const st2 = S(), g = cabGroupOf(st2, act.collapse) || [act.collapse];
      ui.selected.clear();
      for (const q of g) ui.selected.add(q);
      changed();
    }
    act = null;
    if (wasBox) requestDraw();
  }
}
pv.addEventListener("pointerup", endPointer);
pv.addEventListener("pointercancel", endPointer);
pv.addEventListener("pointerleave", (e) => {
  if (ui.page && ui.page !== "mask") return;
  if (e.pointerType === "mouse") {
    ui.hover = null;
    requestDraw();
  }
});
// 2.0.110: колесо мыши и тачпад (щипок / два пальца) — масштаб маски к курсору
pv.addEventListener("wheel", (e) => {
  if (ui.page && ui.page !== "mask") return;
  e.preventDefault();
  let dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
  if (!dy) return;
  const f = Math.max(0.5, Math.min(2, Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0018))));
  const r = $("wrap").getBoundingClientRect();
  setZoomAt(ui.zoom * f, e.clientX - r.left, e.clientY - r.top);
}, { passive: false });
function setZoomAt(z, mx, my) {
  const z0 = ui.zoom;
  z = Math.max(0.25, Math.min(8, z));
  if (z === z0) return;
  const k = z / z0, cx = $("wrap").clientWidth / 2, cy = $("wrap").clientHeight / 2;
  ui.panX = ui.panX * k + (mx - cx) * (1 - k);
  ui.panY = ui.panY * k + (my - cy) * (1 - k);
  setZoom(z);
}
function applyBlack(k, target) {
  const st = S(), set = new Set(st.blackCabinets);
  target ? set.add(k) : set.delete(k);
  st.blackCabinets = [...set];
}
function hoverStatus(cell) {
  const st = S(), [c, r] = cell;
  const { xs, ys } = grid(st), fig = !!shapedPx(st, (st.shapedCols || {})[c]) || (st.shapedRows || {})[r] > 0;
  status("Кабинет ".concat(cabLabel(st, c, r), " • ").concat(xs[c + 1] - xs[c], "×").concat(ys[r + 1] - ys[r], " px").concat(fig ? " (фигурный)" : "", " • X:").concat(xs[c], " Y:").concat(ys[r], " • ").concat(st.blackCabinets.includes(key(c, r)) ? "ЧЁРНЫЙ" : (st.cornerCabinets || {})[key(c, r)] != null ? "УГЛОВОЙ " + CORNER_GLYPH[st.cornerCabinets[key(c, r)]] : "АКТИВЕН"));
}
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && $("modal").hidden && ui.selected.size) {
    clearSelection();
  }
  if ((e.ctrlKey || e.metaKey || e.shiftKey) && !ui.mod) {
    ui.mod = true;
    requestDraw();
  }
});
window.addEventListener("keyup", (e) => {
  if (!(e.ctrlKey || e.metaKey || e.shiftKey) && ui.mod) {
    ui.mod = false;
    requestDraw();
  }
});
new ResizeObserver(requestDraw).observe($("wrap"));
function setZoom(z) {
  ui.zoom = Math.max(0.25, Math.min(8, z));
  updateInfo();
  requestDraw();
}
function clearSelection() {
  ui.selected.clear();
  ui.anchor = null;
  changed();
  status("Выделение снято");
}
function syncProjUI() {
  const st = S(), P = st.proj || (st.proj = defProj()), kind = ["proj", "tv", "pix", "tube", "vol", "ring"].includes(st.kind) ? st.kind : "led";
  if (P.numsN == null) P.numsN = Math.max(1, P.nx | 0) * Math.max(1, P.ny | 0);
  document.documentElement.setAttribute("data-kind", kind);
  {
    // 2.0.45: «Направляющие» — в разделе «ДАННЫЕ» текущего вида (LED, проекция, ТВ); переносим только при смене вида
    const g = $("guidesRow"), box = ["led", "proj", "tv"].includes(kind) ? $(kind + "Data") : null;
    if (g && box && g.parentElement !== box) box.appendChild(g);
    // 2.0.163: «Формат» и «Начало нумерации» нужны и кольцу — переносим строки в его панель
    const nr = $("numFmtRows"), nbox = kind === "ring" ? $("rgNumHost") : null, home = $("numFmtHome");
    if (nr && nbox) {
      if (nr.parentElement !== nbox) nbox.appendChild(nr);
    } else if (nr && home && nr.previousElementSibling !== home) home.after(nr);
  }
  document.documentElement.setAttribute("data-pjmode", P.mode === "dome" ? "dome" : "grid");
  document.querySelectorAll(".seg.pjmode button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === (P.mode === "dome" ? "dome" : "grid"))));
  document.querySelectorAll(".seg.pjdsize button").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.d === (P.dome | 0))));
  document.querySelectorAll(".seg.kind button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.kind === kind)));
  const sel = $("pjPreset");
  if (!sel.options.length) {
    sel.innerHTML = PJ_PRESETS.map((t, i) => '<option value="'.concat(i, '">').concat(t[0], "</option>")).join("") + '<option value="">Своё разрешение</option>';
  }
  const pi = PJ_PRESETS.findIndex((t) => t[1] === P.pw && t[2] === P.ph);
  sel.value = pi >= 0 ? pi : "";
  const set = (id, v) => {
    if (document.activeElement !== $(id)) $(id).value = v;
  };
  document.querySelectorAll(".seg.pjrot button").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.rot === (+P.rot ? 90 : 0))));
  {
    const [pwM, phM] = physM(st), cw = +P.cw > 0 && +P.ch > 0 ? +P.cw : +pwM.toFixed(2), ch = +P.cw > 0 && +P.ch > 0 ? +P.ch : +phM.toFixed(2);
    set("pjHm", ch);
    P._dispW = cw;
    const r = ratioOf(cw, ch);
    set("pjArW", r[0]);
    set("pjArH", r[1]);
    $("pjArLock").checked = P.arLock !== false;
  }
  set("pjW", P.pw);
  set("pjH", P.ph);
  set("pjNx", P.nx);
  set("pjNy", P.ny);
  set("pjOx", P.ox);
  set("pjOy", P.oy);
  set("pjGrid", P.grid);
  set("pjWm", P._dispW);
  set("pjDome", P.dome || 4096);
  set("pjFov", P.fov || 180);
  set("pjAz", P.az || 10);
  set("pjEl", P.el || 10);
  $("pjBg").value = (P.bg || "#101010").toLowerCase();
  $("pjLine").value = (P.line || "#FFFFFF").toLowerCase();
  $("pjText").value = (P.text || "#FFFFFF").toLowerCase();
  for (const [id, k] of [["pjZones", "zones"], ["pjFrames", "frames"], ["pjNums", "nums"], ["pjCircles", "circles"], ["pjCells", "cells"], ["pjHatch", "hatch"], ["pjBar", "bar"], ["pjInvert", "invert"]]) $(id).checked = !!P[k];
  for (const [id, k] of [["pjDMinor", "dminor"], ["pjDLabels", "dlabels"], ["pjDSides", "dsides"]]) $(id).checked = P[k] !== false;
  {
    const g = projGeom(st);
    set("pjCanW", g.W);
    set("pjCanH", g.H);
    set("pjOxPx", g.ovx);
    set("pjOyPx", g.ovy);
    set("pjOx", g.nx > 1 ? +(g.ovx / g.pw * 100).toFixed(2) : P.ox);
    set("pjOy", g.ny > 1 ? +(g.ovy / g.ph * 100).toFixed(2) : P.oy);
    const freeX = g.nx > 1, freeY = g.ny > 1 && !(g.canvas && g.nx > 1);
    $("pjOx").disabled = $("pjOxPx").disabled = !freeX;
    $("pjOy").disabled = $("pjOyPx").disabled = !freeY;
    $("pjCanW").disabled = g.canvas || g.nx < 2;
    $("pjCanH").disabled = g.canvas || g.ny < 2;
  }
  syncTVPixUI();
}
function syncTVPixUI() {
  if ($("vlModel")) syncVolUI();
  if (S().kind === "ring") syncRingUI();
  const st = S(), T = st.tv || (st.tv = defTV()), X = st.pix || (st.pix = defPix()), set = (id, v) => {
    if (document.activeElement !== $(id)) setVal($(id), v);
  };
  if (!$("tvPreset").options.length) $("tvPreset").innerHTML = TV_PRESETS.map((t, i) => '<option value="'.concat(i, '">').concat(t[0], "</option>")).join("") + '<option value="">Своё разрешение</option>';
  {
    const i = TV_PRESETS.findIndex((t) => t[1] === T.pw && t[2] === T.ph);
    setVal($("tvPreset"), i >= 0 ? i : "");
  }
  set("tvW", T.pw);
  set("tvH", T.ph);
  set("tvNx", T.nx);
  set("tvNy", T.ny);
  set("tvDiag", T.diag || 0);
  set("tvLabel", T.label || "");
  document.querySelectorAll(".seg.tvrot button").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.rot === (+T.rot ? 90 : 0))));
  $("tvBars").checked = T.bars !== false;
  $("tvGrid").checked = T.grid !== false;
  $("tvSafe").checked = T.safe !== false;
  $("tvCorner").checked = T.corner === true;
  if (!$("pxPreset").options.length) $("pxPreset").innerHTML = PIX_PRESETS.map((t, i) => '<option value="'.concat(i, '">').concat(t[0], "</option>")).join("") + '<option value="">Свой элемент</option>';
  {
    const i = PIX_PRESETS.findIndex((t) => t[1] === X.ew && t[2] === X.eh && t[3] === X.cmw && t[4] === X.cmh);
    setVal($("pxPreset"), i >= 0 ? i : "");
  }
  set("pxW", X.ew);
  set("pxH", X.eh);
  set("pxCmW", X.cmw);
  set("pxCmH", X.cmh);
  set("pxCols", X.cols);
  set("pxRows", X.rows);
  {
    const g = pixGeom(st);
    set("pxSx", Math.max(0, +X.gx || 0));
    set("pxSy", Math.max(0, +X.gy || 0));
    if (!$("pxScale").options.length) $("pxScale").innerHTML = '<option value="cm">1 px ≤ 1 см (авто)</option>' + [2, 3, 4, 5, 6, 8, 10].map((v) => '<option value="'.concat(v, '">×').concat(v, "</option>")).join("");
    {
      // сколько сантиметров в 1 px промежутка — шаг, с которым меняется расстояние в маске
      const dd = pixDens(X).d * pixK(X), cx = dd > 0 ? 1 / dd : 0;
      setTxt($("pxGapStep"), X.phys && cx > 0 ? "1 px маски = ".concat(+cx.toFixed(2), " см по ширине и высоте — пропорции как в реальности; промежуток меняется с этим шагом").concat(cx > 1.01 ? "; чтобы на каждый сантиметр — «Масштабировать маску: 1 px ≤ 1 см»" : "") : X.phys ? "" : "По пикселям: элементы вплотную, расстояние между элементами в маске не рисуется (оно учтено в общем размере в метрах)");
    }
    $("pxScaleOn").checked = !!X.scaleOn;
    setVal($("pxScale"), String(X.scale || 2));
    set("pxWm", +g.wm.toFixed(3));
    set("pxHm", +g.hm.toFixed(3));
    document.querySelectorAll(".seg.pxMode button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.m === "m" === !!X.phys)));
  }
  $("pxNums").checked = X.nums !== false;
  $("pxRowsShade").checked = X.shade !== false;
}
// ---- Волюметрик: раздел «Данные» ----
function syncVolUI() {
  const st = S(), V = st.vol || (st.vol = defVol()), set = (id, v) => {
    if (document.activeElement !== $(id)) setVal($(id), v);
  };
  if (!$("vlModel").options.length) $("vlModel").innerHTML = VOL_MODELS.map((m, i) => '<option value="'.concat(i, '">').concat(xmlEsc(m.name), "</option>")).join("") + '<option value="custom">Свой кабинет</option>';
  setVal($("vlModel"), String(V.model));
  set("vlCx", V.cx);
  set("vlWm", compactM(V.cx * V.cw / 100));
  set("vlHm", compactM(V.len));
  set("vlDm", compactM(V.cz * V.cd / 100));
  set("vlCz", V.cz);
  set("vlSx", V.sx);
  set("vlSz", V.sz);
  set("vlCw", V.cw);
  set("vlCd", V.cd);
  set("vlPx", V.px);
  set("vlLen", V.len);
  set("vlPerRow", V.perRow || "");
  set("vlIp", V.ip);
  setVal($("vlStart"), V.start);
  setVal($("vlDir"), V.dir);
  setVal($("vlLine"), V.line === "arc" ? "arc" : "round");
  $("vlSnake").checked = !!V.snake;
  if (!VOL_MASK_UI && V.view !== "com") V.view = "com";
  {
    const vv = document.querySelector(".seg.vlView");
    if (vv && vv.hidden !== !VOL_MASK_UI) vv.hidden = !VOL_MASK_UI;
  }
  document.querySelectorAll(".seg.vlView button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === V.view)));
  document.querySelectorAll(".seg.vlSide button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.s === V.side)));
  document.querySelectorAll("#volData .vlm").forEach((el) => {
    if (el.hidden !== (V.view !== "mask")) el.hidden = V.view !== "mask";
  });
  document.querySelectorAll("#volData .vlc").forEach((el) => {
    if (el.hidden !== (V.view !== "com")) el.hidden = V.view !== "com";
  });
  $("vlPick").textContent = ui.volPick ? "Отменить" : "Задать порядок щелчками";
  $("vlBlank").setAttribute("aria-pressed", String(!!ui.volBlank));
  $("vlBlank").textContent = ui.volBlank ? "Гашение: вкл — щёлкайте кабинеты" : "Гасить кабинеты";
  $("vlAllOn").disabled = !(V.off && V.off.length);
  $("vlPickReset").disabled = !V.manual;
  for (const id of ["vlStart", "vlDir", "vlSnake"]) $(id).disabled = !!V.manual;
  setTxt($("vlComHint"), ui.volBlank ? "Щелчок по кабинету на схеме — погасить или включить (как «Гашение» у LED). Погашенные не коммутируются и не светятся в маске и 3D." : ui.volPick ? "Щёлкайте кабинеты на холсте в порядке коммутации — от первого до последнего." : V.manual ? "Порядок задан вручную. «Сбросить ручной порядок» — вернуть по углу и направлению." : "Номер кабинета = порядок коммутации и IP. Нити пронумерованы как на листе адресации.");  for (const id of ["vlSx", "vlSz", "vlCw", "vlCd", "vlPx", "vlLen"]) $(id).disabled = V.model !== "custom";
  document.querySelectorAll(".seg.vlLayout button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.l === V.layout)));
  if (V.view === "mask") $("vlPerRowRow").hidden = V.layout !== "slices";
  if (!$("vlScale").options.length) $("vlScale").innerHTML = [2, 3, 4, 5, 6, 8, 10, 12, 16].map((v) => '<option value="'.concat(v, '">×').concat(v, "</option>")).join("");
  $("vlScaleOn").checked = !!V.scaleOn;
  setVal($("vlScale"), String(V.scale));
  $("vlShade").checked = V.shade !== false;
  $("vl3d").checked = V.show3d !== false;
  const g = volGeom(st);
  setTxt($("vlDmx"), "Шаг нитей ".concat(cmFmt(g.pitchX)).concat(Math.abs(g.pitchX - g.pitchZ) > 0.01 ? "×" + cmFmt(g.pitchZ) : "", " см · нить: ").concat(V.px * 3, " ").concat(chWord(V.px * 3), " DMX · в universe ").concat(g.perUni, " нит. · кабинет — ").concat(g.uniPerCab, " universe · всего ").concat(g.uniPerCab * g.cabs.length, " universe · IP ").concat(g.cabs.length ? g.cabs[0].ip : "—").concat(g.cabs.length > 1 ? " … " + g.cabs[g.cabs.length - 1].ip : ""));
}
const volChanged = () => {
  syncVolUI();
  changed({ forcePhys: true });
};
// 2.0.66: стрелки у полей чисел — тяжёлую перерисовку откладываем, пока стрелка нажата/кликается:
// иначе браузер не успевает обработать отпускание кнопки и сам продолжает листать (2 → 31 кабинет).
let volNumT = 0;
const volChangedSoon = () => {
  clearTimeout(volNumT);
  volNumT = setTimeout(volChanged, 40);
};
$("vlModel").addEventListener("change", (e) => {
  const V = S().vol, v = e.target.value;
  ui.tzSubManual = false;
  if (v === "custom") V.model = "custom";
  else Object.assign(V, VOL_MODELS[+v], { model: +v }), delete V.name;
  volChanged();
});
for (const [id, k, min, max, float] of [["vlCx", "cx", 1, 64], ["vlCz", "cz", 1, 64], ["vlSx", "sx", 1, 64], ["vlSz", "sz", 1, 64], ["vlPx", "px", 1, 1024], ["vlCw", "cw", 1, 1e4, true], ["vlCd", "cd", 1, 1e4, true], ["vlLen", "len", 0.01, 100, true], ["vlPerRow", "perRow", 0, 4096]])
  $(id).addEventListener("input", () => {
    const raw = String($(id).value).replace(",", "."), v = float ? parseFloat(raw) : pint(raw, NaN);
    if (k === "perRow" && raw.trim() === "") {
      S().vol.perRow = 0;
      volChanged();
      return;
    }
    if (isFinite(v) && v >= min && v <= max) {
      const V = S().vol;
      V[k] = v;
      if (k === "cx" || k === "cz") {
        V.off = V.off.filter((q) => +q.split(",")[0] < V.cx && +q.split(",")[1] < V.cz);
        V.manual = null;
      }
      volChangedSoon();
    }
  });
// размер в метрах: ширина и глубина → число кабинетов, высота → длина нити (модель с такой нитью, иначе «свой»)
for (const [id, ax] of [["vlWm", "w"], ["vlHm", "h"], ["vlDm", "d"]]) {
  $(id).addEventListener("change", () => {
    const v = parseFloat(String($(id).value).replace(",", ".")), V = S().vol;
    if (!(v > 0)) return syncVolUI();
    if (ax === "w" || ax === "d") {
      const k = ax === "w" ? "cx" : "cz", n = Math.max(1, Math.min(64, Math.round(v * 100 / (ax === "w" ? V.cw : V.cd))));
      if (n !== V[k]) {
        V[k] = n;
        V.off = V.off.filter((q) => +q.split(",")[0] < V.cx && +q.split(",")[1] < V.cz);
        V.manual = null;
      }
    } else {
      const mi = VOL_MODELS.findIndex((m) => Math.abs(m.len - v) < 1e-6 && m.sx === V.sx && m.sz === V.sz) >= 0 ? VOL_MODELS.findIndex((m) => Math.abs(m.len - v) < 1e-6 && m.sx === V.sx && m.sz === V.sz) : VOL_MODELS.findIndex((m) => Math.abs(m.len - v) < 1e-6);
      if (mi >= 0) {
        Object.assign(V, VOL_MODELS[mi], { model: mi });
        delete V.name;
      } else Object.assign(V, { model: "custom", len: v });
      ui.tzSubManual = false;
    }
    volChanged();
  });
}
document.querySelectorAll(".seg.vlView button").forEach((b) => b.onclick = () => {
  S().vol.view = b.dataset.v === "com" ? "com" : "mask";
  ui.volPick = false;
  volChanged();
});
document.querySelectorAll(".seg.vlSide button").forEach((b) => b.onclick = () => {
  S().vol.side = b.dataset.s === "top" ? "top" : "bottom";
  volChanged();
});
$("vlStart").addEventListener("change", (e) => {
  S().vol.start = e.target.value;
  volChanged();
});
$("vlLine").addEventListener("change", (e) => {
  S().vol.line = e.target.value === "arc" ? "arc" : "round";
  volChanged();
});
$("vlDir").addEventListener("change", (e) => {
  S().vol.dir = e.target.value === "cols" ? "cols" : "rows";
  volChanged();
});
$("vlSnake").addEventListener("change", (e) => {
  S().vol.snake = e.target.checked;
  volChanged();
});
$("vlPick").onclick = () => {
  ui.volPick = !ui.volPick;
  ui.volBlank = false;
  ui.volPickList = ui.volPick ? [] : null;
  if (ui.volPick) status("Щёлкайте кабинеты по порядку коммутации", true);
  syncVolUI();
  volComDraw();
};
$("vlBlank").onclick = () => {
  ui.volBlank = !ui.volBlank;
  ui.volPick = false;
  syncVolUI();
  volComDraw();
};
$("vlAllOn").onclick = () => {
  const V = S().vol;
  V.off = [];
  V.manual = null;
  volChanged();
  status("Все кабинеты включены", true);
};
$("vlPickReset").onclick = () => {
  S().vol.manual = null;
  ui.volPick = false;
  volChanged();
};
volComInit();
$("vlIp").addEventListener("input", (e) => {
  const v = String(e.target.value).trim();
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v) && v.split(".").every((x) => +x <= 255)) {
    S().vol.ip = v;
    volChanged();
  }
});
document.querySelectorAll(".seg.vlLayout button").forEach((b) => b.onclick = () => {
  S().vol.layout = b.dataset.l === "dmx" ? "dmx" : "slices";
  volChanged();
});
$("vlScaleOn").addEventListener("change", (e) => {
  S().vol.scaleOn = e.target.checked;
  volChanged();
});
$("vlScale").addEventListener("change", (e) => {
  Object.assign(S().vol, { scale: +e.target.value || 4, scaleOn: true });
  volChanged();
});
$("vlShade").addEventListener("change", (e) => {
  S().vol.shade = e.target.checked;
  volChanged();
});
$("vl3d").addEventListener("change", (e) => {
  S().vol.show3d = e.target.checked;
  vol3dDraw(true);
});
vol3dInit();
window.addEventListener("resize", () => vol3dDraw());
// ---- 2.0.130: два режима программы — «LED / Маски» и «Волюметрик» (разные ТЗ, разные разделы)
function appMode() {
  return project.mode === "vol" ? "vol" : "led";
}
function inMode(s) {
  return (s.kind === "vol") === (appMode() === "vol");
}
function applyMode() {
  const m = appMode();
  document.documentElement.dataset.mode = m;
  document.querySelectorAll("#appMode button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === m)));
  setTxt(document.querySelector('.seg.pages [data-page="mask"]'), m === "vol" ? "Конструкция" : "Маска");
  // в волюметрике нет нарезки, общего поля и мэппинга
  if (m === "vol" && ["cut", "field", "out"].includes(ui.page)) setPage("mask");
  // тип ТЗ — по режиму
  if (m === "vol" && !/^Vol/.test(ui.tzTpl || "")) {
    ui.tzSubManual = false;
    ui.tzTpl = volTzAuto() || "Vol2";
  } else if (m === "led" && /^Vol/.test(ui.tzTpl || "")) ui.tzTpl = ui.tzFlatTpl || "Resolume";
  for (const o of $("tTpl").options) {
    const hide = (o.value === "Vol") !== (m === "vol");
    o.hidden = o.disabled = hide;
  }
}
function setMode(m) {
  if (appMode() === m && inMode(S())) return applyMode();
  project.mode = m;
  // текущий экран — первый экран этого режима; если таких нет — новый
  let i = inMode(S()) ? project.cur : project.screens.findIndex(inMode);
  if (i < 0) {
    const st = defaultScreen();
    st.uid = newUid();
    if (m === "vol") {
      st.kind = "vol";
      st.vol = defVol();
      st.vol.view = "com";
      st.vol.side = "top";
      st.name = "volumetric " + (project.screens.filter((s) => s.kind === "vol").length + 1);
    } else st.name = "screen " + (project.screens.filter((s) => (s.kind || "led") === "led").length + 1);
    project.screens.push(st);
    i = project.screens.length - 1;
  }
  project.cur = i;
  ui.selected.clear();
  ui.anchor = null;
  ui.textMode = -1;
  applyMode();
  syncUI();
  changed({ forcePhys: true, list: true });
  if (ui.page === "tz") {
    refreshTZPanel();
    syncTzTpl();
    refreshTZText();
  }
  scheduleStrip();
  status(m === "vol" ? "Режим «Волюметрик»" : "Режим «LED / Маски»", true);
}
document.querySelectorAll("#appMode button").forEach((b) => b.onclick = () => setMode(b.dataset.mode));
document.querySelectorAll(".seg.kind button").forEach((b) => b.onclick = () => {
  const st = S(), was = st.kind || "led";
  st.kind = b.dataset.kind;
  // экран стал волюметриком (или перестал) — режим программы следует за ним
  if ((st.kind === "vol") !== (appMode() === "vol")) {
    project.mode = st.kind === "vol" ? "vol" : "led";
    applyMode();
    $("screens").__items = "";
  }
  // 2.0.66: в волюметрик всегда входим на вид сверху с коммутацией
  if (st.kind === "vol" && was !== "vol") {
    st.vol = st.vol || defVol();
    st.vol.view = "com";
    st.vol.side = "top";
  }
  if (st.kind === "ring" && !st.ring) st.ring = defRing();
  if (!st.proj || st.kind === "proj" && !st.proj.used) st.proj = defProj();
  if (st.kind === "proj") st.proj.used = true;
  // У pixel drop — свои галочки строк текста и положение надписи (по умолчанию строки выключены);
  // у LED / проекции / ТВ — общий набор. При переключении набор сохраняется и восстанавливается.
  const bucket = (k) => k === "pix" || k === "tube" || k === "vol" ? "pix" : "main";
  if (bucket(st.kind) !== bucket(was)) {
    const cur = { l1: st.line1Enabled !== false, l2: !!st.line2Enabled, l3: !!st.line3Enabled, ox: +st.titleOffsetX || 0, oy: +st.titleOffsetY || 0 };
    st.textSets = st.textSets && typeof st.textSets === "object" ? st.textSets : {};
    st.textSets[bucket(was)] = cur;
    const nx = st.textSets[bucket(st.kind)] || (bucket(st.kind) === "pix" ? { l1: false, l2: false, l3: false, ox: 0, oy: 0 } : cur);
    st.line1Enabled = !!nx.l1;
    st.line2Enabled = !!nx.l2;
    st.line3Enabled = !!nx.l3;
    st.titleOffsetX = +nx.ox || 0;
    st.titleOffsetY = +nx.oy || 0;
  }
  if (st.kind !== was) {
    const nm = String(st.name || "").trim();
    const DEF = { led: "screen", proj: "projection", tv: "tv", pix: "pixel drop", tube: "led tube", vol: "volumetric", ring: "ring" };
    if (!nm || /^ring$/i.test(nm) || /^(screen|projection|projector|tv|pixel drop|led tube|volumetric|ring) \d+$/i.test(nm)) st.name = st.kind === "led" ? "screen ".concat(project.cur + 1) : st.kind === "ring" ? "ring" : "".concat(DEF[st.kind], " ").concat(project.screens.filter((x) => x.kind === st.kind).length);
    $("scrName").value = st.name;
    $("screens").__items = ""; // список перестроится в syncUI (и с учётом режима)
  }
  ui.selected.clear();
  syncProjUI();
  // флажки, зависящие от вида экрана: строки текста и направляющая «Круг»
  $("line1").checked = st.line1Enabled !== false;
  $("line2").checked = !!st.line2Enabled;
  $("line3").checked = !!st.line3Enabled;
  $("gCircle").checked = st.kind === "proj" ? projCircle(st) : guidesOf(st).circle;
  changed({ forcePhys: true });
  fitAuto && fitAuto();
  status({ proj: "Экран — проекция: задайте проекторы и полотно", tv: "Экран — ТВ-панели: настроечная картинка", pix: "Экран — pixel drop: элементы, колонки и ряды", tube: "Экран — LED tube: размер в метрах и шаг трубок", vol: "Экран — волюметрик: модель, кабинеты, раскладка маски; справа внизу — 3D-вид", ring: "Экран — кольцо: кабинет, количество и диаметр; кабинеты можно выбрать и повернуть мышью" }[st.kind] || "Экран — LED", true);
});
var fitAuto = null;
const projNum = (id, k, float, min = 0) => $(id).addEventListener("input", () => {
  const v = float ? parseFloat(String($(id).value).replace(",", ".")) : pint($(id).value, NaN);
  if (isFinite(v) && v >= min) {
    S().proj[k] = v;
    syncProjUI();
    changed({ forcePhys: true });
  }
});
projNum("pjW", "pw", false, 16);
projNum("pjH", "ph", false, 16);
projNum("pjNx", "nx", false, 1);
projNum("pjNy", "ny", false, 1);
// 2.0.81: проекторов стало больше одного — «Номера проекторов» включаются сами, снова один — выключаются
function projNumsAuto(P) {
  const n = Math.max(1, P.nx | 0) * Math.max(1, P.ny | 0), prev = P.numsN;
  if (prev != null && n > 1 && prev <= 1) P.nums = true;
  if (prev != null && n <= 1 && prev > 1) P.nums = false;
  P.numsN = n;
  if ($("pjNums")) $("pjNums").checked = !!P.nums;
}
for (const id of ["pjNx", "pjNy"]) $(id).addEventListener("input", () => {
  const P = S().proj;
  if (P.numsN == null) P.numsN = 1;
  projNumsAuto(P);
  changed();
  if (P.autoRot && ((P.nx | 0) > 1 || (P.ny | 0) > 1)) {
    P.rot = 0;
    P.autoRot = false;
    syncProjUI();
    changed({ forcePhys: true });
  }
});
projNum("pjOx", "ox", true);
projNum("pjOy", "oy", true);
const pjSetOv = (axis, px) => {
  const st = S(), P = st.proj, g = projGeom(st), size = axis === "x" ? g.pw : g.ph, v = Math.max(0, Math.min(size * 0.5, px));
  P[axis === "x" ? "ox" : "oy"] = +(v / size * 100).toFixed(4);
  syncProjUI();
  changed({ forcePhys: true });
};
$("pjOxPx").addEventListener("input", () => {
  const v = pint($("pjOxPx").value, NaN);
  if (isFinite(v) && v >= 0) pjSetOv("x", v);
});
$("pjOyPx").addEventListener("input", () => {
  const v = pint($("pjOyPx").value, NaN);
  if (isFinite(v) && v >= 0) pjSetOv("y", v);
});
const pjCanvas = (axis) => {
  const st = S(), g = projGeom(st), n = axis === "x" ? g.nx : g.ny, size = axis === "x" ? g.pw : g.ph, v = pint($(axis === "x" ? "pjCanW" : "pjCanH").value, NaN);
  if (!isFinite(v) || n < 2) return;
  const lo = Math.ceil(n * size - (n - 1) * size * 0.5), hi = n * size;
  if (v < lo || v > hi) {
    status("Полотно ".concat(axis === "x" ? "по ширине" : "по высоте", " для ").concat(n, " проекторов — от ").concat(lo, " до ").concat(hi, " px (перекрытие 0–50%)"), true);
    return;
  }
  pjSetOv(axis, (n * size - v) / (n - 1));
  const g2 = projGeom(S());
  status("Перекрытие ".concat(axis === "x" ? "по горизонтали" : "по вертикали", ": ").concat(axis === "x" ? g2.ovx : g2.ovy, " px (").concat(+(axis === "x" ? S().proj.ox : S().proj.oy).toFixed(2), "%)"), true);
};
$("pjCanW").addEventListener("input", () => pjCanvas("x"));
$("pjCanH").addEventListener("input", () => pjCanvas("y"));
$("pjCanW").addEventListener("change", () => syncProjUI());
$("pjCanH").addEventListener("change", () => syncProjUI());
const tvNum = (id, k, min, max) => $(id).addEventListener("input", () => {
  const v = pint($(id).value, NaN);
  if (isFinite(v) && v >= min && v <= max) {
    S().tv[k] = v;
    syncTVPixUI();
    changed({ forcePhys: true });
  }
});
tvNum("tvW", "pw", 16, 16384);
tvNum("tvH", "ph", 16, 16384);
tvNum("tvNx", "nx", 1, 32);
tvNum("tvNy", "ny", 1, 32);
tvNum("tvDiag", "diag", 0, 300);
$("tvPreset").addEventListener("change", (e) => {
  const t = TV_PRESETS[+e.target.value];
  if (!t || e.target.value === "") return;
  Object.assign(S().tv, { pw: t[1], ph: t[2] });
  syncTVPixUI();
  changed({ forcePhys: true });
});
document.querySelectorAll(".seg.tvrot button").forEach((b) => b.onclick = () => {
  S().tv.rot = +b.dataset.rot;
  syncTVPixUI();
  changed({ forcePhys: true });
});
$("tvLabel").addEventListener("input", (e) => {
  S().tv.label = e.target.value;
  changed();
});
for (const [id, k] of [["tvBars", "bars"], ["tvGrid", "grid"], ["tvSafe", "safe"], ["tvCorner", "corner"]]) $(id).addEventListener("change", (e) => {
  S().tv[k] = e.target.checked;
  changed();
});
const pxNum = (id, k, min, max, float) => $(id).addEventListener("input", () => {
  const v = float ? parseFloat(String($(id).value).replace(",", ".")) : pint($(id).value, NaN);
  if (isFinite(v) && v >= min && v <= max) {
    S().pix[k] = v;
    syncTVPixUI();
    changed({ forcePhys: true });
  }
});
pxNum("pxW", "ew", 1, 4096);
pxNum("pxH", "eh", 1, 4096);
pxNum("pxCmW", "cmw", 0, 1e4, true);
pxNum("pxCmH", "cmh", 0, 1e4, true);
pxNum("pxCols", "cols", 1, 500);
pxNum("pxRows", "rows", 1, 100);
$("pxPreset").addEventListener("change", (e) => {
  const t = PIX_PRESETS[+e.target.value];
  if (!t || e.target.value === "") return;
  const X = S().pix;
  Object.assign(X, { ew: t[1], eh: t[2], cmw: t[3], cmh: t[4], nums: t[1] > 1 });
  syncTVPixUI();
  changed({ forcePhys: true });
});
pxNum("pxSx", "gx", 0, 1e5, true);
pxNum("pxSy", "gy", 0, 1e5, true);
$("pxScaleOn").addEventListener("change", (e) => {
  S().pix.scaleOn = e.target.checked;
  syncTVPixUI();
  changed({ forcePhys: true });
});
$("pxScale").addEventListener("change", (e) => {
  S().pix.scale = e.target.value === "cm" ? "cm" : +e.target.value || 2;
  S().pix.scaleOn = true;
  syncTVPixUI();
  changed({ forcePhys: true });
});
for (const [id, ax] of [["pxWm", "x"], ["pxHm", "y"]]) $(id).addEventListener("input", () => {
  const v = parseFloat(String($(id).value).replace(",", "."));
  if (!(isFinite(v) && v >= 0)) return;
  const st = S(), X = st.pix, g = pixGeom(st), el = ax === "x" ? +X.cmw || 0 : +X.cmh || 0, step = ax === "x" ? g.sx : g.sy;
  if (!(step > 0)) return;
  X[ax === "x" ? "cols" : "rows"] = Math.max(1, Math.floor((v * 100 - el) / step + 1e-6) + 1);
  syncTVPixUI();
  changed({ forcePhys: true });
});
$("pxWm").addEventListener("change", () => syncTVPixUI());
$("pxHm").addEventListener("change", () => syncTVPixUI());
document.querySelectorAll(".seg.pxMode button").forEach((b) => b.onclick = () => {
  S().pix.phys = b.dataset.m === "m";
  syncTVPixUI();
  changed({ forcePhys: true });
});
$("pxNums").addEventListener("change", (e) => {
  S().pix.nums = e.target.checked;
  changed();
});
$("pxRowsShade").addEventListener("change", (e) => {
  S().pix.shade = e.target.checked;
  changed();
});
projNum("pjGrid", "grid", false, 8);
for (const [id, k] of [["pjWm", "cw"], ["pjHm", "ch"]]) $(id).addEventListener("input", () => {
  const v = parseFloat(String($(id).value).replace(",", "."));
  if (!(isFinite(v) && v > 0)) return;
  const st = S(), P = st.proj;
  const [pwM, phM] = physM(st), cw0 = +P.cw > 0 && +P.ch > 0 ? +P.cw : pwM, ch0 = +P.cw > 0 && +P.ch > 0 ? +P.ch : phM;
  if (P.arLock !== false && cw0 > 0 && ch0 > 0) {
    if (k === "cw") {
      P.cw = v;
      P.ch = +(v * ch0 / cw0).toFixed(3);
    } else {
      P.ch = v;
      P.cw = +(v * cw0 / ch0).toFixed(3);
    }
  } else {
    P.cw = k === "cw" ? v : +cw0.toFixed(3);
    P.ch = k === "ch" ? v : +ch0.toFixed(3);
  }
  P.wm = P.cw;
  if (+P.cw > 0 && +P.ch > 0 && (P.nx | 0) <= 1 && (P.ny | 0) <= 1) {
    const land = Math.max(16, P.pw | 0) >= Math.max(16, P.ph | 0);
    P.rot = P.cw >= P.ch === land ? 0 : 90;
    P.autoRot = !!P.rot;
  }
  syncProjUI();
  changed({ forcePhys: true });
  if (+P.cw > 0 && +P.ch > 0) {
    const g = projGeom(st);
    status("Полотно ".concat(+P.cw, "×").concat(+P.ch, " м → ").concat(g.W, "×").concat(g.H, " px").concat(g.nx * g.ny > 1 ? " · перекрытие ".concat(g.ovx, " / ").concat(g.ovy, " px") : ""), true);
  }
});
const pjAr = () => {
  const a = parseFloat(String($("pjArW").value).replace(",", ".")), b = parseFloat(String($("pjArH").value).replace(",", "."));
  if (!(a > 0 && b > 0)) return;
  const st = S(), P = st.proj, [pwM] = physM(st), cw = +P.cw > 0 && +P.ch > 0 ? +P.cw : +pwM.toFixed(3);
  P.cw = cw;
  P.ch = +(cw * b / a).toFixed(3);
  P.wm = P.cw;
  syncProjUI();
  changed({ forcePhys: true });
  const g = projGeom(st);
  status("Пропорции ".concat(a, ":").concat(b, " → полотно ").concat(P.cw, "×").concat(P.ch, " м · ").concat(g.W, "×").concat(g.H, " px"), true);
};
$("pjArW").addEventListener("input", pjAr);
$("pjArH").addEventListener("input", pjAr);
$("pjArLock").addEventListener("change", (e) => {
  S().proj.arLock = e.target.checked;
  changed();
});
$("pjPreset").addEventListener("change", (e) => {
  const t = PJ_PRESETS[+e.target.value];
  if (!t || e.target.value === "") return;
  Object.assign(S().proj, { pw: t[1], ph: t[2] });
  syncProjUI();
  changed({ forcePhys: true });
});
document.querySelectorAll(".seg.pjrot button").forEach((b) => b.onclick = () => {
  S().proj.rot = +b.dataset.rot;
  S().proj.autoRot = false;
  syncProjUI();
  changed({ forcePhys: true });
});
$("pjBg").addEventListener("input", (e) => {
  S().proj.bg = e.target.value.toUpperCase();
  changed();
});
$("pjLine").addEventListener("input", (e) => {
  S().proj.line = e.target.value.toUpperCase();
  changed();
});
$("pjText").addEventListener("input", (e) => {
  S().proj.text = e.target.value.toUpperCase();
  changed();
});
for (const [id, k] of [["pjDMinor", "dminor"], ["pjDLabels", "dlabels"], ["pjDSides", "dsides"]]) $(id).addEventListener("change", (e) => {
  S().proj[k] = e.target.checked;
  changed();
});
document.querySelectorAll(".seg.pjmode button").forEach((b) => b.onclick = () => {
  const P = S().proj;
  P.mode = b.dataset.mode;
  for (const [k, v] of Object.entries(defProj())) if (P[k] == null) P[k] = v;
  syncProjUI();
  changed({ forcePhys: true });
  fitAuto && fitAuto();
  status(P.mode === "dome" ? "Купол: полярная сетка domemaster" : "Сетка проекторов", true);
});
document.querySelectorAll(".seg.pjdsize button").forEach((b) => b.onclick = () => {
  S().proj.dome = +b.dataset.d;
  syncProjUI();
  changed({ forcePhys: true });
  fitAuto && fitAuto();
});
projNum("pjDome", "dome", false, 256);
projNum("pjFov", "fov", false, 60);
projNum("pjAz", "az", false, 1);
projNum("pjEl", "el", false, 1);
for (const [id, k] of [["pjZones", "zones"], ["pjFrames", "frames"], ["pjNums", "nums"], ["pjCircles", "circles"], ["pjCells", "cells"], ["pjHatch", "hatch"], ["pjBar", "bar"], ["pjInvert", "invert"]]) $(id).addEventListener("change", (e) => {
  S().proj[k] = e.target.checked;
  changed();
});
function bindNum(id, prop) {
  $(id).addEventListener("input", () => {
    const v = pint($(id).value, 0);
    if (v >= 1) {
      S()[prop] = v;
      changed({ forcePhys: true });
    }
  });
  $(id).addEventListener("change", () => {
    $(id).value = S()[prop];
  });
}
bindNum("wpx", "cabWpx");
bindNum("hpx", "cabHpx");
// пиксели кабинета вписаны вручную и не совпадают с выбранным типом — это «Своё разрешение»
for (const id of ["wpx", "hpx"]) $(id).addEventListener("input", () => {
  const st = S(), t = TYPES.find((q) => q[0] === st.cabinetTypeName);
  if (t && (t[1] !== st.cabWpx || t[2] !== st.cabHpx)) {
    st.cabinetTypeName = "";
    $("cabType").value = "";
    if (window.cabTypeUI) window.cabTypeUI.sync();
  }
});
bindNum("cols", "cabCols");
bindNum("rows", "cabRows");
function bindPhys(id, which) {
  $(id).addEventListener("input", () => {
    const m = pfloat($(id).value);
    if (!(m > 0)) return;
    const [wmm, hmm] = typeMM(S()), n = Math.max(1, Math.round(m * 1e3 / (which === "w" ? wmm : hmm)));
    if (which === "w") {
      S().cabCols = n;
      $("cols").value = n;
    } else {
      S().cabRows = n;
      $("rows").value = n;
    }
    changed();
  });
  $(id).addEventListener("change", () => updateInfo(true));
  $(id).addEventListener("blur", () => updateInfo(true));
}
bindPhys("physW", "w");
bindPhys("physH", "h");
$("projName").addEventListener("input", (e) => {
  const el = e.target, v = el.value, c = cleanName(v);
  if (c !== v) {
    // знак заменён — курсор остаётся на месте
    const pos = el.selectionStart - (v.length - c.length);
    el.value = c;
    try {
      el.setSelectionRange(pos, pos);
    } catch (e2) {
    }
  }
  project.name = el.value;
  scheduleAutosave();
});
$("projName").addEventListener("change", (e) => {
  project.name = e.target.value = safeName(e.target.value, "Проект");
  scheduleAutosave();
});
$("projVer").addEventListener("input", (e) => {
  project.ver = e.target.value.trim().slice(0, 20);
  scheduleAutosave();
});
$("projVer").addEventListener("change", (e) => {
  let v = e.target.value.trim().slice(0, 20);
  if (/^\d+$/.test(v)) v = "v" + v;
  project.ver = v;
  e.target.value = v;
  scheduleAutosave();
});
stepper("projVer", (d) => {
  const m = String(project.ver || "").match(/^(.*?)(\d+)(\D*)$/);
  if (m) {
    const n = Math.max(1, +m[2] + d), w = m[2].length;
    project.ver = m[1] + (m[2][0] === "0" ? String(n).padStart(w, "0") : String(n)) + m[3];
  } else project.ver = "v1";
  $("projVer").value = project.ver;
  scheduleAutosave();
});
$("cabType").addEventListener("change", (e) => {
  if (e.target.value === "") {
    S().cabinetTypeName = "";
    syncUI();
    changed({ forcePhys: true });
    $("wpx").focus();
    status("Своё разрешение: впишите пиксели кабинета", true);
    return;
  }
  const t = TYPES[+e.target.value];
  if (!t) return;
  Object.assign(S(), { cabinetTypeName: t[0], cabWpx: t[1], cabHpx: t[2], pixelColor: fromRGB(t[5]) });
  syncUI();
  changed({ forcePhys: true });
});
$("pixColor").addEventListener("input", (e) => {
  S().pixelColor = fromHex(e.target.value);
  changed();
});
$("numColor").addEventListener("input", (e) => {
  S().numberColor = fromHex(e.target.value);
  changed();
});
// размер нумерации — как «Размер текста»: список (Авто, 1…1000 px, «Свой…»), − / +
function syncNumSize(st) {
  const v = +st.numSize || 0, sel = $("numSize"), i = NUM_SIZES.indexOf(v);
  const custom = v > 0 && i < 0, items = ["Авто", ...NUM_SIZES.map((n) => n + " px"), ...custom ? [v + " px (свой)"] : [], "Свой…"];
  fillSelect(sel, items);
  setVal(sel, v === 0 ? 0 : i >= 0 ? i + 1 : items.length - 2);
  sel.title = v > 0 ? "" : "Авто: " + Math.round(numberAuto(st)) + " px — по размеру кабинета";
}
const setNumSize = (v) => {
  const st = S();
  st.numSize = v > 0 ? Math.max(1, Math.min(1000, Math.round(v))) : 0;
  changed();
};
$("numSize").addEventListener("change", async (e) => {
  const i = +e.target.value, last = e.target.options.length - 1;
  if (i === last) {
    const st = S(), t = await ask("Свой размер нумерации", "От 1 до 1000 px", String(+st.numSize > 0 ? st.numSize : Math.round(numberAuto(st))), "OK");
    const v = parseFloat(String(t == null ? "" : t).replace(",", "."));
    if (v > 0) setNumSize(v);
    else syncNumSize(S());
    return;
  }
  if (i > NUM_SIZES.length) return; // уже выбранный свой размер
  setNumSize(i === 0 ? 0 : NUM_SIZES[i - 1]);
});
const numStep = (d) => {
  // до 10 px — шаг 1, дальше — по 10 (к ближайшему десятку)
  const st = S();
  let v = +st.numSize > 0 ? +st.numSize : Math.round(numberAuto(st));
  if (d > 0) v = v < 10 ? v + 1 : Math.floor(v / 10) * 10 + 10;
  else v = v <= 10 ? v - 1 : Math.ceil(v / 10) * 10 - 10;
  setNumSize(Math.max(1, Math.min(1000, v)));
};
$("numPlus").onclick = () => numStep(1);
$("numMinus").onclick = () => numStep(-1);
// 2.0.117: покраска кабинетов. Левый прямоугольник — цвет выделенного кабинета, по нажатию палитра:
// выбранный цвет сразу красит выделенные кабинеты. Правая кнопка — покрасить последним выбранным цветом.
const PAL_PRESET = ["#7A2006", "#B8100B", "#E0461E", "#F08A00", "#F2C200", "#8DB600", "#2E9D3A", "#00805F", "#00A3A3", "#0077C8", "#1F3FBF", "#4B2BA8", "#8B2FA8", "#C2186B", "#6B4B2A", "#8C8C8C", "#3A4048", "#FFFFFF", "#0C6049", "#704D00", "#26224F", "#00146E", "#9A3412", "#590D0B"];
const recentColors = () => {
  try {
    const a = JSON.parse(localStorage.getItem("ledmask.recentColors") || "[]");
    return Array.isArray(a) ? a.filter((c) => /^#[0-9A-F]{6}$/.test(c)).slice(0, 16) : [];
  } catch (e) {
    return [];
  }
};
function pushRecentColor(h) {
  const a = [h, ...recentColors().filter((c) => c !== h)].slice(0, 16);
  try {
    localStorage.setItem("ledmask.recentColors", JSON.stringify(a));
  } catch (e) {
  }
}
function paintSelected(h, quiet) {
  const st = S();
  ui.paint = fromHex(h);
  pushRecentColor(h);
  syncPaintUI();
  if (!ui.selected.size) {
    if (!quiet) status("Цвет выбран. Выделите кабинеты и нажмите «Покрасить»", true);
    return;
  }
  const black = new Set(st.blackCabinets);
  for (const k of ui.selected) {
    st.cabinetColors[k] = { ...ui.paint };
    black.delete(k);
  }
  st.blackCabinets = [...black];
  changed();
  status("Покрашено кабинетов: ".concat(ui.selected.size), true);
}
function unpaintSelected() {
  const st = S();
  if (!ui.selected.size) return status("Сначала выделите кабинеты", true);
  for (const k of ui.selected) delete st.cabinetColors[k];
  changed();
  status("Цвет снят — кабинеты как весь экран: ".concat(ui.selected.size), true);
}
// цвет выделенного кабинета (как он сейчас нарисован)
function selCabColor() {
  const st = S();
  if (!ui.selected.size || st.kind !== "led") return null;
  const black = new Set(st.blackCabinets), seen = /* @__PURE__ */ new Set();
  for (const k of ui.selected) {
    seen.add(black.has(k) ? "#000000" : st.cabinetColors[k] ? hex(st.cabinetColors[k]).toUpperCase() : hex(st.pixelColor).toUpperCase());
    if (seen.size > 1) break;
  }
  return [...seen];
}
function syncPaintUI() {
  const last = hex(ui.paint).toUpperCase(), cur = selCabColor(), a = $("selColor"), b = $("lastSw");
  if (b.dataset.c !== last) {
    b.dataset.c = last;
    b.style.background = last;
    $("btnPaint").title = "Покрасить выделенные кабинеты последним выбранным цветом ".concat(last);
  }
  const key = cur ? cur.join(",") : "";
  if (a.dataset.c === key) return;
  a.dataset.c = key;
  a.classList.toggle("empty", !cur);
  a.style.background = !cur ? "" : cur.length > 1 ? "linear-gradient(135deg, ".concat(cur[0], " 50%, ").concat(cur[1], " 50%)") : cur[0];
  a.title = !cur ? "Выделите кабинеты — здесь будет их цвет. Нажмите, чтобы выбрать цвет" : cur.length > 1 ? "У выделенных кабинетов разные цвета. Нажмите, чтобы выбрать новый" : "Цвет выделенного кабинета ".concat(cur[0], ". Нажмите, чтобы выбрать новый");
}
function openPalette() {
  const pop = $("palPop");
  if (!pop.hidden) return pop.hidden = true;
  const mk = (h) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pal-sw";
    b.style.background = h;
    b.title = h;
    b.setAttribute("aria-label", "Цвет " + h);
    b.onclick = () => {
      pop.hidden = true;
      paintSelected(h);
    };
    return b;
  };
  const rc = recentColors(), g1 = $("palRecent"), g2 = $("palPreset");
  g1.replaceChildren(...rc.map(mk));
  $("palRecentH").hidden = g1.hidden = !rc.length;
  g2.replaceChildren(...PAL_PRESET.map(mk));
  pop.hidden = false;
}
$("selColor").onclick = openPalette;
$("palOther").onclick = () => {
  $("palPop").hidden = true;
  $("paintColor").value = hex(ui.paint);
  $("paintColor").click();
};
$("palNone").onclick = () => {
  $("palPop").hidden = true;
  unpaintSelected();
};
$("paintColor").addEventListener("change", (e) => paintSelected(e.target.value.toUpperCase()));
document.addEventListener("pointerdown", (e) => {
  if (!$("palPop").hidden && !e.target.closest("#palPop,#selColor")) $("palPop").hidden = true;
});
$("scrName").addEventListener("input", (e) => {
  S().name = e.target.value;
  changed({ list: true });
});
$("line1").addEventListener("change", (e) => {
  S().line1Enabled = e.target.checked;
  changed();
});
$("line2").addEventListener("change", (e) => {
  S().line2Enabled = e.target.checked;
  changed();
});
$("line3").addEventListener("change", (e) => {
  S().line3Enabled = e.target.checked;
  changed();
});
for (const [id, prop] of [["inscSize", "inscriptionIndex"], ["rot", "rotationIndex"], ["numFmt", "numberFormatIndex"], ["numOrigin", "numberOriginIndex"], ["numPos", "numberPositionIndex"]])
  $(id).addEventListener("change", (e) => {
    S()[prop] = +e.target.value;
    changed();
  });
$("gCircle").addEventListener("change", (e) => {
  const st = S();
  if (st.kind === "proj") st.proj.circleGuide = e.target.checked;
  else st.guides = { ...guidesOf(st), circle: e.target.checked };
  changed();
});
$("gDiag").addEventListener("change", (e) => {
  const st = S();
  st.guides = { ...guidesOf(st), diag: e.target.checked };
  changed();
});
function mainSizeStep(delta) {
  const st = S(), size = Math.min(900, Math.max(6, inscSize(st) + delta));
  let best = 1, bd = Infinity;
  for (let i = 1; i < INSC.length; i++) {
    const d = Math.abs(pfloat(INSC[i]) - size);
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  st.inscriptionIndex = best;
  $("inscSize").value = best;
  changed();
}
$("mainPlus").onclick = () => mainSizeStep(10);
$("mainMinus").onclick = () => mainSizeStep(-10);
$("btnAllBlack").onclick = () => {
  const st = S(), a = [];
  for (let r = 0; r < st.cabRows; r++) for (let c = 0; c < st.cabCols; c++) a.push(key(c, r));
  st.blackCabinets = a;
  changed();
};
$("btnAllOn").onclick = () => {
  S().blackCabinets = [];
  changed();
};
$("btnClearSel").onclick = clearSelection;
// 2.0.173: сгруппировать / разгруппировать выделенные кабинеты (LED)
function syncCabGroupBtns() {
  const st = S();
  if (!$("btnCabGroup")) return;
  const led = !st.kind || st.kind === "led";
  syncCabRotUI();
  $("btnCabGroup").disabled = !led || ui.selected.size < 2;
  $("btnCabUngroup").disabled = !led || !(st.cabGroups || []).some((a) => a.some((k) => ui.selected.has(k)));
}
$("cabRotIn").addEventListener("input", () => {
  const v = parseFloat(String($("cabRotIn").value).replace(",", "."));
  if (isFinite(v)) ledRotateSel(0, Math.round(v * 100) / 100);
});
$("cabRotCCW").onclick = () => ledRotateSel(-45);
$("cabRotCW").onclick = () => ledRotateSel(45);
$("cabRot0").onclick = () => ledRotateSel(0, 0);
$("btnCabGroup").onclick = () => {
  const st = S();
  if (ui.selected.size < 2) return status("Выделите хотя бы два кабинета", true);
  const keys = [...ui.selected].filter((k) => {
    const p = parseKey(k);
    return p && p[0] < st.cabCols && p[1] < st.cabRows;
  });
  st.cabGroups = (st.cabGroups || []).map((a) => a.filter((k) => !ui.selected.has(k))).filter((a) => a.length > 1);
  st.cabGroups.push(keys);
  changed();
  status("Сгруппировано кабинетов: " + keys.length, true);
};
$("btnCabUngroup").onclick = () => {
  const st = S(), before = (st.cabGroups || []).length;
  st.cabGroups = (st.cabGroups || []).filter((a) => !a.some((k) => ui.selected.has(k)));
  if (st.cabGroups.length === before) return status("Выделенные кабинеты не в группе", true);
  changed();
  status("Групп снято: " + (before - st.cabGroups.length), true);
};
$("btnPaint").onclick = () => {
  if (!ui.selected.size) {
    status("Сначала выделите кабинеты: инструмент «Выбор» или «Диапазон»", true);
    return;
  }
  paintSelected(hex(ui.paint).toUpperCase(), true);
};
document.querySelectorAll(".seg.corner button").forEach((b) => b.onclick = () => {
  ui.corner = +b.dataset.corner;
  applyCorner();
});
function applyCorner() {
  const st = S();
  if (!ui.selected.size) {
    status("Сначала выделите кабинеты: инструмент «Выбор» или «Диапазон»", true);
    return;
  }
  st.cornerCabinets = st.cornerCabinets || {};
  const black = new Set(st.blackCabinets);
  for (const k of ui.selected) {
    st.cornerCabinets[k] = ui.corner;
    black.delete(k);
  }
  st.blackCabinets = [...black];
  changed();
  status("Угловых кабинетов ".concat(CORNER_GLYPH[ui.corner], ": ").concat(ui.selected.size), true);
}
ui.shapedW = "1/4";
ui.shapedCustom = false;
function currentColW(st) {
  const g = grid(st);
  for (const k of ui.selected) {
    const p = parseKey(k);
    if (p && p[0] < st.cabCols && p[1] < st.cabRows) return g.xs[p[0] + 1] - g.xs[p[0]];
  }
  return Math.max(1, st.cabWpx);
}
let shapedSelKey = "";
function syncCustomW(force) {
  const st = S(), k = project.cur + "|" + [...ui.selected].sort().join(";") + "|" + st.cabWpx + "|" + JSON.stringify(st.shapedCols || {});
  if (!force && k === shapedSelKey) return;
  shapedSelKey = k;
  setVal($("shapedCustom"), currentColW(st));
  if (ui.shapedCustom) ui.shapedW = customW();
}
function shapedLabels() {
  const st = S();
  syncCustomW(false);
  document.querySelectorAll(".shp-px").forEach((e) => {
    setTxt(e, "· " + shapedPx(st, e.dataset.f) + "×" + st.cabHpx);
  });
  setTxt($("shapedCustomH"), "×".concat(st.cabHpx, " px"));
}
const customW = () => Math.max(1, Math.min(2e4, pint($("shapedCustom").value, 128)));
document.querySelectorAll(".seg.shaped button").forEach((b) => b.onclick = () => {
  ui.shapedCustom = b.dataset.w === "custom";
  ui.shapedW = ui.shapedCustom ? customW() : b.dataset.w;
  $("shapedCustomBox").hidden = !ui.shapedCustom;
  if (ui.shapedCustom) {
    syncCustomW(true);
    ui.shapedW = customW();
    $("shapedCustomH").textContent = "×".concat(S().cabHpx, " px");
    $("shapedCustom").focus();
    $("shapedCustom").select();
  }
  document.querySelectorAll(".seg.shaped button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  applyShaped();
});
$("shapedCustom").addEventListener("input", () => {
  if (!ui.shapedCustom) return;
  ui.shapedW = customW();
  if (ui.selected.size) applyShaped(true);
});
function selectedLines(st) {
  const cols = /* @__PURE__ */ new Set(), rows = /* @__PURE__ */ new Set();
  for (const k of ui.selected) {
    const p = parseKey(k);
    if (!p || p[0] >= st.cabCols || p[1] >= st.cabRows) continue;
    cols.add(p[0]);
    rows.add(p[1]);
  }
  return { cols: [...cols].sort((a, b) => a - b), rows: [...rows].sort((a, b) => a - b) };
}
function applyShaped(quiet) {
  const st = S();
  if (!ui.selected.size) {
    if (!quiet) status("Выделите кабинет в нужном столбце — тип применится сразу", true);
    return;
  }
  const isCol = true, f = "shapedCols", lines = selectedLines(st).cols;
  if (ui.shapedCustom) ui.shapedW = customW();
  st[f] = st[f] || {};
  for (const i of lines) st[f][i] = ui.shapedW;
  changed({ forcePhys: true });
  const [W, H] = dims(st), name = ui.shapedCustom ? "".concat(ui.shapedW, "×").concat(st.cabHpx) : "".concat(SHAPED[ui.shapedW][1], " (").concat(shapedPx(st, ui.shapedW), "×").concat(st.cabHpx, ")");
  status("Фигурные ".concat(name, ": ").concat(isCol ? "столбцов" : "рядов", " ").concat(lines.length, " · разрешение ").concat(W, "×").concat(H), true);
}
$("btnShapedDel").onclick = () => {
  const st = S(), { cols, rows } = selectedLines(st);
  let n = 0;
  if (ui.selected.size) {
    for (const c of cols) if (st.shapedCols && c in st.shapedCols) {
      delete st.shapedCols[c];
      n++;
    }
    for (const r of rows) if (st.shapedRows && r in st.shapedRows) {
      delete st.shapedRows[r];
      n++;
    }
  } else {
    n = shapedCount(st);
    st.shapedCols = {};
    st.shapedRows = {};
  }
  changed({ forcePhys: true });
  status(ui.selected.size ? "Обычными стали столбцов: ".concat(n) : "Все фигурные кабинеты экрана убраны: ".concat(n), true);
};
$("btnCornerDel").onclick = () => {
  const st = S(), cc = st.cornerCabinets || {};
  const keys = ui.selected.size ? [...ui.selected] : Object.keys(cc);
  let n = 0;
  for (const k of keys) if (k in cc) {
    delete cc[k];
    n++;
  }
  changed();
  status(ui.selected.size ? "Обычными стали кабинетов: ".concat(n) : "Все угловые кабинеты экрана убраны: ".concat(n), true);
};
// 2.0.150 СМЕЩЕНИЕ — сдвиг рядов по горизонтали / столбцов по вертикали
ui.shiftMode = { type: "frac", val: 0.5 };
function shiftAmt(st, axis) {
  const m = ui.shiftMode;
  if (m.type === "px") return Math.max(1, Math.round(m.val));
  if (m.type === "cm") {
    const [wmm, hmm] = typeMM(st), mm = axis === "x" ? wmm : hmm, px = axis === "x" ? st.cabWpx : st.cabHpx;
    return Math.max(1, Math.round(m.val * 10 * px / Math.max(1, mm)));
  }
  const base = axis === "x" ? st.cabWpx : st.cabHpx;
  return Math.max(1, Math.round(base * m.val));
}
function shiftSel(axis, sign) {
  const st = S();
  if (st.kind !== "led") return;
  if (!ui.selected.size) return status("Сначала выделите кабинеты на холсте", true);
  const amt = shiftAmt(st, axis) * sign;
  st.cabShift = st.cabShift || {};
  let n = 0;
  for (const k of ui.selected) {
    const p = parseKey(k);
    if (!p || p[0] < 0 || p[1] < 0 || p[0] >= st.cabCols || p[1] >= st.cabRows) continue;
    const o = (st.cabShift[k] || [0, 0]).slice();
    if (axis === "x") o[0] += amt; else o[1] += amt;
    if (o[0] === 0 && o[1] === 0) delete st.cabShift[k]; else st.cabShift[k] = o;
    n++;
  }
  changed({ forcePhys: true });
  const [W, H] = dims(st);
  status("Сдвиг ".concat(axis === "x" ? "по горизонтали" : "по вертикали", " на ").concat(amt, " px: ").concat(n, " каб. · разрешение ").concat(W, "×").concat(H), true);
}
for (const [id, ax] of [["cabPosX", "x"], ["cabPosY", "y"]]) $(id).addEventListener("input", () => setCabPos(ax, parseFloat(String($(id).value).replace(",", "."))));
for (const [id, ax, i] of [["cabPosCmX", "x", 0], ["cabPosCmY", "y", 1]]) $(id).addEventListener("input", () => {
  const st = S(), mm = mmPerPx(st)[i], v = parseFloat(String($(id).value).replace(",", "."));
  if (mm > 0 && isFinite(v)) setCabPos(ax, Math.round(v * 10 / mm * 100) / 100);
});
$("shiftL").onclick = () => shiftSel("x", -1);
$("shiftR").onclick = () => shiftSel("x", 1);
$("shiftU").onclick = () => shiftSel("y", 1);
$("shiftD").onclick = () => shiftSel("y", -1);
$("shiftReset").onclick = () => {
  const st = S();
  let n = 0;
  if (ui.selected.size) {
    for (const k of ui.selected) {
      if (st.cabShift && k in st.cabShift) {
        delete st.cabShift[k];
        n++;
      }
      if (st.cabRot && k in st.cabRot) {
        delete st.cabRot[k];
        n++;
      }
    }
  } else {
    n = Object.keys(st.cabShift || {}).length + Object.keys(st.cabRot || {}).length;
    st.cabShift = {};
    st.cabRot = {};
  }
  changed({ forcePhys: true });
  status(ui.selected.size ? "Сдвиг снят: ".concat(n, " каб.") : "Весь сдвиг экрана снят: ".concat(n), true);
};
function shiftFracBtns() {
  return [...document.querySelectorAll(".seg.shiftFrac button")];
}
shiftFracBtns().forEach((b) => b.onclick = () => {
  ui.shiftMode = { type: "frac", val: +b.dataset.f };
  shiftFracBtns().forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  const st = S();
  if (st.kind === "led") $("shiftPx").value = Math.round(st.cabWpx * ui.shiftMode.val);
  $("shiftCm").value = "";
  status("Величина сдвига = ".concat(b.textContent, " кабинета"), true);
});
$("shiftPx").oninput = () => {
  const v = Math.max(1, +$("shiftPx").value || 0);
  ui.shiftMode = { type: "px", val: v };
  $("shiftCm").value = "";
  shiftFracBtns().forEach((x) => x.setAttribute("aria-pressed", "false"));
};
$("shiftCm").oninput = () => {
  const v = Math.max(0, +$("shiftCm").value || 0);
  ui.shiftMode = { type: "cm", val: v };
  $("shiftPx").value = "";
  shiftFracBtns().forEach((x) => x.setAttribute("aria-pressed", "false"));
};
$("shiftRefLoad").onclick = () => $("refFile").click();
function selBox(st) {
  const cells = [...ui.selected].map(parseKey).filter((p) => p && p[0] < st.cabCols && p[1] < st.cabRows);
  if (!cells.length) return null;
  return { c0: Math.min(...cells.map((p) => p[0])), c1: Math.max(...cells.map((p) => p[0])), r0: Math.min(...cells.map((p) => p[1])), r1: Math.max(...cells.map((p) => p[1])) };
}
function edgeKeys(b, kind) {
  const out = [], V = (x) => {
    for (let r = b.r0; r <= b.r1; r++) out.push("v:".concat(x, ",").concat(r));
  }, H = (y) => {
    for (let c = b.c0; c <= b.c1; c++) out.push("h:".concat(c, ",").concat(y));
  };
  const inV = () => {
    for (let x = b.c0 + 1; x <= b.c1; x++) V(x);
  }, inH = () => {
    for (let y = b.r0 + 1; y <= b.r1; y++) H(y);
  };
  if (kind === "l") V(b.c0);
  if (kind === "r") V(b.c1 + 1);
  if (kind === "iv") inV();
  if (kind === "t") H(b.r1 + 1);
  if (kind === "b") H(b.r0);
  if (kind === "ih") inH();
  if (kind === "in") {
    inV();
    inH();
  }
  if (kind === "out") {
    V(b.c0);
    V(b.c1 + 1);
    H(b.r1 + 1);
    H(b.r0);
  }
  if (kind === "all") {
    V(b.c0);
    V(b.c1 + 1);
    H(b.r1 + 1);
    H(b.r0);
    inV();
    inH();
  }
  return out;
}
document.querySelectorAll(".seg.edges button").forEach((btn) => btn.onclick = () => {
  const st = S(), b = selBox(st);
  if (!b) {
    status("Сначала выделите кабинеты — границы нарисуются сразу", true);
    return;
  }
  const keys = edgeKeys(b, btn.dataset.edge);
  if (!keys.length) {
    status("Для одного кабинета внутренних границ нет", true);
    return;
  }
  const set = new Set(st.borders || []), allOn = keys.every((k) => set.has(k));
  for (const k of keys) allOn ? set.delete(k) : set.add(k);
  st.borders = [...set];
  st.showPersistentContour = true;
  changed();
  status(allOn ? "Границы убраны: ".concat(keys.length) : "Границы: ".concat(btn.title.toLowerCase(), " · ").concat(keys.length), true);
});
$("btnContourToggle").onclick = () => {
  const st = S();
  if (!(st.borders || []).length && !st.persistentContours.length && !st.autoContour) {
    status("Границ пока нет", true);
    return;
  }
  st.showPersistentContour = !st.showPersistentContour;
  changed();
  status(st.showPersistentContour ? "Границы показаны" : "Границы скрыты (сохранены)", true);
};
$("btnContourDel").onclick = () => {
  const st = S(), b = selBox(st);
  if (b) {
    const inBox = (k) => {
      const [t, a] = k.split(":"), [u, v] = a.split(",").map(Number);
      return t === "v" ? u >= b.c0 && u <= b.c1 + 1 && v >= b.r0 && v <= b.r1 : u >= b.c0 && u <= b.c1 && v >= b.r0 && v <= b.r1 + 1;
    };
    const n0 = (st.borders || []).length;
    st.borders = (st.borders || []).filter((k) => !inBox(k));
    changed();
    status("Убрано границ: ".concat(n0 - st.borders.length), true);
  } else {
    st.borders = [];
    st.persistentContours = [];
    st.showPersistentContour = true;
    changed();
    status("Все границы экрана убраны", true);
  }
};
$("activeText").addEventListener("change", (e) => {
  clearSelMore();
  ui.textMode = +e.target.value - 1;
  ui.selLabel = ui.textMode > 0 ? ui.textMode - 1 : -1;
  syncExtraControls();
  requestDraw();
  status(ui.textMode < 0 ? "Режим кабинетов: текст не выбран" : "Режим текста: перетащите его на холсте");
});
$("btnAddText").onclick = async () => {
  const t = await ask("Добавить текст", "", "Новый текст", "Добавить");
  if (!t) return;
  const st = S();
  st.extraLabels.push({ text: t, size: 120, x: 0, y: 0, rotation: 0 });
  clearSelMore();
  ui.textMode = st.extraLabels.length;
  refreshTextList();
  changed();
};
// 2.0.110: копия доп. текста (или всех выбранных) со всеми параметрами; Ctrl+C / Ctrl+V — в том числе в другую маску
function nextNumText(txt, all) {
  const re = /^([\s\S]*?)(\d+)(\D*)$/, m = txt.match(re);
  if (!m) return txt;
  let max = +m[2];
  for (const t of all) {
    const q = t.match(re);
    if (q && q[1] === m[1] && q[3] === m[3]) max = Math.max(max, +q[2]);
  }
  const n = String(max + 1);
  return m[1] + (m[2].length > 1 && m[2][0] === "0" ? n.padStart(m[2].length, "0") : n) + m[3];
}
function pasteTexts(list, shift) {
  const st = S();
  if (!list || !list.length) return;
  const [W, H] = dims(st), off = shift ? Math.max(8, Math.round(Math.min(W, H) * 0.03)) : 0, n0 = st.extraLabels.length;
  for (const it of list) {
    const c = JSON.parse(JSON.stringify(it));
    // 2.0.114: копия в той же маске — следующий номер по порядку (если в тексте есть число)
    if (shift) c.text = nextNumText(String(c.text || ""), st.extraLabels.map((l) => String(l.text || "")));
    c.x = (+c.x || 0) + off;
    c.y = (+c.y || 0) - off;
    st.extraLabels.push(c);
  }
  clearSelMore();
  for (let i = n0 + 1; i < st.extraLabels.length; i++) ui.selMore.add(i);
  ui.textMode = n0 + 1;
  refreshTextList();
  changed();
  status(list.length > 1 ? "Скопировано текстов: ".concat(list.length) : "Текст скопирован", true);
}
// 2.0.117: положение текста — 9 кнопок (углы, края, центр). Основной текст или выбранные доп. тексты.
function placeText(pos) {
  const st = S();
  if (!L || L.st !== st) return;
  const [W, H] = dims(st), s = L.scale, m = Math.round(Math.min(W, H) * 0.03);
  const at = (hw, hh) => {
    const dx = Math.max(0, W / 2 - hw - m), dy = Math.max(0, H / 2 - hh - m);
    return [pos.includes("l") ? -dx : pos.includes("r") ? dx : 0, pos.includes("t") ? dy : pos.includes("b") ? -dy : 0].map(Math.round);
  };
  const ids = selExtras();
  if (ids.length) {
    for (const i of ids) {
      const f = labelFrame(i), it = st.extraLabels[i];
      [it.x, it.y] = at(f.w / 2 / s, f.h / 2 / s);
    }
  } else {
    if (!titleLines(st, s).length) return status("Основной текст выключен", true);
    const f = titleFrame();
    [st.titleOffsetX, st.titleOffsetY] = at(f.w / 2 / s, f.h / 2 / s);
    if (ui.textMode !== 0) {
      ui.textMode = 0;
      refreshTextList();
    }
  }
  changed();
}
document.querySelectorAll("#txPos button").forEach((b) => b.onclick = () => placeText(b.dataset.pos));
$("btnCopyText").onclick = () => {
  const st = S(), ids = selExtras();
  if (!ids.length) {
    status("Сначала выберите дополнительный текст", true);
    return;
  }
  pasteTexts(ids.map((i) => st.extraLabels[i]), true);
};
window.addEventListener("keydown", (e) => {
  if (ui.page && ui.page !== "mask" || !$("modal").hidden) return;
  const t = e.target;
  if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
  const st = S();
  if (st.kind === "vol") {
    // 2.0.142: Esc — сброс зума/сдвига окна коммутации
    if (e.key === "Escape" && (ui.volView.z !== 1 || ui.volView.x || ui.volView.y)) {
      Object.assign(ui.volView, { z: 1, x: 0, y: 0 });
      volComDraw();
    }
    return;
  }
  const mod = e.ctrlKey || e.metaKey, k = (e.key || "").toLowerCase();
  if (mod && !e.altKey && (k === "c" || k === "с" || e.code === "KeyC") && selExtras().length && !String(window.getSelection && window.getSelection() || "")) {
    e.preventDefault();
    ui.textClip = { uid: st.uid, list: JSON.parse(JSON.stringify(selExtras().map((i) => st.extraLabels[i]))) };
    status(ui.textClip.list.length > 1 ? "Скопировано текстов: ".concat(ui.textClip.list.length, " — Ctrl+V, чтобы вставить") : "Текст скопирован — Ctrl+V, чтобы вставить", true);
    return;
  }
  if (mod && !e.altKey && (k === "v" || k === "м" || e.code === "KeyV") && ui.textClip) {
    e.preventDefault();
    pasteTexts(ui.textClip.list, ui.textClip.uid === st.uid);
    return;
  }
  if (mod && !e.altKey && (k === "d" || k === "в" || e.code === "KeyD") && selExtras().length) {
    e.preventDefault();
    $("btnCopyText").click();
    return;
  }
  // 2.0.141: Delete / Backspace удаляют выбранный доп. текст (как кнопка «Удалить»)
  if ((e.key === "Delete" || e.key === "Backspace") && selExtras().length) {
    e.preventDefault();
    $("btnDelText").click();
    return;
  }
  // 2.0.110: стрелки двигают выбранный текст (1 px, Shift — 10 px)
  const d = e.shiftKey ? 10 : 1, mv = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, d], ArrowDown: [0, -d] }[e.key];
  if (!mv || mod || e.altKey) return;
  const ids = selExtras();
  if (ids.length) {
    for (const i of ids) {
      const it = st.extraLabels[i];
      it.x = Math.round((+it.x || 0) + mv[0]);
      it.y = Math.round((+it.y || 0) + mv[1]);
    }
  } else if (ui.textMode === 0) {
    st.titleOffsetX = Math.round((+st.titleOffsetX || 0) + mv[0]);
    st.titleOffsetY = Math.round((+st.titleOffsetY || 0) + mv[1]);
  } else return;
  e.preventDefault();
  changed();
});
$("btnEditText").onclick = async () => {
  const it = S().extraLabels[ui.selLabel];
  if (!it) {
    status("Сначала выберите дополнительный текст", true);
    return;
  }
  const t = await ask("Изменить текст", "", it.text, "Сохранить");
  if (t == null) return;
  it.text = t;
  refreshTextList();
  changed();
};
$("btnDelText").onclick = () => {
  const st = S();
  if (!st.extraLabels[ui.selLabel]) return;
  const ids = selExtras().sort((a, b) => b - a);
  for (const i of ids) st.extraLabels.splice(i, 1);
  clearSelMore();
  if (ids.length > 1) status("Удалено текстов: ".concat(ids.length), true);
  ui.textMode = -1;
  refreshTextList();
  changed();
};
$("exSize").addEventListener("change", (e) => {
  const it = S().extraLabels[ui.selLabel];
  if (!it) return;
  const i = +e.target.value, [W, H] = dims(S());
  it.size = Math.max(6, Math.min(900, i === 0 ? autoSize(W, H, S().name) : pfloat(INSC[i]) || 120));
  changed();
});
const exStep = (d) => {
  const it = S().extraLabels[ui.selLabel];
  if (!it) return;
  it.size = Math.max(6, Math.min(900, it.size + d));
  $("exSize").value = sizeIndexFor(it.size);
  changed();
};
$("exPlus").onclick = () => exStep(10);
$("exMinus").onclick = () => exStep(-10);
$("exRot").addEventListener("change", (e) => {
  const it = S().extraLabels[ui.selLabel];
  if (!it) return;
  it.rotation = ROT_DEG[+e.target.value];
  changed();
});
$("screens").addEventListener("change", (e) => {
  project.cur = +e.target.value;
  ui.selected.clear();
  ui.anchor = null;
  ui.textMode = -1;
  syncUI();
  changed({ forcePhys: true });
});
$("btnAddScreen").onclick = () => {
  const base = JSON.parse(JSON.stringify(S()));
  Object.assign(base, { borders: [], name: base.kind === "ring" ? "ring" : base.kind && base.kind !== "led" ? "".concat({ proj: "projection", tv: "tv", pix: "pixel drop", tube: "led tube", vol: "volumetric" }[base.kind], " ").concat(project.screens.filter((x) => x.kind === base.kind).length + 1) : "screen ".concat(project.screens.length + 1), blackCabinets: [], cabinetColors: {}, persistentContours: [], showPersistentContour: true, extraLabels: [], cacheShapes: [], cornerCabinets: {}, shapedCols: {}, shapedRows: {}, cabShift: {} });
  delete base.field;
  base.uid = newUid();
  project.screens.push(base);
  project.cur = project.screens.length - 1;
  ui.selected.clear();
  ui.textMode = -1;
  syncUI();
  changed();
};
// Копия текущего экрана со всеми настройками; номер (и имя вида «screen N») — автоматически
function copyScreen() {
  const src = S(), base = JSON.parse(JSON.stringify(src));
  delete base.field;
  base.file = "";
  base.uid = newUid();
  const nm = String(src.name || "").trim(), DEF = { led: "screen", proj: "projection", tv: "tv", pix: "pixel drop", tube: "led tube", vol: "volumetric" }, kind = base.kind || "led";
  if (!nm || /^(screen|projection|projector|tv|pixel drop|led tube|volumetric) \d+$/i.test(nm)) base.name = kind === "led" ? "screen ".concat(project.screens.length + 1) : "".concat(DEF[kind], " ").concat(project.screens.filter((x) => (x.kind || "led") === kind).length + 1);
  else {
    const m = nm.match(/^(.*?)(\d+)$/);
    if (m) {
      // своё имя с числом на конце: следующее свободное число
      let n = +m[2] + 1;
      while (project.screens.some((x) => String(x.name || "").trim() === m[1] + n)) n++;
      base.name = m[1] + n;
    }
  }
  project.screens.push(base);
  project.cur = project.screens.length - 1;
  ui.selected.clear();
  ui.textMode = -1;
  ui.selShape = -1;
  syncUI();
  changed({ forcePhys: true });
  status("Скопирован экран «".concat(nm || "без имени", "» → ").concat(project.cur + 1, ". ").concat(base.name), true);
}
// 2.0.100: стандартные имена (screen N, projection N…) — по текущему порядку; свои имена не трогаем
function renumberScreens() {
  const DEF = { led: "screen", proj: "projection", tv: "tv", pix: "pixel drop", tube: "led tube", vol: "volumetric" }, cnt = {};
  project.screens.forEach((s, i) => {
    const kind = s.kind || "led";
    cnt[kind] = (cnt[kind] || 0) + 1;
    const nm = String(s.name || "").trim();
    if (nm && !/^(screen|projection|projector|tv|pixel drop|led tube|volumetric) \d+$/i.test(nm)) return;
    s.name = kind === "led" ? "screen ".concat(i + 1) : "".concat(DEF[kind] || kind, " ").concat(cnt[kind]);
  });
}
$("scrRenum").onchange = (e) => {
  project.renumber = e.target.checked;
  if (project.renumber) {
    renumberScreens();
    syncUI();
    changed({ list: true });
    scheduleStrip();
  } else changed();
};
$("btnDelScreen").onclick = async () => {
  if (project.screens.filter(inMode).length <= 1) {
    status(appMode() === "vol" ? "Это единственный волюметрик" : "Это единственный экран", true);
    return;
  }
  const ok = await ask("Удалить экран?", "«".concat(S().name, "» будет удалён из проекта."), "", "Удалить", false);
  if (!ok) return;
  project.screens.splice(project.cur, 1);
  project.cur = Math.min(project.cur, project.screens.length - 1);
  if (!inMode(S())) {
    // соседний экран того же режима
    let j = -1;
    for (let k = project.cur; k >= 0 && j < 0; k--) if (inMode(project.screens[k])) j = k;
    if (j < 0) j = project.screens.findIndex(inMode);
    project.cur = Math.max(0, j);
  }
  if (project.renumber !== false) renumberScreens();
  ui.selected.clear();
  ui.textMode = -1;
  syncUI();
  changed();
};
// 2.0.74: «Новый» вместо «Сброс»; при несохранённых изменениях — «Сохранить / Не сохранять / Отмена»
$("btnNewProj").onclick = async () => {
  if (isDirty()) {
    if (!await guardUnsaved()) return;
  } else if (!await ask("Новый проект?", "Все экраны, общие поля и настройки ТЗ вернутся к значениям по умолчанию — как раньше по кнопке «Сброс».", "", "Новый", false)) return;
  project = { name: "Проект", screens: [defaultScreen()], cur: 0, guides: { circle: true, diag: true }, ...freshFieldState() };
  clearOverview();
  Object.assign(ui, { selected: /* @__PURE__ */ new Set(), anchor: null, textMode: -1, selLabel: -1, zoom: 1, panX: 0, panY: 0, paint: { ...DEF_PAINT } });
  projHandle = null;
  adrUnlocked = false; // 2.0.135: платные функции — снова закрыты до секретного кода
  Object.assign(ui, { tzTpl: "Resolume", tzFlatTpl: "Resolume", tzSubManual: false, tzSel: "req", volPick: false, volPickList: [], volBlank: false, textMode: -1, tzPick: "", tzZoom: -1, tzView: { z: 1, x: 0, y: 0 } });
  Object.assign(vol3d, { yaw: -0.6, pitch: 0.42, zoom: 1 });
  Object.assign(ui.volView, { z: 1, x: 0, y: 0 });
  // 2.0.127: нарезка и мэппинг — тоже по умолчанию (и их панели, ленты, вид)
  Object.assign(ui_out, { sel: "", drag: null, V: { z: 1, x: 0, y: 0 } });
  for (const u of [window.cabTypeUI, window.rgTypeUI, window.screensUI, window.rgListUI]) if (u) u.close();
  syncUI();
  if (ui.page === "field") {
    FV.fitted = false;
    refreshFieldPanel();
  }
  if (ui.page === "tz") {
    refreshTZPanel();
    syncTzTpl();
    refreshTZText();
  }
  if (ui.page === "cut") refreshCutPanel();
  if (ui.page === "out") refreshOutPanel();
  changed({ forcePhys: true });
  markSaved();
  status("Новый проект", true);
};
document.querySelectorAll(".seg.tools button").forEach((b) => b.onclick = () => {
  ui.tool = b.dataset.tool;
  document.querySelectorAll(".seg.tools button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
});
// 2.0.181: кнопки масштаба работают во всех разделах (маска, нарезка, общее поле, мэппинг, ТЗ, волюметрик)
$("zMinus").onclick = () => {
  zoomTarget().step(1 / 1.25);
  requestDraw();
};
$("zPlus").onclick = () => {
  zoomTarget().step(1.25);
  requestDraw();
};
$("zAuto").onclick = () => {
  zoomTarget().auto();
  requestDraw();
};
const hist = { stack: [], i: -1, timer: 0 };
const histSnap = () => JSON.stringify({ name: project.name, guides: project.guides, screens: project.screens, fields: project.fields, cuts: project.cuts, outs: project.outs, tz: project.tz });
function histCommit() {
  clearTimeout(hist.timer);
  hist.timer = 0;
  const s = histSnap();
  if (hist.i >= 0 && hist.stack[hist.i].s === s) return;
  hist.stack.splice(hist.i + 1);
  hist.stack.push({ s, cur: project.cur });
  if (hist.stack.length > 100) hist.stack.shift();
  hist.i = hist.stack.length - 1;
  updateUndoButtons();
}
function scheduleHistory() {
  if (hist.lock) return;
  clearTimeout(hist.timer);
  hist.timer = setTimeout(() => {
    if (pointers.size || fld.pointers.size) scheduleHistory();
    else histCommit();
  }, 350);
}
function updateUndoButtons() {
  $("btnUndo").disabled = hist.i <= 0;
  $("btnRedo").disabled = hist.i >= hist.stack.length - 1;
}
function histGo(d) {
  if (hist.timer) histCommit();
  const j = hist.i + d;
  if (j < 0 || j >= hist.stack.length) {
    status(d < 0 ? "Отменять больше нечего" : "Возвращать больше нечего");
    return;
  }
  const cur = (d < 0 ? hist.stack[hist.i] : hist.stack[j]).cur;
  const o = JSON.parse(hist.stack[j].s);
  const fs0 = freshFieldState();
  project = { mode: project.mode, renumber: project.renumber, ver: project.ver, cuts: o.cuts || project.cuts || [], cutCur: project.cutCur || 0, outs: o.outs || project.outs || [], outCur: project.outCur || 0, name: o.name, guides: o.guides, screens: o.screens, fields: o.fields || fs0.fields, tz: o.tz || fs0.tz, fieldCur: Math.min(project.fieldCur || 0, (o.fields || fs0.fields).length - 1), cur: Math.max(0, Math.min(o.screens.length - 1, cur)) };
  hist.i = j;
  ui.textMode = -1;
  ui.selLabel = -1;
  hist.lock = true;
  syncUI();
  changed({ forcePhys: true });
  if (ui.page === "cut") refreshCutPanel();
  if (ui.page === "out") refreshOutPanel();
  hist.lock = false;
  updateUndoButtons();
  status(d < 0 ? "Отменено · осталось шагов назад: ".concat(hist.i) : "Возвращено · шагов вперёд: ".concat(hist.stack.length - 1 - hist.i));
}
$("btnUndo").onclick = () => histGo(-1);
$("btnRedo").onclick = () => histGo(1);
window.addEventListener("keydown", (e) => {
  if (!(e.ctrlKey || e.metaKey) || e.altKey || !$("modal").hidden) return;
  const t = e.target, tag = t && t.tagName;
  if (tag === "INPUT" && !["checkbox", "color", "range", "button"].includes(t.type) || tag === "TEXTAREA") return;
  const k = e.key.toLowerCase(), code = e.code;
  if ((k === "z" || k === "я" || code === "KeyZ") && !e.shiftKey) {
    e.preventDefault();
    histGo(-1);
  } else if ((k === "z" || k === "я" || code === "KeyZ") && e.shiftKey || k === "y" || k === "н" || code === "KeyY") {
    e.preventDefault();
    histGo(1);
  }
});
let autosaveTimer = 0;
function scheduleAutosave() {
  scheduleHistory();
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    try {
      localStorage.setItem("ledmask.project", JSON.stringify(projectData(true)));
    } catch (e) {
      try {
        localStorage.setItem("ledmask.project", JSON.stringify({ ...projectData(), refImages: {}, overviewImages: [] }));
      } catch (e2) {
      }
    }
    updateProjState();
  }, 500);
}
// 2.0.112: картинки общего плана для автосохранения и «Последних» — в IndexedDB (localStorage ~5 МБ их не вмещал
// и молча выбрасывал); в этих копиях проекта вместо JPEG — ссылка ref. В файл проекта и ТЗ JPEG пишется целиком, как раньше.
const IMGDB = (() => {
  let p = null;
  const open = () => p || (p = new Promise((res) => {
    try {
      const r = indexedDB.open("ledmask-img", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("img");
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
      r.onblocked = () => res(null);
    } catch (e) {
      res(null);
    }
  }));
  // не дольше 4 с: на старых WebKit (Mac 10.14) IndexedDB для file:// может не отвечать
  const lim = (pr) => Promise.race([pr, new Promise((r) => setTimeout(() => r(null), 4e3))]);
  const run = (mode, fn) => lim(open()).then((db) => db ? lim(new Promise((res) => {
    try {
      const t = db.transaction("img", mode), q = fn(t.objectStore("img"));
      t.oncomplete = () => res(mode === "readwrite" ? true : q.result);
      t.onerror = t.onabort = () => res(null);
    } catch (e) {
      res(null);
    }
  })) : null);
  return { put: (k, v) => run("readwrite", (s) => s.put(v, k)), get: (k) => run("readonly", (s) => s.get(k)), keys: () => run("readonly", (s) => s.getAllKeys()), del: (k) => run("readwrite", (s) => s.delete(k)) };
})();
function ovKey(b) {
  let h = 2166136261;
  for (let i = 0; i < b.length; i++) h = Math.imul(h ^ b[i], 16777619);
  return "ov-" + b.length + "-" + (h >>> 0).toString(36);
}
function ovStore(im) {
  const b = im.baseJpeg || im.jpeg;
  if (!b || im.ref && im.refP) return im.refP;
  im.ref = ovKey(b);
  im.refP = IMGDB.put(im.ref, b).then((ok) => im.refOk = !!ok);
  return im.refP;
}
function projectData(lite) {
  return {
    version: "4.0",
    projectName: project.name,
    projectVersion: String(project.ver || ""),
    mode: appMode(),
    activeScreen: project.cur,
    guides: project.guides,
    screens: project.screens,
    fieldCur: project.fieldCur,
    renumber: project.renumber !== false,
    tz: project.tz,
    refImages: refUsed(),
    // 2.0.92: картинки общего плана (для ТЗ) — в файле проекта: исходник JPEG, подпись и номера экранов
    overviewImages: ui.images.map((im) => {
      const o = { id: im.id, name: im.name, caption: im.caption, w: im.w, h: im.h, marks: im.marks || [], markR: im.markR };
      if (lite) {
        ovStore(im);
        if (im.refOk) return { ...o, ref: im.ref };
      }
      return { ...o, jpeg: "data:image/jpeg;base64," + bytesToB64(im.baseJpeg || im.jpeg) };
    }),
    cuts: project.cuts || [],
    cutCur: project.cutCur || 0,
    outs: project.outs || [],
    outCur: project.outCur || 0,
    fields: project.fields.map((f) => ({ ...f, items: f.items.map((it) => ({ ...it, si: project.screens.findIndex((s) => s.uid === it.uid) })) }))
  };
}
function loadData(d) {
  if (d && d.refImages && typeof d.refImages === "object") {
    for (const [k, v] of Object.entries(d.refImages)) if (typeof v === "string" && v.startsWith("data:image/")) REF_IMGS[k] = v;
  }
  const raw = Array.isArray(d.screens) ? d.screens : [d];
  const screens = raw.filter((x) => x && typeof x === "object").map(normalizeScreen);
  project = { name: typeof d.projectName === "string" ? safeName(d.projectName, "Проект") : project.name, screens: screens.length ? screens : [defaultScreen()], cur: 0, guides: { circle: true, diag: true, ...d.guides || {} } };
  loadFieldState(d, raw.filter((x) => x && typeof x === "object"));
  project.renumber = d.renumber !== false;
  // 2.0.130: режим; в старых проектах — по текущему экрану
  project.mode = d.mode === "vol" || d.mode !== "led" && project.screens[project.cur] && project.screens[project.cur].kind === "vol" ? "vol" : "led";
  if (!project.screens.some(inMode)) project.mode = project.mode === "vol" ? "led" : "vol";
  if (!inMode(project.screens[project.cur] || {})) project.cur = Math.max(0, project.screens.findIndex(inMode));
  project.ver = typeof d.projectVersion === "string" ? d.projectVersion.slice(0, 20) : "";
  if (project.tz.tpl) {
    ui.tzTpl = project.tz.tpl;
    ui.tzSubManual = false;
    if (!/^Vol/.test(ui.tzTpl)) ui.tzFlatTpl = ui.tzTpl;
  } else {
    ui.tzTpl = ui.tzFlatTpl = "Resolume";
    ui.tzSubManual = false;
  }
  if (ui.page === "tz") setTimeout(() => {
    syncTzTpl();
    refreshTZPanel();
    refreshTZText();
    requestDraw();
  }, 0);
  clearOverview();
  ui.ovReady = Array.isArray(d.overviewImages) && d.overviewImages.length ? restoreOverview(d.overviewImages) : Promise.resolve();
  project.cur = clampI(d.activeScreen, project.screens.length);
  ui.selected.clear();
  ui.anchor = null;
  ui.textMode = -1;
}
function parsePlist(text) {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("файл повреждён");
  const root = doc.querySelector("plist > *");
  const conv = (el) => {
    switch (el.tagName) {
      case "dict": {
        const o = {};
        const kids = [...el.children];
        for (let i = 0; i < kids.length; i += 2) o[kids[i].textContent] = conv(kids[i + 1]);
        return o;
      }
      case "array":
        return [...el.children].map(conv);
      case "string":
        return el.textContent;
      case "integer":
        return parseInt(el.textContent, 10);
      case "real":
        return parseFloat(el.textContent);
      case "true":
        return true;
      case "false":
        return false;
      default:
        return el.textContent;
    }
  };
  return conv(root);
}
function toPlist(obj) {
  const esc = (v) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const w = (v, ind) => {
    const p = "	".repeat(ind);
    if (Array.isArray(v)) return v.length ? "".concat(p, "<array>\n").concat(v.map((x) => w(x, ind + 1)).join("")).concat(p, "</array>\n") : "".concat(p, "<array/>\n");
    if (v && typeof v === "object") {
      const ks = Object.keys(v).sort();
      return ks.length ? "".concat(p, "<dict>\n").concat(ks.map((k) => "".concat(p, "	<key>").concat(esc(k), "</key>\n").concat(w(v[k], ind + 1))).join("")).concat(p, "</dict>\n") : "".concat(p, "<dict/>\n");
    }
    if (typeof v === "boolean") return "".concat(p, "<").concat(v, "/>\n");
    if (typeof v === "number") return Number.isInteger(v) ? "".concat(p, "<integer>").concat(v, "</integer>\n") : "".concat(p, "<real>").concat(v, "</real>\n");
    return "".concat(p, "<string>").concat(esc(v != null ? v : ""), "</string>\n");
  };
  return '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n'.concat(w(obj, 0), "</plist>\n");
}
function ledmaskData() {
  const d = projectData();
  d.screens = d.screens.map((st) => {
    const [w, h] = physM(st);
    return { ...st, physicalWidthM: w, physicalHeightM: h };
  });
  return d;
}
const CRC_T = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf, crc = 0) {
  crc = ~crc >>> 0;
  for (let i = 0; i < buf.length; i++) crc = CRC_T[(crc ^ buf[i]) & 255] ^ crc >>> 8;
  return ~crc >>> 0;
}
async function streamBytes(stream) {
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function deflateRaw(bytes) {
  return HAS_CS ? streamBytes(new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"))) : nativeZ("deflate", "raw", bytes);
}
async function inflateRaw(bytes) {
  return HAS_CS ? streamBytes(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"))) : nativeZ("inflate", "raw", bytes);
}
const enc = new TextEncoder(), dec = new TextDecoder();
const b64ToBytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
async function unzip(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0; i--) if (dv.getUint32(i, true) === 101010256) {
    eocd = i;
    break;
  }
  if (eocd < 0) throw new Error("не ZIP");
  const n = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const files = [];
  for (let i = 0; i < n; i++) {
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), lho = dv.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + xlen + clen;
    if (name.endsWith("/")) continue;
    const ds = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true);
    const raw = bytes.subarray(ds, ds + csize);
    files.push({ name, data: method === 8 ? await inflateRaw(raw) : raw.slice() });
  }
  return files;
}
async function zip(entries) {
  const parts = [], central = [];
  let off = 0;
  const dt = /* @__PURE__ */ new Date(), dosTime = dt.getHours() << 11 | dt.getMinutes() << 5 | dt.getSeconds() >> 1, dosDate = dt.getFullYear() - 1980 << 9 | dt.getMonth() + 1 << 5 | dt.getDate();
  for (const e of entries) {
    const name = enc.encode(e.name), crc = crc32(e.data);
    const store = /\.(png|zip)$/i.test(e.name);
    const body = store ? e.data : await deflateRaw(e.data), method = store ? 0 : 8;
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 67324752, true);
    lh.setUint16(4, 20, true);
    lh.setUint16(6, 2048, true);
    lh.setUint16(8, method, true);
    lh.setUint16(10, dosTime, true);
    lh.setUint16(12, dosDate, true);
    lh.setUint32(14, crc, true);
    lh.setUint32(18, body.length, true);
    lh.setUint32(22, e.data.length, true);
    lh.setUint16(26, name.length, true);
    parts.push(new Uint8Array(lh.buffer), name, body);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 33639248, true);
    ch.setUint16(4, 20, true);
    ch.setUint16(6, 20, true);
    ch.setUint16(8, 2048, true);
    ch.setUint16(10, method, true);
    ch.setUint16(12, dosTime, true);
    ch.setUint16(14, dosDate, true);
    ch.setUint32(16, crc, true);
    ch.setUint32(20, body.length, true);
    ch.setUint32(24, e.data.length, true);
    ch.setUint16(28, name.length, true);
    ch.setUint32(42, off, true);
    central.push(new Uint8Array(ch.buffer), name);
    off += 30 + name.length + body.length;
  }
  const csize = central.reduce((a, b) => a + b.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 101010256, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, csize, true);
  end.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: "application/zip" });
}
function pngChunk(type, data) {
  const out = new Uint8Array(12 + data.length), dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  out.set(enc.encode(type), 4);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}
async function renderPNG(st, onBand) {
  const [W, H] = dims(st);
  return renderBands(W, H, (ctx) => drawMask(ctx, st, 1, guidesOf(st)), onBand);
}
async function renderBands(W, H, paint, onBand) {
  const band = Math.max(1, Math.min(H, Math.floor(6e6 / W)));
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = band;
  const ctx = cv.getContext("2d", { willReadFrequently: true, alpha: false });
  const cs = HAS_CS ? new CompressionStream("deflate") : null, bands = [];
  const pz = !cs && !DESKTOP && window.pako ? new window.pako.Deflate({ level: 6 }) : null;
  const writer = cs ? cs.writable.getWriter() : pz ? { write: async (b) => {
    pz.push(b, false);
  }, close: async () => {
    pz.push(new Uint8Array(0), true);
    if (pz.err) throw new Error(pz.msg || "ошибка сжатия");
  } } : { write: async (b) => {
    bands.push(b);
  }, close: async () => {
  } };
  const outP = cs ? streamBytes(cs.readable) : null;
  const prev = new Uint8Array(W * 3), rowLen = W * 3 + 1;
  for (let y0 = 0; y0 < H; y0 += band) {
    const h = Math.min(band, H - y0);
    ctx.setTransform(1, 0, 0, 1, 0, -y0);
    paint(ctx);
    const px = ctx.getImageData(0, 0, W, h).data, buf = new Uint8Array(rowLen * h);
    for (let y = 0; y < h; y++) {
      const o2 = y * rowLen, first = y0 + y === 0;
      buf[o2] = first ? 0 : 2;
      for (let x = 0, i = y * W * 4; x < W; x++, i += 4) {
        const j = x * 3, r = px[i], g = px[i + 1], b = px[i + 2];
        if (first) {
          buf[o2 + 1 + j] = r;
          buf[o2 + 2 + j] = g;
          buf[o2 + 3 + j] = b;
        } else {
          buf[o2 + 1 + j] = r - prev[j] & 255;
          buf[o2 + 2 + j] = g - prev[j + 1] & 255;
          buf[o2 + 3 + j] = b - prev[j + 2] & 255;
        }
        prev[j] = r;
        prev[j + 1] = g;
        prev[j + 2] = b;
      }
    }
    await writer.write(buf);
    if (onBand) await onBand(Math.min(1, (y0 + h) / H));
  }
  await writer.close();
  let idat;
  if (cs) idat = await outP;
  else if (pz) idat = pz.result;
  else {
    const all = new Uint8Array(bands.reduce((a, b) => a + b.length, 0));
    let q = 0;
    for (const b of bands) {
      all.set(b, q);
      q += b.length;
    }
    idat = await zlibDeflate(all);
  }
  const ihdr = new Uint8Array(13), dv = new DataView(ihdr.buffer);
  dv.setUint32(0, W);
  dv.setUint32(4, H);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const parts = [sig, pngChunk("IHDR", ihdr), pngChunk("IDAT", idat), pngChunk("IEND", new Uint8Array(0))];
  const out = new Uint8Array(parts.reduce((a, b) => a + b.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return { png: out, w: W, h: H };
}
const REL_IMAGE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";
const REL_SLIDE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide";
const REL_NOTES = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide";
const CT_SLIDE = "application/vnd.openxmlformats-officedocument.presentationml.slide+xml";
const xmlEsc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const SLIDE_W = 7562850, SLIDE_H = 10696575;
const BOX = { x: 457200, y: 219e4, w: 6648602, h: 769e4 }, GAP = 165e3, LABEL_H = 22e4, LABEL_GAP = 35e3;
const labelPt = (text, wEmu) => {
  mctxRT.font = '10px Arial, "Liberation Sans", Helvetica, sans-serif';
  const tw = mctxRT.measureText(text || "").width;
  return Math.max(5, Math.min(10, 10 * (wEmu / PT) * 0.97 / Math.max(1, tw)));
};
// 2.0.147: раскладка слайда со смешанной ориентацией — полосами: горизонтальные во всю ширину сверху,
// вертикальные рядом под ними (ряд меняется при смене ориентации или при заполнении). Маски — максимально крупно.
function mixedBandCells(dims, B = BOX) {
  const rows = [];
  for (let i = 0; i < dims.length; i++) {
    const h0 = dims[i].w >= dims[i].h, lim = h0 ? 3 : 4, last = rows[rows.length - 1];
    if (last && last.hz === h0 && last.a.length < lim) last.a.push(i);
    else rows.push({ hz: h0, a: [i] });
  }
  // натуральная высота картинок в каждом ряду — по ширине поля
  const info = rows.map((r) => {
    const sumR = r.a.reduce((t, i) => t + dims[i].w / Math.max(1, dims[i].h), 0);
    const hImg = (B.w - GAP * (r.a.length - 1)) / Math.max(1e-6, sumR);
    return { hImg, band: LABEL_H + LABEL_GAP + hImg };
  });
  const totNat = info.reduce((t, r) => t + r.band, 0) + GAP * (rows.length - 1);
  const avail = B.h, labels = rows.length * (LABEL_H + LABEL_GAP) + GAP * (rows.length - 1);
  const f = totNat > avail ? (avail - labels) / Math.max(1, totNat - labels) : 1;
  const bands = info.map((r) => ({ hImg: r.hImg * f, band: LABEL_H + LABEL_GAP + r.hImg * f }));
  const totH = bands.reduce((t, r) => t + r.band, 0) + GAP * (rows.length - 1);
  let y = B.y + Math.max(0, Math.floor((avail - totH) / 2));
  const cells = [];
  rows.forEach((r, ri) => {
    const hImg = bands[ri].hImg;
    const ws = r.a.map((i) => Math.round(dims[i].w * hImg / Math.max(1, dims[i].h)));
    const rowW = ws.reduce((t, v) => t + v, 0) + GAP * (r.a.length - 1);
    let x = B.x + Math.max(0, Math.floor((B.w - rowW) / 2));
    r.a.forEach((i, k) => {
      cells[i] = { label: [x, y, ws[k], LABEL_H], image: [x, y + LABEL_H + LABEL_GAP, ws[k], Math.round(hImg)] };
      x += ws[k] + GAP;
    });
    y += bands[ri].band + GAP;
  });
  return cells;
}
function maskCellLayout(hz, n, j, w, h, B = BOX, info, topAlign, fixedScale) {
  if (hz && typeof hz === "object" && hz.mixed) {
    const cell = mixedBandCells(hz.mixed, B)[j] || { label: [B.x, B.y, 1, LABEL_H], image: [B.x, B.y, 1, 1] };
    if (fixedScale > 0) {
      // одинаковый размер — ужимаем до общего масштаба, но не больше ячейки; центрируем в ячейке
      const [ix, iy, iw, ih] = cell.image, ew = Math.min(iw, Math.round(w * fixedScale)), eh = Math.min(ih, Math.round(h * fixedScale));
      cell.image = [ix + Math.floor((iw - ew) / 2), iy, ew, eh];
    }
    return cell;
  }
  if (info && info.length) {
    // 2.0.69: 3D волюметрика + «Информация» текстом справа от картинки
    const L0 = maskCellLayout(hz, n, j, 1, 1, B), [cx0, ly, cw] = L0.label, cell = L0.label, chT = L0.image[1] + L0.image[3] - ly;
    const span = hz && typeof hz === "object" && hz.spanLast && j === n - 1 && j % hz.cols === 0;
    const full = span ? B.w : cw, x0 = span ? B.x : cx0;
    const G = hz && typeof hz === "object" ? hz : { cols: 1, rows: 1 };
    const chh = Math.floor((B.h - GAP * (G.rows - 1)) / G.rows), cy0 = B.y + Math.floor(j / G.cols) * (chh + GAP);
    const ih = Math.max(1, chh - LABEL_H - LABEL_GAP), iwMax = Math.round(full * 0.56), tw = full - iwMax - GAP;
    const sc = Math.min(iwMax / Math.max(1, w), ih / Math.max(1, h)), ew = Math.round(w * sc), eh = Math.round(h * sc);
    const by = cy0 + Math.floor((chh - (LABEL_H + LABEL_GAP + eh)) / 2), iy = by + LABEL_H + LABEL_GAP;
    void cell, void chT;
    return { label: [x0, by, full, LABEL_H], image: [x0 + iwMax - ew, iy, ew, eh], info: [x0 + iwMax + GAP, iy, tw, eh] };
  }
  const G = hz && typeof hz === "object" ? hz : hz ? { cols: 1, rows: n } : { cols: n, rows: 1 };
  // spanLast: последняя картинка одна в своём ряду — во всю ширину (волюметрик: вид сверху и снизу рядом, 3D под ними)
  const span = G.spanLast && j === n - 1 && j % G.cols === 0;
  const cw = span ? B.w : Math.floor((B.w - GAP * (G.cols - 1)) / G.cols), chh = Math.floor((B.h - GAP * (G.rows - 1)) / G.rows);
  const cx0 = span ? B.x : B.x + j % G.cols * (cw + GAP), cy0 = B.y + Math.floor(j / G.cols) * (chh + GAP);
  const ih = Math.max(1, chh - LABEL_H - LABEL_GAP);
  // 2.0.146: fixedScale — одинаковые по разрешению маски одного размера на разных слайдах; не больше, чем помещается в ячейку
  const fit = Math.min(cw / Math.max(1, w), ih / Math.max(1, h)), sc = fixedScale > 0 ? Math.min(fixedScale, fit) : fit;
  const ew = Math.round(w * sc), eh = Math.round(h * sc);
  // 2.0.146: topAlign — при пояснительном тексте маска прижимается кверху ячейки, ближе к тексту
  const by = topAlign ? cy0 : cy0 + Math.floor((chh - (LABEL_H + LABEL_GAP + eh)) / 2), ix = cx0 + Math.floor((cw - ew) / 2);
  return { label: [cx0, by, cw, LABEL_H], image: [ix, by + LABEL_H + LABEL_GAP, ew, eh] };
}
// 2.0.60: вид сверху, вид снизу и 3D волюметрика — вместе на одном листе (по 3), отдельно от масок
const volExtra = (m) => /^v[cb3]:/.test(m.key || "");
function autoGroupOne(masks, i) {
  const hz = masks[i].w >= masks[i].h, ve = volExtra(masks[i]), lim = ve ? 3 : hz ? 3 : 2, g = [];
  while (i < masks.length && g.length < lim && (ve ? volExtra(masks[i]) : masks[i].w >= masks[i].h === hz && !volExtra(masks[i]))) g.push(i++);
  return { hz: ve && g.length === 3 ? { cols: 2, rows: 2, spanLast: true } : ve && g.length > 1 ? autoGrid(masks, g) : hz, g, next: i };
}
function groupMasks(masks) {
  const groups = [];
  let i = 0;
  while (i < masks.length) {
    const grp = autoGroupOne(masks, i);
    groups.push({ hz: grp.hz, g: grp.g });
    i = grp.next;
  }
  return groups;
}
const PT = 12700, RT_FONT = 'Arial, "Liberation Sans", Helvetica, sans-serif', RT_LH = 1.2;
const xmlUn = (s) => String(s).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d)).replace(/&amp;/g, "&");
const hexU = (c) => c ? String(c).toUpperCase() : null;
function runsMd(runs) {
  let out = "", col2 = null, bold = false;
  for (const r of runs) {
    if (!r.t) continue;
    const c = r.link ? null : hexU(r.color);
    if (c !== col2) {
      if (bold) {
        out += "**";
        bold = false;
      }
      if (col2) out += "[/]";
      if (c) out += "[" + c + "]";
      col2 = c;
    }
    if (!!r.b !== bold) {
      out += "**";
      bold = !!r.b;
    }
    out += r.t;
  }
  if (bold) out += "**";
  if (col2) out += "[/]";
  return out;
}
function mdRuns(line, base = {}) {
  const out = [];
  let bold = false, col2 = null, size = null;
  for (const tok of String(line).split(/(\*\*|\[#[0-9A-Fa-f]{6}\]|\[\/\]|\[s\d{1,2}(?:\.\d)?\]|\[\/s\])/)) {
    if (!tok) continue;
    if (tok === "**") {
      bold = !bold;
      continue;
    }
    if (tok === "[/s]") {
      size = null;
      continue;
    }
    if (/^\[s\d/.test(tok)) {
      size = Math.max(4, Math.min(72, parseFloat(tok.slice(2))));
      continue;
    }
    if (tok === "[/]") {
      col2 = null;
      continue;
    }
    if (/^\[#[0-9A-Fa-f]{6}\]$/.test(tok)) {
      col2 = tok.slice(1, 8).toUpperCase();
      continue;
    }
    tok.split(/(https?:\/\/[^\s\[*]+)/).forEach((u, k) => {
      if (u) {
        const r = { ...base, t: u, b: bold, color: k % 2 ? null : col2, link: k % 2 === 1 ? u : null };
        if (size) r.sz = size;
        out.push(r);
      }
    });
  }
  return out;
}
const mdParas = (text) => String(text || "").replace(/\r/g, "").split("\n").map((l) => mdRuns(l));
const tplCache = {};
// Текстовые блоки слайда 1 (заголовок и разделы), в порядке шаблона. Ключ блока: последний — label
// (как в прошлых версиях, чтобы старые правки сохранились), остальные — label#номер.
async function tplBlocks(label) {
  if (tplCache[label + "@all"]) return tplCache[label + "@all"];
  const files = await unzip(b64ToBytes(TPL[label])), get = (n) => {
    const f = files.find((x) => x.name === n);
    return f ? dec.decode(f.data) : "";
  };
  const slide = get("ppt/slides/slide1.xml"), theme = get("ppt/theme/theme1.xml"), rels = get("ppt/slides/_rels/slide1.xml.rels");
  const clr = {};
  for (const m of theme.matchAll(/<a:(\w+)>\s*<a:(?:srgbClr val|sysClr val="\w+" lastClr)="([0-9A-Fa-f]{6})"/g)) clr[m[1]] = "#" + m[2];
  clr.tx1 = clr.dk1 || "#000000";
  const link = {};
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = (m[0].match(/Id="([^"]+)"/) || [])[1], t = (m[0].match(/Target="([^"]+)"/) || [])[1];
    if (id && /hyperlink/.test(m[0])) link[id] = xmlUn(t);
  }
  const sps = (slide.match(/<p:sp>[\s\S]*?<\/p:sp>/g) || []).filter((x) => x.includes("<p:txBody>") && /<a:t>[^<]+<\/a:t>/.test(x));
  const blocks = sps.map((sp, idx) => tplBlock(label, idx === sps.length - 1 ? label : label + "#" + idx, idx, sp, clr, link));
  blocks.forEach((b) => tplCache[b.label] = b);
  tplCache[label + "@all"] = blocks;
  return blocks;
}
async function tplInfo(label) {
  const bl = await tplBlocks(label);
  return bl[bl.length - 1];
}
function tplBlock(tpl, label, idx, sp, clr, link) {
  const off = sp.match(/<a:off x="(\d+)" y="(\d+)"\/>/), ext = sp.match(/<a:ext cx="(\d+)" cy="(\d+)"\/>/);
  const rect = { x: +off[1], y: +off[2], w: +ext[1], h: +ext[2] };
  const body = sp.slice(sp.indexOf("<a:lstStyle/>") + 13, sp.lastIndexOf("</p:txBody>"));
  const paraXml = body.match(/<a:p\b(?:\s[^>]*)?>[\s\S]*?<\/a:p>/g) || [];
  const lines = [];
  paraXml.forEach((px, pi) => {
    let cur = { runs: [], xml: [], para: pi };
    const push = () => {
      cur.md = runsMd(cur.runs);
      lines.push(cur);
      cur = { runs: [], xml: [], para: pi };
    };
    for (const m of px.matchAll(/<a:r>([\s\S]*?)<\/a:r>|<a:br\b[^>]*\/>|<a:br\b[\s\S]*?<\/a:br>/g)) {
      if (!m[0].startsWith("<a:r>")) {
        push();
        continue;
      }
      const rx = m[1], rpr = (rx.match(/<a:rPr\b[^>]*?(?:\/>|>[\s\S]*?<\/a:rPr>)/) || [""])[0], head = (rpr.match(/<a:rPr\b[^>]*>/) || [""])[0];
      const t = xmlUn((rx.match(/<a:t>([\s\S]*?)<\/a:t>/) || ["", ""])[1]);
      const sc = rpr.match(/<a:schemeClr val="(\w+)"/), rgb = rpr.match(/<a:srgbClr val="([0-9A-Fa-f]{6})"/), hl = rpr.match(/<a:hlinkClick\b[^>]*r:id="([^"]+)"/);
      cur.runs.push({ t, b: /\bb="1"/.test(head), u: /\bu="(?!none)\w+"/.test(head), color: rgb ? "#" + rgb[1] : sc ? clr[sc[1]] : null, link: hl ? link[hl[1]] || null : null, sz: +((head.match(/\bsz="(\d+)"/) || [])[1] || 1e3) / 100 });
      cur.xml.push(m[0]);
    }
    push();
  });
  const cnt = /* @__PURE__ */ new Map();
  for (const l of lines) l.xml.forEach((x, i) => {
    const r = l.runs[i];
    if (r.link || r.u || r.b) return;
    const rp = (x.match(/<a:rPr\b[^>]*?(?:\/>|>[\s\S]*?<\/a:rPr>)/) || [""])[0];
    if (rp) cnt.set(rp, (cnt.get(rp) || 0) + r.t.length);
  });
  let baseRpr = '<a:rPr lang="ru-RU" sz="1000" dirty="0"><a:latin typeface="Arial"/><a:cs typeface="Arial"/></a:rPr>', best = 0;
  for (const [k, v] of cnt) if (v > best) {
    best = v;
    baseRpr = k;
  }
  baseRpr = baseRpr.replace(/\s(b|u|i)="[^"]*"/g, "");
  const baseSz = +((baseRpr.match(/\bsz="(\d+)"/) || [])[1] || 1e3) / 100;
  const bodyPr = (sp.match(/<a:bodyPr\b[^>]*>/) || [""])[0], insA = (n, d) => {
    const m = bodyPr.match(new RegExp("\\b" + n + '="(\\d+)"'));
    return m ? +m[1] : d;
  };
  const ins = { l: insA("lIns", 91440), t: insA("tIns", 45720) };
  const bc = baseRpr.match(/<a:srgbClr val="([0-9A-Fa-f]{6})"/), baseColor = bc ? "#" + bc[1] : "#000";
  const head = (lines[0] ? lines[0].runs.map((r) => r.t).join("") : "").replace(/\s+/g, " ").trim();
  const title = head.length > 42 ? head.slice(0, 41) + "…" : head || "блок " + (idx + 1);
  return { tpl, idx, label, title, sp, paraXml, lines, rect, ins, baseRpr, baseSz, baseColor, md: lines.map((l) => l.md).join("\n") };
}
function reqText(label) {
  const v = project.tz.req && project.tz.req[label];
  return typeof v === "string" ? v : null;
}
const tzPos = (k) => project.tz.pos && project.tz.pos[k] || null;
function reqEdited(info) {
  const v = reqText(info.label);
  return v != null && v.replace(/\r/g, "") !== info.md || !!tzPos("req:" + info.label);
}
function reqRect(info) {
  const p = tzPos("req:" + info.label);
  return p ? { ...info.rect, x: p.x, y: p.y } : info.rect;
}
const reqTextOr = (info) => {
  const v = reqText(info.label);
  return v != null ? v : info.md;
};
function reqMatch(info, text) {
  const a = info.lines.map((l) => l.md), b = String(text).replace(/\r/g, "").split("\n"), n = a.length, m = b.length;
  const L2 = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i2 = n - 1; i2 >= 0; i2--) for (let j2 = m - 1; j2 >= 0; j2--) L2[i2][j2] = a[i2] === b[j2] ? L2[i2 + 1][j2 + 1] + 1 : Math.max(L2[i2 + 1][j2], L2[i2][j2 + 1]);
  const map = new Array(m).fill(-1);
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      map[j] = i;
      i++;
      j++;
    } else if (L2[i + 1][j] >= L2[i][j + 1]) i++;
    else j++;
  }
  return { lines: b, map };
}
function reqParas(info, text) {
  const { lines, map } = reqMatch(info, text);
  return lines.map((l, j) => map[j] >= 0 ? info.lines[map[j]].runs : mdRuns(l, { sz: info.baseSz }));
}
function reqXml(info, text) {
  const { lines, map } = reqMatch(info, text), out = [], rels = [];
  const newRun = (t, b, link, color, sz) => {
    let rp = b ? info.baseRpr.replace("<a:rPr", '<a:rPr b="1"') : info.baseRpr;
    if (sz && Math.abs(sz - info.baseSz) > 1e-6) rp = /\bsz="\d+"/.test(rp) ? rp.replace(/\bsz="\d+"/, 'sz="'.concat(Math.round(sz * 100), '"')) : rp.replace("<a:rPr", '<a:rPr sz="'.concat(Math.round(sz * 100), '"'));
    if (color) {
      rp = rp.replace(/<a:solidFill>[\s\S]*?<\/a:solidFill>/, "");
      const fill = '<a:solidFill><a:srgbClr val="'.concat(color.slice(1), '"/></a:solidFill>');
      rp = rp.endsWith("/>") ? rp.replace(/\/>$/, ">".concat(fill, "</a:rPr>")) : rp.replace(/^(<a:rPr\b[^>]*>)/, "$1" + fill);
    }
    if (link) {
      const id = "rIdT" + info.idx + "_" + (rels.length + 1);
      rels.push({ id, url: link });
      const hl = '<a:hlinkClick r:id="'.concat(id, '"/>');
      rp = rp.endsWith("/>") ? rp.replace(/\/>$/, ">".concat(hl, "</a:rPr>")) : rp.replace("</a:rPr>", hl + "</a:rPr>");
    }
    return "<a:r>".concat(rp, "<a:t>").concat(xmlEsc(t), "</a:t></a:r>");
  };
  const endP = info.baseRpr.replace(/^<a:rPr/, "<a:endParaRPr").replace(/<\/a:rPr>$/, "</a:endParaRPr>");
  for (let j = 0; j < lines.length; ) {
    const oi = map[j];
    if (oi >= 0) {
      const pi = info.lines[oi].para, span = info.lines.filter((x) => x.para === pi), first = info.lines.indexOf(span[0]);
      if (oi === first && span.every((x, k) => map[j + k] === first + k)) {
        out.push(info.paraXml[pi]);
        j += span.length;
        continue;
      }
      out.push("<a:p>".concat(info.lines[oi].xml.join("")).concat(endP, "</a:p>"));
      j++;
      continue;
    }
    const runs = mdRuns(lines[j]);
    out.push("<a:p>".concat(runs.map((r) => newRun(r.t, r.b, r.link, r.color, r.sz)).join("")).concat(endP, "</a:p>"));
    j++;
  }
  return { xml: out.join(""), rels };
}
function rtLayout(ctx, paras, wPt, defSz = 10) {
  const lines = [];
  const font = (r) => "".concat(r.b ? "bold " : "").concat(r.sz || defSz, "px ").concat(RT_FONT);
  for (const runs of paras) {
    const sz0 = Math.max(defSz, ...runs.map((r) => r.sz || defSz));
    let line = [], lw = 0;
    const flush = () => {
      lines.push({ segs: line, h: sz0 * RT_LH, sz: sz0 });
      line = [];
      lw = 0;
    };
    for (const r of runs) {
      ctx.font = font(r);
      for (const tok of r.t.split(/(\s+)/)) {
        if (!tok) continue;
        const w = ctx.measureText(tok).width;
        if (lw + w > wPt && line.length && !/^\s+$/.test(tok)) {
          while (line.length && /^\s+$/.test(line[line.length - 1].t)) lw -= line.pop().w;
          flush();
        }
        if (!line.length && /^\s+$/.test(tok)) continue;
        line.push({ ...r, t: tok, w, x: lw });
        lw += w;
      }
    }
    flush();
  }
  return { lines, h: lines.reduce((a, l) => a + l.h, 0), font };
}
function rtPaint(ctx, paras, x0, y0, wPt, k, defSz = 10, color = "#000") {
  ctx.save();
  ctx.scale(k, k);
  const L2 = rtLayout(ctx, paras, wPt, defSz), links = [];
  let y = 0;
  ctx.textBaseline = "alphabetic";
  for (const ln of L2.lines) {
    const base = y + ln.sz * 0.905 + (ln.h - ln.sz * 1.117) / 2;
    for (const sg of ln.segs) {
      ctx.font = L2.font(sg);
      ctx.fillStyle = sg.color || (sg.link ? "#0563C1" : color);
      const X = x0 / k + sg.x, Y = y0 / k + base;
      ctx.fillText(sg.t, X, Y);
      if (sg.u || sg.link) ctx.fillRect(X, Y + (sg.sz || defSz) * 0.12, sg.w, Math.max(0.5, (sg.sz || defSz) * 0.07));
      if (sg.link) links.push({ x: sg.x, y, w: sg.w, h: ln.h, url: sg.link });
    }
    y += ln.h;
  }
  ctx.restore();
  return { h: y, links };
}
const mctxRT = document.createElement("canvas").getContext("2d");
const NOTE_SZ = 12;
function noteLayout(text, key2) {
  const t = String(text || "").replace(/\s+$/, "");
  if (!t.trim()) return { box: BOX, note: null };
  const paras = mdParas(t), wPt = BOX.w / PT, pos = key2 ? tzPos("note:" + key2) : null;
  let sz = NOTE_SZ, h = rtLayout(mctxRT, paras, wPt, sz).h;
  while (h * PT > BOX.h * 0.45 && sz > 6) {
    sz -= 0.5;
    h = rtLayout(mctxRT, paras, wPt, sz).h;
  }
  const hE = Math.ceil(h * PT), dy = hE + GAP;
  if (pos) return { box: BOX, note: { paras, sz, rect: [pos.x, pos.y, BOX.w, hE] } };
  if (volNoteKey(key2)) return { box: { x: BOX.x, y: BOX.y, w: BOX.w, h: BOX.h - dy }, note: { paras, sz, rect: [BOX.x, BOX.y + BOX.h - hE, BOX.w, hE] } };
  return { box: { x: BOX.x, y: BOX.y + dy, w: BOX.w, h: BOX.h - dy }, note: { paras, sz, rect: [BOX.x, BOX.y, BOX.w, hE] } };
}
const noteKey = (items) => items.length ? items[0].key || "" : "";
// 2.0.72: у листа волюметрика (вид сверху, снизу, 3D) обычный текстовый блок ТЗ по умолчанию — «Информация» раздела
const volNoteKey = (key2) => /^v[cb3]:/.test(key2 || "");
function volNoteDefault(key2) {
  const uid = String(key2).slice(3), st = project.screens.find((x) => String(x.uid) === uid);
  return st && st.kind === "vol" && st.vol ? "**Информация**\n" + volInfoLines(st).join("\n") : "";
}
const noteText = (key2) => {
  const n = project.tz.notes;
  if (volNoteKey(key2) && project.tz.volInfo === false) return ""; // галочка «Информация» в ТЗ выключена
  if (n && Object.prototype.hasOwnProperty.call(n, key2)) return n[key2] || "";
  if (/^c:/.test(key2 || "")) return cutNoteDefault(key2);
  if (/^cs:/.test(key2 || "")) return "**Нарезка — исходная маска (пример)**\nКрасным пунктиром отмечены места разреза, крупные метки режутся вместе с маской — по ним видно, какая часть с какой соединяется. Это пример для контентщиков, отдельным файлом не сохраняется.";
  return volNoteKey(key2) ? volNoteDefault(key2) : "";
};
function noteShapeXml(id, note) {
  const [x, y, w, h] = note.rect, sz = Math.round(note.sz * 100);
  const rp = (b, c, rs) => '<a:rPr lang="ru-RU" sz="'.concat(rs ? Math.round(rs * 100) : sz, '"').concat(b ? ' b="1"' : "", ' dirty="0"><a:solidFill><a:srgbClr val="').concat((c || "#222222").slice(1), '"/></a:solidFill><a:latin typeface="Arial"/><a:cs typeface="Arial"/></a:rPr>');
  const ps = note.paras.map((runs) => "<a:p>".concat(runs.map((r) => "<a:r>".concat(rp(r.b, r.link ? "#0563C1" : r.color, r.sz), "<a:t>").concat(xmlEsc(r.t), "</a:t></a:r>")).join(""), '<a:endParaRPr lang="ru-RU" sz="').concat(sz, '" dirty="0"/></a:p>')).join("");
  return '<p:sp><p:nvSpPr><p:cNvPr id="'.concat(id, '" name="Свой текст"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="').concat(x, '" y="').concat(y, '"/><a:ext cx="').concat(w, '" cy="').concat(h, '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" rtlCol="0"><a:noAutofit/></a:bodyPr><a:lstStyle/>').concat(ps, "</p:txBody></p:sp>");
}
async function rtImage(paras, wPt, hPt, defSz, defColor = "#000", k = 4) {
  const W = Math.max(1, Math.round(wPt * k)), H = Math.max(1, Math.round(hPt * k));
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const c = cv.getContext("2d", { willReadFrequently: true });
  const r = rtPaint(c, paras, 0, 0, wPt, k, defSz, defColor);
  const px = c.getImageData(0, 0, W, H).data, rgb = new Uint8Array(W * H * 3), al = new Uint8Array(W * H);
  for (let i = 0, j = 0, q = 0; i < px.length; i += 4, j += 3, q++) {
    const a = px[i + 3];
    al[q] = a;
    if (a) {
      rgb[j] = px[i];
      rgb[j + 1] = px[i + 1];
      rgb[j + 2] = px[i + 2];
    }
  }
  return { w: W, h: H, data: await zlibDeflate(rgb), alpha: await zlibDeflate(al), links: r.links };
}
async function buildPptx(tplB64, masks, overview, label) {
  const files = await unzip(b64ToBytes(tplB64)), map = new Map(files.map((f) => [f.name, f.data]));
  const order = files.map((f) => f.name);
  const txt = (n) => dec.decode(map.get(n));
  const slide2 = txt("ppt/slides/slide2.xml"), rels2 = txt("ppt/slides/_rels/slide2.xml.rels");
  const blocks = label ? await tplBlocks(label) : [];
  if (blocks.some(reqEdited)) {
    let s1 = txt("ppt/slides/slide1.xml");
    const relAdd = [];
    for (const info of blocks) {
      if (!reqEdited(info)) continue;
      const body = info.sp.slice(info.sp.indexOf("<a:lstStyle/>") + 13, info.sp.lastIndexOf("</p:txBody>"));
      const rx = reqXml(info, reqTextOr(info)), rr = reqRect(info);
      const sp2 = info.sp.replace(body, rx.xml).replace(/<a:off x="\d+" y="\d+"\/>/, '<a:off x="'.concat(rr.x, '" y="').concat(rr.y, '"/>'));
      s1 = s1.replace(info.sp, sp2);
      relAdd.push(...rx.rels);
    }
    map.set("ppt/slides/slide1.xml", enc.encode(s1));
    if (relAdd.length) {
      const rn = "ppt/slides/_rels/slide1.xml.rels";
      map.set(rn, enc.encode(txt(rn).replace("</Relationships>", relAdd.map((r) => '<Relationship Id="'.concat(r.id, '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="').concat(xmlEsc(r.url), '" TargetMode="External"/>')).join("") + "</Relationships>")));
    }
  }
  let pres = txt("ppt/presentation.xml"), presRels = txt("ppt/_rels/presentation.xml.rels"), types = txt("[Content_Types].xml");
  const relItems = rels2.match(/<Relationship\b[^>]*\/>/g) || [];
  const s1Targets = txt("ppt/slides/_rels/slide1.xml.rels").match(/Target="[^"]+"/g) || [];
  const bgRels = relItems.filter((r) => r.includes(REL_IMAGE) && s1Targets.includes((r.match(/Target="[^"]+"/) || [""])[0]));
  const bgIds = bgRels.map((r) => (r.match(/Id="([^"]+)"/) || [])[1]);
  const slideTpl = slide2.replace(/<p:pic>[\s\S]*?<\/p:pic>/g, (pic) => bgIds.some((id) => pic.includes('r:embed="' + id + '"')) ? pic : "");
  const keep = relItems.filter((r) => !r.includes(REL_IMAGE) || bgRels.includes(r)), keepClone = keep.filter((r) => !r.includes(REL_NOTES));
  const maxId = (re, s, start) => Math.max(start - 1, ...[...s.matchAll(re)].map((m) => +m[1])) + 1;
  let nextPresRel = maxId(/Id="rId(\d+)"/g, presRels, 1), nextSlideId = maxId(/<p:sldId\s+id="(\d+)"/g, pres, 256);
  const relsHead = rels2.slice(0, rels2.indexOf("<Relationships")), relsOpen = rels2.match(/<Relationships\b[^>]*>/)[0];
  const groups = maskGroups(masks).map((g) => ({ ...g, kind: "masks" }));
  const emap = evenScaleMap(maskGroups(masks), masks);
  const imgs = overview || [];
  groups.unshift(...imgGroups(imgs).map(({ hz, g }) => ({ kind: "img", ims: g.map((j) => imgs[j]), hz, g: [] })));
  if (imgs.length && !/Extension="jpe?g"/i.test(types)) types = types.replace(/<Default\b/, '<Default Extension="jpeg" ContentType="image/jpeg"/><Default');
  const used = new Set(order.filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)));
  const put = (n, data) => {
    if (!map.has(n)) order.push(n);
    map.set(n, data);
  };
  groups.forEach(({ hz, g }, gi) => {
    let no = 2;
    if (gi > 0) {
      no = 3;
      while (used.has("ppt/slides/slide".concat(no, ".xml"))) no++;
    }
    const sname = "slide".concat(no, ".xml");
    used.add("ppt/slides/" + sname);
    const base = gi === 0 ? keep : keepClone;
    let rid = maxId(/Id="rId(\d+)"/g, base.join(""), 1);
    const shapes = [], rels = [];
    const items = groups[gi].kind === "img" ? groups[gi].ims.map((im) => ({ png: im.jpeg, w: im.w, h: im.h, label: im.caption || "", ext: "jpeg", key: imgKey(im) })) : g.map((mi) => masks[mi]);
    const NL = noteLayout(noteText(noteKey(items)), noteKey(items));
    items.forEach((m, j) => {
      const lay = maskCellLayout(hz, items.length, j, m.w, m.h, NL.box, m.info, !!NL.note, groups[gi].kind === "img" ? 0 : evenSc(emap, m)), [cx0, cy0, cw] = lay.label;
      if (lay.info) {
        // «Информация» волюметрика — обычный текст на слайде (можно править в PowerPoint)
        const [tx, ty, tw, th] = lay.info, fit = infoFit(m.info, tw, th), sz = Math.round(fit.pt * 100);
        const paras = fit.rows.map((r) => '<a:p><a:pPr><a:lnSpc><a:spcPct val="112000"/></a:lnSpc></a:pPr><a:r><a:rPr lang="ru-RU" sz="'.concat(sz, '"').concat(r.b ? ' b="1"' : "", '><a:solidFill><a:srgbClr val="222222"/></a:solidFill><a:latin typeface="Arial"/><a:ea typeface="Arial"/><a:cs typeface="Arial"/></a:rPr><a:t>').concat(xmlEsc(r.t), "</a:t></a:r></a:p>")).join("");
        shapes.push('<p:sp><p:nvSpPr><p:cNvPr id="'.concat(150 + j, '" name="Vol info ').concat(j + 1, '"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="').concat(tx, '" y="').concat(ty, '"/><a:ext cx="').concat(tw, '" cy="').concat(th, '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="none" lIns="0" rIns="0" tIns="0" bIns="0" anchor="t"/><a:lstStyle/>').concat(paras, "</p:txBody></p:sp>"));
      }
      shapes.push('<p:sp><p:nvSpPr><p:cNvPr id="'.concat(100 + j, '" name="Mask info ').concat(j + 1, '"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="').concat(cx0, '" y="').concat(cy0, '"/><a:ext cx="').concat(cw, '" cy="').concat(LABEL_H, '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="none" lIns="0" rIns="0" tIns="0" bIns="0" anchor="ctr"/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="ru-RU" sz="').concat(Math.round(labelPt(m.label, cw) * 100), '"><a:solidFill><a:srgbClr val="222222"/></a:solidFill><a:latin typeface="Arial"/><a:ea typeface="Arial"/><a:cs typeface="Arial"/></a:rPr><a:t>').concat(xmlEsc(m.label), '</a:t></a:r><a:endParaRPr lang="ru-RU" sz="1100"/></a:p></p:txBody></p:sp>'));
      const [x, y, ew, eh] = lay.image;
      const img = "mask_".concat(gi + 1, "_").concat(j + 1, ".").concat(m.ext || "png");
      put("ppt/media/" + img, m.png);
      const r = "rId" + rid++;
      shapes.push('<p:pic><p:nvPicPr><p:cNvPr id="'.concat(j + 2, '" name="Mask ').concat(j + 1, '" descr="').concat(img, '"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="').concat(r, '"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="').concat(x, '" y="').concat(y, '"/><a:ext cx="').concat(ew, '" cy="').concat(eh, '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>'));
      rels.push('<Relationship Id="'.concat(r, '" Type="').concat(REL_IMAGE, '" Target="../media/').concat(img, '"/>'));
    });
    if (NL.note) shapes.push(noteShapeXml(90, NL.note));
    let sx = slideTpl.replace("</p:spTree>", shapes.join("") + "</p:spTree>");
    if (gi > 0) sx = sx.replace(/(<p14:creationId\b[^>]*val=")\d+(")/, (_, a, b) => a + (1e8 + Math.floor(Math.random() * 2e9)) + b);
    put("ppt/slides/" + sname, enc.encode(sx));
    put("ppt/slides/_rels/" + sname + ".rels", enc.encode(relsHead + relsOpen + base.join("") + rels.join("") + "</Relationships>"));
    if (gi > 0) {
      const r = "rId" + nextPresRel++;
      presRels = presRels.replace("</Relationships>", '<Relationship Id="'.concat(r, '" Type="').concat(REL_SLIDE, '" Target="slides/').concat(sname, '"/></Relationships>'));
      pres = pres.replace("</p:sldIdLst>", '<p:sldId id="'.concat(nextSlideId++, '" r:id="').concat(r, '"/></p:sldIdLst>'));
      types = types.replace("</Types>", '<Override PartName="/ppt/slides/'.concat(sname, '" ContentType="').concat(CT_SLIDE, '"/></Types>'));
    }
  });
  map.set("ppt/presentation.xml", enc.encode(pres));
  map.set("ppt/_rels/presentation.xml.rels", enc.encode(presRels));
  map.set("[Content_Types].xml", enc.encode(types));
  const allRels = [...map.entries()].filter(([n]) => n.endsWith(".rels")).map(([, d]) => dec.decode(d)).join("");
  for (const n of [...map.keys()]) if (n.startsWith("ppt/media/") && !allRels.includes(n.split("/").pop())) map.delete(n);
  const names = ["[Content_Types].xml", ...order.filter((n) => n !== "[Content_Types].xml" && map.has(n))];
  return zip([...new Set(names)].map((n) => ({ name: n, data: map.get(n) })));
}
const EMU_PT = 12700, PDF_W = SLIDE_W / EMU_PT, PDF_H = SLIDE_H / EMU_PT;
async function zlibDeflate(bytes) {
  return HAS_CS ? streamBytes(new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate"))) : nativeZ("deflate", "zlib", bytes);
}
function pngParts(png) {
  const dv = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let p = 8, w = 0, h = 0, ct = 0, bd = 0;
  const idat = [];
  while (p < png.length) {
    const len = dv.getUint32(p), type = String.fromCharCode(...png.subarray(p + 4, p + 8)), d = png.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") {
      w = dv.getUint32(p + 8);
      h = dv.getUint32(p + 12);
      bd = png[p + 16];
      ct = png[p + 17];
    } else if (type === "IDAT") idat.push(d);
    p += 12 + len;
  }
  const out = new Uint8Array(idat.reduce((a, b) => a + b.length, 0));
  let o = 0;
  for (const d of idat) {
    out.set(d, o);
    o += d.length;
  }
  return { w, h, ct, bd, idat: out };
}
const INFO_FONT = 'Arial, "Liberation Sans", Helvetica, sans-serif';
function infoFit(lines, wEmu, hEmu) {
  const c = document.createElement("canvas").getContext("2d");
  for (let pt = 10; pt >= 5; pt -= 0.5) {
    c.font = "".concat(pt, "px ").concat(INFO_FONT);
    const maxW = wEmu / PT, rows = [{ t: "Информация", b: true }];
    for (const ln of lines) {
      // переносим по « · », а слишком длинный кусок — по словам
      let cur = "";
      const words = [];
      ln.split(" · ").forEach((p, i) => p.split(" ").forEach((w, k) => words.push((i && !k ? "· " : "") + w)));
      for (const w of words) {
        const t = cur ? cur + " " + w : w;
        if (cur && c.measureText(t).width > maxW * 0.97) {
          rows.push({ t: cur.replace(/ ·$/, "") });
          cur = "   " + w.replace(/^· /, "");
        } else cur = t;
      }
      rows.push({ t: cur });
    }
    if (rows.length * pt * 1.35 * PT <= hEmu || pt === 5) return { pt, rows, lh: pt * 1.35 };
  }
}
function infoPaint(c, fit, x, y, k) {
  c.save();
  c.fillStyle = "#222";
  c.textAlign = "left";
  c.textBaseline = "top";
  fit.rows.forEach((r, i) => {
    c.font = "".concat(r.b ? "bold " : "").concat(fit.pt * k, "px ").concat(INFO_FONT);
    c.fillText(r.t, x, y + i * fit.lh * k);
  });
  c.restore();
}
async function infoImage(lines, wPt, hPt, k = 4) {
  const fit = infoFit(lines, wPt * PT, hPt * PT), W = Math.max(1, Math.round(wPt * k)), H = Math.max(1, Math.round(hPt * k));
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const c = cv.getContext("2d", { willReadFrequently: true, alpha: false });
  c.fillStyle = "#fff";
  c.fillRect(0, 0, W, H);
  infoPaint(c, fit, 0, 0, k);
  const px = c.getImageData(0, 0, W, H).data, rgb = new Uint8Array(W * H * 3);
  for (let i = 0, j = 0; i < px.length; i += 4, j += 3) {
    rgb[j] = px[i];
    rgb[j + 1] = px[i + 1];
    rgb[j + 2] = px[i + 2];
  }
  return { w: W, h: H, data: await zlibDeflate(rgb) };
}
async function labelImage(text, wPt, hPt, k = 4) {
  var _a, _b;
  const W = Math.max(1, Math.round(wPt * k)), H = Math.max(1, Math.round(hPt * k));
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const c = cv.getContext("2d", { willReadFrequently: true, alpha: false });
  c.fillStyle = "#fff";
  c.fillRect(0, 0, W, H);
  const pt = Math.min(10, labelPt(text, wPt * PT));
  c.font = "".concat(pt * k, 'px Arial, "Liberation Sans", Helvetica, sans-serif');
  c.fillStyle = "#222222";
  c.textBaseline = "alphabetic";
  const m = c.measureText(text), asc = (_a = m.fontBoundingBoxAscent) != null ? _a : pt * k * 0.905, desc = (_b = m.fontBoundingBoxDescent) != null ? _b : pt * k * 0.212;
  if (text) c.fillText(text, (W - m.width) / 2, (H - (asc + desc)) / 2 + asc);
  const px = c.getImageData(0, 0, W, H).data, rgb = new Uint8Array(W * H * 3);
  for (let i = 0, j = 0; i < px.length; i += 4, j += 3) {
    rgb[j] = px[i];
    rgb[j + 1] = px[i + 1];
    rgb[j + 2] = px[i + 2];
  }
  return { w: W, h: H, data: await zlibDeflate(rgb) };
}
async function buildPdf(label, masks, overview_) {
  const objs = [];
  const add = (body) => {
    objs.push(body);
    return objs.length;
  };
  const str = (s) => enc.encode(s);
  const stream = (dict, data) => add([str("<< ".concat(dict, " /Length ").concat(data.length, " >>\nstream\n")), data, str("\nendstream")]);
  const jpeg = (b64) => {
    const d = b64ToBytes(b64);
    let w = 0, h = 0;
    for (let i = 2; i < d.length; ) {
      if (d[i] !== 255) {
        i++;
        continue;
      }
      const mk = d[i + 1], len = d[i + 2] << 8 | d[i + 3];
      if (mk >= 192 && mk <= 195) {
        h = d[i + 5] << 8 | d[i + 6];
        w = d[i + 7] << 8 | d[i + 8];
        break;
      }
      i += 2 + len;
    }
    return stream("/Type /XObject /Subtype /Image /Width ".concat(w, " /Height ").concat(h, " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode"), d);
  };
  const catalog = add(null), pagesId = add(null);
  const blocks = await tplBlocks(label), edited = blocks.some(reqEdited);
  const bg1 = jpeg(PDF_BG[PDF_BG[label] ? label : "Resolume"]), bg0 = edited ? jpeg(PDF_BG[bgKey("bare", label)]) : 0, bg2 = jpeg(PDF_BG[bgKey("masks", label)]);
  const pages = [], f = (n) => n.toFixed(4);
  const full = "q ".concat(f(PDF_W), " 0 0 ").concat(f(PDF_H), " 0 0 cm /BG Do Q\n");
  const page = (xobj, content, annots2 = "") => {
    const cs = stream("", str(content));
    pages.push(add(str("<< /Type /Page /Parent ".concat(pagesId, " 0 R /MediaBox [0 0 ").concat(f(PDF_W), " ").concat(f(PDF_H), "] /Resources << /XObject << ").concat(xobj.map(([n, id]) => "/".concat(n, " ").concat(id, " 0 R")).join(" "), " >> >> /Contents ").concat(cs, " 0 R").concat(annots2, " >>"))));
  };
  const textImg = (img) => {
    const sm = stream("/Type /XObject /Subtype /Image /Width ".concat(img.w, " /Height ").concat(img.h, " /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode"), img.alpha);
    return stream("/Type /XObject /Subtype /Image /Width ".concat(img.w, " /Height ").concat(img.h, " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /SMask ").concat(sm, " 0 R"), img.data);
  };
  const linkAnn = ([x0, y0, x1, y1], uri) => add(str("<< /Type /Annot /Subtype /Link /Rect [".concat(x0, " ").concat(y0, " ").concat(x1, " ").concat(y1, "] /Border [0 0 0] /A << /S /URI /URI (").concat(uri.replace(/[()\\]/g, (m) => "\\" + m), ") >> >>")));
  const annots = (a) => a.length ? " /Annots [".concat(a.map((x) => x + " 0 R").join(" "), "]") : "";
  if (!edited) {
    const ann = (PDF_LINKS[label] || []).map(([r, uri]) => linkAnn(r, uri));
    page([["BG", bg1]], full, annots(ann));
  } else {
    // Неизменённые блоки — вырезаны из отрисовки шаблона по рамкам PDF_CLIPS, изменённые — нарисованы заново
    const xo = [["BG", bg0], ["F", bg1]], ann = [], clips = PDF_CLIPS[label] || [], links = PDF_LINKS[label] || [];
    let content = full;
    const clipOf = (info) => clips[info.idx] || [info.rect.x, info.rect.y, info.rect.w, info.rect.h];
    const inClip = ([x0, y0, x1, y1], c) => x0 >= c[0] / EMU_PT - 1 && x1 <= (c[0] + c[2]) / EMU_PT + 1 && y0 >= PDF_H - (c[1] + c[3]) / EMU_PT - 1 && y1 <= PDF_H - c[1] / EMU_PT + 1;
    for (const info of blocks) {
      const c = clipOf(info);
      if (!reqEdited(info)) {
        content += "q ".concat(f(c[0] / EMU_PT), " ").concat(f(PDF_H - (c[1] + c[3]) / EMU_PT), " ").concat(f(c[2] / EMU_PT), " ").concat(f(c[3] / EMU_PT), " re W n ").concat(f(PDF_W), " 0 0 ").concat(f(PDF_H), " 0 0 cm /F Do Q\n");
        links.filter(([r2]) => inClip(r2, c)).forEach(([r2, uri]) => ann.push(linkAnn(r2, uri)));
        continue;
      }
      const r = reqRect(info), tx = (r.x + info.ins.l) / EMU_PT, ty = (r.y + info.ins.t) / EMU_PT, tw = (r.w - 2 * info.ins.l) / EMU_PT;
      const paras = reqParas(info, reqTextOr(info)), th = Math.max(4, Math.min(PDF_H - ty - 2, rtLayout(mctxRT, paras, tw, info.baseSz).h + 4));
      const img = await rtImage(paras, tw, th, info.baseSz, info.baseColor), name = "T" + info.idx;
      xo.push([name, textImg(img)]);
      content += "q ".concat(f(tw), " 0 0 ").concat(f(th), " ").concat(f(tx), " ").concat(f(PDF_H - ty - th), " cm /").concat(name, " Do Q\n");
      img.links.filter((l) => l.y < th).forEach((l) => ann.push(linkAnn([f(tx + l.x), f(PDF_H - ty - l.y - l.h), f(tx + l.x + l.w), f(PDF_H - ty - l.y)], l.url)));
    }
    links.filter(([r2]) => !blocks.some((b) => inClip(r2, clipOf(b)))).forEach(([r2, uri]) => ann.push(linkAnn(r2, uri)));
    page(xo, content, annots(ann));
  }
  const notePdf = async (NL, xo, name) => {
    if (!NL.note) return "";
    const [x, y, w, h] = toPdf(NL.note.rect), img = await rtImage(NL.note.paras, w, h, NL.note.sz, "#222222");
    xo.push([name, textImg(img)]);
    return "q ".concat(f(w), " 0 0 ").concat(f(h), " ").concat(f(x), " ").concat(f(y), " cm /").concat(name, " Do Q\n");
  };
  const toPdf = ([x, y, w, h]) => [x / EMU_PT, PDF_H - (y + h) / EMU_PT, w / EMU_PT, h / EMU_PT];
  const imgs_ = overview_ || [];
  for (const { hz, g } of imgGroups(imgs_)) {
    const ims = g.map((j) => imgs_[j]), key2 = imgKey(ims[0]);
    const NL = noteLayout(noteText(key2), key2), xo = [["BG", bg2]];
    const nc = await notePdf(NL, xo, "N0");
    let content = full;
    for (let j = 0; j < ims.length; j++) {
      const im = ims[j], lay = maskCellLayout(hz, ims.length, j, im.w, im.h, NL.box, null, !!NL.note), [lx, ly, lw, lh] = toPdf(lay.label), [ix, iy, iw, ih] = toPdf(lay.image);
      const lab = await labelImage(im.caption || "", lw, lh);
      xo.push(["L" + j, stream("/Type /XObject /Subtype /Image /Width ".concat(lab.w, " /Height ").concat(lab.h, " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode"), lab.data)]);
      xo.push(["O" + j, stream("/Type /XObject /Subtype /Image /Width ".concat(im.w, " /Height ").concat(im.h, " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode"), im.jpeg)]);
      content += "q ".concat(f(lw), " 0 0 ").concat(f(lh), " ").concat(f(lx), " ").concat(f(ly), " cm /L").concat(j, " Do Q\nq ").concat(f(iw), " 0 0 ").concat(f(ih), " ").concat(f(ix), " ").concat(f(iy), " cm /O").concat(j, " Do Q\n");
    }
    page(xo, content + nc);
  }
  const emapPdf = evenScaleMap(maskGroups(masks), masks);
  for (const { hz, g } of maskGroups(masks)) {
    const xo = [["BG", bg2]], NL = noteLayout(noteText(noteKey(g.map((i) => masks[i]))), noteKey(g.map((i) => masks[i])));
    let content = full;
    const nc = await notePdf(NL, xo, "N0");
    for (let j = 0; j < g.length; j++) {
      const m = masks[g[j]], lay = maskCellLayout(hz, g.length, j, m.w, m.h, NL.box, m.info, !!NL.note, evenSc(emapPdf, m));
      if (lay.info) {
        const [tx, ty, tw, th] = toPdf(lay.info), inf = await infoImage(m.info, tw, th);
        xo.push(["I" + j, stream("/Type /XObject /Subtype /Image /Width ".concat(inf.w, " /Height ").concat(inf.h, " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode"), inf.data)]);
        content += "q ".concat(f(tw), " 0 0 ").concat(f(th), " ").concat(f(tx), " ").concat(f(ty), " cm /I").concat(j, " Do Q\n");
      }
      const [lx, ly, lw, lh] = toPdf(lay.label), [ix, iy, iw, ih] = toPdf(lay.image);
      const lab = await labelImage(m.label, lw, lh);
      const lid = stream("/Type /XObject /Subtype /Image /Width ".concat(lab.w, " /Height ").concat(lab.h, " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode"), lab.data);
      const pp = pngParts(m.png);
      const mid = stream("/Type /XObject /Subtype /Image /Width ".concat(pp.w, " /Height ").concat(pp.h, " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /DecodeParms << /Predictor 15 /Colors 3 /BitsPerComponent 8 /Columns ").concat(pp.w, " >>"), pp.idat);
      xo.push(["L" + j, lid], ["M" + j, mid]);
      content += "q ".concat(f(lw), " 0 0 ").concat(f(lh), " ").concat(f(lx), " ").concat(f(ly), " cm /L").concat(j, " Do Q\nq ").concat(f(iw), " 0 0 ").concat(f(ih), " ").concat(f(ix), " ").concat(f(iy), " cm /M").concat(j, " Do Q\n");
    }
    page(xo, content + nc);
  }
  objs[catalog - 1] = str("<< /Type /Catalog /Pages ".concat(pagesId, " 0 R >>"));
  objs[pagesId - 1] = str("<< /Type /Pages /Kids [".concat(pages.map((p) => p + " 0 R").join(" "), "] /Count ").concat(pages.length, " >>"));
  const parts = [str("%PDF-1.4\n%âãÏÓ\n")];
  let off = parts[0].length;
  const offs = [];
  objs.forEach((body, i) => {
    offs.push(off);
    const chunk = [str("".concat(i + 1, " 0 obj\n")), ...Array.isArray(body) ? body : [body], str("\nendobj\n")];
    for (const c of chunk) {
      parts.push(c);
      off += c.length;
    }
  });
  let xref = "xref\n0 ".concat(objs.length + 1, "\n0000000000 65535 f \n") + offs.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("");
  xref += "trailer\n<< /Size ".concat(objs.length + 1, " /Root ").concat(catalog, " 0 R >>\nstartxref\n").concat(off, "\n%%EOF\n");
  parts.push(str(xref));
  return new Blob(parts, { type: "application/pdf" });
}
// 2.0.140: в названиях проекта и файлов — только буквы, цифры, пробел, «-» и «_». Точки, запятые, скобки
// и другие знаки → «_» (несколько подряд — один), пробелы и «_» по краям убираются
const cleanName = (n) => String(n == null ? "" : n).replace(/[^\p{L}\p{N} _-]/gu, "_").replace(/_{2,}/g, "_").replace(/ {2,}/g, " ");
const safeName = (n, fb = "LED_Mask") => {
  const s = cleanName(String(n || "").trim()).replace(/^[ _]+|[ _]+$/g, "");
  return s || fb;
};
const pad2 = (n) => String(n).padStart(2, "0");
// 2.0.108: имя файла маски — «1920x1080-» (размер, всегда авто) + часть, которую можно изменить (st.file); по умолчанию — название экрана
const maskFileTail = (st) => String(st.file || "").trim() || st.name || "screen";
const maskFileBase = (st) => {
  const [W, H] = dims(st);
  return "".concat(W, "x").concat(H, "-").concat(safeName(maskFileTail(st)));
};
// 2.0.106: имя файла поля — «1920x1080-» (размер, всегда авто) + часть, которую можно изменить (f.file);
// по умолчанию — «screens 1-2-3» (номера масок поля)
function fieldFileAuto(f) {
  const rs = fieldRects(f);
  // 2.0.107: одна маска — «screen 3», несколько — «screens 1-2-3»
  return (rs.length === 1 ? "screen " : "screens ") + rs.map((r) => r.i + 1).sort((x, y) => x - y).join("-");
}
function fieldFilePre(f) {
  const b = fieldBBox(fieldRects(f));
  return b ? "".concat(b.w, "x").concat(b.h, "-") : "";
}
function fieldFileBase(f) {
  const tail = String(f.file || "").trim() || fieldFileAuto(f);
  return safeName(fieldFilePre(f) + tail, "screens").slice(0, 180);
}
function uniqueNamer() {
  const used = /* @__PURE__ */ new Map();
  return (base) => {
    const k = base.toLowerCase(), n = (used.get(k) || 0) + 1;
    used.set(k, n);
    return n === 1 ? base : "".concat(base, " (").concat(n, ")");
  };
}
const tick = () => new Promise((r) => setTimeout(r, 0));
function busy(msg) {
  $("busyText").textContent = msg;
  $("busy").hidden = !msg;
}
const MIME = { png: "image/png", zip: "application/zip", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", json: "application/json", ledmask: "application/xml" };
async function saveStandalone(filename, data) {
  const ext = filename.split(".").pop().toLowerCase();
  const blob = data instanceof Blob ? data : new Blob([data], { type: MIME[ext] || "application/octet-stream" });
  const file = new File([blob], filename, { type: MIME[ext] || blob.type || "application/octet-stream" });
  const touch = matchMedia("(pointer: coarse)").matches;
  if (touch) return saveSheet(filename, blob, file);
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 6e4);
  status("Сохранено: " + filename, true);
  return true;
}
function saveSheet(filename, blob, file) {
  return new Promise((done) => {
    const sh = $("saveSheet"), url = URL.createObjectURL(blob), canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
    $("saveName").textContent = "".concat(filename, " · ").concat((blob.size / 1048576).toFixed(1), " МБ");
    const link = $("saveLink");
    link.href = url;
    link.download = filename;
    $("saveShare").hidden = !canShare;
    const close = (ok) => {
      sh.hidden = true;
      setTimeout(() => URL.revokeObjectURL(url), 12e4);
      done(ok);
    };
    $("saveShare").onclick = async () => {
      try {
        await navigator.share({ files: [file] });
        status("Готово: " + filename, true);
        close(true);
      } catch (e) {
        if (!(e && e.name === "AbortError")) status("«Поделиться» не сработало — нажмите «Скачать»", true);
      }
    };
    link.onclick = () => {
      status("Скачивание: " + filename + " (папка «Загрузки» в Файлах)", true);
      setTimeout(() => close(true), 400);
    };
    $("saveCancel").onclick = () => close(false);
    sh.hidden = false;
  });
}
async function saveAndroid(filename, data) {
  const br = window.AndroidBridge;
  const bytes = data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : typeof data === "string" ? enc.encode(data) : new Uint8Array(data);
  const id = br.begin(filename);
  if (!id) {
    status("Не удалось начать сохранение", true);
    return false;
  }
  const CH = 3 * 256 * 1024;
  for (let i = 0; i < bytes.length; i += CH) {
    const part = bytes.subarray(i, i + CH);
    let bin = "";
    for (let j = 0; j < part.length; j += 32768) bin += String.fromCharCode.apply(null, part.subarray(j, j + 32768));
    if (!br.append(id, btoa(bin))) {
      status("Ошибка записи файла", true);
      return false;
    }
    if (bytes.length > CH * 4) {
      busy("Сохранение… ".concat(Math.round(Math.min(1, (i + CH) / bytes.length) * 100), "%"));
      await tick();
    }
  }
  busy("");
  const r = String(br.finish(id, filename));
  const ok = r.startsWith("ok:");
  status(r.slice(r.indexOf(":") + 1), true);
  return ok;
}
async function saveDesktop(filename, data) {
  try {
    const bytes = await toBytes(data);
    const token = await desk("saveBegin", { name: filename });
    if (!token) {
      status("Сохранение отменено", true);
      return false;
    }
    const CH = 3 * 256 * 1024;
    for (let i = 0; i < bytes.length; i += CH) {
      await desk("saveAppend", { token, b64: bytesToB64(bytes.subarray(i, i + CH)) });
      if (bytes.length > CH * 4) {
        busy("Сохранение… ".concat(Math.round(Math.min(1, (i + CH) / bytes.length) * 100), "%"));
        await tick();
      }
    }
    const where = await desk("saveFinish", { token });
    busy("");
    status("Сохранено: " + (where || filename), true);
    return true;
  } catch (e) {
    busy("");
    status("Не удалось сохранить файл: " + e.message, true);
    return false;
  }
}
async function save(filename, data) {
  if (window.AndroidBridge) return saveAndroid(filename, data);
  if (DESKTOP) return saveDesktop(filename, data);
  if (STANDALONE) return saveStandalone(filename, data);
  if (!downloads) {
    status("Сохранение файлов недоступно в этом окне", true);
    return false;
  }
  try {
    await downloads.save({ filename, data });
    status("Готово: " + filename, true);
    return true;
  } catch (e) {
    const c = e && e.code;
    status(c === "declined" ? "Сохранение отменено" : c === "too_large" ? "Файл слишком большой для этого способа сохранения" : c === "rate_limited" ? "Подождите — предыдущее сохранение ещё не закрыто" : "Не удалось сохранить файл", true);
    return false;
  }
}
async function exportCurrentPNG() {
  const st = S(), [W, H] = dims(st);
  busy("Рендер ".concat(W, "×").concat(H, "…"));
  await tick();
  try {
    const r = await renderPNG(st, async (p) => {
      busy("Рендер ".concat(W, "×").concat(H, "… ").concat(Math.round(p * 100), "%"));
      await tick();
    });
    busy("");
    await save("".concat(maskFileBase(st), ".png"), new Blob([r.png], { type: "image/png" }));
  } catch (e) {
    busy("");
    status("Ошибка рендера: " + e.message, true);
  }
}
async function renderAll(prefix) {
  const out = [], uniq = uniqueNamer();
  for (let i = 0; i < project.screens.length; i++) {
    const st = project.screens[i], [W, H] = dims(st), name = safeName(st.name || "Экран_".concat(i + 1));
    busy("Экран ".concat(i + 1, " из ").concat(project.screens.length, ": ").concat(W, "×").concat(H, "…"));
    await tick();
    const r = await renderPNG(st);
    out.push({ ...r, file: "".concat(prefix).concat(uniq(maskFileBase(st)), ".png"), label: "".concat(W, "×").concat(H, "  |  ").concat(name, "  |  ").concat(physText(st)) });
  }
  return out;
}
async function exportAllPNG() {
  try {
    const pngs = await renderAll("");
    busy("Упаковка ZIP…");
    await tick();
    const z = await zip(pngs.map((p) => ({ name: p.file, data: p.png })));
    busy("");
    await save("".concat(safeName(project.name, "Проект"), "_PNG").concat(verSfx(), ".zip"), z);
  } catch (e) {
    busy("");
    status("Ошибка экспорта: " + e.message, true);
  }
}
// ===== 2.0.131: Волюметрик — готовые сетапы с координатной адресацией для MADRIX, MAD-SHOW и TouchDesigner =====
// Форматы повторяют файлы VolumetricMapper (примеры пользователя): MADRIX — патч .mpz, сетап .mpz с Art-Net устройствами,
// таблицы CSV (пиксели в 3D и universe); MAD-SHOW — .clen (патч MADRIX + Art-Net устройства внутри); TouchDesigner — .vmtd
// (атлас срезов + таблица Art-Net пакетов). Координаты: X — слева направо, Z — от фронта (0) назад, Y — сверху вниз (пиксель 1 — Y 0).
// Нити и universe — как в «Коммутации»: порядок кабинетов, порядок нитей в кабинете, IP по кабинетам, universe подряд.
const VOL_TPL = { patch: "{{b64:templates/vol/madrix_patch_head.xml.z}}", setup: "{{b64:templates/vol/madrix_setup.xml.z}}", clen: "{{b64:templates/vol/madshow.json.z}}" };
const volTplCache = {};
async function volTpl(k) {
  if (!volTplCache[k]) volTplCache[k] = dec.decode(await inflateRaw(b64ToBytes(VOL_TPL[k])));
  return volTplCache[k];
}
function bytesToB64(u8) {
  let s = "";
  for (let i = 0; i < u8.length; i += 32768) s += String.fromCharCode.apply(null, u8.subarray(i, i + 32768));
  return btoa(s);
}
const strB64 = (s) => bytesToB64(enc.encode(s));
async function gzipBytes(bytes) {
  const body = await deflateRaw(bytes), out = new Uint8Array(10 + body.length + 8), dv = new DataView(out.buffer);
  out.set([31, 139, 8, 0, 0, 0, 0, 0, 0, 255]);
  out.set(body, 10);
  dv.setUint32(10 + body.length, crc32(bytes), true);
  dv.setUint32(14 + body.length, bytes.length >>> 0, true);
  return out;
}
const volDate = () => {
  const d = new Date(), p = (v) => String(v).padStart(2, "0");
  return "".concat(d.getFullYear(), "/", p(d.getMonth() + 1), "/", p(d.getDate()), " ", p(d.getHours()), ":", p(d.getMinutes()), ":", p(d.getSeconds()));
};
// адресация: нити (x, z, кабинет, номер в кабинете, universe, канал) и universe (IP, порт кабинета)
function volAddr(st) {
  const g = volGeom(st), V = g.V, px = V.px, ch = px * 3;
  const pitch = Math.round(V.cw * 10 / V.sx * 10) / 10;
  const strands = g.strands.map((s2) => ({ x: s2.x, z: s2.z, cab: s2.cab, n: s2.n, uni: s2.cab * g.uniPerCab + s2.uni, ch: s2.n % g.perUni * ch }));
  const unis = [];
  for (const cab of g.cabs) for (let p = 0; p < g.uniPerCab; p++) unis.push({ u: cab.n * g.uniPerCab + p, cab: cab.n, ip: cab.ip, port: p });
  return { g, V, px, ch, W: g.NX, D: g.NZ, H: px, strands, unis, pitch, dev: "3DP" + String(pitch) };
}
function volCsvFixtures(A) {
  const L = ["﻿Product;Display Name;Fixture ID;Position X;Position Y;Position Z;DMX Universe;DMX Channel"];
  let id = 1;
  for (const s2 of A.strands) for (let p = 0; p < A.px; p++) L.push("Generic RGB;M".concat(s2.cab + 1, "-T", s2.n + 1, "-P", p + 1, ";", id++, ";", s2.x, ";", p, ";", s2.z, ";", s2.uni + 1, ";", s2.ch + p * 3 + 1));
  return L.join("\r\n") + "\r\n";
}
function volCsvUnis(A) {
  const L = ["﻿madrix_universe;artnet_universe;artnet_net;artnet_subnet;artnet_universe_in_subnet;ip;module;port_in_module"];
  for (const u of A.unis) L.push("".concat(u.u + 1, ";", u.u, ";", u.u >> 8, ";", u.u >> 4 & 15, ";", u.u & 15, ";", u.ip, ";", u.cab + 1, ";", u.port + 1));
  return L.join("\r\n") + "\r\n";
}
function volChannels(px, ver) {
  let s = "";
  for (let p = 0; p < px; p++) for (let c = 0; c < 3; c++) {
    const n = p * 3 + c;
    s += "<channel version=\"".concat(ver, "\"", n ? " number=\"" + n + "\"" : "", c ? " color_channel=\"" + c + "\"" : "", p ? " x=\"0\" y=\"" + p + "\" z=\"0\"" : "", "/>");
  }
  return s;
}
const volFill = (t, A) => t.split("@@DATE@@").join(volDate()).split("@@X@@").join(String(A.W)).split("@@Y@@").join(String(A.H)).split("@@Z@@").join(String(A.D));
const volPad = (n) => String(n).padStart(4, "0");
const volDmx = (s2) => (s2.uni ? "<dmx_universe value=\"" + (s2.uni + 1) + "\"/>" : "") + (s2.ch ? "<dmx_channel value=\"" + s2.ch + "\"/>" : "");
// патч MADRIX (как volumetric.mpz): XML без gzip — он же LayoutInfo в MAD-SHOW
async function volPatchXml(A) {
  const nm = "NEW_" + A.px, spec = "<fixture_specification version=\"0x05000000\"><manufacturer value=\"".concat(nm, "\"/><homepage value=\"", nm, "\"/><fixture_name value=\"", nm, "\"/><operation_mode value=\"clen\"/><pixel_count version=\"0x03000000\" x=\"1\" y=\"", A.px, "\" z=\"1\"/><dmx_channel_count value=\"", A.ch, "\"/>", volChannels(A.px, "0x00000000"), "</fixture_specification>");
  const head = "<fixture version=\"0x05000000\" fixture_uuid=\"943737d5-ac41-49ae-ad6c-54e4c781b2f4\">" + spec, parts = [volFill(await volTpl("patch"), A), "<fixture_list version=\"0x05000000\">"];
  A.strands.forEach((s2, i) => parts.push(head, "<fixture_settings version=\"0x05000000\"><fixture_id value=\"".concat(i, "\"/><display_name_user value=\" #", volPad(i + 1), "\"/><position version=\"0x00000000\" x=\"", s2.x, "\" y=\"0\" z=\"", s2.z, "\" />", volDmx(s2), "</fixture_settings></fixture>")));
  parts.push("</fixture_list><fixture_group_list version=\"0x03040000\"/></patch></madrix_patch>");
  return parts.join("");
}
const ipInt = (ip) => ip.split(".").reduce((a, v, i) => a + (+v || 0) * Math.pow(256, i), 0);
const hex2 = (v) => (v & 255).toString(16).toUpperCase().padStart(2, "0");
// сетап MADRIX (как volumetric_madrix.mpz): Art-Net устройство на каждый universe + патч
async function volSetupXml(A) {
  const nm = "VL" + A.px, bind = {}, dev = [], fx = ["<fixture_list version=\"0x05000000\">"];
  for (const u of A.unis) {
    const b = bind[u.ip] = bind[u.ip] == null ? 0 : bind[u.ip] + 1, o = u.ip.split(".").map(Number);
    dev.push("<dmx_device version=\"0x03000000\" index=\"".concat(dev.length, "\"><title value=\"", A.dev, " (", u.ip, ") ", b ? "BindIdx" + b + " " : "", "Port:0 \"/><universe value=\"", u.u + 1, "\"/><activ value=\"1\"/><in_out value=\"0\"/><protocol value=\"1\" info=\"Network Art-Net\"/><frametime value=\"30\"/><fullframes value=\"0\"/><settings_artnet version=\"0x03000000\"><artnet_id value=\"", ipInt(u.ip), "\"/><artnet_id_bind_idx value=\"", b, "\"/><artnet_id_man value=\"00000000-0000-0000-0000-000000000000\"/><artnet_dev_type value=\"1\"/><artnet_dev_enable_1 value=\"1\"/><artnet_dev_enable_2 value=\"0\"/><artnet_dev_enable_3 value=\"0\"/><artnet_dev_enable_4 value=\"0\"/><artnet_mac value=\"02:00:", hex2(o[3]), ":00:00:00\"/><artnet_style value=\"0\"/><artnet_major value=\"4\"/><artnet_minor value=\"2\"/><artnet_use_broadcast_send value=\"0\"/><artnet_use_broadcast_receive value=\"0\"/><artnet_ip value=\"", u.ip, "\"/><artnet_oem_code value=\"255\"/><artnet_oem_manufacturer value=\"Artistic Licence Engineering Ltd\"/><artnet_oem_product value=\"developer\"/><artnet_esta_1 value=\"0\"/><artnet_esta_2 value=\"0\"/><artnet_config_by_web value=\"8\"/><artnet_name_short value=\"", A.dev, "\"/><artnet_name_long value=\"Art-net Controller 240619\"/><artnet_port_numbers value=\"1\"/><artnet_port_type_1 value=\"2\" info=\"output\"/><artnet_port_type_2 value=\"0\" info=\"none\"/><artnet_port_type_3 value=\"0\" info=\"none\"/><artnet_port_type_4 value=\"0\" info=\"none\"/><artnet_port_protocol_1 value=\"0\"/><artnet_port_protocol_2 value=\"5\"/><artnet_port_protocol_3 value=\"5\"/><artnet_port_protocol_4 value=\"5\"/><artnet_port_net_switch value=\"", u.u >> 8, "\"/><artnet_port_sub_switch value=\"", u.u >> 4 & 15, "\"/><artnet_universe_in_1 value=\"", u.u & ~15, "\"/><artnet_universe_in_2 value=\"0\"/><artnet_universe_in_3 value=\"0\"/><artnet_universe_in_4 value=\"0\"/><artnet_universe_out_1 value=\"", u.u, "\"/><artnet_universe_out_2 value=\"0\"/><artnet_universe_out_3 value=\"0\"/><artnet_universe_out_4 value=\"0\"/><artnet_universe_virt_1 value=\"", u.u + 1, "\"/><artnet_universe_virt_2 value=\"1\"/><artnet_universe_virt_3 value=\"1\"/><artnet_universe_virt_4 value=\"1\"/><artnet_universe_virt_1_input value=\"", (u.u & ~15) + 1, "\"/><artnet_universe_virt_2_input value=\"1\"/><artnet_universe_virt_3_input value=\"1\"/><artnet_universe_virt_4_input value=\"1\"/><artnet_frame_time_1 value=\"30\"/><artnet_frame_time_2 value=\"30\"/><artnet_frame_time_3 value=\"30\"/><artnet_frame_time_4 value=\"30\"/><artnet_full_frames_1 value=\"0\"/><artnet_full_frames_2 value=\"0\"/><artnet_full_frames_3 value=\"0\"/><artnet_full_frames_4 value=\"0\"/><artnet_bind_ip value=\"", o[0], ".0.0.0\"/><artnet_ac_led_mode value=\"2\"/></settings_artnet></dmx_device>"));
  }
  const head = "<fixture version=\"0x05000000\" fixture_uuid=\"98f7753a-15a5-43e0-9da9-420bc97187de\"><fixture_specification version=\"0x05000000\"><manufacturer value=\"".concat(nm, "\"/><fixture_name value=\"", nm, "\"/><operation_mode value=\"", nm, "\"/><pixel_count version=\"0x03000000\" x=\"1\" y=\"", A.px, "\" z=\"1\"/><dmx_channel_count value=\"", A.ch, "\"/>", volChannels(A.px, "0x05000000"), "</fixture_specification>");
  A.strands.forEach((s2, i) => fx.push(head, "<fixture_settings version=\"0x05000000\"><fixture_id value=\"".concat(i, "\"/><display_name_user value=\"", nm, " #", volPad(i + 1), "\"/><position version=\"0x03000000\" x=\"", s2.x, "\" y=\"0\" z=\"", s2.z, "\"/>", volDmx(s2), "</fixture_settings></fixture>")));
  fx.push("</fixture_list>");
  return volFill(await volTpl("setup"), A).replace("@@DEV@@", () => dev.join("")).replace("@@FIX@@", () => fx.join(""));
}
// MAD-SHOW (.clen): «MAD-SHOW» + JSON; LayoutInfo — патч MADRIX, DeviceInfo — Art-Net устройства (по одному на universe)
const leB = (v, n) => {
  const a = [];
  for (let i = 0; i < n; i++) a.push(Math.floor(v / Math.pow(256, i)) & 255);
  return bytesToB64(Uint8Array.from(a));
};
async function volClen(A) {
  const bind = {}, devs = [];
  for (const u of A.unis) {
    const b = bind[u.ip] = bind[u.ip] == null ? 0 : bind[u.ip] + 1, ip = bytesToB64(Uint8Array.from(u.ip.split(".").map(Number).reverse()));
    const d = "{\"m_bindIndex\":\"".concat(leB(b, 1), "\",\"m_channel\":\"AAA=\",\"m_channels\":\"AA==\",\"m_data\":\"QXJ0LU5ldAAAgwAOAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJI=\",\"m_dmx_addr\":\"AAA=\",\"m_give_up_pix_number\":\"AA==\",\"m_height\":\"AA==\",\"m_ic_select\":\"AA==\",\"m_ipv4\":\"", ip, "\",\"m_ledNumber\":\"AA==\",\"m_led_pixel_number\":\"AA==\",\"m_mac[0]\":\"Ag==\",\"m_mac[1]\":\"AA==\",\"m_mac[2]\":\"Aw==\",\"m_mac[3]\":\"SQ==\",\"m_mac[4]\":\"AA==\",\"m_mac[5]\":\"Nw==\",\"m_mode\":\"AA==\",\"m_name\":\"", A.dev, "\",\"m_pixel\":\"AA==\",\"m_pixelCount\":\"AA==\",\"m_playMode\":\"AA==\",\"m_playTime\":\"AQ==\",\"m_portFlicker\":\"AA==\",\"m_portNumber\":\"AA==\",\"m_portState\":\"AA==\",\"m_portTest\":\"AA==\",\"m_ports\":\"AQA=\",\"m_sd_effect\":\"AA==\",\"m_sd_light\":\"AA==\",\"m_sd_speed\":\"AA==\",\"m_spare\":\"", ip, "\",\"m_subNet\":\"AAAAAA==\",\"m_swoutMapping[0]\":\"", leB(u.u, 2), "\",\"m_swoutMapping[1]\":\"AAA=\",\"m_swoutMapping[2]\":\"AAA=\",\"m_swoutMapping[3]\":\"AAA=\",\"m_swout[0]\":\"AA==\",\"m_swout[1]\":\"AA==\",\"m_swout[2]\":\"AA==\",\"m_swout[3]\":\"AA==\",\"m_type\":\"AA==\",\"m_universe\":\"AAA=\",\"m_universes\":\"", leB(u.u, 2), "\"}");
    devs.push("{\"DeviceInfo\":\"" + strB64(d) + "\",\"Enable\":true}");
  }
  let t = await volTpl("clen");
  // размер объёма в эффектах рабочих областей (Render X/Y/Z, m_renderX/Y/Z) — под эту конструкцию
  t = t.replace(/"WorkareaInfo":"([^"]*)"/, (m0, b) => {
    let w = dec.decode(b64ToBytes(b));
    w = w.replace(/"Data":"([^"]*)"/g, (m1, d) => "\"Data\":\"" + strB64(dec.decode(b64ToBytes(d)).replace(/"Render X":\d+,"Render Y":\d+,"Render Z":\d+/g, "\"Render X\":".concat(A.W, ",\"Render Y\":", A.H, ",\"Render Z\":", A.D))) + "\"");
    w = w.replace(/"m_renderX":\d+/g, "\"m_renderX\":" + A.W).replace(/"m_renderY":\d+/g, "\"m_renderY\":" + A.H).replace(/"m_renderZ":\d+/g, "\"m_renderZ\":" + A.D);
    return "\"WorkareaInfo\":\"" + strB64(w) + "\"";
  });
  const layout = strB64(await volPatchXml(A)), device = strB64("{\"0\":[" + devs.join(",") + "]}");
  return "MAD-SHOW" + t.replace("@@LAYOUTINFO@@", () => layout).replace("@@DEVICEINFO@@", () => device);
}
// TouchDesigner (.vmtd): срезы по высоте в атласе (плитка = срез W×D), на каждый universe — 512 индексов байтов RGBA атласа (−1 — пусто)
const pyNum = (v) => Number.isInteger(v) ? v + ".0" : String(v);
function volVmtd(A) {
  const tx = Math.ceil(Math.sqrt(A.H)), ty = Math.ceil(A.H / tx), aw = tx * A.W, ah = ty * A.D, n = A.unis.length;
  const idx = new Int32Array(n * 512).fill(-1), at = new Map(A.unis.map((u, i) => [u.u, i]));
  for (const s2 of A.strands) {
    const base = at.get(s2.uni) * 512 + s2.ch;
    for (let p = 0; p < A.px; p++) {
      const pix = (Math.floor(p / tx) * A.D + s2.z) * aw + p % tx * A.W + s2.x;
      for (let c = 0; c < 3; c++) idx[base + p * 3 + c] = pix * 4 + c;
    }
  }
  const pitchY = A.V.len * 1000 / A.px, pz = Math.round(A.V.cd * 10 / A.V.sz * 10) / 10;
  return "{\"format\": \"volumetric-mapper-td\", \"version\": 1, \"W\": ".concat(A.W, ", \"D\": ", A.D, ", \"H\": ", A.H, ", \"tiles_x\": ", tx, ", \"tiles_y\": ", ty, ", \"atlas_w\": ", aw, ", \"atlas_h\": ", ah, ", \"pitch_x_mm\": ", pyNum(A.pitch), ", \"pitch_z_mm\": ", pyNum(pz), ", \"pitch_y_mm\": ", pyNum(pitchY), ", \"modules_x\": ", A.V.cx, ", \"modules_z\": ", A.V.cz, ", \"pixels\": ", A.px, ", \"phantoms\": [], \"color_order\": \"RGB\", \"packets\": [", A.unis.map((u) => "[\"" + u.ip + "\", " + u.u + "]").join(", "), "], \"index_int32_le_b64\": \"", bytesToB64(new Uint8Array(idx.buffer)), "\"}");
}
// все файлы адресации одной конструкции; what — { madrix, madshow, td }
async function volSetupFiles(st, what, dir) {
  const A = volAddr(st), base = safeName(st.name || "volumetric"), out = [];
  if (!A.strands.length) return out;
  if (what.madrix !== false) {
    busy("MADRIX: " + base + "…");
    await tick();
    out.push({ name: dir + "MADRIX/" + base + "_madrix_patch.mpz", data: await gzipBytes(enc.encode(await volPatchXml(A))) });
    out.push({ name: dir + "MADRIX/" + base + "_madrix_setup.mpz", data: await gzipBytes(enc.encode(await volSetupXml(A))) });
    out.push({ name: dir + "MADRIX/" + base + "_madrix_fixtures_3D.csv", data: enc.encode(volCsvFixtures(A)) });
    out.push({ name: dir + "MADRIX/" + base + "_madrix_universes.csv", data: enc.encode(volCsvUnis(A)) });
  }
  if (what.madshow !== false) {
    busy("MAD-SHOW: " + base + "…");
    await tick();
    out.push({ name: dir + "MAD-SHOW/" + base + ".clen", data: enc.encode(await volClen(A)) });
  }
  if (what.td !== false) {
    busy("TouchDesigner: " + base + "…");
    await tick();
    out.push({ name: dir + "TouchDesigner/" + base + ".vmtd", data: enc.encode(volVmtd(A)) });
  }
  return out;
}
// конструкции-волюметрики, которые отмечены в ТЗ (в порядке ТЗ)
const tzVolScreens = () => tzOrder().filter((o) => o.st && o.st.kind === "vol" && o.st.vol && tzMaskOn(o.st)).map((o) => o.st);
const tzVolWhat = () => ({ madrix: adrUnlocked && project.tz.adrMadrix === true, madshow: adrUnlocked && project.tz.adrMadshow === true, td: adrUnlocked && project.tz.adrTd === true });
// 2.0.134: адресация недоступна в бесплатной версии — галочки не ставятся, появляется сообщение.
// Секрет: пока сообщение на экране, вслепую набрать 168 — функция открывается до «Нового» проекта
// (2.0.135: не запоминается — после «Нового» и при новом запуске снова закрыта).
var adrUnlocked = false;
try {
  localStorage.removeItem("ledmask-adr");
} catch (e) {
}
async function adrLocked(after) {
  if (adrUnlocked) return false;
  let buf = "";
  const key = (e) => {
    if (!/^\d$/.test(e.key)) return;
    e.preventDefault();
    e.stopPropagation();
    buf = (buf + e.key).slice(-3);
    if (buf !== "168") return;
    adrUnlocked = true;
    $("modalOk").click();
  };
  window.addEventListener("keydown", key, true);
  $("modalCancel").hidden = true;
  await ask("Функция недоступна", "Готовые сетапы с адресацией для MADRIX, MAD-SHOW и TouchDesigner недоступны в бесплатной версии.", "", "OK", false);
  window.removeEventListener("keydown", key, true);
  $("modalCancel").hidden = false;
  if (adrUnlocked) {
    syncTzTpl();
    if (after) after();
  }
  return !adrUnlocked;
}
async function volSetupAll(dir) {
  const what = tzVolWhat(), files = [], list = tzVolScreens(), many = list.length > 1;
  if (!what.madrix && !what.madshow && !what.td) return files;
  for (const st of list) files.push(...await volSetupFiles(st, what, dir + (many ? safeName(st.name || "volumetric") + "/" : "")));
  return files;
}
async function exportVolSetup() {
  try {
    if (!tzVolScreens().length) return status("В ТЗ не отмечено ни одной конструкции", true);
    const w = tzVolWhat();
    if (!w.madrix && !w.madshow && !w.td) return status("Не выбрана ни одна программа", true);
    const project_ = safeName(project.name, "Проект"), folder = "".concat(project_, " Адресация").concat(verSfx(), "/");
    const files = await volSetupAll(folder);
    busy("Упаковка ZIP…");
    await tick();
    const z = await zip(files);
    busy("");
    await save("".concat(project_, " Адресация").concat(verSfx(), ".zip"), z);
  } catch (e) {
    busy("");
    status("Ошибка: " + e.message, true);
  }
}
async function exportTZ(label) {
  if (!TPL[label]) {
    status("Шаблон для этого ТЗ ещё не добавлен", true);
    return;
  }
  // 2.0.115: проект в архиве ТЗ и следующее «Сохранить» — с этим типом ТЗ
  project.tz.tpl = label;
  const items = tzItems();
  if (!items.length) {
    status("В ТЗ ничего не отмечено", true);
    return;
  }
  // 2.0.150: если ТЗ с таким именем в этом браузере уже выгружали — предложить поднять версию (v2, v3 …)
  const tzBase0 = "".concat(safeName(project.name, "Проект"), " ТЗ_").concat(tzTag(label)).concat(verSfx());
  if (tzWasSaved(tzBase0)) {
    const r = await askBump("Такая версия ТЗ уже сохранялась", "Файл «".concat(tzBase0, ".zip» в этом браузере уже выгружался. Если сохраняете в ту же папку, поднимите версию, чтобы не затереть предыдущую — или оставьте имя как есть."), nextVer(project.ver));
    if (r === null) return;
    if (r.ver != null) {
      let v = String(r.ver).trim().slice(0, 20);
      if (/^\d+$/.test(v)) v = "v" + v;
      project.ver = v;
      if ($("projVer")) $("projVer").value = project.ver;
      scheduleAutosave();
    }
  }
  try {
    const project_ = safeName(project.name, "Проект"), tag = tzTag(label), folder = "".concat(project_, " ТЗ_").concat(tag).concat(verSfx(), "/"), pngs = [], uniq = uniqueNamer();
    for (let n = 0; n < items.length; n++) {
      const it = items[n];
      busy("Рендер ".concat(n + 1, " из ").concat(items.length, ": ").concat(it.w, "×").concat(it.h, "…"));
      await tick();
      const r = it.kind === "out" ? await renderOutPNG(it.m, it.scr) : it.kind === "cut" ? await renderCutPNG(it.c) : it.kind === "cutsrc" ? await renderBands(it.w, it.h, (ctx) => paintCutSrc(ctx, it.c, 1)) : it.kind === "field" ? await renderFieldPNG(it.f) : it.kind === "volcom" || it.kind === "vol3d" ? await renderBands(it.w, it.h, (ctx) => volItemPaint(ctx, it)) : await renderPNG(it.st);
      const base = it.kind === "out" ? outFileName(it.m, it.scr).replace(/\.png$/, "") : it.kind === "cut" ? cutFileBase(it.c) : it.kind === "cutsrc" ? cutFileBase(it.c) + "-исходник" : it.kind === "field" ? fieldFileBase(it.f) : it.kind === "volcom" || it.kind === "vol3d" ? "".concat(safeName(it.st.name || "volumetric"), it.kind === "volcom" ? it.com ? "-коммутация-сверху" : "-вид-снизу" : "-3D") : maskFileBase(it.st);
      pngs.push({ ...r, w: r.w || it.w, h: r.h || it.h, file: "".concat(folder).concat(uniq(base), ".png"), label: it.label, key: it.key, info: it.info, noFile: it.kind === "cutsrc" });
    }
    const ov = tzImages();
    busy("Сборка PPTX…");
    await tick();
    const masks = pngs.map((p) => ({ png: p.png, w: p.w, h: p.h, label: p.label, key: p.key, info: p.info }));
    await tplInfo(label);
    const pptBytes = new Uint8Array(await (await buildPptx(TPL[label], masks, ov, label)).arrayBuffer());
    busy("Сборка PDF…");
    await tick();
    const pdfBytes = new Uint8Array(await (await buildPdf(label, masks, ov)).arrayBuffer());
    busy("Упаковка ZIP…");
    await tick();
    const files = [{ name: "".concat(folder).concat(project_, "_ТЗ_").concat(tag).concat(verSfx(), ".pptx"), data: pptBytes }, { name: "".concat(folder).concat(project_, "_ТЗ_").concat(tag).concat(verSfx(), ".pdf"), data: pdfBytes }, ...pngs.filter((p) => !p.noFile).map((p) => ({ name: p.file, data: p.png }))];
    // 2.0.131: ТЗ «Волюметрик» — готовые сетапы с адресацией (MADRIX, MAD-SHOW, TouchDesigner) в папке «Адресация»
    if (/^Vol/.test(label)) files.push(...await volSetupAll(folder + "Адресация/"));
    if (project.tz.projZip !== false) {
      // 2.0.37: файл проекта — в тот же архив, рядом с PPTX, PDF и PNG (галочка «Файл проекта в архив», по умолчанию включена)
      const f = projectFile();
      files.push({ name: "".concat(folder).concat(f.name), data: typeof f.data === "string" ? enc.encode(f.data) : f.data });
    }
    const z = await zip(files);
    busy("");
    const zok = await save("".concat(project_, " ТЗ_").concat(tag).concat(verSfx(), ".zip"), z);
    if (zok !== false) {
      tzMarkSaved("".concat(project_, " ТЗ_").concat(tag).concat(verSfx()));
      recentAdd("ТЗ " + tzName(label) + (project.tz.projZip !== false ? " (проект в архиве)" : ""));
    }
  } catch (e) {
    busy("");
    status("Ошибка экспорта ТЗ: " + e.message, true);
  }
}
$("btnPNG").onclick = exportCurrentPNG;
$("tVolSetup").onclick = async () => {
  if (await adrLocked()) return;
  exportVolSetup();
};
$("btnAllPNG").onclick = exportAllPNG;
$("btnTZgo").onclick = () => setPage("tz");
$("fTZgo").onclick = () => setPage("tz");
function openHelp(id) {
  $("help").hidden = false;
  document.body.style.overflow = "hidden";
  if (id) $(id).scrollIntoView();
  else $("helpBody").scrollTop = 0;
  $("helpClose").focus({ preventScroll: true });
}
function closeHelp() {
  $("help").hidden = true;
  document.body.style.overflow = "";
}
$("btnHelp").onclick = () => openHelp();
$("btnHelpTop").onclick = () => openHelp();
$("helpClose").onclick = closeHelp;
$("help").addEventListener("click", (e) => {
  if (e.target === $("help")) closeHelp();
});
document.querySelectorAll(".help-toc a").forEach((a) => a.onclick = (e) => {
  e.preventDefault();
  $(a.dataset.h).scrollIntoView({ behavior: "smooth", block: "start" });
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("help").hidden) {
    e.stopImmediatePropagation();
    closeHelp();
  }
}, true);
$("btnAuthors").onclick = () => {
  setPage("about");
  window.scrollTo({ top: 0, behavior: "smooth" });
};
// 2.0.114: версия проекта (v1, v24…) — в конце имён файлов: «Проект_ТЗ_Resolume_v24»
function verSfx() {
  const v = String(project.ver || "").trim();
  return v ? "_" + safeName(v, "v") : "";
}
// 2.0.150: следующая версия (поднимаем последнее число; пусто → v2; без числа → _v2)
function nextVer(v) {
  const s = String(v || "").trim();
  if (!s) return "v2";
  const m = s.match(/^(.*?)(\d+)(\D*)$/);
  if (m) {
    const n = +m[2] + 1, w = m[2].length;
    return m[1] + (m[2][0] === "0" ? String(n).padStart(w, "0") : String(n)) + m[3];
  }
  return s + "_v2";
}
// 2.0.150: помним выгруженные в этом браузере имена ТЗ, чтобы предложить поднять версию при повторном сохранении в ту же папку
const TZ_SAVED_KEY = "ledmask.tzSaved";
function tzSavedList() {
  try {
    return JSON.parse(lsGet(TZ_SAVED_KEY) || "[]");
  } catch (e) {
    return [];
  }
}
const tzWasSaved = (base) => tzSavedList().includes(base);
function tzMarkSaved(base) {
  try {
    const a = tzSavedList().filter((x) => x !== base);
    a.unshift(base);
    lsSet(TZ_SAVED_KEY, JSON.stringify(a.slice(0, 200)));
  } catch (e) {
  }
}
// 2.0.150: диалог с тремя кнопками — поднять версию (поле редактируемое) / оставить имя / отмена
function askBump(title, text, value) {
  return new Promise((res) => {
    $("modalTitle").textContent = title;
    $("modalText").textContent = text || "";
    $("modalText").hidden = !text;
    const inp = $("modalInput");
    inp.hidden = false;
    inp.value = value || "";
    $("modalOk").textContent = "Сохранить с новой версией";
    const alt = $("modalAlt");
    alt.hidden = false;
    alt.textContent = "Оставить имя";
    $("modalCancel").textContent = "Отмена";
    $("modal").hidden = false;
    setTimeout(() => {
      inp.focus();
      inp.select();
    }, 30);
    const done = (v) => {
      $("modal").hidden = true;
      $("modalOk").textContent = "OK";
      alt.hidden = true;
      alt.textContent = "Не сохранять";
      $("modalOk").onclick = $("modalCancel").onclick = alt.onclick = inp.onkeydown = null;
      res(v);
    };
    $("modalOk").onclick = () => done({ ver: inp.value });
    alt.onclick = () => done({ keep: true });
    $("modalCancel").onclick = () => done(null);
    inp.onkeydown = (e) => {
      if (e.key === "Enter") done({ ver: inp.value });
      if (e.key === "Escape") done(null);
    };
  });
}
const projectFile = () => STANDALONE ? { name: "".concat(safeName(project.name, "Проект")).concat(verSfx(), ".ledmask"), data: toPlist(ledmaskData()) } : { name: "".concat(safeName(project.name, "Проект")).concat(verSfx(), ".ledmask.json"), data: JSON.stringify(projectData(), null, 1) };
// ---- 2.0.74: Сохранить / Сохранить как / Открыть, учёт несохранённых изменений ----
// В Chrome/Edge (веб) — File System Access: «Сохранить» пишет в тот же файл без вопросов.
// В программах для Windows/Mac/Android и в других браузерах «Сохранить» без известного файла = «Сохранить как».
let projHandle = null;
const SAVED_KEY = "ledmask.savedHash";
const FSA = !DESKTOP && !window.AndroidBridge && typeof window.showSaveFilePicker === "function" && typeof window.showOpenFilePicker === "function";
const FSA_TYPES = [{ description: "Проект LED Mask", accept: { "application/octet-stream": [".ledmask", ".json"] } }];
function projHash() {
  const t = histSnap() + JSON.stringify(ui.images.map((im) => [im.id, im.caption, im.marks, im.markR]));
  let h = 0;
  for (let i = 0; i < t.length; i++) h = h * 31 + t.charCodeAt(i) | 0;
  return t.length + ":" + h;
}
function savedHash() {
  try {
    return localStorage.getItem(SAVED_KEY);
  } catch (e) {
    return null;
  }
}
function markSaved() {
  try {
    localStorage.setItem(SAVED_KEY, projHash());
  } catch (e) {
  }
  updateProjState();
}
const isDirty = () => savedHash() !== projHash();
function updateProjState() {
  const el = $("projState");
  if (el) setTxt(el, isDirty() ? "● Есть несохранённые изменения" : projHandle ? "Сохранено в файл: " + projHandle.name : "");
}
function askUnsaved() {
  return new Promise((res) => {
    $("modalTitle").textContent = "Сохранить изменения в «".concat(project.name || "Проект", "»?");
    $("modalText").textContent = "Если не сохранить, несохранённые изменения будут потеряны.";
    $("modalText").hidden = false;
    $("modalInput").hidden = true;
    $("modalOk").textContent = "Сохранить";
    // 2.0.180: подписи задаются явно — окно версии ТЗ (askBump) меняет эту же кнопку на «Оставить имя»
    $("modalAlt").textContent = "Не сохранять";
    $("modalCancel").textContent = "Отмена";
    $("modalAlt").hidden = false;
    $("modal").hidden = false;
    const done = (v) => {
      $("modal").hidden = true;
      $("modalAlt").hidden = true;
      $("modalOk").onclick = $("modalCancel").onclick = $("modalAlt").onclick = null;
      res(v);
    };
    $("modalOk").onclick = () => done("save");
    $("modalAlt").onclick = () => done("discard");
    $("modalCancel").onclick = () => done(null);
  });
}
async function guardUnsaved() {
  if (!isDirty()) return true;
  const a = await askUnsaved();
  if (!a) return false;
  if (a === "save") return await projSave() !== false;
  return true;
}
async function writeHandle(h, data) {
  if (h.queryPermission && await h.queryPermission({ mode: "readwrite" }) !== "granted" && h.requestPermission && await h.requestPermission({ mode: "readwrite" }) !== "granted") return false;
  const w = await h.createWritable();
  await w.write(typeof data === "string" ? new Blob([data]) : data);
  await w.close();
  return true;
}
async function projSaveAs() {
  const f = projectFile();
  if (FSA) {
    try {
      const h = await window.showSaveFilePicker({ suggestedName: f.name, types: FSA_TYPES });
      if (!await writeHandle(h, f.data)) return false;
      projHandle = h;
      markSaved();
      recentAdd("сохранён: " + h.name);
      status("Сохранено: " + h.name, true);
      return true;
    } catch (e) {
      if (e && e.name === "AbortError") return false;
    }
  }
  const ok = await save(f.name, f.data);
  if (ok !== false) {
    markSaved();
    recentAdd("сохранён: " + f.name);
  }
  return ok;
}
async function projSave() {
  if (projHandle) {
    try {
      const f = projectFile();
      if (await writeHandle(projHandle, f.data)) {
        markSaved();
        recentAdd("сохранён: " + projHandle.name);
        status("Сохранено: " + projHandle.name, true);
        return true;
      }
    } catch (e) {
      status("Не удалось записать в тот же файл — выберите, куда сохранить", true);
    }
  }
  return projSaveAs();
}
$("btnSaveProj").onclick = () => projSave();
$("btnSaveAsProj").onclick = () => projSaveAs();
window.addEventListener("keydown", (e) => {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === "s" || k === "ы") {
    e.preventDefault();
    if (e.shiftKey) projSaveAs();
    else projSave();
  } else if ((k === "o" || k === "щ") && !e.shiftKey) {
    e.preventDefault();
    $("btnOpenProj").click();
  }
});
window.addEventListener("beforeunload", (e) => {
  // в браузере предупреждаем при закрытии вкладки с несохранёнными изменениями
  if (DESKTOP || window.AndroidBridge || !isDirty()) return;
  e.preventDefault();
  e.returnValue = "";
});
// 2.0.48: «Последние проекты» — сам проект запоминается в хранилище программы (до 10 штук)
const RECENT_KEY = "ledmask.recent", RECENT_MAX = 10;
function recentGet() {
  try {
    const a = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(a) ? a : [];
  } catch (e) {
    return [];
  }
}
function recentPut(list) {
  for (let tries = 0; tries < 30; tries++) {
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(list));
      return true;
    } catch (e) {
      // места не хватает: сначала убираем картинки у старых записей, потом сами старые записи
      const heavy = [...list].reverse().find((it) => it.data && (it.data.refImages && Object.keys(it.data.refImages).length || it.data.overviewImages && it.data.overviewImages.length));
      if (heavy) heavy.data = { ...heavy.data, refImages: {}, overviewImages: [] };
      else if (list.length > 1) list.pop();
      else return false;
    }
  }
  return false;
}
function recentThumb() {
  try {
    const st = project.screens[0], [W, H] = dims(st), k = Math.min(192 / W, 108 / H);
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(W * k));
    c.height = Math.max(1, Math.round(H * k));
    drawMask(c.getContext("2d"), st, k, guidesOf(st));
    return c.toDataURL("image/jpeg", 0.7);
  } catch (e) {
    return "";
  }
}
function recentAdd(src) {
  try {
    const name = project.name || "Проект", list = recentGet().filter((it) => it.name !== name);
    const st = project.screens[0], [W, H] = st ? dims(st) : [0, 0];
    list.unshift({ name, src, at: Date.now(), screens: project.screens.length, res: "".concat(W, "×").concat(H), thumb: recentThumb(), data: projectData(true) });
    recentPut(list.slice(0, RECENT_MAX));
  } catch (e) {
  }
}
const recentWhen = (t) => {
  const d = new Date(t), p2 = (n) => String(n).padStart(2, "0");
  return "".concat(p2(d.getDate()), ".").concat(p2(d.getMonth() + 1), ".").concat(d.getFullYear(), " ").concat(p2(d.getHours()), ":").concat(p2(d.getMinutes()));
};
const screensWord = (n) => n % 10 === 1 && n % 100 !== 11 ? "экран" : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? "экрана" : "экранов";
function renderRecent() {
  const box = $("recentList"), list = recentGet();
  box.innerHTML = "";
  if (!list.length) {
    box.innerHTML = '<div class="recent-empty">Пока пусто. Откройте или сохраните проект — он появится здесь.</div>';
    return;
  }
  list.forEach((it, i) => {
    const row = document.createElement("div");
    row.className = "recent-item";
    const img = document.createElement("img");
    img.alt = "";
    if (it.thumb) img.src = it.thumb;
    const info = document.createElement("div");
    const b = document.createElement("b");
    b.textContent = it.name;
    const h1 = document.createElement("p");
    h1.className = "hint";
    h1.textContent = "".concat(it.screens || 1, " ").concat(screensWord(it.screens || 1), " · ").concat(it.res || "");
    const h2 = document.createElement("p");
    h2.className = "hint";
    h2.textContent = "".concat(recentWhen(it.at), " · ").concat(it.src || "");
    info.append(b, h1, h2);
    const acts = document.createElement("div");
    acts.className = "acts";
    const op = document.createElement("button");
    op.className = "b";
    op.textContent = "Открыть";
    op.onclick = () => recentOpen(i);
    const del = document.createElement("button");
    del.className = "b sq";
    del.textContent = "×";
    del.title = "Убрать из списка";
    del.onclick = () => {
      const l = recentGet();
      l.splice(i, 1);
      recentPut(l);
      renderRecent();
    };
    acts.append(op, del);
    row.append(img, info, acts);
    box.appendChild(row);
  });
}
async function recentOpen(i) {
  const it = recentGet()[i];
  if (!it || !it.data) return;
  $("recent").hidden = true;
  if (!await guardUnsaved()) {
    $("recent").hidden = false;
    return;
  }
  if (it.name !== project.name) recentAdd("последнее состояние");
  try {
    loadData(it.data);
    syncUI();
    changed({ forcePhys: true });
    await ui.ovReady;
    if (ui.ovMissing) status("Картинки общего плана не найдены в памяти программы — откройте файл проекта", true);
    recentAdd(it.src && it.src.indexOf("открыт из последних") === 0 ? it.src : "открыт из последних");
    projHandle = null;
    markSaved();
    status("Открыт проект: " + it.name, true);
  } catch (err) {
    status("Не удалось открыть проект: " + err.message, true);
  }
}
$("btnRecent").onclick = () => {
  renderRecent();
  $("recent").hidden = false;
};
$("recentClose").onclick = () => $("recent").hidden = true;
$("recent").addEventListener("click", (e) => {
  if (e.target === $("recent")) $("recent").hidden = true;
});
$("recentClear").onclick = async () => {
  $("recent").hidden = true;
  if (await ask("Очистить список последних проектов?", "Сами файлы проектов не удаляются.", "", "Очистить", false)) recentPut([]);
  renderRecent();
  $("recent").hidden = false;
};
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("recent").hidden) $("recent").hidden = true;
});
function updateTZNote() {
  const w = tzVolWhat(), progs = /^Vol/.test(ui.tzTpl) ? [w.madrix && "MADRIX", w.madshow && "MAD-SHOW", w.td && "TouchDesigner"].filter(Boolean) : [];
  $("tNote").textContent = "ZIP с папкой: PPTX по шаблону, такой же PDF и PNG каждой маски и поля" + (progs.length ? ", папка «Адресация» (" + progs.join(", ") + ")" : "") + (project.tz.projZip !== false ? " и файл проекта." : ".");
}
// 2.0.113: File.text() нет в Safari 12–13 (Mac 10.14) — читаем через FileReader
const fileText = (f) => typeof f.text === "function" ? f.text() : new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result || ""));
  r.onerror = () => rej(r.error || new Error("не удалось прочитать файл"));
  r.readAsText(f);
});
async function openProjText(text, name, handle) {
  const d = /^\s*(<\?xml|<!DOCTYPE plist|<plist)/.test(text) ? parsePlist(text) : JSON.parse(text);
  loadData(d);
  syncUI();
  changed({ forcePhys: true });
  projHandle = handle || null;
  // 2.0.112: картинки общего плана открываются не сразу — в «Последние» и «сохранено» только после них
  const nOv = Array.isArray(d.overviewImages) ? d.overviewImages.length : 0;
  if (nOv) busy("Загрузка картинок общего плана…");
  try {
    await ui.ovReady;
  } finally {
    if (nOv) busy("");
  }
  recentAdd("открыт файл: " + name);
  markSaved();
  status("Открыт проект: ".concat(name).concat(nOv ? " · картинок общего плана: ".concat(ui.images.length) : ""), true);
}
$("btnOpenProj").onclick = async () => {
  if (!await guardUnsaved()) return;
  if (FSA) {
    try {
      const [h] = await window.showOpenFilePicker({ types: FSA_TYPES, multiple: false });
      const f = await h.getFile();
      await openProjText(await fileText(f), f.name, h);
    } catch (e) {
      if (e && e.name !== "AbortError") status("Не удалось открыть проект: " + e.message, true);
    }
    return;
  }
  $("fileProj").click();
};
$("fileProj").addEventListener("change", async (e) => {
  const f = e.target.files[0];
  e.target.value = "";
  if (!f) return;
  try {
    await openProjText(await fileText(f), f.name, null);
  } catch (err) {
    status("Не удалось открыть проект: " + err.message, true);
  }
});
ui.page = "mask";
ui.magnet = true;
function freshField(k) {
  return { id: newUid(), name: k ? "Общее поле ".concat(k + 1) : "Общее поле", items: [], title: { on: true, x: 0, y: 0, size: 0, meters: false }, stack: false };
}
function freshFieldState() {
  return { fields: [], fieldCur: 0, cuts: [], cutCur: 0, outs: [], outCur: 0, tz: { fields: {}, masks: {}, cuts: {}, overview: true, projZip: true, imgPer: 0, maskPer: 0, maskPerS: {}, evenSize: true, maskGrid: "", req: {}, notes: {}, pos: {} } };
}
function loadFieldState(d, raw) {
  const seen = /* @__PURE__ */ new Set();
  project.screens.forEach((s) => {
    if (seen.has(s.uid)) s.uid = newUid();
    seen.add(s.uid);
  });
  let fields = Array.isArray(d.fields) ? d.fields : null;
  if (!fields) {
    const items = [];
    raw.forEach((x, i) => {
      if (x && x.field && isFinite(+x.field.x) && isFinite(+x.field.y) && project.screens[i]) items.push({ uid: project.screens[i].uid, x: +x.field.x, y: +x.field.y, rot: 0 });
    });
    fields = [{ name: "Общее поле", items, title: d.fieldTitle || {} }];
  }
  project.fields = fields.filter((f) => f && typeof f === "object").map((f, k) => {
    const t = f.title && typeof f.title === "object" ? f.title : {}, used = /* @__PURE__ */ new Set();
    const items = (Array.isArray(f.items) ? f.items : []).map((it) => {
      let uid = String(it && it.uid || "");
      if (!project.screens.some((s) => s.uid === uid)) {
        const si = parseInt(it && it.si, 10);
        uid = project.screens[si] ? project.screens[si].uid : "";
      }
      return { uid, x: Math.round(+it.x || 0), y: Math.round(+it.y || 0), rot: Math.round((((+it.rot || 0) % 360) + 360) % 360 * 100) / 100 % 360 };
    }).filter((it) => {
      // 2.0.149: волюметрик в общее поле не попадает — это другое направление
      if (!it.uid || used.has(it.uid)) return false;
      const sc = project.screens.find((x) => x.uid === it.uid);
      if (sc && sc.kind === "vol") return false;
      used.add(it.uid);
      return true;
    });
    return { id: typeof f.id === "string" && f.id ? f.id : newUid(), name: String(f.name || (k ? "Общее поле ".concat(k + 1) : "Общее поле")), items, title: { on: t.on == null ? true : !!t.on, x: Math.round(+t.x || 0), y: Math.round(+t.y || 0), size: clampI(t.size, INSC.length), meters: !!t.meters }, stack: !!f.stack, file: typeof f.file === "string" ? f.file : "" };
  });
  if (!project.fields.length) project.fields = [freshField(0)];
  project.fieldCur = clampI(d.fieldCur, project.fields.length);
  // 2.0.118: нарезки
  project.cuts = (Array.isArray(d.cuts) ? d.cuts : []).filter((c) => c && typeof c === "object").map(normCut);
  project.cutCur = clampI(d.cutCur, Math.max(1, project.cuts.length));
  // 2.0.122: выходы
  project.outs = (Array.isArray(d.outs) ? d.outs : []).filter((o) => o && typeof o === "object").map(normOut);
  project.outCur = clampI(d.outCur, Math.max(1, project.outs.length));
  const tz = d.tz && typeof d.tz === "object" ? d.tz : {};
  const boolMap = (m) => {
    const o = {};
    if (m && typeof m === "object" && !Array.isArray(m)) for (const [k, v] of Object.entries(m)) o[k] = !!v;
    return o;
  };
  const posMap = (m) => {
    const o = {};
    if (m && typeof m === "object" && !Array.isArray(m)) {
      for (const [k, v] of Object.entries(m)) if (v && isFinite(+v.x) && isFinite(+v.y)) o[k] = { x: Math.round(+v.x), y: Math.round(+v.y) };
    }
    return o;
  };
  const strMap = (m) => {
    const o = {};
    if (m && typeof m === "object" && !Array.isArray(m)) {
      for (const [k, v] of Object.entries(m)) if (typeof v === "string") o[k] = v;
    }
    return o;
  };
  project.tz = { fields: boolMap(tz.fields), masks: boolMap(tz.masks), overview: tz.overview == null ? true : !!tz.overview, projZip: tz.projZip !== false, volMask: tz.volMask === true, volCom: tz.volCom !== false, vol3d: tz.vol3d !== false, volInfo: tz.volInfo !== false, adrMadrix: tz.adrMadrix === true, adrMadshow: tz.adrMadshow === true, adrTd: tz.adrTd === true, imgPer: Math.max(0, Math.min(3, pint(tz.imgPer, 0))), maskPer: Math.max(0, Math.min(10, pint(tz.maskPer, 0))), maskPerS: (() => { const o = {}, src = tz.maskPerS && typeof tz.maskPerS === "object" ? tz.maskPerS : {}; for (const kk of Object.keys(src)) { const v = pint(src[kk], 0); if (/^\d+$/.test(kk) && v >= 1 && v <= 10) o[kk] = v; } return o; })(), evenSize: tz.evenSize !== false, maskGrid: /^\d+x\d+$/.test(tz.maskGrid || "") ? tz.maskGrid : "", req: strMap(tz.req), notes: strMap(tz.notes), pos: posMap(tz.pos) };
  // 2.0.114: порядок листов ТЗ и выбранный тип ТЗ — раньше при открытии сбрасывались
  if (Array.isArray(tz.order)) project.tz.order = tz.order.filter((k) => typeof k === "string" && /^[fmco]:/.test(k));
  project.tz.cuts = boolMap(tz.cuts);
  project.tz.outs = boolMap(tz.outs);
  if (typeof tz.tpl === "string" && TPL[tz.tpl]) project.tz.tpl = tz.tpl;
  keepRest(project.tz, tz);
}
const CF = () => {
  if (!Array.isArray(project.fields) || !project.fields.length) project.fields = [freshField(0)];
  return project.fields[Math.max(0, Math.min(project.fields.length - 1, project.fieldCur || 0))];
};
const evenUp = (v) => {
  v = Math.ceil(v - 1e-9);
  return v % 2 ? v + 1 : v;
};
const rotDims = (w, h, rot) => {
  const a = rot * Math.PI / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
  return [evenPx(Math.round(w * c + h * s)), evenPx(Math.round(w * s + h * c))];
};
function fieldRects(f = CF()) {
  const out = [];
  if (!f) return out;
  for (const it of f.items) {
    const i = project.screens.findIndex((s) => s.uid === it.uid);
    if (i < 0) continue;
    const st = project.screens[i], [w0, h0] = dims(st), [w, h] = rotDims(w0, h0, it.rot || 0);
    out.push({ i, uid: it.uid, it, st, x: it.x, y: it.y, rot: it.rot || 0, w0, h0, w, h });
  }
  return out;
}
function fieldBBox(rs) {
  if (!rs.length) return null;
  const x0 = Math.min(...rs.map((r) => r.x)), y0 = Math.min(...rs.map((r) => r.y));
  const x1 = Math.max(...rs.map((r) => r.x + r.w)), y1 = Math.max(...rs.map((r) => r.y + r.h));
  return { x: x0, y: y0, w: evenUp(x1 - x0), h: evenUp(y1 - y0), rawW: x1 - x0, rawH: y1 - y0 };
}
const pitchMM = (st) => {
  if (st.kind && st.kind !== "led") {
    const [W] = dims(st), [pw, , k2] = physM(st);
    return [pw * 1e3 / W, pw * 1e3 / W, k2];
  }
  const [w, h, k] = typeMM(st);
  return [w / st.cabWpx, h / st.cabHpx, k];
};
function fieldPhys(rs, b) {
  const p = rs.map((r) => pitchMM(r.st));
  const same = p.every((q) => Math.abs(q[0] - p[0][0]) < 1e-6 && Math.abs(q[1] - p[0][1]) < 1e-6);
  return same ? { w: b.w * p[0][0] / 1e3, h: b.h * p[0][1] / 1e3, known: p.every((q) => q[2]) } : null;
}
function overlaps(rs) {
  const out = [], ax = rs.filter((r) => r.rot % 90 === 0);
  for (let a = 0; a < ax.length; a++) for (let b = a + 1; b < ax.length; b++) {
    const A = ax[a], B = ax[b], x0 = Math.max(A.x, B.x), y0 = Math.max(A.y, B.y), x1 = Math.min(A.x + A.w, B.x + B.w), y1 = Math.min(A.y + A.h, B.y + B.h);
    if (x1 > x0 && y1 > y0) out.push({ a: A.i, b: B.i, x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
  }
  return out;
}
function fieldTitleCenter(f, b) {
  return [b.x + b.w / 2 + f.title.x, b.y + b.h / 2 + f.title.y];
}
function fieldTitleLines(f, rs, b, s) {
  const name = f.name || "Общее поле", si = clampI(f.title.size, INSC.length), ph = fieldPhys(rs, b);
  const size = si ? Math.max(6, Math.min(900, pfloat(INSC[si]))) : autoSize(b.w, b.h, name);
  const s1 = Math.max(10, size) * s, s2 = Math.max(8, size * 0.55) * s, s3 = Math.max(4, Math.max(8, size * 0.55) * 0.5) * s;
  const lines = [["".concat(b.w, "×").concat(b.h), s1], [name, s2]];
  if (ph && f.title.meters) lines.push(["".concat(compactM(ph.w), "х").concat(compactM(ph.h), " м"), s3]);
  return lines;
}
// 2.0.90: «Накладывать маски на маски» — выключенные кабинеты маски прозрачные, сквозь них видна маска ниже
function maskHoles(st) {
  if (st.kind && st.kind !== "led") return [];
  const black = new Set(st.blackCabinets || []);
  for (const k of shapeOff(st)) black.add(k);
  if (!black.size) return [];
  const { xs, ys } = grid(st), [, H] = dims(st), out = [];
  for (const k of black) {
    const p2 = parseKey(k);
    if (!p2 || p2[0] < 0 || p2[1] < 0 || p2[0] >= st.cabCols || p2[1] >= st.cabRows) continue;
    out.push([xs[p2[0]], H - ys[p2[1] + 1], xs[p2[0] + 1] - xs[p2[0]], ys[p2[1] + 1] - ys[p2[1]]]);
  }
  return out;
}
function clipHoles(ctx, st, s, w0, h0) {
  if (st.kind === "ring") {
    // кольцо на общем поле поверх других масок: видны только сами кабинеты
    ctx.beginPath();
    for (const m of ringGeom(st).list) if (!m.off) {
      const q = ringPoly(m);
      q.forEach((p, i) => i ? ctx.lineTo(p[0] * s, p[1] * s) : ctx.moveTo(p[0] * s, p[1] * s));
      ctx.closePath();
    }
    ctx.clip();
    return;
  }
  const hs = maskHoles(st);
  ctx.beginPath();
  ctx.rect(0, 0, w0 * s, h0 * s);
  for (const [x, y, w, h] of hs) ctx.rect(x * s, y * s, w * s, h * s);
  ctx.clip("evenodd");
}
function paintField(ctx, f, s) {
  const rs = fieldRects(f), b = fieldBBox(rs);
  if (!b) return;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, Math.round(b.w * s), Math.round(b.h * s));
  for (const r of rs) {
    ctx.save();
    ctx.translate((r.x - b.x + r.w / 2) * s, (r.y - b.y + r.h / 2) * s);
    ctx.rotate(r.rot * Math.PI / 180);
    ctx.translate(-r.w0 * s / 2, -r.h0 * s / 2);
    if (f.stack) clipHoles(ctx, r.st, s, r.w0, r.h0);
    else {
      ctx.beginPath();
      ctx.rect(0, 0, r.w0 * s, r.h0 * s);
      ctx.clip();
    }
    drawMask(ctx, r.st, s, guidesOf(r.st));
    ctx.restore();
  }
  if (f.title.on) {
    const [tx, ty] = fieldTitleCenter(f, b);
    ctx.fillStyle = "#fff";
    ctx.textBaseline = "alphabetic";
    drawBlock(ctx, fieldTitleLines(f, rs, b, s), TITLE_GAP * s, (tx - b.x) * s, (ty - b.y) * s, 0);
  }
}
async function renderFieldPNG(f, onBand) {
  const b = fieldBBox(fieldRects(f));
  return renderBands(b.w, b.h, (ctx) => paintField(ctx, f, 1), onBand);
}
const FV = { s: 0.2, ox: 0, oy: 0, fitted: false };
const fld = { sel: null, drag: null, pointers: /* @__PURE__ */ new Map(), pinch: null, gx: null, gy: null };
const thumbs = /* @__PURE__ */ new Map();
function thumb(r) {
  const k = JSON.stringify({ ...r.st, field: 0 }) + JSON.stringify(project.guides);
  const c = thumbs.get(r.uid);
  if (c && c.k === k) return c.cv;
  const s = Math.min(1, 1600 / Math.max(r.w0, r.h0)), cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(r.w0 * s));
  cv.height = Math.max(1, Math.round(r.h0 * s));
  drawMask(cv.getContext("2d"), r.st, s, guidesOf(r.st));
  thumbs.set(r.uid, { k, cv });
  return cv;
}
const FX = (x) => FV.ox + x * FV.s, FY = (y) => FV.oy + y * FV.s;
function fieldTitleFrame(f, rs, b) {
  const bs = blockSize(fieldTitleLines(f, rs, b, FV.s), TITLE_GAP * FV.s), [cx, cy] = fieldTitleCenter(f, b);
  return { cx: FX(cx), cy: FY(cy), w: bs.w, h: bs.h };
}
function fitField() {
  const r = $("wrap").getBoundingClientRect(), b = fieldBBox(fieldRects()) || { x: 0, y: 0, w: 1920, h: 1080 };
  const pad = r.width < 600 ? 28 : 64;
  FV.s = Math.max(1e-4, Math.min((r.width - pad * 2) / b.w, (r.height - pad * 2) / b.h));
  FV.ox = (r.width - b.w * FV.s) / 2 - b.x * FV.s;
  FV.oy = (r.height - b.h * FV.s) / 2 - b.y * FV.s;
  FV.fitted = true;
  FV.base = FV.s;
}
function prepCanvas(wh) {
  fitStage(wh);
  const dpr = Math.min(3, window.devicePixelRatio || 1), R = $("wrap").getBoundingClientRect();
  const w = Math.max(1, Math.round(R.width * dpr)), h = Math.max(1, Math.round(R.height * dpr));
  if (pv.width !== w || pv.height !== h) {
    pv.width = w;
    pv.height = h;
  }
  pctx.setTransform(1, 0, 0, 1, 0, 0);
  pctx.fillStyle = (getComputedStyle(document.documentElement).getPropertyValue("--stage") || "#1d1f21").trim();
  pctx.fillRect(0, 0, w, h);
  pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return R;
}
function drawField() {
  const f = CF();
  if (!f) {
    const R = prepCanvas([16, 9]);
    pctx.fillStyle = "#8c9bab";
    pctx.font = "15px ".concat(FONT);
    pctx.textAlign = "center";
    pctx.fillText("Нажмите «+ Поле», чтобы собрать несколько экранов в одно поле", R.width / 2, R.height / 2);
    pctx.textAlign = "left";
    return;
  }
  const rs = fieldRects(), b = fieldBBox(rs);
  const R = prepCanvas(b ? [b.w, b.h] : [16, 9]);
  if (!FV.fitted) fitField();
  const c = pctx;
  $("fzLabel").textContent = Math.round(FV.s / (FV.base || FV.s) * 100) + "%";
  if (!rs.length) {
    c.fillStyle = "#8c9bab";
    c.font = "14px ".concat(FONT);
    c.textAlign = "center";
    c.fillText("«".concat(f.name, "»: отметьте экраны в разделе «Общее поле»"), R.width / 2, R.height / 2);
    c.textAlign = "left";
    return;
  }
  c.fillStyle = "#000";
  c.fillRect(FX(b.x), FY(b.y), b.w * FV.s, b.h * FV.s);
  const order = rs; // 2.0.91: слои — в порядке списка поля (кнопки «Слой»)
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = "high";
  for (const r of order) {
    c.save();
    c.translate(FX(r.x + r.w / 2), FY(r.y + r.h / 2));
    c.rotate(r.rot * Math.PI / 180);
    if (f.stack) {
      c.translate(-r.w0 * FV.s / 2, -r.h0 * FV.s / 2);
      clipHoles(c, r.st, FV.s, r.w0, r.h0);
      c.drawImage(thumb(r), 0, 0, r.w0 * FV.s, r.h0 * FV.s);
    } else c.drawImage(thumb(r), -r.w0 * FV.s / 2, -r.h0 * FV.s / 2, r.w0 * FV.s, r.h0 * FV.s);
    c.restore();
  }
  if (!f.stack) for (const o of overlaps(rs)) {
    c.fillStyle = "rgba(255,40,40,.45)";
    c.fillRect(FX(o.x), FY(o.y), o.w * FV.s, o.h * FV.s);
  }
  if (f.title.on) {
    const [tx, ty] = fieldTitleCenter(f, b);
    c.fillStyle = "#fff";
    c.textBaseline = "alphabetic";
    drawBlock(c, fieldTitleLines(f, rs, b, FV.s), TITLE_GAP * FV.s, FX(tx), FY(ty), 0);
    if (fld.titleHover || fld.drag && fld.drag.kind === "title") {
      const fr = fieldTitleFrame(f, rs, b);
      c.strokeStyle = "#ffdb0d";
      c.lineWidth = 1.5;
      c.setLineDash([4, 3]);
      c.strokeRect(fr.cx - fr.w / 2 - 6, fr.cy - fr.h / 2 - 4, fr.w + 12, fr.h + 8);
      c.setLineDash([]);
    }
  }
  c.font = "600 12px ".concat(FONT);
  c.textBaseline = "top";
  for (const r of order) {
    const t = "".concat(r.i + 1, ". ").concat(r.st.name || "screen", " · ").concat(r.w0, "×").concat(r.h0).concat(r.rot ? " · ".concat(rotLabel(r.rot)) : ""), tw = c.measureText(t).width;
    const x = FX(r.x) + 4, y = FY(r.y) + 4;
    if (r.w * FV.s > 40 && r.h * FV.s > 22) {
      c.fillStyle = "rgba(10,14,18,.78)";
      c.fillRect(x, y, Math.min(tw + 10, r.w * FV.s - 8), 18);
      c.fillStyle = "#e8eff5";
      c.save();
      c.beginPath();
      c.rect(x, y, r.w * FV.s - 8, 18);
      c.clip();
      c.fillText(t, x + 5, y + 3);
      c.restore();
    }
  }
  const sel = rs.find((r) => r.uid === fld.sel);
  if (sel) {
    c.save();
    c.translate(FX(sel.x + sel.w / 2), FY(sel.y + sel.h / 2));
    c.rotate(sel.rot * Math.PI / 180);
    c.strokeStyle = "#19c5b5";
    c.lineWidth = 2;
    c.strokeRect(-sel.w0 * FV.s / 2 + 1, -sel.h0 * FV.s / 2 + 1, sel.w0 * FV.s - 2, sel.h0 * FV.s - 2);
    c.restore();
    {
      const [hx, hy, bx, by] = fieldRotHandle(sel);
      c.strokeStyle = "#34c759";
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(bx, by);
      c.lineTo(hx, hy);
      c.stroke();
      c.fillStyle = "#34c759";
      c.beginPath();
      c.arc(hx, hy, 6, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "#000";
      c.lineWidth = 1;
      c.stroke();
    }
    if (sel.rot % 90) {
      c.strokeStyle = "rgba(25,197,181,.5)";
      c.lineWidth = 1;
      c.setLineDash([3, 3]);
      c.strokeRect(FX(sel.x) + 0.5, FY(sel.y) + 0.5, sel.w * FV.s - 1, sel.h * FV.s - 1);
      c.setLineDash([]);
    }
  }
  c.strokeStyle = "#00f2ff";
  c.lineWidth = 1;
  c.setLineDash([5, 4]);
  if (fld.gx != null) {
    c.beginPath();
    c.moveTo(FX(fld.gx) + 0.5, FY(b.y) - 14);
    c.lineTo(FX(fld.gx) + 0.5, FY(b.y + b.h) + 14);
    c.stroke();
  }
  if (fld.gy != null) {
    c.beginPath();
    c.moveTo(FX(b.x) - 14, FY(fld.gy) + 0.5);
    c.lineTo(FX(b.x + b.w) + 14, FY(fld.gy) + 0.5);
    c.stroke();
  }
  c.strokeStyle = "rgba(255,255,255,.75)";
  c.setLineDash([6, 5]);
  c.strokeRect(FX(b.x) - 3.5, FY(b.y) - 3.5, b.w * FV.s + 7, b.h * FV.s + 7);
  c.setLineDash([]);
  const ph = fieldPhys(rs, b), mW = ph ? " · ".concat(compactM(ph.w), " м") : "", mH = ph ? " · ".concat(compactM(ph.h), " м") : "";
  c.fillStyle = "#ffffff";
  c.font = "600 12.5px ".concat(FONT);
  c.textBaseline = "bottom";
  c.textAlign = "center";
  dimLine(c, FX(b.x), FY(b.y) - 12, FX(b.x + b.w), FY(b.y) - 12, "".concat(b.w, " px").concat(mW));
  c.save();
  c.translate(FX(b.x) - 12, FY(b.y + b.h));
  c.rotate(-Math.PI / 2);
  dimLine(c, 0, 0, b.h * FV.s, 0, "".concat(b.h, " px").concat(mH));
  c.restore();
  c.textAlign = "left";
  c.textBaseline = "alphabetic";
}
const angFmt = (v) => String(Math.round(Math.abs(+v) * 100) / 100).replace(".", ",");
const rotLabel = (r) => r === 0 ? "0°" : r <= 180 ? "".concat(angFmt(r), "° ⟳") : "".concat(angFmt(360 - r), "° ⟲");
function dimLine(c, x0, y0, x1, y1, text) {
  c.strokeStyle = "rgba(255,255,255,.75)";
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(x0, y0 + 0.5);
  c.lineTo(x1, y1 + 0.5);
  c.moveTo(x0 + 0.5, y0 - 4);
  c.lineTo(x0 + 0.5, y0 + 4);
  c.moveTo(x1 - 0.5, y1 - 4);
  c.lineTo(x1 - 0.5, y1 + 4);
  c.stroke();
  const tw = c.measureText(text).width + 12, mx = (x0 + x1) / 2;
  c.fillStyle = "#1d1f21";
  c.fillRect(mx - tw / 2, y0 - 9, tw, 18);
  c.fillStyle = "#fff";
  c.fillText(text, mx, y0 + 6);
}
function fieldHit(p) {
  const rs = fieldRects(), wx = (p[0] - FV.ox) / FV.s, wy = (p[1] - FV.oy) / FV.s;
  const order = rs.filter((r) => r.uid === fld.sel).concat(rs.filter((r) => r.uid !== fld.sel).reverse());
  return order.find((r) => {
    const a = -r.rot * Math.PI / 180, dx = wx - (r.x + r.w / 2), dy = wy - (r.y + r.h / 2);
    const lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
    return Math.abs(lx) <= r.w0 / 2 && Math.abs(ly) <= r.h0 / 2;
  }) || null;
}
function titleHit(p) {
  const f = CF(), rs = fieldRects(), b = fieldBBox(rs);
  if (!b || !f.title.on) return false;
  const fr = fieldTitleFrame(f, rs, b);
  return Math.abs(p[0] - fr.cx) <= fr.w / 2 + 8 && Math.abs(p[1] - fr.cy) <= fr.h / 2 + 6;
}
function snapPos(uid, x, y, w, h, T) {
  let bx = null, gx = null, dx = T + 1e-9, by = null, gy = null, dy = T + 1e-9;
  for (const o of fieldRects()) {
    if (o.uid === uid) continue;
    const vNear = y < o.y + o.h + T && y + h > o.y - T, hNear = x < o.x + o.w + T && x + w > o.x - T;
    const mx = o.x + o.w / 2, my = o.y + o.h / 2;
    // края к краям, а также (как в Resolume) середины: середина к середине, край к середине края соседа
    for (const [cx, line, ok] of [[o.x + o.w, o.x + o.w, vNear], [o.x - w, o.x, vNear], [o.x, o.x, true], [o.x + o.w - w, o.x + o.w, true], [Math.round(mx - w / 2), mx, true], [Math.round(mx), mx, hNear || vNear], [Math.round(mx - w), mx, hNear || vNear]])
      if (ok && Math.abs(cx - x) < dx) {
        dx = Math.abs(cx - x);
        bx = cx;
        gx = line;
      }
    for (const [cy, line, ok] of [[o.y + o.h, o.y + o.h, hNear], [o.y - h, o.y, hNear], [o.y, o.y, true], [o.y + o.h - h, o.y + o.h, true], [Math.round(my - h / 2), my, true], [Math.round(my), my, hNear || vNear], [Math.round(my - h), my, hNear || vNear]])
      if (ok && Math.abs(cy - y) < dy) {
        dy = Math.abs(cy - y);
        by = cy;
        gy = line;
      }
  }
  return { x: bx != null ? bx : x, y: by != null ? by : y, gx, gy };
}
function zoomFieldAt(ns, px, py) {
  ns = Math.max((FV.base || FV.s) * 0.05, Math.min((FV.base || FV.s) * 40, ns));
  const wx = (px - FV.ox) / FV.s, wy = (py - FV.oy) / FV.s;
  FV.s = ns;
  FV.ox = px - wx * ns;
  FV.oy = py - wy * ns;
  requestDraw();
}
const selItem = () => CF().items.find((it) => it.uid === fld.sel) || null;
// 2.0.173: зелёная точка поворота выбранной маски — как у кабинетов кольца
function fieldRotHandle(r) {
  const cx = FX(r.x + r.w / 2), cy = FY(r.y + r.h / 2), a = r.rot * Math.PI / 180, hr = r.h0 * FV.s / 2, d = hr + 26;
  return [cx + Math.sin(a) * d, cy - Math.cos(a) * d, cx + Math.sin(a) * hr, cy - Math.cos(a) * hr];
}
function fieldRotHit(p) {
  const sel = fieldRects().find((r) => r.uid === fld.sel);
  if (!sel) return null;
  const [hx, hy] = fieldRotHandle(sel);
  return Math.hypot(p[0] - hx, p[1] - hy) <= 11 ? sel : null;
}
pv.addEventListener("pointerdown", (e) => {
  if (ui.page === "mask") return;
  if (e.button === 2) return;
  e.stopImmediatePropagation();
  if (ui.page === "tz") return tzPointer(e, "down");
  if (ui.page === "out") return outPointer(e, "down");
  if (ui.page === "cut") return cutPointer(e, "down");
  if (ui.page !== "field") return;
  pv.setPointerCapture(e.pointerId);
  const p = local(e);
  fld.pointers.set(e.pointerId, p);
  if (fld.pointers.size === 2) {
    const [a, b] = [...fld.pointers.values()];
    fld.drag = null;
    fld.pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, s: FV.s, mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2, ox: FV.ox, oy: FV.oy };
    return;
  }
  if (fld.pointers.size > 2) return;
  if (titleHit(p)) {
    const t = CF().title;
    fld.drag = { kind: "title", sx: p[0], sy: p[1], x0: t.x, y0: t.y };
    requestDraw();
    return;
  }
  const rh = fieldRotHit(p);
  if (rh) {
    fld.drag = { kind: "rot", uid: rh.uid, cx: rh.x + rh.w / 2, cy: rh.y + rh.h / 2, w0: rh.w0, h0: rh.h0 };
    requestDraw();
    return;
  }
  const hit = fieldHit(p);
  if (hit) {
    fld.sel = hit.uid;
    fld.drag = { kind: "move", uid: hit.uid, sx: p[0], sy: p[1], x0: hit.x, y0: hit.y, w: hit.w, h: hit.h };
    refreshFieldPanel();
  } else fld.drag = { kind: "pan", sx: p[0], sy: p[1], ox: FV.ox, oy: FV.oy, moved: false };
  requestDraw();
}, true);
pv.addEventListener("pointermove", (e) => {
  if (ui.page === "mask") return;
  e.stopImmediatePropagation();
  if (ui.page === "tz") return tzPointer(e, "move");
  if (ui.page === "out") return outPointer(e, "move");
  if (ui.page === "cut") return cutPointer(e, "move");
  if (ui.page !== "field") return;
  const p = local(e);
  if (fld.pointers.has(e.pointerId)) fld.pointers.set(e.pointerId, p);
  if (fld.pinch && fld.pointers.size >= 2) {
    const [a, b] = [...fld.pointers.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const ns = fld.pinch.s * d / fld.pinch.d, wx = (fld.pinch.mx - fld.pinch.ox) / fld.pinch.s, wy = (fld.pinch.my - fld.pinch.oy) / fld.pinch.s;
    FV.s = ns;
    FV.ox = mx - wx * ns;
    FV.oy = my - wy * ns;
    requestDraw();
    return;
  }
  const g = fld.drag;
  if (!g) {
    const th = titleHit(p);
    if (th !== !!fld.titleHover) {
      fld.titleHover = th;
      requestDraw();
    }
    pv.style.cursor = fieldRotHit(p) ? "crosshair" : th || fieldHit(p) ? "move" : "grab";
    return;
  }
  if (g.kind === "rot") {
    // поворот вокруг центра маски; Shift — шагом 15°
    let deg = Math.atan2(p[0] - FX(g.cx), -(p[1] - FY(g.cy))) * 180 / Math.PI;
    if (e.shiftKey) deg = Math.round(deg / 15) * 15;
    const it = CF().items.find((q) => q.uid === g.uid), nr = fieldNormRot(deg);
    if (it && it.rot !== nr) {
      const [w, h] = rotDims(g.w0, g.h0, nr);
      it.rot = nr;
      it.x = Math.round(g.cx - w / 2);
      it.y = Math.round(g.cy - h / 2);
      fieldChanged(false);
    } else requestDraw();
    return;
  }
  if (g.kind === "title") {
    let nx2 = Math.round(g.x0 + (p[0] - g.sx) / FV.s), ny2 = Math.round(g.y0 + (p[1] - g.sy) / FV.s);
    const T = Math.max(1, 12 / FV.s), b = fieldBBox(fieldRects()), t = CF().title;
    fld.gx = fld.gy = null;
    if (ui.magnet && !e.altKey) {
      if (Math.abs(nx2) < T) {
        nx2 = 0;
        fld.gx = b.x + b.w / 2;
      }
      if (Math.abs(ny2) < T) {
        ny2 = 0;
        fld.gy = b.y + b.h / 2;
      }
    }
    if (t.x !== nx2 || t.y !== ny2) {
      t.x = nx2;
      t.y = ny2;
      fieldChanged(false);
    } else requestDraw();
    return;
  }
  if (g.kind === "pan") {
    if (Math.abs(p[0] - g.sx) + Math.abs(p[1] - g.sy) > 3) g.moved = true;
    FV.ox = g.ox + p[0] - g.sx;
    FV.oy = g.oy + p[1] - g.sy;
    requestDraw();
    return;
  }
  let nx = Math.round(g.x0 + (p[0] - g.sx) / FV.s), ny = Math.round(g.y0 + (p[1] - g.sy) / FV.s);
  fld.gx = fld.gy = null;
  if (ui.magnet && !e.altKey) {
    const sn = snapPos(g.uid, nx, ny, g.w, g.h, Math.max(1, 12 / FV.s));
    nx = sn.x;
    ny = sn.y;
    fld.gx = sn.gx;
    fld.gy = sn.gy;
  }
  const it = CF().items.find((q) => q.uid === g.uid);
  if (it && (it.x !== nx || it.y !== ny)) {
    it.x = nx;
    it.y = ny;
    fieldChanged(false);
  } else requestDraw();
}, true);
function fieldUp(e) {
  if (ui.page === "mask") return;
  e.stopImmediatePropagation();
  if (ui.page === "tz") return tzPointer(e, "up");
  if (ui.page === "out") return outPointer(e, "up");
  if (ui.page === "cut") return cutPointer(e, "up");
  fld.pointers.delete(e.pointerId);
  if (fld.pointers.size < 2) fld.pinch = null;
  if (fld.pointers.size === 0) {
    if (fld.drag && fld.drag.kind === "pan" && !fld.drag.moved && fld.sel) {
      fld.sel = null;
      refreshFieldPanel();
    }
    fld.drag = null;
    fld.gx = fld.gy = null;
    requestDraw();
    scheduleHistory();
  }
}
pv.addEventListener("pointerup", fieldUp, true);
pv.addEventListener("pointercancel", fieldUp, true);
pv.addEventListener("pointerleave", (e) => {
  if (ui.page !== "mask") {
    e.stopImmediatePropagation();
    if (fld.titleHover) {
      fld.titleHover = false;
      requestDraw();
    }
  }
}, true);
pv.addEventListener("wheel", (e) => {
  if (ui.page !== "field") return;
  e.stopImmediatePropagation();
  e.preventDefault();
  const p = local(e);
  zoomFieldAt(FV.s * Math.pow(1.0015, -e.deltaY), p[0], p[1]);
}, { passive: false, capture: true });
pv.addEventListener("dblclick", (e) => {
  if (ui.page === "tz") {
    // двойной щелчок по картинке общего плана на превью ТЗ — редактор номеров экранов
    const [x, y] = tzLocal(e), h = (ui.tzImgHits || []).find((q) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
    if (h) openMarkEditor(h.im);
    else {
      // двойной щелчок по листу — крупно / обратно ко всем листам
      const sh = (ui.tzSlideHits || []).find((q) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
      if (ui.tzZoom >= 0) tzZoomTo(-1);
      else if (sh) tzZoomTo(sh.no);
    }
    return;
  }
  if (ui.page !== "field") return;
  const hit = fieldHit(local(e));
  if (!hit) return;
  project.cur = hit.i;
  ui.selected.clear();
  ui.anchor = null;
  ui.textMode = -1;
  setPage("mask");
  syncUI();
  changed({ forcePhys: true });
});
window.addEventListener("keydown", (e) => {
  if (ui.page !== "field" || !$("modal").hidden) return;
  const tag = e.target && e.target.tagName;
  if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
  const it = selItem();
  if (!it) return;
  const d = e.shiftKey ? 10 : 1, mv = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }[e.key];
  if (!mv) return;
  e.preventDefault();
  it.x += mv[0];
  it.y += mv[1];
  fieldChanged(false);
});
const fieldNormRot = (d) => Math.round((((d % 360) + 360) % 360) * 100) / 100 % 360;
function rotateSel(delta, abs) {
  const it = selItem();
  if (!it) {
    status("Сначала выберите экран на поле", true);
    return;
  }
  const r = fieldRects().find((q) => q.uid === it.uid), cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  it.rot = abs != null ? fieldNormRot(abs) : delta == null ? 0 : fieldNormRot(it.rot + delta);
  const [w, h] = rotDims(r.w0, r.h0, it.rot);
  it.x = Math.round(cx - w / 2);
  it.y = Math.round(cy - h / 2);
  fieldChanged(true);
  status("Поворот: ".concat(rotLabel(it.rot)));
}
function placeAtRight(uid) {
  const f = CF(), b = fieldBBox(fieldRects().filter((r) => r.uid !== uid));
  let it = f.items.find((q) => q.uid === uid);
  if (!it) {
    it = { uid, x: 0, y: 0, rot: 0 };
    f.items.push(it);
  }
  if (b) {
    it.x = b.x + b.rawW;
    it.y = b.y;
  } else {
    it.x = 0;
    it.y = 0;
  }
}
function arrange(horizontal) {
  let pos = 0;
  for (const r of fieldRects()) {
    r.it.x = horizontal ? pos : 0;
    r.it.y = horizontal ? 0 : pos;
    pos += horizontal ? r.w : r.h;
  }
  FV.fitted = false;
  fieldChanged(true);
}
function fieldChanged(full) {
  if (full) refreshFieldPanel();
  else updateFieldInfo();
  scheduleFieldStrip();
  requestDraw();
  scheduleAutosave();
}
function refreshFieldPanel() {
  if (ui.page !== "field") return;
  scheduleFieldStrip();
  const has = project.fields.length > 0;
  $("fBody").hidden = !has;
  $("fExp").hidden = !has;
  $("fEmpty").hidden = has;
  {
    const sel = $("fSel"), html = project.fields.map((q, k) => '<option value="'.concat(k, '">').concat(k + 1, ". ").concat(xmlEsc(q.name || "Поле " + (k + 1)), "</option>")).join("");
    if (sel.dataset.h !== html) {
      setHtml(sel, html);
      sel.dataset.h = html;
    }
    setVal(sel, String(project.fieldCur));
  }
  if (!has) return;
  const f = CF();
  if (fld.sel && !f.items.some((it) => it.uid === fld.sel)) fld.sel = null;
  const list = $("fList");
  list.innerHTML = "";
  let fnum = 0;
  project.screens.forEach((st) => {
    if (st.kind === "vol") return; // 2.0.149: волюметрик в общее поле не показываем
    const i = fnum++, [w, h] = dims(st), row = document.createElement("div"), it = f.items.find((q) => q.uid === st.uid);
    row.className = "fitem" + (st.uid === fld.sel ? " sel" : "");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !!it;
    cb.setAttribute("aria-label", "На поле");
    cb.onclick = (ev) => {
      ev.stopPropagation();
      if (cb.checked) {
        placeAtRight(st.uid);
        fld.sel = st.uid;
      } else {
        f.items = f.items.filter((q) => q.uid !== st.uid);
        if (fld.sel === st.uid) fld.sel = null;
      }
      FV.fitted = false;
      fieldChanged(true);
    };
    const nm = document.createElement("span");
    nm.className = "nm";
    nm.textContent = "".concat(i + 1, ". ").concat(st.name || "screen");
    const sz = document.createElement("span");
    sz.className = "sz";
    sz.textContent = "".concat(w, "×").concat(h).concat(it && it.rot ? " · " + rotLabel(it.rot) : "");
    row.append(cb, nm, sz);
    row.onclick = () => {
      if (it) {
        fld.sel = st.uid;
        refreshFieldPanel();
        requestDraw();
      }
    };
    list.appendChild(row);
  });
  $("fMagnet").checked = ui.magnet;
  $("fTitle").checked = f.title.on;
  $("fMeters").checked = !!f.title.meters;
  $("fStack").checked = !!f.stack;
  if (!$("fTitleSize").options.length) fillSelect($("fTitleSize"), INSC);
  $("fTitleSize").value = clampI(f.title.size, INSC.length);
  $("fDelete").disabled = project.fields.length <= 1;
  updateFieldInfo();
}
function updateFieldInfo() {
  if (ui.page !== "field") return;
  const rs = fieldRects(), b = fieldBBox(rs), sel = rs.find((r) => r.uid === fld.sel);
  {
    const f = CF(), inp = $("fFile");
    setTxt($("fFilePre"), fieldFilePre(f) || "—");
    // 2.0.107: в окошке — само имя (своё или авто), его можно править
    if (document.activeElement !== inp) setVal(inp, String(f.file || "").trim() || fieldFileAuto(f));
  }
  {
    // список масок на поле — выбрать, чьё положение править
    const pk = $("fSelPick"), html = '<option value="">'.concat(rs.length ? "— выберите маску (или щёлкните по ней на холсте)" : "На поле нет масок", "</option>") + rs.map((r) => '<option value="'.concat(r.uid, '">').concat(r.i + 1, ". ").concat(xmlEsc(r.st.name || "screen"), " · ").concat(r.w, "×").concat(r.h, "</option>")).join("");
    if (pk.dataset.h !== html) {
      setHtml(pk, html);
      pk.dataset.h = html;
    }
    setVal(pk, sel ? sel.uid : "");
    pk.disabled = !rs.length;
  }
  $("fSelBox").hidden = !sel;
  if (sel) {
    {
      const f = CF(), i = f.items.findIndex((q) => q.uid === sel.uid), n = f.items.length;
      setTxt($("fZVal"), "слой ".concat(n - i, " из ").concat(n, n - i === 1 ? " · сверху" : i === 0 ? " · снизу" : ""));
      $("fZTop").disabled = $("fZUp").disabled = i >= n - 1;
      $("fZBottom").disabled = $("fZDown").disabled = i <= 0;
    }
    setTxt($("fRotVal"), rotLabel(sel.rot));
    if (document.activeElement !== $("fRotIn")) setVal($("fRotIn"), +(sel.rot > 180 ? sel.rot - 360 : sel.rot).toFixed(2));
    if (document.activeElement !== $("fX")) setVal($("fX"), sel.x);
    if (document.activeElement !== $("fY")) setVal($("fY"), sel.y);
    if (document.activeElement !== $("fCX")) setVal($("fCX"), Math.round(sel.x + sel.w / 2));
    if (document.activeElement !== $("fCY")) setVal($("fCY"), Math.round(sel.y + sel.h / 2));
    setTxt($("fSelSize"), "Размер ".concat(sel.w, "×").concat(sel.h, " px · правый нижний угол ").concat(sel.x + sel.w, ", ").concat(sel.y + sel.h));
  }
  const out = [];
  if (!b) out.push("<span>На поле пока нет экранов</span>");
  else {
    out.push('<span class="big">'.concat(xmlEsc(CF().name), ": ").concat(b.w, "×").concat(b.h, " px</span>"));
    if (b.w !== b.rawW || b.h !== b.rawH) out.push("<span>Габарит экранов ".concat(b.rawW, "×").concat(b.rawH, " — поле дополнено до чётного</span>"));
    const ph = fieldPhys(rs, b);
    out.push(ph ? "<span>".concat(ph.known ? "Физический размер" : "Размер (условно 50 см)", ": ").concat(compactM(ph.w), "х").concat(compactM(ph.h), " м</span>") : '<span class="warn">Физический размер не считается: на поле экраны с разным шагом пикселя</span>');
    out.push("<span>Экранов на поле: ".concat(rs.length, " из ").concat(project.screens.length, "</span>"));
    const ov = overlaps(rs);
    if (CF().stack && ov.length) out.push("<span>Маски наложены друг на друга: выключенные кабинеты прозрачные, сверху — маска ниже в списке</span>");
    else for (const o of ov) out.push('<span class="warn">⚠ Экраны '.concat(o.a + 1, " и ").concat(o.b + 1, " пересекаются: ").concat(o.w, "×").concat(o.h, " px</span>"));
    if (rs.every((r) => r.rot % 90 === 0)) {
      const area = rs.reduce((a, r) => a + r.w * r.h, 0) - ov.reduce((a, o) => a + o.w * o.h, 0);
      if (area < b.w * b.h) out.push("<span>Пустые места внутри поля: ".concat(Math.round((1 - area / (b.w * b.h)) * 1e3) / 10, "% — в PNG они чёрные</span>"));
    } else out.push("<span>Есть экраны под наклоном — углы вокруг них в PNG чёрные</span>");
  }
  setHtml($("fInfo"), out.join(""));
}
function setPage(pg) {
  if (project.mode === "vol" && ["cut", "field", "out"].includes(pg)) pg = "mask";
  // 2.0.59: из волюметрика в «Формирование ТЗ» — сразу шаблон «Волюметрик» с нитью этого кабинета
  // 2.0.75: из любого другого раздела (LED, проекция, ТВ, pixel drop, общее поле) — по умолчанию шаблон Resolume
  // 2.0.115: правило 2.0.75 (по умолчанию Resolume) отменено. Тип ТЗ, выбранный в проекте (и сохранённый в файле),
  // остаётся при любом переходе. Шаблон «Волюметрик» сам — только пока тип ТЗ в проекте ещё не выбран.
  if (pg === "tz" && ui.page !== "tz") {
    const st = S(), saved = project.tz.tpl && TPL[project.tz.tpl] ? project.tz.tpl : "";
    if (saved) {
      // волюметрик: тип ТЗ сохранён, длина нити — по модели кабинета
      ui.tzTpl = saved;
      ui.tzSubManual = false;
    } else if (ui.page === "mask" && st && st.kind === "vol" && st.vol) {
      const V = st.vol, a = V.model !== "custom" ? ["Vol2", "Vol4", "Vol3"][V.model] : V.sx === 6 && V.sz === 6 ? "Vol3" : V.len >= 3.5 ? "Vol4" : "Vol2";
      ui.tzSubManual = false;
      ui.tzTpl = a || "Vol2";
      if (project.tz.masks[st.uid] === false) project.tz.masks[st.uid] = true;
    }
  }
  ui.page = pg;
  document.documentElement.dataset.page = pg;
  document.querySelectorAll(".seg.pages button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.page === pg)));
  pv.style.cursor = "";
  if (pg === "field") {
    FV.fitted = false;
    refreshFieldPanel();
  }
  if (pg === "tz") {
    refreshTZPanel();
    syncTzTpl();
    refreshTZText();
  }
  if (pg === "mask") scheduleStrip();
  if (pg === "cut") refreshCutPanel();
  if (pg === "out") refreshOutPanel();
  requestDraw();
}
// ---- 2.0.118: НАРЕЗКА — очень длинную (или высокую) LED-маску режем по кабинетам на части и складываем
// друг под другом (или рядом). Номера кабинетов остаются, на частях — подписи и место разреза.
// project.cuts = [{ id, name, uid, dir: "h" | "v", sizes: [кабинетов в части…], fit, fw, fh, gap, sep, marks,
//   big: { on, mode: "num" | "text", step, text }, info: { on, src, size, color, pos }, file }]
// 2.0.119: текст по умолчанию для меток во всю длину — классическая фраза для проверки шрифтов
const CUT_PANGRAM = "Съешь же ещё этих мягких французских булок, да выпей чаю";
function freshCut(k, uid) {
  return { id: newUid(), name: "Нарезка ".concat(k + 1), uid: uid || "", dir: "h", sizes: [], fit: true, fw: 3840, fh: 2160, gap: 0, sep: true, marks: true, big: { on: false, mode: "num", step: 0, text: CUT_PANGRAM }, info: { on: true, src: false, size: 0, color: "#FFFFFF", pos: "c" }, file: "" };
}
function normCut(c, k) {
  const d = freshCut(k), q = c && typeof c === "object" ? c : {}, b = q.big && typeof q.big === "object" ? q.big : {}, i = q.info && typeof q.info === "object" ? q.info : {};
  const out = {
    id: typeof q.id === "string" && q.id ? q.id : d.id,
    name: typeof q.name === "string" && q.name ? q.name : d.name,
    uid: typeof q.uid === "string" ? q.uid : "",
    dir: q.dir === "v" ? "v" : "h",
    sizes: (Array.isArray(q.sizes) ? q.sizes : []).map((v) => Math.max(1, pint(v, 1))).slice(0, 64),
    fit: q.fit !== false,
    fw: Math.max(1, Math.min(32e3, pint(q.fw, d.fw))),
    fh: Math.max(1, Math.min(32e3, pint(q.fh, d.fh))),
    gap: Math.max(0, Math.min(2e3, pint(q.gap, 0))),
    sep: q.sep !== false,
    marks: q.marks !== false,
    big: { on: !!b.on, mode: b.mode === "text" ? "text" : "num", step: Math.max(0, pint(b.step, 0)), text: typeof b.text === "string" ? b.text.slice(0, 200) : d.big.text },
    info: { on: i.on !== false, src: !!i.src, size: Math.max(0, pint(i.size, 0)), color: typeof i.color === "string" && /^#[0-9a-f]{6}$/i.test(i.color) ? i.color.toUpperCase() : "#FFFFFF", pos: ["tl", "t", "tr", "l", "c", "r", "bl", "b", "br"].includes(i.pos) ? i.pos : "c" },
    file: typeof q.file === "string" ? q.file.slice(0, 120) : ""
  };
  return keepRest(out, q);
}
const CC = () => project.cuts[Math.max(0, Math.min(project.cuts.length - 1, project.cutCur || 0))];
const cutSrc = (c) => c && project.screens.find((s) => s.uid === c.uid && s.kind === "led") || null;
const inAnyCut = (uid) => (project.cuts || []).some((c) => c.uid === uid);
// кабинетов в частях: первые части одинаковые и не меньше последней (151 на 3 → 51 + 51 + 49)
function cutAutoSizes(n, L) {
  n = Math.max(1, Math.min(L, n | 0));
  const p = Math.ceil(L / n), last = L - p * (n - 1);
  if (last >= 1) return [...Array(n - 1).fill(p), last];
  const b = Math.floor(L / n), r = L - b * n;
  return Array.from({ length: n }, (_, i) => b + (i < r ? 1 : 0));
}
function cutSizes(c, L) {
  const s = c.sizes;
  if (s.length >= 1 && s.every((v) => v >= 1) && s.reduce((a, v) => a + v, 0) === L) return s.slice();
  return cutAutoSizes(s.length || 2, L);
}
// сколько частей по умолчанию: результат ближе всего к 16:9
function cutBestParts(st, dir) {
  const [W0, H0] = dims(st), L = dir === "v" ? st.cabRows : st.cabCols;
  let best = 2, bd = Infinity;
  for (let n = 2; n <= Math.min(12, L); n++) {
    const len = (dir === "v" ? H0 : W0) / n, thick = (dir === "v" ? W0 : H0) * n, ar = dir === "v" ? thick / len : len / thick, d = Math.abs(Math.log(ar / (16 / 9)));
    if (d < bd) {
      bd = d;
      best = n;
    }
  }
  return best;
}
function cutGeom(c) {
  const st = cutSrc(c);
  if (!st) return null;
  const { xs, ys } = grid(st), [W0, H0] = dims(st), h = c.dir !== "v", L = h ? st.cabCols : st.cabRows, E = h ? xs : ys;
  const sizes = cutSizes(c, L), thick = h ? H0 : W0, gap = c.gap | 0, parts = [];
  let a = 0;
  sizes.forEach((n, i) => {
    const b = a + n, s0 = E[a], len = E[b] - E[a];
    parts.push({ i, a, b, s0, len, dx: h ? 0 : i * (thick + gap), dy: h ? i * (thick + gap) : 0, w: h ? len : thick, h: h ? thick : len, sx: h ? s0 : 0, sy: h ? 0 : s0 });
    a = b;
  });
  const maxLen = Math.max(...parts.map((p) => p.len)), n = parts.length;
  const needW = h ? maxLen : n * thick + gap * (n - 1), needH = h ? n * thick + gap * (n - 1) : maxLen;
  const W = evenPx(c.fit ? needW : c.fw), H = evenPx(c.fit ? needH : c.fh);
  return { st, W0, H0, L, sizes, parts, h, thick, W, H, needW, needH, fits: W >= needW && H >= needH };
}
const cutRange = (G, p) => G.h ? "столбцы ".concat(p.a + 1, "–").concat(p.b, " слева") : "ряды ".concat(p.a + 1, "–").concat(p.b, " сверху");
const cutPartText = (G, p) => "Часть ".concat(p.i + 1, " из ").concat(G.parts.length, " · ").concat(cutRange(G, p));
function cutFileAuto(c) {
  const G = cutGeom(c);
  return G ? "".concat(G.st.name || "screen", " нарезка ").concat(G.parts.length) : "нарезка";
}
function cutFileBase(c) {
  const G = cutGeom(c), tail = String(c.file || "").trim() || cutFileAuto(c);
  return safeName((G ? "".concat(G.W, "x").concat(G.H, "-") : "") + tail, "нарезка").slice(0, 180);
}
function cutInfo(c) {
  const G = cutGeom(c);
  if (!G) return null;
  return { w: G.W, h: G.H, label: "".concat(G.W, "×").concat(G.H, "  |  ").concat(G.st.name || "screen", " — нарезка на ").concat(G.parts.length, " ").concat(G.parts.length < 5 ? "части" : "частей") };
}
// крупные метки во всю длину исходного экрана (рисуются до нарезки — режутся вместе с маской)
// ширина ячейки цифры = самая широкая цифра текущего шрифта (ctx.font уже задан)
function digitCell(ctx) {
  let w = 0;
  for (const d of "0123456789") w = Math.max(w, ctx.measureText(d).width);
  return w * 1.04;
}
function paintCutBig(ctx, c, G, s) {
  const B = c.big, len = G.h ? G.W0 : G.H0, th = G.thick;
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.42)";
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const put = (txt, pos, fs, tabular) => {
    ctx.font = "bold ".concat(Math.max(1, fs * s), "px ").concat(FONT);
    ctx.lineWidth = Math.max(1, fs * s * 0.04);
    const x = G.h ? pos * s : th / 2 * s, y = G.h ? th / 2 * s : pos * s;
    ctx.save();
    ctx.translate(x, y);
    if (!G.h) ctx.rotate(-Math.PI / 2);
    if (tabular) {
      // 2.0.174: все цифры одной ширины и высоты — каждая в ячейке одинаковой ширины
      const cw = digitCell(ctx), chars = [...txt];
      chars.forEach((ch, j) => {
        const dx = (j - (chars.length - 1) / 2) * cw;
        ctx.strokeText(ch, dx, 0);
        ctx.fillText(ch, dx, 0);
      });
    } else {
      ctx.strokeText(txt, 0, 0);
      ctx.fillText(txt, 0, 0);
    }
    ctx.restore();
  };
  if (B.mode === "text" && B.text.trim()) {
    // свой текст растянут на всю длину: буквы расставлены равномерно
    const chars = [...B.text.trim()], fs = Math.min(th * 0.62, len / Math.max(1, chars.length) * 0.95);
    chars.forEach((ch, i) => ch.trim() && put(ch, (i + 0.5) * len / chars.length, fs));
  } else {
    const st = G.st, L = G.L, step = B.step > 0 ? B.step : Math.max(1, G.h ? st.cabRows : st.cabCols), { xs, ys } = grid(st), E = G.h ? xs : ys;
    // 2.0.174: один размер для всех меток — по самому длинному (полному) отрезку, а не по каждому; последний неполный отрезок не уменьшает цифру
    const segs = [];
    for (let k = 0; k < L; k += step) segs.push([E[k], E[Math.min(L, k + step)]]);
    const full = Math.max(...segs.map((q) => q[1] - q[0])), nd = String(segs.length).length;
    // цифры в ячейке шириной ≈0.62 кегля: самое длинное число должно помещаться в отрезок
    const fs = Math.min(th * 0.62, full * 0.8, full * 0.92 / (nd * 0.64));
    segs.forEach((q, i) => put(String(i + 1), (q[0] + q[1]) / 2, fs, true));
  }
  ctx.restore();
}
function pill(ctx, txt, x, y, fs, align, bg, fg, maxW) {
  ctx.font = "600 ".concat(fs, "px ").concat(FONT);
  // не шире части: если не помещается — шрифт меньше
  if (maxW > 0) {
    const w0 = ctx.measureText(txt).width + fs * 0.9;
    if (w0 > maxW) {
      fs = Math.max(4, fs * maxW / w0);
      ctx.font = "600 ".concat(fs, "px ").concat(FONT);
    }
  }
  const w = ctx.measureText(txt).width + fs * 0.9, h = fs * 1.5, x0 = align === "right" ? x - w : x;
  ctx.fillStyle = bg;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x0, y, w, h, fs * 0.35);
  else ctx.rect(x0, y, w, h);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(txt, x0 + fs * 0.45, y + h / 2);
  return h;
}
function paintCut(ctx, c, s) {
  const G = cutGeom(c);
  if (!G) return;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, Math.round(G.W * s), Math.round(G.H * s));
  const st2 = { ...G.st, line1Enabled: false, line2Enabled: false, line3Enabled: false };
  for (const p of G.parts) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(p.dx * s, p.dy * s, p.w * s, p.h * s);
    ctx.clip();
    ctx.translate((p.dx - p.sx) * s, (p.dy - p.sy) * s);
    drawMask(ctx, st2, s, guidesOf(st2));
    if (c.big.on) paintCutBig(ctx, c, G, s);
    ctx.restore();
  }
  const fs = Math.max(10, Math.min(140, G.thick * 0.075)) * s, n = G.parts.length;
  // пустое место у коротких частей — «не заполнять»
  for (const p of G.parts) {
    const rest = G.h ? G.W - p.dx - p.w : G.H - p.dy - p.h;
    if (rest < G.thick * 0.25) continue;
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.font = "".concat(fs, "px ").concat(FONT);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const cx = G.h ? (p.w + rest / 2) * s : (p.dx + p.w / 2) * s, cy = G.h ? (p.dy + p.h / 2) * s : (p.dy + p.h + rest / 2) * s;
    ctx.translate(cx, cy);
    if (!G.h && rest > p.w) ctx.rotate(-Math.PI / 2);
    ctx.fillText("пусто — не заполнять", 0, 0);
    ctx.restore();
  }
  if (c.sep && n > 1) {
    ctx.save();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = Math.max(1, 3 * s);
    for (const p of G.parts.slice(1)) {
      ctx.beginPath();
      if (G.h) {
        const y = (p.dy - G.gap / 2) * s;
        ctx.moveTo(0, y);
        ctx.lineTo(G.W * s, y);
      } else {
        const x = (p.dx - G.gap / 2) * s;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, G.H * s);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  if (c.marks) {
    ctx.save();
    for (const p of G.parts) {
      const pad = fs * 0.5, x = p.dx * s + pad, y = p.dy * s + pad, mw = p.w * s - pad * 2;
      let hh = pill(ctx, cutPartText(G, p), x, y, fs, "left", "rgba(0,0,0,0.72)", "#fff", G.h ? mw * 0.62 : mw);
      if (p.i > 0) pill(ctx, "↳ продолжение части ".concat(p.i), x, y + hh + fs * 0.3, fs * 0.85, "left", "rgba(0,0,0,0.62)", "#FFD54A", mw);
      if (p.i < n - 1) {
        // разрез: красный пунктир по краю части и подпись, куда идёт продолжение
        const ex = (p.dx + p.w) * s, ey = (p.dy + p.h) * s;
        ctx.save();
        ctx.strokeStyle = "#FF3B30";
        ctx.lineWidth = Math.max(2, fs * 0.16);
        ctx.setLineDash([fs * 0.5, fs * 0.35]);
        ctx.beginPath();
        if (G.h) {
          ctx.moveTo(ex - ctx.lineWidth / 2, p.dy * s);
          ctx.lineTo(ex - ctx.lineWidth / 2, ey);
        } else {
          ctx.moveTo(p.dx * s, ey - ctx.lineWidth / 2);
          ctx.lineTo(ex, ey - ctx.lineWidth / 2);
        }
        ctx.stroke();
        ctx.restore();
        const t = "✂ разрез — дальше часть ".concat(p.i + 2).concat(G.h ? " ↓" : " →");
        if (G.h) pill(ctx, t, ex - pad - ctx.lineWidth, y, fs, "right", "rgba(150,0,0,0.85)", "#fff", mw * 0.36);
        else pill(ctx, t, x, ey - pad - fs * 1.5 - ctx.lineWidth, fs, "left", "rgba(150,0,0,0.85)", "#fff", mw);
      }
      // стрелка направления в начале части
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "bold ".concat(fs * 1.6, "px ").concat(FONT);
      ctx.textBaseline = "bottom";
      ctx.textAlign = "left";
      if (G.h) ctx.fillText("→", x, (p.dy + p.h) * s - pad);
      else {
        ctx.translate(p.dx * s + p.w * s - pad, y + hh * 2.4);
        ctx.textAlign = "right";
        ctx.textBaseline = "top";
        ctx.fillText("↓", 0, 0);
      }
      ctx.restore();
    }
    ctx.restore();
  }
  if (c.info.on) {
    // в начале первой части: новое разрешение и прежнее название
    const p = G.parts[0], I = c.info, lines0 = ["".concat(G.W, "×").concat(G.H), G.st.name || "screen"];
    if (I.src) lines0.push("исходник ".concat(G.W0, "×").concat(G.H0));
    let big = I.size > 0 ? I.size : Math.max(12, Math.min(p.w, p.h) * 0.28), lines = lines0.map((t, k) => [t, (k ? big * 0.5 : big) * s]);
    let b = blockSize(lines, TITLE_GAP * s);
    const m = Math.min(p.w, p.h) * 0.06 * s, fitK = Math.min(1, (p.w * s - 2 * m) / b.w, (p.h * s - 2 * m) / b.h);
    if (fitK < 1) {
      // текст не шире и не выше первой части
      big *= fitK;
      lines = lines0.map((t, k) => [t, (k ? big * 0.5 : big) * s]);
      b = blockSize(lines, TITLE_GAP * s);
    }
    const pw = p.w * s, ph = p.h * s, pos = I.pos;
    const cx = p.dx * s + (pos.includes("l") ? m + b.w / 2 : pos.includes("r") ? pw - m - b.w / 2 : pw / 2);
    const cy = p.dy * s + (pos.includes("t") ? m + b.h / 2 : pos.includes("b") ? ph - m - b.h / 2 : ph / 2);
    ctx.save();
    ctx.beginPath();
    ctx.rect(p.dx * s, p.dy * s, pw, ph);
    ctx.clip();
    ctx.fillStyle = I.color;
    ctx.textBaseline = "alphabetic";
    drawBlock(ctx, lines, TITLE_GAP * s, cx, cy, 0);
    ctx.restore();
  }
}
// 2.0.174: исходная маска с той же разметкой (крупные метки) и красными линиями разреза — пример для ТЗ и второе окно в «Нарезке»
function paintCutSrc(ctx, c, s) {
  const G = cutGeom(c);
  if (!G) return;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, Math.round(G.W0 * s), Math.round(G.H0 * s));
  const st2 = { ...G.st, line1Enabled: false, line2Enabled: false, line3Enabled: false };
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, G.W0 * s, G.H0 * s);
  ctx.clip();
  drawMask(ctx, st2, s, guidesOf(st2));
  if (c.big.on) paintCutBig(ctx, c, G, s);
  ctx.restore();
  const fs = Math.max(10, Math.min(140, G.thick * 0.075)) * s, pad = fs * 0.5, lw = Math.max(2, fs * 0.16);
  ctx.save();
  for (const p of G.parts) {
    const pos = (G.h ? p.sx : p.sy) * s;
    if (p.i > 0) {
      // линия разреза через всю маску
      ctx.strokeStyle = "#FF3B30";
      ctx.lineWidth = lw;
      ctx.setLineDash([fs * 0.5, fs * 0.35]);
      ctx.beginPath();
      if (G.h) {
        ctx.moveTo(pos, 0);
        ctx.lineTo(pos, G.H0 * s);
      } else {
        ctx.moveTo(0, pos);
        ctx.lineTo(G.W0 * s, pos);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // подпись части — в её начале
    const x = G.h ? pos + pad + (p.i > 0 ? lw : 0) : pad, y = G.h ? pad : pos + pad + (p.i > 0 ? lw : 0);
    pill(ctx, "Часть ".concat(p.i + 1, " из ").concat(G.parts.length), x, y, fs, "left", "rgba(0,0,0,0.72)", "#fff", (G.h ? p.len : G.W0) * s - pad * 2);
    if (p.i < G.parts.length - 1) {
      const t = "✂ разрез → часть ".concat(p.i + 2), ex = G.h ? (p.sx + p.len) * s - lw - pad : G.W0 * s - pad, ey = G.h ? G.H0 * s - pad - fs * 1.5 : (p.sy + p.len) * s - lw - pad - fs * 1.5;
      pill(ctx, t, ex, ey, fs, "right", "rgba(150,0,0,0.85)", "#fff", (G.h ? p.len : G.W0) * s * 0.6);
    }
  }
  ctx.restore();
}
const cutSrcThumbs = /* @__PURE__ */ new Map();
function cutSrcThumb(c) {
  const G = cutGeom(c);
  if (!G) return null;
  const k = JSON.stringify(c) + JSON.stringify(G.st), o = cutSrcThumbs.get(c.id);
  if (o && o.k === k) return o.cv;
  const s = Math.min(1, 1600 / Math.max(G.W0, G.H0)), cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(G.W0 * s));
  cv.height = Math.max(1, Math.round(G.H0 * s));
  paintCutSrc(cv.getContext("2d"), c, s);
  cutSrcThumbs.set(c.id, { k, cv });
  return cv;
}
async function renderCutPNG(c, onBand) {
  const G = cutGeom(c);
  return renderBands(G.W, G.H, (ctx) => paintCut(ctx, c, 1), onBand);
}
const cutThumbs = /* @__PURE__ */ new Map();
function cutThumb(c) {
  const G = cutGeom(c);
  if (!G) return null;
  const k = JSON.stringify(c) + JSON.stringify(G.st) + JSON.stringify(project.guides), o = cutThumbs.get(c.id);
  if (o && o.k === k) return o.cv;
  const s = Math.min(1, 1600 / Math.max(G.W, G.H)), cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(G.W * s));
  cv.height = Math.max(1, Math.round(G.H * s));
  paintCut(cv.getContext("2d"), c, s);
  cutThumbs.set(c.id, { k, cv });
  return cv;
}
// пояснение для контентщиков — текстовый блок ТЗ под маской (по умолчанию; его можно изменить в ТЗ)
function cutNoteDefault(key2) {
  const c = (project.cuts || []).find((q) => "c:" + q.id === String(key2)), G = c && cutGeom(c);
  if (!G) return "";
  const st = G.st, [pw, ph, known] = physM(st), [mw, mh] = typeMM(st), n = G.parts.length;
  const sz = known ? "".concat(compactM(pw), "×").concat(compactM(ph), " м, ") : "";
  const parts = G.parts.map((p) => "часть ".concat(p.i + 1, " — ").concat(cutRange(G, p))).join("; ");
  const how = G.h ? "по горизонтали и уложен частями друг под другом" : "по вертикали и уложен частями рядом слева направо";
  return "**Внимание! Маска нарезана.**\n" + "Экран ".concat(st.name || "", ": ").concat(sz).concat(st.cabCols, "×").concat(st.cabRows, " кабинетов по ").concat(compactM(mw / 10), "×").concat(compactM(mh / 10), " см — целиком ").concat(G.W0, "×").concat(G.H0, " px. ") + "Он слишком ".concat(G.h ? "длинный" : "высокий", ", поэтому в маске для изготовления контента разрезан на ").concat(n, " ").concat(n < 5 ? "части" : "частей", " ").concat(how, ", как на маске (").concat(parts, "). ") + "Делайте контент для всего экрана как одну картинку ".concat(G.W0, "×").concat(G.H0, " px, затем разрежьте его по красным линиям разреза и сложите так же, как на маске — получится файл ").concat(G.W, "×").concat(G.H, " px. ") + (G.parts.some((p) => (G.h ? p.w : p.h) < (G.h ? G.W : G.H)) ? "Чёрное место «пусто — не заполнять» оставьте чёрным." : "");
}
function cutChanged(panel) {
  scheduleCutStrip();
  scheduleAutosave();
  scheduleHistory();
  if (panel) refreshCutPanel();
  else updateCutInfo();
  requestDraw();
}
const escHtml = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
function updateCutInfo() {
  const c = CC(), G = c && cutGeom(c), out = [];
  if (!G) {
    setHtml($("cInfo"), "<span>Выберите LED-маску, которую нужно нарезать.</span>");
    return;
  }
  const [pw, ph, known] = physM(G.st);
  out.push("<span>Исходник: <b>".concat(escHtml(G.st.name || "screen"), "</b> · ").concat(G.W0, "×").concat(G.H0, " px · ").concat(G.st.cabCols, "×").concat(G.st.cabRows, " кабинетов").concat(known ? " · ".concat(compactM(pw), "×").concat(compactM(ph), " м") : "", "</span>"));
  out.push("<span>Части: ".concat(G.sizes.join(" + "), " = ").concat(G.L, " кабинетов ").concat(G.h ? "по длине" : "по высоте", "</span>"));
  out.push("<span>Новая маска: <b>".concat(G.W, "×").concat(G.H, "</b> px").concat(c.fit ? "" : " (нужно не меньше ".concat(G.needW, "×").concat(G.needH, ")"), "</span>"));
  if (!G.fits) out.push('<span class="warn">Поле меньше нарезки — части не помещаются. Увеличьте поле или включите «по краю кабинетов».</span>');
  setHtml($("cInfo"), out.join(""));
  setTxt($("cFilePre"), "".concat(G.W, "x").concat(G.H, "-"));
  if (document.activeElement !== $("cFile")) setVal($("cFile"), String(c.file || "").trim() || cutFileAuto(c));
}
function refreshCutPanel() {
  if (ui.page !== "cut") return;
  scheduleCutStrip();
  const has = project.cuts.length > 0;
  $("cBody").hidden = !has;
  $("cExp").hidden = !has;
  $("cEmpty").hidden = has;
  fillSelect($("cSel"), project.cuts.map((c, i) => "".concat(i + 1, ". ").concat(c.name)));
  if (!has) return;
  $("cSel").value = project.cutCur;
  const c = CC(), leds = project.screens.filter((s) => s.kind === "led");
  $("cSrc").replaceChildren(...leds.map((s) => {
    const o = document.createElement("option"), [w, h] = dims(s);
    o.value = s.uid;
    o.textContent = "".concat(project.screens.indexOf(s) + 1, ". ").concat(s.name || "screen", " — ").concat(w, "×").concat(h, " (").concat(s.cabCols, "×").concat(s.cabRows, ")");
    return o;
  }));
  if (!leds.some((s) => s.uid === c.uid)) c.uid = leds[0] ? leds[0].uid : "";
  $("cSrc").value = c.uid;
  document.querySelectorAll("#cDir button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.dir === c.dir)));
  const G = cutGeom(c);
  $("cParts").value = G ? G.parts.length : 2;
  const box = $("cSizes");
  box.replaceChildren();
  if (G) G.sizes.forEach((v, i) => {
    const w = document.createElement("label"), inp = document.createElement("input");
    w.className = "csz";
    w.textContent = "".concat(i + 1, ":");
    inp.type = "number";
    inp.min = 1;
    inp.value = v;
    inp.id = "cSz" + i;
    inp.className = "num";
    inp.setAttribute("aria-label", "Кабинетов в части ".concat(i + 1));
    inp.onchange = () => setCutSize(i, pint(inp.value, v));
    w.appendChild(inp);
    box.appendChild(w);
    // 2.0.121: наши стрелки ▲▼ (как у остальных чисел)
    stepper(inp.id, (d) => {
      const G2 = cutGeom(CC());
      if (G2 && G2.sizes[i] != null) setCutSize(i, G2.sizes[i] + d);
    });
  });
  $("cFit").checked = c.fit;
  $("cFW").value = c.fit && G ? G.needW : c.fw;
  $("cFH").value = c.fit && G ? G.needH : c.fh;
  $("cFW").disabled = $("cFH").disabled = c.fit;
  $("cGap").value = c.gap;
  $("cSep").checked = c.sep;
  $("cMarks").checked = c.marks;
  $("cBigOn").checked = c.big.on;
  $("cBigMode").value = c.big.mode;
  $("cBigStep").value = c.big.step || "";
  $("cBigStep").placeholder = G ? String(G.h ? G.st.cabRows : G.st.cabCols) : "";
  $("cBigText").value = c.big.text;
  $("cBigStepRow").hidden = c.big.mode !== "num";
  $("cBigTextRow").hidden = c.big.mode !== "text";
  $("cInfoOn").checked = c.info.on;
  $("cInfoSrc").checked = c.info.src;
  $("cInfoSize").value = c.info.size > 0 ? String(c.info.size) : "";
  $("cInfoColor").value = c.info.color;
  updateCutInfo();
}
function setCutSize(i, v) {
  const c = CC(), G = cutGeom(c);
  if (!G) return;
  const s = G.sizes.slice(), n = s.length;
  if (n < 2) return refreshCutPanel();
  const j = i === n - 1 ? n - 2 : n - 1, room = s[i] + s[j] - 1;
  s[i] = Math.max(1, Math.min(room, v));
  s[j] = room + 1 - s[i];
  c.sizes = s;
  // поля обновляем на месте, панель не перерисовываем (иначе стрелки ▲▼ сбиваются)
  cutChanged(false);
  s.forEach((v2, k) => {
    const el = $("cSz" + k);
    if (el && document.activeElement !== el) el.value = v2;
  });
}
function addCut() {
  const cur = S(), st = cur && cur.kind === "led" ? cur : project.screens.find((s) => s.kind === "led");
  if (!st) return status("Нарезка — только для LED-масок. Сначала сделайте LED-маску", true);
  const c = freshCut(project.cuts.length, st.uid);
  c.dir = st.cabRows > st.cabCols ? "v" : "h";
  c.sizes = cutAutoSizes(cutBestParts(st, c.dir), c.dir === "v" ? st.cabRows : st.cabCols);
  project.cuts.push(c);
  project.cutCur = project.cuts.length - 1;
  cutChanged(true);
}
$("cAdd").onclick = addCut;
$("cAdd2").onclick = addCut;
$("cDel").onclick = async () => {
  if (!project.cuts.length) return;
  const c = CC();
  if (!await ask("Удалить нарезку?", "«".concat(c.name, "» будет удалена. Маска останется в проекте."), "", "Удалить", false)) return;
  project.cuts.splice(project.cutCur, 1);
  project.cutCur = Math.max(0, Math.min(project.cutCur, project.cuts.length - 1));
  cutChanged(true);
};
$("cSel").onchange = (e) => {
  project.cutCur = +e.target.value;
  refreshCutPanel();
  requestDraw();
};
$("cRename").onclick = async () => {
  const c = CC();
  if (!c) return;
  const v = await ask("Название нарезки", "", c.name, "OK");
  if (v != null && v.trim()) {
    c.name = v.trim().slice(0, 60);
    cutChanged(true);
  }
};
$("cSrc").onchange = (e) => {
  const c = CC(), st = project.screens.find((s) => s.uid === e.target.value);
  c.uid = e.target.value;
  if (st) c.sizes = cutAutoSizes(cutBestParts(st, c.dir), c.dir === "v" ? st.cabRows : st.cabCols);
  cutChanged(true);
};
document.querySelectorAll("#cDir button").forEach((b) => b.onclick = () => {
  const c = CC(), st = cutSrc(c);
  if (c.dir === b.dataset.dir) return;
  c.dir = b.dataset.dir;
  if (st) c.sizes = cutAutoSizes(cutBestParts(st, c.dir), c.dir === "v" ? st.cabRows : st.cabCols);
  cutChanged(true);
});
const setCutParts = (n) => {
  const c = CC(), G = cutGeom(c);
  if (!G) return;
  n = Math.max(1, Math.min(Math.min(64, G.L), n | 0));
  c.sizes = cutAutoSizes(n, G.L);
  cutChanged(true);
};
$("cParts").onchange = (e) => setCutParts(pint(e.target.value, 2));
stepper("cParts", (d) => {
  const G = cutGeom(CC());
  if (G) setCutParts(G.parts.length + d);
});
$("cEven").onclick = () => {
  const G = cutGeom(CC());
  if (G) setCutParts(G.parts.length);
};
$("cFit").onchange = (e) => {
  const c = CC(), G = cutGeom(c);
  c.fit = e.target.checked;
  if (!c.fit && G) {
    c.fw = Math.max(c.fw, G.needW);
    c.fh = Math.max(c.fh, G.needH);
  }
  cutChanged(true);
};
for (const [id, k] of [["cFW", "fw"], ["cFH", "fh"], ["cGap", "gap"]]) $(id).onchange = (e) => {
  CC()[k] = Math.max(k === "gap" ? 0 : 1, Math.min(32e3, pint(e.target.value, CC()[k])));
  cutChanged(true);
};
for (const [id, set] of [["cSep", (c, v) => c.sep = v], ["cMarks", (c, v) => c.marks = v], ["cBigOn", (c, v) => c.big.on = v], ["cInfoOn", (c, v) => c.info.on = v], ["cInfoSrc", (c, v) => c.info.src = v]]) $(id).onchange = (e) => {
  set(CC(), e.target.checked);
  cutChanged(false);
};
$("cBigMode").onchange = (e) => {
  CC().big.mode = e.target.value;
  if (e.target.value === "text" && !CC().big.text.trim()) CC().big.text = CUT_PANGRAM;
  CC().big.on = true;
  cutChanged(true);
};
$("cBigStep").onchange = (e) => {
  CC().big.step = Math.max(0, pint(e.target.value, 0));
  cutChanged(true);
};
$("cBigText").oninput = (e) => {
  CC().big.text = e.target.value.slice(0, 200);
  cutChanged(false);
};
$("cInfoSize").onchange = (e) => {
  CC().info.size = Math.max(0, pint(e.target.value, 0));
  cutChanged(false);
};
stepper("cInfoSize", (d) => {
  const c = CC(), G = cutGeom(c);
  if (!G) return;
  const p = G.parts[0], cur = c.info.size > 0 ? c.info.size : Math.round(Math.max(12, Math.min(p.w, p.h) * 0.28));
  c.info.size = Math.max(6, Math.round(cur * (d > 0 ? 1.1 : 1 / 1.1)));
  $("cInfoSize").value = c.info.size;
  cutChanged(false);
});
$("cInfoAuto").onclick = () => {
  CC().info.size = 0;
  $("cInfoSize").value = "";
  cutChanged(false);
};
$("cInfoColor").oninput = (e) => {
  CC().info.color = e.target.value.toUpperCase();
  cutChanged(false);
};
document.querySelectorAll("#cInfoPos button").forEach((b) => b.onclick = () => {
  CC().info.pos = b.dataset.pos;
  CC().info.on = true;
  $("cInfoOn").checked = true;
  cutChanged(false);
});
$("cFile").addEventListener("input", (e) => {
  const c = CC(), v = e.target.value.trim();
  c.file = v === cutFileAuto(c) ? "" : v;
  scheduleAutosave();
});
$("cFile").addEventListener("change", (e) => {
  const c = CC(), v = e.target.value.trim();
  c.file = v === cutFileAuto(c) ? "" : v;
  e.target.value = c.file || cutFileAuto(c);
  scheduleAutosave();
});
$("cPNG").onclick = async () => {
  const c = CC(), G = c && cutGeom(c);
  if (!G) return status("Выберите LED-маску для нарезки", true);
  busy("Рендер нарезки ".concat(G.W, "×").concat(G.H, "…"));
  await tick();
  try {
    const r = await renderCutPNG(c, async (p) => {
      busy("Рендер нарезки ".concat(G.W, "×").concat(G.H, "… ").concat(Math.round(p * 100), "%"));
      await tick();
    });
    busy("");
    await save("".concat(cutFileBase(c), ".png"), new Blob([r.png], { type: "image/png" }));
  } catch (e) {
    busy("");
    status("Ошибка рендера: " + e.message, true);
  }
};
// ===== 2.0.181: единая панель масштаба «− 100% + Авто» во всех разделах =====
ui.cutV = { z: 1, x: 0, y: 0 };
function cutViewClamp(R) {
  const V = ui.cutV;
  R = R || $("wrap").getBoundingClientRect();
  if (V.z <= 1) return Object.assign(V, { z: 1, x: 0, y: 0 });
  V.x = Math.min(0, Math.max(R.width - R.width * V.z, V.x));
  V.y = Math.min(0, Math.max(R.height - R.height * V.z, V.y));
}
// масштаб вида {z, x, y} к точке (px, py) экрана
function viewZoomAt(V, z, px, py) {
  const ux = (px - V.x) / V.z, uy = (py - V.y) / V.z;
  V.z = z;
  V.x = px - ux * z;
  V.y = py - uy * z;
}
let cutDrag = null;
function cutPointer(e, type) {
  const p = local(e);
  if (type === "down") {
    if (ui.cutV.z <= 1) return;
    pv.setPointerCapture(e.pointerId);
    cutDrag = { px: p[0], py: p[1], x0: ui.cutV.x, y0: ui.cutV.y };
    pv.style.cursor = "grabbing";
  } else if (type === "move") {
    if (!cutDrag) {
      pv.style.cursor = ui.cutV.z > 1 ? "grab" : "default";
      return;
    }
    ui.cutV.x = cutDrag.x0 + p[0] - cutDrag.px;
    ui.cutV.y = cutDrag.y0 + p[1] - cutDrag.py;
    requestDraw();
  } else {
    cutDrag = null;
    pv.style.cursor = ui.cutV.z > 1 ? "grab" : "default";
  }
}
pv.addEventListener("wheel", (e) => {
  if (ui.page !== "cut") return;
  e.preventDefault();
  const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
  if (!dy) return;
  const V = ui.cutV, p = local(e);
  viewZoomAt(V, Math.max(1, Math.min(8, V.z * Math.max(0.5, Math.min(2, Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0018)))))), p[0], p[1]);
  cutViewClamp();
  requestDraw();
}, { passive: false });
// какой масштаб у текущего раздела: проценты, «шаг» (к центру окна) и «Авто»
function zoomTarget() {
  const R = $("wrap").getBoundingClientRect(), cx = R.width / 2, cy = R.height / 2;
  if (ui.page === "field") return {
    pct: () => FV.s / (FV.base || FV.s || 1),
    step: (f) => zoomFieldAt(FV.s * f, cx, cy),
    auto: () => fitField()
  };
  if (ui.page === "cut") return {
    pct: () => ui.cutV.z,
    step: (f) => {
      viewZoomAt(ui.cutV, Math.max(1, Math.min(8, ui.cutV.z * f)), cx, cy);
      cutViewClamp(R);
    },
    auto: () => Object.assign(ui.cutV, { z: 1, x: 0, y: 0 })
  };
  if (ui.page === "out") return {
    pct: () => ui_out.V.z,
    step: (f) => {
      // вид мэппинга смещается от центра окна — при масштабе к центру смещение растёт так же
      const V = ui_out.V, z = Math.max(1, Math.min(40, V.z * f)), k = z / V.z;
      V.z = z;
      V.x = z === 1 ? 0 : V.x * k;
      V.y = z === 1 ? 0 : V.y * k;
    },
    auto: () => Object.assign(ui_out.V, { z: 1, x: 0, y: 0 })
  };
  if (ui.page === "tz") return {
    pct: () => ui.tzView.z,
    step: (f) => {
      viewZoomAt(ui.tzView, Math.max(1, Math.min(8, ui.tzView.z * f)), cx, cy);
      tzViewClamp();
    },
    auto: () => {
      ui.tzView = { z: 1, x: 0, y: 0 };
      if (ui.tzZoom >= 0) tzZoomTo(-1);
    }
  };
  if (S().kind === "vol") {
    // волюметрик: масштаб схемы коммутации
    const cv = $("volCom"), r = cv ? cv.getBoundingClientRect() : R;
    return {
      pct: () => ui.volView.z,
      step: (f) => {
        const vv = ui.volView;
        viewZoomAt(vv, Math.max(1, Math.min(12, vv.z * f)), r.width / 2, r.height / 2);
        if (vv.z === 1) vv.x = vv.y = 0;
        volComDraw();
      },
      auto: () => {
        Object.assign(ui.volView, { z: 1, x: 0, y: 0 });
        volComDraw();
      }
    };
  }
  return {
    pct: () => ui.zoom,
    step: (f) => setZoomAt(ui.zoom * f, cx, cy),
    auto: () => {
      ui.zoom = 1;
      ui.panX = ui.panY = 0;
      updateInfo();
    }
  };
}
function syncZoomLabel() {
  const el = $("zLabel");
  if (!el) return;
  let v = 1;
  try {
    v = zoomTarget().pct();
  } catch (e) {
  }
  setTxt(el, Math.round((isFinite(v) ? v : 1) * 100) + "%");
}
function drawCut() {
  const c = CC(), G = c && cutGeom(c);
  const R = prepCanvas(G ? [G.W, G.H] : [16, 9]);
  if (!G) {
    pctx.fillStyle = "#8c9bab";
    pctx.font = "15px ".concat(FONT);
    pctx.textAlign = "center";
    pctx.fillText(project.cuts.length ? "Выберите LED-маску для нарезки" : "Нажмите «+ Нарезка», чтобы разрезать длинную маску на части", R.width / 2, R.height / 2);
    pctx.textAlign = "left";
    return;
  }
  // 2.0.181: масштаб нарезки — колесо, кнопки «− + Авто», сдвиг перетаскиванием
  cutViewClamp(R);
  pctx.translate(ui.cutV.x, ui.cutV.y);
  pctx.scale(ui.cutV.z, ui.cutV.z);
  // 2.0.174: два окна — сверху исходная маска с разметкой и линиями разреза, снизу результат нарезки
  const pad = R.width < 600 ? 20 : 48, cap = 18, gapY = 14, slotH = (R.height - pad * 2 - gapY) / 2 - cap;
  const win = (title, W, H, y0, paint) => {
    const s = Math.min((R.width - pad * 2) / W, slotH / H);
    pctx.fillStyle = "#8c9bab";
    pctx.font = "12px ".concat(FONT);
    pctx.textAlign = "left";
    pctx.fillText(title, pad, y0 + 12);
    pctx.save();
    pctx.translate(Math.round((R.width - W * s) / 2), Math.round(y0 + cap + (slotH - H * s) / 2));
    paint(pctx, c, s);
    pctx.strokeStyle = "rgba(255,255,255,0.35)";
    pctx.lineWidth = 1;
    pctx.strokeRect(-0.5, -0.5, W * s + 1, H * s + 1);
    pctx.restore();
  };
  win("Исходная маска ".concat(G.W0, "×").concat(G.H0, " — красные линии разреза"), G.W0, G.H0, pad - 6, paintCutSrc);
  win("Результат нарезки ".concat(G.W, "×").concat(G.H, " px · ").concat(G.parts.length, " ").concat(G.parts.length < 5 ? "части" : "частей"), G.W, G.H, pad - 6 + cap + slotH + gapY, paintCut);
}
// ---- 2.0.122: ВЫХОДЫ (пробная функция) — мэппинг готовых масок на выходы, как Advanced Output в Resolume,
// но слайсы выделяются по кабинетам. Источник (композиция) — общее поле, маска или нарезка.
// project.outs = [{ id, name, src: "f:id" | "m:uid" | "c:id", screens: [{ id, name, w, h }], scr: id текущего выхода,
//   slices: [{ id, name, scr, ix, iy, iw, ih, ox, oy, ow, oh (0 — 1:1), rot: 0|90|180|270, fh, fv, on }], labels, view: "in" | "out" | "both" }]
// Пиксели 1:1 — без масштабирования (LED: пиксель контента = пиксель кабинета). В ТЗ не входит.
const OUT_W = 3840, OUT_H = 2160;
function freshOut(k) {
  const s = { id: newUid(), name: "Output 1", w: OUT_W, h: OUT_H };
  return { id: newUid(), name: "Мэппинг ".concat(k + 1), src: "", screens: [s], scr: s.id, slices: [], labels: true, view: "both" };
}
function normOut(o, k) {
  const d = freshOut(k), q = o && typeof o === "object" ? o : {};
  const screens = (Array.isArray(q.screens) ? q.screens : []).filter((s) => s && typeof s === "object").map((s, i) => keepRest({ id: typeof s.id === "string" && s.id ? s.id : newUid(), name: typeof s.name === "string" && s.name ? s.name.slice(0, 60).replace(/^Screen (\d+)$/, "Output $1") : "Output ".concat(i + 1), w: Math.max(16, Math.min(16384, pint(s.w, OUT_W))), h: Math.max(16, Math.min(16384, pint(s.h, OUT_H))) }, s));
  if (!screens.length) screens.push(d.screens[0]);
  const ids = new Set(screens.map((s) => s.id));
  const slices = (Array.isArray(q.slices) ? q.slices : []).filter((s) => s && typeof s === "object").map((s, i) => keepRest({
    id: typeof s.id === "string" && s.id ? s.id : newUid(),
    name: typeof s.name === "string" && s.name ? s.name.slice(0, 60) : "Slice ".concat(i + 1),
    scr: ids.has(s.scr) ? s.scr : screens[0].id,
    src: typeof s.src === "string" ? s.src : "",
    ix: Math.round(+s.ix || 0), iy: Math.round(+s.iy || 0), iw: Math.max(1, Math.round(+s.iw || 1)), ih: Math.max(1, Math.round(+s.ih || 1)),
    ox: Math.round(+s.ox || 0), oy: Math.round(+s.oy || 0), ow: Math.max(0, Math.min(65536, Math.round(+s.ow || 0))), oh: Math.max(0, Math.min(65536, Math.round(+s.oh || 0))),
    keep: s.keep !== false, grp: s.grp ? String(s.grp) : "", rot: [0, 90, 180, 270].includes(+s.rot) ? +s.rot : 0, ra: isFinite(+s.ra) ? Math.max(-180, Math.min(180, Math.round(+s.ra * 100) / 100)) : 0, fh: !!s.fh, fv: !!s.fv, on: s.on !== false
  }, s));
  return keepRest({ id: typeof q.id === "string" && q.id ? q.id : d.id, name: typeof q.name === "string" && q.name ? q.name.slice(0, 60) : d.name, src: typeof q.src === "string" ? q.src : "", screens, scr: ids.has(q.scr) ? q.scr : screens[0].id, slices, labels: q.labels !== false, view: ["in", "out", "both"].includes(q.view) ? q.view : "both" }, q);
}
const OC = () => project.outs[Math.max(0, Math.min(project.outs.length - 1, project.outCur || 0))];
const outScr = (o) => o.screens.find((s) => s.id === o.scr) || o.screens[0];
const ui_out = { sel: "", drag: null, V: { z: 1, x: 0, y: 0 }, L: null };
// ---- источники
function outSources() {
  const out = [];
  for (const f of project.fields) {
    const fi = fieldInfo(f);
    if (fi) out.push({ k: "f:" + f.id, name: "Общее поле: ".concat(f.name), w: fi.w, h: fi.h });
  }
  for (const c of project.cuts || []) {
    const ci = cutInfo(c);
    if (ci) out.push({ k: "c:" + c.id, name: "Нарезка: ".concat(c.name), w: ci.w, h: ci.h });
  }
  project.screens.forEach((st, i) => {
    if (st.kind === "vol") return;
    const [w, h] = dims(st);
    out.push({ k: "m:" + st.uid, name: "Маска: ".concat(i + 1, ". ").concat(st.name || "screen"), w, h });
  });
  return out;
}
function outSrc(o) {
  const all = outSources();
  return all.find((s) => s.k === o.src) || null;
}
function outSrcPaint(ctx, key, s) {
  const id = key.slice(2);
  if (key[0] === "f") {
    const f = project.fields.find((q) => q.id === id);
    if (f) paintField(ctx, f, s);
  } else if (key[0] === "c") {
    const c = (project.cuts || []).find((q) => q.id === id);
    if (c) paintCut(ctx, c, s);
  } else {
    const st = project.screens.find((q) => q.uid === id);
    if (st) drawMask(ctx, st, s, guidesOf(st));
  }
}
// картинка источника (кэш): s — масштаб
const outSrcCache = /* @__PURE__ */ new Map();
// ключ источника: меняется, только когда меняется сам источник
function outSrcKey(key) {
  const id = key.slice(2), g = JSON.stringify(project.guides);
  if (key[0] === "f") {
    const f = project.fields.find((q) => q.id === id);
    return f ? JSON.stringify(f) + JSON.stringify(fieldRects(f).map((r) => r.st)) + g : "";
  }
  if (key[0] === "c") {
    const c = (project.cuts || []).find((q) => q.id === id);
    return c ? JSON.stringify(c) + JSON.stringify(cutSrc(c)) + g : "";
  }
  const st = project.screens.find((q) => q.uid === id);
  return st ? JSON.stringify(st) + g : "";
}
// 2.0.154: источник можно указывать на каждый слайс (sl.src); o.src — активный источник (вид Input + новые слайсы)
function sliceSrc(o, sl) {
  return sl && sl.src && outSources().some((s) => s.k === sl.src) ? sl.src : o.src;
}
// ===== 2.0.185: несколько масок в одном мэппинге — галочками; порядок отмеченных = слои Resolume (первая — Слой 1) =====
// o.layers — строка ключей источников через запятую. Список: сначала маски (по порядку проекта), потом нарезки и поля.
function outLayerList() {
  const all = outSources(), rank = (k) => k[0] === "m" ? 0 : k[0] === "c" ? 1 : 2;
  return all.slice().sort((a, b) => rank(a.k) - rank(b.k) || all.indexOf(a) - all.indexOf(b));
}
// 2.0.186: порядок слоёв — свой у мэппинга (как отмечали и переставляли ▲▼), а не порядок масок в проекте
function outLayerKeys(o) {
  const have = new Set(outSources().map((s) => s.k)), seen = /* @__PURE__ */ new Set();
  return String(o.layers || "").split(",").filter((k) => k && have.has(k) && !seen.has(k) && seen.add(k));
}
function outLayerMove(o, k, d) {
  const ks = outLayerKeys(o), i = ks.indexOf(k), j = i + d;
  if (i < 0 || j < 0 || j >= ks.length) return;
  [ks[i], ks[j]] = [ks[j], ks[i]];
  o.layers = ks.join(",");
  outChanged(true);
}
// источники для авторазметки: отмеченные маски, а если не отмечено ничего — активный источник
const outAutoKeys = (o) => {
  const ks = outLayerKeys(o);
  return ks.length ? ks : o.src ? [o.src] : [];
};
// номер слоя Resolume для источника (1 — первая отмеченная), 0 — не отмечен
const outLayerNo = (o, k) => outLayerKeys(o).indexOf(k) + 1;
function outSrcCanvasK(srcKey, maxDim) {
  const S0 = outSources().find((s) => s.k === srcKey);
  if (!S0) return null;
  const s = Math.min(1, maxDim / Math.max(S0.w, S0.h)), key = srcKey + "|" + s + "|" + outSrcKey(srcKey);
  const c = outSrcCache.get(srcKey + "|" + maxDim);
  if (c && c.key === key) return c;
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(S0.w * s));
  cv.height = Math.max(1, Math.round(S0.h * s));
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, cv.width, cv.height);
  outSrcPaint(ctx, srcKey, s);
  const r = { key, cv, s, w: S0.w, h: S0.h };
  outSrcCache.set(srcKey + "|" + maxDim, r);
  return r;
}
const outSrcCanvas = (o, maxDim) => outSrcCanvasK(o.src, maxDim);
// фабрика источников с кэшем на один рендер: ключ → картинка источника
function outSrcFactory(maxDim) {
  const cache = /* @__PURE__ */ new Map();
  return (key) => {
    if (cache.has(key)) return cache.get(key);
    const r = outSrcCanvasK(key, maxDim);
    cache.set(key, r);
    return r;
  };
}
// ---- кабинеты источника (прямоугольники в пикселях источника) — для привязки слайсов
function rotRect(x, y, w, h, w0, h0, rot) {
  // поворот прямоугольника внутри маски w0×h0 на rot (кратно 90) — как в общем поле (вокруг центра)
  const a = (rot % 360 + 360) % 360, pts = [[x, y], [x + w, y + h]].map(([px, py]) => {
    const dx = px - w0 / 2, dy = py - h0 / 2;
    return a === 90 ? [-dy, dx] : a === 180 ? [-dx, -dy] : a === 270 ? [dy, -dx] : [dx, dy];
  });
  const W = a === 90 || a === 270 ? h0 : w0, H = a === 90 || a === 270 ? w0 : h0;
  const x0 = Math.min(pts[0][0], pts[1][0]) + W / 2, y0 = Math.min(pts[0][1], pts[1][1]) + H / 2;
  return { x: x0, y: y0, w: Math.abs(pts[1][0] - pts[0][0]), h: Math.abs(pts[1][1] - pts[0][1]) };
}
function maskCells(st) {
  const [w0, h0] = dims(st);
  if (st.kind !== "led") return [{ x: 0, y: 0, w: w0, h: h0 }];
  // 2.0.181: кабинеты там, где они нарисованы на маске — ось Y снизу вверх, со сдвигом («ступеньки»);
  // повёрнутый кабинет — по его габариту; погашенные и вне фигур не берутся (как в авторазметке)
  const { xs, ys } = grid(st), sh = cabShift(st), off = /* @__PURE__ */ new Set([...st.blackCabinets || [], ...shapeOff(st)]), out = [];
  for (let r = 0; r < ys.length - 1; r++) for (let c = 0; c < xs.length - 1; c++) {
    if (off.has(key(c, r))) continue;
    const ddx = sh.dx(c, r), ddy = sh.dy(c, r), x0 = xs[c] + ddx, x1 = xs[c + 1] + ddx, y0 = h0 - (ys[r + 1] + ddy), y1 = h0 - (ys[r] + ddy);
    const ra = cabRotOf(st, c, r);
    if (ra) {
      const a = ra * Math.PI / 180, w = x1 - x0, h = y1 - y0, bw = Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a)), bh = Math.abs(w * Math.sin(a)) + Math.abs(h * Math.cos(a));
      out.push({ x: (x0 + x1 - bw) / 2, y: (y0 + y1 - bh) / 2, w: bw, h: bh });
    } else out.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
  }
  return out;
}
const outCellCache = /* @__PURE__ */ new Map();
function outCellsK(srcKey) {
  const key = srcKey + "|" + outSrcKey(srcKey), c0 = outCellCache.get(srcKey);
  if (c0 && c0.key === key) return c0.cells;
  let cells = [];
  const id = srcKey.slice(2);
  if (srcKey[0] === "m") {
    const st = project.screens.find((q) => q.uid === id);
    if (st) cells = maskCells(st);
  } else if (srcKey[0] === "f") {
    const f = project.fields.find((q) => q.id === id), rs = f ? fieldRects(f) : [], b = fieldBBox(rs);
    for (const r of rs) {
      const ox = r.x - b.x, oy = r.y - b.y;
      if (r.rot % 90) {
        cells.push({ x: ox, y: oy, w: r.w, h: r.h, g: r.i });
        continue;
      }
      for (const q of maskCells(r.st)) {
        const t = rotRect(q.x, q.y, q.w, q.h, r.w0, r.h0, r.rot);
        cells.push({ x: ox + t.x, y: oy + t.y, w: t.w, h: t.h, g: r.i });
      }
    }
  } else if (srcKey[0] === "c") {
    // 2.0.181: кабинеты нарезки — по той же геометрии, что и авторазметка (со сдвигом и поворотом кабинетов)
    for (const g of outGroups(srcKey)) {
      const a = (+g.a || 0) * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
      for (const q of g.cells) {
        const cx = g.cx + q.dx * ca - q.dy * sa, cy = g.cy + q.dx * sa + q.dy * ca;
        const bw = Math.abs(q.w * ca) + Math.abs(q.h * sa), bh = Math.abs(q.w * sa) + Math.abs(q.h * ca);
        cells.push({ x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh, g: g.g });
      }
    }
  }
  cells = cells.map((q) => ({ x: Math.round(q.x), y: Math.round(q.y), w: Math.round(q.w), h: Math.round(q.h), g: q.g | 0 }));
  outCellCache.set(srcKey, { key, cells });
  return cells;
}
const outCells = (o) => outCellsK(o.src);
// 2.0.168: разбор любого источника на ГРУППЫ кабинетов с общим углом — LED-маска, блок кольца,
// отдельный кабинет кольца, экран в общем поле под любым углом (в т.ч. не кратным 90°).
// У группы: угол a, центр (cx,cy) в координатах источника и ячейки со смещением от центра (до поворота).
function outGroups(srcKey) {
  const out = [], id = srcKey.slice(2), rad = (d) => d * Math.PI / 180;
  const addScreen = (st, ox, oy, rot, gi, gname) => {
    const [w0, h0] = dims(st), [bw0, bh0] = rotDims(w0, h0, rot);
    const ccx = ox + bw0 / 2, ccy = oy + bh0 / 2, a = rad(rot);
    const toSrc = (lx, ly) => {
      const dx = lx - w0 / 2, dy = ly - h0 / 2;
      return [ccx + dx * Math.cos(a) - dy * Math.sin(a), ccy + dx * Math.sin(a) + dy * Math.cos(a)];
    };
    const pre = gname ? gname + " · " : "";
    if (st.kind === "ring") {
      const G = ringGeom(st), by = /* @__PURE__ */ new Map();
      for (const m of G.list) {
        const k = m.ri + "," + m.i;
        if (!by.has(k)) by.set(k, []);
        by.get(k).push(m);
      }
      for (const arr of by.values()) {
        const live = arr.filter((m) => !m.off);
        if (!live.length) continue;
        const f = arr[0];
        const bcx = arr.reduce((t, m) => t + m.x, 0) / arr.length, bcy = arr.reduce((t, m) => t + m.y, 0) / arr.length;
        const [sx, sy] = toSrc(bcx, bcy);
        out.push({ a: rot + f.rot, cx: sx, cy: sy, g: gi, scr: st, name: pre + ringLabel(G.R, f, st), cells: live.map((m) => ({
          dx: (m.bx - (f.bw - 1) / 2) * m.w, dy: (m.by - (f.bh - 1) / 2) * m.h,
          w: m.w, h: m.h, col: m.i * f.bw + m.bx, row: m.by, name: pre + ringLabel(G.R, m, st)
        })) });
      }
      return;
    }
    if (st.kind === "led") {
      // 2.0.172: геометрия — как при рисовании маски: ось Y идёт снизу вверх (ряд 0 — нижний), учитывается сдвиг кабинетов;
      // погашенные (чёрные) кабинеты и кабинеты вне фигур в разметку не попадают
      const { xs, ys } = grid(st), sh = cabShift(st), cells = [];
      const off = /* @__PURE__ */ new Set([...st.blackCabinets || [], ...shapeOff(st)]);
      for (let r = 0; r < ys.length - 1; r++) for (let c = 0; c < xs.length - 1; c++) {
        if (off.has(key(c, r))) continue;
        const ddx = sh.dx(c, r), ddy = sh.dy(c, r);
        const x0 = xs[c] + ddx, x1 = xs[c + 1] + ddx, y0 = h0 - (ys[r + 1] + ddy), y1 = h0 - (ys[r] + ddy);
        const cell = { dx: (x0 + x1) / 2 - w0 / 2, dy: (y0 + y1) / 2 - h0 / 2, w: x1 - x0, h: y1 - y0, col: c, row: r, name: pre + cabLabel(st, c, r) }, cra = cabRotOf(st, c, r);
        if (cra) {
          // 2.0.176: повёрнутый кабинет — отдельный блок под своим углом (чтобы слайс брал его ровно)
          const [sx, sy] = toSrc(w0 / 2 + cell.dx, h0 / 2 + cell.dy);
          out.push({ a: rot + cra, cx: sx, cy: sy, g: gi, scr: st, name: gname || st.name, cells: [{ ...cell, dx: 0, dy: 0 }] });
        } else cells.push(cell);
      }
      if (cells.length) out.push({ a: rot, cx: ccx, cy: ccy, g: gi, scr: st, name: gname || st.name, cells });
      return;
    }
    out.push({ a: rot, cx: ccx, cy: ccy, g: gi, scr: st, name: gname || st.name, cells: [{ dx: 0, dy: 0, w: w0, h: h0, col: 0, row: 0, name: gname || st.name }] });
  };
  if (srcKey[0] === "m") {
    const st = project.screens.find((q) => q.uid === id);
    if (st) addScreen(st, 0, 0, 0, 0, "");
  } else if (srcKey[0] === "f") {
    const f = project.fields.find((q) => q.id === id), rs = f ? fieldRects(f) : [], b = fieldBBox(rs);
    if (b) for (const r of rs) addScreen(r.st, r.x - b.x, r.y - b.y, r.rot || 0, r.i, r.st.name || "Экран " + (r.i + 1));
  } else if (srcKey[0] === "c") {
    // 2.0.176: авторазметка нарезанной маски — каждая часть нарезки это блок; кабинеты берутся там, где они лежат в кадре нарезки
    const cu = (project.cuts || []).find((q) => q.id === id), G = cu && cutGeom(cu);
    if (G && (!G.st.kind || G.st.kind === "led")) {
      const st = G.st, { xs, ys } = grid(st), sh = cabShift(st), off = /* @__PURE__ */ new Set([...st.blackCabinets || [], ...shapeOff(st)]);
      for (const p of G.parts) {
        const cells = [], gx = p.dx + p.w / 2, gy = p.dy + p.h / 2;
        for (let r = 0; r < ys.length - 1; r++) for (let c = 0; c < xs.length - 1; c++) {
          if (off.has(key(c, r))) continue;
          const ddx = sh.dx(c, r), ddy = sh.dy(c, r);
          const x0 = xs[c] + ddx, x1 = xs[c + 1] + ddx, y0 = G.H0 - (ys[r + 1] + ddy), y1 = G.H0 - (ys[r] + ddy);
          const mid = G.h ? (x0 + x1) / 2 : (y0 + y1) / 2;
          if (mid < p.sx || mid >= p.sx + p.len) continue;
          const ccx = (x0 + x1) / 2 - p.sx + p.dx, ccy = (y0 + y1) / 2 - p.sy + p.dy, ra = cabRotOf(st, c, r);
          const cell = { dx: ccx - gx, dy: ccy - gy, w: x1 - x0, h: y1 - y0, col: c, row: r, name: cabLabel(st, c, r) };
          if (ra) out.push({ a: ra, cx: ccx, cy: ccy, g: p.i, scr: st, name: "Часть " + (p.i + 1), cells: [{ ...cell, dx: 0, dy: 0 }] });
          else cells.push(cell);
        }
        if (cells.length) out.push({ a: 0, cx: gx, cy: gy, g: p.i, scr: st, name: "Часть " + (p.i + 1), cells });
      }
    }
  }
  return out;
}
// прямоугольник по кабинетам: все кабинеты, центр которых внутри выделения
// 2.0.181: прямоугольник слайса на входе по двум точкам: с магнитом «к кабинетам» — целыми кабинетами,
// без него — попиксельно (с привязкой к соседним слайсам, если она включена); Alt — без привязки
function outInRect(o, x0, y0, x1, y1, e, P, self) {
  const M = outMag(o);
  if (M.on && M.cab && !e.altKey) return snapToCells(o, x0, y0, x1, y1);
  const S0 = outSrc(o), cl = (v, m) => Math.max(0, Math.min(m, Math.round(v)));
  let ax = cl(x0, S0 ? S0.w : 1e9), ay = cl(y0, S0 ? S0.h : 1e9), bx = cl(x1, S0 ? S0.w : 1e9), by = cl(y1, S0 ? S0.h : 1e9);
  if (M.on && M.inSl && !e.altKey) {
    const [X, Y] = outInLines(o, self), thr = M.thr / P.k;
    if (S0) X.push(0, S0.w), Y.push(0, S0.h);
    bx = magPoint(bx, X, 0, thr);
    by = magPoint(by, Y, 0, thr);
  }
  const w = Math.abs(bx - ax), h = Math.abs(by - ay);
  return w >= 2 && h >= 2 ? { x: Math.min(ax, bx), y: Math.min(ay, by), w, h } : null;
}
function snapToCells(o, x0, y0, x1, y1) {
  // допуск 0,001 px: точка, пересчитанная с экрана, может отличаться от центра кабинета на ничтожную долю
  const L = Math.min(x0, x1) - 1e-3, R = Math.max(x0, x1) + 1e-3, T = Math.min(y0, y1) - 1e-3, B = Math.max(y0, y1) + 1e-3;
  let a = null;
  for (const q of outCells(o)) {
    const cx = q.x + q.w / 2, cy = q.y + q.h / 2;
    if (cx < L || cx > R || cy < T || cy > B) continue;
    a = a ? { x0: Math.min(a.x0, q.x), y0: Math.min(a.y0, q.y), x1: Math.max(a.x1, q.x + q.w), y1: Math.max(a.y1, q.y + q.h) } : { x0: q.x, y0: q.y, x1: q.x + q.w, y1: q.y + q.h };
  }
  return a ? { x: a.x0, y: a.y0, w: a.x1 - a.x0, h: a.y1 - a.y0 } : null;
}
// 2.0.134: размер слайса на выходе (ow × oh, уже с учётом поворота) можно менять — числами и мышью за углы;
// 0 — как на входе (1:1)
const sliceBaseWH = (sl) => sl.rot === 90 || sl.rot === 270 ? [sl.ih, sl.iw] : [sl.iw, sl.ih];
const sliceOutWH = (sl) => {
  const b = sliceBaseWH(sl);
  return [sl.ow > 0 ? sl.ow : b[0], sl.oh > 0 ? sl.oh : b[1]];
};
const sliceScaled = (sl) => {
  const b = sliceBaseWH(sl), w = sliceOutWH(sl);
  return b[0] !== w[0] || b[1] !== w[1];
};
// ---- отрисовка слайса на выходе
function paintSlice(ctx, srcC, sl, k) {
  const [ow, oh] = sliceOutWH(sl), s = srcC.s, r90 = sl.rot === 90 || sl.rot === 270, dw = r90 ? oh : ow, dh = r90 ? ow : oh;
  ctx.save();
  // 2.0.167: точный угол — участок вырезается из источника под этим углом и кладётся на выход ровно
  if (+sl.ra) {
    ctx.beginPath();
    ctx.rect(sl.ox * k, sl.oy * k, ow * k, oh * k);
    ctx.clip();
  }
  ctx.translate((sl.ox + ow / 2) * k, (sl.oy + oh / 2) * k);
  ctx.rotate(sl.rot * Math.PI / 180);
  ctx.scale(sl.fh ? -1 : 1, sl.fv ? -1 : 1);
  ctx.imageSmoothingEnabled = k < 1 || sliceScaled(sl) || !!+sl.ra;
  ctx.imageSmoothingQuality = "high";
  if (+sl.ra) {
    ctx.scale(dw * k / (sl.iw * s), dh * k / (sl.ih * s));
    ctx.rotate(-sl.ra * Math.PI / 180);
    ctx.translate(-(sl.ix + sl.iw / 2) * s, -(sl.iy + sl.ih / 2) * s);
    ctx.drawImage(srcC.cv, 0, 0);
  } else ctx.drawImage(srcC.cv, sl.ix * s, sl.iy * s, sl.iw * s, sl.ih * s, -dw * k / 2, -dh * k / 2, dw * k, dh * k);
  ctx.restore();
}
function paintOutScreen(ctx, o, scr, k, srcC, labels) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, Math.round(scr.w * k), Math.round(scr.h * k));
  ctx.clip();
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, Math.round(scr.w * k), Math.round(scr.h * k));
  const list = o.slices.filter((sl) => sl.on && sl.scr === scr.id);
  for (const sl of list) {
    const sc = typeof srcC === "function" ? srcC(sliceSrc(o, sl)) : srcC;
    if (sc) paintSlice(ctx, sc, sl, k);
  }
  if (labels) {
    const fs = Math.max(9, Math.min(48, scr.h * 0.018)) * k;
    for (const sl of list) {
      const [ow, oh] = sliceOutWH(sl);
      ctx.save();
      ctx.strokeStyle = "rgba(255,213,74,0.95)";
      ctx.lineWidth = Math.max(1, 2 * k);
      ctx.strokeRect(sl.ox * k + ctx.lineWidth / 2, sl.oy * k + ctx.lineWidth / 2, ow * k - ctx.lineWidth, oh * k - ctx.lineWidth);
      const t = "".concat(sl.name, "  ").concat(sl.iw, "×").concat(sl.ih).concat(sliceScaled(sl) ? " → " + ow + "×" + oh : "").concat(sl.rot ? "  ↻" + angS(sl.rot) + "°" : "").concat(+sl.ra ? "  ∠" + angS(sl.ra) + "°" : "").concat(sl.fh ? " ⇋" : "").concat(sl.fv ? " ⇵" : "");
      pill(ctx, t, sl.ox * k + fs * 0.4, sl.oy * k + fs * 0.4, fs, "left", "rgba(0,0,0,0.75)", "#FFD54A", ow * k - fs * 0.8);
      ctx.restore();
    }
  }  ctx.restore();
}
async function renderOutPNG(o, scr, onBand) {
  const srcOf = outSrcFactory(32e3);
  return renderBands(scr.w, scr.h, (ctx) => paintOutScreen(ctx, o, scr, 1, srcOf, o.labels), onBand);
}
// ---- автоматика
// 2.0.168: авторазметка для любых масок, включая повёрнутые и нестандартные.
// Режимы: cab — по кабинетам, rows — по рядам, cols — по столбцам, group — по блокам/экранам, screen — экран целиком.
function outAutoMap(o, mode) {
  if (!o || !o.screens.length) return;
  o.smartInfo = "";
  const gs = outAutoKeys(o).flatMap((k) => outGroups(k).map((g) => ({ ...g, srcKey: k, g: k + "#" + g.g })));
  if (!gs.length) return status("В источнике нет кабинетов для разметки", true);
  const rad = (d) => d * Math.PI / 180, parts = [];
  const push = (g, cells, name) => {
    if (!cells.length) return;
    const x0 = Math.min(...cells.map((q) => q.dx - q.w / 2)), x1 = Math.max(...cells.map((q) => q.dx + q.w / 2));
    const y0 = Math.min(...cells.map((q) => q.dy - q.h / 2)), y1 = Math.max(...cells.map((q) => q.dy + q.h / 2));
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, a = rad(g.a);
    parts.push({ cx: g.cx + mx * Math.cos(a) - my * Math.sin(a), cy: g.cy + mx * Math.sin(a) + my * Math.cos(a),
      w: x1 - x0, h: y1 - y0, a: g.a, name, key: g.g + "|" + (g.scr && g.scr.uid || ""), src: g.srcKey });
  };
  for (const g of gs) {
    if (mode === "cab") for (const q of g.cells) push(g, [q], outAutoKeys(o).length > 1 ? (g.name || "") + " · " + q.name : q.name);
    else if (mode === "rows" || mode === "cols") {
      const by = /* @__PURE__ */ new Map();
      for (const q of g.cells) {
        const k = mode === "rows" ? q.row : q.col;
        if (!by.has(k)) by.set(k, []);
        by.get(k).push(q);
      }
      for (const k of [...by.keys()].sort((a, b) => a - b)) {
        const arr = by.get(k).sort((a, b) => mode === "rows" ? a.col - b.col : a.row - b.row);
        // разрываем полосу там, где кабинеты не соседние
        let run = [arr[0]];
        for (let i = 1; i < arr.length; i++) {
          const prev = run[run.length - 1], cur = arr[i];
          const near = mode === "rows" ? cur.col === prev.col + 1 : cur.row === prev.row + 1;
          if (near) run.push(cur);
          else {
            push(g, run, g.name + " · " + (mode === "rows" ? "ряд " : "стб ") + (k + 1));
            run = [cur];
          }
        }
        push(g, run, g.name + " · " + (mode === "rows" ? "ряд " : "стб ") + (k + 1));
      }
    } else push(g, g.cells, g.name);
  }
  if (mode === "screen") {
    // объединяем группы одного экрана в один слайс по габаритам (угол берём у первой группы)
    const by = /* @__PURE__ */ new Map();
    for (const p of parts) {
      if (!by.has(p.key)) by.set(p.key, []);
      by.get(p.key).push(p);
    }
    const merged = [];
    for (const arr of by.values()) {
      if (arr.length === 1) {
        merged.push(arr[0]);
        continue;
      }
      const same = arr.every((q) => Math.abs(q.a - arr[0].a) < 1e-6);
      const a = same ? arr[0].a : 0, ar = rad(-a);
      const pts = arr.map((q) => ({ x: q.cx * Math.cos(ar) - q.cy * Math.sin(ar), y: q.cx * Math.sin(ar) + q.cy * Math.cos(ar), w: q.w, h: q.h }));
      const x0 = Math.min(...pts.map((q) => q.x - q.w / 2)), x1 = Math.max(...pts.map((q) => q.x + q.w / 2));
      const y0 = Math.min(...pts.map((q) => q.y - q.h / 2)), y1 = Math.max(...pts.map((q) => q.y + q.h / 2));
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, b = rad(a);
      merged.push({ cx: mx * Math.cos(b) - my * Math.sin(b), cy: mx * Math.sin(b) + my * Math.cos(b), w: x1 - x0, h: y1 - y0, a, name: arr[0].name.split(" · ")[0], src: arr[0].src });
    }
    parts.length = 0;
    parts.push(...merged);
  }
  if (!parts.length) return status("Нечего размечать", true);
  o.slices = parts.map((r, i) => ({ id: newUid(), name: r.name || "Slice " + (i + 1), scr: o.screens[0].id, src: r.src || o.src,
    ix: Math.round(r.cx - r.w / 2), iy: Math.round(r.cy - r.h / 2), iw: Math.max(1, Math.round(r.w)), ih: Math.max(1, Math.round(r.h)),
    ox: 0, oy: 0, ow: 0, oh: 0, keep: true, rot: 0, ra: +(+r.a || 0).toFixed(2), fh: false, fv: false, on: true }));
  outPack(o, true);
  status("Размечено слайсов: " + o.slices.length, true);
}
// ---- 2.0.181: УМНАЯ РАЗМЕТКА — программа сама перебирает варианты нарезки и раскладки и берёт тот,
// где меньше выходов, потом меньше слайсов, без поворотов и плотнее заполнение.
// Режет только по границам кабинетов; каждый слайс — сплошной прямоугольник живых кабинетов (без чёрных дыр).
function smartGroupGrid(g) {
  // кабинеты группы в своих координатах; сетка — если у каждого столбца и ряда одни и те же границы
  const cells = g.cells.map((q) => ({ q, x0: q.dx - q.w / 2, x1: q.dx + q.w / 2, y0: q.dy - q.h / 2, y1: q.dy + q.h / 2 }));
  const r2 = (v) => Math.round(v * 100) / 100;
  const xs = [...new Set(cells.flatMap((c) => [r2(c.x0), r2(c.x1)]))].sort((a, b) => a - b);
  const ys = [...new Set(cells.flatMap((c) => [r2(c.y0), r2(c.y1)]))].sort((a, b) => a - b);
  const ci = new Map(xs.map((v, i) => [v, i])), ri = new Map(ys.map((v, i) => [v, i]));
  const nc = xs.length - 1, nr = ys.length - 1, P = Array.from({ length: nr }, () => new Array(nc).fill(null));
  for (const c of cells) {
    const a = ci.get(r2(c.x0)), b = ci.get(r2(c.x1)), u = ri.get(r2(c.y0)), v = ri.get(r2(c.y1));
    if (b !== a + 1 || v !== u + 1 || P[u][a]) return null; // кабинет не ложится в одну клетку — не сетка
    P[u][a] = c;
  }
  return { xs, ys, nc, nr, P };
}
function smartRects(g, G, dir, k, split, W, H) {
  // dir "h": полосы по k рядов, внутри — куски по ширине ≤ W; "v" — то же по столбцам.
  // split: "fill" — набивать до упора, "even" — делить поровну.
  const out = [], { xs, ys, nc, nr, P } = G, rows = dir === "h";
  const nA = rows ? nr : nc, nB = rows ? nc : nr, A = rows ? ys : xs, B = rows ? xs : ys, LIM = rows ? W : H;
  const live = (a, b) => rows ? !!P[a][b] : !!P[b][a];
  let a0 = 0;
  while (a0 < nA) {
    // полоса из k линий; если в ней разная «живость» по линиям — укорачиваем полосу
    let a1 = Math.min(nA, a0 + k);
    const uniform = (x, y) => {
      for (let b = 0; b < nB; b++) {
        const v = live(x, b);
        for (let a = x + 1; a < y; a++) if (live(a, b) !== v) return false;
      }
      return true;
    };
    while (a1 - a0 > 1 && !uniform(a0, a1)) a1--;
    // непрерывные отрезки живых кабинетов вдоль полосы
    let b = 0;
    while (b < nB) {
      if (!live(a0, b)) {
        b++;
        continue;
      }
      let e = b;
      while (e < nB && live(a0, e)) e++;
      // режем отрезок [b, e) по границам кабинетов на куски ≤ LIM
      const len = B[e] - B[b], n = Math.max(1, Math.ceil(len / LIM - 1e-9));
      let s0 = b;
      for (let piece = 0; piece < n && s0 < e; piece++) {
        let s1 = s0 + 1;
        const target = split === "even" ? B[b] + len * (piece + 1) / n : Infinity;
        while (s1 < e && B[s1 + 1] - B[s0] <= LIM && (split !== "even" || piece === n - 1 || B[s1 + 1] <= target + 1e-6)) s1++;
        out.push(rows ? { x0: B[s0], x1: B[s1], y0: A[a0], y1: A[a1] } : { x0: A[a0], x1: A[a1], y0: B[s0], y1: B[s1] });
        s0 = s1;
      }
      while (s0 < e) { // если поровну не вышло — добиваем остаток
        let s1 = s0 + 1;
        while (s1 < e && B[s1 + 1] - B[s0] <= LIM) s1++;
        out.push(rows ? { x0: B[s0], x1: B[s1], y0: A[a0], y1: A[a1] } : { x0: A[a0], x1: A[a1], y0: B[s0], y1: B[s1] });
        s0 = s1;
      }
      b = e;
    }
    a0 = a1;
  }
  return out;
}
function smartPack(items, scrs) {
  // упаковка «полками» по убыванию высоты: каждый слайс — в первую полку любого выхода, где он помещается.
  // Не помещается как есть, но помещается повёрнутым на 90° — поворачиваем. Новые выходы — размером первого.
  const W0 = scrs[0].w, H0 = scrs[0].h, outs = scrs.map((s) => ({ w: s.w, h: s.h, shelves: [], used: 0 }));
  const order = items.map((it, i) => i).sort((i, j) => items[j].h - items[i].h || items[j].w - items[i].w || i - j);
  const res = new Array(items.length);
  let rotated = 0;
  const tryPut = (oi, w, h) => {
    const O = outs[oi];
    for (const sh of O.shelves) if (h <= sh.h && sh.x + w <= O.w) {
      const r = { o: oi, x: sh.x, y: sh.y };
      sh.x += w;
      return r;
    }
    if (O.used + h <= O.h && w <= O.w) {
      const sh = { y: O.used, h, x: w };
      O.shelves.push(sh);
      O.used += h;
      return { o: oi, x: 0, y: sh.y };
    }
    return null;
  };
  for (const i of order) {
    const it = items[i];
    let r = null, rot = false;
    for (let oi = 0; oi < outs.length && !r; oi++) r = tryPut(oi, it.w, it.h);
    if (!r && it.w > W0 && it.h <= W0 && it.w <= H0) {
      for (let oi = 0; oi < outs.length && !r; oi++) r = tryPut(oi, it.h, it.w);
      rot = !!r;
    }
    if (!r) {
      outs.push({ w: W0, h: H0, shelves: [], used: 0 });
      const oi = outs.length - 1, big = it.w > W0 || it.h > H0, canRot = big && it.h <= W0 && it.w <= H0;
      rot = canRot;
      r = tryPut(oi, rot ? it.h : it.w, rot ? it.w : it.h) || { o: oi, x: 0, y: 0 };
      if (!rot && big) outs[oi].used = outs[oi].h; // больше выхода — один на весь выход
    }
    if (rot) rotated++;
    res[i] = { ...r, rot };
  }
  const usedOuts = new Set(res.map((r) => r.o));
  const area = items.reduce((t, it) => t + it.w * it.h, 0), cap = [...usedOuts].reduce((t, oi) => t + outs[oi].w * outs[oi].h, 0);
  return { res, outs: usedOuts.size, nOuts: outs.length, rotated, fill: cap ? area / cap : 0 };
}
function smartFill(gs, grids, scrs) {
  // заполнение выходов: в свободное место кладётся самый большой прямоугольник оставшихся кабинетов, который туда влезает;
  // свободное место делится «гильотиной» по короткой стороне. Кабинеты, не лежащие в сетке, кладутся по одному.
  const W0 = scrs[0].w, H0 = scrs[0].h, outs = scrs.map((s) => ({ w: s.w, h: s.h, free: [{ x: 0, y: 0, w: s.w, h: s.h }] }));
  const R = grids.map((G) => G ? G.P.map((row) => row.map((c) => !!c)) : null);
  const loose = [];
  gs.forEach((g, gi) => {
    if (!grids[gi]) for (const q of g.cells) loose.push({ gi, r: { x0: q.dx - q.w / 2, x1: q.dx + q.w / 2, y0: q.dy - q.h / 2, y1: q.dy + q.h / 2 }, used: false });
  });
  const items = [], res = [];
  const left = () => R.some((M) => M && M.some((row) => row.some((v) => v))) || loose.some((q) => !q.used);
  const bestIn = (F) => {
    let best = null;
    const take = (cand) => {
      // больше площадь; при равной — плотнее к свободному месту
      const k = cand.w * cand.h * 1e6 - Math.min(F.w - cand.w, F.h - cand.h);
      if (!best || k > best.k) best = { ...cand, k };
    };
    R.forEach((M, gi) => {
      if (!M) return;
      const { xs, ys, nr, nc } = grids[gi];
      for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) {
        if (!M[r][c] || c > 0 && M[r][c - 1] && r > 0 && M[r - 1][c]) continue; // только «углы» оставшихся участков
        let cmax = nc - c;
        for (let r1 = r; r1 < nr; r1++) {
          if (ys[r1 + 1] - ys[r] > F.h + 1e-6) break;
          let cc = 0;
          while (cc < cmax && M[r1][c + cc] && xs[c + cc + 1] - xs[c] <= F.w + 1e-6) cc++;
          cmax = cc;
          if (!cmax) break;
          take({ gi, r0: r, r1: r1 + 1, c0: c, c1: c + cmax, w: xs[c + cmax] - xs[c], h: ys[r1 + 1] - ys[r] });
        }
      }
    });
    loose.forEach((q, li) => {
      const w = q.r.x1 - q.r.x0, h = q.r.y1 - q.r.y0;
      if (!q.used && w <= F.w + 1e-6 && h <= F.h + 1e-6) take({ li, w, h });
    });
    return best;
  };
  let guard = 0;
  while (left() && guard++ < 20000) {
    let pick = null;
    for (let oi = 0; oi < outs.length && !pick; oi++) {
      const fr = outs[oi].free.slice().sort((a, b) => a.y - b.y || a.x - b.x);
      for (const F of fr) {
        const b = bestIn(F);
        if (b && (!pick || b.k > pick.b.k)) pick = { oi, F, b };
      }
    }
    if (!pick) {
      const fresh = { w: W0, h: H0, free: [{ x: 0, y: 0, w: W0, h: H0 }] };
      outs.push(fresh);
      const b = bestIn(fresh.free[0]);
      if (!b) {
        // кабинет больше выхода — ставим один на весь выход
        let one = null;
        R.forEach((M, gi) => M && M.forEach((row, r) => row.forEach((v, c) => {
          if (v && !one) one = { gi, r0: r, r1: r + 1, c0: c, c1: c + 1 };
        })));
        if (!one) one = { li: loose.findIndex((q) => !q.used) };
        fresh.free = [];
        place(outs.length - 1, { x: 0, y: 0 }, one);
      }
      continue;
    }
    const { oi, F, b } = pick, O = outs[oi];
    O.free.splice(O.free.indexOf(F), 1);
    // гильотина: режем по короткой оставшейся стороне
    const rw = F.w - b.w, rh = F.h - b.h;
    if (rw < rh) {
      if (rw > 0) O.free.push({ x: F.x + b.w, y: F.y, w: rw, h: b.h });
      if (rh > 0) O.free.push({ x: F.x, y: F.y + b.h, w: F.w, h: rh });
    } else {
      if (rw > 0) O.free.push({ x: F.x + b.w, y: F.y, w: rw, h: F.h });
      if (rh > 0) O.free.push({ x: F.x, y: F.y + b.h, w: b.w, h: rh });
    }
    place(oi, F, b);
  }
  function place(oi, at, b) {
    if (b.li != null && b.li >= 0) {
      const q = loose[b.li];
      q.used = true;
      items.push({ gi: q.gi, r: q.r });
    } else {
      const G = grids[b.gi], M = R[b.gi];
      for (let r = b.r0; r < b.r1; r++) for (let c = b.c0; c < b.c1; c++) M[r][c] = false;
      items.push({ gi: b.gi, r: { x0: G.xs[b.c0], x1: G.xs[b.c1], y0: G.ys[b.r0], y1: G.ys[b.r1] } });
    }
    const it = items[items.length - 1];
    it.w = Math.round(it.r.x1 - it.r.x0);
    it.h = Math.round(it.r.y1 - it.r.y0);
    res.push({ o: oi, x: Math.round(at.x), y: Math.round(at.y), rot: false });
  }
  const usedOuts = new Set(res.map((r) => r.o));
  const area = items.reduce((t, it) => t + it.w * it.h, 0), cap = [...usedOuts].reduce((t, oi) => t + outs[oi].w * outs[oi].h, 0);
  return { items, P: { res, outs: usedOuts.size, nOuts: outs.length, rotated: 0, fill: cap ? area / cap : 0 } };
}
function outSmartMap(o) {
  if (!o || !o.screens.length) return;
  // все отмеченные маски вместе (слайсы раскладываются по общим выходам); у каждой группы — свой источник
  const gs = outAutoKeys(o).flatMap((k) => outGroups(k).map((g) => ({ ...g, srcKey: k, g: k + "#" + g.g })));
  if (!gs.length) return status("В источнике нет кабинетов для разметки", true);
  const W = o.screens[0].w, H = o.screens[0].h, rad = (d) => d * Math.PI / 180;
  // группа не складывается в одну сетку (например, «лесенка» — каждый ряд сдвинут по-своему):
  // делим её на ровные ряды или столбцы, каждый из которых — своя сетка
  for (let i = gs.length - 1; i >= 0; i--) {
    const g = gs[i];
    if (g.cells.length < 2 || smartGroupGrid(g)) continue;
    for (const by of ["row", "col"]) {
      const m = /* @__PURE__ */ new Map();
      for (const q of g.cells) {
        const k = by === "row" ? Math.round(q.dy - q.h / 2) + ":" + Math.round(q.h) : Math.round(q.dx - q.w / 2) + ":" + Math.round(q.w);
        if (!m.has(k)) m.set(k, []);
        m.get(k).push(q);
      }
      const subs = [...m.values()].map((cells) => ({ ...g, cells }));
      if (subs.length > 1 && subs.every((sg) => smartGroupGrid(sg))) {
        gs.splice(i, 1, ...subs);
        break;
      }
    }
  }
  const grids = gs.map(smartGroupGrid);
  const toPart = (g, r, name) => {
    const w = r.x1 - r.x0, h = r.y1 - r.y0, mx = (r.x0 + r.x1) / 2, my = (r.y0 + r.y1) / 2, a = rad(g.a);
    return { cx: g.cx + mx * Math.cos(a) - my * Math.sin(a), cy: g.cy + mx * Math.sin(a) + my * Math.cos(a), w, h, a: g.a, name };
  };
  // варианты для одной группы
  const variants = (gi) => {
    const g = gs[gi], G = grids[gi], list = [];
    if (!G) {
      // не сетка (кольцо, сдвинутые кабинеты): блок целиком, если влезает, иначе по кабинетам
      const x0 = Math.min(...g.cells.map((q) => q.dx - q.w / 2)), x1 = Math.max(...g.cells.map((q) => q.dx + q.w / 2));
      const y0 = Math.min(...g.cells.map((q) => q.dy - q.h / 2)), y1 = Math.max(...g.cells.map((q) => q.dy + q.h / 2));
      const full = Math.abs(g.cells.reduce((t, q) => t + q.w * q.h, 0) - (x1 - x0) * (y1 - y0)) < 1;
      if (full && x1 - x0 <= W && y1 - y0 <= H) list.push({ how: "блоки целиком", rects: [{ x0, x1, y0, y1 }] });
      list.push({ how: "по кабинетам", rects: g.cells.map((q) => ({ x0: q.dx - q.w / 2, x1: q.dx + q.w / 2, y0: q.dy - q.h / 2, y1: q.dy + q.h / 2 })) });
      return list;
    }
    // полосы выше (шире) выхода не нужны: перебираем только те, что в него влезают
    const med = (arr) => arr.slice().sort((a, b) => a - b)[arr.length >> 1];
    const rh = med(G.ys.slice(1).map((v, i) => v - G.ys[i])), cw = med(G.xs.slice(1).map((v, i) => v - G.xs[i]));
    const kr = Math.min(G.nr, 60, Math.max(1, Math.floor(H / rh + 1e-9))), kc = Math.min(G.nc, 60, Math.max(1, Math.floor(W / cw + 1e-9)));
    const word = (k, one, few, many) => k % 10 === 1 && k % 100 !== 11 ? one : k % 10 >= 2 && k % 10 <= 4 && (k % 100 < 12 || k % 100 > 14) ? few : many;
    const name = (dir, k, rects) => rects.length === 1 ? (g.cells.length === 1 ? "по кабинетам" : "целиком") : dir === "h" ? "полосы по " + k + " " + word(k, "ряду", "ряда", "рядов") : "полосы по " + k + " " + word(k, "столбцу", "столбца", "столбцов");
    for (let k = 1; k <= kr; k++) for (const sp of ["fill", "even"]) {
      const rects = smartRects(g, G, "h", k, sp, W, H);
      list.push({ how: name("h", k, rects), dir: "h", k, sp, rects });
    }
    for (let k = 1; k <= kc; k++) for (const sp of ["fill", "even"]) {
      const rects = smartRects(g, G, "v", k, sp, W, H);
      list.push({ how: name("v", k, rects), dir: "v", k, sp, rects });
    }
    return list;
  };
  const V = gs.map((g, gi) => variants(gi));
  // общие стратегии: одно и то же правило для всех групп + лучший вариант для каждой группы отдельно
  const score = (P, n) => P.outs * 1e9 + n * 1e4 + P.rotated * 1e3 + Math.round((1 - P.fill) * 999);
  const evalPick = (pick) => {
    const items = [];
    pick.forEach((v, gi) => v.rects.forEach((r) => items.push({ gi, r, w: Math.round(r.x1 - r.x0), h: Math.round(r.y1 - r.y0) })));
    const P = smartPack(items, o.screens);
    return { pick, items, P, sc: score(P, items.length) };
  };
  const cands = [];
  const keys = /* @__PURE__ */ new Set();
  for (const vs of V) for (const v of vs) keys.add((v.dir || "x") + "|" + (v.k || 0) + "|" + (v.sp || ""));
  for (const key2 of keys) {
    const [dir, k, sp] = key2.split("|");
    cands.push(evalPick(V.map((vs) => vs.find((v) => (v.dir || "x") === dir && String(v.k || 0) === k && (v.sp || "") === sp) || vs.reduce((b, v) => !b || v.rects.length < b.rects.length ? v : b, null))));
  }
  // жадно улучшаем выбор по группам
  let best = cands.reduce((b, c) => !b || c.sc < b.sc ? c : b, null);
  for (let pass = 0; pass < 2 && gs.length > 1 && gs.length <= 40; pass++) for (let gi = 0; gi < gs.length; gi++) for (const v of V[gi]) {
    if (v === best.pick[gi]) continue;
    const pick = best.pick.slice();
    pick[gi] = v;
    const c = evalPick(pick);
    if (c.sc < best.sc) best = c;
  }
  // второй способ — заполнение выходов; побеждает тот, где меньше выходов, потом меньше слайсов
  const F = smartFill(gs, grids, o.screens);
  F.sc = score(F.P, F.items.length);
  F.pick = [{ how: "заполнение выходов" }];
  if (F.sc < best.sc) best = F;
  // слайсы: порядок — как в источнике (по группе, сверху вниз, слева направо), раскладка — из упаковки
  const nOld = o.screens.length;
  while (o.screens.length < best.P.nOuts) o.screens.push({ id: newUid(), name: "Output ".concat(o.screens.length + 1), w: W, h: H, auto: true });
  const idx = best.items.map((it, i) => i).sort((i, j) => best.items[i].gi - best.items[j].gi || best.items[i].r.y0 - best.items[j].r.y0 || best.items[i].r.x0 - best.items[j].r.x0);
  o.slices = idx.map((i, n) => {
    const it = best.items[i], g = gs[it.gi], pr = toPart(g, it.r, ""), pl = best.P.res[i];
    const nm = (gs.length > 1 ? g.name + " · " : "") + "Slice " + (n + 1);
    return { id: newUid(), name: nm, scr: o.screens[pl.o].id, src: g.srcKey || o.src,
      ix: Math.round(pr.cx - pr.w / 2), iy: Math.round(pr.cy - pr.h / 2), iw: Math.max(1, Math.round(pr.w)), ih: Math.max(1, Math.round(pr.h)),
      ox: pl.x, oy: pl.y, ow: 0, oh: 0, keep: true, rot: pl.rot ? 90 : 0, ra: +(+pr.a || 0).toFixed(2), fh: false, fv: false, on: true };
  });
  const used = new Set(o.slices.map((q) => q.scr));
  o.screens = o.screens.filter((q, i) => i === 0 || used.has(q.id) || (!q.auto && i < nOld));
  if (!o.screens.some((q) => q.id === o.scr)) o.scr = o.screens[0].id;
  ui_out.sel = o.slices[0] ? o.slices[0].id : "";
  const hows = [...new Set(best.pick.map((v) => v.how))];
  const nO = best.P.outs, nS = o.slices.length;
  const msg = "Умная разметка: ".concat(hows.join(", "), " · ").concat(nO, " ").concat(nO === 1 ? "выход" : nO < 5 ? "выхода" : "выходов", " ").concat(W, "×").concat(H, " · ").concat(nS, " ").concat(nS % 10 === 1 && nS % 100 !== 11 ? "слайс" : nS % 10 >= 2 && nS % 10 <= 4 && (nS % 100 < 12 || nS % 100 > 14) ? "слайса" : "слайсов", " · заполнение ").concat(Math.round(best.P.fill * 100), "%").concat(best.P.rotated ? " · повёрнуто на 90°: " + best.P.rotated : "", ". Проверено вариантов: ").concat(cands.length + 1, ".");
  o.smartInfo = msg;
  status(msg, true);
}
function outAutoSlices(o, mode) {
  const S0 = outSrc(o);
  if (!S0) return status("Сначала выберите источник", true);
  const cells = outCells(o), out = [];
  if (mode === "all") out.push({ x: 0, y: 0, w: S0.w, h: S0.h });
  else if (mode === "mask" && o.src[0] === "f") {
    const f = project.fields.find((q) => "f:" + q.id === o.src), rs = fieldRects(f), b = fieldBBox(rs);
    for (const r of rs) out.push({ x: r.x - b.x, y: r.y - b.y, w: r.w, h: r.h, name: r.st.name });
  } else if (mode === "mask" && o.src[0] === "c") {
    const c = project.cuts.find((q) => "c:" + q.id === o.src), G = cutGeom(c);
    for (const p of G.parts) out.push({ x: p.dx, y: p.dy, w: p.w, h: p.h, name: "Часть ".concat(p.i + 1) });
  } else if (mode === "ringCab" || mode === "ringBlk") {
    // 2.0.167: кольцо — свой слайс на каждый кабинет (или на блок), повёрнутый под его угол
    const st = o.src[0] === "m" ? project.screens.find((q) => q.uid === o.src.slice(2)) : null;
    if (!st || st.kind !== "ring") return status("Источник не кольцо — выберите маску-кольцо", true);
    const G = ringGeom(st);
    if (mode === "ringCab") {
      for (const m of G.list) if (!m.off) out.push({ x: m.x - m.w / 2, y: m.y - m.h / 2, w: m.w, h: m.h, a: m.rot, name: ringLabel(G.R, m, st) });
    } else {
      const by = /* @__PURE__ */ new Map();
      for (const m of G.list) {
        const k = m.ri + "," + m.i;
        if (!by.has(k)) by.set(k, []);
        by.get(k).push(m);
      }
      for (const arr of by.values()) {
        if (arr.every((m) => m.off)) continue;
        const f = arr[0], cx = arr.reduce((t, m) => t + m.x, 0) / arr.length, cy = arr.reduce((t, m) => t + m.y, 0) / arr.length;
        const w = f.bw * f.w, h = f.bh * f.h;
        out.push({ x: cx - w / 2, y: cy - h / 2, w, h, a: f.rot, name: "".concat(f.ri + 1, "-").concat(f.i + 1) });
      }
    }
  } else {
    // ряды или столбцы кабинетов: соседние кабинеты одной полосы — один слайс
    // соседние кабинеты одной маски; длинная полоса делится по кабинетам, чтобы влезть в выход
    const rows = mode === "rows", band = /* @__PURE__ */ new Map(), lim = rows ? o.screens[0].w : o.screens[0].h;
    for (const q of cells) {
      const k = q.g + "|" + (rows ? q.y + ":" + q.h : q.x + ":" + q.w);
      if (!band.has(k)) band.set(k, []);
      band.get(k).push(q);
    }
    for (const list of band.values()) {
      list.sort((a, b) => rows ? a.x - b.x : a.y - b.y);
      let cur = null;
      for (const q of list) {
        if (cur && (rows ? q.x === cur.x + cur.w && cur.w + q.w <= lim : q.y === cur.y + cur.h && cur.h + q.h <= lim)) {
          if (rows) cur.w += q.w;
          else cur.h += q.h;
        } else {
          if (cur) out.push(cur);
          cur = { ...q };
        }
      }
      if (cur) out.push(cur);
    }
    out.sort((a, b) => rows ? a.y - b.y || a.x - b.x : a.x - b.x || a.y - b.y);
  }
  if (!out.length) return status("Нет кабинетов для слайсов", true);
  // 2.0.154: новые слайсы берут участок с активного источника; старые слайсы других источников сохраняем
  const keepOther = o.slices.filter((s) => sliceSrc(o, s) !== o.src);
  o.slices = keepOther.concat(out.map((r, i) => ({ id: newUid(), name: r.name || (mode === "rows" ? "Ряд " : mode === "cols" ? "Столбец " : "Slice ").concat(i + 1), scr: o.screens[0].id, src: o.src, ix: Math.round(r.x), iy: Math.round(r.y), iw: Math.max(1, Math.round(r.w)), ih: Math.max(1, Math.round(r.h)), ox: 0, oy: 0, ow: 0, oh: 0, keep: true, rot: 0, ra: +(+r.a || 0).toFixed(2), fh: false, fv: false, on: true })));
  outPack(o, true);
  ui_out.sel = o.slices[0] ? o.slices[0].id : "";
  status("Слайсов: ".concat(o.slices.length), true);
}
// раскладка по выходам «полками»: слева направо, затем ниже; не помещается — следующий выход (новый, если нужно)
function outPack(o, quiet) {
  let si = 0, x = 0, y = 0, rowH = 0;
  const sc = () => o.screens[si];
  for (const sl of o.slices) {
    const [w, h] = sliceOutWH(sl);
    for (let guard = 0; guard < 64; guard++) {
      const S1 = sc();
      if (x + w <= S1.w && y + h <= S1.h) break;
      if (x > 0 && y + rowH + h <= S1.h && w <= S1.w) {
        y += rowH;
        x = 0;
        rowH = 0;
        continue;
      }
      if (x === 0 && y === 0) break; // больше выхода целиком — кладём как есть
      si++;
      if (!o.screens[si]) o.screens.push({ id: newUid(), name: "Output ".concat(o.screens.length + 1), w: o.screens[0].w, h: o.screens[0].h, auto: true });
      x = y = rowH = 0;
    }
    sl.scr = sc().id;
    sl.ox = x;
    sl.oy = y;
    x += w;
    rowH = Math.max(rowH, h);
  }
  // пустые выходы, которые добавила сама раскладка, убираем
  const used = new Set(o.slices.map((q) => q.scr));
  o.screens = o.screens.filter((q, i) => i === 0 || used.has(q.id) || !q.auto);
  if (!o.screens.some((q) => q.id === o.scr)) o.scr = o.screens[0].id;
  if (!quiet) status("Слайсы разложены по выходам: ".concat(new Set(o.slices.map((s) => s.scr)).size), true);
}
// ---- изменения и панель
// 2.0.125: лента выходов (Screens) текущего мэппинга — как лента масок: миниатюры, «+» — новый выход, «copy» — копия со слайсами
let oStripT = 0;
function scheduleOutStrip() {
  clearTimeout(oStripT);
  oStripT = setTimeout(renderOutStrip, 200);
}
function renderOutStrip() {
  if (ui.page !== "out") return;
  const box = $("oStrip"), o = OC();
  box.innerHTML = "";
  if (!o) return;
  const srcOf = outSrcFactory(2048);
  o.screens.forEach((scr, k) => {
    const tile = document.createElement("button"), cap = document.createElement("span"), n = o.slices.filter((q) => q.scr === scr.id && q.on).length;
    tile.type = "button";
    tile.className = "mthumb";
    cap.className = "cap";
    cap.innerHTML = "<b>".concat(k + 1, ". ").concat(xmlEsc(scr.name), "</b> · ").concat(scr.w, "×").concat(scr.h, " · ").concat(n, " сл.");
    const sc = Math.min(200 / scr.w, 124 / scr.h) * Math.min(2, window.devicePixelRatio || 1), cv = document.createElement("canvas");
    cv.width = Math.max(1, Math.round(scr.w * sc));
    cv.height = Math.max(1, Math.round(scr.h * sc));
    tile.append(cv, cap);
    tile.title = "".concat(scr.name, " — ").concat(scr.w, "×").concat(scr.h, ", слайсов: ").concat(n);
    tile.setAttribute("aria-current", String(scr.id === o.scr && o.view !== "in"));
    tile.onclick = () => {
      o.scr = scr.id;
      if (o.view === "in") o.view = "out";
      ui_out.V = { z: 1, x: 0, y: 0 };
      outChanged(true);
    };
    box.appendChild(tile);
    // 2.0.144: рисуем ПОСЛЕ вставки в DOM — иначе старый WebKit (Safari 12) показывает чёрный кадр
    paintOutScreen(cv.getContext("2d"), o, scr, sc, srcOf, false);
  });
  const add = document.createElement("div"), b1 = document.createElement("button"), b2 = document.createElement("button");
  add.className = "mthumb add";
  b1.type = b2.type = "button";
  b1.className = "plus";
  b1.textContent = "+";
  b1.title = "Новый выход";
  b1.onclick = () => $("oScrAdd").click();
  b2.className = "copy";
  b2.textContent = "copy";
  b2.title = "Копия текущего выхода вместе с его слайсами";
  b2.onclick = copyOutScreen;
  add.append(b1, b2);
  box.appendChild(add);
}
const outThumbs = /* @__PURE__ */ new Map();
function outThumb(m, scr) {
  const srcOf = outSrcFactory(2048);
  const used = [...new Set(m.slices.filter((q) => q.scr === scr.id).map((q) => sliceSrc(m, q)))];
  const k = JSON.stringify(m) + "|" + used.map((key) => { const sc = srcOf(key); return key + ":" + (sc ? sc.key : ""); }).join(";"), c = outThumbs.get(m.id + scr.id);
  if (c && c.k === k) return c.cv;
  const s = Math.min(1, 1600 / Math.max(scr.w, scr.h)), cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(scr.w * s));
  cv.height = Math.max(1, Math.round(scr.h * s));
  paintOutScreen(cv.getContext("2d"), m, scr, s, srcOf, m.labels);
  outThumbs.set(m.id + scr.id, { k, cv });
  return cv;
}
function copyOutScreen() {
  const o = OC();
  if (!o) return;
  const s0 = outScr(o), s = { ...s0, id: newUid(), name: s0.name + " (копия)" };
  delete s.auto;
  o.screens.splice(o.screens.indexOf(s0) + 1, 0, s);
  for (const q of o.slices.filter((z) => z.scr === s0.id)) o.slices.push({ ...q, id: newUid(), name: q.name + " (копия)", scr: s.id });
  o.scr = s.id;
  if (o.view === "in") o.view = "out";
  outChanged(true);
  status("Копия выхода: " + s.name, true);
}
stripDrag($("oStrip"), (from, to) => {
  const o = OC();
  if (!o) return;
  moveIn(o.screens, from, to);
  outChanged(true);
  status("Порядок выходов изменён", true);
});
function outChanged(panel) {
  scheduleOutStrip();
  scheduleAutosave();
  scheduleHistory();
  if (panel) refreshOutPanel();
  else syncOutSel();
  requestDraw();
}
const curSlice = () => {
  const o = OC();
  return o ? o.slices.find((s) => s.id === ui_out.sel) || null : null;
};
function refreshOutPanel() {
  if (ui.page !== "out") return;
  scheduleOutStrip();
  const has = project.outs.length > 0;
  $("oBody").hidden = !has;
  $("oExp").hidden = !has;
  $("oEmpty").hidden = has;
  fillSelect($("oSel"), project.outs.map((o2, i) => "".concat(i + 1, ". ").concat(o2.name)));
  if (!has) return;
  $("oSel").value = project.outCur;
  const o = OC(), srcs = outSources();
  if (!srcs.some((s) => s.k === o.src)) o.src = srcs[0] ? srcs[0].k : "";
  $("oSrc").replaceChildren(...srcs.map((s) => {
    const op = document.createElement("option");
    op.value = s.k;
    op.textContent = "".concat(s.name, " — ").concat(s.w, "×").concat(s.h);
    return op;
  }));
  $("oSrc").value = o.src;
  document.querySelectorAll("#oView button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === o.view)));
  // выходы
  const sl = $("oScrList");
  sl.replaceChildren();
  o.screens.forEach((s, i) => {
    const r = document.createElement("div"), n = o.slices.filter((q) => q.scr === s.id).length;
    r.className = "fitem" + (s.id === o.scr ? " sel" : "");
    r.innerHTML = '<span class="nm"></span><span class="sz"></span>';
    r.querySelector(".nm").textContent = "".concat(i + 1, ". ").concat(s.name);
    r.querySelector(".sz").textContent = "".concat(s.w, "×").concat(s.h, " · слайсов: ").concat(n);
    r.onclick = () => {
      o.scr = s.id;
      if (o.view === "in") o.view = "out";
      outChanged(true);
    };
    sl.appendChild(r);
  });
  const S1 = outScr(o);
  $("oScrW").value = S1.w;
  $("oScrH").value = S1.h;
  // слайсы
  const ll = $("oSliceList");
  ll.replaceChildren();
  if (!o.slices.length) {
    const p0 = document.createElement("p");
    p0.className = "hint";
    p0.textContent = "Слайсов нет. Нажмите «+ Слайс» или протяните мышью по маске в Input Selection.";
    ll.appendChild(p0);
  }
  o.slices.forEach((s) => {
    const r = document.createElement("div"), cb = document.createElement("input"), scr = o.screens.find((q) => q.id === s.scr);
    r.className = "fitem" + (s.id === ui_out.sel ? " sel" : "");
    cb.type = "checkbox";
    cb.checked = s.on;
    cb.title = "Слайс включён";
    cb.onclick = (e) => e.stopPropagation();
    cb.onchange = () => {
      s.on = cb.checked;
      outChanged(false);
    };
    const nm = document.createElement("span"), sz = document.createElement("span");
    nm.className = "nm";
    const srcN = outSources().find((q) => q.k === sliceSrc(o, s));
    nm.textContent = s.name;
    sz.className = "sz";
    sz.textContent = "".concat(srcN ? srcN.name.replace(/^(Маска|Общее поле|Нарезка): /, "") + " · " : "").concat(s.iw, "×").concat(s.ih, " → ").concat(scr ? scr.name : "?");
    r.append(cb, nm, sz);
    r.onclick = () => {
      ui_out.sel = s.id;
      o.src = sliceSrc(o, s);
      if (o.view !== "in") o.scr = s.scr;
      refreshOutPanel();
      requestDraw();
    };
    r.oncontextmenu = (e) => {
      e.preventDefault();
      ui_out.sel = s.id;
      o.src = sliceSrc(o, s);
      o.scr = s.scr;
      refreshOutPanel();
      requestDraw();
      showCtx(e.clientX, e.clientY, [
        { label: "Копировать", fn: () => { ui.clipSlice = JSON.parse(JSON.stringify(s)); status("Слайс скопирован", true); } },
        { label: "Вставить", disabled: !ui.clipSlice, fn: () => ctxPasteSlice(o) },
        { label: "Дублировать", fn: () => $("oSlDup").click() },
        { label: s.on ? "Выключить" : "Включить", fn: () => { s.on = !s.on; outChanged(false); } },
        { sep: true },
        { label: "Удалить", danger: true, fn: () => $("oSlDel").click() }
      ]);
    };
    ll.appendChild(r);
  });
  $("oLabels").checked = o.labels;
  fillSelect($("oSlScr"), o.screens.map((s) => s.name));
  fillSelect($("oSlSrc"), outSources().map((s) => s.name));
  syncOutSel();
  updateOutInfo();
}
function syncOutSel() {
  const o = OC(), s = curSlice();
  $("oSlBox").hidden = !s;
  if (!s) return updateOutInfo();
  if (document.activeElement !== $("oSlName")) $("oSlName").value = s.name;
  const srcs = outSources(), si = Math.max(0, srcs.findIndex((q) => q.k === sliceSrc(o, s)));
  $("oSlSrc").value = String(si);
  $("oSlScr").value = String(Math.max(0, o.screens.findIndex((q) => q.id === s.scr)));
  for (const k of ["ix", "iy", "iw", "ih", "ox", "oy"]) if (document.activeElement !== $("oSl_" + k)) $("oSl_" + k).value = s[k];
  const [sw, sh] = sliceOutWH(s);
  if (document.activeElement !== $("oSl_ow")) $("oSl_ow").value = sw;
  if (document.activeElement !== $("oSl_oh")) $("oSl_oh").value = sh;
  $("oSl11").disabled = !sliceScaled(s);
  document.querySelectorAll("#oSlKeep button").forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.k === "1") === (s.keep !== false))));
  document.querySelectorAll("#oSlRot button").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.r === s.rot)));
  if (document.activeElement !== $("oSlRA")) $("oSlRA").value = +(+s.ra || 0).toFixed(2);
  $("oSlFH").setAttribute("aria-pressed", String(s.fh));
  $("oSlFV").setAttribute("aria-pressed", String(s.fv));
  updateOutInfo();
}
function updateOutInfo() {
  const o = OC();
  if (!o) return;
  const S0 = outSrc(o), out = [];
  if (!S0) out.push("<span>Выберите источник: общее поле, нарезку или маску.</span>");
  else {
    out.push("<span>Источник: ".concat(escHtml(S0.name), " · ").concat(S0.w, "×").concat(S0.h, " px</span>"));
    out.push("<span>Слайсов: ".concat(o.slices.length, " · выходов: ").concat(o.screens.length, "</span>"));
    for (const s of o.screens) {
      const list = o.slices.filter((q) => q.on && q.scr === s.id);
      let bad = 0;
      for (const q of list) {
        const [w, h] = sliceOutWH(q);
        if (q.ox < 0 || q.oy < 0 || q.ox + w > s.w || q.oy + h > s.h) bad++;
      }
      let over = 0;
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j], [aw, ah] = sliceOutWH(a), [bw, bh] = sliceOutWH(b);
        if (a.ox < b.ox + bw && b.ox < a.ox + aw && a.oy < b.oy + bh && b.oy < a.oy + ah) over++;
      }
      if (bad) out.push('<span class="warn">'.concat(escHtml(s.name), ": слайсов за краем выхода — ").concat(bad, "</span>"));
      if (over) out.push('<span class="warn">'.concat(escHtml(s.name), ": слайсы накладываются — ").concat(over, "</span>"));
    }
  }
  setHtml($("oInfo"), out.join(""));
  if (o) syncOutComp(o), syncOutLayers(o);
  if (o) {
    const M = outMag(o);
    for (const [id, k] of [["oMagOn", "on"], ["oMagCab", "cab"], ["oMagInSl", "inSl"], ["oMagEdge", "edge"], ["oMagOutSl", "outSl"], ["oMagCenter", "center"], ["oMagGrid", "grid"]]) $(id).checked = M[k];
    if (document.activeElement !== $("oMagStep")) $("oMagStep").value = M.step;
    $("oMagStep").disabled = !M.grid;
    $("oMagThr").value = String(M.thr);
    $("oMagBox").classList.toggle("dim", !M.on);
    for (const el of $("oMagBox").querySelectorAll("input,select")) if (el.id !== "oMagStep") el.disabled = !M.on;
  }
  const smi = $("oSmartInfo");
  if (smi) {
    const t = o && o.smartInfo && o.slices.length ? o.smartInfo : "";
    smi.hidden = !t;
    setTxt(smi, t);
  }
}
// ---- кнопки панели
function addOut() {
  const o = freshOut(project.outs.length), srcs = outSources();
  const pref = srcs.find((s) => s.k[0] === "f") || srcs.find((s) => s.k[0] === "c") || srcs[0];
  o.src = pref ? pref.k : "";
  project.outs.push(o);
  project.outCur = project.outs.length - 1;
  ui_out.sel = "";
  ui_out.V = { z: 1, x: 0, y: 0 };
  outChanged(true);
}
$("oAdd").onclick = addOut;
$("oAdd2").onclick = addOut;
$("oDel").onclick = async () => {
  const o = OC();
  if (!o || !await ask("Удалить мэппинг?", "«".concat(o.name, "» будет удалён. Маски останутся в проекте."), "", "Удалить", false)) return;
  project.outs.splice(project.outCur, 1);
  project.outCur = Math.max(0, Math.min(project.outCur, project.outs.length - 1));
  outChanged(true);
};
$("oSel").onchange = (e) => {
  project.outCur = +e.target.value;
  ui_out.sel = "";
  ui_out.V = { z: 1, x: 0, y: 0 };
  refreshOutPanel();
  requestDraw();
};
$("oRename").onclick = async () => {
  const o = OC();
  const v = o && await ask("Название", "", o.name, "OK");
  if (v != null && v.trim()) {
    o.name = v.trim().slice(0, 60);
    outChanged(true);
  }
};
$("oSrc").onchange = (e) => {
  const o = OC();
  // активный источник: что показываем в Input и откуда берут новые слайсы. Существующие слайсы хранят свой источник
  o.src = e.target.value;
  ui_out.V = { z: 1, x: 0, y: 0 };
  outChanged(true);
};
document.querySelectorAll("#oView button").forEach((b) => b.onclick = () => {
  OC().view = b.dataset.v;
  ui_out.V = { z: 1, x: 0, y: 0 };
  outChanged(true);
});
// 2.0.123: «+ Слайс» — как Add Slice в Resolume: кабинеты от левого верхнего угла источника, сколько влезает в выход
function outAddSlice(o, r) {
  const S0 = outSrc(o);
  if (!S0) return status("Сначала выберите источник", true);
  const scr = outScr(o);
  if (!r) {
    // следующий свободный участок источника: правее последнего слайса (или с начала)
    const last = o.slices[o.slices.length - 1];
    let x0 = last ? last.ix + last.iw : 0, y0 = last ? last.iy : 0;
    if (x0 >= S0.w - 1) {
      x0 = 0;
      y0 = last ? last.iy + last.ih : 0;
    }
    if (y0 >= S0.h - 1) y0 = 0;
    r = snapToCells(o, x0, y0, Math.min(S0.w, x0 + scr.w), Math.min(S0.h, y0 + scr.h)) || snapToCells(o, 0, 0, S0.w, S0.h) || { x: 0, y: 0, w: S0.w, h: S0.h };
  }
  const s = { id: newUid(), name: "Slice ".concat(o.slices.length + 1), scr: scr.id, src: o.src, ix: r.x, iy: r.y, iw: r.w, ih: r.h, ox: 0, oy: 0, ow: 0, oh: 0, keep: true, rot: 0, fh: false, fv: false, on: true };
  // на выходе — правее последнего слайса этого выхода, иначе ниже
  const mine = o.slices.filter((q) => q.scr === scr.id);
  let x2 = 0, y2 = 0;
  if (mine.length) {
    const lq = mine[mine.length - 1], [lw] = sliceOutWH(lq);
    x2 = lq.ox + lw;
    y2 = lq.oy;
    if (x2 + s.iw > scr.w) {
      x2 = 0;
      y2 = Math.max(0, ...mine.map((q) => q.oy + sliceOutWH(q)[1]));
    }
  }
  s.ox = x2;
  s.oy = y2;
  if (mine.length && y2 + s.ih > scr.h) {
    // на этом выходе места нет — следующий выход (пустой), при необходимости новый
    let nx = o.screens.slice(o.screens.indexOf(scr) + 1).find((q) => !o.slices.some((z) => z.scr === q.id));
    if (!nx) {
      nx = { id: newUid(), name: "Output ".concat(o.screens.length + 1), w: scr.w, h: scr.h, auto: true };
      o.screens.push(nx);
    }
    s.scr = nx.id;
    s.ox = s.oy = 0;
  }
  o.slices.push(s);
  ui_out.sel = s.id;
  outChanged(true);
  status("Добавлен ".concat(s.name, ": ").concat(s.iw, "×").concat(s.ih, " — тяните за углы или двигайте"), true);
}
$("oAddSlice").onclick = () => outAddSlice(OC());
// 2.0.136: кнопки «Весь источник / По маскам / По рядам / По столбцам» убраны по просьбе (outAutoSlices остаётся)
$("oPack").onclick = () => {
  outPack(OC());
  outChanged(true);
};
$("oGroup").onclick = () => {
  const o = OC(), cur = curSlice();
  if (!o || !cur) return;
  const ids = /* @__PURE__ */ new Set([cur.id, ...(ui_out.more || [])]);
  const list = o.slices.filter((q) => ids.has(q.id));
  if (list.length < 2) return status("Выберите ещё слайсы: Cmd/Ctrl + клик по слайсу в Input (Shift — диапазон)", true);
  const gid = newUid();
  for (const q of list) q.grp = gid;
  ui_out.more = /* @__PURE__ */ new Set();
  outChanged(true);
  status("Слайсов в группе: " + list.length, true);
};
$("oUngroup").onclick = () => {
  const o = OC(), cur = curSlice();
  if (!o || !cur || !cur.grp) return status("Этот слайс не в группе", true);
  const g = cur.grp, n = o.slices.filter((q) => q.grp === g).length;
  for (const q of o.slices) if (q.grp === g) q.grp = "";
  outChanged(true);
  status("Группа снята, слайсов: " + n, true);
};
for (const [id, k] of [["oMagOn", "magOn"], ["oMagCab", "magCab"], ["oMagInSl", "magInSl"], ["oMagEdge", "magEdge"], ["oMagOutSl", "magOutSl"], ["oMagCenter", "magCenter"], ["oMagGrid", "magGrid"]]) $(id).onchange = () => {
  const o = OC();
  if (!o) return;
  o[k] = $(id).checked;
  outChanged(true);
};
$("oMagStep").oninput = () => {
  const o = OC(), v = Math.round(+String($("oMagStep").value).replace(",", "."));
  if (!o || !(v >= 1)) return;
  o.magStep = Math.min(4096, v);
  outChanged(false);
};
$("oMagThr").onchange = () => {
  const o = OC();
  if (!o) return;
  o.magThr = +$("oMagThr").value;
  outChanged(true);
};
$("oMapSmart").onclick = () => {
  outSmartMap(OC());
  outChanged(true);
};
for (const [id, mode] of [["oMapCab", "cab"], ["oMapRows", "rows"], ["oMapCols", "cols"], ["oMapGroup", "group"], ["oMapScreen", "screen"]]) $(id).onclick = () => {
  outAutoMap(OC(), mode);
  outChanged(true);
};
$("oScrAdd").onclick = () => {
  const o = OC(), s0 = outScr(o), s = { id: newUid(), name: "Output ".concat(o.screens.length + 1), w: s0.w, h: s0.h };
  o.screens.push(s);
  o.scr = s.id;
  outChanged(true);
};
$("oScrDel").onclick = () => {
  const o = OC();
  if (o.screens.length < 2) return status("Должен остаться хотя бы один выход", true);
  const s = outScr(o), i = o.screens.indexOf(s);
  o.screens.splice(i, 1);
  const to = o.screens[Math.max(0, i - 1)];
  for (const q of o.slices) if (q.scr === s.id) q.scr = to.id;
  o.scr = to.id;
  outChanged(true);
};
$("oScrRename").onclick = async () => {
  const s = outScr(OC()), v = await ask("Название выхода", "", s.name, "OK");
  if (v != null && v.trim()) {
    s.name = v.trim().slice(0, 60);
    outChanged(true);
  }
};
for (const [id, k] of [["oScrW", "w"], ["oScrH", "h"]]) {
  $(id).onchange = (e) => {
    outScr(OC())[k] = evenPx(Math.max(16, Math.min(16384, calcNum(e.target.value, outScr(OC())[k]))));
    e.target.value = outScr(OC())[k];
    outChanged(true);
  };
}
for (const el of document.querySelectorAll('#oSlBox input.calc, #oScrW, #oScrH')) el.addEventListener("keydown", (e) => {
  if (e.key === "Enter") el.dispatchEvent(new Event("change"));
});
// 2.0.184: композиция мэппинга
for (const b of document.querySelectorAll("#oCompMode button")) b.onclick = () => {
  const o = OC(), S0 = o && outSrc(o);
  if (!o) return;
  o.compMode = b.dataset.m;
  if (o.compMode === "custom" && S0 && !(+o.compW > 0)) {
    o.compW = S0.w;
    o.compH = S0.h;
  }
  outChanged(true);
};
for (const b of document.querySelectorAll("#oCompFit button")) b.onclick = () => {
  const o = OC();
  if (!o) return;
  o.compFit = b.dataset.f;
  outChanged(true);
};
for (const [id, k] of [["oCompW", "compW"], ["oCompH", "compH"]]) {
  $(id).onchange = (e) => {
    const o = OC(), CM = o && outComp(o);
    if (!CM) return;
    o.compMode = "custom";
    o[k] = Math.max(16, Math.min(16384, Math.round(calcNum(e.target.value, k === "compW" ? CM.W : CM.H))));
    if (!(+o[k === "compW" ? "compH" : "compW"] > 0)) o[k === "compW" ? "compH" : "compW"] = k === "compW" ? CM.H : CM.W;
    outChanged(true);
  };
  $(id).addEventListener("keydown", (e) => {
    if (e.key === "Enter") $(id).dispatchEvent(new Event("change"));
  });
}
$("oCompPreset").onchange = (e) => {
  const v = e.target.value, o = OC();
  e.target.value = "";
  if (!v || !o) return;
  const [w, h] = v.split("x").map(Number);
  Object.assign(o, { compMode: "custom", compW: w, compH: h });
  outChanged(true);
};
// 2.0.185: список масок с галочками (слои Resolume)
function syncOutLayers(o) {
  const box = $("oLayerList");
  if (!box || !o) return;
  // 2.0.187: как в Resolume — Слой 1 внизу стопки, выше — следующие слои; под стопкой — неотмеченные (по порядку проекта)
  const keys = outLayerKeys(o), all = outLayerList(), list = keys.slice().reverse().map((k) => all.find((s) => s.k === k)).concat(all.filter((s) => !keys.includes(s.k)));
  const sig = JSON.stringify([list.map((s) => [s.k, s.name, s.w, s.h]), keys, o.src]);
  if (box._sig !== sig) {
    box._sig = sig;
    box.replaceChildren();
    list.forEach((s, li) => {
      if (li === keys.length && keys.length) {
        const sep = document.createElement("div");
        sep.className = "layer-sep";
        sep.textContent = "Не в мэппинге";
        box.appendChild(sep);
      }
      const row = document.createElement("div"), cb = document.createElement("input"), nm = document.createElement("button"), tag = document.createElement("span");
      row.className = "frow layer-row" + (s.k === o.src ? " cur" : "");
      cb.type = "checkbox";
      cb.checked = keys.includes(s.k);
      cb.setAttribute("aria-label", "Маска для мэппинга: " + s.name);
      cb.onchange = () => {
        // отмеченная маска встаёт последним слоем; снятая — уходит из слоёв
        const ks = outLayerKeys(o).filter((k) => k !== s.k);
        if (cb.checked) ks.push(s.k);
        o.layers = ks.join(",");
        if (cb.checked && !ks.includes(o.src)) o.src = s.k;
        outChanged(true);
      };
      nm.type = "button";
      nm.className = "linkbtn layer-name";
      nm.textContent = s.name.replace(/^Маска: /, "") + " · " + s.w + "×" + s.h;
      nm.title = "Показать во входе";
      nm.onclick = () => {
        o.src = s.k;
        outChanged(true);
      };
      const n = keys.indexOf(s.k) + 1;
      tag.className = "unit layer-tag";
      tag.textContent = n ? "Слой " + n : "—";
      row.append(cb, nm, tag);
      // ▲▼ — переставить слой (только у отмеченных)
      const mv = document.createElement("span");
      mv.className = "layer-mv";
      // как в Resolume: выше в стопке — больший номер слоя
      for (const [t, d, lbl] of [["▲", 1, "Выше — на слой больше"], ["▼", -1, "Ниже — на слой меньше"]]) {
        const bt = document.createElement("button");
        bt.type = "button";
        bt.className = "b sq";
        bt.textContent = t;
        bt.title = lbl;
        bt.setAttribute("aria-label", lbl + ": " + s.name);
        bt.disabled = !n || (d > 0 ? n === keys.length : n === 1);
        bt.onclick = () => outLayerMove(o, s.k, d);
        mv.appendChild(bt);
      }
      mv.style.visibility = n ? "visible" : "hidden";
      row.appendChild(mv);
      box.appendChild(row);
    });
  }
  for (const b of document.querySelectorAll("#oResRoute button")) b.setAttribute("aria-pressed", String(b.dataset.r === outRoute(o)));
}
$("oLayerAll").onclick = () => {
  const o = OC();
  if (!o) return;
  // к уже отмеченным (в их порядке) добавляются остальные маски по порядку проекта
  const had = outLayerKeys(o);
  o.layers = had.concat(outLayerList().filter((s) => s.k[0] === "m" && !had.includes(s.k)).map((s) => s.k)).join(",");
  const ks = outLayerKeys(o);
  if (ks.length && !ks.includes(o.src)) o.src = ks[0];
  outChanged(true);
};
$("oLayerNone").onclick = () => {
  const o = OC();
  if (!o) return;
  o.layers = "";
  outChanged(true);
};
for (const b of document.querySelectorAll("#oResRoute button")) b.onclick = () => {
  const o = OC();
  if (!o) return;
  o.resRoute = b.dataset.r;
  outChanged(true);
};
function syncOutComp(o) {
  const CM = o && outComp(o);
  for (const b of document.querySelectorAll("#oCompMode button")) b.setAttribute("aria-pressed", String(b.dataset.m === (CM ? CM.mode : "auto")));
  for (const b of document.querySelectorAll("#oCompFit button")) b.setAttribute("aria-pressed", String(b.dataset.f === (CM ? CM.fit : "native")));
  $("oCompWHRow").hidden = !(CM && CM.custom);
  if (CM) {
    if (document.activeElement !== $("oCompW")) $("oCompW").value = CM.W;
    if (document.activeElement !== $("oCompH")) $("oCompH").value = CM.H;
  }
  const r1 = (v) => Math.round(v * 100) / 100;
  setTxt($("oCompInfo"), CM ? "Композиция ".concat(CM.W, "×").concat(CM.H).concat(CM.mode === "auto" ? " (авто: наибольшие ширина и высота отмеченных масок)" : "", " · маска ").concat(CM.mw, "×").concat(CM.mh).concat(CM.sx !== 1 || CM.sy !== 1 ? " → " + r1(CM.mw * CM.sx) + "×" + r1(CM.mh * CM.sy) + (CM.sx === CM.sy ? " (×" + r1(CM.sx) + ")" : "") : "", " в точке ").concat(r1(CM.x), ", ").concat(r1(CM.y), ". В Resolume поставьте такой же размер композиции.") : "");
}
$("oScrPreset").onchange = (e) => {
  const v = e.target.value;
  e.target.value = "";
  if (!v) return;
  const [w, h] = v.split("x").map(Number), s = outScr(OC());
  s.w = w;
  s.h = h;
  outChanged(true);
};
$("oLabels").onchange = (e) => {
  OC().labels = e.target.checked;
  outChanged(false);
};
$("oSlName").oninput = (e) => {
  const s = curSlice();
  if (s) {
    s.name = e.target.value.slice(0, 60) || s.name;
    scheduleAutosave();
    requestDraw();
  }
};
$("oSlName").onchange = () => outChanged(true);
$("oSlScr").onchange = (e) => {
  const o = OC(), s = curSlice();
  if (!s) return;
  s.scr = o.screens[+e.target.value].id;
  o.scr = s.scr;
  outChanged(true);
};
// 2.0.154: сменить источник (маску) слайса — с какой маски он берёт участок
$("oSlSrc").onchange = (e) => {
  const o = OC(), s = curSlice(), srcs = outSources(), ns = srcs[+e.target.value];
  if (!s || !ns) return;
  s.src = ns.k;
  // координаты участка подрезаем под размеры новой маски
  s.ix = Math.max(0, Math.min(ns.w - 1, s.ix | 0));
  s.iy = Math.max(0, Math.min(ns.h - 1, s.iy | 0));
  s.iw = Math.max(1, Math.min(ns.w - s.ix, s.iw | 0));
  s.ih = Math.max(1, Math.min(ns.h - s.iy, s.ih | 0));
  // чтобы слайс был виден и редактировался на входе — переключаем активный источник на его маску
  o.src = ns.k;
  $("oSrc").value = ns.k;
  outChanged(true);
};
// 2.0.137: числа в «Мэппинге» можно вводить формулой, как в Resolume: 192*6, 3840/2, (192+8)*4 — без eval
function calcNum(str, fb) {
  const t = String(str == null ? "" : str).replace(/,/g, ".").replace(/[×хx]/gi, "*").replace(/:/g, "/").replace(/\s+/g, "");
  if (!t) return fb;
  let i = 0;
  const num = () => {
    const m = /^\d*\.?\d+/.exec(t.slice(i));
    if (!m) throw 0;
    i += m[0].length;
    return +m[0];
  };
  const atom = () => {
    if (t[i] === "-") return i++, -atom();
    if (t[i] === "+") return i++, atom();
    if (t[i] === "(") {
      i++;
      const v = sum();
      if (t[i++] !== ")") throw 0;
      return v;
    }
    return num();
  };
  const prod = () => {
    let v = atom();
    while (t[i] === "*" || t[i] === "/") v = t[i++] === "*" ? v * atom() : v / atom();
    return v;
  };
  const sum = () => {
    let v = prod();
    while (t[i] === "+" || t[i] === "-") v = t[i++] === "+" ? v + prod() : v - prod();
    return v;
  };
  try {
    const v = sum();
    return i === t.length && isFinite(v) ? Math.round(v) : fb;
  } catch (e) {
    return fb;
  }
}
for (const k of ["ix", "iy", "iw", "ih", "ox", "oy"]) $("oSl_" + k).onchange = (e) => {
  const s = curSlice();
  if (!s) return;
  s[k] = k === "iw" || k === "ih" ? Math.max(1, calcNum(e.target.value, s[k])) : calcNum(e.target.value, s[k]);
  e.target.value = s[k];
  outChanged(true);
};
// 2.0.134: размер на выходе; пропорции — по галочке (по умолчанию сохраняются)
for (const k of ["ow", "oh"]) $("oSl_" + k).onchange = (e) => {
  const s = curSlice();
  if (!s) return;
  const [w, h] = sliceOutWH(s), v = Math.max(1, Math.min(65536, calcNum(e.target.value, k === "ow" ? w : h)));
  if (s.keep !== false) {
    if (k === "ow") {
      s.ow = v;
      s.oh = Math.max(1, Math.round(v * h / w));
    } else {
      s.oh = v;
      s.ow = Math.max(1, Math.round(v * w / h));
    }
  } else {
    s.ow = k === "ow" ? v : w;
    s.oh = k === "oh" ? v : h;
  }
  // 2.0.138: после Enter курсор остаётся в поле — сразу показываем посчитанное значение вместо формулы
  const [nw, nh] = sliceOutWH(s);
  $("oSl_ow").value = nw;
  $("oSl_oh").value = nh;
  outChanged(true);
};
// 2.0.139: пропорции «Выход W × H» — у каждого слайса свои (по умолчанию сохраняются)
document.querySelectorAll("#oSlKeep button").forEach((b) => b.onclick = () => {
  const s = curSlice();
  if (!s) return;
  s.keep = b.dataset.k === "1";
  outChanged(true);
});
$("oSl11").onclick = () => {
  const s = curSlice();
  if (!s) return;
  s.ow = s.oh = 0;
  outChanged(true);
};
document.querySelectorAll("#oSlRot button").forEach((b) => b.onclick = () => {
  const s = curSlice();
  if (!s) return;
  const r = +b.dataset.r;
  if ((r % 180 !== s.rot % 180) && (s.ow > 0 || s.oh > 0)) [s.ow, s.oh] = [s.oh, s.ow];
  s.rot = r;
  outChanged(true);
});
// 2.0.167: точный угол слайса (не только кратно 90°)
$("oSlRA").addEventListener("input", () => {
  const s = curSlice(), v = parseFloat(String($("oSlRA").value).replace(",", "."));
  if (!s || !isFinite(v)) return;
  sliceRotateTo(OC(), sliceNormA(v));
  outChanged(true);
});
$("oSlRA0").onclick = () => {
  const s = curSlice();
  if (!s || !+s.ra) return;
  sliceRotateTo(OC(), 0);
  outChanged(true);
};
$("oSlFH").onclick = () => {
  const s = curSlice();
  if (s) {
    s.fh = !s.fh;
    outChanged(true);
  }
};
$("oSlFV").onclick = () => {
  const s = curSlice();
  if (s) {
    s.fv = !s.fv;
    outChanged(true);
  }
};
$("oSlDup").onclick = () => {
  const o = OC(), s = curSlice();
  if (!s) return;
  const c = { ...s, id: newUid(), name: s.name + " (копия)", ox: s.ox + 40, oy: s.oy + 40 };
  o.slices.splice(o.slices.indexOf(s) + 1, 0, c);
  ui_out.sel = c.id;
  outChanged(true);
};
$("oSlDel").onclick = () => {
  const o = OC(), s = curSlice();
  if (!s) return;
  o.slices.splice(o.slices.indexOf(s), 1);
  ui_out.sel = "";
  outChanged(true);
};
$("oSlClear").onclick = async () => {
  const o = OC();
  if (!o.slices.length || !await ask("Удалить все слайсы?", "", "", "Удалить", false)) return;
  o.slices = [];
  ui_out.sel = "";
  outChanged(true);
};
async function saveOutPNG(o, scr) {
  busy("Рендер выхода ".concat(scr.name, " ").concat(scr.w, "×").concat(scr.h, "…"));
  await tick();
  return renderOutPNG(o, scr, async (p) => {
    busy("Рендер выхода ".concat(scr.name, "… ").concat(Math.round(p * 100), "%"));
    await tick();
  });
}
const outFileName = (o, scr) => safeName("".concat(scr.w, "x").concat(scr.h, "-").concat(o.name, " ").concat(scr.name), "output").slice(0, 180) + ".png";
// ===== 2.0.182: экспорт мэппинга в Resolume Arena — пресет Advanced Output (.xml) =====
// Формат официально не описан. Элементы и атрибуты — только те, что пишет сама Arena 7.x: сверено с 30 настоящими
// пресетами Arena 7.13–7.26 (у всех корень XmlState, размер композиции — CurrentCompositionTextureSize). Совместимость с 7.0+.
// Выход = Screen (виртуальное устройство с разрешением выхода), слайс = Slice: InputRect — участок композиции,
// OutputRect — место на выходе; поворот — атрибут orientation (радианы) и повёрнутые углы.
function resXmlEsc(t) {
  return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function resNum(v) {
  const r = Math.abs(v) < 1e-9 ? 0 : v;
  return Number.isInteger(r) ? String(r) : String(+r.toFixed(6));
}
// 4 угла прямоугольника w×h с центром (cx, cy), повёрнутого на deg по часовой: левый верхний, правый верхний, правый нижний, левый нижний
function resQuad(cx, cy, w, h, deg) {
  const a = deg * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
  return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([x, y]) => ({ x: cx + x * ca - y * sa, y: cy + x * sa + y * ca }));
}
// idHash устройства = String::hashCode64 из JUCE (h = h * 101 + код символа, 64 бита без знака) от deviceId —
// сверено с 35 настоящими файлами Arena 7.13–7.26. Считаем частями по 16 бит: без BigInt (старый WebKit на Mac).
function resHash64(str) {
  const h = [0, 0, 0, 0]; // младшие 16 бит первыми
  for (const ch of String(str)) {
    let cp = ch.codePointAt(0);
    // JUCE считает по символам UTF-32; суррогатные пары собираются в один символ
    let carry = cp;
    for (let i = 0; i < 4; i++) {
      const v = h[i] * 101 + carry;
      h[i] = v % 65536;
      carry = Math.floor(v / 65536);
    }
  }
  // в десятичную строку: делим 64-битное число на 10, пока не станет нулём
  const d = h.slice(), out = [];
  while (d.some((x) => x)) {
    let rem = 0;
    for (let i = 3; i >= 0; i--) {
      const v = rem * 65536 + d[i];
      d[i] = Math.floor(v / 10);
      rem = v % 10;
    }
    out.push(rem);
  }
  return out.length ? out.reverse().join("") : "0";
}
function resVerts(pts, ind) {
  return pts.map((p) => ind + '<v x="' + resNum(p.x) + '" y="' + resNum(p.y) + '"/>').join("\n");
}
// код источника «слой» в Input Source слайса Resolume 7: «3:N» — слой N (слой 1 — нижний). Взято из настоящих пресетов
// (слайс «Camera» = 3:24) и проекта phosphor; в Arena 5/6 «3:N» были экраны. Проверочный пресет: outResolumeLayerTest().
const RES_LAYER_CODE = 3;
// куда смотрят слайсы в Resolume: "layers" — слой своей маски (по умолчанию), "comp" — вся композиция
const outRoute = (o) => o.resRoute === "comp" ? "comp" : "layers";
function outResolumeXml(o) {
  const S0 = outSrc(o);
  if (!S0) return null;
  // 2.0.185: выгружаются слайсы всех отмеченных масок (или активного источника, если не отмечено ничего).
  // «Слои»: слайс берёт в Resolume слой своей маски (первая отмеченная — Слой 1); «Композиция» — всю композицию.
  const keys = outAutoKeys(o), all = o.slices.filter((sl) => keys.includes(sliceSrc(o, sl))), other = o.slices.length - all.length;
  const CM = outComp(o, keys[0]), byLayer = outRoute(o) === "layers";
  let id = Date.now();
  const T = (k) => "\t".repeat(k);
  const screens = o.screens.map((scr) => {
    const list = all.filter((sl) => sl.scr === scr.id), sid = id++;
    const slices = list.map((sl) => {
      const [ow, oh] = sliceOutWH(sl), r90 = sl.rot === 90 || sl.rot === 270;
      // участок на композиции: углы участка на маске переносятся на композицию (сдвиг и масштаб своей маски)
      const sk = sliceSrc(o, sl), CMs = outComp(o, sk) || CM;
      const inQ = resQuad(sl.ix + sl.iw / 2, sl.iy + sl.ih / 2, sl.iw, sl.ih, +sl.ra || 0).map((q) => compPt(CMs, q.x, q.y));
      const inSrc = byLayer ? RES_LAYER_CODE + ":" + Math.max(1, keys.indexOf(sk) + 1) : "0:1";
      const inA = Math.atan2(inQ[1].y - inQ[0].y, inQ[1].x - inQ[0].x) * 180 / Math.PI;
      // на выходе: контент (до поворота) — ширина и высота до перестановки; поворачиваем вокруг центра места на выходе
      const cw = r90 ? oh : ow, ch = r90 ? ow : oh, outQ = resQuad(sl.ox + ow / 2, sl.oy + oh / 2, cw, ch, +sl.rot || 0);
      // 2.0.182: деформация — в координатах выхода, как в настоящих файлах Arena: Homography src = dst = углы OutputRect,
      // сетка Bezier 4×4 — равномерно внутри этих углов (раньше была от 0,0 — Arena рисовала все слайсы в углу выхода)
      const own = outQ;
      const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      const bez = [];
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
        const top = lerp(outQ[0], outQ[1], c / 3), bot = lerp(outQ[3], outQ[2], c / 3);
        bez.push(lerp(top, bot, r / 3));
      }
      const flip = (sl.fh ? 1 : 0) | (sl.fv ? 2 : 0), nm = resXmlEsc(sl.name || "Slice");
      const rad = (d) => resNum(d * Math.PI / 180);
      return [
        T(4) + '<Slice uniqueId="' + id++ + '">',
        T(5) + '<Params name="Common">',
        T(6) + '<Param name="Name" T="STRING" default="Layer" value="' + nm + '"/>',
        T(6) + '<Param name="Enabled" T="BOOL" default="1" value="' + (sl.on === false ? 0 : 1) + '"/>',
        T(5) + "</Params>",
        T(5) + '<Params name="Input">',
        T(6) + '<ParamChoice name="Input Source" default="0:1" value="' + inSrc + '" storeChoices="0"/>',
        T(5) + "</Params>",
        T(5) + '<Params name="Output">',
        T(6) + '<Param name="Flip" T="UINT8" default="0" value="' + flip + '"/>',
        T(5) + "</Params>",
        T(5) + '<InputRect orientation="' + rad(Math.abs(inA) < 1e-9 ? 0 : inA) + '">',
        resVerts(inQ, T(6)),
        T(5) + "</InputRect>",
        T(5) + '<OutputRect orientation="' + rad(+sl.rot || 0) + '">',
        resVerts(outQ, T(6)),
        T(5) + "</OutputRect>",
        T(5) + "<Warper>",
        T(6) + '<Params name="Warper">',
        T(7) + '<ParamChoice name="Point Mode" default="PM_LINEAR" value="PM_LINEAR" storeChoices="0"/>',
        T(7) + '<Param name="Flip" T="UINT8" default="0" value="0"/>',
        T(6) + "</Params>",
        T(6) + '<BezierWarper controlWidth="4" controlHeight="4">',
        T(7) + "<vertices>",
        resVerts(bez, T(8)),
        T(7) + "</vertices>",
        T(6) + "</BezierWarper>",
        T(6) + "<Homography>",
        T(7) + "<src>",
        resVerts(own, T(8)),
        T(7) + "</src>",
        T(7) + "<dst>",
        resVerts(own, T(8)),
        T(7) + "</dst>",
        T(6) + "</Homography>",
        T(5) + "</Warper>",
        T(4) + "</Slice>"
      ].join("\n");
    });
    const sn = resXmlEsc(scr.name || "Screen");
    return [
      T(3) + '<Screen name="' + sn + '" uniqueId="' + sid + '">',
      T(4) + '<Params name="Params">',
      T(5) + '<Param name="Name" T="STRING" default="" value="' + sn + '"/>',
      T(5) + '<Param name="Enabled" T="BOOL" default="1" value="1"/>',
      T(5) + '<Param name="Hidden" T="BOOL" default="0" value="0"/>',
      T(4) + "</Params>",
      T(4) + "<guides>",
      T(5) + '<ScreenGuide name="ScreenGuide" type="0"/>',
      T(5) + '<ScreenGuide name="ScreenGuide" type="1"/>',
      T(4) + "</guides>",
      T(4) + "<layers>",
      ...slices,
      T(4) + "</layers>",
      T(4) + "<OutputDevice>",
      // как пишет сама Arena 7.13–7.26: idHash и параметры Width / Height (без них Arena ставит выход 800×600)
      T(5) + '<OutputDeviceVirtual name="' + sn + '" deviceId="Virtual' + sn + '" idHash="' + resHash64("Virtual" + (scr.name || "Screen")) + '" width="' + scr.w + '" height="' + scr.h + '">',
      T(6) + '<Params name="Params">',
      ...[["Width", 800, scr.w], ["Height", 600, scr.h]].flatMap(([pn, def, val]) => [
        T(7) + '<ParamRange name="' + pn + '" T="DOUBLE" default="' + def + '" value="' + val + '">',
        T(8) + '<PhaseSourceStatic name="PhaseSourceStatic" phase="0"/>', // phase есть в 7.13–7.22.0, новые версии его читают
        T(8) + '<BehaviourDouble name="BehaviourDouble"/>',
        T(8) + '<ValueRange name="defaultRange" min="1" max="16384"/>',
        T(8) + '<ValueRange name="minMax" min="1" max="16384"/>',
        T(8) + '<ValueRange name="startStop" min="1" max="16384"/>',
        T(7) + "</ParamRange>"
      ]),
      T(6) + "</Params>",
      T(5) + "</OutputDeviceVirtual>",
      T(4) + "</OutputDevice>",
      T(3) + "</Screen>"
    ].join("\n");
  });
  const name = resXmlEsc(o.name || "LED Mask");
  const xml = ['<?xml version="1.0" encoding="utf-8"?>',
    '<XmlState name="' + name + '">',
    // версия 7.13.2: файл повторяет настоящие пресеты 7.13.2 — их открывают 7.13 и все более новые 7.x
    '\t<versionInfo name="Resolume Arena" majorVersion="7" minorVersion="13" microVersion="2" revision="17774"/>',
    '\t<ScreenSetup name="ScreenSetup">',
    '\t\t<Params name="ScreenSetupParams"/>',
    '\t\t<CurrentCompositionTextureSize width="' + CM.W + '" height="' + CM.H + '"/>',
    "\t\t<screens>",
    ...screens,
    "\t\t</screens>",
    "\t</ScreenSetup>",
    "</XmlState>", ""].join("\n");
  return { xml, slices: all.length, screens: o.screens.length, other, W: CM.W, H: CM.H, layers: byLayer ? keys.length : 0 };
}
$("oResolume").onclick = async () => {
  const o = OC();
  if (!o || !outSrc(o)) return status("Сначала выберите источник", true);
  const r = outResolumeXml(o);
  if (!r.slices) return status("Нет слайсов для выгрузки — разметьте источник", true);
  const ok = await save(safeName(o.name, "Advanced Output") + ".xml", new Blob([r.xml], { type: "application/xml" }));
  if (ok !== false) status("Resolume: ".concat(r.screens, " ").concat(r.screens === 1 ? "выход" : r.screens < 5 ? "выхода" : "выходов", ", слайсов ").concat(r.slices).concat(r.layers ? ", слоёв " + r.layers + " (маска 1 — Слой 1)" : "", ". Размер композиции в Arena — ").concat(r.W, "×").concat(r.H).concat(r.other ? ". Не выгружены слайсы неотмеченных источников: " + r.other : "", "."), true);
};
$("oPNG").onclick = async () => {
  const o = OC();
  if (!o || !outSrc(o)) return status("Сначала выберите источник", true);
  try {
    const scr = outScr(o), r = await saveOutPNG(o, scr);
    busy("");
    await save(outFileName(o, scr), new Blob([r.png], { type: "image/png" }));
  } catch (e) {
    busy("");
    status("Ошибка рендера: " + e.message, true);
  }
};
$("oPNGAll").onclick = async () => {
  const o = OC();
  if (!o || !outSrc(o)) return status("Сначала выберите источник", true);
  try {
    const files = [];
    for (const scr of o.screens) {
      const r = await saveOutPNG(o, scr);
      files.push({ name: outFileName(o, scr), data: r.png });
    }
    busy("Упаковка…");
    await tick();
    const z = await zip(files);
    busy("");
    await save(safeName(o.name, "outputs") + ".zip", z);
  } catch (e) {
    busy("");
    status("Ошибка: " + e.message, true);
  }
};
// ---- холст: вид входа (Input Selection) и выхода (Output Transformation)
// 2.0.134: вид «Input + Output» — вход и выход рядом (или друг под другом, что крупнее); у каждой панели своя область холста
// ===== 2.0.184: композиция мэппинга, как в Resolume: маска лежит на композиции =====
// Размер: «как у маски» (по умолчанию) или свой. Как маска лежит на композиции (как клип в Resolume, когда композиция больше):
// native — 1:1 по центру (по умолчанию), stretch — растянуть на всю композицию, fitw — пропорционально по ширине, fith — по высоте.
// Слайсы хранятся в координатах маски; на композиции точка (x, y) маски = (cx + x * sx, cy + y * sy).
const COMP_FITS = ["native", "stretch", "fitw", "fith"];
function outComp(o, key) {
  const all = outSources(), S0 = all.find((s) => s.k === (key || o.src));
  if (!S0) return null;
  // размер композиции (одна на все слои): «Как у маски» — как активная маска; «Авто» — ширина = самая большая ширина,
  // высота = самая большая высота среди отмеченных масок (ничего не отмечено — как активная); «Свой» — вписанный
  const act = all.find((s) => s.k === o.src) || S0, lk = outLayerKeys(o).map((k) => all.find((s) => s.k === k)).filter(Boolean), base = lk.length ? lk : [act];
  // 2.0.189: по умолчанию «Авто»
  const mode = ["mask", "auto", "custom"].includes(o.compMode) ? o.compMode : "auto", custom = mode === "custom", fit = COMP_FITS.includes(o.compFit) ? o.compFit : "native";
  const bw = mode === "auto" ? Math.max(...base.map((q) => q.w)) : act.w, bh = mode === "auto" ? Math.max(...base.map((q) => q.h)) : act.h;
  const W = custom ? Math.max(16, Math.min(16384, Math.round(+o.compW || bw))) : bw;
  const H = custom ? Math.max(16, Math.min(16384, Math.round(+o.compH || bh))) : bh;
  let sx = 1, sy = 1;
  if (fit === "stretch") sx = W / S0.w, sy = H / S0.h;
  else if (fit === "fitw") sx = sy = W / S0.w;
  else if (fit === "fith") sx = sy = H / S0.h;
  const mw = S0.w * sx, mh = S0.h * sy;
  // 1:1 — целые пиксели (пиксель в пиксель), иначе — точно по центру
  const x = fit === "native" ? Math.round((W - mw) / 2) : (W - mw) / 2, y = fit === "native" ? Math.round((H - mh) / 2) : (H - mh) / 2;
  return { W, H, x, y, sx, sy, mw: S0.w, mh: S0.h, custom, mode, fit };
}
// точка маски -> точка композиции
const compPt = (CM, px, py) => ({ x: CM.x + px * CM.sx, y: CM.y + py * CM.sy });
function outPanes(o) {
  const R = $("wrap").getBoundingClientRect(), V = ui_out.V, S0 = outSrc(o), scr = outScr(o), cap = 18;
  const CM = outComp(o), dims = (v) => v === "in" ? [CM ? CM.W : 1920, CM ? CM.H : 1080] : [scr.w, scr.h];
  const pad = R.width < 600 ? 16 : 40, views = o.view === "both" ? ["in", "out"] : [o.view];
  const fit = (box, v) => {
    const [W, H] = dims(v), k0 = Math.max(1e-4, Math.min((box.w - pad * 2) / W, (box.h - pad * 2 - cap) / H)), k = k0 * V.z;
    // на входе: W×H — композиция (масштаб kc), маска лежит на ней в (mx, my) с масштабом sx × sy.
    // k — масштаб МАСКИ на экране (всё, что рисуется и щёлкается на входе, — в координатах маски), ry = sy / sx.
    const isIn = v === "in" && CM, sx = isIn ? CM.sx : 1, sy = isIn ? CM.sy : 1;
    return { v, box, W, H, k: k * sx, kc: k, ry: sy / sx, k0, R, mx: isIn ? CM.x : 0, my: isIn ? CM.y : 0, MW: isIn ? CM.mw : W, MH: isIn ? CM.mh : H,
      ox: box.x + (box.w - W * k) / 2 + V.x, oy: box.y + (box.h - cap - H * k) / 2 + V.y };
  };
  if (views.length === 1) return [fit({ x: 0, y: 0, w: R.width, h: R.height }, views[0])];
  const side = [fit({ x: 0, y: 0, w: R.width / 2, h: R.height }, "in"), fit({ x: R.width / 2, y: 0, w: R.width / 2, h: R.height }, "out")];
  const stack = [fit({ x: 0, y: 0, w: R.width, h: R.height / 2 }, "in"), fit({ x: 0, y: R.height / 2, w: R.width, h: R.height / 2 }, "out")];
  const sc = (a) => Math.min(a[0].k0 * a[0].W * a[0].H, a[1].k0 * a[1].W * a[1].H) * Math.min(a[0].k0, a[1].k0);
  return sc(side) >= sc(stack) ? side : stack;
}
const outPaneAt = (px, py) => (ui_out.L || []).find((P) => px >= P.box.x && px <= P.box.x + P.box.w && py >= P.box.y && py <= P.box.y + P.box.h) || (ui_out.L || [])[0];
function drawOutPane(c, o, P, srcOf) {
  c.save();
  c.beginPath();
  c.rect(P.box.x, P.box.y, P.box.w, P.box.h);
  c.clip();
  c.translate(P.ox, P.oy);
  if (P.v === "in") {
    const srcC = srcOf(o.src);
    // композиция: тёмное поле с рамкой; маска лежит на ней со сдвигом (mx, my)
    c.fillStyle = "#0b0d10";
    c.fillRect(0, 0, P.W * P.kc, P.H * P.kc);
    c.strokeStyle = "rgba(255,255,255,0.35)";
    c.lineWidth = 1;
    c.strokeRect(-0.5, -0.5, P.W * P.kc + 1, P.H * P.kc + 1);
    // маска на композиции: сдвиг и (при «растянуть») разный масштаб по высоте
    c.translate(P.mx * P.kc, P.my * P.kc);
    if (P.ry !== 1) c.scale(1, P.ry);
    c.fillStyle = "#000";
    c.fillRect(0, 0, P.MW * P.k, P.MH * P.k);
    if (srcC) c.drawImage(srcC.cv, 0, 0, P.MW * P.k, P.MH * P.k);
    // слайсы на входе — только те, что с активного источника (у остальных координаты в другой маске)
    o.slices.filter((s) => sliceSrc(o, s) === o.src).forEach((s) => {
      const cur = o.slices.find((q) => q.id === ui_out.sel);
      const sel = s.id === ui_out.sel || !!(ui_out.more && ui_out.more.has(s.id)) || !!(cur && cur.grp && s.grp === cur.grp);
      const scrI = o.screens.findIndex((q) => q.id === s.scr);
      // 2.0.167: слайс с точным углом показываем повёрнутой рамкой — так видно, что участок берётся под углом
      const ra = +s.ra || 0;
      c.save();
      if (ra) {
        c.translate((s.ix + s.iw / 2) * P.k, (s.iy + s.ih / 2) * P.k);
        c.rotate(ra * Math.PI / 180);
        c.translate(-(s.ix + s.iw / 2) * P.k, -(s.iy + s.ih / 2) * P.k);
      }
      c.fillStyle = sel ? "rgba(25,197,181,0.28)" : "rgba(25,197,181,0.12)";
      c.fillRect(s.ix * P.k, s.iy * P.k, s.iw * P.k, s.ih * P.k);
      c.strokeStyle = sel ? "#19C5B5" : "rgba(25,197,181,0.8)";
      c.lineWidth = sel ? 2.5 : 1.2;
      c.strokeRect(s.ix * P.k + 0.5, s.iy * P.k + 0.5, s.iw * P.k - 1, s.ih * P.k - 1);
      c.restore();
      if (s.iw * P.k > 40) pill(c, "".concat(s.name, " → ").concat(o.screens[scrI] ? o.screens[scrI].name : "?"), s.ix * P.k + 4, s.iy * P.k + 4, 11, "left", "rgba(0,0,0,0.7)", s.on ? "#fff" : "#888", s.iw * P.k - 8);
      if (sel) {
        c.fillStyle = "#19C5B5";
        for (const [hx, hy] of [[s.ix, s.iy], [s.ix + s.iw, s.iy], [s.ix, s.iy + s.ih], [s.ix + s.iw, s.iy + s.ih]]) c.fillRect(hx * P.k - 5, hy * P.k - 5, 10, 10);
      }
    });
    {
      // 2.0.174: ручка поворота — одна на выбранный слайс или на весь блок (группа / несколько слайсов)
      const rb = sliceRotInfo(o, P.k);
      if (rb && sliceSrc(o, curSlice()) === o.src) {
        c.save();
        if (rb.mem.length > 1) {
          c.setLineDash([6, 5]);
          c.strokeStyle = "rgba(25,197,107,0.7)";
          c.lineWidth = 1;
          c.beginPath();
          c.arc(rb.px * P.k, rb.py * P.k, rb.R * P.k, 0, Math.PI * 2);
          c.stroke();
          c.setLineDash([]);
          c.fillStyle = "#19C56B";
          c.beginPath();
          c.arc(rb.px * P.k, rb.py * P.k, 3, 0, Math.PI * 2);
          c.fill();
        }
        c.strokeStyle = "#19C56B";
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(rb.bx * P.k, rb.by * P.k);
        c.lineTo(rb.hx * P.k, rb.hy * P.k);
        c.stroke();
        c.fillStyle = "#19C56B";
        c.beginPath();
        c.arc(rb.hx * P.k, rb.hy * P.k, 6, 0, Math.PI * 2);
        c.fill();
        c.restore();
      }
    }
    const d = ui_out.drag;
    if (d && d.kind === "new" && d.snap) {
      c.strokeStyle = "#FFD54A";
      c.setLineDash([6, 4]);
      c.lineWidth = 2;
      c.strokeRect(d.snap.x * P.k, d.snap.y * P.k, d.snap.w * P.k, d.snap.h * P.k);
      c.setLineDash([]);
    }
  } else {
    const scr = outScr(o);
    paintOutScreen(c, o, scr, P.k, srcOf, true);
    const s = curSlice();
    if (s && s.scr === scr.id) {
      const [w, h] = sliceOutWH(s);
      c.strokeStyle = "#19C5B5";
      c.lineWidth = 2.5;
      c.strokeRect(s.ox * P.k, s.oy * P.k, w * P.k, h * P.k);
      c.fillStyle = "#19C5B5";
      for (const [hx, hy] of [[s.ox, s.oy], [s.ox + w, s.oy], [s.ox, s.oy + h], [s.ox + w, s.oy + h]]) c.fillRect(hx * P.k - 5, hy * P.k - 5, 10, 10);
    }
    c.strokeStyle = "rgba(255,255,255,0.4)";
    c.lineWidth = 1;
    c.strokeRect(-0.5, -0.5, scr.w * P.k + 1, scr.h * P.k + 1);
  }
  c.restore();
  c.fillStyle = "#8c9bab";
  c.font = "12px ".concat(FONT);
  const scr = outScr(o), both = o.view === "both";
  const CMt = outComp(o), compT = CMt && (CMt.W !== CMt.mw || CMt.H !== CMt.mh) ? " · композиция ".concat(CMt.W, "×").concat(CMt.H) : "";
  const t = P.v === "in" ? both ? "Input Selection — " + (outSrc(o) ? outSrc(o).name : "источник") + compT : "Input Selection — протяните мышью по кабинетам, чтобы выделить слайс" : both ? "Output Transformation — ".concat(scr.name, " ").concat(scr.w, "×").concat(scr.h) : "Output Transformation — ".concat(scr.name, " ").concat(scr.w, "×").concat(scr.h, " · двигайте слайсы, углы выбранного — размер");
  c.save();
  c.beginPath();
  c.rect(P.box.x, P.box.y, P.box.w, P.box.h);
  c.clip();
  c.fillText(t, P.box.x + 12, P.box.y + P.box.h - 8);
  c.restore();
  if (both && P.v === "out") {
    c.strokeStyle = "rgba(255,255,255,0.12)";
    c.lineWidth = 1;
    c.beginPath();
    if (P.box.x > 0) {
      c.moveTo(P.box.x + 0.5, 0);
      c.lineTo(P.box.x + 0.5, P.box.y + P.box.h);
    } else {
      c.moveTo(0, P.box.y + 0.5);
      c.lineTo(P.box.x + P.box.w, P.box.y + 0.5);
    }
    c.stroke();
  }
}
function drawOut() {
  const o = OC();
  const R = prepCanvas([16, 9]), c = pctx;
  if (!o) {
    c.fillStyle = "#8c9bab";
    c.font = "15px ".concat(FONT);
    c.textAlign = "center";
    c.fillText("Нажмите «+ Мэппинг», чтобы разложить маски по выходам — как Advanced Output в Resolume", R.width / 2, R.height / 2);
    c.textAlign = "left";
    return;
  }
  const panes = ui_out.L = outPanes(o), srcOf = outSrcFactory(4096);
  for (const P of panes) drawOutPane(c, o, P, srcOf);
}
function outPt(e, P) {
  const p = local(e);
  P = P || outPaneAt(p[0], p[1]);
  // на входе — координаты маски (композиция сдвигает маску на mx, my)
  const kc = P.kc || P.k, ry = P.ry || 1;
  return [(p[0] - P.ox - (P.mx || 0) * kc) / P.k, (p[1] - P.oy - (P.my || 0) * kc) / (P.k * ry), p[0], p[1], P];
}
// угол прямоугольника [x, y, w, h] под курсором: [правый?, нижний?] или null
function outCornerR(r, x, y, k) {
  for (const cx of [0, 1]) for (const cy of [0, 1]) if (Math.abs(x - (r[0] + cx * r[2])) * k < 9 && Math.abs(y - (r[1] + cy * r[3])) * k < 9) return [cx, cy];
  return null;
}
// 2.0.168: группы слайсов — слайсы одной группы выбираются и двигаются вместе
const sliceGroup = (o, s) => !s ? [] : s.grp ? o.slices.filter((q) => q.grp === s.grp) : [s];
const sliceRect = (s, v) => v === "in" ? [s.ix, s.iy, s.iw, s.ih] : [s.ox, s.oy, ...sliceOutWH(s)];
function outCorner(s, x, y, k, v, o) {
  if (!s) return null;
  if (v !== "in" && s.scr !== outScr(o).id) return null;
  return outCornerR(sliceRect(s, v || "in"), x, y, k);
}
function outHit(o, x, y, v) {
  if ((v || o.view) === "in") {
    for (let i = o.slices.length - 1; i >= 0; i--) {
      const s = o.slices[i];
      if (sliceSrc(o, s) !== o.src) continue;
      if (x >= s.ix && x <= s.ix + s.iw && y >= s.iy && y <= s.iy + s.ih) return s;
    }
    return null;
  }
  const scr = outScr(o);
  for (let i = o.slices.length - 1; i >= 0; i--) {
    const s = o.slices[i], [w, h] = sliceOutWH(s);
    if (s.scr === scr.id && x >= s.ox && x <= s.ox + w && y >= s.oy && y <= s.oy + h) return s;
  }
  return null;
}
// края выхода и других слайсов на нём — для привязки
function outSnapLines(o, s) {
  const scr = outScr(o), M = outMag(o), X = M.edge ? [0, scr.w] : [], Y = M.edge ? [0, scr.h] : [];
  if (M.outSl) for (const q of o.slices) if (q !== s && q.scr === scr.id) {
    const [qw, qh] = sliceOutWH(q);
    X.push(q.ox, q.ox + qw);
    Y.push(q.oy, q.oy + qh);
  }
  return [X, Y];
}
// 2.0.181: настройки магнита мэппинга (хранятся в самом мэппинге плоскими полями, чтобы сохранялись в проекте)
function outMag(o) {
  const b = (v, d) => typeof v === "boolean" ? v : d;
  const step = Math.max(1, Math.min(4096, Math.round(+o.magStep || 16))), thr = [5, 10, 20].includes(+o.magThr) ? +o.magThr : 10;
  return { on: b(o.magOn, true), cab: b(o.magCab, true), inSl: b(o.magInSl, false), edge: b(o.magEdge, true), outSl: b(o.magOutSl, true), center: b(o.magCenter, false), grid: b(o.magGrid, false), step, thr };
}
// привязка по одной оси: левый (верхний) край, правый (нижний) край или центр слайса — к ближайшей линии в пределах порога
function magAxis(v, len, lines, centers, step, thr) {
  let b = v, bd = thr;
  const tryC = (c) => {
    if (Math.abs(c - v) < bd) {
      bd = Math.abs(c - v);
      b = c;
    }
  };
  for (const t of lines) {
    tryC(t);
    tryC(t - len);
  }
  for (const t of centers) tryC(t - len / 2);
  if (step) {
    tryC(Math.round(v / step) * step);
    tryC(Math.round((v + len) / step) * step - len);
  }
  return Math.round(b);
}
function magPoint(v, lines, step, thr) {
  return magAxis(v, 0, lines, [], step, thr);
}
// линии на входе: края других слайсов того же источника
function outInLines(o, s) {
  const X = [], Y = [];
  for (const q of o.slices) if (q !== s && sliceSrc(o, q) === o.src && !(+q.ra)) {
    X.push(q.ix, q.ix + q.iw);
    Y.push(q.iy, q.iy + q.ih);
  }
  return [X, Y];
}
const snapNear = (v, arr, thr) => {
  let b = v, bd = thr;
  for (const t of arr) if (Math.abs(t - v) < bd) {
    bd = Math.abs(t - v);
    b = t;
  }
  return b;
};
// 2.0.174: выбранные слайсы (с их группами) двигаются и вращаются как один блок
function outSelSlices(o) {
  const cur = curSlice(), ids = new Set([ui_out.sel, ...ui_out.more || []].filter(Boolean)), gs = new Set();
  for (const q of o.slices) if (ids.has(q.id) && q.grp) gs.add(q.grp);
  return o.slices.filter((q) => (ids.has(q.id) || q.grp && gs.has(q.grp)) && sliceSrc(o, q) === o.src || q === cur);
}
const sliceNormA = (v) => Math.round((((v + 180) % 360 + 360) % 360 - 180) * 100) / 100;
// зелёная ручка поворота выбранного слайса / блока на входе (как у кабинетов кольца); блок крутится вокруг общего центра
function sliceRotInfo(o, k) {
  const cur = curSlice();
  if (!cur || cur.on === false) return null;
  const mem = outSelSlices(o), n = mem.length;
  const px = mem.reduce((t, q) => t + q.ix + q.iw / 2, 0) / n, py = mem.reduce((t, q) => t + q.iy + q.ih / 2, 0) / n;
  let R = cur.ih / 2;
  if (n > 1) {
    R = 0;
    for (const q of mem) {
      const a = (+q.ra || 0) * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), qx = q.ix + q.iw / 2 - px, qy = q.iy + q.ih / 2 - py;
      for (const [ux, uy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const rx = ux * q.iw / 2, ry = uy * q.ih / 2;
        R = Math.max(R, Math.hypot(qx + rx * ca - ry * sa, qy + rx * sa + ry * ca));
      }
    }
  }
  const a = (+cur.ra || 0) * Math.PI / 180, d = R + 18 / k;
  return { mem, px, py, R, hx: px + Math.sin(a) * d, hy: py - Math.cos(a) * d, bx: px + Math.sin(a) * R, by: py - Math.cos(a) * R };
}
// повернуть блок слайсов на T градусов вокруг точки (px, py): центры уезжают по дуге, углы ra прибавляются
function sliceRotApply(items, px, py, T) {
  const cs = Math.cos(T * Math.PI / 180), sn = Math.sin(T * Math.PI / 180);
  for (const m of items) {
    const rx = m.cx - px, ry = m.cy - py;
    m.q.ix = Math.round(px + rx * cs - ry * sn - m.q.iw / 2);
    m.q.iy = Math.round(py + rx * sn + ry * cs - m.q.ih / 2);
    m.q.ra = sliceNormA(m.ra + T);
  }
}
function sliceRotateTo(o, ra) {
  const s = curSlice();
  if (!s) return;
  const rb = sliceRotInfo(o, 1);
  if (!rb) return;
  sliceRotApply(rb.mem.map((q) => ({ q, cx: q.ix + q.iw / 2, cy: q.iy + q.ih / 2, ra: +q.ra || 0 })), rb.px, rb.py, ra - (+s.ra || 0));
}
function outPointer(e, type) {
  const o = OC();
  if (!o || !ui_out.L) return;
  const d0 = ui_out.drag, [x, y, px, py, P] = outPt(e, d0 && d0.P), v = P.v;
  if (type === "down") {
    pv.setPointerCapture(e.pointerId);
    ui_out.focus = v;
    if (e.button === 1 || e.button === 2 || e.altKey) {
      ui_out.drag = { kind: "pan", P, px, py, x0: ui_out.V.x, y0: ui_out.V.y };
      return;
    }
    const s = curSlice();
    if (s && v === "in" && s.on !== false) {
      const rb = sliceRotInfo(o, P.k);
      if (rb && Math.hypot(x - rb.hx, y - rb.hy) <= 11 / P.k) {
        ui_out.drag = { kind: "srot", P, s, cx: rb.px, cy: rb.py, a0: +s.ra || 0, mem: rb.mem.map((q) => ({ q, cx: q.ix + q.iw / 2, cy: q.iy + q.ih / 2, ra: +q.ra || 0 })) };
        return;
      }
    }
    const cn = outCorner(s, x, y, P.k, v, o);
    if (cn) {
      // тянем угол: противоположный угол остаётся на месте
      const r = sliceRect(s, v);
      ui_out.drag = { kind: v === "in" ? "resize" : "oresize", P, s, ax: cn[0] ? r[0] : r[0] + r[2], ay: cn[1] ? r[1] : r[1] + r[3], ar: r[2] / r[3] };
      return;
    }
    const h = outHit(o, x, y, v);
    if (h && e.shiftKey && ui_out.sel && ui_out.sel !== h.id) {
      // 2.0.174: как в Keynote — Shift + клик выделяет все слайсы между выбранным и тем, по которому кликнули
      const list = o.slices.filter((q) => sliceSrc(o, q) === o.src), i0 = list.findIndex((q) => q.id === ui_out.sel), i1 = list.findIndex((q) => q.id === h.id);
      if (i0 >= 0 && i1 >= 0) {
        ui_out.more = new Set(list.slice(Math.min(i0, i1), Math.max(i0, i1) + 1).map((q) => q.id));
        ui_out.more.delete(ui_out.sel);
        refreshOutPanel();
        requestDraw();
        return;
      }
    }
    if (h && (e.ctrlKey || e.metaKey)) {
      // Cmd/Ctrl + клик — добавить слайс к выбору или убрать (для группировки)
      ui_out.more = ui_out.more || /* @__PURE__ */ new Set();
      if (h.id === ui_out.sel) return;
      if (ui_out.more.has(h.id)) ui_out.more.delete(h.id);
      else ui_out.more.add(h.id);
      refreshOutPanel();
      requestDraw();
      return;
    }
    if (h) {
      if (!(ui_out.more && ui_out.more.has(h.id))) ui_out.more = /* @__PURE__ */ new Set();
      ui_out.sel = h.id;
      if (sliceSrc(o, h) !== o.src) { o.src = sliceSrc(o, h); requestDraw(); }
      const grp = outSelSlices(o).includes(h) ? outSelSlices(o) : sliceGroup(o, h);
      ui_out.drag = { kind: "move", P, s: h, px: x, py: y, a: v === "in" ? [h.ix, h.iy] : [h.ox, h.oy], moved: false,
        grp: grp.map((q) => ({ q, ax: v === "in" ? q.ix : q.ox, ay: v === "in" ? q.iy : q.oy })) };
      refreshOutPanel();
    } else if (v === "in") {
      ui_out.drag = { kind: "new", P, x0: x, y0: y, snap: null };
    } else {
      ui_out.sel = "";
      ui_out.drag = { kind: "pan", P, px, py, x0: ui_out.V.x, y0: ui_out.V.y };
      refreshOutPanel();
    }
    requestDraw();
    return;
  }
  const d = ui_out.drag;
  if (type === "move") {
    if (!d) {
      const h = outHit(o, x, y, v), cn = outCorner(curSlice(), x, y, P.k, v, o);
      pv.style.cursor = cn ? cn[0] === cn[1] ? "nwse-resize" : "nesw-resize" : h ? "move" : v === "in" ? "crosshair" : "grab";
      return;
    }
    if (d.kind === "srot") {
      let deg = Math.atan2(x - d.cx, d.cy - y) * 180 / Math.PI;
      if (e.shiftKey) deg = Math.round(deg / 15) * 15;
      // блок слайсов крутится целиком вокруг общего центра; один слайс — вокруг себя
      sliceRotApply(d.mem, d.cx, d.cy, deg - d.a0);
      outChanged(true);
      return;
    }
    if (d.kind === "pan") {
      ui_out.V.x = d.x0 + px - d.px;
      ui_out.V.y = d.y0 + py - d.py;
    } else if (d.kind === "new") d.snap = outInRect(o, d.x0, d.y0, x, y, e, P, null);
    else if (d.kind === "resize") {
      const r = outInRect(o, d.ax, d.ay, x, y, e, P, d.s);
      if (r) Object.assign(d.s, { ix: r.x, iy: r.y, iw: r.w, ih: r.h });
      syncOutSel();
    } else if (d.kind === "oresize") {
      // размер на выходе: углы прилипают к краям выхода и других слайсов (Alt — без привязки), Shift — без пропорций
      const M = outMag(o), free = e.altKey || !M.on, thr = M.thr / P.k, [X, Y] = outSnapLines(o, d.s), scr = outScr(o);
      const st = M.grid ? M.step : 0, CX = M.center ? [scr.w / 2] : [], CY = M.center ? [scr.h / 2] : [];
      let nx = free ? Math.round(x) : magPoint(Math.round(x), X.concat(CX), st, thr), ny = free ? Math.round(y) : magPoint(Math.round(y), Y.concat(CY), st, thr);
      let w = Math.max(1, Math.abs(nx - d.ax)), h = Math.max(1, Math.abs(ny - d.ay));
      if (!e.shiftKey && d.s.keep !== false) {
        if (w / h > d.ar) h = Math.max(1, Math.round(w / d.ar));
        else w = Math.max(1, Math.round(h * d.ar));
        nx = d.ax + (x < d.ax ? -w : w);
        ny = d.ay + (y < d.ay ? -h : h);
      }
      Object.assign(d.s, { ox: Math.min(nx, d.ax), oy: Math.min(ny, d.ay), ow: w, oh: h });
      syncOutSel();
    } else if (d.kind === "move") {
      let nx = Math.round(d.a[0] + x - d.px), ny = Math.round(d.a[1] + y - d.py);
      if (Math.abs(x - d.px) * P.k + Math.abs(y - d.py) * P.k > 3) d.moved = true;
      if (!d.moved) return;
      const M = outMag(o), free = e.altKey || !M.on, thr = M.thr / P.k;
      if (v === "in") {
        // к краям кабинетов и (если включено) к краям соседних слайсов на входе
        const X = [], Y = [];
        if (M.cab) for (const q of outCells(o)) X.push(q.x, q.x + q.w), Y.push(q.y, q.y + q.h);
        if (M.inSl) {
          const [a, b] = outInLines(o, d.s);
          X.push(...a);
          Y.push(...b);
        }
        d.s.ix = free ? nx : magAxis(nx, d.s.iw, X, [], 0, thr);
        d.s.iy = free ? ny : magAxis(ny, d.s.ih, Y, [], 0, thr);
      } else {
        // к краям выхода, соседним слайсам, центру выхода, сетке
        const [w, h] = sliceOutWH(d.s), [X, Y] = outSnapLines(o, d.s), scr = outScr(o), st = M.grid ? M.step : 0;
        d.s.ox = free ? nx : magAxis(nx, w, X, M.center ? [scr.w / 2] : [], st, thr);
        d.s.oy = free ? ny : magAxis(ny, h, Y, M.center ? [scr.h / 2] : [], st, thr);
      }
      // остальные слайсы группы едут на то же смещение
      if (d.grp && d.grp.length > 1) {
        const dx = (v === "in" ? d.s.ix : d.s.ox) - d.a[0], dy = (v === "in" ? d.s.iy : d.s.oy) - d.a[1];
        for (const g of d.grp) {
          if (g.q === d.s) continue;
          if (v === "in") {
            g.q.ix = Math.round(g.ax + dx);
            g.q.iy = Math.round(g.ay + dy);
          } else {
            g.q.ox = Math.round(g.ax + dx);
            g.q.oy = Math.round(g.ay + dy);
          }
        }
      }
      syncOutSel();
    }
    requestDraw();
    return;
  }
  // up
  ui_out.drag = null;
  if (!d) return;
  if (d.kind === "new") {
    if (d.snap) outAddSlice(o, d.snap);
    else requestDraw();
    return;
  }
  if (d.kind === "move" || d.kind === "resize" || d.kind === "oresize") outChanged(true);
}
pv.addEventListener("wheel", (e) => {
  if (ui.page !== "out") return;
  e.preventDefault();
  const V = ui_out.V, p = local(e), P = outPaneAt(p[0], p[1]);
  if (!P) return;
  const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
  const z = Math.max(1, Math.min(40, V.z * Math.max(0.5, Math.min(2, Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0018))))));
  // точка под курсором остаётся на месте
  const kc = P.kc || P.k, ux = (p[0] - P.ox) / kc, uy = (p[1] - P.oy) / kc, k1 = P.k0 * z;
  V.z = z;
  const cx0 = P.box.x + (P.box.w - P.W * k1) / 2, cy0 = P.box.y + (P.box.h - 18 - P.H * k1) / 2;
  V.x = p[0] - ux * k1 - cx0;
  V.y = p[1] - uy * k1 - cy0;
  if (z === 1) V.x = V.y = 0;
  requestDraw();
}, { passive: false });
// ===== 2.0.155: контекстное меню (ПКМ) — копировать / вставить / дублировать / удалить и т.д. =====
let ctxEl = null;
function closeCtx() {
  if (ctxEl) {
    ctxEl.remove();
    ctxEl = null;
  }
}
function showCtx(cx, cy, items) {
  closeCtx();
  items = (items || []).filter(Boolean);
  if (!items.length) return;
  const m = document.createElement("div");
  m.className = "ctxmenu";
  for (const it of items) {
    if (it.sep) {
      const s = document.createElement("div");
      s.className = "ctx-sep";
      m.appendChild(s);
      continue;
    }
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ctx-it" + (it.danger ? " danger" : "");
    b.textContent = it.label;
    if (it.disabled) b.disabled = true;
    else b.addEventListener("click", (ev) => {
      ev.stopPropagation();
      closeCtx();
      it.fn();
    });
    m.appendChild(b);
  }
  document.body.appendChild(m);
  ctxEl = m;
  const r = m.getBoundingClientRect();
  m.style.left = Math.max(4, Math.min(cx, innerWidth - r.width - 6)) + "px";
  m.style.top = Math.max(4, Math.min(cy, innerHeight - r.height - 6)) + "px";
}
document.addEventListener("pointerdown", (e) => {
  if (ctxEl && !ctxEl.contains(e.target)) closeCtx();
}, true);
window.addEventListener("blur", closeCtx);
window.addEventListener("resize", closeCtx);
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeCtx();
});
pv.addEventListener("contextmenu", (e) => {
  if (ui.page === "out") {
    e.preventDefault();
    ctxOut(e);
  } else if (ui.page === "mask") {
    e.preventDefault();
    ctxMask(e);
  }
});
// ---- ПКМ в мэппинге: слайсы
function ctxOut(e) {
  const o = OC();
  if (!o) return;
  const [x, y, , , P] = outPt(e), v = P && o.view === "both" ? P.v : o.view;
  const s = outHit(o, x, y, v) || curSlice();
  const items = [];
  if (s) {
    ui_out.sel = s.id;
    o.src = sliceSrc(o, s);
    if (v !== "in") o.scr = s.scr;
    refreshOutPanel();
    requestDraw();
    items.push(
      { label: "Копировать", fn: () => { ui.clipSlice = JSON.parse(JSON.stringify(s)); status("Слайс скопирован", true); } },
      { label: "Дублировать", fn: () => $("oSlDup").click() },
      { label: s.on ? "Выключить" : "Включить", fn: () => { s.on = !s.on; outChanged(false); } },
      { sep: true },
      { label: "Повернуть 90°", fn: () => { s.rot = ((s.rot || 0) + 90) % 360; outChanged(true); } },
      { label: "Отразить ↔", fn: () => { s.fh = !s.fh; outChanged(true); } },
      { label: "Отразить ↕", fn: () => { s.fv = !s.fv; outChanged(true); } },
      { sep: true }
    );
  }
  items.push({ label: "Вставить слайс", disabled: !ui.clipSlice, fn: () => ctxPasteSlice(o) });
  if (s) items.push({ sep: true }, { label: "Удалить", danger: true, fn: () => $("oSlDel").click() });
  showCtx(e.clientX, e.clientY, items);
}
function ctxPasteSlice(o) {
  if (!ui.clipSlice) return;
  const scr = outScr(o), c = { ...ui.clipSlice, id: newUid(), name: ui.clipSlice.name + " (вставка)", scr: scr.id, ox: (ui.clipSlice.ox | 0) + 40, oy: (ui.clipSlice.oy | 0) + 40 };
  o.slices.push(c);
  ui_out.sel = c.id;
  outChanged(true);
  status("Слайс вставлен", true);
}
// ---- ПКМ на холсте масок: текст или кабинеты
function ctxMask(e) {
  const [x, y] = local(e), st = S();
  if (!L || !st) return;
  const th = textHoverAt(x, y, e);
  if (th && th.k[0] === "l") return ctxText(e, +th.k.slice(1));
  // кабинеты (только LED)
  if (st.kind && st.kind !== "led") return;
  const cell = pointToCell(x, y);
  if (cell && !ui.selected.has(key(...cell)) && !ui.selected.size) ui.selected.add(key(...cell));
  else if (cell && !ui.selected.size) ui.selected.add(key(...cell));
  const sel = [...ui.selected];
  const items = [];
  if (sel.length) {
    const anyBlack = sel.some((k) => st.blackCabinets.includes(k)), anyShift = st.cabShift && sel.some((k) => st.cabShift[k]);
    items.push(
      { label: "Гасить (выключить) — ".concat(sel.length), fn: () => { for (const k of sel) applyBlack(k, true); changed(false); } },
      { label: "Вернуть (включить)", disabled: !anyBlack, fn: () => { for (const k of sel) applyBlack(k, false); changed(false); } }
    );
    if (anyShift || sel.some((k) => st.cabRot && st.cabRot[k])) items.push({ label: "Сбросить смещение и поворот", fn: () => { for (const k of sel) { if (st.cabShift) delete st.cabShift[k]; if (st.cabRot) delete st.cabRot[k]; } changed({ forcePhys: true }); } });
    items.push({ sep: true });
  }
  items.push(
    { label: "Выделить все кабинеты", fn: () => { ui.selected.clear(); for (let r = 0; r < st.cabRows; r++) for (let c = 0; c < st.cabCols; c++) ui.selected.add(key(c, r)); changed(false); } },
    { label: "Снять выделение", disabled: !ui.selected.size, fn: () => clearSelection() }
  );
  changed(false);
  showCtx(e.clientX, e.clientY, items);
}
// ---- ПКМ на дополнительном тексте
function ctxText(e, i) {
  const st = S();
  if (!st.extraLabels || !st.extraLabels[i]) return;
  ui.selLabel = i;
  ui.textMode = i + 1;
  if (ui.selMore) clearSelMore();
  if ($("activeText")) $("activeText").value = i + 1;
  changed(false);
  showCtx(e.clientX, e.clientY, [
    { label: "Изменить текст", fn: () => $("btnEditText").click() },
    { label: "Копировать", fn: () => { ui.textClip = { uid: st.uid, list: JSON.parse(JSON.stringify([st.extraLabels[i]])) }; status("Текст скопирован", true); } },
    { label: "Вставить", disabled: !ui.textClip, fn: () => pasteTexts(ui.textClip.list, ui.textClip.uid === st.uid) },
    { label: "Дублировать", fn: () => $("btnCopyText").click() },
    { sep: true },
    { label: "Удалить", danger: true, fn: () => $("btnDelText").click() }
  ]);
}
window.addEventListener("keydown", (e) => {
  if (ui.page !== "out" || !$("modal").hidden) return;
  const t = e.target;
  if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && t.type !== "checkbox" || t.isContentEditable)) return;
  const o = OC(), s = curSlice();
  if (e.key === "Escape") {
    ui_out.V = { z: 1, x: 0, y: 0 };
    requestDraw();
    return;
  }
  if (!o || !s) return;
  if (e.key === "Delete" || e.key === "Backspace") {
    e.preventDefault();
    $("oSlDel").click();
    return;
  }
  const d = e.shiftKey ? 10 : 1, mv = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }[e.key];
  if (!mv || e.ctrlKey || e.metaKey) return;
  e.preventDefault();
  if (o.view === "in" || o.view === "both" && ui_out.focus === "in") {
    s.ix += mv[0];
    s.iy += mv[1];
  } else {
    s.ox += mv[0];
    s.oy += mv[1];
  }
  outChanged(false);
});
document.querySelectorAll(".seg.pages button").forEach((b) => b.onclick = () => setPage(b.dataset.page));
$("fAll").onclick = () => {
  project.screens.forEach((st) => {
    if (!CF().items.some((q) => q.uid === st.uid)) placeAtRight(st.uid);
  });
  FV.fitted = false;
  fieldChanged(true);
};
$("fRow").onclick = () => arrange(true);
$("fCol").onclick = () => arrange(false);
$("fClear").onclick = () => {
  CF().items = [];
  fld.sel = null;
  fieldChanged(true);
};
$("fMagnet").onchange = (e) => {
  ui.magnet = e.target.checked;
};
$("fTitle").onchange = (e) => {
  CF().title.on = e.target.checked;
  fieldChanged(false);
};
$("fMeters").onchange = (e) => {
  CF().title.meters = e.target.checked;
  fieldChanged(false);
};
$("fTitleSize").addEventListener("change", (e) => {
  CF().title.size = +e.target.value;
  fieldChanged(false);
});
function fieldTitleStep(delta) {
  const f = CF(), rs = fieldRects(f), b = fieldBBox(rs);
  if (!b) return;
  const cur = fieldTitleLines(f, rs, b, 1)[0][1], target = Math.min(900, Math.max(6, cur + delta));
  let best = 1, bd = Infinity;
  for (let i = 1; i < INSC.length; i++) {
    const d = Math.abs(pfloat(INSC[i]) - target);
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  f.title.size = best;
  $("fTitleSize").value = best;
  fieldChanged(false);
}
$("fTitleMinus").onclick = () => fieldTitleStep(-10);
$("fTitlePlus").onclick = () => fieldTitleStep(10);
$("fTitleCenter").onclick = () => {
  CF().title.x = 0;
  CF().title.y = 0;
  fieldChanged(false);
  status("Надпись поля — по центру");
};
$("fRotCCW").onclick = () => rotateSel(-45);
$("fRotCW").onclick = () => rotateSel(45);
$("fRot0").onclick = () => rotateSel(null);
// 2.0.173: свой угол поворота маски на поле (−180…180°, плюс — по часовой)
$("fRotIn").addEventListener("input", () => {
  const v = parseFloat(String($("fRotIn").value).replace(",", "."));
  if (isFinite(v)) rotateSel(0, v);
});
$("fSel").addEventListener("change", (e) => {
  const k = +e.target.value;
  if (!(k >= 0 && k < project.fields.length) || k === project.fieldCur) return;
  project.fieldCur = k;
  fld.sel = null;
  FV.fitted = false;
  refreshFieldPanel();
  requestDraw();
});
$("fAdd2").onclick = () => $("fAdd").click();
$("fAdd").onclick = () => {
  project.fields.push(freshField(project.fields.length));
  project.fieldCur = project.fields.length - 1;
  fld.sel = null;
  FV.fitted = false;
  fieldChanged(true);
};
// 2.0.91: порядок слоёв выбранной маски на поле
function fieldZ(to) {
  const f = CF(), i = f.items.findIndex((q) => q.uid === fld.sel);
  if (i < 0) return;
  const [it] = f.items.splice(i, 1), n = f.items.length;
  const j = to === "top" ? n : to === "bottom" ? 0 : to === "up" ? Math.min(n, i + 1) : Math.max(0, i - 1);
  f.items.splice(j, 0, it);
  fieldChanged(true);
}
$("fZTop").onclick = () => fieldZ("top");
$("fZUp").onclick = () => fieldZ("up");
$("fZDown").onclick = () => fieldZ("down");
$("fZBottom").onclick = () => fieldZ("bottom");
$("fStack").addEventListener("change", (e) => {
  CF().stack = e.target.checked;
  fieldChanged(true);
});
$("mFile").addEventListener("input", (e) => {
  const st = S(), v = e.target.value.trim();
  st.file = v === (st.name || "screen") ? "" : v;
  scheduleAutosave();
});
$("mFile").addEventListener("change", (e) => {
  const st = S(), v = e.target.value.trim();
  st.file = v === (st.name || "screen") ? "" : v;
  e.target.value = maskFileTail(st);
  scheduleAutosave();
});
$("fFile").addEventListener("input", (e) => {
  const v = e.target.value.trim();
  CF().file = v === fieldFileAuto(CF()) ? "" : v;
  scheduleAutosave();
});
$("fFile").addEventListener("change", (e) => {
  const f = CF(), v = e.target.value.trim();
  f.file = v === fieldFileAuto(f) ? "" : v;
  e.target.value = f.file || fieldFileAuto(f);
  scheduleAutosave();
});
$("fRename").onclick = async () => {
  const f = CF(), t = await ask("Название поля", "Оно же — вторая строка надписи поля и подпись в ТЗ.", f.name, "Сохранить");
  if (t == null) return;
  f.name = t.trim() || f.name;
  fieldChanged(true);
};
$("fDelete").onclick = async () => {
  if (project.fields.length <= 1) return;
  const f = CF(), ok = await ask("Удалить поле?", "«".concat(f.name, "» будет удалено. Экраны останутся в проекте."), "", "Удалить", false);
  if (!ok) return;
  project.fields.splice(project.fieldCur, 1);
  project.fieldCur = Math.max(0, project.fieldCur - 1);
  fld.sel = null;
  FV.fitted = false;
  fieldChanged(true);
};
$("fSelPick").addEventListener("change", (e) => {
  fld.sel = e.target.value || null;
  requestDraw();
  updateFieldInfo();
});
for (const [id, k] of [["fCX", "x"], ["fCY", "y"]]) $(id).addEventListener("input", () => {
  const it = selItem(), r = fieldRects().find((q) => q.uid === fld.sel);
  if (!it || !r) return;
  const v = parseInt($(id).value, 10);
  if (isNaN(v)) return;
  it[k] += v - Math.round(k === "x" ? r.x + r.w / 2 : r.y + r.h / 2);
  fieldChanged(false);
});
for (const [id, k] of [["fX", "x"], ["fY", "y"]]) $(id).addEventListener("input", () => {
  const it = selItem();
  if (!it) return;
  const v = parseInt($(id).value, 10);
  if (isNaN(v)) return;
  it[k] = v;
  fieldChanged(false);
});
$("fzFit").onclick = () => {
  fitField();
  requestDraw();
};
$("fzPlus").onclick = () => {
  const r = $("wrap").getBoundingClientRect();
  zoomFieldAt(FV.s * 1.25, r.width / 2, r.height / 2);
};
$("fzMinus").onclick = () => {
  const r = $("wrap").getBoundingClientRect();
  zoomFieldAt(FV.s / 1.25, r.width / 2, r.height / 2);
};
$("fPNG").onclick = async () => {
  const f = CF(), b = fieldBBox(fieldRects());
  if (!b) {
    status("Сначала поставьте экраны на поле", true);
    return;
  }
  busy("Рендер поля ".concat(b.w, "×").concat(b.h, "…"));
  await tick();
  try {
    const r = await renderFieldPNG(f, async (p) => {
      busy("Рендер поля ".concat(b.w, "×").concat(b.h, "… ").concat(Math.round(p * 100), "%"));
      await tick();
    });
    busy("");
    await save("".concat(fieldFileBase(f), ".png"), new Blob([r.png], { type: "image/png" }));
  } catch (e) {
    busy("");
    status("Ошибка рендера: " + e.message, true);
  }
};
ui.images = [];
function fieldInfo(f) {
  const rs = fieldRects(f), b = fieldBBox(rs);
  if (!b) return null;
  const ph = fieldPhys(rs, b);
  return { w: b.w, h: b.h, label: "".concat(b.w, "×").concat(b.h, "  |  ").concat(f.name).concat(ph && f.title.meters ? "  |  ".concat(compactM(ph.w), "х").concat(compactM(ph.h), " м") : "") };
}
const inAnyField = (uid) => project.fields.some((f) => f.items.some((it) => it.uid === uid));
const tzFieldOn = (f) => {
  var _a;
  return (_a = project.tz.fields[f.id]) != null ? _a : true;
};
const tzMaskOn = (st) => {
  var _a;
  return (_a = project.tz.masks[st.uid]) != null ? _a : !inAnyField(st.uid) && !inAnyCut(st.uid);
};
// 2.0.126: мэппинг в ТЗ по умолчанию не входит
const tzOutOn = (m) => !!(project.tz.outs || {})[m.id];
// 2.0.118: нарезка в ТЗ по умолчанию входит; маска, которая нарезана, — по умолчанию нет (как маски общих полей)
const tzCutOn = (c) => {
  const m = project.tz.cuts || {};
  return m[c.id] != null ? !!m[c.id] : true;
};
// 2.0.101: порядок масок и общих полей в ТЗ — project.tz.order (ключи «f:id» / «m:uid»), меняется перетаскиванием в списке.
// Новые поля и маски — в конец; по умолчанию сначала поля, потом маски.
function tzOrder() {
  const def = project.fields.map((f) => "f:" + f.id).concat((project.cuts || []).map((c) => "c:" + c.id), project.screens.map((s) => "m:" + s.uid), (project.outs || []).map((o) => "o:" + o.id)), have = new Set(def);
  const ord = (Array.isArray(project.tz.order) ? project.tz.order : []).filter((k, i, a) => have.has(k) && a.indexOf(k) === i), got = new Set(ord);
  return ord.concat(def.filter((k) => !got.has(k))).map((k) => k[0] === "f" ? { k, f: project.fields.find((f) => "f:" + f.id === k) } : k[0] === "c" ? { k, c: project.cuts.find((c) => "c:" + c.id === k) } : k[0] === "o" ? { k, o: project.outs.find((o) => "o:" + o.id === k) } : { k, st: project.screens.find((s) => "m:" + s.uid === k) });
}
function tzItems() {
  const out = [], volOnly = /^Vol/.test(ui.tzTpl);
  const volTz = volOnly, tz = project.tz;
  for (const o of tzOrder()) {
  // 2.0.80: в ТЗ «Волюметрик» — только волюметрики (без LED-масок и общих полей); в Resolume / D3 / MP4 — без волюметриков
  if (o.o) {
    // 2.0.126: мэппинг — каждый выход отдельным листом; по умолчанию выключен
    const m = o.o;
    if (volOnly || !tzOutOn(m) || !outSrc(m)) continue;
    for (const scr of m.screens) {
      if (!m.slices.some((q) => q.on && q.scr === scr.id)) continue;
      out.push({ kind: "out", m, scr, key: "o:" + m.id + ":" + scr.id, name: "".concat(m.name, " · ").concat(scr.name), w: scr.w, h: scr.h, label: "".concat(scr.w, "×").concat(scr.h, "  |  ").concat(m.name, " — ").concat(scr.name) });
    }
    continue;
  }
  if (o.c) {
    // 2.0.118: нарезка — как общее поле (в ТЗ «Волюметрик» не входит)
    const ci = !volOnly && tzCutOn(o.c) && cutInfo(o.c);
    if (ci) out.push({ kind: "cut", c: o.c, key: "c:" + o.c.id, name: o.c.name, ...ci });
    if (ci) {
      // 2.0.174: пример для ТЗ — исходная маска с разметкой и линиями разреза (отдельным файлом не сохраняется)
      const G0 = cutGeom(o.c);
      if (G0) out.push({ kind: "cutsrc", c: o.c, key: "cs:" + o.c.id, name: o.c.name + " — исходник", w: G0.W0, h: G0.H0, label: "".concat(G0.W0, "×").concat(G0.H0, "  |  ").concat(G0.st.name || "screen", " — исходная маска, красным — линии разреза (пример)") });
    }
    continue;
  }
  if (o.f) {
    const f = o.f;
    if (volOnly || !tzFieldOn(f)) continue;
    const fi = fieldInfo(f);
    if (fi) out.push({ kind: "field", f, key: "f:" + f.id, name: f.name, ...fi });
    continue;
  }
  const st = o.st;
  if (tzMaskOn(st)) {
    const [w, h] = dims(st), isVol = st.kind === "vol" && st.vol;
    // 2.0.52: волюметрик попадает только в ТЗ «Волюметрик»; что именно — галочками «Маска», «Коммутация», «3D-вид»
    if (isVol && !volTz) continue;
    if (!isVol && volTz) continue;
    if (!isVol || VOL_MASK_UI && tz.volMask === true) out.push({ kind: "mask", st, key: "m:" + st.uid, name: st.name || "screen", w, h, label: "".concat(w, "×").concat(h, "  |  ").concat(st.name || "screen", "  |  ").concat(physText(st)) });
    if (isVol) {
      const nm = st.name || "volumetric", W2 = 1600;
      // 2.0.58: две схемы — вид сверху с коммутацией и вид снизу (лицевая сторона) без коммутации
      if (tz.volCom !== false) {
        out.push({ kind: "volcom", side: "top", com: true, st, key: "vc:" + st.uid, name: nm + " — коммутация", w: W2, h: volComH(st, W2), label: "Коммутация  |  ".concat(nm, "  |  вид сверху") });
        out.push({ kind: "volcom", side: "bottom", com: false, st, key: "vb:" + st.uid, name: nm + " — вид снизу", w: W2, h: volComH(st, W2), label: "Вид снизу (лицевая сторона)  |  ".concat(nm) });
      }
      if (tz.vol3d !== false) out.push({ kind: "vol3d", st, key: "v3:" + st.uid, name: nm + " — 3D", w: W2, h: VOL3D_H, label: "3D-вид  |  ".concat(nm, "  |  ").concat(physText(st)) });
    }
  }
  }
  return out;
}
const tzImages = () => project.tz.overview ? ui.images : [];
// 2.0.68: под 3D-видом в ТЗ — текстом вся информация из раздела «Информация» (только волюметрик)
const VOL3D_H = 1200;
function volItemPaint(ctx, it) {
  if (it.kind === "volcom") volComPaint(ctx, it.st, it.w, it.h, { side: it.side, com: it.com });
  else {
    vol3dPaint(ctx, it.st, it.w, it.h, vol3d, true);
  }
}
const volThumbs = /* @__PURE__ */ new Map();
function volItemThumb(it) {
  const k = JSON.stringify(it.st.vol) + it.w + "x" + it.h + (it.kind === "vol3d" ? [vol3d.yaw, vol3d.pitch, vol3d.zoom].join(",") : ""), c = volThumbs.get(it.key);
  if (c && c.k === k) return c.cv;
  const s = Math.min(1, 900 / Math.max(it.w, it.h)), cv = document.createElement("canvas");
  cv.width = Math.round(it.w * s);
  cv.height = Math.round(it.h * s);
  const ctx = cv.getContext("2d");
  ctx.scale(s, s);
  volItemPaint(ctx, it);
  volThumbs.set(it.key, { k, cv });
  return cv;
}
const imgKey = (im) => "img:" + im.id;
function gridOptions(n) {
  const out = [];
  for (let c = 1; c <= n; c++) {
    const r = Math.ceil(n / c);
    if ((c - 1) * r >= n || c * (r - 1) >= n) continue;
    out.push({ cols: c, rows: r });
  }
  return out;
}
function autoGrid(arr, g) {
  let best = null;
  for (const G of gridOptions(g.length)) {
    const cw = (BOX.w - GAP * (G.cols - 1)) / G.cols, ch = (BOX.h - GAP * (G.rows - 1)) / G.rows - LABEL_H - LABEL_GAP;
    let a = 0;
    for (const j of g) {
      const m = arr[j], sc = Math.min(cw / Math.max(1, m.w), ch / Math.max(1, m.h));
      a += m.w * m.h * sc * sc;
    }
    if (!best || a > best.a + 1e-6) best = { ...G, a };
  }
  return { cols: best.cols, rows: best.rows };
}
function groupPer(arr, per, grid2) {
  if (!per) return groupMasks(arr);
  const m = String(grid2 || "").match(/^(\d+)x(\d+)$/), fixed = m && +m[1] * +m[2] >= per ? { cols: +m[1], rows: +m[2] } : null;
  const out = [];
  for (let i = 0; i < arr.length; i += per) {
    const g = [];
    for (let j = i; j < Math.min(arr.length, i + per); j++) g.push(j);
    out.push({ hz: g.length === 1 ? true : fixed || autoGrid(arr, g), g });
  }
  return out;
}
const imgGroups = (imgs) => groupPer(imgs, project.tz.imgPer | 0);
// 2.0.146: своё число масок для отдельных слайдов (project.tz.maskPerS: {индекс слайда масок → число})
function groupMasksPlan(masks) {
  const per = project.tz.maskPer | 0, grid2 = project.tz.maskGrid, perS = project.tz.maskPerS || {};
  if (!per && !Object.keys(perS).length) return groupMasks(masks);
  const out = [];
  let i = 0, s = 0;
  while (i < masks.length) {
    const cnt = perS[s] > 0 ? perS[s] : per;
    if (cnt > 0) {
      const g = [];
      for (let j = i; j < Math.min(masks.length, i + cnt); j++) g.push(j);
      const m = String(perS[s] > 0 ? "" : grid2 || "").match(/^(\d+)x(\d+)$/), fixed = m && +m[1] * +m[2] >= cnt ? { cols: +m[1], rows: +m[2] } : null;
      const orient = new Set(g.map((j) => masks[j].w >= masks[j].h));
      const anyVol = g.some((j) => volExtra(masks[j]));
      const mixed = g.length > 1 && orient.size > 1 && !fixed && !anyVol;
      out.push({ hz: mixed ? { mixed: g.map((j) => ({ w: masks[j].w, h: masks[j].h })) } : g.length === 1 ? true : fixed || autoGrid(masks, g), g });
      i += g.length;
    } else {
      const grp = autoGroupOne(masks, i);
      out.push({ hz: grp.hz, g: grp.g });
      i = grp.next;
    }
    s++;
  }
  return out;
}
const maskGroups = (masks) => groupMasksPlan(masks);
// 2.0.146: общий масштаб для одинаковых по разрешению масок (их размер совпадает на разных слайдах)
function evenScaleMap(groups, items) {
  const map = {};
  if (project.tz.evenSize === false) return map;
  for (const { hz, g } of groups) {
    if (g.length && items[g[0]] && items[g[0]].info) continue;
    g.forEach((mi, j) => {
      const it = items[mi];
      if (!it || it.info) return;
      const lay = maskCellLayout(hz, g.length, j, it.w, it.h, BOX), sc = lay.image[2] / Math.max(1, it.w), key = it.w + "x" + it.h;
      if (map[key] == null || sc < map[key]) map[key] = sc;
    });
  }
  return map;
}
const evenSc = (map, it) => map && !it.info && project.tz.evenSize !== false ? map[it.w + "x" + it.h] || 0 : 0;
function syncTzOrdBtns() {
  const keys = tzOrder().map((o) => o.k), i = keys.indexOf(ui.tzPick);
  $("tOrdTop").disabled = $("tOrdUp").disabled = i <= 0;
  $("tOrdDown").disabled = $("tOrdBottom").disabled = i < 0 || i >= keys.length - 1;
}
function refreshTZPanel() {
  if (ui.page !== "tz") return;
  const tz = project.tz, list = $("tList");
  list.innerHTML = "";
  const row = (text, size, checked, onToggle, cls = "", off = false, key = "") => {
    // 2.0.114: щелчок по строке — выбрать её (для ⤒ ↑ ↓ ⤓), галочка — отдельно
    const r = document.createElement("div");
    r.className = "fitem " + cls + (key && key === ui.tzPick ? " sel" : "");
    if (key) {
      r.dataset.key = key;
      r.title = "Выбрать — потом ↑ ↓, чтобы поменять порядок в ТЗ";
      r.onclick = (e) => {
        if (e.target === cb) return;
        ui.tzPick = ui.tzPick === key ? "" : key;
        for (const x of list.querySelectorAll(".fitem")) x.classList.toggle("sel", !!ui.tzPick && x.dataset.key === ui.tzPick);
        syncTzOrdBtns();
      };
    }
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = checked && !off;
    cb.disabled = off;
    if (off) r.style.opacity = "0.55";
    cb.onclick = (e) => e.stopPropagation();
    cb.onchange = () => {
      onToggle(cb.checked);
      tzChanged();
    };
    const nm = document.createElement("span");
    nm.className = "nm";
    nm.textContent = text;
    const sz = document.createElement("span");
    sz.className = "sz";
    sz.textContent = size;
    r.append(cb, nm, sz);
    list.appendChild(r);
  };
  // 2.0.101: один список в порядке ТЗ
  const volTpl = /^Vol/.test(ui.tzTpl);
  for (const o of tzOrder()) {
    // 2.0.130: в каждом режиме — только его строки
    if (volTpl ? !(o.st && o.st.kind === "vol") : o.st && o.st.kind === "vol") continue;
    if (o.o) {
      const m = o.o, ok = !!outSrc(m), n = m.screens.filter((s) => m.slices.some((q) => q.on && q.scr === s.id)).length;
      row("Мэппинг: ".concat(m.name), !ok ? "нет источника" : volTpl ? "не в ТЗ «Волюметрик»" : "выходов: ".concat(n), tzOutOn(m), (on) => {
        tz.outs = tz.outs || {};
        tz.outs[m.id] = on;
      }, "head", !ok || !n || volTpl, o.k);
    } else if (o.c) {
      const c = o.c, ci = cutInfo(c);
      row(c.name, !ci ? "нет маски" : volTpl ? "не в ТЗ «Волюметрик»" : "".concat(ci.w, "×").concat(ci.h, " · нарезка"), tzCutOn(c), (on) => {
        tz.cuts = tz.cuts || {};
        tz.cuts[c.id] = on;
      }, "head", !ci || volTpl, o.k);
    } else if (o.f) {
      const f = o.f, fi = fieldInfo(f);
      row(f.name, !fi ? "нет экранов" : volTpl ? "не в ТЗ «Волюметрик»" : "".concat(fi.w, "×").concat(fi.h), tzFieldOn(f), (on) => {
        tz.fields[f.id] = on;
      }, "head", !fi || volTpl, o.k);
    } else {
      const st = o.st, [w, h] = dims(st), i = project.screens.indexOf(st), isVol = st.kind === "vol";
      const off = isVol !== volTpl;
      const fl = project.fields.find((f) => f.items.some((it) => it.uid === st.uid));
      row("".concat(i + 1, ". ").concat(st.name || "screen"), off ? isVol ? "только в ТЗ «Волюметрик»" : "не в ТЗ «Волюметрик»" : "".concat(w, "×").concat(h).concat(fl ? " · в поле" : ""), tzMaskOn(st), (on) => {
        tz.masks[st.uid] = on;
      }, "sub", off, o.k);
    }
  }
  syncTzOrdBtns();
  $("tOverview").checked = tz.overview;
  $("tSaveProj").checked = tz.projZip !== false;
  renderImgList();
  const n = ui.images.length;
  const ns = imgGroups(ui.images).length;
  $("tImgPer").value = String(tz.imgPer | 0);
  // 2.0.146: «Масок на слайде» — для всех слайдов или для отдельного слайда масок
  {
    const cnt = maskGroups(tzItems()).length;
    if (ui.tzMaskWhich == null) ui.tzMaskWhich = "all";
    if (ui.tzMaskWhich !== "all" && +ui.tzMaskWhich >= cnt) ui.tzMaskWhich = "all";
    const wsel = $("tMaskWhich");
    let opts = '<option value="all">для всех слайдов</option>';
    for (let i2 = 0; i2 < cnt; i2++) opts += '<option value="'.concat(i2, '">для слайда ').concat(i2 + 1).concat(tz.maskPerS && tz.maskPerS[i2] ? " · " + tz.maskPerS[i2] : "", "</option>");
    if (wsel.dataset.h !== opts) {
      wsel.innerHTML = opts;
      wsel.dataset.h = opts;
    }
    wsel.value = String(ui.tzMaskWhich);
    const all = ui.tzMaskWhich === "all";
    const cur = all ? tz.maskPer | 0 : (tz.maskPerS && tz.maskPerS[+ui.tzMaskWhich]) | 0;
    $("tMaskPer").value = String(cur);
    const n2 = tz.maskPer | 0, gs = $("tMaskGrid");
    $("tMaskGridRow").hidden = !all || n2 < 2;
    gs.innerHTML = '<option value="">Авто — маски крупнее всего</option>' + gridOptions(n2).map((G) => '<option value="'.concat(G.cols, "x").concat(G.rows, '">').concat(G.cols, " по горизонтали × ").concat(G.rows, " по вертикали").concat(G.cols === 1 ? " (столбиком)" : G.rows === 1 ? " (в ряд)" : "", "</option>")).join("");
    gs.value = gridOptions(n2).some((G) => "".concat(G.cols, "x").concat(G.rows) === tz.maskGrid) ? tz.maskGrid : "";
    $("tEvenSize").checked = tz.evenSize !== false;
  }
  $("tOvInfo").textContent = n ? tz.overview ? "Картинок: ".concat(n, " на ").concat(ns, " ").concat(ns === 1 ? "слайде" : "слайдах", " (").concat(ns === 1 ? "слайд 2" : "слайды 2–" + (ns + 1), "), порядок как в списке") : "Картинок: ".concat(n, " — галочка снята, слайды не добавятся") : "Картинок нет — слайды не добавятся.";
  syncTzTpl();
  refreshTZText();
  updateTZSummary();
  updateTZNote();
}
const TZ_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48];
const rgbHex = (c) => {
  if (!c) return null;
  if (c[0] === "#") return c.length === 4 ? ("#" + c[1] + c[1] + c[2] + c[2] + c[3] + c[3]).toUpperCase() : c.slice(0, 7).toUpperCase();
  const m = c.match(/\d+/g);
  return m && m.length >= 3 ? "#" + m.slice(0, 3).map((v) => (+v).toString(16).padStart(2, "0")).join("").toUpperCase() : null;
};
function runsMdS(runs) {
  let out = "", col2 = null, size = null, bold = false;
  for (const r of runs) {
    if (!r.t) continue;
    const c = r.link ? null : hexU(r.color), z = r.sz || null;
    if (c !== col2 || z !== size) {
      if (bold) {
        out += "**";
        bold = false;
      }
      if (size && z !== size) {
        out += "[/s]";
      }
      if (c !== col2) {
        if (col2) out += "[/]";
        if (c) out += "[" + c + "]";
      }
      if (z && z !== size) out += "[s" + z + "]";
      col2 = c;
      size = z;
    }
    if (!!r.b !== bold) {
      out += "**";
      bold = !!r.b;
    }
    out += r.t;
  }
  if (bold) out += "**";
  if (size) out += "[/s]";
  if (col2) out += "[/]";
  return out;
}
const rteBase = () => isReqSel(ui.tzSel) ? (tplCache[selBk()] || {}).baseSz || 10 : NOTE_SZ;
function rteRender(el, paras, base) {
  const esc = (t) => xmlEsc(t);
  el.innerHTML = paras.map((runs) => {
    const inner = runs.map((r) => {
      let h = esc(r.t);
      if (r.b) h = "<b>".concat(h, "</b>");
      if (r.link) h = '<span class="lnk">'.concat(h, "</span>");
      else if (r.color) h = '<font color="'.concat(r.color, '">').concat(h, "</font>");
      if (r.u && !r.link) h = '<span class="u">'.concat(h, "</span>");
      if (r.sz && Math.abs(r.sz - base) > 1e-6) h = '<span data-sz="'.concat(r.sz, '" style="font-size:').concat((13 * r.sz / base).toFixed(1), 'px">').concat(h, "</span>");
      return h;
    }).join("");
    return "<div>".concat(inner || "<br>", "</div>");
  }).join("");
}
function rteRead(el) {
  const lines = [[]];
  const walk = (node, st) => {
    for (const n of node.childNodes) {
      if (n.nodeType === 3) {
        if (n.nodeValue) lines[lines.length - 1].push({ t: n.nodeValue.replace(/ /g, " "), ...st });
        continue;
      }
      if (n.nodeType !== 1) continue;
      const tag = n.tagName;
      if (tag === "BR") {
        if (n.nextSibling || n.parentNode === el) lines.push([]);
        continue;
      }
      const s2 = { ...st };
      if (tag === "B" || tag === "STRONG" || /^(bold|[6-9]00)$/.test(n.style.fontWeight)) s2.b = true;
      if (n.classList.contains("lnk")) s2.color = null;
      else {
        const c = n.getAttribute("color") || n.style && n.style.color;
        if (c) s2.color = rgbHex(c);
      }
      if (n.dataset && n.dataset.sz) s2.sz = +n.dataset.sz;
      const block = tag === "DIV" || tag === "P";
      if (block && lines[lines.length - 1].length) lines.push([]);
      walk(n, s2);
      if (block) lines.push([]);
    }
  };
  walk(el, {});
  if (lines.length > 1 && !lines[lines.length - 1].length) lines.pop();
  return lines.map(runsMdS).join("\n");
}
let rteRange = null;
document.addEventListener("selectionchange", () => {
  const el = document.getElementById("tTxt"), sel = window.getSelection();
  if (el && sel && sel.rangeCount && el.contains(sel.anchorNode)) rteRange = sel.getRangeAt(0).cloneRange();
});
function rteSelect(whole) {
  const el = $("tTxt"), sel = window.getSelection();
  el.focus();
  let r = rteRange && el.contains(rteRange.startContainer) ? rteRange : null;
  if (!r || r.collapsed) {
    if (!whole) {
      status("Сначала выделите текст", true);
      return false;
    }
    r = document.createRange();
    r.selectNodeContents(el);
  }
  sel.removeAllRanges();
  sel.addRange(r);
  return true;
}
function rteDone() {
  $("tTxt").dispatchEvent(new Event("input"));
  const sel = window.getSelection();
  if (sel.rangeCount) rteRange = sel.getRangeAt(0).cloneRange();
}
function rteBar(opts) {
  const bar = document.createElement("div");
  bar.className = "tzbar";
  const btn = (txt, title, fn) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "b";
    b.innerHTML = txt;
    b.title = title;
    b.onmousedown = (e) => e.preventDefault();
    b.onclick = fn;
    bar.appendChild(b);
    return b;
  };
  const W = () => opts.whole();
  btn("<b>Ж</b>", "Жирный", () => {
    if (!rteSelect(W())) return;
    document.execCommand("styleWithCSS", false, false);
    document.execCommand("bold");
    rteDone();
  });
  const ci = document.createElement("input");
  ci.type = "color";
  ci.className = "swatch";
  ci.value = "#e53935";
  ci.title = "Цвет выделенного текста";
  ci.addEventListener("mousedown", () => {
  });
  const applyColor = () => {
    if (!rteSelect(W())) return;
    document.execCommand("styleWithCSS", false, false);
    document.execCommand("foreColor", false, ci.value);
    rteDone();
  };
  ci.addEventListener("input", applyColor);
  ci.addEventListener("change", applyColor);
  bar.appendChild(ci);
  const sz = document.createElement("select");
  sz.title = "Размер выделенного текста";
  sz.style.cssText = "padding:3px 4px;font-size:12.5px";
  sz.innerHTML = '<option value="">Размер</option>' + TZ_SIZES.map((v) => '<option value="'.concat(v, '">').concat(v, " pt</option>")).join("");
  sz.addEventListener("change", () => {
    const v = +sz.value;
    sz.value = "";
    if (!v) return;
    if (!rteSelect(W())) return;
    const el = $("tTxt"), base = rteBase();
    document.execCommand("styleWithCSS", false, false);
    document.execCommand("fontSize", false, "7");
    const made = [];
    el.querySelectorAll('font[size="7"]').forEach((f) => {
      const sp = document.createElement("span");
      sp.dataset.sz = v;
      sp.style.fontSize = (13 * v / base).toFixed(1) + "px";
      if (f.getAttribute("color")) {
        const c = document.createElement("font");
        c.setAttribute("color", f.getAttribute("color"));
        while (f.firstChild) c.appendChild(f.firstChild);
        sp.appendChild(c);
      } else while (f.firstChild) sp.appendChild(f.firstChild);
      sp.querySelectorAll("[data-sz]").forEach((x) => {
        while (x.firstChild) x.parentNode.insertBefore(x.firstChild, x);
        x.remove();
      });
      f.replaceWith(sp);
      made.push(sp);
    });
    if (made.length) {
      const r = document.createRange();
      r.setStartBefore(made[0]);
      r.setEndAfter(made[made.length - 1]);
      const sl = window.getSelection();
      sl.removeAllRanges();
      sl.addRange(r);
    }
    rteDone();
  });
  bar.appendChild(sz);
  btn("Сбросить", "Убрать жирный, цвет и размер у выделенного текста", () => {
    if (!rteSelect(W())) return;
    document.execCommand("removeFormat");
    const el = $("tTxt"), sel = window.getSelection(), r = sel.rangeCount ? sel.getRangeAt(0) : null;
    el.querySelectorAll("[data-sz]").forEach((x) => {
      if (!r || r.intersectsNode(x)) {
        while (x.firstChild) x.parentNode.insertBefore(x.firstChild, x);
        x.remove();
      }
    });
    rteDone();
  });
  return bar;
}
function tzTextSlides() {
  // Слайд 1: каждый текстовый блок шаблона — отдельный пункт; «req» — последний блок (выбран по умолчанию)
  const blocks = tplCache[ui.tzTpl + "@all"];
  const out = blocks ? blocks.map((b, i) => ({ key: i === blocks.length - 1 ? "req" : "req#" + i, title: "Слайд 1 · ".concat(b.title) })) : [{ key: "req", title: "Слайд 1 — требования шаблона ".concat(ui.tzTpl) }];
  const nReq = out.length, items = tzItems(), imgs = tzImages();
  for (const { g } of imgGroups(imgs)) {
    const ims = g.map((j) => imgs[j]);
    out.push({ key: imgKey(ims[0]), title: ims.map((im) => im.caption || "картинка").join(", ") });
  }
  for (const g of maskGroups(items)) {
    const its = g.g.map((i) => items[i]);
    out.push({ key: noteKey(its), title: its.map((i) => i.kind === "field" ? i.f.name : i.name).join(", ") });
  }
  out.forEach((sl, i) => {
    if (i >= nReq) sl.title = "Слайд ".concat(i - nReq + 2, " — ").concat(sl.title);
  });
  return out;
}
ui.tzSel = "req";
const isReqSel = (k) => k === "req" || String(k).startsWith("req#");
const selBk = () => ui.tzTpl + (String(ui.tzSel).startsWith("req#") ? ui.tzSel.slice(3) : "");
const tzSelPk = () => isReqSel(ui.tzSel) ? "req:" + selBk() : "note:" + ui.tzSel;
function refreshTZText() {
  const slides = tzTextSlides(), sel = $("tTxtSel"), ta = $("tTxt");
  if (!slides.some((x) => x.key === ui.tzSel)) ui.tzSel = "req";
  sel.innerHTML = slides.map((x) => '<option value="'.concat(xmlEsc(x.key), '">').concat(xmlEsc(x.title), "</option>")).join("");
  sel.value = ui.tzSel;
  const isReq = isReqSel(ui.tzSel);
  ta.classList.toggle("req", isReq);
  ta.classList.toggle("note", !isReq);
  ta.dataset.ph = isReq ? "" : "Свой текст на этом слайде (необязательно)";
  $("tTxtReset").hidden = !isReq;
  $("tTxtPos").hidden = !tzPos(tzSelPk());
  $("tTxtPos").textContent = isReq ? "Вернуть на место" : "Над масками";
  if (isReq) {
    const tpl = ui.tzTpl, sel0 = ui.tzSel, bk = selBk(), had = !!tplCache[tpl + "@all"];
    $("tTxtReset").disabled = reqText(bk) == null;
    tplBlocks(tpl).then(() => {
      if (!had) return refreshTZText();
      const info = tplCache[bk];
      if (!info || ui.tzTpl !== tpl || ui.tzSel !== sel0 || document.activeElement === ta && ta.dataset.key === "req:" + bk) return;
      rteRender(ta, reqParas(info, reqTextOr(info)), info.baseSz);
      ta.dataset.key = "req:" + bk;
      requestDraw();
    }).catch((e) => {
      ta.value = "";
      status("Шаблон не прочитан: " + e.message, true);
    });
  } else if (document.activeElement !== ta || ta.dataset.key !== ui.tzSel) {
    const t = noteText(ui.tzSel);
    if (t) rteRender(ta, mdParas(t), NOTE_SZ);
    else ta.innerHTML = "";
    ta.dataset.key = ui.tzSel;
  }
}
function selectTZText(key2) {
  if (ui.tzSel === key2) return;
  ui.tzSel = key2;
  $("tTxt").blur();
  rteRange = null;
  refreshTZText();
  requestDraw();
}
$("tTxtSel").addEventListener("change", (e) => selectTZText(e.target.value));
$("tTxt").addEventListener("input", () => {
  const ta = $("tTxt"), v = rteRead(ta);
  if (isReqSel(ui.tzSel)) {
    const label = selBk(), info = tplCache[label];
    if (!info) return;
    if (v.replace(/\r/g, "") === info.md) delete project.tz.req[label];
    else project.tz.req[label] = v;
    $("tTxtReset").disabled = reqText(label) == null;
  } else {
    if (v.trim()) project.tz.notes[ui.tzSel] = v;
    else if (volNoteKey(ui.tzSel)) project.tz.notes[ui.tzSel] = ""; // стёрли «Информацию» — не возвращаем её сами
    else delete project.tz.notes[ui.tzSel];
  }
  requestDraw();
  scheduleAutosave();
  scheduleHistory();
});
$("tTxt").before(rteBar({ whole: () => !isReqSel(ui.tzSel) }));
$("tTxt").addEventListener("paste", (e) => {
  e.preventDefault();
  const t = (e.clipboardData || window.clipboardData).getData("text/plain");
  document.execCommand("insertText", false, t);
});
$("tTxt").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    document.execCommand("insertParagraph");
  }
});
$("tTxtPos").onclick = () => {
  delete project.tz.pos[tzSelPk()];
  $("tTxtPos").hidden = true;
  requestDraw();
  scheduleAutosave();
  scheduleHistory();
};
$("tTxtReset").onclick = () => {
  delete project.tz.req[selBk()];
  const info = tplCache[selBk()];
  if (info) {
    rteRender($("tTxt"), reqParas(info, info.md), info.baseSz);
  }
  $("tTxtReset").disabled = true;
  requestDraw();
  scheduleAutosave();
  scheduleHistory();
  status("Текст блока «" + (info ? info.title : "") + "» — как в шаблоне " + tzName(ui.tzTpl));
};
function renderImgList() {
  const box = $("tImgs");
  box.innerHTML = "";
  ui.images.forEach((im, i) => {
    const r = document.createElement("div");
    r.className = "imgrow";
    const t = document.createElement("img");
    t.src = im.url;
    t.alt = "";
    t.title = "".concat(im.name, " · ").concat(im.w, "×").concat(im.h);
    const cap = document.createElement("input");
    cap.type = "text";
    cap.value = im.caption;
    cap.placeholder = "Подпись над картинкой";
    cap.setAttribute("aria-label", "Подпись картинки " + (i + 1));
    cap.addEventListener("input", () => {
      im.caption = cap.value;
      requestDraw();
      refreshTZText();
    });
    const btn = (txt, title, fn, dis) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "b";
      b.textContent = txt;
      b.title = title;
      b.disabled = !!dis;
      b.onclick = fn;
      return b;
    };
    const move = (d) => {
      const j = i + d;
      [ui.images[i], ui.images[j]] = [ui.images[j], ui.images[i]];
      tzChanged();
    };
    r.append(
      t,
      cap,
      btn("↑", "Выше", () => move(-1), i === 0),
      btn("↓", "Ниже", () => move(1), i === ui.images.length - 1),
      btn("×", "Убрать картинку", () => {
        URL.revokeObjectURL(im.url);
        ui.images.splice(i, 1);
        tzChanged();
      })
    );
    box.appendChild(r);
    const mk = btn("① Расставить номера экранов".concat(im.marks && im.marks.length ? " · " + im.marks.length : ""), "Номера экранов на картинке: жёлтые круги с цифрой, двигаются мышью", () => openMarkEditor(im));
    mk.classList.add("imgmk");
    box.appendChild(mk);
  });
}
// ---- Номера экранов на картинке общего плана: жёлтые круги с цифрой, двигаются мышью ----
// im.marks — [{ n, x, y }] в долях ширины/высоты картинки; im.markR — радиус в долях высоты.
function drawMark(c, x, y, r, n, sel) {
  c.save();
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fillStyle = "#FFF200";
  c.fill();
  c.lineWidth = Math.max(1, r * 0.07);
  c.strokeStyle = "#111";
  c.stroke();
  if (sel) {
    c.beginPath();
    c.arc(x, y, r + Math.max(3, r * 0.18), 0, Math.PI * 2);
    c.strokeStyle = "#1ec8b4";
    c.lineWidth = Math.max(2, r * 0.1);
    c.stroke();
  }
  const t = String(n);
  c.fillStyle = "#111";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.font = "500 ".concat(r * (t.length > 1 ? 0.95 : 1.15), "px Arial, Helvetica, sans-serif");
  c.fillText(t, x, y + r * 0.05);
  c.restore();
}
// Радиус номера в долях высоты картинки: свой (m.r) или общий (im.markR)
const markRad = (im, m) => m && m.r > 0 ? m.r : im.markR || 0.032;
function paintMarks(c, im, W, H, sel) {
  (im.marks || []).forEach((m, i) => drawMark(c, m.x * W, m.y * H, markRad(im, m) * H, m.n, i === sel));
}
// Картинка с впечатанными номерами — в превью ТЗ, PPTX и PDF
async function bakeMarks(im) {
  if (!im.base) return;
  const cv = document.createElement("canvas");
  cv.width = im.w;
  cv.height = im.h;
  const c = cv.getContext("2d");
  c.drawImage(im.base, 0, 0, im.w, im.h);
  paintMarks(c, im, im.w, im.h, -1);
  const blob = await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.92));
  im.jpeg = new Uint8Array(await blob.arrayBuffer());
  URL.revokeObjectURL(im.url);
  im.url = URL.createObjectURL(blob);
  im.img = cv;
}
function openMarkEditor(im) {
  if (!im.base) {
    status("Эту картинку нужно добавить заново", true);
    return;
  }
  im.marks = im.marks || [];
  const ov = document.createElement("div");
  ov.className = "mk";
  ov.innerHTML = '<div class="mk-head"><b>Номера экранов — '.concat(xmlEsc(im.caption || im.name), '</b><p class="hint">Щелчок по картинке — новый номер (следующий). Номера двигаются мышью. Двойной щелчок по номеру — изменить его, следующие новые номера пойдут дальше от него. Выбранный номер: цифры на клавиатуре — сменить номер, + / − или колесо мыши — размер, Delete — удалить.</p></div><div class="mk-wrap"><canvas></canvas></div><div class="mk-foot"><label class="lbl" for="mkR">Размер всех</label><input type="range" id="mkR" min="12" max="90"><span class="unit num" id="mkRV"></span><span class="lbl">Выбранный:</span><button class="b sq" id="mkMinus" title="Меньше (−)">−</button><span class="unit num" id="mkSelV">—</span><button class="b sq" id="mkPlus" title="Больше (+)">+</button><button class="b" id="mkSame" title="Вернуть общий размер">Как у всех</button><button class="b" id="mkDel">Удалить выбранный</button><button class="b" id="mkClear">Убрать все</button><span class="grow"></span><button class="x" id="mkDone">Готово</button></div>');
  document.body.appendChild(ov);
  const cv = ov.querySelector("canvas"), wrap = ov.querySelector(".mk-wrap"), c = cv.getContext("2d");
  let sel = im.marks.length - 1, drag = null, typed = "", typedAt = 0;
  const fit = () => {
    const k = Math.min(1, wrap.clientWidth / im.w, wrap.clientHeight / im.h);
    cv.width = Math.round(im.w * Math.max(k, 0.05) * (window.devicePixelRatio || 1));
    cv.height = Math.round(im.h * Math.max(k, 0.05) * (window.devicePixelRatio || 1));
    cv.style.width = Math.round(im.w * k) + "px";
    cv.style.height = Math.round(im.h * k) + "px";
    draw();
  };
  const draw = () => {
    c.drawImage(im.base, 0, 0, cv.width, cv.height);
    paintMarks(c, im, cv.width, cv.height, sel);
  };
  const syncR = () => {
    ov.querySelector("#mkR").value = Math.round((im.markR || 0.032) * 1000);
    ov.querySelector("#mkRV").textContent = ((im.markR || 0.032) * 200).toFixed(1) + "%";
    const m = im.marks[sel];
    ov.querySelector("#mkSelV").textContent = m ? (markRad(im, m) * 200).toFixed(1) + "%" + (m.r > 0 ? "" : " (общий)") : "—";
    for (const id of ["#mkMinus", "#mkPlus", "#mkSame", "#mkDel"]) ov.querySelector(id).disabled = !m;
  };
  const pos = (e) => {
    const r = cv.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  };
  const hit = (p) => {
    for (let i = im.marks.length - 1; i >= 0; i--) {
      const m = im.marks[i], ry = markRad(im, m), rx = ry * im.h / im.w, dx = (p[0] - m.x) / rx, dy = (p[1] - m.y) / ry;
      if (dx * dx + dy * dy <= 1.2) return i;
    }
    return -1;
  };
  // 2.0.111: после изменения номера двойным щелчком новые номера идут дальше от него (im.markNext)
  const nextN = () => {
    let n = im.markNext > 0 ? im.markNext : 1;
    while (im.marks.some((m) => m.n === n)) n++;
    if (im.markNext > 0) im.markNext = n + 1;
    return n;
  };
  cv.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    cv.setPointerCapture(e.pointerId);
    const p = pos(e);
    let i = hit(p);
    if (i < 0) {
      im.marks.push({ n: nextN(), x: p[0], y: p[1] });
      i = im.marks.length - 1;
    }
    sel = i;
    typed = "";
    drag = { i, dx: im.marks[i].x - p[0], dy: im.marks[i].y - p[1] };
    syncR();
    draw();
  });
  cv.addEventListener("pointermove", (e) => {
    if (!drag) {
      cv.style.cursor = hit(pos(e)) >= 0 ? "move" : "crosshair";
      return;
    }
    const p = pos(e), m = im.marks[drag.i];
    m.x = Math.max(0, Math.min(1, p[0] + drag.dx));
    m.y = Math.max(0, Math.min(1, p[1] + drag.dy));
    draw();
  });
  const up = () => drag = null;
  cv.addEventListener("pointerup", up);
  cv.addEventListener("pointercancel", up);
  cv.addEventListener("dblclick", async (e) => {
    let i = hit(pos(e));
    if (i < 0) return;
    // первый щелчок двойного мог поставить новый номер рядом — его убираем
    const last = im.marks.length - 1;
    if (i !== last && sel === last && im.marks[last] && Math.hypot(im.marks[last].x - pos(e)[0], im.marks[last].y - pos(e)[1]) < 0.01) {
      im.marks.pop();
      if (i > last) i--;
    }
    sel = i;
    drag = null;
    draw();
    const m = im.marks[i], v = await ask("Номер экрана", "Следующие новые номера пойдут дальше от него", String(m.n), "OK");
    if (v == null) return;
    const n = pint(String(v).replace(/\D+/g, ""), 0);
    if (n > 0) {
      m.n = n;
      im.markNext = n + 1;
    }
    syncR();
    draw();
  });
  // размер выбранного номера: шаг 10%, от 1% до 20% высоты картинки (в диаметре — вдвое больше)
  const sizeSel = (f) => {
    const m = im.marks[sel];
    if (!m) return;
    m.r = f === 0 ? 0 : Math.max(0.006, Math.min(0.1, markRad(im, m) * f));
    syncR();
    draw();
  };
  cv.addEventListener("wheel", (e) => {
    const i = hit(pos(e));
    if (i < 0) return;
    e.preventDefault();
    sel = i;
    sizeSel(e.deltaY < 0 ? 1.08 : 1 / 1.08);
  }, { passive: false });
  const delSel = () => {
    if (sel < 0 || !im.marks[sel]) return;
    im.marks.splice(sel, 1);
    sel = Math.min(sel, im.marks.length - 1);
    syncR();
    draw();
  };
  const key = (e) => {
    if (!$("modal").hidden) return;
    if (/^\d$/.test(e.key) && sel >= 0 && im.marks[sel]) {
      // ввод номера цифрами: «1», затем «2» в течение секунды — «12»
      typed = Date.now() - typedAt < 1e3 ? (typed + e.key).slice(-3) : e.key;
      typedAt = Date.now();
      if (+typed > 0) {
        im.marks[sel].n = +typed;
        im.markNext = +typed + 1;
      }
      draw();
      e.preventDefault();
    } else if (e.key === "+" || e.key === "=" || e.key === "-" || e.key === "_") {
      sizeSel(e.key === "+" || e.key === "=" ? 1.1 : 1 / 1.1);
      e.preventDefault();
    } else if (e.key === "Delete" || e.key === "Backspace") {
      delSel();
      e.preventDefault();
    } else if (e.key === "Escape" || e.key === "Enter") {
      e.preventDefault();
      close();
    }
    e.stopPropagation();
  };
  window.addEventListener("keydown", key, true);
  ov.querySelector("#mkMinus").onclick = () => sizeSel(1 / 1.1);
  ov.querySelector("#mkPlus").onclick = () => sizeSel(1.1);
  ov.querySelector("#mkSame").onclick = () => sizeSel(0);
  ov.querySelector("#mkR").addEventListener("input", (e) => {
    im.markR = +e.target.value / 1e3;
    syncR();
    draw();
  });
  ov.querySelector("#mkDel").onclick = delSel;
  ov.querySelector("#mkClear").onclick = () => {
    im.marks = [];
    sel = -1;
    draw();
  };
  const ro = new ResizeObserver(fit);
  ro.observe(wrap);
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    window.removeEventListener("keydown", key, true);
    ro.disconnect();
    ov.remove();
    busy("Номера впечатываются в картинку…");
    await tick();
    await bakeMarks(im);
    busy("");
    renderImgList();
    tzChanged();
    status(im.marks.length ? "Номеров на картинке: ".concat(im.marks.length) : "Номера с картинки убраны", true);
  };
  ov.querySelector("#mkDone").onclick = close;
  syncR();
  fit();
}
function tzSlides(items, withOv) {
  const groups = maskGroups(items);
  return 1 + (withOv || 0) + groups.length;
}
function updateTZSummary() {
  const items = tzItems(), nf = items.filter((i) => i.kind === "field").length, ncs = items.filter((i) => i.kind === "cutsrc").length;
  $("tSummary").textContent = "Слайдов: ".concat(tzSlides(items, imgGroups(tzImages()).length), " · масок: ").concat(items.length - nf - ncs, " · полей: ").concat(nf);
}
function tzChanged() {
  refreshTZPanel();
  requestDraw();
  scheduleAutosave();
}
$("tDefault").onclick = () => {
  project.tz.fields = {};
  project.tz.cuts = {};
  project.tz.outs = {};
  delete project.tz.order;
  project.tz.masks = {};
  tzChanged();
  status("Выбор ТЗ — по умолчанию");
};
$("tOverview").onchange = (e) => {
  project.tz.overview = e.target.checked;
  tzChanged();
};
$("tSaveProj").onchange = (e) => {
  project.tz.projZip = e.target.checked;
  scheduleAutosave();
  updateTZNote();
};
$("tOvPick").onclick = () => $("tOvFile").click();
$("tMaskPer").addEventListener("change", (e) => {
  const v = +e.target.value || 0;
  if (ui.tzMaskWhich === "all") {
    project.tz.maskPer = v;
    const G = project.tz.maskGrid.match(/^(\d+)x(\d+)$/);
    if (G && !gridOptions(project.tz.maskPer).some((o) => o.cols === +G[1] && o.rows === +G[2])) project.tz.maskGrid = "";
  } else {
    project.tz.maskPerS = project.tz.maskPerS || {};
    if (v > 0) project.tz.maskPerS[+ui.tzMaskWhich] = v;
    else delete project.tz.maskPerS[+ui.tzMaskWhich];
  }
  tzChanged();
  scheduleHistory();
});
$("tMaskWhich").addEventListener("change", (e) => {
  ui.tzMaskWhich = e.target.value;
  refreshTZPanel();
});
$("tEvenSize").addEventListener("change", (e) => {
  project.tz.evenSize = e.target.checked;
  tzChanged();
  scheduleHistory();
});
$("tMaskGrid").addEventListener("change", (e) => {
  project.tz.maskGrid = e.target.value;
  tzChanged();
  scheduleHistory();
});
$("tImgPer").addEventListener("change", (e) => {
  project.tz.imgPer = +e.target.value || 0;
  tzChanged();
  scheduleHistory();
});
let ovToken = 0;
async function restoreOverview(list) {
  const tok = ++ovToken;
  for (const q of list) {
    try {
      if (!q) continue;
      let bytes = null;
      if (typeof q.jpeg === "string" && q.jpeg.startsWith("data:image/")) bytes = b64ToBytes(q.jpeg.slice(q.jpeg.indexOf(",") + 1));
      else if (typeof q.ref === "string") {
        const v = await IMGDB.get(q.ref);
        if (tok !== ovToken) return;
        if (v) bytes = v instanceof Uint8Array ? v : new Uint8Array(v);
      }
      if (!bytes || !bytes.length) {
        ui.ovMissing = (ui.ovMissing || 0) + 1;
        continue;
      }
      const blob = new Blob([bytes], { type: "image/jpeg" });
      const bmp = await loadImageFile(blob);
      if (tok !== ovToken) return;
      const w = Math.max(1, +q.w || bmp.width), h = Math.max(1, +q.h || bmp.height), cv = document.createElement("canvas");
      cv.width = w;
      cv.height = h;
      const c = cv.getContext("2d");
      c.fillStyle = "#fff";
      c.fillRect(0, 0, w, h);
      c.drawImage(bmp, 0, 0, w, h);
      const marks = Array.isArray(q.marks) ? q.marks.filter((m) => m && isFinite(+m.x) && isFinite(+m.y)).map((m) => ({ n: pint(m.n, 1), x: +m.x, y: +m.y, ...(+m.r > 0 ? { r: +m.r } : {}) })) : [];
      const im = { id: typeof q.id === "string" && q.id ? q.id : newUid(), name: String(q.name || "картинка.jpg"), caption: String(q.caption != null ? q.caption : "Общий план"), jpeg: bytes, baseJpeg: bytes, w, h, url: URL.createObjectURL(blob), img: bmp, base: cv, marks, markR: +q.markR > 0 ? +q.markR : 0.032 };
      if (marks.length) await bakeMarks(im);
      if (tok !== ovToken) return;
      if (typeof q.ref === "string" && q.ref === ovKey(bytes)) {
        im.ref = q.ref;
        im.refOk = true;
        im.refP = Promise.resolve(true);
      } else ovStore(im);
      ui.images.push(im);
    } catch (e) {
    }
  }
  if (tok !== ovToken) return;
  await Promise.all(ui.images.map((im) => im.refP));
  tzChanged();
}
function clearOverview() {
  ovToken++;
  ui.ovMissing = 0;
  for (const im of ui.images) URL.revokeObjectURL(im.url);
  ui.images = [];
}
$("tOvClear").onclick = () => {
  clearOverview();
  tzChanged();
};
$("tOvFile").addEventListener("change", async (e) => {
  const files = [...e.target.files];
  e.target.value = "";
  if (!files.length) return;
  let bad = 0;
  for (let fi = 0; fi < files.length; fi++) {
    const file = files[fi];
    busy("Подготовка картинки ".concat(fi + 1, " из ").concat(files.length, "…"));
    await tick();
    try {
      const bmp = await loadImageFile(file);
      const k = Math.min(1, 3e3 / Math.max(bmp.width, bmp.height)), w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
      const cv = document.createElement("canvas");
      cv.width = w;
      cv.height = h;
      const c = cv.getContext("2d");
      c.fillStyle = "#fff";
      c.fillRect(0, 0, w, h);
      c.drawImage(bmp, 0, 0, w, h);
      const blob = await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.9));
      const caption = ui.images.length ? file.name.replace(/\.[^.]+$/, "") : "Общий план";
      ui.images.push({ id: newUid(), name: file.name, caption, jpeg: new Uint8Array(await blob.arrayBuffer()), w, h, url: URL.createObjectURL(blob), img: bmp, base: cv, marks: [], markR: 0.032 });
      ui.images[ui.images.length - 1].baseJpeg = ui.images[ui.images.length - 1].jpeg;
      ovStore(ui.images[ui.images.length - 1]);
    } catch (err) {
      bad++;
      status("Не удалось открыть «".concat(file.name, "»: ") + err.message, true);
    }
  }
  project.tz.overview = true;
  busy("");
  tzChanged();
  if (files.length - bad > 0) status("Добавлено картинок: ".concat(files.length - bad), true);
});
async function loadImageFile(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch (e) {
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const im = new Image();
    await new Promise((res, rej) => {
      im.onload = res;
      im.onerror = () => rej(new Error("формат не поддерживается"));
      im.src = url;
    });
    return im;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 5e3);
  }
}
// тип ТЗ: Resolume / D3 / MP4 / Волюметрик (у волюметрика — подтип по длине нити: Vol2 / Vol4 / Vol3)
// подтип ТЗ «Волюметрик» — сам по модели кабинета волюметрика (2 м / 4 м / 3 м); вручную — до смены модели
function volTzAuto() {
  const cur = S(), st = cur && cur.kind === "vol" && cur.vol ? cur : project.screens.find((x) => x.kind === "vol" && x.vol && tzMaskOn(x)) || project.screens.find((x) => x.kind === "vol" && x.vol);
  return st && st.vol.model !== "custom" ? ["Vol2", "Vol4", "Vol3"][st.vol.model] || null : null;
}
function syncTzTpl() {
  if (/^Vol/.test(ui.tzTpl) && !ui.tzSubManual) {
    const a = volTzAuto();
    if (a && a !== ui.tzTpl) {
      ui.tzTpl = a;
      project.tz.tpl = a;
      setTimeout(() => {
        refreshTZText();
        requestDraw();
      }, 0);
    }
  }
  const vol = /^Vol/.test(ui.tzTpl);
  setVal($("tTpl"), vol ? "Vol" : ui.tzTpl);
  if ($("tTplSubRow").hidden !== !vol) $("tTplSubRow").hidden = !vol;
  if (vol) setVal($("tTplSub"), ui.tzTpl);
  setTxt($("tSave"), "Сохранить ТЗ ".concat(tzName(ui.tzTpl)));
  updateTZNote();
  if ($("tVolWhat").hidden !== !vol) $("tVolWhat").hidden = !vol;
  $("tVolMask").checked = project.tz.volMask === true;
  {
    const lb = $("tVolMask").closest("label");
    if (lb && lb.hidden !== !VOL_MASK_UI) lb.hidden = !VOL_MASK_UI;
  }
  $("tVolCom").checked = project.tz.volCom !== false;
  $("tVol3d").checked = project.tz.vol3d !== false;
  $("tVolInfo").checked = project.tz.volInfo !== false;
  if ($("tVolSetRow").hidden !== !vol) $("tVolSetRow").hidden = !vol;
  $("tVolMadrix").checked = adrUnlocked && project.tz.adrMadrix === true;
  $("tVolMadshow").checked = adrUnlocked && project.tz.adrMadshow === true;
  $("tVolTd").checked = adrUnlocked && project.tz.adrTd === true;
  $("tVolSetRow").classList.toggle("locked", !adrUnlocked);
}
function setTzTpl(label) {
  ui.tzTpl = TPL[label] ? label : "Resolume";
  if (!/^Vol/.test(ui.tzTpl)) ui.tzFlatTpl = ui.tzTpl;
  // 2.0.114–2.0.115: тип ТЗ (в том числе «Волюметрик» с подтипом) — в проекте, сохраняется в файл
  if (project.tz.tpl !== ui.tzTpl) {
    project.tz.tpl = ui.tzTpl;
    scheduleAutosave();
  }
  syncTzTpl();
  refreshTZPanel();
  refreshTZText();
  requestDraw();
}
for (const [id, k] of [["tVolMask", "volMask"], ["tVolCom", "volCom"], ["tVol3d", "vol3d"], ["tVolInfo", "volInfo"], ["tVolMadrix", "adrMadrix"], ["tVolMadshow", "adrMadshow"], ["tVolTd", "adrTd"]]) $(id).addEventListener("change", (e) => {
  if (/^adr/.test(k) && !adrUnlocked) {
    e.target.checked = false;
    adrLocked(() => {
      project.tz[k] = e.target.checked = true;
      updateTZNote();
      tzChanged();
    });
    return;
  }
  project.tz[k] = e.target.checked;
  updateTZNote();
  tzChanged();
});
$("tTpl").addEventListener("change", (e) => {
  if (e.target.value !== "Vol") return setTzTpl(e.target.value);
  // подтип по умолчанию — по модели первого экрана-волюметрика
  ui.tzSubManual = false;
  setTzTpl(volTzAuto() || (/^Vol/.test(ui.tzTpl) ? ui.tzTpl : "Vol2"));
});
$("tTplSub").addEventListener("change", (e) => {
  ui.tzSubManual = true;
  setTzTpl(e.target.value);
});
$("tSave").onclick = () => exportTZ(ui.tzTpl);
const bgImgs = {};
function bgImg(key2) {
  if (!bgImgs[key2] && PDF_BG[key2]) {
    const im = new Image();
    im.onload = requestDraw;
    im.src = "data:image/jpeg;base64," + PDF_BG[key2];
    bgImgs[key2] = im;
  }
  return bgImgs[key2] && bgImgs[key2].complete ? bgImgs[key2] : null;
}
ui.tzTpl = "Resolume";
const fieldThumbs = /* @__PURE__ */ new Map();
function fieldThumb(f) {
  const k = JSON.stringify(f) + JSON.stringify(fieldRects(f).map((r) => r.st)) + JSON.stringify(project.guides);
  const c = fieldThumbs.get(f.id);
  if (c && c.k === k) return c.cv;
  const b = fieldBBox(fieldRects(f)), s = Math.min(1, 1200 / Math.max(b.w, b.h)), cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(b.w * s));
  cv.height = Math.max(1, Math.round(b.h * s));
  paintField(cv.getContext("2d"), f, s);
  fieldThumbs.set(f.id, { k, cv });
  return cv;
}
// 2.0.117: масштаб превью ТЗ — колесо мыши / тачпад к курсору, сдвиг — перетащить пустое место, Esc — как было
ui.tzView = { z: 1, x: 0, y: 0 };
function tzLocal(e) {
  const p = local(e), V = ui.tzView;
  return [(p[0] - V.x) / V.z, (p[1] - V.y) / V.z];
}
function tzViewReset() {
  if (ui.tzView.z === 1 && !ui.tzView.x && !ui.tzView.y) return false;
  ui.tzView = { z: 1, x: 0, y: 0 };
  requestDraw();
  return true;
}
function tzViewClamp() {
  const V = ui.tzView, r = $("wrap").getBoundingClientRect();
  if (V.z <= 1) return ui.tzView = { z: 1, x: 0, y: 0 };
  V.x = Math.min(0, Math.max(r.width - r.width * V.z, V.x));
  V.y = Math.min(0, Math.max(r.height - r.height * V.z, V.y));
}
pv.addEventListener("wheel", (e) => {
  if (ui.page !== "tz") return;
  e.preventDefault();
  const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
  if (!dy) return;
  const V = ui.tzView, p = local(e), z = Math.max(1, Math.min(8, V.z * Math.max(0.5, Math.min(2, Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0018))))));
  const ux = (p[0] - V.x) / V.z, uy = (p[1] - V.y) / V.z;
  V.z = z;
  V.x = p[0] - ux * z;
  V.y = p[1] - uy * z;
  tzViewClamp();
  ui.tzHover = null;
  requestDraw();
}, { passive: false });
function drawTZ() {
  const R = prepCanvas([16, 9]), c = pctx, items = tzItems(), imgs = tzImages();
  c.translate(ui.tzView.x, ui.tzView.y);
  c.scale(ui.tzView.z, ui.tzView.z);
  ui.tzHits = [];
  ui.tzSlideHits = [];
  ui.tzImgHits = [];
  const slides = [{ kind: "title" }];
  for (const { hz, g } of imgGroups(imgs)) slides.push({ kind: "ov", hz, ims: g.map((j) => imgs[j]) });
  maskGroups(items).forEach((g, mgi) => slides.push({ kind: "g", mgi, ...g }));
  const emap = evenScaleMap(maskGroups(items), items);
  // 2.0.80: «Крупно» — один лист на всё окно (двойной щелчок по листу, кнопки ◀ ▶, Esc — все листы)
  slides.forEach((sl2, i) => sl2.no = i);
  ui.tzSlideCount = slides.length;
  if (ui.tzZoom >= slides.length) ui.tzZoom = slides.length - 1;
  if (ui.tzZoom >= 0) slides.splice(0, slides.length, slides[ui.tzZoom]);
  syncTzZoomUI();
  const n = slides.length, ar = PDF_W / PDF_H, gap = 14, pad = 16, aw = R.width - pad * 2, ah = R.height - pad * 2 - 16;
  let best = { h: 0, cols: 1 };
  for (let cols2 = 1; cols2 <= n; cols2++) {
    const rows2 = Math.ceil(n / cols2), h = Math.min((ah - gap * (rows2 - 1)) / rows2, (aw - gap * (cols2 - 1)) / cols2 / ar);
    if (h > best.h) best = { h, cols: cols2 };
  }
  const sh = Math.max(40, best.h), sw = sh * ar, cols = best.cols, rows = Math.ceil(n / cols);
  const x0 = pad + (aw - (cols * sw + (cols - 1) * gap)) / 2, y0 = pad + Math.max(0, (ah - (rows * (sh + 16) + (rows - 1) * gap)) / 2);
  const k = sw / SLIDE_W;
  slides.forEach((sl, si) => {
    const x = x0 + si % cols * (sw + gap), y = y0 + Math.floor(si / cols) * (sh + gap + 16);
    const blocks = tplCache[ui.tzTpl + "@all"], editedTitle = sl.kind === "title" && blocks && blocks.some(reqEdited);
    const fullKey = PDF_BG[ui.tzTpl] ? ui.tzTpl : "Resolume";
    const bg = bgImg(sl.kind !== "title" ? bgKey("masks", ui.tzTpl) : editedTitle ? bgKey("bare", ui.tzTpl) : fullKey);
    c.fillStyle = "#fff";
    c.fillRect(x, y, sw, sh);
    if (bg) c.drawImage(bg, x, y, sw, sh);
    const kp = k * PT;
    if (sl.kind === "title" && blocks) {
      const full = editedTitle ? bgImg(fullKey) : null, clips = PDF_CLIPS[ui.tzTpl] || [], selBlock = isReqSel(ui.tzSel) ? selBk() : null;
      for (const info of blocks) {
        const r = reqRect(info), tx = x + (r.x + info.ins.l) * k, ty = y + (r.y + info.ins.t) * k, tw = (r.w - 2 * info.ins.l) / PT;
        const ed = reqEdited(info);
        let th = Math.max(r.h * k, rtLayout(mctxRT, reqParas(info, reqTextOr(info)), tw, info.baseSz).h * kp);
        c.save();
        c.beginPath();
        if (ed) {
          c.rect(x, y, sw, sh);
          c.clip();
          th = rtPaint(c, reqParas(info, reqTextOr(info)), tx, ty, tw, kp, info.baseSz, info.baseColor).h * kp;
        } else if (full) {
          const cr = clips[info.idx] || [info.rect.x, info.rect.y, info.rect.w, info.rect.h];
          c.rect(x + cr[0] * k, y + cr[1] * k, cr[2] * k, cr[3] * k);
          c.clip();
          c.drawImage(full, x, y, sw, sh);
        }
        c.restore();
        if (info.label === selBlock) {
          c.strokeStyle = "rgba(30,200,180,.85)";
          c.lineWidth = 1.5;
          c.strokeRect(tx - 3, ty - 2, tw * kp + 6, th + 4);
        }
        ui.tzHits.push({ pk: "req:" + info.label, x: tx, y: ty, w: tw * kp, h: th, k, ex: r.x, ey: r.y, sx: x, sy: y, sw, sh });
      }
    }
    let NL = { box: BOX, note: null };
    if (sl.kind === "ov") NL = noteLayout(noteText(imgKey(sl.ims[0])), imgKey(sl.ims[0]));
    if (sl.kind === "g") NL = noteLayout(noteText(noteKey(sl.g.map((i) => items[i]))), noteKey(sl.g.map((i) => items[i])));
    const drawNote = () => {
      if (!NL.note) return;
      const [nx, ny, nw, nh] = NL.note.rect;
      c.save();
      c.beginPath();
      c.rect(x, y, sw, sh);
      c.clip();
      rtPaint(c, NL.note.paras, x + nx * k, y + ny * k, nw / PT, kp, NL.note.sz, "#222");
      c.restore();
      const key2 = sl.kind === "ov" ? imgKey(sl.ims[0]) : noteKey(sl.g.map((i) => items[i]));
      ui.tzHits.push({ pk: "note:" + key2, x: x + nx * k, y: y + ny * k, w: nw * k, h: nh * k, k, ex: nx, ey: ny, sx: x, sy: y, sw, sh });
    };
    const cell = (lay, img, text) => {
      const [lx, ly, lw, lh] = lay.label, [ix, iy, iw, ih] = lay.image;
      if (img) c.drawImage(img, x + ix * k, y + iy * k, iw * k, ih * k);
      c.fillStyle = "#222";
      c.font = "".concat(Math.max(3, labelPt(text, lw) * 12700 * k), "px Arial, sans-serif");
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(text, x + (lx + lw / 2) * k, y + (ly + lh / 2) * k, lw * k);
      c.textAlign = "left";
      c.textBaseline = "alphabetic";
    };
    if (sl.kind === "ov") sl.ims.forEach((im, j) => {
      const lay = maskCellLayout(sl.hz, sl.ims.length, j, im.w, im.h, NL.box, null, !!NL.note), [ix, iy, iw, ih] = lay.image;
      cell(lay, im.img, im.caption || "");
      ui.tzImgHits.push({ x: x + ix * k, y: y + iy * k, w: iw * k, h: ih * k, im });
    });
    if (sl.kind === "g") sl.g.forEach((mi, j) => {
      const it = items[mi];
      const lay = maskCellLayout(sl.hz, sl.g.length, j, it.w, it.h, NL.box, it.info, !!NL.note, evenSc(emap, it));
      if (lay.info) {
        const [tx, ty, tw, th] = lay.info;
        infoPaint(c, infoFit(it.info, tw, th), x + tx * k, y + ty * k, k * PT);
      }
      cell(lay, it.kind === "out" ? outThumb(it.m, it.scr) : it.kind === "cut" ? cutThumb(it.c) : it.kind === "cutsrc" ? cutSrcThumb(it.c) : it.kind === "field" ? fieldThumb(it.f) : it.kind === "volcom" || it.kind === "vol3d" ? volItemThumb(it) : thumb({ uid: it.st.uid, st: it.st, w0: it.w, h0: it.h }), it.label);
    });
    drawNote();
    const skey = sl.kind === "title" ? "req" : sl.kind === "ov" ? imgKey(sl.ims[0]) : noteKey(sl.g.map((i) => items[i]));
    ui.tzSlideHits.push({ x, y, w: sw, h: sh, key: skey, no: sl.no, mgi: sl.kind === "g" ? sl.mgi : null });
    if (sl.kind === "title" ? isReqSel(ui.tzSel) : skey === ui.tzSel) {
      c.strokeStyle = "#1ec8b4";
      c.lineWidth = 3;
      c.strokeRect(x - 1.5, y - 1.5, sw + 3, sh + 3);
    } else {
      c.strokeStyle = "#2b3946";
      c.lineWidth = 1;
      c.strokeRect(x + 0.5, y + 0.5, sw - 1, sh - 1);
    }
    c.fillStyle = "#8c9bab";
    c.font = "11px ".concat(FONT);
    c.textAlign = "center";
    c.fillText(sl.kind === "title" ? "1 · шаблон ".concat(tzName(ui.tzTpl)) : sl.kind === "ov" ? "".concat(sl.no + 1, " · ").concat(sl.ims.length > 1 ? "картинки" : "картинка") : "".concat(sl.no + 1), x + sw / 2, y + sh + 13);
    c.textAlign = "left";
  });
  if (!items.length) {
    c.fillStyle = "#ffb020";
    c.font = "13px ".concat(FONT);
    c.fillText("В ТЗ ничего не отмечено", pad, R.height - 10);
  }
  const hv = ui.tzDrag ? ui.tzDrag.hit : ui.tzHover;
  if (hv) {
    const h = ui.tzHits.find((q) => q.pk === hv.pk && q.sx === hv.sx && q.sy === hv.sy) || hv;
    c.save();
    c.setLineDash([4, 3]);
    c.strokeStyle = "#1ec8b4";
    c.lineWidth = 1.2;
    c.strokeRect(h.x - 3, h.y - 2, h.w + 6, h.h + 4);
    c.restore();
  }
}
ui.tzHits = [];
ui.tzSlideHits = [];
ui.tzZoom = -1;
ui.tzSlideCount = 0;
function syncTzZoomUI() {
  const z = ui.tzZoom >= 0, n = ui.tzSlideCount || 0;
  setTxt($("tZoom"), z ? "Все листы" : "Крупно");
  $("tZoom").setAttribute("aria-pressed", String(z));
  $("tZoomPrev").hidden = $("tZoomNext").hidden = !z;
  $("tZoomPrev").disabled = !z || ui.tzZoom <= 0;
  $("tZoomNext").disabled = !z || ui.tzZoom >= n - 1;
  setTxt($("tZoomNo"), z ? "лист ".concat(ui.tzZoom + 1, " из ").concat(n) : "");
}
function tzZoomTo(i) {
  ui.tzZoom = i;
  ui.tzView = { z: 1, x: 0, y: 0 };
  ui.tzHover = null;
  requestDraw();
}
$("tZoom").onclick = () => {
  if (ui.tzZoom >= 0) return tzZoomTo(-1);
  // какой лист открыть: где выбран текст, иначе первый
  const h = ui.tzSlideHits.find((q) => q.key === ui.tzSel || q.key === "req" && isReqSel(ui.tzSel));
  tzZoomTo(h ? h.no : 0);
};
$("tZoomPrev").onclick = () => ui.tzZoom > 0 && tzZoomTo(ui.tzZoom - 1);
$("tZoomNext").onclick = () => ui.tzZoom < ui.tzSlideCount - 1 && tzZoomTo(ui.tzZoom + 1);
window.addEventListener("keydown", (e) => {
  if (ui.page !== "tz") return;
  if (ui.tzZoom < 0) {
    const t0 = e.target;
    if (e.key === "Escape" && !(t0 && (/^(INPUT|TEXTAREA|SELECT)$/.test(t0.tagName) || t0.isContentEditable)) && $("modal").hidden) tzViewReset();
    return;
  }
  const t = e.target;
  if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
  if (e.key === "Escape") {
    if (!tzViewReset()) tzZoomTo(-1);
  } else if (e.key === "ArrowLeft") $("tZoomPrev").click();
  else if (e.key === "ArrowRight") $("tZoomNext").click();
  else return;
  e.preventDefault();
});
ui.tzHover = null;
ui.tzDrag = null;
const pkKey = (pk) => pk.startsWith("req:") ? "req" + (pk.includes("#") ? pk.slice(pk.indexOf("#")) : "") : pk.slice(5);
const tzHitAt = (p) => {
  for (let i = ui.tzHits.length - 1; i >= 0; i--) {
    const h = ui.tzHits[i];
    if (p[0] >= h.x - 4 && p[0] <= h.x + h.w + 4 && p[1] >= h.y - 4 && p[1] <= h.y + h.h + 4) return h;
  }
  return null;
};
function tzPointer(e, type) {
  const p = tzLocal(e);
  if (type === "down") {
    const h = tzHitAt(p);
    if (!h && ui.tzView.z > 1) {
      const q = local(e);
      ui.tzPan = { sx: q[0], sy: q[1], x0: ui.tzView.x, y0: ui.tzView.y };
      pv.setPointerCapture(e.pointerId);
    }
    if (!h) {
      const sh = ui.tzSlideHits.find((q) => p[0] >= q.x && p[0] <= q.x + q.w && p[1] >= q.y && p[1] <= q.y + q.h);
      if (sh) {
        // 2.0.147: выбор слайда мышью — он же становится целью для «Масок на слайде»
        const which = sh.mgi != null ? String(sh.mgi) : "all";
        if (ui.tzMaskWhich !== which) {
          ui.tzMaskWhich = which;
          refreshTZPanel();
        }
        selectTZText(sh.key === "req" && isReqSel(ui.tzSel) ? ui.tzSel : sh.key);
      }
      return;
    }
    selectTZText(pkKey(h.pk));
    pv.setPointerCapture(e.pointerId);
    ui.tzDrag = { hit: h, px: p[0], py: p[1], x0: h.ex, y0: h.ey, moved: false };
    requestDraw();
    return;
  }
  if (type === "move" && ui.tzPan) {
    const q = local(e);
    ui.tzView.x = ui.tzPan.x0 + q[0] - ui.tzPan.sx;
    ui.tzView.y = ui.tzPan.y0 + q[1] - ui.tzPan.sy;
    tzViewClamp();
    pv.style.cursor = "grabbing";
    requestDraw();
    return;
  }
  if (type !== "move" && ui.tzPan) {
    ui.tzPan = null;
    pv.style.cursor = "default";
    return;
  }
  if (type === "move") {
    const d = ui.tzDrag;
    if (!d) {
      const h = tzHitAt(p);
      if ((h && h.pk) !== (ui.tzHover && ui.tzHover.pk) || h && ui.tzHover && h.sx !== ui.tzHover.sx) {
        ui.tzHover = h;
        requestDraw();
      }
      pv.style.cursor = h ? "move" : ui.tzSlideHits.some((q) => p[0] >= q.x && p[0] <= q.x + q.w && p[1] >= q.y && p[1] <= q.y + q.h) ? "pointer" : "default";
      return;
    }
    const k = d.hit.k, nx = Math.round(d.x0 + (p[0] - d.px) / k), ny = Math.round(d.y0 + (p[1] - d.py) / k);
    if (!d.moved && Math.abs(p[0] - d.px) + Math.abs(p[1] - d.py) < 3) return;
    d.moved = true;
    const maxX = SLIDE_W - d.hit.w / k, maxY = SLIDE_H - d.hit.h / k;
    project.tz.pos = project.tz.pos || {};
    project.tz.pos[d.hit.pk] = { x: Math.max(0, Math.min(Math.round(maxX), nx)), y: Math.max(0, Math.min(Math.round(maxY), ny)) };
    requestDraw();
    return;
  }
  if (ui.tzDrag) {
    const moved = ui.tzDrag.moved;
    ui.tzDrag = null;
    requestDraw();
    if (moved) {
      scheduleAutosave();
      scheduleHistory();
      refreshTZText();
    }
  }
}
const stripThumbs = /* @__PURE__ */ new Map();
let stripTimer = 0;
function scheduleStrip() {
  clearTimeout(stripTimer);
  stripTimer = setTimeout(renderStrip, 160);
}
function renderStrip() {
  if (ui.page !== "mask") return;
  const box = $("mStrip"), keep = /* @__PURE__ */ new Set();
  const tiles = [...box.querySelectorAll(".mthumb:not(.add)")];
  project.screens.forEach((st, i) => {
    const [W, H] = dims(st), k = JSON.stringify(st) + JSON.stringify(project.guides);
    let tile = tiles[i];
    if (!tile) {
      tile = document.createElement("button");
      tile.className = "mthumb";
      tile.type = "button";
      tile.append(document.createElement("canvas"), document.createElement("span"));
      tile.lastChild.className = "cap";
      box.insertBefore(tile, box.querySelector(".mthumb.add"));
    }
    tile.onclick = () => {
      if (project.cur === i) return;
      project.cur = i;
      ui.selected.clear();
      ui.anchor = null;
      ui.textMode = -1;
      syncUI();
      changed({ forcePhys: true });
    };
    tile.oncontextmenu = (e) => {
      e.preventDefault();
      if (project.cur !== i) {
        project.cur = i;
        ui.selected.clear();
        ui.textMode = -1;
        syncUI();
        changed();
      }
      showCtx(e.clientX, e.clientY, [
        { label: "Дублировать", fn: () => copyScreen() },
        { label: "Переименовать", fn: () => { const n = $("scrName"); if (n) { n.focus(); n.select(); } } },
        { sep: true },
        { label: "Удалить", danger: true, disabled: project.screens.filter(inMode).length <= 1, fn: () => $("btnDelScreen").click() }
      ]);
    };
    tile.setAttribute("aria-current", String(i === project.cur));
    tile.hidden = !inMode(st);
    tile.title = "".concat(i + 1, ". ").concat(st.name || "screen", " — ").concat(W, "×").concat(H);
    tile.lastChild.innerHTML = "<b>".concat(i + 1, ". ").concat(xmlEsc(st.name || "screen"), "</b> · ").concat(W, "×").concat(H);
    const cv = tile.firstChild;
    if (cv.dataset.k !== k) {
      const s = Math.min(1, 200 / W, 124 / H) * Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.max(1, Math.round(W * s));
      cv.height = Math.max(1, Math.round(H * s));
      drawMask(cv.getContext("2d"), st, s, guidesOf(st));
      cv.dataset.k = k;
    }
    keep.add(tile);
  });
  tiles.forEach((t) => {
    if (!keep.has(t)) t.remove();
  });
  if (!box.querySelector(".mthumb.add")) {
    const add = document.createElement("div");
    add.className = "mthumb add";
    const b1 = document.createElement("button"), b2 = document.createElement("button");
    b1.type = b2.type = "button";
    b1.className = "plus";
    b1.textContent = "+";
    b1.title = "Новый экран";
    b1.onclick = () => $("btnAddScreen").click();
    b2.className = "copy";
    b2.textContent = "copy";
    b2.title = "Копия текущего экрана со всеми настройками (номер — автоматически)";
    b2.onclick = copyScreen;
    add.append(b1, b2);
    box.appendChild(add);
  }
  const cur = box.children[project.cur];
  if (cur && (cur.offsetLeft < box.scrollLeft || cur.offsetLeft + cur.offsetWidth > box.scrollLeft + box.clientWidth)) box.scrollTo({ left: cur.offsetLeft - 8, behavior: "smooth" });
}
// 2.0.78: лента общих полей (как лента масок): миниатюра каждого поля, «+» — новое поле, «copy» — копия текущего
let fStripT = 0;
function scheduleFieldStrip() {
  // с задержкой: при перетаскивании экранов по полю миниатюры не перерисовываются на каждый кадр
  clearTimeout(fStripT);
  fStripT = setTimeout(renderFieldStrip, 250);
}
function copyField() {
  const src = CF(), f = JSON.parse(JSON.stringify(src));
  f.id = newUid();
  const base = String(src.name || "Общее поле").replace(/ \(копия( \d+)?\)$/, ""), names = new Set(project.fields.map((q) => q.name));
  let n = 1, nm = base + " (копия)";
  while (names.has(nm)) nm = base + " (копия " + ++n + ")";
  f.name = nm;
  project.fields.splice(project.fieldCur + 1, 0, f);
  project.fieldCur++;
  fld.sel = null;
  FV.fitted = false;
  fieldChanged(true);
  status("Копия поля: " + nm, true);
}
function renderFieldStrip() {
  if (ui.page !== "field") return;
  const box = $("fStrip");
  box.innerHTML = "";
  project.fields.forEach((f, k) => {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "mthumb";
    const rs = fieldRects(f), b = fieldBBox(rs), cap = document.createElement("span");
    cap.className = "cap";
    cap.innerHTML = "<b>".concat(k + 1, ". ").concat(xmlEsc(f.name || "Поле " + (k + 1)), "</b>").concat(b ? " · " + b.w + "×" + b.h : "");
    if (b) {
      const src = fieldThumb(f), cv = document.createElement("canvas"), sc = Math.min(200 / src.width, 124 / src.height) * Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.max(1, Math.round(src.width * sc));
      cv.height = Math.max(1, Math.round(src.height * sc));
      tile.append(cv, cap);
      tile._draw = () => cv.getContext("2d").drawImage(src, 0, 0, cv.width, cv.height);
    } else {
      const e = document.createElement("div");
      e.className = "empty";
      e.textContent = "пустое поле";
      tile.append(e, cap);
    }
    tile.title = (f.name || "Поле") + (b ? " — " + b.w + "×" + b.h : " — экраны не отмечены");
    tile.setAttribute("aria-current", String(k === project.fieldCur));
    tile.onclick = () => {
      if (project.fieldCur === k) return;
      project.fieldCur = k;
      fld.sel = null;
      FV.fitted = false;
      refreshFieldPanel();
      requestDraw();
    };
    box.appendChild(tile);
    // 2.0.144: рисуем ПОСЛЕ вставки в DOM — Safari 12 иначе показывает чёрный кадр
    if (tile._draw) tile._draw();
  });
  const add = document.createElement("div");
  add.className = "mthumb add";
  const b1 = document.createElement("button"), b2 = document.createElement("button");
  b1.type = b2.type = "button";
  b1.className = "plus";
  b1.textContent = "+";
  b1.title = "Новое общее поле";
  b1.onclick = () => $("fAdd").click();
  b2.className = "copy";
  b2.textContent = "copy";
  b2.title = "Копия текущего поля со всеми экранами и их положением";
  b2.onclick = copyField;
  add.append(b1, b2);
  box.appendChild(add);
  const cur = box.children[project.fieldCur];
  if (cur && (cur.offsetLeft < box.scrollLeft || cur.offsetLeft + cur.offsetWidth > box.scrollLeft + box.clientWidth)) box.scrollTo({ left: cur.offsetLeft - 8, behavior: "smooth" });
}
// 2.0.99: перетаскивание карточек в ленте масок и полей мышью — меняет порядок
function stripDrag(box, onMove) {
  let d = null;
  const tiles = () => [...box.querySelectorAll(".mthumb:not(.add)")];
  const clearMarks = () => tiles().forEach((t) => t.classList.remove("drop-l", "drop-r", "dragging"));
  box.addEventListener("pointerdown", (e) => {
    const t = e.target.closest(".mthumb:not(.add)");
    if (!t || e.button > 0 || e.pointerType === "touch") return; // на телефоне лента листается пальцем
    d = { t, from: tiles().indexOf(t), x: e.clientX, y: e.clientY, on: false, id: e.pointerId, to: -1 };
  });
  box.addEventListener("pointermove", (e) => {
    if (!d || e.pointerId !== d.id) return;
    if (!d.on) {
      if (Math.abs(e.clientX - d.x) < 8) return;
      d.on = true;
      try {
        box.setPointerCapture(e.pointerId);
      } catch (x) {
      }
      d.t.classList.add("dragging");
    }
    e.preventDefault();
    const ts = tiles();
    let to = ts.length;
    for (let i = 0; i < ts.length; i++) {
      const r = ts[i].getBoundingClientRect();
      if (e.clientX < r.left + r.width / 2) {
        to = i;
        break;
      }
    }
    d.to = to;
    ts.forEach((t) => t.classList.remove("drop-l", "drop-r"));
    if (to < ts.length) ts[to].classList.add("drop-l");
    else if (ts.length) ts[ts.length - 1].classList.add("drop-r");
    // у края ленты — прокрутка
    const br = box.getBoundingClientRect();
    if (e.clientX < br.left + 30) box.scrollLeft -= 12;
    else if (e.clientX > br.right - 30) box.scrollLeft += 12;
  });
  const end = (e) => {
    if (!d || e.pointerId !== d.id) return;
    const was = d;
    d = null;
    clearMarks();
    if (!was.on) return;
    // щелчок после перетаскивания не считаем выбором карточки
    box.addEventListener("click", (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
    }, { capture: true, once: true });
    let to = was.to > was.from ? was.to - 1 : was.to;
    if (to < 0 || to === was.from) return;
    onMove(was.from, to);
  };
  box.addEventListener("pointerup", end);
  box.addEventListener("pointercancel", (e) => {
    if (d && e.pointerId === d.id) {
      d = null;
      clearMarks();
    }
  });
}
const moveIn = (arr, from, to) => {
  const [x] = arr.splice(from, 1);
  arr.splice(to, 0, x);
};
// 2.0.114: порядок в ТЗ — выбрать строку и двигать кнопками ⤒ ↑ ↓ ⤓ или стрелками клавиатуры (Shift — в начало / в конец)
function tzMove(how) {
  const keys = tzOrder().map((o) => o.k), i = keys.indexOf(ui.tzPick);
  if (i < 0) {
    status("Выберите строку в списке ТЗ", true);
    return;
  }
  let j = how === "top" ? 0 : how === "bottom" ? keys.length - 1 : i + (how === "up" ? -1 : 1);
  j = Math.max(0, Math.min(keys.length - 1, j));
  if (j === i) return;
  keys.splice(j, 0, keys.splice(i, 1)[0]);
  project.tz.order = keys;
  tzChanged();
  const r = $("tList").querySelector(".fitem.sel");
  if (r) r.scrollIntoView({ block: "nearest" });
}
for (const [id, how] of [["tOrdTop", "top"], ["tOrdUp", "up"], ["tOrdDown", "down"], ["tOrdBottom", "bottom"]]) $(id).onclick = () => tzMove(how);
window.addEventListener("keydown", (e) => {
  if (ui.page !== "tz" || !ui.tzPick || !$("modal").hidden || e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target;
  if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && t.type !== "checkbox" || t.isContentEditable)) return;
  if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
  if (ui.tzZoom >= 0) return;
  e.preventDefault();
  tzMove(e.key === "ArrowUp" ? e.shiftKey ? "top" : "up" : e.shiftKey ? "bottom" : "down");
});
stripDrag($("mStrip"), (from, to) => {
  const cur = project.screens[project.cur];
  moveIn(project.screens, from, to);
  project.cur = project.screens.indexOf(cur);
  if (project.renumber !== false) renumberScreens();
  syncUI();
  changed({ forcePhys: true, list: true });
  scheduleStrip();
  status("Порядок экранов изменён", true);
});
// 2.0.120: лента нарезок (как у масок и полей): миниатюры, «+» — новая нарезка, «copy» — копия текущей
let cStripT = 0;
function scheduleCutStrip() {
  clearTimeout(cStripT);
  cStripT = setTimeout(renderCutStrip, 200);
}
function renderCutStrip() {
  if (ui.page !== "cut") return;
  const box = $("cStrip");
  box.innerHTML = "";
  project.cuts.forEach((c, k) => {
    const tile = document.createElement("button"), G = cutGeom(c), cap = document.createElement("span");
    tile.type = "button";
    tile.className = "mthumb";
    cap.className = "cap";
    cap.innerHTML = "<b>".concat(k + 1, ". ").concat(xmlEsc(c.name || "Нарезка " + (k + 1)), "</b>").concat(G ? " · " + G.W + "×" + G.H : "");
    if (G) {
      const src = cutThumb(c), cv = document.createElement("canvas"), sc = Math.min(200 / src.width, 124 / src.height) * Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.max(1, Math.round(src.width * sc));
      cv.height = Math.max(1, Math.round(src.height * sc));
      tile.append(cv, cap);
      tile._draw = () => cv.getContext("2d").drawImage(src, 0, 0, cv.width, cv.height);
    } else {
      const e = document.createElement("div");
      e.className = "empty";
      e.textContent = "нет маски";
      tile.append(e, cap);
    }
    tile.title = (c.name || "Нарезка") + (G ? " — " + (G.st.name || "screen") + ", " + G.parts.length + " ч. — " + G.W + "×" + G.H : "");
    tile.setAttribute("aria-current", String(k === project.cutCur));
    tile.onclick = () => {
      if (project.cutCur === k) return;
      project.cutCur = k;
      refreshCutPanel();
      requestDraw();
    };
    box.appendChild(tile);
    // 2.0.144: рисуем ПОСЛЕ вставки в DOM — Safari 12 иначе показывает чёрный кадр
    if (tile._draw) tile._draw();
  });
  const add = document.createElement("div"), b1 = document.createElement("button"), b2 = document.createElement("button");
  add.className = "mthumb add";
  b1.type = b2.type = "button";
  b1.className = "plus";
  b1.textContent = "+";
  b1.title = "Новая нарезка";
  b1.onclick = addCut;
  b2.className = "copy";
  b2.textContent = "copy";
  b2.title = "Копия текущей нарезки со всеми настройками";
  b2.onclick = copyCut;
  b2.disabled = !project.cuts.length;
  add.append(b1, b2);
  box.appendChild(add);
  const cur = box.children[project.cutCur];
  if (cur && (cur.offsetLeft < box.scrollLeft || cur.offsetLeft + cur.offsetWidth > box.scrollLeft + box.clientWidth)) box.scrollTo({ left: cur.offsetLeft - 8, behavior: "smooth" });
}
function copyCut() {
  const src = CC();
  if (!src) return;
  const c = JSON.parse(JSON.stringify(src)), base = String(src.name || "Нарезка").replace(/ \(копия( \d+)?\)$/, ""), names = new Set(project.cuts.map((q) => q.name));
  let n = 1, nm = base + " (копия)";
  while (names.has(nm)) nm = base + " (копия " + ++n + ")";
  c.id = newUid();
  c.name = nm;
  project.cuts.splice(project.cutCur + 1, 0, c);
  project.cutCur++;
  cutChanged(true);
  status("Копия нарезки: " + nm, true);
}
stripDrag($("cStrip"), (from, to) => {
  const cur = project.cuts[project.cutCur];
  moveIn(project.cuts, from, to);
  project.cutCur = project.cuts.indexOf(cur);
  cutChanged(true);
  status("Порядок нарезок изменён", true);
});
stripDrag($("fStrip"), (from, to) => {
  const cur = project.fields[project.fieldCur];
  moveIn(project.fields, from, to);
  project.fieldCur = project.fields.indexOf(cur);
  fieldChanged(true);
  status("Порядок полей изменён", true);
});
function placeStrip() {
  const strip = $("mStrip"), narrow = window.matchMedia("(max-width: 820px)").matches, q = $("btnHelpTop");
  for (const fs of [$("fStrip"), $("cStrip"), $("oStrip")]) {
    if (narrow && fs.parentElement !== $("panel")) $("panel").insertBefore(fs, $("panel").firstChild);
    if (!narrow && fs.parentElement === $("panel")) document.querySelector(".stage").appendChild(fs);
  }
  if (narrow && q.parentElement.classList.contains("undo")) document.querySelector(".seg.pages").after(q);
  if (!narrow && !q.parentElement.classList.contains("undo")) document.querySelector(".undo").appendChild(q);
  if (narrow && strip.parentElement !== $("panel")) $("panel").insertBefore(strip, $("panel").firstChild);
  if (!narrow && strip.parentElement === $("panel")) document.querySelector(".stage").appendChild(strip);
}
window.matchMedia("(max-width: 820px)").addEventListener("change", () => {
  placeStrip();
  requestDraw();
});
placeStrip();
function cmpVer(a, b) {
  const pa = String(a).split(".").map((n) => parseInt(n, 10) || 0), pb = String(b).split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}
const lsGet = (k) => {
  try {
    return localStorage.getItem(k);
  } catch (e) {
    return null;
  }
};
const lsSet = (k, v) => {
  try {
    localStorage.setItem(k, v);
  } catch (e) {
  }
};
let updating = false;
window.__updateProgress = (p) => {
  busy("Загрузка обновления… ".concat(Math.round(Math.max(0, Math.min(1, +p || 0)) * 100), "%"));
};
window.__updateFailed = (msg) => {
  updating = false;
  busy("");
  status("Обновление не удалось: " + msg, true);
};
async function checkUpdate(manual) {
  if (PLATFORM === "web" || updating || SELFTEST) return;
  let j;
  try {
    const r = await fetch(UPDATE_URL + "?t=" + Date.now(), { cache: "no-store" });
    if (!r.ok) throw new Error(r.status);
    j = await r.json();
  } catch (e) {
    if (manual) status("Не удалось проверить обновления — нет связи с сайтом", true);
    return;
  }
  const it = j && j[PLATFORM];
  if (!it || !it.url || cmpVer(j.version, APP_VERSION) <= 0) {
    if (manual) status("У вас последняя версия ".concat(APP_VERSION), true);
    return;
  }
  if (!manual && lsGet("ledmask.updateLater") === j.version + "|" + (/* @__PURE__ */ new Date()).toDateString()) return;
  const how = PLATFORM === "android" ? "Приложение скачает новую версию и откроет установку." : "Программа скачает новую версию, перезапустится и откроется с вашим проектом.";
  const ok = await ask("Доступна версия ".concat(j.version), "У вас ".concat(APP_VERSION, ". ").concat(j.notes ? j.notes + " " : "").concat(how), "", "Обновить", false);
  if (!ok) {
    lsSet("ledmask.updateLater", j.version + "|" + (/* @__PURE__ */ new Date()).toDateString());
    return;
  }
  lsSet("ledmask.project", JSON.stringify(projectData(true)));
  updating = true;
  busy("Загрузка обновления…");
  await tick();
  try {
    if (PLATFORM === "android") {
      const r = String(window.AndroidBridge.update(it.url));
      if (!r.startsWith("ok")) throw new Error(r.replace(/^err:/, ""));
      return;
    }
    await desk("update", { url: it.url, sha256: it.sha256 || "", version: j.version });
    busy("Устанавливаю обновление…");
  } catch (e) {
    window.__updateFailed(e.message);
  }
}
async function runSelfTest() {
  const log = ["version=".concat(APP_VERSION, " platform=").concat(PLATFORM, " compressionStream=").concat(HAS_CS)];
  const L2 = (s) => {
    log.push(s);
  };
  window.__stlog = log;
  try {
    if (DESKTOP) {
      const z = await nativeZ("inflate", "raw", await nativeZ("deflate", "raw", enc.encode("LED mask selftest ".repeat(200))));
      L2("native zlib roundtrip " + (dec.decode(z).length === 3600 ? "OK" : "FAIL"));
    }
    const a = project.screens[0];
    Object.assign(a, { name: "Центр", cabCols: 8, cabRows: 4 });
    a.cornerCabinets = { "1,0": 2 };
    a.blackCabinets = ["0,0"];
    $("btnAddScreen").click();
    Object.assign(S(), { name: "Левый", cabCols: 4, cabRows: 4 });
    const f = project.fields[0];
    f.items = [{ uid: project.screens[0].uid, x: 0, y: 0, rot: 0 }, { uid: project.screens[1].uid, x: 1536, y: 0, rot: 45 }];
    project.tz.fields[f.id] = true;
    project.tz.masks[project.screens[0].uid] = true;
    syncUI();
    changed();
    const m = await renderPNG(project.screens[0]);
    L2("mask png ".concat(m.w, "x").concat(m.h, " ").concat(m.png.length, " bytes"));
    await save("".concat(maskFileBase(project.screens[0]), ".png"), new Blob([m.png], { type: "image/png" }));
    const fp = await renderFieldPNG(f);
    L2("field png ".concat(fp.w, "x").concat(fp.h, " even=").concat(fp.w % 2 === 0 && fp.h % 2 === 0));
    await save("".concat(fieldFileBase(f), ".png"), new Blob([fp.png], { type: "image/png" }));
    for (const t of ["Resolume", "D3", "MP4"]) {
      await exportTZ(t);
      L2("tz ".concat(t, " done"));
    }
    await save("Selftest.ledmask", toPlist(ledmaskData()));
    L2("project saved");
    L2("SELFTEST DONE");
  } catch (e) {
    L2("SELFTEST ERROR " + (e && e.stack || e));
  }
  try {
    await desk("selftestDone", { log: log.join("\n") });
  } catch (e) {
    console.log(log.join("\n"));
  }
}
$("appicon").src = "data:image/png;base64," + ICON_B64;
fillSelect($("cabType"), TYPES.map((t) => t[0]));
// 2.0.98: в конце списка — «Своё разрешение» (как у проекции, ТВ и pixel drop)
{
  const o = document.createElement("option");
  o.value = "";
  o.textContent = "Своё разрешение";
  $("cabType").appendChild(o);
}
// 2.0.117: список типов кабинетов — с цветным прямоугольником перед названием (цвет кабинета)
window.cabTypeUI = swatchSelect($("cabType"), (v) => v === "" || !TYPES[+v] ? null : "rgb(".concat(TYPES[+v][5].join(","), ")"));
// 2.0.164: такие же списки с жирной цветной точкой — у экранов, у типа кабинета кольца и у списка колец
window.rgTypeUI = swatchSelect($("rgType"), (v) => v === "" || !TYPES[+v] ? null : "rgb(".concat(TYPES[+v][5].join(","), ")"));
window.screensUI = swatchSelect($("screens"), (v) => screenDotColor(+v));
window.rgListUI = swatchSelect($("rgList"), (v) => {
  const st = S(), R = st && st.kind === "ring" ? st.ring : null, g = R && R.rings && R.rings[+v];
  return g ? g.color || typeColor(ringCab(R, g).type, ringCab(R, g).cw, ringCab(R, g).ch) : null;
});
fillSelect($("inscSize"), INSC);
fillSelect($("exSize"), INSC);
fillSelect($("txSize"), INSC);
fillSelect($("rot"), ROTS);
fillSelect($("exRot"), ROTS);
fillSelect($("numFmt"), NUM_FORMATS);
fillSelect($("numOrigin"), NUM_ORIGINS);
fillSelect($("numPos"), NUM_POS);
try {
  const saved = localStorage.getItem("ledmask.project");
  if (saved) loadData(JSON.parse(saved));
} catch (e) {
}
// 2.0.112: убираем из IndexedDB картинки, на которые не ссылаются ни автосохранение, ни «Последние»
setTimeout(async () => {
  try {
    await ui.ovReady;
    const keys = await IMGDB.keys();
    if (!keys || !keys.length) return;
    const used = new Set(ui.images.map((im) => im.ref));
    const scan = (d) => (d && Array.isArray(d.overviewImages) ? d.overviewImages : []).forEach((q) => q && q.ref && used.add(q.ref));
    try {
      scan(JSON.parse(localStorage.getItem("ledmask.project") || "null"));
    } catch (e) {
    }
    for (const it of recentGet()) scan(it.data);
    for (const k of keys) if (!used.has(k)) await IMGDB.del(k);
  } catch (e) {
  }
}, 8e3);
document.documentElement.dataset.page = "mask";
syncUI();
requestDraw();
histCommit();
renderStrip();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => {
  autoCache.clear();
  requestDraw();
});
let platformStarted = false;
function startPlatform() {
  if (platformStarted) return;
  platformStarted = true;
  $("verText").textContent = "Версия ".concat(APP_VERSION, " · ").concat(PLATFORM_LABEL, " · сборка ").concat(BUILD_STAMP);
  if (PLATFORM !== "web") {
    $("btnUpdate").hidden = false;
    $("btnUpdate").onclick = () => checkUpdate(true);
    setTimeout(() => checkUpdate(false), 4e3);
  }
  if (SELFTEST) setTimeout(() => runSelfTest(), 1500);
}
$("verText").textContent = "Версия ".concat(APP_VERSION, " · ").concat(PLATFORM_LABEL, " · сборка ").concat(BUILD_STAMP);
if (PLATFORM !== "web") startPlatform();
else if (STANDALONE) {
  pywebviewReady.then(async () => {
    setPlatform("windows");
    try {
      const info = await desk("info");
      SELFTEST = !!(info && info.selftest);
      window.__info = info;
    } catch (e) {
      window.__info = "ERR " + e.message;
    }
    startPlatform();
  });
}
if (!HAS_CS && !DESKTOP && !window.pako) {
  $("exportNote").textContent = "Этот браузер слишком старый для экспорта: нужен Safari 16.4+ или свежий Chrome.";
}
if (STANDALONE) document.documentElement.classList.add("standalone");
pv.addEventListener("mousedown", (e) => {
  e.preventDefault();
  const a = document.activeElement;
  if (a && a !== document.body && a.blur && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) a.blur();
});
pv.addEventListener("selectstart", (e) => e.preventDefault());
document.querySelector(".canvas-wrap") && document.querySelector(".canvas-wrap").addEventListener("selectstart", (e) => e.preventDefault());
function setTitleRot(d) {
  const st = S();
  st.rotDeg = normDeg(d);
  let best = 0;
  ROT_DEG.forEach((v, i) => {
    if (Math.abs(normDeg(v - st.rotDeg)) < Math.abs(normDeg(ROT_DEG[best] - st.rotDeg))) best = i;
  });
  st.rotationIndex = best;
  $("rotVal").textContent = st.rotDeg + "°";
  changed();
}
$("rotCCW").onclick = () => setTitleRot(titleRot(S()) + 45);
$("rotCW").onclick = () => setTitleRot(titleRot(S()) - 45);
$("rot0").onclick = () => setTitleRot(0);
const setExRot = (f) => {
  const it = S().extraLabels[ui.selLabel];
  if (!it) {
    status("Сначала добавьте или выберите текст", true);
    return;
  }
  it.rotation = normDeg(f(+it.rotation || 0));
  syncExtraControls();
  changed();
};
$("exRotCCW").onclick = () => setExRot((d) => d + 45);
$("exRotCW").onclick = () => setExRot((d) => d - 45);
$("exRot0").onclick = () => setExRot(() => 0);
$("txSize").addEventListener("change", (e) => {
  const v = e.target.value;
  if (txExtra()) forSel(() => {
    $("exSize").value = v;
    $("exSize").dispatchEvent(new Event("change"));
  });
  else {
    $("inscSize").value = v;
    $("inscSize").dispatchEvent(new Event("change"));
  }
  syncTextControls();
});
for (const [id, ex, main] of [["txMinus", "exMinus", "mainMinus"], ["txPlus", "exPlus", "mainPlus"], ["txRotCCW", "exRotCCW", "rotCCW"], ["txRot0", "exRot0", "rot0"], ["txRotCW", "exRotCW", "rotCW"]])
  $(id).onclick = () => {
    if (txExtra()) forSel(() => $(ex).click());
    else $(main).click();
    syncTextControls();
  };
ui.textMagnet = true;
$("txColor").addEventListener("input", (e) => {
  const st = S(), it = txExtra(), v = e.target.value.toUpperCase();
  if (it) for (const i of selExtras()) st.extraLabels[i].color = v;
  else st.titleColor = v;
  $("txColorReset").disabled = false;
  changed();
});
$("txColorReset").onclick = () => {
  const st = S(), it = txExtra();
  if (it) for (const i of selExtras()) delete st.extraLabels[i].color;
  else st.titleColor = null;
  syncTextControls();
  changed();
};
$("txMagnet").addEventListener("change", (e) => {
  ui.textMagnet = e.target.checked;
});
$("showInfo").addEventListener("change", (e) => {
  S().showInfo = e.target.checked;
  changed();
});
$("autoContour").addEventListener("change", (e) => {
  const st = S();
  st.autoContour = e.target.checked;
  if (st.autoContour) st.showPersistentContour = true;
  changed();
  status(st.autoContour ? "Автоконтур включён: выключите кабинет — контур его обойдёт" : "Автоконтур выключен", true);
});
// цвет кабинета экрана — для точки слева от названия в списке экранов
function screenDotColor(i) {
  const s = project.screens[i];
  if (!s) return null;
  if (s.kind === "ring") {
    const R = s.ring, g0 = R && R.rings && R.rings[0];
    if (!R) return null;
    const cab = ringCab(R, g0 || null);
    return g0 && g0.color || typeColor(cab.type, cab.cw, cab.ch) || null;
  }
  return s.pixelColor ? hex(s.pixelColor) : null;
}
function swatchSelect(sel, colorOf) {
  const box = document.createElement("div"), btn = document.createElement("button"), pop = document.createElement("div");
  box.className = "ssel" + (sel.classList.contains("grow") ? " grow" : "");
  btn.type = "button";
  btn.className = "ssel-btn";
  btn.setAttribute("aria-haspopup", "listbox");
  if (sel.id) btn.setAttribute("aria-label", (document.querySelector('label[for="'.concat(sel.id, '"]')) || {}).textContent || sel.id);
  pop.className = "ssel-pop";
  pop.setAttribute("role", "listbox");
  pop.hidden = true;
  // 2.0.153: не прокручивать меню программы, когда список докручен до края (overscroll-behavior не работает в WebKit на Mojave)
  pop.addEventListener("wheel", (e) => {
    const atTop = pop.scrollTop <= 0, atBottom = pop.scrollTop + pop.clientHeight >= pop.scrollHeight - 1;
    if (e.deltaY < 0 && atTop || e.deltaY > 0 && atBottom) e.preventDefault();
    e.stopPropagation();
  }, { passive: false });
  sel.classList.add("ssel-src");
  sel.tabIndex = -1;
  sel.after(box);
  box.append(btn, pop);
  const sw = (v) => {
    const s = document.createElement("span"), c = colorOf(v);
    s.className = "sw" + (c ? "" : " none");
    if (c) s.style.background = c;
    return s;
  };
  const sync = () => {
    const o = sel.options[sel.selectedIndex], t = document.createElement("span"), ar = document.createElement("span");
    t.className = "t";
    t.textContent = o ? o.text : "";
    ar.className = "ar";
    ar.textContent = "▾";
    btn.replaceChildren(sw(o ? o.value : ""), t, ar);
  };
  const close = () => {
    pop.hidden = true;
    box.classList.remove("open");
  };
  // 2.0.165: список открывается поверх страницы (fixed), чтобы не растягивать панель и не сдвигать её содержимое
  const place = () => {
    const r = btn.getBoundingClientRect(), gap = 4, pad = 8;
    if (r.bottom < 0 || r.top > innerHeight) return close();
    pop.style.position = "fixed";
    pop.style.left = "0px";
    pop.style.top = "0px";
    pop.style.minWidth = r.width + "px";
    pop.style.maxHeight = Math.max(120, Math.min(340, Math.max(r.top, innerHeight - r.bottom) - pad - gap)) + "px";
    const ph = pop.offsetHeight, pw = pop.offsetWidth;
    let top = r.bottom + gap;
    if (top + ph > innerHeight - pad) {
      const up = r.top - gap - ph;
      top = up >= pad ? up : Math.max(pad, innerHeight - pad - ph);
    }
    let left = r.left;
    if (left + pw > innerWidth - pad) left = Math.max(pad, innerWidth - pad - pw);
    pop.style.left = left + "px";
    pop.style.top = top + "px";
  };
  const open = () => {
    pop.replaceChildren();
    for (const o of sel.options) {
      const it = document.createElement("button"), t = document.createElement("span");
      it.type = "button";
      it.className = "ssel-it" + (o.value === sel.value ? " on" : "");
      it.setAttribute("role", "option");
      t.className = "t";
      t.textContent = o.text;
      it.title = o.text;
      it.append(sw(o.value), t);
      it.onclick = () => {
        sel.value = o.value;
        sel.dispatchEvent(new Event("change", { bubbles: true }));
        close();
        sync();
        btn.focus({ preventScroll: true });
      };
      pop.appendChild(it);
    }
    if (pop.parentElement !== document.body) document.body.appendChild(pop);
    pop.hidden = false;
    box.classList.add("open");
    place();
    // прокручиваем только сам список: scrollIntoView сдвинул бы и панель со страницей
    const on = pop.querySelector(".on");
    if (on) pop.scrollTop = Math.max(0, on.offsetTop - (pop.clientHeight - on.offsetHeight) / 2);
  };
  addEventListener("scroll", () => {
    if (!pop.hidden) place();
  }, true);
  addEventListener("resize", () => {
    if (!pop.hidden) place();
  });
  btn.onclick = () => pop.hidden ? open() : close();
  btn.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const n = sel.options.length, i = Math.max(0, Math.min(n - 1, sel.selectedIndex + (e.key === "ArrowDown" ? 1 : -1)));
    if (i === sel.selectedIndex) return;
    sel.selectedIndex = i;
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    sync();
  });
  document.addEventListener("pointerdown", (e) => {
    if (!box.contains(e.target) && !pop.contains(e.target)) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !pop.hidden) close();
  });
  sel.addEventListener("change", sync);
  sync();
  return { sync, close };
}
function stepper(id, fn) {
  const inp = typeof id === "string" ? $(id) : id, wrap = document.createElement("span");
  if (!inp || inp.closest(".stp")) return;
  wrap.className = "stp";
  inp.parentNode.insertBefore(wrap, inp);
  wrap.appendChild(inp);
  const bx = document.createElement("span");
  bx.className = "stpb";
  for (const [d, t] of [[1, "▲"], [-1, "▼"]]) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = t;
    b.tabIndex = -1;
    b.setAttribute("aria-label", (d > 0 ? "Больше: " : "Меньше: ") + (inp.getAttribute("aria-label") || inp.id || ""));
    let t1 = 0, t2 = 0;
    const stop = () => {
      clearTimeout(t1);
      clearInterval(t2);
    };
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      fn(d);
      stop();
      t1 = setTimeout(() => {
        t2 = setInterval(() => {
          // кнопку убрали со страницы (панель перерисовалась) — повтор останавливаем
          if (!b.isConnected) return stop();
          fn(d);
        }, 90);
      }, 380);
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => b.addEventListener(ev, stop));
    b.addEventListener("click", (e) => e.preventDefault());
    bx.appendChild(b);
  }
  wrap.appendChild(bx);
  if (wrap.parentNode && wrap.parentNode.classList) wrap.parentNode.classList.add("stp-row");
}
const stepCabs = (which, d) => {
  const st = S(), k = which === "w" ? "cabCols" : "cabRows";
  st[k] = Math.max(1, st[k] + d);
  $("cols").value = st.cabCols;
  $("rows").value = st.cabRows;
  changed({ forcePhys: true });
};
const stepInput = (id, step) => stepper(id, (d) => {
  const i = typeof id === "string" ? $(id) : id, lo = i.min !== "" ? +i.min : -Infinity, hi = i.max !== "" ? +i.max : Infinity;
  let v = parseFloat(String(i.value).replace(",", ".")) || 0;
  v = Math.min(hi, Math.max(lo, Math.round((v + d * step) / step) * step));
  i.value = +v.toFixed(3);
  i.dispatchEvent(new Event("input", { bubbles: true }));
  i.dispatchEvent(new Event("change", { bubbles: true }));
});
[
  ["wpx", 1],
  ["hpx", 1],
  ["pjW", 1],
  ["pjH", 1],
  ["pjNx", 1],
  ["pjNy", 1],
  ["pjWm", 0.1],
  ["pjHm", 0.1],
  ["pjArW", 1],
  ["pjArH", 1],
  ["pjOx", 0.5],
  ["pjOy", 0.5],
  ["pjGrid", 10],
  ["pjDome", 128],
  ["pjCanW", 1],
  ["pjCanH", 1],
  ["pjOxPx", 1],
  ["pjOyPx", 1],
  ["tvW", 1],
  ["tvH", 1],
  ["tvNx", 1],
  ["tvNy", 1],
  ["tvDiag", 1],
  ["pxW", 1],
  ["pxH", 1],
  ["pxCmW", 0.5],
  ["pxCmH", 0.5],
  ["pxCols", 1],
  ["pxRows", 1],
  ["pxSx", 1],
  ["pxSy", 1],
  ["pxWm", 0.1],
  ["pxHm", 0.1],
  ["pjFov", 5],
  ["pjAz", 1],
  ["pjEl", 1],
  // 2.0.66: волюметрик — свои кнопки ▲▼ как у LED (системные стрелки поля «убегали»)
  ["vlCx", 1],
  ["vlCz", 1],
  ["vlSx", 1],
  ["vlSz", 1],
  ["vlCw", 1],
  ["vlCd", 1],
  ["vlPx", 1],
  ["vlLen", 0.5],
  ["fX", 1],
  ["fY", 1],
  ["shapeW", 8],
  ["shapeH", 8],
  ["shapeWcm", 1],
  ["shapeHcm", 1],
  ["shapeLW", 1],
  ["shapeN", 8]
].forEach(([id, st]) => {
  if ($(id)) stepInput(id, st);
});
stepper("cols", (d) => stepCabs("w", d));
stepper("rows", (d) => stepCabs("h", d));
stepper("physW", (d) => stepCabs("w", d));
stepper("physH", (d) => stepCabs("h", d));
// 2.0.138: наши ▲▼ — везде, вместо маленьких системных стрелок: все числовые поля и поля с формулой (мэппинг).
// Шаг — из атрибута step (иначе 1). Поля, у которых свои кнопки, уже обёрнуты — их не трогаем.
function stepAll(root) {
  for (const i of (root || document).querySelectorAll('input[type="number"], input.calc')) {
    if (i.closest(".stp") || i.hidden) continue;
    const st = parseFloat(i.getAttribute("step"));
    stepInput(i, st > 0 ? st : 1);
  }
}
stepAll();
(function keepPanelScroll() {
  // 2.0.35: страж из рабочей Mac-сборки 2.0.16 — если панель без участия человека прыгнула в самый верх, возвращаем.
  // Основное исправление — не трогать панель без нужды (setTxt / setVal / setHtml, status) и стили .status / .panel.
  const pn = document.querySelector(".panel");
  if (!pn) return;
  let last = 0, userAt = 0, drag = false;
  const mark = () => {
    userAt = Date.now();
  };
  ["wheel", "touchstart", "touchmove", "keydown"].forEach((t) => pn.addEventListener(t, mark, { passive: true }));
  pn.addEventListener("mousedown", (e) => {
    if (e.target === pn) {
      drag = true;
      mark();
    }
  });
  window.addEventListener("mouseup", () => {
    if (drag) {
      drag = false;
      mark();
    }
  });
  window.addEventListener("mousemove", () => {
    if (drag) mark();
  });
  if (QS.get("noguard")) return;
  if (window.matchMedia && !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  let fixedAt = 0;
  pn.addEventListener("scroll", () => {
    const t = pn.scrollTop, now = Date.now();
    if (t < 2 && last > 40 && !drag && now - userAt > 600 && now - fixedAt > 400 && window.innerWidth > 820) {
      fixedAt = now;
      pn.scrollTop = last;
      return;
    }
    last = t;
  }, { passive: true });
})();
if (QS.get("diag")) {
  const box = document.createElement("pre");
  box.style.cssText = "position:fixed;left:4px;bottom:4px;z-index:99;max-width:70vw;max-height:40vh;overflow:auto;margin:0;padding:6px;background:rgba(0,0,0,.85);color:#7CFC9A;font:11px/1.3 monospace;pointer-events:none;white-space:pre-wrap";
  document.body.appendChild(box);
  const lg = (t) => {
    box.textContent = (t + "\n" + box.textContent).slice(0, 3e3);
  };
  const nm = (el) => el ? el.id ? "#" + el.id : el.tagName : "-";
  lg("UA ".concat(navigator.userAgent.slice(0, 90), "\nCS=").concat(typeof CompressionStream, " pako=").concat(!!window.pako, " PE=").concat(typeof PointerEvent, " hover=").concat(matchMedia("(hover: hover)").matches, " coarse=").concat(matchMedia("(pointer: coarse)").matches));
  ["focusin", "focusout", "keydown", "beforeinput", "input", "touchstart", "mousedown", "click"].forEach((t) => document.addEventListener(t, (e) => lg("".concat(t, " ").concat(nm(e.target)).concat(e.key ? " key=" + e.key : "").concat(e.inputType ? " " + e.inputType : "", " prevented=").concat(e.defaultPrevented, " active=").concat(nm(document.activeElement))), true));
  ["touchstart", "mousedown", "keydown", "beforeinput"].forEach((t) => document.addEventListener(t, (e) => {
    if (e.defaultPrevented) lg("!! ".concat(t, " отменён"));
  }, false));
  window.addEventListener("error", (e) => lg("ERR " + e.message));
}
// Ручки выбранной фигуры (в пикселях холста, с учётом поворота)
function shapeHandles(c, cx, cy, s) {
  const rx = c.w / 2 * s, ry = c.h / 2 * s, P = (lx, ly) => {
    const [X, Y] = rotPt(c, lx, ly);
    return [cx + X, cy + Y];
  };
  const out = [{ k: "rot", p: P(0, -ry - 34), base: P(0, -ry) }];
  if (c.t === "trap") out.push({ k: "top", p: P(...trapLocal(c, rx, ry)) });
  if (c.t === "round" || c.t === "trap" || c.t === "pent") {
    const rr = (shapeR(c) || 0) * s;
    out.push({ k: "rad", p: P(rx - Math.max(rr, 10), c.t === "round" ? -ry : ry + 18) });
  }
  out.push({ k: "size", m: "wh", p: P(rx, ry) }, { k: "size", m: "w", p: P(rx, 0) }, { k: "size", m: "h", p: P(0, ry) });
  return out;
}
// Точки своей фигуры: A — узел, I/O — ручки выбранного узла
function bezHandles(c, cx, cy, s) {
  const rx = c.w / 2 * s, ry = c.h / 2 * s, P = (lx, ly) => {
    const [X, Y] = rotPt(c, lx, ly);
    return [cx + X, cy + Y];
  };
  const out = [];
  (c.pts || []).forEach((q, i) => {
    const a = P(q.x * rx, q.y * ry);
    if (i === ui.bezSel) {
      for (const [k, hx, hy] of [["I", q.ix, q.iy], ["O", q.ox, q.oy]]) if (Math.abs(hx - q.x) + Math.abs(hy - q.y) > 1e-6) out.push({ k, i, p: P(hx * rx, hy * ry), a });
    }
    out.push({ k: "A", i, p: a });
  });
  return out;
}
// Подогнать рамку своей фигуры под её контур (после правки точек)
function bezNormalize(c) {
  const hw = c.w / 2, hh = c.h / 2, fl = bezFlat(c.pts, hw, hh);
  if (!fl.length) return;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of fl) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, nw = Math.max(4, x1 - x0), nh = Math.max(4, y1 - y0);
  for (const q of c.pts) for (const [a, b] of [["x", "y"], ["ix", "iy"], ["ox", "oy"]]) {
    q[a] = (q[a] * hw - mx) / (nw / 2);
    q[b] = (q[b] * hh - my) / (nh / 2);
  }
  const [dx, dy] = rotPt(c, mx, my);
  Object.assign(c, { x: c.x + dx, y: c.y + dy, w: nw, h: nh });
}
function bezFinish() {
  const d = ui.bezDraw && ui.bezDraw.pts;
  if (!d) return;
  if (d.length < 3) {
    status("Нужно хотя бы 3 точки", true);
    return;
  }
  const st = S(), pts = d.map((q) => ({ ...q })), c = { t: "bez", pts, x: 0, y: 0, w: 2, h: 2, rot: 0, r: 0, lock: false, inv: false, dimOnly: true, frame: false };
  bezNormalize(c);
  (st.cacheShapes || (st.cacheShapes = [])).push(c);
  ui.bezDraw = null;
  ui.bezHover = null;
  ui.selShape = st.cacheShapes.length - 1;
  ui.bezSel = -1;
  syncShapes();
  changed();
  status("Своя фигура готова: точки двигаются, двойной щелчок по точке — острый/плавный угол, по линии — новая точка", true);
}
function bezCancel() {
  ui.bezDraw = null;
  ui.bezHover = null;
  syncShapes();
  requestDraw();
  status("Рисование фигуры отменено", true);
}
function bezDeletePoint() {
  const c = S().cacheShapes[ui.selShape];
  if (!c || c.t !== "bez" || ui.bezSel < 0) return;
  if (c.pts.length <= 3) {
    status("У фигуры должно остаться хотя бы 3 точки", true);
    return;
  }
  c.pts.splice(ui.bezSel, 1);
  ui.bezSel = -1;
  bezNormalize(c);
  syncShapes();
  changed();
}
// Двойной щелчок: по точке — острый/плавный угол, по линии — новая точка
function bezDblClick(x, y) {
  const st = S(), c = (st.cacheShapes || [])[ui.selShape];
  if (!c || c.t !== "bez" || !L) return false;
  const s = L.scale, cx = L.ox + c.x * s, cy = L.oy + c.y * s, hw = c.w / 2, hh = c.h / 2, n = c.pts.length;
  const A = bezHandles(c, cx, cy, s).find((q) => q.k === "A" && Math.hypot(x - q.p[0], y - q.p[1]) <= 11);
  if (A) {
    const q = c.pts[A.i];
    if (q.sm || Math.abs(q.ix - q.x) + Math.abs(q.iy - q.y) + Math.abs(q.ox - q.x) + Math.abs(q.oy - q.y) > 1e-6) Object.assign(q, { ix: q.x, iy: q.y, ox: q.x, oy: q.y, sm: false });
    else {
      const a = c.pts[(A.i + n - 1) % n], b = c.pts[(A.i + 1) % n];
      let dx = (b.x - a.x) * hw, dy = (b.y - a.y) * hh;
      const dl = Math.hypot(dx, dy) || 1e-9;
      dx /= dl;
      dy /= dl;
      const l1 = Math.hypot((q.x - a.x) * hw, (q.y - a.y) * hh) / 3, l2 = Math.hypot((b.x - q.x) * hw, (b.y - q.y) * hh) / 3;
      Object.assign(q, { ix: q.x - dx * l1 / hw, iy: q.y - dy * l1 / hh, ox: q.x + dx * l2 / hw, oy: q.y + dy * l2 / hh, sm: true });
    }
    ui.bezSel = A.i;
    bezNormalize(c);
    syncShapes();
    changed();
    return true;
  }
  // ближайшая точка на кривой
  const [lx, ly] = unrotPt(c, (x - cx) / s, (y - cy) / s), segs = bezSegs(c.pts, hw, hh);
  let best = { d: Infinity };
  segs.forEach((sg, i) => {
    for (let k = 0; k <= 40; k++) {
      const t = k / 40, [px, py] = bezAt(sg, t), d = Math.hypot(px - lx, py - ly);
      if (d < best.d) best = { d, i, t };
    }
  });
  if (best.d * s > 12) return false;
  // разрез кривой Безье в точке t (де Кастельжо)
  const [p0, p1, p2, p3] = segs[best.i], t = best.t, L2 = (a, b) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const q01 = L2(p0, p1), q12 = L2(p1, p2), q23 = L2(p2, p3), r0 = L2(q01, q12), r1 = L2(q12, q23), m = L2(r0, r1);
  const a = c.pts[best.i], b = c.pts[(best.i + 1) % n];
  a.ox = q01[0] / hw;
  a.oy = q01[1] / hh;
  b.ix = q23[0] / hw;
  b.iy = q23[1] / hh;
  c.pts.splice(best.i + 1, 0, { x: m[0] / hw, y: m[1] / hh, ix: r0[0] / hw, iy: r0[1] / hh, ox: r1[0] / hw, oy: r1[1] / hh, sm: true });
  ui.bezSel = best.i + 1;
  syncShapes();
  changed();
  return true;
}
function drawCachePreview(st, s) {
  const R = st.cacheRef;
  if (R && R.show !== false && (!st.kind || st.kind === "led")) {
    const im = refImg(R.id);
    if (im) {
      const [x, y, w, h] = refRect(st);
      if (ui.refEdit) {
        const X = L.ox + x * s, Y = L.oy + y * s, Wd = w * s, Hd = h * s;
        pctx.save();
        pctx.strokeStyle = "#C77DFF";
        pctx.lineWidth = 2;
        pctx.setLineDash([7, 4]);
        pctx.strokeRect(X, Y, Wd, Hd);
        pctx.setLineDash([]);
        pctx.fillStyle = "#C77DFF";
        pctx.strokeStyle = "#000";
        pctx.lineWidth = 1;
        for (const [, fx, fy] of REF_HANDLES) {
          pctx.fillRect(X + Wd * fx - 6, Y + Hd * fy - 6, 12, 12);
          pctx.strokeRect(X + Wd * fx - 6, Y + Hd * fy - 6, 12, 12);
        }
        pctx.restore();
      }
    }
  }
  const dot = (p, r, fill) => {
    pctx.fillStyle = fill;
    pctx.beginPath();
    pctx.arc(p[0], p[1], r, 0, Math.PI * 2);
    pctx.fill();
    pctx.stroke();
  };
  if (ui.bezDraw) {
    // фигура в процессе рисования
    const d = ui.bezDraw.pts, P = (x, y) => [L.ox + x * s, L.oy + y * s];
    pctx.save();
    pctx.strokeStyle = "#ffff00";
    pctx.lineWidth = 2;
    if (d.length) {
      pctx.beginPath();
      pctx.moveTo(...P(d[0].x, d[0].y));
      for (let i = 1; i < d.length; i++) pctx.bezierCurveTo(...P(d[i - 1].ox, d[i - 1].oy), ...P(d[i].ix, d[i].iy), ...P(d[i].x, d[i].y));
      pctx.stroke();
      if (ui.bezHover && !act) {
        const l = d[d.length - 1];
        pctx.setLineDash([5, 4]);
        pctx.beginPath();
        pctx.moveTo(...P(l.x, l.y));
        pctx.bezierCurveTo(...P(l.ox, l.oy), ...P(ui.bezHover[0], ui.bezHover[1]), ...P(ui.bezHover[0], ui.bezHover[1]));
        pctx.stroke();
        pctx.setLineDash([]);
      }
      const l = d[d.length - 1];
      pctx.strokeStyle = "#3EC6FF";
      pctx.lineWidth = 1;
      if (l.sm) {
        pctx.beginPath();
        pctx.moveTo(...P(l.ix, l.iy));
        pctx.lineTo(...P(l.ox, l.oy));
        pctx.stroke();
        dot(P(l.ix, l.iy), 4, "#3EC6FF");
        dot(P(l.ox, l.oy), 4, "#3EC6FF");
      }
      pctx.strokeStyle = "#000";
      d.forEach((q, i) => {
        const [px, py] = P(q.x, q.y), r = i === 0 && d.length >= 3 ? 8 : 5;
        pctx.fillStyle = i === 0 && d.length >= 3 ? "#1ec8b4" : "#fff";
        pctx.fillRect(px - r, py - r, r * 2, r * 2);
        pctx.strokeRect(px - r, py - r, r * 2, r * 2);
      });
    }
    pctx.restore();
  }
  const sc = (st.cacheShapes || [])[ui.selShape];
  if (sc) {
    pctx.save();
    pctx.strokeStyle = "#ffff00";
    pctx.lineWidth = 2;
    pctx.setLineDash([6, 4]);
    pctx.beginPath();
    const cx = L.ox + sc.x * s, cy = L.oy + sc.y * s, rx = sc.w / 2 * s, ry = sc.h / 2 * s;
    shapePath(pctx, sc, cx, cy, rx + 4, ry + 4);
    pctx.stroke();
    pctx.setLineDash([]);
    pctx.strokeStyle = "#000";
    pctx.lineWidth = 1;
    for (const h of shapeHandles(sc, cx, cy, s)) {
      if (h.k === "size") {
        pctx.fillStyle = "#ffff00";
        pctx.fillRect(h.p[0] - 6, h.p[1] - 6, 12, 12);
        pctx.strokeRect(h.p[0] - 6, h.p[1] - 6, 12, 12);
      } else if (h.k === "rot") {
        pctx.strokeStyle = "#7CFC9A";
        pctx.beginPath();
        pctx.moveTo(...h.base);
        pctx.lineTo(...h.p);
        pctx.stroke();
        pctx.strokeStyle = "#000";
        dot(h.p, 7, "#7CFC9A");
      } else dot(h.p, 7, h.k === "top" ? "#3EC6FF" : "#FF9500");
    }
    if (sc.t === "bez") {
      for (const h of bezHandles(sc, cx, cy, s)) {
        if (h.k === "A") {
          const sel = h.i === ui.bezSel;
          pctx.fillStyle = sel ? "#1ec8b4" : "#fff";
          pctx.fillRect(h.p[0] - 5, h.p[1] - 5, 10, 10);
          pctx.strokeRect(h.p[0] - 5, h.p[1] - 5, 10, 10);
        } else {
          pctx.strokeStyle = "#3EC6FF";
          pctx.beginPath();
          pctx.moveTo(...h.a);
          pctx.lineTo(...h.p);
          pctx.stroke();
          pctx.strokeStyle = "#000";
          dot(h.p, 5, "#3EC6FF");
        }
      }
    }
    pctx.fillStyle = "#ffff00";
    pctx.beginPath();
    pctx.arc(cx, cy, 11, 0, Math.PI * 2);
    pctx.fill();
    pctx.stroke();
    pctx.beginPath();
    pctx.moveTo(cx - 6, cy);
    pctx.lineTo(cx + 6, cy);
    pctx.moveTo(cx, cy - 6);
    pctx.lineTo(cx, cy + 6);
    pctx.lineWidth = 2;
    pctx.stroke();
    pctx.restore();
  }
}
function normRot(d) {
  d = Math.round(((d % 360) + 540) % 360 - 180);
  return d === -180 ? 180 : d;
}
function bezLoad(pts) {
  if (!Array.isArray(pts) || pts.length < 3) return null;
  const f = (v) => isFinite(+v) ? Math.max(-50, Math.min(50, +v)) : 0;
  return pts.slice(0, 200).map((p) => ({ x: f(p.x), y: f(p.y), ix: f(p.ix != null ? p.ix : p.x), iy: f(p.iy != null ? p.iy : p.y), ox: f(p.ox != null ? p.ox : p.x), oy: f(p.oy != null ? p.oy : p.y), sm: !!p.sm }));
}
function shapeName(c) {
  if (c.t === "bez") return "Своя";
  if (c.t === "trap") return "Трапеция";
  if (c.t === "pent") return "Пентагон";
  return c.t === "round" ? shapeR(c) ? "Суперэллипс" : c.lock ? "Квадрат" : "Прямоугольник" : c.lock ? "Круг" : "Овал";
}
// Голубая ручка трапеции — свободный конец верхнего (при «Перевернуть» — нижнего) короткого основания (без поворота, от центра)
function trapLocal(c, rx, ry) {
  const tw = rx * trapTb(c), sk = trapSk(c), off = (rx - tw) * sk;
  return [sk > 0 ? -tw + off : tw + off, c.flip ? ry : -ry];
}
function mmPerPx(st) {
  const [w, h] = typeMM(st);
  return [w / Math.max(1, st.cabWpx), h / Math.max(1, st.cabHpx)];
}
function syncShapes() {
  const st = S(), list = st.cacheShapes || (st.cacheShapes = []), sel = $("shapeSel");
  if (ui.selShape >= list.length) ui.selShape = list.length - 1;
  setHtml(sel, '<option value="-1">'.concat(list.length ? "— не выбран" : "Фигур нет", "</option>") + list.map((c2, i) => '<option value="'.concat(i, '">').concat(shapeName(c2), " ").concat(i + 1).concat(c2.frame ? " (рамка)" : c2.inv ? " (инверсия)" : "", " · ").concat(c2.lock ? "⌀ " + Math.round(c2.w) : Math.round(c2.w) + "×" + Math.round(c2.h), " px</option>")).join(""));
  setVal(sel, String(ui.selShape));
  const c = list[ui.selShape];
  for (const [id, k] of [["shapeW", "w"], ["shapeH", "h"]]) {
    if (document.activeElement !== $(id)) setVal($(id), c ? Math.round(c[k]) : "");
    $(id).disabled = !c;
  }
  $("shapeLock").checked = c ? !!c.lock : true;
  $("shapeLock").disabled = !c;
  $("shapeInv").checked = !!(c && c.inv);
  $("shapeInv").disabled = !c || !!c.frame;
  $("shapeDel").disabled = !c;
  {
    const cc = c || list[0], m = !cc ? "" : cc.frame ? "frame" : cc.dimOnly ? "dim" : "off";
    document.querySelectorAll(".seg.shapeMode button").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.m === m));
      b.disabled = !list.length;
    });
  }
  {
    const [mx, my] = mmPerPx(st);
    for (const [id, k, f] of [["shapeWcm", "w", mx], ["shapeHcm", "h", my]]) {
      if (document.activeElement !== $(id)) setVal($(id), c ? +(c[k] * f / 10).toFixed(1) : "");
      $(id).disabled = !c;
    }
  }
  const t = ui.shapeType;
  document.querySelectorAll(".seg.shapeType button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.t === t)));
  {
    const R = st.cacheRef;
    $("refBox").hidden = !R;
    $("refDel").disabled = !R;
    if (R) {
      document.querySelectorAll(".seg.refFit button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.f === R.fit)));
      $("refKeep").checked = !!R.keep;
      $("refShow").checked = R.show !== false;
      setVal($("refAlpha"), 100 - (R.a == null ? 50 : R.a));
      setTxt($("refAlphaV"), 100 - (R.a == null ? 50 : R.a) + "%");
      const im = refImg(R.id);
      const [rx, ry, rw, rh] = refRect(st);
      for (const [id, v] of [["refX", rx], ["refY", ry], ["refW", rw], ["refH", rh]]) if (document.activeElement !== $(id)) setVal($(id), Math.round(v));
      $("refEdit").checked = !!ui.refEdit;
      setTxt($("refInfo"), (im ? "Картинка ".concat(im.naturalWidth, "×").concat(im.naturalHeight, " px · ") : "") + (R.fit === "free" ? "положение задано вручную" : R.fit === "cab" ? "кабинеты: колонки ".concat(R.c0 + 1, "–").concat(R.c1 + 1, ", ряды ").concat(R.r0 + 1, "–").concat(R.r1 + 1) : "весь экран"));
    }
  }
  $("shapeNRow").hidden = !(c && c.t !== "circle" && c.t !== "bez");
  $("shapeRotRow").hidden = !c;
  if (c && document.activeElement !== $("shapeRot")) setVal($("shapeRot"), Math.round(+c.rot || 0));
  $("shapeBezDraw").hidden = !ui.bezDraw;
  $("shapeBezEdit").hidden = !(c && c.t === "bez");
  $("shapeBezDel").disabled = !(c && c.t === "bez" && ui.bezSel >= 0);
  $("shapeAdd").disabled = !!ui.bezDraw;
  for (const id of ["shapeTbRow", "shapeSkRow", "shapeFlipRow"]) $(id).hidden = !(c && c.t === "trap");
  if (c && c.t === "trap") {
    if (document.activeElement !== $("shapeTb")) setVal($("shapeTb"), Math.round(trapTb(c) * 100));
    if (document.activeElement !== $("shapeSk")) setVal($("shapeSk"), Math.round(trapSk(c) * 100));
    $("shapeFlip").checked = !!c.flip;
  }
  if (document.activeElement !== $("shapeN")) setVal($("shapeN"), c ? Math.round(shapeR(c) || 0) : "");
  $("shapeLine").checked = st.cacheLine !== false;
  if (document.activeElement !== $("shapeLW")) setVal($("shapeLW"), st.cacheLineW || 6);
  setVal($("shapeLC"), (st.cacheLineColor || "#FFFFFF").toLowerCase());
  {
    const a = st.cacheLineA == null ? 100 : st.cacheLineA;
    setVal($("shapeLA"), a);
    setTxt($("shapeLAV"), a + "%");
  }
  {
    const dm = st.cacheDim == null ? 45 : st.cacheDim;
    setVal($("shapeDim"), dm);
    setTxt($("shapeDimV"), dm + "%");
  }
}
$("shapeAdd").onclick = () => {
  if (ui.shapeType === "bez") {
    ui.bezDraw = { pts: [] };
    ui.bezHover = null;
    ui.selShape = -1;
    ui.selected.clear();
    syncShapes();
    requestDraw();
    status("Своя фигура: щёлкайте по холсту — точки, потяните — изгиб; щелчок по первой точке или Enter — замкнуть", true);
    return;
  }
  const st = S(), { xs, ys } = grid(st), [W, H] = dims(st);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const k of ui.selected) {
    const p = parseKey(k);
    if (!p) continue;
    x0 = Math.min(x0, xs[p[0]]);
    x1 = Math.max(x1, xs[p[0] + 1]);
    y0 = Math.min(y0, H - ys[p[1] + 1]);
    y1 = Math.max(y1, H - ys[p[1]]);
  }
  const c = isFinite(x0) ? { x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: Math.min(x1 - x0, y1 - y0), h: Math.min(x1 - x0, y1 - y0), lock: true, inv: false } : { x: W / 2, y: H / 2, w: Math.round(Math.min(W, H) / 3), h: Math.round(Math.min(W, H) / 3), lock: true, inv: false };
  // первая фигура экрана: прежнее затемнение по умолчанию (35%) → новое 45%
  if (!(st.cacheShapes || []).length && (st.cacheDim == null || +st.cacheDim === 35)) st.cacheDim = 45;
  Object.assign(c, { dimOnly: true, rot: 0, t: ui.shapeType, r: Math.round(Math.min(c.w, c.h) * (ui.shapeType === "round" ? 0.2 : 0.06)), frame: false });
  if (c.t === "trap") Object.assign(c, { tb: 60, sk: 0, flip: false });
  (st.cacheShapes || (st.cacheShapes = [])).push(c);
  ui.selShape = st.cacheShapes.length - 1;
  ui.selected.clear();
  syncShapes();
  changed();
  status("Добавлено: ".concat(shapeName(c), " — двигайте на холсте, растягивайте за квадратики"), true);
};
$("shapeDel").onclick = () => {
  const st = S();
  if (ui.selShape < 0) return;
  st.cacheShapes.splice(ui.selShape, 1);
  ui.selShape = -1;
  syncShapes();
  changed();
};
$("shapeSel").addEventListener("change", (e) => {
  ui.selShape = +e.target.value;
  ui.bezSel = -1;
  syncShapes();
  requestDraw();
});
for (const [id, k] of [["shapeW", "w"], ["shapeH", "h"]]) $(id).addEventListener("input", (e) => {
  const c = S().cacheShapes[ui.selShape], v = pint(e.target.value, 0);
  if (c && v >= 4) {
    if (c.lock) c.w = c.h = v;
    else c[k] = v;
    syncShapes();
    changed();
  }
});
document.querySelectorAll(".seg.shapeType button").forEach((b) => b.onclick = () => {
  ui.shapeType = b.dataset.t;
  syncShapes();
  status("Форма новой фигуры: ".concat(b.getAttribute("aria-label"), " — нажмите «Добавить фигуру»"), true);
});
document.querySelectorAll(".seg.shapeMode button").forEach((b) => b.onclick = () => {
  const list = S().cacheShapes || [], c = list[ui.selShape], targets = c ? [c] : list;
  if (!targets.length) {
    status("Сначала добавьте фигуру", true);
    return;
  }
  for (const t of targets) {
    t.frame = b.dataset.m === "frame";
    t.dimOnly = b.dataset.m === "dim";
  }
  syncShapes();
  changed();
  status("".concat(c ? shapeName(c) + " " + (ui.selShape + 1) : "Все фигуры", ": снаружи — ").concat(b.textContent.toLowerCase()), true);
});
for (const [id, k, ax] of [["shapeWcm", "w", 0], ["shapeHcm", "h", 1]]) $(id).addEventListener("input", (e) => {
  const st = S(), c = st.cacheShapes[ui.selShape], v = parseFloat(String(e.target.value).replace(",", "."));
  if (!c || !(v > 0)) return;
  const px = Math.max(4, Math.round(v * 10 / mmPerPx(st)[ax]));
  if (c.lock) {
    c.w = c.h = px;
  } else c[k] = px;
  syncShapes();
  changed();
});
$("shapeN").addEventListener("input", (e) => {
  const c = S().cacheShapes[ui.selShape], v = pint(e.target.value, -1);
  if (c && v >= 0) {
    c.r = Math.min(v, Math.floor(Math.min(c.w, c.h) / 2));
    changed();
  }
});
for (const [id, k, lo, hi] of [["shapeTb", "tb", 5, 100], ["shapeSk", "sk", -100, 100]]) $(id).addEventListener("input", (e) => {
  const c = S().cacheShapes[ui.selShape], v = parseFloat(String(e.target.value).replace(",", "."));
  if (!c || c.t !== "trap" || !isFinite(v)) return;
  c[k] = Math.max(lo, Math.min(hi, Math.round(v)));
  changed();
});
$("shapeRot").addEventListener("input", (e) => {
  const c = S().cacheShapes[ui.selShape], v = parseFloat(String(e.target.value).replace(",", "."));
  if (!c || !isFinite(v)) return;
  c.rot = normRot(v);
  changed();
});
for (const [id, d] of [["shapeRotCCW", -15], ["shapeRot0", 0], ["shapeRotCW", 15]]) $(id).onclick = () => {
  const c = S().cacheShapes[ui.selShape];
  if (!c) return;
  c.rot = d ? normRot((+c.rot || 0) + d) : 0;
  syncShapes();
  changed();
};
// ---- подложка ----
// Прилипание краёв подложки к линиям кабинетов (в пикселях маски)
function refSnapLines(st) {
  if (st.kind === "ring") {
    const [W2, H2] = dims(st);
    return { vx: [0, W2 / 2, W2], vy: [0, H2 / 2, H2] };
  }
  const { xs, ys } = grid(st), [, H] = dims(st);
  return { vx: xs.slice(), vy: ys.map((y) => H - y) };
}
const orV = (a, b) => a === null ? b : a;
function snapTo(v, lines, tol) {
  let best = null;
  for (const l of lines) if (Math.abs(l - v) <= tol && (best === null || Math.abs(l - v) < Math.abs(best - v))) best = l;
  return best;
}
const REF_HANDLES = [["nw", 0, 0], ["n", 0.5, 0], ["ne", 1, 0], ["e", 1, 0.5], ["se", 1, 1], ["s", 0.5, 1], ["sw", 0, 1], ["w", 0, 0.5]];
function refPointerDown(x, y) {
  const st = S(), R = st.cacheRef;
  if (!ui.refEdit || !R || !L || st.kind && st.kind !== "led" && st.kind !== "proj" && st.kind !== "ring") return null;
  const s = L.scale, [rx, ry, rw, rh] = refRect(st), X = L.ox + rx * s, Y = L.oy + ry * s, W = rw * s, H = rh * s;
  for (const [m, fx, fy] of REF_HANDLES) if (Math.abs(x - (X + W * fx)) <= 9 && Math.abs(y - (Y + H * fy)) <= 9) {
    refToFree(st);
    return { kind: "refSize", m, x, y, r0: [rx, ry, rw, rh] };
  }
  if (x >= X && x <= X + W && y >= Y && y <= Y + H) {
    refToFree(st);
    return { kind: "refMove", x, y, r0: [rx, ry, rw, rh] };
  }
  return null;
}
function refPointerMove(a, p, e) {
  const st = S(), R = st.cacheRef;
  if (!R || !L) return;
  const s = L.scale, dx = (p[0] - a.x) / s, dy = (p[1] - a.y) / s, tol = e.altKey ? -1 : 8 / s, { vx, vy } = refSnapLines(st);
  let [x, y, w, h] = a.r0;
  if (a.kind === "refMove") {
    x += dx;
    y += dy;
    const sx0 = snapTo(x, vx, tol), sx1 = snapTo(x + w, vx, tol), sy0 = snapTo(y, vy, tol), sy1 = snapTo(y + h, vy, tol);
    if (sx0 !== null && (sx1 === null || Math.abs(sx0 - x) <= Math.abs(sx1 - x - w))) x = sx0;
    else if (sx1 !== null) x = sx1 - w;
    if (sy0 !== null && (sy1 === null || Math.abs(sy0 - y) <= Math.abs(sy1 - y - h))) y = sy0;
    else if (sy1 !== null) y = sy1 - h;
  } else {
    let x0 = x, y0 = y, x1 = x + w, y1 = y + h;
    const m = a.m;
    if (m.includes("w")) x0 = orV(snapTo(x0 + dx, vx, tol), x0 + dx);
    if (m.includes("e")) x1 = orV(snapTo(x1 + dx, vx, tol), x1 + dx);
    if (m.includes("n")) y0 = orV(snapTo(y0 + dy, vy, tol), y0 + dy);
    if (m.includes("s")) y1 = orV(snapTo(y1 + dy, vy, tol), y1 + dy);
    if (x1 - x0 < 10) m.includes("w") ? x0 = x1 - 10 : x1 = x0 + 10;
    if (y1 - y0 < 10) m.includes("n") ? y0 = y1 - 10 : y1 = y0 + 10;
    const im = refImg(R.id);
    if ((R.keep || e.shiftKey) && im) {
      // пропорции картинки: по углам — по большему изменению, по сторонам — вторая сторона от центра
      const ar = im.naturalWidth / im.naturalHeight;
      let nw = x1 - x0, nh = y1 - y0;
      if (m.length === 2) {
        if (Math.abs(nw - w) / w >= Math.abs(nh - h) / h) nh = nw / ar;
        else nw = nh * ar;
        if (m.includes("w")) x0 = x1 - nw;
        else x1 = x0 + nw;
        if (m.includes("n")) y0 = y1 - nh;
        else y1 = y0 + nh;
      } else if (m === "e" || m === "w") {
        nh = nw / ar;
        y0 = y + h / 2 - nh / 2;
        y1 = y0 + nh;
      } else {
        nw = nh * ar;
        x0 = x + w / 2 - nw / 2;
        x1 = x0 + nw;
      }
    }
    [x, y, w, h] = [x0, y0, x1 - x0, y1 - y0];
  }
  Object.assign(R, { fit: "free", x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
  syncShapes();
  changed();
}
function selCabRange() {
  let c0 = Infinity, c1 = -Infinity, r0 = Infinity, r1 = -Infinity;
  for (const k of ui.selected) {
    const p = parseKey(k);
    if (!p) continue;
    c0 = Math.min(c0, p[0]);
    c1 = Math.max(c1, p[0]);
    r0 = Math.min(r0, p[1]);
    r1 = Math.max(r1, p[1]);
  }
  return isFinite(c0) ? { c0, c1, r0, r1 } : null;
}
$("refLoad").onclick = () => $("refFile").click();
$("refFile").addEventListener("change", async (e) => {
  const f = e.target.files && e.target.files[0];
  e.target.value = "";
  if (!f) return;
  try {
    const url = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(new Error("файл не прочитан"));
      r.readAsDataURL(f);
    });
    const im = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("это не картинка"));
      i.src = url;
    });
    // уменьшаем до 2400 px по большей стороне, чтобы проект оставался лёгким
    const k = Math.min(1, 2400 / Math.max(im.naturalWidth, im.naturalHeight)), cv = document.createElement("canvas");
    cv.width = Math.max(1, Math.round(im.naturalWidth * k));
    cv.height = Math.max(1, Math.round(im.naturalHeight * k));
    cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height);
    let data = cv.toDataURL("image/png");
    if (data.length > 2e6) data = cv.toDataURL("image/jpeg", 0.88);
    const id = "ref" + Date.now().toString(36), st = S(), rg = selCabRange();
    REF_IMGS[id] = data;
    st.cacheRef = { id, fit: rg ? "cab" : "screen", ...rg || { c0: 0, c1: 0, r0: 0, r1: 0 }, a: 50, show: true, keep: false };
    syncShapes();
    changed();
    status(rg ? "Подложка растянута на выделенные кабинеты" : "Подложка растянута на весь экран — для привязки к кабинетам выделите их и нажмите «Кабинеты»", true);
  } catch (err) {
    status("Картинка не загружена: " + err.message, true);
  }
});
$("refDel").onclick = () => {
  const st = S();
  if (!st.cacheRef) return;
  st.cacheRef = null;
  syncShapes();
  changed();
};
document.querySelectorAll(".seg.refFit button").forEach((b) => b.onclick = () => {
  const st = S(), R = st.cacheRef;
  if (!R) return;
  if (b.dataset.f === "cab") {
    const rg = selCabRange();
    if (!rg) {
      status("Сначала выделите кабинеты на холсте, на которые нужно растянуть картинку", true);
      return;
    }
    Object.assign(R, rg, { fit: "cab" });
  } else R.fit = "screen";
  syncShapes();
  changed();
});
// свободное положение подложки: из текущего прямоугольника
function refToFree(st) {
  const R = st.cacheRef;
  if (!R || R.fit === "free") return R;
  const [x, y, w, h] = refRect(st);
  return Object.assign(R, { fit: "free", x, y, w, h });
}
$("refEdit").addEventListener("change", (e) => {
  ui.refEdit = e.target.checked;
  if (ui.refEdit) {
    ui.selShape = -1;
    ui.bezDraw = null;
  }
  syncShapes();
  requestDraw();
  status(ui.refEdit ? "Подложка: тащите за середину, растягивайте за фиолетовые квадратики; края прилипают к кабинетам, Alt — без прилипания" : "Подложка закреплена", true);
});
for (const [id, k] of [["refX", "x"], ["refY", "y"], ["refW", "w"], ["refH", "h"]]) $(id).addEventListener("input", (e) => {
  const st = S(), v = parseFloat(String(e.target.value).replace(",", "."));
  if (!st.cacheRef || !isFinite(v)) return;
  const R = refToFree(st), im = refImg(R.id);
  if ((k === "w" || k === "h") && v < 10) return;
  if (R.keep && im && (k === "w" || k === "h")) {
    const ar = im.naturalWidth / im.naturalHeight;
    if (k === "w") Object.assign(R, { w: v, h: v / ar });
    else Object.assign(R, { h: v, w: v * ar });
  } else R[k] = v;
  syncShapes();
  changed();
});
$("refKeep").addEventListener("change", (e) => {
  const R = S().cacheRef;
  if (!R) return;
  R.keep = e.target.checked;
  changed();
});
$("refShow").addEventListener("change", (e) => {
  const R = S().cacheRef;
  if (!R) return;
  R.show = e.target.checked;
  changed();
});
$("refAlpha").addEventListener("input", (e) => {
  const R = S().cacheRef;
  if (!R) return;
  R.a = 100 - +e.target.value;
  $("refAlphaV").textContent = e.target.value + "%";
  changed();
});
$("shapeBezDone").onclick = () => bezFinish();
$("shapeBezCancel").onclick = () => bezCancel();
$("shapeBezDel").onclick = () => bezDeletePoint();
pv.addEventListener("dblclick", (e) => {
  if (ui.page && ui.page !== "mask") return;
  const [x, y] = local(e);
  if (bezDblClick(x, y)) e.preventDefault();
});
window.addEventListener("keydown", (e) => {
  if (ui.page && ui.page !== "mask") return;
  const t = e.target;
  if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
  if (ui.bezDraw) {
    if (e.key === "Enter") {
      e.preventDefault();
      bezFinish();
    } else if (e.key === "Escape") {
      e.preventDefault();
      bezCancel();
    } else if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      ui.bezDraw.pts.pop();
      requestDraw();
    }
    return;
  }
  const c = (S().cacheShapes || [])[ui.selShape];
  if (c && c.t === "bez" && ui.bezSel >= 0 && (e.key === "Backspace" || e.key === "Delete")) {
    e.preventDefault();
    bezDeletePoint();
  }
});
$("shapeFlip").addEventListener("change", (e) => {
  const c = S().cacheShapes[ui.selShape];
  if (!c || c.t !== "trap") return;
  c.flip = e.target.checked;
  syncShapes();
  changed();
});
$("shapeInv").addEventListener("change", (e) => {
  const c = S().cacheShapes[ui.selShape];
  if (!c) return;
  c.inv = e.target.checked;
  syncShapes();
  changed();
});
$("shapeLock").addEventListener("change", (e) => {
  const c = S().cacheShapes[ui.selShape];
  if (!c) return;
  c.lock = e.target.checked;
  if (c.lock) c.h = c.w;
  syncShapes();
  changed();
});
$("shapeLine").addEventListener("change", (e) => {
  S().cacheLine = e.target.checked;
  changed();
});
$("shapeLW").addEventListener("input", (e) => {
  const v = pint(e.target.value, 0);
  if (v >= 1 && v <= 200) {
    S().cacheLineW = v;
    changed();
  }
});
$("shapeLC").addEventListener("input", (e) => {
  S().cacheLineColor = e.target.value.toUpperCase();
  changed();
});
$("shapeDim").addEventListener("input", (e) => {
  S().cacheDim = +e.target.value;
  $("shapeDimV").textContent = e.target.value + "%";
  changed();
});
$("shapeLA").addEventListener("input", (e) => {
  S().cacheLineA = +e.target.value;
  $("shapeLAV").textContent = e.target.value + "%";
  changed();
});
syncShapes();
{
  let justFocused = null;
  document.addEventListener("focusin", (e) => {
    const t = e.target;
    if (!t || t.tagName !== "INPUT") return;
    if (!(t.type === "number" || t.type === "text" && (t.classList.contains("num") || t.inputMode === "decimal" || t.inputMode === "numeric"))) return;
    if (t.readOnly) return;
    justFocused = t;
    setTimeout(() => {
      try {
        t.select();
      } catch (x) {
      }
    }, 0);
  });
  document.addEventListener("mouseup", (e) => {
    if (justFocused && e.target === justFocused) {
      e.preventDefault();
    }
    justFocused = null;
  }, true);
}
// 2.0.74: первый запуск — текущее состояние считаем сохранённым; дальше «несохранённое» помнится между запусками
if (savedHash() == null) markSaved();
else updateProjState();
window.__appReady = true;
if (!STANDALONE) (async () => {
  try {
    downloads = window.claude && window.claude.use ? await window.claude.use("downloads") : null;
  } catch (e) {
    downloads = null;
  }
  if (!downloads) $("exportNote").textContent += " Сохранение файлов доступно, когда страница открыта по ссылке Claude.";
})();
// ===== 2.0.157: «Кольцо» — панель, выбор и поворот кабинетов мышью =====
ui.ringSel = /* @__PURE__ */ new Set();
ui.ringAnchor = "";
ui.ringPri = "";
ui.ringCur = 0;
ui.ringUid = "";
function ringCtx() {
  const st = S();
  if (st.kind !== "ring") return null;
  const R = st.ring || (st.ring = defRing());
  if (ui.ringUid !== st.uid) {
    ui.ringUid = st.uid;
    ui.ringSel.clear();
    ui.ringPri = "";
    ui.ringAnchor = "";
    ui.ringCur = 0;
  }
  if (ui.ringCur >= R.rings.length) ui.ringCur = R.rings.length - 1;
  if (ui.ringCur < 0) ui.ringCur = 0;
  return { st, R, g: R.rings[ui.ringCur] };
}
function ringMod(R, k) {
  return R.mods[k] || (R.mods[k] = {});
}
function ringClean(R) {
  for (const [k, v] of Object.entries(R.mods)) {
    for (const f of ["dx", "dy", "dr"]) if (v[f] != null && Math.abs(v[f]) < 1e-6) delete v[f];
    if (!v.off) delete v.off;
    if (!Object.keys(v).length) delete R.mods[k];
  }
}
function ringSelMods(st) {
  return ringGeom(st).list.filter((m) => ui.ringSel.has(m.k));
}
function syncRingUI() {
  const c = ringCtx();
  if (!c) return;
  const { R, g } = c, set = (id, v) => {
    if (document.activeElement !== $(id)) setVal($(id), v);
  };
  const sel = $("rgType");
  if (!sel.options.length) sel.innerHTML = TYPES.map((t, i) => '<option value="'.concat(i, '">').concat(xmlEsc(t[0]), "</option>")).join("") + '<option value="">Своё разрешение</option>';
  const cab = ringCab(R, g);
  const ti = TYPES.findIndex((t) => t[0] === cab.type && t[1] === cab.cw && t[2] === cab.ch);
  setVal(sel, ti >= 0 ? ti : "");
  if (window.rgTypeUI) window.rgTypeUI.sync();
  set("rgCw", cab.cw);
  set("rgCh", cab.ch);
  set("rgMw", compactM(+cab.mw));
  set("rgMh", compactM(+cab.mh));
  const lst = $("rgList"), items = R.rings.map((r, i) => {
    const q = ringCab(R, r), nb = Math.max(1, r.bw | 0) * Math.max(1, r.bh | 0);
    return "Кольцо ".concat(i + 1, " · ").concat(q.type || q.cw + "×" + q.ch, " · ").concat(r.n, nb > 1 ? "×" + nb : "", " шт · Ø ").concat(Math.round(r.dw), r.dw !== r.dh ? "×" + Math.round(r.dh) : "", " px");
  });
  if (lst.__items !== items.join("|")) {
    lst.__items = items.join("|");
    lst.innerHTML = items.map((t, i) => '<option value="'.concat(i, '">').concat(xmlEsc(t), "</option>")).join("");
  }
  setVal(lst, ui.ringCur);
  if (window.rgListUI) window.rgListUI.sync();
  $("rgDel").disabled = R.rings.length < 2;
  set("rgN", g.n);
  set("rgDw", Math.round(g.dw));
  set("rgDh", Math.round(g.dh));
  set("rgDwCm", compactM(+(g.dw * ringMmX(R) / 10).toFixed(1)));
  set("rgDhCm", compactM(+(g.dh * ringMmY(R) / 10).toFixed(1)));
  set("rgBw", g.bw || 1);
  set("rgBh", g.bh || 1);
  $("rgLock").checked = g.lock !== false;
  set("rgA0", +(+g.a0 || 0).toFixed(2));
  set("rgArc", +(+g.arc || 360).toFixed(2));
  set("rgOx", Math.round(+g.ox || 0));
  set("rgOy", Math.round(+g.oy || 0));
  $("rgColor").value = (g.color || "#7a0f2b").toLowerCase();
  document.querySelectorAll(".seg.rgdir button").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.v === (g.dir === -1 ? -1 : 1))));
  document.querySelectorAll(".seg.rgface button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === (g.face === "up" ? "up" : "in"))));
  $("rgAuto").checked = R.auto !== false;
  $("rgPadRow").hidden = R.auto === false;
  $("rgSizeRow").hidden = R.auto !== false;
  set("rgPad", R.pad);
  const gg = ringGeom(c.st);
  set("rgW", R.auto !== false ? gg.W : R.W);
  set("rgH", R.auto !== false ? gg.H : R.H);
  $("rgNums").checked = R.nums !== false;
  $("rgOutline").checked = R.outline !== false;
  setVal($("rgFmt"), R.numFmt || "rm");
  const sm = gg.list.filter((m) => ui.ringSel.has(m.k)), pri = sm.find((m) => m.k === ui.ringPri) || sm[0];
  for (const id of ["rgRot", "rgRotM15", "rgRotM1", "rgRotP1", "rgRotP15", "rgOff", "rgReset", "rgSelColor", "rgSelColorReset"]) $(id).disabled = !sm.length;
  $("rgGroup").disabled = ui.ringSel.size < 2;
  $("rgUngroup").disabled = !ui.ringSel.size || !(R.groups || []).some((a) => a.some((k) => ui.ringSel.has(k)));
  if (pri) $("rgSelColor").value = ((pri.color || R.rings[pri.ri] && R.rings[pri.ri].color || "#7a0f2b") + "").toLowerCase();
  $("rgSelColorReset").disabled = !sm.some((m) => c.R.mods[m.k] && c.R.mods[m.k].color);
  if (pri) set("rgRot", +pri.rot.toFixed(2));
  else if (document.activeElement !== $("rgRot")) setVal($("rgRot"), "");
  setTxt($("rgSelInfo"), sm.length ? "Выбрано: ".concat(sm.length).concat(pri ? " · ".concat(ringLabel(R, pri, c.st), " · угол ").concat(angS(pri.rot), "°") : "").concat(sm.some((m) => m.off) ? " · есть погашенные" : "") : "Кабинеты не выбраны — щёлкните по кабинету на холсте или обведите несколько рамкой.");
}
function ringChanged(phys) {
  syncRingUI();
  changed({ forcePhys: !!phys });
}
// 2.0.177: только режим «Кольцо». Позиции кольца хранятся в пикселях маски; при смене разрешения кабинета
// (тот же физический размер) переводим их в новые пиксели, чтобы кабинеты остались на тех же местах, менялось лишь разрешение
function ringRescale(c, o, n) {
  const fx = (n.cw / n.mw) / (o.cw / o.mw), fy = (n.ch / n.mh) / (o.ch / o.mh);
  if (!isFinite(fx) || !isFinite(fy) || (Math.abs(fx - 1) < 1e-9 && Math.abs(fy - 1) < 1e-9)) return;
  const q = (v) => Math.round(v * 100) / 100, R = c.R, g = c.g, ri = R.rings.indexOf(g);
  g.dw = q(Math.max(2, (+g.dw || 2) * fx));
  g.dh = q(Math.max(2, (+g.dh || 2) * fy));
  g.ox = q((+g.ox || 0) * fx);
  g.oy = q((+g.oy || 0) * fy);
  for (const k of Object.keys(R.mods || {})) {
    if (k.split(",")[0] !== String(ri)) continue;
    const m = R.mods[k];
    if (m.dx) m.dx = q(m.dx * fx);
    if (m.dy) m.dy = q(m.dy * fy);
  }
  if (R.rings.length === 1) {
    R.pad = Math.round((+R.pad || 0) * Math.max(fx, fy));
    if (R.auto === false) {
      R.W = Math.max(16, Math.round(R.W * fx));
      R.H = Math.max(16, Math.round(R.H * fy));
    }
  }
}
// --- кабинет ---
$("rgType").addEventListener("change", (e) => {
  const c = ringCtx(), t = TYPES[+e.target.value];
  if (!c || e.target.value === "" || !t) return;
  const cab = { type: t[0], cw: t[1], ch: t[2], mw: t[3], mh: t[4] };
  // 2.0.177: физические размеры колец не меняются — пересчитываем позиции под новое разрешение кабинета
  ringRescale(c, ringCab(c.R, c.g), cab);
  // 2.0.163: тип кабинета — у каждого кольца свой, цвет берём из каталога, как в LED-масках
  Object.assign(c.g, cab, { color: typeColor(t[0], t[1], t[2]) || c.g.color });
  Object.assign(c.R, cab);
  ringChanged(true);
});
const ringCabNum = (id, k, float) => $(id).addEventListener("input", () => {
  const c = ringCtx(), v = float ? parseFloat(String($(id).value).replace(",", ".")) : pint($(id).value, NaN);
  if (!c || !(isFinite(v) && v > 0)) return;
  const val = float ? v : Math.min(16384, v);
  if (k === "cw" || k === "ch") {
    const o = ringCab(c.R, c.g);
    ringRescale(c, o, { ...o, [k]: val });
  }
  c.g[k] = val;
  c.R[k] = val;
  if (k === "cw" || k === "ch") c.g.type = c.R.type = "";
  ringChanged(true);
});
ringCabNum("rgCw", "cw", false);
ringCabNum("rgCh", "ch", false);
ringCabNum("rgMw", "mw", true);
ringCabNum("rgMh", "mh", true);
// --- кольца ---
$("rgList").addEventListener("change", (e) => {
  ui.ringCur = +e.target.value || 0;
  ui.ringSel.clear();
  syncRingUI();
  requestDraw();
});
$("rgAdd").onclick = () => {
  const c = ringCtx();
  if (!c) return;
  c.R.rings.push(defRingItem(c.R.rings.length, c.R));
  ui.ringCur = c.R.rings.length - 1;
  ui.ringSel.clear();
  ringChanged(true);
  status("Добавлено кольцо ".concat(c.R.rings.length, " — снаружи предыдущего"), true);
};
$("rgDel").onclick = () => {
  const c = ringCtx();
  if (!c || c.R.rings.length < 2) return;
  const del = ui.ringCur, mods = {};
  for (const [k, v] of Object.entries(c.R.mods)) {
    const parts = k.split(","), ri = +parts[0];
    if (ri === del) continue;
    parts[0] = ri > del ? ri - 1 : ri;
    mods[parts.join(",")] = v;
  }
  c.R.groups = (c.R.groups || []).map((a) => a.filter((k) => +k.split(",")[0] !== del).map((k) => {
    const q = k.split(",");
    q[0] = +q[0] > del ? +q[0] - 1 : +q[0];
    return q.join(",");
  })).filter((a) => a.length > 1);
  c.R.mods = mods;
  c.R.rings.splice(del, 1);
  ui.ringCur = Math.max(0, del - 1);
  ui.ringSel.clear();
  ringChanged(true);
};
$("rgN").addEventListener("input", () => {
  const c = ringCtx(), v = pint($("rgN").value, NaN);
  if (!c || !(v >= 1 && v <= 2000)) return;
  c.g.n = v;
  for (const k of Object.keys(c.R.mods)) {
    const [ri, i] = k.split(",").map(Number);
    if (ri === ui.ringCur && i >= v) delete c.R.mods[k];
  }
  for (const k of [...ui.ringSel]) if (+k.split(",")[1] >= v) ui.ringSel.delete(k);
  ringChanged(true);
});
for (const [id, k] of [["rgBw", "bw"], ["rgBh", "bh"]]) $(id).addEventListener("input", () => {
  const c = ringCtx(), v = pint($(id).value, NaN);
  if (!c || !(v >= 1 && v <= 20)) return;
  c.g[k] = v;
  const ri = ui.ringCur, cap = Math.max(1, c.g.bw | 0) * Math.max(1, c.g.bh | 0);
  // убрать правки и выбор кабинетов блока, которых больше нет
  for (const key of Object.keys(c.R.mods)) {
    const p = key.split(",");
    if (+p[0] === ri && p.length === 3 && +p[2] >= cap) delete c.R.mods[key];
  }
  for (const key of [...ui.ringSel]) {
    const p = key.split(",");
    if (+p[0] === ri && p.length === 3 && +p[2] >= cap) ui.ringSel.delete(key);
  }
  ringChanged(true);
});
function ringSetD(axis, px) {
  const c = ringCtx();
  if (!c || !(px >= 2)) return;
  const g = c.g, other = axis === "w" ? "dh" : "dw", self = axis === "w" ? "dw" : "dh";
  if (g.lock !== false) g[other] = Math.max(2, Math.round(px * g[other] / g[self]));
  g[self] = Math.round(px);
  ringChanged(true);
}
$("rgDw").addEventListener("input", () => ringSetD("w", parseFloat(String($("rgDw").value).replace(",", "."))));
$("rgDh").addEventListener("input", () => ringSetD("h", parseFloat(String($("rgDh").value).replace(",", "."))));
$("rgDwCm").addEventListener("input", () => {
  const c = ringCtx(), v = parseFloat(String($("rgDwCm").value).replace(",", "."));
  if (c && v > 0) ringSetD("w", v * 10 / ringMmX(c.R));
});
$("rgDhCm").addEventListener("input", () => {
  const c = ringCtx(), v = parseFloat(String($("rgDhCm").value).replace(",", "."));
  if (c && v > 0) ringSetD("h", v * 10 / ringMmY(c.R));
});
$("rgLock").addEventListener("change", (e) => {
  const c = ringCtx();
  if (!c) return;
  c.g.lock = e.target.checked;
  ringChanged();
});
$("rgCircle").onclick = () => {
  const c = ringCtx();
  if (!c) return;
  c.g.dh = c.g.dw;
  ringChanged(true);
};
const ringNum = (id, k, lo, hi) => $(id).addEventListener("input", () => {
  const c = ringCtx(), v = parseFloat(String($(id).value).replace(",", "."));
  if (!c || !isFinite(v) || v < lo || v > hi) return;
  c.g[k] = v;
  ringChanged(true);
});
ringNum("rgA0", "a0", -3600, 3600);
ringNum("rgArc", "arc", 1, 360);
ringNum("rgOx", "ox", -1e5, 1e5);
ringNum("rgOy", "oy", -1e5, 1e5);
$("rgColor").addEventListener("input", (e) => {
  const c = ringCtx();
  if (!c) return;
  c.g.color = e.target.value;
  ringChanged();
});
document.querySelectorAll(".seg.rgdir button").forEach((b) => b.onclick = () => {
  const c = ringCtx();
  if (!c) return;
  c.g.dir = +b.dataset.v === -1 ? -1 : 1;
  ringChanged(true);
});
document.querySelectorAll(".seg.rgface button").forEach((b) => b.onclick = () => {
  const c = ringCtx();
  if (!c) return;
  c.g.face = b.dataset.v === "up" ? "up" : "in";
  ringChanged(true);
});
// --- холст и номера ---
$("rgAuto").addEventListener("change", (e) => {
  const c = ringCtx();
  if (!c) return;
  if (!e.target.checked) {
    const gg = ringGeom(c.st);
    c.R.W = gg.W;
    c.R.H = gg.H;
  }
  c.R.auto = e.target.checked;
  ringChanged(true);
});
$("rgPad").addEventListener("input", () => {
  const c = ringCtx(), v = pint($("rgPad").value, NaN);
  if (!c || !(v >= 0)) return;
  c.R.pad = v;
  ringChanged(true);
});
for (const [id, k] of [["rgW", "W"], ["rgH", "H"]]) $(id).addEventListener("input", () => {
  const c = ringCtx(), v = pint($(id).value, NaN);
  if (!c || !(v >= 16 && v <= 32768) || c.R.auto !== false) return;
  c.R[k] = v;
  ringChanged(true);
});
$("rgNums").addEventListener("change", (e) => {
  const c = ringCtx();
  if (!c) return;
  c.R.nums = e.target.checked;
  ringChanged();
});
$("rgOutline").addEventListener("change", (e) => {
  const c = ringCtx();
  if (!c) return;
  c.R.outline = e.target.checked;
  ringChanged();
});
$("rgFmt").addEventListener("change", (e) => {
  const c = ringCtx();
  if (!c) return;
  c.R.numFmt = e.target.value;
  ringChanged();
});
// --- выбранные кабинеты ---
function ringRotateSel(delta, abs) {
  const c = ringCtx();
  if (!c || !ui.ringSel.size) return;
  const seen = new Set(), gg = ringGeom(c.st);
  // 2.0.169: сгруппированные кабинеты крутятся как один жёсткий объект вокруг общего центра
  const priM = gg.list.find((m) => m.k === ui.ringPri && ui.ringSel.has(m.k));
  const gd = abs != null ? priM ? ringNormDeg(abs - priM.rot) : 0 : delta, gr = gd * Math.PI / 180, gc = Math.cos(gr), gs = Math.sin(gr);
  for (const m of ringSelMods(c.st)) {
    if (seen.has(m.k)) continue;
    const pv = ringPivot(gg, m);
    if (!pv) continue;
    for (const q of pv.mem) {
      seen.add(q.k);
      const o = ringMod(c.R, q.k), rx = q.cx - pv.cx, ry = q.cy - pv.cy;
      o.dx = Math.round(((o.dx || 0) + pv.cx + rx * gc - ry * gs - q.cx) * 100) / 100;
      o.dy = Math.round(((o.dy || 0) + pv.cy + rx * gs + ry * gc - q.cy) * 100) / 100;
      o.dr = Math.round(((((o.dr || 0) + gd) % 360 + 540) % 360 - 180) * 100) / 100;
    }
  }
  for (const m of ringSelMods(c.st)) {
    if (seen.has(m.k)) continue;
    seen.add(m.k);
    const o = ringMod(c.R, m.k), cur = m.base + (o.dr || 0);
    o.dr = (abs != null ? abs : cur + delta) - m.base;
    o.dr = Math.round(((o.dr % 360 + 540) % 360 - 180) * 100) / 100;
  }
  ringClean(c.R);
  ringChanged();
}
$("rgRot").addEventListener("input", () => {
  const v = parseFloat(String($("rgRot").value).replace(",", "."));
  if (isFinite(v)) ringRotateSel(0, v);
});
$("rgRotM15").onclick = () => ringRotateSel(-15);
$("rgRotM1").onclick = () => ringRotateSel(-1);
$("rgRotP1").onclick = () => ringRotateSel(1);
$("rgRotP15").onclick = () => ringRotateSel(15);
$("rgSelRing").onclick = () => {
  const c = ringCtx();
  if (!c) return;
  ui.ringSel = new Set(ringGeom(c.st).list.filter((m) => m.ri === ui.ringCur).map((m) => m.k));
  ui.ringPri = ui.ringCur + ",0";
  syncRingUI();
  requestDraw();
};
$("rgOff").onclick = () => {
  const c = ringCtx();
  if (!c || !ui.ringSel.size) return;
  const sm = ringSelMods(c.st), on = sm.some((m) => !m.off);
  for (const m of sm) ringMod(c.R, m.k).off = on;
  ringClean(c.R);
  ringChanged();
  status(on ? "Выбранные кабинеты погашены" : "Выбранные кабинеты снова светятся", true);
};
$("rgReset").onclick = () => {
  const c = ringCtx();
  if (!c || !ui.ringSel.size) return;
  for (const k of ui.ringSel) if (c.R.mods[k]) {
    delete c.R.mods[k].dx;
    delete c.R.mods[k].dy;
    delete c.R.mods[k].dr;
  }
  ringClean(c.R);
  ringChanged(true);
  status("Выбранные кабинеты возвращены на кольцо", true);
};
$("rgGroup").onclick = () => {
  const c = ringCtx();
  if (!c || ui.ringSel.size < 2) return status("Выберите хотя бы два кабинета", true);
  const keys = [...ui.ringSel];
  c.R.groups = (c.R.groups || []).filter((a) => !a.some((k) => ui.ringSel.has(k)));
  c.R.groups.push(keys);
  ringChanged(true);
  status("Сгруппировано кабинетов: " + keys.length, true);
};
$("rgUngroup").onclick = () => {
  const c = ringCtx();
  if (!c || !ui.ringSel.size) return;
  const before = (c.R.groups || []).length;
  c.R.groups = (c.R.groups || []).filter((a) => !a.some((k) => ui.ringSel.has(k)));
  if (before === c.R.groups.length) return status("Выбранные кабинеты не в группе", true);
  ringChanged(true);
  status("Группы сняты: " + (before - c.R.groups.length), true);
};
$("rgSelColor").addEventListener("input", (e) => {
  const c = ringCtx();
  if (!c || !ui.ringSel.size) return;
  for (const k of ui.ringSel) ringMod(c.R, k).color = e.target.value;
  ringChanged();
});
$("rgSelColorReset").onclick = () => {
  const c = ringCtx();
  if (!c || !ui.ringSel.size) return;
  for (const k of ui.ringSel) if (c.R.mods[k]) delete c.R.mods[k].color;
  ringClean(c.R);
  ringChanged();
  status("Цвет выбранных кабинетов — как у кольца", true);
};
// клавиатура для колец (как у масок): стрелки — сдвиг, [ ] — поворот, Delete — погасить, Esc — снять выбор
window.addEventListener("keydown", (e) => {
  const c = ringCtx();
  if (!c || ui.page !== "mask" || !$("modal").hidden) return;
  const t = e.target;
  if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && t.type !== "checkbox" || t.isContentEditable)) return;
  if (e.key === "Escape") {
    if (ui.ringSel.size) {
      ui.ringSel.clear();
      ui.ringPri = "";
      ui.ringAnchor = "";
      syncRingUI();
      requestDraw();
    }
    return;
  }
  if (!ui.ringSel.size) return;
  if (e.key === "Delete" || e.key === "Backspace") {
    e.preventDefault();
    $("rgOff").click();
    return;
  }
  if (e.key === "[" || e.key === "]") {
    e.preventDefault();
    ringRotateSel(e.key === "[" ? e.shiftKey ? -15 : -1 : e.shiftKey ? 15 : 1);
    return;
  }
  const d = e.shiftKey ? 10 : 1, mv = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }[e.key];
  if (!mv || e.ctrlKey || e.metaKey) return;
  e.preventDefault();
  for (const k of ui.ringSel) {
    const o = ringMod(c.R, k);
    o.dx = Math.round(((o.dx || 0) + mv[0]) * 100) / 100;
    o.dy = Math.round(((o.dy || 0) + mv[1]) * 100) / 100;
  }
  ringChanged();
});
// --- холст: выбор, сдвиг, поворот, растяжение кольца ---
function ringToMask(x, y) {
  return [(x - L.ox) / L.scale, (y - L.oy) / L.scale];
}
function ringRotHandle(m, gg) {
  const s = L.scale, a = m.rot * Math.PI / 180, pv = gg && ringPivot(gg, m), hr = pv ? pv.r : m.h / 2, d = hr * s + 26;
  const cx = L.ox + (pv ? pv.x : m.x) * s, cy = L.oy + (pv ? pv.y : m.y) * s;
  return [cx + Math.sin(a) * d, cy - Math.cos(a) * d, cx + Math.sin(a) * hr * s, cy - Math.cos(a) * hr * s];
}
function ringHandles(st) {
  const gg = ringGeom(st), R = gg.R, g = R.rings[ui.ringCur];
  if (!g) return [];
  const s = L.scale, cx = L.ox + (gg.W / 2 + (+g.ox || 0)) * s, cy = L.oy + (gg.H / 2 + (+g.oy || 0)) * s, a = g.dw / 2 * s, b = g.dh / 2 * s;
  return [["nw", -1, -1], ["n", 0, -1], ["ne", 1, -1], ["e", 1, 0], ["se", 1, 1], ["s", 0, 1], ["sw", -1, 1], ["w", -1, 0]].map(([m, fx, fy]) => ({ m, p: [cx + fx * a, cy + fy * b], cx, cy, a, b }));
}
// 2.0.170: диапазон кабинетов кольца — как прямоугольный диапазон в LED-масках: колонки вдоль кольца
// (у полного кольца идём по короткой дуге) и ряды внутри блока; диапазон только внутри одного кольца
function ringRangeKeys(gg, a, b) {
  if (a.ri !== b.ri) return [b.k];
  const g = gg.R.rings[a.ri] || {}, N = Math.max(1, a.nCols), ca = a.i * a.bw + a.bx, cb = b.i * b.bw + b.bx;
  const md = (v) => (v % N + N) % N;
  let inCol;
  if ((+g.arc || 360) >= 360 && N > 2) {
    const f = md(cb - ca), bk = md(ca - cb);
    inCol = bk < f ? (c) => md(c - cb) <= bk : (c) => md(c - ca) <= f;
  } else {
    const lo = Math.min(ca, cb), hi = Math.max(ca, cb);
    inCol = (c) => c >= lo && c <= hi;
  }
  const r0 = Math.min(a.by, b.by), r1 = Math.max(a.by, b.by);
  return gg.list.filter((m) => m.ri === a.ri && inCol(m.i * m.bw + m.bx) && m.by >= r0 && m.by <= r1).map((m) => m.k);
}
// касание по уже выбранному кабинету (без сдвига) в режиме «Выбор» — убирает его (и его группу) из выбора
function ringTapCollapse(k) {
  const c = ringCtx();
  if (!c) return;
  ui.ringSel.clear();
  for (const q of ringGroupOf(c.R, k) || [k]) ui.ringSel.add(q);
  ui.ringPri = k;
  syncRingUI();
  requestDraw();
}
function ringTapToggle(k) {
  const c = ringCtx();
  if (!c) return;
  for (const q of ringGroupOf(c.R, k) || [k]) ui.ringSel.delete(q);
  if (!ui.ringSel.has(ui.ringPri)) ui.ringPri = [...ui.ringSel][0] || "";
  syncRingUI();
  requestDraw();
}
function ringPointerDown(e, x, y) {
  const c = ringCtx();
  if (!c || !L) return null;
  const st = c.st, gg = ringGeom(st), [mx, my] = ringToMask(x, y), tool = ui.tool;
  // 2.0.170: управление выделением — как в LED-масках: Ctrl/⌘ — добавить/убрать, Shift — диапазон, Alt — чёрный
  const ctrl = e.ctrlKey || e.metaKey, shift = e.shiftKey, alt = e.altKey;
  const add = ctrl || shift, black = alt || tool === "black" && !ctrl && !shift;
  // «Рука» — только панорама
  if (tool === "pan" && !alt && !ctrl && !shift) return null;
  // зелёная точка — поворот выбранных (не в режиме «Гашение»)
  const pri = gg.list.find((m) => m.k === ui.ringPri && ui.ringSel.has(m.k));
  if (pri && !black) {
    const [hx, hy] = ringRotHandle(pri, gg);
    if (Math.hypot(x - hx, y - hy) <= 11) return { kind: "ringRot", k: pri.k };
  }
  // жёлтые квадратики — растянуть кольцо (когда кабинеты не выбраны, не «Гашение»)
  if (!ui.ringSel.size && !black) for (const h of ringHandles(st)) if (Math.abs(x - h.p[0]) <= 9 && Math.abs(y - h.p[1]) <= 9) {
    const g = c.g;
    return { kind: "ringSize", m: h.m, dw0: g.dw, dh0: g.dh, cx: h.cx, cy: h.cy };
  }
  for (let j = gg.list.length - 1; j >= 0; j--) {
    const m = gg.list[j];
    if (!ringHit(m, mx, my)) continue;
    // «Гашение» (или Alt) — погасить / включить кабинет; протяжка красит соседние тем же цветом
    if (black) {
      const o = ringMod(c.R, m.k), target = !o.off;
      o.off = target;
      ringClean(c.R);
      ringChanged();
      return { kind: "ringBlack", target };
    }
    let act2 = null, tapToggle = "", tapCollapse = "";
    const grp = ringGroupOf(c.R, m.k) || [m.k];
    if (shift) {
      // Shift — диапазон от якоря до кабинета (протяжка продолжает диапазон)
      const am = gg.list.find((q) => q.k === ui.ringAnchor) || gg.list.find((q) => ui.ringSel.has(q.k)) || m;
      ui.ringAnchor = am.k;
      ui.ringSel = ringExpandSel(c.R, ringRangeKeys(gg, am, m));
      act2 = { kind: "ringRange", anchor: am.k };
    } else if (tool === "range" && !ctrl) {
      // «Диапазон» — начало диапазона, протяните пальцем
      ui.ringAnchor = m.k;
      ui.ringSel = ringExpandSel(c.R, ringRangeKeys(gg, m, m));
      act2 = { kind: "ringRange", anchor: m.k };
    } else {
      // 2.0.174: как в Keynote — щелчок мышью выбирает один кабинет, Cmd/Ctrl добавляет или убирает, Shift — диапазон, Alt — чёрный;
      // пальцем «Выбор» добавляет/убирает касанием
      ui.ringAnchor = m.k;
      if (ctrl || e.pointerType === "touch") {
        if (ui.ringSel.has(m.k)) {
          if (ctrl) for (const q of grp) ui.ringSel.delete(q);
          else tapToggle = m.k;
        } else for (const q of grp) ui.ringSel.add(q);
      } else if (!ui.ringSel.has(m.k)) {
        ui.ringSel.clear();
        for (const q of grp) ui.ringSel.add(q);
      } else if (ui.ringSel.size > grp.length) tapCollapse = m.k;
    }
    ui.ringPri = ui.ringSel.has(m.k) ? m.k : [...ui.ringSel][0] || "";
    if (ui.ringCur !== m.ri) ui.ringCur = m.ri;
    if (ui.textMode >= 0) {
      ui.textMode = -1;
      ui.selLabel = -1;
      refreshTextList();
      syncTextControls();
    }
    syncRingUI();
    requestDraw();
    if (act2) return act2;
    return ui.ringSel.has(m.k) ? { kind: "ringMove", x, y, x0: x, y0: y, tapToggle, tapCollapse } : { kind: "noop" };
  }
  if (black) return { kind: "noop" };
  if (!add && ui.ringSel.size) {
    ui.ringSel.clear();
    ui.ringPri = "";
    ui.ringAnchor = "";
    syncRingUI();
    requestDraw();
  }
  // «Диапазон» — рамка выделения (пальцем или мышью); в режиме «Выбор» рамка тоже доступна мышью
  if (tool === "range" || e.pointerType === "mouse" && tool === "select") return { kind: "ringBox", x0: x, y0: y, x, y, add, base: new Set(ui.ringSel) };
  return null;
}
function ringPointerMove(a, p, e) {
  const c = ringCtx();
  if (!c || !L) return;
  const st = c.st, s = L.scale;
  if (a.kind === "ringRange" || a.kind === "ringBlack") {
    // протяжка: диапазон тянется до кабинета под пальцем, «Гашение» красит кабинеты под пальцем
    const [mx, my] = ringToMask(p[0], p[1]), gg = ringGeom(st), list = gg.list;
    let h = null;
    for (let j = list.length - 1; j >= 0; j--) if (ringHit(list[j], mx, my)) {
      h = list[j];
      break;
    }
    if (!h) return;
    if (a.kind === "ringBlack") {
      const o = ringMod(c.R, h.k);
      if (!!o.off !== a.target) {
        o.off = a.target;
        ringClean(c.R);
        ringChanged();
      }
    } else {
      const am = list.find((q) => q.k === a.anchor);
      if (!am) return;
      ui.ringSel = ringExpandSel(c.R, ringRangeKeys(gg, am, h));
      ui.ringPri = ui.ringSel.has(h.k) ? h.k : [...ui.ringSel][0] || "";
      syncRingUI();
      requestDraw();
    }
    return;
  }
  if (a.kind === "ringMove") {
    // небольшое дрожание пальца — ещё касание, кабинеты не двигаем
    if (!a.moved) {
      if (Math.hypot(p[0] - (a.x0 != null ? a.x0 : a.x), p[1] - (a.y0 != null ? a.y0 : a.y)) <= 4) return;
    }
    const dx = (p[0] - a.x) / s, dy = (p[1] - a.y) / s;
    for (const k of ui.ringSel) {
      const o = ringMod(c.R, k);
      o.dx = Math.round(((o.dx || 0) + dx) * 100) / 100;
      o.dy = Math.round(((o.dy || 0) + dy) * 100) / 100;
    }
    a.x = p[0];
    a.y = p[1];
    a.moved = true;
    ringChanged();
  } else if (a.kind === "ringRot") {
    const pri = ringGeom(st).list.find((m) => m.k === a.k);
    if (!pri) return;
    const pv = ringPivot(ringGeom(st), pri), cx = L.ox + (pv ? pv.x : pri.x) * s, cy = L.oy + (pv ? pv.y : pri.y) * s;
    let ang = Math.atan2(p[0] - cx, -(p[1] - cy)) * 180 / Math.PI;
    if (e.shiftKey) ang = Math.round(ang / 15) * 15;
    const delta = ringNormDeg(ang - pri.rot);
    if (Math.abs(delta) > 0.001) ringRotateSel(delta);
  } else if (a.kind === "ringSize") {
    const g = c.g, m = a.m, rx = Math.abs(p[0] - a.cx) / s * 2, ry = Math.abs(p[1] - a.cy) / s * 2;
    let dw = g.dw, dh = g.dh;
    if (m.includes("e") || m.includes("w")) dw = Math.max(2, rx);
    if (m.includes("n") || m.includes("s")) dh = Math.max(2, ry);
    if (g.lock !== false) {
      const k = m.length === 2 ? Math.max(dw / a.dw0, dh / a.dh0) : m === "e" || m === "w" ? dw / a.dw0 : dh / a.dh0;
      dw = a.dw0 * k;
      dh = a.dh0 * k;
    }
    g.dw = ringEven(dw);
    g.dh = ringEven(dh);
    ringChanged(true);
  } else if (a.kind === "ringBox") {
    a.x = p[0];
    a.y = p[1];
    const [x0, y0] = ringToMask(Math.min(a.x0, a.x), Math.min(a.y0, a.y)), [x1, y1] = ringToMask(Math.max(a.x0, a.x), Math.max(a.y0, a.y));
    const inside = ringGeom(st).list.filter((m) => m.x >= x0 && m.x <= x1 && m.y >= y0 && m.y <= y1).map((m) => m.k);
    ui.ringSel = ringExpandSel(st.ring, [...a.add ? a.base : [], ...inside]);
    if (!ui.ringSel.has(ui.ringPri)) ui.ringPri = inside[0] || [...ui.ringSel][0] || "";
    syncRingUI();
    requestDraw();
  }
}
function ringOverlay() {
  const c0 = ringCtx();
  if (!c0 || !L) return;
  const st = c0.st;
  const gg = ringGeom(st), s = L.scale, P = (q) => [L.ox + q[0] * s, L.oy + q[1] * s];
  pctx.save();
  if (!ui.ringSel.size && !(act && act.kind === "ringBox")) {
    const hs = ringHandles(st);
    if (hs.length) {
      const h = hs[0];
      pctx.strokeStyle = "rgba(255,219,13,0.8)";
      pctx.lineWidth = 1;
      pctx.setLineDash([6, 5]);
      pctx.beginPath();
      pctx.ellipse(h.cx, h.cy, Math.max(1, h.a), Math.max(1, h.b), 0, 0, Math.PI * 2);
      pctx.stroke();
      pctx.setLineDash([]);
      pctx.fillStyle = "#ffdb0d";
      pctx.strokeStyle = "#000";
      for (const q of hs) {
        pctx.fillRect(q.p[0] - 5, q.p[1] - 5, 10, 10);
        pctx.strokeRect(q.p[0] - 5, q.p[1] - 5, 10, 10);
      }
    }
  }
  // 2.0.171: место погашенного кабинета отмечено только на экране (пунктирный контур и крестик);
  // это оверлей поверх холста — в PNG, ТЗ и экспорте масок его нет
  {
    const offs = gg.list.filter((m) => m.off);
    if (offs.length) {
      pctx.save();
      pctx.lineWidth = 1;
      pctx.setLineDash([5, 4]);
      pctx.strokeStyle = "rgba(255,255,255,0.45)";
      pctx.fillStyle = "rgba(255,255,255,0.06)";
      for (const m of offs) {
        const pts = ringPoly(m).map(P);
        pctx.beginPath();
        pts.forEach((q, i) => i ? pctx.lineTo(q[0], q[1]) : pctx.moveTo(q[0], q[1]));
        pctx.closePath();
        pctx.fill();
        pctx.stroke();
        pctx.beginPath();
        pctx.moveTo(pts[0][0], pts[0][1]);
        pctx.lineTo(pts[2][0], pts[2][1]);
        pctx.moveTo(pts[1][0], pts[1][1]);
        pctx.lineTo(pts[3][0], pts[3][1]);
        pctx.stroke();
      }
      pctx.restore();
    }
  }
  pctx.lineWidth = 2;
  for (const m of gg.list) {
    if (!ui.ringSel.has(m.k)) continue;
    const pts = ringPoly(m).map(P);
    pctx.strokeStyle = m.k === ui.ringPri ? "#ffff00" : "#00f2ff";
    pctx.beginPath();
    pts.forEach((q, i) => i ? pctx.lineTo(q[0], q[1]) : pctx.moveTo(q[0], q[1]));
    pctx.closePath();
    pctx.stroke();
  }
  const pri = gg.list.find((m) => m.k === ui.ringPri && ui.ringSel.has(m.k));
  if (pri) {
    const [hx, hy, bx, by] = ringRotHandle(pri, gg), pv = ringPivot(gg, pri);
    if (pv) {
      // группа — единый объект: пунктирный круг вокруг неё и центр вращения
      const px = L.ox + pv.x * s, py = L.oy + pv.y * s;
      pctx.save();
      pctx.strokeStyle = "rgba(52,199,89,0.7)";
      pctx.lineWidth = 1;
      pctx.setLineDash([6, 5]);
      pctx.beginPath();
      pctx.arc(px, py, pv.r * s, 0, Math.PI * 2);
      pctx.stroke();
      pctx.setLineDash([]);
      pctx.fillStyle = "#34c759";
      pctx.beginPath();
      pctx.arc(px, py, 3, 0, Math.PI * 2);
      pctx.fill();
      pctx.restore();
    }
    pctx.strokeStyle = "#34c759";
    pctx.lineWidth = 1.5;
    pctx.beginPath();
    pctx.moveTo(bx, by);
    pctx.lineTo(hx, hy);
    pctx.stroke();
    pctx.fillStyle = "#34c759";
    pctx.beginPath();
    pctx.arc(hx, hy, 6, 0, Math.PI * 2);
    pctx.fill();
    pctx.strokeStyle = "#000";
    pctx.lineWidth = 1;
    pctx.stroke();
  }
  if (act && act.kind === "ringBox") {
    pctx.strokeStyle = "#00f2ff";
    pctx.lineWidth = 1;
    pctx.setLineDash([4, 3]);
    pctx.strokeRect(Math.min(act.x0, act.x) + 0.5, Math.min(act.y0, act.y) + 0.5, Math.abs(act.x - act.x0), Math.abs(act.y - act.y0));
  }
  pctx.restore();
}
// клавиатура: стрелки — сдвиг, [ ] — поворот, Delete — погасить, Esc — снять выбор
window.addEventListener("keydown", (e) => {
  if (ui.page && ui.page !== "mask") return;
  const st = S();
  if (st.kind !== "ring" || !ui.ringSel.size) return;
  const t = e.target;
  if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const c = ringCtx(), step = e.shiftKey ? 10 : 1;
  let done = true;
  if (e.key === "Escape") {
    ui.ringSel.clear();
    ui.ringPri = "";
    ui.ringAnchor = "";
    syncRingUI();
    requestDraw();
  } else if (/^Arrow/.test(e.key)) {
    const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0, dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
    for (const k of ui.ringSel) {
      const o = ringMod(c.R, k);
      o.dx = (o.dx || 0) + dx;
      o.dy = (o.dy || 0) + dy;
    }
    ringClean(c.R);
    ringChanged();
  } else if (e.code === "BracketLeft") ringRotateSel(e.shiftKey ? -15 : -1);
  else if (e.code === "BracketRight") ringRotateSel(e.shiftKey ? 15 : 1);
  else if (e.key === "Delete" || e.key === "Backspace") $("rgOff").click();
  else done = false;
  if (done) {
    e.preventDefault();
    e.stopImmediatePropagation();
  }
}, true);
