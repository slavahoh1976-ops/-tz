// ===== 2.0.196: несколько слайсов сразу — выделение (вход, выход, список), групповые действия,
// перетаскивание в списке, переименование по шаблону, объединение и разбиение по кабинетам =====
// выбранные слайсы: главный (ui_out.sel) + дополнительные (ui_out.more) + их группы — с любого источника
function outSelIds(o) {
  const ids = new Set([ui_out.sel, ...ui_out.more || []].filter(Boolean)), gs = new Set();
  if (!o) return ids;
  for (const q of o.slices) if (ids.has(q.id) && q.grp) gs.add(q.grp);
  if (gs.size) for (const q of o.slices) if (q.grp && gs.has(q.grp)) ids.add(q.id);
  return ids;
}
const outSelList = (o) => {
  const ids = outSelIds(o);
  return o ? o.slices.filter((q) => ids.has(q.id)) : [];
};
function outSelSet(o, ids, primary) {
  const arr = [...ids];
  ui_out.sel = primary && arr.includes(primary) ? primary : arr[0] || "";
  ui_out.more = new Set(arr.filter((x) => x !== ui_out.sel));
  const s = curSlice();
  if (s) o.src = sliceSrc(o, s);
}
// короткое имя источника: «Маска: 1. screen 1» → «screen 1»
const outSrcShort = (name) => String(name || "").replace(/^(Маска|Общее поле|Нарезка):\s*/, "").replace(/^\d+\.\s*/, "");

// ---- кабинеты источника: центр, размер, угол, подпись — для имён по шаблону, объединения и разбиения
function outCabsK(key) {
  const out = [];
  for (const g of outGroups(key)) {
    const a = (+g.a || 0) * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    for (const q of g.cells) out.push({ cx: g.cx + q.dx * ca - q.dy * sa, cy: g.cy + q.dx * sa + q.dy * ca, w: q.w, h: q.h, a: +g.a || 0,
      name: q.name || g.name || "", label: String(q.name || g.name || "").split(" · ").pop(), col: q.col | 0, row: q.row | 0 });
  }
  return out;
}
// кабинеты, центр которых внутри участка слайса (с учётом угла участка); u, v — центр в системе слайса
function sliceCabs(sl, cabs) {
  const a = -(+sl.ra || 0) * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), cx = sl.ix + sl.iw / 2, cy = sl.iy + sl.ih / 2, E = 0.01;
  const r = [];
  for (const q of cabs) {
    const dx = q.cx - cx, dy = q.cy - cy, u = dx * ca - dy * sa, v = dx * sa + dy * ca;
    if (Math.abs(u) <= sl.iw / 2 + E && Math.abs(v) <= sl.ih / 2 + E) r.push({ ...q, u, v });
  }
  // по порядку чтения: сверху вниз, слева направо (в системе слайса)
  return r.sort((p, q) => Math.abs(p.v - q.v) > 0.5 ? p.v - q.v : p.u - q.u);
}

