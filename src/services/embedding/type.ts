import { Chunk } from "../../chunking/Chunk.js";
import { ChunkContent } from "../../chunking/types.js";

export interface Embedding extends Chunk {
  embedding: number[];
}

export interface EmbeddingService {
  embedRaw(raw: string): Promise<number[]>;
  embedChunks(chunks: ChunkContent[]): Promise<Embedding[]>;
  embedOneChunk(chunk: ChunkContent): Promise<Embedding>;
}
