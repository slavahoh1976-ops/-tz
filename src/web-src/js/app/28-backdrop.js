// ---- подложка ----
// Прилипание краёв подложки к линиям кабинетов (в пикселях маски)
function refSnapLines(st) {
  if (st.kind === "ring") {
    const [W2, H2] = dims(st);
    return { vx: [0, W2 / 2, W2], vy: [0, H2 / 2, H2] };
  }
  const { xs, ys } = grid(st), [, H] = dims(st);
  return { vx: xs.slice(), vy: ys.map((y) => H - y) };
}
const orV = (a, b) => a === null ? b : a;
function snapTo(v, lines, tol) {
  let best = null;
  for (const l of lines) if (Math.abs(l - v) <= tol && (best === null || Math.abs(l - v) < Math.abs(best - v))) best = l;
  return best;
}
const REF_HANDLES = [["nw", 0, 0], ["n", 0.5, 0], ["ne", 1, 0], ["e", 1, 0.5], ["se", 1, 1], ["s", 0.5, 1], ["sw", 0, 1], ["w", 0, 0.5]];
function refPointerDown(x, y) {
  const st = S(), R = st.cacheRef;
  if (!ui.refEdit || !R || !L || st.kind && st.kind !== "led" && st.kind !== "proj" && st.kind !== "ring") return null;
  const s = L.scale, [rx, ry, rw, rh] = refRect(st), X = L.ox + rx * s, Y = L.oy + ry * s, W = rw * s, H = rh * s;
  for (const [m, fx, fy] of REF_HANDLES) if (Math.abs(x - (X + W * fx)) <= 9 && Math.abs(y - (Y + H * fy)) <= 9) {
    refToFree(st);
    return { kind: "refSize", m, x, y, r0: [rx, ry, rw, rh] };
  }
  if (x >= X && x <= X + W && y >= Y && y <= Y + H) {
    refToFree(st);
    return { kind: "refMove", x, y, r0: [rx, ry, rw, rh] };
  }
  return null;
}
function refPointerMove(a, p, e) {
  const st = S(), R = st.cacheRef;
  if (!R || !L) return;
  const s = L.scale, dx = (p[0] - a.x) / s, dy = (p[1] - a.y) / s, tol = e.altKey ? -1 : 8 / s, { vx, vy } = refSnapLines(st);
  let [x, y, w, h] = a.r0;
  if (a.kind === "refMove") {
    x += dx;
    y += dy;
    const sx0 = snapTo(x, vx, tol), sx1 = snapTo(x + w, vx, tol), sy0 = snapTo(y, vy, tol), sy1 = snapTo(y + h, vy, tol);
    if (sx0 !== null && (sx1 === null || Math.abs(sx0 - x) <= Math.abs(sx1 - x - w))) x = sx0;
    else if (sx1 !== null) x = sx1 - w;
    if (sy0 !== null && (sy1 === null || Math.abs(sy0 - y) <= Math.abs(sy1 - y - h))) y = sy0;
    else if (sy1 !== null) y = sy1 - h;
  } else {
    let x0 = x, y0 = y, x1 = x + w, y1 = y + h;
    const m = a.m;
    if (m.includes("w")) x0 = orV(snapTo(x0 + dx, vx, tol), x0 + dx);
    if (m.includes("e")) x1 = orV(snapTo(x1 + dx, vx, tol), x1 + dx);
    if (m.includes("n")) y0 = orV(snapTo(y0 + dy, vy, tol), y0 + dy);
    if (m.includes("s")) y1 = orV(snapTo(y1 + dy, vy, tol), y1 + dy);
    if (x1 - x0 < 10) m.includes("w") ? x0 = x1 - 10 : x1 = x0 + 10;
    if (y1 - y0 < 10) m.includes("n") ? y0 = y1 - 10 : y1 = y0 + 10;
    const im = refImg(R.id);
    if ((R.keep || e.shiftKey) && im) {
      // пропорции картинки: по углам — по большему изменению, по сторонам — вторая сторона от центра
      const ar = im.naturalWidth / im.naturalHeight;
      let nw = x1 - x0, nh = y1 - y0;
      if (m.length === 2) {
        if (Math.abs(nw - w) / w >= Math.abs(nh - h) / h) nh = nw / ar;
        else nw = nh * ar;
        if (m.includes("w")) x0 = x1 - nw;
        else x1 = x0 + nw;
        if (m.includes("n")) y0 = y1 - nh;
        else y1 = y0 + nh;
      } else if (m === "e" || m === "w") {
        nh = nw / ar;
        y0 = y + h / 2 - nh / 2;
        y1 = y0 + nh;
      } else {
        nw = nh * ar;
        x0 = x + w / 2 - nw / 2;
        x1 = x0 + nw;
      }
    }
    [x, y, w, h] = [x0, y0, x1 - x0, y1 - y0];
  }
  Object.assign(R, { fit: "free", x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
  syncShapes();
  changed();
}
function selCabRange() {
  let c0 = Infinity, c1 = -Infinity, r0 = Infinity, r1 = -Infinity;
  for (const k of ui.selected) {
    const p = parseKey(k);
    if (!p) continue;
    c0 = Math.min(c0, p[0]);
    c1 = Math.max(c1, p[0]);
    r0 = Math.min(r0, p[1]);
    r1 = Math.max(r1, p[1]);
  }
  return isFinite(c0) ? { c0, c1, r0, r1 } : null;
}
$("refLoad").onclick = () => $("refFile").click();
$("refFile").addEventListener("change", async (e) => {
  const f = e.target.files && e.target.files[0];
  e.target.value = "";
  if (!f) return;
  try {
    const url = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(new Error("файл не прочитан"));
      r.readAsDataURL(f);
    });
    const im = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("это не картинка"));
      i.src = url;
    });
    // уменьшаем до 2400 px по большей стороне, чтобы проект оставался лёгким
    const k = Math.min(1, 2400 / Math.max(im.naturalWidth, im.naturalHeight)), cv = document.createElement("canvas");
    cv.width = Math.max(1, Math.round(im.naturalWidth * k));
    cv.height = Math.max(1, Math.round(im.naturalHeight * k));
    cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height);
    let data = cv.toDataURL("image/png");
    if (data.length > 2e6) data = cv.toDataURL("image/jpeg", 0.88);
    const id = "ref" + Date.now().toString(36), st = S(), rg = selCabRange();
    REF_IMGS[id] = data;
    st.cacheRef = { id, fit: rg ? "cab" : "screen", ...rg || { c0: 0, c1: 0, r0: 0, r1: 0 }, a: 50, show: true, keep: false };
    syncShapes();
    changed();
    status(rg ? "Подложка растянута на выделенные кабинеты" : "Подложка растянута на весь экран — для привязки к кабинетам выделите их и нажмите «Кабинеты»", true);
  } catch (err) {
    status("Картинка не загружена: " + err.message, true);
  }
});
$("refDel").onclick = () => {
  const st = S();
  if (!st.cacheRef) return;
  st.cacheRef = null;
  syncShapes();
  changed();
};
document.querySelectorAll(".seg.refFit button").forEach((b) => b.onclick = () => {
  const st = S(), R = st.cacheRef;
  if (!R) return;
  if (b.dataset.f === "cab") {
    const rg = selCabRange();
    if (!rg) {
      status("Сначала выделите кабинеты на холсте, на которые нужно растянуть картинку", true);
      return;
    }
    Object.assign(R, rg, { fit: "cab" });
  } else R.fit = "screen";
  syncShapes();
  changed();
});
// свободное положение подложки: из текущего прямоугольника
function refToFree(st) {
  const R = st.cacheRef;
  if (!R || R.fit === "free") return R;
  const [x, y, w, h] = refRect(st);
  return Object.assign(R, { fit: "free", x, y, w, h });
}
$("refEdit").addEventListener("change", (e) => {
  ui.refEdit = e.target.checked;
  if (ui.refEdit) {
    ui.selShape = -1;
    ui.bezDraw = null;
  }
  syncShapes();
  requestDraw();
  status(ui.refEdit ? "Подложка: тащите за середину, растягивайте за фиолетовые квадратики; края прилипают к кабинетам, Alt — без прилипания" : "Подложка закреплена", true);
});
for (const [id, k] of [["refX", "x"], ["refY", "y"], ["refW", "w"], ["refH", "h"]]) $(id).addEventListener("input", (e) => {
  const st = S(), v = parseFloat(String(e.target.value).replace(",", "."));
  if (!st.cacheRef || !isFinite(v)) return;
  const R = refToFree(st), im = refImg(R.id);
  if ((k === "w" || k === "h") && v < 10) return;
  if (R.keep && im && (k === "w" || k === "h")) {
    const ar = im.naturalWidth / im.naturalHeight;
    if (k === "w") Object.assign(R, { w: v, h: v / ar });
    else Object.assign(R, { h: v, w: v * ar });
  } else R[k] = v;
  syncShapes();
  changed();
});
$("refKeep").addEventListener("change", (e) => {
  const R = S().cacheRef;
  if (!R) return;
  R.keep = e.target.checked;
  changed();
});
$("refShow").addEventListener("change", (e) => {
  const R = S().cacheRef;
  if (!R) return;
  R.show = e.target.checked;
  changed();
});
$("refAlpha").addEventListener("input", (e) => {
  const R = S().cacheRef;
  if (!R) return;
  R.a = 100 - +e.target.value;
  $("refAlphaV").textContent = e.target.value + "%";
  changed();
});
$("shapeBezDone").onclick = () => bezFinish();
$("shapeBezCancel").onclick = () => bezCancel();
$("shapeBezDel").onclick = () => bezDeletePoint();
pv.addEventListener("dblclick", (e) => {
  if (ui.page && ui.page !== "mask") return;
  const [x, y] = local(e);
  if (bezDblClick(x, y)) e.preventDefault();
});
window.addEventListener("keydown", (e) => {
  if (ui.page && ui.page !== "mask") return;
  const t = e.target;
  if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
  if (ui.bezDraw) {
    if (e.key === "Enter") {
      e.preventDefault();
      bezFinish();
    } else if (e.key === "Escape") {
      e.preventDefault();
      bezCancel();
    } else if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      ui.bezDraw.pts.pop();
      requestDraw();
    }
    return;
  }
  const c = (S().cacheShapes || [])[ui.selShape];
  if (c && c.t === "bez" && ui.bezSel >= 0 && (e.key === "Backspace" || e.key === "Delete")) {
    e.preventDefault();
    bezDeletePoint();
  }
});
$("shapeFlip").addEventListener("change", (e) => {
  const c = S().cacheShapes[ui.selShape];
  if (!c || c.t !== "trap") return;
  c.flip = e.target.checked;
  syncShapes();
  changed();
});
$("shapeInv").addEventListener("change", (e) => {
  const c = S().cacheShapes[ui.selShape];
  if (!c) return;
  c.inv = e.target.checked;
  syncShapes();
  changed();
});
$("shapeLock").addEventListener("change", (e) => {
  const c = S().cacheShapes[ui.selShape];
  if (!c) return;
  c.lock = e.target.checked;
  if (c.lock) c.h = c.w;
  syncShapes();
  changed();
});
$("shapeLine").addEventListener("change", (e) => {
  S().cacheLine = e.target.checked;
  changed();
});
$("shapeLW").addEventListener("input", (e) => {
  const v = pint(e.target.value, 0);
  if (v >= 1 && v <= 200) {
    S().cacheLineW = v;
    changed();
  }
});
$("shapeLC").addEventListener("input", (e) => {
  S().cacheLineColor = e.target.value.toUpperCase();
  changed();
});
$("shapeDim").addEventListener("input", (e) => {
  S().cacheDim = +e.target.value;
  $("shapeDimV").textContent = e.target.value + "%";
  changed();
});
$("shapeLA").addEventListener("input", (e) => {
  S().cacheLineA = +e.target.value;
  $("shapeLAV").textContent = e.target.value + "%";
  changed();
});
syncShapes();
{
  let justFocused = null;
  document.addEventListener("focusin", (e) => {
    const t = e.target;
    if (!t || t.tagName !== "INPUT") return;
    if (!(t.type === "number" || t.type === "text" && (t.classList.contains("num") || t.inputMode === "decimal" || t.inputMode === "numeric"))) return;
    if (t.readOnly) return;
    justFocused = t;
    // 2.0.192: выделяем всё, только если ещё ничего не набрали — иначе при занятой программе (большой мэппинг)
    // выделение срабатывало после первых цифр и следующая цифра стирала набранное («2000» → «000»)
    const v0 = t.value;
    setTimeout(() => {
      try {
        if (document.activeElement === t && t.value === v0) t.select();
      } catch (x) {
      }
    }, 0);
  });
  document.addEventListener("mouseup", (e) => {
    if (justFocused && e.target === justFocused) {
      e.preventDefault();
    }
    justFocused = null;
  }, true);
}
// 2.0.74: первый запуск — текущее состояние считаем сохранённым; дальше «несохранённое» помнится между запусками
if (savedHash() == null) markSaved();
else updateProjState();
window.__appReady = true;
if (!STANDALONE) (async () => {
  try {
    downloads = window.claude && window.claude.use ? await window.claude.use("downloads") : null;
  } catch (e) {
    downloads = null;
  }
  if (!downloads) $("exportNote").textContent += " Сохранение файлов доступно, когда страница открыта по ссылке Claude.";
})();
