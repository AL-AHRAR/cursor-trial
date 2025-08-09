const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const canvas = $("#canvas");
const ctx = canvas.getContext("2d");

const fileInput = $("#file-input");
const dropzone = $("#dropzone");
const resetAllBtn = $("#reset-all");
const yearEl = $("#year");

const tabs = $$(".nx-tab");
const panes = {
  filters: $("#pane-filters"),
  transform: $("#pane-transform"),
  crop: $("#pane-crop"),
  export: $("#pane-export"),
};

const cropOverlay = $("#crop-overlay");
const cropRectEl = cropOverlay.querySelector(".crop-rect");
const startCropBtn = $("#start-crop");
const applyCropBtn = $("#apply-crop");
const cancelCropBtn = $("#cancel-crop");
const cropAspectSelect = $("#crop-aspect");

const downloadBtn = $("#download");
const exportFormatSelect = $("#export-format");
const qualityRange = $("#quality");

// Filter Inputs
const filterInputs = {
  brightness: $("#brightness"),
  contrast: $("#contrast"),
  saturation: $("#saturation"),
  hue: $("#hue"),
  sepia: $("#sepia"),
  grayscale: $("#grayscale"),
  blur: $("#blur"),
  invert: $("#invert"),
};

// Transform Inputs
const rotateLeftBtn = $("#rotate-left");
const rotateRightBtn = $("#rotate-right");
const rotationRange = $("#rotation");
const flipHBtn = $("#flip-h");
const flipVBtn = $("#flip-v");

const state = {
  image: null,
  naturalWidth: 0,
  naturalHeight: 0,
  scaleToFit: 1,
  translateX: 0,
  translateY: 0,

  // filters
  brightness: 100,
  contrast: 100,
  saturation: 100,
  hue: 0,
  sepia: 0,
  grayscale: 0,
  blur: 0,
  invert: 0,

  // transform
  rotationDeg: 0,
  flipH: false,
  flipV: false,

  // crop
  cropping: false,
  cropRect: null, // {x,y,w,h} in canvas coords
  activeHandle: null,
  cropDragOffset: { x: 0, y: 0 },
  enforceAspect: null, // number or null
};

function updateYear() {
  yearEl.textContent = new Date().getFullYear();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function degToRad(d) { return (d * Math.PI) / 180; }

function buildFilterString() {
  const f = state;
  return [
    `brightness(${f.brightness}%)`,
    `contrast(${f.contrast}%)`,
    `saturate(${f.saturation}%)`,
    `hue-rotate(${f.hue}deg)`,
    `sepia(${f.sepia}%)`,
    `grayscale(${f.grayscale}%)`,
    `blur(${f.blur}px)`,
    `invert(${f.invert}%)`,
  ].join(" ");
}

function fitCanvasToImage() {
  if (!state.image) return;
  const maxW = 1200;
  const maxH = 800;
  const { naturalWidth: w, naturalHeight: h } = state.image;
  let scale = Math.min(maxW / w, maxH / h, 1);
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  state.scaleToFit = scale;
}

function render() {
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!state.image) { ctx.restore(); return; }

  const drawW = canvas.width;
  const drawH = canvas.height;
  const cx = drawW / 2;
  const cy = drawH / 2;

  ctx.translate(cx, cy);
  ctx.rotate(degToRad(state.rotationDeg));
  ctx.scale(state.flipH ? -1 : 1, state.flipV ? -1 : 1);
  ctx.translate(-cx, -cy);

  ctx.filter = buildFilterString();
  ctx.drawImage(state.image, 0, 0, drawW, drawH);
  ctx.filter = "none";

  if (state.cropping && state.cropRect) {
    const { x, y, w, h } = state.cropRect;
    cropOverlay.classList.remove("hidden");
    cropRectEl.style.left = `${x}px`;
    cropRectEl.style.top = `${y}px`;
    cropRectEl.style.width = `${w}px`;
    cropRectEl.style.height = `${h}px`;
  } else {
    cropOverlay.classList.add("hidden");
  }

  ctx.restore();
}

