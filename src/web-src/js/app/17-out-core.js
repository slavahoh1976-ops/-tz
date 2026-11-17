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
// 2.0.191: поставить маску на слой n (1 — первый): маска встаёт на это место, остальные сдвигаются
function outLayerSet(o, k, n) {
  const ks = outLayerKeys(o).filter((q) => q !== k);
  ks.splice(Math.max(0, Math.min(ks.length, n - 1)), 0, k);
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
// 3.0.5: в Safari / WebKit (программа для Mac, iPhone) вырезание куска из большой картинки (drawImage с 9 аргументами)
// у старых версий рисует пустоту — выходы мэппинга были чёрными. Там слайс рисуем как вход: картинку целиком,
// обрезанную по рамке слайса (результат тот же). В Chrome / Edge / Android — прежний, более быстрый способ.
let SLICE_CLIP = (() => {
  try {
    const u = navigator.userAgent || "";
    return /AppleWebKit/.test(u) && !/(Chrome|Chromium|CriOS|Edg|OPR|Android)/.test(u);
  } catch (e) {
    return false;
  }
})();
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
  } else if (SLICE_CLIP) {
    ctx.beginPath();
    ctx.rect(-dw * k / 2, -dh * k / 2, dw * k, dh * k);
    ctx.clip();
    // центр участка маски — в центр слайса на выходе
    ctx.scale(dw * k / (sl.iw * s), dh * k / (sl.ih * s));
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
