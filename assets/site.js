document.documentElement.classList.add("js");

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// The page only says which version of the demo fits the visitor's computer.
const DOWNLOADS = {
  windows: { meta: "Windows 10 and 11 · one-time €3, paid with PayPal" },
  macos: { meta: "The macOS demo is coming in a few days. The Windows demo is €3." },
  ios: { meta: "NYQO for iPhone is in the works. The desktop demo is €3." },
  android: { meta: "NYQO for Android is in the works. The desktop demo is €3." },
  linux: { meta: "No Linux build yet. The Windows demo is €3." },
};

function detectOS() {
  const forced = new URLSearchParams(location.search).get("os");
  if (forced && forced in DOWNLOADS) return forced;
  const ua = navigator.userAgent.toLowerCase();
  const platform = (navigator.userAgentData?.platform || navigator.platform || "").toLowerCase();
  if (ua.includes("android")) return "android";
  if (/iphone|ipad|ipod/.test(ua) || (platform.includes("mac") && navigator.maxTouchPoints > 1)) return "ios";
  if (platform.includes("win") || ua.includes("windows")) return "windows";
  if (platform.includes("mac") || ua.includes("mac os")) return "macos";
  if (platform.includes("linux") || ua.includes("linux") || ua.includes("cros")) return "linux";
  return null;
}

function setupDownloads() {
  const os = detectOS();
  const target = os ? DOWNLOADS[os] : null;
  if (!target) return;
  const hero = document.querySelector(".hero [data-download-meta]");
  if (hero) hero.textContent = target.meta;
  document.querySelector(`[data-platform="${os}"]`)?.classList.add("is-current");
}

function setupHeader() {
  const header = document.querySelector("[data-header]");
  if (!header) return;
  const update = () => header.classList.toggle("is-scrolled", scrollY > 8);
  update();
  addEventListener("scroll", update, { passive: true });
}

// The displacement map of a plate: red pushes what is behind it sideways, blue up and down, and
// mid grey leaves it alone. Only the rim bends, the deeper in the less.
function lensMap(w, h, depth) {
  const ramp = (size, colour) =>
    [[0, 255], [(depth * 0.4) / size, 172], [depth / size, 128], [1 - depth / size, 128], [1 - (depth * 0.4) / size, 84], [1, 0]]
      .map(([at, value]) => `<stop offset='${at}' stop-color='${colour(value)}'/>`)
      .join("");
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>` +
    `<linearGradient id='x'>${ramp(w, (value) => `rgb(${value},0,0)`)}</linearGradient>` +
    `<linearGradient id='y' x2='0' y2='1'>${ramp(h, (value) => `rgb(0,0,${value})`)}</linearGradient>` +
    `<rect width='${w}' height='${h}' fill='url(#x)'/>` +
    `<rect width='${w}' height='${h}' fill='url(#y)' style='mix-blend-mode:screen'/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// Liquid glass: the glint on a plate follows the pointer, and in Chromium its rim bends what lies
// behind it. Safari and Firefox accept an SVG filter on a backdrop but draw nothing, so there the
// plates stay with the blur from the stylesheet.
function setupGlass() {
  const GLASS = ".site-header .wrap, .btn-secondary";
  const hosts = [...document.querySelectorAll(GLASS)];
  if (!hosts.length) return;
  const plateOf = (host) => getComputedStyle(host, "::before");

  if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
    addEventListener(
      "pointermove",
      (event) => {
        const host = event.target.closest?.(GLASS);
        if (!host) return;
        const box = host.getBoundingClientRect();
        const plate = plateOf(host);
        host.style.setProperty("--glint-x", `${event.clientX - box.left - host.clientLeft - parseFloat(plate.left)}px`);
        host.style.setProperty("--glint-y", `${event.clientY - box.top - host.clientTop - parseFloat(plate.top)}px`);
      },
      { passive: true },
    );
  }

  if (!navigator.userAgentData || navigator.userAgentData.mobile) return;
  const NS = "http://www.w3.org/2000/svg";
  const make = (name, attributes, parent) => {
    const node = parent.appendChild(document.createElementNS(NS, name));
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    return node;
  };
  const defs = make("svg", { width: 0, height: 0, "aria-hidden": "true" }, document.body);
  defs.style.position = "absolute";
  const lenses = new Map();
  const fit = (host) => {
    const plate = plateOf(host);
    const w = Math.round(parseFloat(plate.width));
    const h = Math.round(parseFloat(plate.height));
    if (!w || !h || plate.backdropFilter === "none") return;
    if (!lenses.has(host)) {
      const filter = make("filter", { id: `lens-${lenses.size}`, x: "0%", y: "0%", width: "100%", height: "100%", "color-interpolation-filters": "sRGB" }, defs);
      const image = make("feImage", { x: 0, y: 0, result: "map" }, filter);
      const bend = make("feDisplacementMap", { in: "SourceGraphic", in2: "map", xChannelSelector: "R", yChannelSelector: "B" }, filter);
      lenses.set(host, { image, bend });
      host.style.setProperty("--lens", `url(#${filter.id})`);
    }
    const lens = lenses.get(host);
    if (lens.w === w && lens.h === h) return;
    const depth = Math.max(6, Math.min(parseFloat(plate.borderTopLeftRadius) || 0, h / 2, 16));
    const { image, bend } = Object.assign(lens, { w, h });
    image.setAttribute("width", w);
    image.setAttribute("height", h);
    image.setAttribute("href", lensMap(w, h, depth));
    bend.setAttribute("scale", depth * 2.4);
  };
  const observer = new ResizeObserver((entries) => entries.forEach((entry) => fit(entry.target)));
  // Fitted right away as well: a page opened in the background is not observed until it is shown.
  hosts.forEach((host) => {
    fit(host);
    observer.observe(host);
  });
  document.documentElement.classList.add("has-lens");
}

