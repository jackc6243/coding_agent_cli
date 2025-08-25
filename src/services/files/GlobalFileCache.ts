import { FileCache } from "./FileCache.js";
import { FilePermissions } from "../../context/FilePermissions.js";
import { getAppConfig } from "../../config/AppConfig.js";

const config = getAppConfig();
const globalFilePermissions = new FilePermissions(config.workingDirectory);
export const GlobalFileCache = new FileCache(globalFilePermissions);