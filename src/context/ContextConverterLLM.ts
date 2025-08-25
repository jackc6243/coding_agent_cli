import { ContextManager } from "./ContextManager.js";
import { ContextConverter } from "./types.js";
import {
  ContextTree,
  ContextTreeNode,
  FileNode,
  DirNode,
} from "./ContextTree.js";
import { GlobalFileCache } from "../services/files/GlobalFileCache.js";

export class ContextConverterLLM implements ContextConverter<string> {
  async convert(context: ContextManager): Promise<string> {
    return this.getTreeString(
      context.currentContextTree,
      true, // includeContent
      Infinity, // maxDepth
      true // excludeOldContent
    );
  }

  async getTreeString(
    tree: ContextTree,
    includeContent: boolean,
    maxDepth: number = Infinity,
    excludeOldContent?: boolean
  ): Promise<string> {
    return this.getNodeString(
      tree.rootNode,
      tree,
      0,
      includeContent,
      maxDepth,
      excludeOldContent
    );
  }

  private async getNodeString(
    node: ContextTreeNode,
    tree: ContextTree,
    depth: number,
    includeContent: boolean,
    maxDepth: number,
    excludeOldContent: boolean = true
  ): Promise<string> {
    if (depth > maxDepth || !node.isEnabled) return "";

    const indent = "  ".repeat(depth);
    const type = node instanceof FileNode ? "[F]" : "[D]";
    let result = `${indent}${type} ${node.name}\n`;
    if (node instanceof FileNode && includeContent) {
      if (excludeOldContent) {
        const outdatedMessage = `${indent}  [Note: This file content is outdated. Please use the Read tool to access the current version.]\n`;
        try {
          if (node.isOutdated()) {
            result += outdatedMessage;
          } else {
            result += await GlobalFileCache.get(node.fullPath);
          }
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
          result += outdatedMessage;
        }
      } else {
        result += await GlobalFileCache.get(node.fullPath);
      }
    }

    if (node instanceof DirNode && depth < maxDepth) {
      for (const child of node.getAllChildren()) {
        result += await this.getNodeString(
          child,
          tree,
          depth + 1,
          includeContent,
          maxDepth,
          excludeOldContent
        );
      }
    }

    return result;
  }
}
