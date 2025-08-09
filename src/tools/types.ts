import { z } from 'zod';
import { logger } from '../logger.js';

export interface ToolContext {
  cwd: string;
  dryRun: boolean;
  verbose: boolean;
}

export interface Tool {
  name: string;
  description: string;
  schema: z.ZodTypeAny;
  execute: (args: any, ctx: ToolContext) => Promise<any>;
}

export class ToolRegistry {
  private tools = new Map<string, Tool>();
  public ctx: ToolContext;
  constructor(ctx: ToolContext) { this.ctx = ctx; }
  register(tool: Tool) {
    if (this.tools.has(tool.name)) throw new Error(`Tool already registered: ${tool.name}`);
    this.tools.set(tool.name, tool);
  }
  list(): Tool[] { return [...this.tools.values()]; }
  describeTools(): string {
    return this.list().map(t => `- ${t.name}: ${t.description}`).join('\n');
  }
  async execute(name: string, args: any): Promise<{ ok: boolean; data?: any; error?: string }> {
    const tool = this.tools.get(name);
    if (!tool) return { ok: false, error: `Unknown tool: ${name}` };
    const parsed = tool.schema.safeParse(args ?? {});
    if (!parsed.success) return { ok: false, error: `Invalid arguments: ${parsed.error.message}` };
    if (this.ctx.dryRun) return { ok: true, data: { dryRun: true, tool: name, args: parsed.data } };
    try {
      const res = await tool.execute(parsed.data, this.ctx);
      if (this.ctx.verbose) logger.info(`${name} executed`);
      return { ok: true, data: res };
    } catch (e: any) {
      return { ok: false, error: e?.message || String(e) };
    }
  }
}

export function createToolRegistry(ctx: ToolContext) {
  return new ToolRegistry(ctx);
}