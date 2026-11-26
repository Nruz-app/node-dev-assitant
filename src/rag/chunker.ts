import * as fs from "fs/promises";
import * as path from "path";
import type { Chunk } from "../interface.js";

const MAX_CHUNK_SIZE = 2000;

/**
 * Divide un Markdown en chunks por encabezados "## ".
 * @param filePath Nombre o ruta relativa del archivo; se usa tal cual (con "/") como
 *                 `metadata.source` y como prefijo del id.
 */
export function chunkMarkdown(rawContent: string, filePath: string): Chunk[] {
  const fileName = filePath.split(path.sep).join("/");
  const chunks: Chunk[] = [];

  // Normalizar saltos de línea de Windows (CRLF) para que la división por párrafos funcione
  const content = rawContent.replace(/\r\n/g, "\n");

  const sections = content.split(/(?=^## )/m);

  let globalPosition = 0;
  let lastParagraph = "";

  for (const section of sections) {
    if (!section.trim()) continue;

    const lines = section.split("\n");
    const firstLine = lines[0] ?? "";
    const isHeading = firstLine.startsWith("## ");
    const heading = isHeading ? firstLine.trim() : "(Introducción)";

    if (section.length <= MAX_CHUNK_SIZE) {
      const chunkContent = lastParagraph
        ? `${lastParagraph}\n\n${section.trim()}`
        : section.trim();
      chunks.push({
        id: `${fileName}-${globalPosition}`,
        content: chunkContent,
        metadata: {
          source: fileName,
          heading,
          position: globalPosition,
          charCount: chunkContent.length,
        },
      });
      const paragraphs = section.trim().split(/\n\n+/);
      lastParagraph = paragraphs[paragraphs.length - 1] ?? "";
      globalPosition++;
      continue;
    }
    // Quitar la línea del encabezado: se antepone a cada chunk más abajo
    const body = isHeading ? lines.slice(1).join("\n") : section;
    const paragraphs = body
      .split(/\n\n+/)
      .filter((p) => p.trim().length > 0);
    let currentChunk = lastParagraph ? `${lastParagraph}\n\n` : "";
    // Evita emitir un chunk que solo contenga el párrafo de solapamiento
    let hasNewContent = false;
    for (let index = 0; index < paragraphs.length; index++) {
      const paragraph = paragraphs[index] ?? "";
      if (
        hasNewContent &&
        currentChunk.length + paragraph.length > MAX_CHUNK_SIZE
      ) {
        const chunkContent = isHeading
          ? `${heading}\n\n${currentChunk.trim()}`
          : currentChunk.trim();
        chunks.push({
          id: `${fileName}-${globalPosition}`,
          content: chunkContent,
          metadata: {
            source: fileName,
            heading,
            position: globalPosition,
            charCount: chunkContent.length,
          },
        });

        const chunkParagraphs = currentChunk.trim().split(/\n\n+/);
        lastParagraph = chunkParagraphs[chunkParagraphs.length - 1] ?? "";
        currentChunk = `${lastParagraph}\n\n`;
        hasNewContent = false;
        globalPosition++;
      }
      currentChunk += paragraph + "\n\n";
      hasNewContent = true;
    }
    if (hasNewContent) {
      const chunkContent = isHeading
        ? `${heading}\n\n${currentChunk.trim()}`
        : currentChunk.trim();
      chunks.push({
        id: `${fileName}-${globalPosition}`,
        content: chunkContent,
        metadata: {
          source: fileName,
          heading,
          position: globalPosition,
          charCount: chunkContent.length,
        },
      });

      const finalParagraphs = currentChunk.trim().split(/\n\n+/);
      lastParagraph = finalParagraphs[finalParagraphs.length - 1] ?? "";
      globalPosition++;
    }
  }
  return chunks;
}

// Busca archivos .md recursivamente; devuelve rutas relativas a rootDir con "/" como separador
async function findMarkdownFiles(rootDir: string, relativeDir = ""): Promise<string[]> {
  const entries = await fs.readdir(path.join(rootDir, relativeDir), {
    withFileTypes: true,
  });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await findMarkdownFiles(rootDir, relativePath)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(relativePath);
    }
  }
  return files;
}

/**
 * Genera los chunks de todos los .md de dirPath, incluidas las subcarpetas.
 * La fuente (y el id) de cada chunk es la ruta relativa, p. ej. "guias/README.md",
 * así dos archivos con el mismo nombre en carpetas distintas no colisionan.
 */
export async function processDirectory(dirPath: string): Promise<Chunk[]> {
  const allChunks: Chunk[] = [];
  let markdownFiles: string[];
  try {
    markdownFiles = await findMarkdownFiles(dirPath);
  } catch {
    throw new Error(`No se pudo leer el directorio: ${dirPath}`);
  }
  markdownFiles.sort((a, b) => a.localeCompare(b));

  for (const relativePath of markdownFiles) {
    let content: string;
    try {
      content = await fs.readFile(path.join(dirPath, relativePath), "utf-8");
    } catch {
      console.warn(`No se pudo leer: ${relativePath}`);
      continue;
    }

    const chunks = chunkMarkdown(content, relativePath);
    allChunks.push(...chunks);
    console.log(`Procesando ${relativePath}... ${chunks.length} chunks generados`);
  }
  return allChunks;
}
