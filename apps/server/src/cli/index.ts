export type Command = 'first-run-init' | 'rotate-token' | 'serve';

export function parseArgv(argv: string[]): Command {
  const args = argv.slice(2);
  if (args.includes('--first-run-init')) return 'first-run-init';
  if (args.includes('--rotate-token')) return 'rotate-token';
  return 'serve';
}
