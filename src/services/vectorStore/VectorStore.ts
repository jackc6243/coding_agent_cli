/* eslint-disable no-useless-catch */
import { ChromaClient } from "chromadb";
import type { Collection } from "chromadb";
import { SERVICE_CONFIG } from "../../config/Constants.js";
import { Embedding } from "../embedding/type.js";
import {
  IVectorStore,
  VectorStoreConfig,
  VectorStoreStats,
  VectorQueryResult,
} from "./IVectorStore.js";
import { Chunk } from "../../chunking/Chunk.js";
import { ConsoleLogger } from "../../logging/ConsoleLogger.js";

export class ChromaVectorStore implements IVectorStore {
  private readonly BATCH_SIZE = 100;
  private client: ChromaClient;
  private collection: Collection | null = null;
  private readonly config: VectorStoreConfig;
  private logger = new ConsoleLogger("info");

  constructor(config?: Partial<VectorStoreConfig>) {
    this.config = {
      url: config?.url || SERVICE_CONFIG.CHROMADB_DEFAULT_URL,
      collectionName:
        config?.collectionName || SERVICE_CONFIG.CHROMADB_COLLECTION_NAME,
      collectionDescription:
        config?.collectionDescription ||
        SERVICE_CONFIG.CHROMADB_COLLECTION_DESCRIPTION,
    };

    this.client = new ChromaClient({
      path: this.config.url,
    });
  }

  async initialize(): Promise<void> {
    try {
      // Try to get existing collection or create new one
      try {
        this.collection = await this.client.getCollection({
          name: this.config.collectionName,
        });
        this.logger.log(
          `Using existing ChromaDB collection: ${this.config.collectionName}`,
          "info"
        );
      } catch {
        // Collection doesn't exist, create it
        this.collection = await this.client.createCollection({
          name: this.config.collectionName,
          metadata: {
            description: this.config.collectionDescription || "",
            created_at: new Date().toISOString(),
          },
          embeddingFunction: null,
        });
        this.logger.log(
          `Created new ChromaDB collection: ${this.config.collectionName}`,
          "info"
        );
      }
    } catch (error) {
      this.logger.log("Failed to initialize ChromaDB:", "error");
      this.logger.log(
        "Note: Make sure ChromaDB is running locally. You can start it with: chroma run --host localhost --port 8000",
        "info"
      );
      throw error;
    }
  }

  async eraseFilepath(root: string): Promise<void> {
    if (!this.collection) {
      throw new Error("VectorStore not initialized. Call initialize() first.");
    }

    try {
      // Get all vectors - we'll filter them manually since ChromaDB doesn't have startsWith operator
      const results = await this.collection.get({
        include: ["metadatas"],
      });

      // Filter results to only include those that start with root
      const matchingIds: string[] = [];
      if (results.ids && results.metadatas) {
        for (let i = 0; i < results.ids.length; i++) {
          const metadata = results.metadatas[i] as {
            filePath?: string;
            [key: string]: unknown;
          };
          if (metadata?.filePath?.startsWith(root)) {
            matchingIds.push(results.ids[i]);
          }
        }
      }

      if (matchingIds.length > 0) {
        await this.collection.delete({
          ids: matchingIds,
        });
        this.logger.log(
          `Erased ${matchingIds.length} vectors with filePath starting with "${root}"`,
          "info"
        );
      } else {
        this.logger.log(`No vectors found with filePath starting with "${root}"`, "info");
      }
    } catch (error) {
      this.logger.log(`Failed to erase vectors for root "${root}"`, "error");
      throw error;
    }
  }

