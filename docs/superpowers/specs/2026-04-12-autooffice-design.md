# AutoOffice: AI-Powered Dynamic Code Execution Add-in for Microsoft Word

**Date:** 2026-04-12
**Status:** Draft

---

## Overview

AutoOffice is a side-loaded Microsoft Word add-in that acts as an AI coding agent for Word. Unlike existing wrapper-based tools (e.g., word-GPT-Plus) that map LLM decisions to pre-written functions, AutoOffice dynamically generates and executes arbitrary office.js code on the fly, grounded by on-demand API documentation retrieval.

The user chats with the agent. The agent reasons about the request, pulls in relevant office.js API docs via tool calls ("skills"), generates code, shows it for approval, executes it in a sandboxed iframe against the live document, and transparently self-heals on errors. The add-in supports multiple AI providers and is extensible via MCP servers.

**Key differentiator:** Zero wrapper functions. The AI writes and runs real office.js code, grounded by structured API docs fetched on demand rather than a bloated system prompt.

---

## Target Platform

- **Microsoft 365** — Word on Web + Desktop (Windows, Mac)
- Cross-platform targeting: WordApi requirement sets 1.1-1.9
- No WordApiDesktop-only features (to ensure web compatibility)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React + TypeScript |
| Build | Vite (with HTTPS for sideloading) |
| UI Components | Fluent UI (`@fluentui/react-components`) |
| AI/Agent | Vercel AI SDK (`ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`) |
| MCP | `@ai-sdk/mcp` |
| Code Highlighting | Shiki or prism-react-renderer |
| Schemas | Zod |
| Dev Certs | `office-addin-dev-certs` |

---

## Architecture

```
+-----------------------------------------------------+
|                    Task Pane (React)                 |
|  +---------------+  +----------------------------+  |
|  |   Chat UI     |  |   Code Preview Panel       |  |
|  |  (Fluent UI)  |  |   (read-only + approve/    |  |
|  |               |  |    reject + auto-approve)   |  |
|  +-------+-------+  +------------+---------------+  |
|          |                       |                   |
|  +-------v-----------------------v---------------+  |
|  |            Agent Orchestrator                  |  |
|  |  - Manages conversation history                |  |
|  |  - Routes tool calls (skills, execute, MCP)    |  |
|  |  - Handles self-healing retry loop             |  |
|  |  - Multi-provider LLM client via AI SDK        |  |
|  +-------------------+---------------------------+  |
|                      |                               |
|  +-------------------v---------------------------+  |
|  |           Skill Registry                       |  |
|  |  - Structured office.js API doc chunks         |  |
|  |  - Agent calls lookup_skill("tables") etc.     |  |
|  |  - Returns relevant API reference + examples   |  |
|  +-----------------------------------------------+  |
|                      |                               |
|  +-------------------v---------------------------+  |
|  |           MCP Client                           |  |
|  |  - Connects to user-configured MCP servers     |  |
|  |  - Discovers and surfaces external tools       |  |
|  |  - HTTP-based transports only (browser env)    |  |
|  +-----------------------------------------------+  |
|                      |                               |
|          +-----------v----------+                    |
|          |   postMessage bridge |                    |
|          +-----------+----------+                    |
|  +-------------------v---------------------------+  |
|  |        Sandboxed Execution Iframe              |  |
|  |  - Loads office.js from CDN                    |  |
|  |  - Receives code as <script> injection         |  |
|  |  - Executes against live document              |  |
|  |  - Returns result/error via postMessage        |  |
|  +-----------------------------------------------+  |
+-----------------------------------------------------+
```

### Data Flow

