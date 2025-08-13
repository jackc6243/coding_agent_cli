import { ToolCall } from "./tools/types.js";

export type Role = 'system' | 'user' | 'assistant';

export class ChatMessage {
  role: Role;
  content: string;
  toolCalls: ToolCall[];

  constructor(
    role: Role,
    content: string = "",
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