  async addContextId(chunks: Chunk[], contextId: number): Promise<void> {
    if (!this.collection) {
      throw new Error("VectorStore not initialized. Call initialize() first.");
    }

    try {
      for (let i = 0; i < chunks.length; i += this.BATCH_SIZE) {
        const end = Math.min(i + this.BATCH_SIZE, chunks.length);
        const batchChunks = chunks.slice(i, end);
        const ids = batchChunks.map((chunk) => chunk.hash);

        const existingData = await this.collection.get({
          ids,
          include: ["metadatas"],
        });

        const updatedMetadatas =
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          existingData.metadatas?.map((metadata: any) => {
            const contextIdsStr = metadata.contextIds || "";
            const contextIds = contextIdsStr
              ? contextIdsStr.split(",").map(Number)
              : [];

            if (!contextIds.includes(contextId)) {
              contextIds.push(contextId);
            }

            return {
              ...metadata,
              contextIds: contextIds.join(","),
            };
          }) || [];

        await this.collection.update({
          ids,
          metadatas: updatedMetadatas,
        });
      }
    } catch (error) {
      throw error;
    }
  }

  async removeContextId(chunks: Chunk[], contextId: number): Promise<void> {
    if (!this.collection) {
      throw new Error("VectorStore not initialized. Call initialize() first.");
    }

    try {
      for (let i = 0; i < chunks.length; i += this.BATCH_SIZE) {
        const end = Math.min(i + this.BATCH_SIZE, chunks.length);
        const batchChunks = chunks.slice(i, end);
        const ids = batchChunks.map((chunk) => chunk.hash);

        const existingData = await this.collection.get({
          ids,
          include: ["metadatas"],
        });

        const updatedMetadatas =
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          existingData.metadatas?.map((metadata: any) => {
            const contextIdsStr = metadata.contextIds || "";
            const contextIds = contextIdsStr
              ? contextIdsStr.split(",").map(Number)
              : [];
            const filteredContextIds = contextIds.filter(
              (id: number) => id !== contextId
            );

            return {
              ...metadata,
              contextIds: filteredContextIds.join(","),
            };
          }) || [];

        await this.collection.update({
          ids,
          metadatas: updatedMetadatas,
        });
      }
    } catch (error) {
      throw error;
    }
  }

  async storeEmbeddings(embeddedChunks: Embedding[]): Promise<void> {
    if (!this.collection) {
      throw new Error("VectorStore not initialized. Call initialize() first.");
    }

    if (embeddedChunks.length === 0) {
      this.logger.log("No chunks to store", "info");
      return;
    }

    try {
      // Prepare data for ChromaDB
      const ids = embeddedChunks.map((chunk) => chunk.hash);
      const metadatas = embeddedChunks.map((chunk) => ({
        filePath: chunk.filePath,
        lineStart: chunk.lineStart,
        lineEnd: chunk.lineEnd,
        hash: chunk.hash,
        lastModified: chunk.lastModified,
        contextIds: "",
      }));

      // Store in batches to avoid memory issues
      for (let i = 0; i < embeddedChunks.length; i += this.BATCH_SIZE) {
        const end = Math.min(i + this.BATCH_SIZE, embeddedChunks.length);
        this.logger.log(
          `Storing batch ${Math.floor(i / this.BATCH_SIZE) + 1}/${Math.ceil(embeddedChunks.length / this.BATCH_SIZE)} (${end - i} chunks)`,
          "info"
        );
        const embeddings = embeddedChunks.slice(i, end).map((chunk) => {
          if (!chunk.embedding) {
            throw new Error("One of the chunks' don't have any embeddings");
          }
          return chunk.embedding;
        });

        await this.collection.add({
          ids: ids.slice(i, end),
          embeddings: embeddings,
          metadatas: metadatas.slice(i, end),
        });
      }

      this.logger.log(
        `Successfully stored ${embeddedChunks.length} chunks in ChromaDB`,
        "success"
      );
    } catch (error) {
      this.logger.log("Failed to store chunks in ChromaDB", "error");
      throw error;
    }
  }

