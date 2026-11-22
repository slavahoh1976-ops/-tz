// ===== 2.0.131: Волюметрик — готовые сетапы с координатной адресацией для MADRIX, MAD-SHOW и TouchDesigner =====
// Форматы повторяют файлы VolumetricMapper (примеры пользователя): MADRIX — патч .mpz, сетап .mpz с Art-Net устройствами,
// таблицы CSV (пиксели в 3D и universe); MAD-SHOW — .clen (патч MADRIX + Art-Net устройства внутри); TouchDesigner — .vmtd
// (атлас срезов + таблица Art-Net пакетов). Координаты: X — слева направо, Z — от фронта (0) назад, Y — сверху вниз (пиксель 1 — Y 0).
// Нити и universe — как в «Коммутации»: порядок кабинетов, порядок нитей в кабинете, IP по кабинетам, universe подряд.
const VOL_TPL = { patch: "{{b64:templates/vol/madrix_patch_head.xml.z}}", setup: "{{b64:templates/vol/madrix_setup.xml.z}}", clen: "{{b64:templates/vol/madshow.json.z}}" };
const volTplCache = {};
async function volTpl(k) {
  if (!volTplCache[k]) volTplCache[k] = dec.decode(await inflateRaw(b64ToBytes(VOL_TPL[k])));
  return volTplCache[k];
}
function bytesToB64(u8) {
  let s = "";
  for (let i = 0; i < u8.length; i += 32768) s += String.fromCharCode.apply(null, u8.subarray(i, i + 32768));
  return btoa(s);
}
const strB64 = (s) => bytesToB64(enc.encode(s));
async function gzipBytes(bytes) {
  const body = await deflateRaw(bytes), out = new Uint8Array(10 + body.length + 8), dv = new DataView(out.buffer);
  out.set([31, 139, 8, 0, 0, 0, 0, 0, 0, 255]);
  out.set(body, 10);
  dv.setUint32(10 + body.length, crc32(bytes), true);
  dv.setUint32(14 + body.length, bytes.length >>> 0, true);
  return out;
}
const volDate = () => {
  const d = new Date(), p = (v) => String(v).padStart(2, "0");
  return "".concat(d.getFullYear(), "/", p(d.getMonth() + 1), "/", p(d.getDate()), " ", p(d.getHours()), ":", p(d.getMinutes()), ":", p(d.getSeconds()));
};
// адресация: нити (x, z, кабинет, номер в кабинете, universe, канал) и universe (IP, порт кабинета)
function volAddr(st) {
  const g = volGeom(st), V = g.V, px = V.px, ch = px * 3;
  const pitch = Math.round(V.cw * 10 / V.sx * 10) / 10;
  const strands = g.strands.map((s2) => ({ x: s2.x, z: s2.z, cab: s2.cab, n: s2.n, uni: s2.cab * g.uniPerCab + s2.uni, ch: s2.n % g.perUni * ch }));
  const unis = [];
  for (const cab of g.cabs) for (let p = 0; p < g.uniPerCab; p++) unis.push({ u: cab.n * g.uniPerCab + p, cab: cab.n, ip: cab.ip, port: p });
  return { g, V, px, ch, W: g.NX, D: g.NZ, H: px, strands, unis, pitch, dev: "3DP" + String(pitch) };
}
function volCsvFixtures(A) {
  const L = ["﻿Product;Display Name;Fixture ID;Position X;Position Y;Position Z;DMX Universe;DMX Channel"];
  let id = 1;
  for (const s2 of A.strands) for (let p = 0; p < A.px; p++) L.push("Generic RGB;M".concat(s2.cab + 1, "-T", s2.n + 1, "-P", p + 1, ";", id++, ";", s2.x, ";", p, ";", s2.z, ";", s2.uni + 1, ";", s2.ch + p * 3 + 1));
  return L.join("\r\n") + "\r\n";
}
function volCsvUnis(A) {
  const L = ["﻿madrix_universe;artnet_universe;artnet_net;artnet_subnet;artnet_universe_in_subnet;ip;module;port_in_module"];
  for (const u of A.unis) L.push("".concat(u.u + 1, ";", u.u, ";", u.u >> 8, ";", u.u >> 4 & 15, ";", u.u & 15, ";", u.ip, ";", u.cab + 1, ";", u.port + 1));
  return L.join("\r\n") + "\r\n";
}
function volChannels(px, ver) {
  let s = "";
  for (let p = 0; p < px; p++) for (let c = 0; c < 3; c++) {
    const n = p * 3 + c;
    s += "<channel version=\"".concat(ver, "\"", n ? " number=\"" + n + "\"" : "", c ? " color_channel=\"" + c + "\"" : "", p ? " x=\"0\" y=\"" + p + "\" z=\"0\"" : "", "/>");
  }
  return s;
}
const volFill = (t, A) => t.split("@@DATE@@").join(volDate()).split("@@X@@").join(String(A.W)).split("@@Y@@").join(String(A.H)).split("@@Z@@").join(String(A.D));
const volPad = (n) => String(n).padStart(4, "0");
const volDmx = (s2) => (s2.uni ? "<dmx_universe value=\"" + (s2.uni + 1) + "\"/>" : "") + (s2.ch ? "<dmx_channel value=\"" + s2.ch + "\"/>" : "");
// патч MADRIX (как volumetric.mpz): XML без gzip — он же LayoutInfo в MAD-SHOW
async function volPatchXml(A) {
  const nm = "NEW_" + A.px, spec = "<fixture_specification version=\"0x05000000\"><manufacturer value=\"".concat(nm, "\"/><homepage value=\"", nm, "\"/><fixture_name value=\"", nm, "\"/><operation_mode value=\"clen\"/><pixel_count version=\"0x03000000\" x=\"1\" y=\"", A.px, "\" z=\"1\"/><dmx_channel_count value=\"", A.ch, "\"/>", volChannels(A.px, "0x00000000"), "</fixture_specification>");
  const head = "<fixture version=\"0x05000000\" fixture_uuid=\"943737d5-ac41-49ae-ad6c-54e4c781b2f4\">" + spec, parts = [volFill(await volTpl("patch"), A), "<fixture_list version=\"0x05000000\">"];
  A.strands.forEach((s2, i) => parts.push(head, "<fixture_settings version=\"0x05000000\"><fixture_id value=\"".concat(i, "\"/><display_name_user value=\" #", volPad(i + 1), "\"/><position version=\"0x00000000\" x=\"", s2.x, "\" y=\"0\" z=\"", s2.z, "\" />", volDmx(s2), "</fixture_settings></fixture>")));
  parts.push("</fixture_list><fixture_group_list version=\"0x03040000\"/></patch></madrix_patch>");
  return parts.join("");
}
const ipInt = (ip) => ip.split(".").reduce((a, v, i) => a + (+v || 0) * Math.pow(256, i), 0);
const hex2 = (v) => (v & 255).toString(16).toUpperCase().padStart(2, "0");
// сетап MADRIX (как volumetric_madrix.mpz): Art-Net устройство на каждый universe + патч
async function volSetupXml(A) {
  const nm = "VL" + A.px, bind = {}, dev = [], fx = ["<fixture_list version=\"0x05000000\">"];
  for (const u of A.unis) {
    const b = bind[u.ip] = bind[u.ip] == null ? 0 : bind[u.ip] + 1, o = u.ip.split(".").map(Number);
    dev.push("<dmx_device version=\"0x03000000\" index=\"".concat(dev.length, "\"><title value=\"", A.dev, " (", u.ip, ") ", b ? "BindIdx" + b + " " : "", "Port:0 \"/><universe value=\"", u.u + 1, "\"/><activ value=\"1\"/><in_out value=\"0\"/><protocol value=\"1\" info=\"Network Art-Net\"/><frametime value=\"30\"/><fullframes value=\"0\"/><settings_artnet version=\"0x03000000\"><artnet_id value=\"", ipInt(u.ip), "\"/><artnet_id_bind_idx value=\"", b, "\"/><artnet_id_man value=\"00000000-0000-0000-0000-000000000000\"/><artnet_dev_type value=\"1\"/><artnet_dev_enable_1 value=\"1\"/><artnet_dev_enable_2 value=\"0\"/><artnet_dev_enable_3 value=\"0\"/><artnet_dev_enable_4 value=\"0\"/><artnet_mac value=\"02:00:", hex2(o[3]), ":00:00:00\"/><artnet_style value=\"0\"/><artnet_major value=\"4\"/><artnet_minor value=\"2\"/><artnet_use_broadcast_send value=\"0\"/><artnet_use_broadcast_receive value=\"0\"/><artnet_ip value=\"", u.ip, "\"/><artnet_oem_code value=\"255\"/><artnet_oem_manufacturer value=\"Artistic Licence Engineering Ltd\"/><artnet_oem_product value=\"developer\"/><artnet_esta_1 value=\"0\"/><artnet_esta_2 value=\"0\"/><artnet_config_by_web value=\"8\"/><artnet_name_short value=\"", A.dev, "\"/><artnet_name_long value=\"Art-net Controller 240619\"/><artnet_port_numbers value=\"1\"/><artnet_port_type_1 value=\"2\" info=\"output\"/><artnet_port_type_2 value=\"0\" info=\"none\"/><artnet_port_type_3 value=\"0\" info=\"none\"/><artnet_port_type_4 value=\"0\" info=\"none\"/><artnet_port_protocol_1 value=\"0\"/><artnet_port_protocol_2 value=\"5\"/><artnet_port_protocol_3 value=\"5\"/><artnet_port_protocol_4 value=\"5\"/><artnet_port_net_switch value=\"", u.u >> 8, "\"/><artnet_port_sub_switch value=\"", u.u >> 4 & 15, "\"/><artnet_universe_in_1 value=\"", u.u & ~15, "\"/><artnet_universe_in_2 value=\"0\"/><artnet_universe_in_3 value=\"0\"/><artnet_universe_in_4 value=\"0\"/><artnet_universe_out_1 value=\"", u.u, "\"/><artnet_universe_out_2 value=\"0\"/><artnet_universe_out_3 value=\"0\"/><artnet_universe_out_4 value=\"0\"/><artnet_universe_virt_1 value=\"", u.u + 1, "\"/><artnet_universe_virt_2 value=\"1\"/><artnet_universe_virt_3 value=\"1\"/><artnet_universe_virt_4 value=\"1\"/><artnet_universe_virt_1_input value=\"", (u.u & ~15) + 1, "\"/><artnet_universe_virt_2_input value=\"1\"/><artnet_universe_virt_3_input value=\"1\"/><artnet_universe_virt_4_input value=\"1\"/><artnet_frame_time_1 value=\"30\"/><artnet_frame_time_2 value=\"30\"/><artnet_frame_time_3 value=\"30\"/><artnet_frame_time_4 value=\"30\"/><artnet_full_frames_1 value=\"0\"/><artnet_full_frames_2 value=\"0\"/><artnet_full_frames_3 value=\"0\"/><artnet_full_frames_4 value=\"0\"/><artnet_bind_ip value=\"", o[0], ".0.0.0\"/><artnet_ac_led_mode value=\"2\"/></settings_artnet></dmx_device>"));
  }
  const head = "<fixture version=\"0x05000000\" fixture_uuid=\"98f7753a-15a5-43e0-9da9-420bc97187de\"><fixture_specification version=\"0x05000000\"><manufacturer value=\"".concat(nm, "\"/><fixture_name value=\"", nm, "\"/><operation_mode value=\"", nm, "\"/><pixel_count version=\"0x03000000\" x=\"1\" y=\"", A.px, "\" z=\"1\"/><dmx_channel_count value=\"", A.ch, "\"/>", volChannels(A.px, "0x05000000"), "</fixture_specification>");
  A.strands.forEach((s2, i) => fx.push(head, "<fixture_settings version=\"0x05000000\"><fixture_id value=\"".concat(i, "\"/><display_name_user value=\"", nm, " #", volPad(i + 1), "\"/><position version=\"0x03000000\" x=\"", s2.x, "\" y=\"0\" z=\"", s2.z, "\"/>", volDmx(s2), "</fixture_settings></fixture>")));
  fx.push("</fixture_list>");
  return volFill(await volTpl("setup"), A).replace("@@DEV@@", () => dev.join("")).replace("@@FIX@@", () => fx.join(""));
}
// MAD-SHOW (.clen): «MAD-SHOW» + JSON; LayoutInfo — патч MADRIX, DeviceInfo — Art-Net устройства (по одному на universe)
const leB = (v, n) => {
  const a = [];
  for (let i = 0; i < n; i++) a.push(Math.floor(v / Math.pow(256, i)) & 255);
  return bytesToB64(Uint8Array.from(a));
};
async function volClen(A) {
  const bind = {}, devs = [];
  for (const u of A.unis) {
    const b = bind[u.ip] = bind[u.ip] == null ? 0 : bind[u.ip] + 1, ip = bytesToB64(Uint8Array.from(u.ip.split(".").map(Number).reverse()));
    const d = "{\"m_bindIndex\":\"".concat(leB(b, 1), "\",\"m_channel\":\"AAA=\",\"m_channels\":\"AA==\",\"m_data\":\"QXJ0LU5ldAAAgwAOAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJI=\",\"m_dmx_addr\":\"AAA=\",\"m_give_up_pix_number\":\"AA==\",\"m_height\":\"AA==\",\"m_ic_select\":\"AA==\",\"m_ipv4\":\"", ip, "\",\"m_ledNumber\":\"AA==\",\"m_led_pixel_number\":\"AA==\",\"m_mac[0]\":\"Ag==\",\"m_mac[1]\":\"AA==\",\"m_mac[2]\":\"Aw==\",\"m_mac[3]\":\"SQ==\",\"m_mac[4]\":\"AA==\",\"m_mac[5]\":\"Nw==\",\"m_mode\":\"AA==\",\"m_name\":\"", A.dev, "\",\"m_pixel\":\"AA==\",\"m_pixelCount\":\"AA==\",\"m_playMode\":\"AA==\",\"m_playTime\":\"AQ==\",\"m_portFlicker\":\"AA==\",\"m_portNumber\":\"AA==\",\"m_portState\":\"AA==\",\"m_portTest\":\"AA==\",\"m_ports\":\"AQA=\",\"m_sd_effect\":\"AA==\",\"m_sd_light\":\"AA==\",\"m_sd_speed\":\"AA==\",\"m_spare\":\"", ip, "\",\"m_subNet\":\"AAAAAA==\",\"m_swoutMapping[0]\":\"", leB(u.u, 2), "\",\"m_swoutMapping[1]\":\"AAA=\",\"m_swoutMapping[2]\":\"AAA=\",\"m_swoutMapping[3]\":\"AAA=\",\"m_swout[0]\":\"AA==\",\"m_swout[1]\":\"AA==\",\"m_swout[2]\":\"AA==\",\"m_swout[3]\":\"AA==\",\"m_type\":\"AA==\",\"m_universe\":\"AAA=\",\"m_universes\":\"", leB(u.u, 2), "\"}");
    devs.push("{\"DeviceInfo\":\"" + strB64(d) + "\",\"Enable\":true}");
  }
  let t = await volTpl("clen");
  // размер объёма в эффектах рабочих областей (Render X/Y/Z, m_renderX/Y/Z) — под эту конструкцию
  t = t.replace(/"WorkareaInfo":"([^"]*)"/, (m0, b) => {
    let w = dec.decode(b64ToBytes(b));
    w = w.replace(/"Data":"([^"]*)"/g, (m1, d) => "\"Data\":\"" + strB64(dec.decode(b64ToBytes(d)).replace(/"Render X":\d+,"Render Y":\d+,"Render Z":\d+/g, "\"Render X\":".concat(A.W, ",\"Render Y\":", A.H, ",\"Render Z\":", A.D))) + "\"");
    w = w.replace(/"m_renderX":\d+/g, "\"m_renderX\":" + A.W).replace(/"m_renderY":\d+/g, "\"m_renderY\":" + A.H).replace(/"m_renderZ":\d+/g, "\"m_renderZ\":" + A.D);
    return "\"WorkareaInfo\":\"" + strB64(w) + "\"";
  });
  const layout = strB64(await volPatchXml(A)), device = strB64("{\"0\":[" + devs.join(",") + "]}");
  return "MAD-SHOW" + t.replace("@@LAYOUTINFO@@", () => layout).replace("@@DEVICEINFO@@", () => device);
}
// TouchDesigner (.vmtd): срезы по высоте в атласе (плитка = срез W×D), на каждый universe — 512 индексов байтов RGBA атласа (−1 — пусто)
const pyNum = (v) => Number.isInteger(v) ? v + ".0" : String(v);
function volVmtd(A) {
  const tx = Math.ceil(Math.sqrt(A.H)), ty = Math.ceil(A.H / tx), aw = tx * A.W, ah = ty * A.D, n = A.unis.length;
  const idx = new Int32Array(n * 512).fill(-1), at = new Map(A.unis.map((u, i) => [u.u, i]));
  for (const s2 of A.strands) {
    const base = at.get(s2.uni) * 512 + s2.ch;
    for (let p = 0; p < A.px; p++) {
      const pix = (Math.floor(p / tx) * A.D + s2.z) * aw + p % tx * A.W + s2.x;
      for (let c = 0; c < 3; c++) idx[base + p * 3 + c] = pix * 4 + c;
    }
  }
  const pitchY = A.V.len * 1000 / A.px, pz = Math.round(A.V.cd * 10 / A.V.sz * 10) / 10;
  return "{\"format\": \"volumetric-mapper-td\", \"version\": 1, \"W\": ".concat(A.W, ", \"D\": ", A.D, ", \"H\": ", A.H, ", \"tiles_x\": ", tx, ", \"tiles_y\": ", ty, ", \"atlas_w\": ", aw, ", \"atlas_h\": ", ah, ", \"pitch_x_mm\": ", pyNum(A.pitch), ", \"pitch_z_mm\": ", pyNum(pz), ", \"pitch_y_mm\": ", pyNum(pitchY), ", \"modules_x\": ", A.V.cx, ", \"modules_z\": ", A.V.cz, ", \"pixels\": ", A.px, ", \"phantoms\": [], \"color_order\": \"RGB\", \"packets\": [", A.unis.map((u) => "[\"" + u.ip + "\", " + u.u + "]").join(", "), "], \"index_int32_le_b64\": \"", bytesToB64(new Uint8Array(idx.buffer)), "\"}");
}
// все файлы адресации одной конструкции; what — { madrix, madshow, td }
async function volSetupFiles(st, what, dir) {
  const A = volAddr(st), base = safeFile(st.name || "volumetric", "volumetric"), out = [];
  if (!A.strands.length) return out;
  if (what.madrix !== false) {
    busy("MADRIX: " + base + "…");
    await tick();
    out.push({ name: dir + "MADRIX/" + base + "_madrix_patch.mpz", data: await gzipBytes(enc.encode(await volPatchXml(A))) });
    out.push({ name: dir + "MADRIX/" + base + "_madrix_setup.mpz", data: await gzipBytes(enc.encode(await volSetupXml(A))) });
    out.push({ name: dir + "MADRIX/" + base + "_madrix_fixtures_3D.csv", data: enc.encode(volCsvFixtures(A)) });
    out.push({ name: dir + "MADRIX/" + base + "_madrix_universes.csv", data: enc.encode(volCsvUnis(A)) });
  }
  if (what.madshow !== false) {
    busy("MAD-SHOW: " + base + "…");
    await tick();
    out.push({ name: dir + "MAD-SHOW/" + base + ".clen", data: enc.encode(await volClen(A)) });
  }
  if (what.td !== false) {
    busy("TouchDesigner: " + base + "…");
    await tick();
    out.push({ name: dir + "TouchDesigner/" + base + ".vmtd", data: enc.encode(volVmtd(A)) });
  }
  return out;
}
// конструкции-волюметрики, которые отмечены в ТЗ (в порядке ТЗ)
const tzVolScreens = () => tzOrder().filter((o) => o.st && o.st.kind === "vol" && o.st.vol && tzMaskOn(o.st)).map((o) => o.st);
const tzVolWhat = () => ({ madrix: adrUnlocked && project.tz.adrMadrix === true, madshow: adrUnlocked && project.tz.adrMadshow === true, td: adrUnlocked && project.tz.adrTd === true });
// 2.0.134: адресация недоступна в бесплатной версии — галочки не ставятся, появляется сообщение.
// Секрет: пока сообщение на экране, вслепую набрать 168 — функция открывается до «Нового» проекта
// (2.0.135: не запоминается — после «Нового» и при новом запуске снова закрыта).
var adrUnlocked = false;
try {
  localStorage.removeItem("ledmask-adr");
} catch (e) {
}
async function adrLocked(after) {
  if (adrUnlocked) return false;
  let buf = "";
  const key = (e) => {
    if (!/^\d$/.test(e.key)) return;
    e.preventDefault();
    e.stopPropagation();
    buf = (buf + e.key).slice(-3);
    if (buf !== "168") return;
    adrUnlocked = true;
    $("modalOk").click();
  };
  window.addEventListener("keydown", key, true);
  $("modalCancel").hidden = true;
  await ask("Функция недоступна", "Готовые сетапы с адресацией для MADRIX, MAD-SHOW и TouchDesigner недоступны в бесплатной версии.", "", "OK", false);
  window.removeEventListener("keydown", key, true);
  $("modalCancel").hidden = false;
  if (adrUnlocked) {
    syncTzTpl();
    if (after) after();
  }
  return !adrUnlocked;
}
async function volSetupAll(dir) {
  const what = tzVolWhat(), files = [], list = tzVolScreens(), many = list.length > 1;
  if (!what.madrix && !what.madshow && !what.td) return files;
  for (const st of list) files.push(...await volSetupFiles(st, what, dir + (many ? safeFile(st.name || "volumetric", "volumetric") + "/" : "")));
  return files;
}
async function exportVolSetup() {
  try {
    if (!tzVolScreens().length) return status("В ТЗ не отмечено ни одной конструкции", true);
    const w = tzVolWhat();
    if (!w.madrix && !w.madshow && !w.td) return status("Не выбрана ни одна программа", true);
    const project_ = safeName(project.name, "Проект"), folder = "".concat(project_, " Адресация").concat(verSfx(), "/");
    const files = await volSetupAll(folder);
    busy("Упаковка ZIP…");
    await tick();
    const z = await zip(files);
    busy("");
    await save("".concat(project_, " Адресация").concat(verSfx(), ".zip"), z);
  } catch (e) {
    busy("");
    status("Ошибка: " + e.message, true);
  }
}
async function exportTZ(label) {
  if (!TPL[label]) {
    status("Шаблон для этого ТЗ ещё не добавлен", true);
    return;
  }
  // 2.0.115: проект в архиве ТЗ и следующее «Сохранить» — с этим типом ТЗ
  project.tz.tpl = label;
  const items = tzItems();
  if (!items.length) {
    status("В ТЗ ничего не отмечено", true);
    return;
  }
  // 3.0.41: встроенный шрифт — до рендера (надписи масок им, в PDF/SVG — кривыми)
  try {
    await SANS_READY;
  } catch (e) {
  }
  // 2.0.150: если ТЗ с таким именем в этом браузере уже выгружали — предложить поднять версию (v2, v3 …)
  const tzBase0 = "".concat(safeName(project.name, "Проект"), " ТЗ_").concat(tzTag(label)).concat(verSfx());
  if (tzWasSaved(tzBase0)) {
    const r = await askBump("Такая версия ТЗ уже сохранялась", "Файл «".concat(tzBase0, ".zip» в этом браузере уже выгружался. Если сохраняете в ту же папку, поднимите версию, чтобы не затереть предыдущую — или оставьте имя как есть."), nextVer(project.ver));
    if (r === null) return;
    if (r.ver != null) {
      let v = String(r.ver).trim().slice(0, 20);
      if (/^\d+$/.test(v)) v = "v" + v;
      project.ver = v;
      if ($("projVer")) $("projVer").value = project.ver;
      scheduleAutosave();
    }
  }
  try {
    const project_ = safeName(project.name, "Проект"), tag = tzTag(label), folder = "".concat(project_, " ТЗ_").concat(tag).concat(verSfx(), "/"), pngs = [], uniq = uniqueNamer();
    for (let n = 0; n < items.length; n++) {
      const it = items[n];
      busy("Рендер ".concat(n + 1, " из ").concat(items.length, ": ").concat(it.w, "×").concat(it.h, "…"));
      await tick();
      const r = it.kind === "out" ? await renderOutPNG(it.m, it.scr) : it.kind === "cut" ? await renderCutPNG(it.c) : it.kind === "cutsrc" ? await renderBands(it.w, it.h, (ctx) => paintCutSrc(ctx, it.c, 1)) : it.kind === "field" ? await renderFieldPNG(it.f) : it.kind === "volcom" || it.kind === "vol3d" ? await renderBands(it.w, it.h, (ctx) => volItemPaint(ctx, it)) : await renderPNG(it.st);
      const base = it.kind === "out" ? outFileName(it.m, it.scr).replace(/\.png$/, "") : it.kind === "cut" ? cutFileBase(it.c) : it.kind === "cutsrc" ? cutFileBase(it.c) + "-source" : it.kind === "field" ? fieldFileBase(it.f) : it.kind === "volcom" || it.kind === "vol3d" ? "".concat(safeFile(it.st.name || "volumetric", "volumetric"), it.kind === "volcom" ? it.com ? "-wiring-top" : "-bottom-view" : "-3D") : maskFileBase(it.st);
      pngs.push({ ...r, w: r.w || it.w, h: r.h || it.h, file: "".concat(folder).concat(uniq(base), ".png"), label: it.label, key: it.key, info: it.info, noFile: it.kind === "cutsrc" });
    }
    // 3.0.4: в документ — уменьшенные копии больших картинок (иначе часть iPhone показывает лист мешаниной)
    busy("Подготовка картинок для PPTX и PDF…");
    await tick();
    const ov = await docImgs(tzImages());
    busy("Сборка PPTX…");
    await tick();
    const masks = await docMasks(pngs.map((p) => ({ png: p.png, w: p.w, h: p.h, label: p.label, key: p.key, info: p.info, vec: p.vec })));
    await tplInfo(label);
    const pptBytes = new Uint8Array(await (await buildPptx(TPL[label], masks, ov, label)).arrayBuffer());
    busy("Сборка PDF…");
    await tick();
    const pdfBytes = new Uint8Array(await (await buildPdf(label, masks, ov)).arrayBuffer());
    busy("Упаковка ZIP…");
    await tick();
    const files = [{ name: "".concat(folder).concat(project_, "_ТЗ_").concat(tag).concat(verSfx(), ".pptx"), data: pptBytes }, { name: "".concat(folder).concat(project_, "_ТЗ_").concat(tag).concat(verSfx(), ".pdf"), data: pdfBytes }, ...pngs.filter((p) => !p.noFile).map((p) => ({ name: p.file, data: p.png }))];
    // 3.0.39: папка SVG — маски и поля вектором (галочка «SVG-маски в архив», по умолчанию выключена; не для волюметрика)
    if (project.tz.svgMasks === true && !/^Vol/.test(label)) {
      const sv = pngs.filter((p) => !p.noFile && p.vec);
      for (let n = 0; n < sv.length; n++) {
        busy("SVG ".concat(n + 1, " из ").concat(sv.length, "…"));
        await tick();
        const svg = svgVecRecord(sv[n].vec);
        if (svg) files.push({ name: sv[n].file.replace(folder, folder + "SVG/").replace(/\.png$/, ".svg"), data: enc.encode(svg) });
      }
      busy("Упаковка ZIP…");
      await tick();
    }
    // 2.0.131: ТЗ «Волюметрик» — готовые сетапы с адресацией (MADRIX, MAD-SHOW, TouchDesigner) в папке «Адресация»
    if (/^Vol/.test(label)) files.push(...await volSetupAll(folder + "Адресация/"));
    if (project.tz.projZip !== false) {
      // 2.0.37: файл проекта — в тот же архив, рядом с PPTX, PDF и PNG (галочка «Файл проекта в архив», по умолчанию включена)
      const f = projectFile();
      files.push({ name: "".concat(folder).concat(f.name), data: typeof f.data === "string" ? enc.encode(f.data) : f.data });
    }
    const z = await zip(files);
    busy("");
    const zok = await save("".concat(project_, " ТЗ_").concat(tag).concat(verSfx(), ".zip"), z);
    if (zok !== false) {
      tzMarkSaved("".concat(project_, " ТЗ_").concat(tag).concat(verSfx()));
      recentAdd("ТЗ " + tzName(label) + (project.tz.projZip !== false ? " (проект в архиве)" : ""));
    }
  } catch (e) {
    busy("");
    status("Ошибка экспорта ТЗ: " + e.message, true);
  }
}
$("btnPNG").onclick = exportCurrentPNG;
$("tVolSetup").onclick = async () => {
  if (await adrLocked()) return;
  exportVolSetup();
};
$("btnAllPNG").onclick = exportAllPNG;
$("btnTZgo").onclick = () => setPage("tz");
$("fTZgo").onclick = () => setPage("tz");
function openHelp(id) {
  $("help").hidden = false;
  document.body.style.overflow = "hidden";
  if (id) $(id).scrollIntoView();
  else $("helpBody").scrollTop = 0;
  $("helpClose").focus({ preventScroll: true });
}
function closeHelp() {
  $("help").hidden = true;
  document.body.style.overflow = "";
}
$("btnHelp").onclick = () => openHelp();
$("btnHelpTop").onclick = () => openHelp();
$("helpClose").onclick = closeHelp;
$("help").addEventListener("click", (e) => {
  if (e.target === $("help")) closeHelp();
});
document.querySelectorAll(".help-toc a").forEach((a) => a.onclick = (e) => {
  e.preventDefault();
  $(a.dataset.h).scrollIntoView({ behavior: "smooth", block: "start" });
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("help").hidden) {
    e.stopImmediatePropagation();
    closeHelp();
  }
}, true);
$("btnAuthors").onclick = () => {
  setPage("about");
  window.scrollTo({ top: 0, behavior: "smooth" });
};
// 2.0.114: версия проекта (v1, v24…) — в конце имён файлов: «Проект_ТЗ_Resolume_v24»
function verSfx() {
  const v = String(project.ver || "").trim();
  return v ? "_" + safeName(v, "v") : "";
}
// 2.0.150: следующая версия (поднимаем последнее число; пусто → v2; без числа → _v2)
function nextVer(v) {
  const s = String(v || "").trim();
  if (!s) return "v2";
  const m = s.match(/^(.*?)(\d+)(\D*)$/);
  if (m) {
    const n = +m[2] + 1, w = m[2].length;
    return m[1] + (m[2][0] === "0" ? String(n).padStart(w, "0") : String(n)) + m[3];
  }
  return s + "_v2";
}
// 2.0.150: помним выгруженные в этом браузере имена ТЗ, чтобы предложить поднять версию при повторном сохранении в ту же папку
const TZ_SAVED_KEY = "ledmask.tzSaved";
function tzSavedList() {
  try {
    return JSON.parse(lsGet(TZ_SAVED_KEY) || "[]");
  } catch (e) {
    return [];
  }
}
const tzWasSaved = (base) => tzSavedList().includes(base);
function tzMarkSaved(base) {
  try {
    const a = tzSavedList().filter((x) => x !== base);
    a.unshift(base);
    lsSet(TZ_SAVED_KEY, JSON.stringify(a.slice(0, 200)));
  } catch (e) {
  }
}
// 2.0.150: диалог с тремя кнопками — поднять версию (поле редактируемое) / оставить имя / отмена
function askBump(title, text, value) {
  return new Promise((res) => {
    $("modalTitle").textContent = title;
    $("modalText").textContent = text || "";
    $("modalText").hidden = !text;
    const inp = $("modalInput");
    inp.hidden = false;
    inp.value = value || "";
    $("modalOk").textContent = "Сохранить с новой версией";
    const alt = $("modalAlt");
    alt.hidden = false;
    alt.textContent = "Оставить имя";
    $("modalCancel").textContent = "Отмена";
    $("modal").hidden = false;
    setTimeout(() => {
      inp.focus();
      inp.select();
    }, 30);
    const done = (v) => {
      $("modal").hidden = true;
      $("modalOk").textContent = "OK";
      alt.hidden = true;
      alt.textContent = "Не сохранять";
      $("modalOk").onclick = $("modalCancel").onclick = alt.onclick = inp.onkeydown = null;
      res(v);
    };
    $("modalOk").onclick = () => done({ ver: inp.value });
    alt.onclick = () => done({ keep: true });
    $("modalCancel").onclick = () => done(null);
    inp.onkeydown = (e) => {
      if (e.key === "Enter") done({ ver: inp.value });
      if (e.key === "Escape") done(null);
    };
  });
}
const projectFile = () => STANDALONE ? { name: "".concat(safeName(project.name, "Проект")).concat(verSfx(), ".ledmask"), data: toPlist(ledmaskData()) } : { name: "".concat(safeName(project.name, "Проект")).concat(verSfx(), ".ledmask.json"), data: JSON.stringify(projectData(), null, 1) };
