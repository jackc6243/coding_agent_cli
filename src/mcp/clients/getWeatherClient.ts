import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { MCPToolClient } from "../MCPToolClient.js";
import { ContextManager } from "../../context/ContextManager.js";

export function getMCPWeatherClient(
  contextManager: ContextManager
): MCPToolClient {
  const serverScriptPath: string =
    "./src/mcp/serverPackages/weather/build/index.js";
  const isJs = serverScriptPath.endsWith(".js");
  if (!isJs) {
    throw new Error("Server script must be a .js file");
  }
  const command = process.execPath;

  const transport = new StdioClientTransport({
    command,
    args: [serverScriptPath],
  });

  const client = new MCPToolClient(
    "WeatherForecast",
    contextManager,
    transport
  ); // Note there most not be any - in the name

  return client;
}