function resetAll() {
  Object.assign(state, {
    brightness: 100,
    contrast: 100,
    saturation: 100,
    hue: 0,
    sepia: 0,
    grayscale: 0,
    blur: 0,
    invert: 0,
    rotationDeg: 0,
    flipH: false,
    flipV: false,
  });
  for (const [key, el] of Object.entries(filterInputs)) {
    const defaults = { brightness: 100, contrast: 100, saturation: 100, hue: 0, sepia: 0, grayscale: 0, blur: 0, invert: 0 };
    el.value = defaults[key];
    updateValueLabel(el);
  }
  rotationRange.value = 0;
  updateValueLabel(rotationRange);
  cancelCrop();
  render();
}

function updateValueLabel(inputEl) {
  const forId = inputEl.id;
  const labelEl = document.querySelector(`.value[data-for="${forId}"]`);
  if (!labelEl) return;
  let valueText = inputEl.value;
  if (forId === "hue" || forId === "rotation") valueText += "°";
  else if (forId === "blur") valueText += "px";
  else if (forId === "quality") valueText += "%";
  else valueText += "%";
  labelEl.textContent = valueText;
}

function openImageFromFile(file) {
  if (!file || !file.type.startsWith("image/")) return;
  const img = new Image();
  img.onload = () => {
    state.image = img;
    state.naturalWidth = img.naturalWidth;
    state.naturalHeight = img.naturalHeight;
    fitCanvasToImage();
    resetAll();
    render();
  };
  img.src = URL.createObjectURL(file);
}

function initDragAndDrop() {
  [dropzone, document.body].forEach((el) => {
    el.addEventListener("dragover", (e) => { e.preventDefault(); });
    el.addEventListener("drop", (e) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file) openImageFromFile(file);
    });
  });
}

function bindFilters() {
  Object.entries(filterInputs).forEach(([key, input]) => {
    input.addEventListener("input", () => {
      state[key] = Number(input.value);
      updateValueLabel(input);
      render();
    });
  });
}

function bindTransforms() {
  rotateLeftBtn.addEventListener("click", () => { state.rotationDeg = (state.rotationDeg - 90) % 360; rotationRange.value = state.rotationDeg; updateValueLabel(rotationRange); render(); });
  rotateRightBtn.addEventListener("click", () => { state.rotationDeg = (state.rotationDeg + 90) % 360; rotationRange.value = state.rotationDeg; updateValueLabel(rotationRange); render(); });
  rotationRange.addEventListener("input", () => { state.rotationDeg = Number(rotationRange.value); updateValueLabel(rotationRange); render(); });
  flipHBtn.addEventListener("click", () => { state.flipH = !state.flipH; render(); });
  flipVBtn.addEventListener("click", () => { state.flipV = !state.flipV; render(); });
}

function switchTab(target) {
  tabs.forEach((t) => t.classList.remove("active"));
  Object.values(panes).forEach((p) => p.classList.remove("active"));
  const tabBtn = tabs.find((t) => t.dataset.tab === target);
  const paneEl = $("#pane-" + target);
  if (tabBtn && paneEl) { tabBtn.classList.add("active"); paneEl.classList.add("active"); }
}

function bindTabs() {
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
  });
}

function beginCrop() {
  if (!state.image) return;
  state.cropping = true;
  applyCropBtn.disabled = false;
  cancelCropBtn.disabled = false;

  // Initialize default crop as centered rectangle
  const margin = 20;
  const w = canvas.width - margin * 2;
  const h = canvas.height - margin * 2;
  const initial = { x: margin, y: margin, w, h };
  state.cropRect = enforceAspectOnRect(initial);
  render();
  enableCropInteractions();
}

function cancelCrop() {
  disableCropInteractions();
  state.cropping = false;
  state.cropRect = null;
  state.activeHandle = null;
  applyCropBtn.disabled = true;
  cancelCropBtn.disabled = true;
  render();
}

function enforceAspectOnRect(rect) {
  const aspect = state.enforceAspect;
  if (!aspect || !rect) return rect;
  // Keep rect centered while enforcing
  let { x, y, w, h } = rect;
  const current = w / h;
  if (current > aspect) {
    // too wide -> reduce width
    const newW = Math.round(h * aspect);
    const dx = Math.floor((w - newW) / 2);
    x += dx; w = newW;
  } else if (current < aspect) {
    // too tall -> reduce height
    const newH = Math.round(w / aspect);
    const dy = Math.floor((h - newH) / 2);
    y += dy; h = newH;
  }
  // Clamp inside canvas
  x = clamp(x, 0, canvas.width - w);
  y = clamp(y, 0, canvas.height - h);
  return { x, y, w, h };
}

