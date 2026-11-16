function copyCut() {
  const src = CC();
  if (!src) return;
  const c = JSON.parse(JSON.stringify(src)), base = String(src.name || "Нарезка").replace(/ \(копия( \d+)?\)$/, ""), names = new Set(project.cuts.map((q) => q.name));
  let n = 1, nm = base + " (копия)";
  while (names.has(nm)) nm = base + " (копия " + ++n + ")";
  c.id = newUid();
  c.name = nm;
  project.cuts.splice(project.cutCur + 1, 0, c);
  project.cutCur++;
  cutChanged(true);
  status("Копия нарезки: " + nm, true);
}
stripDrag($("cStrip"), (from, to) => {
  const cur = project.cuts[project.cutCur];
  moveIn(project.cuts, from, to);
  project.cutCur = project.cuts.indexOf(cur);
  cutChanged(true);
  status("Порядок нарезок изменён", true);
});
stripDrag($("fStrip"), (from, to) => {
  const cur = project.fields[project.fieldCur];
  moveIn(project.fields, from, to);
  project.fieldCur = project.fields.indexOf(cur);
  fieldChanged(true);
  status("Порядок полей изменён", true);
});
function placeStrip() {
  const strip = $("mStrip"), narrow = window.matchMedia("(max-width: 820px)").matches, q = $("btnHelpTop");
  for (const fs of [$("fStrip"), $("cStrip"), $("oStrip")]) {
    if (narrow && fs.parentElement !== $("panel")) $("panel").insertBefore(fs, $("panel").firstChild);
    if (!narrow && fs.parentElement === $("panel")) document.querySelector(".stage").appendChild(fs);
  }
  if (narrow && q.parentElement.classList.contains("undo")) document.querySelector(".seg.pages").after(q);
  if (!narrow && !q.parentElement.classList.contains("undo")) document.querySelector(".undo").appendChild(q);
  // 2.0.199: на телефоне кнопка версии — в первой строке, справа от «LED / Маски · Волюметрик» (там свободно)
  const vb = $("btnVer"), inUndo = vb.parentElement.classList.contains("undo");
  if (narrow && inUndo) $("appMode").after(vb);
  if (!narrow && !inUndo) document.querySelector(".undo").appendChild(vb);
  vb.classList.toggle("vtop", narrow);
  if (narrow && strip.parentElement !== $("panel")) $("panel").insertBefore(strip, $("panel").firstChild);
  if (!narrow && strip.parentElement === $("panel")) document.querySelector(".stage").appendChild(strip);
}
window.matchMedia("(max-width: 820px)").addEventListener("change", () => {
  placeStrip();
  requestDraw();
});
placeStrip();
function cmpVer(a, b) {
  const pa = String(a).split(".").map((n) => parseInt(n, 10) || 0), pb = String(b).split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}
