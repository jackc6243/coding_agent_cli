import { ToolCall, ToolClient } from "./types.js";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { Ajv } from "ajv";
import { ConsoleLogger } from "../logging/ConsoleLogger.js";

export abstract class BaseToolClient implements ToolClient {
    private ajv = new Ajv({ allErrors: true, strict: false });
    protected logger = new ConsoleLogger("debug");
    clientName: string;
    tools: Map<string, Tool>;

    constructor(name: string) {
        this.clientName = name;
        this.tools = new Map();
    }

    abstract populateToolCallResult(toolCall: ToolCall): Promise<void>;

    getToolList(): Tool[] {
        const l: Tool[] = [];
        for (const [, v] of this.tools) {
            l.push(v);
        }
        return l;
    }

    registerTool(tool: Tool): void {
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
            this.logger.log("Can't find tool");
            throw Error("The tool output you are trying to validate doesn't exist")
        }

        if (tool.outputSchema) {
            const validate = this.ajv.compile(tool.outputSchema);
            if (!validate(toolCall.result)) {
                this.logger.log("invalid tool output");
                throw new Error(`Invalid output for tool '${toolCall.toolName}' with error: [${validate.errors}]`);
            }

            this.logger.log("Tool Call validated");
        }
    }


}
