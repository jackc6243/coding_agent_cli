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
