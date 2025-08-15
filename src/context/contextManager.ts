import { RAG, RetrievalConfig } from '../rag/index.js';
import { CodeContext, RelevantCodeChunk } from './context.js';
import { getRagConfig } from '../rag/config/RAGConfig.js';
import { FILE_PATTERNS } from '../config/FilePatterns.js';

export interface CodeRetrievalOptions {
    folderPath?: string;
    topK?: number;
    minScore?: number;
    includeCode?: boolean;
    includeComments?: boolean;
    forceReindex?: boolean;
}

export class CodeContextManager {
    private rag: RAG;
    private isInitialized: boolean = false;
    private lastIndexedPath: string | null = null;

    constructor(openaiApiKey?: string) {
        this.rag = new RAG({
            openaiApiKey,
            useSemanticChunking: true,
            enableFileWatching: false
        });
    }

    /**
     * Initialize the RAG system
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        await this.rag.initialize();
        this.isInitialized = true;
    }

    /**
     * Retrieve relevant code based on a string prompt and folder entry point
     */
    async retrieveRelevantCode(
        prompt: string, 
        options: CodeRetrievalOptions = {}
    ): Promise<CodeContext> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const {
            folderPath,
            topK = 10,
            minScore = 0.15,
            includeCode = true,
            includeComments = true,
            forceReindex = false
        } = options;

        // Update RAG config if folder path is provided
        if (folderPath && folderPath !== this.lastIndexedPath) {
            this.updateRagConfig(folderPath);
            await this.rag.indexCodebase(true); // Force reindex for new folder
            this.lastIndexedPath = folderPath;
        } else if (forceReindex || !this.lastIndexedPath) {
            // Index with current config if not indexed yet or force requested
            const config = getRagConfig();
            await this.rag.indexCodebase(forceReindex);
            this.lastIndexedPath = config.index_folder;
        }

        // Retrieve relevant context
        const retrievalConfig: RetrievalConfig = {
            topK,
            minScore,
            includeCode,
            includeComments,
            includeMetadata: true
        };

        const results = await this.rag.retrieve(prompt, retrievalConfig);

        // Convert to CodeContext format
        const relevantChunks: RelevantCodeChunk[] = results.results.map(result => ({
            filePath: result.chunk.filePath,
            content: result.chunk.content,
            type: result.chunk.type,
            startLine: result.chunk.startLine,
            endLine: result.chunk.endLine,
            score: result.score,
            metadata: {
                name: result.chunk.metadata.name,
                signature: result.chunk.metadata.signature,
                description: result.chunk.metadata.description
            }
        }));

        return {
            relevantChunks,
            query: prompt,
            totalChunks: results.totalChunks,
            retrievalTime: results.processingTime
        };
    }

    /**
     * Get formatted code context as a string for LLM consumption
     */
    async getFormattedCodeContext(
        prompt: string,
        options: CodeRetrievalOptions = {}
    ): Promise<string> {
        const codeContext = await this.retrieveRelevantCode(prompt, options);
        return this.formatCodeContext(codeContext);
    }

    /**
     * Format code context for LLM consumption
     */
    formatCodeContext(codeContext: CodeContext): string {
        const { relevantChunks, query, totalChunks, retrievalTime } = codeContext;
        
        if (relevantChunks.length === 0) {
            return `No relevant code found for query: "${query}"`;
        }

        const lines = [
            `# Relevant Code Context`,
            `Query: "${query}"`,
            `Found ${relevantChunks.length} relevant chunks from ${totalChunks} total (${retrievalTime}ms)`,
            ''
        ];

        relevantChunks.forEach((chunk, index) => {
            lines.push(`## ${index + 1}. ${chunk.filePath}:${chunk.startLine}-${chunk.endLine} (Score: ${chunk.score.toFixed(3)})`);
            
            if (chunk.metadata.name) {
                lines.push(`**${chunk.type}**: ${chunk.metadata.name}`);
            }
            
            if (chunk.metadata.signature && chunk.type === 'function') {
                lines.push(`**Signature**: \`${chunk.metadata.signature.split('\n')[0]}\``);
            }
            
            lines.push('```' + this.getLanguageFromPath(chunk.filePath));
            lines.push(chunk.content);
            lines.push('```');
            lines.push('');
        });

        return lines.join('\n');
    }

    /**
     * Check if the system has been indexed
     */
    async isIndexed(): Promise<boolean> {
        if (!this.isInitialized) {
            return false;
        }

        const stats = await this.rag.getStats();
        return stats.isIndexed && stats.vectorStore.count > 0;
    }

    /**
     * Get system statistics
     */
    async getStats(): Promise<{
        isInitialized: boolean;
        isIndexed: boolean;
        lastIndexedPath: string | null;
        totalChunks: number;
    }> {
        let totalChunks = 0;
        let isIndexed = false;

        if (this.isInitialized) {
            const stats = await this.rag.getStats();
            isIndexed = stats.isIndexed;
            totalChunks = stats.vectorStore.count;
        }

        return {
            isInitialized: this.isInitialized,
            isIndexed,
            lastIndexedPath: this.lastIndexedPath,
            totalChunks
        };
    }

    /**
     * Clear the vector database
     */
    async clearIndex(): Promise<void> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        // Access internal vector store to clear
        const retrievalSystem = (this.rag as any).retrievalSystem;
        await retrievalSystem.vectorStore.clear();
        this.lastIndexedPath = null;
    }

    /**
     * Clean up resources
     */
    async dispose(): Promise<void> {
        if (this.isInitialized) {
            await this.rag.close();
            this.isInitialized = false;
            this.lastIndexedPath = null;
        }
    }

    private updateRagConfig(folderPath: string): void {
        // Temporarily update the config - in a real implementation, 
        // you might want to create a new RAG instance with different config
        const config = getRagConfig() as any;
        config.index_folder = folderPath;
    }

    private getLanguageFromPath(filePath: string): string {
        const ext = filePath.split('.').pop()?.toLowerCase();
        const langMap = FILE_PATTERNS.LANGUAGE_MAPPINGS as Record<string, string>;
        return langMap[ext || ''] || '';
    }
}