function freshField(k) {
  return { id: newUid(), name: k ? "Общее поле ".concat(k + 1) : "Общее поле", items: [], title: { on: true, x: 0, y: 0, size: 0, meters: false }, stack: false };
}
function freshFieldState() {
  return { fields: [], fieldCur: 0, cuts: [], cutCur: 0, outs: [], outCur: 0, tz: { tpl2: true, tpl3: true, tpl4: true, tpl5: true, tpl6: true, fields: {}, masks: {}, cuts: {}, overview: true, projZip: true, imgPer: 0, maskPer: 0, maskPerS: {}, evenSize: true, lab: { res: true, name: true, phys: true, file: false }, maskGrid: "", req: {}, notes: {}, pos: {}, mpos: {} } };
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
  // 3.0.55: расстановка масок на листах ТЗ
  const mposMap = (m) => {
    const o = {};
    if (m && typeof m === "object" && !Array.isArray(m)) {
      for (const [k, v] of Object.entries(m)) {
        if (!(v && isFinite(+v.x) && isFinite(+v.y) && +v.w > 0)) continue;
        o[k] = { x: Math.round(+v.x), y: Math.round(+v.y), w: Math.round(+v.w) };
        if (typeof v.sl === "string") o[k].sl = v.sl;
      }
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
  project.tz = { fields: boolMap(tz.fields), masks: boolMap(tz.masks), overview: tz.overview == null ? true : !!tz.overview, projZip: tz.projZip !== false, svgMasks: tz.svgMasks === true, volMask: tz.volMask === true, volCom: tz.volCom !== false, vol3d: tz.vol3d !== false, volInfo: tz.volInfo !== false, adrMadrix: tz.adrMadrix === true, adrMadshow: tz.adrMadshow === true, adrTd: tz.adrTd === true, imgPer: Math.max(0, Math.min(3, pint(tz.imgPer, 0))), maskPer: Math.max(0, Math.min(10, pint(tz.maskPer, 0))), maskPerS: (() => { const o = {}, src = tz.maskPerS && typeof tz.maskPerS === "object" ? tz.maskPerS : {}; for (const kk of Object.keys(src)) { const v = pint(src[kk], 0); if (/^\d+$/.test(kk) && v >= 1 && v <= 10) o[kk] = v; } return o; })(), evenSize: tz.evenSize !== false, lab: (() => { const l = tz.lab && typeof tz.lab === "object" ? tz.lab : {}; return { res: l.res !== false, name: l.name !== false, phys: l.phys !== false, file: l.file === true }; })(), maskGrid: /^\d+x\d+$/.test(tz.maskGrid || "") ? tz.maskGrid : "", req: strMap(tz.req), notes: strMap(tz.notes), pos: posMap(tz.pos), mpos: mposMap(tz.mpos) };
  // 2.0.114: порядок листов ТЗ и выбранный тип ТЗ — раньше при открытии сбрасывались
  if (Array.isArray(tz.order)) project.tz.order = tz.order.filter((k) => typeof k === "string" && /^[fmco]:/.test(k));
  // 3.0.9: первый лист Resolume, D3 и MP4 — два блока вместо десяти; правки старых блоков к ним не подходят — сбрасываем
  if (tz.tpl2 !== true) {
    const old1 = (k) => /^(req:)?(Resolume|D3|MP4)(#\d+)?$/.test(k);
    for (const k of Object.keys(project.tz.req)) if (old1(k)) delete project.tz.req[k];
    for (const k of Object.keys(project.tz.pos)) if (old1(k)) delete project.tz.pos[k];
  }
  project.tz.tpl2 = true;
  // 3.0.12: первый лист MP4 — один блок на все разделы; прежние правки и положения его блоков сбрасываем
  if (tz.tpl3 !== true) {
    const oldMp4 = (k) => /^(req:)?MP4(#\d+)?$/.test(k);
    for (const k of Object.keys(project.tz.req)) if (oldMp4(k)) delete project.tz.req[k];
    for (const k of Object.keys(project.tz.pos)) if (oldMp4(k)) delete project.tz.pos[k];
  }
  project.tz.tpl3 = true;
  // 3.0.24: первый лист Resolume, D3 и MP4 — одно поле с двумя колонками; правки прежних блоков сбрасываем
  if (tz.tpl4 !== true) {
    const old4 = (k) => /^(req:)?(Resolume|D3|MP4)(#\d+)?$/.test(k);
    for (const k of Object.keys(project.tz.req)) if (old4(k)) delete project.tz.req[k];
    for (const k of Object.keys(project.tz.pos)) if (old4(k)) delete project.tz.pos[k];
  }
  project.tz.tpl4 = true;
  // 3.0.28: шрифт первого листа уменьшен (на телефонах текст вылезал); прежний текст с крупным шрифтом сбрасываем
  if (tz.tpl5 !== true) {
    const old5 = (k) => /^(req:)?(Resolume|D3|MP4)(#\d+)?$/.test(k);
    for (const k of Object.keys(project.tz.req)) if (old5(k)) delete project.tz.req[k];
  }
  project.tz.tpl5 = true;
  // 3.0.34: текст первого листа — один столбец на всю ширину; прежние текст и положение блока сбрасываем
  if (tz.tpl6 !== true) {
    const old6 = (k) => /^(req:)?(Resolume|D3|MP4)(#\d+)?$/.test(k);
    for (const k of Object.keys(project.tz.req)) if (old6(k)) delete project.tz.req[k];
    for (const k of Object.keys(project.tz.pos)) if (old6(k)) delete project.tz.pos[k];
  }
  project.tz.tpl6 = true;
  project.tz.cuts = boolMap(tz.cuts);
  project.tz.cutSrc = boolMap(tz.cutSrc);
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
  if (ui.page === "tz") {
    // 3.0.26: быстрая панель ТЗ — по чему щёлкнули (текст на листе или пустое место)
    if (typeof fbTzDown === "function") fbTzDown(e);
    return tzPointer(e, "down");
  }
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
    if (ui.page === "tz" && ui.tzHover && !ui.tzDrag) {
      ui.tzHover = null;
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
    // 3.0.9: двойной щелчок по тексту — правка прямо на листе
    const th = tzHitAt([x, y]);
    if (th) tzIpStart(th.pk, x, y);
    else if (h) openMarkEditor(h.im);
    else if (ui.tzZoom >= 0 && typeof tzMaskHitAt === "function" && tzMaskHitAt([x, y])) return; // 3.0.55: по маске на листе «Крупно» — не выходить из него
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
  // 3.0.25: поле создаётся при первом обращении (CF) — создаём его до проверки, иначе панель писала «Полей пока нет»
  // и выбор был пуст, хотя поле уже на холсте, — приходилось добавлять второе
  CF();
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
