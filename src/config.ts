import { config as dotenvLoad } from 'dotenv';

dotenvLoad();

export interface AppConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  title?: string;
  temperature?: number;
}

export function loadConfig(overrides?: Partial<AppConfig> & { verbose?: boolean; cwd?: string }): AppConfig {
  const apiKey = process.env.OPENROUTER_API_KEY || '';
  return {
    apiKey,
    baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api',
    model: overrides?.model || process.env.OPENROUTER_MODEL || 'anthropic/claude-3.7-sonnet',
    title: process.env.OPENROUTER_TITLE || 'coding-agent-cli',
    temperature: overrides?.temperature ?? (process.env.OPENROUTER_TEMPERATURE ? Number(process.env.OPENROUTER_TEMPERATURE) : undefined)
  };
}
