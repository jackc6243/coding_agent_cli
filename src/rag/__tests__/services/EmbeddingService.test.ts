import { EmbeddingService } from '../../services/EmbeddingService.js';
import type { Chunk, EmbeddedChunk } from '../../chunking/types.js';

// Mock OpenAI - need to export both default and named export for CommonJS/ESM compatibility
jest.mock('openai', () => {
    const mockOpenAI = jest.fn().mockImplementation(function() {
        return {
            embeddings: {
                create: jest.fn()
            }
        };
    });
    
    return {
        __esModule: true,
        default: mockOpenAI
    };
});

describe('EmbeddingService', () => {
    let embeddingService: EmbeddingService;
    let mockOpenAI: any;

    beforeEach(() => {
        // Mock OpenAI responses
        const OpenAI = require('openai').default;
        mockOpenAI = {
            embeddings: {
                create: jest.fn()
            }
        };
        
        (OpenAI as jest.Mock).mockImplementation(() => mockOpenAI);
        
        embeddingService = new EmbeddingService('test-api-key');
    });

    describe('constructor', () => {
        test('should create instance with provided API key', () => {
            expect(embeddingService).toBeInstanceOf(EmbeddingService);
        });

        test('should create instance with environment variable', () => {
            process.env.OPENAI_API_KEY = 'env-test-key';
            const service = new EmbeddingService();
            expect(service).toBeInstanceOf(EmbeddingService);
            delete process.env.OPENAI_API_KEY;
        });

        test('should throw error when no API key provided', () => {
            delete process.env.OPENAI_API_KEY;
            expect(() => new EmbeddingService()).toThrow('OpenAI API key is required');
        });
    });

    describe('embedChunks', () => {
        const mockChunks: Chunk[] = [
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
                }
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
                }
            }
        ];

        test('should embed chunks successfully', async () => {
            mockOpenAI.embeddings.create.mockResolvedValue({
                data: [
                    { embedding: new Array(1536).fill(0.1) },
                    { embedding: new Array(1536).fill(0.2) }
                ]
            });

            const embeddedChunks = await embeddingService.embedChunks(mockChunks);

            expect(embeddedChunks).toHaveLength(2);
            expect(embeddedChunks[0]).toHaveProperty('embedding');
            expect(embeddedChunks[0].embedding).toHaveLength(1536);
            expect(embeddedChunks[1]).toHaveProperty('embedding');
            expect(embeddedChunks[1].embedding).toHaveLength(1536);

            // Should preserve original chunk properties
            expect(embeddedChunks[0].id).toBe('chunk-1');
            expect(embeddedChunks[1].id).toBe('chunk-2');
        });

        test('should handle large batches', async () => {
            // Create 150 chunks to test batching
            const largeChunkSet: Chunk[] = Array.from({ length: 150 }, (_, i) => ({
                id: `chunk-${i}`,
                content: `Content ${i}`,
                type: 'text',
                filePath: '/test/file.ts',
                startLine: 1,
                endLine: 1,
                metadata: {}
            }));

            mockOpenAI.embeddings.create.mockResolvedValue({
                data: Array.from({ length: 100 }, () => ({ 
                    embedding: new Array(1536).fill(0.1) 
                }))
            });

            const embeddedChunks = await embeddingService.embedChunks(largeChunkSet);

            expect(embeddedChunks).toHaveLength(150);
            expect(mockOpenAI.embeddings.create).toHaveBeenCalledTimes(2); // 100 + 50
        });

        test('should handle empty chunks array', async () => {
            const embeddedChunks = await embeddingService.embedChunks([]);

            expect(embeddedChunks).toHaveLength(0);
            expect(mockOpenAI.embeddings.create).not.toHaveBeenCalled();
        });

        test('should handle API errors', async () => {
            mockOpenAI.embeddings.create.mockRejectedValue(new Error('API Error'));

            await expect(embeddingService.embedChunks(mockChunks))
                .rejects.toThrow('API Error');
        });

        test('should prepare text with metadata for embedding', async () => {
            mockOpenAI.embeddings.create.mockResolvedValue({
                data: [{ embedding: new Array(1536).fill(0.1) }]
            });

            await embeddingService.embedChunks([mockChunks[0]]);

            const callArgs = mockOpenAI.embeddings.create.mock.calls[0][0];
            expect(callArgs.input).toHaveLength(1);
            
            const preparedText = callArgs.input[0];
            expect(preparedText).toContain('/test/file.ts');
            expect(preparedText).toContain('function: test');
            expect(preparedText).toContain('function test() { return true; }');
        });
    });

    describe('embedQuery', () => {
        test('should embed query successfully', async () => {
            const mockEmbedding = new Array(1536).fill(0.5);
            mockOpenAI.embeddings.create.mockResolvedValue({
                data: [{ embedding: mockEmbedding }]
            });

            const query = 'find test functions';
            const embedding = await embeddingService.embedQuery(query);

            expect(embedding).toEqual(mockEmbedding);
            expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
                model: 'text-embedding-3-small',
                input: query,
                encoding_format: 'float'
            });
        });

        test('should handle query API errors', async () => {
            mockOpenAI.embeddings.create.mockRejectedValue(new Error('Query API Error'));

            await expect(embeddingService.embedQuery('test query'))
                .rejects.toThrow('Query API Error');
        });
    });

    describe('cosineSimilarity', () => {
        test('should calculate cosine similarity correctly', () => {
            const vectorA = [1, 0, 0];
            const vectorB = [0, 1, 0];
            const vectorC = [1, 0, 0];

            // Orthogonal vectors should have similarity of 0
            const similarity1 = EmbeddingService.cosineSimilarity(vectorA, vectorB);
            expect(similarity1).toBeCloseTo(0, 5);

            // Identical vectors should have similarity of 1
            const similarity2 = EmbeddingService.cosineSimilarity(vectorA, vectorC);
            expect(similarity2).toBeCloseTo(1, 5);
        });

        test('should handle normalized vectors', () => {
            const vectorA = [0.6, 0.8];
            const vectorB = [0.8, 0.6];

            const similarity = EmbeddingService.cosineSimilarity(vectorA, vectorB);
            expect(similarity).toBeGreaterThan(0);
            expect(similarity).toBeLessThan(1);
        });

        test('should throw error for vectors of different lengths', () => {
            const vectorA = [1, 0, 0];
            const vectorB = [1, 0];

            expect(() => EmbeddingService.cosineSimilarity(vectorA, vectorB))
                .toThrow('Vectors must have the same length');
        });

        test('should handle zero vectors', () => {
            const vectorA = [0, 0, 0];
            const vectorB = [1, 0, 0];

            const similarity = EmbeddingService.cosineSimilarity(vectorA, vectorB);
            expect(similarity).toBe(0);
        });
    });

    describe('rate limiting and batching', () => {
        test('should add delays between batches', async () => {
            const chunks: Chunk[] = Array.from({ length: 250 }, (_, i) => ({
                id: `chunk-${i}`,
                content: `Content ${i}`,
                type: 'text',
                filePath: '/test/file.ts',
                startLine: 1,
                endLine: 1,
                metadata: {}
            }));

            mockOpenAI.embeddings.create.mockResolvedValue({
                data: Array.from({ length: 100 }, () => ({ 
                    embedding: new Array(1536).fill(0.1) 
                }))
            });

            const startTime = Date.now();
            await embeddingService.embedChunks(chunks);
            const endTime = Date.now();

            // Should take at least some time due to delays between batches
            expect(endTime - startTime).toBeGreaterThan(100);
            expect(mockOpenAI.embeddings.create).toHaveBeenCalledTimes(3); // 100 + 100 + 50
        });
    });

    describe('text preparation', () => {
        test('should prepare text with minimal metadata', async () => {
            const minimalChunk: Chunk = {
                id: 'minimal',
                content: 'simple content',
                type: 'text',
                filePath: '/test/simple.txt',
                startLine: 1,
                endLine: 1,
                metadata: {}
            };

            mockOpenAI.embeddings.create.mockResolvedValue({
                data: [{ embedding: new Array(1536).fill(0.1) }]
            });

            await embeddingService.embedChunks([minimalChunk]);

            const callArgs = mockOpenAI.embeddings.create.mock.calls[0][0];
            const preparedText = callArgs.input[0];
            
            expect(preparedText).toContain('/test/simple.txt');
            expect(preparedText).toContain('simple content');
        });

        test('should handle chunks with signature metadata', async () => {
            const chunkWithSignature: Chunk = {
                id: 'with-signature',
                content: 'function complex() {\n  // complex logic\n}',
                type: 'function',
                filePath: '/test/complex.ts',
                startLine: 1,
                endLine: 3,
                metadata: {
                    name: 'complex',
                    signature: 'function complex(): void'
                }
            };

            mockOpenAI.embeddings.create.mockResolvedValue({
                data: [{ embedding: new Array(1536).fill(0.1) }]
            });

            await embeddingService.embedChunks([chunkWithSignature]);

            const callArgs = mockOpenAI.embeddings.create.mock.calls[0][0];
            const preparedText = callArgs.input[0];
            
            expect(preparedText).toContain('function: complex');
            expect(preparedText).toContain('Signature: function complex(): void');
        });
    });
});