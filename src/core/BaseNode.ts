import { ContextManager } from "../context/contextManager.js";
import { LLM } from "../llm/llm.js";
import { LLMProvider } from "../llm/types.js";
import { Node } from "./types.js";

export class BaseNode implements Node {
    nodeName: string;
    context: ContextManager;
    llm: LLM;

    children: Map<string, Node> = new Map();
    connections: Map<string, Node> = new Map();

    constructor(nodeName: string, provider: LLMProvider, modelName: string, context: ContextManager) {
        this.nodeName = nodeName;
        this.context = context;
        this.llm = new LLM(provider, modelName, context);
    }



}