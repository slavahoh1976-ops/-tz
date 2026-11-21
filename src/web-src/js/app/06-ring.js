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
    drawShapeFills(ctx, st, s);
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
        if (st.cacheLineDash) ctx.setLineDash([cw * 3, cw * 2]);
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
  drawBlock(ctx, lines, TITLE_GAP * s, W * s / 2 + (st.titleOffsetX || 0) * s, H * s / 2 - (st.titleOffsetY || 0) * s, titleRot(st), st.tSty, st);
  for (const it of st.extraLabels || []) {
    const fs = Math.min(900, Math.max(6, +it.size || 120)) * s;
    ctx.fillStyle = it.color || "#fff";
    drawBlock(ctx, [[it.text || "Текст", fs]], 0, W * s / 2 + (+it.x || 0) * s, H * s / 2 - (+it.y || 0) * s, +it.rotation || 0, it.sty, it);
  }
  drawInfo(ctx, st, s);
  ctx.restore();
}
