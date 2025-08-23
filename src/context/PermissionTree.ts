// import { Node } from "./types.js";
// import * as fs from "fs";
// import * as path from "path";
// import { FilePermissions } from "./FilePermissions.js";

// export class PermissionsNode extends Node {
//     readAllowed: boolean;
//     writeAllowed: boolean;
//     isFile: boolean;

//     constructor(fullPath: string, name: string, isFile: boolean, read: boolean, write: boolean) {
//         super(fullPath, name);
//         this.isFile = isFile;
//         this.readAllowed = read;
//         this.writeAllowed = write;
//     }
// }

// export class PermissionDirNode extends PermissionsNode {
//     children: Map<string, PermissionsNode> = new Map();

//     constructor(fullPath: string, name: string, read: boolean, write: boolean) {
//         super(fullPath, name, false, read, write);
//     }

//     addChild(node: PermissionsNode): void {
//         this.children.set(node.name, node);
//     }

//     removeChild(name: string): boolean {
//         return this.children.delete(name);
//     }

//     getChild(name: string): PermissionsNode | undefined {
//         return this.children.get(name);
//     }

//     hasChild(name: string): boolean {
//         return this.children.has(name);
//     }

//     getChildrenNames(): string[] {
//         return Array.from(this.children.keys());
//     }

//     getAllChildren(): PermissionsNode[] {
//         return Array.from(this.children.values());
//     }

//     hasPermissionInSubtree(): boolean {
//         if (this.readAllowed || this.writeAllowed) {
//             return true;
//         }

//         for (const child of this.children.values()) {
//             if (child instanceof PermissionDirNode) {
//                 if (child.hasPermissionInSubtree()) {
//                     return true;
//                 }
//             } else if (child.readAllowed || child.writeAllowed) {
//                 return true;
//             }
//         }

//         return false;
//     }
// }

// export class PermissionTreeMask {
//     rootNode: PermissionDirNode;

//     constructor(filePermissions: FilePermissions) {
//         const rootName = path.basename(filePermissions.rootFolder) || filePermissions.rootFolder;
//         const rootRead = filePermissions.checkIfReadAllowed(filePermissions.rootFolder);
//         const rootWrite = filePermissions.checkIfWriteAllowed(filePermissions.rootFolder);

//         this.rootNode = new PermissionDirNode(filePermissions.rootFolder, rootName, rootRead, rootWrite);
//         this.buildPermissionTree(filePermissions.rootFolder, this.rootNode, filePermissions);
//         this.pruneEmptyNodes();
//     }

//     private buildPermissionTree(dirPath: string, parentNode: PermissionDirNode, filePermissions: FilePermissions): void {
//         try {
//             if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
//                 return;
//             }

//             const entries = fs.readdirSync(dirPath, { withFileTypes: true });

//             for (const entry of entries) {
//                 const fullPath = path.join(dirPath, entry.name);
//                 const readAllowed = filePermissions.checkIfReadAllowed(fullPath);
//                 const writeAllowed = filePermissions.checkIfWriteAllowed(fullPath);

//                 if (entry.isDirectory()) {
//                     const dirNode = new PermissionDirNode(fullPath, entry.name, readAllowed, writeAllowed);
//                     parentNode.addChild(dirNode);
//                     this.buildPermissionTree(fullPath, dirNode, filePermissions);
//                 } else if (entry.isFile()) {
//                     const fileNode = new PermissionsNode(fullPath, entry.name, true, readAllowed, writeAllowed);
//                     parentNode.addChild(fileNode);
//                 }
//             }
//         } catch (error) {
//             console.error(`Error building permission tree for directory ${dirPath}:`, error);
//         }
//     }

//     private pruneEmptyNodes(): void {
//         this.pruneNode(this.rootNode);
//     }

//     private pruneNode(node: PermissionDirNode): boolean {
//         if (node.readAllowed || node.writeAllowed) {
//             return true;
//         }

//         const childrenToRemove: string[] = [];
//         let hasValidChildren = false;

//         for (const [childName, child] of node.children) {
//             if (child instanceof PermissionDirNode) {
//                 if (!this.pruneNode(child)) {
//                     childrenToRemove.push(childName);
//                 } else {
//                     hasValidChildren = true;
//                 }
//             } else if (child.readAllowed || child.writeAllowed) {
//                 hasValidChildren = true;
//             } else {
//                 childrenToRemove.push(childName);
//             }
//         }

//         for (const childName of childrenToRemove) {
//             node.removeChild(childName);
//         }

//         return hasValidChildren;
//     }

//     findNode(pathSegments: string[]): PermissionsNode | undefined {
//         let currentNode: PermissionsNode = this.rootNode;

//         for (const segment of pathSegments) {
//             if (currentNode instanceof PermissionDirNode) {
//                 const child = currentNode.getChild(segment);
//                 if (!child) {
//                     return undefined;
//                 }
//                 currentNode = child;
//             } else {
//                 return undefined;
//             }
//         }

//         return currentNode;
//     }

//     findNodeByPath(filePath: string): PermissionsNode | undefined {
//         const relativePath = path.relative(this.rootNode.fullPath, filePath);
//         if (relativePath.startsWith('..')) {
//             return undefined;
//         }

//         const segments = relativePath === '' ? [] : relativePath.split(path.sep);
//         return this.findNode(segments);
//     }

//     getAllPermittedFiles(): PermissionsNode[] {
//         const files: PermissionsNode[] = [];
//         this.traverseNodes(this.rootNode, (node) => {
//             if (node.isFile && (node.readAllowed || node.writeAllowed)) {
//                 files.push(node);
//             }
//         });
//         return files;
//     }

//     getAllPermittedDirectories(): PermissionDirNode[] {
//         const directories: PermissionDirNode[] = [];
//         this.traverseNodes(this.rootNode, (node) => {
//             if (!node.isFile && (node.readAllowed || node.writeAllowed)) {
//                 directories.push(node as PermissionDirNode);
//             }
//         });
//         return directories;
//     }

//     private traverseNodes(node: PermissionsNode, callback: (node: PermissionsNode) => void): void {
//         callback(node);

//         if (node instanceof PermissionDirNode) {
//             for (const child of node.getAllChildren()) {
//                 this.traverseNodes(child, callback);
//             }
//         }
//     }

//     getNodeCount(): number {
//         let count = 0;
//         this.traverseNodes(this.rootNode, () => count++);
//         return count;
//     }

//     getTreeString(maxDepth: number = Infinity): string {
//         return this.getNodeString(this.rootNode, 0, maxDepth);
//     }

//     private getNodeString(node: PermissionsNode, depth: number, maxDepth: number): string {
//         if (depth > maxDepth) return '';

//         const indent = '  '.repeat(depth);
//         const type = node.isFile ? '[F]' : '[D]';
//         const permissions = [];
//         if (node.readAllowed) permissions.push('R');
//         if (node.writeAllowed) permissions.push('W');
//         const permStr = permissions.length > 0 ? ` (${permissions.join('')})` : '';

//         let result = `${indent}${type} ${node.name}${permStr}\n`;

//         if (node instanceof PermissionDirNode && depth < maxDepth) {
//             for (const child of node.getAllChildren()) {
//                 result += this.getNodeString(child, depth + 1, maxDepth);
//             }
//         }

//         return result;
//     }

//     hasReadPermission(filePath: string): boolean {
//         const node = this.findNodeByPath(filePath);
//         return node?.readAllowed ?? false;
//     }

//     hasWritePermission(filePath: string): boolean {
//         const node = this.findNodeByPath(filePath);
//         return node?.writeAllowed ?? false;
//     }
// }
