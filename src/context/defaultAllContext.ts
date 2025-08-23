import { getMCPWeatherClient } from "../mcp/clients/getWeatherClient.js";
import { getTerminalClient } from "../tools/terminal/getTerminalClient.js";
import { ContextManager } from "./contextManager.js";
import { SYSTEM_PROMPTS } from "../config/SystemPrompts.js";

export function getDefaultAllContext(openaiApiKey?: string): ContextManager {
    // TODO: This function needs to be updated with proper dependencies
    // For now, just throw an error to indicate it needs to be fixed
    throw new Error("getDefaultAllContext needs to be updated with proper ContextManager dependencies");
}