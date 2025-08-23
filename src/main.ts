#!/usr/bin/env node
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { LLM } from "./llm/llm.js";
import { ChatMessage } from "./types.js";
import { ConsoleLogger } from "./logging/ConsoleLogger.js";

import dotenv from "dotenv";
import { getDefaultContextManager } from "./context/GetDefaultContextManager.js";
dotenv.config();

const logger = new ConsoleLogger("info");

async function finishToolCalls(llm: LLM) {
  let msg = llm.getLastMessage();
  while (msg && msg.getPendingToolCalls().length > 0) {
    await llm.callTools();
    await llm.sendMessage();
    msg = llm.getLastMessage();
  }
}

async function chat() {
  const rl = readline.createInterface({ input, output });
  const ctx = await getDefaultContextManager();
  // const llm = new LLM("gemini", "gemini-2.5-flash", systemPrompt, ctx);
  const llm = new LLM("anthropic", "claude-sonnet-4-20250514", ctx);
  // const llm = new LLM("openAI", "gpt-5", systemPrompt, ctx);
  
  // Setup cleanup on process signals
  const cleanup = async () => {
    logger.log("Cleaning up resources...", "info");
    await ctx.cleanup();
    rl.close();
    process.exit(0);
  };
  
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  
  try {
    logger.log('Chat started. Type "quit" or "exit" or press Ctrl+D to quit.', "info");
    while (true) {
      const line = await rl.question("> ");
      const text = line.trim();
      if (text.toLowerCase() === "quit" || text.toLowerCase() === "exit") break;

      llm.addMessage(new ChatMessage("user", text));
      await llm.sendMessage();
      await finishToolCalls(llm);

      const reply = llm.getLastMessage();
      logger.logObject("context", llm.context, "debug");
      if (reply) {
        logger.log(reply.content, "info");
      }
    }
  } catch (error) {
    // Handle user interruption (Ctrl+C/Ctrl+D) and other errors
    if (error instanceof Error) {
      logger.log(`Chat interrupted: ${error.message}`, "warn");
    } else {
      logger.log("Chat interrupted by user", "info");
    }
  } finally {
    await ctx.cleanup();
    rl.close();
  }
}

chat().catch((e) => {
  logger.log(String(e), "error");
  process.exit(1);
});
