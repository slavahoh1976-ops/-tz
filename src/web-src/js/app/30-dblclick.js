// 3.0.67: двойное нажатие на холстах — своё распознавание. Движок Safari/WebKit (Mac-версия) не присылает
// «dblclick», когда при нажатии указатель захвачен (setPointerCapture), — правка текста двойным нажатием не открывалась.
// Два нажатия мышью/пером подряд (≤ 450 мс, ≤ 8 px) → тот же «dblclick»; родной, если придёт следом, отбрасываем.
(() => {
  let prev = null, synthAt = 0, synthEl = null;
  document.addEventListener("pointerup", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLCanvasElement) || e.pointerType === "touch" || e.button !== 0) return;
    const now = performance.now();
    if (prev && prev.t === t && now - prev.at <= 450 && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) <= 8) {
      prev = null;
      synthAt = now;
      synthEl = t;
      t.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true, clientX: e.clientX, clientY: e.clientY, screenX: e.screenX, screenY: e.screenY, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, altKey: e.altKey, metaKey: e.metaKey, button: 0, detail: 2 }));
      return;
    }
    prev = { t, at: now, x: e.clientX, y: e.clientY };
  }, true);
  document.addEventListener("dblclick", (e) => {
    if (e.isTrusted && e.target === synthEl && performance.now() - synthAt < 700) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  }, true);
})();
