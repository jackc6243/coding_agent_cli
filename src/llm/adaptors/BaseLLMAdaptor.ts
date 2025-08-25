import { ContextManager } from "../../context/ContextManager.js";
import { ChatMessage } from "../../types.js";
import { ToolManager } from "../../tools/ToolManager.js";
import { ContextConverterLLM } from "../../context/ContextConverterLLM.js";

export type LLMProvider = "openAI" | "anthropic" | "gemini";

export abstract class BaseLLMAdaptor {
  model: string;
  private contextConverter: ContextConverterLLM;
  
  constructor(model: string) {
    this.model = model;
    this.contextConverter = new ContextConverterLLM();
  }

  async getAllInitialContext(contextManager: ContextManager): Promise<string> {
    return `${this.getSystemContext(contextManager)}\n
      ${this.getCodeContext(contextManager)}`;
  }

  async getCodeContext(contextManager: ContextManager): Promise<string> {
    return await this.contextConverter.getTreeString(
      contextManager.initialContextTree,
      true, // includeContent
      Infinity, // maxDepth
      true // excludeOldContent
    );
  }

  async getSystemContext(contextManager: ContextManager): Promise<string> {
    return contextManager.systemInstructions;
  }

  async getToolsContext(contextManager: ContextManager, toolManager: ToolManager): Promise<string> {
    const toolClients = toolManager.getToolClients();
    if (toolClients.size === 0) {
      return "";
    }
    let description = "";

    for (const [clientName, toolClient] of toolClients) {
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
    context: ContextManager,
    toolManager: ToolManager
  ): Promise<ChatMessage | undefined>;
}
