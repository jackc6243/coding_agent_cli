import { ToolCall, ToolClient } from "./types.js";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { Ajv } from "ajv";
import { ConsoleLogger } from "../logging/ConsoleLogger.js";
import { getAppConfig } from "../config/AppConfig.js";

export abstract class BaseToolClient implements ToolClient {
    private ajv = new Ajv({ allErrors: true, strict: false });
    protected logger = new ConsoleLogger(getAppConfig().logging.level);
    clientName: string;
    tools: Map<string, Tool>;

    constructor(name: string) {
        this.clientName = name;
        this.tools = new Map();
    }

    abstract populateToolCallResult(toolCall: ToolCall): Promise<void>;

    protected beforeToolCall(toolCall: ToolCall): void {
        // Default implementation - can be overridden by subclasses
        this.logger.log(`Executing tool: ${toolCall.toolName} with args: ${JSON.stringify(toolCall.args)}`, 'debug');
    }

    protected afterToolCall(toolCall: ToolCall): void {
        // Default implementation - can be overridden by subclasses
        this.logger.log(`Completed tool: ${toolCall.toolName} with result: ${JSON.stringify(toolCall.result)}`, 'debug');
    }

    async executeToolCall(toolCall: ToolCall): Promise<void> {
        this.beforeToolCall(toolCall);
        try {
            await this.populateToolCallResult(toolCall);
            this.afterToolCall(toolCall);
        } catch (error) {
            this.logger.log(`Tool call failed: ${toolCall.toolName} - ${error}`, 'error');
            throw error;
        }
    }

    getToolList(): Tool[] {
        const l: Tool[] = [];
        for (const [, v] of this.tools) {
            l.push(v);
        }
        return l;
    }

    registerTool(tool: Tool): void {
        this.logger.log(`client name: [${this.clientName}], Tool name: [${tool.name}] has been registered.`, 'info');
        this.tools.set(tool.name, tool);
    }

    cleanUp(): void { }

    validateInputSchema(toolCall: ToolCall): void {
        const tool = this.tools.get(toolCall.toolName);
        if (!tool) {
            throw Error("The tool input you are trying to validate doesn't exist")
        }

        const validate = this.ajv.compile(tool.inputSchema);
        if (!validate(toolCall.args)) {
            throw new Error(`Invalid arguments for tool '${toolCall.toolName}' with error: [${validate.errors}]`);
        }
    }

    validateOutputSchema(toolCall: ToolCall): void {
        const tool = this.tools.get(toolCall.toolName);
        if (!tool) {
            this.logger.log("Can't find tool", 'error');
            throw Error("The tool output you are trying to validate doesn't exist")
        }

        if (tool.outputSchema) {
            const validate = this.ajv.compile(tool.outputSchema);
            if (!validate(toolCall.result)) {
                this.logger.log("invalid tool output", 'error');
                throw new Error(`Invalid output for tool '${toolCall.toolName}' with error: [${validate.errors}]`);
            }

            this.logger.log("Tool Call validated", 'debug');
        }
    }


}
