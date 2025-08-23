import { LogLevel } from "../logging/Logger.js";

type AppConfig = {
  logging: { level: LogLevel };
  workingDirectory: string;
  indexingDirectory: string;
  indexingIgnoreList: string[];
  embedding: {
    openaiApiKey?: string;
    model: string;
    batchSize: number;
  };
  vectorStore: {
    type: "chroma";
    url: string;
    collectionName: string;
    collectionDescription: string;
  };
  systemInstructions: string;
};

let config: AppConfig | undefined;

function buildConfig(): AppConfig {
  const cfg: AppConfig = {
    logging: { level: "info" },
    workingDirectory: process.env.CHATBOT_WORKING_DIR || "./test_repo",
    indexingDirectory: ".",
    indexingIgnoreList: ["node_modules", ".git", "*.log", "dist", "build"],
    embedding: {
      openaiApiKey: process.env.OPENAI_API_KEY,
      model: process.env.EMBEDDING_MODEL || "text-embedding-3-small",
      batchSize: parseInt(process.env.EMBEDDING_BATCH_SIZE || "100", 10),
    },
    vectorStore: {
      type: "chroma",
      url: process.env.CHROMADB_URL || "http://localhost:8000",
      collectionName: process.env.CHROMADB_COLLECTION_NAME || "code_context",
      collectionDescription:
        process.env.CHROMADB_COLLECTION_DESCRIPTION ||
        "Code context chunks for RAG pipeline",
    },
    systemInstructions:
      process.env.SYSTEM_INSTRUCTIONS ||
      "You are a helpful coding assistant with access to the codebase context.",
  };

  // Validate critical configuration
  validateConfig(cfg);

  // Freeze to guarantee immutability at runtime.
  return Object.freeze(cfg);
}

function validateConfig(cfg: AppConfig): void {
  // Validate embedding batch size
  if (cfg.embedding.batchSize <= 0 || cfg.embedding.batchSize > 1000) {
    throw new Error(
      `Invalid embedding batch size: ${cfg.embedding.batchSize}. Must be between 1 and 1000.`
    );
  }

  // Validate vector store URL format
  try {
    new URL(cfg.vectorStore.url);
  } catch {
    throw new Error(
      `Invalid ChromaDB URL: ${cfg.vectorStore.url}. Must be a valid URL.`
    );
  }

  // Validate collection name format
  if (!/^[a-zA-Z0-9_-]+$/.test(cfg.vectorStore.collectionName)) {
    throw new Error(
      `Invalid collection name: ${cfg.vectorStore.collectionName}. Must contain only alphanumeric characters, underscores, and dashes.`
    );
  }
}

export function getAppConfig(): AppConfig {
  if (!config) {
    config = buildConfig();
  }
  return config;
}
