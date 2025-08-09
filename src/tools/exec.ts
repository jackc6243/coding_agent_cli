import { z } from 'zod';
import { execa } from 'execa';

export function registerExecTool(reg: any) {
  reg.register({
    name: 'exec_shell',
    description: 'Execute a shell command in cwd',
    schema: z.object({ command: z.string(), timeoutMs: z.number().optional() }),
    execute: async ({ command, timeoutMs }: { command: string; timeoutMs?: number }, ctx: any) => {
      const subprocess = execa(command, {
        shell: true,
        cwd: ctx.cwd,
        timeout: timeoutMs ?? 120000
      });
      const { stdout, stderr, exitCode } = await subprocess;
      return { exitCode, stdout: stdout?.slice(0, 8000), stderr: stderr?.slice(0, 8000) };
    }
  });
}