function setupReveal() {
  const reveal = (el) => el.classList.add(el.classList.contains("fan") ? "is-open" : "is-in");
  const items = [...document.querySelectorAll("[data-wipe], [data-fan] .fan")];
  if (reducedMotion || !("IntersectionObserver" in window)) {
    items.forEach(reveal);
    document.querySelectorAll("[data-reveal]").forEach((el) => el.removeAttribute("data-reveal"));
    return;
  }
  const targets = new Map();
  const watch = (watched, el) => targets.set(watched, [...(targets.get(watched) ?? []), el]);
  // A clipped heading never counts as intersecting, so its parent is watched instead.
  for (const el of items) watch(el.hasAttribute("data-wipe") ? el.parentElement : el, el);
  for (const el of document.querySelectorAll("[data-reveal]")) watch(el, el);
  for (const group of document.querySelectorAll("[data-stagger]")) {
    [...group.children].forEach((child, i) => {
      child.setAttribute("data-reveal", "");
      child.style.setProperty("--d", `${i * 0.07}s`);
      watch(group, child);
    });
  }
  // Once it has arrived, an element gets its own transitions back (hover states and the like).
  const settle = (el) => {
    el.removeAttribute("data-reveal");
    el.classList.remove("is-in");
    el.style.removeProperty("--d");
  };
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        targets.get(entry.target).forEach((el, i) => {
          reveal(el);
          if (el.hasAttribute("data-reveal")) setTimeout(settle, 1000 + i * 70, el);
        });
        io.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
  );
  targets.forEach((_, watched) => io.observe(watched));
}

/** Marks the nav link of the section that is on screen. */
function setupScrollSpy() {
  const links = new Map(
    [...document.querySelectorAll('.nav a[href^="#"]')].map((link) => [link.getAttribute("href").slice(1), link]),
  );
  const sections = [...links.keys()].map((id) => document.getElementById(id)).filter(Boolean);
  if (!sections.length || !("IntersectionObserver" in window)) return;
  const visible = new Set();
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) visible[entry.isIntersecting ? "add" : "delete"](entry.target);
      const current = sections.find((section) => visible.has(section));
      for (const [id, link] of links) {
        const active = current?.id === id;
        link.classList.toggle("is-active", active);
        if (active) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      }
    },
    { rootMargin: "-45% 0px -50% 0px" },
  );
  sections.forEach((section) => io.observe(section));
}

