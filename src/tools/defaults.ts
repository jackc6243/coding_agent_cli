import { LLM } from "../llm/llm.js";
import { getMCPWeatherClient } from "../mcp/clients/getWeatherClient.js";
import { FileEditToolClient } from "./FileEditToolClient.js";
import { TerminalToolClient } from "./TerminalToolClient.js";

export function registerDefaultTools(llm: LLM): void {
  // Register tool clients
  llm.toolManager.registerToolClients(
    (cm) => new FileEditToolClient(cm),
    llm.context
  );
  llm.toolManager.registerToolClients(
    (cm) => new TerminalToolClient(cm),
    llm.context
  );

  // Register MCP tool clients
  llm.toolManager.registerToolClients(
    (cm) => getMCPWeatherClient(cm),
    llm.context
  );
}
