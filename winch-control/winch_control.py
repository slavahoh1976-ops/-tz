#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Winch Control 1.01 — пульт для DMX-лебёдок (EastSun ES-L32 и другие) по Art-Net.

Запуск:
    python winch_control.py            — откроется пульт в браузере
    python winch_control.py --lan      — плюс доступ с планшета/телефона в той же сети
    python winch_control.py --port 9000 --no-browser

Нужен только Python 3.8+ (сторонние библиотеки не нужны).
Шоу (патч, пресеты, группы, последовательности) сохраняется в winch_show.json рядом с программой.
"""
import argparse, base64, json, math, os, random, socket, struct, subprocess, sys, threading, time, traceback, webbrowser
import urllib.request
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

VERSION = '1.01'
BASE_DIR = os.path.dirname(os.path.abspath(sys.executable if getattr(sys, 'frozen', False) else __file__))
SHOW_FILE = os.path.join(BASE_DIR, 'winch_show.json')

# Встроенная библиотека приборов. Роли каналов:
#   safety  — вкл/выкл мотора (on/off)      pos_hi / pos_lo — позиция 16 бит (грубо / fine)
#   pos8    — позиция 8 бит                 speed — скорость (fast = значение при 100%, slow — при минимуме)
#   reset   — сброс (val при сбросе, idle в покое)   fixed — постоянное значение (val)
BUILTIN_FIXTURES = [
    {'id': 'eastsun-es-l32-5ch', 'maker': 'EastSun', 'model': 'ES-L32', 'mode': '5CH · 16 бит', 'builtin': True, 'ch': [
        {'name': 'Safety', 'role': 'safety', 'on': 130, 'off': 0},
        {'name': 'Мотор', 'role': 'pos_hi'}, {'name': 'Мотор fine', 'role': 'pos_lo'},
        {'name': 'Скорость', 'role': 'speed', 'fast': 1, 'slow': 255},
        {'name': 'Reset', 'role': 'reset', 'val': 248, 'idle': 0}]},
    {'id': 'eastsun-es-l32-4ch', 'maker': 'EastSun', 'model': 'ES-L32', 'mode': '4CH · 8 бит', 'builtin': True, 'ch': [
        {'name': 'Safety', 'role': 'safety', 'on': 130, 'off': 0},
        {'name': 'Мотор', 'role': 'pos8'},
        {'name': 'Скорость', 'role': 'speed', 'fast': 1, 'slow': 255},
        {'name': 'Reset', 'role': 'reset', 'val': 248, 'idle': 0}]},
    {'id': 'generic-16bit', 'maker': 'Generic', 'model': 'Лебёдка', 'mode': '3CH · 16 бит', 'builtin': True, 'ch': [
        {'name': 'Позиция', 'role': 'pos_hi'}, {'name': 'Позиция fine', 'role': 'pos_lo'},
        {'name': 'Скорость', 'role': 'speed', 'fast': 255, 'slow': 0}]},
    {'id': 'generic-8bit', 'maker': 'Generic', 'model': 'Лебёдка', 'mode': '2CH · 8 бит', 'builtin': True, 'ch': [
        {'name': 'Позиция', 'role': 'pos8'}, {'name': 'Скорость', 'role': 'speed', 'fast': 255, 'slow': 0}]},
]
BUILTIN_IDS = {f['id'] for f in BUILTIN_FIXTURES}
DEFAULT_FIXTURE = 'eastsun-es-l32-5ch'
ROLES = ('safety', 'pos_hi', 'pos_lo', 'pos8', 'speed', 'reset', 'fixed')
FX_TYPES = ('wave', 'breathe', 'chase', 'pingpong', 'standing', 'random')
ORDERS = ('index', 'x', 'y', 'radial')
SHAPES = ('flat', 'line', 'v', 'a', 'sine', 'arc', 'checker', 'random')
TC_ACTIONS = ('preset', 'seq', 'seq_stop', 'fx', 'fx_stop', 'stop', 'home')


def clamp(v, a, b):
    return a if v < a else b if v > b else v


def ease(k):
    k = clamp(k, 0.0, 1.0)
    return 0.5 - 0.5 * math.cos(math.pi * k)


def frac(x):
    return x - math.floor(x)


def fnum(v, d=0.0):
    try:
        x = float(v)
        return x if math.isfinite(x) else d
    except (TypeError, ValueError):
        return d


def mk_winch(i, u, a):
    return {'id': i, 'name': str(i), 'universe': u, 'address': a, 'invert': False,
            'min': 0.0, 'max': 100.0, 'home': 0.0, 'enabled': True, 'fixture': DEFAULT_FIXTURE}


def default_show():
    return {
        'version': 1,
        'artnet': {'ip': '255.255.255.255', 'port': 6454, 'fps': 40, 'enabled': True, 'bind': ''},
        'device': {'reset_time': 2.0, 'speed': 60},
        'library': [],
        'layout': {'cols': 8},
        'winches': [mk_winch(i + 1, 0, 1 + i * 5) for i in range(8)],
        'groups': [], 'objects': [], 'presets': [], 'sequences': [],
        'timecode': {'enabled': False, 'source': 'artnet', 'port': 6454, 'offset': 0.0, 'fps': 25,
                     'chase': True, 'events': []},
    }


def b255(v, d=0):
    return int(clamp(fnum(v, d), 0, 255))


def norm_fixture(f, i):
    ch = []
    for c in (f.get('ch') or [])[:64]:
        if not isinstance(c, dict):
            continue
        role = c.get('role') if c.get('role') in ROLES else 'fixed'
        x = {'name': (str(c.get('name') or '').strip() or role)[:24], 'role': role}
        if role == 'safety':
            x['on'], x['off'] = b255(c.get('on'), 255), b255(c.get('off'), 0)
        elif role == 'speed':
            x['fast'], x['slow'] = b255(c.get('fast'), 255), b255(c.get('slow'), 0)
        elif role == 'reset':
            x['val'], x['idle'] = b255(c.get('val'), 255), b255(c.get('idle'), 0)
        elif role == 'fixed':
            x['val'] = b255(c.get('val'), 0)
        ch.append(x)
    fid = str(f.get('id') or 'u%d' % i)
    if fid in BUILTIN_IDS:
        fid = 'u-' + fid
    return {'id': fid, 'maker': str(f.get('maker') or '').strip()[:32] or 'Свой',
            'model': str(f.get('model') or '').strip()[:32] or 'Лебёдка %d' % (i + 1),
            'mode': str(f.get('mode') or '').strip()[:32] or '%dCH' % len(ch),
            'ch': ch or [{'name': 'Позиция', 'role': 'pos8'}]}


def normalize(s):
    d = default_show()
    if not isinstance(s, dict):
        s = {}
    s = {k: v for k, v in s.items() if not str(k).startswith('_')}
    for k, v in d.items():
        if k not in s or type(s[k]) is not type(v):
            s[k] = v
    for sect in ('artnet', 'device', 'layout', 'timecode'):
        for k, v in d[sect].items():
            s[sect].setdefault(k, v)
    a = s['artnet']
    a['ip'] = str(a['ip']).strip() or '255.255.255.255'
    a['port'] = int(clamp(fnum(a['port'], 6454), 1, 65535))
    a['fps'] = int(clamp(fnum(a['fps'], 40), 1, 44))
    a['enabled'] = bool(a['enabled'])
    a['bind'] = str(a.get('bind') or '').strip()
    dv = s['device']
    legacy = {'5ch': 'eastsun-es-l32-5ch', '4ch': 'eastsun-es-l32-4ch'}.get(dv.pop('profile', None), DEFAULT_FIXTURE)
    for k in ('safety_on', 'safety_off', 'reset_val'):
        dv.pop(k, None)
    lib, lids = [], set()
    for i, f in enumerate(s['library']):
        if isinstance(f, dict):
            x = norm_fixture(f, i)
            if x['id'] in lids:
                x['id'] += '-%d' % i
            lids.add(x['id'])
            lib.append(x)
    s['library'] = lib
    fix_ids = BUILTIN_IDS | lids
    dv['reset_time'] = clamp(fnum(dv['reset_time'], 2), 0.2, 10)
    dv['speed'] = clamp(fnum(dv['speed'], 60), 1, 100)
    s['layout']['cols'] = int(clamp(fnum(s['layout']['cols'], 8), 1, 64))

    ws, seen = [], set()
    for w in s['winches']:
        if not isinstance(w, dict):
            continue
        x = mk_winch(0, 0, 1)
        x['fixture'] = legacy
        x.update(w)
        if x['fixture'] not in fix_ids:
            x['fixture'] = DEFAULT_FIXTURE
        wid = int(fnum(x['id'], 0))
        if wid <= 0 or wid in seen:
            wid = max(seen | {0}) + 1
        seen.add(wid)
        x['id'] = wid
        x['name'] = (str(x['name']).strip() or str(wid))[:24]
        x['universe'] = int(clamp(fnum(x['universe']), 0, 32767))
        x['address'] = int(clamp(fnum(x['address'], 1), 1, 512))
        x['invert'] = bool(x['invert'])
        x['enabled'] = bool(x['enabled'])
        mn, mx = clamp(fnum(x['min']), 0, 100), clamp(fnum(x['max'], 100), 0, 100)
        if mx < mn:
            mn, mx = mx, mn
        x['min'], x['max'] = mn, mx
        x['home'] = clamp(fnum(x['home']), 0, 100)
        ws.append({k: x[k] for k in mk_winch(0, 0, 1)})
    s['winches'] = ws

    gs = []
    for g in s['groups']:
        if isinstance(g, dict) and isinstance(g.get('members'), list):
            gs.append({'id': str(g.get('id') or 'g%d' % len(gs)), 'name': str(g.get('name') or 'Группа')[:32],
                       'members': [int(fnum(m)) for m in g['members'] if int(fnum(m)) in seen]})
    s['groups'] = gs

    used, objs = set(), []
    for o in s['objects']:
        if not isinstance(o, dict):
            continue
        mem = []
        for m in o.get('members') or []:
            m = int(fnum(m))
            if m in seen and m not in used:
                used.add(m)
                mem.append(m)
        if mem:
            objs.append({'id': str(o.get('id') or 'o%d' % len(objs)),
                         'name': str(o.get('name') or 'Экран %d' % (len(objs) + 1))[:32], 'members': mem})
    s['objects'] = objs

    ps = []
    for p in s['presets']:
        if not isinstance(p, dict) or not isinstance(p.get('pos'), dict):
            continue
        ps.append({'id': str(p.get('id') or 'p%d' % len(ps)), 'name': str(p.get('name') or 'Пресет')[:40],
                   'fade': clamp(fnum(p.get('fade'), 3), 0, 600),
                   'pos': {str(int(fnum(k))): clamp(fnum(v), 0, 100) for k, v in p['pos'].items()},
                   'speed': {str(int(fnum(k))): clamp(fnum(v, 60), 1, 100)
                             for k, v in (p.get('speed') or {}).items()},
                   'fx': [{'params': e['params'], 'members': [int(fnum(m)) for m in e.get('members') or [] if int(fnum(m)) in seen]}
                          for e in (p.get('fx') or []) if isinstance(e, dict) and isinstance(e.get('params'), dict)]})
    s['presets'] = ps

    qs = []
    for q in s['sequences']:
        if not isinstance(q, dict):
            continue
        cues = []
        for c in q.get('cues') or []:
            if not isinstance(c, dict):
                continue
            h = c.get('hold')
            hold = None if h in (None, '') else clamp(fnum(h), 0, 3600)
            cues.append({'preset': str(c.get('preset') or ''), 'fade': clamp(fnum(c.get('fade'), 3), 0, 600), 'hold': hold})
        qs.append({'id': str(q.get('id') or 's%d' % len(qs)), 'name': str(q.get('name') or 'Шоу')[:40],
                   'loop': bool(q.get('loop')), 'cues': cues})
    s['sequences'] = qs

    tc = s['timecode']
    tc['enabled'] = bool(tc['enabled'])
    tc['source'] = tc['source'] if tc['source'] in ('artnet', 'ltc', 'internal') else 'artnet'
    tc['port'] = int(clamp(fnum(tc['port'], 6454), 1, 65535))
    tc['offset'] = clamp(fnum(tc['offset']), 0, 86400)
    tc['fps'] = int(fnum(tc['fps'], 25)) if int(fnum(tc['fps'], 25)) in (24, 25, 30) else 25
    tc['chase'] = bool(tc['chase'])
    evs = []
    for e in tc.get('events') or []:
        if not isinstance(e, dict) or e.get('action') not in TC_ACTIONS:
            continue
        f = e.get('fade')
        x = {'id': str(e.get('id') or 'e%d' % len(evs)), 't': clamp(fnum(e.get('t')), 0, 172800),
             'action': e['action'], 'ref': str(e.get('ref') or ''),
             'fade': None if f in (None, '') else clamp(fnum(f), 0, 600), 'note': str(e.get('note') or '')[:60]}
        if e['action'] == 'fx':
            x['params'] = e.get('params') if isinstance(e.get('params'), dict) else {}
            x['members'] = [int(fnum(m)) for m in (e.get('members') or []) if int(fnum(m)) in seen]
        evs.append(x)
    evs.sort(key=lambda e: e['t'])
    tc['events'] = evs
    return s


def load_show():
    try:
        with open(SHOW_FILE, 'r', encoding='utf-8') as f:
            return normalize(json.load(f))
    except FileNotFoundError:
        return default_show()
    except Exception as e:
        print('! Не удалось прочитать', SHOW_FILE, e)
        return default_show()


def save_file(text):
    tmp = SHOW_FILE + '.tmp'
    try:
        with open(tmp, 'w', encoding='utf-8') as f:
            f.write(text)
        os.replace(tmp, SHOW_FILE)
    except Exception as e:
        print('! Не удалось сохранить шоу:', e)


def artdmx(seq, uni, data):
    return (b'Art-Net\x00' + struct.pack('<H', 0x5000) + struct.pack('>HBB', 14, seq, 0)
            + struct.pack('<H', uni & 0x7FFF) + struct.pack('>H', len(data)) + bytes(data))


def local_ips():
    ips = set()
    try:
        for i in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ips.add(i[4][0])
    except Exception:
        pass
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('10.255.255.255', 1))
        ips.add(s.getsockname()[0])
        s.close()
    except Exception:
        pass
    return sorted(i for i in ips if not i.startswith('127.'))


class Engine:
    def __init__(self):
        self.lock = threading.RLock()
        self.show = load_show()
        self.rev = 1
        self.rt, self.fx, self.fx_next, self.seq = {}, {}, 1, None
        self.master, self.armed, self.last_preset = 1.0, False, None
        self.stats = {'fps': 0, 'error': '', 'universes': []}
        self.sock, self.sock_key, self.sock_retry, self.sock_err = None, None, 0.0, ''
        self.dirty, self.saved_at = False, 0.0
        self.ifaces = local_ips()
        self.running = True
        self.tc = {'rx': None, 'rx_at': 0.0, 'rx_fps': 25, 'err': '', 'prev': None, 'last': None,
                   'run': False, 'base': self.show['timecode']['offset'], 'start': 0.0}
        self.rx_sock, self.rx_port = None, None
        self.teach = set()          # лебёдки в режиме настройки пределов (пределы временно не действуют)
        self.sync()

    # ---------- helpers ----------
    def changed(self):
        self.rev += 1
        self.dirty = True

    def winch(self, wid):
        for w in self.show['winches']:
            if w['id'] == wid:
                return w
        return None

    def ids(self, raw):
        if not raw:
            return []
        out = []
        for m in raw:
            m = int(fnum(m, -1))
            if m in self.rt and m not in out:
                out.append(m)
        return out

    def sync(self):
        dv, ids = self.show['device'], set()
        for w in self.show['winches']:
            ids.add(w['id'])
            if w['id'] not in self.rt:
                self.rt[w['id']] = {'pos': w['home'], 'fade': None, 'fx': None, 'speed': float(dv['speed']),
                                    'reset_until': 0.0, 'out': []}
        for k in list(self.rt):
            if k not in ids:
                del self.rt[k]
        for fid, f in list(self.fx.items()):
            f['members'] = [m for m in f['members'] if m in ids]
            if not f['members']:
                del self.fx[fid]
            else:
                self.fx_coords(f)
        if self.seq and not self.find_seq(self.seq['id']):
            self.seq = None

    def coords(self, members, order='index', reverse=False, linked=True):
        """Фаза эффекта для каждой лебёдки. Связанные лебёдки (объект/экран) получают общую фазу."""
        idx = {w['id']: i for i, w in enumerate(self.show['winches'])}
        cols = self.show['layout']['cols']
        ms = sorted({m for m in members if m in idx}, key=lambda m: idx[m])
        if not ms:
            return [], {}, {}, {}, {}
        om = {}
        if linked:
            for o in self.show['objects']:
                for m in o['members']:
                    om[m] = 'o:' + o['id']
        unit = {m: om.get(m, 'w:%d' % m) for m in ms}
        grp = {}
        for m in ms:
            grp.setdefault(unit[m], []).append(m)
        info = {k: (sum(idx[m] % cols for m in g) / len(g), sum(idx[m] // cols for m in g) / len(g),
                    min(idx[m] for m in g)) for k, g in grp.items()}
        keys = sorted(info, key=lambda k: info[k][2])
        rank = {k: i for i, k in enumerate(keys)}
        if order == 'x':
            raw = {k: info[k][0] for k in keys}
        elif order == 'y':
            raw = {k: info[k][1] for k in keys}
        elif order == 'radial':
            cx = sum(info[k][0] for k in keys) / len(keys)
            cy = sum(info[k][1] for k in keys) / len(keys)
            raw = {k: round(math.hypot(info[k][0] - cx, info[k][1] - cy), 4) for k in keys}
        else:
            raw = dict(rank)
        lo, hi = min(raw.values()), max(raw.values())
        n = len(set(raw.values()))
        uk = {k: ((raw[k] - lo) / (hi - lo) if hi > lo else 0.0) for k in keys}
        if reverse:
            uk = {k: 1 - v for k, v in uk.items()}
        u = {m: uk[unit[m]] for m in ms}
        uc = {m: (uk[unit[m]] * (n - 1) / n if n > 1 else 0.0) for m in ms}
        return ms, u, uc, unit, {m: rank[unit[m]] for m in ms}

    def fx_coords(self, f):
        p = f['params']
        _, f['u'], f['uc'], f['unit'], _ = self.coords(f['members'], p['order'], p['reverse'], p['linked'])

    def detach(self, m):
        r = self.rt[m]
        fid = r['fx']
        if fid in self.fx:
            f = self.fx[fid]
            if m in f['members']:
                f['members'].remove(m)
            if not f['members']:
                del self.fx[fid]
        r['fx'] = None

    def target(self, m, pos, fade, now):
        w, r = self.winch(m), self.rt.get(m)
        if not w or r is None:
            return
        self.detach(m)
        pos = clamp(fnum(pos), 0, 100) if m in self.teach else clamp(fnum(pos), w['min'], w['max'])
        if fade <= 0:
            r['pos'], r['fade'] = pos, None
        else:
            r['fade'] = {'from': r['pos'], 'to': pos, 't0': now, 'dur': fade}

    def find_preset(self, pid):
        return next((p for p in self.show['presets'] if p['id'] == pid), None)

    def find_seq(self, sid):
        return next((q for q in self.show['sequences'] if q['id'] == sid), None)

    def recall(self, pid, fade, now):
        p = self.find_preset(pid)
        if not p:
            raise ValueError('Пресет не найден')
        f = p['fade'] if fade is None else clamp(fnum(fade, 3), 0, 600)
        fxl = [e for e in p.get('fx') or [] if e['members']]
        fxm = {m for e in fxl for m in e['members']}
        for k, v in p['pos'].items():
            m = int(k)
            if m in self.rt and m not in fxm:
                self.target(m, v, f, now)
        for e in fxl:                       # эффекты, записанные в пресет, запускаются заново
            prm = dict(e['params'])
            if f > 0:
                prm['fadein'] = f
            try:
                self.api_fx_start({'ids': e['members'], 'params': prm}, now)
            except ValueError:
                pass
        for k, v in p.get('speed', {}).items():
            m = int(k)
            if m in self.rt:
                self.rt[m]['speed'] = v
        self.last_preset = pid

    def fxp(self, p, base=None):
        b = dict(base or {'type': 'wave', 'lo': 0, 'hi': 100, 'period': 8, 'spread': 1, 'width': 0.15,
                          'order': 'index', 'reverse': False, 'fadein': 3, 'linked': True})
        if isinstance(p, dict):
            b.update(p)
        return {'type': b['type'] if b['type'] in FX_TYPES else 'wave',
                'lo': clamp(fnum(b['lo']), 0, 100), 'hi': clamp(fnum(b['hi'], 100), 0, 100),
                'period': clamp(fnum(b['period'], 8), 0.3, 600), 'spread': clamp(fnum(b['spread'], 1), 0, 10),
                'width': clamp(fnum(b['width'], 0.15), 0.02, 0.5),
                'order': b['order'] if b['order'] in ORDERS else 'index', 'reverse': bool(b['reverse']),
                'fadein': clamp(fnum(b['fadein'], 3), 0, 60), 'linked': b.get('linked', True) is not False}

    def stop_fx(self, fid):
        f = self.fx.pop(fid, None)
        if f:
            for m in f['members']:
                if m in self.rt and self.rt[m]['fx'] == fid:
                    self.rt[m]['fx'] = None

    def run_cue(self, now):
        q = self.find_seq(self.seq['id'])
        cue = q['cues'][self.seq['idx']]
        self.seq['t0'] = now
        if self.find_preset(cue['preset']):
            self.recall(cue['preset'], cue['fade'], now)

    def advance(self, d, now):
        q = self.find_seq(self.seq['id']) if self.seq else None
        if not q or not q['cues']:
            self.seq = None
            return
        i = self.seq['idx'] + d
        if i >= len(q['cues']):
            if q['loop']:
                i = 0
            else:
                self.seq = None
                return
        self.seq['idx'] = max(0, i)
        self.run_cue(now)

    # ---------- API ----------
    def api_move(self, b, now):
        fade = clamp(fnum(b.get('fade')), 0, 600)
        if isinstance(b.get('abs'), dict):
            for k, v in b['abs'].items():
                self.target(int(fnum(k, -1)), v, fade, now)
        else:
            for m in self.ids(b.get('ids')):
                self.target(m, b.get('pos'), fade, now)

    def api_shape(self, b, now):
        sh = b.get('shape') if b.get('shape') in SHAPES else 'flat'
        ms, u, _, unit, rk = self.coords(self.ids(b.get('ids')), b.get('order', 'index'), bool(b.get('reverse')),
                                         b.get('linked', True) is not False)
        if not ms:
            raise ValueError('Выделите лебёдки')
        lo, hi = clamp(fnum(b.get('lo')), 0, 100), clamp(fnum(b.get('hi'), 100), 0, 100)
        fade = clamp(fnum(b.get('fade'), 3), 0, 600)
        idx = {w['id']: i for i, w in enumerate(self.show['winches'])}
        cols = self.show['layout']['cols']
        for m in ms:
            x = u[m]
            v = {'flat': 0.0, 'line': x, 'v': 1 - abs(2 * x - 1), 'a': abs(2 * x - 1),
                 'sine': 0.5 - 0.5 * math.cos(2 * math.pi * x),
                 'arc': math.sqrt(max(0.0, 1 - (2 * x - 1) ** 2)),
                 'checker': float(rk[m] % 2 if unit[m][0] == 'o' else (idx[m] % cols + idx[m] // cols) % 2),
                 'random': random.random()}[sh]
            self.target(m, lo + (hi - lo) * v, fade, now)

    def api_home(self, b, now):
        fade = clamp(fnum(b.get('fade'), 3), 0, 600)
        ms = self.ids(b.get('ids')) or list(self.rt)
        for m in ms:
            self.target(m, self.winch(m)['home'], fade, now)

    def api_stop(self, b, now):
        self.fx.clear()
        self.seq = None
        for r in self.rt.values():
            r['fade'], r['fx'] = None, None

    def api_teach(self, b, now):
        self.teach = set(self.ids(b.get('ids'))) if b.get('on') else set()

    def api_arm(self, b, now):
        self.armed = bool(b.get('on'))

    def api_master(self, b, now):
        self.master = clamp(fnum(b.get('value'), 1), 0, 1)

    def api_speed(self, b, now):
        v = clamp(fnum(b.get('value'), 60), 1, 100)
        for m in self.ids(b.get('ids')):
            self.rt[m]['speed'] = v

    def api_reset(self, b, now):
        t = now + self.show['device']['reset_time']
        for m in self.ids(b.get('ids')) or list(self.rt):
            self.rt[m]['reset_until'] = t

    def api_preset_store(self, b, now):
        ms = self.ids(b.get('ids')) or [w['id'] for w in self.show['winches']]
        pos = {str(m): round(self.rt[m]['pos'], 3) for m in ms}
        spd = {str(m): round(self.rt[m]['speed'], 1) for m in ms}
        fxl = []
        if b.get('fx', True) is not False:
            inset = set(ms)
            for fx in self.fx.values():
                mem = [m for m in fx['members'] if m in inset]
                if mem:
                    fxl.append({'params': dict(fx['params']), 'members': mem})
        pid = b.get('id')
        if pid:
            p = self.find_preset(pid)
            if not p:
                raise ValueError('Пресет не найден')
            p['pos'], p['speed'], p['fx'] = pos, spd, fxl
        else:
            n = len(self.show['presets']) + 1
            p = {'id': 'p%x%02x' % (int(time.time() * 1000), random.randint(0, 255)),
                 'name': (str(b.get('name') or '').strip() or 'Пресет %d' % n)[:40],
                 'fade': clamp(fnum(b.get('fade'), 3), 0, 600), 'pos': pos, 'speed': spd, 'fx': fxl}
            self.show['presets'].append(p)
        self.last_preset = p['id']
        self.changed()
        return {'id': p['id']}

    def api_preset_recall(self, b, now):
        self.recall(str(b.get('id')), b.get('fade'), now)

    def api_fx_start(self, b, now):
        p = self.fxp(b.get('params'))
        ms, u, uc, unit, _ = self.coords(self.ids(b.get('ids')), p['order'], p['reverse'], p['linked'])
        if not ms:
            raise ValueError('Выделите лебёдки')
        for m in ms:
            self.detach(m)
        fid = self.fx_next
        self.fx_next += 1
        self.fx[fid] = {'id': fid, 'params': p, 'members': ms, 'u': u, 'uc': uc, 'unit': unit, 't0': now, 'ph': 0.0,
                        'start': {m: self.rt[m]['pos'] for m in ms}, 'rnd': {}}
        for m in ms:
            self.rt[m]['fx'], self.rt[m]['fade'] = fid, None
        return {'id': fid}

    def api_fx_update(self, b, now):
        f = self.fx.get(int(fnum(b.get('id'), -1)))
        if not f:
            raise ValueError('Эффект уже остановлен')
        f['params'] = self.fxp(b.get('params'), f['params'])
        self.fx_coords(f)

    def api_fx_stop(self, b, now):
        if b.get('all'):
            for fid in list(self.fx):
                self.stop_fx(fid)
        else:
            self.stop_fx(int(fnum(b.get('id'), -1)))

    def api_seq_play(self, b, now):
        q = self.find_seq(str(b.get('id')))
        if not q or not q['cues']:
            raise ValueError('В шоу нет шагов')
        self.seq = {'id': q['id'], 'idx': int(clamp(fnum(b.get('idx')), 0, len(q['cues']) - 1)), 't0': now}
        self.run_cue(now)

    def api_seq_go(self, b, now):
        if self.seq:
            self.advance(1, now)
        else:
            raise ValueError('Шоу не запущено')

    def api_seq_back(self, b, now):
        if self.seq:
            self.advance(-1, now)

    def api_seq_stop(self, b, now):
        self.seq = None

    # ---------- таймкод ----------
    def tc_raw(self, now):
        c, T = self.show['timecode'], self.tc
        if c['source'] == 'internal':
            return T['base'] + (now - T['start'] if T['run'] else 0.0)
        if T['rx'] is None or now - T['rx_at'] > 1.0:
            return None
        return T['rx']

    def fire(self, e, now):
        a, fade = e['action'], e['fade']
        try:
            if a == 'preset' and self.find_preset(e['ref']):
                self.recall(e['ref'], fade, now)
            elif a == 'seq' and self.find_seq(e['ref']):
                self.api_seq_play({'id': e['ref']}, now)
            elif a == 'seq_stop':
                self.seq = None
            elif a == 'fx':
                self.api_fx_start({'ids': e.get('members') or [], 'params': e.get('params')}, now)
            elif a == 'fx_stop':
                self.api_fx_stop({'all': True}, now)
            elif a == 'stop':
                self.api_stop({}, now)
            elif a == 'home':
                self.api_home({'fade': 3 if fade is None else fade}, now)
        except ValueError:
            pass
        self.tc['last'] = e['id']

    def tc_tick(self, now):
        c, T = self.show['timecode'], self.tc
        raw = self.tc_raw(now)
        if not c['enabled'] or raw is None:
            T['prev'] = None
            return
        cur, prev = raw - c['offset'], T['prev']
        if prev is not None and -0.5 < cur - prev < 0:      # дрожание/пакеты не по порядку
            return
        T['prev'] = cur
        evs = c['events']
        if prev is None or cur < prev or cur - prev > 1.0:  # старт, перемотка, возврат сигнала
            if c['chase']:
                past = [e for e in evs if e['t'] <= cur + 1e-6]
                if past:
                    self.fire(past[-1], now)
            return
        for e in evs:
            if prev < e['t'] <= cur:
                self.fire(e, now)

    def api_tc(self, b, now):
        T, off = self.tc, self.show['timecode']['offset']
        cmd = b.get('cmd')
        if cmd == 'play' and not T['run']:
            T['start'], T['run'] = now, True
        elif cmd == 'pause' and T['run']:
            T['base'] += now - T['start']
            T['run'] = False
        elif cmd == 'stop':
            T['run'], T['base'], T['prev'] = False, off, None
        elif cmd == 'seek':
            T['base'], T['start'], T['prev'] = off + max(0.0, fnum(b.get('t'))), now, None

    def api_ltc(self, b, now):
        if self.show['timecode']['source'] == 'ltc':
            self.tc['rx'] = clamp(fnum(b.get('t')), 0, 172800)
            self.tc['rx_at'] = now
            self.tc['rx_fps'] = fnum(b.get('fps'), 25)

    def api_tc_enable(self, b, now):
        self.show['timecode']['enabled'] = bool(b.get('on'))
        self.tc['prev'] = None
        self.changed()

    def api_tc_fire(self, b, now):
        e = next((x for x in self.show['timecode']['events'] if x['id'] == b.get('id')), None)
        if not e:
            raise ValueError('Событие не найдено')
        self.fire(e, now)

    def rx_loop(self):
        while self.running:
            with self.lock:
                c = self.show['timecode']
                want = c['port'] if c['source'] == 'artnet' else None
            if want != self.rx_port:
                try:
                    if self.rx_sock:
                        self.rx_sock.close()
                except OSError:
                    pass
                self.rx_sock, self.rx_port = None, want
                if want:
                    try:
                        r = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                        r.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                        if hasattr(socket, 'SO_REUSEPORT'):
                            try:
                                r.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEPORT, 1)
                            except OSError:
                                pass
                        r.bind(('', want))
                        r.settimeout(0.5)
                        self.rx_sock, self.tc['err'] = r, ''
                    except OSError as e:
                        self.tc['err'] = 'порт %d занят (%s)' % (want, e)
                        time.sleep(2)
                        self.rx_port = None
                        continue
            if not self.rx_sock:
                time.sleep(0.3)
                continue
            try:
                data, _ = self.rx_sock.recvfrom(2048)
            except socket.timeout:
                continue
            except OSError:
                time.sleep(0.2)
                continue
            if len(data) >= 19 and data[:8] == b'Art-Net\x00' and struct.unpack('<H', data[8:10])[0] == 0x9700 \
                    and self.show['timecode']['source'] == 'artnet':
                fr, se, mi, ho, ty = data[14], data[15], data[16], data[17], data[18]
                fps = (24, 25, 29.97, 30)[ty & 3]
                with self.lock:
                    self.tc['rx'] = ho * 3600 + mi * 60 + se + fr / fps
                    self.tc['rx_at'] = time.monotonic()
                    self.tc['rx_fps'] = fps

    def api_config(self, b, now):
        for k in ('artnet', 'device', 'library', 'layout', 'winches', 'groups', 'objects', 'presets', 'sequences', 'timecode'):
            if k in b:
                self.show[k] = b[k]
        self.show = normalize(self.show)
        self.sync()
        self.changed()

    def api_show(self, b, now):
        self.show = normalize(b)
        self.rt, self.fx, self.seq = {}, {}, None
        self.tc['prev'] = None
        self.sync()
        self.changed()

    def handle(self, path, b):
        fn = getattr(self, 'api_' + path.strip('/').replace('api/', '', 1).replace('/', '_'), None)
        if not fn:
            raise ValueError('Неизвестная команда')
        with self.lock:
            return fn(b if isinstance(b, dict) else {}, time.monotonic()) or {}

    # ---------- engine ----------
    def fx_pos(self, f, m, now):
        p, ph = f['params'], f['ph']
        t, u, sp = p['type'], f['u'].get(m, 0.0), p['spread']
        if t == 'wave':
            v = 0.5 - 0.5 * math.cos(2 * math.pi * (ph - u * sp))
        elif t == 'breathe':
            v = 0.5 - 0.5 * math.cos(2 * math.pi * ph)
        elif t == 'pingpong':
            v = ease(1 - abs(2 * frac(ph - u * sp) - 1))
        elif t == 'standing':
            v = 0.5 - 0.5 * math.cos(2 * math.pi * ph) * math.cos(2 * math.pi * u * max(sp, 0.25))
        elif t == 'chase':
            x = frac(ph - f['uc'].get(m, 0.0))
            d, w = min(x, 1 - x), p['width']
            v = 0.5 + 0.5 * math.cos(math.pi * d / w) if d < w else 0.0
        else:  # random
            key = f.get('unit', {}).get(m, m)
            s = f['rnd'].get(key)
            if s is None or now - s['t0'] >= s['dur']:
                a = s['b'] if s else random.random()
                s = {'a': a, 'b': random.random(), 't0': now, 'dur': p['period'] * (0.6 + 0.8 * random.random())}
                f['rnd'][key] = s
            v = s['a'] + (s['b'] - s['a']) * ease((now - s['t0']) / s['dur'])
        pos = p['lo'] + (p['hi'] - p['lo']) * v
        if p['fadein'] > 0:
            k = (now - f['t0']) / p['fadein']
            if k < 1:
                st = f['start'].get(m, pos)
                pos = st + (pos - st) * ease(k)
        return pos

    def tick(self, now, dt):
        sh, dv = self.show, self.show['device']
        self.tc_tick(now)
        if self.seq:
            q = self.find_seq(self.seq['id'])
            if not q or not q['cues']:
                self.seq = None
            else:
                self.seq['idx'] = min(self.seq['idx'], len(q['cues']) - 1)
                cue = q['cues'][self.seq['idx']]
                if cue['hold'] is not None and now - self.seq['t0'] >= cue['fade'] + cue['hold']:
                    self.advance(1, now)
        for f in self.fx.values():
            f['ph'] += dt / f['params']['period']
        fixmap = {f['id']: f for f in BUILTIN_FIXTURES}
        fixmap.update({f['id']: f for f in sh['library']})
        # пределы: у экрана (объекта) — самый строгий предел из его лебёдок, чтобы экран не перекашивало
        lim = {w['id']: (w['min'], w['max']) for w in sh['winches']}
        for o in sh['objects']:
            ls = [lim[m] for m in o['members'] if m in lim]
            if ls:
                lo_, hi_ = max(x[0] for x in ls), min(x[1] for x in ls)
                if lo_ <= hi_:
                    for m in o['members']:
                        lim[m] = (lo_, hi_)
        for m in self.teach:
            if m in lim:
                lim[m] = (0.0, 100.0)
        unis = {}
        for w in sh['winches']:
            r = self.rt[w['id']]
            p = r['pos']
            f = self.fx.get(r['fx']) if r['fx'] else None
            if f:
                p = self.fx_pos(f, w['id'], now)
            elif r['fx']:
                r['fx'] = None
            elif r['fade']:
                fd = r['fade']
                k = (now - fd['t0']) / fd['dur']
                if k >= 1:
                    p, r['fade'] = fd['to'], None
                else:
                    p = fd['from'] + (fd['to'] - fd['from']) * ease(k)
            p = clamp(p, *lim[w['id']])
            r['pos'] = p
            raw = 1 - p / 100.0 if w['invert'] else p / 100.0
            v16 = int(round(raw * 65535))
            sp = clamp(r['speed'] * self.master, 0, 100)
            out = []
            for c in fixmap.get(w['fixture'], BUILTIN_FIXTURES[0])['ch']:
                role = c['role']
                if role == 'safety':
                    out.append(c['on'] if (self.armed and w['enabled']) else c['off'])
                elif role == 'pos_hi':
                    out.append(v16 >> 8)
                elif role == 'pos_lo':
                    out.append(v16 & 255)
                elif role == 'pos8':
                    out.append(int(round(raw * 255)))
                elif role == 'speed':   # ES-L32: fast=1, slow=255 (инверсия)
                    out.append(c['slow'] if sp <= 0 else int(round(c['slow'] + (c['fast'] - c['slow']) * sp / 100)))
                elif role == 'reset':
                    out.append(c['val'] if now < r['reset_until'] else c['idle'])
                else:
                    out.append(c['val'])
            r['out'] = out
            buf = unis.get(w['universe'])
            if buf is None:
                buf = unis[w['universe']] = bytearray(512)
            a = w['address'] - 1
            for i, v in enumerate(out):
                if a + i < 512:
                    buf[a + i] = v
        return unis

    def get_sock(self, bind, now):
        if self.sock is not None and self.sock_key == bind:
            return self.sock
        if self.sock_key == bind and now < self.sock_retry:
            return None
        try:
            if self.sock:
                self.sock.close()
        except OSError:
            pass
        self.sock, self.sock_key = None, bind
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            if bind:
                s.bind((bind, 0))
            self.sock, self.sock_err = s, ''
            return s
        except OSError as e:
            self.sock_err = 'сетевая карта %s: %s' % (bind, e)
            self.sock_retry = now + 2
            return None

    def run(self):
        last = tstat = time.monotonic()
        seq = frames = 0
        while self.running:
            t = time.monotonic()
            dt, last = min(0.25, t - last), t
            snap = None
            try:
                with self.lock:
                    unis = self.tick(t, dt)
                    a = dict(self.show['artnet'])
                    if self.dirty and t - self.saved_at > 1.0:
                        snap = json.dumps(self.show, ensure_ascii=False, indent=1)
                        self.dirty, self.saved_at = False, t
            except Exception:
                traceback.print_exc()
                time.sleep(0.2)
                continue
            if snap:
                save_file(snap)
            err = ''
            if a['enabled']:
                s = self.get_sock(a['bind'], t)
                if s is None:
                    err = self.sock_err
                else:
                    seq = seq % 255 + 1
                    for u, buf in unis.items():
                        try:
                            s.sendto(artdmx(seq, u, buf), (a['ip'], a['port']))
                        except OSError as e:
                            err = str(e)
            frames += 1
            if t - tstat >= 1:
                self.stats['fps'] = round(frames / (t - tstat))
                frames, tstat = 0, t
            self.stats['error'] = err
            self.stats['universes'] = sorted(unis)
            wait = 1.0 / a['fps'] - (time.monotonic() - t)
            if wait > 0:
                time.sleep(wait)

    def state(self):
        with self.lock:
            now = time.monotonic()
            sq = None
            if self.seq:
                q = self.find_seq(self.seq['id'])
                cue = q['cues'][self.seq['idx']] if q and q['cues'] else None
                if cue:
                    sq = {'id': self.seq['id'], 'idx': self.seq['idx'], 't': round(now - self.seq['t0'], 2),
                          'dur': None if cue['hold'] is None else cue['fade'] + cue['hold']}
            c, T = self.show['timecode'], self.tc
            raw = self.tc_raw(now)
            tcs = {'src': c['source'], 'en': c['enabled'], 't': None if raw is None else round(raw - c['offset'], 3),
                   'raw': None if raw is None else round(raw, 3),
                   'fps': c['fps'] if c['source'] == 'internal' else T['rx_fps'],
                   'err': T['err'] if c['source'] == 'artnet' else '', 'last': T['last'], 'run': T['run']}
            return {
                'rev': self.rev, 'armed': self.armed, 'master': self.master,
                'pos': {w: round(r['pos'], 2) for w, r in self.rt.items()},
                'spd': {w: round(r['speed']) for w, r in self.rt.items()},
                'out': {w: r['out'] for w, r in self.rt.items()},
                'fx': [{'id': f['id'], 'members': f['members'], 'params': f['params']} for f in self.fx.values()],
                'fxOf': {w: r['fx'] for w, r in self.rt.items() if r['fx']},
                'seq': sq, 'lastPreset': self.last_preset,
                'tc': tcs, 'teach': sorted(self.teach),
                'stats': dict(self.stats), 'ifaces': self.ifaces,
            }

    def shutdown(self):
        with self.lock:
            self.armed = False          # Safety → выкл перед выходом
        time.sleep(0.35)
        self.running = False
        with self.lock:
            snap = json.dumps(self.show, ensure_ascii=False, indent=1)
        save_file(snap)


ENGINE = None
FAVICON = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAO1klEQVR42t2be4xc113HP79zzp3H7s7sjtfrt2PXbpxnExKRQBvaTUSkNBVqEXRDmtLQUNS0qMXwD1KFipWWAJVQKaCmBQJEJaiP7UMmAloKJC5qS5ugOHaydp063qztdbzep3f2MXPvOT/+uDPj2fXueu2sozUjHenOzD3nnt/3/n7f3+OcAxf+SHd3t+MK+9TmLBcUbqk/e3p6bG9vrwcQEd51/4evnjk7cWOlMrMNHwphFQlsjSvbyB0vtJRe/JdvPX5YNZwnw8UAILUWHnjgo6UTI6cfmposPzA9Xb7ZJ94lSUL9AavlI2KwzuKcC/l8y8HWQvEra9et+/tvPfnFIcAAWmsXBEDqN3bfe99DZ8dGHpk8O7F1qjxJEsco6gXRCyvXG/xRUFRArIsiWlvbKBQ6ThfXlD71vW9//bHaXQYISwEggO7Zsyfz3f/e/7ejI0MPjo6cIXifWGsNIqlmqK5OwxdJoVBV730wxrhSZxdrOru+sWXt1g/29j5Wng+CzBW+x3z84xvcsweO7R06PXjPxNhI4lxkRMToahV6USwERTWJ46TYXoq6Nmz6/rYbt7+z97HHppvNwTQRnoFe/+zBY48PnT51z8TYSNVFGadggmqjx5XSgiqqiIsy0dmJsXjotcE7jr/U/08iElJZa+TZzJTvuPe9D46cGdozMnw6jqJM5kp764t6COvszPRULMZdf93Nt41++6lv/E9PT4/t6+vTOtvznt/Y3d5/6MDhUycGumqGYeYOYq8oob0P80hfggbPxs1Xla950w3X9PY+dhr2iOvu7rb79u1LRgYHHipPnl3vQ5JYF7lmolOUiYkJQki5Q7XONyz4fcF7FiCdZfVb7thNv4kIbW1tNc5u3GWCajI5ebY4OHryo8Ce7u5nrACiqtz61rufP3Xy+E3BJwERe+5hijGGu+7sptjeDqqICIn3GBEUiKwl8R6tzcyIYI0hTpKUjFRxzqKqeB8aE3POkiQercFjxGCMkCS+qZ8jhEAIc/vFcZJKrNrQziRJsM4xVS7z9NPPUI1jjDHNSAURkQ2btx777Q/df+3DDz+cOEDffd9vvXl2ZubGuFoV65ypv31rLeNj4/zO7o/xx3/0SapV5djxQVrzOTZt7KRSSYU+cnSAXTuvwlqLEeHMyBgTk1Nc++YtzMwmRJHjyNEBujpLdJYKxEmgUq1ybGCQ63ftIHiPc5YTg0P4ENixbQMzswnWWg6/3M/2rRtpackRgjJZnuLU6WGuv2Y71UpClHG80j9ISz7Lpo2dTE9XKbZmePQzn+PRR/+Ejo4OvPd1zTBJkmhldnbH1//jBzcA+y3A5u277hwfG7l/ZrrsjTGmrrDGCDOzMzz44K+zc+fVjIyMoBp4bv9LKUACs7OzjI2Nc6DvZUrFVqanp1EN9P3kKCMj47S15iiXp6hWKzz3/EvkshHeJ8RxzKnXznDkaD8d7W1Mlsugyv4XDzMzUyGXiZienmZqaornXuij2NZCpTJL8AmvvHqC4ydeo73QymR5Cu8Tntv/Uhq+CngVJiYm2Lv3KXK57JyoVTX4TDZrWrOtP371aN9+A1CpzGxPkgRFVOe5vKBKpVKhvS1LW1sbmzeu5663386poVGMiygWC9x847Vs27KJV08O0dHRQXt7O7/Y/fPEXpmcqtDR0cGbtm3lbbffwqsnh8i3tFAoFLj91htZU2pn8PQoa9aU6OwscXf3Wxk7O0XslWKxyHXX7OSWm67j2PHXKBaLFIpF7rj9Z3BRxPDYJKVSB5s2pHMaHBrFWEupmKdSqeCDn+cetWEq1biyHcABBB/aQgjnhYUhBPL5PF/6xye56qqraMnnSbwnco5QrfD888/jrKWltY1iscjI0Cl+VB5vaI/3gSM/GeXEQA7vA1HkiGdmeO65/0UEOjpK5LIZXu3v5+zYGYIGrLVonHDw4EHyuUyj39TUND/+8bOoKmu71tGacxz96RHOnB7Ee49zDl+pcODAQV4U4e/+4Qmy2SznuXKRlFN8KDQAEJEFHb6qks1mOXToMPe/7/1EUdQY0BjBiGFiYoK773kXt7/1Dj7z6T+kpbWNEBo2h9QeWE8xjDGIGMbHRnngA7/Jmq61PPYXf0ah0L68fuOjfOz3fp/R4WG+8uQTFIrttfsUIwIiVKtVjDHkcrmG51ogatYGAA3fUm/zQMhls43rZtdjjSETRUTOETmLtZZM5AjBzI9E5vazNu0XWSJrscaSyUQEv4x+LiKyLu1n6/38nPtaW1oaGrzAW50j47IKHYuhqKpNLR28/n3JxG0l+qGL9gsXEcGaKzO4XbkQ3TUPqRc59Pz7lzvG/PsW73e+OdaZvM7qzb8tp9A1/znu4qd/aaIsPg1dpN/ca6mTYy2VFxQhIBIQQi0clprsugQIc5/jWJUqUA+NFWfT4EZQrFWqmUBkA5FV8plAzileNIUjKImvw7UICPPm51arfRsUDYGzUx5nUiAiF0hmqlSqEdWqIZmpUs3ExIknTiAg5POuSWf0goVhtzqrOanwne2WBz+4nmKrwaJYa4ira7j+ln4qM1PctulqokyeJAl4K5wcjHnyn0eoJtoEAssF4PXagK6ADaT27YwyOe25994Cn/hwDoanwRogAcnA7DNgDOzKgibnxmhp44W+SX54cIZs1uLDxXDAJbmg5ZDgpZWPjTNkZ8v4Q2WSsuKMNGoT9RQ3Dd+l4ftNZoScBsRI01OXNoOLcIN6gbc4xznNr7DPmcTS3HnuKihIZLEZwSwQsVjORYqigFWoZX6LyaJLcsCiCJx7w9aAqXkbayFjFWcUI0rGps3Xh1LFhwUIaUkEBBR8UKyAyYBM63lVoQUXODJplBvC8hFYBgc0CS9QrXgIAWshcoYQV0gSJUlcel3NkfiA92lens3ahtc+B8LSOuCDknXwvcOB/lcMG0sCVRYFIdUUeOEl5cUTSsZBCAtpITWeuQQOsAIaArde38LmTRmcKpEzVCsZrrspsH3LEL96zzoyuRaSJJCoUJ4O/OiFMpV4IVbWRRelvEJk4fAg3PNozPoOwQk4m2pf8wghQBIgDnBiWJmqpiU5r3JxofCShCRKkgR2bMnwr5/bSjYbg6/rXQl8P4RXuG/P5qayrEJHjt/91Gke/+YIhTZH7JcbxwuJgjMwPg1jU6npSc306ppQT+yCgg+CNXXhLyEXuJB9KbAm78meGiDMztVHIZ1Zc1aWeCXqcGyImMfKy1mX1QYIprHKU8sa52GoteTemBRznb/YtWwAFkwttUGxAoTEE2KDyUQslH80l1VMjaCTShUx9fGb09pQe4P164WfPVdpzgdy4QRKFv933nPcct59Xc2MARMJPr6wjvkAzgiRE0K4lAR2Yb7QS9/ucOkmoKQENDAMg8PKpq0C8dLPswCJcnBAMUYIryuFv3xr8curCCk4EYbOKr/y2ZhbdgoRKUkZM1fhUkJKVff4GeWHRyCfoSksXV0bCxwXjIRqpWRNM7KXX1MOnawFP/WgqJmV667Jp8SYjaQWDLFEyHwpecjryTYvqh7QxMo+jQcymaZ1uAXMVQ1ENlV775uZWV5fHWHl5V9uLiBNmiB4vzy71UXseBXJfzHZoDStFV+sLa+2DUUrVg+41CpuPWPUi6wjrKQO6BtZEWqu20rTFGTe93NgyRukOe6NEV2QJpdhrMVkIsSmflQyESZyqJFGgK+1HR5ymUFwl9MC6sJjhGRmFkURawmRI6lWIY6ROCapVokrFUKcoMEjCjaXg5COsaIgLF4Vvkx2aNKx1/3CbeS7ulADNnJMzUyTue0taFuRnfe9m9Z8Kz6OkQCzo6MMP/v8ufR9Ree0SByw0uIrINaQzMzS9bbbePveL1FJ4oZZiwgTScK4Kj/33u5GgqJByeda+P59H+Lkd54mamkh+LBiOvA63OClb97Uthb6TwxQGZ9ArD1/V5PWTEUgeE9uTQnf1oIRwwVrYaudBMUYkrhK8IEok70gsau1hBCIKxXEvJFeYJH9Aa9P39LMyFiLcZZkKkGsWdTMhFQDImsxzqWe4HLMaT4JquplgVpVEWeZffUk8fgEUecaNEkWV+valjdfnmL22ADiLBouT3BUl9mlhw3slIg557ZWgAqlRmg4R6X/OD/9yCfI79qR+nZbX/GcW9xTH0Bg9ugAM4d+ikQRrCAB0qAeQYwtNwDIZnIDLhOhNZe7ohrnA2ItM0deYfrQy4iztSKCzC1d1cpOmiSIMUgUpX1X0DOJpAvpLsoQudxAA4C2QulAFGUCorb2OlYMdAHUe8RaJFM7xrOECUjkIIS0z+XRfZvJZmhrL+6vhymy92tfeDnf2nrIuYxq0LDSe9dF0yKhVj0aJ2g1XrjFCVpNIAlpnxVuGjRY68jnWwfe/I6bDwKY7u5uKyKhvaP0ZKHQIT5JVC6T75XaGt6S7fI5ZLz3obXQLoWO0pf/avfuSnd3tzP79u3zgGzZvuPx9lLnqBhjlFV2ImplAjIFTEdp7XTX2s2fB2TfvjuDAbSnp8d8+W8+O9zZte4PutZvMnG14lMt0P8XTQTiaiVZu26D6VzX9em9X/3C8fTUyCPBAvT19WlPT4/9t6e+8eyuG269uTo7e8P09GRsrbNX/psX4rgat7V3RJu37vjPH/zXUx/p6+szvb29YU4kWPvBXP2zd30ghPAdhTvGx4bjKMq6xpr1lSU6AlqtVpJCsRRt2X71/m27rr2vaVuwNtYvmnsd+OF3q7/8S+//2kxSuR7lhqnyhITgEyMGkXSj2mrFQkj3GKME7xMfgtqu9Zvslu07/33z9p3v+eYTfzkKewzsW3KVonGu7s57e3YPnz71ydGRoc7y2XF8kgAkUl+mZZUdnEwjOGudk9ZCO6U16ya61m/8zDPf7v1TEVH27DE88ki4qKOzPQ8+vPm1U0MfPjs++mtT5clrKpXZNLsLq8tRGGNwUUQmm6OltXC0vX3N1zvXrv/i3q/+df9Sq6Wy3MPTT6u6P3/fR98yMTZycxxXtgWfFFeV+htbzmZzA/nWwgvvfMd7D+7e/a7Kcg5PLwvcK/f4/J4Lbgb/P3cIqmKDD9MdAAAAAElFTkSuQmCC')


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def send(self, code, body, ctype='application/json; charset=utf-8'):
        if isinstance(body, (dict, list)):
            body = json.dumps(body, ensure_ascii=False)
        if isinstance(body, str):
            body = body.encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split('?')[0]
        if path in ('/', '/index.html'):
            return self.send(200, INDEX_HTML.replace('{{VERSION}}', VERSION), 'text/html; charset=utf-8')
        if path in ('/favicon.png', '/favicon.ico'):
            return self.send(200, FAVICON, 'image/png')
        if path == '/api/state':
            return self.send(200, ENGINE.state())
        if path == '/api/show':
            with ENGINE.lock:
                data = dict(ENGINE.show)
                data['_fixtures'] = BUILTIN_FIXTURES
                return self.send(200, data)
        self.send(404, {'ok': False, 'error': 'not found'})

    def do_POST(self):
        try:
            n = int(self.headers.get('Content-Length') or 0)
            body = json.loads(self.rfile.read(n) or b'{}')
            res = ENGINE.handle(self.path.split('?')[0], body)
            out = {'ok': True}
            out.update(res)
            self.send(200, out)
        except Exception as e:
            self.send(400, {'ok': False, 'error': str(e)})


def open_ui(url, app_window=True):
    """Windows: отдельное окно-приложение Edge/Chrome (--app), иначе браузер по умолчанию."""
    if sys.platform == 'win32' and app_window:
        for exe in ('msedge', 'chrome'):
            try:
                r = subprocess.run(['cmd', '/c', 'where', exe], capture_output=True, creationflags=0x08000000)
                ok = r.returncode == 0
            except Exception:
                ok = False
            pf = [os.environ.get(k, '') for k in ('ProgramFiles(x86)', 'ProgramFiles', 'LOCALAPPDATA')]
            cands = [os.path.join(p, sub) for p in pf if p for sub in (
                r'Microsoft\Edge\Application\msedge.exe', r'Google\Chrome\Application\chrome.exe')]
            path = next((c for c in cands if os.path.exists(c) and os.path.basename(c).startswith(exe)), None)
            if path or ok:
                try:
                    subprocess.Popen([path or exe, '--app=' + url, '--window-size=1440,900',
                                      '--user-data-dir=' + os.path.join(BASE_DIR, '.winch_ui')],
                                     creationflags=0x08000000)
                    return
                except Exception:
                    pass
    webbrowser.open(url)


_CTRL_HANDLER = None


def win_setup():
    global _CTRL_HANDLER
    if sys.platform != 'win32':
        return
    try:
        import ctypes
        k = ctypes.windll.kernel32
        k.SetConsoleTitleW('Winch Control %s — не закрывайте это окно во время работы' % VERSION)
        HANDLER = ctypes.WINFUNCTYPE(ctypes.c_int, ctypes.c_uint)

        def on_ctrl(ev):
            if ev in (2, 5, 6):            # закрытие окна, выход из системы, выключение
                try:
                    ENGINE.shutdown()       # Safety → выкл, сохранить шоу
                except Exception:
                    pass
                return 1
            return 0
        _CTRL_HANDLER = HANDLER(on_ctrl)
        k.SetConsoleCtrlHandler(_CTRL_HANDLER, True)
    except Exception:
        pass


def already_running(port):
    try:
        with urllib.request.urlopen('http://127.0.0.1:%d/api/state' % port, timeout=1.0) as r:
            return 'rev' in json.loads(r.read().decode('utf-8'))
    except Exception:
        return False


def main():
    global ENGINE
    ap = argparse.ArgumentParser(description='Winch Control %s — Art-Net пульт для лебёдок' % VERSION)
    ap.add_argument('--lan', action='store_true', help='доступ к пульту с других устройств в сети')
    ap.add_argument('--port', type=int, default=8765)
    ap.add_argument('--no-browser', action='store_true')
    ap.add_argument('--browser', action='store_true', help='открыть в браузере по умолчанию, а не отдельным окном')
    args = ap.parse_args()
    win_setup()
    if already_running(args.port):          # вторая копия: просто открыть окно пульта
        print('Winch Control уже запущен — открываю пульт.')
        if not args.no_browser:
            open_ui('http://127.0.0.1:%d/' % args.port, not args.browser)
        return

    ENGINE = Engine()
    threading.Thread(target=ENGINE.run, daemon=True).start()
    threading.Thread(target=ENGINE.rx_loop, daemon=True).start()
    host = '0.0.0.0' if args.lan else '127.0.0.1'
    srv = None
    for p in range(args.port, args.port + 20):
        try:
            srv = ThreadingHTTPServer((host, p), Handler)
            break
        except OSError:
            continue
    if not srv:
        print('Не удалось открыть порт для пульта')
        sys.exit(1)
    port = srv.server_address[1]
    url = 'http://127.0.0.1:%d/' % port
    print('=' * 60)
    print('  Winch Control %s запущен:' % VERSION, url)
    if args.lan:
        for ip in ENGINE.ifaces:
            print('  С планшета/телефона:  http://%s:%d/' % (ip, port))
    print('  Шоу сохраняется в:', SHOW_FILE)
    print('  Закройте это окно (или Ctrl+C), чтобы выйти. Моторы при выходе выключатся.')
    print('  Окно пульта закрыли случайно? Запустите программу ещё раз.')
    print('=' * 60)
    if not args.no_browser:
        threading.Timer(0.6, lambda: open_ui(url, not args.browser)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        ENGINE.shutdown()


INDEX_HTML = r'''<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Winch Control {{VERSION}}</title><link rel="icon" href="/favicon.png">
<style>
:root{--bg:#0c0e11;--p1:#13161b;--p2:#1a1e25;--p3:#232932;--ln:#2b323c;--tx:#e7eaef;--mu:#8a94a3;--ac:#ffb020;--ac2:#3dd6c6;--ok:#33d17a;--bad:#ff4d4f}
*{box-sizing:border-box}
html,body{margin:0;height:100%;background:var(--bg);color:var(--tx);font:13px/1.35 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
button{font:inherit;color:var(--tx);background:var(--p3);border:1px solid var(--ln);border-radius:7px;padding:6px 10px;cursor:pointer}
button:hover{border-color:#4a5462}
button.pri{background:var(--ac);color:#141005;border-color:var(--ac);font-weight:600}
button.ghost{background:transparent}
input,select{font:inherit;color:var(--tx);background:var(--p1);border:1px solid var(--ln);border-radius:6px;padding:5px 7px}
input[type=range]{padding:0;accent-color:var(--ac);background:none;border:0}
input[type=checkbox]{accent-color:var(--ac)}
input.num{width:66px}
header{display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--p1);border-bottom:1px solid var(--ln);min-height:56px}
.brand{font-weight:700;font-size:15px;white-space:nowrap}.brand b{color:var(--ac)}.brand .ver{font-weight:500;font-size:11px;color:var(--mu)}
.pill{padding:4px 10px;border-radius:20px;background:var(--p3);color:var(--mu);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:360px}
.pill.ok{color:var(--ok)}.pill.bad{color:var(--bad)}
.sp{flex:1}
.master{display:flex;align-items:center;gap:6px;color:var(--mu);white-space:nowrap}.master input{width:110px}
#arm{font-weight:700;min-width:150px}
#arm.on{background:var(--ok);color:#06210f;border-color:var(--ok)}
#stop{background:var(--bad);border-color:var(--bad);color:#fff;font-weight:800;letter-spacing:1px;padding:8px 18px}
kbd{font-size:10px;opacity:.7;margin-left:5px;font-family:inherit}
main{display:grid;grid-template-columns:minmax(0,1fr) 400px;height:calc(100% - 57px)}
#left{display:flex;flex-direction:column;min-width:0;min-height:0}
.bar{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:8px 12px;border-bottom:1px solid var(--ln);background:var(--p1)}
.t{color:var(--mu)}
.chip{border-radius:20px;padding:4px 10px;background:var(--p2)}.chip .x{opacity:.45;margin-left:7px}.chip .x:hover{opacity:1;color:var(--bad)}
#stage{flex:1;min-height:0;overflow:auto;padding:14px;display:grid;gap:10px 6px;align-content:start}
.cell{display:flex;flex-direction:column;align-items:center;user-select:none;-webkit-user-select:none;border-radius:8px;padding:5px 0;background:var(--p1);border:1px solid transparent}
.cell.sel{border-color:var(--ac);background:#211b0e}
.cell.off{opacity:.4}
.lbl{font-weight:600;font-size:12px;cursor:pointer;padding:2px 6px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.track{position:relative;width:100%;height:var(--th,200px);cursor:ns-resize;touch-action:none;margin:8px 0 10px}
.track::before{content:"";position:absolute;left:14%;right:14%;top:-3px;height:3px;background:#3a424e;border-radius:2px}
.lim{position:absolute;left:28%;right:28%;background:repeating-linear-gradient(45deg,#4a1f22 0 4px,transparent 4px 8px)}
.cable{position:absolute;left:50%;top:0;width:1px;background:#7d8796}
.ball{position:absolute;left:50%;top:0;width:18px;height:18px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,#ffcf6a 30%,#d98a00 80%);transform:translate(-50%,-50%);box-shadow:0 0 14px #ffb02055}
.cell.fx .ball{background:radial-gradient(circle at 35% 30%,#fff,#8ff3ea 30%,#13a395 80%);box-shadow:0 0 14px #3dd6c655}
.cell.fx .cable{background:var(--ac2)}
.cell.obj .ball{left:12%;right:12%;width:auto;height:12px;border-radius:3px;transform:translateY(-50%);background:var(--oc);box-shadow:0 2px 10px #0008}
.cell.obj:not(.ol) .ball{left:-5px;border-top-left-radius:0;border-bottom-left-radius:0}
.cell.obj:not(.or) .ball{right:-5px;border-top-right-radius:0;border-bottom-right-radius:0}
.cell.obj.fx .ball{background:var(--oc)}
.jog{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:8px 0}
.jog button{padding:14px 0;font-size:18px;touch-action:none;user-select:none;-webkit-user-select:none}
.jog button:active{background:var(--ac);color:#141005}
.steps{margin:0 0 10px;padding-left:18px;line-height:1.55}
.teachon{background:#3a2a08!important;border-color:var(--ac)!important;color:var(--ac)!important;font-weight:600}
.lch{border-top:1px solid var(--ln);padding-top:8px}.lch .row{margin-bottom:6px}
.lnum{width:16px;color:var(--mu);font-variant-numeric:tabular-nums}
.lpar{padding-left:22px}.lpar fieldset{border:0;padding:0;margin:0;display:flex;gap:5px;align-items:center;flex-wrap:wrap}.lpar button{padding:3px 8px}
.otag{font-size:10px;font-weight:600;color:var(--oc,var(--mu));height:13px;white-space:nowrap;align-self:flex-start;padding-left:3px;overflow:visible;position:relative;z-index:2}
.val{font-size:11px;color:var(--mu);font-variant-numeric:tabular-nums}
.move{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:8px 12px;border-top:1px solid var(--ln);background:var(--p1)}
.move input[type=range]{flex:1;min-width:140px}
output{font-variant-numeric:tabular-nums;min-width:38px;display:inline-block}
aside{border-left:1px solid var(--ln);background:var(--p1);display:flex;flex-direction:column;min-height:0}
.tabs{display:flex;border-bottom:1px solid var(--ln);overflow-x:auto}
.tabs button{border:0;border-radius:0;background:none;padding:12px 10px;color:var(--mu);border-bottom:2px solid transparent;white-space:nowrap}
.tabs button.on{color:var(--tx);border-bottom-color:var(--ac)}
#tab{flex:1;overflow:auto;padding:12px}
h4{margin:16px 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:.7px;color:var(--mu);display:flex;align-items:center;gap:8px}
h4:first-child{margin-top:0}h4 .sp{flex:1}
.row{display:flex;gap:6px;align-items:center;margin-bottom:8px;flex-wrap:wrap}
.row>input:not(.num):not([type=checkbox]){flex:1;min-width:80px}
.hint{color:var(--mu);font-size:12px}
.chk{display:inline-flex;align-items:center;gap:6px;color:var(--mu)}
.ptiles{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ptile{position:relative;background:var(--p2);border:1px solid var(--ln);border-radius:8px;padding:2px}
.ptile.last{border-color:var(--ac)}
.pgo{width:100%;text-align:left;padding:9px 10px;min-height:54px;display:flex;flex-direction:column;gap:3px;background:transparent;border:0}
.pgo small{color:var(--mu)}.pgo .fxb{color:var(--ac2)}.pgo .tcb{color:#8b9dff;font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;font-size:11px}
.pk{position:absolute;right:8px;top:7px;color:var(--mu);font-size:11px}
.pact{display:flex;gap:3px;padding:0 4px 4px}.pact button{padding:2px 0;font-size:11px;flex:1;background:var(--p1)}
.fxgrid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.fxcard{text-align:left;padding:8px 9px;background:var(--p2)}
.fxcard.on{border-color:var(--ac2);background:#0e2422}
.fxcard small{display:block;color:var(--mu);font-size:11px;margin-top:2px}
.rng{display:grid;grid-template-columns:118px 1fr 52px;align-items:center;gap:8px;margin:7px 0}
.rng span{color:var(--mu)}.rng output{text-align:right}
.list .it{display:flex;align-items:center;gap:6px;padding:6px 8px;border:1px solid var(--ln);border-radius:7px;margin-bottom:5px;background:var(--p2)}
.list .it.on{border-color:var(--ac2)}.list .it b{flex:1;font-weight:600}.list .it button{padding:3px 8px}
.shapes{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.shape{padding:8px 4px 6px;background:var(--p2);display:flex;flex-direction:column;align-items:center;gap:6px;font-size:12px}
.mini{display:flex;gap:4px;height:34px;align-items:flex-start;border-top:2px solid #3a424e}
.mini i{display:block;width:1px;background:#7d8796;position:relative}
.mini i::after{content:"";position:absolute;bottom:-3px;left:-3px;width:7px;height:7px;border-radius:50%;background:var(--ac)}
table{border-collapse:collapse;width:100%}
td,th{border-bottom:1px solid var(--ln);padding:4px 3px;text-align:left}
th{color:var(--mu);font-weight:500;font-size:11px}
td input{width:100%;padding:3px 4px}td input[type=checkbox]{width:auto}
td.n{font-variant-numeric:tabular-nums;text-align:right}
tr.cur td{background:#0e2422}
tr.bad td{background:#2a1214}
.prog{height:3px;background:var(--p3);border-radius:2px;overflow:hidden;margin:6px 0}.prog i{display:block;height:100%;background:var(--ac2);width:0}
.warn{color:var(--bad)}
.dmx td{font-size:12px}
.tcbox{background:var(--p2);border:1px solid var(--ln);border-radius:10px;padding:14px 10px 10px;text-align:center;margin-bottom:10px}
.tcbig{font:600 34px/1.1 ui-monospace,"SF Mono",Menlo,Consolas,monospace;letter-spacing:1px;font-variant-numeric:tabular-nums}
.tcbig.live{color:var(--ac2)}
.meter{flex:1;height:8px;background:var(--p3);border-radius:4px;overflow:hidden;min-width:80px}.meter i{display:block;height:100%;width:0;background:var(--ok);transition:width .08s}
.mono{font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;font-variant-numeric:tabular-nums}
#etab input.mono{font-size:11.5px;padding:3px 4px}#etab td{vertical-align:middle}
tr.next td:first-child{box-shadow:inset 3px 0 0 var(--ac)}
#tcpill{font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;color:var(--ac2)}
#dlg{position:fixed;inset:0;background:#000b;display:flex;align-items:center;justify-content:center;z-index:30;padding:16px}
#dlg[hidden]{display:none}
.dlgbox{background:var(--p2);border:1px solid var(--ln);border-radius:10px;padding:16px;width:min(400px,100%);white-space:pre-line;font-size:14px}
.dlgbox input{width:100%;margin-top:12px}
#toast{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);background:var(--p3);border:1px solid var(--ln);padding:8px 14px;border-radius:8px;opacity:0;transition:opacity .2s;pointer-events:none;z-index:10}
#toast.show{opacity:1}#toast.err{border-color:var(--bad)}
#off{position:fixed;inset:0;background:#000c;display:none;align-items:center;justify-content:center;font-size:16px;z-index:9;text-align:center;padding:20px}
@media(max-width:900px){main{grid-template-columns:minmax(0,1fr);height:auto}#left{height:72vh}aside{border-left:0;min-height:60vh}header{flex-wrap:wrap}.pill{max-width:100%}}
</style></head><body>
<header>
  <div class="brand">⛓ Winch<b>Control</b> <small class="ver">v{{VERSION}}</small></div>
  <div id="net" class="pill">…</div><div id="tcpill" class="pill" hidden></div>
  <div class="sp"></div>
  <label class="master" title="Общий множитель скорости всех лебёдок">Скорость <input type="range" id="master" min="0" max="100" value="100"><output id="masterv">100%</output></label>
  <button id="arm" title="Канал Safety: включить/выключить моторы">МОТОРЫ ВЫКЛ</button>
  <button id="home" title="Выделенные (или все) — в позицию Home">⌂ Домой</button>
  <button id="stop" title="Заморозить все движения на месте">СТОП<kbd>Space</kbd></button>
</header>
<main>
  <section id="left">
    <div class="bar" id="selbar"></div>
    <div id="stage"></div>
    <div class="move">
      <span class="t">Выделено: <b id="selc">0</b></span>
      <span class="t">Глубина</span><input type="range" id="mpos" min="0" max="100" step="0.1" value="0"><output id="mposv">0%</output>
      <button data-p="0">Верх</button><button data-p="25">25</button><button data-p="50">50</button><button data-p="75">75</button><button data-p="100">Низ</button>
      <label class="t">Переход <input type="number" id="fade" class="num" value="3" min="0" step="0.5"> с</label>
    </div>
  </section>
  <aside><div class="tabs" id="tabs"></div><div id="tab"></div></aside>
</main>
<div id="toast"></div>
<div id="dlg" hidden><div class="dlgbox" role="dialog" aria-modal="true"><div id="dlgmsg"></div><input id="dlgin"><div class="row" style="justify-content:flex-end;margin:14px 0 0"><button id="dlgno">Отмена</button><button class="pri" id="dlgok">OK</button></div></div></div>
<div id="off">Нет связи с программой.<br>Запустите winch_control.py и обновите страницу.</div>
<script>
const $=s=>document.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
let show=null,st=null,rev=-1,sel=new Set(),tab='presets',editFx=null,curSeq=null,fxSig='',cells={},mposDrag=false;
const TABS=[['presets','Пресеты'],['fx','Эффекты'],['shapes','Формы'],['seq','Шоу'],['tc','Таймкод'],['lim','Пределы'],['ch','Каналы'],['set','Настройки']];
const FX=[{t:'wave',n:'Волна',d:'Синус бежит по ряду'},{t:'breathe',n:'Дыхание',d:'Все вместе вверх-вниз'},{t:'chase',n:'Бегущая капля',d:'Опускается и бежит по ряду'},{t:'pingpong',n:'Маятник',d:'Равномерно туда-обратно'},{t:'standing',n:'Стоячая волна',d:'Узлы стоят, пучности качаются'},{t:'random',n:'Хаос',d:'Случайные плавные движения'}];
const FXN=Object.fromEntries(FX.map(f=>[f.t,f.n]));
const SH=[['flat','Ровно'],['line','Наклон'],['v','V'],['a','Λ'],['sine','Синус'],['arc','Дуга'],['checker','Шахматы'],['random','Случайно']];
const ORD=[['index','По порядку'],['x','По столбцам (X)'],['y','По рядам (Y)'],['radial','От центра']];
const O={fxp:{type:'wave',lo:0,hi:100,period:8,spread:1,width:.15,order:'index',reverse:false,fadein:3,linked:true},shp:{lo:0,hi:100,order:'index',reverse:false,fade:4,linked:true},chp:{spd:60}};

function dlg(msg,def){return new Promise(res=>{const d=$('#dlg'),inp=$('#dlgin'),txt=def!==undefined;$('#dlgmsg').textContent=msg;inp.hidden=!txt;inp.value=txt?def:'';d.hidden=false;
  setTimeout(()=>{if(txt){inp.focus();inp.select()}else $('#dlgok').focus()},0);
  const done=v=>{d.hidden=true;document.removeEventListener('keydown',kd,true);res(v)};
  const kd=e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();done(txt?inp.value:true)}else if(e.key==='Escape'){e.preventDefault();done(txt?null:false)}};
  document.addEventListener('keydown',kd,true);$('#dlgok').onclick=()=>done(txt?inp.value:true);$('#dlgno').onclick=()=>done(txt?null:false);d.onclick=e=>{if(e.target===d)done(txt?null:false)}})}
const ask=m=>dlg(m),askText=(m,d)=>dlg(m,String(d??''));
function toast(m,err){const t=$('#toast');t.textContent=m;t.className='show'+(err?' err':'');clearTimeout(t._t);t._t=setTimeout(()=>t.className='',2300)}
async function api(p,b){try{const r=await fetch(p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b||{})});const j=await r.json();if(!j.ok)toast(j.error||'Ошибка',true);return j}catch(e){toast('Нет связи с программой',true);return{ok:false}}}
function throttle(fn,ms){let last=0,tm=null,args;return(...a)=>{args=a;const run=()=>{last=Date.now();tm=null;fn(...args)};const w=ms-(Date.now()-last);if(w<=0)run();else if(!tm)tm=setTimeout(run,w)}}
const saveCfg=part=>api('/api/config',part);
const ids=()=>show.winches.filter(w=>sel.has(w.id)).map(w=>w.id);
const fadeVal=()=>Math.max(0,+$('#fade').value||0);
const fixtures=()=>[...(show._fixtures||[]),...(show.library||[])];
const fixOf=w=>fixtures().find(f=>f.id===w.fixture)||fixtures()[0];
const fixLabel=f=>`${f.maker} ${f.model} · ${f.mode}`;
const ROLE=[['safety','Safety (вкл/выкл мотора)'],['pos_hi','Позиция — грубо (16 бит)'],['pos_lo','Позиция — fine (16 бит)'],['pos8','Позиция 8 бит'],['speed','Скорость'],['reset','Reset'],['fixed','Постоянное значение']];
let libEdit=null;

async function loadShow(){show=await (await fetch('/api/show',{cache:'no-store'})).json();const valid=new Set(show.winches.map(w=>w.id));[...sel].forEach(i=>valid.has(i)||sel.delete(i));renderAll()}
async function poll(){try{const r=await fetch('/api/state',{cache:'no-store'});st=await r.json();$('#off').style.display='none';if(st.rev!==rev){rev=st.rev;await loadShow()}live()}catch(e){$('#off').style.display='flex'}setTimeout(poll,90)}

function renderAll(){renderSelBar();renderStage();renderTabs();renderTab()}

/* ---------- объекты (экраны) ---------- */
const OC=['#ffb020','#3dd6c6','#ff6b9a','#8b9dff','#7bd88f','#ffd166','#c38bff','#5ec8ff','#ff8f5e','#b8e05a'];
const objOf=id=>show.objects.find(o=>o.members.includes(id));
let single=false;
const expand=arr=>{if(single)return[...arr];const s=new Set(arr);arr.forEach(i=>{const o=objOf(i);if(o)o.members.forEach(m=>s.add(m))});return[...s]};
function objInfo(w,i){const o=objOf(w.id);if(!o)return{cls:'',sty:'',tag:''};const n=show.winches.length,cols=Math.max(1,Math.min(show.layout.cols,n));
  const same=j=>j>=0&&j<n&&objOf(show.winches[j].id)===o,first=!(i%cols!==0&&same(i-1)),last=!((i+1)%cols!==0&&same(i+1));
  return{cls:' obj'+(first?' ol':'')+(last?' or':''),sty:` style="--oc:${OC[show.objects.indexOf(o)%OC.length]}"`,tag:first?esc(o.name):''}}

/* ---------- выбор ---------- */
function setSel(arr,add){if(!add)sel.clear();arr.forEach(i=>sel.add(i));markSel()}
function markSel(){if(tab==='lim'&&st&&st.teach.length)api('/api/teach',{on:true,ids:ids()});Object.entries(cells).forEach(([id,c])=>c.el.classList.toggle('sel',sel.has(+id)));$('#selc').textContent=sel.size;$$('.nsel').forEach(e=>e.textContent=sel.size);syncMpos(true);if(tab==='ch')renderTab()}
function renderSelBar(){
  $('#selbar').innerHTML=`<span class="t">Выбор:</span><button data-s="all">Все <kbd>Ctrl+A</kbd></button><button data-s="none">Нет</button><button data-s="inv">Инверт</button><button data-s="odd">Нечёт</button><button data-s="even">Чёт</button>
  <span class="t" style="margin-left:10px">Группы:</span>${show.groups.map(g=>`<button class="chip" data-g="${g.id}" title="Shift — добавить к выделению">${esc(g.name)}<span class="x" data-del="${g.id}">✕</span></button>`).join('')}<button class="ghost" id="gadd">+ группа из выделенных</button>
  <span class="t" style="margin-left:10px">Экраны:</span><button class="ghost" id="olink" title="Связать выделенные лебёдки в один объект — экран будет двигаться целиком">⛓ Связать</button><button class="ghost" id="ounlink" title="Убрать связь у выделенных">Разъединить</button>`;
  $$('#selbar [data-s]').forEach(b=>b.onclick=()=>{const all=show.winches.map(w=>w.id),s=b.dataset.s;
    if(s==='all')setSel(all);else if(s==='none')setSel([]);else if(s==='inv')setSel(all.filter(i=>!sel.has(i)));
    else setSel(all.filter((_,i)=>(i%2===0)===(s==='odd')))});
  $$('#selbar [data-g]').forEach(b=>b.onclick=async e=>{const id=e.target.dataset.del;const g=show.groups.find(x=>x.id===b.dataset.g);
    if(id){if(await ask('Удалить группу «'+g.name+'»?'))saveCfg({groups:show.groups.filter(x=>x.id!==id)});return}
    setSel(g.members,e.shiftKey)});
  $('#olink').onclick=()=>{if(sel.size<2)return toast('Выделите 2–3 лебёдки одного экрана',true);const objs=show.objects.map(o=>({...o,members:o.members.filter(m=>!sel.has(m))})).filter(o=>o.members.length);
    objs.push({id:'o'+Date.now().toString(36),name:'Экран '+(objs.length+1),members:ids()});saveCfg({objects:objs}).then(r=>r.ok&&toast('Связано: '+sel.size+' лебёдки'))};
  $('#ounlink').onclick=()=>{if(!sel.size)return toast('Выделите экран',true);saveCfg({objects:show.objects.filter(o=>!o.members.some(m=>sel.has(m)))})};
  $('#gadd').onclick=async()=>{if(!sel.size)return toast('Сначала выделите лебёдки',true);const n=await askText('Название группы','Группа '+(show.groups.length+1));if(n)saveCfg({groups:[...show.groups,{id:'g'+Date.now(),name:n,members:ids()}]})};
}

/* ---------- сцена ---------- */
function renderStage(){
  const s=$('#stage'),n=show.winches.length,cols=Math.max(1,Math.min(show.layout.cols,n));
  s.style.gridTemplateColumns=`repeat(${cols},minmax(30px,1fr))`;
  s.innerHTML=show.winches.map((w,i)=>{const oi=objInfo(w,i);return`<div class="cell${w.enabled?'':' off'}${oi.cls}" data-id="${w.id}"${oi.sty}><div class="lbl" title="Клик — выделить/снять. Адрес ${w.universe}.${w.address}">${esc(w.name)}</div><div class="track">${w.min>0?`<div class="lim" style="top:0;height:${w.min}%"></div>`:''}${w.max<100?`<div class="lim" style="top:${w.max}%;bottom:0"></div>`:''}<div class="cable"></div><div class="ball"></div></div><div class="val">–</div>${show.objects.length?`<div class="otag">${oi.tag}</div>`:''}</div>`}).join('')||'<p class="hint">Нет лебёдок — добавьте их в «Настройки → Патч».</p>';
  cells={};$$('#stage .cell').forEach(el=>{const id=+el.dataset.id;cells[id]={el,ball:el.querySelector('.ball'),cable:el.querySelector('.cable'),val:el.querySelector('.val')};
    el.querySelector('.lbl').onclick=()=>{const on=!sel.has(id);expand([id]).forEach(i=>on?sel.add(i):sel.delete(i));markSel()};
    const tr=el.querySelector('.track');tr.onpointerdown=e=>startDrag(e,id,tr);
    tr.ondblclick=e=>{const r=tr.getBoundingClientRect(),p=clamp((e.clientY-r.top)/r.height*100,0,100);if(!sel.has(id))setSel(expand([id]));api('/api/move',{ids:ids(),pos:p,fade:fadeVal()})}});
  s.onpointerdown=e=>{if(e.target===s)setSel([])};
  fitStage();markSel();
}
function fitStage(){if(!show)return;const s=$('#stage'),n=show.winches.length||1,cols=Math.min(show.layout.cols,n),rows=Math.ceil(n/cols);s.style.setProperty('--th',clamp((s.clientHeight-28)/rows-70,70,380)+'px')}
new ResizeObserver(()=>fitStage()).observe($('#stage'));
const sendMove=throttle(t=>api('/api/move',{abs:t,fade:0}),45);
function startDrag(e,id,tr){
  e.preventDefault();
  if(!sel.has(id))setSel(expand([id]),e.shiftKey||e.ctrlKey||e.metaKey);
  const h=tr.getBoundingClientRect().height,y0=e.clientY,start={};sel.forEach(i=>start[i]=st?.pos?.[i]??0);
  tr.setPointerCapture(e.pointerId);
  tr.onpointermove=ev=>{const d=(ev.clientY-y0)/h*100,t={};for(const i in start)t[i]=clamp(start[i]+d,0,100);sendMove(t)};
  tr.onpointerup=tr.onpointercancel=()=>{tr.onpointermove=null};
}
function syncMpos(force){if(mposDrag||!st||!sel.size)return;const a=ids().map(i=>st.pos[i]??0),v=a.reduce((x,y)=>x+y,0)/a.length;$('#mpos').value=v;$('#mposv').textContent=Math.round(v)+'%'}
const sendMpos=throttle(v=>api('/api/move',{ids:ids(),pos:v,fade:0}),45);
$('#mpos').oninput=e=>{mposDrag=true;$('#mposv').textContent=Math.round(e.target.value)+'%';if(sel.size)sendMpos(+e.target.value)};
$('#mpos').onchange=()=>{mposDrag=false};
$$('.move [data-p]').forEach(b=>b.onclick=()=>{if(!sel.size)return toast('Выделите лебёдки',true);api('/api/move',{ids:ids(),pos:+b.dataset.p,fade:fadeVal()})});

/* ---------- верхняя панель ---------- */
$('#arm').onclick=async()=>{if(!st)return;if(!st.armed&&!await ask('Включить моторы (Safety)?\nЛебёдки поедут к текущим позициям на пульте.'))return;api('/api/arm',{on:!st.armed})};
$('#home').onclick=()=>api('/api/home',{ids:sel.size?ids():null,fade:fadeVal()});
$('#stop').onclick=()=>{api('/api/stop');toast('СТОП — всё замерло на месте')};
const sendMaster=throttle(v=>api('/api/master',{value:v}),60);
$('#master').oninput=e=>{$('#masterv').textContent=e.target.value+'%';sendMaster(e.target.value/100)};

/* ---------- live ---------- */
function live(){
  if(!show||!st)return;
  const a=st.stats,net=$('#net');
  if(!show.artnet.enabled){net.className='pill';net.textContent='Art-Net: отправка выключена'}
  else if(a.error){net.className='pill bad';net.textContent='Art-Net: '+a.error}
  else{net.className='pill ok';net.textContent=`Art-Net → ${show.artnet.ip} · ${a.fps} fps · U ${a.universes.join(', ')||'–'}`}
  const arm=$('#arm');arm.className=st.armed?'on':'';arm.textContent=st.armed?'● МОТОРЫ ВКЛ':'МОТОРЫ ВЫКЛ';
  if(document.activeElement!==$('#master')){$('#master').value=Math.round(st.master*100);$('#masterv').textContent=Math.round(st.master*100)+'%'}
  for(const id in cells){const c=cells[id],p=st.pos[id]??0;c.ball.style.top=p+'%';c.cable.style.height=p+'%';c.val.textContent=Math.round(p)+'%';c.el.classList.toggle('fx',!!st.fxOf[id])}
  syncMpos();
  const tp=$('#tcpill');if(st.tc&&st.tc.en){tp.hidden=false;tp.textContent='TC '+fmtTC(st.tc.t,show.timecode.fps)}else tp.hidden=true;
  if(tab==='fx')liveFx();else if(tab==='seq')liveSeq();else if(tab==='tc')liveTc();else if(tab==='lim')liveLim();else if(tab==='ch')liveCh();else if(tab==='presets')$$('.ptile').forEach(t=>t.classList.toggle('last',t.dataset.id===st.lastPreset));
}

/* ---------- вкладки ---------- */
function renderTabs(){$('#tabs').innerHTML=TABS.map(([k,n])=>`<button data-t="${k}" class="${tab===k?'on':''}">${n}</button>`).join('');$$('#tabs button').forEach(b=>b.onclick=()=>{if(tab==='lim'&&b.dataset.t!=='lim'){single=false;if(st&&st.teach.length)api('/api/teach',{on:false})}tab=b.dataset.t;renderTabs();renderTab()})}
function renderTab(){({presets:tabPresets,fx:tabFx,shapes:tabShapes,seq:tabSeq,tc:tabTc,lim:tabLim,ch:tabCh,set:tabSet})[tab]();live()}
function rng(o,k,label,min,max,step,unit){const v=O[o][k];return`<div class="rng"><span>${label}</span><input type="range" data-o="${o}" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${v}"><output>${fmtv(v,unit)}</output></div>`}
function fmtv(v,u){v=+v;return(Number.isInteger(v)?v:v.toFixed(2).replace(/0$/,''))+(u||'')}
function bindRng(root,cb){$$('input[type=range][data-o]',root).forEach(r=>r.oninput=()=>{O[r.dataset.o][r.dataset.k]=+r.value;const u=r.closest('.rng').querySelector('output');u.textContent=fmtv(r.value,u.textContent.replace(/[\d.\-]/g,''));cb&&cb(r.dataset.k)})}
const ordSel=(id,v)=>`<select id="${id}">${ORD.map(([k,n])=>`<option value="${k}"${k===v?' selected':''}>${n}</option>`).join('')}</select>`;

/* Пресеты */
function tabPresets(){
  const el=$('#tab');
  el.innerHTML=`<h4>Записать текущие позиции</h4>
  <div class="row"><input id="pname" placeholder="Название (необязательно)"><input id="pfade" type="number" class="num" value="3" min="0" step="0.5" title="Время перехода, с"><button class="pri" id="pstore">● Записать</button></div>
  <div class="row" style="gap:14px"><label class="chk"><input type="checkbox" id="ponly"> только выделенные (<span class="nsel">${sel.size}</span>)</label><label class="chk" title="Работающие эффекты запишутся в пресет и запустятся при его вызове"><input type="checkbox" id="pfx" checked> с эффектами</label></div>
  <h4>Пресеты <span class="sp"></span><span class="hint" style="text-transform:none;letter-spacing:0">клавиши 1–9</span></h4>
  <div class="ptiles">${show.presets.map((p,i)=>`<div class="ptile" data-id="${p.id}"><span class="pk">${i<9?i+1:''}</span><button class="pgo"><b>${esc(p.name)}</b><small>${Object.keys(p.pos).length} лб · ${p.fade} с${p.fx&&p.fx.length?` · <span class="fxb">${p.fx.map(e=>FXN[e.params.type]||'эффект').join(', ')}</span>`:''}</small>${presetTCs(p.id).length?`<small class="tcb">TC ${presetTCs(p.id).map(t=>fmtTC(t,show.timecode.fps)).join(', ')}</small>`:''}</button><div class="pact"><button data-a="upd" title="Перезаписать текущими позициями">↻</button><button data-a="ren" title="Переименовать">✎</button><button data-a="fade" title="Время перехода">⏱</button><button data-a="tc" title="Запуск по таймкоду">TC</button><button data-a="del" title="Удалить">✕</button></div></div>`).join('')}</div>
  ${show.presets.length?'':'<p class="hint">Расставьте лебёдки (перетаскивайте шарики, двойной клик — сразу в точку) и нажмите «Записать».</p>'}`;
  $('#pstore').onclick=async()=>{const only=$('#ponly').checked;if(only&&!sel.size)return toast('Нет выделенных',true);const r=await api('/api/preset/store',{name:$('#pname').value,fade:+$('#pfade').value,ids:only?ids():null,fx:$('#pfx').checked});if(r.ok)toast('Пресет записан'+(st&&st.fx.length&&$('#pfx').checked?' вместе с эффектами':''))};
  $$('.ptile').forEach(t=>{const p=show.presets.find(x=>x.id===t.dataset.id);
    t.querySelector('.pgo').onclick=()=>api('/api/preset/recall',{id:p.id});
    t.querySelectorAll('[data-a]').forEach(b=>b.onclick=async()=>{const a=b.dataset.a,list=show.presets.map(x=>({...x}));const q=list.find(x=>x.id===p.id);
      if(a==='tc'){const fps=show.timecode.fps,cur=presetTCs(p.id).map(t=>fmtTC(t,fps)).join(', ');
        const v=await askText('Запуск пресета «'+p.name+'» по таймкоду.\nВремя ЧЧ:ММ:СС:КК, несколько — через запятую. Пусто — убрать.\nТекущий TC: '+fmtTC(st?.tc?.t,fps),cur||fmtTC(st?.tc?.t??0,fps));if(v===null)return;
        const ts=v.split(/[,;]+/).map(x=>x.trim()).filter(Boolean).map(x=>parseTC(x,fps));if(ts.some(t=>t==null||t<0))return toast('Формат таймкода: ЧЧ:ММ:СС:КК',true);
        const ev=show.timecode.events.filter(e=>!(e.action==='preset'&&e.ref===p.id)).concat(ts.map((t,i)=>({id:'e'+Date.now().toString(36)+i,t,action:'preset',ref:p.id,fade:null})));
        const r=await saveCfg({timecode:{...show.timecode,events:ev}});if(!r.ok)return;
        if(ts.length&&!show.timecode.enabled){if(await ask('Таймкод назначен. Включить «Запуск по таймкоду» сейчас?'))api('/api/tc_enable',{on:true})}else toast(ts.length?'Пресет запустится по TC':'TC у пресета убран');return}
      if(a==='upd'){if(await ask('Перезаписать «'+p.name+'» текущими позициями?'))api('/api/preset/store',{id:p.id,ids:Object.keys(p.pos).map(Number),fx:true});return}
      if(a==='ren'){const n=await askText('Название',p.name);if(!n)return;q.name=n}
      if(a==='fade'){const f=await askText('Время перехода, секунд',p.fade);if(f===null)return;q.fade=+f||0}
      if(a==='del'){if(!await ask('Удалить «'+p.name+'»?'))return;list.splice(list.indexOf(q),1)}
      saveCfg({presets:list})})});
}

/* Эффекты */
const pushFx=throttle(()=>{if(editFx&&st&&st.fx.some(f=>f.id===editFx))api('/api/fx/update',{id:editFx,params:O.fxp})},80);
function tabFx(){
  const el=$('#tab'),p=O.fxp;
  el.innerHTML=`<h4>Групповое движение</h4><div class="fxgrid">${FX.map(f=>`<button class="fxcard${p.type===f.t?' on':''}" data-t="${f.t}"><b>${f.n}</b><small>${f.d}</small></button>`).join('')}</div>
  <h4>Параметры</h4>
  ${rng('fxp','lo','Верхняя точка',0,100,1,'%')}${rng('fxp','hi','Нижняя точка',0,100,1,'%')}${rng('fxp','period','Период',0.5,60,0.5,' с')}
  ${p.type==='breathe'||p.type==='random'?'':rng('fxp','spread','Сдвиг фазы',0,4,0.05,'×')}
  ${p.type==='chase'?rng('fxp','width','Ширина капли',0.03,0.5,0.01,''):''}
  ${rng('fxp','fadein','Плавный вход',0,20,0.5,' с')}
  <div class="row">${ordSel('ford',p.order)}<label class="chk"><input type="checkbox" id="frev"${p.reverse?' checked':''}> реверс</label></div>
  ${show.objects.length?`<div class="row"><label class="chk"><input type="checkbox" id="flink"${p.linked!==false?' checked':''}> экраны движутся целиком (${show.objects.length} шт.)</label></div>`:''}
  <div class="row"><button class="pri" id="fgo">▶ Запустить на выделенных (<span class="nsel">${sel.size}</span>)</button><button id="fnew" title="Следующие изменения не трогают запущенный эффект">Новый</button></div>
  <div class="hint" id="fedit"></div>
  <h4>Работают сейчас<span class="sp"></span><button class="ghost" id="fstopall" style="padding:2px 8px">■ Стоп все</button></h4><div class="list" id="flist"></div>`;
  fxSig='';
  bindRng(el,()=>pushFx());
  $$('.fxcard',el).forEach(b=>b.onclick=()=>{p.type=b.dataset.t;renderTab();pushFx()});
  $('#ford').onchange=e=>{p.order=e.target.value;pushFx()};
  $('#frev').onchange=e=>{p.reverse=e.target.checked;pushFx()};
  if($('#flink'))$('#flink').onchange=e=>{p.linked=e.target.checked;pushFx()};
  $('#fgo').onclick=async()=>{if(!sel.size)return toast('Выделите лебёдки',true);const r=await api('/api/fx/start',{ids:ids(),params:p});if(r.ok){editFx=r.id;fxSig=''}};
  $('#fnew').onclick=()=>{editFx=null;fxSig=''};
  $('#fstopall').onclick=()=>api('/api/fx/stop',{all:true});
}
function liveFx(){
  if(editFx&&!st.fx.some(f=>f.id===editFx))editFx=null;
  const sig=JSON.stringify([editFx,st.fx.map(f=>[f.id,f.members.length,f.params.type])]);
  $('#fedit').textContent=editFx?`✎ Правка эффекта #${editFx} — ползунки меняют его вживую`:'Настройте и запустите на выделенных лебёдках';
  if(sig===fxSig)return;fxSig=sig;
  $('#flist').innerHTML=st.fx.map(f=>`<div class="it${f.id===editFx?' on':''}" data-id="${f.id}"><b>#${f.id} ${FXN[f.params.type]}</b><span class="hint">${f.members.length} лб</span><button data-a="sel" title="Выделить его лебёдки">◎</button><button data-a="ed" title="Править">✎</button><button data-a="st" title="Остановить">■</button></div>`).join('')||'<p class="hint">Нет активных эффектов.</p>';
  $$('#flist .it').forEach(it=>{const f=st.fx.find(x=>x.id===+it.dataset.id);it.querySelectorAll('button').forEach(b=>b.onclick=()=>{
    if(b.dataset.a==='sel')setSel(f.members);else if(b.dataset.a==='st')api('/api/fx/stop',{id:f.id});else{editFx=f.id;Object.assign(O.fxp,f.params);renderTab()}})});
}

/* Формы */
function shapeV(t,u,i){switch(t){case'flat':return 0;case'line':return u;case'v':return 1-Math.abs(2*u-1);case'a':return Math.abs(2*u-1);case'sine':return .5-.5*Math.cos(2*Math.PI*u);case'arc':return Math.sqrt(Math.max(0,1-(2*u-1)**2));case'checker':return i%2;default:return[.3,.9,.1,.6,.8,.2,.5,1,.4][i]}}
function tabShapes(){
  const el=$('#tab'),p=O.shp;
  el.innerHTML=`<h4>Выстроить фигуру из выделенных (<span class="nsel">${sel.size}</span>)</h4>
  <div class="shapes">${SH.map(([t,n])=>`<button class="shape" data-t="${t}"><div class="mini">${[...Array(9)].map((_,i)=>`<i style="height:${3+shapeV(t,i/8,i)*26}px"></i>`).join('')}</div>${n}</button>`).join('')}</div>
  <h4>Параметры</h4>${rng('shp','lo','Верх фигуры',0,100,1,'%')}${rng('shp','hi','Низ фигуры',0,100,1,'%')}${rng('shp','fade','Переход',0,30,0.5,' с')}
  <div class="row">${ordSel('sord',p.order)}<label class="chk"><input type="checkbox" id="srev"${p.reverse?' checked':''}> реверс</label></div>
  ${show.objects.length?`<div class="row"><label class="chk"><input type="checkbox" id="slink"${p.linked!==false?' checked':''}> экраны целиком (фигура строится из экранов)</label></div>`:''}
  <p class="hint">«Ровно» ставит все в верхнюю точку. Порядок «По столбцам / рядам / от центра» учитывает сетку сцены (Настройки → Колонок).</p>`;
  bindRng(el);
  $('#sord').onchange=e=>p.order=e.target.value;$('#srev').onchange=e=>p.reverse=e.target.checked;if($('#slink'))$('#slink').onchange=e=>p.linked=e.target.checked;
  $$('.shape',el).forEach(b=>b.onclick=()=>{if(!sel.size)return toast('Выделите лебёдки',true);api('/api/shape',{ids:ids(),shape:b.dataset.t,...p})});
}

/* Шоу */
function tabSeq(){
  const el=$('#tab');
  if(!show.sequences.find(s=>s.id===curSeq))curSeq=show.sequences[0]?.id||null;
  const s=show.sequences.find(x=>x.id===curSeq);
  const popt=v=>`<option value="">—</option>`+show.presets.map(p=>`<option value="${p.id}"${p.id===v?' selected':''}>${esc(p.name)}</option>`).join('');
  el.innerHTML=`<div class="row"><select id="ssel" style="flex:1">${show.sequences.map(q=>`<option value="${q.id}"${q.id===curSeq?' selected':''}>${esc(q.name)}</option>`).join('')||'<option>— нет шоу —</option>'}</select><button id="snew">+ Шоу</button>${s?'<button id="sren">✎</button><button id="sdel">✕</button>':''}</div>
  ${s?`<div class="row"><button id="sback" title="Назад">◀</button><button class="pri" id="splay">▶ Старт</button><button id="sgo">GO ▶▶<kbd>G</kbd></button><button id="sstop">■</button><label class="chk"><input type="checkbox" id="sloop"${s.loop?' checked':''}> по кругу</label></div>
  <div class="hint" id="sstat">Остановлено</div><div class="prog"><i id="sprog"></i></div>
  <table><thead><tr><th>#</th><th>Пресет</th><th>Переход, с</th><th>Пауза, с</th><th></th></tr></thead><tbody>
  ${s.cues.map((c,i)=>`<tr data-i="${i}"><td><button class="ghost" data-a="go" title="Запустить с этого шага" style="padding:2px 6px">${i+1}</button></td><td><select data-f="preset">${popt(c.preset)}</select></td><td><input class="num" data-f="fade" type="number" min="0" step="0.5" value="${c.fade}"></td><td><input class="num" data-f="hold" type="number" min="0" step="0.5" placeholder="GO" value="${c.hold??''}"></td><td style="white-space:nowrap"><button class="ghost" data-a="up">↑</button><button class="ghost" data-a="dn">↓</button><button class="ghost" data-a="del">✕</button></td></tr>`).join('')}
  </tbody></table><div class="row" style="margin-top:8px"><button id="cadd">+ Шаг</button></div>
  <p class="hint">Шаг = вызов пресета за «Переход» секунд, затем «Пауза». Пустая пауза — шоу ждёт кнопку GO (клавиша G).${show.presets.length?'':' <span class="warn">Сначала запишите пресеты.</span>'}</p>`:'<p class="hint">Шоу — это цепочка пресетов с переходами и паузами. Создайте первое.</p>'}`;
  const upd=fn=>{const list=JSON.parse(JSON.stringify(show.sequences));fn(list.find(x=>x.id===curSeq),list);saveCfg({sequences:list})};
  $('#ssel').onchange=e=>{curSeq=e.target.value;renderTab()};
  $('#snew').onclick=async()=>{const n=await askText('Название шоу','Шоу '+(show.sequences.length+1));if(!n)return;const id='s'+Date.now();curSeq=id;saveCfg({sequences:[...show.sequences,{id,name:n,loop:false,cues:show.presets.slice(0,3).map(p=>({preset:p.id,fade:p.fade,hold:2}))}]})};
  if(!s)return;
  $('#sren').onclick=async()=>{const n=await askText('Название',s.name);if(n)upd(q=>q.name=n)};
  $('#sdel').onclick=async()=>{if(await ask('Удалить шоу «'+s.name+'»?'))upd((q,l)=>l.splice(l.indexOf(q),1))};
  $('#sloop').onchange=e=>upd(q=>q.loop=e.target.checked);
  $('#splay').onclick=()=>api('/api/seq/play',{id:s.id});$('#sgo').onclick=()=>api('/api/seq/go');$('#sback').onclick=()=>api('/api/seq/back');$('#sstop').onclick=()=>api('/api/seq/stop');
  $('#cadd').onclick=()=>upd(q=>q.cues.push({preset:show.presets[0]?.id||'',fade:3,hold:2}));
  $$('#tab tr[data-i]').forEach(tr=>{const i=+tr.dataset.i;
    tr.querySelectorAll('[data-f]').forEach(inp=>inp.onchange=()=>upd(q=>{const f=inp.dataset.f;q.cues[i][f]=f==='preset'?inp.value:(inp.value===''&&f==='hold'?null:+inp.value)}));
    tr.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{const a=b.dataset.a;
      if(a==='go')return api('/api/seq/play',{id:s.id,idx:i});
      upd(q=>{const c=q.cues;if(a==='del')c.splice(i,1);else{const j=a==='up'?i-1:i+1;if(j>=0&&j<c.length)[c[i],c[j]]=[c[j],c[i]]}})})});
}
function liveSeq(){
  const s=st.seq,on=s&&s.id===curSeq;$$('#tab tr[data-i]').forEach(tr=>tr.classList.toggle('cur',on&&+tr.dataset.i===s.idx));
  const stat=$('#sstat');if(!stat)return;
  if(!s){stat.textContent='Остановлено';$('#sprog').style.width='0'}
  else if(!on){stat.textContent='Играет другое шоу'}
  else{stat.textContent=`Шаг ${s.idx+1} · ${s.t.toFixed(1)} с`+(s.dur===null?' · ждёт GO':'');$('#sprog').style.width=(s.dur?clamp(s.t/s.dur,0,1)*100:100)+'%'}
}

/* Таймкод */
const presetTCs=pid=>(show.timecode?.events||[]).filter(e=>e.action==='preset'&&e.ref===pid).map(e=>e.t);
const TCA=[['preset','Пресет'],['seq','Запустить шоу'],['seq_stop','Остановить шоу'],['fx','Эффект'],['fx_stop','Стоп всех эффектов'],['stop','СТОП (замереть)'],['home','Домой']];
const TCAN=Object.fromEntries(TCA);
let tcForm={t:'00:00:00:00',action:'preset',ref:'',fade:''};
function fmtTC(t,fps){if(t==null)return'--:--:--:--';const neg=t<0;t=Math.abs(t)+1e-6;const p=n=>String(n).padStart(2,'0');const f=Math.min(Math.floor((t%1)*fps),Math.ceil(fps)-1);return(neg?'-':'')+p(Math.floor(t/3600))+':'+p(Math.floor(t/60)%60)+':'+p(Math.floor(t)%60)+':'+p(f)}
function parseTC(str,fps){const p=String(str).trim().split(/[:;.,]/).filter(x=>x!=='').map(Number);if(!p.length||p.some(isNaN))return null;let h=0,m=0,s=0,f=0;if(p.length>=4)[h,m,s,f]=p.slice(-4);else if(p.length===3)[h,m,s]=p;else if(p.length===2)[m,s]=p;else[s]=p;return h*3600+m*60+s+f/fps}
function evLabel(e){const P=show.presets.find(p=>p.id===e.ref),Q=show.sequences.find(q=>q.id===e.ref);
  if(e.action==='preset')return'Пресет «'+(P?esc(P.name):'<span class="warn">удалён</span>')+'»';
  if(e.action==='seq')return'Шоу «'+(Q?esc(Q.name):'<span class="warn">удалено</span>')+'»';
  if(e.action==='fx')return(FXN[e.params?.type]||'Эффект')+' · '+(e.members||[]).length+' лб';
  return TCAN[e.action]}
function tabTc(){
  const el=$('#tab'),c=show.timecode,fps=c.fps,a=tcForm.action;
  const refSel=a==='preset'?`<select id="eref" style="flex:1">${show.presets.map(p=>`<option value="${p.id}"${p.id===tcForm.ref?' selected':''}>${esc(p.name)}</option>`).join('')||'<option value="">— нет пресетов —</option>'}</select>`
    :a==='seq'?`<select id="eref" style="flex:1">${show.sequences.map(q=>`<option value="${q.id}"${q.id===tcForm.ref?' selected':''}>${esc(q.name)}</option>`).join('')||'<option value="">— нет шоу —</option>'}</select>`
    :a==='fx'?`<span class="hint" style="flex:1">${FXN[O.fxp.type]} с настройками из вкладки «Эффекты» на выделенных (<span class="nsel">${sel.size}</span>)</span>`:'';
  el.innerHTML=`<div class="tcbox"><div class="tcbig" id="tcbig">--:--:--:--</div><div class="hint mono" id="tcraw" style="margin:4px 0 8px"></div><span class="pill" id="tcsig">…</span></div>
  <div class="row"><button id="tcen" class="${c.enabled?'pri':''}" style="flex:1">${c.enabled?'● Запуск по таймкоду ВКЛ':'Запуск по таймкоду ВЫКЛ'}</button></div>
  <div class="row"><span class="t" style="width:72px">Источник</span><select id="tcsrc" style="flex:1"><option value="artnet"${c.source==='artnet'?' selected':''}>Art-Net Timecode (вход по сети)</option><option value="ltc"${c.source==='ltc'?' selected':''}>LTC (аудиовход)</option><option value="internal"${c.source==='internal'?' selected':''}>Внутренние часы (репетиция)</option></select></div>
  ${c.source==='internal'?`<div class="row"><button class="pri" id="tcplay">▶ Пуск</button><button id="tcstop" title="В начало">⏹</button><input id="tcseek" class="mono" placeholder="00:01:30:00"><button id="tcgo">Перейти</button></div>`:''}
  ${c.source==='ltc'?`<div class="row"><select id="ltcdev" style="flex:1"><option value="">Звуковой вход по умолчанию</option>${LT.devs.map(d=>`<option value="${esc(d.id)}"${d.id===LT.cfg.dev?' selected':''}>${esc(d.label)}</option>`).join('')}</select><select id="ltcch"><option value="0"${LT.cfg.ch===0?' selected':''}>Канал 1 (L)</option><option value="1"${LT.cfg.ch===1?' selected':''}>Канал 2 (R)</option></select></div>
  <div class="row"><button id="ltcbtn" class="${LT.on?'':'pri'}">${LT.on?'■ Остановить приём':'Слушать вход LTC'}</button><span class="t">Уровень</span><div class="meter"><i id="ltclvl"></i></div></div>
  <div class="hint" id="ltcst" style="margin-bottom:8px"></div>`:''}
  <h4>Новое событие<span class="sp"></span><span class="hint" style="text-transform:none;letter-spacing:0">клавиша T — на текущем TC</span></h4>
  <div class="row"><input id="etc" class="mono" value="${esc(tcForm.t)}" style="width:118px;flex:none"><button id="enow" title="Взять текущий таймкод">⟳ сейчас</button><select id="eact" style="flex:1">${TCA.map(([k,n])=>`<option value="${k}"${k===a?' selected':''}>${n}</option>`).join('')}</select></div>
  ${refSel||a==='preset'||a==='home'?`<div class="row">${refSel}${a==='preset'||a==='home'?`<input id="efade" class="num" type="number" min="0" step="0.5" placeholder="${a==='home'?'3':'пресет'}" value="${esc(tcForm.fade)}" title="Время перехода, с (пусто — как в пресете)"><span class="t">с</span>`:''}</div>`:''}
  <button class="pri" id="eadd">+ Добавить событие</button>
  <h4>События (${c.events.length})</h4>
  <div style="overflow-x:auto"><table id="etab"><thead><tr><th>Таймкод</th><th>Действие</th><th>Пер., с</th><th></th></tr></thead><tbody>
  ${c.events.map(e=>`<tr data-id="${e.id}"><td><input data-f="t" class="mono" value="${fmtTC(e.t,fps)}" style="width:104px"></td><td>${evLabel(e)}</td><td>${e.action==='preset'||e.action==='home'?`<input data-f="fade" class="num" type="number" min="0" step="0.5" value="${e.fade??''}" placeholder="—" style="width:54px">`:''}</td><td style="white-space:nowrap"><button class="ghost" data-a="test" title="Выполнить сейчас">▶</button><button class="ghost" data-a="del" title="Удалить">✕</button></td></tr>`).join('')}
  </tbody></table></div>${c.events.length?'':'<p class="hint">Пока нет событий. Выберите время и действие и нажмите «Добавить», или во время прогона жмите T.</p>'}
  <h4>Настройки таймкода</h4>
  <div class="row"><span class="t">Начало шоу</span><input id="tcoff" class="mono" value="${fmtTC(c.offset,fps)}" style="width:110px;flex:none"><span class="t">FPS</span><select id="tcfps">${[24,25,30].map(f=>`<option${f===fps?' selected':''}>${f}</option>`).join('')}</select></div>
  <div class="row"><span class="t">UDP порт</span><input id="tcport" class="num" type="number" value="${c.port}"><label class="chk"><input type="checkbox" id="tcchase"${c.chase?' checked':''}> догонять при перемотке</label><button id="tcsave">Сохранить</button></div>
  <p class="hint">«Начало шоу»: если таймкод трека стартует с 01:00:00:00, укажите это время, и события будут отсчитываться от нуля. «Догонять»: после перемотки, старта с середины или возврата сигнала сразу выполняется последнее прошедшее событие. Источник Art-Net Timecode: Resolume, grandMA, Madrix, ShowKontrol, TimeLord и т.п. отправляют его на порт 6454.</p>`;
  const save=part=>saveCfg({timecode:{...show.timecode,...part}});
  const keepForm=()=>{tcForm.t=$('#etc').value;const f=$('#efade');if(f)tcForm.fade=f.value;const r=$('#eref');if(r)tcForm.ref=r.value};
  $('#tcen').onclick=()=>api('/api/tc_enable',{on:!c.enabled});
  $('#tcsrc').onchange=e=>save({source:e.target.value});
  if($('#tcplay')){$('#tcplay').onclick=()=>api('/api/tc',{cmd:st.tc.run?'pause':'play'});$('#tcstop').onclick=()=>api('/api/tc',{cmd:'stop'});
    $('#tcgo').onclick=()=>{const t=parseTC($('#tcseek').value,fps);if(t==null)return toast('Формат: ЧЧ:ММ:СС:КК',true);api('/api/tc',{cmd:'seek',t})}}
  if($('#ltcbtn')){$('#ltcbtn').onclick=()=>{if(LT.on){ltcStop();try{localStorage.removeItem('ltcAuto')}catch(e){}renderTab()}else ltcStart()};
    $('#ltcdev').onchange=e=>{LT.cfg.dev=e.target.value;ltcSave();if(LT.on)ltcStart()};
    $('#ltcch').onchange=e=>{LT.cfg.ch=+e.target.value;ltcSave()};if(!LT.devsAsked){LT.devsAsked=true;ltcDevices()}}
  $('#enow').onclick=()=>{$('#etc').value=fmtTC(st?.tc?.t??0,fps)};
  $('#eact').onchange=e=>{keepForm();tcForm.action=e.target.value;tcForm.ref='';renderTab()};
  $('#eadd').onclick=()=>{keepForm();const t=parseTC(tcForm.t,fps);if(t==null||t<0)return toast('Формат таймкода: ЧЧ:ММ:СС:КК',true);
    const ev={id:'e'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),t,action:a,ref:'',fade:null};
    if(a==='preset'||a==='seq'){ev.ref=$('#eref').value;if(!ev.ref)return toast(a==='preset'?'Сначала запишите пресет':'Сначала создайте шоу',true)}
    if((a==='preset'||a==='home')&&tcForm.fade!=='')ev.fade=+tcForm.fade;
    if(a==='fx'){if(!sel.size)return toast('Выделите лебёдки для эффекта',true);ev.params={...O.fxp};ev.members=ids()}
    save({events:[...c.events,ev]}).then(r=>r.ok&&toast('Событие на '+fmtTC(t,fps)))};
  $$('#etab tr[data-id]').forEach(tr=>{const id=tr.dataset.id,upd=fn=>save({events:c.events.map(e=>e.id===id?fn({...e}):e)});
    tr.querySelectorAll('[data-f]').forEach(inp=>inp.onchange=()=>{if(inp.dataset.f==='t'){const t=parseTC(inp.value,fps);if(t==null)return toast('Формат: ЧЧ:ММ:СС:КК',true);upd(e=>(e.t=t,e))}else upd(e=>(e.fade=inp.value===''?null:+inp.value,e))});
    tr.querySelector('[data-a=test]').onclick=()=>api('/api/tc_fire',{id});
    tr.querySelector('[data-a=del]').onclick=()=>save({events:c.events.filter(e=>e.id!==id)})});
  $('#tcsave').onclick=()=>{const off=parseTC($('#tcoff').value,+$('#tcfps').value);if(off==null)return toast('Формат: ЧЧ:ММ:СС:КК',true);save({offset:off,fps:+$('#tcfps').value,port:+$('#tcport').value,chase:$('#tcchase').checked}).then(r=>r.ok&&toast('Сохранено'))};
}
function liveTc(){
  const T=st.tc,c=show.timecode;if(!T||!$('#tcbig'))return;
  const big=$('#tcbig');big.textContent=fmtTC(T.t,c.fps);big.classList.toggle('live',T.t!=null&&(T.src==='artnet'||T.run));
  $('#tcraw').textContent=T.raw!=null&&c.offset>0?'вход '+fmtTC(T.raw,c.fps):'';
  const sg=$('#tcsig');
  if(T.src==='internal'){sg.className='pill ok';sg.textContent='Внутренние часы · '+(T.run?'идут':'пауза');const b=$('#tcplay');if(b)b.textContent=T.run?'⏸ Пауза':'▶ Пуск'}
  else if(T.src==='ltc'){sg.className='pill '+(T.t==null?'bad':'ok');sg.textContent=T.t==null?'Нет LTC':'LTC · '+T.fps+' fps';
    const lv=$('#ltclvl');if(lv){lv.style.width=Math.min(100,LT.level*140)+'%';lv.style.background=LT.level>0.95?'var(--bad)':'var(--ok)'}
    const ls=$('#ltcst');if(ls)ls.innerHTML=LT.err?`<span class="warn">${esc(LT.err)}</span>`:!LT.on?'Приём выключен. Подайте LTC в линейный вход и нажмите «Слушать».':performance.now()-LT.lastAt<500?`Декодируется ${fmtTC(LT.last,LT.fps)} · ${LT.fps} fps`:LT.level<0.01?'Тишина на входе — проверьте кабель и канал':'Звук есть, но LTC не распознан — проверьте канал L/R'}
  else if(T.err){sg.className='pill bad';sg.textContent=T.err}
  else if(T.t==null){sg.className='pill bad';sg.textContent='Нет сигнала Art-Net TC (порт '+c.port+')'}
  else{sg.className='pill ok';sg.textContent='Art-Net Timecode · '+T.fps+' fps'}
  const nx=T.t==null?null:c.events.find(e=>e.t>T.t+1e-6);
  $$('#etab tr[data-id]').forEach(tr=>{tr.classList.toggle('cur',tr.dataset.id===T.last);tr.classList.toggle('next',!!nx&&tr.dataset.id===nx.id)});
}

/* LTC: декодер biphase-mark со звукового входа (работает в этой вкладке браузера) */
class LTCDecoder{
  constructor(sr,onFrame){this.sr=sr;this.on=onFrame;this.T=sr/2000;this.n=0;this.st=0;this.half=false;this.bits=[];this.peak=0}
  push(buf){for(let i=0;i<buf.length;i++){const x=buf[i],a=x<0?-x:x;this.peak=a>this.peak?a:this.peak*0.99997;const th=Math.max(0.004,this.peak*0.2);this.n++;
    if(this.st>=0&&x<-th){this.st=-1;this.edge(this.n);this.n=0}else if(this.st<=0&&x>th){this.st=1;this.edge(this.n);this.n=0}}}
  edge(d){const T=this.T;
    if(d>T*1.6||d<T*0.25){this.half=false;this.bits.length=0;return}
    if(d>T*0.75){if(this.half){this.half=false;this.bits.length=0}this.T=T*0.9+d*0.1;this.bit(0)}
    else{this.T=T*0.9+2*d*0.1;if(this.half){this.half=false;this.bit(1)}else this.half=true}
    this.T=Math.min(this.sr/1700,Math.max(this.sr/2600,this.T))}
  bit(b){const B=this.bits;B.push(b);if(B.length>80)B.shift();if(B.length<80)return;
    const S=[0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,1];for(let k=0;k<16;k++)if(B[64+k]!==S[k])return;
    const v=(s,n)=>{let r=0;for(let k=0;k<n;k++)r|=B[s+k]<<k;return r};
    const f=v(0,4)+10*v(8,2),sc=v(16,4)+10*v(24,3),m=v(32,4)+10*v(40,3),h=v(48,4)+10*v(56,2);B.length=0;
    if(f>=30||sc>=60||m>=60||h>=24)return;
    const r=this.sr/(80*this.T),fps=[24,25,30].reduce((a,b)=>Math.abs(b-r)<Math.abs(a-r)?b:a);
    this.on(h,m,sc,f,fps)}
}
const LT={ctx:null,stream:null,node:null,on:false,level:0,last:null,lastAt:-1e9,fps:25,err:'',devs:[],cfg:{dev:'',ch:0}};
try{Object.assign(LT.cfg,JSON.parse(localStorage.getItem('ltcCfg')||'{}'))}catch(e){}
const ltcSave=()=>{try{localStorage.setItem('ltcCfg',JSON.stringify(LT.cfg))}catch(e){}};
const sendLtc=throttle((t,fps)=>api('/api/ltc',{t,fps}),35);
async function ltcDevices(){try{const d=await navigator.mediaDevices.enumerateDevices();LT.devs=d.filter(x=>x.kind==='audioinput'&&x.deviceId&&x.deviceId!=='default').map((x,i)=>({id:x.deviceId,label:x.label||'Вход '+(i+1)}));if(tab==='tc')renderTab()}catch(e){}}
function ltcStop(){try{LT.node&&LT.node.disconnect();LT.stream&&LT.stream.getTracks().forEach(t=>t.stop());LT.ctx&&LT.ctx.close()}catch(e){}Object.assign(LT,{ctx:null,stream:null,node:null,on:false,level:0})}
async function ltcStart(){
  ltcStop();LT.err='';
  try{
    if(!navigator.mediaDevices?.getUserMedia)throw Error('Браузер не даёт доступ к звуку. Откройте пульт по адресу 127.0.0.1 в Chrome/Edge/Firefox.');
    const stream=await navigator.mediaDevices.getUserMedia({audio:{deviceId:LT.cfg.dev?{exact:LT.cfg.dev}:undefined,echoCancellation:false,noiseSuppression:false,autoGainControl:false,channelCount:{ideal:2}}});
    const ctx=new(window.AudioContext||window.webkitAudioContext)();await ctx.resume();
    const src=ctx.createMediaStreamSource(stream),node=ctx.createScriptProcessor(2048,2,1);
    const dec=new LTCDecoder(ctx.sampleRate,(h,m,s,f,fps)=>{const t=h*3600+m*60+s+(f+1)/fps;LT.last=t;LT.lastAt=performance.now();LT.fps=fps;sendLtc(t,fps)});
    node.onaudioprocess=e=>{const ib=e.inputBuffer,d=ib.getChannelData(Math.min(LT.cfg.ch,ib.numberOfChannels-1));dec.push(d);let pk=0;for(let i=0;i<d.length;i+=4){const a=Math.abs(d[i]);if(a>pk)pk=a}LT.level=Math.max(pk,LT.level*0.7)};
    src.connect(node);node.connect(ctx.destination);
    Object.assign(LT,{ctx,stream,node,on:true});try{localStorage.setItem('ltcAuto','1')}catch(e){}
    ltcDevices();toast('Приём LTC включён');
  }catch(e){LT.err=e.name==='NotAllowedError'?'Нет доступа к звуковому входу — разрешите микрофон для этой страницы':(e.message||String(e));ltcStop()}
  if(tab==='tc')renderTab();
}
/* если LTC уже слушали раньше — снова включить по первому клику (браузер требует жест) */
document.addEventListener('pointerdown',()=>{let auto=false;try{auto=localStorage.getItem('ltcAuto')==='1'}catch(e){}if(auto&&!LT.on&&show?.timecode?.source==='ltc')ltcStart()},{once:true});

/* Пределы: настройка по выставленной лебёдке */
let jog=null;
function jogStart(dir,fast){jogStop();if(!sel.size)return toast('Выделите лебёдку на сцене',true);const base={};ids().forEach(i=>base[i]=st?.pos?.[i]??0);
  jog={dir,rate:fast?15:3,t0:performance.now(),base,moved:false};
  jog.timer=setInterval(()=>{const dt=(performance.now()-jog.t0)/1000-0.25;if(dt<=0)return;const t={};for(const i in jog.base)t[i]=clamp(jog.base[i]+jog.dir*jog.rate*dt,0,100);jog.moved=true;api('/api/move',{abs:t,fade:0})},40)}
function jogStop(){if(!jog)return;clearInterval(jog.timer);if(!jog.moved){const t={};for(const i in jog.base)t[i]=clamp(jog.base[i]+jog.dir*0.1,0,100);api('/api/move',{abs:t,fade:0})}jog=null}
function tabLim(){
  const el=$('#tab'),on=!!(st&&st.teach.length);
  el.innerHTML=`<h4>Пределы по выставленной лебёдке</h4>
  <ol class="hint steps"><li>Выделите лебёдку или экран на сцене и нажмите «Начать настройку».</li><li>Удерживая ▲, доведите до крайнего верхнего положения и нажмите «Запомнить верх».</li><li>Удерживая ▼, опустите до крайнего нижнего положения и нажмите «Запомнить низ».</li><li>Нажмите «Готово».</li></ol>
  <div class="row"><button id="tteach" style="flex:1" class="${on?'teachon':'pri'}">${on?'● Идёт настройка — пределы временно сняты':'Начать настройку (<span class="nsel">'+sel.size+'</span>)'}</button></div>
  ${show.objects.length?`<label class="chk" style="margin-bottom:8px"><input type="checkbox" id="tsingle"${single?' checked':''}> выделять отдельные лебёдки внутри экрана (чтобы выровнять экран)</label>`:''}
  <div class="tcbox"><div class="tcbig" id="tpos">—</div><div class="hint" id="tinfo">Выделите лебёдку</div></div>
  <div class="jog"><button data-j="-1" data-f="1" title="Вверх быстро">▲▲</button><button data-j="-1" title="Вверх медленно">▲</button><button data-j="1" title="Вниз медленно">▼</button><button data-j="1" data-f="1" title="Вниз быстро">▼▼</button></div>
  <p class="hint" style="margin-top:0">Удерживайте кнопку — лебёдка едет, отпустили — стоит. Короткое нажатие — шаг 0,1%. Клавиши ↑ ↓, с Shift — быстро. Моторы должны быть включены.</p>
  <div class="row"><button class="pri" id="tsetT" style="flex:1">⤒ Запомнить верх</button><button class="pri" id="tsetB" style="flex:1">⤓ Запомнить низ</button></div>
  <div class="row"><button id="tclr">Сбросить пределы выделенных</button><button id="tdone"${on?'':' disabled'}>Готово</button></div>
  <h4>Пределы всех лебёдок</h4>
  <div style="overflow-x:auto"><table><thead><tr><th>Лб</th><th>Экран</th><th>Верх ⤒</th><th>Низ ⤓</th><th>Ход</th></tr></thead><tbody>
  ${show.winches.map(w=>{const o=objOf(w.id),set=w.min>0||w.max<100;return`<tr data-id="${w.id}"${sel.has(w.id)?' class="cur"':''}><td>${esc(w.name)}</td><td>${o?esc(o.name):'–'}</td><td class="n">${w.min>0?w.min.toFixed(1)+'%':'–'}</td><td class="n">${w.max<100?w.max.toFixed(1)+'%':'–'}</td><td class="n">${set?(w.max-w.min).toFixed(1)+'%':'<span class="hint">не задан</span>'}</td></tr>`}).join('')}</tbody></table></div>`;
  $('#tteach').onclick=()=>{if(on)return;if(!sel.size)return toast('Выделите лебёдку на сцене',true);api('/api/teach',{on:true,ids:ids()}).then(()=>setTimeout(renderTab,150))};
  $('#tdone').onclick=()=>api('/api/teach',{on:false}).then(()=>{toast('Настройка пределов завершена');setTimeout(renderTab,150)});
  if($('#tsingle'))$('#tsingle').onchange=e=>{single=e.target.checked;if(!single)setSel(expand(ids()))};
  $$('.jog button',el).forEach(b=>{const d=+b.dataset.j,f=!!b.dataset.f;b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);jogStart(d,f)};b.onpointerup=b.onpointercancel=b.onlostpointercapture=()=>jogStop()});
  const setLim=(fn,msg)=>{if(!sel.size)return toast('Выделите лебёдку',true);const ch=[];
    saveCfg({winches:show.winches.map(w=>{if(!sel.has(w.id))return w;const p=Math.round((st.pos[w.id]??0)*10)/10;ch.push(w.name);return fn({...w},p)})}).then(r=>r.ok&&toast(msg+' ('+ch.join(', ')+')'))};
  $('#tsetT').onclick=()=>setLim((w,p)=>{w.min=p;if(w.max<=p)w.max=100;return w},'Верхний предел записан');
  $('#tsetB').onclick=()=>setLim((w,p)=>{w.max=p;if(w.min>=p)w.min=0;return w},'Нижний предел записан');
  $('#tclr').onclick=async()=>{if(!sel.size)return toast('Выделите лебёдку',true);if(await ask('Сбросить пределы у выделенных лебёдок ('+sel.size+')?'))setLim(w=>(w.min=0,w.max=100,w),'Пределы сброшены')};
}
function liveLim(){const tp=$('#tpos');if(!tp)return;const I=ids();
  if(!I.length){tp.textContent='—';$('#tinfo').textContent='Выделите лебёдку на сцене';return}
  const ps=I.map(i=>st.pos[i]??0),avg=ps.reduce((a,b)=>a+b,0)/ps.length,w=show.winches.find(x=>x.id===I[0]);
  tp.textContent=avg.toFixed(1)+'%';tp.classList.toggle('live',!!st.teach.length);
  const spread=Math.max(...ps)-Math.min(...ps);
  $('#tinfo').textContent=(I.length>1?`${I.length} лебёдок`+(spread>0.15?` · разброс ${spread.toFixed(1)}%`:'')+' · ':'Лебёдка '+w.name+' · ')+`верх ${w.min>0?w.min.toFixed(1)+'%':'не задан'} · низ ${w.max<100?w.max.toFixed(1)+'%':'не задан'}`+(st.armed?'':' · моторы выключены');
  const b=$('#tteach');if(b&&!!st.teach.length!==b.classList.contains('teachon'))renderTab()}

/* Библиотека приборов */
function roleParams(c,i){const n=(k,v,t)=>`<input class="num" type="number" min="0" max="255" data-p="${k}" value="${v}" title="${t}" style="width:62px">`;
  if(c.role==='safety')return`<span class="t">вкл</span>${n('on',c.on??130,'Значение «мотор включён»')}<span class="t">выкл</span>${n('off',c.off??0,'Значение «мотор выключен»')}`;
  if(c.role==='speed')return`<span class="t">быстро</span>${n('fast',c.fast??255,'DMX при скорости 100%')}<span class="t">медл.</span>${n('slow',c.slow??0,'DMX при минимальной скорости')}`;
  if(c.role==='reset')return`<span class="t">сброс</span>${n('val',c.val??255,'DMX при сбросе')}<span class="t">покой</span>${n('idle',c.idle??0,'DMX в покое')}`;
  if(c.role==='fixed')return n('val',c.val??0,'Постоянное значение');
  return'<span class="hint">от пульта</span>'}
function libEditor(){const f=libEdit,ro=!!f.builtin;
  return`<div class="tcbox" style="text-align:left" id="led"><div class="row" style="justify-content:space-between"><b>${ro?'Встроенный прибор (только просмотр)':f.id?'Редактирование прибора':'Новый прибор'}</b></div>
  <div class="row"><input id="le_maker" placeholder="Производитель" value="${esc(f.maker||'')}"${ro?' disabled':''}><input id="le_model" placeholder="Модель" value="${esc(f.model||'')}"${ro?' disabled':''}></div>
  <div class="row"><input id="le_mode" placeholder="Режим, например 5CH" value="${esc(f.mode||'')}"${ro?' disabled':''}></div>
  <div id="letab">${f.ch.map((c,i)=>`<div class="lch" data-i="${i}"><div class="row"><b class="lnum">${i+1}</b><input data-k="name" value="${esc(c.name)}" style="flex:1;min-width:70px"${ro?' disabled':''}><select data-k="role" style="flex:1.3;min-width:0"${ro?' disabled':''}>${ROLE.map(([k,n])=>`<option value="${k}"${k===c.role?' selected':''}>${n}</option>`).join('')}</select></div>
  <div class="row lpar"><fieldset${ro?' disabled':''}>${roleParams(c,i)}</fieldset><span style="flex:1"></span>${ro?'':'<button class="ghost" data-a="up" title="Выше">↑</button><button class="ghost" data-a="dn" title="Ниже">↓</button><button class="ghost" data-a="del" title="Удалить канал">✕</button>'}</div></div>`).join('')}</div>
  <p class="hint">Порядок строк = порядок DMX-каналов от стартового адреса. Для позиции 16 бит нужны оба канала: «грубо» и «fine». У скорости «быстро» — значение при 100% (у EastSun это 1), «медл.» — при минимуме.</p>
  <div class="row">${ro?'':'<button id="le_add">+ Канал</button>'}<span class="sp" style="flex:1"></span><button id="le_cancel">${ro?'Закрыть':'Отмена'}</button>${ro?'':'<button class="pri" id="le_save">Сохранить прибор</button>'}</div></div>`}
function readLib(){if(!libEdit||libEdit.builtin||!$('#led'))return;libEdit.maker=$('#le_maker').value;libEdit.model=$('#le_model').value;libEdit.mode=$('#le_mode').value;
  libEdit.ch=$$('#letab .lch').map(tr=>{const c={name:tr.querySelector('[data-k=name]').value,role:tr.querySelector('[data-k=role]').value};tr.querySelectorAll('[data-p]').forEach(i=>c[i.dataset.p]=+i.value);return c})}
function bindLib(){
  const fx=()=>fixtures();
  $$('#flib .it').forEach(it=>{const f=fx().find(x=>x.id===it.dataset.id);it.querySelectorAll('[data-a]').forEach(b=>b.onclick=async()=>{const a=b.dataset.a;
    if(a==='view')libEdit=JSON.parse(JSON.stringify(f));
    else if(a==='dup'){libEdit=JSON.parse(JSON.stringify(f));delete libEdit.builtin;libEdit.id=null;libEdit.model+=' (копия)'}
    else if(a==='del'){const n=show.winches.filter(w=>w.fixture===f.id).length;if(n)return toast(`Прибор используется в патче (${n} лебёдок) — сначала замените его`,true);if(!await ask('Удалить прибор «'+fixLabel(f)+'»?'))return;libEdit=null;return saveCfg({library:show.library.filter(x=>x.id!==f.id)})}
    renderTab();setTimeout(()=>$('#led')?.scrollIntoView({block:'nearest',behavior:'smooth'}),30)})});
  $('#lnew').onclick=()=>{libEdit={id:null,maker:'',model:'',mode:'',ch:[{name:'Safety',role:'safety',on:255,off:0},{name:'Позиция',role:'pos_hi'},{name:'Позиция fine',role:'pos_lo'},{name:'Скорость',role:'speed',fast:255,slow:0}]};renderTab();setTimeout(()=>$('#led')?.scrollIntoView({block:'nearest',behavior:'smooth'}),30)};
  if(!$('#led'))return;
  $('#le_cancel').onclick=()=>{libEdit=null;renderTab()};
  if(libEdit.builtin)return;
  $$('#letab [data-k=role]').forEach(s=>s.onchange=()=>{readLib();renderTab()});
  $$('#letab [data-a]').forEach(b=>b.onclick=()=>{readLib();const i=+b.closest('.lch').dataset.i,c=libEdit.ch,a=b.dataset.a;if(a==='del')c.splice(i,1);else{const j=a==='up'?i-1:i+1;if(j>=0&&j<c.length)[c[i],c[j]]=[c[j],c[i]]}renderTab()});
  $('#le_add').onclick=()=>{readLib();libEdit.ch.push({name:'Канал '+(libEdit.ch.length+1),role:'fixed',val:0});renderTab()};
  $('#le_save').onclick=()=>{readLib();const f=libEdit;if(!f.ch.length)return toast('Добавьте хотя бы один канал',true);
    const pos=f.ch.filter(c=>['pos_hi','pos8'].includes(c.role)).length;if(!pos)return toast('Нужен канал позиции (8 или 16 бит)',true);
    if(f.ch.some(c=>c.role==='pos_hi')!==f.ch.some(c=>c.role==='pos_lo'))return toast('Для 16 бит нужны оба канала: «грубо» и «fine»',true);
    let lib=[...show.library];if(f.id&&lib.some(x=>x.id===f.id))lib=lib.map(x=>x.id===f.id?f:x);else{f.id='u'+Date.now().toString(36);lib.push(f)}
    libEdit=null;saveCfg({library:lib}).then(r=>r.ok&&toast('Прибор сохранён — выберите его в патче'))};
}

/* Каналы */
function tabCh(){
  const el=$('#tab'),f=ids()[0],maxc=Math.max(1,...show.winches.map(w=>fixOf(w).ch.length));
  if(f&&st)O.chp.spd=st.spd[f]??60;
  el.innerHTML=`<h4>Выделенные (<span class="nsel">${sel.size}</span>)</h4>
  ${rng('chp','spd','Скорость мотора',1,100,1,'%')}
  <div class="row"><button id="climgo">Настроить пределы →</button></div>
  <div class="row"><button id="cen">Safety вкл</button><button id="cdis">Safety выкл</button><button id="crst">⟲ Reset мотора</button></div>
  <p class="hint">Скорость 100% — самое быстрое значение прибора (у EastSun ES-L32 это DMX 1), минимум — самое медленное. Общий множитель — «Скорость» вверху. Safety выкл держит конкретную лебёдку выключенной, даже когда моторы включены.</p>
  <h4>DMX выход</h4>
  <div style="overflow-x:auto"><table class="dmx"><thead><tr><th>Лб</th><th>U.Адр</th>${[...Array(maxc)].map((_,i)=>`<th class="n">${i+1}</th>`).join('')}</tr></thead><tbody>
  ${show.winches.map(w=>{const fx=fixOf(w);return`<tr data-id="${w.id}"${sel.has(w.id)?' class="cur"':''} title="${esc(fixLabel(fx))}"><td>${esc(w.name)}</td><td>${w.universe}.${w.address}</td>${[...Array(maxc)].map((_,i)=>`<td class="n"${fx.ch[i]?` title="${esc(fx.ch[i].name)}"`:''}>${fx.ch[i]?'–':''}</td>`).join('')}</tr>`}).join('')}</tbody></table></div>
  <p class="hint">Наведите на ячейку — название канала прибора.</p>`;
  const sendSpd=throttle(v=>api('/api/speed',{ids:ids(),value:v}),60);
  bindRng(el,()=>{if(sel.size)sendSpd(O.chp.spd)});
  const en=v=>{if(!sel.size)return toast('Выделите лебёдки',true);saveCfg({winches:show.winches.map(w=>sel.has(w.id)?{...w,enabled:v}:w)})};
  const setLim=fn=>{if(!sel.size)return toast('Выделите лебёдки',true);saveCfg({winches:show.winches.map(w=>sel.has(w.id)?fn({...w},Math.round((st.pos[w.id]??0)*10)/10):w)}).then(r=>r.ok&&toast('Пределы сохранены'))};
  $('#climgo').onclick=()=>{tab='lim';renderTabs();renderTab()};
  $('#cen').onclick=()=>en(true);$('#cdis').onclick=()=>en(false);
  $('#crst').onclick=async()=>{const n=sel.size?sel.size:'ВСЕ';if(await ask(`Отправить Reset на ${n} лебёдк(и) на ${show.device.reset_time} с?\nЗначение Reset берётся из прибора в библиотеке.`))api('/api/reset',{ids:ids()})};
}
function liveCh(){$$('.dmx tr[data-id]').forEach(tr=>{const o=st.out[tr.dataset.id]||[];[...tr.children].slice(2).forEach((td,i)=>td.textContent=o[i]??'')})}

/* Настройки */
function tabSet(){
  const el=$('#tab'),a=show.artnet,d=show.device,FX=fixtures(),nch=w=>fixOf(w).ch.length;
  const pfix=FX.find(f=>f.id===(show.winches[0]?.fixture))||FX[0],cc=pfix.ch.length;
  const used={};show.winches.forEach(w=>{for(let i=0;i<nch(w);i++){const k=w.universe+':'+(w.address+i);used[k]=(used[k]||0)+1}});
  const bad=w=>{for(let i=0;i<nch(w);i++)if(used[w.universe+':'+(w.address+i)]>1||w.address+i>512)return true;return false};
  const fxOpts=v=>FX.map(f=>`<option value="${f.id}"${f.id===v?' selected':''}>${esc(fixLabel(f))}</option>`).join('');
  const useCount=id=>show.winches.filter(w=>w.fixture===id).length;
  el.innerHTML=`<h4>Art-Net</h4>
  <div class="row"><span class="t" style="width:110px">IP / broadcast</span><input id="aip" list="iplist" value="${esc(a.ip)}"><datalist id="iplist"><option value="255.255.255.255"><option value="2.255.255.255"><option value="10.255.255.255"><option value="192.168.1.255"><option value="192.168.0.255"><option value="127.0.0.1"></datalist></div>
  <div class="row"><span class="t" style="width:110px">Сетевая карта</span><select id="abind" style="flex:1"><option value="">авто</option>${[...new Set([...st.ifaces,a.bind].filter(Boolean))].map(i=>`<option${i===a.bind?' selected':''}>${i}</option>`).join('')}</select></div>
  <div class="row"><span class="t">Порт</span><input class="num" id="aport" type="number" value="${a.port}"><span class="t">FPS</span><input class="num" id="afps" type="number" min="1" max="44" value="${a.fps}"><label class="chk"><input type="checkbox" id="aen"${a.enabled?' checked':''}> отправлять</label></div>
  <button class="pri" id="asave">Сохранить Art-Net</button>
  <h4>Общее для лебёдок</h4>
  <div class="row"><span class="t">Reset держать</span><input class="num" id="drt" type="number" min="0.2" step="0.1" value="${d.reset_time}"><span class="t">с</span><span class="t" style="margin-left:10px">Скорость новых</span><input class="num" id="dspd" type="number" min="1" max="100" value="${d.speed}"><span class="t">%</span><button class="pri" id="dsave">Сохранить</button></div>
  <h4>Библиотека приборов</h4>
  <div class="list" id="flib">${FX.map(f=>`<div class="it" data-id="${f.id}"><b>${esc(f.maker)} ${esc(f.model)} <span class="hint" style="font-weight:400">· ${esc(f.mode)} · ${f.ch.length} кан.${useCount(f.id)?' · в патче: '+useCount(f.id):''}</span></b>${f.builtin?'<span class="hint">встроен</span>':''}<button class="ghost" data-a="view" title="${f.builtin?'Посмотреть каналы':'Редактировать'}">${f.builtin?'👁':'✎'}</button><button class="ghost" data-a="dup" title="Создать копию для своих значений">⧉</button>${f.builtin?'':'<button class="ghost" data-a="del" title="Удалить">✕</button>'}</div>`).join('')}</div>
  <div class="row"><button id="lnew">+ Новый прибор</button><span class="hint">Другая модель или режим — создайте прибор по таблице каналов из инструкции.</span></div>
  ${libEdit?libEditor():''}
  <h4>Патч</h4>
  <div class="row"><span class="t">Кол-во</span><input class="num" id="pn" type="number" min="1" max="512" value="${show.winches.length||8}"><span class="t">Universe</span><input class="num" id="pu" type="number" min="0" value="${show.winches[0]?.universe??0}"><span class="t">Старт</span><input class="num" id="pa" type="number" min="1" max="512" value="${show.winches[0]?.address??1}"></div>
  <div class="row"><span class="t">Прибор</span><select id="pfix" style="flex:1">${fxOpts(pfix.id)}</select></div>
  <div class="row"><span class="t">Колонок на сцене</span><input class="num" id="pc" type="number" min="1" max="64" value="${show.layout.cols}"><button id="pgen">Авто-патч</button></div>
  <div style="overflow-x:auto"><table id="ptab"><thead><tr><th>Имя</th><th>Прибор</th><th>Univ</th><th>Адрес</th><th title="Инвертировать направление">Инв</th><th title="Лебёдка не поднимется выше этой точки, % хода (0 = самый верх)">Предел ↑</th><th title="Лебёдка не опустится ниже этой точки, % хода (100 = самый низ)">Предел ↓</th><th>Home</th><th></th></tr></thead><tbody>
  ${show.winches.map(w=>`<tr data-id="${w.id}"${bad(w)?' class="bad" title="Каналы пересекаются или выходят за 512"':''}><td><input data-f="name" value="${esc(w.name)}" style="width:62px"></td><td><select data-f="fixture" style="width:150px">${fxOpts(w.fixture)}</select></td><td><input data-f="universe" type="number" min="0" value="${w.universe}" style="width:46px"></td><td><input data-f="address" type="number" min="1" max="512" value="${w.address}" style="width:54px"></td><td><input data-f="invert" type="checkbox"${w.invert?' checked':''}></td><td><input data-f="min" type="number" min="0" max="100" value="${w.min}" style="width:46px"></td><td><input data-f="max" type="number" min="0" max="100" value="${w.max}" style="width:46px"></td><td><input data-f="home" type="number" min="0" max="100" value="${w.home}" style="width:46px"></td><td><button class="ghost" data-a="del" style="padding:2px 6px">✕</button></td></tr>`).join('')}</tbody></table></div>
  ${show.winches.some(bad)?'<p class="warn">Красные строки: адреса пересекаются или выходят за 512.</p>':''}
  <p class="hint">Пределы ↑/↓ — граница зоны, за которую лебёдка не зайдёт ни вручную, ни в эффектах, ни по таймкоду (0% — верх, 100% — низ). На сцене запретные зоны заштрихованы. Удобнее задавать по выставленной лебёдке — вкладка «Пределы». У связанного экрана действует самый строгий предел его лебёдок.</p>
  <div class="row" style="margin-top:8px"><button id="padd">+ Лебёдка</button><button class="pri" id="psave">Сохранить патч</button></div>
  <h4>Экраны (связанные лебёдки)</h4>
  <p class="hint">Лебёдки одного экрана связываются в объект: выделяются вместе, а в эффектах и формах экран движется целиком — волна идёт по экранам, а не по отдельным лебёдкам.</p>
  <div class="row"><span class="t">Лебёдок на экран</span><input id="opat" value="2" title="Одно число или список по порядку: 2,3,2,2,3" style="width:130px;flex:none"><input id="oname" value="Экран" style="width:84px;flex:none"><button id="obuild">Собрать по порядку</button></div>
  ${show.objects.length?`<div style="overflow-x:auto"><table id="otab"><thead><tr><th>Экран</th><th>Лебёдки</th><th></th></tr></thead><tbody>
  ${show.objects.map((o,i)=>`<tr data-i="${i}"><td><input data-f="name" value="${esc(o.name)}" style="width:110px;border-left:4px solid ${OC[i%OC.length]}"></td><td><input data-f="members" value="${esc(o.members.map(m=>show.winches.find(w=>w.id===m)?.name??m).join(', '))}"></td><td><button class="ghost" data-a="del" style="padding:2px 6px">✕</button></td></tr>`).join('')}
  </tbody></table></div><div class="row" style="margin-top:8px"><button class="pri" id="osave">Сохранить экраны</button></div>`:'<p class="hint">Пока нет экранов. Выделите лебёдки экрана на сцене и нажмите «⛓ Связать», или соберите все по схеме.</p>'}
  <h4>Файл шоу</h4>
  <div class="row"><button id="fexp">⬇ Экспорт</button><button id="fimp">⬆ Импорт</button><button id="freset">Новое шоу</button><input type="file" id="ffile" accept=".json,application/json" hidden></div>
  <p class="hint">Всё сохраняется автоматически в winch_show.json рядом с программой.</p>`;
  $('#asave').onclick=()=>saveCfg({artnet:{ip:$('#aip').value,bind:$('#abind').value,port:+$('#aport').value,fps:+$('#afps').value,enabled:$('#aen').checked}}).then(r=>r.ok&&toast('Art-Net сохранён'));
  $('#dsave').onclick=()=>saveCfg({device:{reset_time:+$('#drt').value,speed:+$('#dspd').value}}).then(r=>r.ok&&toast('Сохранено'));
  bindLib();
  const readRows=()=>$$('#ptab tbody tr').map(tr=>{const w={id:+tr.dataset.id};tr.querySelectorAll('[data-f]').forEach(i=>w[i.dataset.f]=i.type==='checkbox'?i.checked:(i.type==='number'?+i.value:i.value));const o=show.winches.find(x=>x.id===w.id);w.enabled=o?o.enabled:true;return w});
  $('#psave').onclick=()=>saveCfg({winches:readRows(),layout:{cols:+$('#pc').value}}).then(r=>r.ok&&toast('Патч сохранён'));
  $('#padd').onclick=()=>{const ws=readRows(),last=ws[ws.length-1],fx=last?fixOf(last):pfix,lc=last?fixOf(last).ch.length:0;let u=last?last.universe:0,ad=last?last.address+lc:1;if(ad+fx.ch.length-1>512){u++;ad=1}const id=Math.max(0,...ws.map(w=>w.id))+1;ws.push({id,name:String(id),fixture:fx.id,universe:u,address:ad,invert:false,min:0,max:100,home:0,enabled:true});saveCfg({winches:ws})};
  $$('#ptab [data-a=del]').forEach(b=>b.onclick=()=>{const id=+b.closest('tr').dataset.id;saveCfg({winches:readRows().filter(w=>w.id!==id)})});
  $('#pgen').onclick=async()=>{const n=clamp(+$('#pn').value|0,1,512),fx=FX.find(f=>f.id===$('#pfix').value)||pfix,cc=fx.ch.length;if(!await ask(`Пересоздать патч: ${n} × ${fixLabel(fx)}, шаг ${cc} каналов?`))return;let u=+$('#pu').value|0,ad=clamp(+$('#pa').value|0,1,512);const ws=[];
    for(let i=0;i<n;i++){if(ad+cc-1>512){u++;ad=1}const o=show.winches[i]||{};ws.push({id:i+1,name:o.name||String(i+1),fixture:fx.id,universe:u,address:ad,invert:!!o.invert,min:o.min??0,max:o.max??100,home:o.home??0,enabled:o.enabled??true});ad+=cc}
    saveCfg({winches:ws,layout:{cols:+$('#pc').value}})};
  $('#obuild').onclick=async()=>{const pat=$('#opat').value.split(/[^0-9]+/).map(Number).filter(n=>n>0);if(!pat.length)return toast('Укажите число лебёдок на экран, например 2 или 2,3,2',true);
    const ws=show.winches,objs=[];let i=0,k=0;while(i<ws.length){const c=pat[k%pat.length];const mem=ws.slice(i,i+c).map(w=>w.id);if(mem.length<2&&pat.length===1&&c>1)break;objs.push({id:'o'+k+Date.now().toString(36),name:($('#oname').value||'Экран')+' '+(k+1),members:mem});i+=c;k++}
    if(!await ask(`Собрать ${objs.length} экранов? Текущие связи будут заменены.`))return;saveCfg({objects:objs}).then(r=>r.ok&&toast('Экранов: '+objs.length))};
  const byName=t=>{const w=show.winches.find(w=>w.name===t)||show.winches.find(w=>String(w.id)===t);return w?w.id:null};
  if($('#osave'))$('#osave').onclick=()=>{const objs=$$('#otab tbody tr').map(tr=>{const o=show.objects[+tr.dataset.i];return{...o,name:tr.querySelector('[data-f=name]').value,members:tr.querySelector('[data-f=members]').value.split(/[,;\s]+/).filter(Boolean).map(byName).filter(x=>x!=null)}});saveCfg({objects:objs}).then(r=>r.ok&&toast('Экраны сохранены'))};
  $$('#otab [data-a=del]').forEach(b=>b.onclick=()=>{const i=+b.closest('tr').dataset.i;saveCfg({objects:show.objects.filter((_,j)=>j!==i)})});
  $('#fexp').onclick=()=>{const o={...show};delete o._fixtures;const b=new Blob([JSON.stringify(o,null,1)],{type:'application/json'});const l=document.createElement('a');l.href=URL.createObjectURL(b);l.download='winch_show.json';l.click()};
  $('#fimp').onclick=()=>$('#ffile').click();
  $('#ffile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const r=await api('/api/show',JSON.parse(await f.text()));if(r.ok)toast('Шоу загружено')}catch(x){toast('Файл не читается',true)}};
  $('#freset').onclick=async()=>{if(await ask('Начать новое шоу? Пресеты, группы и шоу будут удалены (сделайте экспорт).'))api('/api/show',{})};
}

/* ---------- клавиши ---------- */
document.addEventListener('keydown',e=>{
  if(e.target.matches('input:not([type=range]):not([type=checkbox]),select,textarea'))return;
  if(tab==='lim'&&(e.code==='ArrowUp'||e.code==='ArrowDown')){e.preventDefault();if(!e.repeat)jogStart(e.code==='ArrowUp'?-1:1,e.shiftKey);return}
  if(e.code==='Space'){e.preventDefault();$('#stop').click()}
  else if(e.key==='Escape')setSel([]);
  else if((e.ctrlKey||e.metaKey)&&e.code==='KeyA'){e.preventDefault();setSel(show.winches.map(w=>w.id))}
  else if(e.code==='KeyG'&&!e.ctrlKey&&!e.metaKey)api('/api/seq/go');
  else if(e.code==='KeyT'&&tab==='tc'&&!e.ctrlKey&&!e.metaKey){$('#etc').value=fmtTC(st?.tc?.t??0,show.timecode.fps);$('#eadd').click()}
  else if(/^Digit[1-9]$/.test(e.code)&&!e.ctrlKey&&!e.metaKey){const p=show?.presets[+e.code.slice(5)-1];if(p)api('/api/preset/recall',{id:p.id})}
});
document.addEventListener('keyup',e=>{if(e.code==='ArrowUp'||e.code==='ArrowDown')jogStop()});
addEventListener('blur',()=>jogStop());
poll();
</script></body></html>'''

if __name__ == '__main__':
    main()
