/**
 * Core types for the RAG system
 */

// Re-export chunk types from chunking module first
export type { Chunk, EmbeddedChunk, SemanticChunk } from '../chunking/types.js';
export type { FileInfo } from '../services/FileBrowser.js';

// Import the Chunk type for use in this file
import type { Chunk } from '../chunking/types.js';

export interface RAGConfig {
    openaiApiKey?: string;
    useSemanticChunking?: boolean;
    enableFileWatching?: boolean;
    watcherConfig?: WatcherConfig;
}

export interface RetrievalConfig {
    topK?: number;
    minScore?: number;
    includeMetadata?: boolean;
    includeCode?: boolean;
    includeComments?: boolean;
    useSemanticChunking?: boolean;
    semanticTypes?: string[];
    complexityRange?: [number, number];
    languages?: string[];
}

export interface RetrievalResult {
    query: string;
    results: QueryResult[];
    totalChunks: number;
    processingTime: number;
}

export interface QueryResult {
    chunk: Chunk;
    score: number;
    distance: number;
}

export interface WatcherConfig {
    rootPath: string;
    excludePatterns: string[];
    includeExtensions: string[];
    debounceMs: number;
    batchSize: number;
}

export interface FileChangeEvent {
    type: 'add' | 'change' | 'unlink';
    filePath: string;
    parsedFile?: any; // ASTIndexer.ParsedFile
    chunks?: any[]; // SemanticChunk[]
    error?: Error;
}