  async query(
    queryEmbedding: number[],
    topK: number = 10,
    contextId?: number
  ): Promise<VectorQueryResult[]> {
    if (!this.collection) {
      throw new Error("VectorStore not initialized. Call initialize() first.");
    }

    try {
      // Query without filtering first, then filter in memory for contextIds
      const results = await this.collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: contextId ? topK * 3 : topK, // Get more results if we need to filter
        include: ["documents", "metadatas", "distances"],
      });

      if (
        !results.documents ||
        !results.documents[0] ||
        !results.metadatas ||
        !results.metadatas[0] ||
        !results.distances ||
        !results.distances[0] ||
        !results.ids ||
        !results.ids[0]
      ) {
        return [];
      }

      const queryResults: VectorQueryResult[] = [];

      for (let i = 0; i < results.documents[0].length; i++) {
        const metadata = results.metadatas[0][i] as unknown as {
          filePath: string;
          contextIds: string;
          type: string;
          lineStart: number;
          lineEnd: number;
          hash: string;
          lastModified: number;
          name?: string;
          signature?: string;
          description?: string;
        };
        const document = results.documents[0][i];
        const distance = results.distances[0][i];

        if (document && metadata) {
          // Parse contextIds from comma-separated string
          let chunkContextIds: number[] = [];
          try {
            const contextIdsStr = metadata.contextIds || "";
            chunkContextIds = contextIdsStr
              ? contextIdsStr.split(",").map(Number)
              : [];
          } catch {
            this.logger.log("Failed to parse contextIds", "error");
            continue;
          }

          // Filter by contextIds if provided
          if (contextId && !chunkContextIds.includes(contextId)) {
            continue; // Skip this chunk if it doesn't match any contextId
          }

          const chunk: Chunk = {
            filePath: metadata.filePath,
            lastModified: metadata.lastModified,
            lineStart: metadata.lineStart || 1,
            lineEnd: metadata.lineEnd || 1,
            hash: metadata.hash,
            metaData: {},
          };

          queryResults.push({
            chunk,
            score: distance !== null ? 1 - distance : 0, // Convert distance to similarity score
            distance: distance || 0,
          });

          // Stop if we have enough results after filtering
          if (queryResults.length >= topK) {
            break;
          }
        }
      }

      return queryResults.sort((a, b) => b.score - a.score);
    } catch (error) {
      this.logger.log("Failed to query ChromaDB", "error");
      throw error;
    }
  }

  async clear(): Promise<void> {
    if (!this.collection) {
      throw new Error("VectorStore not initialized. Call initialize() first.");
    }

    try {
      await this.client.deleteCollection({ name: this.config.collectionName });
      this.logger.log("Cleared ChromaDB collection", "success");

      // Recreate the collection
      await this.initialize();
    } catch (error) {
      this.logger.log("Failed to clear ChromaDB collection", "error");
      throw error;
    }
  }

  async getStats(): Promise<VectorStoreStats> {
    try {
      const collections = await this.client.listCollections();
      const count = this.collection ? await this.collection.count() : 0;

      return {
        count,
        collections: collections.map((c: { name: string }) => c.name),
      };
    } catch (error) {
      this.logger.log("Failed to get ChromaDB stats", "error");
      throw error;
    }
  }

  async removeByFilePath(filePath: string): Promise<void> {
    if (!this.collection) {
      throw new Error("ChromaDB collection not initialized");
    }

    try {
      // Query for chunks from this file path
      const results = await this.collection.get({
        where: { filePath: filePath },
      });

      if (results.ids && results.ids.length > 0) {
        await this.collection.delete({
          ids: results.ids,
        });
        this.logger.log(`Removed ${results.ids.length} chunks for ${filePath}`, "success");
      }
    } catch (error) {
      this.logger.log(`Failed to remove chunks for ${filePath}`, "error");
      throw error;
    }
  }

  async close(): Promise<void> {
    // ChromaDB client doesn't require explicit closing for HTTP client
    this.collection = null;
    this.logger.log("VectorStore closed", "info");
  }
}
