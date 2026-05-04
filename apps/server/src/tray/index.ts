import SysTray from 'systray';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { rotateToken, loadConfig } from '../lifecycle/config';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const ICON = join(dirname(fileURLToPath(import.meta.url)), 'icon.png');

export async function startTray(opts: { port: number; dataDir: string }) {
  const tray = new SysTray({
    menu: {
      icon: encodeIcon(ICON),
      title: 'AutoOffice',
      tooltip: `AutoOffice on https://localhost:${opts.port}`,
      items: [
        { title: 'Open guide', tooltip: '', checked: false, enabled: true },
        { title: 'Restart service', tooltip: '', checked: false, enabled: true },
        { title: 'Rotate token', tooltip: 'Invalidate the current bearer and write a new one', checked: false, enabled: true },
        { title: 'Quit', tooltip: '', checked: false, enabled: true },
      ],
    },
    debug: false,
    copyDir: false,
  });

  tray.onClick(async (action) => {
    switch (action.seq_id) {
      case 0: // Open guide
        spawn('rundll32', ['url.dll,FileProtocolHandler', 'https://sivan22.github.io/autoOffice/guide/'], { detached: true, stdio: 'ignore' }).unref();
        break;
      case 1: // Restart
        process.exit(0); // scheduled task / installer should re-launch; for now we just exit
        break;
      case 2: // Rotate token
        rotateToken(opts.dataDir);
        process.exit(0);
        break;
      case 3: // Quit
        tray.kill();
        process.exit(0);
    }
  });
}

function encodeIcon(path: string): string {
  // SysTray accepts base64 ico/png. Read the file lazily.
  const fs = require('node:fs') as typeof import('node:fs');
  return fs.readFileSync(path).toString('base64');
}
