# RAG (Retrieval-Augmented Generation) System

A comprehensive, modular RAG pipeline for context retrieval in an AI code assistant CLI tool.

## ✨ What's New in v2.0

- **🏗️ Modular Architecture**: Clean separation of concerns with dedicated folders for core logic, services, chunking, and AST processing
- **📁 Better Organization**: Intuitive folder structure that scales with complexity
- **🔧 Type Safety**: Centralized type definitions in dedicated `types.ts` files
- **🚀 Enhanced Maintainability**: Easier to extend, test, and debug individual components
- **⚡ Improved Performance**: Optimized imports and reduced circular dependencies
- **📚 Better Documentation**: Updated with current architecture and examples

## 🏗️ Architecture Overview

The RAG system has been reorganized into a maintainable, modular structure:

```
src/rag/
├── README.md                    # This documentation
├── index.ts                     # Main exports
├── core/                        # Core RAG functionality
│   ├── RAG.ts                  # Main RAG orchestrator class
│   ├── RetrievalSystem.ts      # Retrieval logic and coordination
│   └── types.ts                # Core type definitions
├── services/                   # Individual service components
│   ├── FileBrowser.ts          # File system scanning and filtering
│   ├── EmbeddingService.ts     # OpenAI embedding generation
│   └── VectorStore.ts          # ChromaDB vector storage
├── chunking/                   # Text and semantic chunking
│   ├── TextChunker.ts          # Basic text-based chunking
│   ├── SemanticChunker.ts      # AST-aware semantic chunking
│   └── types.ts                # Chunking type definitions
├── ast/                        # AST processing utilities
│   ├── ASTIndexer.ts           # Tree-sitter AST parsing
│   ├── FileWatcher.ts          # Real-time file monitoring
│   └── grammars/               # Tree-sitter language grammars
└── config/                     # Configuration
    └── RAGConfig.ts            # System configuration
```

## Features

- **Smart File Browsing**: Automatically scans files based on RAGConfig settings with intelligent exclusion rules
- **Structure-Aware Chunking**: Uses TypeScript compiler API for TypeScript files and semantic chunking for other languages
- **OpenAI Embeddings**: Leverages OpenAI's text-embedding-3-small model for high-quality vector representations
- **Local ChromaDB**: Runs ChromaDB locally without Docker overhead for fast vector storage and retrieval
- **Intelligent Retrieval**: Context-aware search with configurable filtering and scoring

## 🔄 Component Flow

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   FileBrowser   │───▶│ TextChunker/     │───▶│ EmbeddingService│
│   (services/)   │    │ SemanticChunker  │    │   (services/)   │
└─────────────────┘    │   (chunking/)    │    └─────────────────┘
         │              └──────────────────┘             │
         ▼                       │                       ▼
┌─────────────────┐              ▼              ┌─────────────────┐
│   RAGConfig     │    ┌──────────────────┐    │   VectorStore   │
│   (config/)     │    │     Chunks       │    │   (services/)   │
└─────────────────┘    │    (types)       │    └─────────────────┘
                        └──────────────────┘             │
                                 │                       ▼
                                 ▼              ┌─────────────────┐
                        ┌──────────────────┐    │ RetrievalSystem │
                        │   FileWatcher    │───▶│    (core/)      │
                        │     (ast/)       │    └─────────────────┘
                        └──────────────────┘             │
                                                         ▼
                                                ┌─────────────────┐
                                                │   RAG (core/)   │
                                                │ Main Interface  │
                                                └─────────────────┘
```

## Setup

### 1. Install ChromaDB

First, install ChromaDB locally:

```bash
pip install chromadb
```

### 2. Start ChromaDB Server

Start a local ChromaDB server:

```bash
chroma run --host localhost --port 8000
```

Keep this running in a separate terminal.

### 3. Set OpenAI API Key

Set your OpenAI API key as an environment variable:

```bash
export OPENAI_API_KEY="your-openai-api-key-here"
```

Or create a `.env` file in the project root:

```
OPENAI_API_KEY=your-openai-api-key-here
```

### 4. Configure RAG Settings

Edit `src/rag/config/RAGConfig.ts` to customize your indexing settings:

```typescript
const cfg: RagConfig = {
    index_folder: "./src", // Directory to index
    exclusion_list: [
        { name: "node_modules", exclude_children: true },
        { name: ".git", exclude_children: true }
    ]
};
```

## 📚 Module Guide

### Core Modules

- **`core/RAG.ts`**: Main orchestrator class - your primary interface
- **`core/RetrievalSystem.ts`**: Handles the retrieval pipeline coordination
- **`core/types.ts`**: All core type definitions and interfaces

### Service Modules

- **`services/FileBrowser.ts`**: Scans and filters files from the filesystem
- **`services/EmbeddingService.ts`**: Generates embeddings using OpenAI API
- **`services/VectorStore.ts`**: Manages ChromaDB vector storage operations

### Chunking Modules

- **`chunking/TextChunker.ts`**: Basic text-based chunking for various file types
- **`chunking/SemanticChunker.ts`**: Advanced AST-aware semantic chunking
- **`chunking/types.ts`**: Chunk-related type definitions

### AST Processing Modules

- **`ast/ASTIndexer.ts`**: Tree-sitter based AST parsing
- **`ast/FileWatcher.ts`**: Real-time file change monitoring
- **`ast/grammars/`**: Tree-sitter language grammar files

### Configuration

- **`config/RAGConfig.ts`**: System configuration and settings

## Usage

### Using the RAG Class

```typescript
import { RAG } from './rag/core/RAG.js';
// or
import { RAG } from './rag/index.js'; // Recommended

