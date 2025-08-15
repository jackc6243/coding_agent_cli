import { BaseToolClient } from "../BaseToolClient.js";
import { ToolCall } from "../types.js";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { exec } from "child_process";
import { promisify } from "util";
import { getAppConfig } from "../../config/AppConfig.js";

const execAsync = promisify(exec);

export class TerminalToolClient extends BaseToolClient {
    constructor() {
        super("terminal");
        this.registerTools();
    }

    private registerTools(): void {
        const bashTool: Tool = {
            name: "bash",
            description: "Execute bash commands in the terminal. Use this to run shell commands, scripts, and system operations.",
            inputSchema: {
                type: "object",
                properties: {
                    command: {
                        type: "string",
                        description: "The bash command to execute"
                    },
                    timeout: {
                        type: "number",
                        description: "Timeout in milliseconds (default: 30000)",
                        default: 30000
                    },
                    workingDirectory: {
                        type: "string",
                        description: "Working directory to execute the command in (optional)"
                    }
                },
                required: ["command"]
            }
        };

        const runScriptTool: Tool = {
            name: "run_script",
            description: "Execute a script file (shell, python, node, etc.) based on file extension.",
            inputSchema: {
                type: "object",
                properties: {
                    scriptPath: {
                        type: "string",
                        description: "Path to the script file to execute"
                    },
                    args: {
                        type: "array",
                        items: { type: "string" },
                        description: "Arguments to pass to the script",
                        default: []
                    },
                    timeout: {
                        type: "number",
                        description: "Timeout in milliseconds (default: 60000)",
                        default: 60000
                    }
                },
                required: ["scriptPath"]
            }
        };

        this.registerTool(bashTool);
        this.registerTool(runScriptTool);
    }

    async populateToolCallResult(toolCall: ToolCall): Promise<void> {
        try {
            this.validateInputSchema(toolCall);

            switch (toolCall.toolName) {
                case "bash":
                    await this.executeBashCommand(toolCall);
                    break;
                case "run_script":
                    await this.executeScript(toolCall);
                    break;
                default:
                    throw new Error(`Unknown tool: ${toolCall.toolName}`);
            }

            this.validateOutputSchema(toolCall);
        } catch (error) {
            this.logger.log(`Error executing terminal tool: ${error}`, 'error');
            toolCall.result = {
                content: `Error: ${(error as Error).message}`,
                isError: true,
                executedAt: new Date()
            };
        }
    }

    private async executeBashCommand(toolCall: ToolCall): Promise<void> {
        const { command, timeout = 30000, workingDirectory } = toolCall.args as {
            command: string;
            timeout?: number;
            workingDirectory?: string;
        };

        this.logger.log(`Executing bash command: ${command}`, 'debug');

        try {
            const options: any = {
                timeout,
                maxBuffer: 1024 * 1024 * 10 // 10MB buffer
            };

            // Use provided workingDirectory, fallback to configured working directory
            const cwd = workingDirectory || getAppConfig().workingDirectory;
            options.cwd = cwd;

            const { stdout, stderr } = await execAsync(command, options);

            let content = '';
            if (stdout) content += `STDOUT:\n${stdout}`;
            if (stderr) content += `${content ? '\n\n' : ''}STDERR:\n${stderr}`;
            if (!content) content = 'Command executed successfully with no output.';

            toolCall.result = {
                content,
                isError: false,
                executedAt: new Date()
            };
        } catch (error: any) {
            let errorContent = `Command failed: ${error.message}`;
            
            if (error.stdout) {
                errorContent += `\n\nSTDOUT:\n${error.stdout}`;
            }
            if (error.stderr) {
                errorContent += `\n\nSTDERR:\n${error.stderr}`;
            }

            toolCall.result = {
                content: errorContent,
                isError: true,
                executedAt: new Date()
            };
        }
    }

    private async executeScript(toolCall: ToolCall): Promise<void> {
        const { scriptPath, args = [], timeout = 60000 } = toolCall.args as {
            scriptPath: string;
            args?: string[];
            timeout?: number;
        };

        this.logger.log(`Executing script: ${scriptPath} with args: ${args.join(' ')}`, 'debug');

        // Determine the interpreter based on file extension
        const extension = scriptPath.split('.').pop()?.toLowerCase();
        let interpreter: string;

        switch (extension) {
            case 'sh':
            case 'bash':
                interpreter = 'bash';
                break;
            case 'py':
                interpreter = 'python';
                break;
            case 'js':
                interpreter = 'node';
                break;
            case 'ts':
                interpreter = 'npx tsx';
                break;
            default:
                // Try to execute directly (assuming it has shebang)
                interpreter = '';
        }

        const command = interpreter ? `${interpreter} ${scriptPath} ${args.join(' ')}` : `${scriptPath} ${args.join(' ')}`;
        
        // Reuse the bash execution logic with configured working directory
        const bashToolCall = new ToolCall({
            toolName: 'bash',
            clientName: toolCall.clientName,
            args: { command, timeout, workingDirectory: getAppConfig().workingDirectory }
        });

        await this.executeBashCommand(bashToolCall);
        toolCall.result = bashToolCall.result;
    }
}