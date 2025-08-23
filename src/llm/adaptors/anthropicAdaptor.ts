import { Anthropic } from "@anthropic-ai/sdk";
import { LLMAdaptorInterface } from "../types.js";
import { ContextManager } from "../../context/contextManager.js";
import { ConsoleLogger } from "../../logging/ConsoleLogger.js";
import { ChatMessage } from "../../types.js";
import { ToolCall } from "../../tools/types.js";

const logger = new ConsoleLogger("info");
export class AnthropicAdaptor implements LLMAdaptorInterface {
  model: string;
  private client: Anthropic;

  constructor(model: string) {
    this.model = model;
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
            }
          }

          if (toolResults.length > 0) {
            messages.push({
              role: "user",
              content: toolResults,
            });
          }
        }
      }
    }

    return messages;
  }

  private convertToolsToAnthropicFormat(context: ContextManager): Anthropic.Tool[] {
    const tools: Anthropic.Tool[] = [];
    for (const { identifier, tool } of context.getAllTools()) {
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

  async sendMessage(context: ContextManager): Promise<ChatMessage | undefined> {
    try {
      const messages = this.convertMessagesToAnthropicFormat(context);
      const tools =
        context.getToolSize() > 0
          ? this.convertToolsToAnthropicFormat(context)
          : undefined;
      const systemInstructions =
        await context.getSystemInstructionsWithContext();

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
