import { ContextManager } from "../../context/contextManager.js";
import { ContextTree, DirNode } from "../../context/ContextTree.js";
import { IContextRetrieverService } from "./IContextRetrieverService.js";
import { Node } from "../../context/types.js";

export class DefaultCtxRetriever implements IContextRetrieverService {
  async retrieveContextTree(
    query: string,
    context: ContextManager
  ): Promise<ContextTree> {
    const relevantFilepaths = await this.retrieveContextFilepaths(
      query,
      context
    );

    // Get the current context tree from the context
    const fullContextTree = context.retrieveContextTree();

    // Create a new context tree with only relevant files
    const filteredContextTree = new ContextTree(
      fullContextTree.fileMemoryStore,
      context.filePermissions
    );

    // Filter the tree to only include relevant file paths
    this.filterContextTreeByPaths(filteredContextTree, relevantFilepaths);

    return filteredContextTree;
  }

  private filterContextTreeByPaths(
    contextTree: ContextTree,
    relevantPaths: string[]
  ): void {
    // Create a set for fast lookup
    const pathSet = new Set(relevantPaths);

    // Traverse and remove nodes that are not in the relevant paths
    this.pruneUnrelevantNodes(contextTree.rootNode, pathSet);
  }

  private pruneUnrelevantNodes(
    node: Node,
    relevantPaths: Set<string>
  ): boolean {
    if (node instanceof DirNode) {
      const childrenToRemove: string[] = [];
      let hasRelevantChildren = false;

      for (const [childName, child] of node.children) {
        if (this.pruneUnrelevantNodes(child, relevantPaths)) {
          hasRelevantChildren = true;
        } else {
          childrenToRemove.push(childName);
        }
      }

      // Remove children that don't have relevant content
      for (const childName of childrenToRemove) {
        node.removeChild(childName);
      }

      return hasRelevantChildren;
    } else {
      // For files, check if the path is in relevant paths
      return relevantPaths.has(node.fullPath);
    }
  }

  async retrieveContextFilepaths(
    query: string,
    context: ContextManager
  ): Promise<string[]> {
    const embedding =
      await context.embeddingService.embedRaw(query);
    const results = await context.vectorStore.query(
      embedding,
      10,
      context.contextId
    );
    const relevantFilePaths: Set<string> = new Set();
    const permissionMask = context.filePermissions;

    results.forEach((res) => {
      if (permissionMask.checkIfReadOrWriteAllowed(res.chunk.filePath)) {
        relevantFilePaths.add(res.chunk.filePath);
      }
    });
    return Array.from(relevantFilePaths);
  }
}