/** Runs `tick` only while `el` is on screen, so nothing animates off-screen. */
function whileVisible(el, start, stop) {
  if (!el) return;
  let running = false;
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !running) {
      running = true;
      start();
    } else if (!entry.isIntersecting && running) {
      running = false;
      stop();
    }
  }).observe(el);
}

const GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789+/=";
const randomCipher = (length) => Array.from({ length }, () => GLYPHS[(Math.random() * GLYPHS.length) | 0]).join("");

/** Turns ciphertext into the real text letter by letter, like a message being unlocked. */
function decrypt(el, text, duration = 700) {
  return new Promise((resolve) => {
    if (reducedMotion) {
      el.textContent = text;
      el.classList.remove("cipher");
      resolve();
      return;
    }
    el.classList.add("cipher");
    const chars = [...text];
    const started = performance.now();
    const frame = (now) => {
      const progress = Math.min(1, (now - started) / duration);
      const solved = Math.floor(chars.length * progress);
      el.textContent = chars.slice(0, solved).join("") + randomCipher(Math.max(0, chars.length - solved));
      if (progress > 0.35) el.classList.remove("cipher");
      if (progress < 1) requestAnimationFrame(frame);
      else {
        el.textContent = text;
        resolve();
      }
    };
    requestAnimationFrame(frame);
  });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function setupHeroTilt() {
  const stage = document.querySelector("[data-stage-tilt]");
  const app = document.querySelector("[data-app]");
  if (!stage || !app || reducedMotion) return;
  let queued = false;
  const update = () => {
    queued = false;
    const rect = app.getBoundingClientRect();
    const progress = Math.min(1, Math.max(0, (innerHeight - rect.top) / (innerHeight * 0.75)));
    stage.style.setProperty("--tilt", String(1 - progress));
  };
  update();
  addEventListener(
    "scroll",
    () => {
      if (!queued) {
        queued = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );

  if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  const aim = { x: 0, y: 0 };
  const now = { x: 0, y: 0 };
  let leaning = false;
  const lean = () => {
    now.x += (aim.x - now.x) * 0.08;
    now.y += (aim.y - now.y) * 0.08;
    stage.style.setProperty("--px", now.x.toFixed(4));
    stage.style.setProperty("--py", now.y.toFixed(4));
    leaning = Math.abs(aim.x - now.x) + Math.abs(aim.y - now.y) > 0.002;
    if (leaning) requestAnimationFrame(lean);
  };
  const point = (x, y) => {
    aim.x = x;
    aim.y = y;
    if (!leaning) {
      leaning = true;
      requestAnimationFrame(lean);
    }
  };
  stage.addEventListener("pointermove", (event) => {
    const rect = app.getBoundingClientRect();
    point(((event.clientX - rect.left) / rect.width) * 2 - 1, ((event.clientY - rect.top) / rect.height) * 2 - 1);
  });
  stage.addEventListener("pointerleave", () => point(0, 0));
}

function setupHeroChat() {
  const log = document.querySelector("[data-log]");
  const typing = document.querySelector("[data-typing]");
  const typingWho = document.querySelector("[data-typing-who]");
  if (!log || reducedMotion) return;

  const original = [...log.children].map((el) => el.cloneNode(true));
  const extra = [
    { who: "Mara", color: "#9b7bff", text: "Lobby's up, details in #lfg. Starting on the new map 🔥", typing: "Mara is typing…" },
    { who: "Fynn", color: "#ff9b45", text: "Perfect. See you at 7!", typing: "Fynn is typing…", sunset: true },
  ];
  let generation = 0;

  const build = (m) => {
    const el = document.createElement("div");
    el.className = "msg msg-in";
    el.style.setProperty("--who", m.color);
    const av = document.createElement("span");
    av.className = "av lg";
    av.style.setProperty("--c", m.color);
    av.textContent = m.who[0];
    const who = document.createElement("div");
    who.className = "who";
    const name = document.createElement("span");
    name.textContent = m.who;
    if (m.sunset) name.className = "name-sunset";
    const time = document.createElement("time");
    time.textContent = "18:5" + (6 + extra.indexOf(m));
    who.append(name, time);
    const body = document.createElement("div");
    body.className = "body";
    el.append(av, who, body);
    return { el, body };
  };

  const run = async (gen) => {
    while (gen === generation) {
      log.replaceChildren();
      for (const tpl of original) {
        if (gen !== generation) return;
        const el = tpl.cloneNode(true);
        const body = el.querySelector(".body");
        const text = body.textContent;
        body.textContent = "";
        el.classList.add("msg-in");
        log.append(el);
        await decrypt(body, text, 520);
        await wait(380);
      }
      for (const m of extra) {
        if (gen !== generation) return;
        typingWho.textContent = m.typing;
        typing.classList.add("is-on");
        await wait(1500);
        typing.classList.remove("is-on");
        const { el, body } = build(m);
        log.append(el);
        while (log.children.length > 6) log.firstElementChild.remove();
        await decrypt(body, m.text, 650);
        await wait(900);
      }
      await wait(3200);
    }
  };

  whileVisible(
    log,
    () => run(++generation),
    () => {
      generation++;
      typing.classList.remove("is-on");
    },
  );
}

function setupTabs() {
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  if (!tabs.length) return;
  const select = (tab, focus) => {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(t.getAttribute("aria-controls"));
      panel.hidden = !on;
      if (on) {
        panel.classList.remove("is-entering");
        void panel.offsetWidth;
        panel.classList.add("is-entering");
      }
    }
    document.querySelector("[data-inside-stage]")?.style.setProperty("--band", tab.style.getPropertyValue("--c"));
    if (focus) tab.focus();
    tab.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reducedMotion ? "auto" : "smooth" });
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => select(tab, false));
    tab.addEventListener("keydown", (e) => {
      const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (next === undefined) return;
      e.preventDefault();
      select(tabs[(next + tabs.length) % tabs.length], true);
    });
  });
}