// ---- групповые действия
function outSelMoveTo(o, scrId) {
  const L = outSelList(o);
  for (const s of L) s.scr = scrId;
  o.scr = scrId;
  outChanged(true);
  status("Перенесено на " + ((o.screens.find((q) => q.id === scrId) || {}).name || "выход") + ": " + L.length, true);
}
// отправить слайсы на выход: на нём — на свободное место (остальные слайсы не трогаются);
// места нет — в левый верхний угол (проверка перед экспортом покажет наложение)
async function outSendTo(o, list, scrId) {
  const scr = o.screens.find((q) => q.id === scrId);
  if (!scr || !list.length) return;
  const ids = new Set(list.map((s) => s.id)), E = 0.5, rs = [], plan = [];
  for (const q of o.slices) {
    if (ids.has(q.id) || q.on === false || q.scr !== scrId) continue;
    const [w, h] = sliceOutWH(q);
    rs.push({ x0: q.ox, y0: q.oy, x1: q.ox + w, y1: q.oy + h });
  }
  // сначала считаем места, ничего не меняя
  let tight = 0;
  for (const s of o.slices.filter((q) => ids.has(q.id))) {
    const [w, h] = sliceOutWH(s);
    const X = [...new Set([0, ...rs.map((r) => r.x1)])].filter((v) => v + w <= scr.w + E).sort((a, b) => a - b);
    const Y = [...new Set([0, ...rs.map((r) => r.y1)])].filter((v) => v + h <= scr.h + E).sort((a, b) => a - b);
    let at = null;
    for (const y of Y) {
      for (const x of X) if (!rs.some((r) => x < r.x1 - E && x + w > r.x0 + E && y < r.y1 - E && y + h > r.y0 + E)) {
        at = [x, y];
        break;
      }
      if (at) break;
    }
    if (!at) {
      at = [0, 0];
      tight++;
    }
    plan.push([s, Math.round(at[0]), Math.round(at[1])]);
    rs.push({ x0: at[0], y0: at[1], x1: at[0] + w, y1: at[1] + h });
  }
  // места не хватило — спросить (с наложением или отмена)
  if (tight && await ask("На «" + scr.name + "» нет свободного места", (tight === list.length ? (list.length > 1 ? "Ни для одного из " + list.length + " слайсов" : "Для слайса «" + list[0].name + "»") : "Для " + tight + " из " + list.length + " слайсов") + " не нашлось места. Положить в левый верхний угол поверх других слайсов? (Можно выбрать «+ Новый выход».)", "", "Положить с наложением", false) === null) return;
  for (const [s, x, y] of plan) {
    s.scr = scrId;
    s.ox = x;
    s.oy = y;
  }
  o.scr = scrId;
  outChanged(true);
  status((list.length > 1 ? "Отправлено на " + scr.name + ": " + list.length : "«" + list[0].name + "» → " + scr.name) + (tight ? " · с наложением: " + tight : ""), true);
}
// пункты вложенного меню «Отправить на выход»: выходы (где уже все — с галочкой) и новый выход
function outSendMenu(o, list) {
  return [
    ...o.screens.map((sc) => {
      const here = list.every((s) => s.scr === sc.id);
      return { label: (here ? "✓ " : "") + sc.name + " · " + sc.w + "×" + sc.h, disabled: here, checked: here, fn: () => outSendTo(o, list, sc.id) };
    }),
    { sep: true },
    { label: "+ Новый выход", fn: () => {
      const b = o.screens.find((q) => q.id === list[0].scr) || o.screens[0], sc = { id: newUid(), name: "Output ".concat(o.screens.length + 1), w: b.w, h: b.h };
      o.screens.push(sc);
      outSendTo(o, list, sc.id);
    } }
  ];
}
function outSelDelete(o) {
  const ids = outSelIds(o), n = ids.size;
  if (!n) return;
  o.slices = o.slices.filter((q) => !ids.has(q.id));
  ui_out.sel = "";
  ui_out.more = new Set();
  outChanged(true);
  status(n > 1 ? "Удалено слайсов: " + n : "Слайс удалён", true);
}
function outSelOn(o, on) {
  for (const s of outSelList(o)) s.on = on;
  outChanged(true);
}

// ---- переименование по шаблону
const RENAME_TOKENS = "{маска} — маска (screen 1), {кабинет} — кабинеты слайса (1,9 или 1,9–4,9), {столбец} {ряд} — первого кабинета, {N} — номер по порядку, {выход} — выход, {слой} — слой Resolume, {имя} — текущее имя";
function sliceNameByTpl(o, sl, tpl, n, cabsOf) {
  const k = sliceSrc(o, sl), src = outSources().find((q) => q.k === k), cs = sliceCabs(sl, cabsOf(k)), f = cs[0], l = cs[cs.length - 1];
  const m = f && /^(\d+)\s*,\s*(\d+)$/.exec(f.label), scr = o.screens.find((q) => q.id === sl.scr), lay = outLayerNo(o, k);
  const map = {
    "маска": outSrcShort(src && src.name), "кабинет": !f ? "" : cs.length === 1 ? f.label : f.label + "–" + l.label,
    "столбец": f ? m ? m[1] : String(f.col + 1) : "", "ряд": f ? m ? m[2] : String(f.row + 1) : "",
    "n": String(n), "выход": scr ? scr.name : "", "слой": lay ? String(lay) : "", "имя": sl.name || ""
  };
  return tpl.replace(/\{([^}]+)\}/g, (all, t) => {
    const v = map[String(t).trim().toLowerCase()];
    return v == null ? all : v;
  }).replace(/\s+·\s+$/, "").trim() || sl.name;
}
async function outRenameTpl(o) {
  const sel = outSelList(o), list = sel.length > 1 ? sel : o.slices;
  if (!list.length) return status("Нет слайсов", true);
  let last = "{маска} · {кабинет}";
  try { last = localStorage.getItem("ledmask.sliceTpl") || last; } catch (e) {}
  const cache = new Map(), cabsOf = (k) => cache.has(k) ? cache.get(k) : (cache.set(k, outCabsK(k)), cache.get(k));
  const ex = sliceNameByTpl(o, list[0], last, 1, cabsOf);
  const tpl = await ask(sel.length > 1 ? "Переименовать выбранные (" + list.length + ")" : "Переименовать все слайсы (" + list.length + ")",
    "Шаблон имени. Подстановки:\n" + RENAME_TOKENS.split(", ").join("\n") + "\n\nСейчас для первого слайса: «" + ex + "»", last, "Переименовать");
  if (tpl == null || !String(tpl).trim()) return;
  try { localStorage.setItem("ledmask.sliceTpl", tpl); } catch (e) {}
  list.forEach((sl, i) => sl.name = sliceNameByTpl(o, sl, tpl, i + 1, cabsOf));
  outChanged(true);
  status("Переименовано слайсов: " + list.length + " · например «" + list[0].name + "»", true);
}

