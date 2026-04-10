(function () {
  var yearNodes = document.querySelectorAll("[data-year]");
  var currentYear = new Date().getFullYear();
  yearNodes.forEach(function (node) {
    node.textContent = String(currentYear);
  });

  var viewportScrollLock = (function () {
    var activeCount = 0;
    var lockedScrollY = 0;
    var htmlNode = document.documentElement;
    var bodyNode = document.body;
    var lockClassName = "viewport-scroll-locked";

    var lock = function () {
      if (!htmlNode || !bodyNode) {
        return;
      }
      if (activeCount === 0) {
        lockedScrollY = window.scrollY || window.pageYOffset || 0;
        bodyNode.style.top = "-" + String(lockedScrollY) + "px";
        htmlNode.classList.add(lockClassName);
        bodyNode.classList.add(lockClassName);
      }
      activeCount += 1;
    };

    var unlock = function () {
      if (!htmlNode || !bodyNode || activeCount === 0) {
        return;
      }
      activeCount -= 1;
      if (activeCount > 0) {
        return;
      }
      htmlNode.classList.remove(lockClassName);
      bodyNode.classList.remove(lockClassName);
      bodyNode.style.top = "";
      window.scrollTo(0, lockedScrollY);
      lockedScrollY = 0;
    };

    return {
      lock: lock,
      unlock: unlock
    };
  })();

  var initUtilityNav = function () {
    var utilityInners = Array.prototype.slice.call(document.querySelectorAll(".utility-nav .utility-inner"));
    if (!utilityInners.length) {
      return;
    }

    var mobileMediaQuery = null;
    if (typeof window.matchMedia === "function") {
      mobileMediaQuery = window.matchMedia("(max-width: 980px)");
    }

    utilityInners.forEach(function (inner, index) {
      var nav = inner.querySelector(".utility-links");
      if (!nav) {
        return;
      }

      if (!nav.id) {
        nav.id = "utility-links-" + String(index + 1);
      }
      nav.setAttribute("data-nav", "");

      var menuButton = inner.querySelector("[data-nav-toggle]");
      if (!menuButton) {
        menuButton = document.createElement("button");
        menuButton.type = "button";
        menuButton.className = "utility-mobile-toggle";
        menuButton.setAttribute("data-nav-toggle", "");
        menuButton.textContent = "Menu";
        inner.insertBefore(menuButton, nav);
      }

      menuButton.setAttribute("aria-controls", nav.id);
      menuButton.setAttribute("aria-expanded", "false");
      menuButton.setAttribute("aria-label", "Toggle site navigation");

      var mobileMenuContact = nav.querySelector("[data-mobile-menu-contact]");
      if (!mobileMenuContact) {
        mobileMenuContact = document.createElement("div");
        mobileMenuContact.className = "mobile-menu-contact";
        mobileMenuContact.setAttribute("data-mobile-menu-contact", "true");
        mobileMenuContact.innerHTML = [
          "<a class='mobile-menu-contact-phone' href='tel:+19197377896'>919-737-7896</a>",
          "<a class='mobile-menu-contact-email' href='mailto:livinginraleighteam@gmail.com'>LIVINGINRALEIGHTEAM@GMAIL.COM</a>"
        ].join("");
        nav.appendChild(mobileMenuContact);
      }

      var syncBodyScrollLock = function () {
        var hasOpenNav = Boolean(document.querySelector(".utility-inner.utility-nav-open"));
        document.body.classList.toggle("utility-nav-lock", hasOpenNav);
      };

      var setMenuButtonState = function (isOpen) {
        menuButton.setAttribute("aria-expanded", String(isOpen));
        menuButton.classList.toggle("is-open", isOpen);
        menuButton.textContent = isOpen ? "Close" : "Menu";
      };

      var closeNav = function () {
        setMenuButtonState(false);
        nav.classList.remove("open");
        inner.classList.remove("utility-nav-open");
        syncBodyScrollLock();
      };

      menuButton.addEventListener("click", function () {
        var willOpen = menuButton.getAttribute("aria-expanded") !== "true";
        setMenuButtonState(willOpen);
        nav.classList.toggle("open", willOpen);
        inner.classList.toggle("utility-nav-open", willOpen);
        syncBodyScrollLock();
      });

      nav.querySelectorAll("a").forEach(function (link) {
        link.addEventListener("click", function () {
          if (link.classList.contains("menu-trigger")) {
            return;
          }
          if (!mobileMediaQuery || mobileMediaQuery.matches) {
            closeNav();
          }
        });
      });

      document.addEventListener("click", function (event) {
        if (!event.target || inner.contains(event.target)) {
          return;
        }
        closeNav();
      });

      inner.addEventListener("click", function (event) {
        if (!mobileMediaQuery || !mobileMediaQuery.matches || !inner.classList.contains("utility-nav-open")) {
          return;
        }
        if (!(event.target instanceof Element)) {
          return;
        }
        if (event.target.closest(".utility-links, [data-nav-toggle], .call-link")) {
          return;
        }
        closeNav();
      });

      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
          closeNav();
        }
      });

      if (mobileMediaQuery) {
        var handleMediaChange = function (event) {
          if (!event.matches) {
            closeNav();
          }
        };
        if (typeof mobileMediaQuery.addEventListener === "function") {
          mobileMediaQuery.addEventListener("change", handleMediaChange);
        } else if (typeof mobileMediaQuery.addListener === "function") {
          mobileMediaQuery.addListener(handleMediaChange);
        }
      }
    });
  };

  initUtilityNav();

  var initMobileScrollTopButton = function () {
    if (!document.body || typeof window.matchMedia !== "function") {
      return;
    }

    var mobileMediaQuery = window.matchMedia("(max-width: 980px)");
    var showThresholdPx = 120;
    var button = document.querySelector("[data-mobile-scroll-top]");
    var rafPending = false;

    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "mobile-scroll-top";
      button.setAttribute("data-mobile-scroll-top", "true");
      button.setAttribute("aria-label", "Scroll back to top");
      button.setAttribute("aria-hidden", "true");
      button.innerHTML = "&#8593;";
      document.body.appendChild(button);
    }

    var updateVisibility = function () {
      var scrollY = window.scrollY || window.pageYOffset || 0;
      var hasBlockingOverlay =
        document.body.classList.contains("lead-popup-open") ||
        document.body.classList.contains("call-contact-popup-open") ||
        document.body.classList.contains("video-modal-open") ||
        document.body.classList.contains("legal-modal-open") ||
        document.body.classList.contains("viewport-scroll-locked");
      var shouldShow = mobileMediaQuery.matches && scrollY > showThresholdPx && !hasBlockingOverlay;
      button.classList.toggle("is-visible", shouldShow);
      button.setAttribute("aria-hidden", shouldShow ? "false" : "true");
    };

    var queueVisibilityUpdate = function () {
      if (rafPending) {
        return;
      }
      rafPending = true;
      window.requestAnimationFrame(function () {
        rafPending = false;
        updateVisibility();
      });
    };

    button.addEventListener("click", function (event) {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    window.addEventListener("scroll", queueVisibilityUpdate, { passive: true });
    window.addEventListener("resize", queueVisibilityUpdate);
    if (typeof mobileMediaQuery.addEventListener === "function") {
      mobileMediaQuery.addEventListener("change", queueVisibilityUpdate);
    } else if (typeof mobileMediaQuery.addListener === "function") {
      mobileMediaQuery.addListener(queueVisibilityUpdate);
    }

    if (typeof window.MutationObserver === "function") {
      var classObserver = new MutationObserver(queueVisibilityUpdate);
      classObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    }

    updateVisibility();
  };

  initMobileScrollTopButton();

  var initMobileMapTuner = function () {
    if (!document.body || !document.body.classList.contains("page-home") || typeof window.URLSearchParams !== "function") {
      return;
    }

    var storage = null;
    try {
      storage = window.localStorage;
    } catch (error) {
      storage = null;
    }

    var params = new URLSearchParams(window.location.search || "");
    var rawToggle = params.get("map_tuner");
    if (!rawToggle) {
      rawToggle = params.get("mapTuner");
    }

    var enabledStorageKey = "livrMapTunerEnabled";
    var stateStorageKey = "livrMapTunerStateV3";
    if (storage && rawToggle !== "1") {
      try {
        storage.removeItem(enabledStorageKey);
      } catch (error) {
        // ignore storage access errors in restricted browsing contexts
      }
    }

    var isEnabled = rawToggle === "1";
    if (!isEnabled) {
      return;
    }

    var mapShell = document.querySelector(".home-map-shell");
    var mapComposite = mapShell ? mapShell.querySelector(".map-composite") : null;
    if (!mapShell || !mapComposite) {
      return;
    }

    var mapLayers = Array.prototype.slice.call(mapComposite.querySelectorAll(".map-layer"));
    if (!mapLayers.length) {
      return;
    }

    if (!document.getElementById("map-tuner-style")) {
      var styleNode = document.createElement("style");
      styleNode.id = "map-tuner-style";
      styleNode.textContent = [
        ".map-tuner-panel { position: fixed; left: 0.62rem; right: 0.62rem; bottom: max(0.62rem, env(safe-area-inset-bottom)); z-index: 6200; background: rgba(8, 20, 14, 0.95); border: 1px solid rgba(255, 255, 255, 0.22); box-shadow: 0 16px 36px rgba(0, 0, 0, 0.34); border-radius: 10px; padding: 0.62rem 0.66rem 0.66rem; color: #f3faf6; font-family: \"Manrope\", \"Segoe UI\", sans-serif; }",
        ".map-tuner-panel[hidden] { display: none; }",
        ".map-tuner-head { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.46rem; }",
        ".map-tuner-head h3 { margin: 0; font-size: 0.88rem; letter-spacing: 0.04em; text-transform: uppercase; color: #f3faf6; }",
        ".map-tuner-mini { margin: 0; font-size: 0.68rem; color: rgba(232, 243, 237, 0.84); }",
        ".map-tuner-close { border: 0; background: rgba(255, 255, 255, 0.12); color: #f0f7f3; border-radius: 999px; width: 24px; height: 24px; font-size: 0.88rem; line-height: 1; cursor: pointer; }",
        ".map-tuner-grid { display: grid; gap: 0.42rem; }",
        ".map-tuner-row { display: grid; grid-template-columns: 62px minmax(0, 1fr) 64px; align-items: center; gap: 0.42rem; }",
        ".map-tuner-row label { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.03em; text-transform: uppercase; color: #d5e8dc; }",
        ".map-tuner-row input[type='range'] { width: 100%; margin: 0; accent-color: #c49a34; }",
        ".map-tuner-row output { font-size: 0.72rem; font-weight: 700; text-align: right; color: #f4dfad; font-variant-numeric: tabular-nums; }",
        ".map-tuner-pad { display: grid; grid-template-columns: repeat(3, 32px); grid-template-rows: repeat(3, 24px); gap: 3px; justify-content: center; margin-top: 0.32rem; }",
        ".map-tuner-pad button { border: 1px solid rgba(255, 255, 255, 0.2); background: rgba(255, 255, 255, 0.08); color: #f3faf6; border-radius: 4px; font-size: 0.78rem; line-height: 1; padding: 0; cursor: pointer; }",
        ".map-tuner-actions { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.34rem; margin-top: 0.45rem; }",
        ".map-tuner-actions button { min-height: 28px; border: 1px solid rgba(255, 255, 255, 0.24); border-radius: 5px; background: rgba(255, 255, 255, 0.07); color: #f3faf6; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.03em; text-transform: uppercase; cursor: pointer; }",
        ".map-tuner-actions .is-gold { background: #c49a34; border-color: rgba(255, 255, 255, 0.42); color: #ffffff; }",
        ".map-tuner-css { width: 100%; min-height: 96px; margin-top: 0.45rem; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 6px; background: rgba(2, 9, 6, 0.66); color: #ecf6ef; font-family: Consolas, \"Courier New\", monospace; font-size: 0.65rem; line-height: 1.35; padding: 0.46rem; resize: vertical; }",
        ".map-tuner-open { position: fixed; left: 0.62rem; bottom: max(0.62rem, env(safe-area-inset-bottom)); z-index: 6199; min-height: 30px; border: 1px solid rgba(255, 255, 255, 0.24); border-radius: 999px; background: rgba(8, 20, 14, 0.95); color: #f3faf6; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; padding: 0.28rem 0.6rem; cursor: pointer; }",
        ".map-tuner-open[hidden] { display: none; }",
        "@media (min-width: 981px) { .map-tuner-panel { max-width: 430px; right: auto; } }"
      ].join("\n");
      document.head.appendChild(styleNode);
    }

    var parseSavedState = function () {
      if (!storage) {
        return null;
      }
      var raw = "";
      try {
        raw = storage.getItem(stateStorageKey) || "";
      } catch (error) {
        raw = "";
      }
      if (!raw) {
        return null;
      }
      try {
        var parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") {
          return null;
        }
        return parsed;
      } catch (error) {
        return null;
      }
    };

    var clamp = function (value, min, max) {
      return Math.max(min, Math.min(max, value));
    };
    var zoomMin = 40;
    var zoomMax = 260;

    var shouldUseSavedState = rawToggle !== "1";
    var savedState = shouldUseSavedState ? parseSavedState() : null;
    var state = {
      zoom: 100,
      x: 0,
      y: 0
    };

    if (savedState) {
      if (typeof savedState.zoom === "number" && isFinite(savedState.zoom)) {
        state.zoom = clamp(savedState.zoom, zoomMin, zoomMax);
      } else if (typeof savedState.width === "number" && isFinite(savedState.width)) {
        state.zoom = clamp((savedState.width / 160) * 100, zoomMin, zoomMax);
      }
      if (typeof savedState.x === "number" && isFinite(savedState.x)) {
        state.x = clamp(savedState.x, -220, 220);
      }
      if (typeof savedState.y === "number" && isFinite(savedState.y)) {
        state.y = clamp(savedState.y, -160, 160);
      }
    }

    var panel = document.createElement("section");
    panel.className = "map-tuner-panel";
    panel.setAttribute("data-map-tuner", "true");
    panel.setAttribute("aria-label", "Map tuning controls");
    panel.innerHTML = [
      "<div class='map-tuner-head'>",
      "<div>",
      "<h3>Map Tuner</h3>",
      "<p class='map-tuner-mini'>Legend stays fixed while map layers zoom/move</p>",
      "</div>",
      "<button type='button' class='map-tuner-close' data-map-tuner-action='close' aria-label='Close map tuner'>&times;</button>",
      "</div>",
      "<div class='map-tuner-grid'>",
      "<div class='map-tuner-row'>",
      "<label for='map-tuner-zoom'>Zoom</label>",
      "<input id='map-tuner-zoom' type='range' min='" + zoomMin + "' max='" + zoomMax + "' step='0.1' data-map-tuner-input='zoom'>",
      "<output data-map-tuner-output='zoom'></output>",
      "</div>",
      "<div class='map-tuner-row'>",
      "<label for='map-tuner-x'>Move X</label>",
      "<input id='map-tuner-x' type='range' min='-220' max='220' step='0.5' data-map-tuner-input='x'>",
      "<output data-map-tuner-output='x'></output>",
      "</div>",
      "<div class='map-tuner-row'>",
      "<label for='map-tuner-y'>Move Y</label>",
      "<input id='map-tuner-y' type='range' min='-160' max='160' step='0.5' data-map-tuner-input='y'>",
      "<output data-map-tuner-output='y'></output>",
      "</div>",
      "<div class='map-tuner-pad' aria-label='Nudge controls'>",
      "<button type='button' data-map-tuner-move='up-left' aria-label='Nudge up left'>Ã¢â€ â€“</button>",
      "<button type='button' data-map-tuner-move='up' aria-label='Nudge up'>Ã¢â€ â€˜</button>",
      "<button type='button' data-map-tuner-move='up-right' aria-label='Nudge up right'>Ã¢â€ â€”</button>",
      "<button type='button' data-map-tuner-move='left' aria-label='Nudge left'>Ã¢â€ Â</button>",
      "<button type='button' data-map-tuner-move='center' aria-label='Center position'>Ã¢â‚¬Â¢</button>",
      "<button type='button' data-map-tuner-move='right' aria-label='Nudge right'>Ã¢â€ â€™</button>",
      "<button type='button' data-map-tuner-move='down-left' aria-label='Nudge down left'>Ã¢â€ â„¢</button>",
      "<button type='button' data-map-tuner-move='down' aria-label='Nudge down'>Ã¢â€ â€œ</button>",
      "<button type='button' data-map-tuner-move='down-right' aria-label='Nudge down right'>Ã¢â€ Ëœ</button>",
      "</div>",
      "<div class='map-tuner-actions'>",
      "<button type='button' data-map-tuner-action='reset'>Reset</button>",
      "<button type='button' data-map-tuner-action='copy' class='is-gold'>Copy CSS</button>",
      "<button type='button' data-map-tuner-action='disable'>Disable</button>",
      "</div>",
      "<textarea class='map-tuner-css' readonly data-map-tuner-css></textarea>",
      "</div>"
    ].join("");

    var openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "map-tuner-open";
    openButton.setAttribute("data-map-tuner-open", "true");
    openButton.setAttribute("aria-label", "Open map tuner");
    openButton.textContent = "Map Tuner";
    openButton.hidden = true;

    document.body.appendChild(panel);
    document.body.appendChild(openButton);

    var zoomInput = panel.querySelector("[data-map-tuner-input='zoom']");
    var xInput = panel.querySelector("[data-map-tuner-input='x']");
    var yInput = panel.querySelector("[data-map-tuner-input='y']");
    var zoomOutput = panel.querySelector("[data-map-tuner-output='zoom']");
    var xOutput = panel.querySelector("[data-map-tuner-output='x']");
    var yOutput = panel.querySelector("[data-map-tuner-output='y']");
    var cssOutput = panel.querySelector("[data-map-tuner-css]");

    var syncInputs = function () {
      zoomInput.value = String(state.zoom);
      xInput.value = String(state.x);
      yInput.value = String(state.y);
      zoomOutput.textContent = state.zoom.toFixed(1) + "%";
      xOutput.textContent = state.x.toFixed(1) + "px";
      yOutput.textContent = state.y.toFixed(1) + "px";
    };

    var buildCssSnippet = function () {
      var zoomScale = (state.zoom / 100).toFixed(4);
      var transformValue = "translate(calc(-50% + " + state.x.toFixed(1) + "px), " + state.y.toFixed(1) + "px) scale(" + zoomScale + ")";
      var lines = [
        ".home-map-shell .map-composite {",
        "  inset: 0;",
        "  width: 100%;",
        "  height: 100%;",
        "  left: 0;",
        "  right: 0;",
        "}",
        ".home-map-shell .map-layer {",
        "  top: 0;",
        "  bottom: auto;",
        "  left: 50%;",
        "  right: auto;",
        "  width: 100%;",
        "  height: 100%;",
        "  object-fit: contain;",
        "  object-position: center center;",
        "  transform: " + transformValue + ";",
        "  transform-origin: top center;",
        "}"
      ];
      return lines.join("\n");
    };

    var persistState = function () {
      if (!storage) {
        return;
      }
      try {
        storage.setItem(stateStorageKey, JSON.stringify(state));
      } catch (error) {}
    };

    var applyState = function () {
      var zoomScale = state.zoom / 100;
      var transformValue = "translate(calc(-50% + " + state.x.toFixed(1) + "px), " + state.y.toFixed(1) + "px) scale(" + zoomScale.toFixed(4) + ")";

      mapComposite.style.inset = "0";
      mapComposite.style.width = "100%";
      mapComposite.style.height = "100%";
      mapComposite.style.left = "0";
      mapComposite.style.right = "0";
      mapComposite.style.transform = "";
      mapComposite.style.transformOrigin = "";

      mapLayers.forEach(function (layer) {
        layer.style.top = "0";
        layer.style.bottom = "auto";
        layer.style.left = "50%";
        layer.style.right = "auto";
        layer.style.width = "100%";
        layer.style.height = "100%";
        layer.style.objectFit = "contain";
        layer.style.objectPosition = "center center";
        layer.style.transform = transformValue;
        layer.style.transformOrigin = "top center";
      });

      syncInputs();
      cssOutput.value = buildCssSnippet();
      persistState();
    };

    var updateFromInputs = function () {
      state.zoom = clamp(Number(zoomInput.value) || state.zoom, zoomMin, zoomMax);
      state.x = clamp(Number(xInput.value) || state.x, -220, 220);
      state.y = clamp(Number(yInput.value) || state.y, -160, 160);
      applyState();
    };

    zoomInput.addEventListener("input", updateFromInputs);
    xInput.addEventListener("input", updateFromInputs);
    yInput.addEventListener("input", updateFromInputs);

    panel.querySelectorAll("[data-map-tuner-move]").forEach(function (button) {
      button.addEventListener("click", function () {
        var action = button.getAttribute("data-map-tuner-move");
        var step = 1;
        if (action === "left" || action === "up-left" || action === "down-left") {
          state.x = clamp(state.x - step, -220, 220);
        }
        if (action === "right" || action === "up-right" || action === "down-right") {
          state.x = clamp(state.x + step, -220, 220);
        }
        if (action === "up" || action === "up-left" || action === "up-right") {
          state.y = clamp(state.y - step, -160, 160);
        }
        if (action === "down" || action === "down-left" || action === "down-right") {
          state.y = clamp(state.y + step, -160, 160);
        }
        if (action === "center") {
          state.x = 0;
          state.y = 0;
        }
        applyState();
      });
    });

    var closePanel = function () {
      panel.hidden = true;
      openButton.hidden = false;
    };

    var openPanel = function () {
      panel.hidden = false;
      openButton.hidden = true;
    };

    openButton.addEventListener("click", openPanel);

    panel.querySelectorAll("[data-map-tuner-action]").forEach(function (button) {
      button.addEventListener("click", function () {
        var action = button.getAttribute("data-map-tuner-action");
        if (action === "close") {
          closePanel();
          return;
        }
        if (action === "reset") {
          state.zoom = 100;
          state.x = 0;
          state.y = 0;
          applyState();
          return;
        }
        if (action === "copy") {
          if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
            navigator.clipboard.writeText(cssOutput.value).catch(function () {});
          } else {
            cssOutput.focus();
            cssOutput.select();
          }
          return;
        }
        if (action === "disable") {
          if (storage) {
            try {
              storage.removeItem(enabledStorageKey);
              storage.removeItem(stateStorageKey);
            } catch (error) {}
          }
          mapComposite.style.inset = "";
          mapComposite.style.width = "";
          mapComposite.style.height = "";
          mapComposite.style.left = "";
          mapComposite.style.right = "";
          mapComposite.style.transform = "";
          mapComposite.style.transformOrigin = "";
          mapLayers.forEach(function (layer) {
            layer.style.top = "";
            layer.style.bottom = "";
            layer.style.left = "";
            layer.style.right = "";
            layer.style.width = "";
            layer.style.height = "";
            layer.style.objectFit = "";
            layer.style.objectPosition = "";
            layer.style.transform = "";
            layer.style.transformOrigin = "";
          });
          panel.remove();
          openButton.remove();
        }
      });
    });

    applyState();
  };

  // Map tuner intentionally disabled after final mobile map lock-in.
  // initMobileMapTuner();

  var menuDropdowns = Array.prototype.slice.call(document.querySelectorAll(".menu-dropdown"));
  if (menuDropdowns.length) {
    var closeAllDropdowns = function () {
      menuDropdowns.forEach(function (dropdown) {
        dropdown.classList.remove("open");
        var trigger = dropdown.querySelector(".menu-trigger");
        if (trigger) {
          trigger.setAttribute("aria-expanded", "false");
        }
      });
    };

    menuDropdowns.forEach(function (dropdown) {
      var trigger = dropdown.querySelector(".menu-trigger");
      if (!trigger) {
        return;
      }

      trigger.setAttribute("aria-haspopup", "true");
      trigger.setAttribute("aria-expanded", "false");

      // Top-level dropdown labels should only open the menu and never navigate.
      trigger.addEventListener("click", function (event) {
        event.preventDefault();
        var willOpen = !dropdown.classList.contains("open");
        closeAllDropdowns();
        dropdown.classList.toggle("open", willOpen);
        trigger.setAttribute("aria-expanded", String(willOpen));
      });
    });

    document.addEventListener("click", function (event) {
      var target = event.target;
      var targetElement = target instanceof Element ? target : (target && target.parentElement ? target.parentElement : null);
      if (!targetElement || !targetElement.closest(".menu-dropdown")) {
        closeAllDropdowns();
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeAllDropdowns();
      }
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

  var heroHeader = document.querySelector(".hero-container");
  if (heroHeader) {
    heroHeader.addEventListener("click", function (event) {
      var target = event.target;
      if (target && target.nodeType === 1 && target.closest("a, button, input, select, textarea, iframe, label")) {
        return;
      }
      window.location.assign("/");
    });
  }

  document.querySelectorAll(".home-promo-video").forEach(function (video) {
    video.loop = true;
    video.addEventListener("ended", function () {
      video.currentTime = 0;
      var playPromise = video.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(function () {});
      }
    });
  });

  var smsConsentDisclosureText = "I agree to be contacted by The Official Living in Raleigh NC Team via call, email, and text for real estate services. We use SMS to confirm appointments, send reminders, and notify clients of schedule updates or important changes. You can opt out at any time by replying STOP, or reply HELP for assistance. Message and data rates may apply. Message frequency may vary.";
  var smsConsentOptionalNoteText = "SMS consent is optional and is not required to submit this form.";

  var analyticsTracker = (function () {
    // Set this globally before script.js loads: window.__LIVR_ANALYTICS_ENDPOINT__ = "https://script.google.com/macros/s/.../exec";
    var defaultAnalyticsEndpoint = "https://script.google.com/macros/s/AKfycbzBMxFBoQZBWSCdVCRnW4kFnjyoGZA2F-3ym2rqW-fVMFa1Wx5xT5SNMrvZdP3Xky0/exec";
    var configuredEndpoint = String(window.__LIVR_ANALYTICS_ENDPOINT__ || defaultAnalyticsEndpoint).trim();
    var localStore = null;
    var sessionStore = null;
    try {
      localStore = window.localStorage;
    } catch (error) {
      localStore = null;
    }
    try {
      sessionStore = window.sessionStorage;
    } catch (error) {
      sessionStore = null;
    }

    var safeGet = function (storage, key) {
      if (!storage) {
        return "";
      }
      try {
        return storage.getItem(key) || "";
      } catch (error) {
        return "";
      }
    };

    var safeSet = function (storage, key, value) {
      if (!storage) {
        return;
      }
      try {
        storage.setItem(key, value);
      } catch (error) {}
    };

    var safeRemove = function (storage, key) {
      if (!storage) {
        return;
      }
      try {
        storage.removeItem(key);
      } catch (error) {}
    };

    var createId = function (prefix) {
      return [
        prefix,
        Date.now().toString(36),
        Math.random().toString(36).slice(2, 10)
      ].join("_");
    };

    var resolveEndpoint = function () {
      var runtimeEndpoint = String(window.__LIVR_ANALYTICS_ENDPOINT__ || "").trim();
      return runtimeEndpoint || configuredEndpoint;
    };

    var canonicalPath = String(window.location.pathname || "/").replace(/\/index\.html$/i, "/");
    if (canonicalPath.charAt(canonicalPath.length - 1) !== "/") {
      canonicalPath += "/";
    }

    var pageType = "unknown";
    if (document.body && document.body.classList && document.body.classList.length) {
      Array.prototype.slice.call(document.body.classList).some(function (className) {
        if (String(className).indexOf("page-") !== 0) {
          return false;
        }
        pageType = className.replace(/^page-/, "") || "unknown";
        return true;
      });
    }

    var sessionIdKey = "livrAnalyticsSessionId";
    var queueKey = "livrAnalyticsQueue";
    var sessionId = safeGet(sessionStore, sessionIdKey);
    if (!sessionId) {
      sessionId = createId("sess");
      safeSet(sessionStore, sessionIdKey, sessionId);
    }

    var pageViewId = createId("pv");
    var queue = [];
    var flushTimer = 0;
    var flushInFlight = false;
    var flushIntervalMs = 4000;
    var maxBatchSize = 25;
    var maxQueuedEvents = 250;
    var pageOpenAtMs = Date.now();
    var visibleSinceMs = document.visibilityState === "visible" ? pageOpenAtMs : 0;
    var engagedMs = 0;
    var hasPopupInteraction = false;
    var hasFormInteraction = false;
    var hasExitEventTracked = false;

    var loadQueue = function () {
      var cached = safeGet(sessionStore, queueKey);
      if (!cached) {
        return;
      }
      try {
        var parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          queue = parsed.slice(-maxQueuedEvents);
        }
      } catch (error) {
        safeRemove(sessionStore, queueKey);
      }
    };

    var persistQueue = function () {
      safeSet(sessionStore, queueKey, JSON.stringify(queue.slice(-maxQueuedEvents)));
    };

    var resetFlushTimer = function () {
      if (!flushTimer) {
        return;
      }
      window.clearTimeout(flushTimer);
      flushTimer = 0;
    };

    var scheduleFlush = function () {
      if (flushTimer || !queue.length) {
        return;
      }
      flushTimer = window.setTimeout(function () {
        flushTimer = 0;
        flush(false);
      }, flushIntervalMs);
    };

    var updateEngagedTime = function () {
      if (!visibleSinceMs) {
        return;
      }
      var now = Date.now();
      engagedMs += Math.max(0, now - visibleSinceMs);
      visibleSinceMs = now;
    };

    var getEngagedTimeMs = function () {
      if (!visibleSinceMs) {
        return engagedMs;
      }
      return engagedMs + Math.max(0, Date.now() - visibleSinceMs);
    };

    var getBaseEventData = function () {
      return {
        session_id: sessionId,
        page_view_id: pageViewId,
        page_path: canonicalPath,
        page_url: window.location.href,
        page_title: document.title || "",
        page_type: pageType,
        referrer: document.referrer || "",
        page_time_ms: Math.max(0, Date.now() - pageOpenAtMs),
        engaged_time_ms: Math.max(0, getEngagedTimeMs()),
        popup_interacted: hasPopupInteraction,
        form_interacted: hasFormInteraction
      };
    };

    var track = function (eventName, properties) {
      if (!eventName) {
        return;
      }

      var endpoint = resolveEndpoint();
      if (!endpoint) {
        return;
      }

      var eventRecord = getBaseEventData();
      eventRecord.event_name = String(eventName);
      eventRecord.event_time = new Date().toISOString();
      if (properties && typeof properties === "object") {
        Object.keys(properties).forEach(function (key) {
          eventRecord[key] = properties[key];
        });
      }

      queue.push(eventRecord);
      if (queue.length > maxQueuedEvents) {
        queue = queue.slice(-maxQueuedEvents);
      }
      persistQueue();

      if (queue.length >= maxBatchSize) {
        flush(false);
        return;
      }
      scheduleFlush();
    };

    var markPopupInteraction = function (source) {
      if (!hasPopupInteraction) {
        hasPopupInteraction = true;
        track("popup_interaction_started", {
          interaction_source: source || "unknown"
        });
      }
    };

    var markFormInteraction = function (source) {
      if (!hasFormInteraction) {
        hasFormInteraction = true;
        track("form_interaction_started", {
          interaction_source: source || "unknown"
        });
      }
    };

    var flush = function (preferBeacon) {
      resetFlushTimer();
      if (!queue.length || flushInFlight) {
        return;
      }

      var endpoint = resolveEndpoint();
      if (!endpoint || typeof window.fetch !== "function") {
        return;
      }

      var batch = queue.slice(0, maxBatchSize);
      queue = queue.slice(maxBatchSize);
      persistQueue();

      var requestPayload = {
        source: "website_analytics",
        sent_at: new Date().toISOString(),
        session_id: sessionId,
        page_view_id: pageViewId,
        events: batch
      };
      var body = JSON.stringify(requestPayload);

      if (preferBeacon && typeof navigator.sendBeacon === "function") {
        try {
          var beaconAccepted = navigator.sendBeacon(endpoint, new Blob([body], { type: "text/plain;charset=UTF-8" }));
          if (beaconAccepted) {
            if (queue.length) {
              scheduleFlush();
            }
            return;
          }
        } catch (error) {}
      }

      var requestInit = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body,
        keepalive: Boolean(preferBeacon)
      };

      if (/script\.google\.com/i.test(endpoint)) {
        requestInit.mode = "no-cors";
      }

      flushInFlight = true;
      window.fetch(endpoint, requestInit)
        .then(function () {
          flushInFlight = false;
          if (queue.length) {
            scheduleFlush();
          }
        })
        .catch(function () {
          flushInFlight = false;
          queue = batch.concat(queue).slice(-maxQueuedEvents);
          persistQueue();
          scheduleFlush();
        });
    };

    var trackExitEvent = function (trigger) {
      if (hasExitEventTracked) {
        return;
      }
      hasExitEventTracked = true;
      updateEngagedTime();
      track("page_exit", {
        exit_trigger: trigger || "unknown"
      });
      flush(true);
    };

    loadQueue();
    track("page_view", {
      viewport_width: window.innerWidth || 0,
      viewport_height: window.innerHeight || 0
    });
    scheduleFlush();

    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") {
        updateEngagedTime();
        flush(false);
        return;
      }
      visibleSinceMs = Date.now();
    });

    window.setInterval(function () {
      track("engagement_heartbeat", {
        heartbeat_interval_ms: 30000
      });
    }, 30000);

    window.addEventListener("pagehide", function () {
      trackExitEvent("pagehide");
    });

    window.addEventListener("beforeunload", function () {
      trackExitEvent("beforeunload");
    });

    return {
      track: track,
      flush: flush,
      markPopupInteraction: markPopupInteraction,
      markFormInteraction: markFormInteraction,
      getSessionId: function () {
        return sessionId;
      },
      getPageViewId: function () {
        return pageViewId;
      }
    };
  })();
  window.__livrAnalyticsTracker = analyticsTracker;

  var trackAnalyticsEvent = function (eventName, properties) {
    if (!analyticsTracker || typeof analyticsTracker.track !== "function") {
      return;
    }
    analyticsTracker.track(eventName, properties || {});
  };

  var markAnalyticsPopupInteraction = function (source) {
    if (!analyticsTracker || typeof analyticsTracker.markPopupInteraction !== "function") {
      return;
    }
    analyticsTracker.markPopupInteraction(source || "popup");
  };

  var markAnalyticsFormInteraction = function (source) {
    if (!analyticsTracker || typeof analyticsTracker.markFormInteraction !== "function") {
      return;
    }
    analyticsTracker.markFormInteraction(source || "form");
  };

  var mapObject = document.querySelector(".map-hit");
  if (mapObject) {
    var orderedSuburbRoutes = [
      "/explore-the-area/durham/",
      "/explore-the-area/chapel-hill/",
      "/explore-the-area/morrisville/",
      "/explore-the-area/cary/",
      "/explore-the-area/apex/",
      "/explore-the-area/holly-springs/",
      "/explore-the-area/fuquay-varina/",
      "/explore-the-area/garner/",
      "/explore-the-area/clayton/",
      "/explore-the-area/south-raleigh/",
      "/explore-the-area/east-raleigh/",
      "/explore-the-area/knightdale/",
      "/explore-the-area/wendell/",
      "/explore-the-area/zebulon/",
      "/explore-the-area/raleigh/",
      "/explore-the-area/rolesville/",
      "/explore-the-area/wake-forest/",
      "/explore-the-area/youngsville/",
      "/explore-the-area/raleigh/"
    ];

    // Authoritative one-based mapping from user-confirmed region IDs.
    var suburbIdRouteMap = {};
    orderedSuburbRoutes.forEach(function (route, index) {
      suburbIdRouteMap["suburb-" + String(index + 1)] = route;
    });

    var suburbRouteMap = {
      "durham": "/explore-the-area/durham/",
      "chapel hill": "/explore-the-area/chapel-hill/",
      "morrisville": "/explore-the-area/morrisville/",
      "cary": "/explore-the-area/cary/",
      "apex": "/explore-the-area/apex/",
      "holly springs": "/explore-the-area/holly-springs/",
      "fuquay varina": "/explore-the-area/fuquay-varina/",
      "garner": "/explore-the-area/garner/",
      "clayton": "/explore-the-area/clayton/",
      "south raleigh": "/explore-the-area/south-raleigh/",
      "east raleigh": "/explore-the-area/east-raleigh/",
      "knightdale": "/explore-the-area/knightdale/",
      "wendell": "/explore-the-area/wendell/",
      "zebulon": "/explore-the-area/zebulon/",
      "raleigh": "/explore-the-area/raleigh/",
      "north raleigh": "/explore-the-area/raleigh/",
      "rolesville": "/explore-the-area/rolesville/",
      "wake forest": "/explore-the-area/wake-forest/",
      "youngsville": "/explore-the-area/youngsville/",
      "itb": "/explore-the-area/raleigh/",
      "inside the beltline": "/explore-the-area/raleigh/",
      "raleigh inside the beltline": "/explore-the-area/raleigh/",
      "raleigh (inside the beltline itb)": "/explore-the-area/raleigh/"
    };

    var latestSuburbOrder = [
      "durham",
      "chapel hill",
      "morrisville",
      "cary",
      "apex",
      "holly springs",
      "fuquay varina",
      "garner",
      "clayton",
      "south raleigh",
      "east raleigh",
      "knightdale",
      "wendell",
      "zebulon",
      "raleigh",
      "rolesville",
      "wake forest",
      "youngsville",
      "raleigh"
    ];

    var pointCountRouteMap = {
      "831": "/explore-the-area/durham/",
      "342": "/explore-the-area/chapel-hill/",
      "393": "/explore-the-area/morrisville/",
      "559": "/explore-the-area/cary/",
      "416": "/explore-the-area/apex/",
      "482": "/explore-the-area/holly-springs/",
      "546": "/explore-the-area/fuquay-varina/",
      "486": "/explore-the-area/garner/",
      "426": "/explore-the-area/clayton/",
      "573": "/explore-the-area/south-raleigh/",
      "401": "/explore-the-area/east-raleigh/",
      "499": "/explore-the-area/knightdale/",
      "432": "/explore-the-area/wendell/",
      "349": "/explore-the-area/zebulon/",
      "1169": "/explore-the-area/raleigh/",
      "293": "/explore-the-area/rolesville/",
      "598": "/explore-the-area/wake-forest/",
      "493": "/explore-the-area/youngsville/",
      "423": "/explore-the-area/raleigh/"
    };

    var normalizeSuburbKey = function (value) {
      return String(value || "")
        .toLowerCase()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    };

    var getRegionPointCount = function (region) {
      var path = region.querySelector("path");
      if (!path) {
        return NaN;
      }
      var d = path.getAttribute("d") || "";
      var nums = d.match(/-?\d+(?:\.\d+)?/g);
      if (!nums || !nums.length) {
        return NaN;
      }
      return Math.floor(nums.length / 2);
    };

    var getRouteForRegion = function (region, index) {
      var regionId = String(region.id || "").toLowerCase().trim();
      if (regionId && suburbIdRouteMap[regionId]) {
        return suburbIdRouteMap[regionId];
      }

      var boundaryMatch = regionId.match(/^boundary-(\d+)-/i);
      if (boundaryMatch) {
        var boundaryNumber = Number(boundaryMatch[1]);
        if (boundaryNumber >= 1 && boundaryNumber <= orderedSuburbRoutes.length) {
          return orderedSuburbRoutes[boundaryNumber - 1];
        }
        if (boundaryNumber >= 0 && boundaryNumber < orderedSuburbRoutes.length) {
          return orderedSuburbRoutes[boundaryNumber];
        }
      }

      var dataSuburb = normalizeSuburbKey(region.getAttribute("data-suburb"));
      if (dataSuburb && suburbRouteMap[dataSuburb]) {
        return suburbRouteMap[dataSuburb];
      }

      var pointCount = getRegionPointCount(region);
      if (!Number.isNaN(pointCount) && pointCountRouteMap[String(pointCount)]) {
        return pointCountRouteMap[String(pointCount)];
      }

      if (regionId.indexOf("boundary-") === 0) {
        var boundaryName = normalizeSuburbKey(regionId.replace(/^boundary-\d+-/i, ""));
        if (boundaryName && suburbRouteMap[boundaryName]) {
          return suburbRouteMap[boundaryName];
        }
      }

      if (/^suburb-\d+$/i.test(regionId)) {
        var suburbNumber = Number(regionId.replace(/^suburb-/i, ""));
        var oneBasedName = latestSuburbOrder[suburbNumber - 1];
        if (oneBasedName && suburbRouteMap[oneBasedName]) {
          return suburbRouteMap[oneBasedName];
        }
      }

      if (orderedSuburbRoutes[index]) {
        return orderedSuburbRoutes[index];
      }

      return "";
    };

    var wireSuburbMap = function () {
      var svgDoc = mapObject.contentDocument;
      if (!svgDoc) {
        return;
      }

      var regions = svgDoc.querySelectorAll("g[data-suburb], g[id^='boundary-'], g[id^='suburb-']");
      regions.forEach(function (region, index) {
        var route = getRouteForRegion(region, index);
        if (!route || region.getAttribute("data-route-bound") === "true") {
          return;
        }

        region.setAttribute("tabindex", "0");
        region.setAttribute("role", "link");
        region.style.cursor = "pointer";
        region.style.outline = "none";
        region.style.webkitTapHighlightColor = "transparent";
        region.setAttribute("data-route-bound", "true");

        // Prevent mouse-down focus ring flash before navigation.
        region.addEventListener("mousedown", function (event) {
          event.preventDefault();
        });

        region.addEventListener("click", function (event) {
          event.preventDefault();
          window.location.assign(route);
        });

        region.addEventListener("keydown", function (event) {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            window.location.assign(route);
          }
        });
      });
    };

    mapObject.addEventListener("load", wireSuburbMap);
    if (mapObject.contentDocument) {
      wireSuburbMap();
    }
  }

  var featuredVideosSections = Array.prototype.slice.call(document.querySelectorAll(".home-featured-videos"));
  if (featuredVideosSections.length) {
    featuredVideosSections.forEach(function (featuredVideosSection) {
      var videoGrid = featuredVideosSection.querySelector(".home-video-grid");
      var videoCards = videoGrid ? Array.prototype.slice.call(videoGrid.querySelectorAll(".home-video-card")) : [];
      var pageSize = videoGrid ? Number(videoGrid.getAttribute("data-page-size")) || 8 : 8;
      var pagination = featuredVideosSection.querySelector(".home-video-pagination");
      var watchMoreLink = featuredVideosSection.querySelector(".home-featured-videos-more");

      var videoModal = document.querySelector(".home-video-modal");
      var modalFrame = videoModal ? videoModal.querySelector(".home-video-modal-frame") : null;
      var currentPage = 1;
      var totalPages = Math.max(1, Math.ceil(videoCards.length / pageSize));

      var openVideoModal = function (videoId) {
        if (!videoId) {
          return;
        }
        if (!videoModal || !modalFrame) {
          window.open("https://www.youtube.com/watch?v=" + encodeURIComponent(videoId), "_blank", "noopener,noreferrer");
          return;
        }
        modalFrame.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(videoId) + "?autoplay=1&rel=0&modestbranding=1";
        videoModal.hidden = false;
        videoModal.setAttribute("aria-hidden", "false");
        document.body.classList.add("video-modal-open");
      };

      var closeVideoModal = function () {
        if (!videoModal || !modalFrame) {
          return;
        }
        videoModal.hidden = true;
        videoModal.setAttribute("aria-hidden", "true");
        modalFrame.src = "";
        document.body.classList.remove("video-modal-open");
      };

      var createVideoCard = function (video) {
        var card = document.createElement("button");
        card.type = "button";
        card.className = "home-video-card";
        card.setAttribute("data-video-id", video.video_id);
        card.setAttribute("data-video-title", video.title || "Featured Video");

        var thumb = document.createElement("span");
        thumb.className = "home-video-thumb";

        var img = document.createElement("img");
        img.src = video.thumbnail_url || ("https://i.ytimg.com/vi/" + encodeURIComponent(video.video_id) + "/hqdefault.jpg");
        img.alt = (video.title || "Featured Video") + " thumbnail";
        thumb.appendChild(img);

        var play = document.createElement("span");
        play.className = "home-video-play";
        play.setAttribute("aria-hidden", "true");
        thumb.appendChild(play);

        var meta = document.createElement("span");
        meta.className = "home-video-meta";

        var title = document.createElement("span");
        title.className = "home-video-title";
        title.textContent = video.title || "Featured Video";

        var sub = document.createElement("span");
        sub.className = "home-video-sub";
        sub.textContent = video.subtext || "Thinking about moving to Raleigh, NC...";

        meta.appendChild(title);
        meta.appendChild(sub);
        card.appendChild(thumb);
        card.appendChild(meta);
        return card;
      };

      var normalizeVideoPlayButtons = function () {
        videoCards.forEach(function (card) {
          var thumb = card.querySelector(".home-video-thumb");
          var play = card.querySelector(".home-video-play");
          if (!thumb || !play || play.parentElement === thumb) {
            return;
          }
          thumb.appendChild(play);
        });
      };

      var bindVideoCardEvents = function () {
        videoCards.forEach(function (card) {
          if (card.getAttribute("data-modal-bound") === "true") {
            return;
          }
          card.setAttribute("data-modal-bound", "true");
          card.addEventListener("click", function () {
            openVideoModal(card.getAttribute("data-video-id"));
          });
        });
      };

      var renderPagination = function () {
        if (!pagination) {
          return;
        }
        if (totalPages <= 1) {
          pagination.hidden = true;
          pagination.innerHTML = "";
          return;
        }

        pagination.hidden = false;
        pagination.innerHTML = "";

        var makeButton = function (label, targetPage, isActive, isDisabled) {
          var button = document.createElement("button");
          button.type = "button";
          button.className = "home-video-page-btn" + (isActive ? " is-active" : "");
          button.textContent = label;
          if (isDisabled) {
            button.disabled = true;
          } else {
            button.addEventListener("click", function () {
              renderPage(targetPage);
            });
          }
          return button;
        };

        pagination.appendChild(makeButton("<<", currentPage - 1, false, currentPage === 1));
        for (var page = 1; page <= totalPages; page += 1) {
          pagination.appendChild(makeButton(String(page), page, page === currentPage, false));
        }
        pagination.appendChild(makeButton(">>", currentPage + 1, false, currentPage === totalPages));
      };

      var renderPage = function (page) {
        currentPage = Math.min(totalPages, Math.max(1, Number(page) || 1));
        var start = (currentPage - 1) * pageSize;
        var end = start + pageSize;

        videoCards.forEach(function (card, index) {
          var visible = index >= start && index < end;
          card.hidden = !visible;
        });

        renderPagination();
      };

      var setVideoCards = function (cards) {
        videoCards = cards;
        totalPages = Math.max(1, Math.ceil(videoCards.length / pageSize));
        normalizeVideoPlayButtons();
        bindVideoCardEvents();
        renderPage(1);
      };

      if (videoModal && videoModal.getAttribute("data-modal-bound") !== "true") {
        videoModal.setAttribute("data-modal-bound", "true");
        videoModal.querySelectorAll("[data-video-modal-close]").forEach(function (node) {
          node.addEventListener("click", closeVideoModal);
        });

        document.addEventListener("keydown", function (event) {
          if (event.key === "Escape" && !videoModal.hidden) {
            closeVideoModal();
          }
        });
      }

      setVideoCards(videoCards);

      if (videoGrid && typeof window.fetch === "function") {
        var normalizeFeedKey = function (value) {
          return String(value || "")
            .toLowerCase()
            .replace(/[^a-z0-9-]+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "");
        };

        var buildFeedCandidates = function () {
          var candidates = [];
          var feedKey = normalizeFeedKey(featuredVideosSection.getAttribute("data-video-feed-key"));

          if (feedKey) {
            candidates.push("/assets/data/featured-videos/" + encodeURIComponent(feedKey) + ".json");
          }

          candidates.push("/assets/data/featured-videos.json");
          return candidates.filter(function (url, index, all) {
            return all.indexOf(url) === index;
          });
        };

        var hydrateFromFeed = function (candidates, index) {
          if (index >= candidates.length) {
            // Keep static fallback cards when feed JSON is unavailable.
            return;
          }

          window.fetch(candidates[index] + "?ts=" + String(Date.now()), { cache: "no-store" })
            .then(function (response) {
              if (!response.ok) {
                throw new Error("Unable to load featured videos JSON");
              }
              return response.json();
            })
            .then(function (payload) {
              var videos = payload && Array.isArray(payload.videos) ? payload.videos : [];
              if (!videos.length) {
                hydrateFromFeed(candidates, index + 1);
                return;
              }

              if (watchMoreLink && typeof payload.watch_more_url === "string" && payload.watch_more_url) {
                watchMoreLink.href = payload.watch_more_url;
              }

              videoGrid.innerHTML = "";
              videos.forEach(function (video) {
                if (!video || !video.video_id) {
                  return;
                }
                videoGrid.appendChild(createVideoCard(video));
              });

              var hydratedCards = Array.prototype.slice.call(videoGrid.querySelectorAll(".home-video-card"));
              if (!hydratedCards.length) {
                hydrateFromFeed(candidates, index + 1);
                return;
              }

              setVideoCards(hydratedCards);
            })
            .catch(function () {
              hydrateFromFeed(candidates, index + 1);
            });
        };

        hydrateFromFeed(buildFeedCandidates(), 0);
      }
    });
  }

  var localHighlightsSections = Array.prototype.slice.call(
    document.querySelectorAll(".suburb-local-highlights[data-local-highlights-key]")
  );
  if (localHighlightsSections.length) {
    localHighlightsSections.forEach(function (localHighlightsSection) {
      var feedKey = String(localHighlightsSection.getAttribute("data-local-highlights-key") || "")
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      if (!feedKey) {
        return;
      }

      var feedVersion = String(localHighlightsSection.getAttribute("data-local-highlights-version") || "").trim();
      var grid = localHighlightsSection.querySelector("[data-local-highlights-grid]");
      var filter = localHighlightsSection.querySelector("[data-local-highlights-filter]");
      var filterWrap = localHighlightsSection.querySelector(".suburb-local-highlights-filter-wrap");
      var filterIconNode = localHighlightsSection.querySelector("[data-local-highlights-filter-icon]");
      var scriptNode = localHighlightsSection.querySelector(".suburb-local-highlights-script");
      var titleNode = localHighlightsSection.querySelector(".suburb-local-highlights-copy h2");
      var fallbackImage = "/assets/images/home/services-learning-center.jpg?v=20260316-services2";
      if (!grid || !filter) {
        return;
      }

      var normalizeCategoryKey = function (value) {
        return String(value || "")
          .toLowerCase()
          .replace(/[^a-z0-9-]+/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "");
      };

      var categoryIconMap = {
        dining: "\u{1F37D}",
        bars: "\u{1F378}",
        coffee: "\u2615",
        explore: "\u{1F9ED}",
        shopping: "\u{1F6CD}",
        fitness: "\u{1F4AA}"
      };

      var getCategoryIcon = function (key) {
        return categoryIconMap[normalizeCategoryKey(key)] || "\u{1F4CD}";
      };

      var setFilterIcon = function (key) {
        var normalizedKey = normalizeCategoryKey(key);
        if (filterWrap) {
          filterWrap.setAttribute("data-local-highlights-active", normalizedKey || "dining");
        }
        if (filterIconNode) {
          filterIconNode.textContent = getCategoryIcon(normalizedKey);
        }
      };

      var getCategoryLabel = function (categories, key) {
        if (!Array.isArray(categories)) {
          return "";
        }
        for (var i = 0; i < categories.length; i += 1) {
          var category = categories[i];
          if (normalizeCategoryKey(category && category.key) === key) {
            return String(category && category.label || "").trim();
          }
        }
        return "";
      };

      var createEmptyState = function (categoryLabel) {
        var emptyNode = document.createElement("div");
        emptyNode.className = "suburb-local-highlights-empty";
        emptyNode.textContent = "Highlights for " + categoryLabel + " are coming soon.";
        return emptyNode;
      };

      var createCard = function (item, categoryLabel) {
        var card = document.createElement("a");
        card.className = "suburb-local-highlights-card";

        var mapsUrl = String(item && item.maps_url || "").trim();
        if (mapsUrl) {
          card.href = mapsUrl;
          card.target = "_blank";
          card.rel = "noopener noreferrer";
        } else {
          card.href = "#";
        }

        var imageUrl = String(item && item.image_url || "").trim() || fallbackImage;
        card.style.setProperty("--suburb-local-highlight-image", "url(\"" + imageUrl.replace(/"/g, "%22") + "\")");
        card.setAttribute("aria-label", String(item && item.name || "Local Highlight") + " in " + categoryLabel);

        var content = document.createElement("span");
        content.className = "suburb-local-highlights-card-content";

        var title = document.createElement("p");
        title.className = "suburb-local-highlights-card-name";
        title.textContent = String(item && item.name || "Local Highlight");

        var tagline = document.createElement("p");
        tagline.className = "suburb-local-highlights-card-tagline";
        tagline.textContent = String(item && item.tagline || "Local favorite");

        var meta = document.createElement("span");
        meta.className = "suburb-local-highlights-card-meta";

        var ratingCopy = String(item && item.rating_text || "").trim();
        if (ratingCopy) {
          var rating = document.createElement("p");
          rating.className = "suburb-local-highlights-card-rating";

          var stars = document.createElement("span");
          stars.className = "suburb-local-highlights-card-stars";
          stars.setAttribute("aria-hidden", "true");
          stars.textContent = "\u2605\u2605\u2605\u2605\u2605";

          var ratingText = document.createElement("span");
          ratingText.textContent = ratingCopy;

          rating.appendChild(stars);
          rating.appendChild(ratingText);
          meta.appendChild(rating);
        }

        var reviewsCopy = String(item && item.reviews_text || "").trim();
        if (reviewsCopy) {
          var reviews = document.createElement("p");
          reviews.className = "suburb-local-highlights-card-reviews";
          reviews.textContent = reviewsCopy;
          meta.appendChild(reviews);
        }

        content.appendChild(title);
        content.appendChild(tagline);
        if (meta.childElementCount) {
          content.appendChild(meta);
        }
        card.appendChild(content);
        return card;
      };

      var renderCategory = function (payload, categoryKey) {
        var normalizedKey = normalizeCategoryKey(categoryKey);
        var categories = Array.isArray(payload && payload.categories) ? payload.categories : [];
        var itemsMap = payload && typeof payload.items === "object" ? payload.items : {};
        var categoryItems = Array.isArray(itemsMap[normalizedKey]) ? itemsMap[normalizedKey].slice(0, 4) : [];
        var categoryLabel = getCategoryLabel(categories, normalizedKey) || "this category";

        grid.innerHTML = "";
        if (!categoryItems.length) {
          grid.appendChild(createEmptyState(categoryLabel));
          return;
        }

        categoryItems.forEach(function (item) {
          grid.appendChild(createCard(item, categoryLabel));
        });
      };

      var setFilterOptions = function (payload) {
        var categories = Array.isArray(payload && payload.categories) ? payload.categories : [];
        var previousValue = normalizeCategoryKey(filter.value);

        if (categories.length) {
          filter.innerHTML = "";
          categories.forEach(function (category) {
            var key = normalizeCategoryKey(category && category.key);
            if (!key) {
              return;
            }
            var option = document.createElement("option");
            option.value = key;
            option.textContent = getCategoryIcon(key) + " " + String(category && category.label || key);
            filter.appendChild(option);
          });
        }

        if (previousValue) {
          filter.value = previousValue;
        }
        if (!filter.value && filter.options.length) {
          filter.value = filter.options[0].value;
        }
      };

      if (typeof window.fetch !== "function") {
        grid.innerHTML = "";
        grid.appendChild(createEmptyState("this area"));
        return;
      }

      var feedPath = "/assets/data/local-highlights/" + encodeURIComponent(feedKey) + ".json";
      if (feedVersion) {
        feedPath += "?v=" + encodeURIComponent(feedVersion);
      }

      window.fetch(feedPath, { cache: "no-store" })
        .then(function (response) {
          if (!response.ok) {
            throw new Error("Unable to load local highlights JSON");
          }
          return response.json();
        })
        .then(function (payload) {
          if (!payload || typeof payload !== "object") {
            throw new Error("Invalid local highlights payload");
          }

          if (scriptNode && typeof payload.suburb_label === "string" && payload.suburb_label.trim()) {
            scriptNode.textContent = payload.suburb_label.trim();
          }
          if (titleNode && typeof payload.title === "string" && payload.title.trim()) {
            titleNode.textContent = payload.title.trim();
          }

          setFilterOptions(payload);
          var initialCategory = normalizeCategoryKey(payload.default_category || filter.value);
          if (initialCategory) {
            filter.value = initialCategory;
          }
          setFilterIcon(filter.value);
          renderCategory(payload, filter.value);

          if (filter.getAttribute("data-local-highlights-bound") !== "true") {
            filter.setAttribute("data-local-highlights-bound", "true");
            filter.addEventListener("change", function () {
              setFilterIcon(filter.value);
              renderCategory(payload, filter.value);
            });
          }
        })
        .catch(function () {
          grid.innerHTML = "";
          grid.appendChild(createEmptyState("this area"));
        });
    });
  }

  (function () {
    var localStore = null;
    var sessionStore = null;
    try {
      localStore = window.localStorage;
    } catch (error) {
      localStore = null;
    }
    try {
      sessionStore = window.sessionStorage;
    } catch (error) {
      sessionStore = null;
    }

    var currentPath = String(window.location.pathname || "/").toLowerCase();
    var canonicalPath = currentPath.replace(/\/index\.html$/, "/");
    if (canonicalPath.charAt(canonicalPath.length - 1) !== "/") {
      canonicalPath += "/";
    }
    var isExcludedPopupPage = canonicalPath.indexOf("/consult/") === 0 || canonicalPath.indexOf("/2026/") === 0;
    if (isExcludedPopupPage) {
      return;
    }
    var isHomePage = Boolean(document.body && document.body.classList.contains("page-home"));
    var isBuyPage = Boolean(document.body && document.body.classList.contains("page-buy"));
    var isSellPage = Boolean(document.body && document.body.classList.contains("page-sell"));
    var popupLeadType = isSellPage ? "seller" : "buyer";
    var inlinePopupSlot = (isBuyPage || isSellPage) ? document.querySelector("[data-inline-lead-popup]") : null;
    var useInlinePopup = Boolean(inlinePopupSlot);
    var popupStepKeys = isSellPage
      ? ["timeline_selling", "estimated_value", "home_details", "full_address", "contact"]
      : ["timeframe_buying", "budget", "pre_approval", "area_interest", "contact"];
    var getPopupStepKey = function (stepIndex) {
      return popupStepKeys[stepIndex] || ("step_" + String(stepIndex + 1));
    };
    var trackPopupEvent = function (eventName, properties) {
      var eventProperties = {
        popup_lead_type: popupLeadType,
        popup_variant: useInlinePopup ? "inline" : "timed_modal"
      };
      if (properties && typeof properties === "object") {
        Object.keys(properties).forEach(function (key) {
          eventProperties[key] = properties[key];
        });
      }
      trackAnalyticsEvent(eventName, eventProperties);
    };
    var markPopupTouched = function (source) {
      markAnalyticsPopupInteraction(source || "lead_popup");
    };

    var safeGet = function (storage, key) {
      if (!storage) {
        return "";
      }
      try {
        return storage.getItem(key) || "";
      } catch (error) {
        return "";
      }
    };

    var safeSet = function (storage, key, value) {
      if (!storage) {
        return;
      }
      try {
        storage.setItem(key, value);
      } catch (error) {}
    };

    var safeRemove = function (storage, key) {
      if (!storage) {
        return;
      }
      try {
        storage.removeItem(key);
      } catch (error) {}
    };

    var leadPopupSubmittedKey = "livrLeadPopupSubmitted";
    var leadPopupSessionStartKey = "livrLeadPopupSessionStart";
    var leadPopupNextShowKey = "livrLeadPopupNextShowAt";
    var leadPopupInitialDelayMs = 10 * 1000;
    var leadPopupReopenDelayMs = 30 * 60 * 1000;
    var leadPopupBookingUrl = "https://calendar.google.com/calendar/appointments/schedules/AcZssZ1iKo2BT73sNnkfTzQy7iYu1gq-xy0FTcN4j-2glbDsM3UUhLHtEHsGnj-bHC19EFVGO4VdCX5g?gv=true";
    var leadPopupAppsScriptUrl = "https://script.google.com/macros/s/AKfycbwnqkPb6Nkp9owlDv_orcAId7cNHbKuQrf5ENMW4BvbUuaLFNHP-yANDdSwQ6Vjl41v/exec";
    var hasSubmitted = safeGet(localStore, leadPopupSubmittedKey) === "true";
    var stepOneHeading = isSellPage ? "WHAT IS YOUR IDEAL TIMELINE FOR SELLING?*" : "WHAT IS YOUR IDEAL TIMEFRAME TO BUY?*";
    var stepTwoHeading = isSellPage ? "WHAT DO YOU THINK YOUR HOUSE IS WORTH?*" : "WHAT IS YOUR BUDGET?*";
    var stepThreeHeading = isSellPage ? "TELL A BIT ABOUT YOUR HOME." : "DO YOU HAVE A PRE-APPROVAL LETTER?*";
    var stepFourHeading = isSellPage ? "FULL ADDRESS*" : "AREA INTEREST(S)*";
    var stepOneOptions = isSellPage ? [
      { value: "As Soon As Possible" },
      { value: "1-3 Months" },
      { value: "3-6 Months" },
      { value: "6-12 Months" },
      { value: "12+ Months" }
    ] : [
      { value: "1-3 Months" },
      { value: "3-6 Months" },
      { value: "6-9 Months" },
      { value: "9-12 Months" },
      { value: "12+ Months" }
    ];
    var stepTwoOptions = isSellPage ? [
      { value: "Under $300K" },
      { value: "$300K-$500K" },
      { value: "$500K-$750K" },
      { value: "$750K-$1M" },
      { value: "$1M+" }
    ] : [
      { value: "$0-500K" },
      { value: "$350K-500K" },
      { value: "$500K-750K" },
      { value: "$750K-1M" },
      { value: "$1M+" }
    ];
    var stepThreeMarkup = isSellPage ? [
      "<div class='lead-popup-sell-example-list' aria-hidden='true'>",
      "<p># OF BEDROOMS</p>",
      "<p># OF BATHROOMS</p>",
      "<p>YEAR BUILT</p>",
      "<p>SQUARE FOOTAGE</p>",
      "</div>",
      "<div class='lead-popup-area-wrap'>",
      "<textarea class='lead-popup-area-textarea' data-lead-input='homeDescription' placeholder='Type your answer here...' rows='5'></textarea>",
      "</div>",
      "<div class='lead-popup-step-actions'><button type='button' class='lead-popup-button' data-lead-action='next'>OK</button></div>"
    ].join("") : "<div class='lead-popup-pill-group' data-lead-pill-group='preApproval'></div>";
    var stepFourMarkup = isSellPage ? [
      "<div class='lead-popup-contact-grid'>",
      "<label class='lead-popup-field'>",
      "<span class='lead-popup-field-label'>Street Address*</span>",
      "<input type='text' class='lead-popup-field-input' data-lead-input='addressStreet' placeholder='123 Main St' autocomplete='street-address'>",
      "</label>",
      "<label class='lead-popup-field'>",
      "<span class='lead-popup-field-label'>City*</span>",
      "<input type='text' class='lead-popup-field-input' data-lead-input='addressCity' placeholder='Raleigh' autocomplete='address-level2'>",
      "</label>",
      "<label class='lead-popup-field'>",
      "<span class='lead-popup-field-label'>State*</span>",
      "<input type='text' class='lead-popup-field-input' data-lead-input='addressState' placeholder='NC' autocomplete='address-level1'>",
      "</label>",
      "<label class='lead-popup-field'>",
      "<span class='lead-popup-field-label'>ZIP Code*</span>",
      "<input type='text' class='lead-popup-field-input' data-lead-input='addressZip' placeholder='27601' autocomplete='postal-code' inputmode='numeric'>",
      "</label>",
      "</div>",
      "<div class='lead-popup-step-actions'><button type='button' class='lead-popup-button' data-lead-action='next'>OK</button></div>"
    ].join("") : [
      "<div class='lead-popup-area-wrap'>",
      "<input type='text' class='lead-popup-area-input' data-lead-input='areaInterests' placeholder='Type your answer here...' autocomplete='off'>",
      "</div>",
      "<div class='lead-popup-step-actions'><button type='button' class='lead-popup-button' data-lead-action='next'>OK</button></div>"
    ].join("");

    var popupHost = document.createElement("div");
    popupHost.className = "lead-popup-modal";
    popupHost.hidden = true;
    popupHost.setAttribute("aria-hidden", "true");
    popupHost.innerHTML = [
      "<div class='lead-popup-modal-backdrop' data-lead-popup-close></div>",
      "<div class='lead-popup-modal-dialog' role='dialog' aria-modal='true' aria-label='Relocation consultation form'>",
      "<button type='button' class='lead-popup-close' data-lead-popup-close aria-label='Close popup'>&times;</button>",
      "<section class='lead-popup-screen lead-popup-screen--intro is-active' data-lead-screen='intro'>",
      "<div class='lead-popup-intro-media'>",
      "<img src='/assets/images/home/local-area-bottom-left.png?v=20260312-bottomleft1' alt='The Official Living in Raleigh NC Team'>",
      "</div>",
      "<div class='lead-popup-intro-content'>",
      "<h2>Ready to take the next step?</h2>",
      "<button type='button' class='lead-popup-button' data-lead-action='start'>Let's Get Started</button>",
      "<p class='lead-popup-intro-time'>&#9716; Takes 1 Minute</p>",
      "</div>",
      "</section>",
      "<section class='lead-popup-screen lead-popup-screen--form' data-lead-screen='form'>",
      "<div class='lead-popup-progress'><span class='lead-popup-progress-fill' data-lead-progress-fill></span></div>",
      "<div class='lead-popup-form-body'>",
      "<section class='lead-popup-step is-active' data-step-index='0'>",
      "<h3 class='lead-popup-step-heading'><span class='lead-popup-step-badge'>1</span> " + stepOneHeading + "</h3>",
      "<div class='lead-popup-choice-grid' data-lead-choice-grid='timeframe'></div>",
      "<p class='lead-popup-step-error' data-lead-step-error></p>",
      "</section>",
      "<section class='lead-popup-step' data-step-index='1'>",
      "<h3 class='lead-popup-step-heading'><span class='lead-popup-step-badge'>2</span> " + stepTwoHeading + "</h3>",
      "<div class='lead-popup-choice-grid' data-lead-choice-grid='budget'></div>",
      "<p class='lead-popup-step-error' data-lead-step-error></p>",
      "</section>",
      "<section class='lead-popup-step' data-step-index='2'>",
      "<h3 class='lead-popup-step-heading'><span class='lead-popup-step-badge'>3</span> " + stepThreeHeading + "</h3>",
      stepThreeMarkup,
      "<p class='lead-popup-step-error' data-lead-step-error></p>",
      "</section>",
      "<section class='lead-popup-step' data-step-index='3'>",
      "<h3 class='lead-popup-step-heading'><span class='lead-popup-step-badge'>4</span> " + stepFourHeading + "</h3>",
      stepFourMarkup,
      "<p class='lead-popup-step-error' data-lead-step-error></p>",
      "</section>",
      "<section class='lead-popup-step' data-step-index='4'>",
      "<h3 class='lead-popup-step-heading'><span class='lead-popup-step-badge'>5</span> HOW CAN I GET IN TOUCH?*</h3>",
      "<div class='lead-popup-contact-grid'>",
      "<label class='lead-popup-field'>",
      "<span class='lead-popup-field-label'>First Name*</span>",
      "<input type='text' class='lead-popup-field-input' data-lead-input='firstName' placeholder='Jane' autocomplete='given-name'>",
      "</label>",
      "<label class='lead-popup-field'>",
      "<span class='lead-popup-field-label'>Last Name*</span>",
      "<input type='text' class='lead-popup-field-input' data-lead-input='lastName' placeholder='Smith' autocomplete='family-name'>",
      "</label>",
      "<label class='lead-popup-field'>",
      "<span class='lead-popup-field-label'>Phone Number*</span>",
      "<span class='lead-popup-phone-row'>",
      "<select class='lead-popup-country-code' data-lead-input='phoneCountry' aria-label='Phone country code'>",
      "<option value='+1'>+1</option>",
      "<option value='+44'>+44</option>",
      "<option value='+61'>+61</option>",
      "</select>",
      "<input type='tel' class='lead-popup-field-input' data-lead-input='phone' placeholder='(201) 555-0123' autocomplete='tel'>",
      "</span>",
      "</label>",
      "<label class='lead-popup-field'>",
      "<span class='lead-popup-field-label'>Email*</span>",
      "<input type='email' class='lead-popup-field-input' data-lead-input='email' placeholder='name@example.com' autocomplete='email'>",
      "</label>",
      "</div>",
      "<div class='lead-popup-consent-copy'>",
      "<label class='lead-popup-consent-checkbox'>",
      "<input type='checkbox' data-lead-input='smsOptIn'>",
      "<span>" + smsConsentDisclosureText + "</span>",
      "</label>",
      "</div>",
      "<div class='lead-popup-step-actions'>",
      "<button type='button' class='lead-popup-button' data-lead-action='submit'>Submit</button>",
      "<span class='lead-popup-step-submit-note'>Press Enter</span>",
      "</div>",
      "<div class='lead-popup-consent-meta'>",
      "<p class='lead-popup-consent-note'>" + smsConsentOptionalNoteText + "</p>",
      "<p class='lead-popup-consent-links'>Review our <a href='/privacy-policy/' target='_blank' rel='noopener noreferrer'>Privacy Policy</a> and <a href='/terms-of-service/' target='_blank' rel='noopener noreferrer'>Terms of Service</a>.</p>",
      "</div>",
      "<p class='lead-popup-step-error' data-lead-step-error></p>",
      "</section>",
      "</div>",
      "<div class='lead-popup-corner-nav' data-lead-corner-nav>",
      "<button type='button' class='lead-popup-corner-btn' data-lead-nav='prev' aria-label='Previous step'>&darr;</button>",
      "<button type='button' class='lead-popup-corner-btn' data-lead-nav='next' aria-label='Next step'>&uarr;</button>",
      "</div>",
      "</section>",
      "<section class='lead-popup-screen lead-popup-screen--thanks' data-lead-screen='thanks'>",
      "<div class='lead-popup-thanks-copy'>",
      "<h3>We will be reaching out shortly. Please consider booking a zoom consultation or phone call at a day/time that is most convenient for you!</h3>",
      "</div>",
      "<div class='lead-popup-booking-shell'>",
      "<div class='lead-popup-booking-head'>Pick a time below. You'll get an instant confirmation email plus a calendar invite.</div>",
      "<div class='lead-popup-booking-frame-wrap'>",
      "<iframe class='lead-popup-booking-frame' src='" + leadPopupBookingUrl + "' title='Google Calendar appointment scheduling' loading='lazy' allow='camera; microphone; fullscreen'></iframe>",
      "</div>",
      "</div>",
      "</section>",
      "</div>"
    ].join("");
    if (useInlinePopup && inlinePopupSlot) {
      popupHost.classList.add("lead-popup-modal--inline");
      popupHost.hidden = false;
      popupHost.setAttribute("aria-hidden", "false");
      inlinePopupSlot.appendChild(popupHost);
    } else {
      document.body.appendChild(popupHost);
    }

    trackPopupEvent("popup_instance_ready", {
      popup_render_mode: useInlinePopup ? "inline" : "overlay",
      popup_previously_submitted: hasSubmitted
    });

    var devTrigger = null;
    var popupDevMode = false;
    try {
      popupDevMode = (new URLSearchParams(window.location.search || "")).get("popup_dev") === "1";
    } catch (error) {
      popupDevMode = false;
    }

    if (popupDevMode && isHomePage && !useInlinePopup) {
      devTrigger = document.createElement("button");
      devTrigger.type = "button";
      devTrigger.className = "lead-popup-dev-trigger";
      devTrigger.textContent = "DEV: OPEN POPUP";
      devTrigger.setAttribute("aria-label", "Developer popup trigger");
      document.body.appendChild(devTrigger);
    }

    var calendarIcon = [
      "<svg viewBox='0 0 24 24' aria-hidden='true' focusable='false'>",
      "<rect x='3' y='5' width='18' height='16' rx='2' ry='2' fill='none' stroke='currentColor' stroke-width='1.6'/>",
      "<line x1='3' y1='9' x2='21' y2='9' stroke='currentColor' stroke-width='1.6'/>",
      "<line x1='8' y1='3' x2='8' y2='7' stroke='currentColor' stroke-width='1.6'/>",
      "<line x1='16' y1='3' x2='16' y2='7' stroke='currentColor' stroke-width='1.6'/>",
      "<circle cx='12' cy='15' r='3.7' fill='none' stroke='currentColor' stroke-width='1.4'/>",
      "<line x1='12' y1='15' x2='12' y2='12.8' stroke='currentColor' stroke-width='1.4'/>",
      "<line x1='12' y1='15' x2='13.8' y2='16.1' stroke='currentColor' stroke-width='1.4'/>",
      "</svg>"
    ].join("");

    var budgetIcon = [
      "<svg viewBox='0 0 24 24' aria-hidden='true' focusable='false'>",
      "<path d='M5 9h14a1 1 0 0 1 1 1v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a1 1 0 0 1 1-1z' fill='none' stroke='currentColor' stroke-width='1.6'/>",
      "<path d='M8 9V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v3' fill='none' stroke='currentColor' stroke-width='1.6'/>",
      "<line x1='4' y1='12' x2='20' y2='12' stroke='currentColor' stroke-width='1.6'/>",
      "<circle cx='12' cy='15.4' r='1.5' fill='none' stroke='currentColor' stroke-width='1.2'/>",
      "</svg>"
    ].join("");

    var renderChoiceCards = function (grid, fieldName, options, iconMarkup) {
      if (!grid) {
        return;
      }
      options.forEach(function (option) {
        var card = document.createElement("button");
        card.type = "button";
        card.className = "lead-popup-choice-card";
        card.setAttribute("data-lead-field", fieldName);
        card.setAttribute("data-lead-value", option.value);
        card.innerHTML = [
          "<span class='lead-popup-choice-card-face'>",
          "<span class='lead-popup-choice-icon'>",
          iconMarkup,
          "</span>",
          "<span class='lead-popup-choice-card-title'>",
          option.value,
          "</span>",
          "</span>"
        ].join("");
        grid.appendChild(card);
      });
    };

    var renderPillOptions = function (group, fieldName, options) {
      if (!group) {
        return;
      }
      options.forEach(function (option) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "lead-popup-pill-option";
        button.setAttribute("data-lead-field", fieldName);
        button.setAttribute("data-lead-value", option.value);
        button.textContent = option.value;
        group.appendChild(button);
      });
    };

    renderChoiceCards(
      popupHost.querySelector("[data-lead-choice-grid='timeframe']"),
      "timeframe",
      stepOneOptions,
      calendarIcon
    );

    renderChoiceCards(
      popupHost.querySelector("[data-lead-choice-grid='budget']"),
      "budget",
      stepTwoOptions,
      budgetIcon
    );

    if (!isSellPage) {
      renderPillOptions(
        popupHost.querySelector("[data-lead-pill-group='preApproval']"),
        "preApproval",
        [
          { value: "Yes in hand!" },
          { value: "Not yet, but spoken with a lender" },
          { value: "Not yet, please refer me to a trusted lender" },
          { value: "Cash buyer" }
        ]
      );
    }

    var screens = {
      intro: popupHost.querySelector("[data-lead-screen='intro']"),
      form: popupHost.querySelector("[data-lead-screen='form']"),
      thanks: popupHost.querySelector("[data-lead-screen='thanks']")
    };
    var steps = Array.prototype.slice.call(popupHost.querySelectorAll(".lead-popup-step"));
    var stepErrors = Array.prototype.slice.call(popupHost.querySelectorAll("[data-lead-step-error]"));
    var progressFill = popupHost.querySelector("[data-lead-progress-fill]");
    var cornerNav = popupHost.querySelector("[data-lead-corner-nav]");
    var navPrev = popupHost.querySelector("[data-lead-nav='prev']");
    var navNext = popupHost.querySelector("[data-lead-nav='next']");
    var startButton = popupHost.querySelector("[data-lead-action='start']");
    var formInputs = {
      areaInterests: popupHost.querySelector("[data-lead-input='areaInterests']"),
      homeDescription: popupHost.querySelector("[data-lead-input='homeDescription']"),
      addressStreet: popupHost.querySelector("[data-lead-input='addressStreet']"),
      addressCity: popupHost.querySelector("[data-lead-input='addressCity']"),
      addressState: popupHost.querySelector("[data-lead-input='addressState']"),
      addressZip: popupHost.querySelector("[data-lead-input='addressZip']"),
      firstName: popupHost.querySelector("[data-lead-input='firstName']"),
      lastName: popupHost.querySelector("[data-lead-input='lastName']"),
      phoneCountry: popupHost.querySelector("[data-lead-input='phoneCountry']"),
      phone: popupHost.querySelector("[data-lead-input='phone']"),
      email: popupHost.querySelector("[data-lead-input='email']"),
      smsOptIn: popupHost.querySelector("[data-lead-input='smsOptIn']")
    };
    var timeoutId = 0;
    var currentScreen = "intro";
    var currentStep = 0;
    var popupOpenSource = useInlinePopup ? "inline_embed" : "timed_delay";
    var lastTrackedStepViewKey = "";
    var hasStartedForm = false;
    var submitInFlight = false;
    var formState = {
      timeframe: "",
      budget: "",
      preApproval: "",
      areaInterests: "",
      homeDescription: "",
      addressStreet: "",
      addressCity: "",
      addressState: "",
      addressZip: "",
      firstName: "",
      lastName: "",
      phoneCountry: "+1",
      phone: "",
      email: "",
      smsOptIn: false
    };
    var stepInputStarted = {};

    var trackStepInputStart = function (fieldName) {
      var key = String(currentStep) + ":" + String(fieldName || "input");
      if (stepInputStarted[key]) {
        return;
      }
      stepInputStarted[key] = true;
      markPopupTouched("text_input");
      trackPopupEvent("popup_step_input_started", {
        step_number: currentStep + 1,
        step_key: getPopupStepKey(currentStep),
        field_name: fieldName || ""
      });
    };

    var setSessionStart = function () {
      var now = Date.now();
      var value = Number(safeGet(sessionStore, leadPopupSessionStartKey));
      if (!value || value > now) {
        safeSet(sessionStore, leadPopupSessionStartKey, String(now));
        return now;
      }
      return value;
    };

    var ensureNextShowAt = function () {
      var sessionStart = setSessionStart();
      var storedNext = Number(safeGet(sessionStore, leadPopupNextShowKey));
      if (storedNext && storedNext >= sessionStart) {
        return storedNext;
      }
      var nextShowAt = sessionStart + leadPopupInitialDelayMs;
      safeSet(sessionStore, leadPopupNextShowKey, String(nextShowAt));
      return nextShowAt;
    };

    var setNextShowAt = function (value) {
      safeSet(sessionStore, leadPopupNextShowKey, String(value));
    };

    var clearTimer = function () {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
        timeoutId = 0;
      }
    };

    var showScreen = function (screenName) {
      var previousScreen = currentScreen;
      currentScreen = screenName;
      Object.keys(screens).forEach(function (key) {
        screens[key].classList.toggle("is-active", key === screenName);
      });
      if (cornerNav) {
        cornerNav.hidden = screenName !== "form";
      }
      if (previousScreen !== screenName) {
        trackPopupEvent("popup_screen_viewed", {
          popup_screen: screenName,
          step_number: screenName === "form" ? currentStep + 1 : 0
        });
      }
    };

    var clearStepError = function (stepIndex) {
      var errorNode = stepErrors[stepIndex];
      if (errorNode) {
        errorNode.textContent = "";
      }
    };

    var showStepError = function (stepIndex, message) {
      var errorNode = stepErrors[stepIndex];
      if (errorNode) {
        errorNode.textContent = message;
      }
      if (message) {
        trackPopupEvent("popup_step_validation_error", {
          step_number: stepIndex + 1,
          step_key: getPopupStepKey(stepIndex),
          error_message: message
        });
      }
    };

    var normalizeValue = function (value) {
      return String(value || "").replace(/\s+/g, " ").trim();
    };

    var validateEmail = function (value) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    };

    var stripNonDigits = function (value) {
      return String(value || "").replace(/[^\d]/g, "");
    };

    var isStepReadyForNext = function (stepIndex) {
      if (stepIndex === 0) {
        return Boolean(normalizeValue(formState.timeframe));
      }
      if (stepIndex === 1) {
        return Boolean(normalizeValue(formState.budget));
      }
      if (stepIndex === 2) {
        if (!isSellPage) {
          return Boolean(normalizeValue(formState.preApproval));
        }
        return Boolean(normalizeValue(formInputs.homeDescription && formInputs.homeDescription.value));
      }
      if (stepIndex === 3) {
        if (!isSellPage) {
          return Boolean(normalizeValue(formInputs.areaInterests && formInputs.areaInterests.value));
        }
        return Boolean(
          normalizeValue(formInputs.addressStreet && formInputs.addressStreet.value) &&
          normalizeValue(formInputs.addressCity && formInputs.addressCity.value) &&
          normalizeValue(formInputs.addressState && formInputs.addressState.value) &&
          normalizeValue(formInputs.addressZip && formInputs.addressZip.value)
        );
      }
      return true;
    };

    var updateNavState = function () {
      if (navPrev) {
        navPrev.disabled = currentStep === 0;
      }
      if (!navNext) {
        return;
      }
      if (currentStep === steps.length - 1) {
        navNext.textContent = "\u2713";
        navNext.disabled = false;
        return;
      }
      navNext.textContent = "\u2191";
      navNext.disabled = !isStepReadyForNext(currentStep);
    };

    var setStep = function (stepIndex) {
      currentStep = Math.max(0, Math.min(steps.length - 1, stepIndex));
      steps.forEach(function (stepNode, index) {
        stepNode.classList.toggle("is-active", index === currentStep);
      });

      if (progressFill) {
        progressFill.style.width = String(((currentStep + 1) / steps.length) * 100) + "%";
      }

      clearStepError(currentStep);
      updateNavState();
      if (currentScreen === "form" || hasStartedForm) {
        var stepViewKey = [currentScreen, currentStep, hasStartedForm ? "started" : "not_started"].join(":");
        if (stepViewKey !== lastTrackedStepViewKey) {
          lastTrackedStepViewKey = stepViewKey;
          trackPopupEvent("popup_step_viewed", {
            step_number: currentStep + 1,
            step_key: getPopupStepKey(currentStep),
            progress_percent: Math.round(((currentStep + 1) / steps.length) * 100)
          });
        }
      }
    };

    var syncSelectionUI = function () {
      popupHost.querySelectorAll("[data-lead-field]").forEach(function (optionNode) {
        var field = optionNode.getAttribute("data-lead-field");
        var value = optionNode.getAttribute("data-lead-value");
        var isSelected = formState[field] === value;
        optionNode.classList.toggle("is-selected", Boolean(isSelected));
      });
    };

    var playChoiceClickAnimation = function (node) {
      if (!node || !node.classList || !node.classList.contains("lead-popup-choice-card")) {
        return;
      }
      node.classList.remove("is-clicked");
      // Force restart for repeat clicks.
      node.offsetWidth;
      node.classList.add("is-clicked");
      window.setTimeout(function () {
        node.classList.remove("is-clicked");
      }, 220);
    };

    var openPopup = function (forceOpen, openSource) {
      if ((!forceOpen && hasSubmitted) || !popupHost.hidden) {
        return;
      }
      popupOpenSource = openSource || (forceOpen ? "manual" : "timed_delay");
      clearTimer();
      popupHost.hidden = false;
      popupHost.setAttribute("aria-hidden", "false");
      document.body.classList.add("lead-popup-open");
      viewportScrollLock.lock();
      lastTrackedStepViewKey = "";

      if (forceOpen) {
        hasStartedForm = false;
        setStep(0);
      }

      if (hasStartedForm) {
        showScreen("form");
        setStep(currentStep);
      } else {
        showScreen("intro");
      }

      trackPopupEvent("popup_impression", {
        popup_open_source: popupOpenSource,
        popup_screen: currentScreen,
        step_number: currentScreen === "form" ? currentStep + 1 : 0
      });

      window.requestAnimationFrame(function () {
        if (currentScreen === "intro" && startButton) {
          startButton.focus();
          return;
        }
        var activeStep = steps[currentStep];
        if (!activeStep) {
          return;
        }
        var autoFocusTarget = activeStep.querySelector(".is-selected, input, select, button");
        if (autoFocusTarget) {
          autoFocusTarget.focus();
        }
      });
    };

    var schedulePopup = function () {
      if (hasSubmitted) {
        return;
      }
      clearTimer();
      var nextShowAt = ensureNextShowAt();
      var delay = Math.max(0, nextShowAt - Date.now());
      timeoutId = window.setTimeout(function () {
        openPopup(false, "timed_delay");
      }, delay);
    };

    var closePopup = function (reschedule, closeReason) {
      if (popupHost.hidden) {
        return;
      }
      trackPopupEvent("popup_closed", {
        popup_screen: currentScreen,
        step_number: currentScreen === "form" ? currentStep + 1 : 0,
        close_reason: closeReason || "unknown",
        rescheduled: !hasSubmitted && reschedule !== false
      });
      popupHost.hidden = true;
      popupHost.setAttribute("aria-hidden", "true");
      document.body.classList.remove("lead-popup-open");
      viewportScrollLock.unlock();
      if (!hasSubmitted && reschedule !== false) {
        setNextShowAt(Date.now() + leadPopupReopenDelayMs);
        schedulePopup();
      }
    };

    var toPayload = function () {
      var phoneCountry = normalizeValue(formState.phoneCountry) || "+1";
      var phone = normalizeValue(formState.phone);
      var addressStreet = normalizeValue(formState.addressStreet);
      var addressCity = normalizeValue(formState.addressCity);
      var addressState = normalizeValue(formState.addressState);
      var addressZip = normalizeValue(formState.addressZip);
      var fullAddress = [addressStreet, addressCity, addressState, addressZip].filter(Boolean).join(", ");
      return {
        submitted_at: new Date().toISOString(),
        source_page: window.location.href,
        lead_type: popupLeadType,
        timeframe: normalizeValue(formState.timeframe),
        budget: normalizeValue(formState.budget),
        pre_approval: normalizeValue(formState.preApproval),
        area_interests: normalizeValue(formState.areaInterests),
        home_description: normalizeValue(formState.homeDescription),
        home_bedrooms: normalizeValue(formState.homeBedrooms),
        home_bathrooms: normalizeValue(formState.homeBathrooms),
        year_built: normalizeValue(formState.yearBuilt),
        square_footage: normalizeValue(formState.squareFootage),
        property_address_line1: addressStreet,
        property_city: addressCity,
        property_state: addressState,
        property_zip: addressZip,
        full_address: fullAddress,
        first_name: normalizeValue(formState.firstName),
        last_name: normalizeValue(formState.lastName),
        phone_country: phoneCountry,
        phone: phone,
        full_phone: phoneCountry + " " + phone,
        email: normalizeValue(formState.email),
        sms_opt_in: Boolean(formState.smsOptIn)
      };
    };

    var submitPayload = function (payload) {
      if (!leadPopupAppsScriptUrl || typeof window.fetch !== "function") {
        if (window.console && typeof window.console.info === "function") {
          window.console.info("[lead-popup] Apps Script URL not set. Collected payload:", payload);
        }
        return Promise.resolve();
      }

      var requestInit = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      };

      if (/script\.google\.com/i.test(leadPopupAppsScriptUrl)) {
        requestInit.mode = "no-cors";
        return window.fetch(leadPopupAppsScriptUrl, requestInit).then(function () {});
      }

      return window.fetch(leadPopupAppsScriptUrl, requestInit).then(function (response) {
        if (!response.ok) {
          throw new Error("Unable to submit popup payload");
        }
        return response.text();
      });
    };

    var validateStep = function (stepIndex) {
      clearStepError(stepIndex);
      Object.keys(formInputs).forEach(function (key) {
        if (formInputs[key]) {
          formInputs[key].classList.remove("is-invalid");
        }
      });

      if (stepIndex === 0) {
        if (!normalizeValue(formState.timeframe)) {
          showStepError(stepIndex, "Please choose your timeframe to continue.");
          return false;
        }
        return true;
      }

      if (stepIndex === 1) {
        if (!normalizeValue(formState.budget)) {
          showStepError(stepIndex, isSellPage ? "Please choose your estimated home value to continue." : "Please choose your budget to continue.");
          return false;
        }
        return true;
      }

      if (stepIndex === 2) {
        if (!isSellPage) {
          if (!normalizeValue(formState.preApproval)) {
            showStepError(stepIndex, "Please choose your pre-approval status to continue.");
            return false;
          }
          return true;
        }

        formState.homeDescription = normalizeValue(formInputs.homeDescription && formInputs.homeDescription.value);
        if (!formState.homeDescription && formInputs.homeDescription) {
          formInputs.homeDescription.classList.add("is-invalid");
          formInputs.homeDescription.focus();
          showStepError(stepIndex, "Please tell us a bit about your home to continue.");
          return false;
        }
        return true;
      }

      if (stepIndex === 3) {
        if (!isSellPage) {
          formState.areaInterests = normalizeValue(formInputs.areaInterests && formInputs.areaInterests.value);
          if (!formState.areaInterests) {
            if (formInputs.areaInterests) {
              formInputs.areaInterests.classList.add("is-invalid");
              formInputs.areaInterests.focus();
            }
            showStepError(stepIndex, "Please enter your area interest(s).");
            return false;
          }
          return true;
        }

        formState.addressStreet = normalizeValue(formInputs.addressStreet && formInputs.addressStreet.value);
        formState.addressCity = normalizeValue(formInputs.addressCity && formInputs.addressCity.value);
        formState.addressState = normalizeValue(formInputs.addressState && formInputs.addressState.value);
        formState.addressZip = normalizeValue(formInputs.addressZip && formInputs.addressZip.value);

        var firstInvalidAddressInput = null;
        if (!formState.addressStreet && formInputs.addressStreet) {
          firstInvalidAddressInput = firstInvalidAddressInput || formInputs.addressStreet;
          formInputs.addressStreet.classList.add("is-invalid");
        }
        if (!formState.addressCity && formInputs.addressCity) {
          firstInvalidAddressInput = firstInvalidAddressInput || formInputs.addressCity;
          formInputs.addressCity.classList.add("is-invalid");
        }
        if (!formState.addressState && formInputs.addressState) {
          firstInvalidAddressInput = firstInvalidAddressInput || formInputs.addressState;
          formInputs.addressState.classList.add("is-invalid");
        }
        if (!formState.addressZip && formInputs.addressZip) {
          firstInvalidAddressInput = firstInvalidAddressInput || formInputs.addressZip;
          formInputs.addressZip.classList.add("is-invalid");
        }

        if (firstInvalidAddressInput) {
          firstInvalidAddressInput.focus();
          showStepError(stepIndex, "Please complete your full address to continue.");
          return false;
        }
        return true;
      }

      if (stepIndex === 4) {
        formState.firstName = normalizeValue(formInputs.firstName && formInputs.firstName.value);
        formState.lastName = normalizeValue(formInputs.lastName && formInputs.lastName.value);
        formState.phoneCountry = normalizeValue(formInputs.phoneCountry && formInputs.phoneCountry.value) || "+1";
        formState.phone = normalizeValue(formInputs.phone && formInputs.phone.value);
        formState.email = normalizeValue(formInputs.email && formInputs.email.value).toLowerCase();

        var firstInvalidInput = null;

        if (!formState.firstName && formInputs.firstName) {
          firstInvalidInput = firstInvalidInput || formInputs.firstName;
          formInputs.firstName.classList.add("is-invalid");
        }

        if (!formState.lastName && formInputs.lastName) {
          firstInvalidInput = firstInvalidInput || formInputs.lastName;
          formInputs.lastName.classList.add("is-invalid");
        }

        var phoneDigits = stripNonDigits(formState.phone);
        if (phoneDigits.length < 10 && formInputs.phone) {
          firstInvalidInput = firstInvalidInput || formInputs.phone;
          formInputs.phone.classList.add("is-invalid");
        }

        if (!validateEmail(formState.email) && formInputs.email) {
          firstInvalidInput = firstInvalidInput || formInputs.email;
          formInputs.email.classList.add("is-invalid");
        }

        if (firstInvalidInput) {
          firstInvalidInput.focus();
          showStepError(stepIndex, "Please complete all required contact fields with valid information.");
          return false;
        }
      }

      return true;
    };

    var goToNextStep = function () {
      if (!validateStep(currentStep)) {
        return;
      }
      markPopupTouched("popup_next");
      trackPopupEvent("popup_step_completed", {
        step_number: currentStep + 1,
        step_key: getPopupStepKey(currentStep)
      });
      if (currentStep < steps.length - 1) {
        setStep(currentStep + 1);
      }
    };

    var goToPreviousStep = function () {
      if (currentStep > 0) {
        markPopupTouched("popup_prev");
        trackPopupEvent("popup_step_back", {
          from_step_number: currentStep + 1,
          to_step_number: currentStep
        });
        setStep(currentStep - 1);
      }
    };

    var runSubmit = function () {
      if (submitInFlight || !validateStep(steps.length - 1)) {
        return;
      }
      submitInFlight = true;
      markPopupTouched("popup_submit");
      trackPopupEvent("popup_submit_attempt", {
        step_number: steps.length
      });
      var payload = toPayload();

      // Optimistic UX: transition instantly, submit in background.
      hasSubmitted = true;
      safeSet(localStore, leadPopupSubmittedKey, "true");
      safeRemove(sessionStore, leadPopupNextShowKey);
      showScreen("thanks");
      trackPopupEvent("popup_submit_transitioned", {
        transition: "optimistic_thanks"
      });

      submitPayload(payload)
        .then(function () {
          submitInFlight = false;
          trackPopupEvent("popup_submit_success", {
            submission_transport: "background_fetch"
          });
        })
        .catch(function (error) {
          submitInFlight = false;
          trackPopupEvent("popup_submit_error", {
            error_message: String(error && error.message || "background_submit_failed")
          });
          if (window.console && typeof window.console.warn === "function") {
            window.console.warn("[lead-popup] background submit failed", error);
          }
        });
    };

    popupHost.querySelectorAll("[data-lead-popup-close]").forEach(function (closeNode) {
      closeNode.addEventListener("click", function () {
        var closeReason = closeNode.classList.contains("lead-popup-modal-backdrop") ? "outside_click" : "close_button";
        markPopupTouched(closeReason);
        closePopup(true, closeReason);
      });
    });

    if (devTrigger) {
      devTrigger.addEventListener("click", function () {
        markPopupTouched("dev_open");
        openPopup(true, "dev_button");
      });
    }

    popupHost.addEventListener("click", function (event) {
      var fieldNode = event.target.closest("[data-lead-field]");
      if (fieldNode) {
        var field = fieldNode.getAttribute("data-lead-field");
        var value = fieldNode.getAttribute("data-lead-value");
        if (field && value) {
          markPopupTouched("option_select");
          formState[field] = value;
          trackPopupEvent("popup_option_selected", {
            step_number: currentStep + 1,
            step_key: getPopupStepKey(currentStep),
            field_name: field,
            selected_value: value
          });
          syncSelectionUI();
          clearStepError(currentStep);
          updateNavState();

          var isAutoAdvanceSelection =
            (currentStep === 0 && field === "timeframe") ||
            (currentStep === 1 && field === "budget") ||
            (!isSellPage && currentStep === 2 && field === "preApproval");

          if (isAutoAdvanceSelection) {
            if (field === "timeframe" || field === "budget") {
              playChoiceClickAnimation(fieldNode);
            }
            window.setTimeout(function () {
              if (
                (currentStep === 0 && field === "timeframe") ||
                (currentStep === 1 && field === "budget") ||
                (!isSellPage && currentStep === 2 && field === "preApproval")
              ) {
                goToNextStep();
              }
            }, 150);
          }
        }
        return;
      }

      var actionNode = event.target.closest("[data-lead-action]");
      if (!actionNode) {
        return;
      }
      var action = actionNode.getAttribute("data-lead-action");
      if (action === "start") {
        markPopupTouched("start_click");
        hasStartedForm = true;
        showScreen("form");
        setStep(currentStep);
        trackPopupEvent("popup_started", {
          step_number: currentStep + 1
        });
        return;
      }
      if (action === "next") {
        markPopupTouched("next_click");
        goToNextStep();
        return;
      }
      if (action === "submit") {
        markPopupTouched("submit_click");
        runSubmit();
      }
    });

    if (navPrev) {
      navPrev.addEventListener("click", function () {
        markPopupTouched("corner_prev");
        goToPreviousStep();
      });
    }
    if (navNext) {
      navNext.addEventListener("click", function () {
        markPopupTouched("corner_next");
        if (currentStep === steps.length - 1) {
          runSubmit();
          return;
        }
        goToNextStep();
      });
    }

    if (formInputs.areaInterests) {
      formInputs.areaInterests.addEventListener("input", function () {
        trackStepInputStart("areaInterests");
        formState.areaInterests = normalizeValue(formInputs.areaInterests.value);
        formInputs.areaInterests.classList.remove("is-invalid");
        updateNavState();
      });
    }

    ["homeDescription", "addressStreet", "addressCity", "addressState", "addressZip"].forEach(function (key) {
      if (!formInputs[key]) {
        return;
      }
      formInputs[key].addEventListener("input", function () {
        trackStepInputStart(key);
        formState[key] = normalizeValue(formInputs[key].value);
        formInputs[key].classList.remove("is-invalid");
        updateNavState();
      });
    });

    ["firstName", "lastName", "phone", "email"].forEach(function (key) {
      if (!formInputs[key]) {
        return;
      }
      formInputs[key].addEventListener("input", function () {
        trackStepInputStart(key);
        formState[key] = normalizeValue(formInputs[key].value);
        formInputs[key].classList.remove("is-invalid");
        updateNavState();
      });
    });

      if (formInputs.phoneCountry) {
        formInputs.phoneCountry.addEventListener("change", function () {
          trackStepInputStart("phoneCountry");
          formState.phoneCountry = normalizeValue(formInputs.phoneCountry.value) || "+1";
          formInputs.phoneCountry.classList.remove("is-invalid");
          updateNavState();
        });
      }

      if (formInputs.smsOptIn) {
        formInputs.smsOptIn.addEventListener("change", function () {
          trackStepInputStart("smsOptIn");
          formState.smsOptIn = Boolean(formInputs.smsOptIn.checked);
        });
      }

    popupHost.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        event.preventDefault();
        markPopupTouched("escape_key");
        closePopup(true, "escape_key");
        return;
      }

      if (event.key === "Enter" && currentScreen === "form" && !submitInFlight) {
        var tag = String(event.target && event.target.tagName || "").toLowerCase();
        if (tag === "textarea") {
          return;
        }
        event.preventDefault();
        markPopupTouched("enter_key");
        if (currentStep === steps.length - 1) {
          runSubmit();
          return;
        }
        goToNextStep();
      }
    });

    setStep(0);
    syncSelectionUI();
    if (useInlinePopup) {
      showScreen("intro");
      trackPopupEvent("popup_impression", {
        popup_open_source: "inline_embed",
        popup_screen: "intro",
        step_number: 0
      });
    } else {
      schedulePopup();
    }
  })();

  (function () {
    var intakeSection = document.querySelector("[data-new-construction-form-section]");
    if (!intakeSection) {
      return;
    }

    var intakeForm = intakeSection.querySelector("[data-new-construction-form]");
    if (!intakeForm) {
      return;
    }

    var newConstructionAppsScriptUrl = "https://script.google.com/macros/s/AKfycbwnqkPb6Nkp9owlDv_orcAId7cNHbKuQrf5ENMW4BvbUuaLFNHP-yANDdSwQ6Vjl41v/exec";
    var formPanel = intakeSection.querySelector("[data-new-construction-form-panel]");
    var successNode = intakeSection.querySelector("[data-new-construction-form-success]");
    var statusNode = intakeSection.querySelector("[data-new-construction-form-status]");
    var submitButton = intakeForm.querySelector("[data-new-construction-submit]");
    var defaultSubmitLabel = submitButton ? String(submitButton.textContent || "").replace(/\s+/g, " ").trim() || "SUBMIT" : "SUBMIT";
    var sendingSubmitLabel = "Sending your request...";
    var submitInFlight = false;
    var hasTrackedStart = false;
    var inputs = {
      firstName: intakeForm.querySelector("[data-new-construction-input='firstName']"),
      lastName: intakeForm.querySelector("[data-new-construction-input='lastName']"),
      phone: intakeForm.querySelector("[data-new-construction-input='phone']"),
      email: intakeForm.querySelector("[data-new-construction-input='email']"),
      message: intakeForm.querySelector("[data-new-construction-input='message']"),
      smsOptIn: intakeForm.querySelector("[data-new-construction-input='smsOptIn']")
    };

    var normalizeValue = function (value) {
      return String(value || "").replace(/\s+/g, " ").trim();
    };

    var stripNonDigits = function (value) {
      return String(value || "").replace(/[^\d]/g, "");
    };

    var validateEmail = function (value) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    };

    var setStatus = function (message, isError) {
      if (!statusNode) {
        return;
      }
      statusNode.textContent = message || "";
      statusNode.classList.toggle("is-error", Boolean(isError));
    };

    var setSubmitButton = function (label, disabled) {
      if (!submitButton) {
        return;
      }
      submitButton.textContent = normalizeValue(label) || defaultSubmitLabel;
      submitButton.disabled = Boolean(disabled);
    };

    var clearInvalidState = function () {
      Object.keys(inputs).forEach(function (key) {
        if (inputs[key] && inputs[key].classList) {
          inputs[key].classList.remove("is-invalid");
        }
      });
    };

    var trackIntakeEvent = function (eventName, properties) {
      var eventProperties = {
        lead_type: "new_construction",
        form_name: "new_construction_page_form"
      };
      if (properties && typeof properties === "object") {
        Object.keys(properties).forEach(function (key) {
          eventProperties[key] = properties[key];
        });
      }
      trackAnalyticsEvent(eventName, eventProperties);
    };

    var trackStartIfNeeded = function (startSource) {
      if (hasTrackedStart) {
        return;
      }
      hasTrackedStart = true;
      markAnalyticsFormInteraction("new_construction_form");
      trackIntakeEvent("new_construction_form_started", {
        start_source: startSource || "unknown"
      });
    };

    var showSuccessState = function () {
      intakeSection.classList.add("is-success");
      if (formPanel) {
        formPanel.classList.add("is-success");
      }
      if (successNode) {
        successNode.classList.add("is-active");
      }
      setStatus("", false);
    };

    var submitPayload = function (payload) {
      if (!newConstructionAppsScriptUrl || typeof window.fetch !== "function") {
        return Promise.resolve("not_configured");
      }

      var requestInit = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      };

      if (/script\.google\.com/i.test(newConstructionAppsScriptUrl)) {
        requestInit.mode = "no-cors";
        return window.fetch(newConstructionAppsScriptUrl, requestInit).then(function () {
          return "no-cors";
        });
      }

      return window.fetch(newConstructionAppsScriptUrl, requestInit).then(function (response) {
        if (!response.ok) {
          throw new Error("Unable to submit new construction form");
        }
        return "fetch";
      });
    };

    trackIntakeEvent("new_construction_form_impression", {});
    ["firstName", "lastName", "phone", "email", "message"].forEach(function (key) {
      if (!inputs[key]) {
        return;
      }
      inputs[key].addEventListener("focus", function () {
        trackStartIfNeeded("focus_" + key);
      });
      inputs[key].addEventListener("input", function () {
        trackStartIfNeeded("input_" + key);
        inputs[key].classList.remove("is-invalid");
      });
    });

    if (inputs.smsOptIn) {
      inputs.smsOptIn.addEventListener("change", function () {
        trackStartIfNeeded("sms_opt_in_change");
      });
    }

    intakeForm.addEventListener("submit", function (event) {
      event.preventDefault();
      if (submitInFlight) {
        return;
      }

      trackStartIfNeeded("submit");
      markAnalyticsFormInteraction("new_construction_form_submit");
      clearInvalidState();
      setStatus("", false);

      var firstName = normalizeValue(inputs.firstName && inputs.firstName.value);
      var lastName = normalizeValue(inputs.lastName && inputs.lastName.value);
      var phone = normalizeValue(inputs.phone && inputs.phone.value);
      var email = normalizeValue(inputs.email && inputs.email.value).toLowerCase();
      var message = normalizeValue(inputs.message && inputs.message.value);
      var invalidFields = [];
      var firstInvalidInput = null;

      if (!firstName && inputs.firstName) {
        inputs.firstName.classList.add("is-invalid");
        invalidFields.push("first_name");
        firstInvalidInput = firstInvalidInput || inputs.firstName;
      }

      if (!lastName && inputs.lastName) {
        inputs.lastName.classList.add("is-invalid");
        invalidFields.push("last_name");
        firstInvalidInput = firstInvalidInput || inputs.lastName;
      }

      if (stripNonDigits(phone).length < 10 && inputs.phone) {
        inputs.phone.classList.add("is-invalid");
        invalidFields.push("phone");
        firstInvalidInput = firstInvalidInput || inputs.phone;
      }

      if (!validateEmail(email) && inputs.email) {
        inputs.email.classList.add("is-invalid");
        invalidFields.push("email");
        firstInvalidInput = firstInvalidInput || inputs.email;
      }

      if (invalidFields.length) {
        if (firstInvalidInput) {
          firstInvalidInput.focus();
        }
        trackIntakeEvent("new_construction_form_validation_error", {
          invalid_fields: invalidFields.join(","),
          invalid_count: invalidFields.length
        });
        setStatus("Please complete all required fields with valid information.", true);
        return;
      }

      submitInFlight = true;
      setSubmitButton(sendingSubmitLabel, true);

      var fullName = [firstName, lastName].join(" ").replace(/\s+/g, " ").trim();
      var payload = {
        submitted_at: new Date().toISOString(),
        source_page: window.location.href,
        lead_type: "new_construction",
        requested_contact_source: "new_construction_page_form",
        requested_contact_intent: "looking_to_buy",
        requested_contact_is_buyer: true,
        requested_contact_is_seller: false,
        requested_contact_name: fullName,
        requested_contact_notes: message,
        new_construction_message: message,
        first_name: firstName,
        last_name: lastName,
        email: email,
        phone_country: "+1",
        phone: phone,
        sms_opt_in: Boolean(inputs.smsOptIn && inputs.smsOptIn.checked)
      };

      trackIntakeEvent("new_construction_form_submit_attempt", {});
      showSuccessState();

      submitPayload(payload)
        .then(function (submissionTransport) {
          submitInFlight = false;
          setSubmitButton(defaultSubmitLabel, false);
          trackIntakeEvent("new_construction_form_submit_success", {
            submission_transport: submissionTransport || "fetch"
          });
        })
        .catch(function (error) {
          submitInFlight = false;
          setSubmitButton(defaultSubmitLabel, false);
          trackIntakeEvent("new_construction_form_submit_error", {
            error_message: String(error && error.message || "submit_failed")
          });
          if (window.console && typeof window.console.warn === "function") {
            window.console.warn("[new-construction-form] background submit failed", error);
          }
        });
    });
  })();

  (function () {
    var homeEvalForm = document.querySelector("[data-home-eval-form]");
    if (!homeEvalForm) {
      return;
    }

    var homeEvalAppsScriptUrl = "https://script.google.com/macros/s/AKfycbwnqkPb6Nkp9owlDv_orcAId7cNHbKuQrf5ENMW4BvbUuaLFNHP-yANDdSwQ6Vjl41v/exec";
    var statusNode = homeEvalForm.querySelector("[data-home-eval-status]");
    var submitButton = homeEvalForm.querySelector(".sell-home-eval-submit");
    var inputs = {
      name: homeEvalForm.querySelector("[data-home-eval-input='name']"),
      email: homeEvalForm.querySelector("[data-home-eval-input='email']"),
      phone: homeEvalForm.querySelector("[data-home-eval-input='phone']"),
      propertyAddress: homeEvalForm.querySelector("[data-home-eval-input='propertyAddress']"),
      smsOptIn: homeEvalForm.querySelector("[data-home-eval-input='smsOptIn']")
    };
    var submitInFlight = false;
    var hasTrackedFormStart = false;

    var trackHomeEvalEvent = function (eventName, properties) {
      var eventProperties = {
        lead_type: "home_eval",
        form_name: "sell_home_valuation"
      };
      if (properties && typeof properties === "object") {
        Object.keys(properties).forEach(function (key) {
          eventProperties[key] = properties[key];
        });
      }
      trackAnalyticsEvent(eventName, eventProperties);
    };

    var trackHomeEvalStart = function (startSource) {
      if (hasTrackedFormStart) {
        return;
      }
      hasTrackedFormStart = true;
      markAnalyticsFormInteraction("home_eval_form");
      trackHomeEvalEvent("home_eval_started", {
        start_source: startSource || "unknown"
      });
    };

    var normalizeValue = function (value) {
      return String(value || "").replace(/\s+/g, " ").trim();
    };

    var validateEmail = function (value) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    };

    var stripNonDigits = function (value) {
      return String(value || "").replace(/[^\d]/g, "");
    };

    var setStatus = function (message, isError) {
      if (!statusNode) {
        return;
      }
      statusNode.textContent = message || "";
      statusNode.classList.toggle("is-error", Boolean(isError));
    };

    var clearInvalidState = function () {
      Object.keys(inputs).forEach(function (key) {
        if (inputs[key]) {
          inputs[key].classList.remove("is-invalid");
        }
      });
    };

    trackHomeEvalEvent("home_eval_impression", {});
    Object.keys(inputs).forEach(function (key) {
      if (!inputs[key]) {
        return;
      }
      inputs[key].addEventListener("focus", function () {
        trackHomeEvalStart("focus_" + key);
      });
      inputs[key].addEventListener("input", function () {
        trackHomeEvalStart("input_" + key);
      });
    });

    homeEvalForm.addEventListener("submit", function (event) {
      event.preventDefault();
      if (submitInFlight) {
        return;
      }

      trackHomeEvalStart("submit");
      markAnalyticsFormInteraction("home_eval_submit");
      trackHomeEvalEvent("home_eval_submit_attempt", {});
      clearInvalidState();
      setStatus("", false);

      var name = normalizeValue(inputs.name && inputs.name.value);
      var email = normalizeValue(inputs.email && inputs.email.value).toLowerCase();
      var phone = normalizeValue(inputs.phone && inputs.phone.value);
      var propertyAddress = normalizeValue(inputs.propertyAddress && inputs.propertyAddress.value);
      var firstInvalidInput = null;
      var invalidFields = [];

      if (!name && inputs.name) {
        firstInvalidInput = firstInvalidInput || inputs.name;
        inputs.name.classList.add("is-invalid");
        invalidFields.push("name");
      }

      if (!validateEmail(email) && inputs.email) {
        firstInvalidInput = firstInvalidInput || inputs.email;
        inputs.email.classList.add("is-invalid");
        invalidFields.push("email");
      }

      if (stripNonDigits(phone).length < 10 && inputs.phone) {
        firstInvalidInput = firstInvalidInput || inputs.phone;
        inputs.phone.classList.add("is-invalid");
        invalidFields.push("phone");
      }

      if (!propertyAddress && inputs.propertyAddress) {
        firstInvalidInput = firstInvalidInput || inputs.propertyAddress;
        inputs.propertyAddress.classList.add("is-invalid");
        invalidFields.push("propertyAddress");
      }

      if (firstInvalidInput) {
        firstInvalidInput.focus();
        trackHomeEvalEvent("home_eval_validation_error", {
          invalid_fields: invalidFields.join(","),
          invalid_count: invalidFields.length
        });
        setStatus("Please complete all required fields with valid information.", true);
        return;
      }

      submitInFlight = true;
      if (submitButton) {
        submitButton.disabled = true;
      }
      setStatus("Sending message...", false);

      var nameParts = name.split(" ");
      var firstName = nameParts.length ? nameParts[0] : "";
      var lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

      var payload = {
        submitted_at: new Date().toISOString(),
        source_page: window.location.href,
        lead_type: "home_eval",
        home_eval_name: name,
        home_eval_email: email,
        home_eval_phone: phone,
        home_eval_property_address: propertyAddress,
        first_name: firstName,
        last_name: lastName,
        email: email,
        phone: phone,
        full_address: propertyAddress,
        sms_opt_in: Boolean(inputs.smsOptIn && inputs.smsOptIn.checked)
      };

      if (!homeEvalAppsScriptUrl || typeof window.fetch !== "function") {
        if (window.console && typeof window.console.info === "function") {
          window.console.info("[home-eval] Apps Script URL not set. Collected payload:", payload);
        }
        submitInFlight = false;
        if (submitButton) {
          submitButton.disabled = false;
        }
        homeEvalForm.reset();
        trackHomeEvalEvent("home_eval_submit_success", {
          submission_transport: "not_configured"
        });
        setStatus("Thanks! We will be in touch shortly.", false);
        return;
      }

      var requestInit = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      };

      var submitPromise;
      if (/script\.google\.com/i.test(homeEvalAppsScriptUrl)) {
        requestInit.mode = "no-cors";
        submitPromise = window.fetch(homeEvalAppsScriptUrl, requestInit).then(function () {});
      } else {
        submitPromise = window.fetch(homeEvalAppsScriptUrl, requestInit).then(function (response) {
          if (!response.ok) {
            throw new Error("Unable to submit home valuation form");
          }
          return response.text();
        });
      }

      submitPromise
        .then(function () {
          submitInFlight = false;
          if (submitButton) {
            submitButton.disabled = false;
          }
          homeEvalForm.reset();
          trackHomeEvalEvent("home_eval_submit_success", {
            submission_transport: "fetch"
          });
          setStatus("Thanks! We will be in touch shortly.", false);
        })
        .catch(function (error) {
          submitInFlight = false;
          if (submitButton) {
            submitButton.disabled = false;
          }
          trackHomeEvalEvent("home_eval_submit_error", {
            error_message: String(error && error.message || "submit_failed")
          });
          setStatus("Something went wrong sending your request. Please try again.", true);
      });
    });
  })();
  
  (function () {
    var isHomePage = Boolean(document.body && document.body.classList.contains("page-home"));
    var isAboutPage = Boolean(document.body && document.body.classList.contains("page-about"));
    var isDesktopViewport = !window.matchMedia || window.matchMedia("(min-width: 1025px)").matches;
    var shouldEnableCallPopup = isHomePage || (isAboutPage && isDesktopViewport);
    if (!shouldEnableCallPopup) {
      return;
    }

    var callMeLink = document.querySelector(".utility-nav .call-link");
    if (!callMeLink) {
      return;
    }

    var requestedContactAppsScriptUrl = "https://script.google.com/macros/s/AKfycbwnqkPb6Nkp9owlDv_orcAId7cNHbKuQrf5ENMW4BvbUuaLFNHP-yANDdSwQ6Vjl41v/exec";
    var modalOpenClass = "call-contact-popup-open";
    var submitInFlight = false;
    var hasTrackedStartForOpen = false;
    var lastActiveElement = null;

    var injectRequestedContactStyles = function () {
      if (document.getElementById("call-contact-popup-styles")) {
        return;
      }

      var styleNode = document.createElement("style");
      styleNode.id = "call-contact-popup-styles";
      styleNode.textContent = [
        "body.call-contact-popup-open { overflow: hidden; }",
        ".call-contact-modal { position: fixed; inset: 0; z-index: 5600; display: grid; place-items: center; padding: clamp(0.8rem, 2vw, 1.4rem); }",
        ".call-contact-modal[hidden] { display: none; }",
        ".call-contact-backdrop { position: absolute; inset: 0; background: rgba(8, 20, 30, 0.72); backdrop-filter: blur(14px) saturate(0.95); }",
        ".call-contact-dialog { position: relative; z-index: 1; width: min(680px, 95vw); max-height: 92vh; overflow: auto; border-radius: 12px; background: #f7f8f7; box-shadow: 0 24px 56px rgba(8, 16, 23, 0.34); padding: clamp(1.1rem, 3vw, 2rem) clamp(1rem, 3vw, 1.9rem) clamp(0.78rem, 2.2vw, 1.15rem); }",
        ".call-contact-dialog.is-success { background: #ffffff; min-height: 230px; display: flex; align-items: center; justify-content: center; padding: clamp(1.5rem, 4vw, 2.8rem); }",
        ".call-contact-dialog.is-success .call-contact-header, .call-contact-dialog.is-success form { display: none; }",
        ".call-contact-dialog.is-success .call-contact-close { background: rgba(199, 157, 44, 0.16); color: #8f6f15; }",
        ".call-contact-close { position: absolute; top: 0.65rem; right: 0.65rem; width: 30px; height: 30px; border: 0; border-radius: 999px; background: rgba(22, 44, 57, 0.14); color: #20475b; font-size: 1.3rem; line-height: 1; cursor: pointer; }",
        ".call-contact-close:hover, .call-contact-close:focus-visible { background: rgba(22, 44, 57, 0.22); }",
        ".call-contact-header h2 { margin: 0; color: #1f4b5f; font-size: clamp(1.2rem, 2.8vw, 1.8rem); line-height: 1.2; text-transform: uppercase; }",
        ".call-contact-header p { margin: 0.42rem 0 0.18rem; color: #426477; font-size: 0.95rem; line-height: 1.5; }",
        ".call-contact-form { margin-top: 1.36rem; display: grid; gap: 1.52rem; }",
        ".call-contact-form > label, .call-contact-form > .call-contact-name-grid, .call-contact-form > fieldset, .call-contact-form > .call-contact-consent, .call-contact-form > .call-contact-actions, .call-contact-form > .call-contact-consent-meta { margin: 0; }",
        ".call-contact-name-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.88rem; }",
        ".call-contact-label { display: block; margin-bottom: 0.2rem; color: #1f4b5f; font-size: 0.9rem; font-weight: 800; text-transform: uppercase; line-height: 1.2; }",
        ".call-contact-input, .call-contact-textarea { width: 100%; margin-top: 0; border: 1px solid #9eb1bb; border-radius: 8px; background: #ffffff; color: #1f2f37; font-size: 1rem; font-family: \"Manrope\", \"Segoe UI\", sans-serif; padding: 0.6rem 0.7rem; }",
        ".call-contact-textarea { min-height: 108px; resize: vertical; }",
        ".call-contact-input:focus-visible, .call-contact-textarea:focus-visible { outline: none; border-color: #1f4b5f; box-shadow: 0 0 0 3px rgba(31, 75, 95, 0.12); }",
        ".call-contact-intent { margin: 0; border: 0; padding: 0; }",
        ".call-contact-intent .call-contact-label { margin-bottom: 0.46rem; }",
        ".call-contact-intent-options { display: grid; gap: 0.45rem; }",
        ".call-contact-intent-option { display: grid; grid-template-columns: 1rem minmax(0, 1fr); align-items: center; gap: 0.52rem; padding: 0.56rem 0.62rem; border: 1px solid #c5d0d6; border-radius: 8px; background: #ffffff; color: #234a5e; font-size: 0.96rem; }",
        ".call-contact-intent-option input[type='radio'] { margin: 0; width: 1rem; height: 1rem; }",
        ".call-contact-intent.is-invalid .call-contact-intent-option { border-color: #b44141; }",
        ".call-contact-input.is-invalid { border-color: #b44141; }",
        ".call-contact-actions { margin-top: 0.52rem; display: grid; gap: 0.86rem; }",
        ".call-contact-submit { border: 0; border-radius: 8px; background: #c79d2c; color: #ffffff; font-size: 1rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.025em; padding: 0.84rem 1rem; cursor: pointer; }",
        ".call-contact-submit:hover, .call-contact-submit:focus-visible { background: #af8926; }",
        ".call-contact-submit[disabled] { opacity: 0.7; cursor: wait; }",
        ".call-contact-direct-call { color: #1f4b5f; font-size: 0.9rem; font-weight: 700; text-decoration: underline; text-underline-offset: 2px; }",
        ".call-contact-consent { margin-top: 0.12rem; color: #355564; font-size: 0.76rem; line-height: 1.44; }",
        ".call-contact-consent label { display: grid; grid-template-columns: 0.92rem minmax(0, 1fr); align-items: flex-start; gap: 0.48rem; margin: 0; }",
        ".call-contact-consent input[type='checkbox'] { margin: 0.12rem 0 0; width: 0.92rem; height: 0.92rem; }",
        ".call-contact-consent-meta { margin-top: 0.22rem; color: #556d79; font-size: 0.73rem; line-height: 1.4; }",
        ".call-contact-consent-note { margin: 0.35rem 0 0; color: #556d79; }",
        ".call-contact-consent-links { margin: 0.3rem 0 0; }",
        ".call-contact-consent-links a { color: #1f4b5f; text-decoration: underline; text-underline-offset: 2px; }",
        ".call-contact-status { margin: 0.08rem 0 0; color: #1f5a36; font-size: 0.89rem; font-weight: 700; }",
        ".call-contact-status:empty { display: none; }",
        ".call-contact-status.is-error { color: #b44141; }",
        ".call-contact-success { display: none; width: 100%; text-align: center; }",
        ".call-contact-success.is-active { display: block; }",
        ".call-contact-success-message { margin: 0; color: #c79d2c; font-size: clamp(1.24rem, 2.8vw, 1.92rem); line-height: 1.35; font-weight: 800; letter-spacing: 0.01em; }",
        "@media (max-width: 700px) { .call-contact-name-grid { grid-template-columns: 1fr; gap: 0.96rem; } }"
      ].join("");
      document.head.appendChild(styleNode);
    };

    injectRequestedContactStyles();

    var popupHost = document.createElement("div");
    popupHost.className = "call-contact-modal";
    popupHost.hidden = true;
    popupHost.setAttribute("aria-hidden", "true");
    popupHost.innerHTML = [
      "<div class='call-contact-backdrop' data-call-contact-close='backdrop'></div>",
      "<div class='call-contact-dialog' role='dialog' aria-modal='true' aria-labelledby='call-contact-title'>",
      "<button type='button' class='call-contact-close' data-call-contact-close='button' aria-label='Close contact form'>&times;</button>",
      "<div class='call-contact-header'>",
      "<h2 id='call-contact-title'>Contact Us</h2>",
      "<p>Tell us your goals and our team will reach out shortly.</p>",
      "</div>",
      "<form class='call-contact-form' data-call-contact-form novalidate>",
      "<div class='call-contact-name-grid'>",
      "<label>",
      "<span class='call-contact-label'>First Name*</span>",
      "<input type='text' class='call-contact-input' data-call-contact-input='firstName' autocomplete='given-name' placeholder='Jane'>",
      "</label>",
      "<label>",
      "<span class='call-contact-label'>Last Name*</span>",
      "<input type='text' class='call-contact-input' data-call-contact-input='lastName' autocomplete='family-name' placeholder='Smith'>",
      "</label>",
      "</div>",
      "<label>",
      "<span class='call-contact-label'>Email*</span>",
      "<input type='email' class='call-contact-input' data-call-contact-input='email' autocomplete='email' placeholder='name@example.com'>",
      "</label>",
      "<label>",
      "<span class='call-contact-label'>Phone*</span>",
      "<input type='tel' class='call-contact-input' data-call-contact-input='phone' autocomplete='tel' placeholder='(919) 555-0123'>",
      "</label>",
      "<fieldset class='call-contact-intent' data-call-contact-intent-group>",
      "<legend class='call-contact-label'>What are you looking to do?*</legend>",
      "<div class='call-contact-intent-options'>",
      "<label class='call-contact-intent-option'><input type='radio' name='contactIntent' value='looking_to_buy'><span>Looking to buy</span></label>",
      "<label class='call-contact-intent-option'><input type='radio' name='contactIntent' value='looking_to_sell'><span>Looking to sell</span></label>",
      "<label class='call-contact-intent-option'><input type='radio' name='contactIntent' value='looking_to_sell_and_buy'><span>Looking to sell and purchase a home</span></label>",
      "</div>",
      "</fieldset>",
      "<label>",
      "<span class='call-contact-label'>Anything else we should know? (Optional)</span>",
      "<textarea class='call-contact-textarea' data-call-contact-input='details' placeholder='Share your timeline, area, and any must-haves.'></textarea>",
      "</label>",
      "<div class='call-contact-consent' data-legal-consent='true'>",
      "<label>",
      "<input type='checkbox' data-call-contact-input='smsOptIn'>",
      "<span>" + smsConsentDisclosureText + "</span>",
      "</label>",
      "</div>",
      "<div class='call-contact-actions'>",
      "<button type='submit' class='call-contact-submit' data-call-contact-submit>Contact Us</button>",
      "<a class='call-contact-direct-call' href='tel:+19197377896'>Prefer to call now? 919-737-7896</a>",
      "</div>",
      "<div class='call-contact-consent-meta'>",
      "<p class='call-contact-consent-note'>" + smsConsentOptionalNoteText + "</p>",
      "<p class='call-contact-consent-links'>Review our <a href='/privacy-policy/' target='_blank' rel='noopener noreferrer'>Privacy Policy</a> and <a href='/terms-of-service/' target='_blank' rel='noopener noreferrer'>Terms of Service</a>.</p>",
      "</div>",
      "<p class='call-contact-status' data-call-contact-status aria-live='polite'></p>",
      "</form>",
      "<section class='call-contact-success' data-call-contact-success aria-live='polite'>",
      "<p class='call-contact-success-message'>Thanks for contacting us, we will be in touch very soon!<br>- The Living in Raleigh Team</p>",
      "</section>",
      "</div>"
    ].join("");
    document.body.appendChild(popupHost);

    var form = popupHost.querySelector("[data-call-contact-form]");
    var statusNode = popupHost.querySelector("[data-call-contact-status]");
    var submitButton = popupHost.querySelector("[data-call-contact-submit]");
    var intentGroup = popupHost.querySelector("[data-call-contact-intent-group]");
    var popupDialog = popupHost.querySelector(".call-contact-dialog");
    var successScreen = popupHost.querySelector("[data-call-contact-success]");
    var defaultSubmitLabel = submitButton ? normalizeButtonLabel_(submitButton.textContent, "Contact Us") : "Contact Us";
    var sendingSubmitLabel = "Sending your request...";
    var successScreenDelayMs = 900;
    var closeAfterSuccessDelayMs = 3000;
    var successScreenTimerId = 0;
    var closeAfterSuccessTimerId = 0;
    var inputs = {
      firstName: popupHost.querySelector("[data-call-contact-input='firstName']"),
      lastName: popupHost.querySelector("[data-call-contact-input='lastName']"),
      email: popupHost.querySelector("[data-call-contact-input='email']"),
      phone: popupHost.querySelector("[data-call-contact-input='phone']"),
      details: popupHost.querySelector("[data-call-contact-input='details']"),
      smsOptIn: popupHost.querySelector("[data-call-contact-input='smsOptIn']")
    };

    var normalizeValue = function (value) {
      return String(value || "").replace(/\s+/g, " ").trim();
    };

    function normalizeButtonLabel_(value, fallback) {
      var normalized = String(value || "").replace(/\s+/g, " ").trim();
      if (normalized) {
        return normalized;
      }
      return String(fallback || "").replace(/\s+/g, " ").trim();
    }

    var stripNonDigits = function (value) {
      return String(value || "").replace(/[^\d]/g, "");
    };

    var validateEmail = function (value) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    };

    var getIntentValue = function () {
      var selected = popupHost.querySelector("input[name='contactIntent']:checked");
      return selected ? String(selected.value) : "";
    };

    var setStatus = function (message, isError) {
      if (!statusNode) {
        return;
      }
      statusNode.textContent = message || "";
      statusNode.classList.toggle("is-error", Boolean(isError));
    };

    var setSubmitButton = function (label, disabled) {
      if (!submitButton) {
        return;
      }
      submitButton.textContent = normalizeButtonLabel_(label, defaultSubmitLabel);
      submitButton.disabled = Boolean(disabled);
    };

    var clearSuccessTimers = function () {
      if (successScreenTimerId) {
        window.clearTimeout(successScreenTimerId);
        successScreenTimerId = 0;
      }
      if (closeAfterSuccessTimerId) {
        window.clearTimeout(closeAfterSuccessTimerId);
        closeAfterSuccessTimerId = 0;
      }
    };

    var hideSuccessScreen = function () {
      if (popupDialog) {
        popupDialog.classList.remove("is-success");
      }
      if (successScreen) {
        successScreen.classList.remove("is-active");
      }
    };

    var showSuccessScreen = function () {
      form.reset();
      clearInvalidState();
      setStatus("", false);
      if (popupDialog) {
        popupDialog.classList.add("is-success");
      }
      if (successScreen) {
        successScreen.classList.add("is-active");
      }
    };

    var resetSubmitUi = function () {
      clearSuccessTimers();
      hideSuccessScreen();
      setSubmitButton(defaultSubmitLabel, false);
      submitInFlight = false;
    };

    var clearInvalidState = function () {
      Object.keys(inputs).forEach(function (key) {
        if (inputs[key] && inputs[key].classList) {
          inputs[key].classList.remove("is-invalid");
        }
      });
      if (intentGroup) {
        intentGroup.classList.remove("is-invalid");
      }
    };

    var trackStartIfNeeded = function (source) {
      if (hasTrackedStartForOpen) {
        return;
      }
      hasTrackedStartForOpen = true;
      markAnalyticsFormInteraction("requested_contact_form");
      trackAnalyticsEvent("requested_contact_started", {
        lead_type: "requested_contact",
        form_name: "home_call_me_popup",
        start_source: source || "unknown"
      });
      trackAnalyticsEvent("popup_started", {
        popup_lead_type: "requested_contact",
        popup_variant: "call_me_modal",
        popup_open_source: "call_link_click",
        step_number: 1,
        step_key: "contact_form",
        contact_intent: getIntentValue()
      });
    };

    var openPopup = function () {
      if (!popupHost.hidden) {
        return;
      }
      lastActiveElement = document.activeElement;
      hasTrackedStartForOpen = false;
      resetSubmitUi();
      setStatus("", false);
      clearInvalidState();
      popupHost.hidden = false;
      popupHost.setAttribute("aria-hidden", "false");
      document.body.classList.add(modalOpenClass);
      viewportScrollLock.lock();
      markAnalyticsPopupInteraction("home_call_me_click");
      trackAnalyticsEvent("requested_contact_impression", {
        lead_type: "requested_contact",
        form_name: "home_call_me_popup",
        popup_open_source: "call_link_click"
      });
      trackAnalyticsEvent("popup_impression", {
        popup_lead_type: "requested_contact",
        popup_variant: "call_me_modal",
        popup_open_source: "call_link_click",
        popup_screen: "form",
        step_number: 1,
        step_key: "contact_form"
      });
      trackAnalyticsEvent("popup_step_viewed", {
        popup_lead_type: "requested_contact",
        popup_variant: "call_me_modal",
        step_number: 1,
        step_key: "contact_form"
      });
      window.requestAnimationFrame(function () {
        if (inputs.firstName) {
          inputs.firstName.focus();
        }
      });
    };

    var closePopup = function (reason) {
      if (popupHost.hidden) {
        return;
      }
      resetSubmitUi();
      popupHost.hidden = true;
      popupHost.setAttribute("aria-hidden", "true");
      document.body.classList.remove(modalOpenClass);
      viewportScrollLock.unlock();
      trackAnalyticsEvent("popup_closed", {
        popup_lead_type: "requested_contact",
        popup_variant: "call_me_modal",
        popup_screen: "form",
        step_number: 1,
        close_reason: reason || "unknown",
        rescheduled: false
      });
      if (lastActiveElement && typeof lastActiveElement.focus === "function") {
        window.requestAnimationFrame(function () {
          lastActiveElement.focus();
        });
      }
    };

    var resolveIntentMeta = function (intentValue) {
      if (intentValue === "looking_to_buy") {
        return { isBuyer: true, isSeller: false };
      }
      if (intentValue === "looking_to_sell") {
        return { isBuyer: false, isSeller: true };
      }
      if (intentValue === "looking_to_sell_and_buy") {
        return { isBuyer: true, isSeller: true };
      }
      return { isBuyer: false, isSeller: false };
    };

    var submitPayload = function (payload) {
      if (!requestedContactAppsScriptUrl || typeof window.fetch !== "function") {
        return Promise.resolve();
      }

      var requestInit = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      };

      if (/script\.google\.com/i.test(requestedContactAppsScriptUrl)) {
        requestInit.mode = "no-cors";
        return window.fetch(requestedContactAppsScriptUrl, requestInit).then(function () {});
      }

      return window.fetch(requestedContactAppsScriptUrl, requestInit).then(function (response) {
        if (!response.ok) {
          throw new Error("Unable to submit requested contact form");
        }
        return response.text();
      });
    };

    callMeLink.addEventListener("click", function (event) {
      event.preventDefault();
      openPopup();
    });

    popupHost.querySelectorAll("[data-call-contact-close]").forEach(function (closeNode) {
      closeNode.addEventListener("click", function () {
        var closeReason = closeNode.getAttribute("data-call-contact-close") === "backdrop" ? "outside_click" : "close_button";
        closePopup(closeReason);
      });
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !popupHost.hidden) {
        event.preventDefault();
        closePopup("escape_key");
      }
    });

    ["firstName", "lastName", "email", "phone", "details"].forEach(function (key) {
      if (!inputs[key]) {
        return;
      }
      inputs[key].addEventListener("focus", function () {
        trackStartIfNeeded("focus_" + key);
      });
      inputs[key].addEventListener("input", function () {
        trackStartIfNeeded("input_" + key);
        inputs[key].classList.remove("is-invalid");
      });
    });

    popupHost.querySelectorAll("input[name='contactIntent']").forEach(function (radio) {
      radio.addEventListener("change", function () {
        trackStartIfNeeded("intent_change");
        if (intentGroup) {
          intentGroup.classList.remove("is-invalid");
        }
      });
    });

    if (inputs.smsOptIn) {
      inputs.smsOptIn.addEventListener("change", function () {
        trackStartIfNeeded("sms_opt_in_change");
      });
    }

    if (!form) {
      return;
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (submitInFlight) {
        return;
      }

      trackStartIfNeeded("submit");
      markAnalyticsFormInteraction("requested_contact_submit");
      clearInvalidState();
      setStatus("", false);

      var firstName = normalizeValue(inputs.firstName && inputs.firstName.value);
      var lastName = normalizeValue(inputs.lastName && inputs.lastName.value);
      var fullName = [firstName, lastName].join(" ").replace(/\s+/g, " ").trim();
      var email = normalizeValue(inputs.email && inputs.email.value).toLowerCase();
      var phone = normalizeValue(inputs.phone && inputs.phone.value);
      var details = normalizeValue(inputs.details && inputs.details.value);
      var intent = getIntentValue();
      var intentMeta = resolveIntentMeta(intent);
      var invalidFields = [];
      var firstInvalidInput = null;

      if (!firstName && inputs.firstName) {
        inputs.firstName.classList.add("is-invalid");
        firstInvalidInput = firstInvalidInput || inputs.firstName;
        invalidFields.push("first_name");
      }

      if (!lastName && inputs.lastName) {
        inputs.lastName.classList.add("is-invalid");
        firstInvalidInput = firstInvalidInput || inputs.lastName;
        invalidFields.push("last_name");
      }

      if (!validateEmail(email) && inputs.email) {
        inputs.email.classList.add("is-invalid");
        firstInvalidInput = firstInvalidInput || inputs.email;
        invalidFields.push("email");
      }

      if (stripNonDigits(phone).length < 10 && inputs.phone) {
        inputs.phone.classList.add("is-invalid");
        firstInvalidInput = firstInvalidInput || inputs.phone;
        invalidFields.push("phone");
      }

      if (!intent) {
        if (intentGroup) {
          intentGroup.classList.add("is-invalid");
        }
        invalidFields.push("contactIntent");
      }

      if (invalidFields.length) {
        if (firstInvalidInput) {
          firstInvalidInput.focus();
        }
        trackAnalyticsEvent("requested_contact_validation_error", {
          lead_type: "requested_contact",
          form_name: "home_call_me_popup",
          invalid_fields: invalidFields.join(","),
          invalid_count: invalidFields.length
        });
        trackAnalyticsEvent("popup_step_validation_error", {
          popup_lead_type: "requested_contact",
          popup_variant: "call_me_modal",
          step_number: 1,
          step_key: "contact_form",
          invalid_fields: invalidFields.join(","),
          invalid_count: invalidFields.length,
          contact_intent: intent
        });
        setStatus("Please complete all required fields with valid information.", true);
        return;
      }

      submitInFlight = true;
      setSubmitButton(sendingSubmitLabel, true);
      setStatus("", false);

      var payload = {
        submitted_at: new Date().toISOString(),
        source_page: window.location.href,
        lead_type: "requested_contact",
        requested_contact_source: "home_call_me_popup",
        requested_contact_name: fullName,
        requested_contact_intent: intent,
        requested_contact_is_buyer: intentMeta.isBuyer,
        requested_contact_is_seller: intentMeta.isSeller,
        requested_contact_notes: details,
        first_name: firstName,
        last_name: lastName,
        email: email,
        phone_country: "+1",
        phone: phone,
        sms_opt_in: Boolean(inputs.smsOptIn && inputs.smsOptIn.checked)
      };

      trackAnalyticsEvent("requested_contact_submit_attempt", {
        lead_type: "requested_contact",
        form_name: "home_call_me_popup",
        contact_intent: intent
      });
      trackAnalyticsEvent("popup_step_completed", {
        popup_lead_type: "requested_contact",
        popup_variant: "call_me_modal",
        step_number: 1,
        step_key: "contact_form",
        contact_intent: intent
      });
      trackAnalyticsEvent("popup_submit_attempt", {
        popup_lead_type: "requested_contact",
        popup_variant: "call_me_modal",
        step_number: 1,
        step_key: "contact_form",
        contact_intent: intent
      });

      clearSuccessTimers();
      successScreenTimerId = window.setTimeout(function () {
        if (popupHost.hidden) {
          return;
        }
        showSuccessScreen();
        closeAfterSuccessTimerId = window.setTimeout(function () {
          if (popupHost.hidden) {
            return;
          }
          closePopup("submitted");
        }, closeAfterSuccessDelayMs);
      }, successScreenDelayMs);

      submitPayload(payload)
        .then(function () {
          trackAnalyticsEvent("requested_contact_submit_success", {
            lead_type: "requested_contact",
            form_name: "home_call_me_popup",
            contact_intent: intent
          });
          trackAnalyticsEvent("popup_submit_success", {
            popup_lead_type: "requested_contact",
            popup_variant: "call_me_modal",
            step_number: 1,
            step_key: "contact_form",
            contact_intent: intent
          });
        })
        .catch(function (error) {
          trackAnalyticsEvent("requested_contact_submit_error", {
            lead_type: "requested_contact",
            form_name: "home_call_me_popup",
            error_message: String(error && error.message || "submit_failed"),
            contact_intent: intent
          });
          trackAnalyticsEvent("popup_submit_error", {
            popup_lead_type: "requested_contact",
            popup_variant: "call_me_modal",
            step_number: 1,
            step_key: "contact_form",
            contact_intent: intent,
            error_message: String(error && error.message || "submit_failed")
          });
          if (window.console && typeof window.console.warn === "function") {
            window.console.warn("[requested-contact] background submit failed", error);
          }
        });
    });
  })();
  
  (function () {
    var legalBusinessName = "Living in Raleigh LLC";
    var legalTeamName = "The Living in Raleigh Team";
    var legalDisplayName = legalBusinessName + " d/b/a " + legalTeamName;
    var legalEffectiveDate = "April 2, 2026";
    var legalContactEmail = "livinginraleighteam@gmail.com";
    var legalPrivacyPolicyUrl = "/privacy-policy/";
    var legalTermsOfServiceUrl = "/terms-of-service/";
    var legalLinksMarkup = "<a href='" + legalPrivacyPolicyUrl + "' target='_blank' rel='noopener noreferrer'>Privacy Policy</a> | <a href='" + legalTermsOfServiceUrl + "' target='_blank' rel='noopener noreferrer'>Terms of Service</a>";
    var legalModal = null;

    var injectLegalStyles = function () {
      if (document.getElementById("legal-policy-styles")) {
        return;
      }
      var styleNode = document.createElement("style");
      styleNode.id = "legal-policy-styles";
      styleNode.textContent = [
        ".legal-inline-links, .legal-consent-links, .legal-footer-links-row { font-weight: 700; color: #1f4b5e; }",
        ".legal-inline-links a, .legal-consent-links a, .legal-footer-links-row a { color: #1f4b5e; text-decoration: underline; text-underline-offset: 3px; }",
        ".home-final-footer .legal-inline-links, .home-final-footer .legal-footer-links-row { color: rgba(234, 244, 241, 0.96); }",
        ".home-final-footer .legal-inline-links a, .home-final-footer .legal-footer-links-row a { color: #ffffff; }",
        ".legal-auto-footer { margin-top: 1.5rem; border-top: 1px solid rgba(37, 93, 58, 0.15); background: #f2f4ef; padding: 1rem 1.2rem; }",
        ".legal-auto-footer-inner { width: min(100%, 980px); margin: 0 auto; display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0.8rem; color: #4f5f5d; font-size: 0.92rem; }",
        ".legal-consent-copy { margin-top: 0.8rem; font-size: 0.76rem; line-height: 1.45; color: #355564; }",
        ".legal-consent-meta { margin-top: 0.34rem; font-size: 0.72rem; line-height: 1.4; color: #536d79; }",
        ".legal-consent-meta .legal-consent-note { margin: 0; color: #536d79; font-size: 0.72rem; }",
        ".legal-consent-checkbox { display: grid; grid-template-columns: 0.94rem minmax(0, 1fr); align-items: flex-start; gap: 0.5rem; margin: 0; }",
        ".legal-consent-checkbox input[type='checkbox'] { width: 0.94rem; min-width: 0.94rem; height: 0.94rem; margin: 0.14rem 0 0; padding: 0; border: 1px solid #8ea4af; border-radius: 2px; background: #ffffff; flex: 0 0 auto; }",
        ".legal-consent-checkbox span { display: block; min-width: 0; }",
        ".legal-consent-meta .legal-consent-links { margin: 0.3rem 0 0; }",
        ".lead-popup-consent-copy { margin-top: 0.65rem; color: #456778; font-size: 0.69rem; line-height: 1.45; }",
        ".lead-popup-consent-meta { margin-top: 0.3rem; color: #5a7d8d; font-size: 0.66rem; line-height: 1.4; }",
        ".lead-popup-consent-checkbox { display: grid; grid-template-columns: 0.88rem minmax(0, 1fr); align-items: flex-start; gap: 0.46rem; margin: 0; color: #335f73; }",
        ".lead-popup-consent-checkbox input[type='checkbox'] { width: 0.88rem; min-width: 0.88rem; height: 0.88rem; margin: 0.12rem 0 0; padding: 0; border: 1px solid #91a7b2; border-radius: 2px; background: #ffffff; flex: 0 0 auto; }",
        ".lead-popup-consent-checkbox span { display: block; min-width: 0; }",
        ".lead-popup-consent-note { margin: 0; color: #5a7d8d; font-size: 0.66rem; }",
        ".lead-popup-consent-links { margin: 0.28rem 0 0; font-size: 0.66rem; }",
        ".lead-popup-consent-links a { color: #1f4b5e; text-decoration: underline; text-underline-offset: 2px; }",
        ".legal-modal { position: fixed; inset: 0; z-index: 1600; display: grid; place-items: center; padding: 1rem; }",
        ".legal-modal[hidden] { display: none; }",
        ".legal-modal-overlay { position: absolute; inset: 0; background: rgba(4, 13, 20, 0.66); }",
        ".legal-modal-dialog { position: relative; width: min(880px, 100%); max-height: min(92vh, 780px); overflow: auto; border-radius: 14px; border: 1px solid rgba(26, 60, 77, 0.22); background: #f8fbfc; box-shadow: 0 22px 58px rgba(0, 0, 0, 0.32); padding: clamp(1rem, 2.3vw, 1.5rem) clamp(1rem, 2.5vw, 1.7rem); }",
        ".legal-modal-close { position: absolute; top: 0.6rem; right: 0.7rem; width: 2rem; height: 2rem; border: 0; border-radius: 999px; background: rgba(31, 75, 94, 0.12); color: #1f4b5e; font-size: 1.2rem; line-height: 1; cursor: pointer; }",
        ".legal-modal-title { margin: 0 2rem 0.45rem 0; color: #123649; font-size: clamp(1.24rem, 2.2vw, 1.6rem); font-weight: 800; }",
        ".legal-modal-meta { margin: 0 0 0.7rem; color: #527081; font-size: 0.84rem; }",
        ".legal-modal-body { color: #21495c; font-size: 0.91rem; line-height: 1.55; }",
        ".legal-modal-body h4 { margin: 0.95rem 0 0.25rem; color: #173f53; font-size: 0.96rem; }",
        ".legal-modal-body p { margin: 0.38rem 0; }",
        ".legal-modal-body ol { margin: 0.45rem 0 0.35rem 1.15rem; padding: 0; }",
        ".legal-modal-body li { margin: 0.36rem 0; }",
        "body.legal-modal-open { overflow: hidden; }",
        "@media (max-width: 640px) { .legal-modal-dialog { padding: 0.9rem 0.88rem 1rem; border-radius: 10px; } .legal-modal-body { font-size: 0.86rem; } .legal-auto-footer-inner { font-size: 0.84rem; } }"
      ].join("\n");
      document.head.appendChild(styleNode);
    };

    var createAutoFooter = function () {
      var footer = document.createElement("footer");
      footer.className = "site-footer legal-auto-footer";
      footer.innerHTML = [
        "<div class='legal-auto-footer-inner'>",
        "<span>&copy; " + String(new Date().getFullYear()) + " " + legalBusinessName + "</span>",
        "<span><a href='/consult/'>Contact</a> | <a href='/relocation/'>Relocation</a> | <a href='/learning-center/'>Learning Center</a></span>",
        "</div>"
      ].join("");
      var appendTarget = document.querySelector(".site-shell") || document.body;
      appendTarget.appendChild(footer);
      return footer;
    };

    var replaceBrandingText = function (node) {
      if (!node) {
        return;
      }
      var nextHtml = String(node.innerHTML || "")
        .replace(/The Living in Raleigh NC Team/gi, "The Living in Raleigh LLC Team")
        .replace(/Living in Raleigh NC Team/gi, "Living in Raleigh LLC")
        .replace(/Living in Raleigh NC/gi, "Living in Raleigh LLC");
      if (node.innerHTML !== nextHtml) {
        node.innerHTML = nextHtml;
      }
    };

    var ensureFooterBranding = function (footer) {
      if (!footer) {
        return;
      }
      footer.querySelectorAll(".home-final-team-name, .home-final-bottom-row > span:first-child, .row > span:first-child, .legal-auto-footer-inner > span:first-child").forEach(replaceBrandingText);
      footer.querySelectorAll(".home-final-disclaimer").forEach(function (node) {
        if (node.textContent.indexOf("Living in Raleigh LLC") === -1) {
          node.textContent = node.textContent + " Operated by " + legalDisplayName + ".";
        }
      });
    };

    var ensureFooterLegalLinks = function (footer) {
      if (!footer || footer.querySelector("[data-legal-footer-links]")) {
        return;
      }
      var target = footer.querySelector(".home-final-bottom-row span:last-child, .row span:last-child, .legal-auto-footer-inner span:last-child");
      if (target) {
        var inlineLinks = document.createElement("span");
        inlineLinks.className = "legal-inline-links";
        inlineLinks.setAttribute("data-legal-footer-links", "true");
        inlineLinks.innerHTML = legalLinksMarkup;
        if (String(target.textContent || "").replace(/\s+/g, "").length) {
          target.appendChild(document.createTextNode(" | "));
        }
        target.appendChild(inlineLinks);
        return;
      }
      var container = footer.querySelector(".home-final-footer-inner, .container, .row, .legal-auto-footer-inner") || footer;
      var row = document.createElement("div");
      row.className = "legal-footer-links-row";
      row.setAttribute("data-legal-footer-links", "true");
      row.innerHTML = legalLinksMarkup;
      container.appendChild(row);
    };

    var buildLegalBodyHtml = function (documentType) {
      if (documentType === "terms") {
        return [
          "<h4>Website Use</h4>",
          "<p>This website is provided by " + legalDisplayName + " for general informational purposes related to residential real estate services.</p>",
          "<h4>No Professional Advice</h4>",
          "<p>Information on this site is not legal, tax, mortgage, or appraisal advice. You should consult your own licensed professionals before making decisions.</p>",
          "<h4>Service Availability</h4>",
          "<p>Real estate services are subject to market conditions, brokerage requirements, and applicable federal, state, and local laws, including fair housing requirements.</p>",
          "<h4>Communications Consent</h4>",
          "<p>By submitting your information, you consent to communications regarding your request. SMS consent is optional. Reply STOP to unsubscribe and HELP for assistance. Message and data rates may apply. Message frequency varies.</p>",
          "<p>We use SMS to confirm appointments, send reminders, and notify clients of schedule updates or important changes. Carriers are not liable for delayed or undelivered messages.</p>",
          "<h4>Intellectual Property</h4>",
          "<p>Site content, branding, and media are owned by or licensed to " + legalBusinessName + ". Unauthorized copying or distribution is prohibited.</p>",
          "<h4>Limitation of Liability</h4>",
          "<p>All information is deemed reliable but not guaranteed. We are not liable for decisions made based on website content or third-party links/tools.</p>",
          "<h4>Updates</h4>",
          "<p>We may update these terms periodically. Continued use of the site indicates acceptance of updated terms.</p>"
        ].join("");
      }

      return [
        "<h4>Information We Collect</h4>",
        "<p>We collect information you provide directly, including name, email, phone number, address details, and questionnaire responses.</p>",
        "<h4>How We Use Information</h4>",
        "<p>We use your information to respond to your inquiries, provide real estate services, deliver requested resources, and improve website performance.</p>",
        "<h4>SMS and Phone Communications</h4>",
        "<p>When SMS consent is provided, " + legalDisplayName + " may send text updates related to your real estate request. Message frequency varies and message/data rates may apply. Reply STOP to unsubscribe and HELP for help.</p>",
        "<h4>SMS Terms and Conditions</h4>",
        "<ol>",
        "<li>We use SMS to confirm appointments, send reminders, and notify clients of schedule updates or important changes.</li>",
        "<li>You can cancel the SMS service at any time. Just text \"STOP\". After you send the SMS message \"STOP\" to us, we will send you an SMS message to confirm that you have been unsubscribed. After this, you will no longer receive SMS messages from us. If you want to join again, just sign up as you did the first time, and we will start sending SMS messages to you again.</li>",
        "<li>If you are experiencing issues with the messaging program you can reply with the keyword \"HELP\" for more assistance, or you can get help directly at <a href='mailto:" + legalContactEmail + "'>" + legalContactEmail + "</a>.</li>",
        "<li>Carriers are not liable for delayed or undelivered messages.</li>",
        "<li>As always, message and data rates may apply for any messages sent to you from us and to us from you. Message frequency may vary. If you have any questions about your text plan or data plan, it is best to contact your wireless provider.</li>",
        "<li>If you have any questions regarding privacy, please read our privacy policy: <a href='" + legalPrivacyPolicyUrl + "' target='_blank' rel='noopener noreferrer'>" + legalPrivacyPolicyUrl + "</a>.</li>",
        "</ol>",
        "<h4>Sharing</h4>",
          "<p>We do not sell personal data. Data will not be sold or shared with third parties for marketing or promotional purposes, including phone numbers.</p>",
          "<p>We may share data with service providers that support website operations, scheduling, CRM, or communication delivery solely to provide our services.</p>",
        "<h4>Cookies and Analytics</h4>",
        "<p>We use analytics and browser storage to measure engagement and improve conversion performance across pages and forms.</p>",
        "<h4>Data Retention and Security</h4>",
        "<p>We retain information as needed for business and legal purposes and use reasonable safeguards to protect your data.</p>",
        "<h4>Your Choices</h4>",
        "<p>You may request updates or deletion of your information by contacting us at <a href='mailto:" + legalContactEmail + "'>" + legalContactEmail + "</a>, subject to legal retention obligations.</p>",
        "<h4>Policy Updates</h4>",
        "<p>We may update this policy from time to time. Material updates will appear on this page with a revised effective date.</p>"
      ].join("");
    };

    var ensureLegalModal = function () {
      if (legalModal) {
        return legalModal;
      }
      var existing = document.querySelector("[data-legal-modal]");
      if (existing) {
        legalModal = existing;
        return legalModal;
      }
      legalModal = document.createElement("div");
      legalModal.className = "legal-modal";
      legalModal.setAttribute("data-legal-modal", "true");
      legalModal.setAttribute("aria-hidden", "true");
      legalModal.hidden = true;
      legalModal.innerHTML = [
        "<div class='legal-modal-overlay' data-legal-close></div>",
        "<div class='legal-modal-dialog' role='dialog' aria-modal='true' aria-labelledby='legal-modal-title'>",
        "<button type='button' class='legal-modal-close' aria-label='Close policy dialog' data-legal-close>&times;</button>",
        "<h2 class='legal-modal-title' id='legal-modal-title'></h2>",
        "<p class='legal-modal-meta'>Effective date: " + legalEffectiveDate + "</p>",
        "<div class='legal-modal-body' data-legal-modal-body></div>",
        "</div>"
      ].join("");
      document.body.appendChild(legalModal);
      return legalModal;
    };

    var setLegalModalContent = function (documentType) {
      var modalNode = ensureLegalModal();
      var titleNode = modalNode.querySelector("#legal-modal-title");
      var bodyNode = modalNode.querySelector("[data-legal-modal-body]");
      var type = documentType === "terms" ? "terms" : "privacy";
      if (titleNode) {
        titleNode.textContent = type === "terms" ? "Terms of Service" : "Privacy Policy";
      }
      if (bodyNode) {
        bodyNode.innerHTML = buildLegalBodyHtml(type);
      }
    };

    var openLegalModal = function (documentType) {
      setLegalModalContent(documentType);
      var modalNode = ensureLegalModal();
      modalNode.hidden = false;
      modalNode.setAttribute("aria-hidden", "false");
      document.body.classList.add("legal-modal-open");
    };

    var closeLegalModal = function () {
      var modalNode = ensureLegalModal();
      if (modalNode.hidden) {
        return;
      }
      modalNode.hidden = true;
      modalNode.setAttribute("aria-hidden", "true");
      document.body.classList.remove("legal-modal-open");
    };

    var ensureFormConsentBlock = function (form) {
      if (!form || form.querySelector("[data-legal-consent]")) {
        return;
      }
      var hasEmailInput = Boolean(form.querySelector("input[type='email'], textarea"));
      var hasPhoneInput = Boolean(form.querySelector("input[type='tel']"));
      if (!hasEmailInput && !hasPhoneInput) {
        return;
      }
      var submitButton = form.querySelector("button[type='submit'], input[type='submit']");
      if (!submitButton) {
        return;
      }

      var consentNode = document.createElement("div");
      consentNode.className = "legal-consent-copy";
      consentNode.setAttribute("data-legal-consent", "true");

      var consentMetaNode = document.createElement("div");
      consentMetaNode.className = "legal-consent-meta";

      if (hasPhoneInput) {
        consentNode.innerHTML = "<label class='legal-consent-checkbox'><input type='checkbox' name='sms_opt_in'><span>" + smsConsentDisclosureText + "</span></label>";
        consentMetaNode.innerHTML = "<p class='legal-consent-note'>" + smsConsentOptionalNoteText + "</p><p class='legal-consent-links'>Review our <a href='/privacy-policy/' target='_blank' rel='noopener noreferrer'>Privacy Policy</a> and <a href='/terms-of-service/' target='_blank' rel='noopener noreferrer'>Terms of Service</a>.</p>";
      } else {
        consentNode.innerHTML = "<p class='legal-consent-note'>By submitting this form, you consent to call and email communications from " + legalDisplayName + " related to your request.</p>";
        consentMetaNode.innerHTML = "<p class='legal-consent-links'>Review our <a href='/privacy-policy/' target='_blank' rel='noopener noreferrer'>Privacy Policy</a> and <a href='/terms-of-service/' target='_blank' rel='noopener noreferrer'>Terms of Service</a>.</p>";
      }

      var submitGroupNode = submitButton.closest("p, div") || submitButton;
      if (submitGroupNode && submitGroupNode.parentNode) {
        submitGroupNode.insertAdjacentElement("beforebegin", consentNode);
        submitGroupNode.insertAdjacentElement("afterend", consentMetaNode);
      } else {
        form.appendChild(consentNode);
        form.appendChild(consentMetaNode);
      }
    };

    injectLegalStyles();
    var footerNodes = Array.prototype.slice.call(document.querySelectorAll("footer"));
    if (!footerNodes.length) {
      footerNodes = [createAutoFooter()];
    }
    footerNodes.forEach(function (footer) {
      ensureFooterBranding(footer);
      ensureFooterLegalLinks(footer);
    });
    ensureLegalModal();

    Array.prototype.slice.call(document.querySelectorAll("form")).forEach(ensureFormConsentBlock);

    document.addEventListener("click", function (event) {
      var opener = event.target.closest("[data-legal-open]");
      if (opener) {
        var targetHref = String(opener.getAttribute("href") || "");
        if (!targetHref || targetHref.charAt(0) === "#") {
          event.preventDefault();
          openLegalModal(opener.getAttribute("data-legal-open"));
          return;
        }
      }
      if (event.target.closest("[data-legal-close]")) {
        event.preventDefault();
        closeLegalModal();
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeLegalModal();
      }
    });
  })();
})();
