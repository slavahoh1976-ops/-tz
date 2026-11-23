// 3.0.39–3.0.43: встроенные шрифты (на экране и в PDF/SVG одинаково, в PDF/SVG — кривыми):
//  • LMG Sans — урезанная и переименованная копия Liberation Sans 2.1.5 (SIL OFL 1.1, размеры букв как у Arial) — текст ТЗ и подписи;
//  • LMG Mask X — урезанные копии свободных шрифтов (SIL OFL 1.1), похожих на Gill Sans, — надписи на масках; выбор — в разделе «Текст» маски.
//    SLsans и SLsans Round — шрифты автора программы (только обычное начертание; жирный — утолщением, как у браузера; «×» — свой).
//    Шрифты с зарезервированными именами (PT Sans, Source, Lato, Istok) внутри переименованы; лицензии — в исходниках (fonts/LICENSE-*).
const SANS_FAMILY = "LMG Sans";
const MASK_FONTS = [["SR", "SLsans Round (по умолчанию)"], ["SL", "SLsans"], ["F", "Fira Sans"], ["P", "PT Sans"], ["S", "на основе Source Sans 3"], ["L", "на основе Lato"], ["Y", "Ysabeau Office"], ["C", "Scada"], ["J", "Jost"], ["I", "на основе Istok"]];
const BUNDLED_B64 = {
  "LMG Sans": { r: "{{b64:fonts/LMGSans-Regular.ttf}}", b: "{{b64:fonts/LMGSans-Bold.ttf}}", i: "{{b64:fonts/LMGSans-Italic.ttf}}", bi: "{{b64:fonts/LMGSans-BoldItalic.ttf}}" },
  "LMG Mask SL": { r: "{{b64:fonts/SLsans-Regular.ttf}}" },
  "LMG Mask SR": { r: "{{b64:fonts/SLsansRound-Regular.ttf}}" },
  "LMG Mask P": { r: "{{b64:fonts/LMGMaskP-Regular.ttf}}", b: "{{b64:fonts/LMGMaskP-Bold.ttf}}" },
  "LMG Mask F": { r: "{{b64:fonts/LMGMaskF-Regular.ttf}}", b: "{{b64:fonts/LMGMaskF-Bold.ttf}}" },
  "LMG Mask S": { r: "{{b64:fonts/LMGMaskS-Regular.ttf}}", b: "{{b64:fonts/LMGMaskS-Bold.ttf}}" },
  "LMG Mask L": { r: "{{b64:fonts/LMGMaskL-Regular.ttf}}", b: "{{b64:fonts/LMGMaskL-Bold.ttf}}" },
  "LMG Mask Y": { r: "{{b64:fonts/LMGMaskY-Regular.ttf}}", b: "{{b64:fonts/LMGMaskY-Bold.ttf}}" },
  "LMG Mask C": { r: "{{b64:fonts/LMGMaskC-Regular.ttf}}", b: "{{b64:fonts/LMGMaskC-Bold.ttf}}" },
  "LMG Mask J": { r: "{{b64:fonts/LMGMaskJ-Regular.ttf}}", b: "{{b64:fonts/LMGMaskJ-Bold.ttf}}" },
  "LMG Mask I": { r: "{{b64:fonts/LMGMaskI-Regular.ttf}}", b: "{{b64:fonts/LMGMaskI-Bold.ttf}}" }
};
const BUNDLED_FACES = {};
for (const k of Object.keys(BUNDLED_B64)) BUNDLED_FACES[k] = [];
let SANS_FACES = BUNDLED_FACES["LMG Sans"];
const SANS_READY = (async () => {
  for (const fam of Object.keys(BUNDLED_B64)) {
    for (const k of Object.keys(BUNDLED_B64[fam])) {
      try {
        const bytes = ufUnB64(BUNDLED_B64[fam][k]), f = Object.assign({ bytes, file: fam + "-" + k }, ufParse(bytes));
        f.weight = k.indexOf("b") === 0 ? 700 : 400;
        f.italic = k.indexOf("i") >= 0;
        BUNDLED_FACES[fam].push(f);
        const ff = new FontFace(fam, bytes, { weight: f.weight === 700 ? "700" : "400", style: f.italic ? "italic" : "normal" });
        await ff.load();
        document.fonts.add(ff);
      } catch (e) {
        console.warn(fam, k, e);
      }
    }
  }
  if (typeof requestDraw === "function") requestDraw();
})();
// начертание встроенного семейства для жирности/курсива (как подбирает браузер)
function bundledPick(fam, bold, ital) {
  const fs = BUNDLED_FACES[fam];
  if (!fs || !fs.length) return null;
  const sc = (f) => ((f.weight >= 600) === bold ? 2 : 0) + (f.italic === ital ? 1 : 0);
  let best = fs[0];
  for (const f of fs) if (sc(f) > sc(best)) best = f;
  return { face: best, fakeBold: bold && best.weight < 600, fakeItal: ital && !best.italic };
}
const sansPick = (bold, ital) => bundledPick(SANS_FAMILY, bold, ital);
// шрифт надписей масок — один на проект (project.tz.maskFont), недостающие знаки — из LMG Sans
const FONT_SYS = '"Gill Sans", "Gill Sans MT", GillSans, Calibri, "Segoe UI", system-ui, sans-serif';
function ufHas() {
  return typeof ufStored === "function" && ufStored().length > 0;
}
const maskFontKey = () => {
  const k = project && project.tz && project.tz.maskFont;
  if (k === "U") return ufHas() ? "U" : "SR";
  return MASK_FONTS.some((f) => f[0] === k) ? k : "SR";
};
function applyMaskFont() {
  const k = maskFontKey();
  // 3.0.53: свой шрифт; пока не загружен — встроенный SR
  const uf = k === "U" && typeof ufFontChain === "function" ? ufFontChain() : "";
  FONT = k === "U" ? uf + '"LMG Mask SR", "LMG Sans", ' + FONT_SYS : '"LMG Mask '.concat(k, '", "LMG Sans", ').concat(FONT_SYS);
  const sel = $("mFont"), fb = $("fbMFont");
  if (sel && sel.value !== k) sel.value = k;
  if (fb && fb.value !== k) fb.value = k;
}
function maskFontOptions() {
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const own = ufHas() ? '<option value="U">Свой: '.concat(esc(typeof ufName === "function" ? ufName() : ""), "</option>") : "";
  for (const id of ["mFont", "fbMFont"]) {
    const el = $(id);
    if (!el) continue;
    el.innerHTML = MASK_FONTS.map(([k, n]) => '<option value="'.concat(k, '">').concat(n, "</option>")).join("") + own + '<option value="__add">＋ Добавить свой шрифт (.ttf)…</option>';
    el.value = maskFontKey();
  }
}
for (const id of ["mFont", "fbMFont"]) {
  const el = $(id);
  if (!el) continue;
  el.onchange = (e) => {
    if (e.target.value === "__add") {
      e.target.value = maskFontKey();
      if (typeof ufPickFile === "function") ufPickFile();
      return;
    }
    project.tz.maskFont = e.target.value;
    applyMaskFont();
    if (typeof changed === "function") changed();
    else requestDraw();
  };
}
maskFontOptions();
{
  // при каждой перерисовке — шрифт текущего проекта (загрузка, новый проект, отмена)
  const rd0 = requestDraw;
  requestDraw = function () {
    try {
      applyMaskFont();
    } catch (e) {
    }
    return rd0.apply(this, arguments);
  };
}
