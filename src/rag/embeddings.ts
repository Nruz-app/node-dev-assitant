import OpenAI from "openai";
import config from "../config.js";

// Máximo de textos por petición: la API de embeddings limita entradas y tokens por request
const BATCH_SIZE = 100;

const openaiClient = new OpenAI({
  apiKey: config.openaiApiKey,
});

// Tokens consumidos por embeddings en este proceso (para estimar costos en /stats)
let embeddingTokensUsed = 0;

export function getEmbeddingTokensUsed(): number {
  return embeddingTokensUsed;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openaiClient.embeddings.create({
    model: config.openaiEmbeddingModel,
    input: text,
  });
  embeddingTokensUsed += response.usage?.total_tokens ?? 0;
  const embedding = response.data[0]?.embedding ?? [];
  return embedding;
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const result: number[][] = [];
  for (let start = 0; start < texts.length; start += BATCH_SIZE) {
    const batch = texts.slice(start, start + BATCH_SIZE);
    const response = await openaiClient.embeddings.create({
      model: config.openaiEmbeddingModel,
      input: batch,
    });
    embeddingTokensUsed += response.usage?.total_tokens ?? 0;
    // La API devuelve un índice por elemento: se ordena para no depender del orden de llegada
    const ordered = [...response.data].sort((a, b) => a.index - b.index);
    result.push(...ordered.map((item) => item.embedding));
  }
  return result;
}
