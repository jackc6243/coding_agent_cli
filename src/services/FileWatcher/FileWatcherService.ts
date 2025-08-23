import chokidar, { FSWatcher } from 'chokidar';
import { EventEmitter } from 'events';
import { extname, resolve } from 'path';
import Hashhelper from '../../utils/Hashhelper.js';
import { FilePermissions } from '../../context/FilePermissions.js';
import { ConsoleLogger } from '../../logging/ConsoleLogger.js';

export interface FileChangeEvent {
    type: 'add' | 'change' | 'unlink';
    filePath: string;
}

export interface WatcherConfig {
    excludePatterns?: string[];
    includeExtensions?: string[];
    debounceMs?: number;
    interval?: number;
    binaryInterval?: number;
    usePolling?: boolean;
    ignoreInitial?: boolean;
}

export class FileWatcherService extends EventEmitter {
    private watcher?: FSWatcher;
    private configs: WatcherConfig[];
    private filePermissions: FilePermissions;
    private isWatching = false;
    private pendingChanges = new Map<string, NodeJS.Timeout>();
    private fileCache = new Map<string, { mtime: number; hash: string }>();
    private logger = new ConsoleLogger("info");
    private defaultConfig: Required<WatcherConfig> = {
        excludePatterns: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**'],
        includeExtensions: [],
        debounceMs: 300,
        interval: 100,
        binaryInterval: 300,
        usePolling: false,
        ignoreInitial: true
    };

    constructor(filePermissions: FilePermissions, ...configs: WatcherConfig[]) {
        super();
        this.filePermissions = filePermissions;
        this.configs = configs.length > 0 ? configs : [{}];
    }

    /**
     * Start watching for file changes
     */
    async startWatching(): Promise<void> {
        if (this.isWatching) {
            this.logger.log('File watcher is already running', 'info');
            return;
        }

        // Get allowed paths from FilePermissions (both read and write allowed)
        const allowedPaths = Array.from(this.filePermissions.files.keys());
        
        if (allowedPaths.length === 0) {
            this.logger.log('No files to watch based on permissions', 'info');
            return;
        }

        // Merge all configs with defaults
        const mergedConfig = this.mergeConfigs();

        this.watcher = chokidar.watch(allowedPaths, {
            ignored: mergedConfig.excludePatterns,
            persistent: true,
            ignoreInitial: mergedConfig.ignoreInitial,
            followSymlinks: false,
            atomic: true,
            usePolling: mergedConfig.usePolling,
            interval: mergedConfig.interval,
            binaryInterval: mergedConfig.binaryInterval
        });

        // Set up event handlers
        this.watcher
            .on('add', (filePath) => this.handleFileChange('add', filePath))
            .on('change', (filePath) => this.handleFileChange('change', filePath))
            .on('unlink', (filePath) => this.handleFileChange('unlink', filePath))
            .on('error', (error) => this.emit('error', error))
            .on('ready', () => {
                this.logger.log('Initial scan complete. Watching for changes...', 'success');
                this.emit('ready');
            });

        this.isWatching = true;
        this.logger.log(`Started watching ${allowedPaths.length} allowed paths`, 'success');
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
        this.logger.log('Stopped file watching', 'info');
    }

    /**
     * Merge all provided configs with defaults
     */
    private mergeConfigs(): Required<WatcherConfig> {
        const merged = { ...this.defaultConfig };

        for (const config of this.configs) {
            if (config.excludePatterns) {
                merged.excludePatterns = [...merged.excludePatterns, ...config.excludePatterns];
            }
            if (config.includeExtensions) {
                merged.includeExtensions = [...merged.includeExtensions, ...config.includeExtensions];
            }
            if (config.debounceMs !== undefined) {
                merged.debounceMs = config.debounceMs;
            }
            if (config.interval !== undefined) {
                merged.interval = config.interval;
            }
            if (config.binaryInterval !== undefined) {
                merged.binaryInterval = config.binaryInterval;
            }
            if (config.usePolling !== undefined) {
                merged.usePolling = config.usePolling;
            }
            if (config.ignoreInitial !== undefined) {
                merged.ignoreInitial = config.ignoreInitial;
            }
        }

        return merged;
    }

    /**
     * Handle file change events with debouncing and filtering
     */
    private handleFileChange(type: 'add' | 'change' | 'unlink', filePath: string): void {
        const absolutePath = resolve(filePath);
        
        // For newly created files, grant read and write permissions
        if (type === 'add') {
            this.filePermissions.setPath(absolutePath, true);
        }
        
        // Check if file is allowed by permissions
        if (!this.filePermissions.checkIfReadAllowed(absolutePath)) {
            return;
        }

        const extension = extname(absolutePath);
        const mergedConfig = this.mergeConfigs();

        // Filter by extension
        if (mergedConfig.includeExtensions.length > 0 && 
            !mergedConfig.includeExtensions.includes(extension)) {
            return;
        }

        // Clear existing timeout for this file
        const existingTimeout = this.pendingChanges.get(absolutePath);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
        }

        // Set new debounced timeout
        const timeout = setTimeout(async () => {
            await this.emitFileChange(type, absolutePath);
            this.pendingChanges.delete(absolutePath);
        }, mergedConfig.debounceMs);

        this.pendingChanges.set(absolutePath, timeout);
    }

    /**
     * Emit file change event after debouncing and validation
     */
    private async emitFileChange(type: 'add' | 'change' | 'unlink', filePath: string): Promise<void> {
        try {
            if (type === 'unlink') {
                this.fileCache.delete(filePath);
                this.emit('fileChange', { type, filePath });
                return;
            }

            // Check if file actually changed (for 'change' events)
            if (type === 'change' && !await this.hasFileActuallyChanged(filePath)) {
                return;
            }

            this.emit('fileChange', { type, filePath });

        } catch (error) {
            this.logger.log(`Error handling file change for ${filePath}`, 'error');
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
            const hash = Hashhelper.hashFileFromString(content);

            const cached = this.fileCache.get(filePath);
            const hasChanged = !cached || cached.hash !== hash || cached.mtime !== stats.mtimeMs;

            // Update cache
            this.fileCache.set(filePath, {
                mtime: stats.mtimeMs,
                hash
            });

            return hasChanged;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
            // If we can't check, assume it changed
            return true;
        }
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
     * Manually trigger a file change event
     */
    triggerFileChange(filePath: string, type: 'add' | 'change' | 'unlink' = 'change'): void {
        const absolutePath = resolve(filePath);
        this.handleFileChange(type, absolutePath);
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
            // Only add paths that are allowed by permissions
            if (this.filePermissions.checkIfReadAllowed(path)) {
                this.watcher.add(path);
            }
        }

        for (const path of pathsToRemove) {
            this.watcher.unwatch(path);
        }
    }

    /**
     * Get the current FilePermissions instance
     */
    getFilePermissions(): FilePermissions {
        return this.filePermissions;
    }

    /**
     * Update the FilePermissions instance and refresh watched paths
     */
    async updateFilePermissions(newPermissions: FilePermissions): Promise<void> {
        this.filePermissions = newPermissions;
        
        if (this.isWatching) {
            await this.stopWatching();
            await this.startWatching();
        }
    }
}