function setupVoiceDemo() {
  const users = [...document.querySelectorAll("[data-speaker]")];
  if (!users.length || reducedMotion) return;
  let timer = null;
  let current = 0;
  const show = () => {
    users.forEach((u, i) => {
      const on = i === current;
      u.querySelector(".av").classList.toggle("speaking", on);
      u.querySelector(".meter").hidden = !on;
    });
    current = (current + 1) % users.length;
  };
  whileVisible(
    users[0].closest(".fdemo"),
    () => {
      show();
      timer = setInterval(show, 1800);
    },
    () => clearInterval(timer),
  );
}

function setupUploadDemo() {
  const card = document.querySelector("[data-upload]");
  if (!card) return;
  const label = card.querySelector("[data-upload-label]");
  const bar = card.querySelector(".bar i");
  const total = 4.2;
  let timer = null;
  let progress = 0;
  const render = () => {
    const sent = ((total * progress) / 100).toFixed(1);
    card.classList.toggle("done", progress >= 100);
    label.textContent = progress >= 100 ? `${total} GB · sent` : `Encrypting & sending · ${sent} of ${total} GB`;
    bar.style.setProperty("--p", `${progress}%`);
  };
  if (reducedMotion) {
    progress = 64;
    render();
    return;
  }
  let pause = 0;
  const step = () => {
    if (progress >= 100) {
      if (++pause < 18) return;
      pause = 0;
      progress = 0;
    } else {
      progress = Math.min(100, progress + 1.6 + Math.random() * 2.4);
    }
    render();
  };
  whileVisible(
    card,
    () => (timer = setInterval(step, 120)),
    () => clearInterval(timer),
  );
}

