import React, { useEffect, useState } from 'react';
import { createHighlighter, type Highlighter } from 'shiki';

const LANGS = ['javascript', 'typescript'] as const;
const THEME = 'github-light';

let highlighterPromise: Promise<Highlighter> | null = null;

/**
 * Lazily build a single Shiki highlighter for the whole app.
 * Tests can override by stubbing this module's `createHighlighter` import.
 */
export function getSharedHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: [THEME],
      langs: [...LANGS],
    });
  }
  return highlighterPromise;
}

/** test-only */
export function _resetHighlighterForTests() {
  highlighterPromise = null;
}

/**
 * Render a code string as Shiki-highlighted HTML.
 * If the highlighter hasn't loaded yet, falls back to an unstyled <pre>.
 */
export function CodeBlock({
  code,
  lang = 'javascript',
}: {
  code: string;
  lang?: 'javascript' | 'typescript';
}): React.ReactElement {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const hi = await getSharedHighlighter();
        const out = hi.codeToHtml(code, { lang, theme: THEME });
        if (!cancelled) setHtml(out);
      } catch {
        if (!cancelled) setHtml(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, lang]);

  if (html) {
    return (
      <div
        data-testid="code-block-shiki"
        // Shiki returns <pre><code>...</code></pre> with inline styles.
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <pre data-testid="code-block-fallback" style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
      {code}
    </pre>
  );
}

/**
 * Hook returning a function suitable for the `highlightCode` prop in ChatPanel.
 * The returned function is stable for the lifetime of the component using it.
 */
export function useHighlightCode(): (code: string) => React.ReactNode {
  // Kick off the highlighter eagerly so the first render of a code part has a
  // good chance of seeing real highlighting.
  useEffect(() => {
    getSharedHighlighter().catch(() => {});
  }, []);

  return (code: string) => <CodeBlock code={code} />;
}
