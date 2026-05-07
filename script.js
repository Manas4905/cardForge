const SVG_NS = "http://www.w3.org/2000/svg";
const card = document.getElementById("card");
const input = document.getElementById("nameInput");
const fontSelect = document.getElementById("fontSelect");
const fontColorInput = document.getElementById("fontColorInput");
const bgColorInput = document.getElementById("bgColorInput");
const sliderX = document.getElementById("sliderX");
const sliderY = document.getElementById("sliderY");
const valX = document.getElementById("valX");
const valY = document.getElementById("valY");
const resetBtn = document.getElementById("resetPos");
const downloadBtn = document.getElementById("downloadBtn");

const VIEWBOX = { width: 420, height: 260 };
const LABEL_FONT_SIZE = 12;
const LABEL_GAP = 2;
const BLOCK_PADDING_X = 3;
const BLOCK_PADDING_Y = 3;
const HIT_PADDING = 10;
const TOUCH_HIT_PADDING = 28;

// Safe zone where the cardholder name can move.
const SAFE = { left: 20, right: 400, top: 110, bottom: 245 };

// Default position as % within the safe zone (0-100), anchored left-bottom.
const DEFAULT = { x: 0, y: 100 };

// Current position state (%).
let pos = { x: DEFAULT.x, y: DEFAULT.y };

let selectedBgColor = bgColorInput.value;
let selectedFontFamily = fontSelect.value;
let selectedFontColor = fontColorInput.value;

const measurerSvg = document.createElementNS(SVG_NS, "svg");
measurerSvg.setAttribute("aria-hidden", "true");
measurerSvg.setAttribute("focusable", "false");
measurerSvg.style.position = "absolute";
measurerSvg.style.left = "-9999px";
measurerSvg.style.top = "-9999px";
measurerSvg.style.width = "1000px";
measurerSvg.style.height = "200px";
measurerSvg.style.visibility = "hidden";
measurerSvg.style.overflow = "hidden";

