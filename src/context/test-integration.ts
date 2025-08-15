#!/usr/bin/env node

import { getDefaultAllContext } from './defaultAllContext.js';

async function testRAGIntegration() {
    console.log('Testing RAG integration with Context system...');
    
    // Create context with OpenAI API key from environment
    const context = getDefaultAllContext(process.env.OPENAI_API_KEY);
    
    try {
        // Test 1: Check initial stats
        console.log('\n1. Checking initial RAG stats...');
        const initialStats = await context.getCodeContextStats();
        console.log('Initial stats:', initialStats);
        
        // Test 2: Retrieve relevant code for authentication
        console.log('\n2. Retrieving relevant code for "authentication logic"...');
        
        // This will automatically initialize and index the codebase
        const formattedContext = await context.getFormattedCodeContext(
            "authentication logic",
            {
                folderPath: "./src", // Index the src folder
                topK: 5,
                minScore: 0.1
            }
        );
        
        console.log('Retrieved context:');
        console.log(formattedContext);
        
        // Test 3: Check stats after indexing
        console.log('\n3. Checking stats after indexing...');
        const finalStats = await context.getCodeContextStats();
        console.log('Final stats:', finalStats);
        
        // Test 4: Test system instructions with context
        console.log('\n4. Testing system instructions with context...');
        await context.retrieveRelevantCode("error handling patterns", {
            topK: 3,
            minScore: 0.15
        });
        
        const systemWithContext = context.getSystemInstructionsWithContext();
        console.log('System instructions length:', systemWithContext.length);
        console.log('Includes context:', context.codeContext !== null);
        
    } catch (error) {
        console.error('Test failed:', error);
        
        // Check if it's a ChromaDB connection error
        if (error instanceof Error && error.message.includes('ChromaDB')) {
            console.log('\n💡 Make sure ChromaDB is running:');
            console.log('   pip install chromadb');
            console.log('   chroma run --host localhost --port 8000');
        }
        
        // Check if it's an OpenAI API key error
        if (error instanceof Error && error.message.includes('OpenAI API key')) {
            console.log('\n💡 Make sure OpenAI API key is set:');
            console.log('   export OPENAI_API_KEY="your-key-here"');
        }
    } finally {
        // Clean up
        console.log('\n5. Cleaning up...');
        context.cleanUp();
        console.log('Test completed!');
    }
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
    console.error('Unhandled rejection:', error);
    process.exit(1);
});

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
    testRAGIntegration();
}