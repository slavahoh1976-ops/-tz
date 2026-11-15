// ---- изменения и панель
// 2.0.125: лента выходов (Screens) текущего мэппинга — как лента масок: миниатюры, «+» — новый выход, «copy» — копия со слайсами
let oStripT = 0;
function scheduleOutStrip() {
  clearTimeout(oStripT);
  oStripT = setTimeout(renderOutStrip, 200);
}
function renderOutStrip() {
  if (ui.page !== "out") return;
  const box = $("oStrip"), o = OC();
  box.innerHTML = "";
  if (!o) return;
  const srcOf = outSrcFactory(2048);
  o.screens.forEach((scr, k) => {
    const tile = document.createElement("button"), cap = document.createElement("span"), n = o.slices.filter((q) => q.scr === scr.id && q.on).length;
    tile.type = "button";
    tile.className = "mthumb";
    cap.className = "cap";
    cap.innerHTML = "<b>".concat(k + 1, ". ").concat(xmlEsc(scr.name), "</b> · ").concat(scr.w, "×").concat(scr.h, " · ").concat(n, " сл.");
    const sc = Math.min(200 / scr.w, 124 / scr.h) * Math.min(2, window.devicePixelRatio || 1), cv = document.createElement("canvas");
    cv.width = Math.max(1, Math.round(scr.w * sc));
    cv.height = Math.max(1, Math.round(scr.h * sc));
    tile.append(cv, cap);
    tile.title = "".concat(scr.name, " — ").concat(scr.w, "×").concat(scr.h, ", слайсов: ").concat(n);
    tile.setAttribute("aria-current", String(scr.id === o.scr && o.view !== "in"));
    tile.onclick = () => {
      o.scr = scr.id;
      if (o.view === "in") o.view = "out";
      ui_out.V = { z: 1, x: 0, y: 0 };
      outChanged(true);
    };
    box.appendChild(tile);
    // 2.0.144: рисуем ПОСЛЕ вставки в DOM — иначе старый WebKit (Safari 12) показывает чёрный кадр
    paintOutScreen(cv.getContext("2d"), o, scr, sc, srcOf, false);
  });
  const add = document.createElement("div"), b1 = document.createElement("button"), b2 = document.createElement("button");
  add.className = "mthumb add";
  b1.type = b2.type = "button";
  b1.className = "plus";
  b1.textContent = "+";
  b1.title = "Новый выход";
  b1.onclick = () => $("oScrAdd").click();
  b2.className = "copy";
  b2.textContent = "copy";
  b2.title = "Копия текущего выхода вместе с его слайсами";
  b2.onclick = copyOutScreen;
  add.append(b1, b2);
  box.appendChild(add);
}
const outThumbs = /* @__PURE__ */ new Map();
function outThumb(m, scr) {
  const srcOf = outSrcFactory(2048);
  const used = [...new Set(m.slices.filter((q) => q.scr === scr.id).map((q) => sliceSrc(m, q)))];
  const k = JSON.stringify(m) + "|" + used.map((key) => { const sc = srcOf(key); return key + ":" + (sc ? sc.key : ""); }).join(";"), c = outThumbs.get(m.id + scr.id);
  if (c && c.k === k) return c.cv;
  const s = Math.min(1, 1600 / Math.max(scr.w, scr.h)), cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(scr.w * s));
  cv.height = Math.max(1, Math.round(scr.h * s));
  paintOutScreen(cv.getContext("2d"), m, scr, s, srcOf, m.labels);
  outThumbs.set(m.id + scr.id, { k, cv });
  return cv;
}
function copyOutScreen() {
  const o = OC();
  if (!o) return;
  const s0 = outScr(o), s = { ...s0, id: newUid(), name: s0.name + " (копия)" };
  delete s.auto;
  o.screens.splice(o.screens.indexOf(s0) + 1, 0, s);
  for (const q of o.slices.filter((z) => z.scr === s0.id)) o.slices.push({ ...q, id: newUid(), name: q.name + " (копия)", scr: s.id });
  o.scr = s.id;
  if (o.view === "in") o.view = "out";
  outChanged(true);
  status("Копия выхода: " + s.name, true);
}
stripDrag($("oStrip"), (from, to) => {
  const o = OC();
  if (!o) return;
  moveIn(o.screens, from, to);
  outChanged(true);
  status("Порядок выходов изменён", true);
});
function outChanged(panel) {
  scheduleOutStrip();
  scheduleOutIssues();
  scheduleAutosave();
  scheduleHistory();
  if (panel) refreshOutPanel();
  else syncOutSel();
  requestDraw();
}
const curSlice = () => {
  const o = OC();
  return o ? o.slices.find((s) => s.id === ui_out.sel) || null : null;
};
function refreshOutPanel() {
  if (ui.page !== "out") return;
  scheduleOutStrip();
  const has = project.outs.length > 0;
  $("oBody").hidden = !has;
  $("oExp").hidden = !has;
  $("oEmpty").hidden = has;
  fillSelect($("oSel"), project.outs.map((o2, i) => "".concat(i + 1, ". ").concat(o2.name)));
  if (!has) return;
  $("oSel").value = project.outCur;
  const o = OC(), srcs = outSources();
  if (!srcs.some((s) => s.k === o.src)) o.src = srcs[0] ? srcs[0].k : "";
  $("oSrc").replaceChildren(...srcs.map((s) => {
    const op = document.createElement("option");
    op.value = s.k;
    op.textContent = "".concat(s.name, " — ").concat(s.w, "×").concat(s.h);
    return op;
  }));
  $("oSrc").value = o.src;
  document.querySelectorAll("#oView button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === o.view)));
  // выходы
  const sl = $("oScrList");
  sl.replaceChildren();
  o.screens.forEach((s, i) => {
    const r = document.createElement("div"), n = o.slices.filter((q) => q.scr === s.id).length;
    r.className = "fitem" + (s.id === o.scr ? " sel" : "");
    r.innerHTML = '<span class="nm"></span><span class="sz"></span>';
    r.querySelector(".nm").textContent = "".concat(i + 1, ". ").concat(s.name);
    r.querySelector(".sz").textContent = "".concat(s.w, "×").concat(s.h, " · слайсов: ").concat(n);
    r.onclick = () => {
      o.scr = s.id;
      if (o.view === "in") o.view = "out";
      outChanged(true);
    };
    sl.appendChild(r);
  });
  const S1 = outScr(o);
  $("oScrW").value = S1.w;
  $("oScrH").value = S1.h;
  renderSliceList(o);
  syncOutIssues();
  $("oLabels").checked = o.labels;
  fillSelect($("oSlScr"), o.screens.map((s) => s.name));
  fillSelect($("oSlSrc"), outSources().map((s) => s.name));
  syncOutSel();
  updateOutInfo();
}
// ---- 2.0.195: список готовых слайсов — отдельная рамка, группы по выходам, поиск; рассчитан на тысячи слайсов:
// строки рисуются только у развёрнутых выходов и не больше SL_PAGE за раз («Показать ещё»)
const SL_PAGE = 200;
let slSelIds = /* @__PURE__ */ new Set();
const slUi = { open: new Map(), more: new Map(), find: "", lastSel: "", outKey: null };
function sliceRow(o, s, srcName) {
  // как в Resolume: в строке галочка и имя; у выбранного слайса справа «X» — удалить
  const r = document.createElement("div"), cb = document.createElement("input");
  const isSel = s.id === ui_out.sel, isMore = !isSel && slSelIds.has(s.id);
  r.className = "slrow" + (isSel ? " sel" : "") + (isMore ? " msel" : "") + (s.on === false ? " off" : "");
  r.draggable = true;
  r.ondragstart = (e) => slDragStart(e, o, s);
  r.ondragover = (e) => slDragOver(e, r, "row");
  r.ondragleave = () => r.classList.remove("drop-above", "drop-below");
  r.ondrop = (e) => slDrop(e, o, s, null, r);
  r.dataset.id = s.id;
  cb.type = "checkbox";
  cb.checked = s.on !== false;
  cb.title = "Слайс включён";
  cb.onclick = (e) => e.stopPropagation();
  cb.onchange = () => {
    s.on = cb.checked;
    r.classList.toggle("off", !s.on);
    outChanged(false);
  };
  const nm = document.createElement("span");
  nm.className = "nm";
  nm.textContent = s.name;
  r.title = s.name + (srcName ? "\n" + srcName : "") + "\nУчасток " + s.iw + "×" + s.ih;
  r.append(cb, nm);
  if (isSel && slSelIds.size < 2) {
    const x = document.createElement("button");
    x.className = "slx";
    x.textContent = "X";
    x.title = "Удалить слайс";
    x.onclick = (e) => {
      e.stopPropagation();
      $("oSlDel").click();
    };
    r.appendChild(x);
  }
  r.onclick = (e) => {
    // Ctrl / Cmd — добавить или убрать; Shift — все строки между выбранной и этой (как в Resolume)
    if ((e.ctrlKey || e.metaKey) && ui_out.sel) {
      const ids = outSelIds(o);
      if (ids.has(s.id)) {
        if (ids.size > 1) {
          ids.delete(s.id);
          for (const q of o.slices) if (s.grp && q.grp === s.grp) ids.delete(q.id);
          outSelSet(o, ids, ui_out.sel === s.id ? null : ui_out.sel);
        }
      } else outSelSet(o, [...ids, s.id], ui_out.sel);
    } else if (e.shiftKey && ui_out.sel) {
      const rows = [...$("oSliceList").querySelectorAll(".slrow")].map((x) => x.dataset.id), a = rows.indexOf(ui_out.sel), b = rows.indexOf(s.id);
      if (a >= 0 && b >= 0) outSelSet(o, rows.slice(Math.min(a, b), Math.max(a, b) + 1), ui_out.sel);
    } else {
      ui_out.sel = s.id;
      ui_out.more = new Set();
      o.src = sliceSrc(o, s);
    }
    if (o.view !== "in") o.scr = s.scr;
    refreshOutPanel();
    requestDraw();
  };
  r.oncontextmenu = (e) => {
    e.preventDefault();
    if (outSelIds(o).has(s.id)) return ctxSlices(e, o);
    ui_out.sel = s.id;
    ui_out.more = new Set();
    o.src = sliceSrc(o, s);
    o.scr = s.scr;
    refreshOutPanel();
    requestDraw();
    showCtx(e.clientX, e.clientY, [
      { label: "Копировать", fn: () => { ui.clipSlice = JSON.parse(JSON.stringify(s)); status("Слайс скопирован", true); } },
      { label: "Вставить", disabled: !ui.clipSlice, fn: () => ctxPasteSlice(o) },
      { label: "Дублировать", fn: () => $("oSlDup").click() },
      { label: s.on ? "Выключить" : "Включить", fn: () => { s.on = !s.on; outChanged(false); } },
      { label: "Отправить на выход", sub: outSendMenu(o, [s]) },
      { label: "Разбить по кабинетам", fn: () => outSplit(o) },
      { label: "Переименовать по шаблону…", fn: () => outRenameTpl(o) },
      { sep: true },
      { label: "Удалить", danger: true, fn: () => $("oSlDel").click() }
    ]);
  };
  return r;
}
function renderSliceList(o) {
  const ll = $("oSliceList"), keep = ll.scrollTop;
  ll.replaceChildren();
  // другой мэппинг — своё состояние групп
  if (slUi.outKey !== o) {
    slUi.outKey = o;
    slUi.open.clear();
    slUi.more.clear();
    slUi.lastSel = "";
  }
  slSelIds = outSelIds(o);
  syncSlMulti(o);
  const total = o.slices.length, q = slUi.find.trim().toLowerCase();
  $("oSlCount").textContent = total ? String(total) : "";
  $("oSlFind").hidden = total < 8 && !q;
  if (!total) {
    const p0 = document.createElement("p");
    p0.className = "hint";
    p0.textContent = "Слайсов нет. Нажмите «+ Слайс» или протяните мышью по маске в Input Selection.";
    ll.appendChild(p0);
    return;
  }
  const srcNames = new Map(outSources().map((x) => [x.k, x.name])), by = new Map(o.screens.map((sc) => [sc.id, []]));
  // порядок как в окне Resolume: последний слайс — сверху
  for (let i = o.slices.length - 1; i >= 0; i--) {
    const s = o.slices[i];
    if (q && !String(s.name).toLowerCase().includes(q)) continue;
    if (!by.has(s.scr)) by.set(s.scr, []);
    by.get(s.scr).push(s);
  }
  const sel = curSlice(), many = total > 60;
  // выбранный слайс поменялся — его выход раскрываем
  if (sel && sel.id !== slUi.lastSel) slUi.open.set(sel.scr, true);
  for (const [sid, arr] of by) {
    const sc = o.screens.find((x) => x.id === sid);
    if (q && !arr.length) continue;
    const isOpen = q ? true : slUi.open.has(sid) ? slUi.open.get(sid) : !many;
    const g = document.createElement("div"), top = document.createElement("div"), sub = document.createElement("div");
    const cb = document.createElement("input"), t = document.createElement("span");
    g.className = "slgrp" + (isOpen ? " open" : "") + (sc && sc.id === o.scr ? " cur" : "");
    cb.type = "checkbox";
    const on = arr.filter((s) => s.on !== false).length;
    cb.checked = arr.length > 0 && on === arr.length;
    cb.indeterminate = on > 0 && on < arr.length;
    cb.title = "Включить / выключить все слайсы выхода";
    cb.disabled = !arr.length;
    cb.onclick = (e) => e.stopPropagation();
    cb.onchange = () => {
      for (const s of arr) s.on = cb.checked;
      outChanged(true);
    };
    t.className = "nm";
    t.textContent = sc ? sc.name : "Без выхода";
    top.className = "sltop";
    top.title = "Сделать выход текущим";
    top.append(cb, t);
    top.onclick = () => {
      if (!sc) return;
      o.scr = sc.id;
      if (o.view === "in") o.view = "out";
      outChanged(true);
    };
    sub.className = "slsub";
    sub.textContent = (isOpen ? "▾ " : "▸ ") + (sc ? sc.w + "×" + sc.h : "") + " · " + (q ? "найдено " + arr.length : arr.length + " сл.");
    sub.title = isOpen ? "Свернуть" : "Развернуть";
    sub.onclick = () => {
      slUi.open.set(sid, !isOpen);
      renderSliceList(o);
    };
    g.append(top, sub);
    g.ondragover = (e) => slDragOver(e, g, "grp");
    g.ondragleave = () => g.classList.remove("drop-in");
    g.ondrop = (e) => slDrop(e, o, null, sid, g);
    ll.appendChild(g);
    if (!isOpen) continue;
    const lim = slUi.more.get(sid) || SL_PAGE;
    const part = arr.slice(0, lim);
    // выбранный слайс за пределами показанных — показываем до него
    if (sel && sel.scr === sid && !part.includes(sel) && arr.includes(sel)) part.push(...arr.slice(lim, arr.indexOf(sel) + 1));
    const box = document.createDocumentFragment();
    for (const s of part) box.appendChild(sliceRow(o, s, srcNames.get(sliceSrc(o, s))));
    ll.appendChild(box);
    if (part.length < arr.length) {
      const m = document.createElement("button");
      m.className = "b slmore";
      m.textContent = "Показать ещё " + Math.min(SL_PAGE, arr.length - part.length) + " из " + (arr.length - part.length);
      m.onclick = () => {
        slUi.more.set(sid, part.length + SL_PAGE);
        renderSliceList(o);
      };
      ll.appendChild(m);
    }
  }
  if (q && !ll.querySelector(".slrow")) {
    const p0 = document.createElement("p");
    p0.className = "hint";
    p0.textContent = "Ничего не найдено";
    ll.appendChild(p0);
  }
  ll.scrollTop = keep;
  // к выбранному слайсу прокручиваем только когда выбор поменялся (а не на каждое обновление)
  if (sel && sel.id !== slUi.lastSel) {
    const el = ll.querySelector('.slrow[data-id="' + sel.id + '"]');
    if (el) {
      const top = el.offsetTop - ll.offsetTop, h = ll.clientHeight;
      if (top < ll.scrollTop || top + el.offsetHeight > ll.scrollTop + h) ll.scrollTop = Math.max(0, top - h / 3);
    }
  }
  slUi.lastSel = sel ? sel.id : "";
}
$("oSlFind").addEventListener("input", () => {
  slUi.find = $("oSlFind").value;
  const o = OC();
  if (o) renderSliceList(o);
});
$("oSlOpenAll").onclick = () => {
  const o = OC();
  if (!o) return;
  for (const sc of o.screens) slUi.open.set(sc.id, true);
  renderSliceList(o);
};
$("oSlCloseAll").onclick = () => {
  const o = OC();
  if (!o) return;
  for (const sc of o.screens) slUi.open.set(sc.id, false);
  renderSliceList(o);
};
function syncOutSel() {
  const o = OC(), s = curSlice();
  $("oSlBox").hidden = !s;
  if (!s) return updateOutInfo();
  if (document.activeElement !== $("oSlName")) $("oSlName").value = s.name;
  const srcs = outSources(), si = Math.max(0, srcs.findIndex((q) => q.k === sliceSrc(o, s)));
  $("oSlSrc").value = String(si);
  $("oSlScr").value = String(Math.max(0, o.screens.findIndex((q) => q.id === s.scr)));
  for (const k of ["ix", "iy", "iw", "ih", "ox", "oy"]) if (document.activeElement !== $("oSl_" + k)) $("oSl_" + k).value = s[k];
  const [sw, sh] = sliceOutWH(s);
  if (document.activeElement !== $("oSl_ow")) $("oSl_ow").value = sw;
  if (document.activeElement !== $("oSl_oh")) $("oSl_oh").value = sh;
  $("oSl11").disabled = !sliceScaled(s);
  document.querySelectorAll("#oSlKeep button").forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.k === "1") === (s.keep !== false))));
  document.querySelectorAll("#oSlRot button").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.r === s.rot)));
  if (document.activeElement !== $("oSlRA")) $("oSlRA").value = +(+s.ra || 0).toFixed(2);
  $("oSlFH").setAttribute("aria-pressed", String(s.fh));
  $("oSlFV").setAttribute("aria-pressed", String(s.fv));
  updateOutInfo();
}
function updateOutInfo() {
  const o = OC();
  if (!o) return;
  const S0 = outSrc(o), out = [];
  if (!S0) out.push("<span>Выберите источник: общее поле, нарезку или маску.</span>");
  else {
    out.push("<span>Источник: ".concat(escHtml(S0.name), " · ").concat(S0.w, "×").concat(S0.h, " px</span>"));
    out.push("<span>Слайсов: ".concat(o.slices.length, " · выходов: ").concat(o.screens.length, "</span>"));
    for (const s of o.screens) {
      const list = o.slices.filter((q) => q.on && q.scr === s.id);
      let bad = 0;
      for (const q of list) {
        const [w, h] = sliceOutWH(q);
        if (q.ox < 0 || q.oy < 0 || q.ox + w > s.w || q.oy + h > s.h) bad++;
      }
      let over = 0;
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j], [aw, ah] = sliceOutWH(a), [bw, bh] = sliceOutWH(b);
        if (a.ox < b.ox + bw && b.ox < a.ox + aw && a.oy < b.oy + bh && b.oy < a.oy + ah) over++;
      }
      if (bad) out.push('<span class="warn">'.concat(escHtml(s.name), ": слайсов за краем выхода — ").concat(bad, "</span>"));
      if (over) out.push('<span class="warn">'.concat(escHtml(s.name), ": слайсы накладываются — ").concat(over, "</span>"));
    }
  }
  setHtml($("oInfo"), out.join(""));
  if (o) syncOutComp(o), syncOutLayers(o);
  if (o) {
    const M = outMag(o);
    for (const [id, k] of [["oMagOn", "on"], ["oMagCab", "cab"], ["oMagInSl", "inSl"], ["oMagEdge", "edge"], ["oMagOutSl", "outSl"], ["oMagCenter", "center"], ["oMagGrid", "grid"]]) $(id).checked = M[k];
    if (document.activeElement !== $("oMagStep")) $("oMagStep").value = M.step;
    $("oMagStep").disabled = !M.grid;
    $("oMagThr").value = String(M.thr);
    $("oMagBox").classList.toggle("dim", !M.on);
    for (const el of $("oMagBox").querySelectorAll("input,select")) if (el.id !== "oMagStep") el.disabled = !M.on;
  }
  // проверка — с задержкой: при перетаскивании слайса не считается на каждое движение
  scheduleOutIssues();
  const smi = $("oSmartInfo");
  if (smi) {
    const t = o && o.smartInfo && o.slices.length ? o.smartInfo : "";
    smi.hidden = !t;
    setTxt(smi, t);
  }
}
// ---- кнопки панели
function addOut() {
  const o = freshOut(project.outs.length), srcs = outSources();
  const pref = srcs.find((s) => s.k[0] === "f") || srcs.find((s) => s.k[0] === "c") || srcs[0];
  o.src = pref ? pref.k : "";
  project.outs.push(o);
  project.outCur = project.outs.length - 1;
  ui_out.sel = "";
  ui_out.V = { z: 1, x: 0, y: 0 };
  outChanged(true);
}
$("oAdd").onclick = addOut;
$("oAdd2").onclick = addOut;
$("oDel").onclick = async () => {
  const o = OC();
  if (!o || !await ask("Удалить мэппинг?", "«".concat(o.name, "» будет удалён. Маски останутся в проекте."), "", "Удалить", false)) return;
  project.outs.splice(project.outCur, 1);
  project.outCur = Math.max(0, Math.min(project.outCur, project.outs.length - 1));
  outChanged(true);
};
$("oSel").onchange = (e) => {
  project.outCur = +e.target.value;
  ui_out.sel = "";
  ui_out.V = { z: 1, x: 0, y: 0 };
  refreshOutPanel();
  requestDraw();
};
$("oRename").onclick = async () => {
  const o = OC();
  const v = o && await ask("Название", "", o.name, "OK");
  if (v != null && v.trim()) {
    o.name = v.trim().slice(0, 60);
    outChanged(true);
  }
};
$("oSrc").onchange = (e) => {
  const o = OC();
  // активный источник: что показываем в Input и откуда берут новые слайсы. Существующие слайсы хранят свой источник
  o.src = e.target.value;
  ui_out.V = { z: 1, x: 0, y: 0 };
  outChanged(true);
};
document.querySelectorAll("#oView button").forEach((b) => b.onclick = () => {
  OC().view = b.dataset.v;
  ui_out.V = { z: 1, x: 0, y: 0 };
  outChanged(true);
});
// 2.0.123: «+ Слайс» — как Add Slice в Resolume: кабинеты от левого верхнего угла источника, сколько влезает в выход
function outAddSlice(o, r) {
  const S0 = outSrc(o);
  if (!S0) return status("Сначала выберите источник", true);
  const scr = outScr(o);
  if (!r) {
    // следующий свободный участок источника: правее последнего слайса (или с начала)
    const last = o.slices[o.slices.length - 1];
    let x0 = last ? last.ix + last.iw : 0, y0 = last ? last.iy : 0;
    if (x0 >= S0.w - 1) {
      x0 = 0;
      y0 = last ? last.iy + last.ih : 0;
    }
    if (y0 >= S0.h - 1) y0 = 0;
    r = snapToCells(o, x0, y0, Math.min(S0.w, x0 + scr.w), Math.min(S0.h, y0 + scr.h)) || snapToCells(o, 0, 0, S0.w, S0.h) || { x: 0, y: 0, w: S0.w, h: S0.h };
  }
  const s = { id: newUid(), name: "Slice ".concat(o.slices.length + 1), scr: scr.id, src: o.src, ix: r.x, iy: r.y, iw: r.w, ih: r.h, ox: 0, oy: 0, ow: 0, oh: 0, keep: true, rot: 0, fh: false, fv: false, on: true };
  // на выходе — правее последнего слайса этого выхода, иначе ниже
  const mine = o.slices.filter((q) => q.scr === scr.id);
  let x2 = 0, y2 = 0;
  if (mine.length) {
    const lq = mine[mine.length - 1], [lw] = sliceOutWH(lq);
    x2 = lq.ox + lw;
    y2 = lq.oy;
    if (x2 + s.iw > scr.w) {
      x2 = 0;
      y2 = Math.max(0, ...mine.map((q) => q.oy + sliceOutWH(q)[1]));
    }
  }
  s.ox = x2;
  s.oy = y2;
  if (mine.length && y2 + s.ih > scr.h) {
    // на этом выходе места нет — следующий выход (пустой), при необходимости новый
    let nx = o.screens.slice(o.screens.indexOf(scr) + 1).find((q) => !o.slices.some((z) => z.scr === q.id));
    if (!nx) {
      nx = { id: newUid(), name: "Output ".concat(o.screens.length + 1), w: scr.w, h: scr.h, auto: true };
      o.screens.push(nx);
    }
    s.scr = nx.id;
    s.ox = s.oy = 0;
  }
  o.slices.push(s);
  ui_out.sel = s.id;
  outChanged(true);
  status("Добавлен ".concat(s.name, ": ").concat(s.iw, "×").concat(s.ih, " — тяните за углы или двигайте"), true);
}
$("oAddSlice").onclick = () => outAddSlice(OC());
// 2.0.136: кнопки «Весь источник / По маскам / По рядам / По столбцам» убраны по просьбе (outAutoSlices остаётся)
$("oPack").onclick = () => {
  // 2.0.197: выбрано несколько — раскладываются только они, остальные на месте
  const o = OC(), sel = outSelList(o);
  if (sel.length > 1) outPackSel(o, sel);
  else outPack(o);
  outChanged(true);
};
$("oGroup").onclick = () => {
  const o = OC(), cur = curSlice();
  if (!o || !cur) return;
  const ids = /* @__PURE__ */ new Set([cur.id, ...(ui_out.more || [])]);
  const list = o.slices.filter((q) => ids.has(q.id));
  if (list.length < 2) return status("Выберите ещё слайсы: Cmd/Ctrl + клик по слайсу в Input (Shift — диапазон)", true);
  const gid = newUid();
  for (const q of list) q.grp = gid;
  ui_out.more = /* @__PURE__ */ new Set();
  outChanged(true);
  status("Слайсов в группе: " + list.length, true);
};
$("oUngroup").onclick = () => {
  const o = OC(), cur = curSlice();
  if (!o || !cur || !cur.grp) return status("Этот слайс не в группе", true);
  const g = cur.grp, n = o.slices.filter((q) => q.grp === g).length;
  for (const q of o.slices) if (q.grp === g) q.grp = "";
  outChanged(true);
  status("Группа снята, слайсов: " + n, true);
};
for (const [id, k] of [["oMagOn", "magOn"], ["oMagCab", "magCab"], ["oMagInSl", "magInSl"], ["oMagEdge", "magEdge"], ["oMagOutSl", "magOutSl"], ["oMagCenter", "magCenter"], ["oMagGrid", "magGrid"]]) $(id).onchange = () => {
  const o = OC();
  if (!o) return;
  o[k] = $(id).checked;
  outChanged(true);
};
$("oMagStep").oninput = () => {
  const o = OC(), v = Math.round(+String($("oMagStep").value).replace(",", "."));
  if (!o || !(v >= 1)) return;
  o.magStep = Math.min(4096, v);
  outChanged(false);
};
$("oMagThr").onchange = () => {
  const o = OC();
  if (!o) return;
  o.magThr = +$("oMagThr").value;
  outChanged(true);
};
$("oMapSmart").onclick = () => {
  outSmartMap(OC());
  outChanged(true);
};
for (const [id, mode] of [["oMapCab", "cab"], ["oMapRows", "rows"], ["oMapCols", "cols"], ["oMapGroup", "group"], ["oMapScreen", "screen"]]) $(id).onclick = () => {
  outAutoMap(OC(), mode);
  outChanged(true);
};
$("oScrAdd").onclick = () => {
  const o = OC(), s0 = outScr(o), s = { id: newUid(), name: "Output ".concat(o.screens.length + 1), w: s0.w, h: s0.h };
  o.screens.push(s);
  o.scr = s.id;
  outChanged(true);
};
$("oScrDel").onclick = () => {
  const o = OC();
  if (o.screens.length < 2) return status("Должен остаться хотя бы один выход", true);
  const s = outScr(o), i = o.screens.indexOf(s);
  o.screens.splice(i, 1);
  const to = o.screens[Math.max(0, i - 1)];
  for (const q of o.slices) if (q.scr === s.id) q.scr = to.id;
  o.scr = to.id;
  outChanged(true);
};
$("oScrRename").onclick = async () => {
  const s = outScr(OC()), v = await ask("Название выхода", "", s.name, "OK");
  if (v != null && v.trim()) {
    s.name = v.trim().slice(0, 60);
    outChanged(true);
  }
};
for (const [id, k] of [["oScrW", "w"], ["oScrH", "h"]]) {
  $(id).onchange = (e) => {
    outScr(OC())[k] = evenPx(Math.max(16, Math.min(16384, calcNum(e.target.value, outScr(OC())[k]))));
    e.target.value = outScr(OC())[k];
    outChanged(true);
  };
}
for (const el of document.querySelectorAll('#oSlBox input.calc, #oScrW, #oScrH')) el.addEventListener("keydown", (e) => {
  if (e.key === "Enter") el.dispatchEvent(new Event("change"));
});
// 2.0.184: композиция мэппинга
for (const b of document.querySelectorAll("#oCompMode button")) b.onclick = () => {
  const o = OC(), S0 = o && outSrc(o);
  if (!o) return;
  o.compMode = b.dataset.m;
  if (o.compMode === "custom" && S0 && !(+o.compW > 0)) {
    o.compW = S0.w;
    o.compH = S0.h;
  }
  outChanged(true);
};
for (const b of document.querySelectorAll("#oCompFit button")) b.onclick = () => {
  const o = OC();
  if (!o) return;
  o.compFit = b.dataset.f;
  outChanged(true);
};
for (const [id, k] of [["oCompW", "compW"], ["oCompH", "compH"]]) {
  $(id).onchange = (e) => {
    const o = OC(), CM = o && outComp(o);
    if (!CM || !CM.custom) return;
    o.compMode = "custom";
    o[k] = Math.max(16, Math.min(16384, Math.round(calcNum(e.target.value, k === "compW" ? CM.W : CM.H))));
    if (!(+o[k === "compW" ? "compH" : "compW"] > 0)) o[k === "compW" ? "compH" : "compW"] = k === "compW" ? CM.H : CM.W;
    outChanged(true);
  };
  $(id).addEventListener("keydown", (e) => {
    if (e.key === "Enter") $(id).dispatchEvent(new Event("change"));
  });
}
$("oCompPreset").onchange = (e) => {
  const v = e.target.value, o = OC();
  e.target.value = "";
  if (!v || !o) return;
  const [w, h] = v.split("x").map(Number);
  Object.assign(o, { compMode: "custom", compW: w, compH: h });
  outChanged(true);
};
// 2.0.185: список масок с галочками (слои Resolume)
function syncOutLayers(o) {
  const box = $("oLayerList");
  if (!box || !o) return;
  // 2.0.191: сверху вниз по слоям — Слой 1 первым (так же идёт разметка); ниже — неотмеченные по порядку проекта
  const keys = outLayerKeys(o), all = outLayerList(), list = keys.map((k) => all.find((s) => s.k === k)).concat(all.filter((s) => !keys.includes(s.k)));
  const sig = JSON.stringify([list.map((s) => [s.k, s.name, s.w, s.h]), keys, o.src]);
  if (box._sig !== sig) {
    box._sig = sig;
    box.replaceChildren();
    list.forEach((s, li) => {
      if (li === keys.length && keys.length) {
        const sep = document.createElement("div");
        sep.className = "layer-sep";
        sep.textContent = "Не в мэппинге";
        box.appendChild(sep);
      }
      const row = document.createElement("div"), cb = document.createElement("input"), nm = document.createElement("button"), tag = document.createElement("span");
      row.className = "frow layer-row" + (s.k === o.src ? " cur" : "");
      cb.type = "checkbox";
      cb.checked = keys.includes(s.k);
      cb.setAttribute("aria-label", "Маска для мэппинга: " + s.name);
      cb.onchange = () => {
        // отмеченная маска встаёт последним слоем; снятая — уходит из слоёв
        const ks = outLayerKeys(o).filter((k) => k !== s.k);
        if (cb.checked) ks.push(s.k);
        o.layers = ks.join(",");
        if (cb.checked && !ks.includes(o.src)) o.src = s.k;
        outChanged(true);
      };
      nm.type = "button";
      nm.className = "linkbtn layer-name";
      nm.textContent = s.name.replace(/^Маска: /, "") + " · " + s.w + "×" + s.h;
      nm.title = "Показать во входе";
      nm.onclick = () => {
        o.src = s.k;
        outChanged(true);
      };
      const n = keys.indexOf(s.k) + 1;
      row.append(cb, nm);
      if (n) {
        // выбор слоя: маска встаёт на выбранный слой, остальные сдвигаются
        const sel = document.createElement("select");
        sel.className = "layer-sel";
        sel.setAttribute("aria-label", "Слой Resolume для маски " + s.name);
        sel.title = "Поставить маску на слой";
        for (let i = 1; i <= keys.length; i++) {
          const op = document.createElement("option");
          op.value = String(i);
          op.textContent = "Слой " + i;
          sel.appendChild(op);
        }
        sel.value = String(n);
        sel.onchange = () => outLayerSet(o, s.k, +sel.value);
        row.appendChild(sel);
      } else {
        tag.className = "unit layer-tag";
        tag.textContent = "—";
        row.appendChild(tag);
      }
      box.appendChild(row);
    });
    // порядок разметки одной строкой
    if (keys.length) {
      const ord = document.createElement("p");
      ord.className = "hint layer-order";
      ord.textContent = "Разметка: " + keys.map((k) => (all.find((q) => q.k === k) || { name: k }).name.replace(/^Маска: /, "").replace(/^\d+\. /, "")).join(" → ");
      box.appendChild(ord);
    }
  }
  for (const b of document.querySelectorAll("#oResRoute button")) b.setAttribute("aria-pressed", String(b.dataset.r === outRoute(o)));
}
$("oLayerAll").onclick = () => {
  const o = OC();
  if (!o) return;
  // к уже отмеченным (в их порядке) добавляются остальные маски по порядку проекта
  const had = outLayerKeys(o);
  o.layers = had.concat(outLayerList().filter((s) => s.k[0] === "m" && !had.includes(s.k)).map((s) => s.k)).join(",");
  const ks = outLayerKeys(o);
  if (ks.length && !ks.includes(o.src)) o.src = ks[0];
  outChanged(true);
};
$("oLayerNone").onclick = () => {
  const o = OC();
  if (!o) return;
  o.layers = "";
  outChanged(true);
};
for (const b of document.querySelectorAll("#oResRoute button")) b.onclick = () => {
  const o = OC();
  if (!o) return;
  o.resRoute = b.dataset.r;
  outChanged(true);
};
function syncOutComp(o) {
  const CM = o && outComp(o);
  for (const b of document.querySelectorAll("#oCompMode button")) b.setAttribute("aria-pressed", String(b.dataset.m === (CM ? CM.mode : "auto")));
  for (const b of document.querySelectorAll("#oCompFit button")) b.setAttribute("aria-pressed", String(b.dataset.f === (CM ? CM.fit : "native")));
  // 2.0.192: ширина × высота видны всегда; менять можно только в режиме «Свой»
  const editable = !!(CM && CM.custom);
  $("oCompWHRow").hidden = !CM;
  for (const id of ["oCompW", "oCompH"]) {
    const el = $(id);
    el.readOnly = !editable;
    el.classList.toggle("ro", !editable);
    el.title = editable ? "Можно формулой: 192*20, 3840/2" : CM && CM.mode === "auto" ? "Считается сам: наибольшие ширина и высота отмеченных масок. Чтобы вписать свой размер — выберите «Свой»" : "Как у активной маски. Чтобы вписать свой размер — выберите «Свой»";
  }
  $("oCompPresetRow").hidden = !editable;
  for (const bt of document.querySelectorAll("#oCompWHRow .stp button")) bt.disabled = !editable;
  if (CM) {
    if (document.activeElement !== $("oCompW") || !editable) $("oCompW").value = CM.W;
    if (document.activeElement !== $("oCompH") || !editable) $("oCompH").value = CM.H;
  }
  const r1 = (v) => Math.round(v * 100) / 100;
  setTxt($("oCompInfo"), CM ? "Композиция ".concat(CM.W, "×").concat(CM.H).concat(CM.mode === "auto" ? " (авто: наибольшие ширина и высота отмеченных масок)" : "", " · маска ").concat(CM.mw, "×").concat(CM.mh).concat(CM.sx !== 1 || CM.sy !== 1 ? " → " + r1(CM.mw * CM.sx) + "×" + r1(CM.mh * CM.sy) + (CM.sx === CM.sy ? " (×" + r1(CM.sx) + ")" : "") : "", " в точке ").concat(r1(CM.x), ", ").concat(r1(CM.y), ". В Resolume поставьте такой же размер композиции.") : "");
}
$("oScrPreset").onchange = (e) => {
  const v = e.target.value;
  e.target.value = "";
  if (!v) return;
  const [w, h] = v.split("x").map(Number), s = outScr(OC());
  s.w = w;
  s.h = h;
  outChanged(true);
};
$("oLabels").onchange = (e) => {
  OC().labels = e.target.checked;
  outChanged(false);
};
$("oSlName").oninput = (e) => {
  const s = curSlice();
  if (s) {
    s.name = e.target.value.slice(0, 60) || s.name;
    scheduleAutosave();
    requestDraw();
  }
};
$("oSlName").onchange = () => outChanged(true);
$("oSlScr").onchange = (e) => {
  // 2.0.196: переносятся все выбранные слайсы
  const o = OC(), s = curSlice();
  if (!s || !o.screens[+e.target.value]) return;
  outSelMoveTo(o, o.screens[+e.target.value].id);
};
// 2.0.154: сменить источник (маску) слайса — с какой маски он берёт участок
$("oSlSrc").onchange = (e) => {
  const o = OC(), s = curSlice(), srcs = outSources(), ns = srcs[+e.target.value];
  if (!s || !ns) return;
  s.src = ns.k;
  // координаты участка подрезаем под размеры новой маски
  s.ix = Math.max(0, Math.min(ns.w - 1, s.ix | 0));
  s.iy = Math.max(0, Math.min(ns.h - 1, s.iy | 0));
  s.iw = Math.max(1, Math.min(ns.w - s.ix, s.iw | 0));
  s.ih = Math.max(1, Math.min(ns.h - s.iy, s.ih | 0));
  // чтобы слайс был виден и редактировался на входе — переключаем активный источник на его маску
  o.src = ns.k;
  $("oSrc").value = ns.k;
  outChanged(true);
};
// 2.0.137: числа в «Мэппинге» можно вводить формулой, как в Resolume: 192*6, 3840/2, (192+8)*4 — без eval
function calcNum(str, fb) {
  const t = String(str == null ? "" : str).replace(/,/g, ".").replace(/[×хx]/gi, "*").replace(/:/g, "/").replace(/\s+/g, "");
  if (!t) return fb;
  let i = 0;
  const num = () => {
    const m = /^\d*\.?\d+/.exec(t.slice(i));
    if (!m) throw 0;
    i += m[0].length;
    return +m[0];
  };
  const atom = () => {
    if (t[i] === "-") return i++, -atom();
    if (t[i] === "+") return i++, atom();
    if (t[i] === "(") {
      i++;
      const v = sum();
      if (t[i++] !== ")") throw 0;
      return v;
    }
    return num();
  };
  const prod = () => {
    let v = atom();
    while (t[i] === "*" || t[i] === "/") v = t[i++] === "*" ? v * atom() : v / atom();
    return v;
  };
  const sum = () => {
    let v = prod();
    while (t[i] === "+" || t[i] === "-") v = t[i++] === "+" ? v + prod() : v - prod();
    return v;
  };
  try {
    const v = sum();
    return i === t.length && isFinite(v) ? Math.round(v) : fb;
  } catch (e) {
    return fb;
  }
}
for (const k of ["ix", "iy", "iw", "ih", "ox", "oy"]) $("oSl_" + k).onchange = (e) => {
  const s = curSlice();
  if (!s) return;
  s[k] = k === "iw" || k === "ih" ? Math.max(1, calcNum(e.target.value, s[k])) : calcNum(e.target.value, s[k]);
  e.target.value = s[k];
  outChanged(true);
};
// 2.0.134: размер на выходе; пропорции — по галочке (по умолчанию сохраняются)
for (const k of ["ow", "oh"]) $("oSl_" + k).onchange = (e) => {
  const s = curSlice();
  if (!s) return;
  const [w, h] = sliceOutWH(s), v = Math.max(1, Math.min(65536, calcNum(e.target.value, k === "ow" ? w : h)));
  if (s.keep !== false) {
    if (k === "ow") {
      s.ow = v;
      s.oh = Math.max(1, Math.round(v * h / w));
    } else {
      s.oh = v;
      s.ow = Math.max(1, Math.round(v * w / h));
    }
  } else {
    s.ow = k === "ow" ? v : w;
    s.oh = k === "oh" ? v : h;
  }
  // 2.0.138: после Enter курсор остаётся в поле — сразу показываем посчитанное значение вместо формулы
  const [nw, nh] = sliceOutWH(s);
  $("oSl_ow").value = nw;
  $("oSl_oh").value = nh;
  outChanged(true);
};
// 2.0.139: пропорции «Выход W × H» — у каждого слайса свои (по умолчанию сохраняются)
document.querySelectorAll("#oSlKeep button").forEach((b) => b.onclick = () => {
  const s = curSlice();
  if (!s) return;
  s.keep = b.dataset.k === "1";
  outChanged(true);
});
$("oSl11").onclick = () => {
  const s = curSlice();
  if (!s) return;
  s.ow = s.oh = 0;
  outChanged(true);
};
document.querySelectorAll("#oSlRot button").forEach((b) => b.onclick = () => {
  const s = curSlice();
  if (!s) return;
  const r = +b.dataset.r;
  if ((r % 180 !== s.rot % 180) && (s.ow > 0 || s.oh > 0)) [s.ow, s.oh] = [s.oh, s.ow];
  s.rot = r;
  outChanged(true);
});
// 2.0.167: точный угол слайса (не только кратно 90°)
$("oSlRA").addEventListener("input", () => {
  const s = curSlice(), v = parseFloat(String($("oSlRA").value).replace(",", "."));
  if (!s || !isFinite(v)) return;
  sliceRotateTo(OC(), sliceNormA(v));
  outChanged(true);
});
$("oSlRA0").onclick = () => {
  const s = curSlice();
  if (!s || !+s.ra) return;
  sliceRotateTo(OC(), 0);
  outChanged(true);
};
$("oSlFH").onclick = () => {
  const s = curSlice();
  if (s) {
    s.fh = !s.fh;
    outChanged(true);
  }
};
$("oSlFV").onclick = () => {
  const s = curSlice();
  if (s) {
    s.fv = !s.fv;
    outChanged(true);
  }
};
$("oSlDup").onclick = () => {
  const o = OC(), s = curSlice();
  if (!s) return;
  const c = { ...s, id: newUid(), name: s.name + " (копия)", ox: s.ox + 40, oy: s.oy + 40 };
  o.slices.splice(o.slices.indexOf(s) + 1, 0, c);
  ui_out.sel = c.id;
  outChanged(true);
};
$("oSlDel").onclick = () => {
  // 2.0.196: удаляются все выбранные слайсы
  const o = OC();
  if (o && curSlice()) outSelDelete(o);
};
$("oSlClear").onclick = async () => {
  const o = OC();
  if (!o.slices.length || !await ask("Удалить все слайсы?", "", "", "Удалить", false)) return;
  o.slices = [];
  ui_out.sel = "";
  outChanged(true);
};
async function saveOutPNG(o, scr) {
  busy("Рендер выхода ".concat(scr.name, " ").concat(scr.w, "×").concat(scr.h, "…"));
  await tick();
  return renderOutPNG(o, scr, async (p) => {
    busy("Рендер выхода ".concat(scr.name, "… ").concat(Math.round(p * 100), "%"));
    await tick();
  });
}
const outFileName = (o, scr) => safeName("".concat(scr.w, "x").concat(scr.h, "-").concat(o.name, " ").concat(scr.name), "output").slice(0, 180) + ".png";
