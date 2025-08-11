# coding-agent-cli

A TypeScript coding agent CLI using OpenRouter. Supports filesystem edits, regex search/replace, shell exec, git, and HTTP fetch tools.

## Requirements
- Node.js 20+
- An OpenRouter API key

## Setup
1. Copy .env.example to .env and set OPENROUTER_API_KEY
2. Install dependencies:
   npm install
3. Build:
   npm run build
4. Link the CLI (optional for global command):
   npm link

## Usage
- Show help:
  agent --help
- Run an agent goal in current directory:
  agent run "create a README.md with project overview"
- Options:
  --model <slug>            Override default model (default: openrouter/anthropic/claude-3.7-sonnet)
  --max-steps <n>          Step budget (default: 15)
  --cwd <path>             Working directory (default: current)
  --dry-run                 Do not execute tools; simulate
  --verbose                 Verbose logs
  --temperature <t>        Sampling temperature

## Environment variables
- OPENROUTER_API_KEY (required)
- OPENROUTER_BASE_URL (default: https://openrouter.ai/api)
- OPENROUTER_REFERER (optional)
- OPENROUTER_TITLE (optional)

## MCP servers as independent workspaces

This project now builds each MCP server as its own independent NodeNext ESM workspace producing a standalone JS entry file per server, separate from the outer AI CLI.

- Root workspaces: see [package.json](package.json)
- Weather server workspace: [src/mcp/servers/weather](src/mcp/servers/weather)
  - Build output: [build/index.js](src/mcp/servers/weather/build/index.js)
  - Server entry source: [src/index.ts](src/mcp/servers/weather/src/index.ts)

### Install

- First-time install with npm workspaces (per-server isolated installs)
  - Uses workspace settings in [.npmrc](.npmrc)
  - Command:  
    npm install

### Build

- Build only the root CLI:
  - npm run build
- Build all servers (workspaces):
  - npm run build:servers
- Build everything (root + servers):
  - npm run build:all
- Build the weather server only:
  - npm run -w @mcp-server/weather build

### Run the weather client against the built weather server

- Dev (ts-node for client, compiled server):
  - npm run client:weather:dev
- Start (compiled client + compiled server):
  - npm run client:weather:start

These scripts resolve to:
- client dev: node --loader ts-node/esm [index.ts](src/mcp/clients/weather/index.ts) [build/index.js](src/mcp/servers/weather/build/index.js)
- client start: node [index.js](dist/mcp/clients/weather/index.js) [build/index.js](src/mcp/servers/weather/build/index.js)

The weather client dynamically launches the server via stdio and requires an API key for the LLM:
- Set required env in [.env](.env.example)

### Creating a new MCP server workspace

1) Create a new directory under servers, e.g. src/mcp/servers/my-server  
   Include:
   - package.json (example)
     {
       "name": "@mcp-server/my-server",
       "version": "1.0.0",
       "description": "My MCP server",
       "type": "module",
       "private": true,
       "main": "build/index.js",
       "files": ["build"],
       "scripts": {
         "build": "tsc -p tsconfig.json",
         "start": "node build/index.js"
       },
       "dependencies": {
         "@modelcontextprotocol/sdk": "^1.17.2",
         "zod": "^3.25.76"
       },
       "devDependencies": {
         "@types/node": "^20.0.0",
         "typescript": "^5.9.2"
       }
     }
   - tsconfig.json (NodeNext ESM)
     {
       "compilerOptions": {
         "target": "ES2022",
         "module": "NodeNext",
         "moduleResolution": "NodeNext",
         "outDir": "./build",
         "rootDir": "./src",
         "strict": true,
         "esModuleInterop": true,
         "skipLibCheck": true,
         "forceConsistentCasingInFileNames": true
       },
       "include": ["src/**/*"],
       "exclude": ["node_modules"]
     }
   - src/index.ts that starts an MCP server over stdio (similar to [weather server entry](src/mcp/servers/weather/src/index.ts))

2) Ensure root workspaces covers your new server (already configured to src/mcp/servers/* in [package.json](package.json)).

3) Install and build:
   - npm install
   - npm run -w @mcp-server/my-server build

You’ll then have an isolated [build/index.js](src/mcp/servers/my-server/build/index.js) per server that can be launched via stdio by any client (including the CLI’s weather client that accepts a path to the server script).

### Notes

- Root TypeScript build excludes server workspaces so the servers compile independently:
  - see [tsconfig.json](tsconfig.json)
- Per-server node_modules and build artifacts are ignored in git:
  - see [.gitignore](.gitignore)
