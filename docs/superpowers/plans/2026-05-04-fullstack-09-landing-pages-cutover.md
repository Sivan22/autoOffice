# Local full-stack — Plan 09: Landing site + GitHub Pages cutover

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the GitHub-Pages-served SPA with a static marketing site under `landing/` (download installer, install/troubleshooting guide, self-host instructions). Update the existing `deploy.yml` workflow to build `landing/` instead of `apps/web/dist/`.

**Architecture:** Plain HTML + a tiny CSS file. No framework. Each page is one file under `landing/`. Assets (icon, screenshots) live under `landing/assets/`. The "Download" button on the landing page links to the latest GitHub Releases asset (`AutoOffice-Setup.exe`). The guide pages cover cert prompt, port collision, "service not running", and the manual restart story.

**Tech Stack:** Plain HTML + CSS. The existing GitHub Action just rsyncs the directory.

**Branch:** `feat/local-fullstack` (continued)

**Spec:** `docs/superpowers/specs/2026-05-04-local-fullstack-migration-design.md` — see "GitHub Pages migration".

---

## File structure after this plan

```
landing/
├── index.html                        NEW (landing page)
├── style.css                         NEW
├── guide/
│   ├── install.html                  NEW
│   └── troubleshooting.html          NEW
├── self-host/
│   └── index.html                    NEW
└── assets/
    ├── icon-256.png                  COPIED from apps/web/public/assets/
    ├── icon-32.png                   COPIED
    └── screenshot-task-pane.png      OPTIONAL (placeholder ok)

.github/workflows/
└── deploy.yml                        MODIFIED (deploys landing/ instead of dist/)
```

---

## Task 1: Skeleton + style

**Files:**
- Create: `landing/style.css`
- Copy: `landing/assets/icon-256.png`, `landing/assets/icon-32.png`

- [ ] **Step 1: Copy icons**

```bash
mkdir -p landing/assets
cp apps/web/public/assets/icon-256.png landing/assets/icon-256.png
cp apps/web/public/assets/icon-32.png landing/assets/icon-32.png
```

- [ ] **Step 2: Write the stylesheet**

`landing/style.css`:
```css
:root { color-scheme: light dark; --max: 64ch; }
* { box-sizing: border-box; }
body {
  margin: 0;
  font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
  background: #fafafa;
  color: #111;
}
@media (prefers-color-scheme: dark) {
  body { background: #111; color: #eee; }
  a { color: #6fb8ff; }
}
header, main, footer {
  max-width: var(--max);
  margin: 0 auto;
  padding: 2rem 1.5rem;
}
header { display: flex; align-items: center; gap: 1rem; }
header img { width: 64px; height: 64px; }
h1, h2, h3 { line-height: 1.2; }
.cta {
  display: inline-block;
  margin: 1rem 0;
  padding: 0.75rem 1.25rem;
  background: #2563eb;
  color: white;
  text-decoration: none;
  border-radius: 6px;
  font-weight: 600;
}
.cta:hover { background: #1e3fb6; }
table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
th, td { padding: 0.5rem 0.75rem; border-bottom: 1px solid rgba(127, 127, 127, 0.3); text-align: left; }
code, pre { font-family: ui-monospace, "JetBrains Mono", "Fira Code", monospace; }
pre { background: rgba(127, 127, 127, 0.15); padding: 0.75rem; overflow-x: auto; border-radius: 4px; }
.note { background: rgba(255, 196, 0, 0.15); padding: 0.75rem; border-left: 4px solid orange; margin: 1rem 0; }
nav.crumbs { font-size: 0.9rem; opacity: 0.8; }
```

- [ ] **Step 3: Commit**

```bash
git add landing
git commit -m "feat(landing): skeleton + style.css + icon assets"
```

---

## Task 2: `index.html`

**Files:**
- Create: `landing/index.html`

- [ ] **Step 1: Write the page**

`landing/index.html`:
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AutoOffice — AI for Word, Excel, and PowerPoint, locally</title>
  <link rel="stylesheet" href="style.css" />
  <link rel="icon" href="assets/icon-32.png" type="image/png" />
  <meta name="description" content="AutoOffice is a private, open-source AI add-in for Word, Excel, and PowerPoint. The agent and your data live entirely on your machine." />
