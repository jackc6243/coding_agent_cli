import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { ChatMessage } from "../types.js";

export interface CodeContext {

};

export interface SpecContext {

};

export interface Task {

};


export class Context {
    systemInstructions: string;
    messageHistory: ChatMessage[] = [];
    tools: Tool[] = [];
    codeContext: CodeContext | null = null;
    specContext: SpecContext | null = null;
    taskList: Task[] | null = null;

    constructor(system: string) {
        this.systemInstructions = system;
    }

    registerTool(tool: Tool) {
        this.tools.push(tool);
    }

    addChatMessage(msg: ChatMessage) {
        this.messageHistory.push(msg);
    }
};