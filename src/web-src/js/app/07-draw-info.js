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
// 3.0.0: в новом проекте направляющие «Круг» и «Линии через центр» выключены (в старых файлах — как были)
let project = { name: "Проект", screens: [defaultScreen()], cur: 0, guides: { circle: false, diag: false }, ...freshFieldState() };
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
  st.cacheShapes = (Array.isArray(d.cacheShapes) ? d.cacheShapes : []).filter((x) => x && isFinite(+x.x) && isFinite(+x.y) && (+x.d > 0 || +x.w > 0 && +x.h > 0)).map((x) => ({ x: +x.x, y: +x.y, w: +x.w > 0 ? +x.w : +x.d, h: +x.h > 0 ? +x.h : +x.d, lock: x.lock == null ? true : !!x.lock, inv: !!x.inv, frame: !!x.frame, fill: !!x.fill, fa: Math.max(0, Math.min(100, +x.fa || 0)), fc: typeof x.fc === "string" && /^#[0-9a-f]{6}$/i.test(x.fc) ? x.fc.toUpperCase() : "#FF0000", dimOnly: !!x.dimOnly, t: x.t === "circle" || x.t == null ? "circle" : x.t === "trap" || x.t === "pent" || x.t === "bez" && bezLoad(x.pts) ? x.t : "round", rot: normRot(+x.rot || 0), ...x.t === "bez" ? { pts: bezLoad(x.pts) } : {}, tb: x.tb == null ? 60 : Math.max(5, Math.min(100, +x.tb || 60)), sk: Math.max(-100, Math.min(100, +x.sk || 0)), flip: !!x.flip, r: x.t === "rect" ? 0 : +x.r >= 0 && x.r !== "" && x.r != null ? +x.r : Math.round(Math.min(+x.w || +x.d || 0, +x.h || +x.d || 0) * 0.2) }));
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
