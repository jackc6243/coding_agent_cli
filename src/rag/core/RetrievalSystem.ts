import { FileBrowser } from '../services/FileBrowser.js';
import { TextChunker } from '../chunking/TextChunker.js';
import { SemanticChunker } from '../chunking/SemanticChunker.js';
import { FileWatcher, FileChangeEvent } from '../ast/FileWatcher.js';
import { EmbeddingService } from '../services/EmbeddingService.js';
import { VectorStore } from '../services/VectorStore.js';
import { FILE_PATTERNS } from '../../config/FilePatterns.js';
import type { 
    RetrievalConfig, 
    RetrievalResult, 
    QueryResult, 
    WatcherConfig,
    Chunk, 
    EmbeddedChunk,
    SemanticChunk,
    FileInfo 
} from './types.js';

// Types are now imported from ./types.js

export class RetrievalSystem {
    private fileBrowser: FileBrowser;
    private textChunker: TextChunker;
    private semanticChunker: SemanticChunker;
    private fileWatcher?: FileWatcher;
    private embeddingService: EmbeddingService;
    private vectorStore: VectorStore;
    private isIndexed: boolean = false;
    private useSemanticChunking: boolean = true;
    private watcherConfig?: WatcherConfig;

    constructor(openaiApiKey?: string, config?: { useSemanticChunking?: boolean; watcherConfig?: WatcherConfig }) {
        this.fileBrowser = new FileBrowser();
        this.textChunker = new TextChunker();
        this.semanticChunker = new SemanticChunker();
        this.embeddingService = new EmbeddingService(openaiApiKey);
        this.vectorStore = new VectorStore();
        this.useSemanticChunking = config?.useSemanticChunking ?? true;
        this.watcherConfig = config?.watcherConfig;
    }

    async initialize(): Promise<void> {
        console.log('Initializing RAG retrieval system...');
        await this.vectorStore.initialize();
        
        if (this.useSemanticChunking) {
            await this.semanticChunker.initialize();
            console.log('Semantic chunker initialized');
        }
        
        console.log('RAG retrieval system initialized');
    }

    async indexCodebase(force: boolean = false): Promise<void> {
        if (this.isIndexed && !force) {
            console.log('Codebase already indexed. Use force=true to reindex.');
            return;
        }

        console.log('Starting codebase indexing...');
        const startTime = Date.now();

        try {
            // Step 1: Browse files
            console.log('1. Scanning files...');
            const files = await this.fileBrowser.browseFiles();
            console.log(`Found ${files.length} files to process`);

            // Step 2: Chunk files
            console.log('2. Chunking files...');
            const allChunks: (Chunk | SemanticChunk)[] = [];
            
            for (const file of files) {
                if (this.useSemanticChunking) {
                    try {
                        const semanticChunks = await this.semanticChunker.chunkFile(
                            file.path, 
                            file.content, 
                            file.extension
                        );
                        allChunks.push(...semanticChunks);
                    } catch (error) {
                        console.warn(`Failed to semantically chunk ${file.path}, falling back to text chunking:`, error);
                        const textChunks = this.textChunker.chunkFile(
                            file.path, 
                            file.content, 
                            file.extension
                        );
                        allChunks.push(...textChunks);
                    }
                } else {
                    const chunks = this.textChunker.chunkFile(
                        file.path, 
                        file.content, 
                        file.extension
                    );
                    allChunks.push(...chunks);
                }
            }
            
            console.log(`Created ${allChunks.length} chunks`);

            if (allChunks.length === 0) {
                console.log('No chunks to index');
                return;
            }

            // Step 3: Generate embeddings
            console.log('3. Generating embeddings...');
            const embeddedChunks = await this.embeddingService.embedChunks(allChunks);

            // Step 4: Store in vector database
            console.log('4. Storing in vector database...');
            if (force) {
                await this.vectorStore.clear();
            }
            await this.vectorStore.storeChunks(embeddedChunks);

            this.isIndexed = true;
            const endTime = Date.now();
            const duration = (endTime - startTime) / 1000;
            
            console.log(`Indexing completed in ${duration.toFixed(2)}s`);
            console.log(`Processed ${files.length} files, created ${allChunks.length} chunks`);
        } catch (error) {
            console.error('Failed to index codebase:', error);
            throw error;
        }
    }

