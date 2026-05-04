import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { SettingsPanel } from './SettingsPanel';
import { bootstrap, _resetForTests } from '../api';
import type { ProviderConfig, McpServerView, Settings } from '@autooffice/shared';

const wrap = (ui: React.ReactElement) =>
  render(<FluentProvider theme={webLightTheme}>{ui}</FluentProvider>);

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
  it('lists providers from /api/providers', async () => {
    installFetchRouter({
      '/bootstrap': () => new Response(JSON.stringify({ token: 't', version: 'v' })),
      '/api/providers GET': () =>
        new Response(JSON.stringify([makeProvider({ label: 'Alpha' })])),
    });
    await bootstrap();

    wrap(<SettingsPanel onClose={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Providers' }));

    await waitFor(() => {
      expect(screen.getByText('Alpha')).toBeInTheDocument();
    });
  });

  it('POSTs a new provider when "Add provider" form is submitted', async () => {
    let postCount = 0;
    let postSeen = false;
    installFetchRouter({
      '/bootstrap': () => new Response(JSON.stringify({ token: 't', version: 'v' })),
      '/api/providers GET': () =>
        new Response(
          JSON.stringify(postSeen ? [makeProvider({ label: 'Beta' })] : []),
        ),
      '/api/providers POST': (_u, init) => {
        postCount++;
        postSeen = true;
        const body = JSON.parse((init?.body as string) ?? '{}');
        expect(body.label).toBe('Beta');
        expect(body.kind).toBe('anthropic');
        expect(body.apiKey).toBe('sk-test');
        return new Response(JSON.stringify({ id: 'p2' }), { status: 201 });
      },
    });
    await bootstrap();

    wrap(<SettingsPanel onClose={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Providers' }));
    await waitFor(() =>
      expect(screen.getByText(/No providers configured/)).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByText('Add provider'));
    fireEvent.change(screen.getByPlaceholderText('My Anthropic key'), {
      target: { value: 'Beta' },
    });
    fireEvent.change(screen.getByPlaceholderText('sk-...'), {
      target: { value: 'sk-test' },
    });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(postCount).toBe(1);
      expect(screen.getByText('Beta')).toBeInTheDocument();
    });
  });

  it('DELETEs a provider when remove is clicked and confirmed', async () => {
    let deleted = false;
    installFetchRouter({
      '/bootstrap': () => new Response(JSON.stringify({ token: 't', version: 'v' })),
      '/api/providers GET': () =>
        new Response(JSON.stringify(deleted ? [] : [makeProvider({ label: 'ToDelete' })])),
      '/api/providers/p1 DELETE': () => {
        deleted = true;
        return new Response(null, { status: 204 });
      },
    });
    await bootstrap();
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);

    wrap(<SettingsPanel onClose={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Providers' }));
    await waitFor(() => expect(screen.getByText('ToDelete')).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText('Remove ToDelete'));

    await waitFor(() => {
      expect(deleted).toBe(true);
      expect(screen.getByText(/No providers configured/)).toBeInTheDocument();
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

describe('SettingsPanel — Global', () => {
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
    // Global tab is default
    await waitFor(() =>
      expect(screen.getByLabelText('Auto-approve code execution')).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByLabelText('Auto-approve code execution'));

    await waitFor(() => {
      expect(putBody).toEqual({ autoApprove: true });
    });
  });
});
