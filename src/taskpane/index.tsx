import React from 'react';
import { createRoot } from 'react-dom/client';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { App } from './App.tsx';

const rootElement = document.getElementById('root')!;
const root = createRoot(rootElement);

function render() {
  root.render(
    <FluentProvider theme={webLightTheme}>
      <App />
    </FluentProvider>
  );
}

// Initialize when Office is ready, or immediately if outside Office
if (typeof Office !== 'undefined') {
  Office.onReady(() => {
    render();
  });
} else {
  render();
}
