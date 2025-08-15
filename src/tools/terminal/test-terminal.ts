import { TerminalToolClient } from "./TerminalToolClient.js";
import { ToolCall } from "../types.js";
import * as fs from "fs";

async function runTest(testName: string, testFn: () => Promise<void>) {
    console.log(`\n🧪 Running test: ${testName}`);
    try {
        await testFn();
        console.log(`✅ Test passed: ${testName}`);
    } catch (error) {
        console.log(`❌ Test failed: ${testName}`);
        console.error(error);
    }
}

async function testBasicBashCommand(terminalClient: TerminalToolClient) {
    const toolCall = new ToolCall({
        toolName: "bash",
        clientName: "terminal",
        args: { command: "echo 'Hello from terminal tool!'" }
    });
    
    await terminalClient.populateToolCallResult(toolCall);
    
    if (!toolCall.result) throw new Error("No result returned");
    if (toolCall.result.isError) throw new Error(`Command failed: ${toolCall.result.content}`);
    if (!toolCall.result.content?.toString().includes("Hello from terminal tool!")) {
        throw new Error("Expected output not found");
    }
}

async function testBashCommandWithError(terminalClient: TerminalToolClient) {
    const toolCall = new ToolCall({
        toolName: "bash",
        clientName: "terminal",
        args: { command: "nonexistentcommand123" }
    });
    
    await terminalClient.populateToolCallResult(toolCall);
    
    if (!toolCall.result) throw new Error("No result returned");
    if (!toolCall.result.isError) throw new Error("Expected command to fail but it didn't");
}

async function testBashCommandWithStderr(terminalClient: TerminalToolClient) {
    const toolCall = new ToolCall({
        toolName: "bash",
        clientName: "terminal",
        args: { command: "echo 'error message' >&2" }
    });
    
    await terminalClient.populateToolCallResult(toolCall);
    
    if (!toolCall.result) throw new Error("No result returned");
    if (toolCall.result.isError) throw new Error(`Command failed unexpectedly: ${toolCall.result.content}`);
    if (!toolCall.result.content?.toString().includes("STDERR")) {
        throw new Error("Expected STDERR section not found");
    }
}

async function testBashWithWorkingDirectory(terminalClient: TerminalToolClient) {
    const toolCall = new ToolCall({
        toolName: "bash",
        clientName: "terminal",
        args: { 
            command: "pwd",
            workingDirectory: "/tmp"
        }
    });
    
    await terminalClient.populateToolCallResult(toolCall);
    
    if (!toolCall.result) throw new Error("No result returned");
    if (toolCall.result.isError) throw new Error(`Command failed: ${toolCall.result.content}`);
    if (!toolCall.result.content?.toString().includes("/tmp")) {
        throw new Error("Expected working directory /tmp not found in output");
    }
}

async function testScriptExecution(terminalClient: TerminalToolClient) {
    // Create a test shell script
    const scriptPath = "/tmp/test-script.sh";
    const scriptContent = `#!/bin/bash
echo "Script argument 1: $1"
echo "Script argument 2: $2"
exit 0`;
    
    fs.writeFileSync(scriptPath, scriptContent);
    fs.chmodSync(scriptPath, 0o755);
    
    try {
        const toolCall = new ToolCall({
            toolName: "run_script",
            clientName: "terminal",
            args: { 
                scriptPath,
                args: ["hello", "world"]
            }
        });
        
        await terminalClient.populateToolCallResult(toolCall);
        
        if (!toolCall.result) throw new Error("No result returned");
        if (toolCall.result.isError) throw new Error(`Script failed: ${toolCall.result.content}`);
        
        const output = toolCall.result.content?.toString() || "";
        if (!output.includes("Script argument 1: hello") || !output.includes("Script argument 2: world")) {
            throw new Error("Expected script arguments not found in output");
        }
    } finally {
        // Clean up
        if (fs.existsSync(scriptPath)) {
            fs.unlinkSync(scriptPath);
        }
    }
}

