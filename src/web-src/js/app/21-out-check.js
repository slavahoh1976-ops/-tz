// ---- 2.0.194: проверка мэппинга — слайсы за краем выхода, наложения на выходе, участки за краем композиции
function outIssues(o) {
  const res = { edge: [], over: [], comp: [], n: 0 };
  if (!o || !o.slices.length) return res;
  const scrs = new Map(o.screens.map((q) => [q.id, q])), E = 0.5;
  const R = o.slices.filter((sl) => sl.on !== false).map((sl) => {
    const [w, h] = sliceOutWH(sl);
    return { sl, x0: sl.ox, y0: sl.oy, x1: sl.ox + w, y1: sl.oy + h };
  });
  for (const r of R) {
    const q = scrs.get(r.sl.scr);
    if (q && (r.x0 < -E || r.y0 < -E || r.x1 > q.w + E || r.y1 > q.h + E)) res.edge.push(r.sl);
  }
  // наложения: по каждому выходу — проход слева направо (тысячи слайсов без перебора всех пар)
  const seen = new Set(), byScr = new Map();
  for (const r of R) {
    if (!byScr.has(r.sl.scr)) byScr.set(r.sl.scr, []);
    byScr.get(r.sl.scr).push(r);
  }
  for (const arr of byScr.values()) {
    arr.sort((a, b) => a.x0 - b.x0);
    let act = [];
    for (const b of arr) {
      act = act.filter((a) => a.x1 - b.x0 > E);
      for (const a of act) if (Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > E && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > E) {
        for (const x of [a.sl, b.sl]) if (!seen.has(x.id)) seen.add(x.id), res.over.push(x);
      }
      act.push(b);
    }
  }
  const order = new Map(o.slices.map((sl, i) => [sl.id, i]));
  res.over.sort((a, b) => order.get(a.id) - order.get(b.id));
  const keys = outAutoKeys(o), CMs = new Map(), srcKeys = new Set(outSources().map((x) => x.k));
  for (const r of R) {
    const sk = r.sl.src && srcKeys.has(r.sl.src) ? r.sl.src : o.src;
    if (!keys.includes(sk)) continue;
    if (!CMs.has(sk)) CMs.set(sk, outComp(o, sk));
    const CM = CMs.get(sk);
    if (!CM) continue;
    const sl = r.sl, Q = resQuad(sl.ix + sl.iw / 2, sl.iy + sl.ih / 2, sl.iw, sl.ih, +sl.ra || 0).map((p) => compPt(CM, p.x, p.y));
    if (Q.some((p) => p.x < -E || p.y < -E || p.x > CM.W + E || p.y > CM.H + E)) res.comp.push(sl);
  }
  res.n = res.edge.length + res.over.length + res.comp.length;
  return res;
}
function outIssueLines(I) {
  const nm = (a) => a.slice(0, 3).map((sl) => "«" + (sl.name || "Slice") + "»").join(", ") + (a.length > 3 ? " и ещё " + (a.length - 3) : "");
  const L = [];
  if (I.edge.length) L.push("За краем выхода: " + nm(I.edge));
  if (I.over.length) L.push("Накладываются на выходе: " + nm(I.over));
  if (I.comp.length) L.push("Участок за краем композиции (в Resolume будет пустота): " + nm(I.comp));
  return L;
}
function syncOutIssues() {
  const el = $("oIssues");
  if (!el) return;
  const o = OC(), I = ui.page === "out" && o ? outIssues(o) : { n: 0 };
  el.hidden = !I.n;
  if (!I.n) return;
  el.textContent = "";
  for (const t of ["⚠ Проверьте мэппинг перед экспортом:", ...outIssueLines(I)]) {
    const d = document.createElement("div");
    d.textContent = t;
    el.appendChild(d);
  }
  const b = document.createElement("button");
  b.className = "b";
  b.textContent = "Показать";
  b.title = "Выбрать первый проблемный слайс";
  b.onclick = () => {
    const sl = I.edge[0] || I.over[0] || I.comp[0];
    if (!sl) return;
    o.scr = sl.scr;
    ui_out.sel = sl.id;
    outChanged(true);
  };
  el.appendChild(b);
}
let outIssuesTimer = 0;
const scheduleOutIssues = () => {
  clearTimeout(outIssuesTimer);
  outIssuesTimer = setTimeout(syncOutIssues, 200);
};
// перед сохранением: есть проблемы — спросить; true — сохранять
async function outExportCheck(o) {
  const I = outIssues(o);
  if (!I.n) return true;
  return await ask("Проверка перед экспортом", outIssueLines(I).join("\n") + "\n\nВсё равно сохранить?", "", "Сохранить", false) !== null;
}
$("oResolume").onclick = async () => {
  const o = OC();
  if (!o || !outSrc(o)) return status("Сначала выберите источник", true);
  const r = outResolumeXml(o);
  if (!r.slices) return status("Нет слайсов для выгрузки — разметьте источник", true);
  if (!await outExportCheck(o)) return;
  const ok = await save(safeFile(o.name, "Advanced Output") + ".xml", new Blob([r.xml], { type: "application/xml" }));
  if (ok !== false) status("Resolume: ".concat(r.screens, " ").concat(r.screens === 1 ? "выход" : r.screens < 5 ? "выхода" : "выходов", ", слайсов ").concat(r.slices).concat(r.layers ? ", слоёв " + r.layers + " (маска 1 — Слой 1)" : "", ". Размер композиции в Arena — ").concat(r.W, "×").concat(r.H).concat(r.other ? ". Не выгружены слайсы неотмеченных источников: " + r.other : "", "."), true);
};
$("oPNG").onclick = async () => {
  const o = OC();
  if (!o || !outSrc(o)) return status("Сначала выберите источник", true);
  if (!await outExportCheck(o)) return;
  try {
    const scr = outScr(o), r = await saveOutPNG(o, scr);
    busy("");
    await save(outFileName(o, scr), new Blob([r.png], { type: "image/png" }));
  } catch (e) {
    busy("");
    status("Ошибка рендера: " + e.message, true);
  }
};
$("oPNGAll").onclick = async () => {
  const o = OC();
  if (!o || !outSrc(o)) return status("Сначала выберите источник", true);
  if (!await outExportCheck(o)) return;
  try {
    const files = [];
    for (const scr of o.screens) {
      const r = await saveOutPNG(o, scr);
      files.push({ name: outFileName(o, scr), data: r.png });
    }
    busy("Упаковка…");
    await tick();
    const z = await zip(files);
    busy("");
    await save(safeFile(o.name, "outputs") + ".zip", z);
  } catch (e) {
    busy("");
    status("Ошибка: " + e.message, true);
  }
};