// ---- объединить: выбранные соседние слайсы одной маски → один слайс по их общему прямоугольнику
function outMerge(o) {
  const L = outSelList(o);
  if (L.length < 2) return status("Выделите два и больше слайсов (Ctrl / Cmd или Shift + щелчок)", true);
  const k = sliceSrc(o, L[0]);
  if (L.some((s) => sliceSrc(o, s) !== k)) return status("Объединить можно слайсы одной маски", true);
  if (L.some((s) => (+s.ra || 0) !== (+L[0].ra || 0) || (s.rot || 0) !== (L[0].rot || 0) || !!s.fh !== !!L[0].fh || !!s.fv !== !!L[0].fv))
    return status("Объединить можно слайсы с одинаковым углом, поворотом и отражением", true);
  if (+L[0].ra) return status("Слайсы под углом пока не объединяются — только прямые", true);
  const x0 = Math.min(...L.map((s) => s.ix)), y0 = Math.min(...L.map((s) => s.iy));
  const x1 = Math.max(...L.map((s) => s.ix + s.iw)), y1 = Math.max(...L.map((s) => s.iy + s.ih));
  // общий прямоугольник должен быть закрыт слайсами без дыр (иначе в слайс попадёт чужое или пустота)
  const area = L.reduce((t, s) => t + s.iw * s.ih, 0), box = (x1 - x0) * (y1 - y0);
  if (area < box - 1) return status("Слайсы не складываются в прямоугольник без дыр — выделите соседние слайсы ровным блоком", true);
  if (area > box + 1) return status("Слайсы накладываются друг на друга на входе — объединение отменено", true);
  const P = L.find((s) => s.id === ui_out.sel) || L[0], scr = P.scr;
  // на выходе: левый верхний угол блока; 1:1 (без масштаба)
  const same = L.filter((s) => s.scr === scr), m = { ...P, id: newUid(), ix: x0, iy: y0, iw: x1 - x0, ih: y1 - y0, ow: 0, oh: 0, grp: "",
    ox: Math.min(...same.map((s) => s.ox)), oy: Math.min(...same.map((s) => s.oy)), name: L[0].name + " … " + L[L.length - 1].name };
  const cabs = sliceCabs(m, outCabsK(k)), src = outSources().find((q) => q.k === k);
  if (cabs.length) m.name = outSrcShort(src && src.name) + " · " + (cabs.length === 1 ? cabs[0].label : cabs[0].label + "–" + cabs[cabs.length - 1].label);
  const ids = new Set(L.map((s) => s.id)), at = Math.min(...L.map((s) => o.slices.indexOf(s)));
  o.slices = o.slices.filter((q) => !ids.has(q.id));
  o.slices.splice(at, 0, m);
  ui_out.sel = m.id;
  ui_out.more = new Set();
  outChanged(true);
  status("Объединено " + L.length + " → «" + m.name + "» " + m.iw + "×" + m.ih, true);
}
// ---- разбить: слайс → по слайсу на каждый кабинет в его зоне; на выходе кабинеты остаются там же
function outSplit(o) {
  const L = outSelList(o);
  if (!L.length) return status("Выберите слайс", true);
  const cache = new Map(), added = [];
  let skipped = 0;
  for (const sl of L) {
    const k = sliceSrc(o, sl);
    if (!cache.has(k)) cache.set(k, outCabsK(k));
    const cs = sliceCabs(sl, cache.get(k));
    if (cs.length < 2) {
      skipped++;
      continue;
    }
    // перенос точки участка (u, v от центра) на выход — как в paintSlice: масштаб, отражение, поворот
    const [ow, oh] = sliceOutWH(sl), r90 = sl.rot === 90 || sl.rot === 270, dw = r90 ? oh : ow, dh = r90 ? ow : oh;
    const kx = dw / sl.iw, ky = dh / sl.ih, ro = (sl.rot || 0) * Math.PI / 180, cr = Math.cos(ro), sr = Math.sin(ro);
    const ocx = sl.ox + ow / 2, ocy = sl.oy + oh / 2, parts = [];
    for (const q of cs) {
      let px = q.u * kx * (sl.fh ? -1 : 1), py = q.v * ky * (sl.fv ? -1 : 1);
      const X = ocx + px * cr - py * sr, Y = ocy + px * sr + py * cr;
      // размер кабинета в системе слайса (кабинет повёрнут относительно участка — берём габарит)
      const da = ((q.a - (+sl.ra || 0)) % 360 + 360) % 360, rr = da * Math.PI / 180;
      const qw = Math.abs(q.w * Math.cos(rr)) + Math.abs(q.h * Math.sin(rr)), qh = Math.abs(q.w * Math.sin(rr)) + Math.abs(q.h * Math.cos(rr));
      const cw = qw * kx, ch = qh * ky, sw = r90 ? ch : cw, shh = r90 ? cw : ch;
      const scaled = sliceScaled(sl);
      parts.push({ ...sl, id: newUid(), grp: "", name: q.name || sl.name + " · " + q.label,
        ix: Math.round(q.cx - qw / 2), iy: Math.round(q.cy - qh / 2), iw: Math.max(1, Math.round(qw)), ih: Math.max(1, Math.round(qh)),
        ow: scaled ? Math.max(1, Math.round(sw)) : 0, oh: scaled ? Math.max(1, Math.round(shh)) : 0,
        ox: Math.round(X - sw / 2), oy: Math.round(Y - shh / 2) });
    }
    const at = o.slices.indexOf(sl);
    o.slices.splice(at, 1, ...parts);
    added.push(...parts);
  }
  if (!added.length) return status(skipped ? "В слайсе один кабинет — разбивать нечего" : "Нечего разбивать", true);
  outSelSet(o, added.map((s) => s.id), added[0].id);
  outChanged(true);
  status("Разбито по кабинетам: " + added.length + " слайсов" + (skipped ? " (без изменений: " + skipped + ")" : ""), true);
}

