import { ContextManager } from "../../context/ContextManager.js";
import { ContextTree } from "../../context/ContextTree.js";

export interface IRetrievalService {
  retrieveContextTree(
    query: string,
    context: ContextManager
  ): Promise<ContextTree>;

  initiate(id?: number): Promise<void>;
}
