(function () {
  "use strict";

  var header = document.getElementById("site-header");
  var navToggle = document.getElementById("nav-toggle");
  var primaryNav = document.getElementById("primary-nav");
  var navLinks = Array.prototype.slice.call(
    primaryNav ? primaryNav.querySelectorAll('a[href^="#"]') : []
  );
  var sections = Array.prototype.slice.call(
    document.querySelectorAll("main section[id]")
  );

  function setHeaderState() {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 8);
  }

  function openNav() {
    if (!primaryNav || !navToggle) return;
    primaryNav.classList.add("is-open");
    navToggle.setAttribute("aria-expanded", "true");
    navToggle.setAttribute("aria-label", "Close navigation menu");
  }

  function closeNav() {
    if (!primaryNav || !navToggle) return;
    primaryNav.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
    navToggle.setAttribute("aria-label", "Open navigation menu");
  }

  function toggleNav() {
    if (!navToggle) return;
    if (navToggle.getAttribute("aria-expanded") === "true") {
      closeNav();
    } else {
      openNav();
    }
  }

  if (navToggle) {
    navToggle.addEventListener("click", toggleNav);

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeNav();
    });
  }

  navLinks.forEach(function (link) {
    link.addEventListener("click", closeNav);
  });

  window.addEventListener("scroll", setHeaderState, { passive: true });
  setHeaderState();

  if ("IntersectionObserver" in window) {
    var revealTargets = document.querySelectorAll("[data-reveal]");

    var revealObserver = new IntersectionObserver(
      function (entries, observer) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14, rootMargin: "0px 0px -40px 0px" }
    );

    revealTargets.forEach(function (target, index) {
      target.style.transitionDelay = Math.min(index * 60, 240) + "ms";
      revealObserver.observe(target);
    });

    var activeObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;

          navLinks.forEach(function (link) {
            var isMatch =
              link.getAttribute("href") === "#" + entry.target.id;
            link.classList.toggle("is-active", isMatch);
          });
        });
      },
      { threshold: 0.1, rootMargin: "-45% 0px -50% 0px" }
    );

    sections.forEach(function (section) {
      activeObserver.observe(section);
    });
  } else {
    Array.prototype.forEach.call(
      document.querySelectorAll("[data-reveal]"),
      function (target) {
        target.classList.add("is-visible");
      }
    );
  }

  var yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }
})();
