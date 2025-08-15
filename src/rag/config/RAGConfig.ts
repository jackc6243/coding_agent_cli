type RagConfig = {
    index_folder: string;
    exclusion_list: { name: string, exclude_children: boolean }[];
};

let config: RagConfig | undefined;

function buildConfig(): RagConfig {
    const cfg: RagConfig = {
        index_folder: "./test_project",
        exclusion_list: []
    };

    // Freeze to guarantee immutability at runtime.
    return Object.freeze(cfg);
}

export function getRagConfig(): RagConfig {
    if (!config) {
        config = buildConfig();
    }
    return config;
}
