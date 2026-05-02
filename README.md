<p align="center">
  <img src="public/assets/icon-256.png" alt="AutoOffice logo" width="128" height="128" />
</p>

<h1 align="center">AutoOffice</h1>

<p align="center">AI-powered Microsoft Word + Excel + PowerPoint add-in that writes and executes real <code>office.js</code> code on demand.</p>

## What It Does

AutoOffice is a task-pane add-in you chat with. Describe what you want — for Word ("make all headings blue", "insert a 3-column table"), Excel ("put 1 through 10 in column A", "build a column chart from B2:D8"), or PowerPoint ("add a slide titled 'Q3 plan' with three bullets", "make every slide title bold") — and the agent:

1. Looks up the relevant `office.js` API docs as needed
2. Generates working code
3. Shows you the code for approval before running it
4. Executes it in a sandboxed iframe against your live Word document
5. Self-heals on errors — feeds the error back to the LLM and retries up to 3 times

## Why AutoOffice

Two things make AutoOffice different from every other AI option for Word and Excel:

**1. Private by design — open source, runs locally, works with local models.**
The whole add-in is MIT-licensed and runs in your browser as a normal Office task pane. Your API key is stored on your machine, and traffic goes only to the provider you pick — Anthropic, OpenAI, Azure, or any OpenAI-compatible endpoint. Point it at Ollama or LM Studio and your document never leaves the machine. No Microsoft account requirement, no Copilot license, no third-party server in the middle. Audit the code, fork it, self-host the build — nothing is hidden.

**2. Pure `office.js` + MCP — minimal in code, maximal in capability.**
There is no curated wrapper API. The agent has exactly two built-in tools: look up the relevant `office.js` API docs, and run real code against the live document. That means anything Word or Excel can natively do is reachable on day one — formatting, tables, charts, ranges, comments, content controls, all of it — without us having to "support" each operation one at a time. Plug in MCP servers (Linear, Notion, internal APIs) and the same tiny surface area extends to anything outside Office too. Tiny core, unbounded reach.

## Comparison: Word + Excel AI Add-ins

| | **AutoOffice** | **Microsoft Copilot** | **Claude for Word** | **Word GPT Plus** |
|---|:---:|:---:|:---:|:---:|
| **— Privacy & openness —** | | | | |
| Open source | ✅ MIT | ❌ | ❌ | ✅ MIT |
| Self-hostable | ✅ | ❌ | ❌ | ✅ |
| Local model support | ✅ Ollama, LM Studio | ❌ | ❌ | ✅ Ollama |
| BYO API key (key stays local) | ✅ | ❌ | ❌ | ✅ |
| Cost | Free + your provider usage | M365 Copilot license | Claude paid plan | Free + your provider usage |
| Provider choice | Anthropic, OpenAI, any OpenAI-compatible, Ollama | Microsoft-hosted only | Claude only | OpenAI, Azure, Gemini, Ollama |
| **— Power (small core, big reach) —** | | | | |
| Executes real `office.js` | ✅ | ❌ | ❌ | ⚠️ partial |
| Code preview before run | ✅ | ❌ | ❌ | ❌ |
| MCP support | ✅ HTTP / SSE | ✅ via Copilot Studio | ❌ | ❌ |
| Reaches full Word + Excel API surface | ✅ via real code | ⚠️ curated actions | ⚠️ curated actions | ⚠️ curated actions |
| **— AutoOffice trade-offs —** | | | | |
| Native tracked-changes UX | ❌ | ❌ | ✅ | ❌ |
| Cross-app context (Outlook, Teams, PPT…) | ❌ Word + Excel + PowerPoint, single-doc | ✅ all M365 | ✅ Word + Excel + PPT | ❌ |

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

The same task pane runs in Word, Excel, and PowerPoint; `HostContext` is resolved at startup and gates the skill registry, sandbox wrapping, and system prompt per host.

## Quick Start

### Prerequisites

- Node.js 18+
- Microsoft 365 (Word, Excel, or PowerPoint — Web or Desktop)
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

### Run + sideload (with debugger)

```bash
npm run start
```

Starts the dev server and sideloads the add-in into Word with the debugger attached. The server runs at **https://localhost:3721**.

### Run + sideload (no debugger — recommended for regular dev)

```bash
npm run sideload
```

Same as `start` but without attaching the debugger. Faster startup, targets desktop Word directly. Use this for day-to-day testing when you don't need breakpoints.

### Run + sideload Excel

Same scripts but targeting Excel:

```bash
npm run start:excel       # debugger
npm run sideload:excel    # no debugger
```

### Run + sideload PowerPoint

Same scripts but targeting PowerPoint:

```bash
npm run start:powerpoint       # debugger
npm run sideload:powerpoint    # no debugger
```

### Run dev server only

```bash
npm run dev
```

Starts only the Vite dev server — no sideloading. Useful if you're working on the UI and sideloading separately.

### Sideload manually

If the dev server is already running:

**Insert → Add-ins → Upload My Add-in** → pick `manifest.xml`.

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

To read document state the agent writes `execute_code` that loads and returns the needed properties directly — no separate tool required.

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

Settings are persisted via `Office.context.roamingSettings` when running inside Office, and `localStorage` during development. Provider, API key, MCP server, and other settings are shared across Word, Excel, and PowerPoint by design — there is one logical add-in per install.

## Build

```bash
npm run build
```

Output goes to `dist/`. Deploy the `dist/` folder to any HTTPS host and update the URLs in `manifest.xml`.

## Notes

- **Browser-only MCP:** The add-in runs entirely client-side. Only HTTP/SSE MCP transports work — no stdio. Local MCP servers need to expose an HTTP endpoint.
- **CORS:** Direct browser-to-API calls work with Anthropic and OpenAI. If you hit CORS issues with a provider, you'll need a lightweight proxy.
- **iframe context:** The sandbox iframe loads its own `office.js` instance. This follows the same pattern as Microsoft's Script Lab.

## Roadmap

### Chat History
Conversation history currently lives in memory only and is lost when the task pane closes or the add-in reloads.

Planned work:
- **Persist conversation** — serialize `ModelMessage[]` to `Office.context.roamingSettings` (or `localStorage` in dev) on each turn and restore on init
- **Named conversations** — let users save, rename, and switch between multiple conversation threads
- **History panel** — a sidebar view that lists past conversations and lets users reload them into the chat pane
- **Export** — copy conversation (including generated code and results) as markdown or plain text
