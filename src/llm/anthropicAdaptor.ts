import { Context } from "../context/context.js";
import { LLMAdaptorInterface } from "./types.js";
import { ChatMessage, ToolCall, ToolResult } from "../types.js";
import { Anthropic } from '@anthropic-ai/sdk';

export class AnthropicAdaptor implements LLMAdaptorInterface {
    model: string;
    private client: Anthropic;

    constructor(model: string) {
        this.model = model;
        this.client = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });
    }

    private convertMessagesToAnthropicFormat(context: Context): Anthropic.Messages.MessageParam[] {
        const messages: Anthropic.Messages.MessageParam[] = [];

        // Convert message history (excluding system messages as they're handled separately)
        for (const msg of context.messageHistory) {
            if (msg.role !== 'system') {
                const content: Anthropic.ContentBlockParam[] = [];

                // Add text content
                if (msg.hasText()) {
                    content.push({
                        type: 'text',
                        text: msg.content!,
                    });
                }

                // Add tool use content and tool results
                if (msg.hasToolCalls()) {
                    for (const toolCall of msg.toolCalls!) {
                        content.push({
                            type: 'tool_use',
                            id: toolCall.id || '',
                            name: toolCall.name,
                            input: toolCall.args || {},
                        });

                        // Add tool result if present
                        if (toolCall.result) {
                            content.push({
                                type: 'tool_result',
                                tool_use_id: toolCall.id || '',
                                content: toolCall.result.content,
                                is_error: toolCall.result.isError || false,
                            });
                        }
                    }
                }

                if (content.length > 0) {
                    messages.push({
                        role: msg.role,
                        content: content,
                    });
                }
            }
        }

        return messages;
    }

    private convertToolsToAnthropicFormat(context: Context): Anthropic.Tool[] {
        return context.tools.map(tool => ({
            name: tool.name,
            description: tool.description || '',
            input_schema: {
                ...tool.inputSchema,
                type: "object",
                properties: tool.inputSchema.properties || {},
                required: tool.inputSchema.required || [],
            },
        }));
    }

    async sendMessage(context: Context): Promise<ChatMessage | undefined> {
        try {
            const messages = this.convertMessagesToAnthropicFormat(context);
            const tools = context.tools.length > 0 ? this.convertToolsToAnthropicFormat(context) : undefined;

            const response = await this.client.messages.create({
                model: this.model,
                max_tokens: 4096,
                system: context.systemInstructions || undefined,
                messages: messages,
                tools: tools,
            });

            const toolCalls: ToolCall[] = [];
            let textContent = '';

            // Process all content blocks
            for (const content of response.content) {
                if (content.type === 'text') {
                    textContent += content.text;
                } else if (content.type === 'tool_use') {
                    toolCalls.push({
                        id: content.id,
                        name: content.name,
                        args: content.input as Record<string, any>,
                    });
                }
            }


            return new ChatMessage('assistant', textContent, toolCalls);
        } catch (error) {
            console.error('Anthropic API error:', error);
            return undefined;
        }
    }
}
