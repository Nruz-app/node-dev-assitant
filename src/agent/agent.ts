import Anthropic from "@anthropic-ai/sdk";
import { AGENT_SYSTEM_PROMPT } from "./system-prompt.js";
import { AgentResponse } from "../interface.js";
import { ALL_TOOL_DEFINITIONS, executeAnyTool } from "./tool-registry.js";
import { client } from "../llm/anthropic-client.js";
import config from "../config.js";

const MAX_TOOL_CALLS = 8;
const MAX_TOKENS = 4096;

function extractText(message: Anthropic.Messages.Message): string {
  return message.content
    .filter(
      (block): block is Anthropic.Messages.TextBlock => block.type === "text",
    )
    .map((block) => block.text)
    .join("\n");
}

export class DevAssistantAgent {
  private messages: Anthropic.Messages.MessageParam[] = [];
  // Totales de la SESIÓN: no se reinician con clearHistory() (representan el costo acumulado)
  private totalInputTokens: number = 0;
  private totalOutputTokens: number = 0;
  // Turnos de la CONVERSACIÓN actual: clearHistory() los reinicia
  private turns: number = 0;
  private toolCallsLastTurn: number = 0;

  constructor(private readonly systemPrompt: string = AGENT_SYSTEM_PROMPT) {}

  /**
   * Una llamada al modelo. Con onChunk usa streaming y emite el texto a medida que llega;
   * en ambos casos devuelve el mensaje completo (con stop_reason y usage).
   */
  private async callModel(
    onChunk?: (fragment: string) => void,
  ): Promise<Anthropic.Messages.Message> {
    const params = {
      model: config.anthropicModel,
      max_tokens: MAX_TOKENS,
      system: this.systemPrompt,
      tools: ALL_TOOL_DEFINITIONS as Anthropic.Messages.Tool[],
      messages: this.messages,
    };
    if (!onChunk) {
      return client.messages.create(params);
    }
    const stream = client.messages.stream(params);
    stream.on("text", (text) => onChunk(text));
    return stream.finalMessage();
  }

  async chat(
    userMessage: string,
    onChunk?: (fragment: string) => void,
  ): Promise<AgentResponse> {
    this.turns++;
    this.toolCallsLastTurn = 0;
    const toolsUsed: string[] = [];
    let inputTokensThisTurn = 0;
    let outputTokensThisTurn = 0;

    const finish = (text: string): AgentResponse => {
      this.messages.push({ role: "assistant", content: text });
      return {
        text,
        toolsUsed,
        inputTokens: inputTokensThisTurn,
        outputTokens: outputTokensThisTurn,
      };
    };
    const limitReached = (): AgentResponse => {
      console.warn(
        `Límite de ${MAX_TOOL_CALLS} tool calls alcanzado en este turno`,
      );
      return finish(
        `He alcanzado el límite de ${MAX_TOOL_CALLS} llamadas a herramientas por turno. ` +
          `Para completar esta tarea, intenta dividirla en preguntas más específicas.`,
      );
    };

    this.messages.push({ role: "user", content: userMessage });
    console.log(`\nAgente procesando turno ${this.turns}...`);

    while (this.toolCallsLastTurn < MAX_TOOL_CALLS) {
      const response = await this.callModel(onChunk);
      inputTokensThisTurn += response.usage.input_tokens;
      outputTokensThisTurn += response.usage.output_tokens;
      this.totalInputTokens += response.usage.input_tokens;
      this.totalOutputTokens += response.usage.output_tokens;

      if (response.stop_reason === "end_turn") {
        console.log("\nRespuesta final generada\n");
        return finish(extractText(response));
      }

      if (response.stop_reason === "tool_use") {
        const toolUseBlocks = response.content.filter(
          (block): block is Anthropic.Messages.ToolUseBlock =>
            block.type === "tool_use",
        );
        if (this.toolCallsLastTurn + toolUseBlocks.length > MAX_TOOL_CALLS) {
          return limitReached();
        }
        // El texto previo a las tools ya se emitió por streaming; se separa de lo que sigue
        if (onChunk && extractText(response)) onChunk("\n");

        this.messages.push({ role: "assistant", content: response.content });

        const results = await Promise.all(
          toolUseBlocks.map(async (block) => {
            this.toolCallsLastTurn++;
            const toolNum = this.toolCallsLastTurn;
            console.log(
              `Ejecutando tool: ${block.name} (${JSON.stringify(block.input)} [${toolNum}/${MAX_TOOL_CALLS}])`,
            );
            const toolOutput = await executeAnyTool(
              block.name,
              block.input as Record<string, unknown>,
            );
            console.log(`Herramienta completada: ${block.name}`);
            toolsUsed.push(block.name);
            return toolOutput;
          }),
        );
        const toolResultContent: Anthropic.Messages.ToolResultBlockParam[] =
          toolUseBlocks.map((block, i) => ({
            type: "tool_result" as const,
            tool_use_id: block.id,
            content: results[i] ?? "Error: resultado vacío",
          }));
        this.messages.push({ role: "user", content: toolResultContent });
        continue;
      }

      console.warn(
        `Stop reason inesperado: ${response.stop_reason ?? "desconocido"}`,
      );
      return finish(
        extractText(response) ||
          `Sesión terminada inesperadamente: ${response.stop_reason ?? "razón desconocida"}`,
      );
    }
    return limitReached();
  }

  /** Olvida la conversación (historial y turnos). Los tokens de la sesión se conservan. */
  clearHistory(): void {
    this.messages = [];
    this.turns = 0;
    this.toolCallsLastTurn = 0;
    console.log("Historial del agente limpiado");
  }

  /**
   * inputTokens/outputTokens: acumulados de toda la sesión (incluye conversaciones borradas con /clear).
   * turns: turnos de la conversación actual. toolCallsLastTurn: tools usadas en el último turno.
   */
  getStats(): {
    inputTokens: number;
    outputTokens: number;
    turns: number;
    toolCallsLastTurn: number;
  } {
    return {
      inputTokens: this.totalInputTokens,
      outputTokens: this.totalOutputTokens,
      turns: this.turns,
      toolCallsLastTurn: this.toolCallsLastTurn,
    };
  }
}
