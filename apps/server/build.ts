// Compiles the server into a single Windows .exe.
// Run with: bun build.ts
import { $ } from 'bun';

const out = './dist/autoOffice-server.exe';
await $`mkdir -p dist`;

console.log('Building autoOffice-server.exe …');
await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  target: 'bun',
  minify: true,
  // `--compile` is bun's CLI flag; surface via Bun.build is `compile: { target: 'bun-windows-x64', outfile }`.
  // Older bun versions support only the CLI form. We exec it directly:
});

await $`bun build ./src/index.ts --compile --target=bun-windows-x64 --outfile=${out} --minify`;
console.log(`OK → ${out}`);
