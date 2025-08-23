import { AnthropicAdaptor } from "./adaptors/anthropicAdaptor.js";
import { GeminiAdaptor } from "./adaptors/geminiAdaptor.js";
import { OpenAIAdaptor } from "./adaptors/openAIAdaptor.js";
import { LLMAdaptorInterface, LLMProvider } from "./types.js";
import { ChatMessage } from "../types.js";
import { ConsoleLogger } from "../logging/ConsoleLogger.js";
import { ContextManager } from "../context/contextManager.js";

const logger = new ConsoleLogger("info");

export class LLM {
  llmAdaptor: LLMAdaptorInterface;
  context: ContextManager;

  constructor(provider: LLMProvider, model: string, context: ContextManager) {
    switch (provider) {
      case "openAI":
        this.llmAdaptor = new OpenAIAdaptor(model);
        break;
      case "anthropic":
        this.llmAdaptor = new AnthropicAdaptor(model);
        break;
      case "gemini":
        this.llmAdaptor = new GeminiAdaptor(model);
        break;
      default:
        throw new Error(`Unsupported LLM provider: ${provider}`);
    }
    this.context = context;
  }

  addMessage(msg: ChatMessage): void {
    this.context.addChatMessage(msg);
  }

  async sendMessage(): Promise<ChatMessage | undefined> {
    let msg = await this.llmAdaptor.sendMessage(this.context);
    if (msg) {
      this.context.addChatMessage(msg);
    } else {
      msg = new ChatMessage("assistant", "LLM failed to receive a message");
    }
    return msg;
  }

  async callTools(): Promise<void> {
    const msg = this.getLastMessage();
    if (!msg) {
      logger.log("No messages in history to process tool calls", "warn");
      return;
    }

    const toolCallsToExecute = msg.getPendingToolCalls();
    if (toolCallsToExecute.length === 0) {
      return;
    }

    const promises: Promise<void>[] = [];
    for (const call of toolCallsToExecute) {
      const client = this.context.toolClients.get(call.clientName);
      if (client) {
        promises.push(client.executeToolCall(call));
      } else {
        logger.log(
          `Tool client '${call.clientName}' not found for tool call '${call.toolName}'`,
          "error"
        );
      }
    }
    const results = await Promise.allSettled(promises);
    for (const r of results) {
      if (r.status === "rejected") {
        logger.log(`Tool call failed: ${r.reason}`, "error");
      }
    }
  }

  getLastMessage(): ChatMessage | undefined {
    if (this.context.messageHistory.length === 0) {
      return undefined;
    }
    return this.context.messageHistory[this.context.messageHistory.length - 1];
  }
}
