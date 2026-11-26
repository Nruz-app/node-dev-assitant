import { validateConfig } from "./config.js";
import { startCLI } from "./chat/cli.js";

async function main(): Promise<void> {
  // Falla rápido si faltan las API keys, antes de abrir la CLI
  validateConfig();
  await startCLI();
}

main().catch((error: Error) => {
  console.error(" Error: ", error.message);
  process.exit(1);
});