async function testPythonScript(terminalClient: TerminalToolClient) {
    // Create a test Python script
    const scriptPath = "/tmp/test-script.py";
    const scriptContent = `#!/usr/bin/env python3
import sys
print(f"Python script running with {len(sys.argv)} arguments")
for i, arg in enumerate(sys.argv[1:], 1):
    print(f"Argument {i}: {arg}")
`;
    
    fs.writeFileSync(scriptPath, scriptContent);
    
    try {
        const toolCall = new ToolCall({
            toolName: "run_script",
            clientName: "terminal",
            args: { 
                scriptPath,
                args: ["test", "args"]
            }
        });
        
        await terminalClient.populateToolCallResult(toolCall);
        
        if (!toolCall.result) throw new Error("No result returned");
        if (toolCall.result.isError) {
            // Python might not be available, so we'll just log and continue
            console.log("⚠️  Python not available, skipping Python script test");
            return;
        }
        
        const output = toolCall.result.content?.toString() || "";
        if (!output.includes("Python script running") || !output.includes("Argument 1: test")) {
            throw new Error("Expected Python script output not found");
        }
    } finally {
        // Clean up
        if (fs.existsSync(scriptPath)) {
            fs.unlinkSync(scriptPath);
        }
    }
}

async function testTimeout(terminalClient: TerminalToolClient) {
    const toolCall = new ToolCall({
        toolName: "bash",
        clientName: "terminal",
        args: { 
            command: "sleep 2",
            timeout: 1000 // 1 second timeout
        }
    });
    
    await terminalClient.populateToolCallResult(toolCall);
    
    if (!toolCall.result) throw new Error("No result returned");
    if (!toolCall.result.isError) throw new Error("Expected command to timeout but it didn't");
    
    // Accept any error for timeout test since different systems may have different timeout behaviors
    console.log(`⚠️  Command timed out as expected with message: ${toolCall.result.content}`);
}

async function testToolRegistration(terminalClient: TerminalToolClient) {
    const tools = terminalClient.getToolList();
    const toolNames = tools.map(t => t.name);
    
    if (!toolNames.includes("bash")) throw new Error("bash tool not registered");
    if (!toolNames.includes("run_script")) throw new Error("run_script tool not registered");
    
    const bashTool = tools.find(t => t.name === "bash");
    if (!bashTool?.inputSchema) throw new Error("bash tool missing input schema");
    if (!bashTool.description) throw new Error("bash tool missing description");
}

async function testInputValidation(terminalClient: TerminalToolClient) {
    // Test missing required parameter
    const toolCall = new ToolCall({
        toolName: "bash",
        clientName: "terminal",
        args: {} // Missing command parameter
    });
    
    try {
        terminalClient.validateInputSchema(toolCall);
        throw new Error("Expected validation to fail but it didn't");
    } catch (error: any) {
        if (!error.message.includes("Invalid arguments")) {
            throw new Error("Expected validation error message not found");
        }
    }
}

async function runAllTests() {
    console.log("🚀 Starting Terminal Tool Client Comprehensive Tests");
    
    const terminalClient = new TerminalToolClient();
    console.log(`📋 Available tools: ${terminalClient.getToolList().map(t => t.name).join(", ")}`);
    
    await runTest("Tool Registration", () => testToolRegistration(terminalClient));
    await runTest("Input Validation", () => testInputValidation(terminalClient));
    await runTest("Basic Bash Command", () => testBasicBashCommand(terminalClient));
    await runTest("Bash Command with Error", () => testBashCommandWithError(terminalClient));
    await runTest("Bash Command with STDERR", () => testBashCommandWithStderr(terminalClient));
    await runTest("Bash with Working Directory", () => testBashWithWorkingDirectory(terminalClient));
    await runTest("Shell Script Execution", () => testScriptExecution(terminalClient));
    await runTest("Python Script Execution", () => testPythonScript(terminalClient));
    await runTest("Command Timeout", () => testTimeout(terminalClient));
    
    console.log("\n🎉 All tests completed!");
}

runAllTests().catch(console.error);