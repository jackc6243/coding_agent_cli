import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { ToolClient } from "./types.js";

export class ToolManager {
  private toolClients: Map<string, ToolClient>;

  constructor() {
    this.toolClients = new Map();
  }

  *getAllToolClients(): Generator<
    { identifier: string; tool: Tool },
    void,
    void
  > {
    for (const [clientName, client] of this.toolClients) {
      for (const tool of client.getToolList()) {
        yield { identifier: `${clientName}-${tool.name}`, tool };
      }
    }
  }

  getToolSize() {
    return Array.from(this.toolClients.values()).reduce(
      (total, client) => total + client.tools.size,
      0
    );
  }

  registerToolClients<T>(
    getClientFunction: (contextManager: T) => ToolClient,
    contextManager: T
  ) {
    const client = getClientFunction(contextManager);
    this.toolClients.set(client.clientName, client);
  }

  getToolClients(): Map<string, ToolClient> {
    return this.toolClients;
  }

  async cleanup(): Promise<void> {
    for (const client of this.toolClients.values()) {
      client.cleanUp();
    }
    this.toolClients.clear();
  }
}