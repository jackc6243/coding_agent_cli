import { VectorStore } from '../../services/VectorStore.js';
import type { EmbeddedChunk, QueryResult } from '../../chunking/types.js';

// Mock ChromaDB
jest.mock('chromadb', () => ({
    ChromaClient: jest.fn().mockImplementation(() => ({
        listCollections: jest.fn(),
        getCollection: jest.fn(),
        createCollection: jest.fn(),
        deleteCollection: jest.fn()
    }))
}));

describe('VectorStore', () => {
    let vectorStore: VectorStore;
    let mockChromaClient: any;
    let mockCollection: any;

    beforeEach(() => {
        mockCollection = {
            count: jest.fn(),
            add: jest.fn(),
            query: jest.fn(),
            get: jest.fn(),
            delete: jest.fn()
        };

        mockChromaClient = {
            listCollections: jest.fn(),
            getCollection: jest.fn(),
            createCollection: jest.fn(),
            deleteCollection: jest.fn()
        };

        const { ChromaClient } = require('chromadb');
        (ChromaClient as jest.Mock).mockImplementation(() => mockChromaClient);

        vectorStore = new VectorStore();
    });

    afterEach(async () => {
        await vectorStore.close();
    });

    describe('initialization', () => {
        test('should initialize with existing collection', async () => {
            mockChromaClient.getCollection.mockResolvedValue(mockCollection);

            await expect(vectorStore.initialize()).resolves.not.toThrow();
            expect(mockChromaClient.getCollection).toHaveBeenCalledWith({
                name: 'code_context'
            });
        });

        test('should create collection if it does not exist', async () => {
            mockChromaClient.getCollection.mockRejectedValue(new Error('Collection not found'));
            mockChromaClient.createCollection.mockResolvedValue(mockCollection);

            await expect(vectorStore.initialize()).resolves.not.toThrow();
            expect(mockChromaClient.createCollection).toHaveBeenCalledWith({
                name: 'code_context',
                metadata: {
                    description: 'Code context chunks for RAG pipeline',
                    created_at: expect.any(String)
                }
            });
        });

        test('should handle initialization errors', async () => {
            mockChromaClient.getCollection.mockRejectedValue(new Error('Connection failed'));
            mockChromaClient.createCollection.mockRejectedValue(new Error('Connection failed'));

            await expect(vectorStore.initialize()).rejects.toThrow('Connection failed');
        });
    });

    describe('storeChunks', () => {
        const mockEmbeddedChunks: EmbeddedChunk[] = [
            {
                id: 'chunk-1',
                content: 'function test() { return true; }',
                type: 'function',
                filePath: '/test/file.ts',
                startLine: 1,
                endLine: 3,
                metadata: {
                    name: 'test',
                    signature: 'test(): boolean'
                },
                embedding: new Array(1536).fill(0.1)
            },
            {
                id: 'chunk-2',
                content: 'class TestClass { }',
                type: 'class',
                filePath: '/test/file.ts',
                startLine: 5,
                endLine: 7,
                metadata: {
                    name: 'TestClass'
                },
                embedding: new Array(1536).fill(0.2)
            }
        ];

        beforeEach(async () => {
            mockChromaClient.getCollection.mockResolvedValue(mockCollection);
            await vectorStore.initialize();
        });

        test('should store chunks successfully', async () => {
            mockCollection.add.mockResolvedValue(undefined);

            await expect(vectorStore.storeChunks(mockEmbeddedChunks))
                .resolves.not.toThrow();

            expect(mockCollection.add).toHaveBeenCalledWith({
                ids: ['chunk-1', 'chunk-2'],
                embeddings: [
                    new Array(1536).fill(0.1),
                    new Array(1536).fill(0.2)
                ],
                documents: [
                    'function test() { return true; }',
                    'class TestClass { }'
                ],
                metadatas: [
                    {
                        filePath: '/test/file.ts',
                        type: 'function',
                        startLine: 1,
                        endLine: 3,
                        name: 'test',
                        signature: 'test(): boolean',
                        description: ''
                    },
                    {
                        filePath: '/test/file.ts',
                        type: 'class',
                        startLine: 5,
                        endLine: 7,
                        name: 'TestClass',
                        signature: '',
                        description: ''
                    }
                ]
            });
        });

        test('should handle empty chunks array', async () => {
            await expect(vectorStore.storeChunks([])).resolves.not.toThrow();
            expect(mockCollection.add).not.toHaveBeenCalled();
        });

        test('should handle large batches', async () => {
            const largeChunkSet: EmbeddedChunk[] = Array.from({ length: 250 }, (_, i) => ({
                id: `chunk-${i}`,
                content: `Content ${i}`,
                type: 'text',
                filePath: '/test/file.ts',
                startLine: 1,
                endLine: 1,
                metadata: {},
                embedding: new Array(1536).fill(0.1)
            }));

            mockCollection.add.mockResolvedValue(undefined);

            await expect(vectorStore.storeChunks(largeChunkSet))
                .resolves.not.toThrow();

            expect(mockCollection.add).toHaveBeenCalledTimes(3); // 100 + 100 + 50
        });

        test('should throw error when not initialized', async () => {
            const uninitializedStore = new VectorStore();
            
            await expect(uninitializedStore.storeChunks(mockEmbeddedChunks))
                .rejects.toThrow('VectorStore not initialized');
        });

        test('should handle storage errors', async () => {
            mockCollection.add.mockRejectedValue(new Error('Storage failed'));

            await expect(vectorStore.storeChunks(mockEmbeddedChunks))
                .rejects.toThrow('Storage failed');
        });
    });

    describe('query', () => {
        const mockQueryEmbedding = new Array(1536).fill(0.5);

        beforeEach(async () => {
            mockChromaClient.getCollection.mockResolvedValue(mockCollection);
            await vectorStore.initialize();
        });

        test('should query successfully and return results', async () => {
            mockCollection.query.mockResolvedValue({
                documents: [['function test() { return true; }', 'class TestClass { }']],
                metadatas: [[
                    {
                        filePath: '/test/file.ts',
                        type: 'function',
                        startLine: 1,
                        endLine: 3,
                        name: 'test'
                    },
                    {
                        filePath: '/test/file.ts',
                        type: 'class',
                        startLine: 5,
                        endLine: 7,
                        name: 'TestClass'
                    }
                ]],
                distances: [[0.1, 0.3]],
                ids: [['chunk-1', 'chunk-2']]
            });

            const results = await vectorStore.query(mockQueryEmbedding, 10);

            expect(results).toHaveLength(2);
            expect(results[0]).toMatchObject({
                chunk: {
                    id: 'chunk-1',
                    content: 'function test() { return true; }',
                    type: 'function',
                    filePath: '/test/file.ts',
                    startLine: 1,
                    endLine: 3
                },
                score: 0.9, // 1 - 0.1
                distance: 0.1
            });

            expect(results[1]).toMatchObject({
                chunk: {
                    id: 'chunk-2',
                    content: 'class TestClass { }',
                    type: 'class',
                    filePath: '/test/file.ts',
                    startLine: 5,
                    endLine: 7
                },
                score: 0.7, // 1 - 0.3
                distance: 0.3
            });
        });

        test('should handle empty query results', async () => {
            mockCollection.query.mockResolvedValue({
                documents: [[]],
                metadatas: [[]],
                distances: [[]],
                ids: [[]]
            });

            const results = await vectorStore.query(mockQueryEmbedding, 10);
            expect(results).toHaveLength(0);
        });

        test('should handle malformed query results', async () => {
            mockCollection.query.mockResolvedValue({
                documents: null,
                metadatas: null,
                distances: null,
                ids: null
            });

            const results = await vectorStore.query(mockQueryEmbedding, 10);
            expect(results).toHaveLength(0);
        });

        test('should sort results by score', async () => {
            mockCollection.query.mockResolvedValue({
                documents: [['doc1', 'doc2', 'doc3']],
                metadatas: [[
                    { filePath: '/test/1.ts', type: 'text', startLine: 1, endLine: 1 },
                    { filePath: '/test/2.ts', type: 'text', startLine: 1, endLine: 1 },
                    { filePath: '/test/3.ts', type: 'text', startLine: 1, endLine: 1 }
                ]],
                distances: [[0.3, 0.1, 0.2]], // Unsorted distances
                ids: [['id1', 'id2', 'id3']]
            });

            const results = await vectorStore.query(mockQueryEmbedding, 10);

            expect(results).toHaveLength(3);
            // Should be sorted by score (descending) = 1 - distance
            expect(results[0].score).toBeGreaterThan(results[1].score);
            expect(results[1].score).toBeGreaterThan(results[2].score);
        });

        test('should throw error when not initialized', async () => {
            const uninitializedStore = new VectorStore();
            
            await expect(uninitializedStore.query(mockQueryEmbedding))
                .rejects.toThrow('VectorStore not initialized');
        });

        test('should handle query errors', async () => {
            mockCollection.query.mockRejectedValue(new Error('Query failed'));

            await expect(vectorStore.query(mockQueryEmbedding))
                .rejects.toThrow('Query failed');
        });
    });

    describe('clear', () => {
        beforeEach(async () => {
            mockChromaClient.getCollection.mockResolvedValue(mockCollection);
            mockChromaClient.deleteCollection.mockResolvedValue(undefined);
            mockChromaClient.createCollection.mockResolvedValue(mockCollection);
            await vectorStore.initialize();
        });

        test('should clear collection and recreate', async () => {
            await expect(vectorStore.clear()).resolves.not.toThrow();
            
            expect(mockChromaClient.deleteCollection).toHaveBeenCalledWith({
                name: 'code_context'
            });
        });

        test('should handle clear errors', async () => {
            mockChromaClient.deleteCollection.mockRejectedValue(new Error('Clear failed'));

            await expect(vectorStore.clear()).rejects.toThrow('Clear failed');
        });
    });

    describe('getStats', () => {
        beforeEach(async () => {
            mockChromaClient.getCollection.mockResolvedValue(mockCollection);
            await vectorStore.initialize();
        });

        test('should return collection statistics', async () => {
            mockChromaClient.listCollections.mockResolvedValue([
                { name: 'code_context' },
                { name: 'other_collection' }
            ]);
            mockCollection.count.mockResolvedValue(42);

            const stats = await vectorStore.getStats();

            expect(stats).toEqual({
                count: 42,
                collections: ['code_context', 'other_collection']
            });
        });

        test('should handle stats errors', async () => {
            mockChromaClient.listCollections.mockRejectedValue(new Error('Stats failed'));

            await expect(vectorStore.getStats()).rejects.toThrow('Stats failed');
        });
    });

    describe('removeByFilePath', () => {
        beforeEach(async () => {
            mockChromaClient.getCollection.mockResolvedValue(mockCollection);
            await vectorStore.initialize();
        });

        test('should remove chunks by file path', async () => {
            mockCollection.get.mockResolvedValue({
                ids: ['chunk-1', 'chunk-2']
            });
            mockCollection.delete.mockResolvedValue(undefined);

            await expect(vectorStore.removeByFilePath('/test/file.ts'))
                .resolves.not.toThrow();

            expect(mockCollection.get).toHaveBeenCalledWith({
                where: { "filePath": '/test/file.ts' }
            });
            expect(mockCollection.delete).toHaveBeenCalledWith({
                ids: ['chunk-1', 'chunk-2']
            });
        });

        test('should handle no chunks found for file path', async () => {
            mockCollection.get.mockResolvedValue({
                ids: []
            });

            await expect(vectorStore.removeByFilePath('/nonexistent/file.ts'))
                .resolves.not.toThrow();

            expect(mockCollection.delete).not.toHaveBeenCalled();
        });

        test('should throw error when not initialized', async () => {
            const uninitializedStore = new VectorStore();
            
            await expect(uninitializedStore.removeByFilePath('/test/file.ts'))
                .rejects.toThrow('ChromaDB collection not initialized');
        });

        test('should handle removal errors', async () => {
            mockCollection.get.mockRejectedValue(new Error('Get failed'));

            await expect(vectorStore.removeByFilePath('/test/file.ts'))
                .rejects.toThrow('Get failed');
        });
    });

    describe('close', () => {
        test('should close successfully', async () => {
            await expect(vectorStore.close()).resolves.not.toThrow();
        });

        test('should handle multiple close calls', async () => {
            await vectorStore.close();
            await expect(vectorStore.close()).resolves.not.toThrow();
        });
    });
});