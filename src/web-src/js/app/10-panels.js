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
    } else {
      st.name = "screen " + (project.screens.filter((s) => (s.kind || "led") === "led").length + 1);
      st.guides = { circle: false, diag: false };
    }
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
$("cabRotOn").onchange = () => {
  cabRotOn = $("cabRotOn").checked;
  try { localStorage.setItem("ledmask.cabRotOn", cabRotOn ? "1" : "0"); } catch (e) {}
  syncCabRotUI();
  requestDraw();
};
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
  // 3.0.0: новый экран LED — без направляющих (круг и линии), даже если у текущего они включены
  if ((base.kind || "led") === "led") base.guides = { circle: false, diag: false };
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
  project = { name: "Проект", screens: [defaultScreen()], cur: 0, guides: { circle: false, diag: false }, ...freshFieldState() };
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
