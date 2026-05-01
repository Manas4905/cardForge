const SVG_NS = "http://www.w3.org/2000/svg";
const card = document.getElementById("card");
const input = document.getElementById("nameInput");
const fontSelect = document.getElementById("fontSelect");
const fontColorSelect = document.getElementById("fontColorSelect");
const bgPicker = document.getElementById("bgPicker");
const sliderX = document.getElementById("sliderX");
const sliderY = document.getElementById("sliderY");
const valX = document.getElementById("valX");
const valY = document.getElementById("valY");
const resetBtn = document.getElementById("resetPos");
const bgButtons = Array.from(document.querySelectorAll(".color-swatch"));

const VIEWBOX = { width: 420, height: 260 };

// Safe zone where the cardholder name can move.
const SAFE = { left: 20, right: 400, top: 110, bottom: 245 };

// Default position as % within the safe zone (0-100).
const DEFAULT = { x: 20, y: 85 };

// Current position state (%).
let pos = { x: DEFAULT.x, y: DEFAULT.y };

let selectedBg = bgButtons.find((button) => button.classList.contains("active"))
  ?.dataset.bg || "blue";
let selectedFontFamily = fontSelect.value;
let selectedFontColor = fontColorSelect.value;

const BG_COLORS = {
  blue: ["#1a73e8", "#0d47a1"],
  red: ["#dc2626", "#7f1d1d"],
  yellow: ["#f4b400", "#a16207"],
  green: ["#16a34a", "#14532d"],
  black: ["#1b222fe6", "#000000"],
};

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

// Convert % -> SVG px within the safe zone.
function pctToCanvas(px_pct, py_pct) {
  const cx = SAFE.left + (px_pct / 100) * (SAFE.right - SAFE.left);
  const cy = SAFE.top + (py_pct / 100) * (SAFE.bottom - SAFE.top);
  return { cx, cy };
}

