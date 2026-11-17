function drawPlateTitle(ctx, st, s, W, H, invert, noPlate) {
  const lines = titleLines(st, s), b = blockSize(lines, TITLE_GAP * s), tx = W * s / 2 + (st.titleOffsetX || 0) * s, ty = H * s / 2 - (st.titleOffsetY || 0) * s;
  if (!noPlate) {
    ctx.fillStyle = invert ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.6)";
    const a = -titleRot(st) * Math.PI / 180;
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(a);
    ctx.fillRect(-b.w / 2 - 14 * s, -b.h / 2 - 8 * s, b.w + 28 * s, b.h + 16 * s);
    ctx.restore();
  }
  ctx.save();
  if (noPlate) {
    ctx.shadowColor = "rgba(0,0,0,0.75)";
    ctx.shadowBlur = Math.max(1, (lines[0] ? lines[0][1] : 10 * s) * 0.05);
  }
  const defC = invert ? "#000" : "#fff";
  ctx.fillStyle = st.titleColor || defC;
  drawBlock(ctx, lines, TITLE_GAP * s, tx, ty, titleRot(st));
  // 2.0.96: дополнительные тексты — тем же цветом и с той же тенью, что основной (раньше в ТВ выходили чёрными)
  for (const it of st.extraLabels || []) {
    const fs2 = Math.min(900, Math.max(6, +it.size || 120)) * s;
    if (noPlate) ctx.shadowBlur = Math.max(1, fs2 * 0.05);
    ctx.fillStyle = it.color || defC;
    drawBlock(ctx, [[it.text || "Текст", fs2]], 0, W * s / 2 + (+it.x || 0) * s, H * s / 2 - (+it.y || 0) * s, +it.rotation || 0);
  }
  ctx.restore();
}
function drawTV(ctx, st, s, guides) {
  const g = tvGeom(st), T = g.T, X = (v) => v * s, Wp = Math.max(1, Math.round(g.W * s)), Hp = Math.max(1, Math.round(g.H * s)), lw = (px) => Math.max(1, px * s);
  ctx.save();
  ctx.fillStyle = "#1c1c1c";
  ctx.fillRect(0, 0, Wp, Hp);
  for (const r of g.rects) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(X(r.x), X(r.y), X(r.w), X(r.h));
    ctx.clip();
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2, m = Math.min(r.w, r.h);
    if (T.grid !== false) {
      const step = m / 9;
      ctx.strokeStyle = "#5a5a5a";
      ctx.lineWidth = lw(1);
      ctx.beginPath();
      for (let x = cx % step; x <= r.w; x += step) {
        ctx.moveTo(Math.round(X(r.x + x)) + 0.5, X(r.y));
        ctx.lineTo(Math.round(X(r.x + x)) + 0.5, X(r.y + r.h));
      }
      for (let y = cy % step; y <= r.h; y += step) {
        ctx.moveTo(X(r.x), Math.round(X(r.y + y)) + 0.5);
        ctx.lineTo(X(r.x + r.w), Math.round(X(r.y + y)) + 0.5);
      }
      ctx.stroke();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = lw(3);
      ctx.beginPath();
      ctx.arc(X(cx), X(cy), X(m * 0.45), 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = lw(2);
      ctx.beginPath();
      ctx.moveTo(X(cx - m * 0.06), X(cy));
      ctx.lineTo(X(cx + m * 0.06), X(cy));
      ctx.moveTo(X(cx), X(cy - m * 0.06));
      ctx.lineTo(X(cx), X(cy + m * 0.06));
      ctx.stroke();
      ctx.lineWidth = lw(2);
      for (const [ax, ay] of [[0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9]]) {
        ctx.beginPath();
        ctx.arc(X(r.x + r.w * ax), X(r.y + r.h * ay), X(m * 0.07), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    if (T.bars !== false) {
      const bw = r.w * 0.6, bx = r.x + (r.w - bw) / 2, by = r.y + r.h * 0.22, bh = r.h * 0.14, cols = ["#BFBFBF", "#BFBF00", "#00BFBF", "#00BF00", "#BF00BF", "#BF0000", "#0000BF"];
      cols.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.fillRect(X(bx + bw * i / 7), X(by), X(bw / 7) + 1, X(bh));
      });
      const gy = r.y + r.h * 0.68, gh = r.h * 0.08;
      for (let i = 0; i < 11; i++) {
        const v = Math.round(255 * i / 10);
        ctx.fillStyle = "rgb(".concat(v, ",").concat(v, ",").concat(v, ")");
        ctx.fillRect(X(bx + bw * i / 11), X(gy), X(bw / 11) + 1, X(gh));
      }
      const grd = ctx.createLinearGradient(X(bx), 0, X(bx + bw), 0);
      grd.addColorStop(0, "#000");
      grd.addColorStop(1, "#fff");
      ctx.fillStyle = grd;
      ctx.fillRect(X(bx), X(gy + gh), X(bw), X(gh * 0.45));
    }
    if (T.safe !== false) {
      ctx.setLineDash([lw(10), lw(8)]);
      ctx.lineWidth = lw(2);
      ctx.strokeStyle = "#FFCC00";
      ctx.strokeRect(X(r.x + r.w * 0.05), X(r.y + r.h * 0.05), X(r.w * 0.9), X(r.h * 0.9));
      ctx.strokeStyle = "#FF3B30";
      ctx.strokeRect(X(r.x + r.w * 0.1), X(r.y + r.h * 0.1), X(r.w * 0.8), X(r.h * 0.8));
      ctx.setLineDash([]);
    }
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = lw(2);
    ctx.strokeRect(X(r.x) + lw(1), X(r.y) + lw(1), X(r.w) - lw(2), X(r.h) - lw(2));
    ctx.fillStyle = "#ffffff";
    const a = m * 0.03;
    for (const [px, py, dx, dy] of [[cx, r.y, 0, 1], [cx, r.y + r.h, 0, -1], [r.x, cy, 1, 0], [r.x + r.w, cy, -1, 0]]) {
      ctx.beginPath();
      ctx.moveTo(X(px), X(py));
      ctx.lineTo(X(px + dx * a * 1.5 - dy * a), X(py + dy * a * 1.5 - dx * a));
      ctx.lineTo(X(px + dx * a * 1.5 + dy * a), X(py + dy * a * 1.5 + dx * a));
      ctx.closePath();
      ctx.fill();
    }
    if (T.corner === true) {
      // 2.0.47: подпись панели в углу (TV · разрешение · диагональ) — галочкой в «Данных»
      const fs = Math.max(6, m * 0.045 * s), lab = "".concat((T.label || "TV").trim() || "TV", " ").concat(g.rects.length > 1 ? r.n : "").trim(), sub = "".concat(r.w, "×").concat(r.h).concat(T.diag > 0 ? " · ".concat(T.diag, "″") : "").concat(g.rects.length > 1 ? " · X ".concat(r.x, " · Y ").concat(r.y) : "");
      ctx.textBaseline = "top";
      ctx.font = "bold ".concat(fs, "px ").concat(FONT);
      const w1 = ctx.measureText(lab).width;
      ctx.font = "".concat(fs * 0.55, "px ").concat(FONT);
      const w2 = ctx.measureText(sub).width;
      const lx = X(r.x + r.w * 0.06) + fs * 0.4, ly = X(r.y + r.h * 0.065);
      ctx.shadowColor = "rgba(0,0,0,0.9)";
      ctx.shadowBlur = Math.max(1, fs * 0.08);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold ".concat(fs, "px ").concat(FONT);
      ctx.fillText(lab, lx, ly);
      ctx.font = "".concat(fs * 0.55, "px ").concat(FONT);
      ctx.fillText(sub, lx, ly + fs * 1.12);
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }
  if (guides.circle || guides.diag) {
    ctx.beginPath();
    if (guides.diag) {
      ctx.moveTo(0, 0);
      ctx.lineTo(Wp, Hp);
      ctx.moveTo(0, Hp);
      ctx.lineTo(Wp, 0);
    }
    if (guides.circle) {
      const d = Math.min(Wp, Hp);
      ctx.moveTo(Wp / 2 + d / 2, Hp / 2);
      ctx.arc(Wp / 2, Hp / 2, d / 2, 0, Math.PI * 2);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = Math.max(1, 2 * s);
    ctx.stroke();
  }
  drawPlateTitle(ctx, st, s, g.W, g.H, false, true);
  drawInfo(ctx, st, s); // 2.0.46: «Информация о маске» и у ТВ-панелей
  ctx.restore();
}
function drawPix(ctx, st, s, guides) {
  const g = pixGeom(st), X = g.X, Wp = Math.max(1, Math.round(g.W * s)), Hp = Math.max(1, Math.round(g.H * s)), f = (v) => Math.round(v * s);
  ctx.save();
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, Wp, Hp);
  for (let c = 0; c < g.cols; c++) for (let r = 0; r < g.rows; r++) {
    const [x, y, w, h] = g.rect(c, r);
    ctx.fillStyle = pixColor(c, X.shade !== false && g.rows > 1 ? r % 2 ? 38 : 50 : 46);
    ctx.fillRect(f(x), f(y), Math.max(1, f(x + w) - f(x)), Math.max(1, f(y + h) - f(y)));
  }
  if (X.nums !== false) {
    const [, , w0, h0] = g.rect(0, 0);
    let fs = Math.min(h0 * 0.2, 120) * s;
    ctx.font = "bold ".concat(fs, "px ").concat(FONT);
    const wide = ctx.measureText(String(g.cols)).width, maxW = w0 * s * 0.9;
    if (wide > maxW) fs *= maxW / wide;
    if (fs >= 4) {
      ctx.font = "bold ".concat(fs, "px ").concat(FONT);
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (let c = 0; c < g.cols; c++) for (let r = 0; r < g.rows; r++) {
        const [x, y, w, h] = g.rect(c, r);
        ctx.fillText(String(c + 1), (x + w / 2) * s, (y + Math.min(h * 0.03, 6)) * s);
      }
      ctx.textAlign = "left";
    }
  }
  drawPlateTitle(ctx, st, s, g.W, g.H, false, true);
  ctx.restore();
}
function ratioOf(a, b) {
  if (!(a > 0 && b > 0)) return [16, 9];
  const x = a / b;
  for (let q = 1; q <= 20; q++) {
    const pp = Math.round(x * q);
    if (pp >= 1 && Math.abs(pp / q - x) < 4e-3 * x) return [pp, q];
  }
  return [+x.toFixed(3), 1];
}
function projGeom(st) {
  const P0 = st.proj || defProj();
  if (P0.mode === "dome") {
    const D = Math.max(256, Math.min(16384, P0.dome | 0 || 4096));
    return { P: P0, dome: true, rot: 0, pw: D, ph: D, nx: 1, ny: 1, ovx: 0, ovy: 0, W: D, H: D, rects: [] };
  }
  const P = P0, rot = +P.rot || 0, pw0 = Math.max(16, P.pw | 0), ph0 = Math.max(16, P.ph | 0);
  const pw = rot ? ph0 : pw0, ph = rot ? pw0 : ph0, nx = Math.max(1, P.nx | 0), ny = Math.max(1, P.ny | 0);
  let ovx = nx > 1 ? Math.round(pw * Math.max(0, Math.min(50, +P.ox || 0)) / 100) : 0, ovy = ny > 1 ? Math.round(ph * Math.max(0, Math.min(50, +P.oy || 0)) / 100) : 0;
  let W = nx * pw - (nx - 1) * ovx, H = ny * ph - (ny - 1) * ovy, offX = 0, offY = 0, canvas = false;
  if (+P.cw > 0 && +P.ch > 0) {
    canvas = true;
    const A = +P.cw / +P.ch, cl = (v, max) => Math.max(0, Math.min(Math.floor(max / 2), Math.round(v)));
    if (nx === 1 && ny === 1) {
      const k = Math.min(pw / P.cw, ph / P.ch);
      W = Math.round(P.cw * k);
      H = Math.round(P.ch * k);
    } else if (nx > 1) {
      W = nx * pw - (nx - 1) * ovx;
      H = Math.round(W / A);
      if (ny > 1) {
        ovy = cl((ny * ph - H) / (ny - 1), ph);
        const Hmax = ny * ph - (ny - 1) * ovy;
        if (H > Hmax) {
          H = Hmax;
          W = Math.round(H * A);
        }
      } else if (H > ph) {
        H = ph;
        W = Math.round(ph * A);
        ovx = cl((nx * pw - W) / (nx - 1), pw);
      }
    } else {
      H = ny * ph - (ny - 1) * ovy;
      W = Math.round(H * A);
      if (W > pw) {
        W = pw;
        H = Math.round(pw / A);
        ovy = cl((ny * ph - H) / (ny - 1), ph);
      }
    }
    const ev = (v) => 2 * Math.round(v / 2);
    W = Math.max(16, ev(W));
    H = Math.max(16, ev(H));
    if (ovx) ovx = ev(ovx);
    if (ovy) ovy = ev(ovy);
    offX = Math.round((nx * pw - (nx - 1) * ovx - W) / 2);
    offY = Math.round((ny * ph - (ny - 1) * ovy - H) / 2);
  }
  const rects = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) rects.push({ n: j * nx + i + 1, x: i * (pw - ovx) - offX, y: j * (ph - ovy) - offY, w: pw, h: ph });
  return { P, rot, pw, ph, nx, ny, ovx, ovy, W, H, rects, offX, offY, canvas };
}
function drawDome(ctx, st, s, guides, g) {
  const P = g.P, D = g.W, Dp = Math.max(1, Math.round(D * s)), c = Dp / 2;
  const bg = P.invert ? "#FFFFFF" : P.bg || "#101010", fg = P.invert ? "#000000" : P.line || "#FFFFFF", tc = P.invert ? "#000000" : P.text || "#FFFFFF";
  const ACC = P.invert ? "#8E2BD9" : "#B45CFF", RED = "#FF3B30", k = D / 2048, lw = (px) => Math.max(1, px * k * s);
  const fov = Math.max(60, Math.min(360, +P.fov || 180)), half = fov / 2, az = Math.max(1, Math.min(90, +P.az || 10)), el = Math.max(1, Math.min(45, +P.el || 10));
  const R = Dp / 2 - lw(2), rOf = (t) => R * t / half;
  const pt = (a, r) => [c + r * Math.sin(a * Math.PI / 180), c - r * Math.cos(a * Math.PI / 180)];
  ctx.save();
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, Dp, Dp);
  ctx.save();
  ctx.beginPath();
  ctx.arc(c, c, R, 0, Math.PI * 2);
  ctx.clip();
  const ring = (t, col2, w, al) => {
    ctx.strokeStyle = col2;
    ctx.lineWidth = w;
    ctx.globalAlpha = al;
    ctx.beginPath();
    ctx.arc(c, c, rOf(t), 0, Math.PI * 2);
    ctx.stroke();
  };
  const spoke = (a, r0, col2, w, al) => {
    const [x0, y0] = pt(a, r0), [x1, y1] = pt(a, R);
    ctx.strokeStyle = col2;
    ctx.lineWidth = w;
    ctx.globalAlpha = al;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  };
  if (P.dminor !== false) {
    for (let t = el / 2; t < half + 1e-6; t += el) ring(t, fg, lw(1), 0.28);
    for (let a = az / 2; a < 360; a += az) spoke(a, rOf(Math.min(half, el * 2)), fg, lw(1), 0.28);
  }
  for (let t = el; t < half + 1e-6; t += el) ring(t, fg, lw(2), 0.7);
  for (let a = 0; a < 360; a += az) spoke(a, a % 30 === 0 ? 0 : rOf(Math.min(half, el)), fg, lw(2), 0.7);
  for (let e = 60; 90 - e <= half + 1e-6; e -= 30) ring(90 - e, ACC, lw(4), 1);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = RED;
  ctx.lineWidth = lw(3);
  ctx.beginPath();
  ctx.moveTo(c, c - R);
  ctx.lineTo(c, c + R);
  ctx.moveTo(c - R, c);
  ctx.lineTo(c + R, c);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(c, c, Math.max(3, R * 0.012), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = ACC;
  ctx.lineWidth = lw(5);
  ctx.beginPath();
  ctx.arc(c, c, R, 0, Math.PI * 2);
  ctx.stroke();
  const fs = Math.max(6, 30 * k * s), tang = (txt, a, r, col2, font) => {
    const [x, y] = pt(a, r);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a * Math.PI / 180);
    ctx.fillStyle = col2;
    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(txt, 0, 0);
    ctx.restore();
  };
  if (P.dlabels !== false) {
    const stepL = 2 * Math.PI * R * az / 360 < fs * 3.2 ? az * Math.ceil(fs * 3.2 / (2 * Math.PI * R * az / 360)) : az;
    for (let a = 0; a < 360; a += stepL) tang("".concat(a, "°"), a, R - fs * 1.1, tc, "bold ".concat(fs, "px ").concat(FONT));
    ctx.fillStyle = tc;
    ctx.font = "".concat(fs * 0.8, "px ").concat(FONT);
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    for (let t = el; t < half - el * 0.3; t += el) {
      if (rOf(el) < fs * 1.1 && Math.round(t / el) % 2) continue;
      {
        const [x, y] = pt(az * Math.round(45 / az) || 45, rOf(t));
        ctx.fillText("".concat(+(90 - t).toFixed(1), "°"), x + fs * 0.25, y - fs * 0.1);
      }
    }
  }
  if (P.dsides !== false) {
    const f2 = "bold ".concat(fs * 1.25, "px ").concat(FONT), r2 = R - fs * (P.dlabels !== false ? 3 : 1.4);
    [["BACK", 0], ["RIGHT", 90], ["FRONT", 180], ["LEFT", 270]].forEach(([t, a]) => tang(t, a, r2, RED, f2));
  }
  if (guides.circle || guides.diag) {
    ctx.beginPath();
    if (guides.diag) {
      ctx.moveTo(0, 0);
      ctx.lineTo(Dp, Dp);
      ctx.moveTo(0, Dp);
      ctx.lineTo(Dp, 0);
    }
    if (guides.circle) {
      ctx.moveTo(Dp, c);
      ctx.arc(c, c, Dp / 2, 0, Math.PI * 2);
    }
    ctx.strokeStyle = P.invert ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.5)";
    ctx.lineWidth = Math.max(1, 2 * s);
    ctx.stroke();
  }
  // 2.0.80: подложка и каше-фигуры и в режиме купола
  if (REF_ON_CANVAS) drawRefImage(ctx, st, s);
  drawCachePx(ctx, st, s, Dp, Dp);
  const lines = titleLines(st, s), b = blockSize(lines, TITLE_GAP * s), tx = c + (st.titleOffsetX || 0) * s, ty = Dp * 0.62 - (st.titleOffsetY || 0) * s;
  void b; // 2.0.76: под текстом проекции больше нет чёрного прямоугольника
  ctx.fillStyle = st.titleColor || tc;
  drawBlock(ctx, lines, TITLE_GAP * s, tx, ty, titleRot(st));
  if (P.bar) {
    const bw = D * 0.36, bh = D * 0.03, bx = (D - bw) / 2, by = Math.max(D * 0.7, (ty + b.h / 2 + 24 * s) / s), X = (v) => v * s, cols = ["#FFFFFF", "#FFFF00", "#00FFFF", "#00FF00", "#FF00FF", "#FF0000", "#0000FF", "#000000"];
    cols.forEach((cl, i) => {
      ctx.fillStyle = cl;
      ctx.fillRect(X(bx + bw * i / cols.length), X(by), X(bw / cols.length) + 1, X(bh));
    });
    for (let i = 0; i < 11; i++) {
      const v = Math.round(255 * i / 10);
      ctx.fillStyle = "rgb(".concat(v, ",").concat(v, ",").concat(v, ")");
      ctx.fillRect(X(bx + bw * i / 11), X(by + bh), X(bw / 11) + 1, X(bh * 0.5));
    }
    ctx.strokeStyle = fg;
    ctx.lineWidth = lw(1);
    ctx.strokeRect(X(bx), X(by), X(bw), X(bh * 1.5));
  }
  for (const it of st.extraLabels || []) {
    const fs2 = Math.min(900, Math.max(6, +it.size || 120)) * s;
    ctx.fillStyle = it.color || tc; // 2.0.96/2.0.97: доп. текст купола — своим цветом или цветом текста
    drawBlock(ctx, [[it.text || "Текст", fs2]], 0, c + (+it.x || 0) * s, c - (+it.y || 0) * s, +it.rotation || 0);
  }
  drawInfo(ctx, st, s);
  ctx.restore();
}
function drawProj(ctx, st, s, guides) {
  const g = projGeom(st);
  if (g.dome) return drawDome(ctx, st, s, guides, g);
  const P = g.P, W = g.W, H = g.H, Wp = Math.max(1, Math.round(W * s)), Hp = Math.max(1, Math.round(H * s));
  const bg = P.invert ? "#FFFFFF" : P.bg || "#101010", fg = P.invert ? "#000000" : P.line || "#FFFFFF";
  const tc = P.invert ? "#000000" : P.text || "#FFFFFF";
  const X = (v) => v * s, lw = (px) => Math.max(1, px * s);
  ctx.save();
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, Wp, Hp);
  if (P.hatch) {
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = fg;
    ctx.lineWidth = lw(1);
    ctx.beginPath();
    const step = Math.max(6, 24 * s);
    for (let d = -Hp; d < Wp; d += step) {
      ctx.moveTo(d, Hp);
      ctx.lineTo(d + Hp, 0);
    }
    ctx.stroke();
    ctx.restore();
  }
  if (P.zones && (g.ovx || g.ovy)) {
    ctx.save();
    ctx.fillStyle = "#FFD60A";
    ctx.globalAlpha = 0.17;
    for (let i = 1; i < g.nx; i++) ctx.fillRect(X(i * (g.pw - g.ovx) - g.offX), 0, X(g.ovx), Hp);
    for (let j = 1; j < g.ny; j++) ctx.fillRect(0, X(j * (g.ph - g.ovy) - g.offY), Wp, X(g.ovy));
    ctx.restore();
  }
  const gs = Math.max(8, P.grid | 0), cx = W / 2, cy = H / 2;
  ctx.save();
  ctx.strokeStyle = fg;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = lw(1);
  ctx.beginPath();
  const xsG = [], ysG = [];
  for (let x = cx % gs; x <= W; x += gs) xsG.push(x);
  for (let y = cy % gs; y <= H; y += gs) ysG.push(y);
  for (const x of xsG) {
    ctx.moveTo(Math.round(X(x)) + 0.5, 0);
    ctx.lineTo(Math.round(X(x)) + 0.5, Hp);
  }
  for (const y of ysG) {
    ctx.moveTo(0, Math.round(X(y)) + 0.5);
    ctx.lineTo(Wp, Math.round(X(y)) + 0.5);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.lineWidth = lw(3);
  ctx.beginPath();
  ctx.moveTo(X(cx), 0);
  ctx.lineTo(X(cx), Hp);
  ctx.moveTo(0, X(cy));
  ctx.lineTo(Wp, X(cy));
  ctx.stroke();
  ctx.restore();
  if (P.cells) {
    const edges = [0, ...xsG.filter((x) => x > 0 && x < W), W], rowsE = [0, ...ysG.filter((y) => y > 0 && y < H), H];
    const fs = Math.max(5, Math.min(gs * 0.16, 28) * s);
    if (fs >= 5) {
      ctx.save();
      ctx.fillStyle = tc;
      ctx.globalAlpha = 0.6;
      ctx.font = "".concat(fs, "px ").concat(FONT);
      ctx.textBaseline = "top";
      const col2 = (i) => {
        let t = "";
        i++;
        while (i > 0) {
          const m = (i - 1) % 26;
          t = String.fromCharCode(65 + m) + t;
          i = Math.floor((i - 1) / 26);
        }
        return t;
      };
      for (let r = 0; r < rowsE.length - 1; r++) for (let c = 0; c < edges.length - 1; c++) {
        if ((edges[c + 1] - edges[c]) * s < fs * 2.2 || (rowsE[r + 1] - rowsE[r]) * s < fs * 1.4) continue;
        ctx.fillText(col2(c) + (r + 1), X(edges[c]) + fs * 0.3, X(rowsE[r]) + fs * 0.25);
      }
      ctx.restore();
    }
  }
  if (P.circles) {
    ctx.save();
    ctx.lineWidth = lw(3);
    for (const r of g.rects) {
      ctx.strokeStyle = g.rects.length > 1 ? PJ_COLORS[(r.n - 1) % PJ_COLORS.length] : fg;
      ctx.beginPath();
      ctx.arc(X(r.x + r.w / 2), X(r.y + r.h / 2), X(Math.min(r.w, r.h) / 2 - 2), 0, Math.PI * 2);
      ctx.stroke();
    }
    if (g.rects.length > 1) {
      ctx.strokeStyle = fg;
      ctx.beginPath();
      ctx.arc(X(cx), X(cy), X(Math.min(W, H) / 2 - 2), 0, Math.PI * 2);
      ctx.stroke();
    }
    const rr = Math.min(W, H) / 10;
    ctx.strokeStyle = fg;
    ctx.lineWidth = lw(2);
    for (const [x, y] of [[rr, rr], [W - rr, rr], [rr, H - rr], [W - rr, H - rr]]) {
      ctx.beginPath();
      ctx.arc(X(x), X(y), X(rr * 0.8), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
  if (P.frames) {
    const fs = Math.max(6, Math.min(g.pw, g.ph) * 0.035 * s);
    ctx.save();
    ctx.lineWidth = lw(4);
    ctx.textBaseline = "top";
    for (const r of g.rects) {
      const c = PJ_COLORS[(r.n - 1) % PJ_COLORS.length], inset = lw(2);
      ctx.strokeStyle = c;
      ctx.strokeRect(X(r.x) + inset, X(r.y) + inset, X(r.w) - inset * 2, X(r.h) - inset * 2);
      const lx = X(r.x) + Math.max(fs * 0.6, X(Math.min(gs, r.w / 6)) * 0.35), ly = X(r.y) + Math.max(fs * 0.5, X(Math.min(gs, r.h / 6)) * 0.45);
      ctx.font = "bold ".concat(fs, "px ").concat(FONT);
      const t1 = "P".concat(r.n), w1 = ctx.measureText(t1).width;
      ctx.font = "".concat(fs * 0.55, "px ").concat(FONT);
      const t2 = "".concat(r.w, "×").concat(r.h).concat(g.rot ? " · портрет" : "", " · X ").concat(r.x, " · Y ").concat(r.y), w2 = ctx.measureText(t2).width;
      // 2.0.76: номера проекторов — по галочке «Номера проекторов» (по умолчанию выкл), без чёрной подложки
      if (!P.nums) continue;
      void w1, void w2;
      ctx.fillStyle = c;
      ctx.font = "bold ".concat(fs, "px ").concat(FONT);
      ctx.fillText(t1, lx, ly);
      ctx.font = "".concat(fs * 0.55, "px ").concat(FONT);
      ctx.fillText(t2, lx, ly + fs * 1.12);
    }
    if (g.ovx || g.ovy) {
      ctx.fillStyle = tc;
      ctx.globalAlpha = 0.85;
      ctx.font = "".concat(fs * 0.5, "px ").concat(FONT);
      ctx.textAlign = "center";
      for (let i = 1; i < g.nx; i++) {
        const x0 = i * (g.pw - g.ovx) - g.offX;
        ctx.save();
        ctx.translate(X(x0 + g.ovx / 2), X(H * 0.3));
        ctx.rotate(-Math.PI / 2);
        ctx.fillText("перекрытие ".concat(g.ovx, " px"), 0, -fs * 0.25);
        ctx.restore();
      }
      for (let j = 1; j < g.ny; j++) {
        const y0 = j * (g.ph - g.ovy) - g.offY;
        ctx.textBaseline = "middle";
        ctx.fillText("перекрытие ".concat(g.ovy, " px"), X(W * 0.25), X(y0 + g.ovy / 2));
        ctx.textBaseline = "top";
      }
      ctx.textAlign = "left";
    }
    ctx.restore();
  }
  if (P.bar) {
    const bw = W * 0.5, bh = Math.max(12, H * 0.05), bx = (W - bw) / 2, by = barY(ctx, st, W, H, bx, bh), cols = ["#FFFFFF", "#FFFF00", "#00FFFF", "#00FF00", "#FF00FF", "#FF0000", "#0000FF", "#000000"];
    cols.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(X(bx + bw * i / cols.length), X(by), X(bw / cols.length) + 1, X(bh));
    });
    for (let i = 0; i < 11; i++) {
      const v = Math.round(255 * i / 10);
      ctx.fillStyle = "rgb(".concat(v, ",").concat(v, ",").concat(v, ")");
      ctx.fillRect(X(bx + bw * i / 11), X(by + bh), X(bw / 11) + 1, X(bh * 0.5));
    }
    ctx.strokeStyle = fg;
    ctx.lineWidth = lw(1);
    ctx.strokeRect(X(bx), X(by), X(bw), X(bh * 1.5));
  }
  ctx.strokeStyle = fg;
  ctx.lineWidth = lw(2);
  ctx.strokeRect(lw(1), lw(1), Wp - lw(2), Hp - lw(2));
  // 2.0.76: подложка и каше-фигуры в проекции — по пикселям (кабинетов нет)
  if (REF_ON_CANVAS) drawRefImage(ctx, st, s);
  drawCachePx(ctx, st, s, Wp, Hp);
  if (guides.circle || guides.diag) {
    ctx.beginPath();
    if (guides.diag) {
      ctx.moveTo(0, 0);
      ctx.lineTo(Wp, Hp);
      ctx.moveTo(0, Hp);
      ctx.lineTo(Wp, 0);
    }
    if (guides.circle) {
      const d = Math.min(Wp, Hp);
      ctx.moveTo(Wp / 2 + d / 2, Hp / 2);
      ctx.arc(Wp / 2, Hp / 2, d / 2, 0, Math.PI * 2);
    }
    ctx.strokeStyle = P.invert ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.5)";
    ctx.lineWidth = Math.max(1, 2 * s);
    ctx.stroke();
  }
  const lines = titleLines(st, s), b = blockSize(lines, TITLE_GAP * s), tx = W * s / 2 + (st.titleOffsetX || 0) * s, ty = H * s / 2 - (st.titleOffsetY || 0) * s;
  void b; // 2.0.76: под текстом проекции больше нет чёрного прямоугольника
  ctx.fillStyle = st.titleColor || tc;
  drawBlock(ctx, lines, TITLE_GAP * s, tx, ty, titleRot(st));
  for (const it of st.extraLabels || []) {
    const fs2 = Math.min(900, Math.max(6, +it.size || 120)) * s;
    ctx.fillStyle = it.color || tc;
    drawBlock(ctx, [[it.text || "Текст", fs2]], 0, W * s / 2 + (+it.x || 0) * s, H * s / 2 - (+it.y || 0) * s, +it.rotation || 0);
  }
  drawInfo(ctx, st, s);
  ctx.restore();
}
function drawCachePx(ctx, st, s, Wp, Hp) {
  const list = st.cacheShapes || [];
  if (!list.length) return;
  const dim = st.cacheDim == null ? 45 : +st.cacheDim, lit = list.filter((c) => !c.inv && !c.frame), inv = list.filter((c) => c.inv && !c.frame);
  const P = (c, k) => shapePath(ctx, c, c.x * s, c.y * s, c.w / 2 * s, c.h / 2 * s, k);
  if (lit.length) {
    // «Гасить» — снаружи чёрное, «Затемнить» — темнее на заданный процент
    const a = lit.some((c) => !c.dimOnly) ? 1 : Math.min(1, dim / 100);
    if (a > 0) {
      ctx.save();
      for (const c of lit) {
        ctx.beginPath();
        ctx.rect(-1, -1, Wp + 2, Hp + 2);
        P(c, true);
        ctx.clip("evenodd");
      }
      ctx.globalAlpha = a;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, Wp, Hp);
      ctx.restore();
    }
  }
  for (const c of inv) {
    const a = c.dimOnly ? Math.min(1, dim / 100) : 1;
    if (!(a > 0)) continue;
    ctx.save();
    P(c);
    ctx.globalAlpha = a;
    ctx.fillStyle = "#000";
    ctx.fill();
    ctx.restore();
  }
  drawShapeFills(ctx, st, s);
  const stroke = (c, w, color, alpha) => {
    shapePath(ctx, c, c.x * s, c.y * s, c.w / 2 * s - w / 2, c.h / 2 * s - w / 2);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.stroke();
    ctx.restore();
  };
  const lw = Math.max(1, Math.round((st.cacheLineW || 6) * s)), la = Math.max(0.05, Math.min(1, (st.cacheLineA == null ? 100 : +st.cacheLineA) / 100));
  for (const c of list) if (st.cacheLine !== false || c.frame) stroke(c, lw, st.cacheLineColor || "#FFFFFF", la);
}
// 3.0.3: заливка фигуры цветом (fill — включена, fc — цвет, fa — плотность %); поверх кабинетов, под сеткой и номерами.
// Старое поле fa без fill (из давних версий) ни на что не влияет
function drawShapeFills(ctx, st, s) {
  for (const c of st.cacheShapes || []) {
    const a = c.fill ? Math.min(1, (+c.fa > 0 ? +c.fa : 50) / 100) : 0;
    if (!(a > 0)) continue;
    ctx.save();
    shapePath(ctx, c, c.x * s, c.y * s, c.w / 2 * s, c.h / 2 * s);
    ctx.globalAlpha = a;
    ctx.fillStyle = c.fc || "#FF0000";
    ctx.fill();
    ctx.restore();
  }
}
function shapeR(c) {
  if (c.t === "bez") return 0;
  return c.t !== "circle" ? Math.max(0, Math.min(+c.r || 0, c.w / 2, c.h / 2)) : null;
}
// Многоугольные фигуры каше: трапеция и пентагон. Вершины — относительно центра, y вниз, по часовой.
const isPolyShape = (c) => c.t === "trap" || c.t === "pent" || c.t === "round";
const trapTb = (c) => Math.max(5, Math.min(100, c.tb == null ? 60 : +c.tb)) / 100;
const trapSk = (c) => Math.max(-100, Math.min(100, +c.sk || 0)) / 100;
function shapePoly(c, hw, hh) {
  if (c.t === "round") return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
  if (c.t === "pent") {
    // правильный пентагон вершиной вверх, вписанный в рамку фигуры
    const pts = [];
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + k * 2 * Math.PI / 5;
      pts.push([Math.cos(a) / Math.cos(Math.PI / 10) * hw, ((Math.sin(a) + 1) / (1 + Math.cos(Math.PI / 5)) * 2 - 1) * hh]);
    }
    return pts;
  }
  // трапеция: верхнее основание — tb% от нижнего, сдвиг верха sk% (±100 — прямоугольная трапеция), flip — широкой стороной вверх
  const tw = hw * trapTb(c), off = (hw - tw) * trapSk(c);
  let pts = [[-tw + off, -hh], [tw + off, -hh], [hw, hh], [-hw, hh]];
  if (c.flip) pts = pts.map(([x, y]) => [x, -y]).reverse();
  return pts;
}
// Радиус скругления каждого угла (не больше, чем позволяют соседние стороны)
function polyCorners(pts, r) {
  const n = pts.length;
  return pts.map((p, i) => {
    const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
    const u = [a[0] - p[0], a[1] - p[1]], v = [b[0] - p[0], b[1] - p[1]], lu = Math.hypot(u[0], u[1]) || 1e-9, lv = Math.hypot(v[0], v[1]) || 1e-9;
    const ang = Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / (lu * lv)))), t = Math.tan(ang / 2);
    return { x: p[0], y: p[1], r: Math.max(0, Math.min(r, Math.min(lu, lv) / 2 * t)), u: [u[0] / lu, u[1] / lu], v: [v[0] / lv, v[1] / lv], ang };
  });
}
function polyFlat(c, hw, hh, r) {
  const out = [];
  for (const q of polyCorners(shapePoly(c, hw, hh), r)) {
    if (q.r <= 1e-6) {
      out.push([q.x, q.y]);
      continue;
    }
    const d = q.r / Math.tan(q.ang / 2), t1 = [q.x + q.u[0] * d, q.y + q.u[1] * d], t2 = [q.x + q.v[0] * d, q.y + q.v[1] * d];
    const bx = q.u[0] + q.v[0], by = q.u[1] + q.v[1], bl = Math.hypot(bx, by) || 1e-9, h = q.r / Math.sin(q.ang / 2);
    const ox = q.x + bx / bl * h, oy = q.y + by / bl * h;
    let a1 = Math.atan2(t1[1] - oy, t1[0] - ox), a2 = Math.atan2(t2[1] - oy, t2[0] - ox), da = a2 - a1;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    for (let k = 0; k <= 8; k++) out.push([ox + q.r * Math.cos(a1 + da * k / 8), oy + q.r * Math.sin(a1 + da * k / 8)]);
  }
  return out;
}
function inPoly(pts, x, y) {
  let ins = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}