function setAspectFromSelect() {
  const v = cropAspectSelect.value;
  if (v === "free") state.enforceAspect = null;
  else {
    const [a, b] = v.split(":" ).map(Number);
    state.enforceAspect = a / b;
  }
  if (state.cropRect) {
    state.cropRect = enforceAspectOnRect(state.cropRect);
    render();
  }
}

function enableCropInteractions() {
  cropOverlay.style.pointerEvents = "auto";
  cropOverlay.classList.remove("hidden");

  let dragging = false;
  let resizing = false;
  let resizeHandle = null;
  let dragStart = { x: 0, y: 0 };
  let startRect = null;

  function hitTestHandle(px, py) {
    const rect = state.cropRect;
    if (!rect) return null;
    const handles = {
      tl: { x: rect.x, y: rect.y },
      tr: { x: rect.x + rect.w, y: rect.y },
      bl: { x: rect.x, y: rect.y + rect.h },
      br: { x: rect.x + rect.w, y: rect.y + rect.h },
    };
    const hitSize = 12;
    for (const [name, h] of Object.entries(handles)) {
      if (Math.abs(px - h.x) <= hitSize && Math.abs(py - h.y) <= hitSize) return name;
    }
    return null;
  }

  function onPointerDown(e) {
    if (!state.cropRect) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const h = hitTestHandle(px, py);
    if (h) {
      resizing = true; resizeHandle = h; startRect = { ...state.cropRect }; dragStart = { x: px, y: py };
    } else if (
      px >= state.cropRect.x && px <= state.cropRect.x + state.cropRect.w &&
      py >= state.cropRect.y && py <= state.cropRect.y + state.cropRect.h
    ) {
      dragging = true; dragStart = { x: px, y: py }; startRect = { ...state.cropRect };
    } else {
      // click outside starts a new rect
      const margin = 2;
      state.cropRect = { x: clamp(px - margin, 0, canvas.width - margin), y: clamp(py - margin, 0, canvas.height - margin), w: 0, h: 0 };
      dragging = false; resizing = true; resizeHandle = "br"; dragStart = { x: px, y: py }; startRect = { ...state.cropRect };
    }
    render();
  }

  function onPointerMove(e) {
    if (!state.cropRect) return;
    if (!dragging && !resizing) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    if (dragging) {
      const dx = px - dragStart.x;
      const dy = py - dragStart.y;
      const nx = clamp(startRect.x + dx, 0, canvas.width - startRect.w);
      const ny = clamp(startRect.y + dy, 0, canvas.height - startRect.h);
      state.cropRect = { ...state.cropRect, x: nx, y: ny };
    } else if (resizing) {
      let { x, y, w, h } = startRect;
      const dx = px - dragStart.x;
      const dy = py - dragStart.y;
      if (resizeHandle === "br") { w += dx; h += dy; }
      if (resizeHandle === "tr") { w += dx; y += dy; h -= dy; }
      if (resizeHandle === "bl") { x += dx; w -= dx; h += dy; }
      if (resizeHandle === "tl") { x += dx; y += dy; w -= dx; h -= dy; }

      // Normalize to positive width/height
      if (w < 0) { x += w; w = Math.abs(w); }
      if (h < 0) { y += h; h = Math.abs(h); }

      const newRect = { x: clamp(x, 0, canvas.width), y: clamp(y, 0, canvas.height), w, h };
      state.cropRect = enforceAspectOnRect(newRect);
    }
    render();
  }

  function onPointerUp() { dragging = false; resizing = false; resizeHandle = null; }

  canvas.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);

  cropOverlay._cleanup = () => {
    canvas.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  };
}

function disableCropInteractions() {
  cropOverlay.style.pointerEvents = "none";
  cropOverlay.classList.add("hidden");
  if (cropOverlay._cleanup) cropOverlay._cleanup();
}

