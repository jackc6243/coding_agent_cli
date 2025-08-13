import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { ChatMessage } from "../types.js";
import { ToolClient } from "../tools/types.js";

export type CodeContext = object;

export type SpecContext = object;

export type Task = object;


export class Context {
    systemInstructions: string;
    messageHistory: ChatMessage[] = [];
    toolClients: Map<string, ToolClient>;
    clients: ToolClient[] = [];
    codeContext: CodeContext | null = null;
    specContext: SpecContext | null = null;
    taskList: Task[] | null = null;

    constructor(system: string) {
        this.systemInstructions = system;
        this.toolClients = new Map();
    }

    * getAllTools(): Generator<{ identifier: string, tool: Tool }, void, void> {
        for (const [clientName, client] of this.toolClients) {
            for (const tool of client.getToolList()) {
                yield { identifier: `${clientName}-${tool.name}`, tool };
            }
        }
    }

    getToolSize() {
        return Array.from(this.toolClients.values())
            .reduce((total, client) => total + client.tools.size, 0);
    }

    registerClient(getClientFunction: () => ToolClient) {
        const client = getClientFunction();
        this.toolClients.set(client.clientName, client);
    }

    addChatMessage(msg: ChatMessage) {
        this.messageHistory.push(msg);
    }

    cleanUp() {
        for (const [, client] of this.toolClients) {
            client.cleanUp();
        }
    }
};