import { RetrievalSystem } from './RetrievalSystem.js';
import type { RAGConfig, RetrievalConfig, RetrievalResult } from './types.js';

export class RAG {
    private retrievalSystem: RetrievalSystem;
    private isInitialized: boolean = false;
    private config: RAGConfig;

    constructor(config: RAGConfig = {}) {
        this.config = config;
        this.retrievalSystem = new RetrievalSystem(config.openaiApiKey, {
            useSemanticChunking: config.useSemanticChunking,
            watcherConfig: config.watcherConfig
        });
    }

    /**
     * Initialize the RAG system
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        await this.retrievalSystem.initialize();
        
        // Start file watching if enabled
        if (this.config.enableFileWatching) {
            await this.startFileWatching();
        }
        
        this.isInitialized = true;
    }

    /**
     * Index the codebase for retrieval
     * @param force - Whether to force reindexing even if already indexed
     */
    async indexCodebase(force: boolean = false): Promise<void> {
        this.ensureInitialized();
        await this.retrievalSystem.indexCodebase(force);
    }

    /**
     * Retrieve relevant context for a query
     * @param query - The search query
     * @param config - Retrieval configuration options
     */
    async retrieve(query: string, config?: RetrievalConfig): Promise<RetrievalResult> {
        this.ensureInitialized();
        return await this.retrievalSystem.retrieve(query, config);
    }

    /**
     * Get formatted results as a string
     * @param query - The search query
     * @param config - Retrieval configuration options
     */
    async getFormattedResults(query: string, config?: RetrievalConfig): Promise<string> {
        const results = await this.retrieve(query, config);
        return this.retrievalSystem.formatResults(results);
    }

    /**
     * Get system statistics
     */
    async getStats(): Promise<{
        isIndexed: boolean;
        vectorStore: { count: number; collections: string[] };
    }> {
        this.ensureInitialized();
        return await this.retrievalSystem.getStats();
    }

    /**
     * Get enhanced statistics including semantic chunking and file watching info
     */
    async getEnhancedStats() {
        this.ensureInitialized();
        return await this.retrievalSystem.getEnhancedStats();
    }

    /**
     * Start file watching for automatic updates
     */
    async startFileWatching(rootPath?: string): Promise<void> {
        this.ensureInitialized();
        await this.retrievalSystem.startFileWatching(rootPath, this.config.watcherConfig);
    }

    /**
     * Stop file watching
     */
    async stopFileWatching(): Promise<void> {
        this.ensureInitialized();
        await this.retrievalSystem.stopFileWatching();
    }

    /**
     * Manually update a specific file
     */
    async updateFile(filePath: string): Promise<void> {
        this.ensureInitialized();
        await this.retrievalSystem.updateFile(filePath);
    }

    /**
     * Close the RAG system and clean up resources
     */
    async close(): Promise<void> {
        if (this.isInitialized) {
            await this.retrievalSystem.close();
            this.isInitialized = false;
        }
    }

    private ensureInitialized(): void {
        if (!this.isInitialized) {
            throw new Error('RAG system not initialized. Call initialize() first.');
        }
    }
}

// Export main types for convenience
export type { RAGConfig, RetrievalConfig, RetrievalResult, QueryResult, Chunk, EmbeddedChunk } from './types.js';