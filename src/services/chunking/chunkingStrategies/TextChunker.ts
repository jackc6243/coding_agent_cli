import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";
import { IChunkStrategist } from "../types.js";
import { ChunkContent } from "../ChunkContent.js";

export class TextChunker implements IChunkStrategist {
  private static readonly MAX_CHUNK_SIZE = 1000; // characters
  private static readonly OVERLAP_SIZE = 100; // characters

  async chunkFile(filePath: string): Promise<ChunkContent[]> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const lastModified = fs.statSync(filePath).mtimeMs;

    return this.chunkFileContent(filePath, content, lastModified);
  }

  async chunkFilePart(
    filePath: string,
    start: number,
    end: number
  ): Promise<ChunkContent[]> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const partContent = lines.slice(start - 1, end).join("\n");
    const lastModified = fs.statSync(filePath).mtimeMs;

    const hash = createHash("md5")
      .update(`${filePath}-${start}-${end}-${partContent}`)
      .digest("hex");

    return [
      new ChunkContent(filePath, lastModified, start, end, hash, partContent, {
        type: "text",
        chunkIndex: 0,
        extension: path.extname(filePath),
      }),
    ];
  }

  private chunkFileContent(
    filePath: string,
    content: string,
    lastModified: number
  ): ChunkContent[] {
    const chunks: ChunkContent[] = [];
    let chunkIndex = 0;
    let start = 0;

    while (start < content.length) {
      let end = Math.min(start + TextChunker.MAX_CHUNK_SIZE, content.length);

      if (end < content.length) {
        const lastNewline = content.lastIndexOf("\n", end);
        if (lastNewline > start) {
          end = lastNewline;
        }
      }

      const chunkContent = content.substring(start, end);
      const startLine = content.substring(0, start).split("\n").length;
      const endLine = content.substring(0, end).split("\n").length;

      const hash = createHash("md5")
        .update(`${filePath}-${chunkIndex}-${chunkContent}`)
        .digest("hex");

      chunks.push(
        new ChunkContent(
          filePath,
          lastModified,
          startLine,
          endLine,
          hash,
          chunkContent.trim(),
          { type: "text", chunkIndex }
        )
      );

      start = Math.max(start + 1, end - TextChunker.OVERLAP_SIZE);
      chunkIndex++;
    }

    return chunks;
  }
}