// ---- несколько выбранных: строка «Выбрано: N» в настройках слайса; «Выход», «Объединить», «Разбить», «Удалить» — для всех
function syncSlMulti(o) {
  const bar = $("oSlMultiInfo");
  if (!bar) return;
  const n = o ? outSelIds(o).size : 0;
  bar.hidden = n < 2;
  const pk = $("oPack");
  pk.textContent = n > 1 ? "Разложить выбранные (" + n + ")" : "Разложить по выходам";
  pk.title = n > 1 ? "Только выбранные слайсы — на свободные места выходов; остальные остаются, где стоят" : "Разложить все слайсы по выходам слева направо и сверху вниз; не помещается — следующий выход";
  if (n > 1) $("oSlMultiN").textContent = "Выбрано слайсов: " + n + " — «Выход», «Объединить», «Разбить», «Удалить» и «Разложить выбранные» действуют на все";
}
$("oSlMultiNone").onclick = () => {
  ui_out.more = new Set();
  refreshOutPanel();
  requestDraw();
};
$("oSlMerge").onclick = () => {
  const o = OC();
  if (o) outMerge(o);
};
$("oSlRename").onclick = () => {
  const o = OC();
  if (o) outRenameTpl(o);
};
$("oSlSplit").onclick = () => {
  const o = OC();
  if (o) outSplit(o);
};

