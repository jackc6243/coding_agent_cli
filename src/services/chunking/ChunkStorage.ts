import { Chunk } from "./Chunk.js";
import { IChunkStorage } from "./types.js";

export class DefaultChunkStorage implements IChunkStorage {
  storage: Map<string, Chunk[]> = new Map();

  constructor() {}

  async erase(
    path: string,
    startLine?: number,
    endLine?: number
  ): Promise<Chunk[]> {
    if (startLine === undefined || endLine === undefined) {
      const chunks = this.storage.get(path);
      this.storage.delete(path);
      return chunks ?? [];
    }

    const chunks = this.storage.get(path);
    if (!chunks) {
      return [];
    }

    const erasedChunks: Chunk[] = [];
    const remainingChunks: Chunk[] = [];

    for (const chunk of chunks) {
      if (chunk.lineStart >= startLine && chunk.lineEnd <= endLine) {
        erasedChunks.push(chunk);
      } else {
        remainingChunks.push(chunk);
      }
    }

    if (remainingChunks.length === 0) {
      this.storage.delete(path);
    } else {
      this.storage.set(path, remainingChunks);
    }

    return erasedChunks;
  }

  async insert(
    path: string,
    startLine: number,
    chunks: Chunk[]
  ): Promise<void> {
    if (!this.storage.has(path)) {
      this.storage.set(path, chunks);
      return;
    }

    const existingChunks = this.storage.get(path)!;
    const insertIndex = existingChunks.findIndex(
      (chunk) => chunk.lineStart >= startLine
    );

    if (insertIndex === -1) {
      existingChunks.push(...chunks);
    } else {
      existingChunks.splice(insertIndex, 0, ...chunks);
    }

    this.storage.set(path, existingChunks);
    return;
  }

  async clear(): Promise<void> {
    this.storage = new Map();
    return;
  }
}
