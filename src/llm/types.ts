import { Context } from '../context/context.js';
import { ChatMessage } from '../types.js';

export type LLMProvider = "openAI" | "anthropic" | "gemini";

export interface LLMAdaptorInterface {
    model: string;
    sendMessage(context: Context): Promise<ChatMessage | undefined>;
};