function setupWave() {
  const wave = document.querySelector("[data-wave]");
  if (!wave) return;
  const icon = document.querySelector("[data-play-icon] use");
  const time = document.querySelector("[data-wave-time]");
  const bars = Array.from({ length: 40 }, (_, i) => {
    const bar = document.createElement("i");
    const h = 0.22 + 0.78 * Math.abs(Math.sin(i * 0.7) * Math.cos(i * 0.23));
    bar.style.setProperty("--h", `${Math.round(h * 100)}%`);
    wave.append(bar);
    return bar;
  });
  if (reducedMotion) return;
  let timer = null;
  let pos = 0;
  const step = () => {
    pos = (pos + 1) % (bars.length + 12);
    bars.forEach((b, i) => b.classList.toggle("on", i < pos));
    const playing = pos > 0 && pos <= bars.length;
    icon.setAttribute("href", playing ? "#i-pause" : "#i-play");
    const seconds = Math.round((23 * Math.min(pos, bars.length)) / bars.length);
    time.textContent = playing ? `0:${String(seconds).padStart(2, "0")}` : "0:23";
  };
  whileVisible(
    wave,
    () => (timer = setInterval(step, 140)),
    () => clearInterval(timer),
  );
}

function setupWire() {
  const wire = document.querySelector("[data-wire]");
  if (!wire) return;
  const plain = wire.querySelector("[data-wire-plain]");
  const out = wire.querySelector("[data-wire-out]");
  const stream = wire.querySelector("[data-stream]");
  const packet = wire.querySelector("[data-packet]");
  const lines = [
    "Match moved to 8. Don't forget your headset!",
    "Who's hosting the lobby tonight?",
    "New clip, watch when you can 🎮",
  ];
  let gen = 0;
  const fillStream = () => {
    stream.textContent = Array.from({ length: 9 }, () => randomCipher(46)).join(" ");
  };
  fillStream();
  if (reducedMotion) {
    out.classList.remove("cipher");
    return;
  }
  let streamTimer = null;
  const run = async (g) => {
    let i = 0;
    while (g === gen) {
      const text = lines[i++ % lines.length];
      out.textContent = randomCipher(text.length);
      out.classList.add("cipher");
      plain.textContent = "";
      for (const ch of text) {
        if (g !== gen) return;
        plain.textContent += ch;
        await wait(28);
      }
      await wait(250);
      wire.dispatchEvent(new CustomEvent("wire:send", { detail: { text } }));
      packet.classList.remove("go");
      void packet.offsetWidth;
      packet.classList.add("go");
      await wait(1400);
      await decrypt(out, text, 800);
      await wait(2600);
    }
  };
  whileVisible(
    wire,
    () => {
      run(++gen);
      streamTimer = setInterval(() => {
        const rows = stream.textContent.split(" ");
        rows.shift();
        rows.push(randomCipher(46));
        stream.textContent = rows.join(" ");
      }, 260);
    },
    () => {
      gen++;
      clearInterval(streamTimer);
    },
  );
}

