import { Context } from "../context/context.js";
import { LLMAdaptorInterface } from "./types.js";
import { ChatMessage } from "../types.js";
import { GoogleGenerativeAI, Content, Part, SchemaType, Schema } from '@google/generative-ai';
import { ToolCall } from "../tools/types.js";
import { ConsoleLogger } from "../logging/ConsoleLogger.js";

const logger = new ConsoleLogger('info');

export class GeminiAdaptor implements LLMAdaptorInterface {
    model: string;
    private client: GoogleGenerativeAI;

    constructor(model: string) {
        this.model = model;
        this.client = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');
    }

    private convertMessagesToGeminiFormat(context: Context): Content[] {
        const contents: Content[] = [];

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
                            name: toolCall.getToolIdentifier(),
                            args: toolCall.args || {},
                        }
                    });

                    // Add function response if present
                    if (toolCall.result) {
                        parts.push({
                            functionResponse: {
                                name: toolCall.getToolIdentifier(),
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
        if (context.getToolSize() === 0) return undefined;

        const tools = [];
        for (const { identifier, tool } of context.getAllTools()) {
            tools.push({
                name: identifier,
                description: tool.description || '',
                parameters: {
                    type: SchemaType.OBJECT,
                    properties: tool.inputSchema.properties as Record<string, Schema> || {},
                    required: tool.inputSchema.required || [],
                },
            });
        }
        return tools;
    }

    async sendMessage(context: Context): Promise<ChatMessage | undefined> {
        try {
            const tools = this.convertToolsToGeminiFormat(context);
            const model = this.client.getGenerativeModel({
                model: this.model,
                tools: tools ? [{ functionDeclarations: tools }] : undefined,
                systemInstruction: context.getSystemInstructionsWithContext() || undefined,
            });

            const contents = this.convertMessagesToGeminiFormat(context);

            const result = await model.generateContent({
                contents: contents,
            });

            const response = result.response;
            const text = response.text();

            const functionCalls = response.functionCalls();
            const toolCalls: ToolCall[] = functionCalls ? functionCalls.map(functionCall => {
                const { clientName, toolName } = ToolCall.splitIdentifer(functionCall.name);
                return new ToolCall({
                    toolName: toolName,
                    clientName: clientName,
                    args: functionCall.args as Record<string, unknown>,
                });
            }) : [];

            return new ChatMessage('assistant', text, toolCalls);

        } catch (error) {
            logger.logObject('Gemini API error', error, 'error');
        }
    }
}
