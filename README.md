# AutoOffice

AI-powered Microsoft Word add-in that writes and executes real `office.js` code on demand.

## What It Does

AutoOffice is a task-pane add-in you chat with. Describe what you want ("make all headings blue", "insert a 3-column table", "replace every instance of 'foo' with 'bar'") and the agent:

1. Looks up the relevant `office.js` API docs as needed
2. Generates working code
3. Shows you the code for approval before running it
4. Executes it in a sandboxed iframe against your live Word document
5. Self-heals on errors — feeds the error back to the LLM and retries up to 3 times

**Key differentiator:** No wrapper functions. The AI writes real `office.js` code, grounded by structured API docs fetched on demand.

## Tech Stack

- **Framework:** React 19 + TypeScript
- **Build:** Vite with HTTPS (required for Office sideloading)
- **UI:** Fluent UI (`@fluentui/react-components`)
- **AI:** Vercel AI SDK (`ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`)
- **MCP:** `@ai-sdk/mcp` for external tool servers
- **Code highlighting:** Shiki
- **Schemas:** Zod

## Architecture

```
Task Pane (React)
├── Chat UI (Fluent UI)          ← user input, message history, tool activity
├── Code Preview Block           ← syntax-highlighted code with Approve / Reject
└── Agent Orchestrator
    ├── streamText (AI SDK)      ← multi-provider LLM client
    ├── Skill Registry           ← office.js API docs fetched on demand
    ├── MCP Client               ← external tool servers (HTTP only)
    └── postMessage bridge
            └── Sandboxed iframe ← executes generated code against live document
```

## Quick Start

### Prerequisites

- Node.js 18+
- Microsoft 365 (Word on Web or Desktop)
- An API key for Anthropic, OpenAI, or any OpenAI-compatible provider

### Install

```bash
npm install
```

### Dev certs (required for Office sideloading)

```bash
npm run certs
```

This installs a self-signed localhost certificate so Word will trust the add-in URL.

### Run + sideload (recommended)

```bash
npm run start
```

This starts the dev server **and** automatically sideloads the add-in into Word. The server runs at **https://localhost:3721**.

### Run dev server only

```bash
npm run dev
```

### Sideload manually

If Word is already open and the dev server is running:

```bash
npm run sideload
```

Or manually: **Insert → Add-ins → Upload My Add-in** → pick `manifest.xml`.

### Stop

```bash
npm run stop
```

### Configure

Open the add-in task pane and click the settings gear:

- **Provider:** Anthropic, OpenAI, or any OpenAI-compatible endpoint (Ollama, LM Studio, etc.)
- **API Key:** stored locally, never sent anywhere except directly to the provider
- **Model:** e.g. `claude-opus-4-7`, `gpt-4o`
- **Auto-approve:** skip the approve step and run code immediately
- **MCP Servers:** add HTTP/SSE MCP servers to extend the agent with external tools

## Project Structure

```
src/taskpane/
├── index.tsx              — Entry point, Office.onReady
├── App.tsx                — Root component, state management
├── agent/
│   ├── orchestrator.ts    — Agent loop: streamText + tool routing + self-healing
│   ├── tools.ts           — Built-in tool definitions
│   └── providers.ts       — Provider factory (Anthropic, OpenAI, compatible)
├── components/
│   ├── ChatPanel.tsx      — Message list + input
│   ├── CodeBlock.tsx      — Syntax-highlighted code with approve/reject
│   ├── MessageBubble.tsx  — Individual message
│   ├── ToolActivity.tsx   — Inline tool call indicators
│   └── SettingsPanel.tsx  — Provider, API keys, MCP, auto-approve
├── executor/
│   ├── sandbox.ts         — Iframe lifecycle + postMessage bridge
│   └── iframe.html        — Sandbox page (loads office.js, receives execute messages)
├── skills/                — office.js API doc chunks (markdown, one per domain)
│   ├── index.ts           — Registry + lookup function
│   ├── formatting.md
│   ├── tables.md
│   ├── context-sync.md    — Critical: load()/sync() batching model
│   └── ...
├── mcp/
│   └── client.ts          — MCP client via @ai-sdk/mcp
└── store/
    └── settings.ts        — Persist settings (roamingSettings in Office, localStorage in dev)
```

## Built-in Agent Tools

| Tool | What it does |
|------|-------------|
| `lookup_skill(name)` | Fetches `office.js` API docs for a domain (formatting, tables, ranges, etc.) |
| `execute_code(code)` | Submits generated code to the sandboxed iframe for execution |
| `read_document_state()` | Returns selected text, headings outline, and document length |

MCP server tools are surfaced alongside these automatically.

## Self-Healing

When code execution fails, the error is fed back to the LLM with the instruction to fix it. Each retry appears as a visible message in chat. After 3 failures the agent gives up and shows the final error.

## Settings

| Setting | Default |
|---------|---------|
| AI Provider | (none — select in settings) |
| Model | (provider-dependent) |
| Auto-approve | Off |
| Max retries | 3 |
| Execution timeout | 30 seconds |
| MCP Servers | Empty |

Settings are persisted via `Office.context.roamingSettings` when running inside Office, and `localStorage` during development.

## Build

```bash
npm run build
```

Output goes to `dist/`. Deploy the `dist/` folder to any HTTPS host and update the URLs in `manifest.xml`.

## Notes

- **Browser-only MCP:** The add-in runs entirely client-side. Only HTTP/SSE MCP transports work — no stdio. Local MCP servers need to expose an HTTP endpoint.
- **CORS:** Direct browser-to-API calls work with Anthropic and OpenAI. If you hit CORS issues with a provider, you'll need a lightweight proxy.
- **iframe context:** The sandbox iframe loads its own `office.js` instance. This follows the same pattern as Microsoft's Script Lab.
