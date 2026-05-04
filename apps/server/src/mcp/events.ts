import { EventEmitter } from 'node:events';
import type { McpStatus } from '@autooffice/shared';

export type StatusEvent = {
  serverId: string;
  status: McpStatus;
  errorMessage?: string | null;
  toolCount?: number;
};

class TypedEmitter extends EventEmitter {
  emitStatus(ev: StatusEvent) {
    this.emit('status', ev);
  }
  onStatus(fn: (ev: StatusEvent) => void) {
    this.on('status', fn);
  }
  offStatus(fn: (ev: StatusEvent) => void) {
    this.off('status', fn);
  }
}

export const mcpEvents = new TypedEmitter();
mcpEvents.setMaxListeners(50);
