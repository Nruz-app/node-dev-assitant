// Script de `npm run ingest`: indexa DOCS_PATH en DB_PATH y escribe data/chunks-preview.json.
// La lógica vive en indexer.ts (compartida con el comando /ingest de la CLI).
import * as path from "path";
import { pathToFileURL } from "url";
import config from "../config.js";
import { indexDocuments } from "./indexer.js";

export async function runIngest(docsPath: string = config.docsPath): Promise<void> {
  const previewPath = path.join(path.dirname(config.dbPath), "chunks-preview.json");
  const result = await indexDocuments(docsPath, { previewPath });
  if (result.chunks > 0) {
    console.log(`\nIngestión completa (${result.dimensions} dimensiones por embedding), lista para la búsqueda semántica`);
  }
}

// Solo se ejecuta al lanzarlo como script; importarlo ya no dispara la ingesta
const isMainModule =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMainModule) {
  runIngest().catch((error: Error) => {
    console.error(`Error durante la ingestión: ${error.message}`);
    process.exit(1);
  });
}
