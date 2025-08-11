import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { LLM } from "../../../llm/llm.js";
import { ChatMessage } from "../../../types.js";
import { MCPToolCallFactory } from "../../MCPToolCallFactory.js";

export class MCPWeatherClient {
    private clientName: String;
    private mcp: Client;
    private llm: LLM;
    private transport: Transport | null = null;
    private toolCallFactory: MCPToolCallFactory;

    constructor(clientName: String, llm: LLM) {
        this.clientName = clientName;
        this.mcp = new Client({ name: `mcp-client-${clientName}`, version: "1.0.0" });
        this.llm = llm;
        this.toolCallFactory = new MCPToolCallFactory(this.mcp);
    }

    async connectToServer(serverScriptPath: string) {
        try {
            const isJs = serverScriptPath.endsWith(".js");
            if (!isJs) {
                throw new Error("Server script must be a .js file");
            }
            const command = process.execPath;

            this.transport = new StdioClientTransport({
                command,
                args: [serverScriptPath],
            });
            await this.mcp.connect(this.transport);

            const toolsResult = await this.mcp.listTools();
            toolsResult.tools.forEach((tool) => {
                this.llm.context.registerTool(tool);
                this.toolCallFactory.registerMCPTool(tool);
            });
            console.log(
                "Connected to server with tools:",
                this.llm.context.tools.map(({ name }) => name)
            );
        } catch (e) {
            console.log("Failed to connect to MCP server: ", e);
            throw e;
        }
    }

    async processQuery(query: string) {
        this.llm.addMessage(new ChatMessage("user", query))
        const response = await this.llm.sendMessage();

        if (response) {
            for (const toolCall of response.toolCalls) {
                if (!toolCall.result) {
                    await this.toolCallFactory.executeToolCall(toolCall);
                }
            }

            this.llm.context.addChatMessage(response);
        }

        return response;
    }
    async cleanup() {
        await this.mcp.close();
    }
}