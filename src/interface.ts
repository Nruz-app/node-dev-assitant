import type { Role } from "./types.js"

export interface Message {
    role: Role,
    content: string
}

export interface ToolDefinition {
    name: string;
    description: string;
    input_schema:{
        type: "object";
        properties: Record<string,unknown>;
        required?: string[];
    }
}

export interface Chunk {
    id: string;
    content: string;
    metadata: {
        source: string;
        heading: string;
        position: number;
        charCount: number;
    }
}

export interface RetrievedChunk extends Chunk {
    score: number;
}

export interface SearchResult {
    chunk: Chunk;
    score: number;
}

// El chat siempre usa Claude (Anthropic); OpenAI se usa solo para embeddings.
export interface AppConfig {
    anthropicApiKey: string;
    openaiApiKey: string;
    anthropicModel: string;
    openaiEmbeddingModel: string;
    embeddingDimensions: number;
    docsPath: string;
    dbPath: string;
    ragTopK: number;
}

export interface AgentResponse {
    text: string;
    toolsUsed: string[];
    inputTokens: number;
    outputTokens: number;
}
