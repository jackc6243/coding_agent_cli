import { ChunkContent } from "./ChunkContent.js";

export type ChunkType =
  | "function"
  | "class"
  | "interface"
  | "variable"
  | "comment"
  | "text";

export interface ChunkStrategist {
  chunkFile(path: string): Promise<ChunkContent[]>;
  chunkFilePart(
    path: string,
    start: number,
    end: number
  ): Promise<ChunkContent[]>;
}
export { ChunkContent };
