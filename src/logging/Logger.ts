
export type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'success';
export interface LoggerInterface {
    logLevel: LogLevel;
    log(message: string, levelOverride?: LogLevel): void;
}