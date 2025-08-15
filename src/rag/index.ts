// Main RAG exports
export { RAG } from './core/RAG.js';
export { RetrievalSystem } from './core/RetrievalSystem.js';

// Services
export { FileBrowser } from './services/FileBrowser.js';
export { EmbeddingService } from './services/EmbeddingService.js';
export { VectorStore } from './services/VectorStore.js';

// Chunking
export { TextChunker } from './chunking/TextChunker.js';
export { SemanticChunker } from './chunking/SemanticChunker.js';

// AST-based components
export { ASTIndexer } from './ast/ASTIndexer.js';
export { FileWatcher } from './ast/FileWatcher.js';

// Types - Export all types from core and chunking
export type {
    RAGConfig,
    RetrievalConfig,
    RetrievalResult,
    QueryResult,
    WatcherConfig,
    FileInfo
} from './core/types.js';

export type {
    Chunk,
    EmbeddedChunk,
    SemanticChunk
} from './chunking/types.js';

// AST types
export type { ASTNode, ParsedFile } from './ast/ASTIndexer.js';
export type { FileChangeEvent } from './ast/FileWatcher.js';