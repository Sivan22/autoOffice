import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { SettingsPanel } from './SettingsPanel';
import { bootstrap, _resetForTests } from '../api';
import { LanguageProvider } from '../i18n/index';
import type { ProviderConfig, McpServerView, Settings } from '@autooffice/shared';

const wrap = (ui: React.ReactElement) =>
  render(
    <LanguageProvider initialLocale="en">
      <FluentProvider theme={webLightTheme}>{ui}</FluentProvider>
    </LanguageProvider>,
  );

const settingsPayload: Settings = {
  locale: 'en',
  autoApprove: false,
  maxSteps: 20,
  selectedProviderId: null,
  selectedModelId: null,
};

function makeProvider(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  const now = Date.now();
  return {
    id: 'p1',
    kind: 'anthropic',
    label: 'My Anthropic',
    config: {},
    hasKey: true,
    status: 'ready',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeMcp(overrides: Partial<McpServerView> = {}): McpServerView {
  const now = Date.now();
  return {
    id: 'm1',
    label: 'fs-server',
    transport: 'stdio',
    command: 'node',
    args: ['server.js'],
    cwd: null,
    env: {},
    url: null,
    headers: {},
    timeoutSeconds: 60,
    defaultPolicy: 'ask',
    disabled: false,
    status: 'connected',
    errorMessage: null,
    tools: [
      { name: 'list_files', description: null, inputSchema: null, policy: 'ask' },
      { name: 'read_file', description: null, inputSchema: null, policy: 'allow' },
    ],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

type FetchHandler = (url: string, init?: RequestInit) => Response | Promise<Response>;

function installFetchRouter(routes: Record<string, FetchHandler>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  (globalThis as any).fetch = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    for (const [pattern, handler] of Object.entries(routes)) {
      // pattern can be exact URL+method or just URL
      const [u, m] = pattern.split(' ');
      const method = (init?.method ?? 'GET').toUpperCase();
      if (url === u && (!m || m === method)) return handler(url, init);
    }
    return new Response('not handled: ' + url, { status: 500 });
  });
  return calls;
}

beforeEach(() => {
  _resetForTests();
});

describe('SettingsPanel — Providers', () => {
  it('shows the kind picker defaulting to Anthropic when no providers exist', async () => {
    installFetchRouter({
      '/bootstrap': () => new Response(JSON.stringify({ token: 't', version: 'v' })),
      '/api/settings GET': () => new Response(JSON.stringify(settingsPayload)),
      '/api/providers GET': () => new Response(JSON.stringify([])),
    });
    await bootstrap();

    wrap(<SettingsPanel onClose={() => {}} />);
    // General tab (which contains the provider UI) is the default.

    await waitFor(() => {
      const select = screen.getByLabelText('Provider') as HTMLSelectElement;
      expect(select.value).toBe('anthropic');
    });
  });

  it('collapses the API-key input to a "Change key" link when a key is stored', async () => {
    installFetchRouter({
      '/bootstrap': () => new Response(JSON.stringify({ token: 't', version: 'v' })),
      '/api/settings GET': () =>
        new Response(JSON.stringify({ ...settingsPayload, selectedProviderId: 'p1' })),
      '/api/providers GET': () =>
        new Response(JSON.stringify([makeProvider({ id: 'p1', label: 'Anthropic' })])),
      '/api/providers/p1/models GET': () =>
        new Response(JSON.stringify({ models: [], source: 'fallback' })),
    });
    await bootstrap();

    wrap(<SettingsPanel onClose={() => {}} />);

    // No password input until the user clicks the link.
    const changeLink = await screen.findByRole('button', { name: 'Change key' });
    expect(screen.queryByPlaceholderText('sk-...')).toBeNull();

    fireEvent.click(changeLink);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('sk-...')).toBeInTheDocument();
    });
  });

  it('creates a provider silently when the user types an API key and blurs', async () => {
    let postCount = 0;
    let postSeen = false;
    let settingsPut: any = null;
    installFetchRouter({
      '/bootstrap': () => new Response(JSON.stringify({ token: 't', version: 'v' })),
      '/api/settings GET': () =>
        new Response(
          JSON.stringify(
            postSeen
              ? { ...settingsPayload, selectedProviderId: 'p2' }
              : settingsPayload,
          ),
        ),
      '/api/providers GET': () =>
        new Response(
          JSON.stringify(
            postSeen
              ? [makeProvider({ id: 'p2', label: 'Anthropic', kind: 'anthropic' })]
              : [],
          ),
        ),
      '/api/providers/p2/models GET': () =>
        new Response(JSON.stringify({ models: [], source: 'fallback' })),
      '/api/providers POST': (_u, init) => {
        postCount++;
        postSeen = true;
        const body = JSON.parse((init?.body as string) ?? '{}');
        expect(body.kind).toBe('anthropic');
        expect(body.label).toBe('Anthropic');
        expect(body.apiKey).toBe('sk-test');
        return new Response(JSON.stringify({ id: 'p2' }), { status: 201 });
      },
      '/api/settings PUT': (_u, init) => {
        settingsPut = JSON.parse((init?.body as string) ?? '{}');
        return new Response(
          JSON.stringify({ ...settingsPayload, selectedProviderId: 'p2' }),
        );
      },
    });
    await bootstrap();

    wrap(<SettingsPanel onClose={() => {}} />);
    // General tab (which contains the provider UI) is the default.

    const keyInput = await screen.findByPlaceholderText('sk-...');
    fireEvent.change(keyInput, { target: { value: 'sk-test' } });
    fireEvent.blur(keyInput);

    await waitFor(() => {
      expect(postCount).toBe(1);
      expect(settingsPut).toEqual({
        selectedProviderId: 'p2',
        selectedModelId: null,
      });
    });
  });

  it('surfaces server error message body when key save fails (e.g. DPAPI unavailable)', async () => {
    installFetchRouter({
      '/bootstrap': () => new Response(JSON.stringify({ token: 't', version: 'v' })),
      '/api/settings GET': () => new Response(JSON.stringify(settingsPayload)),
      '/api/providers GET': () => new Response(JSON.stringify([])),
      '/api/providers POST': () =>
        new Response(
          JSON.stringify({ error: 'Storing an API key requires Windows (DPAPI).' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        ),
    });
    await bootstrap();

    wrap(<SettingsPanel onClose={() => {}} />);
    // General tab (which contains the provider UI) is the default.

    const keyInput = await screen.findByPlaceholderText('sk-...');
    fireEvent.change(keyInput, { target: { value: 'sk-test' } });
    fireEvent.blur(keyInput);

    await waitFor(() => {
      expect(screen.getByText(/Storing an API key requires Windows/)).toBeInTheDocument();
    });
  });
});

describe('SettingsPanel — MCP', () => {
  it('toggles per-tool policy via PUT /api/mcp/servers/:id/tools/:tool', async () => {
    let putBody: any = null;
    let listCount = 0;
    installFetchRouter({
      '/bootstrap': () => new Response(JSON.stringify({ token: 't', version: 'v' })),
      '/api/mcp/servers GET': () => {
        listCount++;
        // After PUT, return list with updated policy.
        const tools =
          listCount === 1
            ? [
                { name: 'list_files', description: null, inputSchema: null, policy: 'ask' as const },
                { name: 'read_file', description: null, inputSchema: null, policy: 'allow' as const },
              ]
            : [
                { name: 'list_files', description: null, inputSchema: null, policy: 'deny' as const },
                { name: 'read_file', description: null, inputSchema: null, policy: 'allow' as const },
              ];
        return new Response(JSON.stringify([makeMcp({ tools })]));
      },
      '/api/mcp/servers/m1/tools/list_files PUT': (_u, init) => {
        putBody = JSON.parse((init?.body as string) ?? '{}');
        return new Response(JSON.stringify({ ok: true }));
      },
      '/api/mcp/events GET': () =>
        new Response(new ReadableStream(), {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
    });
    await bootstrap();

    wrap(<SettingsPanel onClose={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: 'MCP' }));
    await waitFor(() => expect(screen.getByText('fs-server')).toBeInTheDocument());

    const policySelect = screen.getByLabelText('Policy for list_files') as HTMLSelectElement;
    fireEvent.change(policySelect, { target: { value: 'deny' } });

    await waitFor(() => {
      expect(putBody).toEqual({ policy: 'deny' });
    });
  });

  it('fetches stderr log when "Show stderr log" is clicked', async () => {
    installFetchRouter({
      '/bootstrap': () => new Response(JSON.stringify({ token: 't', version: 'v' })),
      '/api/mcp/servers GET': () => new Response(JSON.stringify([makeMcp()])),
      '/api/mcp/servers/m1/log GET': () =>
        new Response(JSON.stringify({ lines: ['line one', 'line two'] })),
      '/api/mcp/events GET': () =>
        new Response(new ReadableStream(), {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
    });
    await bootstrap();

    wrap(<SettingsPanel onClose={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: 'MCP' }));
    await waitFor(() => expect(screen.getByText('fs-server')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Show stderr log'));
    await waitFor(() => {
      expect(screen.getByLabelText('stderr log for fs-server').textContent).toContain('line one');
    });
  });
});

describe('SettingsPanel — General', () => {
  it('PUTs settings when autoApprove toggle is changed', async () => {
    let putBody: any = null;
    installFetchRouter({
      '/bootstrap': () => new Response(JSON.stringify({ token: 't', version: 'v' })),
      '/api/settings GET': () => new Response(JSON.stringify(settingsPayload)),
      '/api/providers GET': () => new Response(JSON.stringify([])),
      '/api/settings PUT': (_u, init) => {
        putBody = JSON.parse((init?.body as string) ?? '{}');
        return new Response(JSON.stringify({ ...settingsPayload, autoApprove: true }));
      },
    });
    await bootstrap();

    wrap(<SettingsPanel onClose={() => {}} />);
    // General tab is default
    await waitFor(() =>
      expect(screen.getByLabelText('Auto-approve code execution')).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByLabelText('Auto-approve code execution'));

    await waitFor(() => {
      expect(putBody).toEqual({ autoApprove: true });
    });
  });
});
