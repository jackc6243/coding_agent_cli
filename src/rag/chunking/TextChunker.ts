import * as ts from 'typescript';
import type { Chunk } from './types.js';

export class TextChunker {
    private static readonly MAX_CHUNK_SIZE = 1000; // characters
    private static readonly OVERLAP_SIZE = 100;    // characters

    chunkFile(filePath: string, content: string, extension: string): Chunk[] {
        switch (extension) {
            case '.ts':
            case '.tsx':
                return this.chunkTypeScript(filePath, content);
            case '.js':
            case '.jsx':
                return this.chunkJavaScript(filePath, content);
            case '.md':
                return this.chunkMarkdown(filePath, content);
            default:
                return this.chunkGeneric(filePath, content);
        }
    }

    private chunkTypeScript(filePath: string, content: string): Chunk[] {
        const chunks: Chunk[] = [];
        const sourceFile = ts.createSourceFile(
            filePath,
            content,
            ts.ScriptTarget.Latest,
            true
        );

        const visit = (node: ts.Node) => {
            let chunk: Chunk | null = null;

            if (ts.isFunctionDeclaration(node) && node.name) {
                chunk = this.createNodeChunk(node, filePath, content, 'function', {
                    name: node.name.text,
                    signature: node.getText(sourceFile)
                });
            } else if (ts.isClassDeclaration(node) && node.name) {
                chunk = this.createNodeChunk(node, filePath, content, 'class', {
                    name: node.name.text
                });
            } else if (ts.isInterfaceDeclaration(node)) {
                chunk = this.createNodeChunk(node, filePath, content, 'interface', {
                    name: node.name.text
                });
            } else if (ts.isVariableDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
                chunk = this.createNodeChunk(node, filePath, content, 'variable', {
                    name: node.name.text
                });
            }

            if (chunk && chunk.content.length <= TextChunker.MAX_CHUNK_SIZE) {
                chunks.push(chunk);
            } else if (chunk && chunk.content.length > TextChunker.MAX_CHUNK_SIZE) {
                // Split large chunks
                const subChunks = this.splitLargeChunk(chunk);
                chunks.push(...subChunks);
            }

            ts.forEachChild(node, visit);
        };

        visit(sourceFile);

        // If no structured chunks found or file is small, fallback to generic chunking
        if (chunks.length === 0 || content.length <= TextChunker.MAX_CHUNK_SIZE) {
            return this.chunkGeneric(filePath, content);
        }

        return chunks;
    }