function setupTranslation() {
  const messages = [...document.querySelectorAll("[data-tmsg]")];
  const langs = [...document.querySelectorAll("[data-langs] span")];
  for (const msg of messages) {
    const text = msg.querySelector(".text");
    const note = msg.querySelector(".tnote span");
    const button = msg.querySelector("button");
    let showingOriginal = false;
    const render = () => {
      text.classList.add("swap");
      setTimeout(
        () => {
          text.textContent = showingOriginal ? msg.dataset.original : msg.dataset.translated;
          text.lang = showingOriginal ? { Spanish: "es", Japanese: "ja", German: "de" }[msg.dataset.from] : "en";
          note.textContent = showingOriginal ? `Original in ${msg.dataset.from}` : `Translated from ${msg.dataset.from}`;
          button.textContent = showingOriginal ? "Show translation" : "Show original";
          text.classList.remove("swap");
        },
        reducedMotion ? 0 : 220,
      );
    };
    msg.toggle = () => {
      showingOriginal = !showingOriginal;
      render();
    };
    button.addEventListener("click", () => {
      msg.pinned = true;
      msg.toggle();
    });
  }
  if (reducedMotion || !messages.length) return;
  let timer = null;
  let turn = 0;
  const step = () => {
    const msg = messages[turn % messages.length];
    if (!msg.pinned) msg.toggle();
    langs.forEach((l) => l.classList.remove("is-lit"));
    const lit = [langs[(turn * 5) % langs.length], langs[(turn * 5 + 3) % langs.length]].filter(Boolean);
    lit.forEach((l) => l.classList.add("is-lit"));
    // The globe next to the chat lights up the same languages.
    document.dispatchEvent(
      new CustomEvent("translate:pulse", { detail: { from: msg.dataset.from, lit: lit.map((l) => l.textContent) } }),
    );
    turn++;
  };
  whileVisible(
    messages[0].parentElement,
    () => (timer = setInterval(step, 1600)),
    () => clearInterval(timer),
  );
}

/** The hero's second line arrives as ciphertext and decrypts, the same way messages do in NYQO. */
/** Buy page: orders the demo from the NYQO server and shows what happens next. */
function setupShop() {
  const forms = [...document.querySelectorAll("[data-order]")];
  const api = document.querySelector('meta[name="nyqo-api"]')?.content;
  if (forms.length === 0 || !api) return;
  const post = (path, body) =>
    fetch(`${api}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw Object.assign(new Error(data.error ?? "failed"), { code: data.error });
      return data;
    });

  fetch(`${api}/shop/info`)
    .then((r) => r.json())
    .then((info) => {
      for (const el of document.querySelectorAll("[data-shop-test]")) el.hidden = info.mode !== "test";
      for (const el of document.querySelectorAll("[data-card-option]")) el.hidden = !info.card;
    })
    .catch(() => undefined);

  const show = (form, selector) => {
    const section = form.closest("section");
    form.hidden = true;
    const panel = section.querySelector(selector);
    panel.hidden = false;
    panel.scrollIntoView({ block: "center", behavior: reducedMotion ? "auto" : "smooth" });
    return panel;
  };
  const fail = (form, text) => {
    const error = form.querySelector("[data-order-error]");
    error.textContent = text;
    error.hidden = false;
    error.scrollIntoView({ block: "center" });
  };

  for (const form of forms) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const method = e.submitter?.value === "card" ? "card" : "paypal";
      const buttons = [...form.querySelectorAll("button[type=submit]")];
      form.querySelector("[data-order-error]").hidden = true;
      buttons.forEach((b) => (b.disabled = true));
      try {
        const data = await post("/shop/orders", {
          email: form.email.value,
          language: form.dataset.lang,
          method,
          acceptRisk: form.risk.checked,
          acceptWithdrawal: form.withdrawal.checked,
        });
        // Card: off to Stripe's payment page; the buyer comes back with a session id.
        if (data.checkoutUrl) return location.assign(data.checkoutUrl);
        const done = show(form, "[data-order-done]");
        done.querySelector("[data-order-ref]").textContent = data.reference;
        done.querySelector("[data-order-test]").hidden = data.mode !== "test";
        const pay = done.querySelector("[data-order-pay]");
        pay.hidden = !data.paypalUrl;
        if (data.paypalUrl) done.querySelector("[data-order-paypal]").href = data.paypalUrl;
      } catch (err) {
        fail(form, err.code === "too_many_open_orders" ? form.dataset.tooMany : err.code === "too_many_requests" ? form.dataset.slow : form.dataset.fail);
      } finally {
        buttons.forEach((b) => (b.disabled = false));
      }
    });
  }

  // Coming back from Stripe.
  const params = new URLSearchParams(location.search);
  const form = forms.find((f) => !f.closest("section")?.hidden) ?? forms[0];
  if (params.has("cancelled")) fail(form, form.dataset.cancelled);
  const sessionId = params.get("session_id");
  if (sessionId) {
    const hint = form.querySelector("[data-order-error]");
    post("/shop/card/confirm", { sessionId })
      .then((result) => {
        if (!result.paid) return fail(form, form.dataset.unpaid);
        const panel = show(form, "[data-order-paid]");
        panel.querySelector("[data-paid-email]").textContent = result.email;
        panel.querySelector("[data-paid-ref]").textContent = result.reference;
        if (result.receiptNumber) {
          panel.querySelector("[data-paid-receipt-number]").textContent = result.receiptNumber;
          panel.querySelector("[data-paid-receipt]").hidden = false;
        }
      })
      .catch(() => fail(form, form.dataset.unpaid));
    hint.textContent = form.dataset.checking;
    hint.hidden = false;
  }
}

/** Pages with an English and a German version show one at a time, German first for German browsers. */
function setupLanguages() {
  const nav = document.querySelector("[data-lang-switch]");
  const sections = [...document.querySelectorAll("[data-lang-section]")];
  if (!nav || sections.length < 2) return;
  const links = [...nav.querySelectorAll("a")];
  // Text outside the sections carries its German version in data-de.
  const shared = [...document.querySelectorAll("[data-de]")].map((el) => [el, el.textContent, el.dataset.de]);
  const show = (lang) => {
    for (const section of sections) section.hidden = section.id !== lang;
    for (const [el, en, de] of shared) el.textContent = lang === "de" ? de : en;
    document.documentElement.lang = lang;
    for (const link of links) link.setAttribute("aria-current", String(link.hash === `#${lang}`));
  };
  for (const link of links) {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      show(link.hash.slice(1));
    });
  }
  const wanted = location.hash.slice(1);
  show(sections.some((x) => x.id === wanted) ? wanted : navigator.language?.toLowerCase().startsWith("de") ? "de" : "en");
}

