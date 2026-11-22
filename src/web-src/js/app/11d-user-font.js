// 3.0.37: свой шрифт надписей. Файлы TrueType (.ttf) пользователь подключает сам — они хранятся только в этой
// программе/браузере (localStorage), в сайт и сборки не попадают. Шрифт ставится первым в FONT (надписи масок
// на экране и в PNG), а в PDF ТЗ Resolume/D3/MP4 надписи этим шрифтом идут в кривых (контуры букв, 3.0.38).
// ступени: 1 — шрифты с кириллицей, 2 — остальные (недостающие знаки берутся со следующей ступени, как в браузере)
const UF_FAM = (tier) => "LMG UF " + tier;
const UF_KEY = "ledmask.userFonts";
const FONT_BASE = FONT.replace('"LMG Mask SR", "LMG Sans", ', "");
let UF_FACES = [];
function ufU16(d, o) {
  return d[o] << 8 | d[o + 1];
}
function ufI16(d, o) {
  const v = ufU16(d, o);
  return v & 32768 ? v - 65536 : v;
}
function ufU32(d, o) {
  return (d[o] << 24 >>> 0) + (d[o + 1] << 16 | d[o + 2] << 8 | d[o + 3]);
}
// разбор TrueType: метрики, ширины, таблица символов
function ufParse(bytes) {
  const d = bytes, tag = String.fromCharCode(d[0], d[1], d[2], d[3]);
  if (tag === "ttcf") throw new Error("коллекция .ttc — выберите отдельный файл .ttf");
  if (tag === "OTTO") throw new Error("шрифт OpenType с контурами CFF (.otf) — нужен TrueType .ttf");
  const n = ufU16(d, 4), T = {};
  for (let i = 0; i < n; i++) {
    const o = 12 + i * 16;
    T[String.fromCharCode(d[o], d[o + 1], d[o + 2], d[o + 3])] = ufU32(d, o + 8);
  }
  for (const t of ["head", "hhea", "hmtx", "cmap", "maxp"]) if (T[t] == null) throw new Error("в файле нет таблицы " + t);
  if (T.glyf == null) throw new Error("нет контуров TrueType (glyf)");
  const h = T.head, upm = ufU16(d, h + 18), bbox = [ufI16(d, h + 36), ufI16(d, h + 38), ufI16(d, h + 40), ufI16(d, h + 42)];
  const hh = T.hhea, asc = ufI16(d, hh + 4), desc = ufI16(d, hh + 6), nhm = ufU16(d, hh + 34), ng = ufU16(d, T.maxp + 4);
  const adv = new Uint16Array(ng);
  for (let g = 0; g < ng; g++) adv[g] = ufU16(d, T.hmtx + 4 * Math.min(g, nhm - 1));
  // таблица символов: формат 12 (полный Unicode) или 4
  const cmap = new Map(), c0 = T.cmap, nt = ufU16(d, c0 + 2);
  let best = -1, bestScore = -1;
  for (let i = 0; i < nt; i++) {
    const p = ufU16(d, c0 + 4 + i * 8), e = ufU16(d, c0 + 6 + i * 8), off = ufU32(d, c0 + 8 + i * 8), fmt = ufU16(d, c0 + off);
    const sc = fmt === 12 && (p === 3 && e === 10 || p === 0) ? 3 : fmt === 4 && (p === 3 && (e === 1 || e === 0) || p === 0) ? 2 : 0;
    if (sc > bestScore) {
      bestScore = sc;
      best = c0 + off;
    }
  }
  if (bestScore <= 0) throw new Error("нет таблицы символов Unicode");
  if (ufU16(d, best) === 12) {
    const ng2 = ufU32(d, best + 12);
    for (let i = 0; i < ng2; i++) {
      const o = best + 16 + i * 12, s = ufU32(d, o), e = ufU32(d, o + 4), g = ufU32(d, o + 8);
      for (let c = s; c <= e && c - s < 65536; c++) cmap.set(c, g + c - s);
    }
  } else {
    const seg = ufU16(d, best + 6) / 2, eo = best + 14, so = eo + seg * 2 + 2, dO = so + seg * 2, ro = dO + seg * 2;
    for (let i = 0; i < seg; i++) {
      const e = ufU16(d, eo + i * 2), s = ufU16(d, so + i * 2), dl = ufI16(d, dO + i * 2), r = ufU16(d, ro + i * 2);
      for (let c = s; c <= e && c !== 65535; c++) {
        let g;
        if (!r) g = c + dl & 65535;
        else {
          const gi = ro + i * 2 + r + (c - s) * 2;
          g = ufU16(d, gi);
          if (g) g = g + dl & 65535;
        }
        if (g) cmap.set(c, g);
      }
    }
  }
  // старые русификации (кодировка 1251): на местах Latin-1 (À…ÿ, ×) нарисованы русские буквы — такие знаки
  // из этого шрифта не берём (на экране и в PDF они придут из следующего шрифта)
  const bad = [];
  if (T.loca != null) {
    const long = ufI16(d, h + 50) === 1, gOff = (g) => long ? ufU32(d, T.loca + g * 4) : ufU16(d, T.loca + g * 2) * 2;
    const key = (g) => {
      const a = gOff(g), b = gOff(g + 1);
      if (b <= a) return "";
      let x = 2166136261;
      for (let i = T.glyf + a; i < T.glyf + b; i++) x = Math.imul(x ^ d[i], 16777619);
      return b - a + ":" + (x >>> 0);
    };
    const cyrK = new Set();
    cmap.forEach((g, c) => {
      if (c >= 1024 && c <= 1279) {
        const k = key(g);
        if (k) cyrK.add(k);
      }
    });
    if (cyrK.size) for (let c = 160; c <= 255; c++) if (cmap.has(c) && cyrK.has(key(cmap.get(c)))) bad.push(c);
    for (const c of bad) cmap.delete(c);
  }
  let range = "";
  if (bad.length) {
    const rs = [];
    let st = 0;
    for (const c of bad) {
      if (c > st) rs.push([st, c - 1]);
      st = c + 1;
    }
    rs.push([st, 1114111]);
    range = rs.map(([a, b]) => a === b ? "U+" + a.toString(16) : "U+" + a.toString(16) + "-" + b.toString(16)).join(", ");
  }
  let weight = 400, italic = false, cap = asc, fsType = 0;
  if (T["OS/2"] != null) {
    const o = T["OS/2"];
    weight = ufU16(d, o + 4) || 400;
    fsType = ufU16(d, o + 8);
    italic = !!(ufU16(d, o + 62) & 1);
    if (ufU16(d, o) >= 2) cap = ufI16(d, o + 88) || asc;
  }
  if (ufU16(d, h + 44) & 2) italic = true;
  if (ufU16(d, h + 44) & 1) weight = Math.max(weight, 700);
  let angle = 0;
  if (T.post != null) angle = ufI16(d, T.post + 4) + ufU16(d, T.post + 6) / 65536;
  let family = "", full = "";
  if (T.name != null) {
    const o = T.name, cnt = ufU16(d, o + 2), so2 = o + ufU16(d, o + 4);
    for (let i = 0; i < cnt; i++) {
      const r = o + 6 + i * 12, p = ufU16(d, r), id = ufU16(d, r + 6), len = ufU16(d, r + 8), off = ufU16(d, r + 10);
      if (id !== 1 && id !== 4) continue;
      let s = "";
      if (p === 3 || p === 0) for (let k = 0; k < len; k += 2) s += String.fromCharCode(ufU16(d, so2 + off + k));
      else for (let k = 0; k < len; k++) s += String.fromCharCode(d[so2 + off + k]);
      if (id === 1 && !family) family = s;
      if (id === 4 && !full) full = s;
    }
  }
  const nm = (family + " " + full).toLowerCase();
  if (/bold|black|heavy|semibold|demi/.test(nm)) weight = Math.max(weight, 700);
  if (/italic|oblique|kursiv/.test(nm)) italic = true;
  const cyr = [...cmap.keys()].some((c) => c >= 1040 && c <= 1103);
  return { d, glyfOff: T.glyf, locaOff: T.loca, locaLong: ufI16(d, h + 50) === 1, ng, upm, bbox, asc, desc, cap, adv, cmap, bad, range, weight, italic, angle, fsType, tier: cyr ? 1 : 2, kind: (weight >= 600 ? "b" : "r") + (italic ? "i" : ""), family: family || "Font", full: full || family || "Font" };
}
function ufB64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
  return btoa(s);
}
function ufUnB64(b) {
  const s = atob(b), out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
function ufStored() {
  try {
    const a = JSON.parse(localStorage.getItem(UF_KEY) || "[]");
    return Array.isArray(a) ? a : [];
  } catch (e) {
    return [];
  }
}
// подключить сохранённые начертания: FontFace для холста + разобранные метрики для PDF
async function ufApply() {
  let faces = [];
  for (const it of ufStored()) {
    try {
      const bytes = ufUnB64(it.b64), info = ufParse(bytes);
      faces.push(Object.assign({ bytes, file: it.name }, info));
    } catch (e) {
      console.warn("Шрифт", it.name, e);
    }
  }
  // одно начертание на ступень: более позднее заменяет раннее
  faces = faces.filter((f, i) => !faces.some((g, j) => j > i && g.tier === f.tier && g.kind === f.kind));
  try {
    for (const ff of Array.from(document.fonts)) if (/LMG UF \d/.test(ff.family)) document.fonts.delete(ff);
  } catch (e) {}
  for (const f of faces) {
    try {
      const dsc = { weight: f.weight >= 600 ? "700" : "400", style: f.italic ? "italic" : "normal" };
      if (f.range) dsc.unicodeRange = f.range;
      const ff = new FontFace(UF_FAM(f.tier), f.bytes, dsc);
      await ff.load();
      document.fonts.add(ff);
    } catch (e) {
      console.warn("FontFace", f.file, e);
    }
  }
  UF_FACES = faces;
  const tiers = [1, 2].filter((t) => faces.some((f) => f.tier === t));
  // 3.0.40: знаки, которых нет в своих шрифтах («×», «Ё», «№»), — из встроенного LMG Sans: на экране и в PDF одинаково, в PDF — кривыми
  if (tiers.length) FONT = tiers.map((t) => '"' + UF_FAM(t) + '", ').join("") + '"LMG Mask SR", "LMG Sans", ' + FONT_BASE;
  ufUi();
  if (typeof requestDraw === "function") requestDraw();
}
// начертание ступени для жирности/курсива — как подбирает браузер; синтетика, если нужного нет
function ufPick(tier, bold, ital) {
  const fs = UF_FACES.filter((f) => f.tier === tier);
  if (!fs.length) return null;
  const sc = (f) => ((f.weight >= 600) === bold ? 2 : 0) + (f.italic === ital ? 1 : 0);
  let best = fs[0];
  for (const f of fs) if (sc(f) > sc(best)) best = f;
  return { face: best, fakeBold: bold && best.weight < 600, fakeItal: ital && !best.italic };
}
function ufUi() {
  const lab = $("tFontInfo");
  if (!lab) return;
  const st = ufStored();
  setTxt(lab, st.length ? UF_FACES.map((f) => f.full).join(", ") || st.map((s2) => s2.name).join(", ") : "встроенный LMG Sans (в PDF — кривыми)");
  $("tFontClear").hidden = !st.length;
}
async function ufAddFiles(files) {
  const cur = ufStored(), msgs = [];
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let info;
    try {
      info = ufParse(bytes);
    } catch (e) {
      msgs.push("«".concat(file.name, "»: ").concat(e.message));
      continue;
    }
    // то же начертание той же ступени — заменяется новым
    for (let i = cur.length - 1; i >= 0; i--) {
      try {
        const o = ufParse(ufUnB64(cur[i].b64));
        if (o.tier === info.tier && o.kind === info.kind) cur.splice(i, 1);
      } catch (e) {
        cur.splice(i, 1);
      }
    }
    cur.push({ name: file.name, b64: ufB64(bytes) });
    if (info.tier === 2) msgs.push("«".concat(file.name, "»: без русских букв — из него берутся только недостающие знаки"));
  }
  try {
    localStorage.setItem(UF_KEY, JSON.stringify(cur));
  } catch (e) {
    status("Не хватило места для шрифта в хранилище браузера", true);
    return;
  }
  await ufApply();
  status(msgs.length ? msgs.join(" · ") : "Шрифт подключён: надписи масок — этим шрифтом, в PDF ТЗ — в кривых", true);
}
if ($("tFontAdd")) {
  $("tFontAdd").onclick = () => $("tFontFile").click();
  $("tFontFile").onchange = async (e) => {
    const fs = Array.from(e.target.files || []);
    e.target.value = "";
    if (fs.length) await ufAddFiles(fs);
    // подключали из окна «Сохранить ТЗ» — сохраняем дальше
    const then = window.__ufThenSave;
    window.__ufThenSave = null;
    if (then && UF_FACES.length) setTimeout(then, 300);
  };
  $("tFontClear").onclick = async () => {
    try {
      localStorage.removeItem(UF_KEY);
    } catch (e) {}
    await ufApply();
    status("Свой шрифт отключён — надписи встроенным LMG Sans", true);
  };
}
// 3.0.42: свои шрифты больше не подключаются — у всех встроенный LMG Sans; запомненные раньше — убрать
try {
  localStorage.removeItem(UF_KEY);
} catch (e) {
}
ufApply();
// ---- контуры букв (TrueType glyf) → команды пути PDF в единицах шрифта, ось Y вверх ----
function ufGlyphPath(f, gid, depth) {
  if (!f.paths) f.paths = new Map();
  if (!depth && f.paths.has(gid)) return f.paths.get(gid);
  const d = f.d, lo = (g) => f.locaLong ? ufU32(d, f.locaOff + g * 4) : ufU16(d, f.locaOff + g * 2) * 2;
  let out = [];
  if (gid < f.ng && f.locaOff != null) {
    const a = lo(gid), b = lo(gid + 1);
    if (b > a) {
      const o = f.glyfOff + a, nc = ufI16(d, o);
      if (nc >= 0) out = ufSimple(d, o, nc);
      else if ((depth || 0) < 8) out = ufComposite(f, d, o, depth || 0);
    }
  }
  if (!depth) f.paths.set(gid, out);
  return out;
}
function ufSimple(d, o, nc) {
  const ends = [];
  for (let i = 0; i < nc; i++) ends.push(ufU16(d, o + 10 + i * 2));
  const np = nc ? ends[nc - 1] + 1 : 0;
  let p = o + 10 + nc * 2;
  p += 2 + ufU16(d, p);
  const fl = new Uint8Array(np);
  for (let i = 0; i < np; ) {
    const f = d[p++];
    fl[i++] = f;
    if (f & 8) {
      let r = d[p++];
      while (r-- > 0 && i < np) fl[i++] = f;
    }
  }
  const xs = new Int32Array(np), ys = new Int32Array(np);
  let v = 0;
  for (let i = 0; i < np; i++) {
    const f = fl[i];
    if (f & 2) {
      v += f & 16 ? d[p] : -d[p];
      p++;
    } else if (!(f & 16)) {
      v += ufI16(d, p);
      p += 2;
    }
    xs[i] = v;
  }
  v = 0;
  for (let i = 0; i < np; i++) {
    const f = fl[i];
    if (f & 4) {
      v += f & 32 ? d[p] : -d[p];
      p++;
    } else if (!(f & 32)) {
      v += ufI16(d, p);
      p += 2;
    }
    ys[i] = v;
  }
  // контур из точек «на кривой» и контрольных (квадратичные) → m/l/c
  const cmds = [];
  let st = 0;
  for (const e of ends) {
    const pts = [];
    for (let i = st; i <= e; i++) pts.push([xs[i], ys[i], !!(fl[i] & 1)]);
    st = e + 1;
    if (!pts.length) continue;
    // начало — точка на кривой (если все контрольные — середина первых двух)
    let k0 = pts.findIndex((q) => q[2]), start;
    if (k0 < 0) {
      start = [(pts[0][0] + pts[1 % pts.length][0]) / 2, (pts[0][1] + pts[1 % pts.length][1]) / 2, true];
      k0 = 0;
    } else {
      start = pts[k0];
      k0 = k0 + 1;
    }
    cmds.push(["m", start[0], start[1]]);
    let cur = start, ctrl = null;
    const n = pts.length;
    for (let j = 0; j < n; j++) {
      const q = pts[(k0 + j) % n];
      if (q === start) continue;
      if (q[2]) {
        if (ctrl) cmds.push(ufQ(cur, ctrl, q));
        else cmds.push(["l", q[0], q[1]]);
        cur = q;
        ctrl = null;
      } else if (ctrl) {
        const mid = [(ctrl[0] + q[0]) / 2, (ctrl[1] + q[1]) / 2];
        cmds.push(ufQ(cur, ctrl, mid));
        cur = mid;
        ctrl = q;
      } else ctrl = q;
    }
    if (ctrl) cmds.push(ufQ(cur, ctrl, start));
    cmds.push(["h"]);
  }
  return cmds;
}
function ufQ(p0, c, p1) {
  return ["c", p0[0] + 2 / 3 * (c[0] - p0[0]), p0[1] + 2 / 3 * (c[1] - p0[1]), p1[0] + 2 / 3 * (c[0] - p1[0]), p1[1] + 2 / 3 * (c[1] - p1[1]), p1[0], p1[1]];
}
function ufComposite(f, d, o, depth) {
  const out = [];
  let p = o + 10, more = true;
  while (more) {
    const fl = ufU16(d, p), g = ufU16(d, p + 2);
    p += 4;
    let dx, dy;
    if (fl & 1) {
      dx = ufI16(d, p);
      dy = ufI16(d, p + 2);
      p += 4;
    } else {
      dx = d[p] << 24 >> 24;
      dy = d[p + 1] << 24 >> 24;
      p += 2;
    }
    let a = 1, b = 0, c = 0, e = 1;
    const f2 = (q) => ufI16(d, q) / 16384;
    if (fl & 8) {
      a = e = f2(p);
      p += 2;
    } else if (fl & 64) {
      a = f2(p);
      e = f2(p + 2);
      p += 4;
    } else if (fl & 128) {
      a = f2(p);
      b = f2(p + 2);
      c = f2(p + 4);
      e = f2(p + 6);
      p += 8;
    }
    if (!(fl & 2)) dx = dy = 0;
    for (const cm of ufGlyphPath(f, g, depth + 1)) {
      if (cm[0] === "h") {
        out.push(cm);
        continue;
      }
      const r = [cm[0]];
      for (let i = 1; i < cm.length; i += 2) r.push(a * cm[i] + c * cm[i + 1] + dx, b * cm[i] + e * cm[i + 1] + dy);
      out.push(r);
    }
    more = !!(fl & 32);
  }
  return out;
}
function ufPathStr(cmds, ox) {
  let s = "";
  const n = (v) => String(Math.round(v * 10) / 10);
  for (const c of cmds) {
    if (c[0] === "h") s += "h ";
    else if (c[0] === "c") s += n(c[1] + ox) + " " + n(c[2]) + " " + n(c[3] + ox) + " " + n(c[4]) + " " + n(c[5] + ox) + " " + n(c[6]) + " c ";
    else s += n(c[1] + ox) + " " + n(c[2]) + " " + c[0] + " ";
  }
  return s;
}
