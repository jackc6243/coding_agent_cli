import { SYSTEM_PROMPT } from './prompt.js';
import { ChatMessage } from '../types.js';
import { parseAssistantResponse } from './protocol.js';
import { logger } from '../logger.js';
import type { OpenRouterClient } from '../llm/openrouter_client.js';
import type { ToolRegistry } from '../tools/types.js';

export interface AgentLoopOptions {
  goal: string;
  llm: OpenRouterClient;
  registry: ToolRegistry;
  maxSteps: number;
  temperature: number;
  verbose: boolean;
}

export async function runAgentLoop(opts: AgentLoopOptions): Promise<{ type: 'final'; text: string } | { type: 'exit'; reason: string }> {
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT + '\n\nAvailable tools:\n' + opts.registry.describeTools() },
    { role: 'user', content: `Goal: ${opts.goal}\nWork in directory: ${opts.registry.ctx.cwd}` }
  ];

  for (let step = 1; step <= opts.maxSteps; step++) {
    if (opts.verbose) logger.info(`Step ${step}/${opts.maxSteps} -> calling model`);
    const reply = await opts.llm.chat(messages, { temperature: opts.temperature });
    if (opts.verbose) logger.debug(`Model raw: ${reply}`);
    const parsed = parseAssistantResponse(reply);
    if (parsed.type === 'final') {
      return { type: 'final', text: parsed.answer };
    }
    if (parsed.type === 'tool') {
      const { tool, arguments: args } = parsed.call;
      const exec = await opts.registry.execute(tool, args);
      const obs = JSON.stringify(exec).slice(0, 8000);
      messages.push({ role: 'assistant', content: reply });
      messages.push({ role: 'user', content: `Observation for tool ${tool}: ${obs}` });
      continue;
    }
    // invalid
    messages.push({ role: 'assistant', content: reply });
    messages.push({ role: 'user', content: `Your previous reply was invalid: ${parsed.error}. Please respond with a valid JSON object per the protocol.` });
  }
  return { type: 'exit', reason: 'Step budget exceeded' };
}
