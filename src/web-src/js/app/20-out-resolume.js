// ===== 2.0.182: экспорт мэппинга в Resolume Arena — пресет Advanced Output (.xml) =====
// Формат официально не описан. Элементы и атрибуты — только те, что пишет сама Arena 7.x: сверено с 30 настоящими
// пресетами Arena 7.13–7.26 (у всех корень XmlState, размер композиции — CurrentCompositionTextureSize). Совместимость с 7.0+.
// Выход = Screen (виртуальное устройство с разрешением выхода), слайс = Slice: InputRect — участок композиции,
// OutputRect — место на выходе; поворот — атрибут orientation (радианы) и повёрнутые углы.
function resXmlEsc(t) {
  return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function resNum(v) {
  const r = Math.abs(v) < 1e-9 ? 0 : v;
  return Number.isInteger(r) ? String(r) : String(+r.toFixed(6));
}
// 4 угла прямоугольника w×h с центром (cx, cy), повёрнутого на deg по часовой: левый верхний, правый верхний, правый нижний, левый нижний
function resQuad(cx, cy, w, h, deg) {
  const a = deg * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
  return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([x, y]) => ({ x: cx + x * ca - y * sa, y: cy + x * sa + y * ca }));
}
// idHash устройства = String::hashCode64 из JUCE (h = h * 101 + код символа, 64 бита без знака) от deviceId —
// сверено с 35 настоящими файлами Arena 7.13–7.26. Считаем частями по 16 бит: без BigInt (старый WebKit на Mac).
function resHash64(str) {
  const h = [0, 0, 0, 0]; // младшие 16 бит первыми
  for (const ch of String(str)) {
    let cp = ch.codePointAt(0);
    // JUCE считает по символам UTF-32; суррогатные пары собираются в один символ
    let carry = cp;
    for (let i = 0; i < 4; i++) {
      const v = h[i] * 101 + carry;
      h[i] = v % 65536;
      carry = Math.floor(v / 65536);
    }
  }
  // в десятичную строку: делим 64-битное число на 10, пока не станет нулём
  const d = h.slice(), out = [];
  while (d.some((x) => x)) {
    let rem = 0;
    for (let i = 3; i >= 0; i--) {
      const v = rem * 65536 + d[i];
      d[i] = Math.floor(v / 10);
      rem = v % 10;
    }
    out.push(rem);
  }
  return out.length ? out.reverse().join("") : "0";
}
function resVerts(pts, ind) {
  return pts.map((p) => ind + '<v x="' + resNum(p.x) + '" y="' + resNum(p.y) + '"/>').join("\n");
}
// код источника «слой» в Input Source слайса Resolume 7: «3:N» — слой N (слой 1 — нижний). Взято из настоящих пресетов
// (слайс «Camera» = 3:24) и проекта phosphor; в Arena 5/6 «3:N» были экраны. Проверочный пресет: outResolumeLayerTest().
const RES_LAYER_CODE = 3;
// куда смотрят слайсы в Resolume: "layers" — слой своей маски (по умолчанию), "comp" — вся композиция
const outRoute = (o) => o.resRoute === "comp" ? "comp" : "layers";
function outResolumeXml(o) {
  const S0 = outSrc(o);
  if (!S0) return null;
  // 2.0.185: выгружаются слайсы всех отмеченных масок (или активного источника, если не отмечено ничего).
  // «Слои»: слайс берёт в Resolume слой своей маски (первая отмеченная — Слой 1); «Композиция» — всю композицию.
  const keys = outAutoKeys(o), all = o.slices.filter((sl) => keys.includes(sliceSrc(o, sl))), other = o.slices.length - all.length;
  const CM = outComp(o, keys[0]), byLayer = outRoute(o) === "layers";
  let id = Date.now();
  const T = (k) => "\t".repeat(k);
  const screens = o.screens.map((scr) => {
    const list = all.filter((sl) => sl.scr === scr.id), sid = id++;
    const slices = list.map((sl) => {
      const [ow, oh] = sliceOutWH(sl), r90 = sl.rot === 90 || sl.rot === 270;
      // участок на композиции: углы участка на маске переносятся на композицию (сдвиг и масштаб своей маски)
      const sk = sliceSrc(o, sl), CMs = outComp(o, sk) || CM;
      const inQ = resQuad(sl.ix + sl.iw / 2, sl.iy + sl.ih / 2, sl.iw, sl.ih, +sl.ra || 0).map((q) => compPt(CMs, q.x, q.y));
      const inSrc = byLayer ? RES_LAYER_CODE + ":" + Math.max(1, keys.indexOf(sk) + 1) : "0:1";
      const inA = Math.atan2(inQ[1].y - inQ[0].y, inQ[1].x - inQ[0].x) * 180 / Math.PI;
      // на выходе: контент (до поворота) — ширина и высота до перестановки; поворачиваем вокруг центра места на выходе
      const cw = r90 ? oh : ow, ch = r90 ? ow : oh, outQ = resQuad(sl.ox + ow / 2, sl.oy + oh / 2, cw, ch, +sl.rot || 0);
      // 2.0.182: деформация — в координатах выхода, как в настоящих файлах Arena: Homography src = dst = углы OutputRect,
      // сетка Bezier 4×4 — равномерно внутри этих углов (раньше была от 0,0 — Arena рисовала все слайсы в углу выхода)
      const own = outQ;
      const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      const bez = [];
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
        const top = lerp(outQ[0], outQ[1], c / 3), bot = lerp(outQ[3], outQ[2], c / 3);
        bez.push(lerp(top, bot, r / 3));
      }
      const flip = (sl.fh ? 1 : 0) | (sl.fv ? 2 : 0), nm = resXmlEsc(sl.name || "Slice");
      const rad = (d) => resNum(d * Math.PI / 180);
      return [
        T(4) + '<Slice uniqueId="' + id++ + '">',
        T(5) + '<Params name="Common">',
        T(6) + '<Param name="Name" T="STRING" default="Layer" value="' + nm + '"/>',
        T(6) + '<Param name="Enabled" T="BOOL" default="1" value="' + (sl.on === false ? 0 : 1) + '"/>',
        T(5) + "</Params>",
        T(5) + '<Params name="Input">',
        T(6) + '<ParamChoice name="Input Source" default="0:1" value="' + inSrc + '" storeChoices="0"/>',
        T(5) + "</Params>",
        T(5) + '<Params name="Output">',
        T(6) + '<Param name="Flip" T="UINT8" default="0" value="' + flip + '"/>',
        T(5) + "</Params>",
        T(5) + '<InputRect orientation="' + rad(Math.abs(inA) < 1e-9 ? 0 : inA) + '">',
        resVerts(inQ, T(6)),
        T(5) + "</InputRect>",
        T(5) + '<OutputRect orientation="' + rad(+sl.rot || 0) + '">',
        resVerts(outQ, T(6)),
        T(5) + "</OutputRect>",
        T(5) + "<Warper>",
        T(6) + '<Params name="Warper">',
        T(7) + '<ParamChoice name="Point Mode" default="PM_LINEAR" value="PM_LINEAR" storeChoices="0"/>',
        T(7) + '<Param name="Flip" T="UINT8" default="0" value="0"/>',
        T(6) + "</Params>",
        T(6) + '<BezierWarper controlWidth="4" controlHeight="4">',
        T(7) + "<vertices>",
        resVerts(bez, T(8)),
        T(7) + "</vertices>",
        T(6) + "</BezierWarper>",
        T(6) + "<Homography>",
        T(7) + "<src>",
        resVerts(own, T(8)),
        T(7) + "</src>",
        T(7) + "<dst>",
        resVerts(own, T(8)),
        T(7) + "</dst>",
        T(6) + "</Homography>",
        T(5) + "</Warper>",
        T(4) + "</Slice>"
      ].join("\n");
    });
    const sn = resXmlEsc(scr.name || "Screen");
    return [
      T(3) + '<Screen name="' + sn + '" uniqueId="' + sid + '">',
      T(4) + '<Params name="Params">',
      T(5) + '<Param name="Name" T="STRING" default="" value="' + sn + '"/>',
      T(5) + '<Param name="Enabled" T="BOOL" default="1" value="1"/>',
      T(5) + '<Param name="Hidden" T="BOOL" default="0" value="0"/>',
      T(4) + "</Params>",
      T(4) + "<guides>",
      T(5) + '<ScreenGuide name="ScreenGuide" type="0"/>',
      T(5) + '<ScreenGuide name="ScreenGuide" type="1"/>',
      T(4) + "</guides>",
      T(4) + "<layers>",
      ...slices,
      T(4) + "</layers>",
      T(4) + "<OutputDevice>",
      // как пишет сама Arena 7.13–7.26: idHash и параметры Width / Height (без них Arena ставит выход 800×600)
      T(5) + '<OutputDeviceVirtual name="' + sn + '" deviceId="Virtual' + sn + '" idHash="' + resHash64("Virtual" + (scr.name || "Screen")) + '" width="' + scr.w + '" height="' + scr.h + '">',
      T(6) + '<Params name="Params">',
      ...[["Width", 800, scr.w], ["Height", 600, scr.h]].flatMap(([pn, def, val]) => [
        T(7) + '<ParamRange name="' + pn + '" T="DOUBLE" default="' + def + '" value="' + val + '">',
        T(8) + '<PhaseSourceStatic name="PhaseSourceStatic" phase="0"/>', // phase есть в 7.13–7.22.0, новые версии его читают
        T(8) + '<BehaviourDouble name="BehaviourDouble"/>',
        T(8) + '<ValueRange name="defaultRange" min="1" max="16384"/>',
        T(8) + '<ValueRange name="minMax" min="1" max="16384"/>',
        T(8) + '<ValueRange name="startStop" min="1" max="16384"/>',
        T(7) + "</ParamRange>"
      ]),
      T(6) + "</Params>",
      T(5) + "</OutputDeviceVirtual>",
      T(4) + "</OutputDevice>",
      T(3) + "</Screen>"
    ].join("\n");
  });
  const name = resXmlEsc(o.name || "LED Mask");
  const xml = ['<?xml version="1.0" encoding="utf-8"?>',
    '<XmlState name="' + name + '">',
    // версия 7.13.2: файл повторяет настоящие пресеты 7.13.2 — их открывают 7.13 и все более новые 7.x
    '\t<versionInfo name="Resolume Arena" majorVersion="7" minorVersion="13" microVersion="2" revision="17774"/>',
    '\t<ScreenSetup name="ScreenSetup">',
    '\t\t<Params name="ScreenSetupParams"/>',
    '\t\t<CurrentCompositionTextureSize width="' + CM.W + '" height="' + CM.H + '"/>',
    "\t\t<screens>",
    ...screens,
    "\t\t</screens>",
    "\t</ScreenSetup>",
    "</XmlState>", ""].join("\n");
  return { xml, slices: all.length, screens: o.screens.length, other, W: CM.W, H: CM.H, layers: byLayer ? keys.length : 0 };
}
