const TZ_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48];
const rgbHex = (c) => {
  if (!c) return null;
  if (c[0] === "#") return c.length === 4 ? ("#" + c[1] + c[1] + c[2] + c[2] + c[3] + c[3]).toUpperCase() : c.slice(0, 7).toUpperCase();
  const m = c.match(/\d+/g);
  return m && m.length >= 3 ? "#" + m.slice(0, 3).map((v) => (+v).toString(16).padStart(2, "0")).join("").toUpperCase() : null;
};
function runsMdS(runs) {
  let out = "", col2 = null, size = null, bold = false;
  for (const r of runs) {
    if (!r.t) continue;
    const c = r.link ? null : hexU(r.color), z = r.sz || null;
    if (c !== col2 || z !== size) {
      if (bold) {
        out += "**";
        bold = false;
      }
      if (size && z !== size) {
        out += "[/s]";
      }
      if (c !== col2) {
        if (col2) out += "[/]";
        if (c) out += "[" + c + "]";
      }
      if (z && z !== size) out += "[s" + z + "]";
      col2 = c;
      size = z;
    }
    if (!!r.b !== bold) {
      out += "**";
      bold = !!r.b;
    }
    out += r.t;
  }
  if (bold) out += "**";
  if (size) out += "[/s]";
  if (col2) out += "[/]";
  return out;
}
const rteBase = () => isReqSel(ui.tzSel) ? (tplCache[selBk()] || {}).baseSz || 10 : NOTE_SZ;
// mds — исходная разметка строк: строка, которую не трогали, при чтении вернётся ровно такой (с подчёркиванием и размером шаблона)
function rteRender(el, paras, base, mds) {
  const esc = (t) => xmlEsc(t);
  el.innerHTML = paras.map((runs) => {
    // 3.0.9: пустая строка-отступ между разделами шаблона — своей (меньшей) высоты, в неё не пишут
    if (runs.length && runs.every((r) => r.gap)) return '<div class="gap" contenteditable="false" style="font-size:'.concat((runs[0].sz / base).toFixed(3), 'em"><br></div>');
    const inner = runs.map((r) => {
      let h = esc(r.t);
      if (r.b) h = "<b>".concat(h, "</b>");
      if (r.link) h = '<span class="lnk">'.concat(h, "</span>");
      else if (r.color) h = '<font color="'.concat(r.color, '">').concat(h, "</font>");
      if (r.u && !r.link) h = '<span class="u">'.concat(h, "</span>");
      if (r.sz && Math.abs(r.sz - base) > 1e-6) h = '<span data-sz="'.concat(r.sz, '" style="font-size:').concat((r.sz / base).toFixed(3), 'em">').concat(h, "</span>");
      return h;
    }).join("");
    // 3.0.24: интервал и отступы абзаца — как на листе
    const st2 = (runs.lhPt ? "line-height:".concat((runs.lhPt / base).toFixed(3), "em;") : runs.lh ? "line-height:".concat((RT_LH * runs.lh).toFixed(3), ";") : "") + (runs.sb ? "margin-top:".concat((runs.sb / base).toFixed(3), "em;") : "") + (runs.sa ? "margin-bottom:".concat((runs.sa / base).toFixed(3), "em;") : "");
    return "<div".concat(st2 ? ' style="'.concat(st2, '"') : "", ">").concat(inner || "<br>", "</div>");
  }).join("");
  if (mds) Array.from(el.children).forEach((d, i) => {
    if (mds[i] == null || d.classList.contains("gap")) return;
    d.dataset.o = mds[i];
    d.dataset.h = d.innerHTML;
  });
}
function rteRead(el) {
  const lines = [[]];
  const walk = (node, st) => {
    for (const n of node.childNodes) {
      if (n.nodeType === 3) {
        if (n.nodeValue) lines[lines.length - 1].push({ t: n.nodeValue.replace(/ /g, " "), ...st });
        continue;
      }
      if (n.nodeType !== 1) continue;
      const tag = n.tagName;
      if (tag === "BR") {
        if (n.nextSibling || n.parentNode === el) lines.push([]);
        continue;
      }
      const s2 = { ...st };
      if (tag === "B" || tag === "STRONG" || /^(bold|[6-9]00)$/.test(n.style.fontWeight)) s2.b = true;
      if (n.classList.contains("lnk")) s2.color = null;
      else {
        const c = n.getAttribute("color") || n.style && n.style.color;
        if (c) s2.color = rgbHex(c);
      }
      if (n.dataset && n.dataset.sz) s2.sz = +n.dataset.sz;
      const block = tag === "DIV" || tag === "P";
      if (block && lines[lines.length - 1].length) lines.push([]);
      if (block && n.dataset.o != null && n.innerHTML === n.dataset.h) {
        lines[lines.length - 1].push({ raw: n.dataset.o });
        lines.push([]);
        continue;
      }
      walk(n, s2);
      if (block) lines.push([]);
    }
  };
  walk(el, {});
  if (lines.length > 1 && !lines[lines.length - 1].length) lines.pop();
  return lines.map((l) => l.length === 1 && l[0].raw != null ? l[0].raw : runsMdS(l)).join("\n");
}
let rteRange = null;
document.addEventListener("selectionchange", () => {
  const el = document.getElementById("tTxt"), sel = window.getSelection();
  if (el && sel && sel.rangeCount && el.contains(sel.anchorNode)) rteRange = sel.getRangeAt(0).cloneRange();
});
function rteSelect(whole) {
  const el = $("tTxt"), sel = window.getSelection();
  el.focus();
  let r = rteRange && el.contains(rteRange.startContainer) ? rteRange : null;
  if (!r || r.collapsed) {
    if (!whole) {
      status("Сначала выделите текст", true);
      return false;
    }
    r = document.createRange();
    r.selectNodeContents(el);
  }
  sel.removeAllRanges();
  sel.addRange(r);
  return true;
}
function rteDone() {
  $("tTxt").dispatchEvent(new Event("input"));
  const sel = window.getSelection();
  if (sel.rangeCount) rteRange = sel.getRangeAt(0).cloneRange();
}
function rteBar(opts) {
  const bar = document.createElement("div");
  bar.className = "tzbar";
  const btn = (txt, title, fn) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "b";
    b.innerHTML = txt;
    b.title = title;
    b.onmousedown = (e) => e.preventDefault();
    b.onclick = fn;
    bar.appendChild(b);
    return b;
  };
  const W = () => opts.whole();
  btn("<b>Ж</b>", "Жирный", () => {
    if (!rteSelect(W())) return;
    document.execCommand("styleWithCSS", false, false);
    document.execCommand("bold");
    rteDone();
  });
  const ci = document.createElement("input");
  ci.type = "color";
  ci.className = "swatch";
  ci.value = "#e53935";
  ci.title = "Цвет выделенного текста";
  ci.addEventListener("mousedown", () => {
  });
  const applyColor = () => {
    if (!rteSelect(W())) return;
    document.execCommand("styleWithCSS", false, false);
    document.execCommand("foreColor", false, ci.value);
    rteDone();
  };
  ci.addEventListener("input", applyColor);
  ci.addEventListener("change", applyColor);
  bar.appendChild(ci);
  const sz = document.createElement("select");
  sz.title = "Размер выделенного текста";
  sz.style.cssText = "padding:3px 4px;font-size:12.5px";
  sz.innerHTML = '<option value="">Размер</option>' + TZ_SIZES.map((v) => '<option value="'.concat(v, '">').concat(v, " pt</option>")).join("");
  sz.addEventListener("change", () => {
    const v = +sz.value;
    sz.value = "";
    if (!v) return;
    if (!rteSelect(W())) return;
    const el = $("tTxt"), base = rteBase();
    document.execCommand("styleWithCSS", false, false);
    document.execCommand("fontSize", false, "7");
    const made = [];
    el.querySelectorAll('font[size="7"]').forEach((f) => {
      const sp = document.createElement("span");
      sp.dataset.sz = v;
      sp.style.fontSize = (v / base).toFixed(3) + "em";
      if (f.getAttribute("color")) {
        const c = document.createElement("font");
        c.setAttribute("color", f.getAttribute("color"));
        while (f.firstChild) c.appendChild(f.firstChild);
        sp.appendChild(c);
      } else while (f.firstChild) sp.appendChild(f.firstChild);
      sp.querySelectorAll("[data-sz]").forEach((x) => {
        while (x.firstChild) x.parentNode.insertBefore(x.firstChild, x);
        x.remove();
      });
      f.replaceWith(sp);
      made.push(sp);
    });
    if (made.length) {
      const r = document.createRange();
      r.setStartBefore(made[0]);
      r.setEndAfter(made[made.length - 1]);
      const sl = window.getSelection();
      sl.removeAllRanges();
      sl.addRange(r);
    }
    rteDone();
  });
  bar.appendChild(sz);
  btn("Сбросить", "Убрать жирный, цвет и размер у выделенного текста", () => {
    if (!rteSelect(W())) return;
    document.execCommand("removeFormat");
    const el = $("tTxt"), sel = window.getSelection(), r = sel.rangeCount ? sel.getRangeAt(0) : null;
    el.querySelectorAll("[data-sz]").forEach((x) => {
      if (!r || r.intersectsNode(x)) {
        while (x.firstChild) x.parentNode.insertBefore(x.firstChild, x);
        x.remove();
      }
    });
    rteDone();
  });
  return bar;
}
function tzTextSlides() {
  // Слайд 1: каждый текстовый блок шаблона — отдельный пункт; «req» — последний блок (выбран по умолчанию)
  const blocks = tplCache[ui.tzTpl + "@all"];
  const out = blocks ? blocks.map((b, i) => ({ key: i === blocks.length - 1 ? "req" : "req#" + i, title: "Слайд 1 · ".concat(b.title) })) : [{ key: "req", title: "Слайд 1 — требования шаблона ".concat(ui.tzTpl) }];
  const nReq = out.length, items = tzItems(), imgs = tzImages();
  for (const { g } of imgGroups(imgs)) {
    const ims = g.map((j) => imgs[j]);
    out.push({ key: imgKey(ims[0]), title: ims.map((im) => im.caption || "картинка").join(", ") });
  }
  for (const g of maskGroups(items)) {
    const its = g.g.map((i) => items[i]);
    out.push({ key: noteKey(its), title: its.map((i) => i.kind === "field" ? i.f.name : i.name).join(", ") });
  }
  out.forEach((sl, i) => {
    if (i >= nReq) sl.title = "Слайд ".concat(i - nReq + 2, " — ").concat(sl.title);
  });
  return out;
}
ui.tzSel = "req";
const isReqSel = (k) => k === "req" || String(k).startsWith("req#");
const selBk = () => ui.tzTpl + (String(ui.tzSel).startsWith("req#") ? ui.tzSel.slice(3) : "");
const tzSelPk = () => isReqSel(ui.tzSel) ? "req:" + selBk() : "note:" + ui.tzSel;
function refreshTZText() {
  const slides = tzTextSlides(), sel = $("tTxtSel"), ta = $("tTxt");
  if (!slides.some((x) => x.key === ui.tzSel)) ui.tzSel = "req";
  sel.innerHTML = slides.map((x) => '<option value="'.concat(xmlEsc(x.key), '">').concat(xmlEsc(x.title), "</option>")).join("");
  sel.value = ui.tzSel;
  const isReq = isReqSel(ui.tzSel);
  ta.classList.toggle("req", isReq);
  ta.classList.toggle("note", !isReq);
  ta.dataset.ph = isReq ? "" : "Свой текст на этом слайде (необязательно)";
  $("tTxtReset").hidden = !isReq;
  $("tTxtPos").hidden = !tzPos(tzSelPk());
  $("tTxtPos").textContent = isReq ? "Вернуть на место" : "Над масками";
  if (isReq) {
    const tpl = ui.tzTpl, sel0 = ui.tzSel, bk = selBk(), had = !!tplCache[tpl + "@all"];
    $("tTxtReset").disabled = reqText(bk) == null;
    tplBlocks(tpl).then(() => {
      if (!had) return refreshTZText();
      const info = tplCache[bk];
      if (!info || ui.tzTpl !== tpl || ui.tzSel !== sel0 || document.activeElement === ta && ta.dataset.key === "req:" + bk) return;
      rteRender(ta, reqParas(info, reqTextOr(info)), info.baseSz, reqTextOr(info).replace(/\r/g, "").split("\n"));
      ta.dataset.key = "req:" + bk;
      requestDraw();
    }).catch((e) => {
      ta.value = "";
      status("Шаблон не прочитан: " + e.message, true);
    });
  } else if (document.activeElement !== ta || ta.dataset.key !== ui.tzSel) {
    const t = noteText(ui.tzSel);
    if (t) rteRender(ta, mdParas(t), NOTE_SZ, t.replace(/\r/g, "").split("\n"));
    else ta.innerHTML = "";
    ta.dataset.key = ui.tzSel;
  }
}
function selectTZText(key2) {
  if (ui.tzSel === key2) return;
  ui.tzSel = key2;
  $("tTxt").blur();
  rteRange = null;
  refreshTZText();
  requestDraw();
}
$("tTxtSel").addEventListener("change", (e) => selectTZText(e.target.value));
$("tTxt").addEventListener("input", () => {
  const ta = $("tTxt"), v = rteRead(ta);
  if (isReqSel(ui.tzSel)) {
    const label = selBk(), info = tplCache[label];
    if (!info) return;
    if (v.replace(/\r/g, "") === info.md) delete project.tz.req[label];
    else project.tz.req[label] = v;
    $("tTxtReset").disabled = reqText(label) == null;
  } else {
    if (v.trim()) project.tz.notes[ui.tzSel] = v;
    else if (volNoteKey(ui.tzSel)) project.tz.notes[ui.tzSel] = ""; // стёрли «Информацию» — не возвращаем её сами
    else delete project.tz.notes[ui.tzSel];
  }
  requestDraw();
  scheduleAutosave();
  scheduleHistory();
});
$("tTxt").before(rteBar({ whole: () => !isReqSel(ui.tzSel) }));
$("tTxt").addEventListener("paste", (e) => {
  e.preventDefault();
  const t = (e.clipboardData || window.clipboardData).getData("text/plain");
  document.execCommand("insertText", false, t);
});
$("tTxt").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    document.execCommand("insertParagraph");
  }
});
$("tTxtPos").onclick = () => {
  delete project.tz.pos[tzSelPk()];
  $("tTxtPos").hidden = true;
  requestDraw();
  scheduleAutosave();
  scheduleHistory();
};
$("tTxtReset").onclick = () => {
  delete project.tz.req[selBk()];
  const info = tplCache[selBk()];
  if (info) {
    rteRender($("tTxt"), reqParas(info, info.md), info.baseSz, info.md.split("\n"));
  }
  $("tTxtReset").disabled = true;
  requestDraw();
  scheduleAutosave();
  scheduleHistory();
  status("Текст блока «" + (info ? info.title : "") + "» — как в шаблоне " + tzName(ui.tzTpl));
};
function renderImgList() {
  const box = $("tImgs");
  box.innerHTML = "";
  ui.images.forEach((im, i) => {
    const r = document.createElement("div");
    r.className = "imgrow";
    const t = document.createElement("img");
    t.src = im.url;
    t.alt = "";
    t.title = "".concat(im.name, " · ").concat(im.w, "×").concat(im.h);
    const cap = document.createElement("input");
    cap.type = "text";
    cap.value = im.caption;
    cap.placeholder = "Подпись над картинкой";
    cap.setAttribute("aria-label", "Подпись картинки " + (i + 1));
    cap.addEventListener("input", () => {
      im.caption = cap.value;
      requestDraw();
      refreshTZText();
    });
    const btn = (txt, title, fn, dis) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "b";
      b.textContent = txt;
      b.title = title;
      b.disabled = !!dis;
      b.onclick = fn;
      return b;
    };
    const move = (d) => {
      const j = i + d;
      [ui.images[i], ui.images[j]] = [ui.images[j], ui.images[i]];
      tzChanged();
    };
    r.append(
      t,
      cap,
      btn("↑", "Выше", () => move(-1), i === 0),
      btn("↓", "Ниже", () => move(1), i === ui.images.length - 1),
      btn("×", "Убрать картинку", () => {
        URL.revokeObjectURL(im.url);
        ui.images.splice(i, 1);
        tzChanged();
      })
    );
    box.appendChild(r);
    const mk = btn("① Расставить номера экранов".concat(im.marks && im.marks.length ? " · " + im.marks.length : ""), "Номера экранов на картинке: жёлтые круги с цифрой, двигаются мышью", () => openMarkEditor(im));
    mk.classList.add("imgmk");
    box.appendChild(mk);
  });
}
// ---- Номера экранов на картинке общего плана: жёлтые круги с цифрой, двигаются мышью ----
// im.marks — [{ n, x, y }] в долях ширины/высоты картинки; im.markR — радиус в долях высоты.
function drawMark(c, x, y, r, n, sel) {
  c.save();
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fillStyle = "#FFF200";
  c.fill();
  c.lineWidth = Math.max(1, r * 0.07);
  c.strokeStyle = "#111";
  c.stroke();
  if (sel) {
    c.beginPath();
    c.arc(x, y, r + Math.max(3, r * 0.18), 0, Math.PI * 2);
    c.strokeStyle = "#1ec8b4";
    c.lineWidth = Math.max(2, r * 0.1);
    c.stroke();
  }
  const t = String(n);
  c.fillStyle = "#111";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.font = "500 ".concat(r * (t.length > 1 ? 0.95 : 1.15), "px Arial, Helvetica, sans-serif");
  c.fillText(t, x, y + r * 0.05);
  c.restore();
}
// Радиус номера в долях высоты картинки: свой (m.r) или общий (im.markR)
const markRad = (im, m) => m && m.r > 0 ? m.r : im.markR || 0.032;
function paintMarks(c, im, W, H, sel) {
  (im.marks || []).forEach((m, i) => drawMark(c, m.x * W, m.y * H, markRad(im, m) * H, m.n, i === sel));
}
// Картинка с впечатанными номерами — в превью ТЗ, PPTX и PDF
async function bakeMarks(im) {
  if (!im.base) return;
  const cv = document.createElement("canvas");
  cv.width = im.w;
  cv.height = im.h;
  const c = cv.getContext("2d");
  c.drawImage(im.base, 0, 0, im.w, im.h);
  paintMarks(c, im, im.w, im.h, -1);
  const blob = await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.92));
  im.jpeg = new Uint8Array(await blob.arrayBuffer());
  URL.revokeObjectURL(im.url);
  im.url = URL.createObjectURL(blob);
  im.img = cv;
}
function openMarkEditor(im) {
  if (!im.base) {
    status("Эту картинку нужно добавить заново", true);
    return;
  }
  im.marks = im.marks || [];
  const ov = document.createElement("div");
  ov.className = "mk";
  ov.innerHTML = '<div class="mk-head"><b>Номера экранов — '.concat(xmlEsc(im.caption || im.name), '</b><p class="hint">Щелчок по картинке — новый номер (следующий). Номера двигаются мышью. Двойной щелчок по номеру — изменить его, следующие новые номера пойдут дальше от него. Выбранный номер: цифры на клавиатуре — сменить номер, + / − или колесо мыши — размер, Delete — удалить.</p></div><div class="mk-wrap"><canvas></canvas></div><div class="mk-foot"><label class="lbl" for="mkR">Размер всех</label><input type="range" id="mkR" min="12" max="90"><span class="unit num" id="mkRV"></span><span class="lbl">Выбранный:</span><button class="b sq" id="mkMinus" title="Меньше (−)">−</button><span class="unit num" id="mkSelV">—</span><button class="b sq" id="mkPlus" title="Больше (+)">+</button><button class="b" id="mkSame" title="Вернуть общий размер">Как у всех</button><button class="b" id="mkDel">Удалить выбранный</button><button class="b" id="mkClear">Убрать все</button><span class="grow"></span><button class="x" id="mkDone">Готово</button></div>');
  document.body.appendChild(ov);
  const cv = ov.querySelector("canvas"), wrap = ov.querySelector(".mk-wrap"), c = cv.getContext("2d");
  let sel = im.marks.length - 1, drag = null, typed = "", typedAt = 0;
  const fit = () => {
    const k = Math.min(1, wrap.clientWidth / im.w, wrap.clientHeight / im.h);
    cv.width = Math.round(im.w * Math.max(k, 0.05) * (window.devicePixelRatio || 1));
    cv.height = Math.round(im.h * Math.max(k, 0.05) * (window.devicePixelRatio || 1));
    cv.style.width = Math.round(im.w * k) + "px";
    cv.style.height = Math.round(im.h * k) + "px";
    draw();
  };
  const draw = () => {
    c.drawImage(im.base, 0, 0, cv.width, cv.height);
    paintMarks(c, im, cv.width, cv.height, sel);
  };
  const syncR = () => {
    ov.querySelector("#mkR").value = Math.round((im.markR || 0.032) * 1000);
    ov.querySelector("#mkRV").textContent = ((im.markR || 0.032) * 200).toFixed(1) + "%";
    const m = im.marks[sel];
    ov.querySelector("#mkSelV").textContent = m ? (markRad(im, m) * 200).toFixed(1) + "%" + (m.r > 0 ? "" : " (общий)") : "—";
    for (const id of ["#mkMinus", "#mkPlus", "#mkSame", "#mkDel"]) ov.querySelector(id).disabled = !m;
  };
  const pos = (e) => {
    const r = cv.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  };
  const hit = (p) => {
    for (let i = im.marks.length - 1; i >= 0; i--) {
      const m = im.marks[i], ry = markRad(im, m), rx = ry * im.h / im.w, dx = (p[0] - m.x) / rx, dy = (p[1] - m.y) / ry;
      if (dx * dx + dy * dy <= 1.2) return i;
    }
    return -1;
  };
  // 2.0.111: после изменения номера двойным щелчком новые номера идут дальше от него (im.markNext)
  const nextN = () => {
    let n = im.markNext > 0 ? im.markNext : 1;
    while (im.marks.some((m) => m.n === n)) n++;
    if (im.markNext > 0) im.markNext = n + 1;
    return n;
  };
  cv.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    cv.setPointerCapture(e.pointerId);
    const p = pos(e);
    let i = hit(p);
    if (i < 0) {
      im.marks.push({ n: nextN(), x: p[0], y: p[1] });
      i = im.marks.length - 1;
    }
    sel = i;
    typed = "";
    drag = { i, dx: im.marks[i].x - p[0], dy: im.marks[i].y - p[1] };
    syncR();
    draw();
  });
  cv.addEventListener("pointermove", (e) => {
    if (!drag) {
      cv.style.cursor = hit(pos(e)) >= 0 ? "move" : "crosshair";
      return;
    }
    const p = pos(e), m = im.marks[drag.i];
    m.x = Math.max(0, Math.min(1, p[0] + drag.dx));
    m.y = Math.max(0, Math.min(1, p[1] + drag.dy));
    draw();
  });
  const up = () => drag = null;
  cv.addEventListener("pointerup", up);
  cv.addEventListener("pointercancel", up);
  cv.addEventListener("dblclick", async (e) => {
    let i = hit(pos(e));
    if (i < 0) return;
    // первый щелчок двойного мог поставить новый номер рядом — его убираем
    const last = im.marks.length - 1;
    if (i !== last && sel === last && im.marks[last] && Math.hypot(im.marks[last].x - pos(e)[0], im.marks[last].y - pos(e)[1]) < 0.01) {
      im.marks.pop();
      if (i > last) i--;
    }
    sel = i;
    drag = null;
    draw();
    const m = im.marks[i], v = await ask("Номер экрана", "Следующие новые номера пойдут дальше от него", String(m.n), "OK");
    if (v == null) return;
    const n = pint(String(v).replace(/\D+/g, ""), 0);
    if (n > 0) {
      m.n = n;
      im.markNext = n + 1;
    }
    syncR();
    draw();
  });
  // размер выбранного номера: шаг 10%, от 1% до 20% высоты картинки (в диаметре — вдвое больше)
  const sizeSel = (f) => {
    const m = im.marks[sel];
    if (!m) return;
    m.r = f === 0 ? 0 : Math.max(0.006, Math.min(0.1, markRad(im, m) * f));
    syncR();
    draw();
  };
  cv.addEventListener("wheel", (e) => {
    const i = hit(pos(e));
    if (i < 0) return;
    e.preventDefault();
    sel = i;
    sizeSel(e.deltaY < 0 ? 1.08 : 1 / 1.08);
  }, { passive: false });
  const delSel = () => {
    if (sel < 0 || !im.marks[sel]) return;
    im.marks.splice(sel, 1);
    sel = Math.min(sel, im.marks.length - 1);
    syncR();
    draw();
  };
  const key = (e) => {
    if (!$("modal").hidden) return;
    if (/^\d$/.test(e.key) && sel >= 0 && im.marks[sel]) {
      // ввод номера цифрами: «1», затем «2» в течение секунды — «12»
      typed = Date.now() - typedAt < 1e3 ? (typed + e.key).slice(-3) : e.key;
      typedAt = Date.now();
      if (+typed > 0) {
        im.marks[sel].n = +typed;
        im.markNext = +typed + 1;
      }
      draw();
      e.preventDefault();
    } else if (e.key === "+" || e.key === "=" || e.key === "-" || e.key === "_") {
      sizeSel(e.key === "+" || e.key === "=" ? 1.1 : 1 / 1.1);
      e.preventDefault();
    } else if (e.key === "Delete" || e.key === "Backspace") {
      delSel();
      e.preventDefault();
    } else if (e.key === "Escape" || e.key === "Enter") {
      e.preventDefault();
      close();
    }
    e.stopPropagation();
  };
  window.addEventListener("keydown", key, true);
  ov.querySelector("#mkMinus").onclick = () => sizeSel(1 / 1.1);
  ov.querySelector("#mkPlus").onclick = () => sizeSel(1.1);
  ov.querySelector("#mkSame").onclick = () => sizeSel(0);
  ov.querySelector("#mkR").addEventListener("input", (e) => {
    im.markR = +e.target.value / 1e3;
    syncR();
    draw();
  });
  ov.querySelector("#mkDel").onclick = delSel;
  ov.querySelector("#mkClear").onclick = () => {
    im.marks = [];
    sel = -1;
    draw();
  };
  const ro = new ResizeObserver(fit);
  ro.observe(wrap);
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    window.removeEventListener("keydown", key, true);
    ro.disconnect();
    ov.remove();
    busy("Номера впечатываются в картинку…");
    await tick();
    await bakeMarks(im);
    busy("");
    renderImgList();
    tzChanged();
    status(im.marks.length ? "Номеров на картинке: ".concat(im.marks.length) : "Номера с картинки убраны", true);
  };
  ov.querySelector("#mkDone").onclick = close;
  syncR();
  fit();
}
function tzSlides(items, withOv) {
  const groups = maskGroups(items);
  return 1 + (withOv || 0) + groups.length;
}
function updateTZSummary() {
  const items = tzItems(), nf = items.filter((i) => i.kind === "field").length, ncs = items.filter((i) => i.kind === "cutsrc").length;
  $("tSummary").textContent = "Слайдов: ".concat(tzSlides(items, imgGroups(tzImages()).length), " · масок: ").concat(items.length - nf - ncs, " · полей: ").concat(nf);
}
function tzChanged() {
  refreshTZPanel();
  requestDraw();
  scheduleAutosave();
}
$("tDefault").onclick = () => {
  project.tz.fields = {};
  project.tz.cuts = {};
  project.tz.cutSrc = {};
  project.tz.outs = {};
  delete project.tz.order;
  project.tz.masks = {};
  tzChanged();
  status("Выбор ТЗ — по умолчанию");
};
$("tOverview").onchange = (e) => {
  project.tz.overview = e.target.checked;
  tzChanged();
};
$("tSvg").onchange = (e) => {
  project.tz.svgMasks = e.target.checked;
  scheduleAutosave();
};
$("tSaveProj").onchange = (e) => {
  project.tz.projZip = e.target.checked;
  scheduleAutosave();
  updateTZNote();
};
$("tOvPick").onclick = () => $("tOvFile").click();
$("tMaskPer").addEventListener("change", (e) => {
  const v = +e.target.value || 0;
  if (ui.tzMaskWhich === "all") {
    project.tz.maskPer = v;
    const G = project.tz.maskGrid.match(/^(\d+)x(\d+)$/);
    if (G && !gridOptions(project.tz.maskPer).some((o) => o.cols === +G[1] && o.rows === +G[2])) project.tz.maskGrid = "";
  } else {
    project.tz.maskPerS = project.tz.maskPerS || {};
    if (v > 0) project.tz.maskPerS[+ui.tzMaskWhich] = v;
    else delete project.tz.maskPerS[+ui.tzMaskWhich];
  }
  tzChanged();
  scheduleHistory();
});
$("tMaskWhich").addEventListener("change", (e) => {
  ui.tzMaskWhich = e.target.value;
  refreshTZPanel();
});
// 3.0.15: что писать над маской в ТЗ
for (const k of ["res", "name", "phys", "file"]) $("tLab_" + k).addEventListener("change", (e) => {
  project.tz.lab[k] = e.target.checked;
  tzChanged();
  scheduleHistory();
});
$("tEvenSize").addEventListener("change", (e) => {
  project.tz.evenSize = e.target.checked;
  tzChanged();
  scheduleHistory();
});
$("tMaskGrid").addEventListener("change", (e) => {
  project.tz.maskGrid = e.target.value;
  tzChanged();
  scheduleHistory();
});
$("tImgPer").addEventListener("change", (e) => {
  project.tz.imgPer = +e.target.value || 0;
  tzChanged();
  scheduleHistory();
});
let ovToken = 0;
async function restoreOverview(list) {
  const tok = ++ovToken;
  for (const q of list) {
    try {
      if (!q) continue;
      let bytes = null;
      if (typeof q.jpeg === "string" && q.jpeg.startsWith("data:image/")) bytes = b64ToBytes(q.jpeg.slice(q.jpeg.indexOf(",") + 1));
      else if (typeof q.ref === "string") {
        const v = await IMGDB.get(q.ref);
        if (tok !== ovToken) return;
        if (v) bytes = v instanceof Uint8Array ? v : new Uint8Array(v);
      }
      if (!bytes || !bytes.length) {
        ui.ovMissing = (ui.ovMissing || 0) + 1;
        continue;
      }
      const blob = new Blob([bytes], { type: "image/jpeg" });
      const bmp = await loadImageFile(blob);
      if (tok !== ovToken) return;
      const w = Math.max(1, +q.w || bmp.width), h = Math.max(1, +q.h || bmp.height), cv = document.createElement("canvas");
      cv.width = w;
      cv.height = h;
      const c = cv.getContext("2d");
      c.fillStyle = "#fff";
      c.fillRect(0, 0, w, h);
      c.drawImage(bmp, 0, 0, w, h);
      const marks = Array.isArray(q.marks) ? q.marks.filter((m) => m && isFinite(+m.x) && isFinite(+m.y)).map((m) => ({ n: pint(m.n, 1), x: +m.x, y: +m.y, ...(+m.r > 0 ? { r: +m.r } : {}) })) : [];
      const im = { id: typeof q.id === "string" && q.id ? q.id : newUid(), name: String(q.name || "картинка.jpg"), caption: String(q.caption != null ? q.caption : "Общий план"), jpeg: bytes, baseJpeg: bytes, w, h, url: URL.createObjectURL(blob), img: bmp, base: cv, marks, markR: +q.markR > 0 ? +q.markR : 0.032 };
      if (marks.length) await bakeMarks(im);
      if (tok !== ovToken) return;
      if (typeof q.ref === "string" && q.ref === ovKey(bytes)) {
        im.ref = q.ref;
        im.refOk = true;
        im.refP = Promise.resolve(true);
      } else ovStore(im);
      ui.images.push(im);
    } catch (e) {
    }
  }
  if (tok !== ovToken) return;
  await Promise.all(ui.images.map((im) => im.refP));
  tzChanged();
}
function clearOverview() {
  ovToken++;
  ui.ovMissing = 0;
  for (const im of ui.images) URL.revokeObjectURL(im.url);
  ui.images = [];
}
$("tOvClear").onclick = () => {
  clearOverview();
  tzChanged();
};
$("tOvFile").addEventListener("change", async (e) => {
  const files = [...e.target.files];
  e.target.value = "";
  if (!files.length) return;
  let bad = 0;
  for (let fi = 0; fi < files.length; fi++) {
    const file = files[fi];
    busy("Подготовка картинки ".concat(fi + 1, " из ").concat(files.length, "…"));
    await tick();
    try {
      const bmp = await loadImageFile(file);
      const k = Math.min(1, 3e3 / Math.max(bmp.width, bmp.height)), w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
      const cv = document.createElement("canvas");
      cv.width = w;
      cv.height = h;
      const c = cv.getContext("2d");
      c.fillStyle = "#fff";
      c.fillRect(0, 0, w, h);
      c.drawImage(bmp, 0, 0, w, h);
      const blob = await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.9));
      const caption = ui.images.length ? file.name.replace(/\.[^.]+$/, "") : "Общий план";
      ui.images.push({ id: newUid(), name: file.name, caption, jpeg: new Uint8Array(await blob.arrayBuffer()), w, h, url: URL.createObjectURL(blob), img: bmp, base: cv, marks: [], markR: 0.032 });
      ui.images[ui.images.length - 1].baseJpeg = ui.images[ui.images.length - 1].jpeg;
      ovStore(ui.images[ui.images.length - 1]);
    } catch (err) {
      bad++;
      status("Не удалось открыть «".concat(file.name, "»: ") + err.message, true);
    }
  }
  project.tz.overview = true;
  busy("");
  tzChanged();
  if (files.length - bad > 0) status("Добавлено картинок: ".concat(files.length - bad), true);
});
async function loadImageFile(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch (e) {
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const im = new Image();
    await new Promise((res, rej) => {
      im.onload = res;
      im.onerror = () => rej(new Error("формат не поддерживается"));
      im.src = url;
    });
    return im;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 5e3);
  }
}
// тип ТЗ: Resolume / D3 / MP4 / Волюметрик (у волюметрика — подтип по длине нити: Vol2 / Vol4 / Vol3)
// подтип ТЗ «Волюметрик» — сам по модели кабинета волюметрика (2 м / 4 м / 3 м); вручную — до смены модели
function volTzAuto() {
  const cur = S(), st = cur && cur.kind === "vol" && cur.vol ? cur : project.screens.find((x) => x.kind === "vol" && x.vol && tzMaskOn(x)) || project.screens.find((x) => x.kind === "vol" && x.vol);
  return st && st.vol.model !== "custom" ? ["Vol2", "Vol4", "Vol3"][st.vol.model] || null : null;
}
function syncTzTpl() {
  if (/^Vol/.test(ui.tzTpl) && !ui.tzSubManual) {
    const a = volTzAuto();
    if (a && a !== ui.tzTpl) {
      ui.tzTpl = a;
      project.tz.tpl = a;
      setTimeout(() => {
        refreshTZText();
        requestDraw();
      }, 0);
    }
  }
  const vol = /^Vol/.test(ui.tzTpl);
  setVal($("tTpl"), vol ? "Vol" : ui.tzTpl);
  if ($("tTplSubRow").hidden !== !vol) $("tTplSubRow").hidden = !vol;
  if (vol) setVal($("tTplSub"), ui.tzTpl);
  setTxt($("tSave"), "Сохранить ТЗ ".concat(tzName(ui.tzTpl)));
  updateTZNote();
  if ($("tVolWhat").hidden !== !vol) $("tVolWhat").hidden = !vol;
  $("tVolMask").checked = project.tz.volMask === true;
  {
    const lb = $("tVolMask").closest("label");
    if (lb && lb.hidden !== !VOL_MASK_UI) lb.hidden = !VOL_MASK_UI;
  }
  $("tVolCom").checked = project.tz.volCom !== false;
  $("tVol3d").checked = project.tz.vol3d !== false;
  $("tVolInfo").checked = project.tz.volInfo !== false;
  if ($("tVolSetRow").hidden !== !vol) $("tVolSetRow").hidden = !vol;
  $("tVolMadrix").checked = adrUnlocked && project.tz.adrMadrix === true;
  $("tVolMadshow").checked = adrUnlocked && project.tz.adrMadshow === true;
  $("tVolTd").checked = adrUnlocked && project.tz.adrTd === true;
  $("tVolSetRow").classList.toggle("locked", !adrUnlocked);
}
function setTzTpl(label) {
  ui.tzTpl = TPL[label] ? label : "Resolume";
  if (!/^Vol/.test(ui.tzTpl)) ui.tzFlatTpl = ui.tzTpl;
  // 2.0.114–2.0.115: тип ТЗ (в том числе «Волюметрик» с подтипом) — в проекте, сохраняется в файл
  if (project.tz.tpl !== ui.tzTpl) {
    project.tz.tpl = ui.tzTpl;
    scheduleAutosave();
  }
  syncTzTpl();
  refreshTZPanel();
  refreshTZText();
  requestDraw();
}
for (const [id, k] of [["tVolMask", "volMask"], ["tVolCom", "volCom"], ["tVol3d", "vol3d"], ["tVolInfo", "volInfo"], ["tVolMadrix", "adrMadrix"], ["tVolMadshow", "adrMadshow"], ["tVolTd", "adrTd"]]) $(id).addEventListener("change", (e) => {
  if (/^adr/.test(k) && !adrUnlocked) {
    e.target.checked = false;
    adrLocked(() => {
      project.tz[k] = e.target.checked = true;
      updateTZNote();
      tzChanged();
    });
    return;
  }
  project.tz[k] = e.target.checked;
  updateTZNote();
  tzChanged();
});
$("tTpl").addEventListener("change", (e) => {
  if (e.target.value !== "Vol") return setTzTpl(e.target.value);
  // подтип по умолчанию — по модели первого экрана-волюметрика
  ui.tzSubManual = false;
  setTzTpl(volTzAuto() || (/^Vol/.test(ui.tzTpl) ? ui.tzTpl : "Vol2"));
});
$("tTplSub").addEventListener("change", (e) => {
  ui.tzSubManual = true;
  setTzTpl(e.target.value);
});
$("tSave").onclick = () => exportTZ(ui.tzTpl);
const bgImgs = {};
function bgImg(key2) {
  if (!bgImgs[key2] && PDF_BG[key2]) {
    const im = new Image();
    im.onload = requestDraw;
    im.src = "data:image/" + (/^(deco|logo_)/.test(key2) ? "png" : "jpeg") + ";base64," + PDF_BG[key2];
    bgImgs[key2] = im;
  }
  return bgImgs[key2] && bgImgs[key2].complete ? bgImgs[key2] : null;
}
ui.tzTpl = "Resolume";
const fieldThumbs = /* @__PURE__ */ new Map();
function fieldThumb(f) {
  const k = JSON.stringify(f) + JSON.stringify(fieldRects(f).map((r) => r.st)) + JSON.stringify(project.guides);
  const c = fieldThumbs.get(f.id);
  if (c && c.k === k) return c.cv;
  const b = fieldBBox(fieldRects(f)), s = Math.min(1, 1200 / Math.max(b.w, b.h)), cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(b.w * s));
  cv.height = Math.max(1, Math.round(b.h * s));
  paintField(cv.getContext("2d"), f, s);
  fieldThumbs.set(f.id, { k, cv });
  return cv;
}
// 2.0.117: масштаб превью ТЗ — колесо мыши / тачпад к курсору, сдвиг — перетащить пустое место, Esc — как было
ui.tzView = { z: 1, x: 0, y: 0 };
function tzLocal(e) {
  const p = local(e), V = ui.tzView;
  return [(p[0] - V.x) / V.z, (p[1] - V.y) / V.z];
}
function tzViewReset() {
  if (ui.tzView.z === 1 && !ui.tzView.x && !ui.tzView.y) return false;
  ui.tzView = { z: 1, x: 0, y: 0 };
  requestDraw();
  return true;
}
function tzViewClamp() {
  const V = ui.tzView, r = $("wrap").getBoundingClientRect();
  if (V.z <= 1) return ui.tzView = { z: 1, x: 0, y: 0 };
  V.x = Math.min(0, Math.max(r.width - r.width * V.z, V.x));
  V.y = Math.min(0, Math.max(r.height - r.height * V.z, V.y));
}
pv.addEventListener("wheel", (e) => {
  if (ui.page !== "tz") return;
  e.preventDefault();
  const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
  if (!dy) return;
  const V = ui.tzView, p = local(e), z = Math.max(1, Math.min(8, V.z * Math.max(0.5, Math.min(2, Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0018))))));
  const ux = (p[0] - V.x) / V.z, uy = (p[1] - V.y) / V.z;
  V.z = z;
  V.x = p[0] - ux * z;
  V.y = p[1] - uy * z;
  tzViewClamp();
  ui.tzHover = null;
  requestDraw();
}, { passive: false });
function drawTZ() {
  const R = prepCanvas([16, 9]), c = pctx, items = tzItems(), imgs = tzImages();
  c.translate(ui.tzView.x, ui.tzView.y);
  c.scale(ui.tzView.z, ui.tzView.z);
  ui.tzHits = [];
  ui.tzSlideHits = [];
  ui.tzImgHits = [];
  ui.tzMaskHits = [];
  const slides = [{ kind: "title" }];
  for (const { hz, g } of imgGroups(imgs)) slides.push({ kind: "ov", hz, ims: g.map((j) => imgs[j]) });
  maskGroups(items).forEach((g, mgi) => slides.push({ kind: "g", mgi, ...g }));
  const emap = evenScaleMap(maskGroups(items), items);
  // 2.0.80: «Крупно» — один лист на всё окно (двойной щелчок по листу, кнопки ◀ ▶, Esc — все листы)
  slides.forEach((sl2, i) => sl2.no = i);
  ui.tzSlideCount = slides.length;
  if (ui.tzZoom >= slides.length) ui.tzZoom = slides.length - 1;
  if (ui.tzZoom >= 0) slides.splice(0, slides.length, slides[ui.tzZoom]);
  syncTzZoomUI();
  const n = slides.length, ar = PDF_W / PDF_H, gap = 14, pad = 16, aw = R.width - pad * 2, ah = R.height - pad * 2 - 16;
  let best = { h: 0, cols: 1 };
  for (let cols2 = 1; cols2 <= n; cols2++) {
    const rows2 = Math.ceil(n / cols2), h = Math.min((ah - gap * (rows2 - 1)) / rows2, (aw - gap * (cols2 - 1)) / cols2 / ar);
    if (h > best.h) best = { h, cols: cols2 };
  }
  const sh = Math.max(40, best.h), sw = sh * ar, cols = best.cols, rows = Math.ceil(n / cols);
  const x0 = pad + (aw - (cols * sw + (cols - 1) * gap)) / 2, y0 = pad + Math.max(0, (ah - (rows * (sh + 16) + (rows - 1) * gap)) / 2);
  const k = sw / SLIDE_W;
  slides.forEach((sl, si) => {
    const x = x0 + si % cols * (sw + gap), y = y0 + Math.floor(si / cols) * (sh + gap + 16);
    const blocks = tplCache[ui.tzTpl + "@all"], ipPk = ui.tzEdit ? ui.tzEdit.pk : null, editedTitle = sl.kind === "title" && blocks && (blocks.some(reqDraw) || !!ipPk && ipPk.startsWith("req:"));
    const fullKey = PDF_BG[ui.tzTpl] ? ui.tzTpl : "Resolume";
    const bg = bgImg(sl.kind !== "title" ? bgKey("masks", ui.tzTpl) : editedTitle ? bgKey("bare", ui.tzTpl) : fullKey);
    c.fillStyle = "#fff";
    c.fillRect(x, y, sw, sh);
    if (bg) c.drawImage(bg, x, y, sw, sh);
    // 3.0.54: в фонах нет шапки, футера, рамки и логотипа продукта (в PDF/PPTX они вектором) — дорисовываем
    if (bg && typeof PDF_HEAD !== "undefined") {
      const dk = bgImg("deco"), kx = sw / PDF_HEAD.w, ky = sh / PDF_HEAD.h, tk = PDF_HEAD.fcol[ui.tzTpl] ? ui.tzTpl : "Resolume";
      if (dk) c.drawImage(dk, x, y, sw, sh);
      const fc = PDF_HEAD.fcol[tk][sl.kind === "title" ? 0 : 1].split(" ").map((v) => Math.round(+v * 255));
      c.fillStyle = "rgb(".concat(fc.join(","), ")");
      c.fillRect(x, y, PDF_HEAD.fx * kx, sh);
      c.fillRect(x, y + PDF_HEAD.fy * ky, sw, sh - PDF_HEAD.fy * ky);
      const lg = sl.kind === "title" && PDF_HEAD.logo[ui.tzTpl], li = lg && bgImg("logo_" + ui.tzTpl);
      if (li) c.drawImage(li, x + lg.rect[0] * kx, y + lg.rect[1] * ky, lg.rect[2] * kx, lg.rect[3] * ky);
    }
    const kp = k * PT;
    if (sl.kind === "title" && blocks) {
      const full = editedTitle ? bgImg(fullKey) : null, clips = PDF_CLIPS[ui.tzTpl] || [], selBlock = isReqSel(ui.tzSel) ? selBk() : null;
      for (const info of blocks) {
        const r = reqRect(info), tx = x + (r.x + info.ins.l) * k, ty = y + (r.y + info.ins.t) * k, tw = (r.w - 2 * info.ins.l) / PT;
        const ip = ipPk === "req:" + info.label, ed = reqDraw(info);
        let th = Math.max(r.h * k, reqTextFit(info, reqParas(info, reqTextOr(info)), tw).h * kp);
        c.save();
        c.beginPath();
        if (ip) ; // правится на листе — текст показывает редактор поверх
        else if (ed) {
          c.rect(x, y, sw, sh);
          c.clip();
          th = rtPaint(c, reqParas(info, reqTextOr(info)), tx, ty, tw, kp, info.baseSz, info.baseColor, reqCols(info)).h * kp;
        } else if (full) {
          const cr = clips[info.idx] || [info.rect.x, info.rect.y, info.rect.w, info.rect.h];
          c.rect(x + cr[0] * k, y + cr[1] * k, cr[2] * k, cr[3] * k);
          c.clip();
          c.drawImage(full, x, y, sw, sh);
        }
        c.restore();
        if (info.label === selBlock && !ip) {
          c.strokeStyle = "rgba(30,200,180,.85)";
          c.lineWidth = 1.5;
          c.strokeRect(tx - 3, ty - 2, tw * kp + 6, th + 4);
        }
        ui.tzHits.push({ pk: "req:" + info.label, x: tx, y: ty, w: tw * kp, h: th, k, ex: r.x, ey: r.y, sx: x, sy: y, sw, sh });
      }
    }
    let NL = { box: BOX, note: null };
    if (sl.kind === "ov") NL = noteLayout(noteText(imgKey(sl.ims[0])), imgKey(sl.ims[0]));
    if (sl.kind === "g") NL = noteLayout(noteText(noteKey(sl.g.map((i) => items[i]))), noteKey(sl.g.map((i) => items[i])));
    const drawNote = () => {
      if (!NL.note) return;
      const [nx, ny, nw, nh] = NL.note.rect;
      const key2 = sl.kind === "ov" ? imgKey(sl.ims[0]) : noteKey(sl.g.map((i) => items[i]));
      if (ipPk !== "note:" + key2) {
        c.save();
        c.beginPath();
        c.rect(x, y, sw, sh);
        c.clip();
        rtPaint(c, NL.note.paras, x + nx * k, y + ny * k, nw / PT, kp, NL.note.sz, "#222");
        c.restore();
      }
      ui.tzHits.push({ pk: "note:" + key2, x: x + nx * k, y: y + ny * k, w: nw * k, h: nh * k, k, ex: nx, ey: ny, sx: x, sy: y, sw, sh });
    };
    const cell = (lay, img, text) => {
      const [lx, ly, lw, lh] = lay.label, [ix, iy, iw, ih] = lay.image;
      if (img) c.drawImage(img, x + ix * k, y + iy * k, iw * k, ih * k);
      c.fillStyle = "#222";
      c.font = "".concat(Math.max(3, labelPt(text, lw) * 12700 * k), 'px "LMG Sans", Arial, sans-serif');
      c.textAlign = "center";
      c.textBaseline = "middle";
      if (text) c.fillText(text, x + (lx + lw / 2) * k, y + (ly + lh / 2) * k, lw * k);
      c.textAlign = "left";
      c.textBaseline = "alphabetic";
    };
    // 3.0.55: на листе «Крупно» маски можно расставлять (перетаскивание, размер за углы)
    const mhit = (key2, lay, mw, mh, B, es) => {
      if (ui.tzZoom < 0) return;
      const [ix, iy, iw, ih] = lay.image;
      ui.tzMaskHits.push({ key: key2, x: x + ix * k, y: y + iy * k, w: iw * k, h: ih * k, k, ex: ix, ey: iy, ew: iw, eh: ih, mw, mh, sx: x, sy: y, lab: lay.label, B, es: es || 0, placed: !!(project.tz.mpos && project.tz.mpos[key2]) });
    };
    if (sl.kind === "ov") sl.ims.forEach((im, j) => {
      const lay = tzPlace(maskCellLayout(sl.hz, sl.ims.length, j, im.w, im.h, NL.box, null, !!NL.note), imgKey(im), im.w, im.h), [ix, iy, iw, ih] = lay.image;
      cell(lay, im.img, im.caption || "");
      ui.tzImgHits.push({ x: x + ix * k, y: y + iy * k, w: iw * k, h: ih * k, im });
      mhit(imgKey(im), lay, im.w, im.h, NL.box);
    });
    if (sl.kind === "g") sl.g.forEach((mi, j) => {
      const it = items[mi];
      const lay = tzPlace(maskCellLayout(sl.hz, sl.g.length, j, it.w, it.h, tzLabBox(NL.box), it.info, !!NL.note, evenSc(emap, it)), it.key, it.w, it.h);
      mhit(it.key, lay, it.w, it.h, tzLabBox(NL.box), evenSc(emap, it));
      if (lay.info) {
        const [tx, ty, tw, th] = lay.info;
        infoPaint(c, infoFit(it.info, tw, th), x + tx * k, y + ty * k, k * PT);
      }
      cell(lay, it.kind === "out" ? outThumb(it.m, it.scr) : it.kind === "cut" ? cutThumb(it.c) : it.kind === "cutsrc" ? cutSrcThumb(it.c) : it.kind === "field" ? fieldThumb(it.f) : it.kind === "volcom" || it.kind === "vol3d" ? volItemThumb(it) : thumb({ uid: it.st.uid, st: it.st, w0: it.w, h0: it.h }), it.label);
    });
    drawNote();
    const skey = sl.kind === "title" ? "req" : sl.kind === "ov" ? imgKey(sl.ims[0]) : noteKey(sl.g.map((i) => items[i]));
    ui.tzSlideHits.push({ x, y, w: sw, h: sh, key: skey, no: sl.no, mgi: sl.kind === "g" ? sl.mgi : null });
    if (sl.kind === "title" ? isReqSel(ui.tzSel) : skey === ui.tzSel) {
      c.strokeStyle = "#1ec8b4";
      c.lineWidth = 3;
      c.strokeRect(x - 1.5, y - 1.5, sw + 3, sh + 3);
    } else {
      c.strokeStyle = "#2b3946";
      c.lineWidth = 1;
      c.strokeRect(x + 0.5, y + 0.5, sw - 1, sh - 1);
    }
    c.fillStyle = "#8c9bab";
    c.font = "11px ".concat(FONT);
    c.textAlign = "center";
    c.fillText(sl.kind === "title" ? "1 · шаблон ".concat(tzName(ui.tzTpl)) : sl.kind === "ov" ? "".concat(sl.no + 1, " · ").concat(sl.ims.length > 1 ? "картинки" : "картинка") : "".concat(sl.no + 1), x + sw / 2, y + sh + 13);
    c.textAlign = "left";
  });
  if (!items.length) {
    c.fillStyle = "#ffb020";
    c.font = "13px ".concat(FONT);
    c.fillText("В ТЗ ничего не отмечено", pad, R.height - 10);
  }
  tzMaskOverlay(c);
  for (const k2 of [...ui.tzMSel]) if (!ui.tzMaskHits.some((q) => q.key === k2)) ui.tzMSel.delete(k2);
  if (ui.tzMaskSel && !ui.tzMSel.has(ui.tzMaskSel)) ui.tzMSel.add(ui.tzMaskSel);
  const sb = $("tZoomSame");
  if (sb) sb.hidden = !(ui.tzZoom >= 0 && ui.tzMSel.size >= 2);
  const rb = $("tZoomReset");
  if (rb) rb.hidden = !(ui.tzZoom >= 0 && ui.tzMaskHits.some((q) => q.placed));
  const hv = ui.tzDrag ? ui.tzDrag.hit : ui.tzHover;
  if (ui.tzEdit) tzIpPlace();
  if (hv && !(ui.tzEdit && hv.pk === ui.tzEdit.pk)) {
    // 3.0.29: рамка — только по блоку из текущей раскладки (раньше при сдвиге макета рисовалась старая рамка мимо текста)
    const same = ui.tzHits.filter((q) => q.pk === hv.pk);
    const h = same.find((q) => q.sx === hv.sx && q.sy === hv.sy) || (same.length === 1 ? same[0] : null);
    if (h) {
    c.save();
    c.setLineDash([4, 3]);
    c.strokeStyle = "#1ec8b4";
    c.lineWidth = 1.2;
    c.strokeRect(h.x - 3, h.y - 2, h.w + 6, h.h + 4);
    c.restore();
    if (!ui.tzDrag) ui.tzHover = h;
    } else if (!ui.tzDrag) ui.tzHover = null;
  }
}
ui.tzHits = [];
ui.tzSlideHits = [];
ui.tzZoom = -1;
ui.tzSlideCount = 0;
function syncTzZoomUI() {
  const z = ui.tzZoom >= 0, n = ui.tzSlideCount || 0;
  setTxt($("tZoom"), z ? "Все листы" : "Крупно");
  $("tZoom").setAttribute("aria-pressed", String(z));
  $("tZoomPrev").hidden = $("tZoomNext").hidden = !z;
  $("tZoomPrev").disabled = !z || ui.tzZoom <= 0;
  $("tZoomNext").disabled = !z || ui.tzZoom >= n - 1;
  setTxt($("tZoomNo"), z ? "лист ".concat(ui.tzZoom + 1, " из ").concat(n) : "");
  if (typeof syncTzAssist === "function") syncTzAssist();
}
function tzZoomTo(i) {
  ui.tzZoom = i;
  ui.tzMaskSel = ui.tzMaskHover = null;
  ui.tzMSel = new Set();
  ui.tzView = { z: 1, x: 0, y: 0 };
  ui.tzHover = null;
  requestDraw();
}
$("tZoom").onclick = () => {
  if (ui.tzZoom >= 0) return tzZoomTo(-1);
  // какой лист открыть: где выбран текст, иначе первый
  const h = ui.tzSlideHits.find((q) => q.key === ui.tzSel || q.key === "req" && isReqSel(ui.tzSel));
  tzZoomTo(h ? h.no : 0);
};
$("tZoomPrev").onclick = () => ui.tzZoom > 0 && tzZoomTo(ui.tzZoom - 1);
function syncTzAssist() {
  const b = $("tZoomAssist");
  if (!b) return;
  b.setAttribute("aria-pressed", String(!!ui.tzAssist));
  b.hidden = ui.tzZoom < 0;
}
if ($("tZoomAssist")) $("tZoomAssist").onclick = () => {
  ui.tzAssist = !ui.tzAssist;
  try {
    localStorage.setItem("ledmask.tzAssist", ui.tzAssist ? "1" : "0");
  } catch (e) {}
  syncTzAssist();
  if (typeof status === "function") status(ui.tzAssist ? "Помощник расстановки включён: маски выстраиваются рядами, ровно и симметрично" : "Помощник выключен: маски ставятся свободно", true);
};
if ($("tZoomSame")) $("tZoomSame").onclick = tzSameSize;
if ($("tZoomReset")) $("tZoomReset").onclick = () => {
  // 3.0.55: маски этого листа — обратно на автоматические места
  const keys = ui.tzMaskHits.filter((q) => q.placed).map((q) => q.key);
  if (!keys.length || !project.tz.mpos) return;
  for (const k2 of keys) delete project.tz.mpos[k2];
  ui.tzMaskSel = null;
  requestDraw();
  scheduleAutosave();
  scheduleHistory();
};
$("tZoomNext").onclick = () => ui.tzZoom < ui.tzSlideCount - 1 && tzZoomTo(ui.tzZoom + 1);
window.addEventListener("keydown", (e) => {
  if (ui.page !== "tz") return;
  if (ui.tzZoom < 0) {
    const t0 = e.target;
    if (e.key === "Escape" && !(t0 && (/^(INPUT|TEXTAREA|SELECT)$/.test(t0.tagName) || t0.isContentEditable)) && $("modal").hidden) tzViewReset();
    return;
  }
  const t = e.target;
  if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
  // 3.0.57: маски на листе — Ctrl/Cmd+A все, Esc снять выделение, стрелки — сдвиг (Shift — крупнее)
  if ((e.ctrlKey || e.metaKey) && (e.key === "a" || e.key === "A" || e.code === "KeyA") && ui.tzMaskHits.length && !ui.tzEdit) {
    tzSetSel(ui.tzMaskHits.map((q) => q.key), ui.tzMaskSel || ui.tzMaskHits[0].key);
    requestDraw();
    e.preventDefault();
    return;
  }
  if (ui.tzMSel.size && !ui.tzEdit) {
    const st = SLIDE_W * (e.shiftKey ? 0.02 : 0.002), mv = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] }[e.key];
    if (e.key === "Escape") {
      tzSetSel([]);
      requestDraw();
      e.preventDefault();
      return;
    }
    if (mv) {
      project.tz.mpos = project.tz.mpos || {};
      for (const q of ui.tzMaskHits) if (ui.tzMSel.has(q.key)) project.tz.mpos[q.key] = { x: Math.round(Math.max(0, Math.min(SLIDE_W - q.ew, q.ex + mv[0]))), y: Math.round(Math.max(tzLabOff(q), Math.min(SLIDE_H - q.eh, q.ey + mv[1]))), w: q.ew };
      requestDraw();
      scheduleAutosave();
      scheduleHistory();
      e.preventDefault();
      return;
    }
  }
  if (e.key === "Escape") {
    if (!tzViewReset()) tzZoomTo(-1);
  } else if (e.key === "ArrowLeft") $("tZoomPrev").click();
  else if (e.key === "ArrowRight") $("tZoomNext").click();
  else return;
  e.preventDefault();
});
ui.tzHover = null;
ui.tzDrag = null;
const pkKey = (pk) => pk.startsWith("req:") ? "req" + (pk.includes("#") ? pk.slice(pk.indexOf("#")) : "") : pk.slice(5);
const tzHitAt = (p) => {
  for (let i = ui.tzHits.length - 1; i >= 0; i--) {
    const h = ui.tzHits[i];
    if (p[0] >= h.x - 4 && p[0] <= h.x + h.w + 4 && p[1] >= h.y - 4 && p[1] <= h.y + h.h + 4) return h;
  }
  return null;
};
// ---- 3.0.55: расстановка масок на листе «Крупно» ----
ui.tzMaskHits = [];
ui.tzMaskSel = null; // основная (по ней — маркеры углов и образец размера)
ui.tzMSel = new Set(); // 3.0.57: выделенные маски
ui.tzMarq = null;
ui.tzMaskHover = null;
ui.tzMDrag = null;
ui.tzSnap = null;
const TZ_HANDLE = () => matchMedia("(pointer: coarse)").matches ? 14 : 8;
function tzMaskHitAt(p) {
  if (ui.tzZoom < 0) return null;
  const hs = TZ_HANDLE(), sel = ui.tzMaskHits.find((q) => q.key === ui.tzMaskSel);
  if (sel) {
    for (const [cn, cx, cy] of [["nw", sel.x, sel.y], ["ne", sel.x + sel.w, sel.y], ["sw", sel.x, sel.y + sel.h], ["se", sel.x + sel.w, sel.y + sel.h]]) {
      if (Math.abs(p[0] - cx) <= hs && Math.abs(p[1] - cy) <= hs) return { hit: sel, corner: cn };
    }
  }
  for (let i = ui.tzMaskHits.length - 1; i >= 0; i--) {
    const q = ui.tzMaskHits[i];
    if (p[0] >= q.x && p[0] <= q.x + q.w && p[1] >= q.y && p[1] <= q.y + q.h) return { hit: q, corner: null };
  }
  return null;
}
function tzMaskOverlay(c) {
  if (ui.tzZoom < 0) return;
  const hs = TZ_HANDLE();
  for (const q of ui.tzMaskHits) {
    const main = q.key === ui.tzMaskSel, sel = main || ui.tzMSel.has(q.key), hov = ui.tzMaskHover && q.key === ui.tzMaskHover;
    if (!sel && !hov) continue;
    c.save();
    c.strokeStyle = "#1ec8b4";
    c.lineWidth = sel ? 1.6 : 1.2;
    if (!sel) c.setLineDash([4, 3]);
    c.strokeRect(q.x - 0.5, q.y - 0.5, q.w + 1, q.h + 1);
    if (sel && !main) c.fillStyle = "rgba(30,200,180,.10)", c.fillRect(q.x, q.y, q.w, q.h);
    if (main) {
      c.setLineDash([]);
      c.fillStyle = "#fff";
      for (const [cx, cy] of [[q.x, q.y], [q.x + q.w, q.y], [q.x, q.y + q.h], [q.x + q.w, q.y + q.h]]) {
        c.fillRect(cx - hs / 2, cy - hs / 2, hs, hs);
        c.strokeRect(cx - hs / 2, cy - hs / 2, hs, hs);
      }
    }
    c.restore();
  }
  if (ui.tzMarq) {
    const m = ui.tzMarq;
    c.save();
    c.fillStyle = "rgba(30,200,180,.10)";
    c.strokeStyle = "#1ec8b4";
    c.setLineDash([4, 3]);
    c.lineWidth = 1;
    c.fillRect(Math.min(m.x0, m.x1), Math.min(m.y0, m.y1), Math.abs(m.x1 - m.x0), Math.abs(m.y1 - m.y0));
    c.strokeRect(Math.min(m.x0, m.x1), Math.min(m.y0, m.y1), Math.abs(m.x1 - m.x0), Math.abs(m.y1 - m.y0));
    c.restore();
  }
  if (ui.tzMDrag && ui.tzMDrag.slot && ui.tzMDrag.moved && !ui.tzMDrag.corner) {
    const q = ui.tzMaskHits.find((h) => h.key === ui.tzMDrag.key), sl = ui.tzMDrag.slot;
    if (q) {
      const ar = q.eh / Math.max(1, q.ew);
      c.save();
      c.fillStyle = "rgba(30,200,180,.14)";
      c.strokeStyle = "rgba(30,200,180,.9)";
      c.setLineDash([5, 4]);
      c.lineWidth = 1.5;
      c.fillRect(q.sx + sl.x * q.k, q.sy + sl.y * q.k, sl.w * q.k, sl.w * ar * q.k);
      c.strokeRect(q.sx + sl.x * q.k, q.sy + sl.y * q.k, sl.w * q.k, sl.w * ar * q.k);
      c.restore();
    }
  }
  if (ui.tzSnap && ui.tzMDrag) {
    const q = ui.tzMaskHits.find((h) => h.key === ui.tzMDrag.key);
    if (q) {
      c.save();
      c.strokeStyle = "rgba(255,80,160,.9)";
      c.lineWidth = 1;
      c.setLineDash([3, 3]);
      const sh = PDF_H / PDF_W;
      void sh;
      const sw = SLIDE_W * q.k, shh = SLIDE_H * q.k;
      for (const vx of ui.tzSnap.x) { c.beginPath(); c.moveTo(q.sx + vx * q.k, q.sy); c.lineTo(q.sx + vx * q.k, q.sy + shh); c.stroke(); }
      for (const vy of ui.tzSnap.y) { c.beginPath(); c.moveTo(q.sx, q.sy + vy * q.k); c.lineTo(q.sx + sw, q.sy + vy * q.k); c.stroke(); }
      c.restore();
    }
  }
}
// ---- 3.0.56: помощник расстановки — ряды, одинаковая высота в ряду, ровные промежутки, по центру ----
ui.tzAssist = (() => {
  try {
    return localStorage.getItem("ledmask.tzAssist") !== "0";
  } catch (e) {
    return true;
  }
})();
const tzLabOff = (q) => q.lab ? q.ey - q.lab[1] : 0; // от верха подписи до верха картинки
function tzRowsOf(list) {
  // ряды по вертикальному перекрытию (≥ 40% меньшей высоты), внутри ряда — слева направо
  const it = list.slice().sort((a, b) => a.y + a.h / 2 - (b.y + b.h / 2)), rows = [];
  for (const q of it) {
    const r = rows[rows.length - 1];
    if (r) {
      const top = Math.max(r.top, q.y), bot = Math.min(r.bot, q.y + q.h);
      if (bot - top >= 0.4 * Math.min(q.h, r.minH)) {
        r.items.push(q);
        r.top = Math.min(r.top, q.y);
        r.bot = Math.max(r.bot, q.y + q.h);
        r.minH = Math.min(r.minH, q.h);
        continue;
      }
    }
    rows.push({ items: [q], top: q.y, bot: q.y + q.h, minH: q.h });
  }
  for (const r of rows) r.items.sort((a, b) => a.x + a.w / 2 - (b.x + b.w / 2));
  return rows;
}
// раскладка рядов в рамке B: ряд — во всю ширину, ровные промежутки, всё по центру.
// r.fix — заданная высота ряда (тянули за угол / ряд не трогали). «Одинаковые маски — одного размера»:
// маски одного разрешения получают общий (наименьший) масштаб, в том числе с учётом других слайдов (q.es).
function tzArrange(rows, B, force) {
  const res = {}, even = project.tz.evenSize !== false;
  const pxW = (q) => q.mw > 0 ? q.mw : q.ar * 1000, pxH = (q) => q.mh > 0 ? q.mh : 1000;
  for (const r of rows) {
    const sa = r.items.reduce((s2, q) => s2 + q.ar, 0), fitH = (B.w - GAP * (r.items.length - 1)) / Math.max(1e-6, sa);
    const h = r.fix != null ? Math.min(fitH, r.fix) : fitH;
    for (const q of r.items) q.sc = h / pxH(q); // EMU на пиксель маски
  }
  if (even) {
    const grp = {};
    for (const r of rows) for (const q of r.items) {
      const k2 = pxW(q) + "x" + pxH(q);
      grp[k2] = Math.min(grp[k2] == null ? Infinity : grp[k2], q.sc, q.es > 0 ? q.es : Infinity);
    }
    // тянули угол: размер этой маски — общий для всех масок её разрешения
    if (force) grp[force.k] = force.sc;
    for (const r of rows) for (const q of r.items) q.sc = grp[pxW(q) + "x" + pxH(q)];
  }
  // ряд не шире поля
  for (const r of rows) {
    const rw = r.items.reduce((s2, q) => s2 + pxW(q) * q.sc, 0) + GAP * (r.items.length - 1);
    if (rw > B.w) for (const q of r.items) q.sc *= (B.w - GAP * (r.items.length - 1)) / Math.max(1, rw - GAP * (r.items.length - 1));
  }
  const rowH = (r) => Math.max(...r.items.map((q) => pxH(q) * q.sc)), rowL = (r) => Math.max(...r.items.map((q) => q.lab));
  const need = rows.reduce((s2, r) => s2 + rowH(r) + rowL(r), 0) + GAP * (rows.length - 1);
  const room = B.h - GAP * (rows.length - 1) - rows.reduce((s2, r) => s2 + rowL(r), 0);
  const k = need > B.h ? room / Math.max(1, rows.reduce((s2, r) => s2 + rowH(r), 0)) : 1;
  // 3.0.57: по высоте ряды стоят там, куда их поставили (центр — только по ширине листа и внутри ряда);
  // наезжают — нижний ряд отодвигается вниз на промежуток; не влезают — подтягиваются вверх
  // по высоте можно от шапки до строки контактов (шире рабочего поля шаблона)
  const Y0 = Math.min(B.y, 1.8e6), Y1 = Math.max(B.y + B.h, 10.15e6);
  const full = rows.map((r) => rowH(r) * k + rowL(r)), tops = rows.map((r, i) => Math.max(Y0, Math.min(Y1 - full[i], (r.top != null ? r.top : B.y + rowL(r)) - rowL(r))));
  for (let i = 1; i < rows.length; i++) tops[i] = Math.max(tops[i], tops[i - 1] + full[i - 1] + GAP);
  if (rows.length) {
    tops[rows.length - 1] = Math.min(tops[rows.length - 1], Y1 - full[rows.length - 1]);
    for (let i = rows.length - 2; i >= 0; i--) tops[i] = Math.min(tops[i], tops[i + 1] - GAP - full[i]);
    if (tops[0] < Y0) {
      let y = Y0;
      rows.forEach((r, i) => { tops[i] = y; y += full[i] + GAP; });
    }
  }
  rows.forEach((r, ri) => {
    const H = rowH(r) * k, ws = r.items.map((q) => pxW(q) * q.sc * k), rw = ws.reduce((s2, v) => s2 + v, 0) + GAP * (r.items.length - 1);
    let x = B.x + (B.w - rw) / 2;
    const iy = tops[ri] + rowL(r);
    r.items.forEach((q, j2) => {
      // разная высота в ряду — по центру ряда
      const h = pxH(q) * q.sc * k;
      res[q.key] = { x: Math.round(x), y: Math.round(iy + (H - h) / 2), w: Math.round(ws[j2]) };
      x += ws[j2] + GAP;
    });
  });
  return res;
}
function tzAssistDrag(d, x, y, w) {
  // d.snap — маски листа на начало перетаскивания (без перетаскиваемой), в EMU
  const q = d.hit, ar = q.mh > 0 && q.mw > 0 ? q.mw / q.mh : q.ew / Math.max(1, q.eh), me = { key: q.key, x, y, w, h: w / ar, ar, lab: tzLabOff(q), mw: q.mw, mh: q.mh, es: q.es || 0 };
  const rows = tzRowsOf(d.snap.map((o) => ({ ...o })));
  // ряды, которых перестановка не касается, сохраняют свою высоту (их могли подогнать за угол)
  for (const r of rows) if (!r.items.some((o) => d.srcKeys && d.srcKeys.has(o.key))) r.fix = r.items.reduce((s2, o) => s2 + o.h, 0) / r.items.length;
  const touch = (row) => { delete row.fix; };
  if (d.corner) {
    // тянули угол: высота ряда этой маски = её новая высота
    let row = rows.find((r) => r.top <= y + me.h / 2 && r.bot >= y + me.h / 2);
    if (!row) {
      row = { items: [], top: y, bot: y + me.h, minH: me.h };
      rows.push(row);
      rows.sort((a, b) => (a.top + a.bot) / 2 - (b.top + b.bot) / 2);
    }
    row.items.push(me);
    row.items.sort((a, b) => a.x + a.w / 2 - (b.x + b.w / 2));
    row.fix = me.h;
  } else {
    const cy = y + me.h / 2, cx = x + w / 2;
    let row = rows.find((r) => cy >= r.top && cy <= r.bot);
    if (row) {
      touch(row);
      row.items.push(me);
      row.items.sort((a, b) => (a === me ? cx : a.x + a.w / 2) - (b === me ? cx : b.x + b.w / 2));
    } else {
      rows.push({ items: [me], top: y, bot: y + me.h, minH: me.h });
      rows.sort((a, b) => (a.top + a.bot) / 2 - (b.top + b.bot) / 2);
    }
    // ряд, где маска стояла раньше, сохраняет заданную высоту (если её задавали), остальные — во всю ширину
  }
  const pw = q.mw > 0 ? q.mw : ar * 1000, ph = q.mh > 0 ? q.mh : 1000;
  const pos = tzArrange(rows.filter((r) => r.items.length), q.B || BOX, d.corner ? { k: pw + "x" + ph, sc: me.h / ph } : null);
  project.tz.mpos = project.tz.mpos || {};
  for (const k2 of Object.keys(pos)) if (k2 !== q.key) project.tz.mpos[k2] = pos[k2];
  d.slot = pos[q.key];
  // во время перетаскивания маска идёт за мышью (размером своего будущего места); угол — сразу на месте
  project.tz.mpos[q.key] = d.corner ? d.slot : { x: Math.round(x + w / 2 - d.slot.w / 2), y: Math.round(y), w: d.slot.w };
  ui.tzAssistRows = rows.length;
}
// ---- 3.0.57: несколько масок — вместе двигать, масштабировать, «Одного размера» ----
const tzMItem = (o) => ({ key: o.key, x: o.ex, y: o.ey, w: o.ew, h: o.eh, ar: o.mh > 0 && o.mw > 0 ? o.mw / o.mh : o.ew / Math.max(1, o.eh), lab: tzLabOff(o), mw: o.mw, mh: o.mh, es: o.es || 0 });
function tzSetSel(keys, main) {
  ui.tzMSel = new Set(keys);
  ui.tzMaskSel = main != null ? main : keys.length ? keys[keys.length - 1] : null;
}
function tzGroupDrag(p, shift) {
  const d = ui.tzMDrag, k = d.hit.k, G = d.group;
  const dx = (p[0] - d.px) / k, dy = (p[1] - d.py) / k, thr = 6 / k;
  project.tz.mpos = project.tz.mpos || {};
  ui.tzSnap = { x: [], y: [] };
  if (d.corner) {
    // угол основной маски — все выделенные в той же пропорции (каждая от своего левого верха)
    const m = G.find((o) => o.key === d.key), ax = d.corner[1] === "w" ? m.x + m.w : m.x;
    const px = (d.corner[1] === "w" ? m.x : m.x + m.w) + dx, py = (d.corner[0] === "n" ? m.y : m.y + m.h) + dy, ay = d.corner[0] === "n" ? m.y + m.h : m.y;
    const nw = Math.max(SLIDE_W * 0.04, Math.max(Math.abs(px - ax), Math.abs(py - ay) * m.w / m.h)), f = nw / m.w;
    for (const o of G) {
      const w = Math.min(SLIDE_W, o.w * f), h = o.h * f;
      let x = o.key === d.key && d.corner[1] === "w" ? ax - w : o.x, y = o.key === d.key && d.corner[0] === "n" ? ay - h : o.y;
      x = Math.max(0, Math.min(SLIDE_W - w, x));
      y = Math.max(o.lab, Math.min(SLIDE_H - h, y));
      project.tz.mpos[o.key] = { x: Math.round(x), y: Math.round(y), w: Math.round(w) };
    }
    return;
  }
  // рамка группы
  const L = Math.min(...G.map((o) => o.x)), R = Math.max(...G.map((o) => o.x + o.w)), T = Math.min(...G.map((o) => o.y - o.lab)), Bm = Math.max(...G.map((o) => o.y + o.h));
  let mx = dx, my = dy;
  if (!shift) {
    const others = ui.tzMaskHits.filter((o) => !ui.tzMSel.has(o.key));
    const tx = [SLIDE_W / 2, BOX.x, BOX.x + BOX.w], ty = [];
    for (const o of others) {
      tx.push(o.ex, o.ex + o.ew / 2, o.ex + o.ew);
      ty.push(o.ey, o.ey + o.eh / 2, o.ey + o.eh);
    }
    const best = (vals, ts) => {
      let b = null;
      for (const v of vals) for (const t of ts) if (Math.abs(t - v) < thr && (!b || Math.abs(t - v) < Math.abs(b.d))) b = { d: t - v, t };
      return b;
    };
    const sx = best([L + mx, (L + R) / 2 + mx, R + mx], tx), sy = best([T + my, (T + Bm) / 2 + my, Bm + my], ty);
    if (sx) { mx += sx.d; ui.tzSnap.x.push(sx.t); }
    if (sy) { my += sy.d; ui.tzSnap.y.push(sy.t); }
  }
  mx = Math.max(-L, Math.min(SLIDE_W - R, mx));
  my = Math.max(-T, Math.min(SLIDE_H - Bm, my));
  for (const o of G) project.tz.mpos[o.key] = { x: Math.round(o.x + mx), y: Math.round(o.y + my), w: Math.round(o.w) };
}
function tzSameSize() {
  const sel = ui.tzMaskHits.filter((q) => ui.tzMSel.has(q.key)), ref = sel.find((q) => q.key === ui.tzMaskSel) || sel[0];
  if (!ref || sel.length < 2) return;
  const arOf = (q) => q.ew / Math.max(1, q.eh), same = sel.every((q) => Math.abs(arOf(q) - arOf(ref)) / arOf(ref) < 0.01);
  project.tz.mpos = project.tz.mpos || {};
  const items = ui.tzMaskHits.map(tzMItem);
  for (const it of items) {
    if (!ui.tzMSel.has(it.key) || it.key === ref.key) continue;
    // одинаковые пропорции — одна ширина; разные — одна высота
    const w = same ? ref.ew : ref.eh * it.w / Math.max(1, it.h), h = w * it.h / Math.max(1, it.w);
    it.x = Math.max(0, Math.min(SLIDE_W - w, it.x + it.w / 2 - w / 2));
    it.y = Math.max(it.lab, Math.min(SLIDE_H - h, it.y + it.h / 2 - h / 2));
    it.w = w;
    it.h = h;
  }
  if (ui.tzAssist) {
    // помощник: ряды с новыми размерами — ровно, с промежутками, по центру
    const rows = tzRowsOf(items);
    for (const r of rows) r.fix = Math.max(...r.items.map((o) => o.h));
    const pos = tzArrange(rows, ref.B || BOX);
    for (const k2 of Object.keys(pos)) project.tz.mpos[k2] = pos[k2];
  } else for (const it of items) if (ui.tzMSel.has(it.key)) project.tz.mpos[it.key] = { x: Math.round(it.x), y: Math.round(it.y), w: Math.round(it.w) };
  requestDraw();
  scheduleAutosave();
  scheduleHistory();
}
function tzMaskDrag(p, shift) {
  const d = ui.tzMDrag, q = d.hit, k = q.k, ar = q.mh > 0 && q.mw > 0 ? q.mh / q.mw : d.h0 / d.w0;
  const dx = (p[0] - d.px) / k, dy = (p[1] - d.py) / k, thr = 6 / k, minW = Math.round(SLIDE_W * 0.04);
  const others = ui.tzMaskHits.filter((h) => h.key !== q.key && h.sx === q.sx && h.sy === q.sy);
  const tx = [SLIDE_W / 2, BOX.x, BOX.x + BOX.w], ty = [];
  for (const o of others) {
    tx.push(o.ex, o.ex + o.ew / 2, o.ex + o.ew);
    ty.push(o.ey, o.ey + o.eh / 2, o.ey + o.eh);
  }
  const snap = (vals, targets) => {
    let best = null;
    for (const [v, off] of vals) for (const t of targets) if (Math.abs(t - v) < thr && (!best || Math.abs(t - v) < Math.abs(best.d))) best = { d: t - v, t, off };
    return best;
  };
  let x, y, w;
  ui.tzSnap = { x: [], y: [] };
  if (!d.corner) {
    x = d.x0 + dx;
    y = d.y0 + dy;
    w = d.w0;
    const h = w * ar;
    if (!shift) {
      const sx = snap([[x, 0], [x + w / 2, 0], [x + w, 0]], tx), sy = snap([[y, 0], [y + h / 2, 0], [y + h, 0]], ty);
      if (sx) { x += sx.d; ui.tzSnap.x.push(sx.t); }
      if (sy) { y += sy.d; ui.tzSnap.y.push(sy.t); }
    }
  } else {
    // угол тянем, противоположный стоит на месте; пропорции маски сохраняются
    const ax = d.corner[1] === "w" ? d.x0 + d.w0 : d.x0, ay = d.corner[0] === "n" ? d.y0 + d.h0 : d.y0;
    const px = (d.corner[1] === "w" ? d.x0 : d.x0 + d.w0) + dx, py = (d.corner[0] === "n" ? d.y0 : d.y0 + d.h0) + dy;
    w = Math.max(minW, Math.max(Math.abs(px - ax), Math.abs(py - ay) / ar));
    if (!shift) {
      const ex = d.corner[1] === "w" ? ax - w : ax + w, s = snap([[ex, 0]], tx);
      if (s) { w = Math.max(minW, Math.abs(s.t - ax)); ui.tzSnap.x.push(s.t); }
    }
    w = Math.min(w, SLIDE_W);
    x = d.corner[1] === "w" ? ax - w : ax;
    y = d.corner[0] === "n" ? ay - w * ar : ay;
  }
  const h = w * ar, lab = q.lab ? q.lab[3] + Math.max(0, q.ey - (q.lab[1] + q.lab[3])) : 0;
  x = Math.max(0, Math.min(SLIDE_W - w, x));
  y = Math.max(lab, Math.min(SLIDE_H - h, y));
  if (d.snap) y = Math.max(1.8e6 + lab, Math.min(10.15e6 - h, y));
  if (d.snap) {
    ui.tzSnap = null;
    return tzAssistDrag(d, x, y, w);
  }
  project.tz.mpos = project.tz.mpos || {};
  project.tz.mpos[q.key] = { x: Math.round(x), y: Math.round(y), w: Math.round(w) };
}
function tzPointer(e, type) {
  const p = tzLocal(e);
  if (type === "down" && ui.tzZoom >= 0) {
    const mh = tzMaskHitAt(p), th = tzHitAt(p), add = e.ctrlKey || e.metaKey;
    if (mh && (mh.corner || !th)) {
      const key0 = mh.hit.key;
      if (add && !mh.corner && ui.tzMSel.has(key0)) {
        // Ctrl/Cmd по выделенной — снять с неё выделение
        ui.tzMSel.delete(key0);
        if (ui.tzMaskSel === key0) ui.tzMaskSel = [...ui.tzMSel].pop() || null;
        requestDraw();
        return;
      }
      if (add) ui.tzMSel.add(key0);
      else if (!ui.tzMSel.has(key0)) ui.tzMSel = new Set([key0]);
      ui.tzMaskSel = key0;
      pv.setPointerCapture(e.pointerId);
      if (ui.tzMSel.size > 1) {
        ui.tzMDrag = { key: key0, hit: mh.hit, corner: mh.corner, px: p[0], py: p[1], moved: false, add, group: ui.tzMaskHits.filter((o) => ui.tzMSel.has(o.key)).map(tzMItem) };
        requestDraw();
        return;
      }
      ui.tzMDrag = { key: mh.hit.key, hit: mh.hit, corner: mh.corner, px: p[0], py: p[1], x0: mh.hit.ex, y0: mh.hit.ey, w0: mh.hit.ew, h0: mh.hit.eh, moved: false };
      if (ui.tzAssist && !e.shiftKey) {
        const q0 = mh.hit;
        const all = ui.tzMaskHits.filter((o) => o.sx === q0.sx && o.sy === q0.sy).map((o) => ({ key: o.key, x: o.ex, y: o.ey, w: o.ew, h: o.eh, ar: o.mh > 0 && o.mw > 0 ? o.mw / o.mh : o.ew / Math.max(1, o.eh), lab: tzLabOff(o), mw: o.mw, mh: o.mh, es: o.es || 0 }));
        ui.tzMDrag.snap = all.filter((o) => o.key !== q0.key);
        // ряд, откуда берём маску, — подгоняется заново
        const src = tzRowsOf(all).find((r) => r.items.some((o) => o.key === q0.key));
        ui.tzMDrag.srcKeys = new Set(src ? src.items.map((o) => o.key).filter((k2) => k2 !== q0.key) : []);
      }
      requestDraw();
      return;
    }
    // пустое место на листе — рамка выделения (с Ctrl/Cmd — добавить к выделенным)
    const sh0 = !th && ui.tzSlideHits.find((q) => p[0] >= q.x && p[0] <= q.x + q.w && p[1] >= q.y && p[1] <= q.y + q.h);
    if (sh0 && ui.tzMaskHits.length) {
      if (!add) tzSetSel([]);
      ui.tzMarq = { x0: p[0], y0: p[1], x1: p[0], y1: p[1], base: new Set(ui.tzMSel) };
      pv.setPointerCapture(e.pointerId);
      requestDraw();
      return;
    }
    if (ui.tzMaskSel || ui.tzMSel.size) {
      tzSetSel([]);
      requestDraw();
    }
  }
  if (ui.tzMarq) {
    const m = ui.tzMarq;
    if (type === "move") {
      m.x1 = p[0];
      m.y1 = p[1];
      const L = Math.min(m.x0, m.x1), R = Math.max(m.x0, m.x1), T = Math.min(m.y0, m.y1), B2 = Math.max(m.y0, m.y1);
      const hit = ui.tzMaskHits.filter((q) => q.x < R && q.x + q.w > L && q.y < B2 && q.y + q.h > T).map((q) => q.key);
      tzSetSel([...new Set([...m.base, ...hit])]);
      requestDraw();
      return;
    }
    ui.tzMarq = null;
    requestDraw();
    return;
  }
  if (ui.tzMDrag) {
    const d = ui.tzMDrag;
    if (type === "move") {
      if (!d.moved && Math.abs(p[0] - d.px) + Math.abs(p[1] - d.py) < 3) return;
      d.moved = true;
      if (d.group) tzGroupDrag(p, e.shiftKey);
      else tzMaskDrag(p, e.shiftKey);
      requestDraw();
      return;
    }
    // щелчок без сдвига по маске из группы — выделить только её
    if (d.group && !d.moved && !d.add) tzSetSel([d.key]);
    ui.tzMDrag = null;
    ui.tzSnap = null;
    if (d.moved && d.snap && d.slot) project.tz.mpos[d.key] = d.slot;
    requestDraw();
    if (d.moved) {
      scheduleAutosave();
      scheduleHistory();
    }
    return;
  }
  if (type === "move" && ui.tzZoom >= 0 && !ui.tzDrag && !ui.tzPan) {
    const mh = tzMaskHitAt(p), th = tzHitAt(p), key2 = mh && !th ? mh.hit.key : null;
    if (key2 !== ui.tzMaskHover) {
      ui.tzMaskHover = key2;
      requestDraw();
    }
    if (mh && (mh.corner || !th)) {
      pv.style.cursor = mh.corner ? (mh.corner === "nw" || mh.corner === "se" ? "nwse-resize" : "nesw-resize") : "move";
      return;
    }
  }
  if (type === "down") {
    const h = tzHitAt(p);
    if (!h && ui.tzView.z > 1) {
      const q = local(e);
      ui.tzPan = { sx: q[0], sy: q[1], x0: ui.tzView.x, y0: ui.tzView.y };
      pv.setPointerCapture(e.pointerId);
    }
    if (!h) {
      const sh = ui.tzSlideHits.find((q) => p[0] >= q.x && p[0] <= q.x + q.w && p[1] >= q.y && p[1] <= q.y + q.h);
      if (sh) {
        // 2.0.147: выбор слайда мышью — он же становится целью для «Масок на слайде»
        const which = sh.mgi != null ? String(sh.mgi) : "all";
        if (ui.tzMaskWhich !== which) {
          ui.tzMaskWhich = which;
          refreshTZPanel();
        }
        selectTZText(sh.key === "req" && isReqSel(ui.tzSel) ? ui.tzSel : sh.key);
      }
      return;
    }
    selectTZText(pkKey(h.pk));
    pv.setPointerCapture(e.pointerId);
    ui.tzDrag = { hit: h, px: p[0], py: p[1], x0: h.ex, y0: h.ey, moved: false };
    requestDraw();
    return;
  }
  if (type === "move" && ui.tzPan) {
    const q = local(e);
    ui.tzView.x = ui.tzPan.x0 + q[0] - ui.tzPan.sx;
    ui.tzView.y = ui.tzPan.y0 + q[1] - ui.tzPan.sy;
    tzViewClamp();
    pv.style.cursor = "grabbing";
    requestDraw();
    return;
  }
  if (type !== "move" && ui.tzPan) {
    ui.tzPan = null;
    pv.style.cursor = "default";
    return;
  }
  if (type === "move") {
    const d = ui.tzDrag;
    if (!d) {
      const h = tzHitAt(p);
      if ((h && h.pk) !== (ui.tzHover && ui.tzHover.pk) || h && ui.tzHover && h.sx !== ui.tzHover.sx) {
        ui.tzHover = h;
        requestDraw();
      }
      pv.style.cursor = h ? "move" : ui.tzSlideHits.some((q) => p[0] >= q.x && p[0] <= q.x + q.w && p[1] >= q.y && p[1] <= q.y + q.h) ? "pointer" : "default";
      return;
    }
    const k = d.hit.k, nx = Math.round(d.x0 + (p[0] - d.px) / k), ny = Math.round(d.y0 + (p[1] - d.py) / k);
    if (!d.moved && Math.abs(p[0] - d.px) + Math.abs(p[1] - d.py) < 3) return;
    d.moved = true;
    const maxX = SLIDE_W - d.hit.w / k, maxY = SLIDE_H - d.hit.h / k;
    project.tz.pos = project.tz.pos || {};
    project.tz.pos[d.hit.pk] = { x: Math.max(0, Math.min(Math.round(maxX), nx)), y: Math.max(0, Math.min(Math.round(maxY), ny)) };
    requestDraw();
    return;
  }
  if (ui.tzDrag) {
    const moved = ui.tzDrag.moved;
    ui.tzDrag = null;
    requestDraw();
    if (moved) {
      scheduleAutosave();
      scheduleHistory();
      refreshTZText();
    }
  }
}
const stripThumbs = /* @__PURE__ */ new Map();
let stripTimer = 0;
function scheduleStrip() {
  clearTimeout(stripTimer);
  stripTimer = setTimeout(renderStrip, 160);
}
function renderStrip() {
  if (ui.page !== "mask") return;
  const box = $("mStrip"), keep = /* @__PURE__ */ new Set();
  const tiles = [...box.querySelectorAll(".mthumb:not(.add)")];
  project.screens.forEach((st, i) => {
    const [W, H] = dims(st), k = JSON.stringify(st) + JSON.stringify(project.guides);
    let tile = tiles[i];
    if (!tile) {
      tile = document.createElement("button");
      tile.className = "mthumb";
      tile.type = "button";
      tile.append(document.createElement("canvas"), document.createElement("span"));
      tile.lastChild.className = "cap";
      box.insertBefore(tile, box.querySelector(".mthumb.add"));
    }
    tile.onclick = () => {
      if (project.cur === i) return;
      project.cur = i;
      ui.selected.clear();
      ui.anchor = null;
      ui.textMode = -1;
      syncUI();
      changed({ forcePhys: true });
    };
    tile.oncontextmenu = (e) => {
      e.preventDefault();
      if (project.cur !== i) {
        project.cur = i;
        ui.selected.clear();
        ui.textMode = -1;
        syncUI();
        changed();
      }
      showCtx(e.clientX, e.clientY, [
        { label: "Дублировать", fn: () => copyScreen() },
        { label: "Переименовать", fn: () => { const n = $("scrName"); if (n) { n.focus(); n.select(); } } },
        { sep: true },
        { label: "Удалить", danger: true, disabled: project.screens.filter(inMode).length <= 1, fn: () => $("btnDelScreen").click() }
      ]);
    };
    tile.setAttribute("aria-current", String(i === project.cur));
    tile.hidden = !inMode(st);
    tile.title = "".concat(i + 1, ". ").concat(st.name || "screen", " — ").concat(W, "×").concat(H);
    tile.lastChild.innerHTML = "<b>".concat(i + 1, ". ").concat(xmlEsc(st.name || "screen"), "</b> · ").concat(W, "×").concat(H);
    const cv = tile.firstChild;
    if (cv.dataset.k !== k) {
      const s = Math.min(1, 200 / W, 124 / H) * Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.max(1, Math.round(W * s));
      cv.height = Math.max(1, Math.round(H * s));
      drawMask(cv.getContext("2d"), st, s, guidesOf(st));
      cv.dataset.k = k;
    }
    keep.add(tile);
  });
  tiles.forEach((t) => {
    if (!keep.has(t)) t.remove();
  });
  if (!box.querySelector(".mthumb.add")) {
    const add = document.createElement("div");
    add.className = "mthumb add";
    const b1 = document.createElement("button"), b2 = document.createElement("button");
    b1.type = b2.type = "button";
    b1.className = "plus";
    b1.textContent = "+";
    b1.title = "Новый экран";
    b1.onclick = () => $("btnAddScreen").click();
    b2.className = "copy";
    b2.textContent = "copy";
    b2.title = "Копия текущего экрана со всеми настройками (номер — автоматически)";
    b2.onclick = copyScreen;
    add.append(b1, b2);
    box.appendChild(add);
  }
  const cur = box.children[project.cur];
  if (cur && (cur.offsetLeft < box.scrollLeft || cur.offsetLeft + cur.offsetWidth > box.scrollLeft + box.clientWidth)) box.scrollTo({ left: cur.offsetLeft - 8, behavior: "smooth" });
}
// 2.0.78: лента общих полей (как лента масок): миниатюра каждого поля, «+» — новое поле, «copy» — копия текущего
let fStripT = 0;
function scheduleFieldStrip() {
  // с задержкой: при перетаскивании экранов по полю миниатюры не перерисовываются на каждый кадр
  clearTimeout(fStripT);
  fStripT = setTimeout(renderFieldStrip, 250);
}
function copyField() {
  const src = CF(), f = JSON.parse(JSON.stringify(src));
  f.id = newUid();
  const base = String(src.name || "Общее поле").replace(/ \(копия( \d+)?\)$/, ""), names = new Set(project.fields.map((q) => q.name));
  let n = 1, nm = base + " (копия)";
  while (names.has(nm)) nm = base + " (копия " + ++n + ")";
  f.name = nm;
  project.fields.splice(project.fieldCur + 1, 0, f);
  project.fieldCur++;
  fld.sel = null;
  FV.fitted = false;
  fieldChanged(true);
  status("Копия поля: " + nm, true);
}
function renderFieldStrip() {
  if (ui.page !== "field") return;
  const box = $("fStrip");
  box.innerHTML = "";
  project.fields.forEach((f, k) => {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "mthumb";
    const rs = fieldRects(f), b = fieldBBox(rs), cap = document.createElement("span");
    cap.className = "cap";
    cap.innerHTML = "<b>".concat(k + 1, ". ").concat(xmlEsc(f.name || "Поле " + (k + 1)), "</b>").concat(b ? " · " + b.w + "×" + b.h : "");
    if (b) {
      const src = fieldThumb(f), cv = document.createElement("canvas"), sc = Math.min(200 / src.width, 124 / src.height) * Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.max(1, Math.round(src.width * sc));
      cv.height = Math.max(1, Math.round(src.height * sc));
      tile.append(cv, cap);
      tile._draw = () => cv.getContext("2d").drawImage(src, 0, 0, cv.width, cv.height);
    } else {
      const e = document.createElement("div");
      e.className = "empty";
      e.textContent = "пустое поле";
      tile.append(e, cap);
    }
    tile.title = (f.name || "Поле") + (b ? " — " + b.w + "×" + b.h : " — экраны не отмечены");
    tile.setAttribute("aria-current", String(k === project.fieldCur));
    tile.onclick = () => {
      if (project.fieldCur === k) return;
      project.fieldCur = k;
      fld.sel = null;
      FV.fitted = false;
      refreshFieldPanel();
      requestDraw();
    };
    box.appendChild(tile);
    // 2.0.144: рисуем ПОСЛЕ вставки в DOM — Safari 12 иначе показывает чёрный кадр
    if (tile._draw) tile._draw();
  });
  const add = document.createElement("div");
  add.className = "mthumb add";
  const b1 = document.createElement("button"), b2 = document.createElement("button");
  b1.type = b2.type = "button";
  b1.className = "plus";
  b1.textContent = "+";
  b1.title = "Новое общее поле";
  b1.onclick = () => $("fAdd").click();
  b2.className = "copy";
  b2.textContent = "copy";
  b2.title = "Копия текущего поля со всеми экранами и их положением";
  b2.onclick = copyField;
  add.append(b1, b2);
  box.appendChild(add);
  const cur = box.children[project.fieldCur];
  if (cur && (cur.offsetLeft < box.scrollLeft || cur.offsetLeft + cur.offsetWidth > box.scrollLeft + box.clientWidth)) box.scrollTo({ left: cur.offsetLeft - 8, behavior: "smooth" });
}
// 2.0.99: перетаскивание карточек в ленте масок и полей мышью — меняет порядок
function stripDrag(box, onMove) {
  let d = null;
  const tiles = () => [...box.querySelectorAll(".mthumb:not(.add)")];
  const clearMarks = () => tiles().forEach((t) => t.classList.remove("drop-l", "drop-r", "dragging"));
  box.addEventListener("pointerdown", (e) => {
    const t = e.target.closest(".mthumb:not(.add)");
    if (!t || e.button > 0 || e.pointerType === "touch") return; // на телефоне лента листается пальцем
    d = { t, from: tiles().indexOf(t), x: e.clientX, y: e.clientY, on: false, id: e.pointerId, to: -1 };
  });
  box.addEventListener("pointermove", (e) => {
    if (!d || e.pointerId !== d.id) return;
    if (!d.on) {
      if (Math.abs(e.clientX - d.x) < 8) return;
      d.on = true;
      try {
        box.setPointerCapture(e.pointerId);
      } catch (x) {
      }
      d.t.classList.add("dragging");
    }
    e.preventDefault();
    const ts = tiles();
    let to = ts.length;
    for (let i = 0; i < ts.length; i++) {
      const r = ts[i].getBoundingClientRect();
      if (e.clientX < r.left + r.width / 2) {
        to = i;
        break;
      }
    }
    d.to = to;
    ts.forEach((t) => t.classList.remove("drop-l", "drop-r"));
    if (to < ts.length) ts[to].classList.add("drop-l");
    else if (ts.length) ts[ts.length - 1].classList.add("drop-r");
    // у края ленты — прокрутка
    const br = box.getBoundingClientRect();
    if (e.clientX < br.left + 30) box.scrollLeft -= 12;
    else if (e.clientX > br.right - 30) box.scrollLeft += 12;
  });
  const end = (e) => {
    if (!d || e.pointerId !== d.id) return;
    const was = d;
    d = null;
    clearMarks();
    if (!was.on) return;
    // щелчок после перетаскивания не считаем выбором карточки
    box.addEventListener("click", (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
    }, { capture: true, once: true });
    let to = was.to > was.from ? was.to - 1 : was.to;
    if (to < 0 || to === was.from) return;
    onMove(was.from, to);
  };
  box.addEventListener("pointerup", end);
  box.addEventListener("pointercancel", (e) => {
    if (d && e.pointerId === d.id) {
      d = null;
      clearMarks();
    }
  });
}
const moveIn = (arr, from, to) => {
  const [x] = arr.splice(from, 1);
  arr.splice(to, 0, x);
};
// 2.0.114: порядок в ТЗ — выбрать строку и двигать кнопками ⤒ ↑ ↓ ⤓ или стрелками клавиатуры (Shift — в начало / в конец)
function tzMove(how) {
  const keys = tzOrder().map((o) => o.k), i = keys.indexOf(ui.tzPick);
  if (i < 0) {
    status("Выберите строку в списке ТЗ", true);
    return;
  }
  let j = how === "top" ? 0 : how === "bottom" ? keys.length - 1 : i + (how === "up" ? -1 : 1);
  j = Math.max(0, Math.min(keys.length - 1, j));
  if (j === i) return;
  keys.splice(j, 0, keys.splice(i, 1)[0]);
  project.tz.order = keys;
  tzChanged();
  const r = $("tList").querySelector(".fitem.sel");
  if (r) r.scrollIntoView({ block: "nearest" });
}
for (const [id, how] of [["tOrdTop", "top"], ["tOrdUp", "up"], ["tOrdDown", "down"], ["tOrdBottom", "bottom"]]) $(id).onclick = () => tzMove(how);
window.addEventListener("keydown", (e) => {
  if (ui.page !== "tz" || !ui.tzPick || !$("modal").hidden || e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target;
  if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && t.type !== "checkbox" || t.isContentEditable)) return;
  if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
  if (ui.tzZoom >= 0) return;
  e.preventDefault();
  tzMove(e.key === "ArrowUp" ? e.shiftKey ? "top" : "up" : e.shiftKey ? "bottom" : "down");
});
stripDrag($("mStrip"), (from, to) => {
  const cur = project.screens[project.cur];
  moveIn(project.screens, from, to);
  project.cur = project.screens.indexOf(cur);
  if (project.renumber !== false) renumberScreens();
  syncUI();
  changed({ forcePhys: true, list: true });
  scheduleStrip();
  status("Порядок экранов изменён", true);
});
// 2.0.120: лента нарезок (как у масок и полей): миниатюры, «+» — новая нарезка, «copy» — копия текущей
let cStripT = 0;
function scheduleCutStrip() {
  clearTimeout(cStripT);
  cStripT = setTimeout(renderCutStrip, 200);
}
function renderCutStrip() {
  if (ui.page !== "cut") return;
  const box = $("cStrip");
  box.innerHTML = "";
  project.cuts.forEach((c, k) => {
    const tile = document.createElement("button"), G = cutGeom(c), cap = document.createElement("span");
    tile.type = "button";
    tile.className = "mthumb";
    cap.className = "cap";
    cap.innerHTML = "<b>".concat(k + 1, ". ").concat(xmlEsc(c.name || "Нарезка " + (k + 1)), "</b>").concat(G ? " · " + G.W + "×" + G.H : "");
    if (G) {
      const src = cutThumb(c), cv = document.createElement("canvas"), sc = Math.min(200 / src.width, 124 / src.height) * Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.max(1, Math.round(src.width * sc));
      cv.height = Math.max(1, Math.round(src.height * sc));
      tile.append(cv, cap);
      tile._draw = () => cv.getContext("2d").drawImage(src, 0, 0, cv.width, cv.height);
    } else {
      const e = document.createElement("div");
      e.className = "empty";
      e.textContent = "нет маски";
      tile.append(e, cap);
    }
    tile.title = (c.name || "Нарезка") + (G ? " — " + (G.st.name || "screen") + ", " + G.parts.length + " ч. — " + G.W + "×" + G.H : "");
    tile.setAttribute("aria-current", String(k === project.cutCur));
    tile.onclick = () => {
      if (project.cutCur === k) return;
      project.cutCur = k;
      refreshCutPanel();
      requestDraw();
    };
    box.appendChild(tile);
    // 2.0.144: рисуем ПОСЛЕ вставки в DOM — Safari 12 иначе показывает чёрный кадр
    if (tile._draw) tile._draw();
  });
  const add = document.createElement("div"), b1 = document.createElement("button"), b2 = document.createElement("button");
  add.className = "mthumb add";
  b1.type = b2.type = "button";
  b1.className = "plus";
  b1.textContent = "+";
  b1.title = "Новая нарезка";
  b1.onclick = addCut;
  b2.className = "copy";
  b2.textContent = "copy";
  b2.title = "Копия текущей нарезки со всеми настройками";
  b2.onclick = copyCut;
  b2.disabled = !project.cuts.length;
  add.append(b1, b2);
  box.appendChild(add);
  const cur = box.children[project.cutCur];
  if (cur && (cur.offsetLeft < box.scrollLeft || cur.offsetLeft + cur.offsetWidth > box.scrollLeft + box.clientWidth)) box.scrollTo({ left: cur.offsetLeft - 8, behavior: "smooth" });
}
