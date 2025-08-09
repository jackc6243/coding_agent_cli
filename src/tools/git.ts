import { z } from 'zod';
import { simpleGit } from 'simple-git';

export function registerGitTools(reg: any) {
  reg.register({
    name: 'git_status',
    description: 'Git status short',
    schema: z.object({}),
    execute: async (_: any, ctx: any) => {
      const git = simpleGit({ baseDir: ctx.cwd });
      const status = await git.status();
      return status;
    }
  });

  reg.register({
    name: 'git_diff',
    description: 'Git diff',
    schema: z.object({ cached: z.boolean().default(false) }),
    execute: async ({ cached }: any, ctx: any) => {
      const git = simpleGit({ baseDir: ctx.cwd });
      const diff = await git.diff([cached ? '--cached' : '']);
      return { diff: diff.slice(0, 10000) };
    }
  });

  reg.register({
    name: 'git_add',
    description: 'Git add files',
    schema: z.object({ files: z.array(z.string()) }),
    execute: async ({ files }: any, ctx: any) => {
      const git = simpleGit({ baseDir: ctx.cwd });
      await git.add(files);
      return { added: files };
    }
  });

  reg.register({
    name: 'git_commit',
    description: 'Git commit',
    schema: z.object({ message: z.string() }),
    execute: async ({ message }: any, ctx: any) => {
      const git = simpleGit({ baseDir: ctx.cwd });
      const res = await git.commit(message);
      return res;
    }
  });

  reg.register({
    name: 'git_checkout_branch',
    description: 'Checkout existing branch',
    schema: z.object({ name: z.string() }),
    execute: async ({ name }: any, ctx: any) => {
      const git = simpleGit({ baseDir: ctx.cwd });
      await git.checkout(name);
      return { checkedOut: name };
    }
  });

  reg.register({
    name: 'git_create_branch',
    description: 'Create and checkout new branch',
    schema: z.object({ name: z.string() }),
    execute: async ({ name }: any, ctx: any) => {
      const git = simpleGit({ baseDir: ctx.cwd });
      await git.checkoutLocalBranch(name);
      return { created: name };
    }
  });

  reg.register({
    name: 'git_log',
    description: 'Git log',
    schema: z.object({ max: z.number().default(10) }),
    execute: async ({ max }: any, ctx: any) => {
      const git = simpleGit({ baseDir: ctx.cwd });
      const logs = await git.log({ maxCount: max });
      return logs;
    }
  });
}