1. User types a prompt in chat (e.g., "Make all headings blue")
2. Agent Orchestrator sends prompt + conversation history to the LLM via AI SDK `streamText()`
3. LLM calls `lookup_skill("formatting")` and/or other skill tools
4. Orchestrator returns the relevant API docs to the LLM
5. LLM generates office.js code and calls `execute_code(code)`
6. Code Preview Panel shows the code to the user (unless auto-approve is on)
7. User approves -> code is sent to the sandboxed iframe via `postMessage`
8. Iframe executes the code against the live Word document
9. Iframe returns success/error via `postMessage`
10. On error -> orchestrator feeds the error back to the LLM, which generates corrected code (up to 3 attempts, all visible in chat)
11. Result displayed in chat

---

## Agent Orchestrator

### Multi-Provider via AI SDK

```typescript
import { streamText, tool } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
```

- Each provider is a model factory: `createAnthropic({ apiKey })('claude-sonnet-4-20250514')`, `createOpenAI({ apiKey })('gpt-4o')`, etc.
- OpenAI-compatible local models (Ollama, LM Studio) work via `createOpenAI` with a custom `baseURL`
- Tool definitions use AI SDK's `tool()` helper with Zod schemas
- Streaming and multi-step agent loops are handled by `streamText` with `maxSteps`

### Built-in Tools

| Tool | Purpose |
|------|---------|
| `lookup_skill(name)` | Fetch office.js API docs for a specific domain |
| `execute_code(code)` | Submit generated office.js code for execution in the sandbox |
| `read_document_state()` | Get current document context: selected text, headings outline, cursor position |

The LLM sees all tools (built-in + MCP) uniformly and decides which to call.

### Self-Healing Loop

```
LLM generates code
  -> User approves (or auto-approve)
  -> Execute in iframe
  -> Success? -> Show result in chat, done
  -> Error? -> Append error to conversation:
      "Execution failed: {error.message}\n{error.stack}\nPlease fix and try again."
  -> LLM generates corrected code
  -> Repeat (max 3 attempts)
  -> All failed? -> Show final error in chat, let user decide
```

Each attempt is visible in the chat as a distinct message (transparent self-healing). The user sees: "Attempt 1 failed: `TypeError: property not loaded`. Retrying..."

### Conversation History

Stored in React state (in memory). Includes user messages, assistant messages, tool calls/results, and execution results. No persistence across sessions.

---

## Skill Registry

### Purpose

The skill registry provides the agent with office.js API documentation on demand. Instead of stuffing the entire API surface into the system prompt, the agent calls `lookup_skill` to fetch only the docs it needs for the current task.

### Structure

Each skill is a self-contained markdown file covering one API domain:

```
skills/
  formatting.md       - Font, color, bold/italic, paragraph formatting
  tables.md           - Table creation, rows, columns, cell manipulation
  content-controls.md - Content controls, rich text, plain text, dropdowns
  styles.md           - Built-in and custom styles, style sets
  ranges.md           - Range selection, manipulation, insertLocation
  search.md           - Search/replace, regex, wildcards
  comments.md         - Comments, replies, tracked changes
  headers-footers.md  - Headers, footers, sections
  images.md           - Inline pictures, positioning
  lists.md            - Numbered/bulleted lists, list levels
  document.md         - Document properties, sections, body
  context-sync.md     - The context.sync() batching model (critical reference)
```

### Skill File Format

Each file contains:
1. A brief description of the domain
2. Key types and interfaces involved
3. Common patterns with correct `context.sync()` usage
4. Working, tested code examples
5. Common pitfalls and how to avoid them

### Tool Definition

```typescript
tool({
  name: 'lookup_skill',
  description: 'Fetch office.js API documentation for a specific domain',
  parameters: z.object({
    name: z.enum([
      'formatting', 'tables', 'content-controls', 'styles',
      'ranges', 'search', 'comments', 'headers-footers',
      'images', 'lists', 'document', 'context-sync'
    ])
  }),
  execute: async ({ name }) => readSkillFile(name)
})
```

### Why This Works

- Keeps token usage low: only load what's needed per request
- Each skill can be detailed and thorough without worrying about total prompt size
- Easy to maintain: update one file when the API changes
- Easy to extend: add a new skill file, add its name to the enum

---

## MCP Client Integration

### Purpose