    async retrieve(
        query: string, 
        config: RetrievalConfig = {}
    ): Promise<RetrievalResult> {
        if (!this.isIndexed) {
            throw new Error('Codebase not indexed. Call indexCodebase() first.');
        }

        const startTime = Date.now();
        const {
            topK = 10,
            minScore = 0.1,
            includeMetadata = true,
            includeCode = true,
            includeComments = true
        } = config;

        try {
            // Generate query embedding
            const queryEmbedding = await this.embeddingService.embedQuery(query);

            // Search vector store
            const rawResults = await this.vectorStore.query(queryEmbedding, topK * 2);

            // Filter and enhance results
            let filteredResults = rawResults.filter(result => result.score >= minScore);

            // Apply content type filters
            if (!includeCode) {
                filteredResults = filteredResults.filter(r => 
                    !['function', 'class', 'interface', 'variable'].includes(r.chunk.type)
                );
            }

            if (!includeComments) {
                filteredResults = filteredResults.filter(r => r.chunk.type !== 'comment');
            }

            // Enhance metadata if requested
            if (includeMetadata) {
                filteredResults = this.enhanceResultsWithContext(filteredResults);
            }

            // Limit to requested count
            filteredResults = filteredResults.slice(0, topK);

            const endTime = Date.now();
            const processingTime = endTime - startTime;

            return {
                query,
                results: filteredResults,
                totalChunks: rawResults.length,
                processingTime
            };
        } catch (error) {
            console.error('Failed to retrieve context:', error);
            throw error;
        }
    }

    private enhanceResultsWithContext(results: QueryResult[]): QueryResult[] {
        // Group results by file to provide better context
        const fileGroups = new Map<string, QueryResult[]>();
        
        for (const result of results) {
            const filePath = result.chunk.filePath;
            if (!fileGroups.has(filePath)) {
                fileGroups.set(filePath, []);
            }
            fileGroups.get(filePath)!.push(result);
        }

        // Enhance results with file context
        return results.map(result => {
            const fileResults = fileGroups.get(result.chunk.filePath) || [];
            const contextInfo = this.generateContextInfo(result.chunk, fileResults);
            
            return {
                ...result,
                chunk: {
                    ...result.chunk,
                    metadata: {
                        ...result.chunk.metadata,
                        description: result.chunk.metadata.description || contextInfo
                    }
                }
            };
        });
    }

    private generateContextInfo(chunk: Chunk, fileResults: QueryResult[]): string {
        const parts = [];
        
        // Add file context
        parts.push(`From ${chunk.filePath}:${chunk.startLine}-${chunk.endLine}`);
        
        // Add type-specific context
        if (chunk.type === 'function' && chunk.metadata.name) {
            parts.push(`Function: ${chunk.metadata.name}`);
        } else if (chunk.type === 'class' && chunk.metadata.name) {
            parts.push(`Class: ${chunk.metadata.name}`);
        } else if (chunk.type === 'interface' && chunk.metadata.name) {
            parts.push(`Interface: ${chunk.metadata.name}`);
        }

        // Add related context if multiple results from same file
        if (fileResults.length > 1) {
            parts.push(`Related to ${fileResults.length - 1} other chunks in this file`);
        }

        return parts.join(', ');
    }

    async getStats(): Promise<{
        isIndexed: boolean;
        vectorStore: { count: number; collections: string[] };
    }> {
        const vectorStoreStats = await this.vectorStore.getStats();
        
        return {
            isIndexed: this.isIndexed,
            vectorStore: vectorStoreStats
        };
    }

    async close(): Promise<void> {
        if (this.fileWatcher) {
            await this.fileWatcher.stopWatching();
        }
        await this.vectorStore.close();
        console.log('Retrieval system closed');
    }

    /**
     * Start file watching for incremental updates
     */
    async startFileWatching(rootPath?: string, config?: Partial<WatcherConfig>): Promise<void> {
        if (this.fileWatcher) {
            console.log('File watcher is already running');
            return;
        }

        const watcherConfig: WatcherConfig = {
            rootPath: rootPath || process.cwd(),
            excludePatterns: [...FILE_PATTERNS.WATCH_IGNORE_PATTERNS],
            includeExtensions: [...FILE_PATTERNS.SUPPORTED_EXTENSIONS],
            debounceMs: 500,
            batchSize: 10,
            ...this.watcherConfig,
            ...config
        };

        this.fileWatcher = new FileWatcher(watcherConfig);
        await this.fileWatcher.initialize();

        // Set up event handlers for file changes
        this.fileWatcher.on('fileChange', (event: FileChangeEvent) => {
            this.handleFileChange(event);
        });

        this.fileWatcher.on('error', (error: Error) => {
            console.error('File watcher error:', error);
        });

        await this.fileWatcher.startWatching();
        console.log(`Started file watching on: ${watcherConfig.rootPath}`);
    }

