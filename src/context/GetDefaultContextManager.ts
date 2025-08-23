import { ContextManager } from "./ContextManager.js";
import { FilePermissions } from "./FilePermissions.js";
import { TextChunker } from "../chunking/chunkingStrategies/TextChunker.js";
import { OpenAIEmbeddingService } from "../services/embedding/OpenAIEmbeddingService.js";
import { ChromaVectorStore } from "../services/vectorStore/VectorStore.js";
import { getAppConfig } from "../config/AppConfig.js";
import { FileEditToolClient } from "../tools/FileEditToolClient.js";
import { TerminalToolClient } from "../tools/TerminalToolClient.js";
import { getMCPWeatherClient } from "../mcp/clients/getWeatherClient.js";

export async function getDefaultContextManager(): Promise<ContextManager> {
  const config = getAppConfig();

  // Initialize file permissions for the working directory
  const filePermissions = new FilePermissions(config.workingDirectory);

  // Initialize chunk strategist
  const chunkStrategist = new TextChunker();

  // Initialize embedding service
  if (!config.embedding.openaiApiKey) {
    throw new Error(
      "OpenAI API key is required. Set OPENAI_API_KEY environment variable."
    );
  }
  const embeddingService = new OpenAIEmbeddingService(
    config.embedding.openaiApiKey
  );

  // Initialize vector store
  const vectorStore = new ChromaVectorStore({
    url: config.vectorStore.url,
    collectionName: config.vectorStore.collectionName,
    collectionDescription: config.vectorStore.collectionDescription,
  });

  // Initialize the vector store
  try {
    await vectorStore.initialize();
  } catch (error) {
    throw new Error(
      `Failed to initialize vector store. Ensure ChromaDB is running at ${config.vectorStore.url}. Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Create and return the context manager
  const contextManager = new ContextManager(
    config.systemInstructions,
    filePermissions,
    chunkStrategist,
    embeddingService,
    vectorStore
  );

  // Register tool clients
  contextManager.registerToolClients((cm) => new FileEditToolClient(cm));
  contextManager.registerToolClients((cm) => new TerminalToolClient(cm));
  
  // Register MCP tool clients
  contextManager.registerToolClients((cm) => getMCPWeatherClient(cm));

  return contextManager;
}
