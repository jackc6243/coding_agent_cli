import { z } from 'zod';
import { promises as fs } from 'fs';
import path from 'path';
import fg from 'fast-glob';
import { createTwoFilesPatch, applyPatch } from 'diff';

function ensureWithin(cwd: string, maybe: string) {
  const p = path.resolve(cwd, maybe);
  if (!p.startsWith(path.resolve(cwd))) throw new Error(`Path escapes cwd: ${maybe}`);
  return p;
}

export function registerFsTools(reg: any) {
  reg.register({
    name: 'read_file',
    description: 'Read a file and return its content',
    schema: z.object({ path: z.string() }),
    execute: async ({ path: rel }: { path: string }, ctx: any) => {
      const p = ensureWithin(ctx.cwd, rel);
      const txt = await fs.readFile(p, 'utf8');
      return { path: rel, content: txt };
    }
  });

  reg.register({
    name: 'write_file',
    description: 'Write content to a file (overwrite or create)',
    schema: z.object({ path: z.string(), content: z.string() }),
    execute: async ({ path: rel, content }: { path: string; content: string }, ctx: any) => {
      const p = ensureWithin(ctx.cwd, rel);
      await fs.mkdir(path.dirname(p), { recursive: true });
      await fs.writeFile(p, content, 'utf8');
      return { path: rel, bytes: Buffer.byteLength(content) };
    }
  });

  reg.register({
    name: 'append_file',
    description: 'Append content to a file (create if missing)',
    schema: z.object({ path: z.string(), content: z.string() }),
    execute: async ({ path: rel, content }: { path: string; content: string }, ctx: any) => {
      const p = ensureWithin(ctx.cwd, rel);
      await fs.mkdir(path.dirname(p), { recursive: true });
      await fs.appendFile(p, content, 'utf8');
      return { path: rel, bytes: Buffer.byteLength(content) };
    }
  });

  reg.register({
    name: 'make_dirs',
    description: 'Create directories recursively',
    schema: z.object({ path: z.string() }),
    execute: async ({ path: rel }: { path: string }, ctx: any) => {
      const p = ensureWithin(ctx.cwd, rel);
      await fs.mkdir(p, { recursive: true });
      return { path: rel, ok: true };
    }
  });

  reg.register({
    name: 'list_files',
    description: 'List files by glob pattern',
    schema: z.object({ pattern: z.string().default('**/*'), dot: z.boolean().default(false) }),
    execute: async ({ pattern, dot }: { pattern: string; dot: boolean }, ctx: any) => {
      const entries = await fg(pattern, { cwd: ctx.cwd, dot });
      return { files: entries };
    }
  });

  reg.register({
    name: 'search_files',
    description: 'Regex search across files',
    schema: z.object({ pattern: z.string().default('**/*'), regex: z.string(), flags: z.string().default('') }),
    execute: async ({ pattern, regex, flags }: { pattern: string; regex: string; flags: string }, ctx: any) => {
      const files = await fg(pattern, { cwd: ctx.cwd, dot: false, onlyFiles: true });
      const re = new RegExp(regex, flags);
      const results: any[] = [];
      for (const f of files) {
        const p = path.join(ctx.cwd, f);
        const txt = await fs.readFile(p, 'utf8').catch(() => '');
        if (!txt) continue;
        if (re.test(txt)) {
          const lines = txt.split('\n');
          const matches: any[] = [];
          lines.forEach((line, i) => {
            if (re.test(line)) {
              const start = Math.max(0, i - 2);
              const end = Math.min(lines.length, i + 3);
              matches.push({ line: i + 1, context: lines.slice(start, end).join('\n') });
            }
          });
          results.push({ file: f, matches });
        }
      }
      return { results };
    }
  });

  reg.register({
    name: 'search_and_replace',
    description: 'Regex search and replace in a single file',
    schema: z.object({ path: z.string(), search: z.string(), replace: z.string(), flags: z.string().default('g') }),
    execute: async ({ path: rel, search, replace, flags }: any, ctx: any) => {
      const p = ensureWithin(ctx.cwd, rel);
      const before = await fs.readFile(p, 'utf8');
      const re = new RegExp(search, flags);
      const after = before.replace(re, replace);
      await fs.writeFile(p, after, 'utf8');
      const patch = createTwoFilesPatch(rel, rel, before, after);
      return { path: rel, changed: before !== after, patch };
    }
  });

  reg.register({
    name: 'apply_diff',
    description: 'Apply a unified diff to a file',
    schema: z.object({ path: z.string(), unified_diff: z.string() }),
    execute: async ({ path: rel, unified_diff }: any, ctx: any) => {
      const p = ensureWithin(ctx.cwd, rel);
      const before = await fs.readFile(p, 'utf8');
      const after = applyPatch(before, unified_diff);
      if (after === false) throw new Error('Failed to apply patch');
      await fs.writeFile(p, String(after), 'utf8');
      return { path: rel, ok: true };
    }
  });
}
