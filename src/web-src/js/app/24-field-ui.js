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
// 3.0.15: подпись над маской в ТЗ — из выбранных частей: разрешение, название, размер, имя файла
const TZ_LAB0 = { res: true, name: true, phys: true, file: false };
const tzLabOpt = () => ({ ...TZ_LAB0, ...project.tz.lab || {} });
const tzLabAny = () => {
  const o = tzLabOpt();
  return o.res || o.name || o.phys || o.file;
};
// рамка раскладки слайда масок: подписи нет совсем — маска занимает и её место
const tzLabBox = (B) => tzLabAny() ? B : { ...B, noLab: true };
function tzLab(p) {
  const o = tzLabOpt(), parts = [];
  if (o.res && p.res) parts.push(p.res);
  if (o.name && p.name) parts.push(p.name);
  if (o.phys && p.phys) parts.push(p.phys);
  if (o.file && p.file) parts.push(p.file);
  return parts.join("  |  ");
}
function fieldInfo(f) {
  const rs = fieldRects(f), b = fieldBBox(rs);
  if (!b) return null;
  const ph = fieldPhys(rs, b);
  return { w: b.w, h: b.h, label: tzLab({ res: "".concat(b.w, "×").concat(b.h), name: f.name, phys: ph && f.title.meters ? "".concat(compactM(ph.w), "х").concat(compactM(ph.h), " м") : "", file: fieldFileBase(f) + ".png" }) };
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
// 3.0.6: пример к нарезке (исходная маска с красными линиями разреза) — галочкой у каждой нарезки.
// 3.0.7: по умолчанию выключен
const tzCutSrcOn = (c) => {
  const m = project.tz.cutSrc || {};
  return m[c.id] != null ? !!m[c.id] : false;
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
      out.push({ kind: "out", m, scr, key: "o:" + m.id + ":" + scr.id, name: "".concat(m.name, " · ").concat(scr.name), w: scr.w, h: scr.h, label: tzLab({ res: "".concat(scr.w, "×").concat(scr.h), name: "".concat(m.name, " — ").concat(scr.name), file: outFileName(m, scr) }) });
    }
    continue;
  }
  if (o.c) {
    // 2.0.118: нарезка — как общее поле (в ТЗ «Волюметрик» не входит)
    const ci = !volOnly && tzCutOn(o.c) && cutInfo(o.c);
    if (ci) out.push({ kind: "cut", c: o.c, key: "c:" + o.c.id, name: o.c.name, ...ci });
    if (ci) {
      // 2.0.174: пример для ТЗ — исходная маска с разметкой и линиями разреза (отдельным файлом не сохраняется)
      const G0 = tzCutSrcOn(o.c) && cutGeom(o.c);
      if (G0) out.push({ kind: "cutsrc", c: o.c, key: "cs:" + o.c.id, name: o.c.name + " — исходник", w: G0.W0, h: G0.H0, label: tzLab({ res: "".concat(G0.W0, "×").concat(G0.H0), name: "".concat(G0.st.name || "screen", " — исходная маска, красным — линии разреза (пример)") }) });
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
    if (!isVol || VOL_MASK_UI && tz.volMask === true) out.push({ kind: "mask", st, key: "m:" + st.uid, name: st.name || "screen", w, h, label: tzLab({ res: "".concat(w, "×").concat(h), name: st.name || "screen", phys: physText(st), file: maskFileBase(st) + ".png" }) });
    if (isVol) {
      const nm = st.name || "volumetric", W2 = 1600;
      // 2.0.58: две схемы — вид сверху с коммутацией и вид снизу (лицевая сторона) без коммутации
      if (tz.volCom !== false) {
        out.push({ kind: "volcom", side: "top", com: true, st, key: "vc:" + st.uid, name: nm + " — коммутация", w: W2, h: volComH(st, W2), label: tzLab({ name: "Коммутация  |  ".concat(nm, "  |  вид сверху") }) });
        out.push({ kind: "volcom", side: "bottom", com: false, st, key: "vb:" + st.uid, name: nm + " — вид снизу", w: W2, h: volComH(st, W2), label: tzLab({ name: "Вид снизу (лицевая сторона)  |  ".concat(nm) }) });
      }
      if (tz.vol3d !== false) out.push({ kind: "vol3d", st, key: "v3:" + st.uid, name: nm + " — 3D", w: W2, h: VOL3D_H, label: tzLab({ name: "3D-вид  |  ".concat(nm), phys: physText(st) }) });
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
// 3.0.7: при автоматической раскладке нарезка — на своём листе: только она (и её пример, если включён) и текст-пояснение
const isCutItem = (m) => /^c:/.test(m && m.key || ""), isCutSrcItem = (m) => /^cs:/.test(m && m.key || "");
function groupSub(masks, idx) {
  return groupMasks(idx.map((k) => masks[k])).map((gr) => ({ hz: gr.hz, g: gr.g.map((k) => idx[k]) }));
}
function cutIdxAt(masks, i) {
  return i + 1 < masks.length && isCutSrcItem(masks[i + 1]) ? [i, i + 1] : [i];
}
function groupAutoCuts(masks) {
  const out = [];
  let i = 0;
  while (i < masks.length) {
    if (isCutItem(masks[i]) || isCutSrcItem(masks[i])) {
      const idx = isCutItem(masks[i]) ? cutIdxAt(masks, i) : [i];
      out.push(...groupSub(masks, idx));
      i += idx.length;
      continue;
    }
    let j = i;
    while (j < masks.length && !isCutItem(masks[j]) && !isCutSrcItem(masks[j])) j++;
    const idx = [];
    for (let k = i; k < j; k++) idx.push(k);
    out.push(...groupSub(masks, idx));
    i = j;
  }
  return out;
}
function groupMasksPlan(masks) {
  const per = project.tz.maskPer | 0, grid2 = project.tz.maskGrid, perS = project.tz.maskPerS || {};
  if (!per && !Object.keys(perS).length) return groupAutoCuts(masks);
  const out = [];
  let i = 0, s = 0;
  while (i < masks.length) {
    const cnt = perS[s] > 0 ? perS[s] : per;
    if (isCutItem(masks[i]) || isCutSrcItem(masks[i])) {
      // 3.0.7: нарезка всегда отдельным листом — и при ручном «Масок на слайде»
      const idx = isCutItem(masks[i]) ? cutIdxAt(masks, i) : [i];
      out.push(...groupSub(masks, idx));
      i += idx.length;
    } else if (cnt > 0) {
      const g = [];
      for (let j = i; j < Math.min(masks.length, i + cnt) && !isCutItem(masks[j]) && !isCutSrcItem(masks[j]); j++) g.push(j);
      const m = String(perS[s] > 0 ? "" : grid2 || "").match(/^(\d+)x(\d+)$/), fixed = m && +m[1] * +m[2] >= cnt ? { cols: +m[1], rows: +m[2] } : null;
      const orient = new Set(g.map((j) => masks[j].w >= masks[j].h));
      const anyVol = g.some((j) => volExtra(masks[j]));
      const mixed = g.length > 1 && orient.size > 1 && !fixed && !anyVol;
      out.push({ hz: mixed ? { mixed: g.map((j) => ({ w: masks[j].w, h: masks[j].h })) } : g.length === 1 ? true : fixed || autoGrid(masks, g), g });
      i += g.length;
    } else {
      // «Авто» — не захватываем нарезку в лист к другим маскам
      let end = i;
      while (end < masks.length && !isCutItem(masks[end]) && !isCutSrcItem(masks[end])) end++;
      const grp = autoGroupOne(masks.slice(0, end), i);
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
      const lay = maskCellLayout(hz, g.length, j, it.w, it.h, tzLabBox(BOX)), sc = lay.image[2] / Math.max(1, it.w), key = it.w + "x" + it.h;
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
      // 3.0.6: под нарезкой — пример исходной маски с линиями разреза (включить / выключить)
      if (ci) {
        const G0 = cutGeom(c);
        row("↳ пример: исходная маска", G0 ? "".concat(G0.W0, "×").concat(G0.H0) : "", tzCutSrcOn(c), (on) => {
          tz.cutSrc = tz.cutSrc || {};
          tz.cutSrc[c.id] = on;
        }, "sub", !tzCutOn(c) || volTpl || !G0);
      }
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
  $("tSvg").checked = tz.svgMasks === true;
  $("tSvgRow").hidden = /^Vol/.test(ui.tzTpl || "");
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
    const lo = tzLabOpt();
    for (const k of ["res", "name", "phys", "file"]) $("tLab_" + k).checked = !!lo[k];
  }
  $("tOvInfo").textContent = n ? tz.overview ? "Картинок: ".concat(n, " на ").concat(ns, " ").concat(ns === 1 ? "слайде" : "слайдах", " (").concat(ns === 1 ? "слайд 2" : "слайды 2–" + (ns + 1), "), порядок как в списке") : "Картинок: ".concat(n, " — галочка снята, слайды не добавятся") : "Картинок нет — слайды не добавятся.";
  syncTzTpl();
  refreshTZText();
  updateTZSummary();
  updateTZNote();
}
