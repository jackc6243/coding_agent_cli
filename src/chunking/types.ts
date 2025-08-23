export type ChunkType =
  | "function"
  | "class"
  | "interface"
  | "variable"
  | "comment"
  | "text";

export class Chunk {
  filePath: string;
  lastModified: number;
  lineStart: number;
  lineEnd: number;
  hash: string;
  type: ChunkType;
  metaData: {
    name?: string;
    signature?: string;
    description?: string;
    language?: string;
    nodeType?: string;
    declarationType?: string;
    hasErrors?: boolean;
    isNamed?: boolean;
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
    type: ChunkType,
    metaData: Chunk["metaData"] = {}
  ) {
    this.filePath = filePath;
    this.lastModified = lastModified;
    this.lineStart = lineStart;
    this.lineEnd = lineEnd;
    this.hash = hash;
    this.type = type;
    this.metaData = metaData;
  }

  getDescriptiveText(): string {
    const parts: string[] = [];

    if (this.metaData.name) {
      parts.push(`Name: ${this.metaData.name}`);
    }

    parts.push(`Type: ${this.type}`);
    parts.push(`File: ${this.filePath}`);
    parts.push(`Lines: ${this.lineStart}-${this.lineEnd}`);

    if (this.metaData.signature) {
      parts.push(`Signature: ${this.metaData.signature}`);
    }

    if (this.metaData.description) {
      parts.push(`Description: ${this.metaData.description}`);
    }

    return parts.join(", ");
  }
}

export class ChunkContent extends Chunk {
  content: string;
  lastModified: number;

  constructor(
    filePath: string,
    lastModified: number,
    lineStart: number,
    lineEnd: number,
    hash: string,
    type: ChunkType,
    content: string,
    metaData: Chunk["metaData"] = {}
  ) {
    super(filePath, lastModified, lineStart, lineEnd, hash, type, metaData);
    this.content = content;
    this.lastModified = Date.now();
  }
}

export interface ChunkStrategist {
  chunkFile(path: string): Promise<ChunkContent[]>;
  chunkFilePart(
    path: string,
    start: number,
    end: number
  ): Promise<ChunkContent[]>;
}
