// 2.0.38: общие «Размер / Поворот» для активного текста — дополнительного, если он выбран, иначе основного
// цвет текста «как в режиме» (по умолчанию): у проекции — цвет текста из «Фон / линии / текст», иначе белый
const txDefColor = (st) => st.kind === "proj" ? (st.proj && st.proj.invert ? "#000000" : st.proj && st.proj.text || "#FFFFFF") : "#FFFFFF";
// 2.0.110: несколько доп. текстов сразу — основной ui.selLabel + ui.selMore (Shift / Ctrl / ⌘ + щелчок)
ui.selMore = /* @__PURE__ */ new Set();
ui.selMoreUid = "";
function selExtras() {
  const st = S(), n = (st.extraLabels || []).length, out = [];
  if (ui.selLabel >= 0 && ui.selLabel < n) out.push(ui.selLabel);
  else return out;
  if (ui.selMoreUid === st.uid) for (const i of ui.selMore) if (i < n && !out.includes(i)) out.push(i);
  return out;
}
function clearSelMore() {
  ui.selMore.clear();
  ui.selMoreUid = S().uid;
}
function forSel(fn) {
  const ids = selExtras(), keep = ui.selLabel;
  for (const i of ids) {
    ui.selLabel = i;
    fn(i);
  }
  ui.selLabel = keep;
}
const txExtra = () => {
  const st = S();
  return ui.selLabel >= 0 && st.extraLabels && st.extraLabels[ui.selLabel] ? st.extraLabels[ui.selLabel] : null;
};
function syncTextControls() {
  if (!$("txSize")) return;
  const st = S(), it = txExtra();
  setVal($("txSize"), it ? sizeIndexFor(it.size) : st.inscriptionIndex);
  setTxt($("txRotVal"), angS(it ? normDeg(+it.rotation || 0) : titleRot(st)) + "°");
  {
    const c = (it ? it.color : st.titleColor) || txDefColor(st);
    setVal($("txColor"), c.toLowerCase());
    $("txColorReset").disabled = !(it ? it.color : st.titleColor);
  }
  const nSel = selExtras().length;
  if (it && nSel > 1) setTxt($("txWho"), "Настройки ниже — для ".concat(nSel, " доп. текстов (Shift / Ctrl + щелчок — добавить или убрать)"));
  else setTxt($("txWho"), it ? "Настройки ниже — для доп. текста ".concat(ui.selLabel + 1, ": «").concat(it.text || "Текст", "»") : "Настройки ниже — для основного текста");
}
function ask(title, text, value, okText = "OK", withInput = true) {
  return new Promise((res) => {
    $("modalTitle").textContent = title;
    $("modalText").textContent = text || "";
    $("modalText").hidden = !text;
    const inp = $("modalInput");
    inp.hidden = !withInput;
    inp.value = value || "";
    $("modalOk").textContent = okText;
    $("modalCancel").textContent = "Отмена";
    $("modalAlt").hidden = true;
    $("modal").hidden = false;
    if (withInput) setTimeout(() => {
      inp.focus();
      inp.select();
    }, 30);
    const done = (v) => {
      $("modal").hidden = true;
      $("modalOk").onclick = $("modalCancel").onclick = inp.onkeydown = null;
      res(v);
    };
    $("modalOk").onclick = () => done(withInput ? inp.value : true);
    $("modalCancel").onclick = () => done(null);
    inp.onkeydown = (e) => {
      if (e.key === "Enter") done(inp.value);
      if (e.key === "Escape") done(null);
    };
  });
}
const pv = $("pv"), pctx = pv.getContext("2d");
let L = null, drawQueued = false;
function requestDraw() {
  if (!drawQueued) {
    drawQueued = true;
    requestAnimationFrame(draw);
  }
}
function layout() {
  const st = S(), [W, H] = dims(st);
  const r = $("wrap").getBoundingClientRect(), cw = r.width, chh = r.height;
  const narrow = cw < 600, padX = narrow ? 16 : 40, padY = narrow ? 16 : 80;
  const scale = Math.min((cw - padX) / W, (chh - padY) / H) * ui.zoom;
  if (!(scale > 0)) return null;
  const gw = W * scale, gh = H * scale;
  return { st, W, H, scale, cw, ch: chh, ox: (cw - gw) / 2 + ui.panX, oy: (chh - gh) / 2 + ui.panY, gw, gh, G: grid(st) };
}
function fitStage(wh) {
  const wrap = $("wrap");
  if (window.matchMedia("(max-width: 820px)").matches) {
    const [W, H] = wh || dims(S()), w = wrap.clientWidth;
    const h = Math.round(Math.max(150, Math.min(window.innerHeight * 0.32, (w - 16) * H / W + 16)));
    if (wrap.style.height !== h + "px") wrap.style.height = h + "px";
  } else if (wrap.style.height) wrap.style.height = "";
}
function draw() {
  drawQueued = false;
  syncZoomLabel();
  if (ui.page === "mask") syncPaintUI();
  vol3dDraw();
  if (ui.page === "field") {
    drawField();
    return;
  }
  if (ui.page === "cut") {
    drawCut();
    return;
  }
  if (ui.page === "out") {
    drawOut();
    return;
  }
  if (ui.page === "tz") {
    drawTZ();
    return;
  }
  if (ui.page === "about") {
    fitStage([10, 9]);
    return;
  }
  fitStage();
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const r = $("wrap").getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
  if (pv.width !== w || pv.height !== h) {
    pv.width = w;
    pv.height = h;
  }
  pctx.setTransform(1, 0, 0, 1, 0, 0);
  pctx.fillStyle = (getComputedStyle(document.documentElement).getPropertyValue("--stage") || "#1d1f21").trim();
  pctx.fillRect(0, 0, w, h);
  L = layout();
  if (!L) return;
  pctx.setTransform(1, 0, 0, 1, Math.round(L.ox * dpr), Math.round(L.oy * dpr));
  REF_ON_CANVAS = true;
  try {
    drawMask(pctx, L.st, L.scale * dpr, guidesOf(L.st));
  } finally {
    REF_ON_CANVAS = false;
  }
  pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const st = L.st, s = L.scale, lw = Math.max(2, 2 * s);
  pctx.lineWidth = lw;
  pctx.strokeStyle = "#00f2ff";
  for (const k of ui.selected) {
    const p = parseKey(k);
    if (!p || p[0] >= st.cabCols || p[1] >= st.cabRows) continue;
    const [x, y, ww, hh] = cellRect(p[0], p[1]), ra = cabRotOf(st, p[0], p[1]);
    pctx.save();
    if (ra) {
      pctx.translate(x + ww / 2, y + hh / 2);
      pctx.rotate(ra * Math.PI / 180);
      pctx.translate(-(x + ww / 2), -(y + hh / 2));
    }
    pctx.strokeRect(x + lw / 2 + 1, y + lw / 2 + 1, ww - lw - 2, hh - lw - 2);
    pctx.restore();
  }
  if ((!st.kind || st.kind === "led") && (st.cabGroups || []).length) {
    // 2.0.173: кабинеты в группах помечены жёлтым пунктиром — только на экране, в PNG/ТЗ этого нет
    pctx.save();
    pctx.setLineDash([5, 4]);
    pctx.strokeStyle = "rgba(255,219,13,0.85)";
    pctx.lineWidth = Math.max(1, lw / 2);
    for (const g of st.cabGroups) for (const k of g) {
      const p = parseKey(k);
      if (!p || p[0] >= st.cabCols || p[1] >= st.cabRows) continue;
      const [x, y, ww, hh] = cellRect(p[0], p[1]), ra = cabRotOf(st, p[0], p[1]);
      pctx.save();
      if (ra) {
        pctx.translate(x + ww / 2, y + hh / 2);
        pctx.rotate(ra * Math.PI / 180);
        pctx.translate(-(x + ww / 2), -(y + hh / 2));
      }
      pctx.strokeRect(x + lw + 3, y + lw + 3, ww - 2 * lw - 6, hh - 2 * lw - 6);
      pctx.restore();
    }
    pctx.restore();
  }
  if (!st.kind || st.kind === "led") {
    // 2.0.174: зелёная точка поворота выбранного кабинета / группы (группа крутится как один блок)
    const ri = ledRotInfo(st);
    if (ri) {
      pctx.save();
      if (ri.group) {
        pctx.setLineDash([6, 5]);
        pctx.strokeStyle = "rgba(52,199,89,0.7)";
        pctx.lineWidth = 1;
        pctx.beginPath();
        pctx.arc(ri.px, ri.py, ri.r, 0, Math.PI * 2);
        pctx.stroke();
        pctx.setLineDash([]);
        pctx.fillStyle = "#34c759";
        pctx.beginPath();
        pctx.arc(ri.px, ri.py, 3, 0, Math.PI * 2);
        pctx.fill();
      }
      pctx.strokeStyle = "#34c759";
      pctx.lineWidth = 1.5;
      pctx.beginPath();
      pctx.moveTo(ri.bx, ri.by);
      pctx.lineTo(ri.hx, ri.hy);
      pctx.stroke();
      pctx.fillStyle = "#34c759";
      pctx.beginPath();
      pctx.arc(ri.hx, ri.hy, 6, 0, Math.PI * 2);
      pctx.fill();
      pctx.strokeStyle = "#000";
      pctx.lineWidth = 1;
      pctx.stroke();
      pctx.restore();
    }
  }
  if (ui.hover && ui.mod) {
    const [x, y, ww, hh] = cellRect(...ui.hover);
    pctx.strokeStyle = "#ffdb0d";
    pctx.strokeRect(x + lw / 2 + 1, y + lw / 2 + 1, ww - lw - 2, hh - lw - 2);
  }
  drawCachePreview(st, s);
  ringOverlay();
  if (ui.textHover && !act) {
    const th = textHoverAt(ui.textHover.f.cx, ui.textHover.f.cy, null), sel = ui.textHover.k === "t" ? ui.textMode === 0 : selExtras().includes(+ui.textHover.k.slice(1));
    if (th && th.k === ui.textHover.k && !sel) {
      const f = th.f;
      pctx.save();
      pctx.strokeStyle = "#ffdb0d";
      pctx.lineWidth = 1.5;
      pctx.setLineDash([4, 3]);
      pctx.strokeRect(f.cx - f.w / 2 - 6, f.cy - f.h / 2 - 4, f.w + 12, f.h + 8);
      pctx.restore();
      centerMark(f.cx, f.cy, false);
    }
  }
  if (ui.shapeHover >= 0 && !act && st.cacheShapes && st.cacheShapes[ui.shapeHover] && ui.shapeHover !== ui.selShape) {
    const c = st.cacheShapes[ui.shapeHover], cx = L.ox + c.x * s, cy = L.oy + c.y * s;
    pctx.save();
    pctx.strokeStyle = "#ffdb0d";
    pctx.lineWidth = 1.5;
    pctx.setLineDash([5, 4]);
    shapePath(pctx, c, cx, cy, c.w / 2 * s, c.h / 2 * s);
    pctx.stroke();
    pctx.restore();
    centerMark(cx, cy, false);
  }
  pctx.lineWidth = 2;
  pctx.strokeStyle = "#ffff00";
  if (ui.textMode === 0 && TX_HIDE !== st) {
    const f = titleFrame();
    pctx.strokeRect(f.cx - f.w / 2 - 8, f.cy - f.h / 2 - 6, f.w + 16, f.h + 12);
    centerMark(f.cx, f.cy, true);
  }
  if (ui.selLabel >= 0 && st.extraLabels[ui.selLabel]) {
    for (const i of selExtras()) {
      if (TX_HIDE === st.extraLabels[i]) continue;
      const f = labelFrame(i);
      pctx.lineWidth = 1.5;
      pctx.strokeRect(f.cx - f.w / 2 - 4, f.cy - f.h / 2 - 3, f.w + 8, f.h + 6);
      centerMark(f.cx, f.cy, true);
    }
  }
  if (ui.txGuides && ui.txGuides.length) {
    // линии привязки магнита текста (как на общем поле)
    const ox = L.ox + L.W * s / 2, oy = L.oy + L.H * s / 2;
    pctx.save();
    pctx.strokeStyle = "#ff2bd6";
    pctx.lineWidth = 1;
    pctx.setLineDash([6, 4]);
    pctx.beginPath();
    for (const g of ui.txGuides) {
      if (g.ax === "x") {
        const x = Math.round(ox + g.v * s) + 0.5;
        pctx.moveTo(x, L.oy);
        pctx.lineTo(x, L.oy + L.H * s);
      } else {
        const y = Math.round(oy - g.v * s) + 0.5;
        pctx.moveTo(L.ox, y);
        pctx.lineTo(L.ox + L.W * s, y);
      }
    }
    pctx.stroke();
    pctx.restore();
  }
}
// 2.0.38: магнит текста. Координаты текста — смещение центра от центра маски (x вправо, y вверх).
// Центр и края текста притягиваются к центру и краям экрана и к центрам и краям других текстов. Alt — без магнита.
function textBoxes(st) {
  const s = L.scale, out = [];
  if (titleLines(st, s).length) {
    const f = titleFrame();
    out.push({ i: -1, x: st.titleOffsetX, y: st.titleOffsetY, hw: f.w / 2 / s, hh: f.h / 2 / s });
  }
  (st.extraLabels || []).forEach((it, i) => {
    const f = labelFrame(i);
    out.push({ i, x: +it.x || 0, y: +it.y || 0, hw: f.w / 2 / s, hh: f.h / 2 / s });
  });
  return out;
}
function textSnap(self, x, y, e) {
  ui.txGuides = null;
  if (!L || ui.textMagnet === false || e && e.altKey) return [x, y];
  const st = S(), s = L.scale, all = textBoxes(st), me = all.find((b) => b.i === self);
  if (!me) return [x, y];
  const thr = 10 / s, guides = [];
  const axis = (v, half, ax) => {
    const W2 = (ax === "x" ? L.W : L.H) / 2, targets = [0, -W2, W2];
    for (const b of all) if (b.i !== self) {
      const c = ax === "x" ? b.x : b.y, hb = ax === "x" ? b.hw : b.hh;
      targets.push(c, c - hb, c + hb);
    }
    let best = null;
    for (const off of [0, -half, half]) for (const t of targets) {
      const d = t - (v + off);
      if (Math.abs(d) <= thr && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, t };
    }
    if (!best) return v;
    guides.push({ ax, v: best.t });
    return Math.round((v + best.d) * 100) / 100;
  };
  const nx = axis(x, me.hw, "x"), ny = axis(y, me.hh, "y");
  ui.txGuides = guides;
  return [nx, ny];
}
function cellRect(c, r) {
  const s = L.scale, { xs, ys } = L.G, st = L.st, sh = cabShift(st), dx = sh.dx(c, r), dy = sh.dy(c, r);
  return [L.ox + (xs[c] + dx) * s, L.oy + (L.H - ys[r + 1] - dy) * s, (xs[c + 1] - xs[c]) * s, (ys[r + 1] - ys[r]) * s];
}
function textHoverAt(x, y, e) {
  const st = S();
  if (!L || ui.bezDraw) return null;
  if (!(st.kind === "proj" || st.kind === "tv" || st.kind === "ring" || (!st.kind || st.kind === "led") && (ui.tool || "select") === "select" && !(e && e.altKey))) return null;
  const hitF = (f) => Math.abs(x - f.cx) <= f.w / 2 + 10 && Math.abs(y - f.cy) <= f.h / 2 + 10;
  for (let i = (st.extraLabels || []).length - 1; i >= 0; i--) if (hitF(labelFrame(i))) return { k: "l" + i, f: labelFrame(i) };
  if (titleLines(st, L.scale).length && hitF(titleFrame())) return { k: "t", f: titleFrame() };
  return null;
}
function titleFrame() {
  const st = L.st, s = L.scale, b = withSty(st.tSty, () => blockSize(titleLines(st, s), TITLE_GAP * s));
  const a = titleRot(st) * Math.PI / 180, cs = Math.abs(Math.cos(a)), sn = Math.abs(Math.sin(a));
  const w = b.w * cs + b.h * sn, h = b.w * sn + b.h * cs;
  return { cx: L.ox + L.W * s / 2 + st.titleOffsetX * s, cy: L.oy + L.H * s / 2 - st.titleOffsetY * s, w, h };
}
function labelFrame(i) {
  const st = L.st, s = L.scale, it = st.extraLabels[i], m = withSty(it.sty, () => measure(it.text || "Текст", Math.max(6, it.size) * s));
  // 2.0.38: рамка с учётом любого поворота (как у основного текста) — для выбора мышью и магнита
  const a = (+it.rotation || 0) * Math.PI / 180, cs = Math.abs(Math.cos(a)), sn = Math.abs(Math.sin(a));
  const w = m.w * cs + m.h * sn, h = m.w * sn + m.h * cs;
  return { cx: L.ox + L.W * s / 2 + it.x * s, cy: L.oy + L.H * s / 2 - it.y * s, w, h };
}
function pointToCell(x, y) {
  if (!L || L.st.kind && L.st.kind !== "led") return null;
  const st = L.st, s = L.scale;
  if (x < L.ox || x >= L.ox + L.gw || y < L.oy || y >= L.oy + L.gh) return null;
  const px = (x - L.ox) / s, py = (L.oy + L.gh - y) / s, { xs, ys } = L.G;
  // 2.0.150: при сдвиге рядов/столбцов кабинет ищем перебором с учётом смещения
  if (hasShift(st) || hasRot(st)) {
    const sh = cabShift(st);
    // 2.0.174: повёрнутый кабинет проверяем в его системе координат; повёрнутые — сверху
    const inCab = (c, r) => {
      const dx = sh.dx(c, r), dy = sh.dy(c, r), a = cabRotOf(st, c, r) * Math.PI / 180;
      if (!a) return px >= xs[c] + dx && px < xs[c + 1] + dx && py >= ys[r] + dy && py < ys[r + 1] + dy;
      const cx = (xs[c] + xs[c + 1]) / 2 + dx, cy = (ys[r] + ys[r + 1]) / 2 + dy, vx = px - cx, vy = py - cy;
      const lx = Math.cos(a) * vx - Math.sin(a) * vy, ly = Math.sin(a) * vx + Math.cos(a) * vy;
      return Math.abs(lx) <= (xs[c + 1] - xs[c]) / 2 && Math.abs(ly) <= (ys[r + 1] - ys[r]) / 2;
    };
    if (hasRot(st)) for (const k of Object.keys(st.cabRot)) {
      const q = parseKey(k);
      if (q && q[0] < st.cabCols && q[1] < st.cabRows && inCab(q[0], q[1])) return [q[0], q[1]];
    }
    for (let r = st.cabRows - 1; r >= 0; r--) for (let c = st.cabCols - 1; c >= 0; c--) if (inCab(c, r)) return [c, r];
    return null;
  }
  let c = 0, r = 0;
  while (c < st.cabCols - 1 && px >= xs[c + 1]) c++;
  while (r < st.cabRows - 1 && py >= ys[r + 1]) r++;
  return c >= 0 && r >= 0 && c < st.cabCols && r < st.cabRows ? [c, r] : null;
}
const pointers = /* @__PURE__ */ new Map();
let act = null, pinch = null;
function local(e) {
  const r = pv.getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top];
}
// 2.0.174: поворот и перемещение кабинетов LED (отдельный кабинет — вокруг себя, группа — как один блок вокруг общего центра)
const cabValid = (st, k) => {
  const p = parseKey(k);
  return p && p[0] >= 0 && p[1] >= 0 && p[0] < st.cabCols && p[1] < st.cabRows ? p : null;
};
function cabCenterMask(st, c, r) {
  const { xs, ys } = grid(st), o = cof(st, c, r);
  return [(xs[c] + xs[c + 1]) / 2 + o[0], (ys[r] + ys[r + 1]) / 2 + o[1]];
}
function ledSelPri(st) {
  if (ui.selPri && ui.selected.has(ui.selPri) && cabValid(st, ui.selPri)) return ui.selPri;
  return [...ui.selected].find((k) => cabValid(st, k)) || "";
}
// точка поворота выбранного кабинета / группы на экране
// 2.0.193: поворот кабинетов включается галочкой (по умолчанию выключен — нет зелёной точки, нельзя случайно повернуть)
let cabRotOn = (() => { try { return localStorage.getItem("ledmask.cabRotOn") === "1"; } catch (e) { return false; } })();
function ledRotInfo(st) {
  if (!cabRotOn) return null;
  if (!L || st.kind && st.kind !== "led" || !ui.selected.size) return null;
  const pk = ledSelPri(st);
  if (!pk) return null;
  const g = cabGroupOf(st, pk), mem = (g && g.length > 1 ? g : [pk]).filter((k) => cabValid(st, k));
  const cs = mem.map((k) => {
    const [c, r] = parseKey(k), [x, y, w, h] = cellRect(c, r);
    return [x + w / 2, y + h / 2, w, h];
  });
  const px = cs.reduce((a, q) => a + q[0], 0) / cs.length, py = cs.reduce((a, q) => a + q[1], 0) / cs.length;
  const r = mem.length > 1 ? Math.max(...cs.map((q) => Math.hypot(q[0] - px, q[1] - py) + Math.hypot(q[2], q[3]) / 2)) : cs[0][3] / 2;
  const [pc, pr] = parseKey(pk), ang = cabRotOf(st, pc, pr) * Math.PI / 180, d = r + 26;
  return { k: pk, mem, px, py, r, ang, hx: px + Math.sin(ang) * d, hy: py - Math.cos(ang) * d, bx: px + Math.sin(ang) * r, by: py - Math.cos(ang) * r, group: mem.length > 1 };
}
function ledRotateSel(delta, abs) {
  if (!cabRotOn) return status("Поворот кабинетов выключен — включите галочку «Разрешить поворот кабинетов»", true);
  const st = S();
  if (st.kind && st.kind !== "led") return;
  const keys = [...ui.selected].filter((k) => cabValid(st, k));
  if (!keys.length) return status("Сначала выделите кабинеты на холсте", true);
  const pri = ledSelPri(st), pp = parseKey(pri);
  const gd = abs != null ? normCabRot(abs - cabRotOf(st, pp[0], pp[1])) : delta;
  st.cabRot = st.cabRot || {};
  st.cabShift = st.cabShift || {};
  const done = new Set(), setRot = (k, a) => {
    const v = normCabRot(a);
    if (v === 0) delete st.cabRot[k]; else st.cabRot[k] = v;
  };
  for (const k of keys) {
    if (done.has(k)) continue;
    const g = cabGroupOf(st, k);
    if (!g || g.length < 2) continue;
    // группа — один жёсткий блок: поворот вокруг общего центра
    const mem = g.filter((q) => cabValid(st, q)), cs = mem.map((q) => cabCenterMask(st, ...cabValid(st, q)));
    const px = cs.reduce((a, q) => a + q[0], 0) / cs.length, py = cs.reduce((a, q) => a + q[1], 0) / cs.length;
    const a = gd * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    mem.forEach((q, i) => {
      done.add(q);
      const [x, y] = cs[i], rx = x - px, ry = y - py, nx = px + ca * rx + sa * ry, ny = py - sa * rx + ca * ry, o = (st.cabShift[q] || [0, 0]).slice();
      o[0] = Math.round((o[0] + nx - x) * 100) / 100;
      o[1] = Math.round((o[1] + ny - y) * 100) / 100;
      if (o[0] === 0 && o[1] === 0) delete st.cabShift[q]; else st.cabShift[q] = o;
      setRot(q, (+st.cabRot[q] || 0) + gd);
    });
  }
  for (const k of keys) {
    if (done.has(k)) continue;
    done.add(k);
    setRot(k, abs != null ? abs : (+st.cabRot[k] || 0) + delta);
  }
  changed({ forcePhys: true });
}
// 2.0.177: положение выбранного кабинета (или группы) — реальный сдвиг в пикселях, можно ввести своё значение
function syncCabPosUI() {
  const st = S(), ix = $("cabPosX"), iy = $("cabPosY");
  if (!ix) return;
  const led = !st.kind || st.kind === "led", pk = led ? ledSelPri(st) : "", p = pk ? parseKey(pk) : null;
  ix.disabled = iy.disabled = !p;
  const o = p ? cof(st, p[0], p[1]) : null;
  if (document.activeElement !== ix) ix.value = o ? String(Math.round(o[0] * 100) / 100) : "";
  if (document.activeElement !== iy) iy.value = o ? String(Math.round(o[1] * 100) / 100) : "";
  // 2.0.178: то же положение в сантиметрах (по физическому размеру кабинета)
  const cx = $("cabPosCmX"), cy = $("cabPosCmY");
  if (cx) {
    const mm = led ? mmPerPx(st) : [0, 0], okCm = !!o && mm[0] > 0 && mm[1] > 0;
    cx.disabled = cy.disabled = !okCm;
    if (document.activeElement !== cx) cx.value = okCm ? String(Math.round(o[0] * mm[0]) / 10) : "";
    if (document.activeElement !== cy) cy.value = okCm ? String(Math.round(o[1] * mm[1]) / 10) : "";
  }
  const cnt = ui.selected.size;
  $("cabPosInfo").textContent = p ? "Сдвиг от сетки (px и см): ".concat(cnt > 1 ? "главный из " + cnt + " выбранных" : "кабинет " + pk, ". Ввод применяется ко всему выделению.") : "Выделите кабинет или группу.";
}
function setCabPos(axis, v) {
  const st = S();
  if (st.kind && st.kind !== "led") return;
  const pk = ledSelPri(st), p = pk ? parseKey(pk) : null;
  if (!p || !isFinite(v)) return;
  const cur = cof(st, p[0], p[1]), d = v - cur[axis === "x" ? 0 : 1];
  if (!d) return;
  st.cabShift = st.cabShift || {};
  for (const k of ui.selected) {
    if (!cabValid(st, k)) continue;
    const o = (st.cabShift[k] || [0, 0]).slice(), i = axis === "x" ? 0 : 1;
    o[i] = Math.round((o[i] + d) * 100) / 100;
    if (o[0] === 0 && o[1] === 0) delete st.cabShift[k]; else st.cabShift[k] = o;
  }
  changed({ forcePhys: true });
}
function syncCabRotUI() {
  syncCabPosUI();
  const st = S(), inp = $("cabRotIn");
  if (!inp) return;
  $("cabRotOn").checked = cabRotOn;
  $("cabRotBox").hidden = !cabRotOn;
  const nRot = Object.keys(st.cabRot || {}).length, oi = $("cabRotOffInfo");
  oi.textContent = !cabRotOn && nRot ? "Повёрнуто кабинетов: ".concat(nRot, " — их углы сохраняются. Вернуть 0°: «Сбросить сдвиг и поворот».") : "";
  oi.hidden = !oi.textContent;
  const led = !st.kind || st.kind === "led", pk = led ? ledSelPri(st) : "", p = pk ? parseKey(pk) : null;
  inp.disabled = !p;
  for (const id of ["cabRotCCW", "cabRotCW", "cabRot0"]) $(id).disabled = !p;
  if (document.activeElement !== inp) inp.value = p ? String(cabRotOf(st, p[0], p[1])) : "";
}
// 2.0.173: группы кабинетов LED — выбрали один, выбралась вся группа
const cabGroupOf = (st, k) => (st.cabGroups || []).find((a) => a.includes(k)) || null;
function expandCabGroups(st) {
  if (!st || !(st.cabGroups || []).length) return;
  for (const k of [...ui.selected]) {
    const g = cabGroupOf(st, k);
    if (g) for (const q of g) ui.selected.add(q);
  }
}
function selectRange(a, b) {
  ui.selected.clear();
  for (let r = Math.min(a[1], b[1]); r <= Math.max(a[1], b[1]); r++) for (let c = Math.min(a[0], b[0]); c <= Math.max(a[0], b[0]); c++) ui.selected.add(key(c, r));
  expandCabGroups(S());
}
pv.addEventListener("pointerdown", (e) => {
  if (ui.page && ui.page !== "mask") return;
  if (e.button === 2) return;
  pv.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, local(e));
  if (pointers.size === 2) {
    act = null;
    const [a, b] = [...pointers.values()];
    pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, z: ui.zoom, mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2, px: ui.panX, py: ui.panY };
    return;
  }
  if (pointers.size > 2) return;
  if (!L) return;
  const [x, y] = local(e), st = S();
  {
    const ra = refPointerDown(x, y);
    if (ra) {
      act = ra;
      return;
    }
  }
  if (ui.bezDraw) {
    // рисование своей фигуры: щелчок — точка, потянуть — изгиб, щелчок по первой точке — замкнуть
    const d = ui.bezDraw.pts, s0 = L.scale, ix = (x - L.ox) / s0, iy = (y - L.oy) / s0;
    if (d.length >= 3 && Math.hypot(L.ox + d[0].x * s0 - x, L.oy + d[0].y * s0 - y) <= 12) {
      bezFinish();
      return;
    }
    const q = { x: ix, y: iy, ix, iy, ox: ix, oy: iy, sm: false };
    d.push(q);
    act = { kind: "bezNew", q, x, y };
    requestDraw();
    syncShapes();
    return;
  }
  if (ui.selShape >= 0 && st.cacheShapes && st.cacheShapes[ui.selShape]) {
    const c = st.cacheShapes[ui.selShape], s0 = L.scale, cx = L.ox + c.x * s0, cy = L.oy + c.y * s0;
    if (c.t === "bez") {
      const hs = bezHandles(c, cx, cy, s0);
      const h = hs.find((q) => q.k !== "A" && Math.hypot(x - q.p[0], y - q.p[1]) <= 9) || hs.find((q) => q.k === "A" && Math.hypot(x - q.p[0], y - q.p[1]) <= 11);
      if (h) {
        ui.bezSel = h.i;
        act = { kind: "bez" + h.k, i: ui.selShape, j: h.i, x, y };
        syncShapes();
        requestDraw();
        return;
      }
    }
    for (const h of shapeHandles(c, cx, cy, s0)) {
      if (Math.hypot(x - h.p[0], y - h.p[1]) > (h.k === "size" ? 16 : 14)) continue;
      act = h.k === "size" ? { kind: "shapeSize", i: ui.selShape, m: h.m, x, y } : { kind: { rot: "shapeRot", top: "shapeTop", rad: "shapeRad" }[h.k], i: ui.selShape };
      return;
    }
    if (Math.hypot(x - cx, y - cy) <= 18) {
      act = { kind: "shape", i: ui.selShape, x, y };
      return;
    }
  }
  if (st.kind === "ring") {
    // поворот выбранного кабинета и растяжение кольца — раньше, чем выбор текста
    const gg0 = ringGeom(st), pri = gg0.list.find((m) => m.k === ui.ringPri && ui.ringSel.has(m.k));
    if (pri) {
      const [hx, hy] = ringRotHandle(pri, gg0);
      if (Math.hypot(x - hx, y - hy) <= 11) {
        act = { kind: "ringRot", k: pri.k };
        return;
      }
    }
  }
  // 2.0.81: в проекции и ТВ кабинетов нет — текст выбирается и двигается мышью сразу, без «Активного текста»
  // 2.0.94: и в LED (инструмент «Выбор») — щелчок по тексту выбирает его; Alt — выделять кабинеты под текстом
  if (st.kind === "proj" || st.kind === "tv" || st.kind === "ring" || (!st.kind || st.kind === "led") && (ui.tool || "select") === "select" && !e.altKey) {
    // 3.0.23: текст выбирается и двигается только за крестик в центре (как фигура); щелчок по буквам — кабинет под ними
    // на смартфоне (без быстрой панели) — как раньше: касание в любое место надписи
    const pcSel = document.documentElement.classList.contains("pc") && e.pointerType === "mouse";
    const hitC = (f) => pcSel ? Math.hypot(x - f.cx, y - f.cy) <= 16 : Math.abs(x - f.cx) <= f.w / 2 + 10 && Math.abs(y - f.cy) <= f.h / 2 + 10;
    for (let i = (st.extraLabels || []).length - 1; i >= 0; i--) if (hitC(labelFrame(i))) {
      const sel = selExtras();
      if ((e.shiftKey || e.ctrlKey || e.metaKey) && sel.length) {
        // 2.0.110: Shift / Ctrl / ⌘ + щелчок — добавить текст к выбранным или убрать
        if (ui.selMoreUid !== st.uid) clearSelMore();
        if (i === ui.selLabel) {
          const rest = sel.filter((j) => j !== i);
          ui.selMore = new Set(rest.slice(1));
          ui.textMode = rest.length ? rest[0] + 1 : -1;
        } else if (ui.selMore.has(i)) ui.selMore.delete(i);
        else ui.selMore.add(i);
        refreshTextList();
        syncTextControls();
        requestDraw();
        return;
      }
      if (!sel.includes(i)) clearSelMore();
      else if (i !== ui.selLabel) {
        ui.selMore.add(ui.selLabel);
        ui.selMore.delete(i);
      }
      ui.textMode = i + 1;
      ui.selLabel = i;
      selOnly("text");
      refreshTextList();
      syncTextControls();
      act = { kind: "label", i, x, y };
      requestDraw();
      return;
    }
    if (titleLines(st, L.scale).length && hitC(titleFrame())) {
      clearSelMore();
      ui.textMode = 0;
      ui.selLabel = -1;
      selOnly("text");
      refreshTextList();
      syncTextControls();
      act = { kind: "title", x, y };
      requestDraw();
      return;
    }
    if (ui.textMode >= 0) {
      clearSelMore();
      ui.textMode = -1;
      ui.selLabel = -1;
      refreshTextList();
      syncTextControls();
      requestDraw();
    }
  }
  if (ui.textMode === 0) {
    const f = titleFrame();
    if (e.pointerType === "mouse" ? Math.hypot(x - f.cx, y - f.cy) <= 16 : Math.abs(x - f.cx) <= f.w / 2 + 14 && Math.abs(y - f.cy) <= f.h / 2 + 14) {
      act = { kind: "title", x, y };
      return;
    }
  } else if (ui.textMode > 0 && st.extraLabels[ui.textMode - 1]) {
    const i = ui.textMode - 1, f = labelFrame(i);
    if (e.pointerType === "mouse" ? Math.hypot(x - f.cx, y - f.cy) <= 16 : Math.abs(x - f.cx) <= f.w / 2 + 14 && Math.abs(y - f.cy) <= f.h / 2 + 14) {
      ui.selLabel = i;
      act = { kind: "label", i, x, y };
      requestDraw();
      return;
    }
  }
  // 3.0.18–3.0.19: фигура выбирается щелчком мыши: в LED — по крестику в центре (внутри — кабинеты), в проекции и ТВ — в любом месте внутри
  ui.lastPtr = e.pointerType;
  if (typeof shapesHere === "function" && shapesHere(st) && (ui.tool || "select") === "select" && !e.altKey && !e.shiftKey && !e.ctrlKey && !e.metaKey && !ui.bezDraw) {
    const si = shapeEdgeAt(st, x, y, !!st.kind && st.kind !== "led");
    if (si >= 0) {
      ui.selShape = si;
      selOnly("shape");
      syncShapes();
      act = { kind: "shape", i: si, x, y };
      requestDraw();
      return;
    }
    // щелчок мимо фигуры — выбор с неё снимается (как в Keynote)
    if (ui.selShape >= 0) {
      ui.selShape = -1;
      syncShapes();
      requestDraw();
    }
  }
  if (st.kind === "ring") {
    const ra = ringPointerDown(e, x, y);
    if (ra) {
      act = ra;
      return;
    }
    if (e.pointerType !== "mouse" || ui.tool === "pan") act = { kind: "pan", x, y, px: ui.panX, py: ui.panY };
    return;
  }
  const alt = e.altKey, ctrl = e.ctrlKey || e.metaKey, shift = e.shiftKey;
  if (ui.tool === "pan" && !alt && !ctrl && !shift) {
    act = { kind: "pan", x, y, px: ui.panX, py: ui.panY };
    return;
  }
  if (!alt && !ctrl && !shift && (!st.kind || st.kind === "led")) {
    const ri = ledRotInfo(st);
    if (ri && Math.hypot(x - ri.hx, y - ri.hy) <= 11) {
      act = { kind: "cabRot" };
      return;
    }
  }
  const cell = pointToCell(x, y);
  if (!cell) {
    if (e.pointerType !== "mouse" || ui.tool === "pan") act = { kind: "pan", x, y, px: ui.panX, py: ui.panY };
    return;
  }
  const k = key(...cell);
  // 3.0.19: выбор — только одного вида: выбираем кабинеты — текст и фигура снимаются
  if (!(alt || ui.tool === "black" && !ctrl && !shift)) selOnly("cab");
  if (alt || ui.tool === "black" && !ctrl && !shift) {
    const target = !st.blackCabinets.includes(k);
    act = { kind: "black", target };
    applyBlack(k, target);
  } else if (shift) {
    if (!ui.anchor) {
      const f = [...ui.selected][0];
      ui.anchor = f ? parseKey(f) : cell;
    }
    act = { kind: "range", from: ui.anchor };
    selectRange(ui.anchor, cell);
  } else if (ui.tool === "range") {
    ui.anchor = cell;
    act = { kind: "range", from: cell };
    selectRange(cell, cell);
  } else if (ctrl || ui.tool === "select") {
    // 2.0.174: схема как в Keynote — щелчок мышью выбирает один кабинет, Cmd/Ctrl добавляет или убирает,
    // Shift — диапазон, Alt — чёрный. Пальцем «Выбор» по-прежнему добавляет/убирает касанием.
    const grp = cabGroupOf(st, k) || [k], had = ui.selected.has(k);
    ui.anchor = cell;
    if (ctrl || e.pointerType === "touch") {
      for (const q of grp) had ? ui.selected.delete(q) : ui.selected.add(q);
      act = { kind: "tap" };
    } else {
      let collapse = "";
      if (!had) {
        ui.selected.clear();
        for (const q of grp) ui.selected.add(q);
      } else if (ui.selected.size > grp.length) collapse = k;
      const base = {};
      for (const q of ui.selected) if (cabValid(st, q)) base[q] = (st.cabShift && st.cabShift[q] || [0, 0]).slice();
      act = { kind: "cabMove", x0: x, y0: y, base, moved: false, collapse };
    }
  }
  if (ui.selected.has(k)) ui.selPri = k;
  hoverStatus(cell);
  changed();
});
pv.addEventListener("pointerleave", () => {
  if (ui.textHover) {
    ui.textHover = null;
    requestDraw();
  }
});
pv.addEventListener("pointermove", (e) => {
  if (ui.page && ui.page !== "mask") return;
  const p = local(e);
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, p);
  ui.mod = e.pointerType === "mouse" && (e.ctrlKey || e.metaKey || e.shiftKey);
  if (pinch && pointers.size >= 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
    ui.zoom = Math.max(0.25, Math.min(8, pinch.z * d / pinch.d));
    const k = ui.zoom / pinch.z, cx = $("wrap").clientWidth / 2, cy = $("wrap").clientHeight / 2;
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    ui.panX = pinch.px * k + (pinch.mx - cx) * (1 - k) + (mx - pinch.mx);
    ui.panY = pinch.py * k + (pinch.my - cy) * (1 - k) + (my - pinch.my);
    updateInfo();
    requestDraw();
    return;
  }
  const cell = pointToCell(...p);
  if (ui.bezDraw && L) {
    ui.bezHover = [(p[0] - L.ox) / L.scale, (p[1] - L.oy) / L.scale];
    if (!act) requestDraw();
  }
  if (!act) {
    if (e.pointerType === "mouse") {
      // 2.0.95: текст под мышью — пунктирная рамка (как надпись на общем поле)
      const th = textHoverAt(p[0], p[1], e), tk = th ? th.k : null;
      if (tk !== (ui.textHover && ui.textHover.k)) {
        ui.textHover = th;
        requestDraw();
      }
      // 3.0.19: фигура под мышью — пунктир по контуру и крестик в центре (щелчок по крестику — выбрать)
      let sh = -1, onC = false;
      if (!th && typeof shapesHere === "function" && L && shapesHere(L.st) && (ui.tool || "select") === "select" && !ui.bezDraw) {
        sh = shapeAt(L.st, p[0], p[1]);
        if (sh === ui.selShape) sh = -1;
        if (sh >= 0) {
          const c = L.st.cacheShapes[sh];
          onC = Math.hypot(p[0] - (L.ox + c.x * L.scale), p[1] - (L.oy + c.y * L.scale)) <= 16 || !!L.st.kind && L.st.kind !== "led";
        }
      }
      if (sh !== (ui.shapeHover == null ? -1 : ui.shapeHover)) {
        ui.shapeHover = sh;
        requestDraw();
      }
      const onT = th && Math.hypot(p[0] - th.f.cx, p[1] - th.f.cy) <= 16;
      pv.style.cursor = onT || onC ? "pointer" : "";
      const h = cell ? key(...cell) : null;
      if (h !== (ui.hover && key(...ui.hover))) {
        ui.hover = cell;
        requestDraw();
      }
      if (cell) hoverStatus(cell);
    }
    return;
  }
  const st = S(), s = L ? L.scale : 1;
  if (act.kind === "pan") {
    ui.panX = act.px + p[0] - act.x;
    ui.panY = act.py + p[1] - act.y;
    requestDraw();
  } else if (act.kind === "title") {
    if (act.rx == null) [act.rx, act.ry] = [st.titleOffsetX, st.titleOffsetY];
    act.rx += (p[0] - act.x) / s;
    act.ry -= (p[1] - act.y) / s;
    [st.titleOffsetX, st.titleOffsetY] = textSnap(-1, act.rx, act.ry, e);
    act.x = p[0];
    act.y = p[1];
    changed();
  } else if (act.kind === "refMove" || act.kind === "refSize") {
    refPointerMove(act, p, e);
  } else if (/^ring/.test(act.kind)) {
    ringPointerMove(act, p, e);
  } else if (act.kind === "bezNew") {
    // потянули при постановке точки — плавный узел с симметричными ручками
    const q = act.q, ix = (p[0] - L.ox) / s, iy = (p[1] - L.oy) / s;
    if (Math.hypot(p[0] - act.x, p[1] - act.y) > 3) Object.assign(q, { ox: ix, oy: iy, ix: 2 * q.x - ix, iy: 2 * q.y - iy, sm: true });
    requestDraw();
  } else if (act.kind === "bezA" || act.kind === "bezI" || act.kind === "bezO") {
    const c = st.cacheShapes[act.i], q = c && c.pts && c.pts[act.j];
    if (q) {
      const hw = c.w / 2, hh = c.h / 2;
      if (act.kind === "bezA") {
        const [dx, dy] = unrotPt(c, (p[0] - act.x) / s, (p[1] - act.y) / s), nx = dx / hw, ny = dy / hh;
        for (const [a, b] of [["x", "y"], ["ix", "iy"], ["ox", "oy"]]) {
          q[a] += nx;
          q[b] += ny;
        }
        act.x = p[0];
        act.y = p[1];
      } else {
        const [lx, ly] = unrotPt(c, (p[0] - (L.ox + c.x * s)) / s, (p[1] - (L.oy + c.y * s)) / s), hx = lx / hw, hy = ly / hh;
        const [mk, ok] = act.kind === "bezI" ? [["ix", "iy"], ["ox", "oy"]] : [["ox", "oy"], ["ix", "iy"]];
        q[mk[0]] = hx;
        q[mk[1]] = hy;
        if (q.sm) {
          // плавный узел: противоположная ручка на той же прямой, длина сохраняется
          const vx = (hx - q.x) * hw, vy = (hy - q.y) * hh, vl = Math.hypot(vx, vy) || 1e-9;
          const ol = Math.hypot((q[ok[0]] - q.x) * hw, (q[ok[1]] - q.y) * hh) || vl;
          q[ok[0]] = q.x - vx / vl * ol / hw;
          q[ok[1]] = q.y - vy / vl * ol / hh;
        }
      }
      changed();
    }
  } else if (act.kind === "shapeRot") {
    const c = st.cacheShapes[act.i];
    if (c) {
      let d = Math.atan2(p[1] - (L.oy + c.y * s), p[0] - (L.ox + c.x * s)) * 180 / Math.PI + 90;
      if (e.shiftKey) d = Math.round(d / 15) * 15;
      c.rot = normRot(d);
      syncShapes();
      changed();
    }
  } else if (act.kind === "shapeRad") {
    const c = st.cacheShapes[act.i];
    if (c) {
      const [lx] = unrotPt(c, (p[0] - (L.ox + c.x * s)) / s, (p[1] - (L.oy + c.y * s)) / s);
      c.r = Math.round(Math.max(0, Math.min(Math.min(c.w, c.h) / 2, c.w / 2 - lx)));
      syncShapes();
      changed();
    }
  } else if (act.kind === "shapeTop") {
    const c = st.cacheShapes[act.i];
    if (c) {
      // ширина верхнего основания трапеции — за голубую точку у его свободного края
      const hw = c.w / 2, sk = trapSk(c), [x] = unrotPt(c, (p[0] - (L.ox + c.x * s)) / s, (p[1] - (L.oy + c.y * s)) / s);
      const tw = sk > 0 ? (hw * sk - x) / (1 + sk) : (x - hw * sk) / (1 - sk);
      c.tb = Math.round(Math.max(5, Math.min(100, tw / hw * 100)));
      syncShapes();
      changed();
    }
  } else if (act.kind === "shapeSize") {
    const c = st.cacheShapes[act.i];
    if (c) {
      const [ldx, ldy] = unrotPt(c, p[0] - act.x, p[1] - act.y), dx = ldx / s * 2, dy = ldy / s * 2;
      if (c.lock) {
        const d = act.m === "h" ? dy : act.m === "w" ? dx : Math.abs(dx) > Math.abs(dy) ? dx : dy;
        c.w = c.h = Math.max(4, c.w + d);
      } else {
        if (act.m.includes("w")) c.w = Math.max(4, c.w + dx);
        if (act.m.includes("h")) c.h = Math.max(4, c.h + dy);
      }
    }
    act.x = p[0];
    act.y = p[1];
    syncShapes();
    changed();
  } else if (act.kind === "shape") {
    const c = st.cacheShapes[act.i];
    if (c) {
      c.x += (p[0] - act.x) / s;
      c.y += (p[1] - act.y) / s;
    }
    act.x = p[0];
    act.y = p[1];
    changed();
  } else if (act.kind === "label") {
    const it = st.extraLabels[act.i];
    if (act.rx == null) [act.rx, act.ry] = [it.x, it.y];
    act.rx += (p[0] - act.x) / s;
    act.ry -= (p[1] - act.y) / s;
    const x0 = it.x, y0 = it.y;
    [it.x, it.y] = textSnap(act.i, act.rx, act.ry, e);
    for (const j of selExtras()) if (j !== act.i) {
      const o = st.extraLabels[j];
      o.x = (+o.x || 0) + (it.x - x0);
      o.y = (+o.y || 0) + (it.y - y0);
    }
    act.x = p[0];
    act.y = p[1];
    changed();
  } else if (act.kind === "cabRot") {
    // точка поворота: угол выбранного кабинета (или группы) — по направлению от центра; Shift — шагом 15°
    L = layout() || L;
    const ri = ledRotInfo(st);
    if (ri) {
      let a = Math.atan2(p[0] - ri.px, -(p[1] - ri.py)) * 180 / Math.PI;
      if (e.shiftKey) a = Math.round(a / 15) * 15;
      ledRotateSel(0, Math.round(a * 100) / 100);
    }
  } else if (act.kind === "cabMove") {
    // перетаскивание выбранных кабинетов мышью (сдвиг cabShift)
    if (!act.moved && Math.hypot(p[0] - act.x0, p[1] - act.y0) <= 4) return;
    act.moved = true;
    const dxm = Math.round((p[0] - act.x0) / s), dym = Math.round(-(p[1] - act.y0) / s);
    st.cabShift = st.cabShift || {};
    for (const [q, o] of Object.entries(act.base)) {
      const v = [o[0] + dxm, o[1] + dym];
      if (v[0] === 0 && v[1] === 0) delete st.cabShift[q]; else st.cabShift[q] = v;
    }
    changed({ forcePhys: true });
  } else if (act.kind === "range" && cell) {
    selectRange(act.from, cell);
    hoverStatus(cell);
    changed();
  } else if (act.kind === "black" && cell) {
    applyBlack(key(...cell), act.target);
    hoverStatus(cell);
    changed();
  }
});
function endPointer(e) {
  if (ui.page && ui.page !== "mask") return;
  pointers.delete(e.pointerId);
  if (ui.txGuides) {
    ui.txGuides = null;
    requestDraw();
  }
  if (act && /^bez[AIO]$/.test(act.kind)) {
    const c = S().cacheShapes[act.i];
    if (c) {
      bezNormalize(c);
      syncShapes();
      changed();
    }
  }
  if (act && act.kind === "shapeSize") {
    const c = S().cacheShapes[act.i];
    if (c) {
      c.w = Math.round(c.w);
      c.h = Math.round(c.h);
      syncShapes();
      changed();
    }
  }
  if (pointers.size < 2) pinch = null;
  if (pointers.size === 0) {
    const wasBox = act && act.kind === "ringBox";
    if (act && act.kind === "ringMove" && act.tapToggle && !act.moved) ringTapToggle(act.tapToggle);
    if (act && act.kind === "ringMove" && act.tapCollapse && !act.moved) ringTapCollapse(act.tapCollapse);
    if (act && act.kind === "cabMove" && act.collapse && !act.moved) {
      // щелчок без сдвига по кабинету из выбора — остаётся только он (с его группой)
      const st2 = S(), g = cabGroupOf(st2, act.collapse) || [act.collapse];
      ui.selected.clear();
      for (const q of g) ui.selected.add(q);
      changed();
    }
    act = null;
    if (wasBox) requestDraw();
  }
}
pv.addEventListener("pointerup", endPointer);
pv.addEventListener("pointercancel", endPointer);
pv.addEventListener("pointerleave", (e) => {
  if (ui.page && ui.page !== "mask") return;
  if (e.pointerType === "mouse") {
    ui.hover = null;
    requestDraw();
  }
});
// 2.0.110: колесо мыши и тачпад (щипок / два пальца) — масштаб маски к курсору
pv.addEventListener("wheel", (e) => {
  if (ui.page && ui.page !== "mask") return;
  e.preventDefault();
  let dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
  if (!dy) return;
  const f = Math.max(0.5, Math.min(2, Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0018))));
  const r = $("wrap").getBoundingClientRect();
  setZoomAt(ui.zoom * f, e.clientX - r.left, e.clientY - r.top);
}, { passive: false });
function setZoomAt(z, mx, my) {
  const z0 = ui.zoom;
  z = Math.max(0.25, Math.min(8, z));
  if (z === z0) return;
  const k = z / z0, cx = $("wrap").clientWidth / 2, cy = $("wrap").clientHeight / 2;
  ui.panX = ui.panX * k + (mx - cx) * (1 - k);
  ui.panY = ui.panY * k + (my - cy) * (1 - k);
  setZoom(z);
}
function applyBlack(k, target) {
  const st = S(), set = new Set(st.blackCabinets);
  target ? set.add(k) : set.delete(k);
  st.blackCabinets = [...set];
}
function hoverStatus(cell) {
  const st = S(), [c, r] = cell;
  const { xs, ys } = grid(st), fig = !!shapedPx(st, (st.shapedCols || {})[c]) || (st.shapedRows || {})[r] > 0;
  status("Кабинет ".concat(cabLabel(st, c, r), " • ").concat(xs[c + 1] - xs[c], "×").concat(ys[r + 1] - ys[r], " px").concat(fig ? " (фигурный)" : "", " • X:").concat(xs[c], " Y:").concat(ys[r], " • ").concat(st.blackCabinets.includes(key(c, r)) ? "ЧЁРНЫЙ" : (st.cornerCabinets || {})[key(c, r)] != null ? "УГЛОВОЙ " + CORNER_GLYPH[st.cornerCabinets[key(c, r)]] : "АКТИВЕН"));
}
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && $("modal").hidden && ui.selected.size) {
    clearSelection();
  }
  if ((e.ctrlKey || e.metaKey || e.shiftKey) && !ui.mod) {
    ui.mod = true;
    requestDraw();
  }
});
window.addEventListener("keyup", (e) => {
  if (!(e.ctrlKey || e.metaKey || e.shiftKey) && ui.mod) {
    ui.mod = false;
    requestDraw();
  }
});
new ResizeObserver(requestDraw).observe($("wrap"));
function setZoom(z) {
  ui.zoom = Math.max(0.25, Math.min(8, z));
  updateInfo();
  requestDraw();
}
function clearSelection() {
  ui.selected.clear();
  ui.anchor = null;
  changed();
  status("Выделение снято");
}
function syncProjUI() {
  const st = S(), P = st.proj || (st.proj = defProj()), kind = ["proj", "tv", "pix", "tube", "vol", "ring"].includes(st.kind) ? st.kind : "led";
  if (P.numsN == null) P.numsN = Math.max(1, P.nx | 0) * Math.max(1, P.ny | 0);
  document.documentElement.setAttribute("data-kind", kind);
  {
    // 2.0.45: «Направляющие» — в разделе «ДАННЫЕ» текущего вида (LED, проекция, ТВ); переносим только при смене вида
    const g = $("guidesRow"), box = ["led", "proj", "tv"].includes(kind) ? $(kind + "Data") : null;
    if (g && box && g.parentElement !== box) box.appendChild(g);
    // 2.0.163: «Формат» и «Начало нумерации» нужны и кольцу — переносим строки в его панель
    const nr = $("numFmtRows"), nbox = kind === "ring" ? $("rgNumHost") : null, home = $("numFmtHome");
    if (nr && nbox) {
      if (nr.parentElement !== nbox) nbox.appendChild(nr);
    } else if (nr && home && nr.previousElementSibling !== home) home.after(nr);
  }
  document.documentElement.setAttribute("data-pjmode", P.mode === "dome" ? "dome" : "grid");
  document.querySelectorAll(".seg.pjmode button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === (P.mode === "dome" ? "dome" : "grid"))));
  document.querySelectorAll(".seg.pjdsize button").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.d === (P.dome | 0))));
  document.querySelectorAll(".seg.kind button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.kind === kind)));
  const sel = $("pjPreset");
  if (!sel.options.length) {
    sel.innerHTML = PJ_PRESETS.map((t, i) => '<option value="'.concat(i, '">').concat(t[0], "</option>")).join("") + '<option value="">Своё разрешение</option>';
  }
  const pi = PJ_PRESETS.findIndex((t) => t[1] === P.pw && t[2] === P.ph);
  sel.value = pi >= 0 ? pi : "";
  const set = (id, v) => {
    if (document.activeElement !== $(id)) $(id).value = v;
  };
  document.querySelectorAll(".seg.pjrot button").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.rot === (+P.rot ? 90 : 0))));
  {
    const [pwM, phM] = physM(st), cw = +P.cw > 0 && +P.ch > 0 ? +P.cw : +pwM.toFixed(2), ch = +P.cw > 0 && +P.ch > 0 ? +P.ch : +phM.toFixed(2);
    set("pjHm", ch);
    P._dispW = cw;
    const r = ratioOf(cw, ch);
    set("pjArW", r[0]);
    set("pjArH", r[1]);
    $("pjArLock").checked = P.arLock !== false;
  }
  set("pjW", P.pw);
  set("pjH", P.ph);
  set("pjNx", P.nx);
  set("pjNy", P.ny);
  set("pjOx", P.ox);
  set("pjOy", P.oy);
  set("pjGrid", P.grid);
  set("pjWm", P._dispW);
  set("pjDome", P.dome || 4096);
  set("pjFov", P.fov || 180);
  set("pjAz", P.az || 10);
  set("pjEl", P.el || 10);
  $("pjBg").value = (P.bg || "#101010").toLowerCase();
  $("pjLine").value = (P.line || "#FFFFFF").toLowerCase();
  $("pjText").value = (P.text || "#FFFFFF").toLowerCase();
  for (const [id, k] of [["pjZones", "zones"], ["pjFrames", "frames"], ["pjNums", "nums"], ["pjCircles", "circles"], ["pjCells", "cells"], ["pjHatch", "hatch"], ["pjBar", "bar"], ["pjInvert", "invert"]]) $(id).checked = !!P[k];
  for (const [id, k] of [["pjDMinor", "dminor"], ["pjDLabels", "dlabels"], ["pjDSides", "dsides"]]) $(id).checked = P[k] !== false;
  {
    const g = projGeom(st);
    set("pjCanW", g.W);
    set("pjCanH", g.H);
    set("pjOxPx", g.ovx);
    set("pjOyPx", g.ovy);
    set("pjOx", g.nx > 1 ? +(g.ovx / g.pw * 100).toFixed(2) : P.ox);
    set("pjOy", g.ny > 1 ? +(g.ovy / g.ph * 100).toFixed(2) : P.oy);
    const freeX = g.nx > 1, freeY = g.ny > 1 && !(g.canvas && g.nx > 1);
    $("pjOx").disabled = $("pjOxPx").disabled = !freeX;
    $("pjOy").disabled = $("pjOyPx").disabled = !freeY;
    $("pjCanW").disabled = g.canvas || g.nx < 2;
    $("pjCanH").disabled = g.canvas || g.ny < 2;
  }
  syncTVPixUI();
}
function syncTVPixUI() {
  if ($("vlModel")) syncVolUI();
  if (S().kind === "ring") syncRingUI();
  const st = S(), T = st.tv || (st.tv = defTV()), X = st.pix || (st.pix = defPix()), set = (id, v) => {
    if (document.activeElement !== $(id)) setVal($(id), v);
  };
  if (!$("tvPreset").options.length) $("tvPreset").innerHTML = TV_PRESETS.map((t, i) => '<option value="'.concat(i, '">').concat(t[0], "</option>")).join("") + '<option value="">Своё разрешение</option>';
  {
    const i = TV_PRESETS.findIndex((t) => t[1] === T.pw && t[2] === T.ph);
    setVal($("tvPreset"), i >= 0 ? i : "");
  }
  set("tvW", T.pw);
  set("tvH", T.ph);
  set("tvNx", T.nx);
  set("tvNy", T.ny);
  set("tvDiag", T.diag || 0);
  set("tvLabel", T.label || "");
  document.querySelectorAll(".seg.tvrot button").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.rot === (+T.rot ? 90 : 0))));
  $("tvBars").checked = T.bars !== false;
  $("tvGrid").checked = T.grid !== false;
  $("tvSafe").checked = T.safe !== false;
  $("tvCorner").checked = T.corner === true;
  if (!$("pxPreset").options.length) $("pxPreset").innerHTML = PIX_PRESETS.map((t, i) => '<option value="'.concat(i, '">').concat(t[0], "</option>")).join("") + '<option value="">Свой элемент</option>';
  {
    const i = PIX_PRESETS.findIndex((t) => t[1] === X.ew && t[2] === X.eh && t[3] === X.cmw && t[4] === X.cmh);
    setVal($("pxPreset"), i >= 0 ? i : "");
  }
  set("pxW", X.ew);
  set("pxH", X.eh);
  set("pxCmW", X.cmw);
  set("pxCmH", X.cmh);
  set("pxCols", X.cols);
  set("pxRows", X.rows);
  {
    const g = pixGeom(st);
    set("pxSx", Math.max(0, +X.gx || 0));
    set("pxSy", Math.max(0, +X.gy || 0));
    if (!$("pxScale").options.length) $("pxScale").innerHTML = '<option value="cm">1 px ≤ 1 см (авто)</option>' + [2, 3, 4, 5, 6, 8, 10].map((v) => '<option value="'.concat(v, '">×').concat(v, "</option>")).join("");
    {
      // сколько сантиметров в 1 px промежутка — шаг, с которым меняется расстояние в маске
      const dd = pixDens(X).d * pixK(X), cx = dd > 0 ? 1 / dd : 0;
      setTxt($("pxGapStep"), X.phys && cx > 0 ? "1 px маски = ".concat(+cx.toFixed(2), " см по ширине и высоте — пропорции как в реальности; промежуток меняется с этим шагом").concat(cx > 1.01 ? "; чтобы на каждый сантиметр — «Масштабировать маску: 1 px ≤ 1 см»" : "") : X.phys ? "" : "По пикселям: элементы вплотную, расстояние между элементами в маске не рисуется (оно учтено в общем размере в метрах)");
    }
    $("pxScaleOn").checked = !!X.scaleOn;
    setVal($("pxScale"), String(X.scale || 2));
    set("pxWm", +g.wm.toFixed(3));
    set("pxHm", +g.hm.toFixed(3));
    document.querySelectorAll(".seg.pxMode button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.m === "m" === !!X.phys)));
  }
  $("pxNums").checked = X.nums !== false;
  $("pxRowsShade").checked = X.shade !== false;
}

