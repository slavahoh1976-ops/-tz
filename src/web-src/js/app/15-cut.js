// ---- 2.0.118: НАРЕЗКА — очень длинную (или высокую) LED-маску режем по кабинетам на части и складываем
// друг под другом (или рядом). Номера кабинетов остаются, на частях — подписи и место разреза.
// project.cuts = [{ id, name, uid, dir: "h" | "v", sizes: [кабинетов в части…], fit, fw, fh, gap, sep, marks,
//   big: { on, mode: "num" | "text", step, text }, info: { on, src, size, color, pos }, file }]
// 2.0.119: текст по умолчанию для меток во всю длину — классическая фраза для проверки шрифтов
const CUT_PANGRAM = "Съешь же ещё этих мягких французских булок, да выпей чаю";
function freshCut(k, uid) {
  return { id: newUid(), name: "Нарезка ".concat(k + 1), uid: uid || "", dir: "h", sizes: [], fit: true, fw: 3840, fh: 2160, gap: 0, sep: true, marks: true, big: { on: false, mode: "num", step: 0, text: CUT_PANGRAM }, info: { on: true, src: false, size: 0, color: "#FFFFFF", pos: "c" }, file: "" };
}
function normCut(c, k) {
  const d = freshCut(k), q = c && typeof c === "object" ? c : {}, b = q.big && typeof q.big === "object" ? q.big : {}, i = q.info && typeof q.info === "object" ? q.info : {};
  const out = {
    id: typeof q.id === "string" && q.id ? q.id : d.id,
    name: typeof q.name === "string" && q.name ? q.name : d.name,
    uid: typeof q.uid === "string" ? q.uid : "",
    dir: q.dir === "v" ? "v" : "h",
    sizes: (Array.isArray(q.sizes) ? q.sizes : []).map((v) => Math.max(1, pint(v, 1))).slice(0, 64),
    fit: q.fit !== false,
    fw: Math.max(1, Math.min(32e3, pint(q.fw, d.fw))),
    fh: Math.max(1, Math.min(32e3, pint(q.fh, d.fh))),
    gap: Math.max(0, Math.min(2e3, pint(q.gap, 0))),
    sep: q.sep !== false,
    marks: q.marks !== false,
    big: { on: !!b.on, mode: b.mode === "text" ? "text" : "num", step: Math.max(0, pint(b.step, 0)), text: typeof b.text === "string" ? b.text.slice(0, 200) : d.big.text },
    info: { on: i.on !== false, src: !!i.src, size: Math.max(0, pint(i.size, 0)), color: typeof i.color === "string" && /^#[0-9a-f]{6}$/i.test(i.color) ? i.color.toUpperCase() : "#FFFFFF", pos: ["tl", "t", "tr", "l", "c", "r", "bl", "b", "br"].includes(i.pos) ? i.pos : "c" },
    file: typeof q.file === "string" ? q.file.slice(0, 120) : ""
  };
  return keepRest(out, q);
}
const CC = () => project.cuts[Math.max(0, Math.min(project.cuts.length - 1, project.cutCur || 0))];
const cutSrc = (c) => c && project.screens.find((s) => s.uid === c.uid && s.kind === "led") || null;
const inAnyCut = (uid) => (project.cuts || []).some((c) => c.uid === uid);
// кабинетов в частях: первые части одинаковые и не меньше последней (151 на 3 → 51 + 51 + 49)
function cutAutoSizes(n, L) {
  n = Math.max(1, Math.min(L, n | 0));
  const p = Math.ceil(L / n), last = L - p * (n - 1);
  if (last >= 1) return [...Array(n - 1).fill(p), last];
  const b = Math.floor(L / n), r = L - b * n;
  return Array.from({ length: n }, (_, i) => b + (i < r ? 1 : 0));
}
function cutSizes(c, L) {
  const s = c.sizes;
  if (s.length >= 1 && s.every((v) => v >= 1) && s.reduce((a, v) => a + v, 0) === L) return s.slice();
  return cutAutoSizes(s.length || 2, L);
}
// сколько частей по умолчанию: результат ближе всего к 16:9
function cutBestParts(st, dir) {
  const [W0, H0] = dims(st), L = dir === "v" ? st.cabRows : st.cabCols;
  let best = 2, bd = Infinity;
  for (let n = 2; n <= Math.min(12, L); n++) {
    const len = (dir === "v" ? H0 : W0) / n, thick = (dir === "v" ? W0 : H0) * n, ar = dir === "v" ? thick / len : len / thick, d = Math.abs(Math.log(ar / (16 / 9)));
    if (d < bd) {
      bd = d;
      best = n;
    }
  }
  return best;
}
function cutGeom(c) {
  const st = cutSrc(c);
  if (!st) return null;
  const { xs, ys } = grid(st), [W0, H0] = dims(st), h = c.dir !== "v", L = h ? st.cabCols : st.cabRows, E = h ? xs : ys;
  const sizes = cutSizes(c, L), thick = h ? H0 : W0, gap = c.gap | 0, parts = [];
  let a = 0;
  sizes.forEach((n, i) => {
    const b = a + n, s0 = E[a], len = E[b] - E[a];
    parts.push({ i, a, b, s0, len, dx: h ? 0 : i * (thick + gap), dy: h ? i * (thick + gap) : 0, w: h ? len : thick, h: h ? thick : len, sx: h ? s0 : 0, sy: h ? 0 : s0 });
    a = b;
  });
  const maxLen = Math.max(...parts.map((p) => p.len)), n = parts.length;
  const needW = h ? maxLen : n * thick + gap * (n - 1), needH = h ? n * thick + gap * (n - 1) : maxLen;
  const W = evenPx(c.fit ? needW : c.fw), H = evenPx(c.fit ? needH : c.fh);
  return { st, W0, H0, L, sizes, parts, h, thick, W, H, needW, needH, fits: W >= needW && H >= needH };
}
const cutRange = (G, p) => G.h ? "столбцы ".concat(p.a + 1, "–").concat(p.b, " слева") : "ряды ".concat(p.a + 1, "–").concat(p.b, " сверху");
const cutPartText = (G, p) => "Часть ".concat(p.i + 1, " из ").concat(G.parts.length, " · ").concat(cutRange(G, p));
function cutFileAuto(c) {
  const G = cutGeom(c);
  return G ? "".concat(G.st.name || "screen", " нарезка ").concat(G.parts.length) : "нарезка";
}
function cutFileBase(c) {
  const G = cutGeom(c), tail = String(c.file || "").trim() || cutFileAuto(c);
  return safeFile((G ? "".concat(G.W, "x").concat(G.H, "-") : "") + tail, "cut").slice(0, 180);
}
function cutInfo(c) {
  const G = cutGeom(c);
  if (!G) return null;
  return { w: G.W, h: G.H, label: "".concat(G.W, "×").concat(G.H, "  |  ").concat(G.st.name || "screen", " — нарезка на ").concat(G.parts.length, " ").concat(G.parts.length < 5 ? "части" : "частей") };
}
// крупные метки во всю длину исходного экрана (рисуются до нарезки — режутся вместе с маской)
// ширина ячейки цифры = самая широкая цифра текущего шрифта (ctx.font уже задан)
function digitCell(ctx) {
  let w = 0;
  for (const d of "0123456789") w = Math.max(w, ctx.measureText(d).width);
  return w * 1.04;
}
function paintCutBig(ctx, c, G, s) {
  const B = c.big, len = G.h ? G.W0 : G.H0, th = G.thick;
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.42)";
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const put = (txt, pos, fs, tabular) => {
    ctx.font = "bold ".concat(Math.max(1, fs * s), "px ").concat(FONT);
    ctx.lineWidth = Math.max(1, fs * s * 0.04);
    const x = G.h ? pos * s : th / 2 * s, y = G.h ? th / 2 * s : pos * s;
    ctx.save();
    ctx.translate(x, y);
    if (!G.h) ctx.rotate(-Math.PI / 2);
    if (tabular) {
      // 2.0.174: все цифры одной ширины и высоты — каждая в ячейке одинаковой ширины
      const cw = digitCell(ctx), chars = [...txt];
      chars.forEach((ch, j) => {
        const dx = (j - (chars.length - 1) / 2) * cw;
        ctx.strokeText(ch, dx, 0);
        ctx.fillText(ch, dx, 0);
      });
    } else {
      ctx.strokeText(txt, 0, 0);
      ctx.fillText(txt, 0, 0);
    }
    ctx.restore();
  };
  if (B.mode === "text" && B.text.trim()) {
    // свой текст растянут на всю длину: буквы расставлены равномерно
    const chars = [...B.text.trim()], fs = Math.min(th * 0.62, len / Math.max(1, chars.length) * 0.95);
    chars.forEach((ch, i) => ch.trim() && put(ch, (i + 0.5) * len / chars.length, fs));
  } else {
    const st = G.st, L = G.L, step = B.step > 0 ? B.step : Math.max(1, G.h ? st.cabRows : st.cabCols), { xs, ys } = grid(st), E = G.h ? xs : ys;
    // 2.0.174: один размер для всех меток — по самому длинному (полному) отрезку, а не по каждому; последний неполный отрезок не уменьшает цифру
    const segs = [];
    for (let k = 0; k < L; k += step) segs.push([E[k], E[Math.min(L, k + step)]]);
    const full = Math.max(...segs.map((q) => q[1] - q[0])), nd = String(segs.length).length;
    // цифры в ячейке шириной ≈0.62 кегля: самое длинное число должно помещаться в отрезок
    const fs = Math.min(th * 0.62, full * 0.8, full * 0.92 / (nd * 0.64));
    segs.forEach((q, i) => put(String(i + 1), (q[0] + q[1]) / 2, fs, true));
  }
  ctx.restore();
}
function pill(ctx, txt, x, y, fs, align, bg, fg, maxW) {
  ctx.font = "600 ".concat(fs, "px ").concat(FONT);
  // не шире части: если не помещается — шрифт меньше
  if (maxW > 0) {
    const w0 = ctx.measureText(txt).width + fs * 0.9;
    if (w0 > maxW) {
      fs = Math.max(4, fs * maxW / w0);
      ctx.font = "600 ".concat(fs, "px ").concat(FONT);
    }
  }
  const w = ctx.measureText(txt).width + fs * 0.9, h = fs * 1.5, x0 = align === "right" ? x - w : x;
  ctx.fillStyle = bg;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x0, y, w, h, fs * 0.35);
  else ctx.rect(x0, y, w, h);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(txt, x0 + fs * 0.45, y + h / 2);
  return h;
}
function paintCut(ctx, c, s) {
  const G = cutGeom(c);
  if (!G) return;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, Math.round(G.W * s), Math.round(G.H * s));
  const st2 = { ...G.st, line1Enabled: false, line2Enabled: false, line3Enabled: false };
  for (const p of G.parts) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(p.dx * s, p.dy * s, p.w * s, p.h * s);
    ctx.clip();
    ctx.translate((p.dx - p.sx) * s, (p.dy - p.sy) * s);
    drawMask(ctx, st2, s, guidesOf(st2));
    if (c.big.on) paintCutBig(ctx, c, G, s);
    ctx.restore();
  }
  const fs = Math.max(10, Math.min(140, G.thick * 0.075)) * s, n = G.parts.length;
  // пустое место у коротких частей — «не заполнять»
  for (const p of G.parts) {
    const rest = G.h ? G.W - p.dx - p.w : G.H - p.dy - p.h;
    if (rest < G.thick * 0.25) continue;
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.font = "".concat(fs, "px ").concat(FONT);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const cx = G.h ? (p.w + rest / 2) * s : (p.dx + p.w / 2) * s, cy = G.h ? (p.dy + p.h / 2) * s : (p.dy + p.h + rest / 2) * s;
    ctx.translate(cx, cy);
    if (!G.h && rest > p.w) ctx.rotate(-Math.PI / 2);
    ctx.fillText("пусто — не заполнять", 0, 0);
    ctx.restore();
  }
  if (c.sep && n > 1) {
    ctx.save();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = Math.max(1, 3 * s);
    for (const p of G.parts.slice(1)) {
      ctx.beginPath();
      if (G.h) {
        const y = (p.dy - G.gap / 2) * s;
        ctx.moveTo(0, y);
        ctx.lineTo(G.W * s, y);
      } else {
        const x = (p.dx - G.gap / 2) * s;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, G.H * s);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  if (c.marks) {
    ctx.save();
    for (const p of G.parts) {
      const pad = fs * 0.5, x = p.dx * s + pad, y = p.dy * s + pad, mw = p.w * s - pad * 2;
      let hh = pill(ctx, cutPartText(G, p), x, y, fs, "left", "rgba(0,0,0,0.72)", "#fff", G.h ? mw * 0.62 : mw);
      if (p.i > 0) pill(ctx, "↳ продолжение части ".concat(p.i), x, y + hh + fs * 0.3, fs * 0.85, "left", "rgba(0,0,0,0.62)", "#FFD54A", mw);
      if (p.i < n - 1) {
        // разрез: красный пунктир по краю части и подпись, куда идёт продолжение
        const ex = (p.dx + p.w) * s, ey = (p.dy + p.h) * s;
        ctx.save();
        ctx.strokeStyle = "#FF3B30";
        ctx.lineWidth = Math.max(2, fs * 0.16);
        ctx.setLineDash([fs * 0.5, fs * 0.35]);
        ctx.beginPath();
        if (G.h) {
          ctx.moveTo(ex - ctx.lineWidth / 2, p.dy * s);
          ctx.lineTo(ex - ctx.lineWidth / 2, ey);
        } else {
          ctx.moveTo(p.dx * s, ey - ctx.lineWidth / 2);
          ctx.lineTo(ex, ey - ctx.lineWidth / 2);
        }
        ctx.stroke();
        ctx.restore();
        const t = "✂ разрез — дальше часть ".concat(p.i + 2).concat(G.h ? " ↓" : " →");
        if (G.h) pill(ctx, t, ex - pad - ctx.lineWidth, y, fs, "right", "rgba(150,0,0,0.85)", "#fff", mw * 0.36);
        else pill(ctx, t, x, ey - pad - fs * 1.5 - ctx.lineWidth, fs, "left", "rgba(150,0,0,0.85)", "#fff", mw);
      }
      // стрелка направления в начале части
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "bold ".concat(fs * 1.6, "px ").concat(FONT);
      ctx.textBaseline = "bottom";
      ctx.textAlign = "left";
      if (G.h) ctx.fillText("→", x, (p.dy + p.h) * s - pad);
      else {
        ctx.translate(p.dx * s + p.w * s - pad, y + hh * 2.4);
        ctx.textAlign = "right";
        ctx.textBaseline = "top";
        ctx.fillText("↓", 0, 0);
      }
      ctx.restore();
    }
    ctx.restore();
  }
  if (c.info.on) {
    // в начале первой части: новое разрешение и прежнее название
    const p = G.parts[0], I = c.info, lines0 = ["".concat(G.W, "×").concat(G.H), G.st.name || "screen"];
    if (I.src) lines0.push("исходник ".concat(G.W0, "×").concat(G.H0));
    let big = I.size > 0 ? I.size : Math.max(12, Math.min(p.w, p.h) * 0.28), lines = lines0.map((t, k) => [t, (k ? big * 0.5 : big) * s]);
    let b = blockSize(lines, TITLE_GAP * s);
    const m = Math.min(p.w, p.h) * 0.06 * s, fitK = Math.min(1, (p.w * s - 2 * m) / b.w, (p.h * s - 2 * m) / b.h);
    if (fitK < 1) {
      // текст не шире и не выше первой части
      big *= fitK;
      lines = lines0.map((t, k) => [t, (k ? big * 0.5 : big) * s]);
      b = blockSize(lines, TITLE_GAP * s);
    }
    const pw = p.w * s, ph = p.h * s, pos = I.pos;
    const cx = p.dx * s + (pos.includes("l") ? m + b.w / 2 : pos.includes("r") ? pw - m - b.w / 2 : pw / 2);
    const cy = p.dy * s + (pos.includes("t") ? m + b.h / 2 : pos.includes("b") ? ph - m - b.h / 2 : ph / 2);
    ctx.save();
    ctx.beginPath();
    ctx.rect(p.dx * s, p.dy * s, pw, ph);
    ctx.clip();
    ctx.fillStyle = I.color;
    ctx.textBaseline = "alphabetic";
    drawBlock(ctx, lines, TITLE_GAP * s, cx, cy, 0);
    ctx.restore();
  }
}
// 2.0.174: исходная маска с той же разметкой (крупные метки) и красными линиями разреза — пример для ТЗ и второе окно в «Нарезке»
function paintCutSrc(ctx, c, s) {
  const G = cutGeom(c);
  if (!G) return;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, Math.round(G.W0 * s), Math.round(G.H0 * s));
  const st2 = { ...G.st, line1Enabled: false, line2Enabled: false, line3Enabled: false };
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, G.W0 * s, G.H0 * s);
  ctx.clip();
  drawMask(ctx, st2, s, guidesOf(st2));
  if (c.big.on) paintCutBig(ctx, c, G, s);
  ctx.restore();
  const fs = Math.max(10, Math.min(140, G.thick * 0.075)) * s, pad = fs * 0.5, lw = Math.max(2, fs * 0.16);
  ctx.save();
  for (const p of G.parts) {
    const pos = (G.h ? p.sx : p.sy) * s;
    if (p.i > 0) {
      // линия разреза через всю маску
      ctx.strokeStyle = "#FF3B30";
      ctx.lineWidth = lw;
      ctx.setLineDash([fs * 0.5, fs * 0.35]);
      ctx.beginPath();
      if (G.h) {
        ctx.moveTo(pos, 0);
        ctx.lineTo(pos, G.H0 * s);
      } else {
        ctx.moveTo(0, pos);
        ctx.lineTo(G.W0 * s, pos);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // подпись части — в её начале
    const x = G.h ? pos + pad + (p.i > 0 ? lw : 0) : pad, y = G.h ? pad : pos + pad + (p.i > 0 ? lw : 0);
    pill(ctx, "Часть ".concat(p.i + 1, " из ").concat(G.parts.length), x, y, fs, "left", "rgba(0,0,0,0.72)", "#fff", (G.h ? p.len : G.W0) * s - pad * 2);
    if (p.i < G.parts.length - 1) {
      const t = "✂ разрез → часть ".concat(p.i + 2), ex = G.h ? (p.sx + p.len) * s - lw - pad : G.W0 * s - pad, ey = G.h ? G.H0 * s - pad - fs * 1.5 : (p.sy + p.len) * s - lw - pad - fs * 1.5;
      pill(ctx, t, ex, ey, fs, "right", "rgba(150,0,0,0.85)", "#fff", (G.h ? p.len : G.W0) * s * 0.6);
    }
  }
  ctx.restore();
}
const cutSrcThumbs = /* @__PURE__ */ new Map();
function cutSrcThumb(c) {
  const G = cutGeom(c);
  if (!G) return null;
  const k = JSON.stringify(c) + JSON.stringify(G.st), o = cutSrcThumbs.get(c.id);
  if (o && o.k === k) return o.cv;
  const s = Math.min(1, 1600 / Math.max(G.W0, G.H0)), cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(G.W0 * s));
  cv.height = Math.max(1, Math.round(G.H0 * s));
  paintCutSrc(cv.getContext("2d"), c, s);
  cutSrcThumbs.set(c.id, { k, cv });
  return cv;
}
async function renderCutPNG(c, onBand) {
  const G = cutGeom(c);
  return renderBands(G.W, G.H, (ctx) => paintCut(ctx, c, 1), onBand);
}
const cutThumbs = /* @__PURE__ */ new Map();
function cutThumb(c) {
  const G = cutGeom(c);
  if (!G) return null;
  const k = JSON.stringify(c) + JSON.stringify(G.st) + JSON.stringify(project.guides), o = cutThumbs.get(c.id);
  if (o && o.k === k) return o.cv;
  const s = Math.min(1, 1600 / Math.max(G.W, G.H)), cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(G.W * s));
  cv.height = Math.max(1, Math.round(G.H * s));
  paintCut(cv.getContext("2d"), c, s);
  cutThumbs.set(c.id, { k, cv });
  return cv;
}
// пояснение для контентщиков — текстовый блок ТЗ под маской (по умолчанию; его можно изменить в ТЗ)
function cutNoteDefault(key2) {
  const c = (project.cuts || []).find((q) => "c:" + q.id === String(key2)), G = c && cutGeom(c);
  if (!G) return "";
  const st = G.st, [pw, ph, known] = physM(st), [mw, mh] = typeMM(st), n = G.parts.length;
  const sz = known ? "".concat(compactM(pw), "×").concat(compactM(ph), " м, ") : "";
  const parts = G.parts.map((p) => "часть ".concat(p.i + 1, " — ").concat(cutRange(G, p))).join("; ");
  const how = G.h ? "по горизонтали и уложен частями друг под другом" : "по вертикали и уложен частями рядом слева направо";
  return "**Внимание! Маска нарезана.**\n" + "Экран ".concat(st.name || "", ": ").concat(sz).concat(st.cabCols, "×").concat(st.cabRows, " кабинетов по ").concat(compactM(mw / 10), "×").concat(compactM(mh / 10), " см — целиком ").concat(G.W0, "×").concat(G.H0, " px. ") + "Он слишком ".concat(G.h ? "длинный" : "высокий", ", поэтому в маске для изготовления контента разрезан на ").concat(n, " ").concat(n < 5 ? "части" : "частей", " ").concat(how, ", как на маске (").concat(parts, "). ") + "Делайте контент для всего экрана как одну картинку ".concat(G.W0, "×").concat(G.H0, " px, затем разрежьте его по красным линиям разреза и сложите так же, как на маске — получится файл ").concat(G.W, "×").concat(G.H, " px. ") + (G.parts.some((p) => (G.h ? p.w : p.h) < (G.h ? G.W : G.H)) ? "Чёрное место «пусто — не заполнять» оставьте чёрным." : "");
}
function cutChanged(panel) {
  scheduleCutStrip();
  scheduleAutosave();
  scheduleHistory();
  if (panel) refreshCutPanel();
  else updateCutInfo();
  requestDraw();
}
const escHtml = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
function updateCutInfo() {
  const c = CC(), G = c && cutGeom(c), out = [];
  if (!G) {
    setHtml($("cInfo"), "<span>Выберите LED-маску, которую нужно нарезать.</span>");
    return;
  }
  const [pw, ph, known] = physM(G.st);
  out.push("<span>Исходник: <b>".concat(escHtml(G.st.name || "screen"), "</b> · ").concat(G.W0, "×").concat(G.H0, " px · ").concat(G.st.cabCols, "×").concat(G.st.cabRows, " кабинетов").concat(known ? " · ".concat(compactM(pw), "×").concat(compactM(ph), " м") : "", "</span>"));
  out.push("<span>Части: ".concat(G.sizes.join(" + "), " = ").concat(G.L, " кабинетов ").concat(G.h ? "по длине" : "по высоте", "</span>"));
  out.push("<span>Новая маска: <b>".concat(G.W, "×").concat(G.H, "</b> px").concat(c.fit ? "" : " (нужно не меньше ".concat(G.needW, "×").concat(G.needH, ")"), "</span>"));
  if (!G.fits) out.push('<span class="warn">Поле меньше нарезки — части не помещаются. Увеличьте поле или включите «по краю кабинетов».</span>');
  setHtml($("cInfo"), out.join(""));
  setTxt($("cFilePre"), "".concat(G.W, "x").concat(G.H, "-"));
  if (document.activeElement !== $("cFile")) setVal($("cFile"), String(c.file || "").trim() || cutFileAuto(c));
}
function refreshCutPanel() {
  if (ui.page !== "cut") return;
  scheduleCutStrip();
  const has = project.cuts.length > 0;
  $("cBody").hidden = !has;
  $("cExp").hidden = !has;
  $("cEmpty").hidden = has;
  fillSelect($("cSel"), project.cuts.map((c, i) => "".concat(i + 1, ". ").concat(c.name)));
  if (!has) return;
  $("cSel").value = project.cutCur;
  const c = CC(), leds = project.screens.filter((s) => s.kind === "led");
  $("cSrc").replaceChildren(...leds.map((s) => {
    const o = document.createElement("option"), [w, h] = dims(s);
    o.value = s.uid;
    o.textContent = "".concat(project.screens.indexOf(s) + 1, ". ").concat(s.name || "screen", " — ").concat(w, "×").concat(h, " (").concat(s.cabCols, "×").concat(s.cabRows, ")");
    return o;
  }));
  if (!leds.some((s) => s.uid === c.uid)) c.uid = leds[0] ? leds[0].uid : "";
  $("cSrc").value = c.uid;
  document.querySelectorAll("#cDir button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.dir === c.dir)));
  const G = cutGeom(c);
  $("cParts").value = G ? G.parts.length : 2;
  const box = $("cSizes");
  box.replaceChildren();
  if (G) G.sizes.forEach((v, i) => {
    const w = document.createElement("label"), inp = document.createElement("input");
    w.className = "csz";
    w.textContent = "".concat(i + 1, ":");
    inp.type = "number";
    inp.min = 1;
    inp.value = v;
    inp.id = "cSz" + i;
    inp.className = "num";
    inp.setAttribute("aria-label", "Кабинетов в части ".concat(i + 1));
    inp.onchange = () => setCutSize(i, pint(inp.value, v));
    w.appendChild(inp);
    box.appendChild(w);
    // 2.0.121: наши стрелки ▲▼ (как у остальных чисел)
    stepper(inp.id, (d) => {
      const G2 = cutGeom(CC());
      if (G2 && G2.sizes[i] != null) setCutSize(i, G2.sizes[i] + d);
    });
  });
  $("cFit").checked = c.fit;
  $("cFW").value = c.fit && G ? G.needW : c.fw;
  $("cFH").value = c.fit && G ? G.needH : c.fh;
  $("cFW").disabled = $("cFH").disabled = c.fit;
  $("cGap").value = c.gap;
  $("cSep").checked = c.sep;
  $("cMarks").checked = c.marks;
  $("cBigOn").checked = c.big.on;
  $("cBigMode").value = c.big.mode;
  $("cBigStep").value = c.big.step || "";
  $("cBigStep").placeholder = G ? String(G.h ? G.st.cabRows : G.st.cabCols) : "";
  $("cBigText").value = c.big.text;
  $("cBigStepRow").hidden = c.big.mode !== "num";
  $("cBigTextRow").hidden = c.big.mode !== "text";
  $("cInfoOn").checked = c.info.on;
  $("cInfoSrc").checked = c.info.src;
  $("cInfoSize").value = c.info.size > 0 ? String(c.info.size) : "";
  $("cInfoColor").value = c.info.color;
  updateCutInfo();
}
function setCutSize(i, v) {
  const c = CC(), G = cutGeom(c);
  if (!G) return;
  const s = G.sizes.slice(), n = s.length;
  if (n < 2) return refreshCutPanel();
  const j = i === n - 1 ? n - 2 : n - 1, room = s[i] + s[j] - 1;
  s[i] = Math.max(1, Math.min(room, v));
  s[j] = room + 1 - s[i];
  c.sizes = s;
  // поля обновляем на месте, панель не перерисовываем (иначе стрелки ▲▼ сбиваются)
  cutChanged(false);
  s.forEach((v2, k) => {
    const el = $("cSz" + k);
    if (el && document.activeElement !== el) el.value = v2;
  });
}
function addCut() {
  const cur = S(), st = cur && cur.kind === "led" ? cur : project.screens.find((s) => s.kind === "led");
  if (!st) return status("Нарезка — только для LED-масок. Сначала сделайте LED-маску", true);
  const c = freshCut(project.cuts.length, st.uid);
  c.dir = st.cabRows > st.cabCols ? "v" : "h";
  c.sizes = cutAutoSizes(cutBestParts(st, c.dir), c.dir === "v" ? st.cabRows : st.cabCols);
  project.cuts.push(c);
  project.cutCur = project.cuts.length - 1;
  cutChanged(true);
}
$("cAdd").onclick = addCut;
$("cAdd2").onclick = addCut;
$("cDel").onclick = async () => {
  if (!project.cuts.length) return;
  const c = CC();
  if (!await ask("Удалить нарезку?", "«".concat(c.name, "» будет удалена. Маска останется в проекте."), "", "Удалить", false)) return;
  project.cuts.splice(project.cutCur, 1);
  project.cutCur = Math.max(0, Math.min(project.cutCur, project.cuts.length - 1));
  cutChanged(true);
};
$("cSel").onchange = (e) => {
  project.cutCur = +e.target.value;
  refreshCutPanel();
  requestDraw();
};
$("cRename").onclick = async () => {
  const c = CC();
  if (!c) return;
  const v = await ask("Название нарезки", "", c.name, "OK");
  if (v != null && v.trim()) {
    c.name = v.trim().slice(0, 60);
    cutChanged(true);
  }
};
$("cSrc").onchange = (e) => {
  const c = CC(), st = project.screens.find((s) => s.uid === e.target.value);
  c.uid = e.target.value;
  if (st) c.sizes = cutAutoSizes(cutBestParts(st, c.dir), c.dir === "v" ? st.cabRows : st.cabCols);
  cutChanged(true);
};
document.querySelectorAll("#cDir button").forEach((b) => b.onclick = () => {
  const c = CC(), st = cutSrc(c);
  if (c.dir === b.dataset.dir) return;
  c.dir = b.dataset.dir;
  if (st) c.sizes = cutAutoSizes(cutBestParts(st, c.dir), c.dir === "v" ? st.cabRows : st.cabCols);
  cutChanged(true);
});
const setCutParts = (n) => {
  const c = CC(), G = cutGeom(c);
  if (!G) return;
  n = Math.max(1, Math.min(Math.min(64, G.L), n | 0));
  c.sizes = cutAutoSizes(n, G.L);
  cutChanged(true);
};
$("cParts").onchange = (e) => setCutParts(pint(e.target.value, 2));
stepper("cParts", (d) => {
  const G = cutGeom(CC());
  if (G) setCutParts(G.parts.length + d);
});
$("cEven").onclick = () => {
  const G = cutGeom(CC());
  if (G) setCutParts(G.parts.length);
};
$("cFit").onchange = (e) => {
  const c = CC(), G = cutGeom(c);
  c.fit = e.target.checked;
  if (!c.fit && G) {
    c.fw = Math.max(c.fw, G.needW);
    c.fh = Math.max(c.fh, G.needH);
  }
  cutChanged(true);
};
for (const [id, k] of [["cFW", "fw"], ["cFH", "fh"], ["cGap", "gap"]]) $(id).onchange = (e) => {
  CC()[k] = Math.max(k === "gap" ? 0 : 1, Math.min(32e3, pint(e.target.value, CC()[k])));
  cutChanged(true);
};
for (const [id, set] of [["cSep", (c, v) => c.sep = v], ["cMarks", (c, v) => c.marks = v], ["cBigOn", (c, v) => c.big.on = v], ["cInfoOn", (c, v) => c.info.on = v], ["cInfoSrc", (c, v) => c.info.src = v]]) $(id).onchange = (e) => {
  set(CC(), e.target.checked);
  cutChanged(false);
};
$("cBigMode").onchange = (e) => {
  CC().big.mode = e.target.value;
  if (e.target.value === "text" && !CC().big.text.trim()) CC().big.text = CUT_PANGRAM;
  CC().big.on = true;
  cutChanged(true);
};
$("cBigStep").onchange = (e) => {
  CC().big.step = Math.max(0, pint(e.target.value, 0));
  cutChanged(true);
};
$("cBigText").oninput = (e) => {
  CC().big.text = e.target.value.slice(0, 200);
  cutChanged(false);
};
$("cInfoSize").onchange = (e) => {
  CC().info.size = Math.max(0, pint(e.target.value, 0));
  cutChanged(false);
};
stepper("cInfoSize", (d) => {
  const c = CC(), G = cutGeom(c);
  if (!G) return;
  const p = G.parts[0], cur = c.info.size > 0 ? c.info.size : Math.round(Math.max(12, Math.min(p.w, p.h) * 0.28));
  c.info.size = Math.max(6, Math.round(cur * (d > 0 ? 1.1 : 1 / 1.1)));
  $("cInfoSize").value = c.info.size;
  cutChanged(false);
});
$("cInfoAuto").onclick = () => {
  CC().info.size = 0;
  $("cInfoSize").value = "";
  cutChanged(false);
};
$("cInfoColor").oninput = (e) => {
  CC().info.color = e.target.value.toUpperCase();
  cutChanged(false);
};
document.querySelectorAll("#cInfoPos button").forEach((b) => b.onclick = () => {
  CC().info.pos = b.dataset.pos;
  CC().info.on = true;
  $("cInfoOn").checked = true;
  cutChanged(false);
});
$("cFile").addEventListener("input", (e) => {
  const c = CC(), v = e.target.value.trim();
  c.file = v === cutFileAuto(c) ? "" : v;
  scheduleAutosave();
});
$("cFile").addEventListener("change", (e) => {
  const c = CC(), v = e.target.value.trim();
  c.file = v === cutFileAuto(c) ? "" : v;
  e.target.value = c.file || cutFileAuto(c);
  scheduleAutosave();
});
$("cPNG").onclick = async () => {
  const c = CC(), G = c && cutGeom(c);
  if (!G) return status("Выберите LED-маску для нарезки", true);
  busy("Рендер нарезки ".concat(G.W, "×").concat(G.H, "…"));
  await tick();
  try {
    const r = await renderCutPNG(c, async (p) => {
      busy("Рендер нарезки ".concat(G.W, "×").concat(G.H, "… ").concat(Math.round(p * 100), "%"));
      await tick();
    });
    busy("");
    await save("".concat(cutFileBase(c), ".png"), new Blob([r.png], { type: "image/png" }));
  } catch (e) {
    busy("");
    status("Ошибка рендера: " + e.message, true);
  }
};
