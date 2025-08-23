import * as fs from "fs";
import { FilePermissions } from "../context/FilePermissions.js";
import { Chunk, ChunkContent, ChunkStrategist } from "./types.js";

export class FileChunkMemoryStore {
  // first key is path and second key is chunk hash
  cache: Map<
    string,
    {
      lastModified: number;
      complete: boolean;
      chunkMap: Map<string, ChunkContent>;
    }
  > = new Map();
  chunkStrategist: ChunkStrategist;
  filePermissions: FilePermissions;

  constructor(
    chunkStrategist: ChunkStrategist,
    filePermissions: FilePermissions
  ) {
    this.chunkStrategist = chunkStrategist;
    this.filePermissions = filePermissions;
  }

  async getChunkContent(chunk: Chunk): Promise<ChunkContent> {
    let mp = this.cache.get(chunk.filePath)?.chunkMap;
    if (!mp) {
      const chunks = await this.getFileChunkContent(chunk.filePath);
      mp = new Map<string, ChunkContent>();
      chunks.forEach((chunkContent) => {
        mp!.set(chunkContent.hash, chunkContent);
      });
    }
    let res = mp.get(chunk.hash);

    if (!res) {
      const contentArray = await this.chunkStrategist.chunkFilePart(
        chunk.filePath,
        chunk.lineStart,
        chunk.lineEnd
      );
      // Take the first chunk from the array (assuming it matches our target chunk)
      const content = contentArray[0];
      if (content) {
        mp.set(chunk.hash, content);
        res = content;
      }
    }

    if (!res) {
      throw new Error(
        `Chunk not found: ${chunk.hash} in file ${chunk.filePath}`
      );
    }

    return res;
  }

  async getFileString(path: string): Promise<string> {
    const contents = await this.getFileChunkContent(path);
    let result: string = "";
    contents.forEach((content) => {
      result += content.content;
    });

    return result;
  }

  async getFileChunkContent(path: string): Promise<ChunkContent[]> {
    let curFileChunkMap = this.cache.get(path)?.chunkMap;
    const cachedEntry = this.cache.get(path);

    // check if its in cache or if the cache is out of date
    const fileModified = fs.statSync(path).mtimeMs;
    if (
      !curFileChunkMap ||
      !cachedEntry ||
      cachedEntry.lastModified < fileModified
    ) {
      const chunks: ChunkContent[] = await this.chunkStrategist.chunkFile(path);
      curFileChunkMap = new Map<string, ChunkContent>();
      chunks.forEach((chunk) => {
        curFileChunkMap!.set(chunk.hash, chunk);
      });
    }

    this.cache.set(path, {
      lastModified: fileModified,
      complete: true,
      chunkMap: curFileChunkMap,
    });

    return Array.from(curFileChunkMap.values());
  }
}
