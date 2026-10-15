/* ChARM Dental & Aesthetic — interazioni del sito.
   Nessuna dipendenza esterna. Ogni modulo è indipendente e si attiva solo
   se trova i suoi elementi nella pagina. */
(() => {
  "use strict";

  const root = document.documentElement;
  root.classList.remove("no-js");
  root.classList.add("js");

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const store = {
    get(key) { try { return window.localStorage.getItem(key); } catch (e) { return null; } },
    set(key, value) { try { window.localStorage.setItem(key, value); } catch (e) { /* storage non disponibile */ } },
  };
  let siteData = {};
  try { siteData = JSON.parse(($("#site-data") || {}).textContent || "{}"); } catch (e) { siteData = {}; }
  const MODE = root.dataset.mode || siteData.mode || "production";

  /* ---------- Header ---------- */
  const header = $(".site-header");
  const scrollTasks = [];
  const onScroll = () => {
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 24);
    scrollTasks.forEach((fn) => fn());
  };
  let ticking = false;
  window.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { onScroll(); ticking = false; });
  }, { passive: true });

  /* ---------- Menu mobile ---------- */
  const toggle = $(".menu-toggle");
  const menu = $("#mobile-menu");
  if (toggle && menu) {
    const outside = $$("main, .site-footer, .skip-link");
    const label = toggle.querySelector(".sr-only");
    const focusables = () => [toggle, ...$$("a, button", menu)];
    const setMenu = (open) => {
      document.body.classList.toggle("menu-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      if (label) label.textContent = open ? "Chiudi il menu" : "Apri il menu";
      menu.setAttribute("aria-hidden", String(!open));
      menu.inert = !open;
      outside.forEach((el) => { el.inert = open; });
      if (open) setTimeout(() => { const first = $("a", menu); if (first) first.focus({ preventScroll: true }); }, 250);
    };
    menu.inert = true;
    toggle.addEventListener("click", () => setMenu(toggle.getAttribute("aria-expanded") !== "true"));
    menu.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
    document.addEventListener("keydown", (e) => {
      if (toggle.getAttribute("aria-expanded") !== "true") return;
      if (e.key === "Escape") { setMenu(false); toggle.focus(); }
      if (e.key === "Tab") {
        const list = focusables();
        const i = list.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); list[list.length - 1].focus(); }
        else if (!e.shiftKey && i === list.length - 1) { e.preventDefault(); list[0].focus(); }
      }
    });
    window.matchMedia("(min-width: 1040px)").addEventListener("change", (mq) => { if (mq.matches) setMenu(false); });
  }

  /* ---------- Rivelazioni allo scroll ---------- */
  const revealables = $$("[data-reveal]");
  if (revealables.length && "IntersectionObserver" in window && !reduceMotion.matches) {
    const vh = window.innerHeight;
    const pending = revealables.filter((el) => el.getBoundingClientRect().top > vh * 0.9);
    pending.forEach((el) => {
      el.classList.add("reveal-pending");
      const parent = el.parentElement;
      if (parent && parent.hasAttribute("data-stagger")) {
        const index = Array.from(parent.children).indexOf(el);
        el.style.setProperty("--delay", `${Math.min(index, 6) * 110}ms`);
      }
    });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.06 });
    pending.forEach((el) => io.observe(el));
  }

  /* ---------- Immagini: dissolvenza al caricamento ---------- */
  $$(".media > img, .media > picture > img").forEach((img) => {
    const box = img.closest(".media");
    const done = () => box.classList.add("is-loaded");
    if (img.complete && img.naturalWidth) done(); else img.addEventListener("load", done, { once: true });
  });

  /* ---------- Hero: profondità al movimento del puntatore ---------- */
  const arches = $(".hero-arches");
  if (arches && finePointer.matches && !reduceMotion.matches) {
    $$("[data-depth]", arches).forEach((el) => el.style.setProperty("--d", el.dataset.depth));
    const hero = arches.closest(".hero") || arches;
    hero.addEventListener("pointermove", (e) => {
      const r = hero.getBoundingClientRect();
      arches.style.setProperty("--px", (((e.clientX - r.left) / r.width) - 0.5) * 2);
      arches.style.setProperty("--py", (((e.clientY - r.top) / r.height) - 0.5) * 2);
    });
    hero.addEventListener("pointerleave", () => { arches.style.setProperty("--px", 0); arches.style.setProperty("--py", 0); });
  }

  /* ---------- Parallasse leggera (solo desktop) ---------- */
  const parallax = $$("[data-parallax]");
  if (parallax.length && finePointer.matches && !reduceMotion.matches && window.innerWidth >= 960) {
    const run = () => {
      const vh = window.innerHeight;
      parallax.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom < -100 || r.top > vh + 100) return;
        const speed = parseFloat(el.dataset.parallax) || 0.08;
        const offset = (r.top + r.height / 2 - vh / 2) * speed;
        el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0) scale(1.08)`;
      });
    };
    scrollTasks.push(run);
    run();
  }

  /* ---------- Prima / dopo ---------- */
  $$(".ba").forEach((ba) => {
    const range = $(".ba__range", ba);
    if (!range) return;
    const update = () => ba.style.setProperty("--pos", `${range.value}%`);
    const fromPointer = (e) => {
      const r = ba.getBoundingClientRect();
      range.value = String(Math.round(clamp(((e.clientX - r.left) / r.width) * 100, 0, 100)));
      update();
    };
    let dragging = false;
    range.addEventListener("input", update);
    range.addEventListener("pointerdown", (e) => { dragging = true; fromPointer(e); });
    window.addEventListener("pointermove", (e) => { if (dragging) fromPointer(e); });
    window.addEventListener("pointerup", () => { dragging = false; });
    update();
  });

  /* ---------- Filtri risultati ---------- */
  const filterBar = $("[data-filters]");
  if (filterBar) {
    const chips = $$(".chip", filterBar);
    const cases = $$("[data-case]");
    const status = $("#filter-status");
    chips.forEach((chip) => chip.addEventListener("click", () => {
      const value = chip.dataset.filter;
      chips.forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
      let shown = 0;
      cases.forEach((c) => {
        const match = value === "all" || c.dataset.case === value;
        c.hidden = !match;
        if (match) shown += 1;
      });
      if (status) status.textContent = `${shown} ${shown === 1 ? "caso visualizzato" : "casi visualizzati"}`;
    }));
  }

  /* ---------- Galleria ambienti ---------- */
  $$("[data-rail]").forEach((wrap) => {
    const rail = $(".rail", wrap);
    const prev = $(".icon-btn--prev", wrap);
    const next = $(".icon-btn--next", wrap);
    const bar = $(".rail-progress span", wrap);
    if (!rail) return;
    const step = () => {
      const item = rail.querySelector("li");
      return item ? item.getBoundingClientRect().width + parseFloat(getComputedStyle(rail).columnGap || 24) : rail.clientWidth * 0.8;
    };
    const sync = () => {
      const max = rail.scrollWidth - rail.clientWidth;
      const p = max > 0 ? rail.scrollLeft / max : 1;
      if (bar) bar.style.setProperty("--p", (0.18 + p * 0.82).toFixed(3));
      if (prev) prev.disabled = rail.scrollLeft <= 4;
      if (next) next.disabled = rail.scrollLeft >= max - 4;
    };
    const behavior = reduceMotion.matches ? "auto" : "smooth";
    if (prev) prev.addEventListener("click", () => rail.scrollBy({ left: -step(), behavior }));
    if (next) next.addEventListener("click", () => rail.scrollBy({ left: step(), behavior }));
    rail.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    sync();
  });

  /* ---------- Percorso: linea di avanzamento ---------- */
  const journey = $(".journey__list");
  if (journey) {
    const run = () => {
      const r = journey.getBoundingClientRect();
      const vh = window.innerHeight;
      const progress = clamp((vh * 0.85 - r.top) / (r.height + vh * 0.25), 0, 1);
      journey.style.setProperty("--progress", reduceMotion.matches ? 1 : progress.toFixed(3));
    };
    scrollTasks.push(run);
    run();
  }

  /* ---------- Orari: stato aperto/chiuso (ora di Tirana) ---------- */
  const hours = siteData.hours;
  if (Array.isArray(hours) && hours.length === 7) {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const daysIt = ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"];
    let parts = {};
    try {
      new Intl.DateTimeFormat("en-GB", { timeZone: siteData.timezone || "Europe/Tirane", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
        .formatToParts(new Date()).forEach((p) => { parts[p.type] = p.value; });
    } catch (e) { parts = {}; }
    const today = days.indexOf(parts.weekday);
    if (today >= 0) {
      const now = parseInt(parts.hour, 10) * 60 + parseInt(parts.minute, 10);
      const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
      $$("[data-hours] tr").forEach((tr, i) => tr.classList.toggle("is-today", i === today));
      const slot = hours[today];
      let text = "";
      let open = false;
      if (slot && now >= toMin(slot[0]) && now < toMin(slot[1])) {
        open = true;
        text = `Aperto ora · chiude alle ${slot[1]}`;
      } else {
        for (let k = 0; k < 8; k += 1) {
          const d = (today + k) % 7;
          const s = hours[d];
          if (!s) continue;
          if (k === 0 && now >= toMin(s[0])) continue;
          text = k === 0 ? `Chiuso · apre alle ${s[0]}` : k === 1 ? `Chiuso · apre domani alle ${s[0]}` : `Chiuso · apre ${daysIt[d]} alle ${s[0]}`;
          break;
        }
      }
      $$("[data-open-status]").forEach((el) => {
        el.hidden = false;
        el.classList.toggle("is-open", open);
        el.textContent = `${text} (ora di Tirana)`;
      });
    }
  }

  /* ---------- Copia negli appunti ---------- */
  $$("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const value = btn.dataset.copy;
      const label = btn.querySelector("span") || btn;
      const original = label.textContent;
      const done = (msg) => {
        btn.classList.add("is-done");
        label.textContent = msg;
        setTimeout(() => { btn.classList.remove("is-done"); label.textContent = original; }, 2200);
      };
      const selectText = () => {
        const target = btn.parentElement && btn.parentElement.querySelector(".phone");
        if (target && window.getSelection) {
          const range = document.createRange();
          range.selectNodeContents(target);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }
        done("Selezionato");
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value).then(() => done("Copiato"), selectText);
      } else {
        selectText();
      }
    });
  });

  /* ---------- Consenso cookie e mappa ---------- */
  const CONSENT_KEY = "charm-consent-v1";
  const banner = $("#cookie");
  const readConsent = () => { try { return JSON.parse(store.get(CONSENT_KEY) || "null"); } catch (e) { return null; } };
  let consent = readConsent();
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  gtag("consent", "default", { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied" });

  const loadMap = (card) => {
    const canvas = $(".map-card__canvas", card);
    if (!canvas || canvas.querySelector("iframe") || !card.dataset.mapEmbed) return;
    const iframe = document.createElement("iframe");
    iframe.src = card.dataset.mapEmbed;
    iframe.title = "Mappa di Google con la posizione dello studio";
    iframe.loading = "lazy";
    iframe.referrerPolicy = "no-referrer-when-downgrade";
    canvas.appendChild(iframe);
    const btn = $("[data-map-load]", card);
    if (btn) btn.hidden = true;
  };
  const applyConsent = () => {
    if (!consent) return;
    gtag("consent", "update", { analytics_storage: consent.stats ? "granted" : "denied" });
    if (consent.stats && siteData.ga4 && !window.__gaLoaded) {
      window.__gaLoaded = true;
      const s = document.createElement("script");
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(siteData.ga4)}`;
      document.head.appendChild(s);
      gtag("js", new Date());
      gtag("config", siteData.ga4, { anonymize_ip: true });
    }
    if (consent.maps) $$("[data-map-embed]").forEach(loadMap);
  };
  const saveConsent = (value) => {
    consent = { necessary: true, maps: !!value.maps, stats: !!value.stats, ts: new Date().toISOString() };
    store.set(CONSENT_KEY, JSON.stringify(consent));
    if (banner) banner.hidden = true;
    applyConsent();
  };
  if (banner) {
    const prefs = $(".cookie__prefs", banner);
    const optMaps = $("#consent-maps", banner);
    const optStats = $("#consent-stats", banner);
    const open = (showPrefs) => {
      banner.hidden = false;
      if (prefs) prefs.hidden = !showPrefs;
      if (optMaps) optMaps.checked = !!(consent && consent.maps);
      if (optStats) optStats.checked = !!(consent && consent.stats);
    };
    if (!consent) open(false);
    banner.addEventListener("click", (e) => {
      const action = e.target.closest("[data-cookie]");
      if (!action) return;
      const kind = action.dataset.cookie;
      if (kind === "accept") saveConsent({ maps: true, stats: true });
      if (kind === "reject") saveConsent({ maps: false, stats: false });
      if (kind === "customize") { if (prefs) { prefs.hidden = !prefs.hidden; if (!prefs.hidden && optMaps) optMaps.focus(); } }
      if (kind === "save") saveConsent({ maps: optMaps && optMaps.checked, stats: optStats && optStats.checked });
    });
    $$("[data-cookie-open]").forEach((b) => b.addEventListener("click", () => { open(true); const h = $("h2", banner); if (h) { h.tabIndex = -1; h.focus(); } }));
  }
  $$("[data-map-load]").forEach((btn) => btn.addEventListener("click", () => {
    saveConsent({ maps: true, stats: consent ? consent.stats : false });
    const card = btn.closest("[data-map-embed]");
    if (card) loadMap(card);
  }));
  applyConsent();

  /* ---------- Modulo contatti ---------- */
  const form = $("form[data-contact]");
  if (form) {
    const started = Date.now();
    const status = $(".form-status", form);
    const submit = $("button[type=submit]", form);
    const fields = {
      name: { el: form.elements.name, check: (v) => v.trim().length >= 2, msg: "Inserisci nome e cognome." },
      phone: { el: form.elements.phone, check: (v) => /^[+()\d\s.-]{6,20}$/.test(v.trim()) && (v.match(/\d/g) || []).length >= 6, msg: "Inserisci un numero di telefono valido, con il prefisso internazionale se non è albanese." },
      email: { el: form.elements.email, check: (v) => v.trim() === "" || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()), msg: "Controlla l'indirizzo email." },
      privacy: { el: form.elements.privacy, check: (_, el) => el.checked, msg: "Per inviare la richiesta serve la presa visione dell'informativa." },
    };
    const showError = (key, show) => {
      const f = fields[key];
      const wrap = f.el.closest(".field, .check");
      const err = $(`#${f.el.id}-error`);
      if (wrap) wrap.classList.toggle("has-error", show);
      f.el.setAttribute("aria-invalid", String(show));
      if (err) err.textContent = show ? f.msg : "";
    };
    Object.keys(fields).forEach((key) => {
      const f = fields[key];
      if (!f.el) return;
      f.el.addEventListener("blur", () => { if (f.el.value !== "" || key === "privacy") showError(key, !f.check(f.el.value, f.el)); });
      f.el.addEventListener("input", () => { if (f.el.getAttribute("aria-invalid") === "true") showError(key, !f.check(f.el.value, f.el)); });
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      status.className = "form-status";
      status.textContent = "";
      let firstInvalid = null;
      Object.keys(fields).forEach((key) => {
        const f = fields[key];
        if (!f.el) return;
        const ok = f.check(f.el.value, f.el);
        showError(key, !ok);
        if (!ok && !firstInvalid) firstInvalid = f.el;
      });
      if (firstInvalid) { firstInvalid.focus(); return; }

      const data = Object.fromEntries(new FormData(form).entries());
      if (data.website) return; // honeypot compilato: invio ignorato
      data.elapsed = Date.now() - started;
      submit.setAttribute("aria-busy", "true");
      submit.disabled = true;
      const finish = (ok, message) => {
        submit.removeAttribute("aria-busy");
        submit.disabled = false;
        status.className = `form-status ${ok ? "is-ok" : "is-error"}`;
        status.textContent = message;
        status.focus();
        if (ok) form.reset();
      };
      const firstName = String(data.name || "").trim().split(/\s+/)[0];
      if (MODE === "preview") {
        setTimeout(() => finish(true, `Grazie, ${firstName}. Questa è una versione dimostrativa del sito: il modulo funziona, ma nessun dato è stato inviato o salvato.`), 900);
        return;
      }
      try {
        const res = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
        if (!res.ok) throw new Error(String(res.status));
        finish(true, `Grazie, ${firstName}. Abbiamo ricevuto la tua richiesta: lo studio ti ricontatterà negli orari di apertura.`);
      } catch (err) {
        finish(false, `Invio non riuscito. Riprova tra poco oppure chiama lo studio al ${siteData.phone || "numero indicato nella pagina"}.`);
      }
    });
  }

  /* ---------- Anno nel footer ---------- */
  $$("[data-year]").forEach((el) => { el.textContent = String(new Date().getFullYear()); });

  onScroll();
})();
