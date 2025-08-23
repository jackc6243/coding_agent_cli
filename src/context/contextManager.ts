import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { ChatMessage } from "../types.js";
import { ToolClient } from "../tools/types.js";
import { ChunkStrategist } from "../chunking/types.js";
import { FileWatcherService } from "../services/FileWatcher/FileWatcherService.js";
import { FileChunkMemoryStore } from "../chunking/FileChunkMemoryStore.js";
import { FilePermissions } from "./FilePermissions.js";
import { ContextTree, FileNode } from "./ContextTree.js";
import { IVectorStore } from "../services/vectorStore/IVectorStore.js";
import { EmbeddingService } from "../services/embedding/type.js";

export type SpecialContext = {
  type: string;
};

export type SpecialInstructions = {
  type: string;
};

export type Task = object;

export class ContextManager {
  contextId: number;
  systemInstructions: string;
  messageHistory: ChatMessage[] = [];
  toolClients: Map<string, ToolClient>;
  clients: ToolClient[] = [];
  specialContext: SpecialContext | null = null;
  specialInstructions: SpecialInstructions | null = null;
  taskList: Task[] | null = null;
  initialContextTree: ContextTree;
  fileChunkMemoryStore: FileChunkMemoryStore;
  fileWatcher: FileWatcherService;
  vectorStore: IVectorStore;
  embeddingService: EmbeddingService;
  currentContextTree: ContextTree;
  filePermissions: FilePermissions;
  isInitialised: boolean = false;

  constructor(
    systemInstructions: string,
    filePermissions: FilePermissions,
    chunkStrategist: ChunkStrategist,
    embeddingService: EmbeddingService,
    vectorStore: IVectorStore
  ) {
    this.contextId = Math.floor(Math.random() * 1000000);
    this.systemInstructions = systemInstructions;
    this.filePermissions = filePermissions;
    this.toolClients = new Map();
    this.fileChunkMemoryStore = new FileChunkMemoryStore(
      chunkStrategist,
      this.filePermissions
    );
    this.embeddingService = embeddingService;
    this.currentContextTree = new ContextTree(
      this.fileChunkMemoryStore,
      this.filePermissions
    );
    this.fileWatcher = new FileWatcherService(this.filePermissions);
    this.vectorStore = vectorStore;

    const initialFileMemoryStore = new FileChunkMemoryStore(
      chunkStrategist,
      filePermissions
    );
    this.initialContextTree = new ContextTree(initialFileMemoryStore, filePermissions);

    this.fileWatcher.on("fileChange", async ({ type, path }) => {
      if (
        this.filePermissions.checkIfReadOrWriteAllowed(path) &&
        type != "unlink"
      ) {
        this.reIndexFile(path);
      }
    });

    // this.isInitialised = true;
  }

  // clears everything and re-indexes everything
  async reIndex() {
    this.vectorStore.eraseFilepath(this.filePermissions.rootFolder);
    this.filePermissions
      .getAllFilesFromRoot()
      .forEach((filePath) => this.reIndexFile(filePath));
  }

  async getContextPretty(fullString: boolean): Promise<string> {
    return this.currentContextTree.getTreeString(fullString);
  }

  *getAllTools(): Generator<{ identifier: string; tool: Tool }, void, void> {
    for (const [clientName, client] of this.toolClients) {
      for (const tool of client.getToolList()) {
        yield { identifier: `${clientName}-${tool.name}`, tool };
      }
    }
  }

  getToolSize() {
    return Array.from(this.toolClients.values()).reduce(
      (total, client) => total + client.tools.size,
      0
    );
  }

  registerClient(getClientFunction: () => ToolClient) {
    const client = getClientFunction();
    this.toolClients.set(client.clientName, client);
  }

  addChatMessage(msg: ChatMessage) {
    this.messageHistory.push(msg);
  }

  compressChatHistory() {}

  async waitInitialised(): Promise<void> {}

  async getSystemInstructionsWithContext(): Promise<string> {
    const contextTreeString = await this.initialContextTree.getTreeString(
      true, // includeContent
      Infinity, // maxDepth
      true // excludeOldContent
    );

    return `${this.systemInstructions}\n\n## Initial Code Context\n\n${contextTreeString}`;
  }

  retrieveContextTree(): ContextTree {
    return this.currentContextTree;
  }

  private async reIndexFile(filePath: string) {
    const chunkContents =
      await this.fileChunkMemoryStore.getFileChunkContent(filePath);
    const embeddings = await this.embeddingService.embedChunks(chunkContents);
    this.vectorStore.storeEmbeddings(embeddings);
    this.vectorStore.addContextId(chunkContents, this.contextId);
    const node = new FileNode(filePath, true);
    this.currentContextTree.updateNode(filePath, node);
  }
}
