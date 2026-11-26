import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import * as path from "path";
import * as fs from "fs";
import type { Chunk, SearchResult } from "../interface.js";

interface ChunkRow {
  id: string;
  content: string;
  source: string;
  heading: string;
  position: number;
  char_count: number;
}
interface SearchRow extends ChunkRow {
  distance: number;
}

// Bases creadas antes de guardar la dimensión en la tabla meta usaban float[1536]
const LEGACY_DIMENSIONS = 1536;

function serializeEmbedding(embedding: number[]): Buffer {
  const float32 = new Float32Array(embedding);
  return Buffer.from(float32.buffer);
}

export class VectorStore {
  private db: Database.Database;
  // Dimensión con la que está creada la tabla de embeddings en disco
  private storedDimensions: number;

  /**
   * @param dbPath     Ruta del archivo SQLite (":memory:" para una base en memoria)
   * @param dimensions Dimensión de los embeddings que se van a insertar (config.embeddingDimensions)
   */
  constructor(
    dbPath: string,
    private readonly dimensions: number,
  ) {
    if (dbPath !== ":memory:") {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    this.db = new Database(dbPath);
    sqliteVec.load(this.db);

    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = NORMAL");

    this.storedDimensions = this.createTables();
  }

  private createTables(): number {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chunks(
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        source TEXT NOT NULL,
        heading TEXT NOT NULL,
        position INTEGER NOT NULL,
        char_count INTEGER NOT NULL
      )
      `);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meta(
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
      `);

    const embeddingsTableExists = this.db
      .prepare(`SELECT 1 FROM sqlite_master WHERE name = 'chunk_embeddings'`)
      .get();
    const stored = this.db
      .prepare(`SELECT value FROM meta WHERE key = 'embedding_dimensions'`)
      .get() as { value: string } | undefined;

    if (!embeddingsTableExists) {
      this.createEmbeddingsTable(this.dimensions);
      return this.dimensions;
    }
    if (!stored) {
      // Base antigua: la tabla existe pero no se guardó su dimensión
      this.saveDimensions(LEGACY_DIMENSIONS);
      return LEGACY_DIMENSIONS;
    }
    return parseInt(stored.value, 10);
  }

  private createEmbeddingsTable(dimensions: number): void {
    this.db.exec(`
      CREATE VIRTUAL TABLE chunk_embeddings USING vec0(
        chunk_id TEXT PARTITION KEY,
        embedding float[${dimensions}]
      )
      `);
    this.saveDimensions(dimensions);
  }

  private saveDimensions(dimensions: number): void {
    this.db
      .prepare(`INSERT OR REPLACE INTO meta(key, value) VALUES ('embedding_dimensions', ?)`)
      .run(String(dimensions));
  }

  private assertDimensions(vector: number[], operation: string): void {
    if (vector.length !== this.storedDimensions) {
      throw new Error(
        `El vector tiene ${vector.length} dimensiones pero la base usa ${this.storedDimensions} (${operation}). ` +
          `Si cambiaste OPENAI_EMBEDDING_MODEL, vuelve a ejecutar /ingest o npm run ingest.`,
      );
    }
  }

  insert(chunk: Chunk, embedding: number[]): void {
    this.assertDimensions(embedding, "insert");
    const insertChunk = this.db.prepare(`
      INSERT OR REPLACE INTO chunks
      (id,content,source,heading,position,char_count)
      VALUES(?,?,?,?,?,?)
      `);
    insertChunk.run(
      chunk.id,
      chunk.content,
      chunk.metadata.source,
      chunk.metadata.heading,
      chunk.metadata.position,
      chunk.metadata.charCount,
    );

    const insertEmbedding = this.db.prepare(
      `
      INSERT OR REPLACE INTO chunk_embeddings
      (chunk_id,embedding)
      VALUES(?,?)
      `,
    );
    insertEmbedding.run(chunk.id, serializeEmbedding(embedding));
  }

  /** Inserta muchos chunks en una sola transacción (mucho más rápido que insert() en bucle). */
  insertMany(chunks: Chunk[], embeddings: number[][]): void {
    const run = this.db.transaction(() => {
      chunks.forEach((chunk, i) => {
        const embedding = embeddings[i];
        if (embedding) this.insert(chunk, embedding);
      });
    });
    run();
  }

  search(queryEmbedding: number[], topk: number): SearchResult[] {
    this.assertDimensions(queryEmbedding, "search");
    const stmt = this.db.prepare(`
      SELECT c.id, c.content, c.source, c.heading, c.position, c.char_count, e.distance
      FROM chunk_embeddings e
      JOIN chunks c ON c.id = e.chunk_id
      WHERE e.embedding MATCH ?
      AND k = ?
      ORDER BY e.distance
      `);
    const rows = stmt.all(
      serializeEmbedding(queryEmbedding),
      topk,
    ) as SearchRow[];
    return rows.map((row) => ({
      chunk: {
        id: row.id,
        content: row.content,
        metadata: {
          source: row.source,
          heading: row.heading,
          position: row.position,
          charCount: row.char_count,
        },
      },
      score: 1 - row.distance / 2,
    }));
  }

  /**
   * Borra todo el contenido y recrea la tabla de embeddings con la dimensión actual
   * (así un cambio de modelo de embeddings se resuelve re-ingestando).
   */
  clear(): void {
    this.db.exec("DELETE FROM chunks");
    this.db.exec("DROP TABLE IF EXISTS chunk_embeddings");
    this.createEmbeddingsTable(this.dimensions);
    this.storedDimensions = this.dimensions;
  }

  get size(): number {
    const row = this.db
      .prepare(`SELECT COUNT(*) as count FROM chunks`)
      .get() as { count: number };
    return row.count;
  }

  get embeddingDimensions(): number {
    return this.storedDimensions;
  }

  close(): void {
    this.db.close();
  }
}