const lsGet = (k) => {
  try {
    return localStorage.getItem(k);
  } catch (e) {
    return null;
  }
};
const lsSet = (k, v) => {
  try {
    localStorage.setItem(k, v);
  } catch (e) {
  }
};
let updating = false;
window.__updateProgress = (p) => {
  busy("Загрузка обновления… ".concat(Math.round(Math.max(0, Math.min(1, +p || 0)) * 100), "%"));
};
window.__updateFailed = (msg) => {
  updating = false;
  busy("");
  status("Обновление не удалось: " + msg, true);
};
async function checkUpdate(manual) {
  if (PLATFORM === "web" || updating || SELFTEST) return;
  let j;
  try {
    const r = await fetch(UPDATE_URL + "?t=" + Date.now(), { cache: "no-store" });
    if (!r.ok) throw new Error(r.status);
    j = await r.json();
  } catch (e) {
    if (manual) status("Не удалось проверить обновления — нет связи с сайтом", true);
    return;
  }
  const it = j && j[PLATFORM];
  if (!it || !it.url || cmpVer(j.version, APP_VERSION) <= 0) {
    if (manual) status("У вас последняя версия ".concat(APP_VERSION), true);
    return;
  }
  if (!manual && lsGet("ledmask.updateLater") === j.version + "|" + (/* @__PURE__ */ new Date()).toDateString()) return;
  const how = PLATFORM === "android" ? "Приложение скачает новую версию и откроет установку." : "Программа скачает новую версию, перезапустится и откроется с вашим проектом.";
  const ok = await ask("Доступна версия ".concat(j.version), "У вас ".concat(APP_VERSION, ". ").concat(j.notes ? j.notes + " " : "").concat(how), "", "Обновить", false);
  if (!ok) {
    lsSet("ledmask.updateLater", j.version + "|" + (/* @__PURE__ */ new Date()).toDateString());
    return;
  }
  lsSet("ledmask.project", JSON.stringify(projectData(true)));
  updating = true;
  busy("Загрузка обновления…");
  await tick();
  try {
    if (PLATFORM === "android") {
      const r = String(window.AndroidBridge.update(it.url));
      if (!r.startsWith("ok")) throw new Error(r.replace(/^err:/, ""));
      return;
    }
    await desk("update", { url: it.url, sha256: it.sha256 || "", version: j.version });
    busy("Устанавливаю обновление…");
  } catch (e) {
    window.__updateFailed(e.message);
  }
}
// ---- 2.0.199: кнопка версии «⟳ 2.0.199» в верхней панели (как в «Зефирке»): показывает версию,
// мигает, если вышла новая. Веб — перезагружает страницу с новой версией (проект сохраняется автоматически),
// Windows / Mac / Android — запускает обновление программы (скачать и перезапустить)
const SITE_URL = UPDATE_URL.replace(/download\/version\.json$/, "");
const UPD = { ver: "", notes: "", last: 0 };
async function pollUpdate(force) {
  if (SELFTEST || updating) return;
  if (!force && Date.now() - UPD.last < 12e4) return;
  UPD.last = Date.now();
  let j;
  try {
    const r = await fetch(UPDATE_URL + "?t=" + Date.now(), { cache: "no-store" });
    if (!r.ok) throw new Error(r.status);
    j = await r.json();
  } catch (e) {
    return;
  }
  const it = j && j[PLATFORM], newer = !!(j && j.version && cmpVer(j.version, APP_VERSION) > 0 && (PLATFORM === "web" || it && it.url));
  UPD.ver = newer ? j.version : "";
  UPD.notes = newer && j.notes ? String(j.notes) : "";
  syncVerBtn();
}
function syncVerBtn() {
  const b = $("btnVer");
  if (!b) return;
  $("btnVerNo").textContent = APP_VERSION;
  b.classList.toggle("has-upd", !!UPD.ver);
  const t = UPD.ver ? "Доступна версия " + UPD.ver + " — нажмите, чтобы обновить" + (UPD.notes ? "\n" + UPD.notes : "") : PLATFORM === "web" ? "Версия " + APP_VERSION + " — нажмите, чтобы обновить страницу" : "Версия " + APP_VERSION + " — нажмите, чтобы проверить обновления";
  b.title = t;
  b.setAttribute("aria-label", UPD.ver ? "Доступна версия " + UPD.ver + ", обновить" : "Версия " + APP_VERSION + ", обновить");
}
function flushAutosave() {
  clearTimeout(autosaveTimer);
  try {
    localStorage.setItem("ledmask.project", JSON.stringify(projectData(true)));
  } catch (e) {
    try {
      localStorage.setItem("ledmask.project", JSON.stringify({ ...projectData(), refImages: {}, overviewImages: [] }));
    } catch (e2) {
    }
  }
}
$("btnVer").onclick = async () => {
  if (PLATFORM !== "web") {
    await checkUpdate(true);
    return;
  }
  flushAutosave();
  if (/^https?:$/.test(location.protocol)) {
    // с сайта: перезагрузка с меткой версии — браузер не возьмёт старую страницу из кэша
    window.__reloading = true;
    const u = new URL(location.href);
    u.searchParams.set("v", UPD.ver || String(Date.now()));
    status("Обновляю страницу…", true);
    location.replace(u.toString());
    return;
  }
  // файл с компьютера: новую версию — на сайте
  if (UPD.ver) {
    const ok = await ask("Доступна версия " + UPD.ver, "У вас " + APP_VERSION + (UPD.notes ? ". " + UPD.notes : "") + "\n\nЭта страница открыта файлом с компьютера, поэтому сама не обновится. Откройте новую версию на сайте (ваш проект сохранится в браузере) или скачайте новый файл там же.", "", "Открыть сайт", false);
    if (ok !== null) window.open(SITE_URL, "_blank");
    return;
  }
  window.__reloading = true;
  location.reload();
};
syncVerBtn();
// проверка: при запуске, каждые 15 минут и когда возвращаетесь в окно (не чаще раза в 2 минуты)
setInterval(() => pollUpdate(true), 9e5);
window.addEventListener("focus", () => pollUpdate(false));
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) pollUpdate(false);
});
async function runSelfTest() {
  const log = ["version=".concat(APP_VERSION, " platform=").concat(PLATFORM, " compressionStream=").concat(HAS_CS)];
  const L2 = (s) => {
    log.push(s);
  };
  window.__stlog = log;
  try {
    if (DESKTOP) {
      const z = await nativeZ("inflate", "raw", await nativeZ("deflate", "raw", enc.encode("LED mask selftest ".repeat(200))));
      L2("native zlib roundtrip " + (dec.decode(z).length === 3600 ? "OK" : "FAIL"));
    }
    const a = project.screens[0];
    Object.assign(a, { name: "Центр", cabCols: 8, cabRows: 4 });
    a.cornerCabinets = { "1,0": 2 };
    a.blackCabinets = ["0,0"];
    $("btnAddScreen").click();
    Object.assign(S(), { name: "Левый", cabCols: 4, cabRows: 4 });
    const f = project.fields[0];
    f.items = [{ uid: project.screens[0].uid, x: 0, y: 0, rot: 0 }, { uid: project.screens[1].uid, x: 1536, y: 0, rot: 45 }];
    project.tz.fields[f.id] = true;
    project.tz.masks[project.screens[0].uid] = true;
    syncUI();
    changed();
    const m = await renderPNG(project.screens[0]);
    L2("mask png ".concat(m.w, "x").concat(m.h, " ").concat(m.png.length, " bytes"));
    await save("".concat(maskFileBase(project.screens[0]), ".png"), new Blob([m.png], { type: "image/png" }));
    const fp = await renderFieldPNG(f);
    L2("field png ".concat(fp.w, "x").concat(fp.h, " even=").concat(fp.w % 2 === 0 && fp.h % 2 === 0));
    await save("".concat(fieldFileBase(f), ".png"), new Blob([fp.png], { type: "image/png" }));
    for (const t of ["Resolume", "D3", "MP4"]) {
      await exportTZ(t);
      L2("tz ".concat(t, " done"));
    }
    await save("Selftest.ledmask", toPlist(ledmaskData()));
    L2("project saved");
    L2("SELFTEST DONE");
  } catch (e) {
    L2("SELFTEST ERROR " + (e && e.stack || e));
  }
  try {
    await desk("selftestDone", { log: log.join("\n") });
  } catch (e) {
    console.log(log.join("\n"));
  }
}
$("appicon").src = "data:image/png;base64," + ICON_B64;
fillSelect($("cabType"), TYPES.map((t) => t[0]));
// 2.0.98: в конце списка — «Своё разрешение» (как у проекции, ТВ и pixel drop)
{
  const o = document.createElement("option");
  o.value = "";
  o.textContent = "Своё разрешение";
  $("cabType").appendChild(o);
}
// 2.0.117: список типов кабинетов — с цветным прямоугольником перед названием (цвет кабинета)
window.cabTypeUI = swatchSelect($("cabType"), (v) => v === "" || !TYPES[+v] ? null : "rgb(".concat(TYPES[+v][5].join(","), ")"));
// 2.0.164: такие же списки с жирной цветной точкой — у экранов, у типа кабинета кольца и у списка колец
window.rgTypeUI = swatchSelect($("rgType"), (v) => v === "" || !TYPES[+v] ? null : "rgb(".concat(TYPES[+v][5].join(","), ")"));
window.screensUI = swatchSelect($("screens"), (v) => screenDotColor(+v));
window.rgListUI = swatchSelect($("rgList"), (v) => {
  const st = S(), R = st && st.kind === "ring" ? st.ring : null, g = R && R.rings && R.rings[+v];
  return g ? g.color || typeColor(ringCab(R, g).type, ringCab(R, g).cw, ringCab(R, g).ch) : null;
});
fillSelect($("inscSize"), INSC);
fillSelect($("exSize"), INSC);
fillSelect($("txSize"), INSC);
fillSelect($("rot"), ROTS);
fillSelect($("exRot"), ROTS);
fillSelect($("numFmt"), NUM_FORMATS);
fillSelect($("numOrigin"), NUM_ORIGINS);
fillSelect($("numPos"), NUM_POS);
try {
  const saved = localStorage.getItem("ledmask.project");
  if (saved) loadData(JSON.parse(saved));
} catch (e) {
}
// 2.0.112: убираем из IndexedDB картинки, на которые не ссылаются ни автосохранение, ни «Последние»
setTimeout(async () => {
  try {
    await ui.ovReady;
    const keys = await IMGDB.keys();
    if (!keys || !keys.length) return;
    const used = new Set(ui.images.map((im) => im.ref));
    const scan = (d) => (d && Array.isArray(d.overviewImages) ? d.overviewImages : []).forEach((q) => q && q.ref && used.add(q.ref));
    try {
      scan(JSON.parse(localStorage.getItem("ledmask.project") || "null"));
    } catch (e) {
    }
    for (const it of recentGet()) scan(it.data);
    for (const k of keys) if (!used.has(k)) await IMGDB.del(k);
  } catch (e) {
  }
}, 8e3);
document.documentElement.dataset.page = "mask";
syncUI();
requestDraw();
histCommit();
renderStrip();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => {
  autoCache.clear();
  requestDraw();
});
let platformStarted = false;
function startPlatform() {
  if (platformStarted) return;
  platformStarted = true;
  $("verText").textContent = "Версия ".concat(APP_VERSION, " · ").concat(PLATFORM_LABEL, " · сборка ").concat(BUILD_STAMP);
  // 2.0.199: вместо окна при запуске — мигающая кнопка версии в верхней панели (внизу ссылка остаётся)
  if (PLATFORM !== "web") {
    $("btnUpdate").hidden = false;
    $("btnUpdate").onclick = () => checkUpdate(true);
  }
  syncVerBtn();
  setTimeout(() => pollUpdate(true), 3e3);
  if (SELFTEST) setTimeout(() => runSelfTest(), 1500);
}
$("verText").textContent = "Версия ".concat(APP_VERSION, " · ").concat(PLATFORM_LABEL, " · сборка ").concat(BUILD_STAMP);
if (PLATFORM !== "web") startPlatform();
else if (STANDALONE) {
  pywebviewReady.then(async () => {
    setPlatform("windows");
    try {
      const info = await desk("info");
      SELFTEST = !!(info && info.selftest);
      window.__info = info;
    } catch (e) {
      window.__info = "ERR " + e.message;
    }
    startPlatform();
  });
}
// 2.0.199: в браузере — первая проверка обновлений через 6 с (программа для Windows к этому времени уже
// определится как Windows и проверит сама, через startPlatform)
setTimeout(() => {
  if (PLATFORM === "web") pollUpdate(true);
}, 6e3);
if (!HAS_CS && !DESKTOP && !window.pako) {
  $("exportNote").textContent = "Этот браузер слишком старый для экспорта: нужен Safari 16.4+ или свежий Chrome.";
}
if (STANDALONE) document.documentElement.classList.add("standalone");
pv.addEventListener("mousedown", (e) => {
  e.preventDefault();
  const a = document.activeElement;
  if (a && a !== document.body && a.blur && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) a.blur();
});
pv.addEventListener("selectstart", (e) => e.preventDefault());
document.querySelector(".canvas-wrap") && document.querySelector(".canvas-wrap").addEventListener("selectstart", (e) => e.preventDefault());
function setTitleRot(d) {
  const st = S();
  st.rotDeg = normDeg(d);
  let best = 0;
  ROT_DEG.forEach((v, i) => {
    if (Math.abs(normDeg(v - st.rotDeg)) < Math.abs(normDeg(ROT_DEG[best] - st.rotDeg))) best = i;
  });
  st.rotationIndex = best;
  $("rotVal").textContent = st.rotDeg + "°";
  changed();
}
$("rotCCW").onclick = () => setTitleRot(titleRot(S()) + 45);
$("rotCW").onclick = () => setTitleRot(titleRot(S()) - 45);
$("rot0").onclick = () => setTitleRot(0);
const setExRot = (f) => {
  const it = S().extraLabels[ui.selLabel];
  if (!it) {
    status("Сначала добавьте или выберите текст", true);
    return;
  }
  it.rotation = normDeg(f(+it.rotation || 0));
  syncExtraControls();
  changed();
};
$("exRotCCW").onclick = () => setExRot((d) => d + 45);
$("exRotCW").onclick = () => setExRot((d) => d - 45);
$("exRot0").onclick = () => setExRot(() => 0);
$("txSize").addEventListener("change", (e) => {
  const v = e.target.value;
  if (txExtra()) forSel(() => {
    $("exSize").value = v;
    $("exSize").dispatchEvent(new Event("change"));
  });
  else {
    $("inscSize").value = v;
    $("inscSize").dispatchEvent(new Event("change"));
  }
  syncTextControls();
});
for (const [id, ex, main] of [["txMinus", "exMinus", "mainMinus"], ["txPlus", "exPlus", "mainPlus"], ["txRotCCW", "exRotCCW", "rotCCW"], ["txRot0", "exRot0", "rot0"], ["txRotCW", "exRotCW", "rotCW"]])
  $(id).onclick = () => {
    if (txExtra()) forSel(() => $(ex).click());
    else $(main).click();
    syncTextControls();
  };
