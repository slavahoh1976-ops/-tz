// 3.0.39: встроенный шрифт LMG Sans (урезанная и переименованная копия Liberation Sans 2.1.5, SIL OFL 1.1 —
// размеры букв как у Arial). Им набираются текст ТЗ, подписи над масками и заметки — на экране и в PDF одинаково,
// а в PDF текст идёт в кривых (контуры букв из этого шрифта), поэтому увеличивается без потери качества.
const SANS_FAMILY = "LMG Sans";
const SANS_B64 = { r: "{{b64:fonts/LMGSans-Regular.ttf}}", b: "{{b64:fonts/LMGSans-Bold.ttf}}", i: "{{b64:fonts/LMGSans-Italic.ttf}}", bi: "{{b64:fonts/LMGSans-BoldItalic.ttf}}" };
let SANS_FACES = [];
const SANS_READY = (async () => {
  const faces = [];
  for (const k of ["r", "b", "i", "bi"]) {
    try {
      const bytes = ufUnB64(SANS_B64[k]), f = Object.assign({ bytes, file: "LMGSans-" + k }, ufParse(bytes));
      f.weight = k.indexOf("b") === 0 ? 700 : 400;
      f.italic = k.indexOf("i") >= 0;
      faces.push(f);
      const ff = new FontFace(SANS_FAMILY, bytes, { weight: f.weight === 700 ? "700" : "400", style: f.italic ? "italic" : "normal" });
      await ff.load();
      document.fonts.add(ff);
    } catch (e) {
      console.warn("LMG Sans", k, e);
    }
  }
  SANS_FACES = faces;
  if (typeof requestDraw === "function") requestDraw();
})();
function sansPick(bold, ital) {
  if (!SANS_FACES.length) return null;
  const sc = (f) => ((f.weight >= 600) === bold ? 2 : 0) + (f.italic === ital ? 1 : 0);
  let best = SANS_FACES[0];
  for (const f of SANS_FACES) if (sc(f) > sc(best)) best = f;
  return { face: best, fakeBold: bold && best.weight < 600, fakeItal: ital && !best.italic };
}
