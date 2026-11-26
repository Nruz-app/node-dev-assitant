# 04 · Flujos

> **Propósito de esta sección:** describir paso a paso qué ocurre en cada operación, con diagramas de secuencia y de actividad.

Índice:
1. [Arranque de la CLI](#1-arranque-de-la-cli-)
2. [Bucle de la CLI y enrutado de comandos](#2-bucle-de-la-cli-y-enrutado-de-comandos-)
3. [Ingesta de documentación (`/ingest` y `npm run ingest`)](#3-ingesta-de-documentación-)
4. [Un turno del agente (agentic loop)](#4-un-turno-del-agente-agentic-loop-)
5. [Tool `search_docs` (consulta RAG)](#5-tool-search_docs-consulta-rag-)
6. [Tools de archivos con sandbox](#6-tools-de-archivos-con-sandbox-)
7. [Tool `create_issue`](#7-tool-create_issue-)
8. [Code review (`npm run review`)](#8-code-review-npm-run-review-)
9. [Demo automática (`npm run demo`)](#9-demo-automática-npm-run-demo-)
10. [RAG directo sin agente (`askWithRAG`)](#10-rag-directo-sin-agente-askwithrag-)

---

## 1. Arranque de la CLI ✅

```mermaid
sequenceDiagram
    autonumber
    actor Dev as 👤 Desarrollador
    participant NPM as npm run dev
    participant IDX as index.ts
    participant CFG as config.ts
    participant ENV as .env
    participant CLI as chat/cli.ts

    Dev->>NPM: npm run dev
    NPM->>IDX: tsx src/index.ts
    IDX->>CFG: import (se evalúa el módulo)
    CFG->>ENV: dotenv.config()
    ENV-->>CFG: process.env
    CFG->>CFG: dimensiones del embedding (modelo o EMBEDDING_DIMENSIONS)
    CFG-->>IDX: config
    IDX->>CFG: validateConfig()
    alt falta ANTHROPIC_API_KEY
        CFG-->>IDX: throw Error
        IDX-->>Dev: " Error: ANTHROPIC_API_KEY está vacía…" y exit(1)
    else falta OPENAI_API_KEY
        CFG-->>Dev: warning (RAG no funcionará), continúa
    end
    IDX->>CLI: startCLI()
    CLI->>CLI: new DevAssistantAgent(), createRateLimiter()
    CLI-->>Dev: banner + "Tú: "
```

> Importante: al **importar** `config.ts`, `llm/anthropic-client.ts` y `rag/embeddings.ts` se crean los clientes de Anthropic y OpenAI con las keys del `.env` (efecto secundario de import).

## 2. Bucle de la CLI y enrutado de comandos ✅

`startCLI()` lee las líneas con `for await (const line of rl)` y delega cada una en `handleInput()`. Mientras el agente responde, las líneas nuevas esperan en cola.

```mermaid
flowchart TD
    A["for await (line of rl)<br/>prompt 'Tú: '"] --> B{"input vacío?"}
    B -->|sí| A
    B -->|no| C{"handleInput: ¿qué es?"}
    C -->|/stats| S["getStats() + tokens de embeddings<br/>costo chat + embeddings"] --> A
    C -->|/exit o /salida| X["Resumen final + break"] --> FIN(["rl.close()"])
    C -->|/clear o /limpiar| L["agent.clearHistory()<br/>(los tokens de la sesión se conservan)"] --> A
    C -->|/tools| T["Lista ALL_TOOL_DEFINITIONS<br/>nombre(params) + 1ª frase"] --> A
    C -->|"/ingest ruta"| I["indexDocuments(ruta ?? DOCS_PATH)"] --> A
    C -->|texto libre| G["checkGuardrails(input, rateLimiter)"]
    G -->|safe = false| M["Imprime reason"] --> A
    G -->|safe = true| AG["agent.chat(sanitized, onChunk)<br/>streaming a stdout"]
    AG --> H["Imprime 'Herramientas utilizadas'"] --> A
    AG -->|excepción| E["console.error"] --> A
```

## 3. Ingesta de documentación ✅

Una sola implementación: `indexDocuments()` en `rag/indexer.ts`, usada por el comando `/ingest` de la CLI y por `npm run ingest` (`rag/ingest.ts`, que además pide escribir `data/chunks-preview.json`).

```mermaid
sequenceDiagram
    autonumber
    actor Dev as 👤 Desarrollador
    participant CLI as cli.ts / ingest.ts
    participant IX as rag/indexer.ts
    participant CH as rag/chunker.ts
    participant FS as 📁 docs/**/*.md
    participant EM as rag/embeddings.ts
    participant OAI as ☁️ OpenAI
    participant RET as rag/retriever.ts
    participant VS as rag/vector-store.ts
    participant DB as 🗄️ vectors.db

    Dev->>CLI: /ingest ./docs/sample-project
    CLI->>IX: indexDocuments(ruta)
    IX->>CH: processDirectory(ruta)
    CH->>FS: recorre subcarpetas (omite ocultas y node_modules)
    loop por cada .md (orden por ruta relativa)
        CH->>FS: readFile(utf-8)
        CH->>CH: chunkMarkdown(contenido, ruta relativa)
    end
    CH-->>IX: Chunk[] (p.ej. 30)
    alt 0 chunks
        IX-->>Dev: "No se encontraron archivos .md (no se modificó el índice)"
    end
    loop lotes de 100 textos
        IX->>EM: generateEmbeddings
        EM->>OAI: embeddings.create(lote)
        OAI-->>EM: vectores (+ usage tokens)
    end
    IX->>IX: ¿dimensión = config.embeddingDimensions? si no, error
    IX->>RET: resetStore() (cierra el singleton)
    IX->>VS: new VectorStore(DB_PATH, dimensiones)
    IX->>VS: clear() — borra todo y recrea la tabla vec0 con la dimensión actual
    IX->>VS: insertMany(chunks, vectores) — una transacción
    VS->>DB: INSERT en chunks y chunk_embeddings
    IX->>VS: close()
    IX-->>Dev: "N chunks de M archivos almacenados…"
```

### Algoritmo de chunking (`chunkMarkdown`)

```mermaid
flowchart TD
    A["Contenido .md"] --> B["Normalizar CRLF → LF"]
    B --> C["Dividir antes de cada línea '## '<br/>(regex /(?=^## )/m)"]
    C --> D{"¿sección ≤ 2000 chars?"}
    D -->|sí| E["1 chunk = último párrafo del chunk anterior (solapamiento)<br/>+ sección completa"]
    D -->|no| F["Quitar la línea de encabezado<br/>dividir el cuerpo en párrafos (\\n\\n)"]
    F --> G["Acumular párrafos hasta superar 2000 chars"]
    G --> H["Emitir chunk = '## Encabezado' + párrafos<br/>el siguiente empieza con el último párrafo (solapamiento)"]
    H --> G
    E --> I["id = rutaRelativa-posición (p.ej. guias/README.md-2)<br/>metadata: source, heading, position, charCount"]
    H --> I
```

- El texto antes del primer `## ` se etiqueta como `heading: "(Introducción)"`.
- El solapamiento de **un párrafo** entre chunks consecutivos mantiene el contexto entre fragmentos.
- Los encabezados `###` no dividen; quedan dentro del chunk de su `##`.
- `source` es la ruta relativa al directorio ingestado, con `/` como separador; así dos `README.md` en carpetas distintas no colisionan.

## 4. Un turno del agente (agentic loop) ✅

`DevAssistantAgent.chat(userMessage, onChunk?)` en `src/agent/agent.ts`. Cada iteración hace **una sola llamada** a través de `callModel()`: con `onChunk` usa `messages.stream` (el texto se emite en tiempo real) y `finalMessage()` para leer `stop_reason` y `usage`; sin `onChunk` usa `messages.create`.

```mermaid
sequenceDiagram
    autonumber
    participant CLI as cli.ts
    participant AG as DevAssistantAgent
    participant API as ☁️ Claude (stream o create)
    participant REG as tool-registry.ts

    CLI->>AG: chat(texto, onChunk)
    AG->>AG: turns++, toolCallsLastTurn = 0<br/>messages.push({user, texto})
    loop mientras toolCallsLastTurn < 8
        AG->>API: callModel: model, system, tools[5], messages
        API-->>CLI: onChunk(fragmento) … texto en tiempo real
        API-->>AG: finalMessage (stop_reason + usage)
        AG->>AG: suma tokens del turno y de la sesión
        alt stop_reason = "tool_use"
            AG->>AG: ¿toolCalls + nuevas > 8? → mensaje de límite y return
            AG->>AG: messages.push({assistant, content con tool_use})
            par cada bloque tool_use (en paralelo)
                AG->>REG: executeAnyTool(name, input)
                REG-->>AG: string (resultado o error)
            end
            AG->>AG: messages.push({user, tool_result[]})
        else stop_reason = "end_turn"
            AG->>AG: messages.push({assistant, texto})
            AG-->>CLI: AgentResponse {text, toolsUsed, tokens}
        else otro stop_reason (max_tokens, etc.)
            AG-->>CLI: texto disponible o "Sesión terminada inesperadamente"
        end
    end
```

### Estados del loop

```mermaid
stateDiagram-v2
    [*] --> LlamandoClaude: chat(mensaje)
    LlamandoClaude --> EjecutandoTools: stop_reason = tool_use
    EjecutandoTools --> LlamandoClaude: tool_result añadido
    EjecutandoTools --> LimiteAlcanzado: > 8 tool calls
    LlamandoClaude --> Respondido: end_turn (texto ya emitido en streaming)
    LlamandoClaude --> Inesperado: max_tokens / otro
    Respondido --> [*]
    LimiteAlcanzado --> [*]
    Inesperado --> [*]
```

**Historial de mensajes** tras un turno con una tool:

```text
[user]      "¿Cómo me autentico?"
[assistant] [text?, tool_use{id: toolu_1, name: search_docs, input:{query}}]
[user]      [tool_result{tool_use_id: toolu_1, content: "Se encontraron 5 fragmentos…"}]
[assistant] "TaskFlow usa JWT…"          ← texto final (de la misma llamada en streaming)
```

## 5. Tool `search_docs` (consulta RAG) ✅

```mermaid
sequenceDiagram
    autonumber
    participant REG as tool-registry.ts
    participant RET as retriever.ts
    participant VS as VectorStore (singleton)
    participant EM as embeddings.ts
    participant OAI as ☁️ OpenAI
    participant DB as 🗄️ vectors.db

    REG->>RET: retrieveContext(query, min(top_k ?? 5, 10))
    RET->>VS: getStore() (lo crea la 1ª vez)
    RET->>VS: size
    alt store vacío
        RET-->>REG: [] → "No se encontraron documentos… usa /ingest"
    else hay chunks
        RET->>EM: generateEmbedding(query)
        EM->>OAI: embeddings.create(query)
        OAI-->>EM: number[dimensiones]
        RET->>VS: search(vector, topK) — error claro si la dimensión no coincide con la base
        VS->>DB: SELECT … WHERE embedding MATCH ? AND k = ? ORDER BY distance
        DB-->>VS: filas + distance
        VS-->>RET: SearchResult[] (score = 1 − distance/2)
        RET-->>REG: RetrievedChunk[]
        REG-->>REG: formatea "[FUENTE: x | Sección: y | Relevancia: z%]\ncontenido" unidos por ---
    end
```

## 6. Tools de archivos con sandbox ✅

```mermaid
flowchart TD
    A["executeTool(name, params)"] --> V{"¿params válidos?<br/>(typeof string)"}
    V -->|no| ERR1["'Error: el parámetro … es requerido'"]
    V -->|sí| R["resolveSecurePath(ruta)<br/>path.resolve(cwd, ruta)"]
    R --> S{"¿dentro de cwd?"}
    S -->|no| ERR2["'Error de seguridad: … fuera del proyecto'"]
    S -->|sí| RP{"¿existe?"}
    RP -->|no| T
    RP -->|sí| RR{"realpath (resuelve symlinks)<br/>¿sigue dentro de cwd?"}
    RR -->|no| ERR2
    RR -->|sí| T{"tool"}
    T -->|list_files| LF["collectFiles recursivo<br/>omite node_modules, .ocultos y symlinks<br/>filtro por extensión"]
    T -->|read_file| SEC{"¿.env / .env.local…?"}
    SEC -->|sí| ERR3["'Error de seguridad: contiene secretos'"]
    SEC -->|no| RF["stat → si > 50.000 bytes: error<br/>si no: contenido completo"]
    T -->|search_code| SC["collectFiles + includes(pattern)<br/>máx 20 coincidencias, ±2 líneas de contexto"]
```

## 7. Tool `create_issue` ✅

```mermaid
sequenceDiagram
    participant AG as Agente
    participant REG as tool-registry.ts
    participant FS as 📁 ./issues/
    AG->>REG: create_issue {title, description, labels?, priority?}
    REG->>FS: mkdir ./issues (recursive)
    REG->>FS: readdir → números de los issue-NNN.md existentes
    REG->>REG: número = máximo + 1 (1 si no hay) → issue-NNN.md
    REG->>FS: writeFile(Markdown, flag wx: falla si ya existe, nunca sobrescribe)
    REG-->>AG: "Issue creado satisfactoriamente: issues/issue-NNN.md"
```

Formato del archivo generado:

```markdown
# Issue #1: Título

## Metadata

- **Fecha:** 2026-11-25
- **Prioridad:** high
- **Etiquetas:** bug, rag
- **Estado:** abierto

## Descripción

Texto de la descripción

---

*Issue creado automáticamente por DevAssistant*
```

## 8. Code review (`npm run review`) ✅

```mermaid
sequenceDiagram
    actor Dev as 👤 Desarrollador
    participant CR as exercises/code-reviewer.ts
    participant FS as 📁 archivo
    participant ST as llm/streaming.ts
    participant API as ☁️ Claude

    Dev->>CR: npm run review ./src/config.ts
    CR->>CR: ¿hay argumento? si no → uso y exit(1)
    CR->>FS: existsSync → si no existe: exit(1)
    CR->>CR: extensión soportada? (si no, solo warning)
    CR->>FS: readFileSync (si > 20.000 chars → trunca)
    CR->>ST: streamClaude(prompt con el código, CODE_REVIEWER_PROMPT)
    ST->>API: messages.stream(max_tokens 1024)
    API-->>Dev: review en tiempo real (✅ ⚠️ 🐛 🔒 + nota 1–10)
```

## 9. Demo automática (`npm run demo`) ✅

Ejecuta 4 escenarios con un mismo `DevAssistantAgent`, llamando a `clearHistory()` y esperando 800 ms entre ellos:

| # | Escenario | Pregunta | Tools esperadas |
|---|---|---|---|
| 1 | Exploración de código | "¿Qué funciones y valores exporta src/rag/retriever.ts?" | `read_file` o `search_code` |
| 2 | Búsqueda en docs | "¿Cómo se autentican las peticiones a la API…?" | `search_docs` (requiere ingesta previa) |
| 3 | Tarea multi-tool | "Lista los archivos de src/agent y lee el system prompt" | `list_files` + `read_file` |
| 4 | Crear issue | "Crea un issue de tipo bug: el vector store falla…" | `create_issue` → escribe en `issues/` |

## 10. RAG directo sin agente (`askWithRAG`) ✅

> No está conectado a la CLI.

`rag/rag-chain.ts` implementa el patrón RAG "clásico": recuperar → construir prompt aumentado → responder en streaming con un system prompt que obliga a usar **solo** el contexto. No lo usa ningún punto de entrada actual; es la versión previa (Sección RAG del curso) a convertir el RAG en una tool del agente.

```mermaid
flowchart LR
    Q["Pregunta"] --> R["retrieveContext(pregunta, RAG_TOP_K)"]
    R -->|0 chunks| N["'No hay documentación… usa /ingest'"]
    R -->|chunks| F["formatContext → [FUENTE…] contenido"]
    F --> P["Prompt aumentado:<br/>contexto + instrucciones + pregunta"]
    P --> S["streamClaudeWithCallback(prompt, onChunk, RAG_SYSTEM_PROMPT)"]
    S --> A["Respuesta citando fuente"]
```

---

> 📝 **Plantilla — preguntas a responder en tu proyecto**
> 1. ¿Cuáles son los flujos principales (arranque, operación central, flujos secundarios)?
> 2. Para cada uno: ¿quién participa y en qué orden? (diagrama de secuencia)
> 3. ¿Qué decisiones/ramas hay? (diagrama de actividad o de estados)
> 4. ¿Qué efectos secundarios produce (archivos, red, BD)?