</head>
<body>
  <header>
    <img src="assets/icon-256.png" alt="AutoOffice icon" />
    <div>
      <h1>AutoOffice</h1>
      <p>AI for Microsoft Word, Excel, and PowerPoint — running entirely on your machine.</p>
    </div>
  </header>
  <main>
    <section>
      <h2>Private. Open-source. Local.</h2>
      <p>AutoOffice is a task pane that chats with you, generates real <code>office.js</code> code, runs it against your live document, and self-heals on errors. After the move to a local server, the AI loop, MCP tools, and your conversation history all run inside a small bundled service on your computer — no cloud, no Microsoft account, no third-party server in the middle.</p>
      <p><a class="cta" href="https://github.com/Sivan22/autoOffice/releases/latest">Download for Windows</a></p>
      <p style="opacity: 0.8;">Requires Microsoft 365 (Word, Excel, or PowerPoint, desktop). Windows 10 / 11.</p>
    </section>
    <section>
      <h2>What's new in the local version</h2>
      <ul>
        <li><b>Use your own CLI subscriptions</b> — Claude Code, Gemini CLI, OpenCode. The agent runs in a local server that can spawn the CLI you already have logged in, so a Pro subscription replaces per-token billing.</li>
        <li><b>stdio MCP servers work</b> — the browser couldn't spawn processes; the local server can. CORS-blocked HTTP MCP servers also work because the server proxies them.</li>
        <li><b>Provider keys never leave your machine</b> — they're encrypted with Windows DPAPI tied to your user.</li>
        <li><b>Allow / Ask / Deny per tool</b> — every MCP tool gets a per-tool permission you can flip from the settings panel. Denied tools are invisible to the model.</li>
      </ul>
    </section>
    <section>
      <h2>How it stacks up</h2>
      <table>
        <tr><th></th><th>AutoOffice</th><th>Microsoft Copilot</th><th>Claude for Word</th><th>Word GPT Plus</th></tr>
        <tr><td>Open source</td><td>✅ MIT</td><td>❌</td><td>❌</td><td>✅ MIT</td></tr>
        <tr><td>Self-hostable</td><td>✅</td><td>❌</td><td>❌</td><td>✅</td></tr>
        <tr><td>Local model support</td><td>✅</td><td>❌</td><td>❌</td><td>✅</td></tr>
        <tr><td>Executes real <code>office.js</code></td><td>✅</td><td>❌</td><td>❌</td><td>⚠</td></tr>
        <tr><td>MCP support</td><td>✅ (stdio + HTTP)</td><td>via Copilot Studio</td><td>❌</td><td>❌</td></tr>
        <tr><td>Cost</td><td>Free + your provider usage</td><td>M365 Copilot license</td><td>Claude paid plan</td><td>Free</td></tr>
      </table>
    </section>
    <section>
      <h2>Get started</h2>
      <ol>
        <li><a href="https://github.com/Sivan22/autoOffice/releases/latest">Download AutoOffice-Setup.exe</a> and run it.</li>
        <li>Restart Word (or Excel / PowerPoint).</li>
        <li>Home → Add-ins → Advanced → Shared Folder → AutoOffice → Add.</li>
      </ol>
      <p>See the <a href="guide/install.html">install guide</a> for screenshots and the <a href="guide/troubleshooting.html">troubleshooting page</a> if anything doesn't go smoothly. Want to build the installer yourself? See <a href="self-host/">self-host</a>.</p>
    </section>
  </main>
  <footer>
    <p>Source: <a href="https://github.com/Sivan22/autoOffice">github.com/Sivan22/autoOffice</a> · MIT licensed.</p>
  </footer>
