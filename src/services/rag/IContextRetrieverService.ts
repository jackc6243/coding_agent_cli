import { ContextManager } from "../../context/ContextManager.js";
import { ContextTree } from "../../context/ContextTree.js";

export interface IContextRetrieverService {
  retrieveContextTree(
    query: string,
    ctxTree: ContextManager
  ): Promise<ContextTree>;
  retrieveContextFilepaths(
    query: string,
    ctxTree: ContextManager
  ): Promise<string[]>;
}
