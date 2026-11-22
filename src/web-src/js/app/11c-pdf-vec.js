// 3.0.35: маски в PDF — вектором. Та же функция рисования (drawMask, paintField, paintCut …) рисует в «записывающий»
// контекст: заливки, линии, дуги, фигуры, обрезка, прозрачность идут в PDF векторными командами, а текст, картинки,
// градиенты и тени — в прозрачный растровый слой высокого разрешения. Слой выгружается в PDF кусками (по рамке
// нарисованного) каждый раз, когда поверх него рисуется вектор, при restore() и clip() — порядок наложения и обрезка
// сохраняются. Результат — Form XObject в пикселях маски (ось Y вниз), страница ставит его вместо PNG.
const PV_K = 0.5522847498307936;
function pvMul(m, n) {
  return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
}
function pvInv(m) {
  const d = m[0] * m[3] - m[1] * m[2];
  if (!d || !isFinite(d)) return null;
  return [m[3] / d, -m[1] / d, -m[2] / d, m[0] / d, (m[2] * m[5] - m[3] * m[4]) / d, (m[1] * m[4] - m[0] * m[5]) / d];
}
const pvAp = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const pvN = (v) => {
  const r = Math.round(v * 100) / 100;
  return Object.is(r, -0) ? "0" : String(r);
};
let pvColorCv = null;
// цвет CSS → [r, g, b, a] (0..1); не строка (градиент, узор) → null
function pvColor(v) {
  if (typeof v !== "string") return null;
  if (!pvColorCv) pvColorCv = document.createElement("canvas").getContext("2d");
  pvColorCv.fillStyle = "#000";
  pvColorCv.fillStyle = v;
  const s = pvColorCv.fillStyle;
  if (s[0] === "#") return [parseInt(s.slice(1, 3), 16) / 255, parseInt(s.slice(3, 5), 16) / 255, parseInt(s.slice(5, 7), 16) / 255, 1];
  const m = s.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)/);
  if (!m) return [0, 0, 0, 1];
  return [+m[1] / 255, +m[2] / 255, +m[3] / 255, m[4] == null ? 1 : +m[4]];
}
class PdfVecCtx {
  constructor(W, H, k, reg, clear) {
    this.reg = reg || null;
    this.fontRes = new Map();
    this.W = W;
    this.H = H;
    this.k = k;
    const cv = document.createElement("canvas");
    cv.width = Math.max(1, Math.ceil(W * k));
    cv.height = Math.max(1, Math.ceil(H * k));
    this.ov = cv.getContext("2d", { willReadFrequently: true });
    this.ov.setTransform(k, 0, 0, k, 0, 0);
    this.canvas = { width: W, height: H };
    this.out = [];
    this.layers = [];
    this.gs = new Map();
    this.M = [1, 0, 0, 1, 0, 0];
    this.path = [];
    this.cur = null;
    this.dirty = null;
    this.st = { fill: "#000000", stroke: "#000000", alpha: 1, lw: 1, cap: "butt", join: "miter", miter: 10, dash: [], dashOff: 0, comp: "source-over", sBlur: 0, sColor: "rgba(0, 0, 0, 0)", sx: 0, sy: 0 };
    this.stack = [];
    this.pdfSt = {};
    this.pdfStack = [];
    // холст без прозрачности изначально чёрный — как в renderBands
    this.out.push(clear ? "1 0 0 -1 0 ".concat(pvN(H), " cm\n") : "1 0 0 -1 0 ".concat(pvN(H), " cm 0 0 0 rg 0 0 ").concat(pvN(W), " ").concat(pvN(H), " re f\n"));
  }
  // ---- состояние ----
  save() {
    this.stack.push({ st: Object.assign({}, this.st, { dash: this.st.dash.slice() }), M: this.M.slice() });
    this.pdfStack.push(Object.assign({}, this.pdfSt));
    this.out.push("q\n");
    this.ov.save();
  }
  restore() {
    if (!this.stack.length) return;
    this.flush();
    const s = this.stack.pop();
    this.st = s.st;
    this.M = s.M;
    this.pdfSt = this.pdfStack.pop();
    this.out.push("Q\n");
    this.ov.restore();
  }
  get fillStyle() {
    return this.ov.fillStyle;
  }
  set fillStyle(v) {
    this.st.fill = v;
    this.ov.fillStyle = v;
  }
  get strokeStyle() {
    return this.ov.strokeStyle;
  }
  set strokeStyle(v) {
    this.st.stroke = v;
    this.ov.strokeStyle = v;
  }
  get globalAlpha() {
    return this.st.alpha;
  }
  set globalAlpha(v) {
    if (!isFinite(v) || v < 0 || v > 1) return;
    this.st.alpha = v;
    this.ov.globalAlpha = v;
  }
  get lineWidth() {
    return this.st.lw;
  }
  set lineWidth(v) {
    if (!(v > 0) || !isFinite(v)) return;
    this.st.lw = v;
    this.ov.lineWidth = v;
  }
  get lineCap() {
    return this.st.cap;
  }
  set lineCap(v) {
    this.st.cap = v;
    this.ov.lineCap = v;
  }
  get lineJoin() {
    return this.st.join;
  }
  set lineJoin(v) {
    this.st.join = v;
    this.ov.lineJoin = v;
  }
  get miterLimit() {
    return this.st.miter;
  }
  set miterLimit(v) {
    if (v > 0) {
      this.st.miter = v;
      this.ov.miterLimit = v;
    }
  }
  get lineDashOffset() {
    return this.st.dashOff;
  }
  set lineDashOffset(v) {
    this.st.dashOff = +v || 0;
    this.ov.lineDashOffset = v;
  }
  setLineDash(a) {
    const d = (a || []).map(Number);
    if (d.some((x) => !isFinite(x) || x < 0)) return;
    this.st.dash = d.length % 2 ? d.concat(d) : d;
    this.ov.setLineDash(d);
  }
  getLineDash() {
    return this.st.dash.slice();
  }
  get globalCompositeOperation() {
    return this.st.comp;
  }
  set globalCompositeOperation(v) {
    this.st.comp = v;
    this.ov.globalCompositeOperation = v;
  }
  get shadowBlur() {
    return this.st.sBlur;
  }
  set shadowBlur(v) {
    this.st.sBlur = +v || 0;
    this.ov.shadowBlur = (+v || 0) * this.k;
  }
  get shadowColor() {
    return this.st.sColor;
  }
  set shadowColor(v) {
    this.st.sColor = v;
    this.ov.shadowColor = v;
  }
  get shadowOffsetX() {
    return this.st.sx;
  }
  set shadowOffsetX(v) {
    this.st.sx = +v || 0;
    this.ov.shadowOffsetX = (+v || 0) * this.k;
  }
  get shadowOffsetY() {
    return this.st.sy;
  }
  set shadowOffsetY(v) {
    this.st.sy = +v || 0;
    this.ov.shadowOffsetY = (+v || 0) * this.k;
  }
  // текстовые и прочие свойства — только в растровый слой
  get font() {
    return this.ov.font;
  }
  set font(v) {
    this.ov.font = v;
  }
  get textAlign() {
    return this.ov.textAlign;
  }
  set textAlign(v) {
    this.ov.textAlign = v;
  }
  get textBaseline() {
    return this.ov.textBaseline;
  }
  set textBaseline(v) {
    this.ov.textBaseline = v;
  }
  get direction() {
    return this.ov.direction;
  }
  set direction(v) {
    this.ov.direction = v;
  }
  get imageSmoothingEnabled() {
    return this.ov.imageSmoothingEnabled;
  }
  set imageSmoothingEnabled(v) {
    this.ov.imageSmoothingEnabled = v;
  }
  get imageSmoothingQuality() {
    return this.ov.imageSmoothingQuality;
  }
  set imageSmoothingQuality(v) {
    this.ov.imageSmoothingQuality = v;
  }
  get filter() {
    return this.ov.filter;
  }
  set filter(v) {
    this.ov.filter = v;
  }
  get letterSpacing() {
    return this.ov.letterSpacing;
  }
  set letterSpacing(v) {
    this.ov.letterSpacing = v;
  }
  measureText(t) {
    return this.ov.measureText(t);
  }
  createLinearGradient(a, b, c, d) {
    return this.ov.createLinearGradient(a, b, c, d);
  }
  createRadialGradient(a, b, c, d, e, f) {
    return this.ov.createRadialGradient(a, b, c, d, e, f);
  }
  createPattern(a, b) {
    return this.ov.createPattern(a, b);
  }
  // ---- преобразования ----
  _syncT() {
    const m = this.M, k = this.k;
    this.ov.setTransform(m[0] * k, m[1] * k, m[2] * k, m[3] * k, m[4] * k, m[5] * k);
  }
  transform(a, b, c, d, e, f) {
    this.M = pvMul(this.M, [a, b, c, d, e, f]);
    this._syncT();
  }
  translate(x, y) {
    this.transform(1, 0, 0, 1, x, y);
  }
  scale(x, y) {
    this.transform(x, 0, 0, y, 0, 0);
  }
  rotate(r) {
    const c = Math.cos(r), s = Math.sin(r);
    this.transform(c, s, -s, c, 0, 0);
  }
  setTransform(a, b, c, d, e, f) {
    if (a && typeof a === "object") this.M = [a.a, a.b, a.c, a.d, a.e, a.f];
    else this.M = [a, b, c, d, e, f];
    this._syncT();
  }
  resetTransform() {
    this.setTransform(1, 0, 0, 1, 0, 0);
  }
  getTransform() {
    const m = this.M;
    return new DOMMatrix([m[0], m[1], m[2], m[3], m[4], m[5]]);
  }
  // ---- контур (точки хранятся в пикселях маски, уже с преобразованием) ----
  beginPath() {
    this.path = [];
    this.cur = null;
    this.ov.beginPath();
  }
  _pt(x, y) {
    return pvAp(this.M, x, y);
  }
  moveTo(x, y) {
    const p = this._pt(x, y);
    this.path.push(["M", p[0], p[1]]);
    this.cur = p;
    this.start = p;
    this.ov.moveTo(x, y);
  }
  lineTo(x, y) {
    const p = this._pt(x, y);
    this.path.push([this.cur ? "L" : "M", p[0], p[1]]);
    if (!this.cur) this.start = p;
    this.cur = p;
    this.ov.lineTo(x, y);
  }
  closePath() {
    if (this.cur) {
      this.path.push(["Z"]);
      this.cur = this.start;
    }
    this.ov.closePath();
  }
  _cubic(x1, y1, x2, y2, x, y) {
    const a = this._pt(x1, y1), b = this._pt(x2, y2), p = this._pt(x, y);
    if (!this.cur) {
      this.path.push(["M", a[0], a[1]]);
      this.start = a;
    }
    this.path.push(["C", a[0], a[1], b[0], b[1], p[0], p[1]]);
    this.cur = p;
  }
  bezierCurveTo(x1, y1, x2, y2, x, y) {
    this._cubic(x1, y1, x2, y2, x, y);
    this.ov.bezierCurveTo(x1, y1, x2, y2, x, y);
  }
  quadraticCurveTo(qx, qy, x, y) {
    const inv = pvInv(this.M), c = this.cur && inv ? pvAp(inv, this.cur[0], this.cur[1]) : [qx, qy];
    this._cubic(c[0] + 2 / 3 * (qx - c[0]), c[1] + 2 / 3 * (qy - c[1]), x + 2 / 3 * (qx - x), y + 2 / 3 * (qy - y), x, y);
    this.ov.quadraticCurveTo(qx, qy, x, y);
  }
  rect(x, y, w, h) {
    const a = this._pt(x, y), b = this._pt(x + w, y), c = this._pt(x + w, y + h), d = this._pt(x, y + h);
    this.path.push(["M", a[0], a[1]], ["L", b[0], b[1]], ["L", c[0], c[1]], ["L", d[0], d[1]], ["Z"]);
    this.cur = a;
    this.start = a;
    this.ov.rect(x, y, w, h);
  }
  // дуга эллипса (центр, радиусы, поворот, углы) → кривые Безье в локальных координатах
  _ell(cx, cy, rx, ry, rot, a0, a1, ccw) {
    let da = a1 - a0;
    const T = 2 * Math.PI;
    if (!ccw) {
      if (da >= T) da = T;
      else {
        da = da % T;
        if (da < 0) da += T;
      }
    } else if (-da >= T) da = -T;
    else {
      da = da % T;
      if (da > 0) da -= T;
    }
    const cr = Math.cos(rot), sr = Math.sin(rot);
    const P = (a) => {
      const x = rx * Math.cos(a), y = ry * Math.sin(a);
      return [cx + x * cr - y * sr, cy + x * sr + y * cr];
    };
    const D = (a) => {
      const x = -rx * Math.sin(a), y = ry * Math.cos(a);
      return [x * cr - y * sr, x * sr + y * cr];
    };
    const s0 = P(a0), q0 = this._pt(s0[0], s0[1]);
    if (this.cur) this.path.push(["L", q0[0], q0[1]]);
    else {
      this.path.push(["M", q0[0], q0[1]]);
      this.start = q0;
    }
    this.cur = q0;
    const n = Math.max(1, Math.ceil(Math.abs(da) / (Math.PI / 2) - 1e-9));
    const step = da / n, h = 4 / 3 * Math.tan(step / 4);
    for (let i = 0; i < n; i++) {
      const t0 = a0 + i * step, t1 = t0 + step, p0 = P(t0), p1 = P(t1), d0 = D(t0), d1 = D(t1);
      this._cubic(p0[0] + h * d0[0], p0[1] + h * d0[1], p1[0] - h * d1[0], p1[1] - h * d1[1], p1[0], p1[1]);
    }
  }
  arc(x, y, r, a0, a1, ccw) {
    if (r < 0) return;
    this._ell(x, y, r, r, 0, a0, a1, !!ccw);
    this.ov.arc(x, y, r, a0, a1, !!ccw);
  }
  ellipse(x, y, rx, ry, rot, a0, a1, ccw) {
    if (rx < 0 || ry < 0) return;
    this._ell(x, y, rx, ry, rot, a0, a1, !!ccw);
    this.ov.ellipse(x, y, rx, ry, rot, a0, a1, !!ccw);
  }
  arcTo(x1, y1, x2, y2, r) {
    const inv = pvInv(this.M);
    this.ov.arcTo(x1, y1, x2, y2, r);
    if (!this.cur || !inv) {
      this.moveTo(x1, y1);
      return;
    }
    const p0 = pvAp(inv, this.cur[0], this.cur[1]);
    const ax = p0[0] - x1, ay = p0[1] - y1, bx = x2 - x1, by = y2 - y1, la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
    const cross = ax * by - ay * bx;
    if (!r || !la || !lb || Math.abs(cross) < 1e-9) {
      const p = this._pt(x1, y1);
      this.path.push(["L", p[0], p[1]]);
      this.cur = p;
      return;
    }
    const cosT = (ax * bx + ay * by) / (la * lb), th = Math.acos(Math.max(-1, Math.min(1, cosT)));
    const t = r / Math.tan(th / 2);
    const t0 = [x1 + ax / la * t, y1 + ay / la * t], t1 = [x1 + bx / lb * t, y1 + by / lb * t];
    const ux = ax / la + bx / lb, uy = ay / la + by / lb, ul = Math.hypot(ux, uy), dc = r / Math.sin(th / 2);
    const c = [x1 + ux / ul * dc, y1 + uy / ul * dc];
    const s = Math.atan2(t0[1] - c[1], t0[0] - c[0]), e = Math.atan2(t1[1] - c[1], t1[0] - c[0]);
    const pt = this._pt(t0[0], t0[1]);
    this.path.push(["L", pt[0], pt[1]]);
    this.cur = pt;
    this._ell(c[0], c[1], r, r, 0, s, e, cross > 0);
  }
  roundRect(x, y, w, h, radii) {
    let r = radii == null ? 0 : radii;
    if (Array.isArray(r)) r = r.length ? r[0] : 0;
    if (r && typeof r === "object") r = r.x || 0;
    r = Math.max(0, Math.min(+r || 0, Math.abs(w) / 2, Math.abs(h) / 2));
    const inv = this.ov;
    this.ov = { moveTo() {}, lineTo() {}, arcTo() {}, closePath() {}, arc() {}, ellipse() {} };
    try {
      this.moveTo(x + r, y);
      this.lineTo(x + w - r, y);
      if (r) this._ell(x + w - r, y + r, r, r, 0, -Math.PI / 2, 0, false);
      this.lineTo(x + w, y + h - r);
      if (r) this._ell(x + w - r, y + h - r, r, r, 0, 0, Math.PI / 2, false);
      this.lineTo(x + r, y + h);
      if (r) this._ell(x + r, y + h - r, r, r, 0, Math.PI / 2, Math.PI, false);
      this.lineTo(x, y + r);
      if (r) this._ell(x + r, y + r, r, r, 0, Math.PI, Math.PI * 1.5, false);
      this.closePath();
    } finally {
      this.ov = inv;
    }
    if (this.ov.roundRect) this.ov.roundRect(x, y, w, h, radii);
    else this.ov.rect(x, y, w, h);
  }
  // ---- растровый слой ----
  _grow(x0, y0, x1, y1) {
    const d = this.dirty;
    if (!d) this.dirty = [x0, y0, x1, y1];
    else {
      d[0] = Math.min(d[0], x0);
      d[1] = Math.min(d[1], y0);
      d[2] = Math.max(d[2], x1);
      d[3] = Math.max(d[3], y1);
    }
  }
  _growPts(pts, pad) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of pts) {
      x0 = Math.min(x0, p[0]);
      y0 = Math.min(y0, p[1]);
      x1 = Math.max(x1, p[0]);
      y1 = Math.max(y1, p[1]);
    }
    if (x0 > x1) return;
    const s = this.st, sh = s.sBlur * 2 + Math.max(Math.abs(s.sx), Math.abs(s.sy));
    this._grow(x0 - pad - sh, y0 - pad - sh, x1 + pad + sh, y1 + pad + sh);
  }
  _pathPts() {
    const pts = [];
    for (const c of this.path) for (let i = 1; i < c.length; i += 2) pts.push([c[i], c[i + 1]]);
    return pts;
  }
  _scale() {
    const m = this.M;
    return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1;
  }
  // выгрузить нарисованное в растровом слое (только рамка нарисованного) и очистить его
  flush() {
    const d = this.dirty;
    if (!d) return;
    this.dirty = null;
    const k = this.k, cw = this.ov.canvas.width, ch = this.ov.canvas.height;
    const X0 = Math.max(0, Math.floor(d[0] * k)), Y0 = Math.max(0, Math.floor(d[1] * k)), X1 = Math.min(cw, Math.ceil(d[2] * k)), Y1 = Math.min(ch, Math.ceil(d[3] * k));
    if (X1 <= X0 || Y1 <= Y0) return;
    const w = X1 - X0, h = Y1 - Y0, px = this.ov.getImageData(X0, Y0, w, h).data;
    const rgb = new Uint8Array(w * h * 3), al = new Uint8Array(w * h);
    let any = false;
    for (let i = 0, j = 0, q = 0; i < px.length; i += 4, j += 3, q++) {
      const a = px[i + 3];
      if (!a) continue;
      any = true;
      rgb[j] = px[i];
      rgb[j + 1] = px[i + 1];
      rgb[j + 2] = px[i + 2];
      al[q] = a;
    }
    // очистить под текущей обрезкой (всё нарисованное с прошлой выгрузки лежит внутри неё)
    this.ov.save();
    this.ov.setTransform(1, 0, 0, 1, 0, 0);
    this.ov.clearRect(X0, Y0, w, h);
    this.ov.restore();
    if (!any) return;
    const name = "R" + this.layers.length;
    this.layers.push({ name, w, h, rgb, al });
    // рамка слоя — в пикселях маски; изображение ставится «головой вверх» в системе с осью Y вниз
    const x = X0 / k, y = Y0 / k, ww = w / k, hh = h / k;
    this.out.push("q ".concat(pvN(ww), " 0 0 ").concat(pvN(-hh), " ").concat(pvN(x), " ").concat(pvN(y + hh), " cm /").concat(name, " Do Q\n"));
  }
  // ---- вывод вектора ----
  _gsName(ca, CA) {
    const key = ca.toFixed(3) + "," + CA.toFixed(3);
    if (!this.gs.has(key)) this.gs.set(key, "G" + this.gs.size);
    return this.gs.get(key);
  }
  _pathStr(pts, inv) {
    let s = "";
    for (const c of pts) {
      if (c[0] === "Z") {
        s += "h\n";
        continue;
      }
      const v = [];
      for (let i = 1; i < c.length; i += 2) {
        const p = inv ? pvAp(inv, c[i], c[i + 1]) : [c[i], c[i + 1]];
        v.push(pvN(p[0]), pvN(p[1]));
      }
      s += v.join(" ") + (c[0] === "M" ? " m\n" : c[0] === "L" ? " l\n" : " c\n");
    }
    return s;
  }
  _rasterOnly(style) {
    const s = this.st;
    if (s.comp !== "source-over") return true;
    if (this.ov.filter && this.ov.filter !== "none") return true;
    const sc = pvColor(s.sColor);
    if (sc && sc[3] > 0 && (s.sBlur > 0 || s.sx || s.sy)) return true;
    return !pvColor(style);
  }
  _fillWith(path, rule) {
    if (!path.length) return;
    if (this._rasterOnly(this.st.fill)) {
      this._growPts(this._ptsOf(path), 2);
      return "raster";
    }
    const c = pvColor(this.st.fill), a = c[3] * this.st.alpha;
    if (a <= 0) return;
    this.flush();
    this.out.push("/".concat(this._gsName(a, 1), " gs ").concat(pvN(c[0]), " ").concat(pvN(c[1]), " ").concat(pvN(c[2]), " rg\n").concat(this._pathStr(path, null)).concat(rule === "evenodd" ? "f*\n" : "f\n"));
  }
  _ptsOf(path) {
    const pts = [];
    for (const c of path) for (let i = 1; i < c.length; i += 2) pts.push([c[i], c[i + 1]]);
    return pts;
  }
  _strokeWith(path) {
    if (!path.length) return;
    const s = this.st;
    if (this._rasterOnly(s.stroke)) {
      this._growPts(this._ptsOf(path), s.lw * this._scale() * (s.join === "miter" ? s.miter : 1) / 2 + 2);
      return "raster";
    }
    const c = pvColor(s.stroke), a = c[3] * s.alpha, inv = pvInv(this.M);
    if (a <= 0 || !inv) return;
    this.flush();
    const m = this.M, cap = { butt: 0, round: 1, square: 2 }[s.cap] || 0, join = { miter: 0, round: 1, bevel: 2 }[s.join] || 0;
    const dash = s.dash.length && s.dash.some((v) => v > 0) ? "[".concat(s.dash.map(pvN).join(" "), "] ").concat(pvN(s.dashOff), " d ") : "[] 0 d ";
    this.out.push("q ".concat([m[0], m[1], m[2], m[3], m[4], m[5]].map((v) => String(Math.round(v * 1e6) / 1e6)).join(" "), " cm /").concat(this._gsName(1, a), " gs ").concat(pvN(c[0]), " ").concat(pvN(c[1]), " ").concat(pvN(c[2]), " RG ").concat(pvN(s.lw), " w ").concat(cap, " J ").concat(join, " j ").concat(pvN(s.miter), " M ").concat(dash, "\n").concat(this._pathStr(path, inv), "S Q\n"));
  }
  fill(a, b) {
    let rule = typeof a === "string" ? a : b;
    if (a && typeof a === "object") {
      // Path2D — только в растровый слой (в коде масок не используется)
      this.ov.fill(a, b);
      this._grow(0, 0, this.W, this.H);
      return;
    }
    if (this._fillWith(this.path, rule) === "raster") this.ov.fill(rule || "nonzero");
  }
  stroke(p) {
    if (p && typeof p === "object") {
      this.ov.stroke(p);
      this._grow(0, 0, this.W, this.H);
      return;
    }
    if (this._strokeWith(this.path) === "raster") this.ov.stroke();
  }
  _rectPath(x, y, w, h) {
    const a = this._pt(x, y), b = this._pt(x + w, y), c = this._pt(x + w, y + h), d = this._pt(x, y + h);
    return [["M", a[0], a[1]], ["L", b[0], b[1]], ["L", c[0], c[1]], ["L", d[0], d[1]], ["Z"]];
  }
  fillRect(x, y, w, h) {
    if (!w || !h) return;
    if (this._fillWith(this._rectPath(x, y, w, h)) === "raster") this.ov.fillRect(x, y, w, h);
  }
  strokeRect(x, y, w, h) {
    if (this._strokeWith(this._rectPath(x, y, w, h)) === "raster") this.ov.strokeRect(x, y, w, h);
  }
  clearRect(x, y, w, h) {
    // холст без прозрачности: стёртое место — чёрное
    this.flush();
    this.ov.clearRect(x, y, w, h);
    this.out.push("/".concat(this._gsName(1, 1), " gs 0 0 0 rg\n").concat(this._pathStr(this._rectPath(x, y, w, h), null), "f\n"));
  }
  clip(a, b) {
    this.flush();
    const rule = typeof a === "string" ? a : b;
    if (a && typeof a === "object") {
      this.ov.clip(a, b);
      return;
    }
    this.ov.clip(rule || "nonzero");
    if (!this.path.length) this.out.push("0 0 m W n\n");
    else this.out.push(this._pathStr(this.path, null) + (rule === "evenodd" ? "W* n\n" : "W n\n"));
  }
  _textBox(t, x, y, maxW, pad) {
    const m = this.ov.measureText(t);
    let L = m.actualBoundingBoxLeft, R = m.actualBoundingBoxRight, A = m.actualBoundingBoxAscent, D = m.actualBoundingBoxDescent;
    if (!isFinite(L) || !isFinite(R) || !isFinite(A) || !isFinite(D)) {
      const fs = parseFloat((this.ov.font.match(/([\d.]+)px/) || [0, 16])[1]);
      L = m.width;
      R = m.width;
      A = fs * 1.2;
      D = fs * 1.2;
    }
    if (maxW != null && m.width > maxW && m.width > 0) {
      const sx = maxW / m.width;
      L *= sx;
      R *= sx;
    }
    // measureText не зависит от преобразования — размеры в единицах маски
    const pts = [this._pt(x - L - 2, y - A - 2), this._pt(x + R + 2, y - A - 2), this._pt(x + R + 2, y + D + 2), this._pt(x - L - 2, y + D + 2)];
    this._growPts(pts, pad);
  }
  // 3.0.37: надпись своим шрифтом — настоящим текстом PDF (шрифт встраивается). false — не получилось, тогда картинкой
  // 3.0.38: надпись своим шрифтом — в кривых (контуры букв из файла шрифта). false — не получилось, тогда картинкой
  _vecText(t, x, y, maxW, stroke) {
    // шрифты с известными контурами — в порядке списка семейств (как подбирает браузер): свой (LMG UF n), LMG Mask, LMG Sans
    const fnt = this.ov.font, m0 = fnt.match(/([\d.]+)px\s+(.*)$/);
    if (!m0) return false;
    const size = +m0[1], pre = fnt.slice(0, fnt.indexOf(m0[0])), bold = /\bbold\b|\b[6-9]00\b/.test(pre), ital = /\b(italic|oblique)\b/.test(pre);
    const chain = [];
    for (const fam0 of m0[2].split(",")) {
      const fam = fam0.trim().replace(/^["']|["']$/g, ""), u = fam.match(/^LMG UF (\d)$/);
      if (u && typeof ufPick === "function") {
        const p = ufPick(+u[1], bold, ital);
        if (p) chain.push(p);
      } else if (typeof BUNDLED_FACES !== "undefined" && BUNDLED_FACES[fam] && typeof bundledPick === "function") {
        const p = bundledPick(fam, bold, ital);
        if (p) chain.push(p);
      } else break;
    }
    if (!chain.length) return false;
    const s = this.st, style = stroke ? s.stroke : s.fill;
    if (this._rasterOnly(style) || !(size > 0)) return false;
    const c = pvColor(style), a = c[3] * s.alpha, inv = pvInv(this.M);
    if (a <= 0) return true;
    if (!inv) return false;
    // буквы → начертания (по порядку ступеней, как браузер), подряд одинаковые — одним куском
    const tiers = chain, runs = [];
    for (const ch of t) {
      const cp = ch.codePointAt(0);
      const p = tiers.find((q) => q.face.cmap.has(cp));
      if (!p) return false;
      const g = p.face.cmap.get(cp), last = runs[runs.length - 1];
      if (last && last.p === p) last.g.push(g);
      else runs.push({ p, g: [g] });
    }
    // начало строки и базовая линия — по замеру браузера (выравнивание и базовая линия как на холсте)
    const ov = this.ov, keepA = ov.textAlign, keepB = ov.textBaseline, mc = ov.measureText(t);
    ov.textAlign = "left";
    ov.textBaseline = "alphabetic";
    const mr = ov.measureText(t);
    ov.textAlign = keepA;
    ov.textBaseline = keepB;
    let x0 = x - mc.actualBoundingBoxLeft + mr.actualBoundingBoxLeft;
    const yb = y - mc.actualBoundingBoxAscent + mr.actualBoundingBoxAscent;
    let hs = 1;
    if (maxW != null && mr.width > maxW && mr.width > 0) {
      hs = Math.max(0.01, maxW / mr.width);
      x0 = x + (x0 - x) * hs;
    }
    if (!isFinite(x0) || !isFinite(yb)) return false;
    this.flush();
    // куски текста: контуры букв в единицах шрифта + матрица в местные координаты (y вниз), наклон и сжатие по maxWidth
    const parts = [];
    let adv = 0;
    for (const r of runs) {
      const f = r.p.face, k = size / f.upm, sk = r.p.fakeItal ? 0.25 : 0, fb = r.p.fakeBold && !stroke;
      const glyphs = [];
      let gx = 0;
      for (const g of r.g) {
        glyphs.push([ufGlyphPath(f, g), gx]);
        gx += f.adv[g] || 0;
      }
      const lw = stroke ? s.lw / k : fb ? size * (size <= 9 ? 1 / 24 : size >= 36 ? 1 / 32 : 1 / 24 + (size - 9) / 27 * (1 / 32 - 1 / 24)) / k : 0;
      parts.push({ cm: [hs * k, 0, hs * k * sk, -k, x0 + adv * hs, yb], lw, op: stroke ? "S" : fb ? "B" : "f", glyphs });
      adv += gx * k;
    }
    this.out.push(this._textOut(c, a, parts));
    return true;
  }
  _textOut(c, a, parts) {
    const m = this.M, col = "".concat(pvN(c[0]), " ").concat(pvN(c[1]), " ").concat(pvN(c[2])), R6 = (v) => String(Math.round(v * 1e6) / 1e6);
    let o = "q ".concat(m.map(R6).join(" "), " cm /").concat(this._gsName(a, a), " gs ").concat(col, " rg ").concat(col, " RG 1 j\n");
    for (const p of parts) {
      const path = p.glyphs.map(([cmds, ox]) => ufPathStr(cmds, ox)).join("");
      if (path) o += "q ".concat(p.cm.map(R6).join(" "), " cm ").concat(p.lw ? R6(p.lw) + " w " : "").concat(path, p.op, " Q\n");
    }
    return o + "Q\n";
  }
  fillText(t, x, y, maxW) {
    if (t == null || t === "") return;
    t = String(t);
    if (this._vecText(t, x, y, maxW, false)) return;
    this._textBox(t, x, y, maxW, 2);
    if (maxW == null) this.ov.fillText(t, x, y);
    else this.ov.fillText(t, x, y, maxW);
  }
  strokeText(t, x, y, maxW) {
    if (t == null || t === "") return;
    t = String(t);
    if (this._vecText(t, x, y, maxW, true)) return;
    this._textBox(t, x, y, maxW, this.st.lw * this._scale() + 2);
    if (maxW == null) this.ov.strokeText(t, x, y);
    else this.ov.strokeText(t, x, y, maxW);
  }
  drawImage(im) {
    const a = arguments;
    let dx, dy, dw, dh;
    if (a.length >= 9) {
      dx = a[5];
      dy = a[6];
      dw = a[7];
      dh = a[8];
    } else {
      dx = a[1];
      dy = a[2];
      dw = a.length >= 5 ? a[3] : im.naturalWidth || im.videoWidth || im.width;
      dh = a.length >= 5 ? a[4] : im.naturalHeight || im.videoHeight || im.height;
    }
    this._growPts([this._pt(dx, dy), this._pt(dx + dw, dy), this._pt(dx + dw, dy + dh), this._pt(dx, dy + dh)], 1);
    this.ov.drawImage.apply(this.ov, a);
  }
  putImageData() {
    this.ov.putImageData.apply(this.ov, arguments);
    this._grow(0, 0, this.W, this.H);
  }
  getImageData(x, y, w, h) {
    return this.ov.getImageData(x * this.k, y * this.k, Math.max(1, w * this.k), Math.max(1, h * this.k));
  }
  isPointInPath() {
    return this.ov.isPointInPath.apply(this.ov, arguments);
  }
  // ---- итог ----
  finish() {
    while (this.stack.length) this.restore();
    this.flush();
    return { content: this.out.join(""), layers: this.layers, gs: this.gs, fonts: this.fontRes };
  }
}
// Нарисовать маску вектором: W×H — размер маски в пикселях, ptW×ptH — её размер на листе в пунктах.
// Возвращает { content, layers, gs } или null, если рисование не удалось (тогда в PDF остаётся PNG).
function pdfVecRecord(vec, ptW, ptH, reg, clear) {
  const W = vec.W, H = vec.H;
  if (!W || !H || typeof vec.paint !== "function") return null;
  // разрешение растрового слоя ≈ 300 точек на дюйм на листе, не больше 20 Мп и не крупнее 4× маски
  let k = Math.min(4, Math.max(ptW / W, ptH / H) * 300 / 72);
  k = Math.min(k, Math.sqrt(2e7 / (W * H)));
  k = Math.max(k, 0.02);
  try {
    const c = new PdfVecCtx(W, H, k, reg, clear);
    vec.paint(c);
    return c.finish();
  } catch (e) {
    console.warn("PDF: вектор не получился, остаётся PNG", e);
    return null;
  }
}
