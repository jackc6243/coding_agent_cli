import { Context } from "../context/context.js";
import { LLM } from "../llm/llm.js";
import { LLMProvider } from "../llm/types.js";
import { Node } from "./types.js";

export class BaseNode implements Node {
    nodeName: string;
    context: Context = new Context("");
    llm: LLM;

    children: Map<string, Node> = new Map();
    connections: Map<string, Node> = new Map();

    constructor(nodeName: string, provider: LLMProvider, modelName: string) {
        this.nodeName = nodeName;
        this.llm = new LLM(provider, modelName, "");
    }



}