MCP support makes the add-in an extensible platform. Users can connect any MCP server to give the agent additional capabilities beyond Word manipulation (file access, databases, web search, custom business logic, etc.).

### Implementation

- Uses `@ai-sdk/mcp` which integrates directly with the AI SDK tool system
- MCP server tools are automatically surfaced alongside built-in tools in `streamText()` calls
- The LLM sees all tools (built-in + MCP) uniformly

### Configuration

Users configure MCP servers in the settings panel:
- Server name
- Transport type: Streamable HTTP or SSE (no stdio — browser environment)
- Server URL
- Connection status (connected/disconnected/error)
- Ability to browse discovered tools per server
- Enable/disable individual servers

### Browser Constraint

Since the add-in runs entirely client-side in a WebView, only HTTP-based MCP transports work. Users running local MCP servers need to expose them over HTTP.

### Design Principle

Make it as easy and flexible as possible to add MCP servers. Follow existing AI SDK + MCP patterns — no custom abstractions.

---

## Sandboxed Execution Engine

### Architecture

The task pane maintains a hidden `<iframe>` as the execution sandbox. This is the pattern pioneered by Microsoft's Script Lab add-in.

### Execution Flow

1. Task pane serializes the generated code into a message
2. `postMessage` sends it to the iframe
3. Iframe wraps the code in a `<script>` tag, injects it into its own DOM
4. The script runs with access to the iframe's `Word` / `Office` context
5. Result or error is sent back via `postMessage`

### Iframe Lifecycle

- Created once when the add-in loads
- Loads `office.js` from CDN and calls `Office.onReady()`
- Reused across executions for speed
- If an execution crashes the iframe, detected via timeout, killed, and respawned

### Message Protocol

```typescript
// Task pane -> Iframe
{ type: 'execute', id: string, code: string }

// Iframe -> Task pane
{ type: 'result', id: string, success: true, output: any }
{ type: 'error', id: string, success: false, error: string, stack: string }
```

### Timeout Protection

- Each execution gets a configurable timeout (default 30s)
- If the iframe doesn't respond within the timeout, treat it as a crash
- Kill and respawn the iframe, return a timeout error to the self-healing loop

### Code Format Handling

The executor accepts both:
- Complete `Word.run(async (context) => { ... })` blocks
- Just the inner body (executor wraps it in `Word.run` automatically)

This avoids failures from inconsistent LLM output formatting.

### Key Validation Item

Whether a child iframe within the task pane can successfully initialize its own Office.js context and access the host document needs early validation. Script Lab proved the pattern works, but we verify during implementation. Fallback: `new Function()` with CSP configuration in the parent context.

---

## Chat UI & Code Preview

### Chat Panel

Standard chat interface built with Fluent UI:
- Message list with user/assistant message bubbles
- Input field with send button
- Streaming responses: tokens render as they arrive via AI SDK's `streamText`
- Tool call activity shown inline (e.g., "Looking up formatting docs...", "Executing code...")
- Settings accessible via gear icon

### Code Preview Block

When the agent generates code via `execute_code`, it appears as an inline code block in the chat:
- Syntax-highlighted JavaScript (Shiki or Prism, no Monaco)
- **Approve** button: runs the code
- **Reject** button: tells the agent the user declined
- Execution status indicator after approval: running -> success / error

### Auto-Approve Mode

- Toggle in settings (off by default)
- When on, code executes immediately
- Code block still appears in chat marked as "auto-approved"
- Can be toggled mid-conversation

### Self-Healing Visibility

- Each retry attempt appears as a new message in chat
- Corrected code blocks appear for approval (unless auto-approve is on)
- After max retries, final error message with full details

### Layout

- Single task pane panel (~350-400px wide, standard Office task pane)
- Chat takes full height, code blocks are inline within the conversation flow
- No split panels or tabs

---

## System Prompt Design

### Structure

