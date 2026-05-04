// Compiles the server into a single Windows .exe.
// Run with: bun build.ts
import { $ } from 'bun';

const out = './dist/autoOffice-server.exe';
await $`mkdir -p dist`;

console.log('Building autoOffice-server.exe …');
await $`bun build ./src/index.ts --compile --target=bun-windows-x64 --outfile=${out} --minify --external @google/gemini-cli-core`;
console.log(`OK → ${out}`);
