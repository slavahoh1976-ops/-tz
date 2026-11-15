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