</body>
</html>
```

- [ ] **Step 2: Open it locally and eyeball**

```bash
python3 -m http.server -d landing 8000 &
xdg-open http://localhost:8000/  # or just curl + read in headless
```
Stop the server when done.

- [ ] **Step 3: Commit**

```bash
git add landing/index.html
git commit -m "feat(landing): top-level page (download CTA + comparison + 3-step quickstart)"
```

---

## Task 3: Install guide

**Files:**
- Create: `landing/guide/install.html`

- [ ] **Step 1: Write the page**

`landing/guide/install.html`:
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>AutoOffice — Install guide</title>
  <link rel="stylesheet" href="../style.css" />
  <link rel="icon" href="../assets/icon-32.png" type="image/png" />
</head>
<body>
  <header>
    <a href="../"><img src="../assets/icon-256.png" alt="AutoOffice" /></a>
    <h1>Install guide</h1>
  </header>
  <main>
    <nav class="crumbs"><a href="../">Home</a> · Install guide · <a href="troubleshooting.html">Troubleshooting</a></nav>
    <h2>1. Download and run the installer</h2>
    <p>Grab <a href="https://github.com/Sivan22/autoOffice/releases/latest"><code>AutoOffice-Setup.exe</code></a> from the latest release and run it. It needs admin so it can register the add-in for Word.</p>
    <p>If Windows shows <b>"Windows protected your PC"</b>, click <b>More info → Run anyway</b>. The installer is unsigned right now.</p>
    <h2>2. Approve the certificate prompt (one-time)</h2>
    <div class="note">
      During install, Windows asks you to trust a self-signed certificate for <code>localhost</code>. Click <b>Yes</b>. The cert is unique to your install, never leaves your machine, and is removed automatically when you uninstall.
    </div>
    <p>This step is what lets the AutoOffice task pane load from <code>https://localhost:47318</code> without scary cert warnings inside Word.</p>
    <h2>3. Restart Word and add the add-in</h2>
    <ol>
      <li>Close and reopen Word.</li>
      <li>Home → Add-ins → Advanced → Shared Folder.</li>
      <li>Pick <b>AutoOffice</b> from the list, click <b>Add</b>.</li>
    </ol>
    <h2>4. Configure a provider</h2>
    <p>Open the AutoOffice task pane, click the gear icon, and either:</p>
    <ul>
      <li>Add a direct API provider (Anthropic, OpenAI, etc.) and paste your key.</li>
      <li>Or add a CLI-bridge provider (Claude Code, Gemini CLI, OpenCode) — no key needed; the local server will use the CLI's existing auth in your home directory.</li>
    </ul>
    <p>Done. Type a request and watch the agent generate code, run it, and self-heal.</p>
    <p style="margin-top: 2rem;"><a href="troubleshooting.html">→ Troubleshooting</a></p>
  </main>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add landing/guide/install.html
git commit -m "feat(landing): install guide page"
```

---

## Task 4: Troubleshooting guide

**Files:**
- Create: `landing/guide/troubleshooting.html`

- [ ] **Step 1: Write the page**

`landing/guide/troubleshooting.html`:
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>AutoOffice — Troubleshooting</title>
  <link rel="stylesheet" href="../style.css" />
  <link rel="icon" href="../assets/icon-32.png" type="image/png" />
</head>
<body>
  <header>
    <a href="../"><img src="../assets/icon-256.png" alt="AutoOffice" /></a>
    <h1>Troubleshooting</h1>
  </header>
  <main>
    <nav class="crumbs"><a href="../">Home</a> · <a href="install.html">Install</a> · Troubleshooting</nav>

    <h2>The task pane is blank or shows "page can't be loaded"</h2>
    <p>The local AutoOffice service may not be running. Check Task Scheduler for <code>AutoOffice\Service</code>; if its status isn't <b>Running</b>, right-click → <b>Run</b>. As a quick fix you can also log out and back in — the service auto-starts at logon.</p>
    <p>Confirm the server replies:</p>
    <pre>curl https://localhost:47318/health</pre>
    <p>If <code>curl</code> can reach it but Word can't, the cert may not be trusted in your user store; re-run the installer.</p>

    <h2>Cert prompt didn't appear, or I clicked "No"</h2>
    <p>Re-run <code>AutoOffice-Setup.exe</code> and accept the prompt this time. The installer is idempotent.</p>

    <h2>Port 47318 is already in use</h2>
    <p>Some other tool is listening on the same port. Stop the other tool, or set a different port: edit <code>%LOCALAPPDATA%\AutoOffice\config\config.json</code> and change <code>port</code>, then restart Task Scheduler's <code>AutoOffice\Service</code>. You'll also need to update <code>SourceLocation</code> in <code>{install dir}\manifest.xml</code> to match — and re-add the add-in via Insert → Add-ins → Upload My Add-in.</p>

    <h2>CLI provider says "claude not found"</h2>
    <p>The local service runs as your user, so it inherits your <code>%PATH%</code>. Confirm <code>claude --version</code> works from a fresh PowerShell. If it doesn't, the CLI isn't installed for your user — install it and try again.</p>

    <h2>How do I rotate the bearer token?</h2>
    <p>Right-click the AutoOffice tray icon → <b>Rotate token</b>. The service restarts and the next page load picks up the new token.</p>

    <h2>How do I uninstall everything cleanly?</h2>
    <p>Settings → Apps → AutoOffice → Uninstall. The uninstaller removes the scheduled task, removes the cert from your trust store, and (with confirmation) wipes <code>%LOCALAPPDATA%\AutoOffice</code>.</p>
  </main>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add landing/guide/troubleshooting.html
