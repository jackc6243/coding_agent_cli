import { RAG } from '../../core/RAG.js';
import { RetrievalSystem } from '../../core/RetrievalSystem.js';
import type { RAGConfig, RetrievalConfig, RetrievalResult } from '../../core/types.js';

// Mock ChromaDB dependency since it requires a running server
jest.mock('chromadb', () => ({
    ChromaClient: jest.fn().mockImplementation(() => ({
        listCollections: jest.fn().mockResolvedValue([]),
        getCollection: jest.fn().mockResolvedValue({
            count: jest.fn().mockResolvedValue(0),
            add: jest.fn().mockResolvedValue(undefined),
            query: jest.fn().mockResolvedValue({
                documents: [[]],
                metadatas: [[]],
                distances: [[]],
                ids: [[]]
            }),
            delete: jest.fn().mockResolvedValue(undefined)
        }),
        createCollection: jest.fn().mockResolvedValue({
            count: jest.fn().mockResolvedValue(0),
            add: jest.fn().mockResolvedValue(undefined),
            query: jest.fn().mockResolvedValue({
                documents: [[]],
                metadatas: [[]],
                distances: [[]],
                ids: [[]]
            }),
            delete: jest.fn().mockResolvedValue(undefined)
        }),
        deleteCollection: jest.fn().mockResolvedValue(undefined)
    }))
}));

// Mock OpenAI dependency - need to export both default and named export for CommonJS/ESM compatibility  
jest.mock('openai', () => {
    const mockOpenAI = jest.fn().mockImplementation(function() {
        return {
            embeddings: {
                create: jest.fn().mockResolvedValue({
                    data: [{ embedding: new Array(1536).fill(0.1) }]
                })
            }
        };
    });
    
    return {
        __esModule: true,
        default: mockOpenAI
    };
});

// Mock web-tree-sitter
jest.mock('web-tree-sitter', () => ({
    Parser: jest.fn().mockImplementation(() => ({
        setLanguage: jest.fn(),
        parse: jest.fn().mockReturnValue({
            rootNode: {
                text: 'mock content',
                walk: jest.fn()
            }
        })
    })),
    Language: {
        load: jest.fn().mockResolvedValue({})
    }
}));

describe('RAG', () => {
    let rag: RAG;
    let mockConfig: RAGConfig;

    beforeEach(() => {
        mockConfig = {
            openaiApiKey: 'test-key',
            useSemanticChunking: false,
            enableFileWatching: false
        };
        rag = new RAG(mockConfig);
    });

    afterEach(async () => {
        await rag.close();
    });

    describe('constructor', () => {
        test('should create RAG instance with default config', () => {
            const defaultRag = new RAG();
            expect(defaultRag).toBeInstanceOf(RAG);
        });

        test('should create RAG instance with provided config', () => {
            expect(rag).toBeInstanceOf(RAG);
        });
    });

    describe('initialization', () => {
        test('should initialize successfully', async () => {
            await expect(rag.initialize()).resolves.not.toThrow();
        });

        test('should not re-initialize if already initialized', async () => {
            await rag.initialize();
            await expect(rag.initialize()).resolves.not.toThrow();
        });

        test('should throw error when calling methods before initialization', async () => {
            await expect(rag.indexCodebase()).rejects.toThrow('RAG system not initialized');
            await expect(rag.retrieve('test query')).rejects.toThrow('RAG system not initialized');
        });
    });

    describe('indexing', () => {
        beforeEach(async () => {
            await rag.initialize();
        });

        test('should index codebase successfully', async () => {
            await expect(rag.indexCodebase()).resolves.not.toThrow();
        });

        test('should force reindex when specified', async () => {
            await rag.indexCodebase();
            await expect(rag.indexCodebase(true)).resolves.not.toThrow();
        });
    });

    describe('retrieval', () => {
        beforeEach(async () => {
            await rag.initialize();
            await rag.indexCodebase();
        });

        test('should retrieve results for query', async () => {
            const query = 'test function';
            const result = await rag.retrieve(query);
            
            expect(result).toHaveProperty('query', query);
            expect(result).toHaveProperty('results');
            expect(result).toHaveProperty('totalChunks');
            expect(result).toHaveProperty('processingTime');
            expect(Array.isArray(result.results)).toBe(true);
        });

        test('should retrieve with custom config', async () => {
            const query = 'test function';
            const config: RetrievalConfig = {
                topK: 5,
                minScore: 0.5,
                includeMetadata: true
            };
            
            const result = await rag.retrieve(query, config);
            expect(result.query).toBe(query);
        });

        test('should get formatted results', async () => {
            const query = 'test function';
            const formattedResults = await rag.getFormattedResults(query);
            
            expect(typeof formattedResults).toBe('string');
            expect(formattedResults).toContain(query);
        });
    });

    describe('statistics', () => {
        beforeEach(async () => {
            await rag.initialize();
        });

        test('should get basic stats', async () => {
            const stats = await rag.getStats();
            
            expect(stats).toHaveProperty('isIndexed');
            expect(stats).toHaveProperty('vectorStore');
            expect(stats.vectorStore).toHaveProperty('count');
            expect(stats.vectorStore).toHaveProperty('collections');
        });

        test('should get enhanced stats', async () => {
            const stats = await rag.getEnhancedStats();
            
            expect(stats).toHaveProperty('isIndexed');
            expect(stats).toHaveProperty('vectorStore');
            expect(stats).toHaveProperty('chunkingMode');
        });
    });

    describe('file watching', () => {
        beforeEach(async () => {
            await rag.initialize();
        });

        test('should start file watching', async () => {
            await expect(rag.startFileWatching()).resolves.not.toThrow();
        });

        test('should stop file watching', async () => {
            await rag.startFileWatching();
            await expect(rag.stopFileWatching()).resolves.not.toThrow();
        });

        test('should update specific file', async () => {
            await rag.startFileWatching();
            await expect(rag.updateFile('./test-file.ts')).resolves.not.toThrow();
        });
    });

    describe('cleanup', () => {
        test('should close successfully', async () => {
            await rag.initialize();
            await expect(rag.close()).resolves.not.toThrow();
        });

        test('should handle multiple close calls', async () => {
            await rag.initialize();
            await rag.close();
            await expect(rag.close()).resolves.not.toThrow();
        });
    });
});