// Convert SVG px -> % within the safe zone.
function canvasToPct(cx, cy) {
  const px_pct = ((cx - SAFE.left) / (SAFE.right - SAFE.left)) * 100;
  const py_pct = ((cy - SAFE.top) / (SAFE.bottom - SAFE.top)) * 100;
  return {
    x: Math.max(0, Math.min(100, px_pct)),
    y: Math.max(0, Math.min(100, py_pct)),
  };
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

function clampNameCenter(cx, cy, textWidth, fontSize, labelFontSize = 12) {
  const paddingX = 10;
  const paddingY = 6;
  const minCx = SAFE.left + textWidth / 2 + paddingX;
  const maxCx = SAFE.right - textWidth / 2 - paddingX;
  const labelGap = 2;
  const minCy = SAFE.top + fontSize + labelGap + labelFontSize + paddingY;
  const maxCy = SAFE.bottom - paddingY;

  const clampedCx =
    minCx <= maxCx
      ? Math.max(minCx, Math.min(maxCx, cx))
      : (SAFE.left + SAFE.right) / 2;
  const clampedCy = Math.max(minCy, Math.min(maxCy, cy));

  return {
    cx: clampedCx,
    cy: clampedCy,
  };
}

function drawCard(name) {
  const [bgStart, bgEnd] = BG_COLORS[selectedBg] || BG_COLORS.blue;

  const { displayName, fontSize, textWidth } = getNameLayout(
    name,
    selectedFontFamily,
  );
  const labelWidth = measureTextWidth(
    "CARDHOLDER NAME:",
    selectedFontFamily,
    12,
    "400",
  );
  const blockWidth = Math.max(textWidth, labelWidth);
  const rawPos = pctToCanvas(pos.x, pos.y);
  const { cx, cy } = clampNameCenter(
    rawPos.cx,
    rawPos.cy,
    blockWidth,
    fontSize,
  );
  const textX = cx - textWidth / 2;
  const labelY = cy - fontSize - 2;
  const highlightX = textX - 4;
  const highlightY = cy - fontSize - 4;
  const highlightW = textWidth + 8;
  const highlightH = fontSize + 8;

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
    <text x="${textX}" y="${labelY}" fill="${selectedFontColor}" font-family="${escapeXml(selectedFontFamily)}" font-size="12" font-weight="400">CARDHOLDER NAME:</text>
    <text x="${textX}" y="${cy}" fill="${selectedFontColor}" opacity="${name.trim() ? 1 : 0.3}" font-family="${escapeXml(selectedFontFamily)}" font-size="${fontSize}" font-weight="700">${escapeXml(displayName)}</text>
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
  const { fontSize, textWidth } = getNameLayout(
    input.value,
    selectedFontFamily,
  );
  const labelWidth = measureTextWidth(
    "CARDHOLDER NAME:",
    selectedFontFamily,
    12,
    "400",
  );
  const blockWidth = Math.max(textWidth, labelWidth);
  const rawPos = pctToCanvas(pos.x, pos.y);
  const { cx, cy } = clampNameCenter(
    rawPos.cx,
    rawPos.cy,
    blockWidth,
    fontSize,
  );
  const tw = textWidth;
  const hitLeft = cx - tw / 2 - 10;
  const hitRight = cx + tw / 2 + 10;
  const hitTop = cy - fontSize - 10;
  const hitBottom = cy + 10;
  return (
    cx_hit >= hitLeft &&
    cx_hit <= hitRight &&
    cy_hit >= hitTop &&
    cy_hit <= hitBottom
  );
}

function startDrag(e) {
  const { x, y } = eventToCanvas(e);
  if (isNearName(x, y)) {
    isDragging = true;
    const { cx, cy } = pctToCanvas(pos.x, pos.y);
    dragOffset = { dx: x - cx, dy: y - cy };
    card.style.cursor = "grabbing";
    e.preventDefault();
    redraw();
  }
}

function moveDrag(e) {
  if (!isDragging) return;
  const { x, y } = eventToCanvas(e);
  const rawCx = x - dragOffset.dx;
  const rawCy = y - dragOffset.dy;
  const { textWidth, fontSize } = getNameLayout(
    input.value,
    selectedFontFamily,
  );
  const labelWidth = measureTextWidth(
    "CARDHOLDER NAME:",
    selectedFontFamily,
    12,
    "400",
  );
  const blockWidth = Math.max(textWidth, labelWidth);
  const { cx, cy } = clampNameCenter(rawCx, rawCy, blockWidth, fontSize);
  const newPct = canvasToPct(cx, cy);
  pos.x = newPct.x;
  pos.y = newPct.y;
  syncSliders();
  redraw();
  e.preventDefault();
}

function endDrag() {
  if (isDragging) {
    isDragging = false;
    card.style.cursor = "default";
    redraw();
  }
}

card.addEventListener("mousemove", (e) => {
  if (isDragging) {
    moveDrag(e);
    return;
  }
  const { x, y } = eventToCanvas(e);
  card.style.cursor = isNearName(x, y) ? "grab" : "default";
});

card.addEventListener("mousedown", startDrag);
card.addEventListener("mouseup", endDrag);
card.addEventListener("mouseleave", endDrag);

// Touch.
card.addEventListener("touchstart", startDrag, { passive: false });
card.addEventListener("touchmove", moveDrag, { passive: false });
card.addEventListener("touchend", endDrag);

input.addEventListener("input", redraw);

fontSelect.addEventListener("change", () => {
  selectedFontFamily = fontSelect.value;
  redraw();
});

fontColorSelect.addEventListener("change", () => {
  selectedFontColor = fontColorSelect.value;
  redraw();
});

bgPicker.addEventListener("click", (e) => {
  const button = e.target.closest(".color-swatch");
  if (!button) return;
  selectedBg = button.dataset.bg;
  bgButtons.forEach((swatch) =>
    swatch.classList.toggle("active", swatch === button),
  );
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

syncSliders();
drawCard("");
