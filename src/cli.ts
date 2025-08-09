#!/usr/bin/env node
import { Command } from 'commander';
import { loadConfig } from './config.js';
import { OpenRouterClient } from './llm/openrouter_client.js';
import { createToolRegistry } from './tools/types.js';
import { registerBuiltins } from './tools/index.js';
import { runAgentLoop } from './agent/loop.js';
import { logger } from './logger.js';
import { resolveCwd } from './utils/paths.js';

const program = new Command();
program
  .name('agent')
  .description('Coding agent CLI powered by OpenRouter')
  .version('0.1.0');

program
  .command('run')
  .argument('<goal...>', 'Goal or instruction for the agent')
  .option('--model <model>', 'OpenRouter model slug')
  .option('--max-steps <n>', 'Maximum steps to run', (v) => parseInt(v, 10), 15)
  .option('--cwd <path>', 'Working directory', process.cwd())
  .option('--dry-run', 'Do not execute tools, just show planned actions', false)
  .option('--verbose', 'Verbose logging', false)
  .option('--temperature <t>', 'Sampling temperature', (v) => parseFloat(v), 0.2)
  .action(async (goalParts, opts) => {
    const goal = goalParts.join(' ');
    const cwd = resolveCwd(opts.cwd);
    const cfg = loadConfig({
      model: opts.model,
      temperature: opts.temperature,
      verbose: opts.verbose,
      cwd
    });
    if (!cfg.apiKey) {
      logger.error('Missing OPENROUTER_API_KEY. Set it in your environment or .env file.');
      process.exit(1);
    }
    const llm = new OpenRouterClient({
      apiKey: cfg.apiKey,
      baseUrl: cfg.baseUrl,
      model: cfg.model,
      referer: cfg.referer,
      title: cfg.title,
      timeoutMs: 60000
    });
    const registry = createToolRegistry({ cwd, dryRun: !!opts.dryRun, verbose: !!opts.verbose });
    registerBuiltins(registry);
    if (opts.verbose) {
      logger.info(`Model: ${cfg.model}`);
      logger.info(`CWD: ${cwd}`);
    }
    const result = await runAgentLoop({
      goal,
      llm,
      registry,
      maxSteps: opts.maxSteps,
      temperature: cfg.temperature ?? 0.2,
      verbose: !!opts.verbose
    });
    if (result.type === 'final') {
      logger.success(result.text);
      process.exit(0);
    } else {
      logger.error(`Exited without final answer: ${result.reason}`);
      process.exit(1);
    }
  });

program.parseAsync(process.argv).catch((err) => {
  logger.error(err?.stack || String(err));
  process.exit(1);
});
