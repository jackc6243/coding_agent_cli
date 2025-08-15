import { getMCPWeatherClient } from "../mcp/clients/getWeatherClient.js";
import { getTerminalClient } from "../tools/terminal/getTerminalClient.js";
import { Context } from "./context.js";
import { SYSTEM_PROMPTS } from "../config/SystemPrompts.js";

export function getDefaultAllContext(openaiApiKey?: string): Context {
    const ctx = new Context(SYSTEM_PROMPTS.DEFAULT_AGENT, openaiApiKey);
    ctx.registerClient(getMCPWeatherClient);
    ctx.registerClient(getTerminalClient);

    return ctx;
}