ui.textMagnet = true;
$("txColor").addEventListener("input", (e) => {
  const st = S(), it = txExtra(), v = e.target.value.toUpperCase();
  if (it) for (const i of selExtras()) st.extraLabels[i].color = v;
  else st.titleColor = v;
  $("txColorReset").disabled = false;
  changed();
});
$("txColorReset").onclick = () => {
  const st = S(), it = txExtra();
  if (it) for (const i of selExtras()) delete st.extraLabels[i].color;
  else st.titleColor = null;
  syncTextControls();
  changed();
};
$("txMagnet").addEventListener("change", (e) => {
  ui.textMagnet = e.target.checked;
});
$("showInfo").addEventListener("change", (e) => {
  S().showInfo = e.target.checked;
  changed();
});
$("autoContour").addEventListener("change", (e) => {
  const st = S();
  st.autoContour = e.target.checked;
  if (st.autoContour) st.showPersistentContour = true;
  changed();
  status(st.autoContour ? "Автоконтур включён: выключите кабинет — контур его обойдёт" : "Автоконтур выключен", true);
});
// цвет кабинета экрана — для точки слева от названия в списке экранов
function screenDotColor(i) {
  const s = project.screens[i];
  if (!s) return null;
  if (s.kind === "ring") {
    const R = s.ring, g0 = R && R.rings && R.rings[0];
    if (!R) return null;
    const cab = ringCab(R, g0 || null);
    return g0 && g0.color || typeColor(cab.type, cab.cw, cab.ch) || null;
  }
  return s.pixelColor ? hex(s.pixelColor) : null;
}
function swatchSelect(sel, colorOf) {
  const box = document.createElement("div"), btn = document.createElement("button"), pop = document.createElement("div");
  box.className = "ssel" + (sel.classList.contains("grow") ? " grow" : "");
  btn.type = "button";
  btn.className = "ssel-btn";
  btn.setAttribute("aria-haspopup", "listbox");
  if (sel.id) btn.setAttribute("aria-label", (document.querySelector('label[for="'.concat(sel.id, '"]')) || {}).textContent || sel.id);
  pop.className = "ssel-pop";
  pop.setAttribute("role", "listbox");
  pop.hidden = true;
  // 2.0.153: не прокручивать меню программы, когда список докручен до края (overscroll-behavior не работает в WebKit на Mojave)
  pop.addEventListener("wheel", (e) => {
    const atTop = pop.scrollTop <= 0, atBottom = pop.scrollTop + pop.clientHeight >= pop.scrollHeight - 1;
    if (e.deltaY < 0 && atTop || e.deltaY > 0 && atBottom) e.preventDefault();
    e.stopPropagation();
  }, { passive: false });
  sel.classList.add("ssel-src");
  sel.tabIndex = -1;
  sel.after(box);
  box.append(btn, pop);
  const sw = (v) => {
    const s = document.createElement("span"), c = colorOf(v);
    s.className = "sw" + (c ? "" : " none");
    if (c) s.style.background = c;
    return s;
  };
  const sync = () => {
    const o = sel.options[sel.selectedIndex], t = document.createElement("span"), ar = document.createElement("span");
    t.className = "t";
    t.textContent = o ? o.text : "";
    ar.className = "ar";
    ar.textContent = "▾";
    btn.replaceChildren(sw(o ? o.value : ""), t, ar);
  };
  const close = () => {
    pop.hidden = true;
    box.classList.remove("open");
  };
  // 2.0.165: список открывается поверх страницы (fixed), чтобы не растягивать панель и не сдвигать её содержимое
  const place = () => {
    const r = btn.getBoundingClientRect(), gap = 4, pad = 8;
    if (r.bottom < 0 || r.top > innerHeight) return close();
    pop.style.position = "fixed";
    pop.style.left = "0px";
    pop.style.top = "0px";
    pop.style.minWidth = r.width + "px";
    pop.style.maxHeight = Math.max(120, Math.min(340, Math.max(r.top, innerHeight - r.bottom) - pad - gap)) + "px";
    const ph = pop.offsetHeight, pw = pop.offsetWidth;
    let top = r.bottom + gap;
    if (top + ph > innerHeight - pad) {
      const up = r.top - gap - ph;
      top = up >= pad ? up : Math.max(pad, innerHeight - pad - ph);
    }
    let left = r.left;
    if (left + pw > innerWidth - pad) left = Math.max(pad, innerWidth - pad - pw);
    pop.style.left = left + "px";
    pop.style.top = top + "px";
  };
  const open = () => {
    pop.replaceChildren();
    for (const o of sel.options) {
      const it = document.createElement("button"), t = document.createElement("span");
      it.type = "button";
      it.className = "ssel-it" + (o.value === sel.value ? " on" : "");
      it.setAttribute("role", "option");
      t.className = "t";
      t.textContent = o.text;
      it.title = o.text;
      it.append(sw(o.value), t);
      it.onclick = () => {
        sel.value = o.value;
        sel.dispatchEvent(new Event("change", { bubbles: true }));
        close();
        sync();
        btn.focus({ preventScroll: true });
      };
      pop.appendChild(it);
    }
    if (pop.parentElement !== document.body) document.body.appendChild(pop);
    pop.hidden = false;
    box.classList.add("open");
    place();
    // прокручиваем только сам список: scrollIntoView сдвинул бы и панель со страницей
    const on = pop.querySelector(".on");
    if (on) pop.scrollTop = Math.max(0, on.offsetTop - (pop.clientHeight - on.offsetHeight) / 2);
  };
  addEventListener("scroll", () => {
    if (!pop.hidden) place();
  }, true);
  addEventListener("resize", () => {
    if (!pop.hidden) place();
  });
  btn.onclick = () => pop.hidden ? open() : close();
  btn.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const n = sel.options.length, i = Math.max(0, Math.min(n - 1, sel.selectedIndex + (e.key === "ArrowDown" ? 1 : -1)));
    if (i === sel.selectedIndex) return;
    sel.selectedIndex = i;
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    sync();
  });
  document.addEventListener("pointerdown", (e) => {
    if (!box.contains(e.target) && !pop.contains(e.target)) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !pop.hidden) close();
  });
  sel.addEventListener("change", sync);
  sync();
  return { sync, close };
}
function stepper(id, fn) {
  const inp = typeof id === "string" ? $(id) : id, wrap = document.createElement("span");
  if (!inp || inp.closest(".stp")) return;
  wrap.className = "stp";
  inp.parentNode.insertBefore(wrap, inp);
  wrap.appendChild(inp);
  const bx = document.createElement("span");
  bx.className = "stpb";
  for (const [d, t] of [[1, "▲"], [-1, "▼"]]) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = t;
    b.tabIndex = -1;
    b.setAttribute("aria-label", (d > 0 ? "Больше: " : "Меньше: ") + (inp.getAttribute("aria-label") || inp.id || ""));
    let t1 = 0, t2 = 0;
    const stop = () => {
      clearTimeout(t1);
      clearInterval(t2);
    };
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      fn(d);
      stop();
      t1 = setTimeout(() => {
        t2 = setInterval(() => {
          // кнопку убрали со страницы (панель перерисовалась) — повтор останавливаем
          if (!b.isConnected) return stop();
          fn(d);
        }, 90);
      }, 380);
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => b.addEventListener(ev, stop));
    b.addEventListener("click", (e) => e.preventDefault());
    bx.appendChild(b);
  }
  wrap.appendChild(bx);
  if (wrap.parentNode && wrap.parentNode.classList) wrap.parentNode.classList.add("stp-row");
}
const stepCabs = (which, d) => {
  const st = S(), k = which === "w" ? "cabCols" : "cabRows";
  st[k] = Math.max(1, st[k] + d);
  $("cols").value = st.cabCols;
  $("rows").value = st.cabRows;
  changed({ forcePhys: true });
};
