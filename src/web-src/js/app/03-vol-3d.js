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
