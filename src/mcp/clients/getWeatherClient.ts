import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { MCPToolClient } from "../MCPToolClient.js";

export function getMCPWeatherClient(): MCPToolClient {
    const serverScriptPath: string = "./dist/mcp/servers/weather/src/index.js";
    const isJs = serverScriptPath.endsWith(".js");
    if (!isJs) {
        throw new Error("Server script must be a .js file");
    }
    const command = process.execPath;

    const transport = new StdioClientTransport({
        command,
        args: [serverScriptPath],
    });

    const client = new MCPToolClient("WeatherForecast", transport); // Note there most not be any - in the name

    return client;
}