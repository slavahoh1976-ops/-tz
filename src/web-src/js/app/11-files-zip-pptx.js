function parsePlist(text) {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("файл повреждён");
  const root = doc.querySelector("plist > *");
  const conv = (el) => {
    switch (el.tagName) {
      case "dict": {
        const o = {};
        const kids = [...el.children];
        for (let i = 0; i < kids.length; i += 2) o[kids[i].textContent] = conv(kids[i + 1]);
        return o;
      }
      case "array":
        return [...el.children].map(conv);
      case "string":
        return el.textContent;
      case "integer":
        return parseInt(el.textContent, 10);
      case "real":
        return parseFloat(el.textContent);
      case "true":
        return true;
      case "false":
        return false;
      default:
        return el.textContent;
    }
  };
  return conv(root);
}
function toPlist(obj) {
  const esc = (v) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const w = (v, ind) => {
    const p = "	".repeat(ind);
    if (Array.isArray(v)) return v.length ? "".concat(p, "<array>\n").concat(v.map((x) => w(x, ind + 1)).join("")).concat(p, "</array>\n") : "".concat(p, "<array/>\n");
    if (v && typeof v === "object") {
      const ks = Object.keys(v).sort();
      return ks.length ? "".concat(p, "<dict>\n").concat(ks.map((k) => "".concat(p, "	<key>").concat(esc(k), "</key>\n").concat(w(v[k], ind + 1))).join("")).concat(p, "</dict>\n") : "".concat(p, "<dict/>\n");
    }
    if (typeof v === "boolean") return "".concat(p, "<").concat(v, "/>\n");
    if (typeof v === "number") return Number.isInteger(v) ? "".concat(p, "<integer>").concat(v, "</integer>\n") : "".concat(p, "<real>").concat(v, "</real>\n");
    return "".concat(p, "<string>").concat(esc(v != null ? v : ""), "</string>\n");
  };
  return '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n'.concat(w(obj, 0), "</plist>\n");
}
function ledmaskData() {
  const d = projectData();
  d.screens = d.screens.map((st) => {
    const [w, h] = physM(st);
    return { ...st, physicalWidthM: w, physicalHeightM: h };
  });
  return d;
}
const CRC_T = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf, crc = 0) {
  crc = ~crc >>> 0;
  for (let i = 0; i < buf.length; i++) crc = CRC_T[(crc ^ buf[i]) & 255] ^ crc >>> 8;
  return ~crc >>> 0;
}
async function streamBytes(stream) {
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function deflateRaw(bytes) {
  return HAS_CS ? streamBytes(new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"))) : nativeZ("deflate", "raw", bytes);
}
async function inflateRaw(bytes) {
  return HAS_CS ? streamBytes(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"))) : nativeZ("inflate", "raw", bytes);
}
const enc = new TextEncoder(), dec = new TextDecoder();
const b64ToBytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
async function unzip(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0; i--) if (dv.getUint32(i, true) === 101010256) {
    eocd = i;
    break;
  }
  if (eocd < 0) throw new Error("не ZIP");
  const n = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const files = [];
  for (let i = 0; i < n; i++) {
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), lho = dv.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + xlen + clen;
    if (name.endsWith("/")) continue;
    const ds = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true);
    const raw = bytes.subarray(ds, ds + csize);
    files.push({ name, data: method === 8 ? await inflateRaw(raw) : raw.slice() });
  }
  return files;
}
async function zip(entries) {
  const parts = [], central = [];
  let off = 0;
  const dt = /* @__PURE__ */ new Date(), dosTime = dt.getHours() << 11 | dt.getMinutes() << 5 | dt.getSeconds() >> 1, dosDate = dt.getFullYear() - 1980 << 9 | dt.getMonth() + 1 << 5 | dt.getDate();
  for (const e of entries) {
    const name = enc.encode(e.name), crc = crc32(e.data);
    const store = /\.(png|zip)$/i.test(e.name);
    const body = store ? e.data : await deflateRaw(e.data), method = store ? 0 : 8;
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 67324752, true);
    lh.setUint16(4, 20, true);
    lh.setUint16(6, 2048, true);
    lh.setUint16(8, method, true);
    lh.setUint16(10, dosTime, true);
    lh.setUint16(12, dosDate, true);
    lh.setUint32(14, crc, true);
    lh.setUint32(18, body.length, true);
    lh.setUint32(22, e.data.length, true);
    lh.setUint16(26, name.length, true);
    parts.push(new Uint8Array(lh.buffer), name, body);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 33639248, true);
    ch.setUint16(4, 20, true);
    ch.setUint16(6, 20, true);
    ch.setUint16(8, 2048, true);
    ch.setUint16(10, method, true);
    ch.setUint16(12, dosTime, true);
    ch.setUint16(14, dosDate, true);
    ch.setUint32(16, crc, true);
    ch.setUint32(20, body.length, true);
    ch.setUint32(24, e.data.length, true);
    ch.setUint16(28, name.length, true);
    ch.setUint32(42, off, true);
    central.push(new Uint8Array(ch.buffer), name);
    off += 30 + name.length + body.length;
  }
  const csize = central.reduce((a, b) => a + b.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 101010256, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, csize, true);
  end.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: "application/zip" });
}
function pngChunk(type, data) {
  const out = new Uint8Array(12 + data.length), dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  out.set(enc.encode(type), 4);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}
