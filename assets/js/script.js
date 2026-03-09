(function () {
  var yearNodes = document.querySelectorAll("[data-year]");
  var currentYear = new Date().getFullYear();
  yearNodes.forEach(function (node) {
    node.textContent = String(currentYear);
  });

  var menuButton = document.querySelector("[data-nav-toggle]");
  var nav = document.querySelector("[data-nav]");
  if (menuButton && nav) {
    menuButton.addEventListener("click", function () {
      var expanded = menuButton.getAttribute("aria-expanded") === "true";
      menuButton.setAttribute("aria-expanded", String(!expanded));
      nav.classList.toggle("open");
    });

    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        menuButton.setAttribute("aria-expanded", "false");
        nav.classList.remove("open");
      });
    });
  }

  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener("click", function (event) {
      var hash = anchor.getAttribute("href");
      if (!hash || hash.length <= 1) {
        return;
      }
      var target = document.querySelector(hash);
      if (!target) {
        return;
      }
      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
})();
