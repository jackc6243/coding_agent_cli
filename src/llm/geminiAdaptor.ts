import { Context } from "../context/context.js";
import { LLMAdaptorInterface } from "./types.js";
import { ChatMessage, ToolCall, ToolResult } from "../types.js";
import { GoogleGenerativeAI, Content, Part, SchemaType } from '@google/generative-ai';

export class GeminiAdaptor implements LLMAdaptorInterface {
    model: string;
    private client: GoogleGenerativeAI;

    constructor(model: string) {
        this.model = model;
        this.client = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');
    }

    private convertMessagesToGeminiFormat(context: Context): Content[] {
        const contents: Content[] = [];

        // Convert message history
        for (const msg of context.messageHistory) {
            // Skip system messages as they're handled differently in Gemini
            if (msg.role === 'system') continue;

            const parts: Part[] = [];

            // Add text content
            if (msg.hasText()) {
                parts.push({ text: msg.content! });
            }

            // Add function call parts and responses
            if (msg.hasToolCalls()) {
                for (const toolCall of msg.toolCalls!) {
                    parts.push({
                        functionCall: {
                            name: toolCall.name,
                            args: toolCall.args || {},
                        }
                    });

                    // Add function response if present
                    if (toolCall.result) {
                        parts.push({
                            functionResponse: {
                                name: toolCall.name,
                                response: {
                                    content: toolCall.result.content,
                                    error: toolCall.result.isError || false,
                                }
                            }
                        });
                    }
                }
            }

            if (parts.length > 0) {
                contents.push({
                    role: msg.role === 'assistant' ? 'model' : 'user',
                    parts: parts,
                });
            }
        }

        return contents;
    }

    private convertToolsToGeminiFormat(context: Context) {
        if (context.tools.length === 0) return undefined;

        return context.tools.map(tool => ({
            name: tool.name,
            description: tool.description || '',
            parameters: tool.inputSchema as any, // Type assertion to bypass strict typing
        }));
    }

    async sendMessage(context: Context): Promise<ChatMessage | undefined> {
        try {
            const tools = this.convertToolsToGeminiFormat(context);
            const model = this.client.getGenerativeModel({
                model: this.model,
                tools: tools ? [{ functionDeclarations: tools }] : undefined,
                systemInstruction: context.systemInstructions || undefined,
            });

            const contents = this.convertMessagesToGeminiFormat(context);

            const result = await model.generateContent({
                contents: contents,
            });

            const response = result.response;

            // Handle text response
            const text = response.text();

            // Handle function calls
            const functionCalls = response.functionCalls();
            let toolCalls: ToolCall[] = functionCalls ? functionCalls.map(functionCall => ({
                name: functionCall.name,
                args: functionCall.args as Record<string, any>,
            })) : [];

            return new ChatMessage('assistant', text, toolCalls);

        } catch (error) {
            console.error('Gemini API error:', error);
        }
    }
}
