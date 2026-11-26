# 09 · Catálogo de archivos

> **Propósito de esta sección:** una ficha por cada archivo del proyecto. Cada ficha responde: **para qué sirve**, **qué exporta**, **de qué depende**, **quién lo usa**, **cómo se usa/ejecuta**, **si es reutilizable** y **notas** (detalles no obvios).

Leyenda de reutilización: ♻️ **Alta** (se copia tal cual) · 🔧 **Media** (se copia con ajustes) · 📌 **Específico** de este proyecto.

## 🗂️ Vista general

| Archivo | Capa | Rol en una línea | Reutilizable |
|---|---|---|---|
| [`src/index.ts`](#srcindexts) | Entrada | Arranca la CLI | 📌 |
| [`src/config.ts`](#srcconfigts) | Transversal | Carga y valida `.env` | 🔧 |
| [`src/interface.ts`](#srcinterfacets) | Transversal | Interfaces compartidas | 🔧 |
| [`src/types.ts`](#srctypests) | Transversal | Tipos unión | ♻️ |
| [`src/agent/agent.ts`](#srcagentagentts) | Agente | `DevAssistantAgent`: agentic loop | 🔧 |
| [`src/agent/system-prompt.ts`](#srcagentsystem-promptts) | Agente | System prompt del agente | 📌 |
| [`src/agent/tool-registry.ts`](#srcagenttool-registryts) | Agente | 5 tools + despachador | 🔧 |
| [`src/agent/demo.ts`](#srcagentdemots) | Entrada | Demo de 4 escenarios | 📌 |
| [`src/chat/cli.ts`](#srcchatclits) | Interfaz | CLI interactiva y comandos `/` | 🔧 |
| [`src/chat/conversation.ts`](#srcchatconversationts) | LLM | Chat multi-turno sin tools | ♻️ |
| [`src/exercises/code-reviewer.ts`](#srcexercisescode-reviewerts) | Entrada | Code review de un archivo | ♻️ |
| [`src/llm/anthropic-client.ts`](#srcllmanthropic-clientts) | LLM | Cliente Anthropic + `askClaude` | ♻️ |
| [`src/llm/streaming.ts`](#srcllmstreamingts) | LLM | Helpers de streaming | ♻️ |
| [`src/llm/prompts.ts`](#srcllmpromptsts) | LLM | System prompts reutilizables | ♻️ |
| [`src/rag/indexer.ts`](#srcragindexerts) | RAG | Pipeline de ingesta compartido | 🔧 |
| [`src/rag/chunker.ts`](#srcragchunkerts) | RAG | Markdown → chunks | ♻️ |
| [`src/rag/embeddings.ts`](#srcragembeddingsts) | RAG | Texto → vector (OpenAI) | ♻️ |
| [`src/rag/vector-store.ts`](#srcragvector-storets) | RAG | SQLite + sqlite-vec | ♻️ |
| [`src/rag/retriever.ts`](#srcragretrieverts) | RAG | Búsqueda semántica (singleton) | 🔧 |
| [`src/rag/rag-chain.ts`](#srcragrag-chaints) | RAG | RAG completo sin agente | 🔧 |
| [`src/rag/ingest.ts`](#srcragingestts) | Entrada | Script de ingesta | 📌 |
| [`src/security/guardrails.ts`](#srcsecurityguardrailsts) | Seguridad | Sanitización, injection, rate limit | ♻️ |
| [`src/security/examples.ts`](#srcsecurityexamplests) | Entrada | Demo de guardrails | 📌 |
| [`src/tools/definitions.ts`](#srctoolsdefinitionsts) | Tools | Esquemas de 3 tools de archivos | ♻️ |
| [`src/tools/executor.ts`](#srctoolsexecutorts) | Tools | Ejecución con sandbox | ♻️ |
| [`src/tools/agent-loop.ts`](#srctoolsagent-loopts) | Tools | Loop de tools mínimo | ♻️ |
| [`src/utils/cost-calculator.ts`](#srcutilscost-calculatorts) | Utils | Costo USD por tokens | ♻️ |
| [`tests/*.test.ts`](#-tests) | Tests | 41 tests con `node:test` | 🔧 |

---

## 📍 Raíz `src/`

### `src/index.ts`

| | |
|---|---|
| **Propósito** | Punto de entrada de `npm run dev` / `npm start`. |
| **Hace** | `main()`: llama a `validateConfig()` y luego a `startCLI()`. Si algo falla imprime el error y sale con código 1. |
| **Exporta** | Nada (es un script). |
| **Depende de** | `config.ts`, `chat/cli.ts` |
| **Usado por** | `package.json` (`dev`, `start`, `main`) |
| **Reutilizable** | 📌 |
| **Notas** | Llama a `validateConfig()` antes de abrir la CLI (corrección B16 de [14](14-problemas-conocidos.md)). |

### `src/config.ts`

| | |
|---|---|
| **Propósito** | Única fuente de configuración. Carga `.env` con `dotenv` y construye un objeto `AppConfig` tipado. |
| **Exporta** | `config` (named y default), `validateConfig()` |
| **Funciones internas** | `getRequiredEnvVar(name, default?)` (lanza si no hay valor ni default), `resolveEmbeddingDimensions(model)` (tabla de modelos conocidos o `EMBEDDING_DIMENSIONS`) |
| **Depende de** | `dotenv`, `interface.ts` |
| **Usado por** | Casi todos los módulos |
| **Cómo se usa** | `import config from "../config.js"; config.anthropicModel` |
| **Reutilizable** | 🔧 Cambia los campos de `AppConfig` y los nombres de las variables. |
| **Notas** | Se evalúa al importarse: un modelo de embeddings desconocido sin `EMBEDDING_DIMENSIONS` (o un valor inválido) rompe cualquier script que lo importe. `ragTopK` usa `parseInt`. Las keys tienen default `""`, por eso `getRequiredEnvVar` nunca lanza con ellas; la validación real está en `validateConfig()` (exige `ANTHROPIC_API_KEY`, avisa si falta `OPENAI_API_KEY`). Ya no existen `MODEL_PROVIDER` ni `OPENAI_MODEL`. |

### `src/interface.ts`

| | |
|---|---|
| **Propósito** | Interfaces compartidas: `Message`, `ToolDefinition`, `Chunk`, `RetrievedChunk`, `SearchResult`, `AppConfig`, `AgentResponse`. |
| **Depende de** | `types.ts` |
| **Usado por** | Todos los módulos con datos estructurados |
| **Reutilizable** | 🔧 `ToolDefinition`, `Chunk` y `SearchResult` son genéricos. |
| **Notas** | Detalle de cada interfaz en [05](05-modelo-datos.md). `AppConfig` incluye `embeddingDimensions`. |

### `src/types.ts`

| | |
|---|---|
| **Propósito** | Tipo unión `Role = "user" \| "assistant"`. |
| **Usado por** | `interface.ts` |
| **Reutilizable** | ♻️ |

---

## 🤖 `src/agent/`

### `src/agent/agent.ts`

| | |
|---|---|
| **Propósito** | Clase `DevAssistantAgent`: el corazón del proyecto. Mantiene el historial y ejecuta el **agentic loop** con Claude y las 5 tools. |
| **Exporta** | `DevAssistantAgent` |
| **API** | `constructor(systemPrompt = AGENT_SYSTEM_PROMPT)` · `chat(userMessage, onChunk?) → AgentResponse` · `clearHistory()` · `getStats() → {inputTokens, outputTokens, turns, toolCallsLastTurn}` |
| **Depende de** | `@anthropic-ai/sdk` (tipos), `system-prompt.ts`, `tool-registry.ts`, `llm/anthropic-client.ts`, `config.ts` |
| **Usado por** | `chat/cli.ts`, `agent/demo.ts` |
| **Cómo funciona** | Bucle: `callModel()` (con `onChunk` usa `messages.stream` y emite el texto en tiempo real; sin él, `messages.create`) → si `tool_use`, ejecuta todas las tools del bloque **en paralelo** (`Promise.all`) y añade los `tool_result` → repite. Si `end_turn`, devuelve el texto. Límite `MAX_TOOL_CALLS = 8` por turno. Diagrama en [04 §4](04-flujos.md#4-un-turno-del-agente-agentic-loop-). |
| **Reutilizable** | 🔧 Patrón completo de agente: cambia el registro de tools y el system prompt. |
| **Notas** | Una sola llamada a la API por iteración y todos los tokens contados (antes, con streaming, se hacía una 2ª llamada; ver D1 en [14](14-problemas-conocidos.md)). `getStats()`: tokens = **sesión completa**, turnos = **conversación actual**; `clearHistory()` no borra los tokens a propósito. |

### `src/agent/system-prompt.ts`

| | |
|---|---|
| **Propósito** | `AGENT_SYSTEM_PROMPT`: rol, descripción de las 5 tools, reglas de decisión (cuándo usar cada una), formato de respuesta y límites. |
| **Usado por** | `agent.ts` (valor por defecto del constructor) |
| **Reutilizable** | 📌 Pero su **estructura** (Tools → Reglas de decisión → Formato → Límites) es una buena plantilla. |
| **Notas** | Si añades una tool, actualiza este texto ("Tienes acceso a 5 herramientas"). |

### `src/agent/tool-registry.ts`

| | |
|---|---|
| **Propósito** | Registro central de **todas** las tools del agente y su despachador. Define e implementa `search_docs` y `create_issue`, y reexporta las 3 de archivos. |
| **Exporta** | `ALL_TOOL_DEFINITIONS` (5 tools), `executeAnyTool(name, params)` |
| **Funciones internas** | `executeSearchDocs({query, top_k})`, `executeCreateIssue({title, description, labels, priority})`, `nextIssueNumber(dir)` (máximo `issue-NNN` + 1) |
| **Depende de** | `fs/promises`, `path`, `rag/retriever.ts`, `tools/definitions.ts`, `tools/executor.ts` |
| **Usado por** | `agent.ts`, `chat/cli.ts` (`/tools`) |
| **Reutilizable** | 🔧 El patrón "array de definiciones + switch despachador" es universal. |
| **Notas** | Las tools nunca lanzan: devuelven el error como texto. `top_k` se limita a 10. `create_issue` escribe con flag `wx` (nunca sobrescribe). Receta para añadir tools en [06](06-funciones-tools.md#-cómo-añadir-una-tool-nueva-receta). |

### `src/agent/demo.ts`

| | |
|---|---|
| **Propósito** | Script `npm run demo`: 4 escenarios automáticos (explorar código, buscar en docs, multi-tool, crear issue) sin entrada del usuario. |
| **Depende de** | `agent.ts` |
| **Cómo se usa** | `npm run demo` (ingesta antes para que el escenario 2 encuentre docs). |
| **Reutilizable** | 📌 Útil como plantilla de "smoke test" manual. |
| **Notas** | Crea un issue real en `./issues/` (escenario 4). Hace pausas de 800 ms entre escenarios. |

---

## 💬 `src/chat/`

### `src/chat/cli.ts`

| | |
|---|---|
| **Propósito** | Interfaz de usuario: bucle `for await` sobre `readline`, comandos `/ingest`, `/stats`, `/tools`, `/clear`, `/exit`, guardrails y streaming de la respuesta. |
| **Exporta** | `startCLI()` |
| **Funciones internas** | `handleInput(línea, agente, rateLimiter)` (devuelve `false` para salir), `printStats`, `printTools`, `sessionCost` (chat + embeddings) |
| **Depende de** | `readline` (Node), `rag/indexer.ts`, `rag/embeddings.ts`, `config.ts`, `agent/agent.ts`, `agent/tool-registry.ts`, `security/guardrails.ts`, `utils/cost-calculator.ts` |
| **Usado por** | `index.ts` |
| **Reutilizable** | 🔧 El esqueleto de CLI con comandos `/` es fácil de adaptar. |
| **Notas** | Los comandos `/` **no** pasan por guardrails ni por el rate limit. Las líneas se procesan de una en una (las que llegan mientras responde el agente esperan en cola). |

### `src/chat/conversation.ts`

| | |
|---|---|
| **Propósito** | Clase `Conversation`: chat multi-turno **sin tools** que guarda el historial y cuenta tokens. Versión previa al agente (Fase 2 del curso). |
| **API** | `addUserMessage`, `addAssistantMessage`, `send()`, `clear()`, `getTurnCount()`, `estimateCurrentTokens()` (≈ caracteres/4), `getStats()`, `getHistory()` |
| **Depende de** | `config.ts`, `interface.ts`, `llm/anthropic-client.ts` |
| **Usado por** | Nadie actualmente |
| **Cómo se usa** | `const c = new Conversation(PROMPT); c.addUserMessage("hola"); await c.send();` |
| **Reutilizable** | ♻️ Chat con memoria mínimo. |
| **Notas** | `max_tokens: 1024`. |

---

## 🎓 `src/exercises/`

### `src/exercises/code-reviewer.ts`

| | |
|---|---|
| **Propósito** | Script `npm run review <archivo>`: envía un archivo a Claude con `CODE_REVIEWER_PROMPT` y muestra la revisión en streaming. |
| **Depende de** | `fs`, `path`, `llm/streaming.ts`, `llm/prompts.ts` |
| **Cómo se usa** | `npm run review ./src/config.ts` |
| **Reutilizable** | ♻️ |
| **Notas** | Extensiones reconocidas: `.ts .tsx .js .jsx .py .go .rs .java .cs .cpp .c .rb .php .swift .kt .sql` (otras dan solo un aviso). Trunca a 20.000 caracteres. No usa el sandbox: puede leer cualquier ruta que le pases. |

---

## 🧠 `src/llm/`

### `src/llm/anthropic-client.ts`

| | |
|---|---|
| **Propósito** | Crea **el** cliente de Anthropic (con `config.anthropicApiKey`) y ofrece `askClaude()`, la llamada más simple. |
| **Exporta** | `client`, `askClaude(prompt, systemPrompt?)` |
| **Usado por** | `agent.ts`, `streaming.ts`, `conversation.ts`, `tools/agent-loop.ts` |
| **Reutilizable** | ♻️ |
| **Notas** | El cliente se crea al importar el módulo. |

### `src/llm/streaming.ts`

| | |
|---|---|
| **Propósito** | Respuestas en streaming con `client.messages.stream`. |
| **Exporta** | `streamClaude(prompt, system?)` (escribe en stdout), `streamClaudeWithCallback(prompt, onChunk, system?)` |
| **Usado por** | `exercises/code-reviewer.ts`, `rag/rag-chain.ts` |
| **Reutilizable** | ♻️ |
| **Notas** | Escucha el evento `"text"` y espera a `finalMessage()`. `max_tokens: 1024`. |

### `src/llm/prompts.ts`

| | |
|---|---|
| **Propósito** | System prompts reutilizables: `CODE_REVIEWER_PROMPT` (revisión con secciones ✅⚠️🐛🔒 y nota 1–10), `DOCUMENTATION_ASSISTANT_PROMPT`, `DOCUMENTATION_GENERATOR_PROMPT`. |
| **Usado por** | `code-reviewer.ts` (solo el primero) |
| **Reutilizable** | ♻️ |

---

## 📚 `src/rag/`

### `src/rag/indexer.ts`

| | |
|---|---|
| **Propósito** | `indexDocuments(docsPath, {dbPath?, previewPath?})`: **única** implementación de la ingesta (chunking → embeddings → reemplazo del índice). |
| **Exporta** | `indexDocuments`, `IndexOptions`, `IndexResult` (`{files, chunks, dimensions}`) |
| **Depende de** | `config.ts`, `chunker.ts`, `embeddings.ts`, `vector-store.ts`, `retriever.ts` (`resetStore`) |
| **Usado por** | `chat/cli.ts` (`/ingest`), `rag/ingest.ts` |
| **Reutilizable** | 🔧 |
| **Notas** | Si no hay `.md` devuelve `{chunks: 0}` sin tocar la base. Comprueba que la dimensión devuelta por OpenAI coincide con la configuración. Inserta todo en **una transacción** (`insertMany`). |

### `src/rag/chunker.ts`

| | |
|---|---|
| **Propósito** | Divide Markdown en `Chunk`s por encabezados `## `, con un máximo de 2000 caracteres y un párrafo de solapamiento. |
| **Exporta** | `chunkMarkdown(rawContent, filePath)`, `processDirectory(dirPath)` |
| **Depende de** | `fs/promises`, `path`, `interface.ts` |
| **Usado por** | `cli.ts`, `ingest.ts` |
| **Reutilizable** | ♻️ Función pura (`chunkMarkdown`), sin dependencias externas. |
| **Notas** | `processDirectory` es **recursivo** (omite carpetas ocultas y `node_modules`) y ordena por ruta. `source` e `id` usan la **ruta relativa** con `/` (`guias/README.md-3`). Normaliza CRLF. Corpus de ejemplo: 30 chunks, el más grande de 1996 caracteres. Algoritmo en [04 §3](04-flujos.md#algoritmo-de-chunking-chunkmarkdown). |

### `src/rag/embeddings.ts`

| | |
|---|---|
| **Propósito** | Convierte texto en vectores con OpenAI (`config.openaiEmbeddingModel`). |
| **Exporta** | `generateEmbedding(text)`, `generateEmbeddings(texts)`, `getEmbeddingTokensUsed()` |
| **Usado por** | `cli.ts`, `ingest.ts`, `retriever.ts` |
| **Reutilizable** | ♻️ |
| **Notas** | `generateEmbeddings` envía lotes de **100** textos y reordena por `index`. Lleva la cuenta de tokens (`usage.total_tokens`) para `/stats`. |

### `src/rag/vector-store.ts`

| | |
|---|---|
| **Propósito** | Clase `VectorStore` sobre `better-sqlite3` + `sqlite-vec`: crea las tablas, inserta, busca los K vecinos más cercanos, limpia y cuenta. |
| **API** | `new VectorStore(dbPath, dimensions)`, `insert(chunk, embedding)`, `insertMany(chunks, embeddings)`, `search(queryEmbedding, topk)`, `clear()`, `size`, `embeddingDimensions`, `close()` |
| **Usado por** | `indexer.ts`, `retriever.ts`, `tests/vector-store.test.ts` |
| **Reutilizable** | ♻️ Base vectorial local sin servidor (acepta `":memory:"`). |
| **Notas** | Crea la carpeta de `dbPath` si no existe. Usa WAL. La dimensión se guarda en la tabla `meta`; `clear()` recrea la tabla de vectores con la dimensión actual; un vector de otra dimensión da un error claro. Bases antiguas → 1536. `score = 1 − distance/2`. Esquema en [05](05-modelo-datos.md#️-esquema-de-la-base-de-datos-datavectorsdb). |

### `src/rag/retriever.ts`

| | |
|---|---|
| **Propósito** | `retrieveContext(query, topK = RAG_TOP_K)`: embebe la consulta y busca en el store. Mantiene un `VectorStore` **singleton**. |
| **Exporta** | `retrieveContext`, `resetStore` |
| **Usado por** | `tool-registry.ts` (`search_docs`), `rag-chain.ts`, `indexer.ts` (`resetStore`) |
| **Reutilizable** | 🔧 |
| **Notas** | Si el store está vacío devuelve `[]` sin llamar a OpenAI. |

### `src/rag/rag-chain.ts`

| | |
|---|---|
| **Propósito** | `askWithRAG(question, onChunk?)`: RAG clásico (recuperar → prompt aumentado → Claude en streaming) con un system prompt que prohíbe inventar. |
| **Usado por** | Nadie actualmente (es la versión previa al agente) |
| **Reutilizable** | 🔧 Ideal si quieres RAG sin agente (más barato y predecible). |

### `src/rag/ingest.ts`

| | |
|---|---|
| **Propósito** | Script `npm run ingest`: llama a `indexDocuments(DOCS_PATH)` pidiendo además `data/chunks-preview.json` para inspeccionar los chunks. |
| **Exporta** | `runIngest(docsPath?)` |
| **Usado por** | `package.json` (`ingest`) |
| **Reutilizable** | 📌 Usa `indexer.ts` en su lugar. |
| **Notas** | Solo se ejecuta si es el módulo principal (`import.meta.url` frente a `process.argv[1]`): **importarlo ya no lanza la ingesta**. Sale con código 1 si falla. Para otra carpeta: `DOCS_PATH=./otra npm run ingest` o `/ingest ./otra` en la CLI. |

---

## 🛡️ `src/security/`

### `src/security/guardrails.ts`

| | |
|---|---|
| **Propósito** | Seguridad de entrada: `sanitizeInput`, `detectPromptInjection` (17 patrones regex EN/ES; "actúa como" solo bloquea roles de jailbreak), `RateLimiter` (ventana deslizante), `checkGuardrails` (las tres cosas juntas), `createRateLimiter` (por defecto 10/60 s). |
| **Depende de** | Nada |
| **Usado por** | `cli.ts`, `examples.ts` |
| **Reutilizable** | ♻️ Sin dependencias. |
| **Notas** | Detalle en [13 · Seguridad](13-seguridad.md). |

### `src/security/examples.ts`

| | |
|---|---|
| **Propósito** | Demostración de los guardrails: sanitización, casos de injection en inglés y español, entradas legítimas, rate limiting y `checkGuardrails`. |
| **Cómo se usa** | `npx tsx src/security/examples.ts` (no tiene script npm). **No llama a ninguna API**. |
| **Reutilizable** | 📌 Sirve como tabla de casos para futuros tests. |

---

## 🛠️ `src/tools/`

### `src/tools/definitions.ts`

| | |
|---|---|
| **Propósito** | `TOOL_DEFINITIONS`: esquemas JSON de `list_files`, `read_file` y `search_code`. |
| **Usado por** | `tool-registry.ts`, `agent-loop.ts` |
| **Reutilizable** | ♻️ |

### `src/tools/executor.ts`

| | |
|---|---|
| **Propósito** | `executeTool(name, params)`: valida los parámetros y ejecuta las 3 tools de archivos dentro de un **sandbox** (`resolveSecurePath`). |
| **Exporta** | `executeTool`, `isSecretFile` |
| **Funciones internas** | `resolveSecurePath` (async, con `realpath`), `isInsideProject`, `collectFiles` (recursivo, omite `node_modules`, archivos ocultos y symlinks), `executeListFiles`, `executeReadFile`, `executeSearchCode` |
| **Constantes** | `PROJECT_ROOT = realpath(process.cwd())`, `SECRET_FILE_PATTERN`, `MAX_FILE_SIZE = 50_000`, `MAX_SEARCH_RESULTS = 20`, `CONTEXT_LINES = 2` |
| **Usado por** | `tool-registry.ts`, `agent-loop.ts` |
| **Reutilizable** | ♻️ |
| **Notas** | El sandbox depende del directorio desde el que ejecutas. Un symlink dentro del proyecto que apunte fuera se rechaza (se compara el `realpath`). `read_file` rechaza `.env`, `.env.local`…, pero permite `.env.template/.example/.sample`. |

### `src/tools/agent-loop.ts`

| | |
|---|---|
| **Propósito** | `runWithTools(prompt, systemPrompt?, tools?)`: loop de tool use mínimo y **sin estado** (una pregunta → una respuesta), máximo 10 iteraciones. Versión previa al agente (Fase 3). |
| **Usado por** | Nadie actualmente |
| **Reutilizable** | ♻️ El ejemplo más claro del patrón de tool use. |

---

## 🧮 `src/utils/`

### `src/utils/cost-calculator.ts`

| | |
|---|---|
| **Propósito** | `calculateCost({inputTokens, outputTokens, model})` → costos en USD y texto formateado. |
| **Usado por** | `cli.ts` (`/stats`, `/exit`) |
| **Reutilizable** | ♻️ |
| **Exporta** | `calculateCost`, `formatUSD`, `TokenUsage`, `CostBreakdown` |
| **Notas** | Tabla `PRICING` en USD por millón de tokens (comentario: "precios a mayo 2026"). Un modelo desconocido usa el precio de Sonnet y muestra un aviso. **Actualiza la tabla** cuando cambien los precios o uses otro modelo. |

---

## 🧪 Tests

| Archivo | Qué prueba |
|---|---|
| `tests/chunker.test.ts` | División por `##`, introducción, solapamiento, CRLF, secciones largas, recursión de `processDirectory`, ids únicos por ruta, error de directorio |
| `tests/vector-store.test.ts` | Inserción y búsqueda ordenada (vectores de 4 dimensiones en memoria), error por dimensión distinta, cambio de dimensión con `clear()` |
| `tests/guardrails.test.ts` | Sanitización (conserva saltos de línea y tabs), truncado, 13 entradas bloqueadas y 5 legítimas, rate limiter |
| `tests/cost-calculator.test.ts` | Cálculo de costo, embeddings, modelo desconocido, `formatUSD` |
| `tests/tools.test.ts` | En un proyecto temporal: `list_files`, `search_code`, sandbox `../`, bloqueo de `.env`, symlink (junction) que sale del proyecto, validación de parámetros, numeración y no sobrescritura de `create_issue` |
| `tests/tsconfig.json` | Extiende el `tsconfig` raíz para hacer typecheck de `src/` + `tests/` sin emitir |

Se ejecutan con `npm test` (`tsx --test`, runner nativo `node:test`); **ninguno llama a APIs**. Cada archivo corre en su propio proceso, por eso `tools.test.ts` puede cambiar de directorio antes de importar el executor.

## 📄 Archivos de la raíz del proyecto

| Archivo | Propósito | Notas |
|---|---|---|
| `package.json` | Metadatos, scripts npm y dependencias | `"type": "module"` (ESM). Scripts (incluido `test`) en [07](07-configuracion.md#-comandos-npm) |
| `package-lock.json` | Versiones exactas instaladas | No editar a mano |
| `tsconfig.json` | Compilador TypeScript | `strict`, `noUncheckedIndexedAccess` (el acceso por índice devuelve `T \| undefined`), `noUnusedLocals/Parameters`, `NodeNext`, `outDir: dist`, `rootDir: src` |
| `.env.template` | Plantilla de variables de entorno con comentarios | Copiar a `.env`. `read_file` sí puede leerlo (no tiene secretos) |
| `.env` | Tus variables y keys | **Nunca** compartir ni subir al repositorio |
| `.gitignore` | Ignora `.env`, `data/*.db`, `node_modules/`, `dist/`, `issues/`, logs, IDE | |
| `README.md` | README general del repositorio | Instalación, uso, arquitectura resumida |
| `CLAUDE.md` | Guía para Claude Code | Comandos, arquitectura y particularidades para agentes de IA |

## 📁 Otras carpetas

| Carpeta / archivo | Propósito | Notas |
|---|---|---|
| `docs/proyecto/` | Esta documentación (`.md` + `index.html` generado con `build-index.mjs`) | |
| `docs/sample-project/` | Corpus RAG de ejemplo: `README.md`, `api-reference.md`, `getting-started.md` de la API ficticia **TaskFlow** (tareas, proyectos, JWT, webhooks, SDKs, rate limiting, paginación) | `DOCS_PATH` por defecto. Genera 30 chunks |
| `docs/config-model/` | 6 diagramas PNG del curso: chunking, RAG, agentic loop, function calling, guardrails, streaming | Solo referencia visual |
| `docs/.claude/settings.local.json` | Ajuste local de Claude Code (`outputStyle: Concise`) | No afecta al proyecto |
| `data/` | `vectors.db` (+ `-wal`, `-shm`), `chunks-preview.json` | Generado; se puede borrar y re-ingestar |
| `issues/` | Issues creados por `create_issue` | Generado |
| `.github/codespaces/post-create.sh` | Setup de Codespaces: `npm install`, `mkdir data`, copia de `.env` | |
| `.devcontainer/devcontainer.json` | Configuración de Codespaces / Dev Containers | Imagen Node 22, ejecuta `post-create.sh`, declara los secrets |
| `node_modules/`, `dist/` | Dependencias y compilado | Generados |

---

## 🔗 Matriz "¿quién usa a quién?"

| Módulo ↓ usado por → | cli | agent | registry | demo | indexer | retriever | rag-chain | reviewer | agent-loop | conversation |
|---|---|---|---|---|---|---|---|---|---|---|
| `config` | ✔ | ✔ | | | ✔ | ✔ | | | ✔ | ✔ |
| `indexer` | ✔ | | | | | | | | | |
| `anthropic-client` | | ✔ | | | | | (vía streaming) | (vía streaming) | ✔ | ✔ |
| `streaming` | | | | | | | ✔ | ✔ | | |
| `chunker` | | | | | ✔ | | | | | |
| `embeddings` | ✔ | | | | ✔ | ✔ | | | | |
| `vector-store` | | | | | ✔ | ✔ | | | | |
| `retriever` | | | ✔ | | ✔ | | ✔ | | | |
| `definitions` | | | ✔ | | | | | | ✔ | |
| `executor` | | | ✔ | | | | | | ✔ | |
| `tool-registry` | ✔ | ✔ | | | | | | | | |
| `agent` | ✔ | | | ✔ | | | | | | |
| `guardrails` | ✔ | | | | | | | | | |
| `cost-calculator` | ✔ | | | | | | | | | |
| `prompts` | | | | | | | | ✔ | | |
