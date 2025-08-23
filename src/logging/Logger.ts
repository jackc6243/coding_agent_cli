export type LogLevel = "info" | "warn" | "error" | "debug" | "success";
export interface LoggerInterface {
  logLevel: LogLevel;
  log(message: string, levelOverride?: LogLevel): void;
  logObject(label: string, obj: never, levelOverride?: LogLevel): void;
}
