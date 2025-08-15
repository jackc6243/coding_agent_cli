/**
 * Types for chunking functionality
 */

export interface Chunk {
    id: string;
    content: string;
    type: 'function' | 'class' | 'interface' | 'variable' | 'comment' | 'text';
    filePath: string;
    startLine: number;
    endLine: number;
    metadata: {
        name?: string;
        signature?: string;
        description?: string;
        language?: string;
        nodeType?: string;
        declarationType?: string;
        hasErrors?: boolean;
        isNamed?: boolean;
        parentType?: string;
        chunkIndex?: number;
        extension?: string;
        wholefile?: boolean;
        [key: string]: any; // Allow additional metadata properties
    };
}

export interface EmbeddedChunk extends Chunk {
    embedding: number[];
}

export interface SemanticChunk extends Chunk {
    astNode?: any; // ASTNode from ASTIndexer
    semanticType: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'import' | 'export' | 'chunk';
    language: string;
    complexity?: number;
    dependencies?: string[];
}

export interface QueryResult {
    chunk: Chunk;
    score: number;
    distance: number;
}