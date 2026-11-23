// 3.0.16–3.0.17: панель быстрых настроек над холстом (как в Keynote) — только на компьютере, на странице «Маска».
// Видна одна строка — для того, что выбрано последним: текст, фигура или кабинеты; ничего не выбрано — кнопки «Текст» и «Фигуры».
// Размер, цвет, положение и поворот текста, линия и заливка фигуры, покраска кабинетов — через те же поля и кнопки,
// что в панели слева (отмена, сохранение — как обычно); шрифт, жирный, курсив, выравнивание, обводка и прозрачность
// текста — свойства st.tSty / it.sty. Двойной щелчок по тексту на маске — правка текста прямо на месте.
// Компьютер или телефон — по мыши и ширине окна: html.pc / html.mob.
const isPC = () => window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 900px)").matches;
function fbDevice() {
  const pc = isPC();
  document.documentElement.classList.toggle("pc", pc);
  document.documentElement.classList.toggle("mob", !pc);
}
fbDevice();
window.addEventListener("resize", () => {
  fbDevice();
  fbQueue();
});
$("fbFont").innerHTML = TX_FONTS.map(([v, n]) => '<option value="'.concat(xmlEsc(v), '"').concat(v ? ' style="font-family:'.concat(xmlEsc(v), '"') : "", ">").concat(xmlEsc(n), "</option>")).join("");
$("fbSize").innerHTML = $("txSize").innerHTML;
// ---- текст: цели — выбранные доп. тексты или основной текст
function fbTargets() {
  const st = S();
  if (txExtra()) return selExtras().map((i) => ({ get: () => st.extraLabels[i].sty, set: (v) => {
    if (v) st.extraLabels[i].sty = v;
    else delete st.extraLabels[i].sty;
  }, extra: true }));
  return [{ get: () => st.tSty, set: (v) => st.tSty = v, extra: false }];
}
function fbSet(patch) {
  for (const t of fbTargets()) t.set(normSty({ ...t.get() || {}, ...patch }));
  changed();
  fbSync();
}
const fbFire = (id, val, ev) => {
  const el = $(id);
  if (el.type === "checkbox") el.checked = !!val;
  else el.value = val;
  el.dispatchEvent(new Event(ev));
};
const fbClick = (id) => () => {
  $(id).click();
  fbSync();
};
$("fbFont").onchange = (e) => fbSet({ font: e.target.value });
$("fbBold").onclick = () => fbSet({ b: !(fbTargets()[0].get() || {}).b });
$("fbItal").onclick = () => fbSet({ i: !(fbTargets()[0].get() || {}).i });
document.querySelectorAll("#fbAlign button").forEach((b) => b.onclick = () => fbSet({ al: b.dataset.al === "c" ? "" : b.dataset.al }));
$("fbOw").onchange = (e) => fbSet({ ow: +e.target.value, oc: $("fbOc").value });
$("fbOc").oninput = (e) => {
  const cur = fbTargets()[0].get() || {};
  fbSet({ oc: e.target.value, ow: cur.ow || 4 });
};
$("fbOp").onchange = (e) => fbSet({ op: +e.target.value });
$("fbSize").onchange = (e) => {
  fbFire("txSize", e.target.value, "change");
  fbSync();
};
$("fbSzMinus").onclick = fbClick("txMinus");
$("fbSzPlus").onclick = fbClick("txPlus");
$("fbColor").oninput = (e) => fbFire("txColor", e.target.value, "input");
$("fbRotCCW").onclick = fbClick("txRotCCW");
$("fbRotCW").onclick = fbClick("txRotCW");
$("fbRot0").onclick = fbClick("txRot0");
// ---- фигура
// линия: нет / сплошная / пунктир (3.0.21)
$("fbLine").onchange = (e) => {
  const v = e.target.value;
  S().cacheLineDash = v === "2";
  fbFire("shapeLine", v !== "0", "change");
  changed();
};
$("fbLW").oninput = (e) => fbFire("shapeLW", e.target.value, "input");
$("fbLC").oninput = (e) => fbFire("shapeLC", e.target.value, "input");
$("fbFill").onchange = (e) => fbFire("shapeFill", e.target.checked, "change");
$("fbFC").oninput = (e) => {
  if (!$("shapeFill").checked) fbFire("shapeFill", true, "change");
  fbFire("shapeFC", e.target.value, "input");
  fbSync();
};
$("fbFA").oninput = (e) => {
  if (!$("shapeFill").checked) fbFire("shapeFill", true, "change");
  fbFire("shapeFA", e.target.value, "input");
  fbSync();
};
// 3.0.20: все настройки фигуры — зеркало полей слева (значения, доступность и видимость — оттуда)
const FB_SH_NUM = [["fbShW", "shapeW"], ["fbShH", "shapeH"], ["fbShWcm", "shapeWcm"], ["fbShHcm", "shapeHcm"], ["fbShRot", "shapeRot"], ["fbShN", "shapeN"], ["fbShTb", "shapeTb"], ["fbShSk", "shapeSk"], ["fbShDim", "shapeDim"], ["fbLA", "shapeLA"]];
for (const [id, src] of FB_SH_NUM) $(id).addEventListener("input", (e) => {
  fbFire(src, e.target.value, "input");
  fbQueue();
});
const FB_SH_CHK = [["fbShLock", "shapeLock"], ["fbShFlip", "shapeFlip"], ["fbShInv", "shapeInv"]];
for (const [id, src] of FB_SH_CHK) $(id).onclick = () => {
  fbFire(src, !$(src).checked, "change");
  fbSync();
};
for (const [id, src] of [["fbShRCCW", "shapeRotCCW"], ["fbShRCW", "shapeRotCW"], ["fbShR0", "shapeRot0"], ["fbShBezDel", "shapeBezDel"]]) $(id).onclick = fbClick(src);
// «Снаружи фигуры»: Гасить / Затемнить / Рамка — значками
const FB_MODE_IC = {
  off: '<svg viewBox="0 0 20 20" width="18" height="18"><rect x="2" y="3" width="16" height="14" rx="1.5" fill="currentColor"/><circle cx="10" cy="10" r="4.6" fill="var(--panel)" stroke="currentColor" stroke-width="1.2"/></svg>',
  dim: '<svg viewBox="0 0 20 20" width="18" height="18"><rect x="2" y="3" width="16" height="14" rx="1.5" fill="currentColor" opacity=".4"/><circle cx="10" cy="10" r="4.6" fill="var(--panel)" stroke="currentColor" stroke-width="1.2"/></svg>',
  frame: '<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="3" width="16" height="14" rx="1.5" stroke-dasharray="2 2" opacity=".6"/><circle cx="10" cy="10" r="4.6"/></svg>'
};
document.querySelectorAll(".seg.shapeMode button").forEach((src) => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "fb-b";
  b.dataset.m = src.dataset.m;
  b.title = src.textContent.trim() + " — " + src.title;
  b.innerHTML = FB_MODE_IC[src.dataset.m] || src.textContent;
  b.onclick = () => {
    src.click();
    fbSync();
  };
  $("fbShMode").appendChild(b);
});
// видна ли строка настройки слева (поля, которых у этой формы нет, там скрыты)
function fbRowShown(el) {
  for (let n = el; n && n.nodeType === 1; n = n.parentNode) {
    if (n.hidden) return false;
    if (n.classList.contains("sec-body")) break;
  }
  return true;
}
function fbShapeSync() {
  for (const [id, src] of FB_SH_NUM) {
    const a = $(id), b = $(src);
    if (document.activeElement !== a) a.value = b.value;
    a.disabled = b.disabled;
  }
  for (const [id, src] of FB_SH_CHK) {
    $(id).setAttribute("aria-pressed", String(!!$(src).checked));
    $(id).disabled = $(src).disabled;
  }
  document.querySelectorAll("#fbShape .fb-grp2[data-row]").forEach((g) => {
    const r = $(g.dataset.row);
    g.hidden = !r || !fbRowShown(r);
  });
  const st = S(), c = (st.cacheShapes || [])[ui.selShape];
  const mode = c ? c.frame ? "frame" : c.dimOnly ? "dim" : "off" : "";
  const pressed = document.querySelector('.seg.shapeMode button[aria-pressed="true"]');
  const m = pressed ? pressed.dataset.m : mode;
  $("fbShMode").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.m === m)));
  // с инверсией гасится / темнеет под фигурой — подпись «Внутри»
  setTxt($("fbShOut"), $("shapeInv").checked ? "Внутри" : "Снаружи");
  $("fbShMode").classList.toggle("inv", $("shapeInv").checked);
}
// ---- кабинеты
// цвет выделенных кабинетов — квадрат как слева; щелчок — палитра: недавние, основные, «другой цвет»
function fbPalOpen() {
  const pop = $("fbPalPop");
  if (!pop.hidden) return pop.hidden = true;
  for (const [, p] of fbPops) p.hidden = true;
  const mk = (h) => {
    const b = document.createElement("button");
    b.type = "button";
    b.style.background = h;
    b.title = h;
    b.onclick = () => {
      pop.hidden = true;
      paintSelected(h);
      fbSync();
    };
    return b;
  };
  const rc = recentColors();
  $("fbPalR").replaceChildren(...rc.map(mk));
  $("fbPalRh").hidden = $("fbPalR").hidden = !rc.length;
  $("fbPalP").replaceChildren(...PAL_PRESET.map(mk));
  pop.hidden = false;
}
$("fbCabCol").addEventListener("click", (e) => {
  e.stopPropagation();
  fbPalOpen();
});
$("fbPalOther").onclick = () => {
  const cur = selCabColor();
  if (cur && cur.length === 1) $("fbPalIn").value = cur[0].toLowerCase();
  $("fbPalIn").click();
};
$("fbPalIn").addEventListener("change", (e) => {
  $("fbPalPop").hidden = true;
  paintSelected(e.target.value.toUpperCase());
  fbSync();
});
window.addEventListener("pointerdown", (e) => {
  const pop = $("fbPalPop");
  if (!pop.hidden && !pop.contains(e.target) && !$("fbCabCol").contains(e.target)) pop.hidden = true;
}, true);
$("fbCabNone").onclick = fbClick("palNone");
$("fbCabPaint").onclick = fbClick("btnPaint");
// гасить / вернуть выделенные — как в меню правой кнопки
const fbBlack = (on) => () => {
  for (const k of ui.selected) applyBlack(k, on);
  changed(false);
  fbSync();
};
$("fbCabOff").onclick = fbBlack(true);
$("fbCabOn").onclick = fbBlack(false);
for (const [id, src] of [["fbCrCCW", "cabRotCCW"], ["fbCrCW", "cabRotCW"], ["fbCr0", "cabRot0"]]) $(id).onclick = fbClick(src);
$("fbCabGrp").onclick = fbClick("btnCabGroup");
$("fbCabUngrp").onclick = fbClick("btnCabUngroup");
$("fbCabClr").onclick = fbClick("btnClearSel");
// ---- всплывающие меню: положение текста, формы фигур, угловые кабинеты, границы — копии кнопок из панели слева
const fbPops = [];
function fbPop(btns, pop, srcSel, after) {
  pop.innerHTML = "";
  document.querySelectorAll(srcSel).forEach((src) => {
    const b = document.createElement("button");
    b.type = "button";
    b.title = src.title || src.getAttribute("aria-label") || "";
    b.innerHTML = src.innerHTML;
    b.onclick = () => {
      pop.hidden = true;
      src.click();
      if (after) after();
      fbSync();
    };
    pop.appendChild(b);
  });
  for (const btn of btns) {
    fbPops.push([btn, pop]);
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = pop.hidden;
      for (const [, p] of fbPops) p.hidden = true;
      pop.hidden = !open;
      // общее меню фигур — под той кнопкой, по которой щёлкнули
      if (pop === $("fbShapePop") && open) {
        const r = btn.getBoundingClientRect(), R = $("fbar").getBoundingClientRect();
        pop.style.left = r.left - R.left + "px";
        pop.style.top = r.bottom - R.top + 6 + "px";
      }
    });
  }
}
fbPop([...document.querySelectorAll(".fb-addshape")], $("fbShapePop"), ".seg.shapeType button", () => $("shapeAdd").click());
document.querySelectorAll(".fb-addtext").forEach((btn) => btn.onclick = () => $("btnAddText").click());
fbPop([$("fbPosBtn")], $("fbPosPop"), "#txPos button");
fbPop([$("fbCornBtn")], $("fbCornPop"), ".seg.corner button");
fbPop([$("fbEdgeBtn")], $("fbEdgePop"), ".ctl.borders .seg.edges button");
fbPop([$("fbShpdBtn")], $("fbShpdPop"), ".seg.shaped button");
window.addEventListener("pointerdown", (e) => {
  for (const [btn, pop] of fbPops) if (!pop.hidden && !pop.contains(e.target) && !btn.contains(e.target)) pop.hidden = true;
}, true);
// ---- что выбрано последним: текст, фигура или кабинеты
let fbPrev = { t: -1, s: -1, c: 0, uid: "" }, fbCtx = "none";
function fbContext(st) {
  const shapeOk = typeof shapesHere === "function" && shapesHere(st) && ui.selShape >= 0 && !!(st.cacheShapes || [])[ui.selShape];
  const t = st.kind === "vol" ? -1 : ui.textMode, s = shapeOk ? ui.selShape : -1, c = ui.selected ? ui.selected.size : 0;
  const has = { text: t >= 0, shape: s >= 0, cab: c > 0 };
  // что изменилось с прошлого раза — то и показываем
  if (st.uid !== fbPrev.uid) fbCtx = "none";
  if (t >= 0 && t !== fbPrev.t) fbCtx = "text";
  else if (s >= 0 && s !== fbPrev.s) fbCtx = "shape";
  else if (c > 0 && c !== fbPrev.c) fbCtx = "cab";
  fbPrev = { t, s, c, uid: st.uid };
  if (!has[fbCtx]) fbCtx = has.text ? "text" : has.shape ? "shape" : has.cab ? "cab" : "none";
  return fbCtx;
}
const fbOpt = (sel, v) => {
  const s = String(v);
  if (![...sel.options].some((o) => o.value === s)) {
    const o = document.createElement("option");
    o.value = s;
    o.textContent = s + "%";
    sel.appendChild(o);
  }
  sel.value = s;
};
function fbSync() {
  if (!document.documentElement.classList.contains("pc")) return;
  if (document.documentElement.dataset.page === "field") return fbSyncField();
  if (document.documentElement.dataset.page === "tz") return fbSyncTz();
  for (const id of ["fbT", "fbTT", "fbTI"]) $(id).hidden = true;
  if (document.documentElement.dataset.page !== "mask") return;
  for (const id of ["fbF", "fbFM"]) $(id).hidden = true;
  const st = S();
  if (!st) return;
  const ctx = fbContext(st);
  $("fbNone").hidden = ctx !== "none";
  {
    const ledM = !st.kind || st.kind === "led";
    for (const id of ["fbAC0", "fbAC"]) {
      $(id).hidden = !ledM;
      $(id).setAttribute("aria-pressed", String(!!st.autoContour));
    }
  }
  $("fbText").hidden = ctx !== "text";
  $("fbShape").hidden = ctx !== "shape";
  $("fbCab").hidden = ctx !== "cab";
  const shapesOk = typeof shapesHere === "function" && shapesHere(st);
  document.querySelectorAll(".fb-addshape").forEach((b) => b.hidden = !shapesOk);
  document.querySelectorAll(".fb-addtext").forEach((b) => b.hidden = st.kind === "vol");
  if (ctx === "text") {
    const t = fbTargets(), sty = t[0].get() || {}, ex = t[0].extra;
    setTxt($("fbWho"), ex ? t.length > 1 ? "Тексты: ".concat(t.length) : "Доп. текст ".concat(ui.selLabel + 1) : "Основной текст");
    setVal($("fbFont"), sty.font || "");
    $("fbBold").setAttribute("aria-pressed", String(!!sty.b));
    $("fbItal").setAttribute("aria-pressed", String(!!sty.i));
    setVal($("fbSize"), $("txSize").value);
    setVal($("fbColor"), $("txColor").value);
    const al = sty.al || "c";
    document.querySelectorAll("#fbAlign button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.al === al)));
    // выравнивание строк — только у основного текста (у доп. текста одна строка)
    $("fbAlign").hidden = ex;
    document.querySelector(".fb-alsep").hidden = ex;
    setTxt($("fbRotVal"), $("txRotVal").textContent);
    fbOpt($("fbOw"), sty.ow || 0);
    setVal($("fbOc"), (sty.oc || "#000000").toLowerCase());
    fbOpt($("fbOp"), sty.op || 100);
  } else if (ctx === "shape") {
    const c = st.cacheShapes[ui.selShape];
    setTxt($("fbShWho"), "Фигура ".concat(ui.selShape + 1));
    setVal($("fbLine"), st.cacheLine === false ? "0" : st.cacheLineDash ? "2" : "1");
    setVal($("fbLW"), String(st.cacheLineW || 6));
    setVal($("fbLC"), (st.cacheLineColor || "#FFFFFF").toLowerCase());
    $("fbFill").checked = !!c.fill;
    setVal($("fbFC"), (c.fc || $("shapeFC").value || "#ff0000").toLowerCase());
    if (document.activeElement !== $("fbFA")) $("fbFA").value = +c.fa > 0 ? Math.round(+c.fa) : 50;
    fbShapeSync();
  } else if (ctx === "cab") {
    setTxt($("fbCabWho"), "Кабинеты: ".concat(ui.selected.size));
    // тот же цвет, что у квадрата «Цвет кабинетов» слева: один цвет или два — наискосок
    const cur = selCabColor(), sw = $("fbCabCol");
    sw.classList.toggle("empty", !cur);
    sw.style.background = !cur ? "" : cur.length > 1 ? "linear-gradient(135deg, ".concat(cur[0], " 50%, ").concat(cur[1], " 50%)") : cur[0];
    sw.title = !cur ? "Цвет выделенных кабинетов — нажмите и выберите" : cur.length > 1 ? "У выделенных кабинетов разные цвета — нажмите и выберите новый" : "Цвет выделенных ".concat(cur[0], " — нажмите и выберите новый");
    // угловые и границы — только у LED-кабинетов
    const led = !st.kind || st.kind === "led";
    for (const id of ["fbCornBtn", "fbEdgeBtn", "fbShpdBtn"]) $(id).parentNode.hidden = !led;
    $("fbCabLast").style.background = $("lastSw").style.background || "";
    // поворот — только если он разрешён в «Поворот кабинетов»
    $("fbCabRot").hidden = !$("cabRotOn").checked;
    $("fbCabMv").setAttribute("aria-pressed", String(!!$("cabMoveOn").checked));
    $("fbCabRo").setAttribute("aria-pressed", String(!!$("cabRotOn").checked));
    $("fbCabMv").hidden = $("fbCabRo").hidden = !led;
  }
}
for (const [id, src] of [["fbCabMv", "cabMoveOn"], ["fbCabRo", "cabRotOn"]]) $(id).onclick = () => {
  fbFire(src, !$(src).checked, "change");
  fbSync();
};
for (const id of ["fbAC0", "fbAC"]) $(id).onclick = () => {
  fbFire("autoContour", !$("autoContour").checked, "change");
  fbSync();
};
let fbQ = 0;
function fbQueue() {
  if (fbQ) return;
  fbQ = requestAnimationFrame(() => {
    fbQ = 0;
    fbSync();
  });
}
// обновлять после каждой перерисовки (сменили выбор, маску, страницу)
{
  const rd0 = requestDraw;
  requestDraw = function() {
    const r = rd0.apply(this, arguments);
    fbQueue();
    return r;
  };
}
// ---- двойной щелчок по тексту на маске — правка прямо на месте
let mtxEd = null;
function mtxHit(x, y) {
  if (!L || !L.st) return null;
  const st = L.st, hitF = (f) => Math.abs(x - f.cx) <= f.w / 2 + 6 && Math.abs(y - f.cy) <= f.h / 2 + 6;
  for (let i = (st.extraLabels || []).length - 1; i >= 0; i--) if (hitF(labelFrame(i))) return { k: "x", i, f: labelFrame(i) };
  if (titleLines(st, L.scale).length && hitF(titleFrame())) return { k: "t", f: titleFrame() };
  return null;
}
function mtxStart(h) {
  mtxStop(true);
  const st = L.st, s = L.scale, it = h.k === "x" ? st.extraLabels[h.i] : null, sty = it ? it.sty : st.tSty;
  // строки блока — как на холсте; правится доп. текст целиком или название экрана (строка 2) у основного
  let lines, edIdx;
  if (it) {
    lines = [[it.text || "", Math.min(900, Math.max(6, +it.size || 120)) * s]];
    edIdx = 0;
  } else {
    const size = inscSize(st), s1 = Math.max(10, size) * s, s2 = Math.max(8, size * 0.55) * s, s3 = Math.max(4, Math.max(8, size * 0.55) * 0.5) * s;
    lines = [];
    if (st.line1Enabled !== false) lines.push([titleText(st), s1]);
    edIdx = lines.length;
    lines.push([st.name || "", s2]);
    if (st.line3Enabled) lines.push([physText(st), s3]);
  }
  const gap = it ? 0 : TITLE_GAP * s, b = withSty(sty, () => blockSize(lines.map(([t, z]) => [t || "M", z]), gap));
  const box = document.createElement("div");
  box.className = "mtxed";
  box.style.color = (it ? it.color : st.titleColor) || txDefColor(st);
  if (sty && sty.op) box.style.opacity = sty.op / 100;
  box.style.textAlign = sty && sty.al === "l" ? "left" : sty && sty.al === "r" ? "right" : "center";
  const wr = $("wrap").getBoundingClientRect(), pr = pv.getBoundingClientRect();
  box.style.left = pr.left - wr.left + h.f.cx + "px";
  box.style.top = pr.top - wr.top + h.f.cy + "px";
  const deg = it ? +it.rotation || 0 : titleRot(st);
  box.style.transform = "translate(-50%, -50%) rotate(".concat(-deg, "deg)");
  let ed = null;
  lines.forEach(([t, z], k) => {
    const d = document.createElement("div");
    d.style.font = txFont(z, sty);
    d.style.lineHeight = b.ms[k].h + "px";
    d.style.height = b.ms[k].h + "px";
    if (k < lines.length - 1) d.style.marginBottom = gap + "px";
    if (sty && sty.ow) {
      d.style.webkitTextStroke = Math.max(0.5, z * sty.ow / 100) + "px " + (sty.oc || "#000");
      d.style.paintOrder = "stroke fill";
    }
    d.textContent = t;
    if (k === edIdx) {
      d.contentEditable = "true";
      d.spellcheck = false;
      d.className = "mtxed-line";
      ed = d;
    }
    box.appendChild(d);
  });
  $("wrap").appendChild(box);
  TX_HIDE = it || st;
  requestDraw();
  mtxEd = { box, ed, k: h.k, i: h.i, uid: st.uid, v0: lines[edIdx][0] };
  ed.focus();
  // всё выделено — можно сразу печатать новый текст или щёлкнуть, чтобы поставить курсор
  const r = document.createRange();
  r.selectNodeContents(ed);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(r);
  ed.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      mtxStop();
    } else if (e.key === "Escape") {
      e.preventDefault();
      mtxStop(true);
    }
  });
  // вставка — только текстом, без оформления
  ed.addEventListener("paste", (e) => {
    e.preventDefault();
    const t = (e.clipboardData || window.clipboardData).getData("text").replace(/\s*\n\s*/g, " ");
    document.execCommand("insertText", false, t);
  });
  ed.addEventListener("blur", () => mtxStop());
}
function mtxStop(cancel) {
  const m = mtxEd;
  if (!m) return;
  mtxEd = null;
  const v = m.ed.textContent.replace(/\s+/g, " ").trim();
  m.box.remove();
  TX_HIDE = null;
  requestDraw();
  if (cancel || v === m.v0) return;
  const st = project.screens.find((q) => q.uid === m.uid);
  if (!st) return;
  if (m.k === "x") {
    const it = st.extraLabels[m.i];
    if (!it) return;
    it.text = v;
    refreshTextList();
    changed();
  } else if (v) {
    // название экрана — через поле «Название», чтобы обновилось всё, что от него зависит
    fbFire("scrName", v, "input");
    $("scrName").dispatchEvent(new Event("change"));
  }
}
pv.addEventListener("dblclick", (e) => {
  if (document.documentElement.dataset.page !== "mask" || ui.bezDraw) return;
  const [x, y] = local(e), h = mtxHit(x, y);
  if (!h) return;
  e.preventDefault();
  mtxStart(h);
});
fbSync();

