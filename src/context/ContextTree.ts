import { Node } from "./types.js";
import { FilePermissions } from "./FilePermissions.js";
import * as fs from "fs";
import * as path from "path";
import { FileChunkMemoryStore } from "../chunking/FileChunkMemoryStore.js";

export class FileNode extends Node {
  constructor(fullPath: string, isEnabled: boolean = false) {
    super(fullPath, isEnabled);
  }

  isOutdated(): boolean {
    const stats = fs.statSync(this.fullPath);
    const fileModified = stats.mtime.getTime();
    return this.lastModified < fileModified;
  }
}

export class DirNode extends Node {
  children: Map<string, Node> = new Map();
  constructor(fullPath: string, isEnabled: boolean = false) {
    super(fullPath, isEnabled);
  }
  addChild(node: Node): void {
    this.children.set(node.name, node);
  }

  removeChild(name: string): boolean {
    return this.children.delete(name);
  }

  getChild(name: string): Node | undefined {
    return this.children.get(name);
  }

  hasChild(name: string): boolean {
    return this.children.has(name);
  }

  getChildrenNames(): string[] {
    return Array.from(this.children.keys());
  }

  getAllChildren(): Node[] {
    return Array.from(this.children.values());
  }

  isDirectory(): boolean {
    return true;
  }
}

export class ContextTree {
  rootNode: DirNode;
  fileMemoryStore: FileChunkMemoryStore;
  // add cache later

  constructor(
    fileMemoryStore: FileChunkMemoryStore,
    filePermissions: FilePermissions,
    initialFilePermissions?: FilePermissions
  ) {
    this.fileMemoryStore = fileMemoryStore;
    const rootPath = filePermissions.rootFolder;
    this.rootNode = new DirNode(rootPath);
    this.buildTree(
      rootPath,
      this.rootNode,
      filePermissions,
      initialFilePermissions ?? filePermissions
    );
    this.pruneEmptyNodes();
  }

  private buildTree(
    dirPath: string,
    parentNode: DirNode,
    filePermissions: FilePermissions,
    initialFilePermissions: FilePermissions
  ): void {
    try {
      if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
        return;
      }

      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (!filePermissions.checkIfReadOrWriteAllowed(fullPath)) {
          continue;
        }
        const isInitialLoad =
          initialFilePermissions.checkIfReadOrWriteAllowed(fullPath);
        if (entry.isDirectory()) {
          const dirNode = new DirNode(fullPath, isInitialLoad);
          parentNode.addChild(dirNode);
          this.buildTree(
            fullPath,
            dirNode,
            filePermissions,
            initialFilePermissions
          );
        } else if (entry.isFile()) {
          const fileNode = new FileNode(fullPath, isInitialLoad);
          parentNode.addChild(fileNode);
        }
      }
    } catch (error) {
      console.error(`Error building tree for directory ${dirPath}:`, error);
    }
  }

  private pruneEmptyNodes(): void {
    this.pruneNode(this.rootNode);
  }

  private pruneNode(node: DirNode): boolean {
    const childrenToRemove: string[] = [];
    let hasValidChildren = false;

    for (const [childName, child] of node.children) {
      if (child instanceof DirNode) {
        if (!this.pruneNode(child)) {
          childrenToRemove.push(childName);
        } else {
          hasValidChildren = true;
        }
      } else {
        hasValidChildren = true;
      }
    }

    for (const childName of childrenToRemove) {
      node.removeChild(childName);
    }

    return hasValidChildren;
  }

  findNode(pathSegments: string[]): Node | undefined {
    let currentNode: Node = this.rootNode;

    for (const segment of pathSegments) {
      if (currentNode instanceof DirNode) {
        const child = currentNode.getChild(segment);
        if (!child) {
          return undefined;
        }
        currentNode = child;
      } else {
        return undefined;
      }
    }

    return currentNode;
  }

  findNodeByPath(filePath: string): Node | undefined {
    const relativePath = path.relative(this.rootNode.fullPath, filePath);
    if (relativePath.startsWith("..")) {
      return undefined;
    }

    const segments = relativePath === "" ? [] : relativePath.split(path.sep);
    return this.findNode(segments);
  }

  getAllFiles(): FileNode[] {
    const files: FileNode[] = [];
    this.traverseNodes(this.rootNode, (node) => {
      if (node instanceof FileNode) {
        files.push(node);
      }
    });
    return files;
  }

  getAllDirectories(): DirNode[] {
    const directories: DirNode[] = [];
    this.traverseNodes(this.rootNode, (node) => {
      if (node instanceof DirNode) {
        directories.push(node);
      }
    });
    return directories;
  }

  private traverseNodes(node: Node, callback: (node: Node) => void): void {
    callback(node);

    if (node instanceof DirNode) {
      for (const child of node.getAllChildren()) {
        this.traverseNodes(child, callback);
      }
    }
  }

  refresh(
    filePermissions: FilePermissions,
    initialFilePermissions?: FilePermissions
  ): void {
    const rootPath = this.rootNode.fullPath;
    this.rootNode = new DirNode(rootPath);
    this.buildTree(
      rootPath,
      this.rootNode,
      filePermissions,
      initialFilePermissions ?? filePermissions
    );
    this.pruneEmptyNodes();
  }

  getNodeCount(): number {
    let count = 0;
    this.traverseNodes(this.rootNode, () => count++);
    return count;
  }

  insertNode(fullPath: string, node: Node): Node | undefined {
    const parentPath = path.dirname(fullPath);
    const parentNode = this.findNodeByPath(parentPath);
    if (parentNode instanceof DirNode) {
      parentNode.addChild(node);
      return node;
    }
    return undefined;
  }

  updateNode(fullPath: string, newNode: Node): Node | undefined {
    const parentPath = path.dirname(fullPath);
    const nodeName = path.basename(fullPath);
    const parentNode = this.findNodeByPath(parentPath);

    if (parentNode instanceof DirNode && parentNode.hasChild(nodeName)) {
      parentNode.removeChild(nodeName);
      parentNode.addChild(newNode);
      return newNode;
    }
    return undefined;
  }

  //   insertFileNode(filePath: string): FileNode | undefined {
  //     const fileName = path.basename(filePath);
  //     const fileNode = new FileNode(filePath, fileName);
  //     const insertedNode = this.insertNode(filePath, fileNode);
  //     return insertedNode instanceof FileNode ? insertedNode : undefined;
  //   }

  //   insertDirNode(dirPath: string): DirNode | undefined {
  //     const dirName = path.basename(dirPath);
  //     const dirNode = new DirNode(dirPath, dirName);
  //     const insertedNode = this.insertNode(dirPath, dirNode);
  //     return insertedNode instanceof DirNode ? insertedNode : undefined;
  //   }

  async getTreeString(
    includeContent: boolean,
    maxDepth: number = Infinity,
    excludeOldContent?: boolean
  ): Promise<string> {
    return this.getNodeString(
      this.rootNode,
      0,
      includeContent,
      maxDepth,
      excludeOldContent
    );
  }

  private async getNodeString(
    node: Node,
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
            result += await this.fileMemoryStore.getFileString(node.fullPath);
          }
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
          result += outdatedMessage;
        }
      } else {
        result += await this.fileMemoryStore.getFileString(node.fullPath);
      }
    }

    if (node instanceof DirNode && depth < maxDepth) {
      for (const child of node.getAllChildren()) {
        result += this.getNodeString(
          child,
          depth + 1,
          includeContent,
          maxDepth
        );
      }
    }

    return result;
  }
}
