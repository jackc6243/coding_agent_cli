import { ContextManager } from "../../context/ContextManager.js";
import { ChatMessage } from "../../types.js";

export type LLMProvider = "openAI" | "anthropic" | "gemini";

export abstract class BaseLLMAdaptor {
  model: string;
  constructor(model: string) {
    this.model = model;
  }

  async getAllInitialContext(contextManager: ContextManager): Promise<string> {
    return `${this.getSystemContext(contextManager)}\n
      ${this.getToolsContext(contextManager)}\n
      ${this.getCodeContext(contextManager)}`;
  }

  async getCodeContext(contextManager: ContextManager): Promise<string> {
    return await contextManager.initialContextTree.getTreeString(
      true, // includeContent
      Infinity, // maxDepth
      true // excludeOldContent
    );
  }

  async getSystemContext(contextManager: ContextManager): Promise<string> {
    return contextManager.systemInstructions;
  }

  async getToolsContext(contextManager: ContextManager): Promise<string> {
    if (contextManager.toolClients.size === 0) {
      return "";
    }
    let description = "";

    for (const [clientName, toolClient] of contextManager.toolClients) {
      description += `${clientName}\n`;
      for (const [, registration] of toolClient.tools) {
        const tool = registration.tool;
        description += `• ${tool.name}\n`;

        if (tool.description) {
          description += `  Description: ${tool.description}\n`;
        }

        if (tool.inputSchema) {
          description += `  Input Schema:\n`;
          if (tool.inputSchema.properties) {
            for (const [propName, propDef] of Object.entries(
              tool.inputSchema.properties
            )) {
              const propDefObj = propDef as Record<string, unknown>;
              description += `    - ${propName}`;
              if (typeof propDefObj.type === "string") {
                description += ` (${propDefObj.type})`;
              }
              if (typeof propDefObj.description === "string") {
                description += `: ${propDefObj.description}`;
              }
              description += `\n`;
            }
          }
          if (
            tool.inputSchema.required &&
            Array.isArray(tool.inputSchema.required)
          ) {
            description += `    Required: ${tool.inputSchema.required.join(", ")}\n`;
          }
        }

        if ("outputSchema" in tool && tool.outputSchema) {
          description += `  Output Schema: ${JSON.stringify(tool.outputSchema, null, 2)}\n`;
        }

        description += `\n`;
      }
    }
    return description.trim();
  }

  abstract sendMessage(
    context: ContextManager
  ): Promise<ChatMessage | undefined>;
}