function applyCrop() {
  if (!state.image || !state.cropRect) return;

  // Render with current filters/transforms to an offscreen canvas first
  const off = document.createElement("canvas");
  const scale = 1; // work at current canvas resolution
  off.width = canvas.width;
  off.height = canvas.height;
  const octx = off.getContext("2d");

  octx.save();
  const cx = off.width / 2;
  const cy = off.height / 2;
  octx.translate(cx, cy);
  octx.rotate(degToRad(state.rotationDeg));
  octx.scale(state.flipH ? -1 : 1, state.flipV ? -1 : 1);
  octx.translate(-cx, -cy);
  octx.filter = buildFilterString();
  octx.drawImage(state.image, 0, 0, off.width, off.height);
  octx.restore();

  const { x, y, w, h } = state.cropRect;
  const cropped = document.createElement("canvas");
  cropped.width = Math.max(1, Math.round(w * scale));
  cropped.height = Math.max(1, Math.round(h * scale));
  const cctx = cropped.getContext("2d");
  cctx.drawImage(off, x, y, w, h, 0, 0, cropped.width, cropped.height);

  const newImg = new Image();
  newImg.onload = () => {
    state.image = newImg;
    state.naturalWidth = newImg.naturalWidth;
    state.naturalHeight = newImg.naturalHeight;
    state.rotationDeg = 0;
    state.flipH = false;
    state.flipV = false;
    cancelCrop();
    fitCanvasToImage();
    render();
  };
  newImg.src = cropped.toDataURL();
}

function exportImage() {
  if (!state.image) return;
  const format = exportFormatSelect.value; // png, jpeg, webp
  const quality = clamp(Number(qualityRange.value) / 100, 0.1, 1.0);

  // Render full image with applied transforms/filters without scaling down quality
  const target = document.createElement("canvas");
  const imgW = state.naturalWidth;
  const imgH = state.naturalHeight;
  target.width = imgW;
  target.height = imgH;
  const tctx = target.getContext("2d");

  tctx.save();
  const cx = imgW / 2;
  const cy = imgH / 2;
  tctx.translate(cx, cy);
  tctx.rotate(degToRad(state.rotationDeg));
  tctx.scale(state.flipH ? -1 : 1, state.flipV ? -1 : 1);
  tctx.translate(-cx, -cy);
  tctx.filter = buildFilterString();
  tctx.drawImage(state.image, 0, 0, imgW, imgH);
  tctx.restore();

  const mime = `image/${format}`;
  target.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `NeuroX-edit.${format === "jpeg" ? "jpg" : format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, mime, format === "png" ? undefined : quality);
}

function bindExport() {
  function toggleQuality() {
    const isLossy = exportFormatSelect.value !== "png";
    qualityRange.disabled = !isLossy;
    updateValueLabel(qualityRange);
  }
  exportFormatSelect.addEventListener("change", toggleQuality);
  qualityRange.addEventListener("input", () => updateValueLabel(qualityRange));
  toggleQuality();

  downloadBtn.addEventListener("click", exportImage);
}

function bindCropControls() {
  startCropBtn.addEventListener("click", beginCrop);
  cancelCropBtn.addEventListener("click", cancelCrop);
  applyCropBtn.addEventListener("click", applyCrop);
  cropAspectSelect.addEventListener("change", setAspectFromSelect);
}

function bindHeader() {
  fileInput.addEventListener("change", (e) => {
    const file = fileInput.files?.[0];
    if (file) openImageFromFile(file);
  });
  resetAllBtn.addEventListener("click", resetAll);
}

function bindShortcuts() {
  window.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "r") { state.rotationDeg = (state.rotationDeg + 90) % 360; rotationRange.value = state.rotationDeg; updateValueLabel(rotationRange); render(); }
    if (e.key.toLowerCase() === "h") { state.flipH = !state.flipH; render(); }
    if (e.key.toLowerCase() === "v") { state.flipV = !state.flipV; render(); }
    if (e.key === "Escape" && state.cropping) { cancelCrop(); }
  });
}

function init() {
  updateYear();
  initDragAndDrop();
  bindHeader();
  bindTabs();
  bindFilters();
  bindTransforms();
  bindCropControls();
  bindExport();
  bindShortcuts();

  // Initialize labels
  [
    ...Object.values(filterInputs),
    rotationRange,
    qualityRange,
  ].forEach(updateValueLabel);

  // Initial render
  render();
}

init();