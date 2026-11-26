import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { VectorStore } from "../src/rag/vector-store.js";
import type { Chunk } from "../src/interface.js";

function chunk(id: string): Chunk {
  return { id, content: `contenido ${id}`, metadata: { source: "a.md", heading: "## H", position: 0, charCount: 12 } };
}
const unit = (v: number[]) => {
  const norm = Math.hypot(...v);
  return v.map((x) => x / norm);
};

test("inserta y devuelve los vecinos más cercanos ordenados", () => {
  const store = new VectorStore(":memory:", 4);
  store.insertMany(
    [chunk("x"), chunk("y"), chunk("xy")],
    [unit([1, 0, 0, 0]), unit([0, 1, 0, 0]), unit([1, 1, 0, 0])],
  );
  assert.equal(store.size, 3);
  const results = store.search(unit([1, 0.1, 0, 0]), 2);
  assert.deepEqual(results.map((r) => r.chunk.id), ["x", "xy"]);
  assert.ok(results[0]!.score > results[1]!.score);
  assert.ok(results[0]!.score <= 1 && results[0]!.score > 0.9);
  store.close();
});

test("rechaza vectores con otra dimensión con un error claro", () => {
  const store = new VectorStore(":memory:", 4);
  assert.throws(() => store.insert(chunk("a"), [1, 2, 3]), /3 dimensiones pero la base usa 4/);
  assert.throws(() => store.search([1, 2, 3], 1), /vuelve a ejecutar \/ingest/);
  store.close();
});

test("clear() recrea la tabla con la nueva dimensión (cambio de modelo de embeddings)", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "devassistant-vs-"));
  const dbPath = path.join(dir, "vectors.db");

  const old = new VectorStore(dbPath, 4);
  old.insert(chunk("a"), unit([1, 0, 0, 0]));
  old.close();

  // Reabrir con otra dimensión: conserva la dimensión guardada hasta re-ingestar
  const reopened = new VectorStore(dbPath, 3);
  assert.equal(reopened.embeddingDimensions, 4);
  assert.throws(() => reopened.search(unit([1, 0, 0]), 1), /base usa 4/);
  reopened.clear();
  assert.equal(reopened.embeddingDimensions, 3);
  assert.equal(reopened.size, 0);
  reopened.insert(chunk("b"), unit([0, 1, 0]));
  assert.equal(reopened.search(unit([0, 1, 0]), 1)[0]?.chunk.id, "b");
  reopened.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
