import { Chunk } from "../../chunking/types.js";

export interface Embedding extends Chunk {
    embedding: number[];
}

export interface EmbeddingService {
    embedRaw(raw: string) : Promise<number[]>;
    embedChunks(chunks : Chunk[]) : Promise<Embedding[]>;
    embedOneChunk(chunk : Chunk) : Promise<Embedding>;
}