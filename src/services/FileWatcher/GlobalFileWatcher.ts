import { getAppConfig } from "../../config/AppConfig.js";
import { FilePermissions } from "../../context/FilePermissions.js";
import { FileWatcherService } from "./FileWatcherService.js";

const appConfig = getAppConfig();
export const GlobalFileWatcher = new FileWatcherService(
  new FilePermissions(appConfig.indexingDirectory),
  {
    excludePatterns: [
      "**/node_modules/**",
      "**/.git/**",
      "**/dist/**",
      "**/build/**",
      "**/.next/**",
      "**/coverage/**",
      ...appConfig.indexingIgnoreList,
    ],
    includeExtensions: [
      ".js",
      ".jsx",
      ".ts",
      ".tsx",
      ".py",
      ".java",
      ".cpp",
      ".c",
      ".h",
      ".go",
      ".rs",
      ".php",
      ".rb",
      ".swift",
      ".kt",
      ".scala",
      ".cs",
      ".dart",
      ".md",
      ".txt",
      ".json",
      ".yaml",
      ".yml",
    ],
    debounceMs: 500,
    interval: 1000,
    binaryInterval: 3000,
    usePolling: false,
    ignoreInitial: false,
  }
);
