const stepInput = (id, step) => stepper(id, (d) => {
  const i = typeof id === "string" ? $(id) : id, lo = i.min !== "" ? +i.min : -Infinity, hi = i.max !== "" ? +i.max : Infinity;
  let v = parseFloat(String(i.value).replace(",", ".")) || 0;
  v = Math.min(hi, Math.max(lo, Math.round((v + d * step) / step) * step));
  i.value = +v.toFixed(3);
  i.dispatchEvent(new Event("input", { bubbles: true }));
  i.dispatchEvent(new Event("change", { bubbles: true }));
});
[
  ["wpx", 1],
  ["hpx", 1],
  ["pjW", 1],
  ["pjH", 1],
  ["pjNx", 1],
  ["pjNy", 1],
  ["pjWm", 0.1],
  ["pjHm", 0.1],
  ["pjArW", 1],
  ["pjArH", 1],
  ["pjOx", 0.5],
  ["pjOy", 0.5],
  ["pjGrid", 10],
  ["pjDome", 128],
  ["pjCanW", 1],
  ["pjCanH", 1],
  ["pjOxPx", 1],
  ["pjOyPx", 1],
  ["tvW", 1],
  ["tvH", 1],
  ["tvNx", 1],
  ["tvNy", 1],
  ["tvDiag", 1],
  ["pxW", 1],
  ["pxH", 1],
  ["pxCmW", 0.5],
  ["pxCmH", 0.5],
  ["pxCols", 1],
  ["pxRows", 1],
  ["pxSx", 1],
  ["pxSy", 1],
  ["pxWm", 0.1],
  ["pxHm", 0.1],
  ["pjFov", 5],
  ["pjAz", 1],
  ["pjEl", 1],
  // 2.0.66: волюметрик — свои кнопки ▲▼ как у LED (системные стрелки поля «убегали»)
  ["vlCx", 1],
  ["vlCz", 1],
  ["vlSx", 1],
  ["vlSz", 1],
  ["vlCw", 1],
  ["vlCd", 1],
  ["vlPx", 1],
  ["vlLen", 0.5],
  ["fX", 1],
  ["fY", 1],
  ["shapeW", 8],
  ["shapeH", 8],
  ["shapeWcm", 1],
  ["shapeHcm", 1],
  ["shapeLW", 1],
  ["shapeN", 8]
].forEach(([id, st]) => {
  if ($(id)) stepInput(id, st);
});
stepper("cols", (d) => stepCabs("w", d));
stepper("rows", (d) => stepCabs("h", d));
stepper("physW", (d) => stepCabs("w", d));
stepper("physH", (d) => stepCabs("h", d));
// 2.0.138: наши ▲▼ — везде, вместо маленьких системных стрелок: все числовые поля и поля с формулой (мэппинг).
// Шаг — из атрибута step (иначе 1). Поля, у которых свои кнопки, уже обёрнуты — их не трогаем.
function stepAll(root) {
  for (const i of (root || document).querySelectorAll('input[type="number"], input.calc')) {
    if (i.closest(".stp") || i.hidden) continue;
    const st = parseFloat(i.getAttribute("step"));
    stepInput(i, st > 0 ? st : 1);
  }
}
stepAll();
(function keepPanelScroll() {
  // 2.0.35: страж из рабочей Mac-сборки 2.0.16 — если панель без участия человека прыгнула в самый верх, возвращаем.
  // Основное исправление — не трогать панель без нужды (setTxt / setVal / setHtml, status) и стили .status / .panel.
  const pn = document.querySelector(".panel");
  if (!pn) return;
  let last = 0, userAt = 0, drag = false;
  const mark = () => {
    userAt = Date.now();
  };
  ["wheel", "touchstart", "touchmove", "keydown"].forEach((t) => pn.addEventListener(t, mark, { passive: true }));
  pn.addEventListener("mousedown", (e) => {
    if (e.target === pn) {
      drag = true;
      mark();
    }
  });
  window.addEventListener("mouseup", () => {
    if (drag) {
      drag = false;
      mark();
    }
  });
  window.addEventListener("mousemove", () => {
    if (drag) mark();
  });
  if (QS.get("noguard")) return;
  if (window.matchMedia && !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  let fixedAt = 0;
  pn.addEventListener("scroll", () => {
    const t = pn.scrollTop, now = Date.now();
    if (t < 2 && last > 40 && !drag && now - userAt > 600 && now - fixedAt > 400 && window.innerWidth > 820) {
      fixedAt = now;
      pn.scrollTop = last;
      return;
    }
    last = t;
  }, { passive: true });
})();
if (QS.get("diag")) {
  const box = document.createElement("pre");
  box.style.cssText = "position:fixed;left:4px;bottom:4px;z-index:99;max-width:70vw;max-height:40vh;overflow:auto;margin:0;padding:6px;background:rgba(0,0,0,.85);color:#7CFC9A;font:11px/1.3 monospace;pointer-events:none;white-space:pre-wrap";
  document.body.appendChild(box);
  const lg = (t) => {
    box.textContent = (t + "\n" + box.textContent).slice(0, 3e3);
  };
  const nm = (el) => el ? el.id ? "#" + el.id : el.tagName : "-";
  lg("UA ".concat(navigator.userAgent.slice(0, 90), "\nCS=").concat(typeof CompressionStream, " pako=").concat(!!window.pako, " PE=").concat(typeof PointerEvent, " hover=").concat(matchMedia("(hover: hover)").matches, " coarse=").concat(matchMedia("(pointer: coarse)").matches));
  ["focusin", "focusout", "keydown", "beforeinput", "input", "touchstart", "mousedown", "click"].forEach((t) => document.addEventListener(t, (e) => lg("".concat(t, " ").concat(nm(e.target)).concat(e.key ? " key=" + e.key : "").concat(e.inputType ? " " + e.inputType : "", " prevented=").concat(e.defaultPrevented, " active=").concat(nm(document.activeElement))), true));
  ["touchstart", "mousedown", "keydown", "beforeinput"].forEach((t) => document.addEventListener(t, (e) => {
    if (e.defaultPrevented) lg("!! ".concat(t, " отменён"));
  }, false));
  window.addEventListener("error", (e) => lg("ERR " + e.message));
}
// Ручки выбранной фигуры (в пикселях холста, с учётом поворота)
function shapeHandles(c, cx, cy, s) {
  const rx = c.w / 2 * s, ry = c.h / 2 * s, P = (lx, ly) => {
    const [X, Y] = rotPt(c, lx, ly);
    return [cx + X, cy + Y];
  };
  const out = [{ k: "rot", p: P(0, -ry - 34), base: P(0, -ry) }];
  if (c.t === "trap") out.push({ k: "top", p: P(...trapLocal(c, rx, ry)) });
  if (c.t === "round" || c.t === "trap" || c.t === "pent") {
    const rr = (shapeR(c) || 0) * s;
    out.push({ k: "rad", p: P(rx - Math.max(rr, 10), c.t === "round" ? -ry : ry + 18) });
  }
  out.push({ k: "size", m: "wh", p: P(rx, ry) }, { k: "size", m: "w", p: P(rx, 0) }, { k: "size", m: "h", p: P(0, ry) });
  return out;
}
// Точки своей фигуры: A — узел, I/O — ручки выбранного узла
function bezHandles(c, cx, cy, s) {
  const rx = c.w / 2 * s, ry = c.h / 2 * s, P = (lx, ly) => {
    const [X, Y] = rotPt(c, lx, ly);
    return [cx + X, cy + Y];
  };
  const out = [];
  (c.pts || []).forEach((q, i) => {
    const a = P(q.x * rx, q.y * ry);
    if (i === ui.bezSel) {
      for (const [k, hx, hy] of [["I", q.ix, q.iy], ["O", q.ox, q.oy]]) if (Math.abs(hx - q.x) + Math.abs(hy - q.y) > 1e-6) out.push({ k, i, p: P(hx * rx, hy * ry), a });
    }
    out.push({ k: "A", i, p: a });
  });
  return out;
}
// Подогнать рамку своей фигуры под её контур (после правки точек)
function bezNormalize(c) {
  const hw = c.w / 2, hh = c.h / 2, fl = bezFlat(c.pts, hw, hh);
  if (!fl.length) return;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of fl) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, nw = Math.max(4, x1 - x0), nh = Math.max(4, y1 - y0);
  for (const q of c.pts) for (const [a, b] of [["x", "y"], ["ix", "iy"], ["ox", "oy"]]) {
    q[a] = (q[a] * hw - mx) / (nw / 2);
    q[b] = (q[b] * hh - my) / (nh / 2);
  }
  const [dx, dy] = rotPt(c, mx, my);
  Object.assign(c, { x: c.x + dx, y: c.y + dy, w: nw, h: nh });
}
function bezFinish() {
  const d = ui.bezDraw && ui.bezDraw.pts;
  if (!d) return;
  if (d.length < 3) {
    status("Нужно хотя бы 3 точки", true);
    return;
  }
  const st = S(), pts = d.map((q) => ({ ...q })), c = { t: "bez", pts, x: 0, y: 0, w: 2, h: 2, rot: 0, r: 0, lock: false, inv: false, dimOnly: true, frame: false };
  bezNormalize(c);
  (st.cacheShapes || (st.cacheShapes = [])).push(c);
  ui.bezDraw = null;
  ui.bezHover = null;
  ui.selShape = st.cacheShapes.length - 1;
  ui.bezSel = -1;
  syncShapes();
  changed();
  status("Своя фигура готова: точки двигаются, двойной щелчок по точке — острый/плавный угол, по линии — новая точка", true);
}
function bezCancel() {
  ui.bezDraw = null;
  ui.bezHover = null;
  syncShapes();
  requestDraw();
  status("Рисование фигуры отменено", true);
}
function bezDeletePoint() {
  const c = S().cacheShapes[ui.selShape];
  if (!c || c.t !== "bez" || ui.bezSel < 0) return;
  if (c.pts.length <= 3) {
    status("У фигуры должно остаться хотя бы 3 точки", true);
    return;
  }
  c.pts.splice(ui.bezSel, 1);
  ui.bezSel = -1;
  bezNormalize(c);
  syncShapes();
  changed();
}
// Двойной щелчок: по точке — острый/плавный угол, по линии — новая точка
function bezDblClick(x, y) {
  const st = S(), c = (st.cacheShapes || [])[ui.selShape];
  if (!c || c.t !== "bez" || !L) return false;
  const s = L.scale, cx = L.ox + c.x * s, cy = L.oy + c.y * s, hw = c.w / 2, hh = c.h / 2, n = c.pts.length;
  const A = bezHandles(c, cx, cy, s).find((q) => q.k === "A" && Math.hypot(x - q.p[0], y - q.p[1]) <= 11);
  if (A) {
    const q = c.pts[A.i];
    if (q.sm || Math.abs(q.ix - q.x) + Math.abs(q.iy - q.y) + Math.abs(q.ox - q.x) + Math.abs(q.oy - q.y) > 1e-6) Object.assign(q, { ix: q.x, iy: q.y, ox: q.x, oy: q.y, sm: false });
    else {
      const a = c.pts[(A.i + n - 1) % n], b = c.pts[(A.i + 1) % n];
      let dx = (b.x - a.x) * hw, dy = (b.y - a.y) * hh;
      const dl = Math.hypot(dx, dy) || 1e-9;
      dx /= dl;
      dy /= dl;
      const l1 = Math.hypot((q.x - a.x) * hw, (q.y - a.y) * hh) / 3, l2 = Math.hypot((b.x - q.x) * hw, (b.y - q.y) * hh) / 3;
      Object.assign(q, { ix: q.x - dx * l1 / hw, iy: q.y - dy * l1 / hh, ox: q.x + dx * l2 / hw, oy: q.y + dy * l2 / hh, sm: true });
    }
    ui.bezSel = A.i;
    bezNormalize(c);
    syncShapes();
    changed();
    return true;
  }
  // ближайшая точка на кривой
  const [lx, ly] = unrotPt(c, (x - cx) / s, (y - cy) / s), segs = bezSegs(c.pts, hw, hh);
  let best = { d: Infinity };
  segs.forEach((sg, i) => {
    for (let k = 0; k <= 40; k++) {
      const t = k / 40, [px, py] = bezAt(sg, t), d = Math.hypot(px - lx, py - ly);
      if (d < best.d) best = { d, i, t };
    }
  });
  if (best.d * s > 12) return false;
  // разрез кривой Безье в точке t (де Кастельжо)
  const [p0, p1, p2, p3] = segs[best.i], t = best.t, L2 = (a, b) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const q01 = L2(p0, p1), q12 = L2(p1, p2), q23 = L2(p2, p3), r0 = L2(q01, q12), r1 = L2(q12, q23), m = L2(r0, r1);
  const a = c.pts[best.i], b = c.pts[(best.i + 1) % n];
  a.ox = q01[0] / hw;
  a.oy = q01[1] / hh;
  b.ix = q23[0] / hw;
  b.iy = q23[1] / hh;
  c.pts.splice(best.i + 1, 0, { x: m[0] / hw, y: m[1] / hh, ix: r0[0] / hw, iy: r0[1] / hh, ox: r1[0] / hw, oy: r1[1] / hh, sm: true });
  ui.bezSel = best.i + 1;
  syncShapes();
  changed();
  return true;
}
function drawCachePreview(st, s) {
  const R = st.cacheRef;
  if (R && R.show !== false && (!st.kind || st.kind === "led")) {
    const im = refImg(R.id);
    if (im) {
      const [x, y, w, h] = refRect(st);
      if (ui.refEdit) {
        const X = L.ox + x * s, Y = L.oy + y * s, Wd = w * s, Hd = h * s;
        pctx.save();
        pctx.strokeStyle = "#C77DFF";
        pctx.lineWidth = 2;
        pctx.setLineDash([7, 4]);
        pctx.strokeRect(X, Y, Wd, Hd);
        pctx.setLineDash([]);
        pctx.fillStyle = "#C77DFF";
        pctx.strokeStyle = "#000";
        pctx.lineWidth = 1;
        for (const [, fx, fy] of REF_HANDLES) {
          pctx.fillRect(X + Wd * fx - 6, Y + Hd * fy - 6, 12, 12);
          pctx.strokeRect(X + Wd * fx - 6, Y + Hd * fy - 6, 12, 12);
        }
        pctx.restore();
      }
    }
  }
  const dot = (p, r, fill) => {
    pctx.fillStyle = fill;
    pctx.beginPath();
    pctx.arc(p[0], p[1], r, 0, Math.PI * 2);
    pctx.fill();
    pctx.stroke();
  };
  if (ui.bezDraw) {
    // фигура в процессе рисования
    const d = ui.bezDraw.pts, P = (x, y) => [L.ox + x * s, L.oy + y * s];
    pctx.save();
    pctx.strokeStyle = "#ffff00";
    pctx.lineWidth = 2;
    if (d.length) {
      pctx.beginPath();
      pctx.moveTo(...P(d[0].x, d[0].y));
      for (let i = 1; i < d.length; i++) pctx.bezierCurveTo(...P(d[i - 1].ox, d[i - 1].oy), ...P(d[i].ix, d[i].iy), ...P(d[i].x, d[i].y));
      pctx.stroke();
      if (ui.bezHover && !act) {
        const l = d[d.length - 1];
        pctx.setLineDash([5, 4]);
        pctx.beginPath();
        pctx.moveTo(...P(l.x, l.y));
        pctx.bezierCurveTo(...P(l.ox, l.oy), ...P(ui.bezHover[0], ui.bezHover[1]), ...P(ui.bezHover[0], ui.bezHover[1]));
        pctx.stroke();
        pctx.setLineDash([]);
      }
      const l = d[d.length - 1];
      pctx.strokeStyle = "#3EC6FF";
      pctx.lineWidth = 1;
      if (l.sm) {
        pctx.beginPath();
        pctx.moveTo(...P(l.ix, l.iy));
        pctx.lineTo(...P(l.ox, l.oy));
        pctx.stroke();
        dot(P(l.ix, l.iy), 4, "#3EC6FF");
        dot(P(l.ox, l.oy), 4, "#3EC6FF");
      }
      pctx.strokeStyle = "#000";
      d.forEach((q, i) => {
        const [px, py] = P(q.x, q.y), r = i === 0 && d.length >= 3 ? 8 : 5;
        pctx.fillStyle = i === 0 && d.length >= 3 ? "#1ec8b4" : "#fff";
        pctx.fillRect(px - r, py - r, r * 2, r * 2);
        pctx.strokeRect(px - r, py - r, r * 2, r * 2);
      });
    }
    pctx.restore();
  }
  const sc = (st.cacheShapes || [])[ui.selShape];
  if (sc) {
    pctx.save();
    pctx.strokeStyle = "#ffff00";
    pctx.lineWidth = 2;
    pctx.setLineDash([6, 4]);
    pctx.beginPath();
    const cx = L.ox + sc.x * s, cy = L.oy + sc.y * s, rx = sc.w / 2 * s, ry = sc.h / 2 * s;
    shapePath(pctx, sc, cx, cy, rx + 4, ry + 4);
    pctx.stroke();
    pctx.setLineDash([]);
    pctx.strokeStyle = "#000";
    pctx.lineWidth = 1;
    for (const h of shapeHandles(sc, cx, cy, s)) {
      if (h.k === "size") {
        pctx.fillStyle = "#ffff00";
        pctx.fillRect(h.p[0] - 6, h.p[1] - 6, 12, 12);
        pctx.strokeRect(h.p[0] - 6, h.p[1] - 6, 12, 12);
      } else if (h.k === "rot") {
        pctx.strokeStyle = "#7CFC9A";
        pctx.beginPath();
        pctx.moveTo(...h.base);
        pctx.lineTo(...h.p);
        pctx.stroke();
        pctx.strokeStyle = "#000";
        dot(h.p, 7, "#7CFC9A");
      } else dot(h.p, 7, h.k === "top" ? "#3EC6FF" : "#FF9500");
    }
    if (sc.t === "bez") {
      for (const h of bezHandles(sc, cx, cy, s)) {
        if (h.k === "A") {
          const sel = h.i === ui.bezSel;
          pctx.fillStyle = sel ? "#1ec8b4" : "#fff";
          pctx.fillRect(h.p[0] - 5, h.p[1] - 5, 10, 10);
          pctx.strokeRect(h.p[0] - 5, h.p[1] - 5, 10, 10);
        } else {
          pctx.strokeStyle = "#3EC6FF";
          pctx.beginPath();
          pctx.moveTo(...h.a);
          pctx.lineTo(...h.p);
          pctx.stroke();
          pctx.strokeStyle = "#000";
          dot(h.p, 5, "#3EC6FF");
        }
      }
    }
    pctx.fillStyle = "#ffff00";
    pctx.beginPath();
    pctx.arc(cx, cy, 11, 0, Math.PI * 2);
    pctx.fill();
    pctx.stroke();
    pctx.beginPath();
    pctx.moveTo(cx - 6, cy);
    pctx.lineTo(cx + 6, cy);
    pctx.moveTo(cx, cy - 6);
    pctx.lineTo(cx, cy + 6);
    pctx.lineWidth = 2;
    pctx.stroke();
    pctx.restore();
  }
}
function normRot(d) {
  d = Math.round(((d % 360) + 540) % 360 - 180);
  return d === -180 ? 180 : d;
}
function bezLoad(pts) {
  if (!Array.isArray(pts) || pts.length < 3) return null;
  const f = (v) => isFinite(+v) ? Math.max(-50, Math.min(50, +v)) : 0;
  return pts.slice(0, 200).map((p) => ({ x: f(p.x), y: f(p.y), ix: f(p.ix != null ? p.ix : p.x), iy: f(p.iy != null ? p.iy : p.y), ox: f(p.ox != null ? p.ox : p.x), oy: f(p.oy != null ? p.oy : p.y), sm: !!p.sm }));
}
function shapeName(c) {
  if (c.t === "bez") return "Своя";
  if (c.t === "trap") return "Трапеция";
  if (c.t === "pent") return "Пентагон";
  return c.t === "round" ? shapeR(c) ? "Суперэллипс" : c.lock ? "Квадрат" : "Прямоугольник" : c.lock ? "Круг" : "Овал";
}
// Голубая ручка трапеции — свободный конец верхнего (при «Перевернуть» — нижнего) короткого основания (без поворота, от центра)
function trapLocal(c, rx, ry) {
  const tw = rx * trapTb(c), sk = trapSk(c), off = (rx - tw) * sk;
  return [sk > 0 ? -tw + off : tw + off, c.flip ? ry : -ry];
}
function mmPerPx(st) {
  const [w, h] = typeMM(st);
  return [w / Math.max(1, st.cabWpx), h / Math.max(1, st.cabHpx)];
}
function syncShapes() {
  if ($("shapePaste")) {
    $("shapePaste").disabled = !ui.shapeClip;
    $("shapePaste").title = ui.shapeClip ? "Вставить: " + ui.shapeClip.list.map(shapeName).join(", ") + " (Ctrl / ⌘ + V)" : "Сначала скопируйте фигуру";
  }
  const st = S(), list = st.cacheShapes || (st.cacheShapes = []), sel = $("shapeSel");
  if (ui.selShape >= list.length) ui.selShape = list.length - 1;
  setHtml(sel, '<option value="-1">'.concat(list.length ? "— не выбран" : "Фигур нет", "</option>") + list.map((c2, i) => '<option value="'.concat(i, '">').concat(shapeName(c2), " ").concat(i + 1).concat(c2.frame ? " (рамка)" : c2.inv ? " (инверсия)" : "", " · ").concat(c2.lock ? "⌀ " + Math.round(c2.w) : Math.round(c2.w) + "×" + Math.round(c2.h), " px</option>")).join(""));
  setVal(sel, String(ui.selShape));
  const c = list[ui.selShape];
  for (const [id, k] of [["shapeW", "w"], ["shapeH", "h"]]) {
    if (document.activeElement !== $(id)) setVal($(id), c ? Math.round(c[k]) : "");
    $(id).disabled = !c;
  }
  $("shapeLock").checked = c ? !!c.lock : true;
  $("shapeLock").disabled = !c;
  {
    // 3.0.3: заливка цветом — у выбранной фигуры (ничего не выбрано — показываем первую, меняются все)
    const cc = c || list[0], on = !!(cc && cc.fill);
    $("shapeFill").checked = on;
    $("shapeFill").disabled = !list.length;
    setVal($("shapeFC"), ((cc && cc.fc) || "#FF0000").toLowerCase());
    const fa = cc && cc.fill && +cc.fa > 0 ? +cc.fa : 50;
    if (document.activeElement !== $("shapeFA")) setVal($("shapeFA"), fa);
    $("shapeFAV").textContent = fa + "%";
    $("shapeFC").disabled = $("shapeFA").disabled = !on;
  }
  $("shapeInv").checked = !!(c && c.inv);
  $("shapeInv").disabled = !c || !!c.frame;
  $("shapeDel").disabled = !c;
  {
    const cc = c || list[0], m = !cc ? "" : cc.frame ? "frame" : cc.dimOnly ? "dim" : "off";
    document.querySelectorAll(".seg.shapeMode button").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.m === m));
      b.disabled = !list.length;
    });
  }
  {
    const [mx, my] = mmPerPx(st);
    for (const [id, k, f] of [["shapeWcm", "w", mx], ["shapeHcm", "h", my]]) {
      if (document.activeElement !== $(id)) setVal($(id), c ? +(c[k] * f / 10).toFixed(1) : "");
      $(id).disabled = !c;
    }
  }
  const t = ui.shapeType;
  document.querySelectorAll(".seg.shapeType button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.t === t)));
  {
    const R = st.cacheRef;
    $("refBox").hidden = !R;
    $("refDel").disabled = !R;
    if (R) {
      document.querySelectorAll(".seg.refFit button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.f === R.fit)));
      $("refKeep").checked = !!R.keep;
      $("refShow").checked = R.show !== false;
      setVal($("refAlpha"), 100 - (R.a == null ? 50 : R.a));
      setTxt($("refAlphaV"), 100 - (R.a == null ? 50 : R.a) + "%");
      const im = refImg(R.id);
      const [rx, ry, rw, rh] = refRect(st);
      for (const [id, v] of [["refX", rx], ["refY", ry], ["refW", rw], ["refH", rh]]) if (document.activeElement !== $(id)) setVal($(id), Math.round(v));
      $("refEdit").checked = !!ui.refEdit;
      setTxt($("refInfo"), (im ? "Картинка ".concat(im.naturalWidth, "×").concat(im.naturalHeight, " px · ") : "") + (R.fit === "free" ? "положение задано вручную" : R.fit === "cab" ? "кабинеты: колонки ".concat(R.c0 + 1, "–").concat(R.c1 + 1, ", ряды ").concat(R.r0 + 1, "–").concat(R.r1 + 1) : "весь экран"));
    }
  }
  $("shapeNRow").hidden = !(c && c.t !== "circle" && c.t !== "bez");
  $("shapeRotRow").hidden = !c;
  if (c && document.activeElement !== $("shapeRot")) setVal($("shapeRot"), Math.round(+c.rot || 0));
  $("shapeBezDraw").hidden = !ui.bezDraw;
  $("shapeBezEdit").hidden = !(c && c.t === "bez");
  $("shapeBezDel").disabled = !(c && c.t === "bez" && ui.bezSel >= 0);
  $("shapeAdd").disabled = !!ui.bezDraw;
  for (const id of ["shapeTbRow", "shapeSkRow", "shapeFlipRow"]) $(id).hidden = !(c && c.t === "trap");
  if (c && c.t === "trap") {
    if (document.activeElement !== $("shapeTb")) setVal($("shapeTb"), Math.round(trapTb(c) * 100));
    if (document.activeElement !== $("shapeSk")) setVal($("shapeSk"), Math.round(trapSk(c) * 100));
    $("shapeFlip").checked = !!c.flip;
  }
  if (document.activeElement !== $("shapeN")) setVal($("shapeN"), c ? Math.round(shapeR(c) || 0) : "");
  $("shapeLine").checked = st.cacheLine !== false;
  if (document.activeElement !== $("shapeLW")) setVal($("shapeLW"), st.cacheLineW || 6);
  setVal($("shapeLC"), (st.cacheLineColor || "#FFFFFF").toLowerCase());
  {
    const a = st.cacheLineA == null ? 100 : st.cacheLineA;
    setVal($("shapeLA"), a);
    setTxt($("shapeLAV"), a + "%");
  }
  {
    const dm = st.cacheDim == null ? 45 : st.cacheDim;
    setVal($("shapeDim"), dm);
    setTxt($("shapeDimV"), dm + "%");
  }
}
$("shapeAdd").onclick = () => {
  if (ui.shapeType === "bez") {
    ui.bezDraw = { pts: [] };
    ui.bezHover = null;
    ui.selShape = -1;
    ui.selected.clear();
    syncShapes();
    requestDraw();
    status("Своя фигура: щёлкайте по холсту — точки, потяните — изгиб; щелчок по первой точке или Enter — замкнуть", true);
    return;
  }
  const st = S(), { xs, ys } = grid(st), [W, H] = dims(st);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const k of ui.selected) {
    const p = parseKey(k);
    if (!p) continue;
    x0 = Math.min(x0, xs[p[0]]);
    x1 = Math.max(x1, xs[p[0] + 1]);
    y0 = Math.min(y0, H - ys[p[1] + 1]);
    y1 = Math.max(y1, H - ys[p[1]]);
  }
  const c = isFinite(x0) ? { x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: Math.min(x1 - x0, y1 - y0), h: Math.min(x1 - x0, y1 - y0), lock: true, inv: false } : { x: W / 2, y: H / 2, w: Math.round(Math.min(W, H) / 3), h: Math.round(Math.min(W, H) / 3), lock: true, inv: false };
  // первая фигура экрана: прежнее затемнение по умолчанию (35%) → новое 45%
  if (!(st.cacheShapes || []).length && (st.cacheDim == null || +st.cacheDim === 35)) st.cacheDim = 45;
  Object.assign(c, { dimOnly: true, rot: 0, t: ui.shapeType, r: Math.round(Math.min(c.w, c.h) * (ui.shapeType === "round" ? 0.2 : 0.06)), frame: false });
  if (c.t === "trap") Object.assign(c, { tb: 60, sk: 0, flip: false });
  (st.cacheShapes || (st.cacheShapes = [])).push(c);
  ui.selShape = st.cacheShapes.length - 1;
  ui.selected.clear();
  syncShapes();
  changed();
  status("Добавлено: ".concat(shapeName(c), " — двигайте на холсте, растягивайте за квадратики"), true);
};
// ---- 3.0.2: копирование фигур — кнопки, ПКМ, Ctrl / ⌘ + C / V / D; в любую маску с фигурами
// и в другой проект: в другой маске фигура встаёт на то же место относительно маски, не влезает — уменьшается.
// Фигуры каше есть у масок LED и проекции
const shapesHere = (st) => !!st && (!st.kind || st.kind === "led" || st.kind === "proj");
function shapeCopySel() {
  const st = S(), c = (st.cacheShapes || [])[ui.selShape];
  if (!c) return status("Выберите фигуру в списке «Фигура» — потом «Копировать»", true);
  const [W, H] = dims(st);
  ui.shapeClip = { uid: st.uid, W, H, list: [JSON.parse(JSON.stringify(c))] };
  ui.lastClip = "shape";
  syncShapes();
  status(shapeName(c) + " скопирован(а) — «Вставить» или Ctrl+V, можно в другую маску", true);
}
function shapePaste(clip, dup) {
  const st = S();
  if (!clip || !clip.list.length) return status("Сначала скопируйте фигуру", true);
  if (!shapesHere(st)) return status("В этой маске нет фигур каше", true);
  const [W, H] = dims(st), same = clip.uid === st.uid && clip.W === W && clip.H === H;
  const off = Math.max(8, Math.round(Math.min(W, H) * 0.03));
  if (!(st.cacheShapes || []).length && (st.cacheDim == null || +st.cacheDim === 35)) st.cacheDim = 45;
  const list = st.cacheShapes || (st.cacheShapes = []);
  for (const src of clip.list) {
    const c = JSON.parse(JSON.stringify(src));
    if (same) {
      c.x = Math.min(W, (+c.x || 0) + off);
      c.y = Math.min(H, (+c.y || 0) + off);
    } else {
      // другая маска: то же место относительно маски; больше маски — уменьшаем пропорционально
      c.x = Math.round((+c.x || 0) / (clip.W || W) * W);
      c.y = Math.round((+c.y || 0) / (clip.H || H) * H);
      const k = Math.min(1, W / Math.max(1, c.w), H / Math.max(1, c.h));
      if (k < 1) {
        c.w = Math.max(4, Math.round(c.w * k));
        c.h = Math.max(4, Math.round(c.h * k));
        if (c.r) c.r = Math.round(c.r * k);
      }
    }
    list.push(c);
  }
  ui.selShape = list.length - 1;
  ui.selected.clear();
  syncShapes();
  changed();
  const c = list[ui.selShape];
  status(dup ? "Копия: " + shapeName(c) + " " + list.length : shapeName(c) + " вставлен(а)" + (same ? "" : " — на то же место относительно маски"), true);
}
function shapeDup() {
  const st = S(), c = (st.cacheShapes || [])[ui.selShape];
  if (!c) return status("Выберите фигуру в списке «Фигура»", true);
  const [W, H] = dims(st);
  shapePaste({ uid: st.uid, W, H, list: [c] }, true);
}
// фигура под курсором (верхняя): точка внутри повёрнутого прямоугольника фигуры
function shapeAt(st, x, y) {
  if (!L || !shapesHere(st)) return -1;
  const list = st.cacheShapes || [], s0 = L.scale;
  for (let i = list.length - 1; i >= 0; i--) {
    const c = list[i], a = -(+c.rot || 0) * Math.PI / 180, dx = (x - L.ox) / s0 - c.x, dy = (y - L.oy) / s0 - c.y;
    const u = dx * Math.cos(a) - dy * Math.sin(a), v = dx * Math.sin(a) + dy * Math.cos(a);
    if (Math.abs(u) <= c.w / 2 && Math.abs(v) <= c.h / 2) return i;
  }
  return -1;
}
function ctxShape(e, i) {
  const st = S();
  ui.selShape = i;
  syncShapes();
  requestDraw();
  showCtx(e.clientX, e.clientY, [
    { label: "Копировать", fn: shapeCopySel },
    { label: "Вставить", disabled: !ui.shapeClip, fn: () => shapePaste(ui.shapeClip) },
    { label: "Дублировать", fn: shapeDup },
    { sep: true },
    { label: "Удалить", danger: true, fn: () => $("shapeDel").click() }
  ]);
}
// 3.0.3: заливка — выбранной фигуры или всех, если ни одна не выбрана
const fillTargets = () => {
  const list = S().cacheShapes || [], c = list[ui.selShape];
  return c ? [c] : list;
};
$("shapeFill").addEventListener("change", (e) => {
  const ts = fillTargets();
  if (!ts.length) return status("Сначала добавьте фигуру", true);
  for (const t of ts) {
    t.fill = e.target.checked;
    if (t.fill) {
      if (!(+t.fa > 0)) t.fa = +$("shapeFA").value || 50;
      if (!t.fc) t.fc = $("shapeFC").value.toUpperCase();
    }
  }
  syncShapes();
  changed();
});
$("shapeFC").addEventListener("input", (e) => {
  for (const t of fillTargets()) t.fc = e.target.value.toUpperCase();
  changed();
});
$("shapeFA").addEventListener("input", (e) => {
  const v = Math.max(5, Math.min(100, +e.target.value || 50));
  $("shapeFAV").textContent = v + "%";
  for (const t of fillTargets()) if (t.fill) t.fa = v;
  changed();
});
$("shapeCopy").onclick = shapeCopySel;
$("shapePaste").onclick = () => shapePaste(ui.shapeClip);
$("shapeDup").onclick = shapeDup;
$("shapeDel").onclick = () => {
  const st = S();
  if (ui.selShape < 0) return;
  st.cacheShapes.splice(ui.selShape, 1);
  ui.selShape = -1;
  syncShapes();
  changed();
};
$("shapeSel").addEventListener("change", (e) => {
  ui.selShape = +e.target.value;
  ui.bezSel = -1;
  syncShapes();
  requestDraw();
});
for (const [id, k] of [["shapeW", "w"], ["shapeH", "h"]]) $(id).addEventListener("input", (e) => {
  const c = S().cacheShapes[ui.selShape], v = pint(e.target.value, 0);
  if (c && v >= 4) {
    if (c.lock) c.w = c.h = v;
    else c[k] = v;
    syncShapes();
    changed();
  }
});
document.querySelectorAll(".seg.shapeType button").forEach((b) => b.onclick = () => {
  ui.shapeType = b.dataset.t;
  syncShapes();
  status("Форма новой фигуры: ".concat(b.getAttribute("aria-label"), " — нажмите «Добавить фигуру»"), true);
});
document.querySelectorAll(".seg.shapeMode button").forEach((b) => b.onclick = () => {
  const list = S().cacheShapes || [], c = list[ui.selShape], targets = c ? [c] : list;
  if (!targets.length) {
    status("Сначала добавьте фигуру", true);
    return;
  }
  for (const t of targets) {
    t.frame = b.dataset.m === "frame";
    t.dimOnly = b.dataset.m === "dim";
  }
  syncShapes();
  changed();
  status("".concat(c ? shapeName(c) + " " + (ui.selShape + 1) : "Все фигуры", ": снаружи — ").concat(b.textContent.toLowerCase()), true);
});
for (const [id, k, ax] of [["shapeWcm", "w", 0], ["shapeHcm", "h", 1]]) $(id).addEventListener("input", (e) => {
  const st = S(), c = st.cacheShapes[ui.selShape], v = parseFloat(String(e.target.value).replace(",", "."));
  if (!c || !(v > 0)) return;
  const px = Math.max(4, Math.round(v * 10 / mmPerPx(st)[ax]));
  if (c.lock) {
    c.w = c.h = px;
  } else c[k] = px;
  syncShapes();
  changed();
});
$("shapeN").addEventListener("input", (e) => {
  const c = S().cacheShapes[ui.selShape], v = pint(e.target.value, -1);
  if (c && v >= 0) {
    c.r = Math.min(v, Math.floor(Math.min(c.w, c.h) / 2));
    changed();
  }
});
for (const [id, k, lo, hi] of [["shapeTb", "tb", 5, 100], ["shapeSk", "sk", -100, 100]]) $(id).addEventListener("input", (e) => {
  const c = S().cacheShapes[ui.selShape], v = parseFloat(String(e.target.value).replace(",", "."));
  if (!c || c.t !== "trap" || !isFinite(v)) return;
  c[k] = Math.max(lo, Math.min(hi, Math.round(v)));
  changed();
});
$("shapeRot").addEventListener("input", (e) => {
  const c = S().cacheShapes[ui.selShape], v = parseFloat(String(e.target.value).replace(",", "."));
  if (!c || !isFinite(v)) return;
  c.rot = normRot(v);
  changed();
});
for (const [id, d] of [["shapeRotCCW", -15], ["shapeRot0", 0], ["shapeRotCW", 15]]) $(id).onclick = () => {
  const c = S().cacheShapes[ui.selShape];
  if (!c) return;
  c.rot = d ? normRot((+c.rot || 0) + d) : 0;
  syncShapes();
  changed();
};
