import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { LLM } from './llm/llm.js';
import { ChatMessage } from './types.js';

import dotenv from 'dotenv';
import { getDefaultAllContext } from './context/defaultAllContext.js';
dotenv.config();

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
    const systemPrompt = "You are a helpful agent.";
    // const llm = new LLM("gemini", "gemini-2.5-flash", systemPrompt);
    const ctx = getDefaultAllContext();
    // const llm = new LLM("anthropic", "claude-sonnet-4-20250514", systemPrompt, ctx);
    const llm = new LLM("openAI", "gpt-5", systemPrompt, ctx);
    try {
        console.log('Chat started. Type "exit" or press Ctrl+D to quit.');
        while (true) {
            const line = await rl.question('> ');
            const text = line.trim();
            if (text.toLowerCase() === 'quit') break;

            llm.addMessage(new ChatMessage("user", text));
            const assistantMessage = await llm.sendMessage();
            await finishToolCalls(llm);

            const reply = llm.getLastMessage();
            console.log("context:\n", llm.context);
            if (reply) {
                console.log(reply.content);
            }
        }
    } catch {
        // If user hits Ctrl+C/Ctrl+D, question() rejects or input closes, handle as needed[1][15].
        // You can detect AbortSignal or handle close events if desired.
    } finally {
        rl.close();
    }
}

chat().catch((e) => {
    console.error(e);
    process.exit(1);
});
