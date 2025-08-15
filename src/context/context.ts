import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { ChatMessage } from "../types.js";
import { ToolClient } from "../tools/types.js";
import { CodeContextManager, CodeRetrievalOptions } from "./contextManager.js";

export interface CodeContext {
    relevantChunks: RelevantCodeChunk[];
    query: string;
    totalChunks: number;
    retrievalTime: number;
}

export interface RelevantCodeChunk {
    filePath: string;
    content: string;
    type: 'function' | 'class' | 'interface' | 'variable' | 'comment' | 'text';
    startLine: number;
    endLine: number;
    score: number;
    metadata: {
        name?: string;
        signature?: string;
        description?: string;
    };
}

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
    private codeContextManager: CodeContextManager;

    constructor(system: string, openaiApiKey?: string) {
        this.systemInstructions = system;
        this.toolClients = new Map();
        this.codeContextManager = new CodeContextManager(openaiApiKey);
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

    /**
     * Retrieve relevant code context based on a prompt and optional folder path
     */
    async retrieveRelevantCode(
        prompt: string,
        options: CodeRetrievalOptions = {}
    ): Promise<void> {
        this.codeContext = await this.codeContextManager.retrieveRelevantCode(prompt, options);
    }

    /**
     * Get formatted code context as a string for LLM consumption
     */
    async getFormattedCodeContext(
        prompt: string,
        options: CodeRetrievalOptions = {}
    ): Promise<string> {
        return await this.codeContextManager.getFormattedCodeContext(prompt, options);
    }

    /**
     * Check if code context is indexed and ready
     */
    async isCodeContextIndexed(): Promise<boolean> {
        return await this.codeContextManager.isIndexed();
    }

    /**
     * Get code context manager statistics
     */
    async getCodeContextStats(): Promise<{
        isInitialized: boolean;
        isIndexed: boolean;
        lastIndexedPath: string | null;
        totalChunks: number;
    }> {
        return await this.codeContextManager.getStats();
    }

    /**
     * Clear the code context index
     */
    async clearCodeContextIndex(): Promise<void> {
        await this.codeContextManager.clearIndex();
        this.codeContext = null;
    }

    /**
     * Get the system prompt with code context if available
     */
    getSystemInstructionsWithContext(): string {
        if (!this.codeContext) {
            return this.systemInstructions;
        }

        const contextString = this.codeContextManager.formatCodeContext(this.codeContext);
        return `${this.systemInstructions}\n\n${contextString}`;
    }

    cleanUp() {
        for (const [, client] of this.toolClients) {
            client.cleanUp();
        }
        // Clean up RAG resources
        this.codeContextManager.dispose().catch(console.error);
    }
};