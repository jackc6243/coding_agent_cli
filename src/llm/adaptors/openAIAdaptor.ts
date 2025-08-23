import OpenAI from "openai";
import { ContextManager } from "../../context/ContextManager.js";
import { ConsoleLogger } from "../../logging/ConsoleLogger.js";
import { ToolCall } from "../../tools/types.js";
import { ChatMessage } from "../../types.js";
import { BaseLLMAdaptor } from "./BaseLLMAdaptor.js";

const logger = new ConsoleLogger("info");

export class OpenAIAdaptor extends BaseLLMAdaptor {
  private client: OpenAI;

  constructor(model: string) {
    super(model);
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  private async convertMessagesToOpenAIFormat(
    context: ContextManager
  ): Promise<OpenAI.Chat.Completions.ChatCompletionMessageParam[]> {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    // Add system message if present
    const systemInstructions = await this.getAllInitialContext(context);
    if (systemInstructions) {
      messages.push({
        role: "system",
        content: systemInstructions,
      });
    }

    // Convert message history
    for (const msg of context.messageHistory) {
      if (msg.hasText()) {
        messages.push({
          role: msg.role,
          content: msg.content!,
        });
      }

      if (msg.hasToolCalls()) {
        messages.push({
          role: "assistant" as const,
          content: msg.content || null,
          tool_calls: msg.toolCalls!.map((toolCall) => ({
            id: toolCall.id || "",
            type: "function" as const,
            function: {
              name: toolCall.getToolIdentifier(),
              arguments: JSON.stringify(toolCall.args || {}),
            },
          })),
        });

        // Add tool result messages for completed tool calls
        for (const toolCall of msg.toolCalls!) {
          if (toolCall.result) {
            messages.push({
              role: "tool",
              tool_call_id: toolCall.id || "",
              content:
                typeof toolCall.result.content === "string"
                  ? toolCall.result.content
                  : JSON.stringify(toolCall.result.content),
            });
          }
        }
      }
    }

    return messages;
  }

  async sendMessage(context: ContextManager): Promise<ChatMessage | undefined> {
    try {
      const messages = await this.convertMessagesToOpenAIFormat(context);

      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: messages,
        tools:
          context.getToolSize() > 0
            ? Array.from(context.getAllToolClients()).map(
                ({ identifier, tool }) => ({
                  type: "function" as const,
                  function: {
                    name: identifier,
                    description: tool.description || "",
                    parameters: tool.inputSchema,
                  },
                })
              )
            : undefined,
      });

      if (completion.choices[0]?.message) {
        const message = completion.choices[0].message;
        const toolCalls: ToolCall[] = message.tool_calls
          ? message.tool_calls.map((toolCall) => {
              if (toolCall.type === "function") {
                const { clientName, toolName } = ToolCall.splitIdentifer(
                  toolCall.function.name
                );
                return new ToolCall({
                  id: toolCall.id,
                  toolName: toolName || "unknown",
                  clientName: clientName || "unknown",
                  args: JSON.parse(toolCall.function.arguments || "{}"),
                });
              }
              return new ToolCall({
                id: toolCall.id,
                toolName: "unknown",
                clientName: "unknown",
                args: {},
              });
            })
          : [];
        return new ChatMessage("assistant", message.content ?? "", toolCalls);
      }

      return undefined;
    } catch (error) {
      logger.logObject("OpenAI API error", error, "error");
      return undefined;
    }
  }
}
