import { TextChunker } from '../../chunking/TextChunker.js';
import type { Chunk } from '../../chunking/types.js';

// Mock TypeScript to avoid complex setup
jest.mock('typescript', () => ({
    createSourceFile: jest.fn((filename, content, target, setParentNodes) => ({
        forEachChild: jest.fn((cb) => {
            // Mock AST traversal
            cb({
                kind: 251, // FunctionDeclaration
                name: { text: 'testFunction' },
                getText: () => 'function testFunction() { return true; }',
                getStart: () => 0,
                getEnd: () => 41,
                getSourceFile: () => ({
                    getLineAndCharacterOfPosition: (pos: number) => ({
                        line: 0,
                        character: pos
                    })
                })
            });
        }),
        text: content
    })),
    isFunctionDeclaration: jest.fn(() => true),
    isClassDeclaration: jest.fn(() => false),
    isInterfaceDeclaration: jest.fn(() => false),
    isVariableDeclaration: jest.fn(() => false),
    isIdentifier: jest.fn(() => true),
    forEachChild: jest.fn(),
    ScriptTarget: {
        Latest: 99
    }
}));

describe('TextChunker', () => {
    let textChunker: TextChunker;

    beforeEach(() => {
        textChunker = new TextChunker();
    });

    describe('chunkFile', () => {
        test('should chunk TypeScript file', () => {
            const filePath = '/test/file.ts';
            const content = `
function testFunction() {
    return true;
}

class TestClass {
    method() {
        return 'test';
    }
}`;
            
            const chunks = textChunker.chunkFile(filePath, content, '.ts');
            
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
            });
        });

        test('should chunk JavaScript file', () => {
            const filePath = '/test/file.js';
            const content = `
function testFunction() {
    return true;
}

const arrow = () => {
    return 'arrow';
};

export class TestClass {
    method() {
        return 'test';
    }
}`;
            
            const chunks = textChunker.chunkFile(filePath, content, '.js');
            
            expect(Array.isArray(chunks)).toBe(true);
            expect(chunks.length).toBeGreaterThan(0);
        });

        test('should chunk Markdown file', () => {
            const filePath = '/test/README.md';
            const content = `# Main Title

This is some content under the main title.

## Section 1

Content for section 1.

### Subsection 1.1

More detailed content.

## Section 2

Content for section 2.`;
            
            const chunks = textChunker.chunkFile(filePath, content, '.md');
            
            expect(Array.isArray(chunks)).toBe(true);
            expect(chunks.length).toBeGreaterThan(0);
            
            chunks.forEach(chunk => {
                expect(chunk.type).toBe('text');
                expect(chunk.filePath).toBe(filePath);
            });
        });

        test('should handle generic file types', () => {
            const filePath = '/test/file.txt';
            const content = 'A'.repeat(2000); // Long content to test chunking
            
            const chunks = textChunker.chunkFile(filePath, content, '.txt');
            
            expect(Array.isArray(chunks)).toBe(true);
            expect(chunks.length).toBeGreaterThan(1); // Should be split into multiple chunks
            
            chunks.forEach(chunk => {
                expect(chunk.type).toBe('text');
                expect(chunk.content.length).toBeLessThanOrEqual(1100); // Max chunk size + overlap
            });
        });

        test('should handle empty content', () => {
            const filePath = '/test/empty.ts';
            const content = '';
            
            const chunks = textChunker.chunkFile(filePath, content, '.ts');
            
            expect(Array.isArray(chunks)).toBe(true);
            // Should return empty array or single empty chunk depending on implementation
        });

        test('should handle very large functions', () => {
            const filePath = '/test/large.ts';
            const content = `
function largeFunction() {
    ${'    console.log("line");\n'.repeat(100)}
}`;
            
            const chunks = textChunker.chunkFile(filePath, content, '.ts');
            
            expect(Array.isArray(chunks)).toBe(true);
            // Large functions should be split appropriately
        });
    });

    describe('chunk properties validation', () => {
        test('should create valid chunk objects', () => {
            const filePath = '/test/file.ts';
            const content = 'function test() { return true; }';
            
            const chunks = textChunker.chunkFile(filePath, content, '.ts');
            
            chunks.forEach(chunk => {
                // Test required properties
                expect(typeof chunk.id).toBe('string');
                expect(chunk.id.length).toBeGreaterThan(0);
                
                expect(typeof chunk.content).toBe('string');
                expect(['function', 'class', 'interface', 'variable', 'comment', 'text']).toContain(chunk.type);
                
                expect(chunk.filePath).toBe(filePath);
                expect(typeof chunk.startLine).toBe('number');
                expect(typeof chunk.endLine).toBe('number');
                expect(chunk.startLine).toBeGreaterThan(0);
                expect(chunk.endLine).toBeGreaterThanOrEqual(chunk.startLine);
                
                expect(typeof chunk.metadata).toBe('object');
                expect(chunk.metadata).not.toBeNull();
            });
        });

        test('should generate unique chunk IDs', () => {
            const filePath = '/test/file.ts';
            const content = `
function func1() { return 1; }
function func2() { return 2; }
function func3() { return 3; }`;
            
            const chunks = textChunker.chunkFile(filePath, content, '.ts');
            
            const ids = chunks.map(chunk => chunk.id);
            const uniqueIds = new Set(ids);
            
            expect(uniqueIds.size).toBe(ids.length);
        });
    });

    describe('edge cases', () => {
        test('should handle malformed TypeScript', () => {
            const filePath = '/test/malformed.ts';
            const content = `
function incomplete(
class Missing {
    method() {
        // unclosed brace
`;
            
            // Should not throw and should fall back to generic chunking
            expect(() => {
                const chunks = textChunker.chunkFile(filePath, content, '.ts');
                expect(Array.isArray(chunks)).toBe(true);
            }).not.toThrow();
        });

        test('should handle files with only whitespace', () => {
            const filePath = '/test/whitespace.ts';
            const content = '   \n\n   \t   \n   ';
            
            const chunks = textChunker.chunkFile(filePath, content, '.ts');
            
            expect(Array.isArray(chunks)).toBe(true);
            // Should handle gracefully without creating empty chunks
        });

        test('should handle single line files', () => {
            const filePath = '/test/single.ts';
            const content = 'const x = 42;';
            
            const chunks = textChunker.chunkFile(filePath, content, '.ts');
            
            expect(Array.isArray(chunks)).toBe(true);
            expect(chunks.length).toBeGreaterThanOrEqual(1);
            
            if (chunks.length > 0) {
                expect(chunks[0].startLine).toBe(chunks[0].endLine);
            }
        });

        test('should handle files with special characters', () => {
            const filePath = '/test/special.ts';
            const content = `
function 测试() {
    return "unicode: 🎉";
}

// Comment with émojis: 🚀 💻 ⚡
const árrowFunction = () => "àccénts";`;
            
            const chunks = textChunker.chunkFile(filePath, content, '.ts');
            
            expect(Array.isArray(chunks)).toBe(true);
            expect(chunks.length).toBeGreaterThan(0);
            
            // Should preserve special characters
            const hasUnicode = chunks.some(chunk => 
                chunk.content.includes('测试') || 
                chunk.content.includes('🎉') ||
                chunk.content.includes('àccénts')
            );
            expect(hasUnicode).toBe(true);
        });
    });
});