// 3.0.19: фигура под курсором — у крестика в центре; inside — и в любом месте внутри фигуры. Верхняя фигура — первой
function shapeEdgeAt(st, x, y, inside) {
  if (!L) return -1;
  const list = st.cacheShapes || [], s0 = L.scale, c2 = mctx;
  c2.save();
  c2.setTransform(1, 0, 0, 1, 0, 0);
  c2.lineWidth = 24;
  try {
    for (let i = list.length - 1; i >= 0; i--) {
      const c = list[i], cx = L.ox + c.x * s0, cy = L.oy + c.y * s0;
      if (Math.hypot(x - cx, y - cy) <= (ui.lastPtr === "mouse" ? 16 : 30)) return i;
      if (!inside) continue;
      shapePath(c2, c, cx, cy, c.w / 2 * s0, c.h / 2 * s0);
      if (c2.isPointInPath(x, y, "evenodd")) return i;
    }
  } finally {
    c2.restore();
  }
  return -1;
}

// 3.0.19: выбрано может быть только одно: кабинеты, фигура или текст — остальное снимается
function selOnly(kind) {
  if (kind !== "text" && ui.textMode >= 0) {
    clearSelMore();
    ui.textMode = -1;
    ui.selLabel = -1;
    refreshTextList();
    syncTextControls();
  }
  if (kind !== "shape" && ui.selShape >= 0) {
    ui.selShape = -1;
    syncShapes();
  }
  if (kind !== "cab" && ui.selected && ui.selected.size) {
    ui.selected.clear();
    ui.anchor = null;
    if (typeof syncPaintUI === "function") syncPaintUI();
  }
}