async function renderPNG(st, onBand) {
  const [W, H] = dims(st);
  return renderBands(W, H, (ctx) => drawMask(ctx, st, 1, guidesOf(st)), onBand);
}
async function renderBands(W, H, paint, onBand) {
  const band = Math.max(1, Math.min(H, Math.floor(6e6 / W)));
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = band;
  const ctx = cv.getContext("2d", { willReadFrequently: true, alpha: false });
  const cs = HAS_CS ? new CompressionStream("deflate") : null, bands = [];
  const pz = !cs && !DESKTOP && window.pako ? new window.pako.Deflate({ level: 6 }) : null;
  const writer = cs ? cs.writable.getWriter() : pz ? { write: async (b) => {
    pz.push(b, false);
  }, close: async () => {
    pz.push(new Uint8Array(0), true);
    if (pz.err) throw new Error(pz.msg || "ошибка сжатия");
  } } : { write: async (b) => {
    bands.push(b);
  }, close: async () => {
  } };
  const outP = cs ? streamBytes(cs.readable) : null;
  const prev = new Uint8Array(W * 3), rowLen = W * 3 + 1;
  for (let y0 = 0; y0 < H; y0 += band) {
    const h = Math.min(band, H - y0);
    ctx.setTransform(1, 0, 0, 1, 0, -y0);
    paint(ctx);
    const px = ctx.getImageData(0, 0, W, h).data, buf = new Uint8Array(rowLen * h);
    for (let y = 0; y < h; y++) {
      const o2 = y * rowLen, first = y0 + y === 0;
      buf[o2] = first ? 0 : 2;
      for (let x = 0, i = y * W * 4; x < W; x++, i += 4) {
        const j = x * 3, r = px[i], g = px[i + 1], b = px[i + 2];
        if (first) {
          buf[o2 + 1 + j] = r;
          buf[o2 + 2 + j] = g;
          buf[o2 + 3 + j] = b;
        } else {
          buf[o2 + 1 + j] = r - prev[j] & 255;
          buf[o2 + 2 + j] = g - prev[j + 1] & 255;
          buf[o2 + 3 + j] = b - prev[j + 2] & 255;
        }
        prev[j] = r;
        prev[j + 1] = g;
        prev[j + 2] = b;
      }
    }
    await writer.write(buf);
    if (onBand) await onBand(Math.min(1, (y0 + h) / H));
  }
  await writer.close();
  let idat;
  if (cs) idat = await outP;
  else if (pz) idat = pz.result;
  else {
    const all = new Uint8Array(bands.reduce((a, b) => a + b.length, 0));
    let q = 0;
    for (const b of bands) {
      all.set(b, q);
      q += b.length;
    }
    idat = await zlibDeflate(all);
  }
  const ihdr = new Uint8Array(13), dv = new DataView(ihdr.buffer);
  dv.setUint32(0, W);
  dv.setUint32(4, H);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const parts = [sig, pngChunk("IHDR", ihdr), pngChunk("IDAT", idat), pngChunk("IEND", new Uint8Array(0))];
  const out = new Uint8Array(parts.reduce((a, b) => a + b.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return { png: out, w: W, h: H };
}
const REL_IMAGE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";
const REL_SLIDE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide";
const REL_NOTES = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide";
const CT_SLIDE = "application/vnd.openxmlformats-officedocument.presentationml.slide+xml";
const xmlEsc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const SLIDE_W = 7562850, SLIDE_H = 10696575;
const BOX = { x: 457200, y: 219e4, w: 6648602, h: 769e4 }, GAP = 165e3, LABEL_H = 22e4, LABEL_GAP = 35e3;
const labelPt = (text, wEmu) => {
  mctxRT.font = '10px Arial, "Liberation Sans", Helvetica, sans-serif';
  const tw = mctxRT.measureText(text || "").width;
  return Math.max(5, Math.min(10, 10 * (wEmu / PT) * 0.97 / Math.max(1, tw)));
};
// 2.0.147: раскладка слайда со смешанной ориентацией — полосами: горизонтальные во всю ширину сверху,
// вертикальные рядом под ними (ряд меняется при смене ориентации или при заполнении). Маски — максимально крупно.
function mixedBandCells(dims, B = BOX) {
  const rows = [];
  for (let i = 0; i < dims.length; i++) {
    const h0 = dims[i].w >= dims[i].h, lim = h0 ? 3 : 4, last = rows[rows.length - 1];
    if (last && last.hz === h0 && last.a.length < lim) last.a.push(i);
    else rows.push({ hz: h0, a: [i] });
  }
  // натуральная высота картинок в каждом ряду — по ширине поля
  const info = rows.map((r) => {
    const sumR = r.a.reduce((t, i) => t + dims[i].w / Math.max(1, dims[i].h), 0);
    const hImg = (B.w - GAP * (r.a.length - 1)) / Math.max(1e-6, sumR);
    return { hImg, band: LABEL_H + LABEL_GAP + hImg };
  });
  const totNat = info.reduce((t, r) => t + r.band, 0) + GAP * (rows.length - 1);
  const avail = B.h, labels = rows.length * (LABEL_H + LABEL_GAP) + GAP * (rows.length - 1);
  const f = totNat > avail ? (avail - labels) / Math.max(1, totNat - labels) : 1;
  const bands = info.map((r) => ({ hImg: r.hImg * f, band: LABEL_H + LABEL_GAP + r.hImg * f }));
  const totH = bands.reduce((t, r) => t + r.band, 0) + GAP * (rows.length - 1);
  let y = B.y + Math.max(0, Math.floor((avail - totH) / 2));
  const cells = [];
  rows.forEach((r, ri) => {
    const hImg = bands[ri].hImg;
    const ws = r.a.map((i) => Math.round(dims[i].w * hImg / Math.max(1, dims[i].h)));
    const rowW = ws.reduce((t, v) => t + v, 0) + GAP * (r.a.length - 1);
    let x = B.x + Math.max(0, Math.floor((B.w - rowW) / 2));
    r.a.forEach((i, k) => {
      cells[i] = { label: [x, y, ws[k], LABEL_H], image: [x, y + LABEL_H + LABEL_GAP, ws[k], Math.round(hImg)] };
      x += ws[k] + GAP;
    });
    y += bands[ri].band + GAP;
  });
  return cells;
}
function maskCellLayout(hz, n, j, w, h, B = BOX, info, topAlign, fixedScale) {
  if (hz && typeof hz === "object" && hz.mixed) {
    const cell = mixedBandCells(hz.mixed, B)[j] || { label: [B.x, B.y, 1, LABEL_H], image: [B.x, B.y, 1, 1] };
    if (fixedScale > 0) {
      // одинаковый размер — ужимаем до общего масштаба, но не больше ячейки; центрируем в ячейке
      const [ix, iy, iw, ih] = cell.image, ew = Math.min(iw, Math.round(w * fixedScale)), eh = Math.min(ih, Math.round(h * fixedScale));
      cell.image = [ix + Math.floor((iw - ew) / 2), iy, ew, eh];
    }
    return cell;
  }
  if (info && info.length) {
    // 2.0.69: 3D волюметрика + «Информация» текстом справа от картинки
    const L0 = maskCellLayout(hz, n, j, 1, 1, B), [cx0, ly, cw] = L0.label, cell = L0.label, chT = L0.image[1] + L0.image[3] - ly;
    const span = hz && typeof hz === "object" && hz.spanLast && j === n - 1 && j % hz.cols === 0;
    const full = span ? B.w : cw, x0 = span ? B.x : cx0;
    const G = hz && typeof hz === "object" ? hz : { cols: 1, rows: 1 };
    const chh = Math.floor((B.h - GAP * (G.rows - 1)) / G.rows), cy0 = B.y + Math.floor(j / G.cols) * (chh + GAP);
    const ih = Math.max(1, chh - LABEL_H - LABEL_GAP), iwMax = Math.round(full * 0.56), tw = full - iwMax - GAP;
    const sc = Math.min(iwMax / Math.max(1, w), ih / Math.max(1, h)), ew = Math.round(w * sc), eh = Math.round(h * sc);
    const by = cy0 + Math.floor((chh - (LABEL_H + LABEL_GAP + eh)) / 2), iy = by + LABEL_H + LABEL_GAP;
    void cell, void chT;
    return { label: [x0, by, full, LABEL_H], image: [x0 + iwMax - ew, iy, ew, eh], info: [x0 + iwMax + GAP, iy, tw, eh] };
  }
  const G = hz && typeof hz === "object" ? hz : hz ? { cols: 1, rows: n } : { cols: n, rows: 1 };
  // spanLast: последняя картинка одна в своём ряду — во всю ширину (волюметрик: вид сверху и снизу рядом, 3D под ними)
  const span = G.spanLast && j === n - 1 && j % G.cols === 0;
  const cw = span ? B.w : Math.floor((B.w - GAP * (G.cols - 1)) / G.cols), chh = Math.floor((B.h - GAP * (G.rows - 1)) / G.rows);
  const cx0 = span ? B.x : B.x + j % G.cols * (cw + GAP), cy0 = B.y + Math.floor(j / G.cols) * (chh + GAP);
  const ih = Math.max(1, chh - LABEL_H - LABEL_GAP);
  // 2.0.146: fixedScale — одинаковые по разрешению маски одного размера на разных слайдах; не больше, чем помещается в ячейку
  const fit = Math.min(cw / Math.max(1, w), ih / Math.max(1, h)), sc = fixedScale > 0 ? Math.min(fixedScale, fit) : fit;
  const ew = Math.round(w * sc), eh = Math.round(h * sc);
  // 2.0.146: topAlign — при пояснительном тексте маска прижимается кверху ячейки, ближе к тексту
  const by = topAlign ? cy0 : cy0 + Math.floor((chh - (LABEL_H + LABEL_GAP + eh)) / 2), ix = cx0 + Math.floor((cw - ew) / 2);
  return { label: [cx0, by, cw, LABEL_H], image: [ix, by + LABEL_H + LABEL_GAP, ew, eh] };
}
// 2.0.60: вид сверху, вид снизу и 3D волюметрика — вместе на одном листе (по 3), отдельно от масок
const volExtra = (m) => /^v[cb3]:/.test(m.key || "");
function autoGroupOne(masks, i) {
  const hz = masks[i].w >= masks[i].h, ve = volExtra(masks[i]), lim = ve ? 3 : hz ? 3 : 2, g = [];
  while (i < masks.length && g.length < lim && (ve ? volExtra(masks[i]) : masks[i].w >= masks[i].h === hz && !volExtra(masks[i]))) g.push(i++);
  return { hz: ve && g.length === 3 ? { cols: 2, rows: 2, spanLast: true } : ve && g.length > 1 ? autoGrid(masks, g) : hz, g, next: i };
}
function groupMasks(masks) {
  const groups = [];
  let i = 0;
  while (i < masks.length) {
    const grp = autoGroupOne(masks, i);
    groups.push({ hz: grp.hz, g: grp.g });
    i = grp.next;
  }
  return groups;
}
const PT = 12700, RT_FONT = 'Arial, "Liberation Sans", Helvetica, sans-serif', RT_LH = 1.2;
const xmlUn = (s) => String(s).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d)).replace(/&amp;/g, "&");
const hexU = (c) => c ? String(c).toUpperCase() : null;
function runsMd(runs) {
  let out = "", col2 = null, bold = false;
  for (const r of runs) {
    if (!r.t) continue;
    const c = r.link ? null : hexU(r.color);
    if (c !== col2) {
      if (bold) {
        out += "**";
        bold = false;
      }
      if (col2) out += "[/]";
      if (c) out += "[" + c + "]";
      col2 = c;
    }
    if (!!r.b !== bold) {
      out += "**";
      bold = !!r.b;
    }
    out += r.t;
  }
  if (bold) out += "**";
  if (col2) out += "[/]";
  return out;
}
function mdRuns(line, base = {}) {
  const out = [];
  let bold = false, col2 = null, size = null;
  for (const tok of String(line).split(/(\*\*|\[#[0-9A-Fa-f]{6}\]|\[\/\]|\[s\d{1,2}(?:\.\d)?\]|\[\/s\])/)) {
    if (!tok) continue;
    if (tok === "**") {
      bold = !bold;
      continue;
    }
    if (tok === "[/s]") {
      size = null;
      continue;
    }
    if (/^\[s\d/.test(tok)) {
      size = Math.max(4, Math.min(72, parseFloat(tok.slice(2))));
      continue;
    }
    if (tok === "[/]") {
      col2 = null;
      continue;
    }
    if (/^\[#[0-9A-Fa-f]{6}\]$/.test(tok)) {
      col2 = tok.slice(1, 8).toUpperCase();
      continue;
    }
    tok.split(/(https?:\/\/[^\s\[*]+)/).forEach((u, k) => {
      if (u) {
        const r = { ...base, t: u, b: bold, color: k % 2 ? null : col2, link: k % 2 === 1 ? u : null };
        if (size) r.sz = size;
        out.push(r);
      }
    });
  }
  return out;
}
const mdParas = (text) => String(text || "").replace(/\r/g, "").split("\n").map((l) => mdRuns(l));
const tplCache = {};
// Текстовые блоки слайда 1 (заголовок и разделы), в порядке шаблона. Ключ блока: последний — label
// (как в прошлых версиях, чтобы старые правки сохранились), остальные — label#номер.
async function tplBlocks(label) {
  if (tplCache[label + "@all"]) return tplCache[label + "@all"];
  const files = await unzip(b64ToBytes(TPL[label])), get = (n) => {
    const f = files.find((x) => x.name === n);
    return f ? dec.decode(f.data) : "";
  };
  const slide = get("ppt/slides/slide1.xml"), theme = get("ppt/theme/theme1.xml"), rels = get("ppt/slides/_rels/slide1.xml.rels");
  const clr = {};
  for (const m of theme.matchAll(/<a:(\w+)>\s*<a:(?:srgbClr val|sysClr val="\w+" lastClr)="([0-9A-Fa-f]{6})"/g)) clr[m[1]] = "#" + m[2];
  clr.tx1 = clr.dk1 || "#000000";
  const link = {};
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = (m[0].match(/Id="([^"]+)"/) || [])[1], t = (m[0].match(/Target="([^"]+)"/) || [])[1];
    if (id && /hyperlink/.test(m[0])) link[id] = xmlUn(t);
  }
  const sps = (slide.match(/<p:sp>[\s\S]*?<\/p:sp>/g) || []).filter((x) => x.includes("<p:txBody>") && /<a:t>[^<]+<\/a:t>/.test(x));
  const blocks = sps.map((sp, idx) => tplBlock(label, idx === sps.length - 1 ? label : label + "#" + idx, idx, sp, clr, link));
  blocks.forEach((b) => tplCache[b.label] = b);
  tplCache[label + "@all"] = blocks;
  return blocks;
}
async function tplInfo(label) {
  const bl = await tplBlocks(label);
  return bl[bl.length - 1];
}
function tplBlock(tpl, label, idx, sp, clr, link) {
  const off = sp.match(/<a:off x="(\d+)" y="(\d+)"\/>/), ext = sp.match(/<a:ext cx="(\d+)" cy="(\d+)"\/>/);
  const rect = { x: +off[1], y: +off[2], w: +ext[1], h: +ext[2] };
  const body = sp.slice(sp.indexOf("<a:lstStyle/>") + 13, sp.lastIndexOf("</p:txBody>"));
  const paraXml = body.match(/<a:p\b(?:\s[^>]*)?>[\s\S]*?<\/a:p>/g) || [];
  const lines = [];
  paraXml.forEach((px, pi) => {
    let cur = { runs: [], xml: [], para: pi };
    const push = () => {
      cur.md = runsMd(cur.runs);
      lines.push(cur);
      cur = { runs: [], xml: [], para: pi };
    };
    for (const m of px.matchAll(/<a:r>([\s\S]*?)<\/a:r>|<a:br\b[^>]*\/>|<a:br\b[\s\S]*?<\/a:br>/g)) {
      if (!m[0].startsWith("<a:r>")) {
        push();
        continue;
      }
      const rx = m[1], rpr = (rx.match(/<a:rPr\b[^>]*?(?:\/>|>[\s\S]*?<\/a:rPr>)/) || [""])[0], head = (rpr.match(/<a:rPr\b[^>]*>/) || [""])[0];
      const t = xmlUn((rx.match(/<a:t>([\s\S]*?)<\/a:t>/) || ["", ""])[1]);
      const sc = rpr.match(/<a:schemeClr val="(\w+)"/), rgb = rpr.match(/<a:srgbClr val="([0-9A-Fa-f]{6})"/), hl = rpr.match(/<a:hlinkClick\b[^>]*r:id="([^"]+)"/);
      cur.runs.push({ t, b: /\bb="1"/.test(head), u: /\bu="(?!none)\w+"/.test(head), color: rgb ? "#" + rgb[1] : sc ? clr[sc[1]] : null, link: hl ? link[hl[1]] || null : null, sz: +((head.match(/\bsz="(\d+)"/) || [])[1] || 1e3) / 100 });
      cur.xml.push(m[0]);
    }
    push();
  });
  const cnt = /* @__PURE__ */ new Map();
  for (const l of lines) l.xml.forEach((x, i) => {
    const r = l.runs[i];
    if (r.link || r.u || r.b) return;
    const rp = (x.match(/<a:rPr\b[^>]*?(?:\/>|>[\s\S]*?<\/a:rPr>)/) || [""])[0];
    if (rp) cnt.set(rp, (cnt.get(rp) || 0) + r.t.length);
  });
  let baseRpr = '<a:rPr lang="ru-RU" sz="1000" dirty="0"><a:latin typeface="Arial"/><a:cs typeface="Arial"/></a:rPr>', best = 0;
  for (const [k, v] of cnt) if (v > best) {
    best = v;
    baseRpr = k;
  }
  baseRpr = baseRpr.replace(/\s(b|u|i)="[^"]*"/g, "");
  const baseSz = +((baseRpr.match(/\bsz="(\d+)"/) || [])[1] || 1e3) / 100;
  const bodyPr = (sp.match(/<a:bodyPr\b[^>]*>/) || [""])[0], insA = (n, d) => {
    const m = bodyPr.match(new RegExp("\\b" + n + '="(\\d+)"'));
    return m ? +m[1] : d;
  };
  const ins = { l: insA("lIns", 91440), t: insA("tIns", 45720) };
  const bc = baseRpr.match(/<a:srgbClr val="([0-9A-Fa-f]{6})"/), baseColor = bc ? "#" + bc[1] : "#000";
  const head = (lines[0] ? lines[0].runs.map((r) => r.t).join("") : "").replace(/\s+/g, " ").trim();
  const title = head.length > 42 ? head.slice(0, 41) + "…" : head || "блок " + (idx + 1);
  return { tpl, idx, label, title, sp, paraXml, lines, rect, ins, baseRpr, baseSz, baseColor, md: lines.map((l) => l.md).join("\n") };
}
function reqText(label) {
  const v = project.tz.req && project.tz.req[label];
  return typeof v === "string" ? v : null;
}
const tzPos = (k) => project.tz.pos && project.tz.pos[k] || null;
function reqEdited(info) {
  const v = reqText(info.label);
  return v != null && v.replace(/\r/g, "") !== info.md || !!tzPos("req:" + info.label);
}
function reqRect(info) {
  const p = tzPos("req:" + info.label);
  return p ? { ...info.rect, x: p.x, y: p.y } : info.rect;
}
const reqTextOr = (info) => {
  const v = reqText(info.label);
  return v != null ? v : info.md;
};
function reqMatch(info, text) {
  const a = info.lines.map((l) => l.md), b = String(text).replace(/\r/g, "").split("\n"), n = a.length, m = b.length;
  const L2 = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i2 = n - 1; i2 >= 0; i2--) for (let j2 = m - 1; j2 >= 0; j2--) L2[i2][j2] = a[i2] === b[j2] ? L2[i2 + 1][j2 + 1] + 1 : Math.max(L2[i2 + 1][j2], L2[i2][j2 + 1]);
  const map = new Array(m).fill(-1);
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      map[j] = i;
      i++;
      j++;
    } else if (L2[i + 1][j] >= L2[i][j + 1]) i++;
    else j++;
  }
  return { lines: b, map };
}
function reqParas(info, text) {
  const { lines, map } = reqMatch(info, text);
  return lines.map((l, j) => map[j] >= 0 ? info.lines[map[j]].runs : mdRuns(l, { sz: info.baseSz }));
}
function reqXml(info, text) {
  const { lines, map } = reqMatch(info, text), out = [], rels = [];
  const newRun = (t, b, link, color, sz) => {
    let rp = b ? info.baseRpr.replace("<a:rPr", '<a:rPr b="1"') : info.baseRpr;
    if (sz && Math.abs(sz - info.baseSz) > 1e-6) rp = /\bsz="\d+"/.test(rp) ? rp.replace(/\bsz="\d+"/, 'sz="'.concat(Math.round(sz * 100), '"')) : rp.replace("<a:rPr", '<a:rPr sz="'.concat(Math.round(sz * 100), '"'));
    if (color) {
      rp = rp.replace(/<a:solidFill>[\s\S]*?<\/a:solidFill>/, "");
      const fill = '<a:solidFill><a:srgbClr val="'.concat(color.slice(1), '"/></a:solidFill>');
      rp = rp.endsWith("/>") ? rp.replace(/\/>$/, ">".concat(fill, "</a:rPr>")) : rp.replace(/^(<a:rPr\b[^>]*>)/, "$1" + fill);
    }
    if (link) {
      const id = "rIdT" + info.idx + "_" + (rels.length + 1);
      rels.push({ id, url: link });
      const hl = '<a:hlinkClick r:id="'.concat(id, '"/>');
      rp = rp.endsWith("/>") ? rp.replace(/\/>$/, ">".concat(hl, "</a:rPr>")) : rp.replace("</a:rPr>", hl + "</a:rPr>");
    }
    return "<a:r>".concat(rp, "<a:t>").concat(xmlEsc(t), "</a:t></a:r>");
  };
  const endP = info.baseRpr.replace(/^<a:rPr/, "<a:endParaRPr").replace(/<\/a:rPr>$/, "</a:endParaRPr>");
  for (let j = 0; j < lines.length; ) {
    const oi = map[j];
    if (oi >= 0) {
      const pi = info.lines[oi].para, span = info.lines.filter((x) => x.para === pi), first = info.lines.indexOf(span[0]);
      if (oi === first && span.every((x, k) => map[j + k] === first + k)) {
        out.push(info.paraXml[pi]);
        j += span.length;
        continue;
      }
      out.push("<a:p>".concat(info.lines[oi].xml.join("")).concat(endP, "</a:p>"));
      j++;
      continue;
    }
    const runs = mdRuns(lines[j]);
    out.push("<a:p>".concat(runs.map((r) => newRun(r.t, r.b, r.link, r.color, r.sz)).join("")).concat(endP, "</a:p>"));
    j++;
  }
  return { xml: out.join(""), rels };
}
function rtLayout(ctx, paras, wPt, defSz = 10) {
  const lines = [];
  const font = (r) => "".concat(r.b ? "bold " : "").concat(r.sz || defSz, "px ").concat(RT_FONT);
  for (const runs of paras) {
    const sz0 = Math.max(defSz, ...runs.map((r) => r.sz || defSz));
    let line = [], lw = 0;
    const flush = () => {
      lines.push({ segs: line, h: sz0 * RT_LH, sz: sz0 });
      line = [];
      lw = 0;
    };
    for (const r of runs) {
      ctx.font = font(r);
      for (const tok of r.t.split(/(\s+)/)) {
        if (!tok) continue;
        const w = ctx.measureText(tok).width;
        if (lw + w > wPt && line.length && !/^\s+$/.test(tok)) {
          while (line.length && /^\s+$/.test(line[line.length - 1].t)) lw -= line.pop().w;
          flush();
        }
        if (!line.length && /^\s+$/.test(tok)) continue;
        line.push({ ...r, t: tok, w, x: lw });
        lw += w;
      }
    }
    flush();
  }
  return { lines, h: lines.reduce((a, l) => a + l.h, 0), font };
}
function rtPaint(ctx, paras, x0, y0, wPt, k, defSz = 10, color = "#000") {
  ctx.save();
  ctx.scale(k, k);
  const L2 = rtLayout(ctx, paras, wPt, defSz), links = [];
  let y = 0;
  ctx.textBaseline = "alphabetic";
  for (const ln of L2.lines) {
    const base = y + ln.sz * 0.905 + (ln.h - ln.sz * 1.117) / 2;
    for (const sg of ln.segs) {
      ctx.font = L2.font(sg);
      ctx.fillStyle = sg.color || (sg.link ? "#0563C1" : color);
      const X = x0 / k + sg.x, Y = y0 / k + base;
      ctx.fillText(sg.t, X, Y);
      if (sg.u || sg.link) ctx.fillRect(X, Y + (sg.sz || defSz) * 0.12, sg.w, Math.max(0.5, (sg.sz || defSz) * 0.07));
      if (sg.link) links.push({ x: sg.x, y, w: sg.w, h: ln.h, url: sg.link });
    }
    y += ln.h;
  }
  ctx.restore();
  return { h: y, links };
}
const mctxRT = document.createElement("canvas").getContext("2d");
const NOTE_SZ = 12;
function noteLayout(text, key2) {
  const t = String(text || "").replace(/\s+$/, "");
  if (!t.trim()) return { box: BOX, note: null };
  const paras = mdParas(t), wPt = BOX.w / PT, pos = key2 ? tzPos("note:" + key2) : null;
  let sz = NOTE_SZ, h = rtLayout(mctxRT, paras, wPt, sz).h;
  while (h * PT > BOX.h * 0.45 && sz > 6) {
    sz -= 0.5;
    h = rtLayout(mctxRT, paras, wPt, sz).h;
  }
  const hE = Math.ceil(h * PT), dy = hE + GAP;
  if (pos) return { box: BOX, note: { paras, sz, rect: [pos.x, pos.y, BOX.w, hE] } };
  if (volNoteKey(key2)) return { box: { x: BOX.x, y: BOX.y, w: BOX.w, h: BOX.h - dy }, note: { paras, sz, rect: [BOX.x, BOX.y + BOX.h - hE, BOX.w, hE] } };
  return { box: { x: BOX.x, y: BOX.y + dy, w: BOX.w, h: BOX.h - dy }, note: { paras, sz, rect: [BOX.x, BOX.y, BOX.w, hE] } };
}
const noteKey = (items) => items.length ? items[0].key || "" : "";
// 2.0.72: у листа волюметрика (вид сверху, снизу, 3D) обычный текстовый блок ТЗ по умолчанию — «Информация» раздела
const volNoteKey = (key2) => /^v[cb3]:/.test(key2 || "");
function volNoteDefault(key2) {
  const uid = String(key2).slice(3), st = project.screens.find((x) => String(x.uid) === uid);
  return st && st.kind === "vol" && st.vol ? "**Информация**\n" + volInfoLines(st).join("\n") : "";
}
const noteText = (key2) => {
  const n = project.tz.notes;
  if (volNoteKey(key2) && project.tz.volInfo === false) return ""; // галочка «Информация» в ТЗ выключена
  if (n && Object.prototype.hasOwnProperty.call(n, key2)) return n[key2] || "";
  if (/^c:/.test(key2 || "")) return cutNoteDefault(key2);
  if (/^cs:/.test(key2 || "")) return "**Нарезка — исходная маска (пример)**\nКрасным пунктиром отмечены места разреза, крупные метки режутся вместе с маской — по ним видно, какая часть с какой соединяется. Это пример для контентщиков, отдельным файлом не сохраняется.";
  return volNoteKey(key2) ? volNoteDefault(key2) : "";
};
function noteShapeXml(id, note) {
  const [x, y, w, h] = note.rect, sz = Math.round(note.sz * 100);
  const rp = (b, c, rs) => '<a:rPr lang="ru-RU" sz="'.concat(rs ? Math.round(rs * 100) : sz, '"').concat(b ? ' b="1"' : "", ' dirty="0"><a:solidFill><a:srgbClr val="').concat((c || "#222222").slice(1), '"/></a:solidFill><a:latin typeface="Arial"/><a:cs typeface="Arial"/></a:rPr>');
  const ps = note.paras.map((runs) => "<a:p>".concat(runs.map((r) => "<a:r>".concat(rp(r.b, r.link ? "#0563C1" : r.color, r.sz), "<a:t>").concat(xmlEsc(r.t), "</a:t></a:r>")).join(""), '<a:endParaRPr lang="ru-RU" sz="').concat(sz, '" dirty="0"/></a:p>')).join("");
  return '<p:sp><p:nvSpPr><p:cNvPr id="'.concat(id, '" name="Свой текст"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="').concat(x, '" y="').concat(y, '"/><a:ext cx="').concat(w, '" cy="').concat(h, '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" rtlCol="0"><a:noAutofit/></a:bodyPr><a:lstStyle/>').concat(ps, "</p:txBody></p:sp>");
}
async function rtImage(paras, wPt, hPt, defSz, defColor = "#000", k = 4) {
  const W = Math.max(1, Math.round(wPt * k)), H = Math.max(1, Math.round(hPt * k));
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const c = cv.getContext("2d", { willReadFrequently: true });
  const r = rtPaint(c, paras, 0, 0, wPt, k, defSz, defColor);
  const px = c.getImageData(0, 0, W, H).data, rgb = new Uint8Array(W * H * 3), al = new Uint8Array(W * H);
  for (let i = 0, j = 0, q = 0; i < px.length; i += 4, j += 3, q++) {
    const a = px[i + 3];
    al[q] = a;
    if (a) {
      rgb[j] = px[i];
      rgb[j + 1] = px[i + 1];
      rgb[j + 2] = px[i + 2];
    }
  }
  return { w: W, h: H, data: await zlibDeflate(rgb), alpha: await zlibDeflate(al), links: r.links };
}
async function buildPptx(tplB64, masks, overview, label) {
  const files = await unzip(b64ToBytes(tplB64)), map = new Map(files.map((f) => [f.name, f.data]));
  const order = files.map((f) => f.name);
  const txt = (n) => dec.decode(map.get(n));
  const slide2 = txt("ppt/slides/slide2.xml"), rels2 = txt("ppt/slides/_rels/slide2.xml.rels");
  const blocks = label ? await tplBlocks(label) : [];
  if (blocks.some(reqEdited)) {
    let s1 = txt("ppt/slides/slide1.xml");
    const relAdd = [];
    for (const info of blocks) {
      if (!reqEdited(info)) continue;
      const body = info.sp.slice(info.sp.indexOf("<a:lstStyle/>") + 13, info.sp.lastIndexOf("</p:txBody>"));
      const rx = reqXml(info, reqTextOr(info)), rr = reqRect(info);
      const sp2 = info.sp.replace(body, rx.xml).replace(/<a:off x="\d+" y="\d+"\/>/, '<a:off x="'.concat(rr.x, '" y="').concat(rr.y, '"/>'));
      s1 = s1.replace(info.sp, sp2);
      relAdd.push(...rx.rels);
    }
    map.set("ppt/slides/slide1.xml", enc.encode(s1));
    if (relAdd.length) {
      const rn = "ppt/slides/_rels/slide1.xml.rels";
      map.set(rn, enc.encode(txt(rn).replace("</Relationships>", relAdd.map((r) => '<Relationship Id="'.concat(r.id, '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="').concat(xmlEsc(r.url), '" TargetMode="External"/>')).join("") + "</Relationships>")));
    }
  }
  let pres = txt("ppt/presentation.xml"), presRels = txt("ppt/_rels/presentation.xml.rels"), types = txt("[Content_Types].xml");
  const relItems = rels2.match(/<Relationship\b[^>]*\/>/g) || [];
  const s1Targets = txt("ppt/slides/_rels/slide1.xml.rels").match(/Target="[^"]+"/g) || [];
  const bgRels = relItems.filter((r) => r.includes(REL_IMAGE) && s1Targets.includes((r.match(/Target="[^"]+"/) || [""])[0]));
  const bgIds = bgRels.map((r) => (r.match(/Id="([^"]+)"/) || [])[1]);
  const slideTpl = slide2.replace(/<p:pic>[\s\S]*?<\/p:pic>/g, (pic) => bgIds.some((id) => pic.includes('r:embed="' + id + '"')) ? pic : "");
  const keep = relItems.filter((r) => !r.includes(REL_IMAGE) || bgRels.includes(r)), keepClone = keep.filter((r) => !r.includes(REL_NOTES));
  const maxId = (re, s, start) => Math.max(start - 1, ...[...s.matchAll(re)].map((m) => +m[1])) + 1;
  let nextPresRel = maxId(/Id="rId(\d+)"/g, presRels, 1), nextSlideId = maxId(/<p:sldId\s+id="(\d+)"/g, pres, 256);
  const relsHead = rels2.slice(0, rels2.indexOf("<Relationships")), relsOpen = rels2.match(/<Relationships\b[^>]*>/)[0];
  const groups = maskGroups(masks).map((g) => ({ ...g, kind: "masks" }));
  const emap = evenScaleMap(maskGroups(masks), masks);
  const imgs = overview || [];
  groups.unshift(...imgGroups(imgs).map(({ hz, g }) => ({ kind: "img", ims: g.map((j) => imgs[j]), hz, g: [] })));
  if (imgs.length && !/Extension="jpe?g"/i.test(types)) types = types.replace(/<Default\b/, '<Default Extension="jpeg" ContentType="image/jpeg"/><Default');
  const used = new Set(order.filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)));
  const put = (n, data) => {
    if (!map.has(n)) order.push(n);
    map.set(n, data);
  };
  groups.forEach(({ hz, g }, gi) => {
    let no = 2;
    if (gi > 0) {
      no = 3;
      while (used.has("ppt/slides/slide".concat(no, ".xml"))) no++;
    }
    const sname = "slide".concat(no, ".xml");
    used.add("ppt/slides/" + sname);
    const base = gi === 0 ? keep : keepClone;
    let rid = maxId(/Id="rId(\d+)"/g, base.join(""), 1);
    const shapes = [], rels = [];
    const items = groups[gi].kind === "img" ? groups[gi].ims.map((im) => ({ png: im.jpeg, w: im.w, h: im.h, label: im.caption || "", ext: "jpeg", key: imgKey(im) })) : g.map((mi) => masks[mi]);
    const NL = noteLayout(noteText(noteKey(items)), noteKey(items));
    items.forEach((m, j) => {
      const lay = maskCellLayout(hz, items.length, j, m.w, m.h, NL.box, m.info, !!NL.note, groups[gi].kind === "img" ? 0 : evenSc(emap, m)), [cx0, cy0, cw] = lay.label;
      if (lay.info) {
        // «Информация» волюметрика — обычный текст на слайде (можно править в PowerPoint)
        const [tx, ty, tw, th] = lay.info, fit = infoFit(m.info, tw, th), sz = Math.round(fit.pt * 100);
        const paras = fit.rows.map((r) => '<a:p><a:pPr><a:lnSpc><a:spcPct val="112000"/></a:lnSpc></a:pPr><a:r><a:rPr lang="ru-RU" sz="'.concat(sz, '"').concat(r.b ? ' b="1"' : "", '><a:solidFill><a:srgbClr val="222222"/></a:solidFill><a:latin typeface="Arial"/><a:ea typeface="Arial"/><a:cs typeface="Arial"/></a:rPr><a:t>').concat(xmlEsc(r.t), "</a:t></a:r></a:p>")).join("");
        shapes.push('<p:sp><p:nvSpPr><p:cNvPr id="'.concat(150 + j, '" name="Vol info ').concat(j + 1, '"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="').concat(tx, '" y="').concat(ty, '"/><a:ext cx="').concat(tw, '" cy="').concat(th, '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="none" lIns="0" rIns="0" tIns="0" bIns="0" anchor="t"/><a:lstStyle/>').concat(paras, "</p:txBody></p:sp>"));
      }
      shapes.push('<p:sp><p:nvSpPr><p:cNvPr id="'.concat(100 + j, '" name="Mask info ').concat(j + 1, '"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="').concat(cx0, '" y="').concat(cy0, '"/><a:ext cx="').concat(cw, '" cy="').concat(LABEL_H, '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="none" lIns="0" rIns="0" tIns="0" bIns="0" anchor="ctr"/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="ru-RU" sz="').concat(Math.round(labelPt(m.label, cw) * 100), '"><a:solidFill><a:srgbClr val="222222"/></a:solidFill><a:latin typeface="Arial"/><a:ea typeface="Arial"/><a:cs typeface="Arial"/></a:rPr><a:t>').concat(xmlEsc(m.label), '</a:t></a:r><a:endParaRPr lang="ru-RU" sz="1100"/></a:p></p:txBody></p:sp>'));
      const [x, y, ew, eh] = lay.image;
      const img = "mask_".concat(gi + 1, "_").concat(j + 1, ".").concat(m.ext || "png");
      put("ppt/media/" + img, m.png);
      const r = "rId" + rid++;
      shapes.push('<p:pic><p:nvPicPr><p:cNvPr id="'.concat(j + 2, '" name="Mask ').concat(j + 1, '" descr="').concat(img, '"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="').concat(r, '"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="').concat(x, '" y="').concat(y, '"/><a:ext cx="').concat(ew, '" cy="').concat(eh, '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>'));
      rels.push('<Relationship Id="'.concat(r, '" Type="').concat(REL_IMAGE, '" Target="../media/').concat(img, '"/>'));
    });
    if (NL.note) shapes.push(noteShapeXml(90, NL.note));
    let sx = slideTpl.replace("</p:spTree>", shapes.join("") + "</p:spTree>");
    if (gi > 0) sx = sx.replace(/(<p14:creationId\b[^>]*val=")\d+(")/, (_, a, b) => a + (1e8 + Math.floor(Math.random() * 2e9)) + b);
    put("ppt/slides/" + sname, enc.encode(sx));
    put("ppt/slides/_rels/" + sname + ".rels", enc.encode(relsHead + relsOpen + base.join("") + rels.join("") + "</Relationships>"));
    if (gi > 0) {
      const r = "rId" + nextPresRel++;
      presRels = presRels.replace("</Relationships>", '<Relationship Id="'.concat(r, '" Type="').concat(REL_SLIDE, '" Target="slides/').concat(sname, '"/></Relationships>'));
      pres = pres.replace("</p:sldIdLst>", '<p:sldId id="'.concat(nextSlideId++, '" r:id="').concat(r, '"/></p:sldIdLst>'));
      types = types.replace("</Types>", '<Override PartName="/ppt/slides/'.concat(sname, '" ContentType="').concat(CT_SLIDE, '"/></Types>'));
    }
  });
  map.set("ppt/presentation.xml", enc.encode(pres));
  map.set("ppt/_rels/presentation.xml.rels", enc.encode(presRels));
  map.set("[Content_Types].xml", enc.encode(types));
  const allRels = [...map.entries()].filter(([n]) => n.endsWith(".rels")).map(([, d]) => dec.decode(d)).join("");
  for (const n of [...map.keys()]) if (n.startsWith("ppt/media/") && !allRels.includes(n.split("/").pop())) map.delete(n);
  const names = ["[Content_Types].xml", ...order.filter((n) => n !== "[Content_Types].xml" && map.has(n))];
  return zip([...new Set(names)].map((n) => ({ name: n, data: map.get(n) })));
}
const EMU_PT = 12700, PDF_W = SLIDE_W / EMU_PT, PDF_H = SLIDE_H / EMU_PT;
async function zlibDeflate(bytes) {
  return HAS_CS ? streamBytes(new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate"))) : nativeZ("deflate", "zlib", bytes);
}
function pngParts(png) {
  const dv = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let p = 8, w = 0, h = 0, ct = 0, bd = 0;
  const idat = [];
  while (p < png.length) {
    const len = dv.getUint32(p), type = String.fromCharCode(...png.subarray(p + 4, p + 8)), d = png.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") {
      w = dv.getUint32(p + 8);
      h = dv.getUint32(p + 12);
      bd = png[p + 16];
      ct = png[p + 17];
    } else if (type === "IDAT") idat.push(d);
    p += 12 + len;
  }
  const out = new Uint8Array(idat.reduce((a, b) => a + b.length, 0));
  let o = 0;
  for (const d of idat) {
    out.set(d, o);
    o += d.length;
  }
  return { w, h, ct, bd, idat: out };
}
const INFO_FONT = 'Arial, "Liberation Sans", Helvetica, sans-serif';
function infoFit(lines, wEmu, hEmu) {
  const c = document.createElement("canvas").getContext("2d");
  for (let pt = 10; pt >= 5; pt -= 0.5) {
    c.font = "".concat(pt, "px ").concat(INFO_FONT);
    const maxW = wEmu / PT, rows = [{ t: "Информация", b: true }];
    for (const ln of lines) {
      // переносим по « · », а слишком длинный кусок — по словам
      let cur = "";
      const words = [];
      ln.split(" · ").forEach((p, i) => p.split(" ").forEach((w, k) => words.push((i && !k ? "· " : "") + w)));
      for (const w of words) {
        const t = cur ? cur + " " + w : w;
        if (cur && c.measureText(t).width > maxW * 0.97) {
          rows.push({ t: cur.replace(/ ·$/, "") });
          cur = "   " + w.replace(/^· /, "");
        } else cur = t;
      }
      rows.push({ t: cur });
    }
    if (rows.length * pt * 1.35 * PT <= hEmu || pt === 5) return { pt, rows, lh: pt * 1.35 };
  }
}
function infoPaint(c, fit, x, y, k) {
  c.save();
  c.fillStyle = "#222";
  c.textAlign = "left";
  c.textBaseline = "top";
  fit.rows.forEach((r, i) => {
    c.font = "".concat(r.b ? "bold " : "").concat(fit.pt * k, "px ").concat(INFO_FONT);
    c.fillText(r.t, x, y + i * fit.lh * k);
  });
  c.restore();
}
async function infoImage(lines, wPt, hPt, k = 4) {
  const fit = infoFit(lines, wPt * PT, hPt * PT), W = Math.max(1, Math.round(wPt * k)), H = Math.max(1, Math.round(hPt * k));
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const c = cv.getContext("2d", { willReadFrequently: true, alpha: false });
  c.fillStyle = "#fff";
  c.fillRect(0, 0, W, H);
  infoPaint(c, fit, 0, 0, k);
  const px = c.getImageData(0, 0, W, H).data, rgb = new Uint8Array(W * H * 3);
  for (let i = 0, j = 0; i < px.length; i += 4, j += 3) {
    rgb[j] = px[i];
    rgb[j + 1] = px[i + 1];
    rgb[j + 2] = px[i + 2];
  }
  return { w: W, h: H, data: await zlibDeflate(rgb) };
}
async function labelImage(text, wPt, hPt, k = 4) {
  var _a, _b;
  const W = Math.max(1, Math.round(wPt * k)), H = Math.max(1, Math.round(hPt * k));
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const c = cv.getContext("2d", { willReadFrequently: true, alpha: false });
  c.fillStyle = "#fff";
  c.fillRect(0, 0, W, H);
  const pt = Math.min(10, labelPt(text, wPt * PT));
  c.font = "".concat(pt * k, 'px Arial, "Liberation Sans", Helvetica, sans-serif');
  c.fillStyle = "#222222";
  c.textBaseline = "alphabetic";
  const m = c.measureText(text), asc = (_a = m.fontBoundingBoxAscent) != null ? _a : pt * k * 0.905, desc = (_b = m.fontBoundingBoxDescent) != null ? _b : pt * k * 0.212;
  if (text) c.fillText(text, (W - m.width) / 2, (H - (asc + desc)) / 2 + asc);
  const px = c.getImageData(0, 0, W, H).data, rgb = new Uint8Array(W * H * 3);
  for (let i = 0, j = 0; i < px.length; i += 4, j += 3) {
    rgb[j] = px[i];
    rgb[j + 1] = px[i + 1];
    rgb[j + 2] = px[i + 2];
  }
  return { w: W, h: H, data: await zlibDeflate(rgb) };
}
async function buildPdf(label, masks, overview_) {
  const objs = [];
  const add = (body) => {
    objs.push(body);
    return objs.length;
  };
  const str = (s) => enc.encode(s);
  const stream = (dict, data) => add([str("<< ".concat(dict, " /Length ").concat(data.length, " >>\nstream\n")), data, str("\nendstream")]);
  const jpeg = (b64) => {
    const d = b64ToBytes(b64);
    let w = 0, h = 0;
    for (let i = 2; i < d.length; ) {
      if (d[i] !== 255) {
        i++;
        continue;
      }
      const mk = d[i + 1], len = d[i + 2] << 8 | d[i + 3];
      if (mk >= 192 && mk <= 195) {
        h = d[i + 5] << 8 | d[i + 6];
        w = d[i + 7] << 8 | d[i + 8];
        break;
      }
      i += 2 + len;
    }
    return stream("/Type /XObject /Subtype /Image /Width ".concat(w, " /Height ").concat(h, " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode"), d);
  };
  const catalog = add(null), pagesId = add(null);
  const blocks = await tplBlocks(label), edited = blocks.some(reqEdited);
  const bg1 = jpeg(PDF_BG[PDF_BG[label] ? label : "Resolume"]), bg0 = edited ? jpeg(PDF_BG[bgKey("bare", label)]) : 0, bg2 = jpeg(PDF_BG[bgKey("masks", label)]);
  const pages = [], f = (n) => n.toFixed(4);
  const full = "q ".concat(f(PDF_W), " 0 0 ").concat(f(PDF_H), " 0 0 cm /BG Do Q\n");
  const page = (xobj, content, annots2 = "") => {
    const cs = stream("", str(content));
    pages.push(add(str("<< /Type /Page /Parent ".concat(pagesId, " 0 R /MediaBox [0 0 ").concat(f(PDF_W), " ").concat(f(PDF_H), "] /Resources << /XObject << ").concat(xobj.map(([n, id]) => "/".concat(n, " ").concat(id, " 0 R")).join(" "), " >> >> /Contents ").concat(cs, " 0 R").concat(annots2, " >>"))));
  };
  const textImg = (img) => {
    const sm = stream("/Type /XObject /Subtype /Image /Width ".concat(img.w, " /Height ").concat(img.h, " /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode"), img.alpha);
    return stream("/Type /XObject /Subtype /Image /Width ".concat(img.w, " /Height ").concat(img.h, " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /SMask ").concat(sm, " 0 R"), img.data);
  };
  const linkAnn = ([x0, y0, x1, y1], uri) => add(str("<< /Type /Annot /Subtype /Link /Rect [".concat(x0, " ").concat(y0, " ").concat(x1, " ").concat(y1, "] /Border [0 0 0] /A << /S /URI /URI (").concat(uri.replace(/[()\\]/g, (m) => "\\" + m), ") >> >>")));
  const annots = (a) => a.length ? " /Annots [".concat(a.map((x) => x + " 0 R").join(" "), "]") : "";
  if (!edited) {
    const ann = (PDF_LINKS[label] || []).map(([r, uri]) => linkAnn(r, uri));
    page([["BG", bg1]], full, annots(ann));
  } else {
    // Неизменённые блоки — вырезаны из отрисовки шаблона по рамкам PDF_CLIPS, изменённые — нарисованы заново
    const xo = [["BG", bg0], ["F", bg1]], ann = [], clips = PDF_CLIPS[label] || [], links = PDF_LINKS[label] || [];
    let content = full;
    const clipOf = (info) => clips[info.idx] || [info.rect.x, info.rect.y, info.rect.w, info.rect.h];
    const inClip = ([x0, y0, x1, y1], c) => x0 >= c[0] / EMU_PT - 1 && x1 <= (c[0] + c[2]) / EMU_PT + 1 && y0 >= PDF_H - (c[1] + c[3]) / EMU_PT - 1 && y1 <= PDF_H - c[1] / EMU_PT + 1;
    for (const info of blocks) {
      const c = clipOf(info);
      if (!reqEdited(info)) {
        content += "q ".concat(f(c[0] / EMU_PT), " ").concat(f(PDF_H - (c[1] + c[3]) / EMU_PT), " ").concat(f(c[2] / EMU_PT), " ").concat(f(c[3] / EMU_PT), " re W n ").concat(f(PDF_W), " 0 0 ").concat(f(PDF_H), " 0 0 cm /F Do Q\n");
        links.filter(([r2]) => inClip(r2, c)).forEach(([r2, uri]) => ann.push(linkAnn(r2, uri)));
        continue;
      }
      const r = reqRect(info), tx = (r.x + info.ins.l) / EMU_PT, ty = (r.y + info.ins.t) / EMU_PT, tw = (r.w - 2 * info.ins.l) / EMU_PT;
      const paras = reqParas(info, reqTextOr(info)), th = Math.max(4, Math.min(PDF_H - ty - 2, rtLayout(mctxRT, paras, tw, info.baseSz).h + 4));
      const img = await rtImage(paras, tw, th, info.baseSz, info.baseColor), name = "T" + info.idx;
      xo.push([name, textImg(img)]);
      content += "q ".concat(f(tw), " 0 0 ").concat(f(th), " ").concat(f(tx), " ").concat(f(PDF_H - ty - th), " cm /").concat(name, " Do Q\n");
      img.links.filter((l) => l.y < th).forEach((l) => ann.push(linkAnn([f(tx + l.x), f(PDF_H - ty - l.y - l.h), f(tx + l.x + l.w), f(PDF_H - ty - l.y)], l.url)));
    }
    links.filter(([r2]) => !blocks.some((b) => inClip(r2, clipOf(b)))).forEach(([r2, uri]) => ann.push(linkAnn(r2, uri)));
    page(xo, content, annots(ann));
  }
  const notePdf = async (NL, xo, name) => {
    if (!NL.note) return "";
    const [x, y, w, h] = toPdf(NL.note.rect), img = await rtImage(NL.note.paras, w, h, NL.note.sz, "#222222");
    xo.push([name, textImg(img)]);
    return "q ".concat(f(w), " 0 0 ").concat(f(h), " ").concat(f(x), " ").concat(f(y), " cm /").concat(name, " Do Q\n");
  };
  const toPdf = ([x, y, w, h]) => [x / EMU_PT, PDF_H - (y + h) / EMU_PT, w / EMU_PT, h / EMU_PT];
  const imgs_ = overview_ || [];
  for (const { hz, g } of imgGroups(imgs_)) {
    const ims = g.map((j) => imgs_[j]), key2 = imgKey(ims[0]);
    const NL = noteLayout(noteText(key2), key2), xo = [["BG", bg2]];
    const nc = await notePdf(NL, xo, "N0");
    let content = full;
    for (let j = 0; j < ims.length; j++) {
      const im = ims[j], lay = maskCellLayout(hz, ims.length, j, im.w, im.h, NL.box, null, !!NL.note), [lx, ly, lw, lh] = toPdf(lay.label), [ix, iy, iw, ih] = toPdf(lay.image);
      const lab = await labelImage(im.caption || "", lw, lh);
      xo.push(["L" + j, stream("/Type /XObject /Subtype /Image /Width ".concat(lab.w, " /Height ").concat(lab.h, " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode"), lab.data)]);
      xo.push(["O" + j, stream("/Type /XObject /Subtype /Image /Width ".concat(im.w, " /Height ").concat(im.h, " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode"), im.jpeg)]);
      content += "q ".concat(f(lw), " 0 0 ").concat(f(lh), " ").concat(f(lx), " ").concat(f(ly), " cm /L").concat(j, " Do Q\nq ").concat(f(iw), " 0 0 ").concat(f(ih), " ").concat(f(ix), " ").concat(f(iy), " cm /O").concat(j, " Do Q\n");
    }
    page(xo, content + nc);
  }
  const emapPdf = evenScaleMap(maskGroups(masks), masks);
  for (const { hz, g } of maskGroups(masks)) {
    const xo = [["BG", bg2]], NL = noteLayout(noteText(noteKey(g.map((i) => masks[i]))), noteKey(g.map((i) => masks[i])));
    let content = full;
    const nc = await notePdf(NL, xo, "N0");
    for (let j = 0; j < g.length; j++) {
      const m = masks[g[j]], lay = maskCellLayout(hz, g.length, j, m.w, m.h, NL.box, m.info, !!NL.note, evenSc(emapPdf, m));
      if (lay.info) {
        const [tx, ty, tw, th] = toPdf(lay.info), inf = await infoImage(m.info, tw, th);
        xo.push(["I" + j, stream("/Type /XObject /Subtype /Image /Width ".concat(inf.w, " /Height ").concat(inf.h, " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode"), inf.data)]);
        content += "q ".concat(f(tw), " 0 0 ").concat(f(th), " ").concat(f(tx), " ").concat(f(ty), " cm /I").concat(j, " Do Q\n");
      }
      const [lx, ly, lw, lh] = toPdf(lay.label), [ix, iy, iw, ih] = toPdf(lay.image);
      const lab = await labelImage(m.label, lw, lh);
      const lid = stream("/Type /XObject /Subtype /Image /Width ".concat(lab.w, " /Height ").concat(lab.h, " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode"), lab.data);
      const pp = pngParts(m.png);
      const mid = stream("/Type /XObject /Subtype /Image /Width ".concat(pp.w, " /Height ").concat(pp.h, " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /DecodeParms << /Predictor 15 /Colors 3 /BitsPerComponent 8 /Columns ").concat(pp.w, " >>"), pp.idat);
      xo.push(["L" + j, lid], ["M" + j, mid]);
      content += "q ".concat(f(lw), " 0 0 ").concat(f(lh), " ").concat(f(lx), " ").concat(f(ly), " cm /L").concat(j, " Do Q\nq ").concat(f(iw), " 0 0 ").concat(f(ih), " ").concat(f(ix), " ").concat(f(iy), " cm /M").concat(j, " Do Q\n");
    }
    page(xo, content + nc);
  }
  objs[catalog - 1] = str("<< /Type /Catalog /Pages ".concat(pagesId, " 0 R >>"));
  objs[pagesId - 1] = str("<< /Type /Pages /Kids [".concat(pages.map((p) => p + " 0 R").join(" "), "] /Count ").concat(pages.length, " >>"));
  const parts = [str("%PDF-1.4\n%âãÏÓ\n")];
  let off = parts[0].length;
  const offs = [];
  objs.forEach((body, i) => {
    offs.push(off);
    const chunk = [str("".concat(i + 1, " 0 obj\n")), ...Array.isArray(body) ? body : [body], str("\nendobj\n")];
    for (const c of chunk) {
      parts.push(c);
      off += c.length;
    }
  });
  let xref = "xref\n0 ".concat(objs.length + 1, "\n0000000000 65535 f \n") + offs.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("");
  xref += "trailer\n<< /Size ".concat(objs.length + 1, " /Root ").concat(catalog, " 0 R >>\nstartxref\n").concat(off, "\n%%EOF\n");
  parts.push(str(xref));
  return new Blob(parts, { type: "application/pdf" });
}
// 2.0.140: в названиях проекта и файлов — только буквы, цифры, пробел, «-» и «_». Точки, запятые, скобки
// и другие знаки → «_» (несколько подряд — один), пробелы и «_» по краям убираются
const cleanName = (n) => String(n == null ? "" : n).replace(/[^\p{L}\p{N} _-]/gu, "_").replace(/_{2,}/g, "_").replace(/ {2,}/g, " ");
const safeName = (n, fb = "LED_Mask") => {
  const s = cleanName(String(n || "").trim()).replace(/^[ _]+|[ _]+$/g, "");
  return s || fb;
};
const pad2 = (n) => String(n).padStart(2, "0");
// 2.0.108: имя файла маски — «1920x1080-» (размер, всегда авто) + часть, которую можно изменить (st.file); по умолчанию — название экрана
const maskFileTail = (st) => String(st.file || "").trim() || st.name || "screen";
const maskFileBase = (st) => {
  const [W, H] = dims(st);
  return "".concat(W, "x").concat(H, "-").concat(safeName(maskFileTail(st)));
};
// 2.0.106: имя файла поля — «1920x1080-» (размер, всегда авто) + часть, которую можно изменить (f.file);
// по умолчанию — «screens 1-2-3» (номера масок поля)
function fieldFileAuto(f) {
  const rs = fieldRects(f);
  // 2.0.107: одна маска — «screen 3», несколько — «screens 1-2-3»
  return (rs.length === 1 ? "screen " : "screens ") + rs.map((r) => r.i + 1).sort((x, y) => x - y).join("-");
}
function fieldFilePre(f) {
  const b = fieldBBox(fieldRects(f));
  return b ? "".concat(b.w, "x").concat(b.h, "-") : "";
}
function fieldFileBase(f) {
  const tail = String(f.file || "").trim() || fieldFileAuto(f);
  return safeName(fieldFilePre(f) + tail, "screens").slice(0, 180);
}
function uniqueNamer() {
  const used = /* @__PURE__ */ new Map();
  return (base) => {
    const k = base.toLowerCase(), n = (used.get(k) || 0) + 1;
    used.set(k, n);
    return n === 1 ? base : "".concat(base, " (").concat(n, ")");
  };
}
const tick = () => new Promise((r) => setTimeout(r, 0));
function busy(msg) {
  $("busyText").textContent = msg;
  $("busy").hidden = !msg;
}
const MIME = { png: "image/png", zip: "application/zip", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", json: "application/json", ledmask: "application/xml" };
async function saveStandalone(filename, data) {
  const ext = filename.split(".").pop().toLowerCase();
  const blob = data instanceof Blob ? data : new Blob([data], { type: MIME[ext] || "application/octet-stream" });
  const file = new File([blob], filename, { type: MIME[ext] || blob.type || "application/octet-stream" });
  const touch = matchMedia("(pointer: coarse)").matches;
  if (touch) return saveSheet(filename, blob, file);
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 6e4);
  status("Сохранено: " + filename, true);
  return true;
}
function saveSheet(filename, blob, file) {
  return new Promise((done) => {
    const sh = $("saveSheet"), url = URL.createObjectURL(blob), canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
    $("saveName").textContent = "".concat(filename, " · ").concat((blob.size / 1048576).toFixed(1), " МБ");
    const link = $("saveLink");
    link.href = url;
    link.download = filename;
    $("saveShare").hidden = !canShare;
    const close = (ok) => {
      sh.hidden = true;
      setTimeout(() => URL.revokeObjectURL(url), 12e4);
      done(ok);
    };
    $("saveShare").onclick = async () => {
      try {
        await navigator.share({ files: [file] });
        status("Готово: " + filename, true);
        close(true);
      } catch (e) {
        if (!(e && e.name === "AbortError")) status("«Поделиться» не сработало — нажмите «Скачать»", true);
      }
    };
    link.onclick = () => {
      status("Скачивание: " + filename + " (папка «Загрузки» в Файлах)", true);
      setTimeout(() => close(true), 400);
    };
    $("saveCancel").onclick = () => close(false);
    sh.hidden = false;
  });
}
async function saveAndroid(filename, data) {
  const br = window.AndroidBridge;
  const bytes = data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : typeof data === "string" ? enc.encode(data) : new Uint8Array(data);
  const id = br.begin(filename);
  if (!id) {
    status("Не удалось начать сохранение", true);
    return false;
  }
  const CH = 3 * 256 * 1024;
  for (let i = 0; i < bytes.length; i += CH) {
    const part = bytes.subarray(i, i + CH);
    let bin = "";
    for (let j = 0; j < part.length; j += 32768) bin += String.fromCharCode.apply(null, part.subarray(j, j + 32768));
    if (!br.append(id, btoa(bin))) {
      status("Ошибка записи файла", true);
      return false;
    }
    if (bytes.length > CH * 4) {
      busy("Сохранение… ".concat(Math.round(Math.min(1, (i + CH) / bytes.length) * 100), "%"));
      await tick();
    }
  }
  busy("");
  const r = String(br.finish(id, filename));
  const ok = r.startsWith("ok:");
  status(r.slice(r.indexOf(":") + 1), true);
  return ok;
}
async function saveDesktop(filename, data) {
  try {
    const bytes = await toBytes(data);
    const token = await desk("saveBegin", { name: filename });
    if (!token) {
      status("Сохранение отменено", true);
      return false;
    }
    const CH = 3 * 256 * 1024;
    for (let i = 0; i < bytes.length; i += CH) {
      await desk("saveAppend", { token, b64: bytesToB64(bytes.subarray(i, i + CH)) });
      if (bytes.length > CH * 4) {
        busy("Сохранение… ".concat(Math.round(Math.min(1, (i + CH) / bytes.length) * 100), "%"));
        await tick();
      }
    }
    const where = await desk("saveFinish", { token });
    busy("");
    status("Сохранено: " + (where || filename), true);
    return true;
  } catch (e) {
    busy("");
    status("Не удалось сохранить файл: " + e.message, true);
    return false;
  }
}
async function save(filename, data) {
  if (window.AndroidBridge) return saveAndroid(filename, data);
  if (DESKTOP) return saveDesktop(filename, data);
  if (STANDALONE) return saveStandalone(filename, data);
  if (!downloads) {
    status("Сохранение файлов недоступно в этом окне", true);
    return false;
  }
  try {
    await downloads.save({ filename, data });
    status("Готово: " + filename, true);
    return true;
  } catch (e) {
    const c = e && e.code;
    status(c === "declined" ? "Сохранение отменено" : c === "too_large" ? "Файл слишком большой для этого способа сохранения" : c === "rate_limited" ? "Подождите — предыдущее сохранение ещё не закрыто" : "Не удалось сохранить файл", true);
    return false;
  }
}
async function exportCurrentPNG() {
  const st = S(), [W, H] = dims(st);
  busy("Рендер ".concat(W, "×").concat(H, "…"));
  await tick();
  try {
    const r = await renderPNG(st, async (p) => {
      busy("Рендер ".concat(W, "×").concat(H, "… ").concat(Math.round(p * 100), "%"));
      await tick();
    });
    busy("");
    await save("".concat(maskFileBase(st), ".png"), new Blob([r.png], { type: "image/png" }));
  } catch (e) {
    busy("");
    status("Ошибка рендера: " + e.message, true);
  }
}
async function renderAll(prefix) {
  const out = [], uniq = uniqueNamer();
  for (let i = 0; i < project.screens.length; i++) {
    const st = project.screens[i], [W, H] = dims(st), name = safeName(st.name || "Экран_".concat(i + 1));
    busy("Экран ".concat(i + 1, " из ").concat(project.screens.length, ": ").concat(W, "×").concat(H, "…"));
    await tick();
    const r = await renderPNG(st);
    out.push({ ...r, file: "".concat(prefix).concat(uniq(maskFileBase(st)), ".png"), label: "".concat(W, "×").concat(H, "  |  ").concat(name, "  |  ").concat(physText(st)) });
  }
  return out;
}
async function exportAllPNG() {
  try {
    const pngs = await renderAll("");
    busy("Упаковка ZIP…");
    await tick();
    const z = await zip(pngs.map((p) => ({ name: p.file, data: p.png })));
    busy("");
    await save("".concat(safeName(project.name, "Проект"), "_PNG").concat(verSfx(), ".zip"), z);
  } catch (e) {
    busy("");
    status("Ошибка экспорта: " + e.message, true);
  }
}
