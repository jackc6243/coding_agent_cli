import { z } from "zod";

export type Role = 'system' | 'user' | 'assistant';

// Base interface for tool calls with embedded results
export interface ToolCall<TResult = any> {
  id?: string;
  name: string;
  args?: Record<string, any>;
  result?: ToolResult<TResult>;
}

// Tool result interface with generic return type
export interface ToolResult<TResult = any> {
  content: TResult;
  isError?: boolean;
  executedAt?: Date;
}

// Registry for tool schemas and their expected return types
export interface ToolSchema {
  name: string;
  inputSchema: z.ZodSchema;
  resultSchema?: z.ZodSchema;
}

// Factory interface for creating typed tool calls
export interface ToolCallFactory {
  createToolCall<TResult = any>(
    name: string,
    args?: Record<string, any>,
    id?: string
  ): ToolCall<TResult>;

  executeToolCall<TResult = any>(
    toolCall: ToolCall<TResult>,
    executor: (name: string, args: Record<string, any>) => Promise<any>
  ): void;

  validateOutputSchema<TResult = any>(toolName: string, result: any): TResult;
  validateInputSchema(toolName: string, args: Record<string, any>): Record<string, any>;
  registerToolSchema(toolName: string, inputSchema: z.ZodSchema, resultSchema?: z.ZodSchema): void;
  getExpectedResultType(toolName: string): any;
  getExpectedInputType(toolName: string): any;
}

export class ChatMessage {
  role: Role;
  content?: string;
  toolCalls: ToolCall[];

  constructor(
    role: Role,
    content?: string,
    toolCalls: ToolCall[] = []
  ) {
    this.role = role;
    this.content = content;
    this.toolCalls = toolCalls;
  }

  // Helper methods
  hasText(): boolean {
    return this.content !== undefined && this.content.length > 0;
  }

  hasToolCalls(): boolean {
    return this.toolCalls.length > 0;
  }

  hasToolResults(): boolean {
    return this.toolCalls.some(call => call.result !== undefined);
  }

  // Get tool calls that have results
  getCompletedToolCalls(): ToolCall[] {
    return this.toolCalls.filter(call => call.result !== undefined);
  }

  // Get tool calls that don't have results yet
  getPendingToolCalls(): ToolCall[] {
    return this.toolCalls.filter(call => call.result === undefined);
  }
}
