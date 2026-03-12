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
      "/explore-the-area/north-raleigh/",
      "/explore-the-area/rolesville/",
      "/explore-the-area/wake-forest/",
      "/explore-the-area/youngsville/",
      "/explore-the-area/itb/"
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
      "north raleigh": "/explore-the-area/north-raleigh/",
      "rolesville": "/explore-the-area/rolesville/",
      "wake forest": "/explore-the-area/wake-forest/",
      "youngsville": "/explore-the-area/youngsville/",
      "itb": "/explore-the-area/itb/",
      "inside the beltline": "/explore-the-area/itb/",
      "raleigh inside the beltline": "/explore-the-area/itb/",
      "raleigh (inside the beltline itb)": "/explore-the-area/itb/"
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
      "north raleigh",
      "rolesville",
      "wake forest",
      "youngsville",
      "itb"
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
      "1169": "/explore-the-area/north-raleigh/",
      "293": "/explore-the-area/rolesville/",
      "598": "/explore-the-area/wake-forest/",
      "493": "/explore-the-area/youngsville/",
      "423": "/explore-the-area/itb/"
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
        region.setAttribute("data-route-bound", "true");

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

  var featuredVideosSection = document.querySelector(".home-featured-videos");
  if (featuredVideosSection) {
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
      card.appendChild(play);
      card.appendChild(meta);
      return card;
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
      bindVideoCardEvents();
      renderPage(1);
    };

    if (videoModal) {
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
      window.fetch("/assets/data/featured-videos.json?ts=" + String(Date.now()), { cache: "no-store" })
        .then(function (response) {
          if (!response.ok) {
            throw new Error("Unable to load featured videos JSON");
          }
          return response.json();
        })
        .then(function (payload) {
          var videos = payload && Array.isArray(payload.videos) ? payload.videos : [];
          if (!videos.length) {
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

          setVideoCards(Array.prototype.slice.call(videoGrid.querySelectorAll(".home-video-card")));
        })
        .catch(function () {
          // Keep static fallback cards when feed JSON is unavailable.
        });
    }
  }
})();
