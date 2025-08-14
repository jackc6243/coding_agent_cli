import { LogLevel } from "../logging/Logger.js";

type AppConfig = {
    logging: { level: LogLevel };
};

let config: AppConfig | undefined;

function buildConfig(): AppConfig {
    const cfg: AppConfig = {
        logging: { level: "info" },
    };

    // Freeze to guarantee immutability at runtime.
    return Object.freeze(cfg);
}

export function getConfig(): AppConfig {
    if (!config) {
        config = buildConfig();
    }
    return config;
}
