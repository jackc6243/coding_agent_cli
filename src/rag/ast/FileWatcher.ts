import chokidar, { FSWatcher } from 'chokidar';
import { EventEmitter } from 'events';
import { extname, resolve } from 'path';
import { ASTIndexer, ParsedFile } from './ASTIndexer.js';
import { SemanticChunker } from '../chunking/SemanticChunker.js';
import type { SemanticChunk } from '../chunking/types.js';

export interface FileChangeEvent {
    type: 'add' | 'change' | 'unlink';
    filePath: string;
    parsedFile?: ParsedFile;
    chunks?: SemanticChunk[];
    error?: Error;
}

export interface WatcherConfig {
    rootPath: string;
    excludePatterns: string[];
    includeExtensions: string[];
    debounceMs: number;
    batchSize: number;
}

export class FileWatcher extends EventEmitter {
    private watcher?: FSWatcher;
    private astIndexer: ASTIndexer;
    private semanticChunker: SemanticChunker;
    private config: WatcherConfig;
    private isWatching = false;
    private pendingChanges = new Map<string, NodeJS.Timeout>();
    private fileCache = new Map<string, { mtime: number; hash: string }>();

    constructor(config: WatcherConfig) {
        super();
        this.config = config;
        this.astIndexer = new ASTIndexer();
        this.semanticChunker = new SemanticChunker();
    }

    async initialize(): Promise<void> {
        await this.astIndexer.initialize();
        await this.semanticChunker.initialize();
    }

    /**
     * Start watching for file changes
     */
    async startWatching(): Promise<void> {
        if (this.isWatching) {
            console.log('File watcher is already running');
            return;
        }

        const watchPattern = this.config.rootPath;
        const ignored = [
            '**/node_modules/**',
            '**/.git/**',
            '**/dist/**',
            '**/build/**',
            '**/.next/**',
            '**/coverage/**',
            ...this.config.excludePatterns
        ];

        this.watcher = chokidar.watch(watchPattern, {
            ignored,
            persistent: true,
            ignoreInitial: false, // Process existing files
            followSymlinks: false,
            atomic: true, // Helps with file write operations
            usePolling: false,
            interval: 1000,
            binaryInterval: 3000
        });

        // Set up event handlers
        this.watcher
            .on('add', (filePath) => this.handleFileChange('add', filePath))
            .on('change', (filePath) => this.handleFileChange('change', filePath))
            .on('unlink', (filePath) => this.handleFileChange('unlink', filePath))
            .on('error', (error) => this.emit('error', error))
            .on('ready', () => {
                console.log('Initial scan complete. Watching for changes...');
                this.emit('ready');
            });

        this.isWatching = true;
        console.log(`Started watching: ${watchPattern}`);
    }

    /**
     * Stop watching for file changes
     */
    async stopWatching(): Promise<void> {
        if (!this.isWatching) {
            return;
        }

        // Clear pending changes
        const timeouts = Array.from(this.pendingChanges.values());
        for (const timeout of timeouts) {
            clearTimeout(timeout);
        }
        this.pendingChanges.clear();

        if (this.watcher) {
            await this.watcher.close();
            this.watcher = undefined;
        }

        this.isWatching = false;
        console.log('Stopped file watching');
    }

    /**
     * Handle file change events with debouncing
     */
    private handleFileChange(type: 'add' | 'change' | 'unlink', filePath: string): void {
        const absolutePath = resolve(filePath);
        const extension = extname(absolutePath);

        // Filter by extension
        if (this.config.includeExtensions.length > 0 && 
            !this.config.includeExtensions.includes(extension)) {
            return;
        }

        // Clear existing timeout for this file
        const existingTimeout = this.pendingChanges.get(absolutePath);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
        }

        // Set new debounced timeout
        const timeout = setTimeout(() => {
            this.processFileChange(type, absolutePath);
            this.pendingChanges.delete(absolutePath);
        }, this.config.debounceMs);

