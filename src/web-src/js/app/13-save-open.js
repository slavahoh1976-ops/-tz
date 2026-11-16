// ---- 2.0.74: Сохранить / Сохранить как / Открыть, учёт несохранённых изменений ----
// В Chrome/Edge (веб) — File System Access: «Сохранить» пишет в тот же файл без вопросов.
// В программах для Windows/Mac/Android и в других браузерах «Сохранить» без известного файла = «Сохранить как».
let projHandle = null;
const SAVED_KEY = "ledmask.savedHash";
const FSA = !DESKTOP && !window.AndroidBridge && typeof window.showSaveFilePicker === "function" && typeof window.showOpenFilePicker === "function";
const FSA_TYPES = [{ description: "Проект LED Mask", accept: { "application/octet-stream": [".ledmask", ".json"] } }];
function projHash() {
  const t = histSnap() + JSON.stringify(ui.images.map((im) => [im.id, im.caption, im.marks, im.markR]));
  let h = 0;
  for (let i = 0; i < t.length; i++) h = h * 31 + t.charCodeAt(i) | 0;
  return t.length + ":" + h;
}
function savedHash() {
  try {
    return localStorage.getItem(SAVED_KEY);
  } catch (e) {
    return null;
  }
}
function markSaved() {
  try {
    localStorage.setItem(SAVED_KEY, projHash());
  } catch (e) {
  }
  updateProjState();
}
const isDirty = () => savedHash() !== projHash();
function updateProjState() {
  const el = $("projState");
  if (el) setTxt(el, isDirty() ? "● Есть несохранённые изменения" : projHandle ? "Сохранено в файл: " + projHandle.name : "");
}
function askUnsaved() {
  return new Promise((res) => {
    $("modalTitle").textContent = "Сохранить изменения в «".concat(project.name || "Проект", "»?");
    $("modalText").textContent = "Если не сохранить, несохранённые изменения будут потеряны.";
    $("modalText").hidden = false;
    $("modalInput").hidden = true;
    $("modalOk").textContent = "Сохранить";
    // 2.0.180: подписи задаются явно — окно версии ТЗ (askBump) меняет эту же кнопку на «Оставить имя»
    $("modalAlt").textContent = "Не сохранять";
    $("modalCancel").textContent = "Отмена";
    $("modalAlt").hidden = false;
    $("modal").hidden = false;
    const done = (v) => {
      $("modal").hidden = true;
      $("modalAlt").hidden = true;
      $("modalOk").onclick = $("modalCancel").onclick = $("modalAlt").onclick = null;
      res(v);
    };
    $("modalOk").onclick = () => done("save");
    $("modalAlt").onclick = () => done("discard");
    $("modalCancel").onclick = () => done(null);
  });
}
async function guardUnsaved() {
  if (!isDirty()) return true;
  const a = await askUnsaved();
  if (!a) return false;
  if (a === "save") return await projSave() !== false;
  return true;
}
async function writeHandle(h, data) {
  if (h.queryPermission && await h.queryPermission({ mode: "readwrite" }) !== "granted" && h.requestPermission && await h.requestPermission({ mode: "readwrite" }) !== "granted") return false;
  const w = await h.createWritable();
  await w.write(typeof data === "string" ? new Blob([data]) : data);
  await w.close();
  return true;
}
async function projSaveAs() {
  const f = projectFile();
  if (FSA) {
    try {
      const h = await window.showSaveFilePicker({ suggestedName: f.name, types: FSA_TYPES });
      if (!await writeHandle(h, f.data)) return false;
      projHandle = h;
      markSaved();
      recentAdd("сохранён: " + h.name);
      status("Сохранено: " + h.name, true);
      return true;
    } catch (e) {
      if (e && e.name === "AbortError") return false;
    }
  }
  const ok = await save(f.name, f.data);
  if (ok !== false) {
    markSaved();
    recentAdd("сохранён: " + f.name);
  }
  return ok;
}
async function projSave() {
  if (projHandle) {
    try {
      const f = projectFile();
      if (await writeHandle(projHandle, f.data)) {
        markSaved();
        recentAdd("сохранён: " + projHandle.name);
        status("Сохранено: " + projHandle.name, true);
        return true;
      }
    } catch (e) {
      status("Не удалось записать в тот же файл — выберите, куда сохранить", true);
    }
  }
  return projSaveAs();
}
$("btnSaveProj").onclick = () => projSave();
$("btnSaveAsProj").onclick = () => projSaveAs();
window.addEventListener("keydown", (e) => {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === "s" || k === "ы") {
    e.preventDefault();
    if (e.shiftKey) projSaveAs();
    else projSave();
  } else if ((k === "o" || k === "щ") && !e.shiftKey) {
    e.preventDefault();
    $("btnOpenProj").click();
  }
});
window.addEventListener("beforeunload", (e) => {
  // в браузере предупреждаем при закрытии вкладки с несохранёнными изменениями
  // 2.0.199: перезагрузка кнопкой версии — проект уже сохранён в браузере, не спрашиваем
  if (window.__reloading || DESKTOP || window.AndroidBridge || !isDirty()) return;
  e.preventDefault();
  e.returnValue = "";
});
// 2.0.48: «Последние проекты» — сам проект запоминается в хранилище программы (до 10 штук)
const RECENT_KEY = "ledmask.recent", RECENT_MAX = 10;
function recentGet() {
  try {
    const a = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(a) ? a : [];
  } catch (e) {
    return [];
  }
}
function recentPut(list) {
  for (let tries = 0; tries < 30; tries++) {
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(list));
      return true;
    } catch (e) {
      // места не хватает: сначала убираем картинки у старых записей, потом сами старые записи
      const heavy = [...list].reverse().find((it) => it.data && (it.data.refImages && Object.keys(it.data.refImages).length || it.data.overviewImages && it.data.overviewImages.length));
      if (heavy) heavy.data = { ...heavy.data, refImages: {}, overviewImages: [] };
      else if (list.length > 1) list.pop();
      else return false;
    }
  }
  return false;
}
function recentThumb() {
  try {
    const st = project.screens[0], [W, H] = dims(st), k = Math.min(192 / W, 108 / H);
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(W * k));
    c.height = Math.max(1, Math.round(H * k));
    drawMask(c.getContext("2d"), st, k, guidesOf(st));
    return c.toDataURL("image/jpeg", 0.7);
  } catch (e) {
    return "";
  }
}
function recentAdd(src) {
  try {
    const name = project.name || "Проект", list = recentGet().filter((it) => it.name !== name);
    const st = project.screens[0], [W, H] = st ? dims(st) : [0, 0];
    list.unshift({ name, src, at: Date.now(), screens: project.screens.length, res: "".concat(W, "×").concat(H), thumb: recentThumb(), data: projectData(true) });
    recentPut(list.slice(0, RECENT_MAX));
  } catch (e) {
  }
}
const recentWhen = (t) => {
  const d = new Date(t), p2 = (n) => String(n).padStart(2, "0");
  return "".concat(p2(d.getDate()), ".").concat(p2(d.getMonth() + 1), ".").concat(d.getFullYear(), " ").concat(p2(d.getHours()), ":").concat(p2(d.getMinutes()));
};
const screensWord = (n) => n % 10 === 1 && n % 100 !== 11 ? "экран" : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? "экрана" : "экранов";
function renderRecent() {
  const box = $("recentList"), list = recentGet();
  box.innerHTML = "";
  if (!list.length) {
    box.innerHTML = '<div class="recent-empty">Пока пусто. Откройте или сохраните проект — он появится здесь.</div>';
    return;
  }
  list.forEach((it, i) => {
    const row = document.createElement("div");
    row.className = "recent-item";
    const img = document.createElement("img");
    img.alt = "";
    if (it.thumb) img.src = it.thumb;
    const info = document.createElement("div");
    const b = document.createElement("b");
    b.textContent = it.name;
    const h1 = document.createElement("p");
    h1.className = "hint";
    h1.textContent = "".concat(it.screens || 1, " ").concat(screensWord(it.screens || 1), " · ").concat(it.res || "");
    const h2 = document.createElement("p");
    h2.className = "hint";
    h2.textContent = "".concat(recentWhen(it.at), " · ").concat(it.src || "");
    info.append(b, h1, h2);
    const acts = document.createElement("div");
    acts.className = "acts";
    const op = document.createElement("button");
    op.className = "b";
    op.textContent = "Открыть";
    op.onclick = () => recentOpen(i);
    const del = document.createElement("button");
    del.className = "b sq";
    del.textContent = "×";
    del.title = "Убрать из списка";
    del.onclick = () => {
      const l = recentGet();
      l.splice(i, 1);
      recentPut(l);
      renderRecent();
    };
    acts.append(op, del);
    row.append(img, info, acts);
    box.appendChild(row);
  });
}
async function recentOpen(i) {
  const it = recentGet()[i];
  if (!it || !it.data) return;
  $("recent").hidden = true;
  if (!await guardUnsaved()) {
    $("recent").hidden = false;
    return;
  }
  if (it.name !== project.name) recentAdd("последнее состояние");
  try {
    loadData(it.data);
    syncUI();
    changed({ forcePhys: true });
    await ui.ovReady;
    if (ui.ovMissing) status("Картинки общего плана не найдены в памяти программы — откройте файл проекта", true);
    recentAdd(it.src && it.src.indexOf("открыт из последних") === 0 ? it.src : "открыт из последних");
    projHandle = null;
    markSaved();
    status("Открыт проект: " + it.name, true);
  } catch (err) {
    status("Не удалось открыть проект: " + err.message, true);
  }
}
$("btnRecent").onclick = () => {
  renderRecent();
  $("recent").hidden = false;
};
$("recentClose").onclick = () => $("recent").hidden = true;
$("recent").addEventListener("click", (e) => {
  if (e.target === $("recent")) $("recent").hidden = true;
});
$("recentClear").onclick = async () => {
  $("recent").hidden = true;
  if (await ask("Очистить список последних проектов?", "Сами файлы проектов не удаляются.", "", "Очистить", false)) recentPut([]);
  renderRecent();
  $("recent").hidden = false;
};
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("recent").hidden) $("recent").hidden = true;
});
function updateTZNote() {
  const w = tzVolWhat(), progs = /^Vol/.test(ui.tzTpl) ? [w.madrix && "MADRIX", w.madshow && "MAD-SHOW", w.td && "TouchDesigner"].filter(Boolean) : [];
  $("tNote").textContent = "ZIP с папкой: PPTX по шаблону, такой же PDF и PNG каждой маски и поля" + (progs.length ? ", папка «Адресация» (" + progs.join(", ") + ")" : "") + (project.tz.projZip !== false ? " и файл проекта." : ".");
}
// 2.0.113: File.text() нет в Safari 12–13 (Mac 10.14) — читаем через FileReader
const fileText = (f) => typeof f.text === "function" ? f.text() : new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result || ""));
  r.onerror = () => rej(r.error || new Error("не удалось прочитать файл"));
  r.readAsText(f);
});
async function openProjText(text, name, handle) {
  const d = /^\s*(<\?xml|<!DOCTYPE plist|<plist)/.test(text) ? parsePlist(text) : JSON.parse(text);
  loadData(d);
  syncUI();
  changed({ forcePhys: true });
  projHandle = handle || null;
  // 2.0.112: картинки общего плана открываются не сразу — в «Последние» и «сохранено» только после них
  const nOv = Array.isArray(d.overviewImages) ? d.overviewImages.length : 0;
  if (nOv) busy("Загрузка картинок общего плана…");
  try {
    await ui.ovReady;
  } finally {
    if (nOv) busy("");
  }
  recentAdd("открыт файл: " + name);
  markSaved();
  status("Открыт проект: ".concat(name).concat(nOv ? " · картинок общего плана: ".concat(ui.images.length) : ""), true);
}
$("btnOpenProj").onclick = async () => {
  if (!await guardUnsaved()) return;
  if (FSA) {
    try {
      const [h] = await window.showOpenFilePicker({ types: FSA_TYPES, multiple: false });
      const f = await h.getFile();
      await openProjText(await fileText(f), f.name, h);
    } catch (e) {
      if (e && e.name !== "AbortError") status("Не удалось открыть проект: " + e.message, true);
    }
    return;
  }
  $("fileProj").click();
};
$("fileProj").addEventListener("change", async (e) => {
  const f = e.target.files[0];
  e.target.value = "";
  if (!f) return;
  try {
    await openProjText(await fileText(f), f.name, null);
  } catch (err) {
    status("Не удалось открыть проект: " + err.message, true);
  }
});
ui.page = "mask";
ui.magnet = true;
