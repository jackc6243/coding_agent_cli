import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { BaseToolClient } from "../tools/BaseToolClient.js";
import { SERVICE_CONFIG } from "../config/Constants.js";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { ToolCall } from "../tools/types.js";

export class MCPToolClient extends BaseToolClient {
    private mcpClient: Client;

    constructor(name: string, transport: StdioClientTransport) {
        super(name);
        this.mcpClient = new Client({ name: `mcp_client_${name}`, version: SERVICE_CONFIG.MCP_CLIENT_VERSION });
        this.connectToServer(transport);
    }

    async connectToServer(transport: StdioClientTransport) {
        try {
            await this.mcpClient.connect(transport);

            const toolsResult = await this.mcpClient.listTools();
            this.logger.logObject("MCP Tools List Result", toolsResult, 'debug');

            toolsResult.tools.forEach((tool) => {
                this.logger.logObject(`Registering tool: ${tool.name}`, tool, 'debug');
                this.registerTool(tool);
            });
            this.logger.log("Connected to server with tools:", 'success');

        } catch (e) {
            this.logger.log(`Failed to connect to MCP server: ${e}`, 'error');
            throw e;
        }
    }

    async populateToolCallResult(toolCall: ToolCall): Promise<void> {
        try {
            this.logger.logObject("Input ToolCall", toolCall, 'debug');

            // Validate against the tool's input schema (your BaseToolClient method)
            this.validateInputSchema(toolCall);

            // Call the MCP tool — result is already the unwrapped JSON-RPC "result" object
            const result = await this.mcpClient.callTool({
                name: toolCall.toolName,
                arguments: toolCall.args || {},
            });

            let aggregatedText: string[] = [];
            let nonTextContent: unknown[] = [];

            // MCP spec says "content" is always an array of ContentPart objects
            if (result && result.content && Array.isArray(result.content)) {
                for (const part of result.content) {
                    switch (part.type) {
                        case "text":
                            if (typeof part.text === "string") {
                                aggregatedText.push(part.text);
                            }
                            break;
                        // Explicit markdown support (defined in MCP content types)
                        case "markdown":
                            if (typeof part.text === "string") {
                                aggregatedText.push(part.text);
                            }
                            break;
                        default:
                            // Any other type (image, file, custom, etc.) is preserved raw
                            nonTextContent.push(part);
                            break;
                    }
                }
            }

            // Define the final content, preferring aggregated text when available
            let finalContent: unknown;
            if (aggregatedText.length > 0) {
                finalContent = aggregatedText.join("\n");
            } else if (nonTextContent.length > 0) {
                finalContent = nonTextContent;
            } else {
                finalContent = null;
            }

            // Set successful result
            toolCall.result = {
                content: finalContent,
                isError: false,
                executedAt: new Date(),
            };

            // Validate output against schema if defined
            this.validateOutputSchema(toolCall);

        } catch (error) {
            // If an MCP server returns a JSON-RPC error, the SDK will throw here
            this.logger.logObject("ToolCall Error", error, 'error');

            toolCall.result = {
                content: (error as Error).message,
                isError: true,
                executedAt: new Date(),
            };
        }
    }

    async cleanup() {
        await this.mcpClient.close();
    }
}
