(() => {
  const frames = Array.from(document.querySelectorAll("[data-deferred-src]"));
  if (!frames.length) return;

  const load = () => frames.forEach(frame => {
    frame.src = frame.dataset.deferredSrc;
    frame.removeAttribute("data-deferred-src");
  });

  if ("requestIdleCallback" in window) window.requestIdleCallback(load, { timeout: 450 });
  else window.setTimeout(load, 180);
})();
