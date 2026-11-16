// ===== 2.0.155: контекстное меню (ПКМ) — копировать / вставить / дублировать / удалить и т.д. =====
let ctxEl = null, ctxSub = null;
function closeCtxSub() {
  if (ctxSub) {
    ctxSub.remove();
    ctxSub = null;
  }
  if (ctxEl) for (const b of ctxEl.querySelectorAll(".ctx-it.open")) b.classList.remove("open");
}
function closeCtx() {
  closeCtxSub();
  if (ctxEl) {
    ctxEl.remove();
    ctxEl = null;
  }
}
// 2.0.198: вложенное меню (it.sub — список пунктов): открывается справа (нет места — слева) при наведении или щелчке
function openCtxSub(b, sub) {
  closeCtxSub();
  b.classList.add("open");
  const m = ctxBuild(sub, true), r = b.getBoundingClientRect();
  document.body.appendChild(m);
  ctxSub = m;
  const w = m.getBoundingClientRect().width, h = m.getBoundingClientRect().height;
  const x = r.right + w + 4 < innerWidth ? r.right + 2 : Math.max(4, r.left - w - 2);
  m.style.left = x + "px";
  m.style.top = Math.max(4, Math.min(r.top - 6, innerHeight - h - 6)) + "px";
}
function showCtx(cx, cy, items) {
  closeCtx();
  items = (items || []).filter(Boolean);
  if (!items.length) return;
  const m = ctxBuild(items, false);
  document.body.appendChild(m);
  ctxEl = m;
  const r = m.getBoundingClientRect();
  m.style.left = Math.max(4, Math.min(cx, innerWidth - r.width - 6)) + "px";
  m.style.top = Math.max(4, Math.min(cy, innerHeight - r.height - 6)) + "px";
}
function ctxBuild(items, isSub) {
  const m = document.createElement("div");
  m.className = "ctxmenu" + (isSub ? " sub" : "");
  for (const it of items.filter(Boolean)) {
    if (it.sep) {
      const s = document.createElement("div");
      s.className = "ctx-sep";
      m.appendChild(s);
      continue;
    }
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ctx-it" + (it.danger ? " danger" : "") + (it.sub ? " has-sub" : "") + (it.checked ? " checked" : "");
    b.textContent = it.label;
    if (it.disabled) b.disabled = true;
    else if (it.sub) {
      b.addEventListener("click", (ev) => {
        ev.stopPropagation();
        // щелчок всегда открывает (наведение могло уже открыть — не закрываем обратно)
        if (!(ctxSub && b.classList.contains("open"))) openCtxSub(b, it.sub);
      });
      b.addEventListener("mouseenter", () => openCtxSub(b, it.sub));
    } else {
      b.addEventListener("click", (ev) => {
        ev.stopPropagation();
        closeCtx();
        it.fn();
      });
      // в главном меню наведение на обычный пункт закрывает вложенное
      if (!isSub) b.addEventListener("mouseenter", closeCtxSub);
    }
    m.appendChild(b);
  }
  return m;
}
document.addEventListener("pointerdown", (e) => {
  if (ctxEl && !ctxEl.contains(e.target) && !(ctxSub && ctxSub.contains(e.target))) closeCtx();
}, true);
window.addEventListener("blur", closeCtx);
window.addEventListener("resize", closeCtx);
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeCtx();
});
pv.addEventListener("contextmenu", (e) => {
  if (ui.page === "out") {
    e.preventDefault();
    ctxOut(e);
  } else if (ui.page === "mask") {
    e.preventDefault();
    ctxMask(e);
  }
});
// ---- ПКМ в мэппинге: слайсы
function ctxOut(e) {
  const o = OC();
  if (!o) return;
  const [x, y, , , P] = outPt(e), v = P && o.view === "both" ? P.v : o.view;
  const s = outHit(o, x, y, v) || curSlice();
  if (s && outSelIds(o).size > 1 && outSelIds(o).has(s.id)) return ctxSlices(e, o);
  const items = [];
  if (s) {
    ui_out.sel = s.id;
    ui_out.more = new Set();
    o.src = sliceSrc(o, s);
    if (v !== "in") o.scr = s.scr;
    refreshOutPanel();
    requestDraw();
    items.push(
      { label: "Копировать", fn: () => { ui.clipSlice = JSON.parse(JSON.stringify(s)); status("Слайс скопирован", true); } },
      { label: "Дублировать", fn: () => $("oSlDup").click() },
      { label: s.on ? "Выключить" : "Включить", fn: () => { s.on = !s.on; outChanged(false); } },
      { sep: true },
      { label: "Повернуть 90°", fn: () => { s.rot = ((s.rot || 0) + 90) % 360; outChanged(true); } },
      { label: "Отразить ↔", fn: () => { s.fh = !s.fh; outChanged(true); } },
      { label: "Отразить ↕", fn: () => { s.fv = !s.fv; outChanged(true); } },
      { sep: true },
      { label: "Отправить на выход", sub: outSendMenu(o, [s]) },
      { label: "Разбить по кабинетам", fn: () => outSplit(o) },
      { label: "Положить на свободное место", fn: () => { outPackSel(o, [s]); outChanged(true); } },
      { sep: true }
    );
  }
  items.push({ label: "Вставить слайс", disabled: !ui.clipSlice, fn: () => ctxPasteSlice(o) });
  if (s) items.push({ sep: true }, { label: "Удалить", danger: true, fn: () => $("oSlDel").click() });
  showCtx(e.clientX, e.clientY, items);
}
// меню для нескольких выбранных слайсов
function ctxSlices(e, o) {
  const L = outSelList(o), allOn = L.every((q) => q.on !== false);
  showCtx(e.clientX, e.clientY, [
    { label: "Выбрано слайсов: " + L.length, disabled: true },
    { sep: true },
    { label: "Объединить в один", fn: () => outMerge(o) },
    { label: "Разбить по кабинетам", fn: () => outSplit(o) },
    { label: "Переименовать по шаблону…", fn: () => outRenameTpl(o) },
    { label: "Положить на свободные места", fn: () => { outPackSel(o, L); outChanged(true); } },
    { label: allOn ? "Выключить" : "Включить", fn: () => outSelOn(o, !allOn) },
    { label: "Отправить на выход", sub: outSendMenu(o, L) },
    { sep: true },
    { label: "Удалить (" + L.length + ")", danger: true, fn: () => outSelDelete(o) }
  ]);
}
function ctxPasteSlice(o) {
  if (!ui.clipSlice) return;
  const scr = outScr(o), c = { ...ui.clipSlice, id: newUid(), name: ui.clipSlice.name + " (вставка)", scr: scr.id, ox: (ui.clipSlice.ox | 0) + 40, oy: (ui.clipSlice.oy | 0) + 40 };
  o.slices.push(c);
  ui_out.sel = c.id;
  outChanged(true);
  status("Слайс вставлен", true);
}
// ---- ПКМ на холсте масок: текст или кабинеты
function ctxMask(e) {
  const [x, y] = local(e), st = S();
  if (!L || !st) return;
  const th = textHoverAt(x, y, e);
  if (th && th.k[0] === "l") return ctxText(e, +th.k.slice(1));
  // 3.0.2: ПКМ по фигуре каше — копировать / вставить / дублировать / удалить
  const si = shapeAt(st, x, y);
  if (si >= 0 && !(st.kind === "led" || !st.kind) || si >= 0 && si === ui.selShape) return ctxShape(e, si);
  if (si >= 0 && (st.kind === "led" || !st.kind) && !ui.selected.size) return ctxShape(e, si);
  // кабинеты (только LED)
  if (st.kind && st.kind !== "led") return;
  const cell = pointToCell(x, y);
  if (cell && !ui.selected.has(key(...cell)) && !ui.selected.size) ui.selected.add(key(...cell));
  else if (cell && !ui.selected.size) ui.selected.add(key(...cell));
  const sel = [...ui.selected];
  const items = [];
  if (sel.length) {
    const anyBlack = sel.some((k) => st.blackCabinets.includes(k)), anyShift = st.cabShift && sel.some((k) => st.cabShift[k]);
    items.push(
      { label: "Гасить (выключить) — ".concat(sel.length), fn: () => { for (const k of sel) applyBlack(k, true); changed(false); } },
      { label: "Вернуть (включить)", disabled: !anyBlack, fn: () => { for (const k of sel) applyBlack(k, false); changed(false); } }
    );
    if (anyShift || sel.some((k) => st.cabRot && st.cabRot[k])) items.push({ label: "Сбросить смещение и поворот", fn: () => { for (const k of sel) { if (st.cabShift) delete st.cabShift[k]; if (st.cabRot) delete st.cabRot[k]; } changed({ forcePhys: true }); } });
    items.push({ sep: true });
  }
  items.push(
    { label: "Выделить все кабинеты", fn: () => { ui.selected.clear(); for (let r = 0; r < st.cabRows; r++) for (let c = 0; c < st.cabCols; c++) ui.selected.add(key(c, r)); changed(false); } },
    { label: "Снять выделение", disabled: !ui.selected.size, fn: () => clearSelection() }
  );
  if (ui.shapeClip) items.push({ sep: true }, { label: "Вставить фигуру", fn: () => shapePaste(ui.shapeClip) });
  changed(false);
  showCtx(e.clientX, e.clientY, items);
}
// ---- ПКМ на дополнительном тексте
function ctxText(e, i) {
  const st = S();
  if (!st.extraLabels || !st.extraLabels[i]) return;
  ui.selLabel = i;
  ui.textMode = i + 1;
  if (ui.selMore) clearSelMore();
  if ($("activeText")) $("activeText").value = i + 1;
  changed(false);
  showCtx(e.clientX, e.clientY, [
    { label: "Изменить текст", fn: () => $("btnEditText").click() },
    { label: "Копировать", fn: () => { ui.lastClip = "text"; ui.textClip = { uid: st.uid, list: JSON.parse(JSON.stringify([st.extraLabels[i]])) }; status("Текст скопирован", true); } },
    { label: "Вставить", disabled: !ui.textClip, fn: () => pasteTexts(ui.textClip.list, ui.textClip.uid === st.uid) },
    { label: "Дублировать", fn: () => $("btnCopyText").click() },
    { sep: true },
    { label: "Удалить", danger: true, fn: () => $("btnDelText").click() }
  ]);
}
window.addEventListener("keydown", (e) => {
  if (ui.page !== "out" || !$("modal").hidden) return;
  const t = e.target;
  if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && t.type !== "checkbox" || t.isContentEditable)) return;
  const o = OC(), s = curSlice();
  if (e.key === "Escape") {
    ui_out.V = { z: 1, x: 0, y: 0 };
    requestDraw();
    return;
  }
  if (!o || !s) return;
  if (e.key === "Delete" || e.key === "Backspace") {
    e.preventDefault();
    outSelDelete(o);
    return;
  }
  // 2.0.196: стрелки двигают все выбранные слайсы (1 px, с Shift — 10 px) — на входе или на выходе, где работали мышью
  const d = e.shiftKey ? 10 : 1, mv = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }[e.key];
  if (!mv || e.ctrlKey || e.metaKey) return;
  e.preventDefault();
  const onIn = o.view === "in" || o.view === "both" && ui_out.focus === "in";
  for (const q of onIn ? outSelSlices(o) : outSelList(o)) {
    if (onIn) {
      q.ix += mv[0];
      q.iy += mv[1];
    } else {
      q.ox += mv[0];
      q.oy += mv[1];
    }
  }
  outChanged(false);
});
document.querySelectorAll(".seg.pages button").forEach((b) => b.onclick = () => setPage(b.dataset.page));
$("fAll").onclick = () => {
  project.screens.forEach((st) => {
    if (!CF().items.some((q) => q.uid === st.uid)) placeAtRight(st.uid);
  });
  FV.fitted = false;
  fieldChanged(true);
};
$("fRow").onclick = () => arrange(true);
$("fCol").onclick = () => arrange(false);
$("fClear").onclick = () => {
  CF().items = [];
  fld.sel = null;
  fieldChanged(true);
};
$("fMagnet").onchange = (e) => {
  ui.magnet = e.target.checked;
};
$("fTitle").onchange = (e) => {
  CF().title.on = e.target.checked;
  fieldChanged(false);
};
$("fMeters").onchange = (e) => {
  CF().title.meters = e.target.checked;
  fieldChanged(false);
};
$("fTitleSize").addEventListener("change", (e) => {
  CF().title.size = +e.target.value;
  fieldChanged(false);
});
function fieldTitleStep(delta) {
  const f = CF(), rs = fieldRects(f), b = fieldBBox(rs);
  if (!b) return;
  const cur = fieldTitleLines(f, rs, b, 1)[0][1], target = Math.min(900, Math.max(6, cur + delta));
  let best = 1, bd = Infinity;
  for (let i = 1; i < INSC.length; i++) {
    const d = Math.abs(pfloat(INSC[i]) - target);
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  f.title.size = best;
  $("fTitleSize").value = best;
  fieldChanged(false);
}
$("fTitleMinus").onclick = () => fieldTitleStep(-10);
$("fTitlePlus").onclick = () => fieldTitleStep(10);
$("fTitleCenter").onclick = () => {
  CF().title.x = 0;
  CF().title.y = 0;
  fieldChanged(false);
  status("Надпись поля — по центру");
};
$("fRotCCW").onclick = () => rotateSel(-45);
$("fRotCW").onclick = () => rotateSel(45);
$("fRot0").onclick = () => rotateSel(null);