// ---- 3.0.25: общее поле — строка поля и строка выбранной на поле маски (зеркало полей слева)
const FB_F_NUM = [["fbFX", "fX"], ["fbFY", "fY"], ["fbFCX", "fCX"], ["fbFCY", "fCY"], ["fbFRot", "fRotIn"]];
for (const [id, src] of FB_F_NUM) $(id).addEventListener("input", (e) => {
  fbFire(src, e.target.value, "input");
  fbQueue();
});
for (const [id, src] of [["fbFAdd", "fAdd"], ["fbFDel", "fDelete"], ["fbFRen", "fRename"], ["fbFAll", "fAll"], ["fbFRow", "fRow"], ["fbFCol", "fCol"], ["fbFTMinus", "fTitleMinus"], ["fbFTPlus", "fTitlePlus"], ["fbFTCenter", "fTitleCenter"], ["fbFRCCW", "fRotCCW"], ["fbFRCW", "fRotCW"], ["fbFR0", "fRot0"], ["fbFZTop", "fZTop"], ["fbFZUp", "fZUp"], ["fbFZDown", "fZDown"], ["fbFZBot", "fZBottom"]]) $(id).onclick = fbClick(src);
for (const [id, src] of [["fbFMag", "fMagnet"], ["fbFMMag", "fMagnet"], ["fbFStack", "fStack"], ["fbFTitle", "fTitle"], ["fbFMeters", "fMeters"]]) $(id).onclick = () => {
  fbFire(src, !$(src).checked, "change");
  fbSync();
};
$("fbFSel").onchange = (e) => {
  fbFire("fSel", e.target.value, "change");
  fbSync();
};
$("fbFTSize").onchange = (e) => {
  fbFire("fTitleSize", e.target.value, "change");
  fbSync();
};
// убрать выбранную маску с поля — та же галочка в списке слева
$("fbFOff").onclick = () => {
  const cb = document.querySelector("#fList .fitem.sel input[type=checkbox]");
  if (cb && cb.checked) cb.click();
  fbSync();
};
$("fbFCopy").onclick = () => {
  copyField();
  fbSync();
};
$("fbFFile").addEventListener("input", (e) => fbFire("fFile", e.target.value, "input"));
$("fbFFile").addEventListener("change", (e) => {
  fbFire("fFile", e.target.value, "change");
  fbSync();
});
for (const id of ["fbFPick", "fbFMPick"]) $(id).onchange = (e) => {
  fbFire("fSelPick", e.target.value, "change");
  fbSync();
};
function fbPickMirror(id) {
  const a = $(id), b = $("fSelPick");
  if (a.dataset.src !== b.innerHTML) {
    a.dataset.src = b.innerHTML;
    a.innerHTML = b.innerHTML;
    for (const o of a.options) o.textContent = o.value ? o.textContent.replace(/ · \d+×\d+$/, "") : "Маска…";
  }
  setVal(a, b.value);
}
function fbSyncField() {
  for (const id of ["fbNone", "fbText", "fbShape", "fbCab", "fbT", "fbTT", "fbTI"]) $(id).hidden = true;
  const f = CF(), sel = fld.sel && f.items.find((it) => it.uid === fld.sel);
  $("fbF").hidden = !!sel;
  $("fbFM").hidden = !sel;
  if (sel) {
    const st = project.screens.find((q) => q.uid === sel.uid);
    fbPickMirror("fbFMPick");
    const sz = ($("fSelSize").textContent.match(/\d+×\d+/) || [""])[0];
    setTxt($("fbFMSize"), sz);
    setTxt($("fbFMZ"), ($("fZVal").textContent.match(/\d+ из \d+/) || [""])[0].replace(" из ", "/"));
    $("fbFMMag").setAttribute("aria-pressed", String(!!$("fMagnet").checked));
    for (const [id, src] of FB_F_NUM) if (document.activeElement !== $(id)) $(id).value = $(src).value;
    return;
  }
  if ($("fbFSel").innerHTML !== $("fSel").innerHTML) $("fbFSel").innerHTML = $("fSel").innerHTML;
  setVal($("fbFSel"), $("fSel").value);
  fbPickMirror("fbFPick");
  $("fbFDel").disabled = $("fDelete").disabled;
  setTxt($("fbFFilePre"), $("fFilePre").textContent);
  if (document.activeElement !== $("fbFFile")) {
    $("fbFFile").value = $("fFile").value;
    $("fbFFile").placeholder = $("fFile").placeholder || "";
  }
  if (!$("fbFTSize").options.length && $("fTitleSize").options.length) $("fbFTSize").innerHTML = $("fTitleSize").innerHTML;
  setVal($("fbFTSize"), $("fTitleSize").value);
  for (const [id, src] of [["fbFMag", "fMagnet"], ["fbFStack", "fStack"], ["fbFTitle", "fTitle"], ["fbFMeters", "fMeters"]]) $(id).setAttribute("aria-pressed", String(!!$(src).checked));
}

