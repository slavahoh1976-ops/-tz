// 3.0.9: правка текста ТЗ прямо на листе — двойной щелчок по блоку текста на превью.
// Тот же редактор (#tTxt), что был в панели, переезжает на лист поверх блока: тот же шрифт и масштаб,
// строки переносятся как на листе. Сохранение правок, «Ж», цвет и размер — прежние.
// Esc, «Готово» или щелчок мимо — правка закончена, масштаб листа — как был. На телефоне — на весь экран.
ui.tzEdit = null;
const tzIpTa = $("tTxt"), tzIpPanelBar = tzIpTa.previousElementSibling, tzIpHome = document.createComment("tTxt");
tzIpTa.before(tzIpHome);
const tzIpBar = document.createElement("div");
tzIpBar.className = "tzipbar";
tzIpBar.hidden = true;
tzIpBar.appendChild(rteBar({ whole: () => !isReqSel(ui.tzSel) }));
const tzIpSw = document.createElement("span");
tzIpSw.className = "tzipsw";
tzIpBar.firstChild.insertBefore(tzIpSw, tzIpBar.firstChild.children[1]);
const tzIpBtn = (html, title, fn, cls) => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "b" + (cls ? " " + cls : "");
  b.innerHTML = html;
  b.title = title;
  b.onmousedown = (e) => e.preventDefault();
  b.onclick = fn;
  tzIpBar.firstChild.appendChild(b);
  return b;
};
tzIpBtn("•", "Строка-пункт списка: поставить «•» в начало строки", () => {
  tzIpTa.focus();
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  // в начало текущей строки
  let n = sel.anchorNode;
  while (n && n.parentNode !== tzIpTa) n = n.parentNode;
  const line = n && n.nodeType === 1 ? n : null;
  if (line && /^•/.test(line.textContent)) return;
  const r = document.createRange();
  if (line) r.setStart(line, 0);
  else r.setStart(sel.anchorNode, 0);
  r.collapse(true);
  sel.removeAllRanges();
  sel.addRange(r);
  document.execCommand("insertText", false, "•  ");
  rteDone();
});
tzIpBtn("↶", "Отменить (Ctrl+Z)", () => {
  tzIpTa.focus();
  document.execCommand("undo");
  rteDone();
});
tzIpBtn("↷", "Повторить (Ctrl+Y)", () => {
  tzIpTa.focus();
  document.execCommand("redo");
  rteDone();
});
const tzIpOver = document.createElement("span");
tzIpOver.className = "tzipover";
tzIpOver.textContent = "не помещается";
tzIpOver.hidden = true;
tzIpBar.firstChild.appendChild(tzIpOver);
tzIpBtn("Готово", "Закончить правку (Esc)", () => tzIpStop(), "accent");
$("wrap").appendChild(tzIpBar);
const tzIpFull = () => window.matchMedia("(max-width: 820px), (pointer: coarse)").matches;
// цвета, которые есть в шаблоне (заголовки, «Внимание», основной текст) — одной кнопкой
function tzIpSwatches() {
  const cols = [];
  const add = (c) => {
    c = c && hexU(c);
    if (c && !cols.includes(c)) cols.push(c);
  };
  if (isReqSel(ui.tzSel)) {
    const info = tplCache[selBk()];
    if (info) {
      add(info.baseColor);
      for (const l of info.lines) for (const r of l.runs) if (!r.link) add(r.color);
    }
  } else add("#222222");
  add("#FF0000");
  tzIpSw.innerHTML = "";
  for (const c of cols.slice(0, 5)) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sw";
    b.style.background = c;
    b.title = "Цвет выделенного текста: " + c;
    b.onmousedown = (e) => e.preventDefault();
    b.onclick = () => {
      if (!rteSelect(!isReqSel(ui.tzSel))) return;
      document.execCommand("styleWithCSS", false, false);
      document.execCommand("foreColor", false, c);
      rteDone();
    };
    tzIpSw.appendChild(b);
  }
}
function tzIpStart(pk, lx, ly, forceFull) {
  if (ui.tzEdit && ui.tzEdit.pk === pk) return;
  if (ui.tzEdit) tzIpStop(true);
  const key2 = pkKey(pk), h = ui.tzHits.find((q) => q.pk === pk);
  selectTZText(key2);
  const ed = { pk, key: key2, zoom0: ui.tzZoom, view0: { ...ui.tzView }, fit: true, full: !!forceFull || tzIpFull() };
  // где щёлкнули — в единицах листа от угла блока (после приближения курсор встанет туда же)
  if (h && lx != null) {
    ed.rx = (lx - h.x) / h.k;
    ed.ry = (ly - h.y) / h.k;
  }
  if (h) {
    const sh = ui.tzSlideHits.find((q) => q.x === h.sx && q.y === h.sy);
    if (sh && ui.tzZoom < 0 && !ed.full) ui.tzZoom = sh.no;
  }
  ui.tzView = { z: 1, x: 0, y: 0 };
  ui.tzEdit = ed;
  ui.tzHover = null;
  tzIpTa.classList.add("ip");
  tzIpTa.classList.toggle("ipfull", ed.full);
  tzIpBar.classList.toggle("ipfull", ed.full);
  $("wrap").appendChild(tzIpTa);
  tzIpSwatches();
  tzIpBar.hidden = false;
  $("tTxtEdit").hidden = true;
  requestDraw();
}
function tzIpStop(quiet) {
  const ed = ui.tzEdit;
  if (!ed) return;
  ui.tzEdit = null;
  tzIpTa.blur();
  tzIpTa.classList.remove("ip", "ipfull", "over");
  tzIpTa.removeAttribute("style");
  tzIpHome.after(tzIpTa);
  tzIpBar.hidden = true;
  $("tTxtEdit").hidden = false;
  if (!quiet) {
    ui.tzZoom = ed.zoom0;
    ui.tzView = ed.view0;
  }
  rteRange = null;
  refreshTZText();
  requestDraw();
}
// где блок на экране: вызывается в конце drawTZ
function tzIpPlace() {
  const ed = ui.tzEdit, h = ui.tzHits.find((q) => q.pk === ed.pk);
  if (ui.page !== "tz" || !h && !ed.full) return tzIpStop(true);
  const isReq = ed.pk.startsWith("req:"), info = isReq ? tplCache[ed.pk.slice(4)] : null;
  if (isReq && !info) return;
  const base = isReq ? info.baseSz : NOTE_SZ, W = $("wrap").clientWidth, H = $("wrap").clientHeight, V = ui.tzView;
  if (ed.fit && !ed.full) {
    // приблизить: основной текст ~15 px, блок целиком по ширине, сверху место для панели
    ed.fit = false;
    let z = Math.max(1, Math.min(6, 15 / (base * h.k * PT)));
    z = Math.max(1, Math.min(z, (W - 48) / h.w));
    ui.tzView = { z, x: W / 2 - (h.x + h.w / 2) * z, y: 64 - h.y * z };
    tzViewClamp();
    requestDraw();
    return;
  }
  const s = tzIpTa.style, wr = $("wrap").getBoundingClientRect(), pr = pv.getBoundingClientRect(), ox = pr.left - wr.left, oy = pr.top - wr.top;
  s.color = isReq ? info.baseColor : "#222";
  if (ed.full) {
    s.fontSize = "17px";
  } else {
    const kz = h.k * PT * V.z, left = ox + V.x + h.x * V.z, top = oy + V.y + h.y * V.z;
    s.left = left + "px";
    s.top = top + "px";
    s.width = h.w * V.z + "px";
    s.fontSize = base * kz + "px";
    const boxH = isReq ? (reqRect(info).h - info.ins.t) * h.k * V.z : h.h * V.z;
    s.minHeight = Math.max(base * kz * RT_LH, Math.min(boxH, H)) + "px";
    // панель — над блоком, если не помещается — под ним
    const bh = tzIpBar.offsetHeight || 34;
    let by = top - bh - 8;
    if (by < 4) by = Math.min(H - bh - 4, top + Math.max(tzIpTa.offsetHeight, boxH) + 8);
    if (by < 4 || by > H - bh - 4) by = 4;
    tzIpBar.style.left = Math.max(4, Math.min(W - tzIpBar.offsetWidth - 4, left)) + "px";
    tzIpBar.style.top = by + "px";
    ed.boxH = boxH;
  }
  // не помещается: текст длиннее рамки блока шаблона
  let over = false;
  if (isReq) {
    const r = reqRect(info), tw = (r.w - 2 * info.ins.l) / PT;
    over = rtLayout(mctxRT, reqParas(info, reqTextOr(info)), tw, info.baseSz).h * PT > r.h - info.ins.t + 2000;
  }
  tzIpTa.classList.toggle("over", over);
  tzIpOver.hidden = !over;
  if (!ed.focused) {
    ed.focused = true;
    tzIpTa.focus({ preventScroll: true });
    // курсор — туда, куда щёлкнули
    let r = null;
    if (ed.rx != null && !ed.full && document.caretRangeFromPoint) {
      const kz = h.k * V.z;
      r = document.caretRangeFromPoint(wr.left + parseFloat(s.left) + ed.rx * kz, wr.top + parseFloat(s.top) + ed.ry * kz);
    }
    if (!r || !tzIpTa.contains(r.startContainer)) {
      r = document.createRange();
      r.selectNodeContents(tzIpTa);
      r.collapse(false);
    }
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
  }
}
tzIpTa.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && ui.tzEdit) {
    e.preventDefault();
    e.stopPropagation();
    tzIpStop();
  }
});
// колесо над текстом — масштаб листа, как над превью
tzIpTa.addEventListener("wheel", (e) => {
  if (!ui.tzEdit || ui.tzEdit.full) return;
  e.preventDefault();
  pv.dispatchEvent(new WheelEvent("wheel", e));
}, { passive: false });
// щелчок мимо текста и панели — правка закончена
window.addEventListener("pointerdown", (e) => {
  if (!ui.tzEdit) return;
  const t = e.target;
  if (tzIpTa.contains(t) || tzIpBar.contains(t)) return;
  tzIpStop();
}, true);
window.addEventListener("resize", () => ui.tzEdit && requestDraw());
// панель слева: вместо окна редактора — кнопка «Править текст на листе»
tzIpPanelBar.classList.add("tzpanelbar");
$("tTxtEdit").onclick = () => {
  const pk = tzSelPk();
  if (ui.tzHits.some((q) => q.pk === pk)) return tzIpStart(pk);
  // текст ещё не на превью (открыт другой лист «Крупно» или подписи пока нет) — показать все листы;
  // нет его и там — окно на весь экран
  ui.tzZoom = -1;
  requestDraw();
  setTimeout(() => tzIpStart(pk, null, null, !ui.tzHits.some((q) => q.pk === pk)), 80);
};
// браузер прокручивает область листа, чтобы показать курсор, — вместо этого сдвигаем сам лист
$("wrap").addEventListener("scroll", () => {
  const w = $("wrap");
  if (!w.scrollTop && !w.scrollLeft) return;
  if (ui.tzEdit && !ui.tzEdit.full) {
    ui.tzView.x -= w.scrollLeft;
    ui.tzView.y -= w.scrollTop;
    tzViewClamp();
    requestDraw();
  }
  w.scrollTop = 0;
  w.scrollLeft = 0;
});
