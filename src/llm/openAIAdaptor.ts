import { Context } from "../context/context.js";
import { LLMAdaptorInterface } from "./types.js";
import { ChatMessage, ToolCall } from "../types.js";
import OpenAI from 'openai';

export class OpenAIAdaptor implements LLMAdaptorInterface {
    model: string;
    private client: OpenAI;

    constructor(model: string) {
        this.model = model;
        this.client = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }

    private convertMessagesToOpenAIFormat(context: Context): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
        const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

        // Add system message if present
        if (context.systemInstructions) {
            messages.push({
                role: 'system',
                content: context.systemInstructions,
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
                    role: 'assistant' as const,
                    content: msg.content || null,
                    tool_calls: msg.toolCalls.map(toolCall => ({
                        id: toolCall.id || '',
                        type: 'function' as const,
                        function: {
                            name: toolCall.name,
                            arguments: JSON.stringify(toolCall.args || {}),
                        }
                    }))
                });

                // Add tool result messages for completed tool calls
                for (const toolCall of msg.toolCalls) {
                    if (toolCall.result) {
                        messages.push({
                            role: 'tool',
                            tool_call_id: toolCall.id || '',
                            content: typeof toolCall.result.content === 'string'
                                ? toolCall.result.content
                                : JSON.stringify(toolCall.result.content),
                        });
                    }
                }
            }
        }

        return messages;
    }

    async sendMessage(context: Context): Promise<ChatMessage | undefined> {
        try {
            const messages = this.convertMessagesToOpenAIFormat(context);

            const completion = await this.client.chat.completions.create({
                model: this.model,
                messages: messages,
                tools: context.tools.length > 0 ? context.tools.map(tool => ({
                    type: 'function' as const,
                    function: {
                        name: tool.name,
                        description: tool.description,
                        parameters: tool.inputSchema,
                    }
                })) : undefined,
            });

            if (completion.choices[0]?.message) {
                const message = completion.choices[0].message;
                const toolCalls: ToolCall[] = message.tool_calls ? message.tool_calls.map(toolCall => {
                    if (toolCall.type === 'function') {
                        return {
                            id: toolCall.id,
                            name: toolCall.function.name,
                            args: JSON.parse(toolCall.function.arguments || '{}'),
                        };
                    }
                    return {
                        id: toolCall.id,
                        name: 'unknown',
                        args: {},
                    };
                }) : [];
                return new ChatMessage('assistant', message.content ?? "", toolCalls);
            }

            return undefined;
        } catch (error) {
            console.error('OpenAI API error:', error);
            return undefined;
        }
    }
}