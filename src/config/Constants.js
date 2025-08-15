// Service configuration constants
export const SERVICE_CONFIG = {
    // Vector Store
    CHROMADB_DEFAULT_URL: "http://localhost:8000",
    CHROMADB_COLLECTION_NAME: "code_context",
    CHROMADB_COLLECTION_DESCRIPTION: "Code context chunks for RAG pipeline",
    // Embedding Service
    EMBEDDING_MODEL: "text-embedding-3-small",
    EMBEDDING_BATCH_SIZE: 100,
    // MCP Client
    MCP_CLIENT_VERSION: "1.0.0",
    // Weather API
    NWS_API_BASE: "https://api.weather.gov"
};