// ---- Поворот фигур: c.rot — градусы по часовой ----
const shapeRot = (c) => (+c.rot || 0) * Math.PI / 180;
function rotPt(c, lx, ly) {
  const a = shapeRot(c);
  if (!a) return [lx, ly];
  const co = Math.cos(a), si = Math.sin(a);
  return [lx * co - ly * si, lx * si + ly * co];
}
function unrotPt(c, dx, dy) {
  const a = -shapeRot(c);
  if (!a) return [dx, dy];
  const co = Math.cos(a), si = Math.sin(a);
  return [dx * co - dy * si, dx * si + dy * co];
}
// ---- Своя фигура: c.pts — точки {x, y, ix, iy, ox, oy, sm} в долях полуширины/полувысоты (−1…1),
// ix/iy — входящая ручка кривой Безье, ox/oy — исходящая, sm — плавный узел (ручки на одной прямой) ----
function bezSegs(pts, hw, hh) {
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    out.push([[a.x * hw, a.y * hh], [a.ox * hw, a.oy * hh], [b.ix * hw, b.iy * hh], [b.x * hw, b.y * hh]]);
  }
  return out;
}
const bezAt = ([p0, p1, p2, p3], t) => {
  const u = 1 - t;
  return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]];
};
function bezFlat(pts, hw, hh, steps = 20) {
  const out = [];
  for (const sg of bezSegs(pts, hw, hh)) for (let k = 0; k < steps; k++) out.push(bezAt(sg, k / steps));
  return out;
}
// Контур фигуры (без поворота, относительно центра) — ломаная
function shapeFlatLocal(c, hw, hh) {
  if (c.t === "bez") return bezFlat(c.pts || [], hw, hh);
  if (c.t === "circle") {
    const out = [];
    for (let k = 0; k < 72; k++) out.push([Math.cos(k / 72 * 2 * Math.PI) * hw, Math.sin(k / 72 * 2 * Math.PI) * hh]);
    return out;
  }
  const r = Math.min(shapeR(c) || 0, hw, hh) * (hw / Math.max(1e-9, c.w / 2));
  return polyFlat(c, hw, hh, r);
}
// Контур в координатах маски (с поворотом и сдвигом), k — масштаб от центра
function shapeOutline(c, k = 1) {
  return shapeFlatLocal(c, c.w / 2 * k, c.h / 2 * k).map(([x, y]) => {
    const [X, Y] = rotPt(c, x, y);
    return [c.x + X, c.y + Y];
  });
}
// Касается ли фигура прямоугольника кабинета (хоть краем)
function shapeTouchesRect(c, x0, y0, x1, y1, outline) {
  const px = Math.max(x0, Math.min(c.x, x1)), py = Math.max(y0, Math.min(c.y, y1));
  if (shapeHas(c, px - c.x, py - c.y)) return true;
  for (const [X, Y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) if (shapeHas(c, X - c.x, Y - c.y)) return true;
  for (const [X, Y] of outline || shapeOutline(c)) if (X >= x0 && X <= x1 && Y >= y0 && Y <= y1) return true;
  return false;
}
function shapeHas(c, dx, dy) {
  [dx, dy] = unrotPt(c, dx, dy);
  const hw = c.w / 2, hh = c.h / 2, ax = Math.abs(dx), ay = Math.abs(dy), r = shapeR(c);
  if (c.t === "bez") return inPoly(bezFlat(c.pts || [], hw, hh), dx, dy);
  if (isPolyShape(c) && c.t !== "round") return inPoly(polyFlat(c, hw, hh, r), dx, dy);
  if (r === null) {
    const u = dx / hw, v = dy / hh;
    return u * u + v * v < 1;
  }
  if (ax >= hw || ay >= hh) return false;
  const qx = ax - (hw - r), qy = ay - (hh - r);
  return qx <= 0 || qy <= 0 || qx * qx + qy * qy < r * r;
}
function shapePath(ctx, c, cx, cy, rx, ry, keep) {
  if (!keep) ctx.beginPath();
  const a = shapeRot(c);
  if (!a) return shapePathLocal(ctx, c, cx, cy, rx, ry);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(a);
  shapePathLocal(ctx, c, 0, 0, rx, ry);
  ctx.restore();
}
function shapePathLocal(ctx, c, cx, cy, rx, ry) {
  rx = Math.max(0, rx);
  ry = Math.max(0, ry);
  if (c.t === "bez") {
    const sg = bezSegs(c.pts || [], rx, ry);
    if (!sg.length) return;
    ctx.moveTo(cx + sg[0][0][0], cy + sg[0][0][1]);
    for (const [, p1, p2, p3] of sg) ctx.bezierCurveTo(cx + p1[0], cy + p1[1], cx + p2[0], cy + p2[1], cx + p3[0], cy + p3[1]);
    ctx.closePath();
    return;
  }
  const r0 = shapeR(c);
  if (r0 === null) {
    ctx.moveTo(cx + rx, cy);
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    return;
  }
  const r = Math.max(0, Math.min(rx, ry, r0 * (rx / Math.max(1e-9, c.w / 2)))), x0 = cx - rx, y0 = cy - ry, x1 = cx + rx, y1 = cy + ry;
  if (isPolyShape(c) && c.t !== "round") {
    const qs = polyCorners(shapePoly(c, rx, ry), r), n = qs.length, last = qs[n - 1];
    ctx.moveTo(cx + (last.x + qs[0].x) / 2, cy + (last.y + qs[0].y) / 2);
    for (let i = 0; i < n; i++) {
      const q = qs[i], nx = qs[(i + 1) % n];
      if (q.r > 1e-6) ctx.arcTo(cx + q.x, cy + q.y, cx + nx.x, cy + nx.y, q.r);
      else ctx.lineTo(cx + q.x, cy + q.y);
    }
    ctx.closePath();
    return;
  }
  ctx.moveTo(x0 + r, y0);
  ctx.lineTo(x1 - r, y0);
  ctx.arcTo(x1, y0, x1, y0 + r, r);
  ctx.lineTo(x1, y1 - r);
  ctx.arcTo(x1, y1, x1 - r, y1, r);
  ctx.lineTo(x0 + r, y1);
  ctx.arcTo(x0, y1, x0, y1 - r, r);
  ctx.lineTo(x0, y0 + r);
  ctx.arcTo(x0, y0, x0 + r, y0, r);
  ctx.closePath();
}
function shapeOuterK(st, c, xs, ys, H) {
  let k = 1;
  const ol = shapeOutline(c);
  const inside = (kk, dx, dy) => shapeHas(Object.assign({}, c, { w: c.w * kk, h: c.h * kk, r: (+c.r || 0) * kk }), dx, dy);
  for (let r = 0; r < st.cabRows; r++) for (let cc = 0; cc < st.cabCols; cc++) {
    const x0 = xs[cc], x1 = xs[cc + 1], y0 = H - ys[r + 1], y1 = H - ys[r];
    if (!shapeTouchesRect(c, x0, y0, x1, y1, ol)) continue;
    for (const [X, Y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) {
      const dx = X - c.x, dy = Y - c.y;
      if (inside(k * 1.0001, dx, dy)) continue;
      let lo = k, hi = k * 2;
      while (!inside(hi, dx, dy) && hi < 1e4) hi *= 2;
      for (let i = 0; i < 30; i++) {
        const m = (lo + hi) / 2;
        if (inside(m, dx, dy)) hi = m;
        else lo = m;
      }
      k = hi;
    }
  }
  return k;
}
function shapeOff(st) {
  const all = st.kind && st.kind !== "led" ? [] : (st.cacheShapes || []).filter((c) => !c.frame && !c.dimOnly), lit = all.filter((c) => !c.inv), dark = all.filter((c) => c.inv), out = [];
  if (!all.length) return out;
  const { xs, ys } = grid(st), [, H] = dims(st), ols = new Map(all.map((e) => [e, shapeOutline(e)]));
  for (let r = 0; r < st.cabRows; r++) for (let c = 0; c < st.cabCols; c++) {
    const x0 = xs[c], x1 = xs[c + 1], y0 = H - ys[r + 1], y1 = H - ys[r];
    const touch = (e) => shapeTouchesRect(e, x0, y0, x1, y1, ols.get(e));
    if (lit.length && !lit.some(touch) || dark.some(touch)) out.push(key(c, r));
  }
  return out;
}
const shapedCount = (st) => Object.keys(st.shapedCols || {}).filter((c) => +c < st.cabCols).length + Object.keys(st.shapedRows || {}).filter((r) => +r < st.cabRows).length;
const key = (c, r) => c + "," + r;
const parseKey = (k) => {
  const p = String(k).split(",");
  if (p.length !== 2) return null;
  const c = parseInt(p[0], 10), r = parseInt(p[1], 10);
  return isNaN(c) || isNaN(r) ? null : [c, r];
};
const to255 = (c) => [c.r, c.g, c.b].map((v) => Math.max(0, Math.min(255, Math.round((+v || 0) * 255))));
const css = (c) => {
  const [r, g, b] = to255(c);
  return "rgb(".concat(r, ",").concat(g, ",").concat(b, ")");
};
const hex = (c) => "#" + to255(c).map((v) => v.toString(16).padStart(2, "0")).join("");
const fromHex = (h) => col(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
function typeMM(st) {
  const t = TYPES.find((t2) => t2[0] === st.cabinetTypeName);
  return t ? [t[3], t[4], true] : [500, 500, false];
}
function physM(st) {
  if (st.kind === "ring") {
    const g = ringGeom(st);
    return [g.W * ringMmX(g.R) / 1e3, g.H * ringMmY(g.R) / 1e3, true];
  }
  if (st.kind === "tv") {
    const g = tvGeom(st), d = +g.T.diag || 0;
    if (!d) return [0, 0, false];
    const k2 = d * 0.0254 / Math.hypot(g.pw, g.ph);
    return [g.W * k2, g.H * k2, true];
  }
  if (st.kind === "tube") {
    const g = tubeGeom(st);
    return [(g.cols - 1) * g.step / 100 || +g.T.wm || 0.03, g.rows * g.len, true];
  }
  if (st.kind === "pix") {
    const g = pixGeom(st);
    return g.X.cmw > 0 && g.X.cmh > 0 ? [g.wm, g.hm, true] : [0, 0, false];
  }
  if (st.kind === "vol") {
    const V = volGeom(st).V;
    return [V.cx * V.cw / 100, V.len, true];
  }
  if (st.kind === "proj" && st.proj && st.proj.mode !== "dome" && +st.proj.cw > 0 && +st.proj.ch > 0) return [+st.proj.cw, +st.proj.ch, true];
  if (st.kind === "proj") {
    const [W2, H2] = dims(st), dome = st.proj && st.proj.mode === "dome", wm = !dome ? +st.proj.wm || 0 : 0;
    return wm > 0 ? [wm, wm * H2 / W2, true] : dome ? [0, 0, false] : [W2 / 100, H2 / 100, true];
  }
  const [w, h, k] = typeMM(st), [W, H] = dims(st);
  return [w / Math.max(1, st.cabWpx) * W / 1e3, h / Math.max(1, st.cabHpx) * H / 1e3, k];
}
function compactM(v) {
  let s = (+v).toFixed(3);
  if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");
  return s;
}
// 2.0.54: волюметрик — 3D-прибор: размер всегда тремя числами — ширина × высота (длина нити) × глубина
const volSize = (V) => "ширина ".concat(compactM(V.cx * V.cw / 100), " × высота ").concat(compactM(V.len), " × глубина ").concat(compactM(V.cz * V.cd / 100), " м");
const physText = (st) => {
  if (st.kind === "vol" && st.vol) return volSize(volGeom(st).V);
  const [w, h, k] = physM(st);
  if (st.kind && st.kind !== "led" && !k) return { proj: "проекция", tv: "ТВ-панели", pix: "pixel drop", tube: "led tube", vol: "волюметрик" }[st.kind] || "";
  return "".concat(compactM(w), "х").concat(compactM(h), " м");
};
const titleText = (st) => {
  const [W, H] = dims(st);
  return "".concat(W, "×").concat(H);
};
function cabLabel(st, c, r) {
  return fmtCabLabel(st, c, r, st.cabCols, st.cabRows);
}
// 2.0.163: общий формат номера кабинета — одинаковый для LED-масок и для колец
function fmtCabLabel(st, c, r, cols, rows) {
  let colN = c + 1, rowN = r + 1;
  const o = st.numberOriginIndex;
  if (o === 1) rowN = rows - r;
  else if (o === 2) colN = cols - c;
  else if (o === 3) {
    colN = cols - c;
    rowN = rows - r;
  }
  switch (st.numberFormatIndex) {
    case 1:
      return "".concat(colN, "-").concat(rowN);
    case 2:
      return "".concat(colN, " / ").concat(rowN);
    case 3:
      return "C".concat(colN, "-R").concat(rowN);
    case 4:
      return String((rowN - 1) * cols + colN);
    default:
      return "".concat(colN, ",").concat(rowN);
  }
}
const mctx = document.createElement("canvas").getContext("2d");
function measure(text, size) {
  var _a, _b;
  mctx.font = "".concat(Math.max(0.5, size), "px ").concat(FONT);
  const m = mctx.measureText(text || "");
  const asc = (_a = m.fontBoundingBoxAscent) != null ? _a : size * 0.92, desc = (_b = m.fontBoundingBoxDescent) != null ? _b : size * 0.26;
  return { w: m.width, h: asc + desc, asc };
}
const autoCache = /* @__PURE__ */ new Map();
function autoSize(W, H, name) {
  const k = W + "x" + H + "|" + name;
  if (autoCache.has(k)) return autoCache.get(k);
  let best = 30;
  const l1 = "".concat(W, "×").concat(H), l2 = name || "screen 1";
  for (let size = 10; size <= 400; size += 10) {
    const a = measure(l1, size), b = measure(l2, size * 0.55);
    if (a.w <= W * 0.68 && Math.max(a.w, b.w) <= W * 0.78 && a.h + size * 0.064 + b.h <= H * 0.24) best = size;
    else break;
  }
  autoCache.set(k, best);
  return best;
}
function inscSize(st) {
  const i = clampI(st.inscriptionIndex, INSC.length);
  if (i === 0) {
    const [W, H] = dims(st);
    return autoSize(W, H, st.name);
  }
  return Math.max(6, Math.min(900, pfloat(INSC[i])));
}
const TITLE_GAP = 5;
function titleLines(st, s) {
  const size = inscSize(st);
  const s1 = Math.max(10, size) * s, s2 = Math.max(8, size * 0.55) * s, s3 = Math.max(4, Math.max(8, size * 0.55) * 0.5) * s;
  const lines = [];
  if (st.line1Enabled !== false) lines.push([titleText(st), s1]);
  if (st.line2Enabled && st.name) lines.push([st.name, s2]);
  if (st.line3Enabled) lines.push([physText(st), s3]);
  return lines.length ? lines : [["", s1]];
}
function blockSize(lines, gap) {
  const ms = lines.map(([t, sz]) => measure(t, sz));
  return { ms, w: Math.max(...ms.map((m) => m.w)), h: ms.reduce((a, m) => a + m.h, 0) + gap * (ms.length - 1) };
}
// 2.0.43: «Размер нумерации» — Авто (как раньше, от размера кабинета) или свой 1…1000 px; номер всё равно ужимается, чтобы влезть в кабинет
// 2.0.44: «Авто» — номер в той же пропорции к кабинету на всех типах: 50 px на кабинет 192 px (≈26% меньшей стороны)
const NUM_AUTO_K = 50 / 192;
const numberAuto = (st) => Math.max(1, Math.round(Math.min(st.cabWpx, st.cabHpx) * NUM_AUTO_K));
const numberFont = (st) => +st.numSize > 0 ? Math.max(1, Math.min(1000, +st.numSize)) : numberAuto(st);
const NUM_SIZES = [1, 2, 3, 4, 5, 6, 8];
for (let n = 10; n <= 1000; n += 10) NUM_SIZES.push(n);
