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
      // 2.0.194: полоса длиннее выхода режется на куски, которые помещаются в выход (раньше ряд уходил за край)
      const LIM = mode === "rows" ? Math.max(...o.screens.map((q) => q.w)) : Math.max(...o.screens.map((q) => q.h));
      // длина куска — по крайним краям кабинетов (у столбца ряды могут идти снизу вверх — направление не важно)
      const span = (a, b) => mode === "rows" ? Math.max(a.dx + a.w / 2, b.dx + b.w / 2) - Math.min(a.dx - a.w / 2, b.dx - b.w / 2) : Math.max(a.dy + a.h / 2, b.dy + b.h / 2) - Math.min(a.dy - a.h / 2, b.dy - b.h / 2);
      for (const k of [...by.keys()].sort((a, b) => a - b)) {
        const arr = by.get(k).sort((a, b) => mode === "rows" ? a.col - b.col : a.row - b.row);
        // разрываем полосу там, где кабинеты не соседние или полоса перестаёт помещаться в выход
        let run = [arr[0]];
        const runs = [run];
        for (let i = 1; i < arr.length; i++) {
          const prev = run[run.length - 1], cur = arr[i];
          const near = mode === "rows" ? cur.col === prev.col + 1 : cur.row === prev.row + 1;
          if (near && span(run[0], cur) <= LIM + 0.5) run.push(cur);
          else runs.push(run = [cur]);
        }
        // кусков несколько — «ряд 1.1», «ряд 1.2»…
        const base = g.name + " · " + (mode === "rows" ? "ряд " : "стб ") + (k + 1);
        runs.forEach((r, i) => push(g, r, runs.length > 1 ? base + "." + (i + 1) : base));
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
  // 2.0.190: сначала Слой 1, потом Слой 2 и т. д. (lay — номер слоя); внутри слоя — высокие первыми
  const order = items.map((it, i) => i).sort((i, j) => (items[i].lay || 0) - (items[j].lay || 0) || items[j].h - items[i].h || items[j].w - items[i].w || i - j);
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
function smartFill(gs, grids, scrs, layOf) {
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
  // 2.0.190: кладём по слоям — пока у нижнего слоя остались кабинеты, берём только его
  const lay = (gi) => layOf ? layOf(gi) : 0;
  const curLayer = () => {
    let m = Infinity;
    R.forEach((M, gi) => {
      if (M && M.some((row) => row.some((v) => v))) m = Math.min(m, lay(gi));
    });
    loose.forEach((q) => {
      if (!q.used) m = Math.min(m, lay(q.gi));
    });
    return m;
  };
  const bestIn = (F) => {
    let best = null;
    const L0 = curLayer();
    const take = (cand) => {
      // больше площадь; при равной — плотнее к свободному месту
      const k = cand.w * cand.h * 1e6 - Math.min(F.w - cand.w, F.h - cand.h);
      if (!best || k > best.k) best = { ...cand, k };
    };
    R.forEach((M, gi) => {
      if (!M || lay(gi) !== L0) return;
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
      if (!q.used && lay(q.gi) === L0 && w <= F.w + 1e-6 && h <= F.h + 1e-6) take({ li, w, h });
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
        const L1 = curLayer();
        R.forEach((M, gi) => M && lay(gi) === L1 && M.forEach((row, r) => row.forEach((v, c) => {
          if (v && !one) one = { gi, r0: r, r1: r + 1, c0: c, c1: c + 1 };
        })));
        if (!one) one = { li: loose.findIndex((q) => !q.used && lay(q.gi) === L1) };
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
  const lkeys = outAutoKeys(o), layOf = (gi) => Math.max(0, lkeys.indexOf(gs[gi].srcKey));
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
    pick.forEach((v, gi) => v.rects.forEach((r) => items.push({ gi, r, w: Math.round(r.x1 - r.x0), h: Math.round(r.y1 - r.y0), lay: layOf(gi) })));
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
  const F = smartFill(gs, grids, o.screens, layOf);
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
// 2.0.197: разложить только выбранные — остальные слайсы не трогаются; выбранные встают на свободные места
// (выходы по порядку, в каждом — сверху вниз, слева направо); места нет нигде — новый выход
function outPackSel(o, list, quiet) {
  const E = 0.5, ids = new Set(list.map((s) => s.id)), byScr = new Map(o.screens.map((q) => [q.id, []]));
  for (const s of o.slices) {
    if (ids.has(s.id) || s.on === false || !byScr.has(s.scr)) continue;
    const [w, h] = sliceOutWH(s);
    byScr.get(s.scr).push({ x0: s.ox, y0: s.oy, x1: s.ox + w, y1: s.oy + h });
  }
  const free = (rs, x, y, w, h) => !rs.some((r) => x < r.x1 - E && x + w > r.x0 + E && y < r.y1 - E && y + h > r.y0 + E);
  const place = (scr, w, h) => {
    const rs = byScr.get(scr.id);
    if (w > scr.w + E || h > scr.h + E) return null;
    const xs = [0, ...rs.map((r) => r.x1)].filter((v) => v + w <= scr.w + E), ys = [0, ...rs.map((r) => r.y1)].filter((v) => v + h <= scr.h + E);
    const X = [...new Set(xs)].sort((a, b) => a - b), Y = [...new Set(ys)].sort((a, b) => a - b);
    for (const y of Y) for (const x of X) if (free(rs, x, y, w, h)) return [x, y];
    return null;
  };
  let moved = 0, added = 0;
  for (const s of o.slices.filter((q) => ids.has(q.id))) {
    const [w, h] = sliceOutWH(s);
    let at = null, scr = null;
    for (const q of o.screens) {
      at = place(q, w, h);
      if (at) {
        scr = q;
        break;
      }
    }
    if (!at) {
      // нигде не помещается — новый выход размером как первый (слайс больше выхода — кладём в угол как есть)
      scr = { id: newUid(), name: "Output ".concat(o.screens.length + 1), w: o.screens[0].w, h: o.screens[0].h, auto: true };
      o.screens.push(scr);
      byScr.set(scr.id, []);
      added++;
      at = [0, 0];
    }
    s.scr = scr.id;
    s.ox = Math.round(at[0]);
    s.oy = Math.round(at[1]);
    byScr.get(scr.id).push({ x0: s.ox, y0: s.oy, x1: s.ox + w, y1: s.oy + h });
    moved++;
  }
  if (!quiet) status("Разложено выбранных: " + moved + (added ? " · добавлено выходов: " + added : "") + " — остальные слайсы на месте", true);
  return moved;
}
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
