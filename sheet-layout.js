const EPS = 1e-6;
const MIN_SHEET_SIZE = 10;
const MAX_SHEET_SIZE = 200000;
const MIN_THICKNESS = 0.1;
const MIN_MARGIN = 0;
const MIN_SPACING = 0;
const DEFAULT_GAP = 260;

export const DEFAULT_SHEET_CONFIG = Object.freeze({
  width: 3000,
  height: 1200,
  thickness: 1,
  marginTop: 10,
  marginBottom: 10,
  marginLeft: 10,
  marginRight: 10,
  spacing: 5
});

function toFiniteNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizedBox(box) {
  if (!box || typeof box !== "object") return null;
  const minX = toFiniteNumber(box.minX, NaN);
  const minY = toFiniteNumber(box.minY, NaN);
  const maxX = toFiniteNumber(box.maxX, NaN);
  const maxY = toFiniteNumber(box.maxY, NaN);
  if (![minX, minY, maxX, maxY].every((n) => Number.isFinite(n))) return null;
  if (maxX <= minX + EPS || maxY <= minY + EPS) return null;
  return { minX, minY, maxX, maxY };
}

function uniqueSortedAxis(values, minAllowed, maxAllowed) {
  const result = [];
  const seen = new Set();
  for (const raw of values) {
    const value = clampNumber(toFiniteNumber(raw, minAllowed), minAllowed, maxAllowed);
    const key = value.toFixed(4);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  result.sort((a, b) => a - b);
  return result;
}

function fitsInside(candidate, bounds) {
  return (
    candidate.minX + EPS >= bounds.minX &&
    candidate.minY + EPS >= bounds.minY &&
    candidate.maxX - EPS <= bounds.maxX &&
    candidate.maxY - EPS <= bounds.maxY
  );
}

export function normalizeSheetConfig(rawConfig = {}, fallbackConfig = DEFAULT_SHEET_CONFIG) {
  const base = fallbackConfig || DEFAULT_SHEET_CONFIG;
  const width = clampNumber(toFiniteNumber(rawConfig.width, base.width), MIN_SHEET_SIZE, MAX_SHEET_SIZE);
  const height = clampNumber(toFiniteNumber(rawConfig.height, base.height), MIN_SHEET_SIZE, MAX_SHEET_SIZE);

  const marginTop = clampNumber(toFiniteNumber(rawConfig.marginTop, base.marginTop), MIN_MARGIN, height * 0.49);
  const marginBottom = clampNumber(
    toFiniteNumber(rawConfig.marginBottom, base.marginBottom),
    MIN_MARGIN,
    height * 0.49
  );
  const marginLeft = clampNumber(toFiniteNumber(rawConfig.marginLeft, base.marginLeft), MIN_MARGIN, width * 0.49);
  const marginRight = clampNumber(
    toFiniteNumber(rawConfig.marginRight, base.marginRight),
    MIN_MARGIN,
    width * 0.49
  );

  return {
    width,
    height,
    thickness: clampNumber(toFiniteNumber(rawConfig.thickness, base.thickness), MIN_THICKNESS, 400),
    marginTop,
    marginBottom,
    marginLeft,
    marginRight,
    spacing: clampNumber(toFiniteNumber(rawConfig.spacing, base.spacing), MIN_SPACING, 300)
  };
}

export function buildSheetOrigins(sheetConfigs, gap = DEFAULT_GAP) {
  const spacingGap = Math.max(0, toFiniteNumber(gap, DEFAULT_GAP));
  const configs = Array.isArray(sheetConfigs) ? sheetConfigs : [];
  const origins = [];
  let cursorX = 0;
  for (const config of configs) {
    const normalized = normalizeSheetConfig(config, DEFAULT_SHEET_CONFIG);
    origins.push(cursorX);
    cursorX += normalized.width + spacingGap;
  }
  return origins;
}

export function getSheetUsableBounds(sheetConfig, originX = 0, originY = 0) {
  const config = normalizeSheetConfig(sheetConfig, DEFAULT_SHEET_CONFIG);
  const minX = toFiniteNumber(originX, 0) + config.marginLeft;
  const minY = toFiniteNumber(originY, 0) + config.marginBottom;
  const maxX = toFiniteNumber(originX, 0) + config.width - config.marginRight;
  const maxY = toFiniteNumber(originY, 0) + config.height - config.marginTop;

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY)
  };
}

