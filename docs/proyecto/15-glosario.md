# 15 · Glosario

| Término | Definición | Dónde aparece en el proyecto |
|---|---|---|
| **Agente** | Programa en el que un LLM decide qué acciones (tools) ejecutar, observa los resultados y vuelve a decidir hasta completar la tarea | `agent/agent.ts` |
| **Agentic loop** | El bucle "llamar al modelo → ejecutar las tools pedidas → devolver los resultados → repetir" | `DevAssistantAgent.chat`, `runWithTools` |
| **Anthropic / Claude** | Empresa / familia de modelos de lenguaje usada como cerebro del agente | `@anthropic-ai/sdk`, `ANTHROPIC_MODEL` |
| **Chunk** | Fragmento de un documento lo bastante pequeño para embeberlo y meterlo en el contexto | `rag/chunker.ts`, interfaz `Chunk` |
| **Chunking** | Proceso de dividir documentos en chunks (aquí: por `## `, máx. 2000 caracteres) | `chunkMarkdown` |
| **Contexto (ventana de)** | Todo el texto que el modelo ve en una llamada: system prompt, tools, historial y resultados de tools | `messages` del agente |
| **Distancia L2 / KNN** | Distancia euclídea entre vectores / búsqueda de los K vecinos más cercanos | `VectorStore.search` |
| **Embedding** | Vector de números que representa el significado de un texto; textos parecidos producen vectores cercanos | `rag/embeddings.ts` |
| **end_turn** | `stop_reason` que indica que el modelo terminó su respuesta | `agent.ts` |
| **Function calling / tool use** | Capacidad del modelo de pedir que se ejecute una función con parámetros JSON | `tools/`, `tool-registry.ts` |
| **Guardrail** | Control que valida entradas o salidas para evitar usos indebidos | `security/guardrails.ts` |
| **Ingesta** | Pipeline: leer docs → chunking → embeddings → guardar en la BD vectorial | `/ingest`, `npm run ingest` |
| **input_schema** | JSON Schema que describe los parámetros de una tool | `ToolDefinition` |
| **max_tokens** | Máximo de tokens que el modelo puede generar en una llamada | 4096 en el agente, 1024 en el resto |
| **Path traversal** | Ataque que usa `../` para salir de un directorio permitido | `resolveSecurePath` |
| **Prompt aumentado** | Prompt que incluye el contexto recuperado + instrucciones + pregunta | `rag-chain.ts` |
| **Prompt injection** | Texto que intenta que el modelo ignore sus instrucciones | `detectPromptInjection` |
| **RAG** | *Retrieval-Augmented Generation*: recuperar información relevante y dársela al modelo para que responda basándose en ella | `rag/` |
| **Rate limiting** | Limitar el número de peticiones por ventana de tiempo | `RateLimiter` |
| **Retriever** | Componente que, dada una consulta, devuelve los chunks más relevantes | `rag/retriever.ts` |
| **Sandbox** | Restricción que confina las operaciones a un directorio | `tools/executor.ts` |
| **Score / relevancia** | Medida de similitud entre consulta y chunk; aquí `1 − distancia/2` (0–1) | `VectorStore.search` |
| **Singleton** | Una sola instancia compartida de un objeto | store de `retriever.ts` |
| **sqlite-vec / vec0** | Extensión de SQLite para búsqueda vectorial / tipo de tabla virtual que crea | `vector-store.ts` |
| **stop_reason** | Motivo por el que el modelo dejó de generar: `end_turn`, `tool_use`, `max_tokens`… | `agent.ts` |
| **Streaming** | Recibir la respuesta en fragmentos a medida que se genera | `llm/streaming.ts`, `onChunk` |
| **System prompt** | Instrucciones fijas que definen el rol y las reglas del modelo | `agent/system-prompt.ts`, `llm/prompts.ts` |
| **node:test** | Runner de tests nativo de Node; aquí se ejecuta con `tsx --test` | `tests/`, `npm test` |
| **realpath** | Ruta real de un archivo con los enlaces simbólicos resueltos | `tools/executor.ts` |
| **Token** | Unidad de texto que procesa el modelo (≈ 4 caracteres); se cobra por tokens de entrada y de salida | `usage`, `cost-calculator.ts` |
| **tool_result** | Bloque con el que la app devuelve al modelo el resultado de una tool, enlazado por `tool_use_id` | `agent.ts` |
| **tool_use** | Bloque en el que el modelo pide ejecutar una tool (`id`, `name`, `input`); también es un `stop_reason` | `agent.ts` |
| **Top-K** | Número de chunks más similares que se recuperan | `RAG_TOP_K`, `top_k` |
| **tsx** | Herramienta que ejecuta TypeScript directamente sin compilar | scripts npm |
| **WAL** | *Write-Ahead Logging*, modo de journal de SQLite (genera `-wal` y `-shm`) | `vector-store.ts` |
