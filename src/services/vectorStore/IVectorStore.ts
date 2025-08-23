import { Chunk } from "../../chunking/types.js";
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
  addContextId(chunks: Chunk[], contextId: number): Promise<void>;
  removeContextId(chunks: Chunk[], contextId: number): Promise<void>;
  query(
    embedding: number[],
    topK?: number,
    contextId?: number
  ): Promise<VectorQueryResult[]>;
  clear(): Promise<void>;
  getStats(): Promise<VectorStoreStats>;
  eraseFilepath(root: string): Promise<void>;
  close(): Promise<void>;
}
