import { Chunk } from "../chunking/Chunk.js";
import { Embedding } from "../embedding/type.js";

export interface VectorStoreConfig {
  url?: string;
  collectionName: string;
  collectionDescription?: string;
}

export interface VectorStoreStats {
  count: number;
  collections: string[];
}

export interface VectorQueryResult {
  chunk: Chunk;
  score: number;
  distance: number;
}

export interface IVectorStore {
  initialize(): Promise<void>;
  storeEmbeddings(embeddings: Embedding[]): Promise<void>;
  eraseEmbeddings(chunks: Chunk[]): Promise<void>;
  eraseEmbedding(chunks: Chunk): Promise<void>;
  addContextId(chunks: Chunk[], contextId: number): Promise<void>;
  removeContextId(chunks: Chunk[], contextId: number): Promise<void>;
  eraseFile(root: string): Promise<void>;
  query(
    embedding: number[],
    topK?: number,
    contextId?: number
  ): Promise<VectorQueryResult[]>;
  clear(): Promise<void>;
  getStats(): Promise<VectorStoreStats>;
  close(): Promise<void>;
}
