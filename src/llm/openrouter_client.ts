import { fetch } from 'undici';
import { logger } from '../logger.js';
import type { ChatMessage } from '../types.js';

export interface OpenRouterClientOptions {
  apiKey: string;
  baseUrl?: string;
  model: string;
  referer?: string;
  title?: string;
  timeoutMs?: number;
}

export class OpenRouterClient {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private referer?: string;
  private title?: string;
  private timeoutMs: number;

  constructor(opts: OpenRouterClientOptions) {
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl || 'https://openrouter.ai/api').replace(/\/+$/, '');
    this.model = opts.model;
    this.referer = opts.referer;
    this.title = opts.title;
    this.timeoutMs = opts.timeoutMs ?? 60000;
  }

  async chat(messages: ChatMessage[], params?: { temperature?: number; maxTokens?: number }): Promise<string> {
    const body = {
      model: this.model,
      temperature: clamp(params?.temperature ?? 0.2, 0, 1),
      max_tokens: params?.maxTokens ?? 800,
      messages: messages.map((m) => ({ role: m.role, content: m.content }))
    };

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
    if (this.referer) headers['HTTP-Referer'] = this.referer;
    if (this.title) headers['X-Title'] = this.title;

    const url = `${this.baseUrl}/v1/chat/completions`;
    const res = await withRetry(async () => {
      const r = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      } as any);
      if (!r.ok) {
        const txt = await safeText(r as any);
        throw new Error(`OpenRouter error ${(r as any).status}: ${txt}`);
      }
      const data = await (r as any).json() as any;
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== 'string') {
        throw new Error('Invalid response from OpenRouter: missing content');
      }
      return content;
    }, { retries: 3, baseDelayMs: 500, timeoutMs: this.timeoutMs });

    return res;
  }
}

function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }

async function withRetry<T>(fn: () => Promise<T>, opts: { retries: number; baseDelayMs: number; timeoutMs: number }): Promise<T> {
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      return await promiseWithTimeout(fn(), opts.timeoutMs);
    } catch (e: any) {
      if (attempt > opts.retries) throw e;
      const delay = opts.baseDelayMs * Math.pow(2, attempt - 1);
      logger.warn(`LLM call failed (attempt ${attempt}): ${e?.message || e}. Retrying in ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

async function promiseWithTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: any;
  const timeout = new Promise<never>((_, rej) => { t = setTimeout(() => rej(new Error(`Timeout ${ms}ms`)), ms); });
  try {
    const res = await Promise.race([p, timeout]);
    return res as T;
  } finally {
    clearTimeout(t);
  }
}

async function safeText(r: Response): Promise<string> {
  try {
    return await (r as any).text();
  } catch {
    return `${(r as any).status} ${(r as any).statusText}`;
  }
}