// ---- перетаскивание в списке: на другой выход или выше / ниже (выше в списке — рисуется поверх, как в Resolume)
const slDnD = { ids: null };
function slDragStart(e, o, s) {
  const ids = outSelIds(o);
  if (!ids.has(s.id)) {
    ui_out.sel = s.id;
    ui_out.more = new Set();
  }
  slDnD.ids = outSelIds(o);
  try {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", s.name || "slice");
  } catch (x) {}
  // список перерисуем после начала перетаскивания (иначе браузер отменит его)
  setTimeout(() => $("oSliceList").classList.add("dragging"), 0);
}
function slDropClear() {
  for (const el of document.querySelectorAll(".drop-above,.drop-below,.drop-in")) el.classList.remove("drop-above", "drop-below", "drop-in");
}
function slDragOver(e, el, kind) {
  if (!slDnD.ids) return;
  e.preventDefault();
  try { e.dataTransfer.dropEffect = "move"; } catch (x) {}
  slDropClear();
  if (kind === "grp") el.classList.add("drop-in");
  else {
    const r = el.getBoundingClientRect();
    el.classList.add(e.clientY < r.top + r.height / 2 ? "drop-above" : "drop-below");
  }
}
function slDrop(e, o, target, scrId, el) {
  e.preventDefault();
  const ids = slDnD.ids;
  slDnD.ids = null;
  const above = el.classList.contains("drop-above");
  slDropClear();
  $("oSliceList").classList.remove("dragging");
  if (!ids || !ids.size || target && ids.has(target.id)) return;
  const moving = o.slices.filter((q) => ids.has(q.id)), rest = o.slices.filter((q) => !ids.has(q.id));
  const scr = target ? target.scr : scrId;
  for (const q of moving) q.scr = scr;
  let at;
  if (target) {
    // список показан снизу вверх: «выше строки» = после неё в порядке отрисовки (поверх)
    const i = rest.indexOf(target);
    at = above ? i + 1 : i;
  } else {
    // на заголовок выхода — наверх этого выхода (поверх остальных его слайсов)
    let last = -1;
    rest.forEach((q, i) => { if (q.scr === scr) last = i; });
    at = last >= 0 ? last + 1 : rest.length;
  }
  rest.splice(at, 0, ...moving);
  o.slices = rest;
  o.scr = scr;
  outChanged(true);
  status("Перемещено слайсов: " + moving.length, true);
}
document.addEventListener("dragend", () => {
  slDnD.ids = null;
  slDropClear();
  const ll = $("oSliceList");
  if (ll) ll.classList.remove("dragging");
});

