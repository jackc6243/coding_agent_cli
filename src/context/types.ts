import * as path from "path";

export class Node {
  fullPath: string;
  name: string;
  lastModified: number;
  isEnabled: boolean;

  constructor(fullPath: string, isEnabled: boolean = false) {
    this.isEnabled = isEnabled;
    this.fullPath = fullPath;
    this.name = path.basename(fullPath);
    this.lastModified = Date.now();
  }
}
