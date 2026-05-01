import React from 'react';
import { createRoot } from 'react-dom/client';
import { FluentProvider, webLightTheme, Text } from '@fluentui/react-components';
import { App } from './App.tsx';
import { detectHost, UnsupportedHostError, type HostContext } from './host/context.ts';

const rootElement = document.getElementById('root')!;
const root = createRoot(rootElement);

function renderApp(host: HostContext) {
  root.render(
    <FluentProvider theme={webLightTheme}>
      <App host={host} />
    </FluentProvider>
  );
}

function renderFatal(message: string) {
  root.render(
    <FluentProvider theme={webLightTheme}>
      <div style={{ padding: '24px' }}>
        <Text size={400} weight="semibold">AutoOffice cannot start</Text>
        <p>{message}</p>
      </div>
    </FluentProvider>
  );
}

function start() {
  try {
    renderApp(detectHost());
  } catch (e) {
    if (e instanceof UnsupportedHostError) {
      renderFatal(e.message);
    } else {
      renderFatal(e instanceof Error ? e.message : String(e));
    }
  }
}

if (typeof Office !== 'undefined') {
  Office.onReady(() => start());
} else {
  start();
}
