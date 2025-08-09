import { z } from 'zod';
import { fetch } from 'undici';

export function registerHttpTool(reg: any) {
  reg.register({
    name: 'http_fetch',
    description: 'HTTP fetch with method/url/headers/body',
    schema: z.object({
      method: z.string().default('GET'),
      url: z.string(),
      headers: z.record(z.string()).default({}),
      body: z.string().optional()
    }),
    execute: async ({ method, url, headers, body }: any) => {
      const res = await fetch(url, {
        method,
        headers,
        body
      } as any);
      const text = await res.text();
      const headersObj: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        headersObj[k] = k.toLowerCase() === 'authorization' ? 'REDACTED' : v;
      });
      return {
        status: res.status,
        ok: res.ok,
        headers: headersObj,
        body: text.slice(0, 10000)
      };
    }
  });
}
