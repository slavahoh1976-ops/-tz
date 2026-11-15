// ---- Коммутация кабинетов: порядок, вид сверху / снизу ----
// Порядок: начальный угол (fl — передний левый, fr — передний правый, bl — задний левый, br — задний правый),
// направление (по рядам / по столбцам), змейкой; или вручную — щелчками по кабинетам (V.manual — список "c,r").
const volOn = (V, c, r) => !(V.off && V.off.indexOf(c + "," + r) >= 0);
function volOrder(V) {
  const all = [], nOn = V.cx * V.cz - (V.off ? V.off.length : 0);
  if (Array.isArray(V.manual) && V.manual.length === nOn) {
    for (const k of V.manual) {
      const [c, r] = k.split(",").map(Number);
      all.push([c, r]);
    }
    return all;
  }
  const back = V.start === "bl" || V.start === "br", right = V.start === "fr" || V.start === "br";
  const outerN = V.dir === "cols" ? V.cx : V.cz, innerN = V.dir === "cols" ? V.cz : V.cx;
  for (let o = 0; o < outerN; o++) for (let i0 = 0; i0 < innerN; i0++) {
    const rev = V.snake && o % 2 === 1, i = rev ? innerN - 1 - i0 : i0;
    if (V.dir === "cols") all.push([right ? V.cx - 1 - o : o, back ? V.cz - 1 - i : i]);
    else all.push([right ? V.cx - 1 - i : i, back ? V.cz - 1 - o : o]);
  }
  // погашенные кабинеты (как «Гашение» у LED) — не коммутируются, без IP, нитей и пикселей
  const base = all.filter(([c, r]) => volOn(V, c, r));
  if (!(V.off && V.off.length) || base.length < 3) return base;
  return volLogicalOrder(V, base);
}
// 2.0.85: при погашенных кабинетах порядок коммутации перестраивается логично — кабель идёт от кабинета к соседнему,
// без прыжков через погашенные. Из нескольких вариантов обхода (как задано, «змейкой» от ближнего конца ряда / столбца,
// обход по соседям) выбирается тот, где меньше всего прыжков к несоседнему кабинету и короче кабель. Первый кабинет — тот же.
function volLogicalOrder(V, base) {
  const K = (c, r) => c + "," + r, on = new Set(base.map(([c, r]) => K(c, r))), first = base[0];
  const adj = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;
  // оценка: прыжки к несоседнему кабинету — дорого, лишний кабель и повороты — дешевле (чтобы не было «пилы» вверх-вниз)
  const score = (o) => {
    let sc = 0;
    for (let i = 1; i < o.length; i++) {
      const dx = o[i][0] - o[i - 1][0], dy = o[i][1] - o[i - 1][1], m = Math.abs(dx) + Math.abs(dy);
      sc += m === 1 ? 0 : 20 + m;
      if (i > 1) {
        const px = o[i - 1][0] - o[i - 2][0], py = o[i - 1][1] - o[i - 2][1];
        if (Math.sign(px) !== Math.sign(dx) || Math.sign(py) !== Math.sign(dy)) sc += 2;
      }
    }
    return sc;
  };
  const cands = [base];
  // «змейка» от ближнего конца: линии (ряды или столбцы) — в заданном порядке, каждая начинается с конца, ближнего к прошлому кабинету
  for (const byRow of [true, false]) {
    const lines = new Map();
    for (const p of base) {
      const k = byRow ? p[1] : p[0];
      if (!lines.has(k)) lines.set(k, []);
      lines.get(k).push(p);
    }
    const keys = [...lines.keys()];
    const fi = keys.indexOf(byRow ? first[1] : first[0]);
    const ordKeys = [...keys.slice(fi), ...keys.slice(0, fi).reverse()];
    const o = [];
    for (const k of ordKeys) {
      const ln = lines.get(k).slice().sort((a, b) => byRow ? a[0] - b[0] : a[1] - b[1]);
      if (!o.length) {
        const i0 = ln.findIndex((q) => q[0] === first[0] && q[1] === first[1]);
        if (i0 > 0) ln.reverse();
      } else {
        const last = o[o.length - 1], d0 = Math.abs(ln[0][0] - last[0]) + Math.abs(ln[0][1] - last[1]), d1 = Math.abs(ln[ln.length - 1][0] - last[0]) + Math.abs(ln[ln.length - 1][1] - last[1]);
        if (d1 < d0) ln.reverse();
      }
      o.push(...ln);
    }
    if (o.length === base.length && o[0][0] === first[0] && o[0][1] === first[1]) cands.push(o);
  }
  // обход по соседям: следующий — соседний кабинет, у которого меньше всего свободных соседей (чтобы никого не оставить в тупике)
  for (const byRow of [true, false]) {
    const seen = new Set([K(first[0], first[1])]), o = [first];
    const free = (c, r) => on.has(K(c, r)) && !seen.has(K(c, r));
    const nb = (c, r) => [[c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]].filter(([x, y]) => free(x, y));
    let dirPrev = null;
    while (o.length < base.length) {
      const [c, r] = o[o.length - 1], opts = nb(c, r);
      let nx;
      if (opts.length) {
        opts.sort((a, b) => {
          const da = nb(a[0], a[1]).length, db = nb(b[0], b[1]).length;
          if (da !== db) return da - db;
          const sa = (byRow ? a[1] === r : a[0] === c) ? 0 : 1, sb = (byRow ? b[1] === r : b[0] === c) ? 0 : 1;
          if (sa !== sb) return sa - sb;
          const ka = dirPrev && a[0] - c === dirPrev[0] && a[1] - r === dirPrev[1] ? 0 : 1, kb = dirPrev && b[0] - c === dirPrev[0] && b[1] - r === dirPrev[1] ? 0 : 1;
          return ka - kb;
        });
        nx = opts[0];
      } else {
        let best = null, bd = 1e9;
        for (const p of base) if (!seen.has(K(p[0], p[1]))) {
          const d = Math.abs(p[0] - c) + Math.abs(p[1] - r);
          if (d < bd) bd = d, best = p;
        }
        nx = best;
      }
      dirPrev = [nx[0] - c, nx[1] - r];
      seen.add(K(nx[0], nx[1]));
      o.push(nx);
    }
    cands.push(o);
  }
  let best = base, bs = score(base);
  for (const o of cands) {
    const sc = score(o);
    if (sc < bs) bs = sc, best = o;
  }
  return best;
}
// Вид: сверху — фронт внизу; снизу (лицевая сторона, как лист адресации) — фронт вверху. Лево-право — как у зрителя.
function volComLayout(st, W, H, side) {
  const V = st.vol, m = Math.max(40, Math.min(W, H) * 0.07), top = m + Math.max(26, H * 0.05);
  const aw = W - 2 * m, ah = H - top - m - Math.max(24, H * 0.04), gap = Math.max(6, Math.min(aw, ah) * 0.012);
  const k = Math.min((aw - gap * (V.cx - 1)) / (V.cx * V.cw), (ah - gap * (V.cz - 1)) / (V.cz * V.cd));
  const cw = V.cw * k, cd = V.cd * k, gw = V.cx * cw + gap * (V.cx - 1), gh = V.cz * cd + gap * (V.cz - 1);
  const x0 = (W - gw) / 2, y0 = top + (ah - gh) / 2, bottom = (side || st.vol.side || "bottom") === "bottom";
  const rect = (c, r) => {
    const dc = c, dr = bottom ? r : V.cz - 1 - r;
    return [x0 + dc * (cw + gap), y0 + dr * (cd + gap), cw, cd];
  };
  return { m, top, x0, y0, gw, gh, cw, cd, rect, bottom };
}
function volComH(st, W) {
  const V = st.vol, r = V.cz * V.cd / (V.cx * V.cw);
  return Math.max(700, Math.min(2400, Math.round(W * 0.86 * r + W * 0.25)));
}
// opts: side — "top" / "bottom" (по умолчанию как в разделе), com — рисовать коммутацию (номера, IP, стрелки)
function volComPaint(ctx, st, W, H, opts) {
  const o = opts || {}, g = volGeom(st), V = g.V, L2 = volComLayout(st, W, H, o.side), u = Math.min(W, H) / 1000;
  // коммутация только на виде сверху; на виде снизу — лишь при ручной расстановке порядка
  const com = o.com !== false && (!L2.bottom || !!(ui.volPick && st === S()));
  ctx.save();
  ctx.fillStyle = "#101318";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#e8eaee";
  ctx.font = "600 ".concat(Math.round(Math.max(14, 30 * u)), "px ").concat(FONT);
  ctx.fillText((com ? "Коммутация кабинетов · " : "Адресация нитей · ").concat(L2.bottom ? "вид снизу (лицевая сторона)" : "вид сверху"), W / 2, L2.m * 0.55 + Math.max(10, 14 * u));
  // подписи сторон
  ctx.font = "600 ".concat(Math.round(Math.max(11, 20 * u)), "px ").concat(FONT);
  const yB = L2.y0 + L2.gh + Math.max(26, 44 * u), yT = L2.y0 - Math.max(20, 34 * u);
  ctx.fillStyle = "#2ec4a7";
  ctx.fillText(L2.bottom ? "ФРОНТ ▲" : "ФРОНТ ▼", W / 2, L2.bottom ? yT : yB);
  ctx.fillStyle = "#9aa1ad";
  ctx.fillText("ЗАД", W / 2, L2.bottom ? yB : yT);
  ctx.save();
  ctx.translate(L2.x0 - Math.max(22, 40 * u), L2.y0 + L2.gh / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("ЛЕВО", 0, 0);
  ctx.restore();
  ctx.save();
  ctx.translate(L2.x0 + L2.gw + Math.max(22, 40 * u), L2.y0 + L2.gh / 2);
  ctx.rotate(Math.PI / 2);
  ctx.fillText("ПРАВО", 0, 0);
  ctx.restore();
  const picking = com && ui.volPick && st === S(), pickList = picking ? ui.volPickList || [] : null;
  const map = volAddrMap(V.sx, V.sz);
  for (const k of V.off || []) {
    const [oc, orr] = k.split(",").map(Number), [x, y, w, h] = L2.rect(oc, orr);
    ctx.fillStyle = "#0c0e12";
    ctx.fillRect(x, y, w, h);
    ctx.setLineDash([Math.max(4, 8 * u), Math.max(3, 6 * u)]);
    ctx.lineWidth = Math.max(1, 2 * u);
    ctx.strokeStyle = "rgba(154,161,173,0.45)";
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(154,161,173,0.6)";
    ctx.font = "600 ".concat(Math.max(10, Math.min(w, h) * 0.12), "px ").concat(FONT);
    ctx.fillText("погашен", x + w / 2, y + h / 2);
  }
  const labelsLater = [];
  for (const cab of g.cabs) {
    const [x, y, w, h] = L2.rect(cab.c, cab.r), col = pixColor(cab.n, 50);
    ctx.fillStyle = "#1a1e25";
    ctx.fillRect(x, y, w, h);
    ctx.lineWidth = Math.max(2, 4 * u);
    ctx.strokeStyle = col;
    ctx.strokeRect(x + ctx.lineWidth / 2, y + ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
    // нити с номерами (как на листе адресации), если кабинет достаточно крупный
    const cs = Math.min(w / V.sx, h / V.sz);
    if (cs >= 11) {
      ctx.font = "".concat(Math.max(7, cs * 0.34), "px ").concat(FONT);
      ctx.fillStyle = com ? "rgba(230,234,240,0.32)" : "rgba(230,234,240,0.55)";
      map.forEach(([lx, lz], j) => {
        const dc = lx, dr = L2.bottom ? lz : V.sz - 1 - lz;
        ctx.fillText(String(j + 1), x + (dc + 0.5) * w / V.sx, y + (dr + 0.5) * h / V.sz);
      });
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 1; i < V.sx; i++) {
        ctx.moveTo(x + i * w / V.sx, y);
        ctx.lineTo(x + i * w / V.sx, y + h);
      }
      for (let i = 1; i < V.sz; i++) {
        ctx.moveTo(x, y + i * h / V.sz);
        ctx.lineTo(x + w, y + i * h / V.sz);
      }
      ctx.stroke();
    }
    labelsLater.push(() => {
      // номер кабинета и IP — на обоих видах (2.0.71: и на виде снизу); линия коммутации — только на виде сверху
      const pk = pickList ? pickList.indexOf(cab.c + "," + cab.r) : -1, num = picking ? pk >= 0 ? String(pk + 1) : "?" : String(cab.n + 1);
      const big = Math.max(14, Math.min(w, h) * 0.3), bh = big * 1.25;
      // без подложки: тонкая тёмная обводка, чтобы цифры читались поверх сетки
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(0,0,0,0.85)";
      ctx.font = "700 ".concat(big, "px ").concat(FONT);
      ctx.lineWidth = Math.max(2, big * 0.12);
      ctx.strokeText(num, x + w / 2, y + h / 2 - bh * 0.02);
      ctx.fillStyle = picking && pk < 0 ? "#9aa1ad" : "#ffffff";
      ctx.fillText(num, x + w / 2, y + h / 2 - bh * 0.02);
      if (!picking) {
        const sm = Math.max(11, Math.min(w, h) * 0.13);
        // 2.0.69: IP — тем же шрифтом и начертанием, что номера кабинетов на LED-масках
        ctx.font = "".concat(sm, "px ").concat(FONT);
        ctx.lineWidth = Math.max(2, sm * 0.22);
        ctx.strokeText(cab.ip, x + w / 2, y + h / 2 + bh * 0.5 + sm * 0.75);
        ctx.fillStyle = "#e8eaee";
        ctx.fillText(cab.ip, x + w / 2, y + h / 2 + bh * 0.5 + sm * 0.75);
      }
    });
  }
  // линия коммутации со стрелками (2.0.67, вариант 6): соседние кабинеты — напрямую,
  // переход на другой ряд (столбец) — не через схему, а вдоль её внешнего края и по зазору между рядами
  // 2.0.86: «Монтажная схема» — как рисуют монтажники: у кабинета вход слева, выход справа (задняя сторона, вид сверху),
  // тонкая линия со стрелкой у входа; сосед справа — короткая стрелка через стык; сосед слева / сверху / снизу — скобка «П»
  // внутри кабинетов на своём уровне (не сливаются); переход в другой ряд — снаружи схемы вдоль края
  if (com && !picking && g.cabs.length > 1 && V.line === "mount-off") {
    const cabR = g.cabs.map((cab) => L2.rect(cab.c, cab.r)), N = cabR.length;
    const LW = Math.max(2, 3.2 * u), AH = Math.max(7, 13 * u);
    // 2.0.87: вид сверху — вход справа, выход слева (как на схемах монтажника)
    const pin = (i) => [cabR[i][0] + cabR[i][2] * 0.84, cabR[i][1] + cabR[i][3] * 0.36];
    const pout = (i) => [cabR[i][0] + cabR[i][2] * 0.16, cabR[i][1] + cabR[i][3] * 0.36];
    const gap = V.cx > 1 ? (L2.gw - V.cx * L2.cw) / (V.cx - 1) : V.cz > 1 ? (L2.gh - V.cz * L2.cd) / (V.cz - 1) : Math.max(6, 12 * u);
    const out = Math.max(gap * 1.6, 24 * u);
    const draw = (P) => {
      const run = (col, w) => {
        ctx.strokeStyle = col;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(P[0][0], P[0][1]);
        for (let k = 1; k < P.length; k++) ctx.lineTo(P[k][0], P[k][1]);
        ctx.stroke();
      };
      ctx.save();
      ctx.lineJoin = "miter";
      ctx.lineCap = "butt";
      run("rgba(0,0,0,0.85)", LW + Math.max(3, 4 * u));
      run("#ffd23f", LW);
      const [x1, y1] = P[P.length - 2], [x2, y2] = P[P.length - 1], a = Math.atan2(y2 - y1, x2 - x1);
      ctx.fillStyle = "#ffd23f";
      ctx.strokeStyle = "rgba(0,0,0,0.85)";
      ctx.lineWidth = Math.max(1.5, 2 * u);
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - Math.cos(a - 0.45) * AH, y2 - Math.sin(a - 0.45) * AH);
      ctx.lineTo(x2 - Math.cos(a + 0.45) * AH, y2 - Math.sin(a + 0.45) * AH);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
      ctx.restore();
    };
    // уровни «скобок» внутри ряда: по очереди, чтобы соседние скобки не совпадали
    const lv = [0.62, 0.74, 0.86];
    for (let i = 1; i < N; i++) {
      const A = g.cabs[i - 1], B = g.cabs[i], ra = cabR[i - 1], rb = cabR[i], o = pout(i - 1), n = pin(i);
      const dc = B.c - A.c, dr = B.r - A.r, sameRow = ra[1] === rb[1], sameCol = ra[0] === rb[0];
      let P;
      if (sameRow && rb[0] < ra[0] && Math.abs(dc) === 1) P = [o, [n[0] + AH * 0.2, n[1]]];
      else if (sameRow) {
        // назад по ряду: вниз внутри кабинета, по ряду, вверх во вход
        const y = ra[1] + ra[3] * lv[i % 3];
        P = [o, [o[0], y], [n[0], y], [n[0], n[1] + AH * 0.2]];
      } else if (sameCol && Math.abs(dr) === 1) {
        // сосед сверху / снизу: из выхода по вертикали к уровню входа, влево во вход
        const x = ra[0] + ra[2] * (0.84 - 0.1 * (i % 2));
        P = [o, [x, o[1]], [x, n[1] - (rb[1] > ra[1] ? 0 : 0)], [n[0] + AH * 0.2, n[1]]];
        P = [o, [o[0], n[1]], [n[0] - AH * 0.2, n[1]]];
      } else {
        // переход в другой ряд / прыжок — снаружи схемы вдоль ближнего бокового края
        const leftSide = (ra[0] + rb[0]) / 2 < L2.x0 + L2.gw / 2;
        const xe = leftSide ? L2.x0 - out * (1 + (i % 2) * 0.5) : L2.x0 + L2.gw + out * (1 + (i % 2) * 0.5);
        const ya = ra[1] + ra[3] * 0.94, yb = rb[1] + rb[3] * 0.06;
        P = [o, [o[0], ya], [xe, ya], [xe, yb], [n[0], yb], [n[0], n[1] - AH * 0.2]];
        if (yb > ya) P = [o, [o[0], ya], [xe, ya], [xe, yb], [n[0], yb], [n[0], n[1] - AH * 0.2]];
        else {
          const ya2 = ra[1] + ra[3] * 0.06, yb2 = rb[1] + rb[3] * 0.94;
          P = [o, [o[0], ya2], [xe, ya2], [xe, yb2], [n[0], yb2], [n[0], n[1] + AH * 0.2]];
        }
      }
      draw(P);
    }
    // разъёмы: зелёный вход, красный выход
    for (let i = 0; i < N; i++) for (const [p2, colp] of [[pin(i), "#2ecc71"], [pout(i), "#ff5a5a"]]) {
      ctx.beginPath();
      ctx.arc(p2[0], p2[1], Math.max(3, 5 * u), 0, Math.PI * 2);
      ctx.fillStyle = colp;
      ctx.fill();
      ctx.lineWidth = Math.max(1, 1.5 * u);
      ctx.strokeStyle = "#000";
      ctx.stroke();
    }
    // ввод сигнала в первый кабинет — снаружи
    {
      // ввод — снизу (с фронта) или сверху, смотря где первый кабинет
      const n = pin(0), r0 = cabR[0], fromBottom = r0[1] + r0[3] / 2 > L2.y0 + L2.gh / 2, y0 = fromBottom ? L2.y0 + L2.gh + out * 1.1 : L2.y0 - out * 1.1;
      draw([[n[0], y0], [n[0], n[1] + (fromBottom ? AH * 0.2 : -AH * 0.2)]]);
      ctx.save();
      ctx.font = "700 ".concat(Math.max(10, 15 * u), "px ").concat(FONT);
      ctx.textAlign = "left";
      ctx.fillStyle = "#ffd23f";
      ctx.fillText("ВХОД", n[0] + 8 * u, y0 + (fromBottom ? -4 * u : 12 * u));
      ctx.restore();
    }
  } else if (com && !picking && g.cabs.length > 1) {
    const gap = V.cx > 1 ? (L2.gw - V.cx * L2.cw) / (V.cx - 1) : V.cz > 1 ? (L2.gh - V.cz * L2.cd) / (V.cz - 1) : Math.max(6, 12 * u);
    const mg = Math.max(gap * 1.8, 22 * u), gL = L2.x0 - mg, gR = L2.x0 + L2.gw + mg, gT = L2.y0 - mg, gB = L2.y0 + L2.gh + mg;
    const cabR = g.cabs.map((cab) => L2.rect(cab.c, cab.r));
    const curvyPts = V.line === "arc";
    const pts = cabR.map(([x, y, w, h]) => [x + w / 2, y + h * (curvyPts ? 0.5 : 0.2)]);
    const lineStyle = V.line === "arc" ? "arc" : "round", curvy = lineStyle === "arc" || lineStyle === "grad";
    const LW = Math.max(2.5, 5.5 * u), HALO = LW + Math.max(3, 6 * u), nL = Math.max(1, pts.length - 1);
    // цвет линии: жёлтый; «градиент» — от зелёного (первый кабинет) к красному (последний)
    const linkCol = (i) => lineStyle === "grad" ? "hsl(".concat(Math.round(130 - 130 * (i - 1) / Math.max(1, nL - 1)), ",95%,55%)") : "#ffd23f";
    ctx.lineWidth = LW;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    const ah = Math.max(9, 20 * u);
    const arrowAt = (x, y, a) => {
      ctx.save();
      ctx.lineWidth = Math.max(2, 3 * u);
      ctx.strokeStyle = "rgba(0,0,0,0.85)";
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * ah, y + Math.sin(a) * ah);
      ctx.lineTo(x + Math.cos(a + 2.5) * ah, y + Math.sin(a + 2.5) * ah);
      ctx.lineTo(x + Math.cos(a - 2.5) * ah, y + Math.sin(a - 2.5) * ah);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * ah, y + Math.sin(a) * ah);
      ctx.lineTo(x + Math.cos(a + 2.5) * ah, y + Math.sin(a + 2.5) * ah);
      ctx.lineTo(x + Math.cos(a - 2.5) * ah, y + Math.sin(a - 2.5) * ah);
      ctx.closePath();
      ctx.fill();
    };
    const byCols = V.dir === "cols" && !V.manual, paths = [];
    for (let i = 1; i < pts.length; i++) {
      const A = g.cabs[i - 1], B = g.cabs[i], [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      const [, rya, , rha] = cabR[i - 1], [rxb, ryb, rwb, rhb] = cabR[i], [rxa, , rwa] = cabR[i - 1];
      let path;
      if (curvy) path = [[ax, ay], [bx, by]];
      else if (A.r === B.r || A.c === B.c) path = [[ax, ay], [bx, by]];
      else if (!byCols) {
        // 2.0.82: из последнего кабинета ряда — сразу рядом с ним вниз/вверх в зазор между рядами, по зазору — к первому кабинету
        // следующего ряда и рядом с ним в него (погашенные кабинеты не обходим по краю всей схемы); у края схемы — по краю
        const right = L2.x0 + L2.gw - 1, left = L2.x0 + 1;
        const xo = ax > bx ? rxa + rwa >= right ? gR : rxa + rwa + gap / 2 : rxa <= left ? gL : rxa - gap / 2;
        const xi = ax > bx ? rxb <= left ? gL : rxb - gap / 2 : rxb + rwb >= right ? gR : rxb + rwb + gap / 2;
        const yg = ryb < rya ? ryb + rhb + gap / 2 : ryb - gap / 2;
        path = [[ax, ay], [xo, ay], [xo, yg], [xi, yg], [xi, by], [bx, by]];
      } else {
        // по столбцам: из конца столбца — к верхнему/нижнему краю, по зазору между столбцами, в начало следующего
        const bot = L2.y0 + L2.gh - 1, top = L2.y0 + 1;
        const yo = ay > by ? rya + rha >= bot ? gB : rya + rha + gap / 2 : rya <= top ? gT : rya - gap / 2;
        const yi = ay > by ? ryb <= top ? gT : ryb - gap / 2 : ryb + rhb >= bot ? gB : ryb + rhb + gap / 2;
        const xg = rxb < rxa ? rxb + rwb + gap / 2 : rxb - gap / 2;
        const axc = rxa + rwa / 2, bxc = rxb + rwb / 2;
        path = [[ax, ay], [axc, yo], [xg, yo], [xg, yi], [bxc, yi], [bx, by]];
      }
      paths.push(path);
    }
    // 2.0.83: линии не накладываются — совпадающие по направлению и месту отрезки разводим параллельно
    if (!curvy) {
      const segs = [], d = Math.max(4, ctx.lineWidth * 1.9);
      paths.forEach((P, pi) => {
        for (let k = 1; k < P.length; k++) {
          const [x1, y1] = P[k - 1], [x2, y2] = P[k], hz = Math.abs(y1 - y2) < 0.5, vt = Math.abs(x1 - x2) < 0.5;
          if (!hz && !vt) continue;
          const mov = P.length === 2 || k > 1 && k < P.length - 1;
          segs.push({ pi, k, hz, c: Math.round(hz ? y1 : x1), lo: Math.min(hz ? x1 : y1, hz ? x2 : y2), hi: Math.max(hz ? x1 : y1, hz ? x2 : y2), mov });
        }
      });
      const groups = new Map();
      for (const sg of segs) {
        const key2 = (sg.hz ? "h" : "v") + sg.c;
        if (!groups.has(key2)) groups.set(key2, []);
        groups.get(key2).push(sg);
      }
      const offs = [];
      for (const list of groups.values()) {
        if (list.length < 2) continue;
        list.sort((a2, b2) => b2.mov - a2.mov === 0 ? a2.lo - b2.lo : a2.mov - b2.mov);
        const lanes = [];
        for (const sg of list) {
          let lane = 0;
          for (; ; lane++) if (!(lanes[lane] || []).some((o) => o.lo < sg.hi - 1 && sg.lo < o.hi - 1)) break;
          if (lane && !sg.mov) lane = 0;
          (lanes[lane] = lanes[lane] || []).push(sg);
          if (lane) offs.push({ sg, off: (lane % 2 ? 1 : -1) * Math.ceil(lane / 2) * d });
        }
      }
      for (const { sg, off } of offs) {
        const P = paths[sg.pi], ax2 = sg.hz ? 1 : 0;
        P[sg.k - 1] = P[sg.k - 1].slice();
        P[sg.k] = P[sg.k].slice();
        P[sg.k - 1][ax2] += off;
        P[sg.k][ax2] += off;
        // соседние отрезки остаются прямыми: их общие точки сдвинулись вместе с этим отрезком
      }
    }
    // 2.0.84: рисуем каждую связь с тёмной обводкой — линии не сливаются с сеткой, номерами и друг с другом
    const bez = (P0, P1, P2, P3, t) => {
      const m = 1 - t;
      return [m * m * m * P0[0] + 3 * m * m * t * P1[0] + 3 * m * t * t * P2[0] + t * t * t * P3[0], m * m * m * P0[1] + 3 * m * m * t * P1[1] + 3 * m * t * t * P2[1] + t * t * t * P3[1]];
    };
    const cw0 = Math.min(L2.cw, L2.cd);
    paths.forEach((path, pi) => {
      const col2 = linkCol(pi + 1);
      const stroke = (draw) => {
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "rgba(0,0,0,0.8)";
        ctx.lineWidth = HALO;
        ctx.beginPath();
        draw();
        ctx.stroke();
        ctx.strokeStyle = col2;
        ctx.lineWidth = LW;
        ctx.beginPath();
        draw();
        ctx.stroke();
        ctx.restore();
      };
      ctx.fillStyle = col2;
      if (curvy) {
        // дуга: соседние связи выгибаются в разные стороны; далёкие — выгиб ограничен, чтобы не уходить за схему
        const [p0, p3] = path, dx = p3[0] - p0[0], dy = p3[1] - p0[1], Ln = Math.hypot(dx, dy) || 1, nx = -dy / Ln, ny = dx / Ln;
        const bend = Math.min(Ln * 0.3, cw0 * 0.22 + Ln * 0.1) * (pi % 2 ? -1 : 1);
        const p1 = [p0[0] + dx * 0.25 + nx * bend, p0[1] + dy * 0.25 + ny * bend], p2 = [p0[0] + dx * 0.75 + nx * bend, p0[1] + dy * 0.75 + ny * bend];
        stroke(() => {
          ctx.moveTo(p0[0], p0[1]);
          ctx.bezierCurveTo(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]);
        });
        const m1 = bez(p0, p1, p2, p3, 0.5), m2 = bez(p0, p1, p2, p3, 0.52);
        arrowAt(m1[0], m1[1], Math.atan2(m2[1] - m1[1], m2[0] - m1[0]));
        return;
      }
      const r = lineStyle === "round" ? Math.max(6, Math.min(gap * 0.9, 26 * u)) : 0;
      stroke(() => {
        ctx.moveTo(path[0][0], path[0][1]);
        for (let k = 1; k < path.length - 1; k++) r ? ctx.arcTo(path[k][0], path[k][1], path[k + 1][0], path[k + 1][1], r) : ctx.lineTo(path[k][0], path[k][1]);
        ctx.lineTo(path[path.length - 1][0], path[path.length - 1][1]);
      });
      // стрелка: на прямом — посередине, на обходе — на самом длинном отрезке и у входа
      let best = 1, bl = 0;
      for (let k = 1; k < path.length; k++) {
        const d = Math.hypot(path[k][0] - path[k - 1][0], path[k][1] - path[k - 1][1]);
        if (d > bl) bl = d, best = k;
      }
      const [qx, qy] = path[best - 1], [rx, ry] = path[best];
      arrowAt((qx + rx) / 2, (qy + ry) / 2, Math.atan2(ry - qy, rx - qx));
      if (path.length > 2) {
        const [px1, py1] = path[path.length - 2], [px2, py2] = path[path.length - 1];
        arrowAt(px1 + (px2 - px1) * 0.55, py1 + (py2 - py1) * 0.55, Math.atan2(py2 - py1, px2 - px1));
      }
    });
    ctx.fillStyle = linkCol(1);
    ctx.strokeStyle = "rgba(0,0,0,0.85)";
    ctx.lineWidth = Math.max(2, 3 * u);
    ctx.beginPath();
    ctx.arc(pts[0][0], pts[0][1], ah * 0.75, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.lineCap = "butt";
  }
  for (const f of labelsLater) f();
  // подпись внизу
  ctx.font = "".concat(Math.round(Math.max(10, 17 * u)), "px ").concat(FONT);
  ctx.fillStyle = "#9aa1ad";
  ctx.fillText("Кабинетов ".concat(g.cabs.length).concat(g.cabs.length !== V.cx * V.cz ? " из " + V.cx * V.cz : "", " · ").concat(volSize(V), " · IP ").concat(g.cabs.length ? g.cabs[0].ip : "—").concat(g.cabs.length > 1 ? " … " + g.cabs[g.cabs.length - 1].ip : "", " · ").concat(g.uniPerCab, " universe на кабинет · Art-Net 6454, Net 0, Subnet 0"), W / 2, H - L2.m * 0.5);
  ctx.restore();
  return L2;
}
function volComDraw() {
  if (typeof syncZoomLabel === "function") syncZoomLabel();
  const cv = document.getElementById("volCom");
  if (!cv) return;
  const st = S(), on = ui.page === "mask" && st.kind === "vol" && st.vol && st.vol.view === "com";
  cv.hidden = !on;
  if (!on) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1), cw = cv.clientWidth, ch = cv.clientHeight;
  if (!cw || !ch) return;
  if (cv.width !== Math.round(cw * dpr) || cv.height !== Math.round(ch * dpr)) {
    cv.width = Math.round(cw * dpr);
    cv.height = Math.round(ch * dpr);
  }
  const c = cv.getContext("2d");
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  // справа внизу — окно 3D: схему рисуем левее, чтобы оно не закрывало кабинеты
  // 2.0.71: ширину окна 3D берём и пока оно ещё скрыто (первая отрисовка), иначе схема залезала под него
  const v3 = document.getElementById("vol3dBox"), r3 = st.vol.show3d !== false && v3 && !v3.classList.contains("big") ? (v3.offsetWidth || 380) + 24 : 0;
  c.fillStyle = "#101318";
  c.fillRect(0, 0, cw, ch);
  // 2.0.142: зум и сдвиг окна коммутации (колесо / тачпад), как в мэппинге и ТЗ
  const vv = ui.volView, W = Math.max(200, cw - (cw - r3 > 420 ? r3 : 0));
  ui.volComView = { cw, ch, W };
  c.save();
  c.translate(vv.x, vv.y);
  c.scale(vv.z, vv.z);
  ui.volComL = volComPaint(c, st, W, ch);
  c.restore();
}
// 2.0.142: точка щелчка в координатах схемы (с учётом зума / сдвига окна)
const volComPt = (cv, e) => {
  const r = cv.getBoundingClientRect(), vv = ui.volView;
  return [(e.clientX - r.left - vv.x) / vv.z, (e.clientY - r.top - vv.y) / vv.z];
};
function volComInit() {
  const cv = document.getElementById("volCom");
  if (!cv) return;
  // 2.0.142: зум окна коммутации к курсору (колесо / тачпад), сдвиг — Alt / средняя или правая кнопка, Esc / двойной щелчок — сброс
  let pan = null;
  cv.addEventListener("wheel", (e) => {
    e.preventDefault();
    const vv = ui.volView, r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
    const z = Math.max(1, Math.min(12, vv.z * Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0018))));
    const ux = (px - vv.x) / vv.z, uy = (py - vv.y) / vv.z;
    vv.z = z;
    vv.x = px - ux * z;
    vv.y = py - uy * z;
    if (z === 1) vv.x = vv.y = 0;
    volComDraw();
  }, { passive: false });
  cv.addEventListener("pointermove", (e) => {
    if (!pan) return;
    ui.volView.x = pan.x0 + (e.clientX - pan.px);
    ui.volView.y = pan.y0 + (e.clientY - pan.py);
    volComDraw();
  });
  const endPan = () => {
    pan = null;
  };
  cv.addEventListener("pointerup", endPan);
  cv.addEventListener("pointercancel", endPan);
  cv.addEventListener("contextmenu", (e) => e.preventDefault());
  cv.addEventListener("dblclick", () => {
    Object.assign(ui.volView, { z: 1, x: 0, y: 0 });
    volComDraw();
  });
  cv.addEventListener("pointerdown", (e) => {
    const st = S(), V = st.vol, L2 = ui.volComL;
    if (!L2) return;
    // сдвиг окна: средняя / правая кнопка, или Alt при zoom > 1 (Alt без зума — гашение кабинета)
    if (e.button === 1 || e.button === 2 || (e.altKey && ui.volView.z > 1 && !ui.volBlank && ui.tool !== "black" && !ui.volPick)) {
      pan = { px: e.clientX, py: e.clientY, x0: ui.volView.x, y0: ui.volView.y };
      try {
        cv.setPointerCapture(e.pointerId);
      } catch (err) {
      }
      return;
    }
    if (!ui.volPick) {
      // гашение кабинета: кнопка «Гашение» над холстом, «Гасить кабинеты» в разделе или Alt + щелчок
      if (!(ui.volBlank || ui.tool === "black" || e.altKey)) return;
      const [x, y] = volComPt(cv, e);
      for (let cz = 0; cz < V.cz; cz++) for (let cx = 0; cx < V.cx; cx++) {
        const [rx, ry, rw, rh] = L2.rect(cx, cz);
        if (x >= rx && x <= rx + rw && y >= ry && y <= ry + rh) {
          const k = cx + "," + cz, i = V.off.indexOf(k);
          if (i >= 0) V.off.splice(i, 1);
          else if (V.cx * V.cz - V.off.length > 1) V.off.push(k);
          if (V.manual) {
            V.manual = V.manual.filter((m) => V.off.indexOf(m) < 0);
            if (i >= 0) V.manual.push(k);
          }
          status(i >= 0 ? "Кабинет включён" : "Кабинет погашен");
          syncVolUI();
          changed({ forcePhys: true });
          return;
        }
      }
      return;
    }
    const [x, y] = volComPt(cv, e);
    for (let cz = 0; cz < V.cz; cz++) for (let cx = 0; cx < V.cx; cx++) {
      const [rx, ry, rw, rh] = L2.rect(cx, cz);
      if (x >= rx && x <= rx + rw && y >= ry && y <= ry + rh) {
        const k = cx + "," + cz, list = ui.volPickList || (ui.volPickList = []);
        if (!volOn(V, cx, cz)) return;
        if (list.indexOf(k) < 0) list.push(k);
        if (list.length === V.cx * V.cz - V.off.length) {
          V.manual = list.slice();
          ui.volPick = false;
          ui.volPickList = null;
          status("Порядок коммутации задан вручную", true);
          syncVolUI();
          changed({ forcePhys: true });
        } else status("Кабинет ".concat(list.length, " из ").concat(V.cx * V.cz - V.off.length, " — щёлкните следующий"));
        volComDraw();
        return;
      }
    }
  });
}
function vol3dInit() {
  const cv = document.getElementById("vol3d");
  if (!cv) return;
  document.querySelectorAll("#vol3dBar button").forEach((b) => b.onclick = (e) => {
    e.stopPropagation();
    const v = b.dataset.v3, box = document.getElementById("vol3dBox");
    if (v === "big") {
      box.classList.toggle("big");
      b.textContent = box.classList.contains("big") ? "⤡" : "⤢";
      b.title = box.classList.contains("big") ? "Уменьшить окно" : "Крупно";
    } else Object.assign(vol3d, { yaw: VOL3D_VIEWS[v][0], pitch: VOL3D_VIEWS[v][1], zoom: 1 });
    vol3dDraw(true);
  });
  let drag = null;
  cv.addEventListener("pointerdown", (e) => {
    drag = { x: e.clientX, y: e.clientY, yaw: vol3d.yaw, pitch: vol3d.pitch };
    try {
      cv.setPointerCapture(e.pointerId);
    } catch (err) {
    }
    e.preventDefault();
    e.stopPropagation();
  });
  cv.addEventListener("pointermove", (e) => {
    if (!drag) return;
    vol3d.yaw = drag.yaw + (e.clientX - drag.x) * 0.01;
    vol3d.pitch = Math.max(-1.45, Math.min(1.45, drag.pitch + (e.clientY - drag.y) * 0.01));
    vol3dDraw();
    e.stopPropagation();
  });
  const end = (e) => {
    drag = null;
    e.stopPropagation();
  };
  cv.addEventListener("pointerup", end);
  cv.addEventListener("pointercancel", end);
  cv.addEventListener("wheel", (e) => {
    // 2.0.141: плавный зум — мышь и тачпад (величина прокрутки учитывается, пинч = ctrlKey)
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
    vol3d.zoom = Math.max(0.3, Math.min(8, vol3d.zoom * Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0018))));
    vol3dDraw();
    e.preventDefault();
    e.stopPropagation();
  }, { passive: false });
  cv.addEventListener("dblclick", (e) => {
    Object.assign(vol3d, { yaw: -0.6, pitch: 0.42, zoom: 1 });
    vol3dDraw();
    e.stopPropagation();
  });
}

