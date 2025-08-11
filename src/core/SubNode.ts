import { Context } from "../context/context.js";
import { LLM } from "../llm/llm.js";
import { LLMProvider } from "../llm/types.js";
import { Node } from "./types.js";

export class SubNode implements Node {
    nodeName: string;
    context: Context = new Context("");
    llm: LLM;
    children: Map<string, Node> = new Map();
    connections: Map<string, Node> = new Map();

    parent: Node;
    maxLookback: number;

    constructor(nodeName: string, provider: LLMProvider, modelName: string, parent: Node, maxLookback: number = 2) {
        this.nodeName = nodeName;
        this.llm = new LLM(provider, modelName, "");
        this.parent = parent;
        this.maxLookback = maxLookback;
    }
}