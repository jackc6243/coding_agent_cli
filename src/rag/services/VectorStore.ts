import { ChromaClient } from 'chromadb';
import type { Collection } from 'chromadb';
import type { EmbeddedChunk, Chunk, QueryResult } from '../chunking/types.js';
import { SERVICE_CONFIG } from '../../config/Constants.js';

export class VectorStore {
    private client: ChromaClient;
    private collection: Collection | null = null;
    private readonly collectionName = SERVICE_CONFIG.CHROMADB_COLLECTION_NAME;

    constructor() {
        // Initialize ChromaDB client for local instance
        this.client = new ChromaClient({
            path: SERVICE_CONFIG.CHROMADB_DEFAULT_URL
        });
    }

    async initialize(): Promise<void> {
        try {
            // Try to get existing collection or create new one
            try {
                this.collection = await this.client.getCollection({
                    name: this.collectionName
                });
                console.log('Using existing ChromaDB collection:', this.collectionName);
            } catch (error) {
                // Collection doesn't exist, create it
                this.collection = await this.client.createCollection({
                    name: this.collectionName,
                    metadata: { 
                        description: SERVICE_CONFIG.CHROMADB_COLLECTION_DESCRIPTION,
                        created_at: new Date().toISOString()
                    }
                });
                console.log('Created new ChromaDB collection:', this.collectionName);
            }
        } catch (error) {
            console.error('Failed to initialize ChromaDB:', error);
            console.log('Note: Make sure ChromaDB is running locally. You can start it with: chroma run --host localhost --port 8000');
            throw error;
        }
    }

    async storeChunks(embeddedChunks: EmbeddedChunk[]): Promise<void> {
        if (!this.collection) {
            throw new Error('VectorStore not initialized. Call initialize() first.');
        }

        if (embeddedChunks.length === 0) {
            console.log('No chunks to store');
            return;
        }

        try {
            // Prepare data for ChromaDB
            const ids = embeddedChunks.map(chunk => chunk.id);
            const embeddings = embeddedChunks.map(chunk => chunk.embedding);
            const documents = embeddedChunks.map(chunk => chunk.content);
            const metadatas = embeddedChunks.map(chunk => ({
                filePath: chunk.filePath,
                type: chunk.type,
                startLine: chunk.startLine,
                endLine: chunk.endLine,
                name: chunk.metadata.name || '',
                signature: chunk.metadata.signature || '',
                description: chunk.metadata.description || ''
            }));

            // Store in batches to avoid memory issues
            const batchSize = 100;
            for (let i = 0; i < embeddedChunks.length; i += batchSize) {
                const end = Math.min(i + batchSize, embeddedChunks.length);
                console.log(`Storing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(embeddedChunks.length / batchSize)} (${end - i} chunks)`);
                
                await this.collection.add({
                    ids: ids.slice(i, end),
                    embeddings: embeddings.slice(i, end),
                    documents: documents.slice(i, end),
                    metadatas: metadatas.slice(i, end)
                });
            }

            console.log(`Successfully stored ${embeddedChunks.length} chunks in ChromaDB`);
        } catch (error) {
            console.error('Failed to store chunks in ChromaDB:', error);
            throw error;
        }
    }

    async query(queryEmbedding: number[], topK: number = 10): Promise<QueryResult[]> {
        if (!this.collection) {
            throw new Error('VectorStore not initialized. Call initialize() first.');
        }

        try {
            const results = await this.collection.query({
                queryEmbeddings: [queryEmbedding],
                nResults: topK,
                include: ['documents', 'metadatas', 'distances']
            });

            if (!results.documents || !results.documents[0] || 
                !results.metadatas || !results.metadatas[0] || 
                !results.distances || !results.distances[0] ||
                !results.ids || !results.ids[0]) {
                return [];
            }

            const queryResults: QueryResult[] = [];
            
            for (let i = 0; i < results.documents[0].length; i++) {
                const metadata = results.metadatas[0][i] as any;
                const document = results.documents[0][i];
                const distance = results.distances[0][i];
                const id = results.ids[0][i];
                
                if (document && metadata) {
                    const chunk: Chunk = {
                        id,
                        content: document,
                        type: metadata.type as Chunk['type'],
                        filePath: metadata.filePath,
                        startLine: metadata.startLine || 1,
                        endLine: metadata.endLine || 1,
                        metadata: {
                            name: metadata.name || undefined,
                            signature: metadata.signature || undefined,
                            description: metadata.description || undefined
                        }
                    };

                    queryResults.push({
                        chunk,
                        score: distance !== null ? 1 - distance : 0, // Convert distance to similarity score
                        distance: distance || 0
                    });
                }
            }

            return queryResults.sort((a, b) => b.score - a.score);
        } catch (error) {
            console.error('Failed to query ChromaDB:', error);
            throw error;
        }
    }

    async clear(): Promise<void> {
        if (!this.collection) {
            throw new Error('VectorStore not initialized. Call initialize() first.');
        }

        try {
            await this.client.deleteCollection({ name: this.collectionName });
            console.log('Cleared ChromaDB collection');
            
            // Recreate the collection
            await this.initialize();
        } catch (error) {
            console.error('Failed to clear ChromaDB collection:', error);
            throw error;
        }
    }

    async getStats(): Promise<{ count: number; collections: string[] }> {
        try {
            const collections = await this.client.listCollections();
            const count = this.collection ? await this.collection.count() : 0;
            
            return {
                count,
                collections: collections.map((c: any) => c.name)
            };
        } catch (error) {
            console.error('Failed to get ChromaDB stats:', error);
            throw error;
        }
    }

    async removeByFilePath(filePath: string): Promise<void> {
        if (!this.collection) {
            throw new Error('ChromaDB collection not initialized');
        }

        try {
            // Query for chunks from this file path
            const results = await this.collection.get({
                where: { "filePath": filePath }
            });

            if (results.ids && results.ids.length > 0) {
                await this.collection.delete({
                    ids: results.ids
                });
                console.log(`Removed ${results.ids.length} chunks for ${filePath}`);
            }
        } catch (error) {
            console.error(`Failed to remove chunks for ${filePath}:`, error);
            throw error;
        }
    }

    async close(): Promise<void> {
        // ChromaDB client doesn't require explicit closing for HTTP client
        this.collection = null;
        console.log('VectorStore closed');
    }
}