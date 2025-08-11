import { z } from "zod";
import { ToolCall, ToolCallFactory, ToolSchema } from "../types.js";

export abstract class BaseToolCallFactory implements ToolCallFactory {
    private toolSchemas: Map<string, ToolSchema> = new Map();

    constructor() {
    }

    /**
     * Validates input arguments against the registered input schema for a tool
     * @param toolName - The name of the tool
     * @param args - The arguments to validate
     * @returns The validated arguments
     * @throws Error if validation fails
     */
    validateInputSchema(toolName: string, args: Record<string, any>): Record<string, any> {
        const schema = this.toolSchemas.get(toolName);
        if (!schema || !schema.inputSchema) {
            throw Error("The tool input you are trying to valid doesn't exist")
        }

        try {
            return schema.inputSchema.parse(args);
        } catch (error) {
            if (error instanceof z.ZodError) {
                throw new Error(
                    `Invalid arguments for tool '${toolName}': ${error.errors
                        .map(e => `${e.path.join('.')}: ${e.message}`)
                        .join(', ')}`
                );
            }
            throw error;
        }
    }

    /**
     * Validates output result against the registered output schema for a tool
     * @param toolName - The name of the tool
     * @param result - The result to validate
     * @returns The validated result
     * @throws Error if validation fails
     */
    validateOutputSchema<TResult = any>(toolName: string, result: any): TResult {
        const schema = this.toolSchemas.get(toolName);
        if (!schema || !schema.resultSchema) {
            throw Error("The tool output you are trying to valid doesn't exist")
        }

        try {
            return schema.resultSchema.parse(result) as TResult;
        } catch (error) {
            if (error instanceof z.ZodError) {
                throw new Error(
                    `Invalid result for tool '${toolName}': ${error.errors
                        .map(e => `${e.path.join('.')}: ${e.message}`)
                        .join(', ')}`
                );
            }
            throw error;
        }
    }

    createToolCall<TResult = any>(
        name: string,
        args?: Record<string, any>,
        id?: string
    ): ToolCall<TResult> {
        const validatedArgs = args ? this.validateInputSchema(name, args) : undefined;

        return {
            id: id || crypto.randomUUID(),
            name,
            args: validatedArgs,
        };
    }

    abstract executeToolCall<TResult = any>(
        toolCall: ToolCall<TResult>,
    ): Promise<void>;

    registerToolSchema(toolName: string, inputSchema: z.ZodSchema, resultSchema?: z.ZodSchema): void {
        this.toolSchemas.set(toolName, {
            name: toolName,
            inputSchema,
            resultSchema,
        });
    }

    getExpectedResultType(toolName: string): z.ZodSchema | undefined {
        return this.toolSchemas.get(toolName)?.resultSchema;
    }

    getExpectedInputType(toolName: string): z.ZodSchema | undefined {
        return this.toolSchemas.get(toolName)?.inputSchema;
    }
}
