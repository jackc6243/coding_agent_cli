import { Chunk } from "./Chunk.js";

export class ChunkContent extends Chunk {
  content: string;
  lastModified: number;

  constructor(
    filePath: string,
    lastModified: number,
    lineStart: number,
    lineEnd: number,
    hash: string,
    content: string,
    metaData: Chunk["metaData"] = {}
  ) {
    super(filePath, lastModified, lineStart, lineEnd, hash, metaData);
    this.content = content;
    this.lastModified = Date.now();
  }

  getDescriptiveText(): string {
    return this.content;
  }
}