const rag = new RAG();

// Initialize the system
await rag.initialize();

// Index your codebase
await rag.indexCodebase();

// Search for relevant context
const results = await rag.retrieve("How do I handle user authentication?");
console.log(results);

// Get formatted results
const formatted = await rag.getFormattedResults("authentication flow", {
    topK: 5,
    minScore: 0.2
});
console.log(formatted);

// Clean up
await rag.close();
```

### Using the CLI Tool

Build the project first:

```bash
npm run build
```

Then use the CLI:

```bash
# Index the codebase
node dist/rag/cli.js index

# Search for context
node dist/rag/cli.js search "authentication logic"

# Get system statistics
node dist/rag/cli.js stats

# Clear the database
node dist/rag/cli.js clear
```

### CLI Options

- `index --force`: Force reindexing even if already indexed
- `search <query> --top-k 10`: Limit number of results
- `search <query> --min-score 0.3`: Set minimum similarity threshold
- `search <query> --no-code`: Exclude code chunks from results
- `search <query> --no-comments`: Exclude comment chunks from results

## Configuration Options

### RetrievalConfig

```typescript
interface RetrievalConfig {
    topK?: number;          // Number of results to return (default: 10)
    minScore?: number;      // Minimum similarity score (default: 0.1)
    includeMetadata?: boolean; // Include enhanced metadata (default: true)
    includeCode?: boolean;  // Include code chunks (default: true)
    includeComments?: boolean; // Include comment chunks (default: true)
}
```

## Supported File Types

- **TypeScript**: `.ts`, `.tsx` (uses TypeScript compiler API for AST-based chunking)
- **JavaScript**: `.js`, `.jsx` (pattern-based chunking)
- **Python**: `.py`
- **Java**: `.java`
- **C/C++**: `.c`, `.cpp`, `.h`, `.hpp`
- **Go**: `.go`
- **Rust**: `.rs`
- **PHP**: `.php`
- **Ruby**: `.rb`
- **Swift**: `.swift`
- **Markdown**: `.md` (section-based chunking)
- **Text**: `.txt`
- **JSON**: `.json`
- **YAML**: `.yaml`, `.yml`
- **Web**: `.html`, `.css`, `.scss`, `.less`

## Chunking Strategy

1. **TypeScript/JavaScript**: AST-aware chunking using compiler APIs to extract functions, classes, interfaces, and variables
2. **Markdown**: Section-based chunking using headers
3. **Generic**: Intelligent text splitting with overlap for continuity
4. **Large chunks**: Automatically split with overlap to maintain context

## Vector Storage

- Uses ChromaDB for local vector storage
- Stores embeddings with rich metadata (file path, type, line numbers, signatures)
- Supports batch operations for performance
- Cosine similarity for retrieval

## Performance

- Batch processing for embeddings (100 chunks per batch)
- Rate limiting to avoid API limits
- Efficient vector storage and retrieval
- Memory-conscious chunk processing

## Troubleshooting

### ChromaDB Connection Issues

Make sure ChromaDB is running:

```bash
# Check if ChromaDB is running
curl http://localhost:8000/api/v1/heartbeat

# If not, start it
chroma run --host localhost --port 8000
```

### OpenAI API Issues

Verify your API key:

```bash
echo $OPENAI_API_KEY
```

Check your OpenAI usage and billing at https://platform.openai.com/usage

### Memory Issues

For large codebases:
1. Increase Node.js memory limit: `node --max-old-space-size=4096`
2. Reduce batch sizes in the code
3. Add more exclusion patterns to RAGConfig

## Examples

### Basic Usage

```typescript
// Simple search
const rag = new RAG();
await rag.initialize();
await rag.indexCodebase();

const results = await rag.retrieve("error handling patterns");
console.log(`Found ${results.results.length} relevant chunks`);

for (const result of results.results) {
    console.log(`${result.chunk.filePath}:${result.chunk.startLine} (score: ${result.score})`);
    console.log(result.chunk.content.substring(0, 200) + '...');
}
```

### Advanced Filtering

```typescript
// Search only for function definitions with high confidence
const results = await rag.retrieve("database connection", {
    topK: 3,
    minScore: 0.7,
    includeCode: true,
    includeComments: false
});

// Format for display
const formatted = rag.retrievalSystem.formatResults(results);
console.log(formatted);
```

This RAG system provides a solid foundation for context retrieval in your AI code assistant CLI tool!