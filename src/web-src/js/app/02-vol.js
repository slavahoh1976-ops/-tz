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
