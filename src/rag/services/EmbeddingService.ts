import OpenAI from 'openai';
import type { Chunk, EmbeddedChunk } from '../chunking/types.js';
import { SERVICE_CONFIG } from '../../config/Constants.js';

export class EmbeddingService {
    private openai: OpenAI;
    private readonly model = SERVICE_CONFIG.EMBEDDING_MODEL;
    private readonly batchSize = SERVICE_CONFIG.EMBEDDING_BATCH_SIZE;

    constructor(apiKey?: string) {
        if (!apiKey && !process.env.OPENAI_API_KEY) {
            throw new Error('OpenAI API key is required. Set OPENAI_API_KEY environment variable or pass it to constructor.');
        }
        
        this.openai = new OpenAI({
            apiKey: apiKey || process.env.OPENAI_API_KEY
        });
    }

    async embedChunks(chunks: Chunk[]): Promise<EmbeddedChunk[]> {
        const embeddedChunks: EmbeddedChunk[] = [];
        
        // Process chunks in batches to avoid rate limits
        for (let i = 0; i < chunks.length; i += this.batchSize) {
            const batch = chunks.slice(i, i + this.batchSize);
            console.log(`Embedding batch ${Math.floor(i / this.batchSize) + 1}/${Math.ceil(chunks.length / this.batchSize)} (${batch.length} chunks)`);
            
            const batchEmbeddings = await this.embedBatch(batch);
            embeddedChunks.push(...batchEmbeddings);
            
            // Add a small delay to avoid rate limiting
            if (i + this.batchSize < chunks.length) {
                await this.delay(100);
            }
        }
        
        return embeddedChunks;
    }

    private async embedBatch(chunks: Chunk[]): Promise<EmbeddedChunk[]> {
        try {
            const texts = chunks.map(chunk => this.prepareTextForEmbedding(chunk));
            
            const response = await this.openai.embeddings.create({
                model: this.model,
                input: texts,
                encoding_format: 'float'
            });
            
            return chunks.map((chunk, index) => ({
                ...chunk,
                embedding: response.data[index].embedding
            }));
        } catch (error) {
            console.error('Failed to embed batch:', error);
            throw error;
        }
    }

    private prepareTextForEmbedding(chunk: Chunk): string {
        // Enhance the text with metadata for better semantic understanding
        const parts = [];
        
        // Add file context
        parts.push(`File: ${chunk.filePath}`);
        
        // Add type and metadata
        if (chunk.metadata.name) {
            parts.push(`${chunk.type}: ${chunk.metadata.name}`);
        }
        
        if (chunk.metadata.signature) {
            parts.push(`Signature: ${chunk.metadata.signature.split('\n')[0]}`);
        }
        
        // Add the main content
        parts.push(chunk.content);
        
        return parts.join('\n').trim();
    }

    async embedQuery(query: string): Promise<number[]> {
        try {
            const response = await this.openai.embeddings.create({
                model: this.model,
                input: query,
                encoding_format: 'float'
            });
            
            return response.data[0].embedding;
        } catch (error) {
            console.error('Failed to embed query:', error);
            throw error;
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Helper method to calculate cosine similarity
    static cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) {
            throw new Error('Vectors must have the same length');
        }
        
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}