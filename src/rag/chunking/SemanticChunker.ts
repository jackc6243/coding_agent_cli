import { ASTIndexer, ASTNode, ParsedFile } from '../ast/ASTIndexer.js';
import type { Chunk, SemanticChunk } from './types.js';

export class SemanticChunker {
    private astIndexer: ASTIndexer;
    private maxChunkSize: number = 2000; // characters
    private minChunkSize: number = 100;  // characters

    constructor() {
        this.astIndexer = new ASTIndexer();
    }

    async initialize(): Promise<void> {
        await this.astIndexer.initialize();
    }

    /**
     * Chunk a file using AST-based semantic analysis
     */
    async chunkFile(filePath: string, content: string, extension: string): Promise<SemanticChunk[]> {
        try {
            // Check if the file type is supported by tree-sitter
            if (!this.astIndexer.isSupported(extension)) {
                return this.chunkGeneric(filePath, content, extension);
            }

            // Parse the file with tree-sitter
            const parsedFile = await this.astIndexer.parseFile(filePath, content);
            
            // Convert AST nodes to semantic chunks
            const semanticChunks = this.convertASTNodesToChunks(parsedFile);
            
            // Post-process chunks (split large ones, merge small ones, etc.)
            return this.postProcessChunks(semanticChunks);

        } catch (error) {
            console.warn(`Failed to parse ${filePath} with tree-sitter, falling back to generic chunking:`, error);
            return this.chunkGeneric(filePath, content, extension);
        }
    }

    /**
     * Convert AST nodes to semantic chunks
     */
    private convertASTNodesToChunks(parsedFile: ParsedFile): SemanticChunk[] {
        const chunks: SemanticChunk[] = [];
        
        for (const astNode of parsedFile.nodes) {
            const chunk = this.createSemanticChunk(astNode, parsedFile);
            if (chunk) {
                chunks.push(chunk);
            }
        }

        // If no semantic chunks were created, create a single chunk for the whole file
        if (chunks.length === 0) {
            const lines = parsedFile.tree.rootNode.text.split('\n');
            chunks.push({
                id: `${parsedFile.filePath}-whole-file`,
                content: parsedFile.tree.rootNode.text,
                type: 'text',
                filePath: parsedFile.filePath,
                startLine: 1,
                endLine: lines.length,
                metadata: {
                    language: parsedFile.language,
                    wholefile: true
                },
                semanticType: 'chunk',
                language: parsedFile.language
            });
        }

        return chunks;
    }

    /**
     * Create a semantic chunk from an AST node
     */
    private createSemanticChunk(astNode: ASTNode, parsedFile: ParsedFile): SemanticChunk | null {
        // Calculate complexity based on content and node type
        const complexity = this.calculateComplexity(astNode);
        
        // Extract dependencies (imports, calls, etc.)
        const dependencies = this.extractDependencies(astNode);

        // Map AST node type to semantic type
        const semanticType = this.mapToSemanticType(astNode.type);

        const chunk: SemanticChunk = {
            id: astNode.id,
            content: astNode.content,
            type: this.mapToChunkType(astNode.type),
            filePath: astNode.filePath,
            startLine: astNode.startLine,
            endLine: astNode.endLine,
            metadata: {
                name: astNode.name,
                signature: astNode.signature,
                language: astNode.language,
                nodeType: astNode.type,
                ...astNode.metadata
            },
            astNode,
            semanticType,
            language: astNode.language,
            complexity,
            dependencies
        };

        return chunk;
    }

    /**
     * Calculate complexity score for an AST node
     */
    private calculateComplexity(astNode: ASTNode): number {
        let complexity = 1;
        
        // Base complexity by type
        const typeComplexity = {
            'function': 3,
            'class': 5,
            'interface': 2,
            'type': 1,
            'variable': 1,
            'import': 1,
            'export': 1
        };
        
        complexity += typeComplexity[astNode.type as keyof typeof typeComplexity] || 1;
        
        // Add complexity based on content size
        complexity += Math.floor(astNode.content.length / 500);
        
        // Add complexity for nested structures (count braces/indentation)
        const braces = (astNode.content.match(/[{}]/g) || []).length;
        complexity += braces / 2;
        
        // Add complexity for control flow (if, for, while, etc.)
        const controlFlow = (astNode.content.match(/\b(if|for|while|switch|try|catch)\b/g) || []).length;
        complexity += controlFlow;
        
        return Math.max(1, Math.floor(complexity));
    }

