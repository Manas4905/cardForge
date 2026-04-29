const canvas = document.getElementById("card");
const ctx = canvas.getContext("2d");
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

// Internal canvas resolution (aspect ratio 420×260)
canvas.width = 420;
canvas.height = 260;

//Safe Zone (text allowed area)
// Defined in canvas-coordinate space
const SAFE = { left: 20, right: 400, top: 110, bottom: 245 };

// Default position as % within the safe zone (0–100)
const DEFAULT = { x: 50, y: 85 };

// Current position state (%)
let pos = { x: DEFAULT.x, y: DEFAULT.y };

let selectedBg = "Blue";
let selectedFontFamily = fontSelect.value;
let selectedFontColor = fontColorSelect.value;

const BG_COLORS = {
  blue: ["#1a73e8", "#0d47a1"],
  red: ["#dc2626", "#7f1d1d"],
  yellow: ["#f4b400", "#a16207"],
  green: ["#16a34a", "#14532d"],
  black: ["#111827", "#000000"],
};

// Convert % → canvas px within the safe zone
function pctToCanvas(px_pct, py_pct) {
  const cx = SAFE.left + (px_pct / 100) * (SAFE.right - SAFE.left);
  const cy = SAFE.top + (py_pct / 100) * (SAFE.bottom - SAFE.top);
  return { cx, cy };
}

// Convert canvas px → % within the safe zone
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
  ctx.font = `bold ${fontSize}px ${fontFamily}`;
  while (
    ctx.measureText(displayName).width > SAFE.right - SAFE.left - 20 &&
    fontSize > 14
  ) {
    fontSize -= 1;
    ctx.font = `bold ${fontSize}px ${fontFamily}`;
  }

  const textWidth = ctx.measureText(displayName).width;
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
  const W = canvas.width;
  const H = canvas.height;

  ctx.clearRect(0, 0, W, H);

  const bg = ctx.createLinearGradient(0, 0, W, H);
  const [bgStart, bgEnd] = BG_COLORS[selectedBg] || BG_COLORS.blue;
  bg.addColorStop(0, bgStart);
  bg.addColorStop(1, bgEnd);
  roundRect(0, 0, W, H, 16);
  ctx.fillStyle = bg;
  ctx.fill();

  // Safe-zone guide (only visible while dragging)
  if (isDragging) {
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(
      SAFE.left,
      SAFE.top,
      SAFE.right - SAFE.left,
      SAFE.bottom - SAFE.top,
    );
    ctx.restore();
  }

  // Card label (top-left)
  ctx.fillStyle = selectedFontColor;
  ctx.globalAlpha = 1;
  ctx.font = `bold 13px ${selectedFontFamily}`;
  ctx.fillText("SMART CARD", 25, 35);
  ctx.globalAlpha = 1;

  // Chip body
  ctx.fillStyle = "#d4af37";
  roundRect(25, 55, 40, 30, 4);
  ctx.fill();

  // Chip lines
  ctx.strokeStyle = "rgba(120,90,20,0.6)";
  ctx.lineWidth = 1;

  ctx.beginPath();
  ctx.moveTo(45, 56);
  ctx.lineTo(45, 84);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(24, 62);
  ctx.lineTo(65, 62);
  ctx.moveTo(24, 70);
  ctx.lineTo(65, 70);
  ctx.moveTo(24, 78);
  ctx.lineTo(65, 78);
  ctx.stroke();

  // CARDHOLDER NAME label
  ctx.fillStyle = selectedFontColor;
  ctx.globalAlpha = 1;
  ctx.font = `12px ${selectedFontFamily}`;

  const { displayName, fontSize, textWidth } = getNameLayout(
    name,
    selectedFontFamily,
  );
  ctx.font = `12px ${selectedFontFamily}`;
  const labelWidth = ctx.measureText("CARDHOLDER NAME:").width;
  const blockWidth = Math.max(textWidth, labelWidth);

  // Resolve canvas position from current %
  const rawPos = pctToCanvas(pos.x, pos.y);
  const { cx, cy } = clampNameCenter(
    rawPos.cx,
    rawPos.cy,
    blockWidth,
    fontSize,
  );

  // Center the text on cx, baseline at cy
  const textX = cx - textWidth / 2;

  // Draw "CARDHOLDER NAME" label just above the name (12 px above baseline)
  ctx.fillStyle = selectedFontColor;
  ctx.globalAlpha = 1;
  ctx.font = `12px ${selectedFontFamily}`;
  ctx.fillText("CARDHOLDER NAME:", textX, cy - fontSize - 2);
  ctx.globalAlpha = 1;

  // Draw the name
  ctx.fillStyle = selectedFontColor;
  ctx.globalAlpha = name.trim() ? 1 : 0.3;
  ctx.font = `bold ${fontSize}px ${selectedFontFamily}`;
  ctx.fillText(displayName, textX, cy);
  ctx.globalAlpha = 1;

  // Hit-target highlight when dragging
  if (isDragging) {
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(textX - 4, cy - fontSize - 4, textWidth + 8, fontSize + 8);
    ctx.restore();
  }
}

//Rounded rect helper
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

//Sync sliders ↔ pos
function syncSliders() {
  sliderX.value = Math.round(pos.x);
  sliderY.value = Math.round(pos.y);
  valX.textContent = Math.round(pos.x);
  valY.textContent = Math.round(pos.y);
}

function redraw() {
  drawCard(input.value);
}

//Drag & Drop
let isDragging = false;
let dragOffset = { dx: 0, dy: 0 };

// Convert mouse/touch event → canvas-space coordinates
function eventToCanvas(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

// Check whether a point (canvas-px) is near the current name text
function isNearName(cx_hit, cy_hit) {
  const { displayName, fontSize, textWidth } = getNameLayout(
    input.value,
    selectedFontFamily,
  );
  ctx.font = `12px ${selectedFontFamily}`;
  const labelWidth = ctx.measureText("CARDHOLDER NAME:").width;
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
    canvas.style.cursor = "grabbing";
    e.preventDefault();
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
  ctx.font = `12px ${selectedFontFamily}`;
  const labelWidth = ctx.measureText("CARDHOLDER NAME:").width;
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
    canvas.style.cursor = "default";
    redraw(); // remove dashed border
  }
}

// Hover cursor feedback
canvas.addEventListener("mousemove", (e) => {
  if (isDragging) {
    moveDrag(e);
    return;
  }
  const { x, y } = eventToCanvas(e);
  canvas.style.cursor = isNearName(x, y) ? "grab" : "default";
});

canvas.addEventListener("mousedown", startDrag);
canvas.addEventListener("mouseup", endDrag);
canvas.addEventListener("mouseleave", endDrag);

// Touch
canvas.addEventListener("touchstart", startDrag, { passive: false });
canvas.addEventListener("touchmove", moveDrag, { passive: false });
canvas.addEventListener("touchend", endDrag);

// slider listeners
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

// Reset
resetBtn.addEventListener("click", () => {
  pos.x = DEFAULT.x;
  pos.y = DEFAULT.y;
  syncSliders();
  redraw();
});
// Init
syncSliders();
drawCard("");
