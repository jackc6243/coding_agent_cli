import { ToolCall, ToolClient, ToolResult } from "./types.js";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { Ajv } from "ajv";
import { ConsoleLogger } from "../logging/ConsoleLogger.js";
import { getAppConfig } from "../config/AppConfig.js";

interface ToolRegistration {
  tool: Tool;
  handler: (
    args: Record<string, unknown>,
    toolName: string
  ) => Promise<ToolResult>;
}

export abstract class BaseToolClient implements ToolClient {
  private ajv = new Ajv({ allErrors: true, strict: false });
  protected logger = new ConsoleLogger(getAppConfig().logging.level);
  clientName: string;
  tools: Map<string, ToolRegistration>;

  constructor(name: string) {
    this.clientName = name;
    this.tools = new Map();
  }

  async executeToolCall(toolCall: ToolCall): Promise<void> {
    try {
      this.validateInputSchema(toolCall);

      this.beforeToolCall(toolCall);
      const registration = this.tools.get(toolCall.toolName);
      if (!registration) {
        throw new Error(`Unknown tool: ${toolCall.toolName}`);
      }

      toolCall.result = await registration.handler(
        toolCall.args || {},
        toolCall.toolName
      );
      this.validateOutputSchema(toolCall);
      this.afterToolCall(toolCall);
    } catch (error) {
      this.logger.log(`Error executing tool: ${error}`, "error");
      toolCall.result = {
        content: `Error: ${(error as Error).message}`,
        isError: true,
        executedAt: new Date(),
      };
    }
  }

  protected beforeToolCall(toolCall: ToolCall): void {
    // Default implementation - can be overridden by subclasses
    this.logger.log(
      `Executing tool: ${toolCall.toolName} with args: ${JSON.stringify(toolCall.args)}`,
      "debug"
    );
  }

  protected afterToolCall(toolCall: ToolCall): void {
    // Default implementation - can be overridden by subclasses
    this.logger.log(
      `Completed tool: ${toolCall.toolName} with result: ${JSON.stringify(toolCall.result)}`,
      "debug"
    );
  }

  getToolList(): Tool[] {
    return Array.from(this.tools.values()).map(
      (registration) => registration.tool
    );
  }

  registerTool(
    tool: Tool,
    handler: (
      args: Record<string, unknown>,
      toolName: string
    ) => Promise<ToolResult>
  ): void {
    this.logger.log(
      `client name: [${this.clientName}], Tool name: [${tool.name}] has been registered.`,
      "info"
    );
    this.tools.set(tool.name, { tool, handler });
  }

  cleanUp(): void {}

  validateInputSchema(toolCall: ToolCall): void {
    const registration = this.tools.get(toolCall.toolName);
    if (!registration) {
      throw Error("The tool input you are trying to validate doesn't exist");
    }

    const validate = this.ajv.compile(registration.tool.inputSchema);
    if (!validate(toolCall.args)) {
      throw new Error(
        `Invalid arguments for tool '${toolCall.toolName}' with error: [${validate.errors}]`
      );
    }
  }

  validateOutputSchema(toolCall: ToolCall): void {
    const registration = this.tools.get(toolCall.toolName);
    if (!registration) {
      this.logger.log("Can't find tool", "error");
      throw Error("The tool output you are trying to validate doesn't exist");
    }

    if (registration.tool.outputSchema) {
      const validate = this.ajv.compile(registration.tool.outputSchema);
      if (!validate(toolCall.result)) {
        this.logger.log("invalid tool output", "error");
        throw new Error(
          `Invalid output for tool '${toolCall.toolName}' with error: [${validate.errors}]`
        );
      }

      this.logger.log("Tool Call validated", "debug");
    }
  }
}
