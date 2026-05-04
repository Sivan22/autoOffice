import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Mock Shiki before importing CodeBlock so getSharedHighlighter sees the stub.
vi.mock('shiki', () => {
  const codeToHtml = (code: string, opts: { lang: string; theme: string }) =>
    `<pre class="shiki ${opts.theme}" data-lang="${opts.lang}"><code>${code}</code></pre>`;
  return {
    createHighlighter: vi.fn(async () => ({
      codeToHtml,
    })),
  };
});

import { CodeBlock, _resetHighlighterForTests, useHighlightCode } from './CodeBlock';
import * as shiki from 'shiki';

describe('CodeBlock', () => {
  beforeEach(() => {
    _resetHighlighterForTests();
    (shiki.createHighlighter as any).mockClear?.();
  });

  it('renders a fallback <pre> before Shiki loads', () => {
    render(<CodeBlock code="const x = 1" />);
    expect(screen.getByTestId('code-block-fallback')).toBeInTheDocument();
  });

  it('renders Shiki-highlighted HTML once the highlighter resolves', async () => {
    render(<CodeBlock code="const x = 1" />);
    await waitFor(() => {
      expect(screen.getByTestId('code-block-shiki')).toBeInTheDocument();
    });
    const el = screen.getByTestId('code-block-shiki');
    expect(el.innerHTML).toContain('class="shiki');
    expect(el.innerHTML).toContain('const x = 1');
  });

  it('passes lang prop through to Shiki', async () => {
    render(<CodeBlock code="let y: number = 2" lang="typescript" />);
    await waitFor(() => {
      const el = screen.getByTestId('code-block-shiki');
      expect(el.innerHTML).toContain('data-lang="typescript"');
    });
  });

  it('useHighlightCode returns a function rendering CodeBlock', async () => {
    function Probe() {
      const highlight = useHighlightCode();
      return <div>{highlight('await main()')}</div>;
    }
    render(<Probe />);
    await waitFor(() => {
      expect(screen.getByTestId('code-block-shiki')).toBeInTheDocument();
    });
    expect(screen.getByTestId('code-block-shiki').innerHTML).toContain('await main()');
  });
});
