import { EventEmitter } from "events";
import { Chunk } from "./Chunk.js";
import { IChunkStorage, IChunkStrategist } from "./types.js";
import { FilePermissions } from "../../context/FilePermissions.js";
import { FileWatcherService } from "../FileWatcher/FileWatcherService.js";

export class ChunkManager extends EventEmitter {
  chunkStorage: IChunkStorage;
  chunkStrategist: IChunkStrategist;
  filePermissions: FilePermissions;
  fileWatcher: FileWatcherService;

  constructor(
    chunkStrategist: IChunkStrategist,
    filePermissions: FilePermissions,
    chunkStorage: IChunkStorage,
    fileWatcher: FileWatcherService
  ) {
    super();
    this.chunkStrategist = chunkStrategist;
    this.filePermissions = filePermissions;
    this.chunkStorage = chunkStorage;
    this.fileWatcher = fileWatcher;

    // make this more efficient later such that it only updates chunks that are needed to be updated
    this.fileWatcher.on("fileChange", ({ path }) => {
      this.reChunk(path);
    });
  }

  async invalidate(path: string, startLine: number, endLine: number) {
    const erasedChunks = await this.chunkStorage.erase(
      path,
      startLine,
      endLine
    );
    this.emit("delete", erasedChunks);
  }

  async index(): Promise<void> {
    this.chunkStorage.clear();
    this.emit("reset");
    this.filePermissions.getAllFilesFromRoot().forEach((filePath) => {
      this.reChunk(filePath);
    });
  }

  async reChunk(
    path: string,
    startLine: number = 0,
    endLine: number = Infinity
  ): Promise<Chunk[]> {
    const chunks = await this.chunkStrategist.chunkFile(
      path,
      startLine,
      endLine
    );
    this.invalidate(path, startLine, endLine);
    this.chunkStorage.insert(path, startLine, chunks);
    this.emit("insert", chunks);
    return chunks;
  }
}
