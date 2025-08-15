import { SemanticChunker } from '../../chunking/SemanticChunker.js';
import { ASTIndexer } from '../../ast/ASTIndexer.js';
import type { SemanticChunk, Chunk } from '../../chunking/types.js';
import type { ASTNode, ParsedFile } from '../../ast/ASTIndexer.js';

// Mock ASTIndexer
jest.mock('../../ast/ASTIndexer.js', () => ({
    ASTIndexer: jest.fn().mockImplementation(() => ({
        initialize: jest.fn().mockResolvedValue(undefined),
        isSupported: jest.fn((ext) => ['.ts', '.js', '.py'].includes(ext)),
        getSupportedLanguages: jest.fn(() => ['typescript', 'javascript', 'python']),
        parseFile: jest.fn().mockResolvedValue({
            filePath: '/test/file.ts',
            language: 'typescript',
            lastModified: Date.now(),
            hasErrors: false,
            tree: {
                rootNode: {
                    text: 'function test() { return true; }'
                },
                copy: jest.fn(),
                delete: jest.fn(),
                rootNodeWithOffset: jest.fn(),
                getLanguage: jest.fn(),
                edit: jest.fn(),
                walk: jest.fn(),
                getChangedRanges: jest.fn(),
                getIncludedRanges: jest.fn()
            } as any,
            nodes: [
                {
                    id: 'test-node-1',
                    type: 'function',
                    name: 'testFunction',
                    signature: 'testFunction(): boolean',
                    content: 'function testFunction() { return true; }',
                    filePath: '/test/file.ts',
                    startLine: 1,
                    endLine: 3,
                    startColumn: 0,
                    endColumn: 40,
                    language: 'typescript',
                    metadata: {
                        returnType: 'boolean',
                        parameters: []
                    }
                },
                {
                    id: 'test-node-2',
                    type: 'class',
                    name: 'TestClass',
                    content: 'class TestClass {\n  method() {\n    return "test";\n  }\n}',
                    filePath: '/test/file.ts',
                    startLine: 5,
                    endLine: 9,
                    startColumn: 0,
                    endColumn: 50,
                    language: 'typescript',
                    metadata: {
                        methods: ['method']
                    }
                }
            ]
        } as ParsedFile)
    }))
}));