const measurerText = document.createElementNS(SVG_NS, "text");
measurerSvg.appendChild(measurerText);
document.body.appendChild(measurerSvg);

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function measureTextWidth(text, fontFamily, fontSize, fontWeight = "400") {
  measurerText.setAttribute("font-family", fontFamily);
  measurerText.setAttribute("font-size", String(fontSize));
  measurerText.setAttribute("font-weight", fontWeight);
  measurerText.textContent = text;
  return measurerText.getComputedTextLength();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;
  const number = Number.parseInt(value, 16);
  return {
    r: (number >> 16) & 255,
    g: (number >> 8) & 255,
    b: number & 255,
  };
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

function mixWithWhite(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(
    Math.round(r + (255 - r) * amount),
    Math.round(g + (255 - g) * amount),
    Math.round(b + (255 - b) * amount),
  );
}

function mixWithBlack(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(
    Math.round(r * (1 - amount)),
    Math.round(g * (1 - amount)),
    Math.round(b * (1 - amount)),
  );
}

function getNameLayout(name, fontFamily = selectedFontFamily) {
  const displayName = name.trim() ? name.toUpperCase() : "YOUR NAME";

  // Shrink only as much as needed so the full name fits inside the safe zone.
  let fontSize = 26;
  while (
    measureTextWidth(displayName, fontFamily, fontSize, "700") >
      SAFE.right - SAFE.left - 20 &&
    fontSize > 14
  ) {
    fontSize -= 1;
  }

  const textWidth = measureTextWidth(displayName, fontFamily, fontSize, "700");
  return { displayName, fontSize, textWidth };
}

function getNameBlockLayout(name, fontFamily = selectedFontFamily) {
  const { displayName, fontSize, textWidth } = getNameLayout(name, fontFamily);
  const labelWidth = measureTextWidth(
    "CARDHOLDER NAME:",
    fontFamily,
    LABEL_FONT_SIZE,
    "400",
  );
  const blockWidth = Math.max(textWidth, labelWidth);
  const leftMin = SAFE.left + BLOCK_PADDING_X;
  const leftMax = SAFE.right - blockWidth - BLOCK_PADDING_X;
  const baselineMin =
    SAFE.top + fontSize + LABEL_FONT_SIZE + LABEL_GAP + BLOCK_PADDING_Y;
  const baselineMax = SAFE.bottom - BLOCK_PADDING_Y;

  return {
    displayName,
    fontSize,
    textWidth,
    labelWidth,
    blockWidth,
    leftMin,
    leftMax,
    baselineMin,
    baselineMax,
  };
}

function finalizeNameBlock(layout, left, baseline) {
  const textX = left;
  const labelY = baseline - layout.fontSize - LABEL_GAP;
  const highlightTop =
    Math.min(labelY - LABEL_FONT_SIZE, baseline - layout.fontSize) - 4;
  const highlightBottom = baseline + 4;

  return {
    ...layout,
    left,
    textX,
    labelY,
    baseline,
    highlightX: left - 4,
    highlightY: highlightTop,
    highlightW: layout.blockWidth + 8,
    highlightH: highlightBottom - highlightTop,
  };
}

function getNameBlockFromState(name, fontFamily, state = pos) {
  const layout = getNameBlockLayout(name, fontFamily);
  const xRange = Math.max(0, layout.leftMax - layout.leftMin);
  const yRange = Math.max(0, layout.baselineMax - layout.baselineMin);
  const left =
    xRange === 0
      ? layout.leftMin
      : layout.leftMin + (clamp(state.x, 0, 100) / 100) * xRange;
  const baseline =
    yRange === 0
      ? layout.baselineMin
      : layout.baselineMin + (clamp(state.y, 0, 100) / 100) * yRange;

  return finalizeNameBlock(layout, left, baseline);
}

function stateFromNameBlock(name, fontFamily, left, baseline) {
  const layout = getNameBlockLayout(name, fontFamily);
  const xRange = Math.max(0, layout.leftMax - layout.leftMin);
  const yRange = Math.max(0, layout.baselineMax - layout.baselineMin);

  return {
    x:
      xRange === 0
        ? 0
        : ((clamp(left, layout.leftMin, layout.leftMax) - layout.leftMin) /
            xRange) *
          100,
    y:
      yRange === 0
        ? 0
        : ((clamp(baseline, layout.baselineMin, layout.baselineMax) -
            layout.baselineMin) /
            yRange) *
          100,
  };
}

function drawCard(name) {
  const bgStart = mixWithWhite(selectedBgColor, 0.08);
  const bgEnd = mixWithBlack(selectedBgColor, 0.22);
  const {
    displayName,
    fontSize,
    textX,
    labelY,
    baseline,
    highlightX,
    highlightY,
    highlightW,
    highlightH,
  } = getNameBlockFromState(name, selectedFontFamily, pos);

  card.innerHTML = `
    <defs>
      <linearGradient id="cardGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bgStart}"></stop>
        <stop offset="100%" stop-color="${bgEnd}"></stop>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="${VIEWBOX.width}" height="${VIEWBOX.height}" rx="16" fill="url(#cardGradient)"></rect>
    ${
      isDragging
        ? `<rect x="${SAFE.left}" y="${SAFE.top}" width="${SAFE.right - SAFE.left}" height="${SAFE.bottom - SAFE.top}" fill="none" stroke="#ffffff" stroke-opacity="0.25" stroke-width="1" stroke-dasharray="4 4"></rect>`
        : ""
    }
    <text x="25" y="35" fill="${selectedFontColor}" font-family="${escapeXml(selectedFontFamily)}" font-size="13" font-weight="700">SMART CARD</text>
    <rect x="25" y="55" width="40" height="30" rx="4" fill="#d4af37"></rect>
    <line x1="45" y1="56" x2="45" y2="84" stroke="#785a14" stroke-opacity="0.6" stroke-width="1"></line>
    <line x1="24" y1="62" x2="65" y2="62" stroke="#785a14" stroke-opacity="0.6" stroke-width="1"></line>
    <line x1="24" y1="70" x2="65" y2="70" stroke="#785a14" stroke-opacity="0.6" stroke-width="1"></line>
    <line x1="24" y1="78" x2="65" y2="78" stroke="#785a14" stroke-opacity="0.6" stroke-width="1"></line>
    <text x="${textX}" y="${labelY}" text-anchor="start" fill="${selectedFontColor}" font-family="${escapeXml(selectedFontFamily)}" font-size="${LABEL_FONT_SIZE}" font-weight="400">CARDHOLDER NAME:</text>
    <text x="${textX}" y="${baseline}" text-anchor="start" fill="${selectedFontColor}" opacity="${name.trim() ? 1 : 0.3}" font-family="${escapeXml(selectedFontFamily)}" font-size="${fontSize}" font-weight="700">${escapeXml(displayName)}</text>
    ${
      isDragging
        ? `<rect x="${highlightX}" y="${highlightY}" width="${highlightW}" height="${highlightH}" fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="1.5" stroke-dasharray="3 3"></rect>`
        : ""
    }
  `;
}

// Sync sliders <-> pos.
function syncSliders() {
  sliderX.value = Math.round(pos.x);
  sliderY.value = Math.round(pos.y);
  valX.textContent = Math.round(pos.x);
  valY.textContent = Math.round(pos.y);
}

function redraw() {
  drawCard(input.value);
}

function sanitizeFileName(value) {
  const trimmed = value.trim().toLowerCase();
  const base = trimmed ? trimmed.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") : "cardforge-card";
  return base || "cardforge-card";
}

function downloadCardSvg() {
  const serializer = new XMLSerializer();
  const clone = card.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const svgText = serializer.serializeToString(clone);
  const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${sanitizeFileName(input.value)}.svg`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

// Drag & Drop.
let isDragging = false;
let dragOffset = { dx: 0, dy: 0 };

// Convert mouse/touch event -> SVG-space coordinates.
function eventToCanvas(e) {
  const rect = card.getBoundingClientRect();
  const scaleX = VIEWBOX.width / rect.width;
  const scaleY = VIEWBOX.height / rect.height;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

// Check whether a point is near the current name text.
function isNearName(cx_hit, cy_hit) {
  const { left, blockWidth, labelY, baseline } = getNameBlockFromState(
    input.value,
    selectedFontFamily,
    pos,
  );
  const hitLeft = left - HIT_PADDING;
  const hitRight = left + blockWidth + HIT_PADDING;
  const hitTop = labelY - LABEL_FONT_SIZE - HIT_PADDING;
  const hitBottom = baseline + HIT_PADDING;
  return (
    cx_hit >= hitLeft &&
    cx_hit <= hitRight &&
    cy_hit >= hitTop &&
    cy_hit <= hitBottom
  );
}

function isTouchPointer(e) {
  return e.pointerType === "touch" || e.pointerType === "pen";
}

function startDrag(e) {
  const { x, y } = eventToCanvas(e);
  const hitPadding = isTouchPointer(e) ? TOUCH_HIT_PADDING : HIT_PADDING;
  const { left, blockWidth, labelY, baseline } = getNameBlockFromState(
    input.value,
    selectedFontFamily,
    pos,
  );
  const hitLeft = left - hitPadding;
  const hitRight = left + blockWidth + hitPadding;
  const hitTop = labelY - LABEL_FONT_SIZE - hitPadding;
  const hitBottom = baseline + hitPadding;
  const isHit =
    x >= hitLeft && x <= hitRight && y >= hitTop && y <= hitBottom;

  if (!isHit) return;

  isDragging = true;
  dragOffset = { dx: x - left, dy: y - baseline };
  card.style.cursor = "grabbing";
  if (card.setPointerCapture && e.pointerId != null) {
    card.setPointerCapture(e.pointerId);
  }
  e.preventDefault();
  redraw();
}

function moveDrag(e) {
  if (!isDragging) {
    if (!isTouchPointer(e)) {
      const { x, y } = eventToCanvas(e);
      card.style.cursor = isNearName(x, y) ? "grab" : "default";
    }
    return;
  }
  const { x, y } = eventToCanvas(e);
  const rawLeft = x - dragOffset.dx;
  const rawBaseline = y - dragOffset.dy;
  const layout = getNameBlockLayout(input.value, selectedFontFamily);
  const clampedLeft =
    layout.leftMin <= layout.leftMax
      ? clamp(rawLeft, layout.leftMin, layout.leftMax)
      : layout.leftMin;
  const clampedBaseline = clamp(
    rawBaseline,
    layout.baselineMin,
    layout.baselineMax,
  );
  const newState = stateFromNameBlock(
    input.value,
    selectedFontFamily,
    clampedLeft,
    clampedBaseline,
  );
  pos.x = newState.x;
  pos.y = newState.y;
  syncSliders();
  redraw();
  e.preventDefault();
}

function endDrag(e) {
  if (isDragging) {
    isDragging = false;
    card.style.cursor = "default";
    if (card.releasePointerCapture && e?.pointerId != null) {
      try {
        card.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore capture release errors if the browser already cleared it.
      }
    }
    redraw();
  }
}

card.addEventListener("pointerdown", startDrag);
card.addEventListener("pointermove", moveDrag);
card.addEventListener("pointerup", endDrag);
card.addEventListener("pointercancel", endDrag);
card.addEventListener("pointerleave", (e) => {
  if (!isDragging && e.pointerType === "mouse") {
    card.style.cursor = "default";
  }
  endDrag(e);
});

input.addEventListener("input", redraw);

fontSelect.addEventListener("change", () => {
  selectedFontFamily = fontSelect.value;
  redraw();
});

fontColorInput.addEventListener("input", () => {
  selectedFontColor = fontColorInput.value;
  redraw();
});

bgColorInput.addEventListener("input", () => {
  selectedBgColor = bgColorInput.value;
  redraw();
});

sliderX.addEventListener("input", () => {
  pos.x = Number(sliderX.value);
  valX.textContent = Math.round(pos.x);
  redraw();
});

sliderY.addEventListener("input", () => {
  pos.y = Number(sliderY.value);
  valY.textContent = Math.round(pos.y);
  redraw();
});

// Reset.
resetBtn.addEventListener("click", () => {
  pos.x = DEFAULT.x;
  pos.y = DEFAULT.y;
  syncSliders();
  redraw();
});

downloadBtn.addEventListener("click", downloadCardSvg);

syncSliders();
drawCard("");
