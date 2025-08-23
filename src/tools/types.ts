import { Tool } from "@modelcontextprotocol/sdk/types.js";

export class ToolCall {
  id?: string;
  toolName: string;
  clientName: string;
  args?: Record<string, unknown>;
  result?: ToolResult;

  constructor(obj: {
    id?: string;
    toolName: string;
    clientName: string;
    args?: Record<string, unknown>;
    result?: ToolResult;
  }) {
    this.id = obj.id;
    this.toolName = obj.toolName;
    this.clientName = obj.clientName;
    this.args = obj.args;
    this.result = obj.result;
  }

  getToolIdentifier(): string {
    return `${this.clientName}-${this.toolName}`;
  }

  static splitIdentifer(identifier: string): {
    clientName: string;
    toolName: string;
  } {
    const l = identifier.split("-", 2);
    return { clientName: l[0], toolName: l[1] };
  }
}

export interface ToolResult {
  content: unknown;
  isError: boolean;
  executedAt: Date;
}

export interface ToolClient {
  clientName: string;
  tools: Map<
    string,
    {
      tool: Tool;
      handler: (
        args: Record<string, unknown>,
        toolName: string
      ) => Promise<ToolResult>;
    }
  >;
  getToolList(): Tool[];
  executeToolCall(toolCall: ToolCall): Promise<void>;
  registerTool(
    tool: Tool,
    handler: (
      args: Record<string, unknown>,
      toolName: string
    ) => Promise<ToolResult>
  ): void;
  cleanUp(): void;
}
