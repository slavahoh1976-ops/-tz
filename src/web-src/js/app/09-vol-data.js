// ---- Волюметрик: раздел «Данные» ----
function syncVolUI() {
  const st = S(), V = st.vol || (st.vol = defVol()), set = (id, v) => {
    if (document.activeElement !== $(id)) setVal($(id), v);
  };
  if (!$("vlModel").options.length) $("vlModel").innerHTML = VOL_MODELS.map((m, i) => '<option value="'.concat(i, '">').concat(xmlEsc(m.name), "</option>")).join("") + '<option value="custom">Свой кабинет</option>';
  setVal($("vlModel"), String(V.model));
  set("vlCx", V.cx);
  set("vlWm", compactM(V.cx * V.cw / 100));
  set("vlHm", compactM(V.len));
  set("vlDm", compactM(V.cz * V.cd / 100));
  set("vlCz", V.cz);
  set("vlSx", V.sx);
  set("vlSz", V.sz);
  set("vlCw", V.cw);
  set("vlCd", V.cd);
  set("vlPx", V.px);
  set("vlLen", V.len);
  set("vlPerRow", V.perRow || "");
  set("vlIp", V.ip);
  setVal($("vlStart"), V.start);
  setVal($("vlDir"), V.dir);
  setVal($("vlLine"), V.line === "arc" ? "arc" : "round");
  $("vlSnake").checked = !!V.snake;
  if (!VOL_MASK_UI && V.view !== "com") V.view = "com";
  {
    const vv = document.querySelector(".seg.vlView");
    if (vv && vv.hidden !== !VOL_MASK_UI) vv.hidden = !VOL_MASK_UI;
  }
  document.querySelectorAll(".seg.vlView button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === V.view)));
  document.querySelectorAll(".seg.vlSide button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.s === V.side)));
  document.querySelectorAll("#volData .vlm").forEach((el) => {
    if (el.hidden !== (V.view !== "mask")) el.hidden = V.view !== "mask";
  });
  document.querySelectorAll("#volData .vlc").forEach((el) => {
    if (el.hidden !== (V.view !== "com")) el.hidden = V.view !== "com";
  });
  $("vlPick").textContent = ui.volPick ? "Отменить" : "Задать порядок щелчками";
  $("vlBlank").setAttribute("aria-pressed", String(!!ui.volBlank));
  $("vlBlank").textContent = ui.volBlank ? "Гашение: вкл — щёлкайте кабинеты" : "Гасить кабинеты";
  $("vlAllOn").disabled = !(V.off && V.off.length);
  $("vlPickReset").disabled = !V.manual;
  for (const id of ["vlStart", "vlDir", "vlSnake"]) $(id).disabled = !!V.manual;
  setTxt($("vlComHint"), ui.volBlank ? "Щелчок по кабинету на схеме — погасить или включить (как «Гашение» у LED). Погашенные не коммутируются и не светятся в маске и 3D." : ui.volPick ? "Щёлкайте кабинеты на холсте в порядке коммутации — от первого до последнего." : V.manual ? "Порядок задан вручную. «Сбросить ручной порядок» — вернуть по углу и направлению." : "Номер кабинета = порядок коммутации и IP. Нити пронумерованы как на листе адресации.");  for (const id of ["vlSx", "vlSz", "vlCw", "vlCd", "vlPx", "vlLen"]) $(id).disabled = V.model !== "custom";
  document.querySelectorAll(".seg.vlLayout button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.l === V.layout)));
  if (V.view === "mask") $("vlPerRowRow").hidden = V.layout !== "slices";
  if (!$("vlScale").options.length) $("vlScale").innerHTML = [2, 3, 4, 5, 6, 8, 10, 12, 16].map((v) => '<option value="'.concat(v, '">×').concat(v, "</option>")).join("");
  $("vlScaleOn").checked = !!V.scaleOn;
  setVal($("vlScale"), String(V.scale));
  $("vlShade").checked = V.shade !== false;
  $("vl3d").checked = V.show3d !== false;
  const g = volGeom(st);
  setTxt($("vlDmx"), "Шаг нитей ".concat(cmFmt(g.pitchX)).concat(Math.abs(g.pitchX - g.pitchZ) > 0.01 ? "×" + cmFmt(g.pitchZ) : "", " см · нить: ").concat(V.px * 3, " ").concat(chWord(V.px * 3), " DMX · в universe ").concat(g.perUni, " нит. · кабинет — ").concat(g.uniPerCab, " universe · всего ").concat(g.uniPerCab * g.cabs.length, " universe · IP ").concat(g.cabs.length ? g.cabs[0].ip : "—").concat(g.cabs.length > 1 ? " … " + g.cabs[g.cabs.length - 1].ip : ""));
}
const volChanged = () => {
  syncVolUI();
  changed({ forcePhys: true });
};
// 2.0.66: стрелки у полей чисел — тяжёлую перерисовку откладываем, пока стрелка нажата/кликается:
// иначе браузер не успевает обработать отпускание кнопки и сам продолжает листать (2 → 31 кабинет).
let volNumT = 0;
const volChangedSoon = () => {
  clearTimeout(volNumT);
  volNumT = setTimeout(volChanged, 40);
};
$("vlModel").addEventListener("change", (e) => {
  const V = S().vol, v = e.target.value;
  ui.tzSubManual = false;
  if (v === "custom") V.model = "custom";
  else Object.assign(V, VOL_MODELS[+v], { model: +v }), delete V.name;
  volChanged();
});
for (const [id, k, min, max, float] of [["vlCx", "cx", 1, 64], ["vlCz", "cz", 1, 64], ["vlSx", "sx", 1, 64], ["vlSz", "sz", 1, 64], ["vlPx", "px", 1, 1024], ["vlCw", "cw", 1, 1e4, true], ["vlCd", "cd", 1, 1e4, true], ["vlLen", "len", 0.01, 100, true], ["vlPerRow", "perRow", 0, 4096]])
  $(id).addEventListener("input", () => {
    const raw = String($(id).value).replace(",", "."), v = float ? parseFloat(raw) : pint(raw, NaN);
    if (k === "perRow" && raw.trim() === "") {
      S().vol.perRow = 0;
      volChanged();
      return;
    }
    if (isFinite(v) && v >= min && v <= max) {
      const V = S().vol;
      V[k] = v;
      if (k === "cx" || k === "cz") {
        V.off = V.off.filter((q) => +q.split(",")[0] < V.cx && +q.split(",")[1] < V.cz);
        V.manual = null;
      }
      volChangedSoon();
    }
  });
// размер в метрах: ширина и глубина → число кабинетов, высота → длина нити (модель с такой нитью, иначе «свой»)
for (const [id, ax] of [["vlWm", "w"], ["vlHm", "h"], ["vlDm", "d"]]) {
  $(id).addEventListener("change", () => {
    const v = parseFloat(String($(id).value).replace(",", ".")), V = S().vol;
    if (!(v > 0)) return syncVolUI();
    if (ax === "w" || ax === "d") {
      const k = ax === "w" ? "cx" : "cz", n = Math.max(1, Math.min(64, Math.round(v * 100 / (ax === "w" ? V.cw : V.cd))));
      if (n !== V[k]) {
        V[k] = n;
        V.off = V.off.filter((q) => +q.split(",")[0] < V.cx && +q.split(",")[1] < V.cz);
        V.manual = null;
      }
    } else {
      const mi = VOL_MODELS.findIndex((m) => Math.abs(m.len - v) < 1e-6 && m.sx === V.sx && m.sz === V.sz) >= 0 ? VOL_MODELS.findIndex((m) => Math.abs(m.len - v) < 1e-6 && m.sx === V.sx && m.sz === V.sz) : VOL_MODELS.findIndex((m) => Math.abs(m.len - v) < 1e-6);
      if (mi >= 0) {
        Object.assign(V, VOL_MODELS[mi], { model: mi });
        delete V.name;
      } else Object.assign(V, { model: "custom", len: v });
      ui.tzSubManual = false;
    }
    volChanged();
  });
}
document.querySelectorAll(".seg.vlView button").forEach((b) => b.onclick = () => {
  S().vol.view = b.dataset.v === "com" ? "com" : "mask";
  ui.volPick = false;
  volChanged();
});
document.querySelectorAll(".seg.vlSide button").forEach((b) => b.onclick = () => {
  S().vol.side = b.dataset.s === "top" ? "top" : "bottom";
  volChanged();
});
$("vlStart").addEventListener("change", (e) => {
  S().vol.start = e.target.value;
  volChanged();
});
$("vlLine").addEventListener("change", (e) => {
  S().vol.line = e.target.value === "arc" ? "arc" : "round";
  volChanged();
});
$("vlDir").addEventListener("change", (e) => {
  S().vol.dir = e.target.value === "cols" ? "cols" : "rows";
  volChanged();
});
$("vlSnake").addEventListener("change", (e) => {
  S().vol.snake = e.target.checked;
  volChanged();
});
$("vlPick").onclick = () => {
  ui.volPick = !ui.volPick;
  ui.volBlank = false;
  ui.volPickList = ui.volPick ? [] : null;
  if (ui.volPick) status("Щёлкайте кабинеты по порядку коммутации", true);
  syncVolUI();
  volComDraw();
};
$("vlBlank").onclick = () => {
  ui.volBlank = !ui.volBlank;
  ui.volPick = false;
  syncVolUI();
  volComDraw();
};
$("vlAllOn").onclick = () => {
  const V = S().vol;
  V.off = [];
  V.manual = null;
  volChanged();
  status("Все кабинеты включены", true);
};
$("vlPickReset").onclick = () => {
  S().vol.manual = null;
  ui.volPick = false;
  volChanged();
};
volComInit();
$("vlIp").addEventListener("input", (e) => {
  const v = String(e.target.value).trim();
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v) && v.split(".").every((x) => +x <= 255)) {
    S().vol.ip = v;
    volChanged();
  }
});
document.querySelectorAll(".seg.vlLayout button").forEach((b) => b.onclick = () => {
  S().vol.layout = b.dataset.l === "dmx" ? "dmx" : "slices";
  volChanged();
});
$("vlScaleOn").addEventListener("change", (e) => {
  S().vol.scaleOn = e.target.checked;
  volChanged();
});
$("vlScale").addEventListener("change", (e) => {
  Object.assign(S().vol, { scale: +e.target.value || 4, scaleOn: true });
  volChanged();
});
$("vlShade").addEventListener("change", (e) => {
  S().vol.shade = e.target.checked;
  volChanged();
});
$("vl3d").addEventListener("change", (e) => {
  S().vol.show3d = e.target.checked;
  vol3dDraw(true);
});
vol3dInit();
window.addEventListener("resize", () => vol3dDraw());
