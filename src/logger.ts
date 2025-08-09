import chalk from 'chalk';

const redact = (s: string) => s.replace(/sk-or-[A-Za-z0-9-_]{10,}/g, 'sk-or-REDACTED');

function log(level: 'info' | 'warn' | 'error' | 'debug' | 'success', msg: string) {
  const ts = new Date().toISOString();
  const out = `[${ts}] ${level.toUpperCase()} ${msg}`;
  switch (level) {
    case 'info': console.log(chalk.cyan(out)); break;
    case 'warn': console.warn(chalk.yellow(out)); break;
    case 'error': console.error(chalk.red(out)); break;
    case 'debug': console.log(chalk.gray(out)); break;
    case 'success': console.log(chalk.green(out)); break;
  }
}

export const logger = {
  info: (m: string) => log('info', redact(m)),
  warn: (m: string) => log('warn', redact(m)),
  error: (m: string) => log('error', redact(m)),
  debug: (m: string) => log('debug', redact(m)),
  success: (m: string) => log('success', redact(m))
};