        this.pendingChanges.set(absolutePath, timeout);
    }

    /**
     * Process a file change after debouncing
     */
    private async processFileChange(type: 'add' | 'change' | 'unlink', filePath: string): Promise<void> {
        try {
            console.log(`Processing ${type} event for: ${filePath}`);

            if (type === 'unlink') {
                // File was deleted
                this.fileCache.delete(filePath);
                this.emit('fileChange', {
                    type,
                    filePath
                });
                return;
            }

            // Check if file actually changed (for 'change' events)
            if (type === 'change' && !await this.hasFileActuallyChanged(filePath)) {
                console.log(`File ${filePath} triggered change event but content unchanged`);
                return;
            }

            // Process the file
            const result = await this.processFile(filePath);
            
            this.emit('fileChange', {
                type,
                filePath,
                parsedFile: result.parsedFile,
                chunks: result.chunks
            });

        } catch (error) {
            console.error(`Error processing file change for ${filePath}:`, error);
            this.emit('fileChange', {
                type,
                filePath,
                error: error as Error
            });
        }
    }

    /**
     * Check if a file has actually changed content (not just timestamp)
     */
    private async hasFileActuallyChanged(filePath: string): Promise<boolean> {
        try {
            const fs = await import('fs/promises');
            const stats = await fs.stat(filePath);
            const content = await fs.readFile(filePath, 'utf-8');
            const hash = this.calculateHash(content);

            const cached = this.fileCache.get(filePath);
            const hasChanged = !cached || cached.hash !== hash || cached.mtime !== stats.mtimeMs;

            // Update cache
            this.fileCache.set(filePath, {
                mtime: stats.mtimeMs,
                hash
            });

            return hasChanged;
        } catch (error) {
            // If we can't check, assume it changed
            return true;
        }
    }

    /**
     * Calculate a simple hash for file content
     */
    private calculateHash(content: string): string {
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString();
    }

    /**
     * Process a file and return parsed result and chunks
     */
    private async processFile(filePath: string): Promise<{
        parsedFile: ParsedFile;
        chunks: SemanticChunk[];
    }> {
        const fs = await import('fs/promises');
        const content = await fs.readFile(filePath, 'utf-8');
        const extension = extname(filePath);

        // Parse with AST indexer
        const parsedFile = await this.astIndexer.parseFile(filePath, content);

        // Create semantic chunks
        const chunks = await this.semanticChunker.chunkFile(filePath, content, extension);

        return { parsedFile, chunks };
    }

    /**
     * Process multiple files in batches
     */
    async processBatch(filePaths: string[]): Promise<Map<string, {
        parsedFile?: ParsedFile;
        chunks?: SemanticChunk[];
        error?: Error;
    }>> {
        const results = new Map();
        const batchSize = this.config.batchSize;

        for (let i = 0; i < filePaths.length; i += batchSize) {
            const batch = filePaths.slice(i, i + batchSize);
            const batchPromises = batch.map(async (filePath) => {
                try {
                    const result = await this.processFile(filePath);
                    return { filePath, ...result };
                } catch (error) {
                    return { filePath, error: error as Error };
                }
            });

            const batchResults = await Promise.allSettled(batchPromises);
            
            for (const result of batchResults) {
                if (result.status === 'fulfilled') {
                    const { filePath, ...data } = result.value;
                    results.set(filePath, data);
                } else {
                    console.error('Batch processing error:', result.reason);
                }
            }

            // Small delay between batches to prevent overwhelming the system
            if (i + batchSize < filePaths.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        return results;
    }

    /**
     * Get the list of currently watched files
     */
    getWatchedFiles(): string[] {
        if (!this.watcher) {
            return [];
        }
        return Object.keys(this.watcher.getWatched()).flatMap(dir => 
            this.watcher!.getWatched()[dir].map(file => `${dir}/${file}`)
        );
    }

    /**
     * Manually trigger processing of a specific file
     */
    async triggerFileProcessing(filePath: string): Promise<void> {
        const absolutePath = resolve(filePath);
        await this.processFileChange('change', absolutePath);
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): {
        cachedFiles: number;
        cacheSize: number;
        oldestEntry: string | null;
        newestEntry: string | null;
    } {
        const entries = Array.from(this.fileCache.entries());
        
        if (entries.length === 0) {
            return {
                cachedFiles: 0,
                cacheSize: 0,
                oldestEntry: null,
                newestEntry: null
            };
        }

        const sorted = entries.sort((a, b) => a[1].mtime - b[1].mtime);
        
        return {
            cachedFiles: entries.length,
            cacheSize: JSON.stringify(this.fileCache).length,
            oldestEntry: sorted[0][0],
            newestEntry: sorted[sorted.length - 1][0]
        };
    }

    /**
     * Clear the file cache
     */
    clearCache(): void {
        this.fileCache.clear();
    }

    /**
     * Check if the watcher is currently active
     */
    isActive(): boolean {
        return this.isWatching;
    }

    /**
     * Add or remove paths from the watch list dynamically
     */
    updateWatchPaths(pathsToAdd: string[] = [], pathsToRemove: string[] = []): void {
        if (!this.watcher) {
            return;
        }

        for (const path of pathsToAdd) {
            this.watcher.add(path);
        }

        for (const path of pathsToRemove) {
            this.watcher.unwatch(path);
        }
    }
}