    /**
     * Extract dependencies from an AST node
     */
    private extractDependencies(astNode: ASTNode): string[] {
        const dependencies: string[] = [];
        
        // Extract import dependencies
        const importMatches = astNode.content.match(/(?:import|from|require)\s+['"`]([^'"`]+)['"`]/g);
        if (importMatches) {
            importMatches.forEach(match => {
                const dep = match.match(/['"`]([^'"`]+)['"`]/)?.[1];
                if (dep) dependencies.push(dep);
            });
        }
        
        // Extract function/class calls
        const callMatches = astNode.content.match(/\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g);
        if (callMatches) {
            callMatches.forEach(match => {
                const funcName = match.replace(/\s*\($/, '');
                if (funcName && !['if', 'for', 'while', 'switch'].includes(funcName)) {
                    dependencies.push(funcName);
                }
            });
        }
        
        return Array.from(new Set(dependencies)).slice(0, 10); // Limit and deduplicate
    }

    /**
     * Map AST node type to semantic type
     */
    private mapToSemanticType(nodeType: string): SemanticChunk['semanticType'] {
        const mapping = {
            'function': 'function' as const,
            'class': 'class' as const,
            'interface': 'interface' as const,
            'type': 'type' as const,
            'variable': 'variable' as const,
            'constant': 'variable' as const,
            'import': 'import' as const,
            'export': 'export' as const,
            'struct': 'class' as const,
            'trait': 'interface' as const,
            'enum': 'type' as const,
            'namespace': 'type' as const,
            'module': 'type' as const
        };
        
        return mapping[nodeType as keyof typeof mapping] || 'chunk';
    }

    /**
     * Map AST node type to chunk type (for backwards compatibility)
     */
    private mapToChunkType(nodeType: string): Chunk['type'] {
        const mapping = {
            'function': 'function' as const,
            'class': 'class' as const,
            'interface': 'interface' as const,
            'type': 'interface' as const,
            'variable': 'variable' as const,
            'constant': 'variable' as const,
            'import': 'text' as const,
            'export': 'text' as const
        };
        
        return mapping[nodeType as keyof typeof mapping] || 'text';
    }

    /**
     * Post-process chunks to optimize size and structure
     */
    private postProcessChunks(chunks: SemanticChunk[]): SemanticChunk[] {
        const processedChunks: SemanticChunk[] = [];
        
        for (const chunk of chunks) {
            // Split large chunks
            if (chunk.content.length > this.maxChunkSize) {
                const splitChunks = this.splitLargeChunk(chunk);
                processedChunks.push(...splitChunks);
            } else {
                processedChunks.push(chunk);
            }
        }
        
        // Merge small consecutive chunks of the same type
        return this.mergeSmallChunks(processedChunks);
    }

    /**
     * Split a large chunk into smaller ones while preserving semantic boundaries
     */
    private splitLargeChunk(chunk: SemanticChunk): SemanticChunk[] {
        const lines = chunk.content.split('\n');
        const splitChunks: SemanticChunk[] = [];
        
        // For functions and classes, try to split by internal functions/methods
        if (chunk.semanticType === 'function' || chunk.semanticType === 'class') {
            return this.splitByInternalStructures(chunk, lines);
        }
        
        // For other types, split by line count
        const maxLines = Math.floor(this.maxChunkSize / 50); // Rough estimate of chars per line
        let currentLines: string[] = [];
        let startLine = chunk.startLine;
        let chunkIndex = 0;
        
        for (let i = 0; i < lines.length; i++) {
            currentLines.push(lines[i]);
            
            if (currentLines.length >= maxLines || i === lines.length - 1) {
                const splitChunk: SemanticChunk = {
                    ...chunk,
                    id: `${chunk.id}-split-${chunkIndex++}`,
                    content: currentLines.join('\n'),
                    startLine,
                    endLine: startLine + currentLines.length - 1
                };
                splitChunks.push(splitChunk);
                
                startLine += currentLines.length;
                currentLines = [];
            }
        }
        
        return splitChunks;
    }

    /**
     * Split by internal semantic structures (methods within classes, etc.)
     */
    private splitByInternalStructures(chunk: SemanticChunk, lines: string[]): SemanticChunk[] {
        // This is a simplified implementation
        // In practice, you'd want to re-parse the chunk content to find internal structures
        const splitChunks: SemanticChunk[] = [];
        const maxLines = Math.floor(this.maxChunkSize / 50);
        
        let currentLines: string[] = [];
        let startLine = chunk.startLine;
        let chunkIndex = 0;
        
        for (let i = 0; i < lines.length; i++) {
            currentLines.push(lines[i]);
            
            // Look for method/function boundaries within the chunk
            const line = lines[i].trim();
            const isMethodBoundary = line.includes('function') || 
                                   line.match(/^\s*(public|private|protected).*\(/) ||
                                   line.match(/^\s*def\s+/) ||
                                   line.match(/^\s*\w+\s*\(/);
            
            if ((isMethodBoundary && currentLines.length > 10) || 
                currentLines.length >= maxLines || 
                i === lines.length - 1) {
                
                const splitChunk: SemanticChunk = {
                    ...chunk,
                    id: `${chunk.id}-split-${chunkIndex++}`,
                    content: currentLines.join('\n'),
                    startLine,
                    endLine: startLine + currentLines.length - 1,
                    semanticType: isMethodBoundary ? 'function' : chunk.semanticType
                };
                splitChunks.push(splitChunk);
                
                startLine += currentLines.length;
                currentLines = [];
            }
        }
        
        return splitChunks;
    }

    /**
     * Merge small consecutive chunks of similar types
     */
    private mergeSmallChunks(chunks: SemanticChunk[]): SemanticChunk[] {
        const mergedChunks: SemanticChunk[] = [];
        let i = 0;
        
        while (i < chunks.length) {
            const currentChunk = chunks[i];
            
            // If chunk is too small and can be merged with the next one
            if (currentChunk.content.length < this.minChunkSize && i + 1 < chunks.length) {
                const nextChunk = chunks[i + 1];
                
                // Only merge if they're from the same file and compatible types
                if (currentChunk.filePath === nextChunk.filePath &&
                    this.canMergeChunks(currentChunk, nextChunk)) {
                    
                    const mergedChunk: SemanticChunk = {
                        ...currentChunk,
                        id: `${currentChunk.id}-merged-${nextChunk.id}`,
                        content: currentChunk.content + '\n\n' + nextChunk.content,
                        endLine: nextChunk.endLine,
                        semanticType: 'chunk',
                        dependencies: [...(currentChunk.dependencies || []), ...(nextChunk.dependencies || [])],
                        complexity: (currentChunk.complexity || 1) + (nextChunk.complexity || 1)
                    };
                    
                    mergedChunks.push(mergedChunk);
                    i += 2; // Skip both chunks
                    continue;
                }
            }
            
            mergedChunks.push(currentChunk);
            i++;
        }
        
        return mergedChunks;
    }

    /**
     * Check if two chunks can be merged
     */
    private canMergeChunks(chunk1: SemanticChunk, chunk2: SemanticChunk): boolean {
        // Don't merge functions or classes with other semantic types
        if (chunk1.semanticType === 'function' || chunk1.semanticType === 'class' ||
            chunk2.semanticType === 'function' || chunk2.semanticType === 'class') {
            return false;
        }
        
        // Check if total size would be reasonable
        const totalSize = chunk1.content.length + chunk2.content.length;
        if (totalSize > this.maxChunkSize) {
            return false;
        }
        
        // Check if chunks are adjacent or close
        const lineGap = chunk2.startLine - chunk1.endLine;
        if (lineGap > 5) {
            return false;
        }
        
        return true;
    }

    /**
     * Fallback generic chunking for unsupported file types
     */
    private chunkGeneric(filePath: string, content: string, extension: string): SemanticChunk[] {
        const chunks: SemanticChunk[] = [];
        const lines = content.split('\n');
        const chunkSize = 50; // lines per chunk
        
        for (let i = 0; i < lines.length; i += chunkSize) {
            const endLine = Math.min(i + chunkSize, lines.length);
            const chunkContent = lines.slice(i, endLine).join('\n');
            
            if (chunkContent.trim()) {
                chunks.push({
                    id: `${filePath}-generic-${i}`,
                    content: chunkContent,
                    type: 'text',
                    filePath,
                    startLine: i + 1,
                    endLine,
                    metadata: {
                        chunkIndex: Math.floor(i / chunkSize),
                        extension
                    },
                    semanticType: 'chunk',
                    language: extension.slice(1), // Remove the dot
                    complexity: 1
                });
            }
        }
        
        return chunks;
    }

    /**
     * Get supported languages from the AST indexer
     */
    getSupportedLanguages(): string[] {
        return this.astIndexer.getSupportedLanguages();
    }

    /**
     * Check if a file extension is supported
     */
    isSupported(extension: string): boolean {
        return this.astIndexer.isSupported(extension);
    }

    /**
     * Get chunking statistics
     */
    getChunkingStats(chunks: SemanticChunk[]): {
        totalChunks: number;
        semanticTypes: Record<string, number>;
        averageComplexity: number;
        averageSize: number;
        languageDistribution: Record<string, number>;
    } {
        const stats = {
            totalChunks: chunks.length,
            semanticTypes: {} as Record<string, number>,
            averageComplexity: 0,
            averageSize: 0,
            languageDistribution: {} as Record<string, number>
        };

        let totalComplexity = 0;
        let totalSize = 0;

        for (const chunk of chunks) {
            // Count semantic types
            stats.semanticTypes[chunk.semanticType] = (stats.semanticTypes[chunk.semanticType] || 0) + 1;
            
            // Count languages
            stats.languageDistribution[chunk.language] = (stats.languageDistribution[chunk.language] || 0) + 1;
            
            // Sum for averages
            totalComplexity += chunk.complexity || 1;
            totalSize += chunk.content.length;
        }

        stats.averageComplexity = chunks.length > 0 ? totalComplexity / chunks.length : 0;
        stats.averageSize = chunks.length > 0 ? totalSize / chunks.length : 0;

        return stats;
    }
}