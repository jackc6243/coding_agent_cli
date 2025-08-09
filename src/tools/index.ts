import type { ToolRegistry } from './types.js';
import { registerFsTools } from './fs.js';
import { registerExecTool } from './exec.js';
import { registerGitTools } from './git.js';
import { registerHttpTool } from './http.js';

export function registerBuiltins(reg: ToolRegistry) {
  registerFsTools(reg);
  registerExecTool(reg);
  registerGitTools(reg);
  registerHttpTool(reg);
}
