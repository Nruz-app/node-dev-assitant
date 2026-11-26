import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { chunkMarkdown, processDirectory } from "../src/rag/chunker.js";

test("divide por encabezados ## y etiqueta la introducción", () => {
  const md = "# Título\n\nIntro.\n\n## Instalación\n\nPaso 1.\n\n## Uso\n\nEjemplo.";
  const chunks = chunkMarkdown(md, "guia.md");
  assert.equal(chunks.length, 3);
  assert.equal(chunks[0]?.metadata.heading, "(Introducción)");
  assert.equal(chunks[1]?.metadata.heading, "## Instalación");
  assert.equal(chunks[2]?.metadata.heading, "## Uso");
  assert.deepEqual(chunks.map((c) => c.id), ["guia.md-0", "guia.md-1", "guia.md-2"]);
});

test("solapa el último párrafo del chunk anterior", () => {
  const md = "Intro final.\n\n## Sección\n\nCuerpo.";
  const [, second] = chunkMarkdown(md, "a.md");
  assert.ok(second?.content.startsWith("Intro final."));
});

test("normaliza CRLF", () => {
  const chunks = chunkMarkdown("## A\r\n\r\nUno.\r\n\r\n## B\r\n\r\nDos.", "a.md");
  assert.equal(chunks.length, 2);
  assert.ok(!chunks[0]?.content.includes("\r"));
});

test("las secciones largas se dividen en chunks de máximo ~2000 caracteres con encabezado", () => {
  const paragraphs = Array.from({ length: 12 }, (_, i) => `Párrafo ${i} ` + "x".repeat(400));
  const md = "## Larga\n\n" + paragraphs.join("\n\n");
  const chunks = chunkMarkdown(md, "a.md");
  assert.ok(chunks.length > 1);
  for (const chunk of chunks) {
    assert.ok(chunk.content.startsWith("## Larga"));
    assert.ok(chunk.metadata.charCount <= 2000 + 500, `chunk de ${chunk.metadata.charCount}`);
  }
});

test("processDirectory recorre subcarpetas, usa rutas relativas y omite ocultos", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "devassistant-chunker-"));
  fs.mkdirSync(path.join(dir, "guias"));
  fs.mkdirSync(path.join(dir, ".oculta"));
  fs.writeFileSync(path.join(dir, "README.md"), "## Raíz\n\nTexto.");
  fs.writeFileSync(path.join(dir, "guias", "README.md"), "## Guía\n\nTexto.");
  fs.writeFileSync(path.join(dir, ".oculta", "x.md"), "## Oculto\n\nNo.");
  fs.writeFileSync(path.join(dir, "notas.txt"), "No es markdown");

  const chunks = await processDirectory(dir);
  const sources = chunks.map((c) => c.metadata.source).sort();
  assert.deepEqual(sources, ["README.md", "guias/README.md"]);
  // Dos README.md en carpetas distintas ya no colisionan
  assert.equal(new Set(chunks.map((c) => c.id)).size, chunks.length);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("processDirectory falla con un mensaje claro si el directorio no existe", async () => {
  await assert.rejects(processDirectory("./no-existe-xyz"), /No se pudo leer el directorio/);
});