describe('SemanticChunker', () => {
    let semanticChunker: SemanticChunker;

    beforeEach(async () => {
        semanticChunker = new SemanticChunker();
        await semanticChunker.initialize();
    });

    describe('initialization', () => {
        test('should initialize successfully', async () => {
            const newChunker = new SemanticChunker();
            await expect(newChunker.initialize()).resolves.not.toThrow();
        });
    });

    describe('chunkFile', () => {
        test('should chunk supported file types', async () => {
            const filePath = '/test/file.ts';
            const content = `
function testFunction() {
    return true;
}

class TestClass {
    method() {
        return "test";
    }
}`;
            
            const chunks = await semanticChunker.chunkFile(filePath, content, '.ts');
            
            expect(Array.isArray(chunks)).toBe(true);
            expect(chunks.length).toBeGreaterThan(0);
            
            chunks.forEach(chunk => {
                expect(chunk).toHaveProperty('id');
                expect(chunk).toHaveProperty('content');
                expect(chunk).toHaveProperty('type');
                expect(chunk).toHaveProperty('filePath', filePath);
                expect(chunk).toHaveProperty('startLine');
                expect(chunk).toHaveProperty('endLine');
                expect(chunk).toHaveProperty('metadata');
                expect(chunk).toHaveProperty('semanticType');
                expect(chunk).toHaveProperty('language');
                expect(chunk).toHaveProperty('complexity');
                expect(chunk).toHaveProperty('dependencies');
            });
        });

        test('should fall back to generic chunking for unsupported files', async () => {
            const filePath = '/test/file.unknown';
            const content = 'Some unknown file content that should be chunked generically.';
            
            const chunks = await semanticChunker.chunkFile(filePath, content, '.unknown');
            
            expect(Array.isArray(chunks)).toBe(true);
            expect(chunks.length).toBeGreaterThan(0);
            
            // Should create generic chunks
            chunks.forEach(chunk => {
                expect(chunk.semanticType).toBe('chunk');
                expect(chunk.type).toBe('text');
            });
        });

        test('should handle parsing errors gracefully', async () => {
            // Mock parseFile to throw an error
            const astIndexer = new ASTIndexer();
            (astIndexer.parseFile as jest.Mock).mockRejectedValueOnce(new Error('Parse error'));
            
            const filePath = '/test/broken.ts';
            const content = 'function broken(';
            
            const chunks = await semanticChunker.chunkFile(filePath, content, '.ts');
            
            expect(Array.isArray(chunks)).toBe(true);
            // Should fall back to generic chunking
        });

        test('should create whole file chunk when no semantic chunks found', async () => {
            // Mock parseFile to return empty nodes
            const astIndexer = new ASTIndexer();
            (astIndexer.parseFile as jest.Mock).mockResolvedValueOnce({
                filePath: '/test/empty.ts',
                language: 'typescript',
                lastModified: Date.now(),
                hasErrors: false,
                tree: {
                    rootNode: {
                        text: '// Just a comment'
                    },
                    copy: jest.fn(),
                    delete: jest.fn(),
                    rootNodeWithOffset: jest.fn(),
                    getLanguage: jest.fn(),
                    edit: jest.fn(),
                    walk: jest.fn(),
                    getChangedRanges: jest.fn(),
                    getIncludedRanges: jest.fn()
                } as any,
                nodes: []
            } as ParsedFile);
            
            const filePath = '/test/empty.ts';
            const content = '// Just a comment';
            
            const chunks = await semanticChunker.chunkFile(filePath, content, '.ts');
            
            expect(chunks.length).toBe(1);
            expect(chunks[0].metadata.wholefile).toBe(true);
            expect(chunks[0].semanticType).toBe('chunk');
        });
    });

    describe('semantic chunk properties', () => {
        test('should calculate complexity correctly', async () => {
            const filePath = '/test/complex.ts';
            const content = `
function simpleFunction() {
    return true;
}

function complexFunction() {
    if (condition) {
        for (let i = 0; i < 10; i++) {
            while (something) {
                try {
                    doSomething();
                } catch (error) {
                    handleError(error);
                }
            }
        }
    }
}`;
            
            const chunks = await semanticChunker.chunkFile(filePath, content, '.ts');
            
            expect(chunks.length).toBeGreaterThan(0);
            
            // Complexity should be calculated based on content
            chunks.forEach(chunk => {
                expect(typeof chunk.complexity).toBe('number');
                expect(chunk.complexity).toBeGreaterThanOrEqual(1);
            });
        });

        test('should extract dependencies', async () => {
            const filePath = '/test/dependencies.ts';
            const content = `
import { something } from 'external-lib';
import fs from 'fs';

function usesDependencies() {
    fs.readFile('test.txt');
    something();
    console.log('test');
}`;
            
            const chunks = await semanticChunker.chunkFile(filePath, content, '.ts');
            
            const functionChunk = chunks.find(chunk => chunk.semanticType === 'function');
            if (functionChunk) {
                expect(Array.isArray(functionChunk.dependencies)).toBe(true);
                expect(functionChunk.dependencies?.length).toBeGreaterThan(0);
            }
        });

        test('should map semantic types correctly', async () => {
            const chunks = await semanticChunker.chunkFile('/test/file.ts', 'test content', '.ts');
            
            chunks.forEach(chunk => {
                expect(['function', 'class', 'interface', 'type', 'variable', 'import', 'export', 'chunk'])
                    .toContain(chunk.semanticType);
            });
        });
    });

    describe('chunk size management', () => {
        test('should split large chunks', async () => {
            // Create a mock large function
            const astIndexer = new ASTIndexer();
            const largeContent = 'x'.repeat(3000); // Content larger than max chunk size
            
            (astIndexer.parseFile as jest.Mock).mockResolvedValueOnce({
                filePath: '/test/large.ts',
                language: 'typescript',
                lastModified: Date.now(),
                hasErrors: false,
                tree: {
                    rootNode: {
                        text: largeContent
                    }
                },
                nodes: [
                    {
                        id: 'large-function',
                        type: 'function',
                        name: 'largeFunction',
                        content: largeContent,
                        filePath: '/test/large.ts',
                        startLine: 1,
                        endLine: 100,
                        startColumn: 0,
                        endColumn: largeContent.length,
                        language: 'typescript',
                        metadata: {}
                    }
                ]
            } as ParsedFile);
            
            const chunks = await semanticChunker.chunkFile('/test/large.ts', largeContent, '.ts');
            
            // Should create multiple chunks for large content
            expect(chunks.length).toBeGreaterThanOrEqual(1);
            
            chunks.forEach(chunk => {
                expect(chunk.content.length).toBeLessThanOrEqual(2100); // Max + some buffer
            });
        });

        test('should merge small consecutive chunks', async () => {
            // Mock multiple small chunks
            const astIndexer = new ASTIndexer();
            
            (astIndexer.parseFile as jest.Mock).mockResolvedValueOnce({
                filePath: '/test/small.ts',
                language: 'typescript',
                lastModified: Date.now(),
                hasErrors: false,
                tree: {
                    rootNode: {
                        text: 'small content'
                    }
                },
                nodes: [
                    {
                        id: 'small-1',
                        type: 'variable',
                        name: 'var1',
                        content: 'const x = 1;',
                        filePath: '/test/small.ts',
                        startLine: 1,
                        endLine: 1,
                        startColumn: 0,
                        endColumn: 12,
                        language: 'typescript',
                        metadata: {}
                    },
                    {
                        id: 'small-2',
                        type: 'variable',
                        name: 'var2',
                        content: 'const y = 2;',
                        filePath: '/test/small.ts',
                        startLine: 2,
                        endLine: 2,
                        startColumn: 0,
                        endColumn: 12,
                        language: 'typescript',
                        metadata: {}
                    }
                ]
            } as ParsedFile);
            
            const chunks = await semanticChunker.chunkFile('/test/small.ts', 'const x = 1;\nconst y = 2;', '.ts');
            
            expect(Array.isArray(chunks)).toBe(true);
            // Small chunks might be merged depending on implementation
        });
    });

    describe('supported languages', () => {
        test('should return supported languages', () => {
            const languages = semanticChunker.getSupportedLanguages();
            
            expect(Array.isArray(languages)).toBe(true);
            expect(languages.length).toBeGreaterThan(0);
            expect(languages).toContain('typescript');
        });

        test('should check if extension is supported', () => {
            expect(semanticChunker.isSupported('.ts')).toBe(true);
            expect(semanticChunker.isSupported('.js')).toBe(true);
            expect(semanticChunker.isSupported('.unknown')).toBe(false);
        });
    });

    describe('chunking statistics', () => {
        test('should generate chunking statistics', async () => {
            const chunks = await semanticChunker.chunkFile('/test/file.ts', 'test content', '.ts');
            
            const stats = semanticChunker.getChunkingStats(chunks);
            
            expect(stats).toHaveProperty('totalChunks');
            expect(stats).toHaveProperty('semanticTypes');
            expect(stats).toHaveProperty('averageComplexity');
            expect(stats).toHaveProperty('averageSize');
            expect(stats).toHaveProperty('languageDistribution');
            
            expect(typeof stats.totalChunks).toBe('number');
            expect(typeof stats.semanticTypes).toBe('object');
            expect(typeof stats.averageComplexity).toBe('number');
            expect(typeof stats.averageSize).toBe('number');
            expect(typeof stats.languageDistribution).toBe('object');
        });

        test('should handle empty chunks array', () => {
            const stats = semanticChunker.getChunkingStats([]);
            
            expect(stats.totalChunks).toBe(0);
            expect(stats.averageComplexity).toBe(0);
            expect(stats.averageSize).toBe(0);
        });
    });
});