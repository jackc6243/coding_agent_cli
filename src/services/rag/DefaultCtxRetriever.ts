import { ContextManager } from "../../context/ContextManager.js";
import { ContextTree } from "../../context/ContextTree.js";
import { IVectorStore } from "../vectorStore/IVectorStore.js";
import { IRetrievalService } from "./IRetrievalService.js";
import { IEmbeddingService } from "../embedding/type.js";
import { ChromaVectorStore } from "../vectorStore/ChromaVectorStore.js";
import { OpenAIEmbeddingService } from "../embedding/OpenAIEmbeddingService.js";
import { FilePermissions } from "../../context/FilePermissions.js";
import { getAppConfig } from "../../config/AppConfig.js";
import { GlobalFileWatcher } from "../FileWatcher/GlobalFileWatcher.js";
import { TextChunker } from "../chunking/chunkingStrategies/TextChunker.js";
import { DefaultChunkStorage } from "../chunking/ChunkStorage.js";
import { ChunkManager } from "../chunking/ChunkManager.js";
import { Chunk } from "../chunking/Chunk.js";

export async function getTraditionalRAG(
  filePermissions: FilePermissions
): Promise<DefaultCtxRetriever> {
  const chunkStrategist = new TextChunker();
  const chunkStorage = new DefaultChunkStorage();
  const chunkManager = new ChunkManager(
    chunkStrategist,
    filePermissions,
    chunkStorage,
    GlobalFileWatcher
  );

  const config = getAppConfig();

  const embeddingService = new OpenAIEmbeddingService();

  // Initialize vector store
  const vectorStore = new ChromaVectorStore({
    url: config.vectorStore.url,
    collectionName: config.vectorStore.collectionName,
    collectionDescription: config.vectorStore.collectionDescription,
  });

  // Initialize the vector store
  try {
    await vectorStore.initialize();
  } catch (error) {
    throw new Error(
      `Failed to initialize vector store. Ensure ChromaDB is running at ${config.vectorStore.url}. Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return new DefaultCtxRetriever(chunkManager, vectorStore, embeddingService);
}

export class DefaultCtxRetriever implements IRetrievalService {
  private vectorStore: IVectorStore;
  private embeddingService: IEmbeddingService;
  private chunkManager: ChunkManager;
  outdatedChunks: Map<string, Chunk> = new Map();

  constructor(
    chunkManager: ChunkManager,
    vectorStore: IVectorStore,
    embeddingService: IEmbeddingService
  ) {
    this.chunkManager = chunkManager;
    this.vectorStore = vectorStore;
    this.embeddingService = embeddingService;

    this.chunkManager.on("delete", (chunks: Chunk[]) => {
      this.vectorStore.eraseEmbeddings(chunks);
    });

    this.chunkManager.on("insert", (chunks: Chunk[]) => {
      chunks.forEach((chunk) => {
        this.outdatedChunks.set(chunk.hash, chunk);
      });
    });

    this.chunkManager.on("reset", () => {
      this.vectorStore.clear();
    });
  }

  async retrieveContextTree(
    query: string,
    context: ContextManager
  ): Promise<ContextTree> {
    const relevantFilepaths = await this.retrieveRelevantFilePaths(
      query,
      context
    );

    // Create a new context tree with only relevant files
    const filteredContextTree = new ContextTree(context.filePermissions);

    // Filter the tree to only include relevant file paths
    filteredContextTree.filterByRelevantPaths(relevantFilepaths);

    return filteredContextTree;
  }

  private async retrieveRelevantFilePaths(
    query: string,
    context: ContextManager
  ): Promise<string[]> {
    const embedding = await this.embeddingService.embedRaw(query);
    const results = await this.vectorStore.query(
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async initiate(id?: number): Promise<void> {
    this.chunkManager.index();
  }

  async cleanup(): Promise<void> {
    try {
      if (this.vectorStore) {
        await this.vectorStore.close();
      }
    } catch (error) {
      console.error("Error during vector store cleanup:", error);
    }
  }
}
