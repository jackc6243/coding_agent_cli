import { Context } from "../context/context.js";
import { AnthropicAdaptor } from "./anthropicAdaptor.js";
import { GeminiAdaptor } from "./geminiAdaptor.js";
import { OpenAIAdaptor } from "./openAIAdaptor.js";
import { LLMAdaptorInterface, LLMProvider } from "./types.js";
import { ChatMessage } from '../types.js';

export class LLM {
    llmAdaptor: LLMAdaptorInterface;
    context: Context;

    constructor(provider: LLMProvider, model: string, systemPrompt: string) {
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
        this.context = new Context(systemPrompt);
    }

    addMessage(msg: ChatMessage) {
        this.context.addChatMessage(msg);
    }

    async sendMessage(): Promise<ChatMessage | undefined> {
        return this.llmAdaptor.sendMessage(this.context);
    }
};