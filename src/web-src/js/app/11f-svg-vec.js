// 3.0.39: маски в SVG (галочка «SVG-маски в архив» в «Формировании ТЗ», по умолчанию выключена).
// Та же запись, что и для PDF (PdfVecCtx): контуры, линии, фигуры, обрезка, прозрачность и надписи своим шрифтом —
// вектором; растром (вставленной картинкой PNG) — только то, что иначе нельзя (картинки, тени, надписи системным шрифтом).
const svgN = (v) => {
  const r = Math.round(v * 100) / 100;
  return Object.is(r, -0) ? "0" : String(r);
};
const svgEsc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
function svgPathD(path, inv) {
  let s = "";
  for (const c of path) {
    if (c[0] === "Z") {
      s += "Z";
      continue;
    }
    const v = [];
    for (let i = 1; i < c.length; i += 2) {
      const p = inv ? pvAp(inv, c[i], c[i + 1]) : [c[i], c[i + 1]];
      v.push(svgN(p[0]), svgN(p[1]));
    }
    s += (c[0] === "M" ? "M" : c[0] === "L" ? "L" : "C") + v.join(" ");
  }
  return s;
}
// контуры букв (единицы шрифта) → d
function ufPathSvg(cmds, ox) {
  let s = "";
  const n = (v) => String(Math.round(v * 10) / 10);
  for (const c of cmds) {
    if (c[0] === "h") s += "Z";
    else if (c[0] === "c") s += "C" + n(c[1] + ox) + " " + n(c[2]) + " " + n(c[3] + ox) + " " + n(c[4]) + " " + n(c[5] + ox) + " " + n(c[6]);
    else s += (c[0] === "m" ? "M" : "L") + n(c[1] + ox) + " " + n(c[2]);
  }
  return s;
}
const svgRgb = (c) => "rgb(".concat(Math.round(c[0] * 255), ",").concat(Math.round(c[1] * 255), ",").concat(Math.round(c[2] * 255), ")");
const svgMat = (m) => "matrix(".concat(m.map((v) => String(Math.round(v * 1e6) / 1e6)).join(" "), ")");
class SvgVecCtx extends PdfVecCtx {
  constructor(W, H, k) {
    super(W, H, k, null, true);
    this.out = ['<rect width="'.concat(W, '" height="').concat(H, '" fill="#000"/>')];
    this.defs = [];
    this.gStack = [0];
    this.clipN = 0;
  }
  save() {
    this.stack.push({ st: Object.assign({}, this.st, { dash: this.st.dash.slice() }), M: this.M.slice() });
    this.gStack.push(0);
    this.ov.save();
  }
  restore() {
    if (!this.stack.length) return;
    this.flush();
    const s = this.stack.pop();
    this.st = s.st;
    this.M = s.M;
    this.ov.restore();
    const n = this.gStack.pop();
    for (let i = 0; i < n; i++) this.out.push("</g>");
  }
  flush() {
    const d = this.dirty;
    if (!d) return;
    this.dirty = null;
    const k = this.k, cw = this.ov.canvas.width, ch = this.ov.canvas.height;
    const X0 = Math.max(0, Math.floor(d[0] * k)), Y0 = Math.max(0, Math.floor(d[1] * k)), X1 = Math.min(cw, Math.ceil(d[2] * k)), Y1 = Math.min(ch, Math.ceil(d[3] * k));
    if (X1 <= X0 || Y1 <= Y0) return;
    const w = X1 - X0, h = Y1 - Y0, im = this.ov.getImageData(X0, Y0, w, h);
    let any = false;
    for (let i = 3; i < im.data.length; i += 4) if (im.data[i]) {
      any = true;
      break;
    }
    this.ov.save();
    this.ov.setTransform(1, 0, 0, 1, 0, 0);
    this.ov.clearRect(X0, Y0, w, h);
    this.ov.restore();
    if (!any) return;
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    cv.getContext("2d").putImageData(im, 0, 0);
    this.out.push('<image x="'.concat(svgN(X0 / k), '" y="').concat(svgN(Y0 / k), '" width="').concat(svgN(w / k), '" height="').concat(svgN(h / k), '" preserveAspectRatio="none" href="').concat(cv.toDataURL("image/png"), '"/>'));
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
    this.out.push('<path d="'.concat(svgPathD(path, null), '" fill="').concat(svgRgb(c), '"').concat(a < 1 ? ' fill-opacity="'.concat(+a.toFixed(3), '"') : "").concat(rule === "evenodd" ? ' fill-rule="evenodd"' : "", "/>"));
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
    const dash = s.dash.length && s.dash.some((v) => v > 0) ? ' stroke-dasharray="'.concat(s.dash.map(svgN).join(" "), '"').concat(s.dashOff ? ' stroke-dashoffset="'.concat(svgN(s.dashOff), '"') : "") : "";
    this.out.push('<path transform="'.concat(svgMat(this.M), '" d="').concat(svgPathD(path, inv), '" fill="none" stroke="').concat(svgRgb(c), '"').concat(a < 1 ? ' stroke-opacity="'.concat(+a.toFixed(3), '"') : "", ' stroke-width="').concat(svgN(s.lw), '"').concat(s.cap !== "butt" ? ' stroke-linecap="'.concat(s.cap, '"') : "").concat(s.join !== "miter" ? ' stroke-linejoin="'.concat(s.join, '"') : ' stroke-miterlimit="'.concat(svgN(s.miter), '"')).concat(dash, "/>"));
  }
  clearRect(x, y, w, h) {
    this.flush();
    this.ov.clearRect(x, y, w, h);
    this.out.push('<path d="'.concat(svgPathD(this._rectPath(x, y, w, h), null), '" fill="#000"/>'));
  }
  clip(a, b) {
    this.flush();
    const rule = typeof a === "string" ? a : b;
    if (a && typeof a === "object") {
      this.ov.clip(a, b);
      return;
    }
    this.ov.clip(rule || "nonzero");
    const id = "c" + this.clipN++;
    this.defs.push('<clipPath id="'.concat(id, '" clipPathUnits="userSpaceOnUse"><path d="').concat(svgPathD(this.path, null) || "M0 0", '"').concat(rule === "evenodd" ? ' clip-rule="evenodd"' : "", "/></clipPath>"));
    this.out.push('<g clip-path="url(#'.concat(id, ')">'));
    this.gStack[this.gStack.length - 1]++;
  }
  _textOut(c, a, parts) {
    let o = '<g transform="'.concat(svgMat(this.M), '" fill="').concat(svgRgb(c), '" stroke="').concat(svgRgb(c), '" stroke-linejoin="round"').concat(a < 1 ? ' opacity="'.concat(+a.toFixed(3), '"') : "", ">");
    for (const p of parts) {
      const d = p.glyphs.map(([cmds, ox]) => ufPathSvg(cmds, ox)).join("");
      if (!d) continue;
      o += '<path transform="'.concat(svgMat(p.cm), '" d="').concat(d, '"').concat(p.op === "S" ? ' fill="none"' : "").concat(p.op === "f" ? ' stroke="none"' : ' stroke-width="'.concat(svgN(p.lw), '"'), "/>");
    }
    return o + "</g>";
  }
  finish() {
    while (this.stack.length) this.restore();
    this.flush();
    while (this.gStack[0]-- > 0) this.out.push("</g>");
    return '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="'.concat(this.W, '" height="').concat(this.H, '" viewBox="0 0 ').concat(this.W, " ").concat(this.H, '">').concat(this.defs.length ? "<defs>" + this.defs.join("") + "</defs>" : "").concat(this.out.join("\n"), "</svg>\n");
  }
}
// маска → текст SVG (null — не получилось); растровый слой ~ размер маски, но не больше 20 Мп
function svgVecRecord(vec) {
  const W = vec.W, H = vec.H;
  if (!W || !H || typeof vec.paint !== "function") return null;
  const k = Math.max(0.05, Math.min(1, Math.sqrt(2e7 / (W * H))));
  try {
    const c = new SvgVecCtx(W, H, k);
    vec.paint(c);
    return c.finish();
  } catch (e) {
    console.warn("SVG: не получилось", e);
    return null;
  }
}
