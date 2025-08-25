import { Chunk } from "../chunking/Chunk.js";
import { ChunkContent } from "../chunking/ChunkContent.js";

export interface Embedding extends Chunk {
  embedding: number[];
}

export interface IEmbeddingService {
  embedRaw(raw: string): Promise<number[]>;
  embedChunks(chunks: ChunkContent[]): Promise<Embedding[]>;
  embedOneChunk(chunk: ChunkContent): Promise<Embedding>;
}
