export type Command = 'first-run-init' | 'rotate-token' | 'cert-uninstall' | 'serve';

export function parseArgv(argv: string[]): Command {
  const args = argv.slice(2);
  if (args.includes('--first-run-init')) return 'first-run-init';
  if (args.includes('--rotate-token')) return 'rotate-token';
  if (args.includes('--cert-uninstall')) return 'cert-uninstall';
  return 'serve';
}
