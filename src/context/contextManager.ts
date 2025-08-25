import { ChatMessage } from "../types.js";
import { FilePermissions } from "./FilePermissions.js";
import { ContextTree, FileNode } from "./ContextTree.js";
import { ContextConverterLLM } from "./ContextConverterLLM.js";
import { SpecialContext, SpecialInstructions, Task } from "./types.js";

export class ContextManager {
  contextId: number;
  systemInstructions: string;
  messageHistory: ChatMessage[] = [];
  specialContext: SpecialContext | null = null;
  specialInstructions: SpecialInstructions | null = null;
  taskList: Task[] | null = null;
  initialContextTree: ContextTree;
  currentContextTree: ContextTree;
  filePermissions: FilePermissions;
  isInitialised: boolean = false;
  private contextConverter: ContextConverterLLM;

  constructor(systemInstructions: string, filePermissions: FilePermissions) {
    this.contextId = Math.floor(Math.random() * 1000000);
    this.systemInstructions = systemInstructions;
    this.filePermissions = filePermissions;
    this.currentContextTree = new ContextTree(this.filePermissions);
    this.contextConverter = new ContextConverterLLM();

    this.initialContextTree = new ContextTree(filePermissions);

    // this.isInitialised = true;
  }

  async getContextPretty(fullString: boolean): Promise<string> {
    return this.contextConverter.getTreeString(
      this.currentContextTree,
      fullString,
      Infinity,
      true
    );
  }

  addChatMessage(msg: ChatMessage) {
    this.messageHistory.push(msg);
  }

  compressChatHistory() {}

  async waitInitialised(): Promise<void> {}

  retrieveContextTree(): ContextTree {
    return this.currentContextTree;
  }

  updateContextTreeNode(filePath: string): void {
    const node = new FileNode(filePath, true);
    this.currentContextTree.updateNode(filePath, node);
  }

  async cleanup(): Promise<void> {
    // Context manager cleanup - no file watching here anymore
  }
}
