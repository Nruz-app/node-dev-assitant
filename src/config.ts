
import {config as loadDotenv } from "dotenv";
import type { AppConfig } from "./interface.js";

loadDotenv();

function getRequiredEnvVar(name: string, defaultValue?: string) : string {

    const value = process.env[name] ?? defaultValue;
    if(value === undefined){
        throw new Error(`Variable de Entorno Requerida NO encontrada: ${name}` );
    }
    return value;
}

// Dimensiones conocidas de los modelos de embeddings de OpenAI.
// Se pueden forzar con EMBEDDING_DIMENSIONS (p. ej. para otro modelo).
const KNOWN_EMBEDDING_DIMENSIONS: Record<string, number> = {
    "text-embedding-3-small": 1536,
    "text-embedding-3-large": 3072,
    "text-embedding-ada-002": 1536,
};

const embeddingModel = getRequiredEnvVar("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small");

function resolveEmbeddingDimensions(model: string): number {
    const override = process.env["EMBEDDING_DIMENSIONS"];
    if (override) {
        const parsed = parseInt(override, 10);
        if (!Number.isInteger(parsed) || parsed <= 0) {
            throw new Error(`EMBEDDING_DIMENSIONS inválido: ${override}. Debe ser un entero positivo`);
        }
        return parsed;
    }
    const known = KNOWN_EMBEDDING_DIMENSIONS[model];
    if (!known) {
        throw new Error(
            `No se conocen las dimensiones del modelo de embeddings "${model}". ` +
            `Defínelas con EMBEDDING_DIMENSIONS en el .env`,
        );
    }
    return known;
}

export const config: AppConfig = {
  anthropicApiKey: getRequiredEnvVar("ANTHROPIC_API_KEY", ""),
  openaiApiKey: getRequiredEnvVar("OPENAI_API_KEY", ""),
  anthropicModel: getRequiredEnvVar("ANTHROPIC_MODEL", "claude-sonnet-4-6"),
  openaiEmbeddingModel: embeddingModel,
  embeddingDimensions: resolveEmbeddingDimensions(embeddingModel),
  docsPath: getRequiredEnvVar("DOCS_PATH", "./docs/sample-project"),
  dbPath: getRequiredEnvVar("DB_PATH", "./data/vectors.db"),
  ragTopK: parseInt(getRequiredEnvVar("RAG_TOP_K", "5"), 10),
}


// El agente siempre usa Claude (Anthropic) y el RAG siempre usa embeddings de OpenAI.
export function validateConfig(): void {

    if(!config.anthropicApiKey) {
        throw new Error("ANTHROPIC_API_KEY está vacía. Agrégala en el .env");
    }
    if(!config.openaiApiKey) {
        console.warn("OPENAI_API_KEY está vacía: /ingest y search_docs (embeddings) no funcionarán.");
    }
}

export default config;
