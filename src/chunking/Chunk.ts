import { ChunkType } from "./types.js";

export class Chunk {
  filePath: string;
  lastModified: number;
  lineStart: number;
  lineEnd: number;
  hash: string;
  metaData: {
    name?: string;
    type?: ChunkType;
    signature?: string;
    description?: string;
    language?: string;
    nodeType?: string;
    hasErrors?: boolean;
    parentType?: string;
    chunkIndex?: number;
    extension?: string;
    wholefile?: boolean;
    [key: string]: unknown; // Allow additional metadata properties
  };

  constructor(
    filePath: string,
    lastModified: number,
    lineStart: number,
    lineEnd: number,
    hash: string,
    metaData: Chunk["metaData"] = {}
  ) {
    this.filePath = filePath;
    this.lastModified = lastModified;
    this.lineStart = lineStart;
    this.lineEnd = lineEnd;
    this.hash = hash;
    this.metaData = metaData;
  }
}
