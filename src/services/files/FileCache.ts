import * as fs from "fs";
import { FilePermissions } from "../../context/FilePermissions.js";
export class FileCache {
  cache: Map<
    string,
    {
      content: string;
      lastModified: Date;
    }
  > = new Map();

  filePermissions: FilePermissions;

  constructor(filePermissions: FilePermissions) {
    this.filePermissions = filePermissions;
  }

  async get(path: string): Promise<string> {
    if (!this.filePermissions.checkIfReadAllowed(path)) {
      throw new Error(
        `The file path [${path}] cannot be read due to insufficient permissions.`
      );
    }
    const fileModified = new Date(fs.statSync(path).mtimeMs);
    let file = this.cache.get(path);
    if (!file || file.lastModified < fileModified) {
      file = {
        content: await fs.promises.readFile(path, "utf-8"),
        lastModified: fileModified,
      };
      this.cache.set(path, file);
    }

    return file.content;
  }
}
