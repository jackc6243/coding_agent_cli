import { ContextManager } from "./ContextManager.js";
import { FilePermissions } from "./FilePermissions.js";
import { getAppConfig } from "../config/AppConfig.js";

export async function getDefaultContextManager(): Promise<ContextManager> {
  const config = getAppConfig();

  // Initialize file permissions for the working directory
  const filePermissions = new FilePermissions(config.workingDirectory);

  // Create and return the context manager
  const contextManager = new ContextManager(
    config.systemInstructions,
    filePermissions
  );

  return contextManager;
}
