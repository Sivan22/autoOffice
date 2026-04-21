export interface ExecutionResult {
  success: boolean;
  output?: unknown;
  error?: string;
  stack?: string;
}

export class Sandbox {
  private iframe: HTMLIFrameElement | null = null;
  private pendingExecutions = new Map<string, {
    resolve: (result: ExecutionResult) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();

  constructor() {
    this.handleMessage = this.handleMessage.bind(this);
    window.addEventListener('message', this.handleMessage);
  }

  init(): void {
    this.createIframe();
  }

  private createIframe(): void {
    // Remove existing iframe if present
    if (this.iframe) {
      this.iframe.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'autooffice-sandbox';
    iframe.style.display = 'none';
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');

    // Use the static iframe.html served by Vite
    const base = window.location.origin;
    iframe.src = `${base}/iframe.html`;

    document.body.appendChild(iframe);
    this.iframe = iframe;
  }

  private handleMessage(event: MessageEvent): void {
    const data = event.data;
    if (!data || !data.type || !data.id) return;

    if (data.type === 'result' || data.type === 'error') {
      const pending = this.pendingExecutions.get(data.id);
      if (!pending) return;

      clearTimeout(pending.timer);
      this.pendingExecutions.delete(data.id);

      if (data.type === 'result' && data.success) {
        pending.resolve({ success: true, output: data.output });
      } else {
        pending.resolve({
          success: false,
          error: data.error || 'Unknown execution error',
          stack: data.stack,
        });
      }
    }
  }

  execute(code: string, timeout: number = 30000): Promise<ExecutionResult> {
    return new Promise((resolve) => {
      if (!this.iframe?.contentWindow) {
        resolve({ success: false, error: 'Sandbox iframe not initialized' });
        return;
      }

      const id = crypto.randomUUID();

      const timer = setTimeout(() => {
        this.pendingExecutions.delete(id);
        // Respawn iframe after timeout (it may be stuck)
        this.createIframe();
        resolve({ success: false, error: `Execution timed out after ${timeout}ms` });
      }, timeout);

      this.pendingExecutions.set(id, { resolve, timer });

      this.iframe.contentWindow.postMessage(
        { type: 'execute', id, code },
        '*',
      );
    });
  }

  destroy(): void {
    window.removeEventListener('message', this.handleMessage);
    for (const [, pending] of this.pendingExecutions) {
      clearTimeout(pending.timer);
    }
    this.pendingExecutions.clear();
    this.iframe?.remove();
    this.iframe = null;
  }
}
