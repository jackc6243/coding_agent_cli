import chalk from 'chalk';
import { LoggerInterface, LogLevel } from './Logger.js';

const redact = (s: string) => s.replace(/sk-or-[A-Za-z0-9-_]{10,}/g, 'sk-or-REDACTED');

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  success: 1,
  warn: 2,
  error: 3
};

export class ConsoleLogger implements LoggerInterface {
  logLevel: LogLevel;
  constructor(level: LogLevel) {
    this.logLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.logLevel];
  }

  log(msg: string, level: LogLevel = this.logLevel) {
    if (!this.shouldLog(level)) return;
    
    const ts = new Date().toISOString();
    msg = redact(msg);
    const out = `[${ts}] ${level.toUpperCase()} ${msg}`;
    switch (level) {
      case 'info': console.log(chalk.cyan(out)); break;
      case 'warn': console.warn(chalk.yellow(out)); break;
      case 'error': console.error(chalk.red(out)); break;
      case 'debug': console.log(chalk.gray(out)); break;
      case 'success': console.log(chalk.green(out)); break;
    }
  }

  logObject(label: string, obj: any, level: LogLevel = this.logLevel) {
    if (!this.shouldLog(level)) return;
    
    const ts = new Date().toISOString();
    const objStr = JSON.stringify(obj, null, 2);
    const redactedStr = redact(objStr);
    const out = `[${ts}] ${level.toUpperCase()} ${label}:\n${redactedStr}`;
    switch (level) {
      case 'info': console.log(chalk.cyan(out)); break;
      case 'warn': console.warn(chalk.yellow(out)); break;
      case 'error': console.error(chalk.red(out)); break;
      case 'debug': console.log(chalk.gray(out)); break;
      case 'success': console.log(chalk.green(out)); break;
    }
  }

}