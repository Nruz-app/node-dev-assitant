import * as readline from "readline";
import config from "../config.js";
import { indexDocuments } from "../rag/indexer.js";
import { getEmbeddingTokensUsed } from "../rag/embeddings.js";
import { DevAssistantAgent } from "../agent/agent.js";
import { ALL_TOOL_DEFINITIONS } from "../agent/tool-registry.js";
import { checkGuardrails, createRateLimiter } from "../security/guardrails.js";
import { calculateCost, formatUSD } from "../utils/cost-calculator.js";

// Costo de la sesión: chat (Claude) + embeddings (OpenAI: ingestas y search_docs)
function sessionCost(agent: DevAssistantAgent) {
  const stats = agent.getStats();
  const chat = calculateCost({
    inputTokens: stats.inputTokens,
    outputTokens: stats.outputTokens,
    model: config.anthropicModel,
  });
  const embeddingTokens = getEmbeddingTokensUsed();
  const embeddings = calculateCost({
    inputTokens: embeddingTokens,
    outputTokens: 0,
    model: config.openaiEmbeddingModel,
  });
  return { stats, chat, embeddings, embeddingTokens, totalUSD: chat.totalCost + embeddings.totalCost };
}

function printTools(): void {
  console.log(`\nTools disponibles (${ALL_TOOL_DEFINITIONS.length}):`);
  for (const tool of ALL_TOOL_DEFINITIONS) {
    const params = Object.keys(tool.input_schema.properties).join(", ");
    console.log(`   • ${tool.name}(${params})`);
    // Primera frase (se corta en ". " para no partir rutas como ./issues/)
    const shortDescription = tool.description.split(". ")[0]?.replace(/\.$/, "") ?? tool.description;
    console.log(`     ${shortDescription}.`);
  }
  console.log("");
}

function printStats(agent: DevAssistantAgent): void {
  const { stats, chat, embeddings, embeddingTokens, totalUSD } = sessionCost(agent);
  console.log(`\n📊 Estadísticas de la sesión:`);
  console.log(`   • Turnos de la conversación actual: ${stats.turns}`);
  console.log(`   • Tokens de entrada acumulados (Claude): ${stats.inputTokens}`);
  console.log(`   • Tokens de salida acumulados (Claude): ${stats.outputTokens}`);
  console.log(`   • Tokens de embeddings (OpenAI): ${embeddingTokens}`);
  console.log(
    `   • Costo estimado: ${formatUSD(totalUSD)} (chat ${chat.formatted} + embeddings ${embeddings.formatted})`,
  );
  console.log(`   • Tool calls en el último turno: ${stats.toolCallsLastTurn}\n`);
}

/** Procesa una línea. Devuelve false cuando hay que cerrar la CLI. */
async function handleInput(
  userInput: string,
  agent: DevAssistantAgent,
  rateLimiter: ReturnType<typeof createRateLimiter>,
): Promise<boolean> {
  if (userInput === "/stats") {
    printStats(agent);
    return true;
  }
  if (userInput === "/exit" || userInput === "/salida") {
    const { stats, totalUSD } = sessionCost(agent);
    console.log(`\n¡Hasta luego!`);
    console.log(
      ` Resumen: ${stats.inputTokens} tokens de entrada, ` +
        `${stats.outputTokens} tokens de salida, ` +
        `${formatUSD(totalUSD)} costo estimado`,
    );
    return false;
  }
  if (userInput === "/clear" || userInput === "/limpiar") {
    agent.clearHistory();
    console.log("Historial reiniciado (los tokens y el costo de la sesión se conservan en /stats)\n");
    return true;
  }
  if (userInput === "/tools") {
    printTools();
    return true;
  }
  if (userInput === "/ingest" || userInput.startsWith("/ingest ")) {
    const docsDirectory = userInput.slice("/ingest".length).trim() || config.docsPath;
    try {
      await indexDocuments(docsDirectory);
      console.log("Vector store actualizado — listo para búsquedas\n");
    } catch (error) {
      console.error(`\nError durante la ingestión: ${(error as Error).message}\n`);
    }
    return true;
  }

  const guardrail = checkGuardrails(userInput, rateLimiter);
  if (!guardrail.safe) {
    console.log(`\n${guardrail.reason}\n`);
    return true;
  }
  try {
    process.stdout.write(`\nDevAssistant: `);
    const response = await agent.chat(guardrail.sanitized, (fragment) => {
      process.stdout.write(fragment);
    });
    process.stdout.write(`\n`);
    if (response.toolsUsed.length > 0) {
      const uniqueTools = [...new Set(response.toolsUsed)];
      console.log(`\nHerramientas utilizadas: ${uniqueTools.join(", ")}`);
    }
    console.log("");
  } catch (error) {
    console.error(` Error: ${(error as Error).message}\n`);
  }
  return true;
}

export async function startCLI(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "Tú: ",
  });
  const agent = new DevAssistantAgent();
  const rateLimiter = createRateLimiter();

  console.log("╔════════════════════════════════════════╗");
  console.log("║         DevAssistant v1.0              ║");
  console.log("║    Agente de Documentación y Código    ║");
  console.log("╚════════════════════════════════════════╝");
  console.log("");
  console.log("💬 Escribe tu pregunta y presiona Enter.");
  console.log("💡 Tip: usa /ingest para cargar documentación");
  console.log("   Comandos: /ingest [path],");
  console.log("             /clear, /stats, /tools, /exit");
  console.log("");

  rl.prompt();
  // Las líneas se procesan de una en una: mientras el agente responde, las nuevas esperan en cola
  for await (const line of rl) {
    const userInput = line.trim();
    if (userInput) {
      const keepGoing = await handleInput(userInput, agent, rateLimiter);
      if (!keepGoing) break;
    }
    rl.prompt();
  }
  rl.close();
}
