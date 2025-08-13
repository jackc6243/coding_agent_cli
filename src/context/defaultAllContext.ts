import { getMCPWeatherClient } from "../mcp/clients/getWeatherClient.js";
import { Context } from "./context.js";

export function getDefaultAllContext(): Context {
    const ctx = new Context("You are a helpful agent.");
    ctx.registerClient(getMCPWeatherClient);

    return ctx;
}