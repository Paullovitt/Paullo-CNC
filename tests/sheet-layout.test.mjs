import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_SHEET_CONFIG,
  normalizeSheetConfig,
  buildSheetOrigins,
  getSheetUsableBounds,
  boxesIntersectWithSpacing,
  findPlacementOnSheet
} from "../sheet-layout.js";

test("normalizeSheetConfig aplica limites minimos e maximos", () => {
  const normalized = normalizeSheetConfig({
    width: -10,
    height: 0,
    thickness: -1,
    marginTop: 99999,
    marginBottom: 99999,
    marginLeft: 99999,
    marginRight: 99999,
    spacing: -30
  }, DEFAULT_SHEET_CONFIG);

  assert.equal(normalized.width, 10);
  assert.equal(normalized.height, 10);
  assert.equal(normalized.thickness, 0.1);
  assert.equal(normalized.spacing, 0);
  assert.ok(normalized.marginTop <= normalized.height * 0.49);
  assert.ok(normalized.marginLeft <= normalized.width * 0.49);
});

test("buildSheetOrigins distribui chapas com gap acumulado", () => {
  const origins = buildSheetOrigins([
    { width: 1000, height: 800 },
    { width: 2000, height: 1200 },
    { width: 500, height: 500 }
  ], 100);

  assert.deepEqual(origins, [0, 1100, 3200]);
});

test("getSheetUsableBounds retorna area util com margens", () => {
  const bounds = getSheetUsableBounds({
    width: 3000,
    height: 1200,
    marginLeft: 10,
    marginRight: 20,
    marginBottom: 5,
    marginTop: 15
  }, 100, 50);

  assert.deepEqual(bounds, {
    minX: 110,
    minY: 55,
    maxX: 3080,
    maxY: 1235,
    width: 2970,
    height: 1180
  });
});

test("boxesIntersectWithSpacing considera espacamento", () => {
  const a = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  const b = { minX: 105, minY: 0, maxX: 200, maxY: 100 };
  assert.equal(boxesIntersectWithSpacing(a, b, 0), false);
  assert.equal(boxesIntersectWithSpacing(a, b, 10), true);
});

test("findPlacementOnSheet encontra encaixe sem colidir", () => {
  const placement = findPlacementOnSheet({
    partWidth: 120,
    partHeight: 60,
    usableBounds: { minX: 0, minY: 0, maxX: 400, maxY: 200 },
    spacing: 5,
    occupiedBoxes: [
      { minX: 0, minY: 0, maxX: 180, maxY: 80 },
      { minX: 0, minY: 90, maxX: 180, maxY: 170 }
    ]
  });

  assert.ok(placement);
  assert.equal(placement.x, 185);
  assert.equal(placement.y, 0);
});

test("findPlacementOnSheet retorna null quando peca nao cabe", () => {
  const placement = findPlacementOnSheet({
    partWidth: 500,
    partHeight: 200,
    usableBounds: { minX: 0, minY: 0, maxX: 400, maxY: 150 },
    spacing: 0,
    occupiedBoxes: []
  });

  assert.equal(placement, null);
});
