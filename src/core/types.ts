import { ContextManager } from "../context/ContextManager.js";
import { LLM } from "../llm/llm.js";

export interface Node {
  nodeName: string;
  context: ContextManager;
  llm: LLM;
  children: Map<string, Node>;
  connections: Map<string, Node>;
}

export interface Edge {
  nodeFrom: Node;
  nodeTo: Node;
}
