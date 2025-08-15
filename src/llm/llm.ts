import { Context } from "../context/context.js";
import { AnthropicAdaptor } from "./anthropicAdaptor.js";
import { GeminiAdaptor } from "./geminiAdaptor.js";
import { OpenAIAdaptor } from "./openAIAdaptor.js";
import { LLMAdaptorInterface, LLMProvider } from "./types.js";
import { ChatMessage } from '../types.js';
import { ConsoleLogger } from '../logging/ConsoleLogger.js';
import { CODE_CONTEXT_KEYWORDS } from '../config/SystemPrompts.js';

const logger = new ConsoleLogger('info');

export class LLM {
    llmAdaptor: LLMAdaptorInterface;
    context: Context;

    constructor(provider: LLMProvider, model: string, systemPrompt: string, context?: Context) {
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
        if (context) {
            this.context = context;
        } else {
            this.context = new Context(systemPrompt);
        }
    }

    addMessage(msg: ChatMessage): void {
        this.context.addChatMessage(msg);
    }

    async sendMessage(): Promise<ChatMessage | undefined> {
        // Automatically retrieve relevant code context based on the latest user message
        await this.retrieveRelevantCodeContext();
        
        let msg = await this.llmAdaptor.sendMessage(this.context);
        if (msg) {
            this.context.addChatMessage(msg);
        } else {
            msg = new ChatMessage("assistant", "LLM failed to receive a message");
        }
        return msg;
    }

    private async retrieveRelevantCodeContext(): Promise<void> {
        const lastMessage = this.getLastMessage();
        if (!lastMessage || lastMessage.role !== 'user' || !lastMessage.content) {
            return;
        }

        try {
            // Only retrieve code context if the message seems to be about code
            const codeRelatedKeywords = [
                'function', 'class', 'method', 'variable', 'implement', 'code', 'bug', 'error',
                'debug', 'refactor', 'file', 'module', 'import', 'export', 'component',
                'test', 'spec', 'interface', 'type', 'enum', 'const', 'let', 'var',
                'async', 'await', 'promise', 'callback', 'event', 'handler', 'listener',
                ...CODE_CONTEXT_KEYWORDS
            ];
            
            const messageText = lastMessage.content.toLowerCase();
            const isCodeRelated = codeRelatedKeywords.some(keyword => 
                messageText.includes(keyword)
            );

            if (isCodeRelated) {
                logger.log('Retrieving relevant code context...', 'debug');
                await this.context.retrieveRelevantCode(lastMessage.content, {
                    topK: 5,
                    minScore: 0.15
                });
            }
        } catch (error) {
            logger.log(`Failed to retrieve code context: ${error}`, 'warn');
        }
    }

    async callTools(): Promise<void> {
        const msg = this.getLastMessage();
        if (!msg) {
            logger.log('No messages in history to process tool calls', 'warn');
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
                logger.log(`Tool client '${call.clientName}' not found for tool call '${call.toolName}'`, 'error');
            }
        }
        const results = await Promise.allSettled(promises);
        for (const r of results) {
            if (r.status === 'rejected') {
                logger.log(`Tool call failed: ${r.reason}`, 'error');
            }
        }
    }

    getLastMessage(): ChatMessage | undefined {
        if (this.context.messageHistory.length === 0) {
            return undefined;
        }
        return this.context.messageHistory[this.context.messageHistory.length - 1];
    }
};