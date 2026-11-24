const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

function webgl() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function whenNear(el, margin, load) {
  const io = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      load();
    },
    { rootMargin: margin },
  );
  io.observe(el);
}

function scene(selector, file, mount, { margin = "500px", reserve = false, when = true, args = [] } = {}) {
  const host = document.querySelector(selector);
  if (!host || !when || args.includes(null)) return;
  if (reserve) host.classList.add("is-eligible");
  whenNear(host, margin, () =>
    import(file)
      .then((module) => module[mount](host, ...args))
      .catch((err) => {
        host.classList.remove("is-eligible", "is-3d");
        console.warn(`[nyqo] ${mount} off`, err);
      }),
  );
}

if (!reducedMotion && webgl()) {
  scene("[data-world3d]", "./world.js?v=20261121", "mountWorld", {
    margin: "200px",
    reserve: true,
    when: CSS.supports("overflow", "clip") && matchMedia("(min-height: 560px)").matches,
  });
  scene("[data-crypto3d]", "./crypto.js?v=20261115", "mountCrypto", {
    margin: "600px",
    reserve: true,
    when: matchMedia("(min-width: 760px)").matches,
    args: [document.querySelector("[data-wire]")],
  });
  scene("[data-globe3d]", "./globe.js?v=20261115", "mountGlobe", { reserve: true });
  scene("[data-flash3d]", "./flash.js?v=20261115", "mountFlash", { reserve: true });
  scene("[data-download3d]", "./download.js?v=20261115", "mountDownload", { reserve: true });
}
