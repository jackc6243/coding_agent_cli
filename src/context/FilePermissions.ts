import * as fs from "fs";
import * as path from "path";

export class FilePermissions {
  rootPath: string;
  files: Map<string, boolean> = new Map();

  constructor(
    rootFolder: string,
    allFiles?: { path: string; canWrite: boolean }[]
  ) {
    if (!fs.existsSync(rootFolder) || !fs.statSync(rootFolder).isDirectory()) {
      throw new Error(
        `Root folder does not exist or is not a directory: ${rootFolder}`
      );
    }

    this.rootPath = rootFolder;
    if (allFiles) {
      for (const { path, canWrite } of allFiles) {
        if (!fs.existsSync(path)) {
          throw new Error(`File does not exist: ${path}`);
        }
        this.files.set(path, canWrite);
      }
    } else {
      for (const path of this.getAllFilesFromRoot()) {
        this.files.set(path, true);
      }
    }
  }

  checkIfReadOrWriteAllowed(path: string): boolean {
    return this.checkIfReadAllowed(path) || this.checkIfWriteAllowed(path);
  }

  checkIfReadAllowed(path: string): boolean {
    if (path.startsWith(this.rootPath) && this.files.has(path)) {
      return true;
    }
    return false;
  }

  checkIfWriteAllowed(path: string): boolean {
    if (path.startsWith(this.rootPath) && (this.files.get(path) ?? false)) {
      return true;
    }
    return false;
  }

  setPath(path: string, canWrite: boolean) {
    this.files.set(path, canWrite);
  }

  removePath(path: string) {
    this.files.delete(path);
  }

  getAllFilesFromRoot(): Set<string> {
    const files: string[] = [];

    const scanDirectory = (dirPath: string) => {
      try {
        const items = fs.readdirSync(dirPath, { withFileTypes: true });

        for (const item of items) {
          const fullPath = path.join(dirPath, item.name);

          if (item.isDirectory()) {
            scanDirectory(fullPath);
          } else if (item.isFile()) {
            files.push(fullPath);
          }
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        // Skip directories that can't be read
      }
    };

    scanDirectory(this.rootPath);
    return new Set(files);
  }

  listIncludedPaths(): string {
    const paths = Array.from(this.files.keys()).sort();
    const tree: { [key: string]: { name: string; canWrite: boolean }[] } = {};

    // Group paths by their parent directory
    for (const fullPath of paths) {
      const relativePath = path.relative(this.rootPath, fullPath);
      const parts = relativePath.split(path.sep);
      const canWrite = this.files.get(fullPath) ?? false;

      if (parts.length > 1) {
        const parent = parts.slice(0, -1).join("/");
        const child = parts[parts.length - 1];

        if (!tree[parent]) {
          tree[parent] = [];
        }
        tree[parent].push({ name: child, canWrite });
      } else {
        // Root level file
        if (!tree[""]) {
          tree[""] = [];
        }
        tree[""].push({ name: relativePath, canWrite });
      }
    }

    let result = "";
    const sortedParents = Object.keys(tree).sort();

    for (const parent of sortedParents) {
      if (parent === "") {
        // Root level entries
        for (const { name, canWrite } of tree[parent].sort((a, b) =>
          a.name.localeCompare(b.name)
        )) {
          const readOnlyIndicator = canWrite ? "" : " (read only)";
          result += `${name}${readOnlyIndicator}\n`;
        }
      } else {
        result += `${parent}:\n`;
        for (const { name, canWrite } of tree[parent].sort((a, b) =>
          a.name.localeCompare(b.name)
        )) {
          const readOnlyIndicator = canWrite ? "" : " (read only)";
          result += `\t${name}${readOnlyIndicator}\n`;
        }
      }
    }

    return result.trim();
  }
}
