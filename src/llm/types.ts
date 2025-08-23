import { ContextManager } from '../context/contextManager.js';
import { ChatMessage } from '../types.js';

export type LLMProvider = "openAI" | "anthropic" | "gemini";

export interface LLMAdaptorInterface {
    model: string;
    sendMessage(context: ContextManager): Promise<ChatMessage | undefined>;
};
