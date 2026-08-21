(function () {
  var params = new URLSearchParams(window.location.search);
  var enabled = params.get('layoutEditor') === '1' || params.get('edit') === '1';
  var referenceMode = params.get('reference') === '1';
  var is2026Page = document.body && document.body.classList.contains('page-2026');
  var isConsultPage = document.body && document.body.classList.contains('page-consult');

  if (!document.body || referenceMode || (!is2026Page && !isConsultPage)) {
    return;
  }

  var PAGE_KEY = isConsultPage ? 'consult' : '2026';
  var STORAGE_KEY = PAGE_KEY === 'consult' ? 'raleigh-consult-layout-editor-state-v1' : 'raleigh-2026-layout-editor-state-v3';
  var HISTORY_KEY = PAGE_KEY === 'consult' ? 'raleigh-consult-layout-editor-history-v1' : 'raleigh-2026-layout-editor-history-v2';
  var TOOLBAR_KEY = PAGE_KEY === 'consult' ? 'raleigh-consult-layout-editor-toolbar-v1' : 'raleigh-2026-layout-editor-toolbar-v1';
  var MAX_HISTORY = 20;
  var TOOLBAR_TITLE = PAGE_KEY === 'consult' ? 'Consult Layout Editor' : '2026 Layout Editor';
  var TOOLBAR_HINT = PAGE_KEY === 'consult'
    ? 'Drag the square or the logo separately. Drag the orange corner to resize the selected layer. Double-click a layer to select it. The JSON below updates live.'
    : 'Drag the consultation block to move it. Drag the orange corner to scale it. The inner contents stay locked to the block. Double-click the block to select it. The JSON below updates live.';
  var DEFAULT_STATE = window.__LAYOUT_EDITOR_DEFAULT_STATE__ || {};
  var targetDefs = isConsultPage
    ? [
        { id: 'consult-banner-square', label: 'Consult square', selector: '.consult-banner-square', move: true, resize: true, minW: 140, minH: 140, crop: false, fit: 'contain', lockAspect: true },
        { id: 'consult-banner-image', label: 'Consult logo', selector: '.consult-banner-image', move: true, resize: true, minW: 120, minH: 120, crop: false, fit: 'contain', lockAspect: true }
      ]
    : [
        { id: 'consult-banner-square', label: 'Header square', selector: '.consult-banner-square', move: true, resize: true, minW: 140, minH: 140, crop: false, fit: 'contain', lockAspect: true },
        { id: 'consult-banner-image', label: 'Header logo', selector: '.consult-banner-image', move: true, resize: true, minW: 120, minH: 120, crop: false, fit: 'contain', lockAspect: true },
        { id: 'guide-title', label: 'Guide title', selector: '.guide-left h1', move: true, resize: true, minW: 280, minH: 70 },
        { id: 'guide-subtitle', label: 'Guide subtitle', selector: '.guide-left h2', move: true, resize: true, minW: 160, minH: 28 },
        { id: 'guide-book', label: 'Book image', selector: '.guide-book-shell', move: true, resize: true, minW: 110, minH: 140, crop: false, fit: 'contain', lockAspect: true },
        { id: 'guide-button', label: 'Download button', selector: '.download-btn', move: true, resize: true, minW: 240, minH: 42 },
        { id: 'consult-card', label: 'Consult card', selector: '.consultation-card', move: true, resize: true, minW: 520, minH: 260, defaultMode: 'scale', crop: false, lockAspect: true }
      ];

  var state = loadState();
  var snapshots = loadSnapshots();
  var lastSnapshotSignature = signatureOf(state);
  var items = [];
  var overlays = new Map();
  var active = null;
  var dragMode = null;
  var dragStart = null;
  var toolbar = null;
  var toolbarState = loadToolbarState();
  var toolbarDrag = null;
  var editorMode = enabled;
  var shouldApplyLayout = editorMode || window.innerWidth > 1100;

  if (!shouldApplyLayout) {
    return;
  }

  if (editorMode) {
    injectStyles();
    document.body.classList.add('layout-editor-active');
    document.querySelectorAll('iframe').forEach(function (frame) {
      frame.style.pointerEvents = 'none';
    });
  }

  targetDefs.forEach(function (def) {
    var el = document.querySelector(def.selector);
    if (!el) return;
    def.el = el;
    if (def.id === 'consult-iframe-box') {
      def.initialFrameVars = readFrameVars(el);
    }
    if (def.resize) {
      var initialRect = el.getBoundingClientRect();
      def.initialBaseW = Math.round(initialRect.width);
      def.initialBaseH = Math.round(initialRect.height);
    }
    def.state = ensureState(def, el);
    applyState(def);
    el.dataset.layoutEditorId = def.id;
    if (editorMode) {
      el.classList.add('layout-editor-target');
    }
    items.push(def);
    if (editorMode) {
      overlays.set(def.id, createOverlay(def));
    }
  });

  function loadState() {
    if (!editorMode) {
      return mergeState(DEFAULT_STATE, {});
    }
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
      return mergeState(DEFAULT_STATE, saved);
    } catch (err) {
      return mergeState(DEFAULT_STATE, {});
    }
  }

  function saveState() {
    if (!editorMode) return;
    items.forEach(syncConsultModeSnapshot);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function cloneState(value) {
    return JSON.parse(JSON.stringify(value || {}));
  }

  function signatureOf(value) {
    try {
      return JSON.stringify(value || {});
    } catch (err) {
      return '';
    }
  }

  function loadSnapshots() {
    if (!editorMode) return [];
    try {
      var saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      return Array.isArray(saved) ? saved : [];
    } catch (err) {
      return [];
    }
  }

  function saveSnapshots() {
    if (!editorMode) return;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(snapshots));
  }

  function loadToolbarState() {
    if (!editorMode) return {};
    try {
      var saved = JSON.parse(localStorage.getItem(TOOLBAR_KEY) || '{}');
      return saved && typeof saved === 'object' ? saved : {};
    } catch (err) {
      return {};
    }
  }

  function readFrameVars(el) {
    var root = el && (el.ownerDocument || document).documentElement;
    var source = el || root;
    var styles = source ? window.getComputedStyle(source) : null;
    var rootStyles = root ? window.getComputedStyle(root) : null;

    function parsePx(value, fallback) {
      var num = parseFloat(String(value || '').replace('px', ''));
      return isFinite(num) ? num : fallback;
    }

    return {
      frame: parsePx(styles && styles.getPropertyValue('--frame'), parsePx(rootStyles && rootStyles.getPropertyValue('--frame'), null)),
      frameW: parsePx(styles && styles.getPropertyValue('--frame-w'), parsePx(rootStyles && rootStyles.getPropertyValue('--frame-w'), null)),
      frameH: parsePx(styles && styles.getPropertyValue('--frame-h'), parsePx(rootStyles && rootStyles.getPropertyValue('--frame-h'), null))
    };
  }

  function saveToolbarState() {
    if (!editorMode) return;
    try {
      localStorage.setItem(TOOLBAR_KEY, JSON.stringify(toolbarState || {}));
    } catch (err) {}
  }

  function formatSnapshotLabel(entry, index) {
    var when = entry && entry.createdAt ? new Date(entry.createdAt) : null;
    var stamp = when && !isNaN(when.getTime())
      ? when.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
      : 'Saved';
    var reason = entry && entry.reason ? entry.reason : 'Snapshot';
    return (index + 1) + '. ' + stamp + ' - ' + reason;
  }

  function updateToolbarTextarea() {
    if (!toolbar) return;
    var output = toolbar.querySelector('textarea');
    if (output) {
      output.value = JSON.stringify(state, null, 2);
    }
  }

  function renderHistory() {
    if (!toolbar) return;
    var list = toolbar.querySelector('[data-history-list]');
    if (!list) return;

    list.innerHTML = '';
    if (!snapshots.length) {
      var empty = document.createElement('div');
      empty.className = 'layout-editor-history-empty';
      empty.textContent = 'No snapshots yet.';
      list.appendChild(empty);
      return;
    }

    snapshots.slice().reverse().forEach(function (entry) {
      var index = snapshots.indexOf(entry);
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'secondary layout-editor-history-item';
      button.setAttribute('data-snapshot-index', String(index));
      button.textContent = formatSnapshotLabel(entry, index);
      list.appendChild(button);
    });
  }

  function recordSnapshot(reason, force) {
    var currentSignature = signatureOf(state);
    if (!force && currentSignature === lastSnapshotSignature) {
      return null;
    }

    snapshots.push({
      id: 'snap-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
      createdAt: new Date().toISOString(),
      reason: reason || 'Snapshot',
      state: cloneState(state)
    });

    if (snapshots.length > MAX_HISTORY) {
      snapshots = snapshots.slice(-MAX_HISTORY);
    }

    lastSnapshotSignature = currentSignature;
    saveSnapshots();
    updateToolbarTextarea();
    renderHistory();
    return snapshots[snapshots.length - 1];
  }

  function restoreSnapshot(index) {
    var entry = snapshots[index];
    if (!entry) return;

    state = mergeState(DEFAULT_STATE, cloneState(entry.state));
    items.forEach(function (item) {
      if (!item.el) return;
      item.state = ensureState(item, item.el);
      applyState(item);
    });

    saveState();
    lastSnapshotSignature = signatureOf(state);
    updateToolbarTextarea();
    renderHistory();
    saveSnapshots();
  }

  function defaultStateFor(el) {
    var rect = el.getBoundingClientRect();
    return {
      tx: 0,
      ty: 0,
      w: Math.round(rect.width),
      h: Math.round(rect.height),
      fit: 'contain'
    };
  }

  function mergeState(base, incoming) {
    var merged = {};
    var seed = base || {};
    var saved = incoming || {};

    Object.keys(seed).forEach(function (key) {
      merged[key] = Object.assign({}, seed[key]);
    });

    Object.keys(saved).forEach(function (key) {
      merged[key] = Object.assign({}, merged[key] || {}, saved[key] || {});
    });

    return merged;
  }

  function ensureState(def, el) {
    var next = state[def.id] || defaultStateFor(el);
    if (typeof next.tx !== 'number') next.tx = 0;
    if (typeof next.ty !== 'number') next.ty = 0;
    if (def.resize) {
      if (typeof next.w !== 'number') next.w = Math.round(el.getBoundingClientRect().width);
      if (typeof next.h !== 'number') next.h = Math.round(el.getBoundingClientRect().height);
    }
    if (typeof next.mode !== 'string') next.mode = def.defaultMode || (def.crop ? 'crop' : 'scale');
    if (typeof next.scale !== 'number') next.scale = 1;
    if (def.fit && !next.fit) next.fit = def.fit;
    if (def.id === 'guide-book') next.fit = 'contain';
    if (isConsultPairTarget(def)) {
      next.mode = 'scale';
      if (!next.modeStates || typeof next.modeStates !== 'object') {
        next.modeStates = {};
      }
      if (!next.modeStates.scale || typeof next.modeStates.scale !== 'object') {
        next.modeStates.scale = {};
      }
      if (!next.modeStates.crop || typeof next.modeStates.crop !== 'object') {
        next.modeStates.crop = {};
      }
    }
    state[def.id] = next;
    if (isConsultPairTarget(def)) {
      var stores = ensureConsultModeStores(def);
      if (stores) {
        var currentMode = 'scale';
        var currentBucket = stores[currentMode];
        if (currentBucket && !hasSnapshotValues(currentBucket)) {
          currentBucket.tx = next.tx;
          currentBucket.ty = next.ty;
          if (def.resize) {
            if (typeof next.w === 'number') currentBucket.w = next.w;
            if (typeof next.h === 'number') currentBucket.h = next.h;
            if (typeof next.scale === 'number' && isFinite(next.scale) && next.scale > 0) {
              currentBucket.scale = next.scale;
            }
          }
          if (typeof next.fit === 'string') {
            currentBucket.fit = next.fit;
          }
        }
      }
    }
    return next;
  }

  function getTargetMode(def) {
    if (isConsultPairTarget(def)) return 'scale';
    if (!def || !def.state) return def && def.defaultMode ? def.defaultMode : 'scale';
    return def.state.mode || def.defaultMode || (def.crop ? 'crop' : 'scale');
  }

  function ensureConsultModeStores(def) {
    if (!isConsultPairTarget(def) || !def.state) return null;
    if (!def.state.modeStates || typeof def.state.modeStates !== 'object') {
      def.state.modeStates = {};
    }
    if (!def.state.modeStates.scale || typeof def.state.modeStates.scale !== 'object') {
      def.state.modeStates.scale = {};
    }
    if (!def.state.modeStates.crop || typeof def.state.modeStates.crop !== 'object') {
      def.state.modeStates.crop = {};
    }
    return def.state.modeStates;
  }

  function hasSnapshotValues(snapshot) {
    return !!snapshot && Object.keys(snapshot).length > 0;
  }

  function syncConsultModeSnapshot(def) {
    if (!isConsultPairTarget(def) || !def.state) return;
    var stores = ensureConsultModeStores(def);
    if (!stores) return;

    var mode = getTargetMode(def);
    var bucket = stores[mode];
    if (!bucket) return;

    bucket.tx = typeof def.state.tx === 'number' ? def.state.tx : 0;
    bucket.ty = typeof def.state.ty === 'number' ? def.state.ty : 0;

    if (def.resize) {
      if (typeof def.state.w === 'number' && isFinite(def.state.w)) bucket.w = def.state.w;
      if (typeof def.state.h === 'number' && isFinite(def.state.h)) bucket.h = def.state.h;
      if (typeof def.state.scale === 'number' && isFinite(def.state.scale) && def.state.scale > 0) {
        bucket.scale = def.state.scale;
      }
    }

    if (typeof def.state.fit === 'string') {
      bucket.fit = def.state.fit;
    }
  }

  function restoreConsultModeSnapshot(def, mode, rect) {
    if (!isConsultPairTarget(def) || !def.state) return;
    var stores = ensureConsultModeStores(def);
    if (!stores) return;

    var bucket = stores[mode];
    if (!bucket) return;

    var currentRect = rect || (def.el ? def.el.getBoundingClientRect() : null);
    var baseW = def.initialBaseW || (currentRect ? Math.round(currentRect.width) : 1) || 1;
    var baseH = def.initialBaseH || (currentRect ? Math.round(currentRect.height) : 1) || 1;

    if (!hasSnapshotValues(bucket)) {
      bucket.tx = typeof def.state.tx === 'number' ? def.state.tx : 0;
      bucket.ty = typeof def.state.ty === 'number' ? def.state.ty : 0;

      if (def.resize) {
        if (mode === 'scale') {
          var scale = 1;
          if (currentRect && baseW && baseH) {
            scale = Math.max(
              0.1,
              (currentRect.width / baseW) || 1,
              (currentRect.height / baseH) || 1
            );
          }
          bucket.scale = scale;
          bucket.w = Math.round(baseW * scale);
          bucket.h = Math.round(baseH * scale);
        } else if (currentRect) {
          bucket.w = Math.round(currentRect.width);
          bucket.h = Math.round(currentRect.height);
        }
      }

      if (typeof def.state.fit === 'string') {
        bucket.fit = def.state.fit;
      }
    }

    def.state.tx = typeof bucket.tx === 'number' ? bucket.tx : 0;
    def.state.ty = typeof bucket.ty === 'number' ? bucket.ty : 0;
    if (def.resize) {
      if (typeof bucket.w === 'number' && isFinite(bucket.w)) def.state.w = bucket.w;
      if (typeof bucket.h === 'number' && isFinite(bucket.h)) def.state.h = bucket.h;
      if (typeof bucket.scale === 'number' && isFinite(bucket.scale) && bucket.scale > 0) {
        def.state.scale = bucket.scale;
      }
    }
    if (typeof bucket.fit === 'string') {
      def.state.fit = bucket.fit;
    }
  }

  function isConsultPairTarget(def) {
    return !!def && PAGE_KEY === '2026' && def.id === 'consult-card';
  }

  function isConsultPairLocked() {
    if (PAGE_KEY !== '2026') return false;
    if (typeof toolbarState.consultPairLocked !== 'boolean') {
      toolbarState.consultPairLocked = true;
    }
    return !!toolbarState.consultPairLocked;
  }

  function setConsultPairLocked(next) {
    toolbarState.consultPairLocked = !!next;
    saveToolbarState();
    updateToolbarControls();
  }

  function updateToolbarControls() {
    if (!toolbar) return;
    var locked = isConsultPairLocked();
    var lockBtn = toolbar.querySelector('[data-action="toggle-group-lock"]');
    if (lockBtn) {
      lockBtn.textContent = locked ? 'Card + iframe: Locked' : 'Card + iframe: Unlocked';
      lockBtn.classList.toggle('is-on', locked);
      lockBtn.hidden = true;
    }

    ['focus-card', 'focus-iframe'].forEach(function (action) {
      var focusBtn = toolbar.querySelector('[data-action="' + action + '"]');
      if (focusBtn) {
        focusBtn.hidden = true;
      }
    });

    var modeBtn = toolbar.querySelector('[data-action="toggle-mode"]');
    if (modeBtn) {
      var activeTarget = active && isConsultPairTarget(active) ? active : null;
      if (!activeTarget || PAGE_KEY === 'consult') {
        modeBtn.disabled = true;
        modeBtn.textContent = 'Scale only';
      } else {
        modeBtn.disabled = true;
        modeBtn.textContent = 'Scale only';
      }
      modeBtn.hidden = true;
    }
  }

  function clearCropStyles(el) {
    el.style.overflow = '';
    el.style.position = '';
    el.style.objectFit = '';
    el.style.display = '';
  }

  function applyState(def) {
    var el = def.el;
    var s = def.state;
    if (!el) return;
    var mode = getTargetMode(def);
    var isScaleMode = mode === 'scale';
    var baseW = def.initialBaseW || Math.round(el.getBoundingClientRect().width) || 1;
    var baseH = def.initialBaseH || Math.round(el.getBoundingClientRect().height) || 1;

    el.style.translate = (s.tx || 0) + 'px ' + (s.ty || 0) + 'px';
    if (def.resize) {
      if (isScaleMode) {
        var scale = typeof s.scale === 'number' && isFinite(s.scale) && s.scale > 0
          ? s.scale
          : Math.max(
              0.1,
              (typeof s.w === 'number' && baseW ? s.w / baseW : 1) || 1,
              (typeof s.h === 'number' && baseH ? s.h / baseH : 1) || 1
            );
        if (!isFinite(scale) || scale <= 0) scale = 1;
        s.scale = scale;
        s.w = Math.round(baseW * scale);
        s.h = Math.round(baseH * scale);
        el.style.width = baseW + 'px';
        el.style.height = baseH + 'px';
        el.style.scale = String(scale);
        el.style.transformOrigin = 'top left';
      } else {
        el.style.scale = '';
        el.style.transformOrigin = '';
        if (s.w) el.style.width = s.w + 'px';
        if (s.h) el.style.height = s.h + 'px';
      }
    }

    if (isScaleMode) {
      clearCropStyles(el);
    } else if (def.crop) {
      el.style.overflow = 'hidden';
      el.style.position = 'relative';
      if (el.tagName === 'IMG') {
        el.style.objectFit = s.fit || def.fit || 'cover';
        el.style.display = 'block';
      } else {
        var img = el.querySelector('img');
        if (img) {
          img.style.width = '100%';
          img.style.height = '100%';
          img.style.objectFit = s.fit || def.fit || 'cover';
          img.style.display = 'block';
        }
      }
    }

    if (def.id === 'consult-iframe-box') {
      var frameVars = def.initialFrameVars || readFrameVars(el);
      if (isScaleMode) {
        var scaledFrame = frameVars.frame ? Math.round(frameVars.frame * s.scale) : null;
        var scaledFrameW = frameVars.frameW ? Math.round(frameVars.frameW * s.scale) : null;
        var scaledFrameH = frameVars.frameH ? Math.round(frameVars.frameH * s.scale) : null;
        if (scaledFrame) el.style.setProperty('--frame', scaledFrame + 'px');
        if (scaledFrameW) el.style.setProperty('--frame-w', scaledFrameW + 'px');
        if (scaledFrameH) el.style.setProperty('--frame-h', scaledFrameH + 'px');
      } else {
        el.style.removeProperty('--frame');
        el.style.removeProperty('--frame-w');
        el.style.removeProperty('--frame-h');
      }
    }

    el.classList.toggle('layout-editor-crop', !isScaleMode && !!def.crop);
    el.classList.toggle('layout-editor-scale', isScaleMode);

    if (isConsultPairTarget(def)) {
      syncConsultModeSnapshot(def);
    }
  }

  function createOverlay(def) {
    var overlay = document.createElement('div');
    overlay.className = 'layout-editor-overlay';
    overlay.dataset.targetId = def.id;
    overlay.innerHTML = '<div class="layout-editor-label"></div><div class="layout-editor-handle" title="Resize"></div>';
    document.body.appendChild(overlay);

    overlay.addEventListener('pointerdown', function (ev) {
      if (def.move === false) return;
      if (ev.target.classList.contains('layout-editor-handle')) return;
      ev.preventDefault();
      ev.stopPropagation();
      beginMove(def, ev);
    });

    overlay.querySelector('.layout-editor-handle').addEventListener('pointerdown', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      beginResize(def, ev);
    });

    overlay.addEventListener('dblclick', function () {
      selectTarget(def.id);
    });

    return overlay;
  }

  function syncOverlay(def) {
    var overlay = overlays.get(def.id);
    if (!overlay || !def.el) return;
    var rect = def.el.getBoundingClientRect();
    overlay.style.left = rect.left + 'px';
    overlay.style.top = rect.top + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
    var zIndex = 20000 + (active && active.id === def.id ? 100 : 0);
    if (def.id === 'consult-card') zIndex += 1;
    if (def.id === 'consult-iframe-box') zIndex += 2;
    overlay.style.zIndex = String(zIndex);
    var label = def.label;
    if (isConsultPairTarget(def)) {
      label += ' · ' + (getTargetMode(def) === 'scale' ? 'Scale' : 'Crop');
      if (def.id === 'consult-iframe-box' && isConsultPairLocked()) label += ' · Linked';
    }
    overlay.querySelector('.layout-editor-label').textContent = label;
    overlay.classList.toggle('is-locked', PAGE_KEY === '2026' && def.id === 'consult-iframe-box' && isConsultPairLocked());
    overlay.style.pointerEvents = (PAGE_KEY === '2026' && def.id === 'consult-iframe-box' && isConsultPairLocked()) ? 'none' : 'auto';
    overlay.classList.toggle('is-active', active && active.id === def.id);
  }

  function syncLoop() {
    items.forEach(syncOverlay);
    requestAnimationFrame(syncLoop);
  }

  function selectTarget(id) {
    active = items.find(function (item) { return item.id === id; }) || null;
    items.forEach(function (item) {
      var overlay = overlays.get(item.id);
      if (overlay) overlay.classList.toggle('is-active', active && active.id === item.id);
    });
    updateToolbarControls();
  }

  function beginMove(def, ev) {
    selectTarget(def.id);
    dragMode = 'move';
    dragStart = {
      id: def.id,
      x: ev.clientX,
      y: ev.clientY,
      tx: def.state.tx || 0,
      ty: def.state.ty || 0
    };
    attachPointerHandlers();
  }

  function beginResize(def, ev) {
    selectTarget(def.id);
    dragMode = 'resize';
    var rect = def.el.getBoundingClientRect();
    dragStart = {
      id: def.id,
      x: ev.clientX,
      y: ev.clientY,
      w: Math.round(rect.width),
      h: Math.round(rect.height),
      ratio: rect.height ? (rect.width / rect.height) : 1,
      zoom: typeof def.state.zoom === 'number' ? def.state.zoom : 1,
      mode: getTargetMode(def),
      baseW: def.initialBaseW || Math.round(rect.width) || 1,
      baseH: def.initialBaseH || Math.round(rect.height) || 1,
      scale: typeof def.state.scale === 'number' ? def.state.scale : 1
    };
    attachPointerHandlers();
  }

  function attachPointerHandlers() {
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp, { once: true });
  }

  function onPointerMove(ev) {
    if (!dragStart) return;
    var def = items.find(function (item) { return item.id === dragStart.id; });
    if (!def) return;

    if (dragMode === 'move') {
      var dx = ev.clientX - dragStart.x;
      var dy = ev.clientY - dragStart.y;
      var beforeIframeRect = null;
      var iframeTarget = null;
      def.state.tx = dragStart.tx + dx;
      def.state.ty = dragStart.ty + dy;
      if (PAGE_KEY === '2026') {
        var cardTarget = items.find(function (item) { return item.id === 'consult-card'; }) || null;
        iframeTarget = items.find(function (item) { return item.id === 'consult-iframe-box'; }) || null;
        if (cardTarget && iframeTarget) {
          if (def.id === 'consult-card') {
            if (!isConsultPairLocked()) {
              beforeIframeRect = iframeTarget.el.getBoundingClientRect();
            }
          } else if (def.id === 'consult-iframe-box' && isConsultPairLocked()) {
            cardTarget.state.tx = (cardTarget.state.tx || 0) + dx;
            cardTarget.state.ty = (cardTarget.state.ty || 0) + dy;
            applyState(cardTarget);
          }
        }
      }
    } else if (dragMode === 'resize') {
      var dw = ev.clientX - dragStart.x;
      var dh = ev.clientY - dragStart.y;
      var beforeIframeRect = null;
      var cardDef = null;
      var iframeDef = null;
      var needsIframeCompensation = false;
      if (PAGE_KEY === '2026') {
        cardDef = items.find(function (item) { return item.id === 'consult-card'; }) || null;
        iframeDef = items.find(function (item) { return item.id === 'consult-iframe-box'; }) || null;
        if (cardDef && iframeDef && def.id === 'consult-card' && !isConsultPairLocked()) {
          beforeIframeRect = iframeDef.el.getBoundingClientRect();
          needsIframeCompensation = true;
        }
      }
      if (dragStart.mode === 'scale') {
        var baseW = dragStart.baseW || dragStart.w || 1;
        var baseH = dragStart.baseH || dragStart.h || 1;
        var scaleX = (dragStart.w + dw) / (dragStart.w || 1);
        var scaleY = (dragStart.h + dh) / (dragStart.h || 1);
        var nextScale = def.lockAspect
          ? (Math.abs(dw) >= Math.abs(dh) ? scaleX : scaleY)
          : Math.max(scaleX, scaleY);
        if (!isFinite(nextScale) || nextScale <= 0) nextScale = 0.1;
        def.state.scale = Math.max(0.1, nextScale);
        def.state.w = Math.max(def.minW || 80, Math.round(baseW * def.state.scale));
        def.state.h = Math.max(def.minH || 40, Math.round(baseH * def.state.scale));
      } else if (def.lockAspect) {
        var ratio = dragStart.ratio || 1;
        var scale = Math.abs(dw) >= Math.abs(dh)
          ? (dragStart.w + dw) / dragStart.w
          : (dragStart.h + dh) / dragStart.h;
        if (!isFinite(scale) || scale <= 0) scale = 0.1;
        var nextW = Math.max(def.minW || 80, Math.round(dragStart.w * scale));
        var nextH = Math.max(def.minH || 40, Math.round(nextW / ratio));
        if (nextH < (def.minH || 40)) {
          nextH = Math.max(def.minH || 40, Math.round(dragStart.h * scale));
          nextW = Math.max(def.minW || 80, Math.round(nextH * ratio));
        }
        def.state.w = nextW;
        def.state.h = nextH;
      } else {
        def.state.w = Math.max(def.minW || 80, dragStart.w + dw);
        def.state.h = Math.max(def.minH || 40, dragStart.h + dh);
      }
      if (def.id === 'header-logo' || def.id === 'guide-book') {
        def.state.fit = def.fit || 'cover';
      }
    }

    applyState(def);
    if (dragMode === 'move' && PAGE_KEY === '2026' && def.id === 'consult-card' && iframeTarget && beforeIframeRect && !isConsultPairLocked()) {
      var afterIframeRect = iframeTarget.el.getBoundingClientRect();
      iframeTarget.state.tx = (iframeTarget.state.tx || 0) + (beforeIframeRect.left - afterIframeRect.left);
      iframeTarget.state.ty = (iframeTarget.state.ty || 0) + (beforeIframeRect.top - afterIframeRect.top);
      applyState(iframeTarget);
    }
    if (dragMode === 'resize' && PAGE_KEY === '2026' && def.id === 'consult-card' && needsIframeCompensation && iframeDef && beforeIframeRect) {
      var afterIframeRect = iframeDef.el.getBoundingClientRect();
      iframeDef.state.tx = (iframeDef.state.tx || 0) + (beforeIframeRect.left - afterIframeRect.left);
      iframeDef.state.ty = (iframeDef.state.ty || 0) + (beforeIframeRect.top - afterIframeRect.top);
      applyState(iframeDef);
    }
    updateToolbarTextarea();
  }

  function onPointerUp() {
    dragMode = null;
    dragStart = null;
    saveState();
    recordSnapshot('Adjusted layout', false);
    window.removeEventListener('pointermove', onPointerMove);
  }

  function injectStyles() {
    var style = document.createElement('style');
    style.textContent = [
      'body.layout-editor-active { overflow: hidden !important; }',
      'body.layout-editor-active iframe { pointer-events: none !important; }',
      'body.layout-editor-active .layout-editor-target { outline: 2px dashed rgba(245, 158, 11, 0.65); outline-offset: 2px; cursor: move; }',
      'body.layout-editor-active .layout-editor-target.layout-editor-scale { outline-color: rgba(34, 197, 94, 0.75); }',
      'body.layout-editor-active .layout-editor-target.layout-editor-crop { overflow: hidden; }',
      'body.layout-editor-active .layout-editor-target.layout-editor-crop img { width: 100%; height: 100%; object-fit: cover; display: block; }',
      'body.layout-editor-active .layout-editor-overlay { position: fixed; z-index: 20000; pointer-events: auto; box-sizing: border-box; border: 1px solid rgba(245, 158, 11, 0.55); border-radius: 8px; background: rgba(245, 158, 11, 0.04); }',
      'body.layout-editor-active .layout-editor-overlay.is-active { box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.30); }',
      'body.layout-editor-active .layout-editor-overlay.is-locked { opacity: 0.42; }',
      'body.layout-editor-active .layout-editor-label { position: absolute; left: 0; top: -22px; background: rgba(17, 24, 39, 0.9); color: #fff; font-size: 11px; line-height: 1; padding: 4px 6px; border-radius: 999px; white-space: nowrap; pointer-events: none; }',
      'body.layout-editor-active .layout-editor-handle { position: absolute; right: -7px; bottom: -7px; width: 14px; height: 14px; border-radius: 4px; background: #f59e0b; border: 2px solid #fff; cursor: nwse-resize; }',
      'body.layout-editor-active .layout-editor-toolbar { position: fixed; left: 12px; top: 12px; z-index: 20010; display: grid; gap: 8px; background: rgba(17, 24, 39, 0.92); color: #fff; border-radius: 14px; padding: 12px; width: min(340px, calc(100vw - 24px)); box-shadow: 0 14px 30px rgba(0,0,0,0.24); max-height: calc(100vh - 24px); overflow: auto; transition: width 0.16s ease, height 0.16s ease, transform 0.16s ease; }',
      'body.layout-editor-active .layout-editor-toolbar.is-collapsed { width: min(240px, calc(100vw - 24px)); overflow: hidden; }',
      'body.layout-editor-active .layout-editor-toolbar-head { display: flex; align-items: center; gap: 8px; justify-content: space-between; cursor: move; user-select: none; }',
      'body.layout-editor-active .layout-editor-toolbar-head .title { font-size: 13px; font-weight: 800; letter-spacing: .02em; }',
      'body.layout-editor-active .layout-editor-toolbar-head .actions { display: flex; align-items: center; gap: 6px; margin-left: auto; }',
      'body.layout-editor-active .layout-editor-toolbar .hint { font-size: 11px; line-height: 1.35; color: rgba(255,255,255,0.78); }',
      'body.layout-editor-active .layout-editor-toolbar .buttons { display: flex; flex-wrap: wrap; gap: 8px; }',
      'body.layout-editor-active .layout-editor-toolbar button { appearance: none; border: 0; border-radius: 999px; padding: 8px 12px; font-size: 12px; font-weight: 700; cursor: pointer; background: #d6a42b; color: #1a1a1a; }',
      'body.layout-editor-active .layout-editor-toolbar button.is-on { background: #86efac; color: #123; }',
      'body.layout-editor-active .layout-editor-toolbar button.secondary { background: rgba(255,255,255,0.12); color: #fff; border: 1px solid rgba(255,255,255,0.16); }',
      'body.layout-editor-active .layout-editor-toolbar.is-collapsed .layout-editor-toolbar-body { display: none; }',
      'body.layout-editor-active .layout-editor-toolbar textarea { width: 100%; min-height: 120px; resize: vertical; border-radius: 10px; border: 1px solid rgba(255,255,255,0.16); background: rgba(255,255,255,0.06); color: #e5e7eb; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; line-height: 1.35; padding: 10px; }',
      'body.layout-editor-active .layout-editor-history { display: grid; gap: 8px; }',
      'body.layout-editor-active .layout-editor-history-title { font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: rgba(255,255,255,0.72); }',
      'body.layout-editor-active .layout-editor-history-list { display: grid; gap: 6px; max-height: 170px; overflow: auto; padding-right: 2px; }',
      'body.layout-editor-active .layout-editor-history-item { width: 100%; justify-content: flex-start; text-align: left; white-space: normal; line-height: 1.25; }',
      'body.layout-editor-active .layout-editor-history-empty { font-size: 11px; color: rgba(255,255,255,0.62); padding: 4px 2px; }'
    ].join('\n');
    document.head.appendChild(style);
  }

  function syncToolbarPosition() {
    if (!toolbar) return;

    var maxX = Math.max(8, window.innerWidth - toolbar.offsetWidth - 8);
    var maxY = Math.max(8, window.innerHeight - toolbar.offsetHeight - 8);

    if (typeof toolbarState.x !== 'number') toolbarState.x = 12;
    if (typeof toolbarState.y !== 'number') {
      toolbarState.y = Math.max(12, window.innerHeight - toolbar.offsetHeight - 12);
    }

    toolbarState.x = Math.max(8, Math.min(toolbarState.x, maxX));
    toolbarState.y = Math.max(8, Math.min(toolbarState.y, maxY));
    toolbar.style.left = toolbarState.x + 'px';
    toolbar.style.top = toolbarState.y + 'px';
    toolbar.style.right = 'auto';
    toolbar.style.bottom = 'auto';
    toolbar.classList.toggle('is-collapsed', !!toolbarState.collapsed);

    var toggleBtn = toolbar.querySelector('[data-action="toggle"]');
    if (toggleBtn) {
      toggleBtn.textContent = toolbarState.collapsed ? 'Show' : 'Hide';
    }
  }

  function beginToolbarDrag(ev) {
    if (!toolbar || ev.target.closest('button, textarea, input, select, option')) {
      return;
    }
    ev.preventDefault();
    var rect = toolbar.getBoundingClientRect();
    toolbarDrag = {
      x: ev.clientX - rect.left,
      y: ev.clientY - rect.top
    };
    window.addEventListener('pointermove', onToolbarDragMove);
    window.addEventListener('pointerup', endToolbarDrag, { once: true });
  }

  function onToolbarDragMove(ev) {
    if (!toolbar || !toolbarDrag) return;
    var maxX = Math.max(8, window.innerWidth - toolbar.offsetWidth - 8);
    var maxY = Math.max(8, window.innerHeight - toolbar.offsetHeight - 8);
    toolbarState.x = Math.max(8, Math.min(ev.clientX - toolbarDrag.x, maxX));
    toolbarState.y = Math.max(8, Math.min(ev.clientY - toolbarDrag.y, maxY));
    syncToolbarPosition();
  }

  function endToolbarDrag() {
    toolbarDrag = null;
    window.removeEventListener('pointermove', onToolbarDragMove);
    saveToolbarState();
  }

  function createToolbar() {
    toolbar = document.createElement('div');
    toolbar.className = 'layout-editor-toolbar';
    toolbar.innerHTML = [
      '<div class="layout-editor-toolbar-head">',
      '<div class="title">' + TOOLBAR_TITLE + '</div>',
      '<div class="actions">',
      '<button type="button" class="secondary" data-action="toggle">Hide</button>',
      '</div>',
      '</div>',
      '<div class="layout-editor-toolbar-body">',
      '<div class="hint">' + TOOLBAR_HINT + '</div>',
      '<div class="buttons">',
      '<button type="button" data-action="save">Save</button>',
      '<button type="button" class="secondary" data-action="copy">Copy JSON</button>',
      '<button type="button" class="secondary" data-action="toggle-mode">Iframe mode</button>',
      '<button type="button" class="secondary" data-action="focus-card">Focus card</button>',
      '<button type="button" class="secondary" data-action="focus-iframe">Focus iframe</button>',
      '<button type="button" class="secondary" data-action="toggle-group-lock">Card + iframe: Locked</button>',
      '<button type="button" class="secondary" data-action="reset">Reset</button>',
      '<button type="button" class="secondary" data-action="exit">Exit</button>',
      '</div>',
      '<textarea readonly spellcheck="false"></textarea>',
      '<div class="layout-editor-history">',
      '<div class="layout-editor-history-title">Snapshots</div>',
      '<div class="layout-editor-history-list" data-history-list></div>',
      '</div>'
    ].join('');

    toolbar.addEventListener('click', function (ev) {
      var btn = ev.target.closest('button[data-action]');
      var snapBtn = ev.target.closest('button[data-snapshot-index]');
      if (snapBtn) {
        restoreSnapshot(Number(snapBtn.getAttribute('data-snapshot-index')));
        return;
      }
      if (!btn) return;
      var action = btn.getAttribute('data-action');
      if (action === 'toggle') {
        toolbarState.collapsed = !toolbarState.collapsed;
        saveToolbarState();
        syncToolbarPosition();
      } else if (action === 'save') {
        saveState();
        recordSnapshot('Saved layout', false);
      } else if (action === 'copy') {
        var json = JSON.stringify(state, null, 2);
        updateToolbarTextarea();
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(json).catch(function () {});
        }
      } else if (action === 'toggle-group-lock') {
        if (PAGE_KEY !== '2026') return;
        setConsultPairLocked(!isConsultPairLocked());
        recordSnapshot('Toggled card/iframe lock', false);
      } else if (action === 'focus-card') {
        if (PAGE_KEY !== '2026') return;
        selectTarget('consult-card');
      } else if (action === 'focus-iframe') {
        if (PAGE_KEY !== '2026') return;
        selectTarget('consult-iframe-box');
      } else if (action === 'toggle-mode') {
        if (!active || !isConsultPairTarget(active)) return;
        var currentMode = getTargetMode(active);
        syncConsultModeSnapshot(active);
        var nextMode = currentMode === 'scale' ? 'crop' : 'scale';
        active.state.mode = nextMode;
        restoreConsultModeSnapshot(active, nextMode, active.el.getBoundingClientRect());
        applyState(active);
        saveState();
        updateToolbarTextarea();
        updateToolbarControls();
        recordSnapshot('Toggled ' + active.id + ' mode', false);
      } else if (action === 'reset') {
        state = mergeState(DEFAULT_STATE, {});
        items.forEach(function (item) {
          if (!item.el) return;
          item.state = ensureState(item, item.el);
          if (PAGE_KEY === '2026' && isConsultPairTarget(item)) {
            item.state.mode = 'scale';
            if (!item.state.scale) item.state.scale = 1;
          }
          applyState(item);
        });
        if (PAGE_KEY === '2026') {
          setConsultPairLocked(true);
        }
        saveState();
        recordSnapshot('Reset to defaults', true);
      } else if (action === 'exit') {
        var url = new URL(window.location.href);
        url.searchParams.delete('layoutEditor');
        url.searchParams.delete('edit');
        window.location.href = url.toString();
      }
    });

    toolbar.querySelector('.layout-editor-toolbar-head').addEventListener('pointerdown', beginToolbarDrag);

    document.body.appendChild(toolbar);
    updateToolbarTextarea();
    renderHistory();
    syncToolbarPosition();
    updateToolbarControls();
  }

  document.documentElement.classList.remove('layout-editor-booting');

  if (editorMode) {
    createToolbar();
    if (!snapshots.length) {
      recordSnapshot('Initial layout', true);
    } else {
      renderHistory();
    }
    syncLoop();

    window.addEventListener('resize', function () {
      items.forEach(function (item) {
        syncOverlay(item);
      });
      syncToolbarPosition();
    });

    window.addEventListener('beforeunload', function () {
      saveState();
    });
  }
})();