1. **Role & Behavior** — You are a Word document assistant that controls Word by writing and executing office.js code
2. **Available Skills (enum list)** — formatting, tables, content-controls, styles, ranges, search, comments, headers-footers, images, lists, document, context-sync
3. **Critical Rules for office.js:**
   - MUST `load()` properties before reading them
   - MUST `await context.sync()` after `load()` and before accessing values
   - MUST use `Word.InsertLocation` enum for insertion positions
   - NEVER use DOM manipulation — only the office.js API
   - Code runs in a sandboxed iframe with access to the Word object
4. **Output Format** — When calling `execute_code`, provide the code to execute. The executor handles both full `Word.run` blocks and inner-body-only format.

### Token Budget

- System prompt: ~1000 tokens
- Each skill lookup adds 500-1500 tokens on demand
- Total context stays lean

---

## Settings & Configuration

### Stored Settings

| Setting | Default |
|---------|---------|
| AI Provider | (none — user selects) |
| Model | (provider-dependent) |
| API Key per provider | (none — user enters) |
| Auto-approve toggle | Off |
| MCP server configurations | Empty list |
| Max self-healing retries | 3 |
| Execution timeout | 30s |

### Storage Mechanism

- Primary: `Office.context.roamingSettings` — persists across sessions, roams with M365 account
- Fallback: `localStorage` (for development outside Office)

### API Key Security

- Keys stored locally on the user's machine only
- Never sent anywhere except directly to the AI provider's API
- No backend, no third-party server
- Settings panel shows keys masked with show/hide toggle

---

## Project Structure

```
autoOffice/
  src/
    taskpane/
      index.tsx                — Entry point, Office.onReady
      App.tsx                  — Root component
      components/
        ChatPanel.tsx          — Message list + input
        CodeBlock.tsx          — Syntax-highlighted code with approve/reject
        MessageBubble.tsx      — Individual chat message
        ToolActivity.tsx       — Inline tool call indicators
        SettingsPanel.tsx      — Provider config, API keys, MCP servers, auto-approve
      agent/
        orchestrator.ts        — Main agent loop (streamText + tool routing + self-healing)
        tools.ts               — Built-in tool definitions (lookup_skill, execute_code, read_document_state)
        providers.ts           — Provider factory (createAnthropic, createOpenAI, etc.)
      executor/
        sandbox.ts             — Iframe lifecycle, postMessage bridge
        iframe.html            — Iframe template (loads office.js, listens for execute messages)
      skills/
        index.ts               — Skill registry, lookup function
        formatting.md
        tables.md
        context-sync.md
        ...                    — Additional skill files
      mcp/
        client.ts              — MCP client setup via @ai-sdk/mcp
      store/
        settings.ts            — Settings persistence (roamingSettings / localStorage)
  manifest.xml                 — Office add-in manifest
  vite.config.ts
  package.json
  tsconfig.json
  index.html
```

---

## Open Questions & Risks

1. **Iframe Office.js context:** Can a child iframe within the task pane initialize its own Office.js context and access the host document? Script Lab proved this works, but needs early validation. Fallback: `new Function()` execution in the parent context with CSP adjustments.

2. **LLM code quality:** office.js has a non-trivial batching model (`load()` + `context.sync()`). LLMs frequently get this wrong. Mitigation: the `context-sync` skill provides detailed rules and examples, and the self-healing loop catches and corrects failures.

3. **AI SDK browser compatibility:** The Vercel AI SDK is primarily designed for Next.js server-side usage. Using it client-side (direct browser-to-API calls) needs validation — specifically CORS behavior with Anthropic/OpenAI APIs. Some providers may require a lightweight proxy or CORS-friendly endpoints.

4. **MCP in browser:** Only HTTP-based transports work. Users with stdio-only MCP servers would need an HTTP adapter.

---

## Non-Goals (v1)

- No AppSource/store distribution
- No backend/proxy server
- No conversation persistence across sessions
- No collaborative/multi-user features
- No VBA/macro interop
- No support for Excel, PowerPoint, or other Office hosts (Word only)
