import OpenAI from 'openai';
import { SERVICE_CONFIG } from '../../config/Constants.js';
import { Embedding, EmbeddingService } from './type.js';
import { Chunk } from '../../chunking/types.js';

export class OpenAIEmbeddingService implements EmbeddingService {
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

    async embedRaw(raw: string): Promise<number[]> {
        try {
            const response = await this.openai.embeddings.create({
                model: this.model,
                input: raw,
                encoding_format: 'float'
            });
            
            return response.data[0].embedding;
        } catch (error) {
            console.error('Failed to embed raw text:', error);
            throw error;
        }
    }

    async embedOneChunk(chunk: Chunk): Promise<Embedding> {
        try {
            const text = chunk.getDescriptiveText();
            
            const response = await this.openai.embeddings.create({
                model: this.model,
                input: text,
                encoding_format: 'float'
            });
            
            return {
                ...chunk,
                embedding: response.data[0].embedding,
            };
        } catch (error) {
            console.error('Failed to embed chunk:', error);
            throw error;
        }
    }

    async embedChunks(chunks: Chunk[]): Promise<Embedding[]> {
        try {
            const texts = chunks.map(chunk => chunk.getDescriptiveText());
            
            const response = await this.openai.embeddings.create({
                model: this.model,
                input: texts,
                encoding_format: 'float'
            });
            
            return chunks.map((chunk, index) => ({
                ...chunk,
                embedding: response.data[index].embedding,
            }));
        } catch (error) {
            console.error('Failed to embed batch:', error);
            throw error;
        }
    }
}