import { BaseToolClient } from "./BaseToolClient.js";
import { ToolResult } from "./types.js";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { exec } from "child_process";
import { promisify } from "util";
import { getAppConfig } from "../config/AppConfig.js";

const execAsync = promisify(exec);

export class TerminalToolClient extends BaseToolClient {
  constructor() {
    super("Terminal Commands");
    this.registerTools();
  }

  private registerTools(): void {
    const bashTool: Tool = {
      name: "bash",
      description:
        "Execute bash commands in the terminal. Use this to run shell commands, scripts, and system operations.",
      inputSchema: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The bash command to execute",
          },
          timeout: {
            type: "number",
            description: "Timeout in milliseconds (default: 30000)",
            default: 30000,
          },
          workingDirectory: {
            type: "string",
            description:
              "Working directory to execute the command in (optional)",
          },
        },
        required: ["command"],
      },
    };

    const runScriptTool: Tool = {
      name: "run_script",
      description:
        "Execute a script file (shell, python, node, etc.) based on file extension.",
      inputSchema: {
        type: "object",
        properties: {
          scriptPath: {
            type: "string",
            description: "Path to the script file to execute",
          },
          args: {
            type: "array",
            items: { type: "string" },
            description: "Arguments to pass to the script",
            default: [],
          },
          timeout: {
            type: "number",
            description: "Timeout in milliseconds (default: 60000)",
            default: 60000,
          },
        },
        required: ["scriptPath"],
      },
    };

    this.registerTool(bashTool, this.executeBashCommand.bind(this));
    this.registerTool(runScriptTool, this.executeScript.bind(this));
  }

  protected async executeBashCommand(
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const {
      command,
      timeout = 30000,
      workingDirectory,
    } = args as {
      command: string;
      timeout?: number;
      workingDirectory?: string;
    };

    this.logger.log(`Executing bash command: ${command}`, "debug");

    try {
      const options: {
        timeout: number;
        maxBuffer: number;
        cwd?: string;
      } = {
        timeout,
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
      };

      // Use provided workingDirectory, fallback to configured working directory
      const cwd = workingDirectory || getAppConfig().workingDirectory;
      options.cwd = cwd;

      const { stdout, stderr } = await execAsync(command, options);

      let content = "";
      if (stdout) content += `STDOUT:\n${stdout}`;
      if (stderr) content += `${content ? "\n\n" : ""}STDERR:\n${stderr}`;
      if (!content) content = "Command executed successfully with no output.";

      return {
        content,
        isError: false,
        executedAt: new Date(),
      };
    } catch (error: unknown) {
      const err = error as Error & { stdout?: string; stderr?: string };
      let errorContent = `Command failed: ${err.message}`;

      if (err.stdout) {
        errorContent += `\n\nSTDOUT:\n${err.stdout}`;
      }
      if (err.stderr) {
        errorContent += `\n\nSTDERR:\n${err.stderr}`;
      }

      return {
        content: errorContent,
        isError: true,
        executedAt: new Date(),
      };
    }
  }

  protected async executeScript(
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const {
      scriptPath,
      args: scriptArgs = [],
      timeout = 60000,
    } = args as {
      scriptPath: string;
      args?: string[];
      timeout?: number;
    };

    this.logger.log(
      `Executing script: ${scriptPath} with args: ${scriptArgs.join(" ")}`,
      "debug"
    );

    // Determine the interpreter based on file extension
    const extension = scriptPath.split(".").pop()?.toLowerCase();
    let interpreter: string;

    switch (extension) {
      case "sh":
      case "bash":
        interpreter = "bash";
        break;
      case "py":
        interpreter = "python";
        break;
      case "js":
        interpreter = "node";
        break;
      case "ts":
        interpreter = "npx tsx";
        break;
      default:
        // Try to execute directly (assuming it has shebang)
        interpreter = "";
    }

    const command = interpreter
      ? `${interpreter} ${scriptPath} ${scriptArgs.join(" ")}`
      : `${scriptPath} ${scriptArgs.join(" ")}`;

    return this.executeBashCommand({
      command,
      timeout,
      workingDirectory: getAppConfig().workingDirectory,
    });
  }
}

export function getTerminalClient(): TerminalToolClient {
  return new TerminalToolClient();
}