    private chunkJavaScript(filePath: string, content: string): Chunk[] {
        // For JavaScript, use simpler pattern-based chunking
        return this.chunkByPatterns(filePath, content, [
            /^(function\s+\w+|const\s+\w+\s*=\s*(?:function|\([^)]*\)\s*=>)|class\s+\w+)/gm,
            /^(export\s+(?:function|class|const|interface))/gm
        ]);
    }

    private chunkMarkdown(filePath: string, content: string): Chunk[] {
        const chunks: Chunk[] = [];
        const sections = content.split(/^(#{1,6}\s+.+)$/gm).filter(Boolean);

        let currentChunk = '';
        let chunkIndex = 0;

        for (let i = 0; i < sections.length; i++) {
            const section = sections[i];

            if (section.match(/^#{1,6}\s+/)) {
                if (currentChunk) {
                    chunks.push({
                        id: `${filePath}-md-${chunkIndex++}`,
                        content: currentChunk.trim(),
                        type: 'text',
                        filePath,
                        startLine: this.getLineNumber(content, currentChunk),
                        endLine: this.getLineNumber(content, currentChunk) + currentChunk.split('\n').length,
                        metadata: {}
                    });
                }
                currentChunk = section + '\n';
            } else {
                currentChunk += section;

                if (currentChunk.length > TextChunker.MAX_CHUNK_SIZE) {
                    chunks.push({
                        id: `${filePath}-md-${chunkIndex++}`,
                        content: currentChunk.trim(),
                        type: 'text',
                        filePath,
                        startLine: this.getLineNumber(content, currentChunk),
                        endLine: this.getLineNumber(content, currentChunk) + currentChunk.split('\n').length,
                        metadata: {}
                    });
                    currentChunk = '';
                }
            }
        }

        if (currentChunk) {
            chunks.push({
                id: `${filePath}-md-${chunkIndex++}`,
                content: currentChunk.trim(),
                type: 'text',
                filePath,
                startLine: this.getLineNumber(content, currentChunk),
                endLine: this.getLineNumber(content, currentChunk) + currentChunk.split('\n').length,
                metadata: {}
            });
        }

        return chunks;
    }

    private chunkByPatterns(filePath: string, content: string, patterns: RegExp[]): Chunk[] {
        const chunks: Chunk[] = [];
        const lines = content.split('\n');
        const matches: { line: number; type: string }[] = [];

        for (const pattern of patterns) {
            const linesByMatch = content.split('\n');
            for (let i = 0; i < linesByMatch.length; i++) {
                if (pattern.test(linesByMatch[i])) {
                    matches.push({ line: i, type: 'declaration' });
                }
            }
        }

        matches.sort((a, b) => a.line - b.line);

        for (let i = 0; i < matches.length; i++) {
            const start = matches[i].line;
            const end = i + 1 < matches.length ? matches[i + 1].line : lines.length;
            const chunkContent = lines.slice(start, end).join('\n');

            if (chunkContent.trim()) {
                chunks.push({
                    id: `${filePath}-pattern-${i}`,
                    content: chunkContent.trim(),
                    type: 'function',
                    filePath,
                    startLine: start + 1,
                    endLine: end,
                    metadata: {}
                });
            }
        }

        return chunks.length > 0 ? chunks : this.chunkGeneric(filePath, content);
    }

    private chunkGeneric(filePath: string, content: string): Chunk[] {
        const chunks: Chunk[] = [];
        const lines = content.split('\n');
        let currentChunk = '';
        let chunkIndex = 0;
        let startLine = 1;

        for (let i = 0; i < lines.length; i++) {
            currentChunk += lines[i] + '\n';

            if (currentChunk.length >= TextChunker.MAX_CHUNK_SIZE) {
                chunks.push({
                    id: `${filePath}-generic-${chunkIndex++}`,
                    content: currentChunk.trim(),
                    type: 'text',
                    filePath,
                    startLine,
                    endLine: i + 1,
                    metadata: {}
                });

                // Add overlap for continuity
                const overlapLines = Math.min(3, Math.floor(TextChunker.OVERLAP_SIZE / 50));
                currentChunk = lines.slice(Math.max(0, i - overlapLines), i + 1).join('\n') + '\n';
                startLine = Math.max(1, i - overlapLines + 2);
            }
        }

        if (currentChunk.trim()) {
            chunks.push({
                id: `${filePath}-generic-${chunkIndex++}`,
                content: currentChunk.trim(),
                type: 'text',
                filePath,
                startLine,
                endLine: lines.length,
                metadata: {}
            });
        }

        return chunks;
    }

    private createNodeChunk(
        node: ts.Node,
        filePath: string,
        _fullContent: string,
        type: Chunk['type'],
        metadata: Chunk['metadata']
    ): Chunk {
        const sourceFile = node.getSourceFile();
        const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());

        return {
            id: `${filePath}-${type}-${metadata.name || 'anonymous'}-${start.line}`,
            content: node.getText(sourceFile),
            type,
            filePath,
            startLine: start.line + 1,
            endLine: end.line + 1,
            metadata
        };
    }

    private splitLargeChunk(chunk: Chunk): Chunk[] {
        const lines = chunk.content.split('\n');
        const chunks: Chunk[] = [];
        let currentLines: string[] = [];
        let chunkIndex = 0;

        for (const line of lines) {
            currentLines.push(line);
            const currentContent = currentLines.join('\n');

            if (currentContent.length >= TextChunker.MAX_CHUNK_SIZE) {
                chunks.push({
                    ...chunk,
                    id: `${chunk.id}-split-${chunkIndex++}`,
                    content: currentContent,
                    endLine: chunk.startLine + currentLines.length - 1
                });

                // Keep some overlap
                const overlapLines = Math.min(2, currentLines.length - 1);
                currentLines = currentLines.slice(-overlapLines);
            }
        }

        if (currentLines.length > 0) {
            chunks.push({
                ...chunk,
                id: `${chunk.id}-split-${chunkIndex++}`,
                content: currentLines.join('\n'),
                startLine: chunk.endLine - currentLines.length + 1
            });
        }

        return chunks;
    }

    private getLineNumber(content: string, chunk: string): number {
        const index = content.indexOf(chunk);
        if (index === -1) return 1;
        return content.substring(0, index).split('\n').length;
    }
}