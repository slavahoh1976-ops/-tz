// ---- холст: вид входа (Input Selection) и выхода (Output Transformation)
// 2.0.134: вид «Input + Output» — вход и выход рядом (или друг под другом, что крупнее); у каждой панели своя область холста
// ===== 2.0.184: композиция мэппинга, как в Resolume: маска лежит на композиции =====
// Размер: «как у маски» (по умолчанию) или свой. Как маска лежит на композиции (как клип в Resolume, когда композиция больше):
// native — 1:1 по центру (по умолчанию), stretch — растянуть на всю композицию, fitw — пропорционально по ширине, fith — по высоте.
// Слайсы хранятся в координатах маски; на композиции точка (x, y) маски = (cx + x * sx, cy + y * sy).
const COMP_FITS = ["native", "stretch", "fitw", "fith"];
function outComp(o, key) {
  const all = outSources(), S0 = all.find((s) => s.k === (key || o.src));
  if (!S0) return null;
  // размер композиции (одна на все слои): «Как у маски» — как активная маска; «Авто» — ширина = самая большая ширина,
  // высота = самая большая высота среди отмеченных масок (ничего не отмечено — как активная); «Свой» — вписанный
  const act = all.find((s) => s.k === o.src) || S0, lk = outLayerKeys(o).map((k) => all.find((s) => s.k === k)).filter(Boolean), base = lk.length ? lk : [act];
  // 2.0.189: по умолчанию «Авто»
  const mode = ["mask", "auto", "custom"].includes(o.compMode) ? o.compMode : "auto", custom = mode === "custom", fit = COMP_FITS.includes(o.compFit) ? o.compFit : "native";
  const bw = mode === "auto" ? Math.max(...base.map((q) => q.w)) : act.w, bh = mode === "auto" ? Math.max(...base.map((q) => q.h)) : act.h;
  const W = custom ? Math.max(16, Math.min(16384, Math.round(+o.compW || bw))) : bw;
  const H = custom ? Math.max(16, Math.min(16384, Math.round(+o.compH || bh))) : bh;
  let sx = 1, sy = 1;
  if (fit === "stretch") sx = W / S0.w, sy = H / S0.h;
  else if (fit === "fitw") sx = sy = W / S0.w;
  else if (fit === "fith") sx = sy = H / S0.h;
  const mw = S0.w * sx, mh = S0.h * sy;
  // 1:1 — целые пиксели (пиксель в пиксель), иначе — точно по центру
  const x = fit === "native" ? Math.round((W - mw) / 2) : (W - mw) / 2, y = fit === "native" ? Math.round((H - mh) / 2) : (H - mh) / 2;
  return { W, H, x, y, sx, sy, mw: S0.w, mh: S0.h, custom, mode, fit };
}
// точка маски -> точка композиции
const compPt = (CM, px, py) => ({ x: CM.x + px * CM.sx, y: CM.y + py * CM.sy });
function outPanes(o) {
  const R = $("wrap").getBoundingClientRect(), V = ui_out.V, S0 = outSrc(o), scr = outScr(o), cap = 18;
  const CM = outComp(o), dims = (v) => v === "in" ? [CM ? CM.W : 1920, CM ? CM.H : 1080] : [scr.w, scr.h];
  const pad = R.width < 600 ? 16 : 40, views = o.view === "both" ? ["in", "out"] : [o.view];
  const fit = (box, v) => {
    const [W, H] = dims(v), k0 = Math.max(1e-4, Math.min((box.w - pad * 2) / W, (box.h - pad * 2 - cap) / H)), k = k0 * V.z;
    // на входе: W×H — композиция (масштаб kc), маска лежит на ней в (mx, my) с масштабом sx × sy.
    // k — масштаб МАСКИ на экране (всё, что рисуется и щёлкается на входе, — в координатах маски), ry = sy / sx.
    const isIn = v === "in" && CM, sx = isIn ? CM.sx : 1, sy = isIn ? CM.sy : 1;
    return { v, box, W, H, k: k * sx, kc: k, ry: sy / sx, k0, R, mx: isIn ? CM.x : 0, my: isIn ? CM.y : 0, MW: isIn ? CM.mw : W, MH: isIn ? CM.mh : H,
      ox: box.x + (box.w - W * k) / 2 + V.x, oy: box.y + (box.h - cap - H * k) / 2 + V.y };
  };
  if (views.length === 1) return [fit({ x: 0, y: 0, w: R.width, h: R.height }, views[0])];
  const side = [fit({ x: 0, y: 0, w: R.width / 2, h: R.height }, "in"), fit({ x: R.width / 2, y: 0, w: R.width / 2, h: R.height }, "out")];
  const stack = [fit({ x: 0, y: 0, w: R.width, h: R.height / 2 }, "in"), fit({ x: 0, y: R.height / 2, w: R.width, h: R.height / 2 }, "out")];
  const sc = (a) => Math.min(a[0].k0 * a[0].W * a[0].H, a[1].k0 * a[1].W * a[1].H) * Math.min(a[0].k0, a[1].k0);
  return sc(side) >= sc(stack) ? side : stack;
}
const outPaneAt = (px, py) => (ui_out.L || []).find((P) => px >= P.box.x && px <= P.box.x + P.box.w && py >= P.box.y && py <= P.box.y + P.box.h) || (ui_out.L || [])[0];
function drawOutPane(c, o, P, srcOf) {
  c.save();
  c.beginPath();
  c.rect(P.box.x, P.box.y, P.box.w, P.box.h);
  c.clip();
  c.translate(P.ox, P.oy);
  if (P.v === "in") {
    const srcC = srcOf(o.src);
    // композиция: тёмное поле с рамкой; маска лежит на ней со сдвигом (mx, my)
    c.fillStyle = "#0b0d10";
    c.fillRect(0, 0, P.W * P.kc, P.H * P.kc);
    c.strokeStyle = "rgba(255,255,255,0.35)";
    c.lineWidth = 1;
    c.strokeRect(-0.5, -0.5, P.W * P.kc + 1, P.H * P.kc + 1);
    // маска на композиции: сдвиг и (при «растянуть») разный масштаб по высоте
    c.translate(P.mx * P.kc, P.my * P.kc);
    if (P.ry !== 1) c.scale(1, P.ry);
    c.fillStyle = "#000";
    c.fillRect(0, 0, P.MW * P.k, P.MH * P.k);
    if (srcC) c.drawImage(srcC.cv, 0, 0, P.MW * P.k, P.MH * P.k);
    // слайсы на входе — только те, что с активного источника (у остальных координаты в другой маске)
    const selIds = outSelIds(o);
    o.slices.filter((s) => sliceSrc(o, s) === o.src).forEach((s) => {
      const sel = selIds.has(s.id);
      const scrI = o.screens.findIndex((q) => q.id === s.scr);
      // 2.0.167: слайс с точным углом показываем повёрнутой рамкой — так видно, что участок берётся под углом
      const ra = +s.ra || 0;
      c.save();
      if (ra) {
        c.translate((s.ix + s.iw / 2) * P.k, (s.iy + s.ih / 2) * P.k);
        c.rotate(ra * Math.PI / 180);
        c.translate(-(s.ix + s.iw / 2) * P.k, -(s.iy + s.ih / 2) * P.k);
      }
      c.fillStyle = sel ? "rgba(25,197,181,0.28)" : "rgba(25,197,181,0.12)";
      c.fillRect(s.ix * P.k, s.iy * P.k, s.iw * P.k, s.ih * P.k);
      c.strokeStyle = sel ? "#19C5B5" : "rgba(25,197,181,0.8)";
      c.lineWidth = sel ? 2.5 : 1.2;
      c.strokeRect(s.ix * P.k + 0.5, s.iy * P.k + 0.5, s.iw * P.k - 1, s.ih * P.k - 1);
      c.restore();
      if (s.iw * P.k > 40) pill(c, "".concat(s.name, " → ").concat(o.screens[scrI] ? o.screens[scrI].name : "?"), s.ix * P.k + 4, s.iy * P.k + 4, 11, "left", "rgba(0,0,0,0.7)", s.on ? "#fff" : "#888", s.iw * P.k - 8);
      if (sel) {
        c.fillStyle = "#19C5B5";
        for (const [hx, hy] of [[s.ix, s.iy], [s.ix + s.iw, s.iy], [s.ix, s.iy + s.ih], [s.ix + s.iw, s.iy + s.ih]]) c.fillRect(hx * P.k - 5, hy * P.k - 5, 10, 10);
      }
    });
    {
      // 2.0.174: ручка поворота — одна на выбранный слайс или на весь блок (группа / несколько слайсов)
      const rb = sliceRotInfo(o, P.k);
      if (rb && sliceSrc(o, curSlice()) === o.src) {
        c.save();
        if (rb.mem.length > 1) {
          c.setLineDash([6, 5]);
          c.strokeStyle = "rgba(25,197,107,0.7)";
          c.lineWidth = 1;
          c.beginPath();
          c.arc(rb.px * P.k, rb.py * P.k, rb.R * P.k, 0, Math.PI * 2);
          c.stroke();
          c.setLineDash([]);
          c.fillStyle = "#19C56B";
          c.beginPath();
          c.arc(rb.px * P.k, rb.py * P.k, 3, 0, Math.PI * 2);
          c.fill();
        }
        c.strokeStyle = "#19C56B";
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(rb.bx * P.k, rb.by * P.k);
        c.lineTo(rb.hx * P.k, rb.hy * P.k);
        c.stroke();
        c.fillStyle = "#19C56B";
        c.beginPath();
        c.arc(rb.hx * P.k, rb.hy * P.k, 6, 0, Math.PI * 2);
        c.fill();
        c.restore();
      }
    }
    const d = ui_out.drag;
    if (d && d.kind === "new" && d.snap) {
      c.strokeStyle = "#FFD54A";
      c.setLineDash([6, 4]);
      c.lineWidth = 2;
      c.strokeRect(d.snap.x * P.k, d.snap.y * P.k, d.snap.w * P.k, d.snap.h * P.k);
      c.setLineDash([]);
    }
  } else {
    const scr = outScr(o);
    paintOutScreen(c, o, scr, P.k, srcOf, true);
    // 2.0.196: выбранные слайсы видны на выходе так же, как на входе (все, не только главный)
    const s = curSlice(), selIds = outSelIds(o);
    for (const q of o.slices) {
      if (!selIds.has(q.id) || q.scr !== scr.id || q === s) continue;
      const [w, h] = sliceOutWH(q);
      c.fillStyle = "rgba(25,197,181,0.22)";
      c.fillRect(q.ox * P.k, q.oy * P.k, w * P.k, h * P.k);
      c.strokeStyle = "#19C5B5";
      c.lineWidth = 2;
      c.strokeRect(q.ox * P.k + 1, q.oy * P.k + 1, w * P.k - 2, h * P.k - 2);
    }
    if (s && s.scr === scr.id) {
      const [w, h] = sliceOutWH(s);
      if (selIds.size > 1) {
        c.fillStyle = "rgba(25,197,181,0.22)";
        c.fillRect(s.ox * P.k, s.oy * P.k, w * P.k, h * P.k);
      }
      c.strokeStyle = "#19C5B5";
      c.lineWidth = 2.5;
      c.strokeRect(s.ox * P.k, s.oy * P.k, w * P.k, h * P.k);
      c.fillStyle = "#19C5B5";
      for (const [hx, hy] of [[s.ox, s.oy], [s.ox + w, s.oy], [s.ox, s.oy + h], [s.ox + w, s.oy + h]]) c.fillRect(hx * P.k - 5, hy * P.k - 5, 10, 10);
    }
    c.strokeStyle = "rgba(255,255,255,0.4)";
    c.lineWidth = 1;
    c.strokeRect(-0.5, -0.5, scr.w * P.k + 1, scr.h * P.k + 1);
  }
  c.restore();
  c.fillStyle = "#8c9bab";
  c.font = "12px ".concat(FONT);
  const scr = outScr(o), both = o.view === "both";
  const CMt = outComp(o), compT = CMt && (CMt.W !== CMt.mw || CMt.H !== CMt.mh) ? " · композиция ".concat(CMt.W, "×").concat(CMt.H) : "";
  const t = P.v === "in" ? both ? "Input Selection — " + (outSrc(o) ? outSrc(o).name : "источник") + compT : "Input Selection — протяните мышью по кабинетам, чтобы выделить слайс" : both ? "Output Transformation — ".concat(scr.name, " ").concat(scr.w, "×").concat(scr.h) : "Output Transformation — ".concat(scr.name, " ").concat(scr.w, "×").concat(scr.h, " · двигайте слайсы, углы выбранного — размер");
  c.save();
  c.beginPath();
  c.rect(P.box.x, P.box.y, P.box.w, P.box.h);
  c.clip();
  c.fillText(t, P.box.x + 12, P.box.y + P.box.h - 8);
  c.restore();
  if (both && P.v === "out") {
    c.strokeStyle = "rgba(255,255,255,0.12)";
    c.lineWidth = 1;
    c.beginPath();
    if (P.box.x > 0) {
      c.moveTo(P.box.x + 0.5, 0);
      c.lineTo(P.box.x + 0.5, P.box.y + P.box.h);
    } else {
      c.moveTo(0, P.box.y + 0.5);
      c.lineTo(P.box.x + P.box.w, P.box.y + 0.5);
    }
    c.stroke();
  }
}
function drawOut() {
  const o = OC();
  const R = prepCanvas([16, 9]), c = pctx;
  if (!o) {
    c.fillStyle = "#8c9bab";
    c.font = "15px ".concat(FONT);
    c.textAlign = "center";
    c.fillText("Нажмите «+ Мэппинг», чтобы разложить маски по выходам — как Advanced Output в Resolume", R.width / 2, R.height / 2);
    c.textAlign = "left";
    return;
  }
  const panes = ui_out.L = outPanes(o), srcOf = outSrcFactory(4096);
  for (const P of panes) drawOutPane(c, o, P, srcOf);
}
function outPt(e, P) {
  const p = local(e);
  P = P || outPaneAt(p[0], p[1]);
  // на входе — координаты маски (композиция сдвигает маску на mx, my)
  const kc = P.kc || P.k, ry = P.ry || 1;
  return [(p[0] - P.ox - (P.mx || 0) * kc) / P.k, (p[1] - P.oy - (P.my || 0) * kc) / (P.k * ry), p[0], p[1], P];
}
// угол прямоугольника [x, y, w, h] под курсором: [правый?, нижний?] или null
function outCornerR(r, x, y, k) {
  for (const cx of [0, 1]) for (const cy of [0, 1]) if (Math.abs(x - (r[0] + cx * r[2])) * k < 9 && Math.abs(y - (r[1] + cy * r[3])) * k < 9) return [cx, cy];
  return null;
}
// 2.0.168: группы слайсов — слайсы одной группы выбираются и двигаются вместе
const sliceGroup = (o, s) => !s ? [] : s.grp ? o.slices.filter((q) => q.grp === s.grp) : [s];
const sliceRect = (s, v) => v === "in" ? [s.ix, s.iy, s.iw, s.ih] : [s.ox, s.oy, ...sliceOutWH(s)];
function outCorner(s, x, y, k, v, o) {
  if (!s) return null;
  if (v !== "in" && s.scr !== outScr(o).id) return null;
  return outCornerR(sliceRect(s, v || "in"), x, y, k);
}
function outHit(o, x, y, v) {
  if ((v || o.view) === "in") {
    for (let i = o.slices.length - 1; i >= 0; i--) {
      const s = o.slices[i];
      if (sliceSrc(o, s) !== o.src) continue;
      if (x >= s.ix && x <= s.ix + s.iw && y >= s.iy && y <= s.iy + s.ih) return s;
    }
    return null;
  }
  const scr = outScr(o);
  for (let i = o.slices.length - 1; i >= 0; i--) {
    const s = o.slices[i], [w, h] = sliceOutWH(s);
    if (s.scr === scr.id && x >= s.ox && x <= s.ox + w && y >= s.oy && y <= s.oy + h) return s;
  }
  return null;
}
// края выхода и других слайсов на нём — для привязки
function outSnapLines(o, s) {
  const scr = outScr(o), M = outMag(o), X = M.edge ? [0, scr.w] : [], Y = M.edge ? [0, scr.h] : [];
  if (M.outSl) for (const q of o.slices) if (q !== s && q.scr === scr.id) {
    const [qw, qh] = sliceOutWH(q);
    X.push(q.ox, q.ox + qw);
    Y.push(q.oy, q.oy + qh);
  }
  return [X, Y];
}
// 2.0.181: настройки магнита мэппинга (хранятся в самом мэппинге плоскими полями, чтобы сохранялись в проекте)
function outMag(o) {
  const b = (v, d) => typeof v === "boolean" ? v : d;
  const step = Math.max(1, Math.min(4096, Math.round(+o.magStep || 16))), thr = [5, 10, 20].includes(+o.magThr) ? +o.magThr : 10;
  return { on: b(o.magOn, true), cab: b(o.magCab, true), inSl: b(o.magInSl, false), edge: b(o.magEdge, true), outSl: b(o.magOutSl, true), center: b(o.magCenter, false), grid: b(o.magGrid, false), step, thr };
}
// привязка по одной оси: левый (верхний) край, правый (нижний) край или центр слайса — к ближайшей линии в пределах порога
function magAxis(v, len, lines, centers, step, thr) {
  let b = v, bd = thr;
  const tryC = (c) => {
    if (Math.abs(c - v) < bd) {
      bd = Math.abs(c - v);
      b = c;
    }
  };
  for (const t of lines) {
    tryC(t);
    tryC(t - len);
  }
  for (const t of centers) tryC(t - len / 2);
  if (step) {
    tryC(Math.round(v / step) * step);
    tryC(Math.round((v + len) / step) * step - len);
  }
  return Math.round(b);
}
function magPoint(v, lines, step, thr) {
  return magAxis(v, 0, lines, [], step, thr);
}
// линии на входе: края других слайсов того же источника
function outInLines(o, s) {
  const X = [], Y = [];
  for (const q of o.slices) if (q !== s && sliceSrc(o, q) === o.src && !(+q.ra)) {
    X.push(q.ix, q.ix + q.iw);
    Y.push(q.iy, q.iy + q.ih);
  }
  return [X, Y];
}
const snapNear = (v, arr, thr) => {
  let b = v, bd = thr;
  for (const t of arr) if (Math.abs(t - v) < bd) {
    bd = Math.abs(t - v);
    b = t;
  }
  return b;
};
// 2.0.174: выбранные слайсы (с их группами) двигаются и вращаются как один блок
function outSelSlices(o) {
  const cur = curSlice(), ids = new Set([ui_out.sel, ...ui_out.more || []].filter(Boolean)), gs = new Set();
  for (const q of o.slices) if (ids.has(q.id) && q.grp) gs.add(q.grp);
  return o.slices.filter((q) => (ids.has(q.id) || q.grp && gs.has(q.grp)) && sliceSrc(o, q) === o.src || q === cur);
}
const sliceNormA = (v) => Math.round((((v + 180) % 360 + 360) % 360 - 180) * 100) / 100;
// зелёная ручка поворота выбранного слайса / блока на входе (как у кабинетов кольца); блок крутится вокруг общего центра
function sliceRotInfo(o, k) {
  const cur = curSlice();
  if (!cur || cur.on === false) return null;
  const mem = outSelSlices(o), n = mem.length;
  const px = mem.reduce((t, q) => t + q.ix + q.iw / 2, 0) / n, py = mem.reduce((t, q) => t + q.iy + q.ih / 2, 0) / n;
  let R = cur.ih / 2;
  if (n > 1) {
    R = 0;
    for (const q of mem) {
      const a = (+q.ra || 0) * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), qx = q.ix + q.iw / 2 - px, qy = q.iy + q.ih / 2 - py;
      for (const [ux, uy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const rx = ux * q.iw / 2, ry = uy * q.ih / 2;
        R = Math.max(R, Math.hypot(qx + rx * ca - ry * sa, qy + rx * sa + ry * ca));
      }
    }
  }
  const a = (+cur.ra || 0) * Math.PI / 180, d = R + 18 / k;
  return { mem, px, py, R, hx: px + Math.sin(a) * d, hy: py - Math.cos(a) * d, bx: px + Math.sin(a) * R, by: py - Math.cos(a) * R };
}
// повернуть блок слайсов на T градусов вокруг точки (px, py): центры уезжают по дуге, углы ra прибавляются
function sliceRotApply(items, px, py, T) {
  const cs = Math.cos(T * Math.PI / 180), sn = Math.sin(T * Math.PI / 180);
  for (const m of items) {
    const rx = m.cx - px, ry = m.cy - py;
    m.q.ix = Math.round(px + rx * cs - ry * sn - m.q.iw / 2);
    m.q.iy = Math.round(py + rx * sn + ry * cs - m.q.ih / 2);
    m.q.ra = sliceNormA(m.ra + T);
  }
}
function sliceRotateTo(o, ra) {
  const s = curSlice();
  if (!s) return;
  const rb = sliceRotInfo(o, 1);
  if (!rb) return;
  sliceRotApply(rb.mem.map((q) => ({ q, cx: q.ix + q.iw / 2, cy: q.iy + q.ih / 2, ra: +q.ra || 0 })), rb.px, rb.py, ra - (+s.ra || 0));
}
function outPointer(e, type) {
  const o = OC();
  if (!o || !ui_out.L) return;
  const d0 = ui_out.drag, [x, y, px, py, P] = outPt(e, d0 && d0.P), v = P.v;
  if (type === "down") {
    pv.setPointerCapture(e.pointerId);
    ui_out.focus = v;
    if (e.button === 1 || e.button === 2 || e.altKey) {
      ui_out.drag = { kind: "pan", P, px, py, x0: ui_out.V.x, y0: ui_out.V.y };
      return;
    }
    const s = curSlice();
    if (s && v === "in" && s.on !== false) {
      const rb = sliceRotInfo(o, P.k);
      if (rb && Math.hypot(x - rb.hx, y - rb.hy) <= 11 / P.k) {
        ui_out.drag = { kind: "srot", P, s, cx: rb.px, cy: rb.py, a0: +s.ra || 0, mem: rb.mem.map((q) => ({ q, cx: q.ix + q.iw / 2, cy: q.iy + q.ih / 2, ra: +q.ra || 0 })) };
        return;
      }
    }
    const cn = outCorner(s, x, y, P.k, v, o);
    if (cn) {
      // тянем угол: противоположный угол остаётся на месте
      const r = sliceRect(s, v);
      ui_out.drag = { kind: v === "in" ? "resize" : "oresize", P, s, ax: cn[0] ? r[0] : r[0] + r[2], ay: cn[1] ? r[1] : r[1] + r[3], ar: r[2] / r[3] };
      return;
    }
    const h = outHit(o, x, y, v);
    if (h && e.shiftKey && ui_out.sel && ui_out.sel !== h.id) {
      // 2.0.174: как в Keynote — Shift + клик выделяет все слайсы между выбранным и тем, по которому кликнули
      const list = v === "out" ? o.slices.filter((q) => q.scr === h.scr) : o.slices.filter((q) => sliceSrc(o, q) === o.src), i0 = list.findIndex((q) => q.id === ui_out.sel), i1 = list.findIndex((q) => q.id === h.id);
      if (i0 >= 0 && i1 >= 0) {
        ui_out.more = new Set(list.slice(Math.min(i0, i1), Math.max(i0, i1) + 1).map((q) => q.id));
        ui_out.more.delete(ui_out.sel);
        refreshOutPanel();
        requestDraw();
        return;
      }
    }
    if (h && (e.ctrlKey || e.metaKey)) {
      // Cmd/Ctrl + клик — добавить слайс к выбору или убрать (для группировки)
      ui_out.more = ui_out.more || /* @__PURE__ */ new Set();
      if (h.id === ui_out.sel) return;
      if (ui_out.more.has(h.id)) ui_out.more.delete(h.id);
      else ui_out.more.add(h.id);
      refreshOutPanel();
      requestDraw();
      return;
    }
    if (h) {
      if (!(ui_out.more && ui_out.more.has(h.id))) ui_out.more = /* @__PURE__ */ new Set();
      ui_out.sel = h.id;
      if (sliceSrc(o, h) !== o.src) { o.src = sliceSrc(o, h); requestDraw(); }
      const selAll = v === "out" ? outSelList(o) : outSelSlices(o), grp = selAll.includes(h) ? selAll : sliceGroup(o, h);
      ui_out.drag = { kind: "move", P, s: h, px: x, py: y, a: v === "in" ? [h.ix, h.iy] : [h.ox, h.oy], moved: false,
        grp: grp.map((q) => ({ q, ax: v === "in" ? q.ix : q.ox, ay: v === "in" ? q.iy : q.oy })) };
      refreshOutPanel();
    } else if (v === "in") {
      ui_out.drag = { kind: "new", P, x0: x, y0: y, snap: null };
    } else {
      ui_out.sel = "";
      ui_out.drag = { kind: "pan", P, px, py, x0: ui_out.V.x, y0: ui_out.V.y };
      refreshOutPanel();
    }
    requestDraw();
    return;
  }
  const d = ui_out.drag;
  if (type === "move") {
    if (!d) {
      const h = outHit(o, x, y, v), cn = outCorner(curSlice(), x, y, P.k, v, o);
      pv.style.cursor = cn ? cn[0] === cn[1] ? "nwse-resize" : "nesw-resize" : h ? "move" : v === "in" ? "crosshair" : "grab";
      return;
    }
    if (d.kind === "srot") {
      let deg = Math.atan2(x - d.cx, d.cy - y) * 180 / Math.PI;
      if (e.shiftKey) deg = Math.round(deg / 15) * 15;
      // блок слайсов крутится целиком вокруг общего центра; один слайс — вокруг себя
      sliceRotApply(d.mem, d.cx, d.cy, deg - d.a0);
      outChanged(true);
      return;
    }
    if (d.kind === "pan") {
      ui_out.V.x = d.x0 + px - d.px;
      ui_out.V.y = d.y0 + py - d.py;
    } else if (d.kind === "new") d.snap = outInRect(o, d.x0, d.y0, x, y, e, P, null);
    else if (d.kind === "resize") {
      const r = outInRect(o, d.ax, d.ay, x, y, e, P, d.s);
      if (r) Object.assign(d.s, { ix: r.x, iy: r.y, iw: r.w, ih: r.h });
      syncOutSel();
    } else if (d.kind === "oresize") {
      // размер на выходе: углы прилипают к краям выхода и других слайсов (Alt — без привязки), Shift — без пропорций
      const M = outMag(o), free = e.altKey || !M.on, thr = M.thr / P.k, [X, Y] = outSnapLines(o, d.s), scr = outScr(o);
      const st = M.grid ? M.step : 0, CX = M.center ? [scr.w / 2] : [], CY = M.center ? [scr.h / 2] : [];
      let nx = free ? Math.round(x) : magPoint(Math.round(x), X.concat(CX), st, thr), ny = free ? Math.round(y) : magPoint(Math.round(y), Y.concat(CY), st, thr);
      let w = Math.max(1, Math.abs(nx - d.ax)), h = Math.max(1, Math.abs(ny - d.ay));
      if (!e.shiftKey && d.s.keep !== false) {
        if (w / h > d.ar) h = Math.max(1, Math.round(w / d.ar));
        else w = Math.max(1, Math.round(h * d.ar));
        nx = d.ax + (x < d.ax ? -w : w);
        ny = d.ay + (y < d.ay ? -h : h);
      }
      Object.assign(d.s, { ox: Math.min(nx, d.ax), oy: Math.min(ny, d.ay), ow: w, oh: h });
      syncOutSel();
    } else if (d.kind === "move") {
      let nx = Math.round(d.a[0] + x - d.px), ny = Math.round(d.a[1] + y - d.py);
      if (Math.abs(x - d.px) * P.k + Math.abs(y - d.py) * P.k > 3) d.moved = true;
      if (!d.moved) return;
      const M = outMag(o), free = e.altKey || !M.on, thr = M.thr / P.k;
      if (v === "in") {
        // к краям кабинетов и (если включено) к краям соседних слайсов на входе
        const X = [], Y = [];
        if (M.cab) for (const q of outCells(o)) X.push(q.x, q.x + q.w), Y.push(q.y, q.y + q.h);
        if (M.inSl) {
          const [a, b] = outInLines(o, d.s);
          X.push(...a);
          Y.push(...b);
        }
        d.s.ix = free ? nx : magAxis(nx, d.s.iw, X, [], 0, thr);
        d.s.iy = free ? ny : magAxis(ny, d.s.ih, Y, [], 0, thr);
      } else {
        // к краям выхода, соседним слайсам, центру выхода, сетке
        const [w, h] = sliceOutWH(d.s), [X, Y] = outSnapLines(o, d.s), scr = outScr(o), st = M.grid ? M.step : 0;
        d.s.ox = free ? nx : magAxis(nx, w, X, M.center ? [scr.w / 2] : [], st, thr);
        d.s.oy = free ? ny : magAxis(ny, h, Y, M.center ? [scr.h / 2] : [], st, thr);
      }
      // остальные слайсы группы едут на то же смещение
      if (d.grp && d.grp.length > 1) {
        const dx = (v === "in" ? d.s.ix : d.s.ox) - d.a[0], dy = (v === "in" ? d.s.iy : d.s.oy) - d.a[1];
        for (const g of d.grp) {
          if (g.q === d.s) continue;
          if (v === "in") {
            g.q.ix = Math.round(g.ax + dx);
            g.q.iy = Math.round(g.ay + dy);
          } else {
            g.q.ox = Math.round(g.ax + dx);
            g.q.oy = Math.round(g.ay + dy);
          }
        }
      }
      syncOutSel();
    }
    requestDraw();
    return;
  }
  // up
  ui_out.drag = null;
  if (!d) return;
  if (d.kind === "new") {
    if (d.snap) outAddSlice(o, d.snap);
    else requestDraw();
    return;
  }
  if (d.kind === "move" || d.kind === "resize" || d.kind === "oresize") outChanged(true);
}
pv.addEventListener("wheel", (e) => {
  if (ui.page !== "out") return;
  e.preventDefault();
  const V = ui_out.V, p = local(e), P = outPaneAt(p[0], p[1]);
  if (!P) return;
  const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
  const z = Math.max(1, Math.min(40, V.z * Math.max(0.5, Math.min(2, Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0018))))));
  // точка под курсором остаётся на месте
  const kc = P.kc || P.k, ux = (p[0] - P.ox) / kc, uy = (p[1] - P.oy) / kc, k1 = P.k0 * z;
  V.z = z;
  const cx0 = P.box.x + (P.box.w - P.W * k1) / 2, cy0 = P.box.y + (P.box.h - 18 - P.H * k1) / 2;
  V.x = p[0] - ux * k1 - cx0;
  V.y = p[1] - uy * k1 - cy0;
  if (z === 1) V.x = V.y = 0;
  requestDraw();
}, { passive: false });
