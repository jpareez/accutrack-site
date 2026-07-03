/* Accu-Track — shared progressive-enhancement script.
   Everything here enhances pre-rendered HTML. No content depends on JS.
   All motion respects prefers-reduced-motion. */
(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Header scroll state ---------- */
  var header = document.querySelector(".site-header");
  function onScroll() {
    if (!header) return;
    header.setAttribute("data-scrolled", window.scrollY > 8 ? "true" : "false");
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------- Mobile menu ---------- */
  var toggle = document.querySelector(".nav__toggle");
  function setMenu(open) {
    document.body.setAttribute("data-menu", open ? "open" : "closed");
    if (toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false");
    document.body.style.overflow = open ? "hidden" : "";
  }
  if (toggle) {
    toggle.addEventListener("click", function () {
      setMenu(document.body.getAttribute("data-menu") !== "open");
    });
  }
  // close menu when a link inside it is clicked
  document.querySelectorAll(".mobile-menu a").forEach(function (a) {
    a.addEventListener("click", function () { setMenu(false); });
  });
  window.addEventListener("keydown", function (e) {
    if (e.key === "Escape") setMenu(false);
  });

  /* ---------- FAQ accordion ----------
     Toggles are h3[role=button] so the question text stays direct heading
     content for crawlers; keyboard support replicates native button. */
  document.querySelectorAll(".faq__q").forEach(function (btn) {
    function toggleItem() {
      var item = btn.closest(".faq__item");
      var open = item.getAttribute("data-open") === "true";
      item.setAttribute("data-open", open ? "false" : "true");
      btn.setAttribute("aria-expanded", open ? "false" : "true");
    }
    btn.addEventListener("click", toggleItem);
    btn.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        toggleItem();
      }
    });
  });

  /* ---------- Reveal on scroll ---------- */
  var reveals = document.querySelectorAll(".reveal");
  if (reduce || !("IntersectionObserver" in window)) {
    reveals.forEach(function (el) { el.classList.add("is-in"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add("is-in");
          io.unobserve(en.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    reveals.forEach(function (el) { io.observe(el); });
    // Safety net: never let content stay hidden if IO fails to fire
    // (e.g. some headless/capture contexts). Reveals anything still hidden
    // that is at or above the current scroll position.
    window.setTimeout(function () {
      reveals.forEach(function (el) {
        if (!el.classList.contains("is-in") &&
            el.getBoundingClientRect().top < window.innerHeight + 200) {
          el.classList.add("is-in");
        }
      });
    }, 1200);
  }

  /* ---------- Click-interceptor page transitions ----------
     Intercepts same-origin internal navigations, fades the page out,
     then performs the real document navigation (multi-page, real URLs).
     No-ops under reduced motion or for modified clicks / external links. */
  function isInternal(a) {
    if (!a || !a.href) return false;
    if (a.target === "_blank" || a.hasAttribute("download")) return false;
    if (a.getAttribute("href").charAt(0) === "#") return false;
    if (/^(mailto:|tel:)/i.test(a.getAttribute("href"))) return false;
    return a.host === window.location.host;
  }
  if (!reduce) {
    document.addEventListener("click", function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest && e.target.closest("a");
      if (!isInternal(a)) return;
      var dest = a.href;
      // same page (ignoring hash) -> let browser handle
      if (dest.split("#")[0] === window.location.href.split("#")[0]) return;
      e.preventDefault();
      document.body.setAttribute("data-leaving", "true");
      window.setTimeout(function () { window.location.href = dest; }, 230);
    });
    // fade back in if returning via bfcache
    window.addEventListener("pageshow", function (e) {
      if (e.persisted) document.body.removeAttribute("data-leaving");
    });
  }

  /* ---------- Smooth in-page anchor scroll to form, with focus ---------- */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var id = a.getAttribute("href").slice(1);
      if (!id) return;
      var target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView ? window.scrollTo({
        top: target.getBoundingClientRect().top + window.scrollY - 80,
        behavior: reduce ? "auto" : "smooth"
      }) : null;
      var firstField = target.querySelector("input, select, textarea");
      if (firstField) window.setTimeout(function () { firstField.focus({ preventScroll: true }); }, reduce ? 0 : 450);
    });
  });

  /* ---------- Scroll progress bar ---------- */
  var bar = document.createElement("div");
  bar.className = "scroll-progress";
  bar.setAttribute("aria-hidden", "true");
  document.body.appendChild(bar);
  function updateBar() {
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    var pct = max > 0 ? (window.scrollY / max) * 100 : 0;
    bar.style.width = pct + "%";
  }
  updateBar();
  window.addEventListener("scroll", updateBar, { passive: true });
  window.addEventListener("resize", updateBar, { passive: true });

  /* ---------- Count-up numbers ---------- */
  function animateCount(el) {
    if (el.dataset.counted) return;
    el.dataset.counted = "1";
    var node = el.firstChild;
    if (!node || node.nodeType !== 3) return;
    var raw = node.nodeValue.trim();
    var m = raw.match(/^([^\d-]*)(-?\d+(?:\.\d+)?)(.*)$/);
    if (!m) return;
    var prefix = m[1], target = parseFloat(m[2]), trail = m[3];
    var dec = (m[2].split(".")[1] || "").length;
    if (reduce) { node.nodeValue = prefix + target.toFixed(dec) + trail; return; }
    var dur = 1300, start = null;
    function tick(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var e = 1 - Math.pow(1 - p, 3);
      node.nodeValue = prefix + (target * e).toFixed(dec) + trail;
      if (p < 1) requestAnimationFrame(tick);
      else node.nodeValue = prefix + target.toFixed(dec) + trail;
    }
    requestAnimationFrame(tick);
  }
  var counters = document.querySelectorAll(".stat__n, .proof-card__big, .proof-card__stat .n, .megastat__n");
  if (counters.length) {
    if (reduce || !("IntersectionObserver" in window)) {
      counters.forEach(animateCount);
    } else {
      var cio = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { animateCount(en.target); cio.unobserve(en.target); }
        });
      }, { threshold: 0.5 });
      counters.forEach(function (el) { cio.observe(el); });
    }
  }
})();
