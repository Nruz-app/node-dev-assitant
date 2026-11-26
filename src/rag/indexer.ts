import * as fs from "fs/promises";
import * as path from "path";
import config from "../config.js";
import { processDirectory } from "./chunker.js";
import { generateEmbeddings } from "./embeddings.js";
import { VectorStore } from "./vector-store.js";
import { resetStore } from "./retriever.js";

export interface IndexOptions {
  /** Base vectorial de destino (por defecto config.dbPath) */
  dbPath?: string;
  /** Si se indica, escribe un JSON con un resumen de cada chunk para inspeccionarlos */
  previewPath?: string;
}

export interface IndexResult {
  files: number;
  chunks: number;
  dimensions: number;
}

/**
 * Pipeline completo de ingesta, compartido por la CLI (/ingest) y `npm run ingest`:
 * chunking → embeddings → reemplazo del contenido de la base vectorial.
 * Si no hay archivos .md no toca la base existente.
 */
export async function indexDocuments(
  docsPath: string,
  options: IndexOptions = {},
): Promise<IndexResult> {
  const dbPath = options.dbPath ?? config.dbPath;
  console.log(`\nIniciando ingestión desde: ${docsPath}`);

  const chunks = await processDirectory(docsPath);
  const files = new Set(chunks.map((chunk) => chunk.metadata.source)).size;
  if (chunks.length === 0) {
    console.log("No se encontraron archivos .md en ese directorio (no se modificó el índice).");
    return { files: 0, chunks: 0, dimensions: 0 };
  }

  console.log(`Generando embeddings para ${chunks.length} chunks...`);
  const embeddings = await generateEmbeddings(chunks.map((chunk) => chunk.content));
  const dimensions = embeddings[0]?.length ?? 0;
  if (dimensions !== config.embeddingDimensions) {
    throw new Error(
      `El modelo ${config.openaiEmbeddingModel} devolvió vectores de ${dimensions} dimensiones, ` +
        `pero la configuración espera ${config.embeddingDimensions}. Revisa EMBEDDING_DIMENSIONS.`,
    );
  }

  if (options.previewPath) {
    const preview = chunks.map((chunk, i) => ({
      id: chunk.id,
      content:
        chunk.content.slice(0, 200) + (chunk.content.length > 200 ? "..." : ""),
      metadata: chunk.metadata,
      embeddingsPreview: (embeddings[i] ?? []).slice(0, 5),
      embeddingDims: embeddings[i]?.length ?? 0,
    }));
    await fs.mkdir(path.dirname(options.previewPath), { recursive: true });
    await fs.writeFile(options.previewPath, JSON.stringify(preview, null, 2), "utf-8");
    console.log(`Preview de chunks en: ${options.previewPath}`);
  }

  // Cerrar el singleton del retriever antes de reescribir la base y forzar que se reabra después
  resetStore();
  const store = new VectorStore(dbPath, config.embeddingDimensions);
  try {
    store.clear();
    store.insertMany(chunks, embeddings);
    console.log(`${store.size} chunks de ${files} archivos almacenados en ${dbPath}`);
    return { files, chunks: store.size, dimensions };
  } finally {
    store.close();
  }
}