// 3.0.22: центр объекта — крестик при наведении, жёлтая точка с плюсом у выбранного (текст и фигура одинаково)
function centerMark(cx, cy, sel) {
  pctx.save();
  pctx.setLineDash([]);
  if (sel) {
    pctx.fillStyle = "#ffdb0d";
    pctx.strokeStyle = "#1b1b1b";
    pctx.lineWidth = 1.5;
    pctx.beginPath();
    pctx.arc(cx, cy, 8, 0, Math.PI * 2);
    pctx.fill();
    pctx.stroke();
    pctx.beginPath();
    pctx.moveTo(cx - 4.5, cy);
    pctx.lineTo(cx + 4.5, cy);
    pctx.moveTo(cx, cy - 4.5);
    pctx.lineTo(cx, cy + 4.5);
    pctx.stroke();
  } else {
    pctx.strokeStyle = "#ffdb0d";
    pctx.lineWidth = 2;
    pctx.beginPath();
    pctx.arc(cx, cy, 9, 0, Math.PI * 2);
    pctx.moveTo(cx - 13, cy);
    pctx.lineTo(cx + 13, cy);
    pctx.moveTo(cx, cy - 13);
    pctx.lineTo(cx, cy + 13);
    pctx.stroke();
  }
  pctx.restore();
}
