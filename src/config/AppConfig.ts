import { LogLevel } from "../logging/Logger.js";

type AppConfig = {
    logging: { level: LogLevel };
    workingDirectory: string;
    indexingDirectory : string;
    indexingIgnoreList : string[];
};

let config: AppConfig | undefined;

function buildConfig(): AppConfig {
    const cfg: AppConfig = {
        logging: { level: "debug" },
        workingDirectory: process.env.CHATBOT_WORKING_DIR || ".",
        indexingDirectory : ".",
        indexingIgnoreList : []
    };

    // Freeze to guarantee immutability at runtime.
    return Object.freeze(cfg);
}

export function getAppConfig(): AppConfig {
    if (!config) {
        config = buildConfig();
    }
    return config;
}
