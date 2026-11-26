// Prueba las tools locales del agente (sin llamar a APIs) dentro de un proyecto temporal.
// El sandbox usa process.cwd() al importar el executor, por eso se cambia de directorio
// ANTES de importar los módulos (node:test ejecuta cada archivo en su propio proceso).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const projectDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "devassistant-tools-")));
const outsideDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "devassistant-outside-")));
let executeAnyTool: (name: string, params: Record<string, unknown>) => Promise<string>;
let symlinkCreated = false;

before(async () => {
  fs.mkdirSync(path.join(projectDir, "src"));
  fs.writeFileSync(path.join(projectDir, "src", "app.ts"), "export const hola = 1;\nconst x = hola;\n");
  fs.writeFileSync(path.join(projectDir, ".env"), "ANTHROPIC_API_KEY=secreto");
  fs.writeFileSync(path.join(projectDir, ".env.local"), "OPENAI_API_KEY=secreto");
  fs.writeFileSync(path.join(projectDir, ".env.template"), "ANTHROPIC_API_KEY=sk-ant-xxx");
  fs.writeFileSync(path.join(outsideDir, "secreto.txt"), "fuera del proyecto");
  try {
    // "junction" funciona en Windows sin permisos de administrador
    fs.symlinkSync(outsideDir, path.join(projectDir, "enlace"), "junction");
    symlinkCreated = true;
  } catch {
    symlinkCreated = false;
  }

  process.chdir(projectDir);
  process.env["OPENAI_API_KEY"] ??= "test";
  ({ executeAnyTool } = await import("../src/agent/tool-registry.js"));
});

after(() => {
  process.chdir(os.tmpdir());
  fs.rmSync(projectDir, { recursive: true, force: true });
  fs.rmSync(outsideDir, { recursive: true, force: true });
});

test("list_files devuelve una ruta por línea y omite archivos ocultos", async () => {
  const out = await executeAnyTool("list_files", { path: "." });
  const lines = out.split("\n");
  assert.ok(lines.includes(path.join("src", "app.ts")));
  assert.ok(!out.includes(".env"));
});

test("search_code devuelve cabecera, línea marcada y contexto", async () => {
  const out = await executeAnyTool("search_code", { pattern: "hola", path: "./src" });
  assert.match(out, /^Coincidencias: 2\n\n/);
  assert.match(out, /> src.app\.ts: 1: export const hola = 1;/);
});

test("read_file bloquea rutas fuera del proyecto", async () => {
  const out = await executeAnyTool("read_file", { file_path: "../../etc/passwd" });
  assert.match(out, /Error de seguridad/);
});

test("read_file bloquea .env y variantes pero permite .env.template", async () => {
  assert.match(await executeAnyTool("read_file", { file_path: ".env" }), /contiene secretos/);
  assert.match(await executeAnyTool("read_file", { file_path: "./.env.local" }), /contiene secretos/);
  assert.equal(await executeAnyTool("read_file", { file_path: ".env.template" }), "ANTHROPIC_API_KEY=sk-ant-xxx");
});

test("un symlink dentro del proyecto que apunta fuera se rechaza", async (t) => {
  if (!symlinkCreated) return t.skip("no se pudo crear el enlace simbólico en este sistema");
  const read = await executeAnyTool("read_file", { file_path: "enlace/secreto.txt" });
  assert.match(read, /Error de seguridad/);
  const list = await executeAnyTool("list_files", { path: "enlace" });
  assert.match(list, /Error de seguridad/);
});

test("validación de parámetros y tool desconocida", async () => {
  assert.match(await executeAnyTool("read_file", {}), /'file_path' es requerido/);
  assert.match(await executeAnyTool("no_existe", {}), /tool desconocida/);
});

test("create_issue numera con el máximo existente + 1 y nunca sobrescribe", async () => {
  const create = (title: string) =>
    executeAnyTool("create_issue", { title, description: "desc", labels: ["test"], priority: "high" });

  assert.match(await create("Uno"), /issue-001\.md/);
  assert.match(await create("Dos"), /issue-002\.md/);
  assert.match(await create("Tres"), /issue-003\.md/);

  // Borrar uno intermedio ya no provoca que se reutilice (y sobrescriba) el último número
  fs.rmSync(path.join("issues", "issue-002.md"));
  assert.match(await create("Cuatro"), /issue-004\.md/);
  assert.match(fs.readFileSync(path.join("issues", "issue-003.md"), "utf-8"), /# Issue #3: Tres/);

  const content = fs.readFileSync(path.join("issues", "issue-004.md"), "utf-8");
  assert.match(content, /^# Issue #4: Cuatro\n\n## Metadata\n\n- \*\*Fecha:\*\*/);
  assert.match(content, /- \*\*Prioridad:\*\* high/);
});
