import { Chunk } from "./Chunk.js";

export type ChunkType =
  | "function"
  | "class"
  | "interface"
  | "variable"
  | "comment"
  | "text";

export interface IChunkStrategist {
  chunkFile(path: string): Promise<Chunk[]>;
  chunkFile(path: string, start: number, end: number): Promise<Chunk[]>;
}

export interface IChunkStorage {
  erase(path: string, startLine: number, endLine: number): Promise<Chunk[]>;
  erase(path: string): Promise<Chunk[]>;
  insert(path: string, startLine: number, chunks: Chunk[]): Promise<void>;
  clear(): Promise<void>;
}
