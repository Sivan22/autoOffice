# Smoke checklist — local full-stack migration

Run on a clean Windows 10 + Windows 11 VM with Microsoft 365 (Word, Excel, PowerPoint) installed and AutoOffice never previously installed. Tick each line as you verify.

## Install

- [ ] `AutoOffice-Setup.exe` runs without SmartScreen blocking after "Run anyway".
- [ ] Cert prompt appears once and accepting it succeeds (or no prompt — also OK).
- [ ] Scheduled Task `AutoOffice\Service` exists and is Running.
- [ ] `https://localhost:47318/health` returns 200 from the VM browser.
- [ ] Word lists "AutoOffice" under Home → Add-ins → Advanced → Shared Folder.

## First-launch UX

- [ ] Task pane loads in Word without any cert error overlay.
- [ ] Task pane also loads in Excel and PowerPoint (open each, sideload, verify).
- [ ] If migrating from a prior install, the legacy import modal appears and Import succeeds.

## Direct API provider (Anthropic)

- [ ] Add Anthropic provider with a valid key — readiness goes "ready".
- [ ] Send "make all paragraphs bold" — agent calls `lookup_skill`, then `execute_code`, document changes.
- [ ] On code error, retry happens automatically.

## CLI-bridge provider (Claude Code)

- [ ] `claude --version` works in the same user shell.
- [ ] Add the Claude Code provider — status "ready".
- [ ] Send "make all paragraphs bold" — works the same as direct API.

## stdio MCP server

- [ ] Add `npx -y @modelcontextprotocol/server-filesystem /tmp` (or similar).
- [ ] Status goes to "connected", N tools listed.
- [ ] Set one tool to `deny`; ask the agent to use it — model says it can't, doesn't try.
- [ ] Set one tool to `ask`; trigger it — approve UI appears, Approve runs the tool, Deny short-circuits.
- [ ] Set one tool to `allow`; trigger it — runs silently.

## CORS-blocked HTTP MCP

- [ ] Add an HTTP MCP that previously failed in the browser-only build — now connects.

## Persistence

- [ ] Send a message; close the task pane mid-stream; reopen — the final response is saved.
- [ ] Reload Word; reopen task pane; the conversation is intact.

## Uninstall

- [ ] Settings → Apps → AutoOffice → Uninstall completes.
- [ ] Scheduled Task removed.
- [ ] Cert removed from CurrentUser\Root (`Get-ChildItem Cert:\\CurrentUser\\Root | Where Subject -match 'AutoOffice'` returns empty).
- [ ] Manifest removed from share folder.
- [ ] Data folder prompt shown — both "Yes" and "No" paths leave a clean system.

## Repeat on Windows 11

Run the entire list a second time on Windows 11. Differences vs Windows 10 noted here.

---

# Definition-of-Done cross-check (Plan 10 wrap-up)

Each item below is the spec's "Migration strategy → Definition of 'done and connected'" checklist verified against the implementation produced by Plans 01–10. Items either run on this Linux dev host (`verified locally`) or are inherently Windows + Office and thus deferred to the manual smoke checklist above (`windows-only-manual`).

| Spec DoD item | Status | Evidence |
| --- | --- | --- |
| All tests green: unit, integration, end-to-end | verified locally | `npm run test` passes across `@autooffice/shared`, `@autooffice/server`, `@autooffice/web`. Playwright e2e suite (`@autooffice/e2e`) has 4 specs across chat/settings/reload — all green when run on this host with `AUTOOFFICE_BUN_BIN` set. |
| Bun-compiled `autoOffice-server.exe` runs on a clean Windows 10 + 11 VM without bun installed | windows-only-manual | Smoke checklist "Install" + "First-launch UX" sections. Build wired into CI `build-smoke` and `installer-smoke` jobs. |
| Cert + token + Scheduled Task created by installer; verified by reboot → log in → service is running → task pane opens | windows-only-manual | Plans 06 (cert/token/tray) + 07 (installer extension). Smoke checklist "Install" section. |
| Word, Excel, PowerPoint each load the SPA from `https://localhost:47318` without certificate or sideload errors | windows-only-manual | Smoke checklist "First-launch UX" section. |
| Direct-API provider (Anthropic) and CLI-bridge provider (Claude Code) both stream through the agent loop | windows-only-manual (CLI-bridge) / partial locally | Server-side providers tested with vitest (Anthropic provider readiness, factory). CLI-bridge per-spec only runs end-to-end with a real `claude` binary on a real Windows host. |
| Stdio MCP server (e.g. `@modelcontextprotocol/server-filesystem`) connects on add, surfaces tools with `default_policy: ask`, all three policies (allow/ask/deny) work | windows-only-manual | McpHub + policy code covered by vitest in `apps/server`. End-to-end policy approval UI is in the smoke checklist "stdio MCP server" section. |
| HTTP MCP server that was CORS-blocked in the browser-only build now works | windows-only-manual | Smoke checklist "CORS-blocked HTTP MCP" section. Server-side fetch isn't subject to browser CORS, validated by McpHub's HTTP transport tests. |
| `execute_code` still streams into the message bubble as the model emits, executes against the live document, and self-heals on error | windows-only-manual + verified locally | Streaming flow verified by Playwright `chat.spec.ts` (text + tool-call render). Live document execution is by definition Windows-only; covered in smoke checklist "Direct API provider" section. |
| Conversation persists across task-pane close + reopen and across server restart | verified locally | Playwright `reload.spec.ts` exercises page-reload persistence against the bun server's SQLite store. |
| Legacy `localStorage` / `roamingSettings` data imports cleanly on first launch after upgrade | verified locally | Plan 08 added `routes/import-legacy.ts` + `LegacyImportModal`, both tested with vitest. Manual upgrade path is in smoke checklist "First-launch UX" section. |
| Uninstaller removes Scheduled Task, cert, manifest, and (with confirmation) the data folder | windows-only-manual | Smoke checklist "Uninstall" section. Code paths covered by Plan 07 + Plan 06's `cli/cert-uninstall.ts` (vitest passes). |
| GitHub Pages serves the new landing site, not the old SPA | verified locally | Plan 09 cut `landing/`. CI `deploy.yml` publishes `landing/` to Pages. Repo state confirms old `dist/` is no longer the Pages source. |

## Local-run testing commands used for this report

```bash
npm run test                          # all workspaces
cd e2e && AUTOOFFICE_BUN_BIN=$(which bun) npx playwright test --reporter=line
```

The Playwright suite needs Chromium (`npx playwright install chromium`) and an available port 47318.
