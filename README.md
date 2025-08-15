# coding-agent-cli

A comprehensive TypeScript-based AI coding agent CLI that supports multiple LLM providers, RAG-powered code context retrieval, MCP (Model Context Protocol) servers, and various development tools.

## Features

- **Multiple LLM Providers**: Support for OpenAI, Anthropic Claude, and Google Gemini
- **RAG System**: Advanced retrieval-augmented generation with semantic code chunking and vector storage
- **MCP Server Support**: Model Context Protocol integration with workspace-based server management
- **Terminal Tools**: Built-in terminal command execution capabilities
- **Modular Architecture**: Clean separation of concerns with extensible design

## Requirements
- Node.js 20+
- API keys for your chosen LLM provider(s):
  - OpenAI API key (for OpenAI models and embeddings)
  - Anthropic API key (for Claude models)
  - Google API key (for Gemini models)
- ChromaDB (for RAG functionality)

## Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Create a `.env` file in the project root with your API keys:
```bash
# Required: Choose your LLM provider
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key
GOOGLE_API_KEY=your-google-api-key
```

### 3. RAG Setup (Optional)
For enhanced code context retrieval:

Install ChromaDB:
```bash
pip install chromadb
```

Start ChromaDB server:
```bash
chroma run --host localhost --port 8000
```

### 4. Build the Project
```bash
npm run build
```

### 5. Link CLI (Optional)
For global command access:
```bash
npm link
```

## Usage

### Interactive Chat Mode
```bash
npm run dev
```

### CLI Commands
```bash
# Show help
agent --help

# Run with specific model
node dist/main.js
```

### Model Configuration
The main entry point supports multiple LLM providers. Edit `src/main.ts` to configure:

```typescript
// OpenAI (GPT models)
const llm = new LLM("openAI", "gpt-4", systemPrompt, ctx);

// Anthropic Claude
const llm = new LLM("anthropic", "claude-sonnet-4-20250514", systemPrompt, ctx);

// Google Gemini
const llm = new LLM("gemini", "gemini-2.5-flash", systemPrompt, ctx);
```

## RAG (Retrieval-Augmented Generation) System

The project includes a comprehensive RAG system for intelligent code context retrieval:

### Features
- **Smart File Browsing**: Automatically scans and indexes your codebase
- **AST-Aware Chunking**: Uses TypeScript compiler API for intelligent code parsing
- **Vector Storage**: ChromaDB integration for fast similarity search
- **Multiple File Types**: Support for TypeScript, JavaScript, Python, Java, and more

### RAG Usage
```bash
# Initialize and index your codebase
npm run build
node dist/rag/cli.js index

# Search for relevant code context
node dist/rag/cli.js search "authentication logic"

# Get system statistics
node dist/rag/cli.js stats
```

For detailed RAG documentation, see [src/rag/README.md](src/rag/README.md).

## MCP (Model Context Protocol) Servers

This project supports MCP servers as independent workspaces, allowing for modular tool integration:

### Available MCP Servers
- **Weather Server**: Example MCP server for weather-related queries

### MCP Build Commands
```bash
# Build only the root CLI
npm run build

# Build all MCP servers
npm run build:servers

# Build everything (root + servers)
npm run build:all

# Build specific server
npm run -w @mcp-server/weather build
```

### Running MCP Clients
```bash
# Development mode (ts-node for client, compiled server)
npm run client:weather:dev

# Production mode (compiled client + server)
npm run client:weather:start
```

### Creating New MCP Servers
1. Create directory under `src/mcp/servers/your-server`
2. Add `package.json` with MCP server configuration
3. Implement server logic in `src/index.ts`
4. Build with `npm run -w @mcp-server/your-server build`

See the [weather server](src/mcp/servers/weather) as a reference implementation.

## Available Scripts

```bash
# Development
npm run dev              # Start in development mode with ts-node
npm run build           # Build the main CLI
npm run build:all       # Build CLI and all MCP servers

# Code Quality
npm run lint            # Run ESLint
npm run format          # Format code with Prettier

# MCP Servers
npm run build:servers   # Build all MCP server workspaces
npm run server:weather:build  # Build weather server specifically
```

## Project Structure

```
src/
├── main.ts                 # Main CLI entry point
├── llm/                    # LLM provider adapters
│   ├── anthropicAdaptor.ts
│   ├── geminiAdaptor.ts
│   ├── openAIAdaptor.ts
│   └── llm.ts
├── context/                # Context management system
├── rag/                    # RAG system (see rag/README.md)
├── mcp/                    # MCP servers and clients
│   ├── MCPToolClient.ts
│   └── servers/           # Independent MCP server workspaces
├── tools/                  # Built-in tools (terminal, etc.)
├── core/                   # Core abstractions and types
└── config/                 # Configuration management
```

## Contributing

1. Follow the existing code style and patterns
2. Add tests for new functionality
3. Update documentation as needed
4. Ensure all builds pass: `npm run build:all`

## Environment Variables

```bash
# LLM Provider API Keys (choose one or more)
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key  
GOOGLE_API_KEY=your-google-api-key

# Optional: Override default endpoints
OPENAI_BASE_URL=https://api.openai.com/v1
ANTHROPIC_BASE_URL=https://api.anthropic.com
```