// ---- тестовые картинки: шаблон для композиции (по слоям) + эталон каждого выхода
const TEST_HUES = [200, 25, 145, 50, 280, 330, 175, 95];
function testSrcCanvas(key, li) {
  const S0 = outSources().find((s) => s.k === key);
  if (!S0) return null;
  const s = Math.min(1, 8192 / Math.max(S0.w, S0.h)), cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(S0.w * s));
  cv.height = Math.max(1, Math.round(S0.h * s));
  const c = cv.getContext("2d"), hue = TEST_HUES[li % TEST_HUES.length];
  c.fillStyle = "#000";
  c.fillRect(0, 0, cv.width, cv.height);
  c.scale(s, s);
  for (const q of outCabsK(key)) {
    c.save();
    c.translate(q.cx, q.cy);
    c.rotate(q.a * Math.PI / 180);
    const w = q.w, h = q.h, m = Math.min(w, h), odd = (q.col + q.row) % 2;
    c.fillStyle = "hsl(" + hue + ",70%," + (odd ? 30 : 40) + "%)";
    c.fillRect(-w / 2, -h / 2, w, h);
    // рамка кабинета — видно стыки и сдвиги
    c.strokeStyle = "#fff";
    c.lineWidth = Math.max(1, m * 0.02);
    c.strokeRect(-w / 2 + c.lineWidth / 2, -h / 2 + c.lineWidth / 2, w - c.lineWidth, h - c.lineWidth);
    // диагонали — видно, что кабинет целый и не растянут
    c.strokeStyle = "rgba(255,255,255,0.35)";
    c.lineWidth = Math.max(1, m * 0.008);
    c.beginPath();
    c.moveTo(-w / 2, -h / 2); c.lineTo(w / 2, h / 2); c.moveTo(w / 2, -h / 2); c.lineTo(-w / 2, h / 2);
    c.stroke();
    // красный уголок — левый верхний угол кабинета: видно отражение
    c.fillStyle = "#ff2a2a";
    const t = m * 0.22;
    c.beginPath();
    c.moveTo(-w / 2, -h / 2); c.lineTo(-w / 2 + t, -h / 2); c.lineTo(-w / 2, -h / 2 + t);
    c.closePath();
    c.fill();
    // стрелка вверх — видно поворот
    c.fillStyle = "#ffe14a";
    const ah = m * 0.18, ay = -h / 2 + m * 0.1;
    c.beginPath();
    c.moveTo(0, ay); c.lineTo(ah * 0.6, ay + ah); c.lineTo(-ah * 0.6, ay + ah);
    c.closePath();
    c.fill();
    // номер кабинета
    c.fillStyle = "#fff";
    c.textAlign = "center";
    c.textBaseline = "middle";
    const fs = Math.max(6, Math.min(m * 0.26, w * 0.9 / Math.max(3, q.label.length) * 1.7));
    c.font = "700 " + fs + "px " + FONT;
    c.fillText(q.label, 0, m * 0.06);
    c.restore();
  }
  return { cv, s, w: S0.w, h: S0.h };
}
async function outTestPack(o) {
  const keys = outAutoKeys(o);
  if (!keys.length) return status("Нет масок для мэппинга", true);
  const tests = new Map(keys.map((k, i) => [k, testSrcCanvas(k, i)])), srcOf = (k) => tests.get(k) || (tests.set(k, testSrcCanvas(k, tests.size)), tests.get(k));
  const files = [], byLayer = outRoute(o) === "layers", CM0 = outComp(o, keys[0]);
  const name = (t) => safeName(t, "test").slice(0, 160) + ".png";
  const paintComp = (ctx, ks) => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, CM0.W, CM0.H);
    // слой 1 — внизу
    for (const k of ks) {
      const T = srcOf(k), CM = outComp(o, k);
      if (!T || !CM) continue;
      ctx.save();
      ctx.translate(CM.x, CM.y);
      ctx.scale(CM.sx / T.s, CM.sy / T.s);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(T.cv, 0, 0);
      ctx.restore();
    }
  };
  const all = o.screens.length + (byLayer ? keys.length : 1);
  let n = 0;
  const step = async (t) => {
    busy(t + " (" + ++n + " из " + all + ")…");
    await tick();
  };
  if (byLayer) for (const k of keys) {
    const src = outSources().find((q) => q.k === k), li = keys.indexOf(k) + 1;
    await step("Тест для слоя " + li);
    const r = await renderBands(CM0.W, CM0.H, (ctx) => paintComp(ctx, [k]));
    files.push({ name: "1 Композиция — Слой " + li + " — " + name(outSrcShort(src && src.name)), data: r.png });
  }
  else {
    await step("Тест композиции");
    const r = await renderBands(CM0.W, CM0.H, (ctx) => paintComp(ctx, keys));
    files.push({ name: "1 Композиция — " + name(o.name || "все маски"), data: r.png });
  }
  for (const scr of o.screens) {
    await step("Эталон " + scr.name);
    const r = await renderBands(scr.w, scr.h, (ctx) => paintOutScreen(ctx, o, scr, 1, srcOf, false));
    files.push({ name: "2 Эталон — " + name(scr.name + " " + scr.w + "x" + scr.h), data: r.png });
  }
  const txt = [
    "Тест мэппинга «" + (o.name || "") + "» — LED Pixel Mask Generator " + APP_VERSION, "",
    "1. Картинки «1 Композиция…» — это контент для Resolume, размер композиции " + CM0.W + "×" + CM0.H + ".",
    byLayer ? "   Каждую положите на свой слой: «Слой 1» — на Layer 1, «Слой 2» — на Layer 2 и т.д." : "   Положите картинку на любой слой — слайсы берут всю композицию.",
    "2. Загрузите пресет Advanced Output из программы.",
    "3. Сравните экран (или выход медиасервера) с картинками «2 Эталон…» — должно совпасть один в один.", "",
    "Что видно на кабинете:",
    " • номер — какой кабинет где стоит;",
    " • жёлтая стрелка — верх кабинета: если смотрит не вверх — слайс повёрнут;",
    " • красный уголок — левый верхний угол: если он справа или снизу — слайс отражён;",
    " • белая рамка и диагонали — кабинет целый, не обрезан и не растянут;",
    " • шахматка светлее / темнее — соседние кабинеты не перепутаны.", ""
  ].join("\r\n");
  files.push({ name: "Как проверить.txt", data: new TextEncoder().encode(txt) });
  busy("Упаковка…");
  await tick();
  const z = await zip(files);
  busy("");
  await save(safeName(o.name, "mapping") + " — тест.zip", z);
}
$("oTestPack").onclick = async () => {
  const o = OC();
  if (!o || !outSrc(o)) return status("Сначала выберите источник", true);
  if (!o.slices.length) return status("Нет слайсов — разметьте источник", true);
  try {
    await outTestPack(o);
  } catch (e) {
    busy("");
    status("Ошибка: " + e.message, true);
  }
};
