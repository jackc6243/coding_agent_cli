import { Anthropic } from "@anthropic-ai/sdk";
import { ContextManager } from "../../context/ContextManager.js";
import { ConsoleLogger } from "../../logging/ConsoleLogger.js";
import { ChatMessage } from "../../types.js";
import { ToolCall } from "../../tools/types.js";
import { BaseLLMAdaptor } from "./BaseLLMAdaptor.js";
import { ToolManager } from "../../tools/ToolManager.js";

const logger = new ConsoleLogger("info");
export class AnthropicAdaptor extends BaseLLMAdaptor {
  private client: Anthropic;

  constructor(model: string) {
    super(model);
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  private convertMessagesToAnthropicFormat(
    context: ContextManager
  ): Anthropic.Messages.MessageParam[] {
    const messages: Anthropic.Messages.MessageParam[] = [];

    // Convert message history (excluding system messages as they're handled separately)
    for (const msg of context.messageHistory) {
      if (msg.role !== "system") {
        const content: Anthropic.ContentBlockParam[] = [];

        // Add text content
        if (msg.hasText()) {
          content.push({
            type: "text",
            text: msg.content!,
          });
        }

        // Handle tool calls based on message role
        if (msg.hasToolCalls()) {
          if (msg.role === "assistant") {
            // For assistant messages, add tool_use blocks
            for (const toolCall of msg.toolCalls!) {
              content.push({
                type: "tool_use",
                id: toolCall.id || "",
                name: toolCall.getToolIdentifier(),
                input: toolCall.args || {},
              });
            }
          } else if (msg.role === "user") {
            // For user messages, add tool_result blocks if they exist
            for (const toolCall of msg.toolCalls!) {
              if (toolCall.result) {
                content.push({
                  type: "tool_result",
                  tool_use_id: toolCall.id || "",
                  content:
                    typeof toolCall.result.content === "string"
                      ? toolCall.result.content
                      : JSON.stringify(toolCall.result.content),
                  is_error: toolCall.result.isError || false,
                });
              }
            }
          }
        }

        if (content.length > 0) {
          messages.push({
            role: msg.role,
            content: content,
          });
        }

        // For assistant messages with completed tool calls, create a separate user message with tool results
        if (msg.role === "assistant" && msg.hasToolCalls()) {
          const toolResults: Anthropic.ContentBlockParam[] = [];
          const incompleteToolCalls: string[] = [];
          
          for (const toolCall of msg.toolCalls!) {
            if (toolCall.result) {
              toolResults.push({
                type: "tool_result",
                tool_use_id: toolCall.id || "",
                content:
                  typeof toolCall.result.content === "string"
                    ? toolCall.result.content
                    : JSON.stringify(toolCall.result.content),
                is_error: toolCall.result.isError || false,
              });
            } else {
              incompleteToolCalls.push(toolCall.id || "");
            }
          }

          // Only add tool results if we have results for ALL tool calls in this message
          if (toolResults.length > 0 && incompleteToolCalls.length === 0) {
            messages.push({
              role: "user",
              content: toolResults,
            });
          } else if (incompleteToolCalls.length > 0) {
            // Log warning about incomplete tool calls
            console.warn(`Assistant message has tool_use blocks without corresponding tool_result blocks: ${incompleteToolCalls.join(", ")}`);
          }
        }
      }
    }

    return messages;
  }

  private convertToolsToAnthropicFormat(
    context: ContextManager,
    toolManager: ToolManager
  ): Anthropic.Tool[] {
    const tools: Anthropic.Tool[] = [];
    for (const { identifier, tool } of toolManager.getAllToolClients()) {
      tools.push({
        name: identifier,
        description: tool.description || "",
        input_schema: {
          ...tool.inputSchema,
          type: "object",
          properties: tool.inputSchema.properties || {},
          required: tool.inputSchema.required || [],
        },
      });
    }
    return tools;
  }

  private validateMessageStructure(messages: Anthropic.Messages.MessageParam[]): void {
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.role === "assistant" && Array.isArray(msg.content)) {
        const toolUseBlocks = msg.content.filter(block => block.type === "tool_use");
        if (toolUseBlocks.length > 0) {
          // Check if the next message contains tool_result blocks
          const nextMsg = i + 1 < messages.length ? messages[i + 1] : null;
          if (!nextMsg || nextMsg.role !== "user") {
            throw new Error(`Assistant message at index ${i} contains tool_use blocks but is not followed by a user message with tool_result blocks`);
          }
          
          if (Array.isArray(nextMsg.content)) {
            const toolResultBlocks = nextMsg.content.filter(block => block.type === "tool_result");
            if (toolResultBlocks.length !== toolUseBlocks.length) {
              throw new Error(`Assistant message at index ${i} has ${toolUseBlocks.length} tool_use blocks but following user message has ${toolResultBlocks.length} tool_result blocks`);
            }
          }
        }
      }
    }
  }

  async sendMessage(context: ContextManager, toolManager: ToolManager): Promise<ChatMessage | undefined> {
    try {
      const messages = this.convertMessagesToAnthropicFormat(context);
      const tools =
        toolManager.getToolSize() > 0
          ? this.convertToolsToAnthropicFormat(context, toolManager)
          : undefined;
      const systemInstructions = await this.getAllInitialContext(context);

      // Validate message structure before sending to API
      this.validateMessageStructure(messages);

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: systemInstructions || undefined,
        messages: messages,
        tools: tools,
      });

      const toolCalls: ToolCall[] = [];
      let textContent = "";

      // Process all content blocks
      for (const content of response.content) {
        if (content.type === "text") {
          textContent += content.text;
        } else if (content.type === "tool_use") {
          const { clientName, toolName } = ToolCall.splitIdentifer(
            content.name
          );
          toolCalls.push(
            new ToolCall({
              id: content.id,
              toolName: toolName,
              clientName: clientName,
              args: content.input as Record<string, unknown>,
            })
          );
        }
      }

      return new ChatMessage("assistant", textContent, toolCalls);
    } catch (error) {
      logger.logObject("Anthropic API error", error, "error");
      return undefined;
    }
  }
}
