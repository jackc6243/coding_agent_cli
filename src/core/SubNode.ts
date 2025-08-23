import { ContextManager } from "../context/ContextManager.js";
import { LLM } from "../llm/llm.js";
import { LLMProvider } from "../llm/adaptors/BaseLLMAdaptor.js";
import { Node } from "./types.js";

export class SubNode implements Node {
  nodeName: string;
  context: ContextManager;
  llm: LLM;
  children: Map<string, Node> = new Map();
  connections: Map<string, Node> = new Map();

  parent: Node;
  maxLookback: number;

  constructor(
    nodeName: string,
    provider: LLMProvider,
    modelName: string,
    parent: Node,
    context: ContextManager,
    maxLookback: number = 2
  ) {
    this.nodeName = nodeName;
    this.context = context;
    this.llm = new LLM(provider, modelName, context);
    this.parent = parent;
    this.maxLookback = maxLookback;
  }
}