export function boxesIntersectWithSpacing(aBox, bBox, spacing = 0) {
  const a = normalizedBox(aBox);
  const b = normalizedBox(bBox);
  if (!a || !b) return false;
  const requiredGap = Math.max(0, toFiniteNumber(spacing, 0));
  if (a.maxX + requiredGap <= b.minX + EPS) return false;
  if (b.maxX + requiredGap <= a.minX + EPS) return false;
  if (a.maxY + requiredGap <= b.minY + EPS) return false;
  if (b.maxY + requiredGap <= a.minY + EPS) return false;
  return true;
}

function intersectsOccupied(candidate, occupiedBoxes, spacing) {
  for (const occupied of occupiedBoxes) {
    if (boxesIntersectWithSpacing(candidate, occupied, spacing)) return true;
  }
  return false;
}

function buildPlacementAxes(partWidth, partHeight, bounds, occupiedBoxes, spacing) {
  const maxXStart = bounds.maxX - partWidth;
  const maxYStart = bounds.maxY - partHeight;
  const xValues = [bounds.minX, maxXStart];
  const yValues = [bounds.minY, maxYStart];

  for (const occupied of occupiedBoxes) {
    xValues.push(occupied.minX - partWidth - spacing);
    xValues.push(occupied.maxX + spacing);
    xValues.push(occupied.minX);
    xValues.push(occupied.maxX - partWidth);

    yValues.push(occupied.minY - partHeight - spacing);
    yValues.push(occupied.maxY + spacing);
    yValues.push(occupied.minY);
    yValues.push(occupied.maxY - partHeight);
  }

  return {
    xAxis: uniqueSortedAxis(xValues, bounds.minX, maxXStart),
    yAxis: uniqueSortedAxis(yValues, bounds.minY, maxYStart)
  };
}

export function findPlacementOnSheet({
  partWidth,
  partHeight,
  usableBounds,
  occupiedBoxes = [],
  spacing = 0,
  gridStep = 0
}) {
  const width = Math.max(0, toFiniteNumber(partWidth, 0));
  const height = Math.max(0, toFiniteNumber(partHeight, 0));
  const normalizedBounds = normalizedBox({
    minX: usableBounds?.minX,
    minY: usableBounds?.minY,
    maxX: usableBounds?.maxX,
    maxY: usableBounds?.maxY
  });
  if (!normalizedBounds || width <= EPS || height <= EPS) return null;
  if (width > normalizedBounds.maxX - normalizedBounds.minX + EPS) return null;
  if (height > normalizedBounds.maxY - normalizedBounds.minY + EPS) return null;

  const normalizedOccupied = occupiedBoxes.map(normalizedBox).filter(Boolean);
  const requiredGap = Math.max(0, toFiniteNumber(spacing, 0));
  const { xAxis, yAxis } = buildPlacementAxes(
    width,
    height,
    normalizedBounds,
    normalizedOccupied,
    requiredGap
  );

  for (const y of yAxis) {
    for (const x of xAxis) {
      const candidate = { minX: x, minY: y, maxX: x + width, maxY: y + height };
      if (!fitsInside(candidate, normalizedBounds)) continue;
      if (intersectsOccupied(candidate, normalizedOccupied, requiredGap)) continue;
      return { x, y };
    }
  }

  const step = Math.max(1, toFiniteNumber(gridStep, Math.max(8, requiredGap || 0)));
  const maxXStart = normalizedBounds.maxX - width;
  const maxYStart = normalizedBounds.maxY - height;

  for (let y = normalizedBounds.minY; y <= maxYStart + EPS; y += step) {
    for (let x = normalizedBounds.minX; x <= maxXStart + EPS; x += step) {
      const candidate = { minX: x, minY: y, maxX: x + width, maxY: y + height };
      if (intersectsOccupied(candidate, normalizedOccupied, requiredGap)) continue;
      return { x, y };
    }
  }

  return null;
}
