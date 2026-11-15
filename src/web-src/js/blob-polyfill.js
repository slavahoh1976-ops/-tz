
(function() {
  var BP = window.Blob && Blob.prototype;
  function readAs(blob, how) {
    return new Promise(function(res, rej) {
      var r = new FileReader();
      r.onload = function() {
        res(r.result);
      };
      r.onerror = function() {
        rej(r.error);
      };
      r[how](blob);
    });
  }
  if (BP && !BP.arrayBuffer) BP.arrayBuffer = function() {
    return readAs(this, "readAsArrayBuffer");
  };
  if (BP && !BP.text) BP.text = function() {
    return readAs(this, "readAsText");
  };
  if (!String.prototype.matchAll) String.prototype.matchAll = function(re) {
    var f = re.flags.indexOf("g") < 0 ? re.flags + "g" : re.flags, r = new RegExp(re.source, f), s = String(this), out = [], m;
    while (m = r.exec(s)) {
      out.push(m);
      if (m[0] === "") r.lastIndex++;
    }
    return out[Symbol.iterator]();
  };
  if (!window.ResizeObserver) window.ResizeObserver = function(cb) {
    var els = [], last = [];
    function check() {
      for (var i = 0; i < els.length; i++) {
        var r = els[i].getBoundingClientRect(), k = r.width + "x" + r.height;
        if (k !== last[i]) {
          last[i] = k;
          cb([]);
        }
      }
    }
    window.addEventListener("resize", check);
    setInterval(check, 250);
    this.observe = function(el) {
      els.push(el);
      last.push("");
      setTimeout(check, 0);
    };
    this.unobserve = function(el) {
      var i = els.indexOf(el);
      if (i >= 0) {
        els.splice(i, 1);
        last.splice(i, 1);
      }
    };
    this.disconnect = function() {
      els = [];
      last = [];
    };
  };
  if (window.matchMedia) {
    var mq = window.matchMedia("(min-width: 1px)");
    if (mq && !mq.addEventListener && mq.addListener) {
      var MP = Object.getPrototypeOf(mq);
      MP.addEventListener = function(t, fn) {
        if (t === "change") this.addListener(fn);
      };
      MP.removeEventListener = function(t, fn) {
        if (t === "change") this.removeListener(fn);
      };
    }
  }
  if (!window.PointerEvent) {
    let fire2 = function(target, type, src, pt, id, ptype) {
      var e = document.createEvent("Event");
      e.initEvent(type, type !== "pointerleave" && type !== "pointerenter", true);
      var props = {
        clientX: pt.clientX,
        clientY: pt.clientY,
        pageX: pt.pageX,
        pageY: pt.pageY,
        pointerId: id,
        pointerType: ptype,
        isPrimary: true,
        button: src.button || 0,
        buttons: src.buttons == null ? 1 : src.buttons,
        altKey: !!src.altKey,
        ctrlKey: !!src.ctrlKey,
        metaKey: !!src.metaKey,
        shiftKey: !!src.shiftKey
      };
      for (var k in props) Object.defineProperty(e, k, { value: props[k] });
      target.dispatchEvent(e);
      if (e.defaultPrevented && src.cancelable) src.preventDefault();
    }, touches2 = function(ev, type) {
      for (var i = 0; i < ev.changedTouches.length; i++) {
        var t = ev.changedTouches[i], id = 100 + t.identifier;
        if (type === "pointerdown") tmap[id] = ev.target;
        var tg = tmap[id] || ev.target;
        fire2(tg, type, ev, t, id, "touch");
        if (type === "pointerup" || type === "pointercancel") delete tmap[id];
      }
    };
    var fire = fire2, touches = touches2;
    var EP = Element.prototype;
    EP.setPointerCapture = function() {
    };
    EP.releasePointerCapture = function() {
    };
    EP.hasPointerCapture = function() {
      return false;
    };
    var cap = null;
    document.addEventListener("mousedown", function(ev) {
      cap = ev.target;
      fire2(ev.target, "pointerdown", ev, ev, 1, "mouse");
    }, true);
    document.addEventListener("mousemove", function(ev) {
      fire2(cap || ev.target, "pointermove", ev, ev, 1, "mouse");
    }, true);
    document.addEventListener("mouseup", function(ev) {
      var t = cap || ev.target;
      cap = null;
      fire2(t, "pointerup", ev, ev, 1, "mouse");
    }, true);
    document.addEventListener("mouseleave", function(ev) {
      if (!cap && ev.target && ev.target.dispatchEvent) fire2(ev.target, "pointerleave", ev, ev, 1, "mouse");
    }, true);
    var tmap = {};
    document.addEventListener("touchstart", function(ev) {
      touches2(ev, "pointerdown");
    }, { capture: true, passive: false });
    document.addEventListener("touchmove", function(ev) {
      touches2(ev, "pointermove");
    }, { capture: true, passive: false });
    document.addEventListener("touchend", function(ev) {
      touches2(ev, "pointerup");
    }, { capture: true, passive: false });
    document.addEventListener("touchcancel", function(ev) {
      touches2(ev, "pointercancel");
    }, { capture: true, passive: false });
  }
  try {
    var d = document.createElement("div");
    d.style.cssText = "display:flex;flex-direction:column;row-gap:1px;position:absolute;visibility:hidden";
    d.appendChild(document.createElement("div"));
    d.appendChild(document.createElement("div"));
    (document.body || document.documentElement).appendChild(d);
    if (d.scrollHeight !== 1) document.documentElement.className += " nogap";
    d.parentNode.removeChild(d);
  } catch (e) {
  }
  window.__showErr = function(msg) {
    try {
      var b = document.getElementById("__errbox");
      if (!b) {
        b = document.createElement("div");
        b.id = "__errbox";
        b.style.cssText = "position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;background:#5a1414;color:#fff;font:12px/1.4 Menlo,monospace;padding:10px 34px 10px 12px;border-radius:8px;white-space:pre-wrap;max-height:40vh;overflow:auto";
        var x = document.createElement("button");
        x.textContent = "×";
        x.style.cssText = "position:absolute;right:6px;top:4px;background:none;border:0;color:#fff;font-size:18px;cursor:pointer";
        x.onclick = function() {
          b.parentNode.removeChild(b);
        };
        b.appendChild(x);
        b.appendChild(document.createTextNode("Ошибка (пришлите снимок разработчикам): " + navigator.userAgent));
        (document.body || document.documentElement).appendChild(b);
      }
      b.appendChild(document.createTextNode("\n" + msg));
    } catch (e) {
    }
  };
})();
