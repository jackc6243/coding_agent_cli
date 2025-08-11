import { BaseToolCallFactory } from "../tools/BaseToolCallFactory.js";
import { ToolCall, ToolCallFactory, ToolSchema } from "../types.js";
import { z } from "zod";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

export class MCPToolCallFactory extends BaseToolCallFactory {
    private mcpClient: Client; // MCP client instance

    constructor(mcpClient: Client) {
        super();
        this.mcpClient = mcpClient;
    }

    async executeToolCall<TResult = any>(
        toolCall: ToolCall<TResult>,
    ): Promise<void> {
        try {
            const result = await this.mcpClient.callTool({
                name: toolCall.name,
                arguments: toolCall.args || {},
            });
            const validatedContent = this.validateOutputSchema<TResult>(toolCall.name, result.content);

            toolCall.result = {
                content: validatedContent,
                isError: result.isError ? true : false,
                executedAt: new Date(),
            };
        } catch (error) {
            toolCall.result = {
                content: (error as Error).message as TResult,
                isError: true,
                executedAt: new Date(),
            };
        }
    }
}
