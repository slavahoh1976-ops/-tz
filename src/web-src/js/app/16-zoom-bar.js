// ===== 2.0.181: единая панель масштаба «− 100% + Авто» во всех разделах =====
ui.cutV = { z: 1, x: 0, y: 0 };
function cutViewClamp(R) {
  const V = ui.cutV;
  R = R || $("wrap").getBoundingClientRect();
  if (V.z <= 1) return Object.assign(V, { z: 1, x: 0, y: 0 });
  V.x = Math.min(0, Math.max(R.width - R.width * V.z, V.x));
  V.y = Math.min(0, Math.max(R.height - R.height * V.z, V.y));
}
// масштаб вида {z, x, y} к точке (px, py) экрана
function viewZoomAt(V, z, px, py) {
  const ux = (px - V.x) / V.z, uy = (py - V.y) / V.z;
  V.z = z;
  V.x = px - ux * z;
  V.y = py - uy * z;
}
let cutDrag = null;
function cutPointer(e, type) {
  const p = local(e);
  if (type === "down") {
    if (ui.cutV.z <= 1) return;
    pv.setPointerCapture(e.pointerId);
    cutDrag = { px: p[0], py: p[1], x0: ui.cutV.x, y0: ui.cutV.y };
    pv.style.cursor = "grabbing";
  } else if (type === "move") {
    if (!cutDrag) {
      pv.style.cursor = ui.cutV.z > 1 ? "grab" : "default";
      return;
    }
    ui.cutV.x = cutDrag.x0 + p[0] - cutDrag.px;
    ui.cutV.y = cutDrag.y0 + p[1] - cutDrag.py;
    requestDraw();
  } else {
    cutDrag = null;
    pv.style.cursor = ui.cutV.z > 1 ? "grab" : "default";
  }
}
pv.addEventListener("wheel", (e) => {
  if (ui.page !== "cut") return;
  e.preventDefault();
  const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
  if (!dy) return;
  const V = ui.cutV, p = local(e);
  viewZoomAt(V, Math.max(1, Math.min(8, V.z * Math.max(0.5, Math.min(2, Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0018)))))), p[0], p[1]);
  cutViewClamp();
  requestDraw();
}, { passive: false });
// какой масштаб у текущего раздела: проценты, «шаг» (к центру окна) и «Авто»
function zoomTarget() {
  const R = $("wrap").getBoundingClientRect(), cx = R.width / 2, cy = R.height / 2;
  if (ui.page === "field") return {
    pct: () => FV.s / (FV.base || FV.s || 1),
    step: (f) => zoomFieldAt(FV.s * f, cx, cy),
    auto: () => fitField()
  };
  if (ui.page === "cut") return {
    pct: () => ui.cutV.z,
    step: (f) => {
      viewZoomAt(ui.cutV, Math.max(1, Math.min(8, ui.cutV.z * f)), cx, cy);
      cutViewClamp(R);
    },
    auto: () => Object.assign(ui.cutV, { z: 1, x: 0, y: 0 })
  };
  if (ui.page === "out") return {
    pct: () => ui_out.V.z,
    step: (f) => {
      // вид мэппинга смещается от центра окна — при масштабе к центру смещение растёт так же
      const V = ui_out.V, z = Math.max(1, Math.min(40, V.z * f)), k = z / V.z;
      V.z = z;
      V.x = z === 1 ? 0 : V.x * k;
      V.y = z === 1 ? 0 : V.y * k;
    },
    auto: () => Object.assign(ui_out.V, { z: 1, x: 0, y: 0 })
  };
  if (ui.page === "tz") return {
    pct: () => ui.tzView.z,
    step: (f) => {
      viewZoomAt(ui.tzView, Math.max(1, Math.min(8, ui.tzView.z * f)), cx, cy);
      tzViewClamp();
    },
    auto: () => {
      ui.tzView = { z: 1, x: 0, y: 0 };
      if (ui.tzZoom >= 0) tzZoomTo(-1);
    }
  };
  if (S().kind === "vol") {
    // волюметрик: масштаб схемы коммутации
    const cv = $("volCom"), r = cv ? cv.getBoundingClientRect() : R;
    return {
      pct: () => ui.volView.z,
      step: (f) => {
        const vv = ui.volView;
        viewZoomAt(vv, Math.max(1, Math.min(12, vv.z * f)), r.width / 2, r.height / 2);
        if (vv.z === 1) vv.x = vv.y = 0;
        volComDraw();
      },
      auto: () => {
        Object.assign(ui.volView, { z: 1, x: 0, y: 0 });
        volComDraw();
      }
    };
  }
  return {
    pct: () => ui.zoom,
    step: (f) => setZoomAt(ui.zoom * f, cx, cy),
    auto: () => {
      ui.zoom = 1;
      ui.panX = ui.panY = 0;
      updateInfo();
    }
  };
}
function syncZoomLabel() {
  const el = $("zLabel");
  if (!el) return;
  let v = 1;
  try {
    v = zoomTarget().pct();
  } catch (e) {
  }
  setTxt(el, Math.round((isFinite(v) ? v : 1) * 100) + "%");
}
function drawCut() {
  const c = CC(), G = c && cutGeom(c);
  const R = prepCanvas(G ? [G.W, G.H] : [16, 9]);
  if (!G) {
    pctx.fillStyle = "#8c9bab";
    pctx.font = "15px ".concat(FONT);
    pctx.textAlign = "center";
    pctx.fillText(project.cuts.length ? "Выберите LED-маску для нарезки" : "Нажмите «+ Нарезка», чтобы разрезать длинную маску на части", R.width / 2, R.height / 2);
    pctx.textAlign = "left";
    return;
  }
  // 2.0.181: масштаб нарезки — колесо, кнопки «− + Авто», сдвиг перетаскиванием
  cutViewClamp(R);
  pctx.translate(ui.cutV.x, ui.cutV.y);
  pctx.scale(ui.cutV.z, ui.cutV.z);
  // 2.0.174: два окна — сверху исходная маска с разметкой и линиями разреза, снизу результат нарезки
  const pad = R.width < 600 ? 20 : 48, cap = 18, gapY = 14, slotH = (R.height - pad * 2 - gapY) / 2 - cap;
  const win = (title, W, H, y0, paint) => {
    const s = Math.min((R.width - pad * 2) / W, slotH / H);
    pctx.fillStyle = "#8c9bab";
    pctx.font = "12px ".concat(FONT);
    pctx.textAlign = "left";
    pctx.fillText(title, pad, y0 + 12);
    pctx.save();
    pctx.translate(Math.round((R.width - W * s) / 2), Math.round(y0 + cap + (slotH - H * s) / 2));
    paint(pctx, c, s);
    pctx.strokeStyle = "rgba(255,255,255,0.35)";
    pctx.lineWidth = 1;
    pctx.strokeRect(-0.5, -0.5, W * s + 1, H * s + 1);
    pctx.restore();
  };
  win("Исходная маска ".concat(G.W0, "×").concat(G.H0, " — красные линии разреза"), G.W0, G.H0, pad - 6, paintCutSrc);
  win("Результат нарезки ".concat(G.W, "×").concat(G.H, " px · ").concat(G.parts.length, " ").concat(G.parts.length < 5 ? "части" : "частей"), G.W, G.H, pad - 6 + cap + slotH + gapY, paintCut);
}