// ---- 3.0.26: «Формирование ТЗ» — общая строка; щелчок по тексту на листе — строка текста; выбран пункт списка — его строка
let fbTzText = null, fbTzPrev = { pick: "", txt: null }, fbTzCtx = "none";
function fbTzDown(e) {
  const h = tzHitAt(tzLocal(e));
  fbTzText = h ? h.pk : null;
  fbQueue();
}
function fbTMirror(id, src) {
  const a = $(id), b = $(src);
  if (a.innerHTML !== b.innerHTML) a.innerHTML = b.innerHTML;
  setVal(a, b.value);
  a.disabled = b.disabled;
}
for (const [id, src] of [["fbTTpl", "tTpl"], ["fbTTplSub", "tTplSub"], ["fbTWhich", "tMaskWhich"], ["fbTPer", "tMaskPer"]]) $(id).onchange = (e) => {
  fbFire(src, e.target.value, "change");
  fbSync();
};
$("fbTEven").onclick = () => {
  fbFire("tEvenSize", !$("tEvenSize").checked, "change");
  fbSync();
};
for (const k of ["res", "name", "phys", "file"]) $("fbTL" + k).onclick = () => {
  fbFire("tLab_" + k, !$("tLab_" + k).checked, "change");
  fbSync();
};
for (const [id, src] of [["fbTDef", "tDefault"], ["fbTOvAdd", "tOvPick"], ["fbTOvClr", "tOvClear"], ["fbTTxtEd", "tTxtEdit"], ["fbTTEdit", "tTxtEdit"], ["fbTTReset", "tTxtReset"], ["fbTTPos", "tTxtPos"], ["fbTITop", "tOrdTop"], ["fbTIUp", "tOrdUp"], ["fbTIDown", "tOrdDown"], ["fbTIBot", "tOrdBottom"]]) $(id).onclick = fbClick(src);
$("fbTIOn").onclick = () => {
  const cb = document.querySelector("#tList .fitem.sel input[type=checkbox]");
  if (cb && !cb.disabled) cb.click();
  fbSync();
};
$("fbTIClr").onclick = () => {
  ui.tzPick = "";
  for (const x of document.querySelectorAll("#tList .fitem.sel")) x.classList.remove("sel");
  if (typeof syncTzOrdBtns === "function") syncTzOrdBtns();
  fbSync();
};
const FB_T_TOG = [["fbTOv", "tOverview"], ["fbTProj", "tSaveProj"], ["fbTSvg", "tSvg"], ["fbTVmask", "tVolMask"], ["fbTVcom", "tVolCom"], ["fbTV3d", "tVol3d"], ["fbTVinfo", "tVolInfo"]];
for (const [id, src] of FB_T_TOG) $(id).onclick = () => {
  fbFire(src, !$(src).checked, "change");
  fbSync();
};
for (const [id, src] of [["fbTGrid", "tMaskGrid"], ["fbTImgPer", "tImgPer"]]) $(id).onchange = (e) => {
  fbFire(src, e.target.value, "change");
  fbSync();
};
function fbSyncTz() {
  for (const id of ["fbNone", "fbText", "fbShape", "fbCab", "fbF", "fbFM"]) $(id).hidden = true;
  const pick = ui.tzPick || "", txt = ui.tzEdit ? ui.tzEdit.pk : fbTzText;
  // что изменилось последним — то и показываем
  if (pick && pick !== fbTzPrev.pick) fbTzCtx = "item";
  else if (txt && txt !== fbTzPrev.txt) fbTzCtx = "text";
  else if (!txt && fbTzPrev.txt) fbTzCtx = pick ? "item" : "none";
  fbTzPrev = { pick, txt };
  if (fbTzCtx === "item" && !pick) fbTzCtx = txt ? "text" : "none";
  if (fbTzCtx === "text" && !txt) fbTzCtx = pick ? "item" : "none";
  if (ui.tzEdit) fbTzCtx = "text";
  $("fbT").hidden = fbTzCtx !== "none";
  $("fbTT").hidden = fbTzCtx !== "text";
  $("fbTI").hidden = fbTzCtx !== "item";
  if (fbTzCtx === "none") {
    fbTMirror("fbTTpl", "tTpl");
    fbTMirror("fbTTplSub", "tTplSub");
    $("fbTTplSub").hidden = $("tTplSubRow").hidden;
    fbTMirror("fbTWhich", "tMaskWhich");
    fbTMirror("fbTPer", "tMaskPer");
    $("fbTEven").setAttribute("aria-pressed", String(!!$("tEvenSize").checked));
    for (const k of ["res", "name", "phys", "file"]) $("fbTL" + k).setAttribute("aria-pressed", String(!!$("tLab_" + k).checked));
    fbTMirror("fbTGrid", "tMaskGrid");
    $("fbTGrid").hidden = $("tMaskGridRow").hidden;
    fbTMirror("fbTImgPer", "tImgPer");
    const ovn = $("tImgs").children.length;
    setTxt($("fbTOvN"), ovn ? String(ovn) : "");
    $("fbTOvClr").disabled = !ovn;
    for (const [id, src] of FB_T_TOG) $(id).setAttribute("aria-pressed", String(!!$(src).checked));
    $("fbTSvg").hidden = $("tSvgRow").hidden;
    $("fbTVol").hidden = $("tVolWhat").hidden;
    if ($("fbTVolSet")) $("fbTVolSet").hidden = $("tVolSetRow").hidden;
    $("fbTVolSep").hidden = $("tVolWhat").hidden && $("tVolSetRow").hidden;
  } else if (fbTzCtx === "text") {
    setTxt($("fbTTWho"), txt.startsWith("note:") ? "Подпись слайда" : "Текст шаблона");
    const ed = !!(ui.tzEdit && ui.tzEdit.dock);
    $("fbTTEdit").hidden = ed;
    $("fbTTReset").hidden = ed || $("tTxtReset").hidden;
    $("fbTTPos").hidden = ed || $("tTxtPos").hidden;
  } else {
    const row = document.querySelector("#tList .fitem.sel");
    const parts = row ? [...row.querySelectorAll("span")].map((x) => x.textContent.trim()).filter(Boolean) : [];
    setTxt($("fbTIWho"), (parts.length ? parts.join(" · ") : row ? row.textContent.trim() : "Пункт").slice(0, 48));
    const cb = row && row.querySelector("input[type=checkbox]");
    $("fbTIOn").setAttribute("aria-pressed", String(!!(cb && cb.checked)));
    $("fbTIOn").disabled = !cb || cb.disabled;
    for (const [id, src] of [["fbTITop", "tOrdTop"], ["fbTIUp", "tOrdUp"], ["fbTIDown", "tOrdDown"], ["fbTIBot", "tOrdBottom"]]) $(id).disabled = $(src).disabled;
  }
}
// выбор строки в списке ТЗ не перерисовывает лист — обновляем панель сами
$("tList").addEventListener("click", () => setTimeout(fbQueue, 0));
