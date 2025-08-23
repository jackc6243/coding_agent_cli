// System prompts configuration
export const SYSTEM_PROMPTS = {
  DEFAULT_AGENT: "You are a helpful agent.",
  CODING_ASSISTANT:
    "You are a helpful AI coding assistant. Use the provided code context to answer questions.",
  CODE_REVIEWER:
    "You are an expert code reviewer. Focus on security and performance.",
  FULL_STACK_ASSISTANT: "You are a full-stack development assistant.",
  HELPFUL_CODING_ASSISTANT:
    "You are a helpful coding assistant. Answer questions based on the codebase context.",
} as const;

// Code context keywords for automatic context retrieval
export const CODE_CONTEXT_KEYWORDS = [
  "api",
  "endpoint",
  "database",
  "model",
  "controller",
  "service",
  "util",
  "auth",
  "authentication",
  "authorization",
  "login",
  "user",
  "session",
  "error",
  "exception",
  "validation",
  "security",
  "config",
  "settings",
] as const;
