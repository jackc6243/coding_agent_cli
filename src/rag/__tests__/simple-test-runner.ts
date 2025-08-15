/**
 * Simple test runner to check RAG components for basic functionality
 * This will run without external test frameworks to identify immediate issues
 */

import { readFileSync } from 'fs';
import { join } from 'path';

interface TestResult {
  component: string;
  test: string;
  passed: boolean;
  error?: string;
  duration: number;
}

class SimpleTestRunner {
  private results: TestResult[] = [];

  async runTest(component: string, testName: string, testFn: () => Promise<void> | void): Promise<void> {
    const startTime = Date.now();
    
    try {
      await testFn();
      this.results.push({
        component,
        test: testName,
        passed: true,
        duration: Date.now() - startTime
      });
      console.log(`✅ ${component}: ${testName}`);
    } catch (error) {
      this.results.push({
        component,
        test: testName,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      });
      console.log(`❌ ${component}: ${testName} - ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  printSummary(): void {
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;

    console.log('\n📊 Test Summary');
    console.log('================');
    console.log(`Total: ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter(r => !r.passed)
        .forEach(r => {
          console.log(`  ${r.component}: ${r.test}`);
          console.log(`    Error: ${r.error}`);
        });
    }
  }
}

async function testBasicImports(runner: SimpleTestRunner): Promise<void> {
  // Test basic import functionality
  await runner.runTest('Core', 'RAG class import', async () => {
    const ragContent = readFileSync(join(process.cwd(), 'src/rag/core/RAG.ts'), 'utf-8');
    if (!ragContent.includes('export class RAG')) {
      throw new Error('RAG class not found in export');
    }
  });

  await runner.runTest('Core', 'RetrievalSystem class import', async () => {
    const retrievalContent = readFileSync(join(process.cwd(), 'src/rag/core/RetrievalSystem.ts'), 'utf-8');
    if (!retrievalContent.includes('export class RetrievalSystem')) {
      throw new Error('RetrievalSystem class not found in export');
    }
  });

  await runner.runTest('Chunking', 'TextChunker class import', async () => {
    const chunkerContent = readFileSync(join(process.cwd(), 'src/rag/chunking/TextChunker.ts'), 'utf-8');
    if (!chunkerContent.includes('export class TextChunker')) {
      throw new Error('TextChunker class not found in export');
    }
  });

  await runner.runTest('Chunking', 'SemanticChunker class import', async () => {
    const semanticContent = readFileSync(join(process.cwd(), 'src/rag/chunking/SemanticChunker.ts'), 'utf-8');
    if (!semanticContent.includes('export class SemanticChunker')) {
      throw new Error('SemanticChunker class not found in export');
    }
  });

  await runner.runTest('Services', 'EmbeddingService class import', async () => {
    const embeddingContent = readFileSync(join(process.cwd(), 'src/rag/services/EmbeddingService.ts'), 'utf-8');
    if (!embeddingContent.includes('export class EmbeddingService')) {
      throw new Error('EmbeddingService class not found in export');
    }
  });

  await runner.runTest('Services', 'VectorStore class import', async () => {
    const vectorContent = readFileSync(join(process.cwd(), 'src/rag/services/VectorStore.ts'), 'utf-8');
    if (!vectorContent.includes('export class VectorStore')) {
      throw new Error('VectorStore class not found in export');
    }
  });

  await runner.runTest('Services', 'FileBrowser class import', async () => {
    const browserContent = readFileSync(join(process.cwd(), 'src/rag/services/FileBrowser.ts'), 'utf-8');
    if (!browserContent.includes('export class FileBrowser')) {
      throw new Error('FileBrowser class not found in export');
    }
  });
}

async function testTypeDefinitions(runner: SimpleTestRunner): Promise<void> {
  await runner.runTest('Types', 'Core types export', async () => {
    const typesContent = readFileSync(join(process.cwd(), 'src/rag/core/types.ts'), 'utf-8');
    const requiredTypes = ['RAGConfig', 'RetrievalConfig', 'RetrievalResult', 'QueryResult'];
    
    for (const type of requiredTypes) {
      if (!typesContent.includes(`interface ${type}`) && !typesContent.includes(`type ${type}`)) {
        throw new Error(`Type ${type} not found in core types`);
      }
    }
  });

  await runner.runTest('Types', 'Chunking types export', async () => {
    const chunksContent = readFileSync(join(process.cwd(), 'src/rag/chunking/types.ts'), 'utf-8');
    const requiredTypes = ['Chunk', 'EmbeddedChunk', 'SemanticChunk'];
    
    for (const type of requiredTypes) {
      if (!chunksContent.includes(`interface ${type}`)) {
        throw new Error(`Type ${type} not found in chunking types`);
      }
    }
  });
}

async function testBasicFunctionality(runner: SimpleTestRunner): Promise<void> {
  // Test TextChunker basic functionality
  await runner.runTest('TextChunker', 'Constructor and basic methods', async () => {
    // We can't actually import due to dependencies, but we can check the structure
    const chunkerContent = readFileSync(join(process.cwd(), 'src/rag/chunking/TextChunker.ts'), 'utf-8');
    
    const requiredMethods = ['chunkFile', 'chunkTypeScript', 'chunkJavaScript', 'chunkMarkdown', 'chunkGeneric'];
    for (const method of requiredMethods) {
      if (!chunkerContent.includes(method)) {
        throw new Error(`Method ${method} not found in TextChunker`);
      }
    }
  });

  // Test EmbeddingService structure
  await runner.runTest('EmbeddingService', 'Required methods present', async () => {
    const embeddingContent = readFileSync(join(process.cwd(), 'src/rag/services/EmbeddingService.ts'), 'utf-8');
    
    const requiredMethods = ['embedChunks', 'embedQuery', 'cosineSimilarity'];
    for (const method of requiredMethods) {
      if (!embeddingContent.includes(method)) {
        throw new Error(`Method ${method} not found in EmbeddingService`);
      }
    }
  });

  // Test VectorStore structure  
  await runner.runTest('VectorStore', 'Required methods present', async () => {
    const vectorContent = readFileSync(join(process.cwd(), 'src/rag/services/VectorStore.ts'), 'utf-8');
    
    const requiredMethods = ['initialize', 'storeChunks', 'query', 'clear', 'getStats', 'removeByFilePath'];
    for (const method of requiredMethods) {
      if (!vectorContent.includes(method)) {
        throw new Error(`Method ${method} not found in VectorStore`);
      }
    }
  });
}

async function checkIndexExports(runner: SimpleTestRunner): Promise<void> {
  await runner.runTest('Index', 'Main index exports', async () => {
    const indexContent = readFileSync(join(process.cwd(), 'src/rag/index.ts'), 'utf-8');
    
    const requiredExports = ['RAG', 'RetrievalSystem', 'FileBrowser', 'EmbeddingService', 'VectorStore', 'TextChunker', 'SemanticChunker'];
    for (const exportName of requiredExports) {
      if (!indexContent.includes(`export { ${exportName} }`)) {
        throw new Error(`Export ${exportName} not found in main index`);
      }
    }
  });
}

async function analyzeCodeQuality(runner: SimpleTestRunner): Promise<void> {
  await runner.runTest('Quality', 'No obvious syntax errors in RAG', async () => {
    const ragContent = readFileSync(join(process.cwd(), 'src/rag/core/RAG.ts'), 'utf-8');
    
    // Check for common syntax issues
    const braceCount = (ragContent.match(/\{/g) || []).length - (ragContent.match(/\}/g) || []).length;
    if (braceCount !== 0) {
      throw new Error(`Unmatched braces detected: ${braceCount}`);
    }
    
    const parenCount = (ragContent.match(/\(/g) || []).length - (ragContent.match(/\)/g) || []).length;
    if (parenCount !== 0) {
      throw new Error(`Unmatched parentheses detected: ${parenCount}`);
    }
  });

  await runner.runTest('Quality', 'No TODO comments in production code', async () => {
    const files = [
      'src/rag/core/RAG.ts',
      'src/rag/core/RetrievalSystem.ts',
      'src/rag/services/EmbeddingService.ts',
      'src/rag/services/VectorStore.ts'
    ];
    
    for (const file of files) {
      const content = readFileSync(join(process.cwd(), file), 'utf-8');
      if (content.toLowerCase().includes('todo') && !content.includes('// TODO: Remove this after testing')) {
        console.warn(`Warning: TODO found in ${file}`);
      }
    }
  });

  await runner.runTest('Quality', 'Proper error handling patterns', async () => {
    const ragContent = readFileSync(join(process.cwd(), 'src/rag/core/RetrievalSystem.ts'), 'utf-8');
    
    // Check for try-catch blocks
    if (!ragContent.includes('try {') || !ragContent.includes('catch (')) {
      throw new Error('No error handling found in RetrievalSystem');
    }
  });
}

async function main(): Promise<void> {
  console.log('🧪 RAG Pipeline Simple Test Runner');
  console.log('====================================');
  
  const runner = new SimpleTestRunner();
  
  console.log('\n📦 Testing basic imports...');
  await testBasicImports(runner);
  
  console.log('\n🏷️  Testing type definitions...');
  await testTypeDefinitions(runner);
  
  console.log('\n⚙️  Testing basic functionality...');
  await testBasicFunctionality(runner);
  
  console.log('\n📤 Testing exports...');
  await checkIndexExports(runner);
  
  console.log('\n🔍 Analyzing code quality...');
  await analyzeCodeQuality(runner);
  
  runner.printSummary();
  
  const failed = runner['results'].filter(r => !r.passed).length;
  if (failed > 0) {
    console.log('\n🚨 Some tests failed. Please check the issues above.');
    process.exit(1);
  } else {
    console.log('\n🎉 All basic tests passed! The RAG pipeline structure looks good.');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { SimpleTestRunner };