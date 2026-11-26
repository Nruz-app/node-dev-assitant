# 11 · Guía de uso

> **Propósito de esta sección:** tutorial paso a paso para usar DevAssistant desde cero, con ejemplos y solución de problemas.

## 1️⃣ Instalar

```bash
cd "D:/Cursos/Curso IA Developers/DEV-ASSITANT"   # o donde tengas el proyecto
npm install
```

> `better-sqlite3` y `sqlite-vec` incluyen binarios nativos. Si `npm install` falla en Windows, revisa que tu versión de Node sea compatible (18+, probado con 22).

## 2️⃣ Configurar

```bash
cp .env.template .env
```

Edita `.env` y como mínimo pon:

```env
ANTHROPIC_API_KEY=sk-ant-...      # obligatoria
OPENAI_API_KEY=sk-...             # necesaria para /ingest y search_docs
```

El resto de variables tienen valores por defecto razonables (ver [07](07-configuracion.md)).

Comprueba que el código compila y que los tests pasan (no gastan API):

```bash
npm run typecheck
npm test
```

## 3️⃣ Arrancar la CLI

```bash
npm run dev
```

```text
╔════════════════════════════════════════╗
║         DevAssistant v1.0              ║
║    Agente de Documentación y Código    ║
╚════════════════════════════════════════╝

💬 Escribe tu pregunta y presiona Enter.
💡 Tip: usa /ingest para cargar documentación
   Comandos: /ingest [path],
             /clear, /stats, /tools, /exit

Tú:
```

> ⚠️ Ejecuta siempre desde la **raíz del proyecto**: las tools de archivos solo pueden ver el directorio desde el que arrancas.

## 4️⃣ Cargar documentación

```text
Tú: /ingest
```

Usa `DOCS_PATH` (por defecto la documentación de ejemplo de TaskFlow). Para tu propia documentación:

```text
Tú: /ingest ./docs/mi-proyecto
```

- Se leen los `.md` de la carpeta **y de sus subcarpetas** (se omiten las ocultas y `node_modules`). Las fuentes se citan con la ruta relativa (`guias/README.md`).
- Cada ingesta **reemplaza** la anterior. Si quieres varias carpetas, ponlas bajo una carpeta común.
- Repite `/ingest` cada vez que cambie la documentación.

Alternativa sin abrir la CLI: `npm run ingest` (también genera `data/chunks-preview.json`, útil para ver cómo quedaron los chunks).

## 5️⃣ Preguntar

### Sobre la documentación (usa `search_docs`)

```text
Tú: ¿Cómo me autentico en la API?
Tú: ¿Qué hago si recibo un error 429?
Tú: ¿Qué eventos de webhook existen y cómo verifico la firma?
Tú: ¿Cómo pagino los resultados de GET /tasks?
```

### Sobre el código (usa `list_files`, `read_file`, `search_code`)

```text
Tú: ¿Qué archivos hay en src/rag?
Tú: ¿Dónde se usa retrieveContext?
Tú: Explícame cómo funciona el chunker leyendo src/rag/chunker.ts
Tú: ¿Qué hace la clase DevAssistantAgent y cuál es su límite de tools?
```

### Acciones (usa `create_issue`)

```text
Tú: Crea un issue: la ingesta no lee subcarpetas. Etiquetas: rag, enhancement. Prioridad: medium.
```

Resultado: `issues/issue-001.md`.

### Consejos para preguntar mejor

- Sé específico: "¿cómo renuevo el token?" funciona mejor que "háblame de la API".
- Para tareas largas, divídelas: hay un máximo de **8 tool calls por respuesta**.
- Si la respuesta no cita una fuente, pide explícitamente: "búscalo en la documentación".
- El agente recuerda la conversación: puedes decir "y ¿cómo lo renuevo?" después de una pregunta.

## 6️⃣ Comandos útiles

| Comando | Para qué |
|---|---|
| `/tools` | Ver qué herramientas tiene el agente |
| `/stats` | Tokens y costo estimado de la sesión |
| `/clear` | Empezar un tema nuevo sin arrastrar contexto (más barato) |
| `/exit` | Salir con un resumen |

## 7️⃣ Otros programas

```bash
npm run review ./src/rag/chunker.ts      # code review de un archivo
npm run demo                             # demo automática de 4 escenarios
npx tsx src/security/examples.ts         # ver los guardrails en acción (gratis)
npm run build                            # compilar a dist/
```

## 8️⃣ Usar DevAssistant con TU proyecto

1. Copia tus `.md` a una carpeta, p. ej. `docs/mi-proyecto/` (puede tener subcarpetas).
2. Pon `DOCS_PATH=./docs/mi-proyecto` en `.env` (o usa `/ingest ./docs/mi-proyecto`).
3. Para que explore el código de otro repositorio, ejecuta la CLI **desde ese repositorio** apuntando al script, por ejemplo:
   ```bash
   cd /ruta/a/otro-repo
   npx --prefix "D:/Cursos/Curso IA Developers/DEV-ASSITANT" tsx "D:/Cursos/Curso IA Developers/DEV-ASSITANT/src/index.ts"
   ```
   Ten en cuenta que entonces `.env`, `DB_PATH` e `issues/` también se resuelven respecto a ese directorio: copia allí tu `.env`.
4. Ajusta el system prompt (`src/agent/system-prompt.ts`) si quieres otro tono o reglas.

## 🩺 Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| `Error: ANTHROPIC_API_KEY está vacía` al arrancar | Falta `.env` o la key | `cp .env.template .env` y rellena la key |
| `No se conocen las dimensiones del modelo de embeddings` | `OPENAI_EMBEDDING_MODEL` no está en la tabla de modelos conocidos | Añade `EMBEDDING_DIMENSIONS=…` al `.env` |
| Aviso `OPENAI_API_KEY está vacía` | No hay key de OpenAI | Añádela si quieres usar RAG |
| "No se encontraron documentos relevantes… /ingest" | Base vacía | `/ingest` |
| "No se encontraron archivos .md" | La ruta no tiene `.md` (ni en subcarpetas) | Revisa la ruta (es relativa a donde ejecutas) |
| `No se pudo leer el directorio` | La ruta no existe | Usa una ruta relativa a la raíz del proyecto |
| "El vector tiene N dimensiones pero la base usa M" | Cambiaste `OPENAI_EMBEDDING_MODEL` después de ingestar | Vuelve a ejecutar `/ingest` (recrea la tabla con la dimensión nueva) |
| "Error de seguridad: … fuera del proyecto" | El modelo intentó leer fuera del sandbox (también vía symlink) | Es lo esperado; ejecuta desde el directorio correcto |
| "Error de seguridad: … contiene secretos" | Se pidió leer `.env` | Es lo esperado: el agente nunca lee tus keys |
| "Demasiadas solicitudes en poco tiempo" | Más de 10 mensajes en 60 s | Espera un minuto |
| "Tu mensaje contiene patrones…" | Un guardrail detectó una frase tipo "ignora las instrucciones", "ahora eres…" o "actúa como otra IA / sin restricciones" | Reformula. "Actúa como revisor…" sí está permitido |
| "He alcanzado el límite de 8 llamadas…" | La tarea requiere demasiadas tools | Divide la pregunta |
| `Modelo X no tiene precio definido` | `ANTHROPIC_MODEL` no está en `PRICING` | Añádelo en `utils/cost-calculator.ts` |
| Error 401 / 429 de la API | Key inválida o límite del proveedor | Revisa la key, el saldo o espera |