    /**
     * Stop file watching
     */
    async stopFileWatching(): Promise<void> {
        if (this.fileWatcher) {
            await this.fileWatcher.stopWatching();
            this.fileWatcher = undefined;
            console.log('Stopped file watching');
        }
    }

    /**
     * Handle file change events for incremental updates
     */
    private async handleFileChange(event: FileChangeEvent): Promise<void> {
        try {
            if (event.type === 'unlink') {
                // Remove chunks for deleted file from vector store
                await this.removeFileFromIndex(event.filePath);
                console.log(`Removed ${event.filePath} from index`);
                return;
            }

            if (event.error) {
                console.error(`Error processing file change for ${event.filePath}:`, event.error);
                return;
            }

            if (event.chunks) {
                // Remove old chunks for this file first
                await this.removeFileFromIndex(event.filePath);

                // Add new chunks
                const embeddedChunks = await this.embeddingService.embedChunks(event.chunks);
                await this.vectorStore.storeChunks(embeddedChunks);

                console.log(`Updated ${event.chunks.length} chunks for ${event.filePath}`);
            }
        } catch (error) {
            console.error(`Failed to handle file change for ${event.filePath}:`, error);
        }
    }

    /**
     * Remove all chunks for a specific file from the index
     */
    private async removeFileFromIndex(filePath: string): Promise<void> {
        // This would need to be implemented in the VectorStore
        // For now, we'll assume there's a method to remove by file path
        try {
            await this.vectorStore.removeByFilePath(filePath);
        } catch (error) {
            console.warn(`Failed to remove chunks for ${filePath}:`, error);
        }
    }

    /**
     * Manually trigger reprocessing of a specific file
     */
    async updateFile(filePath: string): Promise<void> {
        if (!this.fileWatcher) {
            throw new Error('File watcher not initialized. Call startFileWatching() first.');
        }

        await this.fileWatcher.triggerFileProcessing(filePath);
    }

    /**
     * Get enhanced statistics including semantic chunking info
     */
    async getEnhancedStats(): Promise<{
        isIndexed: boolean;
        vectorStore: { count: number; collections: string[] };
        fileWatcher?: {
            isActive: boolean;
            watchedFiles: number;
            cacheStats: any;
        };
        chunkingMode: 'semantic' | 'text';
        supportedLanguages?: string[];
    }> {
        const basicStats = await this.getStats();
        
        const stats: {
            isIndexed: boolean;
            vectorStore: { count: number; collections: string[] };
            chunkingMode: 'semantic' | 'text';
            supportedLanguages?: string[];
            fileWatcher?: {
                isActive: boolean;
                watchedFiles: number;
                cacheStats: any;
            };
        } = {
            ...basicStats,
            chunkingMode: this.useSemanticChunking ? 'semantic' as const : 'text' as const,
            supportedLanguages: this.useSemanticChunking ? this.semanticChunker.getSupportedLanguages() : undefined
        };

        if (this.fileWatcher) {
            const watchedFiles = this.fileWatcher.getWatchedFiles();
            stats.fileWatcher = {
                isActive: this.fileWatcher.isActive(),
                watchedFiles: watchedFiles.length,
                cacheStats: this.fileWatcher.getCacheStats()
            };
        }

        return stats;
    }

    // Utility method to format results for display
    formatResults(retrievalResult: RetrievalResult): string {
        const { query, results, processingTime } = retrievalResult;
        
        const lines = [
            `Query: "${query}"`,
            `Found ${results.length} relevant chunks (${processingTime}ms)`,
            ''
        ];

        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            const chunk = result.chunk;
            
            lines.push(`${i + 1}. [Score: ${result.score.toFixed(3)}] ${chunk.filePath}:${chunk.startLine}-${chunk.endLine}`);
            
            if (chunk.metadata.name) {
                lines.push(`   ${chunk.type}: ${chunk.metadata.name}`);
            }
            
            // Show first few lines of content
            const contentLines = chunk.content.split('\n').slice(0, 3);
            contentLines.forEach((line: string) => {
                if (line.trim()) {
                    lines.push(`   ${line.trim()}`);
                }
            });
            
            if (chunk.content.split('\n').length > 3) {
                lines.push('   ...');
            }
            
            lines.push('');
        }

        return lines.join('\n');
    }
}