/** Two rows of squad tiles slide in opposite directions with the scroll; the tile in the middle takes focus like in the app. */
function setupWall() {
  const section = document.querySelector("[data-wall-section]");
  if (!section) return;
  const rows = [...section.querySelectorAll("[data-wall]")];
  const tiles = [...section.querySelectorAll(".wtile")];
  let queued = false;
  let focused = null;
  const update = () => {
    queued = false;
    const rect = section.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > innerHeight) return;
    const progress = (innerHeight - rect.top) / (innerHeight + rect.height);
    const travel = Math.min(900, innerWidth * 0.7);
    if (!reducedMotion) {
      for (const row of rows) {
        const dir = Number(row.dataset.wall);
        row.style.setProperty("--x", `${(dir * (progress - 0.5) * travel).toFixed(1)}px`);
      }
    }
    const mid = innerWidth / 2;
    let best = null;
    let bestDist = Infinity;
    for (const tile of tiles) {
      const r = tile.getBoundingClientRect();
      const dist = Math.abs(r.left + r.width / 2 - mid) + Math.abs(r.top + r.height / 2 - innerHeight / 2) * 0.6;
      if (dist < bestDist) {
        bestDist = dist;
        best = tile;
      }
    }
    if (best !== focused) {
      focused?.classList.remove("is-focused");
      best?.classList.add("is-focused");
      focused = best;
    }
  };
  update();
  const schedule = () => {
    if (!queued) {
      queued = true;
      requestAnimationFrame(update);
    }
  };
  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", schedule);
}

setupWall();
setupDownloads();
setupShop();
setupLanguages();
setupHeader();
setupGlass();
setupReveal();
setupScrollSpy();
setupHeroTilt();
setupHeroChat();
setupTabs();
setupVoiceDemo();
setupUploadDemo();
setupWave();
setupWire();
setupTranslation();
