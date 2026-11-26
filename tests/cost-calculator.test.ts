import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateCost, formatUSD } from "../src/utils/cost-calculator.js";

test("calcula el costo con el precio por millón de tokens", () => {
  const cost = calculateCost({ inputTokens: 12_000, outputTokens: 800, model: "claude-sonnet-4-6" });
  assert.ok(Math.abs(cost.totalCost - 0.048) < 1e-9);
  assert.equal(cost.formatted, "$0.0480");
});

test("los embeddings solo cobran entrada", () => {
  const cost = calculateCost({ inputTokens: 1_000_000, outputTokens: 0, model: "text-embedding-3-small" });
  assert.ok(Math.abs(cost.totalCost - 0.02) < 1e-9);
});

test("modelo desconocido usa el precio de Sonnet como estimación", () => {
  const unknown = calculateCost({ inputTokens: 1_000_000, outputTokens: 0, model: "modelo-inventado" });
  assert.equal(unknown.totalCost, 3);
});

test("formatUSD", () => {
  assert.equal(formatUSD(0), "$0.00");
  assert.equal(formatUSD(0.0004), "< $0.001");
  assert.equal(formatUSD(1.23456), "$1.2346");
});
