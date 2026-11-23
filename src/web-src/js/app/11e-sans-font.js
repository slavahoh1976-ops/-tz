// 3.0.39–3.0.43: встроенные шрифты (на экране и в PDF/SVG одинаково, в PDF/SVG — кривыми):
//  • LMG Sans — урезанная и переименованная копия Liberation Sans 2.1.5 (SIL OFL 1.1, размеры букв как у Arial) — текст ТЗ и подписи;
//  • LMG Mask X — урезанные копии свободных шрифтов (SIL OFL 1.1), похожих на Gill Sans, — надписи на масках; выбор — в разделе «Текст» маски.
//    HohSans и HohSans Round (3.0.63, вместо SLsans) — шрифты автора программы (только обычное начертание; жирный — утолщением, как у браузера; «×» — свой).
//    Шрифты с зарезервированными именами (PT Sans, Source, Lato, Istok, IBM Plex, PT Sans Narrow, Play, Ubuntu) внутри переименованы; лицензии — в исходниках (fonts/LICENSE-*).
//  3.0.60: свободные шрифты (OFL / Apache / UFL) — латиница и кириллица; в выборе каждое имя написано своим шрифтом.
const SANS_FAMILY = "LMG Sans";
const MASK_FONTS = [["HS", "HohSans (по умолчанию)"], ["HR", "HohSans Round"], ["F", "Fira Sans"], ["S", "на основе Source Sans 3"], ["L", "на основе Lato"], ["J", "Jost"], ["I", "на основе Istok"], ["RB", "Roboto"], ["NS", "Noto Sans"], ["AR", "Arimo"], ["IP", "на основе IBM Plex Sans"], ["IN", "Inter"], ["MR", "Manrope"], ["WX", "Wix Madefor Text"], ["UB", "на основе Ubuntu Sans"], ["FC", "Fira Sans Condensed"], ["PL", "на основе Play"]];
const BUNDLED_B64 = {
  "LMG Sans": { r: "{{b64:fonts/LMGSans-Regular.ttf}}", b: "{{b64:fonts/LMGSans-Bold.ttf}}", i: "{{b64:fonts/LMGSans-Italic.ttf}}", bi: "{{b64:fonts/LMGSans-BoldItalic.ttf}}" },
  "LMG Mask HS": { r: "{{b64:fonts/HohSans-Regular.ttf}}" },
  "LMG Mask HR": { r: "{{b64:fonts/HohSansRound-Regular.ttf}}" },
  "LMG Mask F": { r: "{{b64:fonts/LMGMaskF-Regular.ttf}}", b: "{{b64:fonts/LMGMaskF-Bold.ttf}}" },
  "LMG Mask S": { r: "{{b64:fonts/LMGMaskS-Regular.ttf}}", b: "{{b64:fonts/LMGMaskS-Bold.ttf}}" },
  "LMG Mask L": { r: "{{b64:fonts/LMGMaskL-Regular.ttf}}", b: "{{b64:fonts/LMGMaskL-Bold.ttf}}" },
  "LMG Mask J": { r: "{{b64:fonts/LMGMaskJ-Regular.ttf}}", b: "{{b64:fonts/LMGMaskJ-Bold.ttf}}" },
  "LMG Mask I": { r: "{{b64:fonts/LMGMaskI-Regular.ttf}}", b: "{{b64:fonts/LMGMaskI-Bold.ttf}}" },
  "LMG Mask RB": { r: "{{b64:fonts/LMGMaskRB-Regular.ttf}}", b: "{{b64:fonts/LMGMaskRB-Bold.ttf}}" },
  "LMG Mask NS": { r: "{{b64:fonts/LMGMaskNS-Regular.ttf}}", b: "{{b64:fonts/LMGMaskNS-Bold.ttf}}" },
  "LMG Mask AR": { r: "{{b64:fonts/LMGMaskAR-Regular.ttf}}", b: "{{b64:fonts/LMGMaskAR-Bold.ttf}}" },
  "LMG Mask IP": { r: "{{b64:fonts/LMGMaskIP-Regular.ttf}}", b: "{{b64:fonts/LMGMaskIP-Bold.ttf}}" },
  "LMG Mask IN": { r: "{{b64:fonts/LMGMaskIN-Regular.ttf}}", b: "{{b64:fonts/LMGMaskIN-Bold.ttf}}" },
  "LMG Mask MR": { r: "{{b64:fonts/LMGMaskMR-Regular.ttf}}", b: "{{b64:fonts/LMGMaskMR-Bold.ttf}}" },
  "LMG Mask WX": { r: "{{b64:fonts/LMGMaskWX-Regular.ttf}}", b: "{{b64:fonts/LMGMaskWX-Bold.ttf}}" },
  "LMG Mask UB": { r: "{{b64:fonts/LMGMaskUB-Regular.ttf}}", b: "{{b64:fonts/LMGMaskUB-Bold.ttf}}" },
  "LMG Mask FC": { r: "{{b64:fonts/LMGMaskFC-Regular.ttf}}", b: "{{b64:fonts/LMGMaskFC-Bold.ttf}}" },
  "LMG Mask PL": { r: "{{b64:fonts/LMGMaskPL-Regular.ttf}}", b: "{{b64:fonts/LMGMaskPL-Bold.ttf}}" }
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
  if (k === "U") return ufHas() ? "U" : "HS";
  // 3.0.63: SLsans → HohSans, SLsans Round → HohSans Round (проекты, сохранённые раньше)
  if (k === "SL") return "HS";
  if (k === "SR") return "HR";
  return MASK_FONTS.some((f) => f[0] === k) ? k : "HS";
};
function applyMaskFont() {
  const k = maskFontKey();
  // 3.0.53: свой шрифт; пока не загружен — встроенный SR
  const uf = k === "U" && typeof ufFontChain === "function" ? ufFontChain() : "";
  FONT = k === "U" ? uf + '"LMG Mask HS", "LMG Sans", ' + FONT_SYS : '"LMG Mask '.concat(k, '", "LMG Sans", ').concat(FONT_SYS);
  const sel = $("mFont"), fb = $("fbMFont");
  if (sel && sel.value !== k) sel.value = k;
  if (fb && fb.value !== k) fb.value = k;
  fpSync();
}
// 3.0.60: выбор шрифта — свой список, где каждое название написано этим шрифтом (у обычного <select> так нельзя)
const fpFam = (v) => v === "U" ? '"LMG UF A", "LMG UF B", "LMG Sans", sans-serif' : v === "__add" ? "" : '"LMG Mask '.concat(v, '", "LMG Sans", sans-serif');
let fpOpen = null;
function fpClose() {
  if (!fpOpen) return;
  fpOpen.pop.remove();
  document.removeEventListener("pointerdown", fpOpen.out, true);
  document.removeEventListener("keydown", fpOpen.key, true);
  fpOpen = null;
}
function fpSync() {
  for (const id of ["mFont", "fbMFont"]) {
    const sel = $(id), b = sel && sel.__fp;
    if (!b) continue;
    const o = sel.options[sel.selectedIndex], t = o ? o.textContent : "";
    if (b.__t !== t) {
      b.__t = t;
      b.firstChild.textContent = t;
    }
    const ff = fpFam(sel.value);
    if (b.firstChild.style.fontFamily !== ff) b.firstChild.style.fontFamily = ff;
    b.disabled = sel.disabled;
  }
}
function fpAttach(sel) {
  if (!sel || sel.__fp) return;
  const b = document.createElement("button");
  b.type = "button";
  b.className = sel.className + " fpick";
  b.title = sel.title || "Шрифт";
  b.setAttribute("aria-haspopup", "listbox");
  b.append(document.createElement("span"));
  sel.after(b);
  sel.hidden = true;
  sel.__fp = b;
  b.onclick = () => {
    if (fpOpen && fpOpen.sel === sel) return fpClose();
    fpClose();
    const pop = document.createElement("div");
    pop.className = "fpick-pop";
    pop.setAttribute("role", "listbox");
    for (const o of Array.from(sel.options)) {
      const it = document.createElement("div");
      it.className = "fpick-it" + (o.value === sel.value ? " on" : "") + (o.value === "__add" ? " add" : "");
      it.setAttribute("role", "option");
      it.textContent = o.textContent;
      const ff = fpFam(o.value);
      if (ff) it.style.fontFamily = ff;
      it.onclick = () => {
        fpClose();
        if (sel.value !== o.value || o.value === "__add") {
          sel.value = o.value;
          sel.dispatchEvent(new Event("change", { bubbles: true }));
        }
        fpSync();
      };
      pop.append(it);
    }
    document.body.append(pop);
    const r = b.getBoundingClientRect(), vh = window.innerHeight, below = vh - r.bottom - 8, above = r.top - 8;
    const h = Math.min(pop.scrollHeight, Math.max(below, above, 160));
    pop.style.left = Math.max(4, Math.min(window.innerWidth - Math.max(r.width, 240) - 4, r.left)) + "px";
    pop.style.minWidth = Math.max(r.width, 240) + "px";
    pop.style.maxHeight = h + "px";
    if (below >= Math.min(h, 260) || below >= above) pop.style.top = r.bottom + 4 + "px";
    else pop.style.top = Math.max(4, r.top - 4 - h) + "px";
    const on = pop.querySelector(".fpick-it.on");
    if (on) on.scrollIntoView({ block: "center" });
    const out = (e) => {
      if (!pop.contains(e.target) && e.target !== b && !b.contains(e.target)) fpClose();
    };
    const key = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        fpClose();
      }
    };
    document.addEventListener("pointerdown", out, true);
    document.addEventListener("keydown", key, true);
    fpOpen = { sel, pop, out, key };
  };
  fpSync();
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
  fpSync();
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
fpAttach($("mFont"));
fpAttach($("fbMFont"));
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