git commit -m "feat(landing): troubleshooting guide"
```

---

## Task 5: Self-host page

**Files:**
- Create: `landing/self-host/index.html`

- [ ] **Step 1: Write the page**

`landing/self-host/index.html`:
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>AutoOffice — Self-host</title>
  <link rel="stylesheet" href="../style.css" />
  <link rel="icon" href="../assets/icon-32.png" type="image/png" />
</head>
<body>
  <header>
    <a href="../"><img src="../assets/icon-256.png" alt="AutoOffice" /></a>
    <h1>Build your own installer</h1>
  </header>
  <main>
    <nav class="crumbs"><a href="../">Home</a> · Self-host</nav>
    <p>Don't trust a binary built by someone else? Build the installer yourself and ship it to your team.</p>
    <h2>Prerequisites</h2>
    <ul>
      <li>Node.js 22+</li>
      <li><a href="https://bun.sh/">bun</a> (any recent version)</li>
      <li>Inno Setup 6 (free, <a href="https://jrsoftware.org/isinfo.php">jrsoftware.org/isinfo.php</a>)</li>
    </ul>
    <h2>Build steps</h2>
    <pre>git clone https://github.com/Sivan22/autoOffice
cd autoOffice
git checkout master
npm install
npm run build
"C:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer\setup.iss</pre>
    <p>Output: <code>installer/output/AutoOffice-Setup.exe</code>.</p>
    <h2>Re-brand it (optional)</h2>
    <ol>
      <li>Edit <code>installer/setup.iss</code> — change <code>MyAppName</code>, <code>MyAppPublisher</code>, the <code>{B2C3D4E5-…}</code> AppId GUIDs.</li>
      <li>Edit <code>manifest.production.xml</code> — change the top-level <code>&lt;Id&gt;</code> GUID, <code>DisplayName</code>, and <code>ProviderName</code>.</li>
      <li>Replace <code>apps/web/public/assets/icon-*.png</code> with your own.</li>
      <li>Rebuild.</li>
    </ol>
    <p>If you push to a fork and want CI to build the installer for you, the workflow at <code>.github/workflows/installer.yml</code> already does that on push to <code>feat/local-fullstack</code>; adapt the trigger to suit.</p>
  </main>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add landing/self-host/index.html
git commit -m "feat(landing): self-host build instructions"
```

---

## Task 6: Update `deploy.yml` to publish `landing/`

**Files:**
- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 1: Read the current workflow**

```bash
cat .github/workflows/deploy.yml
```

- [ ] **Step 2: Replace the build step with a static-copy of `landing/`**

Replace the existing job's "Build" step with:
```yaml
      - name: Prepare landing/
        run: |
          mkdir -p _site
          cp -r landing/* _site/
      - name: Setup Pages
        uses: actions/configure-pages@v5
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: _site
```

Remove the steps that built the SPA (`npm ci`, `npm run build`, etc.) — they're no longer needed.

Remove the `TODO(plan-09)` comment from plan 01.

The remaining shape of `deploy.yml`:
```yaml
name: Deploy Pages

on:
  push:
    branches: [master]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Prepare landing/
        run: |
          mkdir -p _site
          cp -r landing/* _site/
      - name: Setup Pages
        uses: actions/configure-pages@v5
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: _site
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 3: Commit and push**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: deploy landing/ to GitHub Pages instead of the built SPA"
git push
```

- [ ] **Step 4: Watch the deploy run**

After the merge of this branch (or by manually running on this branch via workflow_dispatch), the `Deploy Pages` workflow goes green and the new landing page is at `https://sivan22.github.io/autoOffice/`.

---

## Self-review (silent — fix inline)

- [x] Spec coverage: landing index, install guide, troubleshooting guide, self-host page, Pages workflow swap — all present.
- [x] No TODO/TBD placeholders.
- [x] Download CTA points at `releases/latest` so we don't have to update markup with each version.
- [x] Troubleshooting page covers the four issues called out as risks in the spec (cert prompt, port collision, service-not-running, CLI not on PATH) plus a token-rotation entry.
- [x] No references to identifiers from later plans.
