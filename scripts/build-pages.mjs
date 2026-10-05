import { cp, rm, writeFile, readdir, copyFile, unlink } from 'node:fs/promises';
import { build } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist-pages');
// The only removed directory is this repository's generated Pages build.
await rm(output, { recursive: true, force: true });
await cp(path.join(root, 'dist'), output, { recursive: true });
// Pages canonicalizes directory indexes with a trailing slash. Flat HTML files
// retain this site's existing slashless canonical URLs and legacy redirects.
for (const file of await readdir(output, { recursive: true })) {
  if (file === 'index.html' || !file.endsWith(`${path.sep}index.html`)) continue;
  const source = path.join(output, file);
  await copyFile(source, path.join(output, `${path.dirname(file)}.html`));
  await unlink(source);
}
await build({ configFile: false, logLevel: 'warn', build: { ssr: path.join(root, 'server/pages-worker.ts'), target: 'es2022', outDir: output, emptyOutDir: false, rollupOptions: { output: { entryFileNames: '_worker.js' } } } });
await writeFile(path.join(output, '_routes.json'), JSON.stringify({ version: 1, include: ['/*'], exclude: ['/assets/*', '/media/*', '/brand/*', '/favicon.svg'] }));
console.log('Pages release built with a production-only service binding to the account Worker.');
