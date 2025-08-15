/**
 * Example usage of RAG-integrated Context system
 * 
 * This shows how to use the Context class with built-in RAG capabilities
 * for code context retrieval in your AI code assistant CLI tool.
 */

import { Context } from './context.js';
import { ChatMessage } from '../types.js';

// Example 1: Basic usage
async function basicExample() {
    console.log('=== Basic RAG Context Usage ===\n');
    
    const context = new Context(
        "You are a helpful AI coding assistant. Use the provided code context to answer questions.",
        process.env.OPENAI_API_KEY
    );

    try {
        // Retrieve relevant code context
        await context.retrieveRelevantCode("how to handle user authentication", {
            folderPath: "./src",
            topK: 5,
            minScore: 0.2
        });

        // Get the system instructions with embedded code context
        const enrichedPrompt = context.getSystemInstructionsWithContext();
        console.log('System prompt with context length:', enrichedPrompt.length);
        console.log('Has code context:', context.codeContext !== null);

        if (context.codeContext) {
            console.log(`Found ${context.codeContext.relevantChunks.length} relevant code chunks`);
            console.log(`Query: "${context.codeContext.query}"`);
            console.log(`Retrieval time: ${context.codeContext.retrievalTime}ms`);
        }

    } finally {
        context.cleanUp();
    }
}

// Example 2: Different search strategies
async function advancedExample() {
    console.log('\n=== Advanced RAG Context Usage ===\n');
    
    const context = new Context(
        "You are an expert code reviewer. Focus on security and performance.",
        process.env.OPENAI_API_KEY
    );

    try {
        // Search for security-related code
        console.log('Searching for security patterns...');
        const securityContext = await context.getFormattedCodeContext(
            "security validation authentication authorization",
            {
                folderPath: "./src",
                topK: 8,
                minScore: 0.15,
                includeComments: true
            }
        );
        console.log('Security context found:', securityContext.length > 0);

        // Search for error handling patterns
        console.log('\nSearching for error handling...');
        await context.retrieveRelevantCode("error handling try catch throw", {
            topK: 5,
            minScore: 0.25,
            includeCode: true,
            includeComments: false
        });

        if (context.codeContext) {
            console.log('Error handling patterns found:');
            context.codeContext.relevantChunks.forEach((chunk, i) => {
                console.log(`  ${i + 1}. ${chunk.filePath}:${chunk.startLine} (${chunk.type})`);
                if (chunk.metadata.name) {
                    console.log(`     ${chunk.metadata.name}`);
                }
            });
        }

        // Get system stats
        const stats = await context.getCodeContextStats();
        console.log('\nRAG System Stats:', stats);

    } finally {
        context.cleanUp();
    }
}

// Example 3: Integration with message history
async function conversationalExample() {
    console.log('\n=== Conversational Context Usage ===\n');
    
    const context = new Context(
        "You are a helpful coding assistant. Answer questions based on the codebase context.",
        process.env.OPENAI_API_KEY
    );

    try {
        // Add some conversation history
        context.addChatMessage(new ChatMessage(
            'user',
            'How does the authentication system work in this codebase?'
        ));

        // Retrieve context based on the question
        await context.retrieveRelevantCode("authentication system login user", {
            folderPath: "./src",
            topK: 6,
            minScore: 0.18
        });

        // Simulate AI response with context
        if (context.codeContext) {
            const response = `Based on the codebase, I found ${context.codeContext.relevantChunks.length} relevant pieces of authentication-related code. Here's what I found:\n\n` +
                context.codeContext.relevantChunks.map((chunk, i) => 
                    `${i + 1}. **${chunk.filePath}** (lines ${chunk.startLine}-${chunk.endLine})\n` +
                    `   ${chunk.metadata.name ? `${chunk.type}: ${chunk.metadata.name}` : chunk.type}\n` +
                    `   Score: ${chunk.score.toFixed(3)}`
                ).join('\n\n');

            context.addChatMessage(new ChatMessage(
                'assistant',
                response
            ));

            console.log('Conversation history length:', context.messageHistory.length);
            console.log('Latest AI response preview:', response.substring(0, 200) + '...');
        }

    } finally {
        context.cleanUp();
    }
}

// Example 4: Multiple folder indexing
async function multiFolderExample() {
    console.log('\n=== Multiple Folder Indexing ===\n');
    
    const context = new Context(
        "You are a full-stack development assistant.",
        process.env.OPENAI_API_KEY
    );

    try {
        // Index different parts of the codebase for different queries
        console.log('Searching in src folder...');
        await context.retrieveRelevantCode("database connection", {
            folderPath: "./src",
            topK: 3
        });

        let stats = await context.getCodeContextStats();
        console.log(`Indexed ${stats.totalChunks} chunks from ${stats.lastIndexedPath}`);

        // Search in tests folder (will reindex)
        console.log('\nSearching in test files...');
        const testContext = await context.getFormattedCodeContext("test cases unit test", {
            folderPath: "./test",
            topK: 3,
            minScore: 0.1
        });

        stats = await context.getCodeContextStats();
        console.log(`Now indexed ${stats.totalChunks} chunks from ${stats.lastIndexedPath}`);
        console.log('Test context length:', testContext.length);

    } finally {
        context.cleanUp();
    }
}

// Main execution
async function runExamples() {
    try {
        await basicExample();
        await advancedExample();
        await conversationalExample();
        await multiFolderExample();
    } catch (error) {
        console.error('Example failed:', error);
        
        if (error instanceof Error) {
            if (error.message.includes('ChromaDB')) {
                console.log('\n💡 Setup ChromaDB:');
                console.log('   pip install chromadb');
                console.log('   chroma run --host localhost --port 8000');
            }
            
            if (error.message.includes('OpenAI')) {
                console.log('\n💡 Setup OpenAI API key:');
                console.log('   export OPENAI_API_KEY="your-key-here"');
            }
        }
    }
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runExamples();
}

export {
    basicExample,
    advancedExample,
    conversationalExample,
    multiFolderExample
};