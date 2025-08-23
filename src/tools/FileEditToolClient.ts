import { ContextManager } from "../context/ContextManager.js";
import { FileNode } from "../context/ContextTree.js";
import { BaseToolClient } from "./BaseToolClient.js";
import { ToolResult } from "./types.js";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs";

export class FileEditToolClient extends BaseToolClient {
  constructor(contextManager: ContextManager) {
    super("File", contextManager);
    this.registerTools();
  }

  private registerTools(): void {
    const readFileTool: Tool = {
      name: "read_file",
      description:
        "Read the contents of a file and add it to the context tree.",
      inputSchema: {
        type: "object",
        properties: {
          filePath: {
            type: "string",
            description: "The path to the file to read",
          },
        },
        required: ["filePath"],
      },
    };

    const writeFileTool: Tool = {
      name: "write_file",
      description: "Write content to a file and update the context tree.",
      inputSchema: {
        type: "object",
        properties: {
          filePath: {
            type: "string",
            description: "The path to the file to write",
          },
          content: {
            type: "string",
            description: "The content to write to the file",
          },
        },
        required: ["filePath", "content"],
      },
    };

    const editFileTool: Tool = {
      name: "edit_file",
      description:
        "Edit specific lines in a file by replacing a line range with new content.",
      inputSchema: {
        type: "object",
        properties: {
          filePath: {
            type: "string",
            description: "The path to the file to edit",
          },
          lineStart: {
            type: "string",
            description: "The starting line number (1-based) to begin editing",
          },
          lineEnd: {
            type: "string",
            description: "The ending line number (1-based) to stop editing",
          },
          newContent: {
            type: "string",
            description:
              "The new content to replace the specified line range (optional - omit to delete lines)",
          },
        },
        required: ["filePath", "lineStart", "lineEnd"],
      },
    };

    this.registerTool(readFileTool, this.readFile.bind(this));
    this.registerTool(writeFileTool, this.writeFile.bind(this));
    this.registerTool(editFileTool, this.editFile.bind(this));
  }

  async readFile(args: Record<string, unknown>): Promise<ToolResult> {
    const { filePath } = args as {
      filePath: string;
    };
    const node = new FileNode(filePath, true);
    this.contextManager.currentContextTree.updateNode(filePath, node);
    return {
      content: node,
      isError: false,
      executedAt: new Date(),
    };
  }

  async writeFile(args: Record<string, unknown>): Promise<ToolResult> {
    const { filePath, content } = args as {
      filePath: string;
      content: string;
    };

    try {
      // Write content to file
      fs.writeFileSync(filePath, content, "utf8");

      // Create and update the FileNode in context tree
      const node = new FileNode(filePath, true);
      this.contextManager.currentContextTree.updateNode(filePath, node);

      return {
        content: node,
        isError: false,
        executedAt: new Date(),
      };
    } catch (error) {
      return {
        content: `Error writing file: ${(error as Error).message}`,
        isError: true,
        executedAt: new Date(),
      };
    }
  }

  async editFile(args: Record<string, unknown>): Promise<ToolResult> {
    const { filePath, lineStart, lineEnd, newContent } = args as {
      filePath: string;
      lineStart: string;
      lineEnd: string;
      newContent?: string;
    };

    try {
      // Read existing file content
      const existingContent = fs.readFileSync(filePath, "utf8");
      const lines = existingContent.split("\n");

      // Parse line numbers (convert from 1-based to 0-based indexing)
      const startLine = parseInt(lineStart, 10) - 1;
      const endLine = parseInt(lineEnd, 10) - 1;

      // Validate line numbers
      if (
        startLine < 0 ||
        endLine < 0 ||
        startLine >= lines.length ||
        endLine >= lines.length
      ) {
        return {
          content: `Error: Invalid line range. File has ${lines.length} lines, requested range: ${lineStart}-${lineEnd}`,
          isError: true,
          executedAt: new Date(),
        };
      }

      if (startLine > endLine) {
        return {
          content: `Error: Start line (${lineStart}) cannot be greater than end line (${lineEnd})`,
          isError: true,
          executedAt: new Date(),
        };
      }

      // Replace the specified line range with new content
      const contentLines = newContent ? newContent.split("\n") : [];
      const newLines = [
        ...lines.slice(0, startLine),
        ...contentLines,
        ...lines.slice(endLine + 1),
      ];

      const modifiedContent = newLines.join("\n");

      // Write modified content back to file
      fs.writeFileSync(filePath, modifiedContent, "utf8");

      // Create and update the FileNode in context tree
      const node = new FileNode(filePath, true);
      this.contextManager.currentContextTree.updateNode(filePath, node);

      return {
        content: node,
        isError: false,
        executedAt: new Date(),
      };
    } catch (error) {
      return {
        content: `Error editing file: ${(error as Error).message}`,
        isError: true,
        executedAt: new Date(),
      };
    }
  }
}
